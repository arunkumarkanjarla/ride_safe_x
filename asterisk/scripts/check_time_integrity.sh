#!/usr/bin/env bash
# AST-18 — Time integrity check for Asterisk / DB / application hosts.
# Reports local chrony offset and severity thresholds.
#
# Thresholds (override via env):
#   TIME_OFFSET_OK_MS=50
#   TIME_OFFSET_WARN_MS=200
#   TIME_STATE_DIR=/var/lib/japit/time
#
# Exit codes: 0=ok, 1=warning, 2=critical/unknown

set -euo pipefail

OK_MS="${TIME_OFFSET_OK_MS:-50}"
WARN_MS="${TIME_OFFSET_WARN_MS:-200}"
STATE_DIR="${TIME_STATE_DIR:-/var/lib/japit/time}"
OUT_JSON="${TIME_CHRONY_TRACKING_FILE:-${STATE_DIR}/chrony-tracking.json}"
NODE_ROLE="${JAPIT_NODE_ROLE:-asterisk-1}"

mkdir -p "${STATE_DIR}"

offset_seconds=""
reference="unknown"
synchronized="false"
source="unavailable"

if command -v chronyc >/dev/null 2>&1; then
  tracking="$(chronyc -n tracking 2>/dev/null || true)"
  if [[ -n "${tracking}" ]]; then
    source="chronyc"
    reference="$(printf '%s\n' "${tracking}" | awk -F': ' '/Reference ID/ {print $2; exit}')"
    offset_line="$(printf '%s\n' "${tracking}" | awk -F': ' '/System time/ {print $2; exit}')"
    if [[ -n "${offset_line}" ]]; then
      offset_seconds="$(printf '%s\n' "${offset_line}" | awk '{print $1}')"
      if printf '%s\n' "${offset_line}" | grep -qi 'slow'; then
        offset_seconds="$(awk -v v="${offset_seconds}" 'BEGIN { printf "%.9f", -v }')"
      fi
    fi
    leap="$(printf '%s\n' "${tracking}" | awk -F': ' '/Leap status/ {print $2; exit}')"
    if [[ "${leap}" == "Normal" ]]; then
      synchronized="true"
    fi
  fi
elif command -v timedatectl >/dev/null 2>&1; then
  source="timedatectl"
  if timedatectl show -p NTPSynchronized --value 2>/dev/null | grep -qi yes; then
    synchronized="true"
  fi
fi

severity="unknown"
offset_ms=""
exit_code=2
if [[ -n "${offset_seconds}" ]]; then
  offset_ms="$(awk -v s="${offset_seconds}" 'BEGIN { printf "%.3f", (s < 0 ? -s : s) * 1000.0 }')"
  abs_ms="${offset_ms}"
  if awk -v a="${abs_ms}" -v ok="${OK_MS}" 'BEGIN { exit !(a+0 <= ok+0) }'; then
    severity="ok"
    exit_code=0
  elif awk -v a="${abs_ms}" -v warn="${WARN_MS}" 'BEGIN { exit !(a+0 <= warn+0) }'; then
    severity="warning"
    exit_code=1
  else
    severity="critical"
    exit_code=2
  fi
elif [[ "${synchronized}" == "true" ]]; then
  severity="warning"
  exit_code=1
fi

export TI_NODE_ROLE="${NODE_ROLE}"
export TI_SOURCE="${source}"
export TI_REFERENCE="${reference}"
export TI_SYNC="${synchronized}"
export TI_OFFSET_SECONDS="${offset_seconds}"
export TI_OFFSET_MS="${offset_ms}"
export TI_SEVERITY="${severity}"
export TI_OK_MS="${OK_MS}"
export TI_WARN_MS="${WARN_MS}"
export TI_OUT_JSON="${OUT_JSON}"

python3 - <<'PY'
import json, os
offset_raw = os.environ.get("TI_OFFSET_SECONDS") or ""
offset_ms_raw = os.environ.get("TI_OFFSET_MS") or ""
payload = {
  "node_role": os.environ.get("TI_NODE_ROLE", "asterisk-1"),
  "source": os.environ.get("TI_SOURCE", "unavailable"),
  "reference": (os.environ.get("TI_REFERENCE") or "unknown").strip() or "unknown",
  "synchronized": os.environ.get("TI_SYNC") == "true",
  "offset_seconds": None if offset_raw == "" else float(offset_raw),
  "offset_ms": None if offset_ms_raw == "" else float(offset_ms_raw),
  "severity": os.environ.get("TI_SEVERITY", "unknown"),
  "thresholds_ms": {
    "ok": float(os.environ.get("TI_OK_MS", "50")),
    "warn": float(os.environ.get("TI_WARN_MS", "200")),
  },
  "nodes": [
    {"role": "asterisk-1", "status": "configured"},
    {"role": "asterisk-2", "status": "architecture-ready"},
    {"role": "postgresql", "status": "documented"},
    {"role": "application", "status": "documented"},
  ],
}
out = os.environ["TI_OUT_JSON"]
with open(out, "w", encoding="utf-8") as fh:
    json.dump(payload, fh, indent=2)
    fh.write("\n")
print(
    f"AST-18 time integrity: severity={payload['severity']} "
    f"offset_ms={payload['offset_ms']} ref={payload['reference']} source={payload['source']}"
)
PY

exit "${exit_code}"
