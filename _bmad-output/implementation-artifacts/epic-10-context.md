# Epic 10 Context: Discovery Engine — Data-driven personality / recommendation / game pack with Challenge-a-Friend viral loop

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Ship a 6th pack ("Discover Me") of six standalone, data-driven quizzes that each score deterministically into an archetype result card with trait bars, a blind-spot conversation starter, and Share / Challenge actions. The Challenge tap yields a fragment-state URL the receiver pastes to take the quiz blind and see a 3-band compatibility view. The pack is data-driven (new quizzes are `module-def` entries), privacy-default (disclosure on every page; share URLs reveal archetype + blind spot only), and offline-first (no baseline network call). All animation honors `prefers-reduced-motion` at three levels, and the entire pack stays within an aggressive gzipped budget so the home page is unaffected.

## Stories

- Story 10.1: Pack `disc` sibling in `tools.json` schema
- Story 10.2: Data-driven scoring engine
- Story 10.3: Results module — render and share-card chrome
- Story 10.4: Challenge module — encode / decode / compare
- Story 10.5: Recommendation module — match
- Story 10.6: Discovery loader — page-conditional module loader
- Story 10.7: 6-quiz MVP
- Story 10.8: Discover Me lane on home grid
- Story 10.9: Discovery pack page — `/packs/disc` route
- Story 10.10: Result card chrome component
- Story 10.11: Share-card chrome — PNG / URL / Print
- Story 10.12: Challenge UX — receiver-side landing + privacy default
- Story 10.13: PII lint + archetype immutability lint
- Story 10.14: Accessibility review follow-ups (B1 / B2 / B3 + 5 high-value)
- Story 10.15: Discovery Engine smoke harness (DC-0..12)
- Story 10.16: Bundle-size budget enforcement + brownfield clean
- Story 10.17: Discovery Engine docs (authoring / taxonomy / privacy)
- Story 10.18: Discover Me pack-composition gate (≥ 5 ready)
- Story 10.19: Epic 10 retrospective

## Requirements & Constraints

- Add a sibling `packs` object to `tools.json` (the existing `tools` array of 50 entries is unchanged); each quiz is a `module-def` discriminated union on `kind: scoring | results | challenge | catalog`.
- Six MVP quizzes ship: Spirit Animal, Future Partner, What Would You Do, Decision Style, Friend Match, Car Finder. Each has 5–12 questions, multi-choice options contributing 1–3 weights across 4–8 traits, and archetypes with hand-authored emoji + label + tagline + blind-spot text.
- Scoring is a pure function returning `{ archetype, traits, blindSpot }` — no I/O, no time, no random, no PII access. Empty answers yields the default archetype. Archetype resolution uses L1 distance on the trait vector with deterministic tie-breaking.
- Challenge URLs are fragment-state only, ≤ 80 chars, of the form `#seed=<base36-cyrb53>&spec=<quiz>@<version>`. The seed is a 53-bit hash of the answers (never the answers, never the archetype). URLs never appear in HTTP request logs.
- Archetypes are content-addressed and immutable once published; spec version is encoded in the URL; new archetype label ships as a new id (`v2.<quiz>.<archetype>`).
- The share dialog provides three actions: Copy URL, Download as PNG (1200×630), Print (chrome-stripped). PNG export falls back to "Copy as text" if `HTMLCanvasElement.toBlob` is unavailable.
- A "Tools for you" section on every result card surfaces 1–3 existing utility tools from `tools.json` — Discovery is a router to the utility surface, not a destination.
- PII lint catches name / email / phone / IP / street-address patterns in prompts, options, and archetype copy at build time. Archetype immutability lint rejects templated user-input placeholders (`{{name}}`, etc.) in archetype text.
- The Discovery Engine declares no `history-keys`; the Challenge URL is the persistence layer.
- English-only for v1; locale-fragility is a known limitation deferred to a later epic.
- Bundle budget: total Discovery runtime ≤ 22 KB gz; per-quiz total ≤ 50 KB gz; per-quiz slice ≤ 8 KB gz; the entire pack (6 quizzes + chrome + modules) ≤ 80 KB gz. The home page must NOT load any Discovery module.
- WCAG 2.1 AA conformance on first public release — 3 blocking accessibility findings (compatibility-band contrast, Challenge URL accessible name + consent toggle, Tools-for-you DOM shape) plus 5 high-value items (live-region debounce, focus-return, OG SVG title, skip-link scope, receiver H1 wording) must close before the result card and Challenge UX ship.

