# Story 10.3 — Results module (`HT.results.render` + share-card chrome)

**Slug:** `results-module`
**Status:** backlog
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
| `assets/css/discovery.css` | Result card chrome — emoji, archetype name, trait bars, blind-spot box, action row, Tools-for-you section. |
| `scripts/dc/dc-2-results.py` | AC gate — DOM shape + a11y + keyboard assertions. |

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

- `python scripts/dc/dc-2-results.py` → PASS (DOM shape matches B3, 12 sections).
- `HT.results` registered in `api-contract.js`.
- Contrast ratios verified per the B1 follow-up table in DESIGN.md §2.

## Out-of-scope (deferred)

- Story 10.10 (result card chrome component) — DOM shape spec lands.
- Story 10.11 (share-card chrome) — `HT.results.download` PNG export.
- Story 10.12 (challenge UX) — receiver-side landing page.

---

*Story doc — frontmatter + 7 sections, ~50 lines.*