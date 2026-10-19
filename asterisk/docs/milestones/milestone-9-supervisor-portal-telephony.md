# Milestone 9 Supervisor Portal Telephony Contract

## Scope

Milestone 9 adds AMI-backed supervisor monitoring and intervention over the existing Japit desk-phone model without changing the brownfield PBX ownership boundary established in earlier milestones.

## Brownfield Boundary

- legacy `ps_*` realtime ownership remains unchanged
- Milestone 9 does not move live queue routing or endpoint registration into the Japit application
- Milestone 9 does not modify legacy DID, IVR, or campaign control flows
- Milestone 9 reuses the already-isolated Japit AMI account only

## PBX-Facing Runtime Inputs

The supervisor backend reuses the same `.env` Milestone 8 AMI configuration:

- `ASTERISK_AMI_HOST`
- `ASTERISK_AMI_PORT`
- `ASTERISK_AMI_USERNAME`
- `ASTERISK_AMI_SECRET`
- `ASTERISK_AMI_TIMEOUT_SECONDS`

No new PBX credentials or new SIP registration flows were introduced.

## AMI Actions Used

Milestone 9 supervisor control uses these AMI actions:

- `Login`
- `Originate`
- `QueuePause`
- `Hangup`
- `Logoff`

## Supervisor Control Behavior

- `listen` originates the supervisor desk phone into `ChanSpy` against the target agent channel in quiet bridged mode
- `whisper` originates the supervisor desk phone into `ChanSpy` whisper mode against the target agent channel
- `barge` originates the supervisor desk phone into `ChanSpy` barge mode against the target agent channel
- `force-logout` optionally hangs up the active agent channel, pauses queue delivery for the assigned extension, marks the Japit presence model offline, and records notification/audit state

## Data Ownership

AMI command outcomes are recorded in Japit-owned PostgreSQL entities:

- `operations.supervisor_action_events`
- `audit.telephony_command_audit`
- `operations.agent_presence_states`
- `operations.agent_presence_events`
- `integration.agent_notifications`

## Operational Notes

- listen, whisper, and barge require that the supervisor user has an assigned desk-phone extension
- target monitoring prefers the live `active_channel_name` tracked in `operations.agent_presence_states`
- force logout is implemented as an application-level operation and does not disable or delete the underlying extension record
