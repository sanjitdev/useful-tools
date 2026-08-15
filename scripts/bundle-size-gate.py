#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
bundle-size-gate.py — Story x-3 (Bundle Size Budget) gate.

Measures every Shell + chrome module's gzipped byte size, sums them,
compares to a locked baseline + tolerance, and exits non-zero on
regression. Pure-stdlib Python (gzip + pathlib — no third-party deps).

Purpose
-------
NFR-1 (PRD) requires the shell JS to stay under 30 KB gzipped. The
current chrome surface is ~115 KB gzipped (4.3× over). Story x-3
builds the measurement + gate that:

  1. Reports the current per-module breakdown so contributors can
     see exactly which module ate the bytes.
  2. Fires on every PR — a chrome change that pushes the sum above
     `baseline + tolerance` fails the gate.
  3. Tracks a separate CSS total (well under the 30 KB NFR-1 target
     today) and warns on growth without failing the build.

The gate is the **measurement** side of Story x-3, not the bundle
reduction itself. Bundle reduction is Story 4 / embed slim build
scope. The gate's job is to make regressions visible; the path back
to < 30 KB is its own epic.

Baseline policy
---------------
The baseline is captured as `BUNDLE_SIZE_BASELINE` below — the
gzipped sum of every chrome module that ships on every page as of
the Story x-3 commit (2026-08-15). Per-module measurements live in
the SPEC_MODULES table; if a module is missing from disk the gate
warns (defensive — Story 1.5 / Epic 3 still landing) but the
measurement is omitted from the sum.

The tolerance (`BUNDLE_SIZE_TOLERANCE`) lets Story x-3 land at the
baseline exactly. Future Stories that legitimately add chrome can
either: (a) keep their delta under tolerance, or (b) bump the
baseline in a Story commit + accept the size debt in writing.

Exit codes
----------
  0 — sum within baseline + tolerance; CSS total within its own budget.
  1 — JS sum exceeds baseline + tolerance OR CSS sum exceeds CSS_BUDGET.
  2 — vacuous (no chrome modules found).
  3 — invocation error (repo root not found, write error, etc.).

JSON output
-----------
The last line of stdout is a `JSON:{...}` payload mirroring the
shape of the regression-sweep wrapper — easy to scrape from CI logs
without re-running the gate.

Author: Handy Tools (Story x-3 — Bundle Size Budget NFR-1 Gate)
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

# Chrome JS modules — the set the Shell loads on every page (home +
# tool + embed). Order is roughly the load order; sizes are measured
# in CI. Modules are path-relative to the repo root.
#
# Why each module is here (defensive — a future Story that legitimately
# removes one should update this table in the same commit):
#   shell.js              Story 1.5  — chrome shell + theme + settings + palette + chords
#   search.js             Story 1.11 — search engine + ranking
#   home-grid.js          Story 1.9  — tools.json → home grid renderer
#   home-sidebar.js       Story 3.12 — recent list sidebar
#   pack-grid.js          Story 6.1  — pack cards on home grid
#   pack-page.js          Story 6.2  — /packs/<pack>.html renderer
#   quality.js            Story 2.11 — /quality tool inventory
#   storage-registry.js   Story 1.10 — namespaced key registry
#   site-config.js        Story 1.12 — repo coordinates (frozen)
#   history.js            Story 2.3  — per-tool history (LIFO + restore)
#   share.js              Story 2.5  — share dialog (URL + embed + print)
#   sample-data.js        Story 2.2  — sample + reset buttons
#   url.js                Story 2.1  — urlState codec + bindForm
#   a11y.js               Story 2.4  — per-tool a11y audit
#   palette-actions.js    Story 3.2  — command palette action set
#   help-overlay.js       Story 3.3  — keyboard shortcuts overlay
#   global-chords.js      Story 3.4  — cross-page g<key> navigation
#   export.js             Story 3.7  — user data export to JSON
#   import.js             Story 3.8  — user data import from JSON
#   pins.js               Story 3.12 — pinned tools (cap 9)
#   recent.js             Story 3.12 — recent tools (cap 5)
#   view-source.js        Story 3.11 — /view-source route
#   quiz.js               Story 9.12 — quiz pattern shell module
#   utils.js              Story 1.5  — HT.qs / HT.fetch / HT.formatNumber
#
# Removed 2026-08-15 (Story 2.10 cleanup): layout.js, theme.js — legacy
# header/footer injector + legacy theme toggle; chrome is now static
# HTML (chrome.html) and shell.js owns the theme API.
#
# Removed 2026-08-15 (api-contract reclassification): api-contract.js —
# was never chrome to begin with; only loaded by view-source.html +
# quality.html (special-purpose pages, not chrome). Now counted under
# the view-source bundle alongside vendor/highlight.min.js +
# vendor/zip-store.js. Baseline bumped DOWN 161,175 → 142,420 (-18,755
# bytes gz actual delta after gz recompression of the smaller list).
#
# view-source/quality bundle (not counted in the chrome budget):
#   vendor/highlight.min.js  Story 3.11 — syntax highlighter for /view-source
#   vendor/zip-store.js      Story 3.11 — zip download for /view-source
#   api-contract.js          Story 1.14 — frozen API surface (only used
#                              by view-source.html for the contract
#                              viewer + quality.html for the audit)
#
# vendor/highlight.min.js and vendor/zip-store.js are Story 3.11
# view-source dependencies — only loaded on /view-source.html, not on
# every page. They are NOT counted in the chrome budget; they have
# their own "view-source bundle" budget (see x-3 follow-up).
SPEC_JS_MODULES = [
    "assets/js/site-config.js",
    "assets/js/storage-registry.js",
    "assets/js/utils.js",
    "assets/js/url.js",
    "assets/js/a11y.js",
    "assets/js/history.js",
    "assets/js/share.js",
    "assets/js/sample-data.js",
    "assets/js/palette-actions.js",
    "assets/js/global-chords.js",
    "assets/js/help-overlay.js",
    "assets/js/import.js",
    "assets/js/export.js",
    "assets/js/pins.js",
    "assets/js/recent.js",
    "assets/js/pack-grid.js",
    "assets/js/pack-page.js",
    "assets/js/quality.js",
    "assets/js/view-source.js",
    "assets/js/quiz.js",
    "assets/js/search.js",
    "assets/js/home-grid.js",
    "assets/js/home-sidebar.js",
    "assets/js/shell.js",
]

