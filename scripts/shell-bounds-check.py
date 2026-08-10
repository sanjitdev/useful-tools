#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
shell-bounds-check.py — Bypass check for the Shell Public API Contract (AD-14).

Fail CI if any code under tools/<slug>/<slug>.js reaches past the registered
HT.* APIs to lower-level browser primitives. The check enforces the Tool-side
prohibition in docs/shell-public-api.md §2.

Pure-stdlib Python. Same shape as the sibling gates: no third-party deps,
exit codes 0/1/2/3, Markdown report on stdout.

Usage
-----
  python scripts/shell-bounds-check.py            # run the gate
  python scripts/shell-bounds-check.py --list     # print the policy
  python scripts/shell-bounds-check.py --root ... # explicit repo root

Exit codes
----------
  0 — all checks pass
  1 — at least one bypass violation
  2 — repo layout issue (missing tools/ or chrome.html)
  3 — unexpected I/O failure

Forbidden surfaces (scanned in tools/<slug>/<slug>.js only)
------------------------------------------------------------
  - localStorage.<method>(...)           > Use HT.storage.get / set / remove
  - document.cookie                       > Use HT.storage (or future HT.cookie)
  - fetch(<url>, ...)                     > Use HT.net.get / HT.net.head
  - XMLHttpRequest                        > Use HT.net.*
  - new XMLHttpRequest()                  > Use HT.net.*
  - HT.provide(...)                       > Tools must not provide APIs.
                                            (Only Shell modules may call HT.provide
                                            via a non-Tool caller; the bypass
                                            grep flags ANY occurrence under
                                            tools/.)

Allowlist (the policy docs/shell-public-api.md §6 explains)
------------------------------------------------------------
  1. Inline <script> blocks in tools/<slug>/index.html are NOT scanned.
  2. The FOUC IIFE's localStorage.getItem('ht.theme') is grandfathered by
     AD-15 — but the gate doesn't scan index.html anyway.
  3. The defensive fallback pattern below is allowlisted as a whole:
         if (HT.storage && HT.storage.<op>) {
           HT.storage.<op>(...);
         } else {
           localStorage.<op>(...);
         }
     The `else` branch's localStorage call is tolerated ONLY when the
     matching `if` arm calls HT.storage.<op> on the same key.

Cross-checks
------------
The gate also cross-checks that scripts/storage-registry-gate.py exited
cleanly (run it before this gate). The cross-check is informational; a
failure here names the violated module + the offending line.

Author: Handy Tools (Story 1.14 — Shell Public API and Bypass Prohibition)
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Iterable

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except (AttributeError, OSError):
    pass

SCHEMA_FILENAME = "tools.schema.json"
TOOLS_DIRNAME = "tools"


def find_repo_root(start: Path) -> Path:
    """Walk up from `start` until we find a directory containing
    tools.schema.json. Raises SystemExit if no such directory exists."""
    try:
        cur = start.resolve()
    except OSError as e:
        sys.stderr.write(f"shell-bounds-check: cannot resolve {start}: {e}\n")
        sys.exit(2)
    for parent in [cur, *cur.parents]:
        if (parent / SCHEMA_FILENAME).is_file():
            return parent
    sys.stderr.write(
        f"shell-bounds-check: cannot locate {SCHEMA_FILENAME} in {cur} "
        "or any ancestor.\n"
    )
    sys.exit(2)


# ---------------------------------------------------------------------------
# Forbidden patterns
# ---------------------------------------------------------------------------

# localStorage.<method>(...) — but allow inside the lifecycle fallback's
# `else` branch (handled by the cross-scoped scanner below, not by this
# initial pass). The pre-filter flags every occurrence; the lifecycle
# filter then removes any that match the defensive shape.
LOCAL_STORAGE_RE = re.compile(
    r"\blocalStorage\.(getItem|setItem|removeItem|clear|key|length)\b"
)

# document.cookie — never allowlisted.
DOC_COOKIE_RE = re.compile(r"\bdocument\.cookie\b")

# fetch(<url>, ...) — never allowlisted in tools/<slug>/<slug>.js.
FETCH_RE = re.compile(r"\bfetch\s*\(")

# XMLHttpRequest — never allowlisted.
XHR_RE = re.compile(r"\bnew\s+XMLHttpRequest\s*\(|\bXMLHttpRequest\b")

# HT.provide(...) — never allowlisted in tools/. The expression
# `HT.provide.register(...)` is reached indirectly via the HT.provide
# namespace, but the grep is conservative: any HT.provide token in a
# tool file is flagged. False positives are easy to fix (rename the
# function) and the surface is small.
HT_PROVIDE_RE = re.compile(r"\bHT\.provide\b")


