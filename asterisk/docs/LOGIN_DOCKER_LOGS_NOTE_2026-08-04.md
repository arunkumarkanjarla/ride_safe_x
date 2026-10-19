# Note: React login / FastAPI Docker logs (2026-08-04)

## Summary

UI login from `http://localhost:5173` to FastAPI on port `8101` failed and produced **no** FastAPI Docker login logs. Investigation showed this was **not** an Asterisk / AMI issue.

## Cause

1. **Cursor IDE** bound `127.0.0.1:8101`–`8106` (auto port-forward), intercepting traffic meant for Docker Desktop.
2. FastAPI `TRUSTED_HOSTS` rejected non-localhost `Host` headers when traffic was sent via `host.docker.internal`.

Asterisk AMI credentials and `manager_japit.conf` were not on the request path for `/api/v1/auth/login`.

## Action in this repo

**No Asterisk code or config changes** for this fix.

## Where the fix lives

| Repo | Doc |
|------|-----|
| Python | `python-git/python-service/docs/operations/LOGIN_DOCKER_LOGS_FIX_2026-08-04.md` |
| React | `react-js-git/react-web/docs/operations/LOGIN_DOCKER_LOGS_FIX_2026-08-04.md` |

## When Asterisk *would* matter

After a successful app login, agent telephony (Ready, originate, AMI events) still depends on:

- `ASTERISK_AMI_*` in Python `.env`
- `manager.conf` / `manager_japit.conf` permit lists
- SIP/WebRTC reachability to the Asterisk host

Those are separate from the “no Docker logs on login” problem fixed above.
