#!/usr/bin/env bash
# Static validation for Phase 11 Asterisk artifacts (no live PBX required).

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0

check_file() {
  local f="$1"
  if [[ ! -f "${ROOT}/${f}" ]]; then
    echo "MISSING ${f}"
    fail=1
  else
    echo "OK ${f}"
  fi
}

check_grep() {
  local f="$1"
  local pat="$2"
  if ! grep -qE "${pat}" "${ROOT}/${f}"; then
    echo "FAIL ${f} missing /${pat}/"
    fail=1
  else
    echo "OK ${f} ~ ${pat}"
  fi
}

check_file "extensions_japit_emergency.conf"
check_file "acl_japit.conf"
check_file "manager_japit.conf.sample"
check_file "ari_japit.conf.sample"
check_file "fail2ban/jail.japit-asterisk.conf.sample"
check_file "fail2ban/filter.japit-asterisk-sip.conf"
check_file "fail2ban/filter.japit-asterisk-ami.conf"
check_file "ops/chrony/chrony.conf.sample"
check_file "scripts/check_time_integrity.sh"
check_file "scripts/sync_emergency_policy.sh"

check_grep "extensions_japit.conf" 'extensions_japit_emergency.conf'
check_grep "extensions_japit.conf" 'japit-emergency-detect'
check_grep "extensions_japit_emergency.conf" '\[japit-emergency\]'
check_grep "manager_japit.conf" 'japitami-readonly'
check_grep "manager_japit.conf" 'CHANGE-ME-SET-ASTERISK-AMI-SECRET'
check_grep "acl.conf" 'acl_japit.conf'
check_grep "modules.conf" 'chan_skinny.so'

# Ensure no obviously committed live AMI password pattern from prior revisions.
if grep -qE 'secret\s*=\s*JapitAMI!' "${ROOT}/manager_japit.conf"; then
  echo "FAIL manager_japit.conf still contains committed live-looking secret"
  fail=1
else
  echo "OK manager_japit.conf uses placeholder secret"
fi

exit "${fail}"
