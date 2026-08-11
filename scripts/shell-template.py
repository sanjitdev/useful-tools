#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
shell-template.py — Regenerate the Shell chrome across every tool page.

Pure-stdlib Python. Same shape as scripts/tool-contract-gate.py and
scripts/tool-inventory.py (when added): no third-party deps, exit codes
0/1/2/3, Markdown status on stdout.

Purpose
-------
Story 1.5 ships a single canonical chrome in assets/shell/chrome.html
(skip link + header + footer + main landmark). To keep the 34 brownfield
tools consistent, this script regenerates each tools/<slug>/index.html
in place, swapping the legacy empty <div id="site-header">/<main>/
<div id="site-footer"> pattern for the new chrome while preserving the
tool's own body markup byte-for-byte.

The script is idempotent: re-running it on a regenerated file produces
the same bytes. The script does NOT edit the canonical chrome itself —
that's a hand-written source of truth, edited only when the design
changes, with the drift check (scripts/shell-drift-check.py) enforcing
that index.html and every tool page stay byte-identical to the regions
delimited by <!-- shell:header --> and <!-- shell:footer -->.

Usage
-----
  python scripts/shell-template.py              # regenerate all tools
  python scripts/shell-template.py --tool <slug>  # regenerate one tool
  python scripts/shell-template.py --dry-run    # print plan, do not write
  python scripts/shell-template.py --root ...   # explicit repo root

Exit codes
----------
  0 — all targeted files regenerated successfully
  1 — missing tool (--tool slug not found)
  2 — template parse error (chrome.html missing or malformed)
  3 — write error (file system failure)

Author: Handy Tools (Story 1.5 — Shell HTML Skeleton with Cobalt Tokens)
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass

# ---------------------------------------------------------------------------
# Path handling — same walk-up pattern as the four prior scripts.
# ---------------------------------------------------------------------------

SCHEMA_ANCHOR = "tools.schema.json"


def find_repo_root(start: Path) -> Path:
    try:
        cur = start.resolve()
    except OSError as exc:
        sys.stderr.write(f"shell-template: cannot resolve {start}: {exc}\n")
        sys.exit(2)
    for parent in [cur, *cur.parents]:
        if (parent / SCHEMA_ANCHOR).is_file():
            return parent
    sys.stderr.write(
        f"shell-template: cannot locate {SCHEMA_ANCHOR} in {cur} or any ancestor.\n"
    )
    sys.exit(2)


# ---------------------------------------------------------------------------
# Chrome source — read once from assets/shell/chrome.html, split into the
# three regions the script will splice into each tool page.
# ---------------------------------------------------------------------------

CHROME_REL = Path("assets/shell/chrome.html")
HEAD_SNIPPET_REL = Path("assets/shell/head-snippet.html")
PALETTE_REL = Path("assets/shell/palette.html")
SETTINGS_REL = Path("assets/shell/settings.html")
# Story 3.3: per-tool keyboard shortcuts overlay (UX-DR-6, FR-7). The
# overlay is a single shared DOM node mounted on every page — the same
# chrome-template convention as palette.html and settings.html.
HELP_REL = Path("assets/shell/help.html")
TOOLS_JSON_REL = Path("tools.json")

TOOLS_JSON_INLINE_START = "<!-- ht:tools-json-inline-start -->"
TOOLS_JSON_INLINE_END = "<!-- ht:tools-json-inline-end -->"
TOOLS_JSON_INLINE_RE = re.compile(
    re.escape(TOOLS_JSON_INLINE_START)
    + r"\s*(.*?)\s*"
    + re.escape(TOOLS_JSON_INLINE_END),
    re.DOTALL,
)
TOOLS_JSON_SCRIPT_RE = re.compile(
    r'<script\s+type="application/json"\s+id="ht-tools-json-inline"\s*>.*?</script>',
    re.DOTALL | re.IGNORECASE,
)

# Story 1.10: the storage-registry manifest is exported to chrome.html
# between `ht:storage-registry-manifest-start` / `-end` markers. The
# home page mirrors the manifest so the drift check covers it; tool
# pages don't carry it (the gate reads chrome.html directly).
REGISTRY_MANIFEST_INLINE_START = "<!-- ht:storage-registry-manifest-start -->"
REGISTRY_MANIFEST_INLINE_END = "<!-- ht:storage-registry-manifest-end -->"
REGISTRY_MANIFEST_INLINE_RE = re.compile(
    re.escape(REGISTRY_MANIFEST_INLINE_START)
    + r"\s*(.*?)\s*"
    + re.escape(REGISTRY_MANIFEST_INLINE_END),
    re.DOTALL,
)

CHROME_SKIP_RE = re.compile(
    r"<a class=\"shell-skip\"[^>]*>.*?</a>\s*", re.DOTALL
)
CHROME_HEADER_RE = re.compile(
    r"<!-- shell:header -->\s*(.*?)\s*<!-- /shell:header -->", re.DOTALL
)
CHROME_FOOTER_RE = re.compile(
    r"<!-- shell:footer -->\s*(.*?)\s*<!-- /shell:footer -->", re.DOTALL
)
PALETTE_REGION_RE = re.compile(
    r"<!-- shell:palette -->\s*(.*?)\s*<!-- /shell:palette -->", re.DOTALL
)
SETTINGS_REGION_RE = re.compile(
    r"<!-- shell:settings -->\s*(.*?)\s*<!-- /shell:settings -->", re.DOTALL
)
# Story 3.3: the help overlay's region marker. The drift check
# (scripts/shell-drift-check.py) byte-matches this region across every
# page, so the markers must be present in both the canonical
# assets/shell/help.html source AND every generated page.
HELP_REGION_RE = re.compile(
    r"<!-- shell:help -->\s*(.*?)\s*<!-- /shell:help -->", re.DOTALL
)
# Strip ALL palette/settings includes from the source, whether or not
# they carry the `<!-- shell:palette -->` / `<!-- /shell:palette -->`
# marker comments. The byte-aligned chrome rewrite
# (process_file byte_aligned path, regenerate_home byte_aligned path)
# re-emits the canonical palette + settings blocks after </footer>. A
# page that already contains a duplicate include from an earlier
# broken regeneration would have BOTH the just-rewritten canonical
# include AND the leftover old include, producing two `<div
# class="shell-palette" id="palette">` elements on every page — 36
# a11y violations per shell-a11y-check.py run. Stripping every
# palette/settings div first guarantees the rewrite produces exactly
# one canonical include. The drift check
# (scripts/shell-drift-check.py) only byte-matches the FIRST
# occurrence, so the duplicate slipped past drift validation. The
# `<div class="shell-palette" id="palette" ...>` opening tag is the
# unique anchor (the same id appears only inside that single include
# div); the closing `</div>` matches the nearest one. We use a
# non-greedy match bounded by the next `<div class="shell-palette"`,
# `<div class="shell-settings"`, or end-of-file so the regex doesn't
# consume unrelated content between two same-type includes. A
# preceding comment-block of ~6 lines (3 lines above + 3 lines below
# the marker, when present) is consumed too. Idempotent.
_PALETTE_OPEN = r'<div\s+class="shell-palette"\s+id="palette"'
# Note: the settings include div is `<div id="shell-settings-modal"
# class="shell-settings-modal" ...>`. The unique anchor is the
# `id="shell-settings-modal"` attribute — `class="shell-settings"`
# (which the inner fieldset classes contain) is too generic.
_SETTINGS_OPEN = r'<div\s+id="shell-settings-modal"\s+class="shell-settings-modal"'
# Story 3.3: the help overlay include div is `<div class="shell-help"
# id="help" ...>`. The unique anchor is the `id="help"` attribute.
# Class "shell-help" is too generic (matches inner element classes).
_HELP_OPEN = r'<div\s+class="shell-help"\s+id="help"'
# Comment-block optionally surrounding the include: up to 8 lines of
# `<!-- ... -->` comments, each preceded by optional whitespace, with
# a trailing newline. This catches the 3-line comment block above and
# below the marker comments that `palette.html` / `settings.html`
# ship with, even when the marker comments themselves are absent
# (older regenerated pages have the markers stripped).
_OPTIONAL_COMMENT_BLOCK = r"(?:[ \t]*<!--[^\n]*-->\s*)*"
# Stop boundary: anything that is clearly NOT part of the include
# tail. Used to bound the non-greedy `.*?` match so it can't run to
# EOF when the page has exactly ONE palette include followed by
# exactly ONE settings include followed by the script-tag block.
# Includes: another palette/settings/help opening tag, a top-level
# `<script` tag (the trailing tool-script block), `</body>` close,
# or the `<!-- ht:` marker that introduces the tools.json-inline
# script tag.
_STOP_BOUNDARY = (
    r"(?:"
    + _OPTIONAL_COMMENT_BLOCK + _PALETTE_OPEN
    + r"|"
    + _OPTIONAL_COMMENT_BLOCK + _SETTINGS_OPEN
    + r"|"
    + _OPTIONAL_COMMENT_BLOCK + _HELP_OPEN
    + r"|<script[\s>]"
    + r"|</body>"
    + r"|<!--\s*ht:"
    + r")"
)
ALL_PALETTE_INCLUDES_RE = re.compile(
    _OPTIONAL_COMMENT_BLOCK
    + _PALETTE_OPEN
    + r".*?(?=" + _STOP_BOUNDARY + r")",
    re.DOTALL,
)
ALL_SETTINGS_INCLUDES_RE = re.compile(
    _OPTIONAL_COMMENT_BLOCK
    + _SETTINGS_OPEN
    + r".*?(?=" + _STOP_BOUNDARY + r")",
    re.DOTALL,
)
ALL_HELP_INCLUDES_RE = re.compile(
    _OPTIONAL_COMMENT_BLOCK
    + _HELP_OPEN
    + r".*?(?=" + _STOP_BOUNDARY + r")",
    re.DOTALL,
)


def strip_duplicate_includes(source: str) -> str:
    """Remove every palette/settings/help include div (plus any surrounding
    comment block) from `source`. Returns the source with ALL such
    blocks stripped (the caller is responsible for re-appending the
    canonical blocks via the byte-aligned rewrite path).

    The non-greedy `.*?` match is bounded by `_STOP_BOUNDARY` (next
    palette/settings/help opening tag, `<script>` tag, `</body>`, or
    `<!-- ht:` marker). Without this explicit boundary the regex
    would happily run all the way to EOF when the page has exactly
    one palette + one settings + one help + a trailing script block —
    consuming the script tags and the `</body></html>` close in the
    process.
    """
    new_source = ALL_PALETTE_INCLUDES_RE.sub("", source)
    new_source = ALL_SETTINGS_INCLUDES_RE.sub("", new_source)
    new_source = ALL_HELP_INCLUDES_RE.sub("", new_source)
    return new_source


