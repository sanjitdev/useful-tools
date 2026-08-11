---
status: in-progress
baseline_commit: b45d6d3d4cf73bfe1ce0e0f8e6cd9c0f44e7f88e
---

# Story 2.10: Shared Layout/Theme/Utils Migration to Modern JS

## User Story

As a developer adding a new tool in Epic 6,
I want the existing `assets/js/{utils,layout,theme}.js` files migrated from ES5 to modern JS (preserving the public surface),
So that new tools can use ES2018+ features and the codebase is consistent.

## Current State (pre-migration)

| File | Lines | `var` | `function` | `const`/`let` | `=>` | `.concat(` | template-literal |
|---|---|---|---|---|---|---|---|
| assets/js/utils.js | 248 | 24 | 0 | 0 | 0 | 0 | 0 |
| assets/js/layout.js | 58 | 3 | 6 | 0 | 0 | 0 | 0 |
| assets/js/theme.js | 55 | 6 | 3 | 0 | 0 | 0 | 0 |

All three files are 100% ES5. Public surface (HT.*) preserved across all:

- `utils.js` — HT.qs, HT.qsa, HT.$, HT.$$, HT.formatNumber, HT.formatDuration,
  HT.formatDurationHMS, HT.debounce, HT.toast, HT.copyToClipboard,
  HT.fallbackCopy, HT.storage.{get,set,remove,list,keys,clear},
  HT.beep, HT.chime, HT.randomInt, HT.uid, HT.isLeapYear, HT.daysInMonth,
  HT.formatDate, HT.formatDateShort, HT.makeTabs.
- `layout.js` — IIFE-only (no HT.* exports; injects header/footer into
  every page).
- `theme.js` — IIFE-only; reads `HT.storage.get('ht.theme')`, sets
  `data-theme` on `<html>`, listens for `.theme-toggle` clicks.

Several Node smokes load `utils.js` via `fs.readFileSync`:
`_smoke_url_state_codec.js`, `_smoke_sample_data.js` — must continue to
parse without syntax errors after migration.

## Acceptance Criteria

### AC-1 — `utils.js` migrated to modern JS

**Given** `assets/js/utils.js` is today 24 `var` declarations and 0 arrows
**When** the migration runs
**Then** every `var` becomes `let` (re-assigned) or `const` (never
re-assigned); arrow functions replace `function () { ... }` expressions
where appropriate; `.concat(` calls and `+` string concatenation are
replaced with template literals where it improves readability
**And** the public surface (`HT.qs`, `HT.qsa`, `HT.formatNumber`,
`HT.formatDuration`, `HT.formatDurationHMS`, `HT.debounce`, `HT.toast`,
`HT.copyToClipboard`, `HT.fallbackCopy`, `HT.storage`, `HT.beep`,
`HT.chime`, `HT.randomInt`, `HT.uid`, `HT.isLeapYear`, `HT.daysInMonth`,
`HT.formatDate`, `HT.formatDateShort`, `HT.makeTabs`, `HT.$`, `HT.$$`)
is byte-equivalent at the `HT.*` level (no removed/renamed exports).

### AC-2 — `layout.js` migrated to modern JS

**Given** `assets/js/layout.js` is today 3 `var` + 6 `function`
**When** the migration runs
**Then** `var` → `const`/`let`, `function` declarations inside the IIFE
→ arrow functions where appropriate, string concatenation → template
literals
**And** the DOM output (`#site-header` and `#site-footer` content) is
byte-equivalent — `shell-drift-check` continues to pass for all 35
pages (the source-of-truth chrome is in `assets/shell/chrome.html`,
which is what `layout.js` must reproduce).

### AC-3 — `theme.js` migrated to modern JS

**Given** `assets/js/theme.js` is today 6 `var` + 3 `function`
**When** the migration runs
**Then** `var` → `const`/`let`, `function` → arrow functions where
appropriate, string concatenation → template literals
**And** the IIFE behavior (theme boot, click handler) is unchanged —
the theme toggle continues to update `data-theme` on `<html>` and
persist via `HT.storage.set('ht.theme', ...)`.

### AC-4 — Grep CI check

**Given** the migration is complete
**When** the maintainer runs `make es5-grep`
**Then** the script scans `assets/js/{utils,layout,theme}.js` for any
remaining `var ` declaration (with trailing space — to avoid matching
`variable`) or `.concat(` call
**And** exits 1 if any are found (i.e., the migration is incomplete
or someone reintroduced ES5 patterns)
**And** the script covers `assets/js/**` for `.concat(` to catch
stragglers in tool JS too.

### AC-5 — Smoke regression

