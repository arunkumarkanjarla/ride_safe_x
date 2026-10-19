# Workflow and state-transition specification (static application phase)

Ride, payment, incident, food order, KYC and dispatch behaviour is unchanged from the previous phase and documented in
[../workflows/workflows.md](../workflows/workflows.md). All transition tables, including the five machines added here
(ticket, chat, call, booking, plus the existing ones) are generated from `assets/js/rn-machines.js` into
[../workflows/state-machines.md](../workflows/state-machines.md).

## 1. Application sessions (simulated)

* Every application starts **signed out** (first launch / reload / *Reset demo*).
* Loading a scenario in the connected demo signs every role in (scenarios are for demonstrations). Standalone apps
  start signed out on every load; there are no demo controls inside the applications.
* A route that needs a session redirects to the app's sign-in screen with "Sign in first (simulated)".
* Log out (R28, D28, P10, S20 panel) returns to the sign-in screen and the route guard applies again.

## 2. Customer onboarding

R01 → R02 → **R58** (Create account / I already have an account / demo accounts / terms R57) → R03 phone (validated:
10 digits, starts 6–9; 3 codes per 10 min) → R04 code (6 digits; 5 wrong attempts lock for 30 min) →
existing number → R29 home; new number → R05 profile (name required, e-mail optional) → R06 permissions → R29.

## 3. Support ticket (`ticket` machine)

| From | Event | To | Who | Rule |
| --- | --- | --- | --- | --- |
| — | create | OPEN | customer, driver, partner | category, issue and a 10–1000 character description required; optional synthetic attachment; optional linked ride/order/payment |
| OPEN, ESCALATED, REOPENED | assign | IN_PROGRESS | agent | assign to me or reassign to another agent |
| IN_PROGRESS | ask_user | WAITING_ON_USER | agent | "Wait for user" sends the agent's question |
| WAITING_ON_USER | user_reply | IN_PROGRESS | user | any reply from the user |
| open states | escalate | ESCALATED | agent | reason required |
| open states | resolve | RESOLVED | agent | resolution category and notes required |
| open or RESOLVED | close | CLOSED | user or agent | confirmation asked |
| RESOLVED, CLOSED | reopen | REOPENED | user (reason required) or agent | |

Internal notes are kept on the ticket but never shown to the user. Feedback (1–5 stars) is accepted once, after the
ticket is resolved or closed. SLA targets (assumed): P1 1 h, P2 4 h, P3 24 h.

## 4. Chat (`chat` machine)

QUEUED → ACTIVE (simulated agent joins after a few seconds, or an agent accepts on S21/S24) → ENDED (user or agent,
with confirmation). With *Chat agents: None available* a new chat goes straight to UNAVAILABLE and offers a ticket.
User messages get keyword-based replies with a typing indicator. *Turn this chat into a ticket* creates a ticket with
the transcript and ends the chat. Messages: 1–500 characters.

## 5. Voice call-back (`call` machine) – simulated, no audio, no permissions

QUEUED (position 2 → 1) → RINGING (Answer / Decline; not answered → MISSED) → CONNECTED (browser timer) → ENDED (summary).
*Next call-back* option: *All agents busy* → BUSY, *Call fails* → FAILED. Only one active call-back per user. Any
outcome can be turned into a ticket.

## 6. Partner bookings (`booking` machine)

PENDING → CONFIRMED or DECLINED; CONFIRMED → CHECKED_IN (hotel check-in, rental handover – needs the four sides and the
fuel photo, bus boarding) → COMPLETED. Customers or admins may cancel PENDING/CONFIRMED (not exposed in the UI yet).

## 7. Admin manual dispatch

While a ride is SEARCHING_DRIVER or has an offer out, A04 lists online drivers; *Assign* (needs `ride.dispatch`)
withdraws the pending offer and assigns the chosen driver, recorded in the ride timeline. A06 can pause or reactivate
a driver (needs `fraud.block_account`); paused drivers are skipped by dispatch.

## 8. Connected demo

`connected-demo/index.html` (local tool, not deployed) owns the in-memory engine; the apps in its frames use it, so the
customer, driver, admin, partner and support views show the same ride, order, incident and tickets. Cross-app links (for
example *Help centre* in the driver app) open the target app in a pane. Requires a local web server.

Deployed on separate servers (DEPLOYMENT.md), each application keeps its own in-memory state, and cross-app links open the
other server's address from `assets/js/config.js`; separate servers, tabs, browsers and devices cannot share state (by
design of this phase).

## 9. Open questions for the product owner

1. Who may reopen a ticket and for how long after it is resolved? (assumed: user with a reason, any time)
2. SLA targets per priority and per channel. (assumed: 1 h / 4 h / 24 h)
3. Should agents be able to close a ticket without resolving it? (assumed: yes)
4. Call-back windows, retries after a missed call, and whether calls are recorded.
5. CSAT scale and when it is requested.
6. Partner booking cancellation rules and who pays.
7. Manual dispatch permissions and whether the driver can refuse a manual assignment.
8. Rename `patner-app/` to `partner-app/`? (kept as is; all references would be updated by the generator)
9. Legal text for terms and privacy (R57 shows a summary only).
