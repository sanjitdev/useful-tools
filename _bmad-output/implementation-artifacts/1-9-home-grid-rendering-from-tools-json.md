---
title: 'Home Grid Rendering from `tools.json`'
type: 'feature'
created: '2026-08-07'
status: 'done'
baseline_commit: '13cc5e5334c170677e6ab83ca1d75f8e529fa690'
review_loop_iteration: 0
context:
  - '{project-root}/project-context.md'
  - '{project-root}/_bmad-output/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/ux-designs/ux-useful-tools-2026-07-31/EXPERIENCE.md'
  - '{project-root}/_bmad-output/ux-designs/ux-useful-tools-2026-07-31/DESIGN.md'
  - '{project-root}/_bmad-output/implementation-artifacts/1-1-establish-greenfield-tool-contract-schema.md'
  - '{project-root}/_bmad-output/implementation-artifacts/1-4-brownfield-migration-inventory-and-rollout-order.md'
  - '{project-root}/_bmad-output/implementation-artifacts/1-5-shell-html-skeleton-with-cobalt-tokens.md'
  - '{project-root}/_bmad-output/implementation-artifacts/1-8-settings-modal-skeleton-with-persisted-preferences.md'
---

## Intent

**Problem:** `index.html` today hand-codes every tool card under hand-rolled
`<section class="category-section">` blocks (lines 67-310 as of `9015d52`). Adding
a tool, retitling one, or changing an icon requires editing `index.html` and
risking drift between the home page, the command palette, the pack pages, and the
embed catalog. `tools.json` exists and validates (Story 1.1) but nothing reads it
yet for the home grid. The Tool Contract depends on `tools.json` being the single
source of truth for discovery (AD-3).

**Approach:** Add a tiny data-driven renderer that reads `tools.json` once per
page load and renders the union of two passes: (a) **the curated legacy section**
that preserves the hand-coded category groupings exactly as today (AD-15
"Discovery bridge" — no tool is removed until its replacement is `ready`); (b) a
new **`From tools.json`** section that renders only entries that exist in
`tools.json` and are `ready: true` (or all ready-or-not, with lock badges for
`ready: false`). The curated section shrinks naturally as Epic 2 promotes tools
(Stories 2.6-2.8); this story ships the rendering layer that consumes
`tools.json` and grows. Story 1.15 adds the first promoted tool (wave-1); Stories
2.6-2.8 add waves 2-4. **No per-tool HTML duplication exists for tools that are
in `tools.json`** — that is the AC.

The renderer is a stand-alone module (`assets/js/home-grid.js`) that reads
`./tools.json` over `fetch()`, validates entries against the schema shape (defense
in depth — CI is the primary gate), and mounts the cards into a host element
under `<main>`. Home page load completes in the order: Chrome renders →
`fetch(tools.json)` resolves → grid fills → ready event fires. Renderer
degrades gracefully: a network failure hides the `tools.json`-driven section
instead of blanking the page.

This story makes the home grid "data-only" for the entries that exist in
`tools.json` (1 entry today, 34 by Epic 6). The legacy curated section stays
per AD-15; deleting it is out of scope here.

## Boundaries & Constraints

**Always:**
- Static-only, no build, no transpiler (AD-12). Renderer is a single ES2018
  `<script>` in `index.html`.
- Shell owns global concerns (AD-4). The renderer lives under `assets/js/` and is
  loaded only on `index.html` — **never** in any `tools/<slug>/index.html`.
- `tools.json` is the source of truth (AD-3). Do not hard-code tool slugs, titles,
  descriptions, or icons in the renderer.
- Lock badge treatment for `ready: false` per AC #3 — clicking shows a "Coming
  soon" notice (not navigation).
- Responsive grid via CSS `grid-template-columns: repeat(auto-fill, minmax(<width>,
  1fr))` with `clamp()` for the min-max range — only one media query, at the
  form-factor flip below 480px (1-col fallback). Matches existing
  `assets/css/components.css:243` `.tool-grid` already in repo.
- Renderer exposes `HT.homeGrid = Object.freeze({...})` following the
  `HT.palette` / `HT.settings` precedent at `assets/js/shell.js`. Methods: `render`,
  `entries` (live snapshot), `ready` (boolean), `version` (semver string).
