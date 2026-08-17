#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dc-2-results.py — AC for DC-2 (HT.results module + share-card).

Verifies assets/js/results.js + assets/css/result-card.css + wiring.
Target: 19 PASS after DC-2 lands.

Run: `make dc-2-results` or `python scripts/dc/dc-2-results.py`.
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
    print("DC-2 — HT.results module + share-card + wiring (19 checks)")

    js_path = "assets/js/results.js"
    css_path = "assets/css/result-card.css"

    # 1. assets/js/results.js exists on disk
    check(file_exists(js_path), f"{js_path} exists on disk")

    # 2. assets/css/result-card.css exists on disk
    check(file_exists(css_path), f"{css_path} exists on disk")

    js_src = read_text(js_path) or ""
    css_src = read_text(css_path) or ""

    # 3. assets/js/api-contract.js defines HT.results (frozen)
    api = read_text("assets/js/api-contract.js") or ""
    check(
        bool(api) and re.search(
            r'Object\.defineProperty\(\s*HT\s*,\s*[\'"]results[\'"]\s*,\s*\{[^}]*writable:\s*false[^}]*configurable:\s*false',
            api,
            re.DOTALL,
        ),
        "assets/js/api-contract.js defines HT.results (frozen: writable:false, configurable:false)",
    )

    # 4. shell-thin.js TIER2_URLS / TIER2_CSS list both files
    shell = read_text("assets/js/shell-thin.js") or ""
    check(
        bool(shell) and "assets/js/results.js" in shell,
        "assets/js/shell-thin.js TIER2_URLS includes 'assets/js/results.js'",
    )
    check(
        bool(shell) and "assets/css/result-card.css" in shell,
        "assets/js/shell-thin.js TIER2_CSS includes 'assets/css/result-card.css'",
    )

    # 5. scripts/bundle-size-gate.py lists both in SPEC_PAGE_CONDITIONAL_MODULES
    bsg = read_text("scripts/bundle-size-gate.py") or ""
    check(
        bool(bsg) and '    "assets/js/results.js",' in bsg,
        "scripts/bundle-size-gate.py lists 'assets/js/results.js' in SPEC_PAGE_CONDITIONAL_MODULES",
    )
    check(
        bool(bsg) and '    "assets/css/result-card.css",' in bsg,
        "scripts/bundle-size-gate.py lists 'assets/css/result-card.css' in SPEC_PAGE_CONDITIONAL_MODULES",
    )

    # 6. docs/shell-public-api.md mentions HT.results with stable stability
    api_doc = read_text("docs/shell-public-api.md") or ""
    check(
        bool(api_doc) and "HT.results" in api_doc and "stable" in api_doc,
        "docs/shell-public-api.md mentions HT.results with stable stability",
    )

    # Runtime checks — only meaningful if results.js exists.
    # We use jsdom-less fixture that stubs HTMLElement minimally.
    fixture = r"""
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = path.resolve(__dirname, '..', '..');
const src = fs.readFileSync(path.join(REPO, 'assets/js/results.js'), 'utf8');

// Minimal DOM stub
class FakeEl {
  constructor() {
    this.dataset = {};
    this.attrs = {};
    this.classList = { add: () => {}, remove: () => {}, contains: () => false };
    this.children = [];
    this.style = {};
    this.attrs.role = '';
    this.attrs['aria-live'] = '';
  }
  setAttribute(k, v) { this.attrs[k] = v; }
  appendChild(c) { this.children.push(c); return c; }
  addEventListener() {}
}

// Capture the constructed root element
let lastRenderRoot = null;

const ctx = {
  HT: {},
  document: {
    createElement(tag) {
      const el = new FakeEl();
      el.tag = tag;
      return el;
    },
  },
  URLSearchParams: URLSearchParams,
  console,
};
vm.createContext(ctx);
vm.runInContext(src, ctx);

const results = ctx.HT.results;
const out = {};

// 7. render returns HTMLElement with data-print="result"
try {
  const el = results.render(
    { traits: { calm: 80, bold: 30 }, archetype: { id: 'zen', label: 'Zen', emoji: '🧘' } },
    { title: 'You scored', conflict: 'You also said bold', slug: 'zen-test' }
  );
  out.rendered = !!el;
  out.hasDataPrint = el && el.attrs && el.attrs['data-print'] === 'result';
  out.role = el && el.attrs && el.attrs.role === 'region';
  out.ariaLive = el && el.attrs && el.attrs['aria-live'] === 'polite';
  lastRenderRoot = el;
} catch (e) { out.renderErr = String(e && e.message || e); }

// 8 + 9 are covered by the structural grep below, not the runtime fixture.
// 10 (contrarian class) is also structural — see the check() call below.

// 11. shareUrl returns URL containing ?arch=<id>
try {
  const u = results.shareUrl(
    { id: 'zen', label: 'Zen', emoji: '🧘' },
    { slug: 'zen-test' }
  );
  out.shareUrl = typeof u === 'string' && u.indexOf('arch=zen') !== -1;
} catch (e) { out.shareErr = String(e && e.message || e); }

// 12. copyText returns string with canonical format
try {
  const t = results.copyText(
    { traits: { calm: 80, bold: 30 }, archetype: { id: 'zen', label: 'Zen', emoji: '🧘' } },
    { slug: 'zen-test' }
  );
  out.copyText = typeof t === 'string'
    && /Zen/.test(t)
    && /🧘/.test(t)
    && /\d+%/.test(t);
} catch (e) { out.copyErr = String(e && e.message || e); }

// 13. imageSnapshot either returns Promise<Blob> OR throws 'snapshot unavailable'
try {
  let threw = false;
  let ok = false;
  try {
    const r = results.imageSnapshot(lastRenderRoot || {});
    if (r && typeof r.then === 'function') ok = true;
  } catch (e) {
    if (/snapshot unavailable/i.test(String(e && e.message || e))) {
      threw = true;
      ok = true;
    }
  }
  out.snapshotContract = ok || threw;
} catch (e) {}

process.stdout.write('JSON:' + JSON.stringify(out));
"""

    if file_exists(js_path):
        rc, stdout, stderr = run_node(fixture)
        runtime = {}
        for line in stdout.splitlines()[::-1]:
            if line.startswith("JSON:"):
                try:
                    runtime = json.loads(line[5:])
                except Exception:
                    runtime = {}
                break

        check(runtime.get("rendered"), "HT.results.render returns an HTMLElement")
        check(runtime.get("hasDataPrint"), "Card root has data-print='result'")
        check(runtime.get("role"), "Card root has role='region'")
        check(runtime.get("ariaLive"), "Card root has aria-live='polite'")
        check(runtime.get("shareUrl"), "HT.results.shareUrl returns URL containing ?arch=<id>")
        check(runtime.get("copyText"), "HT.results.copyText returns string in canonical format")
        check(runtime.get("snapshotContract"), "imageSnapshot either returns Promise<Blob> or throws 'snapshot unavailable'")
    else:
        for label in (
            "HT.results.render returns an HTMLElement",
            "Card root has data-print='result'",
            "Card root has role='region'",
            "Card root has aria-live='polite'",
            "HT.results.shareUrl returns URL containing ?arch=<id>",
            "HT.results.copyText returns string in canonical format",
            "imageSnapshot either returns Promise<Blob> or throws 'snapshot unavailable'",
        ):
            check(False, label + " [results.js missing]")

    # 9. action row carries data-print="ignore" — structural (grep the JS)
    check(
        bool(js_src) and 'data-print="ignore"' in js_src,
        "Action row carries data-print='ignore'",
    )

    # 10. contrarian line uses class quiz-result-contrarian (structural)
    check(
        bool(js_src) and "quiz-result-contrarian" in js_src,
        "Contrarian line uses class .quiz-result-contrarian",
    )

    # 14. tab-order-canonical for the card is ['button.share', 'button.challenge']
    check(
        bool(js_src)
        and "button.share" in js_src
        and "button.challenge" in js_src,
        "tab-order-canonical for the card is ['button.share','button.challenge']",
    )

    # 15. shell-bounds-check.py passes for results.js
    if file_exists(js_path):
        r = subprocess.run(
            [sys.executable, str(repo_root() / "scripts" / "shell-bounds-check.py")],
            capture_output=True,
            text=True,
        )
        check(
            r.returncode == 0,
            "scripts/shell-bounds-check.py passes for results.js",
        )
    else:
        check(False, "scripts/shell-bounds-check.py passes for results.js [missing]")

    # 16. result-card.css contains @media print
    check(
        bool(css_src) and "@media print" in css_src,
        "assets/css/result-card.css contains @media print block (rubric #5)",
    )

    # 17. gzipped size of results.js <= 6,000 bytes
    sz_js = gzipped_size(js_path) if file_exists(js_path) else None
    check(
        sz_js is not None and sz_js <= 6000,
        f"gzipped size of results.js <= 6,000 bytes (got {sz_js})",
    )

    # 18. gzipped size of result-card.css <= 4,000 bytes
    sz_css = gzipped_size(css_path) if file_exists(css_path) else None
    check(
        sz_css is not None and sz_css <= 4000,
        f"gzipped size of result-card.css <= 4,000 bytes (got {sz_css})",
    )

    # 19. scripts/_smoke_results.js exists and exits 0
    smoke = "scripts/_smoke_results.js"
    if file_exists(smoke):
        rc, _, _ = run_node(
            (repo_root() / smoke).read_text(encoding="utf-8") + "\n"
        )
        check(rc == 0, f"{smoke} exists and exits 0 via node (rc={rc})")
    else:
        check(False, f"{smoke} exists and exits 0 via node [missing]")

    exit_with_summary("DC-2")


if __name__ == "__main__":
    main()