#!/usr/bin/env python3
"""Replace the inline tools.json block in index.html with the canonical
(serialized) reconstruction produced by `read_tools_json_inline`. This
is the equivalent of running `shell-template.py --home` but bypasses
shell-template's chrome-rewrite path (which short-circuits when other
chrome markers are out of sync).

Idempotent — running twice on an already-canonical block is a no-op.
"""
import re
from pathlib import Path
import json
import importlib.util

ROOT = Path("C:/ZDrive Folders/Projects/useful-tools")

# Import read_tools_json_inline from shell-template
spec = importlib.util.spec_from_file_location("st", str(ROOT / "scripts/shell-template.py"))
st = importlib.util.module_from_spec(spec)
sys_modules_backup = dict(__import__("sys").modules)
try:
    spec.loader.exec_module(st)
except SystemExit:
    pass
canonical = st.read_tools_json_inline(ROOT)

# Now read index.html
index_html = ROOT / "index.html"
src = index_html.read_text(encoding="utf-8")

# Replace the inline block between markers
START = "<!-- ht:tools-json-inline-start -->"
END = "<!-- ht:tools-json-inline-end -->"
# The block lives between two start markers (one per tool page) — match
# the canonical preamble exactly:
pattern = re.compile(
    re.escape(START) + r".*?" + re.escape(END),
    re.DOTALL,
)
m = pattern.search(src)
if not m:
    print("no inline block found — aborting")
    raise SystemExit(2)

old_block = m.group(0)
print("current block length:", len(old_block))
print("canonical block length:", len(canonical))
print("current == canonical:", old_block == canonical)

if old_block == canonical:
    print("already canonical — no change")
    raise SystemExit(0)

new_src = src[: m.start()] + canonical + src[m.end():]
index_html.write_text(new_src, encoding="utf-8")
print("rewrote index.html inline block")
print("delta bytes:", len(canonical) - len(old_block))
