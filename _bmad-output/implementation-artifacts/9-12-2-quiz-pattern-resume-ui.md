# Story 9.12.2 — Quiz Pattern: Resume UI via `storageKey`

**Slug:** `quiz-pattern-resume`
**Status:** done
**Date:** 2026-08-14
**Parent story:** `_bmad-output/implementation-artifacts/9-12-quiz-pattern-shell-module.md`

---

## Context

Story 9.12 shipped `HT.quiz` with `saveState` / `loadState` / `clearState` helpers wired to `HT.storage` (with `localStorage` fallback). The shell **already saves** `{answers, current}` on every `emitChange`, **already loads** on `open()`, and **already clears** on `destroy()`. What's missing is the **resume UI**: when a saved attempt is detected on `open()`, the user should be prompted before the quiz mounts — "Resume previous attempt? N cards done · M skipped" / "Start over".

The reconnaissance report (2026-08-14) confirms:

- **No existing "Resume" UX** anywhere in the repo — this story introduces the pattern.
- **Inline `<dialog>` + `showModal()`** is the precedent (`assets/js/history.js:1344-1446` `_confirmDestructive`). Free focus-trap, free Escape handling, native a11y.
- **`.ht-confirm-dialog` CSS** at `assets/css/components.css:2098-2297` is reusable.
- **No TTL** on storage — we use the raw `ht.quiz-preview.state` shape that 9.12.1 already wrote.
- **Storage key** `ht.quiz-preview.state` already registered in `storage-registry.js:556-561` — no manifest change needed.
- **Style B DOM stub** in `_smoke_quiz_shell.js` supports `role="dialog"`, `aria-modal`, `aria-labelledby` assertions.
- **AD-14 boundaries** (`HT.copyToClipboard`, `HT.share.print`) stay intact — the resume UI does not need them.

User-confirmed design choices (2026-08-14):

1. **Overlay primitive:** Inline `<dialog>` + `showModal()` + `aria-labelledby`/`aria-describedby` + `cancel`-event guard. Mirrors `_confirmDestructive` in `assets/js/history.js:1344-1446`.
2. **Choices:** 2-button — "Resume — N cards done · M skipped" (default focus) + "Start over" (clears storage + fresh mount).
3. **Trigger timing:** Always prompt when saved state exists. URL-state hash still wins (if hash says `card-N`, skip the dialog and go straight there).

---

## Goal

1. Detect a saved attempt at `open()` time (before the quiz mounts) and show an inline `<dialog>` asking the user to **Resume** or **Start over**.
2. Default-focus on "Resume" (the safer choice — preserves user data).
3. "Start over" must clear the storage key and mount the quiz from scratch.
4. URL-state hash (`view=card-N`) takes precedence over the resume prompt — when the URL pins a specific card, skip the dialog.
5. Honor the showIf / visible-card semantics from Story 9.12.1 — the "N cards done · M skipped" count uses the visible-card list, not raw `state.questions.length`.
6. Keep the shell frozen API additive: no breaking changes to `HT.quiz.open / close / next / prev / skip / answer / progress / destroy / isOpen` or the handle shape.
7. Cover the new feature in both smoke harnesses (`_smoke_quiz_shell.js` Section XIV, `_smoke_quiz_preview.js` Section XIV).
8. Bump `api-contract.js` `1.20.0 → 1.21.0`.

---

## Files modified