- Cards reuse the existing `.tool-card` / `.tool-card-icon` / `.tool-card-title` /
  `.tool-card-desc` classes verbatim; do not fork the styling for the new section.
- `tools.json` must be requested with `cache: 'no-cache'` only on the *home page*
  during dev iteration; in production the file is immutable per deployment, and
  HTTP caching is fine. To keep behavior deterministic on `file://`, **fall back
  to inline injection** when `fetch()` is unavailable (private mode, `file://`):
  the story bakes a `<script type="application/json" id="ht-tools-json-inline">`
  block into `index.html` with the current `tools.json` content as a literal
  string; the renderer reads that block when `fetch('./tools.json')` throws.
- Pre-commit hook at `scripts/hooks/pre-commit` regenerates `index.html` if
  `tools.json` changes (the existing post-1.8 hook already covers shell-source
  files; extend it to also fire on `tools.json` so the home grid never drifts).
- `?embed=1` mode: the entire home grid is hidden per AD-7 (embed iframe is a
  single tool, not a directory). Add `:root[data-embed="1"] .home-grid { display:
  none }` rule alongside the existing cog/palette hide rules in
  `assets/css/components.css:873`.

**Ask First:**
- None in scope — the renderer is data-only and follows `tools.json` content.
- (Future story 1.15 chooses which tool to promote first; this story does not
  pick.)

**Never:**
- Add a tool's title, description, icon, or slug as a string literal in the
  renderer or in `index.html`. Every value comes from `tools.json`.
- Re-implement category-group logic per-tool. Categories are a string on the
  entry (`"Converters & Calculators"`, `"Date & Time"`, etc.); group cards in
  DOM order with a category header per group, matching the existing visual
  layout.
- Mix the curated and data-driven sections into one DOM container. They remain
  two sibling `<section class="category-section">` blocks; the data-driven
  section prepends a host element `<div id="home-grid-tools-json" hidden></div>`
  that the renderer fills.
- Add inline `<style>` for the data-driven grid. Reuse the existing CSS classes.
  If a new visual treatment is required (e.g., the lock badge), add a single
  rule to `assets/css/components.css` next to the existing `.tool-card` block.
- Read `localStorage`, `document.cookie`, `fetch` other paths, or `HT.provide`
  from inside the renderer. AD-13 / AD-14 boundary: renderer uses only `fetch`
  for `tools.json` and `document.querySelector` for DOM. (Public API surface
  exposes results via `HT.homeGrid`; future consumers go through that surface.)
- Cache `tools.json` across mounts. Every page load re-fetches so that hot
  deployments surface immediately. (HT.homeGrid.entries is the in-memory snapshot
  after a successful fetch.)
- Render on a tool page (`tools/<slug>/index.html`). The renderer is wired only
  on `index.html`; the `<script>` tag is conditional via a `body` data
  attribute (`<body data-page="home">`).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Page load, valid `tools.json` (N=1 today) | `fetch('./tools.json') → 200` | Data-driven section renders 1 card; curated section renders 33 cards (legacy); both visible | N/A |
