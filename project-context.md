---
title: Handy Tools — Project Context
status: final
created: 2026-07-31
updated: 2026-07-31
project: useful-tools
---

# Handy Tools — Project Context

Brownfield project snapshot for dev-agent context. Read this before touching any file in
the repo. Treat the conventions below as **load-bearing** for the new Shell + Tool Contract
layer being built on top (Epic 1 of `_bmad-output/planning-artifacts/epics.md`).

## 1. Form factor & runtime

- **Static-only.** No build step. No `package.json`. No transpiler. No SSR. Hosted on
  GitHub Pages (or any static host). Deployment is `git push` of plain HTML/CSS/JS.
- **Zero runtime third-party libraries.** No frameworks, no Tailwind, no React, no
  analytics SDKs, no font CDNs. The only vendored JS file is `assets/js/qrcode.js`
  (used by the QR Code Generator tool, Apache-2.0 / Project Nayuki).
- **Browser target.** Current Chrome, Firefox, Safari, Edge (per PRD NFR-4).
  `file://` works for tools that do not need the service worker.
- **PWA-capable.** A service worker + `manifest.webmanifest` are added in Epic 5; until
  then the site is a plain static page.
- **No native apps in v1.** No wrappers, no App Store presence.

## 2. Repository layout (today)

```
useful-tools/
├── index.html                          # Home grid (lists all tools inline today)
├── tools/
│   └── <slug>/
│       ├── index.html                  # Tool page (vanilla HTML)
│       ├── <slug>.js                   # Tool logic (vanilla JS, no module system)
│       └── <slug>.css                  # Tool-specific styles (optional)
├── assets/
│   ├── css/
│   │   ├── base.css                    # Reset, typography, layout primitives
│   │   ├── components.css              # Shared component styles (.panel, .field, .result, .btn, ...)
│   │   └── tools.css                   # Shared utility classes for tools
│   ├── js/
│   │   ├── utils.js                    # HT.storage, HT.fmt, HT.dom helpers
│   │   ├── layout.js                   # Header/footer injection, theme-toggle wiring
│   │   ├── theme.js                    # Light/dark toggle (uses HT.storage.get/set)
│   │   └── qrcode.js                   # VENDORED — QR generator (Project Nayuki, Apache-2.0)
│   └── vendor/                         # Reserved for future vendored libraries
└── docs/                               # Reserved (AD-15 brownfield migration doc lands here)
```

**33 existing tools** under `tools/<slug>/` (one folder per tool, kebab-case slug).
Each tool is a self-contained vanilla HTML page. New tools follow the same pattern.

### Tool inventory (today)

| Slug | Display name | Pack (proposed) |
|---|---|---|
| age-calculator | Age Calculator | Household |
| animal-race | Animal Race | Household |
| base64-codec | Base64 Codec | Developer |
| bd-tax-calculator | Bangladesh Tax Calculator | Finance |
| bmi-calculator | BMI Calculator | Health (new pack — not in MVP 5) |
| calorie-estimator | Calorie Estimator | Health (new pack — not in MVP 5) |
| color-tools | Color Tools | Developer |
| compound-interest | Compound Interest | Finance |
| countdown-to-date | Countdown to Date | Household |
| date-difference | Date Difference | Travel |
| decision-wheel | Decision Wheel | Household |
| eisenhower-matrix | Eisenhower Matrix | Study |
| gpa-calculator | GPA Calculator | Study |
| grade-calculator | Grade Calculator | Study |
| habit-tracker | Habit Tracker | Household |
| json-formatter | JSON Formatter | Developer |
| lifespan-simulator | Lifespan Simulator | Household |
| loan-calculator | Loan Calculator | Finance |
| lorem-ipsum | Lorem Ipsum Generator | Developer |
| markdown-previewer | Markdown Previewer | Developer |
| password-strength | Password Strength | Developer |
| percentage-calculator | Percentage Calculator | Finance |
| pomodoro-timer | Pomodoro Timer | Study |
| pros-cons | Pros & Cons | Study |
| qr-code-generator | QR Code Generator | Developer |
| random-tools | Random Tools | Developer |
| regex-tester | Regex Tester | Developer |
| space-calculator | Space Calculator | Household |
| stopwatch | Stopwatch | Study |
| tip-calculator | Tip Calculator | Travel |
| unit-converter | Unit Converter | Travel |
| url-codec | URL Codec | Developer |
| word-counter | Word Counter | Study |
| world-clock | World Clock | Travel |

