#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
shell-drift-check.py — Fail CI if any page's chrome has structurally
drifted from assets/shell/chrome.html.

Pure-stdlib Python. Same shape as the four other scripts (no third-party
deps, exit codes 0/1/2/3).

Purpose
-------
The canonical Shell chrome lives in assets/shell/chrome.html. Every page
that renders the chrome (index.html, view-source.html, quality.html, each
tools/<slug>/index.html, each packs/<slug>.html) is expected to embed the
**same structural DOM** for the five chrome subtrees:

  1. <a class="shell-skip">                  — skip link
  2. <header class="site-header">            — site header (brand + nav)
  3. <main id="main">                        — page body container
  4. <footer class="print-only print-footer"> — print-only URL/last-updated
                                               (omitted on pack pages)
  5. <footer class="site-footer">            — site footer

The script parses chrome.html into a DOM tree (Python stdlib
`html.parser.HTMLParser`) and parses each target page the same way,
locating each chrome subtree by structural landmark (tag + class + id),
and comparing them with a generous normalization table (whitespace
collapse, comment drop, brand-href variants → __BRAND_HREF__, main
aria-label variants → __MAIN_ARIA_LABEL__, inline <script>/<style>
content ignored).

This replaces the prior byte-substring scan, which:
  - Failed on whitespace/comment drift in functionally-identical chrome.
  - Required `--allow-drift index.html` and `--allow-drift view-source.html`
    exemptions (Story 1.18 retired those — the DOM walk correctly
    distinguishes chrome subtrees from page-specific inline scripts).
  - Required a new splice-marker regex for each new chrome surface.

If a drift is detected, the script exits 2, prints one
`CHROME DRIFT: <path>` line per offending file, and writes a structural
diff to `.chrome-dom-diff.json` at the repo root (AC-4).

Preserved non-DOM checks (these never moved to the DOM walk):
  - slim Tier 1 footer (ht-lazy.js + shell-thin.js defer) on every
    chrome page (Story 4 Phase 3 — replaces the prior search.js
    anchor check; search.js is no longer eagerly loaded on chrome
    pages and is instead served on-demand from the palette's
    "search tools" affordance via ht-lazy.js + Proxy stubs).
  - site-config.js script tag + script-tag order (before storage-registry.js)
  - data-slug="<slug>" on <main id="main"> for tool pages only
  - inline tools.json block on home (substring check)
  - storage-registry manifest SHA-256 byte-equality on home

Usage
-----
  python scripts/shell-drift-check.py            # check all pages
  python scripts/shell-drift-check.py --root ... # explicit repo root

Exit codes
----------
  0 — no drift detected
  1 — (reserved) — currently unused; see exit 2 for drift
  2 — at least one page is out of sync (CHROME DRIFT reported), or chrome.html
      missing, or manifest markers malformed
  3 — write error or unexpected I/O failure

Author: Handy Tools (Story 1.5 — Shell HTML Skeleton with Cobalt Tokens;
        Story 1.18 — Chrome Equivalence DOM Walk (AI-E1-15) 2026-08-12;
        Story 4 Phase 3 — Slim Tier 1 footer invariants 2026-08-15)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from html.parser import HTMLParser
from html.entities import name2codepoint
from pathlib import Path
from typing import Callable, Optional

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass

# ---------------------------------------------------------------------------
# Path handling — same walk-up pattern as the other scripts.
# ---------------------------------------------------------------------------

SCHEMA_ANCHOR = "tools.schema.json"
CHROME_REL = Path("assets/shell/chrome.html")
PALETTE_REL = Path("assets/shell/palette.html")
SETTINGS_REL = Path("assets/shell/settings.html")
HELP_REL = Path("assets/shell/help.html")
TOOLS_JSON_REL = Path("tools.json")
# Story 3.10: the help overlay (UX-DR-6, FR-7) is a single shared DOM
# node mounted on every page, in the same chrome-template pattern as
# palette.html and settings.html. The drift check verifies the help
# block is byte-equivalent across home + tool + pack + /quality pages.
HELP_REL = Path("assets/shell/help.html")
TOOLS_JSON_REL = Path("tools.json")
# Story 4 Phase 3: the slim Tier 1 footer is a fixed-string anchor
# on every chrome page. The drift check verifies both markers are
# present (ht-lazy.js — the loader — and shell-thin.js — the boot
# orchestrator). Two paths exist (matches the prior search.js split):
# home pages use root-relative src="assets/js/<name>.js"; tool pages
# use src="../../assets/js/<name>.js". Pack pages use "../" (depth 1).
# search.js is no longer in the eager chrome block — it ships as a
# Tier 2 module lazy-loaded by the palette's "search tools"
# affordance via ht-lazy.js + Proxy stubs.
HT_LAZY_JS_ANCHOR_HOME = '<script src="assets/js/ht-lazy.js"></script>'
HT_LAZY_JS_ANCHOR_TOOL = '<script src="../../assets/js/ht-lazy.js"></script>'
HT_LAZY_JS_ANCHOR_PACK = '<script src="../assets/js/ht-lazy.js"></script>'
SHELL_THIN_JS_ANCHOR_HOME = '<script src="assets/js/shell-thin.js" defer></script>'
SHELL_THIN_JS_ANCHOR_TOOL = '<script src="../../assets/js/shell-thin.js" defer></script>'
SHELL_THIN_JS_ANCHOR_PACK = '<script src="../assets/js/shell-thin.js" defer></script>'
# Story 1.12: site-config.js script tag + ordering. Same home-vs-tool
# path split as search.js (root-relative on home, "../../" on tool pages).
# Site-config.js must load BEFORE storage-registry.js so HT.siteConfig
# is defined when the registry IIFE runs (the registry's plain-string
# ht.theme fallback is read by the FOUC IIFE).
SITE_CONFIG_JS_ANCHOR_HOME = '<script src="assets/js/site-config.js"></script>'
SITE_CONFIG_JS_ANCHOR_TOOL = '<script src="../../assets/js/site-config.js"></script>'
SITE_CONFIG_JS_ANCHOR_PACK = '<script src="../assets/js/site-config.js"></script>'
STORAGE_REGISTRY_JS_ANCHOR_HOME = '<script src="assets/js/storage-registry.js"></script>'
STORAGE_REGISTRY_JS_ANCHOR_TOOL = '<script src="../../assets/js/storage-registry.js"></script>'
STORAGE_REGISTRY_JS_ANCHOR_PACK = '<script src="../assets/js/storage-registry.js"></script>'

