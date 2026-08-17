# Story 10.12 — Challenge UX (receiver-side landing page + privacy default)

**Slug:** `challenge-ux`
**Status:** backlog
**Date:** 2026-08-17
**Brainstorm:** `_bmad-output/brainstorming/brainstorm-discovery-engine-2026-08-17/`
**AC gate (working tree):** `scripts/dc/dc-11-challenge-ux.py`

---

## Context

Maya pastes the Challenge URL. She must land on a page that (a) tells her what's happening, (b) lets her take the quiz blind by default, (c) only reveals the seeder's archetype + blind spot if she taps "Show me what they got first", (d) takes her to the compatibility view on completion. Per the accessibility review B2 + the rubric walker finding, this is a privacy-first UX with three load-bearing decisions.

## Goal

Ship `/disc/<slug>/#seed=<base36>&spec=<quiz>@<version>` landing page with the receiver-side `<title>`, the `aria-live` announcement, the consent toggle (default: blind), and the post-completion redirect to the compatibility view.

## Files added

| Path | Purpose |
|---|---|
| `assets/js/challenge-landing.js` | Parses the URL fragment; renders the consent toggle + the quiz mount; redirects on completion. |
| `assets/js/compatibility-card.js` | Renders the `components.compatibility-card` (DESIGN.md §1.2) with the 3-band percentage. |
| `assets/css/compatibility-card.css` | Compatibility card styles + 3-band colors. |
| `scripts/dc/dc-11-challenge-ux.py` | AC gate — `<title>` + announcement + toggle + redirect. |

## Files modified

| Path | Change |
|---|---|
| `packs/disc/<slug>/index.html` (each quiz) | Renders the landing page variant when `#seed=` is present. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Story 10.12 entry. |

## Public API

```js
HT.challenge.landing(quizSlug, seed, spec) → void  // renders the consent toggle + mounts the quiz
HT.challenge.compare(seedA, seedB, spec) → void    // renders the compatibility card
```

`<title>` = "Challenge from {archetype or 'a friend'}: {quiz title}"; `aria-live="polite"` region announces on mount. Consent toggle default: "Take the quiz blind". On completion, redirect to `/disc/<slug>/compare/#seedA=<local>&seedB=<remote>`.

## Verification

- `python scripts/dc/dc-11-challenge-ux.py` → PASS (title correct; announcement present; toggle default blind; redirect works).
- B2 + H5 findings from `review-accessibility.md` closed.

## Out-of-scope (deferred)

- Story 10.14 (a11y follow-ups) — covers H4 (skip-link contains aside smoke).

---

*Story doc — frontmatter + 7 sections, ~50 lines.*