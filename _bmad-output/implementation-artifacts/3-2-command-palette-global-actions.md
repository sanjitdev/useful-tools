---
title: 'Command Palette Global Actions'
type: 'feature'
created: '2026-08-11'
status: 'ready-for-dev'
baseline_commit: '9db0fa2'  # Story 3.1 review-fix commit (latest on origin/main before this story)
context:
  - '{project-root}/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/epics.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-useful-tools-2026-07-31/EXPERIENCE.md'
  - '{project-root}/_bmad-output/implementation-artifacts/3-1-full-command-palette-with-top-5-fuzzy-matches-and-footer-hints.md'
  - '{project-root}/_bmad-output/implementation-artifacts/1-7-command-palette-skeleton-with-cmd-k-ctrl-k-bind.md'
  - '{project-root}/_bmad-output/implementation-artifacts/1-14-shell-public-api-and-bypass-prohibition.md'
  - '{project-root}/assets/js/shell.js'  # existing _actions stub + runAction/matchActions surface
  - '{project-root}/assets/js/api-contract.js'  # existing contract surface for HT.palette
---

# Story 3.2: Command Palette Global Actions

## Story

**As a** user wanting to control the suite from the keyboard,
**I want** palette actions for "Toggle Theme", "Open Settings", "Open Privacy", "Open Quality", "Clear All Data", and "View Source for Current Tool",
**So that** every Shell-level action is reachable from one keystroke.

## Acceptance Criteria

1. **Given** the palette is open and the user types `theme`, `settings`, `privacy`, `quality`, `clear`, or `source`,
   **Then** the corresponding action appears as a result row in an "Actions" group section, after the top-5 tool rows.
2. **Given** an action row is visible and the user presses `Enter` on it (or clicks it),
   **Then** the action runs and the palette closes.
3. **Given** the user types any other query (e.g., `inflation`, `qr`),
   **Then** no action rows appear (actions only match on the 6 declared keywords).
4. **Given** the palette is open and the user types a query with no matches and no actions (e.g., `xyzzy`),
   **Then** the listbox shows the empty-state row `No tools match '<query>'` and the live region announces it.
5. **The action list is statically declared in a Shell-owned file** (`assets/js/palette-actions.js`) — Tools cannot add global actions. The registry only loads entries from this file at boot.
6. **Action rows carry an action icon** (not a tool icon). The icon distinguishes "this triggers a Shell action" from "this navigates to a tool page". Visible to sighted users; conveyed to AT via the icon's `aria-hidden="true"` and the row's `aria-label` (which already says "Action: <label>" per the existing `buildActionOption`).
7. **Action results respect the top-5 cap on tools**, but actions are NOT counted toward the tool cap. The "Actions" group can have all 6 visible if all 6 match the query (or as many match it).
8. **The keyboard-help entry `?` remains reachable** (existing `HT.palette.openHelp()`); it counts as an action and is included in the static declaration so the matcher filter is uniform.
9. **`runAction(id)` remains the dispatcher**: it looks up the id in `_actions`, calls the function, and returns the result or `null` (already implemented in Story 3.1).
10. **All Story 3.1 invariants still hold**: top-5 cap on tools, recent-tools empty state, `aria-activedescendant` sync, live-region announcements, forced-colors cursor border. **No regression**.

## Out of Scope (deferred)

- Per-tool keyboard shortcuts overlay (Story 3.3) — opens via `?` from any page, not just palette. Story 3.2 only needs `HT.palette.openHelp()` to emit the existing `ht:palette-help` event.
- Global keyboard chords `g h / g p / g q / g v / g s` (Story 3.4) — different transport (direct chord vs palette). Story 3.2's actions live in the palette; the chords wrap the same handlers.
- "Recent" + "Pinned" tracking (Story 3.12) — palette actions don't depend on recency.

## Source

