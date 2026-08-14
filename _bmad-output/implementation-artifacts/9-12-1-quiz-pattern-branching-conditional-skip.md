# Story 9.12.1 — Quiz Pattern: Branching / Conditional Skip

**Slug:** `quiz-pattern-branching`
**Status:** done
**Date:** 2026-08-14
**Parent story:** `_bmad-output/implementation-artifacts/9-12-quiz-pattern-shell-module.md`

---

## Context

Story 9.12 shipped `HT.quiz` as a frozen one-question-per-card shell module. Three follow-ups were deferred:

> Multi-select questions, branching, conditional skip — wait for v2 tool feedback.
> `localStorage` resume via `storageKey` — wired in API but resume UI is future work.

This story lands the **branching / conditional skip** follow-up. The goal: let each question declare whether it should appear, evaluated against the current `answers` map. Branched-skip cards are silently dropped from `state.answers`; the visible-card list is recomputed on every `emitChange`. Navigation (`next`, `skip`, `prev`, `jumpTo`) auto-advances past hidden siblings.

User-confirmed design choices (2026-08-14):

1. **Surface:** Both shapes accepted on each `Question` — `showIf?: (answers) => boolean` (predicate-only) or `showIf?: { skipIf?: (answers) => boolean }` (object form for forward-compat).
2. **State:** Silent skip — branched-skip cards are **not** written to `state.answers`. The reveal panel shows them as the existing `— skipped` marker.
3. **Re-evaluation:** On every `emitChange`, recompute the visible-card list. If a previously-visible card becomes hidden, the user auto-advances past it.
4. **Animation:** Reuse the existing `quiz-card-enter` keyframe (`assets/css/quiz.css`). No new CSS rules.

---

## Goal

Ship `Question.showIf` as a stable additive change to the `HT.quiz` question spec, fully backwards-compatible (every existing tool / fixture without `showIf` continues to work unchanged).

---

## Files modified

| Path | Change |
|---|---|
| `assets/js/quiz.js` | Added `isHidden` / `visibleQuestions` / `visibleIndexOf` / `reevaluateAndAdvanceIfHidden` helpers. `showIf` validation + per-iteration IIFE closure. `state.current` now means the **logical** index (never branched-skipped); `_visualIndex` derived per render. `buildHeader` / `renderStack` / `advance` / `rewind` / `jumpTo` / footer-click / `next` / `skip` / `answer` / `onDocKeydown` / `computeProgress` all updated to honor the visible list. |
| `assets/js/api-contract.js` | Version `1.19.0` → `1.20.0`; `HT.quiz` entry notes extended; `showIf?` added to the `questions` element signature. |
| `tools/quiz-preview/quiz-preview.js` | Added a 6th demo card `q6-coffee-strength` with `showIf: (a) => a['q1-vibe'] !== 'calm'` so users who pick "Coffee + silence" skip the coffee-strength follow-up. |
| `scripts/_smoke_quiz_shell.js` | Added Section XIII — 10 assertions covering function / object shape, validation throw, total math, snap-over-hidden, URL hydration, `jumpTo`, reveal-callback visibility, no-showIf backwards compat. |
| `scripts/_smoke_quiz_preview.js` | Added Section XIII — 4 assertions covering showIf declaration, id reference, reveal panel still present, AD-14 boundary preserved. |

---

## Public API (`HT.quiz` — additive)

```js
HT.quiz.open({ mount, questions, answers?, onChange?, onComplete?,
               reveal?, animations?, storageKey? }) → handle
HT.quiz.close(handle?)
HT.quiz.next(handle)
HT.quiz.prev(handle)
HT.quiz.skip(handle)
HT.quiz.answer(handle, value)
HT.quiz.progress(handle) → { current, total, answered }
HT.quiz.destroy(handle)
HT.quiz.isOpen(handle?) → boolean

handle = { close, destroy, getAnswers, jumpTo, progress, isOpen }
```

`questions[i]` = `{ id, label, prompt, options? | input?, min?, max?, step?, helpText?,
                   showIf?: ((answers) => boolean) | { skipIf?: (answers) => boolean } }`.

- `showIf` accepts a function (returns `true` = visible) OR an object `{ skipIf }`.
- Missing `showIf` → visible (unchanged behavior).
- A `showIf` predicate that throws at runtime is treated as "visible" so a broken predicate never blocks the user.
- `progress().total` reflects the **visible-card count**, not the logical question count.
- `progress().current` reflects the **visual position** mid-quiz; past-last on reveal (preserves Story 9.12 semantics).

---

## Verification

- `node scripts/_smoke_quiz_shell.js` → **86 PASS**, 0 FAIL (was 76; +10 from Section XIII).
- `node scripts/_smoke_quiz_preview.js` → **53 PASS**, 0 FAIL (was 49; +4 from Section XIII).
- `node scripts/_smoke_regression_sweep.js` → 45/45 tools, 270/270 checks.
- `python scripts/validate-tools-json.py` → OK.
- `python scripts/storage-registry-gate.py` → all checks pass.
- `python scripts/shell-drift-check.py` → all pages in sync.
- `python scripts/shell-a11y-check.py` → all invariants pass.
- `python scripts/_es5_grep.py` → no ES5 anti-patterns.
- `node scripts/_smoke_chrome_dom_walk.js` → 8/8 PASS.
- `python scripts/tool-contract-gate.py` → 45 pass · 0 waivered · 0 failed.
- `python scripts/rubric-lint.py quiz-preview` → 8/10 PASS (unchanged).

Manual browser verification (deferred to live QA):
1. Open `tools/quiz-preview/index.html`.
2. On Q1 pick **"Coffee + silence"** → confirm Q6 is **not shown**.
3. On Q1 pick **"Coffee + email"** → confirm Q6 **is** shown.
4. Toggle reduced-motion → confirm no animation regression.

---

## Out-of-scope (deferred to later stories)

- **Story 9.12.2** — Resume UI via `storageKey`: "Resume previous attempt? N cards done · M skipped" overlay.
- **Story 9.12.3** — Multi-select questions: `multiSelect: true` renders checkboxes; answer is an array.
- **Story 9.13+** — Lifespan Simulator, Calorie Estimator, BMI Calculator, Pros & Cons, Space Calculator, BD-Tax adopt `HT.quiz` (branching will be useful for lifespan's "Are you pregnant?" → "Trimester week?" chain).
- Tool-specific reveal animations (the shell provides the card-enter; tools style inside).

---

*Story doc — frontmatter + 5 sections.*
