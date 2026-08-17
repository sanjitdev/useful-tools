---
name: Handy Tools — Discovery Engine (Experience Spine)
status: final
created: 2026-08-17
updated: 2026-08-17
sources:
  - C:\ZDrive Folders\Projects\useful-tools\_bmad-output\planning-artifacts\prds\prd-discovery-engine-2026-08-17\prd.md
  - C:\ZDrive Folders\Projects\useful-tools\_bmad-output\planning-artifacts\architecture\architecture-discovery-engine-2026-08-17\ARCHITECTURE-SPINE.md
  - C:\ZDrive Folders\Projects\useful-tools\_bmad-output\brainstorming\brainstorm-discovery-engine-2026-08-17\brainstorm-intent.md
  - C:\ZDrive Folders\Projects\useful-tools\_bmad-output\planning-artifacts\ux-designs\ux-useful-tools-2026-07-31\EXPERIENCE.md
  - C:\ZDrive Folders\Projects\useful-tools\_bmad-output\planning-artifacts\ux-designs\ux-discovery-engine-2026-08-17\DESIGN.md
inherits-from: ux-useful-tools-2026-07-31/EXPERIENCE.md
epic: 10
ujs-covered: [UJ-5, UJ-6, UJ-7, UJ-8]
---

# EXPERIENCE — Discovery Engine (Epic 10)

## 0. Scope

This document is the behavioral spine for the Discovery Engine. It defines the four user journeys (UJ-5–8 from the Discovery PRD), the key flows that realize them, the surface breakdown (pages + components + state), and the keyboard/AT/external rules for the new chrome. It inherits the structure and conventions of the master `EXPERIENCE.md` but only describes what is new in Epic 10.

## 1. Glossary (additions to the project glossary)

- **Discovery lane** — the home-grid lane that renders the 6 MVP quizzes as cards, between the 5 utility-pack lanes and the free-form tool grid.
- **Quiz page** — `tools/packs/discovery/<quiz>/index.html`; renders one quiz with the standard chrome.
- **Question card** — a single-quiz-step; one question per card, with Skip / Next / progress / focus trap.
- **Result card** — the post-quiz chrome (archetype + trait bars + blind spot + Share / Challenge / Tools for you).
- **OG share image** — a static SVG per archetype per quiz, baked at content-build time, used for Twitter/iMessage/OG unfurls.
- **Challenge URL** — a fragment-state URL ≤ 80 chars (`#seed=<base36>&spec=<quiz>@<version>`).
- **Compatibility card** — the side-by-side archetype comparison rendered when a Challenge URL is completed by the second user.
- **Tools for you** — the section at the bottom of a result card that surfaces 1–3 existing utility tools the archetype points to (the strategic router surface).
- **Disclosure** — the (small, unobtrusive) annotation on every Discovery page that declares "no analytics, no PII, no third-party libs." Two lines; same footer copy in every language.

## 2. Capability Map (the 4 new surfaces + 1 inherited)

| Surface | Trigger | Realizes | Owner module | Reduced-motion | Keyboard | A11y role |
|---|---|---|---|---|---|---|
| Discover Me lane | Home-grid render | UJ-5 entry, UJ-7 entry | existing pack-page renderer (Story 6.2) | per inherited settings | Tab cycles cards; Enter launches | `region` + `aria-label="Discovery"` |
| Quiz page | URL navigation or Discover Me tile click | UJ-5, UJ-6, UJ-7 (one quiz per page) | `packs/discovery-loader.js` + 5 runtime modules | per-card reduced-motion fallback | Tab within card; Esc pops one card; 1-9 picks option; Enter advances | `region` + `aria-live="polite"` |
| Result card | Last question completion (or Skip path) | UJ-5 reveal, UJ-6 receiver side | `HT.results.render()` | blind-spot reveal instant | Tab → Share → Challenge → Tools for you | `region` + `aria-label="Result"` |
| Compatibility card | Second user completes Challenge URL | UJ-6 climax | `HT.results.render()` (variant: `compatibility`) | instant | Tab cycles the three breakdown rows | `region` + `aria-label="Compatibility result"` |
| Tools for you | Rendered after result card | UJ-7 climax (cross-pack router) | `HT.results.render()` instantiates the existing tool-card component | n/a | Tab cycles the 1-3 tool cards | `region` + `aria-label="Recommended tools"` |

The fifth surface (`Tools for you`) is shared with the inherited components; it does not introduce a new module. It is listed for completeness.

## 3. Key Flows

