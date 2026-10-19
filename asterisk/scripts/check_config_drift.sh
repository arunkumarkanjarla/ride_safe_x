#!/usr/bin/env bash
# Compare shared Git-managed Asterisk configuration with the live directory.
set -euo pipefail

GIT_REPO="${GIT_REPO:-/opt/asterisk}"
LIVE_DIR="${LIVE_DIR:-/etc/asterisk}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/asterisk-deployment}"
REPORT_FILE="${REPORT_FILE:-${DEPLOY_ROOT}/cluster/drift-report.json}"
PROM_TEXTFILE_DIR="${PROM_TEXTFILE_DIR:-}"

usage() {
  echo "Usage: $0 [--git-repo DIR] [--live-dir DIR] [--report-file FILE]"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --git-repo) GIT_REPO="${2:?--git-repo requires a directory}"; shift 2 ;;
    --live-dir) LIVE_DIR="${2:?--live-dir requires a directory}"; shift 2 ;;
    --report-file) REPORT_FILE="${2:?--report-file requires a path}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
done

[[ -d "${GIT_REPO}" ]] || { echo "Git configuration directory not found: ${GIT_REPO}" >&2; exit 2; }
[[ -d "${LIVE_DIR}" ]] || { echo "Live configuration directory not found: ${LIVE_DIR}" >&2; exit 2; }
command -v sha256sum >/dev/null 2>&1 || { echo "sha256sum is required" >&2; exit 2; }

is_excluded() {
  local path="$1" base
  base="$(basename "${path}")"
  case "${base}" in
    .git|.gitignore|.gitattributes|README|README.md|LICENSE|CHANGELOG.md|automated_update_asterisk_git_to_server.sh|node.env|astdb*|*.sqlite3|*.sqlite3-*|*.key|*.pem|*.crt|*.bak|*.bak-*|*.old|*.orig|*.swp|*~|*.md|*.sample)
      return 0 ;;
  esac
  # Mark a host-specific top-level config with either tag to exempt it.
  grep -qE '^[;#][[:space:]]*(JAPIT-NODE-LOCAL|AST-LOCAL-OVERLAY)\b' "${path}" 2>/dev/null
}

checksum() { sha256sum "$1" | awk '{print $1}'; }
json_escape() { sed 's/\\/\\\\/g; s/"/\\"/g'; }

declare -a missing changed extra
missing=() changed=() extra=()

while IFS= read -r -d '' source; do
  is_excluded "${source}" && continue
  base="$(basename "${source}")"
  live="${LIVE_DIR}/${base}"
  if [[ ! -f "${live}" ]]; then
    missing+=("${base}")
  elif [[ "$(checksum "${source}")" != "$(checksum "${live}")" ]]; then
    changed+=("${base}")
  fi
done < <(find "${GIT_REPO}" -maxdepth 1 -type f -print0)

while IFS= read -r -d '' live; do
  is_excluded "${live}" && continue
  base="$(basename "${live}")"
  [[ -f "${GIT_REPO}/${base}" ]] || extra+=("${base}")
done < <(find "${LIVE_DIR}" -maxdepth 1 -type f -print0)

mapfile -t missing < <(printf '%s\n' "${missing[@]}" | sed '/^$/d' | LC_ALL=C sort)
mapfile -t changed < <(printf '%s\n' "${changed[@]}" | sed '/^$/d' | LC_ALL=C sort)
mapfile -t extra < <(printf '%s\n' "${extra[@]}" | sed '/^$/d' | LC_ALL=C sort)

repo_checksum="$(CONFIG_DIR="${GIT_REPO}" bash "$(dirname "$0")/compute_config_checksum.sh")"
live_checksum="$(CONFIG_DIR="${LIVE_DIR}" bash "$(dirname "$0")/compute_config_checksum.sh")"
status="clean"
[[ "${#missing[@]}" -eq 0 && "${#changed[@]}" -eq 0 && "${#extra[@]}" -eq 0 ]] || status="drift"

array_json() {
  local item first=1
  printf '['
  for item in "$@"; do
    [[ "${first}" -eq 1 ]] || printf ','
    printf '"%s"' "$(printf '%s' "${item}" | json_escape)"
    first=0
  done
  printf ']'
}

mkdir -p "$(dirname "${REPORT_FILE}")"
tmp_report="$(mktemp "${REPORT_FILE}.XXXXXX")"
{
  printf '{"checked_at":"%s","hostname":"%s","status":"%s",' "$(date -u +%FT%TZ)" "$(hostname -f 2>/dev/null || hostname)" "${status}"
  printf '"git_repo":"%s","live_dir":"%s",' "$(printf '%s' "${GIT_REPO}" | json_escape)" "$(printf '%s' "${LIVE_DIR}" | json_escape)"
  printf '"repo_checksum":"%s","live_checksum":"%s",' "${repo_checksum}" "${live_checksum}"
  printf '"missing_live":'; array_json "${missing[@]}"
  printf ',"changed":'; array_json "${changed[@]}"
  printf ',"unmanaged_live":'; array_json "${extra[@]}"
  printf '}\n'
} >"${tmp_report}"
mv -f "${tmp_report}" "${REPORT_FILE}"

if [[ -n "${PROM_TEXTFILE_DIR}" ]]; then
  mkdir -p "${PROM_TEXTFILE_DIR}"
  tmp_prom="$(mktemp "${PROM_TEXTFILE_DIR}/asterisk_config_drift.prom.XXXXXX")"
  {
    echo "# HELP asterisk_config_drift Shared Asterisk configuration drift (1=drift)."
    echo "# TYPE asterisk_config_drift gauge"
    printf 'asterisk_config_drift %s\n' "$([[ "${status}" == clean ]] && echo 0 || echo 1)"
    printf 'asterisk_config_drift_files{type="missing"} %s\n' "${#missing[@]}"
    printf 'asterisk_config_drift_files{type="changed"} %s\n' "${#changed[@]}"
    printf 'asterisk_config_drift_files{type="unmanaged"} %s\n' "${#extra[@]}"
  } >"${tmp_prom}"
  mv -f "${tmp_prom}" "${PROM_TEXTFILE_DIR}/asterisk_config_drift.prom"
fi

if command -v logger >/dev/null 2>&1; then
  logger -t asterisk-config-drift "status=${status} missing=${#missing[@]} changed=${#changed[@]} unmanaged=${#extra[@]} report=${REPORT_FILE}"
fi
echo "Asterisk configuration ${status}; report: ${REPORT_FILE}"
[[ "${status}" == clean ]] && exit 0 || exit 1
