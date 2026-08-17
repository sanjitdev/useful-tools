# Story 10.8 — Discover Me lane on home grid (`packs/disc`)

**Slug:** `discover-me-lane`
**Status:** backlog
**Date:** 2026-08-17
**Brainstorm:** `_bmad-output/brainstorming/brainstorm-discovery-engine-2026-08-17/`
**AC gate (working tree):** `scripts/dc/dc-7-lane.py`

---

## Context

The Discovery Engine must be discoverable from the home grid in one tap. The home grid already has 5 utility-pack lanes (Travel, Finance, Study, Developer, Household). The 6th lane — Discover Me — sits **above** the utility-pack lanes so the viral-loop surface is the first thing a visitor sees.

## Goal

Ship `<section class="discovery-lane" aria-label="Discover Me">` on the home page, above the first utility-pack lane, containing 6 quiz cards per `components.discovery-lane-card` (DESIGN.md §1.3).

## Files added

| Path | Purpose |
|---|---|
| `assets/js/discovery-lane.js` | Renders the Discover Me lane from `packs/disc/index.json` (≤ 4 KB slice of the 6 quizzes). |
| `packs/disc/index.json` | The Discover Me lane slice — `[{slug, title, emoji, category}]`. |
| `scripts/dc/dc-7-lane.py` | AC gate — lane renders above utility packs; collapses correctly per breakpoint. |

## Files modified

| Path | Change |
|---|---|
| `index.html` | Loader for `assets/js/discovery-lane.js` added; lane mount point inserted above the utility-pack grid. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Story 10.8 entry. |

## Public API (DOM shape)

```html
<section class="discovery-lane" aria-label="Discover Me">
  <h2 class="discovery-lane-label">Discover Me</h2>
  <div class="discovery-lane-grid">
    <article class="discovery-lane-card">
      <span class="quiz-emoji" aria-hidden="true">🦊</span>
      <span class="quiz-category-badge">Personality</span>
      <h3 class="quiz-title">What spirit animal are you?</h3>
      <p class="quiz-meta">5 questions · 90 seconds</p>
    </article>
    ... 5 more ...
  </div>
  <a href="/packs/disc" class="discovery-lane-see-all">See all →</a>
</section>
```

Single-row scroll on desktop, 2-column on tablet, 1-column on mobile (per DESIGN.md §4). No quiz data is loaded — only the `<4 KB index.json`.

## Verification

- `python scripts/dc/dc-7-lane.py` → PASS (lane position correct; collapse per breakpoint; no quiz modules loaded on home).
- Home page bundle unchanged (lane reads cached `index.json`).

## Out-of-scope (deferred)

- Story 10.9 (pack page) — the "See all" destination.
- Story 10.18 (pack-composition gate) — enforces ≥ 5 ready quizzes.

---

*Story doc — frontmatter + 7 sections, ~50 lines.*