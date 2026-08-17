# Discovery Engine — Proposed Future Tasks

Sibling to `brainstorm-intent.md`. Each task here is a **single Story**. Numbering follows the new Epic 10 (currently a slot; populated downstream by bmad-method cascade). Triage by your call; the proposed order is the recommended ship order.

The "AC gate" column names the matching `scripts/dc/dc-N-*.py` script for any task that has a 1-to-1 mapping with the working-tree DC scaffold. Some tasks are new and will need their own gates created during the story implementation.

---

## Story 10.1 — Discovery pack schema (`packs`)

**Slug:** N/A (schema-level)
**Files modified:**
- `tools.schema.json` — finalize the `packs` / `pack-entry` / `quiz-entry` / `module-def` discriminated union landed by the DC-0 scaffold. Add stability annotation per AD-14.
- `scripts/validate-tools-json.py` — ensure `allOf + if/then` walks the discriminated union (already in the DC-0 scaffold; verify).

**AC:**
1. `tools.schema.json` validates against the JSON Schema draft-07 spec.
2. The `packs` object accepts arbitrary pack keys (not just `discovery`).
3. The `quiz-entry.modules[]` discriminated union narrows `config` correctly per `kind` (scoring → scoring-config, results → results-config, etc.).
4. `additionalProperties: false` on every entry to prevent schema creep.
5. AC gate: `make dc-0-schema` exits 0.

**Estimated effort:** S (½ day; scaffold already in working tree).

---

## Story 10.2 — HT.scoring engine (trait scorer)

**Slug:** N/A (shell module)
**Files added:** `assets/js/scoring.js` (already in working tree)
**Files modified:** `assets/js/api-contract.js` (already bumped to 1.24.0), `assets/js/shell-thin.js` (TIER2 wiring already in place), `scripts/bundle-size-gate.py` (already in SPEC_PAGE_CONDITIONAL_MODULES), `docs/shell-public-api.md` (entry already added).

**AC:**
1. `HT.scoring.score(answers, spec) → {traits, archetype}` returns trait scores clamped to [0, 100].
2. Skipped questions (`answers[id] === undefined`) contribute zero weight.
3. Unknown answer values are silently ignored — no throw.
4. Empty answers yields `spec.archetypes[*].default`.
5. Archetype resolution is deterministic (L1 distance, ties broken by default-flag → index → id).
6. Bundle size ≤ 4 KB gzipped.
7. No DOM / storage / fetch / XHR / `HT.provide` references (shell-bounds).
8. AC gate: `make dc-1-scoring` exits 0 (15 checks).

**Estimated effort:** XS (already mostly done in working tree; close out the gate).

---

## Story 10.3 — HT.results (result-card renderer)

**Slug:** N/A (shell module)
**Files added:** `assets/js/results.js`, `assets/css/result-card.css` (per bundle-size-gate entries; not yet on disk).
**Files modified:** `assets/js/api-contract.js`, `assets/js/shell-thin.js`, `scripts/bundle-size-gate.py` (entry already added).

**AC:**
1. `HT.results.render(mount, result, variant)` mounts a result card into the host element.
2. Supports 4 variants: `archetype`, `ranking`, `compatibility`, `score-only` (per `definitions.results-config.variant` enum).
3. Shows trait bars capped at `trait-cap` (default 4); overflow summarized in a single line.
4. Renders the "blind spot" / contradiction line (mandatory for personality quizzes).
5. Renders Share and Challenge buttons (Challenge only if `result.config.modules.challenge` exists).
6. Respects `prefers-reduced-motion` — animations disabled, swaps are instant.
7. Smoke covers the 4 variants + reduced-motion branch.
8. AC gate: `make dc-2-results` exits 0.

**Estimated effort:** M (2 days).

---

## Story 10.4 — HT.challenge (Challenge-a-Friend protocol)

**Slug:** N/A (shell module)
**Files added:** `assets/js/challenge.js`.
**Files modified:** `api-contract.js`, `shell-thin.js`, `bundle-size-gate.py`.