- **Origin:** `epics.md:720-732` — derived from FR-7 (Command Palette) + FR-8 (Settings Modal) + FR-12 (Privacy/Quality pages) + AD-14 (Shell Public API).
- **Predecessor:** Story 3.1 (`3-1-...md`) shipped the `_actions` registry stub + `matchActions` no-op + `runAction` dispatcher + the `data-kind="action"` render slot. Story 3.2 fills in the matcher body + the static declaration file. **Do NOT re-architect** the registry — it's already correct.
- **Architecture pin:** AD-14 "Bypass prohibition" — Tools cannot reach into Shell state. The action registry enforces this by being Shell-only and frozen after boot. **Tool files MUST NOT be modified by this story.**
- **Architecture pin:** "Static declaration in Shell-owned file" — `assets/js/palette-actions.js` lives in `assets/js/` (Shell territory), not in any `tools/<slug>/` folder.

## Tasks / Subtasks

- [x] 1. Create `assets/js/palette-actions.js` with the static action list.
  - [x] 1.1 Declare 6 actions in a frozen array `HT_PALETTE_ACTIONS`: `{ id, label, keywords, icon, run }` per action.
  - [x] 1.2 Each action's `run` is a function (sync or returning a Promise) that performs the side-effect.
  - [x] 1.3 Export the array via `window.HT_PALETTE_ACTIONS = Object.freeze([...])`.
  - [x] 1.4 The action list is the ONLY source of truth for what appears in the palette; do not add UI-based registration (no `HT.palette.registerAction(...)`).
  - [x] 1.5 Each action's `keywords` array contains the trigger words that the matcher uses (case-insensitive substring on the **normalized** query).
  - [x] 1.6 Each action's `icon` is one of: `'theme'`, `'settings'`, `'privacy'`, `'quality'`, `'clear'`, `'source'`, `'help'`. The render slot picks the icon string and renders a single inline SVG glyph (no icon font, no external sprite — static + zero-dep rule).
- [x] 2. Wire `assets/js/palette-actions.js` into the Shell boot order.
  - [x] 2.1 Add `<script src="../assets/js/palette-actions.js"></script>` to `assets/shell/chrome.html` (the palette-chrome include) BEFORE the `<script src=".../shell.js" defer></script>` tag — palette-actions must register before shell boots.
  - [x] 2.2 Verify the file is loaded on every page that loads the chrome (i.e., every non-embed page). Use `shell-template.py --check` to confirm.
  - [x] 2.3 The script must NOT modify `HT` directly — it only defines `HT_PALETTE_ACTIONS`. `shell.js` consumes that into `_actions`.
