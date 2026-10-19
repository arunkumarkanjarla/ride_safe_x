# Time integrity across the pair (AST-18)

## Target

| Severity | Absolute offset |
|----------|-----------------|
| OK | &lt; 50 ms |
| WARNING | 50–200 ms |
| CRITICAL | &gt; 200 ms |

## Architecture (dual-node ready)

```text
chronyd  →  Asterisk-1
         →  Asterisk-2   (architecture ready; not provisioned by this phase)
         →  PostgreSQL host
         →  Application / FastAPI hosts
```

Sample config: `asterisk/ops/chrony/chrony.conf.sample`

## Validation script

```bash
export TIME_OFFSET_OK_MS=50
export TIME_OFFSET_WARN_MS=200
export TIME_STATE_DIR=/var/lib/japit/time
export JAPIT_NODE_ROLE=asterisk-1
bash asterisk/scripts/check_time_integrity.sh
```

Writes `/var/lib/japit/time/chrony-tracking.json` consumed by FastAPI.

## API / metrics

| Path | Purpose |
|------|---------|
| `GET /api/v1/system/time/status` | Full snapshot |
| `GET /api/v1/system/time/health` | Compact health |
| `GET /api/v1/system/time/metrics?format=prometheus` | `japit_time_offset_seconds`, `japit_time_sync_status` |

Env thresholds: `TIME_OFFSET_OK_SECONDS` (default 0.05), `TIME_OFFSET_WARN_SECONDS` (default 0.2).

## CDR / CEL / recording consistency

- All nodes must share NTP/chrony so `linkedid` joins and recording filenames (`%Y%m%d-%H%M%S`) correlate.
- PostgreSQL `timestamptz` storage remains UTC; UI displays Asia/Kolkata — host clock skew appears as agent/wallboard drift.
- Keepalived failover does not correct clock skew; fix chrony first.

## STAGING REQUIRED

- Live chrony offset measurement on Asterisk-2
- Cross-node offset comparison PBX-1 vs PBX-2 vs DB vs app &lt; 50 ms
