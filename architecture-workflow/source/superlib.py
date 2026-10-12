"""Extra mock helpers for the super-app screens: corridor (long-distance) maps, legs, tiers, places."""
import math
from components import *

def _interp(pts, t):
    seg = [math.dist(pts[i], pts[i+1]) for i in range(len(pts)-1)]
    total = sum(seg); d = t * total
    for i, L in enumerate(seg):
        if d <= L or i == len(seg)-1:
            f = 0 if L == 0 else min(d / L, 1)
            return (pts[i][0] + (pts[i+1][0]-pts[i][0])*f, pts[i][1] + (pts[i+1][1]-pts[i][1])*f)
        d -= L

def _sub(pts, t0, t1, n=40):
    return [_interp(pts, t0 + (t1-t0)*k/n) for k in range(n+1)]

def _d(pts):
    return "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts)

CORRIDOR = [(60, 640), (90, 560), (150, 520), (140, 450), (200, 400), (250, 330), (220, 260), (270, 200), (250, 130), (290, 70)]
POI_C = {"H": "#6B4FB3", "F": "#D9643F", "B": "#2F6FDB", "G": "#A8690F", "+": "#D93A1E", "R": "#0B7A68", "E": "#3E7A1F"}

def corridor_svg(w=340, h=706, pts=CORRIDOR, segs=(), towns=(), pois=(), me_t=None, dim=False, forest=True, labels=True):
    o = [f'<svg viewBox="0 0 {w} {h}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">',
         f'<rect width="{w}" height="{h}" fill="#EAF0E6"/>']
    if forest:
        for (cx, cy, rx, ry) in [(210, 360, 120, 95), (90, 470, 70, 60), (300, 240, 70, 80), (60, 300, 60, 90)]:
            o.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="#BFD9B3"/>')
        for k in range(46):
            x = (k * 73) % w; y = 180 + (k * 131) % 380
            o.append(f'<circle cx="{x}" cy="{y}" r="5" fill="#9CC48C" opacity=".7"/>')
    o.append(f'<path d="M0 {h*0.2:.0f} C{w*0.3:.0f} {h*0.25:.0f} {w*0.4:.0f} {h*0.1:.0f} {w} {h*0.16:.0f}" stroke="#BFDDF0" stroke-width="9" fill="none"/>')
    o.append(f'<path d="{_d(pts)}" fill="none" stroke="#FFFFFF" stroke-width="12" stroke-linejoin="round" stroke-linecap="round"/>')
    o.append(f'<path d="{_d(pts)}" fill="none" stroke="#F3DFA8" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>')
    col = {"g": "#0B7A68", "a": "#F2A516", "n": "#6A7885"}
    for t0, t1, k in segs:
        sp = _sub(pts, t0, t1)
        dash = ' stroke-dasharray="7 6"' if k == "n" else ""
        o.append(f'<path d="{_d(sp)}" fill="none" stroke="{col[k]}" stroke-width="5" stroke-linecap="round"{dash}/>')
        if k == "n" and labels:
            mx, my = _interp(pts, (t0+t1)/2)
            o.append(f'<g transform="translate({mx+12:.0f} {my-10:.0f})"><rect x="0" y="-13" width="92" height="20" rx="6" fill="#33424E"/>'
                     f'<text x="46" y="1" text-anchor="middle" font-size="10.5" font-weight="700" fill="#fff" font-family="Arial">No network</text></g>')
    for tw in towns:
        t, lab = tw[0], tw[1]; side = tw[2] if len(tw) > 2 else "l"
        x, y = _interp(pts, t)
        o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="6" fill="#fff" stroke="#14202A" stroke-width="2.5"/>')
        if labels:
            tx, anc = (x-11, "end") if side == "l" else (x+11, "start")
            o.append(f'<text x="{tx:.1f}" y="{y+4:.1f}" text-anchor="{anc}" font-size="11" font-weight="700" fill="#14202A" font-family="Arial" paint-order="stroke" stroke="#EAF0E6" stroke-width="3">{esc(lab)}</text>')
    for t, ch, dx in pois:
        x, y = _interp(pts, t); x += dx
        c = POI_C.get(ch, "#14202A")
        o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="9" fill="{c}" stroke="#fff" stroke-width="2"/>'
                 f'<text x="{x:.1f}" y="{y+3.6:.1f}" text-anchor="middle" font-size="10" font-weight="800" fill="#fff" font-family="Arial">{ch}</text>')
    if me_t is not None:
        x, y = _interp(pts, me_t)
        o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="20" fill="#2F6FDB" opacity=".15"/><circle cx="{x:.1f}" cy="{y:.1f}" r="7.5" fill="#2F6FDB" stroke="#fff" stroke-width="3"/>')
    if dim:
        o.append(f'<rect width="{w}" height="{h}" fill="#0C1318" opacity=".4"/>')
    o.append("</svg>")
    return "".join(o)

def modes(on="bal"):
    M = [("urgent", "alert", "Urgent"), ("bal", "check", "Balanced"), ("saver", "wallet", "Saver"), ("flex", "clock", "Flexible"), ("deals", "tag", "Deals")]
    return '<div class="modes">' + "".join(f'<span class="mode {k}{" on" if k==on else ""}">{icon(i)}{t}</span>' for k, i, t in M) + "</div>"

def tier(on=(1,)):
    return '<span class="tier">' + "".join(f'<span class="{"on" if i in on else ""}">{t}</span>' for i, t in enumerate(["₹", "₹₹", "₹₹₹"])) + "</span>"

def badge(t, k):
    return f'<span class="badge {k}">{t}</span>'

def leg(tm, title, sub, price="", rail=""):
    return (f'<div class="leg"><span class="tm">{tm}</span><span class="rail"><i></i><b class="{rail}"></b></span>'
            f'<span class="bx"><b>{title}</b><span>{sub}</span></span><span class="pr">{price}</span></div>')

def place(name, sub, meta, price, ph=""):
    return (f'<div class="place"><span class="ph {ph}"></span><span class="tx"><b>{name}</b><span>{sub}</span><span>{meta}</span>'
            f'<span style="display:flex;justify-content:space-between;align-items:center;margin-top:2px"><b style="font-size:14px">{price}</b></span></span></div>')

def svc_grid(items):
    return '<div class="svc">' + "".join(f'<a><i>{icon(ic)}{f"<em>{tag}</em>" if tag else ""}</i>{t}</a>' for ic, t, tag in items) + "</div>"

def cov(parts):
    return '<div class="cov">' + "".join(f'<i class="{k}" style="width:{p}%"></i>' for k, p in parts) + "</div>"

def sect(t):
    return f'<div class="xs" style="font-weight:700;letter-spacing:.06em">{t}</div>'
