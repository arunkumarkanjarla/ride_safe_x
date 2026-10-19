# RideNova Agent portal

Web portal for RideNova support agents. Agents help **customers, drivers and partners** on every channel in one
workspace: phone calls, e-mail, in-app chat and tickets, WhatsApp, Facebook, Instagram and X. It is a desktop web
application (not a phone app) and it is **fully controlled by the admin portal** (*Agent portal control*, A31).

Static web application: HTML, CSS and JavaScript only. No build step, no backend, no database. This folder is
complete on its own: every file it loads is inside it.

**Server:** `xxx.xx.xx.126` – served at `http://xxx.xx.xx.126/`

## What the admin controls

Everything an agent may do comes from `assets/js/agent-policy.js`, which only the admin portal writes:

| Setting | Effect in this portal |
| --- | --- |
| Agent accounts | Who can sign in, their role, team, languages, channels and the people they support; suspended accounts cannot sign in and are signed out on publish |
| Roles & limits | Goodwill credit limit (higher amounts go to the Finance team), outbound calls, public social replies, closing, reassigning, team view, export |
| Channels | Each channel on or off, first-reply target (SLA) and opening hours |
| Routing | Skills, longest idle or round robin; automatic assignment; live conversations per agent; ring and wrap-up time; call recording; masked numbers (always on) |
| Templates & knowledge | Approved reply templates, knowledge articles, dispositions, escalation teams |
| Announcements | Shown at the top of every agent's workspace |

Agents cannot change any of these. *My access (admin)* (`#/G13`) shows what the admin has set for the signed-in agent.

## Pages

- `#/G01` Agent sign-in (demo code **246810**)
- `#/G02` Home: next best conversation, queues, SLA, announcements
- `#/G03` Unified inbox (all channels, filters, search)
- `#/G04` Calls: softphone (answer, decline, mute, hold, transfer, conference, hang up, wrap-up), IVR queue, call-backs, outbound calls
- `#/G05` E-mail: mailboxes, threads, replies with templates
- `#/G06` Social media: WhatsApp, Facebook, Instagram, X; public posts can be moved to a private message or hidden
- `#/G07` Live chat and in-app tickets
- `#/G08` Case workspace: contact, history, reply, internal note, priority, reassign, escalate, credit, resolve, close, reopen
- `#/G09` Contacts (customers, drivers, partners)
- `#/G10` Knowledge & templates
- `#/G11` My performance
- `#/G12` Team board (supervisors only)
- `#/G13` My access (set by the admin)

## Files

| File | What it holds |
| --- | --- |
| `index.html` | Sign-in page and the agent workspace |
| `assets/js/agent-policy.js` | Rules published by the admin portal (replace it with the file downloaded from A31) |
| `assets/js/agent-sync.js` | Live link with the admin portal when both run on the same site (BroadcastChannel) |
| `assets/js/agent-app.js` | Pages, conversations, calls, routing and the simulation |
| `assets/js/agent-data.js` | Synthetic contacts, conversations and call queue |
| `assets/js/config.js` | Brand name and the addresses of the other applications |
| `assets/css/agent.css` | Agent portal layout |
| `assets/css/base.css`, `components.css`, `app.css` | Shared design system (same as the other applications) |

`index.html`, `agent-app.js`, `agent-data.js`, `agent.css` and this README are written by hand. The other files are
refreshed by `py source/build.py --apps` (from `architecture-workflow/`).

## Run

```bash
py -m http.server 8080
```

Open http://127.0.0.1:8080/ and sign in with any active agent and the code **246810**. Each page load starts a fresh
session; all data is synthetic and kept in memory. No call is placed, no e-mail or social message is sent, and no
microphone is used.

## Deploy

Copy the **contents** of this folder to the web root of `xxx.xx.xx.126`. After the admin publishes a new policy on A31,
download `agent-policy.js` there and replace `assets/js/agent-policy.js` on this server.

If the admin portal and this portal are served from the same site (same scheme, host and port), the admin's publish
reaches open agent portals immediately, the admin sees who is signed in and can sign an agent out remotely.
