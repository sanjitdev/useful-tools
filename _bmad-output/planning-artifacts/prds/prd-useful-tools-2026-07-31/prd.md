---
title: PRD — Handy Tools
status: final
created: 2026-07-31
updated: 2026-07-31
project: useful-tools
---

# PRD: Handy Tools
*Working title — confirm.*

## 0. Document Purpose

This PRD is the product and engineering brief for the next phase of Handy Tools, a dependency-free, browser-based tool suite. It is for the project owner (Sanjit) and the downstream workflow owners — UX (design system and command palette), Architecture (Tool Contract, shell, embed), and Epics/Stories (delivery). It builds on the **Product Brief** (`_bmad-output/planning-artifacts/briefs/brief-useful-tools-2026-07-31/brief.md`) and the **Brainstorm** (`_bmad-output/brainstorming/brainstorm-useful-tools-2026-07-31/`). It does not duplicate them.

The structure follows the **Essential Spine** of the PRD template, with **Cross-Cutting NFRs** and **Constraints & Guardrails** pulled in from the Adapt-In Menu (consumer, all-non-trivial clusters). Information Architecture is carved out as a feature group rather than a free-standing section so it stays capability-shaped.

## 1. Vision

Handy Tools is the tool suite a careful person can use without thinking about whether it is watching them. It runs entirely in the browser, works offline once visited, and never collects data. The product grows from 34 tools today into a curated, ~50-tool suite organized into **workflow packs** (Travel, Finance, Study, Developer, Household) — composed of existing and new tools — sharing a single design system, a single command palette, and a single quality contract.

The thesis is **Trust**. Composure (small, complete set — not 200 calculators), speed (keyboard-first, instant), and embeddability (works as a widget on any other site) follow from it. The bar for a tool's inclusion is the same as the bar for its quality: it must earn its place in the suite by being measurably good on the contract below.

## 2. Target User

### 2.1 Jobs To Be Done

- **Functional** — when a small task comes up (split a bill, count a deadline, format JSON, weigh a planet), get the answer in under 10 seconds without installing anything.
- **Emotional** — feel in control of small daily decisions without surrendering attention to ads, upsells, or tracking.
- **Social** — share a calculation or result with a colleague, friend, or class — by URL, not by screenshot.
- **Contextual** — when returning often, find a curated entry point (favorites, recent, custom dashboard) that beats the home grid.

### 2.2 Non-Users (v1)

- **Enterprise IT, regulated industries, authenticated state.** Different products.
- **Power users who need a full symmetric spreadsheet, IDE, or search engine.** We point to those tools; we don't try to be them.
- **Users who require live server data** (current exchange rates, real-time weather, geolocation-aware results). Tools in scope provide local approximations or cached data only.

### 2.3 Key User Journeys

**UJ-1. Priya splits a bill in a taxi.** Priya, a freelance designer on her phone, finishes a group dinner. She has used Handy Tools once a month for a year (returning user). She opens the PWA on her home screen, taps the bill icon, types the total, sets 4 people and a 15% tip, hits split. She taps "Copy" and pastes the result into WhatsApp. She arrives home, taps the home icon, and the bill is in her recent list.

**UJ-2. Marco embeds a translator-free QR widget on his school portal.** Marco runs a small coding bootcamp's website. He wants to give students a QR code for each resource. He searches "qr generator embed" and finds Handy Tools. He copies the embed snippet from the `/embed/qr` page and pastes it into the portal. The widget loads — branded-less, ad-less — and works offline for students on bad school Wi-Fi.

**UJ-3. Aisha builds a daily dashboard.** Aisha, a PhD student, returns daily. She opens `/?dashboard=1`, pins three tools (Pomodoro, GPA, word counter), sets theme to dark, and pins the result to her home screen as a PWA. She opens it in the morning; one click reaches Pomodoro, one click starts a focus block. Her pins and theme travel with her as a single JSON export.

**UJ-4. Jamal runs the build offline.** Jamal, a developer, is offline on a flight. He has used Handy Tools before; the recent few tools are cached. He opens the PWA, the shell loads from cache, the tools he cares about work, an "Offline" badge appears, and he goes on with his work.

## 3. Glossary

