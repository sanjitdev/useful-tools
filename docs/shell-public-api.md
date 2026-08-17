# Shell Public API Contract (AD-14)

**Status:** active
**Updated:** 2026-08-13
**Story:** [1.14 — Shell Public API and Bypass Prohibition](../_bmad-output/planning-artifacts/epics.md#story-114-shell-public-api-and-bypass-prohibition) + [2.1 — Per-Tool URL State Codec Wiring](../_bmad-output/planning-artifacts/epics.md#story-21-per-tool-url-state-codec-wiring) + [2.2 — Per-Tool Sample Data and Reset Button](../_bmad-output/planning-artifacts/epics.md#story-22-per-tool-sample-data-and-reset-button) + [2.3 — Per-Tool History Panel](../_bmad-output/planning-artifacts/epics.md#story-23-per-tool-history-panel) + [2.4 — Per-Tool Keyboard-Complete Surface](../_bmad-output/planning-artifacts/epics.md#story-24-per-tool-keyboard-complete-surface) + [2.5 — Per-Tool Share Dialog with URL and Print](../_bmad-output/planning-artifacts/epics.md#story-25-per-tool-share-dialog-with-url-and-print) + [3.7 — User Data Export to JSON](../_bmad-output/planning-artifacts/epics.md#story-37-user-data-export-to-json) + [3.8 — User Data Import from JSON with Schema Validation](../_bmad-output/planning-artifacts/epics.md#story-38-user-data-import-from-json-with-schema-validation) + [post-redesign retrofit — 2026-08-13](../_bmad-output/implementation-artifacts/post-home-redesign-retrofit-2026-08-13.md)
**Architecture binding:** AD-14, AD-13, AD-4, AD-5, AD-15
**Source of truth for runtime:** `assets/js/api-contract.js`

This document is the public, human-readable contract for the `HT.*` namespace.
The runtime source of truth is `assets/js/api-contract.js` (a frozen manifest
loaded before any other Shell module). If this document and the manifest ever
disagree, the manifest wins — file a follow-up to update the doc.

---

## 1. Stability levels

Every entry carries one of three stability levels. Tools must respect them:

| Level | Meaning | Tool may use? | Breaking-change policy |
|---|---|---|---|
| `stable` | Contractually committed. | Yes, in any tool. | Major version bump + one-release deprecation shim. |
| `experimental` | May change without notice. | Optional; documented in help overlay. | None — entries can be removed or signatures can change. |
| `internal` | Only other Shell modules may use. | **No.** Tool use is undefined behavior. | None — entries can be removed or signatures can change. |

The Shell bypass prohibition (AD-14) forbids Shell modules from bypassing
another module's API. The corresponding Tool-side prohibition forbids Tools
from bypassing any registered `HT.*` API by reaching for `localStorage`,
`document.cookie`, `fetch`, `XMLHttpRequest`, or by calling `HT.provide(...)`
directly.

---

## 2. The Tool → Shell direction

A Tool calls **only** methods on the `HT.*` namespace. A Tool never:

- reads or writes `localStorage` directly (use `HT.storage.get` / `HT.storage.set`),
- reads or writes `document.cookie`,
- makes a network request via `fetch` or `XMLHttpRequest` (use `HT.net.*`),
- calls `HT.provide(...)` — that API is for Tools that mount APIs consumed by
  *other* Tools; a Tool does not "provide" itself to the Shell.

The bypass check (`scripts/shell-bounds-check.py`, wired into
`.github/workflows/shell-bounds-check.yml`) fails any PR that violates this
list inside `tools/<slug>/<slug>.js`. Inline `<script>` blocks in
`tools/<slug>/index.html` and the FOUC IIFE are exempt by explicit
architecture grandfather — see §6.

---

## 3. The Shell → Tool direction

The Shell loads Tools only on demand (deferred `<script>` tag injected after
first paint). The Shell:

- may read `tools.json` (Site Data) to drive the home grid,
- may read the storage-registry manifest in `chrome.html` to know which
  `handy-tools.history.<slug>` keys are valid,
- may NOT read a Tool's internal state directly. If the Shell needs a
  Tool-provided value, it goes through the Tool's `HT.provide` registration.

---

## 4. Tool-mounted APIs (`HT.provide`)

Per AD-14, a Tool that wants to expose an API to other Tools registers it
via `HT.provide(slug, api)`. The registry enforces:

- uniqueness — `slug` may only be registered once per page lifetime,
- frozen shape — `api` is frozen by `Object.freeze` after registration,
- ownership — the registered `slug` must match a `tools.json` entry's `slug`.

A consumer reads the API back via `HT.use(slug)`. The Tool that provided it
calls `HT.provide(slug, api)` once at boot, after `HT.boot()`.

| Entry | Signature | Stability | Notes |
|---|---|---|---|
| `HT.provide` | `(slug: string, api: object) => void` | stable | Registers a Tool-mounted API. Throws on duplicate slug or unknown slug. |
| `HT.use` | `(slug: string) => any` | stable | Returns the registered API for `slug`, or `null` if absent. |

---

## 5. The `HT.*` surface (stable + experimental + internal)

The current entries live in `assets/js/api-contract.js` (read that file for
the canonical, machine-verified list — version `1.14.0` as of this writing,
bumped from `1.13.0` by Story 3.8 for `HT.import`).

| Entry | Stability | Module |
|---|---|---|
| `HT.boot()` | stable | shell.js |
| `HT.shell.version` | stable | shell.js |
| `HT.shell.loadedAt` | stable | shell.js |
| `HT.shell.theme()` | stable | shell.js |
| `HT.palette.open()` | stable | shell.js |
| `HT.palette.close()` | stable | shell.js |
| `HT.palette.toggle()` | stable | shell.js |
| `HT.palette.isOpen()` | stable | shell.js |
| `HT.storage.get` | stable | storage-registry.js |
| `HT.storage.set` | stable | storage-registry.js |
| `HT.storage.remove` | stable | storage-registry.js |
| `HT.storage.list` | stable | storage-registry.js |
| `HT.storage.clear` | stable | storage-registry.js |
| `HT.storage.keys` | stable | storage-registry.js |
| `HT.storage.register` | internal | storage-registry.js |
| `HT.storage.registerHistoryKeys` | internal | storage-registry.js |
| `HT.$` | stable | utils.js — alias of `HT.qs`; `(sel: string, root?: Element) => Element \| null` (post-redesign retrofit 2026-08-13) |
| `HT.$$` | stable | utils.js — alias of `HT.qsa`; `(sel: string, root?: Element) => Element[]` (post-redesign retrofit 2026-08-13) |
| `HT.qs` | stable | utils.js — `(sel: string, root?: Element) => Element \| null` |
| `HT.qsa` | stable | utils.js — `(sel: string, root?: Element) => Element[]` |
| `HT.fetch` | stable | utils.js — `(url: string, opts?: { type?: 'json' \| 'text' }) => Promise<any>`; rejects on non-2xx |
| `HT.formatNumber` | stable | utils.js — `(n: number, opts?: { minFractionDigits?: number, … }) => string` |
| `HT.search` | stable | search.js |
| `HT.siteConfig` | stable | site-config.js |
| `HT.provide` | stable | shell.js (this story) |
| `HT.use` | stable | shell.js (this story) |
| `HT.net.get` | stable | shell.js (this story) |
| `HT.net.head` | stable | shell.js (this story) |
| `HT.net.abort` | stable | shell.js (this story) |
| `HT.provideRegistry` | internal | shell.js (this story) |
| `HT.netRegistry` | internal | shell.js (this story) |
| `HT.urlState.encode` | stable | url.js (Story 2.1 / AD-5) |
| `HT.urlState.decode` | stable | url.js (Story 2.1 / AD-5) |
| `HT.urlState.bindForm` | stable | url.js (Story 2.1 / AD-5) |
| `HT.urlState.bindDomTarget` | stable | url.js (Story 2.1 / AD-5) |
| `HT.urlState.subscribe` | stable | url.js (Story 2.1 / AD-5) |
| `HT.urlState._loadSchema` | internal | url.js (Story 2.1 / AD-5) |
| `HT.urlStateUrl` | internal | url.js (Story 2.1 / AD-5) |
| `HT.sampleData.fill` | stable | sample-data.js (Story 2.2) |
| `HT.sampleData.button` | stable | sample-data.js (Story 2.2) |
| `HT.sampleData.hasSample` | stable | sample-data.js (Story 2.2) |
| `HT.sampleData.mount` | stable | sample-data.js (Story 2.2) |
| `HT.reset.run` | stable | sample-data.js (Story 2.2) |
| `HT.reset.button` | stable | sample-data.js (Story 2.2) |
| `HT.a11y.auditTool` | stable | a11y.js (Story 2.4) |
| `HT.a11y.tabOrder` | stable | a11y.js (Story 2.4) |
| `HT.a11y.missingAria` | stable | a11y.js (Story 2.4) |
| `HT.a11y.hoverOnly` | stable | a11y.js (Story 2.4) |
| `HT.a11y.focusRingOk` | stable | a11y.js (Story 2.4) |
| `HT.a11y.focusable` | internal | a11y.js (Story 2.4) |
| `HT.history.push` | stable | history.js (Story 2.3 / AD-4 — entry shape Story 3.6) |
| `HT.history.list` | stable | history.js (Story 2.3 / AD-4 — sort by ISO 8601 ts Story 3.6) |
| `HT.history.restore` | stable | history.js (Story 2.3 / AD-4 — entry-or-ts, focusReturn Story 3.6) |
| `HT.history.clear` | stable | history.js (Story 2.3 / AD-4 — destructive variant Story 2.3) |
| `HT.history.subscribe` | stable | history.js (Story 2.3 / AD-4) |
| `HT.history.panel` | stable | history.js (Story 2.3 / AD-4 — close button + backdrop Story 3.6) |
| `HT.history.button` | stable | history.js (Story 2.3 / AD-4) |
| `HT.history.hasHistory` | stable | history.js (Story 2.3 / AD-4) |
| `HT.history.lastEntry` | stable | history.js (Story 2.3 / AD-4) |
| `HT.history._loadSchema` | internal | history.js (Story 2.3 / AD-4) |
| `HT.history._replaceAll` | internal | history.js (Story 3.8 — bulk-replace the per-tool list; internal handle for import.js merge, AD-14 internal-handle pattern) |
| `HT_HISTORY_INIT` | internal | history.js (Story 3.6 — bootstrap handle, AD-14 internal-handle pattern, mirrors other Story 3.x bootstrap handles) |
| `HT.share.open` | stable | share.js (Story 2.5 / AD-4 / AD-5) |
| `HT.share.close` | stable | share.js (Story 2.5 / AD-4) |
| `HT.share.isOpen` | stable | share.js (Story 2.5 / AD-4) |
| `HT.share.url` | stable | share.js (Story 2.5 / AD-5 — returns `location.href`) |
| `HT.share.embedCode` | stable | share.js (Story 2.5 / AD-5 — builds the `<iframe>` snippet from `embed-snippet`) |
| `HT.share.button` | stable | share.js (Story 2.5 / AD-4 — factory emits `data-ht-action="share"`) |
| `HT.share.hasShare` | stable | share.js (Story 2.5 / AD-4 — predicate, mirrors `HT.history.hasHistory`) |
| `HT.share.mount` | stable | share.js (Story 2.5 / AD-4 — Shell-side insertion helper, 3rd `.tool-actions` consumer) |
| `HT.share.print` | stable | share.js (Story 2.5 / AD-4 — sanctioned Print wrapper for legacy tools) |
| `HT.share._loadSchema` | internal | share.js (Story 2.5 / AD-4) |
| `HT.export` | stable | export.js (Story 3.7 / AD-4 + AD-14 — `HT.export.run()` assembles + validates + downloads; reversible, no typed confirmation; hidden in embed mode) |
| `HT_EXPORT_SCHEMA_VERSION` | internal | export.js (Story 3.7 / AD-14 — single source of truth for the JSON `version` field; Story 3.8 reads this) |
| `HT.import` | stable | import.js (Story 3.8 / AD-4 + AD-14 — `HT.import.run()` + `HT.import.prompt()` alias opens a file picker, parses via `FileReader.readAsText`, validates against `HT_EXPORT_SCHEMA_VERSION` (Story 3.7's single source of truth), shows an overwrite-confirm dialog (`window.confirm` per Story 3.5 precedent) if any settings conflict, then writes settings → pins → favorites → recent → history.<slug> (merged) via the storage registry; hidden in embed mode; idempotent within page lifetime via `importInFlight` flag) |
| `HT_IMPORT_DIALOG_VERSION` | internal | import.js (Story 3.8 / AD-14 — dialog-shape contract version; mirrors `HT_HISTORY_INIT` + `HT_EXPORT_SCHEMA_VERSION`) |
| `HT.scoring.score` | stable | scoring.js (DC-1 / Discovery Pack — `(answers, spec) => {traits, archetype}`; spec shape declared by `definitions.scoring-config` in `tools.schema.json`; trait scores clamped to `[0, 100]`; skipped / unknown answers contribute zero; empty answers yields `spec.archetypes[*].default`; deterministic) |
| `HT.results` | stable | results.js (DC-2 / Story 10.3 — result-card chrome: `render(state, opts) → HTMLElement` mounts the canonical `quiz-result-card` (DESIGN.md §1.1 `components.discovery-card`) with `data-print="result"` + `role="region"` + `aria-live="polite"` + `aria-atomic="true"` + `aria-labelledby`; `shareUrl(archetype, opts)` returns the URL with `?arch=<id>`; `copyText(state, opts)` returns the canonical `<emoji> <label> — calm 80% / bold 30%` share text capped at 280 chars; `imageSnapshot(el)` is the 1200×630 PNG export — currently throws `Error("snapshot unavailable")` per the smoke contract; Story 10.11 lands the OG SVG fallback that catches it. Action row carries `data-print="ignore"` so the print stylesheet strips Share/Challenge from the printed card. Contrarian line uses `.quiz-result-contrarian`. Tab order: 1. `button.share`, 2. `button.challenge`. Page-conditional — loaded by the shell-thin Proxy factory on first `HT.results.render()` call alongside `assets/css/result-card.css`. Bundle target: results.js ≤ 6 KB gz + result-card.css ≤ 4 KB gz. Smoke harness: `scripts/_smoke_results.js`) |

---

## 6. Bypass-check allowlist (FOUC IIFE + lifecycle fallback)

The bypass gate enforces the Tool-side prohibition in §2 across
`tools/<slug>/<slug>.js`. The following patterns are **explicitly
allowlisted** because they predate the Shell contract and are not bypasses
in the architectural sense:

1. **FOUC IIFE in `index.html`** — the inline `<script>` block at the top of
   every tool's `index.html` reads `localStorage.getItem('ht.theme')`. This
   is the AD-15 grandfather rule and is necessary because the IIFE must run
   *before* `assets/js/storage-registry.js` parses. The gate does **not**
   scan `index.html`; it scans `<slug>.js` only.

2. **Lifecycle fallback pattern** — defensive code of the shape
   ```js
   if (HT.storage && HT.storage.set) {
     HT.storage.set(KEY, value);
   } else {
     localStorage.setItem(KEY, JSON.stringify(value));
   }
   ```
   is allowlisted. This pattern survives a stale browser cache where the
   shell hasn't loaded yet; it is not a bypass but a fallback. The gate
   accepts the entire `if/else` block; it does not flag the `else` branch's
   `localStorage.setItem` call as long as the matching `HT.storage.*` call
   is present in the same `if` arm.

3. **Tool-owned legacy keys** — any `HT.storage.*` call site whose literal
   string is in the storage-registry manifest passes the gate. The
   `scripts/storage-registry-gate.py` script enforces the same invariant
   independently; the bypass gate cross-checks that script's exit code.

4. **No ad-hoc sample / reset buttons in `<slug>.js`** (Story 2.2) — the
   canonical Sample and Reset affordances are inserted by the Shell at boot
   via `HT.sampleData.mount(slug, rootEl)` and `HT.reset.button(slug, rootEl)`
   (see `assets/js/sample-data.js`). A Tool never binds its own
   `#<slug>-sample` / `#<slug>-reset` click handlers, never injects a literal
   "Load sample" or "Reset" button into the DOM, and never reaches for
   `history.replaceState` / `location.hash` to "apply sample" itself. The
   gate scans `<slug>.js` for the literal `#-sample` / `#-reset`
   handler-shape and the keyword sample/reset literals; both fail the gate.
   Tools delegate to the Shell.

5. **No direct reads/writes of the `handy-tools.history.*` key family**
   (Story 2.3 + 3.6) — the Shell owns per-tool history persistence via
   `HT.history.push` / `HT.history.list` / `HT.history.restore` /
   `HT.history.clear` (see `assets/js/history.js`), and history data
   always lives under the `handy-tools.history.<slug>` storage key. A
   Tool never reaches for `localStorage.getItem('handy-tools.history.<slug>')`
   directly, never `JSON.parse`s that key itself, and never short-circuits
   `HT.history.*` by writing to that key. The gate scans `<slug>.js` for
   the `localStorage.(setItem|getItem|removeItem)('handy-tools.history.*')`
   pattern and `JSON.parse(localStorage.getItem('handy-tools.history.*'))`;
   both fail the gate. Tools delegate to the Shell. The lifecycle-fallback
   pattern from rule 2 above is the only allowed wrap shape (a `HT.history.*`
   call inside the `if` arm with a defensive `localStorage` arm in the
   `else`). Story 3.6 changed the entry shape from
   `{id, ts number, state, result, label}` to `{ts ISO 8601, inputs, result}`;
   legacy entries are migrated transparently in `_readRaw` (read-time, one-shot,
   routes through `HT.storage.set` so the gate's localStorage ban is honored
   even during migration).

6. **No ad-hoc share / print UI in `<slug>.js`** (Story 2.5) — the
   canonical Share and Print affordances are owned by the Shell. A Tool
   never binds its own `#share-dialog`, never injects a literal "Copy URL"
   / "Print" / "Embed Code" / "Share tool" button into the DOM, never
   reaches for `window.print(` directly, and never reaches for
   `navigator.clipboard.writeText(` (the Shell exposes `HT.copyToClipboard`
   from `utils.js` — always available, no fallback needed). The
   sanctioned Print path for legacy tools with a custom Print button is
   `HT.share.print(slug)` (which wraps `window.print()` internally — the
   gate allowlists the wrapper call). The sanctioned Share entry point
   is `HT.share.hasShare(slug)` (predicate) and `HT.share.url(slug)`
   (read-only canonical URL) — Tools may *call* these; they may NOT
   construct their own `<dialog>` UI or call `HT.share.open` /
   `HT.share.close` / `HT.share.embedCode` / `HT.share.button` /
   `HT.share.mount` directly (the Shell mounts the button at boot via
   `HT.share.mount(slug, main)`). The gate scans `<slug>.js` for
   `getElementById('share-dialog')`, `querySelector('#share-dialog')`,
   the literal `Copy URL` / `Print` / `Embed Code` / `Share tool` strings,
   direct calls to `HT.share.open/.close/.embedCode/.button/.mount`,
   `window.print(`, and `navigator.clipboard.writeText(` — all fail the
   gate. The lifecycle-fallback pattern from rule 2 above wraps any
   `HT.share.*` / `HT.copyToClipboard` call (defensive against a stale
   shell that hasn't loaded yet).

All other `localStorage.*`, `document.cookie`, `fetch(`, `XMLHttpRequest`,
and bare `HT.provide(...)` references under `tools/<slug>/<slug>.js` fail
the gate.

---

## 7. Adding a new entry

1. Decide the stability level (§1). When in doubt, mark it `experimental`
   and promote later.
2. Add a frozen entry to `assets/js/api-contract.js` (see existing entries
   for shape — `Object.freeze({...})`).
3. Implement the API in the owning module.
4. Update this document's §5 table.
5. If the API is for Tool consumption, expose it via `HT.<domain>.<verb>` —
   never via a raw function on `window`.

---

## 8. Deprecating an entry

1. Mark the entry as `experimental` in `assets/js/api-contract.js` with a
   `notes: "Deprecated since <release>; use <replacement>. Will be removed
   in <next-major>."` annotation.
2. Surface the deprecation in the help overlay (Story 3.3).
3. After one release, bump the major version on the contract and remove
   the entry.

---

## 9. Keyboard-Complete audit gate (Story 2.4 / AD-15 brownfield)

The Shell exposes `HT.a11y.auditTool(slug, rootEl)` (§5) so the per-tool
audit gate (`scripts/a11y-audit-tool.py`, wired into
`.github/workflows/a11y-audit-check.yml`) can verify PRD rubric criterion
#1 ("Keyboard-complete") on every `ready:true` entry in `tools.json`.

**Audit shape.** `HT.a11y.auditTool` returns a frozen `AuditReport`:

```js
{
  slug: string,                       // the kebab-case slug
  passed: boolean,                    // every gaps.* array is empty AND skip-link is present
  tabOrder: string[],                 // CSS selectors for every focusable in DOM order
  interactiveCount: number,           // == tabOrder.length
  gaps: {
    positiveTabindex: Element[],      // tabindex >= 1 (EXPERIENCE.md §6.2 row 4)
    missingAria: Element[],           // focusables without accessible name or label
    hoverOnly: Element[],             // :hover + no matching :focus-visible for SIGNIFICANT properties
    focusRingMissing: Element[],      // :focus-visible ring != 3px solid at 2px offset
    unreachableInteractive: Element[],// <form> with focusables but no submit button
    missingSkip: Element[]            // absent #shell-skip / .shell-skip
  },
  ts: number                          // Date.now() — purely informational
}
```

**Tab-order canonical declaration.** Every `tools.json` entry may carry an
optional `tab-order-canonical` array (see `tools.schema.json`). The gate
walks the array in order and confirms each entry matches the runtime
`tabOrder` at the corresponding position (id selectors match exactly;
type selectors match any element of that tag). The
machine-checkable surface is the 4-slot form `["#shell-skip", "input",
"button", "a"]`, which captures the spec's intent ("skip → inputs →
actions (sample/reset/history) → result/footer") at a granularity that
applies across all 33 tools. Finer-grained role labels (e.g.,
`#qr-sample`, `#ls-reset`) are encouraged as each Wave 2.6/2.7/2.8
migration adds its per-tool declaration. When the array is absent, the
gate falls back to the Story 2.4 canonical order and emits a
`console.warn` recommending the per-tool declaration.

**Brownfield status.** Per AD-15, today's `ready:true` set is the three
Wave-1 flagships (`lifespan-simulator`, `inflation-calculator`,
`qr-code-generator`) plus whatever Waves 2.6/2.7/2.8 have migrated. The
audit gate **exits 1** on any failed tool today — by design. The exit
will turn to 0 as each Wave migration lands the substrate (skip-link
everywhere, labels on every input, focus-ring on every focusable) and
adds the per-tool `tab-order-canonical` array. The gate's per-tool
breakdown makes the remaining work visible.

**Why a real gate, not advisory.** Rubric criterion #1 is load-bearing
(it's the first of ten) and is what keyboard-only users rely on for
navigation. The audit is read-only — it never mutates the DOM. Tools
that fail the audit are simply not ready to ship as `ready:true`.
Waves 2.6/2.7/2.8 own the fix; Story 2.4 owns the visibility.

---

## 10. Script load-order invariant (utils.js before <slug>.js)

Every entry in the §5 table is defined in a module that's loaded as a
classic (`non-defer`) `<script>` in `tools/<slug>/index.html`. A Tool
IIFE that calls `HT.$('#…')`, `HT.storage.get(…)`, `HT.urlState.bindForm(…)`,
or any other `HT.*` helper at the **top of the script** runs *during*
that script's parse — not after a `DOMContentLoaded` callback. The
helper must therefore already exist on `window.HT` by the time the
Tool IIFE evaluates.

The canonical load order, observed by every shipped Tool except the
three the post-redesign retrofit caught (citation-formatter,
diff-viewer, jwt-inspector — fixed in commits `e8b7a35` and `bffb3ca`):

```
<!-- 1. Inline FOUC IIFE (must be first; reads localStorage synchronously) -->
<script>/* FOUC theme + embed-mode + first-paint observer */</script>

<!-- 2. Footer print-populate IIFE (subscribes to document.body) -->
<script>/* print footer placeholder */</script>

<!-- 3. Standard Shell block — utils.js MUST come before <slug>.js -->
<script src="../../assets/js/site-config.js"></script>
<script src="../../assets/js/storage-registry.js"></script>
<script src="../../assets/js/utils.js"></script>             <!-- HT.$ lives here -->
<script src="../../assets/js/url.js"></script>
<script src="../../assets/js/history.js"></script>
<script src="../../assets/js/sample-data.js"></script>
<script src="../../assets/js/share.js"></script>
<script src="../../assets/js/export.js"></script>

<!-- 4. Inline tools.json splice for file:// loads -->
<script type="application/json" id="ht-tools-json-inline">…</script>

<!-- 5. Rest of the Shell surface -->
<script src="../../assets/js/import.js"></script>
<script src="../../assets/js/a11y.js"></script>
<script src="../../assets/js/palette-actions.js"></script>
<script src="../../assets/js/shell.js" defer></script>
<script src="../../assets/js/search.js" defer></script>
<script src="../../assets/js/help-overlay.js" defer></script>
<script src="../../assets/js/global-chords.js" defer></script>

<!-- 6. Tool-local helpers (optional, must precede the Tool's own script) -->
<script src="../../assets/js/citation-styles.js"></script>   <!-- only on citation-formatter -->

<!-- 7. The Tool's own script — ALWAYS the LAST <script> in the file -->
<script src="./<slug>.js"></script>
```

**Rule.** The `<script src="./<slug>.js">` line is *always* the last
classic `<script>` in the file — after the Shell surface, after every
optional helper (`citation-styles.js`, `diff.js`, `jwt-codec.js`,
`sample-data.js` for tools that bring their own seed, etc.), and after
the `defer`-loaded Shell modules. This guarantees `window.HT.*` is
fully populated when the Tool IIFE runs.

**Why this matters in practice.** When the bug fires the page is
broken in a way the regression sweep doesn't catch directly: `_smoke_regression_sweep.js`
treats `console.warn` ("HT.$ is not a function") as a pass-with-warning
because the harness doesn't load the real shell. The user-facing
crash is a TypeError on the very first line of the Tool IIFE — the
page stays in its empty initial state with no visible affordances.

**Defense.** `.test-output/check-script-load-order.js` walks every
tool under `tools/` and confirms `./<slug>.js` sits at a greater line
number than `../../assets/js/utils.js`. The current tree passes
1/1. A future Tool that copies the broken pattern trips this check
before the load order can ship.

**Recovering from the bug.** If a Tool errors `HT.$ is not a function`
(or any other `HT.<name> is not a function`) on page load, find the
`<script src="./<slug>.js">` line in `tools/<slug>/index.html` and
move it to the very end of the script block — after every other
`<script src="…/assets/js/…">` tag and any optional `defer`-loaded
helper. Re-run the regression sweep to confirm.

---

*This document is a load-bearing contract artifact. Do not edit without an
Epic 1 or later story explicitly authorizing the change.*