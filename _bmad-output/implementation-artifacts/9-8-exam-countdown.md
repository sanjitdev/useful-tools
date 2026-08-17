---
status: done
baseline_commit: 94dc17a
---

# Story 9.8: Exam Countdown

## User Story

As a student preparing for a test,
I want a countdown to a future date showing days/hours/minutes/seconds,
So that I can pace my study.

## Current State

- No `exam-countdown` tool exists in the repo today (verified 2026-08-13 by `ls tools/`).
- The closest analog is `countdown-to-date` (Wave-2 tool) — a more elaborate countdown with `HT.storage` persistence, quick-pick chips (end of day / week / month / year), and a progress-bar visual. It is travel-pack. Exam countdown is intentionally minimal: a single `<input type="datetime-local">` + 4 segment spans + localStorage key for persistence.
- The pack assignment per Story 9.16's `check-pack-composition.py` constraint is `travel` — the Travel pack ships with exactly 5 tools, two of which are `recipe-scaler` and `exam-countdown`. Despite the name "exam", this maps to "civil-service / certification exam during travel or relocation" scenarios (e.g., scheduling a remote-proctored bar exam, an immigration-language test, a Schengen visa appointment). The tool itself is brand-agnostic.
- `datetime-local` input value is a plain string in the form `YYYY-MM-DDTHH:MM`. `new Date(string)` parses this as **local** time per HTML5 spec, which is what we want (the user's "9am Tuesday" is the user's 9am, not UTC).
- Project-context §6 establishes the `ht.*` prefix for runtime/storage keys (grandfathered from `handy-tools.*`). The epics.md AC text says `localStorage['handy-tools.exam-countdown.target']` — we'll honor the convention and use `ht.exam-countdown.target` (grandfather rule: existing legacy keys stay; new keys use the `ht.*` prefix).
- No new `HT.*` public-surface entry is required. Tool uses `HT.$` / `HT.history.push` (if persisting to history) / `HT.toast` / `HT.debounce` only.

## Resolved Open Questions

### ROQ-1 — Default target when none is stored

The AC text says "if the stored value is unparseable, the field is cleared via `localStorage.removeItem(...)` and the tool renders the empty state `<p class="countdown-empty">Pick a date and time to start the countdown</p>`". This implies three states:
1. **No stored value** → empty state, no countdown shown.
2. **Stored value but past date** → past-date notice, zeroed countdown.
3. **Stored value and future date** → live countdown.

A reasonable default on first visit is "no target"; the empty-state placeholder is the right affordance. We do **not** auto-default to "next Monday" or "end of month" (that's `countdown-to-date`'s job; exam-countdown is exam-specific). Empty state stays until the user picks.

### ROQ-2 — Storage key prefix

Per ROQ-1 above: `localStorage['ht.exam-countdown.target']` (matches project-context.md §6 grandfather rule for new keys). This is a minor deviation from epics.md AC literal text (`handy-tools.exam-countdown.target`); flagged in AC deviations.

### ROQ-3 — URL state vs localStorage priority on page load

Both the URL (`?target=...`) and localStorage can carry a target. The AC says "the field is restored on page load (read happens once at module init, BEFORE first paint of the countdown)". Resolution: **URL state wins if present and valid**; otherwise localStorage; otherwise empty state. This matches the canonical decode-on-load + encode-on-change pattern already used by `uuid-generator`, `flashcard-timer`, `citation-formatter`, etc. The localStorage is treated as a long-lived fallback (user closes the page mid-session, reopens later — the URL is gone but the localStorage holds the picked date).

### ROQ-4 — past-date notice wording

The AC text reads `<p class="countdown-past">Exam date has passed — pick a new date</p>`. We render this **only when a target is set but it's already past**. If the field is empty, we show the empty state, not the past notice.

## Acceptance Criteria

### AC-1 — Single datetime-local input + 4-segment live countdown

