# Story 1.14 — Shell Public API and Bypass Prohibition

Status: done

baseline_commit: dcdcacb9ee97e1be0580deb15eda10c3a9522bc4

## Story

**As a** developer extending the Shell,
**I want** a documented `HT.*` namespace that all Shell features expose and that Tools may not bypass,
**so that** the dependency direction Shell→Tool (AD-13) is enforceable.

## Source

- **Origin:** AD-14 in `_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` line 183.
- **Binds:** FR-7, FR-8, FR-9, FR-11, FR-12, FR-13, AD-4, AD-13.
- **Prevents:** two Shell modules or two Tools implementing the same conceptual API differently; silent breaking changes when a Shell module is refactored; Tools reaching past the Shell for `localStorage` / `fetch` / `XMLHttpRequest` and quietly defining new APIs.

## Acceptance Criteria

### AC-1 — `HT.*` namespace is documented at `docs/shell-public-api.md`

The doc lists every public entry with **signature**, **stability** (`stable` | `experimental` | `internal`), and **owning module**. The runtime source of truth is `assets/js/api-contract.js`; if the two ever disagree, the manifest wins and the doc is updated in a follow-up.

**Status:** done — `docs/shell-public-api.md` ships this story. The doc's §5 table is the human-readable mirror of `assets/js/api-contract.js`.

### AC-2 — `HT.provide(slug, api)` is the only path a Tool uses to register an API

Per AD-14, a Tool that wants to expose an API to other Tools calls `HT.provide.register(slug, api)`. The registry enforces:

- uniqueness — `slug` may only be registered once per page lifetime,
- frozen shape — `api` is frozen by `Object.freeze` after registration,
- kebab-case slug — `^[a-z][a-z0-9-]*[a-z0-9]$`, 2-64 chars; bad slug throws.
- non-object API — `null` or primitives throw.

A consumer reads the API back via `HT.use.get(slug)`.

**Status:** done — `HT.provide` and `HT.use` are implemented in `assets/js/shell.js` (top of the IIFE, before the boot orchestrator). The smoke harness `scripts/_smoke_shell_public_api.js` validates 20 assertions across the surface.

### AC-3 — `HT.net` is the only network API Tools may use

The Shell wires `HT.net.get`, `HT.net.head`, and `HT.net.abort`. `HT.net.get` wraps `fetch` with a single-flight abort per `(method, url)` pair so a superseding call cancels the previous one. Tools must NOT call `fetch()` or `XMLHttpRequest` directly.

**Status:** done — `HT.net` is implemented in `assets/js/shell.js` next to `HT.provide` / `HT.use`. The bypass grep flags direct `fetch(...)` / `new XMLHttpRequest()` / `XMLHttpRequest` references under `tools/<slug>/<slug>.js`.

### AC-4 — CI fails if any code under `tools/<slug>/<slug>.js` reaches `localStorage`, `document.cookie`, `fetch`, `XMLHttpRequest`, or `HT.provide` directly

The bypass check is `scripts/shell-bounds-check.py`, wired into `.github/workflows/shell-bounds-check.yml` and `make shell-bounds`. The script is pure-stdlib Python, exits 0 on clean, 1 on any violation, prints a Markdown report.

**Allowlist (intentional, see `docs/shell-public-api.md` §6):**
1. Inline `<script>` blocks in `tools/<slug>/index.html` are **not scanned** — the FOUC IIFE must call `localStorage.getItem('ht.theme')` before `storage-registry.js` parses (AD-15 grandfather).
2. The defensive fallback pattern below is allowlisted as a whole block:
   ```js
   if (HT.storage && HT.storage.<op>) {
     HT.storage.<op>(...);
   } else {
     localStorage.<op>(...);
   }
   ```
   The `else` branch's `localStorage` call is tolerated ONLY when the matching `if` arm calls `HT.storage.<op>` on the same key. Single-line `if/else` without braces is NOT supported — none of the existing 35 tool files use it; if a future tool does, the gate will flag the localStorage call and the dev agent must convert it to a brace block.

**Concrete state as of this story:**
- 35 tool files scanned
- 0 bypass violations
- The defensive fallback in `tools/lifespan-simulator/lifespan-simulator.js` lines 880-894 is allowlisted correctly (the lifecycle fallback detector walks past both the `if` and the `else` braces).

### AC-5 — `HT.provide` / `HT.use` / `HT.net` are exposed at `api-contract.js` with stability levels

The runtime contract at `assets/js/api-contract.js` (version bumped `1.3.0` → `1.4.0` by this story) carries frozen entries for:

| Entry | Stability | Module |
|---|---|---|
| `HT.provide` | stable | shell.js |
| `HT.use` | stable | shell.js |
| `HT.net.get` | stable | shell.js |
| `HT.net.head` | stable | shell.js |
| `HT.net.abort` | stable | shell.js |
| `HT.provideRegistry` | internal | shell.js |
| `HT.useRegistry` | internal | shell.js |
| `HT.netRegistry` | internal | shell.js |