**Note:** "Health" is mentioned as a possible 6th pack but is **not** in MVP scope.
Health-tagged tools default to `pack=household` in v1 unless reassigned.

## 3. Existing shared conventions (the brownfield substrate)

These are the conventions Epic 1's new Shell must **honor or supersede**:

### `HT.*` global namespace (from `assets/js/utils.js`)

A single global object `HT` exposes helpers consumed by all tool pages and shared
scripts. As of today:

- `HT.storage.get(key)` — read `localStorage` value safely (returns `null` if missing)
- `HT.storage.set(key, value)` — write `localStorage` value
- `HT.fmt.*` — formatting helpers
- `HT.dom.*` — DOM helpers

**Conventions:**
- Storage keys live in one of two prefixes (AD-6):
  - `ht.*` — runtime/legacy (e.g., `ht.theme`). **Grandfather rule:** the existing
    `ht.theme` key stays `ht.theme`. No migration to `handy-tools.*` for theme. Any
    new runtime key uses `ht.*`.
  - `handy-tools.*` — user data (e.g., `handy-tools.history.<slug>`, `handy-tools.pins`).
    All new user data goes under this prefix.
- Per-tool storage keys follow `handy-tools.<category>.<slug>` where category is the
  data type (e.g., `history`, `pins`, `recent`).

### Theme system (from `assets/js/theme.js`)

- LocalStorage key: **`ht.theme`** (grandfathered; do not migrate)
- Values: `"light"` | `"dark"`
- Default: `prefers-color-scheme: dark` → `dark`; otherwise `light`
- Applied via `data-theme` attribute on `<html>`
- Theme switch is wired in `assets/js/layout.js` and `assets/js/theme.js`
- The home page uses an inline blocking script in `<head>` to set `data-theme` before
  first paint (matches the PRD NFR-9 FOUC < 50ms requirement)

### HTML chrome (from `assets/js/layout.js`)

- Header and footer are injected into `#site-header` and `#site-footer` divs by
  `layout.js` on DOMContentLoaded
- The `.theme-toggle` button in the header triggers theme switching
- The header includes a "← All tools" back-link to `index.html`

### Stylesheet chain (per tool page)

Each tool page loads, in order:
1. `../../assets/css/base.css` — reset, typography, layout primitives
2. `../../assets/css/components.css` — shared component styles
3. `../../assets/css/tools.css` — shared tool utilities
4. `./<slug>.css` — tool-specific overrides

The new Shell layer (Epic 1) adds the `ht.theme` color tokens to `base.css` (or a
new `shell.css`) and re-skins `.theme-toggle` to honor the cobalt palette.

### Accessibility posture (inherited today)

- Skip link is not consistently implemented — Epic 1 adds it (UX-DR-15)
- Keyboard support is partial — Epic 2 enforces keyboard-complete per tool (Tool Contract)
- `prefers-color-scheme` is respected
- Forced-colors mode is **not** currently handled — Epic 5 (Story 5.9) adds the mapping

## 4. Inventory of existing assets the Shell must NOT break

When Epic 1 ships the new Shell + Tool Contract, these existing assets must keep
working without regression:

| Asset | File | Why it's load-bearing |
|---|---|---|
| Theme toggle | `assets/js/theme.js`, `assets/js/layout.js` | Already deployed; users have a stored theme |
| Existing 33 tool pages | `tools/<slug>/index.html` | Every tool must render with new Shell |
| QR generator logic | `assets/js/qrcode.js` (vendored) | Cannot be replaced — must keep working |
| Storage helper | `assets/js/utils.js` (`HT.storage.*`) | Used by `theme.js` and by some tools |
| Layout helpers | `assets/js/layout.js` | Header/footer injection on every page |
| Stylesheets | `assets/css/{base,components,tools}.css` | Visual baseline; Shell layers on top |

## 5. Brownfield migration order (per AD-15)

