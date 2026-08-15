# Story 4 — Embed Slim Build (Tier 1 < 30 KB NFR-1 Path)

Status: in-progress (Phase 1 shipped 2026-08-15; Phases 2–5 pending)
Created: 2026-08-15
Origin: Story x-3 (Bundle Size Budget NFR-1 Gate) AC-4 + NFR-1-REVISION.md proposal
Cross-epic: yes (concerns every chrome page; affects shell-template + drift gate + smoke tests)

## Story

**As a** project maintainer responsible for the NFR-1 performance budget (Tier 1 core shell < 30 KB gzipped on every chrome page),
**I want** the 142 KB chrome JS layer decomposed into a slim Tier 1 boot (~26 KB gz) + lazy-loaded Tier 2 chrome + page-conditional modules,
**so that** tool pages reach the Tier 1 < 30 KB target (currently 4.7× over), first-paint FCP improves ≥ 30% on simulated 4G, and the project satisfies its own PRD NFR-1 contract without dropping features.

## Source

### Origin 1 — Story x-3 AC-4 + AC-5

The Story x-3 spec (commit `9cf5c92`) declared:

> AC-4 — Decomposition is documented. A `docs/bundle-size-budget.md` is created that identifies the top-3 candidates for size reduction (lazy-loaded modules, code-split per Tool, dropping the inline `<script type="application/json">` splice for production, etc.).
>
> AC-5 — NFR-1 revision proposal. A NFR-1 revision proposal is drafted in `_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/NFR-1-REVISION.md` that proposes raising the shell JS budget from 30 KB to a tiered structure (e.g., core shell < 30 KB, full chrome < 120 KB, tool-specific first-load < 30 KB on top of the chrome).

The proposal was drafted + the api-contract.js reclassification landed (commit `bf90f5e`, 2026-08-15) — chrome total dropped 161,192 → 142,420 gz. **The remaining 4.7× overshoot can only be closed by decomposing the shell.** That's Story 4.

### Origin 2 — Post-home-redesign retrofit audit

The retrofit audit (`post-home-redesign-retrofit-2026-08-13.md`) identified Story 4 as the only architectural path back to the PRD's NFR-1 contract. Quote:

> Story 4 (embed slim build) — long-term path to the < 30 KB NFR-1 target; this story builds the gate that measures progress toward that target.

## Current state (as of 2026-08-15)

### Measured chrome breakdown (gz)

| Module | gz | Tier |
|---|---:|---|
| `shell.js` | 26,862 | Tier 1 (to be split) |
| `history.js` | 16,717 | Tier 2 (lazy) |
| `quiz.js` | 12,032 | page-conditional |
| `storage-registry.js` | 7,484 | Tier 1 |
| `quality.js` | 7,223 | page-conditional |
| `search.js` | 6,839 | Tier 1 |
| `url.js` | 6,598 | Tier 2 (Proxy stub in shell-thin) |
| `home-grid.js` | 6,139 | home only |
| `sample-data.js` | 5,976 | Tier 2 (lazy) |
| `help-overlay.js` | 5,867 | Tier 2 (lazy on `?`) |
| `share.js` | 5,014 | Tier 2 (lazy) |
| `import.js` | 5,004 | Tier 2 (lazy) |
| `a11y.js` | 4,088 | Tier 2 (lazy) |
| `global-chords.js` | 3,572 | Tier 2 (lazy on first `g`) |
| `view-source.js` | 3,483 | page-conditional |
| `pack-grid.js` | 3,279 | home/packs only |
| `pack-page.js` | 3,163 | pack pages only |
| `utils.js` | 3,124 | Tier 1 |
| `palette-actions.js` | 2,607 | Tier 1 (Proxy stub) |
| `export.js` | 2,381 | Tier 2 (lazy) |
| `home-sidebar.js` | 1,630 | home only |
| `pins.js` | 1,449 | home only |
| `recent.js` | 1,404 | home only |
| `site-config.js` | 485 | Tier 1 |
| `api-contract.js` | 18,772 | view-source + quality only (reclassified) |
| **TOTAL (chrome)** | **142,420** | vs NFR-1 target 30,000 — **4.7× over** |

