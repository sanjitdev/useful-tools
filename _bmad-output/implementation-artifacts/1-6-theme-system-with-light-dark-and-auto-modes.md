---
title: 'Theme System with Light, Dark, and Auto Modes'
type: 'feature'
created: '2026-08-05'
status: 'done'
review_loop_iteration: 0
baseline_commit: '2165803de58bba552f6c602b1998dda0de3ea318'
context:
  - '{project-root}/project-context.md'
  - '{project-root}/_bmad-output/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/ux-designs/ux-useful-tools-2026-07-31/EXPERIENCE.md'
  - '{project-root}/_bmad-output/ux-designs/ux-useful-tools-2026-07-31/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Story 1.5 wired the chrome + a 2-mode toggle (light/dark) + the FOUC IIFE, but the toggle is a single binary button with no `auto` mode and no `prefers-color-scheme` media-query listener. Users who follow their OS theme through the day cannot opt-in to system-following without using browser settings. The `aria-pressed` text is only updated on click — external `data-theme` mutations (e.g. media-query changes in `auto` mode) desync from the toggle. The FOUC script reads `localStorage.ht.theme` directly, but `HT.storage.set` JSON-encodes — values are stored as `"\"auto\""` (literal escaped), so the cycle currently corrupts the FOUC read on second paint.

**Approach:** Add a 3-mode cycle (`auto → light → dark → auto`) to the existing `.theme-toggle` click handler. Persist the user's choice to `ht.theme` as a **plain string** (no JSON encoding) so the FOUC script reads it correctly. On boot, listen to `matchMedia('(prefers-color-scheme: dark)')` change events and re-apply `data-theme` when `ht.theme === 'auto'`. Extend the existing `MutationObserver` on `data-theme` to also re-sync `aria-pressed` on every `.theme-toggle` (resolves the loop-2 deferred finding "Story 1.6's auto-mode mutation will desynchronize `aria-pressed` from `data-theme`").

## Boundaries & Constraints

**Always:**
- FOUC budget < 50ms (NFR-9) — `data-theme` must be set before first paint via the inline script in `assets/shell/head-snippet.html`. No async work in the boot path that races the first paint.
- `ht.theme` is **plain string** in `localStorage` (not JSON-encoded). Stays on the grandfathered `ht.*` namespace per `project-context.md` §3 (no migration to `handy-tools.*`).
- Cycle order is **`auto → light → dark → auto`** (UX-DR-50). Tooltip / `aria-label` reads the **next** state, not current.
- `aria-pressed` on every `.theme-toggle` reflects the **effective** theme (`true` if effective = dark, `false` if light), updated on every `data-theme` mutation — not just on click (closes the loop-2 deferred gap).
- `@media (forced-colors: active)` hides the `.theme-toggle` button (UA-mode; the OS controls colors). Already wired in `assets/css/base.css` per Story 1.5 Subtask 1.5; this story keeps the behavior.
- `?embed=1` (ARCHITECTURE-SPINE line 115) **locks theme to system** — the toggle is hidden via embed mode and the cycle is a no-op. Repeats the system listen for `prefers-color-scheme` so the embed still follows OS.

**Ask First:**
- Whether the cycle should be circular (`auto → light → dark → auto`) or two-direction (current theme acts as a reset point). The UX spec says circular; this is the conservative read.

