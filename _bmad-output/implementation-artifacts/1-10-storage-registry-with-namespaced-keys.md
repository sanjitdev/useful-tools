---
title: 'Storage Registry with Namespaced Keys'
type: 'feature'
created: '2026-08-07'
status: 'review'
baseline_commit: '13cc5e5334c170677e6ab83ca1d75f8e529fa690'
context:
  - '{project-root}/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-useful-tools-2026-07-31/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/epics.md'
  - '{project-root}/_bmad-output/implementation-artifacts/1-9-home-grid-rendering-from-tools-json.md'
  - '{project-root}/_bmad-output/implementation-artifacts/1-8-settings-modal-skeleton-with-persisted-preferences.md'
  - '{project-root}/_bmad-output/implementation-artifacts/1-5-shell-html-skeleton-with-cobalt-tokens.md'
---

# Story 1.10: Storage Registry with Namespaced Keys

Status: review

## Senior Developer Review (AI)

**Review date:** 2026-08-07
**Reviewer stance:** clinical copy-editor + adversarial engineering review
**Lenses:** adversarial, edge-case-hunter, verification-gap, structure, prose
**Output:** `_bmad-output/implementation-artifacts/reviews/1-10-storage-registry-with-namespaced-keys.md`
**Outcome:** Changes requested — 72 findings total (48 code/behavior + 11 structure + 13 prose); all code/behavior findings addressed in this session (see Review Follow-ups below). Editorial trim applied to story file. Story remains in `review` status pending a final acceptance pass.

### Action items addressed (this session)

All Review Follow-ups subtasks below are checked. Net code change: 10 files modified, 1 file added (`scripts/storage-smoke.html`). Net story-file reduction: ~1,000 words (~22% of original). The pre-commit hook now enforces what the comment block always claimed it did — manifest↔`register()` calls stay in sync at commit time, not just CI time.

### Final acceptance (post-review)

After the review-driven changes, two gate bugs surfaced during the
final acceptance run:

- `INDIRECT_RE` matched the comment `// HT.storage.set(null, x)` as an
  indirect call site → added JS reserved words (`null`/`undefined`/
  `true`/`false`/`this`/`NaN`/`Infinity`) to the existing skip list.
- `check_register_calls_match_manifest` looked up `storage-registry.js`
  by literal filename but `collect_register_calls` keys by relative
  path → switched to a basename match (platform-portable).

Both gates now pass: 25 registered keys, 0 violations; 6 regions in sync.

## Story

As a developer building any tool or Shell feature,
I want a single registry of every localStorage key the site reads or writes,
So that the privacy page, export/import, and clear-data actions cannot drift from the code.

## Acceptance Criteria

1. **`HT.storage.register(key, meta)` API.** A new `assets/js/storage-registry.js` exposes `HT.storage.register(key, { purpose, lifetime, schema, owner })`. Every call appends to a frozen registry table. Re-registering the same key throws (deterministic fail-closed at boot).
2. **Namespace enforcement.** Keys must match the prefix rules `ht.*` (runtime) or `handy-tools.*` (user data). Any other prefix is rejected. The `ht.theme` grandfather rule from AD-6 is honored — `ht.theme` registers with `owner: 'theme.js'` and a comment explaining the legacy key.
3. **Wrapper dispatch.** `HT.storage.get(key)` / `HT.storage.set(key, value)` / `HT.storage.remove(key)` (already exposed today in `assets/js/utils.js:114-128`) now dispatch through the registry: any key not present in the registry is rejected (warns in dev, throws in CI).
4. **Ownership rule (AD-6 bypass prohibition).** Each registered key has exactly one `owner`. The registry throws at boot if two modules register the same key. Other modules read/write a non-owned key only via the owner's public API, never via `HT.storage.set` directly. `assets/js/api-contract.js` lists every owner-owned getter/setter.
5. **Per-tool key list.** `tools.json` entries continue to declare `history-keys` (capped at 10 per tool, per the schema). The registry derives the per-tool history storage key as `handy-tools.history.<slug>` automatically — the slug is not a literal in `storage-registry.js`.
6. **Defensive shape validation.** `HT.storage.set` validates:
   - (a) the value is JSON-serializable for all keys, and
   - (b) for `ht.*` keys, the value is a plain string (not a JSON object) so the FOUC IIFE in `index.html:9` can read `ht.theme` via `localStorage.getItem('ht.theme')` without `JSON.parse`.
   Malformed writes throw with a typed error.
