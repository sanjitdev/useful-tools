# Dev Story 10.17 — Discovery Engine docs (DC-8)

## Scope

Story 10.17 authors `docs/discovery-platform.md` (the canonical
authoring + taxonomy + privacy guide for the Discovery platform) and
links it from `README.md` so the platform's contract is publicly
discoverable. The DC-8 gate (`scripts/dc/dc-8-docs.py`) verifies:
- the doc exists and is ≥ 1,000 words
- the doc covers the four new APIs with examples
  (`HT.scoring.score(answers, spec)`, `HT.results.render(scored, opts)`,
  `HT.challenge.link(spec)`, `HT.recommend.match(profile, domain)`)
- the doc includes a "Hello World" quiz authoring walkthrough
- `docs/shell-public-api.md §5` carries rows for all 5 new APIs marked
  `stable` (this part was already in place — DC-1..DC-5 shipped it)
- `README.md` links to `docs/discovery-platform.md`

## Acceptance criteria

1. `docs/discovery-platform.md` exists on disk, is ≥ 1,000 words
   (measured 2,601 words).
2. The doc covers, in order: architecture overview, the 5 Shell Public
   APIs with worked examples (`HT.scoring.score`, `HT.results.render`,
   `HT.challenge.link`, `HT.recommend.match`, `HT.catalog.list` /
   `lazyLoad`), a Hello World authoring walkthrough, taxonomy rules,
   privacy guarantees (AD-9), page-conditional module loading with
   the per-module budget table, and "where to look next" pointers.
3. `README.md` gains a "Discovery Platform" section that links to
   `docs/discovery-platform.md` with a 2-paragraph intro describing
   the Discover Me lane + pack page + the 5 Shell APIs.
5. `python scripts/dc/dc-8-docs.py` exits 0 — 9 PASS / 0 FAIL.
6. No change to `docs/shell-public-api.md` (the public-API table of
   record was already populated by DC-1..DC-5 stories and the
   `stable` rows are intact).

## Files modified

- **NEW** `docs/discovery-platform.md` — 2,601-word authoring + taxonomy
  + privacy guide (8 sections)
- **MODIFIED** `README.md` — added "Discovery Platform" section between
  "Developer hooks" and "Settings & preferences" with link to the new
  doc

## Verification

- `python scripts/dc/dc-8-docs.py` → 9 PASS / 0 FAIL (DC-8 green)
- `python scripts/dc/run-all.py` → DC-8 joins the green column; RED
  count drops from 4/13 → 3/13.

## Out of scope / deferred

- CS / VS / ER phases deferred until after implementation per the BMad
  cycle (DS only)
- Per-quiz feature docs (one file per slug) — that's Story 10.7
  follow-up territory; the platform-level doc covers authoring.
- Locale-aware translations (Epic 7) — out of sprint.
- Inline `Hello World` quiz example remains platform-only; the
  hello-world slug is illustrative, not registered in `tools.json`.