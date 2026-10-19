# In-Queue Callback Offer (AST-10)

AST-10 offers a callback to callers who remain in `Queue()` past a queue-specific
threshold. The database-backed `japit_queues` view sets `context=japit-queue-dtmf`
only when `queues.callback_offer_enabled` is true. DTMF `1` therefore breaks out of
`Queue()` into `[japit-queue-dtmf]`; any other digit emits
`JapitCallbackOfferRejected` and safely re-enters the same queue.

## Realtime configuration

Migration `20260807_0060` adds:

- `callback_offer_enabled` (default `true`)
- `callback_offer_wait_seconds` (default `45`)
- `callback_offer_digit` (default `1`; the current published caller prompt and
  dialplan use `1`)

The view and API sync project the wait value to `announce_frequency`,
`min_announce_frequency`, and `periodic-announce-frequency`. They set
`periodic-announce=japit-callback-offer-announce`.

`app_queue`'s `periodic-announce` setting plays an Asterisk sound file, not a
dialplan context. Deploy a recorded `japit-callback-offer-announce` prompt that says
“Press 1 for a callback” in the appropriate sounds directory. The identically named
dialplan context is available for direct dialplan testing and emits
`JapitCallbackOfferPlayed`; production queue playback itself cannot execute
`UserEvent()` without AMI-side instrumentation.

## API and failure safety

The private, unauthenticated Asterisk endpoint is:

```text
GET /api/v1/telephony/callbacks/create-simple?queue_name=&ani=&cli=&wait_seconds=&linkedid=&did=
```

It returns `ok|<callback_id>|` only after `CallbackService.create()` and
`CallbackService.schedule()` commit. It preserves the resolved queue/campaign,
ANI/CLI, callback number, wait duration, priority, DID, and linked ID. Duplicate,
eligibility, unavailable-service, and unexpected failures return `fail|reason|`.
The endpoint must be reachable only on the private telephony network.

On a confirmed success, `[japit-queue-dtmf]` writes CDR/CEL data, emits
`JapitCallbackOfferAccepted` and `JapitCallbackCreated`, thanks the caller, and
hangs up. On any failure it emits `JapitCallbackFailed`, plays an error tone, then
returns the still-connected caller to `[japit-queue]`. `[japit-callback]` uses the
endpoint first and retains its ODBC insert as a backward-compatible fallback.

## Deployment check

```bash
alembic upgrade head
asterisk -rx "dialplan reload"
asterisk -rx "dialplan show japit-queue-dtmf"
asterisk -rx "queue reload all"
```

Sync or reload queues after the migration so their realtime configuration is read
again. Test with one waiting caller, verify the 45-second prompt, press `1`, and
confirm exactly one scheduled callback and a clean caller disconnect.
