"""Builds the five applications as separate, self-contained folders (static application phase).

Output, next to architecture-workflow/ in the repository root:
  customer-app/  driver-app/  patner-app/  admin/  agent-portal/     one folder per application
                                                                     (agent-portal/ pages are hand-written; see HAND_WRITTEN)
  connected-demo/                                                    several apps side by side on one page (needs one web server)
  index.html + assets/                                               entry page linking the applications

Each application folder contains only its own code and runs on its own server (SERVERS below; DEPLOYMENT.md):
  index.html                 every screen of this application as <section class="rn-screen" data-sid="…"> (hash routes #/R07)
  assets/css/base.css        design system of the screens (phone and desktop components)
  assets/css/components.css  interactive states, dialogs, toasts, form fields
  assets/css/app.css         page layout of the application
  assets/css/screens.css     layout rules used by this application's screens only
  assets/js/config.js        brand name and the addresses of the other applications (edit per server)
  assets/js/data.js, state-machines.js, roles.js, engine.js   simulated back-office logic (in memory)
  assets/js/screens.js       list of this application's screens
  assets/js/app.js           navigation, forms, dialogs
  assets/js/kit.js, controllers.js   behaviour of this application's screens
  README.md

The applications are written only when the build runs with --apps (py source/build.py --apps), so changes made
directly in the application folders are not overwritten by an ordinary blueprint build.
"""
import json
import os
import re
import shutil

import components as C
from components import esc, write, OUT, CSP
import htmltree
import proto_wiring
from registry import APPS, stitle

ROOT = os.path.dirname(OUT)          # repository root (OUT is architecture-workflow/)
SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # architecture-workflow/ with the hand-written assets
APPS_META = {   # app key: (folder, label, entry screen, screen after sign-in)
    "rider": ("customer-app", "Customer app", "R01", "R29"),
    "driver": ("driver-app", "Driver app", "D01", "D05"),
    "partner": ("patner-app", "Partner app", "P08", "P09"),
    "admin": ("admin", "Admin portal", "A01", "A02"),
    "support": ("agent-portal", "Agent portal", "G01", "G02"),
}
# Applications whose pages are written by hand (not generated from the blueprint screens): key -> title of the entry page.
# The build only refreshes their shared files (AGENT_SHARED) and config.js; index.html, README.md, agent.css,
# agent-app.js and agent-data.js in agent-portal/ are never overwritten.
HAND_WRITTEN = {"support": "Agent sign-in"}
AGENT_SHARED = {"css/base.css": "source/mock.css", "css/components.css": "assets/css/prototype.css", "css/app.css": "assets/css/app.css",
                "img/favicon.svg": "assets/img/favicon.svg", "js/agent-policy.js": "assets/js/agent-desk/agent-policy.js",
                "js/agent-sync.js": "assets/js/agent-desk/agent-sync.js"}
# the admin portal also loads the agent portal policy, the live link and the A31 control screen
ADMIN_EXTRA = {"css/agent-control.css": "assets/css/agent-control.css", "js/agent-policy.js": "assets/js/agent-desk/agent-policy.js",
               "js/agent-sync.js": "assets/js/agent-desk/agent-sync.js", "js/agent-control.js": "assets/js/agent-desk/agent-control.js"}
SERVERS = {   # app key: (server, address the folder is served from). Replace the placeholders with the real addresses.
    "admin": ("xxx.xx.xx.123", "http://xxx.xx.xx.123/"),
    "rider": ("xxx.xx.xx.124", "http://xxx.xx.xx.124/"),
    "driver": ("xxx.xx.xx.125", "http://xxx.xx.xx.125/driver-app/"),
    "partner": ("xxx.xx.xx.125", "http://xxx.xx.xx.125/patner-app/"),
    "support": ("xxx.xx.xx.126", "http://xxx.xx.xx.126/"),
}
proto_wiring.APP_URLS.update({app: url for app, (server, url) in SERVERS.items()})
APP_CSS = ("css/base.css", "css/components.css", "css/app.css", "css/screens.css")
APP_JS = ("js/config.js", "js/data.js", "js/state-machines.js", "js/roles.js", "js/engine.js", "js/screens.js",
          "js/app.js", "js/kit.js", "js/controllers.js")
