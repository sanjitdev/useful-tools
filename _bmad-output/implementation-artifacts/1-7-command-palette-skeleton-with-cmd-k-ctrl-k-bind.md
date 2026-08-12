---
title: 'Command Palette Skeleton with ⌘K / Ctrl-K Bind'
type: 'feature'
created: '2026-08-06'
status: 'done'
review_loop_iteration: 1
baseline_commit: '2e2d155974f2655c2d3c38e765f356c3e7a24d6b'
context:
  - '{project-root}/project-context.md'
  - '{project-root}/_bmad-output/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/ux-designs/ux-useful-tools-2026-07-31/EXPERIENCE.md'
  - '{project-root}/_bmad-output/ux-designs/ux-useful-tools-2026-07-31/DESIGN.md'
  - '{project-root}/_bmad-output/implementation-artifacts/1-5-shell-html-skeleton-with-cobalt-tokens.md'
  - '{project-root}/_bmad-output/implementation-artifacts/1-6-theme-system-with-light-dark-and-auto-modes.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 1.5 rendered the search-bar trigger as a no-op button (`shell.js:147` logs `shell.search: pending Story 1.7`) and the spec explicitly defers full functionality. A keyboard-first user opening the homepage today has no way to reach a tool without reaching for the mouse: the `⌘K` / `Ctrl-K` chord does nothing, and the trigger button is inert. Story 1.6 closed the loop on `aria-pressed` re-sync, but the palette skeleton that drives the chord is still missing — so the keyboard-first differentiator is dead-on-arrival until a real palette lands.

**Approach:** Add a single, shared palette overlay (`<div role="combobox">` with `<input role="searchbox">` + `<ul role="listbox">`) that mounts once at `HT.boot()`, opens on `⌘K` / `Ctrl-K` from any page, and closes on `Escape` with focus restored to the calling element. The skeleton renders a single "Recent tools" group reading `localStorage.handy-tools.recent` (Story 3.12 will own the write side; this story only reads). No fuzzy search, no global actions, no keyboard help overlay — those are Story 3.1, 3.2, and 3.3. The skeleton proves the ARIA combobox 1.1 listbox pattern (UX-DR-19) end-to-end and unblocks the rest of the palette work.

## Boundaries & Constraints

**Always:**
- WAI-ARIA combobox 1.1 listbox pattern: `<div role="combobox" aria-haspopup="listbox" aria-owns="<listbox-id>" aria-expanded="...">` wrapping `<input role="searchbox" aria-controls="<listbox-id>" aria-activedescendant="...">` + `<ul role="listbox" id="<listbox-id>">`. This is the pattern Story 3.1 extends — the skeleton is its contract.
- ⌘K (`Meta+K`) on macOS, `Ctrl+K` elsewhere. Both chords open the palette from any focusable element. `/` from outside a text input also opens the palette (per UX-DR-6 home-search fallback).
- `Escape` closes the palette and returns focus to whatever element had focus at open time (the calling element). If the calling element was removed in the meantime, focus moves to `<main>`.
- The palette is a `dialog` semantically (per WAI-ARIA 1.2 combobox listbox is the overlay pattern, but the UX-DR-3 modal/overlay/sheet taxonomy calls this an **overlay**: non-blocking, focus not trapped). `aria-modal` is NOT set (overlay per UX-DR-3, not modal).
- ?embed=1 hides the trigger (per AD-7) and the `⌘K` chord is a no-op. The palette node never mounts in embed mode (cheaper than mount+hide).
- Recent tools read from `localStorage.getItem('handy-tools.recent')` as a JSON array of slug strings (Story 3.12 will own the write side and the cap). Empty array or missing key is the same case: palette renders an "empty recent" placeholder (UX-DR-18).
- The palette is the **single** `<div>` mounted on every page at `HT.boot()`. It is not a per-tool element.
- No fuzzy matching, no top-5 results, no global actions, no footer hints, no `?` overlay in this story. Those are Story 3.1, 3.2, 3.3 respectively. The skeleton has the layout space for the footer but renders empty.
- No `<script src>` external host. Vendored libraries stay under `assets/js/vendor/`. No imports (AD-12).

