# RideNova — Requirement Traceability

**Date:** 2026-10-19 (updated Phase 7)  
**Legend:**  
- **Static ref** = existing demo location (preserve / migrate from)  
- **Target impl** = planned or actual code location  
- **Verify** = how we prove it  
- **Phase** = earliest delivery phase  

Status values: `reference-only` · `planned` · `blocked` · `partial` · `done`

---

## A. Platform foundation

| ID | Requirement | Static ref | Target impl | Verify | Phase | Status |
|---|---|---|---|---|---|---|
| F-01 | Monorepo + tooling | — | `apps/`, `packages/`, `backend/`, `workers/` | Tree + scaffold builds | 1 | done |
| F-02 | Docker Redis/RabbitMQ/API/worker | — | `infrastructure/docker/docker-compose.dev.yml` | `compose ps` healthy 2026-10-19 | 1 | done |
| F-03 | Windows PG connectivity | — | `backend/app/core/db.py` | `/health/db` via container | 1 | done |
| F-04 | No MinIO | Historical wireframes only | `backend/app/core/storage.py` | CI minio-guard; no MinIO service | 1 | done |
| F-05 | Upload storage path | — | `RIDENOVA_STORAGE_PATH` + `D:\ridenova-data\uploads` | `tests/test_storage.py` | 1 | done |
| F-06 | BMAD planning (external) | `D:\git\bmad_project` | `docs/bmad/USAGE.md` | No `.bmad-core` in repo | 1 | done |
| F-07 | CI foundation checks | — | `.github/workflows/ci.yml` | Workflow present (remote run NOT VERIFIED) | 1 | done |
| F-08 | PostGIS available | — | migration + `/health/db` | ext **3.6.2** via API | 1 | done |
| F-09 | Alembic migrations | — | `backend/alembic/` | upgrade head + pytest | 1 | done |
| F-10 | Web portal scaffold | — | `apps/web_portal/` | `npm run build` | 1 | done |
| F-11 | Mobile scaffolds | — | `apps/*_mobile/` | `npm run check` ×3 | 1 | done |

---

## B. Identity, RBAC, audit

| ID | Requirement | Static ref | Target impl | Verify | Phase | Status |
|---|---|---|---|---|---|---|
| I-01 | Email/password auth (all roles) | OTP demos (future SMS) | `backend/app/api/auth.py`, `services/auth.py` | `tests/test_auth.py` | 2 | done |
| I-02 | Admin MFA | A01 static | — | Deferred (password auth only) | 2 | partial |
| I-03 | Agent / portal sign-in | G01 / A01 | Web portal shell + roles | Web build + login API | 2 | done |
| I-04 | RBAC matrix | static rbac docs | `core/permissions.py`, `api/users.py`, `api/roles.py` | `tests/test_rbac.py` | 2 | done |
| I-05 | Audit trail | Admin audit screens | `audit_events`, `services/audit.py`, `api/audit.py` | `tests/test_audit.py` | 2 | done |
| I-06 | Sessions / refresh / logout | — | `sessions` table + JWT | `test_auth.py` refresh/logout | 2 | done |
| I-07 | Mobile auth shells | customer/driver/partner static | `apps/*_mobile/src/auth.ts` | `npm run check` ×3 | 2 | done |
| I-08 | Admin provisioning | — | `app/scripts/provision_admin.py` | Documented; no seeded password | 2 | done |

---

## C. Core booking & dispatch (vertical slice)

| ID | Requirement | Static ref | Target impl | Verify | Phase | Status |
|---|---|---|---|---|---|---|
| B-01 | Pickup/destination + estimate | R07–R10, `RNPC.fare` | fare API + customer presets/current location | `test_fare.py` + customer app | 3+6 | done |
| B-02 | Create booking | Ride engine / `ridenova.demo.v1` | `services/booking.py`, `POST /bookings` | `tests/test_booking.py` | 3 | done |
| B-08 | Customer trip UX + safe driver summary | static ride screens | `GET /bookings/{id}/summary` + customer app | `test_customer_summary.py` | 6 | done |
| B-09 | Driver trip lifecycle + customer sync | Driver trip screens | `transition_trip`, `GET /drivers/me/active-trip`, customer labels | `tests/test_trip_lifecycle.py` | 7 | done |
| B-10 | In-app notifications from domain events | — | `notifications` + outbox materializer + `/notifications*` | `tests/test_notifications.py` | 8 | done |
| B-11 | Integration / ops readiness | — | Phase 10 harness, `/health/ready`, backup runbooks | `PHASE_10_REPORT.md`, `test_outbox_rabbitmq.py` | 10 | partial |
| B-03 | Dispatch / offer | Driver offer flows | `services/dispatch.py`, offers table | `tests/test_dispatch.py` | 3 | done |
| B-04 | Accept/reject assignment | Driver trip screens | `POST /drivers/me/offers/{id}/accept\|reject` | `tests/test_dispatch.py`, `test_concurrency.py` | 3 | done |
| B-05 | Live trip updates | Simulated tracking | outbox + `GET /ws` + resync | `tests/test_ws.py` | 3 | done |
| B-06 | History | R20 / driver history | `GET /bookings`, `/drivers/me/trips` | booking/dispatch tests + mobile | 3 | done |
| B-07 | Cancel rules | Engine scenarios D | `POST /bookings/{id}/cancel` | `tests/test_booking.py` | 3 | done |

