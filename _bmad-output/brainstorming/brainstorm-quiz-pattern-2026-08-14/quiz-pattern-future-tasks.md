# Quiz Pattern — Proposed Future Tasks

Sibling to `brainstorm-intent.md`. Each task here is a **single** Story. Triage by your call; the proposed order is the recommended ship order.

---

## Story 9.12 — Quiz Pattern (Shell module)

**Slug:** N/A (shell module, not a tool)
**Files added:**
- `assets/shell/quiz/quiz.css` — card, progress, reveal, animations, reduced-motion fallback
- `assets/shell/quiz/quiz.js` — `HT.quiz` API (open / close / next / prev / skip / answer / progress / onComplete)
- `assets/shell/quiz/README.md` — authoring guide (one page, code-example heavy)
- `tools/_quiz-preview/index.html` + `_quiz-preview.js` + `_quiz-preview.css` — standalone preview page (used as the smoke harness mount)

**Files modified:**
- `assets/shell/chrome.html` — add `<script defer src=".../quiz.js"></script>` and `<link rel="stylesheet" href=".../quiz.css">` if not inlined
- `assets/js/api-contract.js` — register `HT.quiz` in the API manifest, bump minor version
- `scripts/_smoke_quiz_shell.js` — new smoke harness (mount on preview page, drive 6 questions, verify progress, skip, complete, reduced-motion branch)

**AC:**
1. `HT.quiz.open({ mount, questions, onChange, onComplete, reveal })` renders the first card inside the mount node.
2. Keyboard: `Tab` focuses first option; `1–9` picks option N; `Esc` pops a card; `Enter` advances if an option is focused.
3. Reduced-motion: animations disabled; CSS swaps are instant.
4. URL state: `?qa=<b64>` round-trips the answer map (lossy on skipped).
5. A11y: each card is `role="region"` + `aria-live="polite"`; focus is trapped per-card; screen readers announce "Question 3 of 12".
6. Smoke harness covers: open, pick, skip, back, complete, reveal, reduced-motion, URL round-trip, destroy.

**Out of scope:** No tool integration. No new shell chrome. No animations > 400 ms.

**Estimated effort:** M (1–2 days).

---

## Story 9.13 — Lifespan Simulator: Quiz Mode

**Slug:** `lifespan-simulator` (existing tool)
**Files modified:**
- `tools/lifespan-simulator/lifespan-simulator.js` — add `HT.quiz.open({ questions: [...], answers: state.answers, onComplete: renderQuizResult, reveal: renderQuizReveal })`; add "Switch to quiz" toggle in the existing toolbar (replaces or augments the Quick/Full/Plan tabs? — **TBD**, see Open Question 1)
- `tools/lifespan-simulator/lifespan-simulator.css` — minor tweaks to fit the quiz card width on mobile
- `tools/lifespan-simulator/index.html` — add `<div id="ls-quiz-root" hidden></div>` inside `<main>` and the "Quiz mode" toggle button
- `tools.json` — add `quiz-mode: { enabled: true, default: 'form', storage: 'url' }` to the lifespan-simulator entry
- `scripts/_smoke_lifespan_simulator.js` — add a `quiz-*` helper that drives the quiz and verifies the result matches the form-mode result for the same answer set

**AC:**
1. Lifespan Simulator has a "Quiz mode" toggle (default: form view).
2. Quiz mode shows 22 cards (or 12 in "Quick mode" preset — **TBD**, Open Question 2).
3. Skipping a question → that question contributes 0 to the result, matching the existing `evaluate()` neutral-default behavior (lines 296–456 of `lifespan-simulator.js`).
4. Completing the quiz → reveal screen shows the same number as filling the form with the same answers, ±0.05 yr.
5. URL state: `?qa=<b64>` round-trips and the quiz re-enters at the first unanswered question.
6. Plan tab interop: the existing plan-tab targets still work (the quiz sets the underlying `answers` object; plan computes from it).
7. Smoke harness: form-mode and quiz-mode both pass the existing 12 categories + a new "quiz-mode" category.

**Out of scope:** No changes to `evaluate()`, `getAnswers()`, or any WHO deltas. No changes to Plan tab logic.

**Estimated effort:** M (2–3 days).

---

## Story 9.14 — Calorie Estimator: Quiz Mode

**Slug:** `calorie-estimator` (existing tool)
**Files modified:** same shape as 9.13, scoped to the 5 questions (sex, age, height, weight, activity).

**AC:**
1. Quiz mode shows 5 cards.
2. Reveal is the TDEE number with a small "your BMR is X" sub-line.
3. Imperial/metric toggle still works in form mode; quiz mode picks one and stays.
4. Smoke harness covers both unit systems.

**Estimated effort:** S (1 day) — much simpler than 9.13.

---

## Story 9.15 — BMI Calculator: Quiz Mode

**Slug:** `bmi-calculator`
**Files modified:** same shape.

**AC:**
1. Quiz mode = 2 cards (height, weight) + unit toggle in the first card.
2. Reveal: big animated BMI number + WHO category color band (underweight / normal / overweight / obese I–III).
3. Smoke harness.

**Estimated effort:** XS (½ day).

---

## Story 9.16 — Pros & Cons: Quiz Mode

**Slug:** `pros-cons`
**Files modified:** same shape, but the "questions" are: (1) your decision, (2) first pro, (3) first con, then dynamic "add another" cards.

**AC:**
1. Quiz mode guides the user through entering their decision + at least one pro and one con, then reveals the running score.
2. After the first pro/con, the quiz offers an "add another" card indefinitely.
3. Existing add-pro / add-con input rows still work in form mode.

**Estimated effort:** S.

---

## Story 9.17 — Space Calculator: Quiz Mode

**Slug:** `space-calculator`
**Files modified:** same shape; questions = (planet, weight OR age OR jump height).

**AC:**
1. Quiz mode asks "What do you want to find out?" first (weight / age / jump), then the relevant inputs.
2. Reveal animates through each selected planet.
3. Smoke harness.

**Estimated effort:** S.

---

## Story 9.18 — BD Tax Calculator: Top-6 Quiz Mode

**Slug:** `bd-tax-calculator`
**Files modified:** same shape; questions = the 6 highest-impact fields (category, area, age, basic salary, house rent, medical allowance).

**AC:**
1. Quiz mode = 6 cards; result is the same tax owed as filling the form with the same 6 answers + auto-defaults for the rest.
2. An "Add more detail" button on the reveal screen drops the user into form mode for the remaining fields.
3. Smoke harness covers both modes.

**Estimated effort:** M (largest tool in Tier 2; many fields).

---

## Decisions (resolved 2026-08-14)

1. **Quiz mode replaces the Quick/Full/Plan tabs on lifespan-simulator.** The form view becomes an "Advanced form view" link accessible from the reveal screen. Rationale: cleaner UI; the quiz is the default onboarding path.
2. **Lifespan-simulator's quiz shows all 22 cards** with a Skip button on every card. No Quick-mode preset for v1. Drop-off will be measured after ship.
3. **Reveal screen shows both** — the final number (big, animated) and the top-3 contributors (positive + negative) in a small "why" card below.
4. **Quiz-mode toggle persists in URL state** as `?view=quiz` / `?view=form`. Survives share + embed; no localStorage dep.
5. **v1 ships with reveal animations** — they're cheap CSS and the whole point of the pattern is "wow".

## Story 9.12 — Quiz Pattern (Shell module) — APPROVED TO START

(See brainstorm-intent.md "Recommended next steps".)
