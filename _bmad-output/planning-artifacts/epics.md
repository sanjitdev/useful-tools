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
I want the Settings modal to expose every persisted preference with sensible defaults,
So that my choices persist across sessions and devices.

**Acceptance Criteria:**

**Given** the user opens Settings
**When** the modal renders
**Then** all FR-8 fields are present and validated: theme, language, default units, default currency, font scale, reduced motion, clear-data action
**And** each field is keyboard-operable (Tab order, `Space` for toggles, `Enter` for actions)
**And** changes persist via the storage registry immediately (no Save button)
**And** the modal width matches the DESIGN token (560px) and is responsive below 600px viewport
**And** closing the modal returns focus to the cog that opened it

### Story 3.6: History Panel with Timestamps and Restore Confirmation

As a user wanting to recover a previous calculation,
I want the History panel to show timestamped entries with the key inputs and result preview,
So that I can pick the right one to restore.

**Acceptance Criteria:**

**Given** the user has run a tool multiple times
**When** they open the History panel (button in tool actions)
**Then** entries are listed newest-first with: relative timestamp (`2 minutes ago`), key inputs as truncated text, result preview
**And** clicking an entry replaces current inputs after a confirm dialog if current state is unsaved
**And** the panel is dismissible via `Escape` and the close button
**And** history is stored in `handy-tools.history.<slug>` per AD-6 and never leaves the device
**And** history is empty for newly-promoted tools until the user runs them

### Story 3.7: User Data Export to JSON

As a user wanting to back up or move my data,
I want an "Export my data" action that downloads a single JSON file with history, settings, favorites, and recent,
So that I can re-import it on another device.

**Acceptance Criteria:**

**Given** the user opens Settings and clicks Export
**When** the action runs
**Then** a file named `handy-tools-export-YYYY-MM-DD.json` downloads with `{ version, exportedAt, settings, history: { <slug>: [...] }, favorites, recent }`
**And** the schema is validated by `export.schema.json` and a rejected export shows a clear error
**And** the action works offline (no network)
**And** the schema version is checked on import (Epic 3 next)

### Story 3.8: User Data Import from JSON with Schema Validation

As a user restoring my data,
I want an "Import" action that reads a previously exported JSON file and applies it,
So that my history and settings carry across devices.

**Acceptance Criteria:**

**Given** the user selects a JSON file in Settings → Import
**When** the import runs
**Then** the file is validated against `export.schema.json` (version, settings shape, history shape)
**And** if valid, every key is applied to localStorage via the storage registry, and a success toast appears
**And** if invalid, a clear error message names the offending field and the import is aborted (no partial application)
**And** conflicting settings (e.g., current value differs from imported) show a confirm dialog before overwrite
**And** the action works offline

### Story 3.9: Share Dialog with Copy URL, Print, and Embed Code

As a user wanting to share or print a tool's result,
I want the Share dialog to offer Copy URL, Print, and Embed Code,
So that I can pass the tool to a colleague in any medium.

**Acceptance Criteria:**

**Given** the user clicks the Share button on any tool
**When** the dialog opens
**Then** it shows: the canonical URL with current state encoded, a Copy URL button, a Print button, and an Embed Code snippet (`<iframe src="..." width="..." height="...">`)
**And** Copy URL writes to the clipboard and shows a 2-second toast
**And** Print opens the browser print dialog with a print stylesheet (no chrome, no nav, no footer)
**And** the dialog is dismissible via `Escape` and the close button
**And** the embed snippet uses the iframe width/height from the tool's `tools.json` entry

### Story 3.10: Print Stylesheet for Clean Output

As a user wanting a clean printout,
I want a print stylesheet that hides chrome and shows only the tool's input and result,
So that I can hand the page to someone without the navigation.

**Acceptance Criteria:**

**Given** the user prints any tool page (via Share → Print or `Ctrl-P`)
**When** the browser print preview renders
**Then** header, footer, theme toggle, settings cog, and history panel are hidden
**And** only the tool's input, result, and a footer with the canonical URL + last-updated timestamp are visible
**And** colors are forced to a print-friendly palette (no cobalt gradients)
**And** the printout fits on one page where possible (page-break-inside: avoid on result blocks)

### Story 3.11: View-Source Route with Syntax Highlighting and Download

As a user wanting to inspect a tool's code,
I want `/view-source?tool=<slug>` to render the HTML, CSS, and JS as syntax-highlighted source with a Download button,
So that I can verify the claim of zero obfuscation in one click.

**Acceptance Criteria:**

**Given** a user visits `/view-source?tool=qr-code-generator`
**When** the route renders
**Then** it shows three code blocks (HTML, CSS, JS) with vendored syntax highlighting
**And** a Download button offers a zip with all three files (or a tarball — whichever is hand-rolled without deps)
**And** the route handles 404 (unknown tool) by showing a clear error
**And** the footer link on every tool page points to this route

