"""
generate-pack-pages.py — Generate the 5 pack pages from the canonical Shell
chrome plus a pack-page body template.

Story 6.2: Each pack page lives at packs/<slug>.html. The 5 pages are
mechanical variants of one template, with the slug, title, and tagline
swapped. The drift check (scripts/shell-drift-check.py) byte-matches the
chrome across every page, so the chrome is sourced from the canonical
chrome.html + settings.html + palette.html (the same sources shell-template.py
uses for tool pages).

Idempotent: re-running this script produces no change on already-aligned pages.

Usage:
  python scripts/generate-pack-pages.py [--dry-run]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# 5 pack descriptors — taglines per EXPERIENCE.md §2.3.
# Icons mirror assets/js/pack-grid.js PACK_DEFINITIONS so the visual identity
# stays consistent between the home-grid pack cards and the destination pages.
PACKS = [
    {
        "slug": "travel",
        "title": "Travel",
        "tagline": "For the road, the flight, the family trip.",
        "icon": (
            '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" '
            'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" '
            'stroke-linejoin="round" aria-hidden="true">'
            '<path d="M21 16v-2l-9-5V5a1.5 1.5 0 0 0-3 0v4l-9 5v2l9-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L12 19v-5.5z"/>'
            "</svg>"
        ),
    },
    {
        "slug": "finance",
        "title": "Finance",
        "tagline": "For the numbers behind a decision.",
        "icon": (
            '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" '
            'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" '
            'stroke-linejoin="round" aria-hidden="true">'
            '<path d="M3 17l5-5 4 4 8-8"/><path d="M14 8h6v6"/>'
            "</svg>"
        ),
    },
    {
        "slug": "study",
        "title": "Study",
        "tagline": "For essays, notes, exams.",
        "icon": (
            '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" '
            'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" '
            'stroke-linejoin="round" aria-hidden="true">'
            '<path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/>'
            '<path d="M4 4v12a4 4 0 0 0 4 4"/><path d="M9 8h6M9 12h6"/>'
            "</svg>"
        ),
    },
    {
        "slug": "developer",
        "title": "Developer",
        "tagline": "For the bits that don't need a SaaS subscription.",
        "icon": (
            '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" '
            'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" '
            'stroke-linejoin="round" aria-hidden="true">'
            '<path d="M8 6l-5 6 5 6M16 6l5 6-5 6M14 4l-4 16"/>'
            "</svg>"
        ),
    },
    {
        "slug": "household",
        "title": "Household",
        "tagline": "For the math of daily life.",
        "icon": (
            '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" '
            'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" '
            'stroke-linejoin="round" aria-hidden="true">'
            '<path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'
            '<path d="M9 22V12h6v10"/>'
            "</svg>"
        ),
    },
    {
        "slug": "fun",
        "title": "Fun",
        "tagline": "For breaks, decisions, and color.",
        "icon": (
            '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" '
            'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" '
            'stroke-linejoin="round" aria-hidden="true">'
            '<path d="M12 2l2.4 5.6L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.6-1.4z"/>'
            "</svg>"
        ),
    },
]

# Markers expected in chrome.html (and its sub-parts). Mirrors the markers
# the drift check uses.
HEADER_OPEN = "<!-- shell:header -->"
HEADER_CLOSE = "<!-- /shell:header -->"
FOOTER_OPEN = "<!-- shell:footer -->"
FOOTER_CLOSE = "<!-- /shell:footer -->"
PALETTE_OPEN = "<!-- shell:palette -->"
PALETTE_CLOSE = "<!-- /shell:palette -->"
SETTINGS_OPEN = "<!-- shell:settings -->"
SETTINGS_CLOSE = "<!-- /shell:settings -->"
HELP_OPEN = "<!-- shell:help -->"
HELP_CLOSE = "<!-- /shell:help -->"
MANIFEST_OPEN = "<!-- ht:storage-registry-manifest-start -->"
MANIFEST_CLOSE = "<!-- ht:storage-registry-manifest-end -->"
INLINE_OPEN = "<!-- ht:tools-json-inline-start -->"
INLINE_CLOSE = "<!-- ht:tools-json-inline-end -->"


def read_part(root: Path, rel_path: str) -> str:
    """Read a chrome sub-part (palette.html, settings.html, etc.) and return
    the region between the matching marker comments, including the markers.
    Mirrors scripts/shell-drift-check.py's load_chrome() pattern."""
    text = (root / rel_path).read_text(encoding="utf-8")
    if rel_path.endswith("palette.html"):
        open_marker, close_marker = PALETTE_OPEN, PALETTE_CLOSE
    elif rel_path.endswith("settings.html"):
        open_marker, close_marker = SETTINGS_OPEN, SETTINGS_CLOSE
    elif rel_path.endswith("help.html"):
        open_marker, close_marker = HELP_OPEN, HELP_CLOSE
    else:
        raise ValueError(f"unknown chrome sub-part: {rel_path}")
    start = text.find(open_marker)
    end = text.find(close_marker)
    if start == -1 or end == -1:
        raise ValueError(
            f"markers not found in {rel_path}: {open_marker} ... {close_marker}"
        )
    return text[start:end + len(close_marker)]


