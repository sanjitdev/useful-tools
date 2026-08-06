---
title: 'Settings Modal Skeleton with Persisted Preferences'
type: 'feature'
created: '2026-08-06'
status: 'in-progress'
review_loop_iteration: 0
baseline_commit: '7c408307c6c64fece5daec4c2f4be05e84a5b89b'
context:
  - '{project-root}/project-context.md'
  - '{project-root}/_bmad-output/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/ux-designs/ux-useful-tools-2026-07-31/EXPERIENCE.md'
  - '{project-root}/_bmad-output/ux-designs/ux-useful-tools-2026-07-31/DESIGN.md'
  - '{project-root}/_bmad-output/implementation-artifacts/1-6-theme-system-with-light-dark-and-auto-modes.md'
  - '{project-root}/_bmad-output/implementation-artifacts/1-7-command-palette-skeleton-with-cmd-k-ctrl-k-bind.md'
---

## Intent

**Problem:** Story 1.7 wired the command palette but left the settings cog as a no-op
(`shell.js:161-164` logs `console.info('shell.settings: pending Story 1.8')`). Users
have nowhere to see or change the preferences Story 1.6 stored in `localStorage`
(`ht.theme`, eventually `ht.locale`, `ht.fontScale`, etc.). The settings modal is the
single entry point for every global preference — without it, all preferences live
behind developer tools.

**Approach:** Add a static-include modal (mirroring the palette pattern at
`assets/shell/palette.html`) that the header cog opens. The modal exposes 7 fields
per AC; 3 are wired live (theme, language, reduced-motion) and 4 are visually
disabled placeholders for follow-up stories. A `SETTINGS_KEYS` constant in
`shell.js` is the v1 contract that Story 1.10's Storage Registry will replace.

The "Clear all local data" button is the only live 4th control; it iterates
`localStorage`, removes every `ht.*` and `handy-tools.*` key, and reloads after
re-writing `ht.theme='auto'` so the FOUC IIFE does not flash dark on reload.

## Boundaries & Constraints

**Always:**
- Static-only, no build, no transpiler (AD-12).
- Shell owns global concerns (AD-4). Tools never touch settings storage directly.
- `?embed=1` hides the cog and the modal (AD-7); `isEmbedMode()` guards open.
- `ht.theme` is plain string in `localStorage` (Story 1.6 grandfather rule); writes
  must use `localStorage.setItem(...)` directly, NOT `HT.storage.set` (which JSON-encodes).