def read_chrome(root: Path) -> tuple[str, str, str, str, str, str]:
    """Return (skip_link_html, header_html, footer_html, palette_html, settings_html, help_html).

    The canonical chrome contains a <main ... aria-label="{page_label}"> with
    a `{body}` placeholder. We extract the regions surrounding that
    placeholder so each tool page gets a copy with its own label and body.
    The palette region (Story 1.7), settings region (Story 1.8), and help
    region (Story 3.3) are separate canonical sources that are injected
    after the footer on every page so the overlays are single shared DOM
    nodes.
    """
    path = root / CHROME_REL
    if not path.is_file():
        sys.stderr.write(f"shell-template: missing chrome source at {path}\n")
        sys.exit(2)
    text = path.read_text(encoding="utf-8")

    skip_match = CHROME_SKIP_RE.search(text)
    header_match = CHROME_HEADER_RE.search(text)
    footer_match = CHROME_FOOTER_RE.search(text)
    if not (skip_match and header_match and footer_match):
        sys.stderr.write(
            "shell-template: chrome.html missing one of "
            "{shell-skip, shell:header, shell:footer} markers\n"
        )
        sys.exit(2)

    skip_html = skip_match.group(0)
    header_html = header_match.group(1)
    footer_html = footer_match.group(1)

    # Read the palette include verbatim from its own canonical source. The
    # palette is a separate file so shell.html stays focused on the
    # header/footer/main chrome and the palette module can evolve
    # independently (Story 3.1 will append options without touching chrome).
    palette_path = root / PALETTE_REL
    if not palette_path.is_file():
        sys.stderr.write(f"shell-template: missing palette source at {palette_path}\n")
        sys.exit(2)
    palette_text = palette_path.read_text(encoding="utf-8")
    palette_match = PALETTE_REGION_RE.search(palette_text)
    if not palette_match:
        sys.stderr.write(
            "shell-template: palette.html missing shell:palette markers\n"
        )
        sys.exit(2)
    palette_html = palette_match.group(1)

    # Read the settings include verbatim from its own canonical source.
    # Same convention as palette — the settings modal is a single shared
    # DOM node mounted on every page (Story 1.8).
    settings_path = root / SETTINGS_REL
    if not settings_path.is_file():
        sys.stderr.write(f"shell-template: missing settings source at {settings_path}\n")
        sys.exit(2)
    settings_text = settings_path.read_text(encoding="utf-8")
    settings_match = SETTINGS_REGION_RE.search(settings_text)
    if not settings_match:
        sys.stderr.write(
            "shell-template: settings.html missing shell:settings markers\n"
        )
        sys.exit(2)
    settings_html = settings_match.group(1)

    # Story 3.3: the help overlay's canonical source is a separate file
    # so assets/shell/help.html can evolve independently of the chrome
    # template (mirrors the palette.html / settings.html convention).
    # The region must carry shell:help markers — the drift check uses
    # them to byte-match every page.
    help_path = root / HELP_REL
    if not help_path.is_file():
        sys.stderr.write(f"shell-template: missing help source at {help_path}\n")
        sys.exit(2)
    help_text = help_path.read_text(encoding="utf-8")
    help_match = HELP_REGION_RE.search(help_text)
    if not help_match:
        sys.stderr.write(
            "shell-template: help.html missing shell:help markers\n"
        )
        sys.exit(2)
    help_html = help_match.group(1)

    return skip_html, header_html, footer_html, palette_html, settings_html, help_html


def read_head_snippet(root: Path) -> str:
    """Return the verbatim inline FOUC script block (the <script>...</script>
    string) that must replace the legacy IIFE on every page."""
    path = root / HEAD_SNIPPET_REL
    if not path.is_file():
        sys.stderr.write(f"shell-template: missing head snippet at {path}\n")
        sys.exit(2)
    text = path.read_text(encoding="utf-8")
    match = re.search(r"(<script>.*?</script>)", text, re.DOTALL)
    if not match:
        sys.stderr.write(
            "shell-template: head-snippet.html contains no <script> block\n"
        )
        sys.exit(2)
    return match.group(1)


def read_tools_json_inline(root: Path) -> str:
    """Return the inline JSON block (a `<script type="application/json"
    id="ht-tools-json-inline">…</script>` element) whose body is the
    compact-JSON serialization of `tools.json`. The element is consumed
    by `assets/js/home-grid.js` when `fetch('./tools.json')` throws
    (file:// loads, offline, 404). The script tag is wrapped in marker
    comments (`ht:tools-json-inline-start` / `-end`) so the drift check
    (`scripts/shell-drift-check.py`) can extract and byte-match it.

    The whole script tag (including markers) is what gets spliced into
    index.html. Idempotent: re-running on an aligned page produces no
    change. The minified JSON contains no `</script>` substring, so the
    element body is safe to drop into HTML verbatim.
    """
    path = root / TOOLS_JSON_REL
    if not path.is_file():
        sys.stderr.write(f"shell-template: missing tools.json at {path}\n")
        sys.exit(2)
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except ValueError as exc:
        sys.stderr.write(
            f"shell-template: tools.json is not valid JSON: {exc}\n"
        )
        sys.exit(2)
    # Re-serialize with the most compact separators that produce
    # browser-stable output (no whitespace, sorted keys so the drift
    # check is byte-stable across machines).
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    if "</script>" in body.lower():
        sys.stderr.write(
            "shell-template: tools.json contains '</script>' substring; "
            "refusing to splice into inline JSON block\n"
        )
        sys.exit(2)
    return (
        TOOLS_JSON_INLINE_START + "\n  "
        + '<script type="application/json" id="ht-tools-json-inline">'
        + body
        + "</script>\n  "
        + TOOLS_JSON_INLINE_END
    )


def read_storage_registry_manifest(root: Path) -> str:
    """Extract the storage-registry manifest block from chrome.html. The
    block is delimited by `ht:storage-registry-manifest-start` / `-end`
    markers; the inner `<script type="application/json" id="ht-storage-
    registry-manifest">…</script>` element is what the gate parses.

    The whole block (including markers) is what gets spliced into
    index.html. Idempotent: re-running on an aligned page produces no
    change. (Story 1.10.)"""
    chrome_path = root / CHROME_REL
    if not chrome_path.is_file():
        sys.stderr.write(
            f"shell-template: missing chrome source at {chrome_path}\n"
        )
        sys.exit(2)
    text = chrome_path.read_text(encoding="utf-8")
    match = REGISTRY_MANIFEST_INLINE_RE.search(text)
    if not match:
        sys.stderr.write(
            "shell-template: chrome.html missing storage-registry manifest markers\n"
        )
        sys.exit(2)
    return match.group(0)


# ---------------------------------------------------------------------------
# Tool page transforms — replace header/main/footer/script blocks.
# ---------------------------------------------------------------------------

LEGACY_HEADER_RE = re.compile(
    r"<div id=\"site-header\"></div>\s*", re.IGNORECASE
)
LEGACY_FOOTER_RE = re.compile(
    r"<div id=\"site-footer\"></div>\s*", re.IGNORECASE
)
LEGACY_MAIN_RE = re.compile(
    r"<main(?P<attrs>(?:\s[^>]*)?)>(?P<body>.*?)</main>",
    re.DOTALL,
)
LEGACY_FOUC_RE = re.compile(
    r"<script>\(function\(\)\{try\{var t=localStorage\.getItem\(\"ht\.theme\"\);.*?</script>\s*",
    re.DOTALL,
)
LEGACY_THEME_SCRIPT_RE = re.compile(
    r"<script src=\"../../assets/js/theme\.js\"></script>\s*", re.IGNORECASE
)
LEGACY_LAYOUT_SCRIPT_RE = re.compile(
    r"<script src=\"../../assets/js/layout\.js\"></script>\s*", re.IGNORECASE
)


def derive_display_name(title_text: str) -> str:
    """`<title>Age Calculator · Handy Tools</title>` → `Age Calculator`.

    Whitespace-only or empty titles fall back to a generic label so the
    <main aria-label> on the rendered page is never empty (Patch #7 from
    the Story 1.5 code review). The generic name is intentional; it is
    not localized because shell-template is invoked at build/preview
    time and the page itself owns the human-readable <title>.

    Patch #1 (post-1.5 review): HTML-decode entities (e.g. `Pros &amp;
    Cons` → `Pros & Cons`) so screen readers don't read the literal
    entity string. `html.unescape` is the stdlib, single-pass, safe
    against malformed entities (silently passes through).
    """
    cleaned = re.sub(r"\s+·\s+Handy Tools\s*$", "", title_text).strip()
    if not cleaned:
        sys.stderr.write(
            "shell-template: empty <title> in source; falling back to "
            "'Handy Tools' for the <main aria-label>\n"
        )
        return "Handy Tools"
    return html.unescape(cleaned)


