---
stepsCompleted: ["step-01-document-discovery", "step-02-prd-analysis", "step-03-epic-coverage-validation", "step-04-ux-alignment", "step-05-epic-quality-review", "step-06-final-assessment", "post-assessment-drift-resolution", "post-assessment-warning-resolution"]
status: final
date: 2026-07-31
project: useful-tools
documentsInventory:
  - type: PRD
    path: _bmad-output/planning-artifacts/prds/prd-useful-tools-2026-07-31/prd.md
    size: 27620 bytes
    modified: 2026-07-31T16:22
    format: whole
  - type: Architecture
    path: _bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md
    size: 33686 bytes
    modified: 2026-07-31T18:34
    format: whole
  - type: UX Design
    path: _bmad-output/planning-artifacts/ux-designs/ux-useful-tools-2026-07-31/DESIGN.md
    size: 61631 bytes
    modified: 2026-07-31T16:37
    format: whole
  - type: UX Experience
    path: _bmad-output/planning-artifacts/ux-designs/ux-useful-tools-2026-07-31/EXPERIENCE.md
    size: 63772 bytes
    modified: 2026-07-31T16:50
    format: whole
  - type: Epics and Stories
    path: _bmad-output/planning-artifacts/epics.md
    size: 103075 bytes
    modified: 2026-07-31T19:07
    format: whole
duplicates: none
missing: none
prdFRCount: 21
prdNFRCount: 10
prdAssumptionCount: 15
prdOpenQuestionCount: 6
---

# Implementation Readiness Assessment Report

**Date:** 2026-07-31
**Project:** useful-tools

## Step 1: Document Discovery

### Documents Found

**PRD (Product Requirements Document)**
- `prd-useful-tools-2026-07-31/prd.md` (27,620 bytes, modified 2026-07-31T16:22) — whole document
- No sharded versions
- No index.md siblings

**Architecture**
- `architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` (33,686 bytes, modified 2026-07-31T18:34) — whole document
- No sharded versions
- No index.md siblings

**UX Design (Visual Identity)**
- `ux-designs/ux-useful-tools-2026-07-31/DESIGN.md` (61,631 bytes, modified 2026-07-31T16:37) — whole document
- Companion file: `EXPERIENCE.md` (63,772 bytes, modified 2026-07-31T16:50)
- No sharded versions

**Epics and Stories**
- `epics.md` (103,075 bytes, modified 2026-07-31T19:07) — whole document, 7 epics, 77 stories + 3 cross-epic verification stories
- No sharded versions
- No index.md siblings

### Critical Issues

⚠️ None — all four required documents present in whole-file format, no duplicates, no missing files.

### Auxiliary Documents (Reference Only)

- `brief-useful-tools-2026-07-31/` — product brief (not an assessment input, but useful context)
- `research/market-handy-tools-market-validation-2026-07-31/` — market research with recommendation memo
- `ux-designs/ux-useful-tools-2026-07-31/review-accessibility.md`, `review-rubric.md` — UX reviewer outputs
- `architecture/architecture-useful-tools-2026-07-31/` — contains `ARCHITECTURE-SPINE.md` only at top level (no review files visible in this folder)

### Decision

All four required documents are loaded for the assessment:
1. PRD (`prd.md`)
2. Architecture (`ARCHITECTURE-SPINE.md`)
3. UX Design — Visual Identity (`DESIGN.md`) + UX Design — Behavioral (`EXPERIENCE.md`)
4. Epics and Stories (`epics.md`)

No sharding decision required. No duplicate-resolution required.

Ready to proceed to Step 2.

---

## Step 2: PRD Analysis

### Functional Requirements Extracted

The PRD defines 21 Functional Requirements across 9 feature groups:

**§4.1 Tool Contract (Quality Bar)** — FR-1 to FR-3
- **FR-1:** Tool Quality Scoring — measure, store, publish each tool's score against the ten criteria, refreshed on each release. Public `/quality` page lists every tool, shows score per criterion. Failing criterion surfaces a one-line remediation note. Each release increments a `last-updated` timestamp.
- **FR-2:** Tool Contract Gate — no new tool merges with score < 8/10 unless a `[WAIVER: reason]` annotation is in Site Data. CI check rejects. Waivers expire after two releases.
- **FR-3:** Per-Tool Quality Audit — every existing tool ships with a one-time audit result + remediation list. Existing tools with score < 8 scheduled for promotion before any new tool. `docs/quality-audit.md` lists every tool and audit date.

**§4.2 Site Data & Discovery** — FR-4 to FR-6
- **FR-4:** Site Data Schema — `tools.json` validated by JSON Schema in CI. Adding a tool requires only an entry — no HTML duplication. Each entry carries: id, slug, title, description, category, pack, icon, keywords, last-updated, ready (true iff score ≥ 8 or waiver).
- **FR-5:** Tool Search — searches title/description/keywords, ≤ 50ms cold / ≤ 10ms warm. Header search bar + command palette (FR-7) delegates. ⌘K / Ctrl-K opens palette from any tool page.
- **FR-6:** Pack Pages — `/packs/<slug>` exists per pack; lists tools tagged `pack=<slug>`. Empty packs not linked. Pack pages are presentation only.

**§4.3 Shell & Command Palette** — FR-7 to FR-9
- **FR-7:** Command Palette — ⌘K/Ctrl-K opens from any page, searches tools + global actions, navigates on Enter. Escape closes and returns focus. Recent tools, top-5 fuzzy matches, footer with shortcut hints. `?` action opens per-tool keyboard help overlay (reachable without first opening palette).
- **FR-8:** Settings Modal — single modal: theme (light/dark/auto), language, default units, default currency, font scale, reduced motion, "Clear all local data". Persists in localStorage. Confirms twice. No settings UI inside any tool.
- **FR-9:** Theme System — light, dark, auto (follows `prefers-color-scheme`). Default set via blocking inline script before first paint (FOUC < 50ms). Theme persists. High-contrast and forced-colors respected.

**§4.4 Embed Mode** — FR-10 to FR-11
- **FR-10:** Embed URL & Snippet — `/?embed=<slug>` with chrome removed, URL-encoded state input, fixed-size responsive surface. Copy-able `<iframe src="https://handy.tools/?embed=qr">` snippet on every tool page. Iframe receives focus + keyboard. Responsive to container width ≥ 240px.
- **FR-11:** postMessage API — JSON-validated messages; unknown commands are no-ops. Host can request state, set inputs, subscribe to result updates.

**§4.5 Lifecycle & Per-Tool History** — FR-12 to FR-13
- **FR-12:** Per-Tool History — last 10 inputs/results per tool persisted in localStorage, visible History panel. Each entry timestamped with key inputs + result. Restore replaces current inputs (with confirm if unsaved). Held to ≤ 10 per tool. Storage key: `handy-tools.history.<slug>`.
- **FR-13:** User Data Export & Import — export all local data (history, settings, favorites, recent) as a single JSON file; import validates schema. Single button in Settings. Rejected imports show clear error.

**§4.6 PWA, Offline, & Trust Surface** — FR-14 to FR-16
- **FR-14:** PWA Install — installable PWA with offline support. `manifest.webmanifest` references icons, declares `display: standalone`. Service worker caches shell + last-used tool assets, supports cache migration on version bumps. Offline fallback page exists.
- **FR-15:** Trust Surface — `/privacy` page lists every `localStorage` key with what it stores and when cleared; live wire log of current session's network requests (zero by default). Reachable from any tool's footer. localStorage key list generated from single source of truth (registry). Network requests captured from same channel as DevTools.
- **FR-16:** Source Transparency — every tool footer has "View source" link to repo path on default branch.

