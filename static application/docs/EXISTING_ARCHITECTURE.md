# RideSafe X / RideNova — Existing Architecture

Generated: 2026-10-19

## Product naming

| Layer | Name |
|---|---|
| Workspace folder | `ride_safe_x` |
| UI brand | **RideNova** |
| Platform runtime | RNPC (`shared/platform.js`) |

## Stack (non-negotiable)

- HTML5, CSS3, vanilla JavaScript only
- No build step, no Node runtime for the apps
- Persistence: `localStorage` (+ in-memory fallback)
- Cross-tab sync: `storage` event, `BroadcastChannel`, 1.5s poll
- Launch: static file server preferred (`py -m http.server`); `file://` works per profile

## Top-level layout

```
ride_safe_x/
  index.html                 # Public hub → role apps
  shared/                    # Platform config + runtime
  customer-app/              # Rider SPA (phone chrome)
  driver-app/                # Driver SPA
  patner-app/                # Partner SPA (folder spelling preserved)
  admin/                     # Admin SPA + control.html
  agent-portal/              # Support agent SPA
  connected-demo/            # Side-by-side multi-app demo
  architecture-workflow/     # Static wireframe catalogue
  docs-analysis/             # CDP tests, crawls, progress notes
  docs/                      # Baseline audit & certification (this folder)
```

## Application pattern

Each role app is a **single `index.html` SPA**:

1. Screen catalogue / templates (often in `screens.js` or product modules)
2. Engine / controllers navigate by screen id (`RN.ui.sid`, e.g. `R29`, `D04`, `A01`)
3. Role-specific extras (`product-*.js`, `driver-extra.js`, `partner-extra.js`, `admin-extra.js`, `agent-app.js`)
4. Optional `platform-bridge.js` reads/writes RNPC config & ops
5. UX layer (`ux.js` / `ux-desk.js`): dark mode, hi/te labels, offline banner, 44px targets

## Shared platform (RNPC)

| Store | Key | Writer |
|---|---|---|
| Config | `ridenova.platform.v1` | Admin control console |
| Ops | `ridenova.ops.v1` | Apps + admin (KYC, tickets, SOS, wallet, audit) |
| Defaults | `window.RN_PLATFORM_DEFAULT` | Bundled in `platform-config.js` |

Admin console: `admin/control.html` (15 tabs: services, pricing, cities, offers, drivers, partners, customers, live ops, broadcasts, flags/maintenance, content, RBAC, audit, import/export).

## Auth model (demo only)

| Role | Mechanism | Demo code |
|---|---|---|
| Customer / Partner | Phone + OTP | `482716` |
| Driver | Phone + OTP + document onboarding | OTP as configured in app |
| Admin | Email/password + MFA | MFA `730951` |
| Agent | Portal code | `246810` |

**Not production security.** Session remembered in browser storage with expiry; role screens are client-gated only.

## Data consistency

- Customer booking → mirrored into shared bookings / ops where wired
- Driver KYC / suspend / quests driven by admin config
- Partner commission / menu moderation from admin
- Fare formula single source: `RNPC.fare()` used by admin preview and customer quote
- Platform Control is authoritative for config (`ridenova.platform.v1`) and ops (`ridenova.ops.v1`)
- Admin A-screens (`ridenova.admin.v1`) still hold **synthetic sample tables**; A05 credit/block and A11 refunds (phone-resolvable) **also write** the canonical ops wallet / customers maps (P0 bridge, 2026-10-19)

## Engine vs persisted stores

| Layer | Persistence | Notes |
|---|---|---|
| Per-app stores (`ridenova.customer.v1`, etc.) | localStorage | Sessions, wallets, menus, onboarding survive reload |
| Platform RNPC | localStorage | Config/ops sync across same-origin tabs |
| Ride/food `engine.js` | localStorage `ridenova.demo.v1` | Canonical trip simulation; same-origin reload restores active rides (VERSION=3). Tests may still use memoryStorage. |
| Connected demo | Parent hub holds one engine | Iframes share one scenario + same `ridenova.demo.v1` key; needs HTTP same-origin (not bare `file://`). Reset clears the key. |

Deployments must include `shared/` beside the role apps so `../shared/platform*.js` resolves.

## Mobile vs web

Customer, driver, and partner apps are **mobile phone-framed SPAs** usable in desktop browsers. Admin and agent are **desktop portal** layouts. Architecture-workflow HTML is a separate static design reference, not the runtime apps.