def transform(
    source: str,
    *,
    page_label: str,
    slug: str,
    skip_html: str,
    header_html: str,
    footer_html: str,
    palette_html: str,
    settings_html: str,
    help_html: str,
    head_script: str,
) -> str:
    """Apply the four swaps. Each step assumes the previous step's input.
    Returns the original source unchanged if any marker is missing —
    the caller treats this as a no-op (idempotent re-run)."""
    new_source = source

    # 1. Replace the inline FOUC script (in <head>) with the canonical one.
    new_source, n = LEGACY_FOUC_RE.subn(head_script + "\n\n  ", new_source, count=1)
    # n == 0 is fine: re-runs on an already-regenerated page find no legacy
    # FOUC script. The other swaps are skipped below if the legacy markers
    # are also absent.

    # 2. Replace <div id="site-header"></div> with the skip link + header.
    #    If the legacy marker is absent (page already regenerated) but the
    #    embedded header/footer bytes no longer match chrome.html, fall
    #    through to a byte-aligned in-place replacement anchored on the
    #    skip-link start and </footer> end.
    new_source, n = LEGACY_HEADER_RE.subn(
        skip_html + "\n  " + header_html + "\n  ", new_source, count=1
    )
    if n == 0:
        # Bug fix: a previous broken regeneration can leave a SECOND
        # palette/settings include stranded below </footer> in the
        # preserved tail. Detect that via the count check and trigger
        # the byte-aligned rewrite even when chrome bytes look current.
        palette_dup = new_source.count('class="shell-palette" id="palette"') > 1
        settings_dup = new_source.count('id="shell-settings-modal"') > 1
        if (
            '<a class="shell-skip"' in new_source
            and '</footer>' in new_source
            and (
                header_html not in new_source
                or footer_html not in new_source
                or palette_dup
                or settings_dup
            )
        ):
            # Strip every marker-delimited palette/settings block before
            # the byte-aligned rewrite — the canonical blocks are
            # re-appended by the rewrite itself.
            new_source = strip_duplicate_includes(new_source)
            anchor_start = new_source.find('<a class="shell-skip"')
            anchor_end = new_source.find('</footer>', anchor_start)
            if anchor_start == -1 or anchor_end == -1:
                sys.stderr.write(
                    "shell-template: skip link + footer found but cannot anchor "
                    "byte-aligned rewrite\n"
                )
                return source
            anchor_end += len('</footer>')
            replacement = (
                skip_html + "\n  " + header_html + "\n  "
                + footer_html + "\n\n  " + palette_html + "\n\n  "
                + settings_html + "\n\n  " + help_html + "\n\n  "
            )
            new_source = new_source[:anchor_start] + replacement + new_source[anchor_end:]
            # Skip steps 3-4 below — the in-place rewrite replaced everything.
            n = 1  # tell the next step "we successfully replaced chrome"
            # Run step 5 cleanup on this path too (script tag ordering).
            new_source = LEGACY_THEME_SCRIPT_RE.sub("", new_source)
            new_source = LEGACY_LAYOUT_SCRIPT_RE.sub("", new_source)
            if 'src="../../assets/js/shell.js"' not in new_source:
                new_source = new_source.replace(
                    '<script src="../../assets/js/utils.js"></script>',
                    '<script src="../../assets/js/utils.js"></script>\n  '
                    '<script src="../../assets/js/shell.js" defer></script>',
                )
            # Story 3.2: palette-actions.js MUST load before shell.js
            # so HT_PALETTE_ACTIONS is defined when shell.js boots and
            # consumes it into the _actions registry. Idempotent —
            # already-present pages keep the existing tag.
            if 'src="../../assets/js/palette-actions.js"' not in new_source:
                shell_anchor_pa = '<script src="../../assets/js/shell.js" defer></script>'
                if shell_anchor_pa in new_source:
                    new_source = new_source.replace(
                        shell_anchor_pa,
                        '<script src="../../assets/js/palette-actions.js"></script>\n  '
                        + shell_anchor_pa,
                        1,
                    )
                else:
                    sys.stderr.write(
                        "shell-template: palette-actions.js splice skipped — "
                        "<script src=\"../../assets/js/shell.js\" defer></script> "
                        "anchor not found in legacy page\n"
                    )
            # Story 1.10: storage-registry.js (idempotent — already-present
            # pages keep the existing tag).
            if 'src="../../assets/js/storage-registry.js"' not in new_source:
                new_source = new_source.replace(
                    '<script src="../../assets/js/utils.js"></script>',
                    '<script src="../../assets/js/storage-registry.js"></script>\n  '
                    '<script src="../../assets/js/utils.js"></script>',
                )
            # Story 1.12: site-config.js must load BEFORE storage-registry.js
            # so HT.siteConfig is defined when the boot sequence consults it.
            # Idempotent — already-present pages keep the existing tag.
            if 'src="../../assets/js/site-config.js"' not in new_source:
                utils_anchor = '<script src="../../assets/js/utils.js"></script>'
                storage_anchor = '<script src="../../assets/js/storage-registry.js"></script>'
                if storage_anchor in new_source:
                    new_source = new_source.replace(
                        storage_anchor,
                        '<script src="../../assets/js/site-config.js"></script>\n  '
                        + storage_anchor,
                        1,
                    )
                elif utils_anchor in new_source:
                    new_source = new_source.replace(
                        utils_anchor,
                        '<script src="../../assets/js/site-config.js"></script>\n  '
                        + utils_anchor,
                        1,
                    )
            if 'data-slug="' not in new_source:
                new_source = re.sub(
                    r'<main\s+id="main"\s+class="shell-main"',
                    f'<main id="main" class="shell-main" data-slug="{slug}"',
                    new_source,
                    count=1,
                )
            # Story 1.11: search.js (idempotent — already-present pages keep
            # the existing tag). Anchored after shell.js so the Shell API
            # surface is in place when search.js boots.
            if 'src="../../assets/js/search.js"' not in new_source:
                shell_anchor = '<script src="../../assets/js/shell.js" defer></script>'
                if shell_anchor in new_source:
                    new_source = new_source.replace(
                        shell_anchor,
                        shell_anchor
                        + '\n  <script src="../../assets/js/search.js" defer></script>',
                        1,
                    )
                else:
                    # shell.js anchor absent — search.js cannot be spliced.
                    # Surface this so the dev agent knows the page will be
                    # missing search.js after regeneration.
                    sys.stderr.write(
                        "shell-template: search.js splice skipped — "
                        "<script src=\"../../assets/js/shell.js\" defer></script> "
                        "anchor not found in legacy page\n"
                    )
            # Story 3.3: help-overlay.js (idempotent — already-present pages
            # keep the existing tag). Anchored after search.js so the boot
            # order is deterministic: a11y.js → palette-actions.js → shell.js
            # → search.js → help-overlay.js.
            if 'src="../../assets/js/help-overlay.js"' not in new_source:
                search_anchor = '<script src="../../assets/js/search.js" defer></script>'
                if search_anchor in new_source:
                    new_source = new_source.replace(
                        search_anchor,
                        search_anchor
                        + '\n  <script src="../../assets/js/help-overlay.js" defer></script>',
                        1,
                    )
                else:
                    sys.stderr.write(
                        "shell-template: help-overlay.js splice skipped — "
                        "<script src=\"../../assets/js/search.js\" defer></script> "
                        "anchor not found in legacy page\n"
                    )
            return new_source
        sys.stderr.write(
            "shell-template: <div id=\"site-header\"></div> marker not found\n"
        )
        return source

    # 3. Wrap the existing <main> with id + aria-label + class.
    #    Story 1.12: also stamp data-slug="<slug>" so the footer link
    #    wiring in shell.js can resolve the current tool's slug without
    #    re-parsing location.pathname.
    def _main_repl(match: re.Match[str]) -> str:
        body = match.group("body")
        attrs = match.group("attrs") or ""
        attrs = re.sub(r"\s+class=\"[^\"]*\"", "", attrs)
        attrs = re.sub(r"\s+id=\"[^\"]*\"", "", attrs)
        attrs = re.sub(r"\s+aria-label=\"[^\"]*\"", "", attrs)
        attrs = re.sub(r"\s+data-slug=\"[^\"]*\"", "", attrs)
        return (
            f'<main id="main" class="shell-main" data-slug="{slug}"{attrs} '
            f'aria-label="{page_label}" tabindex="-1">'
            f'\n    <a id="top"></a>\n    '
            + body.rstrip()
            + "\n  </main>"
        )

    new_source, n = LEGACY_MAIN_RE.subn(_main_repl, new_source, count=1)
    if n == 0:
        sys.stderr.write("shell-template: <main> element not found\n")
        return source

    # 4. Replace <div id="site-footer"></div> with the footer chrome, and
    #    append the palette and settings includes as sibling regions
    #    immediately after the footer. Both are single shared DOM nodes
    #    mounted on every page (Story 1.7 palette, Story 1.8 settings).
    new_source, n = LEGACY_FOOTER_RE.subn(
        footer_html
        + "\n\n  "
        + palette_html
        + "\n\n  "
        + settings_html
        + "\n\n  "
        + help_html
        + "\n\n  ",
        new_source,
        count=1,
    )
    if n == 0:
        sys.stderr.write(
            "shell-template: <div id=\"site-footer\"></div> marker not found\n"
        )
        return source

    # 5. Remove theme.js and layout.js script tags; ensure shell.js is present.
    new_source = LEGACY_THEME_SCRIPT_RE.sub("", new_source)
    new_source = LEGACY_LAYOUT_SCRIPT_RE.sub("", new_source)
    if 'src="../../assets/js/shell.js"' not in new_source:
        new_source = new_source.replace(
            '<script src="../../assets/js/utils.js"></script>',
            '<script src="../../assets/js/utils.js"></script>\n  '
            '<script src="../../assets/js/shell.js" defer></script>',
        )
    # Story 1.12: site-config.js must load BEFORE storage-registry.js so
    # HT.siteConfig is defined when the boot sequence consults it (it's
    # not currently consumed by the registry, but the link target logic
    # in shell.js runs on the same tick). The script is added only on the
    # first regeneration of a tool page (idempotent on re-run).
    if 'src="../../assets/js/site-config.js"' not in new_source:
        utils_anchor = '<script src="../../assets/js/utils.js"></script>'
        storage_anchor = '<script src="../../assets/js/storage-registry.js"></script>'
        if storage_anchor in new_source:
            # Insert site-config.js immediately before storage-registry.js.
            new_source = new_source.replace(
                storage_anchor,
                '<script src="../../assets/js/site-config.js"></script>\n  '
                + storage_anchor,
                1,
            )
        elif utils_anchor in new_source:
            # storage-registry.js not present yet — fall through; the
            # storage-registry block below will splice site-config.js
            # via the same anchor.
            pass
    # Story 1.10: ensure storage-registry.js is loaded BEFORE utils.js so
    # the wrapper can delegate to HT.storageRegistry. The script is added
    # only on the first regeneration of a tool page (idempotent on re-run).
    if 'src="../../assets/js/storage-registry.js"' not in new_source:
        utils_anchor = '<script src="../../assets/js/utils.js"></script>'
        # If site-config.js was just added (above), splice both before utils.js.
        if 'src="../../assets/js/site-config.js"' in new_source:
            new_source = new_source.replace(
                utils_anchor,
                '<script src="../../assets/js/storage-registry.js"></script>\n  '
                + utils_anchor,
                1,
            )
        else:
            new_source = new_source.replace(
                utils_anchor,
                '<script src="../../assets/js/site-config.js"></script>\n  '
                + '<script src="../../assets/js/storage-registry.js"></script>\n  '
                + utils_anchor,
                1,
            )
    # Story 1.11: ensure search.js is loaded on every tool page so the
    # command palette (Story 1.7) and any tool-page search input can
    # consume HT.search. The script is added only on the first regeneration
    # of a tool page (idempotent on re-run), anchored after shell.js so
    # the module is loaded once the Shell API surface is functional.
    if 'src="../../assets/js/search.js"' not in new_source:
        shell_anchor = '<script src="../../assets/js/shell.js" defer></script>'
        if shell_anchor in new_source:
            new_source = new_source.replace(
                shell_anchor,
                shell_anchor + '\n  <script src="../../assets/js/search.js" defer></script>',
                1,
            )
        else:
            sys.stderr.write(
                "shell-template: search.js splice skipped — "
                "<script src=\"../../assets/js/shell.js\" defer></script> "
                "anchor not found\n"
            )
    # Story 3.2: palette-actions.js MUST load BEFORE shell.js so
    # HT_PALETTE_ACTIONS is defined when shell.js boots and consumes
    # the array into the `_actions` registry. Idempotent — anchored
    # immediately before shell.js.
    if 'src="../../assets/js/palette-actions.js"' not in new_source:
        shell_anchor = '<script src="../../assets/js/shell.js" defer></script>'
        if shell_anchor in new_source:
            new_source = new_source.replace(
                shell_anchor,
                '<script src="../../assets/js/palette-actions.js"></script>\n  '
                + shell_anchor,
                1,
            )
    # Story 3.3: help-overlay.js loads AFTER search.js so the help
    # overlay's `?` chord is installed after the palette and search
    # modules have booted. The boot order is deterministic:
    # a11y.js → palette-actions.js → shell.js → search.js → help-overlay.js.
    # Idempotent — already-present pages keep the existing tag.
    if 'src="../../assets/js/help-overlay.js"' not in new_source:
        search_anchor = '<script src="../../assets/js/search.js" defer></script>'
        if search_anchor in new_source:
            new_source = new_source.replace(
                search_anchor,
                search_anchor
                + '\n  <script src="../../assets/js/help-overlay.js" defer></script>',
                1,
            )

    return new_source


def ensure_tool_config_and_slug(source: str, slug: str) -> str:
    """Add Story 1.12 metadata without rewriting an existing tool body.

    Decision #1 (Story 1.12 review): also splice the inline tools.json
    block into every tool page so `wireViewSourceLink()` can resolve the
    slug's entry synchronously without depending on home-grid.js (tool
    pages don't load it) or a per-tool `registerEntry()` call (Story
    1.15 work). The block is identical to the one shell-template.py
    splices into the home page; drift-check verifies byte equivalence.
    """
    new_source = source
    # data-slug — both presence AND value (correct any stale slug).
    data_slug_re = re.compile(r'data-slug="([^"]+)"')
    data_slug_match = data_slug_re.search(new_source)
    if data_slug_match is None:
        new_source = re.sub(
            r'<main\s+id="main"\s+class="shell-main"',
            f'<main id="main" class="shell-main" data-slug="{slug}"',
            new_source,
            count=1,
        )
    elif data_slug_match.group(1) != slug:
        # Wrong value — replace it with the canonical slug.
        new_source = (
            new_source[: data_slug_match.start(1)]
            + slug
            + new_source[data_slug_match.end(1):]
        )
    if 'src="../../assets/js/site-config.js"' not in new_source:
        site_tag = '<script src="../../assets/js/site-config.js"></script>'
        storage_tag = '<script src="../../assets/js/storage-registry.js"></script>'
        utils_tag = '<script src="../../assets/js/utils.js"></script>'
        if storage_tag in new_source:
            new_source = new_source.replace(
                storage_tag, site_tag + "\n  " + storage_tag, 1
            )
        elif utils_tag in new_source:
            new_source = new_source.replace(
                utils_tag, site_tag + "\n  " + utils_tag, 1
            )
    # Story 3.2: palette-actions.js MUST load BEFORE shell.js so
    # HT_PALETTE_ACTIONS is defined when shell.js boots and consumes
    # the array into the `_actions` registry. Idempotent — already-
    # present pages keep the existing tag. Anchored immediately before
    # shell.js so the boot order is deterministic.
    if 'src="../../assets/js/palette-actions.js"' not in new_source:
        shell_anchor = '<script src="../../assets/js/shell.js" defer></script>'
        if shell_anchor in new_source:
            new_source = new_source.replace(
                shell_anchor,
                '<script src="../../assets/js/palette-actions.js"></script>\n  '
                + shell_anchor,
                1,
            )
        else:
            sys.stderr.write(
                "shell-template: palette-actions.js splice skipped — "
                "<script src=\"../../assets/js/shell.js\" defer></script> "
                "anchor not found\n"
            )
    # Story 3.3: help-overlay.js loads AFTER search.js. Idempotent.
    if 'src="../../assets/js/help-overlay.js"' not in new_source:
        search_anchor = '<script src="../../assets/js/search.js" defer></script>'
        if search_anchor in new_source:
            new_source = new_source.replace(
                search_anchor,
                search_anchor
                + '\n  <script src="../../assets/js/help-overlay.js" defer></script>',
                1,
            )
        else:
            sys.stderr.write(
                "shell-template: help-overlay.js splice skipped — "
                "<script src=\"../../assets/js/search.js\" defer></script> "
                "anchor not found\n"
            )
    return new_source