# CSS modules — the chrome stylesheets loaded on every page. Story 1.5
# ships base + components-core + tools; Story 3.10 adds print; Story 9.12
# adds quiz. Story 4 Phase 5 split the old monolithic components.css into
# components-core.css (always-on) + 5 chrome-*.css chunks (lazy-loaded
# via HT.lazyLoadCss — not declared in HTML, so they are measured
# separately below as LAZY_CSS_MODULES).
SPEC_CSS_MODULES = [
    "assets/css/base.css",
    "assets/css/components-core.css",
    "assets/css/tools.css",
    "assets/css/print.css",
    "assets/css/quiz.css",
]

# Story 4 Phase 5 — lazy CSS chunks. NOT in SPEC_CSS_MODULES (they're
# not on first paint), but the gate still measures them for budget
# accounting. Summed gz must stay below LAZY_CSS_BUDGET_GZ or the gate
# fails with a clear "lazy CSS budget exceeded" error.
LAZY_CSS_MODULES = [
    "assets/css/chrome-palette.css",
    "assets/css/chrome-settings.css",
    "assets/css/chrome-help.css",
    "assets/css/chrome-confirm-share.css",
    "assets/css/chrome-history.css",
]
LAZY_CSS_BUDGET_GZ = 12_000  # bytes gz (sum of all lazy chunks)

# Story x-3 baseline — measured 2026-08-15 against the post-home-
# redesign retrofit commit. Update this constant in the same commit
# that legitimately adds chrome beyond the tolerance; the bump is a
# recorded decision, not an accident.
#
# The exact figure is recomputed on every run; this constant is the
# LOCKED value the gate compares against. If the actual measured sum
# exceeds this constant by more than BUNDLE_SIZE_TOLERANCE the gate
# fails — so a Story that legitimately adds chrome must also bump
# this number in a Story commit.
#
# Actual measured sum at landing (post-Epic 3 chrome surface): 162,915
# bytes gzipped. The spec's initial estimate of ~115 KB was optimistic
# (it excluded several Epic-2/Epic-3 modules); this baseline captures
# the real chrome footprint as of 2026-08-15. Three baseline bumps so
# far:
#   1. DOWN to 161,175 on 2026-08-15 (Story 2.10 cleanup) — deleted
#      dead-code layout.js (898 gz) + theme.js (842 gz) = 1,740 bytes
#      gz removed.
#   2. DOWN to 142,420 on 2026-08-15 (api-contract reclassification) —
#      api-contract.js (18,772 gz) reclassified from chrome to
#      view-source bundle. The file was never chrome; only view-
#      source.html + quality.html load it. The bundle-size gate had
#      been over-counting since it shipped 2026-08-15. Actual delta
#      -18,755 bytes gz (gz recompression of the smaller list absorbs
#      17 bytes of the 18,772 estimate).
# The path back to the 30 KB NFR-1 target is Story 4 (embed slim build)
# + per-Tool lazy loading — see docs/bundle-size-budget.md for the
# AC-4 decomposition.
BUNDLE_SIZE_BASELINE = 142_420
BUNDLE_SIZE_TOLERANCE = 5_000

