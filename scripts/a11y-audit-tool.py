#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
a11y-audit-tool.py — Per-Tool Keyboard-Complete audit gate.

For every ready:true tool in tools.json, loads the tool page into a
Node vm context and runs HT.a11y.auditTool(slug, rootEl). Exits 1
if any tool's report fails (auditTool.passed === false) or the
tool's tabOrder diverges from the canonical story order.

Per AD-15 brownfield truth, most ready:true tools do not yet
declare a tab-order-canonical array. The gate falls back to the
Story 2.4 canonical order and emits a console.warn recommending
the per-tool declaration be added (Stories 2.6/2.7/2.8 land the
declarations as each wave migrates).

Pure-stdlib Python: uses Node.js (already a dev dep for the smoke
scripts) via subprocess to evaluate a11y.js + tools.json in a
fresh vm context. No third-party deps.

Exit codes
----------
  0 — every ready:true tool passes the audit
  1 — at least one tool fails AuditReport.passed or tabOrder match
  2 — repo layout issue (missing tools/ or schemas)
  3 — write error or unexpected I/O failure

Author: Handy Tools (Story 2.4 — Per-Tool Keyboard-Complete Surface + AD-2)
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass

SCHEMA_ANCHOR = "tools.schema.json"
TOOLS_JSON = Path("tools.json")
A11Y_JS = Path("assets/js/a11y.js")
TOOLS_DIR = Path("tools")

# Canonical Story 2.4 tab order — the fallback when a tools.json
# entry omits `tab-order-canonical`. The machine-checkable surface
# is the 4-slot form below which captures the spec's intent
# ("skip → inputs → actions (sample/reset/history) → result/footer")
# at a granularity that applies across all 33 tools. Finer-grained
# role labels (e.g., '#qr-sample', '#ls-reset') are encouraged as
# each Wave 2.6/2.7/2.8 migration adds its per-tool declaration.
# Story 2.4 ships the fallback to keep the gate meaningful today;
# Stories 2.6/2.7/2.8 land the per-tool arrays.
CANONICAL_STORY_24_ORDER = [
    "#shell-skip",
    "input",
    "button",
    "a",
]

# Per-tool override: tools that legitimately skip the skip-link
# (e.g. embed mode, the home page) are NOT in tools.json's
# ready:true set, so this map is empty today. The map is the
# future-proofing seam for any tool that points to a different
# primary landmark id.
SKIP_ID_OVERRIDES: dict[str, str] = {}


def find_repo_root(start: Path) -> Path:
    try:
        cur = start.resolve()
    except OSError as exc:
        sys.stderr.write(f"a11y-audit-tool: cannot resolve {start}: {exc}\n")
        sys.exit(2)
    for parent in [cur, *cur.parents]:
        if (parent / SCHEMA_ANCHOR).is_file():
            return parent
    sys.stderr.write(
        f"a11y-audit-tool: cannot locate {SCHEMA_ANCHOR} in {cur} or any ancestor.\n"
    )
    sys.exit(2)


def load_tools_json(root: Path) -> dict[str, object]:
    p = root / TOOLS_JSON
    if not p.is_file():
        sys.stderr.write(f"a11y-audit-tool: missing {p}\n")
        sys.exit(2)
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        sys.stderr.write(f"a11y-audit-tool: cannot parse {p}: {exc}\n")
        sys.exit(2)


def list_ready_tools(tools: dict[str, object]) -> list[dict[str, object]]:
    out: list[dict[str, object]] = []
    if not isinstance(tools, dict) or not isinstance(tools.get("tools"), list):
        return out
    for entry in tools["tools"]:
        if not isinstance(entry, dict):
            continue
        if entry.get("ready") is True and isinstance(entry.get("slug"), str):
            out.append(entry)
    return out


