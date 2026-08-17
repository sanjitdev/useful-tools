#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
_bundle_size_per_tool.py — Story 4b Phase 4 (Per-tool code-splitting
gate).

Per-tool parse-time bundle size gate. Walks every tool page, finds the
eager `<slug>-core.js` (or `<slug>.js` graceful fallback for tools
that haven't been split yet), gz-sums it together with any vendor
scripts the tool depends on at parse time (qrcode.js, cpi-data.js,
jwt-codec.js, json-schema-lite.js, diff.js) and the per-tool CSS,
and exits non-zero if any tool exceeds:

  * TOOL_CORE_BUDGET_BYTES_GZ   (7,000 bytes gz) — the parse-time
    `<slug>-core.js` budget. Story 4b decomposes the top-10 tools
    so each fits here with 2-3× margin.
  * FIRST_PAINT_BUDGET_BYTES_GZ (30,000 bytes gz) — the
    `<slug>-core.js` + tool vendor + per-tool CSS budget. Matches
    the PRD NFR-1 floor and AC-4 letter-of-the-law.

A tool is "split" if `tools/<slug>/<slug>-core.js` exists; otherwise
the gate falls back to the legacy monolithic `<slug>.js`. The
graceful fallback means non-splittable tools (most of the 35
remaining tools — each is already < 7 KB gz core) continue to
pass without modification.

Drift guard: any tool that ships `<slug>-handlers.js` in the eager
`<script src>` of its index.html fails the gate (handlers must be
loaded via `HT.lazyLoadTool(slug, url)` only — never eager).

Pure-stdlib Python (gzip + re + pathlib — no third-party deps). Same
shape as `scripts/_bundle_size_tier1.py` and the rest of the gate
family.

Exit codes
----------
  0 — every tool's parse-time payload is under both budgets.
  1 — at least one tool exceeds the per-tool core budget, or the
      first-paint budget, or has drifted by eagerly loading its
      `<slug>-handlers.js`.
  2 — repo root not found / chrome source missing.
  3 — write error or unexpected I/O failure.

Usage
-----
  python scripts/_bundle_size_per_tool.py          # gate (default: 7 KB core)
  python scripts/_bundle_size_per_tool.py --core-budget 5000   # tighter budget
  python scripts/_bundle_size_per_tool.py --no-fail          # informational

Author: Handy Tools (Story 4b Phase 4 — Per-tool code-splitting gate)
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
# Per-tool budget gate.
# ------------------------------------------------------------------
# Story 4b decomposes the top-10 heaviest tool scripts into
# `<slug>-core.js` (parse-time data + boot) + `<slug>-handlers.js`
# (lazy on first interaction). The per-tool budget enforces that
# each tool's first-paint payload stays under the PRD NFR-1 30 KB
# floor.
#
# TOOL_CORE_BUDGET_BYTES_GZ: 7,000 bytes gz — between the top-10
# average (~4,300 gz after split) and the worst current offender
# (bd-tax-calculator 16,596 gz pre-split). Top-10 tools must split
# so each lands ≤ 7 KB gz core.
#
# FIRST_PAINT_BUDGET_BYTES_GZ: 30,000 bytes gz — the PRD NFR-1
# letter-of-the-law. Sums tool-core + tool-vendor + tool-css; must
# stay under 30 KB gz on every tool page.
TOOL_CORE_BUDGET_BYTES_GZ = 7_000
FIRST_PAINT_BUDGET_BYTES_GZ = 30_000

TOOL_CORE_LABEL = "7 KB (Story 4b per-tool core)"
FIRST_PAINT_LABEL = "30 KB (PRD NFR-1 floor)"

# Tool-vendor scripts that are loaded eagerly alongside a tool's
# `<slug>-core.js`. Stay eager because the tool depends on them at
# parse time. Listed here so the gate knows what to sum into the
# first-paint total.
TOOL_VENDOR_SCRIPTS = {
    "qr-code-generator": ["qrcode.js"],
    "inflation-calculator": ["cpi-data.js"],
    "jwt-inspector": ["jwt-codec.js"],
    "json-formatter": ["diff.js", "json-schema-lite.js"],
}

# Regex matching an eager `<script src="./...">` tag in a tool's
# index.html. Captures the src attribute.
SCRIPT_SRC_RE = re.compile(r'<script\s+src="([^"]+)"(?:\s+defer)?\s*></script>')


def find_repo_root(start: Path) -> Path:
    """Walk up from `start` until we find tools.schema.json."""
    try:
        cur = start.resolve()
    except OSError as exc:
        sys.stderr.write(f"bundle-size-per-tool: cannot resolve {start}: {exc}\n")
        sys.exit(2)
    for parent in [cur, *cur.parents]:
        if (parent / SCHEMA_ANCHOR).is_file():
            return parent
        if (parent / "assets" / "js" / "ht-lazy.js").is_file():
            return parent
    sys.stderr.write(
        f"bundle-size-per-tool: cannot locate {SCHEMA_ANCHOR} or "
        f"assets/js/ht-lazy.js in {cur} or any ancestor.\n"
    )
    sys.exit(2)


def discover_tools(root: Path) -> list[tuple[str, Path]]:
    """Return [(slug, path), ...] for every tool page.

    Mirrors `discover_pages()` from _bundle_size_tier1.py but
    only enumerates `tools/<slug>/index.html`. Excludes the
    quiz-preview demo (it's a developer shell, not a real tool
    and ships its own scripts).

    Also enumerates pack routes under `tools/packs/<pack>/<slug>/`
    (added by DC-7 / Story 6). Each pack entry has its own
    parse-time budget via the same TOOL_CORE_BUDGET_BYTES_GZ +
    FIRST_PAINT_BUDGET_BYTES_GZ limits. The slug is namespaced
    as `<pack>/<slug>` so reports stay unambiguous.
    """
    tools: list[tuple[str, Path]] = []
    tools_dir = root / "tools"
    if not tools_dir.is_dir():
        return tools
    for slug_dir in sorted(tools_dir.iterdir()):
        if not slug_dir.is_dir():
            continue
        slug = slug_dir.name
        if slug == "quiz-preview":
            continue
        # Standalone tool page: tools/<slug>/index.html
        page = slug_dir / "index.html"
        if page.is_file():
            tools.append((slug, page))
        # Pack route: tools/<pack>/<entry>/index.html (recursive).
        # A "pack" directory is one whose immediate children are
        # all entry folders (each with its own index.html). We
        # only recurse one level — packs are not nested deeper.
        packs_dir = slug_dir / "packs"
        if not packs_dir.is_dir():
            continue
        for pack_dir in sorted(packs_dir.iterdir()):
            if not pack_dir.is_dir():
                continue
            for entry_dir in sorted(pack_dir.iterdir()):
                if not entry_dir.is_dir():
                    continue
                entry_page = entry_dir / "index.html"
                if entry_page.is_file():
                    # namespace: 'packs/<pack>/<entry>' so reports
                    # distinguish pack entries from standalone tools
                    tools.append((f"packs/{pack_dir.name}/{entry_dir.name}", entry_page))
    return tools


def resolve_tool_script_path(root: Path, slug: str, src: str) -> Path | None:
    """Map a tool-level `src="..."` value to a real file under
    `tools/<slug>/` (or `../../assets/js/<vendor>.js` for vendor
    scripts).

    Returns None if the src can't be resolved.
    """
    if src.startswith("http://") or src.startswith("https://") or src.startswith("//"):
        return None
    # Tool-level `./<name>.js` — resolve relative to tools/<slug>/
    if src.startswith("./"):
        cleaned = src[2:]
        candidate = root / "tools" / slug / cleaned
        if candidate.is_file():
            return candidate
        return None
    # Vendor `../../assets/js/<name>.js`
    cleaned = src
    while cleaned.startswith("../"):
        cleaned = cleaned[3:]
    if not cleaned.startswith("assets/"):
        return None
    candidate = root / cleaned
    if candidate.is_file():
        return candidate
    return None


def parse_tool_sources(page_source: str) -> list[str]:
    """Return every `<script src="...">` src on a tool page.

    Tool pages use `./<name>.js` for the tool core and
    `../../assets/js/<name>.js` for Tier 1 + vendor. We grab all
    srcs so we can detect drift (handlers eagerly loaded) and
    vendor scripts for the first-paint sum.
    """
    return SCRIPT_SRC_RE.findall(page_source)


def measure_tool(root: Path, slug: str, path: Path) -> dict:
    """Measure one tool's parse-time payload (gz).

    Returns a dict with:
      - slug
      - kind: 'split' if `<slug>-core.js` is the eager script, else
        'monolithic' if `<slug>.js` is the eager script, else 'none'.
      - core_gz: gz bytes of the parse-time core script
      - core_path: the resolved file path of the core script
      - core_src: the script src as written on the page
      - vendor_gz: gz bytes of vendor scripts
      - vendor_scripts: list of resolved vendor file paths
      - css_gz: gz bytes of per-tool CSS (`<slug>.css`)
      - css_path: the resolved per-tool CSS file path
      - first_paint_gz: core + vendor + css
      - all_scripts: every `<script src>` on the page (for visibility)
      - drift: list of drift findings (e.g., eagerly-loaded handlers)
    """
    page_source = path.read_text(encoding="utf-8")
    srcs = parse_tool_sources(page_source)

    # Identify the tool's parse-time core script. Prefer split
    # `<slug>-core.js`; fall back to monolithic `<slug>.js`. If
    # neither is found, kind='none' (drift — tool has lost its
    # core script).
    #
    # Note: some split tools use a short-name pattern (e.g.,
    # `bd-tax-core.js` for slug `bd-tax-calculator`). For those,
    # we derive the short name by stripping common suffixes from
    # the slug. The short name is checked first when it's a
    # distinct string from the slug.
    short = None
    for suf in ("-calculator", "-converter", "-estimator", "-formatter",
                "-generator", "-inspector", "-scaler", "-tester",
                "-timer", "-tracker", "-viewer"):
        if slug.endswith(suf) and len(slug) > len(suf):
            short = slug[: -len(suf)]
            break

    candidates: list[str] = []
    if short and short != slug:
        candidates.append(f"./{short}-core.js")
    candidates.append(f"./{slug}-core.js")
    candidates.append(f"./{slug}.js")

    core_src = None
    core_path = None
    for cand in candidates:
        if cand in srcs:
            core_src = cand
            core_path = resolve_tool_script_path(root, slug, cand)
            break

    if core_src and core_src.endswith("-core.js"):
        kind = "split"
    elif core_src and core_src.endswith(f"./{slug}.js"):
        kind = "monolithic"
    else:
        kind = "none"

    core_gz = 0
    if core_path is not None:
        core_gz = len(gzip.compress(core_path.read_bytes()))

    # Vendor scripts: from the per-tool TOOL_VENDOR_SCRIPTS map.
    # Match by basename only; ignore paths. Sum gz of all vendor
    # scripts that appear in the page's src list.
    vendor_gz = 0
    vendor_files: list[dict] = []
    for vendor_name in TOOL_VENDOR_SCRIPTS.get(slug, []):
        vendor_candidates = [
            s for s in srcs if s.rsplit("/", 1)[-1] == vendor_name
        ]
        for v_src in vendor_candidates:
            v_path = resolve_tool_script_path(root, slug, v_src)
            if v_path is None:
                continue
            v_gz = len(gzip.compress(v_path.read_bytes()))
            vendor_gz += v_gz
            vendor_files.append({
                "src": v_src,
                "file": str(v_path.relative_to(root)),
                "gz": v_gz,
            })

    # Per-tool CSS — `<slug>.css` in the tool's directory. Pairs
    # with the page's `<link rel="stylesheet" href="./<slug>.css">`
    # to make up the first-paint payload.
    css_path = root / "tools" / slug / f"{slug}.css"
    css_gz = 0
    if css_path.is_file():
        css_gz = len(gzip.compress(css_path.read_bytes()))

    first_paint_gz = core_gz + vendor_gz + css_gz

    # Drift detection: any tool that ships `<slug>-handlers.js`
    # in the eager `<script src>` of its index.html has drifted
    # out of lazy-handler shape. Handlers MUST be loaded via
    # `HT.lazyLoadTool(slug, url)` only.
    drift: list[str] = []
    handlers_marker = f"./{slug}-handlers.js"
    if handlers_marker in srcs:
        drift.append(
            f"{slug}: {handlers_marker} found in eager <script src> — "
            f"handlers must load via HT.lazyLoadTool('{slug}', ...) only"
        )

    return {
        "slug": slug,
        "path": str(path.relative_to(root)),
        "kind": kind,
        "core_src": core_src,
        "core_path": (
            str(core_path.relative_to(root)) if core_path is not None else None
        ),
        "core_gz": core_gz,
        "vendor_gz": vendor_gz,
        "vendor_scripts": vendor_files,
        "css_path": (
            str(css_path.relative_to(root)) if css_path.is_file() else None
        ),
        "css_gz": css_gz,
        "first_paint_gz": first_paint_gz,
        "all_scripts": srcs,
        "drift": drift,
    }


def render_breakdown(tools: list[dict], core_budget: int) -> str:
    """Render per-tool gz sizes sorted by core size descending."""
    sorted_tools = sorted(tools, key=lambda t: -t["core_gz"])
    lines = []
    for t in sorted_tools:
        marker = "OK" if (
            t["core_gz"] <= core_budget
            and t["first_paint_gz"] <= FIRST_PAINT_BUDGET_BYTES_GZ
            and not t["drift"]
        ) else "FAIL"
        kind_marker = "S" if t["kind"] == "split" else (
            "M" if t["kind"] == "monolithic" else "?"
        )
        lines.append(
            f"  {marker:4s}  {kind_marker}  {t['slug']:24s}  "
            f"core={t['core_gz']:>5,d}  "
            f"+vendor={t['vendor_gz']:>5,d}  "
            f"+css={t['css_gz']:>5,d}  "
            f"first-paint={t['first_paint_gz']:>6,d}  "
            f"({t['first_paint_gz'] / 1024:.1f} KB)"
        )
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument(
        "--root",
        help="explicit repo root (default: walk up to find tools.schema.json)",
    )
    parser.add_argument(
        "--core-budget",
        type=int,
        default=TOOL_CORE_BUDGET_BYTES_GZ,
        help=f"per-tool core budget in bytes gz (default: "
             f"{TOOL_CORE_BUDGET_BYTES_GZ:,d})",
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

    tools = discover_tools(root)
    print(
        f"bundle-size-per-tool: measuring {len(tools)} tool(s) "
        f"(core budget {args.core_budget:,d} bytes gz, "
        f"first-paint budget {FIRST_PAINT_BUDGET_BYTES_GZ:,d} bytes gz)…"
    )
    print("")

    measured = [measure_tool(root, slug, p) for slug, p in tools]
    print(render_breakdown(measured, args.core_budget))

    over_core = [t for t in measured if t["core_gz"] > args.core_budget]
    over_paint = [
        t for t in measured
        if t["first_paint_gz"] > FIRST_PAINT_BUDGET_BYTES_GZ
    ]
    drift_tools = [t for t in measured if t["drift"]]
    no_core = [t for t in measured if t["kind"] == "none"]

    max_core = max((t["core_gz"] for t in measured), default=0)
    avg_core = (
        sum(t["core_gz"] for t in measured) // len(measured)
        if measured
        else 0
    )
    split_count = sum(1 for t in measured if t["kind"] == "split")
    mono_count = sum(1 for t in measured if t["kind"] == "monolithic")

    print("")
    print(
        f"  max core gz: {max_core:,d} bytes / "
        f"core budget: {args.core_budget:,d} bytes "
        f"({args.core_budget / 1024:.1f} KB)"
    )
    print(
        f"  avg core gz: {avg_core:,d} bytes across {len(measured)} tool(s); "
        f"split: {split_count}, monolithic: {mono_count}"
    )

    summary = {
        "tools": len(measured),
        "core_budget": args.core_budget,
        "core_budget_label": TOOL_CORE_LABEL,
        "first_paint_budget": FIRST_PAINT_BUDGET_BYTES_GZ,
        "first_paint_budget_label": FIRST_PAINT_LABEL,
        "max_core_gz": max_core,
        "avg_core_gz": avg_core,
        "split_count": split_count,
        "monolithic_count": mono_count,
        "over_core_count": len(over_core),
        "over_paint_count": len(over_paint),
        "drift_count": len(drift_tools),
        "no_core_count": len(no_core),
        "over_core": [t["slug"] for t in over_core],
        "over_paint": [
            {"slug": t["slug"], "first_paint_gz": t["first_paint_gz"]}
            for t in over_paint
        ],
        "drift": [t["drift"] for t in drift_tools],
        "no_core": [t["slug"] for t in no_core],
        "details": measured,
    }
    print("")
    print("JSON:" + json.dumps(summary))

    failures: list[str] = []
    for t in over_core:
        failures.append(
            f"{t['slug']} core gz = {t['core_gz']:,d} > "
            f"core budget {args.core_budget:,d} bytes — extract more "
            f"into {t['slug']}-handlers.js or trim the core."
        )
    for t in over_paint:
        failures.append(
            f"{t['slug']} first-paint gz = {t['first_paint_gz']:,d} > "
            f"first-paint budget {FIRST_PAINT_BUDGET_BYTES_GZ:,d} bytes — "
            f"split out page-conditional code or vendor dependencies."
        )
    for t in drift_tools:
        for finding in t["drift"]:
            failures.append(finding)
    for t in no_core:
        failures.append(
            f"{t['slug']} has no eager <slug>-core.js or <slug>.js — "
            f"tool has lost its parse-time script."
        )

    if args.no_fail:
        print("")
        print(
            f"bundle-size-per-tool: --no-fail set; "
            f"max core={max_core:,d}/{args.core_budget:,d}, "
            f"split={split_count}/{len(measured)} reported without "
            f"exit-code consequences"
        )
        return 0

    if failures:
        print("")
        for v in failures:
            print(f"  FAIL  {v}")
        print(f"bundle-size-per-tool: {len(failures)} failure(s)")
        return 1

    print("")
    print(
        f"bundle-size-per-tool: PASS "
        f"({len(measured)}/{len(measured)} tools under "
        f"{args.core_budget:,d} bytes core gz; "
        f"{split_count} split, {mono_count} monolithic; "
        f"max={max_core:,d}, avg={avg_core:,d})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
