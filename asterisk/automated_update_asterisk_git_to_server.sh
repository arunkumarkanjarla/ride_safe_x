#!/usr/bin/env bash
# =============================================================================
# automated_update_asterisk_git_to_server.sh
# -----------------------------------------------------------------------------
# Production-grade Asterisk config deploy from Git → /etc/asterisk
#
# Git repo (source of truth):  /opt/asterisk
# Deployment workspace:        /opt/asterisk-deployment
# Live config:                 /etc/asterisk
#
# Features:
#   - Branch select + git pull --ff-only
#   - Change detection (git vs live /etc/asterisk)
#   - Intelligent reload mapping (Asterisk 18 + 22 friendly)
#   - FULL /etc/asterisk backup before apply (not only changed files)
#   - Pre-reload validation + auto-rollback on failure
#   - Per-backup metadata + rollback.sh
#   - Symlinks: backups/latest and backups/previous
#   - Dry-run mode, retention (default 90), colorized logs
#
# Usage:
#   sudo ./automated_update_asterisk_git_to_server.sh [branch]
#   sudo ./automated_update_asterisk_git_to_server.sh --dry-run [--no-pull] [branch]
#   sudo ./automated_update_asterisk_git_to_server.sh --help
#
# Does NOT push to remotes.
# =============================================================================

set -euo pipefail

# ----------------------------- defaults --------------------------------------
GIT_REPO="${GIT_REPO:-/opt/asterisk}"
LIVE_DIR="${LIVE_DIR:-/etc/asterisk}"
DEPLOY_ROOT="${DEPLOY_ROOT:-/opt/asterisk-deployment}"
BACKUP_ROOT="${DEPLOY_ROOT}/backups"
LOG_DIR="${DEPLOY_ROOT}/logs"
TEMP_DIR="${DEPLOY_ROOT}/temp"
HISTORY_LOG="${LOG_DIR}/deployment_history.log"
ERROR_LOG="${LOG_DIR}/deployment_error.log"

DEFAULT_BRANCH="${DEFAULT_BRANCH:-main}"
BACKUP_RETENTION="${BACKUP_RETENTION:-90}"   # keep N newest timestamped backups
ASTERISK_BIN="${ASTERISK_BIN:-asterisk}"
DRY_RUN=0
SKIP_PULL=0
BRANCH=""
LIVE_OWNER_GROUP=""   # detected from LIVE_DIR (e.g. root:asterisk)

# Files / patterns never copied from git → live
EXCLUDE_NAMES=(
  ".git" ".gitignore" ".gitattributes" "README.md" "README"
  "LICENSE" "CHANGELOG.md" ".DS_Store"
  "automated_update_asterisk_git_to_server.sh"
  "keys"
)

# ----------------------------- colors ----------------------------------------
if [[ -t 1 ]]; then
  C_RESET=$'\033[0m'
  C_BOLD=$'\033[1m'
  C_DIM=$'\033[2m'
  C_RED=$'\033[31m'
  C_GRN=$'\033[32m'
  C_YEL=$'\033[33m'
  C_CYN=$'\033[36m'
else
  C_RESET=""; C_BOLD=""; C_DIM=""; C_RED=""; C_GRN=""; C_YEL=""; C_CYN=""
fi

log()   { printf '%s%s%s\n' "${C_DIM}" "$*" "${C_RESET}"; }
info()  { printf '%s%s%s\n' "${C_CYN}" "$*" "${C_RESET}"; }
ok()    { printf '%s%s%s\n' "${C_GRN}" "$*" "${C_RESET}"; }
warn()  { printf '%s%s%s\n' "${C_YEL}" "$*" "${C_RESET}"; }
err()   { printf '%s%s%s\n' "${C_RED}" "$*" "${C_RESET}" >&2; }

die() {
  err "ERROR: $*"
  printf '%s | %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >>"${ERROR_LOG}" 2>/dev/null || true
  exit 1
}

