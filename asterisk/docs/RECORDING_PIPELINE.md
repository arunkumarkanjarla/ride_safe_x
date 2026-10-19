# Recording pipeline hardening (AST-13)

## Target path

```text
Asterisk MixMonitor
  → local NVMe spool (/var/spool/asterisk/monitor)
  → post-call detect / validate / checksum
  → optional transcode markers (wav|opus|mp3)
  → durable transfer queue (media.recording_transfer_jobs)
  → /opt/recordings (node_<id>/…)
```

MinIO is **not** the primary spool. Existing MinIO remains optional for legacy app playback.

## Durability

- Jobs survive FastAPI/worker restart (PostgreSQL-backed).
- Storage outage → `retry_pending` with exponential backoff.
- Duplicate prevention via checksum + destination key.
- Original spool file is not deleted by the transfer job on success (archive is a copy).

## States

`pending → processing → transcoding → transferring → verified → completed`  
Failure path: `retry_pending` → eventually `failed` (dead-letter after max attempts).

## APIs

- `GET /api/v1/system/recording-pipeline/status`
- `POST /api/v1/system/recording-pipeline/drain`

## Dual-node

Each PBX uses `ASTERISK_NODE_ID` (`pbx-1` / `pbx-2`) in destination keys. Shared `/opt/recordings` is the archive target.

## Disk pressure

`japit_recording_spool_used_percent`, warn/critical via `RECORDING_SPOOL_WARN_PERCENT` / `RECORDING_SPOOL_CRITICAL_PERCENT` and existing free-GB thresholds.