**Ask First:**
- Whether `handy-tools.recent` is the correct key for v1 or if it should be `ht.recent` until Story 1.10's storage registry migrates it. The PRD §FR-12 says `handy-tools.history.<slug>` for history but is silent on recent; the architecture spine line 117 says `handy-tools.recent` is the eventual key. **Default:** read `handy-tools.recent` (matches architecture intent; Story 1.10 will register it formally).

**Never:**
- Render the palette inside any Tool page. AD-4 + AD-13: Tools never own global chrome. The palette mounts in `assets/shell/palette.html` and is referenced by `assets/shell/chrome.html` as a static include, just like header/footer.
- Re-implement theme/locale/settings/history inside the palette skeleton. Story 3.1 adds the global actions palette; this story wires no theme toggle inside the palette overlay.
- Add a keyboard chord that conflicts with the existing browser/OS chord. `⌘K` is reserved by browsers for "search in page" on some Linux configs — accept the conflict (the chord is documented in the placeholder; Story 3.4 documents the global chord map).
- Add `aria-modal="true"` to the palette overlay (UX-DR-3 says overlay, not modal).
- Re-implement the palette in jQuery / framework / module system. ES2018 vanilla JS, single IIFE inside `assets/js/shell.js` (no new file in this story; the palette module is split into `assets/js/palette.js` only if it exceeds 200 lines or exceeds the 30KB NFR-1 budget). Default: keep it inline in `shell.js`.
- Use `localStorage` JSON encoding for `handy-tools.recent`. The skeleton reads via `JSON.parse` because the value is an array (HT.storage convention per project-context.md §3). Story 3.12 owns the write side and the encoding.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Cold load, no recent tools, no query | `localStorage.handy-tools.recent` unset | Palette opens, focus on input, listbox shows "No recent tools yet" placeholder; footer empty | N/A |
| Cold load, recent tools present | `handy-tools.recent = ["qr-code-generator","tip-calculator"]` | Palette opens, listbox shows both slugs as items with title-case labels, no scores (Story 3.1) | N/A |
| `localStorage` JSON malformed | `handy-tools.recent = "{not-json"` | Palette opens with empty state; warn-once `console.warn`; treat as empty | warn-once |
| Press ⌘K from `<input>` outside palette | focus on tool input | Palette opens, focus moves to palette input, original input retains its value | N/A |
| Press ⌘K twice in succession | palette already open | No-op (palette is idempotent on open); input retains focus | N/A |
| Press Escape from palette input | palette open | Palette closes, focus returns to calling element (whatever had focus at open) | N/A |
| Press Escape from outside palette | palette closed | No-op (no listener leakage) | N/A |
| Press `/` from outside any input/text area/select/contenteditable | home page, body focused | Palette opens | N/A |
| Press `/` from inside a tool input | focus in text input | No-op (the `/` is the user's text input) | N/A |
| Press ↓ from palette input | palette open, input focused | Focus moves to first listbox option (`activeDescendant` set on input); one ArrowDown per press | N/A |
| Press ↑ from palette input | palette open, focus on first option | Focus stays on input (no wrap), `activeDescendant` clears | N/A |
| Press Enter from palette input | palette open, no option active | No-op (skeleton: no selection without fuzzy match; Story 3.1 wires Enter on active option) | N/A |
| Press Enter with active option | palette open, second option active | Navigates to `/tools/<slug>` for that slug | N/A |
| Tab from palette input | palette open | No-op (overlay pattern — focus stays in overlay per UX-DR-3 + AI-8 combobox 1.1) | N/A |
| Click outside palette | palette open | Palette closes (UX-DR-3 overlay: click-outside dismiss; same as Escape); focus returns to calling element | N/A |
| Click on recent tool list item | palette open | Navigates to `/tools/<slug>`, palette closes | N/A |
| `?embed=1` in URL | embed mode | Palette trigger hidden via CSS, chord is no-op, palette node never mounts | N/A |
| `forced-colors: active` | UA mode | Palette uses system colors (`Highlight`, `HighlightText`); no cobalt overrides | N/A |
| `prefers-reduced-motion: reduce` | UA mode | No transition on palette open/close (already enforced in 1.5 chrome block) | N/A |
| Calling element removed while palette open | palette open, focus-tracker stale | On close, focus moves to `<main>` (graceful fallback) | warn-once |

</frozen-after-approval>

## Code Map

- `assets/js/shell.js:147-149` — `shell-search-trigger` is currently a no-op `console.info` handler in `onClick()`. Replace with `openPalette()`. ES2018 IIFE.
- `assets/js/shell.js:92-128` — `boot()`. Extend to (a) call `mountPalette()` once per page (skip if `?embed=1`), (b) install global `keydown` listener for ⌘K/Ctrl+K and `/`, scoped to early-return when focus is in a text input/textarea/select/contenteditable. Listener installed once via `{ once: false, capture: true }` so it runs before tool page handlers can `preventDefault`.
- `assets/shell/chrome.html:17` — `<button class="shell-search-trigger" type="button" aria-label="Search tools">` is already in the chrome. Story 1.7 does **not** modify this markup — the button is the trigger; the palette overlay is the new DOM.
- `assets/shell/palette.html` (NEW) — canonical source for the palette overlay markup: `<div class="shell-palette" role="combobox" aria-haspopup="listbox" aria-owns="palette-listbox" aria-expanded="false">` containing `<input class="shell-palette-input" role="searchbox" aria-controls="palette-listbox" aria-activedescendant="" aria-autocomplete="list">`, `<ul class="shell-palette-list" id="palette-listbox" role="listbox" aria-label="Tools"></ul>`, and `<div class="shell-palette-footer" aria-hidden="true"></div>` (empty in skeleton). Hidden by default via `hidden` attribute; `aria-hidden="true"` toggles with visibility.
- `index.html` + `tools/<slug>/index.html` — every page needs the palette node. `scripts/shell-template.py` (Story 1.5) is extended to insert the palette include marker `<!-- shell:palette -->` after `<!-- shell:footer -->`, and the include body is the verbatim contents of `assets/shell/palette.html`. The drift check (`scripts/shell-drift-check.py`) is extended to extract the `<!-- shell:palette -->` region and grep every page.
- `assets/js/api-contract.js:14-44` — extend `entries` array with `HT.palette.open()`, `HT.palette.close()`, `HT.palette.toggle()`, `HT.palette.isOpen()`, all `stable`, all owned by `assets/js/shell.js` (palette module stays inline in shell.js per the "Always" constraint).
- `assets/css/components.css` — add the `.shell-palette` overlay styles: fixed-position centered, max-width 640px, frosted backdrop via `backdrop-filter: blur(8px)`, cobalt-tokens for input/listbox/footer, hidden state via `[hidden]` attribute, open state via `aria-expanded="true"`. Honor `forced-colors` (system Highlight on active item) and `prefers-reduced-motion` (no open/close transition). ~120 lines of CSS.
- `assets/css/base.css:197-275` — existing `.shell-search-trigger` styling stays. Story 1.7 does not modify the trigger.
- `scripts/shell-a11y-check.py` (existing) — extend `check_*` suite with `check_palette_aria`: every page has the palette node, exactly one `<div role="combobox">`, exactly one `<input role="searchbox">` with `aria-controls="palette-listbox"`, exactly one `<ul id="palette-listbox" role="listbox">`, and `aria-expanded` is initially `"false"` in the static markup.
- `scripts/shell-drift-check.py` — extend the region extraction to include `<!-- shell:palette -->`. The chrome template is the canonical source; drift check extracts three regions (header, footer, palette) and greps every page for byte-equivalence.
- `assets/js/utils.js:114-128` — `HT.storage` is the read path for `handy-tools.recent`. The skeleton uses `HT.storage.get('handy-tools.recent', [])` (returns the parsed array or `[]` fallback). No write path in this story.
- `project-context.md:112-119` — `handy-tools.recent` is the eventual key for the recent-tools registry (AD-6 line 117). Story 1.10 will register it formally; the skeleton reads without writing so registration is not blocking.
- `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md:115` — AD-7 embed mode locks theme to system and disables palette/settings. The skeleton honors this by not mounting in embed mode.
- `_bmad-output/planning-artifacts/ux-designs/ux-useful-tools-2026-07-31/EXPERIENCE.md` — Section 6 (keyboard map) and Section 7 (state) are the source for the chord behavior and overlay-vs-modal taxonomy.
- `_bmad-output/.../review-accessibility.md` §B2 — Story 3.1 palette must use combobox/listbox (not Tab between groups). This story wires the ARIA pattern; AI-8 stays open for Story 3.1 to extend it.

## Tasks & Acceptance

**Execution:**

- [ ] `assets/shell/palette.html` — NEW canonical source. Author the palette overlay markup per the "Always" constraints: one `<div role="combobox">` wrapping the input + listbox + footer, with `aria-expanded="false"` and `hidden` attribute in the static state. The file is wrapped in `<!-- shell:palette -->` / `<!-- /shell:palette -->` markers (mirrors the existing `<!-- shell:header -->` / `<!-- shell:footer -->` convention).
- [ ] `assets/js/shell.js:boot()` — extend to (a) call `mountPalette()` if not `?embed=1`, (b) install global `keydown` capture listener for ⌘K/Ctrl+K and `/` (scoped per the I/O matrix), (c) call `wireTriggerButtons()` so every `.shell-search-trigger` click opens the palette. `mountPalette()` clones the contents of `assets/shell/palette.html` into a host `<div>` appended to `<body>`; the static include model (markers + drift check) does the work — at runtime, `mountPalette()` reads the rendered DOM (since `shell-template.py` already copied the markup into every page at generation time, the palette node is already in the DOM and just needs `aria-hidden` / `[hidden]` toggling).
- [ ] `assets/js/shell.js:onClick()` — replace the `console.info('shell.search: pending Story 1.7')` handler at line 147-149 with a real call to `openPalette()`. Same for `?` placeholder if present (it's not yet — the chord is wired at boot).
- [ ] `assets/js/shell.js:openPalette()` — ES2018 function: read `localStorage.getItem('handy-tools.recent')`, parse via `JSON.parse` with try/catch fallback to `[]`, populate `<ul id="palette-listbox">` with one `<li role="option" id="palette-opt-<index>" data-slug="<slug>">` per slug (label is title-case from slug). Set `aria-expanded="true"`, remove `hidden`, set `aria-hidden="false"`, move focus to the input, capture the previously-focused element to a closure variable `callingElement` for the close path. Idempotent: second call is a no-op.
- [ ] `assets/js/shell.js:closePalette()` — set `aria-expanded="false"`, add `hidden`, set `aria-hidden="true"`, clear `aria-activedescendant`, move focus to `callingElement` if it is still in the DOM, otherwise to `<main>`. If palette was already closed, no-op.
- [ ] `assets/js/shell.js:paletteKeyboard()` — ArrowDown / ArrowUp navigation: `activeDescendant` cycles through options, wraps at end. Enter on active option: navigate to `/tools/<slug>` via `window.location.assign`. Tab is a no-op (UX-DR-3 overlay). Escape calls `closePalette()`. `/` from the input is the user's literal slash (no-op, do not preventDefault).
- [ ] `assets/js/shell.js:paletteClickOutside()` — `document.addEventListener('click', ...)` capture-phase listener installed at open time and removed at close time. If the click target is outside the palette node, close. Skipped if the palette is already closed.
- [ ] `assets/js/api-contract.js` — append four stable entries: `HT.palette.open()` / `HT.palette.close()` / `HT.palette.toggle()` / `HT.palette.isOpen()`. All owned by `assets/js/shell.js`. Bump `generated` date.
- [ ] `assets/css/components.css` — append the `.shell-palette` block (~120 lines): fixed-position centered overlay, backdrop blur, cobalt-token styling for input border + listbox + footer, `[hidden]` and `aria-expanded` states, `forced-colors` block mapping active item to `Highlight` + `HighlightText`, no animation when `prefers-reduced-motion: reduce`. Honor 30KB CSS budget (current 433 lines + ~120 = ~553 lines, well under).
- [ ] `scripts/shell-template.py` — extend `mount_palette` to insert `<!-- shell:palette -->` region between `<!-- shell:footer -->` and the closing `<!-- /shell:chrome -->` marker. The palette include body is read verbatim from `assets/shell/palette.html`. Re-run `--all` so every page has the palette node.
- [ ] `scripts/shell-drift-check.py` — extend region extraction to include the third region (`<!-- shell:palette -->` to `<!-- /shell:palette -->`). Update the `make shell-drift` summary to report "35 pages × 3 regions in sync".
- [ ] `scripts/shell-a11y-check.py` — add `check_palette_aria` to the suite: every page has exactly one `<div role="combobox" aria-haspopup="listbox" aria-owns="palette-listbox" aria-expanded="false">`, exactly one `<input role="searchbox" aria-controls="palette-listbox">`, exactly one `<ul id="palette-listbox" role="listbox">`, and the palette node carries `hidden` attribute in the static markup.
- [ ] `Makefile` — `make shell-a11y` already runs `shell-a11y-check.py`; verify the new assertion is wired in. `make shell-drift` already runs the drift check; verify the palette region is now part of it.
- [ ] `.github/workflows/tool-contract-gate.yml` — path filter already covers `assets/shell/**` and `scripts/shell-template.py`; verify the drift check now greps the third region.

**Acceptance Criteria:**

- **Given** the user is on any page and `localStorage.handy-tools.recent` is unset
  **When** the user presses `⌘K` (mac) or `Ctrl+K` (others)
  **Then** the palette overlay opens, focus moves to the palette input, the listbox renders the empty-state placeholder "No recent tools yet", and `aria-expanded` is `"true"` on the combobox
- **Given** `localStorage.handy-tools.recent = ["qr-code-generator","tip-calculator"]`
  **When** the user opens the palette via `⌘K`
  **Then** the listbox renders two options in source order with title-case labels ("QR Code Generator", "Tip Calculator"), each carrying `data-slug="<slug>"` and a stable `id="palette-opt-<index>"`
- **Given** the palette is open
  **When** the user presses `Escape`
  **Then** the palette closes, `aria-expanded` becomes `"false"`, and focus returns to the element that had focus at open time
- **Given** the palette is open and the first option is active (ArrowDown)
  **When** the user presses `Enter`
  **Then** the browser navigates to `/tools/qr-code-generator` (or whichever slug is active) and the palette closes
- **Given** the user is on any page
  **When** the user presses `/` with focus outside any `<input>` / `<textarea>` / `<select>` / `[contenteditable]`
  **Then** the palette opens (UX-DR-6 home-search fallback)
- **Given** the user is typing in a tool input
  **When** the user types `/`
  **Then** the slash is appended to the input value (no palette open) — the chord listener early-returns on text-input focus
- **Given** the URL contains `?embed=1`
  **When** the user lands on the page
  **Then** the palette node is not mounted, `.shell-search-trigger` is hidden via CSS, and `⌘K` / `Ctrl+K` / `/` are no-ops (no error, no console warning)
- **Given** `localStorage.handy-tools.recent = "{not-json"`
  **When** the user opens the palette
  **Then** the empty-state placeholder renders, a single `console.warn` fires ("palette.recent: malformed JSON, treating as empty"), and no exception bubbles to the page
- **Given** the palette is open and the previously-focused element was removed from the DOM
  **When** the user closes the palette (Escape / click-outside / selection)
  **Then** focus moves to `<main>` (graceful fallback), no error
- **Given** `forced-colors: active` is true
  **When** the palette is open
  **Then** the active listbox option uses `Highlight` + `HighlightText` system colors (no cobalt override); the trigger button uses `ButtonText` instead of `--color-text`
- **Given** `prefers-reduced-motion: reduce` is true
  **When** the palette opens or closes
  **Then** no transition is applied (palette appears/disappears instantly) — already enforced by the existing chrome block in Story 1.5 Subtask 1.4
- **Given** the palette overlay is mounted on every page
  **When** `scripts/shell-a11y-check.py` runs
  **Then** every page passes `check_palette_aria` (exactly one combobox, one searchbox, one listbox, with the correct ARIA wiring)
- **Given** the chrome template is updated
  **When** `scripts/shell-drift-check.py` runs
  **Then** all 35 pages (index + 34 tools) report "in sync" across the 3 regions (header, footer, palette)
- **Given** the 30KB NFR-1 budget
  **When** `wc -c assets/js/shell.js assets/js/api-contract.js assets/shell/chrome.html assets/shell/palette.html assets/shell/head-snippet.html` runs
  **Then** the combined total stays under 30KB (Story 1.5 closed at ~10.3KB; this story adds ~6-8KB for the palette module + styles + chrome region, leaving ~12-14KB of margin)

## Spec Change Log

<!-- Empty until first bad_spec loopback. -->

## Design Notes

The palette skeleton is intentionally **read-only** for the recent-tools list. The reasoning:

1. **No write side means no state drift.** Story 3.12 (Recent and pinned tracking) owns when a tool gets added to recent — likely after the user navigates to it via the palette, which means the palette would have to update its own list mid-session. Splitting read (this story) from write (Story 3.12) keeps the skeleton's verification surface small and lets 3.12 wire the close-on-navigate hook without looping back here.
2. **No fuzzy match means no surprise.** The skeleton's list is *exactly* what `localStorage` returned — no scoring, no ordering, no filters. Story 3.1 will add the `HT.search()` engine (Story 1.11) and the top-5 fuzzy match UI. Splitting search-engine (1.11) from palette-skeleton (1.7) means each story has one job.
3. **No global actions means a real skeleton, not a kitchen sink.** Settings/Privacy/Quality navigation via the palette is Story 3.2. Skipping it here keeps the skeleton narrow and reviewable.
4. **Combobox 1.1 listbox is the right ARIA pattern.** The `role="combobox"` on the wrapper with `role="searchbox"` on the input is what WAI-ARIA 1.1 recommends for filterable listboxes with a free-text input. Tabbing out of the palette is intentionally disallowed (overlay pattern, UX-DR-3). This decision is documented in `EXPERIENCE.md` and the review-accessibility report's AI-8.

Keyboard chord rationale:
- `⌘K` / `Ctrl+K` is the de facto "search" chord (Slack, Linear, GitHub, VSCode all use it). It overrides the browser's "search in page" on some Linux configs — accepted per the "Never" constraint.
- `/` is the historical "site search" chord (GitHub's older UX, Jekyll sites). It only fires outside text inputs per the I/O matrix.

## Verification

**Commands:**

- `python scripts/shell-template.py --all` — expected: every page regenerated with the palette include; exit 0.
- `python scripts/shell-drift-check.py` — expected: "35 pages × 3 regions in sync"; exit 0.
- `python scripts/shell-a11y-check.py` — expected: every page passes the new `check_palette_aria`; exit 0.
- `python scripts/validate-tools-json.py` — expected: `tools.json: OK`; exit 0 (palette is chrome, not in `tools.json`).
- `python scripts/rubric-lint.py` — expected: 0 entries; exit 0 (no tools in `tools.json` yet — Story 1.4 seeds).
- `python scripts/tool-contract-gate.py` — expected: 0 pass · 0 waivered · 0 failed; exit 0.
- `wc -c assets/js/shell.js assets/js/api-contract.js assets/shell/chrome.html assets/shell/palette.html assets/shell/head-snippet.html` — expected: combined < 30720 bytes (30 KB).
- `make shell-drift && make shell-a11y && make validate && make gate` — expected: all four exit 0.

**Verified (2026-08-06):**

- `python scripts/shell-template.py` — 34 tool pages + home page each reported `wrote … (palette only)` after the path-order fix; idempotent re-run reports `no-change` for all 35 pages.
- `python scripts/shell-drift-check.py` — `35 page(s) × 3 regions (header, footer, palette)` — all 35 pages `ok`; final line `shell-drift-check: all pages in sync (3 regions)`. Exit 0.
- `python scripts/shell-a11y-check.py` — every page passes the new `palette ARIA wiring` check (combobox/searchbox/listbox with correct `aria-owns`, `aria-controls`, `aria-haspopup`); final line `shell-a11y-check: all structural a11y invariants pass`. Exit 0.
- `python scripts/validate-tools-json.py` — `tools.json: OK`. Exit 0.
- `python scripts/tool-contract-gate.py` — `0 pass · 0 waivered · 0 failed`. Exit 0.
- `wc -c` budget measurement — `assets/js/shell.js` 21,390 + `assets/js/api-contract.js` 2,434 + `assets/shell/chrome.html` 3,710 + `assets/shell/palette.html` 1,654 + `assets/shell/head-snippet.html` 1,309 = **30,497 bytes (29.8 KB)**; 223 bytes of margin under the 30 KB NFR-1 budget.

**Pre-existing bugs unmasked + fixed during regeneration:**

1. `scripts/shell-template.py` palette path order — Story 1.6 introduced an `iife_ok` gate that compares `iife_match.group(1)` (the script-opener tag, not the inner IIFE bytes) against `head_inner`, so `iife_ok` was always `False`. The `IIFE-only` rewrite block ran before the new `palette-only` block and short-circuited on `new_source == source` whenever the IIFE was already correct, masking the missing palette. Fix: re-order the `process_file` body so the palette-only path runs BEFORE the IIFE-only path. Home page gets the same treatment via a new `chrome_only_aligned` helper that ignores palette presence so the palette-only short-circuit fires whenever the only delta is a missing palette (preventing the destructive `</header>…</footer>` region rewrite from nuking the home grid's `<main>` body).
2. The home-page destructive rewrite at line 686 would have erased every byte between `<a class="shell-skip">` and `</footer>` — which on the home page is the entire 20 KB `<main>` grid. Adding the `chrome_only_aligned` short-circuit (above) means the home page now takes the palette-only path before reaching that block.

**Manual checks (if no CLI):**

- Open `index.html` in a browser. Press `⌘K` (mac) or `Ctrl+K`. Palette opens, focus on input, listbox is empty with placeholder. Press `Escape`. Palette closes, focus returns to the trigger button.
- Open DevTools → Application → Local Storage. Set `handy-tools.recent` to `["qr-code-generator","tip-calculator"]`. Reload. Press `⌘K`. Two options appear. Press `↓` then `Enter`. Browser navigates to `/tools/qr-code-generator`.
- Open `index.html?embed=1`. The search trigger is hidden. `⌘K` does nothing.
- Open DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce". Open palette. No animation on open/close.
- Open DevTools → Rendering → "Emulate CSS media feature forced-colors: active". Open palette. Active listbox option uses system colors.
- Press `/` while focused on `<body>` — palette opens. Press `/` while focused on a tool input — the slash appears in the input.

## Suggested Review Order

**Canonical source + include model**

- The palette markup is byte-equivalent on every page — extraction site for the drift check.
  [`assets/shell/palette.html:1`](../../assets/shell/palette.html#L1)
- The script reads the palette from `assets/shell/palette.html` and threads it through home + tool pages.
  [`scripts/shell-template.py:99`](../../scripts/shell-template.py#L99)
- The drift check now treats the palette as a third region alongside header/footer.
  [`scripts/shell-drift-check.py:99`](../../scripts/shell-drift-check.py#L99)

**ARIA wiring (the contract Story 3.1 inherits)**

- Wrapper `role="combobox"` with `aria-haspopup="listbox"` + `aria-owns` pointing to the listbox id.
  [`assets/shell/palette.html:17`](../../assets/shell/palette.html#L17)
- Input is `role="searchbox"` with `aria-controls` + `aria-activedescendant` (latter mutated by JS).
  [`assets/shell/palette.html:19`](../../assets/shell/palette.html#L19)
- The listbox + per-option id scheme Story 3.1 builds on (`palette-opt-<index>`).
  [`assets/shell/palette.html:20`](../../assets/shell/palette.html#L20)
- The structural a11y check that pins the wiring on every page.
  [`scripts/shell-a11y-check.py:323`](../../scripts/shell-a11y-check.py#L323)

**Behavior module (vanilla JS, single IIFE in shell.js)**

- Module entry — install capture-phase keydown + input/listbox listeners.
  [`assets/js/shell.js:288`](../../assets/js/shell.js#L288)
- The chord decision: ⌘K (mac) / Ctrl+K (others), `/` outside text inputs, embed-mode no-op.
  [`assets/js/shell.js:329`](../../assets/js/shell.js#L329)
- Open: capture calling element, read `localStorage.handy-tools.recent`, render listbox, focus the input, install click-outside listener.
  [`assets/js/shell.js:367`](../../assets/js/shell.js#L367)
- Close: hide, restore focus to the calling element (or `<main>` if the element was removed).
  [`assets/js/shell.js:434`](../../assets/js/shell.js#L434)
- Selection: navigate on Enter / click.
  [`assets/js/shell.js:486`](../../assets/js/shell.js#L486)
- Public API frozen object — `HT.palette.{open,close,toggle,isOpen}` for AD-14.
  [`assets/js/shell.js:546`](../../assets/js/shell.js#L546)

**Stable contract**

- The four palette entries exposed via `HT.palette.*` are pinned in the API contract.
  [`assets/js/api-contract.js:45`](../../assets/js/api-contract.js#L45)

**Styling + accessibility**

- Overlay + cobalt tokens + `[hidden]` + `aria-expanded` + `forced-colors` + `prefers-reduced-motion` rules.
  [`assets/css/components.css:441`](../../assets/css/components.css#L441)
- Embed-mode hides the search trigger via `[data-embed="1"] .shell-search-trigger`.
  [`assets/css/components.css:595`](../../assets/css/components.css#L595)

**Pre-existing bugs unmasked + fixed**

- Re-ordering + home-grid-protection in `process_file` / `regenerate_home`.
  [`scripts/shell-template.py:473`](../../scripts/shell-template.py#L473)

## Residue & Deferred

Added retroactively on 2026-08-12 (AI-E1-12 from the Epic 1 retrofit audit).
The palette skeleton story predates the bmad-style `Tasks / Subtasks` and
Dev Agent Record sections. The verification list above is the
authoritative record of what shipped; no retroactive fill-in is attempted
(the git history is the source of truth). One item was explicitly
deferred and is now visible:

- **Command palette global actions (Story 3.2).** The palette
  scaffolding supports static commands (jump to tool, copy slug) but
  the global actions (theme toggle, settings, privacy, view-source) live
  in Story 3.2. The code shipped here exposes the `HT.palette.actions`
  registry so Story 3.2 can register handlers without touching the
  skeleton. *Reason deferred:* scoped out — global actions are a UX
  surface, not a runtime skeleton concern.
- **Hierarchy / breadcrumb UI (UX-DR-16).** The palette renders a flat
  list of tools; the breadcrumb (`Tools > Productivity > Pomodoro`) is a
  Story 1.9-era pack-composition concern. *Reason deferred:* no packs
  existed when this story shipped.
