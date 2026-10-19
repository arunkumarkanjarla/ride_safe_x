# RideNova — Phase 9 Report (Payments Foundation / Sandbox)

**Date:** 2026-10-19  
**Branch:** `develop`  
**Starting HEAD:** `92344167438834bb1a972295f47fa10e6547673a`  
**Ending HEAD:** same (no commit requested)  
**Starting migration head:** `20261019_0006` (`8-notifications`)  
**Ending migration head:** `20261019_0007` (`9-payments`)  
**Gate verdict:** **CONDITIONAL PASS**  
**Commit:** none  
**BMAD:** External `D:\git\bmad_project`; stories `docs/stories/9.*`; no in-repo BMAD install

---

## 1. Verdict

**CONDITIONAL PASS**

Server-authoritative sandbox payments are implemented: post-trip (`CLOSED`) eligibility, amount from booking `estimate_paise`, one `SUCCEEDED` per booking, idempotent initiate, token-gated sandbox callback, terminal-state protection, outbox + customer notifications, and a minimal customer UI labeled as non-money.

**Conditional** because:

- Live outbox worker / RabbitMQ payment event fanout was not exercised end-to-end in this session (post-commit materialize path used).
- No physical-device verification of the customer payment UI.
- Phase 5–8 device/GPS and multi-replica WS limitations remain open.
- This is explicitly **not** a live payment provider integration.

---

## 2. Git status

Working tree remains dirty with Phase 1–9 uncommitted work; `static application/` preserved. No reset/stash/revert.

---

## 3. Payment states & policy

Documented in `docs/architecture/PAYMENT_STATE_MACHINE.md`.

| From | Event | To |
|---|---|---|
| CREATED | sandbox.initiate | PENDING |
| CREATED / PENDING | payment.cancel | CANCELLED |
| PENDING | sandbox.succeed / fail / expire | SUCCEEDED / FAILED / EXPIRED |

**Eligibility:** booking status `CLOSED` only (post-trip settlement sandbox).  
**Amount:** always server `estimate_paise` + `currency`.  
**Rule:** at most one `SUCCEEDED` payment per booking (partial unique index).

---

## 4. APIs / permissions / gateway

### Permissions
- `payments.create_self`, `payments.read_self` (customer; seeded via RBAC catalogue)

### Endpoints
| Method | Path | Notes |
|---|---|---|
| POST | `/payments` | Idempotent initiate |
| GET | `/payments`, `/payments/{id}` | Own records only |
| POST | `/payments/{id}/sandbox/simulate` | Non-production |
| POST | `/payments/sandbox/callback` | Token auth; non-production |

### Gateway
- `SandboxGateway` only — fake `sbx_*` refs; no network provider calls.
- Disabled when `RIDENOVA_ENV=production` or `PAYMENTS_SANDBOX_ENABLED=false`.
- Startup rejects `production` + sandbox enabled.

---

## 5. Persistence

Migration `20261019_0007`: `payments`, `payment_events` (+ `gateway_event_key` uniqueness), `uq_payment_booking_succeeded`.

Atomic path: status change + history + outbox in one commit; notifications via existing materializer.

---

## 6. Tests

```powershell
cd D:\git\ride_safe_x\backend
$env:RIDENOVA_DB_PREFER_HOST='1'
$env:RIDENOVA_DISABLE_EVENTS_CONSUMER='1'
.\.venv\Scripts\python.exe -m pytest -q --tb=line
```

**Result:** `67 passed in 509.33s` (full suite; includes 3 new payment tests + updated migration).

| Frontend | Result |
|---|---|
| contracts `npm run check` | pass |
| customer/driver/partner `npm run check` | pass |
| web_portal `npm run build` | pass |

---

## 7. Security evidence

- Cross-customer initiate/read → 403
- Client cannot set SUCCEEDED via normal body (simulate/callback only)
- Callback bad token → 401
- Duplicate `gateway_event_key` → no-op / no regress
- Terminal fail after succeed → 409
- Second succeed attempt for same booking → 409
- No card/UPI fields in UI; no secrets in responses (`gateway_ref` only)

---

## 8. Topology tested

| Component | Status |
|---|---|
| PostgreSQL + migration 0006→0007 | Verified |
| Sandbox gateway (in-process) | Verified |
| Outbox enqueue + notification materialize | Via API path |
| Live RabbitMQ worker for payment events | Not E2E this session |
| Physical device UI | Not verified |

---

## 9. Deferred

- Live providers (Razorpay/Stripe/etc.)
- Refunds, wallets, driver payouts, commissions
- Production webhooks / signature schemes
- Phase 10+

---

## 10. BMAD

Stories `9.1`, `9.2`; ADR-015; no invented CLI.

---

**Stop:** Phase 10 and live payment integration require explicit user approval.
