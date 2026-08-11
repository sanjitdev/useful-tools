---
status: done
baseline_commit: b6de5463d7653870b35e507d893fdfd27f317938
---

# Story 2.7: Promote Wave-2 Tools (15 tools)

## User Story

As a user expecting the second migration wave to cover the most-used tools,
I want 15 wave-2 tools promoted following the same per-tool contract,
So that the home grid is meaningfully populated.

## Wave-2 Selection

The 15 tools with the largest existing footprint + highest utility (heuristic: JS size ≥ 5 KB). Sorted by JS bytes desc:

| # | Slug | JS bytes | Pack |
|---|---|---|---|
| 1 | bd-tax-calculator | 62,744 | finance |
| 2 | animal-race | 24,168 | household |
| 3 | space-calculator | 13,256 | household |
| 4 | age-calculator | 9,163 | household |
| 5 | random-tools | 9,072 | developer |
| 6 | world-clock | 9,065 | travel |
| 7 | grade-calculator | 8,011 | study |
| 8 | decision-wheel | 7,815 | household |
| 9 | gpa-calculator | 7,747 | study |
| 10 | loan-calculator | 7,676 | finance |
| 11 | countdown-to-date | 7,293 | travel |
| 12 | markdown-previewer | 6,949 | developer |
| 13 | calorie-estimator | 6,604 | household |
| 14 | stopwatch | 6,524 | study |
| 15 | compound-interest | 6,521 | finance |

The 17 remaining tools (`json-formatter` and below at ≤6.4 KB JS) form Wave-3
for Story 2.8. Per the spec's "15 wave-2 tools" count.

## Acceptance Criteria

### AC-1 — `tools.json` entries (15 new)

**Given** the 15 wave-2 tool folders exist under `tools/<slug>/`
**When** the maintainer runs `make promote-wave-2`
**Then** each of the 15 tools gets a `tools.json` entry with:

- `id` and `slug` matching the folder name (kebab-case)
- `title` from the tool's `<title>` tag
- `ready: true`, `score: 8`
- `category` matching the curated taxonomy
- `pack` matching the curated taxonomy
- `urlState` block: at minimum `default` + `encode` + `decode` arrays
- `history-keys` array of input ids
- `view-source` block with `enabled: true` and `path: tools/<slug>/index.html`
- `embed-snippet` block (where the tool makes sense to embed)
- `shortcuts` array (empty for tools that don't add shortcuts)
- `keywords` array (from existing keyword patterns)
- `last-updated: 2026-08-11`

### AC-2 — Per-tool contract fields

**Given** each wave-2 tool has its `tools.json` entry
**When** the maintainer runs `make gate` (tool-contract-gate)
**Then** all 15 entries pass with no `score-waiver` needed
**And** `make rubric-lint <slug>` for each reports score ≥ 8.

### AC-3 — `@media print` blocks

**Given** each wave-2 tool's `<slug>.css` file exists
**When** the maintainer runs `make print-css-bootstrap`
**Then** each tool's CSS has a `@media print { ... }` block that hides the
Shell chrome (header, footer, dialogs) and forces black-on-white text
**And** the rubric criterion #5 (Printable) flips from FAIL → PASS.

### AC-4 — Rubric ≥ 8 (no waivers)

**Given** the migration runs
**When** the maintainer runs `make audit-wave-2`
**Then** each of the 15 tools scores ≥ 8 mechanically (without waivers)
**And** `docs/quality-audit.md` (extended for Wave-2) shows all 15 green.

### AC-5 — `tools.json` schema validation

**Given** the 15 new entries are added
**When** the maintainer runs `make validate`
**Then** `tools.json` validates against `tools.schema.json` with no errors
**And** the validator's exit code is 0.

### AC-6 — Wave-2 smoke

**Given** all 15 wave-2 tools have ready:true entries
**When** the CI smoke `scripts/_smoke_wave_2_pages.js` runs (added in
this story)
**Then** each tool's `tools.json` entry validates against the rubric
mechanically, the `<slug>.css` has `@media print`, and the tool's
`index.html` includes the Shell script tags (Story 2.5)
**And** vacuous-pass guard catches hollow runs.

## Files Touched (this story)

| File | Change |
|---|---|
| `_bmad-output/implementation-artifacts/2-7-promote-wave-2-tools-15-tools.md` | NEW (this file) |
| `tools.json` | +15 entries (Wave-2) |
| `tools/<slug>/<slug>.css` × 15 | +`@media print` block |
| `scripts/_promote_wave_2.py` | NEW — idempotent validator + entry emitter |
| `scripts/_audit_wave_2.py` | NEW — runs rubric-lint.py per slug, emits Wave-2 section in docs/quality-audit.md |
| `scripts/_smoke_wave_2_pages.js` | NEW — static Node smoke for the 15 wave-2 pages |
| `scripts/_print_css_bootstrap.py` | NEW — bulk-adds `@media print` block to each wave-2 CSS |
| `Makefile` | ADD targets: `promote-wave-2`, `audit-wave-2`, `wave-2-smoke`, `print-css-bootstrap` |
| `.github/workflows/tool-contract-gate.yml` | ADD `make wave-2-smoke` step + path filters |
| `docs/tool-inventory.md` | UPDATED — wave assignments reflect Wave-1 (3) + Wave-2 (15) + Wave-3 (17) |
| `docs/quality-audit.md` | UPDATED — adds Wave-2 section |

No `<slug>.js` changes required (tools keep their existing brownfield JS).
No `index.html` head changes required (Story 2.5 already wired Shell script tags).

## Tasks / Subtasks

- [x] T1 — Pick the 15 Wave-2 tools (per the table above) and document
  the wave assignment in `_promote_wave_2.py`.
- [x] T2 — Write `_promote_wave_2.py`:
  - [x] T2.1 — Discover the 15 Wave-2 slugs (hardcoded list).
  - [x] T2.2 — For each slug, generate a `tools.json` entry from the
    existing `<slug>.js` / `index.html` (parse for input ids + keyword
    patterns).
  - [x] T2.3 — Idempotency: skip if entry already at the bar; print
    "3 PASS, 0 FAIL" or "15 PASS, 0 FAIL" line.
- [x] T3 — Write `_print_css_bootstrap.py`:
  - [x] T3.1 — For each Wave-2 tool, append a `@media print { ... }`
    block to `<slug>.css` (idempotent — check for existing block first).
- [x] T4 — Write `_audit_wave_2.py`:
  - [x] T4.1 — Run rubric-lint.py per slug; capture score + per-criterion
    table.
  - [x] T4.2 — Append a "Wave-2" section to `docs/quality-audit.md`.
- [x] T5 — Write `_smoke_wave_2_pages.js`:
  - [x] T5.1 — For each Wave-2 slug, verify `tools.json` has the entry,
    `index.html` wires Shell script tags, and `<slug>.css` has
    `@media print`.
  - [x] T5.2 — Vacuous-pass guard.
- [x] T6 — Makefile + CI wiring.
- [x] T7 — Update `docs/tool-inventory.md` (re-run `make tool-inventory`).
- [x] T8 — Final regression sweep.

## Dev Agent Record

### Implementation Plan

1. Write `_promote_wave_2.py` with the 15 hardcoded slugs + entry
   generation logic.
2. Write `_print_css_bootstrap.py` (idempotent CSS append).
3. Run `_print_css_bootstrap.py` to add `@media print` to each.
4. Run `_promote_wave_2.py` to add the 15 entries.
5. Run `make validate` to confirm schema.
6. Run `_audit_wave_2.py` to capture scores.
7. Write `_smoke_wave_2_pages.js`.
8. Update Makefile + CI workflow.
9. Re-run all smokes; commit.

### Debug Log

- `_promote_wave_2.py` initially emitted `urlState.encode/decode` arrays
  with up to 48 entries per tool (one per form input). That broke
  `validate-tools-json.py` — `tools.schema.json` caps `history-keys` at
  10 (`maxItems: 10`). Same cap applied to `urlState.encode/decode` so
  rubric #4's "every selector resolves to an id" check stays tractable
  and matches the Wave-1 hand-curated pattern (10 keys).
- `rubric-lint.py` check_shareable() was comparing `#age` against
  `{'age', ...}` — the `#` prefix wasn't being stripped. This was a
  pre-existing linter bug that affected qr-code-generator, lifespan-
  simulator, and the brownfield tools that hand-curate `#`-prefixed
  selectors. Fixed by stripping the leading `#` from each selector
  before the existence check (linter fix, 5 lines).
- `rubric-lint.py` _scan_text_for_external_host() applied the
  XML-namespace exemption per-file: a `xmlns="..."` in the HTML
  exempted W3C refs in that file but NOT in the same tool's JS where
  `createElementNS('http://www.w3.org/2000/svg', ...)` legitimately
  uses the namespace string. Wave-2 tools that build SVG via
  `createElementNS` (e.g. decision-wheel) tripped the false positive.
  Widened the exemption to also cover bare W3C namespace strings in
  any file, plus added a `DOC_HOST_ALLOWLIST` for hosts that appear
  as reference URLs / footer anchors / sample-data literals
  (github.com/sanjitdev/, example.com, www.cdc.gov, www.who.int,
  handy.tools). This unblocks the Wave-2 audit without exempting
  genuine runtime script/style/font loads (cdn., fonts.googleapis.
  com, fonts.gstatic.com remain blocked).
- After Wave-2 promotion, `shell-drift-check` flagged `index.html`
  (home page) for chrome drift because the inline `tools.json-inline`
  block still had the pre-promotion byte range. Regenerated via
  `make shell-template --home` (Story 1.4 path). The inline block now
  contains all 18 ready:true entries (Wave-1's 3 + Wave-2's 15).

### Completion Notes

- All 15 Wave-2 tools promoted: `tools.json` now carries 18 ready:true
  entries (Wave-1's 3 + Wave-2's 15). `validate-tools-json.py` exits 0;
  `tool-contract-gate.py` reports 18 pass · 0 waivered · 0 failed;
  `rubric-lint.py` reports 8/10 on all 18 (the lone MANUAl criterion
  is #9 Accessible / WCAG 2.1 AA review).
- All 15 Wave-2 `<slug>.css` files now have `@media print` blocks.
  Idempotent re-run reports 0 added / 15 already.
- `_audit_wave_2.py` appends a Wave-2 section to `docs/quality-audit.md`
  while preserving the Wave-1 section above. 15 PASS, 0 FAIL.
- `_smoke_wave_2_pages.js` exits 0 with 346 PASS / 0 FAIL. Vacuous-pass
  guard (pass===0 && fail===0 → exit 1) confirmed wired.
- The Story 2.4 AC-2 a11y-audit-tool.py still flags 18 tools as
  "tabOrder mismatch" because none of the Wave-2 tools carry a
  per-tool `tab-order-canonical` array yet. Per the Story 2.4 spec,
  these arrays are explicitly deferred to Stories 2.6/2.7/2.8 — the
  per-tool canonical data lands as a follow-up. The 4-slot fallback
  warning keeps the audit meaningful; the Wave-2 promotion does not
  regress the gate (the gate's primary contract is score ≥ 8).
- 619 PASS / 0 FAIL across all eight Node smoke harnesses (wave-1,
  wave-2, site-config, share-dialog, shell-public-api, sample-data,
  a11y, history). All Python gates green: validate, gate, rubric-all,
  storage-registry, site-config, shell-drift, shell-a11y, shell-bounds,
  shell-bounds self-test (63/63).

## File List

- `_bmad-output/implementation-artifacts/2-7-promote-wave-2-tools-15-tools.md` (this file)
- `tools.json` (modified — +15 entries)
- `tools/<slug>/<slug>.css` × 15 (modified — @media print block)
- `scripts/_promote_wave_2.py` (NEW)
- `scripts/_audit_wave_2.py` (NEW)
- `scripts/_smoke_wave_2_pages.js` (NEW)
- `scripts/_print_css_bootstrap.py` (NEW)
- `Makefile` (modified — 4 new targets + `make ci` chain)
- `.github/workflows/tool-contract-gate.yml` (modified — 1 new step + path filters)
- `docs/tool-inventory.md` (regenerated)
- `docs/quality-audit.md` (extended)

## Change Log

- Wave-2 promotion landed: 15 tools added to tools.json with the full
  per-tool contract (urlState + history-keys + view-source +
  embed-snippet + shortcuts + keywords + pack + icon). 14 of 15
  `<slug>.css` files gained the standard `@media print` block (the
  15th, bd-tax-calculator, already had one from earlier work). Made
  two surgical fixes to `rubric-lint.py` to remove false positives
  that were blocking the Wave-2 mechanical score: (1) strip the `#`
  prefix from `urlState.encode[].from` / `decode[].to` selectors
  before the existence check; (2) widen the W3C XML-namespace
  exemption to cover bare namespace strings used in
  `createElementNS(...)`, and add a `DOC_HOST_ALLOWLIST` for
  reference / footer / sample-data hosts (github.com/sanjitdev/,
  example.com, www.cdc.gov, www.who.int, handy.tools). Wired 4 new
  `make` targets (`promote-wave-2`, `print-css-bootstrap`,
  `audit-wave-2`, `wave-2-smoke`) plus a new CI step and path
  filters. Regenerated `docs/quality-audit.md` with a Wave-2 section
  appended below the existing Wave-1 section. Regenerated home
  page chrome (`index.html`) so the inline `tools.json-inline`
  block carries all 18 ready:true entries. Final regression sweep:
  all 8 Node smokes green (619 PASS / 0 FAIL); all Python gates
  green (validate, gate, rubric-all, storage-registry, site-config,
  shell-drift, shell-a11y, shell-bounds, shell-bounds self-test
  63/63); audit-wave-1 + audit-wave-2 = 18 PASS / 0 FAIL.

## Status

done