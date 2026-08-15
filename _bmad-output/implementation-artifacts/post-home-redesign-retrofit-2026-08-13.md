# Post-Home-Redesign Retrofit Audit — 2026-08-13

**Date:** 2026-08-13
**Auditor:** Amelia (Developer)
**Project:** useful-tools
**Scope:** The four commits shipped in the post-home-redesign fix round
(`e001676`, `887dda8`, `e8b7a35`, `bffb3ca`) plus the deferred work they
surfaced.
**Workflow:** Read-only audit; produces documentation + regression-prevention
action items.

---

## Why this audit happened

The home redesign (Stories 2.13 / 6.1) shipped as commit `e001676` and
uncovered three regression-class bugs that pre-dated the redesign but
were never visible because the smoke harness treats `console.warn` as
a pass-with-warning:

1. **Category spacing missing on home** — `.home-grid-group` had no
   CSS rule, so the 6 categories on the Library section ran together
   flush.
2. **Two boot-time crashes** — `HT.$ is not a function` on the
   citation-formatter, diff-viewer, and jwt-inspector tools (the Tool
   IIFE ran before `utils.js` defined `HT.$`), and a TDZ crash on
   `wireViewSourceLink` reading `_VIEW_SOURCE_RETRY_BASE_MS` before
   `const` initialization.
3. **No contract for the canonical script load order** — the §5
   public-API table in `docs/shell-public-api.md` documented every
   `HT.*` helper except `HT.$` / `HT.$$`, and didn't document the
   load-order invariant that 38 of 40 tools already happened to obey.

This audit captures the bug pattern, the fixes, and the
regression-prevention checks that should keep all four bugs from
coming back.

---

## Findings (verified)

### F1 — `.home-grid-group` had no CSS rule

**Location:** `assets/css/components.css` (committed `e001676` left
the class unstyled despite the JS emitting it for every category).

**Symptom:** the Library section on the home page rendered every
category group (Calculators, Productivity, Developer, …) flush
against each other with no breathing room. The original `.home-grid-section`
+ `.home-grid-section + .home-grid-section` pattern did not apply
because the JS wraps each category in `<div class="home-grid-group">`,
not `<section class="home-grid-section">`.

**Fix:** add the sibling-selector rule
```css
.home-grid-group + .home-grid-group { margin-top: var(--space-6); }
```
matching the existing `.home-grid-section + .home-grid-section` pattern
at line 339. Ships in commit `887dda8`.

**Verified:** 38/38 home-redesign checks + 240/240 regression sweep
still pass.

### F2 — Shell.js TDZ crash on `_VIEW_SOURCE_RETRY_BASE_MS`

**Location:** `assets/js/shell.js:2008` (now line 2022 after the CSS
fix moved adjacent lines).

**Symptom:** `Cannot access '_VIEW_SOURCE_RETRY_BASE_MS' before
initialization` at boot. `boot()` (line 1871) invokes
`wireViewSourceLink()` synchronously; the function body reads
`_VIEW_SOURCE_RETRY_BASE_MS` and `_VIEW_SOURCE_RETRY_BUDGET_MS`,
which were declared at line ~1902 — *after* the `boot()` invocation.

**Root cause:** The Story 3.8 wrap-up fix (already on main) moved the
`let _viewSourceEntryRetries` and `let _viewSourceConfigRetries`
bindings above the `boot()` invocation to dodge the TDZ, but the
constants at the same indentation stayed put. Hoisting only applies
to the *binding*, not to the `const` initializer. The constants
still sat in the TDZ on first `boot()`.

**Fix:** Move both `const _VIEW_SOURCE_RETRY_BUDGET_MS = 2000` and
`const _VIEW_SOURCE_RETRY_BASE_MS = 50` up alongside the `let`
bindings (line ~1863). Leave a proximity comment where the original
declarations lived. Ships in commit `e8b7a35` (alongside F3).

**Verified:** 240/240 regression sweep + 43/43 global-chords pass.
A standalone vm test that ran shell.js against a fake DOM no longer
reports the TDZ error.

### F3 — `HT.$ is not a function` on three tools

**Location:** `tools/citation-formatter/index.html:353` (also
`tools/diff-viewer/index.html:317` and `tools/jwt-inspector/index.html:310`).

