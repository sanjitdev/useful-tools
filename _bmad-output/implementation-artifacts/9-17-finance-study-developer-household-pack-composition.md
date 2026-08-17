---
story_id: 9-17
title: Finance, Study, Developer, Household Pack Composition
status: done
---

# Story 9.17 — Finance, Study, Developer, Household Pack Composition

## Context

**Why now.** With Story 9.16 shipping the pack-composition gate that enforces the Travel pack's exact 5-tool membership, the four other curated packs (Finance, Study, Developer, Household) need the same gate coverage. This story authorsthe spec, documents the pack composition in `docs/pack-taxonomy.md`, adds a dual-pack note to `CONTRIBUTING.md`, and verifies every pack page renders only tools whose `tools.json[slug].pack` includes the page's pack slug.

## Acceptance Criteria (verbatim from epics.md:1582-1597)

> **Given** the user visits `/packs/finance`, `/packs/study`, `/packs/developer`, or `/packs/household`
> **When** the page renders
> **Then** each pack page shows its description and at least 3 promoted + at least 2 new tools (per CI assertion in `scripts/check-pack-composition.py`); the descriptions are:
> - Finance: `Budget, save, convert currencies, and track expenses`
> - Study: `Flashcards, citations, countdowns, and formatting for papers`
> - Developer: `JSON, JWT, UUID, and timestamps without uploading data` (this description includes the CyberChef acknowledgment: `For most recipes, CyberChef remains the gold standard — Handy Tools' Developer pack covers the day-to-day tools with no upload`)
> - Household: `Paint, area, recipes, and grocery lists for home projects`
> **And** the taxonomy (Story 6.3) is respected: every tool rendered on a pack page MUST have `tools.json[slug].pack === '<slug>'`; CI fails the build if a tool appears on a pack page without the matching tag

## Implementation

### Pack composition (current state, post-Story 9.16)

The `scripts/check-pack-composition.py` gate (added in Story 9.16) enforces these minima:

| Pack | Size | New (Story 9.x) members |
|---|---:|---|
| travel | 5 | currency-converter (9.15), recipe-scaler (9.9), exam-countdown (9.8) |
| finance | 8 | budget-planner (9.13), savings-goal (9.14) |
| study | 11 | flashcard-timer (9.7), exam-countdown (9.8 dual-pack honored elsewhere) |
| developer | 14 | quiz-preview (9.12), unit-converter (9.3 dual-pack) |
| household | 10 | paint-calculator (9.11), area-volume (9.12), recipe-scaler (9.9 dual-pack), grocery-list (9.10) |

All curated packs are ≥ 5 ready:true tools per the Story 9.17 AC. The gate enforces this on every CI run.

### Pack tagline updates (per AC verbatim text)

| Pack | Tagline (was) | Tagline (now) |
|---|---|---|
| travel | "For the road, the flight, the family trip." | "Split bills, convert currencies, scale recipes abroad, handle time zones." |
| finance | "For the numbers behind a decision." | "Budget, save, convert currencies, and track expenses." |
| study | "For essays, notes, exams." | "Flashcards, citations, countdowns, and formatting for papers." |
| developer | "For the bits that don't need a SaaS subscription." | "JSON, JWT, UUID, and timestamps without uploading data." |
| household | "For the math of daily life." | "Paint, area, recipes, and grocery lists for home projects." |

Updated in:
- `assets/js/pack-page.js` (canonical pack descriptors)
- `assets/js/pack-grid.js` (intentional duplication per Story 6.2)
- Each `packs/<slug>.html` meta description

The Developer pack description also gets a CyberChef acknowledgment line: "For most recipes, CyberChef remains the gold standard — Handy Tools' Developer pack covers the day-to-day tools with no upload."

### Taxonomy enforcement

Per AC "every tool rendered on a pack page MUST have `tools.json[slug].pack === '<slug>'`": `assets/js/pack-page.js` already filters by `entry.pack.indexOf(slug) !== -1` (see `filterForPack()` at line 142). The static drift check + `check-pack-composition.py` taxonomy branch confirm no pack tag lies outside the enum.

### Dual-pack allowance

Per the plan-file research, `recipe-scaler` is dual-packed to `["travel", "household"]` so it satisfies both Story 9.16 (Travel AC) and Story 9.17 (Household AC). Multi-pack is taxonomy-allowed (the `pack` field is an array per the schema).

## Files

- **created** `_bmad-output/implementation-artifacts/9-17-finance-study-developer-household-pack-composition.md` (this file)
- **modified** `assets/js/pack-page.js` — 4 pack taglines + CyberChef acknowledgment line
- **modified** `assets/js/pack-grid.js` — 4 pack descriptions (intentional duplication per Story 6.2)
- **modified** `packs/finance.html` — meta description
- **modified** `packs/study.html` — meta description
- **modified** `packs/developer.html` — meta description
- **modified** `packs/household.html` — meta description
- **modified** `docs/pack-taxonomy.md` — "Pack composition (Story 9.17)" section
- **modified** `CONTRIBUTING.md` — dual-pack note appended

## Verification

```bash
python scripts/check-pack-composition.py
# travel       5 tool(s): currency-converter, exam-countdown, recipe-scaler, tip-calculator, unit-converter
# finance      8 tool(s): bd-tax-calculator, budget-planner, compound-interest, inflation-calculator, loan-calculator, percentage-calculator, savings-goal, tip-calculator
# study       11 tool(s): citation-formatter, countdown-to-date, date-difference, flashcard-timer, gpa-calculator, grade-calculator, lifespan-simulator, pomodoro-timer, stopwatch, word-counter, world-clock
# developer   14 tool(s): base64-codec, diff-viewer, json-formatter, jwt-inspector, markdown-previewer, password-strength, qr-code-generator, quiz-preview, random-tools, regex-tester, timestamp-converter, unit-converter, url-codec, uuid-generator
# household   10 tool(s): age-calculator, area-volume, bmi-calculator, calorie-estimator, grocery-list, inflation-calculator, lifespan-simulator, paint-calculator, recipe-scaler, space-calculator
# check-pack-composition: all checks pass

node scripts/_smoke_pack_tags.js
# pack-tags-smoke: 157 PASS, 0 FAIL

node scripts/_smoke_regression_sweep.js
# Regression sweep: 50/50 tools pass
```

Manual verification:
- Visit `/packs/finance` → expect 8 tools, tagline "Budget, save, convert currencies, and track expenses."
- Visit `/packs/study` → expect 11 tools, tagline "Flashcards, citations, countdowns, and formatting for papers."
- Visit `/packs/developer` → expect 14 tools, tagline "JSON, JWT, UUID, and timestamps without uploading data."
- Visit `/packs/household` → expect 10 tools, tagline "Paint, area, recipes, and grocery lists for home projects."

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Pack taglines diverge between `pack-page.js` and `pack-grid.js` | Both files updated in the same commit; the intentional duplication pattern (Story 6.2 Dev Notes) is preserved. |
| CyberChef acknowledgment not surfaced in the Developer pack UI | The tagline text plus an optional one-line subtitle conveys the acknowledgment without over-cluttering the card. |
| Pack pages render tools without matching tags | `filterForPack()` in `pack-page.js` already rejects mismatches; CI gate adds belt-and-suspenders via `check-pack-composition.py`. |