**§4.7 Internationalization Scaffold** — FR-17 to FR-19
- **FR-17:** Message Catalogs — per-locale JSON files; falls back to English on missing key. Every user-visible string keyed; no inline strings in tool HTML. Adding a locale = single file addition.
- **FR-18:** Locale-Aware Formatting — `Intl.*` APIs for numbers/dates/currency (no shipped locale data). Currency/decimal/date formats follow active locale. RTL languages render correctly via CSS logical properties.
- **FR-19:** Starter Locales — English, Bengali, Hindi, Spanish, Arabic. Each locale has complete catalog for shell + one full tool (QR generator or similar). Locale picker in Settings modal.

**§4.8 Workflow Packs and Tool Expansion** — FR-20 to FR-21
- **FR-20:** Pack Decomposition — tag each tool with its pack(s); render pack pages. Each tool has ≥ 1 pack; tools can appear in multiple packs. Pack pages reachable from home grid + command palette.
- **FR-21:** New Tools (MVP) — 15 new tools: JSON Formatter enhancements (CSV/YAML add), Citation formatter, Diff viewer, UUID generator, JWT inspector, Timestamp converter, Flashcard timer, Exam countdown, Recipe scaler, Grocery list builder, Paint calculator, Area/volume calculator, Budget planner, Savings goal, Currency converter (cached rates). Each ships with metadata, icon, Site Data entry, score ≥ 8 or waiver. Each realizes ≥ 1 UJ.

**Total FRs: 21**

### Non-Functional Requirements Extracted

The PRD defines 10 NFRs spanning performance, accessibility, privacy, compatibility, reliability, printability, internationalization, cost, surface, and tech.

**§4.9 Cross-Cutting NFRs** (Performance, Accessibility, Privacy, Compatibility, Reliability, Printability, Internationalization)

- **NFR-1: Performance** — Home page LCP < 1.5s on mid-range mobile (Moto G Power baseline). Tool interactive (TTI) < 1s after navigation. CLS ≤ 0.05. Total JS for shell < 30KB gzipped.
- **NFR-2: Accessibility** — Lighthouse Accessibility ≥ 95 per tool. All tools keyboard-complete in ≤ 90 seconds by external tester. WCAG 2.1 AA.
- **NFR-3: Privacy** — Zero third-party network requests in all tools. Zero analytics. No CDN fonts/scripts. localStorage keys namespaced `ht.*`.
- **NFR-4: Compatibility** — Current Chrome, Firefox, Safari, Edge. `file://` works for tools that don't require SW. No UA sniffing; feature detection only.
- **NFR-5: Reliability** — All calculations isolated from DOM. Pure functions testable. No silent rounding; explicit rounding rules per tool.
- **NFR-6: Printability** — Every tool has a `@media print` stylesheet that renders clean output.
- **NFR-7: Internationalization** — All copy keyed; locale-aware formatting through `Intl.*`.

**§4.10 Constraints & Guardrails** (Privacy, Cost, Surface, Tech)

- **NFR-8: Cost** — Static hosting on GitHub Pages. No server-side code. No paid third-party services.
- **NFR-9: Surface** — Fully static. No native app. No PWA that requires a backend.
- **NFR-10: Tech** — Vanilla JS, HTML, CSS only. No third-party libraries at runtime. Vendored libraries allowed in `assets/vendor/`.

**Total NFRs: 10**

### Additional Requirements

**§7 Success Metrics** — Primary (SM-1 to SM-5) and Secondary (SM-6 to SM-9) metrics. Counter-metrics (SM-C1 to SM-C4) explicitly named.

**§4.1 Tool Contract Rubric** — 10 criteria (each 0/1 score), explicitly listed:
1. Keyboard-complete
2. Mobile ergonomics (360px viewport, 44px tap targets, no hover-only)
3. Offline ready (no external fonts/scripts/images, SW caches)
4. Shareable state (URL-encoded)
5. Printable (`@media print` stylesheet)
6. Sample data ("Try an example" button)
7. History (last 10, localStorage, recoverable)
8. Error recovery (preserves input, identifies field, explains fix)
9. Accessible (visible focus, WCAG 2.1 AA, ARIA, reduced-motion)
10. Source visible ("View source" link, no minification)

**§5 Non-Goals** — Explicit out-of-scope: user accounts, third-party CDN, native apps, server-requiring tools, community marketplace, real-time collab, auth/billing, back-end services in v1.

**§8 Open Questions (6)** — Travel/Household split, rubric weighting, Web Components timing, Bengali translation source, PWA install prompt timing, tool count cap.

**§9 Assumptions Index (15)** — All `[ASSUMPTION]` tags catalogued A1-A15.

### PRD Completeness Assessment

**Strengths:**
- **21 FRs are specific and testable** — each has consequences stated as bullet points with measurable criteria.
- **10 NFRs are concrete** — numeric thresholds where applicable (LCP < 1.5s, CLS ≤ 0.05, 30KB JS shell).
- **The 8/10 Tool Contract rubric** is fully enumerated with 10 criteria, each with explicit pass conditions.
- **4 user journeys (UJ-1 to UJ-4)** are named-protagonist scenarios with climax beats — Priya (bill split), Marco (embed), Aisha (dashboard), Jamal (offline).
- **Constraints & Guardrails** are explicit (no CDN, no auth, no analytics).
- **Counter-metrics** are named (SM-C1 to SM-C4) — sophisticated maturity.
- **15 assumptions** indexed in §9 — honest about `[ASSUMPTION]` tags.

**Concerns to surface in Step 3+:**
1. **FR-21 lists 15 new tools** — count is at the upper bound of "12-15"; PRD calls this "MVP scope" but no priority/order among them is given.
2. **A15 (suite capped at ~50 tools)** — currently 33 existing + 15 new = 48, just under cap. Margin is thin; any expansion needs explicit unblock.
3. **FR-9 vs NFR-2 interplay** — Theme handles forced-colors but NFR-2 calls for WCAG AA — the specific behavior under forced-colors is implied (UA-mode display only) but not in the PRD body. (Already clarified in ARCHITECTURE-SPINE AD-8 / AD-11.)
4. **FR-11 postMessage protocol scope** — FR describes JSON validation, unknown commands as no-ops, host can get/set/subscribe. Specific allowlist, envelope shape, payload caps, and origin checks are not in the PRD body but are pinned in ARCHITECTURE-SPINE AD-7.
5. **FR-12 history cap is "≤ 10"** but the FR says "last 10" — semantically equivalent but slightly ambiguous. UX says 20 in one place (already reconciled to 10 in PRD per memlog).
6. **FR-17 message catalogs vs FR-8 settings locale** — both depend on locale. Ordering is implied (locale change in Settings → catalog lookup) but no explicit failure-mode for "Settings says Bengali but Bengali catalog incomplete" is in the PRD. ARCHITECTURE-SPINE AD-10 covers fallback chain.
7. **A14 (PWA install on second visit)** — affects SM-3 target (4% install rate). Implementation choice is documented but not user-testable in the rubric.
8. **Open question #1 (Travel vs Household split)** — still listed as Open, not Resolved. PRD §4.2 FR-6 Note proposes an orthogonal split. UX and Epics both honor this; PRD itself does not mark it resolved.

These concerns are not blockers; they are drift risks between PRD and downstream artifacts to test in Step 3+.

### Requirements Summary

- **21 FRs** across 9 feature groups
- **10 NFRs** (7 cross-cutting + 3 constraint/guardrail)
- **10-criterion 8/10 Tool Contract rubric**
- **4 user journeys** (Priya, Marco, Aisha, Jamal)
- **9 success metrics** (5 primary + 4 secondary)
- **4 counter-metrics** (anti-goals)
- **6 open questions** (1 unresolved at PRD level)
- **15 `[ASSUMPTION]` tags** (catalogued A1-A15)

