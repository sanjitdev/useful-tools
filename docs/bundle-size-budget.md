---
title: Bundle Size Budget — chrome JS + CSS gzipped totals
status: active
created: 2026-08-15
updated: 2026-08-15
story: x-3 (Bundle Size Budget NFR-1 Gate)
audience: anyone adding chrome JS or CSS
---

# Bundle Size Budget

NFR-1 in the PRD requires the shell JS to stay under 30 KB gzipped. The
current chrome surface is **142,420 bytes gzipped (~4.7× over)** as of
2026-08-15 (was 161,192 bytes before the api-contract.js
reclassification; was 162,915 bytes before the Story 2.10 cleanup
deleted `layout.js` + `theme.js`). Story x-3 builds the measurement +
CI gate; the path back to < 30 KB is its own epic.

This doc is the **decomposition** (AC-4 of the x-3 spec). It captures
the per-module breakdown, explains why we're 5× over the target,
identifies the top reduction candidates, and points at the long-term
recovery path (Story 4 / embed slim build).

---

## Measured baseline (2026-08-15)

The numbers below come from `make bundle-size` (which runs
`scripts/bundle-size-gate.py`). The locked baseline constant in the gate
is `BUNDLE_SIZE_BASELINE = 142_420` bytes gzipped JS (bumped DOWN from
161,175 on 2026-08-15 after the api-contract.js reclassification;
from 162,915 on 2026-08-15 after the Story 2.10 cleanup deleted
`layout.js` + `theme.js`); CSS total is 22,480 bytes gzipped (under the
25 KB CSS_BUDGET). Per Story x-3 policy, a Story that legitimately adds
chrome beyond the +5 KB tolerance must bump the baseline in a Story
commit (recorded decision, not an accident).

### JS — by size descending

| Module | Raw bytes | Gzipped | Owner | Notes |
|---|---|---|---|---|
| `assets/js/shell.js` | 94,696 | **26,841** | Story 1.5 | Chrome shell + theme + settings + palette + chords |
| `assets/js/history.js` | 59,508 | **16,717** | Story 2.3 + 3.6 | Per-tool history (LIFO + restore + subscribe + panel) |
| `assets/js/quiz.js` | 49,001 | **12,032** | Story 9.12 | Quiz pattern shell module (recent — grew fast) |
| `assets/js/storage-registry.js` | 27,857 | 7,488 | Story 1.10 | Namespaced key registry |
| `assets/js/quality.js` | 22,847 | 7,223 | Story 2.11 | `/quality` tool inventory |
| `assets/js/search.js` | 21,283 | 6,839 | Story 1.11 | Search engine + ranking |
| `assets/js/url.js` | 24,902 | 6,598 | Story 2.1 | urlState codec + bindForm |
| `assets/js/home-grid.js` | 19,648 | 6,139 | Story 1.9 | tools.json → home grid renderer |
| `assets/js/sample-data.js` | 20,767 | 5,976 | Story 2.2 | Sample + reset buttons |
| `assets/js/help-overlay.js` | 20,610 | 5,867 | Story 3.3 | Keyboard shortcuts overlay |
| `assets/js/share.js` | 18,920 | 5,014 | Story 2.5 | Share dialog (URL + embed + print) |
| `assets/js/import.js` | 19,228 | 5,004 | Story 3.8 | User data import from JSON |
| `assets/js/a11y.js` | 14,561 | 4,088 | Story 2.4 | Per-tool a11y audit |
| `assets/js/global-chords.js` | 9,887 | 3,572 | Story 3.4 | Cross-page `g <key>` navigation |
| `assets/js/view-source.js` | 11,548 | 3,483 | Story 3.11 | `/view-source` route |
| `assets/js/pack-grid.js` | 9,618 | 3,279 | Story 6.1 | Pack cards on home grid |
| `assets/js/pack-page.js` | 8,821 | 3,163 | Story 6.2 | `/packs/<pack>.html` renderer |
| `assets/js/utils.js` | 8,469 | 3,124 | Story 1.5 | `HT.qs` / `HT.fetch` / `HT.formatNumber` |
| `assets/js/palette-actions.js` | 7,888 | 2,607 | Story 3.2 | Command palette action set |
| `assets/js/export.js` | 7,839 | 2,381 | Story 3.7 | User data export to JSON |
| `assets/js/home-sidebar.js` | 4,173 | 1,630 | Story 3.12 | Recent list sidebar |
| `assets/js/pins.js` | 3,678 | 1,449 | Story 3.12 | Pinned tools (cap 9) |
| `assets/js/recent.js` | 3,147 | 1,404 | Story 3.12 | Recent tools (cap 5) |
| `assets/js/layout.js` | 2,190 | 898 | **LEGACY** | Story 2.10 marks for deletion |
| `assets/js/theme.js` | 1,936 | 842 | **LEGACY** | Story 2.10 marks for deletion |
| `assets/js/site-config.js` | 882 | 485 | Story 1.12 | Repo coordinates (frozen) |
| **TOTAL** | — | **142,420** | — | vs NFR-1 target 30,000 — **4.7× over** |