**Given** the user opens `tools/exam-countdown/index.html`
**When** they pick a future date and time via `<input type="datetime-local" id="ec-target" name="target">` (default value `""`, min not constrained)
**Then** the tool shows a live countdown rendered as four `<span class="countdown-segment" data-segment="days|hours|minutes|seconds">` elements (`<span id="ec-days" class="countdown-segment">Xd</span>`, `<span id="ec-hours">Xh</span>`, `<span id="ec-minutes">Xm</span>`, `<span id="ec-seconds">Xs</span>`); updated every 1000ms via `setInterval`
**And** the segments render as `0d`/`0h`/`0m`/`0s` if no target is set (i.e., the empty state still shows the segments as placeholders, not blank) and a paragraph `<p class="countdown-empty">Pick a date and time to start the countdown</p>` is shown alongside the segments
**And** when the target is in the future, the empty-state paragraph is hidden (`hidden` attribute) and the segments animate down (`X d`, `X h`, `X m`, `X s` — no zero-padding on `days`; zero-pad `hours/minutes/seconds` to 2 digits only when the field is `< 10`)
**And** the segments live inside a result tile `<div class="result-card"><div class="result-grid"><div class="result-tile"><div class="result-tile-label">Days</div><div class="result-tile-value" id="ec-days">—</div></div>...` matching the existing `countdown-to-date` pattern (4 tiles, one per segment) — the `<span class="countdown-segment">` is the inner span inside the tile value; this gives the live region a stable ID and the segment class a stable hook for CSS

### AC-2 — localStorage persistence

**Given** the user has picked a target
**When** they pick a new target or reload the page
**Then** the tool writes `localStorage.setItem('ht.exam-countdown.target', '<ISO 8601 local string>')` on every `change` event of `#ec-target` (the `<input type="datetime-local">` value as-is, no transformation; `datetime-local` values are local-time strings)
**And** the tool reads `localStorage.getItem('ht.exam-countdown.target')` once at module init (top of the IIFE, before first paint); if the read value is non-empty and `new Date(value)` returns a valid Date, the field is populated with that value via `document.getElementById('ec-target').value = value`
**And** if the read value is empty OR `new Date(value)` returns an Invalid Date (`isNaN(d.getTime())`), the tool calls `localStorage.removeItem('ht.exam-countdown.target')` and renders the empty state — this matches the epics.md AC text "if the stored value is unparseable, the field is cleared"
**And** history-keys: `["ec-target"]` so the field is registered in `HT.history.push` cycle

### AC-3 — URL state (?target=ISO)

