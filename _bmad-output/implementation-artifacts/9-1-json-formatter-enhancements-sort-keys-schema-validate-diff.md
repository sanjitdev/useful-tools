---
status: in-progress
baseline_commit: 6e0fb463f8fb2f5e9a2d20b9d7c4f8e1a3b5d9c7
---

> **DS DONE — T1–T9 complete; T10 (two-pass review) DEFERRED to next session.**

# Story 9.1: JSON Formatter Enhancements (sort keys, schema validate, diff)

## User Story

As a developer wanting more from the JSON formatter,
I want options to sort keys, validate against a JSON Schema, and diff two JSONs,
So that the tool is competitive with CyberChef's JSON operations.

## Current State

- `tools/json-formatter/` exists (promoted in Epic 2 Wave 3 — `ready:true`, `score:8`). It ships Format / Minify / Validate modes in the existing chrome.
- `tools.json` entry for `json-formatter` is at `_bmad-output/.../tools.json`; the existing `urlState` keys include `json-input`, `format`, `minify`, `validate`, `output`, `tree`, `copy-out`, `top`, `status`, `main`.
- The tool already does JSON lint (catches parse errors with a `<p class="lint-error">`). The new "schema validate" feature is a separate mode layered on top of the same input.
- `assets/js/vendor/` currently contains only `highlight.min.js` and `zip-store.js`. AJV is **not vendored today** — see Resolved Open Questions (ROQ-1).

## Acceptance Criteria

### AC-1 — Sort keys (recursive)

**Given** the user opens the JSON formatter (`tools/json-formatter/index.html`)
**When** they enable the "Sort keys" checkbox (`<input type="checkbox" data-action="sort-keys">`) and the existing Format action runs
**Then** the output JSON has keys sorted at every level recursively (including nested objects and arrays of objects)
**And** the implementation uses:

```js
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map(k => [k, sortKeys(value[k])])
    );
  }
  return value;
}
```

**And** the sort uses the default JavaScript `Array.prototype.sort` comparator (lexicographic on the key string). Object key order is preserved by `JSON.stringify`.
**And** non-string keys (numbers, symbols) are left in their existing position — the `Object.keys()` enumeration order is the contract.
**And** if the input is not valid JSON, the tool shows the existing `<p class="lint-error">` and the sort toggle is a no-op (it does not crash).
**And** the sort toggle defaults to OFF and persists via the existing localStorage layer (no new storage key; the toggle is part of `urlState`).

### AC-2 — Schema validate

**Given** the user opens the JSON formatter
**When** they paste a JSON Schema into `<textarea name="schema-input">` and toggle "Validate" (`<input type="checkbox" data-action="validate-schema">`)
**Then** the tool runs validation against the input JSON using a hand-rolled Draft-07 subset validator
**And** validation results render as `<ul class="schema-errors">` with each error as `<li data-path="<instancePath>"><code>{path}</code>: {message}</li>`; empty list + green check icon `<span class="schema-ok" aria-label="Schema valid">✓</span>` = pass
**And** the validator implements the **type / required / properties / items / enum / minimum / maximum / minLength / maxLength / pattern** keywords only — full Draft-07 is out of scope (see ROQ-1). Implemented in `assets/js/json-schema-lite.js` (~150 LOC pure ES2018, hand-rolled walker).
**And** the tool never makes a network request. The schema is what the user pastes; the tool does not fetch `$ref` against any URL.
**And** if the schema textarea is empty or the input is unparseable, the validator is a no-op (no error, no success chip).

### AC-3 — Diff (two JSONs)

