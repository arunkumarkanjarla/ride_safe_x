# Japit Call Center — Final Production Certification

**Date:** 2026-07-28  
**Roles:** Chief Telecom Architect / Production Certification / Release Authority  
**Architecture constraint:** Docker×6 FastAPI (leader fastapi-1 + replicas 2–6), NGINX pins, host PostgreSQL / Redis / Asterisk — **unchanged**  
**PSTN number:** `7702866838`  
**Release decision:** **BLOCKED**

---

## Executive Summary

Phase 1 and Phase 2 remain **PASS**. Final certification executed real X-Lite PSTN work against `7702866838` and automated infrastructure gates. **Full PASS criteria are not met**: WebRTC softphone was not registered for the full matrix; 100 consecutive answered outbound / inbound and 8-hour soak were not completed; several matrix scenarios (transfer, conference, queue overflow, browser crash, etc.) were not executed end-to-end.

**Release Decision: BLOCKED** — do not ship as fully certified production until remaining gates below are closed.

Docker×6 / NGINX / ports / WebRTC & X-Lite implementations were **not redesigned**.

---

## What already passed (evidence)

| Gate | Result | Evidence |
|------|--------|----------|
| Phase 1 root-cause telephony fixes | PASS | `docs/TELEPHONY_ROOT_CAUSE_REPORT.md` |
| Phase 2 infra regression | PASS | `docs/PHASE2_PRODUCTION_REGRESSION_REPORT.md` |
| Infra health :8000 + :8101–8106 ×30 | PASS | cert runs `cert_results_*.json` |
| Single AMI listener (fastapi-1 only) ×30 | PASS | same |
| DB invariants (no open orphans / dup wrap) ×30 | PASS (during infra runs) | same |
| Replica restart chaos ×5 | PASS | same |
| X-Lite login / register / Ready ×30 | PASS | `cert_xlite_pstn2.log` / guided runs |
| X-Lite outbound **Cancel** ×30 | PASS | AMI cancel-before-answer; `cert_results_20260728T111359Z.json` |
| X-Lite **answered** outbound + wrap-up ×30 | PASS | `docs/certification_runs/guided_xlite_answered.json` (`passed: 30`) |

### Runtime defects fixed during certification (root cause, not timers)

| ID | Issue | Fix |
|----|-------|-----|
| C1 | AMI hangup `NameError: find_open_session_by_linked_id` | Module import in `telephony_presence_sync.py` |
| C2 | API hangup 500 — duplicate active wrap-up | Idempotent wrap-up insert in `telephony_hangup` |
| C3 | Ready+paused stuck after wrap-up | Clear `paused` / restore queue on wrap-up complete; heartbeat re-register heal |
| C4 | `is_deskphone_bridge_active` false in Docker (CLI missing) | Fall through to AMI channel concise |
| C5 | Dual wrap-up insert in one AMI flush | Check `session.new` in `_ensure_active_wrap_up` |

---

## Scenario matrix — executed vs remaining

### X-Lite (deskphone / ConfBridge on ext 1016)

| Scenario | 30/30 | Notes |
|----------|-------|-------|
| Registration / OPTIONS path / Ready | PASS | Live contact `1016@10.10.10.70` |
| Outbound Cancel | PASS | Automated AMI Mediant hangup |
| Outbound Answer + Agent Hangup + Wrap-up + Disposition | PASS | Guided human answer on `7702866838` |
| Logout (full 30 after PSTN) | NOT RUN TO COMPLETION | Deferred to keep bridge stable |
| Hold / Resume / Mute / Unmute | NOT COMPLETE | Requires answered call batch |
| Transfer / Warm / Blind / Conference | NOT COMPLETE | Not executed |
| Recording / Playback / Download / Link | PARTIAL | Sessions show `recording_count` on answered calls; full UI matrix not run |
| Queue callback / retry / overflow / timeout / recovery | NOT COMPLETE | Needs inbound DID campaign |
| Softphone restart / reconnect | NOT COMPLETE | Manual only |

### WebRTC (ext 1002)

| Scenario | Result |
|----------|--------|
| Full 30× matrix | **BLOCKED** — not required for Phase 3 scope |
| Phase 3 real UI: 10 outbound + 10 inbound answered | **PASS** — `docs/PHASE3_REAL_UI_CERTIFICATION.md` (DID `914049583236`, mobile `7702866838`) |

### Long run / soak / failure

