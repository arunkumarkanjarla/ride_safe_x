#!/usr/bin/env sh
# AST-02 read-only Opus verification helper.
set -u

cat <<'EOF'
AST-02 recommended Asterisk CLI diagnostics:
  module show like opus
  core show codecs
  core show translation
  pjsip show endpoint {ext}ws
  rtp set debug on
  rtp set debug off

For a controlled call, inspect SIP SDP for:
  Browser leg: a=rtpmap:<payload> opus/48000/2
  Mediant leg: PCMU (ulaw) or PCMA (alaw)
EOF

if command -v asterisk >/dev/null 2>&1; then
    echo
    echo "Installed Opus-related modules:"
    if ! asterisk -rx "module show like opus" 2>/dev/null; then
        echo "Unable to query the Asterisk CLI; verify service permissions and availability."
    fi
else
    echo
    echo "Asterisk CLI is unavailable on this host; printed commands only."
fi