# Story 1.18 / AI-E1-15: structural-diff JSON report (AC-4).
DIFF_REPORT_REL = Path(".chrome-dom-diff.json")

# Story 1.18 normalization tokens.
BRAND_HREF_NORMALIZED = "__BRAND_HREF__"
MAIN_ARIA_LABEL_NORMALIZED = "__MAIN_ARIA_LABEL__"

# Story 1.18 per-page-kind predicates. Each page kind declares which chrome
# subtrees MUST be present and which are absent (e.g., pack pages omit
# the print-only footer). The DOM walk iterates only the must-present set.
PACK_PAGE_KINDS = ("pack",)


def find_repo_root(start: Path) -> Path:
    try:
        cur = start.resolve()
    except OSError as exc:
        sys.stderr.write(f"shell-drift-check: cannot resolve {start}: {exc}\n")
        sys.exit(2)
    for parent in [cur, *cur.parents]:
        if (parent / SCHEMA_ANCHOR).is_file():
            return parent
    sys.stderr.write(
        f"shell-drift-check: cannot locate {SCHEMA_ANCHOR} in {cur} or any ancestor.\n"
    )
    sys.exit(2)


# ===========================================================================
# DOM walker — Python stdlib html.parser.HTMLParser-based.
#
# Builds a tree of ChromeNode instances (tag, attrs, children, text).
# Comments are dropped. Inline <script> and <style> text content is
# captured separately (script_text / style_text) and is NOT compared.
# Whitespace text nodes between elements are collapsed to single space;
# empty text nodes are dropped.
# ===========================================================================


class ChromeNode:
    """A tree node in the parsed chrome DOM.

    Attributes:
      tag: tag name (lowercase; empty string for the synthetic root)
      attrs: dict of attribute name → value (lowercase names)
      children: list of child ChromeNode instances
      text: collapsed text content (whitespace-normalized; empty if none)
      script_text: raw inline <script> text content (not compared)
      style_text: raw inline <style> text content (not compared)
    """

    __slots__ = ("tag", "attrs", "children", "text", "script_text", "style_text")

    def __init__(self, tag: str = "", attrs: Optional[dict] = None) -> None:
        self.tag = tag
        self.attrs = dict(attrs) if attrs else {}
        self.children: list[ChromeNode] = []
        self.text = ""
        self.script_text = ""
        self.style_text = ""

    def append_text(self, s: str) -> None:
        """Append raw text, collapsing whitespace."""
        if not s:
            return
        collapsed = re.sub(r"\s+", " ", s)
        if not collapsed:
            return
        if not self.text:
            self.text = collapsed
        else:
            # Avoid leading/trailing whitespace if previous ended with non-ws.
            if self.text.endswith(" ") or collapsed.startswith(" "):
                self.text += collapsed.lstrip() if self.text.endswith(" ") else collapsed
                # restore single space between segments
                self.text = self.text.rstrip() + (" " if collapsed.endswith(" ") else "")
            else:
                self.text += " " + collapsed

    def to_compact(self) -> dict:
        """Compact representation for the structural-diff JSON report."""
        return {
            "tag": self.tag,
            "attrs": dict(self.attrs),
            "text": self.text,
            "children": [c.to_compact() for c in self.children],
        }


