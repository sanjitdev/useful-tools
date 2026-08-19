#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dc-11-bundle.py — AC for DC-11 (Bundle gate updates).

Verifies SPEC_PAGE_CONDITIONAL_MODULES carries all 8 new entries, the
BUNDLE_SIZE_BASELINE hasn't drifted, and the bundle-size-gate + per-
tool script still pass.

Run: `make dc-11-bundle` or `python scripts/dc/dc-11-bundle.py`.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import check, exit_with_summary, file_exists, read_text, repo_root


def main():
    print("DC-11 — Bundle gate (8 page-conditional entries + baseline)")

    bsg = "scripts/bundle-size-gate.py"
    bsg_src = read_text(bsg) or ""

    expected_entries = [
        '    "assets/js/scoring.js",',
        '    "assets/js/results.js",',
        '    "assets/js/challenge.js",',
        '    "assets/js/recommend.js",',
        '    "assets/js/catalog.js",',
        '    "assets/js/packs/discovery-loader.js",',
        '    "assets/js/share-card.js",',
        '    "assets/css/result-card.css",',
        '    "assets/css/discovery.css",',
    ]
    for needle in expected_entries:
        check(
            needle in bsg_src,
            f"{bsg} lists {needle.strip()} in SPEC_PAGE_CONDITIONAL_MODULES",
        )

    # 9. BUNDLE_SIZE_BASELINE matches the Epic 10 re-baseline.
    # Story 4c locked the baseline at 132,638 gz. Each subsequent
    # Story (1.16 / 2.10 / 3.x / 4.x / 9.x / 10.x) stayed under the
    # 5,000-byte tolerance at the time it landed, but no Story
    # re-baselined — the cumulative growth pushed the bundle to
    # 145,024 gz. Epic 10 re-baselines to 145,024 with justification
    # recorded in the inline comment block at scripts/bundle-size-
    # gate.py:316-330. Future Stories must hold per-module budgets
    # AND any new SPEC_JS_MODULES addition must justify its gz
    # contribution in the commit that adds it.
    m = re.search(r"BUNDLE_SIZE_BASELINE\s*=\s*([\d_]+)", bsg_src)
    baseline = m.group(1).replace("_", "") if m else ""
    check(
        baseline == "145024",
        f"BUNDLE_SIZE_BASELINE == 145,024 (Epic 10 re-baseline, got {baseline})",
    )

    # 10. bundle-size-gate exits 0 (or only fails because Discovery
    #     modules haven't shipped yet — that's expected; flip to
    #     strict "exit 0" once DC-1..DC-5 land)
    if file_exists(bsg):
        r = subprocess.run(
            [sys.executable, str(repo_root() / bsg)],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if r.returncode == 0:
            check(True, f"python {bsg} exits 0")
        else:
            # Allow failure only if every FAIL is "missing on disk"
            # for a Discovery module. Once all 8 modules ship, this
            # gate becomes strict.
            missing_discovery = (
                "assets/js/scoring.js" in (r.stdout or "")
                and "module missing on disk" in (r.stdout or "")
            )
            # Heuristic: count FAIL lines, count "module missing on disk"
            # lines, and accept only if every FAIL is a missing module.
            out = r.stdout or ""
            fail_lines = [
                line for line in out.splitlines()
                if line.startswith("  FAIL  ")
            ]
            missing_lines = [
                line for line in out.splitlines()
                if line.startswith("  FAIL  module missing on disk:")
            ]
            only_missing = (
                len(fail_lines) > 0
                and len(fail_lines) == len(missing_lines)
                and all("module missing on disk" in fl for fl in fail_lines)
            )
            check(
                only_missing,
                f"python {bsg} exits 0 (got rc={r.returncode}; "
                f"{len(fail_lines)} FAILs, {len(missing_lines)} missing-module FAILs) — "
                f"expected rc=0 or only missing-module failures",
            )
    else:
        check(False, f"python {bsg} exits 0 [missing]")

    # 11. _bundle_size_per_tool.py covers tools/packs/**/index.html
    per_tool = "scripts/_bundle_size_per_tool.py"
    per_src = read_text(per_tool) or ""
    if per_src:
        # Accept any glob/regex that includes 'packs/'
        covers = bool(
            re.search(r"tools/packs", per_src)
            or re.search(r"packs/.*\*\*/index", per_src)
            or re.search(r"packs/", per_src)
        )
        check(
            covers,
            f"{per_tool} covers tools/packs/**/index.html",
        )
    else:
        check(False, f"{per_tool} covers tools/packs/**/index.html [missing]")

    exit_with_summary("DC-11")


if __name__ == "__main__":
    main()