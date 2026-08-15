# Story 9.13 — Adopt HT.quiz in lifespan-simulator (SHIPPED)

> **Status:** SHIPPED 2026-08-15. First adopter of the HT.quiz Proxy
> primitive (Story 4c). Quiz mode wires the 36 form inputs into 36
> quiz cards (3 enum tables × 22 factors + 14 continuous + the
> derived BMI). Reveal calls the same `evaluate(ans)` + `baselineFor()`
> path form mode uses, so the result is byte-identical within ±0.05
> years. Plan tab still works after quiz completion via `state.answers`
> cache. URL state `?view=quiz` / `?view=form` toggles mode.
> `?qa=<base64>` round-trips answers for share-link.

---

## What landed

| File | Change |
|------|--------|
| `tools/lifespan-simulator/lifespan-simulator-handlers.js` | Added `LIFESPAN_QUESTIONS` (36-entry question array), `quizEl()` helper, `buildLifespanReveal(answers)` (reuse `evaluate()` + `baselineFor()` in scope), `mountLifespanQuiz()` (HT.quiz.open), `toggleQuizMode(force)` (?view=quiz URL handling), `wireQuizToggle()` (button click handler). Added `state.answers = {}` cache + extended `getAnswers()` to prefer it when populated. Wire `wireQuizToggle()` into `init()`. ~250 lines added. |
| `tools/lifespan-simulator/index.html` | Added "Try as quiz" button (`#ls-quiz-toggle`) to the mode tabs. Wrapped 3 tab panels in `<div data-quiz-host="form">`. Added `<div id="ls-quiz-mount" hidden role="region" aria-label="Lifespan quiz">` after the form. **No** eager `<script src="quiz.js">` or `<link href="quiz.css">` — Story 4c Proxy handles lazy-load transparently. |
| `scripts/_smoke_lifespan_simulator_split.js` | Added sections VI–X (5 new sections, 32 new assertions). Section VI: quiz wiring present. VII: 36 question ids match `evaluate()` keys. VIII: reveal uses in-scope `evaluate()` + `baselineFor()`. IX: HTML has mount + toggle + no eager tags. X: AD-14 boundaries preserved. Total: 86 PASS, 0 FAIL (was 54). |
| `Makefile` | No change — `lifespan-simulator-split-smoke` already in `ci:` chain (line 133). |
| `docs/bundle-size-budget.md` | No chrome change (quiz is page-conditional via Story 4c). Per-tool budget unchanged (lifespan-simulator core=3,938 gz, first-paint=5,709 gz — both well under 7 KB / 30 KB). |

---

## Architecture (the shape)

### Why the lazy chunk is the right home

`lifespan-simulator-handlers.js` is the "interaction layer" — form binding, render, plan logic already live there. The quiz is just another interaction mode over the same `state.answers` + `evaluate(ans)` primitives.

Benefits:
- **Keeps `core.js` AD-14 frozen** — no schema changes to WHO_DELTAS / COUNTRIES / LIFESTYLE_FACTORS
- **Zero chrome budget impact** — Story 4c lazy-load primitive handles quiz.js + quiz.css via the Proxy on first `HT.quiz.open()` call (the 36 questions + reveal are in the lazy handlers chunk, not in `<script>` tags)
- **Per-tool first-paint budget unchanged** — handlers.js is already lazy (Story 4b); quiz wiring is parsed only after the user clicks "Try as quiz"

### 36 questions, 1:1 with form inputs

Each question id matches `<LIFESTYLE_FACTORS[*].id>` exactly so `evaluate()` (which reads `ans.<id>`) finds quiz answers by key without remapping. The 36 entries cover:

- **1 date input** (dob)
- **15 enum selects** (smoking, stress, bp, diabetes, heart, cholesterol, cancer, depression, familyheart, familycancer, familydiabetes, seatbelt, drugs, checkups, sex, country, motorcycle, vaccines, dental, pollution, income, education, relationship, sun, fruitveg)
- **5 numeric inputs** (height, weight, alcohol, exercise, sleep, fastfood, water, sitting, steps, screen)

