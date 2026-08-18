# Dev Story 10.18 — Discover Me pack-composition gate extension

## Scope

Story 10.18 extends `scripts/check-pack-composition.py` to enforce that the
Discovery pack (data.packs.discovery.entries[]) declares ≥ 5 ready quizzes.
A Discovery entry counts as ready iff it has the canonical shape (slug,
title, modules[]) AND its `ready` field is not explicitly false AND a real
on-disk directory exists at `tools/packs/discovery/<slug>/`. The check is
independent of the existing 5-pack composition rules (which operate on
`tools[].pack[]`); adding `disc` to `PACK_ENUM` would force every tool to
list it (incorrect shape), so a separate readiness helper is required.

## Acceptance criteria

1. `scripts/check-pack-composition.py` exits 0 against the current
   `tools.json` and prints a new diagnostic line `disc         6 quiz(zes):
   [car-finder, decision-style, friend-match, future-partner, spirit-animal,
   what-would-you-do]`.
2. Mutation test: temporarily setting `DISCOVERY_MIN_READY = 7` causes the
   gate to exit 6 with the message `disc pack has 6 ready quizzes (< 7
   minimum): [...]`.
3. The existing 5-pack rules (travel = exactly 5; finance/study/developer/
   household ≥ 5 ready:true) remain unchanged — verified by the same exit-0
   behavior and unchanged diagnostic lines for travel/finance/study/
   developer/household/fun.
4. The taxonomy check (`PACK_ENUM = {travel, finance, study, developer,
   household, fun}`) is NOT extended with `disc` — Discovery entries have
   no `pack` field, so the enum stays utility-pack-only. The Discovery
   check is a separate pass over `payload.packs.discovery.entries[]`.
5. Exit code 6 is documented in the module docstring (new exit code,
   not a reuse of an existing one).
6. `make check-pack-composition` (wired in the Makefile) exits 0 — the
   extension lands without breaking the existing gate wire.

## Files modified

- **MODIFIED** `scripts/check-pack-composition.py`:
  - Added `DISCOVERY_MIN_READY = 5` and `DISCOVERY_PACK_ROOT =
    "tools/packs/discovery"` constants
  - Added `disc_ready_entries(root, payload)` helper that filters
    entries by canonical shape + non-false `ready` field + on-disk dir
  - Updated `load_tools()` to return `(tools, full_payload)` so the
    Discovery check can read `payload.packs.discovery.entries[]`
  - Added Discovery readiness check at the end of `main()` — exit 6
    below the minimum, exit 0 otherwise
  - Added diagnostic line `disc   N quiz(zes): [...]` in the summary
    section
  - Updated module docstring with Story 10.18 AC + new exit code 6

## Verification

- `python scripts/check-pack-composition.py` — exit 0; prints
  `disc 6 quiz(zes): [all six slugs]` line
- Mutation test (replace `DISCOVERY_MIN_READY: int = 5` with `7`) —
  exits 6 with `disc pack has 6 ready quizzes (< 7 minimum): [...]`
- `make check-pack-composition` — exit 0
- `python scripts/check-pack-composition.py` after re-running the
  `make ci` suite — exit 0 (no regression in the existing 5-pack rules)

## Out of scope / deferred

- CS / VS / ER phases deferred until after implementation per the BMad
  cycle (DS only)
- Per-quiz rubric enforcement (questions length, scoring-spec shape,
  archetype immutability) — that's the dc-6-quizzes gate's job, NOT
  pack-composition
- DC-7 follow-up (4 more quizzes to reach the 10-entry expectation) —
  separate story
- Adding a `disc` enum to `tools.schema.json` `pack.items.enum` — would
  force every tool to list it; Discovery entries belong in
  `packs.discovery.entries[]` (sibling shape), not in `tools[].pack[]`
