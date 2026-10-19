# Enterprise Asterisk Contact Center — Complete Audit Report

**Scope:** `/opt/japit_callcenter` (executable code + configs). Host Asterisk checked only for operational evidence.  
**Mode:** Audit only — no code, configs, schema, or packages were changed.  
**Date:** 2026-07-31

---

## Executive Summary

Against the Phase 1–4 modules in the Enterprise Asterisk Contact Center Implementation Guide, **overall implementation is approximately 45%**.

| Band | Features |
|------|----------|
| Strong | AMI; Listen / Whisper / Barge |
| Partial | Queue Callback; ConfBridge (as deskphone mixer, not multi-party conference product) |
| Missing | CEL; Estimated Wait Time; Dynamic Skill Routing; SIP Trunk Health; RTP Quality; Call Parking |

Telephony control is **AMI-first and production-real**. CEL is **not part of the application stack**. Queue callbacks capture and list well but do not auto-dial or offer in-queue threshold escape. Skills exist only as unused DB schema. Monitoring (ChanSpy) is end-to-end. ConfBridge is used heavily for agent↔customer mixing (`max_members=3`), not as a conference-room product.

---

## Feature Status Matrix

| # | Feature | Status | Completion | Confidence | Evidence (summary) |
|---|---------|--------|------------|------------|--------------------|
| 1 | CEL | ❌ Not Implemented | 0% | 98% | No `cel.conf` in repo; host CEL disabled; no CEL tables/readers |
| 2 | AMI | ✅ Fully Implemented | 95% | 97% | `AsteriskAmiClient`, listener, dialplan UserEvents, host `manager_japit.conf` |
| 3 | Queue Callback | 🟡 Partially Implemented | 55% | 95% | Capture + APIs/UI; no auto-dial worker; no in-queue DTMF escape |
| 4 | Estimated Wait Time | ❌ Not Implemented | 10% | 95% | Position/wait only; `reportholdtime` hard-coded `no` |
| 5 | Dynamic Skill Routing | ❌ Not Implemented | 5% | 98% | `operations.skills` / `agent_skills` schema only |
| 6 | SIP Trunk Health | ❌ Not Implemented | 8% | 95% | Agent AOR qualify only; Mediant trunk not monitored |
| 7 | RTP Quality Monitoring | ❌ Not Implemented | 5% | 97% | `rtp_timeout` / `rtcp_mux` settings only; no MOS/jitter/loss |
| 8 | ConfBridge | 🟡 Partially Implemented | 65% | 92% | Production deskphone mixer; no multi-party conference product |
| 9 | Call Parking | ❌ Not Implemented | 0% | 98% | No Park dialplan/API/UI; hold = MOH Redirect |
| 10 | Listen | ✅ Fully Implemented | 95% | 97% | ChanSpy `qbu` + supervisor portal |
| 11 | Whisper | ✅ Fully Implemented | 95% | 97% | ChanSpy `qbwu` + supervisor portal |
| 12 | Barge | ✅ Fully Implemented | 95% | 97% | ChanSpy `qbBu` + supervisor portal |

**Weighted overall: ~45%**

---

## Detailed Feature Findings

---

### 1. CEL (Channel Event Logging)

#### 1. Status

❌ **Not Implemented**

#### 2. Completion %

**0%**

#### 3. Confidence %

**98%**

#### 4. Functional Description

No Channel Event Logging pipeline exists in the Japit application. Host Asterisk ships stock CEL with `enable` commented out. Call lifecycle is driven by AMI events + app DB tables (`calls.call_sessions`, queue events), not CEL.

#### 5. Backend Evidence

| Item | Finding |
|------|---------|
| CEL reader/processor | **None** |
| `cel.conf` in `infra/asterisk/` | **Absent** |
| Misleading claim | `python/app/routers/timezone_admin.py` — inventory entity `"Asterisk CDR/CEL"` (doc-only; no ingest) |

#### 6. Frontend Evidence

None.

#### 7. APIs

None.

#### 8. Database

No CEL tables, views, triggers, or functions in Alembic.

#### 9. Configuration Files

| File | Section | Note |
|------|---------|------|
| Host `/etc/asterisk/cel.conf` | `[general]` | `;enable=yes` → CEL **off** |
| Host `cel_pgsql.conf` / `cel_odbc.conf` | stock | table maps commented |

#### 10. Asterisk Dialplan

No `CELGenUserEvent` or CEL-backed flow in `extensions_japit.conf`.

#### 11. Call Flow

N/A — CEL not used.

#### 12. UI

None.

#### 13. Dependencies

Would need CEL backends + PostgreSQL/ODBC + ingest workers. **None wired.**

---

### 2. AMI (Asterisk Manager Interface)

#### 1. Status

✅ **Fully Implemented**

#### 2. Completion %

**95%**

#### 3. Confidence %

**97%**

#### 4. Functional Description

