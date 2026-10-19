# Japit Call Center — Telephony Layer Root Cause Report

**Date:** 2026-07-28  
**Role:** Lead Telecom Architect  
**Scope:** SIP / AMI / Presence / Call Lifecycle / Docker Leader-Replica / PostgreSQL / Redis  
**Architecture:** FastAPI×6 (Leader=fastapi-1), PostgreSQL, Redis, Asterisk, NGINX, WebRTC SIP, X-Lite SIP, React

---

## Executive verdict

The telephony plane had **multiple production-breaking root causes**, not timer/race bandaids: AMI frame coalescing that drops events, claim-before-commit idempotency that permanently skips failed events, hangup heuristics that tear down the wrong agent, wrap-up/disposition paths that wipe or falsely open, and worker defaults that can create duplicate consumers.

**All CRITICAL and HIGH findings below have been fixed in code** (plus supporting migrations). Remaining items are architectural (leader HA) or medium severity.

---

## Architecture ownership (verified)

| Capability | Owner | Gate |
|---|---|---|
| AMI event listener (`Events: on`) | **fastapi-1 only** | `AMI_TELEPHONY_EVENTS_ENABLED=true` |
| Dispatch worker | **fastapi-1 only** | `DISPATCH_WORKER_ENABLED=true` |
| Recording sync | **fastapi-1 only** | `RECORDING_SYNC_ENABLED=true` |
| Queue recovery | **fastapi-1 only** | `QUEUE_RECOVERY_ENABLED=true` |
| Presence sync (AMI-driven) | **fastapi-1** | via AMI listener |
| Agent telephony HTTP / SIP WS / realtime poll | **pinned to :8101** | NGINX `japit_fastapi_ws` |
| General CRM HTTP | fastapi-1..6 | `least_conn` |

Compose already disabled workers on replicas 2–6. **Code defaults are now `False`** so misconfigured processes cannot silently start dual AMI/dispatch consumers.

---

## CRITICAL findings (fixed)

### C1 — AMI reader coalesced / dropped frames under burst

| | |
|---|---|
| **Severity** | CRITICAL |
| **Files** | `app/ami_telephony_listener.py`, `app/asterisk_ami.py`, `app/pjsip_endpoint_state.py`, **new** `app/ami_framing.py` |
| **Root cause** | Readers accumulated until first `\\r\\n\\r\\n`, then parsed the *entire* buffer. Extra complete messages in the same `recv()` were merged (later keys overwrite) or discarded. |
| **Why it happened** | Classic AMI framing bug — treated TCP stream as one message per read. |
| **Exact fix** | Shared `AmiFrameBuffer` splits on frame boundaries and retains leftovers. All three AMI readers use it. |
| **Why correct** | Each AMI event is processed exactly once; no silent Hangup/DialEnd loss under load. |
| **Risk** | Low — framing is pure I/O; covered by unit tests. |
| **Regression** | Higher event throughput fidelity; presence less sticky. |

### C2 — Idempotency claimed Redis before successful process

| | |
|---|---|
| **Severity** | CRITICAL |
| **Files** | `app/queue/idempotency.py`, `app/ami_telephony_listener.py` |
| **Root cause** | `SET NX` ran before `_dispatch_ami_event`. On DB/handler exception the key stayed 1h → event permanently skipped. |
| **Exact fix** | Two-phase: claim `"processing"` (120s TTL) → on success `mark_ami_event_seen` (`"done"`, 1h) → on failure `release_ami_event_claim`. Richer fingerprint (Cause, DialStatus, Position, BridgeUniqueid). Mutation events fail-closed if Redis down. |
| **Why correct** | Failed handlers can retry; successful events stay deduped; Redis outage cannot double-mutate presence. |
| **Risk** | Medium — brief reprocess window if crash after commit before mark-done (handlers must stay idempotent). |
| **Regression** | Fewer permanent presence/recording misses after transient DB errors. |

### C3 — Orphan Mediant Hangup attributed to “sole live WebRTC agent”

| | |
|---|---|
| **Severity** | CRITICAL |
| **Files** | `app/ami_telephony_listener.py` |
| **Root cause** | If Hangup had Linkedid but no CallSession/ext, and exactly one agent was live, that agent was force-disconnected. |
| **Exact fix** | Removed heuristic. Orphan → `mark_inbound_queue_abandoned` only. Session lookup via `find_open_session_by_linked_id`. |
| **Why correct** | Hangup attribution requires Linkedid↔session (or channel/ext) match — never global sole-agent guess. |
| **Risk** | Low — some drifted Linkedid edge cases fall to abandon (recoverable) instead of killing live calls. |

