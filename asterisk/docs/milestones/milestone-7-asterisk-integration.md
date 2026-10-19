# Milestone 7 Asterisk Integration

## Scope

Milestone 7 implements Japit-owned Asterisk integration on the live server without modifying the legacy `arun_asterisk` database objects or touching `/opt/asterisk-api`.

This milestone adds Japit-safe ODBC, dialplan, AMI, ARI, queue realtime, recording event, origination event, and heartbeat plumbing while preserving the existing legacy inbound and outbound behavior as the fallback path.

## Safety Boundaries

- the legacy ODBC class `asterisk` remains unchanged
- the legacy `arun_asterisk` PostgreSQL schema, views, functions, and tables were not modified
- the existing legacy contexts continue to own the final fallback behavior
- `/opt/asterisk-api` was not touched
- live files were backed up to `/opt/bmad_project/backups/asterisk_m7_20260704`

## Live Files Updated

- `/etc/asterisk/res_odbc.conf`
- `/etc/asterisk/res_odbc_japit.conf`
- `/etc/asterisk/func_odbc.conf`
- `/etc/asterisk/func_odbc_japit.conf`
- `/etc/asterisk/extconfig.conf`
- `/etc/asterisk/extensions.conf`
- `/etc/asterisk/extensions_japit.conf`
- `/etc/asterisk/manager.conf`
- `/etc/asterisk/manager_japit.conf`
- `/etc/asterisk/ari.conf`
- `/etc/asterisk/ari_japit.conf`
- `/etc/asterisk/sorcery.conf`
- `/etc/asterisk/sorcery_japit.conf`
- `/etc/asterisk/pjsip.conf`
- `/etc/asterisk/pjsip_japit.conf`
- `/etc/odbc.ini`

## Implemented Asterisk Capabilities

- dual ODBC connectivity:
  - legacy `asterisk -> asterisk-postgres`
  - Japit `japit_callcenter -> japit_call_center-postgres`
- Japit ODBC function layer for:
  - DID route discovery
  - IVR prompt and option lookup
  - queue failover lookup
  - agent queue and campaign lookup
  - callback creation
  - recording event logging
  - origination event logging
  - heartbeat upsert
- inbound call routing wrapper:
  - live `direct-inbound` now sends every DID to `japit-pre-router`
  - when no Japit route exists, control falls back to the existing legacy `inbound` context
- Japit dialplan contexts:
  - `japit-pre-router`
  - `japit-inbound`
  - `japit-ivr`
  - `japit-ivr-default`
  - `japit-ivr-dispatch`
  - `japit-queue`
  - `japit-extension-route`
  - `japit-callback`
  - `japit-voicemail`
  - `japit-app-outbound`
  - `japit-heartbeat`
  - `japit-recording-hangup`
  - `japit-internal`
- AMI integration:
  - new `japitami` manager user
  - restricted ACL to localhost and `192.168.20.26`
  - call, queue, bridge, user event, originate, and reporting permissions
- ARI integration:
  - new `japitari` user
  - HTTP ARI authentication verified against `/ari/asterisk/info`
- queue realtime activation for Japit-owned queues and queue members via:
  - `public.japit_queues`
  - `public.japit_queue_members`
- PJSIP provisioning templates for Japit-owned endpoints in `pjsip_japit.conf`
- recording, callback, heartbeat, and origination events emitted through both ODBC writes and `UserEvent(...)`

## Brownfield Decision For PJSIP

The live server already uses legacy realtime `ps_*` tables from the `arun_asterisk` database.

During implementation, enabling Japit as a second live realtime `ps_*` source generated SQL compatibility errors because the shared legacy PJSIP realtime shape on the live platform is not safe to extend without touching the forbidden legacy database objects.

Final production-safe outcome:

- legacy `ps_*` realtime remains the active live source
- Japit queue realtime, ODBC, AMI, ARI, and dialplan integration are active
- Japit PJSIP provisioning templates and PostgreSQL compatibility objects were created for controlled future activation after a planned legacy schema alignment window

## Call Flow Summary

1. Mediant calls still enter `direct-inbound`
2. `direct-inbound` now forwards every DID to `japit-pre-router`
3. `japit-pre-router` looks up Japit DID ownership through `ODBC_GET_JAPIT_DID_ROUTE_TYPE`
4. If Japit owns the DID, routing continues through `japit-inbound`
5. If Japit does not own the DID, routing falls back immediately to the legacy `inbound` context
6. Japit-owned calls then branch to IVR, queue, extension, voicemail, callback, or ARI Stasis based on database routing

## Rollback Steps

1. restore backed-up live files from `/opt/bmad_project/backups/asterisk_m7_20260704`
2. run:
   - `asterisk -rx "module reload res_odbc.so"`
   - `asterisk -rx "module reload func_odbc.so"`
   - `asterisk -rx "module reload manager.so"`
   - `asterisk -rx "module reload res_ari.so"`
   - `asterisk -rx "module reload res_config_odbc.so"`
   - `asterisk -rx "dialplan reload"`
   - `asterisk -rx "pjsip reload"`
3. if database rollback is required, downgrade Alembic from head to `20260704_0004`

## Operational Notes

- the repeated AMI authentication notices for `sendcron`, `listencron`, and `updatecron` were already present during milestone verification and were not introduced by Japit changes
- `transport-udp` remains only partially reloadable on live `pjsip reload`; this is normal Asterisk behavior and did not block the milestone
- end-to-end live customer call tests were not executed because no Japit production DID, queue, or endpoint seed set was provided for safe production call generation during this milestone