Short-lived AMI client for commands; long-lived telephony listener for queue/agent/bridge/callback/recording events; Redis idempotency; campaign Originate; supervisor ChanSpy; agent login/ready/pause/originate/hold/transfer.

#### 5. Backend Evidence

| Path | Class / Function |
|------|------------------|
| `python/app/asterisk_ami.py` | `AsteriskAmiClient`, `execute` |
| `python/app/ami_framing.py` | `AmiFrameBuffer`, `parse_ami_frame` |
| `python/app/ami_telephony_listener.py` | `run_ami_telephony_listener`, `_dispatch_ami_event` |
| `python/app/dispatch/ami_origination.py` | `originate_campaign_leg` |
| `python/app/queue/idempotency.py` | Redis AMI event keys |
| `python/app/main.py` | Starts listener when `ami_telephony_events_enabled` |
| `python/app/config.py` | `asterisk_ami_*`, `ami_telephony_events_enabled` (default `false`; Docker leader sets `true`) |

**Handled UserEvents:** `JapitAgentOffer`, `JapitDeskphoneBridge`, `JapitOriginationAnswered`, `JapitOriginationRequested`, `JapitRecordingSaved`, `JapitVoicemailSaved`, `JapitAgentsBusy`, `JapitCallbackRequested`

**Unhandled (emitted):** `JapitCallbackFailed`, `JapitHeartbeat`

#### 6. Frontend Evidence

Agent/supervisor UIs assume AMI-driven presence: `useAgentSipPhone.ts`, `useCallControls.ts`, `useSupervisorMonitorPhone.ts`.

#### 7. APIs (AMI-backed, prefix `/api/v1`)

| Method | URL | Purpose | Auth |
|--------|-----|---------|------|
| POST | `/agent/telephony/login\|ready\|pause\|logout` | Queue membership / presence | Agent telephony perms |
| POST | `/agent/telephony/originate\|hangup\|mute\|hold\|transfer\|accept-inbound` | Call control | Agent |
| GET | `/agent/telephony/endpoint-status\|endpoint-availability` | PJSIP via AMI | Agent |
| POST | `/supervisor/agents/{id}/listen\|whisper\|barge\|force-logout` | ChanSpy / force logout | `supervisor.agent_actions.control` |
| POST | `/campaigns/{id}/dispatch` (and related) | Campaign Originate | Campaigns |

#### 8. Database

| Object | Role |
|--------|------|
| `integration.ami_event_inbox` | **Schema only — unused** (Redis used instead) |
| `integration.asterisk_origination_events` | Real — originate audit |
| `audit.telephony_command_audit` | AMI command outcomes |

#### 9. Configuration Files

| File | Relevant |
|------|----------|
| Host `/etc/asterisk/manager.conf` | `enabled=yes`, port `5038`, `#include manager_japit.conf` |
| Host `/etc/asterisk/manager_japit.conf` | `[japitami]` read/write ACL + event filters |
| `docker/fastapi/docker-compose.yml` | Leader `AMI_TELEPHONY_EVENTS_ENABLED=true` |
| `.env.example` | `ASTERISK_AMI_*` |

**Not vendored under `infra/asterisk/`.**

#### 10. Asterisk Dialplan

`extensions_japit.conf` emits `UserEvent(Japit*)` for offers, origination, callbacks, recordings, busy, heartbeat.

#### 11. Call Flow (inbound example)

DID → IVR/queue → agent offer UserEvent → AMI listener updates presence/Redis → agent Accept/answer → Bridge/ConfBridge → Hangup events reconcile session.

#### 12. UI

Indirect — all live agent/supervisor telephony depends on AMI.

#### 13. Dependencies

**AMI (core), Redis (idempotency), PostgreSQL (sessions/presence), WebSocket/poll (agent realtime), Docker leader pinning.**

**Gaps (~5%):** unused `ami_event_inbox`; unhandled `JapitCallbackFailed` / `JapitHeartbeat`; manager conf not in git tree.

---

### 3. Queue Callback

#### 1. Status

🟡 **Partially Implemented**

#### 2. Completion %

**55%**

#### 3. Confidence %

**95%**

#### 4. Functional Description

Callers can request a callback via IVR action, DID route, queue failover, or busy-loop hangup. Rows land in `calls.callback_requests`. Agents list/complete; supervisors list/assign; reports show analytics. Agents manually dial (`Call Customer`). **No auto-dial scheduler. No in-queue wait-threshold DTMF callback while holding.**

#### 5. Backend Evidence