### Story 3.12: Recent and Pinned Tracking

As a user wanting quick access to my most-used tools,
I want a Recent list (last 5 distinct tools visited) and a Pinned list (starred tools),
So that I don't have to search for the same tool twice.

**Acceptance Criteria:**

**Given** the user visits a tool page
**When** the page loads
**Then** the tool is appended to `localStorage.handy-tools.recent` (capped at 5 distinct, FIFO — UX-DR-11)
**And** the tool's card on the home grid shows a star (Pin) button; clicking it toggles pin status
**And** pins are stored in `localStorage.handy-tools.pins` as a `{ slug: timestamp }` map (UX-DR-12)
**And** the home grid shows a Pinned row at the top of the grid when pins are non-empty (UX-DR-12, cap 9)
**And** clearing data (Settings → Clear) wipes both lists
**And** both lists are included in the exportable JSON (FR-13 / UX-DR-12)

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

**Given** the host page loads `<iframe src="https://handy.tools/?embed=qr">`
**When** the embed URL is requested
**Then** the Shell router detects `embed=1` (or `embed=<slug>`) and renders the tool page with all chrome hidden via `[data-embed]` attribute on `<html>`
**And** the tool's URL state is read from the iframe's own URL (not propagated to host)
**And** an instance-scoped UUID is generated and attached to the postMessage protocol (Story 4.3)
**And** the tool's history is suppressed (history is per-host, not per-embed)
**And** the embed layout responds to container width ≥ 240px and reflows on resize via `ResizeObserver`

### Story 4.2: Embed Snippet Modal on Every Tool

As a tool user wanting to share a tool on my own site,
I want a snippet modal that shows the copy-pasteable `<iframe>` code,
So that I can embed in seconds.

**Acceptance Criteria:**

**Given** the user clicks "Embed" on any tool page (or opens the embed action in the Share dialog)
**When** the snippet modal renders
**Then** it shows the iframe HTML with the tool's URL state encoded, the recommended width and height from the tool's `tools.json`, and a Copy button
**And** the snippet is responsive: `style="width:100%;max-width:640px;height:480px"`
**And** a live preview iframe renders the tool in a sandboxed container below the snippet
**And** the modal is dismissible via `Escape` and the close button

### Story 4.3: postMessage Protocol Envelope v1

As a host page integrating with the embed,
I want a documented `postMessage` envelope so the host can drive the tool,
So that I can read state, set inputs, and subscribe to result updates.

**Acceptance Criteria:**

**Given** the embed is loaded
**When** the host calls `iframe.contentWindow.postMessage({ v: 1, id: 'req-1', type: 'getState' }, origin)`
**Then** the embed responds `{ v: 1, id: 'req-1', type: 'state', payload: { ... } }` with the current tool state
**And** the embed supports these `type` values (allowlist): `getState`, `setInput`, `subscribe`, `unsubscribe`, `ping`
**And** unknown types are no-ops (logged in dev)
**And** the embed validates the message origin against an allowlist (default `*` for v1; configurable per-instance)
**And** payload size is capped at 64KB and over-cap messages are rejected

### Story 4.4: postMessage `setInput` and Result Subscription

As a host page that wants to prefill inputs and react to results,
I want `setInput` to mutate the tool's state and `subscribe` to receive result updates,
So that the embed can be driven programmatically.

**Acceptance Criteria:**

**Given** the embed is loaded and the host has subscribed via `{ type: 'subscribe', id: 'sub-1' }`
**When** the host posts `{ type: 'setInput', payload: { text: 'Hello' } }`
**Then** the tool's input updates and the result recomputes
**And** the host receives `{ type: 'result', id: 'sub-1', payload: { result: '...' } }` after each recompute
**And** `unsubscribe` with the matching id stops further updates
**And** the host can `ping` and receive `{ type: 'pong', id, payload: { time } }` for liveness checks
**And** all responses carry the same `id` so the host can correlate requests

### Story 4.5: Instance-Scoped UUID and Origin Checks

As the suite maintainer,
I want every embed to receive a unique instance UUID on load so the host can correlate messages,
So that multiple embeds on one page don't confuse the host's message router.

**Acceptance Criteria:**

**Given** the embed URL is loaded
**When** the Shell bootstraps the embed
**Then** a UUIDv4 is generated via `crypto.randomUUID()` and attached to `data-instance-uuid` on `<html>`
**And** every outgoing `postMessage` includes the UUID in the payload `{ instance: '<uuid>' }`
**And** the host can verify the UUID matches the iframe it created
**And** the embed logs a console warning in dev if it detects another embed with the same UUID (collision check)

### Story 4.6: Embed Demo Page with Multiple Instances

As a third-party developer wanting to test the embed,
I want a public `/embed-demo` page that loads multiple embeds and shows `postMessage` round-trips live,
So that I can see the protocol in action.

**Acceptance Criteria:**

