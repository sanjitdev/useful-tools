---
title: "Quiz-Style Card Pattern — Brainstorm Intent"
created: "2026-08-14"
project: "useful-tools"
mode: "autonomous"
status: "proposed"
companion_artifact: "_bmad-output/brainstorming/brainstorm-quiz-pattern-2026-08-14/quiz-pattern-future-tasks.md"
---

# Quiz-Style Card Pattern — Brainstorm Intent

## What we brainstormed
A new **"Quiz Card" UX pattern** — one question per beautiful card, animated transitions, answer-to-next, progress bar, and a final reveal screen. The user sees **a single card at a time** instead of a wall of inputs, can **Skip** any question, and gets a result derived from whatever subset of questions they answered (the unanswered ones stay neutral).

Goal: turn the current "wall of inputs → result" experience into something **playful, gamified, and shareable**, while preserving **deterministic, reproducible results** and **the existing scoring models** (no math changes, no new heuristics).

## Why
- Current form-heavy tools (lifespan-simulator, calorie-estimator, bd-tax, pros-cons, etc.) are technically correct but feel like a tax return. A card-quiz makes them approachable, especially on mobile.
- "Skip → result with neutral defaults" is **the** UX win: users who only know 6 of 22 lifestyle factors should still see their estimate, not get stuck.
- A shared pattern (rather than 44 one-off redesigns) is cheaper to ship, easier to gate, and matches the shell's design system.
- Fits the Fun Pack's "playful + shareable + deterministic" framing without breaking the Pack taxonomy — the pattern is applied to **existing** tools, not new ones.

## Constraints baked in
- **AD-1 (no third-party libs).** All animations are pure CSS keyframes + `transform`/`opacity` transitions. No GSAP, no anime.js.
- **AD-12 (ES2018 vanilla, no SSR, no build step).** All card logic in plain `<script>`.
- **AD-14 (Shell Public API).** Card primitives ship in `assets/shell/` and expose as `HT.quiz` (e.g. `HT.quiz.open(opts)`, `HT.quiz.close()`, `HT.quiz.progress()`). Tools never hand-roll the card lifecycle.
- **Accessibility (WCAG 2.1 AA).** Every card has an `aria-live="polite"` region, focus is trapped inside an active card, `Esc` and the browser back-button both pop a card, and `prefers-reduced-motion` disables the slide/sparkle effects (already enforced in `base.css`).
- **Determinism.** Replaying the same answers (or skips) yields the same result. No `Math.random` for layout, animation delays, or "shuffle question order" — those would break reproducibility across sessions and embeds.
- **No PII added.** Quiz state can be persisted in URL state (b64 of the answer map), matching the existing `tools.json` `urlState` convention. `history-keys` only when the existing tool already had them.
- **No result-model changes.** The `evaluate()` / `compute*()` functions in each tool are **untouched** — the quiz pattern only changes the **input UX**, never the math.
- **No new shell chrome.** Cards render inside `<main>` like any tool panel — the header / footer / settings overlay is unchanged.
- **Backwards compatible.** Every tool keeps the original "form view" behind a `View as form` toggle. Power users, embed mode, and smoke harnesses all keep working.

## The pattern (what ships)

### Visual structure (per question)
```
┌───────────────────────────────────────────────┐
│  Question 3 of 12         ▓▓▓░░░░░░░  25%     │
│                                               │
│  🏷  Lifestyle                                 │
│                                               │
│  How many servings of fruit and vegetables    │
│  do you eat on a typical day?                 │
│                                               │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ Rarely  │ │ 1–2     │ │ 3–4  ✓  │          │
│  └─────────┘ └─────────┘ └─────────┘          │
│  ┌─────────┐                                   │
│  │ 5+      │                                   │
│  └─────────┘                                   │
│                                               │
│           [ Skip ]            [ Next → ]      │
└───────────────────────────────────────────────┘
```

### Behavioral spec
| Action | Behavior |
|---|---|
| Pick option | Stored to `answers[id]`, card flips to next (300 ms slide-fade) |
| **Skip** | `answers[id]` is **never written**; treated as neutral by downstream math |
| **Next →** | Same as pick if an option is selected; otherwise same as Skip |
| Browser back / `Esc` | Pop one card (preserves answered state) |
| Last question → Next | Triggers **Reveal** screen |
| Click progress bar | Jumps to that question (answered/unanswered both work) |
| Reduced motion | Slide-fade replaced with instant swap; sparkles disabled |

