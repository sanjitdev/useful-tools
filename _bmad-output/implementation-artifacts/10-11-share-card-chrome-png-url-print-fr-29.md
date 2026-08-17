# Story 10.11 — Share-card chrome (PNG / URL / Print) [FR-29]

**Slug:** `share-card-chrome`
**Status:** backlog
**Date:** 2026-08-17
**Brainstorm:** `_bmad-output/brainstorming/brainstorm-discovery-engine-2026-08-17/`
**AC gate (working tree):** `scripts/dc/dc-10-share-card.py`

---

## Context

Sanjit takes a quiz, gets an archetype, taps Share. He needs three actions: Copy URL (chat-friendly), Download as PNG (Twitter / Instagram / OG card), and Print (physical keepsake). The PNG must include a `<title>` element per H3 so screen-reader users on social-media platforms hear the archetype + blind spot, not "image".

## Goal

Wire the three share actions; generate a 1200×630 PNG with the cobalt palette via canvas `fillStyle = getComputedStyle(...)`; embed an SVG `<title>` element for social-media a11y.

## Files added

| Path | Purpose |
|---|---|
| `assets/js/share-card.js` | The PNG / URL / Print share module — `downloadAsPng` + `copyUrl` + `print`. |
| `assets/icons/og-disc-{slug}.svg` | Static OG SVG per archetype per quiz, each with `<title>{archetype} — {blind spot}</title>`. |
| `scripts/dc/dc-10-share-card.py` | AC gate — PNG dimensions + `<title>` element + canvas fallback. |

## Files modified

| Path | Change |
|---|---|
| `assets/js/results.js` (Story 10.3) | The Share button calls `HT.share.open(...)` with three actions. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Story 10.11 entry. |

## Public API (`HT.results` extension)

```js
HT.results.download(state: object, archetype: object) → Promise<Blob>
HT.results.copy(state: object, archetype: object) → string  // ≤ 280 chars
HT.results.print(el: Element) → void
```

PNG dimensions: 1200×630 (Twitter / OG card standard). `HTMLCanvasElement.toBlob` with `image/png`; fallback to "Copy as text" + toast if absent. SVG `<title>` per archetype per quiz.

## Verification

- `python scripts/dc/dc-10-share-card.py` → PASS (PNG dimensions correct; SVG `<title>` present; canvas fallback works).
- H3 finding from `review-accessibility.md` closed.

## Out-of-scope (deferred)

- Story 10.14 (a11y follow-ups) — covers H1 (debounce), H2 (focus-return), H4 (skip-link smoke).

---

*Story doc — frontmatter + 7 sections, ~50 lines.*