# Callback Channel Template (AST-16)

Context: `[japit-callback-originate]`

Used by Phase 16 Dialer Worker via AMI:

`Local/{normalized}@japit-callback-originate`

## Channel variables

| Variable | Purpose |
|----------|---------|
| `JAPIT_CALLBACK_ID` | Callback request UUID |
| `JAPIT_ORIGINAL_CALL_SESSION_ID` | Original CallSession linkage |
| `JAPIT_LOGICAL_CALL_ID` | Cross-attempt logical id |
| `JAPIT_CAMPAIGN_ID` / `JAPIT_CAMPAIGN_NAMESPACE` | Campaign attribution |
| `JAPIT_CALLBACK_CLI` / `JAPIT_DID` | Campaign CLI presentation |
| `JAPIT_AMD_ENABLED` | `1` to run AMD **after PSTN answer** in `[japit-join-conf]` |
| `JAPIT_AMD_ACTION` | `continue` (default) or `hangup` on MACHINE |
| `JAPIT_AMD_PROFILE` | `default` / `conservative` / `aggressive` |
| `JAPIT_AMD_UNKNOWN_ACTION` | Profile policy for NOTSURE/HANGUP |
| `JAPIT_ASTERISK_NODE_ID` | Dual-PBX ready node label |
| `JAPIT_AGENT_EXT` | Agent extension for join |

## Flow

1. Stamp CDR userfield + CEL `JAPIT_CALLBACK_ORIGINATE`
2. `Goto(japit-app-outbound,…)` which uses `japit-pstn-dial` (AST-06 failover + AST-15 toll-fraud)
3. After answer, optional AMD in `[japit-join-conf]` → CEL/UserEvent `JapitAmdResult`

## Dual-node

`JAPIT_ASTERISK_NODE_ID` is recorded for attribution. Current environment has one live Asterisk node; dual-PBX validation is **STAGING REQUIRED**.
