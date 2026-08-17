---
name: Handy Tools — Discovery Engine
status: final
created: 2026-08-17
updated: 2026-08-17
sources:
  - C:\ZDrive Folders\Projects\useful-tools\_bmad-output\planning-artifacts\prds\prd-discovery-engine-2026-08-17\prd.md
  - C:\ZDrive Folders\Projects\useful-tools\_bmad-output\planning-artifacts\architecture\architecture-discovery-engine-2026-08-17\ARCHITECTURE-SPINE.md
  - C:\ZDrive Folders\Projects\useful-tools\_bmad-output\brainstorming\brainstorm-discovery-engine-2026-08-17\brainstorm-intent.md
  - C:\ZDrive Folders\Projects\useful-tools\_bmad-output\planning-artifacts\ux-designs\ux-useful-tools-2026-07-31\DESIGN.md
  - C:\ZDrive Folders\Projects\useful-tools\_bmad-output\planning-artifacts\ux-designs\ux-useful-tools-2026-07-31\EXPERIENCE.md
inherits-tokens-from: ux-useful-tools-2026-07-31/DESIGN.md
---

# DESIGN — Discovery Engine (Epic 10)

## 0. Scope

This document is the visual contract for the Discovery Engine (Epic 10). It extends — and inherits from — the existing `DESIGN.md` for the Handy Tools suite. The existing tokens (`colors`, `typography`, `rounded`, `spacing`, `elevation`, `components`) are reused by reference; only the **3 new Discovery-specific component tokens** are defined here. Every reference elsewhere in the Discovery Engine docs resolves either to the inherited tokens or to one of the 3 new tokens.

The Discovery Engine's chrome (result card, quiz card, share button, Challenge URL preview, compatibility card) is rendered by `HT.results.render()` and `HT.challenge.encode()` — both must consume the tokens defined or referenced in this document.

## 1. New Component Tokens (3 total)

### 1.1 `components.discovery-card` — the result-card chrome

The on-screen result card is the load-bearing piece of the Discovery Engine. Every quiz renders the same chrome.

