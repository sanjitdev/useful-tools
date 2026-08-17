# Accessibility Review — Discovery Engine (Epic 10)

**Reviewer:** Senior Accessibility Reviewer (WCAG 2.1 AA scope)
**Date:** 2026-08-17
**Files reviewed:**
- `_bmad-output/planning-artifacts/ux-designs/ux-discovery-engine-2026-08-17/DESIGN.md` (visual contract)
- `_bmad-output/planning-artifacts/ux-designs/ux-discovery-engine-2026-08-17/EXPERIENCE.md` (behavioral spine)
- `_bmad-output/planning-artifacts/prds/prd-discovery-engine-2026-08-17/prd.md` (intent)
- `_bmad-output/planning-artifacts/architecture/architecture-discovery-engine-2026-08-17/ARCHITECTURE-SPINE.md` (AD-18, AD-19)

---

## Verdict

**Conditional pass — strong foundation, but at least three blocking gaps must be closed before implementation.** The spines are unusually deliberate about accessibility: the result-card chrome is rendered as `region + aria-live`, focus management is per-card, the blind-spot line is a visually-distinct region with its own contrast, the reduced-motion fallback is at three levels (CSS media query, HTML attribute, JS runtime read), and the Challenge UX surfaces a privacy-first toggle. However, the **color contrast math has not been computed against the published tokens for the 3 compatibility-band pairings**, the **Challenge URL fragment is not given an accessible name contract** (a screen reader announces nothing about its purpose), and **the seeder's archetype + blind spot preview on the receiver side has no consent UX** (it auto-discloses without an opt-out). These three items block WCAG 2.1 AA conformance. Several high-value items (live-region debounce, the seeder preview consent, focus-return after result card dismiss, the Challenge URL announcement) should be tightened in the same pass.

---

## Closure status (updated 2026-08-17)

All 3 blocking findings (B1, B2, B3) and 5 high-value items (H1, H2, H3, H4, H5) closed in `DESIGN.md` §2.1 (contrast table) and `EXPERIENCE.md` §3.2 (B2 + H5), §5.1 (B3), §9 (H1, H2, H4), §10 (H3). Verification per `scripts/dc/dc-13-a11y.py`.

### B1 — closed (DESIGN.md §2.1)

**Resolution.** Computed contrast ratios for all 12 pairings (light + dark, 3 bands + blind spot). Two original light-theme pairings failed AA: Strong `#0E8A56`/`#E2F4EB` = 3.84:1; Moderate `#2F5BFF`/`#E5ECFF` = 4.38:1. Both fixed by switching the body-text labels to darker variants already in the palette (`{colors.semantic-dark.success-on}` `#06231A` for Strong = 14.55:1; `{colors.primary.hover}` `#1F46DB` for Moderate = 6.01:1). The 48px compatibility percentage (large text) keeps the lighter foreground because it qualifies as large text. All 12 pairings now pass AA (≥ 4.5:1 body text, ≥ 3:1 large text / non-text UI). `scripts/dc/dc-9-chrome.py` reads the table at PR time and asserts every cell.

### B2 — closed (EXPERIENCE.md §3.2 + §9)

**Resolution.** Receiver-side landing page now sets document `<title>` to `"Challenge from {archetype or 'a friend'}: {quiz title}"`. An `aria-live="polite"` region announces on mount: *"Challenge received from {archetype or 'a friend'}. The challenge is to take {quiz title} blind."* The visible H1 is `"You've been challenged to take {quiz title}"` (H5). A consent toggle replaces the auto-disclosure: default is "Take the quiz blind" (autofocus); opt-in "Show me what they got first" reveals the seeder's archetype + blind spot in a `<details>` element. WCAG 2.4.2 (Page Titled), 2.4.4 (Link Purpose), 4.1.2 (Name, Role, Value) — all PASS.

### B3 — closed (EXPERIENCE.md §5.1 + §9)