def page_label_from_title(title_match: re.Match[str]) -> str:
    return derive_display_name(title_match.group(1))


def splice_inline_tools_json(source: str, tools_json_inline: str) -> str:
    """Insert the inline `<script type="application/json"
    id="ht-tools-json-inline">…</script>` block (file:// fallback for
    home-grid.js) into the page. On tool pages this lets
    `wireViewSourceLink()` resolve the slug's entry synchronously
    without depending on home-grid.js (tool pages don't load it).
    Idempotent: a page that already carries the block is returned
    unchanged.

    Strategy:
      - if both markers present → replace via the regex (idempotent).
      - else if home-grid.js anchor exists → insert as a sibling block
        immediately before it (tool pages; matches the home-page layout
        once they grow the include). The next regeneration normalizes
        to marker-delimited form.
      - else if shell.js anchor exists → insert immediately before
        shell.js (older tool pages that never grew home-grid.js).
    """
    if (
        TOOLS_JSON_INLINE_START in source
        and TOOLS_JSON_INLINE_END in source
    ):
        out, _ = TOOLS_JSON_INLINE_RE.subn(tools_json_inline, source, count=1)
        return out
    # No markers — inject as a free-standing block before a known anchor.
    anchor = '<script src="../../assets/js/home-grid.js" defer></script>'
    if anchor in source:
        return source.replace(
            anchor,
            tools_json_inline + "\n\n  " + anchor,
            1,
        )
    shell_anchor = '<script src="../../assets/js/shell.js" defer></script>'
    if shell_anchor in source:
        return source.replace(
            shell_anchor,
            tools_json_inline + "\n\n  " + shell_anchor,
            1,
        )
    # No anchor found — refuse to splice silently. The drift-check
    # would catch the missing block anyway; surfacing here keeps the
    # log honest.
    sys.stderr.write(
        "shell-template: tools.json inline splice skipped — no "
        "shell.js / home-grid.js anchor in legacy page\n"
    )
    return source


