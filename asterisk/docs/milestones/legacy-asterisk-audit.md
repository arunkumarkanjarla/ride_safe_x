# Legacy Asterisk Audit

## Scope

This document covers:
- `/opt/asterisk_calls_old`
- the active `/etc/asterisk` configuration set
- Asterisk spool, sound, queue, and voicemail paths
- related AGI, AMI, ARI, cron, and service observations

## What `/opt/asterisk_calls_old` Contains

The directory is not application source code. It is a curated Asterisk configuration bundle plus design notes.

Important files:
- `extensions.conf`
- `pjsip.conf`
- `queues.conf`
- `func_odbc.conf`
- `res_odbc.conf`
- `odbc.ini`
- `manager.conf`
- `ari.conf`
- `http.conf`
- `voicemail.conf`
- `extconfig.conf`
- `sorcery.conf`
- `RECORDING_MINIO_STRUCTURE.md`
- `VOICEMAIL_STRUCTURE.md`
- `DYNAMIC_DID_IVR_DEPLOY.md`

Observed comparison against `/etc/asterisk`:
- identical or functionally aligned:
  - `extensions.conf`
  - `pjsip.conf`
  - `func_odbc.conf`
  - `manager.conf`
  - `ari.conf`
  - `http.conf`
  - `modules.conf`
  - `cel.conf`
  - `cdr.conf`
  - `sorcery.conf`
- different:
  - `queues.conf`
  - `voicemail.conf`
  - `res_odbc.conf`

## Current Dialplan Model

The active custom dialplan is in `/etc/asterisk/extensions.conf`.

### Inbound flow

Observed flow:

1. SIP trunk from Mediant lands in context `direct-inbound`
2. Call is transferred to context `inbound`
3. Dialplan sets:
   - `ORIGINAL_DID`
   - `CUSTOMER_NO`
   - `EHP_CAMPAIGN`
   - `EHP_DIRECTION`
4. Dialplan resolves IVR using ODBC:
   - `ODBC_GET_DID_IVR_ID`
   - fallback `ODBC_GET_IVR_ID_BY_DID`
5. Call enters `dynamic-ivr`
6. IVR digit routes to one of:
   - queue
   - nested IVR
   - voicemail
   - callback

### Queue flow

Observed queue handling:
- queue entry is performed with `Queue(${QUEUE_NAME},t,,,20)`
- queue failures such as `JOINEMPTY`, `FULL`, `TIMEOUT`, and `LEAVEEMPTY` trigger fallback IVR logic through `ODBC_GET_DID_CONDITION_IVR`

Configured queue definitions found in `/etc/asterisk/queues.conf`:
- `btech_admissions`
- `mba_admissions`

Japit boundary:
- these queue definitions belong to the existing non-Japit project
- Japit should not reuse `btech_admissions`, `mba_admissions`, or any other existing project queue
- Japit should create its own new queue definitions and matching database records

### Voicemail flow

Structured voicemail storage is implemented in context `ehp-voicemail-record`.

Observed behavior:
- does not rely on the classic flat `VoiceMail()` mailbox layout for IVR voicemail capture
- builds a structured path under `/var/spool/asterisk/voicemail/default/{Campaign}/{DID}/...`
- emits `UserEvent(EHPVoicemailSaved, ...)` after recording

### Callback flow

Observed callback handling:
- IVR callback digit inserts a row using `ODBC_ADD_CALLBACK`
- target table from `func_odbc.conf`: `callback_requests`

### Outbound flow

Observed flow:
- internal user dials any number
- dialplan normalizes number
- agent campaign, queue, and DID metadata are resolved by ODBC
- `MixMonitor()` starts recording
- call is sent to `PJSIP/${NUM}@Mediant`
- hangup handler emits recording metadata event

### Recording flow

Observed recording handling:
- recordings start in `/var/spool/asterisk/monitor`
- historical files are present under `/var/spool/asterisk/monitorDONE/MP3`
- hangup handler `ehp-recording-hangup` emits `UserEvent(EHPRecordingSaved, ...)`

Japit boundary:
- the currently observed recording paths and existing recording metadata model belong to the existing non-Japit project
- Japit should use its own new recording path conventions and related metadata records rather than reusing the current project folders or labels

## IVRs and Campaign Assets

Observed custom IVR assets under `/var/lib/asterisk/sounds/custom`:
- `BTech Admissions 2026`
- `MBA Admissions 2026`

