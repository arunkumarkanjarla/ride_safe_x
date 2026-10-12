# Known limitations

## Simulated, by design (this phase)

* Every service is simulated in the browser: dispatch, payments and webhooks, refunds, SMS/WhatsApp/e-mail OTP,
  masked calls (Asterisk), maps, GPS and ETA, camera/photos, contacts, KYC checks, AI assistant, reports and exports.
  The UI labels these results "Simulated".
* Sign-in, MFA and roles are demonstrations only; anyone can change the state or the role. See
  [security-baseline.md](../guides/security-baseline.md).
* Many screens keep their approved sample data (e.g. trip history lists, admin KPIs). Live data from the mock
  engine is shown where it matters for the scenarios: ride and offers (R11, R12, R15, R17, D07–D11, A04), food order
  (R46, P02, D22, D23), incident (R16, A13), KYC (D03, D04, A07), audit (A19), demo bar and console.
* Booking-type actions outside the ride and food flows (bus seats, shared seats, rentals, hotels, parcels, price
  alerts, passes, coupons) record an event and show a result, but do not create their own state machines.
* Only one active ride, one active food order and one driver application exist at a time; the driver app always
  represents Arjun K. (rides) and the delivery screens act for the courier assigned to the order.
* Maps are the static illustrations from the designs; the driver does not visibly move.

## Technical

* Shared state uses `localStorage`; two different browsers or devices share state only through
  `tools/demo_server.py` (last writer wins, 1-second polling). Simultaneous actions on two devices can overwrite
  each other; the engine's guards still refuse illegal transitions.
* CSP is a `<meta>` tag (no header-only directives).
* `source/shots.py` / `shot.py` (PNG regeneration) still contain the original Linux paths and need Playwright; PNGs
  were not regenerated. The PNGs show the approved static design; the live pages add real inputs and state panels.
* Tested in Microsoft Edge 155 on Windows 11 only (headless and the in-app browser). Firefox, Safari, real phones
  and Linux were not tested.
* Accessibility: controls are keyboard operable and named; colour contrast of the original designs and screen-reader
  announcements of every state change were not audited.
* Visual parity: with scripts disabled and the mock isolated, mocks match the supplied package except where real
  form inputs replace drawn text (see [test-report.md](test-report.md)).

## Gaps in the supplied designs (recorded, not invented)

No dedicated screens for saved addresses, driver account/profile, partner settings/support, admin rides list,
payment-failed or no-driver states (handled with state panels), and no visible entry control for R51 Emergency mode
on R29 (reachable from the console, indexes and flows). Details: [missing-requirements.md](../analysis/missing-requirements.md).

## Unresolved business questions

See [missing-requirements.md](../analysis/missing-requirements.md) §2 (cancellation and waiting fees, dispatch
behaviour between offers, payment retries and driver payment on failure, refunds, SOS cancellation and false alarms,
KYC re-submission limits, document grace periods, food cancellation liability, parcel limits, rating edits, role
combinations, partner auto-reject, overdue check-in escalation) and the role assumptions in
[rbac.md](../workflows/rbac.md).
