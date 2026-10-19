# RideNova — Identity and Access (Phase 2)

## Authentication strategy

| Decision | Choice | Tradeoff |
|---|---|---|
| Credential | Email + password | Product OTP/SMS is **not** operational in Phase 2; documented as future provider-backed workflow |
| Access credential | Short-lived JWT (`HS256`), `Authorization: Bearer` | Same model for web + mobile; web should later prefer HttpOnly cookies |
| Refresh | Opaque token, **hashed** in `sessions`, rotated on refresh | Revocable; theft window limited by rotation |
| Password hash | Argon2id (`argon2-cffi`) | Modern KDF; never store plaintext |
| Web token storage | Access token **in memory**; refresh in `sessionStorage` (not `localStorage`) | Tab-close clears refresh; cookie+CSRF is preferred for production browsers later |
| Mobile token storage | Prefer `expo-secure-store`; if unavailable in Expo Go path, document fallback | Secure Store may need a development build for some modules |
| Rate limit | Redis when available; in-process fallback for unit tests | Protects login brute-force |

## Session lifecycle

1. Login validates email/password and `users.status == active`.
2. Server creates a `sessions` row with refresh-token hash + expiry.
3. Access JWT includes `sub` (user id), `sid` (session id), `exp` only — **not** roles (roles loaded server-side each request).
4. Logout / refresh rotation revokes prior session refresh.
5. Disabled users cannot use existing sessions.

## Administrator provisioning

No seeded admin password. Create the first admin on a trusted host:

```powershell
cd backend
$env:RIDENOVA_DB_PREFER_HOST='1'
.\.venv\Scripts\python.exe -m app.scripts.provision_admin --email admin@example.com --name "Admin"
# Password prompted interactively (or ADMIN_PASSWORD env for automation — never commit)
```

## OTP / SMS

Phone OTP remains a product requirement for customers/drivers in the static prototype. Phase 2 does **not** claim SMS OTP works. Future work: provider adapter behind an interface with explicit stub vs live modes.

## CORS

`CORS_ORIGINS` env (comma-separated). Default development origins for Vite and Expo. Do not use `*` with credentials.
