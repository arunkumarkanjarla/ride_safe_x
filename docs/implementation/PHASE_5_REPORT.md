# RideNova — Phase 5 Report (Driver Location & Dispatch Readiness)

**Date:** 2026-10-19  
**Branch:** `develop`  
**Starting HEAD:** `92344167438834bb1a972295f47fa10e6547673a`  
**Starting migration:** `20261019_0004` / `4-ops`  
**Ending migration:** `20261019_0005` / `5-location`  
**Gate verdict:** **CONDITIONAL PASS**  
**Commit:** none (not requested)  
**BMAD formal CLI:** not executed; stories authored under `docs/stories/5.*` per external BMAD conventions.

---

## Why CONDITIONAL PASS

Core server eligibility, location API, ops readiness, migrations, and automated tests are verified. **Physical-device GPS / foreground permission flow was not run on hardware** — only TypeScript `check` for driver mobile. Background tracking is explicitly deferred.

---

## Delivered

| Area | Implementation |
|---|---|
| Duty status | `offline` / `available` / `busy` on `driver_availability` |
| Location API | `PUT /drivers/me/location` with seq, accuracy, server `location_received_at` |
| Freshness | `LOCATION_FRESHNESS_SECONDS` default **120**; missing/stale/fresh |
| Dispatch | Same eligibility for initial + retry; accept rechecks; stale/missing excluded |
| Busy | Set on accept; synced on cancel / trip close |
| Rate limit | Per-driver location throttle (Redis + memory fallback) |
| Driver mobile | Foreground `expo-location` while online; permission + freshness UI |
| Ops | `GET /ops/drivers` + portal readiness table (`drivers.read`) |
| Docs | `LOCATION_AND_AVAILABILITY.md`, RBAC/traceability updates |

## Deferred

- Background location tracking
- GPS history table
- Manual assignment / AI dispatch
- Real-device GPS verification
- Onboarding/KYC

## APIs / permissions

| Method | Path | Permission |
|---|---|---|
| PUT/GET | `/drivers/me/availability` | `drivers.availability_self` |
| PUT | `/drivers/me/location` | `drivers.availability_self` |
| GET | `/ops/drivers` | `drivers.read` (coords if also `dispatch.read`) |

New permission: `drivers.read`.

## Tests

```text
55 passed in ~579s
```

```powershell
cd backend
$env:RIDENOVA_DB_PREFER_HOST='1'
$env:RIDENOVA_DISABLE_EVENTS_CONSUMER='1'
.\.venv\Scripts\pytest.exe -q
```

Includes Phase 1–4 regressions + `test_location.py` (freshness, stale/missing exclusion, ops readiness, cross-driver isolation).

### Frontend

| Check | Result |
|---|---|
| contracts `npm run check` | **PASS** |
| web_portal `npm run build` | **PASS** |
| driver_mobile `npm run check` (with `expo-location`) | **PASS** |
| customer / partner `npm run check` | **PASS** (expected) |

## Migration

`alembic upgrade head`: `0004 → 0005` added duty/location columns + index; `schema_meta=5-location`. No DB reset.

## Privacy / retention

Documented in `docs/architecture/LOCATION_AND_AVAILABILITY.md`: latest location only; no per-ping outbox; coordinates not logged; ops coords gated by `dispatch.read`.

## Integrity

- Static prototype preserved
- Booking fare/state machine unchanged
- Phase 1–4 APIs remain; availability outbox for duty changes only

## Remaining risks

- Untested on physical Android/iOS device
- Client seq must be monotonic; app resume uses server `location_seq`
- Multi-replica WS fanout still Phase 3 topology

---

## Gate

**Phase 5: CONDITIONAL PASS** (core complete; real-device GPS unverified)

Stop here. Do not start Phase 6 without explicit approval.