### Reveal screen
- Big animated number (e.g. lifespan years, calorie target, tax owed, pro/con score).
- "What changed it" — top 3 contributors from the existing model.
- "Edit your answers" — re-enters the quiz at the first answered question.
- "View as form" — flips to the existing wall-of-inputs view (legacy mode).
- Share + Print + Reset buttons (already in the shell).

### Animation budget
| Effect | CSS technique | Duration | Reduced-motion fallback |
|---|---|---|---|
| Card enter | `transform: translateX(40px)` → `0` + fade | 280 ms ease-out | instant swap |
| Card exit | `opacity 1 → 0` + `translateX 0 → -40px` | 220 ms ease-in | instant |
| Option pick | `scale(1) → 1.04 → 1` + ring color shift | 180 ms | instant |
| Progress bar fill | `width %` transition | 250 ms ease-out | instant |
| Reveal number | `transform: scale(0.85) → 1` + fade | 400 ms | instant |
| Confetti (optional, opt-in via toggle) | CSS `@keyframes` particle drift | 1200 ms | off |

All durations stay under 400 ms — short enough to feel snappy, long enough to read. No animation ever blocks input.

## Which tools get it (triage)

I sorted every tool by **(a) form heaviness**, **(b) does the existing `evaluate()` tolerate neutral defaults**, and **(c) would a card UI actually feel better**.

### Tier 1 — Excellent fit (recommend implementing first)
| Tool | Why it fits | Skipped-default math |
|---|---|---|
| `lifespan-simulator` | 23 inputs / 38 selects, the user's exact example; the `evaluate()` already treats `NaN`/missing enums as neutral (lines 296–456 of `lifespan-simulator.js`) | Missing enum → 0 delta; missing numeric → 0 delta. **Zero math change needed.** |
| `calorie-estimator` | Mifflin-St Jeor needs age/sex/height/weight/activity. 5 questions, deterministic, result is a single number — perfect card reveal. | Unanswered → use defaults (30 yr male, 70 kg, 170 cm, sedentary). Reuses the existing "default fill" pattern. |
| `bmi-calculator` | 3–4 inputs → one number. Trivial card, but big "wow" reveal animation on the BMI value. | Unanswered → show "fill at least height + weight". |

### Tier 2 — Good fit (recommend second wave)
| Tool | Why it fits |
|---|---|
| `pros-cons` | 3 questions (your question, then pro/con adds). Already has a "running score" — the card reveal is the score with the highest item animated in. |
| `space-calculator` | "Which planet?" picker + weight/age/jump-height — 4–5 cards, beautiful "your weight on Mars = 26.5 kg" reveal. |
| `compass-tool` (if/when added) | Style/strategy preference quiz. |
| `bd-tax-calculator` | 20+ inputs but the **first 6** (category, area, age, basic salary, house rent, medical) drive 90% of the result. Card-ify those first, then offer "Add more detail" to unlock the rest. |

### Tier 3 — Skip
- Pure converters (unit-converter, base64, url-codec, timestamp) — no "question", just inputs.
- Generators (uuid, password, qr, lorem-ipsum) — no question to ask.
- State-preserving timers (stopwatch, pomodoro, countdown) — interactive, not form-based.
- Diff/json/jwt/regex tools — text-in / text-out, no quiz benefit.

## Architecture

### New module: `assets/shell/quiz/`
```
assets/shell/quiz/
  quiz.css        # .quiz-card, .quiz-progress, .quiz-reveal, animations
  quiz.js         # HT.quiz = { open, close, next, prev, skip, answer, ... }
  README.md       # Authoring guide for tool authors
```
Lives next to `chrome.html` / `palette` / `help-overlay` so the pre-commit hook that regenerates chrome pages also wires it in.

