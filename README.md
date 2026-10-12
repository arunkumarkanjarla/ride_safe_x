# RideNova – static application prototype

Ride-hailing and mobility platform prototype built with plain **HTML, CSS and JavaScript** for workflow validation before
any backend work. Everything is simulated in the browser with synthetic data; nothing is sent anywhere and nothing is
stored (each application keeps its demo state in memory and resets when reloaded).

## Start here

Open [`index.html`](index.html) in Edge or Chrome, or serve the folder and open http://127.0.0.1:8766/ :

```bash
py -m http.server 8766 --bind 127.0.0.1
```

| Application | Folder | Starts at |
| --- | --- | --- |
| Customer app | [`customer-app/`](customer-app/index.html) | Welcome → sign in or create an account (R01, R02, R58) |
| Driver app | [`driver-app/`](driver-app/index.html) | Driver login (D01) |
| Partner app | [`patner-app/`](patner-app/index.html) | Partner sign-in (P08) |
| Admin portal | [`admin/`](admin/index.html) | Admin login and MFA (A01) |
| Agent portal | [`agent-portal/`](agent-portal/index.html) | Agent sign-in (G01); web portal for support agents |
| Connected demo | [`connected-demo/`](connected-demo/index.html) | Several apps side by side sharing one scenario (needs the local web server) |

Demo codes (public test values): customer and partner **482716** · admin MFA **730951** · agent portal **246810** ·
trip code **4827** · delivery code **4471**.

The customer, driver and partner apps show the phone scaled to fit the browser window, so the whole screen is visible at
100 % zoom without the page scrolling (long content scrolls inside the phone).

### Agent portal (replaces the support portal)

`agent-portal/` is a desktop **web portal** for support agents. In one workspace agents help **customers, drivers and
partners** on phone calls (softphone with IVR queue, hold, transfer, conference, wrap-up), e-mail, live chat and in-app
tickets, and social media (WhatsApp, Facebook, Instagram, X). Calls, messages and posts are simulated; nothing is sent.

The agent portal is **fully controlled by the admin portal** on screen **A31 Agent portal control** (Trust & safety →
Agent portal): agent accounts and suspension, roles and credit limits, channels on/off with SLA and hours, routing,
reply templates, knowledge articles, dispositions, escalation teams and announcements. The admin edits a draft and
publishes it as a new policy version (`agentdesk.manage`: Super admin and Ops manager; the action is audited). The
policy reaches the agents in two ways, both static:

* the admin downloads `agent-policy.js` on A31 and replaces `agent-portal/assets/js/agent-policy.js` on the agent
  portal's server;
* when the admin portal and the agent portal are open on the same site, a publish reaches open agent portals at once,
  A31 shows who is signed in and on which channel, and the admin can sign an agent out.

Support requests raised in the customer, driver and partner apps (help centre, complaints, "Talk to an agent") become
conversations that the agent portal answers; the connected demo shows this across the apps. See [`agent-portal/README.md`](agent-portal/README.md).

## Repository layout

Each application folder is complete on its own and runs on its own server. No folder loads or refers to a file of
another folder; links between the applications go to the other server's address in `assets/js/config.js`.

| Server | Folder | Address (placeholder) |
| --- | --- | --- |
| xxx.xx.xx.123 | `admin/` | `http://xxx.xx.xx.123/` |
| xxx.xx.xx.124 | `customer-app/` | `http://xxx.xx.xx.124/` |
| xxx.xx.xx.125 | `driver-app/` | `http://xxx.xx.xx.125/driver-app/` |
| xxx.xx.xx.125 | `patner-app/` | `http://xxx.xx.xx.125/patner-app/` |
| xxx.xx.xx.126 | `agent-portal/` | `http://xxx.xx.xx.126/` |

Deployment steps, web-server settings and what stays local: [DEPLOYMENT.md](DEPLOYMENT.md).


```
customer-app/  driver-app/  patner-app/  admin/
  index.html                 the screens of this application only
  README.md                  files, screens and how to run this application
  assets/css/base.css        design system
  assets/css/components.css  fields, dialogs, toasts, focus styles
  assets/css/app.css         page layout
  assets/css/screens.css     layout rules used by this application's screens only
  assets/js/config.js        brand name and the server addresses of the applications (edit per deployment)
  assets/js/controllers.js   behaviour of this application's screens only
  assets/js/app.js, kit.js   navigation, forms, dialogs, helpers
  assets/js/engine.js, state-machines.js, roles.js, data.js, screens.js   simulated back office and screen list
  assets/img/favicon.svg     browser tab icon

agent-portal/                hand-written web portal (index.html, agent-app.js, agent-data.js, agent.css);
                             agent-policy.js holds the rules published by the admin portal (A31)
```

| Path | Content |
| --- | --- |
| `connected-demo/` | Local tool, not deployed: several applications side by side sharing one scenario |
| `index.html`, `assets/` | Local entry page, not deployed |
| `DEPLOYMENT.md` | One server per application |
| `architecture-workflow/` | Architecture and screen blueprint, generator, tests, docs |

Replace the placeholder addresses in each folder's `assets/js/config.js` (or once in `SERVERS` in
`architecture-workflow/source/build_apps.py`, then regenerate). To regenerate all application folders from the blueprint
(this overwrites edits made in them): `py source/build.py --apps` from `architecture-workflow/`. The agent portal's
hand-written files are never overwritten; only its shared styles, `agent-policy.js`, `agent-sync.js` and `config.js` are
refreshed.

## Documentation

* Static application phase: [analysis and plan](architecture-workflow/docs/static-app/00-analysis-and-plan.md) ·
  [route inventory](architecture-workflow/docs/static-app/route-inventory.md) · [user roles](architecture-workflow/docs/static-app/user-roles.md) ·
  [workflows and states](architecture-workflow/docs/static-app/workflows.md) · [security rules](architecture-workflow/docs/static-app/security-rules.md) ·
  [run and test](architecture-workflow/docs/static-app/install-and-test.md) · [gaps and broken links](architecture-workflow/docs/static-app/gaps-and-links.md) ·
  [acceptance checklist](architecture-workflow/docs/static-app/acceptance-checklist.md)
* Screens: [screen and image mapping](architecture-workflow/docs/analysis/screen-image-mapping.md) ·
  [navigation map](architecture-workflow/docs/workflows/navigation-map.md) · [state machines](architecture-workflow/docs/workflows/state-machines.md)
* Earlier phase: [docs index](architecture-workflow/README.md)

## Status

Static prototype only. Sign-in and roles are simulated and are not security. No backend, database or real service is
used or required. Backend work has not been authorized.
