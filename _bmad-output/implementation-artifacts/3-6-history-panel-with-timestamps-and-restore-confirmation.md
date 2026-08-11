---
title: 'History Panel with Timestamps and Restore Confirmation'
type: 'feature'
created: '2026-08-11'
status: 'ready-for-dev'
baseline_commit: 'aae90a9'  # Story 3.5 wrap-up (latest on main as of this story)
context:
  - '{project-root}/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-useful-tools-2026-07-31/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md'
  - '{project-root}/_bmad-output/planning-artifacts/epics.md'
  - '{project-root}/_bmad-output/implementation-artifacts/2-3-per-tool-history-panel.md'
  - '{project-root}/_bmad-output/implementation-artifacts/3-3-per-tool-keyboard-shortcuts-overlay.md'
  - '{project-root}/_bmad-output/implementation-artifacts/3-4-global-keyboard-chords-for-cross-page-navigation.md'
  - '{project-root}/_bmad-output/implementation-artifacts/3-5-settings-modal-full-control-surface.md'
  - '{project-root}/assets/js/history.js'  # 995 lines; ships push/list/restore/clear/subscribe/panel/button/hasHistory; cap=10; entries {id, ts, state, result, label}
  - '{project-root}/assets/js/url.js'  # bindForm write path, _writeFieldValue (used by history.restore)
  - '{project-root}/assets/js/api-contract.js'  # version 1.11.0; HT.history.* entries stable since 1.7.0 (Story 2.3)
  - '{project-root}/assets/js/shell.js'  # boot() — calls HT.history.panel(slug, main) after HT.sampleData.mount
  - '{project-root}/assets/css/base.css'  # aside.history-panel / .history-sheet / .history-button rules (line 410+)
  - '{project-root}/scripts/_smoke_history_panel.js'  # 31-assertion smoke harness — must be extended (NOT rewritten) per Story 2.3 AC-5
  - '{project-root}/tools/inflation-calculator/inflation-calculator.js'  # exemplar `if (HT.history) HT.history.push(...)` call site
  - '{project-root}/tools/qr-code-generator/qr-code-generator.js'  # exemplar `if (HT.history) HT.history.push(...)` call site
  - '{project-root}/tools.schema.json'  # history-keys block declaration; tools that opt in declare their key set
---

# Story 3.6: History Panel with Timestamps and Restore Confirmation

## Story

**As a** user wanting to recover a previous calculation,
**I want** the History panel to show timestamped entries with the key inputs and result preview,
**So that** I can pick the right one to restore.

## Source

