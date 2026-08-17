# Story 10.15 — Discovery Engine smoke harness (DC-0 through DC-12)

**Slug:** `disc-smoke`
**Status:** backlog
**Date:** 2026-08-17
**Brainstorm:** `_bmad-output/brainstorming/brainstorm-discovery-engine-2026-08-17/`

---

## Context

The Discovery Engine introduces 13 AC gates (DC-0 schema, DC-1 scoring, DC-2 results, DC-3 challenge, DC-4 recommend, DC-5 loader, DC-6 quiz MVP, DC-7 tools.json, DC-8 docs, DC-9 PII lint, DC-10 archetype immutability, DC-11 bundle size, DC-12 retro). Any future PR must pass all 13 — and the harness must post a comment with the 13 status flags so reviewers see regressions at PR time.

## Goal

Ship `make disc-smoke` + a CI step that runs all 13 DC gates; posts a PR comment with `[PASS|FAIL]` per gate; blocks merge on any FAIL.

## Files added

| Path | Purpose |
|---|---|
| `scripts/dc/_smoke_disc_aggregator.py` | Aggregates the 13 DC gate outputs into a single PASS/FAIL summary. |
| `scripts/_smoke_disc_aggregator.js` | JS sibling that runs in node for local `make disc-smoke`. |
| `scripts/_smoke_disc_negative.js` | Negative fixtures for the gates that have them (scoring determinism, lints, etc.). |

## Files modified

| Path | Change |
|---|---|
| `Makefile` | `.PHONY` gains `disc-smoke`; target runs all 13 DCs in sequence; `ci:` chain updated. |
| `.github/workflows/tool-contract-gate.yml` | `disc-smoke` step; posts PR comment with the 13 status flags. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Story 10.15 entry. |

## Public API (Make target)

```makefile
.PHONY: disc-smoke
disc-smoke:
    @for n in 0 1 2 3 4 5 6 7 8 9 10 11 12; do \
      python scripts/dc/dc-$$n-*.py || exit 1; \
    done
    @echo "DC-0..DC-12: PASS"
```

PR comment format:
```
Discovery Engine smoke (DC-0..DC-12):
  DC-0  schema validation          [PASS]
  DC-1  scoring determinism        [PASS]
  DC-2  results DOM shape          [PASS]
  DC-3  challenge round-trip       [PASS]
  DC-4  recommend top-3            [PASS]
  DC-5  page-conditional loader    [PASS]
  DC-6  6-quiz MVP rubric          [PASS]
  DC-7  tools.json regression      [PASS]
  DC-8  docs present               [PASS]
  DC-9  PII lint                   [PASS]
  DC-10 archetype immutability     [PASS]
  DC-11 bundle size budget         [PASS]
  DC-12 retro doc                  [PASS]
```

## Verification

- `make disc-smoke` → all 13 PASS.
- `python scripts/_smoke_disc_negative.js` → negative fixtures fail correctly.
- PR comment posted on test PR.

## Out-of-scope (deferred)

- Story 10.16 (bundle size) — the per-asset breakdown is appended to the PR comment.
- Story 10.19 (retro) — `DC-12 retro doc` verifies the retro file exists.

---

*Story doc — frontmatter + 7 sections, ~50 lines.*