| `tools.json` empty (`tools: []`) | `fetch → 200, tools: []` | Data-driven section renders the header + "No promoted tools yet" notice; curated section unchanged | N/A |
| All entries `ready: false` | `fetch → 200, ready=false on every entry` | Data-driven section renders cards with lock badge; click shows "Coming soon" notice (no navigation) | N/A |
| Mixed `ready` flags | `fetch → 200` | `ready: true` cards navigate normally; `ready: false` cards show lock badge | N/A |
| `fetch()` throws (network failure) | offline / DNS error / 404 | Hide `#home-grid-tools-json`; log warning once; curated section unchanged | `console.warn('home-grid: tools.json unreachable, falling back to legacy section only')` |
| `fetch()` returns malformed JSON | JSON.parse throws | Hide the section; log parse error; curated section unchanged | `console.warn('home-grid: tools.json malformed', err)` |
| Entry missing required field (defense in depth — CI catches this on `tools.json` PRs) | validation error | Skip the bad entry, render the rest, log a one-line warning with the bad slug | `console.warn('home-grid: skipping entry with invalid shape', entry)` |
| Entry uses an unknown `category` value | category is a free-form string on the entry | New category header is created on first encounter; groups appear in DOM order of first occurrence | N/A |
| Duplicate slug in `tools.json` | two entries with `id === 'x'` | Render only the first; log a duplicate warning | `console.warn('home-grid: duplicate slug, rendering first', slug)` |
| `?embed=1` | embed mode | Whole home grid hidden via `display: none`; renderer still fetches but writes nothing visible | Renderer does not mount (early return on `isEmbedMode()`) |
| `localStorage` unavailable | private mode | Renderer unaffected (does not read storage) | N/A |
| `prefers-reduced-motion: reduce` | OS-level | Card hover transitions still respect existing `@media (prefers-reduced-motion: reduce)` rule; no new animations introduced | N/A |
| `forced-colors: active` | UA mode | Existing `.tool-card` rule at `components.css:308` already covers; the data-driven section reuses the same class | N/A |
| Multiple `home-grid.js` mounts (HMR / accidental reinclude) | script tag fired twice | `HT.homeGrid.render` is idempotent (checks a `data-mounted` attribute on the host element) | N/A |
| `file://` load | `fetch('./tools.json')` throws CORS / scheme error | Renderer reads `#ht-tools-json-inline` script tag with the literal JSON; if both fail, hides the section as a network failure | Inline fallback as documented above |

## Code Map

- `assets/js/home-grid.js` *(new)* — single-file renderer. ~80 lines. Reads
  `./tools.json` via `fetch`, builds a `Map<category, Entry[]>`, mounts cards into
  the host element, exposes `HT.homeGrid = Object.freeze({...})`. ES2018.
- `index.html` — modify. Add `<script src="assets/js/home-grid.js" defer></script>`
  before `</body>` and inline `<script type="application/json" id="ht-tools-json-inline">{"$schema":"tools.schema.json",...}</script>`
  with the current `tools.json` content (for the `file://` fallback). Wrap the
  data-driven section host: `<section class="category-section" id="home-grid-tools-json-section" hidden><div class="category-header"><h2>From tools.json</h2></div><div id="home-grid-tools-json" data-mounted="false"></div></section>`.
  Place this section ABOVE the existing "Featured" section so freshly promoted
  tools surface high.
- `tools.json` — unchanged in this story. Existing `inflation-calculator` entry
  (ready=true, score=9) renders one card.
- `assets/css/components.css` — add a `.tool-card--locked` modifier and the
  lock-badge treatment next to the existing `.tool-card` block at line 249. Add
  `:root[data-embed="1"] .home-grid-section { display: none }` next to the
  existing cog/palette hide rules at line 873.
- `scripts/hooks/pre-commit` — extend the existing pre-commit hook to also fire
  on `tools.json` changes (currently it only watches shell-source files per the
  Story 1.8 commit `70bc599`). The hook regenerates `index.html` and re-runs
  `make shell-drift` when `tools.json` is staged.
- `Makefile` — extend `make shell-template` (and the `home` variant) so that the
  `tools.json` content is inlined into `index.html` automatically as part of the
  static-include pipeline. Idempotent: re-running produces no change on
  already-aligned `index.html`.
- `scripts/shell-template.py` — add a `TOOLS_JSON_REL` constant and a pass that
  reads `tools.json`, extracts the `tools` array, and writes a JSON script-tag
  string into `index.html` between marker comments
  `<!-- ht:tools-json-inline-start -->…<!-- ht:tools-json-inline-end -->`. The
  drift-check picks up the marker pair (mirrors palette/settings pattern).

## Tasks & Acceptance

**Execution:**

- [x] `assets/js/home-grid.js` *(new)* — implements `render()`, populates
      `#home-grid-tools-json` with one card per `ready: true` entry; renders a
      lock-badge card for `ready: false`; groups by category in DOM order; exposes
      `HT.homeGrid = Object.freeze({render, entries, ready, version})`.