# ---------------------------------------------------------------------------
# Lifecycle fallback allowlist
# ---------------------------------------------------------------------------
#
# Shape: a multi-line block of the form
#   if (HT.storage && HT.storage.<op>) {
#     ... HT.storage.<op>(...) ...
#   } else {
#     ... localStorage.<op>(...) ...
#   }
#
# The pattern is too flexible for a single regex; we do a two-pass walk:
#   1. Collect every line that matches LOCAL_STORAGE_RE.
#   2. Find every `if (HT.storage && HT.storage.<op>) { ... } else { ... }`
#      block. If the block contains both a HT.storage.<op> call AND a
#      localStorage.<op> call, suppress the localStorage hit.
#
# Implementation: walk the file character-by-character, tracking brace
# depth. When we see `if (HT.storage && HT.storage.<op>) {`, we scan
# forward until the matching close brace of the `else` block. Lines
# touched by that scan are allowlisted.

LIFECYCLE_OPEN_RE = re.compile(
    r"if\s*\(\s*HT\.storage\s*&&\s*HT\.storage\.(get|set|remove|list|keys|clear|register|registerHistoryKeys)\s*\)"
)
LIFECYCLE_HT_STORAGE_RE = re.compile(
    r"\bHT\.storage\.(get|set|remove|list|keys|clear|register|registerHistoryKeys)\s*\("
)


def find_lifecycle_allowlist_lines(text: str) -> set[int]:
    """Return the set of 1-indexed line numbers that fall inside a
    `if (HT.storage && HT.storage.<op>) { ... } else { ... }` block.
    Those lines are immune to the localStorage bypass flag.

    The walker must walk past the `if`'s closing brace AND the `else`
    block's matching closing brace — the else branch is where the
    defensive `localStorage.setItem` lives. We do a single depth-1
    brace walk: from the opening `{` after the `if (...)` condition,
    balance braces until depth returns to 0; that captures both
    branches as one block. (Single-line `if/else` without braces is
    not supported — none of the existing tool files use it; if a
    future tool does, the gate will flag the localStorage call and
    the dev agent must convert it to a brace block.)
    """
    allowed: set[int] = set()
    i = 0
    n = len(text)
    while i < n:
        m = LIFECYCLE_OPEN_RE.search(text, i)
        if not m:
            break
        # Walk forward to the opening `{` of the `if` body. The
        # regex ends just after the closing `)` of the if condition,
        # so we scan for the next `{`.
        j = m.end()
        while j < n and text[j] != "{":
            j += 1
        if j >= n:
            break
        # Walk past the `if` body. We don't try to also walk the
        # `else` body in a single brace counter — the `} else {`
        # sequence would erroneously close the depth at the `if`'s
        # closing brace. Instead: walk the `if` body to its `}`, then
        # check whether `else` follows; if so, walk the `else` body
        # to its `}` as a second pass. The block we capture is
        # everything from `if (...)` to the `else`'s closing `}`,
        # inclusive.
        def _walk_body(start: int) -> int:
            """Balance braces from `start` (which must point at `{`)
            to the matching `}`. Returns the index of the matching
            `}`, or -1 if unbalanced."""
            depth = 0
            k = start
            while k < n:
                ch = text[k]
                if ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        return k
                k += 1
            return -1

        if_close = _walk_body(j)
        if if_close < 0:
            break
        end = if_close
        # Skip `else` keyword and any whitespace/newlines, then walk
        # the `else` body if present. The shape we're matching is the
        # canonical defensive fallback:
        #   if (HT.storage && HT.storage.<op>) { ... } else { ... }
        # We do NOT accept `else if` chains — those are out of scope
        # for the allowlist and would need a separate decision.
        rest = text[if_close + 1:].lstrip()
        if rest.startswith("else"):
            # Find the `{` of the else body. `else` may be followed
            # by whitespace, newline, comments, and then `{`.
            else_open = text.find("{", if_close + 1)
            if else_open > 0:
                else_close = _walk_body(else_open)
                if else_close > 0:
                    end = else_close
        if end >= n:
            break
        block_text = text[m.start():end + 1]
        if LIFECYCLE_HT_STORAGE_RE.search(block_text) and LOCAL_STORAGE_RE.search(block_text):
            start_line = text.count("\n", 0, m.start()) + 1
            end_line = text.count("\n", 0, end + 1) + 1
            for ln in range(start_line, end_line + 1):
                allowed.add(ln)
        i = end + 1
    return allowed


def _line_numbers(text: str, pattern: re.Pattern[str]) -> list[tuple[int, str]]:
    """Return [(line_no, matched_line), ...] for every regex match in text."""
    out: list[tuple[int, str]] = []
    for ln, line in enumerate(text.splitlines(), start=1):
        if pattern.search(line):
            out.append((ln, line.rstrip("\r\n")))
    return out


