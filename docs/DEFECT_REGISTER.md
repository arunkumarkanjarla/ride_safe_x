# RideSafe X / RideNova — Defect Register

Baseline date: 2026-10-19  
Last verification: 2026-10-19 (~10:44 IST)  
Parallel work this window: **P0 ops bridge** (`POST_P0_RUN_20261019-104408.log`) + **Slice A trip persistence** (`VERIFY_RUN_20261019-104452.log`, `BASELINE_RUN_20261019-103257.log`)

## Verification snapshot

| Suite | P0 ops bridge | Slice A persistence |
|---|---|---|
| test-customer.js | ALL PASSED | ALL PASSED |
| test-driver.js | baseline green | ALL PASSED |
| test-partner.js | baseline green | ALL PASSED |
| test-admin.js | ALL PASSED (+3 ops-bridge asserts) | ALL PASSED |
| test-agent.js | baseline green | ALL PASSED |
| test-ux.js | 55/55 PASSED | ALL PASSED |
| test-admin-control.js | 51/51 (1 batch flake → re-run PASS) | ALL PASSED |
| test-flows.js | ALL PASSED | ALL PASSED (+ refresh recovery) |

## Open defects

| ID | Severity | Area | Description | Status |
|---|---|---|---|---|
| — | — | — | No open blockers | — |

## Known limitations (not defects)

| ID | Area | Limitation |
|---|---|---|
| L1 | Auth | Demo OTP/password/MFA only; not secure authentication |
| L2 | Sync | No cross-browser / cross-device sync |
| L3 | Admin | Synthetic A-screen **seed tables** remain in `ridenova.admin.v1`; **mutations** for A05 credit/block and A11 refunds (when phone known) now sync to `ridenova.ops.v1` (P0) |
| L4 | Naming | Folder `patner-app` misspelling retained for path stability |
| L5 | Branding | Product UI says RideNova; repo folder is `ride_safe_x` |
| L6 | GPS/Pay/Call | Simulated only |
| L7 | Engine | **Mitigated (Slice A):** live ride engine persists to `ridenova.demo.v1`; same-origin reload restores active trips. Still not multi-device sync. |

## Historical notes

Prior crawl runs flagged self-link navigations and intentional SOS/Swap feedback patterns; not treated as workflow blockers.
