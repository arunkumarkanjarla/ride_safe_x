#!/usr/bin/env bash
# Exit zero only when this node is safe to own the SIP VIP.
set -euo pipefail

[[ -r /etc/default/japit-keepalived ]] && source /etc/default/japit-keepalived
AST_BIN="${AST_BIN:-/usr/sbin/asterisk}"
REQUIRE_AMI="${REQUIRE_AMI:-false}"
AMI_HOST="${AMI_HOST:-127.0.0.1}"
AMI_PORT="${AMI_PORT:-5038}"
REQUIRE_ODBC="${REQUIRE_ODBC:-true}"
DB_PROBE_COMMAND="${DB_PROBE_COMMAND:-}"
SHARED_STORAGE_PATH="${SHARED_STORAGE_PATH:-/var/spool/asterisk}"
MIN_FREE_MB="${MIN_FREE_MB:-1024}"
MAX_CPU_LOAD_PER_CORE="${MAX_CPU_LOAD_PER_CORE:-4.0}"
MIN_AVAILABLE_MEM_MB="${MIN_AVAILABLE_MEM_MB:-512}"

systemctl is-active --quiet asterisk || pgrep -x asterisk >/dev/null
"${AST_BIN}" -rx "core show uptime" >/dev/null 2>&1

if [[ "${REQUIRE_AMI}" == "true" ]]; then
  timeout 2 bash -c ":</dev/tcp/${AMI_HOST}/${AMI_PORT}"
fi
if [[ "${REQUIRE_ODBC}" == "true" ]]; then
  "${AST_BIN}" -rx "odbc show" 2>/dev/null | grep -Eqi 'connected|yes'
fi
if [[ -n "${DB_PROBE_COMMAND}" ]]; then
  timeout 3 bash -c "${DB_PROBE_COMMAND}"
fi
mountpoint -q "${SHARED_STORAGE_PATH}"

free_mb="$(df -Pm "${SHARED_STORAGE_PATH}" | awk 'NR==2 {print $4}')"
[[ "${free_mb:-0}" -ge "${MIN_FREE_MB}" ]]
available_mb="$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)"
[[ "${available_mb:-0}" -ge "${MIN_AVAILABLE_MEM_MB}" ]]
cores="$(nproc)"
load1="$(awk '{print $1}' /proc/loadavg)"
awk -v load="${load1}" -v cores="${cores}" -v max="${MAX_CPU_LOAD_PER_CORE}" \
  'BEGIN { exit (load <= cores * max) ? 0 : 1 }'