def process_file(
    root: Path,
    slug: str,
    *,
    skip_html: str,
    header_html: str,
    footer_html: str,
    palette_html: str,
    settings_html: str,
    help_html: str,
    head_script: str,
    tools_json_inline: str,
    dry_run: bool,
) -> bool:
    path = root / "tools" / slug / "index.html"
    if not path.is_file():
        sys.stderr.write(f"shell-template: missing tool page {path}\n")
        return False
    source = path.read_text(encoding="utf-8")
    title_match = re.search(r"<title>(.*?)</title>", source, re.DOTALL)
    if not title_match:
        sys.stderr.write(f"shell-template: <title> missing in {path}\n")
        sys.exit(2)
    label = page_label_from_title(title_match)

    # Idempotency check: a page that already carries the new chrome markers,
    # the exact byte-equivalent header/footer/palette blocks, the correct
    # per-page aria-label, AND the canonical FOUC IIFE bytes has nothing
    # left to swap. The aria-label check was added in the post-1.5
    # review because the chrome-region byte check alone is too weak: a
    # regression that writes a stale aria-label (e.g. encoded `&amp;`
    # instead of decoded `&`) would skip re-run. The IIFE check was added
    # in Story 1.6: the FOUC IIFE in assets/shell/head-snippet.html is
    # the source of truth and every page must embed its current bytes
    # byte-for-byte so the a11y check's substring assertion passes.
    # The palette check was added in Story 1.7: the command palette is
    # a single shared DOM node mounted on every page.
    expected_label = label
    label_re = re.compile(
        r'<main\s+id="main"\s+class="shell-main"(?:\s+data-slug="[^"]+")?\s+aria-label="([^"]+)"\s+tabindex="-1">',
        re.IGNORECASE,
    )
    label_match = label_re.search(source)
    label_ok = bool(label_match) and label_match.group(1).strip() == expected_label
    chrome_ok = (
        '<a class="shell-skip"' in source
        and 'class="site-header" role="banner"' in source
        and '<footer class="site-footer" role="contentinfo"' in source
        and '<main id="main" class="shell-main"' in source
        and f'data-slug="{slug}"' in source
        and 'src="../../assets/js/shell.js"' in source
        and header_html in source
        and footer_html in source
    )
    palette_ok = palette_html in source
    settings_ok = settings_html in source
    # Story 3.3: help overlay is a single shared DOM node mounted on every
    # page (UX-DR-6, FR-7). The drift check byte-matches this block.
    help_ok = help_html in source
    # Position check: the help block must appear inside the chrome region
    # (i.e., before `</body>`). A page that somehow placed the help block
    # outside the chrome region (e.g., accidentally pasted at the end of
    # the body) would pass `help_ok` but the overlay wouldn't be a sibling
    # of palette + settings. The `</body>` anchor stands in for the
    # implicit `<!-- /shell:chrome -->` end marker that this codebase does
    # not actually emit (the chrome region is bounded by the footer close
    # + trailing includes, not by a marker comment).
    help_before_body = (
        not help_ok
        or help_html not in source
        or source.index(help_html) < source.index("</body>")
    )
    # Bug fix: a previous broken regeneration can leave a SECOND
    # palette/settings include stranded in the page (the byte-aligned
    # check above only requires "at least one" include, not "exactly
    # one"). Count occurrences of the unique include id and require
    # exactly one — the canonical rewrite will replace it. Two palette
    # nodes would silently produce 2 listboxes + 2 comboboxes and
    # double every shell-a11y-check.py palette assertion. Same
    # pattern as `regenerate_home` above.
    palette_count_in_source = source.count('class="shell-palette" id="palette"')
    settings_count_in_source = source.count('id="shell-settings-modal"')
    palette_count_ok = palette_count_in_source == 1
    settings_count_ok = settings_count_in_source == 1
    # Story 1.12: site-config.js must load BEFORE storage-registry.js so
    # HT.siteConfig is defined before any module consults it. Missing the
    # tag would leave HT.siteConfig undefined and the footer link wiring
    # in shell.js would no-op silently.
    site_config_js_ok = (
        'src="../../assets/js/site-config.js"' in source
    )
    # Story 1.12: site-config.js MUST precede storage-registry.js so the
    # boot sequence sees HT.siteConfig defined before any IIFE consults it.
    # A page that has the script tag but in the wrong position would still
    # leave HT.siteConfig undefined when storage-registry.js runs.
    site_config_first_ok = (
        'src="../../assets/js/site-config.js"' not in source
        or 'src="../../assets/js/storage-registry.js"' not in source
        or source.find('src="../../assets/js/site-config.js"')
        < source.find('src="../../assets/js/storage-registry.js"')
    )
    # Story 1.10: storage-registry.js must be loaded on every page so
    # HT.storage.get/set/remove can dispatch through the registry. The
    # tool pages share the same chrome + utils boot order as the home
    # page; missing the script tag would regress the wrapper to the
    # ES5 baseline and break the gate's "unregistered key" enforcement.
    storage_registry_js_ok = (
        'src="../../assets/js/storage-registry.js"' in source
    )
    # Story 1.11: search.js must be loaded on every page so the command
    # palette (Story 1.7) and any tool-page search input can consume
    # HT.search. Anchored after shell.js so the API surface is in place
    # when the engine boots.
    search_js_ok = (
        'src="../../assets/js/search.js"' in source
    )
    # Story 3.2 + 3.2-review patch #10: palette-actions.js MUST load
    # BEFORE shell.js so `HT_PALETTE_ACTIONS` is defined when shell.js
    # boots and consumes the array into the `_actions` registry.
    # Without it the palette's action matcher has nothing to filter
    # against and the 6 global actions never appear in the listbox.
    # The byte-aligned gate detects presence; the boot-order check
    # below pins relative position (palette-actions.js must precede
    # shell.js). The splice below handles injection.
    palette_actions_js_ok = (
        'src="../../assets/js/palette-actions.js"' in source
    )
    palette_actions_js_before_shell_js = (
        not palette_actions_js_ok
        or source.index('src="../../assets/js/palette-actions.js"')
            < source.index('src="../../assets/js/shell.js" defer')
    )
    # Story 3.3: help-overlay.js must be loaded on every page so the
    # overlay's `?` chord is installed. Anchored after search.js so the
    # boot order is deterministic: a11y.js → palette-actions.js → shell.js
    # → search.js → help-overlay.js. The byte-aligned gate detects
    # presence; the order check pins relative position.
    help_overlay_js_ok = (
        'src="../../assets/js/help-overlay.js"' in source
    )
    help_overlay_js_after_search_js = (
        not help_overlay_js_ok
        or 'src="../../assets/js/search.js"' not in source
        or source.index('src="../../assets/js/help-overlay.js"')
            > source.index('src="../../assets/js/search.js"')
    )
    # Story 1.12 (review patch — Decision #1): the inline tools.json
    # block (file:// fallback for home-grid.js) must also live on tool
    # pages so `wireViewSourceLink()` can resolve the slug's entry
    # synchronously without depending on home-grid.js (tool pages don't
    # load it). The block is identical to the home-page copy; drift-
    # check verifies byte equivalence via the same markers.
    tools_json_inline_ok = (
        TOOLS_JSON_INLINE_START in source
        and TOOLS_JSON_INLINE_END in source
    )
    full_ok = (
        chrome_ok
        and palette_ok
        and settings_ok
        and help_ok
        and help_before_body
        and palette_count_ok
        and settings_count_ok
        and site_config_js_ok
        and site_config_first_ok
        and storage_registry_js_ok
        and search_js_ok
        and palette_actions_js_ok
        and palette_actions_js_before_shell_js
        and help_overlay_js_ok
        and help_overlay_js_after_search_js
        and tools_json_inline_ok
    )
    # Find the IIFE block on the FIRST `<script>` opener in <head>. The IIFE
    # is always the first inline `<script>` in every page (it must run
    # before any stylesheet <link>). An earlier regex matched the first
    # clean `<script>(no-`<`)</script>` pair it found anywhere in the
    # file, which silently skipped over pages where the Story 1.5 broken
    # regeneration stacked 3 nested `<script>` opens with no `<` between
    # them. Scan from the start of <head> instead.
    head_start = source.find("<head>")
    head_section = source[head_start:] if head_start >= 0 else source
    iife_match = re.search(
        r"(<script>\s*)((?:(?!</script>).)*?)((?:\s*</script>)+)",
        head_section,
        re.IGNORECASE | re.DOTALL,
    )
    # Recompute the match offsets against the full source string.
    if iife_match:
        offset_in_full = head_start
        # Build a synthetic match with corrected .start()/.end()
        class FullMatch:
            def __init__(self, inner, base_offset):
                self._inner = inner
                self._base = base_offset
            def start(self, group=0):
                if group == 0:
                    return self._inner.start() + self._base
                return self._inner.start(group) + self._base
            def end(self, group=0):
                if group == 0:
                    return self._inner.end() + self._base
                return self._inner.end(group) + self._base
            def group(self, group=0):
                return self._inner.group(group)
        iife_match = FullMatch(iife_match, offset_in_full)
    # `read_head_snippet` returns the wrapped `<script>...</script>`
    # block. `iife_match.group(1)` is the inner content only. Compare
    # inner-to-inner so the byte-equivalence gate is accurate.
    # (Story 1.6 unified the home-page and tool-page paths under this
    # same comparison; the previous home-page gate was latent-buggy
    # because it compared the wrapped form to the inner capture.)
    head_inner = re.sub(r"^<script>|</script>$", "", head_script).strip()
    iife_ok = bool(iife_match) and iife_match.group(1).strip() == head_inner
    # Count nested wrappers: a page that came out of Story 1.5's broken
    # regeneration has 3 nested <script> opens + 3 closes. The
    # normalized form is exactly 1 + 1.
    nested_count = 0
    if iife_match:
        nested_count = max(
            len(re.findall(r"<script>", iife_match.group(0), re.IGNORECASE)),
            len(re.findall(r"</script>", iife_match.group(0), re.IGNORECASE)),
        )
    if full_ok and label_ok and iife_ok and nested_count <= 1:
        print(f"  no-change {path.relative_to(root)}  (already has new chrome)")
        return True

    # Story 1.12: when the page is otherwise chrome-aligned but is missing
    # only `data-slug` on <main> and/or the site-config.js script tag,
    # perform a minimal targeted splice. This avoids the destructive byte-
    # aligned chrome-region rewrite below (which would re-emit the entire
    # skip-link → </footer> span and can duplicate the palette/settings
    # includes on already-generated pages). The byte-aligned gate above is
    # intentionally strict for the same reason; this branch is the minimal-
    # write counterpart. Note: `chrome_ok` (above) already requires
    # `data-slug="{slug}"` and the site-config script tag, so we use a
    # weaker, purpose-built check here that excludes those two items.
    chrome_basic_ok = (
        '<a class="shell-skip"' in source
        and 'class="site-header" role="banner"' in source
        and '<footer class="site-footer" role="contentinfo"' in source
        and '<main id="main" class="shell-main"' in source
        and 'src="../../assets/js/shell.js"' in source
        and header_html in source
        and footer_html in source
    )
    if (
        chrome_basic_ok
        and palette_html in source
        and settings_html in source
        and help_html in source
        and storage_registry_js_ok
        and search_js_ok
        and (
            not site_config_js_ok
            or not site_config_first_ok
            or f'data-slug="{slug}"' not in source
            or not tools_json_inline_ok
            or not palette_actions_js_ok
            or not help_overlay_js_ok
        )
    ):
        new_source = ensure_tool_config_and_slug(source, slug)
        # If the inline tools.json block is missing, splice it in too.
        if not tools_json_inline_ok:
            new_source = splice_inline_tools_json(new_source, tools_json_inline)
        if new_source == source:
            print(f"  no-change {path.relative_to(root)}")
            return True
        if dry_run:
            missing = []
            if not site_config_js_ok:
                missing.append("site-config.js")
            if f'data-slug="{slug}"' not in source:
                missing.append("data-slug")
            if not tools_json_inline_ok:
                missing.append("tools.json-inline")
            if not palette_actions_js_ok:
                missing.append("palette-actions.js")
            if not help_overlay_js_ok:
                missing.append("help-overlay.js")
            print(
                f"  would-write {path.relative_to(root)}  ({' + '.join(missing)})"
            )
            return True
        try:
            path.write_text(new_source, encoding="utf-8")
        except OSError as exc:
            sys.stderr.write(
                f"shell-template: write failed for {path}: {exc}\n"
            )
            sys.exit(3)
        missing = []
        if 'src="../../assets/js/site-config.js"' not in source:
            missing.append("site-config.js")
        if f'data-slug="{slug}"' not in source:
            missing.append("data-slug")
        if not tools_json_inline_ok:
            missing.append("tools.json-inline")
        if 'src="../../assets/js/palette-actions.js"' not in source:
            missing.append("palette-actions.js")
        if not help_overlay_js_ok:
            missing.append("help-overlay.js")
        print(
            f"  wrote {path.relative_to(root)}  ({' + '.join(missing)})"
        )
        return True

    # If chrome is byte-aligned but the palette and/or settings include is
    # missing (Story 1.7 added palette, Story 1.8 added settings), inject
    # whichever is missing after </footer> in place. We anchor on the end
    # of the footer so the rest of the page (including the IIFE block,
    # script tags, and any additional trailing content) is left untouched.
    # This must run BEFORE the IIFE-only path below because that path's
    # `iife_ok` gate is currently over-strict (it compares against group(1)
    # rather than group(2) — a latent Story 1.6 bug) and would short-circuit
    # on a correct IIFE, preventing the palette splice from ever firing.
    if chrome_ok and not (
        palette_ok and settings_ok and help_ok and site_config_js_ok and storage_registry_js_ok and search_js_ok and palette_actions_js_ok and help_overlay_js_ok and tools_json_inline_ok
    ):
        footer_end = source.find('</footer>')
        if footer_end == -1:
            sys.stderr.write(
                f"shell-template: chrome byte-aligned but </footer> not found in {path}\n"
            )
            return False
        insert_at = footer_end + len('</footer>')
        # Story 1.10: inject the storage-registry.js script tag injection
        # alongside the palette/settings include. The script tag must land
        # BEFORE utils.js so the wrapper can delegate through the
        # registry; the actual insertion happens in the post-chrome
        # rewrite step below. Track the gap here so the rewrite fires.
        new_source = source
        # Story 1.12: site-config.js must come BEFORE storage-registry.js
        # when both are absent. The storage block below checks for
        # site-config's presence and adjusts the splice accordingly.
        if not site_config_js_ok:
            storage_anchor = '<script src="../../assets/js/storage-registry.js"></script>'
            utils_anchor = '<script src="../../assets/js/utils.js"></script>'
            if storage_anchor in new_source:
                new_source = new_source.replace(
                    storage_anchor,
                    '<script src="../../assets/js/site-config.js"></script>\n  '
                    + storage_anchor,
                    1,
                )
            elif utils_anchor in new_source:
                # No storage anchor yet; splice both in front of utils.js.
                # The storage splice (next block) will be a no-op because
                # we just added it.
                new_source = new_source.replace(
                    utils_anchor,
                    '<script src="../../assets/js/site-config.js"></script>\n  '
                    + '<script src="../../assets/js/storage-registry.js"></script>\n  '
                    + utils_anchor,
                    1,
                )
        if not storage_registry_js_ok:
            utils_anchor = '<script src="../../assets/js/utils.js"></script>'
            if utils_anchor in new_source:
                if 'src="../../assets/js/site-config.js"' not in new_source:
                    new_source = new_source.replace(
                        utils_anchor,
                        '<script src="../../assets/js/storage-registry.js"></script>\n  '
                        + utils_anchor,
                        1,
                    )
                else:
                    # site-config.js already present; just add storage
                    # immediately after it.
                    site_anchor = '<script src="../../assets/js/site-config.js"></script>'
                    new_source = new_source.replace(
                        site_anchor,
                        site_anchor + '\n  '
                        + '<script src="../../assets/js/storage-registry.js"></script>',
                        1,
                    )
        # Story 1.11: inject search.js anchored after shell.js so the Shell
        # API surface is in place when the search engine boots. Idempotent
        # — already-present pages keep the existing tag.
        if not search_js_ok:
            shell_anchor = '<script src="../../assets/js/shell.js" defer></script>'
            if shell_anchor in new_source:
                new_source = new_source.replace(
                    shell_anchor,
                    shell_anchor
                    + '\n  <script src="../../assets/js/search.js" defer></script>',
                    1,
                )
            else:
                sys.stderr.write(
                    "shell-template: search.js splice skipped — "
                    "<script src=\"../../assets/js/shell.js\" defer></script> "
                    "anchor not found\n"
                )
        # Story 3.2: palette-actions.js MUST load BEFORE shell.js so
        # HT_PALETTE_ACTIONS is defined when shell.js boots and consumes
        # the array into the `_actions` registry. Idempotent — already-
        # present pages keep the existing tag. Anchored immediately
        # before shell.js so the boot order is deterministic.
        if not palette_actions_js_ok:
            shell_anchor = '<script src="../../assets/js/shell.js" defer></script>'
            if shell_anchor in new_source:
                new_source = new_source.replace(
                    shell_anchor,
                    '<script src="../../assets/js/palette-actions.js"></script>\n  '
                    + shell_anchor,
                    1,
                )
            else:
                sys.stderr.write(
                    "shell-template: palette-actions.js splice skipped — "
                    "<script src=\"../../assets/js/shell.js\" defer></script> "
                    "anchor not found\n"
                )
        # Story 3.3: help-overlay.js loads AFTER search.js. Idempotent.
        if not help_overlay_js_ok:
            search_anchor = '<script src="../../assets/js/search.js" defer></script>'
            if search_anchor in new_source:
                new_source = new_source.replace(
                    search_anchor,
                    search_anchor
                    + '\n  <script src="../../assets/js/help-overlay.js" defer></script>',
                    1,
                )
            else:
                sys.stderr.write(
                    "shell-template: help-overlay.js splice skipped — "
                    "<script src=\"../../assets/js/search.js\" defer></script> "
                    "anchor not found\n"
                )
        # Story 1.12 (review — Decision #1): splice the inline
        # tools.json block so wireViewSourceLink() can resolve the slug
        # synchronously on tool pages (no home-grid.js there). Idempotent
        # via splice_inline_tools_json's marker check.
        if not tools_json_inline_ok:
            new_source = splice_inline_tools_json(new_source, tools_json_inline)
        # Always strip any existing palette/settings includes from the
        # chrome tail before splicing in the canonical blocks. Without
        # this strip, a stale palette (e.g. from before Story 3.1 added
        # the live region + chord hints) stays in the file alongside
        # the new canonical include — producing two `<div
        # class="shell-palette" id="palette">` elements and 2 listboxes
        # + 2 comboboxes (UX-DR-19 violation). The strip is bounded
        # by `_STOP_BOUNDARY` so it cannot consume the trailing script
        # tag block or the `</body></html>` close. Idempotent: if
        # palette + settings are already canonical, the strip yields
        # empty and the splice yields the same content back.
        new_source = strip_duplicate_includes(new_source)
        # Build the trailing splice: palette + settings + help in canonical
        # order. Always emit all three — the strip above has already
        # removed any stale versions, so emitting the canonical trio
        # produces exactly one of each.
        trailing = "\n\n  " + palette_html + "\n\n  " + settings_html + "\n\n  " + help_html
        new_source = new_source[:insert_at] + trailing + new_source[insert_at:]
        if new_source == source:
            print(f"  no-change {path.relative_to(root)}")
            return True
        if dry_run:
            missing = []
            if not palette_ok: missing.append("palette")
            if not settings_ok: missing.append("settings")
            if not help_ok: missing.append("help")
            if not site_config_js_ok: missing.append("site-config.js")
            if not storage_registry_js_ok: missing.append("storage-registry.js")
            if not search_js_ok: missing.append("search.js")
            if not palette_actions_js_ok: missing.append("palette-actions.js")
            if not help_overlay_js_ok: missing.append("help-overlay.js")
            if not tools_json_inline_ok: missing.append("tools.json-inline")
            if not f'data-slug="{slug}"' in source: missing.append("data-slug")
            print(f"  would-write {path.relative_to(root)}  ({' + '.join(missing)})")
            return True
        try:
            path.write_text(new_source, encoding="utf-8")
        except OSError as exc:
            sys.stderr.write(f"shell-template: write failed for {path}: {exc}\n")
            sys.exit(3)
        missing = []
        if not palette_ok: missing.append("palette")
        if not settings_ok: missing.append("settings")
        if not help_ok: missing.append("help")
        if not site_config_js_ok: missing.append("site-config.js")
        if not storage_registry_js_ok: missing.append("storage-registry.js")
        if not search_js_ok: missing.append("search.js")
        if not palette_actions_js_ok: missing.append("palette-actions.js")
        if not help_overlay_js_ok: missing.append("help-overlay.js")
        if not tools_json_inline_ok: missing.append("tools.json-inline")
        if not f'data-slug="{slug}"' in source: missing.append("data-slug")
        print(f"  wrote {path.relative_to(root)}  ({' + '.join(missing)})")
        return True

    # Bug fix: chrome is byte-aligned and the IIFE is canonical, but the
    # page has DUPLICATE palette/settings include blocks left over from
    # an earlier broken regeneration. Strip every marker-delimited
    # palette/settings block and re-append the canonical ones after
    # </footer>. This must run BEFORE the IIFE-only branch (which would
    # otherwise be a no-op on these pages, leaving the duplicates in
    # place). The drift check only byte-matches the FIRST occurrence
    # and so cannot detect this; shell-a11y-check.py flags it as 2
    # listboxes + 2 comboboxes (UX-DR-19 violation).
    if chrome_ok and (not palette_count_ok or not settings_count_ok):
        footer_end = source.find('</footer>')
        if footer_end == -1:
            sys.stderr.write(
                f"shell-template: chrome byte-aligned but </footer> not found in {path}\n"
            )
            return False
        insert_at = footer_end + len('</footer>')
        new_source = strip_duplicate_includes(source)
        # Re-append the canonical palette + settings + help includes.
        # Order matches the byte-aligned contract: palette first, then
        # settings, then help. All three blocks are full marker-delimited
        # regions.
        trailing = "\n\n  " + palette_html + "\n\n  " + settings_html + "\n\n  " + help_html
        new_source = new_source[:insert_at] + trailing + new_source[insert_at:]
        if new_source == source:
            print(f"  no-change {path.relative_to(root)}")
            return True
        if dry_run:
            print(
                f"  would-write {path.relative_to(root)}  "
                f"(dedupe palette={palette_count_in_source}→1, "
                f"settings={settings_count_in_source}→1)"
            )
            return True
        try:
            path.write_text(new_source, encoding="utf-8")
        except OSError as exc:
            sys.stderr.write(
                f"shell-template: write failed for {path}: {exc}\n"
            )
            sys.exit(3)
        print(
            f"  wrote {path.relative_to(root)}  "
            f"(dedupe palette={palette_count_in_source}→1, "
            f"settings={settings_count_in_source}→1)"
        )
        return True

    # Chrome is byte-aligned but the inline FOUC IIFE in <head> is stale
    # (the page was generated before the canonical IIFE was last edited).
    # Rewrite only the inner IIFE content in place — keep the surrounding
    # `<script>` / `</script>` tags intact. Mirrors the home-page IIFE-
    # only path added in Story 1.5. (Story 1.6 fixed the latent bug
    # where the inner capture was replaced with the wrapped form, which
    # doubled `<script>` tags on every re-run. Pages with nested
    # `<script>` wrappers from that broken regeneration are normalized
    # back to a single pair on every rewrite.)
    if chrome_ok and iife_match and (not iife_ok or nested_count > 1):
        new_source = (
            source[: iife_match.start()]
            + "<script>" + " " + head_inner + " " + "</script>"
            + source[iife_match.end():]
        )
        if new_source == source:
            print(f"  no-change {path.relative_to(root)}")
            return True
        if dry_run:
            print(f"  would-write {path.relative_to(root)}  (IIFE only)")
            return True
        try:
            path.write_text(new_source, encoding="utf-8")
        except OSError as exc:
            sys.stderr.write(f"shell-template: write failed for {path}: {exc}\n")
            sys.exit(3)
        if nested_count > 1:
            print(f"  wrote {path.relative_to(root)}  (normalized {nested_count} nested <script> wrappers → 1)")
        else:
            print(f"  wrote {path.relative_to(root)}  (IIFE only)")
        return True

    # If chrome is already byte-aligned but the aria-label is stale (e.g.
    # encoded `&amp;` instead of decoded `&`), rewrite just the aria-label
    # in place. The chrome itself does not need re-applying. This closes
    # the regression gap where the post-1.5 review fix landed in the
    # source but the 34 pages were never re-run through the patched
    # derive_display_name.
    if chrome_ok and not label_ok and label_match:
        new_source = source[: label_match.start(1)] + expected_label + source[label_match.end(1):]
        if new_source == source:
            print(f"  no-change {path.relative_to(root)}")
            return True
        if dry_run:
            print(f"  would-write {path.relative_to(root)}  (aria-label only)")
            return True
        try:
            path.write_text(new_source, encoding="utf-8")
        except OSError as exc:
            sys.stderr.write(f"shell-template: write failed for {path}: {exc}\n")
            sys.exit(3)
        print(f"  wrote {path.relative_to(root)}  (aria-label={expected_label!r})")
        return True

    updated = transform(
        source,
        page_label=label,
        slug=slug,
        skip_html=skip_html,
        header_html=header_html,
        footer_html=footer_html,
        palette_html=palette_html,
        settings_html=settings_html,
        head_script=head_script,
    )
    if updated == source:
        print(f"  no-change {path.relative_to(root)}")
        return True
    if dry_run:
        print(f"  would-write {path.relative_to(root)}")
        return True
    try:
        path.write_text(updated, encoding="utf-8")
    except OSError as exc:
        sys.stderr.write(f"shell-template: write failed for {path}: {exc}\n")
        sys.exit(3)
    print(f"  wrote {path.relative_to(root)}  (aria-label={label!r})")
    return True


