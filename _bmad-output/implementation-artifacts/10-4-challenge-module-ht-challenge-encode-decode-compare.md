# Story 10.4 — Challenge module (`HT.challenge.encode / decode / compare`)

**Slug:** `challenge-module`
**Status:** backlog
**Date:** 2026-08-17
**Brainstorm:** `_bmad-output/brainstorming/brainstorm-discovery-engine-2026-08-17/`
**AC gate (working tree):** `scripts/dc/dc-3-challenge.py`

---

## Context

The viral loop is "Challenge a Friend" — Sanjit takes a quiz, taps Challenge, gets a URL ≤ 80 chars, pastes it in any chat. Maya opens it, takes the quiz blind, and sees a side-by-side compatibility view. The URL must be **content-addressed** (deterministic from answers), **versioned** (spec-version lets the runtime reject mismatched quizzes), and **privacy-respecting** (no free-text, no PII, just the seed).

## Goal

Ship `HT.challenge.encode(state, archetype, spec)` → URL ≤ 80 chars; `decode(seed, spec)` round-trips; `compare(seedA, seedB, spec)` returns compatibility + agree/disagree + blind-spot delta.

## Files added

| Path | Purpose |
|---|---|
| `assets/js/challenge.js` | Frozen `HT.challenge` module — `encode / decode / compare`. |
| `scripts/dc/dc-3-challenge.py` | AC gate — round-trip + length + spec-version mismatch assertions. |

## Files modified

| Path | Change |
|---|---|
| `assets/js/api-contract.js` | Version bumped; `HT.challenge` registered as `stable`. |
| `assets/js/shell-thin.js` | Page-conditional Proxy wiring. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Story 10.4 entry. |

## Public API (`HT.challenge`)

```js
HT.challenge.encode(state: object, archetype: object, spec: { quiz: string, version: number }) → string
HT.challenge.decode(seed: string, spec: object) → { archetype: string, traits: object }
HT.challenge.compare(seedA: string, seedB: string, spec: object) → {
  compatibility: number,    // 0..100
  agree: string[],          // trait ids
  disagree: string[],       // trait ids
  blindSpotDelta: string
}
```

URL shape: `https://handy.tools/disc/<slug>/#seed=<base36>&spec=<quiz>@<version>` (total ≤ 80 chars). Seed = `base36(cyrb53(JSON.stringify(answers)))` — 53-bit hash. Spec-version mismatch returns `{ code: 'spec-mismatch', version, supported }`.

## Verification

- `python scripts/dc/dc-3-challenge.py` → PASS (round-trip across 6 MVP quizzes; URL ≤ 80 chars; spec-mismatch error path).
- `HT.challenge` registered in `api-contract.js`.

## Out-of-scope (deferred)

- Story 10.12 (challenge UX) — receiver-side landing page + consent toggle.

---

*Story doc — frontmatter + 7 sections, ~50 lines.*