## Technical Decisions

- The Discovery pack is a sibling of `tools` in `tools.json`, not a sub-tree. The home grid renders a "Discover Me" lane via the existing pack-page renderer; the Shell Public API is extended with 5 new entries (`HT.scoring`, `HT.results`, `HT.challenge`, `HT.recommend`, `HT.catalog`), each `Object.freeze`-d and `Object.defineProperty`-d with `writable: false, configurable: false`.
- The Discovery Engine is a **pack runtime** with a 2nd-tier lazy-loaded runtime — a deliberate extension of the Shell-and-Tool paradigm. All 6 new modules are page-conditional via the shell-thin Proxy factory; the home page does not pay for any Discovery bundle.
- Bespoke per-quiz code is permitted only for (a) question rendering order, (b) answer-to-trait mapping (which is data weights, not code), and (c) result-card variant selection. Anything beyond that is a smell. Adding a new `module-def.kind` requires a schema-major bump.
- Result-card chrome is a single component owned by `HT.results.render()` with a frozen mandatory DOM order: archetype emoji + name (serif display), tagline, top trait bars (cap per `trait-cap`, default 4), the blind-spot box (mandatory, never disabled), Share and Challenge buttons, and the "Tools for you" surface. The chrome respects `prefers-reduced-motion` and is keyboard-complete.
- Challenge URL protocol is fragment-state, content-addressed, async. The receiver computes their own result + compatibility locally; the seeder never needs to be online. Spec-version mismatch is detected and surfaced to the receiver.
- 13 AC gates (`dc-0..dc-12`) cover schema, scoring, results, challenge, recommend, loader, quizzes, `tools.json` regression, docs, smoke harness, pack-gate runtime, bundle size, and retro. The harness posts status flags as PR comments and blocks merge on any FAIL.
- Architecture decisions AD-16 through AD-19 codify: pack sibling shape (AD-16), data-driven runtime with no per-quiz bespoke code (AD-17), share-card chrome frozen contract (AD-18), and Challenge URL fragment protocol (AD-19). All existing AD-1..15 invariants remain binding (no third-party libs, no PII, ES2018 vanilla, brownfield rule preserves 50 existing tools, Shell Public API stable).
- The PII + immutability lints are part of the `tool-contract-gate` GitHub Actions workflow and post findings as PR comments with file path + line number.

## UX & Interaction Patterns