- **Tool** — a single-purpose page or interactive component. Has a stable URL, metadata, mount/destroy lifecycle, and meets the Tool Contract.
- **Tool Contract** — the set of measurable criteria (see §4.1) every tool must satisfy to ship.
- **Shell** — the cross-tool chrome (header, footer, command palette, settings modal, theme, navigation). A tool renders inside the Shell.
- **Pack** — a curated grouping of related tools presented as a workflow (e.g., Travel). Packs are not apps; they are navigation and discovery surfaces.
- **Command Palette** — a keyboard-first launcher (⌘K / Ctrl-K) that searches tools and runs actions across the suite.
- **Embed Mode** — `?embed=1` mode that strips chrome, accepts URL-encoded state, and exposes a `postMessage` API for host pages.
- **Site Data** — the canonical, single-source file describing every tool (id, title, slug, category, pack, description, icon, keywords). Replaces the per-page hard-coded entries.
- **Trust Surface** — the set of features that make the brand's privacy/source claims auditable (privacy page, source link, transparent changelog, public quality score).
- **Tool History** — per-tool, per-session, and per-device list of recent inputs/outputs, stored locally. User-visible, user-exportable.
- **PWA** — Progressive Web App; installable to home screen, runs offline, launches standalone.
- **Quality Bar** — the 8/10 rubric in §4.1, expressed as 10 criteria, each scored 0/1 (fail) or 1 (pass). A tool must pass ≥8 to ship.

## 4. Features

### 4.1 Tool Contract (Quality Bar)

**Description.** Every tool in the suite — existing or new — must satisfy the **Tool Contract**, defined as ten criteria, each scored 0 or 1. A tool ships only when its score is ≥ 8/10. The score is published per tool on a public `/quality` page, alongside a per-criterion checklist. This is the discipline that makes the suite defensible. Realizes UJ-1, UJ-3, UJ-4.

**Rubric.** A tool passes a criterion iff it meets all the listed conditions.

1. **Keyboard-complete.** All inputs reachable via Tab; primary action reachable via a single key (Enter or shortcut). No mouse-only interaction. `[ASSUMPTION: Tab order matches visual order.]`
2. **Mobile ergonomics.** Single-hand usable on a 360px-wide phone. Tap targets ≥ 44px. No hover-only affordances. No horizontal scroll.
3. **Offline ready.** Once visited, the tool works without network. No external fonts, scripts, or images. Service worker caches the shell and per-tool assets.
4. **Shareable state.** Inputs and key results are encoded in the URL such that reloading reproduces the current computation. Pasted links work.
5. **Printable.** A `@media print` stylesheet renders a clean black-on-white output, hides chrome, and supports multi-page result sets.
6. **Sample data.** A "Try an example" button populates inputs with realistic data so a first-time visitor sees the tool work in ≤ 5 seconds.
7. **History.** Last 10 inputs/outputs persisted in localStorage per tool, recoverable via a visible "History" control. User can clear and export.
8. **Error recovery.** Invalid inputs preserve user input, identify the failing field, explain the fix, and offer a sample. No silent coercion of dangerous values.
9. **Accessible.** Visible focus. WCAG 2.1 AA contrast. ARIA labels on inputs. `prefers-reduced-motion` honored. Tool works in VoiceOver/NVDA.
10. **Source visible.** The tool's `index.html` opens with a "View source" link to the repo path. No minification. Build artifacts ship only when the source is also visible.

**Functional Requirements:**

#### FR-1: Tool Quality Scoring

The system can measure, store, and publish a tool's score against the ten criteria, refreshed on each release of the tool.

**Consequences (testable):**
- A `/quality` page exists, lists every tool, and shows the score per criterion.
- A failing criterion surfaces a one-line remediation note (e.g., "Mobile: tap targets < 44px on the Action button").
- Each release increments a `last-updated` timestamp visible on the page.

**Out of Scope:** runtime programmatic scoring (manual or CI-asserted only).

#### FR-2: Tool Contract Gate

A new tool cannot be merged into the suite unless its score is ≥ 8/10 and the failing criteria are explicitly waived with a `[WAIVER: reason]` annotation in the Site Data.

**Consequences (testable):**
- A CI check reads `tools.json` and rejects any tool with `score < 8` and no waiver.
- Waivers expire after two releases unless renewed.

#### FR-3: Per-Tool Quality Audit

Every existing tool ships with a one-time audit result (pass/fail per criterion) and a remediation list. Existing tools with a score < 8 are scheduled for promotion before any new tool is added.

**Consequences (testable):**
- A `docs/quality-audit.md` lists every tool and its audit date.
- A tool promoted to ≥ 8 is marked `ready: true` in Site Data.

**Feature-specific NFRs:**
- The rubric is **public** and **versioned** in the repo. Changes to criteria require a documented PR.

