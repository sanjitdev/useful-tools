---
title: PRD — Discovery Engine (Epic 10)
status: final
created: 2026-08-17
updated: 2026-08-17
project: useful-tools
parent_prd: _bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md
epic: 10
stories: 19 (10.1–10.19)
cross_references:
  - _bmad-output/brainstorming/brainstorm-discovery-engine-2026-08-17/brainstorm-intent.md
  - _bmad-output/brainstorming/brainstorm-discovery-engine-2026-08-17/discovery-engine-future-tasks.md
  - _bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-useful-tools-2026-07-31/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-useful-tools-2026-07-31/EXPERIENCE.md
---

# PRD: Discovery Engine (Epic 10)

## 0. Document Purpose

This PRD is the product and engineering brief for **Epic 10 — Discovery Engine**, a standalone data-driven pack of personality / recommendation / game experiences that ships on top of the existing 5 utility packs (Finance, Study, Developer, Household, Travel). It builds on:

- The **Handy Tools master PRD** (`prd-useful-tools-2026-07-31/prd.md`) — 21 FRs, 10 NFRs, 4 UJs that remain binding.
- The **Discovery Engine brainstorm** (`brainstorm-discovery-engine-2026-08-17/brainstorm-intent.md`) — 6-quiz MVP shortlist, Challenge-a-Friend protocol, Discover Me IA, result-card chrome spec, 9 risk mitigations.
- The **DC scaffold** in the working tree (`scripts/dc/dc-0..12`, `tools.schema.json` packs additions, `assets/js/scoring.js`, shell-thin Proxy wiring for `HT.scoring`).

It does not duplicate the master PRD. Where a Discovery Engine FR/NFR/UJ extends an existing one, it is cross-referenced.

The structure follows the master PRD's Essential Spine: vision, target user, glossary, FRs, NFRs, UJs, scope, constraints, risks, success metrics.

## 1. Vision

Handy Tools is a local-first tool suite that earns trust through composure, speed, and embeddability. **Epic 10 — Discovery Engine** adds a sixth, sibling pack — **Discover Me** — that broadens the audience (social-media sharers, casual visitors, friend groups) by turning the site into a *discovery engine* that keeps telling people interesting things about themselves and pointing them to the existing 50 utility tools.

The thesis of the Discovery Engine is **identity + curiosity + compatibility + utility**. The bar is the same as the rest of the suite: never collect data, never require an account, never ship a quiz below the 8/10 quality bar. The viral mechanism is a *deterministic URL* — no analytics, no leaderboard, no social-media-pixel sharing — augmented by a **Challenge a Friend** loop that turns one user's result into another user's session.

Discovery is a **pack, not a chrome layer**. There is no new topbar tab, no new settings tab, no new modal. The pack renders as the 6th lane on the home grid, mounts via the existing pack-page renderer (Story 6.2), and uses the same Shell Public API surface as the rest of the suite.

## 2. Target User

### 2.1 New users reached by Epic 10

- **Casual / social-media-native users** — they arrive via a shared result URL or social mention, take a quiz in 2 minutes, may never open a utility tool. The Discovery Engine is the entry point.
- **Returning users between utility sessions** — they took one quiz, saved the result, want to try another. Lower-frequency engagement than utility-tool users but higher virality.
- **Friend groups / couples** — the Challenge-a-Friend loop is the primary engagement vector for two-user households.

### 2.2 Non-Users (Epic 10)

- **Users who need psychometric validity** — BuzzFeed-style quizzes are entertainment, not clinical instruments. The site declaratively labels them as such.
- **Users who want a leaderboard** — Discovery is local-first; no global rankings, no "top archetype this week" surface.
- **Users who need accounts / cross-device sync** — opt-in hand-export of the trait vector is the only persistence.

### 2.3 Existing-user journeys preserved

The 50 utility tools continue to work unchanged. The 5 utility packs continue to render. The Discovery Engine is purely additive — `tools.json` gains a `packs.discovery` object; the `tools` array is unchanged (per AD-15).

## 3. Glossary

