"""Generates the documentation that must stay in step with the implementation:

  docs/analysis/screen-image-mapping.md   every screen: role, files, purpose, actions, entry points, next screens, APIs, status, tests
  docs/workflows/navigation-map.md        route map built from the wired controls in the generated pages
  docs/workflows/state-machines.md        transition tables read from assets/js/rn-machines.js (needs Node.js)
  docs/reports/coverage.md                screen coverage summary

Run after a build, from the repository root:  py tools/gen_docs.py
"""
import glob
import json
import os
import re
import subprocess
import sys
from collections import defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "source"))
import htmltree  # noqa: E402
import proto_wiring  # noqa: E402
import rider, rider2, driver, admin, screens2, screens3, screens4  # noqa: E402,E401
from registry import APPS, SECTIONS, sfile  # noqa: E402

rider2.patch_old(rider.S); screens3.patch_old(rider.S, driver.S, admin.S)
SETS = {"rider": rider.S + rider2.S + screens3.R + screens4.R, "driver": driver.S + screens2.D + screens3.D + screens4.D, "partner": screens2.P + screens4.P, "admin": admin.S + screens2.A + screens3.A + screens4.A, "support": screens4.SUP}
SPEC = {s["id"]: s for lst in SETS.values() for s in lst}
LABEL = {"rider": "Rider (customer)", "driver": "Driver / delivery partner", "partner": "Partner", "admin": "Admin / operations", "support": "Support design (S screens; deployed as the agent portal)"}
APP_DIR = proto_wiring.APP_DIRS

# Screens exercised by the automated browser scenarios (tests/browser/e2e.test.js)
E2E = {   # test name (tests/browser/e2e.test.js) -> screens it drives through the UI
    "customer onboarding": "R01 R02 R58 R03 R04 R05 R06 R29 R28", "city ride": "R29 R07 R08 R09 R10 R11 R12 R15 R17 R19 R18 R20",
    "ride alternates": "R10 R11 R12 R17", "driver": "D01 D02 D03 D04 D05 D06 D07 D08 D09 D10 D11 D12 D16", "driver offline": "D10 D21",
    "partner": "P08 P09 P02 P04 P05 P10", "admin": "A01 A02 A07 A19 A13 A04 A05", "support": "S01 S02 S03 S05 S06 S08 S09 S10 S20 S21 S22 S07 S11",
    "responsive": "R29 D06 P09 A04 S02", "keyboard/reset": "R05", "connected demo": "R10 R11 R12 D06 D07 D08 A04 S06",
}
TESTED = defaultdict(list)
for k, v in E2E.items():
    for sid in v.split():
        TESTED[sid].append(k)


def strip(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s)).strip()


def controls(sid):
    """Wired controls of a built page: list of (label, kind, detail)."""
    path = os.path.join(ROOT, sfile(sid))
    root = htmltree.parse(open(path, encoding="utf-8").read())
    mock = htmltree.by_id(root, "mock")
    out = []
    for n in mock.iter():
        go, do, ui, msg = n.get("data-go"), n.get("data-do"), n.get("data-ui"), n.get("data-msg")
        back = n.get("data-back", "x") is None
        if n.parent is not None and (n.parent.has_class("bnav") or n.parent.has_class("dsb")):
            continue
        if not (go or do or ui or msg or back) and n.tag != "input":
            continue
        label = n.get("aria-label") or re.sub(r"\s+", " ", n.text_content()).strip()[:40] or n.tag
        if n.tag == "input":
            out.append((n.get("name") or "field", "input", n.get("type") or "text"))
        elif back:
            out.append((label, "back", n.get("data-back-to") or ""))
        elif do:
            out.append((label, "action", do + (" → " + (go or n.get("data-next") or "") if (go or n.get("data-next")) else "")))
        elif msg:
            out.append((label, "simulated", msg.replace("Simulated in the prototype: ", "")[:60]))
        elif ui:
            out.append((label, ui, ""))
        else:
            out.append((label, "link", go))
    return out


def targets(sid):
    path = os.path.join(ROOT, sfile(sid))
    mock = htmltree.by_id(htmltree.parse(open(path, encoding="utf-8").read()), "mock")
    t = set()
    for n in mock.iter():
        if n.get("data-go"):
            t.add(n.get("data-go"))
        t.update((n.get("data-next") or "").split())
    t.update(proto_wiring.FOLLOW.get(sid, ()))
    t.update(proto_wiring.DYNAMIC.get(sid, ()))
    t.discard(sid)
    return t


