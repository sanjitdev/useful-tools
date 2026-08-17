# Story 10.5 — Recommendation module (`HT.recommend.match`)

**Slug:** `recommend-module`
**Status:** backlog
**Date:** 2026-08-17
**Brainstorm:** `_bmad-output/brainstorming/brainstorm-discovery-engine-2026-08-17/`
**AC gate (working tree):** `scripts/dc/dc-4-recommend.py`

---

## Context

Carlos takes the Car Finder quiz and expects to see Toyota Corolla + a link to the loan calculator. The Discovery Engine is a **router** to the existing utility surface, not a destination. The recommend module ranks `tools.json` entries by answer match, surfaces the top 3, and excludes tools the user already visits.

## Goal

Ship `HT.recommend.match(answers, catalog, scoring)` returning the top 3 tools ranked by score; handle empty answers with a subtle fallback line; exclude tools in the user's recent list.

## Files added

| Path | Purpose |
|---|---|
| `assets/js/recommend.js` | Frozen `HT.recommend` module — `match` + `catalogFromTools`. |
| `scripts/dc/dc-4-recommend.py` | AC gate — top-3 ranking + recent exclusion + empty fallback. |

## Files modified

| Path | Change |
|---|---|
| `assets/js/api-contract.js` | Version bumped; `HT.recommend` registered as `stable`. |
| `assets/js/shell-thin.js` | Page-conditional Proxy wiring. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Story 10.5 entry. |

## Public API (`HT.recommend`)

```js
HT.recommend.match(answers: object, catalog: Tool[], scoring: object) → ToolMatch[]
HT.recommend.catalogFromTools(toolsJson: object, filter?: object) → Tool[]

ToolMatch = { slug: string, title: string, displayName: string, score: number (0..100), categoryBadge: string }
```

`score = Σ (answerMatch * weight) / Σ weight`, where `answerMatch` is computed against each tool's `keywords[]` + `category` + `pack`. Excludes tools in `HT.recent.list()`. Empty answers returns an empty array; the caller renders the fallback line.

## Verification

- `python scripts/dc/dc-4-recommend.py` → PASS (top-3 ranking correct; recent exclusion correct; empty fallback correct).
- `HT.recommend` registered in `api-contract.js`.

## Out-of-scope (deferred)

- Story 10.7 (6 MVP quizzes) — defines the catalog-shape `kind: catalog` entries.
- Story 10.10 (result card chrome) — renders the top-3 in the "Tools for you" section.

---

*Story doc — frontmatter + 7 sections, ~50 lines.*