| Gate | Result |
|------|--------|
| 100 consecutive **answered** outbound | **BLOCKED** — stopped at operator request after 30 answered PASS; auto-cancel long-run aborted when bridge marker dropped (~6/100) |
| 100 consecutive inbound | **BLOCKED** — requires external DID caller into queue |
| 8-hour soak | **BLOCKED** — not started (`CERT_SOAK_SECONDS=0`) |
| Failure tests (NGINX / Redis / Asterisk AMI / browser / network) | PARTIAL — replica restart ×5 PASS only |

---

## Performance / health snapshot (at certification window)

| Component | Observation |
|-----------|-------------|
| Docker FastAPI 1–6 | Healthy on :8101–8106 |
| AMI | Single `japitami` session on fastapi-1 |
| Asterisk | Mediant trunk + X-Lite 1016 ConfBridge operational |
| Redis / Postgres | Host services active; invariants checked in infra loops |
| Memory / CPU / leak soak | **Not measured over 8h** — insufficient soak data |

Artifacts: `docs/certification_runs/`

---

## Remaining issues (must clear for PASS)

1. **WebRTC softphone** must stay registered for full 30× matrix.  
2. **100 consecutive outbound** (answered or approved cancel-mode long-run with stable bridge heal each iteration).  
3. **100 consecutive inbound** via real DID to agent queue.  
4. **8-hour soak** with leak / stale session / ghost ring checks.  
5. Remaining matrix: hold/mute, transfer, conference, queue ops, browser refresh/crash/reconnect, recording UI links.  
6. Confirm no orphan `call_sessions` after every batch (close any left from interrupted runs).

---

## Known limitations

- Cancel-before-answer races a fast-answering PSTN; certification uses AMI hangup of Mediant legs immediately after Originate.  
- Deskphone Ready may re-originate bridge if ConfBridge drops — softphone must answer bridge once.  
- Inbound long-run cannot be fully automated without trunk inject or external caller.  
- Host `:8000` API remains API-only (AMI workers off) per Phase 2.

---

## Production checklist (before any GO)

- [ ] Docker×6 healthy; telephony pinned to fastapi-1  
- [ ] Exactly one AMI telephony listener  
- [ ] WebRTC **and** X-Lite matrices 30/30  
- [ ] 100 outbound + 100 inbound PASS  
- [ ] 8h soak PASS  
- [ ] Zero Critical / High / reproducible Medium  
- [ ] Frontend published; nginx reload; alembic head applied  
- [ ] No dual AMI / no stuck `paused:in_call` / no orphan sessions  

## Rollback checklist

- [ ] `docker compose` in `/opt/japit_callcenter/docker/fastapi` — previous image tag if needed  
- [ ] Restore `/etc/japit/japit-callcenter-backend.env` worker flags  
- [ ] Revert frontend publish from last known `dist`  
- [ ] `nginx -t && systemctl reload nginx`  
- [ ] Verify single AMI after rollback  

## Disaster Recovery checklist

- [ ] Postgres backup restore procedure known  
- [ ] Redis flush only after confirming no live agent sessions  
- [ ] Asterisk `pjsip` / dialplan backup; Mediant trunk reachability  
- [ ] Re-register softphones; re-Ready agents; confirm queue members  

---

## Release Notes (certification window)

- Fixed AMI linked-id lookup import crash on customer hangup.  
- Fixed hangup duplicate wrap-up unique violation.  
- Fixed wrap-up leaving Ready+paused / queue stuck.  
- Fixed Docker deskphone bridge detection without Asterisk CLI.  
- Frontend republished; FastAPI stack restarted with code bind-mount.  
- X-Lite Ready + Cancel×30 + Answered outbound×30 validated on `7702866838`.

---

## Final Production Score

| Area | Score |
|------|------:|
| Architecture integrity (no redesign) | 100 |
| Infra / AMI / DB invariants | 90 |
| X-Lite core outbound (ready/cancel/answer/wrap) | 85 |
| Full matrix coverage | 35 |
| Long-run 100/100 + inbound | 15 |
| 8h soak / leak proof | 0 |
| WebRTC matrix | 10 |
| **Overall** | **48 / 100** |

---

## Release Decision

# BLOCKED

**Reason:** Mandatory gates incomplete (WebRTC 30×, full scenario matrix, 100 outbound consecutive, 100 inbound, 8-hour soak). X-Lite answered outbound **30/30** and cancel **30/30** are proven; that is **not** sufficient for PASS under the stated stop conditions.

**Next actions (minimal):**
1. Keep X-Lite bridge up; run automated 100 outbound with Ready heal each call (no extra answered batch unless required).  
2. Register WebRTC browser; run WebRTC matrix.  
3. Execute inbound 100 via DID.  
4. Start 8h soak overnight.  
5. Re-issue this document only when all stop conditions are true → **PASS**.

---

*Generated by Final Production Certification process. Architecture Docker×6 preserved.*