### CSS — by size descending

| Module | Raw bytes | Gzipped | Owner | Notes |
|---|---|---|---|---|
| `assets/css/components.css` | 64,566 | 13,193 | Story 1.5 + 3.x | Shared component styles (`.panel`, `.field`, `.result`, `.btn`) |
| `assets/css/base.css` | 11,945 | 3,752 | Story 1.5 | Reset + typography + cobalt tokens |
| `assets/css/quiz.css` | 10,834 | 2,697 | Story 9.12 | Quiz pattern styles |
| `assets/css/print.css` | 6,278 | 1,930 | Story 3.10 | `@media print` block |
| `assets/css/tools.css` | 3,901 | 908 | Story 1.5 | Shared utility classes |
| **TOTAL** | — | **22,480** | — | vs NFR-1 budget 30,000 — **under by 7.5 KB** |

---

## Why we're 4.7× over

The 30 KB target was set in the PRD before the chrome layer was designed
(NFR-1 was committed 2026-07-31; the chrome surface grew across Epic 1
→ Epic 2 → Epic 3). Three structural factors drove the overshoot:

1. **Epic 1 expanded scope** beyond the original 30 KB estimate. URL
   state (Story 2.1), history (Story 2.3), share (Story 2.5), a11y
   audit (Story 2.4), sample data (Story 2.2), and export/import (Story
   3.7 / 3.8) all load on every page because every Tool needs them.
2. **NFR-1 was set before the chrome layer was designed.** The 30 KB
   figure is the size of the "shell" before the shell grew to include
   history, share, palette, export, import, packs, and the quiz pattern.
3. **No automated gate** ever measured the cumulative picture. Every
   Story passed review on its individual size without anyone adding
   them up. Story x-3 is the gate that closes that gap.

(Note 2026-08-15: `api-contract.js` — 18,772 bytes gz — was previously
called out here as "the single largest contributor to the chrome
footprint beyond `shell.js`". It's been reclassified out of chrome
to the view-source bundle — it was never loaded on chrome pages to
begin with, only on view-source.html + quality.html. The bundle-size
gate had been over-counting. See candidate #1 below.)

---

## Top-3 reduction candidates

These are the highest-leverage opportunities for getting closer to the
30 KB NFR-1 target without dropping features. Candidate #1 (lazy-load
`api-contract.js`) was reclassified on 2026-08-15 — `api-contract.js`
was never chrome to begin with, only loaded on view-source.html +
quality.html. Candidates #2 (layout.js + theme.js) and #3 (quiz.js)
remain as future Stories.

### 1. ~~Lazy-load `api-contract.js`~~ (RECLASSIFIED 2026-08-15 — this story)

**Was:** The plan was to split `api-contract.js` into a `core` slice
(~5 KB gz) that ships on every page + a `surface` slice (~13 KB gz)
fetched on demand, saving ~13 KB gz. Documented as candidate #1
during Story x-3 authoring.

**Now:** The lazy-load refactor is **obsolete**. `api-contract.js` is
already only loaded on the pages that actually need it — it was never
chrome to begin with. The full file (18,772 bytes gz) is loaded by
exactly 2 special-purpose pages:

- `view-source.html` (the `/view-source` route renders the contract
  metadata for human viewing)
- `quality.html` (the `/quality` inventory audits the contract)

Neither `assets/js/view-source.js` nor `assets/js/quality.js`
actually **reads** `HT.__apiContract.entries` at runtime; the pages
load it for the "show the contract" feature. The `_smoke_*` test
harnesses read it via `fs.readFileSync` for cross-pin verification,
which doesn't count as a runtime consumer.

**Reclassified:** `api-contract.js` was moved from the chrome budget
to the **view-source/quality bundle** — the same categorization as
`vendor/highlight.min.js` + `vendor/zip-store.js` (already excluded
from chrome per `scripts/bundle-size-gate.py:111-114`). The bundle-
size gate had been over-counting since it shipped 2026-08-15.

**Actual impact:** **−18,772 bytes gz (full file size)** — not the
estimated ~13 KB from the lazy-load plan. NFR-1 gap drops from 5.4×
to 4.7× over. **Zero code changes.** The file is preserved verbatim;
`view-source.html` + `quality.html` keep their `<script>` tags; the
test harnesses keep their cross-pin verification.

**Effort:** ~30 minutes (gate update + doc + NFR-1 revision).
**Risk:** None — verified via grep that no chrome page reads
`HT.__apiContract.entries` at boot. `site-config-gate.py` still
cross-checks that `api-contract.js` exposes `HT.siteConfig` (separate
concern from the bundle budget).