---

## D. Driver / partner / operations

| ID | Requirement | Static ref | Target impl | Verify | Phase | Status |
|---|---|---|---|---|---|---|
| D-01 | Driver onboarding + docs | D-reg / D03 | `drivers` + files | API + authz | 4 / 6 | reference-only |
| D-02 | Availability online/offline | Driver home | `duty_status` + PG availability | `tests/test_location.py` + driver app | 5 | done |
| D-02b | Location freshness | — | `PUT /drivers/me/location`, freshness policy | `tests/test_location.py` | 5 | done |
| D-03 | Earnings/payouts UI | Driver earnings | payments/settlements | Later financial tests | later | reference-only |
| D-04 | Ops driver readiness | — | `GET /ops/drivers` | `test_location.py` + portal | 5 | done |
| D-05 | Driver trip workspace | Driver active trip UI | `apps/driver_mobile` + `active-trip` | `npm run check` + lifecycle tests | 7 | done |
| P-01 | Partner onboarding/menu | `patner-app` | `partners` | API + UI | 4 | reference-only |
| O-01 | Ops dashboards | `admin/` A-screens | `web_portal` OpsDashboard + `/ops/bookings*` | `tests/test_ops.py` + portal build | 4 | done |
| O-02 | Agent workspace | `agent-portal/` | Support agent: read bookings/dispatch only | RBAC in `test_ops.py` | 4 | partial |
| O-03 | Platform control | `admin/control.html` | Config service + portal | Deferred (Phase 4 out of scope) | 4 | reference-only |

---

## E. Multi-service marketplace

| ID | Requirement | Static ref | Target impl | Verify | Phase | Status |
|---|---|---|---|---|---|---|
| M-01 | Food delivery | R44–R46, Scenario H | `orders` | After B-gate | 5 | reference-only |
| M-02 | Parcel | R47+ | `orders` | After B-gate | 5 | reference-only |
| M-03 | Bus / travel | R32+ | reservations module | After B-gate | 5 | reference-only |
| M-04 | Hotels / rentals | R41–R43 | reservations module | After B-gate | 5 | reference-only |

---

## F. Payments

| ID | Requirement | Static ref | Target impl | Verify | Phase | Status |
|---|---|---|---|---|---|---|
| Pay-01 | Fare pay / wallet | R17, R21 (simulated) | Sandbox `/payments*` + `PAYMENT_STATE_MACHINE.md` | `tests/test_payments.py` | 9 | done (sandbox) |
| Pay-02 | Live gateway / refunds / payouts | — | — | Separate approval | later | reference-only |
| Pay-02 | Refunds | A11 | Refund workflow | State + authz | 5 | reference-only |
| Pay-03 | Settlements | Partner/driver payouts | Settlement jobs | Reconciliation tests | 5 | reference-only |

---

## G. Files, recordings, telephony

| ID | Requirement | Static ref | Target impl | Verify | Phase | Status |
|---|---|---|---|---|---|---|
| T-01 | App uploads | Local preview only | `files` + FS storage | Validation/path/authz tests | 6 | planned |
| T-02 | Recording metadata | Simulated calls | `telephony` + Asterisk path config | Authz; no public dir | 6 | blocked (env) |
| T-03 | AMI/ARI integration | Architecture wireframes | `asterisk/` + backend adapter | Real env only | 6 | blocked (env) |

---

## H. AI & communications

| ID | Requirement | Static ref | Target impl | Verify | Phase | Status |
|---|---|---|---|---|---|---|
| AI-01 | Voice / multilingual assistant | R52 demo | `ai_service/` | Provider tests; core isolation | 7 | reference-only |
| N-01 | Notifications | In-app toasts/banners | notification workers | Delivery adapters | 4–7 | reference-only |

---

## I. Static prototype verification (preserve)

| ID | Suite / artifact | Location | Current Phase 0 result | Role going forward |
|---|---|---|---|---|
| S-01 | CDP 8 suites | `static application/docs-analysis/` | Mixed FAIL/PASS (see BASELINE) | Guard static UX until replaced |
| S-02 | Engine unit tests | `architecture-workflow/tests/engine/` | **25 PASS** | Port rules to backend tests |
| S-03 | Python app isolation tests | `architecture-workflow/tests/test_*.py` | **3 FAIL** (apps evolved) | Update or quarantine intentionally |
| S-04 | Role × page matrix | `static application/docs/ROLE_PAGE_MATRIX.md` | Doc current | Migration checklist |

---

## J. Traceability maintenance rule

When a requirement moves from `planned` → implemented:

1. Update **Target impl** with real paths.
2. Point **Verify** at the test file that passed (with date/log).
3. Never mark complete without execution evidence.
4. Keep this file in sync every phase report.