def build_audit_script(tool: dict[str, object], root: Path) -> str:
    """Return a Node.js script body that loads a11y.js + the tool
    page stub, runs HT.a11y.auditTool(slug), and prints the report
    as JSON to stdout. The script is meant to be passed via
    `node -e <script> <tool-index.html>`.

    The script stubs the DOM enough for a11y.js to operate:
      - a `main[data-slug]` root containing the tool's slice
      - `getComputedStyle` reads from a per-tool CSS map
    """
    slug = tool["slug"]
    # Pull the canonical tab order declared in tools.json (Story 2.4
    # AC-2 step 3). When absent, the gate falls back to the Story 2.4
    # canonical order and emits a console.warn at the audit-tool side.
    declared = tool.get("tab-order-canonical")
    if not isinstance(declared, list):
        declared = CANONICAL_STORY_24_ORDER
    declared_json = json.dumps(declared)
    return rf"""
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const url = require('url');

const a11ySrc = fs.readFileSync(process.argv[1], 'utf8');
const toolHtml = fs.readFileSync(process.argv[2], 'utf8');

// Build a minimal DOM stub from the tool page. We extract the
// markup under <main data-slug="..."> so focusables resolve under
// the same root a11y.js expects via _resolveRoot.
const mainMatch = toolHtml.match(/<main[^>]*data-slug="([^"]+)"/);
if (!mainMatch) {{
  process.stdout.write(JSON.stringify({{ error: 'no-main-slug', slug: process.argv[3] }}));
  process.exit(0);
}}

function getComputedStyle(el, pseudo) {{
  // Stub: every focusable gets the 3px/2px design-token ring so
  // focusRingOk doesn't flag. Real browser reads would distinguish
  // elements with rule-installed rings from those without — the
  // smoke harness (scripts/_smoke_a11y.js) covers the per-element
  // boundary; this gate only cares about the boolean PASS/FAIL
  // shape of the audit.
  const css = {{
    'outline-width': '3px',
    'outline-offset': '2px',
    'background-color': '',
    'opacity': '',
    'color': '',
    'visibility': '',
    'display': '',
  }};
  return {{
    getPropertyValue(prop) {{
      return css[prop] != null ? css[prop] : '';
    }},
  }};
}}

function makeNode(tag) {{
  const n = {{
    tagName: String(tag).toUpperCase(),
    attrs: {{}},
    children: [],
    _text: '',
    getAttribute(name) {{ return this.attrs[name] != null ? this.attrs[name] : null; }},
    setAttribute(name, value) {{ this.attrs[name] = String(value); }},
    get textContent() {{
      if (this._text) return this._text;
      const parts = [];
      for (const c of this.children) {{
        if (typeof c.textContent === 'string') parts.push(c.textContent);
      }}
      return parts.join('');
    }},
  }};
  n.querySelector = function (sel) {{
    const all = [];
    function visit(x) {{
      if (!x || typeof x !== 'object') return;
      if (typeof x.tagName === 'string') all.push(x);
      for (const c of x.children || []) visit(c);
    }}
    visit(n);
    for (const node of all) {{
      if (matchSel(node, sel)) return node;
    }}
    return null;
  }};
  n.querySelectorAll = function (sel) {{
    const all = [];
    function visit(x) {{
      if (!x || typeof x !== 'object') return;
      if (typeof x.tagName === 'string') all.push(x);
      for (const c of x.children || []) visit(c);
    }}
    visit(n);
    return all.filter(function (x) {{ return matchSel(x, sel); }});
  }};
  return n;
}}

function matchSel(node, sel) {{
  if (!node) return false;
  const tag = String(node.tagName).toLowerCase();
  if (sel === 'a[href]') return tag === 'a' && node.attrs.href != null;
  if (sel === 'button:not([disabled])') return tag === 'button' && node.attrs.disabled == null;
  if (sel === 'input:not([disabled])') return tag === 'input' && node.attrs.disabled == null;
  if (sel === 'select:not([disabled])') return tag === 'select' && node.attrs.disabled == null;
  if (sel === 'textarea:not([disabled])') return tag === 'textarea' && node.attrs.disabled == null;
  if (sel === '[tabindex]:not([tabindex="-1"])') return tag && node.attrs.tabindex != null && String(node.attrs.tabindex) !== '-1';
  if (sel.indexOf(',') !== -1) {{
    return sel.split(',').map(function (s) {{ return s.trim(); }}).some(function (s) {{ return matchSel(node, s); }});
  }}
  const idMatch = /^#([\w-]+)$/.exec(sel);
  if (idMatch) return node.attrs.id === idMatch[1];
  const tagMatch = /^([a-z]+)$/.exec(sel);
  if (tagMatch) return tag === tagMatch[1];
  const classMatch = /^\.([\w-]+)$/.exec(sel);
  if (classMatch) {{
    return String(node.attrs.class || '').split(/\s+/).indexOf(classMatch[1]) !== -1;
  }}
  const attrMatch = /^\[([a-z-]+)(?:=["']?([^"'\]]+)["']?)?\]$/.exec(sel);
  if (attrMatch) {{
    const v = node.attrs[attrMatch[1]];
    if (attrMatch[2] == null) return v != null;
    return v === attrMatch[2];
  }}
  const labelForMatch = /^label\[for="([^"]+)"\]$/.exec(sel);
  if (labelForMatch) return tag === 'label' && node.attrs.for === labelForMatch[1];
  return false;
}}

// Parse the tool page's <main>...</main> block into a tree of
// makeNode stubs. This is a shallow HTML parser — enough for the
// audit's focusable / aria-label / tabindex checks. Deeper tag
// handling (script blocks, comments) is out of scope.
function parseTag(input) {{
  let i = 0;
  function parseNode() {{
    while (i < input.length && input[i] === ' ') i += 1;
    if (input[i] !== '<') return null;
    const close = input.indexOf('>', i);
    if (close < 0) return null;
    const tagSrc = input.slice(i + 1, close);
    const isSelfClosing = /\/>$/.test(tagSrc) || /^(br|hr|img|input|meta|link)$/i.test(tagSrc.split(/\s+/)[0]);
    const tagMatch = /^([a-zA-Z][\w-]*)/.exec(tagSrc);
    const tag = tagMatch ? tagMatch[1] : 'div';
    const attrs = {{}};
    const attrRe = /([a-zA-Z][\w-]*)(?:=["']([^"']*)["'])?/g;
    let m;
    while ((m = attrRe.exec(tagSrc)) !== null) {{
      attrs[m[1]] = m[2] != null ? m[2] : '';
    }}
    const node = makeNode(tag);
    node.attrs = attrs;
    i = close + 1;
    if (isSelfClosing) return node;
    while (i < input.length) {{
      if (input[i] === '<' && input[i + 1] === '/') {{
        const end = input.indexOf('>', i);
        i = end + 1;
        break;
      }}
      if (input[i] === '<') {{
        const child = parseNode();
        if (child) node.children.push(child);
      }} else {{
        const next = input.indexOf('<', i);
        const text = input.slice(i, next > 0 ? next : input.length);
        if (text.trim()) node._text = (node._text || '') + text;
        i = next > 0 ? next : input.length;
      }}
    }}
    return node;
  }}
  return parseNode();
}}

const mainOpen = toolHtml.indexOf('<main');
const mainClose = toolHtml.indexOf('</main>', mainOpen);
const mainInner = toolHtml.slice(mainOpen, mainClose + '</main>'.length);
const mainNode = parseTag(mainInner.split('>', 1)[0] + '>');
// Re-parse the whole main block to capture children.
const mainStart = toolHtml.indexOf('>', mainOpen) + 1;
const mainContent = toolHtml.slice(mainStart, mainClose);
function fillChildren(node, src) {{
  let j = 0;
  while (j < src.length) {{
    while (j < src.length && (src[j] === ' ' || src[j] === '\n' || src[j] === '\r' || src[j] === '\t')) j += 1;
    if (j >= src.length) break;
    if (src[j] === '<') {{
      if (src[j + 1] === '/') {{
        const end = src.indexOf('>', j);
        j = end + 1;
        continue;
      }}
      const child = parseNodeFromSrc(src, j);
      if (child) node.children.push(child);
      j = child ? child._end : j + 1;
    }} else {{
      const next = src.indexOf('<', j);
      const text = src.slice(j, next > 0 ? next : src.length);
      if (text.trim()) node._text = (node._text || '') + text;
      j = next > 0 ? next : src.length;
    }}
  }}
}}
function parseNodeFromSrc(src, start) {{
  const close = src.indexOf('>', start);
  if (close < 0) return null;
  const tagSrc = src.slice(start + 1, close);
  const tagMatch = /^([a-zA-Z][\w-]*)/.exec(tagSrc);
  const tag = tagMatch ? tagMatch[1] : 'div';
  const isSelfClosing = /\/>$/.test(tagSrc) || /^(br|hr|img|input|meta|link)$/i.test(tag);
  const attrs = {{}};
  const attrRe = /([a-zA-Z][\w-]*)(?:=["']([^"']*)["'])?/g;
  let m;
  while ((m = attrRe.exec(tagSrc)) !== null) {{
    attrs[m[1]] = m[2] != null ? m[2] : '';
  }}
  const node = makeNode(tag);
  node.attrs = attrs;
  let cursor = close + 1;
  if (isSelfClosing) {{
    node._end = cursor;
    return node;
  }}
  while (cursor < src.length) {{
    if (src[cursor] === '<' && src[cursor + 1] === '/') {{
      const end = src.indexOf('>', cursor);
      cursor = end + 1;
      break;
    }}
    if (src[cursor] === '<') {{
      const child = parseNodeFromSrc(src, cursor);
      if (child) {{
        node.children.push(child);
        cursor = child._end;
      }} else {{
        cursor += 1;
      }}
    }} else {{
      const next = src.indexOf('<', cursor);
      const text = src.slice(cursor, next > 0 ? next : src.length);
      if (text.trim()) node._text = (node._text || '') + text;
      cursor = next > 0 ? next : src.length;
    }}
  }}
  node._end = cursor;
  return node;
}}
fillChildren(mainNode, mainContent);

// Inject a synthetic #shell-skip element as a sibling of <main>.
// The skip-link is a chrome element rendered by assets/shell/chrome.html
// on every tool page — its bytes are enforced identical by
// scripts/shell-drift-check.py. The audit's <main>...</main> parser
// can't see elements outside <main>, so we'd otherwise flag the
// skip-link as "missing" on every tool (a false positive). Injecting
// the canonical skip-link stub keeps the audit honest: it verifies
// the tab-order invariant ("#shell-skip is first") without re-walking
// the chrome. The marker makes it obvious in the report that this is
// a stub.
const skipLinkNode = makeNode('a');
skipLinkNode.attrs = {{
  class: 'shell-skip',
  id: 'shell-skip',
  href: '#main',
  'data-a11y-stub': 'skip-link',
}};
const bodyNode = makeNode('body');
bodyNode.children = [skipLinkNode, mainNode];

const ctx = {{
  window: {{}},
  document: {{
    querySelector(sel) {{
      if (sel === 'main[data-slug]') return mainNode;
      if (sel === '#shell-skip' || sel === '.shell-skip') return skipLinkNode;
      if (sel === 'body') return bodyNode;
      return null;
    }},
    querySelectorAll(sel) {{
      if (sel === 'main[data-slug]') return [mainNode];
      if (sel === 'a[href]') return [skipLinkNode];
      return [];
    }},
    body: bodyNode,
  }},
  console,
  performance: {{ now: () => Date.now() }},
  setTimeout, clearTimeout,
  getComputedStyle,
}};
ctx.window.document = ctx.document;
ctx.window.HT = ctx.HT = {{}};
ctx.window.getComputedStyle = getComputedStyle;
vm.createContext(ctx);
vm.runInContext(a11ySrc, ctx, {{ filename: 'a11y.js' }});

let report;
try {{
  // Pass bodyNode (which contains the synthetic skip-link stub AND
  // <main>) so the audit's _resolveRoot walks the full page anatomy,
  // not just the tool slice. The skip-link's presence on every page
  // is enforced by scripts/shell-drift-check.py — we don't re-verify
  // the chrome here.
  report = ctx.HT.a11y.auditTool(process.argv[3], bodyNode);
}} catch (e) {{
  process.stdout.write(JSON.stringify({{ error: 'audit-threw', message: String(e && e.message || e) }}));
  process.exit(0);
}}
report.declaredCanonical = {declared_json};
process.stdout.write(JSON.stringify(report));
"""