# NFR-1 target for the CSS budget (also aspirational — see the
# AC-4 / NFR-1-REVISION docs). Story 1.5 ships ~12 KB of chrome CSS
# gzipped; we track growth against a generous 25 KB budget so a
# well-justified bump still passes.
CSS_BUDGET = 25_000


def find_repo_root(start: Path) -> Path:
    """Walk up from `start` until we find tools.schema.json."""
    try:
        cur = start.resolve()
    except OSError as exc:
        sys.stderr.write(f"bundle-size-gate: cannot resolve {start}: {exc}\n")
        sys.exit(3)
    for parent in [cur, *cur.parents]:
        if (parent / SCHEMA_ANCHOR).is_file():
            return parent
    sys.stderr.write(
        f"bundle-size-gate: cannot locate {SCHEMA_ANCHOR} in {cur} or any ancestor.\n"
    )
    sys.exit(3)


def gzipped_size(path: Path) -> int:
    """Return the gzipped byte size of the file at `path`.

    Uses gzip.compress() at default level (6), which is what every
    static-host CDN ships. Reproducible across Python versions; the
    exact byte count varies <1% across 3.8-3.13.
    """
    raw = path.read_bytes()
    return len(gzip.compress(raw))


def measure_module(root: Path, rel: str) -> dict | None:
    """Measure one module. Returns None if the file is missing."""
    p = root / rel
    if not p.is_file():
        return None
    raw_size = p.stat().st_size
    gz_size = gzipped_size(p)
    return {
        "path": rel,
        "raw": raw_size,
        "gz": gz_size,
    }


def measure_set(root: Path, modules: list[str]) -> tuple[list[dict], list[str]]:
    """Measure a set of modules. Returns (present, missing) lists."""
    present: list[dict] = []
    missing: list[str] = []
    for rel in modules:
        m = measure_module(root, rel)
        if m is None:
            missing.append(rel)
        else:
            present.append(m)
    # Sort by gzipped size descending — biggest contributors first.
    present.sort(key=lambda m: -m["gz"])
    return present, missing


