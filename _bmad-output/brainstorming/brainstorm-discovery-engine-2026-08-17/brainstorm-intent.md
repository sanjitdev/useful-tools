---
title: "Discovery Engine Brainstorm — Intent"
created: "2026-08-17"
project: "useful-tools"
mode: "autonomous"
status: "complete"
companion_artifact: "_bmad-output/brainstorming/brainstorm-discovery-engine-2026-08-17/discovery-engine-future-tasks.md"
predecessor_artifact: "_bmad-output/brainstorming/brainstorm-quiz-pattern-2026-08-14/brainstorm-intent.md"
---

# Discovery Engine Brainstorm — Intent

## What we brainstormed
A standalone, data-driven **Discovery Engine** — a pack of personality / recommendation / game experiences (Spirit Animal, Future Partner, What Would You Do, Car Finder, Bike Finder, Career Fit, Millionaire Personality, Friend Challenge, etc.) for useful-tools. The engine is content-first, not code-first: questions, traits, archetypes, and share-card copy ship as JSON; the runtime is a small set of Shell modules that already exist or are scaffolded in the working tree (DC-0..DC-12). The viral mechanism is **Challenge a Friend**: a deterministic URL the sharer sends to one friend, the friend takes the same quiz blind, and the result is a side-by-side compatibility card.

**Not in scope.** The in-tool Quiz Card UX (Story 9.12–9.19, Epic 9) already shipped for `lifespan-simulator`, `calorie-estimator`, etc. This brainstorm covers *separate, standalone experiences built on top of a new Shell layer*, not card-ify-the-existing-tools.

## Why now
- The 2026-08-14 quiz-pattern brainstorm landed a 20-candidate catalog and a "Discover Me" positioning, but no narrative artifact links it to the working-tree DC scaffold (`scripts/dc/dc-0..12`, `tools.schema.json` packs additions, `assets/js/scoring.js`, shell-thin Proxy wiring for `HT.scoring`). This intent is the bridge.
- The 50 existing tools (`tools/<slug>/`) need a top-of-funnel surface that converts curiosity into utility. A well-built personality quiz that points to "Spirit Animal: Wolf → see Focus Timer, Savings, Reflection prompts" is the cheapest growth loop static-only infra can support.
- The DC scaffold has been in working tree since the 2026-08-17 cycle started but has no Epic 10 narrative behind it. This intent + downstream PRD/architecture/UX will fill that gap.

## Constraints baked in (load-bearing, not adjustable)
- **AD-1** Zero runtime third-party libs (only `assets/js/qrcode.js` is vendored). No CDN fonts, no analytics, no tracking.
- **AD-9** No PII. Quiz answers, results, share URLs must survive a privacy audit. Storage keys remain namespaced (`ht.*` runtime, `handy-tools.*` user data).
- **AD-12** No build step. ES2018 vanilla JS. The browser runs the code as-is.
- **AD-14** Shell Public API is stable. The Discovery modules mount via `HT.scoring` / `HT.results` / `HT.challenge` / `HT.recommend` — all page-conditional Proxy modules, same pattern as `HT.quiz`.
- **AD-15** Brownfield rule. The 50 existing tools keep working unchanged. The Discovery Engine is a sibling (`packs.discovery`), not a replacement (`tools` array).
- **Project posture** local-first, keyboard-first, no-accounts, free, public, embeddable. Discovery contents must not require an account, an email, or a payment.
- **No `Math.random`** for result generation. Results are deterministic given (answers, spec). A cyrb53-style hash of the seed is allowed for the Challenge protocol.

## The 6-pack MVP shortlist

Eighteen potential experiences were brainstormed; ten were sorted against four axes (viral-shareable, utility, replay, fits-static-stack). The list below is the **6-pack MVP** — every quiz launches in Epic 10:

| # | Quiz | Category | Route | Why MVP |
|---|---|---|---|---|
| 1 | **What Kind of Person Are You, Really?** | viral | `tools/packs/discovery/personality/index.html` | Identity hook; 12 situational questions; "Quiet Strategist" archetype format |
| 2 | **What Would Your Future Partner Be Like?** | viral | `tools/packs/discovery/partner/index.html` | Relationship-archetype viral mechanic; high share intent |
| 3 | **What Would You Do? — Real Life Situations** | viral | `tools/packs/discovery/decisions/index.html` | Decision-profile archetype; extensible to editions (workplace, money, dating) |
| 4 | **What Is Your Spirit Animal?** | viral | `tools/packs/discovery/spirit-animal/index.html` | Cheap viral traffic; classic archetype format; screenshotable |
| 5 | **What Kind of Friend Are You?** | viral + challenge | `tools/packs/discovery/friend/index.html` | Required seed for the "Challenge a Friend" feature — friendship compatibility card |
| 6 | **Which Car Is Actually Right for You?** | utility | `tools/packs/discovery/car-finder/index.html` | Recommendation quiz pattern (budget/usage/safety ranking); points to budget/finance tools |

