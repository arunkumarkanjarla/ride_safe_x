# Queue Announcements (AST-07)

`[japit-queue]` gives a caller a position and Estimated Wait Time (EWT) announcement
immediately before entering `Queue()`. It calls the private, unauthenticated endpoint:

```text
GET /api/v1/telephony/queue/ewt/decide-simple?queue_name=NAME&position=N&waiting_count=N
```

The endpoint returns `ok|ewt_seconds|position|depth|confidence` or `fallback||||`.
It resolves the queue name, then reads through `EwtService.get`, so a Redis-cached
Phase 5 EWT is the normal path. The API must only be reachable from the private
telephony network; it intentionally does not accept JWT authentication because
Asterisk `CURL()` cannot provide it.

## Caller flow

1. The dialplan confirms at least one ready member, snapshots `QUEUE_MEMBER(...,count)`,
   derives position as `count + 1`, and runs `[japit-queue-announce]`.
2. The announcement subroutine optionally plays the queue welcome sound from
   `ODBC_GET_JAPIT_QUEUE_WELCOME`, then calls the EWT endpoint with a one-second HTTP timeout.
   On `ok`, it says the position and the EWT rounded up to whole minutes.
3. On a timeout, malformed response, missing queue, or backend failure, it plays the
   built-in `queue-thankyou` prompt and returns. It never hangs up or redirects the call.
4. The caller then enters `Queue()` normally, preserving overflow and legacy failover.

The realtime `japit_queues` view and telephony queue sync set
`announce_frequency=45`, `min_announce_frequency=45`, `announce_holdtime=yes`, and
`reportholdtime=yes` when `announce_position` is enabled. Asterisk consequently repeats
its native position/hold-time announcement about every 45 seconds while the caller is in
`Queue()`. Native timing can be delayed briefly while an announcement is playing or when
the caller's queue position changes.

## Accuracy and operations

The entry EWT is Phase 5's rolling/weighted/exponential estimate and should be evaluated
against live waits with the established ±20% operational target. The repeated in-queue
hold-time prompt is Asterisk's native queue estimate; it maintains caller feedback between
API entry announcements and does not make a second HTTP request while `Queue()` is
blocking.

After applying the Alembic migration, reload realtime queue configuration / sync affected
queues, then reload the dialplan. A deployment can perform a syntax smoke check with:

```bash
asterisk -rx "dialplan reload"
asterisk -rx "dialplan show japit-queue"
asterisk -rx "queue show"
```
