"""Screen detail page generator."""
from components import *
from registry import APPS, sfile, stitle
import proto_wiring

# Prototype runtime loaded by every screen page (order matters: data, machines, rbac, engine, ui, controllers)
RUNTIME_JS = ("js/generated/screens.js", "js/rn-data.js", "js/rn-machines.js", "js/rn-rbac.js", "js/rn-engine.js", "js/rn-sync.js", "js/rn-ui.js", "js/rn-screens.js")
RUNTIME_CSS = ("mock.css", "css/prototype.css")

def demobar(app):
    """Prototype controls shown above every screen. Filled in by assets/js/rn-ui.js."""
    role = ('<label class="rn-f">Mock role <select data-rn="role"></select></label>' if app == "admin" else "")
    return f"""<section class="rn-demobar" aria-label="Prototype controls">
<div class="rn-db-row"><span class="rn-badge">Prototype · simulated data · no real services</span>
<button type="button" class="rn-dbtn rn-db-toggle" data-rn="collapse" aria-expanded="false">Prototype controls</button>
<label class="rn-f">Scenario <select data-rn="scenario"></select></label>
<button type="button" class="rn-dbtn" data-rn="reset">Reset demo</button>
<label class="rn-f">This device <select data-rn="network"><option value="online">Online</option><option value="offline">Offline (simulated)</option></select></label>
<label class="rn-f">Other parties <select data-rn="auto"><option value="auto">Act automatically</option><option value="manual">Played by me in other tabs</option></select></label>
<label class="rn-f">Timers <select data-rn="speed"><option value="fast">Fast demo</option><option value="spec">As specified</option></select></label>
{role}<button type="button" class="rn-dbtn" data-rn="view" aria-pressed="false">App view</button>
<a class="rn-dbtn" href="{REL}prototype/index.html">Demo console</a></div>
<p class="rn-db-state" data-rn="status" role="status"></p>
<details class="rn-db-log"><summary>Event history</summary><ol data-rn="log"></ol></details>
</section>
<div class="rn-toasts" data-rn="toasts" aria-live="polite"></div>
<div class="rn-offline" data-rn="offline" role="alert" hidden>This device is offline (simulated). Actions that need the network are disabled; trip actions are saved and synced later.</div>"""

REL = "../../"
APP_LABEL = {"rider": "Customer app", "driver": "Driver & delivery app", "partner": "Partner app", "admin": "Admin portal", "support": "Support (design)"}

def _list(items):
    return '<ul class="clean">' + "".join(f"<li>{i}</li>" for i in items) + "</ul>"

def _apis(items):
    rows = "".join(f'<tr><td class="m"><span class="pill {m.lower()}">{m}</span></td><td class="m">{esc(p)}</td><td>{d}</td></tr>' for m, p, d in items)
    return f'<div class="tw"><table><thead><tr><th>Method</th><th>Endpoint / channel</th><th>Why</th></tr></thead><tbody>{rows}</tbody></table></div>'

def link(sid):
    return f'<a href="{REL}{sfile(sid)}">{sid} · {stitle(sid)}</a>'

def build_app(app, screens):
    """screens: list of dicts with id, mock, purpose, how, elements, apis, events, data, to, edge"""
    order = [s for s, _, _ in APPS[app]]
    by = {s["id"]: s for s in screens}
    comes = {sid: [] for sid in order}
    for s in screens:
        for t in s.get("to", []):
            if t in comes and s["id"] not in comes[t]:
                comes[t].append(s["id"])
    for i, sid in enumerate(order):
        s = by[sid]
        back_to = sfile(comes[sid][0]).split("/")[-1] if comes[sid] else "index.html"
        prev = order[i-1] if i > 0 else None
        nxt = order[i+1] if i < len(order)-1 else None
        ev = "".join(f'<span class="pill ev">{e}</span> ' for e in s.get("events", [])) or '<span class="xs">None</span>'
        wide = app == "admin"
        det = f"""
<div class="details">
  <div class="grid2">
    <div><h3>How it works</h3><ol class="steps">{"".join(f"<li>{x}</li>" for x in s["how"])}</ol></div>
    <div><h3>What is on the screen</h3>{_list(s["elements"])}</div>
  </div>
  <div><h3>Backend calls</h3>{_apis(s["apis"]) if s.get("apis") else '<p>None; this screen works from local state.</p>'}</div>
  <div class="grid2">
    <div><h3>Events published</h3><div>{ev}</div></div>
    <div><h3>Data used</h3>{_list(s.get("data", ["—"]))}</div>
  </div>
  <div><h3>Edge cases and validation</h3>{_list(s["edge"])}</div>
  <div class="grid2">
    <div><h3>Comes from</h3><div class="navlinks">{"".join(link(x) for x in comes[sid]) or '<span class="xs">Entry point</span>'}</div></div>
    <div><h3>Goes to</h3><div class="navlinks">{"".join(link(x) for x in s.get("to", [])) or '<span class="xs">—</span>'}</div></div>
  </div>
</div>"""
        body = f"""<div class="head"><div class="crumbs"><a href="{REL}index.html">Home</a> / <a href="index.html">{APP_LABEL[app]}</a> / {sid}</div>
<div class="eyebrow">{APP_LABEL[app]} · {sid}</div><h1>{stitle(sid)}</h1><p class="lead">{s["purpose"]}</p></div>
<div class="spec-open"><a class="rn-dbtn primary" href="../../../{proto_wiring.APP_DIRS[app]}/index.html#/{sid}">Open {sid} in the {APP_LABEL[app]} prototype</a>
<span class="xs">The mock below is the approved design; the working screen is in the application.</span></div>
<div class="screen-layout{" wide" if wide else ""}"><div class="mock-holder" id="mock">{proto_wiring.wire(app, sid, s["mock"], back_to)}</div>{det}</div>
<div class="pager">{f'<a href="{REL}{sfile(prev)}">← {prev} {stitle(prev)}</a>' if prev else "<span></span>"}{f'<a href="{REL}{sfile(nxt)}">{nxt} {stitle(nxt)} →</a>' if nxt else "<span></span>"}</div>"""
        write(sfile(sid), page(f"{sid} {stitle(sid)}", body, REL, app, extra_css=RUNTIME_CSS))
    return order, by
