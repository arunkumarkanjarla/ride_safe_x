#!/usr/bin/env bash
# Soft responsiveness signal: it lowers priority but does not replace full health validation.
set -euo pipefail

[[ -r /etc/default/japit-keepalived ]] && source /etc/default/japit-keepalived
AST_BIN="${AST_BIN:-/usr/sbin/asterisk}"
timeout "${PJSIP_CHECK_TIMEOUT_SECONDS:-3}" "${AST_BIN}" -rx "pjsip show endpoints" 2>/dev/null |
  grep -Eq 'Endpoint:|Objects found:|No objects found'
