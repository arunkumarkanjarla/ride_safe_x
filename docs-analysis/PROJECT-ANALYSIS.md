# RideNova / Ride Safe X - project analysis (Phase 1)

Written before any code was changed. Folder `docs-analysis\` also holds `audit.js` (static control audit, run `node audit.js ..\customer-app full`) and its output `*-controls.txt`.

## 1. Architecture in short

* Static prototype: plain HTML + CSS + vanilla JS, no build step, no backend. Five standalone folders (`customer-app`, `driver-app`, `patner-app`, `admin`, `agent-portal`); no folder loads a file from another.
* The four phone/desktop apps are **generated** from `architecture-workflow\source\*.py` (`py source/build.py --apps`). `index.html` of each app holds one `<section class="rn-screen" data-sid="R05">` per screen, drawn as an approved *mock* (static markup, atomic `x-*` CSS classes, strict CSP: no inline script or style).
* Shared runtime (identical copy in every app): `app.js` = hash router (`#/R05`), event delegation for `data-go` (navigate) / `data-do` (run `x.action` of the screen controller, or an engine command) / `data-ui` (pick/toggle) / `data-msg` (toast), dialogs, toasts, auth gate; `kit.js` = helpers + `def()`; `controllers.js` = per-app screen controllers `def('R03',{init,update,tick,actions})`.
* `engine.js` + `state-machines.js` + `roles.js` + `data.js` = a simulated back office kept **in memory only** (`memoryStorage`, `fresh:true`): one state object (session, rider, drivers, rides, orders, incidents, tickets, timers). `engine.run(actor, 'cmd', payload)` applies commands through state machines; `engine.tick()` (every 400 ms) fires timers (driver offers, arrival, trip end, payment webhook, restaurant/courier steps). Rides, food orders, SOS, support tickets/chats/calls are real simulated workflows; everything else is a picture.
* `screens.js` = screen registry (`RN_SCREENS`: title, app, to/from) used by router and Back fallback. `config.js` = brand + addresses of the other apps (placeholders).
* Demo codes (data.js `DEMO_CODES`): customer/driver OTP 482716, admin MFA 730951, agent code 246810, trip OTP 4827, food OTP 4471.
* `agent-portal` is hand-written separately (`agent-app.js` 115 KB, `agent-data.js`); `admin` additionally has `ops-*.js`/`agent-control.js` modules.
* Reset on reload: nothing is persisted, so every page load is a signed-out demo session.

## 2. Customer app: map of screens and flow (58 screens)

Intended flow: R01 splash -> R02 onboarding -> R58 sign in/create -> (R57 terms) -> R03 phone -> R04 OTP -> R05 profile -> R06 permissions -> R29 super-app home.
Ride chain (engine driven, works): R07/R08 -> R31 -> R09 -> R10 -> R11 finding driver -> R12 -> R13/R14 -> R15 -> R16 SOS -> R17 pay -> R18 rate -> R19 invoice. Food chain: R44 -> R45 -> R46 (engine order). Everything else (R32-R43, R47-R50, R52, R54, R36-R42, R21, R22, R24-R28, R53...) is a mock with `data-go` links and `data-msg` toasts.

### Why a new customer's flow is wrong today (root causes)
1. **R03 phone is pre-filled with the demo number `98480 04321`** and R58 offers only two canned demo accounts. `engine auth.verifyOtp` decides `newUser = (phone !== DATA.RIDER.phone)` - only that one hard-coded number is "known". Any other number is "new" **every time** because nothing is stored (memory storage); there is no registered-phones list, so a returning user can never skip onboarding.
2. A user who keeps the pre-filled demo number is a "returning" user and goes **straight to R29**, so the onboarding/profile screen is never seen.
3. **R05 is a hard-coded mock**: name pre-filled "Ananya Rao", email pre-filled, gender chips are only `data-ui="pick"` (selection not read or saved), "Add photo" is a `data-msg` toast, no emergency contact, no skip. `rider.profile` only stores name + email.
4. The engine rider object is always the seed `DATA.RIDER` (Ananya Rao, wallet Rs 120, contacts Mom/Rahul): after sign-up the new user is still "Ananya" everywhere.
5. R29, R07, R28, R21, R24, R54, R56... contain **hard-coded text** (Ananya, "Rs 1,240 saved", Mom/Rahul contacts, fixed trips) - they never reflect the signed-in user.
6. Nothing persists: state is lost on reload; no user list, no wallet, no bookings.

