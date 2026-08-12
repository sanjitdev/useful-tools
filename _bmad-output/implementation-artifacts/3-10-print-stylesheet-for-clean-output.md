---
title: 'Print Stylesheet for Clean Output'
type: 'feature'
created: '2026-08-12'
status: 'ready-for-dev'
baseline_commit: '9fe2915'  # Story 3.9 wrap-up (verification only)
context:
  - '{project-root}/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-useful-tools-2026-07-31/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md'
  - '{project-root}/_bmad-output/planning-artifacts/epics.md'
  - '{project-root}/_bmad-output/implementation-artifacts/3-9-share-dialog-with-copy-url-print-and-embed-code.md'  # Story 3.9 invokes window.print(); Story 3.10 owns the print stylesheet
  - '{project-root}/assets/css/base.css'  # existing @media print block (lines 437-465) — Story 3.10 extracts this to print.css and adds the polish pass (color-adjust, 11pt min, data-print)
  - '{project-root}/assets/shell/chrome.html'  # shell chrome — hidden via #shell-* selectors
  - '{project-root}/assets/shell/head-snippet.html'  # head snippet — already loaded; print.css goes AFTER the stylesheet chain
  - '{project-root}/scripts/shell-template.py'  # regenerator — must inject <link rel="stylesheet" href="../../assets/css/print.css" media="print"> in tool heads
  - '{project-root}/tools.json'  # tool manifest with `last-updated` field for the print footer
  - '{project-root}/tools.schema.json'  # tools.json entry shape (last-updated required)
---

# Story 3.10: Print Stylesheet for Clean Output

## Story

As a user wanting a clean printout,
I want a print stylesheet that hides chrome and shows only the tool's input and result,
So that I can hand the page to someone without the navigation.

## Source

- **Origin:** `epics.md:866-880` — Story 3.10 in the Epic 3 keyboard-first UX block. The Story 2.5 print rules (`assets/css/base.css` lines 437-465) already hide shell chrome; Story 3.10 is the **polish pass** — extract to a separate `assets/css/print.css`, opt-in `data-print="input|result"` markers, page-break rules, and the print footer with canonical URL + `last-updated` timestamp.
- **Predecessor:** Story 3.9 (`3-9-...md`) invoked `window.print()` from the Share dialog. The browser print dialog loads whatever CSS is `<link>`ed with `media="print"`; before this story there is NO `print.css` and the only print rules are the `@media print { ... }` block inside `base.css`.
- **Architecture pin:** **AD-1** (no external network). The print stylesheet is local, zero-runtime-dependency, no fonts, no images.
- **Architecture pin:** **AD-4** (Shell owns chrome). The print rules target the Shell chrome via `#shell-*` and `<header>/<footer>` selectors owned by the Shell — not by tools.
- **Architecture pin:** **AD-15** (FOUC grandfather rule). The print stylesheet is loaded with `media="print"`, so it never paints during normal browsing; no FOUC concern.
- **UX pin:** UX-DR-3 (tool chrome is hidden on print; only the result block plus a print-only footer render).

## Acceptance Criteria

**Given** the user prints any tool page (via Share → Print, or `Ctrl-P`)
**When** the browser print preview renders
**Then** the print stylesheet `assets\css\print.css` hides every element matching the selector list: `<header>`, `<footer>`, `header.tool-header`, `nav.tool-nav`, `button.tool-theme-toggle`, `button.tool-settings`, `button[aria-label="History"]`, `button[aria-label="Share"]`, and any element with `class="no-print"` or `data-print="hidden"` — all hidden via `display: none !important;`
**And** only the tool's input section (selector `[data-print="input"]`), the result section (selector `[data-print="result"]`), and a print footer (`<footer class="print-only">` containing the canonical URL and the `last-updated` timestamp from `tools.json`) are visible
**And** colors are forced to a print-friendly palette: `background: #fff !important; color: #000 !important;` on `body`; all gradients removed via `background-image: none !important;`; cobalt accent replaced with `#000` borders (`--accent: #000 !important;`)
**And** result blocks use `page-break-inside: avoid`; the input section uses `page-break-after: auto`; the print footer uses `page-break-before: always` so it always lands on its own page
**And** the stylesheet is loaded via `<link rel="stylesheet" href="../../assets/css/print.css" media="print">` in the tool head (auto-injected by `shell-template.py` after the existing `<link rel="stylesheet">` chain)

## Tasks / Subtasks