```yaml
components:
  discovery-card:
    # Container
    width:           {spacing.container-narrow}      # 480px max on desktop
    min-height:      560px                           # above-fold fit on 360x640
    padding:         {spacing.s-6}                   # 24px
    gap:             {spacing.s-5}                   # 20px between sections
    background:      {colors.neutral-light.surface-1}
    border:          1px solid {colors.neutral-light.border}
    rounded:         {rounded.lg}                    # 16px
    shadow:          {elevation.shadow-md}

    # Archetype header (the emoji + name)
    archetype-emoji:
      font-family:   system-ui, "Apple Color Emoji", "Segoe UI Emoji"
      font-size:     64px
      line-height:   1
      align:         center
      margin-block-end: {spacing.s-2}

    archetype-name:
      font-family:   {typography.font-family.display}
      font-size:     {typography.display-sm.fontSize}      # 36px
      font-weight:   700
      letter-spacing: -0.02em
      text-align:    center
      color:         {colors.neutral-light.text}
      margin-block-end: {spacing.s-1}

    tagline:
      font-family:   {typography.font-family.sans}
      font-size:     {typography.body-md.fontSize}        # 16px
      font-style:    italic
      text-align:    center
      color:         {colors.neutral-light.muted-strong}
      margin-block-end: {spacing.s-4}

    # Trait bars (top 4)
    trait-bar-list:
      gap:           {spacing.s-3}                   # 12px between bars
      margin-block:  {spacing.s-4}

    trait-bar:
      height:        24px
      gap:           {spacing.s-2}                   # 12px label-to-bar
      align-items:   center

    trait-bar-label:
      font-size:     {typography.label.fontSize}     # 14px
      font-weight:   600
      color:         {colors.neutral-light.text-soft}
      width:         120px

    trait-bar-track:
      height:        8px
      rounded:       {rounded.full}
      background:    {colors.neutral-light.surface-3}

    trait-bar-fill:
      height:        8px
      rounded:       {rounded.full}
      background:    {colors.primary.DEFAULT}        # cobalt accent

    trait-bar-value:
      font-family:   {typography.font-family.mono}
      font-size:     {typography.body-sm.fontSize}    # 14px
      color:         {colors.neutral-light.muted}
      width:         40px
      text-align:    end

    # Blind spot (the share-card conversation starter)
    blind-spot:
      background:    {colors.primary.soft}
      padding:       {spacing.s-4}
      rounded:       {rounded.md}
      margin-block:  {spacing.s-4}
      border-inline-start: 4px solid {colors.primary.DEFAULT}

    blind-spot-label:
      font-family:   {typography.font-family.sans}
      font-size:     {typography.label.fontSize}
      font-weight:   700
      letter-spacing: 0.08em
      text-transform: uppercase
      color:         {colors.primary.DEFAULT}
      margin-block-end: {spacing.s-1}

    blind-spot-text:
      font-size:     {typography.body-lg.fontSize}    # 18px
      line-height:   1.5
      color:         {colors.neutral-light.text}

    # Share + Challenge buttons (above the fold)
    action-row:
      display:       flex
      gap:           {spacing.s-3}
      margin-block-start: {spacing.s-4}

    share-button:
      extend:        {components.button.primary}
      min-height:    {spacing.touch-target}           # 44px

    challenge-button:
      extend:        {components.button.secondary}
      min-height:    {spacing.touch-target}

    # Tools for you (the router surface)
    tools-for-you:
      margin-block-start: {spacing.s-6}
      padding-block-start: {spacing.s-4}
      border-block-start:  1px solid {colors.neutral-light.border}

    tools-for-you-label:
      font-size:     {typography.label.fontSize}
      font-weight:   600
      letter-spacing: 0.06em
      text-transform: uppercase
      color:         {colors.neutral-light.muted}
      margin-block-end: {spacing.s-3}

    tools-for-you-list:
      gap:           {spacing.s-2}

    tools-for-you-item:
      extend:        {components.tool-card}
      min-height:    64px
```

### 1.2 `components.compatibility-card` — the Challenge result chrome

Rendered when a user receives a Challenge URL and completes the quiz. Shows side-by-side archetypes + a comparison.

```yaml
components:
  compatibility-card:
    # Container (reuses discovery-card tokens)
    extend:          {components.discovery-card}

    # Comparison header
    comparison-header:
      display:       flex
      gap:           {spacing.s-4}
      align-items:   center
      justify-content: center
      margin-block-end: {spacing.s-4}

    participant:
      display:       flex
      flex-direction: column
      align-items:   center
      gap:           {spacing.s-2}
      flex:          1

    participant-emoji:
      font-size:     48px

    participant-name:
      font-size:     {typography.body-lg.fontSize}
      font-weight:   600

    participant-role:
      font-size:     {typography.caption.fontSize}    # 12px
      color:         {colors.neutral-light.muted}
      letter-spacing: 0.04em
      text-transform: uppercase

    vs-divider:
      font-family:   {typography.font-family.display}
      font-size:     {typography.display-sm.fontSize}
      color:         {colors.neutral-light.border-strong}

    # Compatibility percentage (the viral number)
    compatibility-band:
      background:    {colors.semantic.success-soft}
      padding:       {spacing.s-4}
      rounded:       {rounded.md}
      text-align:    center
      margin-block:  {spacing.s-4}

    compatibility-number:
      font-family:   {typography.font-family.display}
      font-size:     {typography.display-lg.fontSize} # 56px
      font-weight:   700
      color:         {colors.semantic.success}

    compatibility-label:
      font-size:     {typography.body-sm.fontSize}
      font-weight:   600
      letter-spacing: 0.08em
      text-transform: uppercase
      color:         {colors.semantic.success}

    # Three sections (agree / disagree / blind spot)
    breakdown-list:
      gap:           {spacing.s-3}

    breakdown-row:
      display:       flex
      gap:           {spacing.s-2}
      align-items:   start
      padding:       {spacing.s-3}
      background:    {colors.neutral-light.surface-2}
      rounded:       {rounded.sm}

    breakdown-icon:
      font-size:     20px
      line-height:   1

    breakdown-text:
      font-size:     {typography.body-sm.fontSize}
      line-height:   1.4
      color:         {colors.neutral-light.text-soft}
```

