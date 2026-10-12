# RideNova Customer app

Static web application: HTML, CSS and JavaScript only. No build step, no backend, no database. This folder is
complete on its own: every file it loads is inside it, and it does not need any other folder of the repository.

**Server:** `xxx.xx.xx.124` – served at `http://xxx.xx.xx.124/`

## Files

| File | What it holds |
| --- | --- |
| `index.html` | The 58 screens of this application (each `<section data-sid="…">`); the first screen is `R01` |
| `assets/css/base.css` | Design system (colours, typography, buttons, lists, cards) |
| `assets/css/components.css` | Form fields, dialogs, toasts, status panels, focus styles |
| `assets/css/app.css` | Page layout |
| `assets/css/screens.css` | Spacing and layout details used by these screens |
| `assets/js/config.js` | Brand name and the addresses of the other applications |
| `assets/js/controllers.js` | Behaviour of each screen (`def('R01', …)`) |
| `assets/js/app.js` | Navigation (`#/R01` routes), forms, dialogs, toasts |
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

Copy the **contents** of this folder (`index.html`, `README.md`, `assets/`) to the web root of `xxx.xx.xx.124`. Any static web server works
(nginx, Apache, IIS); `index.html` must be the default document. No other folder is needed on this server.

Links to the other applications open the addresses in `assets/js/config.js`:

- Admin portal: `http://xxx.xx.xx.123/`
- Driver app: `http://xxx.xx.xx.125/driver-app/`
- Partner app: `http://xxx.xx.xx.125/patner-app/`
- Agent portal: `http://xxx.xx.xx.126/`

State is kept in memory per browser tab, so an application on one server does not see rides, orders or tickets created in
an application on another server (no backend in this phase).

## Screens

- `#/R01` Splash
- `#/R02` Onboarding
- `#/R58` Sign in or create account
- `#/R57` Terms & privacy
- `#/R03` Login with phone
- `#/R04` Verify OTP
- `#/R05` Profile setup
- `#/R06` Permissions
- `#/R53` Country, language & currency
- `#/R29` All services home
- `#/R30` Choose your priority
- `#/R52` AI trip assistant
- `#/R51` Emergency mode
- `#/R07` Ride home map
- `#/R08` Search destination
- `#/R31` Compare by priority
- `#/R09` Ride options & fare
- `#/R10` Confirm pickup & pay
- `#/R11` Finding driver
- `#/R12` Driver assigned
- `#/R13` Masked call
- `#/R14` In-ride chat
- `#/R15` Trip in progress
- `#/R16` SOS emergency
- `#/R17` Trip complete & payment
- `#/R18` Rate driver
- `#/R19` Invoice
- `#/R55` Where your money went
- `#/R23` Schedule a ride
- `#/R32` Long-distance search
- `#/R33` Long-distance options
- `#/R34` Shared seat details
- `#/R35` Bus seat & boarding point
- `#/R43` Car & bike rentals
- `#/R36` Trip plan (multi-leg)
- `#/R37` Stops along the route
- `#/R38` No-network warning
- `#/R39` Offline pack & backup plan
- `#/R40` Travelling offline
- `#/R41` Hotels
- `#/R42` Hotel detail & booking
- `#/R44` Food home
- `#/R45` Menu & cart
- `#/R46` Food order tracking
- `#/R47` Send a parcel
- `#/R48` Parcel tracking & proof
- `#/R49` Deals & savings hub
- `#/R50` Flexible: price alert
- `#/R22` Offers & coupons
- `#/R21` Wallet
- `#/R54` Trips & tickets
- `#/R56` Notifications
- `#/R20` Ride history
- `#/R24` Emergency contacts
- `#/R25` Rider KYC
- `#/R26` Support & AI assistant
- `#/R27` Complaint / lost item
- `#/R28` Account & settings
