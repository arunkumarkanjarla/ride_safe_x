# Milestone 8 Agent Portal Telephony Contract

## Scope

Milestone 8 adds an AMI-first agent portal contract for Japit desk-phone workflows without changing the brownfield PBX ownership model introduced in Milestone 7.

## Brownfield Boundary

- legacy `ps_*` realtime ownership remains unchanged
- Milestone 8 does not activate browser WebRTC registration against the live PBX
- Milestone 8 does not re-home queues, endpoints, or extensions away from the legacy active PJSIP source
- Milestone 8 does not change live DID routing ownership or the legacy application paths from the older project

## PBX-Facing Runtime Inputs

The portal backend now consumes the existing Japit-only AMI account from `/etc/asterisk/manager_japit.conf`:

- host: `127.0.0.1`
- port: `5038`
- username: `japitami`
- permission scope: the previously configured call, agent, originate, reporting, and command classes

The backend runtime reads these values from `.env`:

- `ASTERISK_AMI_HOST`
- `ASTERISK_AMI_PORT`
- `ASTERISK_AMI_USERNAME`
- `ASTERISK_AMI_SECRET`
- `ASTERISK_AMI_TIMEOUT_SECONDS`

## AMI Actions Used

Milestone 8 portal control uses these AMI actions:

- `Login`
- `QueuePause`
- `Originate`
- `Hangup`
- `Logoff`

## Portal Behavior

- `telephony/login` marks the Japit agent desk-phone session ready inside the portal state model
- `telephony/ready` unpauses the agent’s assigned queue memberships through AMI `QueuePause`
- `telephony/pause` pauses the agent’s assigned queue memberships through AMI `QueuePause`
- `telephony/originate` requests outbound customer calls through AMI `Originate`
- `telephony/hangup` requests channel hangup when a channel name is known
- `telephony/heartbeat` updates Japit-owned presence and heartbeat state without taking over PBX registration ownership

## Data Ownership

AMI command outcomes are recorded in Japit-owned PostgreSQL entities:

- `audit.telephony_command_audit`
- `operations.agent_presence_states`
- `operations.agent_presence_events`
- `integration.agent_notifications`
- `integration.asterisk_runtime_heartbeats`
- `integration.asterisk_origination_events`

## Deferred Track

Browser WebRTC remains deferred until Japit can safely own or isolate live SIP registration from the legacy active `ps_*` realtime source.