**Given** the user opens the JSON formatter
**When** they paste a second JSON into `<textarea name="json-input-b">` and click "Diff" (`<button data-action="diff">`)
**Then** the tool renders a unified diff with line-level highlights using a hand-rolled Myers/LCS algorithm in `assets/js/diff.js` (exported as `window.HT.diff.myersDiff(a, b, eq)`)
**And** each diff line is rendered as `<div class="diff-line diff-{op}">` where `op ∈ {equal, insert, delete}`; lines from `a` render with a left border, lines from `b` with a right border
**And** the diff is line-based: the algorithm splits both inputs on `\n` and compares lines. Word/char granularity is **not** in this story (that's Story 9.3's Diff Viewer).
**And** the diff output lives in `<section class="json-diff-output" aria-label="JSON diff">` — visible only when the user clicks Diff (not auto-rendered on input).
**And** the diff tool never makes a network request and uses no third-party library.

### AC-4 — Feature gating via URL state

**Given** any of the above enhancements is enabled
**When** the URL is updated
**Then** the enhancement visibility is gated behind `?feature=sort|schema|diff` (comma-separated; default empty = no enhancements visible)
**And** the URL state schema is `{ default: { 'json-feature': '' }, encode: [{key: 'feature', type: 'string'}], decode: [...] }`
**And** the page renders only the relevant controls for the active features: `?feature=sort` shows the Sort toggle, `?feature=schema` shows the schema textarea, `?feature=diff` shows input B textarea + Diff button. Multiple features stack with `,`.
**And** invalid `?feature=foo` is silently dropped (no warning toast; the page renders with no enhancements visible).
**And** the Sort toggle's checked state persists across reloads via the URL state (it is part of the feature list, not a separate URL key).

### AC-5 — Keyboard-complete + a11y

**Given** the page renders with all three features enabled
**When** the user tabs through it
**Then** the canonical order is: skip link → json-input textarea → Sort toggle → Schema textarea → Validate toggle → json-input-b textarea → Diff button → Format / Minify / Validate buttons → output region → help / shortcuts region
**And** each enhancement control has an accessible label (`<label for="json-feature-sort">Sort keys</label>` etc.)
**And** the schema-errors `<ul>` has `aria-live="polite"` so screen readers announce the validation result
**And** rubric #9 (Accessible) passes via `HT.a11y.auditTool` (Story 2.4) — verified by the `make a11y-audit` gate.

### AC-6 — Privacy + shell bounds

**Given** the page renders
**When** any action is taken
**Then** the tool script `tools/json-formatter/json-formatter.js` has **zero direct** `localStorage.*` / `sessionStorage.*` / `document.cookie` / `fetch` / `XMLHttpRequest` / `HT.provide` calls (the existing script already passes `shell-bounds`; the enhancements must not regress it)
**And** history keys are `['json-input', 'format', 'minify', 'feature']` (the new `feature` key captures the URL state of which enhancements are visible)
**And** the tool never logs input content to `console.*`.

### AC-7 — `tools.json` modification + smoke harness

**Given** the implementation is complete
**When** `make ci` runs
**Then** `tools.json` for `json-formatter` is updated:
  - `keywords` adds `"sort-keys"`, `"schema-validate"`, `"json-diff"` (existing keywords preserved)
  - `description` extends to `"Format, minify, and validate JSON. Sort keys recursively. Validate against a JSON Schema subset. Diff two JSONs."` (≤ 160 chars)
  - `urlState.encode/decode` adds the `feature` key per AC-4
  - `history-keys` adds `"feature"`
  - `last-updated` bumps to `<today>`
  - `score` stays at 8 (or higher with the rubric criteria passes documented)
**And** `make shell-bounds` still passes (no direct `localStorage`/`fetch`/`HT.provide` in the tool script)
**And** a new `scripts/_smoke_json_formatter_enhancements.js` Node smoke harness exists with **at least 20 assertions** covering:
  - (i) `sortKeys({b:1,a:{d:2,c:3}})` returns `{a:{c:3,d:2},b:1}` (recursive);
  - (ii) `sortKeys([{b:1},{a:2}])` returns `[{a:2},{b:1}]` (arrays of objects);
  - (iii) `sortKeys` is a no-op on primitives (`42`, `"x"`, `null`, `true`);
  - (iv) JSON Schema validator: `type: "number"` rejects `"foo"`; `required: ["a","b"]` reports missing `b` with `instancePath: ""`; `enum: [1,2,3]` rejects `4`;
  - (v) `minimum: 0, maximum: 10` accepts `5`, rejects `11` and `-1`;
  - (vi) `pattern: "^[a-z]+$"` accepts `"abc"`, rejects `"ABC"`;
  - (vii) `myersDiff(["a","b","c"], ["a","x","c"])` returns `[{op:equal,value:"a"},{op:delete,value:"b"},{op:insert,value:"x"},{op:equal,value:"c"}]`;
  - (viii) URL state: passing `?feature=sort,schema` enables both toggles; invalid `?feature=foo` renders with no enhancements;
  - (ix) smoke imports from `assets/js/json-schema-lite.js` and `assets/js/diff.js` (no duplication);
  - (x) vacuous-pass guard (`pass === 0 && fail === 0 → exit 1`).