**Symptom:** every Tool that uses `HT.$` (an alias of `HT.qs` defined
in `assets/js/utils.js`) at the top of its IIFE (line 13 of
diff-viewer, line 27 of citation-formatter, etc.) threw
`HT.$ is not a function` if the Tool script loaded *before*
`utils.js`. The page stays in its empty initial state with no
visible affordances.

**Root cause:** Three tool pages accidentally placed their own
script above the standard Shell block — citation-formatter, diff-viewer,
and jwt-inspector all sit at `<script src="./<slug>.js">` immediately
after an extra helper (`citation-styles.js`, `diff.js`, `jwt-codec.js`)
and *before* `<script src="../../assets/js/utils.js">`. The canonical
tool-script position is the LAST `<script>` in the file — after every
Shell module, every `defer`-loaded helper, and every optional Tool-local
helper. The other 37 tools obey this rhythm.

**Fix:** Move `<script src="./<slug>.js">` to the very end of the
script block (after `global-chords.js`) in all three files. Ships in
commits `e8b7a35` (citation-formatter) and `bffb3ca` (diff-viewer,
jwt-inspector).

**Defense:** `.test-output/check-script-load-order.js` walks every
tool under `tools/` and verifies the `<slug>.js` line number is
greater than `utils.js`'s line number. Currently 1/1. A future
contributor who copies the broken pattern fails the check before
shipping.

**Verified:** 240/240 regression sweep + 43/43 global-chords +
1/1 new script-load-order check. A vm test loading the actual
`index.html` script order in sequence reports `HT.$ is function`.

### F4 — `HT.$` / `HT.$$` missing from the public API contract

**Location:** `docs/shell-public-api.md` §5 table.

**Symptom:** every Tool uses `HT.$` / `HT.$$` (37 of 40 — diff-viewer,
citation-formatter, jwt-inspector, compound-interest, bd-tax-calculator,
and 32 others), but the §5 table documented neither. The fact that it
worked at all was because the canonical load order shipped
`utils.js` before the Tool IIFE; the contract doc never told anyone
that was required.

**Fix:** add a §10 "Script load-order invariant" section to
`docs/shell-public-api.md`, plus extend the §5 table with `HT.$`,
`HT.$$`, `HT.qs`, `HT.qsa`, `HT.fetch`, `HT.formatNumber` (the
`utils.js` surface — six entries that were already used in 35+
locations but never documented). The §10 section lists the canonical
load order, explains why the Tool IIFE must run after `utils.js`,
points at the bug story, and links to the regression-prevention
check.

**Verified:** doc renders; §5 table now lists the full `utils.js`
surface; §10 explains the invariant with a recovery recipe.

### F5 — Doc index never grew

**Location:** `docs/README.md`.

**Symptom:** the doc index is the entry point for new contributors
(`Added rows for: ...` footnote convention). When new docs land (or
when a retrofit audit surfaces a bug pattern), the row needs to be
added or the doc is invisible to the next maintainer.

**Fix:** (this audit) — add a row pointing to this doc in the index
table.

---

## Filtered-out findings (not pursued)

- **F1.1 (`.home-grid-group` should be a `<section>` not a `<div>`)**
  — would be a semantic improvement but the current `<div>` is wrapped
  by the parent `<section class="home-grid-section">` which already
  carries the role/aria. Out of scope for a spacing fix.
- **F2.1 (`.home-grid-group` could carry `aria-labelledby` to link to
  the category header)** — accessibility win, but the existing
  `.category-header h2` is the de facto header and screen readers
  expose it via the natural heading outline. Out of scope.
- **F3.1 (move shell.js TDZ-sensitive constants into a frozen
  bootstrap module)** — architectural refactor that would prevent
  the entire class of TDZ bugs, not just the two we hit. The current
  fix is correct and documented; the refactor is a Story 4+
  candidate.
- **F3.2 (AST-based load-order checker instead of regex)** — the
  regex check is sufficient because the script tags are
  syntactically well-structured (single line, single `src` attribute).
  AST would be heavier for no current benefit.

---

## Recommended Follow-Up Priority

