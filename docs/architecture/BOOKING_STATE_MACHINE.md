# RideNova booking / offer state machine (Phase 3)

Source: static `state-machines.md` ride/offer machines. Payment states deferred to Phase 5.

## Booking status

| From | Event | To | Actor |
|---|---|---|---|
| REQUESTED | dispatch.start | SEARCHING_DRIVER | system |
| SEARCHING_DRIVER | offer.sent | DRIVER_ASSIGNED | system |
| SEARCHING_DRIVER | search.exhausted | NO_DRIVER_FOUND | system |
| DRIVER_ASSIGNED | offer.accepted | DRIVER_ACCEPTED | driver |
| DRIVER_ASSIGNED | offer.declined / offer.expired | SEARCHING_DRIVER | driver/system |
| DRIVER_ACCEPTED | driver.en_route | DRIVER_ARRIVING | driver |
| DRIVER_ACCEPTED, DRIVER_ARRIVING | driver.arrived | DRIVER_ARRIVED | driver |
| DRIVER_ARRIVED | trip.start | TRIP_STARTED | driver |
| TRIP_STARTED | trip.end | TRIP_COMPLETED | driver |
| TRIP_COMPLETED | ride.close | CLOSED | system |
| REQUESTED…DRIVER_ARRIVED | ride.cancel | CANCELLED | customer (Phase 3) |

## Phase 7 notes

- Driver actions are server-validated via `POST /bookings/{id}/transition` with `DRIVER_TRANSITIONS`.
- Duplicate actions that are already satisfied (`IDEMPOTENT_AFTER`) return current booking state **without** new `BookingEvent` / outbox rows.
- `trip.end` atomically sets booking `CLOSED`, assignment `COMPLETED`, and syncs driver duty via `sync_duty_status`.
- Primary next action for driver UI: `NEXT_DRIVER_ACTION` / `GET /drivers/me/active-trip`.
- Cancel after `TRIP_STARTED` remains rejected; concurrent cancel vs start ordering is lock-safe (`SELECT … FOR UPDATE` on booking).

## Offer status

PENDING → ACCEPTED | DECLINED | EXPIRED | WITHDRAWN

## Cancellation (Phase 3 development rule)

Aligned with static free-cancel-while-searching: customer may cancel while status ∈ {REQUESTED, SEARCHING_DRIVER, DRIVER_ASSIGNED, DRIVER_ACCEPTED, DRIVER_ARRIVING, DRIVER_ARRIVED, NO_DRIVER_FOUND}. After `TRIP_STARTED`, cancel is rejected. No cancel fee charged in Phase 3 (no payments).

## Fare (server)

HYD Cab rates from static platform defaults: base 50 + perKm 14.5 + perMin 1.5, minFare 70 (rupees), then GST `taxPct=5`. Distance from haversine; duration estimate `max(1, km*3)` minutes. Currency `INR`; amounts in integer **paise**.
