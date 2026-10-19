# Multi-provider / least-cost routing (AST-29)

Extends **AST-06** dual-trunk failover. It does **not** replace `[japit-pstn-dial]`, OPTIONS qualify, or `select_outbound_trunk()` HA fallback.

Default **OFF**: `MULTI_PROVIDER_ROUTING_ENABLED=false`.

## Existing AST-06 (preserved)

1. OPTIONS qualify (`qualify_frequency=30`) on `Mediant` / `Mediant-Secondary`.
2. `[japit-pstn-dial]` dials primary, then secondary **only** on `CHANUNAVAIL` / `CONGESTION`.
3. Never retries `ANSWER`, `BUSY`, `NOANSWER`, `CANCEL`.
4. `UserEvent(JapitTrunkFailover)` + CEL + CDR userfield.
5. Deskphone AMI uses `select_outbound_trunk()`; Local/WebRTC still hit dialplan failover.

## Provider model

Table `telephony.sip_providers` (no SIP passwords, no SecretProvider values):

| Field | Role |
|-------|------|
| name | Unique display name |
| enabled | Soft disable |
| priority | Lower number wins first under PRIORITY |
| cost_per_minute | Decimal ≥ 0 |
| pjsip_endpoint | Existing PJSIP endpoint name (`trunk_reference`) |
| supported_prefixes | Digit prefixes; empty = all destinations that already passed toll-fraud |
| max_concurrent_calls | Optional; Redis occupancy, fail-open if Redis is down |
| health_state | HEALTHY / DEGRADED / UNAVAILABLE / UNKNOWN |

Routing policy singleton: `PRIORITY` (default), `LEAST_COST`, `PRIORITY_THEN_COST`.

## Selection order

```
Destination
  → Toll-fraud / policy          (existing)
  → DND / consent                (existing, where applicable)
  → Governor / CPS               (existing, campaign)
  → AST-29 provider selection    (this module; flag ON)
  → Originate / Dial
  → Safe pre-answer failure?
  → Next provider (AST-06 Dial retry + optional tertiary)
```

Cost never overrides eligibility (enabled, prefix, health, capacity).

UNKNOWN is **not** treated as healthy.

Emergency (`JAPIT_IS_EMERGENCY=1`) skips LCR and keeps AST-06.

## Routing policies

Example: A priority=10 cost=0.90; B priority=20 cost=0.60.

| Policy | Order |
|--------|--------|
| PRIORITY | A → B |
| LEAST_COST | B → A |
| PRIORITY_THEN_COST | lowest priority first; cost breaks ties; name is the final deterministic key |

## SIP failure classification / retry matrix

| Signal | Failover? |
|--------|-----------|
| DIALSTATUS CHANUNAVAIL / CONGESTION while ORIGINATING | Yes |
| SIP 408, 480, 481, 500, 502, 503, 504 | Yes |
| connection_timeout / transport_failure | Yes |
| DIALSTATUS ANSWER / BUSY / NOANSWER / CANCEL | No |
| SIP 403, 404, 486, 487, 603 | No |
| Call state RINGING | No (far-end may already be alerting) |
| Call state ANSWERED / COMPLETED | **Never** (would duplicate the customer call) |

Same provider is never retried in one attempt. Maximum **3** endpoints (primary / secondary / tertiary).

## 30-second Definition of Done

AST-06 OPTIONS qualify is 30 seconds. Dialplan failover after `CHANUNAVAIL` is immediate.

**Do not claim ≤30s in production until staging records:**

```
t0 = primary failure detected
t1 = secondary originate started
failover_latency_ms = t1 - t0
```

Metric: `japit_sip_provider_failover_latency_seconds` (observed only when timestamps are supplied).

## Redis

Optional capacity key `japit:sip:cap:{provider_id}`. Redis down → skip capacity check (outbound continues). Never store SIP secrets or raw phone numbers.

## Rollback

```
MULTI_PROVIDER_ROUTING_ENABLED=false
```

AST-06 continues. Alembic downgrade `20260814_0082` → `20260814_0081` removes Phase 30 schema only.

## APIs

| Method | Path | Permission |
|--------|------|------------|
| GET/POST | `/api/v1/admin/sip-providers` | read: `trunks.read` / `trunk.health`; write: `trunks.manage` |
| GET/PUT/DELETE | `/api/v1/admin/sip-providers/{id}` | same |
| GET | `/api/v1/admin/sip-providers/{id}/health` | read |
| GET/PUT | `/api/v1/admin/sip-routing/policy` | read / `trunks.manage` |
| GET | `/api/v1/telephony/sip/providers/decide-simple` | Asterisk CURL; fail-open `skip\|...` |

Responses never include SIP passwords.
