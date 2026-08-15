# NFR-1 Revision Proposal — Performance / Bundle Budget

**Status:** draft (pending PRD owner approval)
**Author:** Handy Tools team (via Story x-3)
**Created:** 2026-08-15
**Story:** x-3 — Bundle Size Budget NFR-1 Gate
**Supersedes:** NFR-1 bullet "Total JS for shell < 30KB gzipped" as written
in `prd-useful-tools-2026-07-31/prd.md` line 336

---

## Summary

The PRD's NFR-1 budget ("Total JS for shell < 30KB gzipped") was set on
2026-07-31, before the chrome layer was designed. By the time Epic 3
shipped (2026-08-12), the chrome footprint had grown to **162,915 bytes
gzipped** — a **5.4× overshoot** of the original target. Story x-3 (this
proposal's companion) builds the measurement + CI gate; this proposal
recommends a **revised, tiered budget** that reflects the actual surface
the project has shipped and provides a path back to a single-digit-multiple
target.

The revision is **not** a "give up on the budget" move. It's a
re-baselining against real chrome + a structure that makes the path back
to < 30 KB tractable (Story 4 / embed slim build) without requiring the
project to delete features.

---

## Current state (2026-08-15)

| Tier | Measured (gzipped) | NFR-1 target | Overshoot |
|---|---|---|---|
| JS chrome | 162,915 bytes | 30,000 bytes | **5.4×** |
| CSS chrome | 22,480 bytes | 30,000 bytes | under by 7.5 KB |
| Per-tool first-load | varies (tool-specific) | 30,000 bytes over shell | varies |

The JS overshoot is driven by three structural factors:

1. **Epic 1 scope expanded** beyond the original 30 KB estimate (URL
   state, history, share, a11y, sample data, export/import).
2. **NFR-1 was set before the chrome layer was designed** (the 30 KB
   target was for the "shell" before the shell grew to include history,
   share, palette, export, import, packs, and the quiz pattern).
3. **No automated gate** ever measured the cumulative picture.

See `docs/bundle-size-budget.md` for the per-module breakdown and the
top-3 reduction candidates.

---

## Proposed revision

Replace the NFR-1 line:

> ~~Total JS for shell < 30KB gzipped.~~

With a tiered structure:

> **Total JS for shell chrome** < 30KB gzipped (Tier 1 core shell — Story 4 target).
> **Total JS for full chrome** < 200KB gzipped (Tier 2 — current chrome surface with tolerance; current baseline 162,915 bytes gzipped, +5 KB tolerance per `bundle-size` gate).
> **Total CSS for chrome** < 30KB gzipped (current baseline 22,480 bytes gzipped).
> **Per-Tool first-load** ≤ 30KB gzipped on top of chrome (Story 4 target via per-Tool code-splitting).

### Why a tiered structure

A single 30 KB target is unreachable without dropping features that
real users depend on. A tiered structure:

1. **Documents the real chrome footprint** as Tier 2 (200 KB budget)
   so future Stories know what they're working against.
2. **Keeps the < 30 KB aspiration alive** as Tier 1 (core shell only,
   after Story 4 ships the embed slim build).
3. **Separates "shell always loaded" from "tool-specific add-ons"** so
   per-Tool optimization has a clear budget boundary.
4. **Aligns with the Story 4 tier-splitting architecture** (core shell /
   deferred chrome / tool-specific bundles).

### What this changes

For the project today, **nothing changes operationally**. Story x-3's
gate (`scripts/bundle-size-gate.py`) already implements the tiered
structure in code — it measures every chrome module, sums the JS, and
fails when the sum exceeds `BUNDLE_SIZE_BASELINE + BUNDLE_SIZE_TOLERANCE`
(currently 162,915 + 5,000 = 167,915). The gate just needs the PRD
language to match.

For the project after Story 4 (embed slim build) lands, **the Tier 1
< 30 KB budget becomes the new contract for the slim chrome**. The
`bundle-size` gate splits into two:
- `bundle-size-core`: < 30 KB gz (the slim shell that ships on every page)
- `bundle-size-full`: < 200 KB gz (the deferred chrome that loads on demand)

For **NFR-1's other constraints** (LCP < 1.5s, TTI < 1s, CLS ≤ 0.05),
no revision is proposed. Those are measurable against Story 4's slim
build outcome.

---

## Acceptance criteria for the revision

If the PRD owner approves, this revision will:

- [ ] Be merged into `_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md`
      as a replacement for NFR-1's "Total JS for shell < 30KB gzipped" bullet.
- [ ] Cross-reference `docs/bundle-size-budget.md` as the supporting decomposition.
- [ ] Cross-reference Story 4 (embed slim build) as the path back to a
      Tier 1 < 30 KB budget.
- [ ] Update the implementation-readiness-report-2026-07-31.md to note
      the NFR-1 language changed (no other drift should be claimed).

If the PRD owner rejects, the project keeps the existing NFR-1 language
and the `bundle-size` gate operates against a 30 KB target that the
project is already 5.4× over. In that case, Story 4 (embed slim build)
becomes **mandatory** before any further chrome additions, and the
PR-rejection rate will spike because every chrome Story will need to
justify pushing the bundle further past the original target.

---

## Implementation steps (after approval)

1. Edit `prd.md` line 336 to read the tiered structure above.
2. Add a "See also" line referencing `docs/bundle-size-budget.md`.
3. Update the readiness report's NFR-1 entry.
4. (Optional) Add `bundle-size-core` as a separate Makefile target
   measuring only the Story 4 slim shell — deferred until Story 4 lands.
5. Bump the Story x-3 status from "ready-for-planning" to "done" in
   `_bmad-output/implementation-artifacts/x-3-bundle-size-budget.md`.

---

## Alternatives considered

### Alternative A — Keep the 30 KB target unchanged

Reject every chrome addition until the bundle is under 30 KB. **Rejected:**
this freezes Epic 4-7 work and forces a feature-cull (history, share,
export, import, packs, quiz pattern are all post-Epic-1 surface). Users
depend on these features; deleting them would be a regression.

### Alternative B — Raise the budget to 200 KB single-tier

Simplest path: drop the tiered structure, raise to 200 KB. **Rejected:**
loses the < 30 KB Tier-1 aspiration entirely. Story 4's embed slim
build becomes optional rather than required, and the project has no
structural motivation to chase the perf budget.

### Alternative C — Per-module budgets only, no total

Track each module's size individually but don't sum. **Rejected:**
loses the "total chrome fits in X KB" guarantee. Per-module tracking
without a total lets the sum drift to any value, which is exactly the
failure mode that produced the current 5.4× overshoot.

### **Alternative D (chosen)** — Tiered structure

Keeps the Tier 1 < 30 KB aspiration alive as the Story 4 target while
documenting the real Tier 2 ~200 KB budget for the current chrome
surface. Provides a clear architectural seam for the recovery path.

---

## Cross-references

- `docs/bundle-size-budget.md` — per-module breakdown + top-3 reduction candidates
- `_bmad-output/implementation-artifacts/x-3-bundle-size-budget.md` — Story x-3 spec
- `scripts/bundle-size-gate.py` — the gate that implements this tiered structure
- `prd.md` line 336 — the NFR-1 statement this proposal revises
- Story 4 (embed slim build) — the path back to Tier 1 < 30 KB