HUB_CSS = ("css/hub.css", "css/components.css")
HUB_JS = ("js/config.js", "js/data.js", "js/state-machines.js", "js/roles.js", "js/engine.js", "js/screens.js", "js/hub.js")
HUB_CSP = CSP.replace("default-src 'none';", "default-src 'none'; frame-src 'self';")
COPY = {   # file in an app folder -> hand-written source in architecture-workflow/
    "css/base.css": "source/mock.css", "css/components.css": "assets/css/prototype.css", "css/app.css": "assets/css/app.css",
    "css/hub.css": "assets/css/hub.css", "js/data.js": "assets/js/rn-data.js", "js/state-machines.js": "assets/js/rn-machines.js",
    "js/roles.js": "assets/js/rn-rbac.js", "js/engine.js": "assets/js/rn-engine.js", "js/app.js": "assets/js/rn-ui.js",
    "js/kit.js": "assets/js/controllers/kit.js", "js/hub.js": "assets/js/rn-hub.js", "img/favicon.svg": "assets/img/favicon.svg",
}
ENABLED = {"apps": False}   # set by build.py --apps
_built = {}                 # app -> html written in this run (decides which CSS rules and screen entries each app gets)


def _shell(title, body, css, js, body_attrs, csp=CSP, prefix="assets/"):
    links = f'<link rel="icon" href="{prefix}img/favicon.svg" type="image/svg+xml">' + "".join(f'<link rel="stylesheet" href="{prefix}{c}">' for c in css)
    scripts = "".join(f'<script src="{prefix}{s}" defer></script>' for s in js)
    attrs = "".join(f' {k}="{esc(v)}"' for k, v in body_attrs.items())
    return (f'<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n'
            f'<meta http-equiv="Content-Security-Policy" content="{csp}">\n<title>{esc(title)}</title>{links}{scripts}</head>\n'
            f'<body{attrs}>\n{body}\n<noscript><p class="app-noscript">Please enable JavaScript to use this application.</p></noscript>\n</body></html>\n')


def _desk_frame(mock, label):
    """Desktop screens (admin portal, support console): sidebar as <nav>, a <header>, the scrolling content and a <footer>."""
    if 'class="desk' not in mock:
        return mock
    root = htmltree.parse(mock)
    for n in list(root.iter()):
        if n.kind != "el":
            continue
        if n.has_class("dsb"):
            n.rename("nav")
            n.set("aria-label", f"{label} sections")
        elif n.has_class("dtop"):
            n.rename("header")
        elif n.has_class("dmain"):
            foot = proto_wiring._el("footer", {"class": "dfoot"})
            for cls, text in (("", f"© 2026 {C.BRAND} · {label}"), ("dfoot-sp", None), ("", "Synthetic data · this browser tab only"), ("", "Version 1.0")):
                foot.children.append(proto_wiring._el("span", {"class": cls} if cls else {}, text))
            for c in foot.children:
                c.parent = foot
            n.children.append(foot)
            foot.parent = n
    return root.serialize()


def build_app(app, order, by):
    if not ENABLED["apps"] or app in HAND_WRITTEN:
        return
    folder, label, entry, home = APPS_META[app]
    comes = {sid: [s for s in order if sid in by[s].get("to", [])] for sid in order}
    proto_wiring.MODE["app"] = True
    try:
        sections = []
        for sid in order:
            back = f"#/{comes[sid][0]}" if comes.get(sid) else f"#/{entry}"
            mock = _desk_frame(proto_wiring.wire(app, sid, by[sid]["mock"], back), label)
            sections.append(f'<section class="rn-screen" data-sid="{sid}" aria-label="{esc(stitle(sid))}" hidden>'
                            f'<h1 class="rn-vh">{esc(stitle(sid))}</h1><div class="mock-holder">{mock}</div></section>')
    finally:
        proto_wiring.MODE["app"] = False
    body = ('<a class="rn-skip" href="#app-stage">Skip to content</a>\n'
            '<div class="rn-toasts" data-rn="toasts" aria-live="polite"></div>\n'
            '<div class="rn-offline" data-rn="offline" role="alert" hidden>You are offline. Actions that need the network are paused; trip actions are saved and sent when you are back online.</div>\n'
            '<main id="app-stage" class="app-stage" tabindex="-1">\n' + "\n".join(sections) + '\n</main>')
    css, js = APP_CSS, APP_JS
    if app == "admin":
        css = css + tuple(f for f in ADMIN_EXTRA if f.startswith("css/"))
        js = js + tuple(f for f in ADMIN_EXTRA if f.startswith("js/"))
    html = _shell(f"{C.BRAND} {label}", body, css, js, {"data-app": app, "data-entry": entry, "data-home": home, "data-label": label})
    write(f"../{folder}/index.html", html)
    with open(os.path.join(ROOT, folder, "index.html"), encoding="utf-8") as fh:   # after inline styles became classes
        _built[app] = fh.read()