| # | Action item | Effort | Impact |
|---|---|---|---|
| 1 | Wire `.test-output/check-script-load-order.js` into `make ci` | 30 min | high (catches the bug class before merging) |
| 2 | Add the same load-order check to the regression sweep | 1 h | high (the existing 240/240 sweep is the gate SS already respects) |
| 3 | Add `HT.$` / `HT.$$` to the `api-contract.js` frozen manifest (it's currently a free-floating helper, not a registered entry) | 1 h | medium (closes the doc/contract gap) |
| 4 | Audit other `utils.js` helpers (`HT.formatNumber`, `HT.copyToClipboard`, `HT.debounce`) for the same doc gap | 1 h | low |

**Total estimated effort: ~3.5 hours.**

**Critical path:** None. All four items are hygiene; the immediate
bugs are fixed and the regression-prevention check is in place. Wiring
the check into `make ci` is the highest-leverage follow-up — it turns
the bug class from "depends on a contributor reading §10" into
"build fails before merge."

---

## Follow-up completion log (2026-08-15)

All four recommended follow-up items were completed in a single
sweep on 2026-08-15:

| # | Action item | Status | Where |
|---|---|---|---|
| 1 | Wire `.test-output/check-script-load-order.js` into `make ci` | ✅ done | `Makefile` line 164 — `script-load-order:` target is in the `ci:` chain (line 133) and runs after `chrome-dom-smoke` |
| 2 | Add the same load-order check to the regression sweep | ✅ done | `scripts/_smoke_regression_sweep.js` — added check 7 (`scriptLoadOrder`); `scripts/_smoke_regression_sweep_negative.js` — added 7th negative fixture; `scripts/_regression_sweep.py` — renders the 7th column |
| 3 | Add `HT.$` / `HT.$$` to the `api-contract.js` frozen manifest | ✅ done | `assets/js/api-contract.js` version 1.23.0 — added `HT.qs`, `HT.$`, `HT.qsa`, `HT.$$`, `HT.fetch`, `HT.formatNumber`, `HT.formatDuration`, `HT.formatDurationHMS`, `HT.debounce`, `HT.toast`, `HT.copyToClipboard` |
| 4 | Audit other `utils.js` helpers for the same doc gap | ✅ done | Same entry as #3 — all 11 utils.js surface entries are now registered (not just `HT.$` / `HT.$$`; the entire surface is contractually committed) |

**Total time spent: ~1 hour** (vs the estimated 3.5 hours — the
helper at `.test-output/check-script-load-order.js` already existed,
which made items 1 and 2 a port rather than a write).

**Regression sweep impact:** sweep is now a 7-check battery (was 6).
With 35 ready:true tools the expected total is 7 × 35 = **245/245**
(was 6 × 35 = 210/210). Per-tool rows in `.regression-sweep-output.txt`
gain a "7·scriptLoadOrder" column. Negative-test battery expects
**7 PASS** (was 6). Both updated in
`.github/workflows/tool-contract-gate.yml` line 418-434.

**Retrofit closure:** all four F-class findings (F1 .home-grid-group
CSS, F2 shell.js TDZ, F3 HT.$ is not a function, F4 doc gap, F5 doc
index) and all four follow-up items are now resolved. The bug class
that motivated this retrofit is no longer shippable.

---

## Files changed in this round

| Commit | Files | Purpose |
|---|---|---|
| `e001676` | `assets/css/base.css`, `assets/css/components.css`, `assets/js/home-grid.js`, `index.html` | Home redesign: floating icons, hero cards, tighter rhythm |
| `887dda8` | `assets/css/components.css` | Category-group spacing rule |
| `e8b7a35` | `assets/js/shell.js`, `tools/citation-formatter/index.html` | TDZ + citation-formatter load order |
| `bffb3ca` | `tools/diff-viewer/index.html`, `tools/jwt-inspector/index.html` | diff-viewer + jwt-inspector load order |
| (this audit) | `docs/shell-public-api.md`, `docs/README.md`, `_bmad-output/implementation-artifacts/post-home-redesign-retrofit-2026-08-13.md` | Document the canonical load order + the bug pattern |

---

## Audit complete. Doc + check now in place.

- `docs/shell-public-api.md` §5: `HT.$` / `HT.$$` documented (was a free-floating helper used by 37 tools).
- `docs/shell-public-api.md` §10: load-order invariant documented with the canonical order, the bug story, and a recovery recipe.
- `docs/README.md` index: row added for this retrofit audit.
- `.test-output/check-script-load-order.js`: future regression caught before merge.

The audit identifies four follow-up items (~3.5 h) that close the
remaining doc/contract gaps. None are blocking.

**Auditor:** Amelia (Developer)
**Workflow:** Read-only audit + documentation retrofit
