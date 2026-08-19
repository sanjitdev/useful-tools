#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dc-14-result-card-actions.py — AC for Story 10.10 close.

Verifies that every Discovery quiz adopts the canonical
HT.results.render(state, opts) factory (Story 10.3 + 10.10) — i.e.
the per-quiz `renderReveal(answers, scored)` DOM builder has been
deleted and replaced with a single `HT.results.render(...)` call.

Per-quiz checks (× 10):
  - <slug>-core.js calls HT.results.render(...)
  - <slug>-core.js no longer defines a `function renderReveal(...)`
  - <slug>-core.js no longer calls animateBars(...)
  - <slug>-core.js wires reset click + focuses it after HT.results.render
  - <slug>.css no longer declares `.disc-actions { ... }`

Global checks:
  - assets/css/result-card.css declares `.discovery-card` rule (Story 10.10)
  - assets/js/results.js exists + freezes HT.results via Object.defineProperty
  - assets/js/api-contract.js documents HT.results.render
  - scripts/bundle-size-gate.py lists assets/css/result-card.css in
    SPEC_PAGE_CONDITIONAL_MODULES
  - scripts/_smoke_discovery_result.js exists and exits 0
  - gzipped size of result-card.css <= 4 KB
  - gzipped size of results.js <= 6 KB