usage() {
  cat <<EOF
${C_BOLD}Asterisk Git → Server Deploy${C_RESET}

Usage:
  sudo $0 [options] [branch]

Options:
  --dry-run       Show what would change; do not copy, reload, or write backups
  --no-pull       Do not git fetch/pull (use current local checkout only)
  --retention N   Keep N newest backups (default: ${BACKUP_RETENTION})
  -h, --help      Show this help

Recommended first tests (safe):
  sudo $0 --dry-run --no-pull develop
  sudo $0 --dry-run develop

Paths:
  Git repo:     ${GIT_REPO}
  Live config:  ${LIVE_DIR}
  Deploy root:  ${DEPLOY_ROOT}
EOF
}

# ----------------------------- args ------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --no-pull) SKIP_PULL=1; shift ;;
    --retention)
      BACKUP_RETENTION="${2:-}"
      [[ "${BACKUP_RETENTION}" =~ ^[0-9]+$ ]] || die "--retention needs a number"
      shift 2
      ;;
    -h|--help) usage; exit 0 ;;
    -*)
      die "Unknown option: $1"
      ;;
    *)
      if [[ -n "${BRANCH}" ]]; then
        die "Unexpected extra argument: $1"
      fi
      BRANCH="$1"
      shift
      ;;
  esac
done
BRANCH="${BRANCH:-${DEFAULT_BRANCH}}"