| Path | Symbol |
|------|--------|
| `python/app/agent_models.py` | `CallbackRequest` |
| `python/app/agent_queue_snapshot.py` | `process_japit_callback_requested` |
| `python/app/ami_telephony_listener.py` | Handles `JapitCallbackRequested` |
| `python/app/report_engine/agent_dashboard.py` | `fetch_agent_callbacks`, `create_agent_callback`, `complete_agent_callback` |
| `python/app/report_engine/supervisor_dashboard.py` | `fetch_supervisor_callbacks`, `assign_supervisor_callback` |
| `python/app/report_engine/call_analytics.py` | `fetch_callback_analytics` |
| SQL | `public.add_japit_callback(...)` |

#### 6. Frontend Evidence

| Page / component | Role |
|------------------|------|
| `/agent/portal/callbacks` | `CallbacksSection` — list, Call Customer, complete |
| Agent dashboard widget | Callbacks preview |
| `SupervisorDashboardPage` | Pending callbacks display |
| `/reports/call-analytics` | Callbacks tab |
| IVR/DID builders | action type `callback` |

#### 7. APIs

| Method | URL | Purpose | Auth |
|--------|-----|---------|------|
| GET | `/api/v1/agent/module/callbacks` | List | Agent module |
| POST | `/api/v1/agent/module/callbacks` | Create | Agent |
| POST | `/api/v1/agent/module/callbacks/{id}/complete` | Complete | Agent |
| GET | `/api/v1/agent/dashboard/callbacks` | Dashboard list | Agent |
| GET | `/api/v1/supervisor/module/callbacks` | List | Supervisor |
| POST | `/api/v1/supervisor/module/callbacks/{id}/assign?assignee_user_id=` | Assign | Supervisor |
| GET | `/api/v1/reports/call-analytics/callbacks` | Analytics | `reports.read` |

Disposition `CALLBACK` can also create a row on wrap-up.

#### 8. Database

**Table `calls.callback_requests`:**  
`callback_request_id`, `call_session_id`, `contact_id`, `did_route_id`, `queue_id`, `requested_window_start/end`, `status`, `assigned_to_user_id`, `retry_count`, `notes`, soft-delete, timestamps

**Index:** `ix_calls_callback_requests_pending (status, requested_window_start)`  
**FKs:** call_sessions, contacts, did_routes, queues, users  
**Triggers:** touch `updated_at`, soft-delete  
**View:** `reporting.v_queue_callback_summary`  
**Function:** `public.add_japit_callback(customer, did, queue, linkedid)`

#### 9. Configuration Files

| File | Section |
|------|---------|
| `infra/asterisk/func_odbc_japit.conf` | `[ADD_JAPIT_CALLBACK]` |
| `infra/asterisk/extensions_japit.conf` | `[japit-callback]` |

#### 10. Dialplan Flow

1. DID/IVR/failover/busy → `Goto(japit-callback,s,1)`
2. Resolve queue name → `ODBC_ADD_JAPIT_CALLBACK(...)`
3. `UserEvent(JapitCallbackRequested, ...)`
4. Playback thank-you → Hangup
5. Fail → `JapitCallbackFailed`

#### 11. Call Flow

Caller opts into callback → PostgreSQL insert via ODBC → AMI UserEvent → listener/DB sync → agent UI shows pending → agent manually originates → disposition/complete.

#### 12. UI

Agent callbacks page; supervisor dashboard callbacks widget; call-analytics report; IVR/DID `callback` action. **No dedicated `/admin/callbacks` route.**

#### 13. Dependencies

**AMI UserEvent, ODBC/PostgreSQL, Redis (queue presence adjacent).** No callback scheduler/worker.

**Missing:** in-queue threshold escape; auto-dial worker; retry engine using `retry_count`.

---

### 4. Estimated Wait Time

#### 1. Status

❌ **Not Implemented** (adjacent: live position / elapsed wait)

#### 2. Completion %

**10%**

#### 3. Confidence %

**95%**

#### 4. Functional Description

No EWT formula, API field, or caller announcement of estimated wait. System tracks **queue position** and **elapsed wait_seconds** for agents/supervisors. Asterisk realtime view hard-codes `reportholdtime = 'no'`.

#### 5. Backend Evidence

| Path | Role |
|------|------|
| `python/app/queue/events.py` | Position cache / AMI Position |
| `python/app/agent_queue_snapshot.py` | `queue_position`, `wait_seconds` serialization |
| `python/app/agent_models.py` | `CallQueueEvent.queue_position`, `wait_seconds` |
| Alembic `japit_queues` view | `reportholdtime` → **`'no'`** |

#### 6. Frontend Evidence

Waiting-call payloads expose position/wait in agent store — **not labeled EWT**. Wallboard `oldest_wait_seconds` = current wait, not estimate.

#### 7. APIs

No EWT endpoint. Position/wait appear inside agent queue / supervisor queue payloads.

#### 8. Database

`calls.call_queue_events.queue_position`, `wait_seconds` — telemetry only.

#### 9. Configuration Files

`public.japit_queues`: `announce_position` from queue bool; **`reportholdtime` always `no`**.

#### 10. Asterisk Dialplan

