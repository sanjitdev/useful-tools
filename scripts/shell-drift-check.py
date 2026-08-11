#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
shell-drift-check.py — Fail CI if any page's chrome has drifted from
assets/shell/chrome.html.

Pure-stdlib Python. Same shape as the four other scripts (no third-party
deps, exit codes 0/1/2/3).

Purpose
-------
The canonical Shell chrome lives in assets/shell/chrome.html, delimited by
`<!-- shell:header -->` / `<!-- /shell:header -->` and `<!-- shell:footer -->`
/ `<!-- /shell:footer -->` comments. Every page that renders the chrome
(index.html and each tools/<slug>/index.html) is expected to embed the
**same byte sequence** inside those regions. The script extracts the
canonical blocks from chrome.html and grep-matches them against every
target file.

If a drift is detected, the script exits 2 and prints one
`CHROME DRIFT: <path>` line per offending file. The intended CI use is
`make shell-drift` wired into the tool-contract-gate workflow so that
edits to chrome.html force a re-run of `scripts/shell-template.py` to
keep all pages in sync.

The check is **substring-based**, not parse-based. False positives
(e.g., a tool body that legitimately quotes the same anchor text inside
its form) can be silenced via `--allow-drift <path>`; this story
registers no exceptions.

Usage
-----
  python scripts/shell-drift-check.py            # check all pages
  python scripts/shell-drift-check.py --root ... # explicit repo root
  python scripts/shell-drift-check.py --allow-drift tools/<slug>/index.html

Exit codes
----------
  0 — no drift detected
  1 — (reserved) — currently unused; see exit 2 for drift
  2 — at least one page is out of sync (CHROME DRIFT reported), or chrome.html missing or missing markers
  3 — write error or unexpected I/O failure