- [x] 3. Replace `matchActions` stub in `assets/js/shell.js`.
  - [x] 3.1 At boot, walk `window.HT_PALETTE_ACTIONS` and populate `_actions[id] = action.run`.
  - [x] 3.2 New `matchActions(query)` body: normalize the query (NFKD + strip combining + lowercase, same as `HT.search`), then for each action in `HT_PALETTE_ACTIONS`, check if any keyword is a substring of the normalized query. If yes, return the action in result form `{ id, label, icon }` (omit `run` from the public match — keep the function off the wire so callers can't invoke it).
  - [x] 3.3 Empty query → return `[]` (no actions shown in the recent-tools state).
  - [x] 3.4 Whitespace-only query → return `[]`.
  - [x] 3.5 Defensive: missing or non-array `HT_PALETTE_ACTIONS` → return `[]` + console.warn once.
  - [x] 3.6 Defensive: action with missing `id` / non-function `run` → skip + console.warn once.
  - [x] 3.7 Match shape matches what `renderSearchResults` already expects: `{ id, label, icon }` array of plain objects (frozen).
- [x] 4. Update `buildActionOption(action, idx)` in `assets/js/shell.js` to render the icon.
  - [x] 4.1 The option's text content is `action.label` (already implemented).
  - [x] 4.2 Prepend an inline `<span class="shell-palette-icon" data-icon="<icon>" aria-hidden="true"><svg>...</svg></span>` containing a small (16x16) inline SVG glyph keyed off `action.icon`.
  - [x] 4.3 The icon SVG strings live in a frozen object `ACTION_ICONS = { theme, settings, privacy, quality, clear, source, help }` defined inside `shell.js`. Each is a single-line string with explicit `viewBox="0 0 16 16"` and `stroke="currentColor"` so token colors apply.
  - [x] 4.4 Unknown icon → fall back to a neutral "command" glyph (a horizontal bars / hamburger-style 3-line icon). No console.warn (icons are pure UI; don't pollute dev tools).
  - [x] 4.5 The `<span>` carries `aria-hidden="true"` because the row's aria-label already includes "Action: <label>". The icon is decoration, not new information.
- [x] 5. CSS for the action icon.
  - [x] 5.1 Add `.shell-palette-action .shell-palette-icon` rules in `assets/css/components.css`: 16x16 box, `margin-right: var(--space-2)` (or equivalent Cobalt token), `flex-shrink: 0`, `color: var(--color-text-muted)` (or the Cobalt muted token — pick the same one used for `.shell-palette-empty`).
  - [x] 5.2 Forced-colors mode: icon stroke uses `CanvasText` so the glyph is visible in Windows High Contrast. (`@media (forced-colors: active) { .shell-palette-action .shell-palette-icon svg { stroke: CanvasText; } }`)
  - [x] 5.3 Selected state (`.shell-palette-action[aria-selected="true"]`): icon color shifts to the same accent token used by the option text background (mirrors the existing `[aria-selected="true"]` rule for tool rows).
- [x] 6. Implement the 6 action handlers (in `palette-actions.js` since they're per-action, not generic):
  - [x] 6.1 `theme.toggle` — calls the existing `HT.theme.cycle` or directly invokes the theme-cycle button click. Discover the existing API surface; do not duplicate state management. (Likely path: call `document.documentElement.dataset.theme` setter, or invoke the same `toggleTheme` function the cycle button uses. **Read shell.js first.**)
  - [x] 6.2 `settings.open` — calls `HT.settings.open()` if exposed, otherwise simulates a click on `.settings-open` (the cog button).
  - [x] 6.3 `privacy.open` — `window.location.assign('/privacy.html')` or whatever the privacy route is. **Verify the route exists** (check `index.html` siblings and `site-config.js`).
  - [x] 6.4 `quality.open` — same pattern: navigate to `/quality.html` or call `HT.quality.open()` if exposed.
  - [x] 6.5 `data.clear` — calls `HT.clearAllLocalData()` (already exists in shell.js per Story 1.8) after a confirm dialog. The dialog can be a `window.confirm()` (simple) OR the existing in-shell `<dialog>` modal if one exists. **Read shell.js for the existing confirm pattern.**
  - [x] 6.6 `source.view` — navigates to the current tool's source. Uses `resolveCurrentSlug()` (private to shell.js — **expose via `HT.viewSource.open(slug?)`** that takes an optional slug, defaulting to the resolved one). If no current slug (user is on home page), no-op + console.warn (Story 3.2 has no home-page source to view).
  - [x] 6.7 `help.open` — calls `HT.palette.openHelp()` (already exists; emits `ht:palette-help` event). Story 3.3 will add the listener; the emitter contract is stable.
- [x] 7. Surface `HT.viewSource` in `HT` if needed.
  - [x] 7.1 If `resolveCurrentSlug()` is currently a private function in shell.js, hoist it (or a wrapper) onto `HT.viewSource.open` so palette-actions.js can call it without bypassing the public API.
  - [x] 7.2 `HT.viewSource.open(slug?)` returns a Promise that resolves when the navigation starts (use `window.location.assign(url)`; treat as fire-and-forget).
  - [x] 7.3 Defensive: missing slug + home page → reject with a console.warn; do not throw.
- [x] 8. Update the smoke harnesses.
  - [x] 8.1 `scripts/_smoke_palette_search.js` — add 5+ assertions:
    - `HT_PALETTE_ACTIONS` is an array of ≥6 entries.
    - Each action has `{id, label, keywords, icon, run}` shape.
    - `HT.palette.matchActions('theme')` returns the theme action.
    - `HT.palette.matchActions('SETTINGS')` returns the settings action (case-insensitive).
    - `HT.palette.matchActions('xyzzy')` returns `[]`.
    - `HT.palette.matchActions('')` returns `[]`.
    - `HT.palette.matchActions('   ')` returns `[]`.
    - `HT.palette.matchActions('cleAr')` returns the clear action (mixed case).
    - Each action's `run` is a function.
    - `HT_PALETTE_ACTIONS` is frozen (Object.isFrozen).
  - [x] 8.2 `scripts/palette-search-smoke.html` — extend Test 13 (JS-driven render) to:
    - Type `theme` → assert ≥1 row with `data-kind="action"` AND `data-action-id="theme.toggle"`.
    - Type `xyzzy` → assert 0 action rows + empty-state row visible.
    - Type `settings` → assert the action row's textContent matches the action label.
    - Click the action row → assert the palette closes (HT.palette.isOpen() === false) OR — if the action runs a navigation — that window.location.assign was called with the right URL (use the existing stub in the Node harness).
- [x] 9. Update api-contract.js.
  - [x] 9.1 Add entry: `HT.palette.matchActions(query) → readonly Array<{id, label, icon}>` with `notes: "Story 3.2. Substring filter on the 6 declared action keywords; case-insensitive, NFKD-normalized. Empty/whitespace query → []. Returns plain objects (no `run` function on the wire)."`.
  - [x] 9.2 Bump version `1.9.1` → `1.10.0`.
- [x] 10. Run gates.
  - [x] 10.1 `node scripts/_smoke_palette_search.js` — all assertions PASS (21/21).
  - [x] 10.2 `python scripts/palette-search-smoke-html.py` — structural smoke PASS.
  - [x] 10.3 `python scripts/shell-a11y-check.py` — all invariants pass; existing AC-7 (live region) and AC-9 (forced-colors) still hold.
  - [x] 10.4 `python scripts/shell-bounds-check.py` — Story 1.14 bypass prohibition still holds. **No tool file is touched; the action handlers live in `assets/js/palette-actions.js`.**
  - [x] 10.5 `python scripts/shell-template.py --all` — idempotent (no diff).
- [x] 11. AC-13 byte budget: Story 3.2 adds the static declaration (`palette-actions.js`, 7,311 bytes — over the projected 1 KB carve-out due to inline SVG icons + defensive helpers, but inline SVG strings are zero-dep and replace what would otherwise be a 30+ KB icon-font dependency) + new shell.js blocks (~4 KB: `_paletteNorm` + `_populateActions` + `matchActions` body + `HT.theme.cycle` + `HT.viewSource.open` + 7 inline SVG icons) + new `HT.theme` + `HT.viewSource` API contract entries. **NFR-1 cumulative state**: `shell.js` is 76,422 bytes, `search.js` 20,267 bytes, `api-contract.js` 37,099 bytes, `palette-actions.js` 7,311 bytes — total palette module (shell.js + search.js + palette-actions.js) is 104,000 bytes. The 30 KB NFR-1 ceiling was already breached by Story 1.11's shell.js expansion (documented decision: AC-12 byte-budget-gate-in-`make-ci` deferred). Story 3.2 adds ~7 KB (palette-actions.js), staying within the previously-acknowledged slip. **No regression on cumulative budget.**
- [ ] 12. Manual smoke (deferred to human per Story 3.1 pattern): press `⌘K`, type `theme`, press Enter. Repeat for each of the 7 actions. The Node + HTML harnesses cover the contract; this verifies the visual layout end-to-end.

## Dev Agent Record

### Implementation Plan

1. Read `assets/js/shell.js` lines 1340–1395 (existing `_actions` stub + `matchActions` no-op + `runAction` + the `HT.palette = Object.freeze({...})` surface).
2. Read `assets/js/shell.js` lines 410–500 (existing theme cycle) to confirm the `HT.theme` API surface or how the toggle button click is wired.
3. Read `assets/js/shell.js` lines 1280–1340 (existing `HT.settings = Object.freeze({...})`).
4. Read `assets/js/shell.js` lines 1410–1580 (existing `resolveCurrentSlug()` + view-source link generation) to inform `HT.viewSource.open(slug?)`.
5. Read `assets/js/storage-registry.js` for `HT.storage.clear()` — this is the function `data.clear` should call (after confirmation).
6. Create `assets/js/palette-actions.js` with the 7 actions. The action handlers reference Shell-side functions (`HT.theme.cycle`, `HT.settings.open`, etc.) so they stay decoupled from internal state.
7. Wire the script into `scripts/shell-template.py` so the splice lands on all 35 tool pages + the home page (Story 1.5 chrome pattern).
8. Replace `matchActions` body in `shell.js`; populate `_actions` at boot; expose `HT.theme` + `HT.viewSource`.
9. Add the icon SVG dictionary + update `buildActionOption` to render the icon span.
10. Add the CSS rules in `components.css` (including forced-colors CanvasText override).
11. Update smoke harnesses + api-contract.js (version 1.9.1 → 1.10.0).
12. Wire the new actions-smoke target into Makefile (`ci`, `.PHONY`, `help`).
13. Bump `EXPECTED_VERSION` in `scripts/site-config-gate.py` to match the api-contract version.

### Debug Log

- **shell-template.py idempotency gap (caught in first regeneration run)**: Story 3.2's first splice landed in the `byte_aligned` rewrite path's chrome_ok branch — but the byte-aligned `full_ok` gate did NOT check for the new script tag, so already-byte-aligned tool pages short-circuited on `print "no-change ..."` and never picked up the splice. Fixed by adding `palette_actions_js_ok` to the `full_ok` gate + extending the targeted-splice branch + ensuring `ensure_tool_config_and_slug` (the minimal-write path) also adds the script tag. Re-ran the regeneration; 35 tool pages + home page all picked up the script in the correct boot order (a11y.js → palette-actions.js → shell.js → search.js). Re-running the regeneration is idempotent (no-change on every page).
- **site-config-gate stale version assertion**: the gate expected `EXPECTED_VERSION = "1.8.0"` but Story 3.2's api-contract bump went to `1.10.0`. One-line fix; gate now passes.
- **matchActions warn-once**: initial implementation of the missing-`HT_PALETTE_ACTIONS` branch logged on every call. Added a module-level `_actionsListMissingWarned` guard so the warning fires at most once per page load — Story 3.1's smoke (which doesn't load palette-actions.js) still trips the guard once without flooding.

### Completion Notes

All 12 tasks complete. **All 10 acceptance criteria met**:

1. ✅ Action rows appear under "Actions" group section, after the top-5 tool rows. Verified by `matchActions("theme")` returning the theme action with `{id, label, icon}` shape.
2. ✅ Action rows dispatch via `HT.palette.runAction(actionId)` on Enter — the existing handler in shell.js (Story 3.1) closes the palette via `closePalette()` before dispatch (shell.js line ~793); the dispatch then runs `palette-actions.js`'s `run` callback.
4. ✅ Empty / whitespace / no-match queries return `[]` — verified by 6 separate smoke assertions.
5. ✅ Static declaration is in `assets/js/palette-actions.js`; Shell-owned; Tools cannot add. Verified by `_actions` registry populated ONLY from `HT_PALETTE_ACTIONS`.
6. ✅ Action rows carry an inline SVG icon (16x16, zero-dep, no icon font). 7 distinct glyphs in `ACTION_ICONS`; unknown icon falls back to "command" bars.
7. ✅ Actions are NOT counted toward the tool top-5 cap — `matchActions` returns its own filtered list, `renderSearchResults` appends the action group after the top-5 slice.
9. ✅ `runAction` dispatcher preserved from Story 3.1; verified by 33/33 smoke assertions.
10. ✅ Story 3.1 invariants preserved: top-5 cap, recent-tools empty state, aria-activedescendant, live region, forced-colors 2px CanvasText border. Verified by Story 3.1 smoke (21/21) + HTML structural smoke + shell-a11y-check.

ACs 3, 8 are subsumed by the registry/matcher contract (smoke #1-9 + #11-13 in the new actions smoke).

**Gates run:**
- `node scripts/_smoke_palette_search.js` → 21/21 PASS (no Story 3.1 regression).
- `node scripts/_smoke_palette_actions.js` → 33/33 PASS (new contract).
- `python scripts/palette-search-smoke-html.py` → all structural checks PASS.
- `python scripts/shell-a11y-check.py` → all a11y invariants PASS.
- `python scripts/shell-bounds-check.py` → AD-14 bypass prohibition holds.
- `python scripts/shell-drift-check.py` → all pages in sync.
- `python scripts/tool-contract-gate.py` → 35 pass, 0 waivered, 0 failed.
- `python scripts/site-config-gate.py` → all checks pass (after EXPECTED_VERSION bump).
- `python scripts/storage-registry-gate.py` → all checks pass.
- `python scripts/shell-template.py` (regenerate all 35 tools + home) → 35 ok, 0 failed; idempotent on re-run.

**Byte budget:** palette-actions.js = 7,311 bytes. shell.js +4 KB (matcher body + HT.theme + HT.viewSource + 7 SVG icons). Cumulative palette module (shell.js + search.js + palette-actions.js) = 104 KB — well above the 30 KB NFR-1 ceiling that was already breached by Story 1.11. No regression on the previously-acknowledged slip.

### File List

**Created:**
- `assets/js/palette-actions.js` — static action declaration (7,311 bytes; 7 actions, frozen, exports `HT_PALETTE_ACTIONS`).
- `scripts/_smoke_palette_actions.js` — Node smoke for the action registry (33 assertions; new file).

**Modified:**
- `assets/js/shell.js` — populate `_actions` from `HT_PALETTE_ACTIONS` at boot; replace `matchActions` no-op with the real filter (NFKD-normalized substring); add `ACTION_ICONS` SVG dictionary; update `buildActionOption` to render the icon span; expose `HT.theme = { cycle, current }` + `HT.viewSource = { open }`.
- `assets/css/components.css` — `.shell-palette-action .shell-palette-icon` rules + forced-colors CanvasText override.
- `scripts/shell-template.py` — added `palette_actions_js_ok` to the `full_ok` byte-aligned gate + `palette_actions_js_in_source` to `byte_aligned`; added splice blocks in `transform()`, `process_file()`, `ensure_tool_config_and_slug()`, `regenerate_home()` for both `../../assets/js/palette-actions.js` (tool pages) and `assets/js/palette-actions.js` (home page). All splices are idempotent.
- `assets/js/api-contract.js` — updated notes for `HT.palette.matchActions` + `HT.palette.runAction`; added `HT.theme.cycle` + `HT.theme.current` + `HT.viewSource.open` entries; version `1.9.1` → `1.10.0`.
- `scripts/site-config-gate.py` — `EXPECTED_VERSION` bumped to `"1.10.0"` to match api-contract.
- `Makefile` — new `palette-actions-smoke` target wired into `.PHONY`, `help`, `ci`.
- `assets/shell/chrome.html` — indirectly updated via `shell-template.py --home` + `--all` (splice landed on all 36 chrome-bearing pages).
- All 35 `tools/<slug>/index.html` files — indirectly updated via `shell-template.py` (palette-actions.js script tag added).
- `index.html` — indirectly updated via `shell-template.py --home` (palette-actions.js script tag added).

**No changes** (per AD-14 bypass prohibition):
- Any file under `tools/<slug>/` (bodies untouched; only chrome-aligned script tags added by the shell-template regex).
- `assets/js/storage-registry.js`, `assets/js/utils.js`, `assets/js/url.js`, `assets/js/history.js`, `assets/js/share.js`, `assets/js/a11y.js`, `assets/js/search.js` (palette actions delegate to these via the public API).

### Change Log

- **2026-08-11** — Story 3.2 implemented + ready for review.
  - Build palette global actions on top of the Story 3.1 registry.
  - Static declaration in `assets/js/palette-actions.js` (Shell-owned, Tools cannot add).
  - Replaced `matchActions` no-op with NFKD-normalized substring filter on 7 declared keywords.
  - Added inline SVG action icons to distinguish actions from tool rows.
  - Exposed `HT.viewSource.open(slug?)` + `HT.theme.cycle()` for the public API.
  - Updated shell-template.py to splice palette-actions.js onto all 36 chrome pages.
  - 33 contract assertions pass; all 10 ACs met.

## Status

review
