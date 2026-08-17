# Story 10.10 — Result card chrome component (`components.discovery-card`)

**Slug:** `discovery-card-chrome`
**Status:** backlog
**Date:** 2026-08-17
**Brainstorm:** `_bmad-output/brainstorming/brainstorm-discovery-engine-2026-08-17/`
**AC gate (working tree):** `scripts/dc/dc-9-chrome.py`

---

## Context

The result card chrome is the load-bearing piece of the Discovery Engine. The accessibility review's B3 finding requires a documented DOM shape (`<article role="region">` + `<header>` + `<ol>` + `<aside>` + `<div>` + `<section>` with `<h2>` + `<ul>` + `<li>`). B1 requires a contrast table. Both must close before any quiz ships.

## Goal

Ship the documented DOM shape for the result card; verify the contrast table for the 3 compatibility bands; verify the Tools-for-you section is `region + h2 + ul + li`.

## Files added

| Path | Purpose |
|---|---|
| `assets/css/discovery.css` (modified) | Gains the B1 contrast-table variables + the B3 DOM shape. |
| `scripts/dc/dc-9-chrome.py` | AC gate — DOM shape + contrast table + a11y assertions. |

## Files modified

| Path | Change |
|---|---|
| `ux-discovery-engine-2026-08-17/DESIGN.md` | Adds the B1 contrast table; the B3 DOM shape is added to §1.1. |
| `assets/js/results.js` (Story 10.3) | Renders the documented shape. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Story 10.10 entry. |

## Public API (DOM shape)

```html
<article class="discovery-card" role="region" aria-live="polite" aria-label="Result: {archetype}">
  <header class="discovery-card-header">
    <span class="archetype-emoji" aria-hidden="true">{emoji}</span>
    <h1 class="archetype-name">{name}</h1>
    <p class="tagline">{tagline}</p>
  </header>
  <ol class="trait-bar-list">
    <li class="trait-bar">…</li>  <!-- top 4 -->
  </ol>
  <aside class="blind-spot-box">
    <p class="blind-spot-label">Your blind spot</p>
    <p class="blind-spot-text">{blindSpot}</p>
  </aside>
  <div class="action-row">
    <button class="share-button">Share</button>
    <button class="challenge-button">Challenge a friend</button>
  </div>
  <section class="tools-for-you" aria-labelledby="tools-for-you-label">
    <h2 id="tools-for-you-label" class="tools-for-you-label">Recommended tools for {archetype}</h2>
    <ul class="tools-for-you-list">
      <li class="tools-for-you-item"><a href="/tools/<slug>/">{displayName}</a></li>
      ... 1-2 more ...
    </ul>
  </section>
</article>
```

Contrast ratios (light + dark): `success`/`success-soft` ≥ 4.5:1 body / 3:1 large; `primary.DEFAULT`/`primary.soft` ≥ 3:1 large; `text-soft`/`surface-2` ≥ 4.5:1 body / 3:1 large; `primary.soft`/`text` (blind spot) ≥ 4.5:1.

## Verification

- `python scripts/dc/dc-9-chrome.py` → PASS (DOM shape exact; contrast table correct; a11y attrs present).
- B1, B3 findings from `review-accessibility.md` closed.

## Out-of-scope (deferred)

- Story 10.11 (share-card chrome) — adds the PNG export.
- Story 10.14 (a11y review follow-ups) — covers H1-H5 high-value items.

---

*Story doc — frontmatter + 7 sections, ~50 lines.*