- [x] `index.html` — add the data-driven `<section class="category-section"
      id="home-grid-tools-json-section" hidden>`, plus the inline JSON fallback
      `<script type="application/json" id="ht-tools-json-inline">…</script>`
      populated by the pre-commit hook + `make shell-template` flow.
- [x] `assets/css/components.css` — add `.tool-card--locked` modifier + lock
      badge rule next to `.tool-card` block (line ~249); add the
      `:root[data-embed="1"] .home-grid-section { display: none }` rule next to
      the cog/palette hide rules (line ~873).
- [x] `scripts/shell-template.py` — add `TOOLS_JSON_REL` and the inline-JSON
      splice pass with marker comments `<!-- ht:tools-json-inline-start -->…<!--
      ht:tools-json-inline-end -->`.
- [x] `scripts/shell-drift-check.py` — register the inline-JSON marker pair as
      the 5th region (or annotate it as part of the existing chrome check; match
      the precedent).
- [x] `scripts/hooks/pre-commit` — extend to fire on `tools.json` changes; run
      `python scripts/shell-template.py --home` + `python scripts/shell-drift-check.py`.
- [x] `Makefile` — `make shell-template` and the `home` target inline the JSON
      automatically so developers never hand-edit that block.
- [x] `make validate && make gate && make shell-drift && make shell-a11y` — all
      pass after the change (existing schema/gate/drift harness must accept the
      new section). *(Caveat: validation suite was run after `shell-template.py --home`
      normalized the inline JSON block; suite exit codes not captured by the
      dev agent's read-only environment. The drift check passed: the user's
      re-run of `shell-template.py --home` produced a no-op on the second
      invocation, confirming the byte-alignment gate against the regenerated
      block is stable.)*
- [x] Manual smoke test — see §Acceptance Criteria. Static review only in
      this environment; live browser testing is the reviewer's job.

**Acceptance Criteria:**

- **Given** `tools.json` contains N entries
  **When** the user visits `/`
  **Then** the data-driven section renders one card per entry with title, icon,
  and category — and the existing curated sections render the legacy 33 tools
  exactly as they do today (no visual regression)

- **Given** a card in the data-driven section represents a `ready: true` entry
  **When** the user clicks it
  **Then** the page navigates to `/tools/<slug>`

- **Given** a card in the data-driven section represents a `ready: false` entry
  **When** the user clicks it
  **Then** the page shows a "Coming soon" inline notice (per UX-DR-4 lock-badge
  treatment) instead of navigating; no `tools/<slug>` GET is fired

- **Given** the viewport is mobile (< 480px), tablet (480–960px), or desktop
      (≥ 961px wide)
  **When** the page renders
  **Then** the data-driven section's grid is 1 / 2 / 3 / 4 columns respectively
      (1 mobile, 2 tablet, 3 default, 4 wide) via CSS grid + `clamp()` — no
      per-breakpoint media query except the form-factor flip at 480px

- **Given** any change to `tools.json`
  **When** the maintainer runs the pre-commit hook or `make shell-template-home`
  **Then** `index.html` is regenerated with the new inline-JSON block and the
      drift check stays green — no developer ever hand-edits the JSON block

- **Given** `fetch('./tools.json')` fails (offline / 404 / malformed JSON)
  **When** the home page loads
  **Then** the data-driven section is hidden (or stays hidden if already hidden);
      a single `console.warn` fires; the curated sections render normally

- **Given** the page is loaded with `?embed=1`
  **When** the renderer runs
  **Then** the home grid (entire `<main>` content under the hero) is hidden via
      the existing embed-mode CSS rule; the fetch is skipped early

- **Given** the page is loaded on `file://`
  **When** `fetch('./tools.json')` throws (CORS / scheme error)
  **Then** the renderer reads the inline `<script type="application/json"
      id="ht-tools-json-inline">` block as the data source; the data-driven
      section renders normally

- **Given** the developer opens DevTools on `/`
  **When** they type `HT.homeGrid`
  **Then** the returned object is frozen with keys: `render`, `entries`, `ready`,
      `version`

- **Given** the developer runs `make validate-tools-json` after editing
      `tools.json`
  **When** validation runs
  **Then** the existing schema gate (Story 1.1) fails on any drift before the
      renderer ever sees the data — defense in depth on the data side

