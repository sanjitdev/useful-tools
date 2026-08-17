---
name: Handy Tools — Discovery Engine
type: architecture-spine
purpose: feature-extension
altitude: feature
paradigm: Shell-and-Tool with Embedded Modules (with Pack Runtime)
scope: Discovery Engine (Epic 10) — 6 quizzes, 5 Shell modules, Challenge-a-Friend protocol, Discover Me lane
status: final
created: 2026-08-17
updated: 2026-08-17
binds:
  - FR-22 Discovery Pack Schema
  - FR-23 Trait Scoring Engine
  - FR-24 Result Card Renderer
  - FR-25 Challenge-a-Friend Protocol
  - FR-26 Quiz Catalog (6 MVP)
  - FR-27 Recommendation Catalog
  - FR-28 Discover Me Lane
  - FR-29 Share Card Generation
  - FR-30 Challenge Link Distribution
  - FR-31 PII Lint on Quiz Content
  - FR-32 Archetype Immutability
  - FR-33 Trust Surface for Discovery
  - NFR-11..14 (Discovery-specific NFRs)
inherits:
  - AD-1 Zero runtime third-party libraries
  - AD-2 Tool Contract is the unit of inclusion
  - AD-3 Site Data is the single source of truth for discovery
  - AD-4 Shell owns global concerns; Tools own local concerns
  - AD-5 URL is canonical state
  - AD-6 History and preferences are local-only, namespaced
  - AD-7 Embed mode is a Shell flag, not a separate app
  - AD-9 No PII (assumed — see AD-15 extension)
  - AD-12 ES2018 vanilla, no build step
  - AD-14 Shell Public API is stable
  - AD-15 Brownfield rule (50 existing tools unchanged)
sources:
  - ../../prds/prd-discovery-engine-2026-08-17/prd.md
  - ../../brainstorming/brainstorm-discovery-engine-2026-08-17/brainstorm-intent.md
  - ../../brainstorming/brainstorm-discovery-engine-2026-08-17/discovery-engine-future-tasks.md
  - ../architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md
  - ../../ux-designs/ux-useful-tools-2026-07-31/EXPERIENCE.md
companions:
  - ../../ux-designs/ux-discovery-engine-2026-08-17/DESIGN.md
  - ../../ux-designs/ux-discovery-engine-2026-08-17/EXPERIENCE.md
  - ../../ux-designs/ux-discovery-engine-2026-08-17/review-rubric.md
  - ../../ux-designs/ux-discovery-engine-2026-08-17/review-accessibility.md
---

# Architecture Spine — Discovery Engine

## Design Paradigm (inherited)

The Discovery Engine extends the existing **Shell-and-Tool with Embedded Modules** paradigm. The site is one persistent Shell that hosts independent Tools via a contract. **A pack is a presentation surface** (a route + a grid filter on Site Data) — not a runtime boundary. The Discovery Engine is a *pack* — it inherits the existing paradigm without changing it.

What changes is the **pack runtime**. The existing 5 utility packs have only one module shape per tool (`tools/<slug>/<slug>.js` + `<slug>.css`). The Discovery pack introduces a tiered module system with a **2nd-tier lazy-loaded runtime** that the utility packs do not have. This is the load-bearing deviation.

```
/               → Shell (root index)
/packs/<slug>   → Pack page (Shell + filtered Site Data) — Discovery pack renders here
/packs/discovery/<quiz>/ → Discovery pack route (NEW)
                 → loads discovery-loader.js (NEW)
                   → loads data.json (NEW — schema-validated)
                     → loads HT.scoring, HT.results, HT.challenge, HT.recommend, HT.catalog
                       → mounts the quiz chrome
/tools/<slug>/  → 50 existing utility tools (UNCHANGED per AD-15)
/assets/js/     → Shell modules + Discovery modules (HT.scoring, HT.results, HT.challenge, HT.recommend, HT.catalog, packs/discovery-loader.js)
```

## Module Inventory (the 5+1)

The Discovery Engine adds 6 new modules, all page-conditional via the shell-thin Proxy factory (per AD-14). The "1" is the pack loader; the "5" are the runtime modules.

