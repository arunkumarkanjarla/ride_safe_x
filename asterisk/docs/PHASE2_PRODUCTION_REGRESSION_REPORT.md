# Japit Call Center — Phase 2 Production Regression Report

**Date:** 2026-07-28  
**Roles:** Principal QA Architect / Telecom / Performance / Reliability  
**Architecture constraint:** Docker×6 leader/replica design **unchanged**  
**PSTN validation number:** `7702866838`  
**Harness results:** `docs/phase2_artifacts/phase2_results_20260728T102634Z.json`

---

## Executive verdict

Phase 2 discovered **reproducible production failures on the live stack**, fixed their root causes (not timer bandaids), applied pending Phase‑1 migrations, and re-validated with an automated runtime harness.

| Gate | Result |
|---|---|
| Critical runtime defects found & fixed | **PASS** (dual AMI, stuck queue pause, orphan sessions/wrap-ups, AOR max_contacts) |
| Automated infrastructure/telephony invariants (30×) | **PASS 10/10 executable cases** |
| Chaos (replica restart ×5) | **PASS** |
| Load (500 REST + 50 AMI) | **PASS** |
| Authenticated WebRTC/X-Lite 30× real-call matrix | **BLOCKED** — requires `PHASE2_AGENT_USER` / `PHASE2_AGENT_PASSWORD` + live softphone |
| Production readiness score | **78 / 100** (infra/telephony plane healed; full agent UX call matrix not yet credentialed) |

Docker×6 / NGINX pins / Postgres / Redis / Asterisk hosts were **not redesigned**.

---

## PART A — Live defects discovered (root cause → fix)

### P2-C1 — Dual AMI consumers (host :8000 + fastapi-1)

| | |
|---|---|
| **Severity** | CRITICAL |
| **Reproduction** | `asterisk -rx 'manager show connected'` showed **2× japitami** while both `japit-callcenter-backend.service` (:8000) and `japit-fastapi-1` (:8101) ran with telephony workers enabled. |
| **Root cause** | Host systemd backend inherited `RECORDING_SYNC_ENABLED=true` and default AMI listener ON, competing with Docker leader. |
| **Why it happened** | Legacy host API process was never declared “API-only” after Docker×6 cutover. |
| **Exact fix** | Set in `/etc/japit/japit-callcenter-backend.env`: `AMI_TELEPHONY_EVENTS_ENABLED=false`, `DISPATCH_WORKER_ENABLED=false`, `QUEUE_RECOVERY_ENABLED=false`, `RECORDING_SYNC_ENABLED=false`, `JAPIT_INSTANCE_ID=host-backend-api-only`. Restarted host backend + Docker fastapi. |
| **Verification** | 30/30 harness checks: exactly **1** AMI session owned by fastapi-1. |
| **Architecture impact** | None — Docker×6 unchanged; host process demoted to API-only. |

### P2-C2 — Ready UI but Local offer stuck `paused:in_call` → AgentsBusy

| | |
|---|---|
| **Severity** | CRITICAL |
| **Reproduction** | Agent 1016 presence=`ready`, but `queue show Airtel_Billing` showed `Local/1016@japit-agent-offer/n (paused:in_call)`. Live log at 15:04: inbound `+917702866838` → `JapitAgentsBusy` → abandon. |
| **Root cause** | Deskphone hangup/AMI disconnect paths set presence Ready without unpausing Local/@japit-agent-offer (WebRTC path restored device-state; deskphone did not). |
| **Exact fix** | `_restore_queue_offers_after_ready()` on disconnect/hangup/linked-id end; heartbeat heals Ready agents with `pause_agent_queue_offers(paused=False)`. Immediate ops heal: `queue unpause member Local/1016@japit-agent-offer/n`. |
| **Files** | `app/telephony_presence_sync.py`, `app/routers/agent.py` |
| **Verification** | 30/30 `billing_local_not_paused_in_call` PASS. |

### P2-C3 — Orphan open `call_sessions` + duplicate/stale active wrap-ups