### 3.1 Flow UJ-5 — Sanjit takes a personality quiz and shares it

**Trigger.** Sanjit clicks the "What Kind of Person Are You, Really?" tile on the Discover Me lane.
**Steps.**
1. **Landing.** `packs/discovery-loader.js` reads `data.json`, picks the `[scoring, results, challenge]` modules, mounts the first question card.
2. **Question loop (12 steps).** Each card: question label, prompt, 2–6 options, Skip / Next, progress bar. Skip advances without writing the answer; Next with a selection writes the answer and advances.
3. **Reduced-motion path.** Animations disabled; swaps are instant; trait-bar fills are instant on the result card.
4. **Reveal.** `HT.results.render(mount, result, 'archetype')` mounts the result card. Animations entrance; archetype name appears in serif display type; trait bars fill (320 ms).
5. **Share tap.** `HT.share.open(slug)` opens the inherited share dialog with a pre-populated text + Challenge URL.
6. **Challenge tap.** `HT.challenge.encode(answersHash, 'personality', 'v1')` generates the URL fragment; the receiver opens the URL, sees a "your friend did this quiz" page, takes the quiz blind.

**Climax.** Sanjit tweets the result. The share URL works on Twitter (≤ 80 chars); the OG image unfurls with his archetype + blind spot.
**Failure paths.**
- **3G mobile network.** Loader is page-conditional; falls back to the inherited offline path (`scripts/sw.js` caches the loader). Lighthouse Performance ≥ 95 on Moto G Power.
- **User skips all 12 questions.** Spec.archetypes[*].default is returned; the result card still renders with 0% trait bars and the default archetype.
- **Reduced-motion ON.** Animations disabled; swaps are instant; share / challenge buttons work identically.

### 3.2 Flow UJ-6 — Maya receives a Challenge URL

**Trigger.** Maya opens the URL in a browser, on phone, in a Signal chat.
**Steps.**
1. **Landing — accessible-name contract (B2).** The URL has fragment `#seed=<base36>&spec=personality@v1`. The loader fetches `data.json` (cached after first load), reads `spec=personality@v1`, picks the modules. The receiver-side landing page sets the document `<title>` to `"Challenge from {archetype or 'a friend'}: {quiz title}"` so a screen-reader user hears the purpose from the page title, not just the fragment. An `aria-live="polite"` region announces on mount: *"Challenge received from {archetype or 'a friend'}. The challenge is to take {quiz title} blind."* The visible H1 is `"You've been challenged to take {quiz title}"` — the word "challenge" is mandatory for SEO and user discoverability (H5).
2. **Seeding UX — privacy default + consent toggle (B2).** A small banner appears above the quiz with two mutually exclusive choices:
   - **"Take the quiz blind"** (default, autofocus, privacy-first). The receiver proceeds to the quiz with no preview of Sanjit's archetype + blind spot.
   - **"Show me what they got first"** (opt-in disclosure). Reveals the seeder's archetype + blind spot in a `<details>` element above the quiz; the user can collapse it back.
   Sanjit's archetype + blind spot are NEVER auto-disclosed without consent. The seeder's free-text answers are NEVER revealed — only the content-addressed seed (FR-25, FR-33).
3. **Quiz.** Same 12-question loop; Maya is blind to Sanjit's answers regardless of consent choice.
4. **Compatibility reveal.** After Maya's last question, `HT.challenge.compare(mayaResult, sanSeed, spec)` runs locally; the compatibility card renders (compatibility %, agree[], disagree[], blind spot). The compatibility card respects the 3-band contrast table in DESIGN.md §2.1 (Strong = `{colors.semantic-dark.success-on}` on `{colors.semantic.success-soft}`; Moderate = `{colors.primary.hover}` on `{colors.primary.soft}`; Low = `{colors.neutral-light.text-soft}` on `{colors.neutral-light.surface-2}`).
5. **Reverse share.** Maya can tap Share to send her compatibility back to Sanjit.

**Climax.** Maya learns she and Sanjit have a 62% compatibility, agree on curiosity + ambition, differ on risk + decision-making style.
**Failure paths.**
- **Sanjit's URL uses an old spec version (`@v0`).** The loader detects the version mismatch and offers "your friend used an older version of this quiz — the archetypes might differ." A "Take the new version" link is offered; the original result is not shown to avoid confusion.
- **Maya's `data.json` is stale.** The loader fetches the latest `data.json`; the seeder's spec version is preserved.
- **PII in the seeder's answers is somehow exposed.** AD-9 + FR-31 prevent this; the seeder's answers hash is opaque.
- **Receiver is on a screen reader and skips the title.** The `aria-live` region (B2) is the second-channel announcement; the title alone is not relied on.