The other four from the original 20-candidate list (Bike Finder, Career Fit, Millionaire Personality, Hidden Personality) are deferred to a v2 wave. Each of these comes with a one-page spec when it lands. **Decision rule for deferral:** if a quiz requires external data (cars, cities, careers) that we'd have to hand-curate, defer; if it's pure-archetype, ship now.

## The Challenge-a-Friend loop (viral mechanism)

A quiz has one viral lever: *the result is more interesting when two people compare*. The loop is:

1. User completes a quiz; gets an archetype result + a share URL.
2. Share URL is a **deterministic URL** encoding the **answers hash** (not the archetype). Length budget: ≤ 80 chars. URL state via fragment (per AD-5), no server state.
3. Friend opens the URL; sees a "your friend Sanjit did this quiz — want to find out how compatible you are?" landing page; takes the quiz blind (without seeing Sanjit's answers).
4. After completing, the friend's results page shows a **comparison card**: archetype + compatibility % + a 3-line "what you agree on / what you don't / blind spot".
5. Both URLs remain valid forever; arch immutability is load-bearing (see §Risks).

The loop costs zero ongoing infra: it's two URLs, two static HTML pages, and a small comparison function in the shell module. There is no leaderboard, no analytics, no notification — by design (AD-9, AD-12).

## "Discover Me" navigation IA

The home grid currently shows the 5 utility packs (Finance, Study, Developer, Household, Travel) as top-level lanes plus a free-form grid. The Discovery Engine adds a sixth lane:

```
HOME GRID
├── 🔍 Discover Me (NEW)
│   ├── 1 card per quiz (max 12 in v1 — buffer for cross-pack rotations)
│   ├── Each card: archetype emoji + quiz title + "12 questions · 2 min"
│   └── Subgrouped: "Personality" / "What-If" / "Find My Match" / "Challenge"
├── 💵 Finance · 8 tools
├── 📚 Study · 7 tools
├── 🛠 Developer · 12 tools
├── 🏠 Household · 14 tools
├── ✈ Travel · 9 tools
└── 🔍 Discover Me · 6 quizzes
```

The lane is rendered via the existing pack-page renderer (Story 6.2 / _bmad-output/implementation-artifacts/6-2-pack-page-renderer.md_) with the new `packs.discovery` registration in `tools.json`. No new chrome, no new topbar button, no new settings tab — *the engine is a pack, not a chrome layer*.

## Result-card chrome design intent

Every quiz shares a result-card template (so the catalog feels unified). The chrome, in order top-to-bottom on a 360×640 mobile viewport:

```
┌─────────────────────────────────────┐
│                                     │
│            🐺 THE WOLF              │  ← archetype emoji + name (serif display)
│                                     │
│      Independent · Loyal            │  ← 1-line tagline (kebab-case adjective pair)
│                                     │
│   Independence    ████████░  82%    │  ← trait bars (top 4 traits clamped 0-100)
│   Loyalty         █████████  93%    │
│   Risk            █████░░░░  45%    │
│   Empathy         ███████░░  71%    │
│                                     │
│   YOUR BLIND SPOT                   │  ← "contradiction" line — the share hook
│   You need people more than         │
│   you admit.                        │
│                                     │
│   [ Share Result ]                  │  ← primary CTA above the fold
│   [ Challenge Friend ]              │  ← secondary CTA, only on viral quizzes
│                                     │
└─────────────────────────────────────┘
```

Three rules:
- Share and Challenge buttons are above the fold on a 360×640 viewport (Mobile-first per project-context §1).
- The OG image (1:1 and 9:16 variants pre-baked as static SVGs per archetype) is generated from the same archetype data — no server-side rendering, no fonts to fetch.
- The "blind spot" line is mandatory and intentionally provocative. It is the conversation-starter that makes results worth posting.

## Architecture delta (where this points for the PRD)

The DC scaffold already gives us 4 of the 5 modules the engine needs:
- **`HT.scoring`** (DC-1, mostly done) — `(answers, spec) → {traits, archetype}`. Pure function. ~3 KB gz.
- **`HT.results`** (DC-2) — renders the result-card chrome.
- **`HT.challenge`** (DC-3) — the Challenge-a-Friend URL protocol + comparison function.
- **`HT.recommend`** (DC-4) — recommendation-quiz logic (used by Car Finder; not needed for personality quizzes).
- **`HT.catalog`** (DC-4/6) — the data-driven catalog layer; loads `data.json`, validates against `tools.schema.json` `definitions.quiz-entry`.

The PRD should specify AD-16 (Discovery runtime), AD-17 (data-driven quiz runtime), AD-18 (share-card chrome contract), AD-19 (Challenge URL protocol) as new spine entries. AD-1 / AD-12 / AD-14 / AD-15 remain binding.

## Recommended next steps (sequenced for downstream skills)

1. **bmad-product-brief** — Lock the discovery positioning as a 1-page product brief before downstream work.
2. **bmad-prd** — Write `prd-discovery-engine-2026-08-17/prd.md`. Cross-reference existing 21 FRs; introduce ~12 new FRs (one per major surface) + ~3 NFRs (share-card budget, PII guards, accessibility for reveal animation).
3. **bmad-architecture** — Write `architecture-discovery-engine-2026-08-17/ARCHITECTURE-SPINE.md`. Add AD-16..19.
4. **bmad-ux** — Write `ux-discovery-engine-2026-08-17/{DESIGN,EXPERIENCE,review-rubric,review-accessibility}.md`. Lock the result-card template + the Discover Me lane.
5. **bmad-check-implementation-readiness** — Verify the PRD/Architecture/UX/Epics all align before any code lands.

## Risks (the load-bearing ones from the 130 ideas generated)

| Risk | Mitigation |
|---|---|
| Content authoring takes 3+ weeks per quiz; team burns out before 6 land | Start with archetype-only quizzes (Spirit Animal, Personality, Future Partner) that need <1 day of content work each; defer data-heavy quizzes (Car Finder, Bike Finder, Career Fit) |
| Share URLs become embarrassingly long (full trait hash) | Cap URL hash budget at 80 chars; use cyrb53(seed) instead of full trait vector; measure truncation rate by string length, not bit length |
| OG image is generic instead of archetype-specific, so shares look identical | Pre-bake 1 OG SVG per archetype per quiz at content-build time; lint the set before merge |
| "Challenge a Friend" requires both users to be online simultaneously (it shouldn't) | URL state encodes the *answers hash*, not a session ID; the second user's page computes its own result + compatibility asynchronously |
| Archetype immutability creates drift — user's shared link shows a different result on later visit | Adopt content-addressed archetype IDs (`v1.personality.wolf`); publish the spec version in the URL hash so the receiver can fetch the matching spec |
| PII leaks through quiz questions (location, employer, names) | Maintain a `quiz-question-allowlist` lint script; reject questions whose `prompt` or `options` matches `(city\|employer\|first-?name\|address)` patterns |
| Existing 50 tools break due to new pack-page rendering | Run the existing `make regression-sweep` after every change to `tools.json`; require rc=0 on the 6 mood boards and 12 promoted tools |
| The viral loop underperforms because privacy-conscious users can't share | Share card includes a "Download as image" button (client-side SVG → PNG via canvas) for users who won't post a URL |
| The engine becomes a destination instead of a router to existing tools | Every result card has a "Tools for you" section pointing to 1-3 existing tools that fit the archetype; this is load-bearing for the strategic posture |

## What we did NOT do
- We did not write any tool code beyond what is already in the working tree (DC-0..DC-12 scaffold).
- We did not write the PRD, architecture, UX, or epic narratives — those are the bmad-method cascade.
- We did not authorize the Discovery pack to override `history` retention, the existing share dialog, or embed mode.
- We did not propose analytics, telemetry, or social-media-pixel sharing.
- We did not promise virality — we set the stage for it.

## Artifacts produced
- `_bmad-output/brainstorming/brainstorm-discovery-engine-2026-08-17/brainstorm-intent.md` — this file
- `_bmad-output/brainstorming/brainstorm-discovery-engine-2026-08-17/discovery-engine-future-tasks.md` — the proposed Story 10.1..10.13+ task definitions (companion)
- (downstream, when the bMAD cascade runs) `_bmad-output/planning-artifacts/prds/prd-discovery-engine-2026-08-17/prd.md`, `_bmad-output/planning-artifacts/architecture/architecture-discovery-engine-2026-08-17/ARCHITECTURE-SPINE.md`, `_bmad-output/planning-artifacts/ux-designs/ux-discovery-engine-2026-08-17/*.md`, `epics.md` updated with Epic 10, per-story docs under `_bmad-output/implementation-artifacts/`, and `_bmad-output/implementation-artifacts/sprint-status.yaml` updated with Epic 10 stories in backlog.

---

*Fresh pass — autonomous mode. Sources: existing 2026-08-14 brainstorm-intent.md (640 lines of raw research), docs/tool-ideas.md §"Quiz / personality", working-tree DC scaffold, project-context.md, epics.md. 130 ideas generated across 7 lenses (SCAMPER, First Principles, Six Thinking Hats, Inversion, Random Stimulus, Forced Relationships, Failure Modes); top 6 selected for MVP; risk table extracted from the pre-mortem.*