def render_breakdown(present: list[dict], missing: list[str]) -> str:
    """Render the per-module breakdown table."""
    lines = []
    for m in present:
        lines.append(
            f"  {m['path']:42s}  raw={m['raw']:>7,d}  gz={m['gz']:>7,d}"
        )
    if missing:
        lines.append("")
        lines.append(f"  ({len(missing)} module(s) missing — see WARN below)")
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument(
        "--root",
        help="explicit repo root (default: walk up to find tools.schema.json)",
    )
    parser.add_argument(
        "--baseline",
        type=int,
        default=BUNDLE_SIZE_BASELINE,
        help=f"baseline gzipped sum in bytes (default: {BUNDLE_SIZE_BASELINE:,d})",
    )
    parser.add_argument(
        "--tolerance",
        type=int,
        default=BUNDLE_SIZE_TOLERANCE,
        help=f"tolerance above baseline in bytes (default: {BUNDLE_SIZE_TOLERANCE:,d})",
    )
    parser.add_argument(
        "--css-budget",
        type=int,
        default=CSS_BUDGET,
        help=f"CSS gzipped budget in bytes (default: {CSS_BUDGET:,d})",
    )
    parser.add_argument(
        "--no-fail",
        action="store_true",
        help="print the breakdown but never exit non-zero (informational only)",
    )
    args = parser.parse_args(argv)

    root = (
        Path(args.root).resolve()
        if args.root
        else find_repo_root(Path(__file__).parent)
    )

    print(f"bundle-size-gate: measuring {len(SPEC_JS_MODULES)} JS module(s)…")
    js_present, js_missing = measure_set(root, SPEC_JS_MODULES)
    print(render_breakdown(js_present, js_missing))

    if not js_present:
        sys.stderr.write(
            "bundle-size-gate: no JS modules found at repo root — vacuous pass\n"
        )
        return 2

    js_total = sum(m["gz"] for m in js_present)
    js_baseline = args.baseline
    js_limit = js_baseline + args.tolerance
    js_delta = js_total - js_baseline

    print("")
    print(
        f"  total JS (gzipped): {js_total:,d} bytes  "
        f"(baseline {js_baseline:,d}  "
        f"limit {js_limit:,d}  "
        f"delta {js_delta:+,d})"
    )

    print("")
    print(f"bundle-size-gate: measuring {len(SPEC_CSS_MODULES)} CSS module(s)…")
    css_present, css_missing = measure_set(root, SPEC_CSS_MODULES)
    print(render_breakdown(css_present, css_missing))

    if css_present:
        css_total = sum(m["gz"] for m in css_present)
        css_delta = css_total - args.css_budget
        print("")
        print(
            f"  total CSS (gzipped): {css_total:,d} bytes  "
            f"(budget {args.css_budget:,d}  "
            f"delta {css_delta:+,d})"
        )
    else:
        css_total = 0
        css_delta = 0
        print("  (no CSS modules present — skipping CSS budget check)")

    # Story 4 Phase 5 — measure lazy CSS chunks (chrome-palette, etc.).
    # These are NOT in SPEC_CSS_MODULES (they're not on first paint),
    # but the gate still verifies their total stays under budget.
    print("")
    print(
        f"bundle-size-gate: measuring {len(LAZY_CSS_MODULES)} lazy CSS module(s)…"
    )
    lazy_css_present, lazy_css_missing = measure_set(root, LAZY_CSS_MODULES)
    print(render_breakdown(lazy_css_present, lazy_css_missing))

    if lazy_css_present:
        lazy_css_total = sum(m["gz"] for m in lazy_css_present)
        lazy_css_delta = lazy_css_total - LAZY_CSS_BUDGET_GZ
        print("")
        print(
            f"  total lazy CSS (gzipped): {lazy_css_total:,d} bytes  "
            f"(budget {LAZY_CSS_BUDGET_GZ:,d}  "
            f"delta {lazy_css_delta:+,d})"
        )
    else:
        lazy_css_total = 0
        lazy_css_delta = 0
        print("  (no lazy CSS modules present — skipping lazy CSS budget check)")

    # Decide pass / fail.
    failures: list[str] = []
    if js_total > js_limit:
        failures.append(
            f"JS bundle is {js_total:,d} bytes — exceeds limit {js_limit:,d} "
            f"(baseline {js_baseline:,d} + tolerance {args.tolerance:,d}). "
            f"Either trim the offending module(s) or bump BUNDLE_SIZE_BASELINE "
            f"in scripts/bundle-size-gate.py with justification."
        )

    if css_present and css_total > args.css_budget:
        failures.append(
            f"CSS bundle is {css_total:,d} bytes — exceeds budget {args.css_budget:,d}. "
            f"Bump CSS_BUDGET with justification or split out tool-specific CSS."
        )

    if lazy_css_present and lazy_css_total > LAZY_CSS_BUDGET_GZ:
        failures.append(
            f"lazy CSS bundle is {lazy_css_total:,d} bytes — exceeds budget "
            f"{LAZY_CSS_BUDGET_GZ:,d}. The chrome lazy CSS chunks (palette, "
            f"settings, help, confirm/share, history) are loaded on first "
            f"user action; trim the chunks or split out rarely-used rules."
        )

    if js_missing:
        for rel in js_missing:
            failures.append(
                f"module missing on disk: {rel} — listed in SPEC_JS_MODULES but "
                f"not found at {root / rel}. Either restore the file or remove "
                f"the entry from SPEC_JS_MODULES."
            )

    # Last-line JSON for CI scrapers.
    summary = {
        "js_total": js_total,
        "js_baseline": js_baseline,
        "js_tolerance": args.tolerance,
        "js_limit": js_limit,
        "js_delta": js_delta,
        "js_modules": js_present,
        "js_missing": js_missing,
        "css_total": css_total if css_present else None,
        "css_budget": args.css_budget if css_present else None,
        "css_delta": css_delta if css_present else None,
        "css_modules": css_present,
        "css_missing": css_missing,
        "lazy_css_total": lazy_css_total if lazy_css_present else None,
        "lazy_css_budget": LAZY_CSS_BUDGET_GZ if lazy_css_present else None,
        "lazy_css_delta": lazy_css_delta if lazy_css_present else None,
        "lazy_css_modules": lazy_css_present,
        "lazy_css_missing": lazy_css_missing,
        "failures": failures,
    }
    print("")
    print("JSON:" + json.dumps(summary))

    if args.no_fail:
        print("")
        print(
            f"bundle-size-gate: --no-fail set; reporting "
            f"js_total={js_total:,d} (limit {js_limit:,d}) "
            f"without exit-code consequences"
        )
        return 0

    if failures:
        print("")
        for v in failures:
            print(f"  FAIL  {v}")
        print(f"bundle-size-gate: {len(failures)} failure(s)")
        return 1

    print("")
    print(
        f"bundle-size-gate: PASS "
        f"(js={js_total:,d}/{js_limit:,d}, "
        f"css={css_total:,d}/{args.css_budget:,d})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