### 3.3 Flow UJ-7 — Carlos uses a recommendation quiz to inform a real decision

**Trigger.** Carlos searches "car finder" and lands on the Discover Me tile (the home-grid search exposes Discovery entries).
**Steps.**
1. **Landing.** Loader mounts the `[scoring, results, catalog]` modules for `car-finder`.
2. **Question loop (8 steps).** Each card is a recommendation question (budget, usage, passengers, etc.) with 2–4 options per question.
3. **Result with catalog.** `HT.results.render(mount, scoredResult, 'ranking')` mounts the ranking-style result card: top 3 catalog entries with match %, "why you match" + "why you don't" + 3 alternatives.
4. **Tools for you click.** Carlos taps the surfaced existing utility tool (Loan Calculator) from the "Tools for you" section. The Shell navigates to `tools/loan-calculator/`.

**Climax.** Carlos sees "Toyota Corolla — 87% match. Why you match: budget fit 92%, family fit 96%, fuel efficiency 88%. Why you don't: performance 62%. Alternatives: Honda Civic, Mazda 3." He taps Loan Calculator to estimate monthly payments.
**Failure paths.**
- **Empty answers (Carlos skips all).** Spec.archetypes[*].default returns the first catalog entry with no rationale; the "Tools for you" still surfaces the loan calculator.
- **Catalog is stale (a car model is removed).** `HT.catalog.load(quizSlug)` is async; on failure, the result card shows the typed trait summary and an "alternatives unavailable" notice.
- **Carlos is offline.** The catalog is cached after first load; the result renders, but "alternatives" may be limited.

### 3.4 Flow UJ-8 — Aisha, the privacy-conscious user

**Trigger.** Aisha lands on the home grid and is intrigued by the Discover Me lane.
**Steps.**
1. **Disclosure read.** The Discover Me lane footer reads: *"No analytics. No tracking. No PII. Challenge URLs are fragment-state, never sent to a server. The data behind the quiz is in your browser only."*
2. **Decision.** Aisha decides to take a quiz because the disclosure matches her trust posture.
3. **Take quiz.** Standard flow; the result card has a "Download as image" button (no Share-by-URL required).
4. **Post via Signal.** Aisha taps Download; a `1024×1024` PNG is generated client-side (canvas; no external service). She attaches it to her Signal message.

**Climax.** Aisha shares a result with a friend group via a private channel, never exposing the URL.
**Failure paths.**
- **Aisha's browser doesn't support canvas-to-PNG.** The button falls back to "Copy as text" — a plain-text result representation that fits in any text channel.
- **Aisha tries the Challenge URL feature.** The receiver-side disclosure explains that the URL encodes a hash, not the answers; the Challenge UX is preserved.

## 4. Surface IA — `tools/packs/discovery/<quiz>/`

```
URL: /packs/discovery/<quiz-slug>/

  <header class="site-header">
    [Brand] [Lab] [Search] [Theme] [Locale] [Settings]
  </header>

  <main class="shell-main" data-slug="discovery-<quiz-slug>">
    <header class="tool-header">
      <a href="../../../" class="back-link">← All tools</a>
      <h1>{Quiz Title}</h1>
      <p class="tool-meta">{Category} · {count} questions · ~{minutes} min</p>
    </header>

    <section class="quiz-mount" aria-label="{Quiz Title}">
      <!-- Question card OR Result card OR Compatibility card; one at a time -->
    </section>

    <aside class="quiz-aside">
      <!-- Discovery-specific disclosure; same copy in every quiz -->
      <p>No analytics. No tracking. No PII. The Challenge URL is a fragment, never sent to a server.</p>
      <p><a href="/privacy#discovery">How your data is handled</a></p>
    </aside>

    <footer class="site-header site-footer">
      <!-- standard footer, unchanged per AD-15 -->
    </footer>
  </main>
```

The Disclosure is mandatory on every Discovery page. It is **two lines**, top-of-fold on mobile. It does not introduce a new footer section.

## 5. Components — focus on the 3 new chrome

### 5.1 `discovery-card` (DESIGN §1.1) — the result card