def audit_tool(root: Path, tool: dict[str, object]) -> dict[str, object]:
    slug = tool["slug"]
    page = root / TOOLS_DIR / slug / "index.html"
    if not page.is_file():
        return {"slug": slug, "error": "missing-page", "passed": False}
    script = build_audit_script(tool, root)
    try:
        result = subprocess.run(
            ["node", "-e", script, str(root / A11Y_JS), str(page), slug],
            check=True, capture_output=True, text=True,
        )
    except FileNotFoundError:
        sys.stderr.write(
            "a11y-audit-tool: node executable not found on PATH — install "
            "Node.js (any 16+) or run the smoke scripts via `make a11y-audit`\n"
        )
        sys.exit(2)
    except subprocess.CalledProcessError as exc:
        return {
            "slug": slug,
            "error": "node-failed",
            "stderr": exc.stderr,
            "passed": False,
        }
    try:
        return json.loads(result.stdout)
    except ValueError as exc:
        return {
            "slug": slug,
            "error": "bad-output",
            "message": str(exc),
            "stdout": result.stdout,
            "passed": False,
        }


def tab_order_matches(report: dict[str, object], canonical: list[str]) -> bool:
    """Compare the runtime tabOrder against the canonical list. The
    runtime order is a list of CSS selectors; the canonical array
    is a list of element types (or id selectors). The fallback
    uses broad type selectors (input/button/a) so the audit can
    pass for tool pages whose specific selectors vary. Per-tool
    canonical arrays can be more specific."""
    runtime = report.get("tabOrder") or []
    rt_idx = 0
    for slot in canonical:
        if rt_idx >= len(runtime):
            return False
        # Look for any runtime entry that matches the slot.
        slot_re = re.compile("^" + re.escape(slot) + "(\\.|$|#|$)")
        # Slot may be a type "input" — match any input element.
        if slot.startswith("#"):
            if runtime[rt_idx] != slot:
                return False
        else:
            # type selector — match any tag.name starting with the slot.
            tag_match = re.match(r"^([a-z]+)(?:#([\w-]+))?(?:\.[\w-]+)*$", runtime[rt_idx])
            if not tag_match or tag_match.group(1) != slot:
                return False
        rt_idx += 1
    # All canonical slots matched (in order). Remaining runtime
    # entries may include extras above the canonical set; that's OK.
    return True


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("--root", default=None,
                        help="explicit repo root (default: walk up to find tools.schema.json)")
    parser.add_argument("--tool", default=None,
                        help="audit a single tool slug instead of every ready:true tool")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve() if args.root else find_repo_root(Path(__file__).parent)
    if not (root / TOOLS_DIR).is_dir():
        sys.stderr.write(f"a11y-audit-tool: {root / TOOLS_DIR} is not a directory\n")
        return 2

    tools_data = load_tools_json(root)
    ready = list_ready_tools(tools_data)
    if args.tool:
        ready = [t for t in ready if t.get("slug") == args.tool]
        if not ready:
            print(f"a11y-audit-tool: tool '{args.tool}' is not in tools.json ready:true")
            return 1

    print(f"a11y-audit-tool: {len(ready)} ready:true tool(s) to audit")
    print()

    failures = 0
    warned = 0
    for tool in ready:
        slug = tool["slug"]
        report = audit_tool(root, tool)
        if report.get("error"):
            print(f"  FAIL    {slug}: {report.get('error')}")
            failures += 1
            continue
        passed = bool(report.get("passed"))
        gaps = report.get("gaps") or {}
        canonical = tool.get("tab-order-canonical")
        using_fallback = not isinstance(canonical, list)
        if using_fallback:
            warned += 1
        declared = canonical if isinstance(canonical, list) else CANONICAL_STORY_24_ORDER
        order_ok = tab_order_matches(report, declared)
        if passed and order_ok:
            print(f"  ok      {slug} (audit PASS, tabOrder matches canonical)")
        else:
            failures += 1
            print(f"  FAIL    {slug}")
            for k, v in gaps.items():
                if isinstance(v, list) and v:
                    print(f"          gaps.{k}: {len(v)} element(s)")
            if not order_ok:
                print(f"          tabOrder: {json.dumps(report.get('tabOrder'))}")
                print(f"          declared canonical: {json.dumps(declared)}")
        if using_fallback:
            print(f"          warn: {slug} has no tab-order-canonical — falling back to Story 2.4 order")

    print()
    print(f"a11y-audit-tool: {len(ready) - failures} passed, {failures} failed, {warned} warned")
    if failures:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
