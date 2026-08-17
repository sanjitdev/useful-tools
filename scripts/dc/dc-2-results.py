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

    # 3. results.js itself does the Object.defineProperty(HT, 'results',
    # {value, writable:false, configurable:false, ...}) — api-contract.js
    # is just the documentation table. The freeze lives in the module
    # that owns the API (same pattern as scoring.js per dc-1 gate).
    api = read_text("assets/js/api-contract.js") or ""
    results_src = read_text("assets/js/results.js") or ""
    has_freeze = bool(re.search(
        r'Object\.defineProperty\(\s*HT\s*,\s*[\'"]results[\'"]\s*,\s*\{[^}]*writable:\s*false[^}]*configurable:\s*false',
        results_src,
        re.DOTALL,
    ))
    has_doc = bool(api) and "HT.results" in api
    check(
        has_freeze and has_doc,
        "assets/js/results.js freezes HT.results (writable:false, configurable:false) "
        "AND api-contract.js documents it",
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
    # Path substitution (mirrors the dc-1 gate fix) so the file
    # path works under `node -` (stdin) where __dirname is undefined.
    fixture = (
        r"""
'use strict';
const fs = require('fs');
const vm = require('vm');

const RESULTS_PATH = __RESULTS_PATH__;
const src = fs.readFileSync(RESULTS_PATH, 'utf8');

// Minimal DOM stub — classList.add must mutate attrs.class so the
// .button / .share / .challenge classes added by results.js render
// visible to the assertions below. createTextNode must exist (results.js
// calls it for string children).
class FakeEl {
  constructor(tag) {
    this.tag = tag;
    this.dataset = {};
    this.attrs = {};
    this.children = [];
    this.style = {};
    this.classList = {
      _add: [],
      _remove: [],
      _baseClass: '',
      _owner: this,
      add: function () {
        for (let i = 0; i < arguments.length; i++) {
          if (this._add.indexOf(arguments[i]) === -1) this._add.push(arguments[i]);
        }
        this._owner._writeClass();
      },
      remove: function () {
        for (let i = 0; i < arguments.length; i++) {
          let idx = this._add.indexOf(arguments[i]);
          if (idx !== -1) this._add.splice(idx, 1);
          if (this._remove.indexOf(arguments[i]) === -1) this._remove.push(arguments[i]);
        }
        this._owner._writeClass();
      },
      contains: function (c) { return this._add.indexOf(c) !== -1; },
    };
  }
  _writeClass() {
    const parts = this.classList._baseClass
      ? this.classList._baseClass.split(' ').filter(Boolean)
      : [];
    parts.push.apply(parts, this.classList._add);
    if (this.classList._remove.length) {
      for (let i = 0; i < this.classList._remove.length; i++) {
        const idx = parts.indexOf(this.classList._remove[i]);
        if (idx !== -1) parts.splice(idx, 1);
      }
    }
    this.attrs.class = parts.join(' ');
  }
  setAttribute(k, v) {
    this.attrs[k] = v;
    if (k === 'class') this.classList._baseClass = String(v);
  }
  appendChild(c) { this.children.push(c); return c; }
  addEventListener() {}
}

const ctx = { HT: {}, console };
// results.js is an IIFE that picks `window.HT` || `self.HT` || {}.
// With neither window nor self in the vm sandbox, it falls through
// to a fresh local `{}` and writes HT.results to that object —
// invisible to the caller. Mirror the shape used by
// scripts/_smoke_results.js: expose window + self + global aliases
// pointing at the shared HT so the IIFE's writes land back here.
ctx.window = ctx;
ctx.self = ctx;
ctx.global = ctx;
ctx.URLSearchParams = URLSearchParams;
ctx.location = { href: 'http://localhost/?arch=zen&quiz=zen-test', protocol: 'http:', pathname: '/' };
ctx.document = {
  createElement: function (tag) { return new FakeEl(tag); },
  createTextNode: function (t) { return { nodeType: 3, text: String(t) }; },
};
vm.createContext(ctx);
vm.runInContext(src, ctx);
const results = ctx.HT.results;

const out = {};
try {
  out.hasRender = typeof results.render === 'function';
  out.hasShareUrl = typeof results.shareUrl === 'function';
  out.hasCopyText = typeof results.copyText === 'function';
  out.hasImageSnapshot = typeof results.imageSnapshot === 'function';

  if (out.hasRender) {
    const el = results.render(
      { traits: { calm: 80, bold: 30 }, archetype: { id: 'zen', label: 'Zen', emoji: '🧘' } },
      { title: 'You scored', conflict: 'You also said bold', slug: 'zen-test', traitCap: 4 }
    );
    out.rendered = !!el && !!el.attrs;
    out.hasDataPrint = el && el.attrs && el.attrs['data-print'] === 'result';
    out.role = el && el.attrs && el.attrs.role === 'region';
    out.ariaLive = el && el.attrs && el.attrs['aria-live'] === 'polite';
  }

  // shareUrl returns URL containing ?arch=<id>
  if (out.hasShareUrl) {
    const u = results.shareUrl(
      { id: 'zen', label: 'Zen', emoji: '🧘' },
      { slug: 'zen-test' }
    );
    out.shareUrl = typeof u === 'string' && u.indexOf('arch=zen') !== -1;
  }

  // copyText returns canonical format
  if (out.hasCopyText) {
    const t = results.copyText(
      { traits: { calm: 80, bold: 30 }, archetype: { id: 'zen', label: 'Zen', emoji: '🧘' } },
      { slug: 'zen-test' }
    );
    out.copyText = typeof t === 'string'
      && /Zen/.test(t)
      && /🧘/.test(t)
      && /\d+%/.test(t);
  }

  // imageSnapshot contract — throws 'snapshot unavailable'
  if (out.hasImageSnapshot) {
    let threw = false;
    let ok = false;
    try {
      const r = results.imageSnapshot({});
      if (r && typeof r.then === 'function') ok = true;
    } catch (e) {
      if (/snapshot unavailable/i.test(String(e && e.message || e))) {
        threw = true;
        ok = true;
      }
    }
    out.snapshotContract = ok || threw;
  }
} catch (e) {
  out.error = String(e && e.message || e);
}
process.stdout.write('JSON:' + JSON.stringify(out));
"""
    ).replace("__RESULTS_PATH__", json.dumps(str((repo_root() / "assets/js/results.js").resolve())))
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
        # Run the smoke file directly as a script entry point — NOT via
        # stdin (`node -`), because the harness resolves asset paths
        # relative to __dirname, and a stdin pipe leaves __dirname as
        # the cwd (typically the repo root, not scripts/), causing the
        # readFileSync on assets/js/shell-thin.js to crash with ENOENT
        # before any assertions run (same fix as dc-1-scoring.py).
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

    exit_with_summary("DC-2")


if __name__ == "__main__":
    main()