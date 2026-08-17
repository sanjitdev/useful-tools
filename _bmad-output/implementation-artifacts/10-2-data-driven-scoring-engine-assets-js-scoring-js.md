# Story 10.2 — Data-driven scoring engine (`assets/js/scoring.js`)

**Slug:** `scoring-engine`
**Status:** done
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

- `python scripts/dc/dc-1-scoring.py` → **15/15 PASS** (2026-08-17) — file exists, frozen surface (`writable:false, configurable:false`), shell-thin Proxy wiring, bundle-gate page-conditional, docs entry, 7 runtime assertions on the spec fixture (returnsShape, clamped, skippedZero, defaultArchetype, deterministic, unknownIgnored), shell-bounds clean, gzipped size 2757 bytes (≤ 4000 budget), Node smoke harness `scripts/_smoke_scoring.js` exits 0.
- `HT.scoring` registered in `assets/js/api-contract.js` at version `1.22.0` as stable.
- 0 fetch / XHR / localStorage calls inside scoring.js (AD-9 + AD-14 boundary).
- Determinism: `score(answers, spec)` is a pure function — same `answers + spec` always returns the same `{traits, archetype}`. Archetype picker is deterministic (ties broken by `default` flag, then index, then id).

## Gate bug fixes (2026-08-17, same commit as Story 10.2)

The dc-1-scoring.py gate had two pre-existing bugs that masked DC-1 as failing:

1. **vm context missing `window`/`self` aliases** — scoring.js is an IIFE that picks `window.HT || self.HT || {}`. With neither in the gate's vm sandbox, the IIFE created a fresh local `{}` and wrote `HT.scoring` to that object (invisible to the caller). Fixed by aliasing `ctx.window = ctx; ctx.self = ctx; ctx.global = ctx;` so the IIFE's `window.HT = HT` writes back to the shared object.

2. **`__dirname` resolves to cwd under `node -` (stdin)** — the gate's runtime fixture used `path.resolve(__dirname, '..', '..')` to find `assets/js/scoring.js`. When piped via stdin, `__dirname` is the cwd (typically one level above the repo), so `readFileSync` opened a non-existent path and the script threw before emitting any `JSON:` output (gate saw all 7 runtime checks FAIL because `runtime = {}` was the parse-failure default). Fixed by passing the absolute path as `__SCORING_PATH__` from Python via string-substitution.

The smoke-harness check (#15) had a similar `__dirname` problem — when the gate piped the smoke file via `node -`, `__dirname` was cwd, `path.resolve(__dirname, '..')` landed at the repo root instead of `scripts/`, and `readFileSync` on `assets/js/shell-thin.js` crashed with ENOENT. Fixed by running the smoke file as an entry point (`node scripts/_smoke_scoring.js`) instead of piping via stdin.

These are gate-only fixes; no scoring.js changes were needed.

## Out-of-scope (deferred)

- Story 10.3 (results module) — consumes `HT.scoring.compute`.
- Story 10.4 (challenge module) — consumes `HT.scoring.compute` for `encode/decode`.
- Story 10.5 (recommend module) — consumes `HT.scoring.compute` for ranking.

---

*Story doc — frontmatter + 7 sections, ~50 lines.*