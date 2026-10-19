# RideNova — Phase 3 Report (Booking, Dispatch, WebSocket Vertical Slice)

**Date:** 2026-10-19  
**Branch:** `develop`  
**Gate verdict:** **PASS** (with documented limitations)

---

## Summary

Phase 3 delivers a database-backed ride booking vertical slice:

- Fare estimate (HYD Cab formula, INR paise) via `POST /fare/estimate`
- Booking create / list / get / cancel / resync with idempotency keys
- Driver profiles + availability; radius dispatch; persisted offers with TTL
- Atomic accept (unique assignment + row locks); reject / expiry / retry
- Transactional outbox → RabbitMQ worker; authenticated WebSockets + resync
- Customer and driver mobile apps wired to real APIs (dev coordinate UI)
- Alembic `20261019_0003`; static application and Phase 1–2 behavior preserved

---

## Domain / state machine

Documented in `docs/architecture/BOOKING_STATE_MACHINE.md`.

| Area | Implementation |
|---|---|
| Booking statuses | REQUESTED → SEARCHING_DRIVER → DRIVER_ASSIGNED → DRIVER_ACCEPTED → … → CLOSED / CANCELLED / NO_DRIVER_FOUND |
| Offers | PENDING → ACCEPTED \| DECLINED \| EXPIRED \| WITHDRAWN |
| Fare | Static HYD Cab rates + 5% GST; haversine distance; amounts in paise |
| Cancel | Allowed through `NO_DRIVER_FOUND` / pre-trip; rejected after `TRIP_STARTED` |
| Idempotency | Unique `(customer_id, idempotency_key)`; same payload → same booking; different → 409 |

---

## Migrations / tables

- Revision: `20261019_0003` (revises `20261019_0002`)
- Tables: `driver_profiles`, `driver_availability`, `bookings`, `booking_events`, `driver_offers`, `trip_assignments`, `outbox_events`
- Optional PostGIS `location` column on availability when extension present
- `schema_meta.phase` → `3-booking`
- Forward-only; no truncate/reset of operator DB

Driver provisioning (controlled CLI): `docs/security/DRIVER_PROVISIONING.md`

---

## API surface (auth + RBAC)

| Method | Path | Notes |
|---|---|---|
| POST | `/fare/estimate` | Customer |
| POST | `/bookings` | Idempotency-Key header or body |
| GET | `/bookings`, `/bookings/{id}`, `/bookings/{id}/resync` | Ownership / ops read |
| POST | `/bookings/{id}/cancel` | Customer |
| POST | `/bookings/{id}/transition` | Assigned driver lifecycle |
| PUT/GET | `/drivers/me/availability` | Online + lat/lon |
| GET | `/drivers/me/offers` | Pending non-expired |
| POST | `/drivers/me/offers/{id}/accept\|reject` | Atomic accept |
| GET | `/drivers/me/assignments`, `/drivers/me/trips` | History |
| WS | `/ws?token=` | Subscribe via `subscribe.booking` |

Permissions added in `core/permissions.py` and seeded into RBAC catalogue.

---

## Realtime / outbox

1. State change + `outbox_events` row in the same DB transaction  
2. `workers.outbox_publisher` publishes to RabbitMQ exchange `ridenova.events` and expires offers  
3. API process optionally consumes RabbitMQ → in-process `WsHub` fanout  
4. Same-process `hub.fanout_sync` after commit for immediate delivery  
5. Reconnect: `GET /bookings/{id}/resync` returns booking + event cursor  

PostgreSQL remains source of truth. Redis is not used for booking/offer state.

---

## Frontend

| App | Phase 3 behavior |
|---|---|
| `customer_mobile` | Auth + fare estimate + book + live status/WS + history + cancel + resync (dev lat/lon UI) |
| `driver_mobile` | Auth + online/offline + offers accept/reject + trip transitions + history + WS |
| `web_portal` | Permission hint for `bookings.read`; no full dispatch center |
| `partner_mobile` | Unchanged auth shell |
| `static application/` | Preserved |

Shared contracts: `@ridenova/contracts` `API_CONTRACT_VERSION = 0.3.0`

---

## Test evidence

### Backend (host Python 3.12 venv)

```text
44 passed in ~432s
```

Command:

```powershell
cd backend
$env:RIDENOVA_DB_PREFER_HOST='1'
$env:RIDENOVA_DISABLE_EVENTS_CONSUMER='1'
.\.venv\Scripts\pytest.exe -q
```

Covered: fare validation, booking idempotency/ownership/cancel/resync, dispatch eligibility/reject/expiry, concurrent accept (one winner), duplicate accept, WS auth + cross-customer subscribe denial, migrations head `20261019_0003`, Phase 1–2 regressions.

### Frontend

| Check | Result |
|---|---|
| `packages/contracts` `npm run check` | **PASS** |
| `apps/web_portal` `npm run build` | **PASS** |
| `customer_mobile` / `driver_mobile` / `partner_mobile` `npm run check` | **PASS** |

### Static prototype

Preserved; not modified in Phase 3.

---

## Definition of done checklist

| # | Criterion | Evidence |
|---|---|---|
| 1 | Migrations apply safely | Alembic upgrade → `20261019_0003` |
| 2 | Server-side fare | `test_fare.py` + `/fare/estimate` |
| 3 | Booking persists | PostgreSQL `bookings` + tests |
| 4 | Idempotency | `test_booking.py` |
| 5 | Dispatch offers | `test_dispatch.py` |
| 6 | Atomic concurrent accept | `test_concurrency.py` |
| 7 | Invalid transitions rejected | cancel/transition 409 tests |
| 8 | Ownership enforced | cross-customer / cross-driver 403 |
| 9 | Authed WebSockets | `test_ws.py` |
| 10 | Reconnect resync | `/bookings/{id}/resync` |
| 11 | FE uses real APIs | mobile App.tsx flows |
| 12 | History from DB | list endpoints + UI |
| 13 | Backend/concurrency/WS tests | 44 passed |
| 14 | Phase 1–2 regressions | included in 44 |
| 15 | Web/mobile checks | PASS |
| 16 | Static + Git intact | no destructive resets |
| 17 | Traceability updated | `TRACEABILITY.md` B-01…B-07 done |
| 18 | This report | `PHASE_3_REPORT.md` |

---

## Limitations (not Phase 3 failures)

- No paid map provider; coordinate entry is a **development UI**
- No real GPS streaming, push notifications, payments, or KYC onboarding
- Outbox → RabbitMQ fanout across multiple API replicas needs the consumer running; tests disable consumer (`RIDENOVA_DISABLE_EVENTS_CONSUMER=1`) and rely on same-process hub + resync
- Full ops dispatch center / admin booking UI deferred
- Offer expiry redispath is owned by the outbox worker (list endpoint expires without redispath)
- Docker worker CMD is now `workers.outbox_publisher` (replaces heartbeat-only)

---

## Stories

- `docs/stories/3.1.booking-schema-fare.md`
- `docs/stories/3.2.booking-api.md`
- `docs/stories/3.3-3.4.dispatch-accept.md`
- `docs/stories/3.5.websocket-outbox.md`
- `docs/stories/3.6.frontend-vertical-slice.md`
- `docs/stories/3.7.e2e-verification.md`

BMAD 4.44.2 remains external under `D:\git\bmad_project` (not installed into this repo).

---

## Gate

**Phase 3: PASS**

Stop here. Do not start Phase 4 without explicit approval.