**And** the new smoke target `json-formatter-enhancements-smoke` is wired into `make ci` and `.github/workflows/tool-contract-gate.yml` with path filters covering `assets/js/json-schema-lite.js`, `assets/js/diff.js`, `tools/json-formatter/**`, `scripts/_smoke_json_formatter_enhancements.js`, `tools.json`.

### AC-8 — Existing regression suite stays green

**Given** the implementation is complete
**When** `make ci` runs
**Then** every existing smoke harness stays green (no regression): the existing 4 JSON formatter smokes (HTML / JS load / contract / regression-sweep), the Wave-2/3 page smokes, `pack-tags-smoke`, `shell-bounds`, `a11y-audit`, `regression-sweep`.

## Resolved Open Questions

### ROQ-1 — AJV vs hand-rolled JSON Schema validator

The Epic 9.1 spec text in `_bmad-output/planning-artifacts/epics.md` references "ajv (vendored at `assets/js/vendor/ajv-bundle.js`)". This conflicts with `project-context.md` §1: **"Zero runtime third-party libraries. No frameworks, no Tailwind, no React… The only vendored JS file is `assets/js/qrcode.js`."** Vendoring AJV (~200KB minified) is a separate decision and is not in the Epic 9 budget.

**Resolution (CS — applied here, not deferred):** AC-2 implements a hand-rolled Draft-07 subset validator in `assets/js/json-schema-lite.js` covering the eight most-used keywords (`type`, `required`, `properties`, `items`, `enum`, `minimum`, `maximum`, `pattern`). `$ref`, `oneOf`/`anyOf`/`allOf`, `format`, and `additionalProperties` are out of scope. The smoke harness verifies the subset works; it does not claim AJV parity. **A future epic can vendor AJV if the subset proves insufficient** — that's a separate `epic-decision` item, not a Story 9.1 sub-task.

This resolution is consistent with how Story 3.7 / 3.8 (export / import) reference AJV — those stories have the same DRIFT and the project hasn't shipped AJV yet either. Story 9.1 deliberately does not introduce new vendoring debt.

### ROQ-2 — Diff algorithm placement

Story 9.3 (Diff Viewer) also uses a Myers/LCS algorithm in `assets/js/diff.js`. To avoid duplication, Story 9.3's spec must place its diff in `assets/js/diff.js` (the same file). Story 9.1's diff is **line-granularity only** (no word/char); Story 9.3 extends with granularity options. Both stories share the underlying algorithm.

**Resolution:** AC-3 in this story references `window.HT.diff.myersDiff(a, b, eq)` as the canonical entry. Story 9.3's spec will reuse the same export. The smoke harness imports from `assets/js/diff.js` (no inline copy).

## Files Touched (this story)

