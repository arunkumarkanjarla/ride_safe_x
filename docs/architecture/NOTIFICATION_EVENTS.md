# RideNova — In-app notification events (Phase 8)

## Delivery model

1. Domain transaction writes booking/offer state + `outbox_events` row.
2. After commit, notification materializer creates rows idempotently using
   `UNIQUE (source_event_id, recipient_user_id)`.
3. Outbox worker publishes to RabbitMQ (at-least-once) and re-runs materialization
   (no-op when rows already exist).
4. Optional WebSocket `notification.created` hint to the recipient user only.
5. Clients treat WS as a refresh signal; REST `/notifications` is authoritative.

**Not exactly-once.** Duplicate RabbitMQ delivery is safe due to the unique key.

## Catalogue

| `event_type` | Recipients | Title (template) |
|---|---|---|
| `booking.created` | customer | Booking requested |
| `offer.created` | offer driver | New trip offer |
| `offer.accepted` | customer + accepting driver | Driver assigned / Assignment confirmed |
| `dispatch.exhausted` | customer + users with `dispatch.read` | No driver found |
| `booking.cancelled` | customer + assigned driver (if any) | Booking cancelled |
| `booking.status_changed` + `driver.en_route` | customer | Driver en route |
| `booking.status_changed` + `driver.arrived` | customer | Driver arrived |
| `booking.status_changed` + `trip.start` | customer | Trip started |
| `booking.status_changed` + `trip.end` | customer + assigned driver | Trip completed |
| `payment.created` | customer | Payment started (sandbox) |
| `payment.succeeded` | customer | Payment succeeded (sandbox) |
| `payment.failed` | customer | Payment failed (sandbox) |
| `payment.cancelled` | customer | Payment cancelled (sandbox) |

Skipped (noise): `dispatch.started`, `offer.expired`, `offer.rejected`, `driver.availability_changed`, `payment.expired`.

## Failure handling

- Materialize errors increment outbox `publish_attempts` and write a row to
  `notification_processing_failures` (category only; no stack/secrets).
- Bounded: worker continues; retries on next tick until success or ops inspects
  `GET /ops/notifications/health`.
