#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dc-1-scoring.py — AC for DC-1 (HT.scoring module).

Verifies assets/js/scoring.js + wiring (api-contract, shell-thin,
bundle gate, docs, smoke). Target: 15 PASS after DC-1 lands.

Run: `make dc-1-scoring` or `python scripts/dc/dc-1-scoring.py`.
"""
from __future__ import annotations

import json
import re
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
    print("DC-1 — HT.scoring module + wiring + smoke (15 checks)")

    # 1. assets/js/scoring.js exists on disk
    src_path = "assets/js/scoring.js"
    check(file_exists(src_path), f"{src_path} exists on disk")

    src = read_text(src_path) or ""

    # 2. scoring.js itself does the Object.defineProperty(HT, 'scoring',
    # {value, writable:false, configurable:false, ...}) — api-contract.js
    # is just the documentation table. The freeze lives in the module
    # that owns the API (same pattern as quiz.js).
    api = read_text("assets/js/api-contract.js") or ""
    scoring_src = read_text("assets/js/scoring.js") or ""
    has_freeze = bool(re.search(
        r'Object\.defineProperty\(\s*HT\s*,\s*[\'"]scoring[\'"]\s*,\s*\{[^}]*writable:\s*false[^}]*configurable:\s*false',
        scoring_src,
        re.DOTALL,
    ))
    has_doc = bool(api) and "HT.scoring" in api
    check(
        has_freeze and has_doc,
        "assets/js/scoring.js freezes HT.scoring (writable:false, configurable:false) "
        "AND api-contract.js documents it",
    )

    # 3. assets/js/shell-thin.js TIER2_URLS includes assets/js/scoring.js
    shell = read_text("assets/js/shell-thin.js") or ""
    check(
        bool(shell) and "assets/js/scoring.js" in shell,
        "assets/js/shell-thin.js TIER2_URLS includes 'assets/js/scoring.js'",
    )

    # 4. scripts/bundle-size-gate.py lists assets/js/scoring.js in SPEC_PAGE_CONDITIONAL_MODULES
    bsg = read_text("scripts/bundle-size-gate.py") or ""
    check(
        bool(bsg) and '    "assets/js/scoring.js",' in bsg,
        "scripts/bundle-size-gate.py lists 'assets/js/scoring.js' in SPEC_PAGE_CONDITIONAL_MODULES",
    )

    # 5. docs/shell-public-api.md §5 has a HT.scoring.* row with stable stability
    api_doc = read_text("docs/shell-public-api.md") or ""
    check(
        bool(api_doc) and "HT.scoring" in api_doc and "stable" in api_doc,
        "docs/shell-public-api.md mentions HT.scoring with stable stability",
    )

    # 6..12. Runtime behavior: load scoring.js in a Node vm sandbox and
    # run a small set of fixtures. Only meaningful if scoring.js exists
    # AND exports the expected API. If scoring.js isn't on disk yet,
    # all 7 runtime checks stay FAIL (RED until DC-1 lands).
    fixture = (
        r"""
'use strict';
const fs = require('fs');
const vm = require('vm');

const SCORING_PATH = __SCORING_PATH__;
const src = fs.readFileSync(SCORING_PATH, 'utf8');

const ctx = { HT: {}, console };
// scoring.js is an IIFE that picks `window.HT` || `self.HT` || {}. With
// neither window nor self in the vm sandbox, it falls through to a
// fresh local `{}` and writes HT.scoring to that object — invisible
// to the caller. Mirror the shape used by scripts/_smoke_scoring.js:
// expose `window` and `self` aliases pointing at the shared HT so the
// IIFE's `window.HT = HT` writes back to ctx.HT.
ctx.window = ctx;
ctx.self = ctx;
ctx.global = ctx;
vm.createContext(ctx);
vm.runInContext(src, ctx);
const scoring = ctx.HT.scoring;

