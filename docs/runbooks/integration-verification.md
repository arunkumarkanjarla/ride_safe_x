# RideNova — Phase 10 integration verification

## Prerequisites

| Component | How to check |
|---|---|
| PostgreSQL `ride_safe_x` | `GET /health/db` or pytest `@pytest.mark.db` |
| Redis / RabbitMQ / API | `docker compose -f infrastructure/docker/docker-compose.dev.yml ps` |
| Outbox worker | Container CMD must be `python -m workers.outbox_publisher` (rebuild if still on heartbeat) |
| Env | `RIDENOVA_ENV` ≠ production for sandbox payment tests |

Confirm the target is **development/test** before running migrations or cleanup.

## Local regression (developer machine)

```powershell
cd D:\git\ride_safe_x\backend
$env:RIDENOVA_DB_PREFER_HOST='1'
$env:RIDENOVA_DISABLE_EVENTS_CONSUMER='1'
.\.venv\Scripts\python.exe -m pytest -q --tb=line
```

Includes E2E booking→trip→notification→sandbox payment (`test_outbox_rabbitmq.py::test_e2e_...`).

## Live RabbitMQ outbox

```powershell
.\.venv\Scripts\python.exe -m pytest tests/test_outbox_rabbitmq.py::test_outbox_publish_to_rabbitmq_when_available -q --tb=short
```

- **PASS** — broker reachable and `publish_pending` published ≥1 event  
- **SKIP / NOT RUN** — RabbitMQ unreachable (do not claim live integration)

## Frontend

```powershell
cd packages\contracts; npm run check
cd ..\..\apps\web_portal; npm run build
cd ..\customer_mobile; npm run check
cd ..\driver_mobile; npm run check
cd ..\partner_mobile; npm run check
```

## CI

`.github/workflows/ci.yml` runs unit (no private DB), compose guard, MinIO guard, frontend checks.  
**DB integration and RabbitMQ E2E are local-only** unless hosted secrets are provisioned.

## Physical device

Document platform/OS/build method if run; otherwise **NOT RUN**.
