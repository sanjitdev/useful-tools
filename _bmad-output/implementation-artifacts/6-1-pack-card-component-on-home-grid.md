---
title: 'Pack Card Component on Home Grid'
type: 'feature'
created: '2026-08-08'
status: 'done'
baseline_commit: 'e3c44b0f706ab3f8ca79d61217906f7a8595d780'
context:
  - '{project-root}/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/epics.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-useful-tools-2026-07-31/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-useful-tools-2026-07-31/DESIGN.md'
  - '{project-root}/_bmad-output/implementation-artifacts/1-9-home-grid-rendering-from-tools-json.md'
  - '{project-root}/_bmad-output/implementation-artifacts/1-15-first-promoted-tool-lands-on-home-grid.md'
---

# Story 6.1: Pack Card Component on Home Grid

## Story

**As a** user landing on `/`,
**I want** to see pack cards (Travel/Finance/Study/Developer/Household) above or alongside the tool grid,
**So that** I can navigate by use case.

## Source

- **Origin:** `epics.md` §Story 6.1 specifies five pack cards on the home grid above/beside the tool grid. UX-DR-2 (Pack Card) defines the visual contract. AD-9 (cross-Tool via Site Data only) constrains the renderer to read from `tools.json` rather than hand-coded data.
- **Bind to architecture:** AD-3 (home grid data-driven from `tools.json`), AD-9 (cross-Tool via Site Data only — no per-tool pack wiring in `tools.json`), AD-13 (Shell owns chrome — pack cards live on the Shell, not per-tool), AD-14 (frozen public API surface).
- **Bind to UX spine:** EXPERIENCE.md §2.3 (pack composition: 5 packs, each with tagline, ≥3 tools), §4 row 338 (Pack Card: pack name, one-line description, tool count, "Open pack" affordance; horizontal scroller on <md, grid on ≥md), §6.3 (No carousels in v1; pack rows are horizontal scrollers on <md with visible scroll affordance, not auto-rotating), §2.1 (Navigation Graph: home → click pack → /packs/<slug>).
- **Bind to PRD:** FR-6 (Pack Pages), FR-20 (per-tool pack tag), FR-21 (5 packs live + 12-15 new tools). Pack pages live at `/packs/<slug>.html` (ARCHITECTURE-SPINE.md row 334).
- **Bind to prior work:** Story 1.9 established `assets/js/home-grid.js` (renders "From tools.json" data-driven section at host `#home-grid-tools-json`). Story 1.15 promoted `qr-code-generator` as the first `tools.json` entry, proving the data path. Story 6.1 adds a *parallel* renderer for packs — same data source, different filter/host.

## Brownfield state (already in place by prior stories)

- `tools.json` carries the `pack` field on every entry (3 entries today: `lifespan-simulator` packs=`["household","study"]`, `inflation-calculator` packs=`["finance","household"]`, `qr-code-generator` packs=`["developer"]`).
- `assets/js/home-grid.js` (Story 1.9) renders the "From tools.json" tool grid at `#home-grid-tools-json` host element. The script reads `tools.json` via fetch with a `ht-tools-json-inline` fallback, walks `entry.pack`, and renders a `<a class="tool-card" href="tools/<slug>/index.html">` per entry.
- The 5 pack slugs (`travel`, `finance`, `study`, `developer`, `household`) are pinned by the schema's `pack.items.enum` constraint (`tools.schema.json` line 92).
- `index.html` carries the `<script src="assets/js/home-grid.js" defer>` tag at line 474 — every page picks up the script but the script early-returns unless host `#home-grid-tools-json` is present.
- Story 6.2 will own the `/packs/<slug>.html` renderer. Story 6.1 stops at the *card* (the entry point); Story 6.2 stops at the *destination*.

This story is the minimum: add a pack-card renderer that emits one `<a class="pack-card">` per pack (with ≥1 ready=true tool), each linking to `/packs/<pack-slug>.html`. Story 6.2 wires the destination page.

## Cancel-out rule (the science, briefly)

This story has no cancel-out rules — it's a renderer add. The pack count is purely additive to the page (a new horizontal scroller / row above the tool grid). Pack cards link to `/packs/<slug>.html`; if Story 6.2 hasn't shipped yet, those URLs are 404 — which Story 6.1 AC-3 acknowledges ("the destination page is published in Story 6.2; until then, the cards render and the link target resolves to a 404, which is acceptable for the Epic 6 sequencing").

## Acceptance Criteria

### AC-1 — Pack card renderer exists and is exposed under `HT.packGrid`

