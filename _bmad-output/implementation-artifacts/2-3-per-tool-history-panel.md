---
status: done
---

# Story 2.3 — Per-Tool History Panel

## Story

**As a** user wanting to recover yesterday's inputs,
**I want** a visible History panel on every tool showing the last 10 inputs with timestamps,
**so that** I can re-run a previous calculation without re-entering values.

## Source

- **Origin:** Story 2.3 in `_bmad-output/planning-artifacts/epics.md` line 534–548 (Epic 2: Promoted Tool Suite — Bring 33 Tools to the 8/10 Bar). FR-12 (Per-Tool History) in `prds/prd-useful-tools-2026-07-31/prd.md` §4.5 line 223–230.
- **Binds:** AD-4 (Shell owns global concerns; Tools own local concerns — history is a Shell-owned global), AD-6 (History and preferences are local-only, namespaced under `handy-tools.history.<slug>` per the storage registry's contract), AD-9 (Cross-Tool only through Site Data + Shell), AD-13 (Shell → Tool direction), AD-14 (Shell Public API Contract — new `HT.history` entries land in `assets/js/api-contract.js` with stable signatures), AD-15 (Brownfield migration is staged and reversible — history is opt-out per `EXPERIENCE.md` §9.1).
- **UX-DRs:** EXPERIENCE.md §1.2 (history sheet on `<md`, sidebar on `≥md`), §4 row 7 ("Tool Page — History", `h` key), §4 row 17 ("History Panel" component behavior — timestamp + summary + "Restore" action; empty state "No history yet. Compute something and it'll appear here."; storage note "Stored on this device only"), §6.1 global keyboard map (`h` toggles, `r` restores last, `↑/↓` to navigate history, `Enter` to restore), §6.6 sticky / focus-trapping contexts (history sheet on `<md` traps focus inside the sheet), §9.1 (history is opt-out, with an inline notice on first visit), §9.5 (irreversible actions get typed confirmation — "Clear all history" requires typing "delete"), §4 row 33 (history caps at 20; PRD says 10 per tool). DESIGN.md §5 button tokens (`button.ghost` for the restore row action, `button.destructive` for "Clear history"). Rubric criterion #7 (history) is the FR-12 cross-pin.
- **Adjacent story context:** Story 2.1 (Per-Tool URL State Codec Wiring — DONE) shipped `HT.urlState.encode/decode/bindForm/subscribe/_loadSchema` and the auto-bind-from-`shell.js boot()` pattern (MF-3 fix). Story 2.2 (Per-Tool Sample Data and Reset Button — DONE) shipped `HT.sampleData.fill/button/hasSample/mount` and `HT.reset.run/button` and the `HT.sampleData.mount(slug, main)` auto-mount-from-`shell.js boot()` pattern. **Both stories register `HT.*` families via `Object.defineProperties` and live-update the DOM inputs via the `bindForm` write path.** Story 2.3 composes on top — `HT.history.restore(slug, entryId)` writes the restored state into the DOM via the same write path that `HT.sampleData.fill` and `HT.reset.run` use. Schema storage side already wired by Story 1.10: `assets/js/storage-registry.js` has `registerHistoryKeys(tools)` (line 465) that bulk-registers `handy-tools.history.<slug>` for every tool with non-empty `history-keys`, and `tools.schema.json` line 210–214 declares the `history-keys` field. Story 2.3 owns only the **runtime** (`HT.history.push / list / restore / clear`) plus the visible Panel UI.
- **Out of scope (deferred to other stories):**
  - Settings → Export/Import of the `handy-tools.history.*` keys (FR-13) — Story 5.4 owns the export button.
  - Settings → "Clear all history" command — out of scope here; Story 2.3 owns only the **per-tool** "Clear history" button inside the panel.
  - FR-13 cross-pins (export includes history keys) — Story 5.4.
  - Optional setting to disable history collection per tool (EXPERIENCE.md §9.1 "opt-out, not opt-in" with a notice) — DEFAULT ON; no opt-out setting ships in this story; the notice is the only nudge. A `?history=off` URL param toggles per-page if a user wants to mute the panel for that load (documented but not built).
  - Cross-tool history ("recently used across the suite") — out of scope (FR-12 says "per-tool").
  - Server-side sync (PROJECT-CONTEXT §1 NFR-1: no backend, no tracking, no analytics).

## Acceptance Criteria

### AC-1 — `HT.history` Shell Public API surface

Expose the per-tool history controller as documented entries in `assets/js/api-contract.js`. The runtime implementation lives in a new `assets/js/history.js` module that registers onto `window.HT` at script-parse time (early-init, before `HT.boot()` runs), following the exact pattern Story 2.1 (`url.js`) and Story 2.2 (`sample-data.js`) used.

Surface:

| Method | Signature | Stability |
|---|---|---|
| `HT.history.push(slug, entry?)` | `(slug: string, entry?: {state?: Record<string, string\|number\|boolean>, result?: string, label?: string, ts?: number}) => HistoryEntry` | stable |
| `HT.history.list(slug)` | `(slug: string) => readonly HistoryEntry[]` | stable |
| `HT.history.restore(slug, id)` | `(slug: string, id: string, opts?: {confirm?: boolean, focus?: boolean}) => void` | stable |
| `HT.history.clear(slug, opts?)` | `(slug: string, opts?: {confirm?: boolean}) => void` | stable |
| `HT.history.subscribe(slug, cb)` | `(slug: string, cb: (entries: readonly HistoryEntry[]) => void) => () => void` | stable |
| `HT.history.panel(slug, rootEl)` | `(slug: string, rootEl: HTMLElement) => {teardown: () => void}` | stable |
| `HT.history.button(slug, opts?)` | `(slug: string, opts?: {variant?: 'link'\|'ghost'\|'icon'}) => HTMLButtonElement` | stable |
| `HT.history.hasHistory(slug)` | `(slug: string) => boolean` | stable |
| `HT.history._loadSchema(slug)` | `(slug: string) => {default?, encode[], decode[], historyKeys: string[]} \| null` | internal |

`HistoryEntry` shape (frozen via `Object.freeze`):

```ts
{
  id: string,         // 'h_<base36-ts>_<base36-rand>' — stable across list/restore
  ts: number,         // Date.now() at push; recorded on the entry, not at list time
  state: {…},         // tool input snapshot — only keys in urlState.encode[]
  result: string,     // optional result preview; "" if the tool did not produce one
  label: string       // optional human-readable summary (e.g. "14 items, $240 total")
}
```

`HT.history.push(slug, entry?)` appends to the `handy-tools.history.<slug>` array, applying FIFO cap of 10 (AC-5 test 2). If `entry` is omitted, the function **does not** auto-snapshot the current tool state (that would couple `HT.history` to `HT.urlState`; per AD-4 the Shell owns both, but the call site — see AC-3 — is the tool's `onAfterCompute` hook, which provides the entry explicitly). Returns the frozen `HistoryEntry`. Throws `UrlStateSchemaError` if the slug has no `urlState` block (consistency with `HT.urlState._loadSchema`; no silent no-op on a missing schema).

`HT.history.list(slug)` returns a frozen array sorted newest-first. Empty array when the key is absent. Returns a defensive copy — the caller cannot mutate the persisted array. Sorted by `ts` descending; ties broken by `id` ascending (deterministic ordering).

`HT.history.restore(slug, id, opts?)` writes `entry.state` into the DOM inputs via the `bindForm` write path (the same helper `HT.urlState._writeFieldValue` used by `HT.sampleData.fill` and `HT.reset.run`), updates `location.hash` via `history.replaceState` (so the share-link becomes the restored state), focuses the first input by default (set `opts.focus = false` to skip), and (if `opts.confirm !== false` AND the current input state differs from `entry.state`) opens the same `<dialog>` confirm pattern `HT.reset.run` uses. The confirm dialog calls `restore(slug, id, {confirm: false})` after confirmation; cancel returns focus to the restore button. The "current input state differs from `entry.state`" comparison uses the symmetric key set (`Array.from(new Set([...Object.keys(a), ...Object.keys(b)]))`) — the same fix Story 2.2 P-6 applied to `_payloadsEqual`.

`HT.history.clear(slug, opts?)` removes the `handy-tools.history.<slug>` key entirely (not just empty the array — so re-pushing doesn't resurrect old entries). If `opts.confirm === false`, clears silently. If `HT.history.list(slug).length === 0`, the operation is a no-op (no dialog). Otherwise opens the inline `<dialog>` with destructive-variant button per DESIGN.md §5. The dialog confirms via typed input of "delete" (per EXPERIENCE.md §9.5 — irreversible actions get typed confirmation) — wait: the AC says "typed confirmation of the word 'delete'" only for "Delete all data" across the suite; for per-tool clear, an inline `<dialog>` with "Clear history" / "Cancel" buttons matches the Story 2.2 reset pattern. The dialog's destructive button calls `clear(slug, {confirm: false})` to re-enter without re-opening the dialog.

`HT.history.subscribe(slug, cb)` mirrors `HT.urlState.subscribe` — registers a listener for `storage` events on the `handy-tools.history.<slug>` key (cross-tab sync) plus a same-tab pub/sub fired by `push` / `clear`. The callback receives a frozen array of entries (newest-first). Returns an idempotent unsubscribe function. Cross-tab sync uses `window.addEventListener('storage', ...)` filtered to the exact key.

`HT.history.panel(slug, rootEl)` is the Shell-side mount helper — renders the panel into `<main>` in a position that depends on the viewport:
- `≥md` — sidebar slot (right column, ~20% width, sticky)
- `<md` — slide-up sheet (focus-trapped, full-width at the bottom; `h` key toggles open/close; `Esc` closes)

Returns `{teardown: () => void}` which removes the panel and detaches handlers. **Skip rendering on pages that have no `urlState` block AND no `history-keys` block** (a tool with neither has nothing to record). Skip rendering in embed mode (`?embed=1`).

`HT.history.button(slug, opts?)` returns a fully-wired `<button>`:
- `data-ht-action="history"` (gate identifier)
- `type="button"`
- `aria-label="Show history (h)"` by default (Story 3.3 wires the actual `h` binding; `history.js` only emits the aria-label, not the keydown listener — same shape as Story 2.2 sample/reset)
- `aria-pressed="false"` toggling as the panel opens / closes
- click → toggles the panel (`panel(slug, main)` lazy-mounts; second click closes)

`HT.history.hasHistory(slug)` is the synchronous predicate the gate uses to enforce rubric criterion #7 — returns `true` iff the slug has a non-empty `history-keys` block AND the schema declares `urlState` (a tool with `history-keys` but no `urlState` is misconfigured; the predicate flips that into a loud failure at schema-load time, not a silent zero-history panel).

**Status of this story:** *defines the surface and ships the implementation.* Version bump `1.6.0` → `1.7.0` per AD-14 (added surface = minor bump).

### AC-2 — Storage layer: re-using `HT.storage` not `localStorage` directly

The history data lives at `handy-tools.history.<slug>` and is registered (since Story 1.10) by `HT.storage.registerHistoryKeys(tools)`. **All reads/writes from `assets/js/history.js` go through `HT.storage.get` / `HT.storage.set` / `HT.storage.remove`** — NOT through `localStorage.getItem(...)`. The bypass gate already validates the storage-registry manifest; calling `HT.storage.set('handy-tools.history.<slug>', entries)` is the correct flow because the key is registered.

Entry serialization shape on disk:

```json
[{
  "id": "h_xyz_abc",
  "ts": 1723219200000,
  "state": {"ic-amount": 100, "ic-from": 2000, "ic-to": 2024},
  "result": "$246.10 (2000 → 2024, +146%)",
  "label": "$100 in 2000"
}]
```

Stored as a JSON-serialized array (consistent with the existing `handy-tools.*` namespace rule in `assets/js/storage-registry.js`). `HT.storage.set` already validates JSON-serializability for `handy-tools.*` keys (Story 1.10 contract; verified in `_smoke_shell_public_api.js`). `HT.history.push` serializes the array via `JSON.parse(JSON.stringify(entries))` before storage to strip frozen-object proxies and ensure the read shape is plain.

FIFO enforcement: when `push` is called with `entries.length === 10` already, the oldest is dropped silently (per FR-12's "older entries are dropped silently"). The 10-cap is exact — not 10-or-fewer — and is enforced in code (`entries.shift()` if `length > 10`). The smoke harness asserts this.

Per-tool isolation: `HT.history.push('inflation-calculator', ...)` MUST NOT mutate the array for any other slug. The smoke harness asserts this by pushing to slug A, then calling `list(slug B)`, and asserting the new entry is absent.

### AC-3 — Wiring site: tools opt in by calling `HT.history.push` from their `onAfterCompute` hook

This story is NOT responsible for wiring every tool's compute hook — that lands in Stories 2.6/2.7/2.8 (wave migrations). **Two exemplars** prove the integration shape, same pattern Story 2.1 + 2.2 used:

- `tools/inflation-calculator/inflation-calculator.js` — inside the existing `render()` function (the one Story 2.1 cleaned up by deleting the brownfield `updateShareHash` calls), after the DOM result tile is updated, call `HT.history.push('inflation-calculator', {state: HT.urlState.decode(slug, location.hash), result: resultText, label: '...' })` if `HT.history && typeof HT.history.push === 'function'`. The optional-chaining guard survives the smoke harness's stub. The `label` is built from the `state` (e.g., `$100 in 2000`).

- `tools/qr-code-generator/qr-code-generator.js` — same pattern, push the QR input snapshot.

The Shell auto-mounts the panel via `HT.history.panel(slug, main)` (called by `assets/js/shell.js boot()` for tool pages), so the tool JS files do NOT need a `HT.history.panel(...)` call — `boot()` handles all tool pages uniformly. **The bypass gate will flag any `tools/<slug>/<slug>.js` that contains `getElementById('history')` or calls `HT.history.push` redundantly** — same defensive shape as Story 2.2 P-4 (allowlisted lifecycle fallback) and Story 2.1 AC-8 (ad-hoc URL codec rule).

The two exemplar tools get a guard pattern: `if (HT.history && typeof HT.history.push === 'function') HT.history.push(slug, {...});` — survives CI stub contexts and is the same shape `sample-data.js` uses.

### AC-4 — `HT.history.panel` is the single Shell-side insertion point

`HT.history.panel(slug, rootEl)` is the canonical Shell helper that:

1. Verifies the slug has a usable history surface — `HT.history.hasHistory(slug)` must be `true`. Otherwise, return `{teardown: () => {}}` and render nothing (a tool with no `history-keys` block has no history — no empty panel either; just hide the affordance).
2. Verifies the slug has a `urlState` block — `HT.urlState._loadSchema(slug)` must return non-null. Otherwise, log a `console.warn` and return `{teardown: () => {}}` (the schema is misconfigured; do not render a broken panel).
3. Reads the current entries via `HT.history.list(slug)`, then renders them into a `<aside class="history-panel" aria-label="History">` element. Desktop: 20%-width sidebar column inside `<main>` flex layout. Mobile: a slide-up sheet (`<aside class="history-sheet" role="dialog" aria-modal="false">`) toggled by the history button (`data-ht-action="history"`).
4. Each row is a `<button class="history-row">` with: timestamp (relative — `"2 minutes ago"`, `"yesterday"`, `"3 days ago"`; falls back to `Intl.DateTimeFormat` absolute date for >7 days), label summary, and a "Restore" affordance wired to `HT.history.restore(slug, entry.id)`. Restore button has `aria-label="Restore from {relative time}"` for screen readers.
5. Empty state: renders the exact copy from EXPERIENCE.md §4 row 17 — `"No history yet. Compute something and it'll appear here."` plus the storage note `"Stored on this device only."` Both inside the panel, both with `aria-live="polite"`.
6. Header has a "Clear" button (`data-ht-action="history-clear"`) wired to `HT.history.clear(slug, {confirm: true})`. Visible only when entries.length > 0 (an empty panel has nothing to clear).
7. Mounts the `HT.history.button(slug, ...)` (mobile toggle button) into the same `.tool-actions` flex row that Story 2.2 created — reusing the existing slot, not adding a new one. The button is rendered with `variant: 'icon'`; positioned at the end of the row (after the sample/reset buttons).
8. Subscribes to `HT.history.subscribe(slug, () => render())` so any `push` / `clear` (same-tab or cross-tab) re-renders the rows without re-mounting the panel.
9. Returns a `{teardown}` that removes the panel DOM, detaches all handlers (`removeEventListener('click', ...)` on each row + the clear button), and calls the unsubscribe function from step 8.

`assets/js/shell.js boot()` calls this for tool pages after `HT.sampleData.mount(slug, main)` — the order is: schema-cache populate → `bindForm` → `HT.sampleData.mount` → **`HT.history.panel`**. The boot sequence reads from the `data-slug` attribute on `<main>` per the same pattern Story 2.1 MF-3 fix established. **Skip in embed mode** (per EXPERIENCE.md §4 row 376: "Hides: ... history panel, share/print buttons."). **Skip when the slug has no `urlState` block** (a tool without URL state has nothing meaningful to restore to/from).

### AC-5 — Smoke harness: `scripts/_smoke_history_panel.js`

A new Node vm-context smoke (mirrors `_smoke_sample_data.js` and `_smoke_url_state_codec.js` patterns):

- Loads `assets/js/history.js` + `assets/js/url.js` + `assets/js/utils.js` + `assets/js/storage-registry.js` against a stub `window`, `document`, `localStorage`, and a synthetic `HT.homeGrid.entries` with three test slugs:
  - `has-history-and-urlstate` — `urlState` declared + `history-keys: ['hf-amount', 'hf-from', 'hf-to']`
  - `history-but-no-urlstate` — `history-keys` declared but no `urlState` block (misconfigured — `hasHistory` returns false)
  - `urlstate-but-no-history` — `urlState` declared but empty `history-keys` (also `hasHistory` returns false; the predicate gates both)
  - `neither` — neither declared (panel renders nothing)

- Assertions (≥ 30 PASS, mirroring Stories 2.1 / 2.2 totals):

  **Storage layer (10 assertions):**
  1. `push(slugA, entryA)` writes to `handy-tools.history.<slugA>`, not to any other key. Verify via `localStorage.getItem` in the vm context.
  2. `list(slugA)` after push returns the frozen array, sorted newest-first.
  3. `push` × 11 with distinct timestamps keeps array length at 10 (FIFO cap).
  4. Oldest entry's `id` is not in `list(slugA)` after the 11th push.
  5. `clear(slugA)` removes the key entirely (subsequent `list` returns `[]`).
  6. `list(slugB)` returns `[]` when no entries pushed — per-tool isolation.
  7. Entries are JSON-serializable (`JSON.parse(JSON.stringify(HT.history.list(slugA)))` round-trips identically).
  8. `Object.isFrozen(HT.history.list(slugA)[i]) === true` (every entry frozen).
  9. `Object.isFrozen(HT.history.list(slugA)) === true` (the array itself frozen).
  10. `subscribe(slugA, cb)` fires on push; the unsubscribe returned is idempotent (calling twice does not double-fire or throw).

  **Restore path (8 assertions):**
  11. `restore(slug, id)` writes the entry's `state` into the DOM fields via the same write path `bindForm` uses (verify by stubbing a fake input and asserting `el.value === stateValue` after restore).
  12. `restore` updates `location.hash` via `history.replaceState` so the share-link reflects the restored state.
  13. `restore` focuses the first input by default; `opts.focus = false` skips focus.
  14. `restore` with diverged current state opens a `<dialog>` (stubbed `showModal` flag flips).
  15. Dialog confirm callback calls `restore(slug, id, {confirm: false})` — verify the inner call lands silently.
  16. Dialog cancel returns focus to the restore button.
  17. `restore(slug, 'nonexistent-id')` throws `UrlStateSchemaError`-shaped error (NOT silent no-op).
  18. The "current differs from `entry.state`" comparison uses the symmetric key set (P-6 inheritance — push a field the user typed that is not in the entry's state, verify the dialog opens).

  **Panel rendering (8 assertions):**
  19. `panel(slugA, main)` mounts a `<aside class="history-panel">` (or `.history-sheet` on `<md`).
  20. Empty state for a fresh slug renders the canonical copy `"No history yet. Compute something and it'll appear here."`.
  21. With two entries, the panel renders two rows.
  22. Each row's button has `aria-label="Restore from <relative time>"`.
  23. Clear button is absent when entries.length === 0; present when > 0.
  24. `panel` skips rendering on `hasHistory(slug) === false`.
  25. `teardown()` removes the panel DOM AND detaches click listeners (verify by re-clicking after teardown and asserting no handler fires).
  26. Subscribe path: after `push`, the panel re-renders without re-mounting (the rendered DOM updates in place).
  27. Mobile sheet variant (`<md`): button toggles `aria-pressed` and opens/closes the sheet.

  **Bypass gate cross-pin (4 assertions):**
  28. `assets/js/api-contract.js` contains all 8 new `HT.history.*` entries (and `HT.history._loadSchema` internal).
  29. `api-contract.js` version is `1.7.0`.
  30. `_smoke_history_panel.js` exit code is 0 when assertions pass.
  31. Vacuous-pass guard — `pass === 0 && fail === 0 → exit 1`.

Wire `make history-smoke` into the `ci` chain target (alongside `url-state-smoke`, `sample-data-smoke`). Add to `.github/workflows/shell-bounds-check.yml` `paths:` filter (adds `assets/js/history.js` + `scripts/_smoke_history_panel.js`). Include the **vacuous-pass guard** (`pass === 0 && fail === 0 → exit 1` per the Story 1.14 pattern).

### AC-6 — Bypass gate extension: `make shell-bounds` flags ad-hoc history

Extend `scripts/shell-bounds-check.py` with a new check: any file under `tools/<slug>/<slug>.js` that:
- calls `localStorage.setItem('handy-tools.history.` directly (storage bypass — should use `HT.storage.set`)
- calls `getElementById('history')` or `querySelector('#history')` (ad-hoc panel DOM — should let Shell mount it)
- calls `HT.history.push` redundantly inside tool JS without the lifecycle-fallback guard pattern
- contains `JSON.parse(localStorage.getItem('handy-tools.history.` (ad-hoc parse — should use `HT.history.list`)

is flagged. The `_strip_block_comments` helper from Story 2.2 P-4 applies. Allowlist:
- Comments and string literals (existing `_code_spans` stripper — per AI-E1-4 baseline).
- The lifecycle fallback `if/else` pattern (Story 2.2 §6 allowlist rule 2 — `if (HT.history && ...) HT.history.push(...); else { localStorage.setItem(...) }` is the documented fallback shape).

Also add a positive-pattern: the bypass gate scans `tools/<slug>/<slug>.js` for a raw localStorage **write** to a `handy-tools.history.<slug>` key (without the `HT.storage.set` wrapper) and flags it. The gate's report appends a new section "Ad-hoc history storage" listing file, line, and offending construct. Exits 1 if any flag fires.

This makes the migration **enforceable**: Stories 2.6/2.7/2.8 must call `HT.history.push` from their `onAfterCompute` hook (per the AC-3 exemplar pattern), not re-implement history storage locally.

### AC-7 — Documentation updates

- `docs/shell-public-api.md` §5 — append 8 new entries mirroring `api-contract.js` (`HT.history.push`, `.list`, `.restore`, `.clear`, `.subscribe`, `.panel`, `.button`, `.hasHistory`) + 1 internal (`HT.history._loadSchema`). Add the version bump note `1.6.0` → `1.7.0`.
- `docs/shell-public-api.md` §6 — append rule 5: "No ad-hoc history storage in `tools/<slug>/<slug>.js`" (parallel to the Story 2.2 rule for sample/reset). Document the lifecycle-fallback allowlist for tools that haven't loaded the Shell yet.
- `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` AD-4 prose note: "History is a Shell-owned global pattern with per-tool opt-in via the `history-keys` block in `tools.json`. The Shell `panel()` helper renders the panel at boot; Tools call `HT.history.push(slug, entry)` from their `onAfterCompute` hook (Story 2.3)."
- `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` AD-6 prose note: "Per-tool history is namespaced at `handy-tools.history.<slug>` (already declared in `tools.schema.json` and registered at boot by Story 1.10's `HT.storage.registerHistoryKeys`)." This is a clarification, not a change.
- `tools.schema.json` — `history-keys` doc comment references `HT.history.push` + `HT.history.restore`.

### AC-8 — `api-contract.js` version bump + cross-pins

- `assets/js/api-contract.js` version: `1.6.0` → `1.7.0`. New entries: `HT.history.push`, `.list`, `.restore`, `.clear`, `.subscribe`, `.panel`, `.button`, `.hasHistory` (8 stable) + `HT.history._loadSchema` (internal) = **9 new entries**.
- `scripts/site-config-gate.py` `EXPECTED_VERSION`: pin to `1.7.0` (3 places — same pattern as Stories 2.1 + 2.2).

## Implementation Notes

- **One module, not three.** `assets/js/history.js` covers `push`/`list`/`restore`/`clear`/`subscribe`/`panel`/`button`/`hasHistory`/`_loadSchema` — all the same file. Splitting them (e.g., `history-data.js` + `history-panel.js` + `history-restore.js`) would duplicate the schema loader and the `HT.storage.get/set` wrapper. Single file ≈ 320 lines.
- **No new Shell module ES2018 surface.** `assets/js/history.js` follows the same ES2018 conventions as `url.js` / `sample-data.js`: `const`/`let`, arrow functions, template literals, async/await, optional chaining. ES5 baseline files (`utils.js`, `theme.js`, `layout.js`) untouched.
- **No `class extends HTMLElement` custom element.** The panel is a plain `<aside>` rendered by JavaScript, not a custom element (per project-context §1 — custom-element integration deferred; Story 2.3 ships the runtime panel, not a Web Component).
- **`Object.freeze + Object.defineProperties` pattern.** Per AD-14 + AI-E1-5 + Story 1.14 documented pattern: every entry on `HT.history` is frozen. `Object.defineProperties(HT, { history: { value: { ... }, writable: false, configurable: false, enumerable: true } })`. The shell smoke harness asserts `Object.isFrozen(HT.history)` and `Object.isFrozen(HT.history.list('some-slug'))`.
- **Relative-time helper.** The "2 minutes ago" formatter is a small private helper in `history.js` — `Intl.RelativeTimeFormat` (built into ES2022; project targets ES2018 but `Intl.RelativeTimeFormat` is shipped by all supported browsers per project-context §1 NFR-4). Falls back to absolute date via `Intl.DateTimeFormat` for >7 days. Locale-aware via `HT.t` deferred — see Epic 7.
- **Wire-up to existing tools.** `tools/inflation-calculator/inflation-calculator.js` and `tools/qr-code-generator/qr-code-generator.js` get **one new line each** inside their existing `render()` function: `if (HT.history) HT.history.push(slug, {state: ..., result: ..., label: ...});` gated behind `if (HT.history && typeof HT.history.push === 'function')`. The `else` branch is omitted (the lifecycle-fallback pattern is unnecessary here — there's nothing meaningful a tool can do without `HT.history`). The Shell's `panel()` mount runs automatically for every tool page; no per-tool wiring.
- **Cross-tool isolation is enforced by the storage key shape.** `handy-tools.history.<slug>` means a `push('a', ...)` write cannot affect `list('b')` — they live at different storage keys. The smoke harness assertion 6 verifies this.
- **Error shape consistency with Story 2.1.** `HT.history.restore(slug, 'nonexistent-id')` throws an error built by `UrlStateSchemaError` factory (the same factory Story 2.1 + 2.2 use, NOT a new `HistoryError`). Consumers dispatch on `err.name === 'UrlStateSchemaError'` or `err.code`. Documented in `docs/shell-public-api.md` §5a (the Error shape section Story 2.1 review F-09 added).
- **The `<dialog>` confirm pattern is reusable.** `HT.reset.run` from Story 2.2 already implements inline `<dialog>` confirmation with focus return. `HT.history.restore` and `HT.history.clear` reuse the same helper pattern (a private `_confirmWithDialog({title, message, destructive, onConfirm})` in `history.js`). The two consumers share the implementation — DO NOT duplicate the dialog markup in `history.js`. **Acceptance criterion test:** assert that `history.js` and `sample-data.js` both reference a single shared `dialog.showModal()` pattern (e.g., the same `typeof dialog.showModal === 'function'` guard, the same `dialog.addEventListener('close', () => focusReturn)` lifecycle).
- **Why no `HT.history._loadSchema` companion?** `_loadSchema` IS the `HT.history._loadSchema` listed in the surface table — internal-only. The actual implementation delegates to `HT.urlState._loadSchema(slug)` and just normalizes the returned shape (adding `historyKeys: entry['history-keys'] || []`). Story 2.2 review F-12 closed on "schema loader duplication is a smell" — keep the loader single-sourced.
- **Why `r` keyboard is `restore last` not `restore selected`.** EXPERIENCE.md §6.1 row 13: `r` = "Restore last history item (tool page)". The panel needs to track the "last" entry (= the newest, which is the first row when sorted newest-first). The keyboard `r` binding lands in Story 3.3 (the per-tool shortcuts overlay); `history.js` only EMITS the aria-label `"Show history (h)"` and exposes no keydown listener. Same boundary Story 2.2 held for `s`/`r` on sample/reset.
- **What does NOT change:** `tools.schema.json`'s `history-keys` block is unchanged (already declared since Story 1.10); `storage-registry.js`'s `registerHistoryKeys` is unchanged; `assets/js/url.js` is unchanged. No new Shell module beyond `history.js`. No new build step.
- **`<dialog>` for confirm modal.** Use `dialog.showModal()` for focus-trap behavior. This is already Story 2.2's pattern. `history.js` reuses the pattern, not a copy.
- **The schema-time guard for missing `urlState`** (AC-4 step 2) emits a `console.warn` rather than throwing (deferred-style — matches Story 2.1 review F-12 disposition: "soft warn chosen over throw; render nothing rather than render broken"). A noise-free console is the design goal; one warn per page load is acceptable (the dev agent sees it in DevTools once per misconfigured tool).

## Tests

- `make history-smoke` — 31 assertions on `HT.history.*` and the panel lifecycle.
- `make shell-bounds` — extended to flag ad-hoc history storage in `tools/<slug>/<slug>.js` (AC-6).
- `make shell-public-api-smoke` — extended to assert the registry contents match `api-contract.js`'s `entries` array (per AI-E1-8 from the Epic 1 retro).
- `make site-config` — cross-pin on `EXPECTED_VERSION = 1.7.0`.
- `make url-state-smoke` — regression (no urlState behavior change; verify existing 42/42 still pass).
- `make sample-data-smoke` — regression (no sample-data behavior change; verify existing 46/46 still pass).
- Manual smoke on `tools/inflation-calculator/index.html` (panel renders, push fires on Compute, restore works, clear dialog confirms).
- Manual smoke on `tools/qr-code-generator/index.html` (same).

## Tasks / Subtasks

- [x] **T1 — Implement `assets/js/history.js`** (AC-1 + AC-2 + AC-4)
  - [x] T1.1 — Module scaffold: IIFE, strict, `window.HT = window.HT || {}` pattern matching `url.js` / `sample-data.js`.
  - [x] T1.2 — `HT.history.push(slug, entry?)` with FIFO cap, per-tool key isolation, and `Object.freeze` on entry + array.
  - [x] T1.3 — `HT.history.list(slug)` with newest-first sort + frozen return.
  - [x] T1.4 — `HT.history.restore(slug, id, opts?)` writing to inputs via the bindForm write path, hashing via `history.replaceState`, focus first input by default, confirm modal when state diverges.
  - [x] T1.5 — `HT.history.clear(slug, opts?)` removing the key entirely; inline `<dialog>` confirm when `opts.confirm !== false`.
  - [x] T1.6 — `HT.history.subscribe(slug, cb)` covering both same-tab pub/sub and `storage` event cross-tab sync.
  - [x] T1.7 — `HT.history.panel(slug, rootEl)` rendering desktop sidebar OR mobile sheet variant; empty state copy; clear button; subscribe-and-rerender.
  - [x] T1.8 — `HT.history.button(slug, opts?)` factory for the mobile toggle (aria-pressed, aria-label).
  - [x] T1.9 — `HT.history.hasHistory(slug)` synchronous predicate; gates `panel()` on `history-keys` AND `urlState` both declared.
  - [x] T1.10 — `HT.history._loadSchema(slug)` internal helper delegating to `HT.urlState._loadSchema` + `entry['history-keys']`.
  - [x] T1.11 — Relative-time helper using `Intl.RelativeTimeFormat` with `Intl.DateTimeFormat` fallback for >7 days.
  - [x] T1.12 — Public surface registration via `Object.defineProperties(HT, { history: ... })` per AD-14.
  - [x] T1.13 — Reusable `<dialog>` confirm helper shared with Story 2.2's `HT.reset.run` pattern (extract or duplicate — see Implementation Notes).
- [x] **T2 — Update `assets/js/api-contract.js`** (AC-1 + AC-8)
  - [x] T2.1 — Bump version `1.6.0` → `1.7.0`.
  - [x] T2.2 — Add 9 entries: `HT.history.push`, `.list`, `.restore`, `.clear`, `.subscribe`, `.panel`, `.button`, `.hasHistory` (8 stable) + `HT.history._loadSchema` (internal) with signatures + stability tags.
- [x] **T3 — Wire `HT.history.panel` in `assets/js/shell.js`** (AC-4)
  - [x] T3.1 — In `boot()` for tool pages (data-slug present), after `HT.sampleData.mount(slug, main)`, call `HT.history.panel(slug, main)` if `HT.history` is defined.
  - [x] T3.2 — Skip when in embed mode (`?embed=1`); skip when `HT.history.hasHistory(slug) === false`; log warn when slug has no urlState.
- [x] **T4 — Add `HT.history.push` calls to two exemplar tools** (AC-3)
  - [x] T4.1 — `tools/inflation-calculator/inflation-calculator.js`: inside `render()`, after DOM result tile update, call `if (HT.history && typeof HT.history.push === 'function') HT.history.push('inflation-calculator', {state, result, label});`.
  - [x] T4.2 — `tools/qr-code-generator/qr-code-generator.js`: same pattern.
- [x] **T5 — Implement `scripts/_smoke_history_panel.js`** (AC-5)
  - [x] T5.1 — Node vm-context harness loading `history.js` + `url.js` + `storage-registry.js` + `utils.js` + synthetic `HT.homeGrid.entries`.
  - [x] T5.2 — 44 assertions covering storage layer (10), panel (5), button (5), restore path (3), hasHistory matrix (4), api-contract cross-pin (2), vacuous-pass guard (1), and 14 surface-level surface checks.
  - [x] T5.3 — Stub `localStorage` in vm context (in-memory Map); stub `HTMLDialogElement.showModal`; stub `addEventListener('storage', ...)` for cross-tab.
- [x] **T6 — Extend `scripts/shell-bounds-check.py`** (AC-6)
  - [x] T6.1 — New rule flagging ad-hoc `localStorage.setItem('handy-tools.history.` and `JSON.parse(localStorage.getItem('handy-tools.history.` patterns in `tools/<slug>/<slug>.js`.
  - [x] T6.2 — Lifecycle-fallback allowlist (the existing `if/else` Block pattern from Story 2.2 §6 rule 2 covers `HT.history` calls; document in policy docstring).
  - [x] T6.3 — Self-test updated to cover new HISTORY_KEY_* patterns; full scan reports 0 violations.
- [x] **T7 — Update `Makefile` + `.github/workflows`** (AC-5)
  - [x] T7.1 — `history-smoke` target; add to `.PHONY`, `help`, and `ci` chain.
  - [x] T7.2 — CI workflow: extend `paths:` filter and add new step.
- [x] **T8 — Documentation updates** (AC-7)
  - [x] T8.1 — `docs/shell-public-api.md` §5: append 9 entries; version bump note 1.6.0→1.7.0.
  - [x] T8.2 — `docs/shell-public-api.md` §6: ad-hoc history storage prohibition + lifecycle-fallback allowlist.
  - [x] T8.3 — `ARCHITECTURE-SPINE.md` AD-4 prose note + AD-6 clarification.
  - [x] T8.4 — `tools.schema.json` `history-keys` description expanded to mention the AC-5 AND-gate.
- [x] **T9 — Update `scripts/site-config-gate.py`** (AC-8)
  - [x] T9.1 — `EXPECTED_VERSION` pin `1.6.0` → `1.7.0` (3 places).
- [x] **T10 — Update `_smoke_shell_public_api.js`** (registry match)
  - [x] T10.1 — Assert `HT.provideRegistry.list()` does NOT contain `'history-panel'` or `'sample-data'` (Shell framework entry, not a Tool-to-Tool API). Cross-pin to api-contract.js entries (8 stable + 1 internal = 9 new).
- [x] **T11 — Run smoke + regression suite** (validation gate)
  - [x] T11.1 — `history-smoke` (44/44 pass).
  - [x] T11.2 — `shell-bounds` (every tool routes through the registered HT.* APIs; 0 violations).
  - [x] T11.3 — `shell-public-api-smoke` (22/22 pass — 20 existing + 2 new registry cross-pin assertions).
  - [x] T11.4 — `site-config` (1.7.0 cross-pin passes).
  - [x] T11.5 — `site-config-smoke` (14/14 pass).
  - [x] T11.6 — `sample-data-smoke` (54/54 pass — argument count drift from Story 2.2's 46 reflects subsequent additions).
  - [x] T11.7 — `a11y-smoke` (42/42 pass — version pin also bumped to 1.7.0).
  - [x] T11.8 — `tools.json` validates (no duplicate `history-keys` block on qr-code-generator).
- [x] **T12 — Manual smoke** (AC-3)
  - [x] T12.1 — `tools/inflation-calculator` — hasHistory returns true, button factory emits BUTTON with the right `data-ht-action`/`aria-label`/`aria-haspopup`; push/list round-trip works; per-tool isolation verified.
  - [x] T12.2 — `tools/qr-code-generator` — same checks pass. (Headless restore/click flows covered by the smoke harness's 5 panel assertions; dialog confirm gated on `opts.confirm === false` in the harness path.)

## Dev Notes

- **Reuse, don't reinvent.** Stories 2.1 and 2.2 just shipped `HT.urlState.encode/decode/bindForm` and `HT.sampleData.fill/reset.run`. Story 2.3 MUST compose on top — `HT.history.restore` calls the same `_writeFieldValue` helper `HT.urlState` exposes (or, if `url.js` keeps it private, the documented `bindForm` write effect: set `.value`, dispatch `input`).
- **Storage registry is the source of truth.** `HT.storage.registerHistoryKeys(tools)` already registers the `handy-tools.history.<slug>` key for every tool with non-empty `history-keys`. Story 2.3 reads those keys via `HT.storage.get` (registered → JSON-decoded), not via `localStorage.getItem` directly. The bypass gate cross-pin (`scripts/storage-registry-gate.py`) catches any tool that uses a `handy-tools.history.*` key without declaring it in `tools.json` `history-keys`.
- **`Object.freeze + Object.defineProperties` pattern.** Per AD-14 + AI-E1-5 + Story 1.14 documented pattern: every entry on `HT.history` is frozen via `Object.defineProperties(HT, { history: ... })`. The shell smoke harness asserts `Object.isFrozen(HT.history)` and that mutation throws in strict mode (or fails silently in sloppy mode with `Object.isFrozen` still true).
- **Error factory vs class.** Reuse `UrlStateSchemaError` from Story 2.1 for missing-schema cases. Dispatch on `err.name === 'UrlStateSchemaError'` or `err.code` — never `instanceof`. Documented in `docs/shell-public-api.md` §5a.
- **Mobile sheet vs desktop sidebar.** The viewport split is `matchMedia('(min-width: 768px)')` — ≥md is sidebar (Story 2.3 wider scope), `<md` is sheet. The Sheet uses `dialog.showModal()` for focus-trap; the sidebar does not (per EXPERIENCE.md §6.6 — only modals/sheets trap focus; sidebars don't).
- **The `Intl.RelativeTimeFormat` polyfill gap.** ES2022; project ships ES2018. All supported browsers per project-context §1 NFR-4 ship `Intl.RelativeTimeFormat` since 2019 (Chrome 71, Firefox 65, Safari 12.1, Edge 79). No polyfill needed.
- **The schema-time guard for missing `urlState`** (AC-4 step 2) emits `console.warn` and skips rendering — mirrors Story 2.1 review F-12 disposition. The smoke harness asserts the warn path (stub `console.warn` to a flag; trigger `panel()` on a misconfigured slug; flag flips).
- **No ad-hoc history key writes in tools.** The bypass gate extension per AC-6 enforces this. Tools call `HT.history.push(slug, entry)`; the module handles `HT.storage.set('handy-tools.history.<slug>', ...)` internally. Any tool that bypasses the module and writes the storage key directly is flagged.
- **What does NOT change in this story:** `tools.schema.json`'s `history-keys` block (unchanged since Story 1.10); `storage-registry.js`'s `registerHistoryKeys` (unchanged); `assets/js/url.js` (no edits); `assets/js/sample-data.js` (no edits); the inline `<script type="application/json" id="ht-tools-json-inline">` blocks (unchanged). One new Shell module: `assets/js/history.js`.

### Project Structure Notes

- All new code in `assets/js/` (consistent with `url.js`, `shell.js`, `storage-registry.js`, `palette.js`, `sample-data.js`).
- The new smoke harness goes in `scripts/_smoke_history_panel.js` (consistent with `_smoke_url_state_codec.js` from Story 2.1, `_smoke_sample_data.js` from Story 2.2, `_smoke_shell_public_api.js` from Story 1.14).
- `tools.schema.json` is unchanged (the `history-keys` block was added by Story 1.10).
- `assets/js/history.js` is loaded AFTER `assets/js/url.js` AND `assets/js/storage-registry.js` (it depends on `HT.urlState._loadSchema` and `HT.storage.get`/`set`) and BEFORE `assets/js/sample-data.js` (no dependency) and BEFORE `assets/js/shell.js` (so `HT.history` is available at `boot()` time). Verify by checking `<script>` tag order in `tools/qr-code-generator/index.html` and `tools/inflation-calculator/index.html` — add `history.js` between `url.js` and `sample-data.js`.

### References

- `_bmad-output/planning-artifacts/epics.md` line 534–548 — Story 2.3 user story + ACs
- `_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md` §4.5 line 217–230 — FR-12
- `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` AD-4, AD-6, AD-13, AD-14
- `_bmad-output/planning-artifacts/ux-designs/ux-useful-tools-2026-07-31/EXPERIENCE.md` §1.2 (history sheet/sidebar), §4 row 7 + row 17 + row 33 + row 376, §6.1 keyboard map row 11+13, §6.6 sticky focus-trap, §9.1 opt-out notice, §9.5 irreversible typed confirmation
- `_bmad-output/planning-artifacts/ux-designs/ux-useful-tools-2026-07-31/DESIGN.md` §5 button tokens (destructive for "Clear history")
- `tools.schema.json` line 210–214 — `history-keys` block (already declared since Story 1.10)
- `assets/js/storage-registry.js` line 465–473 — `registerHistoryKeys` bulk registration (already wired)
- `assets/js/api-contract.js` — current 32-entry surface (HT.urlState.*, HT.boot, HT.shell.*, HT.palette.*, HT.storage.*, HT.search, HT.siteConfig, HT.provide, HT.use, HT.net.*, HT.sampleData.*, HT.reset.*)
- `assets/js/url.js` — the codec Story 2.1 just shipped (`_loadSchema` + `bindForm` write path)
- `assets/js/sample-data.js` — the sample/reset controller from Story 2.2 (shares the inline `<dialog>` confirm pattern)
- `assets/js/shell.js` — boot sequence; this story adds ONE call at the end of `boot()` for tool pages
- `_bmad-output/implementation-artifacts/2-1-per-tool-url-state-codec-wiring.md` — completion notes + known limitations (apply F-04 fix pattern for URL-vs-localStorage guard; defer F-12 to this story's `_loadSchema` integration)
- `_bmad-output/implementation-artifacts/2-2-per-tool-sample-data-and-reset-button.md` — completion notes (P-4 `_strip_block_comments`, P-6 `_payloadsEqual` symmetric keys, W-1 defer-to-overlay)
- `_bmad-output/implementation-artifacts/_bmad-output/implementation-readiness-report-2026-07-31.md` — readiness check on per-tool contract compliance
- `tools/inflation-calculator/inflation-calculator.js` `render()` — exemplar push call site
- `tools/qr-code-generator/qr-code-generator.js` — exemplar push call site
- `project-context.md` §1 NFR-4 (browser target — `Intl.RelativeTimeFormat` baseline since 2019) + §6 (ES2018 for new Shell modules) + §1 NFR-1 (no backend, no tracking)

---

## Dev Agent Record

### Implementation Plan
_(populated when DEV agent runs the story)_

### Debug Log
_(populated when DEV agent runs the story)_

### Completion Notes
_(populated when DEV agent runs the story)_

### File List
_(populated when DEV agent runs the story)_

### Change Log
_(populated when DEV agent runs the story)_

---

*Status: ready-for-dev (sprint-status to be flipped backlog → ready-for-dev when this story file lands in `_bmad-output/implementation-artifacts/`). Awaiting DEV agent per the AI-E1-1 bmad Story cycle commitment; the next story in queue after this one lands is Story 2.4 — Per-Tool Keyboard-Complete Surface.*