**AC:**
1. `HT.challenge.encode(answersHash, quizSlug) → string` produces a deterministic URL fragment ≤ 80 chars.
2. `HT.challenge.decode(urlFragment) → {answersHash, quizSlug}` parses a challenge URL on landing.
3. `HT.challenge.compare(myResult, theirAnswersHash, spec) → {compatibility, agree[], disagree[], blindSpot}` runs after the second user completes the quiz.
4. URL is fragment-state only (per AD-5) — never a query string, never sent to a server.
5. Smoke covers both asymmetric paths (sender / receiver).
6. AC gate: `make dc-3-challenge` exits 0.

**Estimated effort:** M (2 days).

---

## Story 10.5 — HT.recommend (recommendation engine)

**Slug:** N/A (shell module)
**Files added:** `assets/js/recommend.js`.
**Files modified:** `api-contract.js`, `shell-thin.js`, `bundle-size-gate.py`.

**AC:**
1. `HT.recommend.rank(scoredTraits, catalog, criteria) → Result[]` ranks catalog entries by trait match.
2. Supports both weighted-criteria (Car Finder style) and nearest-neighbor (Spirit Animal style) modes.
3. `HT.recommend.match(myResult, theirResult) → {compatibility, reason}` produces a comparison card for viral sharing.
4. Catalog items can declare `domain` (e.g. `catalog-config.domain = "cars"`) and the engine enforces domain-aware ranking.
5. Smoke covers both modes + empty catalog + tie-breaking.
6. AC gate: `make dc-4-recommend` exits 0.

**Estimated effort:** M (2 days).

---

## Story 10.6 — discovery-loader.js (pack bootstrap)

**Slug:** N/A (shell module; pack-route loader)
**Files added:** `assets/js/packs/discovery-loader.js`, `assets/css/discovery.css`.
**Files modified:** `api-contract.js`, `shell-thin.js`, `bundle-size-gate.py`.

**AC:**
1. On first navigation to a `/packs/discovery/<quiz>/` route, the shell-thin Proxy factory loads `discovery-loader.js`.
2. Loader resolves `./data.json` (relative to the page), validates it against the schema, and mounts the chosen modules.
3. Does NOT eagerly load any of the 5 modules; each is loaded on first call into that module's API.
4. Total loader JS ≤ 2 KB gzipped; CSS ≤ 3 KB gzipped.
5. Does not use react / vue / svelte / htm (no third-party libs per AD-1).
6. Smoke covers the lazy-load sequence and the validation step.
7. AC gate: `make dc-5-loader` exits 0.

**Estimated effort:** S (1 day).

---

## Story 10.7 — First quiz: What Kind of Person Are You, Really?

**Slug:** `personality`
**Route:** `tools/packs/discovery/personality/index.html`
**Files added:** `tools/packs/discovery/personality/index.html`, `tools/packs/discovery/personality/data.json`, `tools/packs/discovery/personality/personality.js`, `tools/packs/discovery/personality/personality.css`.
**Files modified:** `tools.json` (entry in `packs.discovery.entries[]`), `tools.schema.json` (no new defs).

**AC:**
1. 12 situational questions; 5 traits; 8 archetypes.
2. Modules: `[scoring, results, challenge]`.
3. Reveal animation follows the chrome spec (share button above the fold on 360×640).
4. Challenge URL round-trips; archetype immutability enforced.
5. "Tools for you" section at the bottom of the result card surfaces 2-3 existing tools (focus timer, savings, etc.).
6. `make quiz-smoke` for the smoking test exits 0; gate `dc-6-quizzes` counts this quiz as one of the 6 MVP catalog entries.
7. Score ≥ 8 against the 10-criterion rubric.

**Estimated effort:** M (3 days — content authoring is the bottleneck).

---

## Story 10.8 — Quiz #2: What Would Your Future Partner Be Like?

**Slug:** `future-partner`
**Route:** `tools/packs/discovery/future-partner/index.html`

**AC:**
1. 10 questions; 7 traits; 8 archetypes (calm builder, social connector, etc.).
2. Modules: `[scoring, results, challenge]`.
3. Includes the "send to a friend to see if you agree" copy in the reveal.
4. Score ≥ 8.

**Estimated effort:** M (3 days).

---