The site-config gate's `EXPECTED_VERSION` pin was bumped from `1.3.0` to `1.4.0` to match.

### AC-6 — `shell-bounds-check` workflow runs on every PR

`.github/workflows/shell-bounds-check.yml` runs on:
- all PRs that touch `tools/**`, `scripts/shell-bounds-check.py`, `scripts/_smoke_shell_public_api.js`, `docs/shell-public-api.md`, `assets/js/shell.js`, `assets/js/api-contract.js`, `assets/js/utils.js`, `assets/js/storage-registry.js`, the workflow itself, or the Makefile,
- all pushes to `main` that touch the same paths,
- `workflow_dispatch` (manual trigger).

The workflow has two steps:
1. `make shell-bounds` — fail on any direct `localStorage` / `document.cookie` / `fetch` / `XMLHttpRequest` / `HT.provide` reference under `tools/<slug>/<slug>.js`.
2. `make shell-public-api-smoke` — Node smoke harness that asserts the `HT.provide` / `HT.use` / `HT.net` surface is frozen, the register/use round-trip works, and validation rules fire on bad input. 20 PASS expected.

The workflow is `permissions: contents: read` only; the gate is read-only.

### AC-7 — `make shell-bounds` and `make shell-public-api-smoke` are wired into `make ci`

`make ci` now chains: `validate rubric-all gate site-config site-config-smoke storage-registry shell-drift shell-a11y verify-compound compound-smoke shell-bounds shell-public-api-smoke`.

`make help` lists both new targets.

## Implementation Notes

- **Why scan `tools/<slug>/<slug>.js` only, not `index.html`?** The FOUC IIFE in `index.html` is the only path that must call `localStorage.getItem('ht.theme')` before `storage-registry.js` parses — that's the AD-15 grandfather rule. Scanning inline `<script>` blocks would require either parsing HTML or shipping a regex that breaks the moment someone reformats the IIFE. The clean separation is "tool JS = gated, inline scripts = not." The defensive-fallback allowlist catches the lifecycle pattern that pre-dates the registry.
- **Why a single-flight `HT.net`?** Tools that issue multiple requests in rapid succession (e.g. autocomplete, search-as-you-type) need to cancel superseded requests. The single-flight pattern handles this with one `AbortController` per `(method, url)`. The `HT.net.abort(key)` API lets Tools cancel explicitly by key.
- **Why expose `HT.provideRegistry` / `HT.netRegistry`?** The bypass gate and the smoke harness need a way to read the registered slugs and the in-flight requests. Keeping those as `internal` stability (per AD-14) ensures Tools that reach for them are *visible* to code review.

## Tests

- `make shell-bounds` — runs the bypass check.
- `make shell-public-api-smoke` — 20 assertions on the `HT.provide` / `HT.use` / `HT.net` surface.
- `make ci` — full chain; both new targets included.

## Files Touched

- `assets/js/shell.js` — added `HT.provide`, `HT.use`, `HT.net`, `HT.provideRegistry`, `HT.netRegistry`. ~110 lines added; existing boot logic untouched.
- `assets/js/api-contract.js` — added 8 entries (5 stable + 3 internal); version bumped 1.3.0 → 1.4.0.
- `scripts/shell-bounds-check.py` — new file (~270 lines).
- `scripts/_smoke_shell_public_api.js` — new file (~115 lines).
- `scripts/site-config-gate.py` — `EXPECTED_VERSION` pin 1.3.0 → 1.4.0 (in 3 places).
- `.github/workflows/shell-bounds-check.yml` — new file.
- `Makefile` — new targets; `ci` chain extended.
- `docs/shell-public-api.md` — new file.

---

*Status: done. Sprint status flipped to `done` in
`_bmad-output/implementation-artifacts/sprint-status.yaml`.*

## Residue & Deferred

Added retroactively on 2026-08-12 (AI-E1-12 from the Epic 1 retrofit audit).
Story 1.14 froze the `HT.*` public surface, but two items were
recognized as out of scope:

- **Per-surface frozen handles (`HT_X_INIT` / `HT_X_VERSION`).** The
  AD-14 global freeze was applied to the contract surface as a whole
  but individual surfaces (palette, settings, search, storage, home
  grid) lack per-surface `HT_X_INIT` / `HT_X_VERSION` constants. The
  audit's F9 finding calls this "low priority"; no action is
  scheduled. *Reason deferred:* cross-cutting concern that needs a
  dedicated stabilization story, not a per-surface one.
- **`shell-public-api-smoke` HTML harness was added later, not in
  this story.** This story shipped the freeze + the API-contract
  doc; the browser smoke that enforces the freeze was added in a
  follow-up (Epic 2). The `docs/shell-public-api.md` doc is the
  interim contract; the smoke hardens it. *Reason deferred:* harness
  scope out — the freeze + doc is the contract; the smoke is the
  enforcer.