Observed IVR families:
- main
- holiday
- no_agents
- all_agents_busy
- voicemail
- submenu
- after_hours

This aligns with the custom dynamic IVR logic described in `DYNAMIC_DID_IVR_DEPLOY.md`.

Japit boundary:
- these IVR assets and campaign names belong to the existing non-Japit project
- Japit should create its own new IVR definitions, prompts, campaign folders, and inbound DID mappings

## Database Usage From Asterisk

The current custom dialplan does not use the local `japit_call_center` database.

It uses ODBC functions backed by the remote `arun_asterisk` database on `192.168.20.68`.

Staged Milestone 1 update:
- `/opt/asterisk_calls_old/res_odbc.conf` already preserves the working `asterisk` resource and also contains the requested `japit_callcenter` resource
- `/opt/asterisk_calls_old/odbc.ini` now stages both DSNs:
  - `asterisk-postgres` for the remote PBX database
  - `japit_call_center-postgres` for the local `japit_call_center` database on `192.168.20.26:5432`
- these are staged snapshot changes only and were not applied to live `/etc/asterisk` or `/etc/odbc.ini`

Observed `func_odbc.conf` responsibilities:
- DID to IVR resolution
- DID to campaign mapping
- IVR prompt lookup
- IVR digit action lookup
- fallback IVR lookup
- agent active-device lookup
- agent queue lookup
- agent campaign lookup
- callback insertion

Observed `extconfig.conf` and `sorcery.conf` responsibilities:
- PJSIP realtime mappings:
  - `ps_endpoints`
  - `ps_auths`
  - `ps_aors`
  - `ps_endpoint_id_ips`

## AGI Usage

### Legacy AGI inventory

Observed large AGI inventory under `/var/lib/asterisk/agi-bin`, including:
- `agi-DID_route.agi`
- `agi-VDAD_ALL_inbound.agi`
- `agi-VDAD_ALL_outbound.agi`
- `agi-IVR_recording_verification.agi`
- `call_inbound.agi`
- many VICIdial support AGIs

### Active role of AGI today

Important distinction:
- The current custom `/etc/asterisk/extensions.conf` does not call AGI for the new Japit-style inbound, queue, voicemail, and callback flow.
- The newer custom flow is native dialplan plus ODBC plus AMI `UserEvent`.
- Legacy AGI assets remain on disk and belong to the older VICIdial stack.

### Legacy AGI evidence

`agi-DID_route.agi` shows:
- MySQL-based VICIdial DID routing
- queue and campaign routing
- call-menu and voicemail routing
- QueueMetrics logging
- alternate logging paths

That confirms the host still carries the full VICIdial-era routing layer, even though the newer custom dialplan is now separate.

## AMI Usage

Observed in `manager.conf`:
- AMI enabled
- HTTP AMI enabled
- listener bound to `0.0.0.0:5038`
- named users present

Observed uses:
- VICIdial and `astguiclient` Perl tooling
- custom `UserEvent(EHPVoicemailSaved, ...)`
- custom `UserEvent(EHPRecordingSaved, ...)`
- likely queue and agent control integrations

## ARI Usage

Observed in `ari.conf`:
- ARI enabled
- wildcard CORS setting
- one configured ARI user

However:
- no direct ARI consumer was found in `/opt/asterisk_calls_old`
- no direct ARI consumer was found in `/opt/japit_callcenter`
- no ARI usage was found in the inspected `asterisk-api` code paths

Conclusion:
- ARI is enabled and available
- active business flow appears to rely on AMI and dialplan, not ARI

## HTTP Usage

Observed in `http.conf`:
- HTTP interface enabled
- bound to `0.0.0.0:8088`

Observed in `pjsip.conf`:
- WebSocket transport on `8088`

Conclusion:
- Asterisk HTTP is part of the WebRTC support path
- it also supports ARI and HTTP AMI exposure

## Queue Strategy

Observed queue model:
- static queue sections in `queues.conf`
- dynamic agent membership controlled externally
- FastAPI sidecar uses queue add or pause or remove commands
- dialplan contains custom local channels:
  - `Local/{ext}@ehp-agent-offer/n`
  - `Local/{ext}@ehp-queue-join`

This means queue membership is application-driven, while queue definitions remain file-based.

## Voicemail Strategy

Two voicemail worlds coexist:

1. legacy Asterisk mailbox layout
   - observed under `/var/spool/asterisk/voicemail/default/1080/INBOX`
   - observed under `/var/spool/asterisk/voicemail/default/5009/INBOX`

2. newer structured IVR voicemail layout
   - described in `VOICEMAIL_STRUCTURE.md`
   - implemented by `ehp-voicemail-record`

This is an important brownfield constraint for Milestone 2 and beyond.

## Cron Jobs and Related Scripts

Observed root crontab includes:
- recording move and mix jobs
- MP3 compression jobs
- keepalive and updater jobs
- queue DB cleanup
- agent log cleanup
- hopper updates
- database optimize
- inbound email parser
- old recording cleanup

Observed active or referenced script families:
- `/usr/share/astguiclient/AST_*`
- `/usr/share/astguiclient/ADMIN_*`
- `/usr/share/astguiclient/VD_*`

Important anomaly:
- root crontab references `/var/lib/asterisk/agi-bin/admin.pl --reload`
- no `admin.pl` file was found in `/var/lib/asterisk/agi-bin`
- no `admin.pl` file was found in `/usr/share/astguiclient`

This should be treated as a documentation finding for later validation, not as a change request in this milestone.

## Services and Adjacent Components

Observed related service:
- `asterisk-api.service`
  - runs `/opt/asterisk-api`
  - port `8001`

This sidecar:
- manages queues and agent presence
- handles TTS asset operations
- handles MinIO ingest and spool sync

## Which Asterisk Files Matter For Future Japit Changes

Based on the inspected custom flow, the files most likely to require modification in later milestones are:

Likely functional touchpoints:
- staged snapshot files first:
  - `/opt/asterisk_calls_old/extensions.conf`
  - `/opt/asterisk_calls_old/pjsip.conf`
  - `/opt/asterisk_calls_old/queues.conf`
  - `/opt/asterisk_calls_old/voicemail.conf`
  - `/opt/asterisk_calls_old/func_odbc.conf`
  - `/opt/asterisk_calls_old/res_odbc.conf`
  - `/opt/asterisk_calls_old/odbc.ini`
  - `/opt/asterisk_calls_old/manager.conf`
  - `/opt/asterisk_calls_old/ari.conf`
  - `/opt/asterisk_calls_old/http.conf`
- corresponding live deployment targets later, only if explicitly approved:
  - `/etc/asterisk/extensions.conf`
  - `/etc/asterisk/pjsip.conf`
  - `/etc/asterisk/queues.conf`
  - `/etc/asterisk/voicemail.conf`
  - `/etc/asterisk/func_odbc.conf`
  - `/etc/asterisk/res_odbc.conf`
  - `/etc/odbc.ini`
  - `/etc/asterisk/manager.conf`
  - `/etc/asterisk/ari.conf`
  - `/etc/asterisk/http.conf`

Usually avoid unless a clear requirement emerges:
- `/etc/asterisk/features.conf`
- `/etc/asterisk/logger.conf`
- `/etc/asterisk/modules.conf`
- `/etc/asterisk/cel.conf`
- `/etc/asterisk/cdr.conf`
- `/etc/asterisk/sorcery.conf`

Why the first group matters:
- dialplan and call flow live in `extensions.conf`
- SIP trunk and WebRTC transport live in `pjsip.conf`
- queue definitions live in `queues.conf`
- mailbox and legacy voicemail handling live in `voicemail.conf`
- database-driven routing lives in `func_odbc.conf`, `res_odbc.conf`, and `odbc.ini`
- AMI, ARI, and HTTP integration points live in `manager.conf`, `ari.conf`, and `http.conf`

Why the second group should not be touched casually:
- they affect logging, modules, billing, event generation, and runtime behavior beyond the Japit call flow
- no current Milestone 1 evidence requires changing them

## Milestone 1 Conclusion

The Asterisk environment is a brownfield PBX platform with:
- legacy VICIdial assets still present,
- custom ODBC-driven DID and IVR routing,
- custom queue and voicemail handling,
- AMI-driven recording and voicemail metadata events,
- a staged dual-database ODBC snapshot for future Japit integration,
- a sidecar API already integrated with MinIO.

Future work must preserve this split architecture, avoid unnecessary edits to global Asterisk behavior, and keep Japit isolated from the existing project entities by creating new campaigns, IVRs, queues, inbound routes, and recording-path conventions for Japit.
