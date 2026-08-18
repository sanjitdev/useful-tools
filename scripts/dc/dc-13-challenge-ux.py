#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dc-13-challenge-ux.py — AC for Story 10.12 (Challenge UX: receiver
landing + privacy default + compare view).

Verifies:
  - assets/js/challenge-receiver.js exists and freezes HT.challengeReceiver
  - assets/css/compatibility-card.css exists and contains the 3-band selectors
  - the receiver module is registered in api-contract.js
  - the smoke harness (scripts/_smoke_challenge_receiver.js) exits 0
  - at least one quiz (spirit-animal canary) wires the receiver + ships a
    compare.html
  - gzipped size of challenge-receiver.js <= 3,000 bytes

Run: `python scripts/dc/dc-13-challenge-ux.py`.
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
    print("DC-13 — Challenge UX (receiver landing + privacy default + compare)")

    receiver_js = "assets/js/challenge-receiver.js"
    compat_css = "assets/css/compatibility-card.css"
    smoke = "scripts/_smoke_challenge_receiver.js"

    # 1. Module + CSS exist
    check(file_exists(receiver_js), f"{receiver_js} exists on disk")
    check(file_exists(compat_css), f"{compat_css} exists on disk")

    # 2. Receiver module freezes the public API (AD-14)
    src = read_text(receiver_js) or ""
    has_freeze = bool(re.search(
        r'Object\.defineProperty\(\s*HT\s*,\s*[\'"]challengeReceiver[\'"]\s*,\s*\{[^}]*writable:\s*false[^}]*configurable:\s*false',
        src,
        re.DOTALL,
    ))
    check(has_freeze, "challenge-receiver.js freezes HT.challengeReceiver (writable:false, configurable:false)")

    # 3. API contract documents the new namespace
    api = read_text("assets/js/api-contract.js") or ""
    check(bool(api) and "HT.challengeReceiver" in api,
          "assets/js/api-contract.js documents HT.challengeReceiver")

    # 4. CSS exposes the .compatibility-card + .challenge-banner surface
    css_src = read_text(compat_css) or ""
    check(".compatibility-card" in css_src, f"{compat_css} declares .compatibility-card")
    check(".challenge-banner" in css_src, f"{compat_css} declares .challenge-banner")
    check("band-high" in css_src and "band-mid" in css_src and "band-low" in css_src,
          f"{compat_css} declares the 3-band color selectors (high/mid/low)")
    check("aria-live" in src or "polite" in src,
          "receiver announces load via aria-live='polite' (a11y B2)")

    # 5. Privacy default: blind mode is the default — the consent toggle
    # is unchecked at mount. Verify by reading the source: state.reveal
    # starts false, banner text says "blind" first.
    check("'Take the quiz blind'" in src or "take the quiz blind" in src.lower(),
          "consent banner defaults to 'take the quiz blind' (privacy first)")
    check("cb.checked = state.reveal" in src or "checked: state.reveal" in src
          or "cb.checked = false" in src,
          "consent toggle defaults to unchecked (state.reveal === false)")

    # 6. Bundle size gate includes challenge-receiver.js + compatibility-card.css
    bsg = read_text("scripts/bundle-size-gate.py") or ""
    check('"assets/js/challenge-receiver.js"' in bsg,
          "scripts/bundle-size-gate.py lists assets/js/challenge-receiver.js in SPEC_PAGE_CONDITIONAL_MODULES")
    check('"assets/css/compatibility-card.css"' in bsg,
          "scripts/bundle-size-gate.py lists assets/css/compatibility-card.css in SPEC_PAGE_CONDITIONAL_MODULES")

    # 7. Every Discovery quiz wires the receiver + ships a compare.html
    # (canary: spirit-animal; roll-out: 9 more via Story 10.12 follow-up)
    tools = read_text("tools.json") or ""
    try:
        entries = json.loads(tools).get("packs", {}).get("discovery", {}).get("entries", [])
    except json.JSONDecodeError:
        entries = []
    if not entries:
        check(False, "tools.json→packs.discovery.entries is non-empty")
    else:
        check(True, f"tools.json->packs.discovery.entries has {len(entries)} quizzes")
        for entry in entries:
            slug = entry.get("slug") if isinstance(entry, dict) else None
            if not slug:
                continue
            idx_path = f"tools/packs/discovery/{slug}/index.html"
            cmp_path = f"tools/packs/discovery/{slug}/compare.html"
            core_path = f"tools/packs/discovery/{slug}/{slug}-core.js"

            if file_exists(idx_path):
                idx_src = read_text(idx_path) or ""
                check("challenge-receiver.js" in idx_src,
                      f"{idx_path} loads challenge-receiver.js")
            else:
                check(False, f"{idx_path} exists [missing]")

            if file_exists(cmp_path):
                cmp_src = read_text(cmp_path) or ""
                check("challenge-receiver.js" in cmp_src,
                      f"{cmp_path} loads challenge-receiver.js")
                check("compatibility-card.css" in cmp_src,
                      f"{cmp_path} loads compatibility-card.css")
                check("compareView" in cmp_src,
                      f"{cmp_path} calls HT.challengeReceiver.compareView")
                check(f"compareView('{slug}'" in cmp_src,
                      f"{cmp_path} substitutes the correct slug into compareView()")
            else:
                check(False, f"{cmp_path} exists [missing]")

            if file_exists(core_path):
                core_src = read_text(core_path) or ""
                check("HT.challengeReceiver" in core_src,
                      f"{core_path} consumes HT.challengeReceiver")
                check("getChallengeBlob" in core_src,
                      f"{core_path} gates the receiver flow on getChallengeBlob")
                check(f"var QUIZ_SLUG = '{slug}'" in core_src,
                      f"{core_path} declares QUIZ_SLUG = '{slug}'")
                check("./compare.html" in core_src,
                      f"{core_path} builds a compare.html redirect URL")
            else:
                check(False, f"{core_path} exists [missing]")

    # 8. Smoke harness exits 0
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

    # 9. Runtime: load receiver module in vm sandbox and exercise landing + compareView
    fixture = (
        r"""
'use strict';
const fs = require('fs');
const vm = require('vm');

const RECEIVER_PATH = __RECEIVER_PATH__;
const src = fs.readFileSync(RECEIVER_PATH, 'utf8');

const ctx = {
  window: {},
  navigator: {},
  document: {
    body: { appendChild: () => {} },
    createElement: (tag) => ({
      tag: tag, setAttribute() {}, appendChild() {}, addEventListener() {},
      style: {}, classList: { add() {}, remove() {} },
      querySelector() { return null; },
    }),
    createTextNode: (text) => ({ nodeType: 3, textContent: text, appendChild: () => {} }),
    querySelector() { return null; },
    getElementById() { return null; },
    readyState: 'complete',
    addEventListener() {},
  },
  URLSearchParams: URLSearchParams,
  localStorage: { _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); } },
  HT: {
    challenge: {
      verify: () => ({ ok: true }),
      compare: () => ({ score: 75, axes: [] }),
    },
    copyToClipboard: () => Promise.resolve(),
    toast: () => {},
  },
};
ctx.window.HT = ctx.HT;
ctx.window.location = { search: '?c=valid-blob', hash: '', origin: 'http://example.com', pathname: '/disc/spirit-animal/' };
ctx.window.localStorage = ctx.localStorage;
ctx.window.matchMedia = () => ({ matches: false });
ctx.globalThis = ctx;
ctx.self = ctx;
ctx.setTimeout = setTimeout;
ctx.atob = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('binary');
ctx.btoa = (s) => Buffer.from(s, 'binary').toString('base64');

vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'challenge-receiver.js' });
const CR = ctx.HT.challengeReceiver;

const out = {};
out.hasLanding = typeof CR.landing === 'function';
out.hasCompareView = typeof CR.compareView === 'function';
out.isFrozen = Object.isFrozen(CR);

const host = { insertBefore() {}, firstChild: null, querySelector() { return null; },
               appendChild() {}, innerHTML: '', textContent: '', parentNode: { insertBefore() {} } };
const landingResult = CR.landing('spirit-animal', host, {});
out.landingReturnsObject = landingResult && typeof landingResult === 'object';
out.landingHasOkField = landingResult && typeof landingResult.ok === 'boolean';

const compareHost = { appendChild(c) { compareHost._appended = c; } };
CR.compareView('spirit-animal', { q1: 'a' }, { q1: 'a' }, compareHost);
out.compareRendersCard = compareHost._appended && compareHost._appended.className === 'compatibility-card';

process.stdout.write('JSON:' + JSON.stringify(out));
"""
    ).replace("__RECEIVER_PATH__", json.dumps(str((repo_root() / receiver_js).resolve())))
    rc, stdout, stderr = run_node(fixture)
    runtime = {}
    for line in stdout.splitlines()[::-1]:
        if line.startswith("JSON:"):
            try: runtime = json.loads(line[5:])
            except Exception: runtime = {}
            break
    if file_exists(receiver_js):
        check(runtime.get("hasLanding"), "HT.challengeReceiver.landing is callable (runtime)")
        check(runtime.get("hasCompareView"), "HT.challengeReceiver.compareView is callable (runtime)")
        check(runtime.get("isFrozen"), "HT.challengeReceiver is frozen (runtime)")
        check(runtime.get("landingReturnsObject"), "landing() returns an object (runtime)")
        check(runtime.get("landingHasOkField"), "landing() result has {ok: boolean} (runtime)")
        check(runtime.get("compareRendersCard"), "compareView() appends a .compatibility-card (runtime)")
    else:
        for label in (
            "HT.challengeReceiver.landing is callable (runtime)",
            "HT.challengeReceiver.compareView is callable (runtime)",
            "HT.challengeReceiver is frozen (runtime)",
            "landing() returns an object (runtime)",
            "landing() result has {ok: boolean} (runtime)",
            "compareView() appends a .compatibility-card (runtime)",
        ):
            check(False, label + " [receiver.js missing]")

    # 10. gzipped size <= 3,000 bytes (Story 10.12 budget — covers the
    # full landing + compareView + stash/read surface)
    sz = gzipped_size(receiver_js) if file_exists(receiver_js) else None
    check(sz is not None and sz <= 3000,
          f"gzipped size of challenge-receiver.js <= 3,000 bytes (got {sz})")

    exit_with_summary("DC-13")


if __name__ == "__main__":
    main()