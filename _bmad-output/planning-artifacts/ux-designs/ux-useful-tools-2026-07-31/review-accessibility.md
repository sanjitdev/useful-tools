# Accessibility Review — Handy Tools UX Spines

**Reviewer:** Senior Accessibility Reviewer (WCAG 2.1 AA scope)
**Date:** 2026-07-31
**Files reviewed:**
- `DESIGN.md` (visual identity contract, tokens)
- `EXPERIENCE.md` (behavioral spine)
- `prd.md` (intent / requirements)

---

## Verdict

**Conditional pass — strong foundation, but at least three blocking gaps must be closed before implementation.** The spines are unusually deliberate about accessibility: forced-colors mode is mapped 1:1, focus is treated as a load-bearing primitive, and the no-color-only-meaning, reduced-motion, RTL-safe, 44 px touch-target, and focus-return contracts are stated. However, the **color contrast math has not been computed against the published tokens**, the **command-palette focus-trap rule is internally inconsistent**, and the **embed iframe is not given an accessible name contract**. These three items block WCAG 2.1 AA conformance. Several high-value items (live-region debounce, validation association, 400 % reflow, print reflow, history `aria-live`) should be tightened in the same pass.

---

## Blocking findings

### B1. Color contrast on published token pairs is not verified
**Files / sections:** `DESIGN.md` § "Colors" (lines 558–615), § "Component tokens" (lines 284–533); cross-checked with `prd.md` § 4.1 rubric #9.
**Issue.** The palette is specified in hex; the text/background pairings are mostly named (e.g., `text` on `bg`, `text-soft` on `surface-1`), but the **conformance values for AA (4.5:1 body, 3:1 large text and non-text UI)** are never computed or stated. Several pairings that look safe on first read are not:
- `neutral-light.muted` (`#69708A`) used as **form labels and history meta** on `neutral-light.surface-1` (`#FFFFFF`) and `neutral-light.surface-2` (`#F0F2F8`) — placeholder/label weight is 600 / 13 px which is *not* large text, so 4.5:1 is required. The muted tone is borderline; verify or replace.
- `semantic.warning` (`#B36B00`) on `warning-soft` (`#FBEFD9`) for warning icon — icon is "non-text UI" and must hit 3:1 against adjacent surface.
- `neutral-light.muted-strong` (`#454C61`) used for `result-tile.copy-icon-color` on `result-tile.bg` (`#F0F2F8`) — must be ≥ 3:1 since the icon is the only affordance.
- Dark theme: `semantic-dark.warning` (`#F2B43A`) on `warning-soft` (`#2D2210`) — looks strong but must be verified. `semantic-dark.info` (`#7B95FF`) on `info-soft` (`#16234A`) for icon contrast is similarly unverified.
- Alert `warning.fg` and `error.fg` are defined as `color-mix(in srgb, semantic.{warning|danger} 80%, neutral-light.text)`. The mix result is not specified and the resulting foreground is not contrast-tested against the soft backgrounds; color-mix values can land in non-AA territory.
**Required.** Add a contrast table per pairing (light + dark) with measured ratios and the pass/fail outcome. Treat the table as part of the design contract.

### B2. Command-palette focus behavior is internally contradictory
**Files / sections:** `EXPERIENCE.md` § 1.5 "Modal vs Overlay vs Sheet" (line 62) and § 6.2 "Tab Order Rules" #3 (line 421) and § 6.6 "Focus Behavior Specifics" (line 464); `DESIGN.md` § "Command Palette" (line 822).
**Issue.** The palette is **explicitly an overlay** (not a modal) in two places and **explicitly non-trapping** in § 6.2 #3 and § 6.6, but § 1.5 says "The Command Palette never blocks more than one modal. There is exactly one modal stack at any time; everything else is overlay (palette, help)…" — consistent so far. However, § 1.5 (line 62) also says "Overlay … focus is *not* trapped (palette focus stays inside input, but Tab can leave)" while § 6.2 #3 says "Command palette does *not* trap — the rest of the page is still useful behind it." These agree. The real conflict is with § 7.1 "Screen Reader Behavior — Specifics" (line 497), which states: "Results use `role="listbox"`, items use `role="option"` … Up/Down navigates; Enter selects; Esc closes; **Tab cycles between result groups**." Tab leaving the input to cycle between two `<role="listbox">` groups is incompatible with a single, implicit `aria-activedescendant` combobox/listbox pattern and breaks SR rotor navigation. Either the palette is a combobox (single listbox, arrow keys move the active option) **or** a menubar (with Tab between groups) — not both.
**Required.** Pick one WAI-ARIA pattern (combobox/listbox recommended) and remove the contradictory Tab behavior. Document the decision in § 6.2 and § 7.1.

