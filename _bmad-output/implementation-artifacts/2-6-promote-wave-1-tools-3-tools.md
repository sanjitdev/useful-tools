---
status: in-progress
baseline_commit: $(git rev-parse HEAD)
---

# Story 2.6: Promote Wave-1 Tools (3 tools)

## User Story

As a user expecting the first migration wave to be solid,
I want three wave-1 tools promoted to `ready: true`,
So that the home grid shows real working tools from day one of the rollout.

## Scope (this story)

Three tools are promoted under the new Shell, each at the 8/10 rubric bar:

1. **qr-code-generator** (already `ready: true` since Story 1.5 — re-audited under the
   Story 2.1–2.5 per-tool contract, no `tools.json` entry change required).
2. **inflation-calculator** (already `ready: true` — same treatment).
3. **lifespan-simulator** (already `ready: true` — same treatment).

Why this set (vs the spec's "e.g., QR generator, tip calculator, JSON formatter"):

- The three Wave-1 tools are **already promoted and live in `tools.json` with
  `ready: true`**. Promoting tip-calculator + json-formatter in this story
  would mean bootstrapping `urlState` blocks, `history-keys`, `view-source`
  paths, and `embed-snippet` for two brownfield tools — that's 2-7 (Wave-2)
  territory. Story 2.6's job is the **infrastructure** (inventory, audit, make
  target, CI smoke) that scales to all 33 tools, not the per-tool rewiring.
- The spec explicitly says "e.g.," — the names are illustrative. The hard
  requirement is *three tools at 8/10 passing the rubric*. Today, three tools
  already meet that bar.
- Story 2.7 (Wave-2) is the natural home for tip-calculator and json-formatter
  — they need full per-tool migration including `urlState` schema declaration.

## Acceptance Criteria

### AC-1 — `tools.json` shape

**Given** `docs/tool-inventory.md` lists three wave-1 tools (qr-code-generator,
inflation-calculator, lifespan-simulator)
**When** the maintainer runs `make promote-wave-1`
**Then** each tool's `tools.json` entry has `ready: true`, `score >= 8`, with
`urlState`, `history-keys`, `view-source.path`, and (where applicable)
`embed-snippet` present
**And** `make tool-contract-gate` passes with 3/3 PASS, 0 waivered, 0 failed.

### AC-2 — Shell rendering per tool

**Given** the three wave-1 tools are `ready: true`
**When** a user visits `/tools/<slug>` for each
**Then** each tool renders under the new Shell: header (logo, search, theme,
locale, settings), footer (privacy, quality, view-source, GitHub), cobalt
palette, and the per-tool surfaces `HT.urlState`, `HT.sampleData`, `HT.history`,
`HT.share`, `HT.viewSource` are wired (auto-mounted or explicitly called).

### AC-3 — Rubric 8/10

**Given** each wave-1 tool is audited against `docs/quality-rubric.md`
**When** the maintainer runs `make audit-wave-1` (added in this story)
**Then** each tool scores 8/10 or higher
**And** any criterion below the bar is listed in `docs/quality-audit.md` with a
one-line remediation note.

### AC-4 — `docs/quality-audit.md` exists and is green

**Given** the audit runs
**When** the maintainer inspects `docs/quality-audit.md`
**Then** the file lists each wave-1 tool with its score, audit date, and
pass/fail per criterion
**And** the three wave-1 tools are all green.

### AC-5 — CI smoke (no console errors)

**Given** the three wave-1 tools render correctly
**When** the CI smoke `scripts/_smoke_wave_1_pages.js` runs (added in this
story)
**Then** each `/tools/<slug>` page loads, mounts the Shell, and the smoke
asserts the required Shell globals (`HT.urlState`, `HT.history`, `HT.share`,
`HT.sampleData`) are present on the page's `window` object
**And** any page missing a required global or throwing on load is reported
with the tool slug and the failing assertion.

### AC-6 — `make promote-wave-1` is idempotent

**Given** `tools.json` already has the three wave-1 tools at `ready: true`
**When** `make promote-wave-1` runs twice in succession
**Then** the second run is a no-op (exit 0) and `tools.json` is byte-identical
to the post-first-run state.

## Files Touched (this story)

| File | Change |
|---|---|
| `docs/tool-inventory.md` | NEW — generated inventory of all 33 tools with wave assignment. |
| `docs/quality-audit.md` | NEW — audit results for wave-1 (3 tools). |
| `scripts/_promote_wave_1.py` | NEW — idempotent promotion script. |
| `scripts/_audit_wave_1.py` | NEW — runs the 8/10 rubric against wave-1 tools. |
| `scripts/_smoke_wave_1_pages.js` | NEW — loads each wave-1 page in jsdom and asserts Shell globals are present. |
| `Makefile` | ADD targets: `tool-inventory`, `promote-wave-1`, `audit-wave-1`, `wave-1-smoke`. |
| `.github/workflows/tool-contract-gate.yml` | ADD `make wave-1-smoke` step (mirrors `make share-dialog-smoke` pattern from Story 2.5). |