## Decomposition

### Tier 1 (always loaded on chrome pages) — target < 30 KB gz

| File | gz est. | Note |
|---|---:|---|
| `site-config.js` | 485 | frozen |
| `storage-registry.js` | 7,516 | frozen |
| `utils.js` | 3,124 | frozen |
| `ht-lazy.js` | ~400 | NEW — loader (Phase 1) |
| `shell-thin.js` | ~9,500 | NEW — boot + chrome DOM + Proxy stubs (Phase 2) |
| `palette-actions.js` | 2,628 | accessed via Proxy `HT.palette` (lazy) |
| `search.js` | 6,898 | needed by palette search affordance |
| `components-core.css` | ~6,000 | extracted from components.css (Phase 5) |
| **Subtotal** | **~26,500 gz JS + 6,000 CSS** | ✅ **< 30 KB Tier 1 floor** |

### Tier 2 (lazy on first user action)

| File | gz | Trigger |
|---|---:|---|
| `url.js` | 6,625 | first `HT.urlState.*` property access (Proxy) |
| `help-overlay.js` | 5,889 | `?` chord |
| `global-chords.js` | 3,572 | first `g` keypress (one-shot wrapper) |
| `history.js` | 16,760 | first history-panel open OR first `HT.history.push()` call |
| `sample-data.js` | 5,995 | first `HT.sampleData.mount()` call |
| `a11y.js` | 4,088 | first a11y audit invocation |
| `share.js` | 5,014 | first share-button click |
| `export.js` | 2,381 | first export-button click (after history.js) |
| `import.js` | 5,004 | first import-button click (after history.js) |
| `shell-history.js` | ~1,200 | with history.js (Phase 4) |
| `shell-sample-data.js` | ~1,800 | with sample-data.js (Phase 4) |
| `shell-share.js` | ~2,000 | with share.js (Phase 4) |
| `shell-export.js` | ~1,200 | with export.js (Phase 4) |
| `shell-import.js` | ~1,800 | with import.js (Phase 4) |
| `shell-a11y.js` | ~1,500 | with a11y.js (Phase 4) |
| 6 lazy CSS chunks | ~3,400 | injected with corresponding JS module |

### Page-conditional

- `quiz.js` (12,108 gz) — `tools/quiz-preview/index.html` only
- `quality.js` (7,253 gz) — `quality.html` only
- `view-source.js` (3,498 gz) — `view-source.html` only
- `api-contract.js` (18,772 gz) — view-source + quality only (already reclassified)
- Home/pack modules — `index.html` / `packs/*.html` only

## Acceptance Criteria

### AC-1 — Tier 1 measurement

Every chrome page (45 tools + 6 packs + home + quality) has Tier 1 JS payload `< 30 KB gz`. Measured via new `make bundle-size-tier1` target that walks every chrome page's first-tier `<script>` content and gz-sums it.

### AC-2 — Per-Tool payload

Per-Tool payload (Tier 1 + per-Tool script + Tier 2 triggered on demand) ≤ 30 KB gz on first paint. Measured via `make perf-budget` (Lighthouse "Slow 4G" simulation).

### AC-3 — Tier 2 budget

Full Tier 2 chrome budget ≤ 200 KB gz summed across all reachable lazy modules from a tool page. Measured via existing `make bundle-size` (must continue to PASS).

### AC-4 — AD-14 frozen API

`HT.*` API surface byte-identical — every public method still callable; smoke matrix green. Measured via `make smoke-api-surface` (the regression sweep; no API removals).

### AC-5 — Drift + ordering

Drift + ordering gates continue to pass on all 53 pages. Measured via `make ci` (full chain, 30+ gates).

### AC-6 — Storage-registry manifest SHA-256

Storage-registry manifest SHA-256 on `index.html` byte-equivalent to pre-Story-4 value. Measured via `shell-drift-check.py` storage-manifest check.

### AC-7 — First Contentful Paint

