# Story 10.14 — Accessibility review follow-ups (B1, B2, B3)

**Slug:** `a11y-followups`
**Status:** backlog
**Date:** 2026-08-17
**Brainstorm:** `_bmad-output/brainstorming/brainstorm-discovery-engine-2026-08-17/`
**AC gate (working tree):** `scripts/dc/dc-13-a11y.py`

---

## Context

The accessibility review (`ux-discovery-engine-2026-08-17/review-accessibility.md`) found 3 blocking items (B1 contrast math, B2 Challenge announcement, B3 Tools-for-you DOM shape) and 5 high-value items (H1 debounce, H2 focus-return, H3 OG SVG `<title>`, H4 skip-link smoke, H5 receiver H1). All must close before any quiz ships at AA conformance.

## Goal

Close B1 + B2 + B3 + H1..H5; add smoke assertions; update DESIGN.md §2 + EXPERIENCE.md §3.1 + §3.2 + §5.1.

## Files added

| Path | Purpose |
|---|---|
| `scripts/dc/dc-13-a11y.py` | AC gate — B1 + B2 + B3 + H1..H5 smoke assertions. |
| `tests/fixtures/discovery-a11y/` | Negative fixtures for each a11y item (e.g., a quiz with no `<h2>` to fail B3). |

## Files modified

| Path | Change |
|---|---|
| `ux-discovery-engine-2026-08-17/DESIGN.md` | §2 contrast table per pairing (light + dark, body + large + non-text). |
| `ux-discovery-engine-2026-08-17/EXPERIENCE.md` | §3.1 step 4 (800 ms debounce); §3.1 (focus-return); §3.2 (consent toggle); §3.2 (receiver H1); §4 (skip-link smoke); §5.1 (DOM shape). |
| `ux-discovery-engine-2026-08-17/review-accessibility.md` | Mark B1/B2/B3 + H1..H5 closed with verification evidence. |
| `assets/js/results.js` (Story 10.3) | Adds the live-region debounce; adds focus-return on mount. |
| `assets/js/challenge-landing.js` (Story 10.12) | Adds the receiver-side `<title>` + `aria-live` + consent toggle. |
| `.github/workflows/tool-contract-gate.yml` | `make disc-a11y-smoke` step. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Story 10.14 entry. |

## Acceptance Mapping

| Finding | Resolution |
|---|---|
| B1 — contrast math on 3 bands | DESIGN.md §2 table; verified against tokens; pass/fail per AA |
| B2 — Challenge URL no accessible name | Receiver `<title>` + `aria-live` + consent toggle |
| B3 — Tools for you no internal heading | DOM shape `<h2>` + `<ul>` + `<li>` per Story 10.10 |
| H1 — live-region debounce | 800 ms debounce on result card mount |
| H2 — focus-return | focus → result card on mount; restore to Next button on back |
| H3 — OG SVG `<title>` | Per archetype per quiz, see Story 10.11 |
| H4 — skip-link contains aside | Smoke check: `document.querySelector('main.shell-main').contains(document.querySelector('.quiz-aside'))` |
| H5 — receiver H1 includes "challenge" | "You've been challenged to take {quiz title}" |

## Verification

- `python scripts/dc/dc-13-a11y.py` → PASS (all 8 findings closed; negative fixtures fail correctly).
- WCAG 2.1 AA conformance — `review-accessibility.md` verdict → unconditional pass.
- Brownfield clean: existing 50 tools' a11y attributes unchanged.

## Out-of-scope (deferred)

- None — this story is the gate for Stories 10.10 + 10.12.

---

*Story doc — frontmatter + 7 sections, ~50 lines.*