## Story 10.9 — Quiz #3: What Would You Do? — Real Life Situations

**Slug:** `decisions`
**Route:** `tools/packs/discovery/decisions/index.html`

**AC:**
1. 12 dilemmas; 5 traits (under-pressure, conflict, risk, empathy, loyalty); 6 archetypes.
2. Modules: `[scoring, results]`.
3. Profile includes "biggest strength" + "blind spot" line.
4. Score ≥ 8.

**Estimated effort:** M (3 days).

---

## Story 10.10 — Quiz #4: What Is Your Spirit Animal?

**Slug:** `spirit-animal`
**Route:** `tools/packs/discovery/spirit-animal/index.html`

**AC:**
1. 10 questions; 5 traits; 8 animals (Wolf, Eagle, Octopus, Fox, Elephant, Dolphin, Panther, Owl — brainstorm catalog).
2. Modules: `[scoring, results]`.
3. Visually distinctive card (large emoji, archetype name in serif display type).
4. Score ≥ 8.

**Estimated effort:** S (1 day — content-only).

---

## Story 10.11 — Quiz #5: What Kind of Friend Are You?

**Slug:** `friend`
**Route:** `tools/packs/discovery/friend/index.html`

**AC:**
1. 12 questions; 6 traits; 8 archetypes (Protector, Chaos Agent, etc.).
2. Modules: `[scoring, results, challenge]`.
3. **This is the seed for the Challenge-a-Friend feature** — friendship compatibility card is the MVP.
4. Score ≥ 8.

**Estimated effort:** M (3 days).

---

## Story 10.12 — Quiz #6: Which Car Is Right for You?

**Slug:** `car-finder`
**Route:** `tools/packs/discovery/car-finder/index.html`

**AC:**
1. 8 questions (budget, usage, passengers, fuel-vs-performance, new-vs-used, weekly mileage, comfort-vs-handling, ownership-horizon); 6 traits; 12-result catalog (hand-curated, no external data).
2. Modules: `[scoring, results, catalog]`.
3. Each result row: match %, top 3 traits, "why you match" / "why you don't" lines, 3 alternatives.
4. "Tools for you" surfaces the existing loan calculator + budget planner.
5. Score ≥ 8.

**Estimated effort:** L (5 days — content authoring is heavy; car-catalog data must be hand-curated).

---

## Story 10.13 — tools.json registration of the discovery pack

**Slug:** N/A (config-level)
**Files modified:** `tools.json`, `tools.schema.json` (no new defs; existing entries are enough), `scripts/pack-gate.py` (new validator).

**AC:**
1. `packs.discovery.entries.length === 6` (the 6 MVP quizzes).
2. Every entry's slug matches the kebab regex; unique across the catalog.
3. Every entry declares `scoring` + `results` modules; viral quizzes also declare `challenge`; utility quizzes declare `catalog`.
4. Every entry's `data` path resolves to a real `data.json` on disk.
5. `releaseVersion` bumped from `0.0.0`.
6. The 50 pre-existing tool entries are unchanged.
7. `scripts/pack-gate.py` (new gate, separate from `tool-contract-gate.py`) exits 0.
8. AC gate: `make dc-7-tools-json` exits 0 (14 checks).

**Estimated effort:** S (1 day).

---

## Story 10.14 — discover-lane rendering (Home grid)

**Slug:** N/A (chrome-level)
**Files modified:** `index.html`, `assets/js/layout.js`, `assets/css/components.css`.

**AC:**
1. Home grid renders a "Discover Me" lane as the 6th lane (after the 5 utility packs).
2. Lane renders via the existing pack-page renderer (Story 6.2); no new chrome layer.
3. Quiz cards show: archetype emoji (placeholder until OG per quiz ships) + title + "12 questions · 2 min".
4. Reduced-motion respected; keyboard-complete in ≤ 90 s.
5. Score ≥ 8 against the 10-criterion rubric.

**Estimated effort:** S (1 day).

---

## Story 10.15 — Discover docs

**Slug:** N/A (docs-level)
**Files added:** `docs/discovery-platform.md` (architecture narrative), `docs/discovery-quiz-authoring.md` (authoring guide for new quiz packs).