**Notes:**
- `[ASSUMPTION: CI gate is implemented as a GitHub Actions workflow on PR; manual scoring is the fallback.]`

### 4.2 Site Data & Discovery

**Description.** All tools are described in a single `tools.json` (the Site Data). The home grid, the command palette, pack pages, and `/embed/<tool>` redirects are generated from Site Data. Realizes UJ-1, UJ-3.

**Functional Requirements:**

#### FR-4: Site Data Schema

The system can read Site Data and render the home grid, the command palette, pack pages, and the `/embed/<tool>` redirect.

**Consequences (testable):**
- `tools.json` validates against a JSON Schema checked in CI.
- Adding a tool requires only an entry in `tools.json` — no HTML duplication.
- Each entry carries: id, slug, title, description, category, pack, icon, keywords, last-updated, ready (true iff score ≥ 8 or waiver).

#### FR-5: Tool Search

The system can search tools by title, description, and keywords, returning ranked results in ≤ 50ms (cold) / ≤ 10ms (warm).

**Consequences (testable):**
- Header search bar offers results as the user types.
- Command palette (FR-7) delegates to this search.
- ⌘K / Ctrl-K opens the palette from any tool page.

#### FR-6: Pack Pages

The system can render one curated page per pack, listing its tools and a short pack description.

**Consequences (testable):**
- `/packs/travel` exists; lists tools tagged `pack=travel`.
- Empty packs (no tools ready) are not linked.

**Out of Scope:** pack-specific UI (e.g., a Travel-specific theme). Packs are presentation only.

**Notes:**
- `[ASSUMPTION: Pack decomposition is Travel (timezone, currency, tip, countdown, world clock); Finance (budget, savings, loan, tax, split, tip, percentage); Study (GPA, Pomodoro, flashcard timer, exam countdown, citation, word counter); Developer (JSON, CSV, YAML, regex, diff, JWT, UUID, timestamp, Base64, URL); Household (recipe scaler, grocery list, area/volume, paint, unit converter, tip, split). Tools can appear in multiple packs.]`

### 4.3 Shell & Command Palette

**Description.** A single shell renders the header, theme toggle, search, command palette, settings modal, and footer. Theme, language, and per-tool defaults live in the Settings modal. The shell is the entry point for the keyboard-first UX. Realizes UJ-1, UJ-3, UJ-4.

**Functional Requirements:**

#### FR-7: Command Palette

The system can open a palette from any page via a keyboard shortcut, search tools and global actions, and navigate to a result on Enter or trigger the action.

**Consequences (testable):**
- ⌘K (macOS) / Ctrl-K (Windows/Linux) opens the palette from any tool or root page.
- Escape closes the palette and returns focus to the calling element.
- The palette shows recent tools, top 5 fuzzy matches, and a footer with shortcut hints.
- A "?" action opens a per-tool keyboard help overlay.
- The keyboard help overlay is reachable from any tool without first opening the palette.

#### FR-8: Settings Modal

The system can present a single settings modal with: theme (light/dark/auto), language (locale picker), default units (metric/imperial), default currency, font scale, reduced motion toggle, and a "Clear all local data" action.

**Consequences (testable):**
- Settings persist in localStorage; the same selection appears across all tools.
- "Clear all local data" wipes every `ht.*` key and confirms twice.
- No settings UI is rendered inside any tool — settings are global only.

#### FR-9: Theme System

The system can render a light theme, a dark theme, and an auto theme that follows `prefers-color-scheme`. The default theme is set via a blocking inline script before first paint to avoid flash.

**Consequences (testable):**
- No flash of incorrect theme on page load (FOUC < 50ms).
- Theme persists across sessions.
- High-contrast and forced-colors modes are respected.

**Feature-specific NFRs:**
- The shell itself is **zero-runtime-dep** (no framework), shipped as a single JS file and a single CSS file.

### 4.4 Embed Mode

**Description.** Every tool is embeddable on third-party sites via a `?embed=1` URL and a `postMessage` API. The embed uses no chrome, no analytics, and no brand leakage. Realizes UJ-2.

**Functional Requirements:**

#### FR-10: Embed URL & Snippet

The system can serve any tool at `/?embed=<slug>` with chrome removed, the tool's input accepted via URL-encoded state, and a fixed-size responsive surface.

**Consequences (testable):**
- A copy-able `<iframe src="https://handy.tools/?embed=qr">` snippet is shown on each tool's page.
- The iframe receives focus and keyboard inputs from the host page.
- The embed is responsive to a container width ≥ 240px.

