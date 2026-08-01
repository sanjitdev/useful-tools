# EXPERIENCE.md — Handy Tools

UX Behavior Spine. Companion to `DESIGN.md` (visual spec) and the PRD (intent). This document governs how the product *behaves* — interaction, state, voice, flows. Visual specifications (color tokens, typography scale, spacing rhythm, motion curves) live in `DESIGN.md`. The two spines are peers; neither is subordinate.

> **Trust posture.** Every behavior in this document exists to make Handy Tools feel quieter, faster, and more honest than the alternatives. Privacy, correctness, transparency. Composure, speed, embeddability. Never breathless. Never cute.

---

## 1. Foundation

### 1.1 Form Factor
- **Responsive web.** Mobile-first single-hand use. The product must be fully usable with one thumb on a 360 px viewport held in portrait. Reachability, tap targets, and keyboard parity are designed mobile-first and only relax upward at larger viewports.
- **Progressive Web App (PWA).** Installable, offline-capable, no App Store friction. Service worker registered at root scope. The manifest declares: name, short_name, icons (192/512/maskable), `display: standalone`, theme and background colors matching the shell.
- **No native shells in v1.** Browser-first. Native wrappers, if ever shipped, are a thin shell around the web app — never a separate product.
- **Zero third-party libraries at runtime.** Vanilla JS, vanilla CSS, vanilla HTML. No frameworks, no Tailwind, no React, no analytics SDKs, no font CDNs. This is a load-bearing product decision — it is what makes "no tracking" provable and "works offline" reliable. The bundle ships with a sub-resource integrity check on every byte, even if the bytes are ours.
- **Performance budget.** Largest Contentful Paint ≤1.0 s on 4G (warm), ≤2.0 s (cold). Total JS ≤120 KB gzipped across the shell. Total CSS ≤30 KB gzipped. No tool's first load exceeds +30 KB over the shell.

### 1.2 UI System
- **Custom vanilla design system.** All components are bespoke, written in plain HTML/CSS/JS, owned in `assets/css/` and `assets/js/`.
- **Peer spine: `DESIGN.md`.** Visual tokens, component visuals, motion grammar. This document references DESIGN.md by token name, never redefines color or spacing values.
- **Shared stylesheet across 34 tools.** One shell, one stylesheet. Tools may add tool-specific styles inside their folder; they never mutate the shared shell.
- **Light + dark theme.** Respects `prefers-color-scheme`; user can override via Settings. Theme is a single source of truth — never per-tool overrides.
- **Design system budget.** Every shared component must serve ≥3 tools or it does not get promoted to the shell.

### 1.3 Platform Primitives

| Primitive | Role | Reached From | Dismissed By |
|---|---|---|---|
| **Shell** | Persistent frame: top bar, footer, theme toggle, install hint, locale toggle | Always present | Never dismissed (site chrome) |
| **Command Palette (⌘K)** | Front door. Search, jump, run | Anywhere, always | Esc / selection / click-outside |
| **Settings Modal** | Theme, locale, RTL, reduced motion, data export/import | Top bar gear, `g s` | Esc / close button / click-outside |
| **Keyboard Help Overlay (?)** | Cheat sheet for shortcuts | `?` key, top bar `?` link | `?` / Esc / click-outside |
| **PWA Install Prompt** | Add to Home Screen | First idle visit (≥1 prior use), dismissible | "Not now" / "Installed" |
| **Offline Banner** | Surfaced when service worker detects offline | Shell footer, auto-show/hide | "Dismiss" / auto-clear on reconnect |
| **Toast Region** | `aria-live="polite"` container for transient confirmations | Always present, top-right on ≥md, bottom on <md | Auto after 2.5 s / click / action key |
| **History Panel** | Per-tool recent inputs (local-only) | Tool page, `h` key | `h` / Esc / "Close" |
| **Embed Dialog** | Copy iframe snippet for third-party sites | Tool page share menu → "Embed", `e` key | Esc / "Done" / selection |
| **Sample Data Loader** | Pre-fill inputs with a worked example | Tool page "Try an example" link | (auto — fills and dismisses) |
| **First-Run Tip** | One-time hint pointing at ⌘K and `?` | First visit, idle ≥3 s | "Got it" / Esc / auto after 8 s |

The shell never traps the user. The Command Palette never blocks more than one modal. There is exactly **one** modal stack at any time; everything else is overlay (palette, help) or sheet (history, embed dialog, settings on <md).

### 1.4 Shell Behavior (Detailed)

The shell is the only persistent UI element. It is rendered server-side on first load (HTML contains the top bar markup, not injected by JS) so that the shell is visible before any JS executes. The shell exposes:

- **Brand wordmark.** Click goes to home. `aria-label="Handy Tools — home"`.
- **Top-level nav.** Home, Packs, Quality, About. On <md, collapses into a "Menu" affordance that opens a sheet.
- **Search field (≥md only).** `/` focuses it on home; on tool pages it opens the palette. Always labeled, never placeholder-only.
- **Theme toggle.** Icon button. Cycle: system → light → dark → system. Tooltip reflects the *next* state, not the current one: "Switch to dark theme."
- **Locale toggle (≥md only).** Icon button. Cycle through enabled locales. `aria-label` is the language name in its own script: "العربية", "English".
- **Settings gear.** `aria-label="Settings"`. `g s` shortcut.
- **Keyboard help `?` link.** `aria-label="Keyboard shortcuts"`.
- **Install button (PWA).** Hidden once installed or on browsers that don't support install.
- **Top-bar visible affordances:** 4 on <md (brand, menu, theme, install-if-available), 6 on ≥md (brand, nav links, theme, settings, install-if-available, ? link).

### 1.5 Modal vs Overlay vs Sheet — The Distinction

The product uses three kinds of "on top" UI:

- **Modal.** Blocking. Settings modal is the only true modal in v1. Focus is trapped. Page scroll is locked. The only way out is the modal's own controls.
- **Overlay.** Non-blocking. Command palette and keyboard help are overlays. The page beneath is still scrollable and interactive; focus is *not* trapped (palette focus stays inside input, but Tab can leave; help is purely informational).
- **Sheet.** Mobile-only. Slides up from the bottom. Examples: history panel on <md, settings on <md, embed dialog on <md. Focus is trapped inside the sheet. Esc closes.

This taxonomy matters because it tells the team when a feature needs `aria-modal`, when it needs a backdrop, and when it must lock page scroll. The rule of thumb: if the user must finish the dialog before continuing, it's a modal. If the dialog is an accelerator, it's an overlay. If it's a mobile-context slide-up, it's a sheet.

### 1.6 Toast Conventions