### C4 — Deskphone hangup wiped wrap-up / cleared `active_call_session_id`

| | |
|---|---|
| **Severity** | CRITICAL |
| **Files** | `app/telephony_presence_sync.py` (`mark_deskphone_hangup`) |
| **Root cause** | Always nulls session id first; wrap-up never restored it; later hangup demoted wrap_up → ready. |
| **Exact fix** | Mirror customer-disconnect path: keep session id in wrap_up; no-op demote if already wrap_up. |
| **Why correct** | Disposition target must survive late Hangup events. |

### C5 — Post-customer Hangup used bare endpoint id `PJSIP/{ext}ws`

| | |
|---|---|
| **Severity** | CRITICAL |
| **Files** | `app/telephony_presence_sync.py` |
| **Root cause** | AMI Hangup needs full channel name; bare endpoint id leaves softphone up → ghost active_call. |
| **Exact fix** | Resolve via `webrtc_agent_channel_names()` and Hangup each live `PJSIP/{ext}ws-*` channel. |
| **Why correct** | Matches Asterisk channel naming. |

### C6 — False wrap-up on outbound cancel / softphone-only connect

| | |
|---|---|
| **Severity** | CRITICAL |
| **Files** | `app/telephony_presence_sync.py` (`_should_enter_wrap_up`), `app/routers/agent.py` (`call-ended`), `reactjs/.../useAgentSipPhone.ts` |
| **Root cause** | `previous_status == "in_call"` or frontend `answered_at` on softphone connect treated cancel as connected. |
| **Exact fix** | Wrap-up gated solely on `call_session.answered_at`. Frontend: outbound softphone connect leaves `answered_at` null; disposition uses answered_at only for outbound. |
| **Why correct** | Disposition is a post-conversation requirement, not a softphone media requirement. |

### C7 — Deskphone transfer forced Ready and skipped disposition

| | |
|---|---|
| **Severity** | CRITICAL |
| **Files** | `app/routers/agent.py` (`telephony_transfer`) |
| **Root cause** | Always set ready + clear session after transfer (including failures). |
| **Exact fix** | Failure → keep presence. Success + answered → wrap_up + CallWrapUp. Unanswered → ready. |
| **Why correct** | Transfer success on answered calls still requires CRM disposition. |

### C8 — `scalar_one_or_none()` on non-unique `pbx_linked_id`

| | |
|---|---|
| **Severity** | CRITICAL |
| **Files** | `telephony_presence_sync.py`, `ami_telephony_listener.py` |
| **Root cause** | Historical rows share Linkedid; MultipleResultsFound crashed Hangup path. |
| **Exact fix** | Always use `find_open_session_by_linked_id` (prefer open, else newest). |
| **Why correct** | Matches partial unique index semantics. |

### C9 — Accept/`force_connect` could reopen ended row beside another open row

| | |
|---|---|
| **Severity** | CRITICAL |
| **Files** | `app/telephony_presence_sync.py` (`mark_deskphone_connected`) |
| **Root cause** | Nulling `ended_at` while upsert already created a new open row → unique violation. |
| **Exact fix** | Prefer existing open session; IntegrityError nested txn + re-fetch; never reopen if another open exists. |

---

## HIGH findings (fixed)

| ID | Issue | Fix | Files |
|---|---|---|---|
| H1 | Heartbeat paused queues but left UI Ready | Auto-pause presence (`paused` + reason `webrtc_unregistered`) | `agent.py` |
| H2 | Custom device-state INUSE pulse on Ready | Pulse disabled (`pulse=False`) | `webrtc_queue_state.py` |
| H3 | WebRTC `max_contacts=5` | `max_contacts=1` for all endpoint types | `telephony_sync.py` |
| H4 | No session timers / RTP timeout / media_address in realtime | Profile + upsert + migration `0048` | `telephony_sync.py`, alembic |
| H5 | SIP inject failures swallowed | Retry×3 + surface registration error | `useAgentSipPhone.ts` |
| H6 | Logout allowed in wrap_up | Block with 409 | `agent.py` |
| H7 | Aggressive WebRTC reconcile on empty CLI | `None` = probe failed; skip reconcile | `webrtc_queue_state.py`, presence_sync |
| H8 | Blind REFER ended call even on throw | Catch REFER failure; keep call | `useAgentSipPhone.ts` |
| H9 | Worker flags default ON | Defaults `False`; compose enables leader | `config.py` |
| H10 | Dispatch claim left job `pending` | Atomic `running` + `started_at` under FOR UPDATE | `dispatch/worker.py` |
| H11 | Supervisor used `asterisk -rx` in Docker | `is_pjsip_endpoint_registered` via AMI | `supervisor.py` |
| H12 | No unique on disposition / active wrap-up / recording path | Migration `0049` unique indexes + dedupe | alembic |
| H13 | Call lock TTL 120s vs long rings | TTL 600s | `queue/locks.py` |