### B3. Embed iframe has no accessible-name contract
**Files / sections:** `EXPERIENCE.md` § 10.1–10.6 (lines 671–755); `DESIGN.md` § "(a) Embed iframe chrome" (line 955); `prd.md` § 4.4 FR-10 (line 200).
**Issue.** The embed is described as "silent by design" and "the brand surface limit is `embed-chip`." § 10.1 says "iframe title is the tool's title" in DESIGN.md line 962. The contract for the `title` attribute is therefore implicit. Beyond title, the spec is silent on:
- `aria-label` vs `title` (screen readers prefer `aria-label`; Safari prefers `title`; should set both).
- `loading="lazy"` — good — but no fallback if the host's CSP blocks the iframe (only a one-line "if your site blocks iframes" warning in the dialog).
- The "Powered by handy.tools" badge is described as "configurable; Marco leaves it on" and is a link, but it has no contract for the case where `badge=0` and the visitor's only indication of the embed is a borderless, headless iframe — zero identity, zero alternative, zero way to reach the full tool from the keyboard except by Tabbing into the iframe and through every input.
- The embed mode **removes the "View source" link** (§ 10.2), removing the trust surface from inside the embed. This conflicts with DESIGN.md's brand posture of the trust surface as content.
**Required.** Add a "Embed accessibility" subsection that specifies: (a) `title` + `aria-label` containing the tool's name; (b) minimum embed size 240 × 240 to keep tap targets; (c) a `badge=0` fallback that still exposes one keyboard-reachable link to the full tool; (d) keyboard focus management when the iframe is focused for the first time (focus moves to the first input inside).

---

## High-value improvements

### H1. Validation error association: `aria-describedby` is mentioned, `aria-invalid` is not
**File / section:** `EXPERIENCE.md` § 4 "Input" row (line 328) and § 5 "Validation error" row (line 368); `DESIGN.md` § "Input" (line 776).
The input row promises `aria-describedby="…-error"`, but `aria-invalid="true"` is never set, and the `aria-errormessage` (the modern equivalent) is not used. The message below the field is also not announced by SR unless it has `role="alert"` or lives in a live region. Add: `aria-invalid="true"` toggled on first failed validation; the error text in an `aria-live="polite"` region or with `role="alert"`; success state cleared with `aria-invalid="false"`.

### H2. Result-tile live-region behavior contradicts itself
**File / section:** `EXPERIENCE.md` § 4 "Result Tile" (line 329) and § 7.1 (line 498).
§ 4: "Tile is the page's primary focus target after first compute." § 7.1: "When the value changes meaningfully (not on every keystroke), an `aria-live="polite"` region announces: 'Result: 42.'" But § 4 also says the result tile "Recomputes synchronously on input change for ≤ 50 ms operations." If the tile is also the live region, **every keystroke** during fast recompute announces; the 500 ms debounce in § 7.1 only applies when "not on every keystroke." Make the live region a **separate, visually hidden `<output>` element** (or `role="status"`) tied to the form, and the tile remains visual only. Specify: when does the live region announce — on first compute, on value change after debounce, on copy? The current text reads as three different rules.

