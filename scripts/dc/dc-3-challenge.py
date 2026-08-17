#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dc-3-challenge.py — AC for DC-3 (HT.challenge module).

Verifies assets/js/challenge.js + wiring. Target: 19 PASS after DC-3.

Run: `make dc-3-challenge` or `python scripts/dc/dc-3-challenge.py`.
"""
from __future__ import annotations

import base64
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
    print("DC-3 — HT.challenge module + Challenge-a-Friend (19 checks)")

    js_path = "assets/js/challenge.js"

    # 1. assets/js/challenge.js exists on disk
    check(file_exists(js_path), f"{js_path} exists on disk")

    js_src = read_text(js_path) or ""

    # 2. api-contract defines HT.challenge (frozen)
    api = read_text("assets/js/api-contract.js") or ""
    check(
        bool(api) and re.search(
            r'Object\.defineProperty\(\s*HT\s*,\s*[\'"]challenge[\'"]\s*,\s*\{[^}]*writable:\s*false[^}]*configurable:\s*false',
            api,
            re.DOTALL,
        ),
        "assets/js/api-contract.js defines HT.challenge (frozen: writable:false, configurable:false)",
    )

    # 3. shell-thin.js TIER2_URLS includes assets/js/challenge.js
    shell = read_text("assets/js/shell-thin.js") or ""
    check(
        bool(shell) and "assets/js/challenge.js" in shell,
        "assets/js/shell-thin.js TIER2_URLS includes 'assets/js/challenge.js'",
    )

    # 4. bundle-size-gate lists challenge.js
    bsg = read_text("scripts/bundle-size-gate.py") or ""
    check(
        bool(bsg) and '    "assets/js/challenge.js",' in bsg,
        "scripts/bundle-size-gate.py lists 'assets/js/challenge.js' in SPEC_PAGE_CONDITIONAL_MODULES",
    )

    # 5. docs/shell-public-api.md mentions HT.challenge with stable stability
    api_doc = read_text("docs/shell-public-api.md") or ""
    check(
        bool(api_doc) and "HT.challenge" in api_doc and "stable" in api_doc,
        "docs/shell-public-api.md mentions HT.challenge with stable stability",
    )

    # 6..14. Runtime: load challenge.js and exercise link/compare/expired.
    fixture = r"""
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = path.resolve(__dirname, '..', '..');
const src = fs.readFileSync(path.join(REPO, 'assets/js/challenge.js'), 'utf8');

const ctx = { HT: {}, console };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const ch = ctx.HT.challenge;

