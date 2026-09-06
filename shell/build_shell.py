"""Turn a raw Chrome "Webpage, Complete" save of the Candy conversation screen into a static frame with
slots for the demo's React components, plus a stylesheet purged to the classes it uses.

Input (gitignored):  shell/raw/page.html, shell/raw/page_files/, shell/raw/application.css
Output (committed):  shell/conversation.html, shell/candy-purged.css, lib/shellHtml.ts, public/shell/*

The frame is a 1:1 copy of the saved page's layout and assets. Scripts, iframes, hidden modals, toasts
and forms are removed; every message body, chat-list name, preview and timestamp is replaced; every id,
data-*, handler, srcset, title and link target is dropped; the character is renamed Aria. Every image
and inline background the save included is copied into public/shell and referenced from there.
Nothing personal survives, and nothing from raw/ is ever committed.
"""
from __future__ import annotations

import io
import re
import sys
from pathlib import Path
from urllib.parse import unquote

from bs4 import BeautifulSoup, Comment, NavigableString

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw"
ASSETS_SRC = RAW / "page_files"
ASSETS_OUT = ROOT.parent / "public" / "shell"
OUT_HTML = ROOT / "conversation.html"
OUT_CSS = ROOT / "candy-purged.css"
OUT_TS = ROOT.parent / "lib" / "shellHtml.ts"
COMPONENTS = ROOT.parent / "components"

ICON_PLACEHOLDER = (
    "data:image/svg+xml;utf8,"
    "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E"
    "%3Crect x='3' y='3' width='18' height='18' rx='5' fill='%23ffffff' fill-opacity='0.55'/%3E%3C/svg%3E"
)

KEEP_TEXT = {
    "chat", "create new", "all", "unread", "favorites", "profile", "gallery", "items", "online",
    "home", "discover", "shorts", "candy shop", "collection", "create", "new", "discord",
    "help center", "contact us", "affiliate", "english", "legal", "terms", "trust & safety",
    "open sidebar", "search", "0", "companion", "aria", "assistant",
}
KEEP_RE = re.compile(r"search for a profile|write a message", re.I)
TIME_RE = re.compile(
    r"^(yesterday,?\s*|today,?\s*)?\d{1,2}:\d{2}\s*(am|pm)?$|^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$",
    re.I,
)
DROP_ATTRS_PREFIX = ("data-", "on", "x-", "@", ":", "aria-controls", "aria-describedby", "aria-labelledby")
DROP_ATTRS = {
    "id", "srcset", "sizes", "action", "value", "content", "poster", "title", "method", "name", "for",
    "tabindex", "complete", "loading", "target",
}
RESPONSIVE_SHOW = re.compile(r"^(sm|md|lg|xl|2xl):(flex|block|grid|inline|inline-flex|inline-block|contents|table)$")
PERSONAL = re.compile(r"brianna|brenda|howe|jackson|diogo", re.I)

_asset_cache: dict[str, str | None] = {}


def sniff_ext(data: bytes) -> str:
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    if data[:4] == bytes([0x89, 0x50, 0x4E, 0x47]):
        return ".png"
    if data[:3] == bytes([0xFF, 0xD8, 0xFF]):
        return ".jpg"
    if b"<svg" in data[:600].lower():
        return ".svg"
    if data[:3] == b"GIF":
        return ".gif"
    return ""


def asset_url(orig: str | None) -> str | None:
    """Copy the saved asset behind an original src or url() into public/shell and return its URL.
    Chrome keeps every image next to page.html, so a 1:1 copy only needs the basename."""
    if not orig:
        return None
    name = unquote(orig.split("?")[0].rstrip("/").split("/")[-1])
    if not name:
        return None
    if name in _asset_cache:
        return _asset_cache[name]
    src = ASSETS_SRC / name
    if not src.is_file():
        _asset_cache[name] = None
        return None
    data = src.read_bytes()
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", name)
    if not re.search(r"\.(svg|png|jpe?g|webp|gif)$", safe, re.I):
        safe += sniff_ext(data)
    ASSETS_OUT.mkdir(parents=True, exist_ok=True)
    (ASSETS_OUT / safe).write_bytes(data)
    url = "/shell/" + safe
    _asset_cache[name] = url
    return url


