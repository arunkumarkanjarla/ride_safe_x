# SIP Trunk Registration & Automatic Failover (AST-06)

## Scope

Both Asterisk peers share identical dual-trunk PJSIP definitions:

| Role | Endpoint | Default contact |
|------|----------|-----------------|
| Primary | `Mediant` | `sip:192.168.20.23:5060` |
| Secondary | `Mediant-Secondary` | `sip:192.168.20.24:5060` |

Replace the secondary IP with the standby Mediant / ITSP before go-live. Keepalived SIP VIP (AST-05) is unchanged — this module fails over **provider paths**, not PBX nodes.

## Behavior

1. **OPTIONS qualify** — both AORs use `qualify_frequency=30` / `qualify_timeout=3.0` so provider failure is visible within ~30 seconds.
2. **Dialplan failover** — `[japit-pstn-dial]` dials primary first; on `CHANUNAVAIL` or `CONGESTION` it emits `UserEvent(JapitTrunkFailover)` and dials secondary.
3. **AMI Originate** — deskphone outbound selects the healthy trunk via `select_outbound_trunk()`; dialplan still retries secondary if the chosen trunk fails mid-call setup.
4. **Inbound DID** — both trunks share `context=direct-inbound` so DID continuity is preserved when the provider presents the same DIDs on either gateway.
5. **Automatic restoration** — when primary becomes available again, health refresh increments `recovery_count` and sets `active_outbound` back to primary.

## Optional registration

Commented `[mediant-primary-reg]` samples in `pjsip.conf` enable provider REGISTER when required. Static IP trunks (current Mediant lab) do not need registration.

## APIs

| Method | Path |
|--------|------|
| GET | `/api/v1/system/trunks` |
| GET | `/api/v1/system/trunks/health` |
| GET | `/api/v1/system/trunks/failover` |
| GET | `/api/v1/system/trunks/metrics?format=json\|prometheus` |

Permission: `trunk.health` or `settings.read`.

State directory: `TRUNK_STATE_DIR` (default `/var/lib/japit/trunks`).

## Ops checks

```bash
asterisk/scripts/verify_trunk_failover.sh
curl -H "Authorization: Bearer $TOKEN" "$API/api/v1/system/trunks/health"
```

## Failure matrix

| Scenario | Expected |
|----------|----------|
| Primary OPTIONS timeout | Secondary selected; failover count++ |
| Secondary outage while primary up | Primary remains active |
| Both trunks down | Originate still targets primary; dialplan exhausts both |
| PBX-1 / VIP move | Trunk endpoints unchanged; VIP owns signaling (AST-05) |
| DNS failure (REGISTER mode) | Registration retry_interval applies; qualify marks unreachable |

## Metrics

- `japit_trunk_registered{endpoint}`
- `japit_trunk_available{endpoint}`
- `japit_trunk_options_latency_ms{endpoint}`
- `japit_trunk_failover_total`
- `japit_trunk_recovery_total`
- `japit_trunk_last_outage_timestamp{endpoint}`