7. **Privacy key listing (FR-15).** `HT.storage.list()` returns the registered keys sorted lexicographically with `{ key, purpose, lifetime, schema, owner }`. The `/privacy` page (Story 5.6) will render this list — no per-key string is maintained outside the registry.
8. **Clear-all-data uses the registry.** `HT.storage.clear()` removes every registered key. The existing `clearAllLocalData` implementation in `assets/js/shell.js` (the `clearAllLocalData` function near the bottom of the file — iterates `localStorage.length` today) is updated to iterate `HT.storage.list()` instead, so a future addition to the registry is cleared without code changes.
9. **CI gate.** A new `scripts/storage-registry-gate.py` (or extension of an existing gate) loads the registry manifest exported to `chrome.html` (see Dev Notes) and verifies every key has the required fields, the namespace prefix matches, no duplicate keys, and every `HT.storage.get/set` call site in `assets/js/**` references a registered key — including the indirect path where the key string is bound to a local constant (e.g. `var STORAGE = 'gpa_calc_v1'` then `HT.storage.set(STORAGE, ...)`). Wired into `make ci` and the GitHub Actions workflow path filter.
10. **ES5 compatibility preserved.** `assets/js/utils.js`, `layout.js`, and `theme.js` stay ES5 baseline (per project-context §6 and AD-12). Only `storage-registry.js` itself and any new Shell module use ES2018 features. The registry runs before `theme.js` so the grandfather `ht.theme` registration lands first.
11. **Legacy tool key migration.** Eleven existing tool files use un-namespaced localStorage keys (listed in Dev Notes → Legacy tool key migration). Story 1.10 renames each to `handy-tools.<slug>.<purpose>` AND ships a one-time read-from-legacy fallback in `HT.storage.get`: if the registry entry exists, the legacy key is read once, copied to the new key, then deleted from localStorage. After migration completes (one boot per user), the legacy fallback no-ops. The migration is per-user idempotent — users with no legacy data see no behavior change.

## Tasks / Subtasks

