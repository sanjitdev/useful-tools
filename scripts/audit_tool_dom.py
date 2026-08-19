#!/usr/bin/env python3
"""
audit_tool_dom.py — Focused audit: find tools whose index.html body has
unrelated DOM (e.g., a tool page that contains area-volume shape tabs).
"""
import re, sys
from pathlib import Path

TOOLS = Path('tools')

# Patterns that should NOT appear in non-area-volume tool pages
AV_PATTERNS = [
    r'data-av-shape=',          # area-volume shape radio
    r'av-shape-tabs',           # area-volume tab container
    r'id="av-result"',          # area-volume result
    r'data-av-key=',            # area-volume input key
    r'data-av-unit=',           # area-volume unit radio
]

def check(slug):
    path = TOOLS / slug / 'index.html'
    if not path.exists():
        return None
    text = path.read_text(encoding='utf-8', errors='ignore')
    # Restrict to body (after </header> before </main>)
    body_match = re.search(r'<main[^>]*>(.*)</main>', text, re.DOTALL)
    body = body_match.group(1) if body_match else text
    hits = []
    for pat in AV_PATTERNS:
        if re.search(pat, body):
            hits.append(pat)
    return hits

def main():
    print(f"Auditing tool bodies for area-volume DOM contamination:\n")
    bad = []
    for d in sorted(TOOLS.iterdir()):
        if not d.is_dir():
            continue
        hits = check(d.name)
        if hits:
            bad.append((d.name, hits))
    if not bad:
        print("OK — no tools contain area-volume DOM in their body.")
        return 0
    print(f"FOUND {len(bad)} contaminated tool(s):\n")
    for slug, hits in bad:
        print(f"  {slug}:")
        for h in hits:
            print(f"    - {h}")
        print()
    return 1

if __name__ == '__main__':
    sys.exit(main())