- **Pack** — a curated grouping of related entries. Existing: finance, study, developer, household, travel. New: discovery.
- **Quiz / Entry** — a single personality / recommendation / game experience inside a pack. Pure data: questions, traits, archetypes, share-card copy, recommendation catalog. No bespoke code per quiz.
- **Trait** — a numeric dimension the user is scored on. Trait scores are clamped to [0, 100].
- **Archetype** — a named label the user is assigned based on nearest-neighbor in trait space. Each archetype has a content-addressed id (e.g. `v1.personality.wolf`), a label, an emoji, and a "blind spot" line.
- **Result Card** — the post-quiz chrome: archetype, trait bars, blind spot line, Share and Challenge buttons.
- **Challenge URL** — a deterministic URL fragment encoding the *answers hash*, not the *archetype*. Two users can complete the quiz asynchronously; the hash + the spec version are the persistence layer.
- **OG Image** — a pre-baked static SVG per archetype per quiz, used for Twitter / iMessage / OG card unfurls. Generated at content-build time, not at request time.
- **Score-on-the-fly** — the trait-scoring engine that turns `(answers, spec) → {traits, archetype}`. Pure function, no DOM, no storage.
- **Catalog** — for recommendation quizzes, a hand-curated list of result entries (e.g. car models). Each catalog entry has 6 traits + a recommendation rationale + 3 alternatives.
- **Compatibility Card** — for Challenge-a-Friend, a side-by-side comparison of two trait vectors with a compatibility %, "what you agree on", "what you don't", and a blind spot.

## 4. Functional Requirements

The Discovery Engine adds **FR-22 through FR-33** (12 new FRs) on top of the existing 21 FRs. They are grouped into 4 capability clusters.

### 4.1 Discovery Pack Schema & Runtime

**Description.** The runtime is a small set of page-conditional Shell modules mounted under a new pack route subtree. The schema is the discriminator that ties data to runtime.

#### FR-22: Discovery Pack Schema (extends FR-4 Site Data)

The system can describe a `pack` in `tools.json` as a sibling of `tools`. A pack declares a `slug`, `title`, `loader`, and an ordered list of `entries`. Each entry declares a `data` path (relative to the page) and a `modules[]` list.

**Consequences (testable):**
- `tools.schema.json` gains the `packs` definition (`pack-entry`, `quiz-entry`, `module-def` discriminated union over `kind: scoring | results | challenge | catalog`).
- `scripts/validate-tools-json.py` walks `allOf + if/then` correctly for the discriminated union.
- Adding a new pack requires only an entry in `tools.json` (no HTML duplication).
- `packs.discovery` is the first pack; `packs` is open for extension.

#### FR-23: Trait Scoring Engine (Shell module)

The system can compute `{traits, archetype}` from `(answers, spec)` via a pure function exposed as `HT.scoring.score()`.

**Consequences (testable):**
- Trait scores are clamped to [0, 100].
- Skipped questions (`answers[id] === undefined`) contribute zero weight.
- Unknown answer values are silently ignored — no throw.
- Empty answers yields `spec.archetypes[*].default` (or the first non-default, or the first archetype, or null).
- Archetype resolution is deterministic: L1 (Manhattan) distance on the trait vector, ties broken by default-flag → index → id alphabetic.
- The engine is page-conditional — loaded by the shell-thin Proxy factory on first `HT.scoring.score()` call.
- Bundle size ≤ 4 KB gzipped; no DOM / storage / fetch / XHR / `HT.provide` references (shell-bounds).

#### FR-24: Result Card Renderer (Shell module)

The system can mount a result card into a host element via `HT.results.render()`.

**Consequences (testable):**
- The result card chrome follows the spec: archetype emoji + name (serif display), 1-line tagline, top 4 trait bars (cap per `trait-cap`), mandatory "blind spot" line, Share and Challenge buttons above the fold on a 360×640 viewport.
- 4 variants are supported: `archetype`, `ranking`, `compatibility`, `score-only` (per `definitions.results-config.variant`).
- A "Tools for you" section at the bottom of the result card surfaces 1-3 existing utility tools that fit the archetype (load-bearing for the strategic posture: discovery is a router, not a destination).
- Animations respect `prefers-reduced-motion`.
- Bundle size ≤ 6 KB gzipped (JS + CSS combined).

#### FR-25: Challenge-a-Friend Protocol (Shell module)

