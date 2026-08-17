#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dc-5-loader.py — AC for DC-5 (discovery-loader.js + discovery.css).

Verifies the pack entry-point + its CSS. Target: 11 PASS after DC-5.

Run: `make dc-5-loader` or `python scripts/dc/dc-5-loader.py`.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import (
    check,
    exit_with_summary,
    file_exists,
    gzipped_size,
    read_text,
    repo_root,
    run_node,
)


def main():
    print("DC-5 — discovery-loader.js + discovery.css (11 checks)")

    js_path = "assets/js/packs/discovery-loader.js"
    css_path = "assets/css/discovery.css"

    # 1, 2. files exist
    check(file_exists(js_path), f"{js_path} exists on disk")
    check(file_exists(css_path), f"{css_path} exists on disk")

    js_src = read_text(js_path) or ""
    css_src = read_text(css_path) or ""

    # 3. bundle-size-gate lists both
    bsg = read_text("scripts/bundle-size-gate.py") or ""
    check(
        bool(bsg) and '    "assets/js/packs/discovery-loader.js",' in bsg,
        "scripts/bundle-size-gate.py lists 'assets/js/packs/discovery-loader.js' in SPEC_PAGE_CONDITIONAL_MODULES",
    )
    check(
        bool(bsg) and '    "assets/css/discovery.css",' in bsg,
        "scripts/bundle-size-gate.py lists 'assets/css/discovery.css' in SPEC_PAGE_CONDITIONAL_MODULES",
    )

    # 4. no SPA framework imports
    has_react = bool(re.search(r"\b(import|require)\b.*\bfrom\s+['\"]react", js_src))
    has_vue = bool(re.search(r"\b(import|require)\b.*\bfrom\s+['\"]vue", js_src))
    has_svelte = bool(re.search(r"\b(import|require)\b.*\bfrom\s+['\"]svelte", js_src))
    has_htm = bool(re.search(r"\b(import|require)\b.*\bfrom\s+['\"]htm", js_src))
    check(
        not (has_react or has_vue or has_svelte or has_htm),
        "discovery-loader.js does NOT use SPA frameworks (no react/vue/svelte/htm)",
    )

    # 5. doesn't eagerly load any of the 5 modules (just declares the loader)
    eager_patterns = [
        'fetch("assets/js/scoring.js")',
        'fetch("assets/js/results.js")',
        'fetch("assets/js/challenge.js")',
        'fetch("assets/js/recommend.js")',
        'fetch("assets/js/catalog.js")',
        "lazyLoad('assets/js/scoring.js')",
        "lazyLoad('assets/js/results.js')",
        "lazyLoad('assets/js/challenge.js')",
        "lazyLoad('assets/js/recommend.js')",
        "lazyLoad('assets/js/catalog.js')",
    ]
    found_eager = [p for p in eager_patterns if p in js_src]
    check(
        not found_eager,
        "discovery-loader.js does NOT eagerly load any of the 5 modules",
    )

    # 6, 7. CSS classes
    check(
        bool(css_src) and ".discovery-pack-grid" in css_src,
        "discovery.css contains the .discovery-pack-grid class",
    )
    check(
        bool(css_src) and ".discovery-pack-card" in css_src,
        "discovery.css contains the .discovery-pack-card class",
    )

    # 8. honors prefers-reduced-motion
    check(
        bool(css_src) and "prefers-reduced-motion" in css_src,
        "discovery.css honors prefers-reduced-motion",
    )

    # 9, 10. sizes
    sz_js = gzipped_size(js_path) if file_exists(js_path) else None
    check(
        sz_js is not None and sz_js <= 2000,
        f"gzipped size of discovery-loader.js <= 2,000 bytes (got {sz_js})",
    )
    sz_css = gzipped_size(css_path) if file_exists(css_path) else None
    check(
        sz_css is not None and sz_css <= 4000,
        f"gzipped size of discovery.css <= 4,000 bytes (got {sz_css})",
    )

    # 11. smoke exists and exits 0
    smoke = "scripts/_smoke_discovery_pack.js"
    if file_exists(smoke):
        rc, _, _ = run_node(
            (repo_root() / smoke).read_text(encoding="utf-8") + "\n"
        )
        check(rc == 0, f"{smoke} exists and exits 0 via node (rc={rc})")
    else:
        check(False, f"{smoke} exists and exits 0 via node [missing]")

    exit_with_summary("DC-5")


if __name__ == "__main__":
    main()