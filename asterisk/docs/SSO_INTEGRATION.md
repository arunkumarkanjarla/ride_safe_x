# Asterisk ↔ SSO (Phase 14)

SSO authenticates the Japit web application, not SIP registration.

Agents still obtain SIP credentials from Japit after application login (password/MFA/SSO).

No Asterisk dialplan changes are required for BE-10.

For dual-PBX: SSO is application-tier; keep per-node AMI/ARI secrets via Phase 13 secret manager.