**Given** the developer visits `/embed-demo`
**When** the page renders
**Then** it loads two embeds (QR generator + tip calculator) side-by-side
**And** a panel shows the live `postMessage` log (last 20 events with type, id, payload preview, timestamp)
**And** buttons let the developer `getState`, `setInput`, `subscribe`, `ping` each embed
**And** the page documents the protocol inline (envelope shape, type list, error semantics)

### Story 4.7: Embed Accessibility Fallback (Badge=0)

As a screen-reader user encountering an embed on a third-party site,
I want the embed iframe to have an `aria-label` so I know what tool I'm interacting with,
So that the embed is usable without sight.

**Acceptance Criteria:**

**Given** the embed is loaded
**When** the iframe is constructed
**Then** the iframe carries `aria-label="<tool title> — Handy Tools"` by default
**And** the host can override via the `title` attribute on the iframe (e.g., `title="Generate QR code for this URL"`)
**And** if the host sets `title=""` (empty), the embed falls back to the default `aria-label` (badge=0 fallback per UX)
**And** the tool inside the embed is fully keyboard-operable

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
**Then** the manifest is fetched, validates against the W3C spec, and declares `display: standalone`, `name`, `short_name`, `start_url`, `theme_color`, `background_color`, and icons in 192×192, 512×512, and maskable variants
**And** the icons exist as PNGs under `assets/icons/` and are referenced via relative paths
**And** a `<link rel="manifest">` is present on every page

### Story 5.2: Service Worker Registration and CACHE_VERSION

As a maintainer shipping the suite,
I want a service worker that caches the Shell and last-used tool assets with a `CACHE_VERSION` mirrored in `tools.json.releaseVersion`,
So that the cache and the data cannot drift apart.

**Acceptance Criteria:**

**Given** the suite is deployed with `tools.json.releaseVersion: "1.0.0"`
**When** the service worker registers
**Then** it creates a cache named `ht-shell-<CACHE_VERSION>` and precaches the Shell assets (HTML, CSS, JS, fonts, icons)
**And** on every fetch, the SW uses stale-while-revalidate for Shell assets and cache-first for tool assets
**And** when `tools.json.releaseVersion` increments, the SW creates a new cache, migrates entries where possible, and deletes the old cache on `activate`
**And** CI rejects any PR where `tools.json.releaseVersion` and `sw.js` `CACHE_VERSION` diverge

### Story 5.3: Per-Tool Asset Caching

As a user wanting offline access to tools I use regularly,
I want the service worker to cache the last-N tool assets I visited,
So that I can use them on a flight.

**Acceptance Criteria:**

**Given** the user has visited 5 tools in the current session
**When** they go offline
**Then** those 5 tools load from the cache
**And** the home grid renders the locked/unlocked status based on cache presence (cached tools render normally, uncached tools show "Offline — not cached")
**And** the SW exposes `caches.keys()` for debugging and a `Clear cache` action in Settings
**And** the cache eviction policy is LRU with a configurable max (default 50 entries)

### Story 5.4: PWA Install UX per Browser

As a user wanting to install the suite on my home screen,
I want a clear install path that matches my browser's capabilities,
So that I can install without frustration.

**Acceptance Criteria:**

**Given** the user is on a Chromium browser
**When** they visit the suite and the `beforeinstallprompt` event fires
**Then** an "Install" button appears in the header
**And** clicking it triggers the native install prompt
**And** if dismissed, the button persists for the session but is hidden for 7 days
**Given** the user is on Safari iOS or macOS
**When** they visit the suite
**Then** an "Install" button opens an instruction sheet with platform-specific steps ("Share → Add to Home Screen")
**Given** the user is on Firefox desktop
**When** they visit the suite
**Then** no install button is shown (Firefox hides install for PWAs without signed manifests)
**And** the footer mentions "Install on mobile via Share → Add to Home Screen"

### Story 5.5: Offline Fallback Page

As a user with no network and no cache for the requested path,
I want a clear offline page that explains what happened and shows cached tools,
So that I know what's available offline.

**Acceptance Criteria:**

**Given** the user navigates to an uncached path while offline
**When** the SW intercepts the request
**Then** it serves `/offline.html` with a friendly explanation and a list of cached tools (clickable)
**And** the offline page respects the theme tokens and is keyboard-complete
**And** the SW returns a proper 200 response so the browser doesn't show its own error

### Story 5.6: Privacy Page with Generated Storage Key List

As a user wanting to verify what the suite stores,
I want `/privacy` to list every localStorage key with what it stores and when it is cleared,
So that I can audit the claims.

**Acceptance Criteria:**

**Given** the storage registry is initialized
**When** the user visits `/privacy`
**Then** the page lists every key declared in the registry with: key name, prefix class (`ht.*` runtime / `handy-tools.*` user data), purpose, when cleared, retention
**And** the list is generated from the registry — no per-key string is maintained in HTML
**And** the list updates automatically when a new key is registered
**And** the page is reachable from any tool's footer

