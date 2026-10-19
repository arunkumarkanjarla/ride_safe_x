# RideNova — Windows + Docker Desktop setup (Phase 1)

Verified target environment: Windows 10/11, Docker Desktop + WSL2, PostgreSQL 18 + PostGIS on the host, Node 22+/24.

**Python:** use **3.12** for the local backend venv (`py -3.12 -m venv backend/.venv`). Docker API/worker images use `python:3.12.10-slim-bookworm`. Host default `py` may be 3.14; pinned wheels target 3.12.

## Prerequisites

1. Docker Desktop running.
2. Host PostgreSQL service running with database `ride_safe_x`.
3. PostGIS installed in that database (`CREATE EXTENSION postgis;`).
4. BMAD remains in sibling `D:\git\bmad_project` — see `docs/bmad/USAGE.md`.

## One-time setup

```powershell
cd D:\git\ride_safe_x
Copy-Item .env.example .env
# Edit .env: set POSTGRES_PASSWORD and URL-encoded DATABASE_URL / DATABASE_URL_HOST.
# Rotate any password that was previously shared in chat before shared/remote use.

New-Item -ItemType Directory -Force -Path 'D:\ridenova-data\uploads'

# Optional: local Python venv for host-side pytest/alembic
cd backend
py -3.12 -m venv .venv   # or: py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Start Docker services

From repository root:

```powershell
docker compose -f infrastructure/docker/docker-compose.dev.yml --env-file .env up -d --build
docker compose -f infrastructure/docker/docker-compose.dev.yml ps
```

Services: `api` (:8000), `redis` (:6379), `rabbitmq` (:5672, management :15672), `worker`.  
**Not included:** PostgreSQL, MinIO, Asterisk.

## Health checks

```powershell
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/health/db
```

`/health/db` must show `ride_safe_x` and PostGIS metadata.

## Phase 2 — auth

Ensure `.env` includes a strong `JWT_SECRET` (32+ chars). After migrations:

```powershell
cd backend
$env:RIDENOVA_DB_PREFER_HOST='1'
.\.venv\Scripts\alembic.exe upgrade head
.\.venv\Scripts\python.exe -m app.scripts.provision_admin --email admin@example.com --name "Admin"
```

Do not commit admin passwords. Web portal: `cd apps\web_portal && npm run dev` (proxies `/auth` to `:8000`). Mobile: set `EXPO_PUBLIC_API_BASE_URL` to your LAN API URL.

## Migrations (host or container)

Host (preferred for first apply):

```powershell
cd backend
$env:ALEMBIC_PREFER_HOST='1'
$env:RIDENOVA_DB_PREFER_HOST='1'
alembic upgrade head
```

Container:

```powershell
docker compose -f infrastructure/docker/docker-compose.dev.yml exec api alembic upgrade head
```

## Tests

```powershell
# Unit (no DB required for storage/config/health liveness)
cd backend
pytest -q tests/test_health.py::test_health_ok tests/test_storage.py tests/test_config.py

# Full suite including DB (requires local .env with working credentials)
pytest -q
```

## Frontend

```powershell
cd apps\web_portal
npm install
npm run build

cd ..\customer_mobile   # likewise driver_mobile, partner_mobile
npm install
npm run check
npx expo start          # Expo Go on a physical Android device
```

## Static prototype (unchanged)

```powershell
cd "D:\git\ride_safe_x\static application"
py -m http.server 8766 --bind 127.0.0.1
# Open http://127.0.0.1:8766/
```

## Troubleshooting

| Symptom | Check |
|---|---|
| `/health/db` 503 | `.env` `DATABASE_URL`, Windows Firewall, `pg_hba.conf` allows Docker subnet / `host.docker.internal`, Postgres listening |
| Container cannot resolve DB | `extra_hosts: host.docker.internal:host-gateway` present; use `host.docker.internal` not `localhost` inside containers |
| Upload write fails | Host folder `D:\ridenova-data\uploads` exists; compose volume mount intact |
| Compose mentions MinIO/Postgres | Reject — those must not be in active compose |

## Password hygiene

- Real credentials only in ignored `.env`.
- `.env.example` keeps placeholders only.
- Rotate passwords exposed in chat before any shared environment use.
