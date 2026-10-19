# Shared storage for Asterisk peers

AST-03 uses shared storage so both manually operated PBX peers access the same assets and persisted media. It does not make Asterisk active/active HA: active calls, registrations, astdb, logs, sockets, and temporary spool state remain node-local.

## Required layout

Mount the same backend filesystem at these paths on both Asterisk-1 and Asterisk-2:

| Mount path | Contents | Access |
|---|---|---|
| `/var/spool/asterisk/monitor` | MixMonitor recordings | read/write by the Asterisk service account |
| `/var/lib/asterisk/sounds` | shared custom and approved sound files | normally read-only after release |
| `/var/lib/asterisk/moh` | music-on-hold audio | normally read-only after release |
| `/var/lib/asterisk/prompts` | separate prompt library, if configured | normally read-only after release |
| `/var/spool/asterisk/voicemail` | voicemail audio and mailbox metadata | read/write by the Asterisk service account |
| `/etc/asterisk/keys` | TLS certificates and private-key material | read-only to Asterisk; privileged deployment writer only |
| `/var/lib/asterisk/agi-bin` | shared AGI binaries (optional Japit helpers) | normally read-only after release |
| `/opt/recordings` | FastAPI finalized recording archive (synced from `monitor`) | read/write by API/recording worker |

NFS is preferred for Linux peers; SMB is acceptable only when its locking, ownership mapping, permissions, and filename behavior are verified with Asterisk. Keep the host-local mount definition outside this repository.

## Path consistency (single PBX production)

Asterisk MixMonitor writes to `/var/spool/asterisk/monitor`. The recording worker finalizes into `/opt/recordings` (`RECORDING_LOCAL_ROOT`). Both paths must exist and be writable by their service accounts. Validation:

```bash
asterisk/scripts/validate_shared_media.sh
curl -H "Authorization: Bearer $TOKEN" "$API/api/v1/system/media/health"
ansible-playbook ansible/playbooks/validate_shared_media.yml
```

## Dual-PBX staging (not required for single-node production)

When Asterisk-2 is introduced, mount the same backend for monitor/sounds/moh/prompts/voicemail/keys/agi-bin on both peers **before** taking production traffic. Set `REQUIRE_MOUNT=true` / `asterisk_shared_media_require_mount: "true"` during staging drills only.

## Ownership, permissions, and mount behavior

- Use a consistent numeric UID/GID for the Asterisk service account on both nodes. Verify with `stat`, not account names alone.
- Create release directories with the service account able to create files under `monitor` and `voicemail`; restrict other paths to read-only after publishing.
- Use server-side locking that works across both clients. Do not disable locking for voicemail.
- Ensure mount availability before starting Asterisk. Add explicit boot ordering/health checks; avoid silently writing to an empty local fallback directory.
- Monitor capacity, latency, stale mounts, and write errors. A successful call does not guarantee a durable recording.
- Do not use a sync job to copy recordings or voicemail between peers while the shared mount is active; that introduces duplicate and conflicting writers.

## Certificates

Certificates can be shared only when both nodes are intended to present the same hostname/certificate chain. Private keys require a root-owned deployment path and restrictive file permissions (typically `0640` or tighter, per service account needs). If each node advertises a different SIP/WSS hostname, issue certificates that cover both names or use node-local certificate material; do not force a shared certificate that fails hostname validation.

## Concurrent-write limits

Shared recordings are safe only when each call produces a unique filename. The existing dialplan uses a unique recording stem; preserve this property. Avoid operator edits/renames in the active monitor directory.

Voicemail can be written from either peer, but two simultaneous operations on the same mailbox should be treated as a concurrency risk and tested with the selected filesystem. This phase does not introduce mailbox ownership, distributed locks, or conflict resolution beyond the filesystem's locking semantics.

## Mount validation

Before allowing calls on Asterisk-2:

1. On each peer, confirm every required path is a mounted filesystem and has the expected UID/GID/mode.
2. Create and remove a non-production test file from each writable path as the Asterisk service account; verify it is immediately visible from the other peer.
3. Play a shared custom sound and MOH asset from each node.
4. Place a controlled call through each node and verify a distinct recording appears in `monitor`.
5. Leave a test voicemail through each node and verify the message is readable from both peers.
6. Validate the TLS certificate chain and file permissions without displaying private key content.

Never place these node-local paths on shared storage: `/var/run/asterisk`, `/var/log/asterisk`, `astdb`, Asterisk module directories, `/etc/asterisk` as a whole, or process/systemd state.