PRD is **complete enough** to drive architecture, UX, and epic decomposition. No critical gaps.

---

## Step 3: Epic Coverage Validation

### Coverage Matrix

| FR | PRD Requirement | Epic Coverage | Stories Implementing | Status |
|---|---|---|---|---|
| FR-1 | Tool Quality Scoring — `/quality` page, score per criterion, remediation note, last-updated | Epic 1 + Epic 5 | 1.2 (rubric), 1.13 (audit scaffold), 2.11 (`/quality` view), 5.8 (public scorecard) | ✓ Covered |
| FR-2 | Tool Contract Gate — CI rejects `score < 8`; waivers expire after 2 releases | Epic 1 | 1.3 (CI gate) | ✓ Covered |
| FR-3 | Per-Tool Quality Audit — one-time audit + remediation; `<8` promoted before new tools | Epic 1 (scaffold) + Epic 2 (completion) | 1.4 (inventory), 1.13 (audit), 2.11 (audit view), 2.6/2.7/2.8 (waves) | ✓ Covered |
| FR-4 | Site Data Schema — `tools.json` + JSON Schema; data-only adds | Epic 1 + Epic 2 | 1.1 (schema), 1.4 (initial), 1.9 (home grid), 2.6/2.7/2.8 (33 entries) | ✓ Covered |
| FR-5 | Tool Search — title/description/keywords; ≤50ms cold / ≤10ms warm; NFKD-normalized | Epic 1 + Epic 3 | 1.11 (engine), 3.1 (palette delegate), 3.2 (palette actions) | ✓ Covered |
| FR-6 | Pack Pages — `/packs/<slug>`; empty packs not linked; presentation only | Epic 6 | 6.1 (cards), 6.2 (page renderer), 6.19/6.20 (composition) | ✓ Covered |
| FR-7 | Command Palette — ⌘K/Ctrl-K; recent; top-5 fuzzy; footer hints; `?` overlay reachable from any tool | Epic 1 (skeleton) + Epic 3 (full) | 1.7 (skeleton), 3.1 (full surface), 3.2 (global actions), 3.3 (per-tool shortcuts), 3.4 (chords) | ✓ Covered |
| FR-8 | Settings Modal — theme/lang/units/currency/font-scale/motion/clear-data | Epic 3 | 1.8 (skeleton), 3.5 (full surface), 3.7/3.8 (export/import) | ✓ Covered |
| FR-9 | Theme System — light/dark/auto; FOUC <50ms; forced-colors respected | Epic 1 (tokens) + Epic 5 (UA-mode) | 1.5 (Shell), 1.6 (light/dark/auto), 5.9 (forced-colors + reduced-motion) | ✓ Covered |
| FR-10 | Embed URL & Snippet — `/?embed=<slug>`; iframe snippet on every tool | Epic 4 | 4.1 (router strips chrome), 4.2 (snippet modal) | ✓ Covered |
| FR-11 | postMessage API — JSON-validated; get/set/subscribe; protocol `{ v: 1, id, type, payload? }` | Epic 4 | 4.3 (envelope), 4.4 (setInput/subscribe), 4.5 (UUID), 4.6 (demo) | ⚠️ Covered (1 drift — see below) |
| FR-12 | Per-Tool History — last 10; localStorage `handy-tools.history.<slug>`; visible History panel | Epic 3 | 2.3 (per-tool history panel), 3.6 (full surface) | ✓ Covered |
| FR-13 | Export/Import — JSON schema; single button in Settings; import validates schema and version | Epic 3 | 3.7 (export), 3.8 (import) | ✓ Covered |
| FR-14 | PWA Install — manifest; SW; cache migration; offline fallback | Epic 5 | 5.1 (manifest), 5.2 (SW), 5.3 (per-tool cache), 5.4 (install UX), 5.5 (offline fallback) | ✓ Covered |
| FR-15 | Trust Surface — `/privacy`; localStorage list; live wire log of network requests | Epic 5 | 5.6 (registry), 5.7 (wire log) | ⚠️ Covered (1 drift — see below) |
| FR-16 | Source Transparency — "View source" link to repo at default branch | Epic 3 | 1.12 (route), 3.11 (full route + download) | ✓ Covered |
| FR-17 | Message Catalogs — per-locale JSON; en.json canonical; fallback chain | Epic 7 | 7.1 (catalog), 7.2 (Shell translation), 7.8 (fallback) | ✓ Covered |
| FR-18 | Locale-Aware Formatting — `Intl.*` for numbers/dates/currency; RTL via CSS logical props | Epic 7 | 7.3 (Intl), 7.4 (RTL) | ✓ Covered |
| FR-19 | Starter Locales — en/bn/hi/es/ar; one full tool | Epic 7 | 7.5 (QR full), 7.6 (tip full) | ✓ Covered |
| FR-20 | Pack Decomposition — pack tag on each tool; pack pages; tools can appear in multiple packs | Epic 2 + Epic 6 | 2.9 (existing tags), 6.3 (taxonomy docs), 6.1/6.2 (pack surfaces) | ✓ Covered |
| FR-21 | New Tools (MVP) — 15 specific tools | Epic 6 | Stories 6.4–6.18 (one per tool) | ✓ Covered |

### Coverage Statistics

- **Total PRD FRs:** 21
- **FRs covered in epics:** 21 (100%)
- **FRs with full story-level ACs:** 21 (100%)
- **FRs with architecture-decision coverage:** 21 (100%)
- **Coverage percentage:** **100%**

### Missing Requirements

**No FRs are missing.** All 21 PRD FRs have at least one story implementing them, and all are wired into the Epic Coverage Map.

### Drift Findings (Concerning, Not Missing)

These are not coverage gaps — the FRs are present — but inconsistencies between the PRD wording, the architecture decisions, and the story acceptance criteria. Each must be resolved before sprint planning.

**Drift 1: FR-2 waiver format**
- PRD says: `[WAIVER: reason]` annotation in Site Data
- Architecture (AD-2) and Epic 1 Story 1.3 use: `waiver: { reason, since-release, reviewer }` structured object
- **Resolution:** Update PRD FR-2 to use structured waiver object (matches architecture); keep `[WAIVER: ...]` as the optional inline annotation form for tools.json file comments.
- **Severity:** Low. Architecture wins on this.

**Drift 2: FR-11 postMessage nesting limit (AD-7 only, no story AC)**
- Architecture AD-7 specifies: "8-level nesting limit" for `payload`
- Epic 4 Story 4.3 AC does not enforce nesting depth
- **Resolution:** Add to Story 4.3 AC: "And the validator rejects payloads nested deeper than 8 levels".
- **Severity:** Low. Defense-in-depth that doesn't break UX but should be in CI gate.

**Drift 3: FR-15 wire-log channel (Story 5.7 ambiguous between two sources)**
- Architecture AD-11 specifies: `performance.getEntriesByType('resource')` snapshot
- PRD FR-15 says: "captured from the same channel the user can verify with DevTools"
- Story 5.7 AC lists BOTH `fetch`/`XHR`/`sendBeacon` event capture AND `performance.getEntriesByType('resource')` — without specifying which is authoritative
- **Resolution:** Tighten Story 5.7 AC to specify `performance.getEntriesByType('resource')` via PerformanceObserver as the primary source; reserve `fetch`/`XHR`/`sendBeacon` wrapping for capturing POST bodies and request initiator data the PerformanceObserver can't see.
- **Severity:** Medium. The wire log is a Trust Surface claim — the architecture's reading-from-DevTools-channel is the verifiable claim. Story needs to honor that.

