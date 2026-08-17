# Story 10.17 — Discovery Engine docs (authoring guide + taxonomy + privacy posture)

**Slug:** `disc-docs`
**Status:** backlog
**Date:** 2026-08-17
**Brainstorm:** `_bmad-output/brainstorming/brainstorm-discovery-engine-2026-08-17/`

---

## Context

A future contributor adding a 7th quiz should be able to do so in 1-2 hours without re-reading the architecture spine. The authoring guide, pack taxonomy doc, and privacy posture doc are the canonical how-to-add-a-quiz resources.

## Goal

Ship three docs: `docs/discovery-quiz-authoring.md`, `docs/discovery-pack-taxonomy.md`, `docs/discovery-privacy-posture.md`; cross-link from `CONTRIBUTING.md`; verify via `DC-8 docs present`.

## Files added

| Path | Purpose |
|---|---|
| `docs/discovery-quiz-authoring.md` | 6 sections — module-def shape, scoring DSL, archetype + blind-spot pattern, PII allowlist, a11y/keyboard/reduced-motion checklist, worked example (5-question spirit-animal). |
| `docs/discovery-pack-taxonomy.md` | 3 sections — what belongs in Discover Me, what does NOT belong, dual-pack allowance rules. |
| `docs/discovery-privacy-posture.md` | 4 sections — the 3-line disclosure copy, what the Challenge URL reveals vs. does not, the PII + immutability lint rationale, the receiver consent toggle. |

## Files modified

| Path | Change |
|---|---|
| `CONTRIBUTING.md` | Cross-link to the three new docs in the "Adding a quiz" section. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Story 10.17 entry. |

## Public API (doc structure)

`docs/discovery-quiz-authoring.md`:
1. `module-def` shape — example with `kind: scoring|results|challenge|catalog`.
2. Scoring DSL — `weights`, `traits`, `archetypeMap`, `blindSpotFor`.
3. Archetype + blind-spot pattern — emoji + 1-3 word label + 1-sentence tagline + 1-2 sentence blind spot.
4. PII allowlist — 3 example patterns, 2 counter-examples.
5. A11y / keyboard / reduced-motion contract checklist.
6. Worked example — `spirit-animal` (5 questions, 4 archetypes).

`docs/discovery-pack-taxonomy.md`:
1. Belongs in Discover Me — lighthearted / reflective / social-shareable.
2. Does NOT belong — privacy-sensitive, factual, repeatable utility.
3. Dual-pack allowance — a quiz can appear in Discover Me + one utility pack.

`docs/discovery-privacy-posture.md`:
1. The 3-line disclosure copy (verbatim).
2. Challenge URL — reveals archetype + blind spot; never prompts or free-text.
3. PII + immutability lint rationale.
4. Receiver consent toggle — privacy default "Take the quiz blind".

## Verification

- `DC-8 docs present` PASS (all three files exist + non-empty).
- Cross-links from CONTRIBUTING.md resolve correctly.
- Worked example in authoring guide compiles + runs through the smoke.

## Out-of-scope (deferred)

- Story 10.18 (pack-composition gate) — the gate script references the taxonomy doc.

---

*Story doc — frontmatter + 7 sections, ~50 lines.*