_INTRO = {"rider": "Sign up, book rides and long trips, order food, send parcels, savings, wallet and help.",
          "driver": "Onboarding and documents, going online, ride and delivery jobs, earnings and payouts.",
          "partner": "Restaurant orders, hotel, rental and bus bookings, menus, payouts and reviews.",
          "admin": "Operations, dispatch, driver review, pricing, refunds, safety, fraud, reports and roles.",
          "support": "Web portal for RideNova agents: calls, e-mail, chat and social media from customers, drivers and partners. Controlled by the admin portal."}


def build_hub():
    if not ENABLED["apps"]:
        return
    cards = "".join(
        f'<a class="hub-card" href="{folder}/index.html"><b>{label}</b><span>{esc(_INTRO[app])}</span></a>'
        for app, (folder, label, entry, home) in APPS_META.items())
    body = (f'<header class="hub-bar"><span class="hub-logo"><i></i>{C.B()}</span><nav aria-label="Main">'
            f'<a href="connected-demo/index.html">Connected demo</a><a href="architecture-workflow/index.html">Architecture</a></nav></header>\n'
            f'<main class="hub-main"><h1>{C.B()}</h1>'
            f'<p class="hub-lead">Rides, long trips, food and parcels: customer, driver and partner apps, the admin portal and the agent portal.</p>'
            f'<div class="hub-grid">{cards}</div>'
            f'<section class="hub-panel"><h2>Connected demo</h2><p>Open several applications side by side so they share one scenario.</p>'
            f'<p><a class="hub-btn" href="connected-demo/index.html">Open the connected demo</a></p></section>'
            f'<section class="hub-panel"><h2>Test sign-in codes</h2><p>Customer and partner <b>482716</b> · admin <b>730951</b> · agent portal <b>246810</b> · '
            f'trip <b>4827</b> · delivery <b>4471</b>. All data is synthetic and nothing is sent anywhere.</p></section>'
            f'<section class="hub-panel"><h2>Deployment</h2><p>Each application folder is complete on its own and runs on its own server: '
            + " · ".join(f'{label} <b>{SERVERS[app][1]}</b>' for app, (folder, label, entry, home) in APPS_META.items())
            + '. This page and the connected demo are local tools and are not deployed (see DEPLOYMENT.md).</p></section></main>')
    write("../index.html", _shell(C.BRAND, body, ("css/hub.css",), (), {"class": "hub"}))
    opts = "".join(f'<option value="{app}">{label}</option>' for app, (folder, label, entry, home) in APPS_META.items())
    panes = "".join(
        f'<section class="hub-pane" data-pane="{i}"><div class="hub-pane-bar"><label>App <select data-pane-app="{i}">{opts}</select></label>'
        f'<button type="button" class="rn-dbtn" data-pane-reload="{i}">Restart app</button></div>'
        f'<iframe title="Pane {i + 1}" data-pane-frame="{i}"></iframe></section>' for i in range(3))

    def sel(key, label, options):
        return (f'<label class="rn-f">{label} <select data-hub="{key}">' + "".join(f'<option value="{v}">{t}</option>' for v, t in options) + '</select></label>')
    controls = (sel("panes", "Panes", [("3", "3"), ("2", "2")]) + '<label class="rn-f">Scenario <select data-hub="scenario"></select></label>'
                '<button type="button" class="rn-dbtn" data-hub="reset">Reset</button>'
                + sel("auto", "Other parties", [("auto", "Act automatically"), ("manual", "Played by me")])
                + sel("speed", "Timers", [("fast", "Fast"), ("spec", "As specified")])
                + sel("payment", "Next payment", [("success", "Succeeds"), ("fail", "Fails"), ("pending", "Stays pending")])
                + '<label class="rn-f">Admin role <select data-hub="role"></select></label>'
                + sel("net-rider", "Customer phone", [("online", "Online"), ("offline", "Offline")])
                + sel("net-driver", "Driver phone", [("online", "Online"), ("offline", "Offline")])
                + sel("chat", "Chat agents", [("available", "Available"), ("unavailable", "None available")])
                + sel("call", "Next call-back", [("connected", "Rings"), ("busy", "All busy"), ("failed", "Fails")]))
    body = (f'<header class="hub-bar"><a class="hub-logo" href="../index.html"><i></i>{C.B()}</a><span class="hub-title">Connected demo</span></header>\n'
            f'<div class="hub-controls">{controls}</div>\n'
            f'<p class="hub-warning" data-hub="warning" hidden>The applications could not join this page. Serve the folders from one web server (not as files) to share one scenario.</p>'
            f'<main class="hub-panes" data-hub="layout" data-count="3">{panes}</main>\n'
            f'<details class="hub-log"><summary>Shared event history</summary><ol data-hub="log"></ol></details>')
    write("../connected-demo/index.html", _shell(f"Connected demo · {C.BRAND}", body, HUB_CSS, HUB_JS, {"class": "hub"}, HUB_CSP))


