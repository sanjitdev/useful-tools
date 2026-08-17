r"""Surgical fix for pack page lab link formatting.

The earlier iteration of `_add_lab_link.py` (and a one-off Python
snippet that patched pack href mismatches) wrote the SVG immediately
after the opening `<a class="shell-header-lab">` tag with no newline
between them, producing inline markup like:

    <a class="shell-header-lab" ...><svg ...></svg><span>Lab</span></a>

The drift check (`scripts/shell-drift-check.py`) walks the DOM via
Python's `html.parser`, collapses each element's first text child
through `re.sub(r"\s+", " ", s)`, and expects a single `" "` (one
space) as the first text child of `<a>` — matching the canonical
`assets/shell/chrome.html`, which has the SVG on its own indented
line. The inline form has no whitespace between `<a ...>` and `<svg>`,
so its first text child is `""`, not `" "`, and the drift check
reports `text_mismatch` for every pack page.

This script rewrites the inline form on every `packs/*.html` to the
canonical multi-line form (children at 8-space indent, matching
chrome.html's indentation under `<nav>`). It only touches `<a
class="shell-header-lab">…</a>` blocks; everything else is preserved.

Idempotent: skips files where the link is already in canonical form.

Run: `python scripts/_fix_pack_lab_link.py`
"""
import re
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PACKS = REPO / 'packs'

# Match the inline malformed block. The SVG body includes <path>
# children so use a permissive matcher.
INLINE_RE = re.compile(
    r'<a class="shell-header-lab" href="\.\./\.\./tools/date-picker-lab/index\.html" aria-label="Date Picker Lab"><svg.*?</svg><span>Lab</span></a>',
    re.DOTALL,
)

# Canonical replacement (matches assets/shell/chrome.html byte-for-byte
# for the lab link block — verify via `python scripts/shell-drift-check.py`).
CANONICAL_TEMPLATE = (
    '<a class="shell-header-lab" href="../../tools/date-picker-lab/index.html" aria-label="Date Picker Lab">\n'
    '        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 2v6L4 17a2 2 0 0 0 1.7 3h12.6A2 2 0 0 0 20 17l-5-9V2"/><path d="M7 2h10"/><path d="M8 14h8"/></svg>\n'
    '        <span>Lab</span>\n'
    '      </a>'
)

def fix(path: Path) -> bool:
    text = path.read_text(encoding='utf-8')
    if not INLINE_RE.search(text):
        return False  # already canonical (or lab link absent)
    new_text = INLINE_RE.sub(CANONICAL_TEMPLATE, text)
    if new_text == text:
        return False
    path.write_text(new_text, encoding='utf-8')
    return True

fixed = 0
for p in sorted(PACKS.glob('*.html')):
    if fix(p):
        print(f'  fixed   {p.relative_to(REPO)}')
        fixed += 1

print(f'\n_fix_pack_lab_link: {fixed} fixed')
