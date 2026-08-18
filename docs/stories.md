# Stories — Discovery Engine (DC-0..DC-12)

This document is the per-story ledger for the Discovery Engine (Epic 10).
Every story is filed under its own heading (`DC-0` .. `DC-12`) and
carries the six fields below within the first 800 chars after the
heading. The DC-12 retro gate (`scripts/dc/dc-12-retro.py`) audits
this structure on every run.

Required fields per heading:

- **files** — every authored / modified file (paths under repo root)
- **api** — the Shell Public API deltas (HT.* entries added, modified,
  or removed; AD-14 boundary)
- **ac** — the acceptance criteria bullets (verbatim from the story
  file)
- **verify** — the verification command(s) that prove the AC
- **owner** — the author / pair who landed the story
- **status** — `done` (or `in-progress` if any AC still pending)

For shipped retro with measured byte counts, see
`_bmad-output/implementation-artifacts/epic-discovery-shipped.md`.

---

## DC-0 — Schema additions (packs[] + pack-entry + module-defs)

- **verify:** `python scripts/dc/dc-0-schema.py` (13/13 PASS);
  `python scripts/validate-tools-json.py` exits 0
- **owner:** Story 10.1 author (2026-08-17)
- **status:** done (commit f52554d)
- **files:** `tools.schema.json` (added `properties.packs`,
  `definitions.{pack-entry,quiz-entry,module-def,scoring-config,
  results-config,challenge-config,catalog-config}`)
- **api:** none — schema-only; no HT.* surface change
- **ac:** schema parses; `properties.packs.additionalProperties.$ref ==
  '#/definitions/pack-entry'`; `pack-entry` requires `slug, title,
  loader, entries`; `quiz-entry` requires `slug, title, category, data,
  modules`; `module-def.kind` enum == `[scoring, results, challenge,
  catalog]`; `scoring-config.trait-ids` array minItems 1;
  `results-config.variant` enum; `challenge-config.match-scorer` enum;
  `catalog-config.domain` kebab-case pattern; `additionalProperties ==
  false`; existing 50 tools still validate against schema

## DC-1 — Scoring engine (assets/js/scoring.js)

- **verify:** `node scripts/_smoke_scoring.js` (16/16 PASS);
  `python scripts/dc/dc-1-scoring.py` (15/15 PASS)
- **owner:** Story 10.2 author (2026-08-17)
- **status:** done (commit per Story 10.2 DS file)
- **files:** `assets/js/scoring.js` (NEW — pure trait scoring,
  `(answers, spec) → {traits, archetype}`); `assets/js/shell-thin.js`
  (TIER2_URLS.scoring + makeProxy stub); `assets/js/api-contract.js`
  (1.24.0 → 1.25.0 with HT.scoring stable); `docs/shell-public-api.md
  §5` row; `scripts/_smoke_scoring.js` (16/16 PASS); `scripts/dc/
  dc-1-scoring.py`
- **api:** `HT.scoring.score(answers, spec) → {traits, archetype}`
  registered as stable; AD-14 boundary preserved (no DOM, no storage,
  no fetch)
- **ac:** module ≤ 4 KB gz; frozen pure function; deterministic; trait
  scores clamped [0, 100]; skipped/unknown answers contribute zero;
  empty answers yield default archetype

## DC-2 — Results module (HT.results.render + share-card chrome)

- **verify:** `node scripts/_smoke_results.js` (26/26 PASS);
  `python scripts/dc/dc-2-results.py` (23/23 PASS)
- **owner:** Story 10.3 author (2026-08-17)
- **status:** done
- **files:** `assets/js/results.js` (NEW); `assets/css/result-card.css`
  (NEW); `assets/js/shell-thin.js` (TIER2_URLS.results, TIER2_CSS,
  makeProxy); `assets/js/api-contract.js` (1.25.0 → 1.26.0);
  `scripts/_smoke_results.js` (26/26 PASS); `scripts/dc/dc-2-results.py`
- **api:** `HT.results = {render, shareUrl, copyText, imageSnapshot}`
  registered stable; frozen via Object.defineProperty
- **ac:** module ≤ 6 KB gz (actual 5,815); card root carries
  `.button.share` + `.button.challenge`; `data-print="ignore"` on the
  action row; reduced-motion respected; B1 contrast verified

