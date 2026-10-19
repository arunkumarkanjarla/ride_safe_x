#!/usr/bin/env bash
# Verify that the required configuration domains exist after a deployment.
set -euo pipefail

LIVE_DIR="${LIVE_DIR:-/etc/asterisk}"
ASTERISK_BIN="${ASTERISK_BIN:-asterisk}"
CHECK_CLI=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --live-dir) LIVE_DIR="${2:?--live-dir requires a directory}"; shift 2 ;;
    --no-cli) CHECK_CLI=0; shift ;;
    -h|--help)
      echo "Usage: $0 [--live-dir DIR] [--no-cli]"
      exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done

[[ -d "${LIVE_DIR}" ]] || { echo "Live configuration directory not found: ${LIVE_DIR}" >&2; exit 2; }

has_file() {
  local pattern
  for pattern in "$@"; do
    compgen -G "${LIVE_DIR}/${pattern}" >/dev/null && return 0
  done
  return 1
}

failed=0
check_domain() {
  local domain="$1"; shift
  if has_file "$@"; then
    echo "PASS ${domain}"
  else
    echo "FAIL ${domain}: expected one of $*" >&2
    failed=1
  fi
}

check_domain dialplan 'extensions.conf' 'extensions_*.conf' 'extensions-*.conf'
check_domain pjsip 'pjsip.conf' 'pjsip_*.conf' 'pjsip-*.conf'
check_domain odbc 'res_odbc.conf' 'res_odbc_*.conf' 'res_odbc-*.conf'
check_domain ami 'manager.conf' 'manager_*.conf' 'manager-*.conf'
check_domain queues 'queues.conf' 'queuerules.conf'
check_domain modules 'modules.conf'

if [[ "${CHECK_CLI}" -eq 1 ]]; then
  if command -v "${ASTERISK_BIN}" >/dev/null 2>&1 && "${ASTERISK_BIN}" -rx 'core show version' >/dev/null 2>&1; then
    echo "PASS asterisk-cli"
  else
    echo "FAIL asterisk-cli: core show version did not succeed" >&2
    failed=1
  fi
fi

exit "${failed}"