# ----------------------------- preflight -------------------------------------
need_cmd() { command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"; }

need_cmd git
need_cmd rsync
need_cmd awk
need_cmd date
need_cmd ln
need_cmd find
need_cmd stat
need_cmd cmp

[[ "$(id -u)" -eq 0 ]] || die "Run as root (sudo). Live files are under ${LIVE_DIR}"
[[ -d "${GIT_REPO}/.git" ]] || die "Not a git repo: ${GIT_REPO}"
[[ -d "${LIVE_DIR}" ]] || die "Live Asterisk dir missing: ${LIVE_DIR}"

mkdir -p "${BACKUP_ROOT}" "${LOG_DIR}" "${TEMP_DIR}"
touch "${HISTORY_LOG}" "${ERROR_LOG}"

# Detect ownership from live dir (portable across hosts)
LIVE_OWNER_GROUP="$(stat -c '%U:%G' "${LIVE_DIR}" 2>/dev/null || echo 'root:root')"
ok "Live ownership detected: ${LIVE_OWNER_GROUP} (from ${LIVE_DIR})"

HOST_SHORT="$(hostname -s 2>/dev/null || hostname)"
DEPLOY_USER="${SUDO_USER:-${USER:-root}}"
TS_HUMAN="$(date '+%Y-%m-%d %H:%M:%S')"
if date +%N >/dev/null 2>&1; then
  TS_FILE="$(date '+%Y%m%d_%H%M%S')_$(date +%N | cut -c1-3)"
  TS_HUMAN_MS="$(date '+%Y-%m-%d %H:%M:%S').$(date +%N | cut -c1-3)"
else
  TS_FILE="$(date '+%Y%m%d_%H%M%S')_000"
  TS_HUMAN_MS="${TS_HUMAN}.000"
fi
BACKUP_NAME="etc_asterisk_backup_${TS_FILE}"
BACKUP_DIR="${BACKUP_ROOT}/${BACKUP_NAME}"

# Track files with no reload mapping (warnings only)
UNMAPPED_FILES=()

# ----------------------------- reload map ------------------------------------
# Echo zero or more CLI commands (one per line) for a config basename.
# Uses [[ ]] patterns — bash 'case' globs like extensions_*.conf do NOT work.
reload_cmds_for() {
  local base="$1"

  # Dialplan
  if [[ "${base}" == "extensions.conf" \
     || "${base}" == extensions_* \
     || "${base}" == extensions-* \
     || "${base}" == *.ael \
     || "${base}" == *.lua ]]; then
    echo 'dialplan reload'
    return 0
  fi

  # PJSIP — single command on Asterisk 18 and 22
  if [[ "${base}" == "pjsip.conf" \
     || "${base}" == pjsip_* \
     || "${base}" == pjsip-* ]]; then
    echo 'pjsip reload'
    return 0
  fi

  # Manager / AMI
  if [[ "${base}" == "manager.conf" || "${base}" == manager_* ]]; then
    echo 'manager reload'
    return 0
  fi

  # HTTP — prefer CLI "http reload" (not module reload http)
  if [[ "${base}" == "http.conf" ]]; then
    echo 'module reload http'
    return 0
  fi

  # ARI
  if [[ "${base}" == "ari.conf" || "${base}" == ari_* ]]; then
    echo 'module reload res_ari.so'
    return 0
  fi

  # Queues — 'queue reload all' works on common 18/22 builds; verify once in your lab.
  if [[ "${base}" == "queues.conf" ]]; then
    echo 'queue reload all'
    return 0
  fi

  if [[ "${base}" == "musiconhold.conf" ]]; then
    echo 'moh reload'
    return 0
  fi

  if [[ "${base}" == "features.conf" ]]; then
    echo 'features reload'
    return 0
  fi

  if [[ "${base}" == "voicemail.conf" ]]; then
    echo 'voicemail reload'
    return 0
  fi

  if [[ "${base}" == "sip.conf" || "${base}" == sip_* || "${base}" == sip-* ]]; then
    echo 'sip reload'
    return 0
  fi

  if [[ "${base}" == "iax.conf" ]]; then
    echo 'iax2 reload'
    return 0
  fi

  if [[ "${base}" == "rtp.conf" ]]; then
    echo 'module reload res_rtp_asterisk.so'
    return 0
  fi

  if [[ "${base}" == "cdr.conf" || "${base}" == cdr_* ]]; then
    echo 'module reload app_cdr.so'
    return 0
  fi

  if [[ "${base}" == "cel.conf" || "${base}" == cel_* ]]; then
    echo 'module reload app_cel.so'
    return 0
  fi

  if [[ "${base}" == "confbridge.conf" ]]; then
    echo 'module reload app_confbridge.so'
    return 0
  fi

  if [[ "${base}" == "indications.conf" ]]; then
    echo 'module reload res_indications.so'
    return 0
  fi

  if [[ "${base}" == "res_odbc.conf" || "${base}" == res_odbc_* \
     || "${base}" == "func_odbc.conf" || "${base}" == func_odbc_* \
     || "${base}" == "extconfig.conf" || "${base}" == extconfig_* \
     || "${base}" == "sorcery.conf" || "${base}" == sorcery_* ]]; then
    echo 'module reload res_odbc.so'
    echo 'module reload res_config_odbc.so'
    echo 'module reload func_odbc.so'
    echo 'dialplan reload'
    return 0
  fi

  if [[ "${base}" == "modules.conf" || "${base}" == "asterisk.conf" ]]; then
    warn "  NOTE: ${base} usually needs Asterisk process restart (not auto-reloaded)."
    return 0
  fi

  # Unknown — warn only, do NOT emit a no-op CLI command
  warn "  WARNING: No reload mapping found for ${base}"
  UNMAPPED_FILES+=("${base}")
  return 0
}

dedupe_lines() {
  awk 'NF && !seen[$0]++'
}

# ----------------------------- helpers ---------------------------------------
is_excluded() {
  local name="$1"
  local x
  for x in "${EXCLUDE_NAMES[@]}"; do
    [[ "${name}" == "${x}" ]] && return 0
  done
  case "${name}" in
    *.bak|*.bak-*|*.old|*.orig|*.swp|*~|*.pem|*.key|*.crt|astdb*|*.sqlite3*|*.md)
      return 0
      ;;
  esac
  return 1
}

list_repo_files() {
  find "${GIT_REPO}" -maxdepth 1 -type f -printf '%f\n' | LC_ALL=C sort
}

files_differ() {
  local src="$1" dst="$2"
  if [[ ! -f "${dst}" ]]; then
    return 0
  fi
  ! cmp -s "${src}" "${dst}"
}