def regenerate_home(
    root: Path,
    *,
    skip_html: str,
    header_html: str,
    footer_html: str,
    palette_html: str,
    settings_html: str,
    help_html: str,
    head_script: str,
    tools_json_inline: str,
    storage_registry_manifest: str,
    dry_run: bool,
) -> bool:
    """Replace index.html's FOUC script, skip link, header, footer chrome,
    palette include, settings include, inline tools.json fallback, AND
    the storage-registry manifest block in place, preserving the home
    grid content unchanged. Brand link uses href="#top" (home-relative).
    The inline tools.json block is wrapped in
    `<!-- ht:tools-json-inline-start -->…<!-- ht:tools-json-inline-end -->`
    markers; the manifest block uses
    `<!-- ht:storage-registry-manifest-start -->…<!-- ht:storage-registry-manifest-end -->`.
    Both are byte-matched by `scripts/shell-drift-check.py`. (Stories 1.9 + 1.10.)"""
    path = root / "index.html"
    if not path.is_file():
        sys.stderr.write(f"shell-template: missing home page {path}\n")
        return False
    source = path.read_text(encoding="utf-8")

    home_header = header_html.replace('href="../../index.html"', 'href="#top"')
    has_new_chrome = (
        '<a class="shell-skip"' in source
        and 'class="site-header" role="banner"' in source
        and '<footer class="site-footer" role="contentinfo"' in source
        and 'src="assets/js/shell.js"' in source
    )
    palette_html_in_source = palette_html in source
    settings_html_in_source = settings_html in source
    # Story 3.3: the help overlay (UX-DR-6, FR-7) is mounted on every page.
    help_html_in_source = help_html in source
    # The home-grid.js include is part of the byte-aligned contract as of
    # Story 1.9 — without it the renderer never runs and the data-driven
    # section stays hidden forever.
    home_grid_js_in_source = (
        'src="assets/js/home-grid.js"' in source
    )
    tools_json_inline_in_source = tools_json_inline in source
    storage_registry_manifest_in_source = storage_registry_manifest in source
    # Story 1.10: the storage-registry.js script tag is part of the
    # byte-aligned contract — without it the wrapper's delegation target
    # never loads and theme.js boots without a registered ht.theme.
    storage_registry_js_in_source = (
        'src="assets/js/storage-registry.js"' in source
    )
    # Story 1.11: search.js is part of the home-page contract — without
    # it the home search input (UX-DR-6) has no engine to consume and
    # the API surface (HT.search) is undefined.
    search_js_in_source = (
        'src="assets/js/search.js"' in source
    )
    # Story 3.2: palette-actions.js MUST load BEFORE shell.js so
    # HT_PALETTE_ACTIONS is defined when shell.js boots and consumes
    # the array into the `_actions` registry. The home page uses the
    # root-relative path (no `../../`) because it lives at the repo root.
    palette_actions_js_in_source = (
        'src="assets/js/palette-actions.js"' in source
    )
    # Story 1.12: site-config.js must load BEFORE storage-registry.js so
    # HT.siteConfig is defined before any module consults it. The home
    # page uses the root-relative path (no `../../`) because it lives at
    # the repo root.
    site_config_js_in_source = (
        'src="assets/js/site-config.js"' in source
    )
    site_config_first_in_source = (
        'src="assets/js/site-config.js"' not in source
        or 'src="assets/js/storage-registry.js"' not in source
        or source.find('src="assets/js/site-config.js"')
        < source.find('src="assets/js/storage-registry.js"')
    )
    # Bug fix: a previous broken regeneration can leave a SECOND
    # palette/settings include stranded in the page (the byte-aligned
    # check above only requires "at least one" include, not "exactly
    # one"). Count occurrences of the unique include id and require
    # exactly one — the canonical rewrite will replace it. Two palette
    # nodes would silently produce 2 listboxes + 2 comboboxes and
    # double every shell-a11y-check.py palette assertion.
    palette_count_in_source = source.count('class="shell-palette" id="palette"')
    settings_count_in_source = source.count('id="shell-settings-modal"')
    palette_count_ok = palette_count_in_source == 1
    settings_count_ok = settings_count_in_source == 1
    byte_aligned = (
        has_new_chrome
        and home_header in source
        and footer_html in source
        and palette_html_in_source
        and settings_html_in_source
        and help_html_in_source
        and palette_count_ok
        and settings_count_ok
        and home_grid_js_in_source
        and tools_json_inline_in_source
        and storage_registry_manifest_in_source
        and storage_registry_js_in_source
        and search_js_in_source
        and palette_actions_js_in_source
        and site_config_js_in_source
        and site_config_first_in_source
    )
    # Also require the canonical FOUC IIFE byte sequence to be present.
    # Without this, a home page that was generated before Story 1.5
    # added the PerformanceObserver / ht:fouc-resolved instrumentation
    # would slip through the byte-aligned check and ship a stale IIFE —
    # exactly the regression the post-1.5 review identified.
    # (Story 1.6: this comparison had a latent bug — `head_script` is the
    # wrapped `<script>...</script>` form while `iife_match.group(1)` is
    # the inner content only. They never matched, so the IIFE was
    # re-rewritten on every --home invocation, doubling `<script>` tags
    # over multiple regenerations. Compare inner-to-inner.)
    iife_match = re.search(
        r"(?:<script>\s*)+([^<]+?)(?:\s*</script>)+",
        source,
        re.IGNORECASE | re.DOTALL,
    )
    head_inner = re.sub(r"^<script>|</script>$", "", head_script).strip()
    iife_ok = bool(iife_match) and iife_match.group(1).strip() == head_inner
    # Count nested wrappers: a home page that came out of Story 1.5's
    # broken regeneration has 1 <script> open + 3 </script> closes (the
    # rewritten inner content captured the trailing close, leaving 2
    # orphans). The normalized form is exactly 1 + 1.
    nested_count = 0
    if iife_match:
        nested_count = max(
            len(re.findall(r"<script>", iife_match.group(0), re.IGNORECASE)),
            len(re.findall(r"</script>", iife_match.group(0), re.IGNORECASE)),
        )
    if byte_aligned and iife_ok and nested_count <= 1:
        print(f"  no-change {path.relative_to(root)}  (already has new chrome)")
        return True

    # Bug fix: chrome is byte-aligned and the IIFE is canonical, but the
    # home page has DUPLICATE palette/settings include blocks left over
    # from an earlier broken regeneration. Strip every marker-delimited
    # palette/settings block and re-append the canonical ones after
    # </footer>. The home page's chrome grid is left untouched. This
    # must run BEFORE the IIFE-only branch (which would otherwise be a
    # no-op on these pages, leaving the duplicates in place).
    if (
        has_new_chrome
        and home_header in source
        and footer_html in source
        and (not palette_count_ok or not settings_count_ok)
    ):
        footer_end = source.find('</footer>')
        if footer_end == -1:
            sys.stderr.write(
                f"shell-template: home page chrome byte-aligned but </footer> not found\n"
            )
            return False
        insert_at = footer_end + len('</footer>')
        new_source = strip_duplicate_includes(source)
        trailing = "\n\n  " + palette_html + "\n\n  " + settings_html + "\n\n  " + help_html
        new_source = new_source[:insert_at] + trailing + new_source[insert_at:]
        if new_source == source:
            print(f"  no-change {path.relative_to(root)}")
            return True
        if dry_run:
            print(
                f"  would-write {path.relative_to(root)}  "
                f"(dedupe palette={palette_count_in_source}→1, "
                f"settings={settings_count_in_source}→1)"
            )
            return True
        try:
            path.write_text(new_source, encoding="utf-8")
        except OSError as exc:
            sys.stderr.write(
                f"shell-template: write failed for {path}: {exc}\n"
            )
            sys.exit(3)
        print(
            f"  wrote {path.relative_to(root)}  "
            f"(dedupe palette={palette_count_in_source}→1, "
            f"settings={settings_count_in_source}→1)"
        )
        return True

    # Chrome is byte-aligned but the inline FOUC IIFE in <head> is stale
    # (the home page was generated before the PerformanceObserver /
    # ht:fouc-resolved instrumentation landed in head-snippet.html).
    # Rewrite only the inner IIFE content in place — keep the surrounding
    # `<script>` / `</script>` tags intact. Touching the body content via
    # the byte-aligned region rewrite below would clobber the home grid
    # (see dev-agent note: "Home page body regression after --home
    # regeneration" in the Story 1.5 spec).
    if byte_aligned and iife_match and (not iife_ok or nested_count > 1):
        new_source = (
            source[: iife_match.start()]
            + "<script>" + " " + head_inner + " " + "</script>"
            + source[iife_match.end():]
        )
        if new_source == source:
            print(f"  no-change {path.relative_to(root)}")
            return True
        if dry_run:
            print(f"  would-write {path.relative_to(root)}  (IIFE only)")
            return True
        try:
            path.write_text(new_source, encoding="utf-8")
        except OSError as exc:
            sys.stderr.write(f"shell-template: write failed for {path}: {exc}\n")
            sys.exit(3)
        if nested_count > 1:
            print(f"  wrote {path.relative_to(root)}  (normalized {nested_count} nested <script> wrappers → 1)")
        else:
            print(f"  wrote {path.relative_to(root)}  (IIFE only)")
        return True

    # If chrome is byte-aligned but a static-include region (palette or
    # settings) is missing, inject the missing piece(s) after </footer>
    # in place. Same minimal-write pattern as the IIFE-only path above —
    # the home grid is left untouched.
    #
    # The condition is intentionally WEAKER than `byte_aligned` (which
    # also requires palette_html_in_source AND settings_html_in_source):
    # when only the palette or only the settings is missing, the
    # byte-aligned region rewrite below would nuke the entire <main>
    # body that lives between the chrome markers. Test chrome bytes
    # independently of include presence, then short-circuit here whenever
    # the only delta is a missing include.
    chrome_only_aligned = (
        has_new_chrome
        and home_header in source
        and footer_html in source
    )
    if chrome_only_aligned and not (
        palette_html_in_source
        and settings_html_in_source
        and help_html_in_source
        and home_grid_js_in_source
        and tools_json_inline_in_source
        and storage_registry_manifest_in_source
        and storage_registry_js_in_source
        and search_js_in_source
        and palette_actions_js_in_source
        and site_config_js_in_source
        and site_config_first_in_source
    ):
        footer_end = source.find('</footer>')
        if footer_end == -1:
            sys.stderr.write(
                f"shell-template: home page chrome byte-aligned but </footer> not found in {path}\n"
            )
            return False
        insert_at = footer_end + len('</footer>')
        # Always strip existing palette/settings/help includes from the
        # chrome tail before splicing in the canonical blocks. Without
        # this strip, a stale palette (e.g. from before Story 3.1 added
        # the live region + chord hints) stays in the file alongside the
        # new canonical include — producing two `<div class="shell-palette"
        # id="palette">` elements and 2 listboxes + 2 comboboxes (UX-DR-19
        # violation). The strip is bounded by `_STOP_BOUNDARY` so it
        # cannot consume the trailing script tag block. Idempotent: if
        # palette + settings + help are already canonical, the strip
        # yields empty and the splice yields the same content back.
        new_source = strip_duplicate_includes(source)
        trailing = "\n\n  " + palette_html + "\n\n  " + settings_html + "\n\n  " + help_html
        new_source = new_source[:insert_at] + trailing + new_source[insert_at:]

        # Story 1.9: same short-circuit pattern as the chrome_only_aligned
        # branch above. If the inline tools.json block (file:// fallback)
        # is missing OR its bytes have drifted from tools.json, splice the
        # canonical block between `ht:tools-json-inline-start` /
        # `-end` markers — or, if the markers are absent, before the
        # home-grid.js script tag (preserving existing marker-free
        # sources until a future regeneration adds them).
        if tools_json_inline_in_source:
            json_ok = True
        else:
            json_ok = False
            start_match = (
                TOOLS_JSON_INLINE_START in source
                and TOOLS_JSON_INLINE_END in source
            )
            if start_match:
                new_source, n = TOOLS_JSON_INLINE_RE.subn(
                    tools_json_inline, new_source, count=1
                )
                if n == 0:
                    sys.stderr.write(
                        "shell-template: tools.json inline markers found but "
                        "byte-aligned rewrite could not anchor\n"
                    )
                    return False
                json_ok = True
            else:
                # Markers absent — inject as a block before the home-grid.js
                # script tag so the inline JSON lives near other late-bound
                # shell includes. The next regeneration adds the markers
                # via the full-rewrite path below.
                anchor = '<script src="assets/js/home-grid.js" defer></script>'
                if anchor in new_source:
                    new_source = new_source.replace(
                        anchor,
                        tools_json_inline + "\n\n  " + anchor,
                        1,
                    )
                    json_ok = True
                elif home_grid_js_in_source:
                    # home-grid.js was already present (no further rewrite
                    # needed for the script tag) but the inline JSON
                    # markers are missing — splice the tools_json_inline
                    # block immediately before the existing home-grid.js
                    # script tag.
                    new_source = new_source.replace(
                        anchor,
                        tools_json_inline + "\n\n  " + anchor,
                        1,
                    )
                    json_ok = True
                else:
                    sys.stderr.write(
                        "shell-template: tools.json inline JSON block could not "
                        "be anchored; home-grid.js script tag missing\n"
                    )
                    return False

        # Story 1.10: splice the storage-registry manifest block. The
        # block lives between `ht:storage-registry-manifest-start` /
        # `-end` markers (mirroring chrome.html) and is anchored just
        # before the home-grid.js script tag when the markers are
        # absent.
        #
        # Review finding: previously the splice ran unconditionally if
        # markers were present. A tool page that accidentally acquired
        # the markers (e.g., a copy-paste from chrome.html) would have
        # its unrelated content silently overwritten. We now hash the
        # existing block (if any) and refuse to overwrite content
        # that's neither the canonical block nor an empty block —
        # either the dev agent regenerates chrome.html and re-runs the
        # template, or they remove the markers by hand.
        if storage_registry_manifest_in_source:
            manifest_ok = True
        else:
            manifest_ok = False
            if (
                REGISTRY_MANIFEST_INLINE_START in source
                and REGISTRY_MANIFEST_INLINE_END in source
            ):
                # Compare the existing block to the canonical bytes. If
                # they differ, the block was hand-edited or accidentally
                # pasted; refuse to silently overwrite.
                existing_match = REGISTRY_MANIFEST_INLINE_RE.search(source)
                if existing_match is not None:
                    existing_bytes = existing_match.group(0)
                    canonical_bytes = storage_registry_manifest
                    if (
                        existing_bytes != canonical_bytes
                        and existing_bytes.strip() != REGISTRY_MANIFEST_INLINE_START + REGISTRY_MANIFEST_INLINE_END
                    ):
                        sys.stderr.write(
                            "shell-template: storage-registry manifest block "
                            "is present but does NOT match the canonical bytes "
                            "from chrome.html. Refusing to silently overwrite — "
                            "edit chrome.html and re-run, or remove the "
                            "markers by hand if this was accidental.\n"
                        )
                        return False
                new_source, n = REGISTRY_MANIFEST_INLINE_RE.subn(
                    storage_registry_manifest, new_source, count=1
                )
                if n == 0:
                    sys.stderr.write(
                        "shell-template: storage-registry manifest markers "
                        "found but byte-aligned rewrite could not anchor\n"
                    )
                    return False
                manifest_ok = True
            else:
                anchor = '<script src="assets/js/home-grid.js" defer></script>'
                if anchor in new_source:
                    new_source = new_source.replace(
                        anchor,
                        storage_registry_manifest + "\n\n  " + anchor,
                        1,
                    )
                    manifest_ok = True
                else:
                    sys.stderr.write(
                        "shell-template: storage-registry manifest block "
                        "could not be anchored; home-grid.js script tag missing\n"
                    )
                    return False

        # Ensure the home-grid.js script tag is loaded.
        if not home_grid_js_in_source and 'src="assets/js/home-grid.js"' not in new_source:
            anchor = '<script src="assets/js/shell.js" defer></script>'
            if anchor in new_source:
                new_source = new_source.replace(
                    anchor,
                    anchor + '\n  <script src="assets/js/home-grid.js" defer></script>',
                    1,
                )

        # Story 1.11: ensure search.js is loaded on the home page too.
        # Anchored after shell.js so the Shell API surface (HT.search
        # contract entry) is in place when search.js boots.
        if 'src="assets/js/search.js"' not in new_source:
            shell_anchor = '<script src="assets/js/shell.js" defer></script>'
            if shell_anchor in new_source:
                new_source = new_source.replace(
                    shell_anchor,
                    shell_anchor + '\n  <script src="assets/js/search.js" defer></script>',
                    1,
                )

        # Story 3.2: palette-actions.js MUST load BEFORE shell.js on
        # the home page too so HT_PALETTE_ACTIONS is defined when
        # shell.js boots and consumes the array into `_actions`.
        # Idempotent — anchored immediately before shell.js.
        if 'src="assets/js/palette-actions.js"' not in new_source:
            shell_anchor = '<script src="assets/js/shell.js" defer></script>'
            if shell_anchor in new_source:
                new_source = new_source.replace(
                    shell_anchor,
                    '<script src="assets/js/palette-actions.js"></script>\n  '
                    + shell_anchor,
                    1,
                )

        # Story 3.3: help-overlay.js on the home page too (root-relative
        # path because the home page lives at the repo root). Anchored
        # after search.js so the boot order is deterministic.
        if 'src="assets/js/help-overlay.js"' not in new_source:
            search_anchor = '<script src="assets/js/search.js" defer></script>'
            if search_anchor in new_source:
                new_source = new_source.replace(
                    search_anchor,
                    search_anchor
                    + '\n  <script src="assets/js/help-overlay.js" defer></script>',
                    1,
                )

        # Story 1.10: ensure storage-registry.js is loaded BEFORE utils.js
        # so the wrapper can delegate. The registry IIFE runs synchronously
        # at script-load (no defer) and registers ht.theme before theme.js
        # boots, satisfying the FOUC IIFE's plain-string read path.
        if 'src="assets/js/storage-registry.js"' not in new_source:
            utils_anchor = '<script src="assets/js/utils.js"></script>'
            if utils_anchor in new_source:
                new_source = new_source.replace(
                    utils_anchor,
                    '<script src="assets/js/storage-registry.js"></script>\n  '
                    + utils_anchor,
                    1,
                )

        # Story 1.12: ensure site-config.js is loaded BEFORE
        # storage-registry.js so HT.siteConfig is defined when the
        # registry IIFE runs (and before shell.js boots so the
        # wireViewSourceLink wiring in shell.js can read
        # HT.siteConfig.blobBase). Idempotent — only added on first
        # regeneration when the script tag is absent.
        if 'src="assets/js/site-config.js"' not in new_source:
            site_tag = '<script src="assets/js/site-config.js"></script>'
            storage_tag = '<script src="assets/js/storage-registry.js"></script>'
            utils_tag = '<script src="assets/js/utils.js"></script>'
            if storage_tag in new_source:
                new_source = new_source.replace(
                    storage_tag, site_tag + "\n  " + storage_tag, 1
                )
            elif utils_tag in new_source:
                new_source = new_source.replace(
                    utils_tag, site_tag + "\n  " + utils_tag, 1
                )

        if new_source == source:
            print(f"  no-change {path.relative_to(root)}")
            return True
        if dry_run:
            missing = []
            if not palette_html_in_source:
                missing.append("palette")
            if not settings_html_in_source:
                missing.append("settings")
            if not help_html_in_source:
                missing.append("help")
            if not home_grid_js_in_source:
                missing.append("home-grid.js")
            if not tools_json_inline_in_source:
                missing.append("tools.json-inline")
            if not storage_registry_manifest_in_source:
                missing.append("storage-registry-manifest")
            if 'src="assets/js/storage-registry.js"' not in new_source:
                missing.append("storage-registry.js")
            if 'src="assets/js/search.js"' not in new_source:
                missing.append("search.js")
            if 'src="assets/js/palette-actions.js"' not in new_source:
                missing.append("palette-actions.js")
            if 'src="assets/js/help-overlay.js"' not in new_source:
                missing.append("help-overlay.js")
            if 'src="assets/js/site-config.js"' not in new_source:
                missing.append("site-config.js")
            print(
                f"  would-write {path.relative_to(root)}  ({' + '.join(missing)})"
            )
            return True
        try:
            path.write_text(new_source, encoding="utf-8")
        except OSError as exc:
            sys.stderr.write(f"shell-template: write failed for {path}: {exc}\n")
            sys.exit(3)
        missing = []
        if not palette_html_in_source:
            missing.append("palette")
        if not settings_html_in_source:
            missing.append("settings")
        if not help_html_in_source:
            missing.append("help")
        # Review finding: the previous implementation had an `if ...
        # pass` dead-code branch here, plus a check that the home-grid
        # script tag appeared in the splice delta. The dead branch
        # caused confusing "wrote <path> ()" logs (an empty `missing`
        # list, with no actual changes flagged). Simplified: we trust
        # the splice to do its job; only flag what's actually missing
        # in the FINAL source.
        if not tools_json_inline_in_source:
            missing.append("tools.json-inline")
        if not storage_registry_manifest_in_source:
            missing.append("storage-registry-manifest")
        if 'src="assets/js/storage-registry.js"' not in source:
            missing.append("storage-registry.js")
        if 'src="assets/js/search.js"' not in source:
            missing.append("search.js")
        if 'src="assets/js/palette-actions.js"' not in source:
            missing.append("palette-actions.js")
        if 'src="assets/js/help-overlay.js"' not in source:
            missing.append("help-overlay.js")
        if 'src="assets/js/site-config.js"' not in source:
            missing.append("site-config.js")
        print(f"  wrote {path.relative_to(root)}  ({' + '.join(missing)})")
        return True

    new_source = source

    # Replace the FOUC script in <head> if legacy IIFE is present.
    new_source, _ = LEGACY_FOUC_RE.subn(head_script + "\n\n  ", new_source, count=1)

    if has_new_chrome and not (
        home_header in source and footer_html in source
    ):
        # Already has the new chrome markers but the chrome bytes differ
        # — do an in-place region replace so the page aligns byte-for-byte
        # with chrome.html. We anchor on the `<a class="shell-skip">` start
        # and the `</footer>` close, then append the palette include
        # after the footer so the palette overlay is mounted on every
        # page.
        # Bug fix: a previous broken regeneration can leave a SECOND
        # palette include block stranded below </footer> in the preserved
        # tail. Strip every marker-delimited palette/settings block first
        # so the rewrite produces exactly one canonical include.
        new_source = strip_duplicate_includes(source)
        new_chrome = (
            skip_html + "\n  " + home_header + "\n  "
            + footer_html + "\n\n  " + palette_html + "\n\n  "
            + settings_html + "\n\n  " + help_html + "\n\n  "
        )
        anchor_start = new_source.find('<a class="shell-skip"')
        anchor_end = new_source.find('</footer>', anchor_start)
        if anchor_start == -1 or anchor_end == -1:
            sys.stderr.write(
                "shell-template: home page chrome markers found but cannot anchor "
                "byte-aligned rewrite\n"
            )
            return False
        anchor_end += len('</footer>')
        new_source = new_source[:anchor_start] + new_chrome + new_source[anchor_end:]
    else:
        # Legacy path: replace <div id="site-header"></div> with skip+header.
        new_header_block = skip_html + "\n  " + home_header + "\n  "
        new_source, n = LEGACY_HEADER_RE.subn(new_header_block, new_source, count=1)
        if n == 0:
            sys.stderr.write(
                "shell-template: home page <div id=\"site-header\"></div> not found\n"
            )
            return False

        # Wrap <main> with id + aria-label + class.
        def _main_repl(match: re.Match[str]) -> str:
            body = match.group("body")
            attrs = match.group("attrs") or ""
            attrs = re.sub(r"\s+class=\"[^\"]*\"", "", attrs)
            attrs = re.sub(r"\s+id=\"[^\"]*\"", "", attrs)
            attrs = re.sub(r"\s+aria-label=\"[^\"]*\"", "", attrs)
            return (
                f'<main id="main" class="shell-main"{attrs} '
                f'aria-label="Handy Tools home" tabindex="-1">'
                f'\n    <a id="top"></a>\n    '
                + body.rstrip()
                + "\n  </main>"
            )

        new_source, _ = LEGACY_MAIN_RE.subn(_main_repl, new_source, count=1)

        # Replace <div id="site-footer"></div> with footer chrome and
        # append the palette and settings includes as sibling regions
        # (Story 1.7 palette, Story 1.8 settings, Story 3.3 help).
        new_source, _ = LEGACY_FOOTER_RE.subn(
            footer_html
            + "\n\n  " + palette_html + "\n\n  "
            + settings_html + "\n\n  " + help_html + "\n\n  ",
            new_source,
            count=1,
        )

    # Remove theme.js and layout.js script tags.
    home_theme_re = re.compile(
        r"<script src=\"assets/js/theme\.js\"></script>\s*", re.IGNORECASE
    )
    home_layout_re = re.compile(
        r"<script src=\"assets/js/layout\.js\"></script>\s*", re.IGNORECASE
    )
    new_source = home_theme_re.sub("", new_source)
    new_source = home_layout_re.sub("", new_source)
    if 'src="assets/js/shell.js"' not in new_source:
        new_source = new_source.replace(
            '<script src="assets/js/utils.js"></script>',
            '<script src="assets/js/utils.js"></script>\n  '
            '<script src="assets/js/shell.js" defer></script>',
        )
    # Story 3.2: palette-actions.js MUST load BEFORE shell.js so
    # HT_PALETTE_ACTIONS is defined when shell.js boots and consumes
    # the array into the `_actions` registry. Idempotent — anchored
    # immediately before shell.js.
    if 'src="assets/js/palette-actions.js"' not in new_source:
        shell_anchor = '<script src="assets/js/shell.js" defer></script>'
        if shell_anchor in new_source:
            new_source = new_source.replace(
                shell_anchor,
                '<script src="assets/js/palette-actions.js"></script>\n  '
                + shell_anchor,
                1,
            )
    # Story 1.10: storage-registry.js must load BEFORE utils.js so the
    # storage wrapper can delegate. Idempotent — only added on first
    # regeneration when the script tag is absent.
    if 'src="assets/js/storage-registry.js"' not in new_source:
        new_source = new_source.replace(
            '<script src="assets/js/utils.js"></script>',
            '<script src="assets/js/storage-registry.js"></script>\n  '
            '<script src="assets/js/utils.js"></script>',
        )
    # Story 1.12: site-config.js must load BEFORE storage-registry.js so
    # HT.siteConfig is defined before any module consults it. Idempotent —
    # only added on first regeneration when the script tag is absent.
    if 'src="assets/js/site-config.js"' not in new_source:
        site_tag = '<script src="assets/js/site-config.js"></script>'
        storage_tag = '<script src="assets/js/storage-registry.js"></script>'
        utils_tag = '<script src="assets/js/utils.js"></script>'
        if storage_tag in new_source:
            new_source = new_source.replace(
                storage_tag, site_tag + "\n  " + storage_tag, 1
            )
        elif utils_tag in new_source:
            new_source = new_source.replace(
                utils_tag, site_tag + "\n  " + utils_tag, 1
            )
    # Story 1.9: ensure the data-driven section script tag and the inline
    # tools.json fallback are present on the home page. The home-grid.js
    # script is loaded as a sibling of shell.js; the inline JSON block is
    # inserted just before it (so the JSON parse and DOM read happen before
    # the renderer mounts — the file:// fallback path uses the inline
    # block, not a network fetch).
    if 'src="assets/js/home-grid.js"' not in new_source:
        anchor = '<script src="assets/js/shell.js" defer></script>'
        if anchor in new_source:
            new_source = new_source.replace(
                anchor,
                anchor + '\n  <script src="assets/js/home-grid.js" defer></script>',
                1,
            )
    # Always splice the canonical inline tools.json block (idempotent
    # when block matches). If the markers are absent, inject as a free-
    # standing block before the home-grid.js script tag — the next
    # regeneration normalizes to the marker-delimited form.
    if (
        TOOLS_JSON_INLINE_START in new_source
        and TOOLS_JSON_INLINE_END in new_source
    ):
        new_source, _ = TOOLS_JSON_INLINE_RE.subn(
            tools_json_inline, new_source, count=1
        )
    else:
        anchor = '<script src="assets/js/home-grid.js" defer></script>'
        if anchor in new_source:
            new_source = new_source.replace(
                anchor,
                tools_json_inline + "\n\n  " + anchor,
                1,
            )

    # Story 1.10: always splice the storage-registry manifest block. Same
    # shape as the tools.json block — marker-delimited when present, free-
    # standing before the home-grid.js script tag when the markers are
    # absent. The drift check (scripts/shell-drift-check.py) byte-matches
    # the manifest region on index.html, so this splice must run on every
    # regeneration regardless of whether chrome-only alignment was needed.
    if (
        REGISTRY_MANIFEST_INLINE_START in new_source
        and REGISTRY_MANIFEST_INLINE_END in new_source
    ):
        new_source, _ = REGISTRY_MANIFEST_INLINE_RE.subn(
            storage_registry_manifest, new_source, count=1
        )
    else:
        anchor = '<script src="assets/js/home-grid.js" defer></script>'
        if anchor in new_source:
            new_source = new_source.replace(
                anchor,
                storage_registry_manifest + "\n\n  " + anchor,
                1,
            )

    if new_source == source:
        print(f"  no-change {path.relative_to(root)}")
        return True
    if dry_run:
        print(f"  would-write {path.relative_to(root)}")
        return True
    try:
        path.write_text(new_source, encoding="utf-8")
    except OSError as exc:
        sys.stderr.write(f"shell-template: write failed for {path}: {exc}\n")
        sys.exit(3)
    print(f"  wrote {path.relative_to(root)}  (home page)")
    return True


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("--tool", help="regenerate only this tool slug")
    parser.add_argument(
        "--home",
        action="store_true",
        help="regenerate the home page (index.html)",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="print plan, do not write"
    )
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
    skip_html, header_html, footer_html, palette_html, settings_html, help_html = read_chrome(root)
    head_script = read_head_snippet(root)
    tools_json_inline = read_tools_json_inline(root)
    storage_registry_manifest = read_storage_registry_manifest(root)

    failures = 0

    if args.home:
        print("shell-template: regenerating home page")
        if not regenerate_home(
            root,
            skip_html=skip_html,
            header_html=header_html,
            footer_html=footer_html,
            palette_html=palette_html,
            settings_html=settings_html,
            help_html=help_html,
            head_script=head_script,
            tools_json_inline=tools_json_inline,
            storage_registry_manifest=storage_registry_manifest,
            dry_run=args.dry_run,
        ):
            failures += 1
        print(f"shell-template: done (home: {'ok' if failures == 0 else 'failed'})")
        return 0 if failures == 0 else 1

    tools_dir = root / "tools"
    if not tools_dir.is_dir():
        sys.stderr.write(f"shell-template: missing tools directory {tools_dir}\n")
        sys.exit(2)

    if args.tool:
        slugs = [args.tool]
    else:
        slugs = sorted(p.name for p in tools_dir.iterdir() if p.is_dir())

    print(f"shell-template: regenerating {len(slugs)} tool page(s)")
    for slug in slugs:
        if not process_file(
            root,
            slug,
            skip_html=skip_html,
            header_html=header_html,
            footer_html=footer_html,
            palette_html=palette_html,
            settings_html=settings_html,
            help_html=help_html,
            head_script=head_script,
            tools_json_inline=tools_json_inline,
            dry_run=args.dry_run,
        ):
            failures += 1
    print(
        f"shell-template: done ({len(slugs) - failures} ok, {failures} failed)"
    )
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))