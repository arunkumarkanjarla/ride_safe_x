# Milestone 12 Reports Telephony Contract

## Scope

Milestone 12 adds reporting and export capabilities on top of the existing Japit telephony data model without expanding the brownfield PBX control boundary.

## Brownfield Boundary

- Milestone 12 does not modify `/opt/asterisk-api`
- Milestone 12 does not change existing dialplan contracts
- Milestone 12 does not introduce a new PBX event consumer or a second call-state system
- Milestone 12 is read-only from the PBX perspective

## PBX-Facing Runtime Inputs Reused

Milestone 12 reporting reads already-established Japit-owned telephony data that is populated from existing PBX-adjacent workflows:

- `calls.call_sessions`
- `calls.call_queue_events`
- `calls.call_ivr_events`
- `media.recordings`
- `integration.asterisk_recording_events`
- `integration.asterisk_origination_events`
- `operations.agent_presence_states`
- `audit.telephony_command_audit`

## Reporting Behavior

- realtime reports summarize currently active call state and live agent presence
- CDR uses the existing `calls.call_sessions` ledger as the authoritative application call record
- recording search uses the existing `media.recordings` metadata linked back to call sessions
- exports are generated from application query results and do not require new PBX actions

## Data Ownership

Milestone 12 does not create new telephony control objects.

It only adds:

- report APIs
- report response contracts
- report CSV generation
- report navigation in the React shell

## Operational Notes

- reporting accuracy depends on the existing call-session, recording, and presence data being populated by the established Japit runtime path
- no live telephony command is executed when using the Reports workspace
- Milestone 12 therefore has a lower PBX rollout risk than control-plane milestones such as Agent, Supervisor, IVR Builder, or Campaigns
