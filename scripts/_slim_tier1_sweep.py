#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
_slim_tier1_sweep.py — Story 4 Phase 3: sweep every chrome page to slim
Tier 1 (site-config + storage-registry + utils + ht-lazy + shell-thin defer).

Pure-stdlib Python. Same shape as scripts/shell-template.py and
scripts/shell-drift-check.py (no third-party deps, exit codes 0/1/2/3,
Markdown status on stdout).

Purpose
-------
Story 4 Phase 2 (commit 99d490d) shipped the slim Tier 1 canary on
qr-code-generator. Phase 3 sweeps the same shape to all 53 chrome
pages — 45 tool pages, 6 pack pages, home (index.html), quality, and
quiz-preview. The slim Tier 1 trades the heavy chrome script block
(url.js, history.js, sample-data.js, share.js, export.js, import.js,
a11y.js, palette-actions.js, shell.js, search.js, help-overlay.js,
global-chords.js — collectively ~75 KB gz) for the Tier 1 boot
+ Proxy-stub pattern in shell-thin.js:

  <script src="../../assets/js/site-config.js"></script>
  <script src="../../assets/js/storage-registry.js"></script>
  <script src="../../assets/js/utils.js"></script>
  <script src="../../assets/js/ht-lazy.js"></script>
  <script src="../../assets/js/shell-thin.js" defer></script>
  <!-- page-conditional modules per page kind -->

The transform is idempotent: re-running on a page already in slim
Tier 1 shape produces no change (the script is a no-op). Pages that
already carry ht-lazy.js + shell-thin.js defer (Phase 2 canary) are
detected and skipped. The page-conditional modules (home-grid.js,
recent.js, pins.js, home-sidebar.js, pack-grid.js on home;
pack-page.js on pack pages; quality.js on quality; quiz.js on
quiz-preview; api-contract.js + highlight.min.js + zip-store.js on
view-source; per-Tool .js on each tool) are preserved verbatim.

Usage
-----
  python scripts/_slim_tier1_sweep.py              # sweep all chrome pages
  python scripts/_slim_tier1_sweep.py --dry-run    # print plan, do not write
  python scripts/_slim_tier1_sweep.py --root ...   # explicit repo root
  python scripts/_slim_tier1_sweep.py --tool <slug> # sweep one tool only

Exit codes
----------
  0 — all targeted pages aligned to slim Tier 1 (or already aligned)
  1 — at least one page failed to write
  2 — repo root not found / chrome source missing
  3 — write error or unexpected I/O failure