`Queue(${JAPIT_QUEUE_NAME},tT,,,${JAPIT_QUEUE_WAIT_TIMEOUT})` — max wait timeout, not EWT announce.

#### 11. Call Flow

N/A for EWT. Position/wait tracked via AMI `QueueCallerJoin` / Position fields for portal display only.

#### 12. UI

None for EWT.

#### 13. Dependencies

Would need queue stats (AMI/Redis) + announce prompts. **Announce-holdtime disabled.**

---

### 5. Dynamic Skill Routing

#### 1. Status

❌ **Not Implemented**

#### 2. Completion %

**5%**

#### 3. Confidence %

**98%**

#### 4. Functional Description

Inbound ACD uses Asterisk queue `strategy` + member `penalty`. Skills tables exist with no ORM, API, UI, or dialplan skill match. Outbound `longest_idle` is an alias of round-robin (stub).

#### 5. Backend Evidence

| Exists | Missing |
|--------|---------|
| Alembic `operations.skills`, `operations.agent_skills` | SQLAlchemy models, routers, services |
| Queue `strategy`, member `penalty` | Skill weights, skill-matched Queue() |
| `dispatch/agent_allocator.py` strategies | True longest-idle / skill ACD |

#### 6. Frontend Evidence

None for skills. Admin: `/admin/queues`, `/admin/queue-members` (penalty only).

#### 7. APIs

None for skills.

#### 8. Database (schema-only)

**`operations.skills`:** `skill_id`, `skill_code`, `skill_name`, `description`, soft-delete, timestamps

**`operations.agent_skills`:** `agent_skill_id`, `agent_id` FK, `skill_id` FK, `proficiency` 1–5, `is_primary`

**Index:** `ix_operations_agent_skills_agent`  
**Triggers:** touch updated_at / soft-delete on skills

#### 9. Configuration Files

None for skill routing.

#### 10. Asterisk Dialplan

No skill dialplan.

#### 11. Call Flow

Inbound: DID/IVR → Queue(strategy) → members by penalty — **no skill match**.

#### 12. UI

No skills admin screen.

#### 13. Dependencies

Would need skills CRUD + member penalty/skill sync + optionally custom dialplan. **Not started beyond DDL.**

---

### 6. SIP Trunk Health Monitoring

#### 1. Status

❌ **Not Implemented**

#### 2. Completion %

**8%**

#### 3. Confidence %

**95%**

#### 4. Functional Description

No Mediant/SIP trunk OPTIONS monitor, health history, failover-to-backup-trunk, or trunk UI. Adjacent: deskphone AOR `qualify_frequency=60`; agent endpoint-status APIs; queue timeout failover (not trunk HA). Dead code: `_qualify_deskphone_endpoint` never called. Report KPI `trunk_usage` = DID count alias.

#### 5. Backend Evidence

| Path | Notes |
|------|-------|
| Alembic PJSIP qualify migrations | Deskphone AORs only |
| `python/app/deskphone_queue_state.py` | `_qualify_deskphone_endpoint` — **dead code** |
| `python/app/pjsip_endpoint_state.py` | Agent contact status via AMI/CLI |
| `python/app/report_engine/system.py` | `trunk_usage` = DID call counts |

#### 6. Frontend Evidence

Agent endpoint availability modal only. **No trunk health page.**

#### 7. APIs

Closest: `GET /api/v1/agent/telephony/endpoint-status`, `.../endpoint-availability` (agents only).  
**No trunk health API.**

#### 8. Database

No trunk health tables. `telephony.queue_failover_rules` = queue routing failover.

#### 9. Configuration Files

Mediant seed AOR (`infra/asterisk/sql/seed_mediant_arun_asterisk.sql`) — **no qualify**. Agent AORs qualify via Alembic views.

#### 10. Asterisk Dialplan

Queue failover contexts only — not SIP trunk failover.

#### 11. Call Flow

N/A for trunk health product.

#### 12. UI

None for trunks.

#### 13. Dependencies

Would need OPTIONS/qualify on trunk + AMI/CLI polling + UI. **Absent.**

---

### 7. RTP Quality Monitoring

#### 1. Status

❌ **Not Implemented**

#### 2. Completion %

**5%**

#### 3. Confidence %

**97%**

#### 4. Functional Description

Only PJSIP media safety knobs (`rtp_timeout`, `rtcp_mux`). No MOS, jitter, latency, packet loss collection, RTCP AMI ingest, DB metrics, or quality dashboard. WebRTC hook does not call `getStats()`.

#### 5. Backend Evidence

| Path | Notes |
|------|-------|
| `python/app/telephony_sync.py` | Sets `rtp_timeout` / `rtcp_mux` |
| Alembic `20260728_0048_pjsip_endpoint_timers_rtp.py` | Endpoint timer columns |
| `python/app/report_engine/call_analytics.py` | No MOS/jitter/loss |