### Story 5.7: Privacy Page Live Wire Log

As a user wanting to verify the "zero network requests" claim,
I want the `/privacy` page to show a wire log of the current session's network requests,
So that I can confirm zero by inspection.

**Acceptance Criteria:**

**Given** the user opens `/privacy`
**When** the page renders
**Then** a wire log table shows the current session's network requests with: timestamp, method, URL, initiator, status
**And** the **authoritative source** is `performance.getEntriesByType('resource')` populated by a `PerformanceObserver` — the same channel the user can verify in DevTools (per AD-11)
**And** only same-origin resources are displayed with full fields; cross-origin resources without TAO show zeroed fields (per AD-11)
**And** the table is empty by default (zero requests)
**And** if a request occurs, it appears in real time and the page shows a red banner: "1 request observed this session — investigate"
**And** the user can clear the log and start a fresh observation window
**And** as a **secondary, supplementary** channel, `fetch`/`XMLHttpRequest`/`sendBeacon` interception is used only to capture POST bodies and request initiator data that `PerformanceObserver` cannot see; the secondary channel is never the source of truth

### Story 5.8: Quality Page Public Scorecard

As a user wanting to verify the 8/10 quality bar,
I want `/quality` to show every tool's score per criterion with the rubric definitions,
So that I can audit the claim.

**Acceptance Criteria:**

**Given** the audit log is current
**When** the user visits `/quality`
**Then** a table lists every tool with: name, slug, score, pass/fail per criterion, last-updated, remediation note for any failing criterion
**And** the rubric (10 criteria with one-line definitions) is shown above the table
**And** the page is generated from `docs/quality-audit.md` and `tools.json` — no manual edits to HTML
**And** the page is reachable from any tool's footer

### Story 5.9: Forced-Colors and Reduced-Motion Respect

As a user with OS-level accessibility preferences,
I want the suite to detect and respect `forced-colors` and `prefers-reduced-motion`,
So that I get the OS-native appearance and motion is reduced when I ask.

**Acceptance Criteria:**

**Given** the OS reports `forced-colors: active`
**When** the user lands on any page
**Then** the theme toggle is hidden (UA-mode display only)
**And** all colors are forced to system colors via `@media (forced-colors: active)` overrides
**And** the cobalt palette tokens become no-ops under forced-colors
**Given** the OS reports `prefers-reduced-motion: reduce` (or the user toggles it in Settings)
**When** the user navigates or interacts
**Then** all transitions and animations are disabled (transitions: none, animation: none)
**And** the palette/spinner components fall back to instant state changes

### Story 5.10: Trust Surface Pages — `/404`, `/about`, `/changelog`

As a user landing on a missing tool, or a curious visitor, or a returning user,
I want `/404`, `/about`, and `/changelog` to be real, working pages,
So that the suite's 23-surface contract (UX-DR-7) is honored and the trust signals are visible.

**Acceptance Criteria:**

**Given** the user visits an unknown path (e.g. `/tools/no-such-tool` or `/foo`)
**When** the route resolves
**Then** `/404` renders the plain message "That tool doesn't exist." with a pre-focused search box, the top 9 most-used tools, and a "Did you mean…" link if a near-match (Levenshtein ≤ 3) exists in `tools.json` (UX-DR-13)
**And** `/404` is served with HTTP status 404 (per UX-DR-13 — never 200)
**And** `/404` never auto-redirects

**Given** the user visits `/about`
**When** the page renders
**Then** it shows: project purpose, the four named-protagonist journeys (Priya/Marco/Aisha/Jamal) one-line each, the eight privacy guarantees verbatim, and a link to the source repo
**And** the page uses Shell chrome (header/footer/theme/settings) and is keyboard-complete

**Given** the user visits `/changelog`
**When** the page renders
**Then** it shows release notes grouped by version (most-recent first), each entry: version, date, the rubric-audit delta (which tools were re-scored), the per-tool score changes, and the new tools added in that release
**And** the data is generated from `tools.json.releaseVersion` + a per-release `CHANGELOG.md` parsed at build time (or read live if no build step)
**And** entries link to the audit view in `/quality` for the matching tool

**Given** all three pages are implemented
**When** a regression test runs
**Then** `/404`, `/about`, and `/changelog` are listed in `tools.json` as surfaces (or in a static `surfaces.json` registry if not tools) and are reachable by deep link, by command palette action, and from the home footer (UX-DR-7)

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
**Then** five pack cards render above the main grid with: pack icon, title, one-line description, tool count, "View pack" link
**And** clicking a pack card navigates to `/packs/<pack-slug>`
**And** empty packs (no `ready: true` tools) are not rendered
**And** each pack card uses the cobalt palette and meets the keyboard-complete contract

### Story 6.2: Pack Page Renderer

