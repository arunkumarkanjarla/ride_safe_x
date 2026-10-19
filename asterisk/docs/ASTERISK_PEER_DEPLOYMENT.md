# Asterisk-2 peer deployment (AST-03)

## Scope and safety boundary

This procedure creates a second, manually operated Asterisk peer. It does **not** configure Keepalived, a SIP virtual IP, automatic trunk failover, automatic AMI failover, or migration of active calls. Each PBX has its own host identity and its own SIP/RTP address.

FastAPI continues to use one AMI target at a time. Pin its `AMI_HOST` to the chosen PBX, verify calls there, and change the pin only through a planned manual operation. Dual AMI consumers are a later phase.

## Prerequisites

Before placing Asterisk-2 in service:

1. Build the same Asterisk version and install the same packages, modules, codec dependencies, sounds, and custom scripts as Asterisk-1.
2. Ensure the node checks out the same approved Git commit as Asterisk-1.
3. Create the shared storage mounts described in [SHARED_STORAGE.md](SHARED_STORAGE.md). Mount them before Asterisk starts; a missing recording mount must fail closed operationally rather than write unnoticed local recordings.
4. Provision the primary ODBC DSN `japit_call_center-postgres`. The optional `japit_call_center-postgres-replica` is documentation for a manual DR decision, not an automatic fallback.
5. Permit Asterisk-2's dedicated SIP/RTP and AMI paths through firewalls. Do not reuse Asterisk-1's public/private address.

## Deploy the shared configuration

On Asterisk-2, clone the same repository at the approved branch to `/opt/asterisk` (or set `GIT_REPO` accordingly). The deployment script intentionally deploys only top-level Asterisk configuration files to `/etc/asterisk`; documentation and peer overlays remain in the repository.

```bash
cd /opt/asterisk
sudo ./automated_update_asterisk_git_to_server.sh --dry-run <approved-branch>
sudo ./automated_update_asterisk_git_to_server.sh <approved-branch>
```

The script backs up the live configuration, validates the copied files, reloads mapped modules, and rolls back on reload failure. Run the dry run first on each peer. Do not deploy an overlay by copying the entire `peers/` directory into `/etc/asterisk`.

For the serialized Git/Ansible deployment workflow, node-overlay safeguards,
aggregate checksums, and nightly drift reports, see
[ASTERISK_CONFIG_SYNC.md](ASTERISK_CONFIG_SYNC.md).

## Apply the Asterisk-2 node overlay

Use `peers/asterisk-2/` as a reviewed source for node-local values:

| Sample | Apply to | Purpose |
|---|---|---|
| `pjsip_node.conf.sample` | matching transports in `pjsip.conf` | Asterisk-2 bind and advertised SIP/media addresses |
| `manager_node.conf.sample` | `manager.conf` / `manager_japit.conf` | AMI bind, managed secret reference, restrictive client ACL |
| `odbc.ini.sample` | protected system `/etc/odbc.ini` | primary PostgreSQL DSN and a commented manual replica DSN |
| `res_odbc_node.conf.sample` | `res_odbc_japit.conf` | active primary handle and manual-switch procedure |
| `rtp_node.conf.sample` | `rtp.conf` | node-specific firewall/media constraints |
| `node.env.sample` | protected host-local environment file | `ASTERISK_NODE_ID=2` and FastAPI's manually selected `AMI_HOST` |

Replace every placeholder during change review. Keep production credentials and private keys out of Git. Compare the final effective files to Asterisk-1, allowing only identity, addressing, AMI ACL, and host-runtime differences.

## Shared assets

Both peers use the same approved assets and data:

- `/var/spool/asterisk/monitor` — recordings
- `/var/lib/asterisk/sounds` — standard and custom sounds
- `/var/lib/asterisk/moh` — music on hold
- `/var/lib/asterisk/prompts` — prompt library, if configured separately
- `/etc/asterisk/keys` — certificates and protected private-key material
- `/var/spool/asterisk/voicemail` — voicemail messages and metadata

Mount details, permissions, and write-concurrency constraints are in [SHARED_STORAGE.md](SHARED_STORAGE.md).

## Parity checklist

Run these checks on both nodes after deployment and retain the output with the change record:

- [ ] `asterisk -rx "core show version"` reports the approved compatible version.
- [ ] `asterisk -rx "module show"` has the same required modules, including PJSIP, ODBC/realtime, queue, recording, CDR/CEL, and required codec modules.
- [ ] Codec policy is equal (`core show codecs` and the deployed `codecs.conf`).
- [ ] Dialplan contexts and extensions match (`dialplan show`; inspect `japit-*` and legacy contexts).
- [ ] `queue show` returns the expected realtime queues and member configuration.
- [ ] Queue, endpoint, and dialplan template sources resolve to the same shared Git revision and realtime records.
- [ ] `odbc show` and a representative realtime lookup succeed against the primary DSN.
- [ ] `manager show user japitami` confirms the approved ACL, permissions, and required `UserEvent` filters.
- [ ] A recording created on each PBX is visible at the shared monitor path with correct ownership.
- [ ] Voicemail, custom sounds, MOH, prompts, and certificates are readable from their expected paths.
- [ ] `bash scripts/verify_peer_parity.sh` reports the same normalized module and version signatures. Use its `--reference` option only with a report collected from the other peer.

## Validation calls: PBX-1 versus PBX-2

Use an approved test DID/campaign and a test endpoint reachable directly through each node's unique SIP address or controlled trunk route. Do not change production registrations or trunk routing solely to run this test.

1. Pin FastAPI's `AMI_HOST` to PBX-1, place an inbound and an outbound test call, and note the unique ID, queue/routing result, CDR and CEL rows, recording path, and received AMI `UserEvent`/call lifecycle events.
2. End the calls and confirm the recording completes at the shared monitor path.
3. Change the FastAPI AMI pin through the approved manual procedure to PBX-2. Confirm the AMI TCP connection and `manager show connected` on PBX-2 before calling.
4. Repeat the same inbound/outbound tests through PBX-2. Compare selected route, queue disposition, CDR/CEL fields, recording availability, and AMI events with PBX-1. Node identity may differ; business routing and persisted results must not.
5. Return the AMI pin to the intended steady-state node and record the result. Do not leave a second AMI listener active.

If a test shows data divergence, missing shared files, different module/codec output, or an unexpected AMI event set, remove Asterisk-2 from the test path and resolve parity before further traffic.
