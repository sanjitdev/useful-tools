---
title: '6-quiz MVP (Spirit Animal, Future Partner, What Would You Do, Decision Style, Friend Match, Car Finder)'
type: 'feature'
created: '2026-08-17'
baseline_commit: '240139713b479a5cc38e3dd0bb0c86c18c87494e'
status: 'in-progress'
review_loop_iteration: 0
context:
  - '_bmad-output/implementation-artifacts/epic-10-context.md'
  - 'project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Discovery Engine Sprint D opens the first consumer-facing surface — six personality / recommendation quizzes — but no `tools/packs/discovery/<slug>/` directory, no `packs.discovery.entries[]` in `tools.json`, and no quiz content exists on disk. Without these, the discovery lane on the home grid (Story 10.8) has nothing to render and the result-card chrome (Story 10.10) has no quiz shape to host.

**Approach:** Author six fully hand-written quizzes under `tools/packs/discovery/<slug>/` following the live working-tree layout (Story 10.6 + DC-6 gate authority). Each quiz ships its own `{index.html, <slug>-core.js, data.json}` triple. `data.json` carries the question list (3..30 items) and the `scoring-spec` that `HT.scoring.score(answers, spec)` consumes. The `<slug>-core.js` mounts `HT.quiz.open({questions: ...})` and wires a reveal handler that scores + renders the archetype. `tools.json → packs.discovery.entries[]` gains six new entries (length 6; DC-7's hard 10-entry check is deferred to a follow-up).

## Boundaries & Constraints

**Always:**
- Working-tree layout (`tools/packs/discovery/<slug>/{index.html, <slug>-core.js, data.json}`) is the authoritative contract — Story 10.6 + `scripts/dc/dc-6-quizzes.py` are the source of truth. The story doc's legacy `packs/disc/<slug>/{prompts,archetypes,scoring}.json` layout is NOT used.
- Each `<slug>-core.js` MUST call `HT.quiz.open({questions: ...})` (string-grep check in DC-6 gate #8).
- Each `data.json` MUST declare `questions[]` of length 3..30 AND `scoring-spec{traits[],weights{},archetypes[]}` (DC-6 gate checks #6, #7).
- Each `index.html` MUST be the canonical Handy Tools tool-page chrome: FOUC IIFE in first 1500 chars (AD-15), `<slug>-core.js` MUST be the LAST classic `<script src>` (DC-6 gate #4), canonical stylesheet chain (`../../assets/css/{base,components-core,tools}.css` + `../../assets/css/print.css media="print"` + `<slug>.css`), shell-header + skip-link + `<main class="shell-main">` + `<section id="quiz-mount">`.
- Scoring-spec shape MUST match `HT.scoring.score(answers, spec)` exactly (Story 10.2): `traits: ['id',...]`, `weights: {q1: {answer: {trait: delta}, ...}}` (nested trait deltas, NOT flat `{trait: weight}`), `archetypes: [{id, label, emoji, scores: {trait: 0..100}, default?: bool}, ...]`. Empty answers must yield the `default: true` archetype.
- PII lint clean: no emails, phones, IPs, or street addresses in any prompt, archetype label, blind-spot text, or share copy. (Per `scripts/check-disc-pii.py` once re-scoped to `tools/packs/discovery/`.)
- Archetype immutability lint clean: no `{{mustache}}` or `{user.x}` / `{answers.x}` placeholders in archetype text.
- No fetch / XHR / `localStorage` in `<slug>-core.js` (architectural contract — AD-1 "no I/O in tool pages"; mirrors `scripts/_smoke_scoring.js` #13. Note: `shell-bounds-check.py` walks `tools/<slug>/<slug>.js`, NOT `tools/packs/discovery/<slug>/<slug>-core.js`, so the gate is a vacuous PASS — the contract is honored manually). Hardcode `QUESTIONS` + `SCORING_SPEC` inline; ship `data.json` on disk only as forward-compat fodder for Story 10.6's loader + Story 10.10's result-card chrome.
- ES2018 vanilla, no third-party libs, no `import` statements (per AD-1, AD-12).
- Brownfield clean: existing 50 tool entries unchanged in `tools.json`.

**Ask First:**
- HALT if the user wants to ship more than 6 quizzes or fewer than 6 (gate + entries count is fixed at 6 by this story).
- HALT if the user wants to relax DC-7's hard `len(entries) == 10` check (that's a Story 10.6 / dc-7 follow-up — out of scope).
- HALT if archetype sets differ materially from the brainstorm catalog (e.g., replacing Fox/Wolf/Owl archetypes with brand-new ones — needs owner sign-off).

**Never:**
- Don't rewrite `scripts/dc/dc-6-quizzes.py` (the live gate is authoritative).
- Don't add a 7th–10th quiz in this story (DC-7 follow-up).
- Don't introduce new visual tokens / colors / fonts / spacing (per AD-18 chrome contract).
- Don't introduce modals, spinners, or any chrome beyond the inherited `HT.quiz` quiz shell + a simple reveal handler.
- Don't ship the legacy `packs/disc/<slug>/{prompts,archetypes,scoring}.json` layout alongside (one layout, not two).
- Don't touch existing tool pages' chrome.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | User opens `/packs/discovery/spirit-animal/`, answers 7 of 8 questions, clicks Next | `HT.quiz.open` renders question cards, scores via `HT.scoring.score(answers, spec)` on completion, reveals the closest archetype (e.g., 🦊 Fox), shows emoji + label + tagline + blind-spot + Reset/Share buttons. | N/A |
| EMPTY_ANSWERS | User skips every question, clicks Next through to reveal | Reveal panel renders the `default: true` archetype (e.g., 🐢 Turtle for spirit-animal), with all four trait bars at 0. | DC-1 guarantee: no throw. |
| UNKNOWN_VALUE | A future migration adds an answer value not in the spec's `weights` row | `HT.scoring.score` silently contributes zero (DC-1 check #11); reveal still renders. | No throw (DC-1 contract). |
| PARTIAL_ANSWERS | User answers 3 of 8 then closes tab; returns | Each quiz is a fresh page (no `storageKey` wired in this MVP — out of scope to Story 10.2 quiz resume UI); state resets. | N/A |
| MISSING_DATA | `<slug>-core.js` fails to fetch `data.json` (e.g., file:// on a browser blocking local JSON fetch) | Each `<slug>-core.js` inlines the questions + scoring-spec as a fallback constant so the quiz still mounts; logs to console.warn once. | Console-warn only; quiz still functions. |
| FOUC_THEME | User has dark theme stored; lands on `/packs/discovery/spirit-animal/` | FOUC IIFE applies `data-theme="dark"` before first paint (AD-15). | N/A. |
| PII_FALSE_POSITIVE | Quiz text contains a US-style 10-digit number | Quiz MUST avoid phone-shaped numbers in prompt text. If unavoidable, declare `pii-allowlist: ["<substring>"]` in `packs.discovery.entries[].pii-allowlist` (up to 3 per quiz). | PII gate exits 0. |

</frozen-after-approval>

## Code Map

- `tools/packs/discovery/<slug>/index.html` (×6 — NEW) — canonical Handy Tools tool-page chrome (FOUC IIFE, `<slug>-core.js` as last classic `<script src>`, `<section id="quiz-mount">`, skip-link, shell-header, shell-footer). Each page MUST include `<link rel="discovery-modules" data-modules="scoring,results,challenge">` so Story 10.6's loader fires.
- `tools/packs/discovery/<slug>/<slug>-core.js` (×6 — NEW) — inlines `QUESTIONS` + `SCORING_SPEC` constants verbatim from `data.json`. Mounts `HT.quiz.open({mount: '#quiz-mount', questions: QUESTIONS, onComplete: function(answers){ reveal(answers, HT.scoring.score(answers, SCORING_SPEC)); }})`. `reveal(answers, scored)` renders emoji + label + tagline + 4 trait bars + blind-spot + a single Reset button (Share/Print are Story 10.10/10.11 chrome — out of scope here). NO `localStorage` / `fetch` / `XHR` anywhere (architectural contract; see §Always).
- `tools/packs/discovery/<slug>/data.json` (×6 — NEW) — `{ questions: [...3..30 items], scoring-spec: { traits:[...], weights:{...}, archetypes:[...] } }`. Question spec matches `HT.quiz.open({questions: ...})` contract: `{id, label, prompt, options:[{value,label}]}` per item.
- `tools.json` (MODED) — add top-level `packs.discovery: { slug: "discovery", title: "Discover Me", description: "...", loader: "assets/js/packs/discovery.js", entries: [<6 entries>] }`. Each entry per the `quiz-entry` schema (line 321-378): `{ slug, title, description, category: "viral"|"utility"|"game", emoji, data: "./<slug>/data.json" (relative to the pack route directory per schema line 358; regex `^\.\.?/[a-zA-Z0-9._-]+\.json$`), ready: true, score: 8, modules: [{kind:"scoring", config:{trait-ids:["..."], default-archetype:"..."}}, {kind:"results", config:{variant:"archetype", trait-cap:4, show-contrarian:true}}, {kind:"challenge", config:{match-scorer:"jaccard", expiry-days:30, show-axis-bars:true}}] }`. Schema requires `loader` on `pack-entry` (line 274) and `config` per `module-def` (line 383); missing them makes `validate-tools-json.py` exit 1. Bump `releaseVersion`. Keep `tools` array of 50 unchanged. Category enum (line 347): Spirit Animal / Future Partner / What Would You Do / Decision Style / Friend Match → `viral`; Car Finder → `utility` (recommendation-shaped).
- `scripts/dc/dc-6-quizzes.py` — **read-only reference** (DC-6 gate). Asserts the 8-check bundle per quiz. Will pass with 6 entries (line 187-191: soft warning only when `len(slugs) != 10`).
- `scripts/dc/dc-7-tools-json.py` — **read-only reference** (DC-7 gate). Hard-fails on `len(entries) != 10` (line 53-56). Will FAIL with 6 entries — known follow-up gap, not introduced by this story.
- `scripts/dc/dc-12-lints.py` (Story 10.13) — currently scans `packs/disc/` (legacy path). PII + immutability checks need re-scoping to `tools/packs/discovery/` before this story's content is linted. Treat as a small known follow-up; gate contract for THIS story is "no PII-shaped text + no placeholder text in authored content".
- `assets/js/scoring.js` (Story 10.2) — frozen `HT.scoring.score(answers, spec) → {traits, archetype}`. Deterministic, pure, no I/O. Weights syntax: `{q1: {answerValue: {traitId: delta}}}` — nested trait deltas.
- `assets/js/quiz.js` (Story 9.12) — frozen `HT.quiz.open({mount, questions, onChange, onComplete, ...})`. Questions: `{id, label, prompt, options:[{value,label}], input?, min?, max?, step?, helpText?}`. Reveal handler receives the final answers.
- `tools/quiz-preview/quiz-preview.js` — reference impl for the reveal-panel DOM pattern (`buildReveal(answers)` → ul of `{label}: {display}` rows + Reset/Share/Print actions).
- `tools/json-formatter/index.html` — reference chrome snippet (FOUC IIFE + canonical stylesheet chain + `<a class="shell-skip">` + `<header class="site-header">` + main + footer).
- `assets/js/api-contract.js` (v1.27.0) — frozen public API surface. No new entries needed; `HT.scoring` + `HT.quiz` are registered.
- `assets/js/shell-thin.js` — TIER2_URLS already lists `scoring`, `results`, `challenge`. No new entries needed.

## Tasks & Acceptance

**Execution:**
- [ ] `tools/packs/discovery/spirit-animal/data.json` — author 8 questions, 4 traits (intuition, courage, wisdom, patience), 8 archetypes (🦊 Fox, 🐺 Wolf, 🦉 Owl, 🐢 Turtle, 🦅 Hawk, 🐻 Bear, 🦌 Deer, 🐉 Dragon). Each option contributes 1-3 nested trait deltas. Each archetype declares `scores: {trait: 0..100}`. Mark one as `default: true`.
- [ ] `tools/packs/discovery/spirit-animal/index.html` — canonical Handy Tools chrome + FOUC IIFE + `<link rel="discovery-modules" data-modules="scoring,results,challenge">` + `<section id="quiz-mount">` + `<link rel="stylesheet" href="./spirit-animal.css">`.
- [ ] `tools/packs/discovery/spirit-animal/spirit-animal-core.js` — inlines `QUESTIONS` (8 items) + `SCORING_SPEC` (`{traits:['intuition','courage','wisdom','patience'], weights:{...}, archetypes:[...8 entries with `scores:{trait:0..100}`, exactly one with `default:true`], ...}`) constants. Calls `HT.quiz.open({mount:'#quiz-mount', questions: QUESTIONS, onComplete: function(answers){ reveal(answers, HT.scoring.score(answers, SCORING_SPEC)); }})`. `reveal(answers, scored)` renders emoji + label + tagline + 4 trait bars + blind-spot box + a Reset button (no Share/Print — Story 10.10/10.11). NO fetch / XHR / localStorage.
- [ ] `tools/packs/discovery/spirit-animal/spirit-animal.css` — minimal tool-specific CSS (reveal-panel grid + trait-bar animation under `@media (prefers-reduced-motion: no-preference)` + print rules).
- [ ] `tools/packs/discovery/future-partner/data.json` — author 10 questions, 5 traits (warmth, ambition, humor, loyalty, curiosity), 6 archetypes.
- [ ] `tools/packs/discovery/future-partner/index.html` — same chrome pattern as spirit-animal, slugs swapped.
- [ ] `tools/packs/discovery/future-partner/future-partner-core.js` — same pattern; call `HT.scoring.score(answers, spec)`; render reveal.
- [ ] `tools/packs/discovery/future-partner/future-partner.css` — minimal.
- [ ] `tools/packs/discovery/what-would-you-do/data.json` — 8 questions, 4 traits, 4 archetypes (Bold, Cautious, Curious, Compassionate).
- [ ] `tools/packs/discovery/what-would-you-do/index.html` + `what-would-you-do-core.js` + `what-would-you-do.css`.
- [ ] `tools/packs/discovery/decision-style/data.json` — 7 questions, 4 traits, 5 archetypes (Intuitive, Analytical, Collaborative, Spontaneous, Deliberative).
- [ ] `tools/packs/discovery/decision-style/index.html` + `decision-style-core.js` + `decision-style.css`.
- [ ] `tools/packs/discovery/friend-match/data.json` — 9 questions, 4 traits, 6 archetypes.
- [ ] `tools/packs/discovery/friend-match/index.html` + `friend-match-core.js` + `friend-match.css`.
- [ ] `tools/packs/discovery/car-finder/data.json` — 12 questions, 5 traits, 8 archetypes (Commuter, Family Hauler, Road-Tripper, Eco-Conscious, Budget-First, Tech-Lover, Adventure-Ready, Luxury-Comfort).
- [ ] `tools/packs/discovery/car-finder/index.html` + `car-finder-core.js` + `car-finder.css`.
- [ ] `tools.json` — add top-level `packs.discovery: { slug:"discovery", title:"Discover Me", description:"...", loader:"assets/js/packs/discovery.js", entries:[<6 entries per `quiz-entry` schema; each carries `category` (5 viral + 1 utility for car-finder), `data:"./<slug>/data.json"`, `modules:[scoring/archetype-default, results/archetype/trait-cap-4, challenge/jaccard/30d]`, `ready:true`, `score:8`>] }`. Bump `releaseVersion` to current.
- [ ] `_bmad-output/implementation-artifacts/sprint-status.yaml` — set `10-7-6-quiz-mvp-spirit-animal-future-partner-etc: done` with completion note + commit hash.

**Acceptance Criteria:**
- Given the DC-6 gate, when `python scripts/dc/dc-6-quizzes.py` is run, then it reports 6 quizzes × 8 checks = ~48 PASS (the soft warning at line 187-191 fires for `len(slugs) != 10` but no FAILs).
- Given a fresh tab on `/packs/discovery/spirit-animal/`, when the user answers 8 questions and clicks Next, then the reveal panel renders the closest archetype with the correct emoji + label + 4 trait bars + blind-spot text + a single Reset button (no Share/Print — deferred to Story 10.10/10.11), scoring via `HT.scoring.score(answers, spec)`.
- Given any quiz, when the user skips every question, then the reveal renders the `default: true` archetype with all trait bars at 0 (no throw — DC-1 check #11 guarantee).
- Given any quiz's data.json, when parsed, then `questions` is an array of length 3..30 AND `scoring-spec` declares `traits[]` (array), `weights{}` (object), `archetypes[]` (array with ≥ 1 entry carrying `default: true`).
- Given any `<slug>-core.js`, when string-grepped, then it contains the literal substring `HT.quiz.open(`.
- Given any quiz's `index.html`, when parsed, then it contains a FOUC IIFE in the first 1500 chars referencing `ht.theme` AND `localStorage.getItem` (or `HT.storage`).
- Given any `<slug>-core.js`, when grepped for forbidden patterns, then it contains zero occurrences of `localStorage`, `fetch(`, `XMLHttpRequest`, or `navigator.clipboard.writeText` (architectural contract per §Always; `shell-bounds-check.py` does not scan discovery files — vacuous PASS for the gate, but the contract is honored manually).
- Given `tools.json`, when parsed by `validate-tools-json.py`, then it exits 0 against `tools.schema.json` and the existing 50 tool entries are unchanged. The new `packs.discovery` block carries `loader: "assets/js/packs/discovery.js"` and every entry's `modules[]` declares `{kind, config}` per the `module-def` schema (results needs `variant`; challenge needs `match-scorer`).
- Given the PII lint (after re-scope to `tools/packs/discovery/`), when run on all six `data.json` files + reveal copy, then zero matches for email / phone / IPv4 / street-address regexes (manual review contract until the lint re-scope lands as a Story 10.6 follow-up).
- Given the archetype immutability lint, when run on all six `data.json` files, then zero matches for `{{mustache}}` or `{user.x}` / `{answers.x}` placeholders (manual review contract until the lint re-scope lands).
- Given any quiz's reveal panel, when a `prefers-reduced-motion: reduce` user views it, then trait bars render instantly (no animation); when the user prints the page, then the reveal panel is the only visible content (quiz chrome hidden via `@media print`).

## Spec Change Log

- **2026-08-17 — parallel-agent review pass.** Triggered by: PRD-completeness + gates/automation review surfaced 3 HIGH schema-conformance issues + 3 MED/MED/MED contradictions + 4 LOW polish items. Amended: (1) `packs.discovery` block now declares `loader: "assets/js/packs/discovery.js"` (schema `pack-entry.required` includes `loader`). (2) `modules[]` entries now each carry `{kind, config}` with config matching `results-config.variant ∈ {archetype|ranking|compatibility|score-only}` and `challenge-config.match-scorer ∈ {exact|jaccard|weighted|scoring-diff}`. (3) `data` path corrected to `./<slug>/data.json` (relative to pack route dir per schema regex `^\.\.?/[a-zA-Z0-9._-]+\.json$`). (4) Hardcode-vs-fetch contradiction resolved: QUESTIONS + SCORING_SPEC hardcoded inline in core.js; `data.json` shipped on disk only as forward-compat fodder. (5) Reveal panel scope narrowed to Reset-only (Share/Print deferred to Story 10.10/10.11). (6) `category` enum pinned: 5 quizzes = `viral`; car-finder = `utility`. (7) `shell-bounds-check.py` vacuous-PASS for discovery files clarified; architectural contract preserved manually. (8) `scripts/regression-sweep.py` reference removed from Verification (file does not exist); replaced with manual `grep -rE`. (9) PII + immutability lints clarified as vacuous-pass until re-scope lands. KEEP: `data.json` on disk (forward-compat for Story 10.6 loader / 10.10 chrome); DC-6 check #4 + #5 + #6 + #7 + #8 contract language; the 6-quiz list per story doc; working-tree layout over legacy doc layout.

## Design Notes

**Layout choice rationale (working-tree over story-doc):** The story doc describes `packs/disc/<slug>/{prompts,archetypes,scoring}.json}` — three separate JSONs. The working tree (Story 10.6 + dc-6-quizzes.py + dc-7-tools-json.py + tools.schema.json's `packs.discovery` half) converged on `tools/packs/discovery/<slug>/{index.html, <slug>-core.js, data.json}` — single data.json with `{questions[], scoring-spec}`. Authoring to the story doc would require rewriting 4 files; authoring to the working tree is purely additive. The user confirmed working-tree is authoritative.

**Why hardcode QUESTIONS + SCORING_SPEC in core.js (vs fetch data.json):** The shell-bounds gate (`scripts/shell-bounds-check.py`) bans `fetch(` in `<slug>-core.js`. Two options: (a) hardcode both, ship `data.json` for forward-compat with Story 10.6's loader + Story 10.10's result-card chrome (which may need to re-fetch), or (b) add a `// shell-bounds-check: allow data.json` comment + a single fetch. Hardcoding is simpler, ships zero fetch debt, and keeps `<slug>-core.js` 100% deterministic on `file://` (per AD-1). `data.json` remains on disk for the future loader/chrome.

**Why 6 quizzes (vs the gate's 10):** The story doc says 6 (Spirit Animal, Future Partner, What Would You Do, Decision Style, Friend Match, Car Finder). DC-7's hard `len(entries) == 10` check fails with 6 — that's a known Story 10.6 / dc-7 follow-up, not a Story 10.7 deliverable. DC-6's per-quiz gate emits a soft warning and still PASSes per-quiz with 6.

**Reveal-panel UX (this story ships Reset only):** emoji + label + tagline + 4 trait bars + blind-spot box + a single Reset button (no Share/Print — those land in Stories 10.10 result-card chrome + 10.11 share-card chrome; Share will route through `HT.share.open(slug)` via the inherited Shell share dialog, never via direct `navigator.clipboard.writeText`). Trait bars use CSS `@keyframes` only when `prefers-reduced-motion: no-preference`. Print stylesheet hides the skip-link / shell-header / shell-footer and prints just the reveal panel (this print rule ships today; Share/Print buttons are not yet present so they don't conflict).

**Why no `storageKey`:** Quiz resume UI is Story 9.12.2 territory (`HT.quiz.open({storageKey, ...})` exists, but wiring it to discovery quizzes is out of scope; the user re-takes the quiz if they navigate away). State-persistence is the Challenge URL's job (Story 10.4).

## Verification

**Commands:**
- `python scripts/dc/dc-6-quizzes.py` — expected: 6 quizzes × 8 checks = ~48 PASS + 1 soft warning (`expected 10 quiz slugs, found 6`).
- `python scripts/dc/dc-7-tools-json.py` — expected: 1 FAIL on `len(entries) == 10` (known follow-up; documented in Story 10.6 / DC-7 backlog). NOT a regression introduced by this story.
- `python scripts/validate-tools-json.py` — expected: exit 0 (50 tools + 6 discovery entries validate against schema, including `loader` on `pack-entry` and `config` on every `module-def`).
- `python scripts/shell-bounds-check.py` — expected: vacuous PASS for discovery files (gate walks `tools/<slug>/<slug>.js`, not `tools/packs/discovery/<slug>/<slug>-core.js`). Architectural contract honored manually: zero `localStorage` / `fetch(` / `XMLHttpRequest` / `navigator.clipboard.writeText` in any discovery `<slug>-core.js`. Manual grep: `grep -rE 'localStorage|fetch\(|XMLHttpRequest|navigator\.clipboard' tools/packs/discovery/`.
- `python scripts/check-disc-pii.py` (after re-scope to `tools/packs/discovery/`) — expected: zero PII matches across all 6 `data.json` files. **Until re-scope lands, this is a vacuous pass; the authored content is PII-clean by construction.**
- `python scripts/check-archetype-immutability.py` (after re-scope) — expected: zero placeholder matches. **Same vacuous-pass caveat.**
- `python scripts/dc/dc-12-lints.py` (Story 10.13 gate) — expected: pass on legacy `packs/disc/` (still empty) — vacuous-pass guard handles it.
- `python scripts/pack-gate.py` (if exists) — expected: no regressions on existing 5 packs.

**Manual checks (if no CLI):**
- Open `/packs/discovery/spirit-animal/` in a fresh tab; verify the FOUC IIFE applies dark/light theme before first paint.
- Answer 8 of 8 questions; verify the reveal panel renders the expected archetype with the correct emoji + label + 4 trait bars + blind-spot text.
- Click Skip on every question; verify the reveal renders the `default: true` archetype with all trait bars at 0.
- Toggle `prefers-reduced-motion: reduce` in DevTools; verify trait bars render instantly with no animation.
- Open print preview; verify only the reveal panel renders (chrome hidden).
- Open `/packs/discovery/future-partner/`, `/packs/discovery/what-would-you-do/`, etc.; verify all six quizzes mount and score correctly.