### Public API (`HT.quiz`)
```js
HT.quiz.open({
  mount: '#quiz-root',              // required — target element inside <main>
  questions: [                      // required — declarative question spec
    { id: 'smoking', label: 'Smoking', prompt: 'Do you currently smoke?',
      options: [
        { value: 'never',      label: 'Never' },
        { value: 'former',     label: 'Former' },
        { value: 'occasional', label: 'Occasional' },
        { value: 'daily',      label: 'Daily' }
      ] },
    { id: 'alcohol', label: 'Alcohol', prompt: 'How many drinks per week?',
      input: 'number', min: 0, max: 50 },
    // ...
  ],
  answers: existingAnswersObject,   // optional — pre-fill (from URL state, form view, etc.)
  onChange: function (answers) { /* persist + re-render */ },
  onComplete: function (answers) { /* run tool's evaluate(); show reveal */ },
  onSkip: function (id) { /* never written to answers */ },
  reveal: function (answers) { /* DOM node to show after last answer */ },
  animations: true                  // honor reduced-motion regardless
});
```

### Authoring cost per tool
For `lifespan-simulator`, the card-ification is:
1. Add `<div id="quiz-root"></div>` inside `<main>`.
2. Add a "Switch to quiz" toggle in the existing toolbar.
3. Replace the existing form-render path with a call to `HT.quiz.open({ questions: [...], reveal: renderReveal })`.
4. The existing `getAnswers()`, `evaluate()`, `renderResult()` are **untouched**.

Estimated diff: ~80 lines of JS + ~150 lines of CSS. No new files in `tools/`.

### Reduced-motion / a11y wiring
- `base.css` already exposes `@media (prefers-reduced-motion: reduce)` — the new `quiz.css` reuses that hook.
- `HT.quiz` reads `window.matchMedia('(prefers-reduced-motion: reduce)').matches` and the shell's `ht.reducedMotion` setting (already in `HT.settings`) — both disable animations.
- `aria-live="polite"` on the card root; focus moves to the new card's first interactive control; `Esc` pops one card.
- All animations are CSS-only (no `setInterval`/`requestAnimationFrame`), so they pause naturally when the tab is backgrounded.

## Risks
- **Big tools get noisy.** Lifespan has 22 questions — that's 22 cards. Mitigation: the **Skip** button, the **progress bar jump**, and an optional "Quick mode" preset (skip everything except the top-6 contributors).
- **URL-state bloat.** Storing 22 answer values in `?answers=...` makes the URL ugly. Mitigation: keep the existing `?tab=` / `?preset=` params and add `?qa=` (b64 of the answer map, lossy on unanswered).
- **Smoke harnesses.** Each tool has a `scripts/_smoke_<slug>.js` that drives the form via direct DOM events. Cards introduce a new interaction surface; smoke harnesses need a `quiz-next / quiz-skip / quiz-answer` helper. Cheap to add (~10 lines each).
- **Embedding.** Some tools support `?embed=1`. The quiz view works in embed mode (one card per viewport) — confirmed by inspecting `lifespan-simulator.js` lines 1602–1621.

## What we did NOT do
- We did not pick which Tier-1 tool ships first — that's your call.
- We did not design the option-card visuals in detail (color, icon, illustration) — that's the **Figma / design pass** step, not brainstorm.
- We did not modify `tools.json`, `tools.schema.json`, or any existing tool's `evaluate()`.
- We did not propose analytics or telemetry on the quiz.
- We did not invent a new shell module beyond `quiz/` (no new tabs in settings, no new topbar buttons).

## Recommended next steps (sequenced)
1. **Story 9.12 — Quiz Pattern (Shell).** Ship `assets/shell/quiz/` with full smoke coverage. Standalone test page at `/tools/_quiz-preview/`.
2. **Story 9.13 — Lifespan Simulator: Quiz Mode.** First tool to adopt the pattern. Validates the shell module on the hardest real-world case (22 questions, full vs quick tabs, embed mode, plan-tab interop).
3. **Story 9.14 — Calorie Estimator: Quiz Mode.** Validates the pattern on a simpler tool (5 questions, single number reveal). Faster ship, more public exposure.
4. **Story 9.15+ — Roll out to Tier 2** (pros-cons, space-calculator, bd-tax top-6) one per story, each gated by the smoke harness pattern.

## Artifacts produced
- `_bmad-output/brainstorming/brainstorm-quiz-pattern-2026-08-14/brainstorm-intent.md` — this file
- `_bmad-output/brainstorming/brainstorm-quiz-pattern-2026-08-14/quiz-pattern-future-tasks.md` — the proposed Story 9.12–9.15 task definitions
- (after user approval) `_bmad-output/implementation-artifacts/sprint-status.yaml` updated with Stories 9.12–9.15 in backlog