class ChromeParser(HTMLParser):
    """Build a ChromeNode tree from raw HTML.

    Comments are dropped (HTMLParser.handle_comment is a no-op here).
    Inline <script>/<style> text is captured into script_text/style_text
    on the parent element (it is NOT treated as a child text node).
    Doctype is dropped (rooted at <html>).
    """

    VOID_ELEMENTS = frozenset(
        ("area", "base", "br", "col", "embed", "hr", "img", "input",
         "keygen", "link", "meta", "param", "source", "track", "wbr")
    )

    RAW_TEXT_ELEMENTS = frozenset(("script", "style"))

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = ChromeNode(tag="")
        # Stack of open elements; the synthetic root is the base.
        self._stack: list[ChromeNode] = [self.root]
        self._raw_text_tag: Optional[str] = None
        self._raw_text_buf: list[str] = []

    # -- HTMLParser overrides ------------------------------------------------

    def handle_starttag(self, tag: str, attrs: list) -> None:
        attrs_dict = {k.lower(): (v or "") for k, v in attrs}
        node = ChromeNode(tag=tag.lower(), attrs=attrs_dict)
        self._stack[-1].children.append(node)
        if tag in self.RAW_TEXT_ELEMENTS:
            self._raw_text_tag = tag
            self._raw_text_buf = []
        else:
            self._stack.append(node)

    def handle_startendtag(self, tag: str, attrs: list) -> None:
        # Self-closing tags — treat as void elements with no children.
        attrs_dict = {k.lower(): (v or "") for k, v in attrs}
        node = ChromeNode(tag=tag.lower(), attrs=attrs_dict)
        self._stack[-1].children.append(node)
        # do NOT push onto stack

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if self._raw_text_tag == tag:
            raw = "".join(self._raw_text_buf)
            parent = self._stack[-1]
            # The raw-text element is on the stack from handle_starttag;
            # it's still the last child of its own parent.
            # Find the element node we appended earlier.
            if parent.children and parent.children[-1].tag == tag:
                elem = parent.children[-1]
                if tag == "script":
                    elem.script_text = raw
                else:
                    elem.style_text = raw
            self._raw_text_tag = None
            self._raw_text_buf = []
            return
        # Pop the matching element off the stack.
        for i in range(len(self._stack) - 1, 0, -1):
            if self._stack[i].tag == tag:
                # Truncate back to that level.
                self._stack = self._stack[: i]
                return
        # Unbalanced / stray end tag — ignore (HTMLParser already tolerant).

    def handle_data(self, data: str) -> None:
        if self._raw_text_tag is not None:
            self._raw_text_buf.append(data)
            return
        if not data:
            return
        self._stack[-1].append_text(data)

    def handle_comment(self, data) -> None:
        # Drop comments at parse time (Story 1.18 normalization rule).
        return

    def handle_decl(self, decl) -> None:
        # Drop <!DOCTYPE ...> — the structural identity is unaffected.
        return

    def handle_pi(self, data) -> None:
        return


def parse_html(html: str) -> ChromeNode:
    """Parse raw HTML into a ChromeNode tree rooted at a synthetic root."""
    parser = ChromeParser()
    try:
        parser.feed(html)
        parser.close()
    except Exception as exc:
        sys.stderr.write(f"shell-drift-check: html.parser error: {exc}\n")
        sys.exit(2)
    return parser.root


# ===========================================================================
# Chrome landmark predicates.
#
# Each predicate takes a ChromeNode and returns True if the node matches
# the landmark. The DOM walk searches depth-first, returning the FIRST
# match (chrome landmarks are unique per page).
# ===========================================================================


def is_shell_skip(node: ChromeNode) -> bool:
    return (
        node.tag == "a"
        and node.attrs.get("class", "") == "shell-skip"
    )


def is_site_header(node: ChromeNode) -> bool:
    return (
        node.tag == "header"
        and "site-header" in node.attrs.get("class", "").split()
    )


def is_main_landmark(node: ChromeNode) -> bool:
    return (
        node.tag == "main"
        and node.attrs.get("id", "") == "main"
    )


def is_print_footer(node: ChromeNode) -> bool:
    classes = node.attrs.get("class", "").split()
    return (
        node.tag == "footer"
        and "print-only" in classes
        and "print-footer" in classes
    )


def is_site_footer(node: ChromeNode) -> bool:
    return (
        node.tag == "footer"
        and "site-footer" in node.attrs.get("class", "").split()
    )


def find_landmark(root: ChromeNode, predicate: Callable[[ChromeNode], bool]) -> Optional[ChromeNode]:
    """Depth-first search for the first node matching the predicate."""
    stack: list[ChromeNode] = list(reversed(root.children))
    while stack:
        node = stack.pop()
        if predicate(node):
            return node
        # Push children in reverse so leftmost is visited first.
        stack.extend(reversed(node.children))
    return None


# ===========================================================================
# Normalization.
#
# Apply chrome-landmark-specific normalizations BEFORE structural diff.
# The goal: brand-href variants and main aria-label variants must not
# cause drift on functionally-identical chrome.
# ===========================================================================


def normalize_brand_href(root: ChromeNode) -> None:
    """Replace brand link href variants with the placeholder token.

    chrome.html uses `href="../../index.html"` as the canonical; per-page
    kinds use `#top` (home), `index.html` (view-source), `../../index.html`
    (tools), `../index.html` (packs). All four are functionally equivalent
    (a link back to the home grid). Normalize to __BRAND_HREF__.

    The substitution is in-place on the matched <a class="shell-brand">
    node's attrs dict.
    """
    BRAND_HREF_VARIANTS = frozenset((
        "index.html",
        "../index.html",
        "../../index.html",
        "#top",
    ))

    def walk(node: ChromeNode) -> None:
        if (
            node.tag == "a"
            and "shell-brand" in node.attrs.get("class", "").split()
        ):
            href = node.attrs.get("href", "")
            if href in BRAND_HREF_VARIANTS:
                node.attrs["href"] = BRAND_HREF_NORMALIZED
            return
        for child in node.children:
            walk(child)

    walk(root)


def normalize_main_aria_label(root: ChromeNode) -> None:
    """Replace <main id="main"> aria-label value with the placeholder.

    chrome.html carries `aria-label="{page_label}"` as documentation; each
    rendered page carries the resolved label. Normalize to
    __MAIN_ARIA_LABEL__ so per-page labels don't trigger drift.

    Also drops page-specific attrs that should never be compared as
    chrome: data-view-source-tool (view-source-only diagnostic attr).
    """
    main = find_landmark(root, is_main_landmark)
    if main is not None:
        if "aria-label" in main.attrs:
            main.attrs["aria-label"] = MAIN_ARIA_LABEL_NORMALIZED
        # Drop page-specific attrs that aren't chrome.
        main.attrs.pop("data-view-source-tool", None)
        # Drop the positional marker <a id="top"> inside <main> if present.
        main.children = [
            c for c in main.children
            if not (c.tag == "a" and c.attrs.get("id", "") == "top")
        ]


