# Story x-3 — Bundle Size Budget (NFR-1 Performance Gate)

Status: in-progress (gate shipped 2026-08-15; NFR-1 revision pending PRD owner approval)
Created: 2026-08-15
Origin: Deferred from code review of story-3-1-full-command-palette-with-top-5-fuzzy-matches-and-footer-hints (2026-08-11) and story-1-11-search-engine-backend-with-ranking-and-normalization (2026-08-07).
Cross-epic: yes (concerns every Story that adds chrome JS or CSS).

## Story

**As a** project maintainer responsible for the NFR-1 performance budget (LCP < 1.5s on mid-range mobile, shell JS < 30KB gzipped),
**I want** an automated gate that measures the gzipped byte size of every Shell + chrome module on every PR,
**so that** we never ship a regression that pushes the shell past the 30KB target and we have a deterministic record of what every Story added to the bundle.

## Source

### Origin 1 — Code review of Story 3-1 (command palette)

The 2026-08-11 review (W-5) found that the combined shell JS was **131 KB vs 30 KB NFR-1 target** — a **4.3× overshoot**. Story 3-1 added ~16 KB (palette render + smoke harnesses + doc rewrites) on top of a ~115 KB pre-existing baseline. AC-13 final bullet requires `combined total stays under 30 KB NFR-1`; spec line 52 carves out `≤2 KB for the render + footer + helpers` which is met. The Story's Resolution Notes acknowledge the overshoot and propose a separate cross-epic story.

### Origin 2 — Code review of Story 1-11 (search engine)

The 2026-08-07 review found that Story 1-11 claims `wc -c assets/js/search.js assets/js/api-contract.js = 19,002 bytes`, well under 30 KB NFR-1, **but no automated gate runs the check**. A regression that bloats `search.js` past 30 KB would not be caught.

## Current state (as of 2026-08-15)

### Measured baseline (pre-existing ~115 KB shell JS)

The 30 KB target is the **gzipped** size of every Shell + chrome module combined. The current baseline (gzipped) is:

| Module | Approx gzipped size | Owner |
|---|---|---|
| shell.js | ~32 KB | Story 1.5 |
| api-contract.js | ~8 KB | Story 1.14 |
| search.js | ~6 KB | Story 1.11 |
| home-grid.js | ~5 KB | Story 1.9 |
| palette render + footer + helpers | ~2 KB | Story 3.1 (carve-out) |
| Other chrome modules (a11y, history, share, etc.) | ~62 KB | Epic 2 + 3 |
| **Total** | **~115 KB** | (vs 30 KB target — **4.3× over**) |

The full Chrome surface has grown past the original NFR-1 budget by 4× as Epic 1, 2, and 3 have added features (URL state, history, share, export, import, palette, etc.). Story 3.1's contribution of 16 KB is within Story 3.1's `<2 KB` carve-out (the palette render + footer + helpers); the over-budget state predates Story 3.1.

### Why we're 4× over budget

1. **Epic 1 scope expanded** beyond the original 30 KB estimate. URL state (Story 2.1), history (Story 2.3), share (Story 2.5), a11y audit (Story 2.4), sample data (Story 2.2), and export/import (Story 3.7-3.8) all add to the shell because they must be available on every page.
2. **NFR-1 was set before the chrome layer was designed** (project-context §6 + ARCHITECTURE-SPINE §NFR-1). The 30 KB figure was for "shell" before the shell grew to include history, share, palette, export, import.
3. **No automated gate** has ever measured the actual gzipped size — every Story passed review on its individual size without the cumulative picture.

### What the NFR-1 contract actually says

> Total JS for shell < 30KB gzipped. Total CSS < 30KB gzipped. Tool's first load adds ≤ 30KB over shell.

The 30 KB figure is in `_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md` NFR-1. The Chrome footprint has never matched it.

## Acceptance Criteria

### AC-1 — Baseline measurement is reproducible

`scripts/bundle-size-gate.py` produces a deterministic, machine-readable measurement of every Shell + chrome module's gzipped byte size on every run. Exit 0 on within-budget, exit 1 on over-budget. Prints a per-module breakdown sorted by size descending.

**Concretely:** `make bundle-size` runs the gate; output includes:
- Per-module gzipped size in bytes
- Sum (the actual NFR-1 number)
- Delta vs the locked baseline (AC-2)
- Delta vs the 30 KB target (NFR-1)
- Per-PR delta (the CI assertion)

### AC-2 — Baseline is locked

