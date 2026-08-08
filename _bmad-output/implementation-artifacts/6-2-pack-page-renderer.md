---
title: 'Pack Page Renderer'
type: 'feature'
created: '2026-08-08'
status: 'done'
baseline_commit: '3edb1bf848537bac8f0fa0e5aa9783b93a87c6bc'
context:
  - '{project-root}/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/epics.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-useful-tools-2026-07-31/EXPERIENCE.md'
  - '{project-root}/_bmad-output/implementation-artifacts/1-9-home-grid-rendering-from-tools-json.md'
  - '{project-root}/_bmad-output/implementation-artifacts/6-1-pack-card-component-on-home-grid.md'
---

# Story 6.2: Pack Page Renderer

## Story

**As a** user clicking a pack card,
**I want** a `/packs/<slug>` page that lists the pack's tools with a short pack description,
**So that** I see only the tools I care about.

## Source

- **Origin:** `epics.md` §Story 6.2 specifies `/packs/<slug>` pages that filter tools by `pack=<slug>` and `ready: true`. ARCHITECTURE-SPINE.md row 334 binds FR-6 (Pack Pages) to `/packs/<slug>.html` Shell + `tools.json` filter. EXPERIENCE.md §2.1 places `/packs/{slug}` at the navigation graph as `Pack Page`.
- **Bind to architecture:** AD-3 (data-driven from `tools.json`), AD-9 (cross-Tool via Site Data only — pack pages read from `tools.json`, not hand-coded), AD-13 (Shell owns chrome — pack pages use the canonical chrome), AD-14 (frozen public API surface).
- **Bind to UX spine:** EXPERIENCE.md §2.3 (pack composition table: 5 packs, ≥3 tools each in v1), §4 (Pack Page uses presentation-only layout, no pack-specific UI), §2.4 (canonical URL `https://handy.tools/packs/{slug}`).
- **Bind to PRD:** FR-6 (Pack Pages), FR-20 (per-tool pack tag), FR-21 (5 packs live + 12-15 new tools).
- **Bind to prior work:** Story 1.9 established `assets/js/home-grid.js` rendering data-driven tool grids from `tools.json`. Story 6.1 established `assets/js/pack-grid.js` rendering the home-grid pack cards that link to `/packs/<slug>.html`. Story 6.2 closes the loop by rendering those destinations.

## Brownfield state (already in place by prior stories)

- 3 entries in `tools.json`: `lifespan-simulator` packs=`["household","study"]`, `inflation-calculator` packs=`["finance","household"]`, `qr-code-generator` packs=`["developer"]`.
- `assets/js/home-grid.js` and `assets/js/pack-grid.js` both expose frozen public APIs (`HT.homeGrid`, `HT.packGrid`) under the AD-14 contract.
- `assets/shell/chrome.html` is the canonical chrome source. Tool pages (35 today) carry it byte-for-byte. `scripts/shell-drift-check.py` enforces this on `index.html` + `tools/<slug>/index.html`.
- `scripts/shell-template.py` regenerates tool pages from `chrome.html` + tool-specific body.

This story introduces a third surface (`packs/<slug>.html`) and extends the drift check to scan them.

## Cancel-out rule (the science, briefly)

This story has no cancel-out rules — it's purely additive (5 new pages + a small JS module + drift-check extension). The risk surface is small: pack pages are read-only and presentational, no state mutation, no form input, no storage writes.

## Acceptance Criteria

### AC-1 — Five pack pages exist at `packs/<slug>.html`

Five static HTML files at the project root:

- `packs/travel.html`
- `packs/finance.html`
- `packs/study.html`
- `packs/developer.html`
- `packs/household.html`

Each page uses the canonical Shell chrome (FOUC IIFE in `<head>`, header, footer, settings modal, palette, `site-config.js` + `storage-registry.js` + `utils.js` + `shell.js` script tags), and a `<main id="main" class="shell-main" aria-label="{Pack} pack">` body that contains the pack header and tool grid.

The brand link in the header points to `../../index.html` (mirrors tool-page convention; pack pages are at `packs/<slug>.html`, so `../..` is project root).

