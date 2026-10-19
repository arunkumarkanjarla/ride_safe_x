# RideNova — Phase 2 Report (Identity, Sessions, RBAC, Audit)

**Date:** 2026-10-19  
**Branch:** `develop`  
**Gate verdict:** **PASS** (with documented limitations)

---

## Summary

Phase 2 delivers a working identity foundation on PostgreSQL:

- Users, roles, permissions, sessions, audit_events (Alembic `20261019_0002`)
- Email/password login, JWT access + opaque refresh rotation, logout/revocation
- Argon2id password hashing; server-side RBAC + object-level profile checks
- Audit events for auth and privileged actions (no secrets in payloads)
- Web portal + three Expo apps: real backend-connected login/session shells
- BMAD remains external; static application preserved

---

## Authentication / session design

| Item | Choice |
|---|---|
| Credentials | Email + password (OTP/SMS **not** operational) |
| Access | JWT HS256, short TTL (`ACCESS_TOKEN_MINUTES`, default 15) |
| Refresh | Opaque token, SHA-256 hashed in `sessions`, rotated on refresh |
| Roles in JWT | **No** — loaded from DB each request |
| Web storage | Access in memory; refresh in `sessionStorage` |
| Mobile storage | `expo-secure-store` with in-memory fallback |
| Admin bootstrap | `python -m app.scripts.provision_admin` (no seeded password) |

Details: `docs/security/IDENTITY_AND_ACCESS.md`, ADR-013.

## RBAC

Matrix: `docs/security/RBAC_MATRIX.md`  
Enforced via FastAPI dependencies + object checks on `/users/{id}`.

---

## Migrations / tables

- Revision: `20261019_0002` (revises `20261019_0001`)
- Tables: `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `sessions`, `audit_events`
- Seed: idempotent role/permission catalogue on API startup

---

## Test evidence

### Backend (host Python 3.12 venv)

```text
26 passed in ~152s
```

Command:

```powershell
cd backend
$env:RIDENOVA_DB_PREFER_HOST='1'
.\.venv\Scripts\pytest.exe -q
```

Covered: login success/failure/unknown/disabled/malformed, me/logout, refresh rotation, IDOR, role assign denial, roles/audit permission gates, audit creation without secrets, health/storage/config/migrations.

### Frontend

| Check | Result |
|---|---|
| `apps/web_portal` `npm run build` | **PASS** |
| `packages/contracts` `npm run check` | **PASS** |
| `customer_mobile` / `driver_mobile` / `partner_mobile` `npm run check` | **PASS** (exit 0) |

### Static prototype

Preserved; not mass-modified in Phase 2 (CDP exit-code fixes remain from Phase 1 only).

---

## Files created / modified (high level)

### Backend

- `app/models/`, `app/services/` (auth, audit, seed), `app/api/` (auth, users, roles, audit)
- `app/deps.py`, `app/core/security.py`, `app/core/rate_limit.py`, `app/core/permissions.py`
- `alembic/versions/20261019_0002_phase2_identity.py`
- `app/scripts/provision_admin.py`
- Tests: `test_auth.py`, `test_rbac.py`, `test_audit.py`

### Frontend

- Web portal login/session UI + Vite proxies
- Shared auth pattern in three Expo apps (`src/auth.ts`)
- Contracts: auth types (`API_CONTRACT_VERSION` 0.2.0)

### Docs

- `docs/stories/2.1`–`2.5`, `docs/security/*`, this report, ADR-013

---

## Security review (diff-based)

| Check | Result |
|---|---|
| Plaintext passwords | Not stored; Argon2id |
| Hard-coded JWT secret in code | No — env `JWT_SECRET`; production rejects weak secret |
| Token in logs/audit | Sanitized; audit tests assert absence |
| Client-supplied roles trusted | No — derived from DB |
| IDOR | Negative test PASS |
| Self-elevate to admin | Customer assign-role → 403 |
| Rate limiting | Redis preferred; memory fallback |
| CORS | Configurable allow-list, not `*` |
| Public admin seed password | None |

Remaining limitations below — do **not** treat as “fully secure/compliant.”

---

## Limitations / NOT VERIFIED

| Item | Status |
|---|---|
| SMS / phone OTP | **NOT IMPLEMENTED** (documented future) |
| HttpOnly cookie auth for web | **Deferred** (Bearer + sessionStorage refresh) |
| Remote GitHub Actions CI | **NOT VERIFIED** this session |
| Expo Go physical device login | **NOT EXECUTED** (typecheck only) |
| Docker API recreate while RabbitMQ unhealthy | Transient Compose dependency failure observed; host pytest + TestClient login smoke **PASS**; restart RabbitMQ/`compose up -d` if containers stuck |
| Password rotation of chat-exposed DB password | Operator responsibility |

---

## Gate checklist

1. Identity schema/migrations on PostgreSQL — **PASS**  
2. Login / me / logout / refresh lifecycle tested — **PASS**  
3. Backend RBAC + object-level auth — **PASS**  
4. Negative authz (IDOR, privilege) — **PASS**  
5. Audit created/protected — **PASS**  
6. Web + 3 mobile auth shells (backend-connected code) — **PASS**  
7. Frontend builds/checks — **PASS**  
8. Backend tests with evidence — **PASS** (26)  
9. Secrets not committed — **PASS** (`.env` ignored)  
10. Static preserved — **PASS**  
11. Traceability updated — **PASS**  
12. This report — **PASS**

## Gate status

**PASS**

---

## Next (await approval)

Phase 3 only after explicit approval: booking → dispatch → driver accept → WebSocket vertical slice.