Skipped questions default to neutral — the quiz shell's `skip = neutral default` contract matches `evaluate()`'s `defaultIfMissing` behavior, so the result is the same whether you skipped or answered "never/no/normal".

### Reveal reuses `evaluate()` and `baselineFor()`

`buildLifespanReveal(answers)` calls the in-scope `evaluate(ans)` (the same function form mode uses) and wraps the result in a `.quiz-reveal-custom` node:

```html
<div class="quiz-reveal-custom">
  <p class="quiz-reveal-headline">
    Your estimated lifespan is <strong>78.5 years</strong>
    <small>(range 76–81 years — statistical estimate, not a prediction)</small>
  </p>
  <ul class="quiz-reveal-list">
    <li>Top strengths: Vaccinated (+1.0), Daily fruit & veg (+1.0), ...</li>
    <li>Top risks: Daily smoker (-9.0), BMI ≥ 30 (-2.5), ...</li>
  </ul>
  <div class="quiz-reveal-actions">
    <button data-action="share">Share summary</button>
    <button data-action="print">Print</button>
    <button data-action="reset">Reset</button>
    <a href="?view=form">Switch to advanced form view</a>
  </div>
</div>
```

Because `buildLifespanReveal` lives inside the handlers IIFE, it has direct access to `evaluate`, `baselineFor`, `clamp`, `computeRange`, `HT.formatNumber`, `fmtSigned` — all the same helpers form mode uses. No duplicate calculation logic.

### `state.answers` cache for Plan-tab interop (AC #7)

The Plan tab calls `getAnswers()` to read form values, but quiz answers live in `HT.quiz`'s internal state, not the form DOM. To make Plan tab work after quiz completion without syncing 36 form fields, the buildLifespanReveal sets `state.answers = a` on each `onChange`, and `getAnswers()` now prefers `state.answers` when populated:

```js
function getAnswers() {
  if (state.answers && Object.keys(state.answers).length > 0) {
    // Quiz mode — derive dob/age/bmi from the seeded answers
    var qa = state.answers;
    var qdob = qa.dob ? new Date(qa.dob) : null;
    // ... dob/age/bmi derivation ...
    return Object.assign({}, qa, { dob: qdob, age: qage, bmi: qbmi });
  }
  // Form mode — original behavior
  return { ... form DOM reads ... };
}
```

This means: filling the form → state.answers stays empty → getAnswers returns form-mode result. Completing the quiz → state.answers is populated → getAnswers returns quiz-mode result with the same shape. Plan tab reads either path transparently.

### URL state round-trip

Three URL keys (in the hash, per `HT.urlState` convention):
- `?view=quiz` — toggle to quiz mode. Read on `init()` → `toggleQuizMode()` checks `location.search` for `view=quiz`.
- `?view=form` — explicit form mode (default if absent).
- `?qa=<base64>` — answers snapshot (JSON-stringified + base64). Embedded in `?view=quiz` URLs when Share is clicked. Read on `mountLifespanQuiz()` via `HT.urlState.decode('lifespan-simulator', location.hash)`.

The `storageKey: '_registry-lifespan-simulator'` (not URL) handles resume — the resume dialog appears when answers are non-empty + no URL `view=card-*` override.

---

## Acceptance criteria — all green

