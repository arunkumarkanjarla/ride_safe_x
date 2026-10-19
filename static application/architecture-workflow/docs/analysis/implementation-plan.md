# Implementation plan – static interactive prototype

Principles: keep the generator as the single source of the HTML; change it in small reviewable steps; prove visual
parity against `D:\RideSafeX` before wiring behaviour; no backend, no network, no new runtime dependencies.

## Target structure

```
source/                 generator (existing) + new modules
  htmltree.py           tree parser/serialiser (byte-exact round trip)
  postprocess.py        runs on every written page: style→class extraction, CSP, scripts, prototype wiring
  proto_wiring.py       per-screen control wiring (what each control does) – data, not code
assets/
  site.css, mock.css    existing
  css/prototype.css     demo panel, focus styles, states, responsive mock scaling
  css/generated/extracted.css   generated from former inline styles (do not edit)
  js/rn-*.js            mock engine, state machines, RBAC, UI runtime, screen controllers
  js/generated/*.js     generated data (fee config, screen registry)
prototype/index.html    demo console: scenarios, state inspector, event log, reset
tests/                  python unittest (build + static checks), node --test (engine), browser e2e (Edge via CDP)
docs/                   analysis, workflows, guides, reports
tools/demo_server.py    optional, stdlib-only, in-memory shared state for two-device demos
```

## Batches

| # | Scope | Acceptance |
| --- | --- | --- |
| 1 | Baseline copy, analysis docs (this) | Inventory complete, generator reproducible |
| 2 | Externalise CSS/JS in the generator: post-processor, extracted CSS, fee calculator module, CSP, sample comparison | 0 `style=` attributes, 0 inline scripts, screenshots of sample pages pixel-equal to originals |
| 3 | Mock engine + state machines (ride, offer, payment, incident, food, KYC) + RBAC + node unit tests | Guards reject illegal transitions; tests pass |
| 4 | UI runtime: wiring of shared chrome (bottom nav, sidebar, back), demo panel, prototype console, responsive scaling | Every screen reachable from controls; keyboard operable |
| 5 | Rider wiring + controllers (onboarding, booking, trip, payment, safety, services) | Scenario A rider side works |
| 6 | Driver wiring + controllers | Scenarios A, B, F driver side work |
| 7 | Admin wiring + controllers + RBAC demo | Scenarios A, F, G, J admin side work |
| 8 | Partner + food cross-app | Scenario H works |
| 9 | End-to-end browser tests A–J, accessibility checks, responsive checks | Tests executed, results recorded |
| 10 | Documentation: guides, state machines, security baseline, readiness checklist, final report | Docs match implementation |

## Status at the end of this phase

| # | Status | Notes |
| --- | --- | --- |
| 1 | Done | |
| 2 | Done | 1,006 inline styles → 282 atomic + 15 block classes; fee calculator externalised; CSP on all pages; pixel parity verified |
| 3 | Done | 7 state machines, 18 engine tests |
| 4 | Done | demo bar, console, keyboard, responsive scaling, toasts/dialogs, state panels |
| 5–8 | Done | 118 screens wired; 50 screens with controllers; flows A–J |
| 9 | Done | static 13, engine 18, browser e2e 15, two-device 1, visual parity (see test report) |
| 10 | Done | docs listed in README |

Deviations from the original plan: `tests/browser/cdp.js` replaces Playwright (not installed; zero-dependency instead);
the optional two-device server was added after the single-browser prototype worked, as the brief required.

## Key risks

* Visual regressions from markup changes → screenshot comparison against the untouched reference.
* `file://` limitations: ES modules do not load from `file://` in Chromium, so scripts are classic, deferred files
  using a single `RN` namespace (still one file per module). Demo state uses `localStorage` (synthetic data only) so it
  survives page navigation and syncs between tabs; documented in the security baseline.
* Scope: 118 screens. Every screen gets navigation and its primary actions; deep behaviour is concentrated on the
  screens that take part in scenarios A–J. Anything left static is listed in the coverage report.