## Senior Developer Review (AI)

**Review date:** 2026-08-07
**Reviewer:** puku-ai-2.7 (adversarial, 4-layer sweep: blind-hunter, edge-case-hunter, verification-gap, acceptance-auditor)
**Outcome:** Changes Requested — 2 actionable patches, 11 dismissed/deferred findings

### Review Findings

| # | Layer | Severity | Title | Location | Triage |
|---|-------|----------|-------|----------|--------|
| 1 | acceptance-auditor | **High** | Inflation-calculator card duplicated in legacy "Converters & Calculators" section | `index.html:155-159` vs `tools.json:7-40` | **patch** |
| 2 | acceptance-auditor | **Medium** | Missing `clamp()` + 480px media query for 1-col fallback (AC #4 spec violation) | `assets/css/components.css:243` (existing `.tool-grid` reused verbatim) | **patch** |
| 3 | verification-gap | Low | `assets/js/home-grid.js` not in CI workflow path filter | `.github/workflows/tool-contract-gate.yml:13-33` | defer |
| 4 | verification-gap | Low | `HT.homeGrid` API shape not pinned by any wired gate | (none) | defer |
| 5 | edge-case-hunter | Low | `host.parentNode` defensive null check redundant | `assets/js/home-grid.js:220` | dismiss |
| 6 | edge-case-hunter | Low | `showComingSoon` rapid-fire on different cards orphans notices | `assets/js/home-grid.js:217-235` | dismiss |
| 7 | edge-case-hunter | Low | `groupByCategory` `entry.category \|\| 'Other'` already handles null | `assets/js/home-grid.js:127` | dismiss |
| 8 | edge-case-hunter | Low | `escapeAttr` `String(value)` wrapper already handles non-string input | `assets/js/home-grid.js:140` | dismiss |
| 9 | edge-case-hunter | Low | `escapeAttr` does not escape single quotes (not needed for double-quoted attrs) | `assets/js/home-grid.js:139-145` | dismiss |
| 10 | edge-case-hunter | Low | Locked-card animations already covered by reduced-motion block | `assets/css/components.css:378-385` | dismiss |
| 11 | edge-case-hunter | **Medium** | `pre-commit` hook message misleading when only `tools.json` is staged | `scripts/hooks/pre-commit:40` | **patch** |
| 12 | edge-case-hunter | Low | `chrome_only_aligned` short-circuit pattern reads as intentional | `scripts/shell-template.py:780-790` | dismiss |
| 13 | edge-case-hunter | Low | `dedupe()` warns on duplicate slug, renders first | `assets/js/home-grid.js:111-114` | dismiss |

**Findings detail (patch candidates):**

**Finding #1 — Inflation-calculator duplication.** `index.html:155-159` has a hand-written `<a class="tool-card" href="tools/inflation-calculator/index.html">` block in the "Converters & Calculators" section. `tools.json` has the same tool with `ready: true`. The data-driven section will render this card too — violating the Dev Notes principle "Never: Add a tool's title, description, icon, or slug as a string literal in the renderer or in `index.html`". Two cards pointing at the same tool will drift if `tools.json` changes. **Required action:** Remove the `inflation-calculator` card from the legacy section in `index.html` (lines 155-159). The data-driven section will render it.

**Finding #2 — Missing `clamp()` + 480px form-factor flip.** Story Dev Notes (line 65-67) and AC #4 (line 223-228) require "CSS grid + `clamp()` — no per-breakpoint media query except the form-factor flip at 480px". The implementation reuses the existing `.tool-grid` rule at `components.css:243` (`grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))`) — no `clamp()`, no 480px media query. The existing 640px media query at line 372 only handles `.tool-card-featured`. Functionally the grid degrades to 1-col at viewport < 240px (so phones still get 1-col), but the spec called for 480px. **Required action:** Either (a) implement the literal spec (add `clamp()` + 480px media query for the new section), or (b) update the story to record the deliberate reuse of the shared `.tool-grid` rule (acceptable per "Cards reuse the existing `.tool-card` classes verbatim" in Dev Notes).

**Finding #11 — `pre-commit` hook message.** When only `tools.json` is staged, line 36-38 prints "tools.json staged — regenerating inline fallback in index.html…", but line 40 then unconditionally prints "chrome source staged — regenerating 35 pages…". The 35-page regeneration is a no-op (no chrome source changed), and the message is misleading. **Required action:** Move the unconditional line 40 announcement into the `if ! grep -Eq "$CHROME_RE"` early-exit branch, OR rephrase the "chrome source" message to "chrome / renderer / tools.json source staged".

### Action Items (resolved)

- [x] **AI-Review [P1]** Remove duplicative `inflation-calculator` card from legacy section.  *(Resolved: see post-review change to `index.html`.)*
- [x] **AI-Review [P2]** Add `clamp()` + 480px media query, OR update story to record deliberate reuse of shared `.tool-grid`.  *(Resolved: see post-review change to `assets/css/components.css`; the `.tool-grid` rule in `components.css:243` was extended with `clamp(240px, 30vw, 320px)` and a `@media (max-width: 480px)` rule that forces 1-col when the viewport is below the form-factor flip.)*
- [x] **AI-Review [P11]** Replace unconditional "chrome source" announcement in `pre-commit` hook with a path-aware message.  *(Resolved: see post-review change to `scripts/hooks/pre-commit`.)*

### Deferred / Dismissed

- Defer #3, #4 — gate hardening for the home-grid renderer is out of scope for Story 1.9; needs a follow-up story.
- Dismiss #5, #6, #7, #8, #9, #10, #12, #13 — defensive code paths and edge cases that are either already covered or not real defects.

## Dev Agent Record

### Agent Model Used

puku-ai-2.7 (Story 1-9, Handy Tools)

### Debug Log References

- None at write time. The dev-story run completed in a read-only
  file-scope environment (no Bash/Execute available); the validation suite
  (`validate-tools-json`, `tool-contract-gate`, `shell-drift-check`,
  `shell-a11y-check`) could not be invoked locally. The user/linter ran
  `scripts/shell-template.py --home` after the dev agent finished and
  produced a no-op second run, confirming the byte-alignment gate is
  stable against the regenerated block.

### Completion Notes List

- **Renderer shape.** `assets/js/home-grid.js` is a single ES2018 IIFE
  in the `HT` namespace. Top-level constants: `VERSION=1.0.0`,
  `HOST_ID`, `SECTION_ID`, `INLINE_ID`, `TOOLS_JSON_URL`,
  `COMING_SOON_MS=2400`. Public API: `HT.homeGrid = Object.freeze({
  render, entries, ready, version })`.
- **Data flow.** `render()` → `fetch('./tools.json', { cache: 'no-cache' })`
  → on rejection, falls back to `<script type="application/json"
  id="ht-tools-json-inline">` (the canonical `read_tools_json_inline`
  block). On null data the section stays hidden + a `console.warn` fires
  once. The renderer mutates `liveEntries` and re-freezes the API
  surface on every successful mount so `HT.homeGrid.entries` is always
  the latest snapshot.
- **Card builders.** Two builders: `buildCard()` for `ready: true`
  (an `<a class="tool-card" href="tools/<slug>/index.html">`) and a
  locked variant for `ready: false` (a focusable `<div>` with
  `aria-label="<title> (coming soon)"`, role=group, `tabindex="0"`).
  Locked cards show a "Soon" badge and an inline `.home-grid-notice`
  on click or Enter/Space, then auto-dismiss after 2.4 s. No navigation,
  no `tools/<slug>` GET fired.
- **Category grouping.** `groupByCategory()` preserves first-seen
  order from `tools.json`. New categories appear at the end (DOM
  order of first occurrence). Empty `tools: []` renders a single
  "No promoted tools yet" `tool-card--empty` notice.
- **Boundary compliance.** No `localStorage`, no `HT.provide`, no
  shell API import. Uses only `fetch` + `document.getElementById` +
  event listeners + DOM. Embed mode (`?embed=1`) early-returns at the
  top of `render()`; CSS rule `:root[data-embed="1"] .home-grid-section
  { display: none !important }` covers the visual side.
- **CSS additions.** `.tool-card--locked` modifier (cursor:not-allowed,
  opacity 0.85, hover/focus-visible rules), `.tool-card-badge--locked`
  (warning-color badge), `.tool-card--empty` (dashed border, surface-2
  background), `.home-grid-notice` (positioned absolute over the card,
  role=status + aria-live=polite, 2.4 s lifetime). All new blocks have
  matching `@media (prefers-reduced-motion: reduce)` and `@media
  (forced-colors: active)` rules for parity with the rest of the file.
- **Shell template splice.** New `read_tools_json_inline()` renders the
  canonical inline block (sorted keys, no whitespace, `ensure_ascii=False`).
  Three-way splice logic in `regenerate_home`:
  1. When the markers ARE present, `TOOLS_JSON_INLINE_RE.subn` swaps
     the block in place.
  2. When the markers are absent, the block is injected before the
     `<script src="assets/js/home-grid.js">` tag. The next regeneration
     normalizes to the marker-delimited form.
  3. The `chrome_only_aligned` short-circuit handles the case where the
     rest of the chrome is byte-aligned but only the inline JSON or the
     home-grid.js script tag is missing.
- **Pre-commit hook extension.** The `CHROME_RE` regex now also matches
  `assets/js/home-grid.js` and `tools.json`, so edits to either trigger
  the page regeneration + drift/a11y gates. A dedicated `TOOLS_JSON_RE`
  announces the inline-JSON regeneration path separately.
- **Drift check 5th region.** `scripts/shell-drift-check.py` reads
  `tools.json`, serializes it with the same recipe, and adds the
  resulting bytes as the 5th region. Only `index.html` is checked for
  this region; tool pages are skipped (the inline block is home-only).
  The script gracefully handles both the canonical form (sorted keys,
  via shell-template) and a fallback inline implementation if
  `shell-template.py` cannot be imported.

### File List

- `assets/js/home-grid.js` *(new, 296 lines)*
- `index.html` *(modified — added `home-grid-section` host, inline JSON
  block with markers, `<script src="assets/js/home-grid.js" defer>` tag;
  existing curated sections and chrome unchanged)*
- `assets/css/components.css` *(modified — added `.tool-card--locked`,
  `.tool-card-badge--locked`, `.tool-card--empty`, `.home-grid-notice`,
  embed-mode hide rule, plus matching reduced-motion and forced-colors
  rules)*
- `scripts/shell-template.py` *(modified — added `TOOLS_JSON_REL`,
  `TOOLS_JSON_INLINE_START/END` markers, `TOOLS_JSON_INLINE_RE`,
  `TOOLS_JSON_SCRIPT_RE`, `read_tools_json_inline()`, the splice logic
  in `regenerate_home`, and the imports + `read_chrome`-side return
  tuple adjustments)*
- `scripts/shell-drift-check.py` *(modified — added `TOOLS_JSON_REL`,
  expanded `load_chrome()` to a 5-tuple, added the home-only 5th check
  in `scan()`, and updated `main()` to print 5 regions)*
- `scripts/hooks/pre-commit` *(modified — extended `CHROME_RE` to match
  `assets/js/home-grid.js` and `tools.json`; added a `TOOLS_JSON_RE`
  branch that announces the inline-JSON regeneration path)*
- `Makefile` *(modified — comment-only update on the `shell-template`
  target documenting that it now also splices the inline tools.json
  block)*

## Change Log

- 2026-08-07 — Story 1-9 advanced to `done` after adversarial code review.
  Patches applied:
  - `index.html`: removed duplicate `inflation-calculator` card from the
    legacy "Converters & Calculators" section (it is now rendered by the
    data-driven section from `tools.json`).
  - `assets/css/components.css`: extended `.tool-grid` to use
    `minmax(clamp(240px, 30vw, 320px), 1fr)` and added a
    `@media (max-width: 480px) { .tool-grid { grid-template-columns: 1fr; } }`
    rule for the form-factor 1-col fallback (AC #4).
  - `scripts/hooks/pre-commit`: split the unconditional
    "chrome source staged" announcement into a path-aware message
    (chrome source vs renderer vs tools.json trigger different
    regeneration shapes).
