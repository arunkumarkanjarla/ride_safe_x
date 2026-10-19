# RideNova Admin portal

Static web application: HTML, CSS and JavaScript only. No build step, no backend, no database. This folder is
complete on its own: every file it loads is inside it, and it does not need any other folder of the repository.

**Server:** `xxx.xx.xx.123` – served at `http://xxx.xx.xx.123/`

## Files

| File | What it holds |
| --- | --- |
| `index.html` | The 31 screens of this application (each `<section data-sid="…">`); the first screen is `A01` |
| `assets/css/base.css` | Design system (colours, typography, buttons, lists, cards) |
| `assets/css/components.css` | Form fields, dialogs, toasts, status panels, focus styles |
| `assets/css/app.css` | Page layout |
| `assets/css/screens.css` | Spacing and layout details used by these screens |
| `assets/js/config.js` | Brand name and the addresses of the other applications |
| `assets/js/controllers.js` | Behaviour of each screen (`def('A01', …)`) |
| `assets/js/app.js` | Navigation (`#/A01` routes), forms, dialogs, toasts |
| `assets/js/engine.js`, `state-machines.js`, `roles.js`, `data.js` | Simulated back office: rules, states and sample data, in memory |
| `assets/js/screens.js` | Screen list used for navigation |
| `assets/js/kit.js` | Helpers used by `controllers.js` |
| `assets/img/favicon.svg` | Browser tab icon |
| `assets/js/agent-control.js`, `assets/css/agent-control.css` | Agent portal control (A31): agents, roles, channels, routing, templates, announcements, publish |
| `assets/js/agent-policy.js` | The agent portal policy as published (the starting draft of A31) |
| `assets/js/agent-sync.js` | Live link with agent portals open on the same site (BroadcastChannel) |
| `assets/js/ops-data.js` | Operations data: country → state → city masters and a generated synthetic data set (vehicles, rides, food & parcel orders, restaurants, partner applications) |
| `assets/js/ops-ui.js` | Shared parts of the operations screens: location filter, sortable paged tables, dialogs, audited actions |
| `assets/js/ops-map.js` | World map with live vehicles: groups with count badges, zoom to city, driver card on hover |
| `assets/js/ops-dashboard.js` | Command center (A02) and full-screen live map (A03) |
| `assets/js/ops-rides.js` | Rides list and ride detail with actions (A04) |
| `assets/js/ops-orders.js` | Food & parcel operations (A27) |
| `assets/js/ops-partners.js` | Partner onboarding review workflow (A24) |
| `assets/css/ops.css` | Styles of the operations screens |
| `assets/img/vehicles/*.svg` | Vehicle images on the map (cab, auto, bike, premium, XL/SUV, bus, delivery, parcel van) |

## Run

```bash
py -m http.server 8080
```

Open http://127.0.0.1:8080/ . Each page load starts a fresh, signed-out session; data is synthetic and kept in memory.

## Deploy

Copy the **contents** of this folder (`index.html`, `README.md`, `assets/`) to the web root of `xxx.xx.xx.123`. Any static web server works
(nginx, Apache, IIS); `index.html` must be the default document. No other folder is needed on this server.

Links to the other applications open the addresses in `assets/js/config.js`:

- Customer app: `http://xxx.xx.xx.124/`
- Driver app: `http://xxx.xx.xx.125/driver-app/`
- Partner app: `http://xxx.xx.xx.125/patner-app/`
- Agent portal: `http://xxx.xx.xx.126/`

State is kept in memory per browser tab, so an application on one server does not see rides, orders or tickets created in
an application on another server (no backend in this phase).

## Operations screens

The location filter (country → state → city) is shared by A02, A03, A04, A24 and A27; it starts at *All countries*, so
every screen shows all data until you narrow it.

* **A02 Command center** – compact KPI cards (each opens the page behind the number: rides, live map, SOS, payments,
  reports, orders, partner applications), world map with vehicle groups and counts, safety alerts, items needing
  attention, rides per hour and a breakdown by country, state or city (click a row to drill down).
* **A03 Live map** – the map fills the screen (⛶ for full screen). Filters: All, Available, On trip, Offer pending, SOS,
  Offline; location; vehicle type; search by plate, driver or ride. Zoomed out, vehicles are grouped per city and per
  type with a count badge; click a group or zoom in to split it. Hover a vehicle for the driver card (click to keep
  it open): rating, plate and model, status, ride, speed, last ping, trips and earnings today, *Open ride*, *Call
  driver*, *Message*. Positions move every 3 seconds (simulated).
* **A04 Rides** – every ride with status tabs and counts, service, payment and time filters, search, sorting, paging
  and CSV export. The detail view shows rider, driver, vehicle, route, fare breakdown, payment, timeline and notes, with
  the actions allowed in the ride's state: call, message, assign / reassign driver, cancel (reason, fee), refund (up to
  the paid amount), retry payment, open incident, flag for fraud review, add note, download receipt.
* **A27 Food & parcel orders** – KPI cards that filter the views, a live board (Needs action, New, Accepted, Preparing,
  Ready, Out for delivery), all orders with filters, late orders with reasons, restaurants (pause / resume, call) and
  volume per 15 minutes. An order opens in a side panel: progress, items and totals, people, timeline, and move to the
  next stage, assign / reassign courier, credit customer, cancel & refund, escalate to the partner, call, note.
* **A24 Partner onboarding review** – applications from restaurants, hotels, rental fleets and bus operators with stage,
  type, reviewer and location filters and a 48-hour SLA. Flow: Submitted → Document review (verify or reject each
  document, override automatic checks with a note, request more information ↔ partner re-submits) → Site visit
  (restaurants and hotels: schedule, passed / failed) → Agreement (commission 5–30 %) → Approved → Live; Reject (with
  reason, can be reopened) and Suspend / Reinstate. The next step unlocks only when the current one is complete.

Every action is checked against the mock role (A20) and written to the audit log (A19), allowed or denied. All data is
synthetic and generated in the browser; nothing is stored or sent.

## Screens

- `#/A01` Admin login & MFA
- `#/A02` Operations command center
- `#/A03` Live map
- `#/A04` Rides (list and ride detail)
- `#/A27` Food & parcel orders
- `#/A23` Services & countries
- `#/A26` Long-distance & sharing
- `#/A25` Network coverage map
- `#/A24` Partner onboarding review
- `#/A05` Riders
- `#/A06` Drivers
- `#/A07` KYC review
- `#/A08` Vehicles & fleet
- `#/A09` Pricing & surge
- `#/A29` Daily fees, taxes & zone rates
- `#/A10` Zones & geofences
- `#/A11` Payments & refunds
- `#/A28` Deals & loyalty
- `#/A12` Support tickets
- `#/A30` Disputes
- `#/A13` Safety & SOS console
- `#/A14` Fraud review queue
- `#/A15` Telephony console
- `#/A31` Agent portal control
- `#/A16` AI insights
- `#/A17` Reports & analytics
- `#/A18` Government reports
- `#/A19` Audit log
- `#/A20` Roles & permissions
- `#/A21` Notifications & campaigns
- `#/A22` System configuration