def load_canonical_fouc_iife(root: Path) -> str:
    """Extract the blocking inline FOUC IIFE from
    assets/shell/head-snippet.html so the generated pack pages carry the
    same canonical FOUC script as every tool page. This is what
    scripts/shell-a11y-check.py's check_fouc_script() substring-matches
    against — drift here would silently break the 50ms no-FOUC budget
    on pack pages."""
    import re
    text = (root / "assets" / "shell" / "head-snippet.html").read_text(
        encoding="utf-8"
    )
    match = re.search(r"<script>(.*?)</script>", text, re.DOTALL)
    if not match:
        raise ValueError("FOUC IIFE not found in head-snippet.html")
    # Match the exact form tool pages use: "<script> IIFE_BODY </script>"
    # with no leading space and no extra attributes.
    return "<script>" + match.group(1).strip() + "</script>"


def extract_region(html: str, open_marker: str, close_marker: str) -> str:
    start = html.find(open_marker)
    end = html.find(close_marker)
    if start == -1 or end == -1:
        raise ValueError(f"markers not found: {open_marker} ... {close_marker}")
    return html[start:end + len(close_marker)]


def load_inline_tools_json(root: Path) -> str:
    """Build the inline tools.json block from the canonical tools.json. Mirrors
    shell-template's splicing: read tools.json, minify, wrap in
    <script type="application/json" id="ht-tools-json-inline">."""
    import json
    tools_path = root / "tools.json"
    with tools_path.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    minified = json.dumps(data, separators=(",", ":"))
    return f'<script type="application/json" id="ht-tools-json-inline">{minified}</script>'


def load_storage_manifest_block(root: Path) -> str:
    """Extract the canonical manifest block from assets/shell/chrome.html so
    the drift check can byte-match it on pack pages."""
    chrome_html = (root / "assets" / "shell" / "chrome.html").read_text(encoding="utf-8")
    return extract_region(chrome_html, MANIFEST_OPEN, MANIFEST_CLOSE)


