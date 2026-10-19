#!/usr/bin/env bash
# AST-14 — Sync emergency number policy into Asterisk ASTDB.
# Reads EMERGENCY_NUMBERS / EMERGENCY_STAGING_NUMBERS (comma-separated).
# Safe to run on Asterisk-1 and Asterisk-2 independently.

set -euo pipefail

NUMBERS="${EMERGENCY_NUMBERS:-112,100,101,102,108}"
STAGING="${EMERGENCY_STAGING_NUMBERS:-9339112}"
CLI="${EMERGENCY_CLI:-}"
CLI_FALLBACK="${EMERGENCY_CLI_FALLBACK:-}"
TRUNK="${EMERGENCY_TRUNK:-}"
NODE="${JAPIT_EMERGENCY_NODE:-asterisk-1}"
ENABLED="${EMERGENCY_ROUTING_ENABLED:-yes}"

if ! command -v asterisk >/dev/null 2>&1; then
  echo "asterisk CLI not found; dry-run only"
  DRY=1
else
  DRY=0
fi

run() {
  if [[ "${DRY}" == "1" ]]; then
    echo "DRY: $*"
  else
    asterisk -rx "$*"
  fi
}

# Clear previous keys (family).
run "database deltree japit/emergency"
run "database deltree japit/emergency-staging"

IFS=',' read -ra RAW <<< "${NUMBERS}"
for n in "${RAW[@]}"; do
  digits="$(echo "${n}" | tr -cd '0-9')"
  [[ -z "${digits}" ]] && continue
  run "database put japit/emergency ${digits} 1"
done

IFS=',' read -ra STAGE <<< "${STAGING}"
for n in "${STAGE[@]}"; do
  digits="$(echo "${n}" | tr -cd '0-9')"
  [[ -z "${digits}" ]] && continue
  run "database put japit/emergency ${digits} 1"
  run "database put japit/emergency-staging ${digits} 1"
done

# Globals consumed by extensions_japit_emergency.conf
run "dialplan set global JAPIT_EMERGENCY_ENABLED ${ENABLED}"
[[ -n "${TRUNK}" ]] && run "dialplan set global JAPIT_EMERGENCY_TRUNK ${TRUNK}"
[[ -n "${CLI}" ]] && run "dialplan set global JAPIT_EMERGENCY_CLI ${CLI}"
[[ -n "${CLI_FALLBACK}" ]] && run "dialplan set global JAPIT_EMERGENCY_CLI_FALLBACK ${CLI_FALLBACK}"
run "dialplan set global JAPIT_EMERGENCY_NODE ${NODE}"

echo "AST-14 emergency ASTDB sync complete (node=${NODE})"