FCP on a tool page improves by ≥ 30% (median, n=10 cold loads over simulated 4G) vs. pre-Story-4 baseline. Archived in `docs/perf/story-4-fcp.md`.

## Tasks

1. [x] **Task 1 — Phase 1: Loader + Tier 1 boilerplate** (shipped 2026-08-15)
   - Add `assets/js/ht-lazy.js` (Phase 1 stub: `HT.lazyLoad` only, no Proxy yet)
   - Add `assets/js/shell-thin.js` (Phase 1 stub: logs "thin boot ok", exposes nothing)
   - Add `scripts/_smoke_ht_lazy.js` — 15 assertions, all PASS

2. [ ] **Task 2 — Phase 2: Canary real shell-thin on `qr-code-generator`**
   - Move theme FOUC IIFE + palette DOM mount + settings DOM mount + chrome button wiring from `shell.js` into `shell-thin.js`
   - Add Proxy stubs in `shell-thin.js` for `HT.history`, `HT.urlState`, `HT.palette`
   - Extract `chrome-palette.css`, `chrome-settings.css`, `components-core.css`
   - Wire `cssFor` registry in `ht-lazy.js` for `shell-thin.js` → `[chrome-palette.css, chrome-settings.css]`
   - Update `tools/qr-code-generator/index.html` to use slim Tier 1
   - Manual canary in Chrome DevTools "Slow 4G" profile

3. [ ] **Task 3 — Phase 3: Sweep all 53 pages to slim Tier 1**
   - For each tool + pack + home + quality + quiz-preview: emit slim Tier 1 via `shell-template.py` regeneration
   - Add `scripts/_bundle_size_tier1.py` + `make bundle-size-tier1` target
   - Run full `make ci` + `make bundle-size-tier1`; expect every chrome page < 30 KB gz JS Tier 1

4. [ ] **Task 4 — Phase 4: Decompose shell.js into lazy chunks**
   - Create `shell-history.js`, `shell-sample-data.js`, `shell-share.js`, `shell-export.js`, `shell-import.js`, `shell-a11y.js`
   - Each contains the previous `mountX` function from `shell.js`
   - Add CSS split for `chrome-history.css`, `chrome-share.css`
   - Delete the now-empty `shell.js`

5. [ ] **Task 5 — Phase 5: Decompose components.css**
   - Author `components-core.css` (extracted always-on rules)
   - Author 11 lazy CSS chunks (chrome + home + pack)
   - Wire CSS injection via `ht-lazy.js` registry
   - Delete the now-empty `components.css`

6. [ ] **Task 6 — Drift + ordering gate updates**
   - `scripts/shell-template.py`: emit slim Tier 1 + page-conditional hook
   - `scripts/shell-drift-check.py`: Tier 1 first-five-scripts invariant
   - `Makefile script-load-order` target: add ht-lazy.js + shell-thin.js invariants

7. [ ] **Task 7 — Smoke test updates**
   - Update 8 smoke files (`_smoke_palette_actions.js`, `_smoke_history_panel.js`, `_smoke_export.js`, `_smoke_import.js`, `_smoke_sample_data.js`, `_smoke_share_dialog.js`, `_smoke_a11y.js`, `_smoke_pins_recent.js`, `_smoke_url_state_codec.js`) to use `ensureLoaded` helper before exercising lazy APIs
   - Add boot-timing regression smoke

8. [ ] **Task 8 — FCP before/after benchmark** (AC-7)
   - Capture pre-Story-4 baseline FCP via Lighthouse on `tools/qr-code-generator/index.html` × 10 cold loads
   - Post-Phase-3 re-measure; archive both in `docs/perf/story-4-fcp.md`

## Verification (end-to-end, run after each phase)

