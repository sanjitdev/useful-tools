# Dev Story 10.10 — Result card chrome (Share + Challenge button wiring)

## Scope

Story 10.10 closes the on-page UX loop on the Discovery result card by
wiring the Share / Challenge buttons that the render chrome (Story 10.3)
already draws. Before this story, the buttons were inert — they rendered
the right DOM (`.button.share` / `.button.challenge`, `data-print="ignore"`
on the action row) but did not respond to clicks. After this story:

- **Share button** routes through `HT.share.copy(state, opts)` — the
  canonical shell clipboard API (Story 10.11 adds the PNG/URL/Print
  fallback surface). Surfaces a toast on success/failure.
- **Challenge button** routes through `HT.challenge.link(spec)` to mint
  a challenge URL, then `HT.share.copy` to drop it on the clipboard.
  Hidden entirely when `HT.challenge` is absent (utility-category
  quiz opt-out — the button is not part of the DOM for those quizzes).
- **wireActions is idempotent** — a `data-wired="1"` attribute guard
  prevents re-render / re-mount from double-binding click listeners.
- **shell-bounds-check preserved** — no bare `navigator.clipboard`,
  `localStorage`, `fetch`, `XHR`, or `window.print` in `results.js`.
  All routing goes through the frozen `HT.*` surface.

The addition stays inside the 6 KB gzipped budget for `results.js`
(measured **5,094 bytes gz** after the change, up from 4,xxx before).

## Acceptance criteria

1. `HT.results.wireActions` is exposed on the frozen public API
   (`Object.defineProperty(HT, 'results', { writable: false, ... })`)
   alongside the existing `render / shareUrl / copyText / imageSnapshot`.
2. `wireActions(card, state, opts)` locates the rendered card's
   `.quiz-result-actions` node (`data-print="ignore"`) and attaches
   click listeners to the `[data-action="share"]` and
   `[data-action="challenge"]` buttons.
3. Share click → `HT.share.copy(state, opts)` is invoked (the canonical
   shell API, not bare `navigator.clipboard`). On success, a toast
   `"Share link copied"` is surfaced. On failure, a `"Copy failed"` toast.
4. Challenge click → `HT.challenge.link({ slug, self: answers })` is
   invoked to mint a URL, then `HT.share.copy({ archetype }, { shareUrl })`
   drops it on the clipboard. On success, a `"Challenge link copied"` toast.
5. The Challenge button is set `hidden` + `aria-hidden="true"` when
   `HT.challenge` is absent (utility-category quiz opt-out), so tab-
   order skips it cleanly.
6. `wireActions` is idempotent — a second call on the same card is a
   no-op (the `data-wired="1"` attribute guard short-circuits the
   listener attachment).
7. `render(state, opts)` defers `wireActions` to a microtask
   (`Promise.resolve().then(...)`) so the caller can `appendChild` the
   root before the wireActions code walks the DOM.
8. `results.js` contains no `navigator.clipboard`, `localStorage`,
   `fetch`, `XHR`, or `window.print` — the shell-bounds-check contract
   holds after the Story 10.10 extension. Verified via stripped-source
   regex smoke.
9. gzipped `results.js` stays under the 6,144-byte DC-2 budget. Measured
   **5,094 bytes gz** after the change.
10. `scripts/_smoke_result_card_chrome.js` exists and exits 0 via node
    with all 17 assertions PASS; documents the contract in its header
    comment.

## Files created / modified

- **MODIFIED** `assets/js/results.js` — added `wireActions(card, state, opts)`
  function (lines ~278–384); added `wireActions` to the frozen `publicApi`;
  `render()` now schedules `wireActions` via `Promise.resolve().then(...)`
  unless `opts.wireActions === false`. Updated header comment to reference
  Story 10.10 + document the new API surface + the idempotency contract.
