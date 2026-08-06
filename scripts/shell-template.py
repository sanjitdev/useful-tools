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


def read_chrome(root: Path) -> tuple[str, str, str, str, str]:
    """Return (skip_link_html, header_html, footer_html, palette_html, settings_html).

    The canonical chrome contains a <main ... aria-label="{page_label}"> with
    a `{body}` placeholder. We extract the regions surrounding that
    placeholder so each tool page gets a copy with its own label and body.
    The palette region (Story 1.7) and settings region (Story 1.8) are
    separate canonical sources that are injected after the footer on every
    page so the overlays are single shared DOM nodes.
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

    return skip_html, header_html, footer_html, palette_html, settings_html


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
    skip_html: str,
    header_html: str,
    footer_html: str,
    palette_html: str,
    settings_html: str,
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
        if (
            '<a class="shell-skip"' in new_source
            and '</footer>' in new_source
            and (header_html not in new_source or footer_html not in new_source)
        ):
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
                + settings_html + "\n\n  "
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
            return new_source
        sys.stderr.write(
            "shell-template: <div id=\"site-header\"></div> marker not found\n"
        )
        return source

    # 3. Wrap the existing <main> with id + aria-label + class.
    def _main_repl(match: re.Match[str]) -> str:
        body = match.group("body")
        attrs = match.group("attrs") or ""
        attrs = re.sub(r"\s+class=\"[^\"]*\"", "", attrs)
        attrs = re.sub(r"\s+id=\"[^\"]*\"", "", attrs)
        attrs = re.sub(r"\s+aria-label=\"[^\"]*\"", "", attrs)
        return (
            f'<main id="main" class="shell-main"{attrs} '
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

    return new_source


def page_label_from_title(title_match: re.Match[str]) -> str:
    return derive_display_name(title_match.group(1))


def process_file(
    root: Path,
    slug: str,
    *,
    skip_html: str,
    header_html: str,
    footer_html: str,
    palette_html: str,
    settings_html: str,
    head_script: str,
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
        r'<main\s+id="main"\s+class="shell-main"\s+aria-label="([^"]+)"\s+tabindex="-1">',
        re.IGNORECASE,
    )
    label_match = label_re.search(source)
    label_ok = bool(label_match) and label_match.group(1).strip() == expected_label
    chrome_ok = (
        '<a class="shell-skip"' in source
        and 'class="site-header" role="banner"' in source
        and '<footer class="site-footer" role="contentinfo"' in source
        and '<main id="main" class="shell-main"' in source
        and 'src="../../assets/js/shell.js"' in source
        and header_html in source
        and footer_html in source
    )
    palette_ok = palette_html in source
    settings_ok = settings_html in source
    full_ok = chrome_ok and palette_ok and settings_ok
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

    # If chrome is byte-aligned but the palette and/or settings include is
    # missing (Story 1.7 added palette, Story 1.8 added settings), inject
    # whichever is missing after </footer> in place. We anchor on the end
    # of the footer so the rest of the page (including the IIFE block,
    # script tags, and any additional trailing content) is left untouched.
    # This must run BEFORE the IIFE-only path below because that path's
    # `iife_ok` gate is currently over-strict (it compares against group(1)
    # rather than group(2) — a latent Story 1.6 bug) and would short-circuit
    # on a correct IIFE, preventing the palette splice from ever firing.
    if chrome_ok and not (palette_ok and settings_ok):
        footer_end = source.find('</footer>')
        if footer_end == -1:
            sys.stderr.write(
                f"shell-template: chrome byte-aligned but </footer> not found in {path}\n"
            )
            return False
        insert_at = footer_end + len('</footer>')
        # Build the trailing splice: palette first (if missing), then
        # settings (if missing). Pages that need both get one rewrite;
        # pages that need only settings get a smaller delta.
        trailing = ""
        if not palette_ok:
            trailing += "\n\n  " + palette_html
        if not settings_ok:
            trailing += "\n\n  " + settings_html
        new_source = source[:insert_at] + trailing + source[insert_at:]
        if new_source == source:
            print(f"  no-change {path.relative_to(root)}")
            return True
        if dry_run:
            missing = []
            if not palette_ok: missing.append("palette")
            if not settings_ok: missing.append("settings")
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
        print(f"  wrote {path.relative_to(root)}  ({' + '.join(missing)})")
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
    head_script: str,
    dry_run: bool,
) -> bool:
    """Replace index.html's FOUC script, skip link, header, footer chrome,
    palette include, and settings include in-place, preserving the home
    grid content unchanged. Brand link uses href="#top" (home-relative)."""
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
    byte_aligned = (
        has_new_chrome
        and home_header in source
        and footer_html in source
        and palette_html_in_source
        and settings_html_in_source
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
    if chrome_only_aligned and not (palette_html_in_source and settings_html_in_source):
        footer_end = source.find('</footer>')
        if footer_end == -1:
            sys.stderr.write(
                f"shell-template: home page chrome byte-aligned but </footer> not found in {path}\n"
            )
            return False
        insert_at = footer_end + len('</footer>')
        trailing = ""
        if not palette_html_in_source:
            trailing += "\n\n  " + palette_html
        if not settings_html_in_source:
            trailing += "\n\n  " + settings_html
        new_source = source[:insert_at] + trailing + source[insert_at:]
        if new_source == source:
            print(f"  no-change {path.relative_to(root)}")
            return True
        if dry_run:
            missing = []
            if not palette_html_in_source:
                missing.append("palette")
            if not settings_html_in_source:
                missing.append("settings")
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
        new_chrome = (
            skip_html + "\n  " + home_header + "\n  "
            + footer_html + "\n\n  " + palette_html + "\n\n  "
            + settings_html + "\n\n  "
        )
        anchor_start = source.find('<a class="shell-skip"')
        anchor_end = source.find('</footer>', anchor_start)
        if anchor_start == -1 or anchor_end == -1:
            sys.stderr.write(
                "shell-template: home page chrome markers found but cannot anchor "
                "byte-aligned rewrite\n"
            )
            return False
        anchor_end += len('</footer>')
        new_source = source[:anchor_start] + new_chrome + source[anchor_end:]
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
        # (Story 1.7 palette, Story 1.8 settings).
        new_source, _ = LEGACY_FOOTER_RE.subn(
            footer_html
            + "\n\n  " + palette_html + "\n\n  "
            + settings_html + "\n\n  ",
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
    skip_html, header_html, footer_html, palette_html, settings_html = read_chrome(root)
    head_script = read_head_snippet(root)

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
            head_script=head_script,
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
            head_script=head_script,
            dry_run=args.dry_run,
        ):
            failures += 1
    print(
        f"shell-template: done ({len(slugs) - failures} ok, {failures} failed)"
    )
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))