### Home (R29) tiles and bottom navigation
| Tile | Goes to | Problem |
| --- | --- | --- |
| Ride | R07 | works (engine) but static greeting, fixed places |
| Bike taxi, Auto | both R09 | same page as each other, no own page, no destination chosen, fixed fares |
| Long trip | R32 | static mock, form fields are pictures |
| Share seat, Bus | both R33 | same page, static options |
| Rentals R43, Hotels R41/R42, Parcel R47/R48 | own screen | static pictures, `data-msg` toast "Simulated", no booking created |
| Food R44/R45/R46 | own screens | R45 fixed cart (Biryani House, Rs 458), no menu, single fixed order |
| AI Plan trip R52 | R52 | static chat picture |
| Deals R49 | R49 | static; links to R50/R33/R44/R47 |
| Trip card, savings card | R36 / R49 | hard-coded |
| Bottom nav | R29 has Home/Trips(R54)/Savings/Wallet/Account; R07 has Home(R07)/Trips(R20)/... | inconsistent between screens: Trips goes to R54 or R20, Home to R29 or R07 |
Other dead-ish items: R21 Add money/History = toast only; R24 Add contact = toast, toggles not saved; R28 Saved places/Notifications/Privacy = toast, name hard-coded; R08 "Hitec|" search is not an input; R14 quick replies only toast; R43/R41/R42 "Book" = toast.

## 3. Other apps (audit summary, `*-controls.txt`)
No control points to a missing screen or missing action (audit reports 0 broken `data-go`/`x.` handlers) - the defects are **behavioural**: forms are drawn, defaults are pre-filled, and 60-70 % of screens have no controller.
* **driver-app (29 screens)**: D01 login pre-filled `90000 12345`, flow D01->D05/D02->D03->D04 driven by engine (works); no controller: D13 earnings, D14 wallet, D15 incentives, D20 support, D24-D26 long-trip publish/manifest, D27, D28 account. Registration D02 values are pre-filled; no persistence.
* **patner-app (11 screens)**: P08 sign-in pre-filled; P09 home, P03 menu, P07 payouts, P10 settings, P11 support have no controller (static).
* **admin (31 screens)**: A01 MFA (code 730951) works; A04/A06/A07/A12/A13/A15/A19/A20 have controllers; A02, A03, A05, A08-A11, A14, A16-A18, A21-A31 are static dashboards (`ops-*.js` adds some live data - to be verified).
* **agent-portal**: separate hand-written app (G01 sign-in code 246810); to be checked in Phase 3.

## 4. Implementation plan (hand-written, app folders only; `source\` and the generator are untouched)
Backup: `D:\git\ride_safe_x_backup_<timestamp>\` holds the five app folders as they were.
Customer app (priority):
1. `assets/js/store.js` - persistent store `ridenova.customer.v1` (localStorage in try/catch with memory fallback): registered users by phone, session phone, wallet + transactions, bookings, notifications, contacts, saved places, preferences, trip plan.
2. `assets/js/product.js` (+ `product-services.js`) - small view toolkit + controllers that rebuild the body of the screens in JS with the existing CSS classes (look unchanged): new auth chain (phone validation, OTP with resend timer, **profile setup with name, gender, optional photo (FileReader -> data URL), optional emergency contact + Skip**, permissions), personalised home with 12 distinct service tiles, consistent bottom navigation, and working pages for every service (bike, auto, long trip, shared seat, bus, rentals, hotels, food with menu/cart/tracking, parcel with tracking, AI trip planner, deals/offers/coupons), wallet (add money, history), trips & tickets, history, notifications, emergency contacts CRUD, KYC, support chat, complaint form, account/settings, language/currency. Ride and food bookings still run through the engine; completed items are mirrored into the store (history, wallet, notifications).
3. `assets/css/product.css` - only the few extra rules needed (new widgets). `index.html` gets the new `<link>/<script>` tags only.
4. Other apps: same pattern at smaller scale - persistent session, no pre-filled demo values (demo code shown as hint), controllers for the static screens (earnings/wallet/incentives/support/account, partner home/menu/payouts/settings, admin dashboards), consistent navigation.
5. Verify: `node --check` on every changed JS, local `py -m http.server`, headless Edge/Chrome walk-through via the existing CDP harness (`architecture-workflow/tests/browser/cdp.js`).