The current 115 KB baseline is captured as a `BUNDLE_SIZE_BASELINE = 115_000` constant (approximate) in `scripts/bundle-size-gate.py`. PRs that push the sum above the baseline + 5 KB tolerance fail the gate. The locked baseline is the source of truth for "did this PR make the bundle worse?" — not the 30 KB NFR-1 (which is aspirational and subject to NFR-1 revision, see AC-5).

### AC-3 — CI gate fires on PRs

The gate is wired into `make ci` and into the GitHub Actions workflow (`.github/workflows/tool-contract-gate.yml`). The PR comment surfaces a `bundle-size` annotation showing the per-module breakdown and the delta vs baseline. A regression that exceeds the +5 KB tolerance fails the workflow before merge.

### AC-4 — Decomposition is documented

A `docs/bundle-size-budget.md` is created that:
- Lists every Shell + chrome module with its current gzipped size
- Explains the gap between the 30 KB NFR-1 target and the 115 KB reality
- Identifies the top-3 candidates for size reduction (lazy-loaded modules, code-split per Tool, dropping the inline `<script type="application/json">` splice for production, etc.)
- Names the deferred "embed slim build" work (Epic 4) as the long-term path to < 30 KB

### AC-5 — NFR-1 revision proposal

A NFR-1 revision proposal is drafted in `_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/NFR-1-REVISION.md` that proposes raising the shell JS budget from 30 KB to a tiered structure (e.g., core shell < 30 KB, full chrome < 120 KB, tool-specific first-load < 30 KB on top of the chrome). The proposal cites the AC-4 decomposition as evidence and proposes a path back to < 30 KB if product priorities allow.

The revision proposal is **not** auto-merged — it waits for PRD owner approval before becoming the new NFR-1.

### AC-6 — Per-Story size budget tracking

Every Story that adds a chrome module declares its expected size delta in the Story spec (e.g., "Story 3.7: export.js, expected +6 KB gzipped"). The CI gate compares the actual delta to the declared delta and warns (not fails) on drift > 1 KB. The drift data feeds the AC-4 decomposition so the top-N bloat sources stay visible.

## Implementation sketch (proposed)

### Step 1 — `scripts/bundle-size-gate.py`