#### 6. Frontend Evidence

No quality dashboard. `useAgentSipPhone.ts` has no `getStats()` quality reporting.

#### 7. APIs

None for MOS, jitter, latency, packet loss, or RTCP reports.

#### 8. Database

No quality metric tables/columns on call sessions.

#### 9. Configuration Files

`infra/asterisk/confbridge.conf` has `;jitterbuffer=yes` commented.

#### 10. Asterisk Dialplan

None for quality telemetry.

#### 11. Call Flow

N/A.

#### 12. UI

None.

#### 13. Dependencies

Would need RTCP/AMI or WebRTC stats → DB → reports. **Absent.**

---

### 8. ConfBridge

#### 1. Status

🟡 **Partially Implemented**  
*(Production two-party deskphone mixer; not multi-party conference product)*

#### 2. Completion %

**65%**

#### 3. Confidence %

**92%**

#### 4. Functional Description

ConfBridge mixes agent + customer (+ optional ringback feeder) per extension (`max_members=3`). Powers deskphone Ready, outbound, inbound Accept, hold/unhold. **No conference rooms, PIN, admin menus, multi-party UI, or conference APIs.**

#### 5. Backend Evidence

| Path | Role |
|------|------|
| `python/app/deskphone_queue_state.py` | `ensure_deskphone_bridge`, member count, hold Redirect |
| `python/app/routers/agent.py` | Ready/originate/accept/hold paths |
| `python/app/ami_telephony_listener.py` | ConfbridgeLeave/End |
| `python/app/dispatch/presence_guard.py` | Requires live ConfBridge for campaign deskphone |

#### 6. Frontend Evidence

No conference UI. Agent deskphone flow via portal + X-Lite.

#### 7. APIs

No ConfBridge CRUD. Agent telephony APIs drive bridge lifecycle indirectly.

#### 8. Database

`operations.agent_presence_states.deskphone_bridge_channel_name`

#### 9. Configuration Files

`infra/asterisk/confbridge.conf`:

- `[japit_agent_user]` — quiet admin user
- `[japit_ringback_user]` — ringback feeder
- `[japit_agent_bridge]` — `max_members=3`

Also `musiconhold.conf`, `kick_deskphone_ringback.sh`.

#### 10. Dialplan Flow

Outbound Mediant answer → `ConfBridge(${JAPIT_AGENT_EXT},japit_agent_bridge,japit_agent_user)`  
Agent Ready → `japit-bridge-answer` joins same room  
Hold → Redirect to MOH context; Unhold → rejoin ConfBridge  
Inbound Accept → customer Redirect into agent ConfBridge

#### 11. Call Flow

Agent Ready creates/joins ConfBridge room → customer leg joins → optional ringback kicked → hold leaves bridge for MOH → hangup tears down.

#### 12. UI

None for conferences.

#### 13. Dependencies

**ConfBridge, AMI, PostgreSQL presence, ODBC routing, MOH.**

**Missing vs enterprise ConfBridge product:** multi-party rooms, menus, recording-of-conference product, admin UI.

---

### 9. Call Parking

#### 1. Status

❌ **Not Implemented** (in Japit CC)

#### 2. Completion %

**0%**

#### 3. Confidence %

**98%**

#### 4. Functional Description

No Park application in Japit dialplan, no parking APIs/UI, no parking lot integration. Hold uses **Redirect + MOH**. Host stock `res_parking.conf` exists with default lot `700` but is **not used by Japit code**.

#### 5. Backend Evidence

No `Park(` / `parkedcalls` in `infra/asterisk` or `python/app`. False-positive comments (“park”) mean MOH hold or queue pause.

#### 6. Frontend Evidence

None.

#### 7. APIs

None.

#### 8. Database

None for parking.

#### 9. Configuration Files

| File | Note |
|------|------|
| Host `/etc/asterisk/res_parking.conf` | Stock default lot `700` — unused by Japit |
| Host `/etc/asterisk/features.conf` | Park DTMF commented |
| Repo `infra/asterisk/` | No `features.conf` / parking conf |

#### 10. Asterisk Dialplan

None.

#### 11. Call Flow

Hold path: Redirect customer to MOH context — **not** Park.

#### 12. UI

None.

#### 13. Dependencies

Would need parking lot + dialplan + agent UI. **Not integrated.**

---

### 10. Listen

#### 1. Status

✅ **Fully Implemented**

#### 2. Completion %

**95%**

#### 3. Confidence %

**97%**

#### 4. Functional Description

Supervisor softphone must be registered. AMI `Originate` to supervisor PJSIP channel runs `ChanSpy` with options `qbu` (quiet, barge-capable flags for listen mode) on the agent’s live channel. Audited in `supervisor_action_events` + telephony command audit.

#### 5. Backend Evidence