- WAI-ARIA 1.2 modal pattern: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`,
  focus trap, focus restoration to invoking element on close.
- Settings modal is a **true modal** (per EXPERIENCE.md §1.5 taxonomy); backdrop blocks
  page interaction, body scroll is locked while open.
- Closing via Escape, × button, or backdrop click all return focus to the cog.
- `HT.settings = Object.freeze({...})` follows the `HT.palette` precedent at
  `shell.js:543-548`.
- Settings UI never renders inside a tool page (AD-4 boundary).
- The static-include is wired by `scripts/shell-template.py` (palette precedent at
  `scripts/shell-template.py:132-149`); the chrome HTML stays untouched.

**Ask First:**
- Which 3 of the 7 fields to wire live. User-decided: **theme, language, reduced-motion**.

**Never:**
- Re-implement the settings modal inside a Tool. AD-4 + AD-13 boundary.
- Use `HT.storage.set` for `ht.theme` (breaks FOUC IIFE).
- Read/write any key not in `SETTINGS_KEYS` without adding it to that list first.
- Render the modal in `?embed=1` mode.
- Stack the modal on top of any other overlay (palette, future keyboard help).
- Add new theme modes (sepia, hand-authored high-contrast). `forced-colors` is UA mode.
- Add keyboard shortcut to open the modal (UX-DR-3 says no `?` overlay conflict;
  the cog is the only entry point).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First visit, no settings stored | `ht.theme` unset, etc. | Modal opens with defaults (theme=auto, locale=en, reducedMotion=off); fields populate from `localStorage` defaults | N/A |
| Stored `ht.theme='dark'` | `localStorage.getItem('ht.theme') === 'dark'` | Theme radio "Dark" checked; `<html data-theme="dark">` already set by FOUC IIFE | N/A |
| Change theme to "Light" in modal | user clicks radio | `localStorage.setItem('ht.theme', 'light')`, `<html data-theme="light">` flips immediately, `aria-pressed='false'` on `.theme-toggle` re-syncs via MutationObserver | N/A |
| Change locale to `bn` | user picks Bengali | `localStorage.setItem('ht.locale', 'bn')`; no UI change (Story 7.7 wires translations) | N/A |
| Toggle reduced motion | user ticks checkbox | `localStorage.setItem('ht.reducedMotion', '1')`, `<html data-reduced-motion="true">` set, transitions visibly disabled | N/A |
| Press Escape with modal open | Escape key | Modal closes, focus returns to the cog | N/A |
| Click backdrop or × button | click event on `[data-settings-dismiss]` | Modal closes, focus returns to the cog | N/A |
| Tab cycles within modal | Tab / Shift+Tab | Focus moves only within `.shell-settings-modal__panel`; cannot reach underlying tool | N/A |
| Click "Clear all local data…" → confirm accept | confirm() = true | Iterates localStorage, removes every `^(ht|handy-tools)\.` key, re-writes `ht.theme='auto'`, `location.reload()` | N/A |
| Click "Clear all local data…" → confirm cancel | confirm() = false | No-op | N/A |
| `?embed=1` mode | embed flag | `.shell-settings` cog hidden via CSS; `HT.settings.open()` from console is a no-op (early return) | N/A |
| `localStorage` unavailable (private mode) | `localStorage.setItem` throws | Field write fails silently; modal still renders | UI logs none |
| `forced-colors: active` | UA mode | Modal honors forced-colors palette via existing `@media (forced-colors: active)` overrides | N/A |
| `prefers-reduced-motion: reduce` | OS-level | Existing `@media` rule + new `html[data-reduced-motion="true"]` rule both disable transitions | N/A |
| Modal open → settings cog refocused → press Escape again | stale state | `closeSettings()` early-returns when modal is already hidden (idempotent) | N/A |
| Two simultaneous modals (palette + settings) | impossible by AC | Palette and settings are mutually exclusive; opening one closes the other (UX-DR-3 says no modal stacks > 1) | N/A |

## Code Map

- `assets/shell/settings.html` *(new)* — static include. Markers
  `<!-- shell:settings -->…<!-- /shell:settings -->`. Markup mirrors `palette.html`.
- `assets/shell/chrome.html` — **not touched**. The static include is spliced by
  `scripts/shell-template.py`, not declared in chrome.html (same as palette).
- `scripts/shell-template.py:86` — adds `SETTINGS_REL`, `SETTINGS_REGION_RE`. The
  splice happens after the palette region (around lines 309-311 / 748-750).
- `scripts/shell-drift-check.py` — adds `SETTINGS_REGION_RE`; bump header line
  "3 regions" → "4 regions".
- `scripts/shell-a11y-check.py` — adds `check_settings_modal_aria(path)`.
- `assets/js/shell.js:161-164` — replace `console.info('pending Story 1.8')` with
  `openSettings()`.
- `assets/js/shell.js:45,72` — `readStoredMode` / `writeStoredMode` already exist;
  the modal reuses them.
- `assets/js/shell.js:131` — `isEmbedMode()` guard precedent for `wirePalette`.
- `assets/js/shell.js:367-465` — `openPalette` / `closePalette` pattern for
  focus management (mirrors for modal).
- `assets/js/shell.js:543-548` — `HT.palette = Object.freeze({...})` precedent
  for `HT.settings`.
- `assets/css/components.css:441-592` — palette styles to mirror for modal styles.
- `assets/css/base.css` — add `html[data-reduced-motion="true"]` rule (mirror of
  existing `@media (prefers-reduced-motion: reduce)`).

## Tasks & Acceptance

**Execution:**

- [ ] `assets/shell/settings.html` — new static include. All 7 fields present;
      theme/locale/reducedMotion carry `data-setting-key` and are wired live;
      units/currency/fontScale have `disabled` attribute. Modal root has `hidden`.
- [ ] `scripts/shell-template.py` — read `settings.html`, splice after palette.
- [ ] `scripts/shell-drift-check.py` — add `SETTINGS_REGION_RE`; bump header
      message "3 regions" → "4 regions".
- [ ] `scripts/shell-a11y-check.py` — add `check_settings_modal_aria(path)`.
- [ ] `assets/css/base.css` — add `html[data-reduced-motion="true"]` block.
- [ ] `assets/css/components.css` — add `.shell-settings-modal*` styles mirroring
      palette block (lines 441-592). Honor `[hidden]`, `prefers-reduced-motion`,
      `forced-colors`.
- [ ] `assets/js/shell.js` — add `openSettings` / `closeSettings` / focus trap,
      replace the `console.info` placeholder at lines 161-164, wire live fields,
      add `SETTINGS_KEYS` constant, add `HT.settings = Object.freeze({...})`.
- [ ] `make shell-template-all` — regenerate all 36 pages.
- [ ] `make validate && make gate && make shell-drift && make shell-a11y` — all pass.
- [ ] Manual smoke test — see §Acceptance Criteria.

**Acceptance Criteria:**

- **Given** the user clicks the settings cog in the header
  **When** the click handler fires
  **Then** the Settings modal opens with `role="dialog"`, `aria-modal="true"`,
  `aria-labelledby="settings-modal-title"`, focus moves to the panel, no
  `pending Story 1.8` console message

- **Given** the modal is open
  **When** the user presses Escape
  **Then** the modal closes and focus returns to the cog

- **Given** the modal is open
  **When** the user clicks the backdrop or × button
  **Then** the modal closes and focus returns to the cog

- **Given** the modal is open
  **When** the user presses Tab
  **Then** focus cycles only within `.shell-settings-modal__panel` (cannot reach
  the underlying tool page)

- **Given** the user has `ht.theme='dark'` stored
  **When** they open the modal
  **Then** the "Dark" radio is checked; closing the modal preserves the value

- **Given** the user picks "Light" in the theme fieldset
  **When** the change fires
  **Then** `localStorage.getItem('ht.theme')` returns `'light'` (plain string,
  no JSON encoding), `<html data-theme="light">` flips, the toggle's
  `aria-pressed` re-syncs to `'false'`

- **Given** the user picks Bengali (`bn`) in the locale dropdown
  **When** the change fires
  **Then** `localStorage.getItem('ht.locale')` returns `'bn'`

- **Given** the user ticks "Reduce motion"
  **When** the change fires
  **Then** `localStorage.getItem('ht.reducedMotion')` returns `'1'`,
  `<html data-reduced-motion="true">` is set, transitions are visibly disabled

- **Given** the user clicks "Clear all local data…"
  **When** they accept the confirm dialog
  **Then** every `ht.*` and `handy-tools.*` key is removed from localStorage,
  `ht.theme` is re-written as `'auto'`, the page reloads, and there is no FOUC
  flash

- **Given** the URL is `?embed=1`
  **When** the page renders
  **Then** `.shell-settings` cog is hidden; `HT.settings.open()` from console
  is a no-op

- **Given** `forced-colors: active` is detected
  **When** the modal opens
  **Then** the modal honors the UA palette via existing CSS overrides

- **Given** DevTools console is open on any page
  **When** the user types `HT.settings`
  **Then** the returned object is frozen with keys: `keys`, `defaults`, `clearAll`,
  `open`, `close`