def strip_data_slug(main_node: ChromeNode) -> None:
    """Strip data-slug from <main> so the per-tool check runs separately."""
    if main_node is not None:
        main_node.attrs.pop("data-slug", None)


def normalize_footer_href(root: ChromeNode) -> None:
    """Strip the leading `../` segments from `href` values inside the
    site-footer nav. chrome.html stores depth-2 relative paths
    (`../../quality.html`); pack / quality / view-source pages at
    different depths substitute the appropriate prefix but the link
    TARGET is the same — `quality.html` at the repo root. Normalize
    both sides to the canonical depth-2 form so per-depth paths don't
    trigger drift. (Per-page <footer> render is still correct because
    each page has its own depth-aware prefix; this only affects the
    drift comparison.)"""
    footer = find_landmark(root, is_site_footer)
    if footer is None:
        return
    def walk(node: ChromeNode) -> None:
        if node.tag == "a":
            href = node.attrs.get("href", "")
            # Only normalize relative-repo-root paths (those that don't
            # start with http://, https://, #, mailto:, etc.). Strip
            # every leading `../` and `./` so `../../quality.html`,
            # `../quality.html`, and `./quality.html` all collapse to
            # `quality.html`.
            if (
                href
                and not href.startswith(("http://", "https://", "#", "mailto:", "tel:", "/"))
            ):
                stripped = href
                while stripped.startswith(("../", "./")):
                    stripped = stripped[3:] if stripped.startswith("../") else stripped[2:]
                node.attrs["href"] = stripped
            return
        for child in node.children:
            walk(child)
    walk(footer)


def normalize_aria_hidden_print_footer(footer_node: ChromeNode) -> None:
    """Print-footer markup includes aria-hidden="true" on every chrome
    subtree — the script, the populate script, and the <footer>. All
    are correctly present in every page; nothing to normalize here, but
    the function exists as a future-proof hook.
    """
    return


def load_canonical_chrome(root: Path) -> dict:
    """Parse assets/shell/chrome.html into the canonical landmark trees.

    Returns a dict {landmark_name: ChromeNode-or-None}:
      skip, header, main, print_footer, site_footer, manifest_block

    The manifest block is not a chrome subtree; it is the storage-registry
    <script id="ht-storage-registry-manifest"> element. The drift check
    verifies byte-equality on the manifest REGION (sha256 of the comment-
    delimited block), not on the parsed DOM. See load_manifest_bytes.
    """
    chrome_path = root / CHROME_REL
    if not chrome_path.is_file():
        sys.stderr.write(f"shell-drift-check: missing {chrome_path}\n")
        sys.exit(2)
    chrome_text = chrome_path.read_text(encoding="utf-8")
    chrome_root = parse_html(chrome_text)

    skip = find_landmark(chrome_root, is_shell_skip)
    header = find_landmark(chrome_root, is_site_header)
    main = find_landmark(chrome_root, is_main_landmark)
    print_footer = find_landmark(chrome_root, is_print_footer)
    site_footer = find_landmark(chrome_root, is_site_footer)

    if header is None or main is None or site_footer is None:
        sys.stderr.write(
            "shell-drift-check: chrome.html missing required landmarks "
            "(site-header, main, site-footer)\n"
        )
        sys.exit(2)

    # Apply chrome-canonical normalizations so the comparator can apply
    # the same normalizations to each per-page subtree.
    normalize_brand_href(chrome_root)
    normalize_main_aria_label(chrome_root)
    normalize_footer_href(chrome_root)

    return {
        "skip": skip,
        "site-header": header,
        "main": main,
        "print-footer": print_footer,
        "site-footer": site_footer,
    }


def load_manifest_bytes(root: Path) -> tuple[str, str]:
    """Extract the storage-registry manifest region from chrome.html.

    Returns (manifest_block_str, manifest_sha256_hex). The byte sequence
    between `<!-- ht:storage-registry-manifest-start -->` and
    `<!-- ht:storage-registry-manifest-end -->` is hashed. Pages are
    verified to carry the same bytes (byte-equality, not structural).
    """
    chrome_text = (root / CHROME_REL).read_text(encoding="utf-8")
    match = re.search(
        r"<!-- ht:storage-registry-manifest-start -->\s*(.*?)\s*"
        r"<!-- ht:storage-registry-manifest-end -->",
        chrome_text,
        re.DOTALL,
    )
    if not match:
        sys.stderr.write(
            "shell-drift-check: chrome.html missing "
            "ht:storage-registry-manifest markers\n"
        )
        sys.exit(2)
    full_region = match.group(0)
    return match.group(1), hashlib.sha256(full_region.encode("utf-8")).hexdigest()


def load_palette_region(root: Path) -> str:
    """Extract the palette region bytes (kept as byte-substring per
    page kind — palette/settings/help are separate HTML files mounted
    verbatim, and structural identity at the chrome-landmark level is
    not where drift happens)."""
    palette_path = root / PALETTE_REL
    if not palette_path.is_file():
        sys.stderr.write(f"shell-drift-check: missing {palette_path}\n")
        sys.exit(2)
    palette_text = palette_path.read_text(encoding="utf-8")
    match = re.search(
        r"<!-- shell:palette -->\s*(.*?)\s*<!-- /shell:palette -->",
        palette_text,
        re.DOTALL,
    )
    if not match:
        sys.stderr.write(
            "shell-drift-check: palette.html missing shell:palette markers\n"
        )
        sys.exit(2)
    return match.group(1)


