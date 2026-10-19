#!/usr/bin/env bash
# AST-11: Validate shared media paths for a single Asterisk node (or both peers in staging).
# Does not create NFS/SMB; verifies mounts, permissions, and path consistency.
set -euo pipefail

AST_USER="${AST_USER:-asterisk}"
REQUIRE_MOUNT="${REQUIRE_MOUNT:-false}"
STRICT="${STRICT:-false}"
REPORT_JSON="${REPORT_JSON:-}"

MONITOR="${SHARED_MONITOR:-/var/spool/asterisk/monitor}"
SOUNDS="${SHARED_SOUNDS:-/var/lib/asterisk/sounds}"
MOH="${SHARED_MOH:-/var/lib/asterisk/moh}"
PROMPTS="${SHARED_PROMPTS:-/var/lib/asterisk/prompts}"
VOICEMAIL="${SHARED_VOICEMAIL:-/var/spool/asterisk/voicemail}"
KEYS="${SHARED_KEYS:-/etc/asterisk/keys}"
AGI_BIN="${SHARED_AGI_BIN:-/var/lib/asterisk/agi-bin}"
RECORDINGS_FINAL="${RECORDING_LOCAL_ROOT:-/opt/recordings}"

failures=0
warnings=0
declare -a results=()

_check_path() {
  local label="$1" path="$2" mode="$3" # mode: rw|ro
  local status="ok" detail=""
  if [[ ! -e "${path}" ]]; then
    status="missing"
    detail="path does not exist"
    failures=$((failures + 1))
  elif [[ ! -d "${path}" ]]; then
    status="not_directory"
    detail="expected directory"
    failures=$((failures + 1))
  else
    if [[ "${REQUIRE_MOUNT}" == "true" ]] && ! mountpoint -q "${path}" 2>/dev/null; then
      # Parent spool may be the mount; accept if any ancestor is a mountpoint.
      local cur="${path}" mounted=false
      while [[ "${cur}" != "/" ]]; do
        if mountpoint -q "${cur}" 2>/dev/null; then
          mounted=true
          break
        fi
        cur="$(dirname "${cur}")"
      done
      if [[ "${mounted}" != "true" ]]; then
        status="not_mounted"
        detail="REQUIRE_MOUNT=true and path is not on a mount"
        failures=$((failures + 1))
      fi
    fi
    if [[ "${status}" == "ok" ]]; then
      if [[ "${mode}" == "rw" ]]; then
        if [[ ! -w "${path}" ]]; then
          status="not_writable"
          detail="expected write access for ${AST_USER}/current user"
          failures=$((failures + 1))
        else
          local probe="${path}/.japit-shared-media-probe.$$"
          if ! (umask 0022; : >"${probe}" && rm -f "${probe}") 2>/dev/null; then
            status="write_probe_failed"
            detail="create/remove probe file failed"
            failures=$((failures + 1))
          fi
        fi
      elif [[ ! -r "${path}" ]]; then
        status="not_readable"
        detail="expected read access"
        failures=$((failures + 1))
      fi
    fi
  fi
  results+=("${label}|${path}|${status}|${detail}")
  printf '%-14s %-42s %s %s\n' "${label}" "${path}" "${status}" "${detail}"
}

echo "== AST-11 shared media validation =="
_check_path "monitor" "${MONITOR}" "rw"
_check_path "sounds" "${SOUNDS}" "ro"
_check_path "moh" "${MOH}" "ro"
_check_path "prompts" "${PROMPTS}" "ro"
_check_path "voicemail" "${VOICEMAIL}" "rw"
_check_path "keys" "${KEYS}" "ro"
_check_path "agi-bin" "${AGI_BIN}" "ro"
_check_path "recordings" "${RECORDINGS_FINAL}" "rw"

# Path consistency: MixMonitor spool vs finalized archive must both exist.
if [[ -d "${MONITOR}" && -d "${RECORDINGS_FINAL}" ]]; then
  echo "path_consistency: monitor=${MONITOR} recordings=${RECORDINGS_FINAL} OK"
else
  echo "path_consistency: FAIL monitor or recordings root missing"
  failures=$((failures + 1))
fi

# Certificate presence (do not print private keys).
if [[ -d "${KEYS}" ]]; then
  cert_count="$(find "${KEYS}" -type f \( -name '*.pem' -o -name '*.crt' -o -name '*.key' \) 2>/dev/null | wc -l | tr -d ' ')"
  if [[ "${cert_count}" == "0" ]]; then
    echo "certificates: WARN no .pem/.crt/.key under ${KEYS} (staging may defer)"
    warnings=$((warnings + 1))
    if [[ "${STRICT}" == "true" ]]; then
      failures=$((failures + 1))
    fi
  else
    echo "certificates: found ${cert_count} key/cert files under ${KEYS}"
  fi
fi

if [[ -n "${REPORT_JSON}" ]]; then
  {
    echo '{'
    echo "  \"failures\": ${failures},"
    echo "  \"warnings\": ${warnings},"
    echo '  "checks": ['
    local i=0
    for row in "${results[@]}"; do
      IFS='|' read -r label path status detail <<<"${row}"
      [[ ${i} -gt 0 ]] && echo ','
      printf '    {"label":"%s","path":"%s","status":"%s","detail":"%s"}' \
        "${label}" "${path}" "${status}" "${detail//\"/\\\"}"
      i=$((i + 1))
    done
    echo
    echo '  ]'
    echo '}'
  } >"${REPORT_JSON}"
fi

echo "summary: failures=${failures} warnings=${warnings}"
[[ "${failures}" -eq 0 ]]
