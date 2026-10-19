# AST-23 ARI / Stasis Call-Control

## Architecture decision

Smallest safe architecture:

```
Asterisk ARI (private HTTP/WS)
        |
        +--> japit-ari worker (Stasis japit_call_control websocket)
        |
        +--> FastAPI call-control APIs (short ARI REST after RBAC)
                |
                +--> PostgreSQL call_control_operations + audit
                +--> existing AMI hold fallback (deskphone_hold_customer_call)
```

| Option | Decision |
|--------|----------|
| Existing AMI worker | Rejected — would couple AMI ingest with ARI reconnect/rollback |
| Dedicated ARI worker | **Selected** for Stasis WS (Phase 16 pattern) |
| API service | REST commands only; no embedded loop (`API_EMBED_ARI_WORKER=false`) |
| New unrelated service | Rejected |

AMI remains authoritative for: dialer, originate, MixMonitor, recording control, Listen/Whisper/Barge (ChanSpy), callbacks, emergency, toll-fraud, existing `/telephony/hold`.

## Stasis application

Dialplan already routes `Stasis(japit_call_control,...)` as a DID action type. The ARI worker subscribes to that app. It does **not** move ConfBridge/queue calls into Stasis globally.

## Security

- ARI is not publicly exposed. Bind HTTP/ARI privately (AST-17 samples).
- Credentials: SecretProvider `ASTERISK_ARI_USERNAME` / `ASTERISK_ARI_PASSWORD`.
- Least privilege: agents only control owned live calls; supervisors need `call_control.manage` or `supervisor.agent_actions.control`.
- Channel IDs validated server-side. Client cannot pass filesystem paths or arbitrary channels.
- IDOR: unauthorized sessions return 404.
- No ARI passwords, playback tokens, or recording DEKs in logs/API bodies.

## APIs

All under `/api/v1/agent/call-control` (authenticated):

| Method | Path | Permission |
|--------|------|------------|
| GET | `/status` | `call_control.hold` |
| POST | `/hold` | `call_control.hold` |
| POST | `/resume` | `call_control.hold` |
| POST | `/bridge` | `call_control.bridge` |
| POST | `/playback` | `call_control.playback` |
| POST | `/stop-playback` | `call_control.playback` |

Existing `POST /api/v1/agent/telephony/hold` is unchanged (AMI).

## Hold / resume

1. Authorize call ownership.
2. ARI `POST/DELETE /channels/{id}/hold`.
3. If ARI is down and `ARI_CALL_CONTROL_AMI_FALLBACK=true`, use existing `deskphone_hold_customer_call` (Redirect to MOH). Result `fallback_ami`.
4. Presence `pause_reason=call_hold` preserved.

## Bridge

ARI mixing bridge for two authorized live channels. Does not change attended-transfer AMI/ConfBridge behavior. If ARI is unavailable, the API fails safely (503) without mutating AMI transfer state.

## Playback

- `media_kind=sound`: allowlisted `ARI_PLAYBACK_SOUND_ALLOWLIST` only.
- `media_kind=recording`: existing Phase 14 playback token + recording RBAC. ARI media URI is `recording:{uuid}` (no filesystem path).
- Encrypted recordings never return DEKs. Live in-call playback of encrypted media is **STAGING REQUIRED**.

## Whisper

**Not migrated.** AMI ChanSpy remains the implementation. Extension point: `app/modules/call_control/whisper.py`. Live ARI whisper is STAGING REQUIRED / not claimed complete.

## Failure handling

| Failure | Behavior |
|---------|----------|
| ARI down | Hold may AMI-fallback; bridge/playback 503; AMI stack stays up |
| ARI reconnect | Bounded backoff; one websocket; no auto duplicate bridges |
| Worker crash | Request-driven ops are not replayed |
| FastAPI restart | ARI worker independent (`API_EMBED_ARI_WORKER=false`) |
| Redis down | No new distributed lock; Postgres attribution is source of truth |
| Postgres down | Do not emit a success without the operation row + audit |

## Rollback

1. `ARI_CALL_CONTROL_ENABLED=false`
2. Stop `worker-ari`
3. Keep AMI worker running
4. Do not downgrade `20260814_0075` unless the operations table is unused