def _css_rules(path):
    rules = {}
    for line in open(path, encoding="utf-8"):
        m = re.match(r"^\.(x[b]?-[a-z0-9-]+)\{", line)
        if m:
            rules[m.group(1)] = line
    return rules


def _registry(app, html):
    reg = json.loads(open(os.path.join(OUT, "assets/js/generated/screens.js"), encoding="utf-8").read().split("window.RN_SCREENS = ", 1)[1].rstrip().rstrip(";"))
    refs = {s for r in re.findall(r'(?:data-go|data-next)="([A-Z0-9 ]+)"', html) for s in r.split()}
    refs |= set(re.findall(r'href="https?://[^"#]*#/([A-Z]\d\d)"', html))
    keep = {}
    for sid, v in reg.items():
        if v["app"] == app:
            keep[sid] = {"app": app, "title": v["title"], "to": v["to"], "from": [f for f in v["from"] if reg[f]["app"] == app]}
        elif sid in refs:
            keep[sid] = {"app": v["app"], "title": v["title"]}
    return keep


def _config(app):
    if app is None:   # connected demo: a local tool that shows the folders side by side from one server
        urls = {a: f"../{meta[0]}/index.html" for a, meta in APPS_META.items()}
        note = ("/* Connected demo (local only, not deployed): opens the application folders of this repository side by side.\n"
                "   Serve the repository root with one web server to use it. */\n")
    else:
        urls = {a: url for a, (server, url) in SERVERS.items()}
        note = (f"/* Settings of the {APPS_META[app][1]} ({SERVERS[app][0]}).\n"
                "   The applications run on separate servers. Links to another application (for example Help centre) open the\n"
                "   address below. Replace the placeholder addresses with the real ones; nothing else needs to change. */\n")
    lines = ",\n".join(f'    {a}: "{u}"' for a, u in urls.items())
    return note + f'window.RN_CONFIG = {{\n  brand: "{C.BRAND}",\n  apps: {{\n{lines}\n  }}\n}};\n'


def _readme(app):
    folder, label, entry, home = APPS_META[app]
    screens = APPS[app]
    rows = "\n".join(f"- `#/{sid}` {title}" for sid, _, title in screens)
    return f"""# {C.BRAND} {label}

Static web application: HTML, CSS and JavaScript only. No build step, no backend, no database. This folder is
complete on its own: every file it loads is inside it, and it does not need any other folder of the repository.

**Server:** `{SERVERS[app][0]}` – served at `{SERVERS[app][1]}`

## Files

| File | What it holds |
| --- | --- |
| `index.html` | The {len(screens)} screens of this application (each `<section data-sid="…">`); the first screen is `{entry}` |
| `assets/css/base.css` | Design system (colours, typography, buttons, lists, cards) |
| `assets/css/components.css` | Form fields, dialogs, toasts, status panels, focus styles |
| `assets/css/app.css` | Page layout |
| `assets/css/screens.css` | Spacing and layout details used by these screens |
| `assets/js/config.js` | Brand name and the addresses of the other applications |
| `assets/js/controllers.js` | Behaviour of each screen (`def('{entry}', …)`) |
| `assets/js/app.js` | Navigation (`#/{entry}` routes), forms, dialogs, toasts |
| `assets/js/engine.js`, `state-machines.js`, `roles.js`, `data.js` | Simulated back office: rules, states and sample data, in memory |
| `assets/js/screens.js` | Screen list used for navigation |
| `assets/js/kit.js` | Helpers used by `controllers.js` |
| `assets/img/favicon.svg` | Browser tab icon |
{_extra_rows(app)}
## Run

```bash
py -m http.server 8080
```

Open http://127.0.0.1:8080/ . Each page load starts a fresh, signed-out session; data is synthetic and kept in memory.

## Deploy

Copy the **contents** of this folder ({"`index.html`, `README.md`, `assets/`"}) to {_where(app)}. Any static web server works
(nginx, Apache, IIS); `index.html` must be the default document. No other folder is needed on this server.

Links to the other applications open the addresses in `assets/js/config.js`:

{_links(app)}

State is kept in memory per browser tab, so an application on one server does not see rides, orders or tickets created in
an application on another server (no backend in this phase).

## Screens

{rows}
"""