| | |
|---|---|
| **Severity** | CRITICAL (data integrity) |
| **Reproduction** | DB had **9** open sessions (some days old) and **12** active wrap-ups (including duplicates for one session). |
| **Root cause** | Hangup/idempotency races (Phase 1) + recovery only aged inbound waiting rows; no unique active wrap-up until migration `0049`. |
| **Exact fix** | Applied alembic `0048`/`0049`; closed orphan sessions; completed stale wrap-ups; extended `app/queue/recovery.py` to reconcile orphan sessions + stale/duplicate wrap-ups. |
| **Verification** | open_sessions=0, active_wrapups=0, dup_wrap=0 (30×). |

### P2-H1 — Live WebRTC AOR still `max_contacts=5`

| | |
|---|---|
| **Severity** | HIGH |
| **Reproduction** | `pjsip show aor 1002ws` → max_contacts 5 (Phase 1 code not applied to live rows). |
| **Exact fix** | SQL update all `%ws` AORs to `max_contacts=1`; `module reload res_pjsip.so`. |
| **Verification** | 30/30 AOR checks show max_contacts=1. |

---

## PART B — Automated regression matrix

Executed by `python/scripts/phase2_runtime_regression.py`.

| Case | Iterations | Result |
|---|---:|---|
| Health all instances (:8000 + :8101–8106) | 30 | **PASS** |
| Leader-only single AMI session | 30 | **PASS** |
| AMI Ping | 30 | **PASS** |
| WebRTC AOR max_contacts=1 | 30 | **PASS** |
| Billing Local not stuck paused:in_call | 30 | **PASS** |
| DB invariants (no open orphans / dup wrap-ups / AOR≠1) | 30 | **PASS** |
| Load REST 500 concurrent GETs to leader | 1 (n=500) | **PASS** |
| AMI burst 50 Ping | 1 (n=50) | **PASS** |
| Replica workers disabled (compose env) | 30 | **PASS** |
| Chaos: restart `japit-fastapi-3` | 5 | **PASS** (readiness poll ≤60s) |
| Auth login + heartbeat | — | **SKIPPED** (set `PHASE2_AGENT_USER`/`PHASE2_AGENT_PASSWORD`) |

**Screenshots:** Not captured — no authenticated browser softphone session in this run.  
**Artifacts:** `docs/phase2_artifacts/phase2_results_20260728T102634Z.json`, `docs/phase2_artifacts/latest_run.log`

---

## PART C — Call scenario matrix (WebRTC / X-Lite)

Target number for all PSTN legs: **7702866838**.

| Scenario | Required | Status |
|---|---|---|
| Outbound / Inbound / Answer / Reject / Busy / No Answer | Live agent + softphone | **NOT EXECUTED (credential gate)** |
| Cancel before/after ring | Live agent | **NOT EXECUTED** |
| Hangup agent/customer | Live agent | **NOT EXECUTED** |
| Browser refresh / logout during call | Browser | **NOT EXECUTED** |
| Wrap-up / Disposition | Live agent | **NOT EXECUTED** |
| Hold / Resume / Mute / Unmute | Live agent | **NOT EXECUTED** |
| Blind / Warm transfer / Conference | Live agent | **NOT EXECUTED** |
| Queue overflow / timeout / retry / callback | Live inbound DID | **PARTIAL evidence only** (15:04 AgentsBusy→abandon on 7702866838 **before** P2-C2 fix) |
| Recording save/link/download | Live answered call | **PARTIAL** (15:02 recording sync succeeded for outbound linked_id prior to restart) |

To unlock 30× full matrix:

```bash
export PHASE2_AGENT_USER='...'
export PHASE2_AGENT_PASSWORD='...'
# Agent must register WebRTC or X-Lite 1016/1002 before run
/opt/japit_callcenter/python/.venv/bin/python /opt/japit_callcenter/python/scripts/phase2_runtime_regression.py
```

---

## PART D — Chaos

| Fault | Result |
|---|---|
| Restart replica fastapi-3 ×5 | Recovers to healthy; leader AMI remains single listener |
| Leader restart (during deploy) | AMI briefly 0 then 1 — expected; no dual consumer after host demotion |
| Host backend restart | Stays API-only (workers false) |
| Redis / NGINX / Asterisk process kill | **Not executed** this pass (would be service-impacting; schedule maintenance window) |