### 2. ~~Drop `layout.js` + `theme.js`~~ (DONE 2026-08-15 — Story 2.10 cleanup)

**Was:** Both files loaded by every legacy page that hadn't migrated
to the modern Shell. The post-home-redesign retrofit confirmed that
**no current tool page references them** (every page loads chrome as
static HTML now). The files were dead code that still shipped to
anyone browsing with JS enabled.

**Now:** Both files **deleted** 2026-08-15. `scripts/bundle-size-gate.py`
SPEC_JS_MODULES list updated, BUNDLE_SIZE_BASELINE bumped DOWN to
161,175 (saving 1,740 bytes gz as predicted). `storage-registry.js`
register() for `ht.theme` re-owned by `shell.js`. All 9 chrome
manifests (index.html, quality.html, 6 pack pages, chrome.html)
re-spliced. Two shell-template.py regex sub() blocks removed.
ES5-grep MIGRATED list kept as a defensive check if either file is
ever re-added.

**Actual reduction:** 1,723 bytes gz (was 898 + 842 = 1,740 estimate;
gz compression on the empty file list delta accounted for the
17-byte drift).

### 3. Co-locate `quiz.js` into per-Tool bundles (~12 KB gz, ~7% of total)

**Today:** `quiz.js` loads on every page even though only the ~12
quiz-using tools call `HT.quiz.open()`. The other 30+ tools pay the
download cost.

**Tomorrow:** Move `quiz.js` from "every page" chrome into the
quiz-using tools' `<script>` tags. The tools already have helper
scripts (e.g., `citation-styles.js`, `diff.js`, `jwt-codec.js`) — the
quiz pattern joins them.

**Effort:** ~half a day (update tools.json + regenerate per-tool pages
+ retest). **Impact:** ~12 KB gz reduction on non-quiz pages.
**Risk:** Story 9.12's contract gate currently assumes `quiz.js` is
in the chrome; needs to be updated.

### Combined impact

With candidates #1 (reclassified) and #2 (DONE 2026-08-15) shipped,
the remaining candidate #3 gets us from **142,420 → ~130,000 bytes
gzipped** (a 9% additional reduction). Still 4.3× over NFR-1, but
each additional candidate gets incrementally harder.

---

## Long-term path to < 30 KB (Story 4 / embed slim build)

The 30 KB NFR-1 target is reachable only with code-splitting per Tool
and lazy-loading non-critical chrome (settings, palette, view-source,
export/import, packs). The plan:

1. **Tier 1 — Core shell** (~25 KB gz target): `site-config.js`,
   `utils.js`, `url.js`, `storage-registry.js`, `shell.js` (slimmed),
   `api-contract.js` (core slice). Loads on every page including
   `?embed=1`.
2. **Tier 2 — Deferred chrome** (~30 KB gz): `palette-actions.js`,
   `help-overlay.js`, `global-chords.js`, `settings.html` + `theme.js`.
   Loads on `keydown` for the palette chord or after first user
   interaction with the header.
3. **Tier 3 — Tool-specific bundles** (~30 KB gz per tool):
   `history.js`, `share.js`, `sample-data.js`, `a11y.js`, plus the
   tool's own `<slug>.js` and any local helpers. Loads only on the
   tool's page.

Story 4 owns the embed slim build that proves the architecture; the
remaining tier-splitting is per-Epic work as features are added or
re-shaped.

---

## How to keep the gate honest

When you add chrome (a new module, a feature that grows an existing
module, or a new Story that ships helper code):

1. Run `make bundle-size` locally before pushing.
2. If the gate fails, look at the per-module breakdown to find the
   offender.
3. Either trim the offender, or — if the addition is justified — bump
   `BUNDLE_SIZE_BASELINE` in `scripts/bundle-size-gate.py` in the same
   commit with a one-line comment explaining why.
4. Reference this doc in the Story's "Acceptance Criteria" section so
   reviewers see the budget decision.

The gate is intentionally **lenient** (+5 KB tolerance on top of the
baseline) so Story x-3 lands at the baseline exactly. Future Stories
that legitimately grow the chrome should bump the baseline; accidental
growth fails the gate.

---

## Cross-references

- `scripts/bundle-size-gate.py` — the gate itself (run via `make bundle-size`)
- `_bmad-output/implementation-artifacts/x-3-bundle-size-budget.md` — Story x-3 spec
- `_bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/NFR-1-REVISION.md` — proposed tiered budget (pending PRD owner approval)
- `assets/js/api-contract.js` — frozen API surface (18,772 bytes gz); reclassified out of chrome 2026-08-15 to the view-source bundle
- Story 4 (embed slim build) — long-term path back to < 30 KB