| Path | Symbol |
|------|--------|
| `python/app/routers/supervisor.py` | `_supervisor_spy_action`, `listen_to_agent` (`options="qbu"`) |
| Permission | `supervisor.agent_actions.control` |
| Tests | `python/tests/test_supervisor.py` (listen asserted) |

#### 6. Frontend Evidence

| Path | Role |
|------|------|
| `SupervisorPortalPage.tsx` | Listen button |
| `useSupervisorMonitorPhone.ts` | REGISTER + auto-answer |
| `lib/api.ts` | `supervisorListen` |

Route: `/supervisor/portal`

#### 7. APIs

| Method | URL | Purpose | Auth |
|--------|-----|---------|------|
| POST | `/api/v1/supervisor/agents/{agent_id}/listen` | Silent listen | `supervisor.agent_actions.control` |
| GET | `/api/v1/supervisor/actions/recent` | Recent actions | Supervisor read |

#### 8. Database

`operations.supervisor_action_events` (`action_name` = listen)  
`audit.telephony_command_audit`

#### 9. Configuration Files

Dialplan sink `[japit-chanspy-sink]` documented for unregistered softphone — **live path requires registered softphone** (409 if not).

#### 10. Asterisk Dialplan

`[japit-chanspy-sink]` exists as documented Local sink; production API path uses direct ChanSpy Originate to supervisor endpoint.

#### 11. Call Flow

Supervisor clicks Listen → API Originate ChanSpy → supervisor WebRTC answers → hears agent+customer → Hang up monitor ends spy.

#### 12. UI

Supervisor Portal agent list: Listen button; softphone status; hang-up monitor.

#### 13. Dependencies

**AMI, ChanSpy, WebRTC/PJSIP supervisor endpoint, PostgreSQL audit.**

---

### 11. Whisper

#### 1. Status

✅ **Fully Implemented**

#### 2. Completion %

**95%**

#### 3. Confidence %

**97%**

#### 4. Functional Description

Same ChanSpy Originate path as Listen with options `qbwu` — supervisor can speak to the agent only (customer does not hear whisper).

#### 5. Backend Evidence

| Path | Symbol |
|------|--------|
| `python/app/routers/supervisor.py` | `whisper_to_agent` (`options="qbwu"`) |

#### 6. Frontend Evidence

`SupervisorPortalPage.tsx` Whisper button; `supervisorWhisper` in `lib/api.ts`; `useSupervisorMonitorPhone.ts`.

#### 7. APIs

| Method | URL | Purpose | Auth |
|--------|-----|---------|------|
| POST | `/api/v1/supervisor/agents/{agent_id}/whisper` | Coach agent | `supervisor.agent_actions.control` |

#### 8. Database

`operations.supervisor_action_events` (`action_name` = whisper)

#### 9–13. Configuration / Dialplan / Call Flow / UI / Dependencies

Same infrastructure as Listen; UI Whisper button; mic required for whisper audio.

**Minor gap:** whisper less covered in automated tests than listen.

---

### 12. Barge

#### 1. Status

✅ **Fully Implemented**

#### 2. Completion %

**95%**

#### 3. Confidence %

**97%**

#### 4. Functional Description

Same ChanSpy Originate path with options `qbBu` — supervisor joins both agent and customer audio legs.

#### 5. Backend Evidence

| Path | Symbol |
|------|--------|
| `python/app/routers/supervisor.py` | `barge_into_agent_call` (`options="qbBu"`) |

#### 6. Frontend Evidence

`SupervisorPortalPage.tsx` Barge button; `supervisorBarge` in `lib/api.ts`.

#### 7. APIs

| Method | URL | Purpose | Auth |
|--------|-----|---------|------|
| POST | `/api/v1/supervisor/agents/{agent_id}/barge` | Join both legs | `supervisor.agent_actions.control` |

#### 8. Database

`operations.supervisor_action_events` (`action_name` = barge)

#### 9–13. Configuration / Dialplan / Call Flow / UI / Dependencies

Same as Listen/Whisper; Barge button on Supervisor Portal; mic required.

**Minor gap:** barge less covered in automated tests than listen.

---

## Existing URLs (discovered from `App.tsx` + navigation)

### Related to audited modules

| URL | Relevance |
|-----|-----------|
| `/supervisor/portal` | Listen / Whisper / Barge |
| `/supervisor/portal?view=wallboard` | Live wallboard |
| `/supervisor/portal?view=queue` | Queue view |
| `/supervisor/portal?view=agents` | Agents + monitor controls |
| `/supervisor/dashboard` | Callbacks widget, QA event text |
| `/supervisor/voicemails` | Adjacent ops |
| `/agent/portal/callbacks` | Callback list / Call Customer |
| `/agent/portal/dashboard` | Callbacks widget |
| `/agent/portal/queues` | Queue waiting / position |
| `/admin/queues` | Queue strategy / announce_position |
| `/admin/queue-members` | Penalty (not skills) |
| `/admin/extensions` | Endpoint types / qualify adjacent |
| `/reports/call-analytics` | Callback analytics |
| `/reports/system` | Misleading `trunk_usage` KPI |
| `/health` | Platform health (not trunk/RTP) |
| `/executive/dashboard` | Wallboard |