As a user clicking a pack card,
I want a `/packs/<slug>` page that lists the pack's tools with a short pack description,
So that I see only the tools I care about.

**Acceptance Criteria:**

**Given** a user visits `/packs/travel`
**When** the page renders
**Then** it shows the pack title, icon, description, and a grid of tool cards filtered by `tools.json` entries with `pack=travel` and `ready: true`
**And** an empty pack shows a "No tools in this pack yet — check back soon" message
**And** the pack page is presentation only — no pack-specific UI
**And** the pack page uses the same Shell chrome (header/footer/theme/settings) as other pages

### Story 6.3: Pack Taxonomy Documentation

As a future contributor adding a tool to a pack,
I want `docs/pack-taxonomy.md` to define each pack's inclusion criteria,
So that the taxonomy is explicit and not vibes-based.

**Acceptance Criteria:**

**Given** the maintainer wants to add a tool to a pack
**When** they consult `docs/pack-taxonomy.md`
**Then** the file lists each pack with: one-line purpose, inclusion criteria (3–5 bullet points), and examples of in-pack and out-of-pack tools
**And** the criteria are enforced at PR review via a CODEOWNERS-style check (or a CI comment that suggests the pack based on the tool's category/keywords)
**And** the taxonomy is referenced from the contributing guide (added as a section in `CONTRIBUTING.md`)

### Story 6.4: JSON Formatter Enhancements (sort keys, schema validate, diff)

As a developer wanting more from the JSON formatter,
I want options to sort keys, validate against a JSON Schema, and diff two JSONs,
So that the tool is competitive with CyberChef's JSON operations.

**Acceptance Criteria:**

**Given** the user opens the JSON formatter (existing tool, promoted in Epic 2)
**When** they enable "Sort keys"
**Then** the output JSON has keys sorted at every level (recursive)
**And** pasting a JSON Schema and enabling "Validate" shows pass/fail per error with path
**And** pasting two JSONs (input A + input B) and clicking "Diff" shows a unified diff with line-level highlights
**And** each enhancement is gated behind a `?feature=sort|schema|diff` URL state key

### Story 6.5: Citation Formatter (APA, MLA, Chicago)

As a student writing a paper,
I want to paste a book URL or ISBN and get a citation in APA, MLA, or Chicago format,
So that I don't have to remember the punctuation rules.

**Acceptance Criteria:**

**Given** the user opens the Citation formatter
**When** they paste a URL/ISBN/DOI or fill in manual fields (author, title, year, publisher)
**Then** the tool fetches metadata (if URL/ISBN/DOI) or uses the manual fields and renders the citation in the chosen format
**And** the format toggle supports APA 7, MLA 9, Chicago 17
**And** the citation is copy-able and shareable via URL state
**And** the metadata fetch uses a single network request to a public, CORS-enabled API (Open Library, CrossRef) — privacy claim still holds since the request is initiated by the user

### Story 6.6: Diff Viewer (text, line/word/char)

As a developer wanting to see what changed,
I want a diff viewer with line/word/char granularity,
So that I can review edits at the right level.

**Acceptance Criteria:**

**Given** the user opens the Diff viewer
**When** they paste two texts
**Then** the tool renders a side-by-side or unified diff with line numbers
**And** the granularity toggle (line/word/char) re-renders the diff
**And** the diff algorithm is hand-rolled (Myers/LCS) — no third-party library
**And** the URL state encodes both texts and the granularity

### Story 6.7: UUID Generator (v1, v4, v7, ULID)

As a developer generating identifiers,
I want a UUID generator supporting v1, v4, v7, and ULID,
So that I can pick the format my system requires.

**Acceptance Criteria:**

**Given** the user opens the UUID generator
**When** they pick a version and click Generate
**Then** the tool generates a valid identifier (v1 timestamp+MAC, v4 random, v7 timestamp+random, ULID Crockford-base32)
**And** the generation uses `crypto.getRandomValues` for randomness and `crypto.randomUUID` for v4
**And** the tool supports bulk generation (N identifiers, default 1, max 100)
**And** the URL state encodes the version and bulk count
**And** every identifier is verified against its spec regex before display

### Story 6.8: JWT Inspector (decode, verify signature offline-capable)

As a developer debugging an auth flow,
I want to paste a JWT and see the decoded header/payload/signature with offline signature verification for HS256,
So that I can debug without sending the token to a server.

**Acceptance Criteria:**

**Given** the user opens the JWT inspector
**When** they paste a JWT
**Then** the tool shows header (decoded), payload (decoded), signature (base64url), and expiration status (exp claim highlighted red if past)
**And** for HS256, the user can paste a secret and the tool verifies the signature offline via Web Crypto SubtleCrypto
**And** for RS256/ES256, the tool shows a clear "Verification requires the public key — paste a PEM to verify" message and offers paste-to-verify
**And** the tool never makes a network request (privacy claim holds)
**And** the URL state encodes the token (only if `?embed` is not set — embed mode strips tokens from URL)

### Story 6.9: Timestamp Converter (Unix, ISO, RFC, human)

As a developer debugging logs,
I want a timestamp converter supporting Unix epoch (s/ms), ISO 8601, RFC 2822, and human-readable,
So that I can switch formats without leaving the page.

**Acceptance Criteria:**

**Given** the user opens the Timestamp converter
**When** they paste a timestamp in any supported format
**Then** the tool detects the format and renders all formats in a results table
**And** the tool supports both Unix seconds and milliseconds (auto-detected by magnitude)
**And** the human-readable format uses `Intl.DateTimeFormat` with the user's locale
**And** the "Now" button fills the input with the current time

### Story 6.10: Flashcard Timer (Pomodoro variant)

As a student studying for an exam,
I want a flashcard timer that alternates recall and break intervals,
So that I can stay in flow without managing time manually.

**Acceptance Criteria:**

**Given** the user opens the Flashcard timer
**When** they set a recall duration (default 25min) and a break duration (default 5min)
**Then** the tool starts a countdown with audio cue at zero
**And** the timer cycles between recall and break until the user stops it
**And** the URL state encodes both durations and the current state
**And** the audio cue is a hand-rolled beep via Web Audio (no audio file dependency)
**And** the timer respects `prefers-reduced-motion` (no animated progress ring)

### Story 6.11: Exam Countdown

As a student preparing for a test,
I want a countdown to a future date showing days/hours/minutes/seconds,
So that I can pace my study.

**Acceptance Criteria:**

**Given** the user opens the Exam countdown
**When** they pick a future date and time
**Then** the tool shows a live countdown with days, hours, minutes, seconds
**And** the countdown persists across sessions (stored in localStorage)
**And** the URL state encodes the target date/time
**And** if the target is in the past, the tool shows "Exam date has passed — pick a new date"

### Story 6.12: Recipe Scaler (×N, unit conversion)

As a cook wanting to scale a recipe,
I want to multiply ingredient quantities by N and convert between metric/imperial,
So that I can cook for a different group size or use a different unit system.

**Acceptance Criteria:**

**Given** the user opens the Recipe scaler
**When** they paste a recipe (free-text or structured) and set a multiplier
**Then** the tool parses common fraction formats (`1/2`, `1 1/2`, `0.5`) and scales each ingredient
**And** the unit toggle converts between metric and imperial (cups ↔ ml, oz ↔ g, °F ↔ °C)
**And** the URL state encodes the recipe, multiplier, and unit system
**And** fractions round to a readable format (prefer `1/2` over `0.5`)

### Story 6.13: Grocery List Builder (categorized, shareable)

As a household planning meals,
I want to compose a categorized grocery list and share it via URL,
So that my partner can see what we need without signing up.

**Acceptance Criteria:**

**Given** the user opens the Grocery list builder
**When** they add items with category tags (Produce, Dairy, Pantry, etc.)
**Then** the list is grouped by category and the URL encodes the whole list
**And** pasting the URL on a fresh tab restores the list
**And** items can be checked off and the checked state is in the URL
**And** a print button produces a clean shopping list (FR-3.10 stylesheet applies)

### Story 6.14: Paint Calculator (walls, doors, windows)

As a homeowner painting a room,
I want to compute paint quantity given wall dimensions, doors, and windows,
So that I buy the right amount.

**Acceptance Criteria:**

**Given** the user opens the Paint calculator
**When** they enter wall dimensions, door count, and window count
**Then** the tool computes total wall area minus openings and recommends paint gallons (assuming 350 sq ft/gallon)
**And** the URL state encodes all dimensions
**And** the result is rounded up to the nearest whole gallon

### Story 6.15: Area and Volume Calculator (rooms, irregular shapes)

As a homeowner measuring a room,
I want an area/volume calculator with rectangle, triangle, circle, and irregular polygon (L-shape),
So that I can compute flooring, paint, or fill material needs.

**Acceptance Criteria:**

**Given** the user opens the Area/Volume calculator
**When** they pick a shape and enter dimensions
**Then** the tool computes area (and volume for 3D shapes) in m²/ft² (toggle)
**And** the L-shape calculator accepts two rectangles and returns the union area
**And** the URL state encodes shape, dimensions, and unit

### Story 6.16: Budget Planner (income, expenses, savings rate)

As a household planning finances,
I want a budget planner that computes savings rate and discretionary income,
So that I can see where I stand.

**Acceptance Criteria:**

**Given** the user opens the Budget planner
**When** they enter monthly income and categorized expenses
**Then** the tool computes total expenses, savings amount, savings rate %, and discretionary income
**And** the categories are configurable (default: Housing, Food, Transport, Entertainment, Other)
**And** the URL state encodes all values
**And** the result table is print-friendly (FR-3.10 stylesheet)

### Story 6.17: Savings Goal (target, months, monthly contribution)

As a saver working toward a goal,
I want to enter a target amount, a deadline, and a starting balance,
So that I see the required monthly contribution.

**Acceptance Criteria:**

**Given** the user opens the Savings goal
**When** they enter target, deadline (months), and starting balance
**Then** the tool computes the required monthly contribution (with optional interest rate input)
**And** the result shows total contributed, total interest earned, and progress percentage
**And** the URL state encodes all values
**And** the tool validates: deadline must be > 0, target must be > starting balance

### Story 6.18: Currency Converter (live rates, offline fallback)

As a traveler wanting to convert currencies,
I want to convert with up-to-date rates and a fallback to cached rates offline,
So that I can use the tool on a flight.

**Acceptance Criteria:**

**Given** the user opens the Currency converter
**When** they pick two currencies and enter an amount
**Then** the tool fetches the latest rate from a public, CORS-enabled API (exchangerate.host or similar)
**And** the rate is cached in localStorage with a timestamp (`handy-tools.fx.<from>-<to>`)
**And** if offline or the fetch fails, the tool uses the last cached rate and shows a "Rates may be stale (cached <relative time>)" notice
**And** the URL state encodes the currencies and amount
**And** the tool respects the user's default currency from Settings

### Story 6.19: Travel Pack Composition

As a traveler landing on `/packs/travel`,
I want to see the Travel pack description and a curated grid of travel-relevant tools,
So that I can find what I need without browsing the full grid.

**Acceptance Criteria:**

**Given** the user visits `/packs/travel`
**When** the page renders
**Then** it shows the Travel pack description ("split bills, convert currencies, convert recipe units abroad, time-zone math") and a grid of travel-relevant tools (Currency converter, Tip calculator, Unit converter, Recipe scaler, Time-zone converter if available)
**And** the pack has ≥ 3 promoted tools (existing) + ≥ 2 new tools (from Epic 6 stories 6.10–6.18)

### Story 6.20: Finance, Study, Developer, Household Pack Composition

As a user landing on any other pack page,
I want the same curated experience for Finance, Study, Developer, and Household packs,
So that every pack is meaningful.

**Acceptance Criteria:**

**Given** the user visits `/packs/finance`, `/packs/study`, `/packs/developer`, or `/packs/household`
**When** the page renders
**Then** it shows the pack description and ≥ 3 promoted + ≥ 2 new tools
**And** Developer pack description acknowledges CyberChef ("For most recipes, CyberChef remains the gold standard — Handy Tools' Developer pack covers the day-to-day tools with no upload")
**And** the taxonomy (Story 6.3) is respected — every tool on a pack page has the matching `pack` tag

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
**When** they call `HT.i18n.t('palette.placeholder')`
**Then** the function returns the string from the active locale's catalog, falling back to English
**And** a missing key in a non-English locale logs a console warning in dev and returns the key in production
**And** CI runs a check that fails if any key is missing from `en.json`
**And** the catalog schema is enforced (`locales.schema.json`)

### Story 7.2: Shell Copy Translation Across 5 Locales

As a user switching the suite to a different language,
I want every Shell string (header, footer, palette, settings, history, share) translated,
So that the Shell feels native in my language.

**Acceptance Criteria:**

**Given** the user switches the locale to Bengali, Hindi, Spanish, or Arabic
**When** any Shell string is rendered
**Then** the string comes from the matching `assets/locales/<locale>.json`
**And** the Settings locale picker shows all 5 locales with their native names (বাংলা, हिन्दी, Español, العربية, English)
**And** the locale switch persists via the storage registry and is honored on the next visit

### Story 7.3: Intl-Based Number, Date, and Currency Formatting

As a user in a non-English locale,
I want numbers, dates, and currency to follow my locale's conventions,
So that I see `1.234,56 €` in Spanish, `৳ 1,234.56` in Bengali, etc.

**Acceptance Criteria:**

**Given** any tool renders a number, date, or currency
**When** the tool is displayed in a non-English locale
**Then** numbers use `Intl.NumberFormat(locale)`, dates use `Intl.DateTimeFormat(locale)`, currency uses `Intl.NumberFormat(locale, { style: 'currency', currency })`
**And** the locale is read from `localStorage.ht.locale` and falls back to `navigator.language`
**And** all existing tools that render numbers/dates/currency are updated to use `Intl.*` (Epic 2 retrofitted)

### Story 7.4: RTL Layout Mirror with CSS Logical Properties

As an Arabic-speaking user,
I want the suite layout to mirror cleanly under right-to-left text direction,
So that the navigation and tool surfaces feel natural.

**Acceptance Criteria:**

**Given** the locale is Arabic (or any RTL locale)
**When** any page renders
**Then** `<html dir="rtl">` is set
**And** all padding/margin/border usages in CSS use logical properties (`padding-inline-start`, `margin-block-end`, `border-inline-start`)
**And** the cobalt palette and component library render correctly in RTL (verified by visual regression test on 3 key screens)
**And** the test fails if any physical-property leak is detected (a CI grep for `padding-left|padding-right|margin-left|margin-right` outside vendor CSS)

### Story 7.5: QR Generator Fully Translated

As a non-English-speaking user wanting to generate a QR code,
I want every QR generator string (labels, placeholders, error messages) in my locale,
So that I can use the tool without English literacy.

**Acceptance Criteria:**

**Given** the QR generator is open in a non-English locale
**When** the user interacts
**Then** every visible string (input labels, placeholder text, button text, error messages, share copy) comes from the locale catalog
**And** the QR code content is rendered with `Intl` if it includes numbers/dates (e.g., a WiFi QR code with SSID)
**And** the URL state includes the locale (so a shared URL preserves it)

### Story 7.6: Tip Calculator Fully Translated

As a non-English-speaking user wanting to compute a tip,
I want every tip calculator string in my locale with locale-aware currency formatting,
So that I see the result in my currency and language.

**Acceptance Criteria:**

**Given** the Tip calculator is open in a non-English locale
**When** the user enters a bill amount, tip percentage, and number of people
**Then** every string (labels, placeholders, results, error messages) is translated
**And** the currency is rendered with `Intl.NumberFormat(locale, { style: 'currency', currency })`
**And** the result table columns translate (Person, Tip, Total)
**And** the URL state includes the locale and currency

### Story 7.7: Locale Picker and URL-State Locale Preservation

As a user sharing a tool URL across language preferences,
I want the locale to be encoded in the URL so the recipient sees the same language,
So that sharing is locale-aware.

**Acceptance Criteria:**

**Given** the user switches the locale via Settings
**When** any tool URL is generated
**Then** the URL includes `?locale=<locale>` (overrides navigator.language)
**And** pasting the URL on a fresh tab restores the locale
**And** the locale picker in Settings shows the current effective locale
**And** the locale is applied before first paint via the inline `<head>` script (no FOUC for translations)

### Story 7.8: Locale Fallback Chain

As a translator adding a partial translation for a new locale,
I want missing keys to fall back to English without breaking the page,
So that incremental translation is safe.

**Acceptance Criteria:**

**Given** a locale catalog is missing some keys
**When** `HT.i18n.t(key)` is called
**Then** the missing key falls back to `en.json`
**And** a warning is logged in dev (with the missing key path and the active locale)
**And** a CI check reports missing-key counts per locale as a build artifact (visible in PR comments)
**And** the locale switcher shows a "Translation progress: 87% (15 missing)" hint next to partial locales

---

## Cross-Epic Stories (Verification)

### Story X.1: End-to-End Smoke Test on Staging

As a maintainer shipping the full suite,
I want a Playwright suite that exercises one user journey per epic (Priya, Marco, Aisha, Jamal) end-to-end,
So that regressions are caught at the integration level.

**Acceptance Criteria:**

**Given** the suite is deployed to staging
**When** the maintainer runs `make e2e`
**Then** four Playwright tests run — one per UJ — and each:
- Visits the home page
- Opens the command palette via `⌘K`
- Navigates to a tool
- Runs the tool with sample data
- Confirms history is recorded
- Confirms URL state roundtrips through a fresh tab
- Confirms the tool renders in embed mode
- Confirms the tool works offline after the SW caches it
**And** any failure blocks the release

### Story X.2: Privacy Audit Sweep

As a maintainer claiming "zero network requests after first paint",
I want a CI check that scans every JavaScript file for `fetch`, `XMLHttpRequest`, `sendBeacon`, and image/font preloads,
So that any new network dependency is flagged before merge.

**Acceptance Criteria:**

**Given** a PR adds or edits a JS file
**When** the privacy-audit workflow runs
**Then** any use of `fetch`, `XMLHttpRequest`, `sendBeacon`, `<link rel="preload" as="font">`, `<img src="https://">` (external), or WebSocket is flagged
**And** the flag includes the file path, line number, and a one-line explanation of why it was flagged
**And** the PR is allowed to merge only if the maintainer adds an exception annotation (`[ALLOWED: <reason>]`)
**And** the exception list is reviewed quarterly

### Story X.3: Bundle Size Budget

As a maintainer claiming "dependency-free, small bundle",
I want a CI check that fails any PR that pushes the total asset size over 250KB gzipped (Shell + all promoted tools),
So that the privacy and performance claims hold.

**Acceptance Criteria:**

**Given** a PR adds or edits any asset
**When** the bundle-size workflow runs
**Then** the total gzipped size of HTML+CSS+JS+fonts+icons is computed
**And** the build fails if the size exceeds 250KB
**And** the size is reported as a PR comment with a per-asset breakdown
**And** the comment shows the delta from the previous build

---

