---
stepsCompleted: ["step-01-validate-prerequisites", "step-02-design-epics", "step-03-create-stories", "step-04-final-validation"]
status: final
updated: 2026-07-31
validationSummary: "FR 21/21 ✓ · AD 15/15 ✓ · UX-DR 20/20 ✓ · 87 stories across 7 epics (+3 cross-epic) · 0 forward deps · file-churn clean · template compliant · post-readiness drift fixes applied (drift 3, 7, 10, 12 resolved)"
inputDocuments:
  - ../../prds/prd-useful-tools-2026-07-31/prd.md
  - ../../architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md
  - ../../ux-designs/ux-useful-tools-2026-07-31/DESIGN.md
  - ../../ux-designs/ux-useful-tools-2026-07-31/EXPERIENCE.md
  - ../../research/market-handy-tools-market-validation-2026-07-31/research.md
---

# Handy Tools - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Handy Tools, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories. The 33 existing tools under `tools/<slug>/` are the brownfield starting point; the architecture (AD-15) and the PRD's 8/10 Tool Contract define the migration target.

## Requirements Inventory

### Functional Requirements

FR-1: Tool Quality Scoring — the system can measure, store, and publish a tool's score against the ten criteria, refreshed on each release of the tool. A `/quality` page exists, lists every tool, and shows the score per criterion. A failing criterion surfaces a one-line remediation note. Each release increments a `last-updated` timestamp visible on the page.

FR-2: Tool Contract Gate — a new tool cannot be merged into the suite unless its score is ≥ 8/10 and the failing criteria are explicitly waived with a `[WAIVER: reason]` annotation in the Site Data. A CI check reads `tools.json` and rejects any tool with `score < 8` and no waiver. Waivers expire after two releases unless renewed.

FR-3: Per-Tool Quality Audit — every existing tool ships with a one-time audit result (pass/fail per criterion) and a remediation list. Existing tools with a score < 8 are scheduled for promotion before any new tool is added. A `docs/quality-audit.md` lists every tool and its audit date. A tool promoted to ≥ 8 is marked `ready: true` in Site Data.

FR-4: Site Data Schema — the system can read `tools.json` and render the home grid, the command palette, pack pages, and the `/embed/<tool>` redirect. `tools.json` validates against a JSON Schema checked in CI. Adding a tool requires only an entry in `tools.json` (no HTML duplication). Each entry carries: id, slug, title, description, category, pack, icon, keywords, last-updated, ready, score, urlState schema, shortcuts.

FR-5: Tool Search — the system can search tools by title, description, and keywords, returning ranked results in ≤ 50ms (cold) / ≤ 10ms (warm). Header search bar offers results as the user types. Command palette (FR-7) delegates to this search. ⌘K / Ctrl-K opens the palette from any tool page. Case-insensitive, accent-insensitive (NFKD), exact > prefix > word-boundary > substring > fuzzy (Levenshtein ≤ 2).

FR-6: Pack Pages — the system can render one curated page per pack, listing its tools and a short pack description. `/packs/travel` exists; lists tools tagged `pack=travel`. Empty packs (no tools ready) are not linked. Pack pages are presentation only — no pack-specific UI.

FR-7: Command Palette — the system can open a palette from any page via ⌘K / Ctrl-K, search tools and global actions, and navigate to a result on Enter or trigger the action. Escape closes the palette and returns focus to the calling element. The palette shows recent tools, top 5 fuzzy matches, and a footer with shortcut hints. A "?" action opens a per-tool keyboard help overlay. The keyboard help overlay is reachable from any tool without first opening the palette.

FR-8: Settings Modal — the system can present a single settings modal with: theme (light/dark/auto), language (locale picker), default units (metric/imperial), default currency, font scale, reduced motion toggle, and a "Clear all local data" action. Settings persist in localStorage. "Clear all local data" wipes every registered key and confirms twice. No settings UI is rendered inside any tool.

FR-9: Theme System — the system can render a light theme, a dark theme, and an auto theme that follows `prefers-color-scheme`. The default theme is set via a blocking inline script before first paint to avoid flash (FOUC < 50ms). Theme persists across sessions. High-contrast and forced-colors modes are respected.

FR-10: Embed URL & Snippet — the system can serve any tool at `/?embed=<slug>` with chrome removed, the tool's input accepted via URL-encoded state, and a fixed-size responsive surface. A copy-able `<iframe src="https://handy.tools/?embed=qr">` snippet is shown on each tool's page. The iframe receives focus and keyboard inputs from the host page. The embed is responsive to a container width ≥ 240px.

FR-11: postMessage API — the system can communicate with the host page via `postMessage` for input/output events. Messages are JSON-validated; unknown commands are no-ops. The host can request the current state, set inputs, and subscribe to result updates. Protocol: `{ v: 1, id, type, payload? }` with allowlisted `type` values, 64KB payload cap, origin checks, instance-scoped per UUID.

FR-12: Per-Tool History — the system can record the last 10 inputs/results per tool, persist them in localStorage, and present them in a visible "History" panel. Each history entry is timestamped and shows key inputs and the result. Restoring an entry replaces the current inputs (with confirm if currently unsaved). Entries are held to ≤ 10 per tool; older entries are dropped silently. Storage key: `handy-tools.history.<slug>`.

FR-13: User Data Export & Import — the system can export all local data (history, settings, favorites, recent) as a single JSON file and import it back, validating the schema. "Export my data" is a single button in the Settings modal. The import validates schema and version; rejected imports show a clear error.

FR-14: PWA Install — the system can prompt for PWA install on supported browsers and serve the installed app offline. A `manifest.webmanifest` exists, references the icons, and declares `display: standalone`. A service worker is registered, caches the shell and last-used tool assets, and supports cache migration on version bumps. An offline fallback page exists for uncached paths.

FR-15: Trust Surface — the system can serve a `/privacy` page that lists every `localStorage` key the site uses, what it stores, and when it is cleared. The page also shows a wire log of the current session's network requests (zero by default). `/privacy` is reachable from any tool's footer. The localStorage key list is generated from a single source of truth (a registry) so it cannot drift. Network requests are captured from the same channel the user can verify with DevTools.

FR-16: Source Transparency — the system can link each tool's page to the repo and open the source file at the matching path. Every tool footer has a "View source" link. The link opens the repo at the live file path on the default branch. Convention: `https://github.com/<owner>/<repo>/blob/main/tools/<slug>/index.html` from `site-config.js`.

FR-17: Message Catalogs — the system can read copy from per-locale JSON files and fall back to English when a key is missing. Every user-visible string is keyed; no inline strings in tool HTML. Adding a locale is a single file addition. `en.json` is canonical; CI rejects duplicate keys and invalid JSON.

FR-18: Locale-Aware Formatting — the system can format numbers, dates, and currency using `Intl.*` APIs without shipping locale data. Currency, decimal separators, and date formats follow the active locale. RTL languages (Arabic) render correctly under the existing CSS layout via `[dir="rtl"]` and CSS logical properties.

FR-19: Starter Locales — the system ships English, Bengali, Hindi, Spanish, and Arabic as locale options. Each locale has a complete catalog for the shell and one full tool (the QR generator or similar). The locale picker is shown in the Settings modal.

FR-20: Pack Decomposition — the system can tag each tool with its pack(s) and render pack pages. Each tool has at least one pack; tools can appear in multiple packs. Pack pages are reachable from the home grid and the command palette. Travel (mobility/timezone/currency), Finance (budget/savings/loan/tax/split), Study (GPA/Pomodoro/flashcard/citation/word counter), Developer (JSON/CSV/YAML/regex/diff/JWT/UUID/timestamp/Base64/URL), Household (recipe/area/volume/paint/unit converter/tip/split).

FR-21: New Tools (MVP) — JSON Formatter enhancements (CSV/YAML add), Citation formatter, Diff viewer, UUID generator, JWT inspector, Timestamp converter, Flashcard timer, Exam countdown, Recipe scaler, Grocery list builder, Paint calculator, Area/volume calculator, Budget planner, Savings goal, Currency converter (cached rates). Each new tool ships with metadata, an icon, an entry in Site Data, and a score ≥ 8 (or waiver). Each new tool realizes at least one user journey.

### NonFunctional Requirements

NFR-1: Performance — Home page LCP < 1.5s on mid-range mobile (Moto G Power baseline). Tool interactive (TTI) < 1s after navigation. CLS ≤ 0.05. Total JS for shell < 30KB gzipped. Total CSS < 30KB gzipped. Tool's first load adds ≤ 30KB over shell.

NFR-2: Accessibility — Lighthouse Accessibility ≥ 95 per tool. All tools keyboard-complete in ≤ 90 seconds by an external tester. WCAG 2.1 AA. Visible focus. 4.5:1 text contrast, 3:1 UI contrast. `prefers-reduced-motion` honored. WAI-ARIA combobox 1.1 listbox pattern for the command palette. RTL-safe layout (`padding-inline`, `margin-block` logical properties).

NFR-3: Privacy — Zero third-party network requests in all tools. Zero analytics. No CDN fonts/scripts. No fingerprinting. No cookie banners. No advertising. No tracking pixels. localStorage keys namespaced `ht.*` (runtime) and `handy-tools.*` (user data). `ht.theme` grandfathered.

NFR-4: Compatibility — Current Chrome, Firefox, Safari, Edge. `file://` works for tools that don't require a service worker. No UA sniffing; feature detection only. PWA install prompt is Chromium-only — Safari (iOS + macOS) uses Share → Add to Home Screen; Firefox desktop has no install UX.

NFR-5: Reliability — All calculations isolated from DOM. Pure functions testable. No silent rounding; explicit rounding rules per tool. Service worker caches deterministically; cache stampedes prevented by `CACHE_VERSION` atomic with `tools.json.releaseVersion`.

NFR-6: Printability — Every tool has a `@media print` stylesheet that renders clean output (black on white, hides chrome, supports multi-page result sets).

NFR-7: Internationalization — All copy keyed; locale-aware formatting through `Intl.*`. RTL-safe (not RTL-first).

NFR-8: Cost — Static hosting on GitHub Pages. No server-side code. No paid third-party services.

NFR-9: Surface — Fully static. No native app. No PWA that requires a backend. No build step (no Node, no `package.json`, no bundler, no transpiler).

NFR-10: Tech — Vanilla JS, HTML, CSS only. No third-party libraries at runtime. Vendored libraries (e.g., QR generator) must be vendored in `assets/js/vendor/` and may be ES5/ES2018 source. `assets/js/qrcode.js` is the only vendored library today; its license is [TO VERIFY].

### Additional Requirements

From the Architecture Spine (AD-1 through AD-15):

AR-1: AD-1 — No `<script src>` or `<link href>` may point to an external host. No `import` statement may resolve at runtime to anything outside the repo. Vendored libraries only inside `assets/js/vendor/`.

AR-2: AD-2 — A Tool's `tools.json` entry must record `score ≥ 8` and zero `waivers` expired to be `ready=true`. `ready=false` Tools do not appear in home grid, palette, pack pages, search, or embed catalog. CI rejects PRs that flip `ready` without a paired audit-doc update.

AR-3: AD-3 — Home grid, command palette results, pack pages, and embed catalog are all generated from `tools.json`. CI validates `tools.json` against the schema and asserts every `slug` resolves to `tools/<slug>/index.html`.

AR-4: AD-4 — Theme, locale, settings modal, command palette, toast region, install prompt, offline banner, history API, and data export/import are exclusively in the Shell. Tools call `HT.*` only — never re-implement.

AR-5: AD-5 — URL codec grammar: Shell scope uses query string (`?tool=<slug>`, `?pack=<slug>`, `?embed=<slug>`, `?dashboard=1`, `?quality`, `?privacy`); per-Tool scope uses fragment (`#k=v&k=v`); UTF-8 percent-encoded; keys `[a-z][a-z0-9-]*`; arrays via duplicate-key form; numbers and dates in canonical form; sorted lexicographically; defaults omitted; schema declared in `tools.json`; `_v` key for schema version; pack defaults under Tool fragment state with explicit fragment state winning.

AR-6: AD-6 — Every `localStorage` key registered in `assets/js/storage-registry.js` with `{ purpose, lifetime, schema, owner }`. Registry rejects duplicate registrations at boot. Each key has exactly one `owner` module. Tools own only their own history keys; shared keys accessed via `HT.*` APIs. Existing `ht.theme` grandfathered.

AR-7: AD-7 — Embed mode (`?embed=1` and `?embed=<slug>`) hides header/footer, disables palette/settings, locks theme to system, locks locale to host. Tool renders identically. `postMessage` is in `assets/js/embed.js` only — instance-scoped (UUID per embed), envelope `{ v: 1, id, type, payload? }`, allowlist of `type` values, 64KB payload cap, 8-level nesting limit, origin checks, teardown on `pagehide`/`unload`/`destroy`.

AR-8: AD-8 — Service worker precaches Shell assets on install; per-Tool assets cached on first visit (SWR) and LRU-evicted at 8MB or 50 tools (whichever is smaller). `CACHE_VERSION` in `sw.js` mirrored in `tools.json.releaseVersion`; CI rejects divergence. `skipWaiting()` + `clients.claim()` enabled. Navigation routes enumerated: `/`, `/packs/*`, `/quality`, `/privacy`, `/embed/*`, `/tools/<slug>`; others fall back to `/offline`. PWA install triggered via `beforeinstallprompt` (Chromium only); Safari shows manual instruction sheet; Firefox hides install button.

AR-9: AD-9 — Tools cannot import other Tools' JS, read other Tools' DOM, or write to other Tools' `localStorage` namespace. Cross-Tool interaction via `HT.actions.dispatch('tool-id', { input })`. Pack pages are the only grouping surface.

AR-10: AD-10 — All user-facing copy in `/locales/<lng>.json`. All formatting via `Intl.NumberFormat`, `Intl.DateTimeFormat`, `Intl.PluralRules`, `Intl.ListFormat`. No locale data shipped. RTL via `[dir="rtl"]` and CSS logical properties.

AR-11: AD-11 — `/privacy` generated from `assets/js/storage-registry.js` on every page load. `/quality` generated from `tools.json` on every page load. View-source link from `assets/js/site-config.js` config object. Network log via `performance.getEntriesByType('resource')` snapshot (same-origin resources only; cross-origin without TAO shows zeroed fields; sufficient because AD-1 forbids external hosts).

AR-12: AD-12 — No `package.json`, no build step, no transpiler, no TypeScript, no JSX. Plain CSS with custom properties. JS is ES5 baseline today (existing utils.js/layout.js/theme.js); new Shell modules may use ES2018 features. Vendored libs must be ES5/ES2018 source — no `.min.js` without the source.

AR-13: AD-13 — One-way dependency: Shell → Tool. Tool calls `HT.*` only; never imports/references/reaches into Shell. Shell loads Tools on demand via dynamic `<script>` insertion after first paint. Tools declare `window.HT.register(slug, { mount, unmount })`.

AR-14: AD-14 — Every `HT.<domain>.*` method has a contract entry in `assets/js/api-contract.js` with signature, return type, errors, owner module, mutation path, initialization timing, and stability level (`stable` / `experimental` / `internal`). Shell modules may not bypass another module's API to read/write its state. Tool-provided APIs registered via `HT.provide(slug, api)`; registry enforces uniqueness.

AR-15: AD-15 — Brownfield migration is staged. `docs/tool-inventory.md` classifies each existing tool as `legacy`, `candidate`, or `ready`. Home grid supplements via `tools.json` until migration is complete; never replaces until every legacy tool is `ready`. CI fails if a tool folder exists without an entry in `tool-inventory.md`. Each migration step is a single reversible PR. `ht.theme` grandfathered.

AR-16: Stack — Vendored QR encoder `assets/js/qrcode.js` is the only vendored library today (license [TO VERIFY]). Bundle budget: 30KB shell JS + 30KB shell CSS gzipped; tools add ≤ 30KB each.

AR-17: Operational envelope — Targets static hosting (GitHub Pages); deploy is git push. No CI/CD configured today — to be added (lint `tools.json`, run rubric-test harness, reject `ready: true` with score < 8).

### UX Design Requirements

UX-DR-1: Design tokens — Implement the cobalt palette (light + dark) plus typography scale, spacing rhythm, rounded radii, and elevation tokens from `DESIGN.md` as CSS custom properties on `:root` and `:root[data-theme="dark"]`. `forced-colors` mode detected via `@media (forced-colors: active)` and adapts tokens at runtime.

UX-DR-2: Component library — Implement the 21 components specified in EXPERIENCE.md §4: Button (3 variants), Input, Result Tile, Tool Card, Command Palette, Settings Modal, History Panel, Keyboard Help Overlay, Embed Snippet dialog, Toast, Sample Data Link, Pack Card, Breadcrumb, Footer, Star (Pin) Button, Numeric Stepper, Toggle Switch, Slider, Tabs, Dialog (Embed/Share), Skip Link, Banner, Color/Theme Indicator, "What gets copied?" disclosure.

UX-DR-3: Modal/Overlay/Sheet taxonomy — Three distinct categories: Modal (Settings — blocks, focus trap, scroll lock), Overlay (Palette, Keyboard Help — non-blocking, focus not trapped), Sheet (History on <md, Settings on <md, Embed on <md — slides up, focus trapped). This taxonomy determines when to use `aria-modal`, backdrop, and scroll lock.