def scrub_text(soup: BeautifulSoup, msg_root) -> None:
    for t in list(soup.find_all(string=True)):
        if isinstance(t, Comment):
            t.extract()
            continue
        if not isinstance(t, NavigableString):
            continue
        parent = t.parent
        if parent is None or parent.name in ("style", "script", "svg", "path"):
            continue
        s = t.strip()
        if not s:
            continue
        v = re.sub(r"Brenda( Jackson)?", "Aria", s)
        v = v.replace("Sex Friends", "Companion")
        kept = v.lower() in KEEP_TEXT or bool(KEEP_RE.search(v))
        if msg_root is not None and msg_root in parent.parents:
            v = "{{time}}" if TIME_RE.match(v) else "{{msg}}"
        elif not kept:
            v = "{{time}}" if TIME_RE.match(v) else "{{text}}"
        t.replace_with(v)


def swap_style_urls(style: str) -> str:
    def swap(m: re.Match) -> str:
        raw = m.group(1).strip().strip("'\"").replace("&#39;", "").replace("&quot;", "")
        mapped = asset_url(raw)
        return f"url('{mapped}')" if mapped else "none"

    return re.sub(r"url\(([^)]*)\)", swap, style)


def scrub_attrs(soup: BeautifulSoup) -> None:
    for el in list(soup.find_all(True)):
        if el.attrs is None or el.parent is None:
            continue
        if el.name == "source":
            el.decompose()
            continue
        for a in list(el.attrs):
            if a == "data-slot":
                continue
            if a in DROP_ATTRS or a.startswith(DROP_ATTRS_PREFIX):
                del el.attrs[a]
        if el.name == "a":
            el.attrs["href"] = "#"
        if el.name == "img":
            el.attrs["src"] = asset_url(el.get("src")) or "{{img}}"
            el.attrs["alt"] = ""
        else:
            el.attrs.pop("src", None)
        if el.get("class"):
            el.attrs["class"] = [c for c in el.get("class") if not c.startswith("js-") and not PERSONAL.search(c)]
        if el.name in ("input", "textarea"):
            el.attrs.pop("value", None)
        st = el.attrs.get("style")
        if st and "url(" in st:
            el.attrs["style"] = swap_style_urls(st)


def remove_hidden(soup: BeautifulSoup) -> None:
    for el in list(soup.find_all(True)):
        if el.attrs is None or el.parent is None:
            continue  # already decomposed with an ancestor
        cls = el.get("class") or []
        st = (el.get("style") or "").replace(" ", "")
        hidden = "hidden" in cls and not any(RESPONSIVE_SHOW.match(c) for c in cls)
        if hidden or "display:none" in st or el.name in (
            "script", "noscript", "iframe", "template", "video", "audio", "canvas", "link", "meta", "style",
        ):
            el.decompose()


def slot(el, name: str) -> None:
    """Replace an element's children with a slot marker our React tree portals into."""
    for c in list(el.children):
        c.extract() if isinstance(c, NavigableString) else c.decompose()
    marker = BeautifulSoup(f'<div data-slot="{name}" class="contents"></div>', "lxml").div
    el.append(marker)


def build_html() -> tuple[str, set[str]]:
    html = io.open(RAW / "page.html", encoding="utf-8", errors="replace").read()
    soup = BeautifulSoup(html, "lxml")
    body = soup.body

    navbar = body.select_one("#navbar")
    rails = [d for d in body.find_all("div", recursive=False) if d.get("class") and "lg:fixed" in d.get("class")]
    main = body.select_one(".main-content-container")
    conv = body.select_one("#conversation-container")
    chat = body.select_one("#chat")
    aside = main.find("aside", recursive=False) if main else None
    profile = body.select_one("#profile-partial-turbo")
    scroll = chat.select_one(".chat-mobile-header-offset > .flex-1") if chat else None
    composer_frame = body.select_one("#new_message_form")
    conversations = body.select_one("#all_conversations")

    found = {
        "navbar": navbar, "main": main, "conv": conv, "chat": chat, "aside": aside, "profile": profile,
        "scroll": scroll, "composer": composer_frame, "conversations": conversations,
    }
    missing = [k for k, v in found.items() if v is None]
    if missing:
        sys.exit(f"could not find: {missing}")

    # Keep only the conversation frame and the chat list inside main.
    for child in list(main.children):
        if isinstance(child, NavigableString):
            child.extract()
        elif child is not aside and child.select_one("#conversation-container") is None:
            child.decompose()
    for child in list(conv.parent.children):
        if child is not conv:
            child.extract() if isinstance(child, NavigableString) else child.decompose()

    # Slots.
    slot(scroll, "thread")
    slot(composer_frame, "composer")
    slot(profile, "drawer")
    slot(conversations, "chatlist")
    scroll.insert_before(BeautifulSoup('<div data-slot="controls"></div>', "lxml").div)
    composer_frame.parent.append(BeautifulSoup('<div data-slot="cost"></div>', "lxml").div)

    # Body: keep the navbar, the rails and main.
    keep = {id(navbar), id(main)} | {id(r) for r in rails}
    for child in list(body.children):
        if isinstance(child, NavigableString) or id(child) not in keep:
            child.extract() if isinstance(child, NavigableString) else child.decompose()

    remove_hidden(soup)
    scrub_text(soup, chat)
    scrub_attrs(soup)

    # The character header stays as saved, renamed.
    h1 = conv.find("h1")
    if h1 is not None:
        h1.string = "Aria"
    # Images the save did not include get a neutral placeholder.
    for img in soup.find_all("img"):
        if img.get("src") == "{{img}}":
            img.attrs["src"] = ICON_PLACEHOLDER
            img.attrs["class"] = (img.get("class") or []) + ["opacity-40"]
    # Leftover placeholder text is blanked; the visible labels were kept by name.
    for t in list(soup.find_all(string=True)):
        if isinstance(t, NavigableString) and "{{" in t:
            t.replace_with("")

    classes: set[str] = set()
    for el in soup.find_all(True):
        for c in el.get("class") or []:
            classes.add(c)
    out = "".join(str(c) for c in body.children)
    out = re.sub(r"\n\s*\n+", "\n", out)
    copied = sum(1 for v in _asset_cache.values() if v)
    print(f"assets copied: {copied}, images without a saved file: {out.count(ICON_PLACEHOLDER)}")
    return out, classes


