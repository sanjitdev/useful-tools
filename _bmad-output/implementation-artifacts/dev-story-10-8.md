# Dev Story 10.8 — Discover Me lane on home grid

## Scope

Story 10.8 ships the "Discover Me" lane on the home grid. The lane is a
horizontally-scrolling row of `.discovery-pack-card` tiles (one per
Discovery quiz, ≤ 6 entries) that appears between the "Browse by Pack"
section and the "All tools" free-form library. Each tile links to
`/packs/disc.html` (Story 10.9's destination pack page). The lane renders
the home page without loading the Discovery loader (`HT.discovery`) — it
reads the inline `#ht-tools-json-inline` block directly, mirroring
`pack-grid.js`'s pattern.

## Acceptance criteria

1. `index.html` declares a new `<section class="home-grid-section
   home-discover" id="home-grid-discovery-section" role="region"
   aria-labelledby="home-grid-discovery-heading" hidden>` between the
   `home-grid-packs-section` and `home-grid-tools-json-section`.
2. The section carries the same header chrome as the other home-grid
   sections (`.home-section-header > div > (.home-section-eyebrow + h2) +
   p.home-section-sub`). Heading: "Discover Me"; sub: "Six hand-written
   personality and recommendation quizzes — find your archetype."
3. `index.html` wires `<script src="./assets/js/discover-lane.js" defer>`
   immediately after `pack-grid.js`, and includes `assets/css/discovery.css`
   in the `<head>` so the chrome renders.
4. `assets/js/discover-lane.js` exposes a frozen `HT.discoverLane = {
   render, count, ready, version }` value (AD-14 read-only contract).
5. `HT.discoverLane.render()` resolves to 6 frozen card entries; each card
   carries `.discovery-pack-card`, `data-quiz-slug="<slug>"`, and
   `href="./packs/disc.html"`.
6. The renderer does NOT load the Discovery loader
   (`assets/js/packs/discovery-loader.js`) — `HT.discovery.load()` is
   page-conditional, NOT loaded on the home page. The lane reads inline
   `#ht-tools-json-inline` directly.
7. `discover-lane.js` is listed in `scripts/bundle-size-gate.py`'s
   `SPEC_PAGE_CONDITIONAL_MODULES` (NOT `SPEC_JS_MODULES`).
8. `bundle-size-gate.py` exits 0 — gzipped `discover-lane.js` ≤ 3 KB.
9. `shell-a11y` exits 0 — the new section's `aria-labelledby` resolves to
   the heading id.

## Files created / modified

- **NEW** `assets/js/discover-lane.js` — home-grid lane renderer
- **MODIFIED** `index.html` — injected the lane section markup (between
  packs and tools-json) + wired `<script>` tag + added `discovery.css`
  `<link>` in `<head>`
- **MODIFIED** `scripts/bundle-size-gate.py` — added
  `"assets/js/discover-lane.js"` to `SPEC_PAGE_CONDITIONAL_MODULES`
- **NEW** `scripts/_smoke_discover_lane.js` — 20-assertion vm-sandbox smoke

## Verification

- `node scripts/_smoke_discover_lane.js` — 20/20 PASS
- `python scripts/shell-drift-check.py` — exit 0 (home page chrome
  unchanged; only added a new section + script tag + stylesheet link)
- `python scripts/bundle-size-gate.py` — exit 0; `discover-lane.js`
  2,482 gz
- `make shell-a11y` — exit 0 (the new section's aria-labelledby
  resolves to a present heading id)
- `make dc-all` — DC-5 still 12/12 (no regression)

## Out of scope / deferred

- CS / VS / ER phases deferred until after implementation per the BMad
  cycle (DS only)
- The home page's existing `home-grid.js` / `pack-grid.js` / `pins.js`
  renderers are untouched (the new lane is a parallel addition)
- Result-card / share-card chrome (Story 10.10 / 10.11) — separate