### H3. No 400 % zoom / 320 CSS px reflow story
**File / section:** `EXPERIENCE.md` § 8 (entire); `DESIGN.md` § "Layout & Spacing" (line 654).
Reflow at 320 CSS px is implied by the mobile-first posture, and § 9.5 says "Flows are tested at 200% zoom." 200 % is **not** the WCAG 1.4.10 requirement (which is 400 % zoom or 320 CSS px, whichever is less). There is no documented plan for what happens to the command palette, settings modal, and tool grids at 400 % zoom. Add an accessibility-test breakpoint and a statement: at 400 % zoom, two-column layouts reflow to one column, modals become full-width sheets, the palette goes bottom-sheet. This is blocking for AA conformance on § 1.4.10.

### H4. History panel is not a live region; restoring does not announce
**File / section:** `EXPERIENCE.md` § 4 "History Panel" (line 333) and § 5 "Success / Restore" / "Clear" (not enumerated but implied by toast row 369).
`EXPERIENCE.md` names the live region only for toasts. History restore is announced only via toast ("Restored"). When the panel itself is the surface, the user has no programmatic signal that the inputs changed. Add `aria-live="polite"` to the result tile or to a dedicated "status" region on restore; ensure the active history row has `aria-current="true"`.

### H5. Print stylesheet is named but its accessibility is not specified
**File / section:** `prd.md` § 4.1 rubric #5 (line 75); `EXPERIENCE.md` § 5 "Success / Print" (line 371).
"Print stylesheet strips chrome, keeps result tile, adds URL + timestamp footer" is correct, but: (a) is the result tile large enough to read in print? 11 pt minimum? (b) does the print sheet set `color-adjust: exact` so high-contrast and forced-colors users get a usable printout? (c) does it ensure link URLs are printed (`a[href]::after { content: " (" attr(href) ")"; }`)? (d) is the print trigger itself announced ("Print dialog opened" — yes, toast — but the print preview is not announced). Specify.

### H6. Embed "Open in handy.tools" recovery link in iframe is a `target="_top"` risk
**File / section:** `EXPERIENCE.md` § 10.4 (line 717).
The recovery link inside the embed navigates to the full app. From inside an iframe, a plain `<a href>` will navigate the iframe; `target="_top"` will break the host's page if the host's CSP forbids top-level navigation. Specify: the link sets `target="_blank"` (opens new tab) **or** uses `postMessage` to ask the host to navigate. The current text is silent.

### H7. Toggle switch and numeric stepper detail
**File / section:** `EXPERIENCE.md` § 4 "Numeric Stepper" (line 342) and "Toggle Switch" (line 343).
Stepper: "`aria-disabled`, not `disabled`, so the input remains focusable" is correct. But the +/- buttons need `aria-label` ("Increase value", "Decrease value"), and the input needs `inputmode="decimal"` and `aria-valuenow`/`aria-valuemax` if you want AT to read the value. The stepper is not described as an ARIA spinbutton; if not, AT will treat it as a plain text field. Toggle: `role="switch"`, `aria-checked` — good — but no on/off text label is described. Add visible on/off state.

### H8. Forced-colors mapping is incomplete for the command palette keyboard cursor
**File / section:** `DESIGN.md` § "High-contrast / forced-colors palette" (line 100) and "Command Palette" (line 822).
In default themes, the keyboard-cursor row is `{primary.DEFAULT}` fill + `{primary.on}` text — clear color difference. In forced-colors, the row maps to `Highlight` fill + `HighlightText` text — also fine. But the **non-cursor rows** (item-inactive-fg on panel-bg) must remain distinguishable from the cursor row using *shape or label*, not just color, because the cursor is announced by AT but the visual emphasis also has to survive a forced-colors theme. The spec is silent. Add a 2 px border on the cursor row under forced-colors.

