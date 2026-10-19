# RideNova — Phase 6 Report (Customer Booking Experience)

**Date:** 2026-10-19  
**Branch:** `develop`  
**Starting HEAD:** `92344167438834bb1a972295f47fa10e6547673a`  
**Migration head:** `20261019_0005` / `5-location` (unchanged — no new migration)  
**Gate verdict:** **CONDITIONAL PASS**  
**Commit:** none (not requested)  
**BMAD formal CLI:** not executed; stories under `docs/stories/6.*`

---

## Why CONDITIONAL PASS

Core customer booking UX, fare/idempotency, status/history/cancel, WS+resync, and customer-safe driver summary are implemented and covered by automated tests + TypeScript checks. **Physical-device GPS / permission flow was not verified on hardware** (same limitation as Phase 5). Paid geocoding/maps deferred.

---

## Delivered

| Area | Implementation |
|---|---|
| Location selection | Presets + current location (`expo-location`) + labeled manual coordinates |
| Fare | Debounced server estimate; INR + line breakdown |
| Booking | In-flight guard; retained idempotency key for same payload retries |
| Status | Lifecycle labels mapped to backend enums |
| Live updates | WS subscribe + REST resync on resume; stale indicator |
| Driver info | `GET /bookings/{id}/summary` — display name + vehicle only |
| History / cancel | Server list; confirm cancel; conflict handling |
| Contracts | `API_CONTRACT_VERSION` `0.6.0` |

## Deferred

- Paid maps / address geocoding
- Background location
- Physical-device GPS verification
- Payments / push notifications
- Customer-facing live driver GPS (not exposed; ops-only)

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/bookings/{id}/summary` | Customer-safe trip + optional assigned driver summary |

No schema migration. Existing fare/booking/cancel/resync endpoints reused.

## Tests

```text
56 passed in ~10m
```

```powershell
cd backend
$env:RIDENOVA_DB_PREFER_HOST='1'
$env:RIDENOVA_DISABLE_EVENTS_CONSUMER='1'
.\.venv\Scripts\pytest.exe -q
```

New: `tests/test_customer_summary.py` (ownership, IDOR, no driver coords/email leak, ops 403 for customer).

### Frontend

| Check | Result |
|---|---|
| `packages/contracts` check | **PASS** |
| `apps/web_portal` build | **PASS** |
| `customer_mobile` / `driver_mobile` / `partner_mobile` check | **PASS** |

## Security

- Summary enforces booking ownership (or ops `bookings.read`)
- Cross-customer summary → 403
- Customer → `/ops/*` → 403
- Assigned driver payload excludes email and coordinates

## Integrity

- Static prototype preserved
- Phase 1–5 APIs intact; migration still `0005`
- Phase 5 GPS CONDITIONAL limitation preserved (not claimed resolved)

## Remaining risks

- Untested on physical device
- Preset places are Hyderabad labels only (documented non-geocoder fallback)
- Multi-replica WS fanout unchanged from Phase 3

---

## Gate

**Phase 6: CONDITIONAL PASS**

Stop here. Do not start Phase 7 without explicit approval.
