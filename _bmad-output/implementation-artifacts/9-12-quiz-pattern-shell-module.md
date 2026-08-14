# Story 9.12 — Quiz Pattern (Shell module)

**Slug:** `quiz-pattern`
**Status:** done
**Date:** 2026-08-14
**Brainstorm:** `_bmad-output/brainstorming/brainstorm-quiz-pattern-2026-08-14/`

---

## Context

Several form-heavy tools (lifespan-simulator, calorie-estimator, bd-tax-calculator, pros-cons) ask the user to fill out a wall of inputs up front. A brainstorm on 2026-08-14 explored replacing that experience with a **quiz-card UX**: one question per card, animated transitions, Skip, progress bar, reveal screen. The first deliverable is the shell module that every future tool will mount; the canary is a dedicated `_quiz-preview` tool that exercises the full lifecycle.

## Goal

Ship `HT.quiz` as a stable shell module + a working preview tool that any future quiz-mode tool can mount.

## Files added

| Path | Purpose |
|---|---|
| `assets/js/quiz.js` | Shell module — `HT.quiz.open()` returns a handle with `close / destroy / getAnswers / jumpTo / progress / isOpen`. |
| `assets/css/quiz.css` | Card / progress / reveal styles + 4 keyframes + reduced-motion fallbacks + print rules. |
| `assets/icons/quiz-preview.svg` | Tool icon. |
| `tools/quiz-preview/index.html` | Preview tool page (full shell chrome + mount + reveal region + share/print/reset). |
| `tools/quiz-preview/quiz-preview.js` | Mounts `HT.quiz.open()` with 5 demo cards; wires Share/Print/Reset via Shell Public API (`HT.copyToClipboard` / `HT.share.print`); restores URL state via `HT.urlState`. |
| `tools/quiz-preview/_quiz-preview.css` | Tool-specific layout. |
| `scripts/_smoke_quiz_shell.js` | Shell smoke — Style B DOM stub, 12 sections, 76 PASS. |
| `scripts/_smoke_quiz_preview.js` | Preview tool smoke — Style A DOM stub, 12 sections, 49 PASS. |

## Files modified

| Path | Change |
|---|---|
| `assets/js/api-contract.js` | Version `1.18.0` → `1.19.0`; appended frozen `HT.quiz` entry (stable). |
| `assets/js/storage-registry.js` | Registered `ht.quiz-preview.state` (object, persistent, owned by `quiz-preview.js`). |
| `assets/shell/chrome.html` | Storage manifest gained the new entry (hand-maintained mirror). |
| `index.html` | Added `<link rel="stylesheet" href="assets/css/quiz.css">` and `<script src="assets/js/quiz.js" defer></script>`. |
| `tools.json` | New `quiz-preview` entry (slug, score 8, ready, pack [developer], `urlState` keys). |
| `Makefile` | `.PHONY` gained `quiz-smoke` + `quiz-preview-smoke`; targets added; `ci:` chain updated. |
| `.github/workflows/tool-contract-gate.yml` | Two new `run:` steps. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Story 9.12 entry set to `in-progress`. |

## Public API (`HT.quiz`)

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

`questions[i]` = `{ id, label, prompt, options? | input?, min?, max?, step?, helpText? }`.

Skip advances without writing to the answer map. Next advances; if no option is picked, behaves like Skip. URL state round-trips via `HT.urlState.encode/decode('quiz-preview', ...)`. Reduced-motion respected under both `@media (prefers-reduced-motion: reduce)` and `:root:where([data-reduced-motion="true"])`.

## Verification

- `node scripts/_smoke_quiz_shell.js` → 76 PASS, 0 FAIL.
- `node scripts/_smoke_quiz_preview.js` → 48 PASS, 0 FAIL.
- `make quiz-smoke` and `make quiz-preview-smoke` green.
- `assets/js/api-contract.js` registered `HT.quiz` (stable) at version `1.19.0`.

## Out-of-scope (deferred)

- **Story 9.12.1** — Branching / conditional skip (`Question.showIf`) — done, see `_bmad-output/implementation-artifacts/9-12-1-quiz-pattern-branching-conditional-skip.md`.
- **Story 9.12.2** — Resume UI via `storageKey`: "Resume previous attempt? N cards done · M skipped" overlay.
- **Story 9.12.3** — Multi-select questions: `multiSelect: true` renders checkboxes; answer is an array.
- **Story 9.13+** — Lifespan Simulator, Calorie Estimator, BMI Calculator, Pros & Cons, Space Calculator, BD-Tax all adopt `HT.quiz`.

---

*Story doc — frontmatter + 7 sections, ~50 lines.*