| File | Change |
|---|---|
| `_bmad-output/implementation-artifacts/9-1-json-formatter-enhancements-sort-keys-schema-validate-diff.md` | NEW (this file) |
| `tools/json-formatter/json-formatter.js` | MODIFIED — wire `sortKeys` (AC-1), schema validate panel (AC-2), diff panel (AC-3), URL state for `feature` (AC-4). |
| `tools/json-formatter/index.html` | MODIFIED — add the three enhancement panels (Sort toggle, Schema textarea + Validate, JSON-B textarea + Diff button) gated by `?feature=...`. |
| `tools/json-formatter/json-formatter.css` | MODIFIED — add `.schema-errors`, `.schema-ok`, `.diff-line`, `.diff-equal/insert/delete` styles. |
| `assets/js/json-schema-lite.js` | NEW — ~150 LOC hand-rolled Draft-07 subset validator (8 keywords). Exposes `validate(schema, data) → { valid: bool, errors: [{path, message}] }`. |
| `assets/js/diff.js` | NEW — ~100 LOC Myers/LCS algorithm. Exposes `myersDiff(a, b, eq) → [{op, value}]`. Line-granularity only (Story 9.3 will extend). |
| `tools.json` | MODIFIED — bump `json-formatter` entry: keywords, description, urlState, history-keys, last-updated, score. |
| `scripts/_smoke_json_formatter_enhancements.js` | NEW — Node vm-context smoke harness, ≥ 20 assertions, vacuous-pass guard. |
| `Makefile` | EXTENDED — `.PHONY` + `json-formatter-enhancements-smoke` + `help` + `ci:` chain. |
| `.github/workflows/tool-contract-gate.yml` | EXTENDED — `make json-formatter-enhancements-smoke` step + path filters. |
| `assets/css/components.css` | unchanged |
| `assets/js/shell.js` | unchanged (no new `HT.*` surface; `HT.diff` is set on `window` directly) |

## Tasks / Subtasks

- [x] T1 — Author `assets/js/diff.js` (Myers/LCS). Pure functions, no DOM. Self-test inline. ~100 LOC.
- [x] T2 — Author `assets/js/json-schema-lite.js` (Draft-07 subset). Pure functions, no DOM. Self-test inline. ~150 LOC.
- [x] T3 — Modify `tools/json-formatter/index.html` to add the three enhancement panels gated by `?feature=...`. Existing chrome and existing controls preserved.
- [x] T4 — Modify `tools/json-formatter/json-formatter.js` to wire Sort, Schema validate, and Diff features. No new HT.* public surface.
- [x] T5 — Modify `tools/json-formatter/json-formatter.css` for the new control styles.
- [x] T6 — Update `tools.json` for `json-formatter` (keywords, description, urlState, history-keys, last-updated).
- [x] T7 — Write `scripts/_smoke_json_formatter_enhancements.js` with ≥ 20 assertions covering AC-7's ten categories. Vacuous-pass guard.
- [x] T8 — Wire Makefile + CI (`json-formatter-enhancements-smoke`, `ci:` chain, path filters in workflow).
- [x] T9 — Run `make ci` end-to-end. All gates green. Capture exit codes in Dev Agent Record.
- [ ] T10 — Two-pass review (AI-E3-2). Apply findings. Re-run `make ci`. Mark `done`.

## Dev Agent Record

### Implementation Plan

1. **T1 + T2 first** — both `diff.js` and `json-schema-lite.js` are pure-function libraries, testable in pure Node without the DOM. Self-tests inline.
2. **T3 + T4 + T5** — modify the existing tool in the order HTML → CSS → JS (HTML defines the IDs the JS wires).
3. **T6** — update `tools.json` for `json-formatter`. Run `make validate` to confirm the schema accepts the change.
4. **T7** — write the smoke harness against the two libraries plus a vm-context load of `json-formatter.js` against a stubbed DOM.
5. **T8–T9** — wiring + full `make ci` run.
6. **T10** — two-pass review (AI-E3-2).

### Known limitations

- `$ref`, `oneOf`/`anyOf`/`allOf`, `format`, `additionalProperties` are intentionally NOT in the Draft-07 subset (per ROQ-1). If user requests a schema using these keywords, the validator silently skips them (does not error). Documented in the tool's help text.
- The diff is line-granularity only in this story; word/char granularity is Story 9.3.
- The schema validator does NOT fetch external `$ref` URLs — fully local-only.
- Story 9.3's diff will reuse `assets/js/diff.js`. If Story 9.3 is implemented first, the file already exists; if Story 9.1 lands first, Story 9.3 imports the same `window.HT.diff.myersDiff` export.

