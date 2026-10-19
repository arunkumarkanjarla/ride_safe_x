# Asterisk security hardening (AST-17)

## Goals

- Block unauthorized SIP registration from the Internet
- Restrict AMI to application / monitoring networks
- Secure or disable unused ARI
- Provide fail2ban without bricking WebRTC / Mediant
- Review TLS and module surface without breaking existing integrations

## Artifacts

| Path | Purpose |
|------|---------|
| `acl_japit.conf` | Named ACLs for AMI / SIP / trunks / WebRTC proxy |
| `manager_japit.conf` + `.sample` | Least-privilege AMI (`japitami`, `japitami-readonly`) |
| `ari_japit.conf` + `.sample` | ARI password placeholder + origin guidance |
| `http_japit_secure.conf.sample` | Private bind / TLS notes for HTTP+WS |
| `modules_japit_secure.conf.sample` | Safe noload candidates |
| `fail2ban/*` | SIP + AMI jails/filters |

## AMI

- Bind to private IP / localhost; never expose 5038 publicly.
- `deny=0.0.0.0/0` then explicit `permit` for FastAPI.
- Application user keeps `config` write for queue sync (AST-11).
- Readonly user has no write classes.
- Secrets: `CHANGE-ME-*` placeholders in Git; inject via EnvironmentFile / vault.

**Action after pull:** rotate AMI secrets on servers that previously used a committed password.

## SIP / PJSIP

- Anonymous endpoints must remain disabled.
- Apply `acl=japit-sip-internal` / `japit-sip-trunks` / `japit-webrtc-proxy` on endpoints as appropriate.
- WebRTC continues via authenticated endpoints + reverse-proxy WSS; do not open UDP 5060 to the world.

## ARI / HTTP

- If ARI unused: leave users disabled / passwords rotated; do not expose 8088 publicly.
- WebRTC needs HTTP/WebSocket — prefer `bindaddr` private + TLS at proxy (`http_japit_secure.conf.sample`).

## Fail2ban

1. Install filters from `asterisk/fail2ban/`.
2. Whitelist FastAPI, WebRTC proxy, Mediant, office SIP VLANs in `ignoreip`.
3. Start with sample thresholds (`maxretry` 8–10); raise if false positives.
4. Unban: `fail2ban-client set asterisk-sip unbanip <ip>`

## Firewall (minimum)

| Port | Source | Notes |
|------|--------|-------|
| 5060/udp+tcp | Mediant + SIP VLAN | Not Internet |
| 8088/8089 | Reverse proxy only | WS/WSS |
| 5038/tcp | FastAPI hosts only | AMI |
| RTP range | Per `rtp.conf` | Media |
| 22/tcp | Admin jump hosts | SSH |

## TLS

- Prefer WSS at the shopper domain reverse proxy (existing Phase 1/2 design).
- PJSIP TLS transport samples remain optional; enabling them requires certs out of band.
- Do not break existing Opus WebRTC by forcing endpoint TLS without client support.

## Validation

```bash
bash asterisk/scripts/validate_phase11_config.sh
```