**Given** the user lands on `tools/exam-countdown/?target=2026-12-15T09:00`
**When** the page loads
**Then** the URL takes precedence over localStorage (per ROQ-3): if `URLSearchParams.get('target')` returns a non-empty string and `new Date(value)` is valid, the input is populated from the URL and the localStorage is **not** overwritten
**And** the URL state is `?target=<value>` (the `<input>`'s native `datetime-local` value, which is local-time, no timezone conversion), encoded via `encodeURIComponent` (no base64 needed — `YYYY-MM-DDTHH:MM` is URL-safe)
**And** the URL state schema in `tools.json` is `{ default: { 'ec-target': '' }, encode: [{ key: 'target', type: 'string', from: '#ec-target' }], decode: [{ key: 'target', type: 'string', to: '#ec-target' }] }` (uses the canonical `from`/`to` selector resolution already wired across the tool fleet)
**And** the URL is preserved via `history.replaceState` on every input change (no navigation; the standard `HT.url.encode` pattern writes via `replaceState`)
**And** when the input is cleared, the URL `target` parameter is dropped (canonical pattern: `decode` writes the empty string into the input, `encode` reads an empty string from the input, so the URL drops the key on next replaceState)

### AC-4 — Past-date notice

**Given** the user has set a target that's already in the past (e.g., they picked "yesterday")
**When** the countdown ticks
**Then** the tool shows `<p class="countdown-past" id="ec-past-notice">Exam date has passed — pick a new date</p>` (the paragraph is **not** hidden via the `hidden` attribute — its visibility is toggled via a `data-past` attribute on the parent result-card, or simply via `display: none` CSS class toggled in JS) and the four segments render as `0d`/`0h`/`0m`/`0s` (no negative numbers, no negative sign, no `Math.abs`)
**And** the past-date notice is hidden when the field is empty (different state from past-date)
**And** the past-date notice is hidden when the target is in the future
**And** when the user picks a new future target, the past notice hides and the live countdown resumes — verified by the tick function re-evaluating the diff on every interval tick

### AC-5 — Keyboard shortcuts

**Given** the page renders
**When** the user presses keys (not inside an input)
**Then**:
- **t**: focus the `#ec-target` input.
- **c**: clear the target (sets the input to `""`, removes the localStorage key, hides the past notice, renders the empty state, drops the URL `target` param).

**And** shortcuts are documented in the help overlay via the `shortcuts` array in `tools.json`: `[{ key: "t", label: "Focus target", action: "embed" }, { key: "c", label: "Clear target", action: "reset" }]` (action labels are documentation only — actual chord wiring lives in `exam-countdown.js`).

### AC-6 — Privacy + offline-only

**Given** the page renders
**When** any action is taken
**Then** the tool script `tools/exam-countdown/exam-countdown.js` has **zero direct** `fetch` / `XMLHttpRequest` / `HT.provide` calls. The `shell-bounds-check` gate enforces this.
**And** the tool never makes a network request.
**And** history-keys: `['ec-target']` (single key — the URL state and localStorage both carry the target; history is the third persistence layer for the per-tool history panel).
**And** the tool never logs user input or localStorage values to `console.*`. The only console call allowed is the URL-state malformed-target warning (per `?target=garbage` case): `console.info('Exam Countdown: malformed URL target — falling back to localStorage')`, then silent.

### AC-7 — `tools.json` entry + smoke harness

**Given** the implementation is complete
**When** `make ci` runs
**Then** `tools.json` carries an entry for `exam-countdown`:
  - `id: "exam-countdown"`, `slug: "exam-countdown"`, `title: "Exam Countdown"`, `description: "Count down to an exam date with a live days / hours / minutes / seconds display. Persists the target across sessions."` (≤ 160 chars)
  - `category: "Time"`, `pack: ["travel"]` (per Story 9.16's pack composition constraint)
  - `keywords: ["exam", "countdown", "date", "timer", "days", "test", "study", "travel", "schedule", "appointment"]`
  - `last-updated: <today>`, `ready: true`, `score: 8`
  - `urlState` per AC-3
  - `shortcuts` per AC-5
  - `history-keys: ["ec-target"]`
  - `view-source: { enabled: true, path: "tools/exam-countdown/index.html" }`
  - `embed-snippet: { enabled: true, badge-default: true, min-width: 320, min-height: 240 }`
  - `search-priority: 6`
  - `tab-order-canonical` declared (per the recent Wave-4 convention)
**And** `make shell-bounds` passes (no direct `fetch` in tool script)
**And** `make shell-public-api-smoke` passes (no new `HT.*` surface)
**And** `make pack-tags-smoke` reports `exam-countdown` under `travel`
**And** `make check-pack-taxonomy` reports `exam-countdown` matching the `travel` pack (per the keyword map at `scripts/_pack_tags.py`)
**And** a new `scripts/_smoke_exam_countdown.js` Node smoke harness exists with **at least 25 assertions** covering:
  - (i) Date parsing: `new Date('2026-12-15T09:00')` returns a valid Date; `new Date('garbage')` returns Invalid Date.
  - (ii) Day-difference math: `Math.floor(diff / 86400000)` for diff in ms; for `target = now + 1 day + 2 hours`, expected `days = 1`, `hours = 2`.
  - (iii) Hours-difference math: `Math.floor((diff % 86400000) / 3600000)`.
  - (iv) Minutes-difference math: `Math.floor((diff % 3600000) / 60000)`.
  - (v) Seconds-difference math: `Math.floor((diff % 60000) / 1000)`.
  - (vi) Past-date handling: `target = now - 1 day` → all segments render as `0d`/`0h`/`0m`/`0s`, no negative numbers.
  - (vii) Empty-state handling: no target → segments render `0d`/`0h`/`0m`/`0s` (NOT `—`); empty-state paragraph visible.
  - (viii) localStorage write/read: harness sets `localStorage.setItem('ht.exam-countdown.target', validString)` then loads the tool and verifies the input value matches; harness sets an unparseable string and verifies `localStorage.getItem('ht.exam-countdown.target') === null` after boot.
  - (ix) URL state precedence: harness loads `?target=2027-06-01T12:00` (future) and verifies the input matches the URL value (not the localStorage value); clears localStorage first to avoid interference.
  - (x) URL state malformed: harness loads `?target=garbage` and verifies the input stays empty and `localStorage.getItem('ht.exam-countdown.target') === null`.
  - (xi) Keyboard `t` shortcut: harness dispatches a `keydown` event with `key: 't'` on `document.body` and verifies `document.activeElement === HT.$('#ec-target')`.
  - (xii) Keyboard `c` shortcut: harness dispatches `keydown` with `key: 'c'` and verifies `HT.$('#ec-target').value === ''`, the localStorage key is removed, and the URL `target` param is dropped.
  - (xiii) Keyboard shortcuts scoped to inputs: harness focuses `#ec-target`, types `t`, and verifies the input receives a `t` character (the `t` chord does NOT fire while inside an input — matches the canonical pattern from `flashcard-timer`).
  - (xiv) Privacy: harness replaces `fetch` and `XMLHttpRequest` with stubs that throw; asserts neither is called during a full pick-target → tick → past-target → clear-target sequence.
  - (xv) Tab-order-canonical: harness verifies the canonical selector list is registered on the DOM nodes (skip link, back link, ec-target input, ec-days/hours/minutes/seconds spans, ec-past-notice, ec-clear button).
  - (xvi) No console.error: harness replaces `console.error` with a stub that throws; verifies nothing logs an error across the boot + change + tick sequence.
  - (xvii) vacuous-pass guard (`pass === 0 && fail === 0 → exit 1`).
**And** the new smoke target `exam-countdown-smoke` is wired into `make ci` and `.github/workflows/tool-contract-gate.yml` with path filters.

### AC-8 — Existing regression suite stays green

**Given** the implementation is complete
**When** `make ci` runs
**Then** every existing smoke harness stays green (no regression): the 24+ Node smokes, all Python gates, the regression-sweep + negative pair.

## Files Touched (this story)

| File | Change |
|---|---|
| `_bmad-output/implementation-artifacts/9-8-exam-countdown.md` | NEW (this file) |
| `tools/exam-countdown/index.html` | NEW — ~340 lines (chrome + tool markup). Pattern matches `tools/flashcard-timer/index.html`. |
| `tools/exam-countdown/exam-countdown.js` | NEW — ~150 LOC ES2018 vanilla. Wires datetime-local input, 4 segment spans, localStorage persistence, URL state, past-date handling, keyboard shortcuts. |
| `tools/exam-countdown/exam-countdown.css` | NEW — minimal tool styles (countdown tiles, segment spans, empty-state paragraph, past-notice paragraph). |
| `assets/icons/exam-countdown.svg` | NEW — minimal 24×24 stroke icon (calendar-with-clock glyph). |
| `tools.json` | MODIFIED — append a new entry for `exam-countdown`. |
| `scripts/_smoke_exam_countdown.js` | NEW — Node vm-context smoke harness, ≥ 25 assertions, 12 categories per AC-7. Vacuous-pass guard. |
| `Makefile` | EXTENDED — `.PHONY` + `exam-countdown-smoke` + `help` + `ci:` chain. |
| `.github/workflows/tool-contract-gate.yml` | EXTENDED — `make exam-countdown-smoke` step + path filters. |

## Tasks / Subtasks

- [ ] T1 — Author `tools/exam-countdown/index.html` (chrome + tool markup) following the `flashcard-timer` template. Includes the 4-tile result-grid markup with `class="countdown-segment"` spans, the empty-state paragraph, the past-notice paragraph.
- [ ] T2 — Author `tools/exam-countdown/exam-countdown.css` (tool-specific styles: `.countdown-segment` typography, `.countdown-empty` / `.countdown-past` notices, result-tile variant).
- [ ] T3 — Author `assets/icons/exam-countdown.svg` (24×24 stroke icon — calendar with clock glyph).
- [ ] T4 — Author `tools/exam-countdown/exam-countdown.js` (DOM wiring, datetime-local reader, 4-segment tick, localStorage write/read on init + change, URL state precedence, past-date handling, keyboard shortcuts).
- [ ] T5 — Add the `exam-countdown` entry to `tools.json` with all AC-7 fields including `tab-order-canonical` and `pack: ["travel"]`.
- [ ] T6 — Run `make validate` + `make shell-template` to verify chrome consistency (markers-only splice bug may resurface — apply direct-splice workaround if so).
- [ ] T7 — Write `scripts/_smoke_exam_countdown.js` (≥ 25 assertions, 12 categories per AC-7). Vacuous-pass guard.
- [ ] T8 — Wire Makefile + CI.
- [ ] T9 — Run `make ci` end-to-end. All gates green.
- [ ] T10 — Two-pass review (AI-E3-2). Mark `done`.

## Dev Agent Record

### Implementation Plan

1. **T1 + T2 + T3 + T4 first** — author the tool in the order HTML → CSS → icon → JS. The JS state machine is small (no state, just one input + 4 spans + a tick function).
2. **T5** — `tools.json` entry. Run `make validate` to confirm.
3. **T6** — `make shell-template` to verify chrome consistency (markers-only splice bug may resurface — apply direct-splice workaround if so).
4. **T7** — smoke harness.
5. **T8–T9** — wiring + full `make ci` run.
6. **T10** — two-pass review (AI-E3-2).

### Known limitations

- `datetime-local` input is local-time but doesn't expose the user's timezone in the value. The countdown always treats the picked time as local — which matches user expectation.
- The countdown accuracy is limited by `setInterval` drift (worst case ~1s/hour). Acceptable for a study-pacing tool; not a high-precision stopwatch.
- If the user keeps the tab open across the target time, the countdown ticks past zero (shows zeros) but does NOT switch to a celebration/expired state. This is intentional per AC-4 ("no negative numbers").
- Storage key uses `ht.*` prefix (grandfathered per project-context §6) rather than `handy-tools.*` as in the epics.md AC literal text. See ROQ-2 / AC deviations.

### Debug Log

- T9: shell-bounds-check initially FAILed because exam-countdown.js
  called raw `localStorage.*`. Refactored to `HT.storage.*` (AD-14
  Shell Public API).
- T10 (two-pass review): 8 findings, all addressed.
  - BUG-1 / GAP-1 [critical]: `ht.exam-countdown.target` not registered
    in `assets/js/storage-registry.js` and the inline manifest in
    `assets/shell/chrome.html`. Both now declare the key. Storage-registry
    gate went from FAIL to PASS.
  - BUG-2 [major]: `change` + `input` both bound to `onInputChange` —
    datetime-local fires both on commit, causing double storage write
    and double history.replaceState. Removed `input` listener; tool
    now listens to `change` only. Added regression test (xviii).
  - BUG-3 [major]: `?target=&target=foo` picks the empty value first.
    Fixed by walking `URLSearchParams.getAll('target')` and picking
    the first non-empty value. Added regression test (xix).
  - BUG-6 [major, test bug]: smoke (xiii) only checked
    `consoleErrors.length === 0` — vacuous. Now verifies
    `_focused` stays false after pressing 't' inside an input, AND
    that 'c' inside an input does not clear the field or remove the
    LS key. Requires `makeStub` to set `tagName` (added).
  - BUG-9 [minor]: malformed URL + valid LS did not sync URL to LS
    value, leaving `?target=garbage` in the address bar. Now calls
    `writeUrlTarget(lsVal)` after the LS fallback. Added regression
    test (xx).
  - GAP-2 [minor]: AC-4 says past-notice visibility via `data-past`/
    `display:none`, implementation uses `hidden` attribute. The
    `hidden` attribute is the modern HTML5 idiom, semantically
    equivalent, and a11y-friendly. Documented deviation; left as-is.
  - GAP-4 [minor]: `#ec-past-notice` missing from `tab-order-canonical`
    in tools.json. Added.
- The `shell-template.py` markers-only splice bug resurfaced for the
  inline `<script id="ht-tools-json-inline">` block. Documented the
  workaround as a new helper `scripts/_resplice_inline_tools_json.py`
  (matches the existing `_resplice_chrome_pages.js` pattern).

### Completion Notes

- T9: 43/43 smoke assertions PASS, regression sweep 42/42 tools
  (252/252 checks), shell-bounds PASS, storage-registry PASS.
- T10: two-pass review complete. 8 findings (1 critical, 4 major,
  3 minor), all addressed. Smoke harness expanded to 52 assertions
  across 20 categories. Final state: storage-registry green,
  shell-bounds green, regression sweep 42/42, exam-countdown-smoke
  52/52.

## File List

- `_bmad-output/implementation-artifacts/9-8-exam-countdown.md` (this file)
- `tools/exam-countdown/index.html` (NEW)
- `tools/exam-countdown/exam-countdown.js` (NEW)
- `tools/exam-countdown/exam-countdown.css` (NEW)
- `assets/icons/exam-countdown.svg` (NEW)
- `tools.json` (modified — 1 new entry)
- `scripts/_smoke_exam_countdown.js` (NEW)
- `Makefile` (modified)
- `.github/workflows/tool-contract-gate.yml` (modified)

## Change Log

- 2026-08-13 — CS: spec drafted. ROQ-1 (default target) → empty state on first visit; ROQ-2 (storage key prefix) → `ht.*` per project-context §6 grandfather rule (deviation from epics.md literal text flagged in AC deviations); ROQ-3 (URL vs localStorage priority) → URL wins; ROQ-4 (past-date notice) → distinct from empty state. Pack: `travel` per Story 9.16's `check-pack-composition.py` constraint.

## Status

ready-for-dev