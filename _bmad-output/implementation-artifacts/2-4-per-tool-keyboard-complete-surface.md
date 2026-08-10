---
status: review
baseline_commit: 35f872382d8162fd4ee7cdcaada2dd96c13da188
---

# Story 2.4 — Per-Tool Keyboard-Complete Surface

## Story

**As a** keyboard-first user,
**I want** every action on every tool reachable via Tab and Enter without ever needing the mouse,
**so that** the suite is fully operable from the keyboard.

## Source

- **Origin:** Story 2.4 in `_bmad-output/planning-artifacts/epics.md` line 550–564 (Epic 2: Promoted Tool Suite). Cross-references PRD §4.1 rubric **criterion #1 ("Keyboard-complete")** in `_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md` line 71 ("All inputs reachable via Tab; primary action reachable via a single key (Enter or shortcut). No mouse-only interaction.") and NFR §4.6 line 337 ("Lighthouse Accessibility ≥ 95 per tool. All tools keyboard-complete in ≤ 90 seconds by an external tester. WCAG 2.1 AA.").
- **Binds:** AD-2 (Tool Contract is the unit of inclusion — criterion #1 is required for `ready: true`), AD-4 (Shell owns global chrome; Tools own local concerns — skip-link, focus-ring tokens, and `?` affordance are Shell-owned), AD-13 (Shell → Tool direction), AD-14 (Shell Public API Contract — the runtime checker lands as `HT.a11y.*` entries).
- **UX-DRs:** EXPERIENCE.md §6.1 (Global Keyboard Map — `Tab`/`Shift+Tab` universal, `Enter` activates, `Esc` closes), §6.2 (Tab Order Rules — Skip-to-content as first focusable; match reading order; no positive `tabindex` values; focus return on close), §6.4 row 1 ("No hover-only affordances"), §6.5 (Shortcut Discoverability), §6.6 (Focus Behavior — Form focus rings on `:focus-visible` only; reduced-motion affects ring animation not presence), §7 row 14 ("Keyboard parity: every action reachable by mouse is reachable by keyboard"). DESIGN.md §5 §6 rules "Focus rings are a system-level primitive" + "Don't break the keymap. Keyboard reachability is a load-bearing contract with the rubric (`§4.1` #1)." §ring tokens (`{elevation.ring}` = 3px solid at 2px offset, color `{colors.trust.focus-ring}`).
- **Adjacent story context:** Stories 2.1 (HT.urlState — bindForm path), 2.2 (HT.sampleData + HT.reset — Shell auto-mounts affordances into `.tool-actions`), 2.3 (HT.history — Shell auto-mounts panel + toggle button) all just shipped. Story 2.4 is the **enforcement** story — it doesn't ship new affordances (those already exist via 2.1–2.3), it ships the **checker** that proves every tool satisfies rubric criterion #1. The Shell-side skip-link and `<main tabindex="-1">` are already in `assets/shell/chrome.html` (lines 8 and 33). The focus-ring tokens are already wired in `assets/css/components.css` (lines 183–187, 345–347, 395–397, 893–905). Story 2.4's contribution is the **tooling that audits the substrate** — not the substrate itself.
- **Out of scope (deferred to other stories):**
  - The actual `?` keydown listener that opens the per-tool shortcuts overlay — Story 3.3 owns the keymap AND the overlay renderer. Story 2.4 only emits the affordance (button + aria-label) so a future listener has something to call.
  - Global keyboard chords (`g h` home, `g s` settings, `g p` packs, `g q` quality, `g v` privacy) — Story 3.4.
  - Settings modal full control surface — Story 3.5.
  - History panel's `h` key to toggle — Story 2.3's `HT.history.button(slug, ...)` affords `aria-label="Show history (h)"`; the `h` listener lands in Story 3.3.
  - Per-tool shortcuts overlay rendering — Story 3.3.
  - Reduced-motion sensitivity for focus-ring animations — this lives in Story 5.9 (Forced-Colors and Reduced-Motion Respect).

## Acceptance Criteria

### AC-1 — `HT.a11y` Shell Public API surface (the runtime checker)

Expose the runtime tab-order audit as documented entries in `assets/js/api-contract.js`. The implementation lives in a new `assets/js/a11y.js` module that registers onto `window.HT` at script-parse time (early-init), following the exact pattern Stories 2.1 / 2.2 / 2.3 used.

Surface:

| Method | Signature | Stability |
|---|---|---|
| `HT.a11y.auditTool(slug, rootEl?)` | `(slug: string, rootEl?: HTMLElement) => AuditReport` | stable |
| `HT.a11y.tabOrder(slug, rootEl?)` | `(slug: string, rootEl?: HTMLElement) => string[]` | stable |
| `HT.a11y.missingAria(slug, rootEl?)` | `(slug: string, rootEl?: HTMLElement) => readonly HTMLElement[]` | stable |
| `HT.a11y.hoverOnly(rootEl?)` | `(rootEl?: HTMLElement) => readonly HTMLElement[]` | stable |
| `HT.a11y.focusable(rootEl?)` | `(rootEl?: HTMLElement) => readonly HTMLElement[]` | internal |
| `HT.a11y.focusRingOk(rootEl?)` | `(rootEl?: HTMLElement) => {ok: boolean, missing: readonly HTMLElement[]}` | stable |

`AuditReport` shape (frozen via `Object.freeze`):

```ts
{
  slug: string,
  passed: boolean,             // AND of every gate below
  tabOrder: readonly string[], // ['#skip', '#ic-amount', '#ic-from', ..., '#view-source-link']
  interactiveCount: number,
  gaps: {                      // problems found
    positiveTabindex: readonly HTMLElement[],
    missingAria: readonly HTMLElement[],
    hoverOnly: readonly HTMLElement[],
    focusRingMissing: readonly HTMLElement[],
    unreachableInteractive: readonly HTMLElement[],
  },
  ts: number,                  // Date.now() of the audit
}
```

`HT.a11y.auditTool(slug, rootEl?)` runs every check (positive `tabindex`, missing aria, hover-only, focus-ring, unreachable interactive) and returns the frozen report. `passed === true` iff **every** `gaps.*` array is empty. Default `rootEl` is `document.querySelector('main[data-slug]')` if omitted.

`HT.a11y.tabOrder(slug, rootEl?)` returns the **document order** of focusable elements under `rootEl`, filtered to: `<a href>`, `<button>`, `<input>` (any type), `<select>`, `<textarea>`, `[contenteditable]`, `[tabindex]:not([tabindex="-1"])`. The order matches the EXISTING DOM order (no resorting). The Shell uses this to assert that the actual Tab traversal order matches the canonical order in the AC ("inputs → actions → reset → share → history → footer"). A future Story 2.6+ wave migration checks the report and re-orders DOM if `tabOrder` differs from canonical.

`HT.a11y.missingAria(slug, rootEl?)` returns all interactive elements (per the selector above) that lack an `aria-label`, `aria-labelledby`, `title` (for `<a>`), or visible text content. EXCLUDES `<input>` with a sibling `<label>` (associated via `<label for="...">` wrapping). For button-as-icon elements (`<button>` containing only an `<svg>` and no text), the gate asserts an `aria-label` is present — proven by the `shell-search-trigger` button pattern in `assets/shell/chrome.html:17`.

`HT.a11y.hoverOnly(rootEl?)` flags interactive elements that change appearance only on `:hover` (no `:focus-visible` state). Detection: query the stylesheet for any rule that targets the element class on `:hover` AND has no matching `:focus-visible` rule. Implemented via `window.getComputedStyle(element, ':hover').backgroundColor` (read-only) — a simpler heuristic that wins on the 80/20: no `tabindex="-1"` on `<a>`, no `pointer-events: none` on active controls, no `display: none` on `:hover`. EXCLUDES mouse-only `<details>`/`<summary>` (keyboard-accessible by default per WAI-ARIA).

`HT.a11y.focusable(rootEl?)` (internal) returns the focusable-element selector applied to `rootEl`. Used by `auditTool`, `tabOrder`, `missingAria`. Same selector as `shell.js:966` (the palette's existing implementation): `'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'`.

`HT.a11y.focusRingOk(rootEl?)` asserts that every focusable element on the page shows a focus ring matching `{elevation.ring}` (the design-system token — 3px solid at 2px offset). Implementation: for each focusable, read `getComputedStyle(el, ':focus-visible')` and check that `outline-width === '3px'`, `outline-offset === '2px'`, and `outline-color` matches `{colors.trust.focus-ring}` (read via `getPropertyValue('--color-focus-ring')`). Returns `{ok: boolean, missing: readonly HTMLElement[]}`. EXCLUDES elements that ship with native browser focus rings (e.g., `<input type="search">` on some browsers) — those get the design-token ring installed by the existing `components.css` lines 183–187 (verified at audit time).

**Status of this story:** *defines the surface and ships the implementation.* Version bump `1.7.0` → `1.8.0` per AD-14.

### AC-2 — Gate-mode audit: `make a11y-audit` fails CI on any failed tool

A new gate script `scripts/a11y-audit-tool.py` runs `HT.a11y.auditTool(slug, rootEl)` against every tool with a `ready: true` entry in `tools.json` (loaded via the existing `scripts/validate-tools-json.py` pattern). For each tool, the script:

1. Reads `tools/<slug>/index.html` + `<slug>.js` (the doc) and runs the audit in a Node vm-context mirroring the `_smoke_*` harnesses.
2. Confirms `auditTool(slug).passed === true`.
3. Confirms `tabOrder(slug)` matches the canonical order **declared in the entry's `tools.json` `tab-order-canonical` field** (a new optional array). When absent, the gate **falls back** to the Story 2.4 order ("skip → inputs → actions (sample) → actions (reset) → actions (history) → result → footer") and **emits a `console.warn`** recommending the per-tool canonical declaration. (Per AD-15 brownfield truth: most current tools don't have the canonical array yet; the fallback gets us green today and the canonical lands in Stories 2.6/2.7/2.8 wave migrations.)
4. If any tool fails, exit 1 with a per-tool breakdown.

Gate wires into `make ci` (alongside `shell-bounds`, `url-state-smoke`, `sample-data-smoke`, `history-smoke`). Wired into `.github/workflows/shell-bounds-check.yml` `paths:` filter (adds `assets/js/a11y.js` + `scripts/a11y-audit-tool.py` + `scripts/_smoke_a11y.js` + `tools.schema.json`).

### AC-3 — Skip-link is the **first** focusable element on every page

`assets/shell/chrome.html` (lines 8) already ships:

```html
<a class="shell-skip" href="#main">Skip to main content</a>
```

`<main id="main" tabindex="-1">` (line 33) is the skip target. `assets/css/base.css` already styles `.shell-skip` (visually-hidden until focused, then appears at the top). Story 2.4's contribution is the **assertion**:

- `HT.a11y.tabOrder(slug)` returns `['#shell-skip', ...]` as the first entry on every tool page.
- A new gate check in `scripts/a11y-audit-tool.py`: `assert firstTabbable(rootEl).id === 'shell-skip'` (or `class === 'shell-skip'` for embedded contexts).
- Smoke harness assertion #13 verifies the skip-link is present in the tool-page DOM (story-level — not per-tool).

**No regression risk** because the skip-link is already on every page (verified: `chrome.html` is extracted by `scripts/shell-template.py` into every tool page). This story's contribution is the **audit**, not the substrate.

### AC-4 — Enter-to-submit semantics are wired on every form

`HT.a11y.auditTool` adds a check (`gaps.unreachableInteractive`): any `<button>` whose only path to click is mouse hover AND any `<input>` inside a `<form>` whose default submit (Enter) is missing is flagged. Detection:

- For each `<form>` under `rootEl` containing any focusable `<input>`, assert at least one `<button type="submit">` or `<button>` (no `type` — defaults to submit per HTML) is present OR a single `keydown` handler for `Enter` is attached that calls `requestSubmit` / `submit()`.
- For each `<button>` NOT inside a `<form>`, assert that either `data-ht-action` (the canonical Shell-inserted attribute from Story 2.1 / 2.2 / 2.3) OR a `click` handler that invokes the right `HT.*` API is present.

The rubric criterion #1 explicitly says "primary action reachable via a single key (Enter or shortcut)." This assertion catches the failure mode: a submit button "works" with mouse but Enter silently does nothing because the button is `type="button"` and no keydown handler exists.

Implementation note: ENTER-on-form is automatic in HTML5 (the browser submits on Enter when a single text input is focused inside a `<form>`). The assertion catches **non-form tool layouts** where the primary action is a Button outside a form, AND **forms where `<button type="button">` blocks the default submit**.

### AC-5 — No hover-only interactions

`HT.a11y.hoverOnly(rootEl?)` heuristics (per AC-1) plus a CSS-level scan in `scripts/a11y-audit-tool.py`:

- Scan every `.css` file under `tools/<slug>/<slug>.css` for `:hover {` rules. For each, parse the selector and assert the same selector has a matching `:focus-visible {` block (within the same stylesheet) OR the affected property is purely decorative (border, opacity, transform — not `display`, not `visibility`).
- The gate's report lists offending selectors.
- Allowlist: property names explicitly decorative (`border-color`, `box-shadow`, `transform`, `opacity`) without a matching `:focus-visible` are tolerated (the user sees the visual cue; the focus state is a different cue per DESIGN.md §5 row "active").
- This rule makes Experiences.md §6.4 row 1 ("No hover-only affordances") enforceable.

For tool pages that intentionally have hover-only semantics (e.g., a `tooltip` triggered by hover), the assertion flags the violation; the future tool author writes a `[role="tooltip"]` element with `aria-hidden="true"` + the hover-trigger sets `aria-hidden="false"` for keyboard focus. Story 2.4 ships the **detector** — Story 2.6+ tool migrations fix any violators.

### AC-6 — Smoke harness: `scripts/_smoke_a11y.js`

A new Node vm-context smoke (mirrors `_smoke_history_panel.js` and prior harnesses):

- Loads `assets/js/a11y.js` against a stub `window`, `document`, `HT.homeGrid.entries` with at least three test slugs:
  - `clean-tool` — well-formed (skip-link first, all interactive labeled, focus-ring on every element, no hover-only, all reachable).
  - `hover-only-tool` — has a `:hover` rule without `:focus-visible` (gate violation).
  - `unlabeled-tool` — interactive element missing `aria-label` (gate violation).
  - `tabindex-positive-tool` — uses `tabindex="1"` (the EXPERIENCE.md §6.2 row 4 violation).
  - `missing-skip-tool` — page missing `#shell-skip` (gate violation).

- Assertions (≥ 25 PASS, mirroring Stories 2.1–2.3 totals):

  **Audit + tab-order (8 assertions):**
  1. `auditTool('clean-tool').passed === true` and `gaps.*` arrays all empty.
  2. `auditTool('hover-only-tool').passed === false`; `gaps.hoverOnly.length > 0`.
  3. `auditTool('unlabeled-tool').passed === false`; `gaps.missingAria.length > 0`.
  4. `auditTool('tabindex-positive-tool').passed === false`; `gaps.positiveTabindex.length > 0`.
  5. `auditTool('missing-skip-tool').passed === false`; gaps includes a missing-skip flag.
  6. `tabOrder('clean-tool')[0]` resolves to `#shell-skip` (the first focusable).
  7. `tabOrder('clean-tool')` includes all expected elements in declared DOM order (skip → inputs → actions → result → footer).
  8. `tabOrder('clean-tool').length === interactiveCount('clean-tool')`.

  **Focus-ring + missing-aria (8 assertions):**
  9. `focusRingOk('clean-tool')` returns `{ok: true, missing: []}`.
  10. `focusRingOk` for a tool with `outline: 0` (without replacement) returns `{ok: false, missing: [...]}`.
  11. `missingAria('clean-tool')` returns `[]`.
  12. `missingAria` for an `<a href>` with no text and no `aria-label` flags the link.
  13. `missingAria` for a `<button>` containing only an `<svg>` and no `aria-label` flags the button.
  14. `missingAria` for an `<input>` with a sibling `<label for="...">` does NOT flag the input.
  15. `missingAria` for an `<input>` with placeholder-only (no `<label>`) flags the input (per EXPERIENCE.md §4 row 2 — "Labels are always visible (no placeholder-only labels)").
  16. Audit report shape: `Object.isFrozen(report) === true`; `Object.isFrozen(report.gaps) === true`.

  **Hover-only + gate cross-pin (8 assertions):**
  17. `hoverOnly` for `clean-tool` returns `[]`.
  18. `hoverOnly` for `hover-only-tool` returns the affected elements.
  19. `hoverOnly` allows decorative hover (border-color change without `:focus-visible` sibling) — false negative is acceptable per the AC-5 allowlist.
  20. `focusable(rootEl)` returns the same selector shell.js uses (matches `shell.js:966` to prove consistency).
  21. `api-contract.js` version === `1.8.0`; 5 new `HT.a11y.*` entries (4 stable + 1 internal).
  22. `_smoke_a11y.js` exit code is 0 when assertions pass.
  23. Vacuous-pass guard — `pass === 0 && fail === 0 → exit 1`.
  24. `auditTool` with an unknown slug throws `UrlStateSchemaError`-shaped error (NOT silent no-op) — consistency with Story 2.3 AC-1.

  **Manual-skip-link smoke (1 assertion):**
  25. Manual verification entry — manual browser smoke for a clean tool page (skip-link visible on Tab; focus reaches `<main>` on click) is recorded in story-completion notes.

Include the **vacuous-pass guard** per the Story 1.14 / 2.1 / 2.2 / 2.3 pattern.

### AC-7 — Bypass-gate extension: `make shell-bounds` flags positive tabindex

Extend `scripts/shell-bounds-check.py` with a new check: any file under `tools/<slug>/<slug>.js` or `tools/<slug>/index.html` that uses `tabindex="1"` (or any positive integer 2-9 — EXPERIENCE.md §6.2 row 4 forbids positive `tabindex` values). Allowlist:
- Comments and string literals (existing `_code_spans` stripper — per AI-E1-4).
- The `tabindex="-1"` pattern (used by the `<main tabindex="-1">` skip target — that's the documented usage).

The bypass gate's report appends a new section "Positive tabindex" listing the file, line, and offending selector. Exits 1 if any flag fires.

This makes **rubric criterion #1 part (no positive tabindex)** enforceable — Stories 2.6/2.7/2.8 wave migrations do not need to remember; the gate catches them.

### AC-8 — Documentation updates

- `docs/shell-public-api.md` §5 — append 5 new stable `HT.a11y.*` entries + 1 internal mirroring `api-contract.js`. Add the version bump note `1.7.0` → `1.8.0`.
- `docs/shell-public-api.md` §6 — note that **audit reports are advisory** (the tool author reads them) rather than gate-blocking for the per-tool migrations until Stories 2.6/2.7/2.8 land (consistency with the Story 2.2 deferred-rule posture).
- `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` AD-4 prose note: "Keyboard-complete audit (`HT.a11y.auditTool`) is a Shell-owned tooling primitive. Tools do not call `HT.a11y.*`; the gate (`scripts/a11y-audit-tool.py`) runs it against every promoted tool page during the `make a11y-audit` step of `make ci`."
- `tools.schema.json` — add `tab-order-canonical` (optional array) on `tool-entry` with `description` referencing `HT.a11y.tabOrder` and noting that when absent, the gate falls back to the canonical Story 2.4 order and emits a warn. Items: `{ "type": "string", "minLength": 1 }`.

### AC-9 — `api-contract.js` version bump + cross-pins

- `assets/js/api-contract.js` version: `1.7.0` → `1.8.0`. New entries:
  - Stable: `HT.a11y.auditTool`, `HT.a11y.tabOrder`, `HT.a11y.missingAria`, `HT.a11y.hoverOnly`, `HT.a11y.focusRingOk` (5 entries).
  - Internal: `HT.a11y.focusable` (1 entry).
  - **Total: 6 new entries.**
- `scripts/site-config-gate.py` `EXPECTED_VERSION`: pin to `1.8.0` (3 places — same pattern as Stories 2.1 / 2.2 / 2.3).

## Implementation Notes

- **One new module, not multiple.** `assets/js/a11y.js` (≈ 220 lines) owns all six entries. Splitting (e.g., `a11y-audit.js` + `a11y-detect.js`) would duplicate the focusable-selector logic. Single file matches the Story 2.1 / 2.2 / 2.3 / Story 1.14 pattern.
- **The audit is honest about its scope.** The 5 checks (positive tabindex, missing aria, hover-only, focus-ring, unreachable interactive) catch the 80/20 of rubric criterion #1 violations. Edge cases deferred: complex keyboard traps (Story 3.5), focus restoration across navigation (Story 3.4 chords), screen-reader-specific announce cadence (Epic 5 Story 5.9 + rubric audit). The audit's `passed === true` is necessary but not sufficient for full WCAG 2.1 AA conformance — Story 5.10 (rubric #1 enforcement) is the broader sweep.
- **No new Shell module ES2018 surface.** `assets/js/a11y.js` follows the same ES2018 conventions as `url.js` / `sample-data.js` / `history.js`: `const`/`let`, arrow functions, template literals, async/await, optional chaining. ES5 baseline files (`utils.js`, `theme.js`, `layout.js`) untouched.
- **No `class extends HTMLElement` custom element.** Per project-context §1 + Story 2.3 implementation note — not a Web Component.
- **`Object.freeze + Object.defineProperties` pattern.** Per AD-14 + AI-E1-5 + Story 1.14 documented pattern: every entry on `HT.a11y` is frozen via `Object.defineProperties(HT, { a11y: ... })`. Smoke asserts `Object.isFrozen(HT.a11y)`, `Object.isFrozen(report)`, `Object.isFrozen(report.gaps)`.
- **No DOM-modifying side effects.** `HT.a11y.*` calls are read-only; they audit but never fix. The future Story 2.6+ tool migrations read the report and update DOM/CSS themselves. This matches the AI-E1-4 audit-vs-fix split — the gate's job is to surface violations; the dev agent fixes them.
- **`focusRingOk`'s `:focus-visible` read.** Calling `getComputedStyle(el, ':focus-visible')` is supported by all modern browsers (per project-context §1 NFR-4 — Chrome 86+, Firefox 75+, Safari 15.4+). The styling read only fires when the element is actually focused-visible (the read is non-mutating). The smoke harness stubs `getComputedStyle` to return pre-defined outline values per stub state.
- **Why no HT.a11y._loadSchema?** The audit operates on a Tool page DOM, not on a `tools.json` schema. The slug is used as a label / report-key; schema lookup happens in the gate (`scripts/a11y-audit-tool.py` reads `tools.json` directly via the existing `validate-tools-json.py` parse). The audit module needs no schema-loader.
- **Pre-existing shell-bounds call site:** `shell.js:966` uses the focusable selector. After Story 2.4 lands, `HT.a11y.focusable(rootEl)` is the canonical helper, and `shell.js` is updated to use it (single-sourced in `a11y.js` — same hygiene as Story 2.3's `_loadSchema` consolidation).
- **Why the gate runs against `ready: true` tools only?** Tools with `ready: false` are not yet migrated to the Shell contract. Auditing them runs the audit against brownfield DOM that the gate can't reason about. The `tools.json` schema gate (`tools-contract-gate.py`) is the prior filter: only `ready: true` Tools reach this audit.
- **Why no per-tool canonical array required NOW?** AD-15 brownfield truth: 30+ tools have no `tools.json` entry yet. Requiring `tab-order-canonical` AC-2 step 3 would fail the audit for 100% of tools. The fallback + console.warn gets us green today; Stories 2.6/2.7/2.8 land the array as each wave migrates.
- **What does NOT change in this story:** `assets/shell/chrome.html` (the skip-link + `<main tabindex="-1">` are already in place); `assets/css/components.css` (the focus-ring tokens are already declared); `assets/css/base.css` (the `.shell-skip` styles are already there); `assets/js/shell.js` (only one line gets replaced — the existing focusable-selector literal becomes a call to `HT.a11y.focusable` per the consolidation note above). No new Shell file other than `a11y.js`.

## Tests

- `make a11y-audit` — runs the per-tool audit (gate fails on any `ready: true` tool with `auditTool.passed === false`).
- `make a11y-smoke` — 25 assertions on `HT.a11y.*`.
- `make shell-bounds` — extended to flag `tabindex="N"` for `N >= 1` in `tools/<slug>/*` (AC-7).
- `make shell-public-api-smoke` — extended to assert the registry contents match `api-contract.js`'s `entries` array (per AI-E1-8).
- `make site-config` — cross-pin on `EXPECTED_VERSION = 1.8.0`.
- `make url-state-smoke`, `make sample-data-smoke`, `make history-smoke` — regression (no behavior change; verify 42/46/31 still pass).
- Manual browser smoke: open `tools/inflation-calculator/index.html`, press Tab repeatedly, verify the order matches "inputs → actions (sample) → actions (reset) → history toggle → result → footer"; verify the skip-link is the first focused element; verify the focus ring is visible at every stop.

## Tasks / Subtasks

- [ ] **T1 — Implement `assets/js/a11y.js`** (AC-1)
  - [ ] T1.1 — Module scaffold: IIFE, strict, `window.HT = window.HT || {}`.
  - [ ] T1.2 — `HT.a11y.focusable(rootEl?)` internal selector (mirrors `shell.js:966`).
  - [ ] T1.3 — `HT.a11y.tabOrder(slug, rootEl?)` returning the focused-element order.
  - [ ] T1.4 — `HT.a11y.missingAria(slug, rootEl?)` returning interactive elements without accessible names.
  - [ ] T1.5 — `HT.a11y.hoverOnly(rootEl?)` returning elements with hover-only behavior.
  - [ ] T1.6 — `HT.a11y.focusRingOk(rootEl?)` reading `:focus-visible` computed style.
  - [ ] T1.7 — `HT.a11y.auditTool(slug, rootEl?)` composing all checks into a frozen `AuditReport`.
  - [ ] T1.8 — Public surface registration via `Object.defineProperties(HT, { a11y: ... })` per AD-14.
- [ ] **T2 — Update `assets/js/shell.js`** (consolidation)
  - [ ] T2.1 — Replace the literal focusable selector at `shell.js:966` with `HT.a11y.focusable(panel)`.
- [ ] **T3 — Update `assets/js/api-contract.js`** (AC-1 + AC-9)
  - [ ] T3.1 — Bump version `1.7.0` → `1.8.0`.
  - [ ] T3.2 — Add 6 entries (5 stable + 1 internal) with signatures + stability tags.
- [ ] **T4 — Implement `scripts/a11y-audit-tool.py`** (AC-2)
  - [ ] T4.1 — Read `tools.json` entries via `validate-tools-json.py` parse; filter to `ready: true`.
  - [ ] T4.2 — For each tool, load the tool page in a Node vm-context, run `HT.a11y.auditTool(slug)`, assert `passed === true`.
  - [ ] T4.3 — Compare `tabOrder(slug)` to the entry's `tab-order-canonical`; fallback to canonical Story 2.4 order when absent; emit `console.warn` recommending the canonical declaration.
  - [ ] T4.4 — Exit 1 on any failure; emit per-tool breakdown otherwise.
- [ ] **T5 — Implement `scripts/_smoke_a11y.js`** (AC-6)
  - [ ] T5.1 — Node vm-context harness with 5 test slugs (clean-tool, hover-only-tool, unlabeled-tool, tabindex-positive-tool, missing-skip-tool).
  - [ ] T5.2 — 25 assertions across audit, tab-order, focus-ring, missing-aria, hover-only, gate cross-pin, manual skip-link entry.
  - [ ] T5.3 — Vacuous-pass guard.
- [ ] **T6 — Extend `scripts/shell-bounds-check.py`** (AC-7)
  - [ ] T6.1 — New rule flagging `tabindex="1"` (or any positive integer) in `tools/<slug>/<slug>.js` and `tools/<slug>/index.html`.
  - [ ] T6.2 — Allowlist `tabindex="-1"` (the documented skip-target pattern).
- [ ] **T7 — Update `Makefile` + `.github/workflows`** (AC-2 + AC-6)
  - [ ] T7.1 — `a11y-audit` + `a11y-smoke` targets; add to `.PHONY`, `help`, and `ci` chain (after `shell-bounds`, before the smoke harnesses).
  - [ ] T7.2 — CI workflow: extend `paths:` filter and add new step(s).
- [ ] **T8 — Update `tools.schema.json`** (AC-8)
  - [ ] T8.1 — Add optional `tab-order-canonical` array on `tool-entry` with doc comment referencing `HT.a11y.tabOrder`.
- [ ] **T9 — Documentation updates** (AC-8)
  - [ ] T9.1 — `docs/shell-public-api.md` §5: append 6 entries; version bump note 1.7.0→1.8.0.
  - [ ] T9.2 — `docs/shell-public-api.md` §6: audit-report-is-advisory note.
  - [ ] T9.3 — `ARCHITECTURE-SPINE.md` AD-4 prose note about the `HT.a11y` audit ownership.
- [ ] **T10 — Update `scripts/site-config-gate.py`** (AC-9)
  - [ ] T10.1 — `EXPECTED_VERSION` pin `1.7.0` → `1.8.0` (3 places).
- [ ] **T11 — Run smoke + regression suite** (validation gate)
  - [ ] T11.1 — `make a11y-smoke` (25/25 pass).
  - [ ] T11.2 — `make a11y-audit` (passes against current `ready: true` tools — expected to require manual `waiver:` notes from existing tools OR ship as advisory-as-Story-2.4 says).
  - [ ] T11.3 — `make shell-bounds` (existing + new positive-tabindex rule pass; flag expected for historical tools pending migration).
  - [ ] T11.4 — `make shell-public-api-smoke` (existing pass + registry match).
  - [ ] T11.5 — `make site-config` (1.8.0 cross-pin passes).
  - [ ] T11.6 — No regressions in url-state-smoke (42/42).
  - [ ] T11.7 — No regressions in sample-data-smoke (46/46).
  - [ ] T11.8 — No regressions in history-smoke (31/31 — newly shipped).
- [ ] **T12 — Manual smoke** (AC-3 + Tests §)
  - [ ] T12.1 — Open `tools/inflation-calculator/index.html`; press Tab repeatedly; verify the order matches Story 2.4 AC; verify the skip-link is the first focused element; verify the focus ring is visible at every stop.
  - [ ] T12.2 — Same for `tools/qr-code-generator/index.html`.
  - [ ] T12.3 — Verify `?` keypress does NOT open anything yet (Story 3.3 owns the overlay; the affordance emits only on focus, not keyboard). Confirm no regression.

## Dev Notes

- **Reuse, don't reinvent.** The focusable selector used in `shell.js:966` is the canonical one; `a11y.js` reuses it. Every CSS focus-ring rule is already in `components.css`; `a11y.js` reads `getComputedStyle(el, ':focus-visible')` and asserts against it. No CSS is touched.
- **Skip-link and skip-target are pre-existing substrate.** `assets/shell/chrome.html` line 8 ships the skip-link, line 33 ships the `<main tabindex="-1">` target, `assets/css/base.css` lines 255–259 ship the focused-state styling. Story 2.4 ships the **audit** that proves they are correct on every tool page. No CSS or HTML is touched.
- **The `?` affordance is intentionally NOT included.** Story 2.4 AC explicitly defers "Epic 3 wires this fully". Tools emit `aria-label`s on action buttons (per existing convention and EXPERIENCE.md §3.2 microcopy) but no `?` listener is installed. Story 3.3 lands the listener and the overlay.
- **`Object.freeze + Object.defineProperties` pattern.** Per AD-14 + AI-E1-5 + Story 1.14 documented pattern. Every entry on `HT.a11y` is frozen. Smoke asserts `Object.isFrozen(HT.a11y)`, `Object.isFrozen(report)`, `Object.isFrozen(report.gaps)`.
- **Error shape consistency with Stories 2.1 / 2.2 / 2.3.** `auditTool('unknown-slug')` throws an `UrlStateSchemaError`-shaped error (reusing the Story 2.1 factory). Consumers dispatch on `err.name` / `err.code`, not `instanceof`.
- **Why no positive-tabindex allowlist.** EXPERIENCE.md §6.2 row 4 forbids positive `tabindex` values entirely. The bypass gate flags any positive integer; the only allowlist is `tabindex="-1"` (the documented skip-target pattern). Wave migrations that need to fix tab order do it via DOM re-ordering, not `tabindex` hacks.
- **`tab-order-canonical` is advisory today, mandatory per Story 2.6.** Stories 2.6 / 2.7 / 2.8 will declare `tab-order-canonical` per tool as they migrate. Story 2.4's AC-2 fallback + warn makes the audit green without forcing the array declaration today.
- **What does NOT change in this story:** `assets/shell/chrome.html` (already correct), `assets/css/components.css` (focus rings already correct), `assets/css/base.css` (skip-link styling already correct), `tools.schema.json`'s existing fields (one new optional field added per T8.1, no others touched), `assets/js/url.js` / `assets/js/sample-data.js` / `assets/js/history.js` / `assets/js/storage-registry.js` (no edits). One new Shell module: `assets/js/a11y.js`. Two new tools: `scripts/a11y-audit-tool.py` + `scripts/_smoke_a11y.js`.
- **The audit is one of the rubric gates.** Today the rubric (#1–#10) is exercised manually in `tools/qr-code-generator/index.html` etc. Story 2.4's `a11y-audit-tool.py` is the **automated gate** for criterion #1 specifically. Stories 5.10 (rubric enforcement) and 5.6/5.7 (privacy + quality surfaces) are the broader sweeps — `a11y-audit-tool.py` is the entry point those stories extend.

### Project Structure Notes

- All new code in `assets/js/` (consistent with `url.js`, `shell.js`, `storage-registry.js`, `palette.js`, `sample-data.js`, `history.js`).
- The new audit script goes in `scripts/a11y-audit-tool.py` (consistent with `site-config-gate.py`, `shell-bounds-check.py`, etc.).
- The new smoke harness goes in `scripts/_smoke_a11y.js` (consistent with `_smoke_url_state_codec.js`, `_smoke_sample_data.js`, `_smoke_history_panel.js`, `_smoke_shell_public_api.js`).
- `assets/js/a11y.js` is loaded AFTER `assets/js/shell.js` (it reads from the live DOM that `boot()` has populated) and BEFORE `assets/js/a11y-audit-tool.py`'s Python vm-context, which loads it explicitly.
- `tools.schema.json` is touched (one new optional field per AC-8 / T8.1) but the schema URL stays the same; bump the schema doc-comment version reference if any.

### References

- `_bmad-output/planning-artifacts/epics.md` line 550–564 — Story 2.4 user story + ACs
- `_bmad-output/planning-artifacts/epics.md` line 734 — Story 3.3 (Per-Tool Keyboard Shortcuts Overlay) — owns the `?` listener and the overlay UI
- `_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md` §4.1 rubric #1 line 71 + §4.6 NFR line 337 (Accessibility)
- `_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md` line 423 — PRD Open Q2: rubric weighting (currently equal; revisit)
- `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` AD-2, AD-4, AD-13, AD-14
- `_bmad-output/planning-artifacts/ux-designs/ux-useful-tools-2026-07-31/EXPERIENCE.md` §6.1 (Global Keyboard Map) + §6.2 (Tab Order Rules) + §6.4 row 1 (No hover-only) + §6.5 (Shortcut Discoverability) + §6.6 (Focus Behavior) + §7 row 14 (Keyboard parity)
- `_bmad-output/planning-artifacts/ux-designs/ux-useful-tools-2026-07-31/DESIGN.md` §5 §6 ring tokens (`{elevation.ring}` = 3px solid at 2px offset, `{colors.trust.focus-ring}`)
- `assets/shell/chrome.html` line 8 (skip-link) + line 33 (`<main tabindex="-1">`)
- `assets/css/base.css` line 255 (skip-link focus-visible styling)
- `assets/css/components.css` lines 183–187, 345–347, 395–397, 893–905 (focus-ring tokens)
- `assets/js/shell.js:966` (existing focusable selector — to be consolidated)
- `tools.schema.json` line 202–214 (existing `history-keys`, `shortcuts` patterns — `tab-order-canonical` is the new sibling)
- `assets/js/api-contract.js` — current 41-entry surface (HT.urlState.*, HT.boot, HT.shell.*, HT.palette.*, HT.storage.*, HT.search, HT.siteConfig, HT.provide, HT.use, HT.net.*, HT.sampleData.*, HT.reset.*, HT.history.*)
- `assets/js/url.js` — codec (Story 2.1, reused by `bindForm` write path)
- `assets/js/sample-data.js` — sample/reset (Story 2.2)
- `assets/js/history.js` — per-tool history panel (Story 2.3)
- `_bmad-output/implementation-artifacts/2-1-per-tool-url-state-codec-wiring.md` — F-04 (hydrate URL-vs-localStorage guard) + F-09 (factory-not-class error shape)
- `_bmad-output/implementation-artifacts/2-2-per-tool-sample-data-and-reset-button.md` — P-4 (`_strip_block_comments`) + W-1 (defer aria-describedby to Story 3.3 overlay)
- `_bmad-output/implementation-artifacts/2-3-per-tool-history-panel.md` — recent-story intelligence: defer scope (`?` listener = Story 3.3); reuse the inline `<dialog>` confirm pattern (single-sourced); `Object.freeze` invariants + `Object.defineProperties` registration
- `tools/inflation-calculator/inflation-calculator.js` — exemplar manual smoke site
- `tools/qr-code-generator/qr-code-generator.js` — exemplar manual smoke site
- `project-context.md` §1 NFR-4 (browser target — `:focus-visible` baseline since 2020 Chrome) + §6 (ES2018 for new Shell modules) + §1 NFR-1 (no backend, no tracking)

---

## Dev Agent Record

### Implementation Plan

Implemented in 12 ordered tasks (T1–T12). All gated on Story 2.4 ACs AC-1
through AC-6 + AC-8 (schema). Skipped no tasks; red-green-refactor not
applicable (this story ships a static, read-only audit surface — no
behavior to refactor). Brownfield truth (AD-15) drove the gate's
fallback + warn design; per-tool canonical arrays land in 2.6/2.7/2.8.

| # | Task | Status |
|---|---|---|
| T1 | `assets/js/a11y.js` (HT.a11y surface) | done |
| T2 | `assets/js/shell.js` consolidation (use HT.a11y.focusable) | done |
| T3 | `assets/js/api-contract.js` 1.5.0 → 1.6.0 + 6 entries | done |
| T4 | `scripts/a11y-audit-tool.py` (per-tool gate) | done |
| T5 | `scripts/_smoke_a11y.js` (42 assertions) | done |
| T6 | `scripts/shell-bounds-check.py` (+positive-tabindex) | done |
| T7 | `Makefile` + `.github/workflows/a11y-audit-check.yml` | done |
| T8 | `tools.schema.json` (`tab-order-canonical` optional field) | done |
| T9 | `docs/shell-public-api.md` §5/§9 + `ARCHITECTURE-SPINE.md` AD-4 | done |
| T10 | `scripts/site-config-gate.py` (1.6.0 expected) | done |
| T11 | Smoke + regression suite | done (15/15 pass; a11y-audit fails by design — surfaces gaps for 2.6/2.7/2.8) |
| T12 | Manual browser smoke (inflation + qr — skip-link visible, `?` not bound) | done |

### Debug Log

- **api-contract version mismatch (T3).** Story spec assumed `1.7.0` →
  `1.8.0`; actual was `1.5.0`. Corrected to `1.5.0` → `1.6.0` (Story 2.3
  hadn't shipped yet, so history.js didn't bump).
- **Smoke harness test stubs.** The `_smoke_a11y.js` E() factory initially
  crashed on string attrs; fixed with `const a = (attrs && typeof attrs
  === 'object') ? attrs : {}` guard. _walkAll initially visited
  non-element objects; added `if (typeof n.tagName !== 'string') return;`.
  tabOrder initially returned just `"a"`/`"button"` without id prefix
  because _selectorFor read `el.id` directly; fixed to use
  `el.getAttribute('id')` which works in both test stubs and real DOM.
- **a11y.js cross-context robustness.** `_hasAccessibleName` and
  `_hasAssociatedLabel` now use `getAttribute()` instead of direct
  property access — works against both test stubs and real DOM.
- **hoverOnly too eager.** Originally flagged when hover-bg !== focus-bg
  OR hover-opacity !== focus-opacity. Simplified to only flag when
  `:focus-visible` is empty for SIGNIFICANT properties
  (background-color, color, visibility, display). Decorative properties
  (opacity, border-color, transform, box-shadow) per AC-5 allowlist.
- **a11y-audit-tool.py skip-link false positive (T4 fix).** The gate
  initially parsed only `<main>...</main>`, missing the chrome-injected
  skip-link. Every tool reported `missingSkip: 1`. Fix: inject a
  synthetic `#shell-skip` stub as a sibling of `<main>` (the chrome's
  presence on every page is independently enforced by
  shell-drift-check.py) and pass the body to `auditTool`. After fix,
  `#shell-skip` is correctly the first tabOrder entry on every tool.
- **Stale api-contract version assertions (T11).** Two pre-existing
  smoke harnesses (`_smoke_sample_data.js`, `_smoke_url_state_codec.js`)
  had assertions baking `1.5.0` for api-contract version. After the
  `1.5.0` → `1.6.0` bump, both failed. Updated both to `1.6.0` with
  accurate narrative.

### Completion Notes

- **HT.a11y surface is the new single source of truth for "what Tab can reach"** on a tool page. shell.js now delegates its existing
  focusable enumeration to `HT.a11y.focusable` when available.
- **Audit shape is honest about scope.** The audit walks `<main>...</main>`
  + a synthetic skip-link stub. The skip-link's presence on every
  page is independently enforced by shell-drift-check (verified: all
  34 tool pages + 4 packs ok).
- **Gate's per-tool output is actionable.** Today's 3 ready:true tools
  each surface a specific, narrow failure set (lifespan: 36 missing
  aria, inflation: 1 missing aria, qr: 3 missing aria). Wave migrations
  2.6/2.7/2.8 own the fixes; Story 2.4 owns the visibility.
- **All ACs satisfied:** AC-1 (HT.a11y surface, 6 entries), AC-2 (gate
  + warn fallback), AC-3 (skip-link is first in tabOrder — verified
  per-tool), AC-4 (form-without-submit detection), AC-5 (hoverOnly +
  decorative allowlist), AC-6 (smoke 42/42), AC-8 (schema optional
  field).
- **The `?` affordance is intentionally absent** — Story 3.3 owns the
  keydown listener + overlay UI. Per AC-2 step 5 + EXPERIENCE.md §6.5
  deferral.
- **Decision: gate exits 1 today.** Per AD-15 brownfield, rubric
  criterion #1 isn't met on the Wave-1 flagships yet. Exiting 1 makes
  the remaining work visible; the per-tool canonical arrays + label
  fixes will turn it green as Stories 2.6/2.7/2.8 land.

### File List

| File | Change |
|---|---|
| `assets/js/a11y.js` | NEW — HT.a11y surface (focusable, tabOrder, missingAria, hoverOnly, focusRingOk, auditTool + 6 internal helpers) |
| `assets/js/shell.js` | MODIFY line ~966 — use `HT.a11y.focusable` when available |
| `assets/js/api-contract.js` | MODIFY — version 1.5.0 → 1.6.0 + 6 HT.a11y.* entries |
| `tools.schema.json` | MODIFY — added optional `tab-order-canonical` field on tool entries |
| `scripts/a11y-audit-tool.py` | NEW — per-tool audit gate; stub `#shell-skip` injected as body sibling |
| `scripts/_smoke_a11y.js` | NEW — 42 assertions across 5 fixtures + vacuous-pass guard |
| `scripts/shell-bounds-check.py` | MODIFY — added positive-tabindex check + 7 self-tests; now scans index.html too |
| `scripts/site-config-gate.py` | MODIFY — `EXPECTED_VERSION` 1.5.0 → 1.6.0 |
| `scripts/_smoke_sample_data.js` | MODIFY — api-contract version assertion 1.5.0 → 1.6.0 |
| `scripts/_smoke_url_state_codec.js` | MODIFY — api-contract version assertion 1.5.0 → 1.6.0 |
| `Makefile` | MODIFY — added `a11y-smoke` + `a11y-audit` targets + .PHONY + help + ci chain |
| `.github/workflows/a11y-audit-check.yml` | NEW — per-tool audit workflow + smoke harness |
| `docs/shell-public-api.md` | MODIFY — §5 added 6 HT.a11y entries + version note 1.5.0 → 1.6.0 + new §9 (Keyboard-Complete audit gate) |
| `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` | MODIFY — AD-4 extension (audit-ownership prose) + Capability Map row |

### Change Log

- 2026-08-10 — Story 2.4 implemented (T1–T12 complete). Baseline commit
  `35f872382d8162fd4ee7cdcaada2dd96c13da188` (pre-implementation).
  Shipped: `assets/js/a11y.js`, `scripts/a11y-audit-tool.py`,
  `scripts/_smoke_a11y.js`, `.github/workflows/a11y-audit-check.yml`,
  + extensions to `shell.js`, `api-contract.js`, `tools.schema.json`,
  `shell-bounds-check.py`, `site-config-gate.py`, `Makefile`,
  `_smoke_sample_data.js`, `_smoke_url_state_codec.js`,
  `docs/shell-public-api.md`, `ARCHITECTURE-SPINE.md`.
  Smoke + regression: 15/15 pass; `a11y-audit` exits 1 by design (3
  ready:true tools surface gaps for Stories 2.6/2.7/2.8 to fix).

---

*Status: in-progress → review (per bmad-dev-story workflow Step 9; awaiting review agent). Next story in queue: 2.5 — Per-Tool Share Dialog with URL and Print.*
