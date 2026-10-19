# RideNova Phase P0 — Legacy admin → ops bridge

**Date:** 2026-10-19  
**Workstream:** RideNova (see `docs/COORDINATION.md`)  
**Status:** Implemented and automated-test verified (2026-10-19 ~10:44 IST)

## 1. Current-state architecture (summary)

Five role SPAs + Platform Control share RNPC (`shared/platform.js`): config `ridenova.platform.v1`, ops `ridenova.ops.v1`. Legacy admin A-screens keep synthetic ops samples in `ridenova.admin.v1` (`admin-extra.js`). Platform Control already mutates canonical ops (wallet, block, KYC). Gap L3: A05/A11 mutations stayed local to `admin.v1` and did not update the shared ledger.

## 2. Screen / role inventory (affected)

| Screen | Role | Change |
|---|---|---|
| A05 Riders | Admin (RBAC) | Credit / block write `ops.wallet` + `ops.customers`; overlay live status from ops; list live registered customers |
| A11 Payments | Admin (finance for large refunds) | Refunds append to `ops.wallet` when rider phone is resolvable |
| Platform Control → Customers | Admin | Already reads same ops; will show A05/A11 ledger rows |
| Customer app | Customer | Existing `platform-bridge.js` applies `ops.wallet` / block |

## 3. Workflow / state transitions

```
A05 Credit wallet (payment.refund RBAC)
  → admin.v1 rider.wallet += paise
  → ops.wallet += {id, phone, paise, kind:Adjustment, source:admin-A05}
  → ops.customers[phone].walletPaise += paise
  → invalid: amount out of range / RBAC deny / duplicate in-flight click

A05 Block / Unblock (fraud.block_account)
  → admin.v1 rider.status Active|Blocked
  → ops.customers[phone].blocked + reason
  → customer bridge shows hold overlay when blocked

A11 Issue refund (payment.refund)
  → admin.v1 tx.refunded += paise
  → if rider phone known: ops.wallet += Refund entry (idempotent per click via busy guard)
```

## 4. Baseline tests (pre-change)

2026-10-19 ~10:32 IST — all 8 suites PASS (`docs/BASELINE_RUN_20261019-103217.log`).

## 5. Defects / missing AC

| ID | Item |
|---|---|
| L3 | A-screen financial/account actions not on canonical ops ledger |
| AC-P0-1 | Finance credit on A05 must appear in `ridenova.ops.v1` wallet |
| AC-P0-2 | Block on A05 must set `ops.customers[phone].blocked` |
| AC-P0-3 | Existing admin / admin-control suites must remain green |

## 6. Prioritised backlog

1. **P0 (this phase):** A05 credit/block + A11 refund → ops bridge + tests  
2. P1: Deeper connected-demo shared ride engine persistence  
3. P2: Accessibility audit beyond UX suite  
4. Deferred: `patner-app` rename; full synthetic→ops data migration; backend

## 7. Files expected to change / regression risks

| File | Risk |
|---|---|
| `admin/assets/js/admin-extra.js` | Medium — A05/A11 mutation paths; keep RBAC/validation |
| `docs-analysis/test-admin.js` | Low — additive asserts |
| `docs/*` | Docs only |
| **Do not touch** | `hms/**` (peer claim); `shared/platform.js` unless needed |

Regression: double credit if busy-guard fails; phoneless synthetic refunds skip ops (documented).
