# AST-21 Media Encryption (SRTP / DTLS)

## Architecture

```
Browser WebRTC  -- DTLS-SRTP -->  Asterisk PJSIP (transport-ws)
Deskphone SIP   -- RTP ------->  Asterisk PJSIP (transport-udp)
Asterisk        -- RTP/SRTP -->  SIP trunk / provider (policy)
Asterisk MixMonitor --> decoded audio --> Phase 12 pipeline --> Phase 14 at-rest encryption
```

SRTP/DTLS terminates at Asterisk. MixMonitor is **not** an SRTP hop. Recording-at-rest is Phase 14.

Realtime WebRTC endpoint rows are the source of truth (`telephony_sync._endpoint_profile`). The PJSIP template documents the policy; ODBC realtime applies `media_encryption=dtls`.

## Encryption policy

| Status | Meaning |
|--------|---------|
| encrypted | DTLS-SRTP or SRTP in use |
| unencrypted | RTP by design (documented) |
| unsupported | Cannot encrypt this path |
| explicit_fallback | Unencrypted only with an operator-documented provider limitation (never silent) |

## Encryption matrix

| Leg | Status | Mechanism | Fallback |
|-----|--------|-----------|----------|
| WebRTC → Asterisk | encrypted | DTLS-SRTP | none (rejected if missing) |
| Deskphone → Asterisk | unencrypted | RTP | none (LAN SIP) |
| Asterisk → SIP trunk | explicit_fallback (default) | RTP | explicit provider fallback |
| Asterisk → SIP provider | same as trunk | RTP or SRTP | never silent |
| Internal extension → extension | mixed | per-leg | none |
| Transfer legs | mixed | per-leg | none |
| Recording media path | unsupported | MixMonitor then Phase 14 | none |

Live packet-capture proof is **STAGING REQUIRED**.

## PJSIP configuration requirements

WebRTC realtime endpoints MUST set:

- `webrtc=yes`
- `ice_support=yes`
- `media_encryption=dtls`
- `dtls_auto_generate_cert=yes` (or equivalent provisioned certs)
- `use_avpf=yes`
- `rtcp_mux=yes`

Do not set `media_encryption=no` on WebRTC endpoints. The API rejects insecure WebRTC profiles at sync/startup.

Deskphone/X-Lite endpoints remain `media_encryption=no` on `transport-udp` (documented unencrypted).

## WebRTC DTLS-SRTP requirements

- Browser legs use the existing WS/WSS SIP path (AST-02). This phase does not replace WebRTC.
- DTLS certificates: auto-generated per endpoint unless operations install `/etc/asterisk/keys` certs.
- Never log DTLS private keys, fingerprints used as secrets, or SRTP keys.
- TURN REST secret remains browser-only (not in `pjsip_japit.conf`).

## Trunk SRTP policy

Environment: `MEDIA_ENCRYPTION_TRUNK_MODE`

| Mode | Behavior |
|------|----------|
| `required` | Trunk `media_encryption` must be `srtp`/`sdes`/`dtls`. Startup validation fails otherwise. |
| `explicit_fallback` (default) | RTP allowed because the provider does not support SRTP. Audited. Not a silent downgrade. |
| `optional` | Unencrypted allowed without fallback audit. |

Default Mediant trunk is **explicit fallback** (`provider_does_not_support_srtp`). Enable `required` only after the provider confirms SRTP.

## Fallback rules

1. WebRTC: no fallback. Insecure config is rejected.
2. Trunk: fallback only when `MEDIA_ENCRYPTION_TRUNK_MODE=explicit_fallback` and reason is set.
3. Never change encryption because a call failed to negotiate.
4. AST-06 trunk failover, AST-15 toll-fraud, AST-17 security remain in force.

## Certificate requirements

- WebRTC: DTLS cert via `dtls_auto_generate_cert=yes` or files under `ASTERISK` keys dir (`SHARED_KEYS_ROOT`).
- TLS for SIP WS is terminated at the reverse proxy (existing architecture).
- Do not commit private keys or live ARI/AMI passwords.

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Browser one-way audio / DTLS fail | `media_encryption=dtls`, ICE, `external_media_address`, TURN |
| WebRTC sync rejected | API logs `insecure_webrtc_media_policy` |
| Trunk calls fail after `required` | Provider SRTP support; rollback mode to `explicit_fallback` |
| Secrets in logs | File a defect; redaction is mandatory |

## Packet-capture validation procedure (staging)

**STAGING REQUIRED** — do not mark this complete without a live capture.

1. Place a test WebRTC call through the agent softphone.
2. Capture on the Asterisk media interface (`tcpdump -i <if> -w webrtc.pcap port not 5060`).
3. Confirm DTLS handshake (UDP, DTLS records) and SRTP (no plaintext RTP payload for the WebRTC 5-tuple).
4. Repeat for deskphone (expect RTP) and SIP trunk (expect RTP unless SRTP enabled).
5. Store the pcap off-repo; never commit media captures with customer audio.

## Production checklist

- [ ] WebRTC endpoints show `media_encryption=dtls` in realtime
- [ ] Startup validation enabled
- [ ] Trunk mode documented (`explicit_fallback` or `required`)
- [ ] Explicit fallback audit event present when using RTP trunks
- [ ] No DTLS/SRTP secrets in logs, APIs, git, or frontend
- [ ] Live packet capture signed off (staging)
- [ ] AST-06/15/17/18/19 and recording/workers unchanged