apply_ownership() {
  local path="$1"
  chown "${LIVE_OWNER_GROUP}" "${path}" 2>/dev/null || chown root:root "${path}" || true
  # Prefer restrictive mode for conf files
  if [[ -f "${path}" ]]; then
    chmod 640 "${path}" 2>/dev/null || true
  fi
}

asterisk_rx() {
  local cmd="$1"
  if [[ "${DRY_RUN}" -eq 1 ]]; then
    info "  [dry-run] asterisk -rx \"${cmd}\""
    return 0
  fi
  if ! ${ASTERISK_BIN} -rx "${cmd}"; then
    warn "  Reload command failed: ${cmd}"
    return 1
  fi
  return 0
}

asterisk_alive() {
  ${ASTERISK_BIN} -rx "core show version" >/dev/null 2>&1
}

# Full tree backup of live /etc/asterisk into backup/etc_asterisk/
full_backup_live_dir() {
  local dest="$1"
  mkdir -p "${dest}"
  rsync -a \
    --exclude 'astdb*' \
    --exclude '*.sqlite3' \
    --exclude '*.sqlite3-*' \
    --exclude 'keys/' \
    "${LIVE_DIR}/" "${dest}/"
}

update_symlinks() {
  local new_backup="$1"
  local latest_link="${BACKUP_ROOT}/latest"
  local previous_link="${BACKUP_ROOT}/previous"

  if [[ "${DRY_RUN}" -eq 1 ]]; then
    info "[dry-run] Would update symlinks latest → ${new_backup}"
    return 0
  fi

  if [[ -L "${latest_link}" ]]; then
    local old_target
    old_target="$(readlink -f "${latest_link}" 2>/dev/null || true)"
    if [[ -n "${old_target}" && -d "${old_target}" && "${old_target}" != "$(readlink -f "${new_backup}")" ]]; then
      ln -sfn "${old_target}" "${previous_link}"
    fi
  fi
  ln -sfn "${new_backup}" "${latest_link}"
}

prune_backups() {
  [[ "${BACKUP_RETENTION}" -gt 0 ]] || return 0
  [[ "${DRY_RUN}" -eq 1 ]] && return 0
  mapfile -t all_b < <(find "${BACKUP_ROOT}" -maxdepth 1 -type d -name 'etc_asterisk_backup_*' | LC_ALL=C sort -r)
  local i=0 d
  for d in "${all_b[@]}"; do
    i=$((i + 1))
    if [[ "${i}" -gt "${BACKUP_RETENTION}" ]]; then
      warn "Pruning old backup: ${d}"
      rm -rf "${d}"
    fi
  done
}

# ----------------------------- validation ------------------------------------
# Reliable NUL detection. DO NOT use: grep -q $'\0'  (GNU grep false-positive:
# the pattern is C-string truncated at NUL, so almost every text file "matches").
file_has_nul() {
  local path="$1"
  local orig stripped
  orig=$(wc -c <"${path}")
  stripped=$(tr -d '\0' <"${path}" | wc -c)
  [[ "${orig}" -ne "${stripped}" ]]
}

# Validate Git source files BEFORE backup/copy. Abort early — live tree untouched.
validate_git_sources() {
  local -a changed=("$@")
  local f path

  info "Validating Git source files (before backup/copy)..."

  for f in "${changed[@]}"; do
    path="${GIT_REPO}/${f}"
    if [[ ! -f "${path}" ]]; then
      err "  Missing in git repo: ${path}"
      return 1
    fi
    if [[ ! -s "${path}" ]]; then
      err "  Empty git source (refusing deploy): ${path}"
      return 1
    fi
    if file_has_nul "${path}"; then
      err "  NUL byte in git source (refusing deploy): ${path}"
      return 1
    fi
    # Dialplan soft check
    if [[ "${f}" == "extensions.conf" || "${f}" == extensions_* || "${f}" == extensions-* ]]; then
      if ! grep -qE '^\[.+\]' "${path}"; then
        warn "  ${f}: no [context] headers found — verify this is intentional"
      fi
    fi
    ok "  ok ${f}"
  done

  ok "Git source validation passed"
  return 0
}