A user can send a quiz to a friend via a deterministic URL fragment. The friend completes the quiz blind; the result is a side-by-side compatibility card.

**Consequences (testable):**
- `HT.challenge.encode(answersHash, quizSlug) → string` produces a URL fragment ≤ 80 chars.
- `HT.challenge.decode(urlFragment) → {answersHash, quizSlug, specVersion}` parses on landing.
- `HT.challenge.compare(myResult, theirAnswersHash, spec) → {compatibility, agree[], disagree[], blindSpot}` runs after the second user completes the quiz.
- The URL is fragment-state only (per AD-5) — never a query string, never sent to a server.
- The Challenge protocol is async — the second user does not need to be online simultaneously.
- Both URLs remain valid forever; archetype immutability is enforced via content-addressed archetype IDs (`v1.<quiz>.<archetype>`).

### 4.2 Discovery Quizzes & Catalog

**Description.** Each quiz is data-only; the runtime is shared. The catalog of 6 MVP quizzes ships in Epic 10. New quizzes are added by appending to `packs.discovery.entries[]`.

#### FR-26: Quiz Catalog (6 MVP)

The system ships 6 quizzes in the MVP, each with the same module shape and the same chrome.

**Consequences (testable):**
- 6 quizzes ship: `personality`, `future-partner`, `decisions`, `spirit-animal`, `friend`, `car-finder`.
- Each quiz has a `data.json` (≤ 12 KB raw) containing questions, traits, archetypes, share-card copy, and (for recommendation quizzes) the catalog.
- Each quiz mounts one of two module sets: `[scoring, results, challenge]` (viral + utility) or `[scoring, results, catalog]` (utility only).
- Each quiz scores ≥ 8/10 against the 10-criterion rubric.
- Each quiz passes the "share test" — the author can verify the result card is screenshot-grade.

#### FR-27: Recommendation Catalog (extends FR-21)

For recommendation quizzes, the system can render a ranked list of catalog entries with 6 traits, a recommendation rationale, and 3 alternatives.

**Consequences (testable):**
- `HT.recommend.rank(scoredTraits, catalog, criteria) → Result[]` ranks by trait match.
- Two modes: weighted-criteria (Car Finder) and nearest-neighbor (Spirit Animal).
- Each catalog entry is hand-curated; no external data fetch.
- The catalog domain is declared in `catalog-config.domain` (e.g. `cars`, `bikes`, `cities`).

#### FR-28: Discover Me Lane (Home Grid)

The home grid renders a 6th lane titled "Discover Me" between the 5 utility packs and the free-form grid.

**Consequences (testable):**
- The lane is rendered via the existing pack-page renderer (Story 6.2) — no new chrome layer.
- Each quiz renders as a card with archetype emoji + title + "12 questions · 2 min" copy.
- The lane is keyboard-complete in ≤ 90 seconds.
- Reduced-motion respected; the lane is reachable via ⌘K / Ctrl-K.

### 4.3 Share Card & Challenge-A-Friend Loop

**Description.** The viral mechanism is intentional, deterministic, and zero-cost to run.

#### FR-29: Share Card Generation

The system can generate a shareable card for a quiz result, downloadable as SVG / WebP and pre-baked as an OG image for URL unfurls.

**Consequences (testable):**
- A "Download as image" button on the result card lets the user save a `1024×1024` PNG (rendered via canvas from the same SVG) — works without a server, without an external font.
- An OG image per archetype per quiz is pre-baked at content-build time as static SVG → PNG.
- The share card archetype uses the same emoji + serif display type as the on-screen result card.
- The blind spot line is included verbatim on the share card.

#### FR-30: Challenge Link Distribution

A user can share a Challenge URL via the existing share dialog (FR-13) or via the dedicated "Challenge Friend" button on the result card.

**Consequences (testable):**
- The Challenge URL is fragment-state only; it never appears in HTTP request logs.
- The URL is ≤ 80 chars (Twitter, SMS, iMessage safe).
- The receiving friend sees a "your friend did this quiz" landing page with the sharer's archetype + blind spot line preview, *not* the sharer's answers.
- The friend is never asked for the sharer's identifying information (no PII per AD-9).

### 4.4 Privacy, Trust, and Distribution

**Description.** The Discovery Engine must hold the brand's trust posture while introducing a viral surface.

