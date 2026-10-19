# Asterisk recording security (Phase 14)

## Spool remains authoritative

MixMonitor continues to write local plaintext spool for durability.

Encryption happens in the Japit transfer pipeline **after** the file is closed, before/at archive to `/opt/recordings/node_<id>/…`.

## Dual-node

Each node keeps local spool. Encrypted archive paths remain `node_<id>/…`. Do not share plaintext spool over NFS as primary.

## Operations

1. Enable `RECORDING_ENCRYPTION_ENABLED` on FastAPI workers.
2. Ensure KMS/Vault Transit reachable.
3. Monitor `japit_recording_encryption_*` metrics and transfer backlog.
4. Never commit KMS master keys.

Plaintext historical recordings are not force-migrated in Phase 14.