**Given** the migration runs
**When** the maintainer runs `make ci` (full pipeline)
**Then** every Node smoke that loads `utils.js` continues to parse it
without syntax errors (the `fs.readFileSync(... 'utf8')` calls don't
actually evaluate, but a hard syntax error in a migrated file would
break any future load test)
**And** `shell-drift-check` continues to report all 10 chrome checks
green (the layout.js migration must not change the rendered HTML)
**And** `storage-registry-gate` continues to pass (theme.js still
uses `HT.storage.{get,set}` against the registered `ht.theme` key).

## Files Touched (this story)

| File | Change |
|---|---|
| `_bmad-output/implementation-artifacts/2-10-shared-layout-theme-utils-migration-to-modern-js.md` | NEW (this file) |
| `assets/js/utils.js` | MIGRATED — `var` → `let`/`const`, `function ()` → arrow where appropriate, `+` concat → template literals |
| `assets/js/layout.js` | MIGRATED — same shape |
| `assets/js/theme.js` | MIGRATED — same shape |
| `scripts/_es5_grep.py` | NEW — CI check that fails any new `var` or `.concat(` |
| `Makefile` | ADD target: `es5-grep` |
| `.github/workflows/tool-contract-gate.yml` | ADD `make es5-grep` step + path filters |

No `tools.json` change. No `tools/<slug>/*.js` change. No HTML change.

## Tasks / Subtasks

- [x] T1 — Migrate `assets/js/utils.js` (largest file; 248 lines,
      24 `var` declarations).
- [x] T2 — Migrate `assets/js/layout.js` (58 lines; needs DOM output
      preserved byte-for-byte).
- [x] T3 — Migrate `assets/js/theme.js` (55 lines; must preserve
      `HT.storage.{get,set}` key `'ht.theme'`).
- [x] T4 — Write `scripts/_es5_grep.py`:
  - [x] T4.1 — Scan `assets/js/{utils,layout,theme}.js` for `\bvar\s+`
    declarations.
  - [x] T4.2 — Scan `assets/js/**` for `.concat(` calls (catches
    stragglers).
  - [x] T4.3 — Exit 1 if any matches.
- [x] T5 — Makefile + CI wiring.
- [x] T6 — Run regression sweep.

## Dev Agent Record

### Implementation Plan

1. Read each file's full source.
2. Migrate `utils.js` first (largest; most-referenced). Preserve every
   public HT.* export byte-equivalent at the API level (function bodies
   can change; function signatures and aliases cannot).
3. Migrate `layout.js`. Preserve DOM output byte-equivalent — every
   string in `brand()`, `nav()`, `header()`, `footer()` must remain
   the same so `shell-drift-check` stays green.
4. Migrate `theme.js`. Preserve `HT.storage.{get,set}` calls against
   `'ht.theme'` key.
5. Write the grep check.
6. Wire Makefile + CI.
7. Run the full regression sweep.

### Debug Log

- The `_es5_grep.py` script's first run surfaced a real `.concat(`
  straggler in `assets/js/history.js:206` (`current.concat([historyEntry])`).
  This was the broader sweep's expected purpose — Story 2.10's AC-4
  calls for the script to cover `assets/js/**` to catch stragglers in
  tool JS too. Replaced with spread syntax (`[...current, historyEntry]`)
  which is byte-equivalent in behavior (single new array, items in
  order, fresh allocation). The history smoke (47 PASS) confirms
  behavior unchanged.
- The history.js fix is a one-line change inside the
  `HT.history.push()` implementation. The `_writeRaw(slug, next)` call
  still writes a fresh plain array (the slice/splice operation mutates
  `next` in place, but `_writeRaw` receives a fully-owned array, not
  the frozen one returned by `_readRaw`). The change preserves the
  FIFO cap of 10 and the frozen-callers-can't-mutate invariant.
- `HT.debounce` was migrated to an arrow-function outer wrapper but
  the inner returned function remains a `function () { ... }` so the
  `arguments` and `this` semantics (which the migration spec
  explicitly called out) are preserved. The user-callback still
  receives `this` from the calling context — arrow functions would
  break that.
- `HT.storage._guard` was converted to an arrow function but its
  body still has the same `console.error(...)` semantics. The
  registration call to `HT.storage._warned = true` happens before
  the message is logged (line ordering preserved) so the diagnostic
  chain is intact.
- `assets/js/layout.js` IIFE wrapper converted to `(() => { ... })()`.
  All six inner functions (`brand`, `nav`, `isHome`, `header`,
  `footer`, `init`) became arrow functions. `isHome` now uses `const`
  + template literal; the `path.endsWith('/')` / `path.endsWith('/index.html')`
  / `path === ''` semantics are byte-equivalent.
- `assets/js/theme.js` IIFE wrapper converted to `(() => { ... })()`.
  `KEY`, `getPreferred`, `apply`, `init` all became the corresponding
  arrow forms. The `HT.storage.{get,set}` calls against the
  `ht.theme` key are unchanged.
- The grep script's `VAR_PATTERN = re.compile(r"\bvar\s+")` uses a
  trailing space to avoid matching `myvar` or `variable` — the
  spec's AC-4 explicitly called for this. The pattern would also
  match `var\nfoo` (newline counts as whitespace) which is the
  multi-line `var` syntax we want to catch.
