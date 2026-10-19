# Japit Call Center — Asterisk-related changes (summary)

This document consolidates what was implemented on the live PBX for Japit Call Center.  
Detailed milestone write-ups are under [milestones/](milestones/).  
Deep production RCA: [TELEPHONY_ROOT_CAUSE_REPORT.md](TELEPHONY_ROOT_CAUSE_REPORT.md).  
Enterprise audit: [ENTERPRISE_ASTERISK_CC_AUDIT_REPORT.md](ENTERPRISE_ASTERISK_CC_AUDIT_REPORT.md).

---

## Design principles

1. **Brownfield safe** — legacy Vicidial / `arun_asterisk` paths kept as fallback; Japit files are additive (`*_japit.conf`).
2. **Do not break legacy** — inbound wrapper tries Japit first, then falls back.
3. **App owns orchestration** — FastAPI uses AMI for originate, hangup, presence, queue pause; dialplan owns media routing.
4. **Single AMI consumer** — with FastAPI ×6, only the leader listens to AMI / runs telephony workers.

---

## Milestone map (from `/opt/bmad_project/docs/asterisk`)

| Doc | Focus |
|-----|--------|
| [milestones/legacy-asterisk-audit.md](milestones/legacy-asterisk-audit.md) | Legacy inventory before Japit |
| [milestones/milestone-7-asterisk-integration.md](milestones/milestone-7-asterisk-integration.md) | ODBC, dialplan, AMI, ARI, realtime queues, PJSIP templates |
| [milestones/milestone-8-agent-portal-telephony.md](milestones/milestone-8-agent-portal-telephony.md) | Agent portal telephony wiring |
| [milestones/milestone-9-supervisor-portal-telephony.md](milestones/milestone-9-supervisor-portal-telephony.md) | Supervisor listen/whisper/barge paths |
| [milestones/milestone-10-campaigns-telephony.md](milestones/milestone-10-campaigns-telephony.md) | Campaigns ↔ queues / routing |
| [milestones/milestone-11-ivr-builder-telephony.md](milestones/milestone-11-ivr-builder-telephony.md) | IVR builder ↔ dialplan/ODBC |
| [milestones/milestone-12-reports-telephony.md](milestones/milestone-12-reports-telephony.md) | Reporting / CDR-related telephony notes |

---

## Milestone 7 — core Asterisk integration (high level)

**Added / updated live files (conceptual list):**

- `res_odbc_japit.conf`, `func_odbc_japit.conf` — Japit DB connectivity & dialplan functions  
- `extconfig_japit*.conf`, `sorcery_japit.conf` — realtime  
- `extensions_japit.conf` + include from `extensions.conf` — Japit contexts  
- `manager_japit.conf` — AMI user for FastAPI  
- `ari_japit.conf` — ARI user  
- `pjsip_japit.conf` — endpoint templates (agents / WebRTC)

**Capabilities:**

- Dual ODBC (legacy + Japit)
- DID pre-router with legacy fallback
- IVR / queue / callback / voicemail / outbound app contexts
- Queue realtime via `japit_queues` / `japit_queue_members`
- Recording / origination / heartbeat UserEvents + ODBC writes

---

## Later telephony hardening (app + Asterisk interaction)

Captured in [TELEPHONY_ROOT_CAUSE_REPORT.md](TELEPHONY_ROOT_CAUSE_REPORT.md):

| Area | Change (summary) |
|------|------------------|
| AMI framing | Proper frame buffer so events are not coalesced/dropped |
| Docker leader | AMI/dispatch/recording only on fastapi-1; replicas API-only |
| WebRTC presence | Correct in-call / ready / pause behavior with softphone |
| Hangup attribution | Safer session matching; avoid wrong-agent teardown |
| Supervisor in Docker | Prefer AMI over `asterisk -rx` when CLI missing in container |
| PJSIP contacts | `max_contacts` tightened for WebRTC endpoints |
| Nginx pin | Telephony + realtime poll + SIP WS pinned to :8101 |

These are mostly **Python/NGINX** fixes that depend on the Asterisk AMI/PJSIP layout in this backup.

---

## Certification / audit docs included

- [FINAL_PRODUCTION_CERTIFICATION.md](FINAL_PRODUCTION_CERTIFICATION.md)
- [PHASE2_PRODUCTION_REGRESSION_REPORT.md](PHASE2_PRODUCTION_REGRESSION_REPORT.md)
- [PHASE3_XLITE_REAL_UI_CERTIFICATION.md](PHASE3_XLITE_REAL_UI_CERTIFICATION.md)
- [PHASE3_REAL_UI_CERTIFICATION.md](PHASE3_REAL_UI_CERTIFICATION.md)
- [ENTERPRISE_ASTERISK_CC_AUDIT_REPORT.md](ENTERPRISE_ASTERISK_CC_AUDIT_REPORT.md)

---

## What is *not* in this Asterisk Git tree

- FastAPI / React source → use app packs  
- Postgres data / Redis → runtime only  
- `/opt/asterisk-api` legacy service → out of scope for Japit pack  
- TLS private keys → excluded; see [SECURITY.md](SECURITY.md)
