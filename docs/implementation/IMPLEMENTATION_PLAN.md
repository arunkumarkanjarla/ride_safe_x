# RideNova — Implementation Plan (Phase 0)

**Date:** 2026-10-19  
**Basis:** Repository audit in `BASELINE.md`  
**Method:** BMAD 4.44.2 brownfield-fullstack + Cursor execution  
**Constraint:** Implement one phase at a time; stop for gate approval

---

## 1. Starting point

RideNova today is a **complete static HTML/CSS/JS prototype** under `static application/`. There is **no** FastAPI backend, Expo apps, React portal, Docker Compose stack, migrations, or in-repo BMAD install.

Target: production-oriented multi-service platform while **preserving** the static apps as reference and migrating incrementally.

---

## 2. Implementation order (phases)

| Phase | Name | Goal | Gate |
|---|---|---|---|
| **0** | Baseline | Audit, plan, architecture, traceability | **This document set — awaiting approval** |
| **1** | Foundation | Monorepo skeleton, Docker (Redis/RabbitMQ/API/workers), Windows PG + PostGIS connectivity, storage path, no MinIO, lint/CI stubs; BMAD remains external | Fresh setup docs work; containers healthy; API talks to `ride_safe_x` |
| **2** | Identity & RBAC | Auth, sessions, roles, audit, portal/mobile login shells | **PASS** — see `PHASE_2_REPORT.md` (2026-10-19) |
| **3** | Booking vertical slice | Customer request → dispatch → driver accept → WS updates → history | **PASS** — `PHASE_3_REPORT.md` |
| **4** | Operations & dispatch center | Ops booking dashboard, dispatch monitor, authorized retry/cancel | **PASS** — `PHASE_4_REPORT.md` |
| **5** | Driver location & dispatch readiness | Availability lifecycle, location freshness, eligibility | **CONDITIONAL PASS** — `PHASE_5_REPORT.md` |
| **6** | Customer booking experience | Location selection, fare, status, history, live updates | **CONDITIONAL PASS** — `PHASE_6_REPORT.md` |
| **7** | Driver trip execution & lifecycle sync | Driver workspace, SM transitions, customer/ops sync | **CONDITIONAL PASS** — `PHASE_7_REPORT.md` |
| **8** | In-app notifications & event reliability | Persisted notifications, worker idempotency, client inbox | **CONDITIONAL PASS** — `PHASE_8_REPORT.md` |
| **9** | Payments foundation (sandbox) | Payment SM, ledger, sandbox gateway, customer UI | **CONDITIONAL PASS** — `PHASE_9_REPORT.md` |
| **10** | Integration verification & ops readiness | E2E harness, security, backup runbooks, health | **CONDITIONAL PASS** — `PHASE_10_REPORT.md` |
| **11** | RC ops closure | Running outbox worker, backup/restore proof, CI/WS/device honesty | **CONDITIONAL PASS** — `PHASE_11_REPORT.md` |
| **later** | Live payment providers / wallets / refunds | Explicit approval + security review required | Deferred |
| **12+** | Files, telephony, AI, public launch | Deferred until Phase 11 gate + separate approval | Explicit approval required |

Do **not** expand every marketplace module until Phase 3 gate passes.

---

## 3. Dependencies and external integrations

| Dependency | Phase | Notes |
|---|---|---|
| Windows PostgreSQL `ride_safe_x` | 1+ | Already created; stay outside Docker |
| Redis | 1 | Docker |
| RabbitMQ | 1 | Docker |
| FastAPI container | 1 | Reach PG via `host.docker.internal` |
| PostGIS | 1+ | **Verified** on `ride_safe_x` (3.6.2); geo dispatch algorithms deferred to booking phase |
| Expo Go | 2–3 | Physical Android for early RN testing |
| Payment provider sandbox | 5 | Provider selection TBD |
| Asterisk Linux host | 6 | Separate server; templates under `asterisk/` |
| AI providers | 7 | Credentials TBD |
| BMAD (external) | all | `D:\git\bmad_project` — do **not** install into this repo (`docs/bmad/USAGE.md`) |

---

## 4. Exact Phase 1 files and changes (planned — not yet implemented)

### 4.1 Add / create