def controllers():
    js = "".join(open(os.path.join(ROOT, "assets", "js", f), encoding="utf-8").read() for f in ("rn-screens.js", "rn-screens-2.js"))
    return set(re.findall(r"def\('([A-Z]\d\d)'", js))


def write(rel, text):
    p = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    print("wrote", rel)


def main():
    ctrl = controllers()
    order = [sid for app in APPS for sid, _, _ in APPS[app]]
    tg = {sid: targets(sid) for sid in order}
    incoming = defaultdict(set)
    for s, ts in tg.items():
        for t in ts:
            incoming[t].add(s)

    # ------------------------------------------------------------ screen-image mapping
    lines = ["# Screen inventory and screen-to-image mapping", "",
             "Generated by `tools/gen_docs.py` from the screen specifications (`source/*.py`), the built pages and the",
             "prototype wiring. Do not edit by hand. Every image is the PNG rendering of the same screen's mock",
             "(`source/shots.py`), so the file name is the screen ID.", "",
             "Status legend: **Interactive** = controls wired and a screen controller adds live behaviour; **Wired** = every",
             "control navigates, toggles or shows a labelled simulated result, data shown is the approved sample;",
             "**Display** = no controls in the approved design (reached and left through navigation).", ""]
    summary = defaultdict(lambda: defaultdict(int))
    for app in APPS:
        lines += [f"## {LABEL[app]} – {len(APPS[app])} screens", ""]
        for sec, lst in SECTIONS[app]:
            lines += [f"### {sec}", ""]
            for sid, slug, title in lst:
                s = SPEC[sid]
                cs = controls(sid)
                kinds = defaultdict(int)
                for c in cs:
                    kinds[c[1]] += 1
                status = "Interactive" if sid in ctrl else ("Wired" if cs else "Display")
                summary[app][status] += 1
                acts = "; ".join(f"{c[0]} ({c[1]}{': ' + c[2] if c[2] else ''})" for c in cs) or "none in the approved design"
                apis = "; ".join(f"`{m} {p}`" for m, p, _ in s.get("apis", [])) or "none"
                ev = ", ".join(f"`{e}`" for e in s.get("events", [])) or "none"
                sim = [c for c in cs if c[1] == "simulated"]
                missing = []
                if sim:
                    missing.append(f"{len(sim)} control(s) show a labelled simulated result only")
                if not cs:
                    missing.append("no controls in the approved design")
                lines += [f"#### {sid} · {title}", "",
                          "| Field | Value |", "| --- | --- |",
                          f"| Role | {LABEL[app]} |",
                          f"| Specification page | [`{sfile(sid)}`](../../{sfile(sid)}) |",
                          f"| Application route | [`{APP_DIR[app]}/index.html#/{sid}`](../../../{APP_DIR[app]}/index.html#/{sid}) |",
                          f"| Image | [`images/screens/{app}/{sid}.png`](../../images/screens/{app}/{sid}.png) |",
                          f"| Purpose | {strip(s['purpose'])} |",
                          f"| Available actions | {acts} |",
                          f"| Entry points | {', '.join(sorted(incoming[sid])) or 'indexes, demo console, pager'} |",
                          f"| Next screens | {', '.join(sorted(tg[sid])) or '—'} (spec: {', '.join(s.get('to', [])) or '—'}) |",
                          f"| Specified APIs (future backend) | {apis} |",
                          f"| Specified events | {ev} |",
                          f"| Status | {status} · {sum(kinds.values())} wired control(s){' · controller' if sid in ctrl else ''} |",
                          f"| Missing / simulated | {'; '.join(missing) or '—'} |",
                          f"| Automated tests | every-screen check (opens, no errors, all actions handled){'; e2e: ' + ', '.join(TESTED[sid]) if TESTED[sid] else ''} |", ""]
    write("docs/analysis/screen-image-mapping.md", "\n".join(lines))

    # ------------------------------------------------------------ navigation map
    nav = ["# Navigation and route map", "", "Generated by `tools/gen_docs.py` from the wired controls in the built pages",
           "(`data-go`, declared controller navigation `data-next`, and automatic follow-ups in `proto_wiring.FOLLOW`).",
           "Bottom navigation, the admin sidebar and back buttons are available on every screen of an app and are not repeated.", ""]
    for app in APPS:
        nav += [f"## {LABEL[app]}", "", "| Screen | Goes to | Reached from |", "| --- | --- | --- |"]
        for sid, slug, title in APPS[app]:
            nav.append(f"| {sid} {title} | {', '.join(sorted(tg[sid])) or '—'} | {', '.join(sorted(incoming[sid])) or '—'} |")
        nav.append("")
    nav += ["## Automatic navigation (state driven)", "", "| Screen | Moves on to when the shared state changes |", "| --- | --- |"]
    nav += [f"| {k} | {', '.join(v)} |" for k, v in proto_wiring.FOLLOW.items()]
    write("docs/workflows/navigation-map.md", "\n".join(nav) + "\n")

    # ------------------------------------------------------------ state machines
    try:
        raw = subprocess.run(["node", "-e", "const m=require('./assets/js/rn-machines.js');console.log(JSON.stringify({M:m.M,B:m.BRIEF_NAMES}))"],
                             cwd=ROOT, capture_output=True, text=True, check=True).stdout
        data = json.loads(raw)
        sm = ["# State machines (implemented)", "", "Generated by `tools/gen_docs.py` from `assets/js/rn-machines.js`, the single source the mock engine",
              "uses to accept or reject every transition. Preconditions, timers and UI effects are described in",
              "[workflows.md](workflows.md).", ""]
        for name, m in data["M"].items():
            sm += [f"## {name}", "", f"Initial state: `{m['initial']}` · final: {', '.join('`' + x + '`' for x in m['final']) or '—'}", "",
                   "| From | Event | To | Actor(s) |", "| --- | --- | --- | --- |"]
            for fr, ev, to, actors in m["t"]:
                fr = fr if isinstance(fr, list) else [fr]
                sm.append(f"| {', '.join(fr)} | `{ev}` | {to} | {', '.join(actors)} |")
            sm.append("")
        sm += ["## Mapping to the simplified states in the brief", "", "| Implemented ride state | Brief name |", "| --- | --- |"]
        sm += [f"| {k} | {v} |" for k, v in data["B"].items()]
        write("docs/workflows/state-machines.md", "\n".join(sm) + "\n")
    except (OSError, subprocess.CalledProcessError) as e:
        print("skipped state machines (Node.js not available):", e)

    # ------------------------------------------------------------ coverage summary
    cov = ["# Screen coverage summary", "", "Generated by `tools/gen_docs.py`.", "",
           "| App | Screens | Interactive | Wired | Display only | Covered by e2e scenarios |", "| --- | --- | --- | --- | --- | --- |"]
    for app in APPS:
        ids = [sid for sid, _, _ in APPS[app]]
        cov.append(f"| {LABEL[app]} | {len(ids)} | {summary[app]['Interactive']} | {summary[app]['Wired']} | {summary[app]['Display']} | {sum(1 for i in ids if TESTED[i])} |")
    total = len(order)
    cov += ["", f"All {total} screens are generated, load without errors (smoke test) and are reachable from controls",
            "(`tests/test_static.py::test_every_screen_reachable_from_controls`; documented exceptions are listed there).", "",
            "## Screens without their own controls", ""]
    titles = {sid: title for app in APPS for sid, _, title in APPS[app]}
    cov += [f"- {sid} {titles[sid]}" for sid in order if not controls(sid)]
    write("docs/reports/coverage.md", "\n".join(cov) + "\n")

    # ------------------------------------------------------------ application route inventory
    ri = ["# Application route inventory", "", "Generated by `tools/gen_docs.py`. Every application is one HTML page; each screen is a hash route.",
          "Routes outside the sign-in list redirect signed-out users to the app's sign-in screen (simulated session).", ""]
    for app in APPS:
        ri += [f"## {LABEL[app]} – `{APP_DIR[app]}/index.html`", "", "| Route | Screen | Section | Goes to |", "| --- | --- | --- | --- |"]
        sec_of = {sid: s for s, lst in SECTIONS[app] for sid, _, _ in lst}
        for sid, slug, title in APPS[app]:
            ri.append(f"| `#/{sid}` | {title} | {sec_of[sid]} | {', '.join(sorted(tg[sid])) or '—'} |")
        ri.append("")
    write("docs/static-app/route-inventory.md", "\n".join(ri) + "\n")


if __name__ == "__main__":
    main()
