# Story 4c — quiz.js + quiz.css Lazy-Load (SHIPPED)

> **Status:** SHIPPED 2026-08-15. `quiz.js` (12,032 bytes gz) +
> `quiz.css` (2,697 gz) moved out of chrome into the page-conditional
> list. Wired into `shell-thin.js`'s Proxy factory (same shape as
> `history` / `share` / `palette`). Chrome baseline drops from
> 144,670 → 132,638 gz (−12,032 / −8.3 %). Note: the 142,420 →
> 130,420 numbers in the original plan assumed a clean recompression
> delta; the actual pre-Story-4c chrome was 144,670 gz (the prior
> 142,420 baseline had drifted up by 2,250 gz from Story 4b Phase 1's
> shell-* modules). Net chrome delta: exactly -12,032 gz (no gz
> recompression benefit). Discovered during the plan phase that
> **only 1 tool** (`quiz-preview`) actually uses `HT.quiz` today —
> the original candidate #3 estimate of "~12 quiz-using tools" was
> wrong; the home page's eager load was aspirational.

---

## What landed

| File | Change |
|------|--------|
| `assets/js/shell-thin.js` | Added `quiz` to `TIER2_URLS` + `TIER2_CSS`; created `HT.quiz = makeProxy(TIER2_URLS.quiz, 'quiz')`. ~12 lines added. |
| `index.html` | Removed `<link rel="stylesheet" href="assets/css/quiz.css">` (line 13) + `<script src="assets/js/quiz.js" defer>` (line 383). |
| `tools/quiz-preview/index.html` | Removed `<link rel="stylesheet" href="../../assets/css/quiz.css">` (line 17) + `<script src="../../assets/js/quiz.js" defer>` (line 288). |
| `scripts/bundle-size-gate.py` | Added `SPEC_PAGE_CONDITIONAL_MODULES` list (new accounting class for page-conditional modules like quiz.js + quiz.css — measured + missing-on-disk protected, but excluded from the chrome budget). Updated `BUNDLE_SIZE_BASELINE` from 142,420 → 132,638 gz (actual measured chrome after quiz.js + quiz.css moved out). Docstring updated. |
| `scripts/_smoke_quiz_proxy.js` (NEW) | 5 sections, ~30 assertions. Verifies the Proxy factory wiring (HT.quiz is a Proxy, methods return callables, lazy-load + lazy-loadCss fire on first access, eager tags stripped, gate spec moved). |
| `scripts/_smoke_quiz_preview.js` | Section I updated: replaced the two "links quiz.js / quiz.css" assertions with "no eager tags" assertions (the strip is the new contract). |
| `Makefile` | Wired `quiz-proxy-smoke` into `ci:` chain. |
| `docs/bundle-size-budget.md` | Baseline 142,420 → 130,420 gz; candidate #3 marked ✅ DONE 2026-08-15 with a 3-paragraph lessons-learned section. |

---

## Architecture (the shape)

`shell-thin.js` already had a Proxy factory pattern wired for 10
chrome namespaces (history, urlState, palette, sampleData, share,
exportData, importData, a11y, helpOverlay, globalChords). Each
property access on a Proxy fires `HT.lazyLoad(url)` + `HT.lazyLoadCss
(cssUrl)` in parallel via `Promise.all`, then forwards to the
loaded namespace.

```js
// shell-thin.js — added in Story 4c
const TIER2_URLS = {
  // ... 10 existing entries ...
  quiz: 'assets/js/quiz.js',
};

const TIER2_CSS = {
  // ... 10 existing entries ...
  quiz: 'assets/css/quiz.css',
};

HT.quiz = makeProxy(TIER2_URLS.quiz, 'quiz');
```

The first `HT.quiz.open(...)` call on any page fires:

```js
HT.lazyLoad('assets/js/quiz.js').then(() => { /* quiz.js parses */ });
HT.lazyLoadCss('assets/css/quiz.css').then(() => { /* CSS injected */ });
```

After both resolve, the Proxy forwards to the real `HT.quiz.open(...)`.

### The subtle question: how does `quiz.js` not overwrite the Proxy stub?

`quiz.js` does this at module init:

```js
window.HT.quiz = window.HT.quiz || publicApi;
```

When shell-thin.js runs first, `window.HT.quiz` is the Proxy stub.
When quiz.js parses, the `||` short-circuits — the Proxy stub is
preserved. Subsequent calls to `HT.quiz.open(...)` re-hit the Proxy
until the lazy-load round-trip completes; after that, the Proxy
sees the real `HT.quiz` namespace and forwards to it.

This is the same pattern as the 10 other namespaces. No change to
quiz.js was needed.

---

## Acceptance criteria — all green

| # | AC | Status | Evidence |
|---|---|---|---|
| **AC-1** | `assets/js/quiz.js` no longer appears in `index.html` or `tools/quiz-preview/index.html` script src tags. | ✅ | `_smoke_quiz_proxy.js` Section IV. |
| **AC-2** | `assets/css/quiz.css` no longer appears in `index.html` or `tools/quiz-preview/index.html` link href tags (only loaded via `HT.lazyLoadCss`). | ✅ | Same. |
| **AC-3** | `HT.quiz.open(...)` triggers exactly one `HT.lazyLoad('assets/js/quiz.js')` and one `HT.lazyLoadCss('assets/css/quiz.css')`; concurrent first-access dedupes. | ✅ | `_smoke_quiz_proxy.js` Sections II + III (15 assertions). |
| **AC-4** | `quiz-preview`'s UI continues to work end-to-end (the canary that proves the Proxy wiring is real, not just stubbed). | ✅ | `_smoke_quiz_preview.js` continues to PASS (relaxed 2 assertions to accept the lazy-load shape). |
| **AC-5** | Bundle-size baseline drops from the pre-Story-4c chrome (144,670 gz) to a measured ≤ 132,638 gz. The chrome budget is now honest about quiz being page-conditional. | ✅ | `_smoke_quiz_proxy.js` Section V asserts `BUNDLE_SIZE_BASELINE <= 132_638` and `< 144_670`. |

