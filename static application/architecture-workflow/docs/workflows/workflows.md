# User workflows and scenarios (static prototype)

How the approved workflows behave in the prototype. Transition tables are generated in
[state-machines.md](state-machines.md); the screen route map is in [navigation-map.md](navigation-map.md).
Everything described here is **simulated in the browser** by `assets/js/rn-engine.js`; no backend, network or
real service is involved.

Timer values: the demo bar's **Timers** switch selects *Fast demo* (default) or *As specified* (values from the
architecture pages). Both columns are listed below.

| Timer | As specified | Fast demo |
| --- | --- | --- |
| Driver offer window | 15 s | 7 s |
| Total driver search | 180 s | 35 s |
| Simulated driver response | 4 s | 2.5 s |
| Driver reaches pickup (auto) | 12 s | 5 s |
| Trip start after arrival (auto) | 6 s | 4 s |
| Trip length (auto) | 15 s | 7 s |
| Payment webhook | 3 s | 2 s |
| Free cancellation window after acceptance | 180 s | 20 s |
| Reject cool-down | 30 s | 10 s |
| Restaurant no-answer auto-reject | 180 s | 45 s |

**Other parties.** With *Act automatically* (default) the mock dispatcher, drivers, restaurant, courier and payment
gateway respond on their own so one tab can demonstrate a whole journey. With *Played by me in other tabs* the
driver (Arjun K.), restaurant and courier wait for you to act in their app; the other candidate drivers in
Scenario B still respond automatically.

## 1. Ride lifecycle and dispatch (Scenarios A, B, C)

| Step | Actor | Precondition (guard) | Result | UI |
| --- | --- | --- | --- | --- |
| Book (R10 *Confirm pickup*) | rider | signed in; no active ride; no unpaid fare; device online | `REQUESTED → SEARCHING_DRIVER`, search deadline set, first offer sent (`DRIVER_ASSIGNED`) | R11 shows each offer with its countdown |
| Offer accepted (D07 *Accept*) | driver | the offer is pending, addressed to this driver, not expired | `DRIVER_ACCEPTED → DRIVER_ARRIVING`; driver `ON_TRIP`; masked number bound | R11 → R12 automatically; D07 → D08 |
| Offer declined (D07 *Decline*) | driver | pending offer for this driver | back to `SEARCHING_DRIVER`; driver cool-down; next candidate offered | R11 lists "declined – trying the next driver" |
| Offer expires | system | offer still pending at its deadline | back to `SEARCHING_DRIVER`; next candidate | R11 lists "did not answer" |
| No candidates left | system | — | keeps searching ("widening the search") until the deadline | R11 countdown |
| Search deadline | system | still `SEARCHING_DRIVER` | `NO_DRIVER_FOUND` | R11 panel: *Try again* (new ride), *Choose another vehicle*, *Close* |
| Arrived (D08 slide) | driver / system | ride accepted by this driver | `DRIVER_ARRIVED` | R12 "Your driver has arrived"; D09 waiting timer |
| Start (D09 code) | driver | `DRIVER_ARRIVED` and code = rider's trip OTP (4827) | `TRIP_STARTED → TRIP_IN_PROGRESS` | wrong code: field error, nothing changes; R12 → R15 |
| End (D10 slide) | driver | trip in progress, ride belongs to this driver | `TRIP_COMPLETED → PAYMENT_PENDING` | R15 → R17; D10 → D11; a second "end" is refused |
| Payment webhook | gateway | `PAYMENT_PENDING` | success → `PAYMENT_COMPLETED`; see §3 for failure | R17 status line and tag |
| Rate (R18) | rider | ride finished; not rated yet | `PAYMENT_COMPLETED → CLOSED` | second rating refused |

Dispatch candidates per scenario (deterministic): A, D, E – Arjun K. accepts. B – Imran S. declines, Kiran P. lets
the offer expire, Arjun K. accepts. C – nobody is eligible; *Try again* simulates a driver coming online.
A driver offered while offline, blocked or cooling down is skipped and the skip is logged.

Admin (A04) shows the same ride: state badge, driver, fare, payment and a live timeline of its events.

## 2. Cancellation (Scenario D)

| When | Who | Result |
| --- | --- | --- |
| `REQUESTED`, `SEARCHING_DRIVER`, `DRIVER_ASSIGNED` | rider, admin (needs `ride.cancel`) | `CANCELLED`, pending offer withdrawn, no fee |
| `DRIVER_ACCEPTED`, `DRIVER_ARRIVING`, `DRIVER_ARRIVED` | rider, driver, admin | `CANCELLED`, driver released; rider fee **₹50 (example)** if after the free window |
| `TRIP_STARTED` and later | anyone | refused: "A trip in progress cannot be cancelled. It can only be ended by the driver." |

Rider cancellations ask for confirmation first (dialog). The fee amount is an assumption (not specified).

## 3. Payment (Scenario E)