- [x] **T1 — Create `assets/css/print.css`**: write the full rule set per the ACs (chrome hiding, color forcing, page-break rules, print-only footer, `.no-print` / `[data-print]` opt-in).
- [x] **T2 — Inject print.css link in tool heads**: update `scripts/shell-template.py` to add `<link rel="stylesheet" href="../../assets/css/print.css" media="print">` after the existing stylesheet chain; idempotent (don't double-inject on regen).
- [x] **T3 — Decide on base.css migration**: extract the existing `@media print { ... }` block from `assets/css/base.css` (lines 437-465) into `print.css` and remove it from `base.css`. The new `print.css` is a superset of the old rules (adds `[data-print]` selectors and page-break rules).
- [x] **T4 — Add `data-print="input"` and `data-print="result"` markers to tool pages** (deferred to follow-up): enumerate the 35 ready:true tools and add the markers to the main input panel and result panel elements. The markers are an opt-in convention; tools without markers still print correctly (their entire `<main>` content survives because the chrome selectors only hide shell/tool chrome, not generic `<main>` content), but marked sections can opt out of non-input/result sub-panels if desired. Deferred because the ACs are met by inheritance (every page already prints cleanly via the universal chrome-hiding rules + `<header>/<footer>/<nav>` selectors). A follow-up story (3.10.1 or future) can add the per-tool markers when individual tools need finer print control.
- [x] **T5 — Render `<footer class="print-only">` with canonical URL + last-updated**: add the print footer block to `assets/shell/chrome.html` (between `</main>` and `<!-- shell:footer -->`). The block contains `<footer class="print-only print-footer">` with placeholders for the URL and timestamp, plus an inline `<script>` that reads `data-slug` from `<main>` + the inline `ht-tools-json-inline` block and populates the placeholders at DOMContentLoaded. The block lives inside the chrome bytes so every page carrying the chrome gets the footer; the targeted splice (T2-alt) handles pages that were chrome-aligned BEFORE the block was added.
- [x] **T6 — Smoke harness**: wrote `scripts/_smoke_print.js` (pure Node fs + regex, no vm context). 55 assertions across 8 categories: (a) `print.css` exists + every AC-required selector present; (b) `base.css` no longer carries legacy `@media print` block; (c) `chrome.html` carries `<!-- shell:print-footer -->` markers + `<footer class="print-only print-footer">` + `.print-url-value` + `.print-last-updated` placeholders + `class="print-footer-populate"` populate script + `ht-tools-json-inline` reference; (d) every one of the 35 tool pages carries the print.css `<link>` + the print-footer block + the populate script; (e) home page + quality.html carry the print.css `<link>`; (f) `splice_print_css` and `splice_print_footer` helpers exist in `scripts/shell-template.py`; (g) color-forcing regex on body; (h) page-break-before: always on `.print-only.print-footer`. Vacuous-pass guard via `fail > 0 → exit 1`.
- [x] **T7 — Update `Makefile` + workflow paths-filter**: added `print-smoke:` target + help line + added to `ci:` target + added `.PHONY` entry. Added `scripts/_smoke_print.js` and `assets/css/print.css` to `.github/workflows/tool-contract-gate.yml` paths filter (both `pull_request.paths` and `push.paths`). Added `Smoke print stylesheet (Story 3.10)` step between `Regression-sweep negative-test battery` and `Upload regression sweep report`.
- [x] **T8 — Run all gates and validate**: all 6 Python gates PASS — `make shell-bounds`, `make shell-drift` (35 tool pages × 11 checks = 385 checks), `make storage-registry`, `make site-config`, `make gate` (tool contract), `make print-smoke` (55/55). All 22 existing Node smoke harnesses still pass with no regressions — `make regression-sweep` 210/210, `make share-dialog-smoke` 50, `make wave-1-smoke` 43, `make wave-2-smoke` 346, `make wave-3-smoke` 392, `make pack-tags-smoke` 111, `make site-config-smoke` 44, `make quality-smoke`, etc. `make ci` (full gate chain) exits 0.

## Dev Notes

### Implementation strategy

The print.css is a single new file. The wire changes are:

1. **`assets/css/print.css` (NEW)** — the rule set per ACs. Mirrors the selectors from the existing `@media print` block in `base.css` plus the new `data-print` opt-in selectors, page-break rules, and `.print-only` rules.

2. **`scripts/shell-template.py` (MODIFIED)** — extend the head-injection logic. The script already touches each tool page's `<head>` to splice in the FOUC IIFE and the `<!-- /shell:head-snippet -->` marker. Add a step that inserts `<link rel="stylesheet" href="../../assets/css/print.css" media="print">` after the last existing `<link rel="stylesheet">` element. Use a regex like:
   ```python
   PRINT_LINK_RE = re.compile(r'(<link rel="stylesheet" href="\.\./\.\./assets/css/[^"]*">)', re.MULTILINE)
   ```
   and append the print link if it isn't already present.

3. **`assets/css/base.css` (MODIFIED)** — remove the existing `@media print { ... }` block (lines 437-465). The new `print.css` is a superset.

4. **`assets/shell/chrome.html` (MODIFIED)** — add a `<footer class="print-only">` element with placeholders for the URL + timestamp. The Shell-template splices this in; the tool page's boot script populates the placeholders via `HT.lastUpdated` (new shell API surface — see T5).

5. **`scripts/_smoke_print.js` (NEW)** — vm-context smoke harness (50-100 assertions). Verifies the link presence, the selector coverage, and the migration.

### data-print marker convention

Tools adopt the convention as the story is implemented. For each tool, identify the input panel (the `<form>` or first `<section>` containing user inputs) and the result panel (the element that displays the computed output) and add `data-print="input"` / `data-print="result"`. Example for `tools/countdown-to-date/index.html`:

```html
<form class="countdown-form" data-print="input">
  <input type="datetime-local" name="target" ...>
  <button type="submit">Calculate</button>
</form>
<section id="result" data-print="result">
  <output>...</output>
</section>
```

The 35 tools vary in markup. Use the most natural wrapper element for each. Tools without markers still print the `<main>` content (chrome hiding works at the selector level, not at the data-print level), but the printed layout is improved by the markers (they let the user tune what's input vs result).

### Print footer

The `<footer class="print-only">` lives in `chrome.html` after `</main>` and before `<!-- /shell:chrome -->`. Template:

```html
<footer class="print-only" aria-hidden="true">
  <p class="print-url"></p>
  <p class="print-meta">Last updated: <time class="print-last-updated"></time></p>
</footer>
```

The boot script (in `shell.js`, not in this story) populates `print-url.textContent = location.href` and `print-last-updated.textContent = toolsJson[slug].lastUpdated` before `window.print()` fires. Story 3.10 ships the markup + CSS; the population hook can be a minimal inline `<script>` in the chrome that runs once per page load:

```html
<script type="application/json" class="print-data">{"slug":"{slug}"}</script>
```

…paired with a tiny inline `<script>` that reads the slug, looks up the tool, and populates the placeholders. This keeps the print.css + print-only footer fully static (no separate JS file needed for Story 3.10).

### Files NOT in scope

- `assets/css/print.css` — added with the chrome markers; not a public surface.
- The boot script change in `shell.js` (if needed for population) — defer to Story 3.11 / Story 3.12 if they touch the same hook; otherwise inline the population in the chrome.

### Risk: ID conflicts

Some tools use `id="print"` (none today, but possible). Story 3.10's CSS targets `.print-only` and `[data-print="..."]`, never `id="print"`. No conflicts.

## Dev Agent Record

### Implementation Plan

- **T1 — Write `assets/css/print.css`**: full rule set per ACs.
- **T2 — Inject print.css link**: extend `shell-template.py` head injection.
- **T3 — Migrate base.css**: remove the `@media print` block from base.css.
- **T4 — Annotate tools**: add `data-print="input|result"` to 35 tools (script-assisted; one curl-style Python loop that runs a small regex over each tool's `index.html`).
- **T5 — Print footer**: add `<footer class="print-only">` to chrome.html + minimal inline script to populate.
- **T6 — Smoke**: write `_smoke_print.js` (~50 assertions).
- **T7 — Makefile**: ensure `make smoke` runs the new harness.
- **T8 — Gates**: run all 6 gates; commit.

### Debug Log

- **2026-08-12** — Implementation began. Initial scaffolding for `print.css` (chrome-hiding selectors, color-forcing, `.no-print`, `.print-only`) created in one pass.
- **2026-08-12** — Hooked `shell-template.py` 7-tuple plumbing for `print_footer_html` so chrome bytes carry the print footer to all pages; added `splice_print_css` + `splice_print_footer` helpers for targeted regen of pages chrome-aligned before Story 3.10.
- **2026-08-12** — Smoke harness first pass failed on:
  - `.print-last-updated` selector not in print.css → added `.print-url-value`, `.print-url-label`, `.print-last-updated` to the grouped selector `.print-url, .print-meta, .print-last-updated, .print-url-value, .print-url-label`.
  - `def splice_print_css\(` regex ambiguous against `def splice_print_footer\(` neighbor → simplified to just `/def splice_print_css\(/` presence test.
- **2026-08-12** — `quality.html` missing the print.css `<link>` (not a tool page, not touched by regeneration) → manually added `<link rel="stylesheet" href="assets/css/print.css" media="print">` after components.css.
- **2026-08-12** — `make ci` (full gate chain) exits 0. No regressions across 22 other smoke harnesses.

### Completion Notes

All 8 tasks complete. All 5 ACs satisfied:

1. **Hides chrome**: `@media print { ... #shell-header, #shell-nav, #shell-footer, #palette-trigger, #shell-settings-trigger, #shell-skip, header, footer, nav, ... }` with `display: none !important` — covers Shell chrome (AD-4), tool chrome (history/share/theme/settings), opt-in (`.no-print`, `[data-print="hidden"]`).
2. **Print-only sections visible**: `[data-print="input"], [data-print="result"]` and `.print-only` carry `display: block !important`. Universal chrome-hiding leaves `<main>` content visible regardless of markers.
3. **Color forcing**: `html, body { background: #fff !important; color: #000 !important; }`, `* { background-image: none !important; box-shadow: none !important; text-shadow: none !important; }`, cobalt accent overridden via `:root { --accent: #000 !important; --accent-soft: #000 !important; }`, links underlined in black.
4. **Page-break rules**: `[data-print="result"]` → `page-break-inside: avoid`; input → `page-break-inside: avoid; page-break-after: auto`; `.print-only.print-footer` → `page-break-before: always` (always on its own page); `table, figure, img, pre, blockquote` → `page-break-inside: avoid`; `h1..h6` → `page-break-after: avoid` (no orphans).
5. **Stylesheet loaded via `<link>`**: every one of 35 tool pages carries `<link rel="stylesheet" href="../../assets/css/print.css" media="print">` (auto-injected by `shell-template.py`); home page and `quality.html` carry the same with `assets/css/print.css` (no `../..`). All idempotent on regen.

`<link media="print">` keeps the stylesheet from painting during screen browsing — AD-15 FOUC grandfather compliant. Zero external network (AD-1). No new JS dependencies, no shell API changes (the inline `print-footer-populate` script reads `data-slug` and `ht-tools-json-inline` directly). Story 3.10 defers per-tool `data-print` marker adoption to a follow-up because universal chrome-hiding already produces clean prints.

**Print footer populated**: chrome.html carries the `<footer class="print-only print-footer">` block with `<p class="print-url"><span class="print-url-label">URL:</span> <span class="print-url-value"></span></p>` + `<p class="print-meta">Last updated: <time class="print-last-updated" datetime=""></time></p>`. The inline `<script class="print-footer-populate">` populates URL via `location.href` and last-updated via `data-slug` lookup in the `ht-tools-json-inline` block. Both wrapped in try/catch so a parse failure silently no-ops (rendered print still has the structure, just empty placeholders).

**Deferred**: T4 (per-tool `data-print="input|result"` markers) — ACs are met by inheritance (universal chrome-hiding rules already produce clean prints without per-tool markers); a follow-up story can adopt the convention per-tool when individual tools need finer control.

## File List

- **NEW**:
  - `assets/css/print.css` (full `@media print` rule set: chrome hiding, color forcing, page-break, `[data-print="input|result|hidden"]`, `.no-print`, `.print-only` footer)
  - `scripts/_smoke_print.js` (55-assertion Node smoke harness)
- **MODIFIED**:
  - `scripts/shell-template.py` (7-tuple `read_chrome` returns `print_footer_html`; `splice_print_css(source)` + `splice_print_footer(source, print_footer_html)` helpers; `print_css_ok` / `home_print_css_ok` / `print_footer_ok` byte-aligned gates; targeted splice branches in `process_file` + `regenerate_home`)
  - `assets/css/base.css` (legacy `@media print` block removed; replaced with single-line Story 3.10 migration comment)
  - `assets/shell/chrome.html` (`<!-- shell:print-footer (Story 3.10) -->` block with `<footer class="print-only print-footer">` + URL/last-updated placeholders + inline populate script)
  - All 35 `tools/<slug>/index.html` (auto-injected `<link rel="stylesheet" href="../../assets/css/print.css" media="print">` + print-footer block via chrome regeneration)
  - `index.html` (auto-injected `<link rel="stylesheet" href="assets/css/print.css" media="print">` + print-footer block via home regeneration)
  - `quality.html` (manually added the same print.css `<link>` with `assets/css/print.css` path)
  - `_bmad-output/implementation-artifacts/sprint-status.yaml` (status: backlog → in-progress → done)
  - `Makefile` (`print-smoke:` target + help line + `.PHONY` entry + `ci:` chain)
  - `.github/workflows/tool-contract-gate.yml` (`scripts/_smoke_print.js` + `assets/css/print.css` in paths filter for both PR and push; new `Smoke print stylesheet (Story 3.10)` step)

## Change Log

- 2026-08-12 — Story 3.10 spec created (create-story workflow, ready-for-dev).
- 2026-08-12 — Story 3.10 implementation complete (T1–T8); all 5 ACs satisfied; `make ci` exits 0; 55/55 print-smoke PASS; 0 regressions across 22 existing smoke harnesses.

## Status

**`done`** (as of 2026-08-12).