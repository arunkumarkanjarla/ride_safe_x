"""Helpers for architecture pages."""
from components import *
from registry import slink

ARCH_PAGES = []   # (slug, title, desc)
REL = "../"

def fig(svg, caption, name):
    write(f"images/diagrams/{name}.svg", svg)
    return (f'<figure><div class="diagram">{svg}</div><figcaption>{caption} '
            f'<a href="{REL}images/diagrams/{name}.svg">Open image</a></figcaption></figure>')

def table(headers, rows, mono_cols=()):
    h = "".join(f"<th>{x}</th>" for x in headers)
    body = []
    for r in rows:
        body.append("<tr>" + "".join(f'<td class="{"m" if i in mono_cols else ""}">{c}</td>' for i, c in enumerate(r)) + "</tr>")
    return f'<div class="tw"><table><thead><tr>{h}</tr></thead><tbody>{"".join(body)}</tbody></table></div>'

def sec(eyebrow, title, *parts, intro=None):
    i = f"<p>{intro}</p>" if intro else ""
    return f'<section><div class="head"><div class="eyebrow">{eyebrow}</div><h2>{title}</h2>{i}</div>{"".join(parts)}</section>'

def api(method, path):
    return f'<span class="pill {method.lower()}">{method}</span> <code>{path}</code>'

def S(sid):
    return slink(sid, REL)

def arch_page(num, slug, title, desc, lead, sections):
    fname = f"{num}-{slug}.html"
    ARCH_PAGES.append((fname, num, title, desc))
    body = (f'<div class="head"><div class="crumbs"><a href="../index.html">Home</a> / <a href="index.html">Architecture</a> / {num}</div>'
            f'<div class="eyebrow">Architecture · {num}</div><h1>{title}</h1><p class="lead">{lead}</p></div>' + "".join(sections))
    return fname, body

def finish(fname, title, body, prev=None, nxt=None):
    pg = '<div class="pager">'
    pg += f'<a href="{prev[0]}">← {prev[1]} {prev[2]}</a>' if prev else "<span></span>"
    pg += f'<a href="{nxt[0]}">{nxt[1]} {nxt[2]} →</a>' if nxt else "<span></span>"
    pg += "</div>"
    js = ("js/generated/fee-config.js", "js/fee-calc.js") if 'id="feecalc"' in body else ()
    write(f"architecture/{fname}", page(title, body + pg, REL, "arch", extra_js=js))