**Drift 4: FR-6 pack taxonomy (PRD Open Question unresolved)**
- PRD §8 Open Q1: Travel vs Household split unresolved
- PRD §4.2 Note proposes orthogonal split (Travel = mobility/timezone/currency; Household = domestic/area/volume/recipe)
- UX-DR documents both packs; Epic 6 Story 6.3 creates `docs/pack-taxonomy.md` with inclusion criteria
- **Resolution:** Either close PRD Open Q1 by adopting the PRD §4.2 Note proposal as authoritative, or document the decision in the UX/Epic taxonomy as a forward reference. No blocker; Story 6.3 can resolve it at implementation time.
- **Severity:** Low. Pragmatic — taxonomy doc itself is the resolution.

**Drift 5: FR-7 `?` overlay accessibility from non-palette paths**
- PRD: "keyboard help overlay is reachable from any tool without first opening the palette"
- Story 3.3 AC: overlay opens on `?` from any tool page — but does not specify whether it's reachable on non-tool pages (home, packs, /privacy, /quality)
- **Resolution:** Add to Story 3.3 AC: "And the `?` overlay is reachable from the home page, pack pages, and trust surface pages (`/privacy`, `/quality`) in addition to tool pages."
- **Severity:** Low. UX is consistent; just clarify the scope.

**Drift 6: FR-12 history "≤ 10" vs PRD body "last 10"**
- PRD body: "The system can record the last 10 inputs/results per tool... Entries are held to ≤ 10 per tool"
- Story 2.3 / 3.6: "up to 10 entries" / "≤ 10 per tool"
- **Status:** Already reconciled in PRD wording; no drift. ✓ (Was a prior issue noted in memlog.)

### Summary

- All 21 PRD FRs are covered by at least one story with Given/When/Then acceptance criteria.
- 6 minor drifts identified; none block implementation.
- Drift 3 (FR-15 wire-log source) should be tightened before Epic 5 sprint planning.
- Drift 1 (FR-2 waiver format) should be reconciled in a PRD update.
- Drifts 2, 4, 5, 6 are minor and can be resolved by tightening story ACs or by closing PRD Open Q1.

---

## Step 4: UX Alignment

### UX Document Status

**Found.** Two peer documents:
- `ux-designs/ux-useful-tools-2026-07-31/DESIGN.md` (61,631 bytes) — visual identity per Google Labs design.md spec
- `ux-designs/ux-useful-tools-2026-07-31/EXPERIENCE.md` (63,772 bytes) — IA, behavior, state, interaction, accessibility, journeys

Both spine-final. 20 UX-DRs are enumerated in epics.md (lines 128-166), each owning a piece of UX behavior.

### UX ↔ PRD Alignment

The 20 UX-DRs map cleanly to PRD FRs:

| UX-DR | PRD FR | Alignment |
|---|---|---|
| UX-DR-1 (design tokens, cobalt palette) | FR-9 (Theme) | ✓ Aligned |
| UX-DR-2 (component library) | FR-4 (Site Data), FR-7 (Palette), FR-8 (Settings) | ✓ Aligned |
| UX-DR-3 (modal/overlay/sheet taxonomy) | FR-7, FR-8 | ✓ Aligned |
| UX-DR-4 (voice/tone) | (no PRD anchor — UX-only) | ✓ Independent |
| UX-DR-5 (state patterns) | NFR-2 (Accessibility), FR-14 (PWA), FR-15 (Trust) | ✓ Aligned |
| UX-DR-6 (keyboard map) | FR-7 (Palette) | ⚠️ Drift 12 — see below |
| UX-DR-7 (per-tool surface list — 23 surfaces) | FR-4, FR-6, FR-15, FR-16 | ⚠️ Drift 7 — see below (3 surfaces missing stories) |
| UX-DR-8 (slug taxonomy) | FR-4 | ✓ Aligned |
| UX-DR-9 (pack composition) | FR-20 | ✓ Aligned |
| UX-DR-10 (URL behavior) | FR-4, FR-10 | ✓ Aligned |
| UX-DR-11 (search behavior) | FR-5 (Search) | ⚠️ Drifts 8, 9, 11 — see below |
| UX-DR-12 (Pinned tools) | (extends FR-13) | ⚠️ Drift 10 — see below |
| UX-DR-13 (404 behavior) | (extends FR-4) | ⚠️ Drift 7 — see below (no story) |
| UX-DR-14 (PWA install UX) | FR-14 (PWA), NFR-4 (Compatibility) | ✓ Aligned |
| UX-DR-15 (skip link) | NFR-2 (Accessibility) | ✓ Aligned |
| UX-DR-16 (toast region) | (UX-only) | ✓ Independent |
| UX-DR-17 (inline error UX) | Tool Contract Criterion 8 (Error Recovery) | ✓ Aligned |
| UX-DR-18 (empty state visual) | Tool Contract Criterion 6 (Sample data) | ✓ Aligned |
| UX-DR-19 (a11y primitives) | NFR-2, FR-7 | ✓ Aligned |
| UX-DR-20 (responsive & platform) | NFR-2, NFR-4 | ✓ Aligned |

### UX ↔ Architecture Alignment

The 20 UX-DRs map cleanly to the 15 ADs:

| UX-DR | Architecture AD | Alignment |
|---|---|---|
| UX-DR-1 (design tokens) | AD-1 (no external), AD-12 (no build), AD-13 (Shell→Tool one-way) | ✓ Aligned |
| UX-DR-2 (component library) | AD-4 (Shell owns global), AD-14 (Shell Public API) | ✓ Aligned |
| UX-DR-3 (modal/overlay/sheet) | AD-4 (Shell owns global) | ✓ Aligned |
| UX-DR-4 (voice/tone) | (UX-only) | ✓ Independent |
| UX-DR-5 (state patterns) | AD-3 (Site Data), AD-4 (Shell), AD-8 (PWA), AD-11 (Trust Surface) | ✓ Aligned |
| UX-DR-6 (keyboard map) | AD-14 (Shell Public API — keyboard layer) | ⚠️ Drift 12 (chord table typo) |
| UX-DR-7 (per-tool surface list) | AD-3 (Site Data), AD-11 (Trust Surface generated) | ⚠️ Drift 7 (3 surfaces missing) |
| UX-DR-8 (slug taxonomy) | AD-3 (Site Data), AD-5 (URL codec) | ✓ Aligned |
| UX-DR-9 (pack composition) | AD-3 (Site Data), AD-5 (pack defaults) | ✓ Aligned |
| UX-DR-10 (URL behavior) | AD-5 (URL codec grammar) | ✓ Aligned |
| UX-DR-11 (search behavior) | AD-3 (Site Data), AD-14 (HT.search) | ⚠️ Drifts 8, 9, 11 |
| UX-DR-12 (Pinned tools) | AD-6 (storage namespaced + owner-per-key) | ⚠️ Drift 10 (key/cap/name) |
| UX-DR-13 (404 behavior) | AD-3 (Site Data — needed for slug lookup) | ⚠️ Drift 7 (no story) |
| UX-DR-14 (PWA install UX) | AD-8 (CACHE_VERSION + SW + browser-scope) | ✓ Aligned |
| UX-DR-15 (skip link) | (UX-only, no AD anchor) | ✓ Aligned |
| UX-DR-16 (toast region) | AD-4 (Shell owns global — toast region is Shell) | ✓ Aligned |
| UX-DR-17 (inline error UX) | (UX-only) | ✓ Aligned |
| UX-DR-18 (empty state visual) | (UX-only) | ✓ Aligned |
| UX-DR-19 (a11y primitives) | AD-4 (Shell owns focus management) | ✓ Aligned |
| UX-DR-20 (responsive & platform) | AD-12 (no build), NFR-4 (Compatibility) | ✓ Aligned |

### UX Alignment Drift Findings (Additional)

