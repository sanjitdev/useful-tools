#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
_bundle_size_tier1.py — Story 4 Phase 3 (Sweep to slim Tier 1).

Per-page Tier 1 bundle size gate. Walks every chrome page (45 tools
+ 6 packs + home + quality + quiz-preview + view-source), parses the
eager `<script>` content of the page (Tier 1: site-config +
storage-registry + utils + ht-lazy + shell-thin + the 3-line
Tier 1 boot), gz-sums it, and exits non-zero if any page exceeds
TIER1_BUDGET_BYTES (30,000 — the PRD NFR-1 floor) or any page is
missing Tier 1 markers (drift protection: a page that loses
slim Tier 1 shape by accident gets flagged).

Pure-stdlib Python (gzip + re + pathlib — no third-party deps).
Same shape as scripts/bundle-size-gate.py and the rest of the
gate family.

What counts as Tier 1 on a given page kind
------------------------------------------
Tool page (45 pages): site-config + storage-registry + utils +
ht-lazy + shell-thin (5 scripts, the canonical slim footer).

  Tier 1 gz budget per tool page: ~14 KB (site-config 500 +
  storage-registry 7,516 + utils 3,134 + ht-lazy 1,066 +
  shell-thin 1,839 = 14,055 gz). Comfortably under the 30 KB
  NFR-1 floor with > 2× margin.

Pack page (6 pages): same 5 scripts but via `../assets/js/`.
Home page (index.html): same 5 scripts but root-relative.
Quality page (quality.html): same 5 scripts but root-relative.
Quiz-preview (tools/quiz-preview/index.html): same 5 scripts via
  `../../assets/js/`.
View-source page (view-source.html): same 5 scripts but
  root-relative.

Page-conditional modules (loaded on specific pages only) are NOT
counted in the Tier 1 budget. Per-Tool scripts, pack-page.js,
home modules, quality.js, quiz.js, view-source.js, api-contract.js,
and the vendor scripts all live in the per-page module budget
which the existing make bundle-size gate handles via SPEC_JS_MODULES.

Tier 1 invariant
----------------
Every chrome page MUST carry the slim Tier 1 footer. Drift guard
asserts every page has at least these 5 scripts (ht-lazy + shell-thin
+ the 3-line Tier 1 boot). A page missing one of the markers
drifts out of slim Tier 1 shape and fails the gate.

Exit codes
----------
  0 — every chrome page is in slim Tier 1 shape AND every page's
      Tier 1 JS payload is < TIER1_BUDGET_BYTES (30 KB) gz.
  1 — at least one page exceeds the budget, OR at least one page
      is missing the slim Tier 1 footer.
  2 — repo root not found / chrome source missing.
  3 — write error or unexpected I/O failure.

Usage
-----
  python scripts/_bundle_size_tier1.py          # gate (default: 30 KB)
  python scripts/_bundle_size_tier1.py --budget 25000   # tighter budget

