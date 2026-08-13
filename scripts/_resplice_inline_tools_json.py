# scripts/_resplice_inline_tools_json.py — One-shot helper that re-splices
# the inline <script id="ht-tools-json-inline" type="application/json">
# block from the root tools.json into all 41 tool pages + index.html.
#
# shell-template.py has a markers-only splice bug: it does not detect
# changes inside the inline JSON block, so adding a tools.json entry
# leaves every page's inline copy stale. This helper reads tools.json,
# re-emits it as compact JSON, and replaces the inline block atomically
# across all affected pages.
#
# Story 9.8: Exam Countdown addition introduced this block; this script
# is the documented workaround.

import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

with open('tools.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
tools = data['tools']
new_inline = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
start_marker = '<script type="application/json" id="ht-tools-json-inline">'
end_marker = '</script>'
spliced = 0
files = ['index.html'] + [os.path.join('tools', d['slug'], 'index.html') for d in tools]
for path in files:
    if not os.path.exists(path):
        print('MISS', path)
        continue
    with open(path, 'r', encoding='utf-8') as f:
        src = f.read()
    s = src.find(start_marker)
    if s < 0:
        print('NO_INLINE', path)
        continue
    s2 = src.find(end_marker, s)
    if s2 < 0:
        print('NO_END', path)
        continue
    new_src = src[:s + len(start_marker)] + new_inline + src[s2:]
    if new_src != src:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_src)
        spliced += 1
print('spliced=', spliced)
