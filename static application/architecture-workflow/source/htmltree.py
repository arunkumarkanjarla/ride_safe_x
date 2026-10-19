"""Minimal, dependency-free HTML tree used by the build to post-process generated pages.

Why a tree and not regular expressions: the build rewrites inline style attributes into
classes and wires prototype controls. Both need to know element boundaries and text
content reliably. The parser keeps the exact source text of every token, so a page that is
parsed and serialised without changes is byte-for-byte identical (checked by
tests/test_build.py).
"""
from html.parser import HTMLParser
import html as _html

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}


class Node:
    __slots__ = ("tag", "attrs", "children", "parent", "raw_start", "raw_end", "selfclose", "dirty", "kind", "text")

    def __init__(self, kind, tag=None, attrs=None, raw_start="", selfclose=False, text=""):
        self.kind = kind            # "el", "text", "raw" (comment, doctype, entity ...)
        self.tag = tag
        self.attrs = attrs or []    # list of [name, value]; value None for boolean attributes
        self.children = []
        self.parent = None
        self.raw_start = raw_start
        self.raw_end = ""
        self.selfclose = selfclose
        self.dirty = False
        self.text = text            # decoded text for text nodes, raw text for raw nodes

    # ----------------------------------------------------------------- attributes
    def get(self, name, default=None):
        for k, v in self.attrs:
            if k == name:
                return v
        return default

    def set(self, name, value):
        for a in self.attrs:
            if a[0] == name:
                if a[1] != value:
                    a[1] = value
                    self.dirty = True
                return
        self.attrs.append([name, value])
        self.dirty = True

    def remove(self, name):
        n = len(self.attrs)
        self.attrs = [a for a in self.attrs if a[0] != name]
        if len(self.attrs) != n:
            self.dirty = True

    def classes(self):
        return (self.get("class") or "").split()

    def has_class(self, c):
        return c in self.classes()

    def add_class(self, *cs):
        cur = self.classes()
        for c in cs:
            if c and c not in cur:
                cur.append(c)
        self.set("class", " ".join(cur))

    # ----------------------------------------------------------------- traversal
    def iter(self):
        for c in self.children:
            if c.kind == "el":
                yield c
                yield from c.iter()

    def text_content(self):
        out = []
        for c in self.children:
            if c.kind == "text":
                out.append(c.text)
            elif c.kind == "raw" and c.text.startswith("&"):
                out.append(_html.unescape(c.text))
            elif c.kind == "el":
                out.append(c.text_content())
        return "".join(out)

    def rename(self, tag):
        if self.tag != tag:
            self.tag = tag
            self.dirty = True

    # ----------------------------------------------------------------- output
    def start_tag(self):
        if not self.dirty:
            return self.raw_start
        parts = [self.tag]
        for k, v in self.attrs:
            parts.append(k if v is None else f'{k}="{_html.escape(v, quote=True)}"')
        return "<" + " ".join(parts) + ("/>" if self.selfclose else ">")

    def serialize(self):
        if self.kind == "text":
            return self.raw_start
        if self.kind == "raw":
            return self.text
        inner = "".join(c.serialize() for c in self.children)
        if self.kind == "doc":
            return inner
        if self.selfclose:
            return self.start_tag()
        end = self.raw_end
        if self.dirty and end:
            end = f"</{self.tag}>"
        return self.start_tag() + inner + end


class _Builder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.root = Node("doc")
        self.cur = self.root

    def _add(self, n):
        n.parent = self.cur
        self.cur.children.append(n)

    def handle_starttag(self, tag, attrs):
        n = Node("el", tag, [[k, v] for k, v in attrs], self.get_starttag_text())
        self._add(n)
        if tag not in VOID:
            self.cur = n

    def handle_startendtag(self, tag, attrs):
        self._add(Node("el", tag, [[k, v] for k, v in attrs], self.get_starttag_text(), selfclose=True))

    def handle_endtag(self, tag):
        raw = f"</{tag}>"
        n = self.cur
        while n is not self.root and n.tag != tag:
            n = n.parent
        if n is self.root:          # stray end tag: keep it verbatim
            self._add(Node("raw", text=raw))
            return
        # elements left open inside n are closed implicitly and keep an empty end tag
        n.raw_end = raw
        self.cur = n.parent

    def handle_data(self, data):
        t = Node("text", raw_start=data, text=data)
        self._add(t)

    def _offset(self):
        line, col = self.getpos()
        return self.line_starts[line - 1] + col

    def handle_entityref(self, name):
        # a reference may lack its ';' (e.g. "?from&to"); keep exactly what the source had
        end = self._offset() + 1 + len(name)
        semi = ";" if self.src[end:end + 1] == ";" else ""
        self._add(Node("raw", text=f"&{name}{semi}"))

    def handle_charref(self, name):
        end = self._offset() + 2 + len(name)
        semi = ";" if self.src[end:end + 1] == ";" else ""
        self._add(Node("raw", text=f"&#{name}{semi}"))

    def handle_comment(self, data):
        self._add(Node("raw", text=f"<!--{data}-->"))

    def handle_decl(self, decl):
        self._add(Node("raw", text=f"<!{decl}>"))

    def handle_pi(self, data):
        self._add(Node("raw", text=f"<?{data}>"))

    def unknown_decl(self, data):
        self._add(Node("raw", text=f"<![{data}]>"))


def parse(text):
    b = _Builder()
    b.src = text
    b.line_starts = [0]
    for i, ch in enumerate(text):
        if ch == "\n":
            b.line_starts.append(i + 1)
    b.feed(text)
    b.close()
    return b.root


def find_all(root, pred):
    return [n for n in root.iter() if pred(n)]


def by_id(root, ident):
    for n in root.iter():
        if n.get("id") == ident:
            return n
    return None