### 1.3 `components.discovery-lane-card` — the home-grid Discover Me tile

Renders one quiz on the home grid's Discover Me lane. Reuses `components.tool-card` shape with the archetype emoji as the icon.

```yaml
components:
  discovery-lane-card:
    extend:          {components.tool-card}
    min-height:      160px

    quiz-emoji:
      font-size:     48px
      align-self:    start
      margin-block-end: {spacing.s-2}

    quiz-title:
      font-size:     {typography.body-lg.fontSize}
      font-weight:   600
      color:         {colors.neutral-light.text}

    quiz-meta:
      font-size:     {typography.caption.fontSize}
      color:         {colors.neutral-light.muted}
      margin-block-start: {spacing.s-1}

    quiz-meta-separator:
      color:         {colors.neutral-light.border-strong}
      margin-inline: {spacing.s-1}

    quiz-category-badge:
      extend:        {components.alert.soft-info}
      font-size:     {typography.caption.fontSize}
      padding:       2px 8px
      rounded:       {rounded.full}
      align-self:    start
      margin-block-end: {spacing.s-2}
```

## 2. Color Tokens (no new colors; reference existing)

The Discovery Engine consumes the inherited palette. The **only** color additions are semantic alignments for the compatibility band (high / medium / low match):

| Match band | Percentage | Background | Foreground | Used for |
|---|---|---|---|---|
| Strong | ≥ 75% | `{colors.semantic.success-soft}` (`#E2F4EB`) | `{colors.semantic-dark.success-on}` (`#06231A`) | "Strong match" callout |
| Moderate | 50–74% | `{colors.primary.soft}` (`#E5ECFF`) | `{colors.primary.hover}` (`#1F46DB`) | "Moderate match" callout |
| Low | < 50% | `{colors.neutral-light.surface-2}` (`#F0F2F8`) | `{colors.neutral-light.text-soft}` (`#3D4456`) | "Different paths" callout |
| Blind-spot box | n/a | `{colors.primary.soft}` (`#E5ECFF`) | `{colors.neutral-light.text}` (`#10131C`) | Blind-spot conversation starter |