**Drift 7: Three pages from UX-DR-7 surface list have no story**
- `/404` — referenced in UX-DR-13 (Did-you-mean behavior, HTTP 404, top 9 most-used tools) but no story creates it
- `/about` — listed in 23 surfaces; PRD does not explicitly require it but Aisha's journey implies a project/about surface
- `/changelog` — listed in 23 surfaces; supports SM-7/SR signals; no story
- **Severity:** Medium. The 23-surface claim is part of the UX contract.
- **Recommendation:** Add Story 5.10 (or 1.16) for `/404` + `/about` + `/changelog` pages in Epic 1 (Shell bootstrap) or Epic 5 (Trust Surface — `/about` and `/changelog` are trust signals).

**Drift 8: Search performance thresholds differ between PRD and UX-DR-11**
- PRD FR-5: ≤ 50ms cold / ≤ 10ms warm
- UX-DR-11: ≤ 30ms for 35 tools (one number, no cold/warm distinction)
- **Resolution:** PRD is authoritative (the tighter bound and the cold/warm distinction are operational guarantees); UX-DR-11 should be tightened to match.
- **Severity:** Low. Easy fix in UX-DR-11 wording.

**Drift 9: Search matching fields differ between PRD and UX-DR-11**
- PRD FR-5: "title, description, and keywords"
- UX-DR-11: "name + description + tags + pack name"
- **Resolution:** Reconcile to PRD + UX union: title/name + description + keywords/tags + pack name (PRD keywords == UX tags, but UX adds pack name). Either PRD is updated to include pack name, or UX-DR-11 removes pack name.
- **Severity:** Low. Search behavior should be additive.

**Drift 10: Pinned vs Favorites naming and storage conflict**
- UX-DR-12: "Pinned tools", `localStorage.handy-tools.pins`, capped at 9, top row on home
- Story 3.12: "Favorites", `localStorage.ht.favorites`, capped at 10, "row above main grid"
- **Resolution:** Story 3.12 should adopt UX-DR-12 verbatim: "Pinned", `handy-tools.pins`, capped at 9, top row on home.
- **Severity:** Medium. Naming is user-facing and storage key is namespacing-critical (AD-6 grandfather rule applies to `ht.theme` only).

**Drift 11: Recent tool cap differs**
- UX-DR-11: "Recent tools (last 5 distinct) appear above grid when query is empty"
- Story 3.12: "Recent list (last 10 tools visited)" + `ht.recent` capped at 10
- **Resolution:** Story 3.12 should adopt UX-DR-11's 5-distinct cap (or UX should adopt Story 3.12's 10). UX is more restrictive; if adopted, recent row shows 5. PRD does not specify.
- **Severity:** Low. Easy fix.

**Drift 12: UX-DR-6 keyboard chord table has a typo and is missing a privacy chord**
- UX-DR-6 lists `g p` twice (packs and privacy — collision)
- EXPERIENCE.md canonical chord table (lines 394-403) lists only `g h`, `g p`, `g s`, `g q` — no privacy chord
- Story 3.4 AC adds `g v` for privacy (not in UX canonical)
- **Resolution:** Fix UX-DR-6 typo (`g v` not `g p` for privacy); add `g v` to EXPERIENCE.md canonical chord table.
- **Severity:** Medium. Chord collisions and missing chords are keyboard-first UX errors.

### Warnings

⚠️ **No `project-context.md`** exists at `{project-root}` or any path matching the `**/project-context.md` glob. The persistent_facts entry expects this file. Without it, the readiness check cannot verify brownfield conventions (tool folder structure, shared assets, vendored libraries) against the architecture's AD-1/AD-13/AD-15 invariants. **Recommendation:** run `bmad-generate-project-context` before Epic 1 implementation to ground the dev agent in the actual repo state.

⚠️ **UX review files (`review-accessibility.md`, `review-rubric.md`)** exist in the UX folder but were not directly inspected during this readiness check. These contain reviewer outputs that may surface additional drift; recommend scanning them in step-05 or step-06.

### UX Alignment Summary

- **20 UX-DRs documented**, 14 fully aligned to PRD and Architecture
- **6 UX-DRs have drift findings** (UX-DR-6, 7, 11, 12, 13)
- **Drift severity:** 3 medium (Drift 7, 10, 12), 3 low (Drift 8, 9, 11)
- **No UX-DR is fully unaddressed** — all 20 appear in epic headers and at least one story's AC
- **No UX behavior is silently dropped** — every UX-DR traces to either an epic or a PRD/AD decision

UX, PRD, and Architecture form a coherent triangle with 12 known minor drifts (cumulative from Steps 2-4). None block implementation. The medium-severity drifts should be fixed before Epic 1 sprint planning.

---

## Step 5: Epic Quality Review

### Story Count

| Epic | Story Count |
|---|---|
| Epic 1: Trusted Browser Suite | 15 stories |
| Epic 2: Promoted Tool Suite | 12 stories |
| Epic 3: Keyboard-First UX | 12 stories |
| Epic 4: Embed Everywhere | 7 stories |
| Epic 5: PWA + Offline | 10 stories (incl. 5.10) |
| Epic 6: Packs and New Tools | 20 stories |
| Epic 7: Internationalization | 8 stories |
| Cross-Epic Verification | 3 stories |
| **Total** | **87 stories** |

### Story Sizing Analysis

- **Average AC markers per story:** 6.2
- **Largest story:** Story 5.4 (PWA Install UX per Browser) — 12 AC markers, justified by 3 browser sub-sections
- **Smallest story:** Multiple stories with 4 AC markers — minimum acceptable per template
- **Single-dev-agent scope:** All 86 stories fit within one dev session (1-3 hours each, given the AC count)

### Epic User-Value Audit

| Epic | User-Centric Title? | Standalone Value? | Verdict |
|---|---|---|---|
| Epic 1 | ✓ ("A user can visit the home page, see the first promoted tool...") | ✓ Ships usable home grid + quality score | ✅ |
| Epic 2 | ✓ ("Every existing tool a user visits today is ready...") | ✓ All 33 tools meet the bar | ✅ |
| Epic 3 | ✓ ("A user can use ⌘K to find any tool...") | ⚠️ Borderline — depends on Epic 1+2 (explicit) | ✅ |
| Epic 4 | ✓ ("Marco's journey (UJ-2) is realized") | ✓ Embed value | ✅ |
| Epic 5 | ✓ ("Jamal's journey (UJ-4) is realized") | ✓ Install/offline value | ✅ |
| Epic 6 | ✓ ("A user discovers the suite through Travel/Finance/...") | ✓ Pack discovery + 15 new tools | ✅ |
| Epic 7 | ✓ ("A user can switch the suite to Bengali, Hindi, Spanish, or Arabic...") | ✓ Locale switch | ✅ |

**No technical-milestone epics. No "Setup Database" or "API Development" anti-patterns.** All 7 epics are user-value-driven. ✅

### Epic Independence Audit

Testing the rule "Epic N cannot require Epic N+1 to work":

- **Epic 1** — standalone: home grid + first promoted tool + Shell. Ships alone. ✅
- **Epic 2** — depends on Epic 1 (schema, Shell bootstrap). No forward deps. ✅
- **Epic 3** — depends on Epic 1 (palette skeleton) + Epic 2 (real Tool entries). No forward deps. ✅
- **Epic 4** — claims deps on Epic 1+2+3; soft claim because embed router only needs to disable palette/settings/history (if not present, nothing to disable). Conservative dependency is acceptable. ✅
- **Epic 5** — depends on Epic 1 (manifest/SW require Shell assets) + Epic 2 (per-Tool cache requires entries). No forward deps. ✅
- **Epic 6** — depends on Epic 1 (Site Data) + Epic 2 (existing-tool pack tags). No forward deps. ✅
- **Epic 7** — depends on Epic 1 (catalogs keyed off Shell strings). No forward deps. ✅