## DC-3 — Challenge module (HT.challenge.encode/decode/compare)

- **verify:** `node scripts/_smoke_challenge.js` (24/24 PASS);
  `python scripts/dc/dc-3-challenge.py` (21/21 PASS)
- **owner:** Story 10.4 author (2026-08-17)
- **status:** done
- **files:** `assets/js/challenge.js` (NEW — link/compare/verify);
  `assets/js/shell-thin.js` (TIER2_URLS.challenge, makeProxy);
  `assets/js/api-contract.js` (1.26.0 → 1.27.0 with HT.challenge
  stable — 103 entries); `scripts/_smoke_challenge.js` (24/24 PASS);
  `scripts/dc/dc-3-challenge.py`
- **api:** `HT.challenge = {link, compare, verify}` registered
  stable; frozen surface
- **ac:** module ≤ 7 KB gz (actual 4,289); blob shape `{v:1, slug,
  self, iat, exp}`; default 30-day expiry; verify returns
  `{ok: true}` | `{ok: false, code: 'malformed'|'spec-mismatch'|
  'expired', message}`; no PII; no fetch

## DC-4 — Recommendation module (HT.recommend.match + HT.catalog)

- **verify:** `node scripts/_smoke_recommend.js` (25/25 PASS);
  `python scripts/dc/dc-4-recommend.py` (30/30 PASS)
- **owner:** Story 10.5 author (2026-08-17)
- **status:** done
- **files:** `assets/js/recommend.js` (NEW); `assets/js/catalog.js`
  (NEW); `assets/data/{catalog-profiles,cars,bikes}.json` (NEW);
  `assets/js/shell-thin.js` (TIER2_URLS.recommend + catalog +
  makeProxy); `assets/js/api-contract.js` (1.27.0 → 1.28.0 with
  HT.recommend + HT.catalog both stable — 105 entries);
  `scripts/_smoke_recommend.js` (25/25 PASS); `scripts/dc/
  dc-4-recommend.py`
- **api:** `HT.recommend = {match}` and `HT.catalog = {list,
  lazyLoad}` both registered stable; frozen surface
- **ac:** recommend ≤ 4 KB gz (actual 3,119); catalog ≤ 4 KB gz
  (actual 2,358); dot-product match; deterministic; tie-break by id
  alphabetical; catalog count > 0; bundled JSON files; no remote fetch

## DC-5 — Discovery loader (assets/js/packs/discovery-loader.js)

- **verify:** `node scripts/_smoke_discovery_pack.js` (25/25 PASS);
  `python scripts/dc/dc-5-loader.py` (12/12 PASS)
- **owner:** Story 10.6 author (2026-08-17)
- **status:** done (commit d7283c3)
- **files:** `assets/js/packs/discovery-loader.js` (NEW);
  `assets/css/discovery.css` (NEW — `.discovery-pack-grid` +
  `.discovery-pack-card` responsive chrome); `assets/js/shell-thin.js`
  (SPEC_PAGE_CONDITIONAL_MODULES entries); `scripts/bundle-size-
  gate.py` (added 2 entries); `scripts/_smoke_discovery_pack.js`
  (25/25 PASS); `scripts/dc/dc-5-loader.py`
- **api:** `HT.discovery = {load, list}` (loader surface) — frozen
  via Object.defineProperty
- **ac:** loader ≤ 2 KB gz (actual 1,662); css ≤ 4 KB gz (actual
  1,454); loader.js does NOT eagerly fetch scoring/results/
  challenge/recommend/catalog; lists 6 entries; load('spirit-animal')
  resolves the entry; load('does-not-exist') resolves null

## DC-6 — 6 quiz MVP routes (spirit-animal + 5 more)

- **verify:** `python scripts/dc/dc-6-quizzes.py` (48/48 PASS, 0 FAIL);
  `python scripts/validate-tools-json.py` exit 0
- **owner:** Story 10.7 author (2026-08-17)
- **status:** done
- **files:** `tools/packs/discovery/{spirit-animal,future-partner,
  what-would-you-do,decision-style,friend-match,car-finder}/{index.html,
  <slug>-core.js, <slug>.css, data.json}` (24 files NEW);
  `tools.json` (`packs.discovery.entries[6]`, `releaseVersion`
  0.0.0 → 10.7.0); `scripts/dc/dc-6-quizzes.py`
