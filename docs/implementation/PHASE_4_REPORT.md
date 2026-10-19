# RideNova — Phase 4 Report (Operations & Dispatch Center)

**Date:** 2026-10-19  
**Branch:** `develop`  
**Starting HEAD:** `92344167438834bb1a972295f47fa10e6547673a`  
**Starting migration:** `20261019_0003` / `3-booking`  
**Ending migration:** `20261019_0004` / `4-ops`  
**Gate verdict:** **PASS**  
**Commit:** none created (not requested)  
**BMAD formal `*draft` / `*develop-story` CLI:** not executed; Phase 4 stories authored in-repo under `docs/stories/4.*` following external BMAD brownfield conventions (`docs/bmad/USAGE.md`). Agent rule files from `D:\git\bmad_project` were used as process guidance only.

---

## 1. Scope implemented

- Operations booking summary counts by status
- Server-side paginated booking list with search (UUID / email), status, date range, vehicle filters
- Booking detail: fare, coordinates, events, assignment, offers (with `dispatch.read`), derived unassigned reason
- Authorized **dispatch retry** (`dispatch.retry`) for `REQUESTED` / `SEARCHING_DRIVER` / `NO_DRIVER_FOUND`
- Authorized **ops cancel** (`bookings.cancel`) respecting Phase 3 state machine
- Audit events for retry/cancel; outbox via existing cancel path
- Web portal Dispatch center UI with loading/empty/error/forbidden, confirmations, WS refresh + API refresh
- Permissions seeded: `dispatch.read`, `dispatch.retry`, `bookings.cancel`

## 2. Explicitly deferred

- Manual driver assignment (unsafe without dedicated eligibility UX)
- Full agent workspace / platform control config screens (O-02 partial, O-03 deferred)
- Paid maps / GPS streaming
- Payments, promotions, AI dispatch, KYC, partner marketplace
- Multi-replica WS fanout beyond Phase 3 documented topology
- Explicit `dispatch_attempts` table (gap: use `booking_events` + offer counts)

## 3. Files / migrations

| Area | Paths |
|---|---|
| Migration | `backend/alembic/versions/20261019_0004_phase4_ops.py` |
| API | `backend/app/api/ops.py`, `main.py` |
| Services/schemas | `backend/app/services/ops.py`, `schemas/ops.py` |
| RBAC | `backend/app/core/permissions.py` |
| Tests | `backend/tests/test_ops.py`, `test_migrations.py` |
| Portal | `apps/web_portal/src/{App,OpsDashboard,opsApi,styles}.*` |
| Contracts | `packages/contracts/src/index.ts` → `0.4.0` |
| Docs | stories `4.*`, `PHASE_4_REPORT.md`, `TRACEABILITY.md`, `RBAC_MATRIX.md`, `IMPLEMENTATION_PLAN.md` |

## 4. API endpoints & permissions

| Method | Path | Permission |
|---|---|---|
| GET | `/ops/bookings/summary` | `bookings.read` |
| GET | `/ops/bookings` | `bookings.read` |
| GET | `/ops/bookings/{id}` | `bookings.read` (+ offer enrichment needs `dispatch.read`) |
| POST | `/ops/bookings/{id}/dispatch-retry` | `dispatch.retry` |
| POST | `/ops/bookings/{id}/cancel` | `bookings.cancel` |

Role mapping: support_agent → read; admin/super_admin → read + retry + cancel.

## 5. Test evidence

### Backend

```text
49 passed in ~372s
```

```powershell
cd backend
$env:RIDENOVA_DB_PREFER_HOST='1'
$env:RIDENOVA_DISABLE_EVENTS_CONSUMER='1'
.\.venv\Scripts\pytest.exe -q
```

Includes Phase 1–3 regressions + new ops/RBAC/audit/retry/cancel/pagination/migration tests (`test_ops.py`: 5 cases; migrations head `20261019_0004`).

### Frontend

| Check | Result |
|---|---|
| `packages/contracts` `npm run check` | **PASS** |
| `apps/web_portal` `npm run build` | **PASS** |
| customer / driver / partner `npm run check` | **PASS** |

## 6. Security / RBAC

- Customer denied `/ops/*` (403)
- Support agent can list/detail but not retry/cancel (403)
- Admin retry/cancel audited
- Retry after accept → 409
- Cancel after cancel → 409
- No secrets in audit metadata (existing sanitizer)

## 7. Migration verification

`alembic upgrade head` applied `20261019_0003 → 20261019_0004` on operator DB (index `ix_bookings_status_created`, `schema_meta.phase=4-ops`). No truncate/reset.

## 8. Manual verification not performed

- Interactive browser walkthrough of portal against live Docker stack
- Multi-API-replica RabbitMQ fanout

## 9. Limitations / risks

- Unassigned reasons are **derived** from status + offers, not a separate attempt log
- Portal WS updates trigger list/detail refetch; REST remains authoritative
- `dispatch.manage` reserved; not used for unsafe assignment shortcuts
- Static prototype preserved; Phase 3 mobile booking APIs unchanged

## 10. Integrity

- Static application tree not replaced
- Phase 1–3 behavior covered by green regression suite
- Git working tree remains dirty with Phase 1–4 uncommitted work (no Phase 4 commit made)

---

## Gate

**Phase 4: PASS**

Stop here. Do not start Phase 5 without explicit approval.