# After copy, before reload: confirm live files landed + Asterisk CLI up.
# On failure, caller should auto-rollback.
validate_before_reload() {
  local -a changed=("$@")
  local f path

  info "Validating live copies before reload..."

  if ! asterisk_alive; then
    err "Asterisk is not responding to CLI (core show version)."
    return 1
  fi
  ok "  Asterisk CLI is responsive"

  for f in "${changed[@]}"; do
    path="${LIVE_DIR}/${f}"
    if [[ ! -f "${path}" ]]; then
      err "  Missing after copy: ${path}"
      return 1
    fi
    if [[ ! -s "${path}" ]]; then
      err "  Empty file after copy (refusing reload): ${path}"
      return 1
    fi
    if file_has_nul "${path}"; then
      err "  NUL byte in live config (refusing reload): ${path}"
      return 1
    fi
    ok "  ok ${f}"
  done

  ok "Pre-reload validation passed"
  return 0
}

auto_rollback_from_backup() {
  local reason="$1"
  err "AUTO-ROLLBACK: ${reason}"
  if [[ -x "${BACKUP_DIR}/rollback.sh" ]]; then
    # Ensure ownership var is visible to child if needed
    LIVE_DIR="${LIVE_DIR}" LIVE_OWNER_GROUP="${LIVE_OWNER_GROUP}" \
      bash "${BACKUP_DIR}/rollback.sh" || err "Auto-rollback script reported errors"
  else
    err "No rollback.sh at ${BACKUP_DIR} — manual restore required"
  fi
}

