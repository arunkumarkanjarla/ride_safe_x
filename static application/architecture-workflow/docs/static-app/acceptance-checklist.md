# Acceptance checklist and test results – static application phase

Date 2026-10-10. Environment: Windows 11, Python 3.14.2, Node.js 24.18.0, Microsoft Edge 155 (headless via
`tests/browser/cdp.js`). Every result below comes from a run on the final code; nothing is assumed.

## Test runs

| Suite | Command (from `architecture-workflow/`) | Result |
| --- | --- | --- |
| Blueprint static tests | `py -m unittest discover -s tests -p "test_*.py"` (test_static.py, 13 tests) | **Pass** (part of 25 tests, all passing) |
| Application static tests | same command (test_apps.py, 12 tests: incl. admin desktop screens have header, body and footer; the agent portal is a desktop web page loading the admin-owned policy; each folder self-contained with no reference to another folder, controllers only for its own screens, screen styles exactly matching its pages) | **Pass** |
| Wiring table | `py tests/check_wiring.py` | **Pass** – 145 screens |
| Engine unit tests | `node --test tests/engine/engine.test.js` | **25/25 pass** |
| Browser end-to-end | `node --test --test-concurrency=1 tests/browser/e2e.test.js` | **13/13 pass** (165 s), including "no prototype header or demo controls in any app", "agent portal" and "separate servers" |
| Agent portal and admin control | `node tests/browser/agent-portal.test.js` | **Pass** – sign-in rules, every page, e-mail reply, social move-to-private, call answer/hold/hang up/wrap-up, credit above the role limit to Finance, admin A31 switches a channel off and the agent sees it, live monitor, remote sign-out, no script errors |
| Two-device test (previous phase) | `tests/browser/two-device.test.js` | **Skipped** – depended on the retired server-based sync |

## Brief checklist (Phase 12)

| Check | Result | Evidence |
| --- | --- | --- |
| All expected pages exist | Pass | test_apps: entry points; every screen in its app exactly once |
| All navigation links work | Pass | test_apps: every `href`, `#/route`, cross-app link and `data-go`/`data-next` target resolves |
| Local CSS, JavaScript and images resolve | Pass | test_apps + test_static |
| No inline CSS or JavaScript | Pass | test_apps + test_static (style attributes, `<style>`, inline scripts, handlers, `javascript:` URLs) |
| No nonfunctional controls | Pass | e2e "every app": every screen opens without errors and every `x.*` action has a handler; wiring gives every remaining control a labelled simulated outcome |
| Critical form validation | Pass | e2e: phone, OTP, profile name, partner e-mail, KYC submission, ticket description, agent code, resolution fields, MFA |
| Demo reset restores the initial state | Pass | e2e "keyboard and reload": reloading an application starts a fresh, signed-out session with no rides |
| Invalid ride transitions prevented | Pass | engine tests + e2e driver (start without assignment, wrong OTP, double completion) |
| Rider and driver happy paths | Pass | e2e customer city ride, e2e driver |
| Rejection, timeout and cancellation | Pass | e2e customer alternates (decline + expiry + reassignment, no driver + retry, cancellation) |
| Payment pending and failure represented correctly | Pass | e2e: R17 shows Failed and never Paid before settlement; rebooking refused until paid |
| Partner order flows | Pass | e2e partner (accept with prep time, mark ready, booking confirm, rental handover photos) |
| Admin status updates | Pass | e2e admin (KYC denial by role, SOS lifecycle, manual dispatch, table search/filter/sort) |
| Support ticket creation | Pass | e2e connected demo (customer ticket appears in the agent portal inbox); engine tests |
| Chat scenarios | Pass | engine test (queue, simulated agent, keyword reply, escalation to a ticket, unavailable agents); every agent-portal page incl. Live chat renders without errors |
| Voice-support scenarios | Pass | e2e agent portal and agent-portal test (incoming call, answer, hold, hang up, wrap-up); engine test (busy, failed, missed) |
| E-mail and social media | Pass | e2e agent portal (e-mail reply); agent-portal test (public post moved to a private message) |
| Agent portal controlled by the admin | Pass | e2e agent portal (suspended account and wrong code refused, credit above the role limit escalated); agent-portal test (A31 publish switches a channel off for the agent, monitor, remote sign-out) |
| Responsive layouts | Pass at 375×700, 1366×600 and 1920×950 | e2e "Layout": the page never scrolls in any app, the app is never cut off, long content scrolls inside the screen (header and bottom navigation stay), admin desktop screens (incl. A31) have header, scrolling body and footer; the agent portal does not scroll at 1366×768; physical phones not tested |
| Runs without backend services | Pass | applications open from `file://`; test_apps: no network, storage or device APIs in any script |
| Each application on its own server | Pass | test_apps: no `../` in any folder, external links only to the configured server addresses; e2e "separate servers": the folders served by four servers (driver and partner sharing one) load only their own files without errors, and A31 in the admin portal opens the agent portal on its server |
| Cross-application consistency | Pass (connected demo) | e2e connected demo: customer booking → driver offer and acceptance → admin state → support ticket linked to the same ride, answered in the agent portal |

## Final acceptance criteria (Phase 17)

| Criterion | Status |
| --- | --- |
| Customer onboarding, login and registration simulation | Met |
| Customer ride booking start to finish | Met |
| Driver onboarding and ride execution | Met |
| Admin inspects and simulates ride operations | Met (monitoring, timeline, dispatch, cancel, refund, SOS, KYC) |
| Partner order and booking workflows | Met (food orders, hotel, rental, bus bookings) |
| Agent portal (web) for customers, drivers and partners on calls, e-mail, chat and social media, controlled by the admin (A31) | Met |
| All approved screens reachable | Met (145 screens; R51 has no entry control on R29 in the approved design and is reached from other links) |
| Important controls have meaningful outcomes | Met (actions, navigation or labelled simulated results) |
| Cross-application state consistent where technically supported | Met in the connected demo; not possible across separate tabs, browsers or devices with in-memory state (documented) |
| Framework-free HTML, CSS and JavaScript; all styling and scripts external | Met |
| No backend or database required | Met |
| Local links and assets validate | Met |
| Security limitations documented | Met – [security-rules.md](security-rules.md) |
| Installation and testing instructions | Met – [install-and-test.md](install-and-test.md) (Windows verified; Linux and phones not executed) |
| Remaining gaps documented | Met – [gaps-and-links.md](gaps-and-links.md), [workflows.md](workflows.md) §9 |

## Not tested

Firefox, Safari, Linux, physical phones, screen readers, colour contrast audit, the connected demo on very small screens.