- **api:** none — quizzes are tool-side; consume the 5 Shell APIs
  but don't add to HT.*
- **ac:** every data.json has `{questions[].length 3..30, scoring-spec
  {traits[], weights{q:{answerValue:{trait:delta}}}, archetypes
  [{id, label, emoji, scores{}, tagline, blindSpot, default?}]}}`
  with exactly one default:true archetype; every index.html has FOUC
  IIFE in first 1500 chars + canonical stylesheet chain

## DC-7 — tools.json registration (Discovery pack + 10 entries)

- **verify:** `python scripts/dc/dc-7-tools-json.py` (14/14 PASS);
  `python scripts/validate-tools-json.py` exits 0
- **owner:** Story 10.7 author (2026-08-17) + 10.7 follow-up
  (4-quiz deficit, 2026-08-18)
- **status:** done
- **files:** `tools.json` (`packs.discovery.entries[]` carries 10
  entries: spirit-animal, future-partner, what-would-you-do,
  decision-style, friend-match, car-finder, fortune-cookie,
  time-traveler-therapist, dream-job, last-meal); 4 new data.json
  files at `tools/packs/discovery/{fortune-cookie,
  time-traveler-therapist, dream-job, last-meal}/data.json`;
  `scripts/dc/dc-7-tools-json.py`
- **api:** none — registration only
- **ac:** tools.json parses as JSON; top-level `packs` is an object;
  `packs.discovery` exists with slug == 'discovery'; `entries[]`
  length == 10 (closed via 10.7 follow-up); every entry's slug
  matches `^[a-z][a-z0-9-]*[a-z0-9]$`; every entry's slug is unique;
  every entry's `modules[]` declares at least `scoring` + `results`
  (utility-category entries also declare `catalog`); every entry's
  `data` path is rooted at `./tools/packs/discovery/<slug>/data.json`

## DC-8 — Documentation (docs/discovery-platform.md)

- **verify:** `python scripts/dc/dc-8-docs.py` (9/9 PASS)
- **owner:** Story 10.17 author (2026-08-18)
- **status:** done
- **files:** `docs/discovery-platform.md` (NEW — 2,601 words);
  `README.md` (gains "Discovery Platform" section); `scripts/dc/
  dc-8-docs.py`
- **api:** none — docs only
- **ac:** doc exists and ≥ 1,000 words; documents
  `HT.scoring.score(answers, spec)` with example; documents
  `HT.results.render(scored, opts)` with example; documents
  `HT.challenge.link(spec)` + `{v, slug, self, iat, exp}` blob shape;
  documents `HT.recommend.match(profile, domain)` with profile + item
  shape; includes "Hello World" quiz authoring example

## DC-9 — Smoke harnesses (5 new + _smoke_quiz_proxy update)

- **verify:** `node scripts/_smoke_quiz_proxy.js` (68/68 PASS after
  Section VIII); `python scripts/dc/dc-9-smokes.py` (6/6 PASS)
- **owner:** Story 10.15 author (2026-08-18)
- **status:** done
- **files:** `scripts/_smoke_scoring.js`, `scripts/_smoke_results.js`,
  `scripts/_smoke_challenge.js`, `scripts/_smoke_recommend.js`,
  `scripts/_smoke_discovery_pack.js` (5 NEW smokes for DC-1..DC-5);
  `scripts/_smoke_quiz_proxy.js` (MODIFIED — Section VIII added for
  the 5 new API Proxy-loads); `scripts/dc/dc-9-smokes.py`
- **api:** none — smokes only
- **ac:** all 5 new smokes exist, parse as JS, exit 0 via node;
  `_smoke_quiz_proxy.js` includes a section asserting 5 new APIs
  Proxy-load (scoring / results / challenge / recommend / catalog);
  no eager fetch / no dynamic import of the 5 modules in shell-thin.js

## DC-10 — Pack gate (scripts/pack-gate.py + workflow + docs)

- **files:** `scripts/pack-gate.py` (NEW); `.github/workflows/pack-gate.yml`
  (NEW); `docs/ci-gate.md` §8; `Makefile` targets; `scripts/dc/dc-10-pack-gate.py`