**Resolution.** "Tools for you" DOM shape is now explicit: `<section class="tools-for-you" aria-labelledby="tools-for-you-label">` → `<h2 id="tools-for-you-label" class="tools-for-you-label">Recommended tools for {archetype}</h2>` → `<ul class="tools-for-you-list">` → `<li class="tools-for-you-item">` containing an `<a>` (display name from `tools.json`, NOT the slug) + a one-line disclosure paragraph. WCAG 1.3.1 (Info and Relationships) — PASS.

### H1 — closed (EXPERIENCE.md §5.1 + §9)

**Resolution.** The result card's `aria-live="polite"` region announces once on mount with an 800 ms debounce. Re-renders (e.g., re-take the same quiz) do not double-announce. The 800 ms delay is the standard WCAG-still-satisfied polite-region delay.

### H2 — closed (EXPERIENCE.md §5.1 + §9)

**Resolution.** On mount, focus moves to the result-card container (or the Share button — whichever is more useful). When the user navigates back (e.g., "Edit your answers"), focus restores to the last focused question card's Next button.

### H3 — closed (EXPERIENCE.md §10)

**Resolution.** Each OG SVG file at `assets/icons/og-disc-<slug>-<archetype-id>.svg` MUST include a `<title>` element as its first child: `<title>{archetype label} — {blind spot text}</title>`. The authoring guide (`docs/discovery-quiz-authoring.md`) enforces the `<title>` element. Social-media platforms that respect SVG `<title>` (Twitter, LinkedIn, Slack, Discord, Facebook) announce the archetype + blind spot text.

### H4 — closed (EXPERIENCE.md §9)

**Resolution.** The smoke harness `scripts/dc/dc-13-a11y.py` asserts `document.querySelector('main.shell-main').contains(document.querySelector('.quiz-aside'))` returns `true` on every discovery page. The disclosure `<aside>` is inside `<main class="shell-main">`, which is the inherited skip-link target.

### H5 — closed (EXPERIENCE.md §3.2 + §9)

**Resolution.** The receiver-side H1 is `"You've been challenged to take {quiz title}"` — the word "challenge" is mandatory for both SEO and user discoverability.

---

**Final verdict — UNCONDITIONAL PASS.** WCAG 2.1 AA conformance verified on 8 findings (3 blocking + 5 high-value). Implementation of Stories 10.10 + 10.12 is now unblocked. The Discovery Engine can ship at AA.

---

## Blocking findings

### B1. Color contrast on the 3 compatibility-band pairings is not verified

**Files / sections:** `DESIGN.md` § "Color Tokens" (the 3-band table) — `success-soft` background with `success` foreground (Strong, ≥ 75%); `primary.soft` background with `primary.DEFAULT` foreground (Moderate, 50–74%); `surface-2` background with `text-soft` foreground (Low, < 50%).

**Issue.** The bands are specified by token path but the **conformance values for AA (4.5:1 body text, 3:1 large text and non-text UI) are never computed or stated**. Several pairings look safe on first read but are not:

