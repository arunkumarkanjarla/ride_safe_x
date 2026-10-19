# Static prototype architecture and mock state guide

## 1. Big picture

```
source/*.py  ──build.py──►  HTML pages (+ SVG diagrams)  ──►  browser
   │  screen specs + mocks       │  every page: CSP, external CSS/JS only
   │  proto_wiring.py ───────────┤  controls carry data-go / data-do / data-ui / data-msg
   │  postprocess.py  ───────────┘  inline styles → assets/css/generated/extracted.css
assets/js/rn-*.js  (hand-written runtime, no dependencies)
   rn-data.js      deterministic synthetic seed data and scenario definitions
   rn-machines.js  state machines (single source of legal transitions)
   rn-rbac.js      mock role/permission matrix
   rn-engine.js    mock workflow engine: state, commands, guards, timers, events, audit, offline queue
   rn-sync.js      optional: shares state between devices via tools/demo_server.py
   rn-ui.js        page runtime: wiring, demo bar, toasts, dialogs, keyboard, responsive scaling
   rn-screens.js   per-screen controllers (validation, live data, state panels, follow-ups)
   rn-console.js   demo console (prototype/index.html)
   fee-calc.js     fare/daily-fee calculator on architecture page 26
```

The approved designs are unchanged: the mocks are the same generator output as the supplied package. The build
adds semantics (buttons, links, labelled inputs, switches) and data attributes; the runtime adds behaviour and,
where the approved screen has no drawing for a state (no driver found, payment failed, SOS status…), a clearly
styled **state panel** on top of the mock.

## 2. Build pipeline

1. `build.py` renders every page through `components.page()` (CSP meta, stylesheet and deferred script tags).
2. `screenlib.build_app()` passes each mock through `proto_wiring.wire()`:
   * generic chrome: bottom navigation and admin sidebar → real links; back icons → labelled buttons; icon buttons
     → labelled by their icon; `.btn/.dbtn` → `<button>`; toggles → `role="switch"`; keypads → `data-key`;
   * the per-screen table `W` (selector + text → action). A table row that matches nothing, or more than one
     element, stops the build (`tests/check_wiring.py` lists all problems at once).
3. `components.write()` runs `postprocess.process()` on every HTML file: each `style="…"` attribute becomes
   reusable atomic classes (`x-font-weight-700`) or, when declaration order matters, one ordered block class
   (`xb-<hash>`). Rules are `!important` to keep the precedence the inline style had.
4. At the end the build writes `assets/css/generated/extracted.css`, `assets/js/generated/screens.js` (screen
   registry) and `assets/js/generated/fee-config.js` (fee model from `fees.py`).

Generated files (do not edit by hand): all HTML outside `docs/`, `images/diagrams/*.svg`, `assets/brand.js`,
`assets/site.css`, `assets/mock.css` (copied from `source/`), `assets/css/generated/*`, `assets/js/generated/*`.
Hand-written front-end files: `assets/css/prototype.css`, `assets/js/rn-*.js`, `assets/js/fee-calc.js`.

## 3. Mock state

One JSON object, versioned (`v`), with a revision counter (`rev`):

| Key | Content |
| --- | --- |
| `scenario`, `opts` | loaded scenario; timers (fast/spec), which parties act automatically, next payment outcome |
| `net` | simulated connectivity per app (`rider`, `driver`, `partner`, `admin`) |
| `session` | rider/driver sign-in status and attempt counters; admin status and **mock** role |
| `rider`, `drivers`, `persona` | synthetic people; `persona` is the driver the driver app represents (Arjun K.) |
| `rides`, `rideOrder`, `activeRideId` | rides with state, offers, payment, rating, history |
| `orders`, `incidents`, `kyc` | food orders, safety incidents, the driver application |
| `queue` | actions saved by an offline device |
| `timers` | absolute times at which simulated parties act (offer expiry, auto accept, webhook …) |
| `events`, `audit` | event history (last 400) and mock admin audit list |
| `idem` | recent successful command keys (duplicate-submission protection, 5 min) |

Storage: `localStorage["ridenova.demo.v1"]`, synthetic data only. It lets the state survive page navigation and
keeps tabs of the same browser in step (`storage` event). *Reset demo* replaces it with the scenario seed; clearing
site data removes it. If storage is unavailable the engine keeps the state in memory for the page.

Commands: `engine.run(actor, command, payload)` returns `{ok:true,…}` or `{ok:false, code, error}`. Every state
change goes through `rn-machines.js` (`check(machine, from, event, actor)`), so an illegal transition or the wrong
actor is always refused with a message, and every change appends an event.

Timers: stored as absolute times in the state and processed by `engine.tick()` (every 400 ms in each open page),
so simulated parties keep acting when you move between pages or tabs.

## 4. Adding or changing behaviour

* New control on an existing screen: add a row to `W` in `source/proto_wiring.py`, rebuild.
* New rule or state: change `rn-machines.js` / `rn-engine.js` and add a test in `tests/engine/engine.test.js`.
* Screen-specific display: add a controller with `def('R12', {...})` in `rn-screens.js`.
* Then run the tests (see [testing.md](testing.md)) and `py tools/gen_docs.py`.

## 5. Mapping to the future architecture

| Prototype piece | Future component (not built in this phase) |
| --- | --- |
| `rn-engine.js` commands | FastAPI endpoints listed on each screen page ("Backend calls") |
| `rn-machines.js` | server-side state machines (ride, payment, incident, order, KYC) |
| timers | dispatch workers, gateway webhooks, schedulers |
| events list | `ride_events` table / Kafka topics |
| `rn-rbac.js` | server-side RBAC (Keycloak/OIDC + per-service checks) |
| `localStorage` / demo server | PostgreSQL + Redis |