Author: Handy Tools (Story 1.5 — Shell HTML Skeleton with Cobalt Tokens)
"""

from __future__ import annotations

import argparse
import hashlib
import re
import sys
from pathlib import Path

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
# Story 3.3: the help overlay (UX-DR-6, FR-7) is a single shared DOM
# node mounted on every page, in the same chrome-template pattern as
# palette.html and settings.html. The drift check verifies the help
# block is byte-equivalent across home + tool + pack + /quality pages.
HELP_REL = Path("assets/shell/help.html")
TOOLS_JSON_REL = Path("tools.json")
# Story 1.11: the search.js script tag is a fixed-string anchor that
# shell-template.py splices into every page (home + 34 tools). The drift
# check verifies the substring is present on every page. Two paths exist:
# home pages use src="assets/js/search.js" (root-relative); tool pages use
# src="../../assets/js/search.js". We accept either form.
SEARCH_JS_ANCHOR_HOME = '<script src="assets/js/search.js" defer></script>'
SEARCH_JS_ANCHOR_TOOL = '<script src="../../assets/js/search.js" defer></script>'
# Story 6.2: pack pages live at packs/<slug>.html (depth 1), so they use
# the "../" relative path for assets/js/* scripts (one level up to repo root).
SEARCH_JS_ANCHOR_PACK = '<script src="../assets/js/search.js" defer></script>'
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


# ---------------------------------------------------------------------------
# Chrome extraction
# ---------------------------------------------------------------------------

HEADER_RE = re.compile(
    r"<!-- shell:header -->\s*(.*?)\s*<!-- /shell:header -->", re.DOTALL
)
FOOTER_RE = re.compile(
    r"<!-- shell:footer -->\s*(.*?)\s*<!-- /shell:footer -->", re.DOTALL
)
PALETTE_REGION_RE = re.compile(
    r"<!-- shell:palette -->\s*(.*?)\s*<!-- /shell:palette -->", re.DOTALL
)
SETTINGS_REGION_RE = re.compile(
    r"<!-- shell:settings -->\s*(.*?)\s*<!-- /shell:settings -->", re.DOTALL
)
# Story 3.3: help overlay region marker. The drift check byte-matches
# the help region on every page.
HELP_REGION_RE = re.compile(
    r"<!-- shell:help -->\s*(.*?)\s*<!-- /shell:help -->", re.DOTALL
)
MANIFEST_REGION_RE = re.compile(
    r"<!-- ht:storage-registry-manifest-start -->\s*(.*?)\s*"
    r"<!-- ht:storage-registry-manifest-end -->",
    re.DOTALL,
)


def load_chrome(root: Path) -> tuple[str, str, str, str, str, str, str, str, str]:
    """Return (header_bytes, footer_bytes, palette_bytes, settings_bytes,
    help_bytes, tools_json_inline_bytes, storage_registry_manifest_bytes,
    search_js_anchor_bytes, site_config_anchor_bytes)
    extracted from the canonical sources. The header and footer are read
    from chrome.html; the palette is read from palette.html (Story 1.7),
    the settings modal from settings.html (Story 1.8), the help overlay
    from help.html (Story 3.3), the inline tools.json fallback is read
    from tools.json + rendered by the same `read_tools_json_inline`
    recipe as `scripts/shell-template.py` (Story 1.9), the
    storage-registry manifest is extracted from chrome.html (Story 1.10),
    and the search.js script tag is a fixed-string anchor (Story 1.11).
    """
    chrome_path = root / CHROME_REL
    if not chrome_path.is_file():
        sys.stderr.write(f"shell-drift-check: missing {chrome_path}\n")
        sys.exit(2)
    chrome_text = chrome_path.read_text(encoding="utf-8")
    header_match = HEADER_RE.search(chrome_text)
    footer_match = FOOTER_RE.search(chrome_text)
    manifest_match = MANIFEST_REGION_RE.search(chrome_text)
    if not header_match or not footer_match:
        sys.stderr.write(
            "shell-drift-check: chrome.html missing one of "
            "{shell:header, shell:footer} markers\n"
        )
        sys.exit(2)
    if not manifest_match:
        sys.stderr.write(
            "shell-drift-check: chrome.html missing "
            "ht:storage-registry-manifest markers\n"
        )
        sys.exit(2)

    palette_path = root / PALETTE_REL
    if not palette_path.is_file():
        sys.stderr.write(f"shell-drift-check: missing {palette_path}\n")
        sys.exit(2)
    palette_text = palette_path.read_text(encoding="utf-8")
    palette_match = PALETTE_REGION_RE.search(palette_text)
    if not palette_match:
        sys.stderr.write(
            "shell-drift-check: palette.html missing shell:palette markers\n"
        )
        sys.exit(2)

    settings_path = root / SETTINGS_REL
    if not settings_path.is_file():
        sys.stderr.write(f"shell-drift-check: missing {settings_path}\n")
        sys.exit(2)
    settings_text = settings_path.read_text(encoding="utf-8")
    settings_match = SETTINGS_REGION_RE.search(settings_text)
    if not settings_match:
        sys.stderr.write(
            "shell-drift-check: settings.html missing shell:settings markers\n"
        )
        sys.exit(2)

    # Story 3.3: extract the help overlay region. Same convention as the
    # palette + settings regions: the canonical source is a separate file,
    # the region is delimited by shell:help markers, and every page is
    # expected to embed the same bytes (verified via substring check below).
    help_path = root / HELP_REL
    if not help_path.is_file():
        sys.stderr.write(f"shell-drift-check: missing {help_path}\n")
        sys.exit(2)
    help_text = help_path.read_text(encoding="utf-8")
    help_match = HELP_REGION_RE.search(help_text)
    if not help_match:
        sys.stderr.write(
            "shell-drift-check: help.html missing shell:help markers\n"
        )
        sys.exit(2)

    # Story 1.9: extract the inline tools.json block (the file:// fallback
    # for the data-driven home grid renderer). The block is home-only —
    # tool pages don't carry it. Keep the extraction lazy so tool-page
    # scans don't fail at startup when the file is missing in unusual
    # states (e.g., a partial worktree).
    tools_json_path = root / TOOLS_JSON_REL
    if not tools_json_path.is_file():
        sys.stderr.write(f"shell-drift-check: missing {tools_json_path}\n")
        sys.exit(2)
    try:
        # Mirror the serialization rules in scripts/shell-template.py:
        # sorted keys, no whitespace, ensure_ascii=False. The
        # `tools.shell-template.py` is the only consumer of this byte
        # sequence in the canonical form; the drift check reconstructs
        # the same shape so a developer editing tools.json sees drift
        # the next time they run either gate.
        try:
            from shell_template import read_tools_json_inline  # type: ignore
        except ImportError:
            import json
            payload = json.loads(tools_json_path.read_text(encoding="utf-8"))
            body = json.dumps(
                payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True
            )
            tools_json_inline_bytes = (
                "<!-- ht:tools-json-inline-start -->\n  "
                + '<script type="application/json" id="ht-tools-json-inline">'
                + body
                + "</script>\n  "
                + "<!-- ht:tools-json-inline-end -->"
            )
        else:
            tools_json_inline_bytes = read_tools_json_inline(root)
    except (ValueError, OSError) as exc:
        sys.stderr.write(
            f"shell-drift-check: tools.json is not valid JSON: {exc}\n"
        )
        sys.exit(2)

    return (
        header_match.group(1),
        footer_match.group(1),
        palette_match.group(1),
        settings_match.group(1),
        help_match.group(1),
        tools_json_inline_bytes,
        manifest_match.group(1),
        (SEARCH_JS_ANCHOR_HOME, SEARCH_JS_ANCHOR_TOOL, SEARCH_JS_ANCHOR_PACK),
        (SITE_CONFIG_JS_ANCHOR_HOME, SITE_CONFIG_JS_ANCHOR_TOOL, SITE_CONFIG_JS_ANCHOR_PACK),
    )


# ---------------------------------------------------------------------------
# Drift scan
# ---------------------------------------------------------------------------

INDEX_REL = Path("index.html")
TOOLS_DIR_REL = Path("tools")


def iter_target_files(root: Path) -> list[Path]:
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


def normalize(text: str) -> str:
    """Replace per-context hrefs with a placeholder so home, tool pages, and
    pack pages can all be compared against the same canonical chrome. The
    brand link is the only intentional difference: home uses `#top`, tool
    pages use `../../index.html` (depth 2), pack pages use `../index.html`
    (depth 1, Story 6.2)."""
    return re.sub(
        r'href="#top"',
        'href="__BRAND_HREF__"',
        text,
    ).replace(
        'href="../../index.html"',
        'href="__BRAND_HREF__"',
        1,
    ).replace(
        'href="../index.html"',
        'href="__BRAND_HREF__"',
        1,
    )


def scan(
    root: Path,
    header: str,
    footer: str,
    palette: str,
    settings: str,
    help: str,
    tools_json_inline: str,
    storage_registry_manifest: str,
    search_js_anchors: tuple[str, str, str],
    site_config_anchors: tuple[str, str, str],
    allowed: set[Path],
) -> int:
    header_norm = normalize(header)
    footer_norm = normalize(footer)
    # Allow lookup by both absolute path and relative POSIX string so
    # CLI users can pass either form to --allow-drift and have it work.
    allowed_abs = {a.resolve() for a in allowed}
    allowed_rel = {a.as_posix() for a in (a.relative_to(root) for a in allowed_abs if a.is_absolute())}
    failures = 0
    index_path = (root / INDEX_REL).resolve()
    for path in iter_target_files(root):
        rel = path.relative_to(root)
        if path.resolve() in allowed_abs or rel.as_posix() in allowed_rel:
            print(f"  skip-drift {rel}")
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            sys.stderr.write(f"shell-drift-check: cannot read {path}: {exc}\n")
            failures += 1
            continue
        text_norm = normalize(text)
        ok = (
            header_norm in text_norm
            and footer_norm in text_norm
            and palette in text_norm
            and settings in text_norm
            and help in text_norm
        )
        # Story 1.11: verify the search.js script tag is present AND uses
        # the right relative path for the page kind. Home page
        # (`index.html` at the repo root) requires the root-relative
        # `src="assets/js/search.js"` form; tool pages
        # (`tools/<slug>/index.html`) require the relative
        # `src="../../assets/js/search.js"` form. A wrong form would still
        # load on a webserver with a catch-all rewrite, but would 404 on
        # a plain `python -m http.server` from the repo root.
        if ok:
            # `is_home` requires the page to live at the repo root, not
            # just to be named index.html. Tool pages are also named
            # `index.html` but live under tools/<slug>/, which uses a
            # relative path for assets/js/*.
            is_home = rel == Path(INDEX_REL)
            is_pack = rel.parent.name == "packs"
            is_root_page = (
                not is_home and rel.name in ROOT_PAGES_WITH_CHROME
            )
            if is_home or is_root_page:
                expected_anchor = search_js_anchors[0]
            elif is_pack:
                expected_anchor = search_js_anchors[2]
            else:
                expected_anchor = search_js_anchors[1]
            search_js_ok = expected_anchor in text_norm
            if not search_js_ok:
                sys.stderr.write(
                    f"CHROME DRIFT (search.js): {rel} — search.js script tag "
                    f"missing or wrong relative path on this page "
                    f"(expected: {expected_anchor!r})\n"
                )
                ok = False
        # Story 1.9: the inline tools.json block is the file:// fallback
        # for the data-driven home-grid renderer. It is home-only — tool
        # pages don't carry it. Add the 5th check on index.html only.
        # Story 1.10: the storage-registry manifest block is also
        # home-only — the gate reads chrome.html's manifest directly so
        # tool pages don't need to carry the JSON inline. Add the 6th
        # check on index.html only.
        # Story 1.12: site-config.js script tag + script-tag order
        # check, on every page. Plus a data-slug attribute check on
        # <main id="main"> for tool pages (home has no slug).
        if ok:
            is_home = rel == Path(INDEX_REL)
            is_pack = rel.parent.name == "packs"
            is_root_page = (
                not is_home and rel.name in ROOT_PAGES_WITH_CHROME
            )
            if is_home or is_root_page:
                site_anchor = site_config_anchors[0]
                storage_anchor = STORAGE_REGISTRY_JS_ANCHOR_HOME
            elif is_pack:
                site_anchor = site_config_anchors[2]
                storage_anchor = STORAGE_REGISTRY_JS_ANCHOR_PACK
            else:
                site_anchor = site_config_anchors[1]
                storage_anchor = STORAGE_REGISTRY_JS_ANCHOR_TOOL
            if site_anchor not in text_norm:
                sys.stderr.write(
                    f"CHROME DRIFT (site-config.js): {rel} — "
                    f"site-config.js script tag missing or wrong relative "
                    f"path (expected: {site_anchor!r})\n"
                )
                ok = False
            else:
                pass
                if storage_anchor in text_norm:
                    site_pos = text_norm.find(site_anchor)
                    storage_pos = text_norm.find(storage_anchor)
                    if site_pos > storage_pos:
                        sys.stderr.write(
                            f"CHROME DRIFT (site-config.js order): {rel} — "
                            "storage-registry.js appears before site-config.js "
                            "(HT.siteConfig must be defined before the "
                            "registry IIFE runs)\n"
                        )
                        ok = False
        if ok and not is_home and not is_pack and rel.name not in ROOT_PAGES_WITH_CHROME:
            # Tool pages must carry data-slug="<slug>" on <main id="main">.
            # Home page (no slug), pack pages (depth-1 slug comes from
            # data-pack-slug on the header, not data-slug on <main>), and
            # root pages like `quality.html` (no tool slug) are exempt.
            # The slug is the directory name; we derive it from the path
            # rather than parsing location.pathname because the
            # drift check is offline.
            slug = rel.parent.name
            data_slug_marker = f'data-slug="{slug}"'
            if data_slug_marker not in text:
                sys.stderr.write(
                    f"CHROME DRIFT (data-slug): {rel} — "
                    f'<main id="main"> is missing data-slug="{slug}" '
                    "(required by Story 1.12 footer link wiring)\n"
                )
                ok = False
        if ok and path.resolve() == index_path:
            ok = (
                tools_json_inline in text
                and storage_registry_manifest in text
            )
            # Review finding: the storage-registry manifest is a
            # machine-generated JSON block. The substring check above
            # tolerates whitespace drift and reordering — both of which
            # would cause the gate's manifest loader to read a stale
            # entry. Tighten the home-page check to byte-equality via a
            # SHA-256 match on the canonical manifest bytes. A page that
            # has the substring but a different SHA-256 is "drift with
            # a false negative" — surface it.
            if ok:
                page_manifest_match = MANIFEST_REGION_RE.search(text)
                if page_manifest_match:
                    page_manifest_bytes = (
                        page_manifest_match.group(0)
                    )
                    chrome_manifest_match = MANIFEST_REGION_RE.search(
                        storage_registry_manifest
                    )
                    if chrome_manifest_match:
                        chrome_manifest_bytes = (
                            chrome_manifest_match.group(0)
                        )
                        page_hash = hashlib.sha256(
                            page_manifest_bytes.encode("utf-8")
                        ).hexdigest()
                        chrome_hash = hashlib.sha256(
                            chrome_manifest_bytes.encode("utf-8")
                        ).hexdigest()
                        if page_hash != chrome_hash:
                            sys.stderr.write(
                                f"CHROME DRIFT (manifest): {rel} — "
                                "manifest region present but bytes differ "
                                "from chrome.html (run `make shell-template` "
                                "to regenerate)\n"
                            )
                            ok = False
                else:
                    # Substring matched but region regex didn't — unusual,
                    # could be a marker-comment typo. Treat as drift.
                    sys.stderr.write(
                        f"CHROME DRIFT (manifest markers): {rel} — "
                        "manifest substring matched but region markers "
                        "are malformed\n"
                    )
                    ok = False
        if ok:
            print(f"  ok      {rel}")
        else:
            sys.stderr.write(f"CHROME DRIFT: {rel}\n")
            failures += 1
    return failures


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument(
        "--root",
        help="explicit repo root (default: walk up to find tools.schema.json)",
    )
    parser.add_argument(
        "--allow-drift",
        action="append",
        default=[],
        metavar="PATH",
        help="path to exclude from the drift scan (repeatable)",
    )
    args = parser.parse_args(argv)

    root = Path(args.root).resolve() if args.root else find_repo_root(Path(__file__).parent)
    header, footer, palette, settings, help_html, tools_json_inline, storage_registry_manifest, search_js_anchors, site_config_anchors = load_chrome(root)
    allowed = {(root / p).resolve() for p in args.allow_drift}

    targets = iter_target_files(root)
    print(
        f"shell-drift-check: scanning {len(targets)} page(s) × 11 checks "
        "(header, footer, palette, settings, help, tools.json-inline [home only], "
        "storage-registry-manifest [home only], search.js script tag, "
        "site-config.js script tag + order, data-slug [tool pages only])"
    )
    failures = scan(
        root,
        header,
        footer,
        palette,
        settings,
        help_html,
        tools_json_inline,
        storage_registry_manifest,
        search_js_anchors,
        site_config_anchors,
        allowed,
    )
    if failures:
        print(f"shell-drift-check: {failures} drift(s) detected")
        return 2
    print("shell-drift-check: all pages in sync (11 checks)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))