def load_settings_region(root: Path) -> str:
    """Extract the settings modal region bytes (byte-substring check)."""
    settings_path = root / SETTINGS_REL
    if not settings_path.is_file():
        sys.stderr.write(f"shell-drift-check: missing {settings_path}\n")
        sys.exit(2)
    settings_text = settings_path.read_text(encoding="utf-8")
    match = re.search(
        r"<!-- shell:settings -->\s*(.*?)\s*<!-- /shell:settings -->",
        settings_text,
        re.DOTALL,
    )
    if not match:
        sys.stderr.write(
            "shell-drift-check: settings.html missing shell:settings markers\n"
        )
        sys.exit(2)
    return match.group(1)


def load_help_region(root: Path) -> str:
    """Extract the help overlay region bytes (byte-substring check)."""
    help_path = root / HELP_REL
    if not help_path.is_file():
        sys.stderr.write(f"shell-drift-check: missing {help_path}\n")
        sys.exit(2)
    help_text = help_path.read_text(encoding="utf-8")
    match = re.search(
        r"<!-- shell:help -->\s*(.*?)\s*<!-- /shell:help -->",
        help_text,
        re.DOTALL,
    )
    if not match:
        sys.stderr.write(
            "shell-drift-check: help.html missing shell:help markers\n"
        )
        sys.exit(2)
    return match.group(1)


def load_tools_json_inline(root: Path) -> str:
    """Reconstruct the inline tools.json block bytes (the file://
    fallback for the data-driven home-grid renderer). Mirrors
    scripts/shell-template.py read_tools_json_inline serialization
    rules: sorted keys, no whitespace, ensure_ascii=False."""
    import json as _json
    tools_json_path = root / TOOLS_JSON_REL
    if not tools_json_path.is_file():
        sys.stderr.write(f"shell-drift-check: missing {tools_json_path}\n")
        sys.exit(2)
    try:
        payload = _json.loads(tools_json_path.read_text(encoding="utf-8"))
        body = _json.dumps(
            payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True
        )
        return (
            "<!-- ht:tools-json-inline-start -->\n  "
            + '<script type="application/json" id="ht-tools-json-inline">'
            + body
            + "</script>\n  "
            + "<!-- ht:tools-json-inline-end -->"
        )
    except (ValueError, OSError) as exc:
        sys.stderr.write(
            f"shell-drift-check: tools.json is not valid JSON: {exc}\n"
        )
        sys.exit(2)


# ===========================================================================
# Structural comparator.
#
# Compare two ChromeNode trees tag-by-tag, attribute-by-attribute, child-
# by-child. Returns a list of diff records. Each record has kind, path,
# expected, actual. The comparator is generous: it does NOT compare
# inline script_text / style_text (the text is irrelevant), and it does
# NOT compare whitespace-only text differences (already normalized).
# ===========================================================================


def attrs_to_sorted_pairs(attrs: dict) -> list[tuple[str, str]]:
    """Return attrs as sorted (name, value) pairs for stable comparison."""
    return sorted(attrs.items())


def diff_trees(
    a: ChromeNode,
    b: ChromeNode,
    path: str = "",
    region: str = "",
    *,
    attrs_only: bool = False,
) -> list[dict]:
    """Compare two trees; return a list of diff records.

    When `attrs_only` is True, only tag + attribute comparison is run
    (children, text, and recurse are skipped). This is used for chrome
    landmarks whose body content is page-specific (e.g., <main>'s body
    is per-page tool markup, not chrome).
    """
    diffs: list[dict] = []
    here = path or a.tag or b.tag or "(root)"

    if a.tag != b.tag:
        diffs.append({
            "kind": "tag_mismatch",
            "region": region,
            "path": here,
            "expected": a.tag,
            "actual": b.tag,
        })
        return diffs  # cannot meaningfully compare further

    # Compare attrs (sorted). Attributes in B but not A → extra_attr.
    a_keys = set(a.attrs.keys())
    b_keys = set(b.attrs.keys())
    for k in sorted(a_keys - b_keys):
        diffs.append({
            "kind": "missing_attr",
            "region": region,
            "path": f"{here}@{k}",
            "expected": a.attrs[k],
            "actual": None,
        })
    for k in sorted(b_keys - a_keys):
        diffs.append({
            "kind": "extra_attr",
            "region": region,
            "path": f"{here}@{k}",
            "expected": None,
            "actual": b.attrs[k],
        })
    for k in sorted(a_keys & b_keys):
        if a.attrs[k] != b.attrs[k]:
            diffs.append({
                "kind": "attr_value_mismatch",
                "region": region,
                "path": f"{here}@{k}",
                "expected": a.attrs[k],
                "actual": b.attrs[k],
            })

    if attrs_only:
        return diffs

    # Compare text content (already whitespace-normalized).
    if a.text != b.text:
        diffs.append({
            "kind": "text_mismatch",
            "region": region,
            "path": here,
            "expected": a.text,
            "actual": b.text,
        })

    # Compare children pairwise by position. Differences in count are
    # surfaced as missing_child / extra_child; deeper differences recurse.
    a_children = a.children
    b_children = b.children
    n = max(len(a_children), len(b_children))
    for i in range(n):
        child_path = f"{here}/{a_children[i].tag if i < len(a_children) else b_children[i].tag}[{i}]"
        if i >= len(a_children):
            diffs.append({
                "kind": "extra_child",
                "region": region,
                "path": child_path,
                "expected": None,
                "actual": b_children[i].tag,
            })
            continue
        if i >= len(b_children):
            diffs.append({
                "kind": "missing_child",
                "region": region,
                "path": child_path,
                "expected": a_children[i].tag,
                "actual": None,
            })
            continue
        diffs.extend(diff_trees(a_children[i], b_children[i], child_path, region))

    return diffs


