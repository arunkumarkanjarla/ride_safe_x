# AST-30 channel capacity (operational)

See `Documents/PHASE31_PRE_IMPLEMENTATION.md` for discovery math.

## Applied in Git (reload Asterisk on the PBX after review)

| File | Old | New | Rollback |
|------|-----|-----|----------|
| `http.conf` sessionlimit | 200 | 512 | 200 |
| `http_japit_secure.conf.sample` sessionlimit | 200 | 512 | 200 |
| `asterisk.conf` maxfiles | unset | 16384 | comment out `maxfiles` |
| `asterisk.conf` maxcalls | unset | unset | do not add a cap |
| `rtp.conf` range | 10000–20000 | unchanged | n/a |
| `stasis.conf` threadpool | 5 / 50 defaults | 10 / 80 | comment the three keys |
| `ari.conf` websocket_write_timeout | 100 (default) | 500 | 100 |

HTTP reload: `asterisk -rx "module reload res_http_websocket.so"` and HTTP manager as per site practice. Prefer a maintenance window; do not reload production blindly.

## PBX-host only (not auto-applied)

- `asterisk/ops/asterisk-limits.conf` → systemd `LimitNOFILE=16384`
- `asterisk/ops/99-japit-ast30-sysctl.conf` → UDP buffers (record old sysctl first)

## Must remain enabled

Recording (MixMonitor), recording encryption, DTLS-SRTP WebRTC, AST-21 trunk explicit RTP fallback, toll-fraud, DND/consent, governor, PCI DTMF, AMD, sticky routing, LCR, AST-06 failover.

## DoD

400 concurrent + recording ON + 60 minutes + CPU < 70% + no dropped RTP is **STAGING REQUIRED** until measured on a live PBX with packet/RTCP evidence.
