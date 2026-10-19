# RideNova — Phase 1 Report (Foundation)

**Date:** 2026-10-19  
**Branch:** `develop`  
**Gate verdict:** **PASS** (with noted non-blocking debt)

---

## Summary

Phase 1 foundation is implemented and verified on this Windows + Docker Desktop machine:

- FastAPI health + DB readiness (including PostGIS 3.6.2) through the API container to host PostgreSQL `ride_safe_x`
- Alembic initial migration applied (`schema_meta`, extensions)
- Redis, RabbitMQ, API, worker Compose stack healthy
- Filesystem storage abstraction + tests (no MinIO)
- Web portal production build + three Expo scaffolds typecheck
- Static prototype still serves HTTP 200
- BMAD remains external (`docs/bmad/USAGE.md`); no `.bmad-core` in this repo

---

## Decisions reconciled

| Topic | Outcome |
|---|---|
| PostGIS | Verified `postgis` **3.6.2** on `ride_safe_x`; ADR-009 updated |
| BMAD | External only — ADR-008 updated; no in-repo install |
| Static CDP debt | Preserved; exit codes fixed; `run-suite.js` wrapper added |
| Web portal | Scaffold only; static admin/agent portals untouched |
| Secrets | `.env` gitignored; `.env.example` placeholders only |

---

## Files created / modified (high level)

### Created

- `.gitignore`, `.env.example`, `.github/workflows/ci.yml`
- `backend/` (FastAPI app, Alembic, tests, requirements)
- `infrastructure/docker/` (Compose, Dockerfiles)
- `workers/heartbeat.py`
- `apps/web_portal/`, `apps/customer_mobile/`, `apps/driver_mobile/`, `apps/partner_mobile/`
- `packages/contracts/`
- `docs/bmad/USAGE.md`, `docs/runbooks/dev-setup.md`, this report
- `static application/docs-analysis/run-suite.js`

### Modified

- `README.md` — monorepo + static paths
- `docs/architecture/DECISIONS.md`, `SYSTEM_ARCHITECTURE.md`
- `docs/implementation/IMPLEMENTATION_PLAN.md`, `TRACEABILITY.md`
- CDP suites: added `process.exit(fails ? 1 : 0)` (reporting only)

### Not committed / local only

- `.env` (ignored) — used for local verification
- `backend/.venv/`, `**/node_modules/`, `apps/web_portal/dist/`
- `D:\ridenova-data\uploads\` (host data dir)

### Preserved

- Entire `static application/` product tree (no deletions)
- No PostgreSQL/MinIO/Asterisk containers

---

## Gate evidence

| # | Gate | Result | Evidence |
|---|---|---|---|
| 1 | No accidental static deletion | **PASS** | `customer-app` / `admin` index.html present; git shows no deletes |
| 2 | `.env.example` placeholders; secrets ignored | **PASS** | `git check-ignore` covers `.env`; example uses `CHANGE_ME` |
| 3 | Compose validates | **PASS** | `docker compose … config` |
| 4 | Services healthy | **PASS** | api/redis/rabbitmq healthy; worker up |
| 5 | `/health` | **PASS** | `{"status":"ok","service":"ridenova-api",…}` |
| 6 | `/health/db` → `ride_safe_x` | **PASS** | JSON `database":"ride_safe_x"` |
| 7 | PostGIS via app connection | **PASS** | `extversion":"3.6.2"` in `/health/db` |
| 8 | Alembic upgrade | **PASS** | `alembic upgrade head` exit 0; pytest migration test |
| 9 | Backend tests | **PASS** | `10 passed` (Python 3.12.10 venv) |
| 10 | Storage tests | **PASS** | included in pytest |
| 11 | Web portal build | **PASS** | `npm run build` exit 0 |
| 12 | Mobile checks | **PASS** | `npm run check` exit 0 ×3 |
| 13 | Static apps load | **PASS** | hub/customer/admin HTTP **200** on :8766 |
| 14 | MinIO absent (runtime) | **PASS** | No MinIO service/SDK; compose comment only |
| 15 | CDP baseline documented | **PASS** | Phase 0 baseline kept; suites not deleted |
| 16 | Setup docs accurate | **PASS** | `docs/runbooks/dev-setup.md` |

### Docker status (recorded)

```text
ridenova-dev-api-1        Up (healthy)   0.0.0.0:8000->8000
ridenova-dev-redis-1      Up (healthy)   0.0.0.0:6379->6379
ridenova-dev-rabbitmq-1   Up (healthy)   0.0.0.0:5672->5672, 15672->15672
ridenova-dev-worker-1     Up             redis/rabbitmq ping True
```

### Database / PostGIS (via API container)

- Database: `ride_safe_x`
- User: `postgres`
- PostGIS: **3.6.2** (`PostGIS_Full_Version` returned via `/health/db`)

### Backend tests

```text
10 passed in ~4s
```

Commands:

```powershell
cd backend
.\.venv\Scripts\pytest.exe -q
.\.venv\Scripts\alembic.exe upgrade head
```

Local Python: **3.12.10** (`py -3.12 -m venv .venv`). Host default `py` is 3.14 and cannot install the pinned wheels without MSVC — use 3.12 for host tooling; Docker uses 3.12.10-slim.

---

## Static CDP status (not a Phase 1 gate)

- Known failures remain (Phase 0 baseline).
- Suites now exit non-zero on failure.
- Optional wrapper: `node run-suite.js <suite.js>` forces exit 1 when console says FAILED.

---

## Secret / password hygiene

- Real credentials live only in ignored `.env`.
- Password previously shared in chat should still be **rotated** before any shared/remote access.
- This report does **not** contain credential values.

---

## Blockers / unverified

| Item | Status |
|---|---|
| GitHub Actions run on remote | **NOT VERIFIED** (workflow added; not executed on GitHub in this session) |
| Password rotation completed by operator | **UNVERIFIED** — local `.env` used for verification only |
| Expo Go on physical device | **NOT EXECUTED** (typecheck only) |
| Full geographic dispatch | **OUT OF SCOPE** (Phase 3+) |

---

## Gate status

**PASS**

Phase 1 acceptance criteria met with evidence above. Non-blocking: remote CI not yet observed green; password rotation still recommended; Expo device run not performed.

---

## Recommended next steps (await approval)

1. Review this report and rotate DB password if not already done; update local `.env` only.
2. Optionally push and confirm GitHub Actions CI.
3. On approval, start **Phase 2 only**: identity, sessions, RBAC, audit, portal/mobile login shells + negative authz tests.
4. Do not begin booking/dispatch until Phase 2 gate passes.