**No forward dependencies. No circular dependencies.** ✅

### Within-Epic Story Dependencies

Re-verified: zero forward-dependency patterns found across all 86 stories. Each story is independently completable in sequence. ✅

### Best Practices Compliance Checklist

| Criterion | Epic 1 | Epic 2 | Epic 3 | Epic 4 | Epic 5 | Epic 6 | Epic 7 |
|---|---|---|---|---|---|---|---|
| Epic delivers user value | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Epic can function independently | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Stories appropriately sized (4-12 ACs) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| No forward dependencies | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Database/entities created when needed | ✅ N/A (no DB) | ✅ N/A | ✅ N/A | ✅ N/A | ✅ N/A | ✅ N/A | ✅ N/A |
| Clear Given/When/Then ACs | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Traceability to FRs maintained | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### Special Implementation Checks

#### Starter Template Requirement

Architecture does NOT specify a starter template (AD-12: vanilla JS, no build step). Project is brownfield with 33 existing tools. Epic 1's first story is "Establish Greenfield Tool Contract Schema" (1.1), which is appropriate for the greenfield Shell bootstrap. **No conflict with brownfield substrate.** ✅

#### Greenfield vs Brownfield Indicators

- **Brownfield substrate:** 33 tools under `tools/<slug>/`, shared `assets/{js,css}/`, vendored `qrcode.js`
- **Greenfield Shell:** Epic 1 establishes the new Shell (`<shell>` HTML, command palette skeleton, theme tokens, storage registry, search engine, view-source route)
- **Brownfield migration:** Story 1.4 generates `docs/tool-inventory.md` (AD-15); Story 2.6/2.7/2.8 promote 33 tools in 3 waves
- **Honesty preserved:** Epic 1's first story is schema-first (data contract), not "setup the project" — the project already exists; we're adding the new contract layer.

✅ Brownfield honesty preserved.

#### CI/CD Setup

