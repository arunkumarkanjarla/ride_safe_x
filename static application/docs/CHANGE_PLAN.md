# RideNova — File-level change plan (enhancement round)

Generated: 2026-10-19 · Phase 1 baseline  
Coordination: see `docs/AGENT_COORDINATION.md`

## Baseline snapshot (pre-code)

| Item | Finding |
|---|---|
| Docs | Inventory, architecture, workflows, matrix, cert, launch, defects present |
| Prior cert | 8/8 suites PASS (2026-10-19 ~09:29 and ~09:46) |
| Stack | Static HTML/CSS/JS; RNPC in `shared/platform.js` |
| Authoritative config | `ridenova.platform.v1` + `ridenova.ops.v1` |
| Gap L3 | Admin A-screens (`ridenova.admin.v1`) may diverge from Platform Control |
| Gap L7 | Engine supports `ridenova.demo.v1` R/W but apps force `memoryStorage()` + `fresh: true` → reload loses live trip |

## Highest-priority vertical slice — **DONE** (2026-10-19 ~10:44)

**Goal:** Canonical ride/trip simulation survives refresh and stays consistent across customer, driver, admin (same-origin), without replacing apps.  
**Evidence:** `VERIFY_RUN_20261019-104452.log` — 8/8 PASS including new flow persistence checks.

### Slice A — Persist engine state (Phase 4 core)

| File | Change | Risk |
|---|---|---|
| `*/assets/js/engine.js` (customer, driver, partner, admin, connected-demo) | Add `browserStorage()` adapter (localStorage get/set/remove); keep `memoryStorage` for tests; bump comment; optional migrate if `v` mismatch | Medium — keep VERSION=3 contract |
| `customer-app/assets/js/app.js` | Use `browserStorage()` when not under hub; only `fresh: true` when no saved demo state | Medium — must not break onboarding tests (they `localStorage.clear()`) |
| `driver-app/assets/js/app.js` | Same | Medium |
| `patner-app/assets/js/app.js` | Same | Low |
| `admin/assets/js/app.js` | Same | Low |
| `connected-demo/assets/js/hub.js` | Persist shared hub engine to `ridenova.demo.v1`; Reset button clears key | Medium |
| `customer-app/assets/js/product-core.js` / ride UI | On boot, if `activeRide()` exists, resume correct screen (no accidental restart of COMPLETED/CANCELLED) | Medium |
| `customer-app/assets/js/platform-bridge.js` | Mirror active/completed rides into `RNPC.ops.bookings` with stable ids | Medium |
| `shared/platform.js` | Additive helpers: `tripPut` / `tripGet` / safe booking upsert; do not break `blankOps()` consumers | Low if additive |
| `docs-analysis/test-flows.js` | Add refresh-recovery + no-restart-after-complete assertions | Low |
| Docs | Update DEFECT L7, IMPLEMENTATION_PLAN, WORKFLOW_MAP, VERIFICATION after green run | — |

**Out of slice A (defer / other agents):** full A-screen unification, partner order SM polish, agent escalation UX, connected-demo 10 scenario catalogue UI, a11y deep dive.

### Non-goals for slice A

- No backend, build system, or new dependencies
- No rename of `patner-app`
- No claim of live GPS / multi-device sync / real payments
- Do not remove or weaken existing suite assertions

## Later slices (ordered)

| Slice | Focus | Primary files |
|---|---|---|
| B | Matching determinism + single-offer reservation | `engine.js` offer/dispatch paths; tests |
| C | Fare agreement + wallet/refund duplicate guards | `platform.js` fare (preserve), customer pay paths, admin control |
| D | Partner catalogue → customer availability | `partner-extra.js`, bridges, tests |
| E | Admin A-screen ↔ ops reconciliation | `admin-extra.js`, `control.js`, migrations |
| F | Agent ticket linkage + SOS escalation | `agent-app.js`, customer support, ops.sos/tickets |
| G | Connected-demo scenarios 1–10 | `hub.js`, scenario data, docs |
| H | Extended suites + re-cert | all `test-*.js`, certification docs |

## Test gate

1. Run all 8 original suites **before** coding (baseline log).
2. After slice A, re-run all 8; never delete assertions to pass.
3. Record evidence under `docs/VERIFY_*` or `docs/BASELINE_*`.

## Limit statements (always document)

Browser localStorage only; demo OTP/MFA; simulated GPS/payments/calls; same-origin tabs only; not production-ready.