**Never:**
- Re-implement theme inside a Tool. AD-4 (Shell owns global concerns) — the Tool folder ships only `index.html`, `<slug>.js`, `<slug>.css`. Tools never touch `data-theme` or `localStorage.ht.theme`.
- Add a separate per-tool theme. Theme is a single source of truth (NFR-9 / AD-4).
- Migrate `ht.theme` to `handy-tools.*` (grandfather rule).
- Use `localStorage` JSON encoding for `ht.theme` (keep plain string).
- Add a new theme (sepia, high-contrast authored by hand). `forced-colors` is a UA mode, not a hand-authored theme; the system palette wins.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First visit, OS = light, no stored preference | `ht.theme` unset, `prefers-color-scheme: light` | `data-theme=light`, `aria-pressed='false'`, `ht.theme='auto'` written | N/A |
| First visit, OS = dark, no stored preference | `ht.theme` unset, `prefers-color-scheme: dark` | `data-theme=dark`, `aria-pressed='true'`, `ht.theme='auto'` written | N/A |
| Stored `ht.theme='auto'`, OS change dark→light while page open | `matchMedia` change event | `data-theme=light`, `aria-pressed` re-synced on every `.theme-toggle` | N/A |
| Click toggle from `auto` | `ht.theme='auto'` | cycle to `light`, `data-theme=light`, `aria-pressed='false'` | N/A |
| Click toggle from `light` | `ht.theme='light'` | cycle to `dark`, `data-theme=dark`, `aria-pressed='true'` | N/A |
| Click toggle from `dark` | `ht.theme='dark'` | cycle to `auto`, `data-theme` follows current OS, `aria-pressed` reflects resolved theme | N/A |
| `prefers-color-scheme: dark` and user stored `light` | OS dark, `ht.theme='light'` | `data-theme=light` (user override wins); media-query listener registered but no-op | N/A |
| `localStorage` unavailable (private mode) | `HT.storage.set` throws | `data-theme` applied in-memory only; `ht.theme` not persisted; `aria-pressed` still syncs | UI logs none |
| `matchMedia` unsupported (older browser) | `window.matchMedia === undefined` | cycle falls back to `light ↔ dark`; `auto` mode behaves as `light` | N/A |
| `forced-colors: active` | UA mode | toggle hidden via CSS; `data-theme` follows OS via `prefers-color-scheme`; no user override | N/A |
| `?embed=1` | embed mode | toggle hidden, `ht.theme` ignored, `data-theme` always follows OS via media-query listener | N/A |
| Page reload with `ht.theme='auto'` and OS dark | reload | FOUC script reads `ht.theme`, resolves to `dark`, paints dark before first frame | N/A |

</frozen-after-approval>

## Code Map