Per the architecture spine, Epic 1 generates `docs/tool-inventory.md` (Story 1.4)
documenting the 33 tools and their current state. Epic 2 promotes tools in 3 waves
(Stories 2.6, 2.7, 2.8) so no single wave exceeds the CI gate's review load. Epic 2's
acceptance criterion: every existing tool has a `tools.json` entry with `ready: true`
or a waiver object, and the home grid renders from `tools.json` instead of inline HTML.

## 6. JS coding conventions (legacy → new)

- **Legacy code (utils.js, layout.js, theme.js):** ES5 baseline (var, function expressions,
  no arrow functions, no `const`/`let`, no template literals, no optional chaining).
  Per AD-12 these files stay ES5.
- **New Shell modules (Epic 1+):** ES2018 allowed (`const`/`let`, arrow functions, template
  literals, async/await, optional chaining, nullish coalescing).
- **No transpilation.** The browser must run the code as-is.
- **No JSX.** No TypeScript. Plain JS.
- **No external imports.** No `import` from `node_modules`, no `import` from CDN URLs.
  Vendored libraries live under `assets/vendor/` and are loaded via `<script>` tag.

## 7. CSS conventions

- **Custom properties** for all design tokens (cobalt palette, typography, spacing,
  rounded radii, elevation). Defined on `:root` and `:root[data-theme="dark"]`.
- **Logical properties** for RTL: `margin-inline-start`, `padding-inline-end`,
  `text-align: start`, etc. Never `margin-left` / `margin-right` for layout-affecting rules.
- **No Tailwind / utility framework.** Vanilla CSS only.
- **BEM-ish class naming** in shared stylesheets (`.tool-header`, `.field-label`,
  `.result-tile`, `.btn--primary`). Tool-specific classes can deviate.

## 8. Build / test / deploy

- **No build step.** `git push` deploys. Static host (GitHub Pages) serves the repo as-is.
- **Tests:** vanilla JS test files run in a headless browser. Story 1.3 introduces the
  first CI workflow that runs `tools.schema.json` validation; Story 1.13 introduces
  the quality-audit CI step; Story X.2 introduces the privacy-audit CI step;
  Story X.3 introduces the bundle-size budget CI step.
- **CI:** GitHub Actions, run on every PR. CI gates: schema validation, contract
  enforcement, privacy audit, bundle budget.

## 9. Open items the dev agent should NOT silently resolve

These are deferred to the appropriate Epic owner:

- **Travel vs Household pack split** (PRD Open Q1) — Story 6.3 creates
  `docs/pack-taxonomy.md` with explicit inclusion criteria.
- **Health pack** (bmi-calculator, calorie-estimator) — defer; reassign to Household
  for v1 unless PRD Open Q2 (now Open Question #2) is resolved.
- **Bengali / Hindi / Arabic translations** (Epic 7) — require native-speaker review
  before merge. Story 7.5 / 7.6 reference the source translation providers.
- **`color-tools` and `random-tools` slugs** — stable, kebab-case, immutable (UX-DR-8).
  No slug rename is permitted post-launch.

## 10. Pointers to the planning pack

The full planning artifacts live under `_bmad-output/planning-artifacts/`:

- `prds/prd-useful-tools-2026-07-31/prd.md` — 21 FRs, 10 NFRs, 4 UJs
- `architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md` — 15 ADs
- `ux-designs/ux-useful-tools-2026-07-31/DESIGN.md` — visual identity (cobalt palette)
- `ux-designs/ux-useful-tools-2026-07-31/EXPERIENCE.md` — IA, behavior, state, flows
- `epics.md` — 87 stories across 7 epics + 3 cross-epic verification stories
- `implementation-readiness-report-2026-07-31.md` — readiness verdict (READY), 0 critical,
  0 major, 0 medium drifts, 9 low drifts to address in first-sprint of owning epics
- `research/market-handy-tools-market-validation-2026-07-31/research.md` — competitive
  positioning, wedge analysis (validates the build)

---

*This file is the brownfield fact base. Do not edit without an Epic 1 or later
story explicitly authorizing the change. Updates land via the
`bmad-generate-project-context` skill or via Story 1.4 (`docs/tool-inventory.md`).*