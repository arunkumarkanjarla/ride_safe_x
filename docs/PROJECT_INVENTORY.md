# RideSafe X / RideNova PROJECT_INVENTORY

Generated: 2026-10-19
Folder name: `ride_safe_x` · Product UI brand: **RideNova**

## Architecture style
Five SPA-style phone/desktop shells (one `index.html` each) with hashed/screen-id navigation, plus architecture wireframe HTML and a connected-demo hub.

## Applications
| App | Path | Role | Type | Status |
|---|---|---|---|---|
| Hub | `index.html` | Public | Multi-page hub | Working (Round 3) |
| Customer app | `customer-app/index.html` | Customer | SPA (~60 screens) | Working (Round 3) |
| Driver app | `driver-app/index.html` | Driver | SPA (~29 screens) | Working (Round 3) |
| Partner app | `patner-app/index.html` | Partner (note: folder typo patner) | SPA (~11 screens) | Working (Round 3) |
| Admin portal | `admin/index.html` | Administrator | SPA (~31 screens) | Working (Round 3) |
| Admin control | `admin/control.html` | Administrator | Platform control console | Working (Round 3) |
| Agent portal | `agent-portal/index.html` | Support agent | SPA | Working (Round 3) |
| Connected demo | `connected-demo/index.html` | Cross-role demo | Hub | Working (Round 3) |
| Architecture workflow | `architecture-workflow/` | Reference screens | Static wireframes (~182 HTML) | Working (Round 3) |

## Shared platform
| File | Purpose | Storage keys |
|---|---|---|
| shared/platform.js | RNPC config/ops runtime | `ridenova.platform.v1`, `ridenova.ops.v1` |
| shared/platform-config.js | Bundled defaults | — |
| shared/platform.css | Broadcast/maintenance chrome | — |

## Per-app persistence (examples)
- Customer: `ridenova.customer.v1`
- Driver: `ridenova.driver.v1`
- Partner: `ridenova.partner.v1`
- Admin session: `ridenova.admin.v1`
- Agent: `ridenova.agent.v1`
- UX prefs: `ridenova.ux.v1`
- Canonical trip engine: `ridenova.demo.v1` (shared across role apps + connected-demo on same origin)

## Demo codes (from hub)
Customer/partner OTP `482716` · admin MFA `730951` · agent `246810` · trip `4827` · delivery `4471`

## File counts by folder
- `admin/`: 2 HTML, 24 JS
- `agent-portal/`: 1 HTML, 7 JS
- `architecture-workflow/`: 182 HTML, 26 JS
- `assets/`: 0 HTML, 0 JS
- `connected-demo/`: 1 HTML, 7 JS
- `customer-app/`: 1 HTML, 19 JS
- `docs/`: 0 HTML, 0 JS
- `docs-analysis/`: 0 HTML, 17 JS
- `driver-app/`: 1 HTML, 13 JS
- `patner-app/`: 1 HTML, 13 JS
- `shared/`: 0 HTML, 2 JS

## Tests
Located in `docs-analysis/`: test-customer, test-driver, test-partner, test-admin, test-admin-control, test-agent, test-ux, test-flows, crawl.js

