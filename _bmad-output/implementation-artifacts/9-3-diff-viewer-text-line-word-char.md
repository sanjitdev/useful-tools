---
status: ready-for-dev
baseline_commit: 6e0fb463f8fb2f5e9a2d20b9d7c4f8e1a3b5d9c7
---

# Story 9.3: Diff Viewer (text, line/word/char)

## User Story

As a developer wanting to see what changed,
I want a diff viewer with line/word/char granularity,
So that I can review edits at the right level.

## Current State

- No diff viewer tool exists in the repo today (verified 2026-08-13 by `ls tools/`).
- Story 9.1 (JSON Formatter Enhancements) also writes `assets/js/diff.js` with a Myers/LCS algorithm. Story 9.3's diff is the **standalone version** that supports line / word / char granularity. The shared `assets/js/diff.js` exports `myersDiff(a, b, eq)` (line granularity in 9.1; word/char use the same algorithm with different splitters in 9.3).
- `assets/js/diff.js` is the canonical location — see ROQ-1 for placement decision.
- The tool is `pack: ["developer"]` per Story 6.3's keyword map (`diff` → developer; "diff" substring matches "developer-facing data").

## Acceptance Criteria

### AC-1 — Two-pane input + side-by-side render

**Given** the user opens `tools/diff-viewer/index.html`
**When** they paste text A into `<textarea name="a">` and text B into `<textarea name="b">`
**Then** the tool renders a side-by-side diff in `<table class="diff-side-by-side">` with two columns:
  - Left column: text A's lines (each as `<td class="diff-cell-a">`) with sticky line numbers in `<th class="diff-line-num">`
  - Right column: text B's lines (each as `<td class="diff-cell-b">`) with sticky line numbers in `<th class="diff-line-num">`
**And** the view toggle `<select name="view">` (options `side-by-side | unified`) switches to unified mode (`<div class="diff-unified">` with one column) when set to `unified`. Default is `side-by-side`.
**And** the output is recomputed on every input change (debounced to 250ms via `setTimeout` / `clearTimeout`).
**And** empty inputs render `<p class="diff-empty">Paste two texts above to compare</p>` instead of the table.

### AC-2 — Granularity toggle (line / word / char)

**Given** the diff viewer is open
**When** the user changes the granularity `<select name="granularity">` to `line`, `word`, or `char`
**Then** the diff is re-rendered at the chosen granularity:
  - **line**: split both inputs on `\n`, compare arrays of lines
  - **word**: split on `/\s+/` (keep separators), compare arrays of words
  - **char**: split on `Array.from(str)` (grapheme-naive; just character codes), compare arrays of characters
**And** the algorithm is Myers' O(ND) (`myersDiff(a, b, eq)`); the only difference between granularities is the splitter + equality function:
  - line: `eq = (x, y) => x === y`
  - word: same equality, splitter = `/(\s+)/` (preserve whitespace tokens)
  - char: same equality, splitter = `Array.from`
**And** the granularity toggle persists via URL state per AC-4 (no localStorage key).

### AC-3 — Algorithm implementation + shared library

