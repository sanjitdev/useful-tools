# Story 10.7 — 6-quiz MVP (Spirit Animal, Future Partner, What Would You Do, Decision Style, Friend Match, Car Finder)

**Slug:** `6-quiz-mvp`
**Status:** backlog
**Date:** 2026-08-17
**Brainstorm:** `_bmad-output/brainstorming/brainstorm-discovery-engine-2026-08-17/`
**AC gate (working tree):** `scripts/dc/dc-6-quiz-mvp.py`

---

## Context

The 20-candidate brainstorm catalog scored 6 quizzes as the MVP shortlist. Each must be hand-authored (emoji + 5-12 questions + 4-8 archetypes + blind spots + scoring DSL) so the Discovery Engine is meaningful on day one.

## Goal

Ship 6 fully-authored quizzes in `packs/disc/<slug>/`, each passing the rubric linter at ≥ 8/10 and the PII lint clean.

## Files added

| Path | Purpose |
|---|---|
| `packs/disc/spirit-animal/{index.html, prompts.json, archetypes.json, scoring.json}` | 5-12 questions, 8 archetypes (🦊 Fox, 🐺 Wolf, 🦉 Owl, 🐢 Turtle, 🦅 Hawk, 🐻 Bear, 🦌 Deer, 🐉 Dragon), 4 traits (intuition, courage, wisdom, patience). |
| `packs/disc/future-partner/{...}` | 10 questions, 6 archetypes, 5 traits (warmth, ambition, humor, loyalty, curiosity). |
| `packs/disc/what-would-you-do/{...}` | 8 scenarios, 4 archetypes (Bold, Cautious, Curious, Compassionate), 4 traits. |
| `packs/disc/decision-style/{...}` | 7 questions, 5 archetypes (Intuitive, Analytical, Collaborative, Spontaneous, Deliberative), 4 traits. |
| `packs/disc/friend-match/{...}` | 9 questions, 6 archetypes, 4 traits. |
| `packs/disc/car-finder/{...}` | 12 questions, 8 archetypes (Commuter, Family Hauler, Road-Tripper, Eco-Conscious, Budget-First, Tech-Lover, Adventure-Ready, Luxury-Comfort), 5 traits. |
| `scripts/dc/dc-6-quiz-mvp.py` | AC gate — rubric ≥ 8/10 per quiz, PII lint clean. |

## Files modified

| Path | Change |
|---|---|
| `tools.json` | New entries for each quiz's module-def (kind: scoring|results|challenge|catalog). |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Story 10.7 entry. |

## Public API (per quiz)

```yaml
# packs/disc/spirit-animal/scoring.json
{
  "spec-version": 1,
  "archetypes": ["🦊 Fox", "🐺 Wolf", "🦉 Owl", "🐢 Turtle", "🦅 Hawk", "🐻 Bear", "🦌 Deer", "🐉 Dragon"],
  "traits": [{"id": "intuition", "max": 30}, {"id": "courage", "max": 30}, {"id": "wisdom", "max": 30}, {"id": "patience", "max": 30}],
  "blindSpotFor": {
    "🦊 Fox": "Cleverness without follow-through — you see the trap but sometimes walk into it anyway.",
    ...
  }
}
```

Each option contributes 1-3 weights across traits; archetype = max-weight-then-stable-tiebreak.

## Verification

- `python scripts/dc/dc-6-quiz-mvp.py` → PASS (6 quizzes × rubric ≥ 8/10 × PII clean).
- `make score-disc-<slug>` → ≥ 8/10 per quiz.

## Out-of-scope (deferred)

- Story 10.17 (docs) — authoring guide for the 7th quiz.
- 7th+ quizzes — future iterations.

---

*Story doc — frontmatter + 7 sections, ~50 lines.*