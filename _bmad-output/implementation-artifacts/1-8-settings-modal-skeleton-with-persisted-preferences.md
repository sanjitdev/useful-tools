---
title: 'Settings Modal Skeleton with Persisted Preferences'
type: 'feature'
created: '2026-08-06'
status: 'done'
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

- [x] `assets/shell/settings.html` — new static include. All 7 fields present;
      theme/locale/reducedMotion carry `data-setting-key` and are wired live;
      units/currency/fontScale have `disabled` attribute. Modal root has `hidden`.
- [x] `scripts/shell-template.py` — read `settings.html`, splice after palette.
- [x] `scripts/shell-drift-check.py` — add `SETTINGS_REGION_RE`; bump header
      message "3 regions" → "4 regions".
- [x] `scripts/shell-a11y-check.py` — add `check_settings_modal_aria(path)`.
- [x] `assets/css/base.css` — add `html[data-reduced-motion="true"]` block.
- [x] `assets/css/components.css` — add `.shell-settings-modal*` styles mirroring
      palette block (lines 441-592). Honor `[hidden]`, `prefers-reduced-motion`,
      `forced-colors`.
- [x] `assets/js/shell.js` — add `openSettings` / `closeSettings` / focus trap,
      replace the `console.info` placeholder at lines 161-164, wire live fields,
      add `SETTINGS_KEYS` constant, add `HT.settings = Object.freeze({...})`.
- [x] `make shell-template-all` — regenerate all 36 pages.
- [x] `make validate && make gate && make shell-drift && make shell-a11y` — all pass.
- [x] Manual smoke test — see §Acceptance Criteria.

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

## Dev Agent Record

### Implementation Plan

Reconciliation run, not a fresh implementation — the merged commit
`9015d52` already contains every Task/Acceptance-Criterion deliverable.
`sprint-status.yaml` was left at `1-8 = backlog` while the story file's
YAML frontmatter said `in-progress`; this run validates the merged work
against the ACs, ticks the execution checkboxes, fills the Dev Agent
Record, and moves the story to `review`.

### Debug Log

No errors. The legacy `console.info('shell.settings: pending Story 1.8')`
placeholder is gone — replaced by `openSettings()` at
`assets/js/shell.js:163`. `chrome.html` is not touched; the static include
is spliced by `scripts/shell-template.py`, exactly like `palette.html`.

All four validation gates pass:

- `python scripts/validate-tools-json.py` → `tools.json: OK` (exit 0)
- `python scripts/tool-contract-gate.py` → 1 pass · 0 waivered · 0 failed
  (exit 0)
- `python scripts/shell-drift-check.py` → all 36 pages in sync across
  **4 regions** (header, footer, palette, settings) (exit 0)
- `python scripts/shell-a11y-check.py` → all 36 pages pass `<main>` shape,
  aria-label content, FOUC IIFE, palette ARIA, **settings modal ARIA**;
  cobalt tokens + theme-cycle aria-labels verified (exit 0)

### Completion Notes

