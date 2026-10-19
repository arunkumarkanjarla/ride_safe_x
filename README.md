# RideNova (`ride_safe_x`)

Multi-service mobility platform. UI brand: **RideNova**.

## What’s in this repository

| Area | Path | Status |
|---|---|---|
| Static prototype (reference UX) | [`static application/`](static%20application/) | Runnable HTML/CSS/JS demos |
| FastAPI backend (Phase 1) | [`backend/`](backend/) | Health, DB, storage, Alembic |
| Docker (dev) | [`infrastructure/docker/`](infrastructure/docker/) | API, Redis, RabbitMQ, worker |
| Web portal scaffold | [`apps/web_portal/`](apps/web_portal/) | React + Vite + TypeScript |
| Mobile scaffolds | [`apps/*_mobile/`](apps/) | Expo React Native (Expo Go) |
| Shared contracts | [`packages/contracts/`](packages/contracts/) | TypeScript API types |
| Implementation docs | [`docs/`](docs/) | Baseline, architecture, phase reports |
| BMAD | Sibling `D:\git\bmad_project` | External — see [`docs/bmad/USAGE.md`](docs/bmad/USAGE.md) |

Phase 1 foundation is documented in [`docs/implementation/PHASE_1_REPORT.md`](docs/implementation/PHASE_1_REPORT.md) (created when verification completes).

## Quick start — static prototype

```powershell
cd "static application"
py -m http.server 8766 --bind 127.0.0.1
```

Open http://127.0.0.1:8766/ — customer, driver, partner (`patner-app`), admin, agent-portal, connected-demo.

Demo codes (public test values): customer/partner OTP **482716** · admin MFA **730951** · agent **246810**.

## Quick start — Phase 1 backend stack

1. Copy `.env.example` → `.env` and set database credentials (never commit `.env`).
2. Ensure host PostgreSQL DB `ride_safe_x` exists with PostGIS.
3. Create `D:\ridenova-data\uploads\`.
4. Follow [`docs/runbooks/dev-setup.md`](docs/runbooks/dev-setup.md).

```powershell
docker compose -f infrastructure/docker/docker-compose.dev.yml --env-file .env up -d --build
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/health/db
```

**Not in Docker:** PostgreSQL (host), MinIO (forbidden), live Asterisk (separate telephony host).

## Architecture decisions

See [`docs/architecture/SYSTEM_ARCHITECTURE.md`](docs/architecture/SYSTEM_ARCHITECTURE.md) and [`docs/architecture/DECISIONS.md`](docs/architecture/DECISIONS.md).

## Static tests note

CDP suites under `static application/docs-analysis/` have known failures and inconsistent exit codes (Phase 0 baseline). They are preserved; do not treat them as a Phase 1 gate. Foundation tests live under `backend/tests/` and fail with non-zero exit codes when they fail.
