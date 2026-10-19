"""Static checks for the applications (customer-app, driver-app, patner-app, admin and the hand-written agent-portal),
the connected demo and the repository's entry page. Standard library only.
Run from architecture-workflow/:  py -m unittest discover -s tests -p "test_*.py" -v
"""
import filecmp
import glob
import os
import re
import sys
import unittest
from urllib.parse import unquote, urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
AW = os.path.abspath(os.path.join(HERE, ".."))
REPO = os.path.dirname(AW)
sys.path.insert(0, os.path.join(AW, "source"))
import htmltree  # noqa: E402
from registry import APPS  # noqa: E402
import build_apps  # noqa: E402

APP_DIRS = {app: meta[0] for app, meta in build_apps.APPS_META.items()}
GENERATED = {app: d for app, d in APP_DIRS.items() if app not in build_apps.HAND_WRITTEN}
REG_APP = {sid: app for app, lst in APPS.items() for sid, _, _ in lst}
PAGES = [os.path.join(REPO, d, "index.html") for d in APP_DIRS.values()] + [os.path.join(REPO, "connected-demo", "index.html"), os.path.join(REPO, "index.html")]
STORAGE = re.compile(r"\b(localStorage|sessionStorage|indexedDB)\s*[.\[]|document\.cookie|\bopenDatabase\(")
NETWORK = re.compile(r"\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket|EventSource|navigator\.sendBeacon|importScripts")
DANGER = re.compile(r"\beval\s*\(|new\s+Function\s*\(|\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write\s*\(")
DEVICE = re.compile(r"getUserMedia|geolocation\.|RTCPeerConnection|Notification\.requestPermission")


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


_ROUTES = {}


def routes(path):
    if path not in _ROUTES:
        nodes = list(htmltree.parse(read(path)).iter())
        # generated apps: one <section class="rn-screen"> per route; the agent portal: pages named by data-route links
        _ROUTES[path] = {x.get("data-sid") for x in nodes if x.has_class("rn-screen")} | {x.get("data-route") for x in nodes if x.get("data-route")}
    return _ROUTES[path]


def inside_label(n):
    p = n.parent
    while p is not None and p.kind == "el":
        if p.tag == "label":
            return True
        p = p.parent
    return False


def sections(app):
    root = htmltree.parse(read(os.path.join(REPO, APP_DIRS[app], "index.html")))
    return root, [n.get("data-sid") for n in root.iter() if n.has_class("rn-screen")]


