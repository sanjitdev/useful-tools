#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
shell-a11y-check.py — Verify AC #1's structural invariants that the
byte-level drift check (shell-drift-check.py) cannot catch.

Pure-stdlib Python. Same exit-code contract as the four prior scripts:
0 = pass, 1 = violation found, 2 = setup error. Markdown status to stdout.

Purpose
-------
The drift check is substring-based against chrome.html's header/footer
regions. It cannot tell whether:
  - Every page actually carries a <main id="main" class="shell-main"
    aria-label="..." tabindex="-1"> with a non-empty aria-label that
    matches the page's expected label (home → "Handy Tools home";
    tool pages → the tool's display name derived from <title>).
  - Every page's <head> contains the blocking inline FOUC IIFE
    (the 50ms no-FOUC budget lives in that script; a single page
    missing it ships a flash-of-light-theme undetected).
  - assets/css/base.css declares cobalt tokens at :root and the dark
    theme override at :root[data-theme="dark"].

All four invariants are load-bearing for AC #1 (FR-9 + NFR-9 + UX-DR-1
+ UX-DR-19). This script fills the verification gap with four
mechanical regex assertions:

  1. Every index.html and tools/<slug>/index.html contains exactly one
     <main id="main" class="shell-main" aria-label="..." tabindex="-1">
     whose aria-label value is non-empty and non-whitespace.
  2. The same aria-label value matches the page's expected label:
     "Handy Tools home" for the home page, the tool's display name
     (derived from <title>) for tool pages.
  3. The blocking inline FOUC IIFE byte sequence from
     assets/shell/head-snippet.html appears verbatim in every page.
  4. assets/css/base.css contains :root { --color-primary: #2F5BFF; ... }
     and :root[data-theme="dark"] { ... } blocks.

Exit codes
----------
  0 — pass
  1 — at least one a11y violation
  2 — setup error (missing files, malformed CSS)

Author: Handy Tools (Story 1.5 — code review follow-up, Decision #1)
"""

from __future__ import annotations

import argparse
import html
import re
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass

SCHEMA_ANCHOR = "tools.schema.json"

# The exact `<main>` opener shape chrome.html / shell-template.py write.
# The aria-label capture is non-greedy and forbids another quote inside.
# Story 1.12: tool pages also carry an optional `data-slug="<slug>"`
# attribute on <main> (used by the footer "View source" wiring). The
# regex permits it between class and aria-label; home pages (no slug)
# match without that group.
MAIN_RE = re.compile(
    r'<main\s+id="main"\s+class="shell-main"(?:\s+data-slug="[^"]+")?\s+aria-label="([^"]+)"\s+tabindex="-1">',
    re.IGNORECASE,
)

# `<title>` opener: capture the text content (greedy until </title>).
TITLE_RE = re.compile(r"<title>([^<]+)</title>", re.IGNORECASE | re.DOTALL)

# Extract the inline `<script>...</script>` IIFE from head-snippet.html.
# The IIFE is minified to a single line; the capture is non-greedy on
# the closing tag so the next-comment block doesn't get pulled in.
FOUC_SCRIPT_RE = re.compile(
    r"<script>([^<]+)</script>",
    re.IGNORECASE,
)

# Mirror of shell-template.py's derive_display_name so the per-page
# aria-label contract has a single source of truth on disk.
DISPLAY_NAME_RE = re.compile(r"\s+·\s+Handy Tools\s*$")

# Cobalt token literals per DESIGN.md §"Colors → Brand/primary".
COBALT_TOKEN_NAMES = (
    "--color-primary",
    "--color-primary-hover",
    "--color-primary-pressed",
    "--color-on-primary",
    "--color-primary-soft",
    "--color-primary-soft-strong",
)


def find_repo_root(start: Path) -> Path:
    try:
        cur = start.resolve()
    except OSError as exc:
        sys.stderr.write(f"shell-a11y-check: cannot resolve {start}: {exc}\n")
        sys.exit(2)
    for parent in [cur, *cur.parents]:
        if (parent / SCHEMA_ANCHOR).is_file():
            return parent
    sys.stderr.write(
        f"shell-a11y-check: cannot locate {SCHEMA_ANCHOR} in {cur} or any ancestor.\n"
    )
    sys.exit(2)


def iter_target_files(root: Path) -> list[Path]:
    paths: list[Path] = []
    home = root / "index.html"
    if home.is_file():
        paths.append(home)
    tools_dir = root / "tools"
    if tools_dir.is_dir():
        for slug_dir in sorted(tools_dir.iterdir()):
            page = slug_dir / "index.html"
            if page.is_file():
                paths.append(page)
    # Story 6.2: also scan packs/<slug>.html — pack pages have the same
    # chrome and the same <main aria-label> requirement.
    packs_dir = root / "packs"
    if packs_dir.is_dir():
        for page in sorted(packs_dir.glob("*.html")):
            if page.is_file():
                paths.append(page)
    return paths


def derive_display_name(title_text: str) -> str:
    """`<title>Age Calculator · Handy Tools</title>` → `Age Calculator`.

    Mirror of the same function in shell-template.py (kept as a copy —
    the two scripts already share the canonical byte-extraction pattern,
    and a single-source import across scripts would couple them for
    little gain). Whitespace-only or empty titles fall back to a generic
    label so the <main aria-label> on the rendered page is never empty.
    HTML-entities are decoded so `Pros &amp; Cons` → `Pros & Cons` for
    screen readers (do not read the literal entity string).
    """
    cleaned = DISPLAY_NAME_RE.sub("", title_text).strip()
    if not cleaned:
        return "Handy Tools"
    return html.unescape(cleaned)


def expected_aria_label(path: Path, root: Path) -> tuple[str, str]:
    """Return (expected_label, source_description) for the page's <main>.

    The home page carries the literal "Handy Tools home". Tool pages
    derive the label from the page's <title> via the same helper
    shell-template.py uses during regeneration, so this check is the
    single source of truth on disk for the per-page label contract.
    """
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        return ("", f"<title> unreadable: {exc}")
    if path == root / "index.html":
        return ("Handy Tools home", "<literal home page label>")
    title_match = TITLE_RE.search(text)
    if not title_match:
        return ("", "no <title> in page")
    return (
        derive_display_name(title_match.group(1)),
        "<title> after derive_display_name",
    )


def check_main_aria_label(path: Path, root: Path) -> list[str]:
    """Verify the per-page <main aria-label> matches the expected value.

    The drift check + a11y check both rejected the empty-label case, but
    neither pinned the *content* of the label. Without this check, a
    regression that writes `aria-label="Handy Tools"` on every page
    passes both gates — landing screen-reader users on the wrong
    landmark. This is the AC #1 contract: "reflecting the current tool
    or page".
    """
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        return [f"cannot read file: {exc}"]
    matches = MAIN_RE.findall(text)
    if len(matches) != 1:
        # Already reported by check_main_landmark — skip.
        return []
    actual = matches[0].strip()
    expected, source = expected_aria_label(path, root)
    if not expected:
        return [f"cannot derive expected aria-label ({source})"]
    if actual != expected:
        return [
            f"<main aria-label=\"{actual}\"> does not match expected "
            f'"{expected}" (derived from {source})'
        ]
    return []


# The three cycle-state labels written by JS (Story 1.6 spec). The toggle
# surfaces the *next* step in the cycle (auto → light → dark → auto), so
# the label depends on the current stored mode, not the resolved theme.
# These strings are authored once in assets/js/shell.js (the CYCLE_LABEL
# map) and must remain in sync with the spec — Story 1.6 task #5.
THEME_ARIA_LABEL_BY_MODE = {
    "auto": "Follow system theme",
    "light": "Switch to dark theme",
    "dark": "Switch to light theme",
}


def check_theme_aria_label(root: Path) -> list[str]:
    """Verify the 3-mode cycle's aria-label strings are present in
    assets/js/shell.js AND each is associated with the correct stored mode
    in the CYCLE_LABEL map.

    The spec says the strings are written by JS at runtime — the a11y
    check is otherwise unable to read the post-cycle attribute. The
    compromise: the static-HTML drift check cannot reach into the JS
    source, so this check pins the JS contract directly. Without it, a
    regression that drops one of the three strings (e.g. a typo in the
    CYCLE_LABEL map) silently ships a missing announced state to screen
    readers.

    The substring-only check (used in earlier versions) had a hole: a
    typo that swapped two map keys (e.g. auto: "Switch to light theme")
    kept all three strings present and the test passed. Parse the map
    block and verify each key's value matches the expected label.
    """
    js_path = root / "assets" / "js" / "shell.js"
    if not js_path.is_file():
        return [f"missing {js_path}"]
    try:
        text = js_path.read_text(encoding="utf-8")
    except OSError as exc:
        return [f"cannot read {js_path}: {exc}"]
    violations: list[str] = []

    # First: substring presence (catches the easy case — string removed).
    for label in THEME_ARIA_LABEL_BY_MODE.values():
        if label not in text:
            violations.append(
                f"theme-cycle aria-label {label!r} missing from {js_path.relative_to(root)}"
            )

    # Second: parse the CYCLE_LABEL map and verify each key's value. The
    # regex tolerates whitespace, line breaks, and single/double quotes.
    cycle_label_block = re.search(
        r"CYCLE_LABEL\s*=\s*Object\.freeze\s*\(\s*\{([^}]*)\}\s*\)",
        text,
    )
    if not cycle_label_block:
        violations.append(
            f"CYCLE_LABEL map not found in {js_path.relative_to(root)}"
        )
        return violations
    inner = cycle_label_block.group(1)
    for mode, expected_label in THEME_ARIA_LABEL_BY_MODE.items():
        mode_re = re.compile(
            rf"\b{re.escape(mode)}\s*:\s*['\"]([^'\"]+)['\"]",
        )
        m = mode_re.search(inner)
        if not m:
            violations.append(
                f"CYCLE_LABEL missing key {mode!r} in {js_path.relative_to(root)}"
            )
            continue
        actual_label = m.group(1)
        if actual_label != expected_label:
            violations.append(
                f"CYCLE_LABEL[{mode!r}] = {actual_label!r}, expected {expected_label!r}"
            )

    return violations


def load_canonical_fouc_iife(root: Path) -> str:
    """Extract the inline IIFE byte sequence from
    assets/shell/head-snippet.html.

    Returns "" on missing/unreadable file or absent <script> block; the
    caller turns that into a violation per page so the failure is loud.
    """
    snippet = root / "assets" / "shell" / "head-snippet.html"
    if not snippet.is_file():
        return ""
    try:
        text = snippet.read_text(encoding="utf-8")
    except OSError:
        return ""
    matches = FOUC_SCRIPT_RE.findall(text)
    if not matches:
        return ""
    # The first <script> block in head-snippet.html is the IIFE.
    return matches[0].strip()


def check_fouc_script(path: Path, canonical_iife: str) -> list[str]:
    """Verify the blocking inline FOUC IIFE is present in this page's <head>.

    The 50ms no-FOUC budget lives in the IIFE; if a future PR deletes
    the inline <script> tag on a single page, the drift check (header/
    footer only) and the cobalt-token check (base.css) both pass, and
    AC #1's "data-theme within 50ms of first paint" is silently broken
    on that page. The IIFE is byte-equivalent across every page
    (defined in assets/shell/head-snippet.html), so substring-match is
    the right shape of check.
    """
    if not canonical_iife:
        return ["no canonical FOUC IIFE available (head-snippet.html empty or unreadable)"]
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        return [f"cannot read file: {exc}"]
    if canonical_iife not in text:
        return [
            "blocking inline FOUC IIFE missing from <head> "
            "(50ms no-FOUC budget dependency)"
        ]
    return []


# Story 1.7 — Command Palette ARIA invariants (UX-DR-19 combobox 1.1 listbox).
# The palette is a single shared DOM node mounted on every page; the
# structural assertions below ensure the wiring is correct and the
# overlay is hidden in the static markup.
COMBOBOX_RE = re.compile(
    r'<div\s+class="shell-palette"\s+id="palette"\s+role="combobox"\s+'
    r'aria-haspopup="listbox"\s+aria-owns="palette-listbox"\s+'
    r'aria-expanded="(?:true|false)"',
    re.IGNORECASE,
)
SEARCHBOX_RE = re.compile(
    r'<input\s+class="shell-palette-input"\s+id="palette-input"\s+type="search"\s+'
    r'role="searchbox"\s+aria-controls="palette-listbox"\s+'
    r'aria-activedescendant=""\s+aria-autocomplete="list"',
    re.IGNORECASE,
)
LISTBOX_RE = re.compile(
    r'<ul\s+class="shell-palette-list"\s+id="palette-listbox"\s+role="listbox"',
    re.IGNORECASE,
)
PALETTE_HIDDEN_RE = re.compile(
    r'<div\s+class="shell-palette"\s+id="palette"[^>]*\bhidden\b',
    re.IGNORECASE,
)
# Story 3.1: the palette carries a live region inside the panel for
# result-count announcements (UX-DR-18). The region must be present in
# the static markup so SR users hear announcements as soon as the
# palette opens. Must have `aria-live="polite"` so non-modal changes
# don't interrupt the user's current speech.
PALETTE_LIVE_REGION_RE = re.compile(
    r'<div\s+id="palette-live"\s+class="[^"]*\bshell-sr-only\b[^"]*"'
    r'\s+aria-live="polite"\s+aria-atomic="true"',
    re.IGNORECASE,
)
# Story 10.20 — Inline Header Search ARIA invariants (UX-DR-19 combobox
# 1.2 listbox). The inline dropdown is a separate DOM node mounted
# inside the chrome header; it carries `role="search"` on the wrapper
# and `role="combobox"` on the input (the inline search uses WAI-ARIA
# 1.2 semantics, which the existing palette overlay does not). Both
# surfaces must coexist (palette overlay + header-search dropdown) so
# the existing palette regexes are kept and new ones are added below.
HEADER_SEARCH_WRAPPER_RE = re.compile(
    r'<div\s+class="shell-header-search"\s+id="header-search"\s+role="search"\s+'
    r'data-open="false"',
    re.IGNORECASE,
)
HEADER_SEARCH_INPUT_RE = re.compile(
    r'<input\s+class="shell-header-search-input"\s+id="header-search-input"\s+type="search"\s+'
    r'role="combobox"\s+aria-controls="header-search-listbox"\s+'
    r'aria-expanded="false"\s+aria-autocomplete="list"',
    re.IGNORECASE,
)
HEADER_SEARCH_LISTBOX_RE = re.compile(
    r'<ul\s+class="shell-header-search-list"\s+id="header-search-listbox"\s+role="listbox"',
    re.IGNORECASE,
)
HEADER_SEARCH_PANEL_HIDDEN_RE = re.compile(
    r'<div\s+class="shell-header-search-panel"\s+id="header-search-panel"[^>]*\bhidden\b',
    re.IGNORECASE,
)
# The header-search live region lives in the panel and announces
# result counts the same way the modal palette does. The region must
# be present in the static markup so SR users hear announcements as
# soon as the inline search opens.
HEADER_SEARCH_LIVE_REGION_RE = re.compile(
    r'<div\s+id="header-search-live"\s+class="[^"]*\bshell-sr-only\b[^"]*"'
    r'\s+aria-live="polite"\s+aria-atomic="true"',
    re.IGNORECASE,
)
# Story 3.1 AC-9: the forced-colors 2px cursor border is keyed off
# `[aria-selected="true"]`. The rule must land in components.css so the
# stroke applies to the JS-rendered option `<li>`s the moment JS sets
# the attribute. Verify the CSS rule exists rather than the runtime
# state (the options are JS-rendered, not in static markup). The
# actual selector in components.css is
# `.shell-palette-list [role="option"][aria-selected="true"]` (the
# `<li role="option">` elements live inside `.shell-palette-list`).
# Both the selector and the declaration must co-occur inside the same
# rule block (selector + opening brace + declarations) so a regression
# that drops the forced-colors scope from the palette rule, or moves
# the border to a different rule, surfaces here. (An earlier independent
# regex check was vacuous — the components.css file carries other
# `[aria-selected="true"]` selectors and other `solid CanvasText`
# declarations in unrelated rules.)
PALETTE_FORCED_RULE_RE = re.compile(
    r"\.[\w-]*shell-palette-list[^{]*\[aria-selected\s*=\s*[\"']true[\"']\][^{]*"
    r"\{[^}]*border\s*:\s*[^;}]*solid\s+CanvasText[^}]*\}",
    re.IGNORECASE | re.DOTALL,
)
# Retained for diagnostic messages if a future regression splits the
# selector and declaration across rules.
PALETTE_SELECTOR_FORCED = re.compile(
    r"\[aria-selected\s*=\s*[\"']true[\"']\]",
    re.IGNORECASE,
)
PALETTE_BORDER_FORCED = re.compile(
    r"\bborder\s*:\s*[^;}]*solid\s+CanvasText",
    re.IGNORECASE,
)


def check_palette_aria(path: Path, root: Path) -> list[str]:
    """Verify every page has exactly one WAI-ARIA 1.1 combobox+listbox
    palette overlay, with hidden attribute present in the static markup
    (the JS toggles [hidden] on open/close). The structural assertions
    close the gap where shell-drift-check.py would only byte-match the
    palette region without verifying the ARIA wiring is correct.

    Without this check, a regression that drops `aria-haspopup="listbox"`
    or the `controls`/`owns` circuit silently ships a screen-reader-invisible
    palette that passes drift but is non-functional for assistive tech.

    Story 3.1 additions:
    - The live-region element (`#palette-live`) must be present in the
      static palette markup with `aria-live="polite"` + `aria-atomic="true"`
      so SR users hear result-count announcements as soon as the palette
      opens.
    - The `[aria-selected="true"]` forced-colors 2px cursor border rule
      (AI-17) must live in components.css — the JS-rendered options are
      not in static markup, so we can't byte-match the runtime state
      here; instead we verify the CSS rule exists so the moment JS sets
      `aria-selected="true"`, the rule fires.
    """
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        return [f"cannot read file: {exc}"]
    violations: list[str] = []
    combos = COMBOBOX_RE.findall(text)
    if len(combos) == 0:
        violations.append("missing <div class=\"shell-palette\" role=\"combobox\"> overlay")
    elif len(combos) > 1:
        violations.append(
            f"found {len(combos)} <div role=\"combobox\"> elements; expected exactly 1"
        )
    searchboxes = SEARCHBOX_RE.findall(text)
    if len(searchboxes) == 0:
        violations.append("missing <input role=\"searchbox\" aria-controls=\"palette-listbox\">")
    elif len(searchboxes) > 1:
        violations.append(
            f"found {len(searchboxes)} <input role=\"searchbox\"> elements; expected exactly 1"
        )
    listboxes = LISTBOX_RE.findall(text)
    if len(listboxes) == 0:
        violations.append("missing <ul id=\"palette-listbox\" role=\"listbox\">")
    elif len(listboxes) > 1:
        violations.append(
            f"found {len(listboxes)} <ul role=\"listbox\"> elements; expected exactly 1"
        )
    # The static markup MUST carry the `hidden` attribute on the overlay
    # so the palette is closed by default. JS strips it on openPalette().
    if combos and not PALETTE_HIDDEN_RE.search(text):
        violations.append(
            "palette overlay is missing the `hidden` attribute in static markup "
            "(must be closed by default; JS opens via removeAttribute)"
        )
    # Story 3.1 AC-7: live region for result-count announcements. Must
    # be present in the static markup (not JS-injected) so SR picks it
    # up immediately on palette open. Without this region, the search
    # result changes silently for SR users.
    if combos and not PALETTE_LIVE_REGION_RE.search(text):
        violations.append(
            "palette is missing #palette-live live region with aria-live=\"polite\" "
            "(UX-DR-18 / Story 3.1 AC-7: SR users must hear result counts)"
        )
    # Story 3.1 AC-9: forced-colors 2px cursor border. The rule lives
    # in chrome-palette.css (extracted in Story 4 Phase 5 from the
    # monolithic components.css); verify it's present so the JS-set
    # `aria-selected="true"` triggers the border under Windows
    # High-Contrast / forced-colors mode.
    palette_css = root / "assets" / "css" / "chrome-palette.css"
    try:
        css_text = palette_css.read_text(encoding="utf-8")
    except OSError:
        css_text = ""
    if combos and css_text:
        if not PALETTE_FORCED_RULE_RE.search(css_text):
            violations.append(
                "chrome-palette.css is missing the forced-colors 2px cursor border "
                "on .shell-palette-list [role=\"option\"][aria-selected=\"true\"] "
                "(AI-17 / Story 3.1 AC-9: non-cursor rows must remain "
                "distinguishable from the Highlight+HighlightText cursor row)"
            )
    return violations


HEADER_SEARCH_FORCED_RULE_RE = re.compile(
    r"\.[\w-]*shell-header-search-list[^{]*\[aria-selected\s*=\s*[\"']true[\"']\][^{]*"
    r"\{[^}]*border\s*:\s*[^;}]*solid\s+CanvasText[^}]*\}",
    re.IGNORECASE | re.DOTALL,
)


def check_header_search_aria(path: Path, root: Path) -> list[str]:
    """Story 10.20 — Inline Header Search ARIA invariants (UX-DR-19
    combobox 1.2 listbox). The inline dropdown is a separate DOM node
    mounted inside the chrome header — it carries `role="search"` on
    the wrapper and `role="combobox"` on the input (WAI-ARIA 1.2
    semantics; the modal palette still uses 1.1). Both surfaces must
    coexist so the existing palette check is preserved and the
    header-search check is added below.

    The structural assertions close the gap where shell-drift-check.py
    would only byte-match the header-search region without verifying
    the ARIA wiring is correct (role names, aria-controls, aria-expanded
    initial state, [hidden] on the panel, live region for SR users).
    """
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        return [f"cannot read file: {exc}"]
    violations: list[str] = []

    wrappers = HEADER_SEARCH_WRAPPER_RE.findall(text)
    if len(wrappers) == 0:
        violations.append(
            "missing <div class=\"shell-header-search\" role=\"search\" data-open=\"false\"> wrapper"
        )
    elif len(wrappers) > 1:
        violations.append(
            f"found {len(wrappers)} <div id=\"header-search\"> wrappers; expected exactly 1"
        )

    inputs = HEADER_SEARCH_INPUT_RE.findall(text)
    if len(inputs) == 0:
        violations.append(
            "missing <input class=\"shell-header-search-input\" role=\"combobox\" "
            "aria-controls=\"header-search-listbox\" aria-expanded=\"false\">"
        )
    elif len(inputs) > 1:
        violations.append(
            f"found {len(inputs)} <input id=\"header-search-input\"> elements; expected exactly 1"
        )

    listboxes = HEADER_SEARCH_LISTBOX_RE.findall(text)
    if len(listboxes) == 0:
        violations.append("missing <ul id=\"header-search-listbox\" role=\"listbox\">")
    elif len(listboxes) > 1:
        violations.append(
            f"found {len(listboxes)} <ul id=\"header-search-listbox\"> elements; expected exactly 1"
        )

    # The static markup MUST carry the `hidden` attribute on the panel
    # so the inline search is collapsed by default. JS strips it on
    # openHeaderSearch().
    if wrappers and not HEADER_SEARCH_PANEL_HIDDEN_RE.search(text):
        violations.append(
            "header-search panel is missing the `hidden` attribute in static markup "
            "(must be collapsed by default; JS opens via removeAttribute)"
        )

    # The header-search live region must be present in the static markup
    # so SR users hear result counts as soon as the inline search opens.
    if wrappers and not HEADER_SEARCH_LIVE_REGION_RE.search(text):
        violations.append(
            "header-search is missing #header-search-live live region with aria-live=\"polite\" "
            "(UX-DR-18 / Story 10.20: SR users must hear result counts)"
        )

    # Verify the chrome-header-search.css forced-colors 2px cursor border
    # exists (mirrors the palette check). The selectors are scoped to
    # .shell-header-search-list (the inline listbox) instead of
    # .shell-palette-list.
    if wrappers:
        hs_css = root / "assets" / "css" / "chrome-header-search.css"
        try:
            css_text = hs_css.read_text(encoding="utf-8")
        except OSError:
            css_text = ""
        if css_text and not HEADER_SEARCH_FORCED_RULE_RE.search(css_text):
            violations.append(
                "chrome-header-search.css is missing the forced-colors 2px cursor border "
                "on .shell-header-search-list [role=\"option\"][aria-selected=\"true\"] "
                "(AI-17 / Story 10.20: non-cursor rows must remain "
                "distinguishable from the Highlight+HighlightText cursor row)"
            )

    return violations


# Story 1.8 — Settings Modal ARIA invariants (WAI-ARIA 1.2 modal dialog).
# The settings overlay is a true modal: role="dialog", aria-modal="true",
# aria-labelledby resolves to a heading id, and the static markup must
# carry the `hidden` attribute (JS strips it on open). The check pins the
# structural shape across all 36 pages so a regression that drops one of
# the ARIA attributes is caught at the same gate as the palette and
# cobalt-token checks.
SETTINGS_MODAL_RE = re.compile(
    r'<div\s+id="shell-settings-modal"\s+class="shell-settings-modal"\s+'
    r'role="dialog"\s+aria-modal="true"\s+aria-labelledby="([^"]+)"\s+'
    r'aria-hidden="true"\s+hidden',
    re.IGNORECASE,
)
SETTINGS_PANEL_RE = re.compile(
    r'<div\s+class="shell-settings-modal__panel"\s+tabindex="-1"',
    re.IGNORECASE,
)
SETTINGS_CLOSE_RE = re.compile(
    r'<button[^>]*\bclass="shell-settings-modal__close"[^>]*\bdata-settings-dismiss',
    re.IGNORECASE,
)
SETTINGS_LABELED_BY_RE = re.compile(
    r'<h2\s+id="([^"]+)"\s+class="shell-settings-modal__title"',
    re.IGNORECASE,
)


def check_settings_modal_aria(path: Path) -> list[str]:
    """Verify the settings modal carries the WAI-ARIA 1.2 modal-dialog
    contract on every page. Closes the gap where shell-drift-check.py
    would only byte-match the settings region without verifying that
    role="dialog", aria-modal="true", aria-labelledby resolves, the
    hidden attribute is present in static markup, and the close
    trigger carries data-settings-dismiss.
    """
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        return [f"cannot read file: {exc}"]
    violations: list[str] = []

    modals = SETTINGS_MODAL_RE.findall(text)
    if len(modals) == 0:
        violations.append(
            "missing <div id=\"shell-settings-modal\" role=\"dialog\" aria-modal=\"true\">"
        )
        return violations
    if len(modals) > 1:
        violations.append(
            f"found {len(modals)} settings modal roots; expected exactly 1"
        )
    labelled_by = modals[0]
    heading = SETTINGS_LABELED_BY_RE.search(text)
    if not heading or heading.group(1) != labelled_by:
        violations.append(
            f"aria-labelledby={labelled_by!r} does not resolve to a matching <h2 id>"
        )

    if not SETTINGS_PANEL_RE.search(text):
        violations.append(
            "settings modal panel <div class=\"shell-settings-modal__panel\" tabindex=\"-1\">"
            " missing"
        )
    if not SETTINGS_CLOSE_RE.search(text):
        violations.append(
            "settings modal close button <button class=\"shell-settings-modal__close\""
            " data-settings-dismiss> missing"
        )
    return violations


def emit(violations: list[str], rel: Path, kind: str) -> int:
    """Print pass/fail lines for one page check; return 1 if any violation."""
    if violations:
        for v in violations:
            print(f"  FAIL    {rel}  {v}")
        return 1
    print(f"  ok      {rel}  {kind}")
    return 0


# Story 3.3 — Keyboard Help Overlay ARIA invariants (UX-DR-3).
# The help overlay is a NON-MODAL region (overlay, not dialog). Unlike
# the palette (combobox) and the settings modal (true modal dialog),
# the help overlay is `role="region"` with `aria-label` and a hidden
# attribute in static markup; it must NOT carry `aria-modal="true"`
# (UX-DR-3: Tab moves focus OUT of the overlay into the page beneath
# — a focus trap would violate this). The check pins the structural
# shape across every page so a regression that drops one of these
# ARIA attributes is caught at the same gate as the palette + settings.
HELP_REGION_RE = re.compile(
    r'<div\s+class="shell-help"\s+id="help"\s+role="region"\s+'
    r'aria-label="Keyboard shortcuts"\s+hidden',
    re.IGNORECASE,
)
HELP_NO_MODAL_RE = re.compile(
    r'<div[^>]*\bid="help"[^>]*\baria-modal="true"',
    re.IGNORECASE,
)
HELP_SEARCH_RE = re.compile(
    r'<input\b(?=[^>]*\bid="help-search")(?=[^>]*\btype="search")(?=[^>]*\baria-label="Filter shortcuts")',
    re.IGNORECASE,
)
HELP_LIVE_REGION_RE = re.compile(
    r'<div\s+id="help-live"[^>]*\baria-live="polite"',
    re.IGNORECASE,
)
HELP_TOOL_SECTION_RE = re.compile(
    r'<section\s+id="help-tool"\s+class="shell-help-section"',
    re.IGNORECASE,
)
HELP_GLOBAL_SECTION_RE = re.compile(
    r'<section\s+id="help-global"\s+class="shell-help-section"',
    re.IGNORECASE,
)


def check_help_aria(path: Path) -> list[str]:
    """Verify every page has exactly one keyboard help overlay div with
    the WAI-ARIA 1.1 region pattern (UX-DR-3 + EXPERIENCE.md:422). The
    overlay must be hidden in the static markup, MUST NOT carry
    `aria-modal="true"` (UX-DR-3 explicitly forbids it — Tab must
    leave the overlay), and must include the search input + live
    region + the two section groups.
    """
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        return [f"cannot read file: {exc}"]
    violations: list[str] = []

    regions = HELP_REGION_RE.findall(text)
    if len(regions) == 0:
        violations.append(
            'missing <div id="help" role="region" aria-label="Keyboard shortcuts" hidden>'
        )
    elif len(regions) > 1:
        violations.append(
            f"found {len(regions)} help overlay regions; expected exactly 1"
        )

    # UX-DR-3 + EXPERIENCE.md:422: the help overlay is non-modal.
    # A regression that adds `aria-modal="true"` would silently
    # turn the overlay into a focus-trapping dialog — the search
    # input would trap Tab inside it and the calling element would
    # lose focus restoration on close.
    if HELP_NO_MODAL_RE.search(text):
        violations.append(
            "help overlay carries aria-modal=\"true\" (UX-DR-3 / EXPERIENCE.md:422 "
            "explicitly forbids it — Tab must move focus OUT of the overlay "
            "into the page beneath; the help is a non-modal region)"
        )

    searches = HELP_SEARCH_RE.findall(text)
    if len(searches) == 0:
        violations.append(
            'missing <input type="search" id="help-search" aria-label="Filter shortcuts">'
        )
    elif len(searches) > 1:
        violations.append(
            f"found {len(searches)} #help-search inputs; expected exactly 1"
        )

    if not HELP_LIVE_REGION_RE.search(text):
        violations.append(
            "help overlay is missing #help-live live region with aria-live=\"polite\" "
            "(UX-DR-18 pattern: SR users must hear \"N shortcuts shown\" "
            "as filter narrows)"
        )

    if not HELP_TOOL_SECTION_RE.search(text):
        violations.append(
            "help overlay is missing <section id=\"help-tool\"> per-tool section"
        )
    if not HELP_GLOBAL_SECTION_RE.search(text):
        violations.append(
            "help overlay is missing <section id=\"help-global\"> global section"
        )
    return violations


def check_main_landmark(path: Path) -> list[str]:
    """Return a list of human-readable violations for the given page."""
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        return [f"cannot read file: {exc}"]
    matches = MAIN_RE.findall(text)
    if len(matches) == 0:
        return ["no <main id=\"main\" class=\"shell-main\" aria-label=\"...\" tabindex=\"-1\"> landmark"]
    if len(matches) > 1:
        return [f"found {len(matches)} <main> landmarks; expected exactly 1"]
    label = matches[0].strip()
    if not label:
        return ["<main aria-label=\"\"> is empty or whitespace-only"]
    return []


def check_base_css(path: Path) -> list[str]:
    """Verify cobalt tokens are declared at :root and the dark override
    exists at :root[data-theme=\"dark\"]."""
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        return [f"cannot read base.css: {exc}"]

    violations: list[str] = []

    # 1. Cobalt tokens declared at :root.
    # Extract the first plain `:root { ... }` block.
    root_block_m = re.search(r":root\s*\{([^{}]*)\}", text, re.DOTALL)
    if not root_block_m:
        violations.append("no plain :root { ... } block found")
    else:
        root_block = root_block_m.group(1)
        for name in COBALT_TOKEN_NAMES:
            if name not in root_block:
                violations.append(f"cobalt token {name} missing from :root block")

    # 2. Dark override at :root[data-theme="dark"].
    dark_block_m = re.search(
        r":root\[data-theme=\"dark\"\]\s*\{[^{}]*\}",
        text,
        re.DOTALL,
    )
    if not dark_block_m:
        violations.append('no :root[data-theme="dark"] { ... } override block found')

    # 3. Embed mode hides .theme-toggle via html[data-embed="1"]. The
    # spec (Story 1.6) requires ?embed=1 to lock theme to system AND
    # hide the toggle via CSS; the JS-side guards are verified at
    # runtime, but a future edit to base.css can silently drop this
    # rule without tripping any other check. The cobalt-token check
    # above only inspects :root selectors; embed-mode is a separate
    # selector so it lives in its own assertion.
    if "html[data-embed=\"1\"] .theme-toggle" not in text:
        violations.append(
            'embed-mode CSS rule html[data-embed="1"] .theme-toggle '
            "{ display: none !important } missing from base.css"
        )

    return violations


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument(
        "--root",
        help="explicit repo root (default: walk up to find tools.schema.json)",
    )
    args = parser.parse_args(argv)

    root = (
        Path(args.root).resolve()
        if args.root
        else find_repo_root(Path(__file__).parent)
    )

    failures = 0
    targets = iter_target_files(root)
    if not targets:
        sys.stderr.write(f"shell-a11y-check: no target pages found under {root}\n")
        return 2

    canonical_iife = load_canonical_fouc_iife(root)

    print(f"shell-a11y-check: scanning {len(targets)} page(s) for <main aria-label>")
    for path in targets:
        rel = path.relative_to(root)
        failures += emit(check_main_landmark(path), rel, "<main> landmark shape")
        failures += emit(check_main_aria_label(path, root), rel, "<main aria-label> content")
        failures += emit(check_fouc_script(path, canonical_iife), rel, "inline FOUC IIFE")
        failures += emit(check_palette_aria(path, root), rel, "palette ARIA wiring")
        failures += emit(check_header_search_aria(path, root), rel, "header-search ARIA wiring")
        failures += emit(check_settings_modal_aria(path), rel, "settings modal ARIA wiring")
        failures += emit(check_help_aria(path), rel, "help overlay ARIA wiring")

    base_css = root / "assets" / "css" / "base.css"
    if not base_css.is_file():
        sys.stderr.write(f"shell-a11y-check: missing {base_css}\n")
        return 2
    print(f"shell-a11y-check: verifying cobalt tokens in {base_css.relative_to(root)}")
    css_violations = check_base_css(base_css)
    if css_violations:
        failures += 1
        for v in css_violations:
            print(f"  FAIL    {base_css.relative_to(root)}  {v}")
    else:
        print(f"  ok      {base_css.relative_to(root)}")

    print("shell-a11y-check: verifying theme-cycle aria-label strings")
    theme_violations = check_theme_aria_label(root)
    if theme_violations:
        failures += 1
        for v in theme_violations:
            print(f"  FAIL    {v}")
    else:
        print("  ok      theme-cycle aria-label strings present")

    if failures:
        print(f"shell-a11y-check: {failures} violation(s) found")
        return 1
    print("shell-a11y-check: all structural a11y invariants pass")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))