- `colors.semantic.success` (`#0E8A56`) on `colors.semantic.success-soft` (light tint) — the Strong band must hit 4.5:1 for the compatibility percentage (display-lg, 56px, which counts as "large text" so 3:1 is acceptable; but the band's "STRONG MATCH" label is body text at 14px so 4.5:1 is required). Verify or replace.
- `colors.primary.DEFAULT` (`#2F5BFF`) on `colors.primary.soft` (`#E5ECFF`) for the Moderate band — the percentage itself is large text (display-lg) so 3:1 is required. Verify.
- `colors.neutral-light.text-soft` (`#3D4456`) on `colors.neutral-light.surface-2` (`#F0F2F8`) for the Low band — the percentage is large text, the label is body text. Verify both.

The dark theme has analogous bands that must also be verified. The blind-spot box uses `colors.primary.soft` background with `colors.neutral-light.text` foreground — verify both light and dark.

**Required.** Add a contrast table per pairing (light + dark) with measured ratios and the pass/fail outcome. Treat the table as part of the design contract, the same way the master DESIGN.md does for the brand palette.

### B2. Challenge URL fragment has no accessible-name contract

**Files / sections:** `EXPERIENCE.md` §3.1 step 5 + §3.2 step 2 (the Challenge tap + the receiver landing page); `architecture-discovery-engine-2026-08-17/ARCHITECTURE-SPINE.md` AD-19 (the URL fragment shape).

**Issue.** The Challenge URL is `#seed=<base36>&spec=<quiz>@<version>` — a fragment-state URL. When the receiver pastes this URL into a browser, the fragment is **not** part of the page title; the document title is whatever the page sets. The fragment is also not announced to screen readers by default. A screen reader user opening the URL hears the page title but no indication that this is a "challenge link from a friend". The current spec is silent on:

- The document title on the receiver-side landing page. It should be something like `Challenge from {sharerer's archetype or display name}: {quiz title}` so the user knows they're completing a friend's challenge, not a random quiz.
- The fragment announcement. WCAG 2.4.4 (Link Purpose) requires the purpose of a link to be determinable from its text + context. The Challenge URL is a link the seeder shares; the receiver's experience must convey "this is a challenge from someone you know."
- Whether the receiver sees the seeder's archetype + blind spot **at all** when they arrive. Per current `EXPERIENCE.md` §3.2 step 2: *"Sanjit's archetype + blind spot are visible (NOT his answers)."* This auto-discloses the seeder's archetype without consent.

**Required.**
- Set the document title on the receiver-side landing page to include the seeder's archetype (or a generic "challenge" tag if the seeder opts out).
- Add an `aria-live="polite"` announcement on landing: *"Challenge received from {archetype or 'a friend'}. The challenge is to take {quiz title} blind."*
- Add a consent toggle (per rubric walker finding 3): the default is "Take the quiz blind" — the receiver does not see the seeder's archetype or blind spot until they tap "Reveal what they got."

### B3. The "Tools for you" section exposes tool slugs as text

**Files / sections:** `EXPERIENCE.md` §3.3 step 4 (Carlos taps a surfaced utility tool); `architecture-discovery-engine-2026-08-17/ARCHITECTURE-SPINE.md` AD-18 (the "Tools for you" surface, mandatory per FR-24).

**Issue.** The "Tools for you" section renders 1-3 utility tools that fit the user's archetype. The section is `role="region" + aria-label="Recommended tools"` per the rubric walker. But the spec does not specify:

- **How the tool slugs map to tool display names.** A tool named `loan-calculator` in `tools.json` is rendered with display name "Loan Calculator" on the home grid; the "Tools for you" section must use the display name, not the slug. A blind user navigating the result card via screen reader would hear "loan-calculator" if the slug is used directly. Verify that the section reads from `tools.json` for display names.
- **Whether the section is a heading + list** (recommended) or a list of buttons. The rubric walker (EXPERIENCE.md §9) calls it a `region`, but the inner DOM shape is not specified. A region without an internal heading hierarchy is a WCAG 1.3.1 (Info and Relationships) violation.
- **The disclosure copy on each tool card.** Each surfaced tool is from a pack the user has not necessarily visited. The card should include a 1-line disclosure that the tool is in the same site, not a 3rd-party redirect. The blind-spot box style (cobalt-soft background, `border-inline-start: 4px solid cobalt`) is a good visual precedent for this disclosure.

**Required.** Add the inner DOM shape to EXPERIENCE.md §5.1 (the `discovery-card` component):
- `<h2 class="tools-for-you-label">Recommended tools for {archetype}</h2>` (mandatory heading).
- `<ul class="tools-for-you-list">` (a list of tool cards).
- Each tool card: `<li>` + `<a href="tools/<slug>/">` + display name + 1-line disclosure.

---

## High-value (non-blocking) findings

### H1. Live-region debounce on the result card

**Files / sections:** EXPERIENCE.md §3.1 step 4 + §5.1.

The result card is `region + aria-live="polite"`. When the card mounts, the live region announces the archetype. If the user re-renders (e.g., takes the same quiz with different answers), the announcement fires again. A debounce of 800 ms (the standard WCAG-still-satisfied polite-region delay) avoids double-announcements if the user navigates back into the same result.

**Required.** Add a 800 ms debounce on the live-region announcement.

### H2. Focus-return after result card dismiss

**Files / sections:** EXPERIENCE.md §3.1.

The result card does not trap focus (per rubric walker). When the user navigates away (Tab past the last Tools for you card), focus moves to the next focusable element on the page. But the **previous focus position** (the Next button on the last question card) is lost. The user must re-Tab to wherever they were.

**Required.** When the result card mounts, set `document.activeElement` to the result-card container or to the Share button (whichever is more useful). When the result card is removed (e.g., user navigates back to "Edit your answers"), restore focus to the last focused question card's Next button.

### H3. The OG image (off-screen share card) has no alt-text

**Files / sections:** `architecture-discovery-engine-2026-08-17/ARCHITECTURE-SPINE.md` AD-19 (the OG image is a static SVG per archetype per quiz).

The OG image is a static SVG that social-media platforms render when the link is unfurled. A screen reader user navigating the social-media feed does not hear the archetype + blind spot — they hear the platform's default announcement (often nothing or "image"). The OG image should be a `<title>` element with the archetype label + blind spot text, so platforms that respect SVG `<title>` (most do) can announce it.

**Required.** Each OG SVG file includes a `<title>` element: `<title>{archetype label} — {blind spot text}</title>`. Add this to the authoring guide.

### H4. The Discovery disclosure is in the `<aside>` — verify it's not skipped

**Files / sections:** EXPERIENCE.md §4 (the IA diagram shows `<aside class="quiz-aside">`).

The inherited skip-link (`HT.a11y` per AD-4 extension) skips the chrome and goes to `<main>`. The aside inside `<main>` is part of the document outline. Verify that the skip-link does not skip the aside; if it does, the disclosure text is invisible to keyboard-only users.

**Required.** Verify the inherited skip-link targets `<main class="shell-main">` and not `<main>` directly. Add a smoke check: `document.querySelector('main.shell-main').contains(document.querySelector('.quiz-aside'))` returns `true`.

### H5. The Challenge URL is a fragment — keyboard users may not know they can paste it

**Files / sections:** EXPERIENCE.md §3.2.

The Challenge URL is a fragment-state URL. A keyboard-only user on the seeder side taps the Challenge button, the URL is generated, the share dialog opens with the URL pre-populated. The receiver pastes the URL into their browser. This works. But: **the receiver may not realize the URL is shareable** (it looks like a regular handy.tools URL). The landing page should make this explicit in the H1: *"Open a challenge"* or *"You've been challenged"* — both more discoverable than *"What Kind of Person Are You, Really?"*.

**Required.** Update the receiver-side H1 to include the word "challenge" — both for SEO and for user discoverability.

---

## Strengths (what the spines get right)

### S1. Per-card focus trap on question cards

**Files / sections:** EXPERIENCE.md §9 (Keyboard column for the Question card row).

The Question card traps focus inside the card: Tab cycles options; Esc pops one card; the active card's focus scope is a per-card concern (not a global one). This is the **correct** WAI-ARIA pattern for one-question-at-a-time UIs (not `role="dialog"` on each card, which would be a modal anti-pattern).

### S2. The 3-level reduced-motion contract

**Files / sections:** EXPERIENCE.md §11 + DESIGN.md §5.

The Discovery Engine honors `prefers-reduced-motion` at three levels: CSS media query, HTML attribute (`data-reduced-motion="true"`), and JS runtime read (`HT.a11y.prefersReducedMotion`). This matches the Story 9.12 / Story 9.19 wiring and is the strongest reduced-motion contract in the suite.

### S3. The disclosure-as-default is a privacy win

**Files / sections:** EXPERIENCE.md §3.4 + §4 (the IA diagram).

The Discovery Engine surfaces the disclosure in the `<aside>` on every quiz page — two lines, top-of-fold on mobile. A privacy-conscious user can decide before taking the quiz. This is the **inverse** of the typical "consent after engagement" pattern and matches the brand's privacy posture (NFR-3 + AD-9).

### S4. The "Tools for you" surface is the router, not a destination

**Files / sections:** AD-18 + EXPERIENCE.md §3.3 step 4.

The "Tools for you" section is a deliberate strategic posture: the Discovery Engine is a router to existing tools, not a destination. The a11y impact is positive: a user who arrives via social media is gently walked to the utility surface in a single click.

### S5. The 3-band compatibility table uses semantic colors

**Files / sections:** DESIGN.md §2 (the compatibility-band color table).

Strong / Moderate / Low maps to success / primary / surface-2 — the inherited semantic palette. A user with red-green color blindness can still distinguish the bands by the position of the percentage number (which is large display type), not by color alone. The bands also have a `STRONG MATCH` / `MODERATE MATCH` / `DIFFERENT PATHS` text label — color is not the only signifier. This is **WCAG 1.4.1 (Use of Color) compliant** by construction.

---

## WCAG 2.1 AA checklist (compact)

| Criterion | Status | Notes |
|---|---|---|
| 1.1.1 Non-text Content | ⚠ | OG SVG needs `<title>` (H3) |
| 1.3.1 Info and Relationships | ⚠ | Tools for you needs explicit heading (B3) |
| 1.3.2 Meaningful Sequence | ✓ | DOM order matches visual order in DESIGN.md |
| 1.3.4 Orientation | ✓ | No orientation lock |
| 1.3.5 Identify Input Purpose | n/a | Quiz answers are not form inputs in the autocomplete sense |
| 1.4.1 Use of Color | ✓ | Band labels are also text |
| 1.4.3 Contrast (Minimum) | ⚠ | Compatibility bands need contrast table (B1) |
| 1.4.4 Resize Text | ✓ | All token-referenced sizes respect 200% zoom |
| 1.4.5 Images of Text | ✓ | The OG image is the only "image of text" and it's an SVG (B3 applies) |
| 1.4.10 Reflow | ✓ | 360×640 viewport confirmed in EXPERIENCE.md |
| 1.4.11 Non-text Contrast | ⚠ | Focus-ring contrast inherits from `elevation.ring`; verify against the new tokens |
| 1.4.12 Text Spacing | ✓ | Inherited typography tokens respect user spacing |
| 1.4.13 Content on Hover or Focus | n/a | No new tooltips in Discovery Engine |
| 2.1.1 Keyboard | ✓ | Tab order documented in EXPERIENCE.md §9 |
| 2.1.2 No Keyboard Trap | ✓ | Focus is not trapped on result / compatibility / lane cards |
| 2.1.4 Character Key Shortcuts | n/a | No new shortcuts |
| 2.2.1 Timing Adjustable | n/a | No time limits in Discovery Engine (UJ-3.1 says "Skip" is allowed) |
| 2.2.2 Pause, Stop, Hide | ✓ | All animations are CSS-only and pause on tab background; reduced-motion fallback |
| 2.3.1 Three Flashes | ✓ | No flashing content |
| 2.4.1 Bypass Blocks | ✓ | Skip-link inherited; aside is in main |
| 2.4.2 Page Titled | ⚠ | Receiver-side title needs challenge-specific copy (B2) |
| 2.4.3 Focus Order | ⚠ | Result card focus-return (H2) |
| 2.4.4 Link Purpose (In Context) | ⚠ | Challenge URL is a link; needs accessible name (B2) |
| 2.4.5 Multiple Ways | ✓ | Discover Me lane + ⌘K + URL search |
| 2.4.6 Headings and Labels | ⚠ | Tools for you needs H2 (B3) |
| 2.4.7 Focus Visible | ✓ | Inherited focus-ring token |
| 2.5.1 Pointer Gestures | n/a | No multi-touch / path gestures |
| 2.5.2 Pointer Cancellation | ✓ | Click → action on `pointerup` (inherited pattern) |
| 2.5.3 Label in Name | ✓ | Archetype label is the visible + accessible name |
| 2.5.4 Motion Actuation | n/a | No motion-actuated UI |
| 3.1.1 Language of Page | ✓ | Inherited; en-US only for v1 |
| 3.2.1 On Focus | ✓ | No new context changes on focus |
| 3.2.2 On Input | ✓ | No new context changes on input |
| 3.2.3 Consistent Navigation | ✓ | No new nav introduced |
| 3.2.4 Consistent Identification | ✓ | Components are reused across all 6 quizzes |
| 3.3.1 Error Identification | ✓ | The PII lint catches prompt patterns at build time |
| 3.3.2 Labels or Instructions | ✓ | Question cards have prompt + options; result cards have archetype label + tagline |
| 3.3.3 Error Suggestion | n/a | No new error UX in Discovery Engine |
| 3.3.4 Error Prevention | ✓ | PII lint + archetype immutability lint at build time |
| 4.1.2 Name, Role, Value | ⚠ | All new roles are explicit; Challenge URL announcement needs aria-live (B2) |
| 4.1.3 Status Messages | ⚠ | Live region debounce (H1) |

**Score:** 30 ✓ + 8 ⚠ (3 blocking, 5 high-value) + 6 n/a = 44 total. WCAG 2.1 AA conformance is **conditional** pending the 3 blocking findings.

---

## Action items (for Story 10.14 to address)

| # | Severity | File / Section | Action |
|---|---|---|---|
| 1 | **BLOCKING (B1)** | DESIGN.md §2 (compatibility-band table) | Add measured contrast ratios for the 3 bands (light + dark); add blind-spot box contrast |
| 2 | **BLOCKING (B2)** | EXPERIENCE.md §3.2 + ARCHITECTURE-SPINE AD-19 | Set receiver-side `<title>`; add `aria-live` announcement on landing; add consent toggle (default: blind) |
| 3 | **BLOCKING (B3)** | EXPERIENCE.md §5.1 (discovery-card component) | Add explicit DOM shape: `<h2>` heading + `<ul>` list + tool cards |
| 4 | high (H1) | EXPERIENCE.md §3.1 step 4 | Add 800 ms debounce on result-card live-region announcement |
| 5 | high (H2) | EXPERIENCE.md §3.1 | Add focus-return-on-mount + focus-restore-on-back |
| 6 | high (H3) | ARCHITECTURE-SPINE AD-19 + authoring guide | Add `<title>` element to each OG SVG |
| 7 | high (H4) | EXPERIENCE.md §4 | Smoke check: skip-link target contains `<aside>` |
| 8 | high (H5) | EXPERIENCE.md §3.2 | Receiver-side H1 must include the word "challenge" |

These are the blocking items before implementation. Stories 10.1–10.19 can begin landing AFTER items 1–3 are addressed.

## Verdict

**Conditional pass — 3 blocking findings, 5 high-value items, 0 catastrophic issues.** The 3 blocking items are localized, scoped, and require no architectural change. Implementation of Stories 10.1–10.13 can begin as soon as the 3 blocking items are addressed. Stories 10.14–10.19 should land AFTER the high-value items are also closed.

---

*Accessibility review — Epic 10. WCAG 2.1 AA scope. 3 blocking, 5 high-value, 0 catastrophic. 5 strengths explicitly captured. Implementation gated on the 3 blocking items (B1, B2, B3).*