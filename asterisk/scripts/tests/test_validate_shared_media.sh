#!/usr/bin/env bash
# Smoke test for validate_shared_media.sh using a temporary layout.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPT="${ROOT}/scripts/validate_shared_media.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

mkdir -p \
  "${TMP}/monitor" \
  "${TMP}/sounds" \
  "${TMP}/moh" \
  "${TMP}/prompts" \
  "${TMP}/voicemail" \
  "${TMP}/keys" \
  "${TMP}/agi-bin" \
  "${TMP}/recordings"

echo '-----BEGIN CERTIFICATE-----' >"${TMP}/keys/test.crt"
echo dummy >>"${TMP}/keys/test.crt"
echo '-----END CERTIFICATE-----' >>"${TMP}/keys/test.crt"

REQUIRE_MOUNT=false \
SHARED_MONITOR="${TMP}/monitor" \
SHARED_SOUNDS="${TMP}/sounds" \
SHARED_MOH="${TMP}/moh" \
SHARED_PROMPTS="${TMP}/prompts" \
SHARED_VOICEMAIL="${TMP}/voicemail" \
SHARED_KEYS="${TMP}/keys" \
SHARED_AGI_BIN="${TMP}/agi-bin" \
RECORDING_LOCAL_ROOT="${TMP}/recordings" \
bash "${SCRIPT}"

echo "test_validate_shared_media: PASS"
