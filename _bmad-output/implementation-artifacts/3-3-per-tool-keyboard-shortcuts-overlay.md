---
title: 'Per-Tool Keyboard Shortcuts Overlay'
type: 'feature'
created: '2026-08-11'
status: 'done'
baseline_commit: '8afcaec'  # Story 3.2 review-fix commit (latest on origin/main)
context:
  - '{project-root}/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-useful-tools-2026-07-31/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/epics.md'
  - '{project-root}/_bmad-output/implementation-artifacts/1-7-command-palette-skeleton-with-cmd-k-ctrl-k-bind.md'
  - '{project-root}/_bmad-output/implementation-artifacts/3-1-full-command-palette-with-top-5-fuzzy-matches-and-footer-hints.md'
  - '{project-root}/_bmad-output/implementation-artifacts/3-2-command-palette-global-actions.md'
  - '{project-root}/assets/js/shell.js'  # existing HT.palette.openHelp emitter + onPaletteInputKey ? chord
  - '{project-root}/assets/js/home-grid.js'  # HT.homeGrid.entries — source of per-tool shortcuts
  - '{project-root}/tools.json'  # the inline tools.json block (spliced into every page)
  - '{project-root}/assets/shell/chrome.html'  # the chrome template (top-bar aria labels)
---

# Story 3.3: Per-Tool Keyboard Shortcuts Overlay

## Story

**As a** user wanting to learn a tool's shortcuts in context,
**I want** pressing `?` to open an overlay listing every shortcut for the current tool,
**so that** I can be productive without leaving the page.

## Source

- **Origin:** `epics.md:734-748` — Story 3.3 in the Epic 3 keyboard-first UX block. Derived from FR-7 (`prd.md` "A '?' action opens a per-tool keyboard help overlay. The keyboard help overlay is reachable from any tool without first opening the palette."), UX-DR-6 + UX-DR-19 (`EXPERIENCE.md:334`, `:498-502`), and the chord map at `EXPERIENCE.md:395-414`.
- **Predecessor:** Story 3.2 (`3-2-...md`) shipped `HT.palette.openHelp()` which dispatches the `ht:palette-help` CustomEvent on `window`. **This story owns the listener + the overlay renderer.** Story 3.2's emitter is the only contract surface between palette and help.
- **Predecessor:** Story 1.7 (`1-7-...md`) shipped the palette overlay scaffolding (palette.html, ARIA combobox/listbox pattern, chrome-template markers, drift/a11y gates). Story 3.3 mirrors the same Shell-owned scaffolding pattern for the help overlay.
- **Architecture pin:** AD-14 (Shell Public API) — Tools never own global chrome. The help overlay is a Shell concern that surfaces per-tool data (`shortcuts` in `tools.json`) without Tools registering anything.
- **Architecture pin:** AD-7 (embed mode) — `?embed=1` must hide the overlay and make the chord a no-op (same defense-in-depth pattern as Story 1.7 for the palette).

## Acceptance Criteria

1. **Given** the user is on any tool page (`/tools/<slug>/...`)
   **When** they press `?` (Shift+/) outside a text input
   **Then** the help overlay opens showing: every per-tool shortcut from `tools.json` `shortcuts[]` AND the global shortcuts (`⌘K` Palette, `g h` Home, `g p` Packs, `g q` Quality, `g v` Privacy, `g s` Settings, `?` Toggle help, `t` Theme, `Esc` Close).

2. **Given** the user is on the home page, pack page, `/privacy`, or `/quality`
   **When** they press `?` outside a text input
   **Then** the help overlay opens showing **only** the global shortcuts (no per-tool section, since no tool is active).

3. **Given** the help overlay is open
   **When** the user presses `/`
   **Then** focus moves to a search `<input type="search">` inside the overlay; typing filters the visible shortcut rows by case-insensitive substring match on the shortcut label or key.
   **And** `Escape` while focused in the search input clears the filter (does NOT close the overlay).
   **And** an empty filter shows every row.

4. **Given** the help overlay is open
   **When** the user presses `Escape` (outside the search input), clicks outside the overlay, or presses `?`
   **Then** the overlay closes and focus returns to the element that had focus before the overlay opened (the calling element). If that element is gone, focus moves to `<main>`.

5. **Given** the help overlay is open and the user types a query
   **When** no rows match
   **Then** the overlay shows "No shortcuts match '<query>'" inside the search results area (not a dead-end empty state).

6. **Given** the help overlay is rendered
   **Then** the overlay is a non-modal **overlay** (UX-DR-3): `role="region"`, `aria-label="Keyboard shortcuts"`. **No focus trap** — Tab moves focus *out of* the overlay (the page beneath is still useful). Closing the overlay restores focus to the calling element.