write_backup_metadata() {
  local backup_dir="$1"
  local old_commit="$2"
  local new_commit="$3"
  local branch="$4"
  local result="$5"
  shift 5
  local -a changed=("$@")

  mkdir -p "${backup_dir}/etc_asterisk"

  {
    if [[ "${#changed[@]}" -eq 0 ]]; then
      echo "(none)"
    else
      printf '%s\n' "${changed[@]}"
    fi
  } >"${backup_dir}/changed_files.txt"

  {
    local f
    for f in "${changed[@]}"; do
      reload_cmds_for "$(basename "${f}")"
    done
  } | dedupe_lines >"${backup_dir}/reload_commands.txt" || true

  cat >"${backup_dir}/git_commit.txt" <<EOF
OLD_COMMIT=${old_commit}
NEW_COMMIT=${new_commit}
BRANCH=${branch}
DEPLOYED_BY=${DEPLOY_USER}
DATE=${TS_HUMAN_MS}
HOST=${HOST_SHORT}
RESULT=${result}
LIVE_OWNER_GROUP=${LIVE_OWNER_GROUP}
BACKUP_TYPE=full_etc_asterisk
EOF

  {
    echo "========================================================="
    echo "ASTERISK GIT DEPLOYMENT"
    echo "========================================================="
    echo
    echo "Date"
    echo "-------"
    echo "${TS_HUMAN_MS}"
    echo
    echo "Server"
    echo "-------"
    echo "${HOST_SHORT}"
    echo
    echo "User"
    echo "-------"
    echo "${DEPLOY_USER}"
    echo
    echo "Branch"
    echo "-------"
    echo "${branch}"
    echo
    echo "Old Commit"
    echo "-------"
    echo "${old_commit}"
    echo
    echo "New Commit"
    echo "-------"
    echo "${new_commit}"
    echo
    echo "Ownership"
    echo "-------"
    echo "${LIVE_OWNER_GROUP}"
    echo
    echo "Changed Files"
    echo "--------------"
    if [[ "${#changed[@]}" -eq 0 ]]; then
      echo "(none)"
    else
      printf '%s\n' "${changed[@]}"
    fi
    echo
    echo "Files Copied"
    echo "--------------"
    if [[ "${#changed[@]}" -eq 0 ]]; then
      echo "(none)"
    else
      printf '%s\n' "${changed[@]}"
    fi
    echo
    echo "Reload Commands"
    echo "----------------"
    if [[ -s "${backup_dir}/reload_commands.txt" ]]; then
      cat "${backup_dir}/reload_commands.txt"
    else
      echo "(none)"
    fi
    echo
    echo "Result"
    echo "--------"
    echo "${result}"
    echo
    echo "Live dir: ${LIVE_DIR}"
    echo "Git repo: ${GIT_REPO}"
    echo "Backup:   ${backup_dir}"
    echo "Backup type: FULL /etc/asterisk snapshot (minus astdb/keys)"
  } >"${backup_dir}/deployment.log"

  # Per-backup rollback — restores FULL snapshot under etc_asterisk/
  cat >"${backup_dir}/rollback.sh" <<EOS
#!/usr/bin/env bash
set -euo pipefail
HERE="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
SRC="\${HERE}/etc_asterisk"
LIVE="\${LIVE_DIR:-/etc/asterisk}"
ASTERISK_BIN="\${ASTERISK_BIN:-asterisk}"
OWNER_GROUP="\${LIVE_OWNER_GROUP:-$(printf '%q' "${LIVE_OWNER_GROUP}")}"

[[ "\$(id -u)" -eq 0 ]] || { echo "Run as root"; exit 1; }
[[ -d "\${SRC}" ]] || { echo "Missing \${SRC}"; exit 1; }

echo "Rolling back FULL snapshot from: \${HERE}"
echo "Restoring into: \${LIVE}"
echo "Ownership: \${OWNER_GROUP}"

# Restore all regular files from the snapshot (full backup)
while IFS= read -r -d '' f; do
  rel="\${f#\${SRC}/}"
  dest="\${LIVE}/\${rel}"
  mkdir -p "\$(dirname "\${dest}")"
  cp -a "\${f}" "\${dest}"
  chown "\${OWNER_GROUP}" "\${dest}" 2>/dev/null || chown root:root "\${dest}" || true
  chmod 640 "\${dest}" 2>/dev/null || true
  echo "  restored \${rel}"
done < <(find "\${SRC}" -type f -print0)

if [[ -f "\${HERE}/reload_commands.txt" ]]; then
  echo "Executing reload commands..."
  while IFS= read -r cmd || [[ -n "\${cmd}" ]]; do
    [[ -z "\${cmd}" ]] && continue
    echo "  asterisk -rx \"\${cmd}\""
    \${ASTERISK_BIN} -rx "\${cmd}" || echo "  WARN: failed: \${cmd}"
  done < "\${HERE}/reload_commands.txt"
fi

echo "Rollback complete."
EOS
  chmod 755 "${backup_dir}/rollback.sh"
}

# ----------------------------- git -------------------------------------------
cd "${GIT_REPO}"

OLD_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

info "========================================================="
info " ASTERISK GIT DEPLOYMENT"
info "========================================================="
log  "Server : ${HOST_SHORT}"
log  "User   : ${DEPLOY_USER}"
log  "Repo   : ${GIT_REPO}"
log  "Live   : ${LIVE_DIR}"
log  "Owner  : ${LIVE_OWNER_GROUP}"
log  "Branch : ${BRANCH}"
log  "Mode   : $([[ ${DRY_RUN} -eq 1 ]] && echo DRY-RUN || echo APPLY)"
log  "Retain : ${BACKUP_RETENTION} backups"
log  "Commit : ${OLD_COMMIT} (before)"
echo

if [[ "${SKIP_PULL}" -eq 0 ]]; then
  if [[ "${DRY_RUN}" -eq 1 ]]; then
    info "[dry-run] Would: git fetch origin && git checkout ${BRANCH} && git pull --ff-only origin ${BRANCH}"
  else
    info "Fetching / updating branch ${BRANCH}..."
    git fetch origin --prune || warn "git fetch failed (continuing with local state)"
    git checkout "${BRANCH}" || die "Cannot checkout branch ${BRANCH}"
    if git rev-parse --verify "origin/${BRANCH}" >/dev/null 2>&1; then
      git pull --ff-only "origin" "${BRANCH}" || die "git pull --ff-only failed for ${BRANCH}"
    else
      warn "No origin/${BRANCH} — using local branch only"
    fi
  fi