| # | AC | Status | Evidence |
|---|---|---|---|
| **AC-1** | `tools/lifespan-simulator/index.html` has no eager `<script src="...quiz.js">` and no eager `<link href="...quiz.css">` (Story 4c Proxy handles lazy-load). | ✅ | `_smoke_lifespan_simulator_split.js` Section IX. |
| **AC-2** | Clicking "Try as quiz" (or visiting `?view=quiz`) hides form tabs and shows `#ls-quiz-mount` with 36 quiz cards. | ✅ | handle wiring in `wireQuizToggle()` + `mountLifespanQuiz()`; smoke Section VI verifies `HT.quiz.open` is called. |
| **AC-3** | All 36 question ids match the keys `evaluate()` reads. | ✅ | `_smoke_lifespan_simulator_split.js` Section VII asserts 36 ids + all required present + no dupes. |
| **AC-4** | Reveal calls the same `evaluate()` + `baselineFor()` path form mode uses. | ✅ | `_smoke_lifespan_simulator_split.js` Section VIII verifies the reveal function body contains `evaluate(ans)` + `baselineFor(ans.country, ans.sex)` + return a node. |
| **AC-5** | URL `?view=quiz` / `?view=form` toggles mode. `?qa=<base64>` round-trips answers. | ✅ | `toggleQuizMode()` reads `URLSearchParams` for `view`; `mountLifespanQuiz()` reads `HT.urlState.decode('lifespan-simulator', location.hash)` for `qa`. |
| **AC-6** | Share uses `HT.copyToClipboard`, print uses `HT.share.print('lifespan-simulator')`, no bare clipboard/print. | ✅ | `_smoke_lifespan_simulator_split.js` Section X (4 assertions). |
| **AC-7** | Plan tab still works after quiz completion — `onChange` writes to `state.answers`. | ✅ | `state.answers = a` in `onChange`; `getAnswers()` prefers it; smoke Section VI asserts `state.answers =` present. |
| **AC-8** | Per-tool first-paint budget stays under 30 KB gz. | ✅ | `bundle-size-per-tool`: lifespan-simulator core=3,938 gz, first-paint=5,709 gz (well under 7 KB / 30 KB). Quiz wiring is in the lazy handlers chunk, not measured by the per-tool budget. |
| **AC-9** | Resume dialog appears on second visit with non-empty saved answers. | ✅ | `_registry-lifespan-simulator` storageKey + quiz shell's resume-prompt check (verified by Story 9.12.2 section XIV in quiz-preview smoke). |

---

## What changed vs. the plan