### Other discovered app routes (inventory)

`/login`, `/forgot-password`, `/dashboard`, `/admin/dashboard`→dashboard, `/profile`, `/agent/portal/*`, `/telephony/campaigns*`, `/reports*`, `/calls/incoming`, `/calls/outgoing`, `/rbac`, `/audit`, `/admin/users*`, `/admin/roles*`, `/admin/user-campaign-mappings*`, `/admin/dids*`, `/admin/ivrs*`, `/admin/ivr-prompts*`, `/admin/business-hours*`, `/admin/business-calendar/*`, `/admin/crm-engine*`, `/admin/platform-health`→`/health`

**Not found:** `/admin/callbacks`, `/admin/trunks`, `/admin/live-monitor` (monitor is under supervisor portal), `/admin/skills`, `/admin/parking`, `/admin/conferences`.

### Agent portal subpaths (navigation)

`/agent/portal/dashboard`, `customer-search`, `queues`, `missed-calls`, `voicemails`, `tickets`, `offline-crm`, `callbacks`, `follow-ups`, `recordings`, `wrap-up`, `incoming-calls`, `outgoing-calls`, `recent-calls`, `notifications`

---

## Existing APIs (module-related)

Prefix: **`/api/v1`**

### AMI / telephony

- `GET/POST /agent/telephony/*` (sip-credentials, endpoint-status, endpoint-availability, login, ready, pause, logout, originate, hangup, mute, hold, accept-inbound, transfer, heartbeat, call-connected, call-ended, sip-frame, sip-registered, client-log)
- `WS /agent/ws`, `WS /agent/sip-ws`
- `GET /agent/realtime/poll`

### Callbacks

- `GET|POST /agent/module/callbacks`, `POST .../{id}/complete`
- `GET /agent/dashboard/callbacks`
- `GET /supervisor/module/callbacks`, `POST .../{id}/assign`
- `GET /reports/call-analytics/callbacks`

### Supervisor monitor / live

- `POST /supervisor/agents/{id}/listen|whisper|barge|force-logout`
- `GET /supervisor/actions/recent`
- `GET /supervisor/workspace|dashboard|wallboard|queues|agents|charts`
- `GET /supervisor/queues/{queue_id}`

### Adjacent (not full features)

- Admin queues/members CRUD under `/admin/...`
- System/platform health under `/health`, `/reports/system`
- **No** `/trunks`, `/skills`, `/ewt`, `/parking`, `/conferences`, CEL endpoints

---

## Existing Database Objects (related)

| Object | Type | Feature link |
|--------|------|--------------|
| `calls.callback_requests` | Table | Callback |
| `reporting.v_queue_callback_summary` | View | Callback |
| `public.add_japit_callback` | Function | Callback |
| `operations.skills` | Table | Skills (unused) |
| `operations.agent_skills` | Table | Skills (unused) |
| `integration.ami_event_inbox` | Table | AMI (unused) |
| `integration.asterisk_origination_events` | Table | AMI Originate |
| `audit.telephony_command_audit` | Table | AMI commands |
| `operations.supervisor_action_events` | Table | Listen/Whisper/Barge |
| `calls.call_queue_events` | Table | Position / wait |
| `operations.agent_presence_states` | Table | ConfBridge channel marker |
| `telephony.queue_failover_rules` | Table | Queue failover (not trunk) |
| `public.japit_queues` | View | `reportholdtime=no` |
| PJSIP AOR/endpoint views | Views | Agent qualify / rtp_timeout |

---

## Existing Asterisk / Infrastructure Configuration

### In repo (`infra/asterisk/`)

| File | Relevance |
|------|-----------|
| `extensions_japit.conf` | Callback, ConfBridge, ChanSpy sink, UserEvents, Queue |
| `confbridge.conf` | Japit agent/ringback profiles |
| `func_odbc_japit.conf` | Callback ODBC + queue helpers |
| `pjsip_japit.conf` | Agent endpoint templates |
| `musiconhold.conf` | Hold / ring |
| `sorcery_*.conf`, `extconfig_*.conf` | Realtime / dual-project |
| `sql/seed_mediant_arun_asterisk.sql` | Static trunk seed |

### Host (not in repo tree)

| File | Relevance |
|------|-----------|
| `/etc/asterisk/manager.conf` + `manager_japit.conf` | AMI **enabled** |
| `/etc/asterisk/cel.conf` | CEL **disabled** |
| `/etc/asterisk/res_parking.conf` | Stock parking lot — **unused by Japit** |
| `/etc/asterisk/features.conf` | Park feature DTMF commented |