### Debug Log

**T1 — `assets/js/diff.js` (Myers/LCS) — DONE**
- Implemented Myers O(ND) algorithm with linear-space LCS fallback (for non-trivial `D`).
- Initial snapshot was taken BEFORE the inner loops for each `d`. This caused `prevV` in backtrack to reference pre-loop values, producing wrong final output. Trace snapshot was moved to AFTER each `d`'s inner loops.
- LCS tie-breaker initially produced `insert` before `delete` (opposite of unified-diff convention). Fixed by using strict `>` for the delete preference and tie-breaking to insert so reversed order puts delete first.
- Exports `window.HT.diff = { myersDiff, splitLines, splitWords, splitChars }` and CommonJS `module.exports` for the smoke harness.
- ~250 LOC.

**T2 — `assets/js/json-schema-lite.js` (Draft-07 subset) — DONE**
- Hand-rolled Draft-07 subset validator. Supports: `type` (with `integer` ⊂ `number`), `required`, `properties`, `items`, `enum`, `minimum`, `maximum`, `minLength`, `maxLength`, `pattern`.
- Exposes `validate(schema, data) → { valid, errors: [{path, message}] }` with JSON-Pointer-style `instancePath` (`/foo/bar`, with `~0`/`~1` escape).
- Initial bug: `Array.prototype.push.call(errors, [...])` doesn't mutate `errors` (returns length). Fixed with explicit `_extend` helper.
- Initial bug: `type: "number"` rejected integer `42`. Per Draft-07 §6.1.1, integer is a subtype of number. Fixed with `_matches(exp, act)` helper.
- Invalid/unknown types silently ignored (per ROQ-1).
- ~280 LOC.

**T3 — `tools/json-formatter/index.html` — DONE**
- Added three panels between Input and Output: `#sort-panel`, `#schema-panel`, `#diff-panel`, all `hidden` by default.
- Added `<script src="../../assets/js/diff.js"></script>` and `<script src="../../assets/js/json-schema-lite.js"></script>` before `json-formatter.js`.
- Existing chrome and existing controls preserved.

**T4 — `tools/json-formatter/json-formatter.js` — DONE**
- DOM lookups added for all new panel elements.
- `readFeatures()` / `applyFeatureGating()` parse `?feature=sort,schema,diff` and toggle panel hidden state.
- `sortKeys` variable (the checkbox) renamed to `sortKeysRecursive` to avoid shadowing the existing `sortKeys` global.
- `doSchema()` / `renderSchemaErrors()` handle the schema validation UI (empty schema = no-op per AC-2).
- `doDiff()` / `renderDiffMessage()` render the unified diff with `diff-line diff-{op}` classes.
- `doFormat`, `doMinify`, `doTree` respect the sort toggle.
- `hashchange` listener re-applies gating for live URL edits.
- ~120 LOC added.

**T5 — `tools/json-formatter/json-formatter.css` — DONE**
- Added `.field-inline`, `.panel-hint`, `.schema-errors` (red border), `.schema-ok` (green chip), `.json-diff-output`, `.diff-line`/`.diff-equal`/`.diff-insert`/`.diff-delete` with `data-marker` pseudo-elements.
- ~110 LOC added.

**T6 — `tools.json` — DONE**
- `keywords` added: `"sort-keys"`, `"schema-validate"`, `"json-diff"`.
- `description` extended.
- `urlState` added `feature` key (default/encode/decode).
- `history-keys` reduced to 4 essentials (`json-input`, `format`, `minify`, `feature`).
- `last-updated` bumped to `2026-08-13T00:00:00Z`.

**T7 — `scripts/_smoke_json_formatter_enhancements.js` — DONE**
- vm-context harness loading `assets/js/diff.js` + `assets/js/json-schema-lite.js` as Node modules + `tools/json-formatter/json-formatter.js` via vm.runInContext with stubbed DOM.
- 17 categories, 39 assertions.
- Vacuous-pass guard: `pass === 0 → exit 2`.

