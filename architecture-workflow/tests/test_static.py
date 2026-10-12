"""Static checks for the generated prototype. Standard library only.
Run from the repository root:  py -m unittest discover -s tests -p "test_*.py" -v
"""
import glob
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from urllib.parse import unquote, urlparse

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "source"))
import htmltree  # noqa: E402
import proto_wiring  # noqa: E402

PAGES = sorted(glob.glob(os.path.join(ROOT, "**", "*.html"), recursive=True))
PAGES = [p for p in PAGES if os.sep + "node_modules" + os.sep not in p and os.sep + "docs" + os.sep not in p]
SCREENS = sorted(glob.glob(os.path.join(ROOT, "screens", "*", "[A-Z][0-9][0-9]-*.html")))


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


class GeneratedOutput(unittest.TestCase):
    def test_page_counts(self):
        self.assertEqual(len(SCREENS), 145)
        for app, n in (("rider", 58), ("driver", 29), ("partner", 11), ("admin", 31), ("support", 16)):
            self.assertEqual(len(glob.glob(os.path.join(ROOT, "screens", app, "[A-Z][0-9][0-9]-*.html"))), n, app)
            self.assertEqual(len(glob.glob(os.path.join(ROOT, "images", "screens", app, "*.png"))), n, app + " PNGs")

    def test_no_inline_css_or_js(self):
        bad = []
        for p in PAGES:
            root = htmltree.parse(read(p))
            for n in root.iter():
                if n.get("style") is not None:
                    bad.append((p, "style attribute"))
                if n.tag == "style":
                    bad.append((p, "<style> block"))
                if n.tag == "script" and n.get("src") is None:
                    bad.append((p, "inline <script>"))
                for k, _ in n.attrs:
                    if k.lower().startswith("on"):
                        bad.append((p, "event handler " + k))
                if (n.get("href") or "").strip().lower().startswith("javascript:"):
                    bad.append((p, "javascript: URL"))
        self.assertEqual(bad[:10], [])

    def test_csp_on_every_page(self):
        for p in PAGES:
            t = read(p)
            self.assertIn('http-equiv="Content-Security-Policy"', t, p)
            csp = re.search(r'Content-Security-Policy" content="([^"]+)"', t).group(1)
            self.assertIn("default-src 'none'", csp)
            self.assertIn("script-src 'self'", csp)
            self.assertNotIn("unsafe-inline", csp)
            self.assertNotIn("unsafe-eval", csp)

    def test_no_eval_or_html_injection_in_scripts(self):
        for p in glob.glob(os.path.join(ROOT, "assets", "**", "*.js"), recursive=True):
            t = read(p)
            for pat in (r"\beval\s*\(", r"new\s+Function\s*\(", r"\.innerHTML\s*=", r"\.outerHTML\s*=", r"insertAdjacentHTML", r"document\.write\s*\("):
                self.assertIsNone(re.search(pat, t), f"{p}: {pat}")

    def test_no_external_resources(self):
        for p in PAGES:
            root = htmltree.parse(read(p))
            for n in root.iter():
                for attr in ("src", "href"):
                    v = n.get(attr)
                    if v and n.tag in ("script", "link", "img", "iframe"):
                        self.assertFalse(re.match(r"^(https?:)?//", v), f"{p}: external {n.tag} {v}")

    def test_local_links_and_assets_resolve(self):
        missing = set()
        for p in PAGES:
            root = htmltree.parse(read(p))
            for n in root.iter():
                for attr in ("href", "src"):
                    v = n.get(attr)
                    if not v or v.startswith(("#", "mailto:", "data:")) or re.match(r"^[a-z]+:", v):
                        continue
                    target = os.path.normpath(os.path.join(os.path.dirname(p), unquote(urlparse(v).path)))
                    if not os.path.exists(target):
                        missing.add((os.path.relpath(p, ROOT), v))
        self.assertEqual(sorted(missing)[:15], [])

    def test_well_formed_and_round_trip(self):
        for p in PAGES:
            t = read(p)
            self.assertEqual(htmltree.parse(t).serialize(), t, p)
            self.assertTrue(t.startswith("<!doctype html>"), p)
            self.assertIn('<html lang="en">', t, p)

    def test_generated_css_has_no_unused_gap(self):
        css = read(os.path.join(ROOT, "assets", "css", "generated", "extracted.css"))
        used = set()
        for p in PAGES:
            used.update(re.findall(r'\b(x[b]?-[a-z0-9-]+)', read(p)))
        defined = set(re.findall(r"^\.(x[b]?-[a-z0-9-]+)\{", css, re.M))
        self.assertEqual(sorted(used - defined), [], "classes used but not defined")