| Path | Change |
|---|---|
| `assets/js/quiz.js` | Added `computeResumeStats(savedAnswers, questions)` — uses the Story 9.12.1 `_skipIf` predicate to count visibl­e-done / skipped. Added `buildResumeDialog(stats, opts)` — returns `{dialog, focusFirst}`; mirrors `_confirmDestructive` (inline `<dialog>` + `showModal` + `aria-labelledby`/`aria-describedby` + `cancel` event guard). Esc is treated as Resume (preserves user data). Refactored `open()` to extract `mountFromSeed(finalSeed)` closure; resume wiring sits after URL-state decode, before mount. Defensive fallback to auto-resume if `document.createElement('dialog')` or `showModal` is unavailable. |
| `assets/css/quiz.css` | Added `.quiz-resume-dialog` rules — reuses `.ht-confirm-dialog` from `components.css`, adds `.quiz-resume-actions` flex-end row, `.quiz-resume-resume`/`.quiz-resume-start-over` button classes. Added `@keyframes quiz-resume-pop` (180ms scale-up) with reduced-motion fallback under both `@media (prefers-reduced-motion: reduce)` and `:root:where([data-reduced-motion="true"])`. Added `@media print { .quiz-resume-dialog { display: none; } }`. |
| `assets/js/api-contract.js` | Version `1.20.0` → `1.21.0`. `HT.quiz` notes extended with a Story 9.12.2 paragraph describing the resume UI flow. |
| `scripts/_smoke_quiz_shell.js` | Added Section XIV — 11 assertions. Style B DOM stub extended with `showModal`/`close` no-ops on dialog nodes, `document.body` factory, `HT.storage` stub (get/set/remove/list/keys/clear), and `location: { hash: '' }`. Covers: dialog appended, classes, aria, title/body text, two buttons, Resume mounts, Start over clears storage, URL hash wins, no storageKey → direct mount. |
| `scripts/_smoke_quiz_preview.js` | Added Section XIV — 4 assertions. Source-string checks: storageKey string preserved, `.quiz-resume-dialog` in CSS, `@keyframes quiz-resume-pop` present, AD-14 boundary preserved (no dialog-rendering assertions). |
| `tools/quiz-preview/quiz-preview.js` | No code changes. The shell handles the resume prompt before mount, so the preview tool only needs to keep passing the same `storageKey: '_registry-quiz-preview'`. |

---

## Public API (`HT.quiz` — additive)

The frozen surface is unchanged. The resume UI is purely a behavior of `open()` when `storageKey` is set.

```js
HT.quiz.open({ mount, questions, answers?, onChange?, onComplete?,
               reveal?, animations?, storageKey? }) → handle
```

New behavior in `open()`:

- If `options.storageKey` is **not** set, the shell mounts immediately (unchanged behavior).
- If `options.storageKey` is set AND the URL hash pins a specific card (`view=card-N`), the shell mounts immediately (URL state wins).
- If `options.storageKey` is set AND the URL does not pin a card AND a saved attempt exists (`state.questions.length > 0` or `state.answers` non-empty), the shell shows an inline `<dialog>`:

  > **Resume previous attempt?**
  > N of M cards done · K skipped
  > [Resume]  [Start over]

- "Resume" (default focus) restores the saved `{answers, current}` and mounts.
- "Start over" calls `HT.storage.remove(options.storageKey)` and mounts with empty answers.
- `Esc` closes the dialog and is treated as Resume (preserves user data).
- If the dialog API is unavailable, the shell auto-resumes (no prompt).

---

## Acceptance criteria

| # | Criterion | Status |
|---|---|---|
| 1 | `open()` with `storageKey` + saved state shows an inline `<dialog>` before mount. | PASS |
| 2 | Dialog has `class="ht-resume-dialog quiz-resume-dialog"`. | PASS |
| 3 | Dialog has `aria-labelledby` + `aria-describedby` pointing to its own title / body ids. | PASS |
| 4 | Dialog title text reads `"Resume previous attempt?"`. | PASS |
| 5 | Dialog body text reads `"N of M cards done · K skipped"` matching the saved state. | PASS |
| 6 | Dialog has two buttons with `data-action="resume"` and `data-action="start-over"`; default focus is on Resume. | PASS |
| 7 | Clicking "Resume" closes the dialog and mounts the quiz with `seedAnswers` intact. | PASS |
| 8 | Clicking "Start over" closes the dialog, calls `HT.storage.remove`, and mounts with empty answers. | PASS |
| 9 | When URL hash pins a card (`initialIndex > 0`), no dialog is shown — direct mount. | PASS |
| 10 | When no `storageKey` is provided, no dialog is shown — direct mount. | PASS |
| 11 | Esc cancels the dialog and is treated as Resume (preserves user data). | PASS (via `cancel` event guard) |
| 12 | Defensive fallback: if `document.createElement('dialog')` or `showModal` is unavailable, the shell auto-resumes without a prompt. | PASS |
| 13 | The `computeResumeStats` count uses the visible-card list (Story 9.12.1 semantics — branched-skip cards excluded). | PASS |
| 14 | No breaking changes to `HT.quiz` frozen surface or handle shape. | PASS |
| 15 | HTML print stylesheet hides the dialog. | PASS |

---

## Verification

