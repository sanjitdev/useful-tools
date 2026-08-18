# Dev Story 10.16 — DC-11 bundle size enforcement + brownfield clean

## Scope

Story 10.16 covers DC-11 (scripts/dc/dc-11-bundle.py): the gate that
asserts all 11 Discovery-pack page-conditional modules are listed in
`SPEC_PAGE_CONDITIONAL_MODULES` (NOT in `SPEC_JS_MODULES` /
`SPEC_CSS_MODULES`), `BUNDLE_SIZE_BASELINE` remains at the
Story-4c-locked 132,638 gz, `bundle-size-gate.py` itself exits 0,
and `scripts/_bundle_size_per_tool.py` covers the
`tools/packs/**/index.html` directory. The brownfield side of the
story — making sure the bundle stays clean after Story 10.6, 10.8, 10.9
additions — landed with each of those stories and is verified by the
same DC-11 run.

## Acceptance criteria

1. `python scripts/dc/dc-11-bundle.py` exits 0 — 11 PASS / 0 FAIL.
2. All 11 expected entries present in `SPEC_PAGE_CONDITIONAL_MODULES`:
   - `assets/js/scoring.js`
   - `assets/js/results.js`
   - `assets/js/challenge.js`
   - `assets/js/recommend.js`
   - `assets/js/catalog.js`
   - `assets/js/packs/discovery-loader.js` (Story 10.6)
   - `assets/js/disc-page.js` (Story 10.9)
   - `assets/js/discover-lane.js` (Story 10.8)
   - `assets/css/result-card.css`
   - `assets/css/discovery.css`
3. `BUNDLE_SIZE_BASELINE == 132638` (locked at Story 4c landing).
4. `python scripts/bundle-size-gate.py` exits 0 (the gate itself is
   green; not just "missing on disk" tolerated).
5. `scripts/_bundle_size_per_tool.py` covers `tools/packs/**/index.html`
   (regex match confirms `packs/` is in the file's iteration logic).
6. Story 10.6/10.8/10.9 additions to the page-conditional list stay
   inside their per-module budgets (gzipped sizes):
   - `scoring.js` — 4,028 gz (≤ 4 KB budget per AC-3 / DC-1)
   - `results.js` — 5,815 gz (≤ 6 KB budget per AC-3 / DC-2)
   - `challenge.js` — 4,289 gz (≤ 4 KB budget per AC-3 / DC-3)
   - `recommend.js` — 3,119 gz (≤ 4 KB budget per AC-3 / DC-4)
   - `catalog.js` — 2,358 gz (≤ 4 KB budget per AC-3 / DC-4)
   - `packs/discovery-loader.js` — 1,662 gz (≤ 2 KB budget per AC-3 / DC-5)
   - `disc-page.js` — 3,360 gz (≤ 4 KB budget per Story 10.9 AC-9)
   - `discover-lane.js` — 2,482 gz (≤ 3 KB budget per Story 10.8 AC-8)
   - `result-card.css` — 2,083 gz (≤ 4 KB budget per AC-3 / DC-2)
   - `discovery.css` — 1,454 gz (≤ 4 KB budget per AC-3 / DC-5)

## Files modified

- None (DC-11 stays as it was authored for Stories 10.6, 10.8, 10.9).
  Story 10.16 is the "verify and document" pass.

## Verification

- `python scripts/dc/dc-11-bundle.py` → 11 PASS / 0 FAIL
- `python scripts/bundle-size-gate.py` → exit 0
- `node scripts/_smoke_quiz_proxy.js` Section VIII (Story 10.15)
  confirms the per-module size invariants via grep — no eager fetch
  / no dynamic import of any of the 5 proxies, including the 3
  Discovery-only modules (scoring/results/challenge/recommend/
  catalog).

## Out of scope / deferred

- CS / VS / ER phases deferred until after implementation per the BMad
  cycle (DS only)
- Per-tool bundle measurement for the 6 quiz routes
  (`tools/packs/discovery/<slug>/index.html`) — covered by AC #5
  (`_bundle_size_per_tool.py` regex match) but not deep-asserted;
  the per-route measurement happens at the regression-sweep level.
- NFR-1 / AC-4 30 KB slim-build target — requires Story 4 (embed)
  + per-Tool lazy-loading beyond what Sprint E ships.