#### FR-11: postMessage API

The system can communicate with the host page via `postMessage` for input/output events, allowing the host to set inputs and read results without an iframe.

**Consequences (testable):**
- Messages are JSON-validated; unknown commands are no-ops.
- The host can request the current state, set inputs, and subscribe to result updates.

**Out of Scope:** Web Components / custom-element integration (deferred; downstream API parity).

### 4.5 Lifecycle & Per-Tool History

**Description.** Every tool stores its recent inputs/outputs locally per tool, with a clear path to view, restore, export, and clear. Realizes UJ-1, UJ-3.

**Functional Requirements:**

#### FR-12: Per-Tool History

The system can record the last 10 inputs/results per tool, persist them in localStorage, and present them in a visible "History" panel.

**Consequences (testable):**
- Each history entry is timestamped and shows key inputs and the result.
- Restoring an entry replaces the current inputs (with confirm if currently unsaved).
- Entries are held to ≤ 10 per tool; older entries are dropped silently.

#### FR-13: User Data Export & Import

The system can export all local data (history, settings, favorites, recent) as a single JSON file and import it back, validating the schema.

**Consequences (testable):**
- "Export my data" is a single button in the Settings modal.
- The import validates schema and version; rejected imports show a clear error.

### 4.6 PWA, Offline, & Trust Surface

**Description.** The site is installable as a PWA, runs offline once installed, and exposes a Trust Surface that makes privacy and source claims auditable. Realizes UJ-4.

**Functional Requirements:**

#### FR-14: PWA Install

The system can prompt for PWA install on supported browsers and serve the installed app offline.

**Consequences (testable):**
- A `manifest.webmanifest` exists, references the icons, and declares `display: standalone`.
- A service worker is registered, caches the shell and last-used tool assets, and supports cache migration on version bumps.
- An offline fallback page exists for uncached paths.

#### FR-15: Trust Surface

The system can serve a `/privacy` page that lists every `localStorage` key the site uses, what it stores, and when it is cleared. The page also shows a wire log of the current session's network requests (zero by default).

**Consequences (testable):**
- `/privacy` is reachable from any tool's footer.
- The localStorage key list is generated from a single source of truth (a registry) so it cannot drift.
- Network requests are captured from the same channel the user can verify with DevTools.

#### FR-16: Source Transparency

The system can link each tool's page to the repo and open the source file at the matching path.

**Consequences (testable):**
- Every tool footer has a "View source" link.
- The link opens the repo at the live file path on the default branch.

### 4.7 Internationalization Scaffold

**Description.** All user-facing copy lives in message catalogs. Locale-aware formatting for numbers, dates, and currency is honored. Starter locales ship in MVP.

**Functional Requirements:**

#### FR-17: Message Catalogs

The system can read copy from per-locale JSON files and fall back to English when a key is missing.

**Consequences (testable):**
- Every user-visible string is keyed; no inline strings in tool HTML.
- Adding a locale is a single file addition.

#### FR-18: Locale-Aware Formatting

The system can format numbers, dates, and currency using `Intl.*` APIs without shipping locale data.

**Consequences (testable):**
- Currency, decimal separators, and date formats follow the active locale.
- RTL languages (Arabic) render correctly under the existing CSS layout.

**Out of Scope:** RTL-first design reorganization (the layout must work RTL-safe, not RTL-first).

#### FR-19: Starter Locales

The system ships English, Bengali, Hindi, Spanish, and Arabic as locale options.

**Consequences (testable):**
- Each locale has a complete catalog for the shell and one full tool (the QR generator or similar).
- The locale picker is shown in the Settings modal.

**Notes:**
- `[ASSUMPTION: Bengali is the first locale because the existing BD Tax calculator is bilingual EN/BN; the catalog is small enough to seed quickly.]`

### 4.8 Workflow Packs and Tool Expansion

**Description.** The suite is organized into five packs that compose existing and new tools. Existing tools are promoted to the Tool Contract; new tools are added only when they earn a pack slot.

**Functional Requirements:**

#### FR-20: Pack Decomposition

The system can tag each tool with its pack(s) and render pack pages.

**Consequences (testable):**
- Each tool has at least one pack; tools can appear in multiple packs.
- Pack pages are reachable from the home grid and the command palette.

#### FR-21: New Tools (MVP)