| Module | URL | Loaded by | Size budget | Side effects |
|---|---|---|---|---|
| `packs/discovery-loader.js` | `assets/js/packs/discovery-loader.js` | Shell-thin Proxy on first navigation into `/packs/discovery/<quiz>/` | ≤ 2 KB gz | Reads `data.json`, validates against schema, hands off to the 5 modules |
| `scoring.js` | `assets/js/scoring.js` | Proxy on first `HT.scoring.score()` | ≤ 4 KB gz | Pure function; no DOM / storage / fetch |
| `results.js` | `assets/js/results.js` | Proxy on first `HT.results.render()` | ≤ 4 KB gz | DOM-only; writes to the host element |
| `challenge.js` | `assets/js/challenge.js` | Proxy on first `HT.challenge.encode()` | ≤ 4 KB gz | URL fragment encode/decode; pure function |
| `recommend.js` | `assets/js/recommend.js` | Proxy on first `HT.recommend.rank()` | ≤ 4 KB gz | Pure function; no DOM |
| `catalog.js` | `assets/js/catalog.js` | Proxy on first `HT.catalog.load()` | ≤ 4 KB gz | Reads `data.json`; cached after first load |

Total Discovery runtime: **≤ 22 KB gzipped** (loader + 5 modules). Complies with NFR-11.

## Namespace and Route Conventions