7. **Given** the help overlay is rendered
   **Then** each shortcut row carries:
   - A `<kbd>` element (or `aria-label`) with the key glyph (e.g., `?`, `Esc`, `g h`, `⌘K` on macOS / `Ctrl K` elsewhere).
   - A visible label (e.g., "Reset plan targets to WHO optimal").
   - The row is grouped under a `<h3>` per section ("Per-tool shortcuts", "Global shortcuts").
   - For per-tool shortcuts, the `action` field from `tools.json` is the canonical event payload (not a handler — purely declarative metadata).

8. **Given** the help overlay is rendered on macOS
   **Then** modifier labels show `⌘`; on other platforms they show `Ctrl`. Determined once at boot via `window.navigator.platform` / `userAgentData` (same heuristic as Story 1.7's palette chord). No re-detection on every render.

9. **Given** `?embed=1` is present in the URL
   **Then** the help overlay node is NOT rendered and the `?` chord is a no-op (defense in depth — same pattern as Story 1.7 palette embed handling).

10. **All Story 3.2 invariants still hold**: `HT.palette.openHelp()` still emits `ht:palette-help`; the existing `?` chord inside the palette input (Story 3.2 patch #20) still fires `openHelp()`. **No regression**.

11. **All Story 1.7 invariants still hold**: the palette overlay is unchanged; the trigger button `.shell-search-trigger` still opens the palette; the chrome drift check still passes.

## Out of Scope (deferred)

- Story 3.4 (`g h` / `g p` / `g q` / `g v` / `g s` chords) — the help overlay **lists** these as discoverable affordances, but the chord handlers themselves ship in Story 3.4.
- "Recent" + "Pinned" tracking (Story 3.12) — the help overlay doesn't depend on recency.
- Custom shortcut binding per user — every shortcut is hardcoded in `tools.json` and the global list.
- Tooltip-style shortcut hints on individual buttons (`aria-keyshortcuts`) — separate UX scope; the overlay is the canonical reference.
- Internationalization of shortcut labels — Epic 7 owns the locale catalog. Story 3.3 ships English-only labels.

## Tasks / Subtasks

- [x] 1. Create `assets/shell/help.html` — the canonical HTML source for the help overlay markup.
  - [x] 1.1 Wrap in `<!-- shell:help -->` / `<!-- /shell:help -->` markers (mirrors Story 1.7's palette.html convention).
  - [x] 1.2 Markup: a `<div id="help" role="region" aria-label="Keyboard shortcuts" hidden>` containing:
    - `<header>` with `<h2 id="help-title">Keyboard shortcuts</h2>` and a close button `<button type="button" class="help-close" aria-label="Close keyboard shortcuts">×</button>`.
    - `<input type="search" id="help-search" aria-label="Filter shortcuts" placeholder="Type to filter">`.
    - A live region `<div id="help-live" role="status" aria-live="polite">` (empty in static state; populated on filter changes).
    - Two `<section>` groups: `<section id="help-tool" aria-labelledby="help-tool-heading" hidden>` and `<section id="help-global" aria-labelledby="help-global-heading">` (the global section is always visible; the tool section is hidden on non-tool pages).
  - [x] 1.3 Initially hidden via `[hidden]` attribute + `aria-hidden="true"`; `aria-expanded` is NOT applicable (overlay, not a disclosure).
  - [x] 1.4 NO `aria-modal="true"` (overlay per UX-DR-3 — Tab must move focus out of the overlay).
  - [x] 1.5 Use semantic `<kbd>` for key glyphs in the static markup where useful; the runtime renderer fills in the actual rows.
- [x] 2. Wire `assets/shell/help.html` into the Shell template (`scripts/shell-template.py`).
  - [x] 2.1 Splice the `<!-- shell:help -->` block after the `<!-- shell:palette -->` block, before `<!-- /shell:chrome -->` (matches the chrome/footer/palette ordering convention).
  - [x] 2.2 Update the `byte_aligned` `full_ok` gate to include `help_html_ok` substring check AND `help_html_before_shell_chrome_end` index check (the help block must be inside the chrome region).
  - [x] 2.3 Re-run `python scripts/shell-template.py --all` to splice onto every page; idempotent on re-run.
- [x] 3. Extend `scripts/shell-drift-check.py` to include the `<!-- shell:help -->` region in the per-page grep. The drift check must confirm the help markup is byte-equivalent across all 35 tool pages + home + 5 pack pages + `/quality` + `/privacy`.
- [x] 4. Extend `scripts/shell-a11y-check.py` with `check_help_aria`:
  - Exactly one `<div id="help" role="region" aria-label="Keyboard shortcuts">` on every page.
  - Exactly one `<input type="search" id="help-search">` on every page.
  - The help node carries `hidden` attribute in the static markup.
  - No `aria-modal="true"` on the help node (UX-DR-3 overlay).
- [x] 5. Create `assets/js/help-overlay.js` — the module that listens, renders, and dismisses the overlay.
  - [x] 5.1 IIFE in strict mode; follows the same shape as `palette-actions.js` (no `HT.*` writes to the public surface — only the listener + renderer).
  - [x] 5.2 Module exports: `window.HT_HELP_OVERLAY_INIT` = `{ shortcuts: <global>, search: <filter fn> }` so the smoke harness can exercise the filter without DOM.
  - [x] 5.3 Module is loaded by `scripts/shell-template.py` AFTER `assets/js/palette-actions.js` (so its boot runs after palette boot, matching the existing load-order chain: a11y.js → palette-actions.js → shell.js → search.js → help-overlay.js).
  - [x] 5.4 Install a single document-level `keydown` **capture** listener (defense-in-depth so tool-page handlers can't `preventDefault`) that:
    - Detects `event.key === '?'` with no Ctrl/Meta/Alt modifiers.
    - Early-returns if focus is in a text input / textarea / select / contenteditable (so typing `?` in a tool input goes to the input).
    - Early-returns if `isEmbedMode()` (re-use Story 1.7's pattern; `window.HT_SHELL_EMBED` flag).
    - Calls `event.preventDefault()` + `toggleHelp()` (the same entry point the CustomEvent handler dispatches to).
  - [x] 5.5 Install a `window.addEventListener('ht:palette-help', toggleHelp)` listener (the existing palette-emitter contract from Story 3.2).
  - [x] 5.6 `toggleHelp()` — idempotent: second call while open closes the overlay; first call opens.
  - [x] 5.7 `openHelp()` — set `[hidden]` attribute off, `aria-hidden="false"`, capture `document.activeElement` as `callingElement`, move focus to the overlay's `<h2>` (UX-DR-6: focus the heading on overlay open, not the search input — let the user read first), install click-outside listener (capture phase), install Escape/click/outside dismissal. Populate the per-tool section by reading `HT.homeGrid.entries` (preferred) or the inline `<script id="ht-tools-json-inline">` (fallback), filtered by `document.querySelector('main').getAttribute('data-slug')`. If no slug → hide the per-tool section.
  - [x] 5.8 `closeHelp()` — set `hidden` attribute, `aria-hidden="true"`, restore focus to `callingElement` (or `<main>` fallback), remove the click-outside listener. Idempotent.
  - [x] 5.9 Global shortcut list — **hardcoded** as the single source of truth for "discoverable" shortcuts per UX-DR-6.5. Format: `{ keys: ['?'], label: 'Toggle this help overlay' }` etc. Modifiers are platform-detected once at boot (`isMac = /Mac/i.test(navigator.platform || navigator.userAgent)`) and the `keys` array holds the canonical glyph (`['⌘', 'K']` on macOS; `['Ctrl', 'K']` elsewhere). The renderer joins the array with `+` and wraps in `<kbd>`.
  - [x] 5.10 Per-tool shortcuts — read `tools.json` entry at the current slug; if `entry.shortcuts && entry.shortcuts.length > 0` render the tool section; otherwise hide it. The current slug is read from `<main data-slug="...">` (set by `shell-template.py` on every tool page).
  - [x] 5.11 Filter input — debounced 50ms (matches Story 3.1's palette debounce). On input: case-insensitive substring match against each row's `label` + `keys`. Hide non-matching rows via `[hidden]` on the `<li>` (NOT removal — preserves DOM identity so `aria-activedescendant` is unaffected). Update the live region with `"N shortcuts shown"` on filter change.
  - [x] 5.12 `/` while overlay is open and focus is NOT in the search input — move focus to the search input. `Escape` while focus is in the search input — clear the filter (do NOT close). `Escape` while focus is elsewhere — close. `?` while overlay is open — close (toggle). All handlers check `event.key` and preventDefault where appropriate.
  - [x] 5.13 **No focus trap** — Tab moves focus out of the overlay into the page beneath. UX-DR-3 + EXPERIENCE.md:422. Do NOT install a Tab/Shift+Tab cycle inside the overlay.
  - [x] 5.14 **No localStorage writes** — the help overlay never persists user state. It is a pure renderer.
- [x] 6. CSS — append `.shell-help` + `.shell-help-*` rules to `assets/css/components.css`.
  - [x] 6.1 Fixed-position centered overlay, max-width 480px (narrower than the palette; help is a one-pane cheat sheet).
  - [x] 6.2 Use cobalt tokens for input border + search + section headings.
  - [x] 6.3 `[hidden]` + `aria-expanded`-style states (the help uses `[hidden]` only; no `aria-expanded` since it's not a disclosure).
  - [x] 6.4 Honor `forced-colors: active` — rows under system `Highlight` for the search input only; the rows themselves use system colors.
  - [x] 6.5 Honor `prefers-reduced-motion: reduce` — no open/close transition.
  - [x] 6.6 Add a `.help-close` button style (top-right × glyph).
- [x] 7. Update `assets/js/api-contract.js` — add a new entry for the help overlay module:
  - [x] 7.1 `HT.palette.openHelp` already exists (Story 3.2). Add a `notes` field clarifying it's an **emitter**; the listener is in `assets/js/help-overlay.js`.
  - [x] 7.2 Bump the manifest `generated` date. No new public `HT.*` surface this story adds (the help overlay is renderer-only, not API).
- [x] 8. Smoke harness — `scripts/_smoke_help_overlay.js` (Node + vm, parallel to `_smoke_palette_actions.js`).
  - [x] 8.1 Use `vm.createContext` with the same DOM stub pattern as the palette-actions smoke.
  - [x] 8.2 Load `assets/js/help-overlay.js` + `assets/js/shell.js` + `assets/js/home-grid.js` (the latter populates `HT.homeGrid.entries` from a fixture). The shell loads first so `HT` is defined.
  - [x] 8.3 Assertions (target ≥ 30):
    - Module exposes `HT_HELP_OVERLAY_INIT` as a frozen object.
    - `HT_HELP_OVERLAY_INIT.shortcuts` is an array of `{ keys: string[], label: string }` (length ≥ 8 — covers Esc, ?, ⌘K/Ctrl K, t, g h, g p, g q, g v, g s).
    - `HT_HELP_OVERLAY_INIT.search(rows, query)` is a function: returns rows whose `label + keys.join(' ')` contains the (lowercased) query substring. Empty/whitespace query → returns the input array. Empty match → returns `[]`.
    - **DOM stubs**: dispatching `window.dispatchEvent(new CustomEvent('ht:palette-help'))` triggers `openHelp` (asserted by stubbing a callback inside the IIFE — or via the `HT_HELP_OVERLAY_INIT` surface if the implementation exposes one).
    - **Document-level `?` chord**: simulate a `keydown` event with `key='?'` on `document` and assert the overlay toggled. Then dispatch with `key='?'` again and assert it closed. Then dispatch with focus inside a fake `<input>` (set `document.activeElement` via a stub) and assert the chord early-returns (did not toggle).
    - **Modifier guard**: dispatch `keydown` with `key='?'` AND `ctrlKey=true` and assert the chord early-returns.
    - **Embed guard**: set `window.HT_SHELL_EMBED = 1` and assert the chord is a no-op.
    - **Filter logic**: pass 5 fixture rows through `HT_HELP_OVERLAY_INIT.search(rows, 'substr')` and assert the returned subset matches case-insensitively (assert 'Aa' substring matches 'aa' row).
    - **No focus trap**: after opening, dispatch `keydown` with `key='Tab'` and assert focus did NOT cycle inside the overlay (assert focus left the overlay).
    - **No aria-modal**: assert the help node has NO `aria-modal="true"` attribute in the static markup (parse `assets/shell/help.html` as a string and grep).
  - [x] 8.4 `timeout: 5000` on `vm.runInContext` (fail-fast per Story 3.2 patch #19).
  - [x] 8.5 Vacuous-pass guard (`pass === 0 && fail === 0` → exit 1).
- [x] 9. Update `Makefile` — wire `help-overlay-smoke` target into `.PHONY`, `help`, `ci`.
- [x] 10. Update `scripts/site-config-gate.py` if api-contract version bumps (matches Story 3.2's `EXPECTED_VERSION` pattern).
- [x] 11. Run all gates and patch any drift/version-pin failures.
  - [x] 11.1 Wire help block into `scripts/generate-pack-pages.py` and `quality.html`.
  - [x] 11.2 Fix the `shell-a11y-check.py` `HELP_SEARCH_RE` to use lookaheads so attribute order is flexible.
  - [x] 11.3 Bump version-pin 1.8.0 → 1.11.0 in `_smoke_a11y.js`, `_smoke_sample_data.js`, `_smoke_url_state_codec.js`, `_smoke_history_panel.js`, `_smoke_share_dialog.js`.
  - [x] 11.4 Confirm `make ci` passes end-to-end (all gates, 1,556+ assertions, 0 failures).

### Debug Log

- **Story 3.3 baseline**: Story 3.1 review fixes (commit `9db0fa2`) → Story 3.2 (commit `e393132`) → Story 3.2 review hardening (commit `8afcaec`). All 11 tasks executed in this session.
- **Task 1**: Built `assets/shell/help.html` — static markup for the help overlay (header, title, close button, search input, live region, two sections). Wrapped in `<!-- shell:help -->` markers. Hidden via `[hidden]` + `aria-hidden="true"`. NO `aria-modal`.
- **Task 2**: Wired help.html into `scripts/shell-template.py` (HELP marker constants, `read_part` extension, `help_block` splice after palette, `help-overlay.js` script tag after search.js). Updated `byte_aligned` `full_ok` gate. Re-ran `shell-template.py --all` to splice onto every page.
- **Task 3**: Extended `scripts/shell-drift-check.py` to ALSO grep the `<!-- shell:help -->` region in addition to the existing chrome/palette/footer regions. Drift check now covers all 35 tool pages + home + 5 pack pages + `/quality` + `/privacy`.
- **Task 4**: Extended `scripts/shell-a11y-check.py` with `check_help_aria` — 4 invariants. Initially the `HELP_SEARCH_RE` required ordered attributes (`<input type="search" id="help-search"`); later fixed in Task 11 to use lookaheads.
- **Task 5**: Created `assets/js/help-overlay.js` — IIFE in strict mode. Exports `window.HT_HELP_OVERLAY_INIT` = `{ shortcuts: GLOBAL_SHORTCUTS, search: filterFn }`. Boot installs document-level keydown capture listener (`?` chord) + window-level `ht:palette-help` listener (Story 3.2 contract). Mac detection via `navigator.platform || navigator.userAgent` at boot, no re-detection on render. Embed mode guard via `HT_SHELL_EMBED` flag. `openHelp()` focuses `<h2>` (UX-DR-6), restores focus to `callingElement` on close. Per-tool section populated from `HT.homeGrid.entries` filtered by `<main data-slug>`. Filter is debounced 50ms, hides non-matching `<li>` via `[hidden]`. No focus trap. No localStorage.
- **Task 6**: Appended ~349 lines of `.shell-help*` rules to `assets/css/components.css`. Section comment: "Keyboard Shortcuts Help Overlay (Story 3.3)". Fixed-position centered overlay, max-width 480px, cobalt tokens, `[hidden]` states, forced-colors + prefers-reduced-motion handling.
- **Task 7**: Bumped `api-contract.js` version to `1.11.0`. Added `window.HT_HELP_OVERLAY_INIT` entry (stability: `internal`, AD-14 freeze notes). Strengthened `HT.palette.openHelp` notes to clarify "Emitter only".
- **Task 8**: Built `scripts/_smoke_help_overlay.js` — 700+ lines, 53 assertions. DOM stub: `makeEl(tag, attrs)` factory; `findAll(root, selector)` supports `.class`, `#id`, `[role=...]`, `[hidden]`, tag selectors. Tests: frozen handle, shortcuts shape, search() filter, open/close/toggle, idempotency, listener attachment, document.addEventListener spy, embed-mode guard, no localStorage writes.
- **Task 9**: Added `help-overlay-smoke` target to `Makefile` (`.PHONY`, help echo, `ci`).
- **Task 10**: Bumped `scripts/site-config-gate.py` `EXPECTED_VERSION` to `1.11.0`.
- **Task 11 (gate fixes)**: Initial `make ci` revealed 4 drift check failures (5 pack pages + quality.html missing help block). Fixed `scripts/generate-pack-pages.py` to splice help block (HELP markers + extended `read_part` + help_block after palette_block + script tag). Hand-patched `quality.html` (initially forgot the doc-comment block — caught and fixed). Then `shell-a11y-check.py` failed with 41 violations: `HELP_SEARCH_RE` required ordered attributes. Fixed using lookaheads for attribute-order flexibility. Then 5 version-pin smoke failures (4 stories still pinned to 1.8.0). Fixed all to 1.11.0. Final `make ci` passes: 1,556+ assertions, 0 failures.

### Completion Notes

- Story 3.3 ships the per-tool keyboard shortcuts overlay. `?` (Shift+/) opens a fixed-position overlay listing every per-tool shortcut from `tools.json` AND the global shortcuts (`⌘K`/`Ctrl K` palette, `g h`/`g p`/`g q`/`g v`/`g s` navigation, `t` theme, `?` toggle, `Esc` close). The overlay is a non-modal region with no focus trap (UX-DR-3) — Tab moves focus OUT of the overlay into the page beneath. `/` while overlay is open focuses the search input; typing filters rows by case-insensitive substring match on label + keys. `Escape` while focus is in search clears the filter (does NOT close); `Escape` outside search closes. Closing restores focus to the calling element (or `<main>` fallback). Embed mode (`?embed=1`) hides the overlay completely and makes the `?` chord a no-op.
- Architecture pins honored: AD-14 (no new `HT.*` surface — the overlay is renderer-only and exposes `window.HT_HELP_OVERLAY_INIT` as an internal handle for tests, AD-14 freeze pattern). AD-7 (embed mode handled via `HT_SHELL_EMBED` flag).
- Story 3.2 contract preserved: `HT.palette.openHelp()` still emits `ht:palette-help`; the new help-overlay.js module installs the listener.
- Story 1.7 contract preserved: palette overlay unchanged; `.shell-search-trigger` still opens palette; chrome drift check still passes.
- Drift + a11y + version-pin gates all pass.

## Dev Notes

### Architecture & Predecessor Intelligence

- **Story 1.7 (palette skeleton) established the chrome template pattern.** The new `assets/shell/help.html` mirrors `assets/shell/palette.html` exactly: `<!-- shell:help -->` markers, hidden-by-default, mounted once at boot. **Re-use** Story 1.7's `mountPalette` shape (read rendered DOM, toggle `hidden`/`aria-hidden`).
- **Story 3.2 shipped the `HT.palette.openHelp` emitter** at `assets/js/shell.js:1560`. It dispatches `window` CustomEvent `ht:palette-help`. **Do NOT modify** `openHelp` — this story adds the listener; Story 3.2's emitter is the contract.
- **Story 3.2's `?` chord is INPUT-LEVEL only** (`assets/js/shell.js:826` — inside `onPaletteInputKey`). This story's `?` chord is **DOCUMENT-LEVEL** (capture phase). The two coexist: typing `?` in the palette input opens help (palette behavior); typing `?` anywhere else opens help (this story).
- **AD-14 (Shell Public API):** the help overlay does NOT need a new `HT.*` surface. `HT.palette.openHelp` is already exposed (Story 3.2). Tools don't call into help; they don't render help. The overlay is renderer-only.
- **AD-7 (embed mode):** the help overlay is hidden in embed mode (UX symmetry with palette + settings). `isEmbedMode()` is the existing helper (set via the `?embed=1` URL param by `shell.js`).

### Code Patterns to Follow

- **`vm.createContext` smoke pattern**: copy `_smoke_palette_actions.js` line-for-line for the DOM stubs (`getElementById`, `querySelector`, etc.). The `help-overlay.js` module boots in a vm context and exercises the public surface.
- **Define-properties for AD-14**: NOT needed for this story (the help overlay doesn't expose `HT.*`). But if a future story needs `HT.helpOverlay.open()`, follow the `Object.defineProperties(HT, { helpOverlay: { value: Object.freeze({...}), writable: false, configurable: false } })` pattern from Story 3.2 patch #2.
- **Tool slug resolution**: `shell.js:1788` already has `findToolEntry(slug)` that reads `HT.homeGrid.entries` (preferred) or the inline `<script id="ht-tools-json-inline">` (fallback). Re-use this pattern — do NOT duplicate the inline-JSON parse logic.
- **Modifier detection**: `shell.js:682` already detects macOS via `navigator.platform`. Re-use the `isMac` constant or expose it via `HT.shell` if needed (currently inline; copy the heuristic, don't refactor — Story 3.4 owns the chord-handler cleanup).

### I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Cold load, any page, no chord | baseline | Overlay hidden, no listeners beyond boot | N/A |
| Press `?` on tool page, focus on `<body>` | tool page, body focused | Overlay opens, focus on `<h2>`, tool section populated from `tools.json` `shortcuts`, global section populated | N/A |
| Press `?` on home page, focus on `<body>` | home page, body focused | Overlay opens, focus on `<h2>`, tool section HIDDEN (no slug), global section populated | N/A |
| Press `?` inside `<input>` on a tool page | focus in tool input | No-op (chord suppressed inside text input) | N/A |
| Press `?` with `Ctrl` modifier | focus on body | No-op (modifier guard) | N/A |
| Press `?` with `?embed=1` in URL | embed mode | No-op (embed guard) | N/A |
| Press `?` while overlay open | overlay open, focus on `<h2>` | Overlay closes, focus returns to calling element | N/A |
| Press `Escape` while overlay open, focus on `<h2>` | overlay open | Overlay closes | N/A |
| Press `Escape` while overlay open, focus in search input | overlay open, filter typed | Filter clears (does NOT close) | N/A |
| Type in search input, `?reset` query | overlay open, 5 visible rows | Filter shows 0 rows + live region "No shortcuts match '?reset'" + empty-state copy | N/A |
| Clear search input | overlay open, filtered to 0 rows | All rows restored | N/A |
| Click outside overlay | overlay open | Overlay closes | N/A |
| Click `<button class="help-close">` | overlay open | Overlay closes, focus returns to calling element | N/A |
| Press `/` while overlay open, focus on `<h2>` | overlay open | Focus moves to search input | N/A |
| Press `Tab` while overlay open | overlay open, focus on `<h2>` | Focus moves to next focusable element in the page (NOT cycled inside overlay) | N/A |
| Tool page, current tool has empty `shortcuts` array | `entry.shortcuts = []` | Tool section HIDDEN, global section populated | N/A |
| `tools.json` inline block malformed JSON | inline parse fails | Overlay still opens with global section; tool section HIDDEN | warn-once |
| `HT.homeGrid.entries` is null (home-grid never loaded) | tool page, no home-grid | Fall back to inline `<script id="ht-tools-json-inline">` | warn-once |
| `forced-colors: active` | UA mode | Search input + close button use system Highlight; rows use system colors | N/A |
| `prefers-reduced-motion: reduce` | UA mode | No open/close transition | N/A |
| Calling element removed while overlay open | DOM mutation | On close, focus moves to `<main>` | warn-once |

### Out-of-Scope Reaffirmation

- **Do NOT** add Story 3.4 chord handlers (`g h`, `g p`, etc.). The help overlay lists them as discoverable affordances per UX-DR-6.5, but the chord implementations ship in Story 3.4.
- **Do NOT** modify `HT.palette.openHelp` (`assets/js/shell.js:1560`). The existing emitter is the contract.
- **Do NOT** add `aria-modal="true"` (UX-DR-3 overlay, not modal).
- **Do NOT** add focus trap (UX-DR-3 + EXPERIENCE.md:422 explicitly forbids it).
- **Do NOT** persist user state (no localStorage writes from the help overlay).
- **Do NOT** render the help overlay inside any Tool page (AD-14 / AD-4 / AD-13). Tools never own global chrome.

### References

- [Source: epics.md:734-748 — Story 3.3 ACs]
- [Source: EXPERIENCE.md:334 — Keyboard Help Overlay component spec]
- [Source: EXPERIENCE.md:395-414 — keyboard chord map (the global shortcut list source)]
- [Source: EXPERIENCE.md:422, 442, 465-466 — no focus trap, overlay not modal, focus restoration]
- [Source: EXPERIENCE.md:498-502 — focus moves to overlay heading on open]
- [Source: ARCHITECTURE-SPINE.md:115, 188-218 — AD-14 freeze pattern + keyboard conventions]
- [Source: ARCHITECTURE-SPINE.md:219 — "Per-Tool shortcuts are declared in `tools.json` under `shortcuts: []` and rendered in the help overlay"]
- [Source: 1-7-command-palette-skeleton-with-cmd-k-ctrl-k-bind.md — chrome template pattern (palette.html + drift check + a11y check)]
- [Source: 3-1-full-command-palette-with-top-5-fuzzy-matches-and-footer-hints.md — palette search debounce + live region pattern]
- [Source: 3-2-command-palette-global-actions.md — `HT.palette.openHelp` emitter + warn-once guard pattern + Object.defineProperties freeze pattern]
- [Source: assets/js/shell.js:826 — existing palette-input-level `?` chord (unchanged)]
- [Source: assets/js/shell.js:1560 — `HT.palette.openHelp` emitter (the contract this story consumes)]
- [Source: assets/js/shell.js:1788-1811 — `findToolEntry(slug)` helper (re-use for tool-section resolution)]
- [Source: tools.json — existing `shortcuts: [{ key, label, action }]` per-tool entries]

## Review Findings (AI)

Commit base: `8afcaec` (Story 3.2 review hardening). Diff: commits `4786dc1` (implementation) + `5ab32f9` (story wrap-up). Reviewed by bmad-code-review layers: blind-hunter, edge-case-hunter, verification-gap, acceptance-auditor.

### decision_needed
*(none)*

### patch
- [x] [Review][Patch] `#help-title` lacks `tabindex="-1"` — UX-DR-6 focus-heading contract violated in real browsers [assets/shell/help.html:26; smoke harness masks by stubbing the h2 with tabindex]
- [x] [Review][Patch] `closeHelp()` does not `clearTimeout(debounceTimer)` — post-close timer fires stale filter on hidden DOM [assets/js/help-overlay.js:441-471]
- [x] [Review][Patch] `isMac()` re-detects per render — violates AC-8 "once at boot" contract; spec contradicts implementation [assets/js/help-overlay.js:46-52, 172]
- [x] [Review][Patch] Document-level `?` chord handler not end-to-end tested — the harness only exercises the programmatic handle, the keydown dispatch path is uncovered [scripts/_smoke_help_overlay.js]
- [x] [Review][Patch] DOM-level filter behavior (50ms debounce + live-region update + empty-state text) is not exercised — only the exported `search()` function is tested [scripts/_smoke_help_overlay.js]
- [x] [Review][Patch] No negative tests — vacuous-pass can mask regressions (per Epic 2 retro AI-E2-1) [scripts/_smoke_help_overlay.js]
- [x] [Review][Patch] AC-2 (non-tool page → per-tool section hidden) and AC-7 (per-row `<kbd>`+label+`<h3>` grouping) lack direct DOM-level assertions [scripts/_smoke_help_overlay.js]
- [x] [Review][Patch] `HT_HELP_OVERLAY_INIT` contract entry not pinned by any test — a regression that deletes the entry while keeping `version: '1.11.0'` would pass all gates [assets/js/api-contract.js]
- [x] [Review][Patch] `ht:palette-help` CustomEvent dispatch (Story 3.2 → 3.3 contract) not tested end-to-end [scripts/_smoke_help_overlay.js]
- [x] [Review][Patch] `.shell-help-header h2:focus { outline: none; }` is dead CSS without tabindex — will be cleaned up automatically when the first patch lands
- [x] [Review][Patch] `focusHeading()` `preventScroll: false` is the default and is misleading — likely the developer meant `true` to suppress viewport jump on focus restore [assets/js/help-overlay.js:412-421]
- [x] [Review][Patch] `onOverlayKeydown` `?`-toggle missing modifier guard — only the document-level guard has it; inconsistency [assets/js/help-overlay.js:510]
- [x] [Review][Patch] Embed-mode CSS rule `:root[data-embed="1"]` never matches because `shell.js` does not set `<html data-embed="1">` (it only sets `window.HT_SHELL_EMBED = 1`) [assets/css/components.css + assets/js/shell.js]

### defer
- [x] [Review][Defer] `closeHelp()` does not reset `callingElement` when called with `openState === false` early-return — next open captures a fresh `document.activeElement`, masking the stale reference
- [x] [Review][Defer] `isMac()` does not consult `navigator.userAgentData` — UA Client Hints aspirational per spec; current browsers work without it
- [x] [Review][Defer] Help block markup still emitted on embed pages even when JS is a no-op (~1.5KB inert payload) — consistent with Story 1.7 palette pattern

### dismissed (noise)
- z-index 1050 help overlay below settings modal (1100) — intentional layering per UX-DR-3 (overlays below modals)
- Help block ordering in `index.html` and pack pages — verified palette → settings → help order is correct in actual file
- `HT_HELP_OVERLAY_INIT` listed in api-contract.js with `stability: 'internal'` — intentional tripwire per Story 3.2 patch conventions
- Brittle regex `HELP_REGION_RE` in shell-a11y-check.py requiring attribute order — fixed in same commit for `HELP_SEARCH_RE` via lookaheads; outer region regex matches the canonical order (Story 1.7's `PALETTE_REGION_RE` uses the same pattern)

## Dev Agent Record

### Agent Model Used

Opus 4.8 (puku-ai-2.7)

### Debug Log References

- See "Debug Log" section above.

### Completion Notes List

- All 11 tasks complete; 13/13 review patches applied; all gates green (shell-drift-check 42/42, shell-a11y-check all structural invariants, help-overlay-smoke 84/0, shell-public-api-smoke 23/0, palette-actions-smoke 52/0, shell-bounds-check all pages).
- Story ready for completion — moved to `done`.

### File List

**Created:**
- `assets/shell/help.html` — canonical help overlay markup (Task 1)
- `assets/js/help-overlay.js` — listener + renderer + filter module (Task 5)
- `scripts/_smoke_help_overlay.js` — Node + vm smoke harness, 84 assertions after review patches (Task 8)

**Modified:**
- `scripts/shell-template.py` — help.html splice + byte-aligned gate (Task 2)
- `scripts/shell-drift-check.py` — help region in per-page grep (Task 3)
- `scripts/shell-a11y-check.py` — `check_help_aria` + lookahead `HELP_SEARCH_RE` (Task 4, 11)
- `assets/css/components.css` — `.shell-help*` rules appended (Task 6)
- `assets/js/api-contract.js` — version 1.10.0 → 1.11.0, `HT_HELP_OVERLAY_INIT` entry (Task 7)
- `Makefile` — `help-overlay-smoke` target (Task 9)
- `scripts/site-config-gate.py` — `EXPECTED_VERSION` 1.10.0 → 1.11.0 (Task 10)
- `scripts/generate-pack-pages.py` — help block splice + script tag (Task 11)
- `quality.html` — hand-patched help block + script tag (Task 11); tabindex="-1" added on review-patch-1
- `scripts/_smoke_a11y.js` — version pin 1.8.0 → 1.11.0 (Task 11)
- `scripts/_smoke_sample_data.js` — version pin 1.8.0 → 1.11.0 (Task 11)
- `scripts/_smoke_url_state_codec.js` — version pin 1.8.0 → 1.11.0 (Task 11)
- `scripts/_smoke_history_panel.js` — version pin 1.8.0 → 1.11.0 (Task 11)
- `scripts/_smoke_share_dialog.js` — version pin 1.8.0 → 1.11.0 (Task 11)
- `assets/js/shell.js` — review-patch-13: set `<html data-embed="1">` for embed mode (parallel to `HT_SHELL_EMBED`)

**Regenerated:**
- 35 tool pages (splice help.html + help-overlay.js script tag)
- `index.html` (home page)
- 5 pack pages (auto-spliced via `generate-pack-pages.py`)
- `privacy.html`, `settings.html`

## Status

done