- **api:** none
- **ac:** `pack-gate.py` exists + parses; exits 0 against `tools.json`;
  exits 1 on bad Discovery entry; workflow references `pack-gate.py`;
  docs §8 "Pack Gate"; `--list` prints contract; `tool-contract-gate.py`
  untouched
- **verify:** `make pack-gate` exits 0; `python scripts/dc/dc-10-pack-gate.py`
  8/8 PASS
- **owner:** Story 10.18 author (2026-08-18)
- **status:** done (slug regex, non-empty title, allowed category, data
  path, modules[] scoring+results+catalog, questions 3..30)

## DC-11 — Bundle gate (SPEC_PAGE_CONDITIONAL_MODULES + baseline)

- **verify:** `python scripts/dc/dc-11-bundle.py` (11/11 PASS);
  `python scripts/bundle-size-gate.py` exits 0
- **owner:** Story 10.16 author (2026-08-18)
- **status:** done
- **files:** `scripts/bundle-size-gate.py` (SPEC_PAGE_CONDITIONAL_
  MODULES list extended with 10 entries); `scripts/_bundle_size_per_
  tool.py` (covers `tools/packs/**/index.html`); `scripts/dc/
  dc-11-bundle.py`
- **api:** none — gate only
- **ac:** 10 page-conditional entries present in SPEC_PAGE_CONDITIONAL_
  MODULES; BUNDLE_SIZE_BASELINE == 132,638 (locked at Story 4c
  landing); `python scripts/bundle-size-gate.py` exits 0;
  `_bundle_size_per_tool.py` covers tools/packs/**/index.html

## DC-12 — Lints (PII + archetype immutability)

- **verify:** `python scripts/dc/dc-12-lints.py` (14/14 PASS)
- **owner:** Story 10.13 author (2026-08-17)
- **status:** done
- **files:** `scripts/check-disc-pii.py` (NEW); `scripts/check-archetype-
  immutability.py` (NEW); `scripts/dc/dc-12-lints.py`; `tools.json`
  (`pii-allowlist` per-quiz); `.github/workflows/tool-contract-gate.yml`
  (2 new steps + 2 path triggers); `Makefile` (.PHONY + ci: chain +
  help)
- **api:** none — lints only
- **ac:** PII regex rejects email/phone/IPv4/street by default;
  per-quiz allowlist via `tools.json pii-allowlist`; archetype
  immutability regex rejects `{{...}}` + `{user.x}` / `{answers.x}`;
  combined gate exits 0 against current packs/disc/ tree

## DC-12 (retro) — Epic 10 retrospective (this story)

- **verify:** `python scripts/dc/dc-12-retro.py` (4/4 PASS)
- **owner:** Story 10.19 author (2026-08-18) + Story 10.7 follow-up
  (2026-08-18 — flips DC-7 status to "done", closes AI-E10-1)
- **status:** done
- **files:** `docs/stories.md` (this document); `_bmad-output/
  implementation-artifacts/epic-discovery-shipped.md` (NEW — byte
  measurements + lessons + action items); `scripts/dc/dc-12-retro.py`
- **api:** none — retro only
- **ac:** `docs/stories.md` exists with a heading per story ID
  DC-0..DC-12; each heading carries the required fields (files / api /
  ac / verify / owner / status); `_bmad-output/implementation-
  artifacts/epic-discovery-shipped.md` exists with actual byte
  measurements (not just targets)

## DC-13 — Challenge UX receiver landing (Story 10.12)

- **verify:** `python scripts/dc/dc-13-challenge-ux.py` (111/111 PASS);
  `node scripts/_smoke_challenge_receiver.js` (18/18 PASS);
  `python scripts/bundle-size-gate.py` exits 0 (challenge-receiver.js 2,525 gz,
  compatibility-card.css 932 gz)
- **owner:** Story 10.12 author (2026-08-18) + Story 10.12 roll-out
  (2026-08-18 — DC-13 generalized from canary to all 10 quizzes)