---

## MEDIUM (documented, not all code-changed)

| ID | Issue | Notes |
|---|---|---|
| M1 | Leader SPOF (AMI/dispatch/SIP inject on :8101 only) | Needs Redis leader election or dedicated worker + nginx failover — architectural follow-up |
| M2 | No FullyBooted presence rebuild | On Asterisk restart, rely on heartbeat/reconcile until HA catch-up |
| M3 | DialBegin / DeviceState / QueueMemberStatus not consumed | Presence uses UserEvent + Newstate + Hangup; OK if UserEvents reliable |
| M4 | `JapitCallbackFailed` / `JapitHeartbeat` UserEvents unhandled | Dialplan emits; listener ignores |
| M5 | No TURN — Google STUN only | Symmetric NAT one-way audio risk |
| M6 | In-memory SIP inject queue on leader | Lost on leader restart |
| M7 | Sleeps on Ready/Accept for REGISTER wait | Remaining; framing+idempotency reduce need |
| M8 | Campaign Originate on LB pool | Actions OK; presence still leader-bound |
| M9 | WebRTC codecs ulaw/alaw only | Intentional (no Opus module) |

---

## Database / Redis summary

**DB**
- Open-session partial unique on `pbx_linked_id` retained.
- Added uniques: one disposition per session; one active wrap-up per session; one live recording per `pbx_source_path`.
- Linkedid lookups no longer crash on historical duplicates.
- CallSession create on connect uses nested IntegrityError recovery.

**Redis**
- AMI seen keys: processing → done / release on error.
- Call reservation TTL 600s.
- Mutation events fail-closed if Redis unavailable.

---

## Docker / leader fail scenarios

| Scenario | Behavior after fixes |
|---|---|
| fastapi-1 crash | Telephony pinned routes fail until container restarts; replicas keep CRM HTTP. **No automatic failover** (M1). |
| Misconfigured replica enables AMI | Defaults now False; compose still explicit. Dual consumer risk greatly reduced. |
| Redis down | Mutation AMI events skipped (fail-closed); call reservation fail-closed (existing). |
| Asterisk restart | Listener reconnects (5s); no FullyBooted rebuild (M2). |

---

## Deploy checklist

1. Apply migrations: `20260728_0048`, `20260728_0049`
2. Rebuild/redeploy FastAPI image to all 6 containers
3. Confirm compose env: fastapi-1 workers `true`, 2–6 `false`
4. Set `ASTERISK_MEDIA_ADDRESS` to public RTP IP if WebRTC clients are off-LAN
5. Re-sync PJSIP endpoints (admin extension save / telephony sync) so timers/RTP/AOR apply
6. Smoke: inbound offer → accept → hangup → wrap-up; outbound cancel (no wrap-up); transfer answered → wrap-up; supervisor Listen with Docker-only AMI

---

## Tests

- `tests/test_ami_framing.py` — 4 passed (framing split, partial retain, welcome banner, Cause in idempotency key)

---

## Files changed (primary)

- `python/app/ami_framing.py` **(new)**
- `python/app/ami_telephony_listener.py`
- `python/app/asterisk_ami.py`
- `python/app/pjsip_endpoint_state.py`
- `python/app/queue/idempotency.py`
- `python/app/queue/locks.py`
- `python/app/telephony_presence_sync.py`
- `python/app/webrtc_queue_state.py`
- `python/app/telephony_sync.py`
- `python/app/config.py`
- `python/app/dispatch/worker.py`
- `python/app/routers/agent.py`
- `python/app/routers/supervisor.py`
- `python/alembic/versions/20260728_0048_pjsip_endpoint_timers_rtp.py`
- `python/alembic/versions/20260728_0049_telephony_uniques.py`
- `python/tests/test_ami_framing.py`
- `reactjs/src/hooks/useAgentSipPhone.ts`

---

## Residual CRITICAL / HIGH

**None remaining in-scope for code fixes.** Leader HA (M1) is the highest remaining operational risk and requires an infrastructure change (elected worker or multi-upstream telephony pin), not a timer.