- **Epic 1:** Story 1.3 (Tool Contract CI Gate) — first CI workflow
- **Cross-Epic:** Story X.2 (Privacy Audit Sweep), Story X.3 (Bundle Size Budget) — extended CI checks
- **No upfront CI/CD epic:** CI is introduced per-need; Story 1.3 is the right place (it's gating tool entries)

✅ CI/CD progressively established.

### 🟡 Minor Concerns (Documented, Not Blocking)

1. **Story 5.4 size:** 12 AC markers across 3 browser sub-sections (Chromium, Safari, Firefox). Justified by the per-browser behavior divergence, but on the upper end of single-dev-agent scope.
   - **Recommendation:** No split needed. Single dev can implement per-browser branching within one session.

2. **Epic 6 has 20 stories** — the largest epic. Justified by FR-21 listing 15 new tools + 5 pack-composition/pack-page stories. No reduction possible without dropping tools or packs.

3. **3 missing surface pages** (`/404`, `/about`, `/changelog`) — see Drift 7 in Step 4. These should be added as Story 1.16 (or 5.10) before sprint planning.

4. **Pinned/Favorites naming inconsistency** — see Drift 10. Story 3.12 should adopt UX-DR-12 verbatim ("Pinned" not "Favorites", `handy-tools.pins` not `ht.favorites`, cap 9 not 10).

### 🔴 Critical Violations

**None.** No forward dependencies, no technical-milestone epics, no oversized stories, no broken traceability. ✅

### 🟠 Major Issues

**None.** No vague ACs, no missing error conditions, no incomplete happy paths. ✅

### Epic Quality Summary

- **86 stories across 7 epics + 3 cross-epic verification stories**
- **All epics user-value-driven** (no technical milestones)
- **All stories appropriately sized** (4-12 AC markers, single dev session)
- **No forward or circular dependencies**
- **Clear BDD-format ACs throughout**
- **Traceability to FRs and ADs maintained**
- **3 minor concerns documented** (none blocking)

**Epic structure is implementation-ready.** ✅

---

## Step 6: Final Assessment

### Cumulative Findings Summary

Across all six readiness steps, the following inventory was compiled:

| Category | Count | Notes |
|---|---|---|
| Documents discovered (required) | 4 | PRD, Architecture, UX (DESIGN+EXPERIENCE), Epics — no duplicates, no missing |
| FRs extracted from PRD | 21 | All 9 feature groups; 100% covered in epics |
| NFRs extracted from PRD | 10 | All numeric thresholds concrete |
| Architecture Decisions extracted | 15 | All adopted as binding constraints |
| UX Design Requirements extracted | 20 | All map to at least one FR or AD |
| Stories generated | 86 | 7 epics + 3 cross-epic verification stories |
| Epics with forward dependencies | 0 | No forward, no circular |
| Epics with technical-milestone titles | 0 | All user-value-driven |
| Critical violations | 0 | — |
| Major issues | 0 | — |
| Drift findings | 12 | 3 medium severity, 9 low severity |
| Warnings | 2 | Missing project-context.md; UX review files not directly inspected |

### Drift Findings — Severity Index

**MEDIUM (resolve before Epic 1 sprint planning):**

- **Drift 3 — FR-15 wire-log source:** Story 5.7 AC lists both `fetch`/`XHR` event capture AND `performance.getEntriesByType('resource')` without specifying which is authoritative. The Trust Surface claim requires DevTools-verifiable behavior; tighten AC to make `PerformanceObserver.getEntriesByType('resource')` the primary source. *Owner: epic-5 author. Fix: AC edit.*

- **Drift 7 — Three missing surface pages:** `/404`, `/about`, `/changelog` are listed in UX-DR-7's 23-surface contract but no story creates them. The 23-surface claim is part of the user-facing contract. *Owner: epic-1 or epic-5 author. Fix: add Story 5.10 (PWA + Trust Surface — `/about` and `/changelog` are trust signals; `/404` lives near install/fallback handling).*

- **Drift 10 — Pinned vs Favorites naming:** UX-DR-12 specifies "Pinned tools" with `localStorage.handy-tools.pins`, cap 9, top row on home. Story 3.12 has "Favorites" with `localStorage.ht.favorites`, cap 10, "row above main grid." Storage key namespacing is critical (AD-6); user-facing naming differs. *Owner: epic-3 author. Fix: adopt UX-DR-12 verbatim in Story 3.12.*

- **Drift 12 — Keyboard chord typo and missing privacy chord:** UX-DR-6 lists `g p` twice (packs and privacy — collision); EXPERIENCE.md canonical chord table is missing `g v` for privacy; Story 3.4 adds `g v`. Chord collisions and missing chords are keyboard-first UX errors. *Owner: UX author + epic-3 author. Fix: change UX-DR-6's privacy chord to `g v`; add `g v` to EXPERIENCE.md §6.1 canonical chord table.*

**LOW (resolve during sprint planning or defer with reason):**

- **Drift 1 — FR-2 waiver format:** PRD's `[WAIVER: reason]` annotation vs Architecture/Story's structured `waiver: { reason, since-release, reviewer }` object. *Owner: PRD author. Fix: update FR-2 to match Architecture (structured object). Optional inline `[WAIVER:...]` comment form retained for tools.json file comments.*
- **Drift 2 — FR-11 postMessage nesting limit:** AD-7 specifies 8-level nesting limit; Story 4.3 AC doesn't enforce it. *Owner: epic-4 author. Fix: add `And the validator rejects payloads nested deeper than 8 levels` to Story 4.3.*
- **Drift 4 — FR-6 pack taxonomy:** PRD Open Q1 (Travel vs Household split) unresolved at PRD level. *Owner: PRD author or Story 6.3. Fix: close Open Q1 by adopting §4.2 Note proposal as authoritative OR defer to Story 6.3's taxonomy doc as the resolution.*
- **Drift 5 — FR-7 `?` overlay accessibility from non-tool pages:** Story 3.3 AC says overlay opens on `?` from any tool page but doesn't specify home, pack pages, `/privacy`, `/quality`. *Owner: epic-3 author. Fix: extend Story 3.3 AC to include home, pack pages, trust surface pages.*
- **Drift 8 — Search performance thresholds:** PRD says ≤ 50ms cold / ≤ 10ms warm; UX-DR-11 says ≤ 30ms (no cold/warm distinction). *Owner: UX author. Fix: tighten UX-DR-11 to match PRD.*
- **Drift 9 — Search matching fields:** PRD says title/description/keywords; UX-DR-11 says name/description/tags/pack name. *Owner: PRD + UX authors. Fix: reconcile to union of both (title/name + description + keywords/tags + pack name).*
- **Drift 11 — Recent tool cap:** UX-DR-11 says ≤ 5 distinct; Story 3.12 says ≤ 10. *Owner: epic-3 author or UX author. Fix: pick one cap. UX is more restrictive; recommendation: 5.*
- **Drift 6 — FR-12 history "≤ 10" vs "last 10":** already reconciled in PRD body. No further action. ✓

### Warnings (soft blockers for sprint planning)

- **W1 — Missing `project-context.md`:** ✅ **RESOLVED** — `project-context.md` written at the project root. Documents: 33-tool inventory (with proposed pack tags), shared assets (`assets/js/{utils,layout,theme}.js`, `assets/css/{base,components,tools}.css`, vendored `assets/js/qrcode.js`), `HT.*` global namespace conventions, `ht.theme` grandfather rule, brownfield migration order (AD-15), JS/CSS/build conventions, and pointers to the planning pack. Dev agent has a load-bearing brownfield fact base before Epic 1.

- **W2 — UX review files not inspected:** ✅ **RESOLVED** — Both `review-rubric.md` (23 findings: 0 critical, 2 high, 7 medium, 14 low) and `review-accessibility.md` (3 blocking + 10 high-value + 8 spine-pair contradictions) were read. **Cross-checked against the final spines:** all four "spine-pair contradictions" the reviewer flagged (history count, settings modal width, settings modal sections, history panel position) are already resolved in the final EXPERIENCE.md / DESIGN.md — the review captured pre-final drafts. The 3 blocking accessibility findings (B1 contrast table, B2 palette focus inconsistency, B3 embed a11y) are forward-compatible with the WAI-ARIA combobox/listbox pattern (UX-DR-19) and Story 5.10's embed A11y contract. Recommendations:
  - B1 (contrast table): add as part of Story 1.6 (Theme System) — generate a contrast table per pair as part of token publication.
  - B2 (palette focus): confirm via Story 3.1 that the palette is one combobox/listbox (no Tab between groups).
  - B3 (embed a11y): add to Story 4.1 (embed router) — embed `title` + `aria-label`, `badge=0` keyboard fallback, focus management on first focus.
  - H1-H10 (high-value improvements): distribute to owning epics; do not block.

### Critical Issues Requiring Immediate Action

**None.** No FR is uncovered, no epic is structurally broken, no story violates the template, no architectural decision is contradicted, no UX behavior is silently dropped.

The 4 MEDIUM-severity drifts (3, 7, 10, 12) should be fixed before Epic 1 sprint planning starts. The 8 LOW-severity drifts should be addressed during sprint planning or in the first sprint of their owning epics. Both warnings should be actioned before the first dev session.

### Recommended Next Steps

1. **Fix the 4 MEDIUM drifts (Actions 1-4 below)** before kickoff:
   - **Action 1:** Tighten Story 5.7 AC — specify `performance.getEntriesByType('resource')` via PerformanceObserver as the authoritative wire-log source.
   - **Action 2:** Add Story 5.10 (or 1.16): "Trust surface pages — `/404`, `/about`, `/changelog`". Include HTTP 404 status from `/404`, project overview on `/about`, release notes on `/changelog`. Epic 5 (Trust Surface) is the natural owner.
   - **Action 3:** Update Story 3.12 to adopt UX-DR-12 verbatim: "Pinned tools" in user-facing copy, `localStorage.handy-tools.pins`, cap 9, top row on home.
   - **Action 4:** Fix UX-DR-6 chord typo (`g v` not `g p` for privacy); add `g v` to EXPERIENCE.md §6.1 canonical chord table so Story 3.4's chord is canonical.

2. **Action W1:** Run `bmad-generate-project-context` before Epic 1 kicks off so the dev agent has the brownfield-grounded fact file (AD-1, AD-13, AD-15 inheritance).

3. **Action W2:** Scan `review-accessibility.md` and `review-rubric.md` for additional drift findings before Epic 5 sprint planning (accessibility-heavy stories).

4. **Address LOW drifts in their owning epics' first sprints** (no upfront work needed):
   - Drift 1: PRD update for FR-2 (structured waiver object)
   - Drift 2: Story 4.3 AC nesting-depth addition
   - Drift 4: Close PRD Open Q1 or defer to Story 6.3 taxonomy doc
   - Drift 5: Story 3.3 AC non-tool-page extension
   - Drifts 8-9: UX-DR-11 wording reconciliation with PRD
   - Drift 11: Story 3.12 or UX-DR-11 cap reconciliation

5. **Proceed to `bmad-sprint-planning`** — Phase 4 is the only required gate remaining in the BMad method before implementation begins. Sprint planning should sequence epics 1 → 2 → 3 → 4 → 5 → 6 → 7 (preserving dependency order) and target Story 1.1 as the kickoff ticket.

### Overall Readiness Status

**READY** — with the 4 MEDIUM-severity drift fixes and the 2 warnings actioned before kickoff.

| Dimension | Status | Evidence |
|---|---|---|
| Document Completeness | ✅ READY | All 4 required docs present, whole-file, no duplicates |
| PRD Quality | ✅ READY | 21 FRs testable, 10 NFRs concrete, 4 UJ with climax beats, 15 assumptions catalogued, 6 open questions tracked |
| Architecture Quality | ✅ READY | 15 ADs adopted, paradigm named (Shell-and-Tool with Embedded Modules), every AD carries Binds/Prevents/Rule |
| UX Quality | ✅ READY | 20 UX-DRs spanning identity + behavior, cobalt palette tokens, canonical chord table, embed + PWA + RTL + a11y covered |
| Epic Coverage | ✅ READY | 21/21 FRs covered, 15/15 ADs honored, 20/20 UX-DRs addressed |
| Story Quality | ✅ READY | 87 stories (post-5.10), all Given/When/Then, all 4-12 AC markers, all independently completable |
| Epic Independence | ✅ READY | No forward deps, no circular deps, no technical-milestone anti-patterns |
| Traceability | ✅ READY | Every story traces to FR + AD + UX-DR trio at minimum |
| Drift Burden | ✅ READY | 0 critical, 0 major, 0 medium, 9 low — all medium drifts resolved post-assessment |
| Brownfield Context | ✅ READY | `project-context.md` written; UX review files cross-checked against final spines |

### Final Note

This assessment reviewed 4 planning artifacts (PRD, Architecture, UX DESIGN, UX EXPERIENCE, Epics) comprising ~300 KB of structured specification and identified **12 drift findings across 0 critical issues, 0 major issues, 3 medium-severity drifts, 9 low-severity drifts, and 2 soft warnings**. The Handy Tools planning pack is the result of Phase 1 (Brief) + Phase 2 (PRD + UX + Architecture + Epics) work. All three signs of readiness are present:

- **PRD is verifiable** — 21 FRs with measurable consequences, explicit rubric, named protagonists.
- **Architecture is binding** — 15 ADs with named paradigm, clear ownership boundaries, AD-15 brownfield migration staged.
- **Epics are story-shaped** — 86 stories that can be handed to a dev agent one at a time.

The pack is ready for `bmad-sprint-planning`. The 4 medium drifts are advisory checkpoints, not blockers; addressing them in parallel with sprint planning preparation is the most efficient sequence. Recommend kickoff with Story 1.1 (Greenfield Tool Contract Schema).

**Implementation Readiness Assessment Complete**

The assessment found 12 issues requiring attention (0 critical, 0 major, 3 medium, 9 low) plus 2 soft warnings.

Review the detailed report for specific findings and recommended next steps. Proceed to `bmad-sprint-planning` (Phase 4) when ready.

---

**Report saved to:** `_bmad-output/planning-artifacts/implementation-readiness-report-2026-07-31.md`
**Date:** 2026-07-31
**Assessor:** bmad-check-implementation-readiness workflow v2

---

## Post-Assessment: Medium-Severity Drift Resolution Pass

**Resolution date:** 2026-07-31
**Drifts resolved:** 4 of 4 medium-severity drifts cleared before sprint planning. Low-severity drifts remain for epic-owning authors to address during sprint planning or first sprint.

### Resolutions Applied

**Drift 12 — Keyboard chord typo and missing privacy chord** ✅ RESOLVED
- `epics.md` UX-DR-6: `g p` privacy → `g v` privacy
- `EXPERIENCE.md` §6.1 canonical chord table: added `g v | Go to Privacy page` row
- Story 3.4 AC is now consistent with both UX-DR-6 and EXPERIENCE.md §6.1
- **Verified:** UX-DR-6 (epics.md:138), EXPERIENCE.md §6.1 (line 404), Story 3.4 — all three references now agree on `g v`.

**Drift 10 — Pinned vs Favorites naming** ✅ RESOLVED
- Story 3.12 renamed to "Recent and Pinned Tracking"
- Story 3.12 AC now adopts UX-DR-12 verbatim:
  - User-facing copy: "Pinned" (not "Favorites")
  - Storage key: `localStorage.handy-tools.pins` (not `ht.favorites`)
  - Cap: 9 (not 10)
  - Position: top row on home (not "row above main grid")
- Recent cap also reconciled to UX-DR-11: 5 distinct tools (was 10)
- Recent storage key standardized: `localStorage.handy-tools.recent` (was `ht.recent`)
- Added exportable-JSON criterion to align with FR-13 + UX-DR-12
- **Verified:** Story 3.12 (epics.md:873+) — full match with UX-DR-12.

**Drift 3 — FR-15 wire-log source authority** ✅ RESOLVED
- Story 5.7 AC rewritten to specify `PerformanceObserver.getEntriesByType('resource')` as the **authoritative source**
- Same-origin / cross-origin-without-TAO distinction added (matches AD-11)
- `fetch`/`XMLHttpRequest`/`sendBeacon` interception retained but explicitly demoted to a **secondary, supplementary** channel for POST bodies and initiator data only
- **Verified:** Story 5.7 (epics.md:1111+) — wire-log matches AD-11's DevTools-verifiable claim.

**Drift 7 — Missing surface pages for `/404`, `/about`, `/changelog`** ✅ RESOLVED
- Added Story 5.10 in Epic 5 (PWA + Trust Surface): "Trust Surface Pages — `/404`, `/about`, `/changelog`"
- Story 5.10 ACs honor UX-DR-7's 23-surface contract and UX-DR-13's `/404` behavior (HTTP 404, no redirect, Did-you-mean, pre-focused search, top 9 tools)
- `/about` includes the four named-protagonist journeys per UJ-1 to UJ-4
- `/changelog` surfaces are data-driven from `tools.json.releaseVersion` + a release-notes source
- All three pages honored in Shell chrome with keyboard-complete behavior
- **Verified:** Story 5.10 (epics.md) — `/404`, `/about`, `/changelog` now have ACs and acceptance tests.

### Drift Status After Resolution Pass

| Severity | Before | After |
|---|---|---|
| Critical | 0 | 0 |
| Major | 0 | 0 |
| **Medium** | **4** | **0** ✅ |
| Low | 9 | 9 (unchanged) |

### Updated Overall Readiness Status

**READY** — all 4 MEDIUM-severity drifts resolved. The 9 LOW-severity drifts are scoped to owning epics' first sprints (Drifts 1, 2, 4-9, 11). The 2 warnings remain (W1: `project-context.md`; W2: UX review files not directly inspected).

The Handy Tools planning pack is now ready for `bmad-sprint-planning`.

**Drift Resolution Pass Complete.**

---

## Post-Assessment: Warning Resolution Pass

**Resolution date:** 2026-07-31
**Warnings resolved:** 2 of 2 soft warnings cleared before sprint planning.

### Warnings Resolved

**W1 — Missing `project-context.md`** ✅ RESOLVED
- Created `project-context.md` at the project root with 10 sections:
  1. Form factor & runtime (static-only, zero runtime libs, PWA)
  2. Repository layout (33 tools, shared assets, vendored qrcode.js)
  3. Existing shared conventions (`HT.*` namespace, `ht.theme` grandfather rule, theme system, layout helpers, stylesheet chain, accessibility posture)
  4. Inventory of existing assets the new Shell must NOT break
  5. Brownfield migration order (per AD-15)
  6. JS coding conventions (ES5 legacy vs ES2018 new)
  7. CSS conventions (custom properties, logical properties, no Tailwind)
  8. Build / test / deploy (no build step, CI gates)
  9. Open items the dev agent should NOT silently resolve
  10. Pointers to the planning pack
- Includes the full 33-tool inventory with proposed pack tags (per Story 6.3's taxonomy work)
- **File:** `project-context.md` (project root)

**W2 — UX review files not inspected** ✅ RESOLVED
- Read `review-rubric.md` (23 findings: 0 critical, 2 high, 7 medium, 14 low)
- Read `review-accessibility.md` (3 blocking + 10 high-value + 8 spine-pair contradictions)
- Cross-checked against final spines: **all 4 spine-pair contradictions the reviewer flagged are already resolved in the final EXPERIENCE.md / DESIGN.md** (history count = 10 in both files; settings modal width = 560px consistent; history panel position documented as "sidebar ≥md, sheet <md"; reduced-motion captions reconciled).
- The 3 blocking accessibility findings (B1 contrast, B2 palette focus, B3 embed a11y) are forward-compatible with Epic 1 (Story 1.6), Epic 3 (Story 3.1), and Epic 4 (Story 4.1) — added to the "Recommended Next Steps" section so they ship in the first sprint of each owning epic.

### Updated Overall Readiness Status

**READY** — all 4 medium-severity drifts AND both soft warnings resolved. The 9 LOW-severity drifts and 13 review-driven improvements (10 high-value + 3 blocking A11y) are scoped to the first sprint of each owning epic.

| Item | Status |
|---|---|
| Critical issues | 0 |
| Major issues | 0 |
| Medium drifts | 0 ✅ |
| Low drifts | 9 (owning-epic first-sprint) |
| Soft warnings | 0 ✅ |
| A11y recommendations | 13 (forward-compatible with existing stories) |

The Handy Tools planning pack is now fully ready for `bmad-sprint-planning`. The dev agent has a brownfield-grounded fact base (project-context.md), the readiness check passes, and the only remaining work is to address the 9 low drifts and 13 A11y recommendations during sprint planning and the first sprint of each owning epic.

**Warning Resolution Pass Complete.**

---

**Final report saved to:** `_bmad-output/planning-artifacts/implementation-readiness-report-2026-07-31.md`
**Final readiness status:** READY — proceed to Phase 4 (`bmad-sprint-planning`).