Author: Handy Tools (Story 4 Phase 3 — Sweep all 53 pages to slim Tier 1)
"""

from __future__ import annotations

import argparse
import gzip
import json
import re
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass

SCHEMA_ANCHOR = "tools.schema.json"

# ------------------------------------------------------------------
# Tier 1 budget gate (NFR-1 floor).
# ------------------------------------------------------------------
# NFR-1 (PRD): shell JS < 30 KB gzipped. Story 4 reduces the chrome
# layer (142,420 gz) to a slim Tier 1 footer (~14 KB gz). This script
# enforces NFR-1 per-page: every chrome page's eager Tier 1 script
# payload must stay under 30 KB gz.
#
# Future Stories that legitimately add Tier 1 (NOT page-conditional)
# must either: (a) keep the delta under TIER1_BUDGET_BYTES, or (b)
# bump TIER1_BUDGET_BYTES in the same Story commit with justification
# (e.g., a tiered-budget revision documented in NFR-1-REVISION.md).
TIER1_BUDGET_BYTES = 30_000
TIER1_BUDGET_LABEL = "30 KB (PRD NFR-1 floor)"

# ------------------------------------------------------------------
# Tier 1 script markers (relative-path-aware).
# ------------------------------------------------------------------
# The slim Tier 1 footer is: site-config + storage-registry + utils
# + ht-lazy + shell-thin. Each marker is a substring of the
# corresponding <script src="..."> tag, ignoring the relative-path
# prefix (../../, ../, or root-relative) — the regex matches any
# number of `../` segments followed by `assets/js/<name>.js`, with
# `defer` allowed but optional on shell-thin.
TIER1_SCRIPTS = [
    'assets/js/site-config.js',
    'assets/js/storage-registry.js',
    'assets/js/utils.js',
    'assets/js/ht-lazy.js',
    'assets/js/shell-thin.js',
]

# Regex that captures the set of Tier 1 script tags on a page. The
# `src` attribute must point at one of the TIER1_SCRIPTS names; the
# path prefix can be any number of `../` segments or root-relative.
TIER1_SCRIPT_RE = re.compile(
    r'<script\s+src="(?:\.\./)*assets/js/(' +
    '|'.join(re.escape(s.split('/')[-1]) for s in TIER1_SCRIPTS) +
    r')"(?:\s+defer)?\s*></script>'
)


def find_repo_root(start: Path) -> Path:
    """Walk up from `start` until we find tools.schema.json."""
    try:
        cur = start.resolve()
    except OSError as exc:
        sys.stderr.write(f"bundle-size-tier1: cannot resolve {start}: {exc}\n")
        sys.exit(2)
    for parent in [cur, *cur.parents]:
        if (parent / SCHEMA_ANCHOR).is_file():
            return parent
        if (parent / "assets" / "js" / "ht-lazy.js").is_file():
            return parent
    sys.stderr.write(
        f"bundle-size-tier1: cannot locate {SCHEMA_ANCHOR} or "
        f"assets/js/ht-lazy.js in {cur} or any ancestor.\n"
    )
    sys.exit(2)


def discover_pages(root: Path) -> list[tuple[str, Path]]:
    """Return [(page_kind, path), ...] for every chrome page.

    Mirrors _slim_tier1_sweep.py's discovery exactly so the two
    scripts agree on which pages are "chrome pages".
    """
    pages: list[tuple[str, Path]] = []

    home = root / "index.html"
    if home.is_file():
        pages.append(("home", home))

    vs = root / "view-source.html"
    if vs.is_file():
        pages.append(("view-source", vs))

    q = root / "quality.html"
    if q.is_file():
        pages.append(("quality", q))

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

    packs_dir = root / "packs"
    if packs_dir.is_dir():
        for page in sorted(packs_dir.glob("*.html")):
            pages.append(("pack", page))

    return pages


# Per-page relative path from a chrome page to repo-root-relative
# `assets/js/<name>.js`. Used to resolve `<script src>` attributes
# to actual files on disk for gz measurement.
PATH_PREFIX = {
    "tool": "../../",
    "pack": "../",
    "home": "",
    "quality": "",
    "view-source": "",
    "quiz-preview": "../../",
}


def resolve_script_path(root: Path, page_kind: str, src: str) -> Path | None:
    """Map a `src="..."` value on a page of `page_kind` to a real
    file under `root`, ignoring any URL prefix.

    Returns None if the src can't be resolved (external URL, etc.).
    """
    # Strip any `../` prefix. Note: the page may carry `../../assets/...`
    # (tool), `../assets/...` (pack), or `assets/...` (home/quality/
    # view-source). For measurement, we map to root-relative.
    if src.startswith("http://") or src.startswith("https://") or src.startswith("//"):
        return None
    # Strip leading ../ segments.
    cleaned = src
    while cleaned.startswith("../"):
        cleaned = cleaned[3:]
    if not cleaned.startswith("assets/"):
        return None
    candidate = root / cleaned
    if candidate.is_file():
        return candidate
    return None


SCRIPT_SRC_RE = re.compile(r'<script\s+src="([^"]+)"(?:\s+defer)?\s*></script>')


def parse_tier1_sources(page_source: str) -> tuple[list[str], list[str]]:
    """Return (tier1_srcs, all_srcs) for a chrome page.

    tier1_srcs: src values (relative path as written on the page)
    whose basename matches a TIER1_SCRIPTS name. gz-summed for budget.
    all_srcs: every script src on the page (for visibility / drift).
    """
    all_srcs = SCRIPT_SRC_RE.findall(page_source)
    tier1_names = {s.rsplit('/', 1)[-1] for s in TIER1_SCRIPTS}
    tier1_srcs = [s for s in all_srcs if s.rsplit('/', 1)[-1] in tier1_names]
    return tier1_srcs, all_srcs


def measure_page(root: Path, page_kind: str, path: Path) -> dict:
    """Measure one chrome page's Tier 1 gzipped JS payload.

    Returns a dict with: kind, path, page_gz (eager Tier 1 gz
    total), tier1_scripts (list of script basenames found), all_scripts
    (list of all script srcs), missing_tier1 (drift guard — list of
    expected Tier 1 basenames NOT found).
    """
    page_source = path.read_text(encoding="utf-8")
    tier1_srcs, all_srcs = parse_tier1_sources(page_source)

    total_gz = 0
    per_script: list[dict] = []
    for src in tier1_srcs:
        resolved = resolve_script_path(root, page_kind, src)
        if resolved is None:
            per_script.append({"src": src, "error": "unresolved"})
            continue
        raw_bytes = resolved.read_bytes()
        gz_bytes = len(gzip.compress(raw_bytes))
        total_gz += gz_bytes
        per_script.append({
            "src": src,
            "file": str(resolved.relative_to(root)),
            "gz": gz_bytes,
        })

    found_names = {s.rsplit('/', 1)[-1] for s in tier1_srcs}
    expected_names = {s.rsplit('/', 1)[-1] for s in TIER1_SCRIPTS}
    missing_tier1 = sorted(expected_names - found_names)

    return {
        "kind": page_kind,
        "path": str(path.relative_to(root)),
        "page_gz": total_gz,
        "tier1_scripts": per_script,
        "all_scripts": all_srcs,
        "missing_tier1": missing_tier1,
        "script_count": len(all_srcs),
    }


def render_breakdown(pages: list[dict]) -> str:
    """Render per-page Tier 1 gz sizes sorted by size descending."""
    sorted_pages = sorted(pages, key=lambda p: -p["page_gz"])
    lines = []
    for p in sorted_pages:
        marker = "OK" if (
            p["page_gz"] <= TIER1_BUDGET_BYTES and not p["missing_tier1"]
        ) else "FAIL"
        lines.append(
            f"  {marker:4s}  {p['kind']:11s}  {p['path']:60s}  "
            f"tier1 gz={p['page_gz']:>6,d}"
        )
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument(
        "--root",
        help="explicit repo root (default: walk up to find tools.schema.json)",
    )
    parser.add_argument(
        "--budget",
        type=int,
        default=TIER1_BUDGET_BYTES,
        help=f"Tier 1 budget per page in bytes (default: "
             f"{TIER1_BUDGET_BYTES:,d})",
    )
    parser.add_argument(
        "--no-fail",
        action="store_true",
        help="print the breakdown but never exit non-zero "
             "(informational only)",
    )
    args = parser.parse_args(argv)

    root = (
        Path(args.root).resolve()
        if args.root
        else find_repo_root(Path(__file__).parent)
    )

    pages = discover_pages(root)
    print(f"bundle-size-tier1: measuring {len(pages)} chrome page(s)…")
    print("")

    measured = [measure_page(root, kind, p) for kind, p in pages]
    print(render_breakdown(measured))

    over_budget = [p for p in measured if p["page_gz"] > args.budget]
    drift_pages = [p for p in measured if p["missing_tier1"]]

    max_gz = max((p["page_gz"] for p in measured), default=0)
    avg_gz = (
        sum(p["page_gz"] for p in measured) // len(measured)
        if measured
        else 0
    )

    print("")
    print(
        f"  max Tier 1 gz: {max_gz:,d} bytes / "
        f"page budget: {args.budget:,d} bytes ({args.budget / 1024:.1f} KB)"
    )
    print(f"  avg Tier 1 gz: {avg_gz:,d} bytes across {len(measured)} page(s)")

    summary = {
        "pages": len(measured),
        "budget": args.budget,
        "budget_label": TIER1_BUDGET_LABEL,
        "max_gz": max_gz,
        "avg_gz": avg_gz,
        "over_budget_count": len(over_budget),
        "drift_count": len(drift_pages),
        "over_budget": [p["path"] for p in over_budget],
        "drift_pages": [
            {"path": p["path"], "missing_tier1": p["missing_tier1"]}
            for p in drift_pages
        ],
        "details": measured,
    }
    print("")
    print("JSON:" + json.dumps(summary))

    failures: list[str] = []
    for p in over_budget:
        failures.append(
            f"{p['path']} Tier 1 gz = {p['page_gz']:,d} > "
            f"budget {args.budget:,d} bytes — split out page-conditional "
            f"module(s) or trim slim Tier 1 footer."
        )
    for p in drift_pages:
        failures.append(
            f"{p['path']} is missing Tier 1 marker(s) "
            f"{', '.join(p['missing_tier1'])} — page has drifted out of "
            f"slim Tier 1 shape; re-run scripts/_slim_tier1_sweep.py."
        )

    if args.no_fail:
        print("")
        print(
            f"bundle-size-tier1: --no-fail set; "
            f"max={max_gz:,d}/{args.budget:,d} reported without "
            f"exit-code consequences"
        )
        return 0

    if failures:
        print("")
        for v in failures:
            print(f"  FAIL  {v}")
        print(f"bundle-size-tier1: {len(failures)} failure(s)")
        return 1

    print("")
    print(
        f"bundle-size-tier1: PASS "
        f"({len(measured)}/{len(measured)} chrome pages "
        f"under {args.budget:,d} bytes Tier 1 gz; "
        f"max={max_gz:,d}, avg={avg_gz:,d})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
