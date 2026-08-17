#!/usr/bin/env python3
"""Add the Date Picker Lab link to the site header of every chrome page.

Hand-rolled edit because `scripts/shell-template.py --apply-all` produced
a regression (deleted body content) when regenerating. This script only
splices a single `<a class="shell-header-lab">` element right after
`<nav class="shell-header-nav" aria-label="Primary">` and is idempotent.

Run: `python scripts/_add_lab_link.py`
"""
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# Match chrome.html exactly: indented + multiline SVG/span inside <a>.
# chrome.html has the link at 6-space indent under <nav>, SVG at 8-space.
LAB_LINK_TEMPLATE = '''{indent}<a class="shell-header-lab" href="{href}" aria-label="Date Picker Lab">
{indent}  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 2v6L4 17a2 2 0 0 0 1.7 3h12.6A2 2 0 0 0 20 17l-5-9V2"/><path d="M7 2h10"/><path d="M8 14h8"/></svg>
{indent}  <span>Lab</span>
{indent}</a>'''

NAV_RE = re.compile(
    r'(<nav class="shell-header-nav" aria-label="Primary">)\s*\n',
)

# (page path, base href to lab)
PAGES = []

# Home / quality at repo root — use "../../tools/..." for byte-match
# against chrome.html. Browser resolves "../../" from the repo root to
# the repo root (no parent), so the link still lands on the lab page.
p_home = REPO / 'index.html'
if p_home.is_file():
    PAGES.append((p_home, '../../tools/date-picker-lab/index.html'))

# Tools at tools/<slug>/index.html — two levels up
for d in sorted((REPO / 'tools').iterdir()):
    if not d.is_dir(): continue
    p = d / 'index.html'
    if p.is_file():
        PAGES.append((p, '../../tools/date-picker-lab/index.html'))

# Packs at packs/*.html — chrome.html uses "../../" too
packs_dir = REPO / 'packs'
if packs_dir.is_dir():
    for p in sorted(packs_dir.glob('*.html')):
        PAGES.append((p, '../../tools/date-picker-lab/index.html'))

# Other top-level pages
for name in ('quality.html',):
    p = REPO / name
    if p.is_file():
        PAGES.append((p, '../../tools/date-picker-lab/index.html'))

def apply(path: Path, href: str) -> bool:
    text = path.read_text(encoding='utf-8')
    if 'shell-header-lab' in text:
        return False  # already has it
    m = NAV_RE.search(text)
    if not m:
        return False  # chrome not present (page missing the standard nav)
    # Match the chrome.html indentation: <a> at 6 spaces, children at 8.
    indent = '      '
    insert = LAB_LINK_TEMPLATE.format(indent=indent, href=href)
    new = text[:m.end()] + insert + '\n' + text[m.end():]
    path.write_text(new, encoding='utf-8')
    return True

changed = 0
skipped = 0
for path, href in PAGES:
    try:
        if apply(path, href):
            print(f'  wrote   {path.relative_to(REPO)}')
            changed += 1
        else:
            skipped += 1
    except Exception as exc:
        print(f'  FAIL    {path.relative_to(REPO)}: {exc}')

print(f'\n_add_lab_link: {changed} updated, {skipped} no-change ({len(PAGES)} total)')
