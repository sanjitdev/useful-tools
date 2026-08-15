#!/usr/bin/env python3
"""Verify scripts/palette-search-smoke.html exists and is well-formed.

This is a structural smoke test for the palette-search browser harness.
It does not exercise the JS-driven render path (that requires a headless
browser); it verifies the file is present, parses, and exposes the
expected test count + CI mode gate. The Node driver
`scripts/_smoke_palette_search.js` mirrors the same checks via
vm.createContext and is the authoritative headless smoke; this script
ensures the HTML harness file stays in sync with the contract surface
(8-tool fixture, JS-driven render assertion, top-5 cap marker, etc.).

Exit codes:
  0 — harness file passes structural checks
  1 — harness file missing or malformed
"""

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
HARNESS = REPO_ROOT / 'scripts' / 'palette-search-smoke.html'


def main():
    if not HARNESS.exists():
        print(f'palette-search-smoke-html: harness file missing: {HARNESS}')
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
        ('CI signal name (__htPaletteSmokeFailed)',
         '__htPaletteSmokeFailed' in text),
        ('fixture: 8 inline tools (5 qr-* for top-5 cap)',
         text.count('"slug":"qr-') == 5 and text.count('"id":"inflation-calculator"') == 1),
        ('Test 1 (palette API surface)',
         'palette API surface' in text),
        ('Test 2 (_matchRange returns {start,end})',
         '_matchRange returns {start,end}' in text),
        ('Test 3 (_matchRange null on no-match)',
         '_matchRange returns null on no-match' in text),
        ('Test 4 (top-5 cap engine surface)',
         'top-5 cap engine surface' in text),
        ('Test 5 (empty query)',
         'empty query returns []' in text),
        ('Test 6 (no-match query)',
         'no-match query returns []' in text),
        ('Test 7 (live region exists)',
         'live region #palette-live present in static markup' in text),
        ('Test 8 (aria-live=polite)',
         'aria-live="polite"' in text),
        ('Test 9 (forced-colors CanvasText border)',
         'solid\\s+CanvasText' in text or 'CanvasText border' in text),
        ('Test 10 (palette input aria-activedescendant)',
         'aria-activedescendant' in text),
        ('Test 11 (palette footer chord hints)',
         'palette footer carries chord hints' in text),
        ('Test 12 (warm-path perf)',
         'warm path' in text and 'per <= 10' in text),
        # Test 13 is the JS-driven render assertion — the heart of the
        # top-5-cap coverage that the Node driver can't exercise
        # directly. Catches regressions where renderPaletteList drifts
        # from .slice(0, 5).
        ('Test 13 (JS-driven render: 5 [role=option] rows)',
         'JS-driven render: 5 [role=option] rows' in text and
         "listbox.querySelectorAll('[role=\"option\"]')" in text),
        ('Test 13 (live region announces)',
         'JS-driven render: live region announces' in text),
        # Always fail-loud warm-path perf: the CI gating was redundant
        # because the harness is only ever loaded with intent to fail.
        # The structural check catches regressions where someone re-adds
        # the if (isCi) gate.
        ('Test 12 always fail-loud (no if (isCi) gate)',
         re.search(r'if\s*\(\s*isCi\s*\)\s*failed\s*\+=\s*1', text) is None),
    ]

    failed = [name for name, ok in checks if not ok]
    for name, ok in checks:
        print(f'  {"ok" if ok else "FAIL":<4} {name}')
    if failed:
        print(f'palette-search-smoke-html: {len(failed)} structural check(s) failed')
        return 1
    print('palette-search-smoke-html: harness passes structural checks')
    return 0


if __name__ == '__main__':
    sys.exit(main())