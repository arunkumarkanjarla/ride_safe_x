# RideNova — WebSocket delivery topology (Phase 11)

## What is implemented

1. **Process-local hub** (`backend/app/services/ws_hub.py`): authenticated subscriptions live in the memory of a single API process.
2. **Post-commit local fanout** (`notify_local` / `hub.fanout_sync`): delivers to sockets connected to *that* process only.
3. **RabbitMQ path**: outbox worker publishes to `ridenova.events`; each API instance running `events_consumer` binds an **exclusive** queue to `booking.#` and fans out into its local hub.

## Multi-replica implications

| Scenario | Behavior |
|---|---|
| Single API replica | Clients receive local + RabbitMQ fanout. **Verified** in prior phases. |
| Multiple API replicas, consumer enabled on each | An event published to RabbitMQ is delivered to **each** replica's exclusive queue, so a client connected to replica B can receive events originating from work on replica A. |
| Multiple API replicas, consumer disabled | Only sockets on the process that called `notify_local` get the hint; REST `/notifications` and booking resync remain authoritative. |

## Phase 11 verification

- **Live two-replica test:** NOT RUN (would require a second API container and coordinated clients; not spun up to avoid unplanned stack disruption).
- **Architecture conclusion:** Cross-replica realtime depends on RabbitMQ consumers on every API instance; it is **not** a shared Redis hub. REST resync/notifications remain the recovery path.

## Smallest follow-up (if product requires sticky-less multi-replica WS)

Document ops requirement: run `events_consumer` on all API replicas (`RIDENOVA_DISABLE_EVENTS_CONSUMER` unset), or add an explicit shared pub/sub layer in a later approved phase. Do not rewrite the hub solely for Phase 11.
