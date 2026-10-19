# Sticky / last-agent routing (AST-28)

This is a **preference layer** in front of native Asterisk `Queue()`. It is not a second ACD engine and not a PCI/compliance certification.

Default: **OFF** (`STICKY_ROUTING_ENABLED=false` and per-queue `sticky_enabled=false`). Existing Queue() / skills / overflow behavior is unchanged until an admin enables both.

## Decision flow

```
Inbound [japit-queue]
  existing Answer / report-meta / ready check / announce / strategy
        ↓
  CURL decide-simple (1s; fail open)
        ↓
  skip / error / disabled / no history / expired / ineligible
        → existing Queue(${JAPIT_QUEUE_NAME})
        ↓
  ok|extension|sticky_selected
        → __JAPIT_STICKY_MODE=1, QUEUE_MAX_PENALTY=100
        → same Queue()
        → [japit-queue-member-originate] Hangup() non-matching members
        → matching member uses existing [japit-agent-offer]
        ↓
  RNA / expand: JAPIT_STICKY_MODE=0 → remaining members = normal ACD
```

## Last-agent selection

Durable source: `calls.call_sessions` (not Redis).

Valid previous agent only when `answered_at` is set and `agent_id` is set. Offered / ringing / rejected / abandoned / missed calls are ignored.

Scoped to the **current queue**. Window: `sticky_window_seconds` (60–86400, default 3600).

## Caller identity

`app.modules.compliance.phone.normalize_phone` only. Unknown/unnormalizable ANI → skip sticky. Never return phone or hash from APIs, logs, metrics, or audit. Redis keys use `agent_id` only (`japit:sticky:offer:{agent_id}`).

## Eligibility (all must pass)

- Agent not deleted
- Presence `ready`, not paused, not force-logout, not busy
- Active unpaused `QueueMember` for this queue
- Required queue skills with min proficiency
- Active extension for `Local/{ext}@japit-agent-offer`

Any failure → existing Queue() / skills expand.

## Redis

Optional NX lock so two concurrent sticky offers cannot reserve the same agent. Redis down or lock error → **skip sticky**, Queue() continues. Redis is not last-agent history.

## APIs

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/admin/queues/{id}/sticky-routing` | `queues.read` / `queues.edit` / `queues.manage` |
| PUT | `/api/v1/admin/queues/{id}/sticky-routing` | `queues.edit` / `queues.manage` / `queues.write` |
| GET | `/api/v1/telephony/queue/sticky/decide-simple` | Asterisk CURL (private); pipe text `ok\|ext\|reason` or `skip\|reason\|` |

No “route this call to agent 123”. Extra fields forbidden. Agents cannot configure sticky routing.

## Rollback

1. `STICKY_ROUTING_ENABLED=false` and/or per-queue `sticky_enabled=false`
2. Alembic downgrade **0081 → 0080** only if schema must revert
3. Do not disable Queue(), skills expand, governor, DND, toll-fraud, recording, ARI, AMD, voicemail, MOH, quality, or PCI DTMF
