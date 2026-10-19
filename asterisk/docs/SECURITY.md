# AST-17 Security notes (updated Phase 11)

See **[SECURITY_HARDENING.md](./SECURITY_HARDENING.md)** for the full baseline.

## Quick hygiene

1. Never commit live AMI/ARI/ODBC passwords.
2. Rotate any secret that previously lived in Git.
3. Keep AMI `deny=0.0.0.0/0` with explicit permits only.
4. Whitelist WebRTC proxy + Mediant in fail2ban `ignoreip`.
5. Prefer private HTTP bind + reverse-proxy TLS for SIP WebSocket.