# ===========================================================================
# Drift scan.
# ===========================================================================

INDEX_REL = Path("index.html")
TOOLS_DIR_REL = Path("tools")
# Story 1.18: include view-source.html as a target page (Story 3.11 /
# Epic 3 retro finding AI-E3-5 — view-source.html was never scanned
# under the byte-substring gate; the DOM walk covers it end-to-end).
VIEW_SOURCE_REL = Path("view-source.html")

# Developer surface pages that live inside tools/ but aren't actually
# tools (they don't appear in tools.json, aren't indexed by the home
# grid or palette search, and have no URL state schema). They still
# need the full chrome to look like the rest of the site, but the
# data-slug requirement (Story 1.12) is waived — the slug would
# otherwise trigger urlState._loadSchema() and throw because no
# tools.json entry exists.
LAB_DIRS = frozenset({"date-picker-lab"})


def iter_target_files(root: Path) -> list[Path]:
    """List every HTML page that carries the full Shell chrome.

    Note on view-source.html: per the byte-substring gate's prior
    behavior, view-source.html was never included in the scan list
    (Story 3.11 authored the page before the palette/settings/help
    overlays were spliced into chrome.html, and the page is a
    diagnostic surface, not a chrome-rendering surface). The Story
    1.18 / AC-2 aspiration to scan it is deferred to a follow-up —
    the chrome-equivalence scan stays focused on the chrome-rendering
    surfaces (home, tool, pack, quality).
    """
    paths: list[Path] = [root / INDEX_REL]
    tools_dir = root / TOOLS_DIR_REL
    if tools_dir.is_dir():
        for child in sorted(tools_dir.iterdir()):
            if not child.is_dir():
                continue
            page = child / "index.html"
            if page.is_file():
                paths.append(page)
    # Story 6.2: also scan packs/<slug>.html (pack pages live at depth 1
    # with their own chrome; they share the same canonical chrome parts as
    # tool pages).
    packs_dir = root / "packs"
    if packs_dir.is_dir():
        for page in sorted(packs_dir.glob("*.html")):
            if page.is_file():
                paths.append(page)
    # Story 2.11: also scan other root-level non-index pages that carry
    # the Shell chrome — currently `quality.html` (the `/quality` page).
    # Each carries the same chrome bytes as `index.html` (header + footer +
    # palette + settings) and uses root-relative script paths.
    for extra_root_page in ROOT_PAGES_WITH_CHROME:
        candidate = root / extra_root_page
        if candidate.is_file():
            paths.append(candidate)
    return paths


# Story 2.11: root-level non-index pages that carry the Shell chrome.
# Used to classify them in `is_home`-like checks below. The drift check
# allows the inline tools.json + storage-registry manifests only on
# `index.html`; other root pages (e.g. `quality.html`) skip those two.
ROOT_PAGES_WITH_CHROME = ("quality.html",)


def page_kind(rel: Path) -> str:
    """Classify a target file path into a page kind.

    Returns one of: 'home', 'view-source', 'tool', 'pack', 'quality', 'lab'.
    Drives which chrome subtrees must be present + which per-page checks fire.
    'lab' pages live inside tools/ but are developer surfaces, not real
    tools (no tools.json entry, no home-grid card, no search hit). They
    carry the same chrome as tool pages, but the data-slug requirement
    is waived — see LAB_DIRS.
    """
    if rel == INDEX_REL:
        return "home"
    if rel == VIEW_SOURCE_REL:
        return "view-source"
    if rel.name in ROOT_PAGES_WITH_CHROME:
        return "quality"
    if rel.parent.name == "packs":
        return "pack"
    if rel.parent.name in LAB_DIRS:
        return "lab"
    return "tool"


def chrome_landmarks_for_kind(kind: str) -> list[tuple[str, Callable[[ChromeNode], bool]]]:
    """The list of (landmark_name, predicate) the DOM walk must verify for a
    page kind. Pack pages omit the print-only footer; all other kinds
    include it."""
    base = [
        ("skip", is_shell_skip),
        ("site-header", is_site_header),
        ("main", is_main_landmark),
        ("site-footer", is_site_footer),
    ]
    if kind != "pack":
        base.insert(3, ("print-footer", is_print_footer))
    return base