else
  warn "Skipping git pull (--no-pull)"
  git checkout "${BRANCH}" 2>/dev/null || warn "Could not checkout ${BRANCH} (continuing on current HEAD)"
fi

NEW_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
ok "Git HEAD: ${NEW_COMMIT}"

# ----------------------------- detect changes --------------------------------
CHANGED=()
mapfile -t REPO_FILES < <(list_repo_files)

for base in "${REPO_FILES[@]}"; do
  is_excluded "${base}" && continue
  src="${GIT_REPO}/${base}"
  dst="${LIVE_DIR}/${base}"
  [[ -f "${src}" ]] || continue
  if files_differ "${src}" "${dst}"; then
    CHANGED+=("${base}")
  fi
done

echo
info "Changed files (${#CHANGED[@]}):"
if [[ "${#CHANGED[@]}" -eq 0 ]]; then
  ok "  (none) — live /etc/asterisk already matches git working tree for tracked config files."
else
  for f in "${CHANGED[@]}"; do
    printf '  %s%s%s\n' "${C_BOLD}" "${f}" "${C_RESET}"
  done
fi

# Reload plan (avoid piping reload_cmds_for into a subshell so UNMAPPED_FILES sticks)
UNMAPPED_FILES=()
RELOADS=()
if [[ "${#CHANGED[@]}" -gt 0 ]]; then
  _reload_tmp="$(mktemp "${TEMP_DIR}/reloads.XXXXXX")"
  for f in "${CHANGED[@]}"; do
    reload_cmds_for "${f}" >>"${_reload_tmp}"
  done
  mapfile -t RELOADS < <(dedupe_lines <"${_reload_tmp}" || true)
  rm -f "${_reload_tmp}"
fi

echo
info "Reload commands:"
if [[ "${#RELOADS[@]}" -eq 0 ]]; then
  log "  (none)"
else
  for c in "${RELOADS[@]}"; do
    echo "  asterisk -rx \"${c}\""
  done
fi

if [[ "${#UNMAPPED_FILES[@]}" -gt 0 ]]; then
  echo
  warn "Unmapped files (copied but no automatic reload):"
  for f in "${UNMAPPED_FILES[@]}"; do
    warn "  - ${f}"
  done
fi

if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo
  warn "DRY-RUN complete — no files copied, no reloads, no backups written."
  echo
  info "Would Pull Branch:"
  echo "  ${BRANCH}"
  echo
  info "Would FULL-backup:"
  echo "  ${LIVE_DIR}/ → ${BACKUP_DIR}/etc_asterisk/"
  echo
  info "Would Copy:"
  if [[ "${#CHANGED[@]}" -eq 0 ]]; then
    echo "  (none)"
  else
    printf '  %s\n' "${CHANGED[@]}"
  fi
  echo
  info "Would Validate (git sources first, then live after copy):"
  echo "  non-empty + real NUL check (tr/wc — not grep \$'\\0')"
  echo "  Asterisk CLI alive before reload"
  echo
  info "Would Execute:"
  if [[ "${#RELOADS[@]}" -eq 0 ]]; then
    echo "  (none)"
  else
    printf '  %s\n' "${RELOADS[@]}"
  fi
  exit 0
fi

# ----------------------------- backup + apply --------------------------------
if [[ "${#CHANGED[@]}" -eq 0 ]]; then
  RESULT="SUCCESS_NOOP"
  printf '%s SUCCESS %s %s 0 files (noop %s→%s)\n' \
    "${TS_HUMAN}" "${BRANCH}" "${DEPLOY_USER}" "${OLD_COMMIT}" "${NEW_COMMIT}" >>"${HISTORY_LOG}"
  ok "Nothing to deploy."
  exit 0
fi

# Validate git sources BEFORE touching /etc/asterisk (no backup/copy on bad sources)
if ! validate_git_sources "${CHANGED[@]}"; then
  die "Git source validation failed — live config untouched, no backup created."
fi