### H9. Reduced-motion "0 ms" is too absolute
**File / section:** `EXPERIENCE.md` § 5 "Reduced motion active" (line 379); `DESIGN.md` Do #5 (line 933).
"All transitions become 0 ms" is fine, but `prefers-reduced-motion` users may still benefit from a 60–80 ms fade for the toast and result-tile update, so the change registers as feedback rather than a screen-flip. The spec says "Result tile updates are still visible (the value changes), but no fill animation" — the result tile's background shift (mentioned in § 7 color-independent meaning) is a motion. Specify: a single 80 ms cross-fade on toasts and result tiles is allowed; transitions on cards/hover are dropped. Aligns with WCAG 2.3.3 (animation from interactions) intent.

### H10. Pin/star button announce state
**File / section:** `EXPERIENCE.md` § 4 "Star (Pin) Button" (line 341).
"`aria-pressed` reflects state" — good — but the toggle is "Pin to home" / "Unpin" via tooltip. Tooltips are not announced by all SR. Add `aria-label` with the state ("Pin Bill Splitter to home", "Unpin Bill Splitter") and a visible icon change so the state is communicated visually too.

---

## What is strong

- **Forced-colors mode is mapped to system colors** (`CanvasText`, `Highlight`, `Mark`, `LinkText`) and the shadow-to-border swap is documented per elevation level. This is rare and correct.
- **Focus is treated as a load-bearing surface** (`elevation.ring` is a token, not a per-component choice), the 3 px solid at 2 px offset is the right primitive, and `outline: none` is explicitly forbidden.
- **No `tabindex` hacks** are allowed (§ 6.2 #4: "Only `0`, `-1`, and absence"). Skip link is the first focusable element on every page. This is exemplary.
- **The keyboard help overlay is non-modal** and the underlying page remains interactive — a good pattern often missed.
- **`prefers-reduced-motion` is respected at the design level**, not bolted on; the 200 ms scale-down is dropped and the shadow is kept, preserving affordance.
- **`prefers-contrast: more` and `forced-colors` are first-class**, with a documented palette. The system-font stack honors Latin, Bengali, Hindi, and Arabic in a single declaration.
- **The trust surface is auditable** (`/privacy` wire log, `/quality` per-tool 10/10 score, view-source link in every tool footer). This is rare in consumer products and benefits assistive tech users as a side effect: source is always available.
- **The ban on hover-only affordances, infinite scroll, modal stacks > 1, dark patterns, and celebratory microcopy** is a coherent accessibility posture, not just an ethics one.
- **RTL is implemented through logical properties** (`padding-inline`, `margin-inline-start`, `text-align: start`), and the typography stack includes `Noto Sans Arabic`. Numeric inputs stay LTR-digit in RTL, which is the correct UX.
- **Embed mode's `postMessage` contract** specifies JSON-validated commands, no PII, and origin verification — a strong baseline.
- **Touch-target policy** is 44 × 44 px on the shorter axis with padding extension — the right call.
- **Pinch-zoom is allowed** (`user-scalable=no` is forbidden in § 6.7). This alone prevents the most common mobile a11y regression.

---

## File / section references (quick index)

| Finding | File | Section |
|---|---|---|
| B1 Contrast | DESIGN.md | Colors; Component tokens; cross-checked with prd.md § 4.1 #9 |
| B2 Palette focus | EXPERIENCE.md | § 1.5; § 6.2 #3; § 6.6; § 7.1 |
| B3 Embed a11y | EXPERIENCE.md; DESIGN.md | § 10.1–10.6; "Embed iframe chrome" (line 955); prd.md § 4.4 FR-10 |
| H1 Validation | EXPERIENCE.md; DESIGN.md | § 4 Input; § 5 Validation error; Input section (line 776) |
| H2 Result tile | EXPERIENCE.md | § 4 Result Tile; § 7.1 |
| H3 Reflow | EXPERIENCE.md; DESIGN.md | § 8; "Layout & Spacing" |
| H4 History | EXPERIENCE.md | § 4 History Panel; § 5 |
| H5 Print | prd.md; EXPERIENCE.md | § 4.1 rubric #5; § 5 Print row |
| H6 Embed link | EXPERIENCE.md | § 10.4 |
| H7 Stepper/Toggle | EXPERIENCE.md | § 4 |
| H8 Forced-colors | DESIGN.md | High-contrast palette; Command Palette |
| H9 Reduced motion | EXPERIENCE.md; DESIGN.md | § 5 Reduced motion; Do #5 |
| H10 Pin | EXPERIENCE.md | § 4 Star (Pin) Button |

---

## Contradictions between DESIGN.md and EXPERIENCE.md

1. **History entry count.** DESIGN.md § "History Panel" (line 848) says "ten entries per tool." EXPERIENCE.md § 2 row 7 (line 110) and § 4 (line 333) say "last 20 inputs." Pick one — recommend 10 to match the PRD's Tool Contract § 4.1 #7.
2. **History panel position on mobile.** DESIGN.md § "History Panel" (line 852) says "below the result on mobile." EXPERIENCE.md § 8.2 "Tool Page <md" (line 532) says "History is a slide-up sheet (`h` toggles)." Resolve to "slide-up sheet on <md; inline sidebar on ≥md."
3. **History delete affordance.** DESIGN.md says "deletion is explicit via a per-row × button." EXPERIENCE.md § 4 says "Clear history is per-tool, with confirmation." Both are stated; the user-flow is per-row × for individual, per-tool "Clear" for bulk. Make this explicit.
4. **Settings modal size.** DESIGN.md § "Settings Modal" (line 428) fixes `panel-width` at `{spacing.dialog}` (560 px). EXPERIENCE.md § 8.2 "Settings Modal" (line 542) says "md/≥lg: centered modal, 720 px wide." The 720 px conflicts with the 560 px token. Resolve — 560 px is too narrow for the Settings sections described in DESIGN.md § "Settings Modal" (Theme, Language, Units, Default Currency, Font Scale, Reduced Motion, Clear Local Data, Export/Import). Recommend 720 px and update the token.
5. **Command palette focus-trap.** DESIGN.md § "Command Palette" says nothing about focus trap. EXPERIENCE.md § 1.5 / § 6.2 / § 6.6 are internally inconsistent (see B2). DESIGN.md does not contradict, but the EXPERIENCE.md contradictions must be resolved before the visual spec is locked to behavior.
6. **Reduced motion on cards.** DESIGN.md Do #5 (line 933) says "100ms scale-down on press" and "150ms translateY on card hover" are *kept* under reduced motion (just no bounce). EXPERIENCE.md § 5 (line 379) says "All transitions become 0 ms. … no fill animation, no slide." A "150ms translateY on hover" is a transition that becomes 0 ms in EXPERIENCE.md but is described as a kept motion in DESIGN.md. Resolve: drop the hover translate under reduced motion (EXPERIENCE.md), keep the shadow change as the affordance.
7. **First-Run Tip auto-dismiss.** EXPERIENCE.md § 1.3 Platform Primitives row 11 (line 39) says "auto after 8 s." § 5 row "First visit, no preferences" (line 380) does not specify auto-dismiss. Make consistent.
8. **Toast position.** EXPERIENCE.md § 1.6 (line 70) says "Bottom-center on <md … top-right on ≥md." § 4 "Toast" row (line 336) says "bottom-center on <md, top-right on ≥md." Consistent — but DESIGN.md § "Sticky surfaces" (line 688) says "Toasts stack from the bottom edge (`{spacing.s-5}` from bottom, centered inline)." The "centered inline" matches <md, but on ≥md should be top-right per EXPERIENCE.md. Update DESIGN.md to make the responsive rule explicit.

---

## Closing note

The two spines are doing something the rubric explicitly rewards: naming tokens, refusing synonyms, and treating the keyboard as a load-bearing contract. The blocking items above are tractable and not structural. After the contrast table (B1), the palette pattern decision (B2), and the embed a11y contract (B3) are written, the design is ready for implementation against the Tool Contract § 4.1 rubric.

*End of review.*
