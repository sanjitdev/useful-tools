# Tool Ideas Triage — `docs/tool-ideas.md` vs Existing Epics

**Date:** 2026-08-10
**Source:** `docs/tool-ideas.md` (20 ideas)
**Existing scope:** 35 tools already shipped + 7 epics (76 backlog stories)
**Project constraints** (load-bearing per `project-context.md` §1, `epics.md` Epic 1, and the brownfield AD-15 rule):
- Static-only, no build, no transpilation
- Zero third-party runtime libraries (only vendored QR generator; no CDN imports)
- No accounts, no analytics, no tracking, no telemetry
- No monetization, no payment processing
- File:// compatible (except where service worker is needed)
- Free, public, embeddable
- Per-tool storage `handy-tools.*`, runtime `ht.*` (AD-6)

---

## How to read this

Each idea gets one of five classifications:

| Code | Meaning |
|---|---|
| **DUPLICATE** | A functionally equivalent tool already exists in `tools/`. |
| **FIT_EXISTING_EPIC** | Concept extends an existing epic or backlog story cleanly. |
| **NEW_EPIC_CANDIDATE** | Substantial new surface; warrants its own epic or a multi-story add-on to Epic 6. |
| **NEEDS_EXTERNAL_LIB_FUTURE** | Conceptually fit but requires a runtime dep we don't allow yet. Park for a future "vendoring" wave. |
| **REJECT_OFF_MISSION** | Fundamentally incompatible with the project's no-accounts/no-tracking/no-money/free/local-first posture. Document why, do not implement. |

---

## Triage Table