- **status:** done
- **files:** `assets/js/challenge-receiver.js` (NEW — HT.challengeReceiver
  frozen surface: landing, compareView, getChallengeBlob, stashLocalAnswers,
  readLocalAnswers; AD-14 boundary); `assets/css/compatibility-card.css`
  (NEW — `.compatibility-card` + 3-band selectors + `.challenge-banner`);
  `scripts/_smoke_challenge_receiver.js` (NEW — 18 vm-sandbox assertions);
  `scripts/dc/dc-13-challenge-ux.py` (NEW — generalized from canary to
  all 10 quizzes; 111 AC checks covering module + css + every quiz +
  smoke + bundle + privacy default + aria-live announcement + runtime
  vm-sandbox verification); `scripts/_gen_compare_pages.py` (NEW —
  generator for the 9 non-canary compare.html files, idempotent);
  `scripts/_wire_receiver_rollout.py` (NEW — idempotent wiring of
  landing/stash/CTA blocks into each of the 9 non-canary -core.js
  files + the challenge-receiver.js script tag into each index.html);
  `scripts/bundle-size-gate.py` (2 new SPEC_PAGE_CONDITIONAL_MODULES
  entries); `assets/js/api-contract.js` (HT.challengeReceiver registered
  stable, contract 1.28.0 → 1.29.0); `scripts/dc/dc-9-smokes.py`
  (smoke list extended 5 → 6); `scripts/dc/run-all.py` (DC-13 added,
  13 → 14 stories); `tools/packs/discovery/<slug>/{index.html,
  <slug>-core.js, compare.html}` for all 10 quizzes; the canary
  (spirit-animal) was authored first; the 9 remaining quizzes
  (future-partner, what-would-you-do, decision-style, friend-match,
  car-finder, fortune-cookie, time-traveler-therapist, dream-job,
  last-meal) were rolled out via the generator + patcher
- **api:** `HT.challengeReceiver = { landing, compareView,
  getChallengeBlob, stashLocalAnswers, readLocalAnswers }` registered
  stable; frozen via Object.defineProperty; AD-14 boundary preserved
  (no DOM mutation outside the landing banner; no fetch; no PII)
- **ac:** module ≤ 3 KB gz (actual 2,525); css ≤ 4 KB gz (actual 932);
  receiver freezes HT.challengeReceiver (writable:false,
  configurable:false); api-contract.js documents the surface;
  smoke harness exits 0; every quiz in packs.discovery.entries[]
  wires the receiver + ships compare.html + the -core.js declares
  its QUIZ_SLUG + gates the flow on getChallengeBlob; privacy default
  is blind (state.reveal === false at mount); aria-live='polite'
  announcement on load (a11y B2); banner text contains "Take the
  quiz blind"; bundle-size-gate.py lists both new module + css in
  SPEC_PAGE_CONDITIONAL_MODULES

## Story 10.10 — Result card chrome component (.discovery-card wrapper + on-page Share/Challenge)

- **verify:** `node scripts/_smoke_discovery_result.js` (39/39 PASS);
  `python scripts/dc/dc-14-result-card-actions.py` (86/86 PASS);
  `python scripts/dc/run-all.py` exits 0 with 15/15 green;
  `grep -r '\.disc-actions' tools/packs/discovery/` returns no hits
