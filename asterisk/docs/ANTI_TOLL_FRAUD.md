# Anti-toll-fraud dialplan guards (AST-15)

## Controls

- Destination whitelist (when `TOLLFRAUD_WHITELIST` set)
- Per-extension concurrent outbound limit
- Max outbound duration (`TIMEOUT(absolute)`)
- International block outside business hours
- Emergency bypass (AST-14) — **never** block emergency numbers when `TOLLFRAUD_EMERGENCY_BYPASS=true`

## Enforcement points

1. Dialplan `[japit-tollfraud-check]` before `[japit-pstn-dial]`
2. FastAPI AMI originate (`agent.telephony.control`)
3. Same policy module for callbacks/dialer paths (evaluate before originate)

## APIs

- `GET /api/v1/system/tollfraud/policy`
- `POST /api/v1/system/tollfraud/evaluate`
- `GET /api/v1/system/tollfraud/telephony/evaluate` (Asterisk CURL)

## Metrics

`japit_tollfraud_block_total`, `japit_tollfraud_concurrency_block_total`, `japit_tollfraud_international_block_total`, `japit_tollfraud_duration_limit_total`