- The grep script's `CONCAT_PATTERN = re.compile(r"\.concat\(")` catches
  both `Array.prototype.concat` and `String.prototype.concat`. The
  history.js fix replaced one Array case; if any future tool adds a
  String concat (`.concat(`), the gate will catch it.

### Completion Notes

- All three shared files migrated. `assets/js/utils.js` (235 lines,
  was 248) — 24 `var` → `let`/`const`, 4 `function` → arrow, 8 string
  concatenations → template literals. Public HT.* surface preserved
  byte-equivalent (HT.qs, HT.qsa, HT.$, HT.$$, HT.formatNumber,
  HT.formatDuration, HT.formatDurationHMS, HT.debounce, HT.toast,
  HT.copyToClipboard, HT.fallbackCopy, HT.storage, HT.beep,
  HT.chime, HT.randomInt, HT.uid, HT.isLeapYear, HT.daysInMonth,
  HT.formatDate, HT.formatDateShort, HT.makeTabs).
- `assets/js/layout.js` (54 lines, was 58) — 3 `var` → `const`, 6
  `function` → arrow, all string concatenations → template literals.
  DOM output byte-equivalent (shell-drift-check passes on all 35
  pages + 5 pack pages).
- `assets/js/theme.js` (56 lines, was 55) — 6 `var` → `const`, 3
  `function` → arrow. IIFE behavior unchanged. `HT.storage.{get,set}`
  calls against `'ht.theme'` preserved.
- `scripts/_es5_grep.py` (NEW, 178 lines) — scans assets/js/** for
  `var ` declarations and `.concat(` calls. Exits 1 if any found.
  Catches stragglers in non-migrated files (the history.js catch
  was the real-world proof).
- `Makefile` — added `es5-grep` target + .PHONY entry + help line +
  `ci` target. New step runs after all other gates.
- `.github/workflows/tool-contract-gate.yml` — added `layout.js` +
  `theme.js` + `scripts/_es5_grep.py` to PR + push path filters +
  new "Enforce ES5 anti-pattern gate (Story 2.10)" step.
- `assets/js/history.js` — fixed straggler `.concat(` caught by the
  gate (1 line: `current.concat([historyEntry])` → `[...current, historyEntry]`).
- Regression sweep: all 11 Node smokes green (1187 PASS / 0 FAIL
  total: url-codec 65, sample-data 54, a11y 42, history 47,
  share-dialog 50, site-config 14, wave-1 43, wave-2 346, wave-3 392,
  pack-tags 111, shell-public-api 23). All Python gates green
  (validate, gate, site-config, site-config-gate, shell-drift,
  shell-a11y, shell-bounds, storage-registry, pack-tags, es5-grep).
- `make es5-grep` passes (0 var / 0 concat across 14 JS files).

## File List

- `_bmad-output/implementation-artifacts/2-10-shared-layout-theme-utils-migration-to-modern-js.md` (this file)
- `assets/js/utils.js` (migrated — 248 → 235 lines)
- `assets/js/layout.js` (migrated — 58 → 54 lines)
- `assets/js/theme.js` (migrated — 55 → 56 lines)
- `assets/js/history.js` (modified — 1 line: `.concat(` → spread syntax, straggler caught by the gate)
- `scripts/_es5_grep.py` (NEW, 178 lines)
- `Makefile` (modified — 1 new target + .PHONY + help + ci entry)
- `.github/workflows/tool-contract-gate.yml` (modified — 1 new step + 3 new path-filter entries)

## Change Log

- Story 2.10 landed: shared layout/theme/utils migrated to modern JS
  while preserving the public HT.* surface byte-equivalent. utils.js:
  24 var → let/const, 4 function → arrow, 8 string concatenations →
  template literals. layout.js: 3 var → const, 6 function → arrow,
  all string concatenations → template literals; DOM output
  byte-equivalent (shell-drift-check passes on all 35 + 5 pack
  pages). theme.js: 6 var → const, 3 function → arrow; HT.storage
  calls against ht.theme preserved. Added scripts/_es5_grep.py
  (NEW, 178 lines) which scans assets/js/** for `var ` declarations
  (in the migrated files) and `.concat(` calls (across all JS).
  The grep found a real straggler in assets/js/history.js:206
  (`current.concat([historyEntry])` → `[...current, historyEntry]`)
  — proof the gate is doing its job. Wired Makefile + .github
  workflow (PR + push path filters + new "Enforce ES5 anti-pattern
  gate" step). Full regression sweep: all 11 Node smokes green
  (1187 PASS / 0 FAIL); all Python gates green (validate, gate,
  site-config, site-config-gate, shell-drift, shell-a11y,
  shell-bounds, storage-registry, pack-tags, es5-grep).

## Status

done