```bash
# Phase 1
make ci
node scripts/_smoke_ht_lazy.js

# Phase 2 (canary on qr-code-generator)
SHELL_DRIFT_PAGE=qr-code-generator make ci
# manual: open tools/qr-code-generator/index.html in Chrome DevTools "Slow 4G", reload

# Phase 3 (sweep all pages)
make ci
make bundle-size          # Tier 2 must still PASS
make bundle-size-tier1    # new target, every chrome page < 30 KB gz

# Phase 4 (decompose shell.js)
make ci

# Phase 5 (decompose components.css)
make ci

# Final — Tier 1 measurement
make bundle-size-tier1
# expect: 53/53 chrome pages < 30 KB gz JS Tier 1

# Final — full gate
make ci
# expect: all 30+ gates green
```

## Phase 1 progress (shipped 2026-08-15)

### What shipped

- `assets/js/ht-lazy.js` — Phase 1 stub loader (~1.3 KB raw, ~400 bytes gz). Public API: `HT.lazyLoad(url)` → Promise. Deduplicates concurrent calls; idempotent; rejects on script error; inserts `<script defer data-ht-lazy="true">`.
- `assets/js/shell-thin.js` — Phase 1 stub (~600 bytes raw, ~300 bytes gz). Logs "shell-thin: stub ok — real boot ships in Phase 2". Exposes `HT.shellThinLoaded = true` for smoke verification.
- `scripts/_smoke_ht_lazy.js` — 15 assertions, all PASS. Verifies: HT.lazyLoad shape, idempotence, dedup, defer attribute, data-ht-lazy attribute, error path rejection, retry-after-error acceptance.

### What did NOT change

- No existing page references `ht-lazy.js` or `shell-thin.js` yet — Phase 1 is a no-op on the user-visible chrome.
- `bundle-size-gate` chrome total: 142,420 gz (unchanged; the gate doesn't measure files outside `SPEC_JS_MODULES`).
- `make ci` chain: all 30+ gates still PASS.

### Why this is safe

- Both files are added but unused; nothing in any HTML references them.
- The smoke harness verifies the loader in isolation via vm + fake DOM (matches the project's existing pure-Node smoke pattern).
- Phase 2 will introduce the first page that references `ht-lazy.js` (qr-code-generator canary), which is the only place the loader runs in real chrome.

### Roll-back

Phase 1 ships 3 new files + 0 modified files. Roll-back is `git rm assets/js/ht-lazy.js assets/js/shell-thin.js scripts/_smoke_ht_lazy.js` — no other code paths are touched.

## Cross-references

- Story x-3 (Bundle Size Budget NFR-1 Gate) — built the measurement + CI gate; Story 4 is the implementation of its reduction candidates
- Story 3.1 (command palette) — Story 4's `HT.palette` Proxy stub preserves the Story 3.1 surface
- Story 2.10 cleanup (deleted layout.js + theme.js) — first reduction; Story 4 is the second
- api-contract.js reclassification (commit `bf90f5e`) — measurement correction; Story 4 is the architectural fix
- NFR-1-REVISION.md — tiered budget proposal that Story 4 implements
- `docs/bundle-size-budget.md` — current chrome decomposition + top-3 reduction candidates (Story 4 closes #3 + #4)
- `packs/travel.html` — proof-of-concept for the slim-build pattern (already loads only 7 scripts)
- Story 4b (per-Tool code-split) — future work; Story 4 reaches Tier 1 < 30 KB but each tool still ships as a single `.js` file
- Story 4c (Service worker / offline) — future epic; out of scope for Story 4

## Out of scope

- **Per-Tool code-splitting** (NFR-1 "Tool's first load adds ≤ 30 KB over shell") — separate Story 4b
- **Service worker / offline-first** — separate epic
- **CSS budget enforcement** — Story x-3's `make bundle-size` already gates CSS ≤ 25 KB; Story 4 leaves that alone
- **`<link rel="modulepreload">` / `<link rel="preload">` hints** — deferred to Story 4b as a Lighthouse-friendliness follow-up

## Estimated effort

5 PRs, ~5 days total:
- Phase 1: 0.5 day ✅ shipped 2026-08-15
- Phase 2: 1 day (includes manual canary verification)
- Phase 3: 1 day (sweep + bundle-size-tier1 new target)
- Phase 4: 1.5 days (shell.js decomposition is the highest-risk)
- Phase 5: 1 day (CSS split is mostly mechanical)
