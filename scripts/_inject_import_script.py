#!/usr/bin/env python3
"""
One-shot helper for Story 3.8 — adds <script src=".../assets/js/import.js"></script>
right after the export.js script tag on every shell page.

Idempotent: re-running on an already-tagged page is a no-op (the
import.js tag is detected and skipped).

Usage: python scripts/_inject_import_script.py
"""
import os, re, sys

HOME_TAG = '<script src="assets/js/export.js"></script>\n  <script src="assets/js/import.js"></script>'
TOOL_TAG = '<script src="../../assets/js/export.js"></script>\n  <script src="../../assets/js/import.js"></script>'

HOME_EXISTING = '<script src="assets/js/import.js"></script>'
TOOL_EXISTING = '<script src="../../assets/js/import.js"></script>'

def main():
    pages = []
    for root, dirs, files in os.walk('.'):
        if any(skip in root for skip in ('.git', '__pycache__', '.review', 'node_modules', '_bmad-output')):
            continue
        for f in files:
            if f == 'index.html':
                rel = os.path.join(root, f).replace('./', '').replace('\\', '/')
                pages.append(rel)

    added = 0
    skipped = 0
    failed = 0
    for page in sorted(pages):
        try:
            with open(page, 'r', encoding='utf-8') as fh:
                text = fh.read()
        except (OSError, UnicodeDecodeError) as e:
            print(f'  SKIP  {page}: {e}')
            skipped += 1
            continue
        if HOME_EXISTING in text or TOOL_EXISTING in text:
            skipped += 1
            continue
        # Home/packs/quality: assets/js/...
        new_text = text.replace(
            '<script src="assets/js/export.js"></script>',
            HOME_TAG, 1
        )
        if new_text != text:
            with open(page, 'w', encoding='utf-8') as fh:
                fh.write(new_text)
            added += 1
            continue
        # Tool pages: ../../assets/js/...
        new_text = text.replace(
            '<script src="../../assets/js/export.js"></script>',
            TOOL_TAG, 1
        )
        if new_text != text:
            with open(page, 'w', encoding='utf-8') as fh:
                fh.write(new_text)
            added += 1
            continue
        # No export.js tag → non-shell page (e.g., privacy/quality might lack it)
        skipped += 1
    print(f'inject: {added} added, {skipped} skipped, {failed} failed ({len(pages)} total)')

if __name__ == '__main__':
    main()