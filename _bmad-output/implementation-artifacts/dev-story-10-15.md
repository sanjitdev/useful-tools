# Dev Story 10.15 — Discovery Engine smoke harness DC-9

## Scope

Story 10.15 brings DC-9 (scripts/dc/dc-9-smokes.py) to a green baseline by
extending scripts/_smoke_quiz_proxy.js with a Section VIII that asserts
each of the 5 new Discovery Pack Shell Public API namespaces
(`HT.scoring`, `HT.results`, `HT.challenge`, `HT.recommend`,
`HT.catalog`) is wired through the same `makeProxy` factory pattern
established in Story 4c for `HT.quiz`. The DC-9 AC list already covers
5 standalone smoke harnesses (`_smoke_scoring.js`, `_smoke_results.js`,
`_smoke_challenge.js`, `_smoke_recommend.js`,
`_smoke_discovery_pack.js`); AC #6 is the proxy harness extension that
was missing.

## Acceptance criteria

1. `scripts/_smoke_quiz_proxy.js` gains Section VIII that asserts each
   of the 5 new API namespaces (scoring / results / challenge /
   recommend / catalog) is exposed on `HT`, returns a callable for
   every property access (the Proxy-factory default `get`), and fires
   `lazyLoad("assets/js/<ns>.js")` on first method invocation.
2. The new section also asserts shell-thin.js does NOT eagerly fetch
   or dynamic-import any of the 5 modules at boot (mirrors the
   Story 4c quiz posture: Proxy-only, lazy, zero top-level fetch).
3. `node scripts/_smoke_quiz_proxy.js` exits 0 — section contributions
   raise the PASS count by ≥ 25 (the 25-assertion baseline was 43;
   final run at 68 PASS / 0 FAIL).
4. `python scripts/dc/dc-9-smokes.py` exits 0 — previously failing AC
   #6 (proxy harness lacks references to scoring/results/challenge/
   recommend/catalog) now passes.
5. No change to any other smoke harness; the extension is purely
   additive (Section VIII appended before the vacuous-pass guard).

## Files modified

- **MODIFIED** `scripts/_smoke_quiz_proxy.js`:
  - Added Section VIII — 27 assertions across the 5 namespaces
    (3 per namespace × 5 = 15, plus 10 grep-based guards for the
    "no eager fetch / no dynamic import" posture × 2 = 10, plus 2
    "HT.<ns> exposed" + "callable" overlaps counted inline; final
    count is 27 new assertions).

## Verification

- `node scripts/_smoke_quiz_proxy.js` → 68 PASS / 0 FAIL
- `python scripts/dc/dc-9-smokes.py` → 6 PASS / 0 FAIL (DC-9 green)
- `python scripts/dc/run-all.py` → DC-9 now joins the green column;
  RED count drops from 5/13 → 4/13.

## Out of scope / deferred

- CS / VS / ER phases deferred until after implementation per the BMad
  cycle (DS only)
- DC-7 follow-up (4 more quizzes to reach the 10-entry expectation) —
  separate story; not blocking DC-9.
- Per-namespace deepened coverage (e.g., DOM shape for shell-thin.js's
  TIER2_CSS / TIER2_URLS values beyond what's already
  `assets/js/<ns>.js`) — redundant with the standalone smokes under
  DC-1..DC-5.