The new tools in MVP scope are: **JSON Formatter enhancements** (CSV/YAML add), **Citation formatter**, **Diff viewer**, **UUID generator**, **JWT inspector**, **Timestamp converter**, **Flashcard timer**, **Exam countdown**, **Recipe scaler**, **Grocery list builder**, **Paint calculator**, **Area/volume calculator**, **Budget planner**, **Savings goal**, **Currency converter** (cached rates).

**Consequences (testable):**
- Each new tool ships with metadata, an icon, an entry in Site Data, and a score ≥ 8 (or waiver).
- Each new tool realizes at least one UJ.

**Out of Scope:** any tool requiring a server (live exchange rates, weather, geolocation).

**Notes:**
- `[ASSUMPTION: New tools list is the union of brainstorm EXP-1..EXP-10 minus those that require a server or duplicate existing tools.]`

### 4.9 Cross-Cutting NFRs

- **Performance.** Home page LCP < 1.5s on mid-range mobile (Moto G Power baseline). Tool interactive (TTI) < 1s after navigation. Cumulative Layout Shift (CLS) ≤ 0.05. Total JS for shell < 30KB gzipped.
- **Accessibility.** Lighthouse Accessibility ≥ 95 per tool. All tools keyboard-complete in ≤ 90 seconds by an external tester. WCAG 2.1 AA.
- **Privacy.** Zero third-party network requests in all tools. Zero analytics. No CDN fonts/scripts. localStorage keys namespaced `ht.*`.
- **Compatibility.** Current Chrome, Firefox, Safari, Edge. `file://` works for tools that don't require a service worker. No UA sniffing; feature detection only.
- **Reliability.** All calculations isolated from DOM. Pure functions testable. No silent rounding; explicit rounding rules per tool.
- **Printability.** Every tool has a `@media print` stylesheet that renders clean output.
- **Internationalization.** All copy keyed; locale-aware formatting through `Intl.*`.

### 4.10 Constraints & Guardrails

- **Privacy.** No analytics. No fingerprinting. No cookie banners. No advertising. No tracking pixels. No external requests. The site is auditable.
- **Cost.** Static hosting on GitHub Pages. No server-side code. No paid third-party services.
- **Surface.** Fully static. No native app. No PWA that requires a backend.
- **Tech.** Vanilla JS, HTML, CSS only. No third-party libraries at runtime. Embedded libraries (vendored, e.g., QR generator) are allowed and must be vendored in `assets/vendor/`.

## 5. Non-Goals (Explicit)

- **User accounts, sign-in, cloud sync.** Privacy by design; sync is achieved via export/import.
- **Third-party CDN, fonts, analytics, tag managers, A/B testing, ad networks.** No exceptions.
- **A native app.** A PWA with offline support is the substitute.
- **Tools that require a server** (live exchange rates, weather, geolocation-aware results). Cached/local approximations only.
- **A community marketplace for tools** (deferred to v3+).
- **Real-time collaboration** on a tool. Tools are deterministic functions of state.
- **Auth, billing, subscriptions, or paywalls.** The site is free and ad-free.
- **A back-end service** of any kind in v1.

## 6. MVP Scope

### 6.1 In Scope

- **Platform primitives (the foundation everything else depends on):**
  - Site Data (`tools.json`) + JSON Schema.
  - Shell with header, theme, settings modal, command palette.
  - Design system (single CSS source with tokens for color, spacing, typography, focus, motion).
  - Tool Contract enforcement (CI gate + public quality page).
- **Trust surface:**
  - `/privacy` page with live localStorage and network-request transparency.
  - Per-tool source link.
  - Public quality page listing every tool's score.
- **Per-tool feature set:**
  - All 34 existing tools promoted to ≥ 8/10 on the Tool Contract.
  - 12–15 new tools across the five packs (see FR-21).
- **Workflow packs:** Travel, Finance, Study, Developer, Household.
- **Embed mode:** `?embed=1` URL and `postMessage` API on every tool.
- **PWA:** installable, offline shell + last-used tool cache.
- **i18n:** English, Bengali, Hindi, Spanish, Arabic catalogs with one fully-translated tool.
- **Settings:** theme, language, units, currency, font scale, reduced motion, clear-data.
- **History:** per-tool recent 10; global export/import.

### 6.2 Out of Scope for MVP

- **Cloud sync** of history or settings. (JSON export/import is the substitute; deferred to v2 if needed.)
- **Community-submitted tools marketplace.** `[NOTE FOR PM: revisit if engagement justifies a curation burden.]`
- **Live server data** (live exchange rates, weather, geolocation). To revisit in v2 with a server or static-data pipeline.
- **A back-end service** of any kind. Static-only.
- **RTL-first design reorganization.** Layout must be RTL-safe, not RTL-first.
- **Web Component wrappers** for tools. Deferred to v2.
- **Native iOS/Android apps.** PWA is the substitution.
- **Public API beyond the embed `postMessage` API.** No REST/GraphQL surface.

