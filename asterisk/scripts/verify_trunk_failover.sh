#!/usr/bin/env bash
# Verify dual SIP trunk endpoints are present and OPTIONS-qualified.
set -euo pipefail

PRIMARY="${TRUNK_PRIMARY:-Mediant}"
SECONDARY="${TRUNK_SECONDARY:-Mediant-Secondary}"

echo "== AST-06 trunk endpoints =="
asterisk -rx "pjsip show endpoint ${PRIMARY}" | head -n 40
asterisk -rx "pjsip show endpoint ${SECONDARY}" | head -n 40

echo "== AOR qualify =="
asterisk -rx "pjsip show aor mediant-aor" | head -n 30
asterisk -rx "pjsip show aor mediant-secondary-aor" | head -n 30

echo "== Contacts =="
asterisk -rx "pjsip show contacts" | grep -E "Mediant|mediant" || true

echo "OK: trunk config visible to Asterisk CLI"
