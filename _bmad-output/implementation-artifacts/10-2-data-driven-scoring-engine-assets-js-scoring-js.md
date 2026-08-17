# Story 10.2 — Data-driven scoring engine (`assets/js/scoring.js`)

**Slug:** `scoring-engine`
**Status:** backlog
**Date:** 2026-08-17
**Brainstorm:** `_bmad-output/brainstorming/brainstorm-discovery-engine-2026-08-17/`
**AC gate (working tree):** `scripts/dc/dc-1-scoring.py`

---

## Context

Every quiz in the Discovery Engine produces an archetype + trait bars + blind spot from user answers. The scoring function must be **pure** (no I/O, no time, no random, no PII) and **deterministic** (same answers → same result) so that a Challenge URL can be reproduced exactly. The 2026-08-14 brainstorm's "scoring engine" was a partial scaffold at `assets/js/scoring.js`; this story formalizes it as `HT.scoring`.

## Goal

Ship `HT.scoring.compute(answers, scoringDef)` as a stable Shell Public API surface; verify determinism across 100 random `answers` vectors.

## Files added

| Path | Purpose |
|---|---|
| `assets/js/scoring.js` | Frozen `HT.scoring` module — `compute` + `traitMax`. |
| `scripts/dc/dc-1-scoring.py` | AC gate — determinism + purity assertions (100 random vectors). |

## Files modified

| Path | Change |
|---|---|
| `assets/js/api-contract.js` | Version bumped; `HT.scoring` registered as `stable`. |
| `assets/js/shell-thin.js` | Page-conditional Proxy wiring (loads scoring.js on first `HT.scoring.*` call). |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Story 10.2 entry. |

## Public API (`HT.scoring`)

```js
HT.scoring.compute(answers: object, scoringDef: object) → {
  archetype: string,
  traits: [{ id: string, value: number, pct: number }],
  blindSpot: string
}
HT.scoring.traitMax: { [traitId: string]: number }
```

`scoringDef = { archetypeMap: [{archetype, weightMap}], traits: [{id, max}], blindSpotFor: archetype => string }`. Same `answers + scoringDef` always returns the same triple (no I/O, no time, no random, no PII access).

## Verification

- `python scripts/dc/dc-1-scoring.py` → PASS (100 random vectors all deterministic).
- `HT.scoring` registered in `api-contract.js` at version `1.22.0`.
- 0 fetch / XHR / localStorage calls inside scoring.js (AD-9 + AD-14 boundary).

## Out-of-scope (deferred)

- Story 10.3 (results module) — consumes `HT.scoring.compute`.
- Story 10.4 (challenge module) — consumes `HT.scoring.compute` for `encode/decode`.
- Story 10.5 (recommend module) — consumes `HT.scoring.compute` for ranking.

---

*Story doc — frontmatter + 7 sections, ~50 lines.*