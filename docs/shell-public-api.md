# Shell Public API Contract (AD-14)

**Status:** active
**Story:** [1.14 — Shell Public API and Bypass Prohibition](../_bmad-output/planning-artifacts/epics.md#story-114-shell-public-api-and-bypass-prohibition)
**Architecture binding:** AD-14, AD-13
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
the canonical, machine-verified list — version `1.3.0` as of this writing).

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
| `HT.search` | stable | search.js |
| `HT.siteConfig` | stable | site-config.js |
| `HT.provide` | stable | shell.js (this story) |
| `HT.use` | stable | shell.js (this story) |
| `HT.net.get` | stable | shell.js (this story) |
| `HT.net.head` | stable | shell.js (this story) |
| `HT.net.abort` | stable | shell.js (this story) |
| `HT.provideRegistry` | internal | shell.js (this story) |
| `HT.useRegistry` | internal | shell.js (this story) |
| `HT.netRegistry` | internal | shell.js (this story) |

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

*This document is a load-bearing contract artifact. Do not edit without an
Epic 1 or later story explicitly authorizing the change.*