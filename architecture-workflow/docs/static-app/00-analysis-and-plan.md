# Static application phase – workspace analysis and plan

Date 2026-10-10. Repository `D:\git\ride_safe_x`, branch `develop` (1 commit, `5f39d22`). Nothing committed or pushed.

## 1. Existing folder structure (as found)

| Folder | Files | Content |
| --- | --- | --- |
| `architecture-workflow/` | 382 | The whole blueprint and the previous prototype phase, moved here: 27 architecture pages, 118 screen specification pages, flows, image gallery, 118 PNG screens, 40 SVG diagrams, generator (`source/`), runtime (`assets/js/rn-*.js`), tests, tools, docs |
| `admin/`, `customer-app/`, `driver-app/`, `patner-app/` | 0 | empty |
| `support-portal/` | — | does not exist |
| root `index.html` | — | does not exist (the brief refers to one) |
| root `README.md` | 1 | from the previous phase; **19 of its links are broken** because the docs moved into `architecture-workflow/` |

Git: `README.md` modified, `architecture-workflow/` untracked; the four empty app folders are not visible to Git.
`patner-app/` is spelled differently from "partner" but is empty and referenced nowhere; it is **kept as named** (renaming is a
product-owner decision; all new links use the existing name).

## 2. Files and screen counts

118 approved screens (55 customer R01–R55, 27 driver D01–D27, 7 partner P01–P07, 29 admin A01–A29), each with a
specification page and a PNG. Inside `architecture-workflow/` the 13 static tests still pass after the move (verified).

## 3. Which applications exist

None as applications. The interactive work from the previous phase lives in the **specification pages**: each screen
page carries a wired mock, and a shared engine keeps the scenario across pages via `localStorage`.

## 4. Documentation-only screens

All 118 specification pages are documentation pages. Their mocks are interactive, but they are documents, one
screen per page, not an application shell.

## 5. Screens with working interactions

All 118 mocks have wired controls (979 navigation links, 147 actions, 185 pick/toggle controls, 82 labelled simulations),
50 have screen controllers, and scenarios A–J pass browser tests. This work is the basis for the applications.

## 6. Broken links and missing assets

* Root `README.md`: 19 broken relative links (docs moved).
* Inside `architecture-workflow/`: none (static link test passes).
* The brief's root `index.html` and every app entry point are missing.

## 7. CSS / JavaScript compliance against the new rules

| Rule (new brief) | Finding | Action |
| --- | --- | --- |
| No inline CSS/JS, CSP without unsafe-* | compliant (tested) | keep |
| **No localStorage/sessionStorage/cookies for records** | `rn-engine.js`, `rn-ui.js`, `rn-console.js`, `rn-sync.js` use `localStorage` | engine state moves to memory; storage use removed |
| **No server without approval** | `tools/demo_server.py` (optional two-device server from the previous phase) | kept on disk (not deleted) but no longer used or referenced by any page; re-enabling needs approval |
| Pure HTML/CSS/vanilla JS | compliant (no frameworks, no npm packages) | keep |

## 8. Conflicting or missing workflow requirements

* Mobile stack: blueprint says Flutter, earlier brief React Native; this phase is HTML/CSS/JS only (no conflict for now).
* In-memory state cannot be shared between separate documents. Cross-application scenarios therefore run in one
  document: the new **connected demo** loads the apps side by side in frames of one page that owns the state.
  Separate tabs, browsers and phones each run their own independent demo (documented limitation).
* No designs exist for: customer notifications, terms & privacy, sign-in choice; driver account/profile and rider call;
  partner login, partner home, business settings, partner support; admin disputes; the entire support portal
  (user side and agent console). These are designed in this phase from the existing design system and marked **new**.
* Support policies are not specified (who may reopen, SLA targets, call-back windows, CSAT). Assumptions are recorded
  in `docs/static-app/workflows.md` as open questions.

## 9. Implementation order (batches)

1. Foundation: in-memory engine + support/booking domain; single-document app shell and router; app generator; root
   `index.html`; connected demo; specification pages become static documentation (no state, "Open in app" link).
2. Customer app: welcome, sign-in/registration, OTP, home, city ride, history, notifications, other services.
3. Driver app: onboarding, availability, offers, trip execution, deliveries, account, call simulation.
4. Partner app: login, home, orders (food), bookings (hotel, rental, bus), menu, payouts/reviews, profile, support.
5. Admin portal: login/MFA, monitoring, dispatch, KYC, SOS, refunds, disputes, tables with search/sort/filter.
6. Support portal: user ticketing, chat, voice call simulation, agent console.
7. Tests, PNGs for new screens, documentation.

## 10. First batch – files

New: `architecture-workflow/source/build_apps.py`, `architecture-workflow/source/screens4.py` (new screens),
`architecture-workflow/assets/js/rn-app.js` (router + app runtime), `assets/js/rn-hub.js`, `assets/css/app.css`,
root `index.html`, `connected-demo/`, `customer-app/`, `driver-app/`, `patner-app/`, `admin/`, `support-portal/`
(generated `index.html` + `assets/`).
Changed: `rn-engine.js` (memory, support/bookings), `rn-ui.js`/`rn-screens.js` (router-aware), `registry.py`,
`build.py`, `screenlib.py`, `proto_wiring.py`.

Acceptance for batch 1: every app opens from its own `index.html`, routes between its screens without page loads,
state survives in-app navigation and resets on reload, no storage API is used, static tests pass.
