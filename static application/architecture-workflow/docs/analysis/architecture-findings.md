# Architecture findings that affect the static prototype

Sources: the 27 architecture pages (`architecture/00`–`26`), the 40 SVG diagrams in `images/diagrams/` (labels
extracted programmatically) and `images/reference/reference-architecture.png` (viewed). Only facts that change prototype
behaviour are listed; the future backend design itself is out of scope for this phase.

## 1. Actors and apps

| Actor | App (as documented) | Prototype representation |
| --- | --- | --- |
| Rider / customer | Rider app R01–R55 | `screens/rider/*` |
| Driver / delivery partner | Driver app D01–D27 | `screens/driver/*` |
| Partner (restaurant, hotel, rental, bus operator) | Partner app P01–P07 | `screens/partner/*` |
| Ops, safety, fraud, finance, support, fleet manager, auditor | Admin portal A01–A29 | `screens/admin/*` with a mock role switch |
| Emergency contacts, police/ambulance | external | simulated text only, never contacted |
| Gateways (payments, maps, SMS/WhatsApp, KYC, Asterisk) | external | mock service in `assets/js/rn-engine.js`; no network calls |

## 2. Ride lifecycle (page 03, diagram `03-ride-state-machine.svg`)

States: `REQUESTED → SEARCHING_DRIVER → DRIVER_ASSIGNED (offer) → DRIVER_ACCEPTED/ARRIVING → DRIVER_ARRIVED →
TRIP_STARTED/IN_PROGRESS → TRIP_COMPLETED → PAYMENT_PENDING → PAYMENT_COMPLETED → CLOSED`, plus `NO_DRIVER_FOUND`,
`CANCELLED`, `PAYMENT_FAILED`.

| Rule | Value |
| --- | --- |
| Total search time | 3 min (`max_search_time_s` 180) then `NO_DRIVER_FOUND` |
| Offer window | 15 s (`offer_timeout_s`), reject or timeout → back to `SEARCHING_DRIVER` |
| Max offers per ride | 8 |
| Search radius steps | 2 → 4 → 6 km |
| Reject cooldown | 30 s; a driver who rejects is not offered the same ride again |
| One offer per driver | Redis lock `NX EX 20` (diagram `04-driver-lock.svg`) |
| Arrival | within 100 m or driver taps Arrived |
| Start | OTP verified by driver app |
| Cancellation | allowed until `TRIP_STARTED`; rider cancel fee after 3 min (amount **not specified**) |
| Waiting | waiting charge after 3 min at pickup; no-show after 7 min (amounts **not specified**) |
| In trip | cannot be cancelled, only ended |
| Payment | gateway webhook within 15 min decides `PAYMENT_COMPLETED` / `PAYMENT_FAILED`; retry once; on failure the rider must pay another way and new bookings are blocked until settled |
| Ratings | accepted for 7 days after close |
| Audit | every transition appends a ride event (`rides.ride_events`) |

The brief's simplified machine (`REQUESTED → MATCHING → DRIVER_ASSIGNED → DRIVER_ARRIVED → IN_PROGRESS → COMPLETED`)
maps onto the documented one; the prototype implements the **documented** names and shows the mapping in
`docs/workflows/state-machines.md`.

## 3. Payments (page 06, `06-payment-sequence.svg`)

Payment states: `CREATED, AUTHORISED, CAPTURED, FAILED, REFUND_PENDING → REFUNDED, SETTLED`. The gateway webhook is the
source of truth. Methods: UPI, card, wallet, cash, corporate. Pricing (page 26): driver keeps 100% of fare; one flat daily
fee ₹10–15 per working day, capped at 10% of that day's fares; GST 5% on ride included in price.

## 4. Safety (page 08, `08-sos-sequence.svg`, `08-incident-states.svg`)

Incident states: `OPEN → ACKNOWLEDGED (agent, < 60 s) → IN_PROGRESS → ESCALATED (police/ambulance) → RESOLVED → CLOSED`,
and `FALSE_ALARM` (rider confirms safe). SOS = hold 2 s; GPS switches to 1 s; contacts get a live link; agent calls via
masked line. **"The platform never claims to have contacted police unless an agent actually did"** – the prototype keeps
that wording and labels everything simulated.