Each page's `<title>` is `"{Pack Title} · Handy Tools"` (e.g., `"Finance · Handy Tools"`). Each `<meta name="description">` is the pack tagline.

### AC-2 — Pack page renderer is exposed under `HT.packPage`

`assets/js/pack-page.js` is a new file that follows the same shape as `assets/js/home-grid.js` and `assets/js/pack-grid.js`:

- IIFE wrapper with `'use strict'`.
- Frozen `HT.packPage = { render, packs, ready, version }` object (AD-14).
- `version: '1.0.0'`.
- `render()` is idempotent (checks `data-mounted` attribute on the host element).
- `packs` returns the array of pack descriptors used by the most recent render.
- `ready` is a boolean that flips true on first successful render.

The script reads the same data as the other grid scripts:
1. **Primary path:** `fetch('../tools.json')` (one level up from `/packs/`, back to project root).
2. **Fallback path:** `<script type="application/json" id="ht-tools-json-inline">` parsed inline (spliced by `shell-template.py` for `file://` loads).

The renderer early-returns without mounting when `?embed=1` is set.

### AC-3 — Pack page reads pack slug from URL and renders filtered tool grid

The renderer extracts the pack slug from the URL — either from `window.location.pathname` (e.g., `/packs/finance.html` → `finance`) or from a `data-pack-slug` attribute on the host element. The pathname approach is canonical; the data-attribute is a defense-in-depth fallback for testing.

If the pathname slug is not one of the 5 pinned pack slugs (`travel`, `finance`, `study`, `developer`, `household`), the renderer renders an empty state and logs a warning.

The renderer walks `data.tools[]` and includes entries that satisfy:
- `entry.ready === true`
- `entry.pack` includes the slug

It renders each matching entry as an `<a class="tool-card" href="../tools/<slug>/index.html">` with the tool's icon, title, and description. Tool-card markup mirrors `home-grid.js`'s `buildCard()` (uses the same data field names).

If zero tools match, the renderer shows a "No tools in this pack yet — check back soon" message (per the Story 6.2 AC).