| Path | Purpose |
|---|---|
| `.gitignore` | Ignore `.env`, uploads, `__pycache__`, `node_modules`, secrets |
| `.env.example` | Placeholders for DB/Redis/RabbitMQ/JWT/storage — **no real passwords** |
| `README.md` (update) | Point to `static application/` + new monorepo setup |
| `docs/bmad/USAGE.md` | Pointer to external BMAD 4.44.2 (no in-repo install) |
| `backend/pyproject.toml` or `requirements.txt` | Pinned FastAPI, SQLAlchemy/Alembic, asyncpg, redis, etc. |
| `backend/app/main.py` | Health + DB ping endpoints |
| `backend/app/core/config.py` | Settings from env (`RIDENOVA_STORAGE_PATH`, DB URL) |
| `backend/app/core/storage.py` | Filesystem storage abstraction (no MinIO) |
| `backend/alembic/` + initial migration | Extensions (`uuid-ossp`/`pgcrypto`) + minimal schema stub |
| `backend/tests/` | Health, DB connectivity, storage path tests |
| `infrastructure/docker/docker-compose.dev.yml` | `api`, `redis`, `rabbitmq`, `worker` — **no postgres, no minio** |
| `infrastructure/docker/Dockerfile.api` | API image |
| `packages/contracts/` | Shared OpenAPI/types placeholder |
| `apps/web_portal/` | Vite React TS scaffold (empty shell OK if health-linked) |
| `apps/customer_mobile/`, `driver_mobile/`, `partner_mobile/` | Expo TS scaffolds (minimal) |
| `D:\ridenova-data\uploads\` | Create on host; mount to `/data/ridenova/uploads` |
| `docs/runbooks/dev-setup.md` | Windows + Docker Desktop steps |
| CI workflow (optional stub) | Lint + backend tests |

### 4.2 Preserve / do not move yet

- Entire `static application/**` stays in place.
- No MinIO services, env vars, or SDK deps.
- No PostgreSQL container.
- No live Asterisk in Compose.

### 4.3 Documentation updates in Phase 1

- Refresh `DECISIONS.md` with verified Compose ports and image pins.
- Phase 1 verification report under `docs/implementation/PHASE_1_REPORT.md`.

---

## 5. Phase 1 verification commands and acceptance criteria

### Commands (planned)

```powershell
# From repo root after Phase 1
Copy-Item .env.example .env   # then fill secrets locally (never commit)

# Create upload root
New-Item -ItemType Directory -Force -Path 'D:\ridenova-data\uploads'

docker compose -f infrastructure/docker/docker-compose.dev.yml up -d --build
docker compose -f infrastructure/docker/docker-compose.dev.yml ps

# API health + DB
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/health/db

# Migrations (exact command depends on chosen tool)
docker compose -f infrastructure/docker/docker-compose.dev.yml exec api alembic upgrade head

# Backend tests
docker compose -f infrastructure/docker/docker-compose.dev.yml exec api pytest -q

# Grep guard: no MinIO
rg -i "minio" --glob '!static application/architecture-workflow/**' --glob '!docs/**/historical/**'
```

### Acceptance criteria

1. Documented setup from clean clone (plus local `.env`) succeeds on Windows + Docker Desktop.
2. Redis and RabbitMQ containers healthy.
3. FastAPI container connects to Windows PostgreSQL `ride_safe_x` via `host.docker.internal`.
4. Alembic migration applies without dropping data.
5. `RIDENOVA_STORAGE_PATH` resolves to mounted uploads dir; write/read smoke test passes.
6. No MinIO in Compose, env examples, or application dependencies.
7. Static application still loads (`py -m http.server` from `static application/`).
8. Baseline CDP suites still runnable (do not require green to ship Phase 1, but must not be deleted); record suite status.
9. Secrets not committed; `.gitignore` covers `.env` and upload contents.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| Static CDP regressions distract Phase 1 | Track as known debt; fix only if Phase 1 touches those files |
| PostGIS unavailable | Defer geo SQL; use lat/lon + app-side distance until extension approved |
| Docker ↔ Windows PG auth (`pg_hba`) | Document required `host`/`scram` lines; verify from container |
| BMAD install conflicts with existing Cursor rules | Install into repo; keep agent workflows brownfield |
| Scope creep into full marketplace | Strict Phase 3 gate before Phase 4–5 expansion |
| Password exposed in chat | Rotate; local `.env` only |

---

## 7. BMAD tracking (external)

1. Use BMAD 4.44.2 from `D:\git\bmad_project` — see `docs/bmad/USAGE.md`.
2. `@analyst` / `@pm`: brownfield PRD in RideNova `docs/` when authored.
3. `@architect`: keep `docs/architecture/*` aligned with implementation.
4. `@sm` / `@dev` / `@qa`: IDE story loop from sibling BMAD install; write stories under `docs/stories/` in this repo when created.

---

## 8. Phase status

**Phase 0:** complete. **Phase 1:** approved for implementation (2026-10-19).
