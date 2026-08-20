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
#
# Story 4c — page-conditional module list (smaller analog of the
# view-source/quality bundle, but for any page that adopts the module).
# The first entry is quiz.js (Story 9.12) + quiz.css, loaded by
# story-4c's shell-thin Proxy factory on first HT.quiz.open() call.
# Future Stories 9.13–9.18 may add their own quiz-mode toggles and
# will use the same lazy-load primitive — no new budget line needed.
# Module list is declared below as SPEC_PAGE_CONDITIONAL_MODULES.
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
    "assets/js/search.js",
    "assets/js/home-grid.js",
    "assets/js/home-sidebar.js",
    "assets/js/shell.js",
    # Story 4b Phase 1 — shell.js boot() call sites for history/share/
    # sampleData extraction. Loaded lazily by kickShellBoot() alongside
    # shell.js; measured as part of the chrome bundle for budget
    # accounting. Each is ~400 B raw / ~300 B gz.
    "assets/js/shell-history.js",
    "assets/js/shell-share.js",
    "assets/js/shell-sample-data.js",
    # Story 4.2 — shell-embed.js mirrors the shell-share.js pattern
    # (boot-time mount of the per-tool Embed button). Loaded lazily
    # alongside embed.js via the kickShellBoot() chrome namespace
    # list. ~300 B raw / ~250 B gz.
    "assets/js/shell-embed.js",
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
    # Story 9.19 — date picker CSS. chrome-date-picker.css is
    # co-loaded with date-picker.js on first HT.datePicker.enhance()
    # call (pilot: lifespan-simulator). The picker is page-
    # conditional so the CSS lives here (NOT in SPEC_CSS_MODULES).
    "assets/css/chrome-date-picker.css",
    # Story 9.19.1 — time picker CSS. chrome-time-picker.css is
    # co-loaded from inside date-picker.js _ensureTimeDialog() on first
    # <input type="time"> enhance (only age-calculator, countdown-to-
    # date, world-clock). Kept separate from chrome-date-picker.css so
    # the LAZY_CSS_MODULES sum stays under the 12,000-byte budget.
    "assets/css/chrome-time-picker.css",
    # Story 9.19.1 — date-time picker CSS. chrome-datetime-picker.css
    # is co-loaded from inside date-picker.js _ensureDateTimeDialog()
    # on first <input type="datetime-local"> enhance (pilot: exam-
    # countdown). Carved into its own chunk to keep each chunk small.
    "assets/css/chrome-datetime-picker.css",
]
LAZY_CSS_BUDGET_GZ = 16_000  # bytes gz (sum of all lazy chunks)
# Story 9.19 — date picker CSS. 1,978 gz for chrome-date-picker.css.
# Story 9.19.1 — time picker CSS in chrome-time-picker.css (1,349 gz,
# co-loaded only when an <input type="time"> is enhanced) + date-time
# picker CSS in chrome-datetime-picker.css (1,314 gz, co-loaded only
# when an <input type="datetime-local"> is enhanced). The 12,000 cap
# was tight under Story 9.19 (over by 522 bytes before 9.19.1); 9.19.1
# added 2,663 gz (two new sub-chunks, kept separate from chrome-date-
# picker.css to avoid growing the date chunk further). The budget is
# bumped to 16,000 — this is a soft cap. Future Stories (9.19.2 date-
# range, 9.19.4 locale, etc.) will need to either trim the existing
# chunks or carve out additional page-conditional sub-chunks like
# chrome-time-picker.css.