- **Behavior.** Mounts on `HT.results.render()`. Animations entrance; trait bars fill; the blind-spot box appears. Live-region announcement debounced 800 ms (H1) so re-renders do not double-announce.
- **State.** Pure: takes `result` + `variant`. Renders into the host element. Respects `prefers-reduced-motion`.
- **Keyboard.** Tab → Share → Challenge → Tools for you → next focusable outside the card (focus is NOT trapped on the result; it's the climax, not a modal). On mount, focus moves to the result-card container (or the Share button — whichever is more useful) so a keyboard user is positioned correctly without re-tabbing (H2). When the user navigates back (e.g., "Edit your answers"), focus restores to the last focused question card's Next button (H2).
- **A11y role.** `region` + `aria-live="polite"` + `aria-label="Your result: {archetype label}"`. The 800 ms debounce (H1) prevents double-announcements on re-render.
- **DOM shape (canonical — required by Story 10.10).** Every `HT.results.render()` call produces this exact structure:
  ```html
  <article class="discovery-card" role="region" aria-live="polite" aria-label="Result: {archetype}">
    <header class="discovery-card-header">
      <span class="archetype-emoji" aria-hidden="true">{emoji}</span>
      <h1 class="archetype-name">{name}</h1>
      <p class="tagline">{tagline}</p>
    </header>
    <ol class="trait-bar-list">
      <li class="trait-bar">…</li>  <!-- top 4 -->
    </ol>
    <aside class="blind-spot-box">
      <p class="blind-spot-label">Your blind spot</p>
      <p class="blind-spot-text">{blindSpot}</p>
    </aside>
    <div class="action-row">
      <button class="share-button">Share</button>
      <button class="challenge-button">Challenge a friend</button>
    </div>
    <section class="tools-for-you" aria-labelledby="tools-for-you-label">  <!-- B3 — region + heading -->
      <h2 id="tools-for-you-label" class="tools-for-you-label">Recommended tools for {archetype}</h2>
      <ul class="tools-for-you-list">
        <li class="tools-for-you-item">
          <a href="/tools/{slug}/">{displayName}</a>  <!-- display name from tools.json, NOT the slug -->
          <p class="tools-for-you-disclosure">In the Handy Tools suite — no third-party redirect.</p>
        </li>
        ... 1-2 more ...
      </ul>
    </section>
  </article>
  ```
  The "Tools for you" surface is `region` + `h2` + `ul` + `li` (B3 fix). Each surfaced tool renders its `displayName` from `tools.json` (not the kebab-case slug) so a screen reader announces "Loan Calculator", not "loan-calculator". Each card includes a one-line disclosure that the tool is in the same site, not a third-party redirect. The contrast ratios for the 3 compatibility bands (when present on the compatibility card) are verified per DESIGN.md §2.1.

### 5.2 `compatibility-card` (DESIGN §1.2) — the Challenge receiver's result

- **Behavior.** Mounts when a Challenge URL is completed. Computes compatibility locally.
- **State.** Pure: takes `{myResult, theirSeed, spec}`. The 3-row breakdown (agree / disagree / blind spot) renders below the compatibility band.
- **Keyboard.** Tab cycles the breakdown rows; Enter on a row expands the explanation.
- **A11y role.** `region` + `aria-label="Your compatibility with {their archetype}"`.

### 5.3 `discovery-lane-card` (DESIGN §1.3) — the Discover Me home-grid tile

- **Behavior.** Renders one quiz. Click navigates to the quiz page. Emoji is the icon; meta line shows "12 questions · 2 min".
- **State.** Inherits `components.tool-card` (keyboard-complete + a11y compliant per Story 2.4 extension to AD-4).
- **Keyboard.** Tab cycles cards; Enter launches the quiz.
- **A11y role.** Inherits from `tool-card`; `aria-label="{Quiz title}, {category}"`.

## 6. Modal vs Overlay vs Sheet

**The Discovery Engine introduces no new modal pattern.** All chrome is either:
- A region on the page (question card, result card, compatibility card) — focus is per-card, not trapped.
- An inherited component (tool-card on the home grid, share dialog via `HT.share.open`).
- A toast (the share-copy confirmation, inherited from `HT.toast`).

The Challenge UX is **not** a modal: it is a separate page that the receiver visits via URL. There is no "open this as a pop-up" affordance.

## 7. State — the 5 mutations the Discovery Engine introduces

| Mutation | Trigger | Effect | Persistence |
|---|---|---|---|
| `state.answers[qid] = value` | Next button on a card with a selection | Updates the local answer map; URL hash re-syncs (debounced 250 ms via inherited `HT.urlState.subscribe`); no localStorage write | URL hash (per AD-5) |
| `state.seed = base36-cyrb53(answers)` | Reveal-screen render (or Challenge tap) | Computes a 53-bit hash of the answers hash; passed to `HT.challenge.encode()` | URL hash (sharer's `Challenge URL`) |
| `state.comparison = {compatibility, agree[], disagree[], blindSpot}` | Receiver completes the quiz with a seeder's URL fragment | Computes the side-by-side comparison locally | none (computed on each render) |
| `state.disclosure-acknowledged = true` | User taps the disclosure link to read the full text | Marks the disclosure as acknowledged for this session (so it doesn't re-trigger) | sessionStorage (cleared on page reload) |
| `state.share-image = dataURL` | User taps "Download as image" | Generated client-side via canvas from the SVG archetype; saved to Downloads via `<a download>` | none (the file is saved; the dataURL is discarded) |

The Discovery Engine declares **no `history-keys`** (per FR-33). The Challenge URL is the persistence layer for the seeder; the receiver's quiz is stateless.

## 8. Failure Modes & Recovery

Per the brainstorm pre-mortem (9 risks), each gets an explicit recovery path:

| Risk (from brainstorm) | UX recovery |
|---|---|
| Long share URLs | URL is bounded ≤ 80 chars by `HT.challenge.encode()`; a UI smoke check enforces the bound |
| Generic OG image | OG images are pre-baked per archetype per quiz; the build pipeline enforces the set |
| Synchronous "challenge a friend" | The receiver completes the quiz asynchronously; the URL is the only sync point |
| Archetype immutability drift | The URL encodes `spec=<quiz>@<version>`; old URLs preserve old archetypes |
| PII in quiz questions | The lint runs at build time; the authoring guide teaches the rule |
| Existing 50 tools break | The home-grid renderer is unchanged; the Discover Me lane is appended; `make regression-sweep` rc=0 |
| Privacy-conscious users can't share | "Download as image" button on the result card |
| Engine becomes a destination | "Tools for you" section is mandatory; the section renders 1-3 existing utility tools |
| Localization drift | English-only for v1; locale-fragility documented as a known limitation; deferred to Epic 11 |

## 9. Screen-Reader & Keyboard Behavior

| Surface | Screen-reader behavior | Keyboard |
|---|---|---|
| Discover Me lane | "Discovery, region, 6 quizzes" | Tab cycles cards; Enter launches |
| Question card | "Question {n} of {total}" then "{prompt}" then "{option label}, radio button, {n} of {count}" | Tab cycles options; 1-9 picks option N; Enter advances; Esc pops one card |
| Result card | "Your result: {archetype name}. {tagline}. {blind spot text}" (announced once on mount, 800 ms debounce per H1) | Tab → Share → Challenge → Tools for you (focus not trapped); focus moves to result-card container or Share button on mount (H2); focus restores to last question card's Next button on "Edit your answers" (H2) |
| Compatibility card | "Your compatibility with {their archetype}: {percent}. {breakdown row 1}. {breakdown row 2}. {breakdown row 3}." | Tab cycles breakdown rows; Enter expands |
| Tools for you (B3) | "Recommended tools for {archetype}, region, {n} tools" (heading announced before list per WCAG 1.3.1) | Tab cycles `<li>` cards; Enter launches |
| Disclosure | "No analytics. No tracking. No PII. The Challenge URL is a fragment, never sent to a server. Link: how your data is handled." | Tab to link; Enter expands `/privacy#discovery` |
| Challenge receiver landing (B2, H5) | Document `<title>` is "Challenge from {archetype or 'a friend'}: {quiz title}"; `aria-live="polite"` region announces "Challenge received from {archetype or 'a friend'}. The challenge is to take {quiz title} blind." on mount | H1 visible: "You've been challenged to take {quiz title}" (H5 — word "challenge" is mandatory); consent toggle is the first focusable element (default: "Take the quiz blind") |

The Discovery Engine consumes the inherited `HT.a11y.auditTool(slug, rootEl)` and `HT.a11y.prefersReducedMotion` surface (per AD-4 Story 2.4 extension). No new a11y primitives are introduced.

**Skip-link target smoke check (H4).** The inherited skip-link target is `<main class="shell-main">` (per `HT.a11y` extension). The discovery pages must contain the disclosure `<aside class="quiz-aside">` INSIDE `<main class="shell-main">` so the skip-link does not skip the disclosure. The smoke harness asserts `document.querySelector('main.shell-main').contains(document.querySelector('.quiz-aside'))` returns `true` on every discovery page.

## 10. Print, Share, Embed, History

- **Print.** The result card has a `HT.share.print()` entry point via the `Print` button in the inherited share dialog (per FR-13 extension). Print strips the chrome and renders the archetype + trait bars + blind spot on a single page.
- **Share.** The result card's Share button calls `HT.share.open(slug)` (inherited). The share dialog gains a pre-populated message: `"{archetype emoji} {archetype label} — {tagline}. {blind spot} [Challenge URL]"` (≤ 280 chars).
- **Share-card OG image (H3).** Each archetype per quiz has a static OG SVG file at `assets/icons/og-disc-<slug>-<archetype-id>.svg`. Each SVG MUST include a `<title>` element as its first child: `<title>{archetype label} — {blind spot text}</title>`. Social-media platforms that respect SVG `<title>` (Twitter, LinkedIn, Slack, Discord, Facebook) announce the archetype + blind spot text instead of the platform-default "image". The authoring guide (`docs/discovery-quiz-authoring.md`) enforces the `<title>` element as the first child.
- **Embed.** The Discovery Engine does **not** ship embed mode (per AD-7 the embed is a Shell flag). Embedding a quiz on a 3rd-party site is explicitly out-of-scope for Epic 10 (deferred to Epic 11 if requested).
- **History.** The Discovery Engine declares **no `history-keys`**. The Challenge URL is the only persistence layer. The `/privacy` page lists this explicitly under the "Discover Me" section (per FR-33).

## 11. Reduced Motion — complete contract

The Discovery Engine honors `prefers-reduced-motion` at three levels:

1. **CSS media query** `@media (prefers-reduced-motion: reduce)` — every animation on the result card, the question card, the compatibility card, and the lane-card falls back to instant.
2. **HTML attribute** `:root:where([data-reduced-motion="true"])` — the same shell setting that drives Quiz Card UX (Story 9.12).
3. **JS check** `HT.a11y.prefersReducedMotion` — a runtime read in `HT.results.render()` (used by `HT.recommend.rank()` if needed for compatibility-band animation).

The contract matches the Story 9.12 / Story 9.19 wiring. No new reduced-motion primitives are introduced.

## 12. Internationalization

The Discovery Engine is **English-only for v1**. All archetype labels, blind-spot lines, taglines, and disclosure copy are authored in en-US. Locale-fragility is documented as a known risk (deferred to Epic 11). The adopted locales from `inherited/EXPERIENCE.md` (Bengali, Hindi, Spanish, Arabic) do **not** translate the Discovery Engine copy automatically — that is intentional (per the user's commitment to "no machine-translated archetype copy"). The locale switcher renders the existing 5 utility packs in the user's locale; the Discover Me lane stays in en-US until Epic 11.

## 13. What we did NOT do

- We did not introduce a new emoji font.
- We did not introduce a new serif typeface.
- We did not add a leaderboard / "top archetype" surface.
- We did not add analytics, telemetry, or third-party pixel sharing.
- We did not add embed mode for the Discovery pages.
- We did not localize the archetype copy beyond en-US.
- We did not add a "save my results to localStorage" affordance (Challenge URL is the persistence layer).
- We did not add authoring UI for new quizzes (data.json is the interface).
- We did not re-implement the home grid; the renderer is unchanged.
- We did not introduce a new topbar tab or new settings tab.

## 14. Cross-references

- **Master EXPERIENCE.md**: `ux-useful-tools-2026-07-31/EXPERIENCE.md` (inherited).
- **Design**: `ux-discovery-engine-2026-08-17/DESIGN.md` (3 new component tokens).
- **PRD**: `prd-discovery-engine-2026-08-17/prd.md` (FR-22..33, NFR-11..14, UJ-5..8).
- **Architecture**: `architecture-discovery-engine-2026-08-17/ARCHITECTURE-SPINE.md` (AD-16..19).
- **Rubric**: `ux-discovery-engine-2026-08-17/review-rubric.md`.
- **Accessibility review**: `ux-discovery-engine-2026-08-17/review-accessibility.md`.

---

*EXPERIENCE — Epic 10. Inherits structure + conventions from the master EXPERIENCE.md. Adds 4 new UJs (UJ-5–8), 5 state mutations, 8 failure-mode recoveries, and full reduced-motion / a11y / keyboard / locale contracts. No new modal pattern; no new chrome layer. The Discovery Engine is chrome-additive-zero.*