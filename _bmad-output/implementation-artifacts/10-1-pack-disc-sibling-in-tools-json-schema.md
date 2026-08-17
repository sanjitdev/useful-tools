# Story 10.1 — Pack `disc` sibling in `tools.json` schema

**Slug:** `pack-disc-schema`
**Status:** backlog
**Date:** 2026-08-17
**Brainstorm:** `_bmad-output/brainstorming/brainstorm-discovery-engine-2026-08-17/`
**AC gate (working tree):** `scripts/dc/dc-0-schema.py`

---

## Context

The Discovery Engine adds a 6th pack ("Discover Me") to `tools.json`. The existing schema (Story 1.1) only knows about `tools` (utility entries); the packs layer (Story 6.x) is implicit. We need a sibling `packs.disc` array whose entries are **discriminated-union `module-def`** items (kind: scoring|results|challenge|catalog) — the load-bearing primitive that lets a future contributor author a 7th quiz in 1-2 hours without code changes.

## Goal

Extend `tools.schema.json` to accept a top-level `packs.disc` array of `module-def` entries; validate the discriminated union in CI; verify the existing 50 tool entries still pass unchanged.

## Files added

| Path | Purpose |
|---|---|
| `tools.schema.json` (modified) | Adds `packs.disc` array + `module-def` discriminated union via `allOf + if/then`. |
| `scripts/dc/dc-0-schema.py` | AC gate — validates the discriminated union, runs in CI. |

## Files modified

| Path | Change |
|---|---|
| `tools.schema.json` | Top-level `packs: { disc: [module-def, ...] }` accepted. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Story 10.1 entry. |

## Public API / Schema (`packs.disc[].module-def`)

```yaml
packs:
  disc:
    - id: spirit-animal
      kind: scoring
      slug: spirit-animal
      title: "What spirit animal are you?"
      emoji: "🦊"
      spec-version: 1
      scoring: { weights, traits, archetypeMap, blindSpotFor }
    - id: spirit-animal
      kind: results
      slug: spirit-animal
      spec-version: 1
      render: { container: ".discovery-card-mount" }
    - id: spirit-animal
      kind: challenge
      slug: spirit-animal
      spec-version: 1
    - id: car-finder
      kind: catalog
      slug: car-finder
      spec-version: 1
      catalog: { source: "tools.json", filter: { pack: "household" } }
```

`kind` is the discriminator; `allOf + if/then` enforces the per-kind shape. Spec-version allows future migrations without invalidating old Challenge URLs.

## Verification

- `python scripts/dc/dc-0-schema.py` → PASS (discriminated union validated, 6 MVP quizzes × 4 kinds where applicable).
- `make validate-tools-json` → existing 50 tool entries still PASS unchanged.
- Brownfield clean: 50/50 tools validated, no schema regressions.

## Out-of-scope (deferred)

- Story 10.2 (scoring engine) — implements `kind: scoring` semantics.
- Story 10.3 (results module) — implements `kind: results`.
- Story 10.4 (challenge module) — implements `kind: challenge`.
- Story 10.5 (recommend module) — implements `kind: catalog`.

---

*Story doc — frontmatter + 7 sections, ~50 lines.*