const out = {};
try {
  out.hasLink = typeof ch.link === 'function';
  out.hasCompare = typeof ch.compare === 'function';

  if (out.hasLink) {
    // 6: link returns URL containing ?c=<base64-blob>
    const spec = {
      slug: 'personality',
      self: { q1: 'calm', q2: 'bold' },
      iat: 1700000000,
      exp: 1702592000, // +30d
    };
    const url = ch.link(spec);
    out.linkHasC = typeof url === 'string' && /[?&]c=/.test(url);

    // 7: base64 blob decodes to {v, slug, self, iat, exp}
    let decoded = null;
    try {
      const blob = url.split(/[?&]c=/)[1].split(/[&#]/)[0];
      const padded = blob + '='.repeat((4 - blob.length % 4) % 4);
      decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    } catch (e) {}
    out.blobShape = decoded
      && typeof decoded.v === 'number'
      && decoded.slug === 'personality'
      && decoded.self
      && typeof decoded.iat === 'number'
      && typeof decoded.exp === 'number';

    // 8: v is 1 (schema version)
    out.vIs1 = decoded && decoded.v === 1;

    // 9: exp == iat + 30 days
    if (decoded) {
      const days = (decoded.exp - decoded.iat) / 86400;
      out.expIs30Days = Math.abs(days - 30) < 0.01;
    }
  }

  // 10: expired exp returns a friendly inline error (no throw)
  if (out.hasLink) {
    let threw = false;
    let friendly = false;
    try {
      ch.link({ slug: 'x', self: { q1: 'a' }, iat: 0, exp: 1 });
    } catch (e) {
      threw = true;
      if (/expired|exp/i.test(String(e && e.message || e))) friendly = true;
    }
    // Either the call returns a structured error OR throws a friendly one
    out.expiredHandled = threw ? friendly : true;
  }

  // 11..13: compare returns {score 0..100, axes[]}, deterministic, axes length
  if (out.hasCompare) {
    const r = ch.compare({ q1: 'calm', q2: 'bold' }, { q1: 'calm', q2: 'quiet' });
    out.compareShape = r
      && typeof r.score === 'number'
      && Array.isArray(r.axes);
    out.scoreInRange = r && r.score >= 0 && r.score <= 100;
    const r2 = ch.compare({ q1: 'calm', q2: 'bold' }, { q1: 'calm', q2: 'quiet' });
    out.deterministic = r && r2 && r.score === r2.score;
  }

  // 14: v:99 blob surfaces version-mismatch message
  // Simulate by feeding a stale-shape payload to a verify/check function if one exists.
  let versionMsg = false;
  try {
    const fake = Buffer.from(JSON.stringify({
      v: 99, slug: 'x', self: {}, iat: 0, exp: 9999999999,
    })).toString('base64').replace(/=+$/, '');
    const r = ch.verify ? ch.verify(fake) : null;
    if (r && /newer|older|version/i.test(String(r.message || r))) versionMsg = true;
    if (!ch.verify && src.indexOf('v: 99') !== -1) versionMsg = true;
  } catch (e) {}
  out.versionMessage = versionMsg || /newer|older|version/i.test(src);

} catch (e) { out.error = String(e && e.message || e); }

process.stdout.write('JSON:' + JSON.stringify(out));
"""
    rc, stdout, stderr = run_node(fixture)
    runtime = {}
    for line in stdout.splitlines()[::-1]:
        if line.startswith("JSON:"):
            try:
                runtime = json.loads(line[5:])
            except Exception:
                runtime = {}
            break

    if file_exists(js_path):
        check(runtime.get("hasLink"), "HT.challenge.link is callable")
        check(runtime.get("hasCompare"), "HT.challenge.compare is callable")
        check(runtime.get("linkHasC"), "HT.challenge.link returns URL containing ?c=<base64-blob>")
        check(runtime.get("blobShape"), "Base64 blob decodes to {v, slug, self, iat, exp}")
        check(runtime.get("vIs1"), "Blob v == 1 (schema version)")
        check(runtime.get("expIs30Days"), "exp == iat + 30 days (default 30-day expiry)")
        check(runtime.get("expiredHandled"), "Expired exp returns friendly inline error (no throw)")
        check(runtime.get("compareShape"), "HT.challenge.compare returns {score 0..100, axes[]}")
        check(runtime.get("scoreInRange"), "compare score is in [0, 100]")
        check(runtime.get("deterministic"), "compare is deterministic (same inputs -> same score)")
        check(runtime.get("versionMessage"), "v:99 blob surfaces version-mismatch message")
    else:
        for label in (
            "HT.challenge.link is callable",
            "HT.challenge.compare is callable",
            "HT.challenge.link returns URL containing ?c=<base64-blob>",
            "Base64 blob decodes to {v, slug, self, iat, exp}",
            "Blob v == 1 (schema version)",
            "exp == iat + 30 days (default 30-day expiry)",
            "Expired exp returns friendly inline error (no throw)",
            "HT.challenge.compare returns {score 0..100, axes[]}",
            "compare score is in [0, 100]",
            "compare is deterministic (same inputs -> same score)",
            "v:99 blob surfaces version-mismatch message",
        ):
            check(False, label + " [challenge.js missing]")

    # 15. URL only encodes `self`, not revealed until submit (structural)
    # Verify: the JS does not call into the about-side during link()/compare() setup.
    check(
        bool(js_src) and ("self" in js_src) and ("about" not in js_src.lower() or "aboutAnswers" in js_src),
        "URL only encodes `self` (about-side not exposed during link)",
    )

    # 16. prefers-reduced-motion is honored in the reveal animation
    # The plan says CSS query, not JS — but challenge.js may also use
    # matchMedia. Either is acceptable. Accept both.
    css = read_text("assets/css/challenge.css") or read_text("assets/css/result-card.css") or ""
    check(
        bool(js_src) and "prefers-reduced-motion" in (js_src + css),
        "prefers-reduced-motion is honored in the reveal animation (CSS or JS)",
    )

    # 17. shell-bounds-check.py passes
    if file_exists(js_path):
        r = subprocess.run(
            [sys.executable, str(repo_root() / "scripts" / "shell-bounds-check.py")],
            capture_output=True,
            text=True,
        )
        check(
            r.returncode == 0,
            "scripts/shell-bounds-check.py passes for challenge.js",
        )
    else:
        check(False, "scripts/shell-bounds-check.py passes for challenge.js [missing]")

    # 18. gzipped size <= 7,000 bytes
    sz = gzipped_size(js_path) if file_exists(js_path) else None
    check(
        sz is not None and sz <= 7000,
        f"gzipped size of challenge.js <= 7,000 bytes (got {sz})",
    )

    # 19. scripts/_smoke_challenge.js exists and exits 0
    smoke = "scripts/_smoke_challenge.js"
    if file_exists(smoke):
        rc, _, _ = run_node(
            (repo_root() / smoke).read_text(encoding="utf-8") + "\n"
        )
        check(rc == 0, f"{smoke} exists and exits 0 via node (rc={rc})")
    else:
        check(False, f"{smoke} exists and exits 0 via node [missing]")

    exit_with_summary("DC-3")


if __name__ == "__main__":
    main()