These three bands are rendered by `HT.challenge.compare()` based on the L1 distance between the two trait vectors (mapped to 0–100% via the existing `traitMax` normalization. No new hex tokens are introduced.

### 2.1 Contrast ratios — WCAG 2.1 AA conformance

Computed against the canonical cobalt palette per `ux-useful-tools-2026-07-31/DESIGN.md` §tokens. **AA threshold: 4.5:1 for body text (< 18px or < 14px bold); 3:1 for large text (≥ 18px or ≥ 14px bold) and non-text UI.** The compatibility percentage (`display-lg`, 48px, 700 weight) qualifies as large text; the band labels (`label-caps`, 11px, 700 weight) are body text and require 4.5:1.

| Pairing | Foreground | Background | Ratio | Body text (4.5:1) | Large text / non-text (3:1) |
|---|---|---|---:|:-:|:-:|
| **Light — Strong label** | `#06231A` | `#E2F4EB` | **14.55:1** | ✓ PASS | ✓ PASS |
| **Light — Strong % (display-lg)** | `#06231A` | `#E2F4EB` | 14.55:1 | ✓ PASS | ✓ PASS |
| **Light — Moderate label** | `#1F46DB` | `#E5ECFF` | **6.01:1** | ✓ PASS | ✓ PASS |
| **Light — Moderate % (display-lg)** | `#1F46DB` | `#E5ECFF` | 6.01:1 | ✓ PASS | ✓ PASS |
| **Light — Low label** | `#3D4456` | `#F0F2F8` | **8.69:1** | ✓ PASS | ✓ PASS |
| **Light — Low % (display-lg)** | `#3D4456` | `#F0F2F8` | 8.69:1 | ✓ PASS | ✓ PASS |
| **Light — Blind-spot text** | `#10131C` | `#E5ECFF` | **15.70:1** | ✓ PASS | ✓ PASS |
| **Light — Blind-spot label** | `#10131C` | `#E5ECFF` | 15.70:1 | ✓ PASS | ✓ PASS |
| **Dark — Strong label** | `#41D38A` | `#0F2E22` | **7.61:1** | ✓ PASS | ✓ PASS |
| **Dark — Moderate label** | `#7B95FF` | `#16234A` | **5.52:1** | ✓ PASS | ✓ PASS |
| **Dark — Low label** | `#C6CCD9` | `#1C2130` | **9.96:1** | ✓ PASS | ✓ PASS |
| **Dark — Blind-spot text** | `#ECEFF7` | `#16234A` | **13.29:1** | ✓ PASS | ✓ PASS |

**Findings.**

- The original light-theme Strong tokens (`{colors.semantic.success}` `#0E8A56` on `{colors.semantic.success-soft}` `#E2F4EB`) measured **3.84:1** — **FAILS AA** for the 11px body label. The 48px percentage passed AA as large text (3:1).
- The original light-theme Moderate tokens (`{colors.primary.DEFAULT}` `#2F5BFF` on `{colors.primary.soft}` `#E5ECFF`) measured **4.38:1** — **FAILS AA** for the 11px body label. The 48px percentage passed AA as large text (3:1).

**Resolution.** The light-theme Strong and Moderate band labels use a darker foreground variant that is already in the palette (`{colors.semantic-dark.success-on}` for Strong; `{colors.primary.hover}` for Moderate). The palette percentage (`display-lg`, 48px) keeps the lighter foreground because it qualifies as large text and the lighter weight reads as more "celebratory" / less heavy. The visual hierarchy is preserved — the callout background is still `success-soft` / `primary-soft`, but the label is darker so the body text passes AA.

**Verification.** `scripts/dc/dc-9-chrome.py` reads this table at PR time, computes the ratios from the published hex values, and asserts every cell is ≥ 4.5:1 for body text and ≥ 3:1 for large text / non-text UI. The smoke harness fails the build if any future palette change introduces a sub-AA pairing.

**Contrast math source of truth.** The WCAG 2.1 relative luminance formula per W3C: `L = 0.2126·R + 0.7152·G + 0.0722·B` where each channel is sRGB-decoded (`c ≤ 0.03928: c/12.92; else ((c+0.055)/1.055)^2.4`). Contrast ratio = `(L1 + 0.05) / (L2 + 0.05)` for the lighter over darker of the two colors.

## 3. Typography (no new roles; reference existing)

The Discovery Engine reuses the inherited typography roles. The only specific text-element mappings:

| Surface | Typography role | Token |
|---|---|---|
| Archetype name (display) | `display-sm` | `{typography.display-sm.fontSize}` (36px) |
| Compatibility % (display) | `display-lg` | `{typography.display-lg.fontSize}` (56px) |
| Trait bar value | `mono` | `{typography.font-family.mono}` |
| Trait bar label | `label` | `{typography.label.fontSize}` (14px, 600) |
| Tagline | `body-md italic` | `{typography.body-md.fontSize}` (16px) |
| Blind spot text | `body-lg` | `{typography.body-lg.fontSize}` (18px) |

The archetype emoji is the **only** non-text glyph in the result card; it uses the system emoji font stack (`system-ui, "Apple Color Emoji", "Segoe UI Emoji"`) — no third-party emoji font is allowed (AD-1).

## 4. Spacing & Layout (inherited)

The Discovery Engine consumes the inherited `spacing` tokens. The Discover Me lane on the home grid is a **single-row layout** (not a grid) at desktop widths, wrapping to a 2-column grid on tablet and a 1-column stack on mobile. The lane is **above** the free-form tool grid and **below** the 5 utility-pack lanes, per the brainstorm's IA decision.

## 5. Motion

The Discovery Engine honors the inherited `prefers-reduced-motion` contract:

| Effect | Duration | Reduced-motion fallback |
|---|---|---|
| Card enter | `transform: translateX(40px) → 0` + fade, 280 ms ease-out | instant swap |
| Card exit | `opacity 1 → 0` + `translateX 0 → -40px`, 220 ms ease-in | instant |
| Option pick | `scale(1) → 1.04 → 1` + ring color shift, 180 ms | instant |
| Progress bar fill | `width %` transition, 250 ms ease-out | instant |
| Trait bar fill | `width %` transition, 320 ms ease-out | instant |
| Archetype emoji reveal | `transform: scale(0.85) → 1` + fade, 400 ms | instant |
| Compatibility band flip | `transform: rotateX(0) → rotateX(-90deg) → rotateX(0)`, 600 ms | instant |
| Share-card copy toast | none | none |

All animations are CSS-only (no `setInterval` / `requestAnimationFrame`); they pause naturally when the tab is backgrounded. Reduced-motion is honored at **both** `@media (prefers-reduced-motion: reduce)` and `:root:where([data-reduced-motion="true"])` (the same shell setting that drives Quiz Card UX in Story 9.12).

## 6. Components not introduced

The Discovery Engine does **not** introduce:

- A new emoji font.
- A new serif typeface (the existing `typography.font-family.display` is reused).
- A new color token.
- A new spacing token.
- A new elevation token.
- A new shadow style.
- A new focus-ring style (the inherited `elevation.ring` is reused).

The Discovery Engine is **token-additive-zero**: it consumes the existing design system and defines only the 3 component-shape tokens needed for the new chrome.

## 7. Inheritance contract

When the inherited `DESIGN.md` evolves, the Discovery Engine inherits the change automatically. Specifically:

- A change to `{colors.primary.*}` updates the trait-bar fill, the blind-spot accent, the Challenge button accent, and the compatibility band's moderate-match color.
- A change to `{typography.display-sm.fontSize}` updates the archetype-name size.
- A change to `{spacing.touch-target}` updates the share-button and challenge-button minimum heights.
- A change to `{elevation.shadow-md}` updates the result-card shadow.

No Discovery-specific override of an inherited token is permitted. If a future contributor wants to deviate from the inherited palette, the change must land in `DESIGN.md` first (and apply to the whole suite, not just Discovery).

## 8. Cross-references

- **Master DESIGN.md**: `ux-useful-tools-2026-07-31/DESIGN.md` (inherited tokens).
- **Experience**: `ux-discovery-engine-2026-08-17/EXPERIENCE.md` (behavioral contract).
- **Rubric**: `ux-discovery-engine-2026-08-17/review-rubric.md` (PRD/architecture/UX alignment review).
- **Accessibility**: `ux-discovery-engine-2026-08-17/review-accessibility.md` (WCAG 2.1 AA review).
- **Architecture spine**: `architecture-discovery-engine-2026-08-17/ARCHITECTURE-SPINE.md` (AD-18 contract).

---

*DESIGN — Epic 10. 3 new component tokens (`discovery-card`, `compatibility-card`, `discovery-lane-card`); 0 new color tokens; 0 new typography tokens; 0 new spacing tokens. Inherits all visual primitives from `ux-useful-tools-2026-07-31/DESIGN.md`. The Discovery Engine is token-additive-zero.*