The renderer also writes the pack header:
- Pack icon (inline SVG, same SVG used by `pack-grid.js`'s `PACK_DEFINITIONS` for that slug).
- Pack title (e.g., "Finance").
- Pack description/tagline (e.g., "For the numbers behind a decision.").
- Tool count (e.g., "1 tool" / "5 tools").

### AC-4 — Pack page uses the same Shell chrome as tool pages

The chrome is hand-pasted byte-for-byte from `assets/shell/chrome.html` (matching the existing convention for tool pages — the drift-check enforces this). Specifically:

- The FOUC IIFE script in `<head>` (verbatim from chrome.html).
- The `<header class="site-header">` block with brand link, search trigger, theme toggle, locale button, settings button (verbatim).
- The `<footer class="site-footer">` block with privacy/quality/view-source/github links (verbatim).
- The settings modal + command palette + palette DOM (from chrome.html).
- The `ht-tools-json-inline` block (spliced by `shell-template.py`).
- The storage-registry manifest block (spliced by `shell-template.py`).
- The script tags: `site-config.js`, `storage-registry.js`, `utils.js`, `shell.js`, `palette.js`, `search.js` (only `palette.js` is omitted — pack pages don't have a search input; the script tag list matches tool pages minus any search input + minus `home-grid.js`/`pack-grid.js`).
- `<script src="pack-page.js" defer></script>` for the renderer.

### AC-5 — Drift check scans pack pages

`scripts/shell-drift-check.py` is extended to scan `packs/<slug>.html` files in addition to `index.html` + `tools/<slug>/index.html`. The check applies the same chrome-byte-equality test. Pack pages must carry the full chrome (FOUC IIFE, header, footer, settings modal, palette, manifest, script tags). Pack pages do NOT carry `data-slug="<slug>"` (that's a tool-page-only marker per the existing check).

The drift-check function `iter_target_files()` is updated to walk `packs/` and include every `packs/*.html`. The data-slug check is gated on `tools/<slug>/index.html` path (already gated; pack pages naturally skip the check).

The chrome normalization for pack pages needs to also recognize the brand-link pattern — pack pages use `href="../../index.html"` (matching tool pages), so the existing normalizer applies.

### AC-6 — Cross-cutting gates exit 0

This story adds 5 HTML pages, 1 JS file (`pack-page.js`), and extends the drift check. It does NOT modify `tools.json` (no entries added, no pack changes). Cross-cutting gates:

- `make validate` — exit 0 (`tools.json` unchanged).
- `make gate` — exit 0 (no entry changes).
- `make shell-drift` — exit 0 (36 existing pages + 5 new pack pages all in sync). Drift-check output should show `36 + 5 = 41` pages.
- `make shell-a11y` — exit 0 (each pack page has `<main aria-label>` + cobalt tokens + structural invariants).
- `make storage-registry` — exit 0 (`pack-page.js` has no `HT.storage.*` calls — read-only renderer).
- `make site-config` — exit 0 (each pack page carries `site-config.js` + the script-tag-order check passes; pack pages do NOT carry the per-tool-page blob URL substring because they're not tool pages — verified by the existing tool-page-only check).

### AC-7 — Pack pages render correctly end-to-end

Manual verification:

1. Load `/packs/finance.html` in a browser.
2. Page shows the Finance pack header (icon, title, description, "1 tool" count).
3. Below the header, the `inflation-calculator` tool card renders, linking to `../tools/inflation-calculator/index.html`.
4. Click the tool card — navigates to the inflation calculator page.
5. Load `/packs/household.html` — shows "Household" header with "2 tools" (lifespan + inflation).
6. Load `/packs/travel.html` — shows "Travel" header with "0 tools" + "No tools in this pack yet — check back soon" empty state.
7. Theme toggle works (cobalt-aware, persists across reload).
8. Command palette opens with `/` keyboard shortcut (matches tool-page convention).

## Tasks / Subtasks

- [x] **1. Create the 5 pack pages.**
  - [x] `packs/travel.html` — chrome + body with `data-pack-slug="travel"` host element.
  - [x] `packs/finance.html` — same shape, slug `finance`.
  - [x] `packs/study.html` — same shape, slug `study`.
  - [x] `packs/developer.html` — same shape, slug `developer`.
  - [x] `packs/household.html` — same shape, slug `household`.
  - [x] Each page carries the canonical chrome (FOUC IIFE, header, footer, manifest, script tags).
  - [x] Each page includes `<script src="../assets/js/pack-page.js" defer></script>` (relative path up one level to project root).

- [x] **2. Create `assets/js/pack-page.js`.**
  - [x] IIFE wrapper with `'use strict'`, version `1.0.0`.
  - [x] Extract pack slug from `window.location.pathname` (e.g., `/packs/finance.html` → `finance`).
  - [x] Read tools.json via `fetch('../tools.json', { cache: 'no-cache' })` with `ht-tools-json-inline` fallback.
  - [x] Filter `data.tools[]` to entries where `entry.ready === true` AND `entry.pack` includes the slug.
  - [x] Render the pack header (icon, title, description, tool count).
  - [x] Render the tool grid (mirrors `home-grid.js`'s `buildCard()` for each in-pack tool).
  - [x] Show "No tools in this pack yet — check back soon" empty state if zero matches.
  - [x] Embed the 5 pack taglines + 5 SVG icons (same `PACK_DEFINITIONS` data as `pack-grid.js`).
  - [x] Expose `HT.packPage = { render, packs, ready, version }` (frozen, AD-14).
  - [x] Early-return on `?embed=1`.

- [x] **3. Extend `scripts/shell-drift-check.py` to scan `packs/<slug>.html`.**
  - [x] Update `iter_target_files()` to also walk `packs/*.html`.
  - [x] Add `SEARCH_JS_ANCHOR_PACK`, `SITE_CONFIG_JS_ANCHOR_PACK`, `STORAGE_REGISTRY_JS_ANCHOR_PACK` for the `../assets/js/...` form (depth 1).
  - [x] Update the scan() loop to detect `is_pack = rel.parent.name == "packs"` and pick the right anchor.
  - [x] Update the brand-link normalizer to recognize `href="../index.html"` as the pack-page form.
  - [x] Gate the `data-slug` check on `not is_home and not is_pack` (pack pages don't carry `<main data-slug>`).
  - [x] Test: run `python scripts/shell-drift-check.py` after pages exist; all 41 pages in sync.

- [x] **4. Run the cross-cutting gates.**
  - [x] `python scripts/validate-tools-json.py` exits 0 (tools.json unchanged).
  - [x] `python scripts/tool-contract-gate.py` exits 0.
  - [x] `python scripts/shell-drift-check.py` exits 0 with all 41 pages in sync.
  - [x] `python scripts/shell-a11y-check.py` exits 0 — extended to scan packs/.
  - [x] `python scripts/storage-registry-gate.py` exits 0.
  - [x] `python scripts/site-config-gate.py` exits 0.

- [x] **5. Update sprint-status.yaml.**
  - [x] Change `6-2-pack-page-renderer: in-progress` → `done`.
  - [x] Bump `last_updated` to today's timestamp.

- [x] **6. Update this story file.**
  - [x] Mark all task checkboxes `[x]`.
  - [x] Change YAML frontmatter `status` from `in-progress` to `done`.
  - [x] Populate `Dev Agent Record` → `Debug Log References`, `Completion Notes List`, `File List`.
  - [x] Append to `Change Log`.

- [x] **7. Commit and push.**
  - [x] `git add packs/ assets/js/pack-page.js scripts/generate-pack-pages.py scripts/shell-drift-check.py scripts/shell-a11y-check.py _bmad-output/implementation-artifacts/sprint-status.yaml _bmad-output/implementation-artifacts/6-2-*.md`.
  - [x] `git commit -m "feat(6-2): pack page renderer for /packs/<slug>.html"`.
  - [x] `git push`.

## Dev Notes

### Why static HTML per pack (not a single SPA)

The simplest drift-check-friendly approach is one HTML file per pack. Alternatives:
- **Single SPA at `/packs/index.html` with `?pack=<slug>`** — fewer files, but the URL contract from Story 6.1 is `/packs/<slug>.html`, and we'd need to update 6.1's pack-card links.
- **Server-rendered page** — not an option; this is a static site (GitHub Pages-compatible per AD-8).
- **Single HTML file with JS-only dispatch via `window.location.pathname`** — same URL contract as the SPA but more files. Choosing this is no different than one file per pack.

The 5 static files are the cleanest fit. Each is small (~50 lines), each is byte-equivalent to the others except for the slug, title, and tagline. The drift check enforces chrome consistency across all 5.

### Chrome byte-equality

Each pack page must carry the chrome from `assets/shell/chrome.html` verbatim. The existing drift check enforces byte-equality of:
- The header block (`<!-- shell:header --> ... <!-- /shell:header -->`)
- The footer block (`<!-- shell:footer --> ... <!-- /shell:footer -->`)
- The palette DOM
- The settings modal DOM
- The storage-registry manifest block
- The script tags (site-config.js, storage-registry.js, utils.js, shell.js, palette.js, search.js, home-grid.js) — pack pages skip home-grid.js since they have no home-grid section.

When you hand-write the 5 pack pages, you can copy the chrome from `assets/shell/chrome.html` and then add `<script src="../assets/js/pack-page.js" defer></script>` and the page-specific body.

### Brand link path

Pack pages use `href="../../index.html"` for the brand link (matches tool pages; `packs/<slug>.html` is two levels deep from project root). The drift-check normalizer already replaces this with the `__BRAND_HREF__` placeholder before byte-comparison.

### Pack slug extraction

`window.location.pathname` on GitHub Pages returns `/packs/finance.html` (or `/packs/finance/` if there's a trailing slash redirect). The renderer should:
1. Strip the leading `/`.
2. Strip the trailing `.html` (or trailing `/`).
3. Match `/packs/<slug>` and extract `<slug>`.
4. Validate `<slug>` against the 5 pinned pack slugs.
5. Fall back to `data-pack-slug` attribute on the host element if pathname parsing fails (defense in depth — used in tests).

The renderer should NOT parse `?pack=<slug>` from query string — that's a different routing pattern and isn't used by the Story 6.1 pack-card links.

### Reusing `PACK_DEFINITIONS` from `pack-grid.js`

The 5 pack descriptors (slug, title, tagline, icon SVG) live in `assets/js/pack-grid.js`'s `PACK_DEFINITIONS`. To avoid duplication, `pack-page.js` should either:
- (a) Copy the same `PACK_DEFINITIONS` array (5 packs × ~10 lines = ~50 lines; acceptable duplication, both scripts read it independently and stay self-contained).
- (b) Read from `HT.packGrid.packs` (the `pack-grid.js` API) — but `pack-page.js` runs even on pages where `pack-grid.js` doesn't (pack pages have no `home-grid-tools-json` host, but `pack-grid.js` early-returns unless `#home-grid-packs` is present — wait, pack pages also have no `#home-grid-packs` host). So `pack-grid.js` doesn't run on pack pages.

Going with option (a) — duplicated `PACK_DEFINITIONS`. The duplication is bounded (50 lines) and the two scripts remain independently testable. If the user later wants a single source of truth, that's a refactor for a later story.

### Cross-tool-page-only checks

The site-config-gate has a check that scans tool pages for a specific blob URL substring (AC #9). Pack pages are NOT tool pages, so this check should skip them. The existing code is gated on `tools/<slug>/index.html` path, so it naturally skips pack pages. No change needed.

The shell-a11y-check scans all `*.html` in the project (let me verify by re-reading it later; for now I'll trust that pack pages will pass because they use the same chrome and have `<main aria-label>`).

### Migration order

Story 6.2 lands after Story 6.1 (pack cards). Story 6.2's 5 pack pages un-404 the pack card links. Story 6.3 (Pack Taxonomy Documentation) follows naturally. Story 6.4-6.18 (new tools) populate the 5 packs with more tools — at which point the per-pack counts grow beyond the 1-2 tools they have today.

The Travel pack is empty today (no tools). Story 6.18 (Currency Converter) and Story 6.11 (Exam Countdown, possibly travel-tagged) and Story 6.19 (Travel Pack Composition) will populate it.

### Brownfield flag handling

The pack pages do not need `legacy` or `migrated` flags (those are for tool entries in `tools.json`). Pack pages are net-new surfaces.

## Files modified

**Modified**
- `scripts/shell-drift-check.py` — extend `iter_target_files()` to scan `packs/*.html`.

**New**
- `packs/travel.html`, `packs/finance.html`, `packs/study.html`, `packs/developer.html`, `packs/household.html` — 5 pack pages.
- `assets/js/pack-page.js` — the renderer.
- `_bmad-output/implementation-artifacts/6-2-pack-page-renderer.md` — this file.

**No changes to**: `tools.json`, `index.html`, `assets/shell/chrome.html`, `assets/css/*`.

## Dev Agent Record

### Agent Model Used

`puku-ai-2.7` (via Puku CLI, routed per request).

### Debug Log References

1. **Generator's `extract_region()` initially looked for `<!-- shell:palette -->` markers inside `chrome.html`.** The marker does NOT exist there — chrome.html only carries `shell:chrome`, `shell:header`, `shell:footer`, and the manifest block. Palette and settings live in their own sub-part files (`assets/shell/palette.html`, `assets/shell/settings.html`). Fix: added a `read_part()` helper that mirrors the drift-check's `load_chrome()` sub-part extraction.

2. **Initial FOUC IIFE in the generator was the short pre-PerformanceObserver form.** Tool pages and the canonical `assets/shell/head-snippet.html` carry the longer IIFE with the `PerformanceObserver` block. `shell-a11y-check.py`'s `check_fouc_script()` substring-matches the canonical IIFE, so the pack pages failed the check. Fix: `load_canonical_fouc_iife()` reads from `head-snippet.html` and the generator emits that exact form.

3. **`<main aria-label="Developer pack">` was rejected by the a11y check**, which derives the expected label from `<title>` (i.e., "Developer"). The a11y check uses the title-derived form so the label and the visible heading match; appending " pack" is redundant for screen readers and broke the equality check. Fix: aria-label uses just the pack title (e.g., "Developer").

4. **Drift check expected `../../assets/js/search.js` (tool-page depth 2 form) on every non-home page.** Pack pages are depth 1 and need `../assets/js/search.js`. Fix: added a third anchor (`SEARCH_JS_ANCHOR_PACK`, `SITE_CONFIG_JS_ANCHOR_PACK`, `STORAGE_REGISTRY_JS_ANCHOR_PACK`) and updated `scan()` to pick the right anchor based on `rel.parent.name == "packs"`.

5. **Brand-link normalizer originally only recognized `href="#top"` (home) and `href="../../index.html"` (tool pages).** Pack pages use `href="../index.html"` (one level up to project root). Fix: extended `normalize()` to also replace `href="../index.html"` with the `__BRAND_HREF__` placeholder.

6. **`<main data-slug="...">` check was gated on `not is_home`.** Pack pages don't carry `<main data-slug>` (they carry `<header data-pack-slug>` instead). Without gating, the check would have tried to derive `slug = "packs"` and flagged every pack page. Fix: gated the data-slug check on `not is_home and not is_pack`.

### Completion Notes List

- **Generator-based pack pages:** `scripts/generate-pack-pages.py` is the canonical source for the 5 pack pages. The script reads `assets/shell/chrome.html` (header/footer), `assets/shell/palette.html`, `assets/shell/settings.html`, `assets/shell/head-snippet.html` (canonical FOUC IIFE), `assets/shell/chrome.html`'s manifest block, and `tools.json` (inline). Each page is regenerated byte-equivalently on every run — the script is idempotent and prints `no-change` for aligned pages.
- **Brand-link depth-1 rewrite:** the generator rewrites the chrome's `href="../../index.html"` to `href="../index.html"` for the pack-page depth. The drift-check normalizer recognizes both forms. The chrome.html source itself is unchanged.
- **Pack pages are net-additive to the drift check:** the check now scans 41 pages (1 home + 35 tool + 5 pack). All three checks (drift, a11y, site-config) are aware of pack pages and gate correctly.
- **Pack-page renderer (`HT.packPage`):** mirrors the home-grid / pack-grid pattern: IIFE, frozen `{ render, packs, ready, version }` object, `?embed=1` early-return. Reads tools.json via `fetch('../tools.json')` with `ht-tools-json-inline` fallback (spliced by the generator, mirroring shell-template.py). Pack slug is resolved from `data-pack-slug` (defense in depth) or `window.location.pathname`.
- **Empty-state UX:** the renderer shows "No tools in this pack yet — check back soon" for any pack that has zero matches (Travel currently). The empty state reuses the `.tool-card--empty` style already in components.css.
- **Tool cards on pack pages:** the renderer emits `<a class="tool-card" href="../tools/<slug>/index.html">` (one level up to project root) — same shape as `home-grid.js`'s `buildCard()`, adapted for depth 1.
- **Cross-cutting gates:** all 6 gates exit 0 with the pack pages in place.

### File List

**New**
- `packs/travel.html` — Travel pack page (currently 0 tools; empty-state shown).
- `packs/finance.html` — Finance pack page (1 tool: inflation-calculator).
- `packs/study.html` — Study pack page (1 tool: lifespan-simulator).
- `packs/developer.html` — Developer pack page (1 tool: qr-code-generator).
- `packs/household.html` — Household pack page (2 tools: lifespan-simulator, inflation-calculator).
- `assets/js/pack-page.js` — the renderer (IIFE, frozen `HT.packPage`).
- `scripts/generate-pack-pages.py` — generator for the 5 pack pages (idempotent).
- `_bmad-output/implementation-artifacts/6-2-pack-page-renderer.md` — this story file.

**Modified**
- `scripts/shell-drift-check.py` — `iter_target_files()` walks `packs/*.html`; new `*_PACK` anchors for `../assets/js/...`; brand-link normalizer handles `href="../index.html"`; data-slug check gated on `not is_home and not is_pack`.
- `scripts/shell-a11y-check.py` — `iter_target_files()` walks `packs/*.html` so the FOUC IIFE and `<main aria-label>` checks run on pack pages too.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `6-2-pack-page-renderer: in-progress` → `done`, `last_updated` bumped.

## Change Log

- 2026-08-08 — Story 6.2 created.
- 2026-08-08 — Story 6.2 implemented. Generator + 5 pack pages + pack-page.js + drift-check extension + a11y-check extension. All 6 cross-cutting gates exit 0.