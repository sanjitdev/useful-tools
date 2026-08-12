---
title: "Fun Pack Brainstorm — Intent"
created: "2026-08-12"
project: "useful-tools"
mode: "autonomous"
status: "complete"
companion_artifact: "_bmad-output/brainstorming/brainstorm-fun-pack-2026-08-12/fun-pack-future-tasks.md"
---

# Fun Pack Brainstorm — Intent

## What we brainstormed
A new `fun` pack of seven entertainment-only tools for useful-tools. Results are playful, shareable, and deterministic for reproducibility, but never authoritative.

## Why
- The current pack lineup (`finance`, `study`, `developer`, `household`, `travel`) is all utility-focused. A `fun` pack broadens the audience (kids, social-media sharers, casual users) and creates a shareable, viral-safe surface.
- Playful tools are perfect for the catalog because they are non-alarming when the result is "weird" or "low-precision" — they need only be deterministic and on-brand.

## Constraints baked in
- **Static-only.** No build step, no CDN, no npm, no font fetch.
- **Zero runtime dependencies.** Vanilla JS, the existing `HT.*` Shell APIs, shared CSS tokens.
- **No `Math.random()`.** Every output is deterministic given the inputs (cyrb53 hash → seed → result).
- **No real predictive or advisory framing.** The "For Fun — Not Authoritative" badge is mandatory and rendered in three places.
- **No PII.** Fun Pack tools never declare `history-keys`; storage is URL-state only.
- **Honoring the existing architecture.** Each tool is a folder under `tools/<slug>/` with `index.html` + `<slug>.js`, declared in `tools.json` against the existing `tools.schema.json`.
- **Process discipline.** Each story follows the BMad cycle plus the three forward-only commitments (AI-E3-1 validate spec, AI-E3-2 review twice, AI-E3-3 production-readiness gate).

## Pack framing (the seven)
| # | Story | Slug | Category |
|---|---|---|---|
| 1 | 6.21 | `love-chemistry` | Two-person calculator |
| 2 | 6.22 | `marriage-probability` | Two-person generator |
| 3 | 6.23 | `superpower-fit` | Quiz |
| 4 | 6.24 | `pet-personality` | Quiz/vector match |
| 5 | 6.25 | `main-character-era` | Generator |
| 6 | 6.26 | `age-capsule` | PRNG generator |
| 7 | 6.27 | `what-if-time-warp` | Rewriter |

## Where the seven landed
Sprint status now lists all seven as `backlog` under Epic 6 (Stories 6.21 – 6.27). They all depend on Story 6.3 (pack taxonomy doc) and Story 6.2 (pack page renderer), which are already in the backlog.

## Recommended next steps
1. **Story 6.3** — write `docs/packs/fun.md` so the `fun` pack is documented before any tool is declared.
2. **Story 6.21** (Love Chemistry Calculator) — implement as the prototype; sets the badge/determinism/shareable pattern.
3. Reuse 6.21's smoke harness template for the new `scripts/_smoke_fun_pack.js` and run all subsequent stories through it.

## What we did NOT do
- We did not write any tool code (still in brainstorm territory).
- We did not invent a new pack color token (reuse existing palette).
- We did not propose ANY analytics, tracking, or PII collection for the Fun Pack.
- We did not authorize the Fun Pack to override `history` retention, the share dialog, or embed mode.

## Artifacts produced
- `_bmad-output/brainstorming/brainstorm-fun-pack-2026-08-12/.memlog.md` — session memory (13 entries, status: complete)
- `_bmad-output/brainstorming/brainstorm-fun-pack-2026-08-12/brainstorm-intent.md` — this file
- `_bmad-output/brainstorming/brainstorm-fun-pack-2026-08-12/fun-pack-future-tasks.md` — the seven future-development task definitions
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — updated Epic 6 with Stories 6.21–6.27 (backlog)