def _extra_rows(app):
    if app != "admin":
        return ""
    return ("| `assets/js/agent-control.js`, `assets/css/agent-control.css` | Agent portal control (A31): agents, roles, channels, routing, templates, announcements, publish |\n"
            "| `assets/js/agent-policy.js` | The agent portal policy as published (the starting draft of A31) |\n"
            "| `assets/js/agent-sync.js` | Live link with agent portals open on the same site (BroadcastChannel) |\n")


def _where(app):
    server, url = SERVERS[app]
    path = url.split(server, 1)[1]
    return f"the web root of `{server}`" if path == "/" else f"the `{path}` folder of the web root on `{server}`"


def _links(app):
    return "\n".join(f"- {APPS_META[a][1]}: `{url}`" for a, (server, url) in SERVERS.items() if a != app)


def _deployment():
    by_server = {}
    for app, (server, url) in SERVERS.items():
        by_server.setdefault(server, []).append(app)
    rows = "\n".join(f"| `{server}` | " + "<br>".join(f"`{APPS_META[a][0]}/` → `{SERVERS[a][1]}`" for a in apps) + " |"
                     for server, apps in by_server.items())
    return f"""# Deployment – one server per application

Each application folder is complete on its own (HTML, CSS and JavaScript only; no backend, no build step). No folder
loads a file from another folder, so each one is copied to its own server.

| Server | Folder → address |
| --- | --- |
{rows}

## Steps

1. Replace the placeholder addresses (`xxx.xx.xx.…`) in `architecture-workflow/source/build_apps.py` (`SERVERS`) and run
   `py source/build.py --apps` from `architecture-workflow/` – or edit `assets/js/config.js` in each copied folder.
2. Copy the **contents** of each folder to its place:
   - `admin/` → web root of the admin server
   - `customer-app/` → web root of the customer server
   - `driver-app/` and `patner-app/` → the folders `/driver-app/` and `/patner-app/` of the same web root (both apps on one
     server, each in its own folder, still independent of each other)
   - `agent-portal/` → web root of the agent portal server
3. Make `index.html` the default document (nginx `index index.html;`, Apache `DirectoryIndex index.html`, IIS default
   document).
4. Recommended response header on every server (the pages also carry it as a `<meta>` tag):
   `Content-Security-Policy: {CSP}; frame-ancestors 'none'`

Example nginx server block for the driver and partner server:

```nginx
server {{
    listen 80;
    root /var/www/ridenova;          # contains driver-app/ and patner-app/
    index index.html;
    add_header Content-Security-Policy "{CSP}; frame-ancestors 'none'" always;
    add_header X-Content-Type-Options nosniff always;
}}
```

## What stays local

`index.html`, `assets/` and `connected-demo/` in the repository root are local tools (entry page and side-by-side demo)
and are **not** deployed. `architecture-workflow/` holds the blueprint and the generator and is not deployed either.

## Behaviour across servers

* Each application has its own copy of the simulated back office (`assets/js/engine.js`, data, rules) and keeps its state
  in memory in the browser tab. Rides, orders and tickets created on one server are not visible on another server –
  sharing them needs the backend of the next phase.
* Links between applications (for example *Open the agent portal* in the admin portal) open the other server's
  address from `assets/js/config.js`. If an address is removed, the link shows a message instead of opening.

## Agent portal and the admin portal

The agent portal (`agent-portal/`) is a web portal for RideNova agents. It is controlled by the admin portal
(*Agent portal control*, A31): agent accounts, roles and credit limits, channels, routing, reply templates, knowledge
articles and announcements.

* The agent portal reads its rules from `agent-portal/assets/js/agent-policy.js`. After publishing on A31, use
  **Download agent-policy.js** and copy the file into `assets/js/` of the agent portal on its server.
* When both portals are served from the same site (same scheme, host and port – for example behind one reverse proxy
  at `/admin/` and `/agent-portal/`), a publish reaches open agent portals at once and the admin sees the agents live
  (browser BroadcastChannel; nothing is stored and nothing is sent to a server).
* `py source/build.py --apps` refreshes the agent portal's shared files, including `agent-policy.js` (back to the
  version in `architecture-workflow/assets/js/agent-desk/`). Re-deploy a downloaded policy after a rebuild.
"""


