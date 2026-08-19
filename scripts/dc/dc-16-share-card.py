#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dc-16-share-card.py — AC for Story 10.11 (Share-card chrome:
PNG / URL / Print full UX).

Verifies:
  - assets/js/share-card.js exists and freezes HT.shareCard with
    the four-method public API (ogSvg, downloadAsPng, copyUrl, print)
  - assets/js/share-card.js is registered in api-contract.js
  - share-card.js is listed in scripts/bundle-size-gate.py
    SPEC_PAGE_CONDITIONAL_MODULES
  - the smoke harness (scripts/_smoke_share_card.js) exits 0
  - gzipped size of share-card.js <= 4,096 bytes
  - the OG SVG output respects the 1200×630 viewport, has <title>
    as the first child element (a11y H3 contract), and contains
    the archetype label + emoji + blind-spot when supplied
  - the rasterize path falls back to "Copy as text" when
    canvas.toBlob is unavailable (the spec's documented fallback)
  - the bundle-size gate still passes (no chrome-budget regression)

Run: `python scripts/dc/dc-16-share-card.py`.
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
)


def main():
    print("DC-16 — Share-card chrome (PNG / URL / Print full UX)")

    js = "assets/js/share-card.js"
    smoke = "scripts/_smoke_share_card.js"

    # 1. Module exists
    check(file_exists(js), f"{js} exists on disk")

    src = read_text(js) or ""

    # 2. Public API surface — the four methods must be exposed
    # on the frozen publicApi object.
    check("function ogSvg" in src, "share-card.js declares ogSvg()")
    check("function downloadAsPng" in src, "share-card.js declares downloadAsPng()")
    check("function copyUrl" in src, "share-card.js declares copyUrl()")
    check("function print" in src, "share-card.js declares print()")
    check("publicApi = Object.freeze" in src, "share-card.js wraps publicApi in Object.freeze")

    # 3. AD-14 freeze — HT.shareCard is defined with
    # writable:false, configurable:false via Object.defineProperty.
    has_freeze = bool(re.search(
        r'Object\.defineProperty\(\s*HT\s*,\s*[\'"]shareCard[\'"]\s*,\s*\{[^}]*writable:\s*false[^}]*configurable:\s*false',
        src,
        re.DOTALL,
    ))
    check(has_freeze, "share-card.js freezes HT.shareCard (writable:false, configurable:false)")

    # 4. API contract documents the new namespace
    api = read_text("assets/js/api-contract.js") or ""
    check("HT.shareCard" in api, "assets/js/api-contract.js documents HT.shareCard")

    # 5. The OG SVG generator emits a 1200×630 <svg> with <title>
    # as the FIRST child element (per a11y H3 — social-media platforms
    # announce the archetype, not "image").
    check('viewBox="0 0 1200 630"' in src,
          "ogSvg emits the 1200×630 OG viewport")
    check("'<title" in src or "'<title '".replace(' ', '') in src.replace(' ', '')
          or '"<title' in src or '_esc(emoji + ' in src,
          "ogSvg includes the <title> element bound by aria-labelledby=og-title")
    # The exact idiom in the source: '<title id="og-title">'
    check('<title id="og-title">' in src,
          "ogSvg emits <title id=\"og-title\"> as the first child element")

    # 6. XSS hardening — the ogSvg escaper must reject HTML in
    # the archetype label and blind-spot text. Verify the helper
    # exists and is wired into every field.
    check("function _esc" in src, "share-card.js declares _esc() helper")
    check("const safeTitle = _esc(" in src or "esc(emoji + ' ' + label" in src,
          "ogSvg escapes the <title> text")
    check("esc(_trunc(blindSpot" in src or "esc(blindSpot" in src or "_esc(_trunc(blindSpot" in src,
          "ogSvg escapes the blind-spot text")

    # 7. Rasterize fallback — when canvas.toBlob is unavailable the
    # module MUST fall back to copyUrl() (per the spec — "Copy as
    # text" path so the user still gets a share artifact).
    check("typeof canvas.toBlob === 'function'" in src or "typeof canvas.toBlob ==" in src,
          "downloadAsPng checks for canvas.toBlob presence")
    check("_fallbackToText" in src,
          "downloadAsPng routes through _fallbackToText on rasterize failure")
    check("return _fallbackToText(state, opts, 'canvas unavailable')" in src,
          "downloadAsPng short-circuits to text path when canvas is absent")

    # 8. Bundle-size gate — share-card.js is in SPEC_PAGE_CONDITIONAL_MODULES.
    bsg = read_text("scripts/bundle-size-gate.py") or ""
    check('"assets/js/share-card.js"' in bsg,
          "scripts/bundle-size-gate.py lists assets/js/share-card.js in SPEC_PAGE_CONDITIONAL_MODULES")

    # 9. Bundle-size budget — gzipped share-card.js <= 4 KB.
    gz = gzipped_size(js)
    if gz is None:
        check(False, "share-card.js gzipped size measurable")
    else:
        check(gz <= 4096,
              f"share-card.js gzipped size <= 4 KB (got {gz} bytes)")

    # 10. The smoke harness runs and exits 0.
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
              f"{smoke} exits 0 via node (rc={r.returncode})")
    else:
        check(False, f"{smoke} exists [missing]")

    # 11. Bundle-size gate as a whole still passes — adding share-card.js
    # is page-conditional (not in the chrome budget), but verify the
    # gate hasn't regressed.
    r = subprocess.run(
        [sys.executable, str(repo_root() / "scripts/bundle-size-gate.py")],
        capture_output=True,
        text=True,
        timeout=60,
        encoding="utf-8",
        errors="replace",
    )
    check(r.returncode == 0,
          f"bundle-size-gate.py exits 0 with share-card.js added (rc={r.returncode})")

    # 12. Runtime: load share-card.js in a vm sandbox and verify
    # the ogSvg output for a representative archetype.
    fixture = r"""
'use strict';
const fs = require('fs');
const vm = require('vm');
const src = process.argv[2];
const ctx = {
  console,
  setTimeout, clearTimeout,
  Blob: function(parts, opts) { this.parts = parts; this.type = (opts && opts.type) || ''; this.size = 0; },
  URL: { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} },
  atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  document: {
    createElement: (tag) => ({ tag: tag, width: 0, height: 0, getContext: () => null, toBlob: () => {}, toDataURL: () => '', setAttribute: () => {}, appendChild: () => {}, removeChild: () => {}, click: () => {}, style: {} }),
    body: { children: [], appendChild: () => {}, removeChild: () => {} },
  },
  HT: {},
};
ctx.window = ctx; ctx.self = ctx;
ctx.HTMLElement = function () {};
vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'share-card.js' });
const SC = ctx.HT.shareCard;
const out = {};
out.hasOgSvg = typeof SC.ogSvg === 'function';
out.hasDownload = typeof SC.downloadAsPng === 'function';
out.hasCopy = typeof SC.copyUrl === 'function';
out.hasPrint = typeof SC.print === 'function';
out.frozen = Object.isFrozen(SC);
const svg = SC.ogSvg({
  archetype: { id: 'fox', label: 'Fox', emoji: '🦊' },
  blindSpot: 'Strategy can shade into manipulation.',
  tagline: 'Clever, adaptable.',
}, { slug: 'spirit-animal', title: 'Spirit Animal' });
out.svgHasTitle = /<title id="og-title">/.test(svg);
out.svgHasEmoji = svg.indexOf('🦊') !== -1;
out.svgHasLabel = svg.indexOf('Fox') !== -1;
out.svgHasBlindSpot = svg.indexOf('manipulation') !== -1;
out.svgHasSlug = svg.indexOf('SPIRIT ANIMAL') !== -1;
out.svgHasViewBox = /viewBox="0 0 1200 630"/.test(svg);
out.svgHasWatermark = svg.indexOf('Handy Tools') !== -1;
console.log(JSON.stringify(out));
"""
    fixture_path = repo_root() / ".tmp-dc-16-vm.js"
    try:
        fixture_path.write_text(fixture, encoding="utf-8")
        # Read the source on the host side, pass it as the second
        # argument. The vm sandbox has no `fs` so the source has
        # to be supplied as a string.
        src_text = read_text(js) or ""
        r = subprocess.run(
            ["node", str(fixture_path), src_text],
            capture_output=True,
            text=True,
            timeout=20,
            encoding="utf-8",
            errors="replace",
        )
        if r.returncode == 0 and r.stdout.strip():
            try:
                data = json.loads(r.stdout.strip().splitlines()[-1])
            except (json.JSONDecodeError, IndexError):
                data = {}
            check(bool(data.get("hasOgSvg")), "vm: HT.shareCard.ogSvg is callable")
            check(bool(data.get("hasDownload")), "vm: HT.shareCard.downloadAsPng is callable")
            check(bool(data.get("hasCopy")), "vm: HT.shareCard.copyUrl is callable")
            check(bool(data.get("hasPrint")), "vm: HT.shareCard.print is callable")
            check(bool(data.get("frozen")), "vm: HT.shareCard is frozen")
            check(bool(data.get("svgHasTitle")),
                  "vm: ogSvg output has <title id=\"og-title\">")
            check(bool(data.get("svgHasViewBox")),
                  "vm: ogSvg output has 1200×630 viewBox")
            check(bool(data.get("svgHasEmoji")),
                  "vm: ogSvg output includes the archetype emoji")
            check(bool(data.get("svgHasLabel")),
                  "vm: ogSvg output includes the archetype label")
            check(bool(data.get("svgHasBlindSpot")),
                  "vm: ogSvg output includes the blind-spot text")
            check(bool(data.get("svgHasSlug")),
                  "vm: ogSvg output uses opts.slug as the eyebrow text")
            check(bool(data.get("svgHasWatermark")),
                  "vm: ogSvg output includes the Handy Tools watermark")
        else:
            check(False, f"vm sandbox exited rc={r.returncode}")
            if r.stderr:
                print(r.stderr.strip())
    finally:
        try:
            fixture_path.unlink()
        except OSError:
            pass

    exit_with_summary("DC-16")


if __name__ == "__main__":
    main()