## 5. Food orders and parcels (page 20, `20-food-states.svg`)

Food: `PLACED → ACCEPTED (prep time set) → PREPARING → READY → PICKED_UP (seal photo) → DELIVERED (OTP or photo)`;
`REJECTED/CANCELLED → auto refund`; restaurant no answer for 3 min → auto reject; delivery partner dispatched at
ready-time minus travel time. Delivery options: Priority, Standard, Saver (batch, +12 min), Pickup, Scheduled.
Parcels: sender OTP, receiver OTP and photos at each handover.

## 6. Driver onboarding and documents (pages 00, 10; screens D02–D04, D17, A07)

Register → upload licence, RC, insurance, permit, fitness, police verification, photo → KYC queue → approve / ask to
re-upload / reject → training → activated. Expired documents block going online (D17). Driver selfie check at shift
start (page 08).

## 7. Security and permissions (page 10)

Role/permission matrix with 8 roles (SUPER_ADMIN, OPS_MANAGER, SAFETY_MANAGER, FRAUD_ANALYST, FINANCE_MANAGER,
SUPPORT_AGENT, FLEET_MANAGER, AUDITOR) and 13 permissions (`ride.view`, `ride.cancel`, `driver.verify`,
`payment.refund`, `incident.view`, `incident.close`, `fraud.block_account`, `pricing.edit`, `report.export`,
`government_report.create`, `government_report.approve`, `audit.view`, `user.pii.view_full`). The prototype reproduces
this matrix for **demonstration only**; page 10 itself states that permissions are checked in every service, never only
in the UI. Admin login: OIDC + MFA, 8 h session, 30 min idle timeout. OTP: 5 min, max 5 tries, 3 requests / 10 min.

## 8. Offline / no-network (page 21, `21-dead-zone-sequence.svg`)

Offline pack, check-in window (expected exit + 20 min buffer), SOS queued and sent by SMS at first signal, events queued
and reconciled on reconnect (D19 "ride.reconciled"). Card/UPI unavailable offline. This drives Scenario I.

## 9. Other rules used by screens

* Dispatch scoring weights, women-preference (page 04); priority weights Urgent/Balanced/Saver/Flexible/Deals (page 17).
* Telephony: proxy number bound from `DRIVER_ACCEPTED` until 30 min after trip end (page 07) – masked call is only
  enabled in those states in the prototype.
* Sharing: women-only seats bookable only by women who opted in; parcels declared, photo + code at every handover (19).
* Deals: coupons never reduce driver/partner earnings; campaign budgets hard-capped (24).
* Compliance: AI only flags; a person approves government reports (15).

## 10. Contradictions and inconsistencies found

| # | Finding | Where | Treatment in prototype |
| --- | --- | --- | --- |
| 1 | Mobile apps described as **Flutter** (build.py app intros, page 00) but the brief's future stack is **React Native / Expo** | `build.py`, `architecture/00` | Not changed (documentation only); flagged for decision |
| 2 | Reference image lists "Split Payments" / commission concepts; page 26 says **no per-ride commission**, flat daily fee | reference PNG vs page 26 | Page 26 (newer, detailed) followed |
| 3 | Brief's simplified ride states vs 13 documented states | brief vs page 03 | Documented states implemented, mapping documented |
| 4 | Product/brand naming: RideNova (pages), RideSafeX (folder), ride_safe_x (repo) | – | Brand stays RideNova via `brand.js` |
| 5 | Kubernetes in page 13 and the reference image vs Docker Compose in the brief | page 13 | Out of scope (backend phase) |
| 6 | Admin sidebar has no entry for A29 (daily fees & taxes) and no Rides list; "Rides" points at a single ride (A04) | `components.ADMIN_MENU` | Sidebar wired to nearest screen; gap recorded |
| 7 | Driver bottom nav "Account" and Partner nav "Settings" have no screens | `components.DRIVER_NAV`, `PARTNER_NAV` | Wired to D04 / P01 respectively; gap recorded |
| 8 | Partner commission ranges (page 23) vs "platform takes nothing" (page 26) – page 26 concerns rides only | 23 vs 26 | Treated as consistent; question recorded |