def _write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)


def copy_assets():
    """Writes each application's own assets (after the blueprint build has produced extracted.css)."""
    if not ENABLED["apps"]:
        return
    rules = _css_rules(os.path.join(OUT, "assets/css/generated/extracted.css"))
    for app, (folder, label, entry, home) in APPS_META.items():
        base = os.path.join(ROOT, folder)
        if app in HAND_WRITTEN:
            for f, src in AGENT_SHARED.items():
                os.makedirs(os.path.dirname(os.path.join(base, "assets", f)), exist_ok=True)
                shutil.copyfile(os.path.join(SRC, src), os.path.join(base, "assets", f))
            _write(os.path.join(base, "assets/js/config.js"), _config(app))
            continue
        shutil.rmtree(os.path.join(base, "assets"), ignore_errors=True)
        for f in APP_CSS + APP_JS + ("img/favicon.svg",):
            if f in COPY:
                os.makedirs(os.path.dirname(os.path.join(base, "assets", f)), exist_ok=True)
                shutil.copyfile(os.path.join(SRC, COPY[f]), os.path.join(base, "assets", f))
        if app == "admin":
            for f, src in ADMIN_EXTRA.items():
                shutil.copyfile(os.path.join(SRC, src), os.path.join(base, "assets", f))
        html = _built[app]
        used = sorted(set(re.findall(r"\b(x[b]?-[a-z0-9-]+)", html)) & set(rules))
        _write(os.path.join(base, "assets/css/screens.css"), f"/* Layout details used by the {label} screens. */\n" + "".join(rules[c] for c in used))
        _write(os.path.join(base, "assets/js/screens.js"), f"/* Screens of the {label} and the screens of other applications it links to. */\n"
               "window.RN_SCREENS = " + json.dumps(_registry(app, html), ensure_ascii=False, indent=1) + ";\n")
        shutil.copyfile(os.path.join(SRC, f"assets/js/controllers/{app}.js"), os.path.join(base, "assets/js/controllers.js"))
        _write(os.path.join(base, "assets/js/config.js"), _config(app))
        _write(os.path.join(base, "README.md"), _readme(app))
    hub = os.path.join(ROOT, "connected-demo")
    shutil.rmtree(os.path.join(hub, "assets"), ignore_errors=True)
    for f in HUB_CSS + HUB_JS + ("img/favicon.svg",):
        if f in COPY:
            os.makedirs(os.path.dirname(os.path.join(hub, "assets", f)), exist_ok=True)
            shutil.copyfile(os.path.join(SRC, COPY[f]), os.path.join(hub, "assets", f))
    shutil.copyfile(os.path.join(OUT, "assets/js/generated/screens.js"), os.path.join(hub, "assets/js/screens.js"))
    _write(os.path.join(hub, "assets/js/config.js"), _config(None))
    _write(os.path.join(ROOT, "DEPLOYMENT.md"), _deployment())
    os.makedirs(os.path.join(ROOT, "assets", "css"), exist_ok=True)
    shutil.copyfile(os.path.join(SRC, "assets/css/hub.css"), os.path.join(ROOT, "assets/css/hub.css"))
    os.makedirs(os.path.join(ROOT, "assets", "img"), exist_ok=True)
    shutil.copyfile(os.path.join(SRC, "assets/img/favicon.svg"), os.path.join(ROOT, "assets/img/favicon.svg"))
