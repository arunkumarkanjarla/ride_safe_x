# RideNova — Payment state machine (Phase 9)

**Mode:** Sandbox only. Simulated success ≠ real funds.

## States

| Status | Meaning |
|---|---|
| `CREATED` | Row inserted; not yet sent to gateway |
| `PENDING` | Sandbox attempt opened |
| `SUCCEEDED` | Sandbox reported success (fake) |
| `FAILED` | Sandbox reported failure |
| `CANCELLED` | Cancelled before success |
| `EXPIRED` | Reserved terminal (not auto-driven in Phase 9) |

## Transitions

| From | Event | To |
|---|---|---|
| CREATED | `sandbox.initiate` | PENDING |
| CREATED | `payment.cancel` | CANCELLED |
| PENDING | `sandbox.succeed` | SUCCEEDED |
| PENDING | `sandbox.fail` | FAILED |
| PENDING | `payment.cancel` | CANCELLED |
| PENDING | `sandbox.expire` | EXPIRED |

Terminal states reject further transitions (409). Duplicate gateway events with the same `gateway_event_key` are no-ops.

## Eligibility

Booking must be owned by the payer and status `CLOSED`. Cancelled / in-progress / no-driver bookings are ineligible.

## Amount

Always `bookings.estimate_paise` + `bookings.currency`. Client-supplied amounts are ignored/rejected.

## Gateway

Adapter: `sandbox`. Production (`RIDENOVA_ENV=production` or `PAYMENTS_SANDBOX_ENABLED=false`) rejects sandbox simulate/callback routes.
