# RideNova — Architecture Decision Records (Phase 0)

**Date:** 2026-10-19  
**Status:** Proposed / approved for planning; implementation starts after Phase 0 sign-off

Format: Decision · Context · Choice · Consequences · Status

---

## ADR-001 — Preserve static application in place

- **Context:** Entire product UX lives under `static application/`; moving it would break tests and docs.
- **Choice:** Keep path; add new monorepo roots beside it. Do not regenerate apps via `build.py --apps` unless intentionally refreshing blueprints.
- **Consequences:** Dual trees during migration; README must document both.
- **Status:** Accepted (Phase 0)

## ADR-002 — PostgreSQL stays on Windows host (outside Docker)

- **Context:** Operator already runs PostgreSQL 18 with database `ride_safe_x`.
- **Choice:** No Postgres service in Compose. Containers use `host.docker.internal:5432`.
- **Consequences:** Requires `pg_hba.conf` + firewall discipline; document connection from Docker.
- **Status:** Accepted (operator directive)

## ADR-003 — No MinIO

- **Context:** Master prompt forbids MinIO; blueprints still mention it.
- **Choice:** Filesystem storage abstraction; Windows `D:\ridenova-data\uploads\`; Linux `/var/lib/ridenova/uploads/`.
- **Consequences:** Clean MinIO from new code/Compose/docs; leave labelled historical wireframe refs until cleanup pass.
- **Status:** Accepted

## ADR-004 — Single React web portal for ops roles

- **Context:** Static tree has separate `admin/` and `agent-portal/`.
- **Choice:** One `apps/web_portal/` with server-enforced RBAC; migrate workflows from both static apps.
- **Consequences:** Navigation is permission-driven; backend must authorize independently.
- **Status:** Accepted (target); static portals preserved until replaced

## ADR-005 — Modular FastAPI monolith first

- **Context:** Prefer clear modules over many deployables early.
- **Choice:** One API process + workers; separate `ai_service` and Asterisk host only.
- **Consequences:** Simpler ops; split services later if needed.
- **Status:** Accepted

## ADR-006 — Realtime via WebSockets + outbox

- **Context:** Master prompt forbids polling as primary realtime.
- **Choice:** REST for commands; persist then publish (outbox → RabbitMQ); WebSocket fan-out; Redis for ephemeral presence.
- **Consequences:** More moving parts in Phase 1–3; correct durability.
- **Status:** Accepted

## ADR-007 — Mobile = Expo React Native (not Flutter)

- **Context:** Some architecture wireframes say Flutter; master prompt specifies Expo RN TS.
- **Choice:** Expo apps under `apps/*_mobile/`; Expo Go for early testing.
- **Consequences:** Wireframe “Flutter” labels are historical; document native-module limits.
- **Status:** Accepted

## ADR-008 — BMAD 4.44.2 as external development dependency

- **Context:** BMAD 4.44.2 is already installed in sibling workspace `D:\git\bmad_project` (`bmad_project_org` + `BMAD-METHOD`).
- **Choice:** Do **not** install, copy, or initialize `.bmad-core` inside `ride_safe_x`. Use the sibling installation for brownfield-fullstack planning and the IDE story loop (`*draft`, `*develop-story`, QA gates). Keep only RideNova-specific docs/config in this repo (see `docs/bmad/USAGE.md`).
- **Consequences:** Agents are activated from the BMAD workspace rules; this repo must not duplicate the framework.
- **Status:** Accepted (Phase 1 confirmation 2026-10-19)

## ADR-009 — PostGIS enabled on `ride_safe_x`

- **Context:** Operator installed PostGIS successfully (`CREATE EXTENSION postgis`). Verified 2026-10-19: `postgis` **3.6.2** on database `ride_safe_x` / user `postgres` (`PostGIS_Full_Version()` returned GEOS/PROJ build info).
- **Choice:** Treat PostGIS as available infrastructure. Phase 1 enables/asserts the extension via migrations and `/health/db`. Full geographic dispatch algorithms wait until the booking/dispatch phase.
- **Consequences:** Migrations may `CREATE EXTENSION IF NOT EXISTS postgis`. Domain geo tables/algorithms are out of Phase 1 scope.
- **Status:** Accepted (verified 2026-10-19)

## ADR-010 — Database name and credentials

- **Context:** Operator created `ride_safe_x` on localhost with user `postgres`.
- **Choice:** Use that database; credentials only in ignored `.env`.
- **Consequences:** `.env.example` uses placeholders; rotate password after chat exposure.
- **Status:** Accepted

## ADR-011 — Partner folder spelling

- **Context:** Static folder is `patner-app`.
- **Choice:** Preserve until coordinated rename + redirects; new RN app uses `partner_mobile`.
- **Consequences:** Dual spelling during migration.
- **Status:** Accepted

## ADR-012 — Asterisk remains external

- **Context:** Telephony is a separate Linux concern.
- **Choice:** Version templates under `asterisk/`; no live Asterisk in app Compose; recordings stay on Asterisk host with PG metadata.
- **Consequences:** Phase 6 gated on telephony environment access.
- **Status:** Accepted

## ADR-013 — Phase 2 authentication (Bearer JWT + opaque refresh)

- **Context:** Need one auth model for React web and Expo mobile without OTP provider yet.
- **Choice:** Email/password; Argon2id hashes; short-lived JWT access (`HS256`) + opaque refresh tokens hashed in `sessions`; roles loaded server-side each request (not embedded in JWT). Web: access in memory, refresh in `sessionStorage`. Mobile: `expo-secure-store` with memory fallback.
- **Consequences:** OTP/SMS remains future; production web should later prefer HttpOnly cookies + CSRF. See `docs/security/IDENTITY_AND_ACCESS.md`.
- **Status:** Accepted (Phase 2)

## ADR-016 — Outbox worker is the Compose default (Phase 10)

- **Context:** A running stack still had `workers.heartbeat` while Dockerfile CMD already pointed at `outbox_publisher`.
- **Choice:** Pin Compose `worker.command` to `python -m workers.outbox_publisher` and document rebuild.
- **Consequences:** Operators must recreate the worker container after pull; heartbeat remains available for diagnostics only.
- **Status:** Accepted (Phase 10)

## ADR-015 — Sandbox payments foundation (Phase 9)

- **Context:** Need auditable payment attempts tied to booking fare without live money movement.
- **Choice:** Post-trip eligibility (`CLOSED` only); amount from `estimate_paise`; one `SUCCEEDED` per booking; `SandboxGateway` only; production forbids sandbox via `RIDENOVA_ENV` / `PAYMENTS_SANDBOX_ENABLED`.
- **Consequences:** No Razorpay/Stripe/etc. in this phase; live providers require a new ADR + security review.
- **Status:** Accepted (Phase 9)

## ADR-014 — In-app notifications via outbox materialization (Phase 8)

- **Context:** Clients need durable alerts when WebSockets are offline; outbox already records domain events.
- **Choice:** Persist `notifications` rows keyed by `(source_event_id, recipient_user_id)`; materialize from outbox after commit and in the outbox worker (at-least-once, idempotent). WS `notification.created` is a recipient-scoped hint only. No SMS/FCM/email in Phase 8.
- **Consequences:** PostgreSQL remains source of truth; RabbitMQ delivery is not exactly-once; catalogue documented in `NOTIFICATION_EVENTS.md`.
- **Status:** Accepted (Phase 8)