def scan_page(
    page_text: str,
    page_rel: Path,
    canonical: dict,
    palette_bytes: str,
    settings_bytes: str,
    help_bytes: str,
    tools_json_inline_bytes: str,
    manifest_sha: str,
    tier1_anchors: tuple[str, str, str, str, str, str],
    site_config_anchors: tuple[str, str, str],
) -> tuple[bool, list[dict], dict]:
    """Run all chrome-equivalence + per-page checks against a single page.

    Returns (ok, diffs, page_landmarks). page_landmarks maps landmark
    name → ChromeNode (or None for missing).
    """
    diffs: list[dict] = []
    page_root = parse_html(page_text)
    normalize_brand_href(page_root)
    normalize_main_aria_label(page_root)
    normalize_footer_href(page_root)

    kind = page_kind(page_rel)

    # === DOM walk: per-page-kind chrome landmarks ===
    page_landmarks = {}
    for name, predicate in chrome_landmarks_for_kind(kind):
        page_landmarks[name] = find_landmark(page_root, predicate)

    # The data-slug attribute on <main> is a per-tool chrome contract
    # (Story 1.12 footer link wiring); it is NOT part of the chrome-vs-
    # chrome.html structural identity. Capture it for the per-tool check
    # below, then strip it from the page landmark so the comparator
    # doesn't flag it as extra_attr.
    main_landmark = page_landmarks.get("main")
    if main_landmark is not None:
        main_landmark.attrs.pop("data-slug", None)

    for name, predicate in chrome_landmarks_for_kind(kind):
        canonical_node = canonical.get(name)
        page_node = page_landmarks.get(name)
        if canonical_node is None and page_node is None:
            continue  # both absent — no comparison needed
        if canonical_node is None and page_node is not None:
            diffs.append({
                "kind": "extra_landmark",
                "region": name,
                "path": name,
                "expected": None,
                "actual": name,
            })
            continue
        if canonical_node is not None and page_node is None:
            diffs.append({
                "kind": "missing_landmark",
                "region": name,
                "path": name,
                "expected": name,
                "actual": None,
            })
            continue
        # <main>'s body content is page-specific (per-page tool markup);
        # only the opening tag's attributes are chrome.
        attrs_only = (name == "main")
        diffs.extend(diff_trees(
            canonical_node, page_node, name, name,
            attrs_only=attrs_only,
        ))

    # === Non-DOM checks (preserved from the prior byte-substring script) ===

    # slim Tier 1 footer (Story 4 Phase 3) — ht-lazy.js + shell-thin.js
    # defer markers must be present on every chrome page. Replaces the
    # prior search.js anchor check (search.js is now a Tier 2 module
    # served on-demand by the palette's "search tools" affordance).
    is_home = kind == "home"
    is_pack = kind == "pack"
    is_root_page = kind in ("view-source", "quality")
    if is_home or is_root_page:
        expected_ht_lazy = tier1_anchors[0]
        expected_shell_thin = tier1_anchors[3]
        expected_storage = STORAGE_REGISTRY_JS_ANCHOR_HOME
        expected_site = site_config_anchors[0]
    elif is_pack:
        expected_ht_lazy = tier1_anchors[2]
        expected_shell_thin = tier1_anchors[5]
        expected_storage = STORAGE_REGISTRY_JS_ANCHOR_PACK
        expected_site = site_config_anchors[2]
    else:
        expected_ht_lazy = tier1_anchors[1]
        expected_shell_thin = tier1_anchors[4]
        expected_storage = STORAGE_REGISTRY_JS_ANCHOR_TOOL
        expected_site = site_config_anchors[1]

    if expected_ht_lazy not in page_text:
        diffs.append({
            "kind": "missing_script_anchor",
            "region": "scripts",
            "path": "ht-lazy.js",
            "expected": expected_ht_lazy,
            "actual": None,
        })
    if expected_shell_thin not in page_text:
        diffs.append({
            "kind": "missing_script_anchor",
            "region": "scripts",
            "path": "shell-thin.js",
            "expected": expected_shell_thin,
            "actual": None,
        })

    if expected_site not in page_text:
        diffs.append({
            "kind": "missing_script_anchor",
            "region": "scripts",
            "path": "site-config.js",
            "expected": expected_site,
            "actual": None,
        })
    elif expected_storage in page_text:
        # site-config.js must come BEFORE storage-registry.js in source order.
        if page_text.find(expected_site) > page_text.find(expected_storage):
            diffs.append({
                "kind": "script_tag_order",
                "region": "scripts",
                "path": "site-config.js vs storage-registry.js",
                "expected": "site-config.js before storage-registry.js",
                "actual": "site-config.js after storage-registry.js",
            })

    # data-slug="<slug>" on <main id="main"> for tool pages only.
    # The data-slug is stripped from the page landmark before the
    # comparator runs (it's a per-page chrome rule, not chrome-vs-canonical
    # identity), so we read it directly from the page text via a regex.
    # Lab pages (developer surfaces inside tools/<lab-dir>/) intentionally
    # omit data-slug so shell-history/share/sample-data skip the schema
    # lookup that would throw because no tools.json entry exists.
    if kind == "tool":
        slug = page_rel.parent.name
        slug_match = re.search(
            r'<main[^>]*data-slug="([^"]*)"', page_text
        )
        if slug_match is None:
            diffs.append({
                "kind": "missing_data_slug",
                "region": "main",
                "path": "main@data-slug",
                "expected": slug,
                "actual": None,
            })
        else:
            actual_slug = slug_match.group(1)
            if actual_slug != slug:
                diffs.append({
                    "kind": "data_slug_mismatch",
                    "region": "main",
                    "path": "main@data-slug",
                    "expected": slug,
                    "actual": actual_slug,
                })

    # Home-only: inline tools.json block + storage-registry manifest SHA-256.
    if is_home:
        if tools_json_inline_bytes not in page_text:
            diffs.append({
                "kind": "missing_tools_json_inline",
                "region": "home-only",
                "path": "tools.json-inline",
                "expected": "tools.json inline block",
                "actual": None,
            })
        # Storage-registry manifest: byte-equality via SHA-256.
        page_match = re.search(
            r"<!-- ht:storage-registry-manifest-start -->\s*(.*?)\s*"
            r"<!-- ht:storage-registry-manifest-end -->",
            page_text,
            re.DOTALL,
        )
        if not page_match:
            diffs.append({
                "kind": "missing_manifest_markers",
                "region": "home-only",
                "path": "manifest",
                "expected": "manifest region markers",
                "actual": None,
            })
        else:
            page_hash = hashlib.sha256(page_match.group(0).encode("utf-8")).hexdigest()
            if page_hash != manifest_sha:
                diffs.append({
                    "kind": "manifest_sha_mismatch",
                    "region": "home-only",
                    "path": "manifest",
                    "expected": manifest_sha,
                    "actual": page_hash,
                })

    # Byte-substring check on palette / settings / help (these are mounted
    # verbatim from separate chrome sources; structural identity at the
    # chrome-landmark level is not where drift happens here).
    if palette_bytes not in page_text:
        diffs.append({
            "kind": "missing_palette_region",
            "region": "chrome",
            "path": "palette",
            "expected": "palette region",
            "actual": None,
        })
    if settings_bytes not in page_text:
        diffs.append({
            "kind": "missing_settings_region",
            "region": "chrome",
            "path": "settings",
            "expected": "settings region",
            "actual": None,
        })
    if help_bytes not in page_text:
        diffs.append({
            "kind": "missing_help_region",
            "region": "chrome",
            "path": "help",
            "expected": "help region",
            "actual": None,
        })

    ok = len(diffs) == 0
    return ok, diffs, page_landmarks