- **Pack route**: `tools/packs/discovery/<quiz-slug>/index.html` (per the schema's `quiz-entry.slug` docs).
- **Loader asset**: `assets/js/packs/discovery-loader.js` (per bundle-size-gate and DC-5).
- **Quiz data**: `tools/packs/discovery/<quiz-slug>/data.json` (per `quiz-entry.data` field, which is `./data.json` relative to the page).
- **OG image**: `tools/packs/discovery/<quiz-slug>/og/<archetype-id>.svg` (static, pre-baked at content-build time).
- **Per-quiz JS**: `tools/packs/discovery/<quiz-slug>/<quiz-slug>.js` (≤ 6 KB gz; mounts the 5 modules).
- **Per-quiz CSS**: `tools/packs/discovery/<quiz-slug>/<quiz-slug>.css` (≤ 4 KB gz).

## New Architecture Decisions (AD-16 through AD-19)

### AD-16 — Discovery pack is a sibling of `tools`, not a sub-tree

- **Binds:** FR-22, FR-4 (Site Data Schema), AD-3
- **Prevents:** the existing 50 utility tools being deprecated or merged into a new categorization; or the home-grid key changing
- **Rule:** `tools.json` gains a top-level `packs` object, *sibling* of `tools`. The 50 existing tool entries are unchanged. Adding a pack requires only an entry in `packs`. The home grid renders a "Discover Me" lane via the existing pack-page renderer (Story 6.2). The Shell Reserve picks up the new lane via the existing `index.html` data-slug pattern. `[ADOPTED from brainstorm-intent.md "Discover Me navigation IA" + FR-22]`

### AD-17 — Data-driven quiz runtime; no per-quiz bespoke code

- **Binds:** FR-22, FR-23, FR-24, FR-26, FR-27, NFR-14
- **Prevents:** the catalog growing by 50 bespoke modules; each quiz diverging in chrome or accessibility; copy drift across the 6 MVP quizzes
- **Rule:** A quiz is `data.json` + `<quiz>.js` + `<quiz>.css`. The runtime (HT.scoring, HT.results, HT.challenge, HT.recommend, HT.catalog) is shared. The page chooses which modules to mount via `tools.json` `quiz-entry.modules[]`. The chrome (result-card bar styles, share button, challenge button layout) is shared across all quizzes. Bespoke code is permitted only for: (a) the question rendering order (a single `forEach` over `data.questions`), (b) the answer-to-trait mapping (which is `data.weights`, not code), and (c) the result-card variant selection (via `data.modules[kind=config].variant`). Anything beyond that is a smell. `[ADOPTED from brainstorm-intent.md "Architecture delta" + FR-24, FR-26]`

### AD-18 — Share-card chrome is a frozen contract

- **Binds:** FR-24, FR-29, NFR-12
- **Prevents:** the 6 MVP quizzes producing visually incompatible result cards; the share-card OG image diverging from the on-screen result; the "blind spot" line being skipped in 1 of 6 quizzes
- **Rule:** The result-card chrome is a single component owned by `HT.results.render()`. The mandatory elements, in DOM order, are: (1) archetype emoji + name (serif display type), (2) 1-line tagline (kebab-case adjective pair), (3) top 4 trait bars (cap per `trait-cap`), (4) the **mandatory blind spot line** (no quiz may disable this), (5) Share and Challenge buttons (Challenge only if `kind: challenge` is in `modules[]`), (6) the "Tools for you" surface (1-3 existing utility tools). The OG image is a static SVG per archetype, baked at content-build time, using the same archetype + blind-spot data. The chrome respects `prefers-reduced-motion` (animations disabled, swaps are instant). The chrome is keyboard-complete (Tab reaches Share and Challenge first; focus ring is visible at 4.5:1 contrast; `Esc` returns focus to the previous card). The chrome is **not** owned by the per-quiz JS; the per-quiz JS may only pass `result` and `mount` to `HT.results.render()`. `[ADOPTED from brainstorm-intent.md "Result-card chrome design intent" + FR-24, FR-29]`

### AD-19 — Challenge URL protocol is fragment-state, content-addressed, async

- **Binds:** FR-25, FR-30, FR-32, AD-5
- **Prevents:** Challenge URLs requiring server state; the receiver needing to be online simultaneously; archetype updates silently changing users' shared links; the URL leaking to server logs
- **Rule:** A Challenge URL is a fragment-state URL of the form `https://<host>/packs/discovery/<quiz>/#seed=<cyrb53>&spec=<v1>`. The fragment encodes: (a) `seed` — a 53-bit hash of the seeder's answers (not the answers themselves, not the archetype), (b) `spec` — the `quiz-entry.slug` + `version` of the spec the seeder used. The URL is **fragment-state only** (per AD-5); it never appears in HTTP request logs. The URL is **≤ 80 chars** (Twitter, SMS, iMessage safe). The receiver opens the URL, sees the seeder's archetype + blind spot preview (without the seeder's answers), and takes the quiz blind. The receiver's result is computed locally; the comparison is computed locally; nothing is sent to a server. The receiver's browser does not need to have the seeder's `data.json` cached — the loader fetches it lazily. The seeder's archetype is **immutable**: once a v1 spec is published, the URL with `spec=v1` always renders the v1 archetype, even if v2 ships a different label. Updates ship as `v2.<quiz>.<archetype>` archetype ids. The receiver's browser can detect version mismatch and offers a "this friend used an older version — here's the new label" hint. `[ADOPTED from brainstorm-intent.md "Challenge-a-Friend loop" + FR-25, FR-30, FR-32]`

## Invariants & Rules (extended from AD-1..15)

The Discovery Engine inherits all 15 existing ADs. The 4 new ADs (AD-16..19) above extend the spine. The visible-vs-deleted delta:

- **AD-1** Reinforced: no third-party libs (no AI/ML model for scoring, no CDN fonts, no analytics, no social-share widget).
- **AD-5** Reinforced: Challenge URL fragment budget ≤ 80 chars; never query string.
- **AD-9** (assumed) Reinforced: no PII; `_smoke_pii_lint.js` runs on every `data.json`.
- **AD-12** Reinforced: ES2018 vanilla; no async/await for DOM polling; no `import`; no dynamic `require`.
- **AD-14** Reinforced: every new module is page-conditional via Proxy factory; the public API surface is `Object.freeze`-d in the module and exported via `Object.defineProperty(HT, <name>, {value: publicApi, writable: false, configurable: false, enumerable: true})`.
- **AD-15** Reinforced: 50 existing tools untouched; `tools.json` `tools` array is append-only; `packs` is a sibling.

## Runtime Modules (the 5+1 in detail)

### `packs/discovery-loader.js` (2 KB gz budget)

- **Surface**: `HT.discovery.load(quizSlug) → Promise<{mount, data, modules}>`.
- **Behavior**: reads `data.json` (≤ 12 KB raw), validates against the schema, picks the modules from `quiz-entry.modules[]`, and mounts the live quiz chrome. The loader does **not** eagerly load any of the 5 runtime modules; each loads on first call (per the page-conditional Proxy pattern).
- **Constraints**: no `fetch` outside the data.json path; no DOM mutation outside the host element; no storage writes.

### `HT.scoring.score(answers, spec)` (4 KB gz budget)

- **Surface**: `(answers, spec) → {traits, archetype}`.
- **Spec shape**: `{traits: string[], weights: {[qid: string]: {[value: string]: {[trait: string]: number}}}, archetypes: Array<{id: string, label: string, emoji: string, scores: {[trait: string]: number}, default?: boolean}>, traitMax?: {[trait: string]: number}}`.
- **Behavior**: pure function; traits clamped to [0, 100]; skipped questions contribute zero; unknown answer values silently ignored; empty answers yields `archetypes[*].default`; archetype resolution is L1 (Manhattan) distance, ties broken by default-flag → index → id alphabetic.
- **Constraints**: no DOM; no storage; no fetch; no XHR; no `HT.provide`. Bundle ≤ 4 KB gz.

### `HT.results.render(mount, result, variant)` (4 KB gz budget)

- **Surface**: `(mount: HTMLElement, result: {traits, archetype}, variant: 'archetype' | 'ranking' | 'compatibility' | 'score-only') → void`.
- **Behavior**: mounts the result-card chrome per AD-18. Honors `prefers-reduced-motion`. Includes the "Tools for you" surface (1-3 matching utility tools). The Share button calls `HT.share.open(slug)` (AD-4 extension); the Challenge button calls `HT.challenge.encode(answersHash, quizSlug)`.
- **Constraints**: no fetch; no `window.print` directly (use `HT.share.print`); no `localStorage` writes.

### `HT.challenge.encode(answersHash, quizSlug, specVersion)` (4 KB gz budget)

- **Surface**: `(answersHash: string, quizSlug: string, specVersion: string) → string` (URL fragment ≤ 80 chars).
- **Behavior**: builds the fragment `#seed=<base36-cyrb53>&spec=<quizSlug>@<specVersion>` for the seeder; parses the same on the receiver side via `HT.challenge.decode(urlFragment) → {seed, quizSlug, specVersion}`. The `compare` function takes the receiver's `result` and the seeder's `seed` and computes `{compatibility, agree[], disagree[], blindSpot}`.
- **Constraints**: pure function; no DOM; no storage; no fetch. The result is ≤ 80 chars by construction.

### `HT.recommend.rank(scoredTraits, catalog, criteria)` (4 KB gz budget)

- **Surface**: `(scoredTraits: {[trait: string]: number}, catalog: Array<{id: string, traits: {[trait: string]: number}, rationale: string, alternatives: string[]}>) → Result[]`.
- **Behavior**: ranks catalog entries by L1 distance from the scored traits; ties broken by `criteria.weight` (per-trait). For `ranking` variant result cards, returns the top 3 with a "why you match" + "why you don't" + 3 alternatives.
- **Constraints**: pure function; no DOM; no storage. Catalog is hand-curated, no external data fetch.

### `HT.catalog.load(quizSlug)` (4 KB gz budget)

- **Surface**: `(quizSlug: string) → Promise<Catalog>`.
- **Behavior**: reads the `data.json` for the given quiz, returns the `catalog` array (for recommendation quizzes only). The catalog is cached after first load. Spirit Animal / Personality / Future Partner / Friend / Decisions do not have a catalog.
- **Constraints**: no external fetch; only the `data.json` path is read; result is frozen in cache.

## Schema Constraints (extensions to tools.schema.json)

The schema additions landed in the DC-0 scaffold (`scripts/dc/dc-0-schema.py` is the gate). The full schema additions:

- `properties.packs` — open object of `pack-entry` refs.
- `definitions.pack-entry` — required `slug`, `title`, `loader`, `entries`.
- `definitions.quiz-entry` — required `slug`, `title`, `category`, `data`, `modules`; the `category` enum is `viral | utility | game`. The `modules[]` is a `module-def` array (min 2, unique).
- `definitions.module-def` — discriminated union on `kind: scoring | results | challenge | catalog` via `allOf + if/then`. The `config` shape is per-kind: scoring-config (trait-ids), results-config (variant, trait-cap), challenge-config (spec-version), catalog-config (domain).
- `definitions.scoring-config` — required `trait-ids: string[]` (kebab, unique, ≥ 1).
- `definitions.results-config` — required `variant` (enum) + optional `trait-cap: integer (1..8, default 4)`.
- `definitions.challenge-config` — required `spec-version: string` (semver-like, `v\d+`).
- `definitions.catalog-config` — required `domain: string` (e.g. `cars`, `bikes`) + optional `max-results: integer (default 3)`.

Full schema lives in `tools.schema.json` (working tree). Story 10.1 finalizes the stabilization; the gate `make dc-0-schema` exits 0.

## Cross-Pack Concerns

The Discovery Engine **must not** break the existing 5 utility packs. The visible-vs-invisible cross-pack boundaries:

- **Shell Public API** — extended with 5 new entries (`HT.scoring`, `HT.results`, `HT.challenge`, `HT.recommend`, `HT.catalog`). Each is `Object.freeze`-d and `Object.defineProperty`-d with `writable: false, configurable: false` (per AD-14).
- **Bundle-size budget** — `scripts/bundle-size-gate.py` lists the 5 modules + the loader + 2 CSS chunks under `SPEC_PAGE_CONDITIONAL_MODULES`. The first-paint budget for the home grid is unchanged.
- **Storage-key registry** — the Discovery Engine declares **no `history-keys`** (per FR-33). Storage is fragment-state only; the Challenge URL is the persistence layer. The `assets/js/storage-registry.js` file is unchanged.
- **Theme / locale / reduced-motion** — inherited from the Shell. The Discovery Engine reads `HT.theme.mode`, `HT.locale`, `HT.a11y.prefersReducedMotion`; it does not write.
- **Existing 50 tools** — `tools.json` `tools` array is unchanged. The home grid renders the 6 lanes (5 utility + Discover Me) via the existing `index.html` data-slug; the renderer (`assets/js/layout.js`) picks up the new lane without modification.

## Performance Budget (per FR-22 + NFR-11)

| Surface | Budget | Source |
|---|---|---|
| `<quiz-slug>/index.html` first paint | ≤ 1.0 s on Moto G Power | NFR-11 |
| Result card render | ≤ 200 ms after last question | NFR-11 |
| Per-quiz `data.json` | ≤ 12 KB raw | NFR-11, NFR-14 |
| Per-quiz `<quiz-slug>.js` | ≤ 6 KB gz | NFR-11 |
| Per-quiz `<quiz-slug>.css` | ≤ 4 KB gz | NFR-11 |
| `packs/discovery-loader.js` | ≤ 2 KB gz | bundle-size-gate |
| `HT.scoring` module | ≤ 4 KB gz | bundle-size-gate |
| `HT.results` module | ≤ 4 KB gz | bundle-size-gate |
| `HT.challenge` module | ≤ 4 KB gz | bundle-size-gate |
| `HT.recommend` module | ≤ 4 KB gz | bundle-size-gate |
| `HT.catalog` module | ≤ 4 KB gz | bundle-size-gate |
| Total Discovery runtime | ≤ 22 KB gz | NFR-11 |
| Per-quiz total (quiz JS + module + data + chrome) | ≤ 50 KB gz | NFR-11 |

## CI Gates (the 13 AC gates)

The Discovery Engine AC gates are pre-existing in the working tree as `scripts/dc/dc-0-schema.py` through `scripts/dc/dc-12-retro.py`. They are the canonical acceptance gates for Stories 10.1..10.19. Each is a Python script that exits 0/1 per the AC checks. The `make dc-all` target runs all 13 and prints a summary table.

| Gate | Story | AC | Working tree status |
|---|---|---|---|
| `dc-0-schema` | 10.1 | Schema additions validate | GREEN |
| `dc-1-scoring` | 10.2 | `HT.scoring` API + freeze + smoke | mostly green (15 checks) |
| `dc-2-results` | 10.3 | `HT.results` API + chrome + smoke | RED (script exists; module not yet on disk) |
| `dc-3-challenge` | 10.4 | `HT.challenge` encode/decode + smoke | RED |
| `dc-4-recommend` | 10.5 | `HT.recommend` rank + smoke | RED |
| `dc-5-loader` | 10.6 | Pack loader bootstrap + lazy-load | RED |
| `dc-6-quizzes` | 10.7–10.12 | 6 quizzes exist + score ≥ 8 | RED |
| `dc-7-tools-json` | 10.13 | `tools.json` discovery registration | RED |
| `dc-8-docs` | 10.15 | `docs/discovery-platform.md` + authoring guide | RED |
| `dc-9-smokes` | 10.16 | Smoke harness for every quiz + cross-pack | RED |
| `dc-10-pack-gate` | 10.17 | `scripts/pack-gate.py` runtime validator | RED |
| `dc-11-bundle` | 10.18 | Per-module bundle sizes pass | RED |
| `dc-12-retro` | 10.19 | Epic 10 retrospective | RED |

## Risks (architectural)

| Risk | Mitigation |
|---|---|
| The Discovery runtime diverges from the Shell Public API contract | The 5 new modules use the same Proxy-factory pattern as `HT.quiz` (AD-14); the shell-thin TIER2_URLS entry is the single source of truth |
| A new quiz adds a `module-def.kind` not in the closed enum | The schema-enum checker rejects unknown kinds; DC-0 gate enforces; adding a kind requires a schema-major bump |
| The Challenge URL fragment budget (≤ 80 chars) is exceeded by a future quiz | The `HT.challenge.encode` smoke harness asserts `encoded.length <= 80`; an encoded URL longer than 80 chars is a build error |
| The OG image per archetype per quiz is stale (rebuilt on every merge) | The OG image is content-addressed (`og/<archetype-id>.svg`); the build pipeline lints the set per archetype; if a quiz has 8 archetypes but only 7 OG images, the build fails |
| The PII lint misses a prompt pattern | The lint is rule-based with an allowlist (`_smoke_pii_lint.js`); the authoring guide documents the rule; new quiz authors get a smoke check at content-build time |
| The 50 existing tools break due to a page-conditional regression | `make regression-sweep` runs after every `tools.json` change; the regression-sweep covers the 6 mood boards + 12 promoted tools; rc=0 required |
| The Discovery runtime adds a runtime dep (a contributor copy-pastes a CDN tag) | The shell-bounds-check.py covers the 5 new modules; the bypass-check ban extends to `assets/js/scoring.js`, `results.js`, `challenge.js`, `recommend.js`, `catalog.js`, `packs/discovery-loader.js` |

## Out-of-Scope (architectural)

- An authoring UI for new quizzes (data.json is the authoring interface; the authoring guide is the help text).
- Server-side Challenge URL routing (AD-19 explicitly forbids server state).
- Cross-quiz result aggregation (the "Spirit Animal → focus timer" cross-reference is a `recommend-config` slot but the orchestration logic is deferred to Epic 11).
- Translation of archetype copy beyond en-US (English-only for v1; locale-fragility is a known risk).
- A "Leaderboard" / "Top archetype this week" surface (per AD-9 / AD-12).
- AI/ML scoring models (pure-rule scoring only; no TensorFlow.js, no ONNX runtime, no remote API).

---

*Architecture spine — Epic 10. Inherits AD-1..15. Adds AD-16..19. 6 new modules (5+1), all page-conditional. 50 existing tools unchanged. Per-quiz total ≤ 50 KB gz. 13 AC gates script-defined. No third-party libs. No PII. No analytics. Local-first.*