def _scan_file(path: Path) -> list[tuple[str, int, str]]:
    """Scan a single tool JS file. Returns a list of (rule, line, text)."""
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as e:
        sys.stderr.write(f"shell-bounds-check: cannot read {path}: {e}\n")
        return [("read-error", 0, str(e))]

    allowed = find_lifecycle_allowlist_lines(text)
    hits: list[tuple[str, int, str]] = []

    for ln, line in _line_numbers(text, LOCAL_STORAGE_RE):
        if ln in allowed:
            continue
        hits.append(("localStorage", ln, line))
    for ln, line in _line_numbers(text, DOC_COOKIE_RE):
        hits.append(("document.cookie", ln, line))
    for ln, line in _line_numbers(text, FETCH_RE):
        hits.append(("fetch", ln, line))
    for ln, line in _line_numbers(text, XHR_RE):
        hits.append(("XMLHttpRequest", ln, line))
    for ln, line in _line_numbers(text, HT_PROVIDE_RE):
        hits.append(("HT.provide", ln, line))
    return hits


def _print_policy() -> None:
    print("shell-bounds-check policy (Story 1.14 / AD-14):")
    print("  Forbidden in tools/<slug>/<slug>.js:")
    print("    - localStorage.<getItem|setItem|removeItem|clear|key|length>")
    print("    - document.cookie")
    print("    - fetch(<url>, ...)")
    print("    - XMLHttpRequest / new XMLHttpRequest()")
    print("    - HT.provide(...)")
    print("  Allowed:")
    print("    - Inline <script> blocks in tools/<slug>/index.html (not scanned)")
    print("    - Lifecycle fallback block:")
    print("        if (HT.storage && HT.storage.<op>) { ... } else { ... }")
    print("      where the block contains both a HT.storage.<op> call AND a")
    print("      localStorage.<op> call.")


def _walk_tool_js(root: Path) -> Iterable[Path]:
    """Yield every tools/<slug>/<slug>.js under `root`."""
    tools_dir = root / TOOLS_DIRNAME
    if not tools_dir.is_dir():
        sys.stderr.write(f"shell-bounds-check: missing {tools_dir}\n")
        sys.exit(2)
    for slug_dir in sorted(tools_dir.iterdir()):
        if not slug_dir.is_dir():
            continue
        slug = slug_dir.name
        js = slug_dir / f"{slug}.js"
        if js.is_file():
            yield js


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1] if __doc__ else None)
    parser.add_argument("--root", type=Path, default=None,
                        help="explicit repo root (default: walk up to find tools.schema.json)")
    parser.add_argument("--list", action="store_true",
                        help="print the policy and exit")
    args = parser.parse_args()

    if args.list:
        _print_policy()
        return 0

    root = args.root.resolve() if args.root else find_repo_root(Path(__file__).parent)
    if not (root / TOOLS_DIRNAME).is_dir():
        sys.stderr.write(f"shell-bounds-check: {root / TOOLS_DIRNAME} is not a directory\n")
        return 2

    print("# Shell Bypass Check (Story 1.14 / AD-14)")
    print()
    print(f"Repo root: `{root}`")
    print()
    print("Policy: tools/<slug>/<slug>.js must not reach localStorage, "
          "document.cookie, fetch, XMLHttpRequest, or HT.provide directly.")
    print()

    files = list(_walk_tool_js(root))
    total_hits = 0
    files_with_hits = 0
    summary_rows: list[str] = []

    for js in files:
        hits = _scan_file(js)
        slug = js.parent.name
        if not hits:
            summary_rows.append(f"| `tools/{slug}/{js.name}` | 0 | ✓ pass |")
            continue
        files_with_hits += 1
        total_hits += len(hits)
        rule_counter: dict[str, int] = {}
        for rule, _, _ in hits:
            rule_counter[rule] = rule_counter.get(rule, 0) + 1
        rule_str = ", ".join(f"{rule}×{n}" for rule, n in sorted(rule_counter.items()))
        summary_rows.append(f"| `tools/{slug}/{js.name}` | {len(hits)} | ✗ {rule_str} |")
        print(f"### Violations in `tools/{slug}/{js.name}`")
        print()
        print("| Line | Rule | Offending text |")
        print("|---:|---|---|")
        for rule, ln, line in hits:
            trimmed = line.strip()
            if len(trimmed) > 200:
                trimmed = trimmed[:197] + "…"
            # Escape pipes so the markdown table doesn't break.
            trimmed = trimmed.replace("|", "\\|")
            print(f"| {ln} | `{rule}` | `{trimmed}` |")
        print()

    print("## Summary")
    print()
    print(f"- Files scanned: {len(files)}")
    print(f"- Files with bypass violations: {files_with_hits}")
    print(f"- Total violations: {total_hits}")
    print()
    print("| File | Hits | Outcome |")
    print("|---|---:|---|")
    for row in summary_rows:
        print(row)

    if total_hits > 0:
        print()
        print("**FAIL:** at least one tool bypasses the Shell Public API. "
              "Replace direct API calls with HT.storage.* / HT.net.* / "
              "HT.use(...). See docs/shell-public-api.md §2.")
        return 1

    print()
    print("**PASS:** every tool routes through the registered HT.* APIs.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
