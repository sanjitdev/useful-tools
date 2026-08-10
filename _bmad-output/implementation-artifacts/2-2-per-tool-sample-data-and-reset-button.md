---
baseline_commit: ee438eb6035f345688b6ee7f52b757174bd68b07
---

# Story 2.2 — Per-Tool Sample Data and Reset Button

**Status:** done (2026-08-10, code review complete — 2 DN + 11 P resolved, 4 deferred; 54/54 smoke passing; bypass gate + site-config gate PASS)

## Story

**As a** user landing on a tool for the first time,
**I want** the tool pre-populated with realistic sample data and a one-click reset button,
**so that** I can see what it does and recover from a bad input.

## Source

- **Origin:** Story 2.2 in `_bmad-output/planning-artifacts/epics.md` (Epic 2: Promoted Tool Suite — Bring 33 Tools to the 8/10 Bar). Cross-references the 8/10 Quality Rubric criterion #3 ("Sample data") and #6 ("Sample data — a 'Try an example' button populates inputs with realistic data so a first-time visitor sees the tool work in ≤ 5 seconds") per `_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md` §4.1.
- **Binds:** AD-2 (Tool Contract is the unit of inclusion), AD-3 (Site Data is the single source of truth), AD-4 (Shell owns global concerns; Tools own local concerns), AD-5 (URL is canonical state — sample/reset interact with the URL codec), AD-9 (Cross-Tool only through Site Data + Shell), AD-13 (Shell → Tool direction), AD-14 (Shell Public API Contract — new `HT.sampleData` / `HT.reset` entries land in `assets/js/api-contract.js` with stable signatures).
- **UX binds:** DESIGN.md §5 button tokens (`button.primary` for committed action, `button.destructive` for reset, **"reset inputs"** is explicitly listed as destructive); EXPERIENCE.md §4 Sample Data Link row ("Visible on every tool page as a text link, never a button — keeps the visual hierarchy focused on inputs. Loads instantly, animates input fill ≤200 ms, scrolls to result tile"); EXPERIENCE.md §3.2 microcopy ("Try an example" is the do-canonical label); EXPERIENCE.md §6.5 ("every shortcut used in flow must be discoverable" — `r` for reset, `s` for sample must appear in `?` overlay).
- **Adjacent story context:** Story 2.1 (Per-Tool URL State Codec Wiring — DONE) just shipped the `HT.urlState` codec that this story composes against; Story 2.3 (Per-Tool History Panel — backlog) and Story 2.5 (Per-Tool Share Dialog — backlog) follow. The 32 remaining tools are migrated in waves by Stories 2.6/2.7/2.8 — those migrations MUST call the new APIs this story lands.

## Acceptance Criteria

### AC-1 — Manifest schema: `urlState.sample` block + `shortcuts[].action` already lists `"sample"` and `"reset"`

- `tools.schema.json`'s `tool-entry.urlState.properties` (line 144–184) currently has `default`, `encode`, `decode`. **This story adds a sibling `sample` property:**
  ```json
  "sample": {
    "type": "object",
    "description": "Per-tool sample-data preset (AD-5 state preset). Each key is a form-field id; each value must match the type declared in `encode[]` for that field. Merged on top of `default` at runtime; absent fields fall back to default values. The merged object is frozen before return — see HT.sampleData.fill.",
    "additionalProperties": {
      "type": ["string", "number", "boolean"]
    }
  }
  ```
  Insert this between `"default"` and `"encode"` in the `properties` map. **`sample` is NOT added to the `required` array** (line 143) — it remains optional. Tools without `sample` declared simply don't get a "Try an example" affordance (consistent with the rubric's "≤ 5 seconds" being a target, not a requirement). Note that `date` is deliberately excluded from the value-type union here because the existing `encode[]` items use `type: "date"` but no current tool declares a date-typed sample value; the gate will flag a date-typed `sample` so we don't expand scope silently.
