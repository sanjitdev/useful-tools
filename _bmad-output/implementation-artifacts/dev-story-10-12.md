# Dev Story 10.12 — Challenge UX (receiver-side landing + privacy default)

## Scope

Story 10.12 ships the receiver side of the Challenge viral loop. Maya
pastes the Challenge URL `?c=<blob>` (minted by Story 10.4's
`HT.challenge.link`). The receiver page must:

1. Land on a page that announces what's happening via `aria-live="polite"`
2. Default to **blind mode** — the seeder's archetype + blind spot are
   hidden behind a toggle (`<input type="checkbox">` unchecked on mount)
3. Reveal the seeder's archetype + blind spot on toggle (in a `<details>`)
4. Compute the local quiz result via the same scoring engine
5. After completion, redirect to `/<slug>/compare.html#seedA=<local>`
   so the receiver + seeder can see the Jaccard agreement score

AD-9 privacy contract — the seeder's answers never travel. Only the
minted blob (which encodes answers hash + slug + iat + exp) is in the
URL, and the receiver decodes it via `HT.challenge.verify`.

## Acceptance criteria

1. `assets/js/challenge-receiver.js` exists and exposes
   `HT.challengeReceiver` via `Object.defineProperty` with
   `writable:false, configurable:false` (AD-14 frozen surface).
2. Public API surface: `landing(quizSlug, host, opts)`,
   `compareView(quizSlug, selfA, selfB, host)`, `getChallengeBlob()`,
   `stashLocalAnswers(quizSlug, answers)`, `readLocalAnswers(quizSlug)`.
3. Landing mounts a `.challenge-banner` section with:
   - `<h2>` labelled by the slug's archetype or "a friend"
   - Toggle default **unchecked** (blind)
   - `aria-live="polite"` announcement on mount: "Challenge from a
     friend loaded. Default: take the quiz blind."
4. When blob is malformed / expired / spec-mismatched, an inline
   `.challenge-error` section with `role="alert"` replaces the
   quiz mount and announces "Challenge link unavailable."
5. Compare view mounts a `.compatibility-card` with the 3-band CSS
   classes (`band-high` / `band-mid` / `band-low`) chosen by score.
6. Quiz core wires `HT.challengeReceiver` so the receiver-side flow
   runs whenever `getChallengeBlob()` returns a non-null blob on
   page load (i.e. `?c=<blob>` is in the URL).
7. At least one quiz canary (spirit-animal) ships a `compare.html`
   that loads challenge-receiver.js + compatibility-card.css and
   calls `HT.challengeReceiver.compareView(...)` to render the
   compatibility card from a `?seedA=&seedB=` URL.
8. `assets/css/compatibility-card.css` declares `.compatibility-card`
   + `.challenge-banner` + the 3-band selectors.
9. gzipped `challenge-receiver.js` stays under the 3,000-byte budget
   for Story 10.12 (measured **2,985 bytes gz**).
10. DC-13 gate exits 0 with all 111 assertions PASS.

## Files created

- **`assets/js/challenge-receiver.js`** (255 lines) — `HT.challengeReceiver`
  IIFE with the frozen public surface. No third-party libs, no PII access,
  ES2018 vanilla per AD-1 / AD-12 / AD-14.
- **`assets/css/compatibility-card.css`** (113 lines) — `.compatibility-card`
  + `.challenge-banner` + `.band-high` / `.band-mid` / `.band-low` selectors,
  `prefers-reduced-motion` respected, `forced-colors` 2px cursor border per
  WCAG 2.1.
- **`scripts/_smoke_challenge_receiver.js`** (156 lines) — vm-sandbox
  smoke covering the full contract (parse → decode → render banner →
  mount quiz → stash answers → redirect to compare → render card).
- All 10 quiz canary pages (`tools/packs/discovery/<slug>/index.html` and
  `compare.html`) wired with `challenge-receiver.js` + `compatibility-card.css`.
  The canary pattern: any quiz that opts into `modules.challenge.match-scorer`
  in `tools.json` gets the receiver flow.

## Files modified

- **`tools.json`** — every quiz entry with `modules.challenge` declares
  the receiver-side integration. No new keys; existing `challenge: {match-scorer: ...}`
  gates this.
- **`assets/js/api-contract.js`** — `HT.challengeReceiver` documented.
- **`docs/shell-public-api.md`** §5 — row added for `HT.challengeReceiver`.

## Verification

- `python scripts/dc/dc-13-challenge-ux.py` → **111/111 PASS** (gate contract)
- `node scripts/_smoke_challenge_receiver.js` → all assertions PASS
- `python scripts/dc/run-all.py` → 16/16 stories green
- gzipped `challenge-receiver.js` measured **2,985 bytes** (under 3 KB budget)
- Per-quiz DC-14 "Story 10.12 CTA queries .quiz-result-actions (not .disc-actions)"
  passes for all 10 quizzes — every `<slug>-core.js` consumes
  `HT.challengeReceiver` and gates the receiver flow on `getChallengeBlob()`
- shell-drift-check exits 0 (chrome unchanged)
- storage-registry-gate PASS (no new storage keys)

## Out of scope / deferred

- **Story 10.11** — Share-card chrome (PNG/URL/Print full UX). The
  receiver landing uses the existing `HT.share.copy` for clipboard
  fallback; PNG export is a separate concern owned by the share dialog.
- **OG images for challenges** — the receiver landing inherits the
  archetype OG SVG via the canonical share-card surface when Story 10.11
  ships. Today's `<title>` is set by the quiz mount (`<title>` element
  in `<head>`); the per-archetype `<title>` SVG is Story 10.11's job.
- **CS / VS / ER phases** — deferred until after implementation per the
  BMad cycle (DS only for this story).
- **`compare.html` non-canary quizzes** — the remaining 9 quizzes wire
  compare.html via the same canary pattern but the DC-13 only requires
  the spirit-animal canary to exist (the others are verified by DC-14
  per-quiz checks).

## Notes

- The 3-band thresholds (high ≥ 80 / mid ≥ 50 / low < 50) match the
  HT.challenge.compare output from Story 10.4. The compatibility-card
  CSS hardcodes the bands so the visual semantic matches the
  `result.score` value the comparison function returns.
- The `aria-live` announcement uses `role="status"` + `aria-atomic="true"`
  per WAI-ARIA 1.2 to ensure screen readers read the full text. The
  timer (4 seconds) is empirically tuned — too short and VoiceOver /
  NVDA miss it; too long and the DOM accumulates dead `<div>`s.
- `stashLocalAnswers` calls `HT.toast.warn` on quota errors (rare
  but possible in private-browsing modes) so the user knows their
  answers aren't persisted. The compare view will fall back to
  asking the user to retake the quiz if the local stash is missing.
- The receiver flow does NOT re-implement the quiz UI — it delegates
  to the existing `<slug>-core.js` boot logic. The `challenge-receiver.js`
  only owns the banner + announce + error path + compare view.

## Forward-only commitments

- Future quizzes that add `modules.challenge` to `tools.json` automatically
  inherit the receiver-side flow (canary pattern). No per-quiz code needed.
- The 3-band visual semantic (high / mid / low) is the canonical Discovery
  design token — any new comparison surface in the platform should reuse
  these classes.