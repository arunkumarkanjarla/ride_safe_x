#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmpdir="$(mktemp -d)"
trap 'rm -rf "${tmpdir}"' EXIT
repo="${tmpdir}/repo"
live="${tmpdir}/live"
report="${tmpdir}/report.json"
mkdir -p "${repo}" "${live}"

printf '[general]\nfoo=bar\n' >"${repo}/pjsip.conf"
printf '[general]\nfoo=bar\n' >"${live}/pjsip.conf"

GIT_REPO="${repo}" LIVE_DIR="${live}" REPORT_FILE="${report}" \
  bash "${SCRIPT_DIR}/check_config_drift.sh" >/dev/null
grep -q '"status":"clean"' "${report}"

printf '[general]\nfoo=changed\n' >"${live}/pjsip.conf"
if GIT_REPO="${repo}" LIVE_DIR="${live}" REPORT_FILE="${report}" \
  bash "${SCRIPT_DIR}/check_config_drift.sh" >/dev/null 2>&1; then
  echo "Expected a changed shared file to return drift" >&2
  exit 1
fi
grep -q '"status":"drift"' "${report}"
grep -q '"changed":\["pjsip.conf"\]' "${report}"

printf '; JAPIT-NODE-LOCAL\nbind=10.0.0.2\n' >"${live}/pjsip_node.conf"
printf '[general]\nfoo=bar\n' >"${live}/pjsip.conf"
GIT_REPO="${repo}" LIVE_DIR="${live}" REPORT_FILE="${report}" \
  bash "${SCRIPT_DIR}/check_config_drift.sh" >/dev/null
grep -q '"status":"clean"' "${report}"
echo "PASS test_check_config_drift"
