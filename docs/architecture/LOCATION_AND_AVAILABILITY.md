# Driver location & availability (Phase 5)

## Duty status

| Status | Meaning |
|---|---|
| `offline` | `is_online=false` — not eligible |
| `available` | Online and free for new offers |
| `busy` | Online with incompatible active assignment |

Going online while on an active trip → `busy`. Completing/closing assignment while still online → `available`.

## Location freshness

- **Authoritative clock:** `location_received_at` (server UTC receipt time)
- **Client fields:** `captured_at`, `accuracy_m`, `seq` are metadata; client time cannot make a location fresh
- **Default freshness window:** `LOCATION_FRESHNESS_SECONDS=120` (config)
- **States:** `missing` (no accepted coords), `stale` (receipt older than window), `fresh`

Out-of-order protection: reject updates when `seq` ≤ last accepted `location_seq`, or when omitting seq and payload would overwrite a newer `location_received_at` only via seq rules (seq required for concurrency).

## Privacy / retention

- Only the authenticated driver updates own location
- Ops may see freshness/eligibility via `drivers.read`; precise coordinates only with `dispatch.read`
- Latest location only (no GPS history table in Phase 5)
- Coordinates not written to application logs

## Events

Availability / duty transitions → transactional outbox. Location pings are **not** outboxed per update (throttle noise); ops refetch via REST.