class Pages(unittest.TestCase):
    def test_entry_points_exist(self):
        for p in PAGES:
            self.assertTrue(os.path.isfile(p), p)

    def test_every_screen_is_in_its_app_once(self):
        for app, screens in APPS.items():
            if app in build_apps.HAND_WRITTEN:
                continue
            _, sids = sections(app)
            self.assertEqual(sorted(sids), sorted(s for s, _, _ in screens), app)
            self.assertEqual(len(sids), len(set(sids)), app + " duplicate screens")

    def test_no_inline_code_and_restrictive_csp(self):
        for p in PAGES:
            t = read(p)
            root = htmltree.parse(t)
            for n in root.iter():
                self.assertIsNone(n.get("style"), f"{p}: style attribute on <{n.tag}>")
                self.assertNotEqual(n.tag, "style", p)
                if n.tag == "script":
                    self.assertIsNotNone(n.get("src"), f"{p}: inline script")
                self.assertFalse(any(k.lower().startswith("on") for k, _ in n.attrs), f"{p}: inline handler on <{n.tag}>")
                self.assertFalse((n.get("href") or "").lower().startswith("javascript:"), p)
            csp = re.search(r'Content-Security-Policy" content="([^"]+)"', t).group(1)
            self.assertIn("default-src 'none'", csp, p)
            self.assertIn("script-src 'self'", csp, p)
            self.assertNotIn("unsafe", csp, p)
            if "connected-demo" in p:
                self.assertIn("frame-src 'self'", csp)
            else:
                self.assertNotIn("frame-src", csp, p)

    def test_links_routes_and_assets_resolve(self):
        problems = []
        for p in PAGES:
            root = htmltree.parse(read(p))
            here = os.path.dirname(p)
            for n in root.iter():
                for attr in ("href", "src"):
                    v = n.get(attr)
                    if not v or v.startswith(("mailto:", "data:")) or re.match(r"^[a-z]+:", v):
                        continue
                    u = urlparse(v)
                    target = os.path.normpath(os.path.join(here, unquote(u.path))) if u.path else p
                    if not os.path.exists(target):
                        problems.append((os.path.relpath(p, REPO), v, "missing file"))
                        continue
                    m = re.match(r"^/([A-Z]\d\d)$", u.fragment or "")
                    if m and target.endswith("index.html"):
                        if m.group(1) not in routes(target):
                            problems.append((os.path.relpath(p, REPO), v, "unknown route"))
                    elif u.fragment and not u.path and u.fragment != "app-stage":
                        problems.append((os.path.relpath(p, REPO), v, "unexpected fragment"))
                for attr in ("data-go", "data-next"):
                    for sid in (n.get(attr) or "").split():
                        if not any(sid in [s for s, _, _ in lst] for lst in APPS.values()):
                            problems.append((os.path.relpath(p, REPO), sid, attr + " target unknown"))
        self.assertEqual(problems[:15], [])

    def test_agent_portal_is_a_controlled_web_portal(self):
        """The agent portal is a desktop web page (no phone frame) whose rules come from the admin-owned policy file."""
        base = os.path.join(REPO, APP_DIRS["support"])
        t = read(os.path.join(base, "index.html"))
        root = htmltree.parse(t)
        self.assertFalse([n for n in root.iter() if n.has_class("phone")], "agent portal must not use the phone frame")
        self.assertTrue([n for n in root.iter() if n.tag == "nav" and n.has_class("dsb")])
        self.assertTrue([n for n in root.iter() if n.tag == "header" and n.has_class("dtop")])
        self.assertTrue([n for n in root.iter() if n.tag == "footer" and n.has_class("dfoot")])
        scripts = [n.get("src") for n in root.iter() if n.tag == "script"]
        self.assertLess(scripts.index("assets/js/agent-policy.js"), scripts.index("assets/js/agent-app.js"))
        self.assertTrue(filecmp.cmp(os.path.join(base, "assets/js/agent-policy.js"), os.path.join(AW, "assets/js/agent-desk/agent-policy.js"), shallow=False))
        for f in ("agent-policy.js", "agent-sync.js", "agent-control.js"):
            self.assertTrue(os.path.isfile(os.path.join(REPO, "admin", "assets", "js", f)), "admin/" + f)
        self.assertIn('data-sid="A31"', read(os.path.join(REPO, "admin", "index.html")))

    def test_desktop_screens_have_header_body_and_footer(self):
        for app in ("admin",):
            root, _ = sections(app)
            mains = [n for n in root.iter() if n.has_class("dmain")]
            self.assertTrue(mains, app)
            for n in mains:
                kids = [(c.tag, c.classes()[0]) for c in n.children if c.kind == "el"]
                self.assertEqual(kids, [("header", "dtop"), ("div", "dc"), ("footer", "dfoot")], app)
            for n in root.iter():
                if n.has_class("dsb"):
                    self.assertEqual(n.tag, "nav", app)

    def test_interactive_elements_have_accessible_names(self):
        bad = []
        for app in APPS:
            root, _ = sections(app)
            ids = {n.get("id") for n in root.iter() if n.get("id")}
            labelled = {n.get("for") for n in root.iter() if n.tag == "label" and n.get("for")}
            for n in root.iter():
                if n.tag in ("button", "a") or n.get("role") in ("button", "switch", "link"):
                    if not (n.text_content().strip() or n.get("aria-label")):
                        bad.append((app, n.tag, n.get("class")))
                if n.tag in ("input", "select", "textarea") and n.get("type") != "hidden":
                    if not (n.get("aria-label") or n.get("id") in labelled or inside_label(n)):
                        bad.append((app, n.tag, n.get("name")))
            self.assertTrue(ids)
        self.assertEqual(bad[:10], [])