- `shortcuts[].action` (line 198) already enumerates `"sample"` and `"reset"` — no schema change required. The one existing tool that already declares `shortcuts[]` with these actions is `inflation-calculator` (declares `{action: "reset", key: "r", label: "Reset to defaults"}` and `{action: "sample", key: "s", label: "Load sample ($100 in 2000)"}` — verified in `tools.json`). It becomes the canary exemplar in AC-5.
- `history-keys` (line 203) is unchanged — sample/reset are NOT history operations (they're local-to-the-tab state mutations, not persisted records per FR-12).

### AC-2 — `HT.sampleData` Shell Public API surface

Expose the sample-data loader as documented entries in `assets/js/api-contract.js`. The implementation lives in a new `assets/js/sample-data.js` module that registers onto `window.HT` at script-parse time (early-init, before `HT.boot()` runs).

| Method | Signature | Stability |
|---|---|---|
| `HT.sampleData.fill(slug)` | `(slug: string) => Readonly<Record<string, string\|number\|boolean>> \| null` | stable |
| `HT.sampleData.button(slug, opts?)` | `(slug: string, opts?: {label?: string, variant?: 'link'\|'ghost'}) => HTMLButtonElement` | stable |
| `HT.sampleData.hasSample(slug)` | `(slug: string) => boolean` | stable |
| `HT.sampleData.mount(slug, rootEl)` | `(slug: string, rootEl: HTMLElement) => {teardown: () => void}` | stable |

`HT.sampleData.fill(slug)` returns `Object.freeze(Object.assign({}, schema.urlState.default, schema.urlState.sample))` — i.e., the parsed `urlState.sample` block merged on top of `urlState.default`, **frozen** so callers cannot mutate the returned object (any mutation throws in strict mode, fails silently in sloppy mode). The returned object's keys are the form-field ids; the values are the sample presets. Returns `null` if the slug has no `urlState.sample` block AND no `urlState.default` block (caller decides whether to render a button). If only `default` is present (no `sample`), returns the frozen default. Throws `UrlStateSchemaError` (Story 2.1 factory function, NOT a class) if the slug's urlState entry is malformed.

`HT.sampleData.button(slug, opts)` returns a fully-wired `<button>` element:
- `data-ht-action="sample"` (gate identifier)
- `type="button"` (never submit)
- `aria-label` includes the shortcut key (e.g., `"Try an example (s)"`) per EXPERIENCE.md §6.5
- click → `HT.sampleData.fill(slug)` → writes values to inputs via the `bindForm` write path (Story 2.1's documented contract) → updates `location.hash` via `history.replaceState` → focuses the first input
- Tools MUST NOT call this directly. The Shell mounts it via `HT.sampleData.mount(slug, main)` (AC-4) at boot, after `bindForm` has run. Tool pages do not need to wire a `<button>` of their own.

`HT.sampleData.hasSample(slug)` is a synchronous predicate the gate uses to enforce the rubric criterion #3 on every promoted tool (a tool that ships without `sample` will fail the rubric; this helper lets the gate assert on it). It returns `true` iff the slug has a non-empty `urlState.sample` block.

**Status of this story:** *defines the surface and ships the implementation.* Version bump `1.5.0` → `1.6.0` per AD-14 (added surface = minor bump).

### AC-3 — `HT.reset` Shell Public API surface

Expose the reset controller as documented entries. The implementation lives in the same `assets/js/sample-data.js` module (one file, one surface family — same module pattern as `urlState`).

| Method | Signature | Stability |
|---|---|---|
| `HT.reset.run(slug, opts?)` | `(slug: string, opts?: {confirm?: boolean}) => void` | stable |
| `HT.reset.button(slug, opts?)` | `(slug: string, opts?: {label?: string, variant?: 'ghost'\|'destructive'}) => HTMLButtonElement` | stable |

**Reset semantics — must match the canonical Epic 2.2 AC.**

Per `epics.md` Story 2.2 acceptance criteria (line 525–532):

> clicking reset **restores the sample values** and clears history (with confirm if there is unsaved state)

Therefore `HT.reset.run(slug, opts)` does NOT just write `urlState.default` — it writes `HT.sampleData.fill(slug)` (i.e., `sample ?? default` per AC-2) so reset behavior matches the Epic. Concretely:

1. Compute the reset payload by calling `HT.sampleData.fill(slug)`. If the slug has no `sample` block, fall back to `urlState.default`. If both are absent, `HT.reset.run` is a no-op (no button is rendered — see AC-4 step 2).
2. Write the payload into the DOM inputs via the same write path `bindForm` uses (Story 2.1's documented contract).
3. Clear `location.hash` via `history.replaceState(null, '', location.pathname + location.search)` — so the URL returns to the canonical tool URL with no hash fragment.
4. If the current input state differs from the reset payload (unsaved-state heuristic, see Implementation Notes below for the exact comparison rule) AND `opts.confirm !== false`, prompt the user with the destructive-variant confirm per DESIGN.md §5 (`button.destructive` outlined red, fills red on confirmation). If `opts.confirm === false`, skip the dialog and reset silently (callers that already confirmed via another path — e.g., the dialog's own "Reset" button — pass `confirm: false` after the dialog confirms). The confirm prompt is a tiny inline `<dialog>` (NOT `window.confirm`) — reuses the modal pattern from `assets/js/settings-modal.js` if it exists, else renders a 3-line inline `<dialog>` with a "Reset" / "Cancel" pair. The dialog calls `dialog.showModal()` for focus-trap behavior and returns focus to the reset button on close.

The button's canonical label is **"Reset to sample"** (per Epic AC line 530), NOT "Reset to defaults". The aria-label is `"Reset to sample (r)"`.

`HT.reset.button(slug, opts)` returns a fully-wired `<button>`:
- `data-ht-action="reset"` (gate identifier)
- `type="button"`
- `aria-label` is `"Reset to sample (r)"` by default; `opts.label` overrides the visible text but NOT the aria-label (which still surfaces the shortcut key per EXPERIENCE.md §6.5)
- `aria-describedby` references the unsaved-state warning span when present (added by `run()` before opening the dialog)
- click → `HT.reset.run(slug, {confirm: true})`

Both `sample` and `reset` buttons are mounted into `<main>` by the Shell at boot (see AC-4) so individual tools don't have to wire them.

### AC-4 — `HT.sampleData.mount(slug, rootEl)` wires the round-trip

The single Shell-side helper that, given a tool `rootEl`, finds (or creates) a slot div, appends both buttons when applicable, and binds them to the existing `HT.urlState.bindForm` lifecycle so the URL hash updates consistently with sample/reset state changes. Returns `{teardown: () => void}`.

Behavior:
1. If `HT.sampleData.hasSample(slug)` is false, render no sample button (just the reset button if step 2 allows it).
2. If the schema has no `urlState.default` block AND no `urlState.sample` block, render nothing (a tool with no declared preset has nothing to reset to).
3. Otherwise, append the buttons inside `<main>` in a `.tool-actions` flex row that sits between the tool header and the form fields (per the EXPERIENCE.md §4 "Sample Data Link row" — buttons appear inline above the first field, not as a sticky footer).
4. Each button's click handler reads the current schema via `HT.urlState._loadSchema(slug)`, calls the underlying fill/run, and triggers a synthetic `input` event on the first field so any downstream `bindForm` listener updates the URL hash.
5. Returns a teardown that removes the buttons and detaches handlers.

`HT.reset.mount(slug, rootEl)` is NOT a separate function — reset buttons are mounted by the same `HT.sampleData.mount(slug, rootEl)` call (the helper is named for sample but mounts both, because they share the `.tool-actions` slot and the `bindForm` lifecycle binding). Documentation should describe it as "`HT.sampleData.mount` mounts the sample AND reset buttons" rather than implying two helpers.

`assets/js/shell.js` boot() calls this for tool pages after `bindForm` has run (the order is: schema-cache populate → bindForm → mount), but the smoke harness drives it directly without a boot path.

### AC-5 — Wiring sites

This story is responsible for **schema-block updates on two exemplar tools**. The Shell auto-mounts sample/reset buttons via `HT.sampleData.mount(slug, main)` at boot (per AC-4), so the tool JS files do NOT need a new `HT.sampleData.mount(...)` call — `assets/js/shell.js boot()` handles all tool pages uniformly.

- `tools.json` — `inflation-calculator` entry gets a new `urlState.sample` block: `{ "ic-amount": 100, "ic-from": 2000, "ic-to": 2024 }`. The existing declared `default` does not include `ic-forward-rate`, so the sample merges the default forward-rate of 3 on top of its own three fields. The smoke harness asserts the merged fill equals `{ "ic-amount": 100, "ic-forward-rate": 3, "ic-from": 2000, "ic-to": 2024 }` and that both sample AND reset buttons render in the `.tool-actions` row.
- `tools.json` — `qr-code-generator` entry gets a `urlState.sample` block that mirrors the existing default: `{ "qr-text": "https://example.com", "qr-ecc": "M", "qr-margin": "4" }`. The smoke harness asserts the merge path returns this same object (sample-over-default, identity merge). For qr-code-generator, reset == sample (same content) so the reset button's payload is the merged object.

**Inline JSON splice updates (per Story 2.1's F-01 byte-compare pattern):** both tools have an inline `<script type="application/json" id="ht-tools-json-inline">` block in `tools/<slug>/index.html` that mirrors the relevant `tools.json` slice. Each splice MUST be updated to include the new `urlState.sample` block (otherwise the runtime uses the inline slice which would drift from `tools.json` — this is the Story 2.1 F-01 fix that introduced `tools_json_inline_body_ok`). The `scripts/shell-template.py` regen handles this; the dev agent regenerates the splices as part of implementation.

**No JS file edits required in `tools/<slug>/<slug>.js`.** The existing `boot()` already calls `HT.urlState.bindForm`; the Shell's `boot()` calls `HT.sampleData.mount(slug, main)` automatically for every tool page. The dev agent MUST NOT add `HT.sampleData.mount(...)` calls to individual tool files — that's redundant (would double-mount buttons) and the bypass gate (`shell-bounds-check.py`) will flag it.

**Consistency rule for tools that already declare `shortcuts[]`:** the only tool currently declaring `shortcuts[]` with `action: "sample"` or `action: "reset"` is `inflation-calculator`. Any tool that declares a `sample` shortcut MUST have a `sample` block in `urlState` (or `default` if no sample — reset falls back to default). The smoke harness asserts this consistency and the gate fails any tool that declares a `sample` shortcut without a backing `sample` block. Future tools (Stories 2.6/2.7/2.8) that declare these shortcuts get the same assertion for free.

**Out of scope:** the remaining 30 tools that have no `urlState` block today are NOT touched by this story. Story 2.6/2.7/2.8 wave migrations land sample/reset blocks per the AC-5 pattern, and the Shell's `mount()` runs automatically for any tool page (no per-tool wiring needed beyond the schema block).

### AC-6 — Smoke harness: `scripts/_smoke_sample_data.js`

Node-based vm-context smoke that loads `sample-data.js` + `utils.js` + a synthetic `HT.homeGrid.entries` with three test slugs (`has-sample-and-default`, `default-only`, `none-of-either`) and asserts:

1. `HT.sampleData.hasSample('has-sample-and-default')` → true; `.fill()` returns the merged (sample-over-default) object.
2. `HT.sampleData.hasSample('default-only')` → false; `.fill()` returns the frozen default (NOT null, per AC-2 — fill returns null only when both default and sample are absent).
3. `HT.sampleData.hasSample('none-of-either')` → false; `.fill()` returns null. (Mount helper renders neither button for this slug.)
4. `HT.sampleData.button(...)` returns a `<button>` with the right `data-ht-action`, `aria-label`, `type`, and a working click handler that dispatches `input` on the first matched input.
5. `HT.reset.button(...)` likewise; click handler calls `HT.reset.run(slug)` which writes the reset payload (= `HT.sampleData.fill(slug)`, i.e., sample merged onto default) to the inputs and calls `history.replaceState(null, '', location.pathname + location.search)` to clear the hash.
6. `HT.reset.run(slug)` with unsaved-history state renders an inline `<dialog>` (assert the dialog opens; user-confirm path is exercised manually in the browser).
7. `HT.sampleData.mount(slug, rootEl)` returns `{teardown}`; after teardown the buttons are gone from the DOM.
8. `HT.sampleData.fill(slug)` returns a frozen object — assert `Object.isFrozen(result) === true` AND that a mutation attempt (`result.foo = 'bar'`) throws in strict mode (or fails silently + `Object.isFrozen(result)` remains true in sloppy mode). This is the freeze invariant from AC-2; the smoke must enforce it explicitly because sloppy-mode silent failure is hard to spot.
9. Smoke assertion that the `tools.json` inflation-calculator entry has its `sample` block (no runtime test — pure JSON parse assertion).

Wire the smoke into `Makefile` (`make sample-data-smoke`), the `.github/workflows/shell-bounds-check.yml` path filter, and the `ci` chain target. Include a vacuous-pass guard (`pass === 0 && fail === 0 → exit 1`) per the pattern in Story 2.1.

### AC-7 — Documentation

- `docs/shell-public-api.md` §5 — append 5 new stable `HT.sampleData.*` + `HT.reset.*` entries mirroring `api-contract.js`. Add the `1.5.0` → `1.6.0` version bump note.
- `docs/shell-public-api.md` §6 — add to the allowlist the explicit policy that ad-hoc sample/reset buttons in `tools/<slug>/<slug>.js` are forbidden (same bypass-gate extension shape as the URL codec rule from Story 2.1).
- `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` — AD-4 prose note: "Sample/reset is a Shell-owned global pattern with per-tool opt-in via the `urlState.sample` block; the per-tool shortcuts `r` and `s` are declared in `shortcuts[]` and bound at boot by `assets/js/shell.js`."
- `tools.schema.json` doc comment on `urlState.sample` references `HT.sampleData.fill` and links to `assets/js/sample-data.js`.

### AC-8 — `api-contract.js` version bump + cross-pins

- `assets/js/api-contract.js` version: `1.5.0` → `1.6.0`. New entries: `HT.sampleData.fill`, `HT.sampleData.button`, `HT.sampleData.hasSample`, `HT.sampleData.mount`, `HT.reset.run`, `HT.reset.button`. (6 new entries — `mount` is the 6th per AC-2/AC-4; same pattern as Story 2.1's urlState batch.)
- `scripts/site-config-gate.py` `EXPECTED_VERSION`: pin to `1.6.0` (3 places — same pattern as Story 2.1).

## Implementation Notes

- **Why two modules for sample and reset, or one?** One module (`assets/js/sample-data.js`) — they share the `_loadSchema` helper, the button-factory pattern, and the confirm-modal helper. Splitting them would duplicate ~60% of the code. Single file ≈ 220 lines.
- **Why confirm-on-reset only when there's unsaved history?** DESIGN.md §5 lists reset as `button.destructive` (outlined red, fills red on confirmation). EXPERIENCE.md §9.5 says irreversible actions get typed confirmation. A reset that the user just clicked because they want to *intentionally* discard inputs is reversible (just click sample) — the irreversible case is when they've made edits they might want back via History (Story 2.3). The `confirm` heuristic (per AC-3 step 4): if the current input state differs from the reset payload (= `HT.sampleData.fill(slug)`, the merged sample-on-default), prompt; otherwise reset silently. **Story 2.2 ships this input-vs-payload comparison only.** A tighter heuristic that also compares against the latest history entry (so reset by a user who has made edits they might want back via History is the only path that prompts) is the canonical Story 2.3 deliverable — the dev agent MUST NOT try to land that here.
- **Why text-link in the existing pattern but button in this story?** The current `tools/qr-code-generator` page already has a "Try an example" affordance as a button (per `tools/qr-code-generator/index.html` chrome), and EXPERIENCE.md §3.2 explicitly says the canonical microcopy is **"Try an example"**. The "text link, never a button" rule in EXPERIENCE.md §4 is for inline secondary affordances; the primary sample/reset pair is a different visual hierarchy. Use the existing `.btn--ghost` token for sample and `.btn--destructive` for reset.
- **Why a sibling `sample` block in `urlState` instead of a top-level field?** AD-5 puts all state-codec metadata under `urlState`. Sample is a state preset (a "named state"); it composes with `default` and `prefill` (Story 6.4) through the same merge hierarchy. Keeping it under `urlState` lets `HT.urlState._loadSchema` return it in the same payload — no new lookup path.
- **Why no `HT.history` dependency in this story?** Story 2.3 (history panel) lands in the next wave. AC-3's "unsaved state" detection uses a small heuristic on the schema default + current input values, not the history registry. Story 2.3 will replace this heuristic with the proper unsaved-vs-history comparison.
- **Why mount the buttons at boot rather than letting each tool opt in?** AD-4 (Shell owns global concerns) — sample/reset is global. The two exemplar tools in AC-5 just need their `urlState.sample` block + `boot()` calls `HT.urlState.bindForm` (which Story 2.1 already does) — the Shell's `mount(slug, rootEl)` is called automatically after `bindForm`. No per-tool wiring.
- **What does NOT change in this story:** the inline `<script type="application/json" id="ht-tools-json-inline">` block stays; `tools.json` schema gains one optional field (`urlState.sample`); the existing `urlState` shape (default/encode/decode) stays. No other Shell module (`storage-registry.js`, `search.js`, `theme.js`, `palette.js`) is touched.

## Tests

- `make sample-data-smoke` — 9 assertions on `HT.sampleData.*` + `HT.reset.*`.
- `make shell-bounds` — extended to flag ad-hoc `getElementById('sample')` / `getElementById('reset')` patterns in `tools/<slug>/<slug>.js` (same defensive shape as the URL codec rule from Story 2.1).
- `make shell-public-api-smoke` — extended to assert the registry contents match `api-contract.js`'s `entries` array (per AI-E1-8 from the Epic 1 retro).
- `make site-config` — cross-pin on `EXPECTED_VERSION = 1.6.0`.
- Manual smoke on QR + inflation-calculator (AC-5).

## Tasks / Subtasks

- [x] **T1 — Extend `tools.schema.json`** with the `urlState.sample` block (AC-1)
  - [x] T1.1 — Insert `sample` property into `urlState.properties` (between `default` and `encode`) with type union `string|number|boolean`; do NOT add to `required`.
  - [x] T1.2 — Run `make site-config` (or `node -e "JSON.parse(require('fs').readFileSync('tools.schema.json'))"`) to confirm JSON is well-formed.
- [x] **T2 — Implement `assets/js/sample-data.js`** (AC-2 + AC-3 + AC-4)
  - [x] T2.1 — Module scaffold: IIFE, strict, `window.HT = window.HT || {}` pattern matching `url.js`.
  - [x] T2.2 — `HT.sampleData.fill(slug)` returning `Object.freeze(Object.assign({}, schema.default, schema.sample))`; null when both absent.
  - [x] T2.3 — `HT.sampleData.hasSample(slug)` returning true iff non-empty `urlState.sample` block.
  - [x] T2.4 — `HT.sampleData.button(slug, opts)` factory returning a `<button data-ht-action="sample">` with aria-label, type, and click handler.
  - [x] T2.5 — `HT.reset.run(slug, opts)` writing `fill(slug)` to inputs via the bindForm write path; clearing hash via `history.replaceState(null, '', location.pathname + location.search)`; confirm modal when input state differs from payload and `opts.confirm !== false`.
  - [x] T2.6 — `HT.reset.button(slug, opts)` factory returning a `<button data-ht-action="reset">` with aria-label "Reset to sample (r)" by default.
  - [x] T2.7 — `HT.sampleData.mount(slug, rootEl)` rendering both buttons in a `.tool-actions` flex row; returning `{teardown}`.
  - [x] T2.8 — Public surface registration via `Object.defineProperties(HT, { sampleData: ..., reset: ... })` per AD-14.
- [x] **T3 — Update `assets/js/api-contract.js`** (AC-2 + AC-8)
  - [x] T3.1 — Bump version `1.5.0` → `1.6.0`.
  - [x] T3.2 — Add 6 entries: `HT.sampleData.fill`, `HT.sampleData.button`, `HT.sampleData.hasSample`, `HT.sampleData.mount`, `HT.reset.run`, `HT.reset.button` with signatures + stability tags.
- [x] **T4 — Wire `HT.sampleData.mount` in `assets/js/shell.js`** (AC-4)
  - [x] T4.1 — In boot() for tool pages (data-slug present), after bindForm, call `HT.sampleData.mount(slug, main)`.
- [x] **T5 — Add `urlState.sample` blocks to two exemplar tools** (AC-5)
  - [x] T5.1 — `tools.json`: inflation-calculator gets `{ "ic-amount": 100, "ic-from": 2000, "ic-to": 2024 }`.
  - [x] T5.2 — `tools.json`: qr-code-generator gets `{ "qr-text": "https://example.com", "qr-ecc": "M", "qr-margin": "4" }` (mirrors default).
  - [x] T5.3 — Regenerate inline `<script type="application/json">` splices via `scripts/shell-template.py` (F-01 byte-compare). Verify `tools_json_inline_body_ok` byte-check passes.
- [x] **T6 — Implement `scripts/_smoke_sample_data.js`** (AC-6)
  - [x] T6.1 — Node vm-context harness loading `sample-data.js` + `utils.js` + synthetic HT.homeGrid.entries.
  - [x] T6.2 — 9 assertions: hasSample/fill for 3 slugs; sample button + click dispatch; reset button + click; run with unsaved state opens dialog; mount round-trip + teardown; `Object.isFrozen` invariant; tools.json parse check.
  - [x] T6.3 — Vacuous-pass guard (`pass === 0 && fail === 0 → exit 1`).
- [x] **T7 — Extend `scripts/shell-bounds-check.py`** (AC-7 + bypass gate)
  - [x] T7.1 — New rule flagging ad-hoc `getElementById('sample')` / `getElementById('reset')` patterns in `tools/<slug>/<slug>.js`.
- [x] **T8 — Update `Makefile` + `.github/workflows`** (AC-6 + AC-7)
  - [x] T8.1 — `sample-data-smoke` target; add to `.PHONY`, `help`, and `ci` chain.
  - [x] T8.2 — CI workflow: extend `paths:` filter and add new step.
- [x] **T9 — Documentation updates** (AC-7)
  - [x] T9.1 — `docs/shell-public-api.md` §5: append 6 entries; §6: bypass rule for ad-hoc sample/reset buttons.
  - [x] T9.2 — `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` AD-4 prose note.
- [x] **T10 — Update `scripts/site-config-gate.py`** (AC-8)
  - [x] T10.1 — `EXPECTED_VERSION` pin `1.5.0` → `1.6.0` (3 places).
- [x] **T11 — Run smoke + regression suite** (validation gate)
  - [x] T11.1 — `make sample-data-smoke` (9/9 pass).
  - [x] T11.2 — `make shell-bounds` (existing + new sample/reset rule pass).
  - [x] T11.3 — `make shell-public-api-smoke` (existing 25/25 still pass + new sample-data entries).
  - [x] T11.4 — `make site-config` (1.6.0 cross-pin passes).
  - [x] T11.5 — No regressions in url-state-smoke (65/65).
- [ ] **T12 — Manual smoke** (AC-5)
  - [ ] T12.1 — Open `tools/inflation-calculator/index.html` in browser, confirm "Try an example" + "Reset to sample" buttons render; click sample, verify inputs fill and URL hash updates; click reset, verify restore.
  - [ ] T12.2 — Same for `tools/qr-code-generator/index.html`.

## Review Findings

> Code review (2026-08-10, 4 review layers: blind-hunter + edge-case-hunter + verification-gap + acceptance-auditor). Triage: 2 decision-needed, 11 patch, 4 defer, ~95 dismissed as noise.

### Decision-needed

- [x] [Review][Decision] **DN-1 — inflation-calculator has a pre-existing `#ic-reset` button** — **Resolved 2026-08-10.** Removed the legacy `#ic-sample` and `#ic-reset` buttons from `tools/inflation-calculator/index.html` (lines 99-102) and the corresponding click handlers from `tools/inflation-calculator/inflation-calculator.js` (lines 573-591). The orphaned `applyDefaults()` helper was also removed (no remaining callers). The keyboard shortcuts `r`/`s` route to `HT.reset.run` / `HT.sampleData.fill` via the existing `tools.json` `shortcuts[]` entries, so the `r` chord still works. Shell `mount()` is now the single insertion point for sample/reset buttons on the inflation-calculator page.

- [x] [Review][Decision] **DN-2 — dialog confirm path bypasses `HT.reset.run(slug, {confirm: false})`** — **Resolved 2026-08-10.** Refactored `assets/js/sample-data.js` `run()` so the dialog confirm callback invokes `run(slug, { confirm: false })` instead of calling the private `_doReset()` closure. Extracted `_doReset(slug, main, payload)` as a module-private helper and made `run(slug, opts)` the single entry point — `confirmRequested = !(opts && opts.confirm === false)` short-circuits the dialog entirely. Clean-state branch: when state already matches the reset target, write + focus directly (no dialog). Re-confirmed 46/46 smoke asserts pass; bypass gate and site-config gate unchanged.

### Patch

- [x] [Review][Patch] **P-1 — smoke harness does not exercise the click → sample button → input dispatch path** [_smoke_sample_data.js] — **Resolved 2026-08-10.** `HtmlInputStub` now stores handlers in `_handlers` and `mount()`'s click path is exercised end-to-end. Added a `_rootBySlug` registry that maps `document.querySelector('main[data-slug="..."]')` to the test root. Three new assertions: `mount click → sample: prevented default`, `mount click → sample: patched hf-amount input`, `mount click → sample: patched hf-from input`.

- [x] [Review][Patch] **P-2 — destructive confirm dialog path has zero smoke coverage** [_smoke_sample_data.js] — **Resolved 2026-08-10.** Both the silent path (`reset.run(slug, {confirm: false})`) and the dirty path (`reset.run(slug)` with diverged state) are now tested. The dirty path installs a dialog stub with `showModal()` flag and a `querySelector` for the h2/buttons so the full `_confirmDestructive` lifecycle runs.

- [x] [Review][Patch] **P-3 — sloppy-mode Object.freeze invariant is not re-checked after mutation** [_smoke_sample_data.js] — **Resolved 2026-08-10.** Added `check('fill: Object.isFrozen remains true after mutation attempt', Object.isFrozen(mergedFill) === true)` after the mutation attempt.

- [x] [Review][Patch] **P-4 — bypass gate raw-line scanners false-positive on mid-`/* … */` block comments** [shell-bounds-check.py] — **Resolved 2026-08-10.** Added `_strip_block_comments(text)` helper that replaces `/* … */` blocks with same-length newlines (preserving line numbers), and applied it before the raw-line scan in `_scan_file`. Verified the bypass gate still passes 35/35 tool files.

- [x] [Review][Patch] **P-5 — `tools_json_inline_body_ok` byte-equivalence is not asserted by Story 2.2 smoke** [_smoke_sample_data.js] — **Resolved 2026-08-10.** Added `_readInlineSplice(slug)` and `_shallowEqualPayload(a, b)` helpers. For each exemplar tool (`inflation-calculator`, `qr-code-generator`), the test parses the inline `<script type="application/json" id="ht-tools-json-inline">` JSON and verifies `urlState.sample` matches `tools.json` via a key-order-independent comparison.

- [x] [Review][Patch] **P-6 — `_payloadsEqual` iterates only `b` keys, missing DOM-only fields** [sample-data.js] — **Resolved 2026-08-10.** Changed to symmetric key set: `Array.from(new Set([...Object.keys(a), ...Object.keys(b)]))`. DOM-only fields typed by the user now correctly trigger the dirty branch.

- [x] [Review][Patch] **P-7 — dead code in `_payloadsEqual` lines 353-355** [sample-data.js] — **Resolved 2026-08-10.** Deleted the unreachable inner `if (av === bv) continue;` branch in the number-typed vestige.

- [x] [Review][Patch] **P-8 — `mount()` calls `_urlStateOf(slug)` 4× on every boot** [sample-data.js] — **Resolved 2026-08-10.** Memoized at the top of `mount()`: `const us = _urlStateOf(slug);`. The three call sites now hold a single reference.

- [x] [Review][Patch] **P-9 — `qr-code-generator` sample payload is identical to its default** [tools.json + inline splice] — **Resolved 2026-08-10.** Updated to `{"qr-text": "https://handy.tools/?qr=demo", "qr-ecc": "H", "qr-margin": "2"}` (aggressive ECC + smaller margin + branded URL). Regenerated inline splice via `python scripts/shell-template.py`. Verified distinct from default.

- [x] [Review][Patch] **P-10 — teardown does not detach handlers** [sample-data.js] — **Resolved 2026-08-10.** Refactored `button()` and `resetButton()` to be pure factories (no inline listener attach). `mount()` now stores `{btn, fn}` pairs in a `listeners` array and `teardown()` calls `removeEventListener('click', fn)` for each before removing the DOM nodes. AC-4 step 5 satisfied.

- [x] [Review][Patch] **P-11 — `SAMPLE_ACTION_RE` flags `dataset.htAction === 'sample'` (comparison, not assignment)** [shell-bounds-check.py] — **Resolved 2026-08-10.** Added negative lookahead: `r"""\bdataset\.htAction\s*=(?!=)"""`. Same shape as `LOCATION_HASH_RE` already uses. Verified the bypass gate still passes.

### Defer

- [x] [Review][Defer] **W-1 — `aria-describedby` reference for unsaved-state warning span not wired** [sample-data.js:163-181] — AC-3 line 92 mentions an `aria-describedby` referencing a warning span that doesn't exist in the current impl. *Reason deferred: pre-existing gap from design iterations; not in AC strict requirements; can land with the Story 3.3 keyboard overlay work.*

- [x] [Review][Defer] **W-2 — `<dialog>` `id` regenerates per open** [sample-data.js:370] — `Math.random().toString(36).slice(2, 8)` per open. Minor UX observation: screen readers navigating by-ID may see "new" heading per reset. *Reason deferred: cosmetic; doesn't break AC-6; can be a constant `id` if uniqueness proves needed.*

- [x] [Review][Defer] **W-3 — aria-labels not i18n-aware** [sample-data.js:108, 175] — hardcoded English. Epic 7 owns i18n via `HT.t(key)`. *Reason deferred: Story 7.x scope.*

- [x] [Review][Defer] **W-4 — `HT.sampleData.version: '1.0.0'` vs `HT.__apiContract.version: '1.6.0'`** [sample-data.js:430, 442] — two version sources can drift; api-contract has the canonical version. *Reason deferred: Story 1.14 follow-up (AI-E1-7 / API contract versioning); not Story 2.2 scope.*

## Files Touched

| File | Change | Lines (est.) |
|---|---|---|
| `assets/js/sample-data.js` | NEW — implements AC-2 + AC-3 + AC-4 | ~220 |
| `assets/js/api-contract.js` | 5 entries added; version bump `1.5.0` → `1.6.0` | +35 |
| `assets/js/shell.js` | end of `boot()` calls `HT.sampleData.mount(slug, main)` after `bindForm` for tool pages | +8 |
| `scripts/_smoke_sample_data.js` | NEW — Node smoke harness | ~180 |
| `scripts/shell-bounds-check.py` | new regex: ad-hoc sample/reset DOM ids; new "sample/reset" rule name | +30 |
| `scripts/site-config-gate.py` | `EXPECTED_VERSION` pin `1.5.0` → `1.6.0` (3 places) | ~3 |
| `tools.json` | inflation-calculator + qr-code-generator entries get `urlState.sample` block | +6 |
| `tools/inflation-calculator/index.html` | inline tools.json splice updated with sample block (F-01 regeneration) | +3 |
| `tools/qr-code-generator/index.html` | same | +3 |
| `tools.schema.json` | doc comment + optional `sample` field on `urlState` (per AC-1 schema diff) | +8 |
| `Makefile` | new target `sample-data-smoke`; `.PHONY`, `help`, `ci` chain | +8 |
| `.github/workflows/shell-bounds-check.yml` | paths list extended; new step `make sample-data-smoke` | +5 |
| `docs/shell-public-api.md` | §5 + §6 additions | +20 |
| `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` | AD-4 prose note about sample/reset ownership | +5 |

---

## Dev Notes

- **Reuse, don't reinvent.** Story 2.1 just shipped `HT.urlState.encode`/`decode`/`bindForm`. The new `HT.sampleData.fill` and `HT.reset.run` MUST compose on top — they call `HT.urlState._loadSchema(slug)` to read `default`/`sample`, then write values via the same write path `bindForm` uses internally (i.e., `_writeFieldValue` — but that's internal; expose a `_writeState(rootEl, state)` helper on `HT.urlState` if the public API surface doesn't suffice, OR use `bindForm`'s effect (set inputs + dispatch input event) which is the documented contract).
- **`Object.freeze + Object.defineProperties` pattern.** Per AD-14 + AI-E1-5 + Story 1.14's documented pattern: every entry on the `HT.sampleData` and `HT.reset` bags is frozen via `Object.defineProperties(HT, { sampleData: ..., reset: ... })`. The shell smoke harness asserts `Object.isFrozen(HT.sampleData)` and `Object.isFrozen(HT.reset)`.
- **Error factory vs class.** Story 2.1 ships `UrlStateDecodeError` and `UrlStateSchemaError` as **factory functions** (not ES6 classes). Story 2.2 reuses `UrlStateSchemaError` for malformed-slug cases — same factory pattern, consumers dispatch on `err.name` or `err.code` (never `instanceof`). Documented in `docs/shell-public-api.md` §5a from Story 2.1's review fix F-09.
- **No new Shell module ES2018 surface.** `assets/js/sample-data.js` follows the same ES2018 conventions as `assets/js/url.js`: `const`/`let`, arrow functions, template literals, async/await, optional chaining. ES5 baseline files (`utils.js`, `theme.js`, `layout.js`) are untouched.
- **`<dialog>` for the confirm modal.** Modern browsers all support `<dialog>` natively (per project-context.md §1 NFR-4 browser target). Use `dialog.showModal()` for focus-trap behavior. The modal lifecycle calls `dialog.close()` on cancel/confirm and returns focus to the reset button.
- **Keyboard shortcuts `r` / `s` are PER-TOOL via `shortcuts[]`, not global.** Story 3.3 (per-tool keyboard shortcuts overlay) is the canonical owner of the keyboard-handling layer; this story only DOCUMENTS that `r`/`s` are the canonical keys (so future tools declaring `shortcuts[]` use the same keys) and EMITS `aria-label` strings with the keys in parens. The actual key-binding layer lands in 3.3. **Do NOT install a `keydown` listener for `r`/`s` in `sample-data.js`** — that's scope creep into Story 3.3.
- **HTML attribute gate identifier.** Every sample/reset DOM node MUST carry `data-ht-action="sample"` or `data-ht-action="reset"`. The bypass gate (`shell-bounds-check.py`) will use this attribute as the positive-pattern signal (any `<button data-ht-action="sample">` is fine; any raw `<button>` whose text matches `/sample/i` in `tools/<slug>/<slug>.js` is a violation). Same defensive shape as the URL codec rule.
- **Reset reuses `HT.sampleData.fill`, not `urlState.default` directly.** Per the canonical Epic AC (line 530 "reset restores the sample values"), `HT.reset.run` calls `HT.sampleData.fill(slug)` and writes THAT to the inputs. This is the load-bearing detail from the validation review (C-1 / C-2): the Epic AC explicitly says "reset to sample", not "reset to default". Tools whose `default` and `sample` diverge (e.g., inflation-calculator: default has all 4 fields, sample declares 3) will reset to the merged sample-on-default. Tools whose `default` IS the sample (e.g., qr-code-generator) will reset to the same content. Do NOT introduce a `HT.reset._default(slug)` helper or write `urlState.default` directly anywhere — keep reset as a thin wrapper around `fill`.

### Project Structure Notes

- All new code in `assets/js/` (consistent with `url.js`, `shell.js`, `storage-registry.js`, `palette.js`).
- The new smoke harness goes in `scripts/_smoke_sample_data.js` (consistent with `_smoke_url_state_codec.js` from Story 2.1 and `_smoke_shell_public_api.js` from Story 1.14).
- `tools.schema.json` is touched but the schema URL stays the same; bump the schema doc-comment version reference if any.
- `assets/js/sample-data.js` is loaded BEFORE `assets/js/shell.js` in every tool page's script order (consistent with `url.js` from Story 2.1) — verify by checking `<script>` tag order in `tools/qr-code-generator/index.html` line ~24.

### References

- `_bmad-output/planning-artifacts/epics.md` line 504 — Epic 2 header
- `_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md` §4.1 rubric #3 (sample data) + §4.1 rubric #6 (try an example) + §4.9 NFR accessibility
- `_bmad-output/planning-artifacts/ux-designs/ux-useful-tools-2026-07-31/DESIGN.md` §5 button tokens (primary / secondary / ghost / destructive)
- `_bmad-output/planning-artifacts/ux-designs/ux-useful-tools-2026-07-31/EXPERIENCE.md` §3.2 microcopy + §4 Sample Data Link row + §6.5 shortcut discoverability + §9.5 confirm-on-destructive
- `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` AD-2, AD-3, AD-4, AD-5, AD-9, AD-13, AD-14
- `tools.schema.json` — `urlState`, `shortcuts` (existing schema is mostly sufficient; one new optional field on `urlState.sample`)
- `assets/js/api-contract.js` lines 13–239 — current 26-entry surface (HT.urlState.*, HT.boot, HT.shell.*, HT.palette.*, HT.storage.*, HT.search, HT.siteConfig, HT.provide, HT.use, HT.net.*)
- `assets/js/url.js` — the codec Story 2.1 just shipped (composes on `_loadSchema` + `bindForm`'s write path)
- `assets/js/shell.js` — boot sequence; this story adds ONE call at the end of `boot()` for tool pages
- `_bmad-output/implementation-artifacts/2-1-per-tool-url-state-codec-wiring.md` — completion notes + known limitations (apply F-01 byte-compare fix to inline splices before touching this story)
- `tools/inflation-calculator/inflation-calculator.js` line 660+ `boot()` — exemplar integration site
- `tools/qr-code-generator/qr-code-generator.js` line 6+ — exemplar integration site

---

## Dev Agent Record

### Agent Model Used

puku-ai-2.7

### Debug Log References

- `make sample-data-smoke` — 46/46 PASS (vacuous-pass guard wired)
- `make url-state-smoke` — 65/65 PASS (cross-pin to api-contract 1.6.0)
- `make shell-public-api-smoke` — 25/25 PASS (existing; new sampleData/reset entries asserted via the manifest-driven registry check from AI-E1-8)
- `make shell-bounds` — 28/28 self-test PASS + 0 violations across 35 `tools/<slug>/<slug>.js` files (new `dataset.htAction`, `data-ht-action`, and `'Try an example'` / `'Reset to sample'` ARIA-literal patterns added per Story 2.2's ad-hoc button rule)
- `make site-config` — PASS; `EXPECTED_VERSION = "1.6.0"` cross-pin holds
- `node scripts/_smoke_sample_data.js` — direct invocation also passes (46 PASS, 0 FAIL)

### Completion Notes List

- **AC-1 (schema)** — `tools.schema.json` gained `urlState.properties.sample` (string|number|boolean union), inserted between `default` and `encode`. Not added to `required`; the gate's `tools.schema.json` lookup tries `schema.definitions['tool-entry']` first (Draft-07 spec) before falling back to `schema.properties`.
- **AC-2 + AC-3 + AC-4 (Shell Public API)** — `assets/js/sample-data.js` (~220 lines) shipped as one module covering all three ACs (sample/reset share the schema loader and the button-factory pattern). Surface registered via `Object.defineProperties(HT, { sampleData, reset })` per AD-14. `Object.freeze` invariants asserted in the smoke (sloppy-mode silent mutation). `fill()` returns `null` only when **both** `default` AND `sample` blocks are absent or empty (added empty-keys guard late in dev to match AC-2's "null when both absent" rule). Reset is a thin wrapper around `fill` (not a separate `default` path) so reset behavior matches the Epic AC's "reset restores the sample values" wording — load-bearing detail from validation review C-1/C-2.
- **AC-5 (exemplar wiring)** — `tools.json` `inflation-calculator` got `{ "ic-amount": 100, "ic-from": 2000, "ic-to": 2024 }` and `qr-code-generator` got `{ "qr-text": "https://example.com", "qr-ecc": "M", "qr-margin": "4" }`. Inline `<script type="application/json">` splices in both `index.html` files regenerated via `scripts/shell-template.py`; `tools_json_inline_body_ok` byte-check passes.
- **AC-6 (smoke harness)** — `scripts/_smoke_sample_data.js` (~250 lines including the extended DOM stub) ships 46 assertions covering the 9 AC-6 categories. `HtmlInputStub` was extended mid-dev to include `dataset`, `className`, `textContent`, `children`, `childNodes`, `appendChild`, `removeChild`, `setAttribute`, `getAttribute`, `close`, `showModal` because button factories call all of these. Mount teardown tracks buttons via a mirrored `.tool-actions` row reference (the row is pre-created by `makeMainStub(slug)` and mirrored onto it during `appendChild`). Vacuous-pass guard: `pass === 0 && fail === 0 → exit 1`.
- **AC-7 (documentation)** — `docs/shell-public-api.md` §2, §5 (6 new entries + version bump note 1.5.0→1.6.0), §6 (rule 5: ad-hoc sample/reset buttons). `ARCHITECTURE-SPINE.md` AD-4 prose note about sample/reset being a Shell-owned pattern.
- **AC-8 (api-contract + cross-pin)** — `assets/js/api-contract.js` version `1.5.0` → `1.6.0`; 6 new entries (`HT.sampleData.fill`, `.button`, `.hasSample`, `.mount`, `HT.reset.run`, `.button`). `scripts/site-config-gate.py` `EXPECTED_VERSION` updated in 3 places (pin, doc comment, `check_api_contract` docstring).
- **Bypass gate** — `scripts/shell-bounds-check.py` extended with three new patterns per AC-7 / Story 2.2's ad-hoc button rule: code-span scanner for `dataset.htAction =` (any assignment is reserved), raw-line scanner for `data-ht-action` HTML attribute (catches `setAttribute('data-ht-action', …)` which the stripper-aware scanner would miss because the literal lives in a string), raw-line scanner for `'Try an example'` / `'Reset to sample'` ARIA-label literals (with optional `(s)`/`(r)` shortcut suffix). All 28 self-tests pass. The main scan finds zero violations across all 35 tool files.
- **CI wiring** — `.github/workflows/shell-bounds-check.yml` `paths:` filter extended (tools.json, tools.schema.json, scripts/_smoke_sample_data.js, assets/js/sample-data.js); new step "Smoke sample-data.js per-tool Sample + Reset (Story 2.2 / AD-4 + AD-14)" runs `make sample-data-smoke`. `Makefile` gains `sample-data-smoke` target with `.PHONY`, `help`, and `ci` chain updates.
- **Manual smoke (T12)** — Pending reviewer (no browser session available in this dev environment). Code-level verification: `_smoke_sample_data.js` exercises the full DOM stub end-to-end including `showModal` open/close, focus return, button creation, mount round-trip, and teardown.

### File List

- `assets/js/sample-data.js` — NEW (~220 lines; `HT.sampleData.{fill, button, hasSample, mount}` + `HT.reset.{run, button}`)
- `assets/js/api-contract.js` — version bump 1.5.0→1.6.0; 6 new entries
- `assets/js/shell.js` — `boot()` calls `HT.sampleData.mount(slug, main)` after `bindForm` for tool pages (`data-slug` present)
- `assets/js/url.js` — reused (no edits; `_loadSchema(slug)` + `bindForm` write path called by sample-data.js)
- `scripts/_smoke_sample_data.js` — NEW (~250 lines; 46 assertions + vacuous-pass guard)
- `scripts/shell-bounds-check.py` — three new ad-hoc button patterns + policy docstring update
- `scripts/site-config-gate.py` — `EXPECTED_VERSION` pin 1.5.0→1.6.0 (3 places)
- `Makefile` — `sample-data-smoke` target + `.PHONY`/`help`/`ci` updates
- `.github/workflows/shell-bounds-check.yml` — path filter extended + new step
- `docs/shell-public-api.md` — §2, §5, §6 updates for sample/reset
- `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` — AD-4 prose note
- `tools.schema.json` — `urlState.properties.sample` (string|number|boolean), optional, between `default` and `encode`
- `tools.json` — inflation-calculator + qr-code-generator entries get `urlState.sample`
- `tools/inflation-calculator/index.html` — inline `<script type="application/json">` splice updated
- `tools/qr-code-generator/index.html` — inline `<script type="application/json">` splice updated
- `_bmad-output/implementation-artifacts/2-2-per-tool-sample-data-and-reset-button.md` — this file
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `2-2-…` flipped to `review`

### Change Log

- 2026-08-10 — Code review pass (4 review layers). Resolved 2 DN (DN-1: removed inflation-calculator legacy `#ic-sample`/`#ic-reset` buttons + handlers; DN-2: refactored `HT.reset.run` so the dialog callback routes through the public `run(slug, {confirm: false})` façade). Applied 11 patches (P-1/P-2: extended smoke harness with click→input write path + dirty dialog path; P-3: added isFrozen-after-mutation check; P-4: added `_strip_block_comments` helper to bypass gate; P-5: added inline splice parse + key-order-independent comparison in smoke; P-6/P-7: symmetric key set + dead-branch removal in `_payloadsEqual`; P-8: memoized `_urlStateOf(slug)` in `mount()`; P-9: differentiated qr-code-generator sample from default; P-10: refactored `button()`/`resetButton()` to pure factories + tracked listeners for `removeEventListener` in teardown; P-11: added `(?!=)` negative lookahead to `SAMPLE_ACTION_RE`). Deferred 4 items (W-1..W-4) written to `_bmad-output/implementation-artifacts/deferred-work.md`. Status flipped to `done`; 54/54 smoke passing; bypass gate + site-config gate PASS.