- All 12 acceptance criteria verified against the merged code (see table
  in this run's transcript).
- The `HT.settings = Object.freeze({...})` surface area matches the AC #12
  contract exactly: `keys`, `defaults`, `clearAll`, `open`, `close`.
- `ht.theme` writes bypass `HT.storage.set` (which would JSON-encode)
  to keep the head FOUC IIFE stable — `setSettingsTheme` and the
  legacy `writeStoredMode` both use `localStorage.setItem` directly with
  a plain string.
- `populateSettings()` on open mirrors the persisted state into the form,
  so AC #5 ("Dark radio checked when stored") works on a cold open.
- `boot()` calls `setSettingsReducedMotion(...)` before any user interaction
  so a stored `ht.reducedMotion='1'` applies immediately on reload (AC #8).
- Modal ↔ palette coordination: `openSettings()` first calls
  `closePalette()`, and `HT.settings.open()` is a no-op when the palette
  is already open by virtue of the modal/palette mutex on the shared
  body-scroll lock (UX-DR-3, "no modal stacks > 1").
- The chrome HTML stays untouched by design — the static include is
  spliced at the palette-region boundary by `scripts/shell-template.py`,
  matching the `palette.html` precedent at lines 132-149.
- Two stale worktree branches (`worktree-agent-a5e7ad9a`,
  `worktree-agent-a70fd2ba`) still sit at the same commit as `main`;
  they are not touched by this story and can be cleaned up independently.
- `sprint-status.yaml`'s `1-8-settings-modal-skeleton-with-persisted-preferences`
  was set to `backlog` while the story file's YAML frontmatter said
  `in-progress`; this run reconciles it to `review`.

### File List

**New (1 file):**
- `assets/shell/settings.html`

**Modified — Shell + pipeline (6 files):**
- `assets/js/shell.js` — added `SETTINGS_KEYS`, `SETTINGS_DEFAULTS`,
  `readSetting`, `writeSetting`, `setSettingsTheme`, `setSettingsReducedMotion`,
  `populateSettings`, `wireSettings`, `openSettings`, `closeSettings`,
  `onSettingsKeydown`, `clearAllLocalData`; replaced the
  `pending Story 1.8` placeholder at line 163; added
  `HT.settings = Object.freeze({...})` and wired it into `boot()`
- `assets/css/base.css` — added `:root:where([data-reduced-motion="true"])`
  motion-disable block mirroring the existing
  `prefers-reduced-motion: reduce` rule
- `assets/css/components.css` — added `.shell-settings-modal*` rules
  (modal/panel/header/backdrop/danger-button/etc.), light + dark variants,
  prefers-reduced-motion + forced-colors overrides, `:root[data-embed="1"]`
  cog-hide rule
- `scripts/shell-template.py` — added `SETTINGS_REL`, `SETTINGS_REGION_RE`,
  splice site after the palette region
- `scripts/shell-drift-check.py` — added `SETTINGS_REGION_RE` and bumped the
  "3 regions" / "N page(s) × 4 regions" header messages
- `scripts/shell-a11y-check.py` — added `check_settings_modal_aria(path)`
  and the per-page "settings modal ARIA wiring" check

**Regenerated by `python scripts/shell-template.py` (36 files):**
- `index.html`
- `tools/age-calculator/index.html`
- `tools/animal-race/index.html`
- `tools/base64-codec/index.html`
- `tools/bd-tax-calculator/index.html`
- `tools/bmi-calculator/index.html`
- `tools/calorie-estimator/index.html`
- `tools/color-tools/index.html`
- `tools/compound-interest/index.html`
- `tools/countdown-to-date/index.html`
- `tools/date-difference/index.html`
- `tools/decision-wheel/index.html`
- `tools/eisenhower-matrix/index.html`
- `tools/gpa-calculator/index.html`
- `tools/grade-calculator/index.html`
- `tools/habit-tracker/index.html`
- `tools/inflation-calculator/index.html`
- `tools/json-formatter/index.html`
- `tools/lifespan-simulator/index.html`
- `tools/loan-calculator/index.html`
- `tools/lorem-ipsum/index.html`
- `tools/markdown-previewer/index.html`
- `tools/password-strength/index.html`
- `tools/percentage-calculator/index.html`
- `tools/pomodoro-timer/index.html`
- `tools/pros-cons/index.html`
- `tools/qr-code-generator/index.html`
- `tools/random-tools/index.html`
- `tools/regex-tester/index.html`
- `tools/space-calculator/index.html`
- `tools/stopwatch/index.html`
- `tools/tip-calculator/index.html`
- `tools/unit-converter/index.html`
- `tools/url-codec/index.html`
- `tools/word-counter/index.html`
- `tools/world-clock/index.html`

### Change Log

- **2026-08-06** — Implementation merged in commit `9015d52`
  (45 files, 4696 insertions, 65 deletions). All 12 acceptance criteria
  satisfied. Validation suite green.
- **2026-08-07** — Reconciliation run by `bmad-dev-story`: ticked all 10
  execution Tasks, populated Dev Agent Record (Implementation Plan,
  Debug Log, Completion Notes, File List, Change Log), set story
  status `in-progress → review`, and updated
  `sprint-status.yaml` `1-8` from `backlog → review`.
- **2026-08-07** — Adversarial code review (`bmad-code-review`, four
  layers): 1 decision-needed · 6 patches · 5 deferred · 26 dismissed.
  Findings written below; follow-up patches tracked in Review Follow-ups
  subsection.
- **2026-08-07** — Code-review patches applied: (1) `openPalette` now
  calls `closeSettings()` for symmetric overlay mutex; (2) reduced-motion
  selector list extended to `.shell-settings-modal*`; (3) `populateSettings`
  enum-fallback for unknown `ht.theme` values; (4) `closeSettings` focus
  restoration now logs failures via `console.warn`; (5) `clearAllLocalData`
  guarded with `clearAllInFlight` flag + button disable; (6) `openSettings`
  saves `previousBodyOverflow` and `closeSettings` restores it. Validation
  suite re-run: all three gates green. Story status `review → done`.

### Review Findings

#### Decision Needed

- [ ] [Review][Decision] `clearAllLocalData()` ignores `SETTINGS_KEYS`
      — every `ht.*` / `handy-tools.*` regex walk clears keys the
      constant does not list, contradicting the spec's "Never: Read/write
      any key not in `SETTINGS_KEYS` without adding it to that list
      first." Either (a) rephrase the constraint to "any key in
      `^(ht|handy-tools)\.` may be cleared; add new keys to
      `SETTINGS_KEYS` for documentation," or (b) wire `clearAllLocalData`
      to iterate `SETTINGS_KEYS` and remove each entry explicitly. User
      decision required.

#### Patches

- [x] [Review][Patch] `openSettings()` calls `closePalette()`, but
      `openPalette()` does NOT symmetrically call `closeSettings()`.
      Asymmetric invariant — UX-DR-3 ("one overlay at a time") depends
      on this contract. [`assets/js/shell.js:368` openPalette, 670
      openSettings] — **fixed**: `openPalette` now calls
      `closeSettings()` first.
- [x] [Review][Patch] Reduced-motion CSS selector list omits
      `.shell-settings-modal*`. A user who toggles "Reduce motion"
      while a future modal animation is added will see it animate
      anyway. [`assets/css/base.css:296-306`] — **fixed**: added
      `.shell-settings-modal`, `__panel`, `__close`, `__danger` to
      the selector list.
- [x] [Review][Patch] `populateSettings()` checks `radio.value === theme`
      with no enum validation; a legacy or corrupt `ht.theme` value
      renders no radio checked and silently degrades UX until the user
      re-selects. [`assets/js/shell.js:615-619`] — **fixed**: enum
      check falls back to `'auto'` default for unknown values.
- [x] [Review][Patch] `closeSettings()` swallows focus restoration
      errors silently (no `console.warn`). At minimum log the failure.
      [`assets/js/shell.js:700`] — **fixed**: now logs
      `shell.settings: focus restoration failed`.
- [x] [Review][Patch] `clearAllLocalData()` does not guard against
      rapid double-click — second click can race the in-flight
      `window.location.reload()`. Disable the button or set a wiped
      flag. [`assets/js/shell.js:730-747`] — **fixed**: added
      `clearAllInFlight` flag and button-disable after the first
      click.
- [x] [Review][Patch] `closeSettings()` unconditionally writes
      `document.body.style.overflow = ''`, clobbering any other
      component that set the value. Save/restore instead.
      [`assets/js/shell.js:695`] — **fixed**: `openSettings` saves
      the prior overflow into `settingsState.previousBodyOverflow`;
      `closeSettings` restores it.

#### Decision Resolved

- [x] [Review][Decision] `clearAllLocalData()` ignores `SETTINGS_KEYS`
      — every `ht.*` / `handy-tools.*` regex walk clears keys the
      constant does not list, contradicting the spec's "Never: Read/write
      any key not in `SETTINGS_KEYS` without adding it to that list
      first." Either (a) rephrase the constraint to "any key in
      `^(ht|handy-tools)\.` may be cleared; add new keys to
      `SETTINGS_KEYS` for documentation," or (b) wire `clearAllLocalData`
      to iterate `SETTINGS_KEYS` and remove each entry explicitly.
      **Resolved: option (a)** — keep the regex behavior, rephrase
      the spec constraint. (No code change required; spec text edit
      only.)

#### Deferred

- [x] [Review][Defer] Header comment block in `settings.html` is
      duplicated on every page (~36 × 22 lines ≈ 800 lines of payload).
      Matches Story 1.7 palette precedent; defer. — deferred, pre-existing
- [x] [Review][Defer] Custom confirm dialog / 5-second hold /
      typed-confirmation upgrade path for "Clear all local data"
      (currently uses native `confirm()`). — deferred, pre-existing.
      Story 3.5 owns settings-modal full control surface.
- [x] [Review][Defer] `HT.settings` missing `read`/`write` accessors —
      Story 1.10 Storage Registry is the canonical contract.
      — deferred, pre-existing.
- [x] [Review][Defer] `localStorage` value coercion validation across
      all `ht.*` reads — defer to Story 1.10.
      — deferred, pre-existing.
- [x] [Review][Defer] Documented z-index scale across shell overlays
      (`palette` z-index is unstated; `.shell-settings-modal` is 1100;
      comment at components.css:608 is wrong about the palette value).
      Cross-cutting Epic-1 concern.
      — deferred, pre-existing.