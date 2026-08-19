#!/usr/bin/env python3
"""Verify scripts/header-search-smoke.html exists and is well-formed.

This is a structural smoke test for the inline header-search browser
harness (Story 10.20). It does not exercise the JS-driven render path
(that requires a headless browser); it verifies the file is present,
parses, exposes the expected test count, the right inline DOM shape,
and the CI mode gate. The Node driver (when added) mirrors the same
checks via vm.createContext and is the authoritative headless smoke;
this script ensures the HTML harness file stays in sync with the
contract surface (HT.headerSearch API, top-8 cap, JS-driven render
assertion, embed-mode hiding, etc.).

Mirrors the pattern of palette-search-smoke-html.py so a regression in
either harness is caught by the same structural gate.

Exit codes:
  0 — harness file passes structural checks
  1 — harness file missing or malformed
"""

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
HARNESS = REPO_ROOT / 'scripts' / 'header-search-smoke.html'


def main():
    if not HARNESS.exists():
        print(f'header-search-smoke-html: harness file missing: {HARNESS}')
        return 1

    text = HARNESS.read_text(encoding='utf-8')

    checks = [
        ('loads components-core.css',
         'href="../assets/css/components-core.css"' in text),
        ('loads search.js',
         'src="../assets/js/search.js"' in text),
        ('loads shell.js deferred',
         'src="../assets/js/shell.js" defer' in text),
        ('CI mode gate (?ci=1)',
         "URLSearchParams(window.location.search).get('ci') === '1'" in text),
        ('CI signal name (__htHeaderSearchSmokeFailed)',
         '__htHeaderSearchSmokeFailed' in text),
        # Inline DOM shape — mirrors the chrome include byte-for-byte so
        # the static markup matches what real pages render.
        ('inline wrapper #header-search role=search',
         '<div class="shell-header-search" id="header-search" role="search" data-open="false">' in text),
        ('inline input-wrap #header-search-input-wrap',
         '<div class="shell-header-search-input-wrap" id="header-search-input-wrap">' in text),
        ('inline icon svg #header-search-icon',
         '<svg class="shell-header-search-icon" id="header-search-icon"' in text),
        ('inline input #header-search-input role=combobox (no tabindex)',
         '<input class="shell-header-search-input" id="header-search-input" type="search" role="combobox"' in text
         and 'tabindex' not in text.split('id="header-search-input"', 1)[1].split('>', 1)[0]),
        ('inline panel #header-search-panel hidden',
         re.search(
             r'<div\s+class="shell-header-search-panel"\s+id="header-search-panel"[^>]*\bhidden\b',
             text,
             re.IGNORECASE,
         ) is not None),
        ('inline listbox #header-search-listbox role=listbox',
         '<ul class="shell-header-search-list" id="header-search-listbox" role="listbox"' in text),
        ('inline live region #header-search-live aria-live=polite',
         '<div id="header-search-live" class="shell-sr-only" aria-live="polite" aria-atomic="true">' in text),
        ('inline footer carries chord hints (no Show all CTA)',
         re.search(
             r'<div\s+class="shell-header-search-footer">\s*'
             r'<span\s+class="shell-header-search-footer-hints"[^>]*>\s*\u2191\u2193',
             text,
         ) is not None
         and 'shell-header-search-show-all' not in text
         and 'data-open-palette' not in text),
        ('fixture: at least 4 inline tools (qr/compound/age/tip/inflation)',
         text.count('"slug":"qr-code-generator"') == 1
         and text.count('"slug":"compound-interest"') == 1
         and text.count('"slug":"age-calculator"') == 1
         and text.count('"slug":"tip-calculator"') == 1
         and text.count('"slug":"inflation-calculator"') == 1),
        # Test-by-test markers (executed in the harness script).
        ('Test 1 (headerSearch API surface)',
         'headerSearch API surface' in text),
        ('Test 2 (static markup present)',
         'static markup present' in text),
        ('Test 3 (wrapper role=search)',
         'wrapper role="search"' in text or 'wrapper role=search' in text),
        ('Test 4 (input combobox attrs)',
         'input combobox attrs' in text),
        ('Test 5 (panel [hidden])',
         'panel [hidden]' in text),
        ('Test 6 (listbox role=listbox)',
         'listbox role=listbox' in text),
        ('Test 7 (footer chord hints, no Show all CTA)',
         'footer chord hints' in text and 'no "Show all" CTA' in text),
        ('Test 8 (live region attrs)',
         'live region attrs' in text),
        ('Test 9 (chrome-header-search.css reachable + eager)',
         'chrome-header-search.css reachable' in text),
        ('Test 10 (JS-driven open unhides panel)',
         'unhides panel' in text),
        ('Test 11 (top-8 cap: "qr" rendered)',
         'top-8 cap' in text and 'querySelectorAll(\'[role="option"]\')' in text),
        ('Test 12 (live region announced)',
         'live region announced' in text or 'live region announcement' in text),
        ('Test 13 (close() hides panel)',
         'HT.headerSearch.close() hides panel' in text),
        ('Test 14 (embed mode hides the inline search)',
         'embed mode hides the inline search' in text),
        # Story 10.20 patch #3 — polished result rows (icon swatch +
        # description + chevron + per-category tint).
        ('Test 15 (row shape: icon swatch + text col + chevron + data-cat)',
         'row shape' in text and '.shell-header-search-row-icon' in text
         and '.shell-header-search-row-text' in text
         and '.shell-header-search-row-chevron' in text
         and 'data-cat=' in text),
        ('Test 16 (CSS row-icon + row-text + row-desc + row-chevron + per-cat tint rules)',
         'CSS row shape' in text
         and '.shell-header-search-row-icon' in text
         and '.shell-header-search-row-text' in text
         and '.shell-header-search-row-desc' in text
         and '.shell-header-search-row-chevron' in text
         # The actual CSS is fetched at runtime; the harness file
         # should reference all 5 class names + a per-cat tint
         # pattern (data-cat="developer" preceding row-icon) that
         # the runtime regex will use.
         and re.search(r'data-cat="developer".{0,40}shell-header-search-row-icon', text, re.DOTALL) is not None),
        # Always fail-loud under CI: catch regressions that re-introduce
        # the `if (isCi) failed += 1` gate that the palette harness also
        # pins down (a CI gate that early-returns defeats the harness).
        ('always fail-loud (no if (isCi) gate)',
         re.search(r'if\s*\(\s*isCi\s*\)\s*failed\s*\+=\s*1', text) is None),
    ]

    failed = [name for name, ok in checks if not ok]
    for name, ok in checks:
        print(f'  {"ok" if ok else "FAIL":<4} {name}')
    if failed:
        print(f'header-search-smoke-html: {len(failed)} structural check(s) failed')
        return 1
    print('header-search-smoke-html: harness passes structural checks')
    return 0


if __name__ == '__main__':
    sys.exit(main())