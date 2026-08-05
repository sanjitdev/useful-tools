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

CHROME_SKIP_RE = re.compile(
    r"<a class=\"shell-skip\"[^>]*>.*?</a>\s*", re.DOTALL
)
CHROME_HEADER_RE = re.compile(
    r"<!-- shell:header -->\s*(.*?)\s*<!-- /shell:header -->", re.DOTALL
)
CHROME_FOOTER_RE = re.compile(
    r"<!-- shell:footer -->\s*(.*?)\s*<!-- /shell:footer -->", re.DOTALL
)


def read_chrome(root: Path) -> tuple[str, str, str]:
    """Return (skip_link_html, header_html, footer_html).

    The canonical chrome contains a <main ... aria-label="{page_label}"> with
    a `{body}` placeholder. We extract the three regions surrounding that
    placeholder so each tool page gets a copy with its own label and body.
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
    # The canonical chrome template uses relative href "../../index.html" in
    # the brand link because chrome.html sits under assets/shell/. Tool pages
    # also need the relative "../../" prefix, so this rewrite is a no-op for
    # them; we keep the template literal so a future Story may rewrite both
    # copies in one place if the brand-link target ever changes.
    return skip_html, header_html, footer_html


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
                + footer_html + "\n\n  "
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

    # 4. Replace <div id="site-footer"></div> with the footer chrome.
    new_source, n = LEGACY_FOOTER_RE.subn(
        footer_html + "\n\n  ", new_source, count=1
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
    # the exact byte-equivalent header/footer blocks, AND the correct
    # per-page aria-label has nothing left to swap. The aria-label check
    # was added in the post-1.5 review because the chrome-region byte check
    # alone is too weak: a regression that writes a stale aria-label
    # (e.g. encoded `&amp;` instead of decoded `&`) would skip re-run.
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
    if chrome_ok and label_ok:
        print(f"  no-change {path.relative_to(root)}  (already has new chrome)")
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
    head_script: str,
    dry_run: bool,
) -> bool:
    """Replace index.html's FOUC script, skip link, header, footer chrome
    in-place, preserving the home grid content unchanged. Brand link
    uses href="#top" (home-relative)."""
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
    byte_aligned = (
        has_new_chrome
        and home_header in source
        and footer_html in source
    )
    # Also require the canonical FOUC IIFE byte sequence to be present.
    # Without this, a home page that was generated before Story 1.5
    # added the PerformanceObserver / ht:fouc-resolved instrumentation
    # would slip through the byte-aligned check and ship a stale IIFE —
    # exactly the regression the post-1.5 review identified.
    iife_match = re.search(r"<script>([^<]+)</script>", source, re.IGNORECASE)
    iife_ok = bool(iife_match) and iife_match.group(1).strip() == head_script.strip()
    if byte_aligned and iife_ok:
        print(f"  no-change {path.relative_to(root)}  (already has new chrome)")
        return True

    # Chrome is byte-aligned but the inline FOUC IIFE in <head> is stale
    # (the home page was generated before the PerformanceObserver /
    # ht:fouc-resolved instrumentation landed in head-snippet.html).
    # Rewrite only the IIFE in place — touching the body content via the
    # byte-aligned region rewrite below would clobber the home grid (see
    # dev-agent note: "Home page body regression after --home regeneration"
    # in the Story 1.5 spec).
    if byte_aligned and not iife_ok and iife_match:
        new_source = (
            source[: iife_match.start(1)]
            + " " + head_script.strip() + " "
            + source[iife_match.end(1):]
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
        print(f"  wrote {path.relative_to(root)}  (IIFE only)")
        return True

    new_source = source

    # Replace the FOUC script in <head> if legacy IIFE is present.
    new_source, _ = LEGACY_FOUC_RE.subn(head_script + "\n\n  ", new_source, count=1)

    if has_new_chrome:
        # Already has the new chrome markers but bytes differ — do an
        # in-place region replace so the page aligns byte-for-byte with
        # chrome.html. We anchor on the `<a class="shell-skip">` start
        # and the `</footer>` close.
        new_chrome = skip_html + "\n  " + home_header + "\n  " + footer_html + "\n\n  "
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

        # Replace <div id="site-footer"></div> with footer chrome.
        new_source, _ = LEGACY_FOOTER_RE.subn(footer_html + "\n\n  ", new_source, count=1)

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
    skip_html, header_html, footer_html = read_chrome(root)
    head_script = read_head_snippet(root)

    failures = 0

    if args.home:
        print("shell-template: regenerating home page")
        if not regenerate_home(
            root,
            skip_html=skip_html,
            header_html=header_html,
            footer_html=footer_html,
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