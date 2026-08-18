#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dc-15-browser-render.py — DC-15: Headless browser render smoke.

Wraps `scripts/_browser_smoke.py` (which spawns a local HTTP server,
launches headless Edge, dumps each rendered DOM, and records per-asset
status codes) and re-publishes the assertions into the dc-* check
harness shape.

Why a separate gate from DC-14
------------------------------
DC-14 verifies that the *static HTML files* in the repo reference
assets at correct relative-path depths. It cannot verify that a
*real browser* successfully fetches those assets AND mounts the
expected DOM chrome (the layout, the quiz form, the header, etc.).
This gate runs the actual pages in headless Edge and asserts:

  • the dumped DOM has the site-header chrome (catches:
    broken path → no `.site-header` rendered)
  • the dumped DOM has the #main / .shell-main container
  • on quiz pages, `#quiz-mount` has at least one quiz-* child
    (catches: HT.quiz.open() called without `questions:` arg,
    which would render an empty mount — a regression caught in
    dev via this gate)
  • every linked CSS / JS reference resolved to HTTP 200 (catches:
    broken relative-path depth → assets 404 → unstyled page)
  • the page did not crash on render (full DOM was dumped)

Targets: 10 Discovery quizzes + 7 pack pages + 2 control pages
(BMI calculator + index.html). All pages run in series against the
same headless process / server instance.

Required environment:
  • Headless Edge (or Chrome) at the canonical path on Windows.
    On Linux/macOS, an env override is supported
    (see scripts/_browser_smoke.py for fallback paths).
  • python -m http.server cannot already be bound on the same port.

Usage: `python scripts/dc/dc-15-browser-render.py`.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import check, exit_with_summary, repo_root


SMOKE = Path(__file__).resolve().parent.parent / "_browser_smoke.py"


def main():
    print("DC-15 — Headless browser render smoke (site-header / quiz-mount / asset 200s)")

    if not SMOKE.is_file():
        check(False, f"{SMOKE.relative_to(repo_root())} exists")
        exit_with_summary("DC-15")

    # 1. Sanity: gate exists, parseable, has the expected top-level
    # structure (browser smoke functions for 19 pages).
    src = SMOKE.read_text(encoding="utf-8", errors="replace")
    check("DISCOVERY_QUIZZES" in src and len(re.findall(
        r'DISCOVERY_QUIZZES\s*=\s*\[', src)) == 1,
          "_browser_smoke.py declares DISCOVERY_QUIZZES list")
    check("PACK_PAGES" in src and "disc.html" in src,
          "_browser_smoke.py targets 7 pack pages")
    check("_CountingHandler" in src and "send_response_only" in src,
          "_browser_smoke.py uses a counting HTTP server "
          "(records per-asset status code)")
    check("--headless=new" in src and "--dump-dom" in src,
          "_browser_smoke.py invokes headless Edge with --dump-dom")
    check("virtual-time-budget" in src,
          "_browser_smoke.py waits for JS to settle "
          "(virtual-time-budget)")
    check("quiz-mount" in src and re.search(
        r"quiz-\* child", src) is not None,
          "_browser_smoke.py asserts quiz-mount renders quiz-* child "
          "(catches empty-mount regression)")

    # Static-source regression guard (Story 10.x): pack pages must
    # NOT carry an eager `<script src=".../shell.js" defer>` tag.
    # `shell.js` is only lazy-loaded via `shell-thin.js#kickShellBoot`,
    # so an eager script tag causes the shell IIFE to run twice —
    # the second run throws "Cannot redefine property: provide"
    # because shell.js line 159 uses `Object.defineProperties` with
    # `configurable: false`. This gate asserts no pack page has the
    # duplicate load so the regression can't sneak back in.
    packs_dir = repo_root() / "packs"
    offenders = []
    if packs_dir.is_dir():
        for pack_html in sorted(packs_dir.glob("*.html")):
            psrc = pack_html.read_text(encoding="utf-8", errors="replace")
            if re.search(r'src="[^"]*shell\.js"\s+defer', psrc):
                offenders.append(pack_html.relative_to(repo_root()))
    check(
        not offenders,
        "no pack page carries an eager `<script ... shell.js defer>` "
        "(prevents shell.js double-load / 'Cannot redefine property: "
        "provide' regression)" +
        ("; offenders=" + ", ".join(str(o) for o in offenders) if offenders else ""),
    )

    # 2. Run the actual browser smoke as a subprocess. Parse its
    # PASS/FAIL lines and re-emit each as a dc-* check, so the
    # run-all.py JSON payload reflects the real rendered assertions.
    r = subprocess.run(
        ["python", str(SMOKE)],
        capture_output=True,
        text=True,
        timeout=240,
        encoding="utf-8",
        errors="replace",
    )
    # Read stdout + stderr combined (the gate may emit PASS lines to
    # either). Count PASS / FAIL lines.
    combined = (r.stdout or "") + "\n" + (r.stderr or "")
    pass_lines = [ln for ln in combined.splitlines()
                  if ln.strip().startswith("  PASS")]
    fail_lines = [ln for ln in combined.splitlines()
                  if ln.strip().startswith("  FAIL")]
    summary_line = next((ln for ln in reversed(combined.splitlines())
                         if ln.startswith("browser smoke:")), "")

    # Emit a single umbrella check: the browser smoke passed (or
    # failed) with the recorded counts.
    m = re.search(r"PASS=(\d+)\s+FAIL=(\d+)\s+SKIP=(\d+)", summary_line)
    if m:
        sm_pass = int(m.group(1))
        sm_fail = int(m.group(2))
        check(sm_fail == 0,
              f"browser smoke: PASS={sm_pass} FAIL={sm_fail} SKIP={m.group(3)}")
    else:
        check(False, f"browser smoke: no summary line found in output "
                     f"(returncode={r.returncode})")

    # Additionally, count each rendered-page assertion as its own
    # dc-15 check. This makes the gate's output granular.
    for ln in pass_lines:
        # Strip the leading "  PASS  " and use as the label.
        label = ln.strip()[len("PASS"):].strip()
        # Truncate to keep the gate's output scannable.
        if len(label) > 96:
            label = label[:93] + "..."
        check(True, label)
    # Don't re-emit FAIL lines as separate PASS checks — the umbrella
    # above already accounts for them. If FAIL lines exist, the
    # umbrella has failed and we want the operator to see those in
    # the harness output. Print them after the umbrella so they show
    # in the FAIL section.
    for ln in fail_lines:
        print("  " + ln.strip())

    exit_with_summary("DC-15")


if __name__ == "__main__":
    main()