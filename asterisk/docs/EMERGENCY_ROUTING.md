# Emergency routing runbook (AST-14)

## Purpose

Provide a dedicated, auditable route for emergency numbers that bypasses queue / DND / campaign / predictive restrictions while preserving authentication, trunk availability, CLI policy, and audit logging.

## Configuration (single policy source)

Set on the application / Asterisk hosts (do not scatter hard-coded numbers in multiple dialplan files):

| Variable | Example | Meaning |
|----------|---------|---------|
| `EMERGENCY_ROUTING_ENABLED` | `yes` | Master switch |
| `EMERGENCY_NUMBERS` | `112,100,101,102,108` | Production emergency list |
| `EMERGENCY_STAGING_NUMBERS` | `9339112` | Safe test numbers (no PSTN) |
| `EMERGENCY_CLI` | *(empty or provider DID)* | Preferred CLI; empty = use existing outbound DID infra |
| `EMERGENCY_CLI_FALLBACK` | | Secondary CLI |
| `EMERGENCY_TRUNK` | `Mediant` | Optional override; else primary trunk |
| `JAPIT_EMERGENCY_NODE` | `asterisk-1` | Node label for audit |

## Sync to Asterisk (both nodes when present)

```bash
export EMERGENCY_NUMBERS=112,100,101,102,108
export EMERGENCY_STAGING_NUMBERS=9339112
export EMERGENCY_CLI=   # leave empty to use provisioned outbound DID
export JAPIT_EMERGENCY_NODE=asterisk-1
/opt/asterisk/scripts/sync_emergency_policy.sh
# On Asterisk-2 (STAGING REQUIRED when second node exists):
# JAPIT_EMERGENCY_NODE=asterisk-2 /opt/asterisk/scripts/sync_emergency_policy.sh
```

Runtime match uses ASTDB `japit/emergency/<number>=1`.

## Call path

```text
WebRTC / deskphone / X-Lite
   → japit-internal / japit-app-outbound
   → japit-emergency-detect (ASTDB)
   → japit-emergency
   → CLI resolution → japit-pstn-dial (AST-06 failover)
```

Staging numbers answer + beep only — **never** dial real PSTN emergency services in CI.

## APIs

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/system/emergency/policy` | settings/queues read |
| GET | `/api/v1/system/emergency/match` | settings/queues read |
| GET | `/api/v1/system/emergency/telephony/match` | private network (Asterisk CURL) |
| POST | `/api/v1/system/emergency/audit` | settings/queues write |

## Safe staging procedure

1. Ensure `EMERGENCY_STAGING_NUMBERS` contains a non-PSTN test code (default `9339112`).
2. Sync ASTDB on the PBX under test.
3. From WebRTC and deskphone, dial the staging number.
4. Confirm `UserEvent JapitEmergency*` / CDR userfield `emergency:` / audit log.
5. Confirm normal outbound to a non-emergency number is unchanged.
6. **Do not** dial live 112/100/101/108 against the carrier without a controlled carrier-approved window.

## Live validation (STAGING REQUIRED)

- Dual-node emergency dial on Asterisk-2
- Carrier CLI acceptance for the configured emergency CLI / DID
- Trunk failure while emergency call is in progress
