# Story 10.9 — Discovery pack page (`/packs/disc` route)

**Slug:** `discovery-pack-page`
**Status:** backlog
**Date:** 2026-08-17
**Brainstorm:** `_bmad-output/brainstorming/brainstorm-discovery-engine-2026-08-17/`
**AC gate (working tree):** `scripts/dc/dc-8-pack-page.py`

---

## Context

The "See all →" link from the home-grid Discover Me lane needs a destination. The pack page mirrors the existing pack-page renderer (Story 6.2) but adds the privacy disclosure in `<aside class="quiz-aside">` — the privacy-first posture is non-negotiable for the Discovery Engine.

## Goal

Ship `/packs/disc` route that renders the 6 quizzes + the privacy disclosure in `<aside>`; reachable from the home grid and the command palette.

## Files added

| Path | Purpose |
|---|---|
| `packs/disc.html` | The pack page (canonical chrome bytes per shell-template.py markers). |
| `assets/js/pack-page-disc.js` | Renders the 6 quiz cards + the privacy `<aside>`. |
| `scripts/dc/dc-8-pack-page.py` | AC gate — route reachable; aside contains the 2-line disclosure; keyboard-complete. |

## Files modified

| Path | Change |
|---|---|
| `assets/js/pack-grid.js` | Appended `disc` to the pack enum (was Travel/Finance/Study/Developer/Household). |
| `assets/js/pack-page.js` | Appended Discover Me tagline per the canonical voice. |
| `index.html` (or `chrome.html`) | The home grid renderer reads the new lane (Story 10.8). |
| `Makefile` | `disc-smoke` target added. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Story 10.9 entry. |

## Public API (DOM shape)

```html
<main class="shell-main" aria-label="Discover Me pack">
  <header class="pack-header">
    <h1 class="pack-title">Discover Me</h1>
    <p class="pack-tagline">Lighthearted personality + recommendation quizzes you can share. No accounts, no analytics.</p>
  </header>
  <aside class="quiz-aside" role="note">
    <p><strong>Privacy:</strong> Answers stay in your browser. Share URLs reveal only your archetype + blind spot — never your free-text answers. No analytics, no accounts.</p>
  </aside>
  <ul class="pack-grid">
    <li><a href="/disc/spirit-animal/">🦊 What spirit animal are you?</a></li>
    ... 5 more ...
  </ul>
</main>
```

Keyboard-complete: Tab cycles 6 cards; Esc returns focus to the home grid (inherited focus-return-on-leave).

## Verification

- `python scripts/dc/dc-8-pack-page.py` → PASS (route reachable; aside present; keyboard-complete).
- `make check-pack-composition` → `disc ≥ 5 ready` enforced (Story 10.18).
- `make validate-tools-json` → pack enum extended to include `disc`.

## Out-of-scope (deferred)

- Story 10.14 (a11y follow-ups) — verify skip-link target contains the `<aside>` (H4).

---

*Story doc — frontmatter + 7 sections, ~50 lines.*