### Missing from Japit-managed tree

`cel.conf`, `manager.conf`, `queues.conf` (realtime views instead), `features.conf`, dedicated parking conf, trunk health conf.

### Other infra

Docker Compose (AMI listener on leader), Nginx, Redis (AMI idempotency + queue waiting), MinIO (recordings), PostgreSQL/Alembic, Prometheus/Grafana (ops metrics, not MOS).

---

## Existing UI Screens (supervisor / admin / agent)

| Screen | Path | Audited features |
|--------|------|------------------|
| Supervisor Portal | `/supervisor/portal` | Listen, Whisper, Barge, wallboard/agents |
| Supervisor Dashboard | `/supervisor/dashboard` | Callbacks preview |
| Agent Callbacks | `/agent/portal/callbacks` | Callback workflow |
| Agent Queues | `/agent/portal/queues` | Position / wait display |
| Admin Queues / Members | `/admin/queues`, `/admin/queue-members` | Strategy, penalty |
| Call Analytics | `/reports/call-analytics` | Callback reports |
| System Reports | `/reports/system` | Fake “trunk usage” |
| Endpoint login modal | Agent portal | Agent qualify status |

---

## Missing Features

1. **CEL** — enablement, backends, ingest, storage, consumers
2. **Estimated Wait Time** — formula, API, caller announce (`reportholdtime`)
3. **Dynamic Skill Routing** — ORM/API/UI + ACD
4. **SIP Trunk Health** — OPTIONS on Mediant, status store, failover trunk, UI
5. **RTP Quality** — MOS/jitter/loss pipeline + dashboard
6. **Call Parking** — Park dialplan + agent/supervisor UI (stock lot unused)
7. **Multi-party ConfBridge product** — rooms, PIN, menus, conference UI
8. **Callback auto-dial worker** + **in-queue threshold callback**

---

## Partially Implemented Features — What Is Missing

| Feature | Present | Missing |
|---------|---------|---------|
| **Queue Callback** | Capture, DB, agent/supervisor list, reports, manual dial | Auto-dial scheduler; in-queue DTMF after wait threshold; retry automation |
| **ConfBridge** | Deskphone 2-party mixer end-to-end | Multi-party conferences; admin product; conference recording UX |
| **AMI** (near-full) | Client + listener + APIs | `ami_event_inbox` unused; some UserEvents unhandled; manager conf not in git |

---

## Recommendations — Prioritized Phase 2 Roadmap

Based on audit gaps vs the Implementation Guide phases:

### P0 — Close Phase 2 guide gaps (caller experience + ACD)

1. **Estimated Wait Time** — Enable/sync `reportholdtime` + announce frequency; compute EWT from queue SLA/AHT; expose API + optional wallboard field.
2. **Queue Callback completion** — In-queue escape after wait threshold; Redis/DB-backed **callback dialer worker** with windows/retries; handle `JapitCallbackFailed`.
3. **Dynamic Skill Routing foundation** — ORM + admin CRUD for `skills` / `agent_skills`; map proficiency → queue member penalty or custom dialplan; replace stub `longest_idle`.

### P1 — Phase 3 observability

4. **SIP Trunk Health** — Qualify Mediant AOR; poll ContactStatus; store health history; admin trunk page; secondary trunk failover.
5. **RTP Quality Monitoring** — Collect RTCP/AMI or WebRTC `getStats`; persist MOS/jitter/loss; supervisor/report widgets.

### P2 — Phase 4 completeness / Phase 1 telemetry

6. **Call Parking** — Wire Japit parking lot + dialplan + agent Park/Retrieve UI (do not rely on unused stock `700`).
7. **ConfBridge product (optional)** — Only if guide requires multi-party conferences beyond deskphone mixer.
8. **CEL** — Decide AMI-vs-CEL strategy; if CEL required: enable `cel.conf`, ODBC/PG backend, partition table, ingest worker; otherwise remove misleading “CDR/CEL” inventory claim.

### P3 — Hardening

9. Vendor `manager_japit.conf` / CEL decisions into `infra/asterisk/`.
10. Use or drop `integration.ami_event_inbox`.
11. Expand supervisor tests for whisper/barge; document softphone registration prerequisite.

---

## Bottom Line

| Guide Phase | Verdict |
|-------------|---------|
| **Phase 1** | AMI ✅ · CEL ❌ |
| **Phase 2** | Callback 🟡 · EWT ❌ · Skills ❌ |
| **Phase 3** | Trunk health ❌ · RTP quality ❌ |
| **Phase 4** | ConfBridge 🟡 (mixer) · Parking ❌ · Listen/Whisper/Barge ✅ |

**Overall ~45% of the audited Implementation Guide modules are in place.** Strongest assets are AMI control plane and supervisor ChanSpy. Highest-value next build for a true Phase 2 is **EWT + complete queue callback dialer + skill-based ACD**.
