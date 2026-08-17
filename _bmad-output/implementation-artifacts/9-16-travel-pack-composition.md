---
story_id: 9-16
title: Travel Pack Composition
status: done
---

# Story 9.16 — Travel Pack Composition

## Context

**Why now.** Epic 9 ships 5 new tools (paint-calculator, area-volume, budget-planner, savings-goal, currency-converter) and 7 backlog stories, but the Travel pack page (`packs/travel.html`) only carries tools that pre-date Epic 9. With `currency-converter` finally live (Story 9.15), the Travel pack reaches its AC-mandated 5-tool composition. This story authorsthe CI gate (`scripts/check-pack-composition.py`) that enforces the Travel pack membership and tightens the WAVE_2/WAVE_3 canonical rosters so the new gate is durably satisfied.

## Acceptance Criteria (verbatim from epics.md:1569-1580)

> **Given** the user visits `/packs/travel`
> **When** the page renders
> **Then** it shows the Travel pack description `Split bills, convert currencies, scale recipes abroad, handle time zones` and a grid of travel-relevant tools rendered by filtering `tools.json` for `pack === 'travel' && ready === true`
> **And** the pack has at least 3 promoted tools (existing: `currency-converter`, `tip-calculator`, `unit-converter`) plus at least 2 new tools from Stories 9.7-9.15 (specifically: `recipe-scaler` (Story 9.9) and `exam-countdown` (Story 9.8) — these are the two new travel-relevant tools whose description involves travel scenarios; `time-zone-converter` is NOT a Story 9.7-9.15 deliverable and is not required for this pack); the CI test `scripts/check-pack-composition.py` asserts exactly that the Travel pack contains the 5 specific tools listed above (`currency-converter`, `tip-calculator`, `unit-converter`, `recipe-scaler`, `exam-countdown`) and fails if any is missing or if any tool not in this list has `pack === 'travel'`

## Implementation

### The gate: `scripts/check-pack-composition.py`

Pure-stdlib Python. Reads `tools.json`, filters to `ready:true` tools, and:

1. **Taxonomy check** — rejects any tool with a `pack` value outside the enum `{travel, finance, study, developer, household, fun}`. Exit code 4 on violation.
2. **Travel pack exact-match** — the `travel` pack must contain EXACTLY the 5 AC-mandated tools. Exit code 2 on missing/extra members.
3. **Story 9.17 pack-size minimums** — finance / study / developer / household each have ≥ 5 ready:true tools. Exit code 5 on below-minimum.
4. **Vacuous-pass guard** — exits 3 if no ready:true tools exist (per project no-hollow-runs convention).

The gate mirrors the `_pack_tags.py` / `check-pack-taxonomy.py` pattern: find repo root via `SCHEMA_FILENAME` walk, strict JSON shape validation, informative stderr on failure.

### Pack roster changes

To satisfy the AC's "exactly 5" requirement:

| Tool | Before | After | Rationale |
|---|---|---|---|
| `tip-calculator` | `["finance"]` | `["finance", "travel"]` | AC requires travel |
| `unit-converter` | `["developer"]` | `["developer", "travel"]` | AC requires travel |
| `recipe-scaler` | `["travel"]` | `["travel", "household"]` | Dual-pack satisfies 9.16 (travel) + 9.17 (household) |
| `world-clock` | `["travel"]` | `["study"]` | Removed from travel — timezone is academic scheduling |
| `countdown-to-date` | `["travel"]` | `["study"]` | Removed from travel — countdowns for studying |
| `date-difference` | `["travel"]` | `["study"]` | Removed from travel — date math for planning |

`currency-converter` (Story 9.15) and `exam-countdown` (Story 9.8) already carry `["travel"]` and were left as-is.

The dual-pack approach (`tip-calculator: ["finance", "travel"]`) preserves each tool's primary pack membership — the CI gate counts both, so `finance` still has 8 tools and `travel` reaches its 5-tool composition.

### WAVE_2_PACKS / WAVE_3_PACKS alignment

The `_pack_tags.py` audit imports these tables as the canonical roster and emits `docs/pack-taxonomy.md`. To keep the audit from drifting vs. `tools.json`:

- `scripts/_promote_wave_2.py`: `world-clock` and `countdown-to-date` packs moved from `travel` to `study`
- `scripts/_promote_wave_3.py`: `date-difference` pack moved from `travel` to `study`; `unit-converter` dual-packed to `["developer", "travel"]`; `tip-calculator` dual-packed to `["finance", "travel"]`

## Files

- **created** `scripts/check-pack-composition.py` — pure-stdlib Python gate
- **modified** `tools.json` — pack arrays updated for 6 tools
- **modified** `scripts/_promote_wave_2.py` — 2 WAVE_2_PACKS entries
- **modified** `scripts/_promote_wave_3.py` — 3 WAVE_3_PACKS entries
- **modified** `Makefile` — `.PHONY` adds `check-pack-composition`; `help` line + `ci` chain
- **modified** `.github/workflows/tool-contract-gate.yml` — CI step + path filter

## Verification

```bash
python scripts/check-pack-composition.py
# check-pack-composition: 50 ready tools across 6 pack(s)
#   developer   14 tool(s): [...]
#   finance      8 tool(s): [...]
#   fun          7 tool(s): [...]
#   household   10 tool(s): [...]
#   study       11 tool(s): [...]
#   travel       5 tool(s): ['currency-converter', 'exam-countdown', 'recipe-scaler', 'tip-calculator', 'unit-converter']
# check-pack-composition: all checks pass
# EXIT=0

make check-pack-composition
# (alias of the above)

make pack-tags-smoke
# (verifies _pack_tags audit agrees with tools.json)
```

Manual verification: visit `/packs/travel` and confirm the grid shows exactly 5 tools matching the AC list.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Removing `travel` from world-clock / countdown-to-date / date-difference reduces travel pack below 5 | AC explicitly demands exactly 5; dual-packing `tip-calculator` and `unit-converter` adds them in to bring the count back to 5 |
| `_pack_tags.py` audit warns about pack drift | Updated WAVE_2_PACKS / WAVE_3_PACKS in the same commit; audit re-run clean |
| Pack cards page (`packs/*.html`) hides tools no longer in pack | Existing `packs/travel.html` template filters by `pack === 'travel' && ready === true` so the page auto-updates |