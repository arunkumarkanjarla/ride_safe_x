# TURN remote NAT checklist

Use this checklist from an external network before enabling TURN for a broader
user group.

1. Confirm the browser is served over HTTPS and the SIP WebSocket uses WSS.
2. Confirm DNS and the TLS certificate match the TURN hostname.
3. From an Internet client, verify UDP and TCP 3478, TLS 5349, and the UDP
   relay range are permitted by every firewall and NAT.
4. Enable `TURN_ENABLED` only after FastAPI and coturn use the identical
   `TURN_SHARED_SECRET`; verify the credentials endpoint returns TURN URLs.
5. Test an inbound and outbound call from a restrictive NAT (mobile hotspot,
   hotel, or symmetric NAT). Verify two-way audio, DTMF, hold/resume, transfer,
   supervisor monitoring, and call teardown.
6. Inspect browser WebRTC diagnostics and confirm the selected candidate pair
   includes `relay` when direct candidates cannot connect.
7. Verify Asterisk endpoints retain `ice_support=yes`, RTP range is reachable,
   and no private candidate is selected from the remote network.
8. Test credential expiry by waiting beyond `TURN_TTL_SECONDS`, reconnecting
   the softphone, and confirming a fresh credentials response is used.
9. Review coturn logs for allocation/authentication failures without logging
   credentials or the shared secret.
10. Roll back by setting `TURN_ENABLED=false`; browser softphones fall back to
    STUN and existing on-premises behavior remains unchanged.