- **Use case.** Confirmation of a successful action the user just took (Copy, Share, Print, Restore, Clear, Export, Theme change). Never for errors (errors render inline).
- **Position.** Bottom-center on <md (out of the way of the thumb's natural reach); top-right on ≥md.
- **Lifetime.** 2.5 s default. 5 s if a follow-up action is offered ("Undo"). Stack max 3; oldest evicted FIFO.
- **Announced.** `aria-live="polite"`. Visually paired with a check icon and text; never icon-only.
- **Actionable.** When a toast has an action ("Undo", "View"), the action is a button, focusable, with a keyboard equivalent.
- **Dismissible.** Click anywhere on the toast dismisses it. Pressing the action's key (e.g., `u` for Undo) dismisses it.

### 1.7 PWA Install — Detailed Behavior

- The install prompt is the browser's native prompt, **not** a custom modal.
- The product exposes a "Install for offline use" button in the top bar (where supported). Clicking it triggers the native prompt.
- The button is hidden when:
  - The app is already installed (`display-mode: standalone`).
  - The browser does not support PWA install (Safari iOS older than 16.4, etc.).
  - The user has dismissed the prompt ≥3 times (we count dismissals in `localStorage` under `handy-tools.pwa.dismissals`).
- The button text is "Install" — never "Get the app" or "Add to your home screen!" The icon (a small box-with-arrow) makes the affordance obvious.
- After successful install, the button is replaced with a quiet "Installed ✓" indicator that fades after 3 s.

### 1.8 Offline Banner — Detailed Behavior

- Detection: `navigator.onLine === false` OR service worker fetch fails.
- Position: footer, full-width on <md, right-aligned badge on ≥md.
- Copy: "Offline. Cached tools still work."
- Color: uses `{colors.semantic.warning}` (DESIGN.md) for the banner background with sufficient contrast; the text is the same tone as always (no shouting).
- Behavior on reconnect: the banner animates out over 200 ms (or instant if reduced motion is on), then a quiet toast: "Back online. N new tools available."
- Per-session dismissal: clicking the dismiss icon hides the banner for the current session; it reappears on next page load if still offline.

---

## 2. Information Architecture

Every surface, what it is for, and how the user gets there. Reachability is exhaustive: every surface must be reachable by keyboard, by click, and (where meaningful) by deep link.

| # | Surface | Reached From | Purpose |
|---|---|---|---|
| 1 | **Home (Grid)** | `/`, top bar logo, `g h` | Lobby. Discover tools. Browse packs. See last-used. |
| 2 | **Home (Search Field)** | `/` focus, `/` key | Filter the grid. Inline, no separate results page. |
| 3 | **Home (Pack Row)** | `/` scroll | Curated workflow packs (Travel, Finance, Study, Developer, Household). |
| 4 | **Tool Page — Header** | `/tools/{slug}`, palette selection | Tool name, one-line description, breadcrumb to pack. |
| 5 | **Tool Page — Inputs** | Tool page | The work area. Form or calculator controls. |
| 6 | **Tool Page — Result Tile** | Tool page | Output of the most recent computation. Primary success state. |
| 7 | **Tool Page — History** | Tool page sidebar (≥md) or sheet (<md), `h` key | Last 10 inputs. Per-tool cap, local-only. PRD §4.1 rubric #7 is authoritative. |
| 8 | **Tool Page — Sample Data** | Tool page "Try an example" link | Pre-fill inputs with a worked example. |
| 9 | **Tool Page — Copy** | Result tile copy button, `⌘+C` when tile focused | Clipboard write, toast confirmation. |
| 10 | **Tool Page — Share** | Result tile share button, `s` key | Native share sheet OR copy permalink. |
| 11 | **Tool Page — Print** | Result tile print button, `p` key | Browser print dialog, print-stylesheet engaged. |
| 12 | **Tool Page — View Source** | Tool page footer link | Inspect the source HTML of the tool (trust signal). |
| 13 | **Tool Page — Embed Snippet** | Tool page share menu → "Embed" | Copy iframe snippet for third-party sites. |
| 14 | **Pack Page** | `/packs/{slug}`, `g p` | List of tools in the pack, with one-line descriptions. |
| 15 | **Settings Modal** | Top bar gear, `g s` | Theme, locale, RTL, reduced motion, data export/import. |
| 16 | **Command Palette** | `⌘K` / `Ctrl+K` / `/` | Search, jump, run actions. |
| 17 | **Keyboard Help Overlay** | `?`, top bar `?` | Cheat sheet grouped by surface. |
| 18 | **`/privacy`** | Footer, palette | Plain-language privacy statement. What we collect (nothing). |
| 19 | **`/quality`** | Footer, palette | The 10-criterion quality contract and current per-tool scores. |
| 20 | **`/about`** | Footer, palette | Project origins, license, how to contribute. |
| 21 | **`/changelog`** | Footer, palette | Release notes, newest first. |
| 22 | **`/404`** | Any unknown path | Helpful recovery: search box, top 9 tools, "did you mean…" if a near-match exists. |
| 23 | **`/offline`** | Service worker intercepts when offline + requested page not cached | Friendly dead-end with cached tools listed. |

**Information density rule.** No surface carries more than seven primary affordances above the fold on mobile. If a tool needs more, group under "More" or move to overflow.

**Breadcrumbs.** Tool pages always show: `Home → Pack (if any) → Tool`. Pack is omitted when the tool is not in a pack.

### 2.1 Navigation Graph

The surface graph is intentionally shallow. Maximum depth is 3 (Home → Tool Page → Settings Modal sub-section). The Command Palette cuts across all surfaces — it's the express elevator.

```
                                 ┌──────────────┐
                                 │ Command      │
                                 │ Palette (⌘K) │──────┐
                                 └──────────────┘      │
                                         │             ▼
   ┌──────────┐    click card    ┌──────────────┐   ┌──────────┐
   │   Home   │──────────────────▶│ Tool Page    │   │  404     │
   │   (/)    │   click pack ────▶│ (/tools/x)   │   │          │
   └──────────┘                   └──────┬───────┘   └──────────┘
        │                               │                  ▲
        │ click pack                    │ click breadcrumb │
        ▼                               ▼                  │
   ┌──────────┐                   ┌──────────────┐        │
   │ Pack Page│                   │ History      │        │
   │ (/p/x)   │                   │ Panel        │        │
   └──────────┘                   └──────────────┘        │
                                        │                  │
        ┌───────────────────────────────┼──────────────────┘
        ▼                               ▼
   ┌──────────┐                   ┌──────────────┐
   │  /privacy │                   │ Settings     │
   │  /quality │                   │ Modal        │
   │  /about   │                   │ (g s)        │
   │  /changelog                  └──────────────┘
   └──────────┘
```

### 2.2 Tool Slugs

Every tool has a stable URL slug, kebab-case, that does not change once published. Redirects are used to preserve old slugs if a tool is renamed. Slugs are: `bill-splitter`, `compound-interest`, `unit-converter`, `json-formatter`, `base64`, `url-encoder`, `uuid-generator`, `password-generator`, `lorem-ipsum`, `markdown-preview`, `diff-checker`, `word-counter`, `character-counter`, `case-converter`, `color-picker`, `image-resizer`, `image-compressor`, `qr-generator`, `barcode-generator`, `text-diff`, `csv-viewer`, `json-to-csv`, `csv-to-json`, `regex-tester`, `html-formatter`, `css-formatter`, `js-formatter`, `sql-formatter`, `xml-formatter`, `timestamp-converter`, `cron-parser`, `jwt-decoder`, `hash-generator`, `hmac-generator`, `percent-calculator`. The 34th is reserved for an "All tools" aggregator when needed.

### 2.3 Pack Composition

| Pack | Tools | Tagline |
|---|---|---|
| **Travel** | Bill Splitter, Unit Converter, Currency Converter (v1: rates are static, clearly labeled "Reference rates"), Time Zone Converter | "For the road, the flight, the family trip." |
| **Finance** | Compound Interest, Loan Amortization, Percent Calculator, Tip Calculator, Salary Calculator (after-tax) | "For the numbers behind a decision." |
| **Study** | Word Counter, Character Counter, Citation Formatter, Markdown Preview, Flashcard Generator | "For essays, notes, exams." |
| **Developer** | JSON Formatter, Base64, JWT Decoder, Regex Tester, Hash Generator, UUID Generator, Cron Parser, Timestamp Converter, HMAC Generator | "For the bits that don't need a SaaS subscription." |
| **Household** | Unit Converter, Percent Calculator, Tip Calculator, Bill Splitter, Age Calculator, Date Difference | "For the math of daily life." |

Every pack has ≥3 tools in v1. No pack is a single-tool wrapper.

### 2.4 URL Behavior

- Canonical URLs: `https://handy.tools/`, `https://handy.tools/tools/{slug}`, `https://handy.tools/packs/{slug}`.
- Query params are functional (`embed=1`, `theme=dark`, `lang=ar`) and never required to render the page.
- Trailing slashes are not enforced; both `/tools/json-formatter` and `/tools/json-formatter/` resolve identically (the latter 301s to the former).
- Hash fragments are not used for routing.
- The home page is the only page that is cached as a generic offline fallback; tool pages cache individually as users visit them.

### 2.5 Search Behavior

- Search input is on home only (`/`). On other pages, `/` opens the command palette.
- Search is client-side. Index is built once on load (≤30 ms for 34 tools).
- Search algorithm: case-insensitive, accent-insensitive (Normalize form KD), matches against name + description + tags + pack name. Exact match > prefix > word-boundary > substring > fuzzy (Levenshtein ≤2). Results update on every keystroke.
- Empty query shows all 34 tools in their default order (alpha by default, configurable in Settings).
- Recent tools (last 5 distinct) appear above the grid when query is empty and at least one exists.

### 2.6 Pinned Tools

- Users can "pin" up to 9 tools to a top row on home. Pin/unpin is a star icon on each Tool Card.
- Pinned state is stored in `localStorage` under `handy-tools.pins`.
- Pinning does not change tool order in the rest of the grid; pinned tools appear in addition, in pin order.
- Pin state is part of the exportable JSON (Settings → Data → Export).

### 2.7 404 Behavior — Detailed

- Unknown path → `/404`. The 404 page:
  - Says plainly: "That tool doesn't exist."
  - Includes a search box pre-focused.
  - Lists the 9 most-used tools.
  - If the unknown path contains a near-match (Levenshtein ≤3 against any tool slug), shows a "Did you mean {tool}?" link.
  - Never auto-redirects.
- Server returns HTTP 404, not 200. Crawlers and SEO are honest.

---

## 3. Voice and Tone

Handy Tools speaks the way a careful engineer talks to another engineer: precise, brief, unsentimental. The voice is a tool, not a performance.

### 3.1 Posture

- **Restrained.** No exclamation marks. No emojis in product copy. No "We hope you love it!" No "Welcome back, friend!"
- **Technical but plain.** Use the right word. "Permalink" not "shareable magic link." "Service worker" not "offline magic."
- **Honest about limits.** If a tool can't do something, the copy says so plainly. Never oversell.
- **Quiet on success.** A successful copy says "Copied." — not "Awesome! You did it!"
- **Never breathless.** No "🚀 Super-fast!" No "🔥 Powerful!" Trust signals describe themselves.

### 3.2 Microcopy Do's and Don'ts

| Context | Do | Don't |
|---|---|---|
| Empty input | "Enter a value to compute." | "Oops! Looks like you forgot something 😊" |
| Validation error | "Enter a number between 1 and 100." | "Uh oh! That's not valid!" |
| Copy success | "Copied." | "Yay! Copied to clipboard 🎉" |
| Tool failure | "Couldn't compute. Check your input." | "Something went wrong — sorry!" |
| Privacy statement | "This tool runs entirely in your browser. No input leaves your device." | "Your data is super safe with us!" |
| Sample data button | "Try an example" | "Click here for a fun demo!" |
| Offline banner | "Offline. Cached tools still work." | "You're flying solo! ✈️" |
| Embed instructions | "Paste this snippet into your site's HTML." | "It's super easy — just embed!" |
| History item | "2 minutes ago · 14 items" | "You computed this a little while ago!" |
| Quality score | "9 of 10 criteria met" | "Almost perfect! Just one tiny thing!" |
| Theme toggle | "Switch theme" (icon + tooltip) | "Make it pretty!" |
| Install PWA | "Install for offline use" | "Get the app for the best experience!" |
| Keyboard shortcut hint | "Press ⌘K to search" | "Tip: use the magic command bar!" |
| 404 message | "That tool doesn't exist. Try searching." | "Oh no! Page not found 😢" |
| Reduced-motion notice | "Reduced motion is on" | "We've slowed things down for you!" |

### 3.3 Sample Strings (canonical)

- **Home page hero (above grid):** "34 free tools. No accounts. No tracking. Works offline."
- **Home page subhead:** "Open one, use it, close the tab. Your inputs never leave this browser."
- **Tool page empty state:** "Enter a value above to see the result."
- **Tool page after compute (one line under result):** "Computed in your browser. No data was sent anywhere."
- **Settings → Privacy:** "We do not collect analytics, telemetry, or inputs. This statement is enforceable: the source is public."
- **Settings → Data:** "Export your history and preferences as a single JSON file. Import it on another device."
- **Quality page lede:** "Each tool must meet 8 of 10 criteria before it ships. Here is the scorecard."
- **Embed dialog:** "This snippet loads the tool from handy.tools. Visitors' inputs stay in their browsers."
- **Command palette placeholder:** "Search 34 tools or type a command"
- **Command palette no matches:** "No tools match. Try a shorter query, or press ? for shortcuts."
- **Offline toast:** "You're offline. 28 tools are still available."
- **PWA install prompt:** "Install Handy Tools. Uses 0 KB of your data plan."
- **Toast after print:** "Print dialog opened."
- **Toast after share:** "Share sheet opened." (or "Permalink copied.")
- **Footer line:** "Source available. No accounts. No cookies. No tracking."

### 3.4 Voice on Error

Errors are a test of voice. When something fails:
- **Name the failure in plain terms.** "Couldn't parse the URL." Not "An error occurred (E_PARSE)."
- **Suggest the next step when one exists.** "Check the format: it should start with `https://`."
- **Never blame the user.** Not "You entered an invalid value." Instead: "That value isn't a number."
- **Never apologize more than once per session.** One apology is enough. After that, be matter-of-fact.

### 3.5 Voice on Privacy

The privacy surface uses voice deliberately. We are stating facts, not reassuring. Every privacy statement should pass the "show this to your engineer" test.

**Good:**
- "This tool runs entirely in your browser. Network requests: zero."
- "Your input is processed by JavaScript on this page. It is not sent to any server."
- "History is stored in this browser's `localStorage`. Clearing browser data clears history."
- "No analytics. No cookies. No fingerprinting. The source is public; you can audit it."

**Bad:**
- "We take your privacy seriously!" (Unfalsifiable)
- "Bank-level encryption." (Misleading — there's nothing to encrypt because nothing leaves)
- "Your data is in safe hands." (Vague)
- "Trust us." (Never)

### 3.6 Voice on Performance

When the product is fast, we don't say "blazing fast." We just are fast. When the product can't be fast, we say so.

**Good:**
- "Cached after first use. Loads in <80 ms."
- "Reduced motion is on. Animations are off."
- "This tool is heavy. Loading (180 KB)."

**Bad:**
- "Lightning-fast calculations!"
- "Optimized for speed!" (Tautological)
- "🚀 Super-quick!" (Breathless)

### 3.7 Voice on Updates & Changelog

Changelog entries are written in past tense, declarative, and concrete. They never oversell.

**Good:**
- "Added JSON Formatter."
- "Fixed: Bill Splitter no longer drops the trailing zero on whole-dollar splits."
- "Improved keyboard navigation in the command palette."
- "Reduced shell CSS from 32 KB to 28 KB."

**Bad:**
- "🎉 Huge new update!"
- "We've been working hard to bring you..."
- "Say hello to the amazing new..."
- "We think you're going to love this!"

---

## 4. Component Patterns (Behavioral)

Visual specs for these components live in `DESIGN.md`. This section describes *behavior only*.

| Component | Use | Behavioral Rules |
|---|---|---|
| **Button** | Any tappable action: compute, copy, share, submit. | Three variants (primary, secondary, ghost). Primary is reserved for the page's *single* main action. Never two primaries side-by-side. Disabled state is non-interactive and announced as "dimmed" by screen readers, not "disabled" with no explanation. Always typeable (`<button>`, never `<div onClick>`). Activated by Space and Enter. |
| **Input** | Text, number, date, URL, etc. | One input = one field. Labels are always visible (no placeholder-only labels). Validation is inline, below the field, after the user leaves the field or pauses ≥400 ms — never on every keystroke. Numeric inputs accept paste; pasted non-numeric content is rejected silently with a one-line inline message. Inputs commit on Enter and on blur. Escape reverts to last committed value. |
| **Result Tile** | Displays the most recent computed output. | Always present on a tool page, even when empty (with the empty-state copy). Recomputes synchronously on input change for ≤50 ms operations; debounces 150 ms for heavier ones. Shows the *exact* value the user can copy — no formatting surprises. Has a "Computed" timestamp on hover (≥md only) and a permanent "Computed in your browser" footer line. The tile is the page's primary focus target after first compute. |
| **Tool Card** | Home grid entry. | Tappable surface, not a link inside a div. Shows: icon, tool name (one line), one-line description (one line). Long names truncate; long descriptions truncate with ellipsis. No hover-only state. Tap reveals a focus ring on touch. Activated by click, Enter, or 1–9 from palette. |
| **Command Palette** | Search and jump. | Opens within 80 ms of `⌘K`. Input is auto-focused. Results render in ≤20 ms. Two result groups: "Tools" and "Actions" (Settings, View source, etc.). Up/Down navigates; Enter selects; Esc closes; Tab cycles between result groups. Closes on selection or Esc. Never traps focus outside the modal. Recent items appear at the top of "Tools" when query is empty. Fuzzy match scores: exact > prefix > substring > fuzzy. Max 9 visible results before scroll. |
| **Settings Modal** | Preferences. | Opens via gear or `g s`. Sections: Appearance, Locale, Privacy, Data, About. Each section is a sub-view in the modal — no separate routes. Changes apply instantly (theme toggle, RTL toggle). "Export data" produces a JSON file via `Blob` and `a[download]`. "Delete all data" requires a typed confirmation of "delete". Closing the modal never loses unsaved changes — settings auto-save. |
| **History Panel** | Per-tool local history. | Shows last 10 inputs. Each row: timestamp, summary, "Restore" action. Storage: `localStorage` under `handy-tools.history.{slug}`, capped at 10 entries per tool, pruned FIFO. Never synced. Exportable via Settings → Data. "Clear history" is per-tool, with confirmation. Empty state: "No history yet. Compute something and it'll appear here." |
| **Keyboard Help Overlay** | Shortcut reference. | Opens on `?` from anywhere. Grouped by: Global, Home, Tool Page, Palette. Searchable within the overlay (`/` while open). `Esc` closes. Click-outside closes. Never modal in the blocking sense — the rest of the page remains visible and scrollable behind it. |
| **Embed Snippet** | Iframe code for third-party sites. | Shown in a dialog with: snippet, sandboxed iframe attributes visible, "What data crosses the boundary?" link. The snippet is a single `<iframe>` tag. Width and height are configurable via URL params. The embed is self-contained — no external scripts, no fonts loaded across the boundary. |
| **Toast** | Transient confirmation. | Appears bottom-center on <md, top-right on ≥md. Auto-dismisses after 2.5 s. Stacks max 3. `aria-live="polite"`. Dismissible by clicking or by pressing the toast's action key. Used for: Copied, Shared, Printed, Restored, Cleared, Exported. Not used for errors — errors render inline. |
| **Sample Data Link** | Pre-fill worked example. | Visible on every tool page as a text link, never a button — keeps the visual hierarchy focused on inputs. Loads instantly, animates input fill ≤200 ms, scrolls to result tile. |
| **Pack Card** | Home pack row. | Shows: pack name, one-line description, count of tools, "Open pack" affordance. Tools inside the pack appear as a horizontal scroller on <md, grid on ≥md. |
| **Breadcrumb** | Tool page context. | Click each segment to navigate. Tool segment is `aria-current="page"`. |
| **Footer** | Site-wide links and trust signals. | Three rows on ≥md, accordion on <md. Includes: Privacy, Quality, About, Changelog, Source, License. The footer is the only place where dense secondary navigation lives. |
| **Star (Pin) Button** | Toggle pin on a tool. | Pinned tools appear in a top row on home. Star is a toggle button, not a checkbox; `aria-pressed` reflects state. Tooltip: "Pin to home" / "Unpin." |
| **Numeric Stepper** | Number input with +/- buttons. | Buttons are siblings of the input, not children of it. Input is the source of truth; buttons increment/decrement. Holding the button accelerates after 500 ms. Disabled when min/max reached; `aria-disabled`, not `disabled`, so the input remains focusable. |
| **Toggle Switch** | Boolean settings (reduced motion, RTL, telemetry — none of which ship). | Two visible states. Label is always visible. The toggle is the only interactive element; label is not separately clickable. `role="switch"`, `aria-checked` reflects state. Keyboard: Space toggles. |
| **Slider** | Range input. | Native `<input type="range">` with visible value display above. Snap-to-step is immediate. Keyboard: arrows, PgUp/PgDn, Home/End. Live region announces value changes if reduced motion is on. |
| **Tabs** | Grouped settings; in-app tool sub-views. | `role="tablist"`; arrow keys navigate; Home/End jump; selected tab has `aria-selected="true"` and `tabindex="0"`, others `tabindex="-1"`. |
| **Dialog (Embed, Share, etc.)** | Modal or sheet for transient tools. | `role="dialog"`, `aria-modal="true"` for blocking; `role="dialog"` for non-blocking overlays. Focus moves to the dialog heading on open. Esc closes. |
| **Skip Link** | Move past the top bar. | First focusable element on every page; visually hidden until focused. Text: "Skip to main content." |
| **Banner (Offline, Update)** | Persistent or session-level notice. | `role="status"` for neutral (offline, update available). `role="alert"` only for true alerts (a value was lost; clear is needed). Never `role="alert"` for non-urgent toasts. |
| **Color/Theme Indicator** | Theme state display. | Read-only, not interactive. The toggle is a separate component. Used in Settings for users to see the active theme clearly. |
| **"What gets copied?" disclosure** | Transparency for the clipboard. | Hidden by default behind a "?" button on the copy button's `aria-describedby` content. Click to expand. Shows literal copy payload format. |

---

## 5. State Patterns

Every state a surface can be in. The treatment column says what the user sees, hears, and can do.

| State | Surface | Treatment |
|---|---|---|
| **Cold load** | Home | First paint ≤800 ms on 4G. Above-the-fold grid renders with skeletons; below-the-fold lazy-loads. No spinners on cached resources. Service worker warms cache in background after first interaction. |
| **Cold load** | Tool page | Inputs render immediately from HTML. Result tile renders empty-state copy. Sample data link is visible. No "loading…" splash screen — the page is always usable in <100 ms even before JS hydrates. |
| **Cold load** | Tool page (heavy) | For tools that need JS to function (e.g., file-based tools), an inline notice appears: "Loading the calculator (180 KB, cached)." Cached loads show no notice after first visit. |
| **Empty tool** | Result tile | "Enter a value above to see the result." Subtle, low-emphasis copy. No icon, no animation. The empty state must not look like an error. |
| **Empty home search** | Home grid | "No tools match '<query>'. Try a shorter query, or browse all." Browse-all link visible. |
| **Empty history** | History panel | "No history yet. Compute something and it'll appear here." Storage note: "Stored on this device only." |
| **Empty pack** | Pack page | Cannot happen in v1 — every published pack has ≥3 tools. If a pack is empty, the page is unpublished. |
| **Partial input** | Tool page | Result tile shows last valid result with a "(stale)" suffix and a one-line note: "Waiting for the rest of the input." Recomputes when the input becomes valid again. The tile is never blank during partial input — that would feel like a bug. |
| **Validation error** | Input | Inline message below the field, same color as DESIGN.md `--color-danger`. The message is the *fix*, not the problem: "Enter a number between 1 and 100." not "Invalid input." Focus remains on the field; Esc reverts. The submit/primary action is disabled while the error is present. The result tile keeps its last good value. |
| **Success / Copy** | Result tile + Toast | Tile briefly shows a "✓ Copied" inline indicator for 1.2 s; toast says "Copied." Focus stays on the copy button. `aria-live="polite"` announces "Copied" once. |
| **Success / Share** | Tool page | Native share sheet where available; permalink copied otherwise. Toast: "Share sheet opened." or "Permalink copied." |
| **Success / Print** | Tool page | Browser print dialog. Toast: "Print dialog opened." Print stylesheet strips chrome, keeps result tile, adds URL + timestamp footer. |
| **Offline** | Shell + Tool page | Footer banner: "Offline. Cached tools still work." Banner is dismissible for the session. Uncached tools show an offline-specific empty state: "This tool isn't cached. Reconnect to use it the first time." Cached tools are fully functional. The command palette continues to work. |
| **Offline + never visited** | Any tool | Service worker redirects to `/offline` with a list of cached tools. |
| **Keyboard help open** | Overlay | Cheat sheet visible. Underlying page scrollable and interactive. `?` toggles closed. Search within overlay filters by keystroke. |
| **Command palette no matches** | Palette | Single row: "No tools match '<query>'." Below it: keyboard hints ("Try a shorter query" + "? for shortcuts"). No empty illustration. Esc or click-outside closes. |
| **Embed mode** | Tool page (via `?embed=1`) | Hides: top bar (except logo), footer, history panel, share/print buttons. Shows: result tile, inputs, "Powered by handy.tools" link (configurable, default on). The embed is the *tool*, not the site. |
| **Embed mode + offline** | Embedded tool | Shows the same offline notice as the regular tool, plus a "Visit handy.tools" link. |
| **RTL active** | Whole app | All text mirrors. Icons that have direction (arrows, progress bars) mirror too. Tool-specific layouts that assumed LTR (e.g., a horizontal result→inputs flow) get a layout override in RTL. Numeric inputs keep LTR digits (universal UX). |
| **Reduced motion active** | Whole app | All transitions become 0 ms. Result tile updates are still visible (the value changes), but no fill animation, no slide. Focus rings are static, no pulse. |
| **First visit, no preferences** | Home | Theme follows `prefers-color-scheme`. A one-time inline tip near the command palette hint: "Press ⌘K to search. Press ? for shortcuts." Dismissible; remembered per-browser. |
| **PWA installed** | Shell | Top bar install button hides. A small "Installed" indicator (subtle) may appear. |
| **Service worker updating** | Shell | A quiet banner: "Update available. Reload to apply." with a Reload button. Never auto-reloads. |

---

## 6. Interaction Primitives

The product is keyboard-first. Every common action has a shortcut. Every shortcut has a discoverable affordance.

### 6.1 Global Keyboard Map

| Key | Action | Discoverable from |
|---|---|---|
| `⌘K` / `Ctrl+K` | Open command palette | Top bar search icon, hint on home |
| `/` | Focus home search (on home) or open palette (elsewhere) | Home placeholder text |
| `?` | Toggle keyboard help overlay | Top bar `?` link |
| `Esc` | Close any overlay / palette / modal; revert input | Universal |
| `g h` | Go to Home | `?` overlay |
| `g p` | Go to Packs | `?` overlay |
| `g s` | Open Settings | `?` overlay |
| `g q` | Go to Quality page | `?` overlay |
| `g v` | Go to Privacy page | `?` overlay |
| `1`–`9` | Jump to top result in palette | Palette hint |
| `↑` / `↓` | Navigate palette / history | Contextual |
| `Enter` | Primary action: select palette item / submit input / restore history item | Contextual |
| `Tab` / `Shift+Tab` | Move focus forward / backward | Universal |
| `s` | Share current result (tool page) | Tool page hint |
| `c` | Copy current result (tool page, when tile focused) | Tool page hint |
| `p` | Print current result (tool page) | Tool page hint |
| `e` | Open embed dialog (tool page) | Tool page hint |
| `h` | Toggle history panel (tool page) | Tool page hint |
| `t` | Toggle theme | `?` overlay |
| `r` | Restore last history item (tool page) | History panel |
| `Space` | Activate focused button | Universal |

Keys are case-insensitive. Modifier combinations use `⌘` on macOS, `Ctrl` elsewhere; the app shows `⌘` only on macOS and `Ctrl` otherwise.

### 6.2 Tab Order Rules

1. **Skip chrome.** Skip-to-content link is the first focusable element on every page; pressing Tab once from page load jumps past the top bar.
2. **Match reading order.** Tab order matches visual order. Never `tabindex="1"` hacks.
3. **Trap inside modals only when the modal demands it.** Settings modal traps focus. Command palette does *not* trap — the rest of the page is still useful behind it. Keyboard help overlay does *not* trap.
4. **No positive `tabindex` values.** Only `0`, `-1`, and absence.
5. **Focus return.** Closing a modal returns focus to the invoking element. Closing the palette returns focus to whatever was focused before it opened.
6. **No focus on decorative elements.** SVG icons that aren't interactive are `aria-hidden` and not focusable.

### 6.3 Mouse and Touch Rules

- **Tap targets ≥44×44 px** (mobile). Visual padding can be smaller; the hit target is not.
- **Hover affordances never carry the only signal.** A button that is invisible without hover is a bug. Use persistent labels on touch.
- **No hover-only menus on touch.** All menus also have a tap-to-open trigger.
- **No drag-to-reorder in v1.** Tool order is fixed by sort key.
- **No infinite scroll.** The home grid shows all 34 tools at once (or paginated to 18 + "show all"). History caps at 20.
- **No carousels in v1.** Pack rows are horizontal scrollers on <md with visible scroll affordance (gradient edge), not auto-rotating carousels.
- **Long-press has no special meaning.** Avoids accidental activation; standard tap only.
- **Right-click context menu is not customized.** Browser default, except on the result tile where "Copy" is added via a non-modal small popover.

### 6.4 Banned Patterns

- **No hover-only affordances.** If it isn't visible on touch, it doesn't exist.
- **No infinite scroll.** Ever.
- **No modal stacks > 1.** Closing one must not reveal another. Settings modal is the only modal that exists; everything else is overlay (palette, help).
- **No drag-to-reorder in v1.** Tool grid order is fixed.
- **No dark patterns.** No pre-checked "send me updates." No "are you sure you want to leave?" No notification permission prompts before the user has used the product. No cookie banner (because there are no cookies).
- **No celebratory microcopy.** No "🎉", no "Awesome!", no "You did it!", no exclamation marks in success messages.
- **No animations on first compute.** The first result tile render is instant. Animations only on subsequent updates, and only when reduced-motion is off.
- **No pop-ups, pop-unders, interstitials.** Ever.
- **No spinner on cached loads.** Cold first load shows skeletons; warm loads show instant content.

### 6.5 Shortcut Discoverability — Rules

- **Every shortcut used in flow must be discoverable.** If a shortcut exists, it must appear:
  - In the `?` overlay (full list, grouped).
  - As a tooltip on the relevant button (e.g., the copy button tooltip says "Copy (c)").
  - In the top bar / footer where the action lives.
- **No orphan shortcuts.** A shortcut is never the *only* way to do something; the mouse/touch path must also exist.
- **The `?` overlay is the canonical reference.** Tooltips are reminders; the overlay is the spec.
- **Conflict handling.** Browser reserved shortcuts (`⌘T`, `⌘W`, `⌘R`, `⌘L`, etc.) are never intercepted. Where conflict is possible (e.g., `/` is "find on page" in some browsers), the behavior is contextual: `/` opens palette only when no input is focused; if an input is focused, the keystroke goes to the input.
- **Cheat sheet refresh.** New shortcuts require a corresponding entry in the `?` overlay before they ship.

### 6.6 Focus Behavior Specifics

- **First Tab on a page** goes to the "Skip to main content" link, then to the first interactive element in the main region. The top bar is reachable by Shift+Tab from the main region.
- **Form focus rings** appear on `:focus-visible` only — never on mouse click. The reduced-motion setting affects ring animation, not presence.
- **Sticky / focus-trapping contexts.** Settings modal traps focus. Palette does not (overlay). Help overlay does not (overlay). History sheet on <md traps focus inside the sheet.
- **Focus restoration.** Closing any trap or overlay restores focus to the element that opened it. If that element is gone (page navigated), focus moves to the page's `<main>` heading.

### 6.7 Long-Press, Right-Click, and Touch Gestures

- **Long-press:** No special meaning. Avoids accidental activation on touch.
- **Right-click:** Browser default, except on the result tile where a small popover offers "Copy." The popover is keyboard-accessible too (a `⋯` button on the tile).
- **Pinch-zoom:** Allowed everywhere. We never set `user-scalable=no` or `maximum-scale=1`. Accessibility and trust trump any layout control we'd gain.
- **Pull-to-refresh:** Disabled on the shell (overscroll-behavior: contain). Users can refresh via the `?` overlay's "Reload" link or browser refresh.

---

## 7. Accessibility Floor

Behavioral floor. Visual contrast, color tokens, and motion curves live in DESIGN.md. This section governs *behavior* in support of access.

| Requirement | Treatment |
|---|---|
| **WCAG 2.1 AA** | All interactive elements meet AA contrast in both themes. Form fields have labels. Errors are programmatically associated with fields (`aria-describedby`). |
| **Focus rings visible** | Always visible. Never `outline: none` without a replacement. Focus ring color = DESIGN.md `--color-focus`. Ring is ≥2 px and has ≥3:1 contrast against adjacent background. |
| **Reduced motion** | Honors `prefers-reduced-motion: reduce`. All transitions become 0 ms or near-0 ms. Result updates still happen — they just don't animate. Parallax, scroll-linked effects, and large translations are disabled. |
| **Screen-reader announcements** | Live region (`aria-live="polite"`) announces: copy success, restore success, validation errors, offline/online transitions, palette open/close. The result tile's value is announced once after a meaningful change (debounced 500 ms, not on every keystroke). |
| **RTL-safe** | All custom CSS uses logical properties (`margin-inline-start`, `padding-block-end`, etc.). No `left`/`right` in component CSS. RTL toggle in Settings or via `<html dir="rtl">`. Numeric inputs stay LTR-digit even in RTL (universal UX). |
| **Color-independent meaning** | Errors have an icon and text, never color alone. Success states have a check + text. Charts and graphs (if any) use shape + label in addition to color. Result tile updates show a subtle background shift in addition to value change for low-vision users who may not notice text changes. |
| **44 px tap targets** | Every interactive element has a hit target of at least 44×44 px on touch viewports. Visual size may be smaller; padding expands the hit area. |
| **Keyboard parity** | Every action reachable by mouse is reachable by keyboard. Every action reachable by keyboard is reachable by mouse. No exceptions. |
| **No motion-only feedback** | Loading, success, error states each have a text or ARIA announcement in addition to any animation. |
| **Form labels are real labels** | `<label for>` not `placeholder=`. Placeholders are hints, not labels. |
| **Touch gestures have alternatives** | Horizontal scroll on pack rows has arrow buttons on focus. Swipe-to-dismiss is not used. |
| **Tables and lists are real elements** | `<table>` for tabular data; `<ul>`/`<ol>` for lists. ARIA roles are not used to fake semantics that the wrong element provides. |

### 7.1 Screen Reader Behavior — Specifics

- **Command palette.** Implemented as a **WAI-ARIA combobox 1.1** with a single `role="listbox"` and `role="option"` children. The input owns `aria-activedescendant` pointing at the currently highlighted option. Tab/Shift+Tab cycle only inside the palette while it is open; Esc closes and returns focus to the calling element. Result count announced via `aria-live="polite"`: "9 tools, 3 actions." No focus trap — the rest of the page remains reachable behind the palette.
- **Result tile.** When the value changes meaningfully (not on every keystroke), an `aria-live="polite"` region announces: "Result: 42." When the value is cleared, it announces: "Result cleared."
- **History panel.** Each row is a button with full content: "2 minutes ago: 14 items, $240 total. Restore." Not just a timestamp.
- **Settings modal.** Focus moves to the modal heading on open. Modal has `role="dialog"`, `aria-modal="true"`, `aria-labelledby`. Tab cycles within modal sections. Esc closes.
- **Keyboard help overlay.** Has `role="region"`, `aria-label="Keyboard shortcuts"`. Search within it is `<input type="search">`.

### 7.2 Internationalization & RTL

- All strings live in a single `i18n.js` table; no string is hardcoded in HTML.
- First release ships with `en` and `ar`. RTL is a setting, not a separate build.
- Numbers and dates format via `Intl.NumberFormat` and `Intl.DateTimeFormat` using the user's locale.
- Tools that accept Unicode (text counters, JSON formatters) accept any script and direction; they do not assume Latin.

---

## 8. Responsive & Platform

Three breakpoints. The product is mobile-first: layout decisions start at <md and only add complexity at md and lg.

### 8.1 Breakpoints

| Tier | Range | Posture |
|---|---|---|
| **<md** | 360–767 px | Single column. One thumb. Sticky command palette hint. |
| **md** | 768–1023 px | Two-column on tool pages. Compact home grid (3 columns). |
| **≥lg** | 1024+ px | Three-column home grid. Tool pages gain sidebar for history. Keyboard-first posture is most natural here. |

### 8.2 Per-Surface Behavior

#### Home Grid
- **<md:** 2 columns. Sticky search bar at top. Pack rows are horizontal scrollers below the grid. No sidebar.
- **md:** 3 columns. Search in top bar (not sticky). Pack rows are 3-up tiles.
- **≥lg:** 4 columns. Search in top bar. Packs and tools in distinct sections. Recent tools appear above the grid when set.

#### Tool Page
- **<md:** Inputs occupy full width. Result tile stacks below inputs. History is a slide-up sheet (`h` toggles). Share/print/embed live under a "⋯" menu. No sidebar.
- **md:** Inputs left, result tile right (50/50). History is a sidebar (sticky). Share/print/embed are inline buttons.
- **≥lg:** Inputs left (~40%), result tile center (~40%), history right (~20%). All actions inline. Sample data link is a sidebar card.

#### Command Palette
- **<md:** Modal sheet from bottom, 90 vh. Input at top. Single-column results. Backdrop dims the page.
- **md:** Centered modal, 560 px wide, max 70 vh tall.
- **≥lg:** Centered modal, 640 px wide. Two-column results (Tools | Actions) when both are non-empty.

#### Settings Modal
- **<md:** Full-screen sheet. Sections as accordions.
- **md / ≥lg:** Centered modal, 560 px wide (DESIGN.md `spacing.dialog`). Sections as left-nav + right-content.

#### Embed Mode
- All breakpoints: identical. Embed is a fixed iframe-sized surface; the host page controls its dimensions.
- Embed never has its own responsive variants; the *host* page does.

#### Keyboard Help Overlay
- All breakpoints: centered card, 640 px wide, max 80 vh. Scrolls internally on small viewports.

#### Footer
- **<md:** Accordion (3 sections collapsed).
- **md / ≥lg:** Three columns, expanded.

### 8.3 PWA Behavior

- **Install prompt.** Shows after the user has used the product ≥1 time AND has dismissed any prior prompt ≥7 days ago. Never interrupts first-visit hero.
- **Splash.** Brand wordmark on `--color-surface` background, no logo animation. Loads in ≤300 ms after splash.
- **Offline indicator.** Persistent banner in footer when offline; dismissible per session.
- **Update prompt.** "Update available. Reload to apply." Never auto-applies mid-session.
- **Storage budget.** Service worker cache budget: 5 MB. Per-tool code is cached individually; failed caching falls back to network.

---

## 9. Key Flows

Four protagonists, four flows. Each flow lists numbered steps, the emotional climax (the moment trust is won or lost), and the failure mode (what we do when something goes wrong).

### 9.1 UJ-1: Priya — Split a Bill on Mobile

**Persona:** Priya, 28, just finished dinner with friends. She has the bill total, the number of people, and a tip percent. She needs to copy the per-person amount and paste it into WhatsApp.

**Trigger:** Opens handy.tools on her phone.

**Steps:**
1. Tap the address bar, type `handy.tools`. Page loads in <800 ms.
2. Sees the home grid. Tap the search field (or press `/`). Types "split". The Bill Splitter card appears.
3. Tap the card. Tool page loads instantly. Result tile shows the empty-state copy.
4. Taps the "Try an example" link. Inputs fill with `127.40 / 4 / 18%`. Result tile shows `$37.59 per person`. The fill animation is subtle (per-design), respecting reduced motion if Priya has it on.
5. Priya taps the total field, clears it, types `152.00`. The number of people and tip stay. Result tile updates to `$44.84 per person`.
6. She taps the copy button on the result tile. Toast appears: "Copied."
7. She opens WhatsApp, taps the message field, long-presses, paste. The number arrives exactly as shown — no formatting surprise.

**Climax.** The moment the paste in WhatsApp matches the on-screen value *to the cent*. That moment is the entire product.

**Failure modes.**
- *Clipboard write fails (older browsers):* Show an inline fallback: "Couldn't copy automatically. Tap to select and copy manually." Long-press-to-select fallback is always present below the copy button.
- *User pastes in WhatsApp and the number has hidden formatting:* The copy payload is always plain text. We never copy rich text. The "What gets copied" affordance is one click away on the result tile.
- *Network drops mid-flow:* Bill Splitter runs entirely in-browser. No failure possible from network.

### 9.2 UJ-2: Marco — Embed a Widget on His Blog

**Persona:** Marco, 34, runs a personal finance blog. He wants to embed a "Compound Interest Calculator" so readers can play with his examples.

**Trigger:** Discovers Handy Tools, lands on the Quality page, sees "9 of 10 criteria met."

**Steps:**
1. Marco opens the Compound Interest tool. Plays with it for a minute.
2. Clicks the "Share" button on the result tile. Sees options: "Copy link," "Share," "Embed."
3. Clicks "Embed." A dialog appears with:
   - A single `<iframe>` snippet.
   - Width and height inputs (default 480×420).
   - A "What data crosses the boundary?" link that explains: nothing crosses — the iframe is self-contained.
4. Marco copies the snippet, pastes it into his blog post HTML.
5. His readers see the calculator, fully functional, on his blog. No third-party scripts. No cookies set on his domain. The iframe shows "Powered by handy.tools" in the corner (configurable; Marco leaves it on).

**Climax.** The moment Marco inspects the network tab on his blog post and sees *zero* outbound requests from the embed beyond the iframe itself. That's the trust moment.

**Failure modes.**
- *Marco's site has a strict CSP that blocks iframes:* Show a one-line warning in the embed dialog before he copies: "If your site blocks iframes, this won't load. Here's a direct link instead." Always offer the direct link.
- *The iframe loads but a tool fails inside it:* The same inline error state shows inside the iframe, with a "Open in handy.tools" link.
- *Marco wants to remove the "Powered by" link:* The setting is exposed as a URL parameter (`?badge=0`), with a clear note that supporting attribution is appreciated.

### 9.3 UJ-3: Aisha — Daily Dashboard, PWA, Theme, JSON Export

**Persona:** Aisha, 41, uses Handy Tools as a morning dashboard. Opens the home page daily, runs a few tools (unit converter, JSON formatter, base64), and exports her history once a week.

**Trigger:** Opens handy.tools in her browser, hits "Install" from the top bar.

**Steps:**
1. Aisha clicks "Install." Browser shows the install prompt. She accepts. Handy Tools appears on her home screen.
2. Each morning, she taps the icon. Splash shows briefly. Home loads instantly (cached).
3. She uses three tools in sequence. Each computes locally. History fills silently.
4. She opens Settings (`g s`). Switches theme to dark. The whole app re-skins in <100 ms.
5. Once a week, she opens Settings → Data → Export. A JSON file downloads with her history, preferences, and pinned tools. She saves it to her notes app.
6. On a new device, she imports the JSON via Settings → Data → Import. Everything reappears.

**Climax.** The moment the import on her new device exactly reproduces her old setup — same theme, same history, same pinned tools. That proves "your data is yours."

**Failure modes.**
- *Export produces a malformed file (impossible in v1, but planned for):* Validate the imported JSON against a schema; if invalid, show: "This file isn't a Handy Tools export. Try another file."
- *Theme toggle flickers:* Theme switch is applied to `<html>` before paint; no flicker is acceptable.
- *PWA install fails silently:* Show a tooltip explaining why (browser policy, private mode, etc.). Never claim success without verification.

### 9.4 UJ-4: Jamal — Offline PWA on a Flight

**Persona:** Jamal, 22, developer. On a 6-hour flight with no Wi-Fi. Wants to use Handy Tools because his IDE doesn't have a JSON formatter.

**Trigger:** He opened handy.tools before boarding; the service worker cached the tools he used.

**Steps:**
1. Mid-flight, Jamal opens handy.tools. Service worker serves the shell from cache. Home loads instantly.
2. The footer banner shows: "Offline. Cached tools still work."
3. He opens the JSON Formatter. Inputs work. Result tile works. History works. Everything is local.
4. He opens a tool he never visited (e.g., UUID Generator). Service worker redirects to `/offline` with a list of cached tools.
5. He goes back to JSON Formatter, finishes his work. Copies the result.
6. On landing, the banner disappears automatically when connectivity returns. A quiet toast: "Back online. 12 new tools available."

**Climax.** The moment the JSON Formatter works in the air, with no network indicator, no degraded state. It's just a tool.

**Failure modes.**
- *Service worker hasn't cached a tool Jamal needs:* `/offline` page lists cached tools and offers a "Notify me when online" option (which becomes a single banner on next visit).
- *Browser evicted the cache (storage pressure):* On next online visit, the shell is re-cached silently. Tools re-cache as he uses them.
- *User disables JavaScript:* The shell renders with a noscript message: "Handy Tools needs JavaScript to compute. The source remains viewable."

### 9.5 Flow-Level Rules

A few rules that apply to every flow, regardless of protagonist:

- **First-time actions show a hint.** On the user's first ever use of a tool, a quiet one-time tooltip on the result tile says: "Click to copy. Press `c`." Subsequent visits show no hint. State stored in `localStorage` under `handy-tools.hints.seen`.
- **History is opt-out, not opt-in.** The first time the user lands on a tool, a one-line inline notice above the history panel says: "History is stored on this device only. Turn it off in Settings." Default: on.
- **Reversible actions are reversible.** Copy can be undone by the system clipboard history (browser-level). Restore from history is reversible by simply re-editing. Clear history is reversible within 5 s via an Undo toast.
- **Irreversible actions get a typed confirmation.** "Delete all data" and "Clear all history" both require typing the word "delete" to confirm. No friction for reversible things; friction for irreversible things.
- **No flow takes more than 3 taps to compute.** From landing on the product to seeing a result: 3 taps maximum on mobile. Sample data + 1 tap on the example card + 1 tap on the input to edit.
- **No flow requires scrolling to discover a primary action.** Primary actions are within the first 1.5 viewports on <md. Secondary actions can require scroll.
- **Flows are tested at 200% zoom.** Every primary path remains usable when the user has zoomed the page to 200% (an accessibility stress test, not just a settings toggle).

---

## 10. Embed Mode

Embed mode is its own surface, with its own contract. The host page is the user; the iframe is the product; the visitor is the end-user of the host.

### 10.1 URL Contract

A tool is embeddable via `https://handy.tools/tools/{slug}?embed=1`. Optional params:

| Param | Default | Behavior |
|---|---|---|
| `embed=1` | off | Activates embed mode. |
| `width` | 480 | Inline width attribute on iframe. |
| `height` | 420 | Inline height attribute on iframe. |
| `badge=0` | on | Hides "Powered by handy.tools" badge. |
| `theme` | `auto` | `light` / `dark` / `auto`. |
| `lang` | browser | Locale override. |

### 10.2 What Is Hidden

In embed mode, the following are **removed** from the DOM (not just visually hidden):
- Top bar (except brand wordmark if `badge=1`)
- Footer
- Command palette trigger UI (palette is still keyboard-accessible via `⌘K`)
- History panel trigger
- Share / Print / Embed buttons
- Settings modal trigger
- Breadcrumb
- "View source" link
- Keyboard help overlay trigger

### 10.3 What Survives

- **Inputs.** Always visible, always functional.
- **Result tile.** Always visible, always functional.
- **Sample data link.** Visible — it helps visitors understand the tool.
- **Theme toggle.** Tiny corner icon if `badge=1`. The visitor may want dark mode.
- **"Powered by handy.tools" badge.** Small text in the corner, `<a>` linking to the tool's main page. Default visible. Hidden only when `badge=0`.
- **Error states.** Same as the full app, plus a "Open in handy.tools" recovery link.
- **Reduced-motion and RTL.** Both propagate from the host via the iframe.

### 10.4 Behavior

- The embed is a **complete, self-contained instance** of the tool. It does not phone home, does not load any external scripts, does not call out for fonts or analytics.
- The embed respects the host's color scheme by default but allows `theme=` override.
- The embed never prompts the visitor. No notifications, no installs, no modals. The tool is the tool.
- The embed's accessibility behavior is identical to the full app: WCAG AA, keyboard, screen reader.
- If the tool encounters a state it can't handle (e.g., the file-based tools in v1 may have limited embed use), the embed renders a small inline message and a link to the full app.
- The embed loads in ≤500 ms on 4G (cold cache) and ≤80 ms (warm cache).

### 10.5 postMessage Contract (Capabilities, Not Transport)

The embed does not currently use `postMessage` to talk to the host. The contract defined here is **forward-compatible**: if a future embed feature needs to communicate across the boundary, this is what it is allowed to do.

**Outbound (embed → host) capabilities the embed may declare:**

| Capability | Description |
|---|---|
| `embed.ready` | Embed is interactive. |
| `embed.result` | A new result has been computed. Payload: `{ value, kind, format }`. Format is `plain` for v1. |
| `embed.height` | Embed has resized. Payload: `{ height }`. |
| `embed.theme` | Embed has switched theme. Payload: `{ theme }`. |
| `embed.error` | Embed has hit an error state. Payload: `{ code, message }`. |

**Inbound (host → embed) capabilities the embed will accept:**

| Capability | Description |
|---|---|
| `host.setValue` | Set input value. Payload: `{ field, value }`. The embed respects this if the field is valid; otherwise it ignores and posts `embed.error`. |
| `host.setTheme` | Force theme. Payload: `{ theme }`. |
| `host.getResult` | Request current result. Embed replies with `embed.result`. |
| `host.resize` | Resize the embed viewport. Payload: `{ width, height }`. Embed re-flows. |

**Rules:**
- The embed never reads from the host document, cookies, or storage. It cannot.
- The embed never writes to the host document, cookies, or storage.
- All communication is opt-in: the embed will not post messages unless the host includes `?postmessage=1` in the embed URL.
- No message carries PII. No message identifies the visitor. The only identifier ever sent is the tool slug (e.g., `compound-interest`).
- Message origin verification is enforced on both sides. The embed only accepts messages whose `event.origin` matches the host's configured origin (set via the embed snippet).
- The contract is documented in the embed dialog: "If you want two-way communication, append `?postmessage=1` and configure the origin."

### 10.6 Embed Trust Statement

The embed dialog always shows:

> This snippet loads the tool from handy.tools inside an iframe. Visitor inputs stay inside the iframe — they are not sent to handy.tools, your server, or any third party. You may host this snippet on any site. The iframe is sandboxed. The source is public.

---

## Appendix A — Anti-Goals (for the team)

These are behaviors we have decided **not** to do, even when they would be easy. Each is a test: if a feature idea would require one of these, the idea is wrong.

- **No accounts.** No login. No sync. No cross-device state without explicit JSON export/import.
- **No analytics or telemetry.** No third-party scripts. No first-party beacons. The privacy statement is enforceable because the code is auditable.
- **No ads.** The product is free because it is small, not because it sells attention.
- **No notifications.** No push, no email, no in-app banners.
- **No social features.** No comments, no sharing to social, no "refer a friend."
- **No AI features in v1.** No summarization, no autocomplete, no chat. Tools compute; humans decide.
- **No native wrappers.** Web is the platform.
- **No framework.** Vanilla is the architecture.
- **No infinite scroll.** Density is honest; pagination is fine.

---

## Appendix B — Versioning This Document

`EXPERIENCE.md` is versioned alongside `DESIGN.md`. When either changes, the other is reviewed for impact. Changes to keyboard shortcuts are breaking; bump major. Changes to copy or state treatment are minor. Additions to banned patterns are major.

When in doubt between two experience choices, the tiebreaker is: **which one would make a careful engineer more likely to recommend the product to a friend?** That is the choice.