| # | Idea | Core primitive | Classification | Notes / Routing |
|---|---|---|---|---|
| 1 | Smart Content Summarizer (AI) | NLP text → bullets | **REJECT_OFF_MISSION** | Requires server-side LLM (no third-party libs allowed; no analytics/CDN; not local). Pure client-side NLP at this quality needs WASM models or fetch to an API — both off-mission. |
| 2 | Meeting Debriefer & Action Item Extractor | Auto-transcribe meetings | **REJECT_OFF_MISSION** | Needs microphone access + transcription API (Whisper cloud or on-device WASM). Both fail the constraints. |
| 3 | Multi-Criteria Decision Matrix | Weighted-option scoring | **DUPLICATE** | `tools/eisenhower-matrix/` already covers weighted decision matrices. The "Buy a Car / Choose a College" templates map directly onto Story 6.3 (Pack taxonomy doc) or a new template-set in `tools/eisenhower-matrix/`. |
| 4 | Predictive Maintenance Planner | Service-date tracking + reminders | **NEW_EPIC_CANDIDATE** | This is a real *new tool*: schedule-driven notifications. Pure client-side, fits the suite. Best routed to **Epic 6** as a new tool story (alongside 6.4–6.18). Could be a *Household* pack tool: `maintenance-reminder`. Storage: `handy-tools.maintenance.<item>`. No external lib needed. |
| 5 | Custom Personal Dashboard Builder | Widget composition | **REJECT_OFF_MISSION** | Drag-and-drop dashboard with cross-account OAuth (Google Calendar, fitness apps). Requires API tokens, OAuth flows, server-side refresh — all off-mission. The "no accounts" rule kills it. |
| 6 | Personalized Shopping & Style Concierge | AI taste profile | **REJECT_OFF_MISSION** | Affiliate tracking, AR try-on, retailer catalog scraping. Off-mission on multiple axes. |
| 7 | Color Palette Generator | Color harmony from input | **NEW_EPIC_CANDIDATE** | Pure client-side; no dep. Slight overlap with `tools/color-tools/` — check whether it has palette-from-image extraction. If not, add as a new tool in Epic 6. Could also be a Story under Epic 6 to extend `color-tools` with image-extraction + WCAG checks. **NEEDS EXTERNAL LIB?** No — color math is trivial (HSL conversions + WCAG contrast ratios). |
| 8 | Pomodoro Focus Timer with Analytics | Work/break timer + stats | **DUPLICATE** | `tools/pomodoro-timer/` exists. Analytics (charts) already covered by Story 3.6 history-panel shape + an Epic 2 history entry; the "long-term history sync across devices" is the existing export/import (Story 3.7/3.8). "Block distracting sites" is a browser-extension surface, off-mission for a web app. |
| 9 | Pantry Meal Planner & Grocery Minimizer | Pantry → recipes | **NEW_EPIC_CANDIDATE** | Pure client-side; would be a Household or Travel pack tool. No external lib (basic string match on ingredients). But: recipe database needs to ship *with* the tool — local JSON of recipes, hand-curated, no third-party API. Worth a Story in Epic 6 (`grocery-list-builder` already exists in 6.13 — this is the inverse direction, **refrigerator → recipes**). |
| 10 | Resume–Job Matching AI | Keyword gap analysis | **NEEDS_EXTERNAL_LIB_FUTURE** | "AI" implied scoring is fine as plain keyword match; can ship as a **Study pack** tool without ML. The "LinkedIn integration" is off-mission. Route as Epic 6 tool, but park any "AI scoring" enhancement until a local ML model is vendored. |
| 11 | Social Media Bio Generator | Template + word substitution | **NEW_EPIC_CANDIDATE** | Pure client-side templates + simple text scoring. No NLP. Could ship as a Developer/Study pack tool. The "A/B test analytics" enhancement is off-mission; just generate 3 variants and let the user copy. |
| 12 | Plant Identifier & Care Scheduler | Photo → species ID | **REJECT_OFF_MISSION** | Computer-vision species ID needs a model (TensorFlow.js, ONNX runtime) — that's a vendoring decision, and a heavy one. The *care scheduler* part alone (#4 shape) is feasible; **split**: schedule part → Epic 6 (extension of #4), photo-ID part → `NEEDS_EXTERNAL_LIB_FUTURE` until we vendor a plant-ID model. |
| 13 | AI Travel Itinerary Generator | Trip planning | **REJECT_OFF_MISSION** | LLM-driven, real-time data on closures/crowds, partner bookings. Off-mission on multiple axes. The static piece — *a hand-curated template itinerary generator* — could be a Travel pack tool, but that's a different scope; not a clean fit. |
| 14 | Habit Coaching Platform | Streaks + nudges | **DUPLICATE** | `tools/habit-tracker/` already exists. The "behavioral science / gentle reminders at optimal times" enhancement is implementable as a Story that extends `habit-tracker`. The "premium content / coaching forums" enhancements are off-mission. |
| 15 | Automated Form & Document Generator | Questionnaire → PDF | **NEW_EPIC_CANDIDATE** | Pure client-side templates → PDF generation. **NEEDS EXTERNAL LIB FUTURE**: PDF generation in browser without a dep is awkward. Either vendor a small PDF lib (similar to vendoring qrcode.js) or generate printable HTML + let the user print-to-PDF (Story 3.10's print stylesheet handles the print half). A Developer/Finance pack tool. |
| 16 | Local Discovery & Recommendation Engine | Crowdsourced places | **REJECT_OFF_MISSION** | Crowdsourcing requires server-side moderation, user accounts, geofencing permissions. Off-mission. |
| 17 | Branching Story Editor | Choose-your-own-adventure | **NEW_EPIC_CANDIDATE** | Pure client-side; export-to-ePub needs a vendored lib. The editor + reader + analytics-on-branches is feasible as a Study pack tool. Collab editing needs server (off-mission). Single-author editor + sharable reader + JSON export → fits. **NEEDS EXTERNAL LIB FUTURE** if ePub export is required. |
| 18 | Group Poll & Prioritization Tool | Multi-voter tally | **REJECT_OFF_MISSION** | Requires user accounts or anonymous-but-shared state. Local-only polls (one device, multiple people taking turns) are technically feasible but a niche tool. Off-mission as a primary tool; **revisit** if "Decision Wheel" expansion needs it. |
| 19 | AI Gift Recommender | Recipient profile → gifts | **REJECT_OFF_MISSION** | Affiliate links + retailer catalog scraping. Off-mission. |
| 20 | Productivity & Time Zone Planner | Calendar integration | **REJECT_OFF_MISSION** | "Sync with Google Calendar" requires OAuth + server-side refresh. The static piece — *a pure-local timezone visualizer* — is **DUPLICATE**: `tools/world-clock/` already does that. Cross-team meeting-time suggestion needs an OAuth calendar API; off-mission. |

---

## Summary counts

| Classification | Count |
|---|---|
| DUPLICATE (already in `tools/`) | 3 |
| FIT_EXISTING_EPIC | 0 |
| NEW_EPIC_CANDIDATE | 7 |
| NEEDS_EXTERNAL_LIB_FUTURE | 1 |
| REJECT_OFF_MISSION | 9 |

---

## Cross-cutting off-mission notes (Enhancements / Monetization)

Every idea's **Enhancements** and **Monetization** sections include language that doesn't fit:

- **Off-mission patterns:**
  - "Premium tier", "subscription", "monthly plan", "freemium", "API access for third parties"
  - "Affiliate links", "sponsored", "ads"
  - "Sync with Google Calendar / LinkedIn / Slack / Teams / Fitbit"
  - "Community QA", "coaching forums", "social accountability"
  - "AI" / "NLP" / "ML" without specifying client-side
  - "Auto-join meeting", "calendar integration"
  - "AR / virtual try-on", "barcode scanner" (camera + model)
  - "Real-time updates" (closures, crowds, prices)
  - "Translate to multiple languages" (Epic 7 covers this; not an idea-specific enhancement)

- **On-mission patterns that recur in the file:**
  - Pure client-side calculation (color math, scoring, scheduling, templating)
  - Local JSON catalogs (recipes, palettes, quotes, templates) shipped *with* the tool
  - WCAG / accessibility checks
  - Export/import via the existing `Story 3.7` / `3.8` shape
  - Print output (covered by `Story 3.10`)

The Enhancements/Monetization sections should be **stripped or rewritten** if any of these ideas are added. The file reads like AI-generated SaaS-listicle material — its bias is toward paid, connected, server-driven features that don't match this project.

---

## Routing Proposal

### 1. Already covered — no action

- **#3 Multi-Criteria Decision Matrix** → folds into `tools/eisenhower-matrix/` as templates; templates spec lands in `docs/pack-taxonomy.md` (Story 6.3).
- **#8 Pomodoro** → no new tool. `tools/pomodoro-timer/` exists; analytics extensions land in Epic 2 history work (Stories 2.3, 3.6).
- **#14 Habit Coaching** → no new tool. `tools/habit-tracker/` exists; the "behavioral-science" enhancement is implementable as a Story that extends the existing tool.

### 2. Fit into Epic 6 (new tool stories)

These are good candidates for Epic 6 backlog (currently 6.3–6.20). They are pure client-side, need no library, and have clear local-storage shape:

| Idea | Proposed slug | Pack |
|---|---|---|
| #4 Predictive Maintenance | `maintenance-reminder` | Household |
| #7 Color Palette Generator | extend `color-tools` (or new `color-palette-generator`) | Developer / Design |
| #9 Pantry Meal Planner | `pantry-meal-planner` | Household |
| #11 Social Media Bio Generator | `social-bio-generator` | Developer |
| #15 Form & Document Generator | `document-generator` | Developer / Finance |
| #17 Branching Story Editor | `branching-story-editor` | Study |

(#10 Resume-Job Match — keyword only, no AI — also fits here as a Study pack tool, but mark the AI-enhancement as `NEEDS_EXTERNAL_LIB_FUTURE`.)

### 3. New epic candidate?

None of the 20 ideas warrant a *new* epic. Each is a single Tool, not a cross-cutting capability. Adding them to Epic 6 (which is "Packs + new tools") is the right routing — Epic 6 is already in-progress (6.1, 6.2 done) and explicitly reserves stories 6.3–6.20 for new tools.

If we grow Epic 6 past 6.20 with more tool stories (6.21, 6.22, …), that's fine; the epic has 15+ planned tool slots already per its goal.

### 4. Parked for external-lib future

- **#10** Resume-Job AI scoring
- **#12** Plant photo-ID (the schedule part is fine; photo-ID needs a vendored CV model)
- **#15** PDF generation (or: use print-to-PDF via Story 3.10's print stylesheet and skip the vendoring)
- **#17** ePub export (JSON export is fine; ePub needs a lib)

These should be parked in a `docs/future-ideas.md` with explicit "blocked until we vendor X" notes, **not** added to the active backlog.

### 5. Rejected (off-mission) — document and close

#1, #2, #5, #6, #13, #16, #18, #19, #20 (and the AI/photo-ID halves of #10, #12) require server infrastructure, user accounts, paid tiers, or third-party integrations that violate `project-context.md` §1 and Epic 1's AD-13 / AD-14 / AD-15 posture.

Recommendation: leave them in `docs/tool-ideas.md` but add a header comment explaining they're **informational research material**, not candidates for this project. Or move them to `docs/rejected-ideas.md` with the rejection rationale per item (more useful for future maintainers).

---

## Concrete next steps (proposal, awaiting your decision)

1. **Decide on Epic 6 route** — add 6 (or fewer) new tool stories to Epic 6 backlog:
   - `6-21-maintenance-reminder` (from #4)
   - `6-22-pantry-meal-planner` (from #9)
   - `6-23-social-bio-generator` (from #11)
   - `6-24-document-generator` (from #15, scoped to HTML/print output, not PDF)
   - `6-25-color-palette-generator` (from #7) **or** extend Story 6.4 with image-extraction
   - `6-26-branching-story-editor` (from #17)
2. **Decide on the deferred backlog** — move parked ideas (#10 ML half, #12 photo-ID, #17 ePub, #15 PDF) to `docs/future-ideas.md` with vendor-blocking notes.
3. **Decide on rejected file** — keep `docs/tool-ideas.md` as-is for posterity, OR move rejected ideas to `docs/rejected-ideas.md` with rationale.
4. **Re-scope Epic 6's goal** — its current goal says "12-15 new tools" (FR-21). Adding 6 more fits inside that envelope.

The full triage table above (with reasoning per idea) is the deliverable; the routing proposal is what needs your sign-off before I touch `epics.md` or `sprint-status.yaml`.

---

*Analysis done. Awaiting Sanjit's decision on the routing proposal before modifying any planning artifacts.*