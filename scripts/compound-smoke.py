#!/usr/bin/env python3
"""Verify scripts/compound-smoke.html exists and is well-formed.

This is a structural smoke test for the compound-interest browser
harness. It does not exercise the iframe-driven JS (that requires a
headless browser); it verifies the file is present, parses, and
exposes the expected test count + CI mode gate.

Exit codes:
  0 — harness file passes structural checks
  1 — harness file missing or malformed
"""

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
HARNESS = REPO_ROOT / 'scripts' / 'compound-smoke.html'


def main():
    if not HARNESS.exists():
        print(f'compound-smoke: harness file missing: {HARNESS}')
        return 1

    text = HARNESS.read_text(encoding='utf-8')

    checks = [
        ('iframe to compound-interest tool',
         'src="../tools/compound-interest/index.html"' in text),
        ('CI mode gate (?ci=1)',
         'new URLSearchParams(window.location.search).get(\'ci\') === \'1\'' in text),
        ('CI signal name (__htSmokeFailed)',
         '__htSmokeFailed' in text),
        ('timeout fallback',
         '10000' in text and 'timeout' in text.lower()),
        ('Test 1 (no-contrib monthly)',
         'no-contrib monthly' in text),
        ('Test 2 (regression annual)',
         'regression annual' in text),
        ('Test 3 (monotonicity)',
         'monotonicity' in text),
        ('Test 4 (contrib timing)',
         'contrib timing' in text),
        ('Test 5 (year-1 monthly)',
         'year-1 monthly balance' in text),
        ('Test 6 (year-1 quarterly)',
         'year-1 quarterly balance' in text),
        ('Test 7 (with-contrib annual)',
         'with-contrib annual' in text),
        ('total = 7 in finalize',
         re.search(r'const total = 7;', text) is not None),
    ]

    failed = [name for name, ok in checks if not ok]
    for name, ok in checks:
        print(f'  {"ok" if ok else "FAIL":<4} {name}')
    if failed:
        print(f'compound-smoke: {len(failed)} structural check(s) failed')
        return 1
    print('compound-smoke: harness passes structural checks')
    return 0


if __name__ == '__main__':
    sys.exit(main())