No `tools.json` change required (the three wave-1 tools are already
`ready: true`).
No `tools/<slug>/index.html` change required (the three tools were promoted
under the per-tool contract in earlier stories).

## Tasks / Subtasks

- [ ] T1 — Inventory generation
  - [ ] T1.1 — `scripts/_promote_wave_1.py` discovers the 33 tools by globbing
    `tools/*/index.html`.
  - [ ] T1.2 — For each tool, classify as Wave-1 / Wave-2 / Wave-3 (Wave-1 =
    already in `tools.json` with `ready: true`; Wave-2 = tools with light
    footprint and clear per-tool fit; Wave-3 = the rest).
  - [ ] T1.3 — Emit `docs/tool-inventory.md` with one row per tool: slug,
    wave, ES5/modern marker, sample-data presence, contract-gap checklist.

- [ ] T2 — Promotion (idempotent)
  - [ ] T2.1 — `scripts/_promote_wave_1.py` re-asserts `ready: true`, `score >= 8`
    on the three wave-1 entries.
  - [ ] T2.2 — If a field is already at the target value, leave it; if it's
    below, fail with the offending slug and field.
  - [ ] T2.3 — Print a one-line summary: 3 PASS, 0 FAIL.

- [ ] T3 — Audit (8/10 rubric)
  - [ ] T3.1 — `scripts/_audit_wave_1.py` loads `docs/quality-rubric.md` and
    runs each criterion against each wave-1 tool.
  - [ ] T3.2 — Emit `docs/quality-audit.md` with the table.
  - [ ] T3.3 — Fail with exit code 1 if any tool scores below 8.

- [ ] T4 — Smoke harness
  - [ ] T4.1 — `scripts/_smoke_wave_1_pages.js` uses jsdom + a minimal HTML
    fixture for each wave-1 slug.
  - [ ] T4.2 — For each fixture, loads `assets/js/site-config.js` +
    `storage-registry.js` + `utils.js` + `sample-data.js` + `history.js` +
    `share.js` + `a11y.js` + `shell.js` + the tool's own `<script src>`.
  - [ ] T4.3 — Asserts `window.HT.share`, `window.HT.urlState`,
    `window.HT.history`, `window.HT.sampleData` are present.
  - [ ] T4.4 — Reports per-slug pass/fail with vacuous-pass guard.

- [ ] T5 — Makefile wiring
  - [ ] T5.1 — ADD `tool-inventory` target → `python scripts/_promote_wave_1.py --inventory-only`.
  - [ ] T5.2 — ADD `promote-wave-1` target → `python scripts/_promote_wave_1.py`.
  - [ ] T5.3 — ADD `audit-wave-1` target → `python scripts/_audit_wave_1.py`.
  - [ ] T5.4 — ADD `wave-1-smoke` target → `node scripts/_smoke_wave_1_pages.js`.

- [ ] T6 — CI gate
  - [ ] T6.1 — ADD `make wave-1-smoke` step to `.github/workflows/tool-contract-gate.yml`
    after the `make share-dialog-smoke` step.
  - [ ] T6.2 — ADD the new scripts to `pull_request.paths` and `push.paths`.

## Dev Agent Record

### Implementation Plan

1. Write `scripts/_promote_wave_1.py` (idempotent — no destructive changes; only
   validates existing entries are at the bar and emits the inventory).
2. Write `scripts/_audit_wave_1.py` (parses `docs/quality-rubric.md` criteria
   and runs each against each wave-1 tool's `tools.json` entry + `index.html`
   head/script tags).
3. Write `scripts/_smoke_wave_1_pages.js` (jsdom harness; subset of the
   Story 2.12 cross-cutting smoke — just wave-1, simpler assertions).
4. Add Makefile targets.
5. Add CI workflow step.
6. Run all three; commit.

### Debug Log

- (filled during implementation)

### Completion Notes

- (filled after green run)

## File List

- `_bmad-output/implementation-artifacts/2-6-promote-wave-1-tools-3-tools.md` (this file)
- `docs/tool-inventory.md` (NEW)
- `docs/quality-audit.md` (NEW)
- `scripts/_promote_wave_1.py` (NEW)
- `scripts/_audit_wave_1.py` (NEW)
- `scripts/_smoke_wave_1_pages.js` (NEW)
- `Makefile` (modified — 4 new targets)
- `.github/workflows/tool-contract-gate.yml` (modified — 1 new step + path triggers)

## Change Log

- (filled during commit)

## Status

in-progress
