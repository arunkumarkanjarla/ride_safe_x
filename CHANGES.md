# CHANGES - Round 2 (12 Oct 2026)
Backup: D:\git\ride_safe_x_backup_20261012-2255 (older 20261012-0746 kept). Static only, no installs, no commits.

## customer-app
- product-kit.js: P.pay smart default (last used / Wallet), UPI PIN sheet (payee, amount, 4-dot PIN keypad, anti-fraud copy), P.paidAnim success tick.
- product-ux.js (new): R29 offers carousel, recent bookings, Refer & earn sheet; R18 tip chips paid via P.pay.
- Fixes: product-core.js fdt -> P.fdt; empty chat Send shows toast (product-life/ride); duplicate SOS toast (kit.js).
## driver-app
- driver-extra.js: returning drivers remembered, multi-account by phone, D03 doc subtitles.
- lite.js: redraw works repeatedly (D13/D16 period chips crashed on 2nd click); toggle rows are role=button.
## patner-app
- partner-extra.js: removed capture-phase stopPropagation that killed P03 toggles; lite.js fixes as above.
## admin
- admin-extra.js/.css (new): A01 email+password then MFA (730951), session 8h/12h trusted; A05,A08-A11,A14,A16-A18,A21-A23,A25,A26,A28-A30 rebuilt with KPIs, filters, search, drawers, RBAC + audit, CSV export, undo, maker-checker.
- kit.js navButton: links to other-app screens (e.g. Rider SOS R16) open that demo in a new tab instead of doing nothing.
## agent-portal
- agent-app.js: persistence under ridenova.agent.v1 (session 8h, conversations, calls, stats).
## Shared UX (customer, driver, partner): ux.js + ux.css
Dark mode, Hindi/Telugu labels, offline banner, skeleton loaders, pull-to-refresh, undo toast, 44px tap targets, Display & language block on R28/D28/P10.
## Tests (docs-analysis)
New test-driver.js, test-admin.js, test-agent.js, test-ux.js; test-flows.js covers the UPI PIN; crawl.js supports reload + SKIP.
Run: cd docs-analysis; node test-flows.js (and test-customer/driver/partner/admin/agent/ux.js); node crawl.js <app-folder> "<signin js>" reload
## Round 2b (13 Oct 2026)
- admin + agent-portal: new assets/js/ux-desk.js + assets/css/ux-desk.css (floating Display bar: dark mode, English/Hindi/Telugu; prefs shared in ridenova.ux.v1; RNUX.undoToast).
- OTP helper in all 5 apps (ux.js / ux-desk.js): digits only, paste extracts the code, auto-continues when complete on real user input (R04, D01 sheet, D09, P08, A01 MFA, agent sign-in).
- Undo toasts: customer saved place, emergency contact, payment method, trip stop, price alert (P.undo in product-kit.js); partner menu item; agent callback.
- customer R32: Swap gives feedback when the fields are empty or the same.
- crawl.js: per-screen (PER, default 45s) and per-click (6s) timeouts, alert/confirm/window.open stubs, progress output.
- test-ux.js extended to admin + agent portal (55 checks).
## Round 3 - Admin control plane (13 Oct 2026)
Design: docs-analysis/ADMIN-CONTROL-DESIGN.md. Backup: D:\git\ride_safe_x_backup_20261013-0720.
- shared/platform-config.js (bundled defaults = old behaviour), shared/platform.js (RNPC runtime: versioned config `ridenova.platform.v1`, ops `ridenova.ops.v1`, audit/history, export/validate/import/reset, live updates via storage event + BroadcastChannel + 1.5 s poll, broadcast banners, maintenance overlay), shared/platform.css (CSP-safe, no inline styles).
- admin/control.html + assets/js/control.js + assets/css/control.css: Platform control console, 15 tabs (services, pricing + fare preview, cities/zones/airport, offers/referral/wallet, drivers KYC/suspend/quests/payouts, partners approvals/menu moderation/commission, customers block/wallet/refunds, live ops bookings/SOS/tickets, broadcasts, flags + maintenance, app content, roles/RBAC, audit log + CSV, config export/import). Session-gated, permission-checked, reason required for price changes, maker-checker for credits of Rs 5000 or more, dirty-form guard against live re-renders.
- Bridges: customer/driver/partner/agent platform-bridge.js, admin platform-link.js (nav link + banners on the old A-screens).
- Edits: driver-extra.js (KYC from admin, quests, payout rules), partner-extra.js (stage/rejection, commission), product-core.js (P.SVC), product-ux.js (offers/referral), 5 index.html files (script tags).
- Test: docs-analysis/test-admin-control.js (51 checks).
- Run: `py -m http.server 8080` at the repo root, then open http://localhost:8080/admin/control.html (sign in through A01 first). The apps must share the same origin to share config; file:// works inside a single browser profile.
- Limits: booking commands change the mirrored booking records, not the deep engine ride state; the old admin A-screens keep their own store (they link to Platform control, with no two-way sync).

<<<<<<< Updated upstream
## Round 4 - P0 ops bridge (19 Oct 2026)
- `admin/assets/js/admin-extra.js`: A05 goodwill credit and block/unblock write canonical `ridenova.ops.v1` (`ops.wallet`, `ops.customers`); A11 refunds append ops wallet rows when rider phone is resolvable; A05 lists live ops customers; busy-guards reduce duplicate mutations.
- `docs-analysis/test-admin.js`: asserts ops ledger + block sync after A05 finance/super-admin actions.
- Docs: `docs/PHASE_P0_OPS_BRIDGE.md`, IMPLEMENTATION_PLAN, DEFECT_REGISTER (L3 narrowed), EXISTING_ARCHITECTURE, COORDINATION.
- Synthetic `ridenova.admin.v1` seed tables retained (no destructive reset). Platform Control remains authoritative for config.

=======
- Round 3 follow-up (14 Oct): R32 Long-trip Swap now always gives feedback (toast 'Swapped: X -> Y'; existing toasts for empty/same). Crawls: driver 29, partner 11, admin 31, customer 60 screens - 0 page errors, 0 timeouts (run alone), dead = self-links only. 8 suites all pass.
>>>>>>> Stashed changes