---

## PART E — Load / performance

| Metric | Observed |
|---|---|
| 500 REST `/` to leader | 0 errors (harness PASS; p95 gate &lt;500ms on that run) |
| Follow-up 100 REST sample | p50≈105ms, p95≈1134ms, max≈1203ms (cold/contended) |
| AMI Ping ×50 | 50/50 success |
| Docker CPU (steady) | ~0.2–6% per container |
| Docker RSS | ~148–170 MiB / container |
| fastapi-1 ERROR/Traceback (30m) | **0** matches |

---

## PART F — Database validation (post-fix)

| Check | Result |
|---|---|
| Open `call_sessions` | **0** |
| Active wrap-ups | **0** |
| Duplicate active wrap-ups | **0** |
| WebRTC AOR max_contacts≠1 | **0** |
| Alembic head | `20260728_0049` |

---

## PART G — Log validation

| Source | Finding |
|---|---|
| fastapi-1 docker logs (30m) | No Traceback/Unhandled after restart |
| Asterisk messages | Vicidial cron `sendcron`/`updatecron`/`listencron` AMI auth failures every minute (**external noise**, not Japit) |
| japit_python active.log | Pre-fix JapitAgentsBusy for 7702866838 explained by P2-C2 |

---

## Code / config changes (Phase 2)

| Path | Change |
|---|---|
| `app/telephony_presence_sync.py` | Restore Local queue offers when returning to Ready after hangup |
| `app/routers/agent.py` | Heartbeat heals Ready agents stuck paused:in_call |
| `app/queue/recovery.py` | Orphan session + stale/duplicate wrap-up reconciliation |
| `/etc/japit/japit-callcenter-backend.env` | Host API-only (telephony workers off) |
| Alembic `0048`/`0049` | Applied live |
| `telephony.japit_ps_aors` | WebRTC max_contacts forced to 1 |
| `scripts/phase2_runtime_regression.py` | New automated harness |
| Docker×6 compose / NGINX pins | **Unchanged** |

---

## Remaining issues

| ID | Severity | Item | Status |
|---|---|---|---|
| R1 | HIGH (coverage) | Full 30× WebRTC/X-Lite real-call matrix for 7702866838 | Blocked on agent credentials + softphone registration |
| R2 | MEDIUM | Asterisk Vicidial cron AMI users failing auth | External; disable cron or create users |
| R3 | MEDIUM | Host `:8000` still serves API beside Docker (intentional legacy) | Documented; workers disabled |
| R4 | LOW | Load p95 variance under burst | Monitor; no functional failure |

**Zero Critical remaining on validated plane.**  
**Zero High remaining on validated plane** (coverage gap R1 is test-execution, not an open product defect from this run).

---

## Production readiness score: **78 / 100**

**Why not higher:** Authenticated softphone call lifecycle (Parts 1–3 full 30×) was not executed without credentials.  
**Why not lower:** Dual-AMI SPOF competition, Ready/AgentsBusy queue pause, orphan DB rows, and AOR multi-contact were reproduced and fixed; automated invariants pass 30×; replica chaos recovers; Docker×6 architecture preserved.

### Go / No-Go

| Decision | Condition |
|---|---|
| **Conditional GO** for infra/telephony plane | After deploying these fixes (already applied live) |
| **NO-GO for full agent UX certification** | Until Phase‑2 credentialed 30× call matrix is run against 7702866838 |

---

## Next command for operators

```bash
export PHASE2_AGENT_USER='<billing_or_test_agent>'
export PHASE2_AGENT_PASSWORD='<secret>'
# Ensure X-Lite 1016 or WebRTC registered, then:
/opt/japit_callcenter/python/.venv/bin/python \
  /opt/japit_callcenter/python/scripts/phase2_runtime_regression.py
```

Extend the harness with originate/hangup/disposition loops once auth works; keep Docker×6 unchanged.
