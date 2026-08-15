#!/usr/bin/env python3
"""
Story 4 Phase 5 — extract components.css into:
  - components-core.css       (always-on Tier 1)
  - chrome-palette.css        (lazy with palette)
  - chrome-settings.css       (lazy with settings)
  - chrome-help.css           (lazy with help-overlay)
  - chrome-confirm-share.css  (lazy with sample-data + share)
  - chrome-history.css        (lazy with history)

Slice boundaries are line ranges taken verbatim from the source.
The script preserves the section divider comments so the new files
remain self-documenting.

Pure stdlib — no external dependencies. Idempotent.
"""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'css' / 'components.css'

# (output_filename, start_line, end_line_inclusive, header)
SLICES = [
    (
        'components-core.css',
        1, 1132,
        'Handy Tools — components-core.css\n'
        '   Story 4 Phase 5: extracted always-on Tier 1 rules from\n'
        '   components.css. Contains the site-header, site-footer,\n'
        '   button base, inputs, cards (home + pack), hero,\n'
        '   section-header, tabs, and toast styles. ~6 KB gz.\n'
        '   Loaded synchronously on every chrome page.',
    ),
    (
        'chrome-palette.css',
        1133, 1395,
        'Handy Tools — chrome-palette.css\n'
        '   Story 4 Phase 5: lazy-loaded alongside the palette Proxy\n'
        '   stub via HT.lazyLoadCss. Command Palette overlay\n'
        '   (UX-DR-3 + WAI-ARIA combobox pattern).',
    ),
    (
        'chrome-settings.css',
        1396, 1722,
        'Handy Tools — chrome-settings.css\n'
        '   Story 4 Phase 5: lazy-loaded with settings DOM. Settings\n'
        '   Modal (Story 1.8) — WAI-ARIA 1.2 dialog pattern.',
    ),
    (
        'chrome-help.css',
        1723, 2071,
        'Handy Tools — chrome-help.css\n'
        '   Story 4 Phase 5: lazy-loaded with help-overlay.js.\n'
        '   Keyboard Shortcuts Help Overlay (Story 3.3).',
    ),
    (
        'chrome-confirm-share.css',
        2072, 2302,
        'Handy Tools — chrome-confirm-share.css\n'
        '   Story 4 Phase 5: shared by confirm (sample-data / reset)\n'
        '   and share dialogs. Both use the same <dialog> surface\n'
        '   tokens (backdrop, dark mode, forced-colors, mobile sheet),\n'
        '   so they ship as a single CSS chunk to avoid splitting\n'
        '   shared rules.',
    ),
    (
        'chrome-history.css',
        2303, 2451,
        'Handy Tools — chrome-history.css\n'
        '   Story 4 Phase 5: lazy-loaded with history.js. History\n'
        '   panel + mobile sheet (Story 3.6).',
    ),
]


def make_header(title: str) -> str:
    """Build a /* ... */ banner matching the project's house style."""
    inner = title.split('\n', 1)[1].strip().rstrip()
    # Re-read: title already includes multi-line text after the first \n.
    body = title
    lines = ['/* ' + '=' * 45, '   ' + body, '   ' + '=' * 45 + ' */', '']
    return '\n'.join(lines)


def main() -> int:
    if not SRC.exists():
        print(f'ERROR: source not found: {SRC}', file=sys.stderr)
        return 1

    raw = SRC.read_text(encoding='utf-8')
    # Split into lines but keep newlines attached so we can reassemble.
    lines = raw.splitlines(keepends=True)

    out_dir = SRC.parent
    summary = []

    for fname, start, end, header in SLICES:
        # Convert to 0-indexed inclusive range.
        chunk = ''.join(lines[start - 1:end])
        banner = make_header(header) + '\n'
        body = banner + chunk
        out_path = out_dir / fname
        out_path.write_text(body, encoding='utf-8')
        size_raw = out_path.stat().st_size
        # gzipped size for budget reporting.
        import gzip
        size_gz = len(gzip.compress(body.encode('utf-8')))
        summary.append((fname, size_raw, size_gz))

    print('Extracted:')
    for fname, raw_, gz_ in summary:
        print(f'  {fname:32}  {raw_:>7,} raw   {gz_:>5,} gz')
    total_raw = sum(s[1] for s in summary)
    total_gz = sum(s[2] for s in summary)
    print(f'  {"TOTAL":32}  {total_raw:>7,} raw   {total_gz:>5,} gz')
    print(f'  {"components.css (orig)":32}  {len(raw):>7,} raw   '
          f'{len(__import__("gzip").compress(raw.encode("utf-8"))):>5,} gz')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
