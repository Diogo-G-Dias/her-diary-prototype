"""Turn a raw Chrome "Webpage, Complete" save of the Candy conversation screen into a scrubbed static
frame with slots for the demo's React components, plus a stylesheet purged to the classes it uses.

Input (gitignored):  shell/raw/page.html, shell/raw/application.css
Output (committed):  shell/conversation.html, shell/candy-purged.css

Scrubbing: scripts, iframes, hidden modals, toasts and forms removed; every message body, chat-list
name, preview and timestamp replaced by a placeholder; every id, data-*, on*, srcset, title and href
dropped; every image swapped for a neutral placeholder; the character renamed Aria. Nothing personal
survives, and nothing from raw/ is ever committed.
"""
from __future__ import annotations

import io
import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup, Comment, NavigableString

ROOT = Path(__file__).resolve().parent
RAW = ROOT / "raw"
OUT_HTML = ROOT / "conversation.html"
OUT_CSS = ROOT / "candy-purged.css"
COMPONENTS = ROOT.parent / "components"
OUT_TS = ROOT.parent / "lib" / "shellHtml.ts"
ICON_PLACEHOLDER = "data:image/svg+xml;utf8," + "%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='3' y='3' width='18' height='18' rx='5' fill='%23ffffff' fill-opacity='0.55'/%3E%3C/svg%3E"

KEEP_TEXT = {
    "chat", "create new", "all", "unread", "favorites", "profile", "gallery", "items", "online",
    "home", "discover", "shorts", "candy shop", "collection", "create", "new", "discord",
    "help center", "contact us", "affiliate", "english", "legal", "terms", "trust & safety",
    "open sidebar", "search", "0", "companion", "aria", "assistant",
}
KEEP_RE = re.compile(r"search for a profile|write a message", re.I)
TIME_RE = re.compile(r"^(yesterday,?\s*|today,?\s*)?\d{1,2}:\d{2}\s*(am|pm)?$|^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$", re.I)
DROP_ATTRS_PREFIX = ("data-", "on", "x-", "@", ":", "aria-controls", "aria-describedby", "aria-labelledby")
DROP_ATTRS = {"id", "srcset", "sizes", "action", "value", "content", "poster", "title", "method", "name", "for", "tabindex", "complete", "loading", "target"}
RESPONSIVE_SHOW = re.compile(r"^(sm|md|lg|xl|2xl):(flex|block|grid|inline|inline-flex|inline-block|contents|table)$")
PERSONAL = re.compile(r"brianna|brenda|howe|jackson|diogo", re.I)


def scrub_text(soup: BeautifulSoup, msg_root, list_root) -> None:
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


def scrub_attrs(soup: BeautifulSoup) -> None:
    for el in soup.find_all(True):
        for a in list(el.attrs):
            if a == "data-slot":
                continue
            if a in DROP_ATTRS or a.startswith(DROP_ATTRS_PREFIX):
                del el.attrs[a]
        if el.name == "a":
            el.attrs["href"] = "#"
        if el.name != "img":
            el.attrs.pop("src", None)
        if el.get("class"):
            el.attrs["class"] = [c for c in el.get("class") if not c.startswith("js-") and not PERSONAL.search(c)]
        if el.name == "img":
            el.attrs["src"] = "{{img}}"
            el.attrs["alt"] = ""
        if el.name in ("input", "textarea"):
            el.attrs.pop("value", None)
        st = el.attrs.get("style")
        if st and "url(" in st:
            el.attrs["style"] = re.sub(r"url\([^)]*\)", "none", st)