def component_classes() -> set[str]:
    found: set[str] = set()
    for p in COMPONENTS.glob("*.tsx"):
        for m in re.finditer(r"className=\{?[\"'`]([^\"'`]+)[\"'`]", p.read_text(encoding="utf-8")):
            for c in m.group(1).split():
                if not c.startswith("${"):
                    found.add(c)
    return found


def split_rules(css: str) -> list[tuple[str, str]]:
    """Split a CSS string into (prelude, body) pairs at one nesting level."""
    rules = []
    i, n = 0, len(css)
    while i < n:
        j = css.find("{", i)
        if j == -1:
            break
        prelude = css[i:j].strip()
        depth, k = 1, j + 1
        while k < n and depth:
            if css[k] == "{":
                depth += 1
            elif css[k] == "}":
                depth -= 1
            k += 1
        rules.append((prelude, css[j + 1 : k - 1]))
        i = k
    return rules


def unescape(sel: str) -> str:
    return re.sub(r"\\(.)", r"\1", sel)


def keep_rule(prelude: str, used: set[str]) -> bool:
    if "." not in prelude:
        return True  # element, universal and pseudo rules (preflight)
    sel = unescape(prelude)
    for c in used:
        i = sel.find("." + c)
        while i != -1:
            end = i + 1 + len(c)
            if end >= len(sel) or sel[end] in " ,:>+~[)\n\t":
                return True
            i = sel.find("." + c, i + 1)
    return False


def purge(css: str, used: set[str]) -> str:
    out = []
    for prelude, body in split_rules(css):
        if prelude.startswith(("@media", "@layer", "@supports", "@container")):
            inner = purge(body, used)
            if inner.strip():
                out.append(f"{prelude}{{{inner}}}")
        elif prelude.startswith("@"):
            out.append(f"{prelude}{{{body}}}")  # @property, @font-face, @keyframes
        elif keep_rule(prelude, used):
            out.append(f"{prelude}{{{body}}}")
    return "".join(out)


def repr_js(s: str) -> str:
    return "`" + s.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${") + "`"


def main() -> None:
    html, classes = build_html()
    used = classes | component_classes()
    css = io.open(RAW / "application.css", encoding="utf-8", errors="replace").read()
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    css = re.sub(r"@import[^;]+;", "", css)
    purged = purge(css, used)
    # Remote asset references become local copies when the save has them, otherwise none.
    purged = re.sub(r"""url\((?!["']?data:)(?:"[^"]*"|'[^']*'|[^)]*)\)""", lambda m: swap_style_urls(m.group(0)), purged)
    OUT_HTML.write_text(html, encoding="utf-8")
    OUT_CSS.write_text(purged, encoding="utf-8")
    ts = "// Generated by shell/build_shell.py from a scrubbed capture. Do not edit by hand.\n"
    ts += "export const SHELL_HTML = " + repr_js(html) + ";\n"
    OUT_TS.write_text(ts, encoding="utf-8")
    print(f"html {len(html)} chars, classes {len(classes)} (+{len(used) - len(classes)} from components), css {len(css)} -> {len(purged)} chars")
    print("long text left:", re.findall(r">([^<{}]{18,})<", html)[:10])
    print("personal check:", bool(re.search(r"diogo|brenda|brianna|puddin|rebecca|mona", html, re.I)))


if __name__ == "__main__":
    main()
