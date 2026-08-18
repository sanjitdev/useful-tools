# Dev Story 10.19 — Epic 10 retrospective (DC-12 retro)

## Scope

Story 10.19 ships the Epic 10 (Discovery Engine) retrospective. Two
artifacts:

1. **`docs/stories.md`** — the per-story ledger for DC-0..DC-12. Each
   story ID has its own heading (`## DC-N — title`) and the first
   800 chars after the heading carry the six required fields
   (`verify`, `owner`, `status`, `files`, `api`, `ac`).
2. **`_bmad-output/implementation-artifacts/epic-discovery-shipped.md`**
   — the shipped-retro document with actual byte measurements for
   every Discovery-side module (no aspirational "target" numbers).

The DC-12 retro gate (`scripts/dc/dc-12-retro.py`) audits both
artifacts on every run.

## Acceptance criteria

1. `docs/stories.md` exists and has a heading per story ID
   DC-0..DC-12 (13 headings).
2. Each heading's first 800 chars include the six required fields
   (`verify`, `owner`, `status`, `files`, `api`, `ac`). The
   field-order convention adopted: `verify`/`owner`/`status` come
   first (small, ~80 chars total) so they always fit in the 800-char
   window regardless of how verbose the `files`/`api`/`ac` lists
   grow.
3. `_bmad-output/implementation-artifacts/epic-discovery-shipped.md`
   exists with **actual byte measurements** (`\d[\d,_]*\s*bytes\s+gz`
   regex match) rather than aspirational targets.
4. `python scripts/dc/dc-12-retro.py` exits 0 — 4 PASS (3 AC + 1
   vacuous-guard seed).
5. `python scripts/dc/run-all.py` exits with 11/13 stories green;
   the two remaining red gates are known deferred items:
   - **DC-7** — needs 4 more quizzes to reach the 10-entry
     expectation (DC-7 follow-up).
   - **DC-10** — `scripts/pack-gate.py` +
     `.github/workflows/pack-gate.yml` + `docs/ci-gate.md §8`
     authoring (separate DC-10 follow-up).

## Files created / modified

- **NEW** `docs/stories.md` — 13 per-story entries (DC-0..DC-12),
  each carrying all 6 required fields
- **NEW** `_bmad-output/implementation-artifacts/epic-discovery-
  shipped.md` — retro doc with per-module gzipped sizes (DC-1..DC-5
  + Story 10.8/10.9 add-ons), AC gate results, story-level AC
  outcomes, lessons learned (7 items), action items (4 items
  carried forward to Sprint F+)

## Verification

- `python scripts/dc/dc-12-retro.py` → 4/4 PASS (DC-12 green)
- `python scripts/dc/run-all.py` → 11/13 stories green; 2/13 RED
  (DC-7 + DC-10 deferred, both carry-forward items)
- DC-9 + DC-12 + DC-8 + DC-11 all green after Sprint F
- DC-12 retro passes the structural-gate test (heading per ID +
  per-heading required fields + retro byte-measurements)

## Out of scope / deferred

- CS / VS / ER phases deferred until after implementation per the BMad
  cycle (DS only)
- **DC-7 follow-up** — adding 4 more quizzes to reach the 10-entry
  expectation. Tracked as AI-E10-1 in the retro action items.
- **DC-10 follow-up** — authoring `scripts/pack-gate.py` +
  `.github/workflows/pack-gate.yml` + `docs/ci-gate.md §8`. Tracked
  as AI-E10-4 in the retro action items.
- **Story 10.10** — `.discovery-card` wrapper CSS + on-page Share
  button. Tracked as AI-E10-2.
- **Story 10.11** — Share-card chrome (PNG/URL/Print full UX).
  Tracked alongside AI-E10-2.
- **Story 10.12** — Challenge receiver-side landing page +
  privacy default. Tracked as AI-E10-3.
- **Epic 10 transition to `done`** — occurs after the DC-7 follow-up
  lands (closes the 4-quiz deficit). The four open action items
  become Epic 11 (or a follow-up sprint) work.

## Notes

- The `_smoke_quiz_proxy.js` Section VIII (Story 10.15) was the
  single biggest contributor to DC-9 green — that section added 27
  assertions in 84 lines, replacing what would have been 200+ lines
  in a separate smoke file. The "smoke harness sections > smoke
  harness files" lesson is captured in the retro doc.
- The `BUNDLE_SIZE_BASELINE == 132,638` (locked at Story 4c
  landing) is the chrome-budget reference. The Discovery surface
  added 28,021 bytes gz of **page-conditional** capacity, none of
  which counts toward the chrome budget — that's the architectural
  payoff of the Story 4c Proxy-factory pattern.