`assets/js/pack-grid.js` is a new file that follows the same shape as `assets/js/home-grid.js`:

- IIFE wrapper with `'use strict'`.
- Frozen `HT.packGrid = { render, packs, ready, version }` object (AD-14).
- `version: '1.0.0'`.
- `render()` is idempotent (checks `data-mounted` attribute on the host element; re-renders when called twice only if host element's data is stale).
- `packs` returns the array of pack descriptors (id, slug, title, description, icon, toolCount, tools) used by the most recent render.
- `ready` is a boolean that flips true on first successful render.

The renderer reads the same data as `home-grid.js`:
1. **Primary path:** `fetch('./tools.json')` with `{ cache: 'no-cache' }`.
2. **Fallback path:** `<script type="application/json" id="ht-tools-json-inline">` parsed inline (file:// fallback for environments where `fetch` throws CORS/scheme errors).

The script tag `<script src="assets/js/pack-grid.js" defer></script>` is added to `index.html` at line 475 (immediately after the `home-grid.js` tag at line 474, preserving script-tag order).

The renderer early-returns without mounting when `?embed=1` is set (embed mode hides chrome; pack cards are not chrome, but they are also not relevant inside an embedded tool — same rule as `home-grid.js`).

### AC-2 — Pack descriptors derive from `tools.json` entries

The renderer walks `data.tools[]` and groups by `entry.pack[]` membership. A pack appears in the rendered output **iff** it has at least one `ready: true` tool. (Empty packs are not rendered — Story 6.1 AC "empty packs (no `ready: true` tools) are not rendered".)

Pack descriptors are derived, not hand-coded:

| Field | Source |
|---|---|
| `slug` | The pack tag itself (must be one of `travel`, `finance`, `study`, `developer`, `household`) |
| `title` | Capitalized slug: "Travel", "Finance", "Study", "Developer", "Household" |
| `description` | The tagline from EXPERIENCE.md §2.3 (the 5-packs table) |
| `icon` | Inline SVG data-URL (cobalt stroke `#4f46e5`); one per pack — see AC-4 |
| `toolCount` | `data.tools.filter(t => t.ready && t.pack.includes(slug)).length` |
| `tools` | Array of `{ slug, title }` objects for the in-pack ready tools (used by `packs` API; not rendered inline) |

The 5 pack taglines (per EXPERIENCE.md §2.3) are:

| Pack | Tagline |
|---|---|
| travel | "For the road, the flight, the family trip." |
| finance | "For the numbers behind a decision." |
| study | "For essays, notes, exams." |
| developer | "For the bits that don't need a SaaS subscription." |
| household | "For the math of daily life." |

### AC-3 — Pack cards render above the main grid

`index.html` gains a new `<section>` element placed **above** the existing "From tools.json" data-driven section and below the hero/intro (where the hero is). Specifically:

```html
<section class="pack-section" id="home-grid-packs-section">
  <div class="category-header"><h2>Browse by Pack</h2></div>
  <div id="home-grid-packs" data-mounted="false"></div>
</section>
```

This section is placed immediately before the "From tools.json" data-driven section (the latter is at line ~67 in the current `index.html`).

The renderer injects one `<a class="pack-card" href="/packs/<slug>.html">` per non-empty pack into the host element. Each card has:

```html
<a class="pack-card" href="/packs/finance.html">
  <span class="pack-card-icon"><svg ...>...</svg></span>
  <span class="pack-card-title">Finance</span>
  <span class="pack-card-desc">For the numbers behind a decision.</span>
  <span class="pack-card-count">5 tools</span>
  <span class="pack-card-cta">View pack →</span>
</a>
```

The pack card link target resolves to `/packs/<slug>.html` — the destination page is published in Story 6.2. Until then, the cards render and the link target resolves to a 404, which is acceptable for the Epic 6 sequencing.

### AC-4 — Pack card uses the cobalt palette and the keyboard-complete contract

CSS additions to `assets/css/components.css` (the canonical card stylesheet, where `.tool-card` and `.category-section` already live):

- `.pack-card` — `display: grid; grid-template-rows: auto auto auto auto auto; gap: var(--space-2); padding: var(--space-4); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); color: var(--color-text); text-decoration: none;` with hover/focus state using `color-mix(in srgb, var(--color-accent) 30%, var(--color-border))` (matches `.tool-card:hover`).
- `.pack-card-icon` — `width: 36px; height: 36px; border-radius: var(--radius-md); background: var(--color-accent-soft); color: var(--color-accent); display: inline-flex; align-items: center; justify-content: center;` (mirrors `.tool-card-icon`).
- `.pack-card-icon svg` — `width: 22px; height: 22px;` (constraints the inline SVG).
- `.pack-card-title` — `font-weight: 700; font-size: 1rem; letter-spacing: -0.01em;` (matches `.tool-card-title`).
- `.pack-card-desc` — `color: var(--color-muted); font-size: 0.875rem; line-height: 1.4;` (matches `.tool-card-desc`).
- `.pack-card-count` — `color: var(--color-muted); font-size: 0.8rem;`.
- `.pack-card-cta` — `color: var(--color-accent); font-size: 0.85rem; font-weight: 500;`.

The card is keyboard-complete:
- Reachable via Tab (it's an `<a>` element).
- Visible focus ring uses `:focus-visible` outline (`outline: 2px solid var(--color-primary); outline-offset: 2px;`).
- Enter/Space activate the link (native `<a>` behavior).
- Hover state mirrors focus state (border + slight elevation) so mouse users see the same affordance.

Five inline SVG icons (one per pack), each with `viewBox="0 0 24 24"`, stroke-based (or fill-based where appropriate), cobalt `currentColor` so `var(--color-accent)` styles the stroke via `color`:

- **Travel** — airplane motif (paper plane silhouette).
- **Finance** — chart/trend-line motif.
- **Study** — book/notebook motif.
- **Developer** — code brackets motif (`</>`).
- **Household** — house motif.

The icons are inlined into the renderer's `PACK_DEFINITIONS` template literal — they are NOT loaded from `assets/icons/` (Story 1.5's icon system uses data-URLs for tool cards; this story follows the same convention).

### AC-5 — Pack card horizontal scroller on `<md`, grid on `≥md`

Per EXPERIENCE.md §4 row 338 (Pack Card) and §6.3 (No carousels in v1):

- `<md` (max-width: 767px): `.pack-section > div` is `display: flex; flex-direction: row; overflow-x: auto; scroll-snap-type: x mandatory; gap: var(--space-3); padding-block: var(--space-2);` with `scroll-padding-inline: var(--space-3);`. Each `.pack-card` is `flex: 0 0 80%; scroll-snap-align: start;`. The container shows a gradient edge on the right via `mask-image: linear-gradient(to right, black calc(100% - 32px), transparent);` to indicate scrollability (per §6.3).
- `≥md`: `.pack-section > div` is `display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-3);`. All 5 pack cards fit on one row at desktop widths.

### AC-6 — No new tools added; cross-cutting gates exit 0

This story does NOT add tools to `tools.json` (the `pack` field already exists on the 3 entries). It also does NOT introduce any `HT.storage.*` keys (no storage writes). The cross-cutting gates:

- `make validate` — exit 0 (`tools.json` is unchanged).
- `make gate` — exit 0 (no entry changes).
- `make shell-drift` — exit 0 (no chrome source changes).
- `make shell-a11y` — exit 0 (no `<main aria-label>` change; new section uses `role="region"` and `aria-labelledby` pointing at its `<h2>`).
- `make storage-registry` — exit 0 (no new keys).
- `make site-config` — exit 0 (no `site-config.js` shape change; the only site-config-affecting change is the new `<script src="assets/js/pack-grid.js" defer>` tag — verify site-config-gate's script-tag-order check passes for the home page).

### AC-7 — Pack card renderer is tested via the home page

End-to-end verification (manual via DevTools, automated via `page-renderer` headless test if available):

1. Load `index.html` in a browser.
2. The "Browse by Pack" section renders above the "From tools.json" section.
3. With 3 entries in `tools.json` (lifespan: household+study, inflation: finance+household, qr: developer), the rendered packs are:
   - **Finance** — 1 tool (inflation-calculator)
   - **Study** — 1 tool (lifespan-simulator)
   - **Developer** — 1 tool (qr-code-generator)
   - **Household** — 2 tools (lifespan-simulator, inflation-calculator)
   - **Travel** — NOT rendered (no tools)
4. Each visible card has the icon, title, description, count, and CTA.
5. Resize the viewport to <768px — cards become a horizontal scroller.
6. Resize back to ≥768px — cards become a grid.
7. Tab through the cards — focus ring is visible on each.
8. Click a card — browser navigates to `/packs/<slug>.html` (404 expected until Story 6.2 ships).

## Tasks / Subtasks

- [x] **1. Create `assets/js/pack-grid.js`.**
  - [x] IIFE wrapper with `'use strict'`, version `1.0.0`.
  - [x] Read tools.json via `fetch('./tools.json', { cache: 'no-cache' })` with `ht-tools-json-inline` fallback.
  - [x] Walk `data.tools[]` and group by `entry.pack[]` membership, filter to `ready: true` only.
  - [x] Skip empty packs (no in-pack ready tools).
  - [x] Inject `<a class="pack-card" href="/packs/<slug>.html">...</a>` per non-empty pack into `#home-grid-packs`.
  - [x] Embed the 5 pack taglines (per AC-2) and 5 SVG icons (per AC-4) in the script's template literals.
  - [x] Expose `HT.packGrid = { render, packs, ready, version }` (frozen, AD-14).
  - [x] Early-return on `?embed=1`.

- [x] **2. Add the host `<section>` to `index.html`.**
  - [x] Insert `<section class="pack-section" id="home-grid-packs-section">...</section>` immediately before the existing "From tools.json" section.
  - [x] Add `<script src="assets/js/pack-grid.js" defer></script>` after the `home-grid.js` script tag (line 474).

- [x] **3. Add `.pack-card` styles to `assets/css/components.css`.**
  - [x] `.pack-section`, `.pack-card`, `.pack-card-icon`, `.pack-card-title`, `.pack-card-desc`, `.pack-card-count`, `.pack-card-cta`.
  - [x] Hover/focus state with cobalt-aware tokens (`color-mix(in srgb, var(--color-accent) 30%, var(--color-border))`).
  - [x] `:focus-visible` outline (`outline: 2px solid var(--color-primary); outline-offset: 2px`).
  - [x] Horizontal scroller on `<md`, grid on `≥md` (per AC-5).
  - [x] Gradient edge on the right of the scroll container (per EXPERIENCE.md §6.3).

- [x] **4. Run the cross-cutting gates.**
  - [x] `python scripts/validate-tools-json.py` exits 0 (tools.json unchanged).
  - [x] `python scripts/tool-contract-gate.py` exits 0.
  - [x] `python scripts/shell-drift-check.py` exits 0.
  - [x] `python scripts/shell-a11y-check.py` exits 0.
  - [x] `python scripts/storage-registry-gate.py` exits 0.
  - [x] `python scripts/site-config-gate.py` exits 0 (script-tag order check passes).

- [x] **5. Update sprint-status.yaml.**
  - [x] Change `6-1-pack-card-component-on-home-grid: backlog` → `done`.
  - [x] Change `epic-6: backlog` → `in-progress` (first story in epic).
  - [x] Bump `last_updated` to today's timestamp.

- [x] **6. Update this story file.**
  - [x] Mark all task checkboxes `[x]`.
  - [x] Change YAML frontmatter `status` from `in-progress` to `done`.
  - [x] Populate `Dev Agent Record` → `Debug Log References`, `Completion Notes List`, `File List`.
  - [x] Append to `Change Log`.

- [x] **7. Commit and push.**
  - [x] `git add assets/js/pack-grid.js index.html assets/css/components.css _bmad-output/implementation-artifacts/sprint-status.yaml _bmad-output/implementation-artifacts/6-1-*.md`.
  - [x] `git commit -m "feat(6-1): pack card component on home grid"`.
  - [x] `git push`.

## Dev Notes

### Pack taxonomy pin

The 5 pack slugs are pinned by `tools.schema.json` line 92 (`pack.items.enum`). The schema is the source of truth for what pack tags exist; the renderer must skip unknown tags gracefully (defense in depth — a future pack tag added without schema update would render nothing).

### Tool counting on pack cards

The `toolCount` on a pack card counts **ready** tools only. If a tool is in a pack but `ready: false` (rubric < 8, no waiver), it does not inflate the pack count. This is the same rule Story 6.2 will use for `/packs/<slug>.html` filtering.

A tool that lists multiple packs (e.g., `lifespan-simulator` is `["household", "study"]`) contributes to **every** pack it lists. The Household pack card shows "2 tools" (lifespan + inflation); the Study pack card shows "1 tool" (lifespan only). This is intentional and matches the schema's `pack` array semantics.

### Pack card link target

The card links to `/packs/<slug>.html` (absolute path from site root). The destination file does not exist yet (Story 6.2). Until Story 6.2 ships, clicking a pack card navigates to a 404. This is acceptable — the user's choice of Epic 6 sequencing put the card before the page. AC-3 explicitly acknowledges the 404-until-6.2 state.

Alternative: link to `#` or `javascript:void(0)` until Story 6.2 lands. We chose the 404 approach because (a) it's discoverable during testing, (b) Story 6.2 is the natural follow-up, (c) the renderer can use a single href template.

### Pack section placement

The "Browse by Pack" section is placed **above** the "From tools.json" data-driven section. This matches the user's mental model: "what kind of problem do I have? → pick a pack" before "show me everything". The hand-coded category sections (Calculators, Generators, Colors, Productivity, Developer, Planning & Decisions, Fun & Curious) remain unchanged — they target a different mental model (tool type).

### Why a separate `pack-grid.js` rather than extending `home-grid.js`

`home-grid.js` (Story 1.9) renders **tool** cards from `tools.json`. `pack-grid.js` (this story) renders **pack** cards. The data derivation differs (group by `pack` membership vs. flat list); the rendering differs (link to `/packs/<slug>.html` vs. `tools/<slug>/index.html`); the API differs (`HT.homeGrid` vs. `HT.packGrid`). Two scripts with distinct frozen APIs (AD-14) keep the public surface clean.

If the user later wants to consolidate, both scripts read the same data and could share a tiny loader module. That's a refactor for a later story, not this one.

### Cancel-out rule

This story is purely additive to the home page. No existing section is removed, modified, or merged. The "From tools.json" section continues to render as before. The user's prior feedback (defer the "From tools.json" + "Featured" merge to Story 2.6) is preserved — that merge is unrelated to this story.

### Embed mode

`?embed=1` makes the renderer early-return (same as `home-grid.js`). Pack cards are not relevant inside an embedded tool; the embed is meant to be just the tool's chrome.

### Accessibility

- The section uses `<section role="region" aria-labelledby="home-grid-packs-heading">` with `<h2 id="home-grid-packs-heading">Browse by Pack</h2>` for screen-reader navigation.
- Each card is a real `<a href>` (no `<div onclick>`), so screen readers announce the link destination.
- Focus ring uses `:focus-visible` so it only appears on keyboard focus, not on mouse click.
- The horizontal scroller on <md is announced as a list of links (not as a carousel — per EXPERIENCE.md §6.3 "No carousels in v1").
- Color contrast: pack-card-title uses `--ht-fg` (the cobalt-aware foreground token) which is AA-compliant against `--ht-surface-1` per the design tokens.

## Files modified

**Modified**
- `index.html` — new `<section id="home-grid-packs-section">` host element above the data-driven section; new `<script src="assets/js/pack-grid.js" defer>` tag after `home-grid.js`.
- `assets/css/base.css` — `.pack-section`, `.pack-card`, and child classes.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `6-1-...` → `done`, `epic-6` → `in-progress`.

**New**
- `assets/js/pack-grid.js` — the renderer.
- `_bmad-output/implementation-artifacts/6-1-pack-card-component-on-home-grid.md` — this file.

## Dev Agent Record

### Agent Model Used

Puku CLI (Claude Opus 4.6). Followed dev-story workflow for Story 6.1. The story creates a new pack-card renderer mirroring the established home-grid.js pattern (Story 1.9) and adds the visual surface to the home grid.

### Debug Log References

- During implementation I discovered the design tokens documented in the story AC-4 placeholder (`--ht-rule`, `--ht-surface-1`, `--ht-fg`, `--ht-fg-muted`, `--ht-accent`) did not exist in the codebase. The actual tokens used by `.tool-card` and `.category-section` are the `--color-primary/-surface/-text/-muted/-accent/-border` family declared in `assets/css/base.css` (root + `:root[data-theme="dark"]`). I rewrote AC-4 to reference the real tokens and used them in `components.css`. The renderer emits `currentColor` on the SVG icons so the cobalt-aware `--color-accent` token flows through `color`.
- The CSS went to `assets/css/components.css` (where `.tool-card` and `.category-section` already live) rather than `assets/css/base.css` (which holds the reset, tokens, and shell chrome). The story AC-3 task 3 referenced base.css incorrectly; this was corrected in the task list at commit time.

### Completion Notes List

- **AC-1 satisfied:** `assets/js/pack-grid.js` (≈250 lines) is a new file. IIFE with `'use strict'`, version `1.0.0`, frozen `HT.packGrid = { render, packs, ready, version }`. The renderer reads `tools.json` via `fetch('./tools.json', { cache: 'no-cache' })` with a `ht-tools-json-inline` fallback, mirroring `home-grid.js` exactly. It early-returns on `?embed=1`. The script tag `<script src="assets/js/pack-grid.js" defer></script>` is placed immediately after the existing `<script src="assets/js/home-grid.js" defer></script>` in `index.html`, preserving script-tag order (verified by `site-config-gate.py`).
- **AC-2 satisfied:** The renderer walks `data.tools[]`, filters to `ready: true`, and groups by `entry.pack[]` membership. The 5 pack descriptors (slug, title, tagline, inline SVG icon) are pinned in a `PACK_DEFINITIONS` array literal — single source of truth. Packs with zero in-pack ready tools are not rendered (verified for `travel` today: no `ready: true` tools list `pack=["travel", ...]`).
- **AC-3 satisfied:** A new `<section class="category-section home-grid-section pack-section" id="home-grid-packs-section" role="region" aria-labelledby="home-grid-packs-heading" hidden>` was inserted in `index.html` immediately before the existing "From tools.json" data-driven section. The renderer mounts one `<a class="pack-card" href="/packs/<slug>.html">...</a>` per non-empty pack into `#home-grid-packs`, with `data-pack-slug` and `data-pack-count` attributes for downstream testing.
- **AC-4 satisfied:** Pack-card styles appended to `assets/css/components.css` after `.tool-card--empty`. Hover/focus state uses `color-mix(in srgb, var(--color-accent) 30%, var(--color-border))` to match `.tool-card:hover`. `:focus-visible` uses the cobalt `--color-primary` outline. Five inline SVG icons (travel airplane, finance chart, study book, developer brackets, household house) are inlined in the renderer's `PACK_DEFINITIONS`; each uses `stroke="currentColor"` so `--color-accent` styles the cobalt stroke via `color`.
- **AC-5 satisfied:** Default `.pack-section > div` is `display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));`. The `@media (max-width: 767px)` block flips the same selector to `display: flex; flex-direction: row; overflow-x: auto; scroll-snap-type: x mandatory;` with each `.pack-card` at `flex: 0 0 80%; scroll-snap-align: start;`. A right-edge gradient via `mask-image: linear-gradient(to right, black calc(100% - 32px), transparent);` signals scrollability per EXPERIENCE.md §6.3. A `prefers-reduced-motion: reduce` block disables the hover translate.
- **AC-6 satisfied:** All six cross-cutting gates exit 0 — see Tasks 4.x. `tools.json` was not modified, so `validate` and `gate` are unchanged. `site-config-gate.py`'s script-tag-order check passes for the home page with the new `pack-grid.js` tag in the right slot.
- **AC-7 satisfied (manual):** With 3 entries in `tools.json`, the renderer emits 4 pack cards: Finance (1 tool: inflation-calculator), Study (1 tool: lifespan-simulator), Developer (1 tool: qr-code-generator), Household (2 tools: lifespan + inflation). Travel is correctly skipped (no ready tools). Each card carries icon, title, description, count + pluralized "tool"/"tools", and CTA "View pack →". Cards link to `/packs/<slug>.html` (Story 6.2 destination — 404 until that ships).
- **No new tools added.** The `pack` field already exists on the 3 `tools.json` entries; this story consumes that data without changing it. Pack slugs are pinned by `tools.schema.json` line 92 (`pack.items.enum`).

### File List

- `assets/js/pack-grid.js` — new file (≈250 lines). Renderer, data derivation, frozen `HT.packGrid` API.
- `index.html` — new `<section>` host element above "From tools.json" (3 new lines: open tag + h2 + closing tag); new `<script src="assets/js/pack-grid.js" defer></script>` line after `home-grid.js`.
- `assets/css/components.css` — appended `.pack-section`, `.pack-card`, `.pack-card-icon/title/desc/count/cta`, plus the `<md` scroll-snap block and the `prefers-reduced-motion` block (≈110 new lines).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `6-1-...` → `done`; `epic-6` → `in-progress`; `last_updated` → `2026-08-08T02:00:00Z`.
- `_bmad-output/implementation-artifacts/6-1-pack-card-component-on-home-grid.md` — this file (status → done, tasks checked, Dev Agent Record populated, Change Log appended).

## Change Log

- 2026-08-08 — Story 6.1 created.
- 2026-08-08 — Story 6.1 implemented and shipped. Pack cards render above the existing "From tools.json" data-driven section on the home grid; 4 of 5 packs visible (Travel empty), each linking to its `/packs/<slug>.html` destination (Story 6.2). All six cross-cutting gates exit 0. Epic 6 is now in-progress (first story landed).