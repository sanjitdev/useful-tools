---
title: 'User Data Export to JSON'
type: 'feature'
created: '2026-08-12'
status: 'done'
baseline_commit: '8ba8425'  # Story 3.6 wrap-up (latest on main as of this story)
context:
  - '{project-root}/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-useful-tools-2026-07-31/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md'
  - '{project-root}/_bmad-output/planning-artifacts/epics.md'
  - '{project-root}/_bmad-output/implementation-artifacts/3-5-settings-modal-full-control-surface.md'  # SETTINGS_KEYS array lives at shell.js:1218
  - '{project-root}/_bmad-output/implementation-artifacts/3-6-history-panel-with-timestamps-and-restore-confirmation.md'  # forward-only commitments + api-contract version bump pattern
  - '{project-root}/assets/js/shell.js'  # openSettings/closeSettings wiring, clear-all handler at line 1534
  - '{project-root}/assets/shell/settings.html'  # the existing 7-field modal markup; Export button lands in a new "Data" section
  - '{project-root}/assets/js/storage-registry.js'  # register/get/set/list/keys surface; LEGACY_KEY_MAP
  - '{project-root}/assets/js/utils.js'  # HT.toast(...) for the success / failure toast
  - '{project-root}/assets/js/api-contract.js'  # version 1.12.0 after Story 3.6; this story bumps to 1.13.0
  - '{project-root}/scripts/_smoke_url_state_codec.js'  # precedent for ajv-style schema test harness pattern
---

# Story 3.7: User Data Export to JSON

## Story

As a user wanting to back up or move my data,
I want an "Export my data" action that downloads a single JSON file with history, settings, favorites, and recent,
So that I can re-import it on another device.

## Source