class Wiring(unittest.TestCase):
    def test_wiring_table_matches_mocks(self):
        r = subprocess.run([sys.executable, os.path.join(ROOT, "tests", "check_wiring.py")], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)

    def test_every_screen_reachable_from_controls(self):
        """Breadth-first walk over links and data-go targets inside the mocks, starting from the app entry screens."""
        edges = {}
        for p in SCREENS:
            sid = os.path.basename(p)[:3]
            mock = htmltree.by_id(htmltree.parse(read(p)), "mock")
            targets = set()
            for n in mock.iter():
                if n.get("data-go"):
                    targets.add(n.get("data-go"))
                targets.update((n.get("data-next") or "").split())
            edges[sid] = targets | set(proto_wiring.FOLLOW.get(sid, ())) | set(proto_wiring.DYNAMIC.get(sid, ()))
        reach, todo = set(), ["R01", "D01", "P08", "P01", "A01", "S01"]
        while todo:
            s = todo.pop()
            if s in reach:
                continue
            reach.add(s)
            todo.extend(edges.get(s, ()))
        missing = sorted(set(edges) - reach)
        # documented exceptions: screens with no entry control in the approved designs (see docs/reports/coverage.md)
        allowed = {"R51"} & set(missing)
        self.assertEqual(sorted(set(missing) - allowed), [], "unreachable from controls")

    def test_interactive_elements_have_names(self):
        bad = []
        for p in SCREENS:
            mock = htmltree.by_id(htmltree.parse(read(p)), "mock")
            for n in mock.iter():
                interactive = n.tag in ("button", "a") or n.get("role") in ("button", "switch", "link")
                if interactive and not (n.text_content().strip() or n.get("aria-label")):
                    bad.append((os.path.basename(p), n.tag, n.get("class")))
                if n.tag == "input" and n.get("type") != "hidden":
                    ident = n.get("id")
                    has_label = n.get("aria-label") or (ident and re.search(r'for="%s"' % re.escape(ident), read(p)))
                    if not has_label:
                        bad.append((os.path.basename(p), "input", ident))
        self.assertEqual(bad[:10], [])

    def test_no_nested_interactive(self):
        for p in SCREENS:
            mock = htmltree.by_id(htmltree.parse(read(p)), "mock")
            for n in mock.iter():
                if n.tag in ("a", "button"):
                    inner = [d for d in n.iter() if d.tag in ("a", "button") or d.get("role") in ("button", "switch")]
                    self.assertEqual(inner, [], p)


class Reproducible(unittest.TestCase):
    def test_build_is_reproducible(self):
        """Building twice into fresh folders gives identical files, and matches the committed output."""
        outs = []
        for _ in range(2):
            # the build also writes the applications next to its output folder, so give each build its own parent
            d = os.path.join(tempfile.mkdtemp(prefix="rn-build-"), "architecture-workflow")
            os.makedirs(d)
            env = dict(os.environ, BLUEPRINT_OUT=d)
            r = subprocess.run([sys.executable, "build.py"], cwd=os.path.join(ROOT, "source"), env=env, capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr[-2000:])
            outs.append(d)
        a, b = outs
        files = [os.path.relpath(f, a) for f in glob.glob(os.path.join(a, "**", "*"), recursive=True) if os.path.isfile(f)]
        self.assertGreater(len(files), 200)
        diff_ab, diff_repo = [], []
        for f in files:
            fa, fb, fr = os.path.join(a, f), os.path.join(b, f), os.path.join(ROOT, f)
            if read_bytes(fa) != read_bytes(fb):
                diff_ab.append(f)
            if not os.path.exists(fr) or read_bytes(fa) != read_bytes(fr):
                diff_repo.append(f)
        for d in outs:
            shutil.rmtree(os.path.dirname(d), ignore_errors=True)
        self.assertEqual(diff_ab, [], "two builds differ")
        self.assertEqual(diff_repo[:10], [], "repository output is stale: run py source/build.py")


def read_bytes(p):
    with open(p, "rb") as f:
        return f.read().replace(b"\r\n", b"\n")


if __name__ == "__main__":
    unittest.main()
