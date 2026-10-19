# AST-25 Per-queue Music on Hold and prompt sets

PostgreSQL remains the source of truth for queue MOH and prompt sets. Asterisk receives updates through the existing `sync_queue_definition()` path (PBX sidecar `/api/queues/create`, then AMI `UpdateConfig` + `queue reload parameters`). There is no second queue engine and no ARI move of `Queue()`.

## Runtime flow

```text
Admin UI → FastAPI queue MOH/prompt APIs → PostgreSQL
        → sync_queue_definition()
            ├─ queues.conf rewrite / AMI update
            └─ queue reload parameters
Realtime view japit_queues.musicclass ← COALESCE(queues.music_on_hold_class, 'default')
Next Queue() call uses the updated musicclass
[japit-queue-announce] plays ODBC welcome sound_key when a prompt set is assigned
```

Active callers keep their current MOH/announcement. The next call into the queue must hear the new class after a successful sync. FastAPI and Asterisk process restarts are not required. `queue reload parameters` is a runtime reload, not an Asterisk restart.

## Music on Hold

- Catalog: `telephony.queue_moh_classes` (safe identifiers only: `^[A-Za-z][A-Za-z0-9_-]{0,62}$`).
- Seeded fallback class: `default` (matches `musiconhold.conf` `[default]`).
- Additional class names can be registered in Admin. Matching `[class]` sections must exist in `musiconhold.conf`. Japit does not write user-supplied filesystem paths into Asterisk.
- Invalid/missing/disabled class → persist and sync `default`, status `FALLBACK`, audit `queue.config.fallback`. Callers still enter the queue.

## Prompt sets

Types mapped to existing Asterisk/Japit capabilities:

| Type | Behavior |
|------|----------|
| `welcome` | First item's `sound_key` via `ODBC_GET_JAPIT_QUEUE_WELCOME` then `Playback()` in `[japit-queue-announce]` before EWT |
| `periodic` | `periodic-announce` CSV **only when** `callback_offer_enabled` is false |
| `position` / `hold` | Stored for operators; do **not** override `announce_position` / `announce_frequency` |
| `custom` | Stored; welcome playback still uses the first `welcome` item |

When callback offer is enabled, periodic-announce remains `japit-callback-offer-announce`.

Items reference `audio_prompts.id` only. `sound_key` is a sanitized Asterisk playback identifier. Absolute paths, `..`, and URLs are rejected.

## Sync states

`status` remains `ok` / `error` / `skipped` for AST-11 compatibility.

`sync_state`: `SYNCED` | `PENDING` | `FAILED` | `FALLBACK`

Do not treat `FAILED` as success in the UI.

## Persistence

`japit_queues.musicclass` is a realtime view over PostgreSQL. Asterisk restart restores MOH from the database. Prompt welcome lookup is an ODBC function over assigned prompt items.

## Rollback

1. Set `QUEUE_MOH_PROMPTS_ENABLED=false` (catalog APIs 404; existing `music_on_hold_class` still works).
2. Set queue MOH back to `default`.
3. If needed, `alembic downgrade 20260814_0077` (Phase 26 revision `20260814_0078` only).
