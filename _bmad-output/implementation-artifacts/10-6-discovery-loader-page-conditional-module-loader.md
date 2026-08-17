# Story 10.6 — Discovery loader (page-conditional module loader)

**Slug:** `discovery-loader`
**Status:** backlog
**Date:** 2026-08-17
**Brainstorm:** `_bmad-output/brainstorming/brainstorm-discovery-engine-2026-08-17/`
**AC gate (working tree):** `scripts/dc/dc-5-loader.py`

---

## Context

The home page must NOT pay the cost of any Discovery Engine bundle. Only `/disc/<slug>/` pages should load scoring + results + challenge + (optionally) recommend. The Shell's page-conditional loader pattern (Story 9.12 for `HT.quiz`) is the precedent — extend it to Discovery.

## Goal

Ship `packs/discovery-loader.js` that page-conditionally loads only the modules the current quiz needs; verifies the home page has zero Discovery Engine scripts; registers the loaded modules on `HT.*` via `HT.provide`.

## Files added

| Path | Purpose |
|---|---|
| `packs/discovery-loader.js` | Page-conditional module loader — reads `<link rel="discovery-modules">` from the quiz page, inserts the matching `<script>` tags after first paint. |
| `scripts/dc/dc-5-loader.py` | AC gate — home page has 0 Discovery scripts; quiz page has exactly the required modules. |

## Files modified

| Path | Change |
|---|---|
| `index.html` | Unchanged — loader runs only on `/disc/<slug>/`. |
| `packs/disc/<slug>/index.html` | Each quiz page declares `<link rel="discovery-modules" data-modules="scoring,results,challenge[,recommend]">`. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Story 10.6 entry. |

## Public API (loader pattern)

```js
// Inside packs/discovery-loader.js
function mountDiscoveryPage(quizSlug, moduleDefs) {
  // For each module-def.kind, insert <script src="/assets/js/<kind>.js" defer> after first paint
  // Register each loaded module's API on HT.<domain> via HT.provide
  // Verify against api-contract.js (manifest-bound, per AI-E1-3)
}
```

No fetch on baseline. If the quiz needs `kind: catalog`, fetch `/packs/disc/<slug>/catalog.json` (a slice of `tools.json`) — no fetch otherwise.

## Verification

- `python scripts/dc/dc-5-loader.py` → PASS (home page: 0 Discovery scripts; each quiz page: exactly the modules it needs).
- Brownfield clean: existing tools' `<script>` tags unchanged.
- `HT.provide` registration verified against `api-contract.js`.

## Out-of-scope (deferred)

- Story 10.7 (6 MVP quizzes) — declares the per-quiz module-def lists.
- Story 10.16 (bundle size) — enforces the per-quiz 8 KB budget.

---

*Story doc — frontmatter + 7 sections, ~50 lines.*