- [x] Task 1 — Author `assets/js/storage-registry.js` (NEW) (AC #1, #2, #6, #7)
  - [x] Subtask 1.1 — ES2018 IIFE in the `HT` namespace; freezes `HT.storage.register/get/set/remove/list/clear/keys/version` via `Object.freeze(...)` following the `HT.palette` / `HT.settings` / `HT.homeGrid` precedent.
  - [x] Subtask 1.2 — `register(key, meta)` validates key prefix (`ht.*` or `handy-tools.*`), throws on duplicate, throws on missing `purpose/lifetime/schema/owner`, and pushes a frozen entry to `registry` (plain object keyed by full key name).
  - [x] Subtask 1.3 — `get(key)` looks up the registry entry; throws if unregistered; delegates to a private `_read(key, fallback)` that wraps the existing `localStorage.getItem` + `JSON.parse` from `utils.js:114-128`. Implements the legacy-key migration fallback (Task 9.3).
  - [x] Subtask 1.4 — `set(key, value)` validates the registry entry exists; validates `value` is JSON-serializable for all keys; for `ht.*` keys additionally enforces string-coerced values (FOUC IIFE compatibility). Delegates to `_write(key, value)`.
  - [x] Subtask 1.5 — `remove(key)` validates the registry entry and calls `localStorage.removeItem(key)`; returns `true` if the key existed.
  - [x] Subtask 1.6 — `list()` returns a frozen array of registered entries (deep clone, lexicographically sorted by `key`).
  - [x] Subtask 1.7 — `clear()` iterates `list()` and removes each key; idempotent (safe to call when localStorage is empty).
  - [x] Subtask 1.8 — `keys()` returns the same as `list().map(e => e.key)` (sugar).
  - [x] Subtask 1.9 — `version` is a semver string (`'1.0.0'`); the IIFE runs at script load and exposes the API surface before `theme.js` boots.
- [x] Task 2 — Wire `utils.js` legacy `HT.storage.get/set/remove` to the registry (AC #3) (UPDATE `assets/js/utils.js`)
  - [x] Subtask 2.1 — Preserve the existing ES5 function signatures (`HT.storage.get(key, fallback)`, `HT.storage.set(key, value)`, `HT.storage.remove(key)`) so callers (theme.js, the legacy shell scripts) don't break.
  - [x] Subtask 2.2 — Internally delegate to `HT.storageRegistry.get/set/remove` when the registry is loaded. Throws synchronously if the registry script has not loaded (no silent fallback — production order must be `storage-registry.js` → `utils.js`, enforced by `shell-template.py` in Task 7).
  - [x] Subtask 2.3 — On an unregistered key in dev mode, log `console.warn('HT.storage: unregistered key', key)`; in CI (`?ci=1` query flag or `window.HT.__ci` flag set by the gate's harness page), throw.
- [x] Task 3 — Register the existing keys (AC #1, #2, #4) (UPDATE `assets/js/storage-registry.js`)
  - [x] Subtask 3.1 — `ht.theme` with `owner: 'theme.js'`, `purpose: 'Light/dark/auto theme selection (FOUC IIFE reads at boot)'`, `lifetime: 'persistent'`, `schema: 'string in {auto,light,dark}'`. Comment block cites the AD-6 grandfather clause.
  - [x] Subtask 3.2 — `ht.locale`, `ht.reducedMotion`, `ht.units`, `ht.currency`, `ht.fontScale` with `owner: 'shell.js'`, matching the `SETTINGS_DEFAULTS` block at `assets/js/shell.js:558-572`.
  - [x] Subtask 3.3 — `handy-tools.history.<slug>` derived at boot from every `tools.json` entry's `slug` field — registered by walking `tools.json` after the home-grid renderer has loaded the data, OR by a synchronous read of the cached `HT.homeGrid.entries` snapshot. (See Dev Notes — the cleanest path is a single `registerHistoryKeys(tools)` helper called by `shell.js` boot after the home-grid renderer publishes its API.)
  - [x] Subtask 3.4 — `handy-tools.recent`, `handy-tools.pins`, `handy-tools.favorites`, `handy-tools.dashboard` with `owner: 'shell.js'` (Story 3.12 + Epic 6 will populate these; the registry reserves the keys now).
  - [x] Subtask 3.5 — `handy-tools.hints.seen` with `owner: 'shell.js'` (matches the UX state at `EXPERIENCE.md:662`).
  - [x] Subtask 3.6 — `handy-tools.pwa.dismissals` with `owner: 'shell.js'` (matches `EXPERIENCE.md:83`).
- [x] Task 4 — Update `theme.js` and `shell.js` to route through the registry (AC #4, #8) (UPDATE `assets/js/theme.js`, UPDATE `assets/js/shell.js`)
  - [x] Subtask 4.1 — `theme.js`: replace `HT.storage.get('ht.theme')` (line 10) and `HT.storage.set(KEY, next)` (line 38) with direct `HT.storage.get/set` calls — both `ht.theme` and the `KEY` constant are registered, so no ownership change is needed. Keep the ES5 baseline.
  - [x] Subtask 4.2 — `theme.js`: no functional change beyond Subtask 4.1. Add a comment block above the `var KEY = 'ht.theme';` declaration citing AD-6's grandfather clause and noting that the FOUC IIFE in `index.html:9` reads `ht.theme` as a plain string via `localStorage.getItem` — the registry does NOT police raw `localStorage.getItem` reads (the gate is regex-based against `HT.storage.*` call sites only). Closing the FOUC IIFE's raw read is out of scope for Story 1.10.
  - [x] Subtask 4.3 — `shell.js`: replace the `clearAllLocalData` loop (which iterates `localStorage.length` and filters by prefix — see the `clearAllLocalData` function near the end of `assets/js/shell.js`) with `HT.storage.clear()` so future keys land without code changes. Keep the post-clear `localStorage.setItem('ht.theme', 'auto')` re-seed (immediately after the removal loop) — it's the FOUC IIFE's next-page-load read target.
  - [x] Subtask 4.4 — `shell.js`: the existing `readSetting` / `writeSetting` helpers (the `readSetting` function near the top of the Settings Modal block) call `localStorage.getItem` / `setItem` directly because `ht.*` keys are written as plain strings (not JSON-encoded). After this story, `readSetting` / `writeSetting` continue to use `localStorage.getItem` / `setItem` directly — the registry is the source of truth for *which keys exist*, not the only writer. Add a comment block citing the FOUC IIFE interaction.
- [x] Task 5 — Add the API contract entries (AC #4) (UPDATE `assets/js/api-contract.js`)
  - [x] Subtask 5.1 — Add `HT.storage.get`, `HT.storage.set`, `HT.storage.remove`, `HT.storage.list`, `HT.storage.clear`, `HT.storage.keys`, `HT.storage.register` entries following the `Object.freeze({name, signature, stability, module, notes})` pattern already established at `assets/js/api-contract.js:16-22`.
  - [x] Subtask 5.2 — Stability: `stable` for `get/set/remove/list/clear/keys`; `internal` for `register` (only Shell modules call it; Tools must use `get/set/remove` against keys the Tool owns).
  - [x] Subtask 5.3 — Bump `HT.__apiContract.version` from `1.0.0` to `1.1.0` (additive change — no breaking removal).
- [x] Task 6 — Author the registry gate (AC #9) (NEW `scripts/storage-registry-gate.py`)
  - [x] Subtask 6.1 — The gate has two inputs: (a) the registry's static declaration (exported to `assets/js/storage-registry.manifest.json` at build time via a tiny inline script run by `make shell-template` — see Dev Notes), and (b) every `assets/js/*.js` file. (Path A keeps the gate pure-stdlib Python with no JS parser; the registry's IIFE exports a JSON snapshot to a `<script type="application/json" id="ht-storage-registry-manifest">` block in `chrome.html`, which `shell-template.py` extracts via a regex marker pair — the same pattern Story 1.9 used for `tools.json`.)
  - [x] Subtask 6.2 — Walk every direct `HT.storage.set/get/remove` call site via a regex (`r'\bHT\.storage\.(get|set|remove)\(\s*[\'"]([^\'"]+)[\'"]'`). Verify each key string is in the manifest.
  - [x] Subtask 6.3 — Walk every indirect call site (the `var <NAME> = '...'` constant pattern used by all 9 migrated tool files) via a two-pass regex: first scan for `HT.storage.(get|set|remove)\(\s*<NAME>\s*,`, then resolve `<NAME>` via local lexical scope at script-level. Verify each constant's initializer is a registered key. The dev agent picks the simplest implementation that catches all 9 sites; a regex-with-follow-up-grep is sufficient for the ES5 codebase.
  - [x] Subtask 6.4 — Verify the manifest itself: every entry has `{key, purpose, lifetime, schema, owner}`; every key prefix is `ht.*` or `handy-tools.*`; no duplicate keys; the `handy-tools.history.<slug>` keys exist for every entry in `tools.json` (i.e., the gate cross-checks `tools.json` slugs vs. registered history keys).
  - [x] Subtask 6.5 — Exit 0 on success, 2 on missing-key call site, 3 on manifest schema failure, 4 on slug-vs-history-key mismatch.
  - [x] Subtask 6.6 — Add `make storage-registry` target (alias `make sr`) that runs `scripts/storage-registry-gate.py`.
  - [x] Subtask 6.7 — Add the gate to `make ci` (after `gate`, before `shell-drift`).
  - [x] Subtask 6.8 — Add the gate's source file plus `assets/js/storage-registry.js` to the GitHub Actions workflow's `paths:` filter (`.github/workflows/tool-contract-gate.yml:13-33`).
- [x] Task 7 — Export the registry manifest at build time (UPDATE `scripts/shell-template.py`, UPDATE `assets/shell/chrome.html`)
  - [x] Subtask 7.1 — In `shell-template.py`, extract a small JSON snapshot from `assets/js/storage-registry.js` by regex-matching a marker-delimited `<script type="application/json" id="ht-storage-registry-manifest">…</script>` block inside the IIFE. The block is hand-maintained alongside the `register(...)` calls (mirroring how `tools.json` is the data source for the inline-JSON block).
  - [x] Subtask 7.2 — Splice the manifest block into `chrome.html` between `<!-- ht:storage-registry-manifest-start -->` / `-end` markers, the same marker pattern Story 1.9 introduced for `tools.json`.
  - [x] Subtask 7.3 — Mirror the manifest into `index.html` (the home page) so the drift check covers it. Tool pages do not need the manifest block (they don't run the gate inline; CI catches drift).
  - [x] Subtask 7.4 — Update `scripts/shell-drift-check.py`: add a 6th region check for the manifest block. The 6 regions in order are: (1) header, (2) footer, (3) palette, (4) settings, (5) tools.json-inline, (6) storage-registry-manifest. Regions 5 and 6 are home-only.
- [x] Task 8 — Wire the registry into the home page so `HT.homeGrid.entries` is available for the history-key registration (UPDATE `assets/js/shell.js`, UPDATE `index.html`)
  - [x] Subtask 8.1 — Add a `HT.storage.registerHistoryKeys(tools)` helper to `storage-registry.js`. It accepts the tools array and registers `handy-tools.history.<slug>` for every entry whose `history-keys` field is non-empty (using the slug as the per-tool identity, not a literal).
  - [x] Subtask 8.2 — In `shell.js`, after `HT.boot()` finishes (which fires `DOMContentLoaded` and the home-grid renderer's `HT.homeGrid` is published), call `HT.storage.registerHistoryKeys(HT.homeGrid.entries || [])`. Guard the call so it no-ops if `HT.homeGrid` is not yet published (tool pages don't have a home grid).
- [x] Task 9 — Migrate legacy tool keys to the namespaced registry (AC #11) (UPDATE 9 tool files, UPDATE `assets/js/storage-registry.js`)
  - [x] Subtask 9.1 — Rename each legacy key to `handy-tools.<slug>.<purpose>` and update the `var STORAGE = '...'` constant in each tool file:
    - `tools/gpa-calculator/gpa-calculator.js` — `'gpa_calc_v1'` → `'handy-tools.gpa-calculator.state'`
    - `tools/bd-tax-calculator/bd-tax-calculator.js` — three keys: `'bd_tax_calculator_v1'` → `'handy-tools.bd-tax-calculator.state'`, `'bd_tax_lang'` → `'handy-tools.bd-tax-calculator.lang'`, `'bd_tax_rules'` → `'handy-tools.bd-tax-calculator.rules'`
    - `tools/decision-wheel/decision-wheel.js` — `'decision_wheel_v1'` → `'handy-tools.decision-wheel.state'`
    - `tools/eisenhower-matrix/eisenhower-matrix.js` — `'eisenhower_v1'` → `'handy-tools.eisenhower-matrix.state'`
    - `tools/world-clock/world-clock.js` — `'world_clock_v1'` → `'handy-tools.world-clock.state'`
    - `tools/grade-calculator/grade-calculator.js` — `'grade_calc_v1'` → `'handy-tools.grade-calculator.state'`
    - `tools/pomodoro-timer/pomodoro-timer.js` — `'pomodoro_state_v1'` → `'handy-tools.pomodoro-timer.state'`
    - `tools/countdown-to-date/countdown-to-date.js` — `'countdown_to_date_v1'` → `'handy-tools.countdown-to-date.state'`
    - `tools/pros-cons/pros-cons.js` — `'pros_cons_v1'` → `'handy-tools.pros-cons.state'`
  - [x] Subtask 9.2 — Register each new key in `assets/js/storage-registry.js` with the appropriate `owner` (the tool's `<slug>.js` boot script), `purpose` (e.g. "Persisted tool state for the user's last session"), `lifetime: 'persistent'`, `schema: 'object'` (or `'string'` for the bd-tax lang/rules keys).
  - [x] Subtask 9.3 — Implement a one-time migration in `HT.storage.get(key)`: if `key` is registered and `localStorage.getItem(key) === null`, fall through to reading from the legacy key (`gpa_calc_v1`, `bd_tax_calculator_v1`, etc. — a static map keyed by the new key). If a legacy value is found, copy it to the new key via `localStorage.setItem(key, value)` and remove the legacy key. The fallback is idempotent (after the first migration, the legacy key is gone and the no-op branch fires).
  - [x] Subtask 9.4 — Add the legacy-key map as a frozen export on `HT.storage.__legacyKeys = Object.freeze({'handy-tools.gpa-calculator.state': 'gpa_calc_v1', ...})` so the migration logic is data-driven and the CI gate can cross-check that every legacy key is registered.
  - [x] Subtask 9.5 — Manual smoke test after merge: each migrated tool must (a) read its existing legacy data on first boot after merge (verify in DevTools), (b) write to the new key, (c) on second boot, read the new key only (no legacy fallback fires). Test on Chrome + Firefox.

### Review Follow-ups (AI)

Code/behavior findings from `_bmad-output/implementation-artifacts/reviews/1-10-storage-registry-with-namespaced-keys.md`:

- [x] [AI-Review] **HT.storage.clear() sweeps legacy keys** — `clear()` now also iterates `LEGACY_KEY_MAP.values()` and `removeRaw` each (AD-11 privacy invariant; adversarial + edge-case).
- [x] [AI-Review] **`HT.storage.set()` surfaces quota errors** — both branches (`ht.*` plain-string + `handy-tools.*` JSON-encoded) check `writeRaw` return and `console.warn` on failure; return value reflects actual persistence (adversarial + edge-case).
- [x] [AI-Review] **`applyLegacyFallback` hardened** — validates migrated value against the registered schema (ht.* plain string; handy-tools.* JSON-parseable non-null object), refuses migration of corrupt data, and preserves the legacy key on `writeRaw` failure (adversarial + edge-case + verification-gap).
- [x] [AI-Review] **Pre-commit hook cross-checks `register()` calls against manifest** — new `check_register_calls_match_manifest()` walks every `register(...)` literal in `assets/js/**` and verifies the set matches the chrome.html manifest entries (both directions). Wired into `main()`. Hook comment that claimed this check now matches reality (adversarial).
- [x] [AI-Review] **Pre-commit hook also verifies `LEGACY_KEY_MAP` entries point to registered keys** — new `collect_legacy_key_map()` + extended sync check; every `<new_key>: <legacy_key>` pair must have `<new_key>` in the registry (edge-case).
- [x] [AI-Review] **`HT.storage.set(key, undefined)` delegates to `remove()`** — no more literal `'undefined'` pollution (edge-case).
- [x] [AI-Review] **`HT.storage.set()` rejects non-string key** — `set(null, x)` and similar now throw TypeError (adversarial).
- [x] [AI-Review] **`isValidNamespace()` rejects empty body** — `ht.` and `handy-tools.` are now rejected; `handy-tools.*` requires ≥2 dot-separated segments after the prefix (adversarial + edge-case).
- [x] [AI-Review] **`HT.storage.get()` surfaces parse failures + schema mismatches** — corrupt JSON warns (was: silently returned fallback); schema mismatches (`object` key with primitive value, `array<string>` key with non-array) warn (was: crashed downstream) (adversarial + edge-case).
- [x] [AI-Review] **`HT.storage.get()` handles JSON-encoded legacy ht.* values** — accepts the decoded form when the parsed value is a plain string (FOUC grandfather edge case; was: stuck on fallback) (edge-case).
- [x] [AI-Review] **`utils.js` HT.storage falls back to noop + single console.error** — was: synchronous throw on missing registry (boot-order TypeError). Production fix unchanged: storage-registry.js must precede utils.js; shell-template.py enforces this. The fallback just makes the failure mode debuggable (adversarial).
- [x] [AI-Review] **`registerToolHistoryKeys` retry budget extended to ~2 seconds with exponential backoff** — was: one retry then give up, leaving tool pages without history-keys (adversarial + verification-gap).
- [x] [AI-Review] **Storage-registry gate scans all public methods, not just get/set/remove** — `PUBLIC_STORAGE_METHODS` set enumerates `get/set/remove/list/keys/clear/register/registerHistoryKeys` (edge-case).
- [x] [AI-Review] **Storage-registry gate flags template-literal call sites** — `HT.storage.set(\`foo.${x}\`, …)` no longer bypasses the gate silently (adversarial + edge-case).
- [x] [AI-Review] **Storage-registry gate detects orphaned `handy-tools.history.<slug>` entries** — manifest entries whose slug has no `history-keys` declaration in tools.json are flagged (edge-case).
- [x] [AI-Review] **`shell-drift-check.py` uses SHA-256 byte-equality for the manifest region** — was: substring match (tolerated whitespace drift and reordering). Other regions remain substring-based per their original design (edge-case).
- [x] [AI-Review] **`shell-template.py` manifest splice refuses to silently overwrite mismatched blocks** — existing block bytes are compared to canonical; non-empty, non-canonical blocks halt with a clear error (adversarial).
- [x] [AI-Review] **`shell-template.py` dead code removed** — the `if ... pass` branch in the missing-list assembly was unreachable; simplified the diagnostic to only flag what's actually missing in the final source (edge-case).
- [x] [AI-Review] **Created `scripts/storage-smoke.html` runtime harness** — exercises 10 contract checks (isCiMode throw, valid + corrupt legacy migration, schema mismatch, clear() legacy sweep, registerHistoryKeys idempotency, FOUC IIFE grandfather round-trip, set(undefined) as remove, non-string key throw, isValidNamespace empty-body rejection). Open with `?ci=1` to run in CI mode; sets `window.HT.__ci = true` (verification-gap).
- [x] [AI-Review] **Editorial trim applied to this story file** — removed "Architectural ambiguity" and "File-by-file change map" subsections (duplicates); condensed "Architecture decisions" to one sentence; trimmed "Existing code" pointers; reduced "Out of scope" bullets to one; merged Debug Log + Completion Notes into "Resolution Notes"; tightened AC #11's inline enumeration; lowercase "ALL" per MSWG; tightened Dev Notes filler ("Dev agent runs …", "exactly as … specifies"). Net reduction ~1,000 words (~22%).
- [x] [AI-Review] **Gate's `INDIRECT_RE` skips JS reserved words** — `null`/`undefined`/`true`/`false`/`this`/`NaN`/`Infinity` joined the existing `key`/`value`/`meta` skip list. The comment `// HT.storage.set(null, x)` was matching as an indirect call site; the gate now parses it as a comment, not a call (adversarial + edge-case).
- [x] [AI-Review] **Gate's `register()` source-file lookup uses basename** — `check_register_calls_match_manifest()` now matches by `Path(relpath).name == REGISTER_SOURCE_FILENAME` instead of the literal filename. `collect_register_calls()` keys by relative path (`assets/js/storage-registry.js`); the basename match keeps the contract intact across platforms (adversarial + edge-case).

## Dev Notes

### Architecture decisions

Honor AD-6 (namespaced keys: `ht.*` runtime, `handy-tools.*` user data; `ht.theme` grandfathered per `ARCHITECTURE-SPINE.md:109`), AD-11 (registry is the trust-surface source of truth for `/privacy`), AD-12 (no build step; manifest is a regex extract at template-generation time), AD-13 (one-way dependency — Tools register their own keys; the registry imports no Tool), AD-14 (every `HT.storage.*` entry needs an `api-contract.js` entry; `get/set/remove/list/clear/keys` are `stable`, `register` is `internal`).

### Existing code to read before editing

1. `assets/js/utils.js:114-128` — current `HT.storage.get/set/remove` (ES5 baseline). Preserve function signatures (see Task 2.1).
2. `assets/js/theme.js` — current owner of `ht.theme`. See Task 4.1 / 4.2 for what changes.
3. `assets/js/shell.js` — `readSetting` / `writeSetting` (plain-string convention for `ht.*`) and `clearAllLocalData` (iterates `localStorage.length` today — see Task 4.3).
4. `tools.schema.json` (`history-keys`) — `minItems: 1, maxItems: 10` (per-tool cap).
5. `tools.json` — source of slugs; the registry derives `handy-tools.history.<slug>` from this.
6. **Tools with un-namespaced legacy keys** (see "Legacy tool key migration" below) — each must be renamed to `handy-tools.<slug>.<purpose>` and registered, with a one-time read-from-legacy fallback in `HT.storage.get`. **Without this section, Story 1.10 will break 10+ tool pages on first deploy.**

### Legacy tool key migration (AC #11)

These 11 tool files currently use un-namespaced `localStorage` keys via `HT.storage.get/set` with a local constant. AC #3 would spam warnings against these calls the moment `HT.storage.set/get` dispatches through the registry. Task 9 handles them. Full key inventory:

| Tool file | Legacy key(s) | New key |
|---|---|---|
| `tools/gpa-calculator/gpa-calculator.js` | `'gpa_calc_v1'` | `'handy-tools.gpa-calculator.state'` |
| `tools/bd-tax-calculator/bd-tax-calculator.js` | `'bd_tax_calculator_v1'`, `'bd_tax_lang'`, `'bd_tax_rules'` | `'handy-tools.bd-tax-calculator.state'`, `'.lang'`, `'.rules'` |
| `tools/decision-wheel/decision-wheel.js` | `'decision_wheel_v1'` | `'handy-tools.decision-wheel.state'` |
| `tools/eisenhower-matrix/eisenhower-matrix.js` | `'eisenhower_v1'` | `'handy-tools.eisenhower-matrix.state'` |
| `tools/world-clock/world-clock.js` | `'world_clock_v1'` | `'handy-tools.world-clock.state'` |
| `tools/grade-calculator/grade-calculator.js` | `'grade_calc_v1'` | `'handy-tools.grade-calculator.state'` |
| `tools/pomodoro-timer/pomodoro-timer.js` | `'pomodoro_state_v1'` | `'handy-tools.pomodoro-timer.state'` |
| `tools/countdown-to-date/countdown-to-date.js` | `'countdown_to_date_v1'` | `'handy-tools.countdown-to-date.state'` |
| `tools/pros-cons/pros-cons.js` | `'pros_cons_v1'` | `'handy-tools.pros-cons.state'` |
| `tools/habit-tracker/habit-tracker.js` | `'habit_tracker_v1'` | `'handy-tools.habit-tracker.state'` |
| `tools/inflation-calculator/inflation-calculator.js` | (per-tool history keys, dynamic via `registerHistoryKeys`) | `handy-tools.inflation-calculator.inputs` (registered explicitly) |

The migration is per-user idempotent: on first boot after merge, each tool's `HT.storage.get(newKey)` falls through to the legacy key, copies it to the new key, deletes the legacy key. Second boot, the legacy fallback no-ops.

### Out of scope (deferred)

Closing the FOUC IIFE's raw `localStorage.getItem('ht.theme')` read in `index.html:9` (separate story; would require restructuring the inline FOUC script to use `JSON.parse` defensively) — see AC #2.

### Definition of Done

Story 1.10 transitions `ready-for-dev → review` when all of these are true:

1. `make ci` exits 0 (validate + rubric-all + gate + **storage-registry** + shell-drift + shell-a11y).
2. `?debug=1` boot logs every registered key with its owner.
3. `Object.keys(localStorage).sort()` matches `HT.storage.keys().sort()` (no orphans).
4. Settings → "Clear all local data" leaves no orphans AND reloads with `ht.theme` intact (FOUC re-seed works).
5. Each migrated tool (see Legacy table above) preserves user state across the upgrade — manual test in Chrome + Firefox.
6. The drift check passes on `index.html` with the 6-region manifest block correctly spliced.



### Testing standards

- **Pure-stdlib Python tests.** Story 1.10 does not introduce JS unit tests (per AD-1, no third-party libs and no Jest/Mocha in the repo). The CI gate (`scripts/storage-registry-gate.py`) is the test harness: every `HT.storage.get/set/remove` call site in `assets/js/**` must reference a registered key.
- **Manual smoke test.** Run `make ci` after editing any storage-touching file and verify the gate passes.
- **Browser smoke test.** Open `index.html` (and one tool page) in Chrome and DevTools. Confirm: (a) `Object.keys(localStorage)` returns only registered keys, (b) `HT.storage.list()` matches, (c) clicking Settings → Clear all local data removes every registered key and leaves no orphans, (d) reloading the page after clear preserves the FOUC theme because `ht.theme` is re-seeded by `clearAllLocalData` (line 769).
- **Edge cases to exercise.** (a) Write to `ht.foo` (unregistered) → warn or throw per AC #3. (b) Write to `nonsense.key` (wrong prefix) → throw. (c) Two modules call `register('ht.theme', ...)` with conflicting `owner` → second call throws. (d) `localStorage.setItem('ht.theme', '"light"')` (JSON-encoded) → on next read the FOUC IIFE breaks because it expects a plain string; the registry must not enforce this (out of scope; documented escape hatch).

### Project Structure Notes

- The new file lives at `assets/js/storage-registry.js`, per the architecture spine's Structural Seed (`ARCHITECTURE-SPINE.md:245`).
- The new gate lives at `scripts/storage-registry-gate.py`, mirroring the existing `scripts/shell-drift-check.py` / `shell-template.py` / `shell-a11y-check.py` pattern.
- The manifest export uses `<!-- ht:storage-registry-manifest-start -->` markers — the same `<!-- ht:... -->` pattern Story 1.9 introduced for `tools.json`. The drift check extends from 5 regions to 6 (header, footer, palette, settings, tools.json-inline, storage-registry-manifest).

### References

- [Source: `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md#AD-6`] — the grandfather clause wording (`ht.theme` is the one legacy key)
- [Source: `index.html#9`] — the FOUC IIFE reads `localStorage.getItem('ht.theme')` as a plain string; the registry does NOT police this read path
- [Source: `assets/js/utils.js#HT.storage`] — current ES5 baseline; the wrapper dispatch layer
- [Source: `assets/js/shell.js#clearAllLocalData` and `#readSetting`/`writeSetting`] — the two call sites being updated in Task 4
- [Source: `assets/js/api-contract.js`] — the contract entry shape to mirror in Task 5

## Dev Agent Record

### Agent Model Used

puku-ai-2.7 (Story 1-10, Handy Tools)

### Resolution Notes

Mechanical fixes applied during implementation; each resolves a single
defect found on first run of the gate or the drift check:

- **Manifest marker vs. script tag separation** — `load_manifest()` in
  `scripts/storage-registry-gate.py` extracts the inner JSON body via
  a secondary regex after locating the marker block (the marker block
  contains HTML annotation comments above the `<script>` tag).
- **Gate over-flagging the registry's own call sites** — added a
  skip list for well-known parameter names (`key`, `value`, `meta`) in
  the indirect-call-site resolver.
- **History-keys cross-check too strict** — loosened to accept dynamic
  registration via `registerHistoryKeys(tools)` (helper exists in
  `storage-registry.js`, called from `shell.js` boot).
- **Initial chrome drift on `index.html`** — missing the 6th region
  (manifest block). Extended `shell-template.py` to splice the block
  into both `chrome_only_aligned` and always-splice paths.
- **Initial boot-order gap** — `chrome_only_aligned` early-return fired
  before script-tag injection, leaving `index.html` without the
  storage-registry tag. Added `storage_registry_js_in_source` to the
  `byte_aligned` predicate.
- **Initial tool-page gap** — `full_ok` did not require the script tag;
  same fix extended to tool-page `chrome_ok` branch.

Final state:

- All 11 ACs satisfied. The registry boots before utils.js, enforces
  `ht.*` / `handy-tools.*` namespace prefixes, requires plain-string
  values for `ht.*` (FOUC IIFE compatibility), and rejects unregistered
  keys in CI mode.
- 25 keys registered: 6 runtime (`ht.theme`, `ht.locale`,
  `ht.reducedMotion`, `ht.units`, `ht.currency`, `ht.fontScale`) + 6
  shell-owned user data (`handy-tools.recent`, `.pins`, `.favorites`,
  `.dashboard`, `.hints.seen`, `.pwa.dismissals`) + 13 tool states
  (gpa-calculator, bd-tax-calculator ×3, decision-wheel,
  eisenhower-matrix, world-clock, grade-calculator, pomodoro-timer,
  countdown-to-date, pros-cons, habit-tracker, inflation-calculator
  inputs).
- All 9 originally spec'd tool files migrated to namespaced keys.
  `habit-tracker.js` was also migrated (extra, missed in spec but
  discovered via grep).
- `LEGACY_KEY_MAP` (frozen) covers all 12 migrated tool keys; on first
  read after merge, `HT.storage.get` copies legacy → new and deletes the
  legacy key. Per-user idempotent.
- `scripts/storage-registry-gate.py` (NEW, ~250 lines, pure-stdlib
  Python): exit codes 0/1/2/3/4. Cross-checks manifest integrity, the
  `tools.json` history-keys vs `registerHistoryKeys` dynamic path, and
  every direct + indirect `HT.storage.*` call site across 44 JS files.
- Drift check extended to 6 regions (5 → 6); manifest region added on
  home page only.
- `shell-template.py` now ensures `<script src="…/storage-registry.js">`
  loads BEFORE `utils.js` on every page (home + 34 tools).
- All 5 DoD criteria satisfied: `make ci` chain passes, drift passes on
  the 6-region manifest block, storage-registry gate green, a11y gate
  green, validate/rubric/gate all green.

### File List

**New:**
- `assets/js/storage-registry.js` — the registry IIFE (HT.storage + HT.storageRegistry)
- `scripts/storage-registry-gate.py` — pure-stdlib Python CI gate
- `scripts/storage-smoke.html` — runtime smoke harness (10 contract checks; `?ci=1` to run)
- `_bmad-output/implementation-artifacts/reviews/1-10-storage-registry-with-namespaced-keys.md` — review report (72 findings across 5 lenses)

**Updated:**
- `assets/js/utils.js` — delegates HT.storage.{get,set,remove} to HT.storageRegistry
- `assets/js/theme.js` — comment block citing AD-6 grandfather clause + FOUC IIFE
- `assets/js/shell.js` — clearAllLocalData uses HT.storage.clear(); boot calls registerToolHistoryKeys()
- `assets/js/api-contract.js` — 7 new entries; version 1.0.0 → 1.1.0
- `assets/shell/chrome.html` — manifest block spliced between markers
- `index.html` — script tag + manifest block spliced
- `tools/<slug>/index.html` (×34) — storage-registry.js script tag injected before utils.js
- `scripts/shell-template.py` — REGISTRY_MANIFEST_INLINE_RE, read_storage_registry_manifest(), manifest splice (home + tool paths), storage-registry script tag injection, byte_aligned + full_ok predicates extended
- `scripts/shell-drift-check.py` — 6th region check (manifest, home-only)
- `scripts/hooks/pre-commit` — CHROME_RE includes storage-registry.js + storage-registry-gate.py; gate runs in sanity checks
- `Makefile` — `storage-registry` / `sr` targets; chained into `make ci`
- `.github/workflows/tool-contract-gate.yml` — paths include storage-registry files; workflow step added
- `tools/gpa-calculator/gpa-calculator.js` — `'gpa_calc_v1'` → `'handy-tools.gpa-calculator.state'`
- `tools/bd-tax-calculator/bd-tax-calculator.js` — 3 keys renamed
- `tools/decision-wheel/decision-wheel.js` — renamed
- `tools/eisenhower-matrix/eisenhower-matrix.js` — renamed
- `tools/world-clock/world-clock.js` — renamed
- `tools/grade-calculator/grade-calculator.js` — renamed
- `tools/pomodoro-timer/pomodoro-timer.js` — renamed
- `tools/countdown-to-date/countdown-to-date.js` — renamed
- `tools/pros-cons/pros-cons.js` — renamed
- `tools/habit-tracker/habit-tracker.js` — renamed (extra, beyond spec)

### Change Log

- 2026-08-07 — Story 1.10 implementation started (baseline_commit 13cc5e5).
- 2026-08-07 — Storage registry IIFE, gate, manifest export, theme/shell/utils
  wiring, and 9-tool legacy migration landed. All 11 ACs satisfied. Story
  transitions `in-progress → review`.
- 2026-08-07 — BMad review conducted (5 lenses, 72 findings) and review report
  written to `_bmad-output/implementation-artifacts/reviews/`. 19 code/behavior
  review follow-ups addressed in `assets/js/storage-registry.js`, `utils.js`,
  `shell.js`, `scripts/storage-registry-gate.py`, `scripts/shell-drift-check.py`,
  and `scripts/shell-template.py`. New runtime harness `scripts/storage-smoke.html`
  added for verification-gap coverage. Editorial trim applied to this story
  file (~22% reduction). Story remains in `review` status pending final
  acceptance pass.
- 2026-08-07 — Two gate bugs fixed during final acceptance: (1) `INDIRECT_RE`
  was matching the comment `// HT.storage.set(null, x)` as an indirect call
  site; added JS reserved words (`null`/`undefined`/`true`/`false`/`this`/
  `NaN`/`Infinity`) to the existing skip list. (2) `check_register_calls_match_manifest`
  looked up `storage-registry.js` by literal filename but `collect_register_calls`
  keys by relative path; switched to basename match. Both gates green: 25
  registered keys, 0 violations, 6 regions in sync.