def build_pack_page(root: Path, pack: dict) -> str:
    """Assemble a single pack page using the canonical chrome parts."""
    chrome_html = (root / "assets" / "shell" / "chrome.html").read_text(encoding="utf-8")

    # FOUC IIFE from chrome.html's preamble (everything before HEADER_OPEN).
    # For our purposes the home page already has this verbatim in <head>;
    # we copy the exact form from a tool page's <head> for byte-equivalence.
    tool_page_html = (root / "tools" / "qr-code-generator" / "index.html").read_text(encoding="utf-8")
    head_match_start = tool_page_html.find("<head>")
    head_match_end = tool_page_html.find("</head>") + len("</head>")
    tool_head_block = tool_page_html[head_match_start:head_match_end]

    # The chrome.html does NOT include the FOUC IIFE; tool pages keep their
    # own head with the inline IIFE. We'll use the tool-page head verbatim,
    # but swap favicon link, title, description, and the `<script src="...">`
    # tags to use `../assets/...` paths.
    inline_tools_json = load_inline_tools_json(root)
    manifest_block = load_storage_manifest_block(root)

    # Header / footer from chrome.html; palette / settings from their own
    # sub-part files (palette.html, settings.html) — mirrors the drift-check's
    # load_chrome() which reads the same sub-parts separately.
    header_block = extract_region(chrome_html, HEADER_OPEN, HEADER_CLOSE)
    footer_block = extract_region(chrome_html, FOOTER_OPEN, FOOTER_CLOSE)
    palette_block = read_part(root, "assets/shell/palette.html")
    settings_block = read_part(root, "assets/shell/settings.html")
    # Story 3.3: help overlay (non-modal, role=region, no aria-modal).
    help_block = read_part(root, "assets/shell/help.html")

    # Pack pages are at depth 1 (packs/<slug>.html). chrome.html's brand link
    # uses `../../index.html` (depth 2, for tool pages). Rewrite to `../index.html`
    # so the link resolves correctly. The drift-check normalizer on
    # shell-drift-check.py recognizes both forms (see iter_target_files +
    # the normalize() helper).
    header_block = header_block.replace(
        'href="../../index.html"',
        'href="../index.html"',
    )
    # When this rewrite is enabled, also patch the chrome.html source comment
    # so the sed/static-byte assumptions on the chrome source remain logical.
    # NOTE: chrome.html itself is unchanged; the rewrite is output-only.

    # Pack pages are one level deep (packs/<slug>.html). Asset paths are
    # `../assets/...`, tool paths are `../tools/<slug>/index.html`. Build
    # the body using pack-page.js to filter tools.json on the client.
    body = render_body(pack)
    title = f"{pack['title']} · Handy Tools"
    description = pack["tagline"]

    # Compose head: take tool page's head as the form template, but rewrite
    # the few per-page bits. To avoid accidentally inheriting a tool-page
    # title/description, we hand-compose the head from scratch using the
    # exact same pattern as tool pages.
    foc_iife = load_canonical_fouc_iife(root)
    head = (
        "<!doctype html>\n"
        '<html lang="en">\n'
        "<head>\n"
        '  <meta charset="utf-8">\n'
        '  <meta name="viewport" content="width=device-width,initial-scale=1">\n'
        f'  <meta name="description" content="{pack["tagline"]}">\n'
        f"  <title>{title}</title>\n"
        '  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Crect width=\'100\' height=\'100\' rx=\'22\' fill=\'%232F5BFF\'/%3E%3Ctext x=\'50\' y=\'66\' font-family=\'Arial,sans-serif\' font-size=\'52\' font-weight=\'800\' fill=\'white\' text-anchor=\'middle\'%3EH%3C/text%3E%3C/svg%3E">\n'
        # FOUC IIFE — verbatim from assets/shell/head-snippet.html. This is
        # the same canonical IIFE every tool page carries; the a11y check
        # substring-matches it byte-for-byte.
        f"  {foc_iife}\n"
        '  <link rel="stylesheet" href="../assets/css/base.css">\n'
        '  <link rel="stylesheet" href="../assets/css/components-core.css">\n'
        '  <link rel="stylesheet" href="../assets/css/tools.css">\n'
        "</head>\n"
    )

    # Body. The header_block / footer_block / palette_block / settings_block
    # are sourced from chrome.html verbatim (byte-equivalence with tool pages
    # after the drift normalizer rewrites hrefs). The settings modal lives
    # inside <body> per chrome.html's structure.
    body_html = (
        "<body>\n"
        + header_block
        + settings_block
        + palette_block
        + help_block
        + '  <main id="main" class="shell-main" aria-label="'
        + pack["title"]
        + '" tabindex="-1">\n'
        + "    <a id=\"top\"></a>\n"
        + body
        + "  </main>\n"
        + footer_block
        + "\n"
        + manifest_block
        + "\n"
        + f'  <script src="../assets/js/site-config.js"></script>\n'
        f'  <script src="../assets/js/storage-registry.js"></script>\n'
        f'  <script src="../assets/js/utils.js"></script>\n'
        + f'  {INLINE_OPEN}\n'
        + f"  {inline_tools_json}\n"
        + f'  {INLINE_CLOSE}\n'
        + "\n"
        + '  <script src="../assets/js/shell.js" defer></script>\n'
        + '  <script src="../assets/js/search.js" defer></script>\n'
        + '  <script src="../assets/js/help-overlay.js" defer></script>\n'
        + '  <script src="../assets/js/pack-page.js" defer></script>\n'
        + "</body>\n"
        + "</html>\n"
    )

    return head + body_html


def render_body(pack: dict) -> str:
    """Pack-page body markup. JS-side renderer fills #pack-page-tools and
    #pack-page-header — this is the static skeleton the JS mounts into."""
    return (
        '    <header class="pack-page-header" data-pack-slug="'
        + pack["slug"]
        + '">\n'
        '      <a href="../index.html" class="back-link">← All tools</a>\n'
        '      <div class="pack-page-header-row">\n'
        '        <span class="pack-page-icon" id="pack-page-icon"></span>\n'
        '        <div>\n'
        '          <h1 class="pack-page-title" id="pack-page-title"></h1>\n'
        '          <p class="pack-page-tagline" id="pack-page-tagline"></p>\n'
        + '          <p class="pack-page-subtitle" id="pack-page-subtitle"></p>\n'
        + '          <p class="pack-page-count" id="pack-page-count"></p>\n'
        "        </div>\n"
        "      </div>\n"
        "    </header>\n"
        "\n"
        '    <section class="pack-page-tools" id="pack-page-tools" data-mounted="false">\n'
        '      <div class="tool-grid" id="pack-page-tool-grid"></div>\n'
        "    </section>\n"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--root", default=None, help="repo root (auto-detected)")
    args = parser.parse_args()

    root = Path(args.root) if args.root else Path(__file__).resolve().parent.parent
    packs_dir = root / "packs"
    packs_dir.mkdir(parents=True, exist_ok=True)

    failures = 0
    for pack in PACKS:
        target = packs_dir / f"{pack['slug']}.html"
        rendered = build_pack_page(root, pack)
        if target.is_file():
            existing = target.read_text(encoding="utf-8")
            if existing == rendered:
                print(f"  no-change {target.relative_to(root)}")
                continue
        if args.dry_run:
            print(f"  would-write {target.relative_to(root)} ({len(rendered)} bytes)")
        else:
            target.write_text(rendered, encoding="utf-8")
            print(f"  wrote {target.relative_to(root)} ({len(rendered)} bytes)")

    return failures


if __name__ == "__main__":
    sys.exit(main())