class Scripts(unittest.TestCase):
    def app_scripts(self):
        for d in list(APP_DIRS.values()) + ["connected-demo"]:
            yield from glob.glob(os.path.join(REPO, d, "assets", "js", "*.js"))

    def test_no_browser_storage_network_or_device_apis(self):
        for f in self.app_scripts():
            t = read(f)
            self.assertIsNone(STORAGE.search(t), f"{f}: browser storage API")
            self.assertIsNone(NETWORK.search(t), f"{f}: network API")
            self.assertIsNone(DANGER.search(t), f"{f}: unsafe DOM or dynamic code")
            self.assertIsNone(DEVICE.search(t), f"{f}: device permission API")

    def test_each_app_folder_is_self_contained(self):
        """Each folder runs on its own server: every file it loads is inside it, nothing refers to a neighbouring
        folder, and links to the other applications are the server addresses listed in its config.js."""
        servers = {url for _, url in build_apps.SERVERS.values()}
        for app, folder in APP_DIRS.items():
            base = os.path.join(REPO, folder)
            for f in glob.glob(os.path.join(base, "**", "*.*"), recursive=True):
                if f.endswith((".html", ".js", ".css")):
                    self.assertNotIn("../", read(f), f"{f}: refers to a neighbouring folder")
            config = read(os.path.join(base, "assets/js/config.js"))
            for url in servers:
                self.assertIn(f'"{url}"', config, f"{folder}: config.js misses {url}")
            root = htmltree.parse(read(os.path.join(base, "index.html")))
            for n in root.iter():
                for attr in ("href", "src"):
                    v = n.get(attr)
                    if not v or v.startswith("#"):
                        continue
                    if re.match(r"^[a-z]+:", v):
                        self.assertEqual(attr, "href", f"{folder}: {v} loaded from another server")
                        m = re.match(r"^(.*)#/([A-Z]\d\d)$", v)
                        self.assertTrue(m and m.group(1) in servers, f"{folder}: {v} is not an application address")
                        self.assertNotEqual(build_apps.SERVERS[REG_APP[m.group(2)]][1], build_apps.SERVERS[app][1], v)
                        continue
                    target = os.path.normpath(os.path.join(base, unquote(urlparse(v).path)))
                    self.assertTrue(target.startswith(base + os.sep), f"{folder}: {v} points outside the folder")
            need = ("README.md", "assets/js/config.js") + (("assets/js/agent-policy.js", "assets/js/agent-app.js") if app in build_apps.HAND_WRITTEN
                                                            else ("assets/js/controllers.js", "assets/css/screens.css"))
            for f in need:
                self.assertTrue(os.path.isfile(os.path.join(base, f)), f"{folder}/{f}")

    def test_controllers_only_for_own_screens(self):
        prefix = {"rider": "R", "driver": "D", "partner": "P", "admin": "A"}
        for app, folder in GENERATED.items():
            ids = set(re.findall(r"(?:def|extend)\('([A-Z])\d\d'", read(os.path.join(REPO, folder, "assets/js/controllers.js"))))
            self.assertEqual(ids, {prefix[app]}, folder)

    def test_screen_styles_match_the_pages(self):
        for app, folder in GENERATED.items():
            html = read(os.path.join(REPO, folder, "index.html"))
            css = read(os.path.join(REPO, folder, "assets/css/screens.css"))
            used = {c for v in re.findall(r'class="([^"]*)"', html) for c in v.split() if re.match(r'^x[b]?-', c)}
            defined = set(re.findall(r"^\.(x[b]?-[a-z0-9-]+)\{", css, re.M))
            self.assertEqual(used - defined, set(), f"{folder}: classes without rules")
            self.assertEqual(defined - used, set(), f"{folder}: rules for classes it does not use")

    def test_no_framework_or_package_files(self):
        for name in ("package.json", "node_modules", "vite.config.js", "webpack.config.js", "requirements.txt"):
            for d in list(APP_DIRS.values()) + ["connected-demo"]:
                self.assertFalse(os.path.exists(os.path.join(REPO, d, name)), f"{d}/{name}")


if __name__ == "__main__":
    unittest.main()