def remove_hidden(soup: BeautifulSoup) -> None:
    for el in list(soup.find_all(True)):
        if el.attrs is None or el.parent is None:
            continue  # already decomposed with an ancestor
        cls = el.get("class") or []
        st = (el.get("style") or "").replace(" ", "")
        hidden = "hidden" in cls and not any(RESPONSIVE_SHOW.match(c) for c in cls)
        if hidden or "display:none" in st or el.name in ("script", "noscript", "iframe", "template", "video", "audio", "canvas", "link", "meta", "style"):
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

    # Regions we keep, by role.
    navbar = body.select_one("#navbar")
    rails = [d for d in body.find_all("div", recursive=False) if d.get("class") and "lg:fixed" in d.get("class")]
    main = body.select_one(".main-content-container")
    conv = body.select_one("#conversation-container")
    chat = body.select_one("#chat")
    aside = main.find("aside", recursive=False) if main else None
    right = None
    if conv is not None:
        for d in conv.select("div"):
            cls = d.get("class") or []
            if "lg:w-[30%]" in cls:
                right = d
                break
    profile = body.select_one("#profile-partial-turbo")
    scroll = chat.select_one(".chat-mobile-header-offset > .flex-1") if chat else None
    composer_frame = body.select_one("#new_message_form")
    conversations = body.select_one("#all_conversations")

    missing = [n for n, v in [("navbar", navbar), ("main", main), ("conv", conv), ("chat", chat), ("aside", aside), ("right", right), ("profile", profile), ("scroll", scroll), ("composer", composer_frame), ("conversations", conversations)] if v is None]
    if missing:
        sys.exit(f"could not find: {missing}")

    # Drop everything in main that is not the conversation frame or the chat list.
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
    controls = BeautifulSoup('<div data-slot="controls"></div>', "lxml").div
    scroll.insert_before(controls)
    cost = BeautifulSoup('<div data-slot="cost"></div>', "lxml").div
    composer_frame.parent.append(cost)  # under the composer, inside the input column

    # Body: keep navbar, the rails, main. Everything else goes.
    keep = {id(navbar), id(main)} | {id(r) for r in rails}
    for child in list(body.children):
        if isinstance(child, NavigableString) or id(child) not in keep:
            child.extract() if isinstance(child, NavigableString) else child.decompose()

    remove_hidden(soup)
    scrub_text(soup, chat, aside)
    scrub_attrs(soup)

    # The character header stays static: name Aria, our portrait, tag line.
    h1 = conv.find("h1")
    if h1 is not None:
        h1.string = "Aria"
    for img in conv.find_all("img"):
        cls = " ".join(img.get("class") or [])
        if "rounded-full" in cls and "object-top" in cls:
            img.attrs["src"] = "/avatars/aria.jpg"
    # The navbar logo becomes a text wordmark; every other image a neutral placeholder.
    logo = navbar.find("img")
    if logo is not None:
        logo.replace_with(BeautifulSoup('<span class="text-white text-xl font-bold tracking-tight">candy<span class="text-pink-500">.ai</span></span>', "lxml").span)
    for img in soup.find_all("img"):
        if img.get("src") == "{{img}}":
            img.attrs["src"] = ICON_PLACEHOLDER
            img.attrs["class"] = (img.get("class") or []) + ["opacity-40"]
    # Leftover placeholder text is blanked; the visible labels were kept by name.
    for t in list(soup.find_all(string=True)):
        if isinstance(t, NavigableString) and "{{" in t:
            t.replace_with("")

    # Samples for the components (printed, not saved).
    print("=== assistant bubble ===")
    print(str(chat.select_one('[class*="-response"]'))[:1500] if chat.select_one('[class*="-response"]') else "none")
    classes: set[str] = set()
    for el in soup.find_all(True):
        for c in el.get("class") or []:
            classes.add(c)
    out = "".join(str(c) for c in body.children)
    out = re.sub(r"\n\s*\n+", "\n", out)
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
        body = css[j + 1 : k - 1]
        if prelude.startswith("@import") or prelude.startswith("@charset"):
            pass
        rules.append((prelude, body))
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
        if prelude.startswith("@media") or prelude.startswith("@layer") or prelude.startswith("@supports") or prelude.startswith("@container"):
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
    # No external assets: strip url() references to Candy's files.
    purged = re.sub(r"""url\((?!["']?data:)(?:"[^"]*"|'[^']*'|[^)]*)\)""", "none", purged)
    OUT_HTML.write_text(html, encoding="utf-8")
    OUT_CSS.write_text(purged, encoding="utf-8")
    ts = "// Generated by shell/build_shell.py from a scrubbed capture. Do not edit by hand.\n"
    ts += "export const SHELL_HTML = " + repr_js(html) + ";\n"
    OUT_TS.write_text(ts, encoding="utf-8")
    print(f"html {len(html)} chars, classes {len(classes)} (+{len(used) - len(classes)} from components), css {len(css)} -> {len(purged)} chars")
    leftovers = re.findall(r">([^<{}]{18,})<", html)
    print("long text left:", leftovers[:10])
    print("personal check:", bool(re.search(r"diogo|brenda|brianna|puddin|rebecca|mona", html, re.I)))


if __name__ == "__main__":
    main()