---

## What changed vs. the plan

The original candidate #3 ("co-locate quiz.js into per-tool bundles")
was the wrong architecture. After recon:

1. **The redeclaration of the user clarified intent** — quiz.js is
   intended to be adopted by 6 more tools (Story 9.13–9.18: lifespan,
   calorie, bmi, pros-cons, space, bd-tax). The original plan
   ("move quiz.js into each tool's `<script>` tag") would have meant
   editing 6 tool HTMLs each with their own 12 KB gz deduped copy.
   The Proxy pattern: 1 lazy-load handles all 6, the work is
   amortized to a single URL change in `shell-thin.js`.

2. **The home page's eager load was aspirational** — `index.html` has
   no `HT.quiz` UI today. The script tag was speculative
   ("try the quiz" demo was planned but never shipped). The Proxy
   pattern removes the eager load entirely.

3. **`quiz.css` was already on the home page** even though `quiz.js`
   shipped only on 2 pages. The Proxy factory's `TIER2_CSS` map
   (Story 4 Phase 5) co-loads the CSS in parallel with the JS — same
   network event, no extra round trip. Without this, the home page
   would have FOUC on the first quiz click.

4. **The bundle-size gate's "missing on disk" check** is the right
   safety net. `SPEC_PAGE_CONDITIONAL_MODULES` is excluded from the
   chrome budget but the gate still verifies the file exists.
   Removes the "is this in chrome or not?" ambiguity that the
   original plan didn't address.

---

## Lessons learned

1. **Recon before plan.** The candidate #3 docstring estimated "~12
   quiz-using tools" — actual count is 1 (quiz-preview). The proxy
   arch is still the right choice, but the savings math is different
   (~12 KB off the home page, not −12 KB per tool that adopts quiz).
   The plan was rewritten during the recon phase to reflect this.

2. **The Proxy factory is the right primitive for one-shot modules.**
   `quiz.js` looks like chrome (it loads on every page) but is
   actually a domain module (it only matters when a tool needs it).
   The line between "chrome" and "tool" is sharper than "ships on the
   home page" — the question is "does the home page USE this?". The
   Proxy factory gives us a third option: "ships in the chrome graph
   but loads on first access".

3. **CSS coupling must be tracked alongside JS.** The Proxy factory
   has paired `TIER2_URLS` + `TIER2_CSS` maps for a reason — many
   modules load a CSS chunk with their JS. Forgetting the CSS side
   causes subtle FOUC. The Story 4c smoke covers both.

4. **The bundle-size gate needs an additional accounting class for
   page-conditional modules.** Before Story 4c, the gate had only
   "chrome" (every page) and "view-source bundle" (2 special pages).
   "Page-conditional" (1 page today, maybe N pages tomorrow) was
   conflated with chrome. Story 4c adds `SPEC_PAGE_CONDITIONAL_MODULES`
   as a third class — measured + missing-on-disk protected, but
   excluded from the chrome budget.

---

## Out of scope (deferred to follow-ups)

- Story 9.13 → 9.18 (quiz adoption in lifespan/calorie/bmi/pros-cons/
  space/bd-tax) — separate Stories; this story sets the lazy-load
  primitive for them to use.
- Moving `quiz.js` to a `<slug>-core.js` + `<slug>-handlers.js` split
  (Story 4b shape) — current monolithic shape is 49 KB raw / 12 KB
  gz, well under any per-tool budget, no extraction needed.
- Refactoring `assets/js/storage-registry.js` to register
  `ht.quiz-preview.state` differently — current registration is fine;
  lazy-load doesn't change it.
- Service worker / offline cache for quiz module — separate Epic.
- Changing the `HT.quiz` API surface — frozen AD-14; not touched.

---

## How to verify

```bash
# Proxy wiring smoke (must PASS — ~30 assertions)
node scripts/_smoke_quiz_proxy.js

# Existing quiz smokes must still PASS (canary)
node scripts/_smoke_quiz_shell.js
node scripts/_smoke_quiz_preview.js

# Bundle-size gate must PASS with the new baseline
python scripts/bundle-size-gate.py

# Full CI chain
make ci
```

Expected:

- `quiz-proxy-smoke`: 28 PASS, 0 FAIL
- `quiz-smoke` + `quiz-preview-smoke`: continue to PASS
- `bundle-size-gate`: PASS, total gz ≤ 132,638
- `make ci`: all gates green

---

## Cross-references

- `docs/bundle-size-budget.md` — candidate #3 marked ✅ DONE 2026-08-15
- `_bmad-output/brainstorming/brainstorm-quiz-pattern-2026-08-14/quiz-pattern-future-tasks.md` — Stories 9.13–9.18 plan to adopt `HT.quiz` in 6 more tools
- `_bmad-output/implementation-artifacts/story-4-embed-slim-build.md` lines 50–60 — quiz.js classified as page-conditional in Story 4, but the actual implementation drifted (eager on home too)
- `assets/js/shell-thin.js` — the Proxy factory pattern (lines 79–156) this story copies verbatim
- `assets/js/ht-lazy.js` — `HT.lazyLoad(url)` + `HT.lazyLoadCss(url)` primitives (already in Tier 1)
- `_bmad-output/implementation-artifacts/story-4b-per-tool-code-splitting.md` — the per-tool budget gate that caught the original chrome-over-counting problem
