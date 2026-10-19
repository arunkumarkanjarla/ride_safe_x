# Automated tests

All tests use only Python's standard library, Node.js built-ins and an installed Edge/Chrome (driven through the
DevTools protocol by `tests/browser/cdp.js`). Nothing is downloaded. Run from the repository root.

| Suite | Command | What it checks | Duration (measured) |
| --- | --- | --- | --- |
| Static and build | `py -m unittest discover -s tests -p "test_*.py" -v` | page counts; no inline CSS/JS/handlers/`javascript:`; CSP on every page; no `eval`/`innerHTML`; no external resources; every local link, script, stylesheet and image resolves; HTML round-trips through the parser; generated CSS covers every class; wiring table matches the mocks; every screen reachable from controls; every control and input has an accessible name; no nested controls; two builds are identical and match the repository | ~8 s |
| Wiring only | `py tests/check_wiring.py` | lists every wiring problem at once | ~2 s |
| Mock engine | `node --test tests/engine/engine.test.js` | state machines and guards; scenarios A–J at engine level; duplicate submissions; failed-attempt retry; offline queue; RBAC; auth limits; reset and cross-tab storage | <1 s |
| Browser end-to-end | `node --test --test-concurrency=1 tests/browser/e2e.test.js` | smoke load of all 118 screens without errors; scenarios A–J through the real UI; form validation; keyboard; 375 px responsive layout; reset | ~3 min |
| Two devices | `node --test tests/browser/two-device.test.js` | two isolated browser profiles share one ride through `tools/demo_server.py` | ~20 s |
| Visual parity | `node tests/browser/visual-compare.js <reference-root> . mocks --nojs --isolate` | pixel comparison of every mock against the supplied package (e.g. `D:\RideSafeX`) with scripts off, mock isolated | ~4 min |

On Linux use `python3` instead of `py`. Set `RN_BROWSER` to the browser executable if it is not found
automatically.

Notes
* Browser tests open pages from `file://`, the same way a reviewer double-clicks them.
* Timers run in *Fast demo* mode; scenario C waits for the full 35 s search window on purpose.
* `--isolate` moves the mock to a fixed position before the screenshot; without it, the new demo bar shifts mocks
  by a fraction of a pixel and every mock reports small differences.
* Results of the runs made for this phase are in [../reports/test-report.md](../reports/test-report.md).
