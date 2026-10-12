# Test report – static prototype phase

Environment: Windows 11 Pro, Python 3.14.2, Node.js 24.18.0, Microsoft Edge 155 (headless, via `tests/browser/cdp.js`).
Date: 2026-10-10. All results below come from runs actually executed on the final build; nothing is assumed.

## Summary

| Suite | Tests | Result |
| --- | --- | --- |
| Static and build (`tests/test_static.py`) | 13 | **13 passed** |
| Mock engine (`tests/engine/engine.test.js`) | 18 | **18 passed** |
| Browser end-to-end (`tests/browser/e2e.test.js`) | 15 | **15 passed** (final run: see below) |
| Two devices (`tests/browser/two-device.test.js`) | 1 | **passed 5 of 5 consecutive runs** |
| Visual parity vs supplied package (118 mocks, scripts off, isolated) | 118 | **114 identical**, 4 differ by design (below) |

## Static and build checks (13)

Page counts (118 screens, PNG per screen) · no inline CSS/JS, handlers or `javascript:` URLs in any of 154 pages ·
CSP on every page without `unsafe-*` · no `eval`/`innerHTML`/`document.write` in any script · no external resources ·
every local link/asset resolves · every page round-trips through the HTML parser · every generated class is defined ·
wiring table matches all mocks · every screen reachable from controls (one documented exception: R51) ·
every control and input has an accessible name · no nested interactive elements · two builds are byte-identical and
match the repository.

Reachability: a walk over all wired links, declared controller navigation and automatic follow-ups, starting from
R01, D01, P01 and A01, reaches 117 of 118 screens. R51 (Emergency mode) has no entry control on R29 in the approved
design; it is reachable from the app index, the user flows page and the demo console.

## Engine unit tests (18)

Transition guards (illegal event, wrong actor) · Scenario A happy path to `CLOSED` and single rating · B decline and
expiry then reassignment · C `NO_DRIVER_FOUND` then retry as a new ride · D free/fee cancellation and no cancellation
in trip · E payment declined twice, booking blocked, settlement · driver guards (no start before assignment, wrong
OTP, no double completion) · late acceptance refused · duplicate submission applied once · F KYC submit, re-upload,
approve, go online · G SOS lifecycle and `incident.close` permission · H food order across parties (photo and code
required) · H restaurant no-answer auto-reject and refund · I offline queue, duplicate refusal, reconciliation ·
J mock RBAC denial and audit · auth validation, rate limit, attempts and lockout · reset and cross-tab storage ·
failed attempt not cached by its idempotency key (regression test for a bug found by the browser tests).

## Browser end-to-end (15)

| Test | Checks |
| --- | --- |
| Smoke | all 118 screen pages load from `file://`, the runtime boots, no console/JS errors (one expected state-driven redirect: D05 → D06 when the driver is online) |
| Scenario A | R09 → R10 → R11 → R12 (OTP 4827) → R15 → R17 "Paid by UPI" → R18 rating → R29; ride `CLOSED`; A04 shows `CLOSED` and the timeline |
| Scenario B | R11 shows "declined"; offers DECLINED, EXPIRED, ACCEPTED; A04 timeline shows each |
| Scenario C | search panel, "No drivers available" after the window, cancel hidden, *Try again* → R12 |
| Scenario D | cancel while searching with confirmation dialog, "No fee", offer withdrawn; cancel in trip refused |
| Scenario E | R17 tag goes Pending → Failed and never shows Paid; rebooking refused; *Pay by UPI* → Paid; debt cleared |
| Scenario F | submit refused while incomplete; uploads; D04 "In review"; A07 re-upload needs a reason; D04 shows it; re-submit; approve; training; online |
| Scenario G | R16 "not sent yet"; press-and-hold SOS; A13 acknowledge → work → resolve; close denied for Ops manager; allowed for Safety manager; R16 shows CLOSED |
| Scenario H | R45 pay → R46; P02 accept with 20 min, mark ready; D22 accept; D23 photo required, pickup, code 4471; R46 "Delivered"; events present |
| Scenario I | driver offline banner; trip end queued; duplicate refused; network-only action disabled; back online → `PAYMENT_PENDING`, `ride.reconciled` |
| Scenario J | Support agent: KYC approve and account block denied and audited; A19 blurred with "Access denied" |
| Forms | invalid phone → inline error with `aria-invalid`; wrong OTP → attempts left; correct OTP → home |
| Keyboard | chip selected with Enter, `aria-pressed` updated; Tab stays within the device controls |
| Responsive | at 375×812 no horizontal scroll and the mock is scaled to fit (R12, D07, P02, A04) |
| Reset | *Reset demo* restores the scenario seed |

## Visual parity

Method: each of the 118 mocks rendered from the supplied package (`D:\RideSafeX`, untouched) and from this
repository, scripts disabled, mock moved to the same position, compared pixel by pixel.

* **114 identical.**
* **R03, R05, D01, D02 differ** only inside form fields: drawn text replaced by real, labelled `<input>` elements
  (expected and intended).
* Site pages differ only by the new "Prototype" item in the top navigation and, on screen pages, the demo bar.

Earlier runs found and fixed three real regressions before this result: `<b>` elements turned into links lost their
bold weight; `site.css`'s link colour applied to converted controls; block buttons stopped filling their row.

## Defects found by testing and fixed during the phase

1. HTML parser re-serialised a bare `&to` as `&to;` (found by visual parity).
2. A failed command was cached by its idempotency key, so retrying after fixing a validation error returned the old
   error (found by browser Scenario F; regression unit test added).
3. Food pickup reported the photo error before the "not ready" error (guard order).
4. Toggle switches without accessible names; icon-only vehicle tiles on R07 without names (static test).
5. Visual regressions listed above.
6. State panels re-rendered every 400 ms, which could swallow clicks and lose focus (now only on content change).
7. Demo server logged an exception for 404s; test harness left headless browsers running and could hit `EBUSY`
   on Windows (fixed; process-tree clean-up verified).

## Not tested

Firefox, Safari, Linux, real phones (the two-phone flow was tested with two isolated browser profiles), screen
readers, colour contrast of the original designs, the original PNG generator (`shots.py`).