info "Creating FULL backup of ${LIVE_DIR} → ${BACKUP_DIR}/etc_asterisk/"
mkdir -p "${BACKUP_DIR}"
full_backup_live_dir "${BACKUP_DIR}/etc_asterisk"
write_backup_metadata "${BACKUP_DIR}" "${OLD_COMMIT}" "${NEW_COMMIT}" "${BRANCH}" "IN_PROGRESS" "${CHANGED[@]}"

RESULT="FAILED"
cleanup_on_fail() {
  local rc=$?
  if [[ "${RESULT}" != "SUCCESS" && "${RESULT}" != "SUCCESS_NOOP" ]]; then
    err "Deployment failed (exit ${rc}). Backup kept at: ${BACKUP_DIR}"
    printf '%s FAILED %s %s %s\n' \
      "${TS_HUMAN}" "${BRANCH}" "${DEPLOY_USER}" "${CHANGED[*]-}" >>"${HISTORY_LOG}" || true
    if [[ -f "${BACKUP_DIR}/git_commit.txt" ]]; then
      sed -i 's/^RESULT=.*/RESULT=FAILED/' "${BACKUP_DIR}/git_commit.txt" 2>/dev/null || true
    fi
    if [[ -f "${BACKUP_DIR}/deployment.log" ]]; then
      sed -i 's/^IN_PROGRESS$/FAILED/; s/^SUCCESS$/FAILED/' "${BACKUP_DIR}/deployment.log" 2>/dev/null || true
    fi
  fi
}
trap cleanup_on_fail EXIT

info "Copying ${#CHANGED[@]} file(s) → ${LIVE_DIR}"
for base in "${CHANGED[@]}"; do
  cp -a "${GIT_REPO}/${base}" "${LIVE_DIR}/${base}"
  apply_ownership "${LIVE_DIR}/${base}"
  ok "  copied ${base}"
done

# Safety net after copy; on failure restore full snapshot and abort
if ! validate_before_reload "${CHANGED[@]}"; then
  auto_rollback_from_backup "pre-reload validation failed"
  die "Validation failed — auto-rollback attempted. See ${BACKUP_DIR}"
fi

info "Executing reload commands..."
RELOAD_FAIL=0
for c in "${RELOADS[@]:-}"; do
  [[ -z "${c}" ]] && continue
  if ! asterisk_rx "${c}"; then
    RELOAD_FAIL=1
  fi
done

if [[ "${RELOAD_FAIL}" -ne 0 ]]; then
  auto_rollback_from_backup "one or more reload commands failed"
  die "Reload failed — auto-rollback attempted. See ${BACKUP_DIR}"
fi

# Post-reload: Asterisk must still answer CLI
if ! asterisk_alive; then
  auto_rollback_from_backup "Asterisk CLI unresponsive after reload"
  die "Post-reload health check failed — auto-rollback attempted. See ${BACKUP_DIR}"
fi

RESULT="SUCCESS"
write_backup_metadata "${BACKUP_DIR}" "${OLD_COMMIT}" "${NEW_COMMIT}" "${BRANCH}" "SUCCESS" "${CHANGED[@]}"
# Restore full snapshot content was taken before copy — write_backup_metadata does not wipe etc_asterisk/

update_symlinks "${BACKUP_DIR}"
prune_backups

printf '%s SUCCESS %s %s %s files (%s→%s) backup=%s\n' \
  "${TS_HUMAN}" "${BRANCH}" "${DEPLOY_USER}" "${#CHANGED[@]}" \
  "${OLD_COMMIT}" "${NEW_COMMIT}" "${BACKUP_NAME}" >>"${HISTORY_LOG}"

trap - EXIT
echo
ok "SUCCESS — deployed ${#CHANGED[@]} file(s)."
ok "Backup : ${BACKUP_DIR} (FULL /etc/asterisk snapshot)"
ok "Latest : ${BACKUP_ROOT}/latest"
ok "Rollback: sudo ${DEPLOY_ROOT}/rollback/rollback_latest.sh"
exit 0