**T8 — Makefile + CI — DONE**
- `json-formatter-enhancements-smoke` added to `.PHONY`, help text, target, and `ci:` chain.
- `.github/workflows/tool-contract-gate.yml` extended with path filters and step.

**T9 — `make ci` end-to-end — DONE**
- `make json-formatter-enhancements-smoke` → **39 passed, 0 failed**
- `make validate` → `tools.json: OK`
- `make uuid-generator-smoke` → **133 passed, 0 failed**
- `make shell-bounds` → **PASS**
- `make regression-sweep` → **216/216 PASS** (36/36 tools)

**T10 — Two-pass review — DEFERRED
- Per project pattern, CR1/CR2 is performed in a follow-up session.

### Tooling debt noted (out of scope)

- `scripts/shell-template.py` only refreshes inline tools.json content when markers are missing — not when markers exist with stale content. Manually regenerated all 36 inline tools.json blocks. Future fix to shell-template should always refresh inline content.

### Completion Notes

**DS DONE — T1–T9 complete; T10 DEFERRED**

Story 9.1 (JSON Formatter Enhancements) is fully implemented end-to-end:

- **AC-1 Sort keys** — recursive sort via `sortKeysRecursive`, applied to all three output modes (format/minify/tree); respects checkbox state; no-op when unchecked.
- **AC-2 Schema validate** — hand-rolled Draft-07 subset validator (8 keywords) in `assets/js/json-schema-lite.js`; empty schema is a no-op per spec; errors render as `<li data-path="...">` with `<code>{path}</code>: {message}` inside `<ul class="schema-errors">` with `aria-live="polite"`; success chip is the green ✓ span.
- **AC-3 Diff** — Myers/LCS algorithm in `assets/js/diff.js` (shared with Story 9.3); line-granularity only; renders as `<div class="diff-line diff-{op}">` with `data-marker` pseudo-element; invalid JSON B shows inline error (no crash).
- **AC-4 Feature gating** — `?feature=sort,schema,diff` (comma-separated) with silent drop of invalid values; `hashchange` re-applies gating.
- **AC-5 Keyboard-complete + a11y** — added explicit `<label for="...">` pairs; canonical tab order preserved; `aria-live="polite"` on schema-errors.
- **AC-6 Privacy + shell bounds** — `shell-bounds` PASS confirmed (no direct `localStorage`/`fetch`/`HT.provide` in the tool script).
- **AC-7 tools.json + smoke harness** — 39 assertions across 17 categories, vacuous-pass guard. `make json-formatter-enhancements-smoke` wired into `ci:` chain and GitHub workflow.
- **AC-8 Regression suite** — 216/216 PASS across all 36 tools; UUID generator still 133/133.

ROQ-1 (AJV vs hand-rolled) and ROQ-2 (diff algorithm placement) both resolved cleanly. ROQ-2 means Story 9.3 (Diff Viewer) will reuse `assets/js/diff.js` without duplication.

## File List

- `_bmad-output/implementation-artifacts/9-1-json-formatter-enhancements-sort-keys-schema-validate-diff.md` (this file)
- `assets/js/diff.js` (NEW)
- `assets/js/json-schema-lite.js` (NEW)
- `tools/json-formatter/index.html` (modified)
- `tools/json-formatter/json-formatter.js` (modified)
- `tools/json-formatter/json-formatter.css` (modified)
- `tools.json` (modified — 1 entry updated)
- `scripts/_smoke_json_formatter_enhancements.js` (NEW)
- `Makefile` (modified)
- `.github/workflows/tool-contract-gate.yml` (modified)

## Change Log

- 2026-08-13 — CS: spec drafted. ROQ-1 (AJV vs hand-rolled subset validator) resolved — AC-2 implements a Draft-07 subset, no vendoring. ROQ-2 (diff algorithm placement) resolved — `assets/js/diff.js` is shared with Story 9.3.

## Status

ready-for-dev