## 7. Success Metrics

**Primary**

- **SM-1:** ≥ 1.5 tools used per session on average. Validates FR-7, FR-12.
- **SM-2:** ≥ 35% weekly return rate. Validates FR-12, FR-14.
- **SM-3:** PWA install rate ≥ 4% of mobile visitors. Validates FR-14.
- **SM-4:** Shareable-URL usage ≥ 10% of completed tasks. Validates FR-4, FR-10.
- **SM-5:** ≥ 100 third-party sites embedding at least one tool. Validates FR-10, FR-11.

**Secondary**

- **SM-6:** Lighthouse Performance and Accessibility ≥ 95 per tool. Validates all FRs.
- **SM-7:** LCP < 1.5s on mid-range mobile. Validates §4.9.
- **SM-8:** ≥ 50,000 monthly visits from organic search.
- **SM-9:** ≥ 300 GitHub stars as a craftsman-portfolio signal.

**Counter-metrics (do not optimize)**

- **SM-C1:** Tool count growth. We do not optimize for more tools; we optimize for completeness of the existing set on the Tool Contract. Counterbalances the natural pressure to add features.
- **SM-C2:** Average session duration. A tool suite designed for < 10-second tasks should not measure success in minutes. Counterbalances SM-1.
- **SM-C3:** Click-through rate on the home grid. The command palette is the front door; if the grid is doing the heavy lifting, the UX goal is failing. Counterbalances focus on home-page conversion.
- **SM-C4:** Number of tracked events. Any growth here is a regression. Zero is the target.

## 8. Open Questions

1. **Travel vs. Household split.** The brief flagged overlap. PRD proposes orthogonal definitions: Travel = mobility/timezone/currency; Household = domestic/area/volume/recipe. Confirm in UX.
2. **Quality rubric weighting.** All ten criteria currently weight equally. Should "Keyboard-complete" and "Accessible" weight higher (e.g., 2×)? `[ASSUMPTION: equal weighting for v1; revisit based on audit.]`
3. **Web Component wrappers.** Worth deferring to v2 or part of MVP? Affects embed API parity. `[ASSUMPTION: deferred to v2.]`
4. **Bengali translations copy-source.** Native translator or community contribution? `[ASSUMPTION: native for the QR generator seed; community for the rest.]`
5. **PWA install prompt timing.** Trigger on first command-palette open or on second visit? Affects SM-3. `[ASSUMPTION: trigger on second visit, when intent is clearer.]`
6. **Tool count target.** Is the suite capped at ~50 tools, or open-ended? `[ASSUMPTION: capped at ~50 in MVP; expand only with new packs, not new packs-of-one.]`

## 9. Assumptions Index

*Inline `[ASSUMPTION]` tags are surfaced in §4 (per-FR) and §8 (per-question). The index below is the canonical list — confirm or replace each.*

| ID | Location | Assumption |
|---|---|---|
| A1 | §4.1 rubric | Criteria 1–10 are the ten-criterion rubric. |
| A2 | §4.1 FR-1 | Quality scoring is CI-asserted, not runtime. |
| A3 | §4.1 FR-2 | Waiver mechanism is `tools.json`-level. |
| A4 | §4.1 Notes | CI gate is a GitHub Actions workflow; manual scoring is the fallback. |
| A5 | §4.2 FR-6 | Pack pages are presentation only. |
| A6 | §4.3 FR-7 | ⌘K / Ctrl-K is the palette shortcut. |
| A7 | §4.3 FR-9 | Theme default uses a blocking inline script. |
| A8 | §4.4 FR-11 | `postMessage` uses JSON-validated commands. |
| A9 | §4.7 FR-19 | Bengali is the first non-English locale because the existing BD Tax calculator is bilingual. |
| A10 | §4.8 FR-21 | New tools list is the brainstorm's EXP pack minus server-requiring and duplicate items. |
| A11 | §8 Q2 | Criteria weight equally for v1. |
| A12 | §8 Q3 | Web Components deferred to v2. |
| A13 | §8 Q4 | Native translator for the QR seed; community for the rest. |
| A14 | §8 Q5 | PWA install prompt on second visit. |
| A15 | §8 Q6 | Suite capped at ~50 tools in MVP. |
