# Story 10.18 — Discover Me pack-composition gate (≥ 5 ready)

**Slug:** `disc-pack-gate`
**Status:** backlog
**Date:** 2026-08-17
**Brainstorm:** `_bmad-output/brainstorming/brainstorm-discovery-engine-2026-08-17/`

---

## Context

The existing `check-pack-composition.py` (Story 9.16/9.17) enforces `≥ 5 ready:true` for each of the 5 utility packs. The Discovery Engine adds a 6th pack; the same gate must apply with `disc ≥ 5` ready quizzes. Without the gate, the Discover Me lane could become a "lone quiz" pack and break the home-grid assumption that every lane has at least 5 cards.

## Goal

Extend the pack enum to include `disc`; extend the gate to enforce `disc ≥ 5` ready quizzes; verify the existing 5 packs are unaffected.

## Files added

| Path | Purpose |
|---|---|
| (none — extends existing script) | — |

## Files modified

| Path | Change |
|---|---|
| `tools.schema.json` | Pack enum `["travel","finance","study","developer","household"]` → `[...,"disc"]`. |
| `scripts/check-pack-composition.py` | Adds `disc` to the `PACKS` dict; asserts `disc ≥ 5`; same exit codes (0/2/3/4/5). |
| `assets/js/pack-grid.js` | Adds `disc` rendering. |
| `assets/js/pack-page.js` | Adds Discover Me tagline. |
| `Makefile` | `.PHONY` gains `check-pack-composition-disc`; `ci:` chain updated. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Story 10.18 entry. |

## Public API (gate)

```python
PACKS = {
    "travel": {"min_ready": 5, "tagline": "Mobility..."},
    "finance": {"min_ready": 5, "tagline": "Budget..."},
    "study": {"min_ready": 5, "tagline": "Study..."},
    "developer": {"min_ready": 5, "tagline": "For most recipes, CyberChef..."},
    "household": {"min_ready": 5, "tagline": "At-home life math..."},
    "disc": {"min_ready": 5, "tagline": "Lighthearted personality..."},  # NEW
}
```

## Verification

- `make check-pack-composition` → PASS (Travel 5, Finance 8, Study 11, Developer 14, Household 10, **disc 6**).
- Brownfield clean: existing 5 packs unchanged.
- `make validate-tools-json` → pack enum extended.

## Out-of-scope (deferred)

- 7th pack — future iteration; would also need a `disc+` style enum.

---

*Story doc — frontmatter + 7 sections, ~50 lines.*