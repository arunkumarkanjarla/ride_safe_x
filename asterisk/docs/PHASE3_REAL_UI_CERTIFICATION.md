# Japit Call Center — Phase 3 Real UI Certification

**Date:** 2026-07-28  
**Roles:** Senior Telecom QA / Production Certification  
**Architecture:** Docker×6 / NGINX pins / host PG·Redis·Asterisk — **unchanged**  
**PSTN mobile:** `7702866838`  
**Inbound DID:** `914049583236`  
**Method:** Real React UI + real softphone (`testagent` WebRTC ext 1002)  
**Status:** **PASS** — 10 outbound + 10 inbound real UI calls complete

---

## OUTBOUND (1–10) — complete PASS

| # | Result | Session |
|---|--------|---------|
| 1–10 | **PASS** | See prior rows / DB (`c2c41de5` … `b70c5ea7`) |

---

## Product fixes verified (2026-07-28)
- Single agent login: latest session wins; prior session force-logged-out — **worked**
- Tab leave: no immediate offline; pause after 30 min inactivity — **worked**

## INBOUND (11–20) — complete PASS

| # | Direction | Softphone | Result | Issues | Root cause | Fix | Retest |
|---|-----------|-----------|--------|--------|------------|-----|--------|
| 11 | Inbound | WebRTC | **PASS** | Before call: SIP unregister / `REGISTER already in progress`; hard refresh + Ready recovered. During offer: AMI UniqueViolation `uq_call_sessions_open_pbx_linked_id`. After hangup: `Custom:1002ws UNAVAILABLE` while wrap_up | Double REGISTER race; duplicate ring insert; sip-registered UNAVAILABLE during wrap_up | Reuse by linked_id + IntegrityError; skip UNAVAILABLE on wrap_up sip-registered | Session `bcb1ed82-…` answered + recording + disposition |
| 12 | Inbound | WebRTC | **PASS** | None | | | Session `c20378bb-…` |
| 13 | Inbound | WebRTC | **PASS** | None | | | Session `384f56a1-…` |
| 14 | Inbound | WebRTC | **PASS** | None | | | Session `dee9c497-…` |
| 15 | Inbound | WebRTC | **PASS** | None | | | Session `9e25a07e-…` |
| 16 | Inbound | WebRTC | **PASS** | None | | | Session `b4518590-…` |
| 17 | Inbound | WebRTC | **PASS** | None | | | Session `23b24733-…` |
| 18 | Inbound | WebRTC | **PASS** | None | | | Session `4ef68ec1-…` |
| 19 | Inbound | WebRTC | **PASS** | None | | | Session `ad79629c-…` |
| 20 | Inbound | WebRTC | **PASS** | None | | | Session `e820b024-…` answered + recording + disposition OK |

## Phase 3 verdict

**PASS** for the required real-UI WebRTC matrix (10 outbound + 10 inbound answered with disposition/recording).

Overall production release (`docs/FINAL_PRODUCTION_CERTIFICATION.md`) remains **BLOCKED** until long-run / soak / remaining matrix gates are closed.
