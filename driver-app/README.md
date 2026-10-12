# RideNova Driver app

Static web application: HTML, CSS and JavaScript only. No build step, no backend, no database. This folder is
complete on its own: every file it loads is inside it, and it does not need any other folder of the repository.

**Server:** `xxx.xx.xx.125` – served at `http://xxx.xx.xx.125/driver-app/`

## Files

| File | What it holds |
| --- | --- |
| `index.html` | The 29 screens of this application (each `<section data-sid="…">`); the first screen is `D01` |
| `assets/css/base.css` | Design system (colours, typography, buttons, lists, cards) |
| `assets/css/components.css` | Form fields, dialogs, toasts, status panels, focus styles |
| `assets/css/app.css` | Page layout |
| `assets/css/screens.css` | Spacing and layout details used by these screens |
| `assets/js/config.js` | Brand name and the addresses of the other applications |
| `assets/js/controllers.js` | Behaviour of each screen (`def('D01', …)`) |
| `assets/js/app.js` | Navigation (`#/D01` routes), forms, dialogs, toasts |
| `assets/js/engine.js`, `state-machines.js`, `roles.js`, `data.js` | Simulated back office: rules, states and sample data, in memory |
| `assets/js/screens.js` | Screen list used for navigation |
| `assets/js/kit.js` | Helpers used by `controllers.js` |
| `assets/img/favicon.svg` | Browser tab icon |

## Run

```bash
py -m http.server 8080
```

Open http://127.0.0.1:8080/ . Each page load starts a fresh, signed-out session; data is synthetic and kept in memory.

## Deploy

Copy the **contents** of this folder (`index.html`, `README.md`, `assets/`) to the `/driver-app/` folder of the web root on `xxx.xx.xx.125`. Any static web server works
(nginx, Apache, IIS); `index.html` must be the default document. No other folder is needed on this server.

Links to the other applications open the addresses in `assets/js/config.js`:

- Admin portal: `http://xxx.xx.xx.123/`
- Customer app: `http://xxx.xx.xx.124/`
- Partner app: `http://xxx.xx.xx.125/patner-app/`
- Agent portal: `http://xxx.xx.xx.126/`

State is kept in memory per browser tab, so an application on one server does not see rides, orders or tickets created in
an application on another server (no backend in this phase).

## Screens

- `#/D01` Driver login
- `#/D02` Registration
- `#/D03` Upload documents
- `#/D04` Verification status
- `#/D05` Home (offline)
- `#/D21` Choose services
- `#/D06` Online & waiting
- `#/D17` Document expiry alerts
- `#/D07` Incoming ride request
- `#/D08` Navigate to pickup
- `#/D29` Call rider
- `#/D09` Arrived & start trip
- `#/D10` Trip navigation
- `#/D11` Trip complete & collect
- `#/D12` Rate rider
- `#/D22` Delivery request
- `#/D23` Pickup & delivery proof
- `#/D24` Publish a long trip
- `#/D25` Seats & parcels manifest
- `#/D26` No-network stretch ahead
- `#/D18` Driver SOS
- `#/D19` Offline mode & sync
- `#/D13` Earnings
- `#/D27` Today's earnings & daily fee
- `#/D14` Wallet & payouts
- `#/D15` Incentives
- `#/D16` Trip history
- `#/D20` Driver support
- `#/D28` Account & profile
