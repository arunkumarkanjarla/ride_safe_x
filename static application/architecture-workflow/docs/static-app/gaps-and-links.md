# Broken-link report and missing-functionality report

## Broken links and missing assets

| Found | Where | Fix |
| --- | --- | --- |
| 19 broken links | root `README.md` (docs moved into `architecture-workflow/`) | README rewritten; all links verified by a Markdown link check |
| No entry points | root `index.html`, all application folders empty, no `support-portal/` | Generated entry page, five applications and the connected demo |
| Specification pages loaded the previous runtime that kept state in `localStorage` | `architecture-workflow/screens/*` | Pages are static documentation again (the mock links still navigate between specifications) with an *Open in the app* link; the runtime now runs only in the applications |
| Prototype console page used `localStorage` | `architecture-workflow/prototype/index.html` | Replaced by links to the applications and the connected demo |
| 26 new screens without images | `architecture-workflow/images/screens/*` | Rendered with `tools/shots.js` |

Current status: no broken local links, scripts, stylesheets, images or routes in any application, the entry page,
the connected demo or the blueprint (`tests/test_apps.py`, `tests/test_static.py`).

## What is simulated or not yet functional

| Area | Behaviour now | Missing / open |
| --- | --- | --- |
| Long-distance, shared seats, buses, rentals, hotels (customer) | Every screen navigable with the approved sample data; booking buttons record a simulated booking event and continue to the trip plan or tickets | No state machines for these bookings on the customer side; partner bookings (P04–P06) are independent sample bookings |
| Parcels | Navigable; booking records an event | No parcel state machine shared with drivers |
| Deals, price alerts, wallet, offers | Navigable; actions show labelled simulated results | No wallet balance changes |
| Offline planning (R38–R40) | Navigable; offline pack and SOS-by-SMS simulated | Check-in window timers not simulated |
| Partner onboarding (P01) | Records an application event and opens the matching partner screen | Not linked to the admin review queue (A24) |
| Partner menu (P03) | Availability switches toggle in the UI and record an event | Not reflected in the customer menu (R45) |
| Admin pricing, zones, reports, notifications, configuration, AI insights | Permission-checked simulated actions written to the audit log | No editable rule models |
| Admin disputes (A30) | Queue and decision buttons with permission checks | Rows are sample data, not linked to support tickets |
| Telephony (A15) | Shows the demo session's support call-backs | Masked ride calls are not logged |
| Customer notifications (R56) | Built from the demo session's ride, order and ticket events | No push notifications (by design) |
| Cross-device demo | Each phone or browser has its own in-memory demo | Sharing between devices needs a stateful server (not approved) |
| Driver location | Static map illustrations | No moving vehicle animation |

## Requirements that need product-owner decisions

See [workflows.md](workflows.md) §9 and [../analysis/missing-requirements.md](../analysis/missing-requirements.md) §2.
