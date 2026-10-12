# Missing requirements, gaps and open business questions

Status values: **Assumed** = the prototype uses the stated assumption (clearly labelled in the UI/docs, easy to
change); **Open** = needs a product decision before the backend phase. Nothing here is treated as approved policy.

## 1. Screens or states the brief asks for that the supplied set does not have

| Brief item | Supplied coverage | Prototype treatment |
| --- | --- | --- |
| Rider registration separate from login | R03 handles both (phone OTP) | Kept as one flow; new users go R04 → R05 |
| Saved addresses screen | Only list rows in R07/R28 | Rows are wired; no new screen (Open) |
| No eligible driver / dispatch timeout screen | Edge case text on R11 only | State panel on R11 (no-driver, retry, cancel) |
| Driver rejection / reassignment visible to rider | Not shown | R11 shows "offer declined, trying next driver" status line |
| Payment failed / pending | R17 shows success only | R17 shows pending/failed variants from mock state |
| Rider incident status after SOS | R16 shows initial state | R16 shows live incident state from mock engine |
| Trip-sharing | Button on R15 / R12 | Simulated share link toast (no link leaves the page) |
| KYC rejected / document expired driver states | D04 shows "in review"; D17 shows expiry | D04 reflects pending/approved/rejected from mock state |
| Driver account/profile screen | none (bottom nav "Account") | Nav goes to D04 (Open) |
| Partner settings / support screen | none (nav "Settings") | Nav goes to P01 (Open) |
| Admin rides list | none ("Rides" → A04 detail) | Sidebar goes to A04 (Open) |
| Admin MFA failure / lockout | spec text on A01 | Simulated: wrong code error, 5 attempts lock |
| Partner support | none | Not added (Open) |

## 2. Missing business rules (Open unless marked)

| Area | Question |
| --- | --- |
| Cancellation | Rider cancel fee amount after 3 min? Driver-side cancellation penalty? Free cancel window after reassignment? |
| Waiting / no-show | D09 states "free for 3 min, then ₹1/min; cancel for no-show after 7 min" – confirm, and decide the no-show fee and who receives it |
| Dispatch | What does the rider see between offers? Is the fare re-quoted if search exceeds X min? Max reassignments shown? |
| Payment | Exact retry policy ("retry once") timing; is the driver paid when online payment fails? Debt limit before blocking bookings? |
| Refunds | Who may refund how much without second approval? Partial refund rules? |
| SOS | Can a rider cancel an SOS? Who can mark FALSE_ALARM? Driver notified of rider SOS? |
| KYC | Rejection reasons list, number of re-submissions allowed, appeal path |
| Documents | Grace period after expiry? (D17 implies immediate block for PUC) |
| Food | Who pays when the restaurant rejects after accept? Cancellation after PREPARING? Cold-food complaint refund rules |
| Parcels | Value limit without insurance; prohibited items list per country |
| Ratings | Can ratings be edited within 7 days? Minimum rating that triggers review? |
| Admin roles | Can roles be combined? Is FLEET_MANAGER row-level filtering required in the portal UI? |
| Partner | Auto-reject after 3 min of no answer – applies to hotels/rentals too? |
| Offline | Who is alerted if the check-in window lapses and contacts are unreachable? |

## 3. Assumptions used by the prototype (Assumed)

1. Rider cancel fee: shown as "₹50 (example)" after 3 simulated minutes; free before that.
2. Payment failure: one simulated retry, then `PAYMENT_FAILED`; rider sees "Pay another way"; new bookings blocked
   until settled (as documented on page 06).
3. Offer timeout uses 15 s by default; the demo panel offers "fast timers" that shorten waits to keep demos short.
4. Dispatch candidate list for the demo is deterministic (driver Arjun K. first, then Imran S., then Kiran P.).
5. SOS can be marked `FALSE_ALARM` only by an admin after the rider confirms safe.
6. KYC "Ask to re-upload" returns the driver to D03 with the flagged document highlighted.
7. Food: restaurant rejection → order `REJECTED` and an automatic simulated refund.
8. Mock role switching demonstrates the page-10 matrix only; it is not security.

## 4. Data and asset gaps

* PNGs cannot be regenerated with the supplied scripts on Windows (Linux paths, Playwright missing).
* No test suite, no dependency manifest, no installation guide existed.
* No accessibility requirements (target WCAG level) were stated – the prototype targets WCAG 2.1 AA practices for the
  interactive controls it adds.