Run: `python scripts/dc/dc-14-result-card-actions.py`.
"""
from __future__ import annotations

import json
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
    print("DC-14 — Result card actions (.discovery-card wrapper + on-page Share/Challenge)")

    css_path = "assets/css/result-card.css"
    results_js = "assets/js/results.js"
    smoke = "scripts/_smoke_discovery_result.js"

    # 1. Result-card CSS declares .discovery-card wrapper rule
    if file_exists(css_path):
        css_src = read_text(css_path) or ""
        check(bool(re.search(r"\.discovery-card\s*\{", css_src)),
              f"{css_path} declares .discovery-card rule")
        check(bool(re.search(r"\.discovery-card\s+\.quiz-result-actions\s*\{", css_src)),
              f"{css_path} declares .discovery-card .quiz-result-actions rule")
        check(bool(re.search(r"\.discovery-card\s+\.disc-actions\s*\{", css_src)),
              f"{css_path} aliases .discovery-card .disc-actions for Story 10.12 CTA")
    else:
        for label in (
            f"{css_path} declares .discovery-card rule",
            f"{css_path} declares .discovery-card .quiz-result-actions rule",
            f"{css_path} aliases .discovery-card .disc-actions for Story 10.12 CTA",
        ):
            check(False, label + " [missing]")

    # 2. results.js freezes the public API
    if file_exists(results_js):
        src = read_text(results_js) or ""
        has_freeze = bool(re.search(
            r'Object\.defineProperty\(\s*HT\s*,\s*[\'"]results[\'"]\s*,\s*\{[^}]*writable:\s*false[^}]*configurable:\s*false',
            src,
            re.DOTALL,
        ))
        check(has_freeze, f"{results_js} freezes HT.results (writable:false, configurable:false)")
        check("HT.results.render" in src, f"{results_js} exposes HT.results.render")
        check("HT.results.wireActions" in src, f"{results_js} exposes HT.results.wireActions")
        check("'data-action': 'share'" in src or 'data-action: "share"' in src,
              f"{results_js} emits data-action=\"share\" button")
        check("'data-action': 'challenge'" in src or 'data-action: "challenge"' in src,
              f"{results_js} emits data-action=\"challenge\" button")
        check("quiz-result-card discovery-card" in src,
              f"{results_js} emits class=\"quiz-result-card discovery-card\" root")
    else:
        for label in (
            f"{results_js} freezes HT.results",
            f"{results_js} exposes HT.results.render",
            f"{results_js} exposes HT.results.wireActions",
            f"{results_js} emits data-action=\"share\" button",
            f"{results_js} emits data-action=\"challenge\" button",
            f"{results_js} emits class=\"quiz-result-card discovery-card\" root",
        ):
            check(False, label + " [missing]")

    # 3. api-contract.js documents the surface
    api = read_text("assets/js/api-contract.js") or ""
    check(bool(api) and "HT.results.render" in api,
          "assets/js/api-contract.js documents HT.results.render")

    # 4. bundle-size-gate.py lists the canonical chrome
    bsg = read_text("scripts/bundle-size-gate.py") or ""
    check('"assets/css/result-card.css"' in bsg,
          "scripts/bundle-size-gate.py lists assets/css/result-card.css in SPEC_PAGE_CONDITIONAL_MODULES")
    check('"assets/js/results.js"' in bsg,
          "scripts/bundle-size-gate.py lists assets/js/results.js in SPEC_PAGE_CONDITIONAL_MODULES")

    # 5. Smoke harness exits 0
    if file_exists(smoke):
        r = subprocess.run(
            ["node", str(repo_root() / smoke)],
            capture_output=True,
            text=True,
            timeout=20,
            encoding="utf-8",
            errors="replace",
        )
        check(r.returncode == 0,
              f"{smoke} exists and exits 0 via node (rc={r.returncode})")
    else:
        check(False, f"{smoke} exists [missing]")

    # 6. Per-quiz checks (loop over tools.json → packs.discovery.entries[])
    tools = read_text("tools.json") or ""
    try:
        entries = json.loads(tools).get("packs", {}).get("discovery", {}).get("entries", [])
    except json.JSONDecodeError:
        entries = []
    if not entries:
        check(False, "tools.json->packs.discovery.entries is non-empty")
    else:
        check(True, f"tools.json->packs.discovery.entries has {len(entries)} quizzes")
        for entry in entries:
            slug = entry.get("slug") if isinstance(entry, dict) else None
            if not slug:
                continue
            core_path = f"tools/packs/discovery/{slug}/{slug}-core.js"
            css_qpath = f"tools/packs/discovery/{slug}/{slug}.css"

            if not file_exists(core_path):
                check(False, f"{core_path} exists [missing]")
                continue

            core_src = read_text(core_path) or ""

            check("HT.results.render(" in core_src,
                  f"{core_path} calls HT.results.render(...)")
            check("function renderReveal" not in core_src,
                  f"{core_path} no longer defines function renderReveal(...)")
            check("animateBars(" not in core_src,
                  f"{core_path} no longer calls animateBars(...)")
            check("data-action=\"reset\"" in core_src
                  and "resetBtn.focus()" in core_src,
                  f"{core_path} wires reset click + focuses it")
            check("challengeReceiver.getChallengeBlob" in core_src,
                  f"{core_path} gates the challenge flow on getChallengeBlob")
            check("body.querySelector('.quiz-result-actions')" in core_src,
                  f"{core_path} Story 10.12 CTA queries .quiz-result-actions (not .disc-actions)")

            # AC — relative-path correctness. The quiz page lives at
            # /tools/packs/discovery/<slug>/index.html (4 levels deep).
            # Asset URLs need `../../../../` (4-up) to land at the
            # repo root. A 2-up `../../` (broken) would land at
            # /tools/packs/assets/... (404). A 3-up `../../../` would
            # land at /tools/assets/... (also 404). Catches both
            # regressions by reading the served HTML and confirming
            # the rendered (<link>/<script>) hrefs resolve.
            index_html = f"tools/packs/discovery/{slug}/index.html"
            if file_exists(index_html):
                html_src = read_text(index_html) or ""
                refs = re.findall(r'(?:href|src)="(\.\./[^"]+)"', html_src)
                # Each leading `../` count must be exactly 4.
                bad_depth = []
                for ref in refs:
                    # Count the leading `../` segments.
                    m = re.match(r'^((?:\.\.\/)+)', ref)
                    if not m:
                        continue
                    n = m.group(1).count('/')
                    if n != 4:
                        bad_depth.append((ref, n))
                check(not bad_depth,
                      f"{index_html} has 4-up relative-path depths "
                      f"(found {len(bad_depth)} assets with wrong depth, "
                      f"e.g. {bad_depth[:1]})")

            if not file_exists(css_qpath):
                check(False, f"{css_qpath} exists [missing]")
                continue

            css_qsrc = read_text(css_qpath) or ""
            check(not re.search(r"^\.disc-actions\s*\{", css_qsrc, re.MULTILINE),
                  f"{css_qpath} no longer declares .disc-actions {{ ... }} rule")

    # 6.5 /packs/<slug>.html relative-path correctness — pages live
    # at /packs/ (1 level deep). Two valid depths are acceptable:
    #   - 1-up `../` for /assets/, /index.html, /quality.html, etc.
    #     (depth-1 root-relative targets — pack pages are one folder
    #     below the repo root).
    #   - 2-up `../../` for /tools/... references (e.g. the date-picker
    #     lab link) where the target sits one more folder below root.
    # 3-up `../../../` would land at the wrong root and is rejected.
    # Skip cross-depth siblings (../packs/<other>/...) — those resolve
    # within the same directory and are intentional.
    for page in ("disc", "travel", "finance", "study",
                 "developer", "household", "fun"):
        pack_path = f"packs/{page}.html"
        if not file_exists(pack_path):
            check(False, f"{pack_path} exists [missing]")
            continue
        src = read_text(pack_path) or ""
        refs = re.findall(r'(?:href|src)="(\.\.[^"]+)"', src)
        bad = []
        for ref in refs:
            m = re.match(r'^((?:\.\.\/)+)', ref)
            if not m:
                continue
            n = m.group(1).count('/')
            if n not in (1, 2):
                bad.append((ref, n))
        check(not bad,
              f"{pack_path} has 1- or 2-up relative-path depths "
              f"(found {len(bad)} assets with wrong depth)")

    # 7. gzipped size budgets
    css_sz = gzipped_size(css_path) if file_exists(css_path) else None
    check(css_sz is not None and css_sz <= 4096,
          f"gzipped size of {css_path} <= 4,096 bytes (got {css_sz})")
    js_sz = gzipped_size(results_js) if file_exists(results_js) else None
    check(js_sz is not None and js_sz <= 6144,
          f"gzipped size of {results_js} <= 6,144 bytes (got {js_sz})")

    exit_with_summary("DC-14")


if __name__ == "__main__":
    main()