- **NEW** `scripts/_smoke_result_card_chrome.js` — pure-Node vm-sandbox
  smoke with FakeEl stubs (classList mutation, addEventListener tracking,
  querySelectorAll matching). 9 sections (I–IX), 17 assertions. Validates:
  wireActions exposed → listeners attached → Share click → Challenge click
  → Challenge hidden when absent → idempotency → shell-bounds-check →
  bundle-size ≤ 6 KB → vacuous-pass guard.

## Verification

- `node scripts/_smoke_result_card_chrome.js` → **17/17 PASS**
- `node scripts/_smoke_results.js` (Story 10.3 original) → **26/26 PASS**
  (no regression)
- `python scripts/dc/dc-2-results.py` → **23/23 PASS** (no regression)
- `python scripts/shell-bounds-check.py` (referenced by DC-2) → PASS
  (regex strips comments + asserts no `navigator.clipboard` / `localStorage` /
  `fetch` / `XHR` / `window.print`)
- gzipped `results.js` measured **5,094 bytes** (under 6,144-byte budget)
- DOM checks via FakeEl: data-print="ignore" on action row,
  data-action="share" + data-action="challenge" buttons present,
  click listener attached, hidden/aria-hidden when HT.challenge absent,
  double-bind guard works (1 → 1 listeners after re-call)

## Out of scope / deferred

- **Story 10.11** — Share-card chrome (PNG/URL/Print full UX). The PNG
  path will wrap `HT.results.imageSnapshot` (which throws
  `'snapshot unavailable'` in the smoke environment) with a real
  canvas / html2canvas-style renderer. The URL share path is already
  wired by Story 10.10 (Share → `HT.share.copy(state, opts)`). The
  Print path will go through `HT.share.print` (not yet implemented).
- **CS / VS / ER phases** — deferred until after implementation per the
  BMad cycle (DS only for this story).
- **Adding `wireActions` to `docs/shell-public-api.md` §5** — the
  public API surface change is documented in the `results.js` header
  comment (which `docs/shell-public-api.md` cross-references via the
  "see source" pattern); a dedicated row entry is tracked as
  AI-E10-2 follow-up alongside Story 10.11.
- **Toast deduplication** — `HT.toast` is called for every Share/Challenge
  click success. Multiple rapid clicks will surface multiple toasts.
  Toast coalescing is a separate concern owned by the Shell, not
  `results.js`.

## Notes

- The `data-wired="1"` guard is set on the card root, not on the
  buttons. This is intentional: the card is the unit of "this DOM was
  rendered once and wired." A re-render creates a new card (and thus
  a new guard slot), so the guard does not block legitimate re-renders.
- The `Promise.resolve().then(...)` defer in `render()` exists because
  `render()` returns a detached node — the caller is expected to
  `appendChild` it before the wireActions code runs. The microtask
  defer gives the caller that slot. The smoke harness calls
  `wireActions` synchronously to test the wiring path without draining
  the microtask queue.
- The `HT.challenge.link` call signature is `{ slug, self: answers }` —
  `slug` is the receiver's quiz slug, `self` is the sender's answers
  (encoded only — no traits, no archetype per AD-9). The smoke stubs
  `HT.challenge.link` to return a fixed URL (`https://example.com/?c=ABCDEF`)
  so the wiring is asserted without actually minting a challenge blob.
- The "Challenge button hidden when HT.challenge absent" check uses
  `setAttribute('hidden', '')` (the canonical HTML5 hidden attribute,
  not `style.display = 'none'`). This is both more semantic AND makes
  the button unfocusable by default, so the tab-order skips it without
  needing extra `tabindex="-1"` plumbing.
- The `wireActions` function does NOT attach listeners to the entire
  `quiz-result-actions` div — only to the individual buttons. This
  avoids event delegation complexity and keeps the contract obvious
  for the smoke harness (which can assert on a specific button's
  `_listeners.click` array).
- The decision to route through `HT.share.copy` (instead of `HT.copyToClipboard`)
  is deliberate: the Shell's `share.copy` owns the "copy + add to share
  history + surface toast" contract. `HT.copyToClipboard` is the
  fallback path, used only when `HT.share` is missing (rare).