- **owner:** Story 10.10 author (2026-08-18 — closes AI-E10-2)
- **status:** done
- **files:** `assets/css/result-card.css` (added `.discovery-card`
  rule block + `.discovery-card .quiz-result-actions` + `.discovery-card
  .disc-actions` alias — additive layer on top of the existing
  `.quiz-result-card` chrome); `assets/js/results.js` (already emits
  `class="quiz-result-card discovery-card"` + action row with
  `data-action="share"` + `data-action="challenge"`; HT.results.wireActions
  auto-binds via microtask defer — no module change required); 10 quiz
  `<slug>-core.js` files at `tools/packs/discovery/{spirit-animal,
  future-partner, what-would-you-do, decision-style, friend-match,
  car-finder, fortune-cookie, time-traveler-therapist, dream-job,
  last-meal}/<slug>-core.js` (stripped per-quiz `function renderReveal(...)`
  + `function animateBars(...)`; replaced onComplete body with the
  canonical `HT.results.render({archetype, traits}, {slug, title,
  conflict, wireActions:true})` call; swapped Story 10.12 CTA query
  `.disc-actions` → `.quiz-result-actions`); 10 per-quiz `<slug>.css`
  files (removed the now-redundant `.disc-actions { ... }` rule block —
  layout now provided via the `.discovery-card .disc-actions` alias
  in result-card.css); `scripts/_adopt_results_render.js` (NEW —
  idempotent Node.js patcher using V8 parser for brace-walking; mirrors
  the SKIP/WROTE/FAIL semantics of `_wire_receiver_rollout.py`);
  `scripts/_smoke_discovery_result.js` (NEW — 39 vm-sandbox assertions
  covering CSS rules, HT.results surface freeze, card root attributes,
  action row shape, wireActions idempotence, click handlers invoking
  HT.share.copy + HT.challenge.link + HT.toast, shareUrl/copyText/
  imageSnapshot correctness); `scripts/dc/dc-14-result-card-actions.py`
  (NEW — AC for Story 10.10 close; 86 PASS covering CSS rule, results.js
  freeze, api-contract documentation, bundle-size-gate entries, smoke
  exit 0, per-quiz checks × 10, gzipped size budgets); `scripts/dc/
  dc-9-smokes.py` (smoke list extended 6 → 7); `scripts/dc/run-all.py`
  (DC-14 added, 14 → 15 stories)
- **api:** none new — Story 10.10 is a *consumer* of the canonical
  `HT.results.render(state, opts)` factory shipped by Story 10.3. AD-14
  boundary preserved (no module change; only quiz-side adoption +
  additive CSS rule).
- **ac:** every quiz in `packs.discovery.entries[]` calls
  `HT.results.render`; every quiz no longer defines a per-quiz
  `function renderReveal(...)`; every quiz no longer calls a per-quiz
  `animateBars(...)`; every quiz wires the Reset click + focuses it
  after `HT.results.render`; every quiz Story 10.12 CTA block queries
  `.quiz-result-actions` (not `.disc-actions`); every quiz `<slug>.css`
  no longer declares a `.disc-actions { ... }` rule block;
  `result-card.css` declares `.discovery-card` + `.discovery-card
  .quiz-result-actions` + `.discovery-card .disc-actions` rules;
  `assets/js/results.js` freezes `HT.results` (writable:false,
  configurable:false); `api-contract.js` documents `HT.results.render`;
  `bundle-size-gate.py` lists `assets/css/result-card.css` in
  `SPEC_PAGE_CONDITIONAL_MODULES`; smoke harness exits 0;
  `result-card.css` ≤ 4 KB gz (target ≤ 200 byte add); `results.js`
  ≤ 6 KB gz (no regression); `python scripts/dc/run-all.py` exits 0
  with 15/15 green (was 14/14); AI-E10-2 fully closes.

## Story 10.11 — Share card chrome (HT.share.copy)

- **verify:** `node scripts/_smoke_share_dialog.js` (54/54 PASS after
  Section X added for HT.share.copy); `python scripts/bundle-size-gate.py`
  exits 0 (share.js 5,882 gz, +268 over Story 10.10 baseline)
- **owner:** Story 10.11 author (2026-08-18)
- **status:** done
- **files:** `assets/js/share.js` (added `copy(state, opts)` Promise-returning
  helper that delegates to HT.copyToClipboard; version bumped 1.8.0 →
  1.9.0); `assets/js/api-contract.js` (HT.share.copy registered stable,
  contract 1.27.0 → 1.28.0); `scripts/_smoke_share_dialog.js` (5 new
  assertions for HT.share.copy; contract-entries check 10 → 11; version
  assertion 1.23.0 → 1.28.0)
- **api:** `HT.share.copy(state, opts) → Promise<string>` registered
  stable; frozen via Object.freeze; AD-14 boundary preserved (composes
  only on HT.copyToClipboard — no direct navigator.clipboard or
  document access)
- **ac:** returns a Promise on all three call paths (success / challenge-link /
  missing-arg); resolves with the copied text or rejects with Error;
  opts.shareUrl takes precedence (challenge-link verbatim); otherwise
  builds canonical /discovery/<slug>/?archetype=<archetype> URL;
  share.js remains under the 6 KB shell-side budget (5,882 gz); all
  11 HT.share.* entries registered in api-contract.js