"""Shared building blocks: page template, icons, map art, mock UI helpers, SVG diagram renderers."""
import html, math, os

BRAND = "RideNova"
OUT = os.environ.get("BLUEPRINT_OUT") or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def esc(s):
    return html.escape(str(s), quote=True)

def B():
    """Brand name placeholder that assets/brand.js can rename."""
    return f'<span class="brandname">{BRAND}</span>'

# ------------------------------------------------------------------ page shell
NAV = [("Home", "index.html", "home"), ("Architecture", "architecture/index.html", "arch"),
       ("Customer app", "screens/rider/index.html", "rider"), ("Driver app", "screens/driver/index.html", "driver"),
       ("Partner app", "screens/partner/index.html", "partner"), ("Admin portal", "screens/admin/index.html", "admin"), ("Support (design)", "screens/support/index.html", "support"), ("User flows", "flows/index.html", "flows"),
       ("Image gallery", "images/index.html", "images"), ("Prototype", "prototype/index.html", "proto")]

# Pages load only local files. No inline scripts or styles are allowed (see postprocess.py).
CSP = ("default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; "
       "connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'")

def page(title, body, rel, active="", extra_css=(), extra_js=(), body_attrs=None):
    links = "".join(f'<a href="{rel}{h}" class="{"on" if k==active else ""}">{t}</a>' for t, h, k in NAV)
    sheets = ("site.css",) + tuple(extra_css) + ("css/generated/extracted.css",)
    css = "".join(f'<link rel="stylesheet" href="{rel}assets/{c}">' for c in sheets)
    js = "".join(f'<script src="{rel}assets/{s}" defer></script>' for s in ("brand.js",) + tuple(extra_js))
    battrs = "".join(f' {k}="{esc(v)}"' for k, v in (body_attrs or {}).items())
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="{CSP}">
<title>{esc(title)} · {BRAND}</title>{css}{js}</head>
<body{battrs}>
<header class="topnav"><div class="in"><a class="logo" href="{rel}index.html"><i></i>{B()} Blueprint</a><nav>{links}</nav></div></header>
<main class="page">
{body}
</main>
</body></html>"""

def write(path, text):
    full = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    if path.endswith(".html"):
        import postprocess
        text = postprocess.process(text)
    with open(full, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)

# ------------------------------------------------------------------ icons
_IC = {
 "back": '<path d="M15 5l-7 7 7 7"/>',
 "menu": '<path d="M4 7h16M4 12h16M4 17h16"/>',
 "search": '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
 "star": '<path d="M12 3l2.8 5.9 6.2.8-4.6 4.3 1.2 6.2L12 17.3 6.4 20.2l1.2-6.2L3 9.7l6.2-.8z" fill="currentColor"/>',
 "phone": '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
 "chat": '<path d="M4 5h16v11H9l-5 4z"/>',
 "shield": '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
 "user": '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
 "users": '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.3-5.5 6.5-5.5s5.7 2 6.5 5.5"/><circle cx="17" cy="9" r="2.8"/><path d="M16 14.6c2.7.2 4.6 2 5.3 4.9"/>',
 "wallet": '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14.5h2"/>',
 "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 "car": '<path d="M4 16v-4l2.2-5h11.6l2.2 5v4z"/><path d="M4 12h16"/><circle cx="8" cy="16.5" r="1.6"/><circle cx="16" cy="16.5" r="1.6"/>',
 "bike": '<circle cx="6" cy="16" r="3"/><circle cx="18" cy="16" r="3"/><path d="M6 16l4-7h4l4 7M9 9h3"/>',
 "auto": '<path d="M4 16V9h9l5 4v3z"/><circle cx="7" cy="16.5" r="1.6"/><circle cx="16" cy="16.5" r="1.6"/><path d="M4 12h9"/>',
 "pin": '<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
 "home": '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/>',
 "gift": '<rect x="4" y="9" width="16" height="11" rx="1"/><path d="M4 13h16M12 9v11M12 9c-1.5-4-6-4-5-1.5S12 9 12 9s3.5 1 5-1.5-3.5-2.5-5 1.5"/>',
 "help": '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.3 2.4c-.6.3-.8.8-.8 1.4V14M12 17.2v.1"/>',
 "settings": '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
 "doc": '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
 "check": '<path d="M5 12.5l4.5 4.5L19 7"/>',
 "upload": '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
 "bell": '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20.5h4"/>',
 "share": '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4M8.2 13.2l7.6 4"/>',
 "alert": '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.2v.1"/>',
 "nav": '<path d="M3 11l18-8-8 18-2-8z"/>',
 "x": '<path d="M6 6l12 12M18 6L6 18"/>',
 "grid": '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
 "chart": '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
 "map": '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
 "card": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/>',
 "cash": '<rect x="3" y="6" width="18" height="12" rx="1.5"/><circle cx="12" cy="12" r="2.6"/>',
 "tag": '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8" r="1.4"/>',
 "mic": '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
 "send": '<path d="M4 12l16-8-6 16-2.5-6.5z"/>',
 "plus": '<path d="M12 5v14M5 12h14"/>',
 "filter": '<path d="M4 5h16l-6 7.5V19l-4 1.5v-8z"/>',
 "flag": '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
 "lock": '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
 "calendar": '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
 "route": '<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 18h6a3.5 3.5 0 0 0 0-7h-4a3.5 3.5 0 0 1 0-7h6"/>',
 "id": '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.3"/><path d="M5.5 16.5c.6-1.8 1.9-2.7 3.5-2.7s2.9.9 3.5 2.7M14.5 10h4M14.5 13.5h4"/>',
 "headset": '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M19 19c0 1.5-2 2.5-5 2.5"/>',
 "power": '<path d="M12 3v8"/><path d="M7 6.5a7 7 0 1 0 10 0"/>',
 "eye": '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
 "logout": '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>',
 "sync": '<path d="M20 11a8 8 0 0 0-14.5-4.5M4 13a8 8 0 0 0 14.5 4.5"/><path d="M5 3v4h4M19 21v-4h-4"/>',
 "wifi_off": '<path d="M3 3l18 18"/><path d="M8.5 16a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 4-2.3M19 12.5a10 10 0 0 0-3.2-2M12 20h.01"/>',
 "fuel": '<rect x="4" y="4" width="10" height="16" rx="1"/><path d="M4 10h10M14 8l4 3v7a1.5 1.5 0 0 0 3 0V9l-3-3"/>',
 "trophy": '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4M12 13v4M8 20h8"/>',
 "bag": '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
 "globe": '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z"/>',
 "gov": '<path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',
 "bot": '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 13v1M15 13v1M9.5 17h5"/>',
 "bus": '<rect x="5" y="3.5" width="14" height="15" rx="2.5"/><path d="M5 11h14M5 7.5h14"/><circle cx="8.5" cy="15" r="1"/><circle cx="15.5" cy="15" r="1"/><path d="M7 18.5v2M17 18.5v2"/>',
 "bed": '<path d="M3 18V6M3 13h18v5M21 18v-3"/><rect x="5.5" y="9" width="5" height="4" rx="1"/><path d="M10.5 10h7a3.5 3.5 0 0 1 3.5 3"/>',
 "food": '<path d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10"/><path d="M16 21V3c2.5 1 4 4 4 8h-4"/>',
 "box": '<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/>',
 "key": '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l2.5 2.5M14.5 8.5l2 2"/>',
 "leaf": '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19l8-8"/>',
 "download": '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
 "signal": '<path d="M4 20v-3M9 20v-7M14 20V9M19 20V4"/>',
 "sparkle": '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
 "seat": '<path d="M7 4v9h9l2 7M7 13l-2 7M16 13V9"/>',
 "hospital": '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 8v8M8 12h8"/>',
 "star_o": '<path d="M12 3l2.8 5.9 6.2.8-4.6 4.3 1.2 6.2L12 17.3 6.4 20.2l1.2-6.2L3 9.7l6.2-.8z"/>',
}

def icon(name, size=18, sw=1.9):
    return (f'<svg viewBox="0 0 24 24" width="{size}" height="{size}" fill="none" stroke="currentColor" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{_IC[name]}</svg>')

# ------------------------------------------------------------------ map art
def map_svg(w=340, h=740, route=None, pickup=None, drop=None, cars=(), me=None, heat=(), geofence=None,
            dim=False, zones=None, dark=False, labels=True):
    bg, blk, road, main, park, water = ("#E8EEF0", "#DCE4E8", "#FFFFFF", "#FBE7B5", "#CFE8D3", "#BFDDF0")
    if dark:
        bg, blk, road, main, park, water = ("#13212A", "#182A34", "#223844", "#3A4A3F", "#193A2C", "#123447")
    o = [f'<svg viewBox="0 0 {w} {h}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">',
         f'<rect width="{w}" height="{h}" fill="{bg}"/>']
    # blocks
    for i in range(0, w, 70):
        for j in range(0, h, 80):
            o.append(f'<rect x="{i+8}" y="{j+8}" width="54" height="64" rx="4" fill="{blk}"/>')
    o.append(f'<rect x="{w*0.58:.0f}" y="{h*0.10:.0f}" width="{w*0.3:.0f}" height="{h*0.14:.0f}" rx="10" fill="{park}"/>')
    o.append(f'<rect x="{w*0.06:.0f}" y="{h*0.62:.0f}" width="{w*0.26:.0f}" height="{h*0.12:.0f}" rx="10" fill="{park}"/>')
    o.append(f'<path d="M0 {h*0.83:.0f} C{w*0.3:.0f} {h*0.78:.0f} {w*0.6:.0f} {h*0.9:.0f} {w} {h*0.84:.0f} V{h} H0z" fill="{water}"/>')
    for i in range(0, w+1, 70):
        o.append(f'<rect x="{i-3}" y="0" width="6" height="{h}" fill="{road}"/>')
    for j in range(0, h+1, 80):
        o.append(f'<rect x="0" y="{j-3}" width="{w}" height="6" fill="{road}"/>')
    o.append(f'<path d="M0 {h*0.34:.0f} L{w} {h*0.25:.0f}" stroke="{main}" stroke-width="12"/>')
    o.append(f'<path d="M{w*0.72:.0f} 0 L{w*0.52:.0f} {h}" stroke="{main}" stroke-width="12"/>')
    if labels and w >= 300:
        lc = "#8C9AA4" if not dark else "#6E8795"
        o.append(f'<text x="{w*0.06:.0f}" y="{h*0.31:.0f}" font-size="10" fill="{lc}" font-family="Arial" transform="rotate(-5 {w*0.06:.0f} {h*0.31:.0f})">Ring Road</text>')
        o.append(f'<text x="{w*0.62:.0f}" y="{h*0.17:.0f}" font-size="10" fill="{lc}" font-family="Arial">City Park</text>')
    for (cx, cy, r) in heat:
        o.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#F2A516" opacity=".22"/><circle cx="{cx}" cy="{cy}" r="{r*0.55:.0f}" fill="#E8590C" opacity=".22"/>')
    if zones:
        for (pts, col, lab) in zones:
            p = " ".join(f"{x},{y}" for x, y in pts)
            o.append(f'<polygon points="{p}" fill="{col}" fill-opacity=".14" stroke="{col}" stroke-width="2" stroke-dasharray="6 4"/>')
            x0, y0 = pts[0]
            o.append(f'<text x="{x0+6}" y="{y0+16}" font-size="11" font-weight="700" fill="{col}" font-family="Arial">{esc(lab)}</text>')
    if geofence:
        p = " ".join(f"{x},{y}" for x, y in geofence)
        o.append(f'<polygon points="{p}" fill="#2F6FDB" fill-opacity=".10" stroke="#2F6FDB" stroke-width="2" stroke-dasharray="6 4"/>')
    if route:
        d = "M" + " L".join(f"{x},{y}" for x, y in route)
        o.append(f'<path d="{d}" fill="none" stroke="#0B7A68" stroke-width="9" stroke-linejoin="round" stroke-linecap="round" opacity=".25"/>')
        o.append(f'<path d="{d}" fill="none" stroke="#0B7A68" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>')
    for (cx, cy, rot) in cars:
        o.append(f'<g transform="translate({cx} {cy}) rotate({rot})"><rect x="-8" y="-13" width="16" height="26" rx="5" fill="#111B24"/>'
                 f'<rect x="-6" y="-8" width="12" height="7" rx="2" fill="#9FC7D9"/></g>')
    if pickup:
        x, y = pickup
        o.append(f'<circle cx="{x}" cy="{y}" r="11" fill="#0B7A68" opacity=".2"/><circle cx="{x}" cy="{y}" r="6.5" fill="#0B7A68" stroke="#fff" stroke-width="2.5"/>')
    if drop:
        x, y = drop
        o.append(f'<rect x="{x-7}" y="{y-7}" width="14" height="14" rx="2" fill="#D93A1E" stroke="#fff" stroke-width="2.5"/>')
    if me:
        x, y = me
        o.append(f'<circle cx="{x}" cy="{y}" r="26" fill="#2F6FDB" opacity=".14"/><circle cx="{x}" cy="{y}" r="8" fill="#2F6FDB" stroke="#fff" stroke-width="3"/>')
    if dim:
        o.append(f'<rect width="{w}" height="{h}" fill="#0C1318" opacity=".45"/>')
    o.append('</svg>')
    return "".join(o)

# ------------------------------------------------------------------ phone helpers
def statusbar(dark=False):
    return '<div class="sb"><span>9:41</span><span class="isl"></span><span class="ico">5G <i></i></span></div>'

def appbar(title, back=True, right=""):
    b = f'<span class="ib">{icon("back")}</span>' if back else ""
    return f'<div class="ab">{b}<span class="t">{title}</span>{right}</div>'

def phone(inner, dark=False):
    return f'<div class="phone"><div class="scr{" dark" if dark else ""}">{statusbar(dark)}{inner}</div></div>'

def li(ic, title, sub="", right="", tone=""):
    s = f"<span>{sub}</span>" if sub else ""
    return f'<div class="li"><span class="ic {tone}">{icon(ic)}</span><span class="tx"><b>{title}</b>{s}</span>{right}</div>'

def bnav(items, on):
    out = "".join(f'<span class="bn {"on" if k==on else ""}">{icon(ic,20)}{t}</span>' for k, ic, t in items)
    return f'<div class="bnav">{out}</div>'

RIDER_NAV = [("home", "home", "Home"), ("rides", "clock", "Trips"), ("wallet", "wallet", "Wallet"), ("acct", "user", "Account")]
SUPER_NAV = [("home", "home", "Home"), ("trips", "calendar", "Trips"), ("deals", "gift", "Savings"), ("wallet", "wallet", "Wallet"), ("acct", "user", "Account")]
PARTNER_NAV = [("orders", "bag", "Orders"), ("items", "grid", "Listings"), ("money", "wallet", "Payouts"), ("acct", "settings", "Settings")]
DRIVER_NAV = [("home", "home", "Home"), ("earn", "chart", "Earnings"), ("trips", "clock", "Trips"), ("acct", "user", "Account")]

def inp(label, value="", ph=False, focus=False, ic=None):
    v = f'<span class="ph">{value}</span>' if ph else value
    i = icon(ic, 18) if ic else ""
    return f'<div class="inp"><label>{label}</label><div class="box{" focus" if focus else ""}">{i}{v}</div></div>'

def btn(t, k="", ic=None):
    return f'<div class="btn {k}">{icon(ic,18) if ic else ""}{t}</div>'

# ------------------------------------------------------------------ admin desktop helpers
ADMIN_MENU = [
    ("OPERATIONS", [("dash", "grid", "Command center"), ("live", "map", "Live map"), ("rides", "route", "Rides"), ("orders", "bag", "Food & parcel orders")]),
    ("SERVICES", [("services", "globe", "Services & countries"), ("intercity", "route", "Long-distance & sharing"), ("coverage", "wifi_off", "Network coverage"), ("partners", "users", "Partners")]),
    ("PEOPLE", [("riders", "users", "Riders"), ("drivers", "id", "Drivers"), ("kyc", "doc", "KYC review"), ("vehicles", "car", "Vehicles & fleet")]),
    ("MONEY", [("pricing", "tag", "Pricing & surge"), ("zones", "globe", "Zones & geofences"), ("payments", "card", "Payments & refunds"), ("deals", "gift", "Deals & loyalty")]),
    ("TRUST", [("support", "headset", "Support tickets"), ("safety", "alert", "Safety & SOS"), ("fraud", "flag", "Fraud review"), ("calls", "phone", "Telephony"), ("agents", "chat", "Agent portal")]),
    ("INSIGHT", [("ai", "bot", "AI insights"), ("reports", "chart", "Reports"), ("gov", "gov", "Government reports"), ("audit", "eye", "Audit log")]),
    ("SYSTEM", [("rbac", "lock", "Roles & permissions"), ("notify", "bell", "Notifications"), ("config", "settings", "Configuration")]),
]

def desk(active, title, content, right=""):
    items = []
    for g, lst in ADMIN_MENU:
        items.append(f'<div class="grp">{g}</div>')
        for k, ic, t in lst:
            cnt = '<span class="cnt">3</span>' if k == "safety" else ('<span class="cnt">12</span>' if k == "kyc" else "")
            items.append(f'<a class="{"on" if k==active else ""}">{icon(ic,16)}{t}{cnt}</a>')
    sb = f'<div class="dsb"><div class="lg"><i></i>{B()}</div>{"".join(items)}</div>'
    top = (f'<div class="dtop"><span class="ttl">{title}</span>{right}<span class="srch">{icon("search",15)}Search rides, people, tickets</span>'
           f'<span class="me"><span class="av">PK</span><span style="display:flex;flex-direction:column"><b style="font-size:12.5px">Priya K.</b>'
           f'<span style="font-size:11px;color:#667685">Operations manager</span></span></span></div>')
    return f'<div class="desk">{sb}<div class="dmain">{top}<div class="dc">{content}</div></div></div>'

def kpi(label, value, delta="", bad=False, alert=False):
    d = f'<span class="d{" bad" if bad else ""}">{delta}</span>' if delta else ""
    return f'<div class="kpi{" alert" if alert else ""}"><span class="l">{label}</span><span class="v">{value}</span>{d}</div>'

def dtable(headers, rows):
    h = "".join(f"<th>{x}</th>" for x in headers)
    r = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in row) + "</tr>" for row in rows)
    return f'<table class="dt"><thead><tr>{h}</tr></thead><tbody>{r}</tbody></table>'

def st(text, k=""):
    return f'<span class="st {k}">{text}</span>'

def line_chart(w, h, series, color="#0B7A68", fill=True, labels=None):
    mx = max(max(s) for s in series) * 1.1
    o = [f'<svg viewBox="0 0 {w} {h}" width="100%" height="{h}" preserveAspectRatio="none">']
    for i in range(1, 4):
        o.append(f'<line x1="0" x2="{w}" y1="{h*i/4:.1f}" y2="{h*i/4:.1f}" stroke="#E1E7EC"/>')
    cols = [color, "#6B4FB3", "#B7791F"]
    for si, s in enumerate(series):
        n = len(s)
        pts = [(i*(w/(n-1)), h - v/mx*h) for i, v in enumerate(s)]
        d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts)
        if fill and si == 0:
            o.append(f'<path d="{d} L{w},{h} L0,{h}z" fill="{cols[si]}" opacity=".10"/>')
        o.append(f'<path d="{d}" fill="none" stroke="{cols[si]}" stroke-width="2"/>')
        x, y = pts[-1]
        o.append(f'<circle cx="{x-3:.1f}" cy="{y:.1f}" r="3.5" fill="{cols[si]}"/>')
    o.append('</svg>')
    return "".join(o)

def bar_chart(w, h, vals, color="#0B7A68", hi=None):
    mx = max(vals) * 1.1
    n = len(vals); bw = w / n * 0.62
    o = [f'<svg viewBox="0 0 {w} {h}" width="100%" height="{h}" preserveAspectRatio="none">']
    for i, v in enumerate(vals):
        x = i * w / n + (w/n - bw)/2; bh = v/mx*h
        c = color if (hi is None or i == hi) else "#BFE3D9"
        o.append(f'<rect x="{x:.1f}" y="{h-bh:.1f}" width="{bw:.1f}" height="{bh:.1f}" rx="3" fill="{c}"/>')
    o.append('</svg>')
    return "".join(o)

# ------------------------------------------------------------------ diagram renderers
FONT = "Segoe UI, Roboto, Helvetica, Arial, sans-serif"
KIND = {  # fill, stroke, text
 "n": ("#FFFFFF", "#AEBDC8", "#14202A"), "acc": ("#DCF1EB", "#0B7A68", "#0A3F36"),
 "alert": ("#FCE8DD", "#C2410C", "#6E250A"), "info": ("#E3ECFA", "#2F5DA8", "#1B3765"),
 "data": ("#EEE8FA", "#6B4FB3", "#3A2A66"), "warn": ("#FBF0D9", "#A8690F", "#5C3A07"),
 "ext": ("#F6F8F9", "#8A99A6", "#33424E"), "actor": ("#14202A", "#14202A", "#FFFFFF"),
}
EDGE = {"n": "#6A7B88", "acc": "#0B7A68", "alert": "#C2410C", "info": "#2F5DA8", "data": "#6B4FB3", "warn": "#A8690F"}
_uid = [0]

def _markers(p):
    return "<defs>" + "".join(
        f'<marker id="{p}{k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
        f'<path d="M0 0L10 5L0 10z" fill="{c}"/></marker>' for k, c in EDGE.items()) + "</defs>"

def _tw(s, size=11):
    return len(s) * size * 0.56

def _label(x, y, text, color="#566878", size=11):
    w = _tw(text, size) + 10
    return (f'<rect x="{x-w/2:.1f}" y="{y-size*0.9-2:.1f}" width="{w:.1f}" height="{size+6}" rx="4" fill="#FFFFFF" fill-opacity=".92"/>'
            f'<text x="{x:.1f}" y="{y:.1f}" text-anchor="middle" font-size="{size}" font-family="{FONT}" fill="{color}">{esc(text)}</text>')

def flow(nodes, edges=(), groups=(), cw=200, rh=100, bw=170, bh=58, pad=30, title=None, scale=1.0):
    _uid[0] += 1; p = f"m{_uid[0]}_"
    N = {}
    for n in nodes:
        w = bw + (n.get("w", 1) - 1) * cw
        h = n.get("h", bh)
        x = pad + n["c"] * cw
        y = pad + n["r"] * rh + (bh - h) / 2
        N[n["id"]] = dict(n, x=x, y=y, w=w, h=h, cx=x + w/2, cy=y + h/2)
    G = []
    for g in groups:
        lab, c0, r0, c1, r1 = g[:5]; k = g[5] if len(g) > 5 else "g"
        x = pad + c0*cw - 14; y = pad + r0*rh - 34
        w = (c1 - c0)*cw + bw + 28; h = (r1 - r0)*rh + bh + 48
        G.append((lab, x, y, w, h, k))
    xs = [v["x"] + v["w"] for v in N.values()] + [g[1] + g[3] for g in G]
    ys = [v["y"] + v["h"] for v in N.values()] + [g[2] + g[4] for g in G]
    x0 = min([v["x"] for v in N.values()] + [g[1] for g in G]) - pad
    y0 = min([v["y"] for v in N.values()] + [g[2] for g in G]) - pad + (0 if not title else -30)
    W = max(xs) + pad - x0; H = max(ys) + pad - y0
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.0f} {y0:.0f} {W:.0f} {H:.0f}" width="{W*scale:.0f}" height="{H*scale:.0f}" role="img" aria-label="{esc(title or "diagram")}">',
         f'<rect x="{x0}" y="{y0}" width="{W}" height="{H}" fill="#FFFFFF"/>', _markers(p)]
    if title:
        o.append(f'<text x="{x0+pad}" y="{y0+34}" font-size="15" font-weight="700" font-family="{FONT}" fill="#14202A">{esc(title)}</text>')
    GK = {"g": ("#F3F6F8", "#D3DDE4", "#566878"), "acc": ("#EEF8F5", "#9FD3C5", "#0B7A68"),
          "alert": ("#FFF5F0", "#F0B9A2", "#C2410C"), "info": ("#F1F5FD", "#B5C8EC", "#2F5DA8"),
          "data": ("#F6F3FC", "#CBBDEB", "#6B4FB3"), "warn": ("#FDF8EE", "#E8CF9E", "#A8690F")}
    glabels = []
    for lab, x, y, w, h, k in G:
        f, s, t = GK.get(k, GK["g"])
        o.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="12" fill="{f}" stroke="{s}"/>')
        tw = len(lab) * 7.4 + 12
        glabels.append(f'<rect x="{x+8:.1f}" y="{y+8:.1f}" width="{tw:.1f}" height="19" rx="4" fill="{f}"/>'
                       f'<text x="{x+14:.1f}" y="{y+21:.1f}" font-size="11" font-weight="700" letter-spacing="1" font-family="{FONT}" fill="{t}">{esc(lab.upper())}</text>')
    labels = []
    for e in edges:
        a, b = N[e["a"]], N[e["b"]]; k = e.get("k", "n")
        pa, pb = e.get("pa"), e.get("pb")
        if not pa:
            if abs(a["cy"] - b["cy"]) < 2:
                pa, pb = ("r", "l") if b["cx"] > a["cx"] else ("l", "r")
            elif b["cy"] > a["cy"]:
                pa, pb = "b", "t"
            else:
                pa, pb = "t", "b"
        def port(n, s, off):
            if s == "b": return n["cx"] + off, n["y"] + n["h"]
            if s == "t": return n["cx"] + off, n["y"]
            if s == "l": return n["x"], n["cy"] + off
            return n["x"] + n["w"], n["cy"] + off
        x1, y1 = port(a, pa, e.get("ao", 0)); x2, y2 = port(b, pb, e.get("bo", 0))
        m = e.get("m", 0.5)
        if pa in "bt" and pb in "bt":
            ym = y1 + (y2 - y1) * m if "ym" not in e else e["ym"]
            d = f"M{x1:.1f} {y1:.1f} V{ym:.1f} H{x2:.1f} V{y2:.1f}" if abs(x1-x2) > 1 else f"M{x1:.1f} {y1:.1f} V{y2:.1f}"
            lx, ly = ((x1+x2)/2, ym) if abs(x1-x2) > 1 else (x1, (y1+y2)/2)
        elif pa in "lr" and pb in "lr":
            xm = x1 + (x2 - x1) * m if "xm" not in e else e["xm"]
            d = f"M{x1:.1f} {y1:.1f} H{xm:.1f} V{y2:.1f} H{x2:.1f}" if abs(y1-y2) > 1 else f"M{x1:.1f} {y1:.1f} H{x2:.1f}"
            lx, ly = ((x1+x2)/2, y1 - 10) if abs(y1-y2) <= 1 else (xm, (y1+y2)/2)
        elif pa in "lr":
            d = f"M{x1:.1f} {y1:.1f} H{x2:.1f} V{y2:.1f}"; lx, ly = ((x1+x2)/2, y1)
        else:
            d = f"M{x1:.1f} {y1:.1f} V{y2:.1f} H{x2:.1f}"; lx, ly = (x1, (y1+y2)/2)
        dash = ' stroke-dasharray="6 4"' if e.get("dash") else ""
        both = f' marker-start="url(#{p}{k})"' if e.get("both") else ""
        o.append(f'<path d="{d}" fill="none" stroke="{EDGE[k]}" stroke-width="1.6"{dash}{both} marker-end="url(#{p}{k})"/>')
        if e.get("l"):
            lx += e.get("lx", 0); ly += e.get("ly", 0) + 4
            labels.append(_label(lx, ly, e["l"], EDGE[k] if k != "n" else "#566878"))
    for n in N.values():
        k = n.get("k", "n"); f, s, t = KIND[k]
        x, y, w, h = n["x"], n["y"], n["w"], n["h"]
        shape = n.get("shape", "box")
        if shape == "db":
            ry = 8
            o.append(f'<path d="M{x} {y+ry} A{w/2} {ry} 0 0 1 {x+w} {y+ry} V{y+h-ry} A{w/2} {ry} 0 0 1 {x} {y+h-ry}z" fill="{f}" stroke="{s}" stroke-width="1.4"/>')
            o.append(f'<ellipse cx="{x+w/2}" cy="{y+ry}" rx="{w/2}" ry="{ry}" fill="{f}" stroke="{s}" stroke-width="1.4"/>')
        elif shape == "q":
            o.append(f'<polygon points="{x+w/2},{y-6} {x+w},{y+h/2} {x+w/2},{y+h+6} {x},{y+h/2}" fill="{f}" stroke="{s}" stroke-width="1.4"/>')
        elif shape == "pill":
            o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{h/2}" fill="{f}" stroke="{s}" stroke-width="1.4"/>')
        else:
            dash = ' stroke-dasharray="5 4"' if k == "ext" else ""
            o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="9" fill="{f}" stroke="{s}" stroke-width="1.4"{dash}/>')
        lines = n["t"].split("\n"); subs = n.get("s", "").split("\n") if n.get("s") else []
        total = len(lines)*16 + len(subs)*14
        ty = n["cy"] - total/2 + 12 + (3 if shape == "db" else 0)
        for L in lines:
            o.append(f'<text x="{n["cx"]:.1f}" y="{ty:.1f}" text-anchor="middle" font-size="13" font-weight="600" font-family="{FONT}" fill="{t}">{esc(L)}</text>'); ty += 16
        for L in subs:
            sc = "#566878" if k not in ("actor",) else "#B9C9D4"
            o.append(f'<text x="{n["cx"]:.1f}" y="{ty:.1f}" text-anchor="middle" font-size="11" font-family="{FONT}" fill="{sc}">{esc(L)}</text>'); ty += 14
    o += labels
    o += glabels
    o.append("</svg>")
    return "".join(o)

def seq(parts, msgs, colw=175, pad=24, title=None):
    """parts: [(id,label,kind)], msgs: tuples: ('m',a,b,label,kind) ('r',a,b,label) ('self',a,label)
       ('note',a,b,text,kind) ('sec',label) ('async',a,b,label)"""
    _uid[0] += 1; p = f"s{_uid[0]}_"
    idx = {pid: i for i, (pid, _, _) in enumerate(parts)}
    X = lambda pid: pad + idx[pid]*colw + colw/2
    top = pad + (34 if title else 0)
    y = top + 62
    body = []; step = 1
    for m in msgs:
        t = m[0]
        if t == "sec":
            y += 6
            body.append(f'<line x1="{pad}" x2="{pad+len(parts)*colw}" y1="{y}" y2="{y}" stroke="#A8690F" stroke-dasharray="4 4"/>')
            w = _tw(m[1], 11) + 16
            body.append(f'<rect x="{pad}" y="{y-10}" width="{w}" height="20" rx="4" fill="#FBF0D9" stroke="#A8690F"/>'
                        f'<text x="{pad+8}" y="{y+4}" font-size="11" font-weight="700" font-family="{FONT}" fill="#5C3A07">{esc(m[1])}</text>')
            y += 28; continue
        if t == "note":
            _, a, b, text, k = (m + ("warn",))[:5]
            xa, xb = sorted([X(a), X(b)])
            xa -= colw*0.42; xb += colw*0.42
            f, s, tc = KIND[k]
            lines = text.split("\n")
            hh = 10 + 15*len(lines)
            body.append(f'<rect x="{xa:.1f}" y="{y-12}" width="{xb-xa:.1f}" height="{hh}" rx="6" fill="{f}" stroke="{s}"/>')
            ty = y + 3
            for L in lines:
                body.append(f'<text x="{(xa+xb)/2:.1f}" y="{ty}" text-anchor="middle" font-size="11.5" font-family="{FONT}" fill="{tc}">{esc(L)}</text>'); ty += 15
            y += hh + 14; continue
        if t == "self":
            _, a, label = m[:3]; k = m[3] if len(m) > 3 else "n"
            x = X(a)
            body.append(f'<path d="M{x} {y} H{x+34} V{y+18} H{x+2}" fill="none" stroke="{EDGE[k]}" stroke-width="1.5" marker-end="url(#{p}{k})"/>')
            body.append(f'<text x="{x+40}" y="{y+13}" font-size="11.5" font-family="{FONT}" fill="#14202A">{step}. {esc(label)}</text>')
            step += 1; y += 38; continue
        a, b, label = m[1], m[2], m[3]
        k = m[4] if len(m) > 4 else ("n" if t != "async" else "data")
        xa, xb = X(a), X(b)
        dash = ' stroke-dasharray="5 4"' if t in ("r", "async") else ""
        col = EDGE[k] if t != "r" else "#8A99A6"
        mk = k if t != "r" else "n"
        body.append(f'<line x1="{xa:.1f}" y1="{y}" x2="{xb - (6 if xb > xa else -6):.1f}" y2="{y}" stroke="{col}" stroke-width="1.5"{dash} marker-end="url(#{p}{mk})"/>')
        lab = f"{step}. {label}" if t != "r" else label
        body.append(f'<text x="{(xa+xb)/2:.1f}" y="{y-6}" text-anchor="middle" font-size="11.5" font-family="{FONT}" fill="{"#14202A" if t!="r" else "#566878"}">{esc(lab)}</text>')
        if t != "r": step += 1
        y += 34
    H = y + 20; W = pad*2 + len(parts)*colw
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="{esc(title or "sequence")}">',
         f'<rect width="{W}" height="{H}" fill="#FFFFFF"/>', _markers(p)]
    if title:
        o.append(f'<text x="{pad}" y="{pad+14}" font-size="15" font-weight="700" font-family="{FONT}" fill="#14202A">{esc(title)}</text>')
    for pid, lab, k in parts:
        x = X(pid); f, s, t = KIND[k]
        o.append(f'<line x1="{x}" x2="{x}" y1="{top+40}" y2="{H-12}" stroke="#C3CFD7" stroke-dasharray="4 4"/>')
        lines = lab.split("\n")
        o.append(f'<rect x="{x-colw/2+10}" y="{top}" width="{colw-20}" height="40" rx="8" fill="{f}" stroke="{s}" stroke-width="1.4"/>')
        ty = top + 24 - (len(lines)-1)*7
        for L in lines:
            o.append(f'<text x="{x}" y="{ty}" text-anchor="middle" font-size="12.5" font-weight="600" font-family="{FONT}" fill="{t}">{esc(L)}</text>'); ty += 14
    o += body
    o.append("</svg>")
    return "".join(o)