`CREATED → CAPTURED` on success. With *Next payment: Fails*, the first webhook declines, the engine retries once,
the second decline sets payment `FAILED` and ride `PAYMENT_FAILED`, and the rider owes the fare:

* R17 shows "UPI payment failed" with a **Failed** tag and never shows *Paid* before settlement.
* New bookings are refused ("Settle your unpaid fare …") until the rider pays another way (UPI, wallet or cash
  buttons on R17), which moves the ride to `PAYMENT_COMPLETED`.
* *Stays pending* keeps `PAYMENT_PENDING` until *Deliver pending payment webhook* on the demo console.
* Cash rides wait for the driver's *Cash collected* on D11.
* Admin refunds (A04/A11, needs `payment.refund`) mark a captured payment `REFUNDED` (simulated).

## 4. Driver onboarding (Scenario F)

`DRAFT → IN_REVIEW → APPROVED → ACTIVE`, with `REUPLOAD_REQUESTED` and `REJECTED` branches.

1. D03: tap each missing/rejected document to attach a synthetic file (nothing is read from disk). *Submit for
   review* is refused while any document is missing or rejected.
2. A07 (needs `driver.verify`): *Approve*, *Ask to re-upload* or *Reject*. The last two require a reason.
3. D04 shows the decision and reason. Re-upload returns the driver to D03 with the document flagged.
4. Approved → *Watch training now* activates the account → the driver can go online (D05).
5. Going online is also refused when a document has expired (D17 can simulate an expired PUC).

## 5. Safety incident (Scenario G)

R16: press and hold SOS for 2 s (keyboard: Enter opens a confirmation). The incident starts `OPEN`, P1, linked
to the ride; contacts "receive" a live link (simulated, nothing is sent). The rider can tap *I'm safe*.

A13 (admin): *Assign to me* (`ACKNOWLEDGED`) → *Start working* (`IN_PROGRESS`) → *Escalate* / *Record
police/ambulance contact* (`ESCALATED`) → *Resolve* (`RESOLVED`) → *Close after review* (`CLOSED`, needs
`incident.close`: Super admin or Safety manager). *Mark false alarm* is offered only after the rider confirmed
they are safe. The rider's R16 panel follows every state. The prototype never states that police were contacted
unless an agent recorded it, and even then labels it simulated.

## 6. Food order (Scenario H)

`PLACED → ACCEPTED → PREPARING → READY → PICKED_UP → DELIVERED`; `REJECTED` / `CANCELLED` refund automatically.

| Step | App | Notes |
| --- | --- | --- |
| Pay ₹458 (R45) | rider | ₹538 items − ₹80 coupon, saver delivery ₹0; one active order at a time |
| Accept with prep time / Reject with reason (P02) | partner | no answer within the window → auto-reject + refund |
| Delivery job offered (D22) | courier (Salim M.) | decline → offered to another partner |
| Mark ready (P02 panel) | partner | |
| Sealed-bag photo, confirm pickup (D23) | courier | pickup refused before *ready* and without the photo |
| Delivery code 4471 (D23) | courier | wrong code refused |
| Track (R46), inspect (A27, events) | rider, admin | R46 steps follow the state |

## 7. Interrupted connectivity (Scenario I)

The demo bar's **This device** switch takes the current app offline (simulated):
* a banner appears and controls that need the network are disabled (`aria-disabled`);
* trip actions that work offline per page 21 (arrive, start with cached code, end, SOS) are **queued** on the
  device, and repeating the same queued action is refused ("Already saved on this phone");
* switching back online replays the queue in order, logs `sync.replayed` and `ride.reconciled`, and the rider and
  admin views catch up. Rejected replays are logged as `sync.conflict`.

## 8. Authorization demonstration (Scenario J)

The admin demo bar has a **Mock role** selector. Restricted actions call the mock RBAC check
([rbac.md](rbac.md)); a denial shows which permission and roles are needed and is written to the audit log
(A19, itself visible only to Super admin and Auditor). This is a UI demonstration, not security.

## 9. Sign-in simulations

| Flow | Codes (public demo values) | Rules simulated |
| --- | --- | --- |
| Rider phone + OTP (R03, R04) | OTP 482716 | 10-digit Indian mobile (6–9 first digit); 3 codes / 10 min; 5 wrong codes → 30 min lock; unknown number → new-user profile (R05) |
| Driver (D01) | OTP read automatically | 90000 12345 = existing demo driver (→ D05); other numbers → registration (D02) |
| Admin MFA (A01) | 730951 | 5 wrong codes → locked |

## 10. Other services

Long-distance search, shared seats, buses, rentals, hotels, trip plans, offline packs, parcels, deals, price
alerts, wallet, support and partner listings are navigable end to end with the approved sample data. Booking-type
buttons record a simulated event and show a labelled result; they do not create state beyond the event history.
See the per-screen table in [screen-image-mapping.md](../analysis/screen-image-mapping.md).

## Open business questions affecting these flows

See [missing-requirements.md](../analysis/missing-requirements.md) §2 and [known-limitations.md](../reports/known-limitations.md).