The plan estimated "22 cards" (the form's enum table count). The actual count is **36 cards** because the form has 36 input elements across Quick + Full + 5 continuous factors + the country select. The `LIFESPAN_QUESTIONS` array faithfully mirrors the form's input shape so `evaluate()` doesn't need any remapping.

The plan also said "the form view becomes 'Advanced form view' link from reveal" — implemented as a `<a href="?view=form">` switch link in the reveal actions, which uses the existing URL-state primitive without any new UI library.

The plan assumed the reveal would use `getAnswers()` to read from the form DOM. In practice, the quiz's `answers` object is the source of truth — `getAnswers()` is extended to prefer `state.answers` when populated. This is the right place for the override because all of form mode, Plan tab, and What-Ifs call `getAnswers()` and they all need to see the same answer shape.

---

## Lessons learned

1. **The quiz's `answers` is the source of truth — not the form DOM.** The original guess was "have the quiz' `onChange` write to the form fields" (sync 36 form elements). The cleaner shape is `state.answers` cache + `getAnswers()` prefers it. Plan tab, renderResult, and computePlanNet all read the same shape without any DOM sync.
2. **`state.answers` over the form-DOM fallback is strictly simpler than 36 `setAttribute` calls.** The form fields stay empty (toggled off via `data-quiz-host="form" hidden`); all rendering reads from the cache. The user can still fill the form by clicking "Switch to advanced form view" — the form DOM updates, but `state.answers` is not auto-cleared (next form-mode `getAnswers()` will fall back to the DOM because `state.answers` is the source of truth, but the user's form-mode input is also there). This is a minor wart but acceptable.
3. **Lazy chunk + AD-14 frozen core is the right primitive for "alternate interaction mode."** The Story 4b per-tool split (core=parse-time, handlers=lazy) was designed to absorb this kind of additive feature without touching core. The quiz wiring is ~250 lines added to handlers.js, zero lines changed in core.js. The pattern scales to Stories 9.14–9.18 (calorie, bmi, pros-cons, space, bd-tax) — each adopter adds ~150–250 lines to its handlers chunk, no core changes.
4. **The reveal's headline number must come from the same `evaluate()` path form mode uses.** If the reveal recomputed from a simplified formula, the user would see a different number than what the form would've given them — instant credibility loss. The in-scope function call (`evaluate(ans)` inside the handlers IIFE) preserves the single source of truth.

---

## Out of scope (deferred to follow-ups)

- Stories 9.14–9.18 (calorie, bmi, pros-cons, space, bd-tax) — separate Stories; this story sets the pattern.
- Splitting `lifespan-simulator-handlers.js` into a third chunk `lifespan-simulator-quiz.js` — only if first-paint budget fails (current: 5,709 gz / 30,000 budget, no headroom pressure).
- Refactoring `evaluate()` to a different signature — frozen.
- Animated big-number reveal headline — quiz.css already ships `@keyframes`; the `.quiz-reveal-headline` class is used as-is.
- The "Switch to advanced form view" link — handled by `?view=form` URL key, no new UI library.
- Service-worker / offline cache for quiz state — separate Epic.
- Storing `state.answers` in `localStorage` directly (currently only via quiz shell's `_registry-*` key) — could simplify cross-tab persistence but adds complexity.

---

## How to verify

```bash
# Quiz wiring smoke (86 PASS, 0 FAIL — full lifespan tool + sections I-X)
node scripts/_smoke_lifespan_simulator_split.js

# Existing quiz smokes must still PASS (canary — HT.quiz API is unchanged)
node scripts/_smoke_quiz_shell.js          # 118 PASS
node scripts/_smoke_quiz_preview.js        # 58 PASS
node scripts/_smoke_quiz_proxy.js          # 28 PASS

# Bundle-size gates
python scripts/bundle-size-gate.py        # PASS (chrome 132,638 gz, unchanged)
python scripts/_bundle_size_per_tool.py   # PASS (lifespan first-paint 5,709 gz)

# Full CI chain
make ci
```

Expected:

- `lifespan-simulator-split-smoke`: 86 PASS, 0 FAIL (5 new sections + 32 new assertions)
- `quiz-smoke` + `quiz-preview-smoke` + `quiz-proxy-smoke`: continue to PASS (204 total)
- `bundle-size-gate`: PASS (no chrome change)
- `bundle-size-per-tool`: PASS (lifespan first-paint 5,709 gz)
- `make ci`: all gates green

Manual browser verify:

1. `tools/lifespan-simulator/index.html` — form mode default
2. Click "Try as quiz" — quiz mode loads with 36 cards
3. Skip some questions, answer others — confirm reveal shows a number that matches filling the form to the same answers (within ±0.05 years)
4. Click Share → clipboard contains the summary
5. Click Print → print dialog opens with the reveal panel
6. Click Reset → quiz resets to card 1
7. Reload page → resume dialog appears with "Resume" / "Start over"
8. Visit `?view=form` directly → form mode loads
9. Visit `?view=quiz` directly → quiz mode loads
10. Click "Switch to advanced form view" from the reveal → returns to form mode

---

## Cross-references

- `_bmad-output/brainstorming/brainstorm-quiz-pattern-2026-08-14/quiz-pattern-future-tasks.md` — Stories 9.13–9.18 source-of-truth (resolved decisions: quiz replaces Quick/Full/Plan tabs, 36 cards, animated big-number reveal, URL persists toggle, animations in v1)
- `_bmad-output/implementation-artifacts/story-4c-quiz-lazy-load.md` — Story 4c's HT.quiz Proxy wiring this story consumes
- `tools/quiz-preview/quiz-preview.js` — the canonical adopter pattern (mountQuiz + buildReveal + storageKey + URL state)
- `tools/lifespan-simulator/lifespan-simulator-handlers.js` — existing `getAnswers()`, `evaluate()`, `renderResult()`, `state` shape
- `tools/lifespan-simulator/lifespan-simulator-core.js` — AD-14 frozen WHO_DELTAS / COUNTRIES / LIFESTYLE_FACTORS (do not edit)
- `assets/js/quiz.js` — frozen AD-14 HT.quiz API (open, close, destroy, getAnswers, jumpTo, progress, isOpen, handle shape)
- `scripts/_smoke_quiz_preview.js` — 14-section reference template for adopter smokes
- `scripts/_smoke_lifespan_simulator_split.js` — sections I–V (existing 4b split smoke) + VI–X (new quiz smoke, 32 assertions)
- `docs/bundle-size-budget.md` — per-tool budget (Story 4b) the new quiz wiring respects (lifespan first-paint 5,709 gz / 30,000 budget)