#### FR-31: PII Lint on Quiz Content

The system can reject any quiz whose `data.json` contains prompt or option text matching PII patterns (city, employer, first name, address).

**Consequences (testable):**
- A `_smoke_pii_lint.js` covers a regex allowlist and rejects offending prompts.
- The lint runs in `scripts/pack-gate.py` and at content-build time.
- The lint is documented in `docs/discovery-quiz-authoring.md`.

#### FR-32: Archetype Immutability

Once an archetype is published with a content-addressed id (`v1.<quiz>.<archetype>`), the label, emoji, and blind spot line are immutable. Updates ship as a new id (`v2.<quiz>.<archetype>`).

**Consequences (testable):**
- The Challenge URL encodes the spec version; the receiver fetches the matching spec.
- Existing shared URLs continue to render the original archetype.
- The content-build pipeline enforces the immutable convention.

#### FR-33: Trust Surface for Discovery (extends FR-15)

The `/privacy` page lists the Discovery Engine's storage keys and explains what is stored, when, and where it goes.

**Consequences (testable):**
- The Discovery Engine declares no `history-keys`; storage is fragment-state only.
- The `/privacy` page gains a "Discover Me" section listing the Challenge URL encoding and the no-PII guarantee.
- The page is reachable from every quiz footer.

## 5. Non-Functional Requirements

The Discovery Engine adds **NFR-11 through NFR-14** (4 new NFRs) on top of the existing 10 NFRs. They are grouped into performance, accessibility, footprint, and content-budget categories.

#### NFR-11: Discovery Page Performance (extends NFR-1)

A quiz page is interactive in < 1 s on mid-range mobile (Moto G Power baseline) and the result card is rendered in < 200 ms after the last question.

**Consequences (testable):**
- Shell JS for a quiz page (shell + quiz-loader + scoring + results + challenge) ≤ 50 KB gzipped.
- Per-quiz `data.json` ≤ 12 KB raw.
- Per-quiz quiz-JS ≤ 6 KB gzipped.
- A Lighthouse Performance ≥ 95 on a quiz page in mobile mode.

#### NFR-12: Discovery Accessibility (extends NFR-2)

Every quiz is keyboard-complete in ≤ 90 seconds by an external tester. The reveal screen is `role="region"` + `aria-live="polite"`; focus is trapped on the active card; `Esc` and the browser back-button both pop a card.

**Consequences (testable):**
- Share and Challenge buttons are reachable via Tab; the focus ring is visible at 4.5:1 contrast.
- The result card respects `prefers-reduced-motion` (animations disabled, swaps are instant).
- The Challenge URL fragment is announced to screen readers as "challenge link".
- Every quiz passes a Lighthouse Accessibility ≥ 95.

#### NFR-13: Discovery Footprint (extends NFR-3 / NFR-9)

The Discovery Engine ships zero new third-party libraries. No CDN fonts, no analytics, no social-media-pixel sharing, no remote images.

**Consequences (testable):**
- The 5 Shell modules (`scoring.js`, `results.js`, `challenge.js`, `recommend.js`, `catalog.js`) collectively ≤ 30 KB gzipped.
- The loader (`packs/discovery-loader.js`) ≤ 2 KB gzipped.
- No fetch / XHR / WebSocket / `navigator.sendBeacon` calls in any Discovery module.
- `shell-bounds-check.py` passes for every Discovery module.

#### NFR-14: Discovery Content Budget (extends NFR-3)

A new quiz ships in < 1 day of content authoring time. The data shape is single-source-of-truth.

**Consequences (testable):**
- `data.json` is canonical; no per-quiz bespoke code.
- The authoring guide (`docs/discovery-quiz-authoring.md`) covers: archetype naming, trait vs. score spread, blind-spot line writing, OG image bake checklist.
- The PII lint + the archetype-immutability lint run on every `data.json` at lint time.

## 6. User Journeys (4 new UJs, UJ-5 through UJ-8)

#### UJ-5: Sanjit takes a personality quiz and shares it.