const out = {};
try {
  out.hasScore = typeof scoring.score === 'function';
  if (out.hasScore) {
    // spec: 2 traits, 2 archetypes. weights[qid][answerValue][trait] = delta.
    const spec = {
      traits: ['calm', 'bold'],
      weights: {
        q1: {
          calm: { calm: 1, bold: 0 },
          bold: { calm: 0, bold: 1 },
        },
      },
      archetypes: [
        { id: 'zen', label: 'Zen', emoji: '🧘', default: false, scores: { calm: 80, bold: 20 } },
        { id: 'hero', label: 'Hero', emoji: '🦸', default: true, scores: { calm: 20, bold: 80 } },
      ],
    };

    // 7: score returns {traits, archetype}
    const r1 = scoring.score({ q1: 'calm' }, spec);
    out.returnsShape =
      r1 && typeof r1 === 'object' && r1.traits && r1.archetype;

    // 8: trait scores are clamped to [0, 100]
    const r2 = scoring.score({ q1: 'calm' }, spec);
    const inRange = Object.values(r2.traits).every(
      (v) => typeof v === 'number' && v >= 0 && v <= 100
    );
    out.clamped = inRange;

    // 9: skipped questions contribute zero weight
    const r3 = scoring.score({}, spec);
    out.skippedZero = Object.values(r3.traits).every((v) => v === 0);

    // 10: empty answers yields default-archetype
    const r4 = scoring.score({}, spec);
    out.defaultArchetype = r4.archetype && r4.archetype.id === 'hero';

    // 11: deterministic
    const a = scoring.score({ q1: 'calm' }, spec);
    const b = scoring.score({ q1: 'calm' }, spec);
    out.deterministic = a.archetype.id === b.archetype.id;

    // 12: unknown answer value does NOT throw
    let threw = false;
    try {
      scoring.score({ q1: 'NEVER_DEFINED_VALUE' }, spec);
    } catch (e) {
      threw = true;
    }
    out.unknownIgnored = !threw;
  }
} catch (e) {
  out.error = String(e && e.message || e);
}
process.stdout.write('JSON:' + JSON.stringify(out));
"""
    ).replace("__SCORING_PATH__", json.dumps(str((repo_root() / "assets/js/scoring.js").resolve())))
    rc, stdout, stderr = run_node(fixture)
    runtime = {}
    for line in stdout.splitlines()[::-1]:
        if line.startswith("JSON:"):
            try:
                runtime = json.loads(line[5:])
            except Exception:
                runtime = {}
            break

    if file_exists(src_path):
        check(runtime.get("hasScore"), "scoring.js exposes HT.scoring.score(answers, spec)")
        check(runtime.get("returnsShape"), "score({q1:'calm'}, spec) returns {traits, archetype}")
        check(runtime.get("clamped"), "Trait scores are clamped to [0, 100]")
        check(runtime.get("skippedZero"), "Skipped questions (answers[id] undefined) contribute zero weight")
        check(runtime.get("defaultArchetype"), "Empty answers yields the spec's default-archetype")
        check(runtime.get("deterministic"), "Archetype resolution is deterministic (same inputs -> same archetype)")
        check(runtime.get("unknownIgnored"), "An unknown answer value does NOT throw (silently ignored)")
    else:
        # scoring.js doesn't exist — explicitly fail each runtime check
        for label in (
            "scoring.js exposes HT.scoring.score(answers, spec)",
            "score({q1:'calm'}, spec) returns {traits, archetype}",
            "Trait scores are clamped to [0, 100]",
            "Skipped questions (answers[id] undefined) contribute zero weight",
            "Empty answers yields the spec's default-archetype",
            "Archetype resolution is deterministic (same inputs -> same archetype)",
            "An unknown answer value does NOT throw (silently ignored)",
        ):
            check(False, label + " [scoring.js missing]")

    # 13. shell-bounds-check.py passes for scoring.js
    if file_exists(src_path):
        import subprocess
        r = subprocess.run(
            [sys.executable, str(repo_root() / "scripts" / "shell-bounds-check.py")],
            capture_output=True,
            text=True,
        )
        check(
            r.returncode == 0,
            "scripts/shell-bounds-check.py passes (no localStorage/fetch/XHR/HT.provide in scoring.js)",
        )
    else:
        check(False, "scripts/shell-bounds-check.py passes [scoring.js missing]")

    # 14. gzipped size <= 4,000 bytes
    sz = gzipped_size(src_path) if file_exists(src_path) else None
    check(
        sz is not None and sz <= 4000,
        f"gzipped size of scoring.js <= 4,000 bytes (got {sz})",
    )

    # 15. scripts/_smoke_scoring.js exists and exits 0 via node
    smoke = "scripts/_smoke_scoring.js"
    if file_exists(smoke):
        # Run the smoke file directly as a script entry point — NOT via
        # stdin (`node -`), because the harness resolves asset paths
        # relative to __dirname, and a stdin pipe leaves __dirname as
        # the cwd (typically the repo root, not scripts/), causing the
        # readFileSync on assets/js/shell-thin.js to crash with ENOENT
        # before any assertions run.
        import subprocess
        r = subprocess.run(
            ["node", str(repo_root() / smoke)],
            capture_output=True,
            text=True,
            timeout=20,
            encoding="utf-8",
            errors="replace",
        )
        check(r.returncode == 0, f"{smoke} exists and exits 0 via node (rc={r.returncode})")
    else:
        check(False, f"{smoke} exists and exits 0 via node [missing]")

    exit_with_summary("DC-1")


if __name__ == "__main__":
    main()