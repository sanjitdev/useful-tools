# Story 10.3 — Results module (`HT.results.render` + share-card chrome)

**Slug:** `results-module`
**Status:** done
**Date:** 2026-08-17
**Brainstorm:** `_bmad-output/brainstorming/brainstorm-discovery-engine-2026-08-17/`
**AC gate (working tree):** `scripts/dc/dc-2-results.py`

---

## Context

The result card is the load-bearing surface of the Discovery Engine. It must render identically across all 6 quizzes (per `components.discovery-card` in DESIGN.md §1.1), be keyboard-complete, announce the archetype to screen readers, and offer Share / Challenge actions. This story ships `HT.results` as a stable Shell module.

## Goal

Ship `HT.results.render(el, state, archetype)` that produces the documented DOM shape; `HT.results.copy/print/download` for share actions; reduced-motion + a11y compliance per the rubric walker.

## Files added

| Path | Purpose |
|---|---|
| `assets/js/results.js` | Frozen `HT.results` module — `render / copy / print / download`. |
| `assets/css/result-card.css` | Result card chrome — emoji, archetype name, trait bars, contrarian line, action row, `@media print` strip. |
| `scripts/dc/dc-2-results.py` | AC gate — DOM shape + a11y + keyboard assertions. |
| `scripts/_smoke_results.js` | Smoke harness — Proxy wiring + DOM assertions + shell-bounds contract. |

## Files modified

| Path | Change |
|---|---|
| `assets/js/api-contract.js` | Version bumped; `HT.results` registered as `stable`. |
| `assets/js/shell-thin.js` | Page-conditional Proxy wiring. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Story 10.3 entry. |

## Public API (`HT.results`)

```js
HT.results.render(el: Element, state: object, archetype: object) → void
HT.results.copy(state: object, archetype: object) → string  // ≤ 280 chars
HT.results.print(el: Element) → void  // chrome-stripped
HT.results.download(el: Element, archetype: object) → Promise<void>  // 1200×630 PNG
```

`state = { answers, computed: { archetype, traits, blindSpot } }`. Reduced-motion honored under both `@media (prefers-reduced-motion: reduce)` and `:root:where([data-reduced-motion="true"])`. 800 ms live-region debounce on mount per review-accessibility.md H1.

## Verification

- `python scripts/dc/dc-2-results.py` → **23/23 PASS** (2026-08-17) — DOM shape matches B3 (data-print="result" + role="region" + aria-live="polite" + aria-atomic="true" + aria-labelledby), action row carries data-print="ignore", contrarian line uses .quiz-result-contrarian, tab-order-canonical ['button.share','button.challenge'] for the card, shareUrl returns ?arch=<id>, copyText returns canonical "<emoji> <label> — <trait> NN%" ≤ 280 chars, imageSnapshot throws Error("snapshot unavailable") per the contract (Story 10.11 lands the OG SVG fallback that catches it). gzipped size: results.js 3,573 B (budget 6,000), result-card.css 2,083 B (budget 4,000). shell-bounds-check passes (no localStorage/fetch/XHR/HT.provide). Bundle gate: both files in SPEC_PAGE_CONDITIONAL_MODULES.
- `node scripts/_smoke_results.js` → **26/26 PASS** (2026-08-17) — Proxy wiring (HT.results is a Proxy returned by shell-thin factory, first render() call fires lazyLoad('assets/js/results.js'), concurrent renders are single-flight), full DOM shape audit (descendant scanner walks the rendered card to find contrarian line + button.share + button.challenge), shell-bounds contract (comments stripped before regex scan).
- `HT.results` registered in `assets/js/api-contract.js` (v1.25.0, 102 entries; frozen).
- `HT.results` wired into shell-thin.js Proxy factory (TIER2_URLS.results + TIER2_CSS.results + HT.results = makeProxy).
- `docs/shell-public-api.md` §5 row added (HT.results stable).
- Contrast ratios verified per the B1 follow-up table in DESIGN.md §2.

## DC-2 gate fixes (gate bugs fixed in lockstep)

The DC-2 gate shipped with 3 bugs mirroring the dc-1 gate bugs (fixed earlier):

1. **Check #3 (frozen-surface grep)** — looked for `Object.defineProperty` in `assets/js/api-contract.js`, but the freeze lives in `assets/js/results.js`. Fixed to grep `results.js` and cross-check `api-contract.js` for the doc entry (mirrors dc-1's check #2 fix).
2. **Runtime fixture (FakeEl stub)** — `classList.add` was a no-op so the `.button` / `.share` / `.challenge` classes added by results.js never showed up on the buttons. Fixed with a stateful FakeEl.classList.add that mutates `attrs.class`. Also added missing `createTextNode` stub.
3. **Check #19 (smoke via stdin)** — passed the smoke source via stdin (`node -`), but the harness resolves asset paths relative to `__dirname` which is undefined under stdin. Fixed to invoke the smoke file as a script entry point (`node scripts/_smoke_results.js`).
4. **Runtime fixture (path resolution)** — used `path.resolve(__dirname, '..', '..')` which crashes under stdin. Fixed with `__RESULTS_PATH__` substitution mirroring the dc-1 `__SCORING_PATH__` fix.

## Out-of-scope (deferred)

- Story 10.10 (result card chrome component) — DOM shape spec lands.
- Story 10.11 (share-card chrome) — `HT.results.imageSnapshot` PNG export (Story 10.11 lands the OG SVG fallback that catches the `'snapshot unavailable'` throw).
- Story 10.12 (challenge UX) — receiver-side landing page.

---

*Story doc — frontmatter + 7 sections, ~50 lines.*