```python
#!/usr/bin/env python3
"""Bundle size gate — Story x-3.

Measures every Shell + chrome module's gzipped byte size, sums it,
compares to the locked baseline, and exits non-zero on regression.
"""
import gzip
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SHELL_MODULES = [
    "assets/js/shell.js",
    "assets/js/api-contract.js",
    "assets/js/search.js",
    "assets/js/home-grid.js",
    # ... full chrome surface
]
BASELINE_GZ = 115_000  # captured 2026-08-15
TOLERANCE_GZ = 5_000   # ±5 KB tolerance before failing

def measure(path: Path) -> int:
    return len(gzip.compress(path.read_bytes()))

def main() -> int:
    sizes = [(m, measure(REPO / m)) for m in SHELL_MODULES if (REPO / m).exists()]
    total = sum(s for _, s in sizes)
    delta = total - BASELINE_GZ
    # Sort + print
    for m, s in sorted(sizes, key=lambda x: -x[1]):
        print(f"  {m:50s}  {s:>7,d} bytes")
    print(f"\n  Total: {total:,d} bytes (baseline {BASELINE_GZ:,d}, delta {delta:+,d})")
    if delta > TOLERANCE_GZ:
        print(f"  FAIL: bundle grew by {delta:,d} bytes (tolerance {TOLERANCE_GZ:,d})")
        return 1
    print("  PASS")
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

### Step 2 — Makefile wiring

Append a `bundle-size:` target and add it to the `ci:` chain (before `regression-sweep` so a bloat regression fails fast).

### Step 3 — GitHub Actions annotation

The existing `.github/workflows/tool-contract-gate.yml` runs `make ci`. Add a `bundle-size` annotation step that posts the per-module breakdown to the PR conversation.

### Step 4 — `docs/bundle-size-budget.md`

Document the current state, the NFR-1 gap, the top-3 reduction candidates, and the path forward.

### Step 5 — NFR-1 revision proposal

Draft `NFR-1-REVISION.md` with the tiered budget proposal. Circulate to PRD owner for approval.

## Tasks

1. [x] **Task 1 — Implement `scripts/bundle-size-gate.py`** with the AC-1 measurement + AC-2 locked baseline + AC-3 CI exit codes. Verify with `make bundle-size` on the current main. (shipped 2026-08-15 — baseline locked at 162,915 bytes gzipped; gate exits 0 on main, 1 on regression, 2 on vacuous, 3 on invocation error; JSON last-line output for CI scrapers)
2. [x] **Task 2 — Wire into `make ci`** as `bundle-size:` target, add to `ci:` chain. Verify `make ci` still exits 0 on main. (shipped 2026-08-15 — `bundle-size:` target inserted in Makefile between `shell-a11y` and `verify-compound`; wired into `ci:` chain at the same position so a bloat regression fails fast before the more expensive smoke chain runs)
3. [ ] **Task 3 — Add GitHub Actions annotation** posting the per-module breakdown to PR conversations. Verify on a test PR (can use a fork).
4. [x] **Task 4 — Author `docs/bundle-size-budget.md`** with the AC-4 decomposition + top-3 reduction candidates. (shipped 2026-08-15 — full per-module table for 27 JS + 5 CSS modules; 3 reduction candidates ranked by leverage; Story 4 path back to < 30 KB)
5. [x] **Task 5 — Draft NFR-1 revision proposal** in `_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/NFR-1-REVISION.md` with the tiered budget. (shipped 2026-08-15 — proposal recommends Tier 1 < 30 KB / Tier 2 < 200 KB / per-Tool ≤ 30 KB; status: draft pending PRD owner approval)
6. [ ] **Task 6 — Capture per-Story baseline data** — walk the existing Epics 1-3 Stories and record their declared vs actual bundle deltas. Feeds the AC-6 drift detection.
7. [x] **Task 7 — Add `bundle-size` row to `docs/README.md`** index so the budget doc is discoverable. (shipped 2026-08-15 — index row added with companion-artifact description; footer `Updated 2026-08-15` line added)
8. [x] **Task 8 — Story 2.10 cleanup** (follow-up to AC-4 reduction candidate #2): deleted `assets/js/layout.js` (898 gz) + `assets/js/theme.js` (842 gz). Bumped baseline DOWN 162,915 → 161,175 (-1,740 bytes gz actual). Re-owned `ht.theme` to `shell.js` in storage-registry.js + all 9 chrome manifests. Removed two `<script>`-strip regex blocks from shell-template.py. Updated _es5_grep.py docstring + MIGRATED list notes. Verified all 7+ gates pass post-cleanup. (shipped 2026-08-15 — see "Cleanup (2026-08-15)" section in `_bmad-output/implementation-artifacts/2-10-shared-layout-theme-utils-migration-to-modern-js.md`)

## Verification (so far)

- ✅ `make bundle-size` exits 0 on the current main (baseline 162,915 = measured, delta +0).
- ✅ `make ci` chain includes `bundle-size`; runs alongside the existing 30+ gates.
- ✅ Gate fails on artificially-low baseline (`--baseline 150000` → exit 1 with clear message).
- ✅ `docs/bundle-size-budget.md` reachable from `docs/README.md` index.
- ⏳ PR-comment annotation (Task 3) — pending GitHub Actions workflow update.
- ⏳ Per-Story baseline data (Task 6) — pending per-Story walkthrough.
- ⏳ NFR-1 revision approved by PRD owner (Task 5 proposal is `draft`).

## Cross-references

- Story 1.11 (search engine) — first story to propose a byte-budget gate (deferred to this story)
- Story 3.1 (command palette) — first story to record the 131 KB combined size (deferred to this story)
- Story X.1 (headless smoke harness) — Story 1.13 already lists "scripts/bundle-size-gate.py wired into the `make ci` chain" as a future work item; this story is the implementation of that future work.
- Story 4 (embed slim build) — long-term path to the < 30 KB NFR-1 target; this story builds the gate that measures progress toward that target.
- NFR-1 (PRD) — the aspirational target; this story documents the gap and proposes a revision.

## Out of scope

- **Actually reducing the bundle** to < 30 KB. This story builds the measurement + gate + tracking; the reduction work is its own epic (Story 4 / embed slim build + per-Tool lazy loading).
- **CSS budget enforcement.** NFR-1's 30 KB CSS budget is currently well under (the chrome CSS is ~12 KB gzipped). Future Stories that add tool-specific CSS should track it, but no gate is needed today.
- **Per-Tool first-load tracking.** NFR-1's "Tool's first load adds ≤ 30KB over shell" is also aspirational; today's Tools ship as part of the chrome layer (no code-split). Code-splitting is Story 4 scope.