**Given** the diff viewer is open
**When** any granularity is selected
**Then** the algorithm is hand-rolled (Myers' O(ND) algorithm) in `assets/js/diff.js`
**And** `assets/js/diff.js` exports:

```js
window.HT.diff = {
  myersDiff: function (a, b, eq) {
    // returns [{op: 'equal'|'insert'|'delete', value}, ...]
  },
  splitLines: function (text) { return text.split('\n'); },
  splitWords: function (text) { return text.split(/(\s+)/).filter(Boolean); },
  splitChars: function (text) { return Array.from(text); }
};
```

**And** Story 9.1's JSON formatter diff **imports the same `window.HT.diff.myersDiff`** export — no duplication. The `assets/js/diff.js` file is the single source of truth.
**And** the algorithm handles empty inputs (both `a` and `b` empty → returns `[]`; one empty → returns all inserts / deletes).

### AC-4 — URL state

**Given** any input or control is set
**When** the user navigates away and back
**Then** the URL state encodes both texts (base64), the granularity, and the view mode:
  - `?a=<base64>&b=<base64>&granularity=line&view=side-by-side`
**And** the texts are base64-encoded (via `btoa(unescape(encodeURIComponent(text)))` to handle non-ASCII) to avoid URL-encoding issues with newlines / spaces / non-ASCII characters.
**And** the URL state schema is `{ default: { 'diff-a': '', 'diff-b': '', 'diff-granularity': 'line', 'diff-view': 'side-by-side' }, encode: [{key: 'a', type: 'string'}, {key: 'b', type: 'string'}, {key: 'granularity', type: 'string'}, {key: 'view', type: 'string'}], decode: [...] }`
**And** the URL is preserved via `history.replaceState` on every input change (debounced 250ms).
**And** if `?granularity=foo` is passed, the tool falls back to `line` and shows no warning (silent default).

### AC-5 — Keyboard-complete + a11y

**Given** the page renders
**When** the user tabs through it
**Then** the canonical order is: skip link → textarea A → textarea B → granularity select → view select → output table region → help / shortcuts region
**And** each textarea has an accessible `<label for="diff-a">Text A</label>` (and similar for B)
**And** the output table has `aria-label="Diff output"` and each diff row has `<td aria-label="Line {n} {op}">` for screen reader announcement of changes
**And** rubric #9 (Accessible) passes via `HT.a11y.auditTool`.

### AC-6 — Privacy + shell bounds

**Given** the page renders
**When** any action is taken
**Then** the tool script `tools/diff-viewer/diff-viewer.js` has **zero direct** `localStorage.*` / `fetch` / `XMLHttpRequest` / `HT.provide` calls (the diff is offline-only).
**And** history keys are `['diff-a', 'diff-b', 'diff-granularity', 'diff-view']` — the texts are recorded (the user opted into the URL state by visiting; history mirrors that).
**And** the tool never logs input content to `console.*`.
**And** the diff output is not cached or transmitted anywhere — all computation happens in the browser.

### AC-7 — `tools.json` entry + smoke harness

**Given** the implementation is complete
**When** `make ci` runs
**Then** `tools.json` carries an entry for `diff-viewer`:
  - `id: "diff-viewer"`, `slug: "diff-viewer"`, `title: "Diff Viewer"`, `description: "Compare two texts side-by-side or unified, with line / word / char granularity. Hand-rolled Myers algorithm."` (≤ 160 chars)
  - `category: "developer"`, `pack: ["developer"]`
  - `keywords: ["diff", "compare", "myers", "side-by-side", "unified"]`
  - `last-updated: <today>`, `ready: true`, `score: 8`
  - `urlState` per AC-4
  - `shortcuts: [{ key: "s", action: "swap", label: "Swap A and B" }, { key: "g", action: "go-line", label: "Go to first change" }]`
  - `history-keys: ["diff-a", "diff-b", "diff-granularity", "diff-view"]`
  - `view-source: { enabled: true, path: "tools/diff-viewer/index.html" }`
  - `embed-snippet: { enabled: true, badge-default: true, min-width: 480, min-height: 360 }`
  - `search-priority: 5`
  - `tab-order-canonical` declared
**And** `make shell-bounds` passes (no direct localStorage / fetch / HT.provide in tool script)
**And** `make shell-public-api-smoke` passes (no new `HT.*` public surface — only the internal `window.HT.diff` is added)
**And** `make pack-tags-smoke` reports `diff-viewer` under `developer`
**And** a new `scripts/_smoke_diff_viewer.js` Node vm-context smoke harness exists with **at least 25 assertions** covering:
  - (i) `myersDiff(["a","b","c"], ["a","x","c"])` returns `[{op:equal,value:"a"},{op:delete,value:"b"},{op:insert,value:"x"},{op:equal,value:"c"}]`;
  - (ii) `myersDiff([], [])` returns `[]`;
  - (iii) `myersDiff(["a"], [])` returns `[{op:delete,value:"a"}]`;
  - (iv) `myersDiff([], ["b"])` returns `[{op:insert,value:"b"}]`;
  - (v) `myersDiff(["a","b"], ["a","b","c"])` returns insert `"c"`;
  - (vi) `splitLines("a\nb\nc")` returns `["a","b","c"]`;
  - (vii) `splitWords("hello world foo")` returns `["hello"," ","world"," ","foo"]` (whitespace preserved);
  - (viii) `splitChars("abc")` returns `["a","b","c"]`;
  - (ix) word-granularity diff: `myersDiff(splitWords("the cat"), splitWords("the dog"))` returns `[{op:equal,value:"the"},{op:equal,value:" "},{op:delete,value:"cat"},{op:insert,value:"dog"}]`;
  - (x) char-granularity diff: `myersDiff(splitChars("abc"), splitChars("axc"))` returns `[{op:equal,value:"a"},{op:delete,value:"b"},{op:insert,value:"x"},{op:equal,value:"c"}]`;
  - (xi) URL state: passing `?a=<base64 "a\nb">&b=<base64 "a\nc">&granularity=line&view=side-by-side` sets textareas + selects correctly;
  - (xii) base64 round-trip with non-ASCII: `btoa(unescape(encodeURIComponent("héllo")))` → `"h%C3%A9llo"` round-trips correctly;
  - (xiii) invalid `?granularity=foo` falls back to `line`;
  - (xiv) smoke imports `window.HT.diff` from `assets/js/diff.js` (no duplication with Story 9.1's JSON formatter smoke);
  - (xv) vacuous-pass guard (`pass === 0 && fail === 0 → exit 1`).
**And** the new smoke target `diff-viewer-smoke` is wired into `make ci` and `.github/workflows/tool-contract-gate.yml` with path filters.

### AC-8 — Existing regression suite stays green

**Given** the implementation is complete
**When** `make ci` runs
**Then** every existing smoke harness stays green (no regression). In particular, the Story 9.1 JSON formatter enhancements smoke continues to pass (since both stories share `assets/js/diff.js` — the file's surface is stable).

## Resolved Open Questions

### ROQ-1 — Shared `assets/js/diff.js` placement

Story 9.1 (JSON Formatter) writes `assets/js/diff.js` with a Myers/LCS algorithm (line granularity). Story 9.3 (Diff Viewer) extends with line/word/char granularity. Both stories need the algorithm.

**Resolution:** `assets/js/diff.js` is the single source of truth. Story 9.3's spec (this file) defines the export shape (`window.HT.diff.{myersDiff, splitLines, splitWords, splitChars}`). Story 9.1's spec imports the same `myersDiff` export — no duplication. If Story 9.3 lands first, the file already exists with the wider surface; if Story 9.1 lands first, Story 9.3 extends the file with the word/char splitters. Either order works; the canonical surface is locked by this spec.

### ROQ-2 — Grapheme-aware splitting for char granularity

True Unicode grapheme splitting requires `Intl.Segmenter` (available in modern browsers + Node 16+) and is significantly more expensive than naive `Array.from`.

**Resolution:** AC-2 specifies **grapheme-naive** char splitting (`Array.from(text)`) — character codes, not grapheme clusters. The emoji "👨‍👩‍👧" becomes 5 separate code points in the diff. Documented in the tool's help text as a known limitation. Grapheme-aware splitting can land in a future enhancement if users complain about emoji diffs.

### ROQ-3 — Performance with large inputs

The Myers algorithm is O(ND) where D is the edit distance. For two 10,000-line texts with 5,000 lines changed, D ≈ 5,000 and the algorithm takes ~50-100ms — slow but tolerable.

**Resolution:** Story 9.3 does not impose a hard perf budget. The smoke harness does not measure timing. A future story can add a `search-perf-smoke`-style budget if users complain. The `setTimeout` debounce in AC-1 (250ms) prevents thrashing on input change but does not bound the worst-case render time.

## Files Touched (this story)

| File | Change |
|---|---|
| `_bmad-output/implementation-artifacts/9-3-diff-viewer-text-line-word-char.md` | NEW (this file) |
| `tools/diff-viewer/index.html` | NEW — ~340 lines (chrome + tool markup). Pattern matches `tools/url-codec/index.html`. |
| `tools/diff-viewer/diff-viewer.js` | NEW — ~150 LOC ES2018 vanilla. Wires textareas, granularity toggle, view toggle, table render, URL state. |
| `tools/diff-viewer/diff-viewer.css` | NEW — table styles + sticky line-number column + diff-equal/insert/delete color treatments. |
| `assets/js/diff.js` | MODIFIED (or NEW — depends on story order) — exports `window.HT.diff.{myersDiff, splitLines, splitWords, splitChars}`. ~120 LOC. |
| `tools.json` | MODIFIED — append a new entry for `diff-viewer`. |
| `scripts/_smoke_diff_viewer.js` | NEW — Node vm-context smoke harness, ≥ 25 assertions, vacuous-pass guard. |
| `Makefile` | EXTENDED — `.PHONY` + `diff-viewer-smoke` + `help` + `ci:` chain. |
| `.github/workflows/tool-contract-gate.yml` | EXTENDED — `make diff-viewer-smoke` step + path filters. |
| `assets/css/components.css` | unchanged |
| `assets/js/shell.js` | unchanged (no new `HT.*` surface; `window.HT.diff` is internal) |

## Tasks / Subtasks

- [ ] T1 — Author or extend `assets/js/diff.js` (Myers + 3 splitters). Pure functions, no DOM. Self-test inline. ~120 LOC.
- [ ] T2 — Author `tools/diff-viewer/index.html` (chrome + tool markup) following the url-codec template.
- [ ] T3 — Author `tools/diff-viewer/diff-viewer.css` (table styles + sticky line numbers + diff color treatments + `@media print`).
- [ ] T4 — Author `tools/diff-viewer/diff-viewer.js` (DOM wiring, URL state, history push).
- [ ] T5 — Add the `diff-viewer` entry to `tools.json`.
- [ ] T6 — Run `make shell-template` to re-splice the chrome.
- [ ] T7 — Write `scripts/_smoke_diff_viewer.js` (≥ 25 assertions, 15 categories per AC-7). Vacuous-pass guard.
- [ ] T8 — Wire Makefile + CI.
- [ ] T9 — Run `make ci` end-to-end. All gates green.
- [ ] T10 — Two-pass review (AI-E3-2). Mark `done`.

## Dev Agent Record

### Implementation Plan

1. **T1 first** — `assets/js/diff.js` is the shared library. Self-test inline (15+ assertions: empty inputs, single change, word/char granularity).
2. **T2 + T3 + T4** — author the tool in the order HTML → CSS → JS.
3. **T5** — `tools.json` entry. Run `make validate` to confirm.
4. **T6** — `make shell-template` to verify chrome consistency.
5. **T7** — smoke harness imports `window.HT.diff` from `assets/js/diff.js`. Reuses the same library as Story 9.1.
6. **T8–T9** — wiring + full `make ci` run.
7. **T10** — two-pass review (AI-E3-2).

### Known limitations

- Grapheme-naive char splitting (ROQ-2). Emoji diffs are code-point-level, not grapheme-level.
- No perf budget for large inputs (ROQ-3). Future enhancement if users complain.
- Side-by-side view shows aligned rows; long inserts / deletes may create blank rows. Not a bug — matches industry-standard diff viewers.

### Debug Log

_To be filled in during implementation._

### Completion Notes

_To be filled in during implementation._

## File List

- `_bmad-output/implementation-artifacts/9-3-diff-viewer-text-line-word-char.md` (this file)
- `assets/js/diff.js` (NEW or MODIFIED — shared with Story 9.1)
- `tools/diff-viewer/index.html` (NEW)
- `tools/diff-viewer/diff-viewer.js` (NEW)
- `tools/diff-viewer/diff-viewer.css` (NEW)
- `tools.json` (modified — 1 new entry)
- `scripts/_smoke_diff_viewer.js` (NEW)
- `Makefile` (modified)
- `.github/workflows/tool-contract-gate.yml` (modified)

## Change Log

- 2026-08-13 — CS: spec drafted. ROQ-1 (diff.js placement) → single source of truth, shared with Story 9.1. ROQ-2 (grapheme splitting) → grapheme-naive for v1. ROQ-3 (perf budget) → no hard budget for v1.

## Status

ready-for-dev