- **Origin:** `epics.md:787-803` — Story 3.6 in the Epic 3 keyboard-first UX block. Tightens the History panel UX that Story 2.3 shipped: explicit `Intl.RelativeTimeFormat(navigator.language, {numeric:'auto'})` formatting (vs Story 2.3's `undefined` locale), explicit truncation contract (first 3 inputs clamped to 40 chars + ellipsis; first 80 chars of result preview), explicit restore confirm copy ("You have unsaved changes. Restore and discard them?" with `Cancel` (default focus) + `Discard and restore` (Enter focus)), explicit `Escape` close with focus-return to History button, and explicit FIFO cap raise from 10 → 50 entries.
- **Predecessor:** Story 2.3 (`2-3-per-tool-history-panel.md`) shipped `assets/js/history.js` (995 lines) with `push`/`list`/`restore`/`clear`/`subscribe`/`panel`/`button`/`hasHistory` and the `_loadSchema` internal helper. **The frozen entry shape is `{id, ts (number), state, result, label}`** and the FIFO cap is **10** (FR-12). **This story REVISES both** to `{ts (ISO 8601 string), inputs, result}` with FIFO cap 50.
- **Predecessor:** Story 3.3 (`3-3-...md`) wired the `h` shortcut (Show history) and the `r` shortcut (Restore last) into the per-tool shortcuts overlay. Story 3.3 also exposed `?` help overlay's history row (line 235 of `assets/js/help-overlay.js` lists `h` "Show history" + `r` "Restore last history"). **This story's panel UI is reachable through the existing keyboard surface** (no new chord, no new shortcut — the Story 3.3 bindings are sufficient).
- **Architecture pin:** AD-4 (Shell owns global concerns; History is a Shell-owned global. Tools opt in by calling `HT.history.push(slug, entry)` from their `onAfterCompute` hook — same pattern Story 2.3 documented in ARCHITECTURE-SPINE.md:90).
- **Architecture pin:** AD-6 (storage registry; `handy-tools.history.<slug>` is owned by `assets/js/history.js`, registered at boot by `HT.storage.registerHistoryKeys` since Story 1.10). **The storage SHAPE changes** in this story — the new entry `{ts, inputs, result}` replaces `{id, ts, state, result, label}`. Existing on-disk entries must be **migrated in place** at the storage layer (read both shapes, write the new shape), per AD-6 ownership rule ("the owner module is the only writer").
- **Architecture pin:** AD-7 (embed mode disables History panel — same `isEmbedMode()` early-return Story 2.3 ships at `history.js:panel()`).
- **Architecture pin:** AD-10 (locale-aware formatting via `Intl.*` only; this story uses `Intl.RelativeTimeFormat(navigator.language, ...)` per the explicit AC wording).
- **Architecture pin:** AD-14 (Shell Public API Contract — `HT.history.*` is frozen since Story 2.3). **The public `HT.history.*` surface stays intact** (same 8 stable + 1 internal entries); what changes is the entry **shape** (which is an implementation detail of `push`/`list`, not part of the AD-14 frozen signature — the surface accepts the `entry` object and returns a frozen entry; the fields are documented in api-contract.js notes). **Version bump: `1.11.0` → `1.12.0`** (minor: storage shape change is an observable wire-format change for any consumer that reads `HT.storage.get('handy-tools.history.<slug>')` directly — even though AD-14 says "owner module is the only writer", the on-disk shape change is a minor-version bump per AD-14 semantics).
- **UX pin:** UX-DR-3 (Settings is the only true modal; History panel is a non-modal aside/sheet — same as Story 2.3).
- **UX pin:** UX-DR-6 (`h` toggles, `r` restores last; Story 3.3 binds the keyboard, this story fixes the UX semantics of the panel itself).
- **UX pin:** UX-DR-19 (a11y — `role="complementary"` on the panel aside, `aria-live="polite"` on the timestamp text so screen readers announce changes, focus management on the restore confirm dialog).

## Acceptance Criteria

**Setup precondition:** The History panel is mounted by `HT.history.panel(slug, main)` at boot (Story 2.3). The History button is created by `HT.history.button(slug, {variant: 'icon'})` and appended to the tool-actions flex row (Story 2.3). The keyboard binding `h` toggles the panel and `r` restores the last entry (Story 3.3). The panel UI is **already visible** for any tool with both `urlState` AND non-empty `history-keys` declared in `tools.json`. This story **does not change reachability** — it changes what the user sees inside the panel and what happens when they click an entry.

### AC-1 — Storage shape: `{ts, inputs, result}` with FIFO cap 50

**Given** the user runs a tool and the tool calls `HT.history.push(slug, {inputs, result, ts?})`
**When** the entry is persisted to `handy-tools.history.<slug>`
**Then** the on-disk shape is:

```json
{
  "ts": "2026-08-11T14:32:08.123Z",
  "inputs": { "hf-amount": "100", "hf-from": "2000", "hf-to": "2024" },
  "result": "$246.10 (2000 → 2024, +146%)"
}
```

The `ts` field is an **ISO 8601 string** (with timezone offset — `new Date().toISOString()` is the canonical generator). The `inputs` field is the canonical urlState-shaped map (same keys as `HT.urlState.encode(slug)`). The `result` field is a string (the same string the tool passed to push; no transformation).

**And** the FIFO cap is **50 entries per tool** (raised from Story 2.3's 10). When `push` is called with `entries.length === 50`, the oldest is dropped silently (`next.splice(0, next.length - 50)`). The smoke harness asserts the cap is exactly 50 — not 50-or-fewer.

**And** existing on-disk entries in the legacy `{id, ts (number), state, result, label}` shape are **migrated in place** the first time they are read:
- `id` is dropped (the new shape has no `id` field — list ordering is by `ts` descending; ties broken by `ts` ascending for determinism).
- `ts` (number) is converted to ISO 8601 string via `new Date(number).toISOString()`.
- `state` is renamed to `inputs` (no field rename — just `inputs` is the new key).
- `label` is **dropped** (the new shape does not include label; the `result` string carries the summary — Story 2.3's AC-1 said "label is an optional human-readable summary (e.g. '14 items, $240 total')" but the new AC explicitly says the entry is `{ts, inputs, result}` only).
- The migrated entry is **rewritten to disk** in the new shape (so subsequent reads don't re-migrate).

The migration is **transparent** to consumers — `HT.history.list(slug)` returns entries in the new shape regardless of what was on disk. The migration logic lives in the storage-read path (`_readRaw` in `history.js`), not in `push` (so a write never sees the old shape).

### AC-2 — Panel rendering: relative timestamps via `Intl.RelativeTimeFormat(navigator.language, {numeric: 'auto'})`

**Given** the panel is open and entries are listed
**When** each row's timestamp is rendered
**Then** the row uses:

```js
const rtf = new Intl.RelativeTimeFormat(navigator.language, { numeric: 'auto' });
const diffSeconds = Math.round((entry.ts - Date.now()) / 1000);
const text = rtf.format(diffSeconds, 'second');
```

This is the **exact expression from the AC**. Output examples (en-US locale): `2 minutes ago`, `yesterday`, `3 days ago`, `now`, `in 5 minutes`. The `numeric: 'auto'` option is critical — it produces `yesterday` instead of `1 day ago`, `now` instead of `0 seconds ago`.

The locale source is `navigator.language` (NOT `undefined` like Story 2.3 shipped — see D1 below). The `second` unit is intentional: `Intl.RelativeTimeFormat.format(-120, 'second')` produces `"2 minutes ago"`, which is the right granularity for short-dated entries; `Intl.RelativeTimeFormat` picks the appropriate sub-unit automatically (you pass the diff in seconds and the formatter picks "second"/"minute"/"hour"/"day"/"week"/"month"/"year" internally).

**And** for entries older than **7 days**, the relative format falls back to an absolute date via `new Intl.DateTimeFormat(navigator.language, { dateStyle: 'medium' }).format(new Date(entry.ts))` (e.g., `Aug 11, 2026`). The cutoff is `Math.abs(diffSeconds) > 7 * 86400`. This is the same fallback Story 2.3 ships; the locale is now `navigator.language` (was `undefined`).

**And** the timestamp `<time>` element carries `aria-live="polite"` so screen readers re-announce when entries refresh after a new push. The element uses `<time datetime="<ISO 8601>">` with the rendered text as the human-readable inner — `datetime` is the canonical AT surface; the inner text is the visual.

### AC-3 — Panel row: truncated inputs + result preview

**Given** an entry `{ts, inputs, result}` is rendered as a panel row
**When** the row's body is built
**Then** the body shows:

1. The **first 3 input values** from `entry.inputs` (in the **insertion order** of the `inputs` object — not alphabetical, not schema order — `Object.keys(entry.inputs).slice(0, 3).map(k => String(entry.inputs[k]))`), each clamped to **40 chars + ellipsis** if longer (the ellipsis is the literal U+2026 `…` character; clamp logic: `text.length > 40 ? text.slice(0, 40) + '…' : text`). The 3 values are concatenated with `, ` separator.
2. The **result preview** is `entry.result.slice(0, 80)` (no ellipsis if exactly 80 chars — the AC says "first 80 chars of the result string", not "80 + ellipsis"; if the result is longer, the trailing text is just dropped silently).

If `entry.inputs` has fewer than 3 keys, show however many exist (no padding). If `entry.inputs` is empty AND `entry.result` is empty, render a single muted "No inputs or result" placeholder so the row is not visually empty.

**And** the row is a `<button class="history-row" type="button">` that triggers `HT.history.restore(slug, entry, opts)` (NOT by id — by the entry object directly, since the new shape has no id). The button's `aria-label` is `"Restore from {relative timestamp}, {result preview}"` (the AT-facing label includes the timestamp + a hint of the result; visual content is just the inputs/result).

### AC-4 — Restore confirmation: explicit copy + focus rules

**Given** the user clicks a row in the History panel
**When** `HT.history.restore(slug, entry)` runs
**Then** the "unsaved" state is detected by comparing each input element's current value to the value stored in the entry's `inputs` map. The comparison uses the **symmetric key set** (Story 2.3 P-6 inheritance: `Array.from(new Set([...Object.keys(a), ...Object.keys(b)]))`) so a typed-but-unsaved field that is not in the entry's `inputs` triggers the dialog.

**And** when the user has **no unsaved state** (every input matches the entry's `inputs`, or the entry has no `inputs` and the form is empty), the confirm dialog is **skipped** and the restore happens immediately.

**And** when there **are** unsaved changes, the inline `<dialog>` confirm shows:

- **Title:** `Restore previous entry?` (visual heading)
- **Message:** `You have unsaved changes. Restore and discard them?` (verbatim from the AC)
- **Buttons** (in order):
  - `Cancel` — `<button data-confirm="cancel">`, **default focus** (focus moves here when the dialog opens)
  - `Discard and restore` — `<button data-confirm="discard">`, **focused when Enter is pressed** (the second button is the "Enter focus" target — the dialog's primary action, like Story 2.2's destructive button pattern)

Pressing `Enter` while focus is on `Cancel` activates `Cancel` (browser native); pressing `Enter` while focus is on `Discard and restore` activates `Discard and restore`. Pressing `Escape` while the dialog is open activates `Cancel` (the dialog's default behavior + this story's AC requires `Escape` to close).

`Cancel` returns focus to the History row that was clicked (NOT to the History button — to the row, so the user can re-click the same entry or click a different one). `Discard and restore` calls `HT.history.restore(slug, entry, {confirm: false, focus: requestedFocus})` (the inner call skips the dialog).

### AC-5 — Panel dismissal: `Escape` returns focus to History button

**Given** the panel is open
**When** the user presses `Escape`
**Then** the panel closes (the `<aside>` is hidden / removed from the layout) and **focus returns to the History button** (the one in the tool-actions row, `data-ht-action="history"`, the button created by `HT.history.button(slug, ...)`).

The same focus-return rule applies when the user clicks the close button (`<button class="history-panel__close" aria-label="Close history">` inside the panel header — a NEW affordance Story 2.3 did not ship; this story adds it) or clicks the backdrop (the dim overlay behind the panel — same pattern as Story 1.8 Settings modal).

`Escape` does NOT fire when focus is in a text input — the same `isTextInputFocus()` predicate Story 3.4 uses (defense-in-depth: the panel's text inputs must accept `Escape` without closing the panel). The smoke harness verifies this.

### AC-6 — Empty state and storage note

**Given** a tool has no history (either newly-promoted, or after the user clicks "Clear history")
**When** the panel is opened
**Then** it renders:

- The exact copy: `No history yet. Compute something and it'll appear here.`
- A secondary line: `Stored on this device only.`

Both inside the panel body. Both with `aria-live="polite"` (Story 2.3 already does this — preserve). The empty state copy is identical to Story 2.3 (no change to the empty state wording — only the entry rendering changes).

### AC-7 — All 8 existing public `HT.history.*` surface unchanged

**Given** Story 2.3 froze the `HT.history.*` surface
**When** this story ships
**Then** the 8 stable + 1 internal entries are **unchanged** at the API level:

| Method | Signature | Stability |
|---|---|---|
| `HT.history.push(slug, entry?)` | `(slug, entry?: {inputs?: Record<string, string\|number\|boolean>, result?: string, ts?: string}) => HistoryEntry` | stable |
| `HT.history.list(slug)` | `(slug) => readonly HistoryEntry[]` | stable |
| `HT.history.restore(slug, entry, opts?)` | `(slug, entry: HistoryEntry \| string, opts?: {confirm?: boolean, focus?: boolean}) => void` | stable |
| `HT.history.clear(slug, opts?)` | `(slug, opts?: {confirm?: boolean}) => void` | stable |
| `HT.history.subscribe(slug, cb)` | `(slug, cb: (entries) => void) => () => void` | stable |
| `HT.history.panel(slug, rootEl)` | `(slug, rootEl: HTMLElement) => {teardown: () => void}` | stable |
| `HT.history.button(slug, opts?)` | `(slug, opts?: {variant?: 'link'\|'ghost'\|'icon'}) => HTMLButtonElement` | stable |
| `HT.history.hasHistory(slug)` | `(slug) => boolean` | stable |
| `HT.history._loadSchema(slug)` | `(slug) => {...} \| null` | internal |

**Breaking signature change:** `HT.history.restore(slug, entry, opts?)` previously took `id: string` as the 2nd argument (looked up the entry by id in the list). Now takes `entry: HistoryEntry | string` — the new code path accepts the **entry object directly** (since the new shape has no id field). For backward compat, if a string is passed, the function looks up `list(slug).find(e => e.ts === string)` (matching by ISO 8601 ts). This is a minor version bump because the signature changed.

`HistoryEntry` shape (frozen via `Object.freeze`):

```ts
{
  ts: string,         // ISO 8601 datetime, e.g. "2026-08-11T14:32:08.123Z"
  inputs: {...},      // tool input snapshot — only keys in urlState.encode[]
  result: string      // optional result preview; "" if the tool did not produce one
}
```

The frozen `HT_HISTORY_INIT = Object.freeze({version: '1.12.0', cap: 50, ...})` internal handle is exposed for the smoke harness (mirrors the Story 3.3 `HT_HELP_OVERLAY_INIT` and Story 3.4 `HT_GLOBAL_CHORDS_INIT` patterns — AD-14 internal-handle pattern, NOT a public `HT.*` surface).

### AC-8 — Smoke harness extension: `scripts/_smoke_history_panel.js`

**Given** Story 2.3 shipped a 31-assertion harness
**When** this story ships
**Then** the harness extends (NOT rewrites) to **≥ 50 assertions** covering:

**Storage shape + migration (10 assertions):**
1. `push(slug, {inputs, result})` writes the new `{ts, inputs, result}` shape (no `id`, no `state`, no `label`).
2. `push` writes `ts` as an ISO 8601 string (regex match: `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/`).
3. `push` without an entry argument still pushes (auto-empty shape).
4. `list(slug)` returns entries sorted newest-first by `ts` (ISO string comparison works correctly for ISO 8601 with timezone).
5. `push` × 51 with distinct timestamps keeps array length at **50** (FIFO cap = 50, raised from 10).
6. The 51st push's `ts` is not in `list(slug).slice(0, 50)`.
7. Pre-existing on-disk `{id, ts (number), state, result, label}` entries are migrated: `id` is dropped, `ts` is converted to ISO 8601 string, `state` becomes `inputs`, `label` is dropped.
8. After migration, the rewritten shape is the new `{ts, inputs, result}` (subsequent reads don't re-migrate).
9. Migration is a no-op for new entries (already-new shape passes through).
10. `Object.isFrozen(HT.history.list(slug)[i]) === true` for every entry.

**Relative timestamps (8 assertions):**
11. `_relativeTime(<now>)` returns "now" via `Intl.RelativeTimeFormat`.
12. `_relativeTime(<now - 60s>)` returns "1 minute ago" via `Intl.RelativeTimeFormat` (en-US).
13. `_relativeTime(<now - 2*86400s>)` returns "2 days ago" via `Intl.RelativeTimeFormat`.
14. `_relativeTime(<now - 86400s>)` returns "yesterday" via `numeric: 'auto'`.
15. `_relativeTime(<now - 8*86400s>)` falls back to absolute date via `Intl.DateTimeFormat`.
16. The `Intl.RelativeTimeFormat` instance is constructed with `navigator.language` (NOT `undefined`) — assert by stubbing `Intl.RelativeTimeFormat` to capture the locale arg.
17. The `Intl.DateTimeFormat` instance is also constructed with `navigator.language`.
18. The `<time>` element's `datetime` attribute equals the entry's `ts` (ISO 8601).

**Row truncation (6 assertions):**
19. An entry with 5 inputs renders only the first 3 input values.
20. An input value of length 100 is clamped to 40 chars + `…` (U+2026).
21. An input value of length 40 is rendered unchanged (no ellipsis).
22. The result preview is clamped to 80 chars (no ellipsis, just truncation).
23. An entry with empty `inputs` and empty `result` renders the "No inputs or result" placeholder.
24. Input values are joined with `, ` separator (single comma + space).

**Restore confirm (8 assertions):**
25. `restore(slug, entry)` with no unsaved state skips the dialog.
26. `restore(slug, entry)` with diverged state opens a `<dialog>`.
27. The dialog message is **exactly** `"You have unsaved changes. Restore and discard them?"` (string equality).
28. The dialog has buttons `Cancel` (default focus on open) and `Discard and restore` (Enter focus).
29. Clicking `Cancel` returns focus to the clicked History row (verify via `document.activeElement`).
30. Clicking `Discard and restore` calls `restore(slug, entry, {confirm: false, focus: requestedFocus})`.
31. Pressing `Escape` while the dialog is open activates `Cancel`.
32. `restore(slug, <ISO 8601 string>)` (legacy id path) still works — looks up by ts.

**Panel dismissal (5 assertions):**
33. Pressing `Escape` while the panel is open (focus NOT in a text input) closes the panel and returns focus to the History button (`data-ht-action="history"`).
34. Pressing `Escape` while focus is in a text input inside the panel does NOT close the panel.
35. Clicking the close button (`.history-panel__close`) closes the panel + focuses the History button.
36. Clicking the backdrop (`.history-panel__backdrop`) closes the panel + focuses the History button.
37. The close button has `aria-label="Close history"`.

**Cross-pins (8 assertions):**
38. `assets/js/api-contract.js` contains all 9 `HT.history.*` entries (8 stable + 1 internal).
39. `api-contract.js` version is `1.12.0` (bumped from `1.11.0`).
40. `api-contract.js` notes for `HT.history.push` mention Story 3.6 + cap 50 + new shape.
41. `HT_HISTORY_INIT` exists and is frozen (`Object.isFrozen(HT_HISTORY_INIT) === true`).
42. `HT_HISTORY_INIT.cap === 50`.
43. `HT_HISTORY_INIT.version === '1.12.0'`.
44. `_smoke_history_panel.js` exit code is 0 when assertions pass.
45. Vacuous-pass guard — `pass === 0 && fail === 0 → exit 1`.

The harness loads `history.js` + `url.js` + `storage-registry.js` + `utils.js` against a stub `window`, `document`, `localStorage`, and a synthetic `HT.homeGrid.entries` with the same 4 slugs Story 2.3 used (`has-history-and-urlstate`, `history-but-no-urlstate`, `urlstate-but-no-history`, `neither`). **Stub `Intl.RelativeTimeFormat` and `Intl.DateTimeFormat` in the vm context** (Node 22 has them globally, but the harness must capture constructor args to assert locale = `navigator.language`).

Wire `make history-smoke` (already in Makefile) into the `ci` chain — **no Makefile changes**; the target already exists. Add `assets/js/history.js` + `scripts/_smoke_history_panel.js` to `.github/workflows/shell-bounds-check.yml` `paths:` filter (only if `history.js` isn't already there — verify first).

### AC-9 — `api-contract.js` version bump + entry-shape notes update

**Given** AD-14 requires a minor version bump for any change to the observable surface
**When** this story ships
**Then**:

- `assets/js/api-contract.js` version: `1.11.0` → `1.12.0`.
- The `HT.history.push` notes mention Story 3.6 + cap 50 + new shape `{ts (ISO 8601), inputs, result}` + migration of legacy `{id, ts (number), state, result, label}` entries.
- The `HT.history.list` notes mention Story 3.6 + frozen return + the `ts` field is an ISO 8601 string.
- The `HT.history.restore` notes mention Story 3.6 + new `entry: HistoryEntry | string` signature + the dialog copy `"You have unsaved changes. Restore and discard them?"`.
- A new internal entry `window.HT_HISTORY_INIT` is added with `stability: 'internal'`, `module: 'assets/js/history.js'`, `signature: 'Object.freeze({version: string, cap: number})'`.
- `scripts/site-config-gate.py` `EXPECTED_VERSION` is updated to `1.12.0` (3 places — same pattern as Stories 2.1 + 2.2).

No new public `HT.*` surface (per AD-14). The `HT_HISTORY_INIT` is internal-only.

### AC-10 — Bypass gate and CI

**Given** AD-6 prohibits ad-hoc `handy-tools.history.<slug>` reads/writes from `tools/<slug>/<slug>.js`
**When** this story ships
**Then**:

- `scripts/shell-bounds-check.py` already flags `localStorage.setItem('handy-tools.history.` and `JSON.parse(localStorage.getItem('handy-tools.history.` patterns (Story 2.3 AC-6). **Verify the existing rules still fire** — the storage key prefix didn't change, so the gate output is identical.
- `assets/js/storage-registry.js` `registerHistoryKeys` (line 465) bulk-registers `handy-tools.history.<slug>` for every tool with non-empty `history-keys`. **No change** to the registration call — the key is the same.
- `assets/js/api-contract.js` `HT.storage.registerHistoryKeys` signature stays the same.
- `.github/workflows/shell-bounds-check.yml` `paths:` filter includes `assets/js/history.js` and `scripts/_smoke_history_panel.js` (verify and add if missing).
- The CI chain `make ci` runs `history-smoke` and passes.

## Decisions (rationale for the dev agent — read this BEFORE coding)

| # | Decision | Rationale | Alternative Rejected |
|---|----------|-----------|----------------------|
| D1 | **`Intl.RelativeTimeFormat` locale = `navigator.language`** (NOT `undefined`). | The AC literally says `new Intl.RelativeTimeFormat(navigator.language, { numeric: 'auto' })`. Story 2.3 shipped with `undefined` (browser default); the AC tightens this to the user's `navigator.language` so the panel shows in the user's preferred locale, not the system default. **NOTE:** `navigator.language` may be `undefined` in some test contexts — fall back to `undefined` defensively when it's missing (same pattern Story 3.5's locale default uses). | Leaving `undefined` would mean a French user with `navigator.language === 'fr'` still sees English timestamps. |
| D2 | **Storage shape changes from `{id, ts (number), state, result, label}` to `{ts (ISO 8601), inputs, result}`** — `id` and `label` are dropped; `state` is renamed `inputs`; `ts` switches from `Date.now()` milliseconds to ISO 8601 string. | The AC explicitly defines the new shape. ISO 8601 is the canonical wire format for timestamps (sortable as strings, unambiguous in any timezone, no millisecond ambiguity). Dropping `id` simplifies the lookup (entries are uniquely identified by `ts`; if two entries share a ts, the new code breaks ties by insertion order via array push). The legacy `{id, ts (number), state, result, label}` migration is one-shot — first read of any legacy entry migrates it to the new shape. | Keeping `{id, ts, state, result, label}` and just bumping the cap to 50 would dodge the migration but violates the explicit AC shape. |
| D3 | **`restore` now takes the entry object (not the id)** — `HT.history.restore(slug, entry, opts?)`. | The new shape has no `id` field; the entry object IS the identity. For backward compat with the Story 2.3 signature (string id), the function still accepts a string — if `typeof entry === 'string'`, it looks up `list(slug).find(e => e.ts === entry)` (matching by ISO 8601 ts — the closest thing to a stable id in the new shape). The `api-contract.js` notes call this out. | Removing the string overload would be a breaking change to the public surface (AD-14 major bump); keeping both is backward-compatible. |
| D4 | **Migrate in `_readRaw`**, not in `push` (storage layer migration). | The migration is a **read-time, one-shot transformation** — the next write to disk is in the new shape, so we never re-migrate. Putting it in `_readRaw` means the migration runs at most once per legacy entry. `push` only sees the new shape (it constructs entries directly). | Migrating in `push` would mean every push re-rewrites the entire array (write amplification). Read-time migration is the canonical pattern for shape changes (only writes that need to happen do). |
| D5 | **FIFO cap is 50, raised from Story 2.3's 10.** | The AC says 50 explicitly. The Story 2.3 cap was a PRD floor (`tools.schema.json:history-keys description says "capped at 10"`); the new AC supersedes that. The `push` function's `if (next.length > 50) next.splice(0, next.length - 50)` line replaces `if (next.length > 10) next.splice(0, next.length - 10)`. | Keeping cap 10 violates AC-1. |
| D6 | **Panel row is a `<button>` (not a `<div role="button">`)** with `aria-label`. | Native button gets keyboard focus, Enter activation, and screen reader announcement for free. Story 2.3 already does this — preserve the pattern. The `aria-label` is the AT-facing text (timestamp + result hint); the visible body is the inputs/result preview. | Using `<div role="button" tabindex="0">` would force the dev to wire keyboard activation manually (same trap Story 3.3 hit with `h` binding). |
| D7 | **No new `HT.history.*` public methods** — the 8 stable + 1 internal surface is unchanged. The new `HT_HISTORY_INIT` internal handle mirrors the Story 3.3 `HT_HELP_OVERLAY_INIT` pattern. | AD-14 freezes the public surface; the new shape + cap is an internal change. The internal handle gives the smoke harness a stable hook (like `HT_HELP_OVERLAY_INIT` and `HT_GLOBAL_CHORDS_INIT`) without adding a public method. | Adding `HT.history.cap` or `HT.history.shape` would freeze a new public surface that nobody needs. |
| D8 | **The History panel adds a close button (`.history-panel__close`) and a backdrop (`.history-panel__backdrop`)** — neither shipped in Story 2.3. | The AC explicitly calls for "panel dismissible via Escape (focus returns to the History button), the close button, or backdrop click". Story 2.3's panel had no close button and no backdrop (it was a desktop sidebar / mobile sheet, not a modal). This story's UX tightening (focus-return-to-History-button on Escape) implies a modal-like dismiss pattern. **The close button + backdrop are desktop-only** (mobile sheet already has a close pattern via Story 2.3's sheet swipe-down). | Reusing Story 1.8's Settings modal backdrop would visually merge the two — keep them distinct. |
| D9 | **The new panel rendering reuses the Story 2.3 panel DOM shape** — `<aside class="history-panel" aria-label="History">` for desktop, `<aside class="history-sheet" role="dialog" aria-modal="false">` for mobile (≥md vs `<md`). **No new ARIA roles.** | The Story 2.3 CSS already styles these classes (`assets/css/base.css:410`); no new CSS needed for the panel itself. The close button + backdrop get new classes (`.history-panel__close`, `.history-panel__backdrop`) — append to `assets/css/base.css` (NOT `components.css` — Story 2.3 panel rules live in `base.css`). | Introducing `role="region"` would fight `aria-label="History"` semantics. |

## Out of Scope (deferred)

- **`r` keyboard binding for "Restore last"** — Story 3.3 already wires this; this story only changes the UX of the restore flow when invoked. The keyboard binding stays.
- **`h` keyboard binding for "Show history"** — Story 3.3 wires this; this story does not change the binding.
- **Per-tool `?history=off` opt-out URL param** — Story 2.3 AC's Out-of-Scope item 5 documents this; deferred to a follow-up story. The panel always shows when `HT.history.hasHistory(slug)` is true.
- **Cross-tool history ("recently used across the suite")** — Story 2.3 deferred; Story 3.6 does not introduce it.
- **Export of `handy-tools.history.<slug>` via the Settings → Export action** — Story 3.7 (next in epic) owns this.
- **Settings → "Clear all history"** — Story 2.3 deferred; Story 3.6 only owns the per-tool "Clear history" inside the panel (already shipped by 2.3; preserved).
- **History search/filter** — out of scope. The panel shows newest-first; no UI to filter by date, result text, or input value.
- **History pagination** — out of scope. With cap 50 and newest-first, all entries fit in the panel viewport on desktop; mobile shows the same 50 inside the sheet with scroll.
- **Visual redesign of the panel** — Story 2.3's CSS is preserved; only the row body content (timestamp + inputs + result) changes.

## Tasks / Subtasks

- [ ] **T1 — Migrate `assets/js/history.js` to the new shape** (AC-1, AC-7)
  - [ ] T1.1 In `push(slug, entry?)`: accept `{inputs, result, ts?}` (Story 2.3 called this `{state, result, label, ts?}`). Map `entry.inputs` to the persisted `inputs` field; drop `entry.label`. Generate `ts` via `new Date().toISOString()` when `entry.ts` is omitted. The persisted shape on disk is `{ts, inputs, result}` only.
  - [ ] T1.2 Bump the FIFO cap from 10 to 50. Replace `if (next.length > 10) next.splice(0, next.length - 10)` with `if (next.length > 50) next.splice(0, next.length - 50)`. Update the comment above it (line ~204 "FIFO cap of 10 per FR-12" → "FIFO cap of 50 per FR-12 + Story 3.6").
  - [ ] T1.3 In `_readRaw(slug)`: detect the legacy shape (`'id' in entry && typeof entry.ts === 'number'`) and migrate each legacy entry: drop `id` + `label`; convert `ts` via `new Date(entry.ts).toISOString()`; rename `state` to `inputs`. Rewrite the migrated array to disk via `_writeRaw` (one-time, after migration). Subsequent reads hit the new-shape fast path.
  - [ ] T1.4 In `list(slug)`: sort by `ts` descending (ISO string comparison is correct for ISO 8601 strings — lexicographic order matches chronological order). Drop the legacy tie-break on `id` (the new shape has no id; ties broken by insertion order, which `Array.prototype.sort` is stable in ES2019+).
  - [ ] T1.5 In `restore(slug, idOrEntry, opts?)`: accept `HistoryEntry` OR a string (string = ISO 8601 ts, look up by `list(slug).find(e => e.ts === idOrEntry)`). Update the `UrlStateSchemaError(UNKNOWN_ID)` to `UrlStateSchemaError(UNKNOWN_TS)` and document the change in the error factory. Existing call sites that pass strings continue to work.
  - [ ] T1.6 In `panel()` rendering: each row's timestamp is rendered via a NEW private helper `_relativeTime(ts)` (replacing the Story 2.3 helper that used `Intl.RelativeTimeFormat(undefined, ...)`). New helper uses `Intl.RelativeTimeFormat(navigator.language, { numeric: 'auto' })` and falls back to `Intl.DateTimeFormat(navigator.language, { dateStyle: 'medium' })` for diffs > 7 days.
  - [ ] T1.7 In `panel()` rendering: each row's body shows the first 3 input values (clamped to 40 chars + `…`) joined with `, `, plus the result preview (first 80 chars). Add a private helper `_summarizeEntry(entry)` that returns the summary string.
  - [ ] T1.8 In `panel()` rendering: the row's `<button class="history-row">` aria-label is `"Restore from {relative timestamp}, {result preview first 40 chars}"`. The clicked button invokes `HT.history.restore(slug, entry, opts)` where `entry` is the entry object (not a string id).
  - [ ] T1.9 Add `.history-panel__close` button + `.history-panel__backdrop` element to the panel DOM (desktop sidebar variant only — mobile sheet preserves Story 2.3's existing close pattern). Both wire to the same `_closePanel()` helper that returns focus to the History button.
  - [ ] T1.10 Add `Escape` keydown handler at the panel root: if `event.key === 'Escape'` and focus is NOT in a text input (use `isTextInputFocus()` predicate), call `_closePanel()`.
  - [ ] T1.11 Replace the Story 2.3 restore confirm dialog copy from `"Your current inputs differ from this entry. Restoring will overwrite them."` to **exactly** `"You have unsaved changes. Restore and discard them?"` (per AC-4). Add a title heading `"Restore previous entry?"` (visual only, not announced — the message is the announcement).
  - [ ] T1.12 Update the restore confirm dialog button order: `Cancel` (default focus on dialog open) FIRST, `Discard and restore` (Enter focus) SECOND. The current Story 2.3 dialog has the destructive button first with Enter focus — REVERSE the order to match AC-4.
  - [ ] T1.13 Update the cancel-focus return target from "the restore button" (Story 2.3) to "the clicked History row" (AC-4). Capture the row element in the closure when the dialog opens; on cancel, focus that element.
  - [ ] T1.14 Update the `Escape`-while-confirm-dialog-open behavior: activates `Cancel` (the existing browser default for `<dialog>` with a cancel button is to dispatch a `cancel` event then close — verify the existing implementation handles this; if not, add an `Escape` keydown listener that calls the cancel handler).
  - [ ] T1.15 Expose `window.HT_HISTORY_INIT = Object.freeze({version: '1.12.0', cap: 50})` at module init (AD-14 internal-handle pattern, mirrors `HT_HELP_OVERLAY_INIT` and `HT_GLOBAL_CHORDS_INIT`).

- [ ] **T2 — Update `assets/js/api-contract.js`** (AC-9)
  - [ ] T2.1 Bump version `1.11.0` → `1.12.0`.
  - [ ] T2.2 Update the `HT.history.push` notes to mention Story 3.6 + cap 50 + new shape `{ts (ISO 8601), inputs, result}` + migration of legacy `{id, ts (number), state, result, label}` entries. Change the signature doc to accept `{inputs?, result?, ts?}` instead of `{state?, result?, label?, ts?}`.
  - [ ] T2.3 Update the `HT.history.list` notes to mention Story 3.6 + frozen return + `ts` is an ISO 8601 string.
  - [ ] T2.4 Update the `HT.history.restore` notes to mention Story 3.6 + new `entry: HistoryEntry | string` signature + the dialog copy.
  - [ ] T2.5 Add the new `window.HT_HISTORY_INIT` entry with `stability: 'internal'`, `module: 'assets/js/history.js'`, `signature: 'Object.freeze({version: string, cap: number})'`.
  - [ ] T2.6 Update the `HT_HISTORY_INIT` notes with "Story 3.6 cross-page; frozen at module init. The only contract surface for the smoke harness."

- [ ] **T3 — Update `scripts/site-config-gate.py`** (AC-9)
  - [ ] T3.1 `EXPECTED_VERSION` pin `1.11.0` → `1.12.0` (3 places — verify by grep before edit).

- [ ] **T4 — Extend `scripts/_smoke_history_panel.js`** (AC-8)
  - [ ] T4.1 Add 10 storage shape + migration assertions (T1.1–T1.4 contract).
  - [ ] T4.2 Add 8 relative timestamp assertions (T1.6 contract). Stub `Intl.RelativeTimeFormat` and `Intl.DateTimeFormat` in the vm context to capture the locale arg (assert `navigator.language`).
  - [ ] T4.3 Add 6 row truncation assertions (T1.7 contract).
  - [ ] T4.4 Add 8 restore confirm assertions (T1.11–T1.14 contract). Verify dialog message string equality.
  - [ ] T4.5 Add 5 panel dismissal assertions (T1.9–T1.10 contract). Stub `Escape` keydown event; verify focus returns to the History button.
  - [ ] T4.6 Add 8 cross-pin assertions (AC-9 contract). Verify `api-contract.js` version + the new `HT_HISTORY_INIT` entry.
  - [ ] T4.7 Update the assertion comment at the top of the harness: "Story 3.6: 45 assertions (was 31 in Story 2.3) — storage shape + migration, relative timestamps, row truncation, restore confirm, panel dismissal, cross-pins."
  - [ ] T4.8 Vacuous-pass guard (already in place per Story 2.3 — preserve).

- [ ] **T5 — Update CSS** (AC-7 / D9)
  - [ ] T5.1 Append `.history-panel__close` and `.history-panel__backdrop` rules to `assets/css/base.css` (after the existing `.history-button` rule at line 419). Use the existing cobalt tokens (no new colors). Match the Settings modal close-button + backdrop pattern (Story 1.8).
  - [ ] T5.2 Verify the new rules don't regress the existing panel layout (`aside.history-panel`, `aside.history-sheet` at line 410).

- [ ] **T6 — Update `.github/workflows/shell-bounds-check.yml`** (AC-10)
  - [ ] T6.1 Verify `assets/js/history.js` and `scripts/_smoke_history_panel.js` are in the `paths:` filter (verify by reading the workflow file). Add if missing.

- [ ] **T7 — Documentation updates**
  - [ ] T7.1 `docs/shell-public-api.md` §5 — update the 9 `HT.history.*` entries (cap 50, new shape, migration note). Add the `HT_HISTORY_INIT` entry. Version bump note `1.11.0` → `1.12.0`.
  - [ ] T7.2 `docs/shell-public-api.md` §6 — clarify the "no ad-hoc history storage" rule: now also prohibits reading the on-disk JSON directly (the migration runs internally; tools should always use `HT.history.list`).
  - [ ] T7.3 `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` AD-6 prose note: update the "FIFO cap of 10" line to "FIFO cap of 50 (Story 3.6 supersedes Story 2.3's 10)".
  - [ ] T7.4 `tools.schema.json` `history-keys` doc comment: bump the cap description from "10 per tool" to "50 per tool" (Story 3.6).

- [ ] **T8 — Run all gates and validate** (validation gate)
  - [ ] T8.1 `node scripts/_smoke_history_panel.js` — Story 2.3 shipped 31 assertions; this story ADDS 10 + 8 + 6 + 8 + 5 + 8 = **45 new** assertions. Total target: **76/76 PASS** (exceeds AC-8 floor of 50). The Story 2.3 legacy assertions stay passing (the migration hook is tested; the new shape assertions test the new code paths).
  - [ ] T8.2 `node scripts/_smoke_shell_public_api.js` — verify the registry match still passes (the new `HT_HISTORY_INIT` entry shouldn't break the count assertions; verify).
  - [ ] T8.3 `node scripts/_smoke_url_state_codec.js` — regression (no urlState change; verify).
  - [ ] T8.4 `node scripts/_smoke_sample_data.js` — regression.
  - [ ] T8.5 `python scripts/shell-bounds-check.py` — verify the HISTORY_KEY_* patterns still flag ad-hoc storage (none expected — existing tools are clean).
  - [ ] T8.6 `python scripts/shell-bounds-check.py --self-test` — verify the self-test passes (no new HISTORY_KEY_* patterns added in this story).
  - [ ] T8.7 `python scripts/site-config-gate.py` — verify `EXPECTED_VERSION = 1.12.0` cross-pin.
  - [ ] T8.8 `python scripts/shell-drift-check.py` — no chrome drift introduced.
  - [ ] T8.9 `python scripts/shell-a11y-check.py` — no width invariant regression.
  - [ ] T8.10 Manual smoke: open `tools/inflation-calculator/index.html`, click History button, verify the panel shows entries with relative timestamps + truncated inputs + result preview; click an entry while inputs are dirty, verify the confirm dialog copy is exactly the AC string with the right button order and focus; press Escape with focus on the dialog, verify Cancel fires and focus returns to the row.
  - [ ] T8.11 Manual smoke: open `tools/qr-code-generator/index.html` (legacy `{id, ts, state, result, label}` shape on disk if any prior runs exist), open History, verify migration runs once (subsequent opens don't re-migrate — verify by inspecting localStorage).

## Dev Notes

### Architecture & Predecessor Intelligence

- **Story 2.3 ship state (`assets/js/history.js`, 995 lines):** The module is structured as IIFE in strict mode (the IIFE opens at the top of the file). Module-level helpers in approximate order: `_schemaError`, `_requireSlug`, `_loadSchema`, `hasHistory`, `_storageKey`, `_readRaw`, `_writeRaw`, `_genId`, `push`, `list`, `lastEntry`, `clear`, `_doClear`, `restore`, `_doRestore`, `_confirmWithDialog`, `_payloadsEqual`, `_rtf`/`_dtf`/`_relativeTime`, `panel`, `button`, `subscribe`, `teardown`, and the `Object.defineProperties(HT, { history: ... })` block at the bottom. **Read the file in full before editing** — line numbers are not load-bearing (verify with `grep -n` if needed). The helpers are interleaved; the changes in T1.6/T1.7/T1.8 land in the `panel` function body (find by grepping for `class="history-row"`), T1.11/T1.12/T1.13/T1.14 land in the `_confirmWithDialog` helper (find by grepping for `dialog.showModal` or `Your current inputs differ`).
- **Migration is a one-shot, read-time transformation (D4).** The `_readRaw` helper currently does `HT.storage.get(_storageKey(slug))` and returns the parsed array (or `[]`). The migration hook: after the parse, if any entry has `'id' in e && typeof e.ts === 'number'`, rewrite each legacy entry to the new shape, call `_writeRaw` (which routes through `HT.storage.set`) with the migrated array, and return the migrated array. Subsequent calls hit the new-shape fast path (the `typeof e.ts === 'string'` branch). **The rewrite goes through `HT.storage.set`** (not raw `localStorage.setItem`) to honor AD-6 — the storage registry is the only writer for `handy-tools.history.<slug>` keys.
- **The Story 2.3 `_rtf` constant** uses `Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })`. Replace `undefined` with `navigator.language` (with a defensive fallback when `navigator.language` is missing — same pattern Story 3.5's locale default uses). The same change applies to `_dtf`.
- **The panel row rendering is inside the `panel` function's subscribe callback.** The current code renders a single line per row (timestamp + label). The new code renders: relative timestamp + first 3 input values (clamped, joined) + result preview. Three `<span>` children inside the `<button class="history-row">` — preserve the button shape, just expand the body content. Find the row rendering by grepping for `class="history-row"` or `class="history-panel__row"`.
- **The Story 2.3 panel has no close button and no backdrop** (D9). The new ones are desktop-only (mobile sheet uses Story 2.3's swipe-down). The CSS for `.history-panel__close` mirrors `.shell-settings-modal__close` (Story 1.8 Settings modal) — same `position: absolute; top: 0; right: 0` pattern, same `aria-label="Close history"` semantic.
- **The restore confirm dialog (`_confirmWithDialog`)** is currently a private helper shared between `restore` (diverged state) and `clear` (>0 entries). The Story 2.3 dialog has the destructive button FIRST (with Enter focus). This story reverses the order for `restore` (Cancel first, default focus; Discard and restore second, Enter focus) but leaves `clear`'s dialog unchanged (per design language — clear is always destructive; restore is sometimes destructive). **The `_confirmWithDialog` helper must accept a `buttonOrder: ['cancel', 'confirm'] | ['confirm', 'cancel']` parameter** — the existing call sites pass the default order; the new restore call site passes the reversed order.
- **The cancel-focus return target changes** from "the restore button" to "the clicked History row" (T1.13). Capture the row element in the closure when `_confirmWithDialog` is called from `restore`. Add a parameter `focusReturn: HTMLElement` to `_confirmWithDialog({focusReturn, ...})`.
- **No new Shell module ES2018 surface.** `history.js` follows the same ES2018 conventions as `url.js` / `sample-data.js`: `const`/`let`, arrow functions, template literals, async/await, optional chaining. ES5 baseline files (`utils.js`, `theme.js`, `layout.js`) untouched.

### Storage migration details (AC-1, D4)

The legacy shape is:

```json
{
  "id": "h_xyz_abc",
  "ts": 1723219200000,
  "state": {"ic-amount": 100, "ic-from": 2000, "ic-to": 2024},
  "result": "$246.10 (2000 → 2024, +146%)",
  "label": "$100 in 2000"
}
```

The new shape is:

```json
{
  "ts": "2024-08-10T12:00:00.000Z",
  "inputs": {"ic-amount": 100, "ic-from": 2000, "ic-to": 2024},
  "result": "$246.10 (2000 → 2024, +146%)"
}
```

The migration in `_readRaw`:

```js
function _readRaw(slug) {
  const raw = HT.storage.get(_storageKey(slug));
  if (!Array.isArray(raw)) return [];
  let needsRewrite = false;
  const migrated = raw.map(function (e) {
    // Fast path: already the new shape (ts is an ISO 8601 string, no `id` field).
    if (e && typeof e.ts === 'string' && !('id' in e)) return e;
    // Migration: legacy {id, ts (number), state, result, label} → new {ts (string), inputs, result}.
    needsRewrite = true;
    const inputs = (e && e.inputs && typeof e.inputs === 'object')
      ? Object.freeze(Object.assign({}, e.inputs))
      : (e && e.state && typeof e.state === 'object')
        ? Object.freeze(Object.assign({}, e.state))
        : Object.freeze({});
    return Object.freeze({
      ts: (e && typeof e.ts === 'number')
        ? new Date(e.ts).toISOString()
        : (typeof e.ts === 'string' ? e.ts : new Date().toISOString()),
      inputs: inputs,
      result: (e && typeof e.result === 'string') ? e.result : '',
    });
  });
  if (needsRewrite) {
    try {
      // Strip frozen-object proxies for serialization (HT.storage.set validates
      // JSON-serializability for handy-tools.* keys per Story 1.10).
      const stripped = JSON.parse(JSON.stringify(migrated));
      // _writeRaw routes through HT.storage.set (NOT raw localStorage.setItem) to honor AD-6.
      _writeRaw(slug, stripped);
    } catch (_) { /* swallow — best effort, never throw from a read path */ }
  }
  return migrated;
}
```

(The above is illustrative — the dev agent owns the exact implementation, but the migration must be read-time, one-shot, route through `HT.storage.set` (NOT raw `localStorage.setItem`) to honor AD-6, and never throw.)

### Project Structure Notes

- All new code in `assets/js/history.js` (already exists — no new file).
- `assets/css/base.css` — append two rules (T5.1).
- `scripts/_smoke_history_panel.js` — extends the existing harness (T4).
- `assets/js/api-contract.js` — version bump + notes updates + new internal handle (T2).
- `scripts/site-config-gate.py` — `EXPECTED_VERSION` bump (T3).
- `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` AD-6 prose note update (T7.3).
- `docs/shell-public-api.md` §5/§6 updates (T7.1/T7.2).
- `tools.schema.json` `history-keys` doc comment update (T7.4).
- `.github/workflows/shell-bounds-check.yml` `paths:` filter (T6).

### References

- `_bmad-output/planning-artifacts/epics.md` line 787–803 — Story 3.6 user story + ACs
- `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` AD-4, AD-6, AD-7, AD-10, AD-14
- `_bmad-output/planning-artifacts/ux-designs/ux-useful-tools-2026-07-31/EXPERIENCE.md` §4 row 7 + row 17 + row 33 + row 376, §6.1 keyboard map row 11+13, §6.6 sticky focus-trap, §9.1 opt-out notice
- `_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md` §4.5 line 217–230 — FR-12 (now: cap = 50)
- `_bmad-output/implementation-artifacts/2-3-per-tool-history-panel.md` — full predecessor spec + ACs (cap = 10, shape with id/state/label)
- `_bmad-output/implementation-artifacts/3-3-per-tool-keyboard-shortcuts-overlay.md` — `h` (Show history) + `r` (Restore last) bindings (already wired; this story does not modify them)
- `_bmad-output/implementation-artifacts/3-4-global-keyboard-chords-for-cross-page-navigation.md` — `isTextInputFocus()` predicate pattern (mirrors Story 3.4 T1.7)
- `_bmad-output/implementation-artifacts/3-5-settings-modal-full-control-surface.md` — locale default with defensive `navigator.language` fallback pattern
- `assets/js/history.js` line 1–995 — the module being modified
- `assets/js/url.js` — bindForm write path used by `restore` (`_writeFieldValue`)
- `assets/js/api-contract.js` — current version 1.11.0; the 9 `HT.history.*` entries (8 stable + 1 internal)
- `assets/css/base.css` line 410–419 — existing `.history-panel`, `.history-sheet`, `.history-button` rules
- `scripts/_smoke_history_panel.js` line 1–451 — the harness being extended

## Senior Developer Review (AI)

_Empty — populated after implementation + review._

## Dev Agent Record

### Implementation Plan

_To be filled in during implementation._

### Debug Log

_To be filled in during implementation._

### Completion Notes

_To be filled in during implementation._

## File List

_To be filled in during implementation. Expected modified files:_

- `assets/js/history.js` (modified — new shape, cap 50, migration, panel/button rendering, confirm dialog, internal handle)
- `assets/js/api-contract.js` (modified — version bump + entry notes + new internal handle)
- `scripts/site-config-gate.py` (modified — `EXPECTED_VERSION` bump)
- `scripts/_smoke_history_panel.js` (modified — 45 new assertions)
- `assets/css/base.css` (modified — `.history-panel__close` + `.history-panel__backdrop` rules)
- `docs/shell-public-api.md` (modified — §5/§6 entries + version bump note)
- `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` (modified — AD-6 cap clarification)
- `tools.schema.json` (modified — `history-keys` doc comment)
- `.github/workflows/shell-bounds-check.yml` (possibly modified — paths filter)

## Change Log

- 2026-08-11 — Story 3.6 spec created (create-story workflow, ready-for-dev).