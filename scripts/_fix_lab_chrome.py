"""Fix the lab page's chrome regions to match canonical palette/settings/help
verbatim. The drift check (`scripts/shell-drift-check.py`) verifies the
inner-region bytes are byte-substring of every page; the lab page was
hand-written with abbreviated comment blocks, so the regions don't match.

Run: `python scripts/_fix_lab_chrome.py`
Idempotent.
"""
from pathlib import Path
import re

REPO = Path(__file__).resolve().parent.parent
LAB  = REPO / 'tools' / 'date-picker-lab' / 'index.html'

def inner(path: Path, marker: str) -> str:
    text = path.read_text(encoding='utf-8')
    m = re.search(rf'<!-- {marker} -->\s*(.*?)\s*<!-- /{marker} -->', text, re.DOTALL)
    if not m:
        raise SystemExit(f'no {marker} region in {path}')
    return m.group(1)

def wrap(marker: str, body: str) -> str:
    return f'<!-- {marker} -->\n{body}\n<!-- /{marker} -->'

PALETTE_BODY = inner(REPO / 'assets' / 'shell' / 'palette.html', 'shell:palette')
SETTINGS_BODY = inner(REPO / 'assets' / 'shell' / 'settings.html', 'shell:settings')
HELP_BODY = inner(REPO / 'assets' / 'shell' / 'help.html', 'shell:help')

# Replace each region's inner content in the lab page.
text = LAB.read_text(encoding='utf-8')
for marker, body in (
    ('shell:palette', PALETTE_BODY),
    ('shell:settings', SETTINGS_BODY),
    ('shell:help',     HELP_BODY),
):
    pattern = rf'(<!-- {marker} -->\s*).*?(\s*<!-- /{marker} -->)'
    new = re.sub(pattern, lambda m: m.group(1) + body + m.group(2), text, flags=re.DOTALL)
    if new == text:
        print(f'  WARN: no replacement for {marker}')
    text = new

LAB.write_text(text, encoding='utf-8')
print('_fix_lab_chrome: ok')