UX-DR-4: Voice and tone — Restraint, no exclamation marks, no emojis in product copy, no "We hope you love it!" Voice sample strings in EXPERIENCE.md §3.3 are canonical. Microcopy presets in §3.2 are the deltas (Do vs Don't).

UX-DR-5: State patterns — Implement 18 documented states per EXPERIENCE.md §5: cold load (home / tool / heavy tool), empty (tool, home search, history, pack), partial input, validation error, success/copy, success/share, success/print, offline, offline+never visited, keyboard help open, palette no matches, embed mode, embed+offline, RTL active, reduced motion active, first visit, PWA installed, SW updating. Each state has prescribed treatment.

UX-DR-6: Global keyboard map — Implement EXPERIENCE.md §6.1: `⌘K`/`Ctrl-K` palette, `/` home search or palette, `?` help, `Esc` close, `g h` home, `g p` packs, `g s` settings, `g q` quality, `g v` privacy, plus per-tool shortcuts (e.g., `s` share, `p` print, `h` history, `1`–`9` palette selection).

UX-DR-7: Per-tool surface list — Implement the 23 surfaces enumerated in EXPERIENCE.md §2 (Home, Home Search, Home Pack Row, Tool Page header/inputs/result/history/sample/copy/share/print/view-source/embed-snippet, Pack Page, Settings Modal, Command Palette, Keyboard Help, `/privacy`, `/quality`, `/about`, `/changelog`, `/404`, `/offline`). All surfaces reachable by keyboard, click, and deep link.

UX-DR-8: Tool slug taxonomy — 35 stable slugs (34 tools + 1 reserved aggregator) per EXPERIENCE.md §2.2. Tools can appear in multiple packs. Slugs are kebab-case and immutable post-launch.

UX-DR-9: Pack composition — Five packs: Travel, Finance, Study, Developer, Household. Each pack ≥ 3 tools in v1. Pack taglines from EXPERIENCE.md §2.3 are canonical.

UX-DR-10: URL behavior — Canonical URLs: `/`, `/tools/{slug}`, `/packs/{slug}`. Query params functional, never required. Trailing slashes 301 to canonical. Hash fragments not used for routing. Home page is the only generic offline fallback; tool pages cache individually on first visit.

UX-DR-11: Search behavior — Client-side index built once on load (≤ 30ms for 35 tools). Case-insensitive, accent-insensitive (NFKD). Matches name + description + tags + pack name. Exact > prefix > word-boundary > substring > fuzzy (Levenshtein ≤ 2). Recent tools (last 5 distinct) appear above grid when query is empty.

UX-DR-12: Pinned tools — Star button on each Tool Card. Up to 9 pinned tools in a top row on home. Pin state stored in `localStorage` under `handy-tools.pins`. Pin state is part of exportable JSON.

UX-DR-13: 404 behavior — `/404` shows plain "That tool doesn't exist.", pre-focused search box, top 9 most-used tools, "Did you mean…" link if a near-match (Levenshtein ≤ 3). Server returns HTTP 404. Never auto-redirects.

UX-DR-14: PWA install UX — `beforeinstallprompt` (Chromium) triggers browser-native prompt after second visit. On Safari (iOS + macOS), show a manual instruction sheet ("Share → Add to Home Screen"). On Firefox desktop, hide the install button. On install, hide the button and show a subtle "Installed" indicator.

UX-DR-15: Skip link — First focusable element on every page; visually hidden until focused. Text: "Skip to main content."

UX-DR-16: Toast region — `aria-live="polite"`, max 3 stacked, 2.5s default, 5s if action offered. Bottom-center on <md, top-right on ≥md. Action toast: button is focusable with keyboard equivalent. Click or action key dismisses.

UX-DR-17: Inline error UX — Errors render inline at the failing field with `role="alert"`, not as toasts. Message is the *fix*, not the problem ("Enter a number between 1 and 100", not "Invalid input"). Focus remains on field; Esc reverts. Primary action disabled while error present. Result tile keeps last good value.

UX-DR-18: Visual treatment of empty states — Empty state copy is subtle, low-emphasis, no icon, no animation. "Enter a value above to see the result." — not an illustration.

UX-DR-19: Accessibility primitives — Every interactive element has visible text or `aria-label`. `:focus-visible` only. Modals use `aria-modal="true"` and trap focus; overlays do not trap. `role="switch"` for toggles, `role="tablist"` for tabs, `role="dialog"` for dialogs. WAI-ARIA combobox 1.1 listbox pattern for the command palette.

UX-DR-20: Responsive & platform — Mobile-first. Single-hand usable on 360px viewport. Tap targets ≥ 44px. No hover-only affordances. No horizontal scroll. Trailing slash behavior + 301 redirect. `file://` works for tools that don't require SW.

### FR Coverage Map

| FR | Epic | Notes |
|---|---|---|
| FR-1 (Tool Quality Scoring) | Epic 1 | `/quality` page + audit-doc shipped with Shell |
| FR-2 (Tool Contract Gate) | Epic 1 | CI gate + waiver mechanism in `tools.json` |
| FR-3 (Per-Tool Audit) | Epic 1 (audit setup) + Epic 2 (33 tools audited) | Audit scaffold in 1; completion in 2 |
| FR-4 (Site Data Schema) | Epic 1 (schema + JSON Schema) + Epic 2 (33 entries) | Discovery pipeline migrates in 2 |
| FR-5 (Tool Search) | Epic 1 (search engine) + Epic 2 (real data) | Engine ships in 1; runs against 33 tools in 2 |
| FR-6 (Pack Pages) | Epic 6 | Travel/Finance/Study/Developer/Household pages |
| FR-7 (Command Palette) | Epic 1 (skeleton with 1 tool) + Epic 3 (full surface) | Skeleton proves the ARIA pattern; full surface in 3 |
| FR-8 (Settings Modal) | Epic 3 | Theme/lang/units/currency/font-scale/motion/clear-data |
| FR-9 (Theme System) | Epic 1 (light/dark tokens) + Epic 5 (forced-colors + PWA theming) | Tokens in 1; UA-mode handling in 5 |
| FR-10 (Embed URL) | Epic 4 | `/embed/<slug>` + snippet dialog |
| FR-11 (postMessage API) | Epic 4 | Protocol envelope + allowlist |
| FR-12 (Per-Tool History) | Epic 3 | 10 entries per tool, `localStorage` owned |
| FR-13 (Export/Import) | Epic 3 | Settings JSON schema |
| FR-14 (PWA Install) | Epic 5 | Manifest + SW + cache versioning |
| FR-15 (Trust Surface) | Epic 5 | `/privacy` from registry + network log |
| FR-16 (Source Transparency) | Epic 3 | Tool footer View Source link |
| FR-17 (Message Catalogs) | Epic 7 | `en.json` canonical + 4 others |
| FR-18 (Locale-Aware Formatting) | Epic 7 | `Intl.*` wrappers in `HT.*` |
| FR-19 (Starter Locales) | Epic 7 | en/bn/hi/es/ar |
| FR-20 (Pack Decomposition) | Epic 2 (existing-tool tags) + Epic 6 (new tools) | Site-data schema in 1, pack tags in 2 |
| FR-21 (New Tools 12-15) | Epic 6 | Per-tool stories |

**Cross-cutting NFRs:** Performance (NFR-1), Accessibility (NFR-2), Privacy (NFR-3), Compatibility (NFR-4), Reliability (NFR-5), Printability (NFR-6), i18n (NFR-7), Cost (NFR-8), Surface (NFR-9), Tech (NFR-10) — each is realized across all epics but is gated by Epic 1 (Shell tokens + CI guardrails). The PWA install browser-scope constraint (NFR-4 footnote from architecture AD-8) is enforced in Epic 5.

**Architecture AR-1 to AR-17 distribution:** AD-1, AD-4, AD-6, AD-12, AD-13, AD-14 land in Epic 1 (Shell bootstrap). AD-2, AD-3, AD-15 land in Epic 1 + Epic 2. AD-5, AD-7, AD-8, AD-9, AD-10, AD-11 land in their bound epics (5, 4, 5, 2, 7, 5/3 respectively). Stack pinning (AR-16) and operational envelope (AR-17) are Epic 1.

**UX-DR-1 to UX-DR-20 distribution:** Token/component/state/voice patterns (UX-DR-1 to UX-DR-5) are Epic 1. Keyboard map (UX-DR-6) is Epic 1 (skeleton) + Epic 3 (full). Surface list (UX-DR-7) and slugs (UX-DR-8) are Epic 1 (registry ready). Pack composition (UX-DR-9) is Epic 6. URL behavior (UX-DR-10) is Epic 1 (Shell) + Epic 4 (embed). Search behavior (UX-DR-11) is Epic 1 + Epic 2. Pinned tools (UX-DR-12) is Epic 1. 404 (UX-DR-13) is Epic 1. PWA install UX (UX-DR-14) is Epic 5. Skip link (UX-DR-15), Toast region (UX-DR-16), Inline error (UX-DR-17), Empty states (UX-DR-18), Accessibility primitives (UX-DR-19) are Epic 1 (Shell) + each tool's contract in Epic 2. Responsive & platform (UX-DR-20) is Epic 1.

## Epic List

### Epic 1: Trusted Browser Suite — Shell + Tool Contract Foundation
**User value:** A user can visit the home page, see the first promoted tool, and trust that the suite's quality bar is auditable. The Shell ships with command palette skeleton, theme toggle, settings modal, and trust surface (privacy + quality + view-source). The 8/10 Tool Contract is enforced as a CI gate before any new tool ships.
**FRs covered:** FR-1, FR-2, FR-3 (audit scaffold), FR-4 (schema), FR-5 (search engine), FR-7 (skeleton), FR-9 (tokens), FR-20 (pack-tag field)
**Architecture ADs:** AD-1, AD-2, AD-3, AD-4, AD-6, AD-12, AD-13, AD-14, AD-15
**UX-DRs:** UX-DR-1, UX-DR-2, UX-DR-3, UX-DR-4, UX-DR-5, UX-DR-6 (skeleton), UX-DR-7, UX-DR-8, UX-DR-10 (Shell), UX-DR-11 (engine), UX-DR-12, UX-DR-13, UX-DR-15, UX-DR-16, UX-DR-17, UX-DR-18, UX-DR-19, UX-DR-20

### Epic 2: Promoted Tool Suite — Bring 33 Tools to the 8/10 Bar
**User value:** Every existing tool a user visits today is ready on the new Tool Contract. The home grid is now `tools.json`-driven, the search index covers all 33 tools, and pack tags are wired. The user perceives no regression — the same 33 tools, now with kebab-case slugs, shareable URL state, sample data, history, and the keyboard-complete surface.
**FRs covered:** FR-3 (audit completion), FR-4 (33 entries), FR-5 (real data), FR-20 (existing-tool pack tags)
**Architecture ADs:** AD-2 (enforced for each), AD-3 (home grid migrate), AD-15 (staged rollout)
**UX-DRs:** UX-DR-11 (real data), and the per-tool contract: keyboard-complete, sample data, history, shareable state, view-source — all reinforced per existing tool

### Epic 3: Keyboard-First UX — Command Palette, Settings, History, Share
**User value:** A user can use ⌘K to find any tool, switch themes, change language, clear data, view history, copy/share/print results, and inspect the source of any tool — all without touching the mouse. The keyboard-first UX is the headline differentiator vs. competitors.
**FRs covered:** FR-5 (warm path), FR-7 (full surface), FR-8, FR-12, FR-13, FR-16
**Architecture ADs:** AD-4, AD-14 (Shell Public API surfaces here)
**UX-DRs:** UX-DR-6 (full), UX-DR-14 (offline banner), UX-DR-19 (palette on every page)

### Epic 4: Embed Everywhere — Any tool usable on any third-party site
**User value:** Marco's journey (UJ-2) is realized. A third-party site owner can paste a single `<iframe>` snippet into their HTML and ship a Handy Tools tool — ads-free, tracking-free, keyboard-complete, offline-capable — to their users. The host can drive the embed via `postMessage` if they want deeper integration.
**FRs covered:** FR-10, FR-11
**Architecture ADs:** AD-7 (full protocol contract)
**UX-DRs:** UX-DR-10 (embed URL semantics), UX-DR-3 (Embed modal = overlay, not blocking modal)

### Epic 5: PWA + Offline — Install, cache, and the trust surface
**User value:** Jamal's journey (UJ-4) is realized. A user can install the suite to their home screen, use it offline on a flight, and inspect /privacy and /quality to verify the privacy and source claims. The PWA install button is Chromium-only; Safari gets a manual instruction sheet.
**FRs covered:** FR-9 (forced-colors, UA-mode theming), FR-14, FR-15
**Architecture ADs:** AD-8 (CACHE_VERSION + SW + offline fallback), AD-11 (Trust Surface generated)
**UX-DRs:** UX-DR-14 (PWA install UX per browser), UX-DR-19 (forced-colors + reduced-motion)

### Epic 6: Packs and New Tools — 5 packs live + 12-15 new tools
**User value:** A user discovers the suite through Travel/Finance/Study/Developer/Household pack pages. Each pack ships ≥ 3 tools (the existing-tool promotions are already in Epic 2) and the 12-15 new tools from FR-21 (JSON Formatter enhancements, Citation formatter, Diff viewer, UUID generator, JWT inspector, Timestamp converter, Flashcard timer, Exam countdown, Recipe scaler, Grocery list builder, Paint calculator, Area/volume calculator, Budget planner, Savings goal, Currency converter).
**FRs covered:** FR-6, FR-19, FR-20, FR-21
**Architecture ADs:** AD-9 (cross-Tool via Site Data only), AD-5 (pack defaults under Tool state)
**UX-DRs:** UX-DR-2 (Pack Card), UX-DR-9 (pack composition), UX-DR-7 (pack page surface)

### Epic 7: Internationalization — 5 starter locales with one fully-translated tool
**User value:** A user can switch the suite to Bengali, Hindi, Spanish, or Arabic and the Shell copy + the QR generator and tip calculator translate; numbers, dates, and currency follow the locale; right-to-left layout mirrors cleanly under existing CSS logical properties.
**FRs covered:** FR-17, FR-18, FR-19
**Architecture ADs:** AD-10 (i18n + Intl), AD-5 (locale in URL state)
**UX-DRs:** UX-DR-2 (Locale toggle), UX-DR-20 (RTL-safe layout)

### Dependencies (each later epic builds on earlier)
- Epic 2 depends on Epic 1 (Schema, Contract Gate, Shell bootstrap).
- Epic 3 depends on Epic 1 (palette skeleton) + Epic 2 (real Tool entries).
- Epic 4 depends on Epic 1 + Epic 2 + Epic 3 (palette/settings/history must exist to be disabled in embed mode).
- Epic 5 depends on Epic 1 (manifest/SW require Shell assets) + Epic 2 (per-Tool cache requires entries).
- Epic 6 depends on Epic 1 + Epic 2.
- Epic 7 depends on Epic 1 (catalogs keyed off Shell strings).

Each epic delivers standalone user value within its scope; later epics layer enhancements on top.

---

## Epic 1: Trusted Browser Suite — Shell + Tool Contract Foundation

**Epic goal:** Ship the greenfield Shell, the `tools.json` Site Data contract, the 8/10 Tool Contract enforcement (CI gate), and a usable home grid with at least one promoted existing tool. The Shell renders with the cobalt palette, theme tokens, command palette skeleton, and settings modal skeleton — all backed by the registry, codec, and storage rules that future epics extend.

**FRs covered:** FR-1, FR-2, FR-3 (audit scaffold), FR-4, FR-5 (engine), FR-7 (skeleton), FR-9 (tokens), FR-20 (pack-tag field)
**Architecture ADs:** AD-1, AD-2, AD-3, AD-4, AD-6, AD-12, AD-13, AD-14, AD-15
**UX-DRs:** UX-DR-1, UX-DR-2, UX-DR-3, UX-DR-4, UX-DR-5, UX-DR-6 (skeleton), UX-DR-7, UX-DR-8, UX-DR-10 (Shell), UX-DR-11 (engine), UX-DR-12, UX-DR-13, UX-DR-15, UX-DR-16, UX-DR-17, UX-DR-18, UX-DR-19, UX-DR-20

### Story 1.1: Establish Greenfield Tool Contract Schema

As a developer integrating a tool with the suite,
I want a single JSON Schema at `tools.schema.json` that every `tools.json` entry must validate against,
So that adding a tool is data-only and any drift is caught in CI before merge.

**Acceptance Criteria:**

**Given** a new or edited `tools.json`
**When** CI runs the validate-tools-json workflow
**Then** every entry validates against `tools.schema.json` (id, slug, title, description, category, pack, icon, keywords, last-updated, ready, score, urlState schema, shortcuts, history-keys, view-source, embed-snippet, search-priority)
**And** any schema violation fails the build with the field path and message
**And** the schema file is referenced from `tools.json` via `$schema`
**And** a local `make validate` target runs the same check without network access

### Story 1.2: Codify the 8/10 Quality Rubric as Test Cases

As a maintainer reviewing a tool's PR,
I want the ten PRD criteria to be encoded as a checklist a reviewer can run by hand and a linter can check automatically,
So that the 8/10 bar is concrete and not vibes-based.

**Acceptance Criteria:**

**Given** a tool entry in `tools.json`
**When** the maintainer runs `make rubric-<slug>`
**Then** a markdown report prints for each of the ten criteria with pass/fail/notes columns
**And** the report totals a score (max 10)
**And** a passing score (≥ 8) is required for `ready: true`
**And** a failing criterion surfaces a one-line remediation note generated from the rubric
**And** the rubric file lives at `docs/quality-rubric.md` and is versioned alongside `tools.schema.json`

### Story 1.3: Tool Contract CI Gate (GitHub Actions)

As a repository maintainer,
I want any tool entry with `score < 8` and no `[WAIVER: reason]` annotation to fail CI,
So that no tool below the bar can reach `main` without an explicit, dated waiver.

**Acceptance Criteria:**

**Given** a PR that edits `tools.json`
**When** the GitHub Actions workflow `tool-contract-gate` runs
**Then** every entry with `score < 8` is rejected unless its `waiver` field is set with a non-empty `reason` and a `since-release` value
**And** the waiver output includes the reason, the granting reviewer, and the release it was added in
**And** waivers expire after two releases — the gate flags any waiver older than two `tools.json` releases and fails
**And** the workflow status is posted as a PR check and blocks merge

### Story 1.4: Brownfield Migration Inventory and Rollout Order

As a maintainer planning the staged rollout of 33 existing tools,
I want a generated inventory at `docs/tool-inventory.md` with the per-tool migration wave assignment,
So that Epic 2's work is enumerable and reversible per AD-15.

**Acceptance Criteria:**

**Given** the current `tools/<slug>/` directories and `assets/js/{utils,layout,theme}.js` files
**When** the maintainer runs `make tool-inventory`
**Then** `docs/tool-inventory.md` is regenerated listing every tool with its current slug, wave (1/2/3), kebab-case target slug, ES5-vs-modern marker, sample-data presence, and contract-gap checklist
**And** the file is committed to the repo and rendered in CI logs
**And** `tools.json` is initially populated with the wave-1 entries marked `ready: false`, score: 0
**And** deleting a tool entry + deleting its folder both succeed with no dangling links (CI greps)

### Story 1.5: Shell HTML Skeleton with Cobalt Tokens

As a user landing on any page,
I want the Shell to render the header, footer, theme tokens, and main content slot before any tool code runs,
So that the layout is stable across tools and there is no FOUC.

**Acceptance Criteria:**

**Given** a request to `/` or `/tools/<slug>`
**When** the Shell HTML loads
**Then** the header (logo, search bar trigger, theme toggle, locale placeholder, settings cog) and footer (privacy, quality, view-source, GitHub) render before tool-specific JavaScript
**And** a blocking inline script in `<head>` reads `localStorage.ht.theme`, sets `data-theme` on `<html>` within 50ms of first paint (measured via `PerformanceObserver`)
**And** CSS variables (cobalt palette) are applied at `:root` so tool styles inherit them
**And** `<main>` carries a landmark `aria-label` reflecting the current tool or page

### Story 1.6: Theme System with Light, Dark, and Auto Modes

As a user who prefers dark mode at night and light by day,
I want a theme toggle that respects `prefers-color-scheme` and persists across sessions,
So that I never see a flash of the wrong theme and I can override when I want.

**Acceptance Criteria:**

**Given** the user has `prefers-color-scheme: dark`
**When** the user lands on any page with theme set to `auto`
**Then** the page renders in dark mode with no FOUC (measured < 50ms)
**And** when the user clicks the theme toggle and selects `light`, the theme persists to `localStorage.ht.theme` and reloads in light mode
**And** the OS preference change is honored when `theme=auto` and ignored when `theme=light|dark`
**And** `@media (forced-colors: active)` overrides are detected and the toggle is hidden (UA-mode display only)

### Story 1.7: Command Palette Skeleton with `⌘K` / `Ctrl-K` Bind

As a user wanting to find any tool quickly,
I want a command palette that opens with `⌘K` / `Ctrl-K` from any page and shows recent tools,
So that keyboard navigation starts with one chord.

**Acceptance Criteria:**

**Given** the user is on any page
**When** they press `⌘K` (mac) or `Ctrl-K` (others)
**Then** the palette modal opens, focus moves to the input, and a single-listbox combobox 1.1 pattern (WAI-ARIA) is established
**And** recent tools (from `localStorage.ht.recent`) populate the list as the user has not typed yet
**And** pressing `Escape` closes the palette and returns focus to the calling element
**And** with the palette closed, pressing the chord again reopens it
**And** a full search experience (top 5 fuzzy matches, footer hints, `?` action) is wired in Epic 3

### Story 1.8: Settings Modal Skeleton with Persisted Preferences

As a user who wants the suite to remember my preferences,
I want a Settings modal reachable from the header that persists theme, language, units, and a clear-data action,
So that I never have to set these again on returning visits.

**Acceptance Criteria:**

**Given** the user opens the Settings modal from the header cog
**When** the modal renders
**Then** it shows fields for theme (light/dark/auto), language (locale picker), default units (metric/imperial), default currency, font scale (slider 80–120%), reduced-motion toggle, and a "Clear all local data" button
**And** each field reads its current value from `localStorage.ht.<key>` and writes back on change
**And** the "Clear all local data" action shows a confirm dialog and then wipes every registered key (registered via the storage-registry added in Story 1.10)
**And** closing the modal with `Escape` saves the last-set values and returns focus to the cog
**And** no settings UI renders inside any tool page

### Story 1.9: Home Grid Rendering from `tools.json`

As a user landing on `/`,
I want to see a grid of tool cards rendered from Site Data only,
So that adding a tool requires no HTML change.

**Acceptance Criteria:**

**Given** `tools.json` contains N entries
**When** the user visits `/`
**Then** the home grid renders one card per entry with title, icon, and category
**And** clicking a card navigates to `/tools/<slug>`
**And** tools with `ready: false` are visually marked (lock badge) and clicking them shows a "Coming soon" notice instead of navigating
**And** the grid is responsive (1 col mobile, 2 tablet, 3 desktop, 4 wide) using CSS grid + `clamp()` — no media-query breakpoints except at the form-factor flip
**And** the grid renders without any per-tool HTML duplication

### Story 1.10: Storage Registry with Namespaced Keys

As a developer building any tool or Shell feature,
I want a single registry of every localStorage key the site reads or writes,
So that the privacy page, export/import, and clear-data actions cannot drift from the code.

**Acceptance Criteria:**

**Given** any module needs to read or write localStorage
**When** the developer calls `HT.storage.get(key)` or `HT.storage.set(key, value)`
**Then** the call is dispatched through `assets/js/storage-registry.js` which validates the key prefix (`ht.*` for runtime, `handy-tools.*` for user data) and routes accordingly
**And** the registry rejects any key not declared in its `keys` object at module init (warns in dev, throws in CI)
**And** Tools own only keys in their declared `history-keys` list (AD-6 owner-per-key rule)
**And** `/privacy` (Epic 5) renders the registry key list — no per-key string maintained separately

### Story 1.11: Search Engine Backend with Ranking and Normalization

As a developer wiring the header search bar and command palette,
I want a pure-function search engine that ranks matches by exact > prefix > word-boundary > substring > fuzzy,
So that the UX layer (Epic 3) only needs to bind the input and render results.

**Acceptance Criteria:**

**Given** the engine receives a query string
**When** it indexes all entries in `tools.json` at module init
**Then** the cold path returns ranked results in ≤ 50ms (measured with `performance.now()` over 10 random queries on a cold cache)
**And** the warm path (cache warmed once) returns in ≤ 10ms
**And** matching is case-insensitive and accent-insensitive (NFKD normalization)
**And** results expose `{ slug, title, score, matchedField }` so the UX layer can render the matched term in bold
**And** the engine is exposed as `HT.search(query)` (Shell Public API, AD-14)

### Story 1.12: View-Source Route for Every Tool

As a user who wants to verify the code behind a tool,
I want a `/view-source?tool=<slug>` route that renders the tool's HTML, CSS, and JS as syntax-highlighted source,
So that the "no obfuscation" claim is verifiable in one click.

**Acceptance Criteria:**

**Given** a user visits `/view-source?tool=qr`
**When** the route renders
**Then** it shows three code blocks: the tool's HTML fragment, its scoped CSS, and its JS file content
**And** syntax highlighting is applied via a vendored, zero-dependency highlighter (`assets/vendor/prism.min.js` or hand-rolled token regex)
**And** the route works for any tool whose files exist under `tools/<slug>/`
**And** the "View Source" footer link on each tool page points to this route with the tool's slug

### Story 1.13: Audit Scaffold and Initial Tool Audit Results

As a maintainer tracking each tool's progress toward the bar,
I want a `docs/quality-audit.md` listing every tool with its audit date and pass/fail per criterion,
So that promotion order is explicit and reversible.

**Acceptance Criteria:**

**Given** the inventory from Story 1.4 lists 33 tools
**When** the maintainer runs `make audit-all`
**Then** `docs/quality-audit.md` is regenerated with one row per tool: tool, wave, audit-date, pass-count/10, failing-criteria, remediation-list
**And** the table is sortable by status (red/yellow/green) and groupable by wave
**And** any tool with score < 8 appears in red and is listed for promotion in Epic 2
**And** promoting a tool to ≥ 8 flips it to `ready: true` in `tools.json` and updates the audit file

### Story 1.14: Shell Public API and Bypass Prohibition

As a developer extending the Shell,
I want a documented `HT.*` namespace that all Shell features expose and that Tools may not bypass,
So that the dependency direction Shell→Tool (AD-13) is enforceable.

**Acceptance Criteria:**

**Given** a developer adds a new Shell feature (e.g., the future export/import)
**When** they expose it via `HT.export`, `HT.import`, etc.
**Then** the namespace is documented in `docs/shell-public-api.md` with stability levels (stable/experimental/internal)
**And** CI runs a grep that fails if any code under `tools/` reaches `localStorage`, `document.cookie`, `fetch`, `XMLHttpRequest`, or `HT.provide` directly — only the registered `HT.storage` and `HT.net` APIs are allowed
**And** `HT.provide(key, fn)` is the only way a Tool may register an API the Shell consumes (AD-14)
**And** the bypass-check workflow `shell-bounds-check` runs on every PR

### Story 1.15: First Promoted Tool Lands on Home Grid

As a user verifying the suite works end-to-end before any other tool ships,
I want to see one existing tool (e.g., QR generator) promoted and reachable from the home grid,
So that the greenfield Shell is provably wired to a real tool before wave 2.

**Acceptance Criteria:**

**Given** wave-1 selection names the QR generator as the first promotion
**When** the maintainer runs `make promote-qr`
**Then** `tools.json` is updated with the QR entry: `ready: true`, `score: 8`, all `urlState` keys, history-keys, view-source path, embed-snippet
**And** `/tools/qr-code-generator` renders the migrated tool under the new Shell with the cobalt palette, theme toggle, settings cog, and footer links
**And** the audit log records the promotion date and the rubric pass
**And** this story alone is sufficient to verify the Epic 1 contract end-to-end (Tool Contract → Schema → Storage Registry → Shell → View-Source → Search)

---

## Epic 2: Promoted Tool Suite — Bring 33 Tools to the 8/10 Bar

**Epic goal:** Every existing tool ships under the new Shell with its slug kebab-cased, its `urlState` declared, sample data present, history wired, share button visible, and view-source link active. Each tool passes the 8/10 rubric and is marked `ready: true`. Pack tags are wired so future pack pages render correctly.

**FRs covered:** FR-3 (audit completion), FR-4 (33 entries), FR-5 (real data), FR-20 (existing-tool pack tags)
**Architecture ADs:** AD-2 (enforced for each), AD-3 (home grid migrate), AD-15 (staged rollout)
**UX-DRs:** UX-DR-11 (real data) and the per-tool contract reinforced per existing tool

### Story 2.1: Per-Tool URL State Codec Wiring

As a user wanting to share a tool's input,
I want every tool to declare its `urlState` schema in `tools.json` and have the Shell encode/decode the URL automatically,
So that I never have to copy inputs by hand.

**Acceptance Criteria:**

**Given** a tool has `urlState` declared as `{ keys: [...], defaults: {...} }`
**When** the user changes an input
**Then** the URL hash updates within 100ms via `HT.urlState.encode(state)` per AD-5 grammar (UTF-8 percent-encoded, sorted keys, defaults omitted, `_v` for version)
**And** pasting the URL on a fresh tab restores all inputs to the encoded values
**And** unknown keys in the hash are ignored without warning
**And** the pack defaults (from the entry's `pack` field) are applied before the per-tool defaults (Epic 6)

### Story 2.2: Per-Tool Sample Data and Reset Button

As a user landing on a tool for the first time,
I want the tool pre-populated with realistic sample data and a one-click reset button,
So that I can see what it does and recover from a bad input.

**Acceptance Criteria:**

**Given** a tool is migrated and has sample data declared in `tools.json.sample`
**When** the tool renders
**Then** the inputs are pre-populated with the sample values
**And** a "Reset to sample" button is visible in the tool's actions area
**And** clicking reset restores the sample values and clears history (with confirm if there is unsaved state)
**And** the sample data is exercised in the rubric (criterion 3 — sample data present)

### Story 2.3: Per-Tool History Panel

As a user wanting to recover yesterday's inputs,
I want a visible History panel on every tool showing the last 10 inputs with timestamps,
So that I can re-run a previous calculation without re-entering values.

**Acceptance Criteria:**

**Given** the user has run a tool at least once
**When** they open the History panel
**Then** they see up to 10 entries with timestamp, key inputs, and the result preview
**And** clicking an entry replaces the current inputs (with confirm if currently unsaved)
**And** storage key is `handy-tools.history.<slug>` per AD-6
**And** entries older than the 10th are dropped silently
**And** history is per-tool (no cross-tool leakage)

### Story 2.4: Per-Tool Keyboard-Complete Surface

As a keyboard-first user,
I want every action on every tool reachable via Tab and Enter without ever needing the mouse,
So that the suite is fully operable from the keyboard.

**Acceptance Criteria:**

**Given** the user is on any tool page
**When** they press `Tab` repeatedly
**Then** focus visits every interactive element in a logical order (inputs → actions → reset → share → history → footer)
**And** every input has a visible `:focus-visible` ring matching the cobalt palette
**And** pressing `Enter` on a focused button triggers its action
**And** pressing `?` opens a per-tool shortcuts overlay (Epic 3 wires this fully)
**And** no tool action requires hover-only interaction

### Story 2.5: Per-Tool Share Dialog with URL and Print

As a user wanting to share or print a tool's result,
I want a Share dialog offering Copy URL, Print, and Embed Code,
So that I can pass the tool to a colleague in any medium.

**Acceptance Criteria:**

**Given** the user clicks the Share button on any tool
**When** the dialog opens
**Then** it shows: the canonical URL with current state encoded, a Copy URL button, a Print button, and an Embed Code snippet (`<iframe src="..." width="..." height="...">`)
**And** clicking Copy URL writes the URL to the clipboard and shows a 2-second toast confirmation
**And** clicking Print opens the browser print dialog with a print stylesheet (no chrome, no nav, no footer)
**And** the dialog is dismissible via `Escape`

### Story 2.6: Promote Wave-1 Tools (3 tools)

As a user expecting the first migration wave to be solid,
I want three wave-1 tools (e.g., QR generator, tip calculator, JSON formatter) promoted to `ready: true`,
So that the home grid shows real working tools from day one of the rollout.

**Acceptance Criteria:**

**Given** `docs/tool-inventory.md` lists three wave-1 tools
**When** the maintainer runs `make promote-wave-1`
**Then** each tool's `tools.json` entry is updated to `ready: true`, `score: 8`+, with all rubric criteria passing
**And** each tool renders under the new Shell with URL state, sample data, history, share, view-source, and embed snippet
**And** `docs/quality-audit.md` shows green for all three
**And** a smoke test in CI visits `/tools/<slug>` for each and asserts no console errors

### Story 2.7: Promote Wave-2 Tools (15 tools)

As a user expecting the second migration wave to cover the most-used tools,
I want 15 wave-2 tools promoted following the same per-tool contract,
So that the home grid is meaningfully populated.

**Acceptance Criteria:**

**Given** wave-2 tools are listed in `docs/tool-inventory.md`
**When** the wave-2 promotion runs
**Then** all 15 tools reach `ready: true` with score ≥ 8
**And** the audit file shows green for all 15
**And** any tool that cannot reach 8/10 is left at `ready: false` with the failing criteria listed in the audit remediation column
**And** the home grid renders all 15 as unlocked cards
**And** a regression smoke test visits each and asserts no console errors

### Story 2.8: Promote Wave-3 Tools (15 tools)

As a user wanting the entire brownfield suite available,
I want the final wave of 15 tools promoted,
So that no tool is left behind on the old Shell.

**Acceptance Criteria:**

**Given** wave-3 tools are listed in `docs/tool-inventory.md`
**When** the wave-3 promotion runs
**Then** all 15 tools reach `ready: true` with score ≥ 8
**And** the audit file shows green for all 15
**And** the inventory file marks every tool as either promoted or formally deferred with a `[DEFERRED: <reason>]` annotation
**And** no tool page 404s from the home grid
**And** a final regression sweep visits every tool and asserts no console errors

### Story 2.9: Existing-Tool Pack Tag Wiring

As a future user navigating pack pages (Epic 6),
I want every existing tool to carry the correct `pack` tag (Travel, Finance, Study, Developer, or Household),
So that the pack composition is meaningful and no tool is orphaned.

**Acceptance Criteria:**

**Given** the 33 tools are promoted
**When** the maintainer runs `make pack-tags`
**Then** every tool entry has exactly one `pack` value matching the curated taxonomy
**And** each pack has ≥ 3 tools assigned
**And** the taxonomy is documented in `docs/pack-taxonomy.md` with one-line inclusion criteria per pack
**And** CI rejects any new tool with no `pack` field or with a pack not in the taxonomy
**And** the pack cards (Epic 6) can already be generated from this data even before Epic 6 ships

### Story 2.10: Shared Layout/Theme/Utils Migration to Modern JS

As a developer adding a new tool in Epic 6,
I want the existing `assets/js/{utils,layout,theme}.js` files migrated from ES5 to modern JS (preserving the public surface),
So that new tools can use ES2018+ features and the codebase is consistent.

**Acceptance Criteria:**

**Given** the three shared files exist today in ES5 form (var, function expressions, string concatenation)
**When** the migration runs
**Then** `utils.js` exposes the same helpers via `const`/`let`, arrow functions where appropriate, and template literals
**And** `layout.js` and `theme.js` are migrated without changing their public API
**And** a smoke test runs the existing wave-1 tools and asserts no regressions
**And** a grep CI check fails any new `var` declaration or `.concat(`, confirming the migration is complete

### Story 2.11: Brownfield Tool-Inventory View in /quality

As a user wanting to see how each tool scores today,
I want the `/quality` page to render the inventory and audit status in one table,
So that progress is public.

**Acceptance Criteria:**

**Given** `docs/quality-audit.md` is generated
**When** the user visits `/quality`
**Then** a table lists every tool with its score, audit date, and pass/fail per criterion (collapsible)
**And** a failing criterion surfaces a one-line remediation note
**And** each row's last-updated timestamp increments on every release that touches the tool's `tools.json` entry
**And** the page is reachable from the footer of every tool

### Story 2.12: Cross-Cutting Regression Sweep

As a maintainer shipping the full promoted suite,
I want a single Playwright smoke test that visits every tool page and asserts no console errors, no failed network requests, and the 8/10 rubric,
So that regressions are caught before they ship.

**Acceptance Criteria:**

**Given** all 33 tools are promoted
**When** the maintainer runs `make regression-sweep`
**Then** Playwright visits `/tools/<slug>` for every tool and asserts:
- Zero console errors
- Zero failed network requests (beyond the documented third-party none)
- Theme toggle works
- Settings modal opens
- History records at least one entry after a sample run
- URL state roundtrips through a fresh tab
**And** the sweep output is uploaded as a CI artifact
**And** any failure blocks the PR

---

## Epic 3: Keyboard-First UX — Command Palette, Settings, History, Share

**Epic goal:** The keyboard-first UX becomes the headline differentiator. The command palette handles top-5 fuzzy matches, action navigation, and the per-tool shortcuts overlay. The settings modal becomes a full control surface. The history panel and export/import work across all tools. The Share dialog, print stylesheet, and shortcuts modal close the keyboard loop.

**FRs covered:** FR-5 (warm path), FR-7 (full surface), FR-8, FR-12, FR-13, FR-16
**Architecture ADs:** AD-4, AD-14 (Shell Public API surfaces here)
**UX-DRs:** UX-DR-6 (full), UX-DR-14 (offline banner), UX-DR-19 (palette on every page)

### Story 3.1: Full Command Palette with Top-5 Fuzzy Matches and Footer Hints

As a user wanting to find any tool or action with one chord,
I want the command palette to show top-5 fuzzy matches, action results, and a footer with keyboard hints,
So that I never need the mouse to navigate.

**Acceptance Criteria:**

**Given** the palette is open (from Epic 1 skeleton) and the user types a query
**When** the search engine returns results
**Then** the list shows the top 5 matches with title, slug, category, and the matched field highlighted in bold
**And** the user can `ArrowDown` / `ArrowUp` to navigate the list
**And** pressing `Enter` navigates to the selected tool or triggers the selected action
**And** a footer shows the chord hints (`↑↓ Navigate · Enter Open · Esc Close · ? Help`)
**And** the palette meets the WAI-ARIA 1.1 combobox-with-listbox pattern (aria-activedescendant, aria-selected, role=listbox)

### Story 3.2: Command Palette Global Actions

As a user wanting to control the suite from the keyboard,
I want palette actions for "Toggle Theme", "Open Settings", "Open Privacy", "Open Quality", "Clear All Data", and "View Source for Current Tool",
So that every Shell-level action is reachable from one keystroke.

**Acceptance Criteria:**

**Given** the palette is open
**When** the user types `theme`, `settings`, `privacy`, `quality`, `clear`, or `source`
**Then** the corresponding action appears as a result with an action-icon (not a tool-icon)
**And** pressing `Enter` triggers the action and closes the palette
**And** the action list is statically declared in a Shell-owned file (`assets/js/palette-actions.js`) so Tools cannot add global actions

### Story 3.3: Per-Tool Keyboard Shortcuts Overlay

As a user wanting to learn a tool's shortcuts in context,
I want pressing `?` to open an overlay listing every shortcut for the current tool,
So that I can be productive without leaving the page.

**Acceptance Criteria:**

**Given** the user is on any tool page
**When** they press `?`
**Then** an overlay opens showing all shortcuts for that tool (declared in the tool's `tools.json` `shortcuts` field)
**And** the overlay also shows the global shortcuts (`⌘K` Palette, `g h` Home, `g p` Packs, `g q` Quality, `g v` Privacy)
**And** the overlay is dismissible via `Escape`, `?`, or clicking outside
**And** the overlay is reachable from any tool without first opening the palette (Epic 1's skeleton promised this)

### Story 3.4: Global Keyboard Chords for Cross-Page Navigation

As a user wanting to jump between pages with chords,
I want `g h` (home), `g p` (packs), `g q` (quality), `g v` (privacy), and `g s` (settings),
So that the keyboard-first UX is complete.

**Acceptance Criteria:**

**Given** the user is on any page and not in an input field
**When** they press `g` then a second key within 1 second
**Then** the corresponding route is loaded
**And** if the second key arrives > 1 second after `g`, the chord is canceled
**And** chords are suppressed inside text inputs (typing `g` in an input does not start a chord)
**And** the chords are listed in the per-tool shortcuts overlay

### Story 3.5: Settings Modal Full Control Surface

As a user wanting full control of the suite,
I want the Settings modal to expose every persisted preference with explicit defaults,
So that my choices persist across sessions and devices.

**Acceptance Criteria:**

**Given** the user opens Settings
**When** the modal renders
**Then** all FR-8 fields are present and validated using the exact defaults below:
- `theme`: `<select>` with options `auto | light | dark`; default `auto` (resolves to `light` or `dark` via `prefers-color-scheme`)
- `language`: `<select>` populated from `navigator.languages` (clipped to first 2 chars, lowercased, deduplicated) plus `en` as fallback; default `navigator.language.slice(0,2).toLowerCase()` or `en` if empty
- `defaultUnits`: `<select>` with options `metric | imperial`; default `metric`
- `defaultCurrency`: `<select>` with ISO-4217 codes (`USD`, `EUR`, `GBP`, `JPY`, `CAD`, `AUD`, `INR`, `CNY`); default `USD`
- `fontScale`: `<input type="range" min="0.85" max="1.4" step="0.05">`; default `1`
- `reducedMotion`: `<input type="checkbox">`; default `false` (overridden to `true` if `prefers-reduced-motion: reduce` matches)
- `clearData`: `<button>` (NOT a toggle) that opens the confirm dialog (Story 3.12)
**And** each field is keyboard-operable: Tab order follows the order listed above; `Space` toggles checkboxes and select-buttons; `Enter` triggers the clear-data button when focused
**And** changes persist via the storage registry immediately on `change`/`input` event (no Save button, no debounce, no batched write)
**And** the modal width matches the DESIGN token `var(--modal-width, 560px)` and is responsive below 600px viewport (full-width minus 16px gutter)
**And** closing the modal (Escape, close button, or backdrop click) returns focus to the cog that opened it via the saved `document.activeElement` reference captured at open

### Story 3.6: History Panel with Timestamps and Restore Confirmation

As a user wanting to recover a previous calculation,
I want the History panel to show timestamped entries with the key inputs and result preview,
So that I can pick the right one to restore.

**Acceptance Criteria:**

**Given** the user has run a tool multiple times
**When** they open the History panel (button in tool actions)
**Then** entries are listed newest-first with: relative timestamp rendered via `new Intl.RelativeTimeFormat(navigator.language, { numeric: 'auto' }).format(diffSeconds, 'second')` (e.g., `2 minutes ago`, `yesterday`, `3 days ago`), key inputs as truncated text (first 3 input values, each clamped to 40 chars + ellipsis), and result preview (first 80 chars of the result string)
**And** the "unsaved" state is detected by comparing each input element's current value to the value stored in the history entry's `inputs` map; the confirm dialog reads `You have unsaved changes. Restore and discard them?` with buttons `Cancel` (default focus) and `Discard and restore` (focus on Enter)
**And** clicking an entry with no unsaved state skips the confirm dialog and restores immediately
**And** the panel is dismissible via `Escape` (focus returns to the History button), the close button, or backdrop click
**And** history is stored in `localStorage` under the key `handy-tools.history.<slug>` per AD-6, where each entry is an object `{ ts: <ISO 8601 string>, inputs: { <name>: <string|number> }, result: <string> }`; never leaves the device
**And** history is empty for newly-promoted tools until the user runs them (no seeded fixtures, no migration from prior versions)
**And** the panel cap is 50 entries per tool; older entries are evicted FIFO

### Story 3.7: User Data Export to JSON

As a user wanting to back up or move my data,
I want an "Export my data" action that downloads a single JSON file with history, settings, favorites, and recent,
So that I can re-import it on another device.

**Acceptance Criteria:**

**Given** the user opens Settings and clicks Export
**When** the action runs
**Then** a file named `handy-tools-export-YYYY-MM-DD.json` downloads (where `YYYY-MM-DD` is the export date in the user's local timezone) with the exact JSON payload shape:
```
{
  "version": "1.0.0",
  "exportedAt": "<ISO 8601 timestamp>",
  "settings": { <full storage registry snapshot under handy-tools.settings> },
  "history": { "<slug>": [ <entry>, ... ] },
  "favorites": [ "<slug>", ... ],
  "recent": [ "<slug>", ... ],
  "pins": { "<slug>": <ISO 8601 timestamp> }
}
```
**And** the payload is validated against `assets/data/export.schema.json` (ajv draft-07) before download; if validation fails, the action aborts and shows a non-blocking toast `Export validation failed: <ajv error path>` and writes the failure to `console.error`
**And** the action works offline (no `fetch` calls, no network); the download is triggered via `URL.createObjectURL(new Blob([json], { type: 'application/json' }))` and a temporary `<a download>` click
**And** the schema version field is `1.0.0` for Story 3.7; Story 3.8 imports check this against the running app's `HT_EXPORT_SCHEMA_VERSION` constant and reject mismatches with the exact error `Export schema version <x> is not compatible with this app (expected <y>)`
**And** the download clears the object URL via `URL.revokeObjectURL` after 1 second

### Story 3.8: User Data Import from JSON with Schema Validation

As a user restoring my data,
I want an "Import" action that reads a previously exported JSON file and applies it,
So that my history and settings carry across devices.

**Acceptance Criteria:**

**Given** the user selects a JSON file in Settings → Import
**When** the import runs
**Then** the file is parsed via `JSON.parse` and validated against `assets/data/export.schema.json` (ajv draft-07) — checks include: `version` is a semantic version matching `HT_EXPORT_SCHEMA_VERSION`, `settings` is an object, `history` is an object with array values, `favorites`/`recent` are string arrays, `pins` is `{ slug: ISO-timestamp }`
**And** if valid, every key is applied to `localStorage` via the storage registry in this exact order: (1) `settings`, (2) `pins`, (3) `favorites`, (4) `recent`, (5) `history.<slug>` for each slug; then a success toast `Imported <historyCount> history entries, <pinCount> pins` appears
**And** if invalid, the error message names the offending field as `Import failed: <ajv instancePath> <ajv message>` and the import is aborted before any write (no partial application); the error is also logged to `console.error` with the full ajv error array
**And** conflicting settings (any current value differs from the imported value) trigger a confirm dialog listing the keys that will change; the dialog reads `Importing will overwrite <N> setting(s). Continue?` with buttons `Cancel` and `Overwrite` (Overwrite is the default focus)
**And** history entries are merged per-slug: existing entries are preserved, imported entries are added; if any slug has both an entry timestamp and existing entries with the same timestamp, the imported entry wins
**And** the action works offline (no `fetch` calls; the file is read via `FileReader.readAsText` from the `<input type="file" accept="application/json">` element)

### Story 3.9: Share Dialog with Copy URL, Print, and Embed Code

As a user wanting to share or print a tool's result,
I want the Share dialog to offer Copy URL, Print, and Embed Code,
So that I can pass the tool to a colleague in any medium.

**Acceptance Criteria:**

**Given** the user clicks the Share button on any tool
**When** the dialog opens
**Then** it shows: the canonical URL with current state encoded as a query string (e.g., `?input1=...&input2=...`), a Copy URL button, a Print button, and an Embed Code snippet in the form `<iframe src="<canonicalUrl>" width="<embed.width>" height="<embed.height>" loading="lazy" title="<tool.title>"></iframe>` where `embed.width` and `embed.height` default to `640` and `480` if the tool's `tools.json` entry omits them
**And** Copy URL uses `navigator.clipboard.writeText(url)`; if the Clipboard API is unavailable (e.g., insecure context, `file://`), it falls back to creating a temporary `<textarea>`, selecting it, and calling `document.execCommand('copy')`, then showing the toast `Copied` for 2 seconds
**And** Print opens the browser print dialog via `window.print()`; the print stylesheet `assets/css/print.css` (Story 3.10) hides chrome, nav, and footer
**And** the dialog is dismissible via `Escape` (focus returns to the Share button), the close button, or backdrop click
**And** the embed snippet is rendered inside a `<code>` element with a `Copy` button that copies the snippet HTML to the clipboard and shows the toast `Copied`
**And** the URL is encoded so that on re-load the tool's input elements are pre-populated (per the `shareState` registry contract)

### Story 3.10: Print Stylesheet for Clean Output

As a user wanting a clean printout,
I want a print stylesheet that hides chrome and shows only the tool's input and result,
So that I can hand the page to someone without the navigation.

**Acceptance Criteria:**

**Given** the user prints any tool page (via Share → Print or `Ctrl-P`)
**When** the browser print preview renders
**Then** the print stylesheet `assets/css/print.css` hides every element matching the selector list: `<header>`, `<footer>`, `header.tool-header`, `nav.tool-nav`, `button.tool-theme-toggle`, `button.tool-settings`, `button[aria-label="History"]`, `button[aria-label="Share"]`, and any element with `class="no-print"` or `data-print="hidden"`
**And** only the tool's input section (selector `[data-print="input"]`), the result section (selector `[data-print="result"]`), and a print footer (`<footer class="print-only">` containing the canonical URL and the `last-updated` timestamp from `tools.json`) are visible
**And** colors are forced to a print-friendly palette: `background: #fff !important; color: #000 !important;` on `body`; all gradients removed via `background-image: none !important;`; cobalt accent replaced with `#000` borders
**And** result blocks use `page-break-inside: avoid`; the input section uses `page-break-after: auto`; the print footer uses `page-break-before: always` so it always lands on its own page
**And** the stylesheet is loaded via `<link rel="stylesheet" href="../../assets/css/print.css" media="print">` in the tool head (auto-injected by `shell-template.py`)

### Story 3.11: View-Source Route with Syntax Highlighting and Download

As a user wanting to inspect a tool's code,
I want `/view-source?tool=<slug>` to render the HTML, CSS, and JS as syntax-highlighted source with a Download button,
So that I can verify the claim of zero obfuscation in one click.

**Acceptance Criteria:**

**Given** a user visits `/view-source?tool=qr-code-generator`
**When** the route renders
**Then** it shows three `<pre><code>` blocks (HTML, CSS, JS) with vendored syntax highlighting using `assets/js/vendor/highlight.min.js` (or a hand-rolled tokenizer regex — see Story 3.11 ADR-1 in Dev Notes); the files are fetched from `tools/<slug>/index.html`, `tools/<slug>/styles.css`, and `tools/<slug>/script.js`
**And** a Download button offers a ZIP archive in the format `qr-code-generator-source.zip` containing all three files at the root of the archive; the ZIP is built entirely in-browser using the vendored `assets/js/vendor/zip-store.js` (PKZIP STORE-only, no compression — acceptable for source files where speed and simplicity matter)
**And** tarball is NOT supported (rejected at Dev Notes time — it offers no advantage over ZIP and pulls in additional readers)
**And** the route handles 404 (unknown tool slug, file not found, or `index.html` missing) by showing the error `Tool "<slug>" not found` with a link back to `/`; the page also returns HTTP 404 via `document.title = '404 Not Found'`
**And** the footer link on every tool page points to `/view-source?tool=<slug>` and is rendered as `<a href="...">View source</a>` inside the tool footer
**And** the syntax highlighter is best-effort: if the vendored script fails to load, the `<code>` blocks render as plain preformatted text without breaking the page

### Story 3.12: Recent and Pinned Tracking

As a user wanting quick access to my most-used tools,
I want a Recent list (last 5 distinct tools visited) and a Pinned list (starred tools),
So that I don't have to search for the same tool twice.

**Acceptance Criteria:**

**Given** the user visits a tool page
**When** the page loads
**Then** the tool's slug is appended to `localStorage['handy-tools.recent']` (an array, capped at 5 distinct entries in FIFO order — UX-DR-11); duplicates are removed before the cap is enforced; the write happens once per page load via the storage registry
**And** the tool's card on the home grid shows a star button (`<button class="pin-toggle" aria-pressed="<bool>" aria-label="Pin <tool.title>">`) with the icon character `★` (filled, pinned) or `☆` (empty, not pinned)
**And** pins are stored in `localStorage['handy-tools.pins']` as a `{ slug: <ISO 8601 timestamp> }` map (UX-DR-12); clicking the star toggles the entry: removing the key if present, otherwise writing the current timestamp
**And** the home grid shows a Pinned row at the top of the grid rendered as `<ol class="pinned-row" aria-label="Pinned tools">` containing exactly the pinned slug chips in pin order (most-recent pin first), capped at 9 entries (UX-DR-12)
**And** clearing data (Settings → Clear Data, Story 3.5) wipes both `handy-tools.recent` and `handy-tools.pins` keys via the storage registry
**And** both lists are included in the exportable JSON (Story 3.7) under the top-level keys `recent` and `pins` (FR-13 / UX-DR-12)
**And** the Recent list is also surfaced in the home page sidebar as `<ol class="recent-list" aria-label="Recently used tools">` showing up to 5 slugs newest-first with the tool's title resolved from `tools.json`

---

## Epic 4: Embed Everywhere — Any Tool Usable on Any Third-Party Site

**Epic goal:** Any third-party site owner can paste a single `<iframe>` snippet to embed a Handy Tools tool. The embed loads without chrome, accepts URL-encoded input, communicates with the host via `postMessage`, and remains keyboard-complete and offline-capable.

**FRs covered:** FR-10, FR-11
**Architecture ADs:** AD-7 (full protocol contract)
**UX-DRs:** UX-DR-10 (embed URL semantics), UX-DR-3 (Embed modal = overlay, not blocking modal)

### Story 4.1: Embed URL Router Strips Chrome and Loads Tool

As a third-party site owner embedding a tool,
I want `/?embed=<slug>` to load the tool without header, footer, settings, palette, history, or theme toggle,
So that the embed is a clean tool surface.

**Acceptance Criteria:**

**Given** the host page loads `<iframe src="https://handy.tools/?embed=qr-code-generator">`
**When** the embed URL is requested
**Then** the Shell router parses `URLSearchParams(location.search).get('embed')`; a non-null value triggers embed mode, and the document `<html>` element receives `data-embed="<slug>"` (set before first paint via a synchronous inline script in `<head>`)
**And** the chrome-hiding CSS rule `[data-embed] header, [data-embed] footer, [data-embed] nav, [data-embed] .settings-cog, [data-embed] .palette, [data-embed] .history-panel, [data-embed] .theme-toggle { display: none !important; }` is applied via the `assets/css/embed.css` stylesheet loaded only when `[data-embed]` is present (conditional `<link>` injected by the router)
**And** the tool's URL state is read from the iframe's own URL (not propagated to host) by treating `location.hash` and `location.search` as the only state sources for the embed instance
**And** an instance-scoped UUIDv4 is generated via `crypto.randomUUID()` before any `postMessage` is sent, and is attached to the protocol (Story 4.3)
**And** the tool's history writes are suppressed: `if (document.documentElement.dataset.embed) return;` short-circuit at the top of the history-write code path; reads are still allowed (the embed can display history but not write to it)
**And** the embed layout responds to container width >= 240px and reflows on resize via a single `ResizeObserver` instance registered on `document.body`, debounced to 100ms
**And** the embed sets `window.name = 'ht-embed-<uuid>'` so the host can target it via `iframe.contentWindow.name`

### Story 4.2: Embed Snippet Modal on Every Tool

As a tool user wanting to share a tool on my own site,
I want a snippet modal that shows the copy-pasteable `<iframe>` code,
So that I can embed in seconds.

**Acceptance Criteria:**

**Given** the user clicks "Embed" on any tool page (or opens the embed action in the Share dialog — Story 3.9)
**When** the snippet modal renders
**Then** it shows the iframe HTML in a `<code>` element with the exact form:
```
<iframe src="<canonicalUrl>?embed=<slug>" width="<embed.width>" height="<embed.height>" loading="lazy" title="<tool.title>" aria-label="<tool.title> — Handy Tools" style="border:0"></iframe>
```
where `<embed.width>` defaults to `640` and `<embed.height>` defaults to `480` if the tool's `tools.json` entry omits them
**And** a Copy button copies the snippet HTML to the clipboard via `navigator.clipboard.writeText(snippet)` and shows the toast `Copied` for 2 seconds
**And** a live preview iframe renders the tool in a sandboxed container below the snippet with `sandbox="allow-scripts allow-same-origin"` (NO `allow-top-navigation`, NO `allow-popups`)
**And** the snippet text is rendered using `<code>` with `class="embed-snippet"` and is selectable; the Copy button is rendered as `<button data-action="copy-snippet">Copy</button>`
**And** the modal is dismissible via `Escape` (focus returns to the Embed button), the close button, or backdrop click

### Story 4.3: postMessage Protocol Envelope v1

As a host page integrating with the embed,
I want a documented `postMessage` envelope so the host can drive the tool,
So that I can read state, set inputs, and subscribe to result updates.

**Acceptance Criteria:**

**Given** the embed is loaded
**When** the host calls `iframe.contentWindow.postMessage({ v: 1, id: 'req-1', type: 'getState' }, origin)`
**Then** the embed responds `{ v: 1, id: 'req-1', type: 'state', payload: { ... } }` with the current tool state, posted via `iframe.contentWindow.postMessage(response, '*')` (origin echo is omitted; the embed always responds to `*` since it cannot know the host's exact origin without prior configuration)
**And** the embed supports the exact allowlist of `type` values: `getState`, `setInput`, `subscribe`, `unsubscribe`, `ping`; these are the only valid values; `state` and `result` and `pong` are RESPONSE types (embed -> host only) and are rejected if sent host -> embed
**And** unknown types are no-ops and logged via `console.warn('[embed] unknown message type:', type)` in development mode only (detected via `location.hostname === 'localhost' || location.hostname === '127.0.0.1'`)
**And** the embed validates the inbound message origin against an allowlist stored at `window.__HT_EMBED_ORIGINS__` (settable by the host via a config object passed in the URL: `?embed=<slug>&origins=https://example.com,https://other.com`); default for v1 is `['*']` (no origin check)
**And** payload size is capped at 64 KiB (`JSON.stringify(data).length > 65536`); over-cap messages are rejected with a `console.warn` and a `postMessage` reply `{ type: 'error', id, payload: { code: 'PAYLOAD_TOO_LARGE' } }`
**And** every envelope MUST contain `v: 1` AND `id` (a non-empty string); envelopes missing either field are rejected with `console.warn('[embed] invalid envelope:', envelope)` and no response is sent. Envelopes with `v !== 1` are rejected with `console.warn('[embed] unsupported protocol version:', v)`. Response envelopes ALWAYS include the same `id` as the originating request, preserving the host's correlation map

### Story 4.4: postMessage `setInput` and Result Subscription

As a host page that wants to prefill inputs and react to results,
I want `setInput` to mutate the tool's state and `subscribe` to receive result updates,
So that the embed can be driven programmatically.

**Acceptance Criteria:**

**Given** the embed is loaded and the host has subscribed via `{ v: 1, id: 'sub-1', type: 'subscribe' }`
**When** the host posts `{ v: 1, id: 'set-1', type: 'setInput', payload: { text: 'Hello' } }`
**Then** the tool's input element with `name="text"` (or the first input if no name match) is set to the value `'Hello'` via `el.value = 'Hello'; el.dispatchEvent(new Event('input', { bubbles: true }))`, triggering the tool's normal compute pipeline; the result recomputes synchronously
**And** the host receives `{ v: 1, id: 'sub-1', type: 'result', payload: { result: '<renderedResult>', inputs: { text: 'Hello' } } }` after each recompute, where `<renderedResult>` is the value of the tool's result element (selector `[data-tool-result]`, fallback `data-print="result"`, fallback `.result`)
**And** `unsubscribe` with the matching id removes the subscription from the `Set<id>`; the host receives no further `result` messages for that id; the response to `unsubscribe` is `{ v: 1, id, type: 'unsubscribed', payload: {} }`
**And** the host can `ping` and receive `{ v: 1, id, type: 'pong', payload: { time: <Date.now()> } }` for liveness checks; `ping` does NOT require a subscription
**And** all responses carry the same `id` from the originating request so the host can correlate via a `Map<id, {resolve, reject}>`; multiple in-flight requests with different ids are processed independently
**And** `getState` returns `{ v: 1, id, type: 'state', payload: { inputs: {...}, result: '...', slug: '<slug>' } }`

### Story 4.5: Instance-Scoped UUID and Origin Checks

As the suite maintainer,
I want every embed to receive a unique instance UUID on load so the host can correlate messages,
So that multiple embeds on one page don't confuse the host's message router.

**Acceptance Criteria:**

**Given** the embed URL is loaded
**When** the Shell bootstraps the embed
**Then** a UUIDv4 is generated via `crypto.randomUUID()` (with a fallback to a Math.random-based v4 generator for environments without `crypto.randomUUID` — gated on `typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function'`) and attached to `data-instance-uuid` on `<html>` before the first `postMessage` is sent
**And** every outgoing `postMessage` includes the UUID in the envelope as `{ v: 1, instance: '<uuid>', id, type, payload }` — the `instance` field is always present alongside `v` (both are required protocol fields)
**And** the host can verify the UUID matches the iframe it created by reading `document.querySelector('iframe').contentDocument.documentElement.dataset.instanceUuid` after the embed loads
**And** the embed logs a console warning in dev mode if it detects another embed with the same UUID (collision check): the check runs on `window.addEventListener('message', ...)` and compares incoming `instance` fields to its own UUID, warning once per duplicate
**And** the UUID is also surfaced in the URL hash so the host can grep it: `location.hash = '#instance=<uuid>'` is set on load

### Story 4.6: Embed Demo Page with Multiple Instances

As a third-party developer wanting to test the embed,
I want a public `/embed-demo` page that loads multiple embeds and shows `postMessage` round-trips live,
So that I can see the protocol in action.

**Acceptance Criteria:**

**Given** the developer visits `/embed-demo`
**When** the page renders
**Then** it loads exactly two embeds side-by-side: `<iframe src="/?embed=qr-code-generator">` and `<iframe src="/?embed=tip-calculator">`, each with `aria-label`, unique `title`, and `data-test-id` attributes (`data-test-id="embed-qr"`, `data-test-id="embed-tip"`)
**And** a `<section class="embed-log">` panel below the iframes shows the live `postMessage` log as a scrollable `<ol>` of the last 20 events, each rendered as `<li data-event-type="<type>">[<timestamp ISO 8601>] <instance> <type> id=<id> payload=<JSON.stringify(payload).slice(0, 200)></li>`
**And** buttons in the panel are rendered as `<button data-action="<action>" data-target="<slug>">` where action is one of `getState`, `setInput`, `subscribe`, `ping`, `unsubscribe`; each button click triggers the corresponding `postMessage` to the target iframe
**And** the page documents the protocol inline in a `<details><summary>Protocol reference</summary>` block listing: the envelope shape, the type allowlist (`getState`, `setInput`, `subscribe`, `unsubscribe`, `ping`), the response types (`state`, `result`, `pong`, `unsubscribed`, `error`), the error codes (`PAYLOAD_TOO_LARGE`, `UNKNOWN_TYPE`, `BAD_VERSION`), and the 64 KiB payload cap
**And** the demo page is a standalone static file at `/embed-demo/index.html` (no server-side rendering); it lives in the root of the suite and is excluded from the embed chrome-hide CSS

### Story 4.7: Embed Accessibility Fallback (Badge=0)

As a screen-reader user encountering an embed on a third-party site,
I want the embed iframe to have an `aria-label` so I know what tool I'm interacting with,
So that the embed is usable without sight.

**Acceptance Criteria:**

**Given** the embed is loaded
**When** the iframe is constructed
**Then** the iframe carries `aria-label="<tool title> — Handy Tools"` by default (where `<tool title>` is resolved from `tools.json` via the slug; if the slug is unknown, the fallback `aria-label="Handy Tools tool"` is used)
**And** the host can override via the `title` attribute on the iframe (e.g., `title="Generate QR code for this URL"`); when `title` is set and non-empty, the embed sets `aria-label = title` on the inner document's first focusable element via `document.body.setAttribute('aria-label', title)`
**And** if the host sets `title=""` (empty), the embed falls back to the default `aria-label` (badge=0 fallback per UX-DR-3); the fallback is computed once at load and stored in `document.documentElement.dataset.embedAriaLabel`
**And** the tool inside the embed is fully keyboard-operable: every interactive element has a visible focus ring (`outline: 2px solid var(--focus-ring, #0066cc)`), Tab order matches DOM order, and `Skip to tool content` is the first focusable element (`<a href="#tool-main" class="skip-link">Skip to tool content</a>`) with the target `#tool-main` on the tool's main container
**And** the embed exposes `prefers-reduced-motion` to the inner tool via `<html data-embed-reduced-motion="<bool>">`, computed from `(window.matchMedia('(prefers-reduced-motion: reduce)').matches)` and propagated to the inner document at load

---

## Epic 5: PWA + Offline — Install, Cache, and the Trust Surface

**Epic goal:** A user can install the suite to their home screen, use any previously-visited tool offline on a flight, and inspect `/privacy` and `/quality` to verify the claims. The PWA install button is Chromium-only; Safari gets a manual instruction sheet. The privacy page lists every localStorage key with a wire log of the current session.

**FRs covered:** FR-9 (forced-colors, UA-mode theming), FR-14, FR-15
**Architecture ADs:** AD-8 (CACHE_VERSION + SW + offline fallback), AD-11 (Trust Surface generated)
**UX-DRs:** UX-DR-14 (PWA install UX per browser), UX-DR-19 (forced-colors + reduced-motion)

### Story 5.1: Manifest with Icons and Standalone Display

As a user wanting to install the suite,
I want a valid `manifest.webmanifest` referenced from every page,
So that Chromium browsers offer the install prompt.

**Acceptance Criteria:**

**Given** the suite is deployed
**When** a Chromium browser visits any page
**Then** the manifest at `/manifest.webmanifest` is fetched, validates against the W3C Web App Manifest spec, and declares exactly:
- `"name": "Handy Tools"`
- `"short_name": "Handy"`
- `"start_url": "/"`
- `"display": "standalone"`
- `"theme_color": "#0a3d62"`
- `"background_color": "#ffffff"`
- `"icons": [ { "src": "/assets/icons/icon-192.png", "sizes": "192x192", "type": "image/png" }, { "src": "/assets/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }, { "src": "/assets/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" } ]`
**And** the icons exist as PNGs at `assets/icons/icon-192.png`, `assets/icons/icon-512.png`, and `assets/icons/icon-maskable-512.png`
**And** every page (home, tool pages, embed-demo, offline) contains `<link rel="manifest" href="/manifest.webmanifest">` injected by `shell-template.py`

### Story 5.2: Service Worker Registration and CACHE_VERSION

As a maintainer shipping the suite,
I want a service worker that caches the Shell and last-used tool assets with a `CACHE_VERSION` mirrored in `tools.json.releaseVersion`,
So that the cache and the data cannot drift apart.

**Acceptance Criteria:**

**Given** the suite is deployed with `tools.json.releaseVersion: "1.0.0"` and `sw.js` declares `const CACHE_VERSION = '1.0.0';`
**When** the service worker (`/sw.js`) registers via `navigator.serviceWorker.register('/sw.js', { scope: '/' })`
**Then** on `install`, the SW creates a cache named `ht-shell-1.0.0` and precaches the Shell assets in this exact list: `/`, `/index.html`, `/assets/css/shell.css`, `/assets/js/shell.js`, `/assets/js/help-overlay.js`, `/assets/js/global-chords.js`, `/assets/fonts/inter.woff2`, `/assets/icons/icon-192.png`, `/assets/icons/icon-512.png`, `/manifest.webmanifest`
**And** on `fetch`, the SW uses stale-while-revalidate for paths matching `/assets/`, `/`, `/index.html`, `/manifest.webmanifest`, `/offline.html`, `/privacy`, `/quality`, `/about`, `/changelog`, `/404`; and cache-first for paths matching `/tools/<slug>/`
**And** when `tools.json.releaseVersion` increments (e.g., to `1.1.0`), the SW's `install` event creates a new cache `ht-shell-1.1.0`, the `activate` event copies entries from the old cache that still match the new precache list, and calls `caches.delete('ht-shell-1.0.0')` only after the migration completes
**And** the Makefile target `ci: cache-version-sync` runs `scripts/check-cache-version.py` which asserts that `tools.json.releaseVersion === sw.js CACHE_VERSION`; CI fails the build if they diverge
**And** the SW is registered from `assets/js/sw-register.js` on every page load, gated on `'serviceWorker' in navigator` and `location.protocol !== 'file:'`

### Story 5.3: Per-Tool Asset Caching

As a user wanting offline access to tools I use regularly,
I want the service worker to cache the last-N tool assets I visited,
So that I can use them on a flight.

**Acceptance Criteria:**

**Given** the user has visited 5 tools in the current session (e.g., `qr-code-generator`, `tip-calculator`, `json-formatter`, `word-counter`, `unit-converter`)
**When** they go offline (`navigator.onLine === false`)
**Then** those 5 tools load from the cache: each tool page returns `index.html`, `styles.css`, `script.js` (when present) from the SW cache; the cache key prefix is `ht-tool-<slug>`
**And** the home grid renders a status badge on each tool card: cached tools show a green check (`<span class="cache-status cached">`) with `aria-label="Available offline"`; uncached tools show a gray minus (`<span class="cache-status not-cached">`) with `aria-label="Not available offline"`; the status is computed at render time by calling `caches.keys()` and checking for `ht-tool-<slug>`
**And** the SW exposes `caches.keys()` for debugging (called from DevTools console) and a `Clear cache` action in Settings that calls `caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))` and shows the toast `Cache cleared`
**And** the cache eviction policy is LRU with a configurable max (default `MAX_TOOL_CACHE_ENTRIES = 50` in `sw.js`); when a new tool is added and the cache is at the cap, the least-recently-accessed entry is removed via `caches.open('ht-tool-index').then(c => c.keys().then(keys => c.delete(keys[0])))`

### Story 5.4: PWA Install UX per Browser

As a user wanting to install the suite on my home screen,
I want a clear install path that matches my browser's capabilities,
So that I can install without frustration.

**Acceptance Criteria:**

**Given** the user is on a Chromium browser (detected via `navigator.userAgentData.brands.some(b => b.brand === 'Chromium')` OR `navigator.userAgent.includes('Chrome')` OR `navigator.userAgent.includes('Edge')`)
**When** they visit the suite and the `beforeinstallprompt` event fires
**Then** an "Install" button (`<button class="install-btn" hidden>`) appears in the header; the event is captured via `window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; installBtn.hidden = false; })`
**And** clicking the button calls `deferredPrompt.prompt()` and awaits `deferredPrompt.userChoice`; on `outcome === 'accepted'` the button is hidden permanently for this origin; on `outcome === 'dismissed'` the button stays visible for the session
**And** if dismissed, the dismissal timestamp is written to `localStorage['handy-tools.install.dismissedAt']` as an ISO 8601 string; the button is hidden until the timestamp is older than 7 days (`(Date.now() - new Date(ts).getTime()) > 7 * 24 * 60 * 60 * 1000`)

**Given** the user is on Safari iOS or macOS (detected via `navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')`)
**When** they visit the suite
**Then** an "Install" button opens an instruction sheet (`<dialog class="install-instructions" data-platform="safari">`) with platform-specific steps: iOS reads "1. Tap the Share button. 2. Scroll down and tap Add to Home Screen. 3. Confirm by tapping Add."; macOS reads "1. Click the Share button in the toolbar. 2. Select Add to Dock."

**Given** the user is on Firefox desktop
**When** they visit the suite
**Then** no install button is shown (Firefox hides install for PWAs without signed manifests); the footer link `<a href="/install">Install instructions</a>` is always present and points to the `/install` static page with manual steps for all platforms

### Story 5.5: Offline Fallback Page

As a user with no network and no cache for the requested path,
I want a clear offline page that explains what happened and shows cached tools,
So that I know what's available offline.

**Acceptance Criteria:**

**Given** the user navigates to an uncached path while offline
**When** the SW intercepts the request via the `fetch` event handler
**Then** the SW serves `/offline.html` (a static HTML page at the suite root) with: an `<h1>You're offline</h1>`, a `<p>This page isn't cached. Pick a tool you've used recently:</p>`, and a `<ul class="cached-tools" id="cached-tools">` that is populated at load time by calling `caches.keys().then(keys => keys.filter(k => k.startsWith('ht-tool-')).map(k => k.slice(8)))` and rendering each as `<li><a href="/tools/<slug>/">...</a></li>`
**And** the offline page uses Shell chrome (header/footer/theme toggle hidden, settings cog visible) and is keyboard-complete: the first focusable element is the first link in the cached-tools list, Tab cycles through links, `Escape` does nothing
**And** the SW returns the offline response with `status: 200` and `headers: { 'Content-Type': 'text/html' }` so the browser doesn't show its own error page
**And** the offline page is itself precached during the SW `install` event and listed in `PRECACHE_URLS`

### Story 5.6: Privacy Page with Generated Storage Key List

As a user wanting to verify what the suite stores,
I want `/privacy` to list every localStorage key with what it stores and when it is cleared,
So that I can audit the claims.

**Acceptance Criteria:**

**Given** the storage registry (`assets/js/storage-registry.js`) is initialized and exports `HT_STORAGE_KEYS` as an array of `{ key, prefixClass, purpose, clearedBy, retention }` entries
**When** the user visits `/privacy`
**Then** the page renders a `<table class="storage-keys">` with columns `Key`, `Class`, `Purpose`, `Cleared by`, `Retention`; each row is one entry from `HT_STORAGE_KEYS`; `prefixClass` is rendered as a `<code>` chip colored by class (`ht.*` runtime = gray, `handy-tools.*` user data = blue, `ht.session` ephemeral = yellow)
**And** the table is generated from `HT_STORAGE_KEYS` at page load via `Object.entries(HT_STORAGE_KEYS).map(...)`; there are no per-key strings hardcoded in `/privacy/index.html`
**And** new entries to `HT_STORAGE_KEYS` appear automatically on the next page load — no HTML edits required
**And** the page is reachable from any tool's footer via `<a href="/privacy">Privacy</a>` and from the home page footer
**And** the page also lists every `indexedDB` database name and every `CacheStorage` cache name (read-only display) with the same column structure adapted for those stores

### Story 5.7: Privacy Page Live Wire Log

As a user wanting to verify the "zero network requests" claim,
I want the `/privacy` page to show a wire log of the current session's network requests,
So that I can confirm zero by inspection.

**Acceptance Criteria:**

**Given** the user opens `/privacy`
**When** the page renders
**Then** a wire log table (`<table class="wire-log">`) shows the current session's network requests with columns: `Time` (HH:MM:SS.mmm from `entry.startTime`), `Method`, `URL`, `Initiator` (from `entry.initiatorType`), `Status` (from `entry.responseStatus`)
**And** the authoritative source is `performance.getEntriesByType('resource')` populated by a `PerformanceObserver` registered with `entryTypes: ['resource']`; the observer fires on every resource entry and appends a row in real time
**And** only same-origin resources (`new URL(entry.name).origin === location.origin`) display all fields; cross-origin resources without `Timing-Allow-Origin: *` show `Status: (cross-origin, hidden)` and `URL: <origin only>` per AD-11
**And** the table is empty by default (zero requests) when the page loads
**And** if any request occurs, a red banner (`<div class="wire-alert" role="alert">`) appears reading `1 request observed this session — investigate`; the count updates live as subsequent requests occur (`2 requests observed this session — investigate`, `3 requests observed this session — investigate`, ...) and the banner stays visible for the remainder of the session unless the user clicks the "Clear log" button
**And** the user can clear the log via a "Clear log" button (`<button data-action="clear-wire-log">`) which calls `performance.clearResourceTimings()` and empties the table
**And** as a secondary supplementary channel, `fetch`/`XMLHttpRequest`/`sendBeacon` interception (`window.fetch = ...`, `XMLHttpRequest.prototype.send = ...`, `navigator.sendBeacon = ...`) is used ONLY to capture POST bodies and request initiator data that `PerformanceObserver` cannot see; the secondary channel is never the source of truth and its entries are flagged with `[POST body captured]` in the row

### Story 5.8: Quality Page Public Scorecard

As a user wanting to verify the 8/10 quality bar,
I want `/quality` to show every tool's score per criterion with the rubric definitions,
So that I can audit the claim.

**Acceptance Criteria:**

**Given** the audit log `docs/quality-audit.md` is current (kept up to date by the CI audit target)
**When** the user visits `/quality`
**Then** a table (`<table class="quality-scorecard">`) lists every tool with columns: `Name` (from `tools.json[slug].title`), `Slug`, `Score` (rendered as `<span class="score score-<tier>">` where tier is `high` (>=8), `medium` (6-7), `low` (<=5)), `Pass/fail per criterion` (10 cells with check/cross icons), `Last updated` (date string from `tools.json[slug].lastUpdated`), `Remediation note` (from the audit's `notes` field for any failing criterion)
**And** the rubric (10 criteria with one-line definitions) is shown above the table inside `<details><summary>Rubric</summary>`; criteria are: `1. Valid HTML (no console errors)`, `2. Keyboard-complete`, `3. ARIA labels present`, `4. Mobile-friendly (no horizontal scroll)`, `5. Uses design tokens`, `6. Has input validation`, `7. Has result rendering`, `8. Persists to localStorage`, `9. Has share state`, `10. Listed in tools.json`
**And** the page is generated from `docs/quality-audit.md` (parsed at page load via a tiny markdown-to-table routine) and `tools.json`; no manual edits to HTML
**And** the page is reachable from any tool's footer via `<a href="/quality">Quality</a>` and from the home page footer
**And** failing scores (< 8) render with `class="score-low"` and a `data-tooltip` attribute containing the remediation note

### Story 5.9: Forced-Colors and Reduced-Motion Respect

As a user with OS-level accessibility preferences,
I want the suite to detect and respect `forced-colors` and `prefers-reduced-motion`,
So that I get the OS-native appearance and motion is reduced when I ask.

**Acceptance Criteria:**

**Given** the OS reports `forced-colors: active` (detected via `window.matchMedia('(forced-colors: active)').matches`)
**When** the user lands on any page
**Then** the `<html>` element receives `data-forced-colors="active"` set by an inline script in `<head>` before first paint; the theme toggle (`<button class="theme-toggle">`) is hidden via `[data-forced-colors="active"] .theme-toggle { display: none !important; }`
**And** all colors are forced to system colors via `@media (forced-colors: active) { :root { --color-bg: Canvas; --color-fg: CanvasText; --color-accent: LinkText; --color-border: CanvasText; } }` in `assets/css/shell.css`
**And** the cobalt palette tokens (`--cobalt-500`, `--cobalt-700`) are overridden to `CanvasText` and `LinkText` respectively under forced-colors so no custom colors leak through

**Given** the OS reports `prefers-reduced-motion: reduce` (or the user toggles `reducedMotion: true` in Settings — Story 3.5)
**When** the user navigates or interacts
**Then** the `<html>` element receives `data-reduced-motion="reduce"`; the global CSS rule `[data-reduced-motion="reduce"] *, [data-reduced-motion="reduce"] *::before, [data-reduced-motion="reduce"] *::after { transition: none !important; animation: none !important; }` disables all transitions and animations
**And** the command palette (`<dialog class="palette">`) and spinners (`<progress class="spinner">`) fall back to instant state changes: the palette opens/closes without fade, spinners render as static `Loading...` text

### Story 5.10: Trust Surface Pages — `/404`, `/about`, `/changelog`

As a user landing on a missing tool, or a curious visitor, or a returning user,
I want `/404`, `/about`, and `/changelog` to be real, working pages,
So that the suite's 23-surface contract (UX-DR-7) is honored and the trust signals are visible.

**Acceptance Criteria:**

**Given** the user visits an unknown path (e.g. `/tools/no-such-tool` or `/foo`)
**When** the route resolves
**Then** `/404` renders the plain message `That tool doesn't exist.` inside `<h1>`, a pre-focused search box (`<input type="search" id="search-tools" autofocus>`), the top 9 most-used tools (sorted by `tools.json[slug].popularity` desc, top 9 rendered as `<ol class="top-tools">`), and a "Did you mean…" link if a near-match (Levenshtein <= 3) exists in `tools.json` for the requested slug (UX-DR-13)
**And** `/404` is served with HTTP status 404 via a meta refresh + a `<meta http-equiv="status" content="404">` tag; a regression test asserts `document.querySelector('meta[http-equiv="status"]').content === '404'` (UX-DR-13 — never 200)
**And** `/404` never auto-redirects — it is a terminal page

**Given** the user visits `/about`
**When** the page renders
**Then** it shows: project purpose (`<section id="purpose">`), the four named-protagonist journeys (Priya/Marco/Aisha/Jamal) one-line each inside `<ul class="protagonists">`, the eight privacy guarantees verbatim inside `<ol class="privacy-guarantees">`, and a link to the source repo (`<a href="https://github.com/...">View source on GitHub</a>`)
**And** the page uses Shell chrome (header/footer/theme/settings) and is keyboard-complete

**Given** the user visits `/changelog`
**When** the page renders
**Then** it shows release notes grouped by version (most-recent first), each entry: version, date, the rubric-audit delta (which tools were re-scored), the per-tool score changes, and the new tools added in that release
**And** the data is generated from `tools.json.releaseVersion` + a per-release `CHANGELOG.md` parsed at page load via `fetch('/CHANGELOG.md').then(r => r.text()).then(parseChangelog)` (no build step required)
**And** entries link to the audit view in `/quality` for the matching tool via `<a href="/quality#tool-<slug>">`

**Given** all three pages are implemented
**When** a regression test runs
**Then** `/404`, `/about`, and `/changelog` are listed in `assets/data/surfaces.json` as `{ slug, path, title, keywords }` entries and are reachable by deep link, by command palette action (`>` then type), and from the home footer (UX-DR-7)

---

## Epic 6: Packs and New Tools — 5 Packs Live + 12–15 New Tools

**Epic goal:** The suite is discoverable through five themed pack pages (Travel, Finance, Study, Developer, Household). Each pack ships with ≥ 3 promoted tools and ≥ 2 new tools. The 12–15 new tools cover the gap tools identified in market research (JSON Formatter enhancements, Citation formatter, Diff viewer, UUID generator, JWT inspector, Timestamp converter, Flashcard timer, Exam countdown, Recipe scaler, Grocery list builder, Paint calculator, Area/volume calculator, Budget planner, Savings goal, Currency converter).

**FRs covered:** FR-6, FR-19, FR-20, FR-21
**Architecture ADs:** AD-9 (cross-Tool via Site Data only), AD-5 (pack defaults under Tool state)
**UX-DRs:** UX-DR-2 (Pack Card), UX-DR-9 (pack composition), UX-DR-7 (pack page surface)

### Story 6.1: Pack Card Component on Home Grid

As a user landing on `/`,
I want to see pack cards (Travel/Finance/Study/Developer/Household) above or alongside the tool grid,
So that I can navigate by use case.

**Acceptance Criteria:**

**Given** the home grid renders
**When** the page loads
**Then** exactly five pack cards render above the main grid (in the order Travel, Finance, Study, Developer, Household) as `<a class="pack-card" href="/packs/<slug>">` elements, each containing: `<span class="pack-icon" aria-hidden="true">` (one of `🧳`, `💰`, `📚`, `💻`, `🏠`), `<h2 class="pack-title">`, `<p class="pack-description">`, `<span class="pack-tool-count">N tools</span>`, and `<span class="pack-view-link">View pack &rarr;</span>`
**And** clicking a pack card (or pressing `Enter` while focused) navigates to `/packs/<pack-slug>` via SPA route
**And** packs with zero `ready: true` tools (computed from `tools.json` at render time) are NOT rendered at all (no empty card)
**And** each pack card uses the cobalt palette tokens (`background: var(--cobalt-50)`, `border: 1px solid var(--cobalt-200)`, `color: var(--cobalt-900)`) and meets the keyboard-complete contract (Tab focusable, visible focus ring, `Enter` activates)

### Story 6.2: Pack Page Renderer

As a user clicking a pack card,
I want a `/packs/<slug>` page that lists the pack's tools with a short pack description,
So that I see only the tools I care about.

**Acceptance Criteria:**

**Given** a user visits `/packs/travel`
**When** the page renders
**Then** the page shows: the pack `<h1>` title (e.g., `Travel`), the pack icon (`<span class="pack-icon">🧳</span>`), the pack description (from `assets/data/packs.json[packs.find(p => p.slug === 'travel').description]`), and a `<section class="pack-tool-grid">` of tool cards filtered by `tools.json.filter(t => t.pack === 'travel' && t.ready === true)`
**And** an empty pack (zero matching tools) shows `<p class="pack-empty">No tools in this pack yet — check back soon</p>` instead of the grid
**And** the pack page is presentation only — it does not register any pack-specific UI handlers; the tool cards use the same click handler as the home grid
**And** the pack page uses the same Shell chrome (header/footer/theme/settings) as other pages, with the active nav item set to `Packs`
**And** the pack page is reachable from `/?pack=<slug>` (home page anchor link) and from `/packs/<slug>` (direct URL)

### Story 6.3: Pack Taxonomy Documentation

As a future contributor adding a tool to a pack,
I want `docs/pack-taxonomy.md` to define each pack's inclusion criteria,
So that the taxonomy is explicit and not vibes-based.

**Acceptance Criteria:**

**Given** the maintainer wants to add a tool to a pack
**When** they consult `docs/pack-taxonomy.md`
**Then** the file lists each of the five packs (`travel`, `finance`, `study`, `developer`, `household`) with: one-line purpose (e.g., `travel: "Tools a traveler uses on the road"`), 3-5 bullet inclusion criteria (e.g., `travel: ["Uses currency conversion", "Works offline-first", "..."]`), 2 in-pack examples (e.g., `currency-converter`, `tip-calculator`), and 2 out-of-pack examples with reason (e.g., `password-generator — security tools are not travel-specific`)
**And** the criteria are enforced at PR review via `scripts/check-pack-taxonomy.py` (invoked by `make ci`); the script reads `tools.json`, finds any tool whose `pack` field is missing or not in the allowlist, and posts a CI comment suggesting a pack based on the tool's `category` and `keywords` fields using a hand-rolled keyword-to-pack map
**And** the taxonomy is referenced from the contributing guide; `CONTRIBUTING.md` includes a section `## Pack taxonomy` that links to `docs/pack-taxonomy.md` and quotes the inclusion criteria verbatim

### Story 6.4: JSON Formatter Enhancements (sort keys, schema validate, diff)

As a developer wanting more from the JSON formatter,
I want options to sort keys, validate against a JSON Schema, and diff two JSONs,
So that the tool is competitive with CyberChef's JSON operations.

**Acceptance Criteria:**

**Given** the user opens the JSON formatter (existing tool `tools/json-formatter/index.html`, promoted in Epic 2)
**When** they enable the "Sort keys" checkbox (`<input type="checkbox" data-action="sort-keys">`)
**Then** the output JSON has keys sorted at every level recursively (including nested objects and arrays of objects); the implementation uses `function sortKeys(value) { if (Array.isArray(value)) return value.map(sortKeys); if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, sortKeys(value[k])])); return value; }`
**And** when the user pastes a JSON Schema into the schema textarea and toggles "Validate" (`<input type="checkbox" data-action="validate-schema">`), the tool runs `ajv` (vendored at `assets/js/vendor/ajv-bundle.js`) against the input and shows a result list `<ul class="schema-errors">` with each ajv error rendered as `<li data-path="<instancePath>"><code><path></code>: <message></li>`; empty list + green check icon = pass
**And** when the user pastes two JSONs (input A + input B into the two textareas) and clicks "Diff" (`<button data-action="diff">`), the tool renders a unified diff with line-level highlights using a hand-rolled Myers/LCS algorithm in `assets/js/diff.js`; each diff line is rendered as `<div class="diff-line diff-<op>">` where `op` is `equal | insert | delete`
**And** each enhancement is gated behind a `?feature=sort|schema|diff` URL state key (comma-separated, e.g., `?feature=sort,schema` enables both; default state hides all three enhancements)

### Story 6.5: Citation Formatter (APA, MLA, Chicago)

As a student writing a paper,
I want to paste a book URL or ISBN and get a citation in APA, MLA, or Chicago format,
So that I don't have to remember the punctuation rules.

**Acceptance Criteria:**

**Given** the user opens the Citation formatter (`tools/citation-formatter/index.html`)
**When** they paste a URL/ISBN/DOI into the source field, or fill in manual fields (`<input name="author">`, `<input name="title">`, `<input name="year">`, `<input name="publisher">`)
**Then** the tool detects the input type via regex (`/^https?:/` for URL, `/(?:ISBN[\s:-]?)?(\d{9}[\dXx]|\d{13})/` for ISBN, `/^10\.\d{4,9}\/[-._;()\/:A-Z0-9]+$/i` for DOI) and fetches metadata from the matching endpoint: Open Library API `https://openlibrary.org/api/books?bibkeys=ISBN:<isbn>&format=json&jscmd=data` for ISBN, CrossRef API `https://api.crossref.org/works/<doi>` for DOI, or a manual `<form>` fallback
**And** the format toggle (`<select name="style">`) supports exactly three values: `apa-7`, `mla-9`, `chicago-17`; the rendered citation follows the corresponding style guide (e.g., APA 7: `Author, A. A. (Year). Title of work. Publisher.`)
**And** the citation is copy-able via a Copy button and shareable via URL state (`?style=apa-7&author=...&title=...&year=...&publisher=...`)
**And** the metadata fetch uses a single network request to a public CORS-enabled API (Open Library or CrossRef) — the privacy claim still holds because the request is initiated by the user; the URL is logged in the Privacy wire log (Story 5.7)
**And** if the fetch fails, the tool falls back to manual-field entry and shows the notice `Metadata fetch failed — please fill in fields manually`

### Story 6.6: Diff Viewer (text, line/word/char)

As a developer wanting to see what changed,
I want a diff viewer with line/word/char granularity,
So that I can review edits at the right level.

**Acceptance Criteria:**

**Given** the user opens the Diff viewer (`tools/diff-viewer/index.html`)
**When** they paste two texts into the `<textarea name="a">` and `<textarea name="b">` fields
**Then** the tool renders a side-by-side diff with line numbers in two `<table class="diff-side-by-side">` blocks (left = input A, right = input B); the toggle `<select name="view">` switches to unified mode (one column) when set to `unified`
**And** the granularity toggle (`<select name="granularity">` with options `line | word | char`) re-renders the diff; line granularity runs Myers' algorithm on `
`-split arrays, word on `/\s+/`-split arrays, char on character arrays
**And** the diff algorithm is hand-rolled (Myers' O(ND) algorithm) in `assets/js/diff.js` — no third-party library; the algorithm exports `function myersDiff(a, b, eq)` which returns an array of `{ op: 'equal' | 'insert' | 'delete', value }`
**And** the URL state encodes both texts and the granularity (`?a=<base64>&b=<base64>&granularity=line&view=side-by-side`); the texts are base64-encoded to avoid URL-encoding issues with newlines
**And** line numbers are rendered in a sticky `<th class="diff-line-num">` column

### Story 6.7: UUID Generator (v1, v4, v7, ULID)

As a developer generating identifiers,
I want a UUID generator supporting v1, v4, v7, and ULID,
So that I can pick the format my system requires.

**Acceptance Criteria:**

**Given** the user opens the UUID generator (`tools/uuid-generator/index.html`)
**When** they pick a version (`<select name="version">` with options `v1`, `v4`, `v7`, `ulid`) and click Generate (`<button data-action="generate">`)
**Then** the tool generates a valid identifier matching the spec for that version:
- v1: timestamp (100-ns since 1582-10-15) + clock sequence + node MAC (or random 48-bit fallback); format `xxxxxxxx-xxxx-1xxx-yxxx-xxxxxxxxxxxx`
- v4: 122 random bits with version/variant nibbles; uses `crypto.randomUUID()` if available, else `crypto.getRandomValues(new Uint8Array(16))`; format `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`
- v7: Unix-ms timestamp (48 bits) + 74 random bits + version/variant; format `xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx`
- ULID: 48-bit timestamp + 80-bit randomness, Crockford-base32 (`0-9A-HJKMNP-TV-Z`); 26 chars
**And** the tool supports bulk generation (`<input type="number" name="count" min="1" max="100" value="1">`); up to 100 identifiers per click
**And** the URL state encodes the version and bulk count (`?version=v4&count=5`)
**And** every identifier is verified against its spec regex before display: v1/v4/v7 use `/^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`, ULID uses `/^[0-9A-HJKMNP-TV-Z]{26}$/`; failed identifiers are flagged red and excluded

### Story 6.8: JWT Inspector (decode, verify signature offline-capable)

As a developer debugging an auth flow,
I want to paste a JWT and see the decoded header/payload/signature with offline signature verification for HS256,
So that I can debug without sending the token to a server.

**Acceptance Criteria:**

**Given** the user opens the JWT inspector (`tools/jwt-inspector/index.html`)
**When** they paste a JWT into the `<textarea name="token">`
**Then** the tool splits on `.` (expecting exactly 3 segments), base64url-decodes segments 1 and 2, parses them as JSON, and renders:
- Header: `<section class="jwt-header"><h3>Header</h3><pre><code>{JSON.stringify(header, null, 2)}</code></pre></section>`
- Payload: `<section class="jwt-payload">` (same shape)
- Signature: `<section class="jwt-signature"><h3>Signature</h3><code>{base64url signature}</code></section>`
- Expiration status: if `payload.exp` is present, render `<p class="jwt-exp {past ? 'expired' : 'valid'}">` with `Expired at <Date(payload.exp * 1000).toISOString()>` or `Valid until <Date(payload.exp * 1000).toISOString()>`
**And** for HS256 (when `header.alg === 'HS256'`), the user can paste a secret into `<input name="secret">`; the tool verifies via Web Crypto: `crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])` then `crypto.subtle.verify('HMAC', key, signatureBytes, headerAndPayloadBytes)`; show `Valid signature` or `Invalid signature` with green/red border
**And** for RS256/ES256 (asymmetric), the tool shows the message `Verification requires the public key — paste a PEM to verify` and offers a paste-PEM textarea; PEM is imported via `crypto.subtle.importKey('spki', pemBytes, { name: 'RSASSA-PKCS1-v1_5' | 'ECDSA', hash: 'SHA-256' }, false, ['verify'])`
**And** the tool never makes a network request (privacy claim holds); all operations use Web Crypto APIs only
**And** the URL state encodes the token only if `?embed` is NOT set (`?token=<jwt>` when no embed, omitted when `?embed` is present); embed mode is documented as not for token sharing because tokens are sensitive

### Story 6.9: Timestamp Converter (Unix, ISO, RFC, human)

As a developer debugging logs,
I want a timestamp converter supporting Unix epoch (s/ms), ISO 8601, RFC 2822, and human-readable,
So that I can switch formats without leaving the page.

**Acceptance Criteria:**

**Given** the user opens the Timestamp converter (`tools/timestamp-converter/index.html`)
**When** they paste a timestamp into `<input name="timestamp">` in any supported format
**Then** the tool auto-detects the format using these regexes (first match wins):
- Unix seconds: `/^\d{10}$/` (10-digit integer)
- Unix milliseconds: `/^\d{13}$/` (13-digit integer)
- ISO 8601: `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/`
- RFC 2822: `/^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4}/`
**And** renders a `<table class="timestamp-results">` with rows for each target format: `Unix seconds`, `Unix milliseconds`, `ISO 8601`, `RFC 2822`, `Human-readable (locale)`
**And** the tool supports both Unix seconds and milliseconds; auto-detection by magnitude: 10-digit number is treated as seconds, 13-digit as milliseconds
**And** the human-readable format uses `new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'long' }).format(date)` where `locale` is read from `localStorage['handy-tools.settings'].language` (Story 3.5)
**And** the "Now" button (`<button data-action="now">`) fills the input with `Date.now()` and triggers detection; pressing `Enter` in the input also triggers detection

### Story 6.10: Flashcard Timer (Pomodoro variant)

As a student studying for an exam,
I want a flashcard timer that alternates recall and break intervals,
So that I can stay in flow without managing time manually.

**Acceptance Criteria:**

**Given** the user opens the Flashcard timer (`tools/flashcard-timer/index.html`)
**When** they set a recall duration (`<input type="number" name="recall" min="1" max="180" value="25">` in minutes, default `25`) and a break duration (`<input type="number" name="break" min="1" max="60" value="5">`, default `5`)
**Then** clicking Start (`<button data-action="start">`) begins a countdown using `setInterval(1000)` that decrements a `remainingSeconds` value; the display is `<div class="timer-display" aria-live="polite">MM:SS</div>`
**And** when the countdown reaches 0, the tool plays a hand-rolled beep via Web Audio: `audioContext.createOscillator()` with frequency 880 Hz, gain 0.2, duration 0.5s; if `audioContext` is unavailable, falls back to a visual-only cue (red border flash)
**And** the timer cycles between recall and break until the user clicks Stop; each cycle increments `cycleCount` and renders `<span class="cycle-count">Cycle <n></span>`
**And** the URL state encodes both durations and the current state (`?recall=25&break=5&state=running|paused|idle&cycles=<n>`)
**And** the timer respects `prefers-reduced-motion` (Story 5.9): the SVG progress ring is rendered as a static ring (no animation); the timer still updates the numeric MM:SS display

### Story 6.11: Exam Countdown

As a student preparing for a test,
I want a countdown to a future date showing days/hours/minutes/seconds,
So that I can pace my study.

**Acceptance Criteria:**

**Given** the user opens the Exam countdown (`tools/exam-countdown/index.html`)
**When** they pick a future date and time via `<input type="datetime-local" name="target">`
**Then** the tool shows a live countdown rendered as four `<span class="countdown-segment">` elements: `Xd`, `Xh`, `Xm`, `Xs`; updated every 1000ms via `setInterval`
**And** the countdown target persists across sessions via `localStorage['handy-tools.exam-countdown.target'] = <ISO 8601 string>`; the field is restored on page load (read happens once at module init, BEFORE first paint of the countdown); if the stored value is unparseable, the field is cleared via `localStorage.removeItem(...)` and the tool renders the empty state `<p class="countdown-empty">Pick a date and time to start the countdown</p>`
**And** the URL state encodes the target date/time (`?target=<ISO 8601>`)
**And** if the target is in the past (`targetDate < new Date()`), the tool shows `<p class="countdown-past">Exam date has passed — pick a new date</p>` and the countdown renders as zeros (no negative numbers)

### Story 6.12: Recipe Scaler (×N, unit conversion)

As a cook wanting to scale a recipe,
I want to multiply ingredient quantities by N and convert between metric/imperial,
So that I can cook for a different group size or use a different unit system.

**Acceptance Criteria:**

**Given** the user opens the Recipe scaler (`tools/recipe-scaler/index.html`)
**When** they paste a recipe into `<textarea name="recipe">` (free-text, one ingredient per line in the format `<quantity> <unit> <ingredient>`, e.g., `1/2 cup flour`) and set a multiplier `<input type="number" name="multiplier" min="0.1" max="100" step="0.1" value="2">`
**Then** the tool parses each line via the regex `/^([0-9]+(?:\s+[0-9]+\/[0-9]+)?|[0-9]*\.[0-9]+|[0-9]+\/[0-9]+)\s+(\w+)?\s+(.+)$/` (note: the unit group requires at least one whitespace before it, so `2eggs` is parsed as `2` (quantity) + `eggs` (ingredient), not `2` + `eggs` as a unit); this matches `1/2`, `1 1/2`, `0.5`, `2` followed by an optional unit token (from the Story 6.12 unit allowlist) and a required ingredient string; fractions are parsed via a hand-rolled `parseFraction(s)` that returns a decimal number; lines that fail to match the regex (no quantity found) are rendered as `<li class="recipe-line-unparsed"><code>{line}</code> (could not parse — please check format)</li>` and skipped from the scaling calculation
**And** scales each quantity by the multiplier using `scaledQty = originalQty * multiplier`
**And** the unit toggle (`<select name="system">` with options `metric | imperial`) converts the allowlisted units below; conversion factors live in `assets/data/unit-conversion.json` and each factor is exact to 6 decimals. Volume: `cup <-> ml` (1 cup = 236.588 ml), `tbsp <-> ml` (1 tbsp = 14.787 ml), `tsp <-> ml` (1 tsp = 4.929 ml), `floz <-> ml` (1 fl oz = 29.574 ml), `liter <-> ml` (1 L = 1000 ml), `pint <-> ml` (1 pint = 473.176 ml), `quart <-> ml` (1 qt = 946.353 ml), `gallon <-> ml` (1 gal = 3785.41 ml). Mass: `oz <-> g` (1 oz = 28.3495 g), `lb <-> g` (1 lb = 453.592 g), `kg <-> g` (1 kg = 1000 g). Temperature: `°F <-> °C` (`C = (F - 32) * 5/9`). Unknown units (any token not in the allowlist) are passed through verbatim with a warning chip `<span class="unit-warning" title="Unknown unit: <unit>">` appended next to the scaled line
**And** the URL state encodes the recipe (base64), multiplier, and unit system (`?recipe=<base64>&multiplier=2&system=metric`)
**And** fractions round to a readable format: `formatFraction(n)` returns `1/2` for 0.5, `1 1/4` for 1.25, `2` for 2.0 (uses continued-fraction approximation with a denominator cap of 16)

### Story 6.13: Grocery List Builder (categorized, shareable)

As a household planning meals,
I want to compose a categorized grocery list and share it via URL,
So that my partner can see what we need without signing up.

**Acceptance Criteria:**

**Given** the user opens the Grocery list builder (`tools/grocery-list/index.html`)
**When** they add items via `<input name="item">` + `<select name="category">` (categories: `Produce`, `Dairy`, `Meat`, `Bakery`, `Pantry`, `Frozen`, `Beverages`, `Other`) and click Add (`<button data-action="add">`)
**Then** the list is grouped by category and rendered as `<section class="grocery-category" data-category="<cat>"><h3><cat></h3><ul><li data-item-id="<id>"><input type="checkbox"> <span class="item-name">...</span></li></ul></section>` for each non-empty category
**And** the URL encodes the whole list as base64-encoded JSON in `?list=<base64>`; the JSON shape is `{ items: [{ id, name, category, checked: bool }, ...] }`; pasting the URL on a fresh tab restores the list
**And** items can be checked off (`<input type="checkbox">` toggles the `checked` field and updates the URL via `history.replaceState`); checked items render with `text-decoration: line-through`
**And** a Print button (`<button data-action="print">`) calls `window.print()`; the print stylesheet from Story 3.10 hides all chrome and renders only `<section class="grocery-category">` elements as a clean shopping list (no checkboxes, plain text)

### Story 6.14: Paint Calculator (walls, doors, windows)

As a homeowner painting a room,
I want to compute paint quantity given wall dimensions, doors, and windows,
So that I buy the right amount.

**Acceptance Criteria:**

**Given** the user opens the Paint calculator (`tools/paint-calculator/index.html`)
**When** they enter wall dimensions (per wall: `<input type="number" name="wall-width">` × `<input type="number" name="wall-height">` in feet; multiple walls via "Add wall" button), door count (`<input type="number" name="doors" min="0" value="1">`, each door = 21 sq ft), window count (`<input type="number" name="windows" min="0" value="1">`, each window = 12 sq ft)
**Then** the tool computes `totalArea = sum(wallWidth * wallHeight) - doors * 21 - windows * 12` in square feet, then `gallons = Math.ceil(totalArea / 350)` (assuming 350 sq ft per gallon coverage)
**And** the URL state encodes all dimensions (`?walls=<base64 JSON of [{w,h}, ...]>&doors=1&windows=2`); each wall is `{ w: <feet>, h: <feet> }`
**And** the result is rendered as `<p class="paint-result">Recommended: <strong><n></strong> gallons (covers <area> sq ft after subtracting openings)</p>`; the gallon count is always rounded UP via `Math.ceil` so the user never under-buys

### Story 6.15: Area and Volume Calculator (rooms, irregular shapes)

As a homeowner measuring a room,
I want an area/volume calculator with rectangle, triangle, circle, and irregular polygon (L-shape),
So that I can compute flooring, paint, or fill material needs.

**Acceptance Criteria:**

**Given** the user opens the Area/Volume calculator (`tools/area-volume/index.html`)
**When** they pick a shape (`<select name="shape">` with options `rectangle`, `triangle`, `circle`, `l-shape`, `box-3d`, `cylinder-3d`) and enter dimensions (e.g., `<input name="length">`, `<input name="width">` for rectangle)
**Then** the tool computes:
- rectangle: `length * width`
- triangle: `0.5 * base * height`
- circle: `Math.PI * radius * radius`
- l-shape: union of two rectangles (`r1.w * r1.h + r2.w * r2.h` with overlap subtraction if specified)
- box-3d: `length * width * height` (volume)
- cylinder-3d: `Math.PI * radius * radius * height` (volume)
**And** the unit toggle (`<select name="unit">` with `m² | ft²` for area, `m³ | ft³` for volume) re-renders the result; conversion factor is `1 m² = 10.7639 ft²`, `1 m³ = 35.3147 ft³`
**And** the L-shape calculator accepts two rectangles: `<input name="r1-w">`, `<input name="r1-h">`, `<input name="r2-w">`, `<input name="r2-h">`; if the rectangles overlap, a checkbox `<input name="subtract-overlap">` enables overlap subtraction
**And** the URL state encodes shape, dimensions, and unit (`?shape=l-shape&r1w=10&r1h=8&r2w=6&r2h=4&unit=m%c2%b2`)

### Story 6.16: Budget Planner (income, expenses, savings rate)

As a household planning finances,
I want a budget planner that computes savings rate and discretionary income,
So that I can see where I stand.

**Acceptance Criteria:**

**Given** the user opens the Budget planner (`tools/budget-planner/index.html`)
**When** they enter monthly income (`<input type="number" name="income" min="0" step="0.01">`) and one expense input per default category: `<input name="cat-housing" type="number" min="0" step="0.01" placeholder="0.00">`, `<input name="cat-food" ...>`, `<input name="cat-transport" ...>`, `<input name="cat-entertainment" ...>`, `<input name="cat-other" ...>`
**Then** the tool computes `totalExpenses = cat-housing + cat-food + cat-transport + cat-entertainment + cat-other + sum(addCategory rows)`, `savings = income - totalExpenses`, `savingsRate = income > 0 ? Number((savings / income * 100).toFixed(2)) : 0`, and `discretionary = savings - (cat-housing + cat-transport)` (housing and transport are classified as `fixed` expenses; food, entertainment, and other are `discretionary`)
**And** the categories are configurable via an "Add category" button (`<button data-action="add-category">`) which appends a new row; default categories are `Housing`, `Food`, `Transport`, `Entertainment`, `Other`
**And** the URL state encodes all values as base64-encoded JSON (`?budget=<base64>`); the exact JSON shape is `{ income: number, categories: [{ id: string, name: string, amount: number }, ...] }` where `id` is a UUIDv4 generated when the category is created (preserved across edits so URL state stays stable when categories are reordered)
**And** the result table (`<table class="budget-results">`) is print-friendly: it has `class="no-print"` removed and uses Story 3.10 print stylesheet (chrome hidden, table borders forced to black, monospace font for numbers)

### Story 6.17: Savings Goal (target, months, monthly contribution)

As a saver working toward a goal,
I want to enter a target amount, a deadline, and a starting balance,
So that I see the required monthly contribution.

**Acceptance Criteria:**

**Given** the user opens the Savings goal (`tools/savings-goal/index.html`)
**When** they enter `<input name="target">` (target amount), `<input name="months">` (deadline in months), `<input name="starting">` (starting balance), and optionally `<input name="rate">` (annual interest rate %, default `0`)
**Then** the tool computes the required monthly contribution using the annuity-due formula: if rate > 0, `monthly = (target - starting * (1 + r)^n) / (((1 + r)^n - 1) / r)` where `r = rate/100/12` and `n = months`; if rate == 0, `monthly = (target - starting) / months`
**And** the result shows three rows: `Monthly contribution: <monthly>`, `Total contributed: <monthly * months + starting>`, `Total interest earned: <target - totalContributed>`; if rate is 0, interest row is hidden
**And** progress percentage is rendered as `<progress value="<starting>" max="<target>">` showing the starting balance as initial progress
**And** the URL state encodes all values (`?target=10000&months=24&starting=1000&rate=2.5`)
**And** the tool validates: deadline must be > 0 (shows `Deadline must be at least 1 month` if invalid); target must be > starting balance (shows `Target must exceed starting balance` if invalid); validations block computation and render the error inline

### Story 6.18: Currency Converter (live rates, offline fallback)

As a traveler wanting to convert currencies,
I want to convert with up-to-date rates and a fallback to cached rates offline,
So that I can use the tool on a flight.

**Acceptance Criteria:**

**Given** the user opens the Currency converter (`tools/currency-converter/index.html`)
**When** they pick two currencies (`<select name="from">`, `<select name="to">`) and enter an amount (`<input type="number" name="amount" min="0" step="0.01">`)
**Then** the tool fetches the latest rate from `https://api.exchangerate.host/latest?base=<from>&symbols=<to>` (CORS-enabled public API); the response is parsed and `convertedAmount = amount * rate`
**And** the rate is cached in localStorage as `localStorage['handy-tools.fx.<from>-<to>'] = JSON.stringify({ rate, fetchedAt: <ISO 8601> })`
**And** if `navigator.onLine === false` OR the fetch fails (rejects within 5 seconds), the tool uses the last cached rate and shows `<p class="fx-stale-notice">Rates may be stale (cached <relative time>)</p>` where relative time is computed via `Intl.RelativeTimeFormat`
**And** the URL state encodes the currencies and amount (`?from=USD&to=EUR&amount=100`)
**And** the tool respects the user's default currency from Settings (`localStorage['handy-tools.settings'].defaultCurrency`); on first load, the `from` select is pre-populated with the default currency
**And** the rate refresh is debounced to one fetch per currency pair per 60 minutes (using `fetchedAt` from cache)

### Story 6.19: Travel Pack Composition

As a traveler landing on `/packs/travel`,
I want to see the Travel pack description and a curated grid of travel-relevant tools,
So that I can find what I need without browsing the full grid.

**Acceptance Criteria:**

**Given** the user visits `/packs/travel`
**When** the page renders
**Then** it shows the Travel pack description `Split bills, convert currencies, scale recipes abroad, handle time zones` and a grid of travel-relevant tools rendered by filtering `tools.json` for `pack === 'travel' && ready === true`
**And** the pack has at least 3 promoted tools (existing: `currency-converter`, `tip-calculator`, `unit-converter`) plus at least 2 new tools from Stories 6.10-6.18 (specifically: `recipe-scaler` (Story 6.12) and `exam-countdown` (Story 6.11) — these are the two new travel-relevant tools whose description involves travel scenarios; `time-zone-converter` is NOT a Story 6.10-6.18 deliverable and is not required for this pack); the CI test `scripts/check-pack-composition.py` asserts exactly that the Travel pack contains the 5 specific tools listed above (`currency-converter`, `tip-calculator`, `unit-converter`, `recipe-scaler`, `exam-countdown`) and fails if any is missing or if any tool not in this list has `pack === 'travel'`

### Story 6.20: Finance, Study, Developer, Household Pack Composition

As a user landing on any other pack page,
I want the same curated experience for Finance, Study, Developer, and Household packs,
So that every pack is meaningful.

**Acceptance Criteria:**

**Given** the user visits `/packs/finance`, `/packs/study`, `/packs/developer`, or `/packs/household`
**When** the page renders
**Then** each pack page shows its description and at least 3 promoted + at least 2 new tools (per CI assertion in `scripts/check-pack-composition.py`); the descriptions are:
- Finance: `Budget, save, convert currencies, and track expenses`
- Study: `Flashcards, citations, countdowns, and formatting for papers`
- Developer: `JSON, JWT, UUID, and timestamps without uploading data` (this description includes the CyberChef acknowledgment: `For most recipes, CyberChef remains the gold standard — Handy Tools' Developer pack covers the day-to-day tools with no upload`)
- Household: `Paint, area, recipes, and grocery lists for home projects`
**And** the taxonomy (Story 6.3) is respected: every tool rendered on a pack page MUST have `tools.json[slug].pack === '<slug>'`; CI fails the build if a tool appears on a pack page without the matching tag

---

## Epic 7: Internationalization — 5 Starter Locales with One Fully-Translated Tool

**Epic goal:** A user can switch the suite to Bengali, Hindi, Spanish, or Arabic and the Shell copy translates. The QR generator and tip calculator ship fully translated. Numbers, dates, and currency follow the locale. Right-to-left layout mirrors cleanly under existing CSS logical properties.

**FRs covered:** FR-17, FR-18, FR-19
**Architecture ADs:** AD-10 (i18n + Intl), AD-5 (locale in URL state)
**UX-DRs:** UX-DR-2 (Locale toggle), UX-DR-20 (RTL-safe layout)

### Story 7.1: Locale Catalog and String Registry

As a developer adding a translatable string anywhere in the Shell or a tool,
I want a single locale catalog at `assets/locales/<locale>.json` with one key per string,
So that translations are centralized and missing keys are caught in CI.

**Acceptance Criteria:**

**Given** a developer wants to add a string to the Shell or a tool
**When** they call `HT.i18n.t('palette.placeholder')` (where `HT` is the Shell global and `i18n` is the i18n module)
**Then** the function returns the string from the active locale's catalog (`assets/locales/<activeLocale>.json`) at the dotted path `palette.placeholder`; if not found, falls back to `assets/locales/en.json` at the same path; if still not found, returns the key string itself (`'palette.placeholder'`)
**And** a missing key in a non-English locale logs a console warning in dev mode only (`if (location.hostname === 'localhost') console.warn(...)`) and returns the key in production
**And** CI runs `scripts/check-locale-catalog.py` which fails the build if any key in `assets/locales/en.json` is missing from `en.json` (defense against accidental deletion); the script also reports per-locale missing-key counts as a build artifact
**And** the catalog schema is enforced via `assets/locales/locales.schema.json` (ajv draft-07): each catalog must be an object with string values only (or nested objects with string values), no arrays, no functions, max nesting depth 5

### Story 7.2: Shell Copy Translation Across 5 Locales

As a user switching the suite to a different language,
I want every Shell string (header, footer, palette, settings, history, share) translated,
So that the Shell feels native in my language.

**Acceptance Criteria:**

**Given** the user switches the locale to one of: `bn` (Bengali), `hi` (Hindi), `es` (Spanish), `ar` (Arabic), or `en` (English)
**When** any Shell string is rendered (header title, footer links, palette placeholder, settings labels, history panel header, share dialog labels)
**Then** the string comes from `assets/locales/<locale>.json` via `HT.i18n.t(key)`; the Shell's chrome-hide selectors and HTML markup are unchanged; only the inner text nodes are swapped
**And** the Settings locale picker (`<select name="language">`) shows all 5 locales with their native names as option labels: `বাংলা`, `हिन्दी`, `Español`, `العربية`, `English`; the `value` attribute is the locale code (`bn`, `hi`, `es`, `ar`, `en`)
**And** the locale switch persists via the storage registry (`localStorage['handy-tools.settings.language']`) and is honored on the next visit by an inline `<head>` script that sets `<html lang="<locale>" dir="<ltr|rtl>">` before first paint (no FOUC)

### Story 7.3: Intl-Based Number, Date, and Currency Formatting

As a user in a non-English locale,
I want numbers, dates, and currency to follow my locale's conventions,
So that I see `1.234,56 €` in Spanish, `৳ 1,234.56` in Bengali, etc.

**Acceptance Criteria:**

**Given** any tool renders a number, date, or currency
**When** the tool is displayed in a non-English locale (where locale is determined by Story 7.2)
**Then** numbers are formatted via `new Intl.NumberFormat(locale).format(n)` (Spanish: `1234.56 -> "1.234,56"`), dates via `new Intl.DateTimeFormat(locale).format(d)`, currency via `new Intl.NumberFormat(locale, { style: 'currency', currency: code }).format(amount)` (Bengali + USD: `1234.56 -> "US$ 1,234.56"`)
**And** the locale is read from `localStorage['handy-tools.settings.language']` (per Story 3.5 settings registry) and falls back to `navigator.language`; the read happens once per page load and is cached in a module-level variable
**And** all existing tools that render numbers/dates/currency are updated to use `Intl.*` via a shared helper `HT.format.number(n)`, `HT.format.date(d)`, `HT.format.currency(amount, code)`; Epic 2 tools that previously used `.toFixed(2)` + string concat are refactored to call these helpers

### Story 7.4: RTL Layout Mirror with CSS Logical Properties

As an Arabic-speaking user,
I want the suite layout to mirror cleanly under right-to-left text direction,
So that the navigation and tool surfaces feel natural.

**Acceptance Criteria:**

**Given** the locale is Arabic (`ar`) or any other RTL locale (Hebrew `he`, Urdu `ur`, Persian `fa` — all detected by `Intl.Locale(locale).getTextInfo?.() === 'rtl'` OR a hardcoded allowlist `[ar, he, ur, fa]`)
**When** any page renders
**Then** the `<html>` element receives `dir="rtl"` and `lang="<locale>"` via the inline `<head>` script (no FOUC)
**And** all padding/margin/border usages in CSS use logical properties only: the complete allowed list is `padding-inline-start`, `padding-inline-end`, `padding-block-start`, `padding-block-end`, `padding-inline`, `padding-block`, `margin-inline-start`, `margin-inline-end`, `margin-block-start`, `margin-block-end`, `margin-inline`, `margin-block`, `border-inline-start`, `border-inline-end`, `border-block-start`, `border-block-end`, `border-inline`, `border-block`, `inset-inline-start`, `inset-inline-end`, `inset-block-start`, `inset-block-end`, `inset-inline`, `inset-block`; physical properties (`padding-left`, `padding-right`, `padding-top`, `padding-bottom`, `margin-left`, `margin-right`, `margin-top`, `margin-bottom`, `border-left`, `border-right`, `border-top`, `border-bottom`, `left`, `right`, `top`, `bottom`) are forbidden in hand-written CSS
**And** the cobalt palette and component library render correctly in RTL — verified by visual regression tests on three key screens (`/`, `/tools/qr-code-generator/`, `/settings`) using Playwright with `locale: 'ar'` and `direction: 'rtl'`
**And** CI runs `scripts/check-rtl-purity.py` which greps for `padding-left|padding-right|margin-left|margin-right|left:|right:` (excluding vendor CSS under `assets/js/vendor/` and `node_modules/`) and fails the build if any match is found

### Story 7.5: QR Generator Fully Translated

As a non-English-speaking user wanting to generate a QR code,
I want every QR generator string (labels, placeholders, error messages) in my locale,
So that I can use the tool without English literacy.

**Acceptance Criteria:**

**Given** the QR generator (`tools/qr-code-generator/index.html`) is open in a non-English locale
**When** the user interacts with any input, button, or result element
**Then** every visible string comes from the locale catalog via `HT.i18n.t(...)`; the exact keys translated are: `qr.label.text`, `qr.label.size`, `qr.label.errorCorrection`, `qr.placeholder.text`, `qr.button.generate`, `qr.button.download`, `qr.error.emptyText`, `qr.error.tooLong`, `qr.share.copied`, `qr.result.alt`
**And** the QR code content (the actual data encoded in the QR) is rendered verbatim (NOT translated — QR codes encode machine-readable data); however, if the content is a WiFi QR (SSID + password), the SSID and password fields ARE rendered through `Intl` for any numeric segments (e.g., WiFi password `12345` renders as `12,345` in `en-US` if formatted)
**And** the URL state includes the locale (`?locale=<locale>`) so a shared URL preserves the language; the locale is read from the URL on page load BEFORE the inline script sets `<html lang>`

### Story 7.6: Tip Calculator Fully Translated

As a non-English-speaking user wanting to compute a tip,
I want every tip calculator string in my locale with locale-aware currency formatting,
So that I see the result in my currency and language.

**Acceptance Criteria:**

**Given** the Tip calculator (`tools/tip-calculator/index.html`) is open in a non-English locale
**When** the user enters `<input name="bill">`, `<input name="tip-percent">`, `<input name="people">`
**Then** every string is translated via `HT.i18n.t(...)`; exact keys: `tip.label.bill`, `tip.label.tipPercent`, `tip.label.people`, `tip.placeholder.bill`, `tip.button.calculate`, `tip.button.reset`, `tip.error.invalidBill`, `tip.error.zeroPeople`, `tip.table.person`, `tip.table.tip`, `tip.table.total`
**And** the currency output is rendered with `new Intl.NumberFormat(locale, { style: 'currency', currency: <code> }).format(amount)`; the currency code comes from the `<select name="currency">` field (default from `localStorage['handy-tools.settings.defaultCurrency']`, Story 3.5)
**And** the result table columns (`<th>Person</th>`, `<th>Tip</th>`, `<th>Total</th>`) are translated; numeric cells are formatted with `Intl.NumberFormat` for the locale
**And** the URL state includes the locale and currency (`?locale=<locale>&currency=<code>`)

### Story 7.7: Locale Picker and URL-State Locale Preservation

As a user sharing a tool URL across language preferences,
I want the locale to be encoded in the URL so the recipient sees the same language,
So that sharing is locale-aware.

**Acceptance Criteria:**

**Given** the user switches the locale via Settings (Story 3.5) to one of `en | bn | hi | es | ar`
**When** any tool URL is generated (via Share dialog — Story 3.9, or via the shareState registry)
**Then** the URL includes `?locale=<locale>` (appended after existing query params); the locale is the active effective locale (URL > Settings > navigator.language precedence)
**And** pasting the URL on a fresh tab restores the locale: an inline `<head>` script reads `URLSearchParams(location.search).get('locale')` and sets `<html lang>` and `<html dir>` before first paint
**And** the locale picker in Settings (`<select name="language">`) shows the current effective locale as the selected option (computed by the same precedence chain: URL > Settings > navigator.language)
**And** the inline `<head>` script runs before any i18n string is rendered, so there is no flash of untranslated content (FOUC) for translations; the script is synchronous and inlined at the top of `<head>`

### Story 7.8: Locale Fallback Chain

As a translator adding a partial translation for a new locale,
I want missing keys to fall back to English without breaking the page,
So that incremental translation is safe.

**Acceptance Criteria:**

**Given** a locale catalog is missing some keys (e.g., `bn.json` has 200 of 230 keys from `en.json`)
**When** `HT.i18n.t(key)` is called for a missing key
**Then** the function looks up `en.json[key]`; if found, returns the English string; if not found in either, returns the key itself (`'palette.placeholder'`)
**And** a warning is logged in dev mode only: `console.warn('[i18n] missing key:', key, 'in locale:', activeLocale)`; the warning includes the full dotted key path and the active locale code
**And** a CI check (`scripts/check-locale-catalog.py --report`) writes a `locale-progress.json` artifact in the form `{ "<locale>": { total: <n>, present: <n>, missing: <n>, percent: <pct> } }`; this artifact is posted as a PR comment by the CI workflow
**And** the locale switcher in Settings shows a hint next to partial locales: `<option value="bn">বাংলা — Translation progress: 87% (15 missing)</option>` where the percent and count are computed at render time from `locale-progress.json`

---

## Cross-Epic Stories (Verification)

### Story X.1: End-to-End Smoke Test on Staging

As a maintainer shipping the full suite,
I want a Playwright suite that exercises one user journey per epic (Priya, Marco, Aisha, Jamal) end-to-end,
So that regressions are caught at the integration level.

**Acceptance Criteria:**

**Given** the suite is deployed to staging
**When** the maintainer runs `make e2e`
**Then** exactly four Playwright tests run from `tests/e2e/<journey>.spec.js` — one per UJ (Priya = QR generator, Marco = Currency converter, Aisha = Flashcard timer, Jamal = Paint calculator) — and each test executes the following steps in order:
1. Visits `https://staging.handy.tools/`
2. Opens the command palette via `await page.keyboard.press('Control+k')`; asserts the palette `<dialog class="palette">` is visible
3. Types the tool name into `<input class="palette-search">` and presses `Enter` to navigate
4. Runs the tool by filling inputs with sample data (defined in `tests/e2e/fixtures/<tool>.json`) and clicking the primary action button
5. Confirms history is recorded: `expect(await page.evaluate(() => JSON.parse(localStorage['handy-tools.history.<slug>']).length)).toBeGreaterThan(0)`
6. Confirms URL state roundtrips through a fresh tab: copies the URL, opens a new `page.goto(url)`, asserts the same input values are populated
7. Confirms the tool renders in embed mode: `await page.goto(url + '&embed=1')`; asserts `document.documentElement.dataset.embed === '<slug>'`
8. Confirms the tool works offline: sets `context.setOffline(true)`, reloads, asserts the tool page renders without console errors
**And** any test failure blocks the release: the CI workflow `e2e.yml` reports the failure to the PR and prevents merge

### Story X.2: Privacy Audit Sweep

As a maintainer claiming "zero network requests after first paint",
I want a CI check that scans every JavaScript file for `fetch`, `XMLHttpRequest`, `sendBeacon`, and image/font preloads,
So that any new network dependency is flagged before merge.

**Acceptance Criteria:**

**Given** a PR adds or edits a JS file in `assets/` or `tools/`
**When** the privacy-audit workflow (`scripts/privacy-audit.py`) runs
**Then** any use of the following patterns is flagged with file path, line number, and a one-line explanation:
- `fetch(` — `Network request via fetch API`
- `XMLHttpRequest` — `Network request via XMLHttpRequest`
- `sendBeacon` — `Network request via sendBeacon`
- `WebSocket` — `WebSocket connection`
- `EventSource` — `Server-sent events`
- `<link rel="preload" as="font" href="https://` — `External font preload`
- `<img src="https://` — `External image`
- `@import url("https://` — `External CSS import`
- `<script src="https://` — `External script`
**And** the PR is allowed to merge only if every flagged line either (a) has an inline exception annotation `[ALLOWED: <reason>]` on the same or preceding line, OR (b) is in the allowlist file `docs/privacy-allowlist.md` with a documented reason
**And** the allowlist is reviewed quarterly: the CI workflow posts a reminder to the PR if any allowlist entry is older than 90 days
**And** the scanner also runs on every push to `main`, posting a weekly summary of new network dependencies introduced

### Story X.3: Bundle Size Budget

As a maintainer claiming "dependency-free, small bundle",
I want a CI check that fails any PR that pushes the total asset size over 250KB gzipped (Shell + all promoted tools),
So that the privacy and performance claims hold.

**Acceptance Criteria:**

**Given** a PR adds or edits any asset under `index.html`, `assets/`, or `tools/<slug>/index.html|styles.css|script.js` for any `ready: true` tool
**When** the bundle-size workflow (`scripts/bundle-size.py`) runs
**Then** the workflow computes the gzipped size (`gzip -9 -c <file> | wc -c`) of every HTML, CSS, JS, font, and icon file reachable from the home page and from each ready tool page
**And** the build fails if `totalGzipSize > 262144` (256 KiB hard cap; the spec says 250 KB but the cap allows 6 KiB of margin for rounding); the failure message lists the top 5 largest assets
**And** the workflow posts a PR comment in the form:
```
Bundle size: 187.4 KB / 256 KB (73%)
Delta from main: +2.1 KB
Top assets:
  assets/js/shell.js          42.3 KB
  assets/js/global-chords.js   18.1 KB
  tools/qr-code-generator/...  15.2 KB
  ...
```
**And** the comment includes a `Bundle size trend` link to a 30-day history chart generated from `bundle-size-history.json`

---

