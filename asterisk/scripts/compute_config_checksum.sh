#!/usr/bin/env bash
# Print one deterministic SHA-256 for the shared, top-level Asterisk config.
set -euo pipefail

CONFIG_DIR="${1:-${CONFIG_DIR:-/etc/asterisk}}"

[[ -d "${CONFIG_DIR}" ]] || { echo "Configuration directory not found: ${CONFIG_DIR}" >&2; exit 2; }
command -v sha256sum >/dev/null 2>&1 || { echo "sha256sum is required" >&2; exit 2; }

is_excluded() {
  local path="$1" base
  base="$(basename "${path}")"
  case "${base}" in
    astdb*|*.sqlite3|*.sqlite3-*|*.key|*.pem|*.crt|*.bak|*.bak-*|*.old|*.orig|*.swp|*~|*.md|*.sample|node.env)
      return 0 ;;
  esac
  [[ "${base}" == "automated_update_asterisk_git_to_server.sh" ]] && return 0
  grep -qE '^[;#][[:space:]]*(JAPIT-NODE-LOCAL|AST-LOCAL-OVERLAY)\b' "${path}" 2>/dev/null
}

while IFS= read -r -d '' file; do
  is_excluded "${file}" && continue
  base="$(basename "${file}")"
  digest="$(sha256sum "${file}" | awk '{print $1}')"
  printf '%s  %s\n' "${digest}" "${base}"
done < <(find "${CONFIG_DIR}" -maxdepth 1 -type f -print0) |
  LC_ALL=C sort -k2 |
  sha256sum |
  awk '{print $1}'
