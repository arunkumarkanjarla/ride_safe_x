# RideNova — System Architecture (Phase 0 target)

**Date:** 2026-10-19  
**Status:** Target architecture reconciled with **existing static-only repository**  
**Deviation source of truth:** `DECISIONS.md`

---

## 1. Current vs target

| Layer | Today | Target |
|---|---|---|
| Customer / driver / partner UI | Vanilla JS phone SPAs in `static application/` | Expo React Native TypeScript apps |
| Ops / support UI | Separate `admin/` + `agent-portal/` SPAs | **One** React + Vite web portal, RBAC-driven navigation |
| API | None | FastAPI (Python), typed, OpenAPI |
| Persistence | `localStorage` | PostgreSQL + **PostGIS 3.6.2** (`ride_safe_x` on Windows host initially) |
| Cache / presence | In-browser | Redis |
| Async events | Simulated | RabbitMQ + workers + outbox |
| Realtime | Poll / BroadcastChannel demo | Authenticated WebSockets |
| Files | Local file preview only | Filesystem storage abstraction (no MinIO) |
| Telephony | Simulated softphone | Asterisk on **separate** Linux host |
| AI | Demo assistant screens | Separate `ai_service/` |

The static tree remains the **UX and workflow specification** until each screen is replaced.

---

## 2. Target repository layout

Adaptively introduced **alongside** (not replacing) `static application/`:

```
ride_safe_x/
  static application/          # PRESERVE — reference + demo
  apps/
    customer_mobile/           # Expo RN TS
    driver_mobile/             # Expo RN TS
    partner_mobile/            # Expo RN TS
    web_portal/                # React Vite TS — admin + support + ops roles
  packages/
    api-client/
    contracts/
    validation/
    realtime-client/
  backend/
    app/
    migrations/                # or alembic/
    tests/
  workers/
  ai_service/
  asterisk/                    # templates, dialplan fragments, deploy scripts (not the live server)
  infrastructure/
    docker/
    nginx/
  docs/
    architecture/
    implementation/
    api/
    security/
    runbooks/
  tests/
    integration/
    contract/
    end_to_end/
  docs/bmad/                   # how to use sibling BMAD install (no .bmad-core here)
```

---

## 3. Runtime topology (local development)

```
┌──────────────────────── Windows host ────────────────────────┐
│  PostgreSQL 18 + PostGIS 3.6.2 · DB ride_safe_x · port 5432 │
│  D:\ridenova-data\uploads\  → mounted into API container      │
│  Static demo: py -m http.server (optional)                    │
│  Expo Go on Android (later phases)                            │
│  BMAD 4.44.2: sibling D:\git\bmad_project (not in this repo)  │
└──────────────────────────────┬───────────────────────────────┘
                               │ host.docker.internal:5432
┌──────────────────────── Docker Desktop ──────────────────────┐
│  fastapi (API + WebSocket)                                    │
│  worker(s)                                                    │
│  redis                                                        │
│  rabbitmq                                                     │
│  (optional) nginx edge                                        │
│  NO postgres container · NO minio · NO live asterisk          │
└──────────────────────────────────────────────────────────────┘

┌────────────── Separate Linux telephony host (Phase 6+) ──────┐
│  Asterisk · recordings /var/spool/asterisk/monitor/           │
│  AMI/ARI · metadata only synced to app DB                     │
└──────────────────────────────────────────────────────────────┘
```

Linux application servers later: uploads at `/var/lib/ridenova/uploads/`.

---

## 4. Backend module boundaries (modular monolith first)

Avoid premature microservices. Suggested FastAPI domains:

| Module | Responsibility |
|---|---|
| `identity` | Users, credentials, sessions/tokens, MFA hooks |
| `rbac` | Roles, permissions, resource checks, audit |
| `drivers` | Profiles, vehicles, documents metadata, availability |
| `partners` | Orgs, outlets, catalogues |
| `bookings` | Ride/booking aggregate, estimates, cancellation rules |
| `dispatch` | Matching, offers, assignment expiry |
| `payments` | Sandbox payment intents + ledger (Phase 9); live providers deferred |
| `orders` | Food/parcel/etc. when in scope |
| `notifications` | Push/email/SMS adapters |
| `support` | Tickets, agent workspace APIs |
| `telephony` | Call metadata, recording access control |
| `files` | Upload/download via storage abstraction |
| `realtime` | WebSocket auth, subscriptions, event fan-out |
| `outbox` | Reliable publish to RabbitMQ |
| `notifications` | In-app notification materialization from outbox (Phase 8) |

`ai_service/` is a separate deployable with a narrow HTTP API so booking core does not depend on AI uptime.

---

## 5. Data principles

- PostgreSQL is the **source of truth**.
- Redis: presence, short-lived locks/coordination, cache — not durable booking state.
- RabbitMQ: durable async jobs and domain events after commit (outbox).
- WebSockets: live updates after authoritative REST transitions.
- Money: decimal/numeric types + currency; never store PAN/CVV.
- Files: generated storage keys; metadata in PG; binaries on filesystem.
- Explicit state machines for booking, assignment, payment, KYC (ported from static engines).
- PostGIS is available for later geo queries; Phase 1 only asserts the extension — no dispatch algorithms yet.

### Core entity groups (initial)

Users/roles/sessions/audit · driver profiles/vehicles/documents · partners/outlets/catalogues · bookings/trips/assignments · pricing estimates · payment intents/transactions/refunds · notifications/tickets · file_objects · call_recordings (metadata) · outbox_events.

---

## 6. Realtime

1. Authenticated WebSocket connect.
2. Server-side authorization per subscription.
3. Heartbeats; reconnect with backoff + jitter.
4. Event IDs/cursors; resync on reconnect.
5. Rate and payload limits; connection metrics.
6. Push notifications when apps are backgrounded (later).

No primary architecture based on REST polling loops.

---

## 7. Security

- Password hashing (modern KDF), refresh/session revocation.
- Backend RBAC + object-level checks (not menu hiding).
- Validation (Pydantic), rate limits, CORS lockdown for production.
- Upload validation (type, size, signature), path traversal defense.
- Secrets via env/secret store; never in Git or logs.
- Negative authorization tests required from Phase 2.

---

## 8. Frontend strategy

| Surface | Approach |
|---|---|
| Mobile | Expo; Expo Go for early work; document native-only features |
| Web portal | Single React app; route guards + **server** enforcement |
| Shared code | Contracts/validation/api-client — avoid sharing RN↔web UI indiscriminately |
| Static apps | Remain runnable reference until screens migrated |

Screen migration mapping starts from `static application/docs/ROLE_PAGE_MATRIX.md` and architecture-workflow inventories.

---

## 9. Storage (no MinIO)

| Environment | Path |
|---|---|
| Windows host data | `D:\ridenova-data\uploads\` |
| Container mount | `/data/ridenova/uploads` via `RIDENOVA_STORAGE_PATH` |
| Linux app servers | `/var/lib/ridenova/uploads/` |
| Asterisk recordings | `/var/spool/asterisk/monitor/` on telephony host (metadata in PG) |

Application code uses a storage interface; physical paths come from configuration only.

---

## 10. Alignment with static architecture docs

Older diagrams under `static application/architecture-workflow/` still show MinIO, Flutter, ClickHouse, etc. Those are **blueprint history**. This document + `DECISIONS.md` supersede them for implementation. Historical MinIO mentions may remain in wireframes until labelled/cleaned; they must not appear in new runtime config.
