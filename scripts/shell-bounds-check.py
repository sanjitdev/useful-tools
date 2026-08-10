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
  - dataset.htAction = ...                > Use HT.sampleData.button / HT.reset.button
                                            (Story 2.2 — ad-hoc sample/reset DOM
                                            insertion is forbidden; the Shell owns
                                            the canonical button factory.)
  - data-ht-action="..."                  > Same — raw HTML attribute form (catches
                                            setAttribute('data-ht-action', ...) and
                                            inline '<button data-ht-action="sample">'
                                            strings that the stripper-aware scanner
                                            would miss).
  - 'Try an example' / 'Reset to sample'  > ARIA-label / text-content literals the
                                            Shell owns. Tool code MUST NOT hard-code
                                            these strings — the canonical copies
                                            come from sample-data.js.

Forbidden surfaces (scanned in tools/<slug>/<slug>.js AND tools/<slug>/index.html)
---------------------------------------------------------------------------------
  - tabindex="N" for N >= 1               > Story 2.4 / EXPERIENCE.md §6.2 row 4.
                                            No positive tabindex values — fix tab
                                            order by re-ordering the DOM, not via
                                            tabindex hacks. Allowlisted values:
                                            tabindex="-1" (skip-target / modal-trap),
                                            tabindex="0" (canonical "tabbable but
                                            not script-focusable" pattern).

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

Author: Handy Tools (Story 1.14 — Shell Public API and Bypass Prohibition
                     + Story 2.2 — Per-Tool Sample Data and Reset Button
                     + Story 2.4 — Per-Tool Keyboard-Complete Surface)
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

# HT.provide(...) — never allowlisted in tools/. A Tool that wants
# to expose an API registers via HT.provide(slug, api); a Tool that
# wants to consume someone else's API calls HT.use(slug). Both
# patterns are mentioned in the contract; the gate flags any
# `HT.provide` reference under tools/ so an author can't bypass the
# Tool-to-Tool API mount.
HT_PROVIDE_RE = re.compile(r"\bHT\.provide\b")

# Story 2.2 — ad-hoc sample/reset DOM insertion (see
# docs/shell-public-api.md §6 #4). Three patterns:
#
# SAMPLE_ACTION_RE flags `dataset.htAction = <expr>` in code (the
# stripper-aware scanner catches JS code, not raw HTML strings).
# The `(?!=)` negative lookahead avoids matching the comparison
# form `dataset.htAction === 'sample'` (P-11 fix).
SAMPLE_ACTION_RE = re.compile(
    r"""\bdataset\.htAction\s*=(?!=)"""
)

# SAMPLE_LITERAL_RE flags the raw `data-ht-action="..."` HTML
# attribute literal anywhere in the file — including inside
# setAttribute('data-ht-action', ...) strings and inside
# template-literal HTML that the stripper would otherwise treat as
# non-code. This is a raw-line scanner (not code-span-aware) on
# purpose.
SAMPLE_LITERAL_RE = re.compile(
    r"""data-ht-action\s*=\s*['"]"""
)

# SAMPLE_ARIA_RE flags the canonical ARIA-label / visible-text
# literals the Shell owns. Catches `'Try an example'` (with
# optional `(s)` shortcut suffix) and `'Reset to sample'` (with
# optional `(r)`). Raw-line scanner.
SAMPLE_ARIA_RE = re.compile(
    r"""['"](?:Try an example|Reset to sample)(?:\s*\([sr]\))?['"]"""
)


# ---------------------------------------------------------------------------
# Story 2.4 — positive tabindex prohibition (AC-7)
# ---------------------------------------------------------------------------
#
# EXPERIENCE.md §6.2 row 4 forbids any positive tabindex value
# (1, 2, 3, …). The only allowlist is `tabindex="-1"` (the
# documented skip-target pattern at `assets/shell/chrome.html:33`
# and the focus-trap fallback for modals). The scanner matches
# the literal attribute form: tabindex="1", tabindex='2',
# tabindex=3, tabindex= 4 — the regex captures the numeric value
# so the allowlist (`-1` and zero) is enforced. A tool author
# who needs to fix tab order does so via DOM re-ordering, not
# tabindex hacks.
TABINDEX_RE = re.compile(
    r"""tabindex\s*=\s*['"]?\s*(-?[0-9]+)\s*['"]?"""
)


# ---------------------------------------------------------------------------
# String / comment stripper (Story 1.14 review fix)
# ---------------------------------------------------------------------------
#
# Plain regex on raw source would false-positive on these surfaces:
#   - a tool's UI text saying "uses XMLHttpRequest" (string literal)
#   - a code comment explaining the gate ("// never call fetch() here")
#   - a template literal embedding a URL: `Loading ${url}...`
#   - a regex literal: /fetch\(...\)/ — JS does support these.
#
# The stripper walks the source character-by-character and yields the
# spans of NORMAL code (i.e. not inside any of the surfaces above).
# The regex patterns below run only against those spans.
#
# Review fix: previously the gate flagged every raw substring, which
# would break a tool whose docs or error message mentions
# "XMLHttpRequest" by name. The stripper is the correct fix.
#
# Implementation is hand-rolled rather than a real JS tokenizer: we
# only need to know whether the regex should consider a given
# character. We handle the standard surface set:
#   single-quoted, double-quoted, template (with ${...} interpolation),
#   line comment, block comment. Regex literals (e.g. /foo/g) are
#   NOT in the surface set — none of the existing tool files use
#   them, and adding recognition would require a real JS lexer.

def _code_spans(text: str) -> list[tuple[int, int]]:
    """Return a list of (start, end) character offsets covering the
    NORMAL-code spans of `text` — i.e. everything that is NOT inside
    a string, template literal, line comment, or block comment.

    The end offset is exclusive (Python slice convention)."""
    spans: list[tuple[int, int]] = []
    n = len(text)
    i = 0
    span_start: int | None = None
    # States: 'N', 'SQ', 'DQ', 'TPL', 'LC', 'BC'
    state = 'N'
    while i < n:
        ch = text[i]
        nxt = text[i + 1] if i + 1 < n else ''
        if state == 'N':
            if span_start is None:
                span_start = i
            if ch == "'":
                if span_start is not None and i > span_start:
                    spans.append((span_start, i))
                    span_start = None
                state = 'SQ'
                i += 1
                continue
            if ch == '"':
                if span_start is not None and i > span_start:
                    spans.append((span_start, i))
                    span_start = None
                state = 'DQ'
                i += 1
                continue
            if ch == '`':
                if span_start is not None and i > span_start:
                    spans.append((span_start, i))
                    span_start = None
                state = 'TPL'
                i += 1
                continue
            if ch == '/' and nxt == '/':
                if span_start is not None and i > span_start:
                    spans.append((span_start, i))
                    span_start = None
                state = 'LC'
                i += 2
                continue
            if ch == '/' and nxt == '*':
                if span_start is not None and i > span_start:
                    spans.append((span_start, i))
                    span_start = None
                state = 'BC'
                i += 2
                continue
            i += 1
            continue
        if state == 'SQ':
            if ch == '\\':
                i += 2  # skip escape
                continue
            if ch == "'":
                state = 'N'
                span_start = i + 1
            i += 1
            continue
        if state == 'DQ':
            if ch == '\\':
                i += 2
                continue
            if ch == '"':
                state = 'N'
                span_start = i + 1
            i += 1
            continue
        if state == 'TPL':
            if ch == '\\':
                i += 2
                continue
            if ch == '`':
                state = 'N'
                span_start = i + 1
                i += 1
                continue
            # Template literal interpolation: ${ ... } — recurse into
            # NORMAL so the inner code is scanned. We balance braces
            # here (no nested template literals inside ${...} per the
            # JS spec — they're forbidden, so this is correct).
            if ch == '$' and nxt == '{':
                depth = 1
                j = i + 2
                while j < n and depth > 0:
                    cj = text[j]
                    if cj == '{': depth += 1
                    elif cj == '}': depth -= 1
                    j += 1
                # The interpolation body is code; it should already
                # be in the spans list because the stripper doesn't
                # re-enter NORMAL mid-template. Leave state as TPL.
                i = j
                continue
            i += 1
            continue
        if state == 'LC':
            if ch == '\n':
                state = 'N'
                span_start = i + 1
            i += 1
            continue
        if state == 'BC':
            if ch == '*' and nxt == '/':
                state = 'N'
                span_start = i + 2
                i += 2
                continue
            i += 1
            continue
    if span_start is not None and span_start < n:
        spans.append((span_start, n))
    return spans


def _line_of_offset(text: str, offset: int) -> int:
    """Return the 1-indexed line number containing `offset`."""
    return text.count("\n", 0, offset) + 1


def _scan_pattern_in_code(
    text: str, pattern: re.Pattern[str]
) -> list[tuple[int, str]]:
    """Return [(line_no, matched_line), ...] for every regex match
    in `text`, ignoring matches inside strings / template literals /
    comments. The returned line text is the full source line (so
    the report shows context), not the matched span.

    Implementation: compute the code spans once (the NORMAL portions
    of the file, excluding strings / template literals / comments),
    then walk every span and run the regex against any substring
    that overlaps a span. The substring is clamped to the span, so
    matches that start or end inside a string/comment are excluded.

    Lines that mix code and a comment are scanned in two halves —
    the code half and the comment half separately — so a regex
    match in the comment half is suppressed."""
    spans = _code_spans(text)
    if not spans:
        return []
    # Build a per-line table of (line_no, line_text, line_start_offset).
    lines: list[tuple[int, str, int]] = []
    pos = 0
    for line in text.splitlines(keepends=True):
        lines.append((len(lines) + 1, line.rstrip("\r\n"), pos))
        pos += len(line)
    hits: list[tuple[int, str]] = []
    seen_lines: set[int] = set()
    for span_start, span_end in spans:
        # For every line that overlaps [span_start, span_end), find
        # the intersection of the line with the span and run the
        # regex against that substring.
        for ln_no, line_text, ln_start in lines:
            ln_end = ln_start + len(line_text)
            if ln_end <= span_start or ln_start >= span_end:
                continue
            if ln_no in seen_lines:
                continue
            # Intersection.
            inter_start = max(span_start, ln_start)
            inter_end = min(span_end, ln_end)
            inter = text[inter_start:inter_end]
            if pattern.search(inter):
                hits.append((ln_no, line_text))
                seen_lines.add(ln_no)
    return hits


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
    defensive `localStorage.setItem` lives.

    Review fix: the walker was previously a naive brace counter that
    would desync on template strings containing `{` (e.g.
    `Loading ${url}...`). The fix is to reuse the _code_spans
    stripper: we only count braces that are inside NORMAL code.
    `_walk_body` advances k to the end of the current code span and
    continues from the next span's start, so `{` and `}` inside
    strings, template literals, or comments are skipped."""
    allowed: set[int] = set()
    n = len(text)
    spans = _code_spans(text)
    if not spans:
        return allowed

    def _offset_in_span(offset: int) -> int | None:
        """Return the index in `spans` of the span containing
        `offset`, or None."""
        for idx, (s, e) in enumerate(spans):
            if s <= offset < e:
                return idx
        return None

    def _walk_body(start: int) -> tuple[int, int] | None:
        """Balance braces from `start` (which must point at `{`
        inside NORMAL code) to the matching `}`. Returns
        (close_offset, span_index_of_close) or None if unbalanced.

        Implementation: find the span that contains `start`, walk
        that span until depth returns to 0 OR we hit the span's
        end. If depth > 0, advance to the next span and continue
        from its start. This handles `{` / `}` inside template
        literals and comments correctly because those are excluded
        from `spans`."""
        depth = 0
        k = start
        span_idx = _offset_in_span(start)
        if span_idx is None:
            return None
        while span_idx < len(spans):
            s, e = spans[span_idx]
            while k < e:
                ch = text[k]
                if ch == "{":
                    depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        return k, span_idx
                k += 1
            # Move to next span; k becomes its start.
            span_idx += 1
            if span_idx < len(spans):
                k = spans[span_idx][0]
        return None

    i = 0
    while i < n:
        m = LIFECYCLE_OPEN_RE.search(text, i)
        if not m:
            break
        # Walk forward to the opening `{` of the `if` body. The
        # regex ends just after the closing `)` of the if condition,
        # so we scan for the next `{` (skipping any string/comment
        # we may have crossed over).
        j = m.end()
        # Find next `{` in NORMAL code (use the spans to filter).
        next_brace = -1
        span_idx = _offset_in_span(j) or 0
        for si in range(span_idx, len(spans)):
            s, e = spans[si]
            inner_start = max(j, s)
            for k in range(inner_start, e):
                if text[k] == "{":
                    next_brace = k
                    break
            if next_brace >= 0:
                break
            j = e
        if next_brace < 0:
            break
        j = next_brace

        walked = _walk_body(j)
        if walked is None:
            break
        if_close, _ = walked
        end = if_close
        # Skip `else` keyword and any whitespace/newlines, then walk
        # the `else` body if present.
        rest = text[if_close + 1:].lstrip()
        if rest.startswith("else"):
            # Find the `{` of the else body.
            else_open = -1
            scan_from = if_close + 1
            span_idx = _offset_in_span(scan_from) or 0
            for si in range(span_idx, len(spans)):
                s, e = spans[si]
                inner_start = max(scan_from, s)
                for k in range(inner_start, e):
                    if text[k] == "{":
                        else_open = k
                        break
                if else_open >= 0:
                    break
                scan_from = e
            if else_open > 0:
                else_close_pair = _walk_body(else_open)
                if else_close_pair is not None:
                    end = else_close_pair[0]
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


# Story 2.2 review fix P-4: pre-strip /* ... */ block comments before
# raw-line scanners run, so a long comment on its own line isn't
# matched by a `data-ht-action="..."` literal scan, AND so a literal
# hidden inside a multi-line block comment doesn't pollute the
# per-line table. The stripper preserves line numbers by replacing
# each block with same-length whitespace (newlines kept verbatim).
_BLOCK_COMMENT_RE = re.compile(r"/\*.*?\*/", re.DOTALL)


def _strip_block_comments(text: str) -> str:
    """Replace every /* ... */ block comment in `text` with same-length
    whitespace (newlines preserved verbatim) so that:
      - line numbers in the returned text match the original,
      - raw-line scanners (SAMPLE_LITERAL_RE, SAMPLE_ARIA_RE) that
        run on the stripped text ignore block-comment contents,
      - any surviving `// ...` line comments are still inside code
        spans the stripper-aware scanner already skips.

    The replacement uses newlines, not spaces, so `text.count("\n", ...)`
    in the downstream reporting path still works correctly."""
    def _repl(m: re.Match[str]) -> str:
        s = m.group(0)
        # Keep every newline; replace other chars with space.
        return "".join(ch if ch == "\n" else " " for ch in s)
    return _BLOCK_COMMENT_RE.sub(_repl, text)


def _scan_file(path: Path) -> list[tuple[str, int, str]]:
    """Scan a single tool JS file. Returns a list of (rule, line, text).
    The scan is string/comment-aware (see _scan_pattern_in_code): a
    tool's UI text or doc comment that mentions 'XMLHttpRequest' is
    not flagged.

    Story 2.2 additions:
      - SAMPLE_ACTION_RE runs via the code-span scanner (assignment
        only; comparison form is suppressed by the `(?!=)` lookahead).
      - SAMPLE_LITERAL_RE + SAMPLE_ARIA_RE run as raw-line scanners
        on a block-comment-stripped copy of the source, so an HTML
        attribute literal or ARIA-label string inside a `setAttribute`
        call or template-literal HTML fragment still trips the gate.

    Story 2.4 additions:
      - TABINDEX_RE is run as a raw-line scanner against the
        block-comment-stripped source. Matches tabindex="N" with N
        a positive integer (1, 2, 3, ...). tabindex="-1" and
        tabindex="0" are allowlisted (the latter is the documented
        "tabbable but not focusable via script" pattern; EXPERIENCE.md
        §6.2 row 4 forbids only positive values).
    """
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as e:
        sys.stderr.write(f"shell-bounds-check: cannot read {path}: {e}\n")
        return [("read-error", 0, str(e))]

    allowed = find_lifecycle_allowlist_lines(text)
    # Pre-strip block comments so raw-line scanners (Story 2.2) see
    # the same line numbers as the original but ignore comment contents.
    stripped = _strip_block_comments(text)
    hits: list[tuple[str, int, str]] = []

    for ln, line in _scan_pattern_in_code(text, LOCAL_STORAGE_RE):
        if ln in allowed:
            continue
        hits.append(("localStorage", ln, line))
    for ln, line in _scan_pattern_in_code(text, DOC_COOKIE_RE):
        hits.append(("document.cookie", ln, line))
    for ln, line in _scan_pattern_in_code(text, FETCH_RE):
        hits.append(("fetch", ln, line))
    for ln, line in _scan_pattern_in_code(text, XHR_RE):
        hits.append(("XMLHttpRequest", ln, line))
    for ln, line in _scan_pattern_in_code(text, HT_PROVIDE_RE):
        hits.append(("HT.provide", ln, line))
    # Story 2.2 ad-hoc sample/reset button rule.
    for ln, line in _scan_pattern_in_code(text, SAMPLE_ACTION_RE):
        hits.append(("sample/reset", ln, line))
    for ln, line in _line_numbers(stripped, SAMPLE_LITERAL_RE):
        hits.append(("sample/reset", ln, line))
    for ln, line in _line_numbers(stripped, SAMPLE_ARIA_RE):
        hits.append(("sample/reset", ln, line))
    # Story 2.4 positive-tabindex rule (raw-line, allowlists -1 / 0).
    for ln, line in _line_numbers(stripped, TABINDEX_RE):
        m = TABINDEX_RE.search(line)
        if m is None:
            continue
        try:
            value = int(m.group(1))
        except (TypeError, ValueError):
            continue
        if value >= 1:
            hits.append(("positive-tabindex", ln, line))
    return hits


def _scan_index_html(path: Path) -> list[tuple[str, int, str]]:
    """Story 2.4 — scan a tool page's index.html for positive
    tabindex attributes. Unlike <slug>.js, the index.html is mostly
    HTML markup, not code — only the TABINDEX_RE rule applies. The
    block-comment stripper is a no-op for HTML (no /* */ comments)
    but we run it for symmetry so the line numbers in the report
    match the source file.
    """
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError) as e:
        sys.stderr.write(f"shell-bounds-check: cannot read {path}: {e}\n")
        return [("read-error", 0, str(e))]
    stripped = _strip_block_comments(text)
    hits: list[tuple[str, int, str]] = []
    for ln, line in _line_numbers(stripped, TABINDEX_RE):
        m = TABINDEX_RE.search(line)
        if m is None:
            continue
        try:
            value = int(m.group(1))
        except (TypeError, ValueError):
            continue
        if value >= 1:
            hits.append(("positive-tabindex", ln, line))
    return hits


def _print_policy() -> None:
    print("shell-bounds-check policy (Story 1.14 / AD-14 + Story 2.2 / AD-4 + Story 2.4):")
    print("  Forbidden in tools/<slug>/<slug>.js:")
    print("    - localStorage.<getItem|setItem|removeItem|clear|key|length>")
    print("    - document.cookie")
    print("    - fetch(<url>, ...)")
    print("    - XMLHttpRequest / new XMLHttpRequest()")
    print("    - HT.provide(...)")
    print("    - dataset.htAction = ... (Story 2.2 — Shell owns sample/reset)")
    print("    - data-ht-action=\"...\" (Story 2.2 — raw HTML attribute form)")
    print("    - 'Try an example' / 'Reset to sample' literals (Story 2.2)")
    print("  Forbidden in tools/<slug>/<slug>.js AND tools/<slug>/index.html:")
    print("    - tabindex=\"N\" for N >= 1 (Story 2.4 / EXPERIENCE.md §6.2 —")
    print("      no positive tabindex; reorder the DOM instead)")
    print("  Allowed:")
    print("    - Inline <script> blocks in tools/<slug>/index.html (not scanned)")
    print("      for any JS-side rule. (The tabindex rule still applies to")
    print("      the HTML markup.)")
    print("    - Lifecycle fallback block:")
    print("        if (HT.storage && HT.storage.<op>) { ... } else { ... }")
    print("      where the block contains both a HT.storage.<op> call AND a")
    print("      localStorage.<op> call.")
    print("    - tabindex=\"-1\" (the documented skip-target / modal-trap pattern)")
    print("    - tabindex=\"0\" (the documented 'tabbable but not focusable via")
    print("      script' pattern; EXPERIENCE.md §6.2 forbids only positive values)")


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


def _walk_tool_index_html(root: Path) -> Iterable[Path]:
    """Yield every tools/<slug>/index.html under `root`. Story 2.4
    adds the positive-tabindex scan to the index.html walker —
    the rule applies to HTML markup, not just JS code."""
    tools_dir = root / TOOLS_DIRNAME
    if not tools_dir.is_dir():
        return
    for slug_dir in sorted(tools_dir.iterdir()):
        if not slug_dir.is_dir():
            continue
        page = slug_dir / "index.html"
        if page.is_file():
            yield page


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1] if __doc__ else None)
    parser.add_argument("--root", type=Path, default=None,
                        help="explicit repo root (default: walk up to find tools.schema.json)")
    parser.add_argument("--list", action="store_true",
                        help="print the policy and exit")
    parser.add_argument("--self-test", action="store_true",
                        help="run the stripper + walker unit tests and exit")
    args = parser.parse_args()

    if args.list:
        _print_policy()
        return 0

    if args.self_test:
        return _run_self_tests()

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
    pages = list(_walk_tool_index_html(root))
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

    for page in pages:
        hits = _scan_index_html(page)
        slug = page.parent.name
        if not hits:
            summary_rows.append(f"| `tools/{slug}/index.html` | 0 | ✓ pass |")
            continue
        files_with_hits += 1
        total_hits += len(hits)
        rule_counter: dict[str, int] = {}
        for rule, _, _ in hits:
            rule_counter[rule] = rule_counter.get(rule, 0) + 1
        rule_str = ", ".join(f"{rule}×{n}" for rule, n in sorted(rule_counter.items()))
        summary_rows.append(f"| `tools/{slug}/index.html` | {len(hits)} | ✗ {rule_str} |")
        print(f"### Violations in `tools/{slug}/index.html`")
        print()
        print("| Line | Rule | Offending text |")
        print("|---:|---|---|")
        for rule, ln, line in hits:
            trimmed = line.strip()
            if len(trimmed) > 200:
                trimmed = trimmed[:197] + "…"
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


# ---------------------------------------------------------------------------
# Self-tests (--self-test)
# ---------------------------------------------------------------------------
#
# The stripper + walker are subtle. Run a focused set of unit-style
# checks against known inputs to catch regressions. Each case is a
# `(name, source, expectations)` tuple — expectations are checked
# against the actual output.

def _run_self_tests() -> int:
    cases: list[tuple[str, str, list[str], list[str]]] = [
        # (name, source, patterns_that_must_match, patterns_that_must_NOT_match)
        (
            "plain code with localStorage.setItem is flagged",
            "var x = localStorage.setItem('k', 'v');\n",
            ["localStorage"],
            [],
        ),
        (
            "single-quote string with 'XMLHttpRequest' is NOT flagged",
            "var msg = 'Uses XMLHttpRequest under the hood';\n",
            [],
            ["XMLHttpRequest"],
        ),
        (
            "double-quote string with 'document.cookie' is NOT flagged",
            'var msg = "we set document.cookie here";\n',
            [],
            ["document.cookie"],
        ),
        (
            "line comment with 'fetch(' is NOT flagged",
            "// we never call fetch() directly here\n",
            [],
            ["fetch"],
        ),
        (
            "block comment with 'XMLHttpRequest' is NOT flagged",
            "/* new XMLHttpRequest() would be wrong */\n",
            [],
            ["XMLHttpRequest"],
        ),
        (
            "template literal with embedded URL is NOT flagged",
            "var u = `https://example.com/fetch(${id})`;\n",
            [],
            ["fetch"],
        ),
        (
            "code after a comment is still flagged",
            "// comment\nfetch(real);\n",
            ["fetch"],
            [],
        ),
        (
            "code before AND after a string is still scanned",
            "fetch(real); var s = 'fetch(fake)'; fetch(other);\n",
            ["fetch"],
            [],  # both real fetch calls hit, the string one is suppressed but the count stays >= 1
        ),
        (
            "template literal with brace interpolation desyncs walker",
            # This is the failure mode that broke the previous walker.
            # The block-finder walker must skip the `{` and `}` inside
            # the template literal. The lifecycle fallback's `if`
            # body's `{` should NOT be matched by the `{` inside `${`.
            # The localStorage line below IS scanned by the regex
            # (the regex doesn't know about the allowlist); the
            # _scan_file caller checks find_lifecycle_allowlist_lines
            # before reporting. This unit test isolates the stripper.
            "if (HT.storage && HT.storage.set) {\n"
            "  var msg = `prefix ${interpolated} suffix`;\n"
            "  HT.storage.set(K, v);\n"
            "} else {\n"
            "  localStorage.setItem(K, v);\n"
            "}\n",
            ["localStorage"],  # the regex DOES find it; the allowlist is what suppresses
            [],
        ),
    ]

    fail = 0
    pass_ = 0
    for name, source, must_match, must_not_match in cases:
        spans = _code_spans(source)
        # For each pattern in must_match, ensure at least one hit.
        # For each pattern in must_not_match, ensure zero hits.
        ok = True
        for pat_name in must_match:
            pat = {
                "localStorage": LOCAL_STORAGE_RE,
                "fetch": FETCH_RE,
                "XMLHttpRequest": XHR_RE,
                "document.cookie": DOC_COOKIE_RE,
            }[pat_name]
            hits = _scan_pattern_in_code(source, pat)
            if not hits:
                ok = False
                print(f"  FAIL  {name} — expected '{pat_name}' to match, got 0 hits")
        for pat_name in must_not_match:
            pat = {
                "localStorage": LOCAL_STORAGE_RE,
                "fetch": FETCH_RE,
                "XMLHttpRequest": XHR_RE,
                "document.cookie": DOC_COOKIE_RE,
            }[pat_name]
            hits = _scan_pattern_in_code(source, pat)
            if hits:
                ok = False
                print(f"  FAIL  {name} — expected '{pat_name}' to NOT match, got {len(hits)} hits: {hits}")
        if ok:
            pass_ += 1
            print(f"  PASS  {name}")
        else:
            fail += 1

    # Also test find_lifecycle_allowlist_lines on the template-literal
    # desync case directly.
    template_desync = (
        "if (HT.storage && HT.storage.set) {\n"
        "  var msg = `prefix ${interpolated} suffix`;\n"
        "  HT.storage.set(K, v);\n"
        "} else {\n"
        "  localStorage.setItem(K, v);\n"
        "}\n"
    )
    allowed = find_lifecycle_allowlist_lines(template_desync)
    expected_lines = {1, 2, 3, 4, 5, 6}
    if allowed == expected_lines:
        pass_ += 1
        print(f"  PASS  lifecycle walker handles template-literal desync")
    else:
        fail += 1
        print(f"  FAIL  lifecycle walker — expected {expected_lines}, got {sorted(allowed)}")

    # And the simple lifecycle fallback (no template).
    simple = (
        "if (HT.storage && HT.storage.set) {\n"
        "  HT.storage.set(K, v);\n"
        "} else {\n"
        "  localStorage.setItem(K, v);\n"
        "}\n"
    )
    allowed2 = find_lifecycle_allowlist_lines(simple)
    if allowed2 == {1, 2, 3, 4, 5}:
        pass_ += 1
        print(f"  PASS  lifecycle walker handles plain fallback")
    else:
        fail += 1
        print(f"  FAIL  lifecycle walker — expected {{1,2,3,4,5}}, got {sorted(allowed2)}")

    # Story 2.2 sample/reset patterns. Keep these assertions explicit
    # instead of routing them through the legacy pattern-name map so
    # each scanner's boundary is documented by the test itself.
    sample_cases: list[tuple[str, bool]] = [
        (
            "SAMPLE_ACTION_RE flags dataset.htAction assignment",
            bool(_scan_pattern_in_code("el.dataset.htAction = 'sample';\n", SAMPLE_ACTION_RE)),
        ),
        (
            "SAMPLE_ACTION_RE flags dataset.htAction spaced assignment",
            bool(_scan_pattern_in_code("el.dataset.htAction   =   value;\n", SAMPLE_ACTION_RE)),
        ),
        (
            "SAMPLE_ACTION_RE does not flag strict equality",
            not _scan_pattern_in_code("el.dataset.htAction === 'sample';\n", SAMPLE_ACTION_RE),
        ),
        (
            "SAMPLE_ACTION_RE does not flag loose equality",
            not _scan_pattern_in_code("el.dataset.htAction == 'sample';\n", SAMPLE_ACTION_RE),
        ),
        (
            "SAMPLE_ACTION_RE ignores single-quoted string",
            not _scan_pattern_in_code("var s = 'dataset.htAction = sample';\n", SAMPLE_ACTION_RE),
        ),
        (
            "SAMPLE_ACTION_RE ignores double-quoted string",
            not _scan_pattern_in_code('var s = "dataset.htAction = sample";\n', SAMPLE_ACTION_RE),
        ),
        (
            "SAMPLE_ACTION_RE ignores line comment",
            not _scan_pattern_in_code("// dataset.htAction = sample\n", SAMPLE_ACTION_RE),
        ),
        (
            "SAMPLE_ACTION_RE ignores block comment",
            not _scan_pattern_in_code("/* dataset.htAction = sample */\n", SAMPLE_ACTION_RE),
        ),
        (
            "SAMPLE_LITERAL_RE flags HTML attribute",
            bool(_line_numbers('<button data-ht-action="sample">\n', SAMPLE_LITERAL_RE)),
        ),
        (
            "SAMPLE_LITERAL_RE flags single-quoted attribute",
            bool(_line_numbers("<button data-ht-action='reset'>\n", SAMPLE_LITERAL_RE)),
        ),
        (
            "SAMPLE_LITERAL_RE flags template-literal HTML attribute",
            bool(_line_numbers("var html = `<button data-ht-action=\"sample\">`;\n", SAMPLE_LITERAL_RE)),
        ),
        (
            "SAMPLE_LITERAL_RE flags whitespace around equals",
            bool(_line_numbers('<button data-ht-action = \'reset\'>\n', SAMPLE_LITERAL_RE)),
        ),
        (
            "SAMPLE_LITERAL_RE ignores block-comment literal",
            not _line_numbers(_strip_block_comments('/* data-ht-action="sample" */\n'), SAMPLE_LITERAL_RE),
        ),
        (
            "SAMPLE_LITERAL_RE preserves line count after block comment",
            _strip_block_comments('/* hidden\ndata-ht-action="sample"\n*/\ncode;\n').count("\n") == 4,
        ),
        (
            "SAMPLE_ARIA_RE flags Try an example",
            bool(_line_numbers("el.setAttribute('aria-label', 'Try an example');\n", SAMPLE_ARIA_RE)),
        ),
        (
            "SAMPLE_ARIA_RE flags Try an example shortcut",
            bool(_line_numbers("'Try an example (s)'\n", SAMPLE_ARIA_RE)),
        ),
        (
            "SAMPLE_ARIA_RE flags Reset to sample shortcut",
            bool(_line_numbers("'Reset to sample (r)'\n", SAMPLE_ARIA_RE)),
        ),
        (
            "SAMPLE_ARIA_RE ignores unrelated label",
            not _line_numbers("'Reset to defaults'\n", SAMPLE_ARIA_RE),
        ),
        # Story 2.4 — positive-tabindex rule. The TABINDEX_RE captures
        # any digit string after `tabindex=`, and the scanner fires
        # only when the captured integer is >= 1. The allowlist
        # (`tabindex="-1"`, `tabindex="0"`) is enforced by the
        # integer-comparison branch in _scan_file / _scan_index_html.
        (
            "TABINDEX_RE captures tabindex=\"1\"",
            bool(_line_numbers('<a tabindex="1">x</a>\n', TABINDEX_RE)),
        ),
        (
            "TABINDEX_RE captures tabindex='2' (single quotes)",
            bool(_line_numbers("<a tabindex='2'>x</a>\n", TABINDEX_RE)),
        ),
        (
            "TABINDEX_RE captures unquoted tabindex=3",
            bool(_line_numbers('<a tabindex=3>x</a>\n', TABINDEX_RE)),
        ),
        (
            "TABINDEX_RE captures tabindex= 4 (whitespace)",
            bool(_line_numbers('<a tabindex= 4>x</a>\n', TABINDEX_RE)),
        ),
        (
            "TABINDEX_RE does not capture tabindex=\"-1\"",
            not _line_numbers('<a tabindex="-1">x</a>\n', TABINDEX_RE) or
            # The regex DOES match "-1" (any digit string), but the
            # downstream integer check excludes it. Verify the match
            # captures the literal -1 (so the allowlist can compare).
            TABINDEX_RE.search('<a tabindex="-1">x</a>').group(1) == '-1',
        ),
        (
            "TABINDEX_RE does not capture tabindex=\"0\"",
            TABINDEX_RE.search('<a tabindex="0">x</a>').group(1) == '0',
        ),
        (
            "TABINDEX_RE ignores block-comment literal",
            not _line_numbers(_strip_block_comments('/* tabindex="1" */\n'), TABINDEX_RE),
        ),
    ]
    for name, ok in sample_cases:
        if ok:
            pass_ += 1
            print(f"  PASS  {name}")
        else:
            fail += 1
            print(f"  FAIL  {name}")

    print()
    print(f"self-test: {pass_} passed, {fail} failed")
    if pass_ == 0 and fail == 0:
        sys.stderr.write("self-test: vacuous run — zero assertions executed\n")
        return 1
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
