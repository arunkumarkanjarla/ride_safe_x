# Agent coordination lock — RideNova enhancement

**Purpose:** Prevent conflicting edits when multiple Cursor tabs implement the same master prompt.

## Active claim

| Field | Value |
|---|---|
| Agent | Cursor Auto (this session) |
| Claimed at | 2026-10-19 (Phase 1 baseline) |
| Status | **RELEASED — Slice A complete (8/8 green)** |
| Scope | Phase 1 baseline + Phase 4 canonical trip persistence (Slice A) — done 2026-10-19 ~10:44 |

## Owned files (do not edit in parallel)

Exclusive while this claim is ACTIVE:

- `docs/CHANGE_PLAN.md` (this agent creates/owns)
- `docs/AGENT_COORDINATION.md` (this file)
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/DEFECT_REGISTER.md`
- `docs/VERIFICATION_REPORT.md` / new VERIFY_* logs from this baseline
- `customer-app/assets/js/app.js` (engine storage wiring)
- `driver-app/assets/js/app.js`
- `patner-app/assets/js/app.js`
- `admin/assets/js/app.js`
- `connected-demo/assets/js/hub.js`
- `customer-app/assets/js/engine.js` (persistence helpers only if needed)
- `driver-app/assets/js/engine.js` (keep in sync with customer engine helpers)
- `shared/platform.js` (trip/ops helpers only — additive)
- `docs-analysis/test-flows.js` (additive assertions only)
- New: `docs-analysis/test-trip-persist.js` (if added)

## Free for other agents (coordinate via comments here)

- Partner catalogue / order lifecycle UI (`patner-app/assets/js/partner-extra.js`)
- Agent portal ticket UX (`agent-portal/`)
- Admin A-screen ↔ Platform Control migration (`admin/assets/js/admin-extra.js`, `control.js`) — **claim before editing**
- UX/a11y polish (`ux.js` / `ux.css`)
- Connected-demo scenario catalogue UI (after persistence lands)
- Architecture-workflow wireframes (reference only)

## Protocol

1. Before editing a file listed under another agent’s claim, add a row below and wait until that claim is RELEASED or the owner notes handover.
2. Prefer additive changes; do not delete assertions or relax validations.
3. Preserve storage keys: `ridenova.platform.v1`, `ridenova.ops.v1`, `ridenova.customer.v1`, `ridenova.driver.v1`, `ridenova.partner.v1`, `ridenova.admin.v1`, `ridenova.agent.v1`, `ridenova.ux.v1`.
4. New trip engine key (planned): `ridenova.demo.v1` — already referenced in engine; do not invent alternate trip keys.
5. Folder spelling `patner-app/` is intentional — never rename without a redirect plan.

## Other agent claims

| Agent / tab | Scope | Status | Notes |
|---|---|---|---|
| Parallel tab (P0) | Admin A05/A11 → ops bridge | Landed | See `docs/COORDINATION.md`, `PHASE_P0_OPS_BRIDGE.md`; avoid conflicting rewrites of `admin-extra.js` A05/A11 |


## Release

Slice A RELEASED. Remaining backlog for next agents: CHANGE_PLAN slices B–H (matching, fare guards, partner catalogue, A-screen unification, agent/SOS, connected-demo scenarios, extended suites). Claim files before editing.
