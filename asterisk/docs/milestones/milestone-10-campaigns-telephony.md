# Milestone 10 Campaigns Telephony Contract

## Scope

Milestone 10 adds AMI-backed outbound campaign origination on top of the existing Japit desk-phone and outbound call path without replacing the brownfield PBX control boundary.

## Brownfield Boundary

- legacy `ps_*` realtime ownership remains unchanged
- Milestone 10 does not replace legacy dialer services with a new autonomous daemon
- Milestone 10 does not modify live SIP endpoint registration ownership
- Milestone 10 does not rewrite the existing Asterisk contexts outside the previously established Japit-owned outbound path
- Milestone 10 reuses the already-isolated Japit AMI account only

## PBX-Facing Runtime Inputs

The campaign backend reuses the existing AMI configuration:

- `ASTERISK_AMI_HOST`
- `ASTERISK_AMI_PORT`
- `ASTERISK_AMI_USERNAME`
- `ASTERISK_AMI_SECRET`
- `ASTERISK_AMI_TIMEOUT_SECONDS`

No new PBX credentials were introduced.

## AMI Actions Used

Milestone 10 campaign dispatch uses:

- `Login`
- `Originate`
- `Logoff`

## Campaign Telephony Behavior

- progressive dispatch originates one customer leg per ready agent extension
- predictive dispatch calculates a larger working set from `pacing_ratio` but only originates up to current ready-agent capacity in the same cycle
- preview reserves leads without originating until the operator advances the workflow
- origination uses the existing `Local/<number>@japit-app-outbound` pattern and passes the assigned agent extension through the existing app-controlled variable contract

## Data Ownership

AMI command outcomes are recorded in Japit-owned entities:

- `calls.call_sessions`
- `telephony.campaign_leads`
- `telephony.campaign_lead_attempts`
- `audit.telephony_command_audit`
- `integration.asterisk_origination_events`

## Operational Notes

- dispatch requires agents that are `ready`, not paused, and mapped to a primary extension
- DNC checks run before origination selection
- retry timing stays in Japit-owned lead state rather than in Asterisk queue configuration
- inbound campaign ownership remains declarative through route ownership and does not directly push queue or DID rewrites to the PBX