**AC:**
1. `docs/discovery-platform.md` covers AD-16..19, the 4 module kinds, the Challenge URL protocol, and the content-build pipeline.
2. `docs/discovery-quiz-authoring.md` shows: a minimal `data.json` shape, the trait/archetype contract, the PII lint pattern, the OG image-bake checklist.
3. `make dc-8-docs` exits 0.

**Estimated effort:** XS (½ day).

---

## Story 10.16 — Comprehensive smoke harness

**Slug:** N/A (smoke-level)
**Files added:** `scripts/_smoke_discovery_smokes.js`, smoke updates for each quiz.

**AC:**
1. One smoke per quiz (6 smokes; each ~30 assertions).
2. Cross-pack smoke covers: scoring consistency, results chrome, challenge URL encode/decode round-trip.
3. Shell-bounds + bundle-size + reduced-motion all checked.
4. `make dc-9-smokes` exits 0.

**Estimated effort:** S (1 day).

---

## Story 10.17 — pack-gate.py runtime validator

**Slug:** N/A (CI-level)
**Files added:** `scripts/pack-gate.py`.

**AC:**
1. Reads `tools.json`; for every `packs.<name>.entries[]`, asserts:
   - `slug` is kebab-case, unique;
   - `modules[]` declares the canonical kinds per `category`;
   - `data` path resolves to a real `data.json` on disk;
   - `data.json` validates against `definitions.quiz-entry` schema;
   - `data.json` declares `traits` matching `scoring-config.trait-ids` (cross-check);
   - archetypes in `data.json` are content-addressed (e.g. `v1.personality.wolf`).
2. Exits 1 if any check fails; 0 otherwise.
3. Independent of `tool-contract-gate.py` (does not affect the 50 existing tools).
4. Smoke covers: missing data.json, malformed module-def, mismatched trait-ids, duplicate slugs.
5. `make dc-10-pack-gate` exits 0.

**Estimated effort:** S (1 day).

---

## Story 10.18 — Bundle-size compliance

**Slug:** N/A (CI-level)
**Files modified:** `scripts/bundle-size-gate.py` (already has the per-module entries; ensure budgets per quiz ≤ 4 KB gz additional).

**AC:**
1. `assets/js/{scoring,results,challenge,recommend,catalog}.js` each ≤ 4 KB gz.
2. `assets/js/packs/discovery-loader.js` ≤ 2 KB gz.
3. `tools/packs/discovery/<quiz>/<quiz>.js` per quiz ≤ 6 KB gz.
4. Per-quiz `data.json` ≤ 12 KB raw.
5. `make dc-11-bundle` exits 0.

**Estimated effort:** XS (½ day).

---

## Story 10.19 — Epic 10 retrospective

**Slug:** N/A (process-level)
**Files added:** `_bmad-output/implementation-artifacts/epic-10-retro-2026-XX.md` (date TBD).

**AC:**
1. Follow `bmad-retrospective` workflow (full multi-agent dialogue format).
2. Cover the 18 stories shipped.
3. Action items land in `sprint-status.yaml` for Epic 11+ carry-over.
4. `make dc-12-retro` exits 0 once all 18 prior gates are GREEN.

**Estimated effort:** XS (½ day; runs last).

---

## Decisions (resolved 2026-08-17)

1. **Six quizzes in MVP**, not 10. The four deferred (Bike Finder, Career Fit, Millionaire Personality, Hidden Personality) depend on content libraries that we'd have to hand-curate; defer to v2.
2. **Spirit Animal uses generic emoji + serif display type**, not a custom illustration set. Stays within AD-1 (no external assets).
3. **No analytics on the Discovery Engine.** Per AD-9 / AD-12. Measure virality by GitHub traffic + social mentions (manual, qualitative).
4. **No "leaderboard" / "top archetype this week" surface** — privacy risk and zero-data risk under AD-9.
5. **The "Discover Me" lane is a sibling**, not a new topbar tab. Honors AD-4 (don't add chrome).

## Story 10.1 — APPROVED TO START

(See brainstorm-intent.md "Recommended next steps" — `bmad-product-brief` first, then bmad-method cascade.)