Sanjit, a 28-year-old developer, has used the lifespan simulator once. He sees a "Discover Me" tile on the home grid, curious. He taps "What Kind of Person Are You, Really?" and answers 12 situational questions in 2 minutes. The result card shows **"The Quiet Strategist"** with 4 trait bars and a blind spot line: *"You want freedom, but you also want to control the outcome."* He taps Share. The result is copied to his clipboard as a pre-formatted message + a Challenge URL. He tweets the result. A friend clicks the URL, takes the quiz blind, and gets a compatibility card.

#### UJ-6: Maya receives a Challenge URL.

Maya, Sanjit's friend, clicks a Challenge URL on Twitter. She lands on a "your friend did this quiz" page showing Sanjit's archetype (without his answers). She takes the quiz blind. The result is a side-by-side comparison: *"You are the Wild Explorer. Sanjit is the Quiet Strategist. Compatibility: 62%. You agree on: curiosity, ambition. You differ on: risk, decision-making style."* Maya shares her result back to Sanjit.

#### UJ-7: Carlos uses a recommendation quiz to inform a real decision.

Carlos, a 32-year-old professional, is buying his first car. He searches "car finder" and finds the Discovery Engine card. He answers 8 questions (budget, usage, passengers, fuel-vs-performance, etc.). The result is a 3-row table: *"Toyota Corolla — 87% match. Honda Civic — 84% match. Mazda 3 — 79% match."* Each row has a "Why you match" line and 3 alternatives. Carlos taps "Tools for you" and lands on the Loan Calculator — a pre-existing utility tool.

#### UJ-8: Aisha, the privacy-conscious user, sees the Discovery Engine and decides.

Aisha, a 32-year-old privacy advocate, lands on the home grid. She sees a "Discover Me" lane and is intrigued. She reads the footer: "No analytics. No tracking. No PII. The Challenge URL is a fragment, never sent to a server." She takes a quiz. The result card has a "Download as image" button (no Share-by-URL required). She saves the PNG and posts it to her private Signal group.

## 7. Scope & Non-Goals

**In Scope (Epic 10):**
- 6 MVP quizzes in the discovery pack.
- 5 Shell modules (`HT.scoring`, `HT.results`, `HT.challenge`, `HT.recommend`, `HT.catalog`).
- The pack loader (`packs/discovery-loader.js`).
- The `Discover Me` home-grid lane.
- `docs/discovery-platform.md` (architecture narrative) + `docs/discovery-quiz-authoring.md` (authoring guide).
- The `tools.json` registration + `scripts/pack-gate.py` validator.
- Smoke harnesses for every module + every quiz.

**Out of Scope (Epic 10):**
- New quizzes beyond the 6 MVP (deferred to v2: bike-finder, career-fit, millionaire, hidden-personality).
- Cross-pack recommendation ("Spirit Animal → best focus timer for a Wolf") — surfaced in the schema as `recommend-config` but the cross-reference logic is left to Epic 11.
- Analytics, telemetry, leaderboards, social-media-pixel sharing (per AD-9 / AD-12).
- Translation of archetype copy beyond en-US (English-only for v1; locale-fragility is a known risk).
- Authoring UI for new quizzes (data.json is the authoring interface).

## 8. Constraints & Guardrails

| Constraint | Source | Verification |
|---|---|---|
| Static-only, no build step | NFR-9 / AD-12 | Smoke harness runs against `python -m http.server`, no `npm` step |
| No third-party libs | AD-1 | `shell-bounds-check.py` passes for every module |
| No PII | AD-9 | `_smoke_pii_lint.js` runs on every `data.json` |
| ES2018 vanilla | AD-12 | No `import`, no `async/await` polling, no dynamic `require` |
| Shell Public API stable | AD-14 | Every new module is page-conditional via Proxy factory |
| Brownfield rule | AD-15 | `tools.json` `tools` array unchanged; 50 entries preserved |
| Local-first, no accounts | NFR-3 | No fetch / XHR / WebSocket in Discovery modules |
| Fragment-state only for Challenge URLs | AD-5 | URL fragment budget ≤ 80 chars; never query string |
| Archetype immutability | FR-32 | Content-addressed ids + spec version in URL hash |
| Bundle size budget | NFR-1 / NFR-13 | `scripts/bundle-size-gate.py` per-module entries |

