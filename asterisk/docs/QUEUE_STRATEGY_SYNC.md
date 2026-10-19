# Queue synchronization (AST-11)

## Source of truth

| Field | Source of truth | Realtime (`japit_queues`) | Live Asterisk |
|-------|-----------------|---------------------------|---------------|
| strategy | PostgreSQL `queues.strategy` | mirrored | AMI / PBX sync + `queue show` |
| announce_frequency | PostgreSQL `queues.announce_frequency` | mirrored | AMI / PBX sync |
| servicelevel | PostgreSQL `queues.servicelevel` | mirrored | AMI / PBX sync |
| joinempty | PostgreSQL `queues.joinempty` | mirrored | AMI / PBX sync |
| leavewhenempty | PostgreSQL `queues.leavewhenempty` | mirrored | AMI / PBX sync |
| announce_position | PostgreSQL | mirrored | AMI / PBX sync |
| callback_offer_wait_seconds | PostgreSQL | drives **periodic-announce-frequency only** | independent of announce_frequency |
| musicclass | PostgreSQL `queues.music_on_hold_class` | mirrored (`COALESCE(..., 'default')`) | AMI / PBX sync + `queue reload parameters` (AST-25) |

**PostgreSQL is authoritative.** Saving a queue in Admin UI writes DB first, then pushes to Asterisk.

## Sync path

```text
Admin UI → FastAPI → PostgreSQL → sync_queue_definition()
                                      ├─ PBX API :8001 /api/queues/create
                                      └─ AMI UpdateConfig + queue reload parameters
Realtime view japit_queues ← PostgreSQL (survives Asterisk restart)
```

No full Asterisk restart is required. Prefer `queue reload parameters` over module reload.

## Drift verification

```http
GET /api/v1/admin/queues/{queue_id}/asterisk-sync
```

Permission: `queues.read`

Returns database / realtime / runtime field comparison and `in_sync`.

## Deploy

```bash
cd python-service
alembic upgrade head   # 20260812_0063
# restart FastAPI
```

## Rollback

```bash
alembic downgrade 20260811_0062
```

Revert application to the previous release so UI no longer sends the new fields.