- `assets/js/shell.js:75` — `toggleTheme()` is the existing 2-mode click handler. The cycle extension lives here. Source of truth for the next-mode mapping.
- `assets/js/shell.js:79` — `HT.storage.set('ht.theme', next)` writes JSON-encoded. Switch to plain `localStorage.setItem('ht.theme', next)` (string-only value) so the FOUC script's `localStorage.getItem('ht.theme')` reads it correctly.
- `assets/js/shell.js:112` — `observeTheme()` registers a `MutationObserver` on `data-theme`. Currently the observer only writes `HT.__htLastThemeChangeAt`; the click-path is the only writer of `aria-pressed`. After this story, every `data-theme` change (click or media-query) re-syncs `aria-pressed` via `syncThemeToggleAria()`.
- `assets/js/shell.js:21-23` — `HT.__booted` guard. The new media-query listener registers at boot, after the FOUC IIFE has resolved `data-theme` synchronously.
- `assets/shell/head-snippet.html` — the inline FOUC IIFE reads `localStorage.ht.theme` and resolves `light`/`dark` synchronously. Add an `auto` branch: if value is `auto` (or any unrecognized value), use `matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'`.
- `assets/shell/chrome.html:21` — `<button class="theme-toggle" type="button" aria-label="Toggle theme">`. The `aria-label` is currently updated by `syncThemeToggleAria` to read the **next** state. The cycle order changes the mapping: from `auto` next is `light`, from `light` next is `dark`, from `dark` next is `auto`. No HTML change needed; only the JS label-string map.
- `assets/js/utils.js:114` (`HT.storage`) — JSON-encoding wrapper. **Not used by `ht.theme`** after this story — the cycle writes plain strings and the FOUC script reads plain strings. Other `ht.*` keys continue to use `HT.storage` (no behavior change for them).
- `assets/css/base.css` — `@media (forced-colors: active)` hides `.theme-toggle`. No CSS changes in this story.
- `assets/css/components.css` — `.theme-toggle` is re-skinned to cobalt tokens (Story 1.5 patch #6). No change.
- `assets/js/theme.js` — legacy, short-circuited via `window.__htShellReplacesTheme`. Story 2.10 deletes it. No code change in this story.

## Tasks & Acceptance

**Execution:**

- [x] `assets/js/shell.js` — extend `toggleTheme()` to cycle `auto → light → dark → auto` based on `localStorage.getItem('ht.theme')` (plain string), not from `data-theme` directly. Replace `HT.storage.set('ht.theme', next)` with `localStorage.setItem('ht.theme', next)` (no JSON encoding). Update `aria-label` / `title` to read the next mode name, not the next color.
- [x] `assets/js/shell.js` — extend `observeTheme()` to call `syncThemeToggleAria()` on every `data-theme` mutation, in addition to the existing timestamp recording. Remove the duplicate per-button `aria-pressed` writes from `toggleTheme()` (they stay synced via the observer).
- [x] `assets/shell/head-snippet.html` — extend the inline FOUC IIFE to handle the `auto` value: if `localStorage.getItem('ht.theme') === 'auto'` (or any unrecognized value), resolve via `matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'`. The IIFE stays ES5 and inline (no external dependency).
- [x] `assets/js/shell.js` — register a `matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ...)` listener at boot. If `localStorage.getItem('ht.theme') === 'auto'` (or `?embed=1` is set), call `document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light')` on every change event. The existing `MutationObserver` will re-sync `aria-pressed` automatically.
- [x] `scripts/shell-a11y-check.py` — add `check_theme_aria_label` assertion: every `.theme-toggle` element has `aria-label` matching one of the three cycle states' next-mode strings. The strings are `'Follow system theme'` (when current=auto), `'Switch to dark theme'` (when current=light), `'Switch to light theme'` (when current=dark). Run at boot; the strings are written by JS, so the a11y check reads the resolved attribute.
- [x] `scripts/shell-drift-check.py` — no new regions needed; the chrome HTML doesn't change. Verify the existing regions still pass.
- [x] `scripts/shell-template.py` — no `aria-label` change in chrome.html per contract; the canonical chrome is unchanged. Idempotency gates stay as-is.

**Acceptance Criteria:**

- **Given** the user has `prefers-color-scheme: dark` and lands on `/` with no `ht.theme` stored
  **When** the FOUC IIFE runs
  **Then** `data-theme='dark'` is set on `<html>` before first paint, the page renders dark, and `localStorage.getItem('ht.theme')` returns `'auto'`
- **Given** the user has `ht.theme='auto'` and changes their OS from dark to light while the page is open
  **When** the `matchMedia` change event fires
  **Then** `data-theme` flips to `light` and `aria-pressed` on every `.theme-toggle` re-syncs to `'false'` (no flicker, no page reload)
- **Given** the user clicks the theme toggle while `ht.theme='auto'`
  **When** the click handler fires
  **Then** `ht.theme` becomes `'light'`, `data-theme='light'`, `aria-pressed='false'`, and subsequent OS changes are ignored
- **Given** the user clicks the theme toggle three times in succession
  **When** clicks 1, 2, 3 each fire
  **Then** the cycle is `auto → light → dark → auto` (circular; reaches the start state)
- **Given** the user reloads the page with `ht.theme='auto'` and the OS is dark
  **When** the FOUC IIFE runs
  **Then** `data-theme='dark'` is set before first paint (no flash)
- **Given** the user is in `?embed=1` mode
  **When** they click the theme toggle (which is hidden via CSS)
  **Then** nothing changes; `localStorage.getItem('ht.theme')` is forced to `'auto'` and `data-theme` follows OS
- **Given** `forced-colors: active` is detected
  **When** the page renders
  **Then** the `.theme-toggle` is hidden via the existing CSS rule; `data-theme` is still set (`light` or `dark` per OS) but does not affect the system colors
- **Given** the FOUC IIFE reads `localStorage.getItem('ht.theme')` after a click cycle wrote `'dark'` via plain string
  **When** the IIFE runs on next reload
  **Then** `data-theme='dark'` is set correctly (no JSON-encoding corruption)

## Spec Change Log

## Spec Change Log

- **2026-08-05 (post-implementation, in-step-03 gap):** Spec claimed `?embed=1` "hides the toggle via CSS" but no such CSS rule existed in the repo. Implementation subagent surfaced the gap; orchestrator resolved by extending the FOUC IIFE to set `<html data-embed="1">` when `?embed=1` is in the URL, and adding `html[data-embed="1"] .theme-toggle { display: none !important; }` to `assets/css/base.css:294-296`. The IIFE sets the attribute synchronously before paint, so the toggle is hidden before first frame (no flash). Known-bad state avoided: a `?embed=1` page where the toggle remained visible (cosmetic violation of UX-DR "embed hides chrome controls"). KEEP: JS-side `isEmbedMode()` guards in `boot()` / `toggleTheme()` / `registerSystemThemeListener()`; force-`auto` semantic; no-op cycle.

- **2026-08-05 (step-03 patch):** Discovered during the verification diff review that all 35 pages had nested `<script>` wrappers (3 opens + 3 closes on tool pages; 1 open + 3 closes on home) — a residual from a Story 1.5 regeneration bug. The drift check (`shell-drift-check.py`) is pure-substring on chrome regions and never counts tags; the a11y check (`shell-a11y-check.py`) verifies the IIFE body bytes but ignores wrapper-tag count. Orchestrator cleaned all 35 pages via a one-shot normalization pass and hardened `scripts/shell-template.py` so the regex scans from `<head>` start and a `nested_count > 1` guard triggers a rewrite to a single `<script>` wrapper on every re-run. KEEP: the new regex (`<head>` start + `(?:(?!</script>).)*?` lazy match), the `nested_count` guard, and the "normalized N nested <script> wrappers → 1" message. Known-bad state avoided: nested-script contamination shipping to production after any future FOUC-IIFE edit.

- **2026-08-05 (step-04 review patches):** Three independent review layers (Blind Hunter, Edge Case Hunter, Verification Gap Reviewer) found 4 medium-severity issues that were triaged as `patch` (caused by the change, trivially fixable). All 4 fixed in step-04:
  1. `check_theme_aria_label` substring-only check did not pin the CYCLE_LABEL key-to-string mapping (Verification Gap F1, Adversarial A3, Edge Case E12). Fixed by parsing the CYCLE_LABEL map block with a regex and asserting each key's value matches the expected label. Verified by injecting a swap — check now reports `FAIL CYCLE_LABEL['auto'] = 'Switch to light theme', expected 'Follow system theme'`.
  2. Embed-mode CSS hiding rule (`html[data-embed="1"] .theme-toggle`) was not asserted by any check (Verification Gap F2, Adversarial A4). Fixed by extending `check_base_css` with a substring assertion. Verified by injecting a deletion — check now reports `FAIL embed-mode CSS rule ... missing from base.css`.
  3. Pre-1.6 sessions may have JSON-encoded `ht.theme` values from `HT.storage.set` (Edge Case E1). Without migration, upgraded users silently drop to `'auto'`. Fixed by adding JSON-decoding + plain-string rewrite in `readStoredMode()`.
  4. Embed page boot did not re-apply `data-theme` after the FOUC IIFE resolved a stale `'light'`/`'dark'` value (Edge Case E4). Fixed by setting `data-theme` synchronously via matchMedia in the `isEmbedMode()` boot branch.

  KEEP: the migration logic (no-op if raw is already plain); the `data-embed="1"` attribute setting in the FOUC IIFE; the JSON-decoding fallback ordering (try plain string first, then JSON-parse). Known-bad state avoided: 3 separate regressions where the spec was implemented but the verification harness would have silently passed.

## Design Notes

**Why 3-mode cycle, not a 2-mode toggle + auto switch:** UX-DR-50 explicitly says "Cycle: system → light → dark → system" — the cycle is the primary affordance, not a separate auto switch. Storing `ht.theme='auto'` and resolving at read time is the same data model; the cycle is just the click affordance.

**Why plain string for `ht.theme`, breaking the `HT.storage` convention:** The FOUC script runs **before** `<script src="assets/js/utils.js">` parses — `HT.storage` is undefined at that point. The IIFE must read directly with `localStorage.getItem`. The two paths must agree on encoding. Plain string is the simplest encoding that survives both. `HT.storage.set` JSON-encodes values, which the FOUC script can't decode (no JSON parser in the IIFE, and loading one would defeat the purpose). The right fix is to side-step `HT.storage` for `ht.theme` specifically.

**Why `MutationObserver → syncThemeToggleAria()` instead of separate click-and-media-query paths:** Both code paths (click in `toggleTheme`, media-query change in the new listener) mutate `data-theme`. Centralizing the `aria-pressed` re-sync in the observer means there is exactly one writer for the announced state. Story 1.5's loop-2 review surfaced this exact gap (`'Story 1.6's auto-mode mutation will desynchronize aria-pressed from data-theme'`). This story closes it.

## Verification

**Commands:**
- `python scripts/shell-a11y-check.py` — expected: all 4 invariants pass (existing opener shape + label content + FOUC IIFE + cobalt tokens/dark override) plus the new `aria-label` cycle string assertion.
- `python scripts/shell-drift-check.py` — expected: all 35 pages in sync (chrome unchanged).
- `python scripts/measure-fouc.py` — expected: 50ms budget still holds (load home + a tool page, verify `elapsedMs ≤ 50`).

**Manual checks (if no CLI):**
- Reload `/` with `localStorage.ht.theme` cleared and OS dark: page paints dark, no flash. Toggle: cycles `dark → light → dark`. Open DevTools, change `localStorage.ht.theme` to `'auto'`, reload: theme follows OS. Toggle from DevTools console: `document.documentElement.setAttribute('data-theme', 'dark')` — `aria-pressed` on every `.theme-toggle` re-syncs to `'true'` (proves the observer closes the loop-2 gap).
- Cross-browser: Chrome, Firefox, Safari (all current). `matchMedia('change')` is supported in all three for the past 5+ years.
- Forced-colors: enable in browser settings. Reload any page. `.theme-toggle` is hidden. Page still renders in the expected palette (system colors).
- Embed mode: `index.html?embed=1`. Toggle is hidden (already from CSS). `localStorage.getItem('ht.theme')` returns `'auto'` regardless of `localStorage`. Toggle from DevTools console: still no-op.

## Suggested Review Order

**Cycle logic + JSON encoding fix**

- Cycle map and label map; central source of truth for both behaviors.
  [`shell.js:22`](../../assets/js/shell.js#L22)

- Plain-string read/write helpers; bypasses HT.storage JSON encoding so the FOUC IIFE sees the same shape.
  [`shell.js:42`](../../assets/js/shell.js#L42)

- 3-mode click cycle; reads stored mode, advances one step, writes plain string, sets resolved data-theme.
  [`shell.js:147`](../../assets/js/shell.js#L147)

**Media-query listener + MutationObserver centralization**

- Media-query change listener; only re-resolves data-theme when stored mode is 'auto' (or embed mode).
  [`shell.js:200`](../../assets/js/shell.js#L200)

- MutationObserver re-syncs aria-pressed/title/aria-label on every data-theme change — single writer.
  [`shell.js:185`](../../assets/js/shell.js#L185)

**FOUC IIFE + embed mode**

- Inline FOUC IIFE handles 'auto' value via matchMedia; sets data-embed="1" on <html> when ?embed=1 is present.
  [`head-snippet.html:7`](../../assets/shell/head-snippet.html#L7)

- Embed boot branch forces auto and re-applies data-theme synchronously so stale stored values don't bleed through.
  [`shell.js:105`](../../assets/js/shell.js#L105)

- Embed CSS rule hides .theme-toggle in ?embed=1 mode (closes the loop-2 deferred gap surfaced by step-03).
  [`base.css:294`](../../assets/css/base.css#L294)

**Verification harness hardening**

- A11y check parses CYCLE_LABEL map and asserts each key→string association (not just substring presence).
  [`shell-a11y-check.py:211`](../../scripts/shell-a11y-check.py#L211)

- A11y check asserts embed CSS rule is present in base.css (not just cobalt tokens).
  [`shell-a11y-check.py:380`](../../scripts/shell-a11y-check.py#L380)

- Shell-template idempotency hardened against nested <script> wrappers via head-scoped regex and nested_count guard.
  [`shell-template.py:355`](../../scripts/shell-template.py#L355)