Author: Handy Tools (Story 4 Phase 3 — Sweep all 53 pages to slim Tier 1)
"""

from __future__ import annotations

import argparse
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
        sys.stderr.write(f"slim-tier1: cannot resolve {start}: {exc}\n")
        sys.exit(2)
    for parent in [cur, *cur.parents]:
        if (parent / SCHEMA_ANCHOR).is_file():
            return parent
        if (parent / "assets" / "js" / "ht-lazy.js").is_file():
            return parent
    sys.stderr.write(
        f"slim-tier1: cannot locate {SCHEMA_ANCHOR} or assets/js/ht-lazy.js "
        f"in {cur} or any ancestor.\n"
    )
    sys.exit(2)


# ---------------------------------------------------------------------------
# Page model.
#
# Each chrome page has the same high-level shape: a 3-line Tier 1 boot
# (site-config, storage-registry, utils), a varying list of heavy chrome
# modules, and a varying list of page-conditional modules. The slim Tier 1
# transforms every page to:
#
#   <3-line Tier 1 boot>
#   <ht-lazy.js>                # NEW (lazy loader)
#   <shell-thin.js defer>       # NEW (Tier 1 boot orchestrator)
#   <page-conditional modules>  # preserved verbatim
#
# The heavy chrome modules are stripped.
# ---------------------------------------------------------------------------

# Tier 1 boot: always present, in fixed order, never stripped.
TIER1_BOOT = [
    '<script src="../../assets/js/site-config.js"></script>',
    '<script src="../../assets/js/storage-registry.js"></script>',
    '<script src="../../assets/js/utils.js"></script>',
]
TIER1_BOOT_PACK = [s.replace("../../", "../") for s in TIER1_BOOT]
TIER1_BOOT_HOME = [
    '<script src="assets/js/site-config.js"></script>',
    '<script src="assets/js/storage-registry.js"></script>',
    '<script src="assets/js/utils.js"></script>',
]
TIER1_BOOT_QUALITY = TIER1_BOOT_HOME  # quality.html is at the repo root
TIER1_BOOT_VIEW_SOURCE = TIER1_BOOT_HOME  # view-source.html is at the repo root
TIER1_BOOT_QUIZ_PREVIEW = TIER1_BOOT  # tools/quiz-preview/ uses ../../

# Slim Tier 1 additions (after the 3-line boot): ht-lazy + shell-thin defer.
SLIM_LAZY = '<script src="../../assets/js/ht-lazy.js"></script>'
SLIM_SHELL_THIN = '<script src="../../assets/js/shell-thin.js" defer></script>'
SLIM_LAZY_PACK = '<script src="../assets/js/ht-lazy.js"></script>'
SLIM_SHELL_THIN_PACK = '<script src="../assets/js/shell-thin.js" defer></script>'
SLIM_LAZY_HOME = '<script src="assets/js/ht-lazy.js"></script>'
SLIM_SHELL_THIN_HOME = '<script src="assets/js/shell-thin.js" defer></script>'

# Heavy chrome modules that get stripped from every chrome page. They
# remain on disk but are no longer loaded eagerly; shell-thin.js's Proxy
# stubs lazy-load them on first user action. search.js / help-overlay.js
# / global-chords.js are also stripped — shell.js has defensive guards
# for HT.search / HT.helpOverlay being undefined (lines 1086, 1115) so
# the chrome UI degrades gracefully until those modules are fetched.
HEAVY_CHROME_MODULES = {
    "url.js",
    "history.js",
    "sample-data.js",
    "share.js",
    "export.js",
    "import.js",
    "a11y.js",
    "palette-actions.js",
    "shell.js",
    "search.js",
    "help-overlay.js",
    "global-chords.js",
}

# Pattern that matches any heavy chrome module <script> tag, regardless
# of `defer` attribute or relative path prefix (../../ or ../ or root).
HEAVY_CHROME_SCRIPT_RE = re.compile(
    r"<script\s+src=\"(?:\.\./\.\./|\.\./|)assets/js/("
    + "|".join(re.escape(m) for m in HEAVY_CHROME_MODULES)
    + r")\"(?:\s+defer)?\s*></script>\s*\n?"
)

# Page-conditional modules preserved verbatim (each has its own custom
# path/attrs so a simple regex match wouldn't catch them all; instead
# we strip HEAVY_CHROME_SCRIPT_RE and the surviving scripts are by
# definition page-conditional).
#
# Currently known page-conditional modules:
#   tools/<slug>/index.html → ./<slug>.js + per-tool vendor
#   packs/<slug>.html       → ../assets/js/pack-page.js defer
#   index.html              → assets/js/quiz.js defer (home carries quiz module)
#                            + assets/js/home-grid.js / recent.js / pins.js
#                            / home-sidebar.js / pack-grid.js (all defer)
#   quality.html            → assets/js/api-contract.js (no defer)
#                            + assets/js/quality.js defer
#   tools/quiz-preview/…    → ../../assets/js/quiz.js defer + ./quiz-preview.js
#   view-source.html        → assets/js/api-contract.js, vendor/highlight.min.js,
#                            vendor/zip-store.js, view-source.js defer


# ---------------------------------------------------------------------------
# Slim Tier 1 transform.
#
# Idempotent. Returns the source unchanged if the page is already in
# slim Tier 1 shape (ht-lazy.js + shell-thin.js defer present, no heavy
# chrome module script tags remaining).
# ---------------------------------------------------------------------------

def slim_tier1_already(source: str) -> bool:
    """A page is already in slim Tier 1 shape iff:
      - ht-lazy.js script tag present
      - shell-thin.js script tag present (with or without defer)
      - no heavy chrome module script tag present

    A page with both markers but still carrying heavy chrome modules
    (transition state from a partial sweep) is NOT considered slim —
    the transform must run to clean up the leftover heavy scripts.
    """
    if 'src="' not in source and "src='" not in source:
        return False
    if "ht-lazy.js" not in source:
        return False
    if "shell-thin.js" not in source:
        return False
    if HEAVY_CHROME_SCRIPT_RE.search(source):
        return False
    return True


def splice_to_slim_tier1(source: str, page_kind: str) -> str:
    """Replace the heavy chrome module block with the slim Tier 1 boot
    additions. Preserves the 3-line Tier 1 boot (site-config /
    storage-registry / utils) and all page-conditional modules after
    the chrome block.

    `page_kind` is one of: "tool", "pack", "home", "quality",
    "view-source", "quiz-preview". Drives the relative path used by
    the slim Tier 1 additions.

    Strategy:
      1. Drop every HEAVY_CHROME_SCRIPT_RE match.
      2. Locate the position immediately after the 3-line Tier 1 boot
         (last `<script src="...utils.js"></script>` line).
      3. Splice ht-lazy.js + shell-thin.js (defer) lines right after
         the utils.js line.
      4. Page-conditional modules (after the chrome block) are
         untouched.

    Idempotent: if `slim_tier1_already(source)` is true, returns
    `source` unchanged.
    """
    if slim_tier1_already(source):
        return source

    # Pick the path prefix for this page kind.
    if page_kind in ("home", "quality", "view-source"):
        slim_lazy = SLIM_LAZY_HOME
        slim_shell_thin = SLIM_SHELL_THIN_HOME
        utils_anchor = TIER1_BOOT_HOME[2]
    elif page_kind == "pack":
        slim_lazy = SLIM_LAZY_PACK
        slim_shell_thin = SLIM_SHELL_THIN_PACK
        utils_anchor = TIER1_BOOT_PACK[2]
    elif page_kind in ("tool", "quiz-preview"):
        slim_lazy = SLIM_LAZY
        slim_shell_thin = SLIM_SHELL_THIN
        utils_anchor = TIER1_BOOT[2]
    else:
        sys.stderr.write(
            f"slim-tier1: unknown page_kind {page_kind!r}\n"
        )
        sys.exit(2)

    # Step 1: strip every heavy chrome module script tag.
    new_source = HEAVY_CHROME_SCRIPT_RE.sub("", source)

    # Step 2: locate the utils.js script tag and splice the slim Tier 1
    # additions immediately after it. Use the canonical utils.js form
    # for this page kind as the anchor (it must still be present
    # because every chrome page carries it as Tier 1).
    anchor_pos = new_source.find(utils_anchor)
    if anchor_pos == -1:
        sys.stderr.write(
            f"slim-tier1: cannot find utils.js anchor {utils_anchor!r} "
            f"in {page_kind} page; leaving untouched\n"
        )
        return source
    splice_pos = anchor_pos + len(utils_anchor)
    slim_block = "\n  " + slim_lazy + "\n  " + slim_shell_thin
    new_source = (
        new_source[:splice_pos]
        + slim_block
        + new_source[splice_pos:]
    )
    return new_source


# ---------------------------------------------------------------------------
# Page discovery.
# ---------------------------------------------------------------------------

def discover_pages(root: Path, only_tool: str | None = None) -> list[tuple[str, Path]]:
    """Return [(page_kind, path), ...] for every chrome page. page_kind
    is "tool", "pack", "home", "quality", "view-source", "quiz-preview".

    When `only_tool` is set, ONLY that one tool page is returned (skip
    home / pack / quality / view-source / quiz-preview / other tools).
    The `--tool` flag is for ad-hoc canary verification of the transform
    on a single tool — it does NOT sweep the rest of the repo.
    """
    pages: list[tuple[str, Path]] = []

    if only_tool:
        # Single-tool mode: only that tool's page.
        page = root / "tools" / only_tool / "index.html"
        if page.is_file():
            kind = "quiz-preview" if only_tool == "quiz-preview" else "tool"
            pages.append((kind, page))
        return pages

    # Home page (index.html at the repo root).
    home = root / "index.html"
    if home.is_file():
        pages.append(("home", home))

    # View-source page.
    vs = root / "view-source.html"
    if vs.is_file():
        pages.append(("view-source", vs))

    # Quality page.
    q = root / "quality.html"
    if q.is_file():
        pages.append(("quality", q))

    # Tool pages.
    tools_dir = root / "tools"
    if tools_dir.is_dir():
        for slug_dir in sorted(tools_dir.iterdir()):
            if not slug_dir.is_dir():
                continue
            slug = slug_dir.name
            page = slug_dir / "index.html"
            if page.is_file():
                kind = "quiz-preview" if slug == "quiz-preview" else "tool"
                pages.append((kind, page))

    # Pack pages.
    packs_dir = root / "packs"
    if packs_dir.is_dir():
        for page in sorted(packs_dir.glob("*.html")):
            pages.append(("pack", page))

    return pages


# ---------------------------------------------------------------------------
# Per-page driver.
# ---------------------------------------------------------------------------

def process_page(
    root: Path,
    kind: str,
    path: Path,
    *,
    dry_run: bool,
) -> tuple[bool, str]:
    """Apply the slim Tier 1 transform to one page. Returns (changed, note)
    where `changed` is True iff the file was rewritten, and `note` is a
    short human-readable summary for the status log.
    """
    source = path.read_text(encoding="utf-8")
    if slim_tier1_already(source):
        return (False, "already slim Tier 1")
    new_source = splice_to_slim_tier1(source, kind)
    if new_source == source:
        # No change (e.g., utils.js anchor missing). Don't write.
        return (False, "no-op (anchor missing)")
    if dry_run:
        return (True, "would-write (heavy chrome → slim Tier 1)")
    try:
        path.write_text(new_source, encoding="utf-8")
    except OSError as exc:
        sys.stderr.write(f"slim-tier1: write failed for {path}: {exc}\n")
        return (False, f"WRITE FAILED: {exc}")
    return (True, "wrote (heavy chrome → slim Tier 1)")


# ---------------------------------------------------------------------------
# Entry point.
# ---------------------------------------------------------------------------

def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument(
        "--tool",
        help="sweep only this tool slug (skip home / pack / quality / "
        "view-source / quiz-preview)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="print plan, do not write",
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

    pages = discover_pages(root, only_tool=args.tool)
    if args.tool and not pages:
        sys.stderr.write(
            f"slim-tier1: tool {args.tool!r} not found at tools/{args.tool}/index.html\n"
        )
        return 1

    print(
        f"slim-tier1: sweeping {len(pages)} chrome page(s)"
        + ("  (dry-run)" if args.dry_run else "")
    )

    failures = 0
    changed = 0
    for kind, path in pages:
        ok, note = process_page(root, kind, path, dry_run=args.dry_run)
        rel = path.relative_to(root)
        marker = "WRITE" if ok else "skip "
        print(f"  {marker} {rel}  ({kind}, {note})")
        if not ok and note.startswith("WRITE FAILED"):
            failures += 1
        if ok:
            changed += 1

    print(
        f"slim-tier1: done ({changed} changed, {len(pages) - changed} unchanged, "
        f"{failures} failed)"
    )
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