- Three new component tokens, no new colors / fonts / spacing: `components.discovery-card` (result card), `components.compatibility-card` (Challenge receiver result), `components.discovery-lane-card` (home-grid tile). Inherits all visual primitives from the master design system.
- Compatibility band uses 3 inherited semantic palette mappings (Strong / Moderate / Low) with darker foreground variants chosen so 11px body labels pass AA contrast. The 48px percentage is the celebratory foreground and qualifies as large text (3:1); labels require 4.5:1.
- Result card DOM shape is canonical and required: `<article class="discovery-card" role="region" aria-live="polite" aria-label="Result: {archetype}">` → header (emoji + name + tagline) → `<ol class="trait-bar-list">` of 4 trait bars → `<aside class="blind-spot-box">` → `<div class="action-row">` (Share + Challenge, ≥ 44px touch targets) → `<section class="tools-for-you" aria-labelledby="tools-for-you-label">` with `<h2>`, `<ul>`, and `<li>` cards that use display names from `tools.json` (not slugs) plus a one-line "in the same site" disclosure.
- Challenge receiver landing page sets document `<title>` to "Challenge from {archetype or 'a friend'}: {quiz title}", announces on mount via `aria-live="polite"`, shows visible H1 "You've been challenged to take {quiz title}", and renders a consent toggle whose default is "Take the quiz blind" (autofocus). Opt-in "Show me what they got first" reveals the seeder's archetype + blind spot in a `<details>` element.
- Quiz page IA: standard site header + tool header + `<section class="quiz-mount">` (one card at a time: question, result, or compatibility) + `<aside class="quiz-aside">` with the privacy disclosure (two lines, top-of-fold on mobile, contains a "How your data is handled" link to `/privacy#discovery`). The disclosure must be inside `<main class="shell-main">` so the inherited skip-link does not skip it (smoke check).
- Reduced-motion contract honored at three levels: CSS media query, HTML attribute (`data-reduced-motion="true"`), and JS runtime read (`HT.a11y.prefersReducedMotion`). All result-card / compatibility / lane animations fall back to instant.
- Question card: Tab cycles options; 1–9 picks option N; Enter advances; Esc pops one card; Skip advances without writing the answer. No modal pattern is introduced — all chrome is either a region on the page, an inherited component (tool-card, share dialog via `HT.share.open`), or a toast.
- Each OG SVG per archetype per quiz must include a `<title>` element as its first child (archetype label + blind spot text) so social-media platforms announce the archetype instead of "image".
- Per-card live-region announcement on result-card mount uses an 800 ms debounce to prevent double-announcements on re-render. Focus moves to the result-card container or Share button on mount and restores to the last focused question card's Next button when navigating back.
- Discover Me lane renders as a single-row scroll on desktop, 2-column grid on tablet, 1-column stack on mobile, above the 5 utility-pack lanes and below the free-form tool grid. Each card is a link to `/disc/<slug>/`, displays the emoji (48px), title (body-lg, 600), and a category badge pill.

## Cross-Story Dependencies

- Story 10.1 (schema) is the foundation; Stories 10.2, 10.3, 10.4, 10.5 depend on it.
- Story 10.2 (scoring) is independent of 10.3/10.4/10.5 and can land in parallel after 10.1.
- Story 10.3 (results) depends on 10.2. Story 10.4 (challenge) depends on 10.2. Story 10.5 (recommend) depends on 10.2 + the 10.1 schema.
- Story 10.6 (loader) depends on 10.2/10.3/10.4/10.5 being registered in the API contract.
- Story 10.7 (6 MVP quizzes) depends on 10.1 + 10.2. Stories 10.8 (home grid lane) and 10.9 (pack page) depend on 10.7.
- Story 10.13 (PII + immutability lints) is independent and can land in parallel with 10.2–10.5.
- Story 10.14 (a11y review follow-ups — B1 / B2 / B3 + high-value) must close BEFORE 10.10 and 10.12 ship.
- Story 10.10 (result card chrome) depends on 10.3 + 10.14 (B3 DOM shape). Story 10.11 (share-card chrome) depends on 10.3 + 10.10. Story 10.12 (Challenge UX) depends on 10.4 + 10.10 + 10.14 (B2).
- Story 10.15 (smoke harness) depends on 10.1–10.13. Story 10.16 (bundle-size) depends on 10.7. Story 10.17 (docs) depends on 10.7 + 10.13 + 10.14. Story 10.18 (pack-composition gate) depends on 10.7 + 10.8. Story 10.19 (retro) depends on all prior stories.
- Cross-pack non-regression: the existing 50 utility tools and 5 utility packs must remain unchanged; `tools.json` `tools` array is append-only. The home-grid renderer is unchanged — the Discover Me lane is appended via the existing data-slug pattern.
- The `check-pack-composition.py` gate from Epic 9 is extended to include the `disc` enum and enforce ≥ 5 ready quizzes; existing 5 packs remain unaffected.