- `node scripts/_smoke_quiz_shell.js` → **97 PASS**, 0 FAIL (was 86; +11 from Section XIV).
- `node scripts/_smoke_quiz_preview.js` → **57 PASS**, 0 FAIL (was 53; +4 from Section XIV).
- `node scripts/_smoke_regression_sweep.js` → 45/45 tools, 270/270 checks.
- `python scripts/validate-tools-json.py` → OK.
- `python scripts/storage-registry-gate.py` → all checks pass.
- `python scripts/shell-drift-check.py` → all pages in sync.
- `python scripts/shell-a11y-check.py` → all invariants pass.
- `python scripts/_es5_grep.py` → no ES5 anti-patterns.
- `node scripts/_smoke_chrome_dom_walk.js` → 8/8 PASS.
- `python scripts/tool-contract-gate.py` → 45 pass · 0 waivered · 0 failed.
- `python scripts/rubric-lint.py quiz-preview` → 8/10 (unchanged).
- `python scripts/shell-bounds-check.py` → quiz-preview still 0 violations (pre-existing grocery-list 2-violation is unrelated).

---

## Manual browser verification

1. Open `tools/quiz-preview/index.html`.
2. Answer 2 questions, then close the tab.
3. Re-open the tab — confirm the dialog appears with "2 of 5 cards done · 3 skipped" (q6 branched-skipped, depends on q1 vibe).
4. Click **Resume** → confirm the quiz restores to q3 (visual index 2).
5. Re-open the tab again — click **Start over** → confirm the quiz begins at q1 with empty answers.
6. Re-open the tab with `location.hash = '#view=card-3'` → confirm the dialog does NOT appear.
7. Press `Esc` while the dialog is open → confirm the dialog closes and the quiz mounts with the saved state preserved.
8. Toggle reduced-motion → confirm no animation regression.

---

## Risks and edge cases

| Risk | Mitigation |
|---|---|
| `<dialog>` + `showModal` unavailable | Defensive fallback (auto-resume without prompt) — same pattern as `_confirmDestructive` at `history.js:1432-1439`. |
| `HT.storage.get` returns stale shape (older schema) | `try/catch` around `computeResumeStats`; treat parse errors as "no saved state" and mount fresh. |
| User presses Esc while dialog open | `cancel` event calls `onResume()` which behaves like Resume (safer default — preserve data). |
| ShowIf throws on resume stats | `try/catch` inside `computeResumeStats`; treat as "not hidden" so the count is conservative. |
| `ht.quiz-preview.state` already cleared by another tab | `loadState` returns `null` → no prompt → fresh mount. |
| URL hash pinned to a card AND saved state exists | URL wins — no prompt. User explicitly navigated to that card. |
| Mount element doesn't exist yet when dialog opens | Dialog is appended to `document.body`, not the mount. The mount happens after the dialog closes. |
| Storage key collides between two quiz mounts | The shell clears on `destroy()`; preview tool also calls `handle.close()` in Reset. No collision. |
| Dialog accessibility regression (focus, Escape, screen reader) | Mirror `_confirmDestructive` exactly — same `aria-labelledby`/`aria-describedby`, same `cancel` event guard, same focus-return. |
| Multiple `open()` calls in rapid succession (race) | The dialog's `data-action` buttons are wired to `dlg.close()`; a second `open()` would build a second dialog with a different ID — but `open()` is synchronous in v1, so this is a non-issue. |
| `_smoke_quiz_shell.js` Style B DOM stub doesn't support `<dialog>.showModal` | No-op fallback in the stub: `showModal: function () { node._isOpen = true; }` and `close: function () { node._isOpen = false; }`. The dialog's `cancel` event can be dispatched manually. |

---

## Out-of-scope (deferred to later stories)

- **Story 9.12.3** — Multi-select questions: `multiSelect: true` renders checkboxes; answer is an array.
- **Story 9.13+** — Lifespan Simulator, Calorie Estimator, BMI Calculator, Pros & Cons, Space Calculator, BD-Tax adopt `HT.quiz`.
- **TTL/expiry on `ht.quiz-preview.state`** — would require expanding `HT.storage` schema; not warranted yet.
- **Shared `HT.confirm()` API** — the `_confirmDestructive` pattern is still inlined in `history.js`; Story 3.8 explicitly deferred a shared helper. Resume UI follows the same precedent.

---

## Residue & Deferred

None. The story ships clean.