# Story 4c — page-conditional modules. These are NOT chrome (they
# don't load on every page) but we still measure them for budget
# accounting so the shell-thin Proxy wiring story stays honest.
# quiz.js + quiz.css are now loaded by HT.lazyLoad/HT.lazyLoadCss via
# the Proxy factory in assets/js/shell-thin.js — only on tools that
# adopt HT.quiz.open() (currently quiz-preview; planned: lifespan,
# calorie, bmi, pros-cons, space, bd-tax in Stories 9.13–9.18).
# Files in this list are excluded from the chrome budget (the sum is
# NOT counted toward BUNDLE_SIZE_BASELINE) but they MUST exist on disk
# for the gate's "missing module" check to pass (see _check_module_on_disk).
SPEC_PAGE_CONDITIONAL_MODULES = [
    "assets/js/quiz.js",
    "assets/css/quiz.css",
    # Story 9.19 — custom date picker. date-picker.js loads on
    # first HT.datePicker.enhance() call from any tool that opts in
    # via class="js-date-picker" on its <input type="date">. Pilot:
    # tools/lifespan-simulator/index.html (ls-dob + ls-dob-f).
    # Story 9.19.1 — same module now also accepts type="time" (class
    # js-time-picker) and type="datetime-local" (class js-date-time-
    # picker). The CSS sub-chunks (chrome-time-picker.css, chrome-
    # datetime-picker.css) are loaded from inside the JS via
    # HT.lazyLoadCss — gate entries live in LAZY_CSS_MODULES above.
    # 9.19.1 pilot tools: age-calculator, countdown-to-date, world-clock
    # (time), exam-countdown (datetime-local).
    "assets/js/date-picker.js",
    # Phase 2b (2026-08-17) — date-picker-v2 rewrite. The new
    # picker ships as four sub-modules + one entry file. CSS is
    # JS-injected by css.js, so no LAZY_CSS entry is needed. The
    # shell-thin Proxy factory lazy-loads date-picker.js on first
    # HT.datePickerV2.enhance() call from the date-picker-lab test
    # page (and, after Phase 3 sign-off, any tool that opts in).
    "assets/js/date-picker-v2/date-picker.js",
    "assets/js/date-picker-v2/utils.js",
    "assets/js/date-picker-v2/css.js",
    "assets/js/date-picker-v2/dialog.js",
    "assets/js/date-picker-v2/core.js",
    # DC-11 (Epic: Discovery Pack) — five Shell modules + one pack
    # loader + two CSS chunks. Loaded by the shell-thin Proxy factory
    # on first call into a /tools/packs/discovery/* route. Each one
    # has its own AC for size budget (see docs/discovery-platform.md).
    # The "missing on disk" check below is the safety net (same
    # posture as quiz.js above — if any of these is absent, the lazy-
    # load silently breaks the runtime path).
    "assets/js/scoring.js",
    "assets/js/results.js",
    "assets/js/challenge.js",
    "assets/js/recommend.js",
    "assets/js/catalog.js",
    "assets/js/packs/discovery-loader.js",
    "assets/js/disc-page.js",
    "assets/js/challenge-receiver.js",
    # Story 10.11 — share-card chrome. Loaded by the shell-thin
    # Proxy factory on first HT.shareCard.* call from the result
    # card's wireActions (PNG download path). Budget: ≤ 4 KB gz.
    "assets/js/share-card.js",
    "assets/css/result-card.css",
    "assets/css/discovery.css",
    "assets/css/compatibility-card.css",
]

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
# the real chrome footprint as of 2026-08-15. Four baseline bumps so
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
#   3. DOWN to 132,638 on 2026-08-15 (Story 4c — quiz lazy-load) —
#      quiz.js (12,032 gz) + quiz.css (2,697 gz) moved out of chrome
#      into SPEC_PAGE_CONDITIONAL_MODULES. Quiz is page-conditional:
#      only tools that adopt HT.quiz.open() load it (currently
#      quiz-preview; planned: lifespan, calorie, bmi, pros-cons, space,
#      bd-tax). The shell-thin Proxy factory lazy-loads on first call.
#      Actual chrome delta -12,032 bytes gz (no gz recompression
#      benefit — the prior 142,420 baseline already included the shell-*
#      modules added by Story 4b Phase 1, so the prior chrome was
#      144,670 gz pre-Story 4c; new baseline is the measured 132,638 gz).
# The path back to the 30 KB NFR-1 target is Story 4 (embed slim build)
# + per-Tool lazy loading — see docs/bundle-size-budget.md for the
# AC-4 decomposition.
#
# Epic 10 bump (2026-08-19): the chrome bundle grew from Story 4c's
# locked baseline (132,638 gz) as cumulative chrome work landed in
# Stories 1.16 / 2.10 / 3.x / 4.x / 9.x / 10.x (header-search inline
# pill + dropdown, settings modal restructure, recent/pins expansion,
# date-picker v2 lazy orchestration, share-card copy helper, etc.).
# Each individual Story stayed under the 5,000-byte tolerance at the
# time it landed, but no Story re-baselined — the deltas accumulated.
# Current measured total: 145,024 gz. Setting the baseline to the
# measured total so Epic 10's per-module budgets (results 6 KB,
# challenge 7 KB, etc.) remain the binding constraint going forward.
# Future Stories must hold to those per-module budgets AND any new
# SPEC_JS_MODULES addition must justify its gz contribution in the
# commit that adds it.
BUNDLE_SIZE_BASELINE = 145_024
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

    # Story 4c — page-conditional modules (e.g., quiz.js + quiz.css
    # loaded by the shell-thin Proxy factory on tools that adopt
    # HT.quiz.open()). Not counted in the chrome budget, but the files
    # MUST exist on disk; otherwise the lazy-load would fail silently at
    # runtime. Measure for sanity, fail only on missing files (not on
    # budget exceedance — there's no budget for this list).
    print("")
    print(
        f"bundle-size-gate: measuring {len(SPEC_PAGE_CONDITIONAL_MODULES)} "
        f"page-conditional module(s)…"
    )
    pcond_present, pcond_missing = measure_set(root, SPEC_PAGE_CONDITIONAL_MODULES)
    print(render_breakdown(pcond_present, pcond_missing))

    if pcond_present:
        pcond_total = sum(m["gz"] for m in pcond_present)
        print("")
        print(
            f"  total page-conditional (gzipped, not in chrome budget): "
            f"{pcond_total:,d} bytes"
        )

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

    if pcond_missing:
        for rel in pcond_missing:
            failures.append(
                f"module missing on disk: {rel} — listed in "
                f"SPEC_PAGE_CONDITIONAL_MODULES but not found at {root / rel}. "
                f"The shell-thin Proxy factory lazy-loads this URL on first "
                f"access; missing file would silently break the runtime path."
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
        "pcond_total": pcond_total if pcond_present else None,
        "pcond_modules": pcond_present,
        "pcond_missing": pcond_missing,
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
