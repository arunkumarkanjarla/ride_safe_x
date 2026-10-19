#!/usr/bin/env bash
# AST-20 failover drill helper — NON-DESTRUCTIVE by default.
# Does NOT trigger production failover. Staging operators run steps manually.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE_DIR="${FAILOVER_DRILL_STATE_DIR:-/var/lib/japit/failover-drill}"
mkdir -p "${STATE_DIR}"
START_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "AST-20 failover drill START ${START_TS}" | tee "${STATE_DIR}/last-run.txt"

cat <<'EOF'
Checklist (manual staging — do not auto-execute destructive steps):
1. Baseline: cluster/vip/trunks/database/time/recording-pipeline health APIs
2. Inject ONE failure at a time (PBX / VIP / DB / Redis / trunk)
3. Detect via APIs/metrics
4. Failover per runbook Documents/PHASE12_FAILOVER_DRILL.md
5. Reconnect AMI / WebRTC / agents
6. Validate callbacks, wallboard, recordings
7. Measure RTO (<=15m) and RPO (<=5s)
8. Restore primary + data integrity check
9. QA sign-off
EOF

echo "Record measurements in ${STATE_DIR}/measurements.env"
cat > "${STATE_DIR}/measurements.env.sample" <<'ENV'
DRILL_ID=
STARTED_AT=
FAILURE_TYPE=
DETECTED_AT=
FAILOVER_COMPLETE_AT=
RTO_SECONDS=
RPO_SECONDS=
QA_SIGN_OFF=
NOTES=
ENV

echo "AST-20 drill helper READY (STAGING REQUIRED for live execution)"