## 9. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Content authoring takes 3+ weeks per quiz; team burns out before 6 ship | High | Start with archetype-only quizzes (Spirit Animal, Personality, Future Partner) that need < 1 day of content each; defer data-heavy quizzes (Car Finder, Bike Finder, Career Fit) |
| Share URLs become embarrassingly long (full trait hash) | High | Cap URL hash budget at 80 chars; use cyrb53(seed) instead of full trait vector; measure truncation rate by string length |
| OG image is generic instead of archetype-specific, so shares look identical | High | Pre-bake 1 OG SVG per archetype per quiz at content-build time; lint the set before merge |
| "Challenge a Friend" requires both users online simultaneously (it shouldn't) | High | URL state encodes *answers hash*, not session ID; the second user's page computes its own result + compatibility asynchronously |
| Archetype immutability creates drift — user's shared link shows a different result on later visit | Medium | Adopt content-addressed archetype IDs (`v1.<quiz>.<archetype>`); publish spec version in URL hash |
| PII leaks through quiz questions (location, employer, names) | Medium | Maintain `_smoke_pii_lint.js`; reject questions whose `prompt` or `options` matches `(city\|employer\|first-?name\|address)` patterns |
| Existing 50 tools break due to new pack-page rendering | Medium | Run `make regression-sweep` after every `tools.json` change; require rc=0 on the 6 mood boards and 12 promoted tools |
| Privacy-conscious users can't share — underperforms vs. projections | Medium | Share card includes a "Download as image" button (client-side SVG → PNG via canvas) for users who won't post a URL |
| Engine becomes a destination instead of a router to existing tools | High | Every result card has a "Tools for you" section pointing to 1-3 existing tools; load-bearing for the strategic posture |
| Discovery content drift in non-English locales | Low | English-only for v1; locale-fragility documented as a known risk; deferred to Epic 11 |
| Authoring UI is data.json only — high friction for new contributors | Medium | Authoring guide + canonical example + PII lint close most of the gap; authoring UI deferred to Epic 11 |

## 10. Success Metrics

The Discovery Engine is **successful** if, after 30 days of being live on the home grid:

- **Reach** — at least 1 of every 4 home-grid visitors clicks into a Discover Me quiz.
- **Completion** — at least 60% of quiz-starters complete all 12 questions (Skip counts as completion).
- **Share rate** — at least 8% of completers tap Share or Download-as-image.
- **Challenge rate** — at least 30% of shared links generate a Challenge-completion (the second user completes the quiz).
- **Router rate** — at least 5% of completers tap a "Tools for you" link to a utility tool.
- **Privacy posture** — zero network requests from Discovery modules (verified by `scripts/_smoke_wire_log.js`); `/privacy` page reachable from every quiz.

Measurement is **qualitative + behavioral, not telemetry**: GitHub traffic, social mentions, manual review of `/privacy` page. Per AD-9 + AD-12, no analytics, no tracking, no leaderboard.

## 11. Cross-References

- **Master PRD**: `prd-useful-tools-2026-07-31/prd.md` (FR-1..21, NFR-1..10, UJ-1..4)
- **Architecture**: `architecture-discovery-engine-2026-08-17/ARCHITECTURE-SPINE.md` (AD-16..19)
- **UX**: `ux-discovery-engine-2026-08-17/DESIGN.md` + `EXPERIENCE.md` (Discover Me lane, result-card chrome, Challenge flow)
- **Brainstorm**: `brainstorm-discovery-engine-2026-08-17/brainstorm-intent.md` (6-MVP shortlist, Challenge loop, IA, chrome spec)
- **Tasks**: `brainstorm-discovery-engine-2026-08-17/discovery-engine-future-tasks.md` (Story 10.1..10.19 stubs)
- **Existing AC gates**: `scripts/dc/dc-0-schema.py` through `dc-12-retro.py` (working tree)
- **Working tree scaffold**: `tools.schema.json` packs additions, `assets/js/scoring.js`, shell-thin Proxy wiring

---

*PRD — Epic 10. Cross-references the master PRD's 21 FRs + 10 NFRs + 4 UJs. Adds 12 FRs (FR-22..33), 4 NFRs (NFR-11..14), and 4 UJs (UJ-5..8). 9 risks documented with mitigation. 6 success metrics, all qualitative. No analytics, no PII, no third-party libs — holds the brand's trust posture.*