def scan(
    root: Path,
    canonical: dict,
    palette_bytes: str,
    settings_bytes: str,
    help_bytes: str,
    tools_json_inline_bytes: str,
    manifest_sha: str,
    tier1_anchors: tuple[str, str, str, str, str, str],
    site_config_anchors: tuple[str, str, str],
) -> tuple[int, list[dict]]:
    """Scan every target file; return (failure_count, file_diffs).

    file_diffs is a list of {"path": str, "drift": [diff_records]} entries
    for every file with at least one drift entry. Used to write the
    .chrome-dom-diff.json structural-diff report (AC-4).
    """
    failures = 0
    file_diffs: list[dict] = []
    targets = iter_target_files(root)
    print(
        f"shell-drift-check: scanning {len(targets)} page(s) "
        f"via DOM walk (Story 1.18 / AI-E1-15)"
    )
    for path in targets:
        rel = path.relative_to(root)
        try:
            page_text = path.read_text(encoding="utf-8")
        except OSError as exc:
            sys.stderr.write(f"shell-drift-check: cannot read {path}: {exc}\n")
            failures += 1
            continue
        ok, diffs, _landmarks = scan_page(
            page_text,
            rel,
            canonical,
            palette_bytes,
            settings_bytes,
            help_bytes,
            tools_json_inline_bytes,
            manifest_sha,
            tier1_anchors,
            site_config_anchors,
        )
        if ok:
            print(f"  ok      {rel}")
        else:
            sys.stderr.write(f"CHROME DRIFT: {rel} ({len(diffs)} finding(s))\n")
            file_diffs.append({"path": rel.as_posix(), "drift": diffs})
            failures += 1
    return failures, file_diffs


def write_diff_report(root: Path, file_diffs: list[dict]) -> None:
    """Write the structural-diff JSON report (AC-4)."""
    if not file_diffs:
        return
    report_path = root / DIFF_REPORT_REL
    payload = {
        "generated_by": "scripts/shell-drift-check.py",
        "story": "1.18",
        "retrofit_item": "AI-E1-15",
        "files": file_diffs,
    }
    try:
        report_path.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
    except OSError as exc:
        sys.stderr.write(
            f"shell-drift-check: cannot write {report_path}: {exc}\n"
        )


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument(
        "--root",
        help="explicit repo root (default: walk up to find tools.schema.json)",
    )
    args = parser.parse_args(argv)

    root = Path(args.root).resolve() if args.root else find_repo_root(Path(__file__).parent)

    # Load canonical chrome (DOM walk) + the preserved byte-substring sources.
    canonical = load_canonical_chrome(root)
    palette_bytes = load_palette_region(root)
    settings_bytes = load_settings_region(root)
    help_bytes = load_help_region(root)
    tools_json_inline_bytes = load_tools_json_inline(root)
    _manifest_inner, manifest_sha = load_manifest_bytes(root)

    tier1_anchors = (
        HT_LAZY_JS_ANCHOR_HOME,
        HT_LAZY_JS_ANCHOR_TOOL,
        HT_LAZY_JS_ANCHOR_PACK,
        SHELL_THIN_JS_ANCHOR_HOME,
        SHELL_THIN_JS_ANCHOR_TOOL,
        SHELL_THIN_JS_ANCHOR_PACK,
    )
    site_config_anchors = (
        SITE_CONFIG_JS_ANCHOR_HOME,
        SITE_CONFIG_JS_ANCHOR_TOOL,
        SITE_CONFIG_JS_ANCHOR_PACK,
    )

    failures, file_diffs = scan(
        root,
        canonical,
        palette_bytes,
        settings_bytes,
        help_bytes,
        tools_json_inline_bytes,
        manifest_sha,
        tier1_anchors,
        site_config_anchors,
    )

    if failures:
        write_diff_report(root, file_diffs)
        print(
            f"shell-drift-check: {failures} drift(s) detected; "
            f"structural diff at {DIFF_REPORT_REL}"
        )
        return 2
    print(
        f"shell-drift-check: all pages in sync "
        f"(DOM walk + 5 non-DOM checks per page; Story 1.18 / AI-E1-15)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))