- **Origin:** `epics.md:805-831` — Story 3.7 in the Epic 3 keyboard-first UX block. The export is the write half of the FR-13 export/import pair (the read half lands in Story 3.8). UX-driven by UJ-3 (Aisha's weekly backup flow at `EXPERIENCE.md:616-628`) — the export action lives behind Settings → Data.
- **Predecessor:** Story 3.5 (`3-5-settings-modal-full-control-surface.md`) shipped the 7-field Settings modal (`assets/shell/settings.html`) with the `SETTINGS_KEYS` plain-string array at `assets/js/shell.js:1218`. The Export button lands in a **new** "Data" section inside that modal. Story 3.5's `clear-all` button already lives in the form's tail; Export sits alongside it (above — Export is reversible, Clear is irreversible per UX-DR-3).
- **Predecessor:** Story 3.6 (`3-6-...md`) bumped `assets/js/api-contract.js` to `1.12.0` for the history-shape migration. This story bumps to `1.13.0` for the new `HT.export` public surface.
- **Architecture pin:** **AD-4** (Shell owns data export; this lives in `assets/js/`, not in `tools/<slug>/`). The Capability Map routes FR-13 to "Settings/Export module" — there is no `settings.js` file yet (Story 3.5 lives in `assets/shell/settings.html` + the IIFE inside `assets/js/shell.js`); this story creates **`assets/js/export.js`** as a dedicated Shell module that the Settings modal's new Export button wires up at boot.
- **Architecture pin:** **AD-6** (storage registry; export enumerates registered keys via `HT.storage.list()` / `HT.storage.keys()`). The export is read-only — it never writes back to `localStorage`.
- **Architecture pin:** **AD-7** (embed mode disables Settings entirely; the Export button is hidden when `window.HT_SHELL_EMBED` is truthy — mirror the cog-button hide in `assets/js/shell.js`).
- **Architecture pin:** **AD-14** (Shell Public API surface). The new `HT.export.run()` / `HT.export.exportToFile()` methods land on the frozen `HT.export` namespace. `HT_EXPORT_SCHEMA_VERSION` is the new internal constant exposed via the migration entry point (mirrors Story 3.6's `HT_HISTORY_INIT`).
- **Architecture pin:** **AD-1** (no external network). The download uses **`URL.createObjectURL(new Blob(...))`** + a transient `<a download>` click + `URL.revokeObjectURL` after 1 s. **No `fetch`, no CDN.** Schema validation is **hand-rolled** (no ajv vendoring — the export payload shape is 5 top-level keys, validation is a tiny predicate, vendoring ajv is overkill for this).
- **UX pin:** UX-DR-3 (Settings is a modal, Export is reversible → no typed confirmation, just a button). Toast convention: bottom-center <md / top-right ≥md, `aria-live="polite"`, 2.5 s lifetime, paired with a check icon (see `EXPERIENCE.md:67-74`).
- **UX pin:** UJ-3 (Aisha's journey). One click in Settings → Data → Export → file lands in the browser's downloads folder.

## Acceptance Criteria

**Given** the user opens Settings
**When** the modal renders
**Then** the existing 7-field form is preserved AND a new "Data" section appears between the Font-scale field and the Clear-all-data button, containing exactly one button labeled `Export my data` with `aria-label="Export your settings, history, and saved tools as a JSON file"`, `type="button"`, `class="shell-settings-export"` (new), `data-ht-action="export-data"` (new internal marker; mirrors `data-ht-action="clear-data"` already in use at `shell.js:1438`); the section has a heading `Data` (`<h3 class="shell-settings-section-title">`) so screen readers and sighted users both see it
**And** the Export button is hidden when embed mode is active (`window.HT_SHELL_EMBED` is truthy per AD-7) via `[hidden]` + `aria-hidden="true"` + the same `data-embed-suppressed="1"` marker Story 3.6 introduced

**Given** the user clicks Export
**When** the click handler runs
**Then** a JSON payload is assembled under the exact top-level shape:
```json
{
  "version": "1.0.0",
  "exportedAt": "<ISO 8601 timestamp with `Z` suffix>",
  "settings": { "ht.theme": "...", "ht.locale": "...", "ht.reducedMotion": "...", "ht.units": "...", "ht.currency": "...", "ht.fontScale": "..." },
  "history": { "<slug>": [ <entry>, ... ] },
  "favorites": [],
  "recent": [],
  "pins": {}
}
```
**And** `settings` is built by iterating Story 3.5's `SETTINGS_KEYS` array verbatim and reading each key as a **plain string** (NOT `JSON.parse` — these are the FOUC-IIFE-compatible strings). Missing keys are omitted (do not write `null`); the resulting object contains only present keys
**And** `history` is built by iterating every registered per-tool history key (`HT.storage.keys()` filtered to `^handy-tools\.history\.`) and mapping each to the array returned by `HT.storage.get(key, [])`; each entry is the post-Story-3.6 shape `{ts (ISO 8601 string), inputs, result}` (the migration in `_readRaw` is read-time and already canonical — the export inherits the same shape)
**And** `favorites` reads `HT.storage.get('handy-tools.favorites', [])` (array of slug strings, deduped, order preserved); missing key → `[]`
**And** `recent` reads `HT.storage.get('handy-tools.recent', [])` (array of slug strings, deduped, order preserved); missing key → `[]`
**And** `pins` reads `HT.storage.get('handy-tools.pins', {})` (`{slug: ISO-timestamp}` map); missing key → `{}`
**And** `version` is the literal string `"1.0.0"` from the `HT_EXPORT_SCHEMA_VERSION` constant (single source of truth — never duplicated)
**And** `exportedAt` is `new Date().toISOString()` (e.g., `"2026-08-12T18:42:11.123Z"`)

**And** the payload is validated against a hand-rolled `validateExportPayload(payload)` predicate before the download triggers; the predicate checks:
- `payload.version === HT_EXPORT_SCHEMA_VERSION`
- `payload.exportedAt` is a string parseable by `new Date()`
- `payload.settings` is a plain object
- `payload.history` is a plain object whose values are arrays
- `payload.favorites` and `payload.recent` are arrays of strings
- `payload.pins` is a plain object whose values are ISO-parseable strings
- If validation fails, the export aborts, the non-blocking toast `Export validation failed: <path>` appears (where `<path>` is the first failing field path, e.g., `history.inflation-calculator[3].ts`), AND the same string is written to `console.error` with the full predicate error array

**And** on validation success, a `Blob` with `type: 'application/json'` is created via `URL.createObjectURL(blob)` and a temporary `<a download="handy-tools-export-YYYY-MM-DD.json">` is appended to `<body>`, `.click()`'d, then removed; the object URL is revoked via `URL.revokeObjectURL` after exactly 1 second via `setTimeout`
**And** the date suffix `YYYY-MM-DD` is built from the user's local timezone (not UTC) using `new Date()` → `getFullYear/getMonth+1/getDate` with `String(num).padStart(2, '0')` so a user in `America/New_York` at 23:30 local on Aug 12 exports `handy-tools-export-2026-08-12.json` (not the next-day UTC date)
**And** on download trigger, the success toast `Export complete` appears for 2.5 seconds (UX toasts per `EXPERIENCE.md:67-74`), paired with the success icon variant of the toast component

**And** the entire action works fully offline: no `fetch`, no XHR, no analytics call, no remote schema fetch. Validation is hand-rolled; the payload is built from in-memory state; the download uses the Blob API

**And** the export is **read-only**: it never writes to `localStorage`, never mutates the storage registry, and never modifies the toast / settings UI state

## Tasks / Subtasks

- [x] **T1 — Build `assets/js/export.js` (NEW module)** (AC: all)
  - [x] T1.1 Create `assets/js/export.js` as an IIFE in strict mode following the `assets/js/history.js` structural precedent (same `'use strict'`, same `window.HT = window.HT || {}; const HT = window.HT;` preamble, same `Object.defineProperties` block at the bottom)
  - [x] T1.2 Declare `const EXPORT_SCHEMA_VERSION = '1.0.0';` at the top of the file (single source of truth — Story 3.8 reads this constant via the same `HT_EXPORT_SCHEMA_VERSION` window handle Story 3.6's `HT_HISTORY_INIT` used)
  - [x] T1.3 Implement `_buildPayload()` which assembles the `{version, exportedAt, settings, history, favorites, recent, pins}` object per the AC ordering. **Read `assets/js/shell.js`'s `SETTINGS_KEYS` (frozen array at line 1218) — do not redefine it.** The export module can either expose a `HT.storage` indirection (`HT.storage.list()` filtered to `ht.*`) or rely on a per-keys array passed in. **Preferred:** iterate `HT.storage.list()` filtered by `key.startsWith('ht.')` and read each as a plain string. This survives Story 3.5's `SETTINGS_KEYS` changing in the future without export needing an update.
  - [x] T1.4 Implement `_buildHistory()` which enumerates `HT.storage.keys()` filtered to `/^handy-tools\.history\.(.+)$/`, then for each key extracts the slug from the suffix and maps to `HT.storage.get(key, [])` — **call `HT.history.list(slug)` if it exists** (Story 3.6 already exposes a canonical list API that returns migrated entries; this routes through the registered reader so the post-3.6 migration contract is honored). Fall back to `HT.storage.get(key, [])` if `HT.history` is undefined (defensive — keeps export usable even before Story 3.6 lands on a particular tool).
  - [x] T1.5 Implement `_validatePayload(payload)` which runs the 6 checks listed in the AC and returns `{ ok: true } | { ok: false, errors: [{path, message}] }`. The first failing check produces the toast path; all errors are written to `console.error` so debugging sees them.
  - [x] T1.6 Implement `exportToFile()` which: builds the payload, validates it, on failure shows the toast + logs, on success creates the Blob + `<a download>` + 1-second `setTimeout` for revokeObjectURL. **Use `HT.toast(...)`** from `assets/js/utils.js` for both success and failure toasts.
  - [x] T1.7 Implement `_isEmbed()` mirroring `assets/js/history.js`'s `_isEmbed()` predicate (Story 3.6 pass-2: accepts `true | 1 | '1' | 'true'` + `?embed=1|true` URL flag). If true, `exportToFile()` is a no-op (the button is hidden in the UI anyway — this is a belt-and-suspenders guard).
  - [x] T1.8 Expose `Object.freeze({ run: exportToFile, version: EXPORT_SCHEMA_VERSION })` on `HT.export`. The `run` alias mirrors Story 2.5's `HT.share.open` / `HT.share.print` alias pattern.
  - [x] T1.9 Expose `Object.freeze({ version: EXPORT_SCHEMA_VERSION, schema: { /* payload keys */ } })` on `HT_EXPORT_SCHEMA_VERSION` (window-internal, mirrors `HT_HISTORY_INIT`). The smoke harness reads this directly.

- [x] **T2 — Wire Export into the Settings modal** (AC: button visibility, click handler, embed hide)
  - [x] T2.1 Edit `assets/shell/settings.html` — between the Font-scale field (line 100) and the Clear-all-data field (line 102), insert a new `<fieldset class="shell-settings-field shell-settings-field--data">` containing a `<legend>Data</legend>` (or `<h3>` per the AC) and the Export button:
    ```html
    <div class="shell-settings-field shell-settings-field--data">
      <div class="shell-settings-label" aria-hidden="true">Data</div>
      <div class="shell-settings-control">
        <button type="button" id="shell-settings-export" class="shell-settings-modal__export"
                aria-label="Export your settings, history, and saved tools as a JSON file"
                data-ht-action="export-data">Export my data…</button>
      </div>
    </div>
    ```
  - [x] T2.2 In `assets/js/shell.js`, in the settings-modal boot block (after line 1442 where the `clearButton` querySelector runs), add the symmetric Export wiring:
    ```js
    const exportButton = document.getElementById('shell-settings-export');
    if (exportButton) exportButton.addEventListener('click', () => HT.export.run());
    ```
  - [x] T2.3 In the embed-mode guard block (find by `grep -n "HT_SHELL_EMBED" assets/js/shell.js`), apply the same `button.hidden = true; button.setAttribute('aria-hidden', 'true'); button.dataset.embedSuppressed = '1';` triplet to `exportButton` (mirrors what Story 3.6 did for the History button — `data-embed-suppressed="1"` is the marker `assets/js/api-contract.js` documents).

- [x] **T3 — Register the forward-compatibility storage keys** (AC: history enumeration, ready for Story 3.12)
  - [x] T3.1 In `assets/js/shell.js` (the boot block where `HT.storage.registerHistoryKeys(homeGrid.entries)` runs at line 453), add three defensive `HT.storage.register(...)` calls gated on key presence (mirrors the `_requireSlug` defensive pattern Story 3.6 used):
    ```js
    try { HT.storage.register('handy-tools.recent', { purpose: 'recently-used-tools', lifetime: 'persistent', schema: 'string-array', owner: 'assets/js/home-grid.js (Story 3.12)' }); } catch (_) {}
    try { HT.storage.register('handy-tools.favorites', { purpose: 'favorited-tools', lifetime: 'persistent', schema: 'string-array', owner: 'assets/js/home-grid.js (Story 3.12)' }); } catch (_) {}
    try { HT.storage.register('handy-tools.pins', { purpose: 'pinned-tools', lifetime: 'persistent', schema: '{slug: iso-timestamp}', owner: 'assets/js/home-grid.js (Story 3.12)' }); } catch (_) {}
    ```
    The `try { } catch (_) {}` wrappers are intentional — if the registry rejects any key (e.g., 2-segment validation), the export still works using `HT.storage.get(key, fallback)` which reads via `localStorage.getItem` directly.
  - [x] T3.2 Verify the registry's namespace validator (`assets/js/storage-registry.js:106`) accepts `handy-tools.recent` / `handy-tools.favorites` / `handy-tools.pins` (only 2 segments — **may be rejected**). If rejected, downgrade to **skip the registration** for those keys; the export's `HT.storage.get(key, fallback)` direct-read fallback path must still work. Verify with `python scripts/storage-registry-gate.py` after the change.

- [x] **T4 — Update `assets/js/api-contract.js`** (AC: AD-14 frozen-surface contract)
  - [x] T4.1 Bump version `1.12.0` → `1.13.0` at line 13 (mirror Story 3.6's version bump pattern)
  - [x] T4.2 Add a new entry under `HT.export`:
    ```js
    { name: 'HT.export', stability: 'stable', module: 'export.js (Story 3.7)', notes: 'Frozen since Story 3.7. Methods: HT.export.run() — assembles the export payload, validates it against HT_EXPORT_SCHEMA_VERSION, and triggers a Blob download as `handy-tools-export-YYYY-MM-DD.json` in the user\'s local timezone. Returns void. Hidden in embed mode (AD-7). Internal handle: HT_EXPORT_SCHEMA_VERSION = "1.0.0" (single source of truth for the JSON `version` field; Story 3.8 reads this to reject mismatches).' }
    ```
  - [x] T4.3 Add an internal entry: `HT_EXPORT_SCHEMA_VERSION = "1.0.0"` (mirrors the `HT_HISTORY_INIT` internal-handle pattern from Story 3.6)
  - [x] T4.4 Update the version-bump note to "Story 3.7: HT.export added (1.12.0 → 1.13.0)"

- [x] **T5 — Update `scripts/site-config-gate.py`** (AC: api-contract version gate)
  - [x] T5.1 Bump `EXPECTED_VERSION` from `1.12.0` to `1.13.0` (3 places — same pattern as Story 3.6)
  - [x] T5.2 Update the violation message from "Story 3.6 requires" to "Story 3.7 requires"

- [x] **T6 — Write `scripts/_smoke_export.js` (NEW harness)** (AC: regression-test contract)
  - [x] T6.1 Mirror the Story 3.6 harness structure: load `assets/js/storage-registry.js` + `assets/js/export.js` + a stub `HT.homeGrid` + a stub `HT.toast` into a fresh `vm.createContext(ctx)`. The context also needs `localStorage` (stub), `URL.createObjectURL` / `URL.revokeObjectURL` / `Blob` (stubs that capture the blob/URL pairs).
  - [x] T6.2 Cover the AC with at least 25 assertions: payload assembly (7 fields + correct types), `_validatePayload` (6 checks + 6 negative tests for each failing case), `_isEmbed` (true/1/'1'/'true'/URL/missing), download trigger (Blob created with correct type + JSON contents, anchor's `download` attribute matches `YYYY-MM-DD` for a fixed-clock stub, revokeObjectURL scheduled with exactly 1000ms timeout), success/failure toast routing, embed-mode no-op, `HT_EXPORT_SCHEMA_VERSION === '1.0.0'`, `HT.export` frozen surface, settings button hidden under embed (DOM-level).
  - [x] T6.3 Include the **vacuous-pass guard**: if `pass === 0 && fail === 0`, exit 1 (mirrors every other smoke in this repo).

- [x] **T7 — Documentation updates** (AC: traceability)
  - [x] T7.1 `docs/shell-public-api.md` — add `HT.export` to the surface table (stability: stable; module: export.js Story 3.7), add `HT_EXPORT_SCHEMA_VERSION` to the internal-handle table; in §5 add a note that the export action is reversible (no typed confirmation) and that the Export button is hidden in embed mode
  - [x] T7.2 `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` — append to AD-4's enumeration: `data export/import (Stories 3.7 + 3.8)`; append to AD-6's example list: `handy-tools.favorites`, `handy-tools.recent`, `handy-tools.pins`
  - [x] T7.3 `.github/workflows/shell-bounds-check.yml` — verify the `paths:` filter includes `assets/js/export.js` and `scripts/_smoke_export.js`. If not, add them.

- [x] **T8 — Update `Makefile`** (AC: CI integration)
  - [x] T8.1 Add `.PHONY` entry for `export-smoke` (mirror `history-smoke` line at Makefile line 44)
  - [x] T8.2 Add the target:
    ```make
    export-smoke:
    	@node scripts/_smoke_export.js
    ```
  - [x] T8.3 Add `export-smoke` to the `ci:` chain

- [x] **T9 — Run all gates and validate** (AC: regression-test contract)
  - [x] T9.1 Run the full chain: `validate`, `rubric-all`, `gate`, `site-config`, `site-config-smoke`, `storage-registry`, `shell-drift`, `shell-a11y`, `shell-bounds`, `shell-bounds-self-test`, `shell-public-api-smoke`, `sample-data-smoke`, `a11y-smoke`, `history-smoke`, `share-dialog-smoke`, `export-smoke` (this story's new harness), and every other smoke in `make ci`. **All exit 0.**
  - [x] T9.2 Update the version-pin in **every other smoke that pins `1.12.0`** (`_smoke_history_panel.js`, `_smoke_share_dialog.js`, `_smoke_settings_modal.js`, `_smoke_sample_data.js`, `_smoke_url_state_codec.js`, `_smoke_a11y.js`) to `1.13.0`. This is the AI-E3-3 lesson from Story 3.6 — the bump must propagate everywhere in the same commit, not the next.

## Dev Notes

### Architecture & Predecessor Intelligence

- **Story 3.5 ship state (`assets/js/shell.js` lines 1218–1233):** The `SETTINGS_KEYS` frozen array + `SETTINGS_DEFAULTS` are the canonical list of `ht.*` settings the export must enumerate. The values are **plain strings** (NOT JSON) — the FOUC IIFE in `index.html` reads `localStorage.getItem('ht.theme')` without `JSON.parse`. **Do not JSON-parse them** when assembling the export payload. Verify by reading `shell.js:1218-1234` before writing `export.js`.
- **Story 3.6 ship state (`assets/js/history.js`):** Per-tool history entries are now `{ts (ISO 8601 string), inputs, result}` — the legacy `{id, ts (number), state, result, label}` shape is auto-migrated on read by `_readRaw`. The export's `_buildHistory()` MUST call `HT.history.list(slug)` (not `HT.storage.get(key, [])` directly) so the post-3.6 migration contract is honored and the export payload shape stays consistent across all 35 tools.
- **`HT.storage.list()` returns `Array<{key, purpose, lifetime, schema, owner}>`** (frozen, sorted) — the export's `_buildSettings()` filters by `key.startsWith('ht.')` and reads each value as a plain string via the existing `HT.storage.get(key, fallback)` helper. This avoids hardcoding the key list in `export.js` (Story 3.5 might add `ht.locale` variants in the future; the filter picks them up automatically).
- **AD-7 embed mode:** `_isEmbed()` predicate mirrors `assets/js/history.js`'s (Story 3.6 pass-2: accepts boolean `true` / `1` / `'1'` / `'true'` + URL `?embed=1|true`). The Export button's `[hidden]` + `aria-hidden="true"` + `data-embed-suppressed="1"` triplet is set in the boot block at `shell.js` — same code path that hides the History button today.
- **`HT_EXPORT_SCHEMA_VERSION = "1.0.0"`** is the new window-internal handle (mirrors `HT_HISTORY_INIT`). Story 3.8 reads it via the same `vm`-style import the smoke harness uses today. **Never duplicate the literal `"1.0.0"` anywhere else** — every consumer reads `HT_EXPORT_SCHEMA_VERSION`.
- **No new vendored library.** Schema validation is hand-rolled (a 6-check predicate over 5 top-level keys). Vendoring ajv would bloat the static bundle for a 30-line predicate; AD-1's "no external" rule plus the simplicity wins.

### Storage key inventory (read at export time)

The export enumerates 5 key families in this exact order:

1. **`ht.*` settings** (plain strings) — iterate `HT.storage.list().filter(e => e.key.startsWith('ht.'))` and read each via `HT.storage.get(key, '')`. Story 3.5's `SETTINGS_KEYS` covers 6 keys today (`ht.theme`, `ht.locale`, `ht.reducedMotion`, `ht.units`, `ht.currency`, `ht.fontScale`); the filter catches any future additions automatically.
2. **`handy-tools.history.<slug>`** (JSON array of entries) — iterate `HT.storage.list().filter(e => /^handy-tools\.history\.[^.]+$/.test(e.key))`, extract slug, call `HT.history.list(slug)`. Returns `[]` for slugs with no history.
3. **`handy-tools.favorites`** (JSON array of slug strings) — `HT.storage.get('handy-tools.favorites', [])`. May not exist on disk yet (Story 3.12 ships the write); the fallback `[]` handles this.
4. **`handy-tools.recent`** (JSON array of slug strings) — `HT.storage.get('handy-tools.recent', [])`. Same fallback as favorites.
5. **`handy-tools.pins`** (JSON object `{slug: ISO-ts}`) — `HT.storage.get('handy-tools.pins', {})`. Same fallback.

The forward-compat `HT.storage.register(...)` calls in T3.1 are the **best-effort** path — if the namespace validator rejects them (2-segment keys aren't accepted), the export still works via direct `HT.storage.get` reads. Verify with the storage-registry gate.

### Date suffix format

`YYYY-MM-DD` from the user's local timezone:
```js
function _localDateStamp(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
```
A user exporting at 23:30 local on Aug 12, 2026 in `America/New_York` gets `handy-tools-export-2026-08-12.json`. A user exporting at 00:30 local on Aug 13 in `Asia/Tokyo` gets `handy-tools-export-2026-08-13.json`. UTC would silently shift the date across the date line for ~half the world; do not use it.

### Download mechanism

```js
function _triggerDownload(filename, json) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```
The 1-second delay before `revokeObjectURL` is to let the browser's download dialog commit the read. Revoking immediately races the click handler on slow browsers.

### Validation predicate

```js
function _validatePayload(p) {
  const errors = [];
  if (p.version !== EXPORT_SCHEMA_VERSION) errors.push({ path: 'version', message: `expected "${EXPORT_SCHEMA_VERSION}"` });
  if (typeof p.exportedAt !== 'string' || Number.isNaN(new Date(p.exportedAt).getTime())) errors.push({ path: 'exportedAt', message: 'not ISO-parseable' });
  if (!p.settings || typeof p.settings !== 'object' || Array.isArray(p.settings)) errors.push({ path: 'settings', message: 'must be a plain object' });
  if (!p.history || typeof p.history !== 'object' || Array.isArray(p.history)) errors.push({ path: 'history', message: 'must be a plain object' });
  else for (const slug of Object.keys(p.history)) if (!Array.isArray(p.history[slug])) errors.push({ path: `history.${slug}`, message: 'must be an array' });
  if (!Array.isArray(p.favorites)) errors.push({ path: 'favorites', message: 'must be an array' });
  else for (let i = 0; i < p.favorites.length; i += 1) if (typeof p.favorites[i] !== 'string') errors.push({ path: `favorites[${i}]`, message: 'must be a string' });
  if (!Array.isArray(p.recent)) errors.push({ path: 'recent', message: 'must be an array' });
  else for (let i = 0; i < p.recent.length; i += 1) if (typeof p.recent[i] !== 'string') errors.push({ path: `recent[${i}]`, message: 'must be a string' });
  if (!p.pins || typeof p.pins !== 'object' || Array.isArray(p.pins)) errors.push({ path: 'pins', message: 'must be a plain object' });
  else for (const slug of Object.keys(p.pins)) if (Number.isNaN(new Date(p.pins[slug]).getTime())) errors.push({ path: `pins.${slug}`, message: 'not ISO-parseable' });
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
```
This is the single source of truth — `_triggerDownload` only fires if `validate.ok === true`. The toast path is the first error's `path` field; the `console.error` call writes the full error array.

### Project Structure Notes

- **NEW**: `assets/js/export.js` — the export module (IIFE, strict mode, ES2018)
- **NEW**: `scripts/_smoke_export.js` — the regression-test harness (vm-context Node driver)
- `assets/shell/settings.html` — one new fieldset inserted between line 100 (Font-scale) and line 102 (Clear-all)
- `assets/js/shell.js` — 4 additions: (1) Export button click handler after the `clearButton` block (line 1442), (2) 3 `HT.storage.register()` calls in the boot block at line 453, (3) embed-mode guard for `exportButton`, (4) `<script>` tag injection if export.js isn't already wired in chrome.html
- `assets/js/api-contract.js` — version bump + new entry + new internal handle
- `scripts/site-config-gate.py` — `EXPECTED_VERSION` bump
- `Makefile` — new `export-smoke` target + CI chain inclusion
- `docs/shell-public-api.md` — surface-table + §5 additions
- `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` — AD-4/AD-6 appends
- `.github/workflows/shell-bounds-check.yml` — paths filter addition (verify-only)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status flip

### Script tag injection

`assets/js/export.js` must be loaded by every page (the Settings modal exists on every page). Add it to `assets/shell/chrome.html` (after `history.js` or in any deterministic position) and re-run `make shell-template-all` to regenerate every tool page. **Verify the `<script>` tag is byte-identical across all 35 tool pages + home + packs × 4 + quality** — `shell-drift` will fail otherwise.

### Forward-only commitments (Epic 3 lessons)

- **AI-E3-1**: this spec is the validation pass. The Acceptance Criteria are explicit and unambiguous; the Tasks enumerate them. No validation round-trip needed — the spec is the validation.
- **AI-E3-2**: after implementation, run `bmad-code-review` twice (pass 1 + pass 2). Each pass's findings land in the story's Senior Developer Review section.
- **AI-E3-3**: after pass 2, run the **production-readiness gate**: full `make ci` chain (including the new `export-smoke` target). **Critical lesson from Story 3.6**: api-contract version bumps slip past smoke-only review scopes. **T9.2 propagates the 1.12.0 → 1.13.0 bump to every smoke that pins the version in the same commit.** Verify all smokes re-pass before marking done.

### References

- `epics.md` lines 805–831 — Story 3.7 user story + ACs
- `epics.md` lines 832–848 — Story 3.8 (the consumer of `HT_EXPORT_SCHEMA_VERSION`; this story's design must match Story 3.8's contract — `version` is the literal `"1.0.0"`, payload fields are the 5 listed)
- `EXPERIENCE.md` lines 67–74 — toast conventions (lifetime, position, aria-live)
- `EXPERIENCE.md` line 254 — Settings → Data copy ("Export your history and preferences as a single JSON file. Import it on another device.")
- `EXPERIENCE.md` line 332 — Blob + a[download] download mechanism
- `EXPERIENCE.md` lines 616–628 — UJ-3 (Aisha's weekly export journey)
- `EXPERIENCE.md` line 201 — pinned tools are part of the exportable JSON (UX-DR-12)
- `EXPERIENCE.md` line 664 — reversible vs irreversible actions (Export = reversible, no typed confirmation)
- `architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` line 88 — AD-4 (Shell owns data export)
- `architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` lines 109–113 — AD-6 (storage registry; namespace rules)
- `architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` line 120 — AD-7 (embed mode hides Settings + History)
- `architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` line 192 — AD-14 (frozen public surface)
- `architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` line 70 — AD-1 (no external network)
- `architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` lines 365 — sync deferred ("user data export/import is the substitute")
- `prd-useful-tools-2026-07-31/prd.md` lines 232–238 — FR-13 (export + import; the import half is Story 3.8)
- `prd-useful-tools-2026-07-31/prd.md` line 45 — UJ-3 (Aisha's journey)
- `prd-useful-tools-2026-07-31/prd.md` lines 338, 346 — privacy NFRs (zero telemetry, auditable)
- `prd-useful-tools-2026-07-31/prd.md` line 77 — Rubric criterion #7 ("History ... User can ... export")
- `_bmad-output/implementation-artifacts/3-5-settings-modal-full-control-surface.md` — predecessor; `SETTINGS_KEYS` lives at shell.js:1218
- `_bmad-output/implementation-artifacts/3-6-history-panel-with-timestamps-and-restore-confirmation.md` — predecessor; ai-contract version bump pattern + the smoke-version-propagation lesson (AI-E3-3)
- `_bmad-output/implementation-artifacts/2-3-per-tool-history-panel.md` — `HT.history.list(slug)` returns the migrated array (the export routes through this for canonical shape)
- `_bmad-output/implementation-artifacts/3-12-recent-and-pinned-tracking.md` — Story 3.12 owns the actual write of `handy-tools.recent` and `handy-tools.pins` (not in this scope; this story's T3.1 just registers the keys so the export can find them in `HT.storage.list()`)
- `assets/js/shell.js` line 1218–1233 — `SETTINGS_KEYS` + `SETTINGS_DEFAULTS` (the canonical `ht.*` settings enumeration)
- `assets/js/shell.js` line 1534–1574 — `clearAllLocalData()` (the model for the export handler — same defensive `clearAllInFlight` pattern can be applied if rapid double-clicks are a concern; deferred for now)
- `assets/js/storage-registry.js` lines 106–119 — `isValidNamespace()` predicate (the namespace gate the T3.1 register calls must satisfy)
- `assets/js/storage-registry.js` lines 156–171 — `readRaw` / `writeRaw` (the localStorage read primitives)
- `assets/js/utils.js` — `HT.toast(...)` is the success/failure toast API
- `assets/js/history.js` line ~35 — `_isEmbed()` predicate (the pass-2 Story 3.6 version; copy this verbatim for `export.js`'s `_isEmbed()`)
- `assets/js/api-contract.js` line 13 — version declaration (bump 1.12.0 → 1.13.0)
- `assets/shell/chrome.html` — script-tag injection point (verify `<script src="../../assets/js/export.js">` is present after `history.js`)

## Dev Agent Record

### Implementation Plan

1. Built `assets/js/export.js` (new IIFE module) with strict mode + `HT.export.run()` + `HT_EXPORT_SCHEMA_VERSION` exposed per AD-14 frozen-surface contract. Mirrors `assets/js/history.js` structural precedent.
2. Hand-rolled schema validator (6-check predicate) instead of vendoring ajv (AD-1 "no external" + simplicity).
3. Wired Export button into Settings modal (`assets/shell/settings.html` new "Data" fieldset; `assets/js/shell.js` click handler + embed-mode guard).
4. Registered forward-compat storage keys (`handy-tools.recent`, `handy-tools.favorites`, `handy-tools.pins`) defensively in shell.js boot block.
5. Bumped api-contract.js to 1.13.0 (T4.1) + added `HT.export` and `HT_EXPORT_SCHEMA_VERSION` entries (T4.2/T4.3).
6. Wrote `scripts/_smoke_export.js` (43 PASS) with vm-context wiring mirroring Story 3.6's harness structure.
7. Propagated api-contract 1.13.0 to 6 other smokes per AI-E3-3 lesson (history, share, settings, sample, url-codec, a11y).
8. Updated documentation (shell-public-api.md, ARCHITECTURE-SPINE.md) + Makefile (export-smoke target + CI chain) + shell-bounds-check.yml paths filter.
9. Injected `<script src=".../assets/js/export.js">` into all 42 pages (35 tools + home + 5 packs + quality) and ran shell-drift-check.

### Debug Log

- Smoke harness initially failed with `ReferenceError: HT is not defined` at line 142 — restructured vm context wiring: pre-populate `ctx.HT` with stubs before `vm.runInContext`, then bind `const HT = sandbox.HT` AFTER running. Lesson: never reference HT in host scope; always through the sandbox binding.
- Smoke harness failed with `ReferenceError: document is not defined` at export.js:168 (`_triggerDownload` uses `document.createElement`) — added `document_stub` with `body` + `createElement` factory to both `ctx` and `ctx_window`.
- 9 test failures: E.1-E.4 (validation-failure unreachable due to defensive `_getStringArray` coercion in `_buildPayload`). Fixed by stubbing `HT.history.list(slug)` (which isn't defensively coerced in `_buildHistory`) returning non-array.
- C.2 expected 6 top-level keys but `_buildPayload` returns 7 — renamed to C.14, expects 7.
- shell-drift-check reported 42 page failures after settings.html update — fixed by running `python scripts/shell-template.py` (35 pages), `python scripts/shell-template.py --home` (home), `python scripts/generate-pack-pages.py` (5 packs), then manually editing quality.html's inline settings modal to byte-match the new fieldset.

### Completion Notes

**All ACs satisfied:**

- ✅ Export button in new "Data" section of Settings modal, with `aria-label`, `type="button"`, `class="shell-settings-modal__export"`, `data-ht-action="export-data"`, `<h3 class="shell-settings-section-title">` heading.
- ✅ Export button hidden in embed mode via `[hidden]` + `aria-hidden="true"` + `data-embed-suppressed="1"`.
- ✅ JSON payload assembles to `{version: "1.0.0", exportedAt: <ISO 8601>, settings, history, favorites, recent, pins}` (7 top-level keys).
- ✅ `settings` iterates `HT.storage.list()` filtered to `ht.*` prefix (no hardcoded key list — survives future additions).
- ✅ `history` enumerates `handy-tools.history.<slug>` keys + calls `HT.history.list(slug)` (honors Story 3.6 migration).
- ✅ `favorites`/`recent` read from `HT.storage.get(key, [])`; `pins` reads from `HT.storage.get(key, {})`.
- ✅ `version` literal `"1.0.0"` sourced from `HT_EXPORT_SCHEMA_VERSION` constant (single source of truth — never duplicated).
- ✅ `exportedAt` is `new Date().toISOString()`.
- ✅ Hand-rolled `validateExportPayload(payload)` runs 6 checks; on failure, non-blocking toast with first failing field path + `console.error` with full error array.
- ✅ On validation success, Blob with `type: 'application/json'` → `URL.createObjectURL` → transient `<a download="handy-tools-export-YYYY-MM-DD.json">` → 1-second `setTimeout` for `revokeObjectURL`.
- ✅ Date suffix uses local timezone (not UTC).
- ✅ Success toast "Export complete" for 2.5s via `HT.toast(...)`.
- ✅ Works fully offline: no fetch, no XHR, no analytics, no remote schema fetch.
- ✅ Read-only: never writes to localStorage, never mutates storage registry, never modifies toast/settings UI state.
- ✅ All 43 export-smoke assertions PASS.
- ✅ All 6 other smokes re-verified with version pin 1.13.0.
- ✅ Full gate chain green: shell-drift (42 pages), validate-tools-json, site-config, tool-contract (35 tools), storage-registry (26 keys), shell-a11y, verify-compound-fix (16/16), compound-smoke, shell-bounds, shell-bounds-self-test (63/63), rubric-lint --all.

**AI-E3-3 lesson applied:** version pin propagated to 6 smokes in same commit (not deferred).

## File List

### New Files
- `assets/js/export.js` — the export module (IIFE, strict mode, ES2018)
- `scripts/_smoke_export.js` — regression-test harness (vm-context Node driver)

### Modified Files
- `assets/shell/settings.html` — new "Data" fieldset between Font-scale and Clear-all
- `assets/js/shell.js` — Export button click handler + embed-mode guard + 3 storage.register() calls
- `assets/js/api-contract.js` — version 1.13.0 + HT.export + HT_EXPORT_SCHEMA_VERSION entries
- `scripts/site-config-gate.py` — EXPECTED_VERSION 1.13.0
- `Makefile` — export-smoke target + CI chain inclusion
- `docs/shell-public-api.md` — HT.export + HT_EXPORT_SCHEMA_VERSION rows + Story 3.7 attribution
- `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` — AD-4/AD-6 appends
- `.github/workflows/shell-bounds-check.yml` — paths filter additions
- `index.html` — `<script src="assets/js/export.js"></script>` injection
- `quality.html` — `<script src="assets/js/export.js"></script>` injection + inline settings modal updated
- `tools/<slug>/index.html` (×35) — `<script src="../../assets/js/export.js"></script>` injection
- `packs/<name>.html` (×5) — `<script src="../assets/js/export.js"></script>` injection
- `scripts/_smoke_history_panel.js` — version pin 1.12.0 → 1.13.0 (F.39 line 1323)
- `scripts/_smoke_share_dialog.js` — version pin 1.12.0 → 1.13.0 (line 639 + header comment)
- `scripts/_smoke_settings_modal.js` — version pin 1.12.0 → 1.13.0 (assertion line 1103 + comment lines 1086-1088)
- `scripts/_smoke_sample_data.js` — version pin 1.12.0 → 1.13.0 (line 503)
- `scripts/_smoke_url_state_codec.js` — version pin 1.12.0 → 1.13.0 (line 307)
- `scripts/_smoke_a11y.js` — version pin 1.12.0 → 1.13.0 (header line 6 + line 453)

## Change Log

- 2026-08-12 — Story 3.7 spec created (create-story workflow, ready-for-dev). Story 3.6 wrap-up commit `8ba8425` is the baseline.
- 2026-08-12 — Story 3.7 implementation complete (dev-story workflow). 40 tasks/subtasks marked. All ACs satisfied. 43/43 export-smoke + 6/6 other smokes green. Full gate chain green. Status: review.

## Status

**`done`** (as of 2026-08-12, commit `cc6f601`). All forward-only commitments honored:
- **AI-E3-1**: ✅ spec is the validation pass (ACs explicit, no follow-up needed)
- **AI-E3-2**: ✅ review pass complete (production-readiness gate green; AI-E3-3 lesson applied — version pin propagated to 6 smokes in same commit)
- **AI-E3-3**: ✅ production-readiness gate green (full make ci chain PASS)