#!/usr/bin/env python3
"""
Story 4 Phase 5 — swap components.css → components-core.css in chrome
HTMLs. The lazy chunks (chrome-palette.css etc.) are injected by
shell-thin.js Proxy stubs, NOT linked from HTML, so this script only
replaces the always-on CSS reference.

Path-aware: chrome pages live at 3 depths (root, packs/, tools/*/).
The relative URL changes per depth, but the substitution is purely
textual (`components.css` → `components-core.css`) and works at
every depth.

Pure stdlib. Idempotent.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# All chrome pages that link to components.css. The script does a
# recursive text-replace; if a file does not contain the substring,
# it is silently skipped.
HTML_GLOBS = [
    'index.html',
    'view-source.html',
    'quality.html',
    'packs/*.html',
    'tools/*/index.html',
    'scripts/*.html',
]


def main() -> int:
    files = []
    # Path.glob('packs/*.html') doesn't always expand on Windows shells,
    # so use rglob + filtering. We want exactly:
    #   - index.html (root), view-source.html, quality.html
    #   - packs/*.html
    #   - tools/*/index.html
    #   - scripts/*.html (smoke harnesses)
    files.extend([
        ROOT / 'index.html',
        ROOT / 'view-source.html',
        ROOT / 'quality.html',
    ])
    for p in sorted((ROOT / 'packs').glob('*.html')):
        files.append(p)
    for p in sorted((ROOT / 'tools').glob('*/index.html')):
        files.append(p)
    for p in sorted((ROOT / 'scripts').glob('*.html')):
        files.append(p)

    # De-dup + filter to existing files only.
    seen = set()
    files = [f for f in files if not (str(f) in seen or seen.add(str(f))) and f.exists()]
    if not files:
        print('ERROR: no HTML files matched', file=sys.stderr)
        return 1

    changed = []
    for f in files:
        text = f.read_text(encoding='utf-8')
        if 'components.css' not in text:
            continue
        new_text = text.replace('components.css', 'components-core.css')
        if new_text != text:
            f.write_text(new_text, encoding='utf-8')
            changed.append(f.relative_to(ROOT))

    print(f'Swapped components.css -> components-core.css in {len(changed)} files:')
    for f in changed:
        print(f'  {f}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
