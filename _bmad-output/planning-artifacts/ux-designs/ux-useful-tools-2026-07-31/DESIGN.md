---
name: Handy Tools
status: final
sources:
  - C:\ZDrive Folders\Projects\useful-tools\_bmad-output\planning-artifacts\prds\prd-useful-tools-2026-07-31\prd.md
  - C:\ZDrive Folders\Projects\useful-tools\_bmad-output\planning-artifacts\briefs\brief-useful-tools-2026-07-31\brief.md
  - C:\ZDrive Folders\Projects\useful-tools\_bmad-output\brainstorming\brainstorm-useful-tools-2026-07-31\brainstorm-intent.md
  - C:\ZDrive Folders\Projects\useful-tools\index.html
  - C:\ZDrive Folders\Projects\useful-tools\assets\css\base.css
  - C:\ZDrive Folders\Projects\useful-tools\assets\css\components.css
  - C:\ZDrive Folders\Projects\useful-tools\assets\css\tools.css
updated: 2026-07-31

# =========================================================================
# TOKENS
# Every token below is referenceable from the body as {colors.path.to.token},
# {typography.path.to.token}, {rounded.path}, {spacing.path},
# {components.path.to.token}. Same name, same meaning — no synonyms.
# =========================================================================

colors:
  # --- Brand / primary ---
  primary:
    DEFAULT: '#2F5BFF'           # refined cobalt; reads as instrument, not app
    hover:    '#1F46DB'
    pressed:  '#1736B8'
    on:       '#FFFFFF'
    soft:     '#E5ECFF'           # low-saturation tint for surfaces
    soft-strong: '#C7D4FF'

  # --- Neutrals (light) ---
  neutral-light:
    bg:           '#F6F7FB'       # canvas — never pure white
    surface-1:    '#FFFFFF'       # cards, panels
    surface-2:    '#F0F2F8'       # nesteds, chips, hovered surfaces
    surface-3:    '#E5E8F0'       # wells, pre-formatted code blocks
    border:       '#E1E4EC'       # hairline 1px
    border-strong:'#CCD1DC'
    text:         '#10131C'       # ink — high contrast, never pure black
    text-soft:    '#3D4456'       # secondary prose
    muted:        '#69708A'       # labels, captions
    muted-strong: '#454C61'

  # --- Neutrals (dark) ---
  neutral-dark:
    bg:           '#0B0D14'       # canvas — never pure black
    surface-1:    '#141823'       # cards, panels
    surface-2:    '#1C2130'       # nesteds, chips
    surface-3:    '#252B3D'       # wells
    border:       '#2A3041'       # hairline 1px
    border-strong:'#3A4258'
    text:         '#ECEFF7'       # paper
    text-soft:    '#C6CCD9'       # secondary prose
    muted:        '#8C95A8'       # labels, captions
    muted-strong: '#B2BACB'

  # --- Semantic ---
  semantic:
    success:        '#0E8A56'
    success-on:     '#FFFFFF'
    success-soft:   '#E2F4EB'
    warning:        '#B36B00'
    warning-on:     '#FFFFFF'
    warning-soft:   '#FBEFD9'
    danger:         '#C0282B'
    danger-on:      '#FFFFFF'
    danger-soft:    '#FBE5E5'
    info:           '#2F5BFF'           # same hue as primary by design
    info-on:        '#FFFFFF'
    info-soft:      '#E5ECFF'

  # Dark-mode siblings of semantic — distinct hues, same job.
  semantic-dark:
    success:        '#41D38A'
    success-on:     '#06231A'
    success-soft:   '#0F2E22'
    warning:        '#F2B43A'
    warning-on:     '#2A1A00'
    warning-soft:   '#2D2210'
    danger:         '#F26D6F'
    danger-on:      '#2C0A0B'
    danger-soft:    '#2E1415'
    info:           '#7B95FF'
    info-on:        '#06122E'
    info-soft:      '#16234A'

  # --- Trust accent ---
  # The single color used for primary actions, focus rings, links,
  # keyboard cursor, and embed snippets. It is the same hue as `primary`
  # by intent: trust, identity, and action are never separable.
  trust:
    accent:         '{colors.primary.DEFAULT}'
    accent-hover:   '{colors.primary.hover}'
    accent-pressed: '{colors.primary.pressed}'
    focus-ring:     '{colors.primary.DEFAULT}'

  # --- High-contrast / forced-colors palette ---
  # Wins under `forced-colors: active` (Windows High Contrast, etc.).
  # Honors the system palette so the OS controls actually paint.
  high-contrast:
    bg:           'Canvas'
    surface-1:    'Canvas'
    surface-2:    'Canvas'
    surface-3:    'Canvas'
    border:       'CanvasText'
    border-strong:'CanvasText'
    text:         'CanvasText'
    text-soft:    'CanvasText'
    muted:        'CanvasText'
    accent:       'Highlight'        # primary CTA in HC mode
    accent-on:    'HighlightText'
    success:      'Highlight'
    warning:      'Mark'
    danger:       'Mark'
    focus-ring:   'Highlight'
    link:         'LinkText'

typography:
  # System-first font stack — no web fonts. Honors PRD §4.10 / §4.7.
  # Arabic (RTL) catalog falls back to system-ui+script-aware stacks.
  font-family:
    sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Noto Sans", "Noto Sans Arabic", Arial, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"'
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", "Noto Sans Mono", monospace'
    math: 'Cambria Math, "Latin Modern Math", STIX Two Math, serif'

  # Roles — every referenceable scale step.
  display-lg:
    fontFamily: '{typography.font-family.sans}'
    fontSize: '48px'
    lineHeight: '1.05'
    fontWeight: '700'
    letterSpacing: '-0.025em'
  display-md:
    fontFamily: '{typography.font-family.sans}'
    fontSize: '36px'
    lineHeight: '1.1'
    fontWeight: '700'
    letterSpacing: '-0.02em'
  display-sm:
    fontFamily: '{typography.font-family.sans}'
    fontSize: '28px'
    lineHeight: '1.15'
    fontWeight: '700'
    letterSpacing: '-0.015em'
  headline:
    fontFamily: '{typography.font-family.sans}'
    fontSize: '22px'
    lineHeight: '1.25'
    fontWeight: '600'
    letterSpacing: '-0.01em'
  body-lg:
    fontFamily: '{typography.font-family.sans}'
    fontSize: '18px'
    lineHeight: '1.6'
    fontWeight: '400'
    letterSpacing: '0'
  body-md:
    fontFamily: '{typography.font-family.sans}'
    fontSize: '16px'
    lineHeight: '1.55'
    fontWeight: '400'
    letterSpacing: '0'
  body-sm:
    fontFamily: '{typography.font-family.sans}'
    fontSize: '14px'
    lineHeight: '1.5'
    fontWeight: '400'
    letterSpacing: '0'
  label:
    fontFamily: '{typography.font-family.sans}'
    fontSize: '13px'
    lineHeight: '1.3'
    fontWeight: '600'
    letterSpacing: '0.02em'
  label-caps:
    fontFamily: '{typography.font-family.sans}'
    fontSize: '11px'
    lineHeight: '1.3'
    fontWeight: '700'
    letterSpacing: '0.08em'
    textTransform: 'uppercase'
  caption:
    fontFamily: '{typography.font-family.sans}'
    fontSize: '12px'
    lineHeight: '1.4'
    fontWeight: '500'
    letterSpacing: '0.01em'
  mono:
    fontFamily: '{typography.font-family.mono}'
    fontSize: '14px'
    lineHeight: '1.5'
    fontWeight: '400'
    letterSpacing: '0'
  result-xl:
    fontFamily: '{typography.font-family.sans}'
    fontSize: '40px'
    lineHeight: '1.1'
    fontWeight: '700'
    letterSpacing: '-0.02em'
  result-lg:
    fontFamily: '{typography.font-family.sans}'
    fontSize: '24px'
    lineHeight: '1.2'
    fontWeight: '700'
    letterSpacing: '-0.01em'

  # Responsive clamps (mobile ≤ 640px).
  mobile:
    display-lg: '32px'
    display-md: '28px'
    display-sm: '24px'
    headline:   '20px'
    body-lg:    '17px'
    result-xl:  '32px'

rounded:
  none: '0'
  sm:   '6px'        # inputs, inline chips
  md:   '10px'       # buttons, tiles, panels
  lg:   '14px'       # tool cards, dialogs, shells
  xl:   '20px'       # hero surfaces, brand mark frame
  full: '9999px'     # pills only (badges, status)

spacing:
  unit:        '4px'      # base unit — every token is a multiple of this
  # Numerical scale.
  s-1:  '4px'    # s-1 .. s-9 below.
  s-2:  '8px'
  s-3:  '12px'
  s-4:  '16px'
  s-5:  '20px'
  s-6:  '24px'
  s-7:  '32px'
  s-8:  '40px'
  s-9:  '48px'
  s-10: '64px'
  s-11: '80px'
  s-12: '96px'
  # Semantic aliases — same values as above; aliased for the prose.
  gutter:        '{spacing.s-6}'    # 24px — between cards in a grid
  margin-mobile: '{spacing.s-5}'    # 20px — page edge on small screens
  margin-desktop:'{spacing.s-10}'   # 64px — page top, large viewports
  section-gap:   '{spacing.s-9}'    # 48px — between major sections
  row-gap:       '{spacing.s-4}'    # 16px — default vertical gap in a stack
  inline-gap:    '{spacing.s-2}'    # 8px  — gap between icon and label
  # Layout caps.
  container-narrow: '720px'   # tool bodies; reading width
  container-wide:   '1100px'  # home grid, pack pages
  dialog:           '560px'   # command palette, settings modal
  header-height:    '64px'
  touch-target:     '44px'    # PRD §4.1 rubric #2

elevation:
  shadow-0:  'none'
  shadow-sm: '0 1px 1px rgba(16, 19, 28, 0.04), 0 1px 2px rgba(16, 19, 28, 0.06)'
  shadow-md: '0 2px 4px rgba(16, 19, 28, 0.06), 0 8px 16px rgba(16, 19, 28, 0.06)'
  shadow-lg: '0 4px 12px rgba(16, 19, 28, 0.08), 0 16px 32px rgba(16, 19, 28, 0.10)'
  shadow-xl: '0 8px 24px rgba(16, 19, 28, 0.12), 0 24px 56px rgba(16, 19, 28, 0.16)'

  # Dark theme — same five levels, lower lightness, deeper alpha.
  shadow-sm-dark: '0 1px 1px rgba(0, 0, 0, 0.30), 0 1px 3px rgba(0, 0, 0, 0.40)'
  shadow-md-dark: '0 2px 4px rgba(0, 0, 0, 0.35), 0 8px 16px rgba(0, 0, 0, 0.45)'
  shadow-lg-dark: '0 4px 12px rgba(0, 0, 0, 0.40), 0 16px 32px rgba(0, 0, 0, 0.50)'
  shadow-xl-dark: '0 8px 24px rgba(0, 0, 0, 0.50), 0 24px 56px rgba(0, 0, 0, 0.60)'

  # Forced-colors mode replaces every shadow with a 1px border.
  shadow-forced:
    box-shadow: 'none'
    border:     '1px solid CanvasText'

  # Inner glow used on focus rings — single ring color, 3px halo.
  ring:
    color:      '{colors.trust.focus-ring}'
    width:      '3px'
    offset:     '2px'
    border-radius: '{rounded.sm}'

# =========================================================================
# COMPONENT TOKENS
# Each entry: name · variants · states (default/hover/focus/active/disabled).
# References bodies of the brand with {path.to.token} syntax only.
# =========================================================================

components:

  button:
    height-lg: '44px'
    height-md: '36px'
    height-sm: '28px'
    padding-inline-lg: '{spacing.s-6}'
    padding-inline-md: '{spacing.s-5}'
    padding-inline-sm: '{spacing.s-3}'
    radius:    '{rounded.md}'
    weight:    '600'
    font-size: '14px'

    primary:
      bg:            '{colors.primary.DEFAULT}'
      bg-hover:      '{colors.primary.hover}'
      bg-pressed:    '{colors.primary.pressed}'
      fg:            '{colors.primary.on}'
      border:        'transparent'
      shadow:        '{elevation.shadow-sm}'
      hover-shadow:  '{elevation.shadow-md}'
      focus-ring:    '{elevation.ring}'
      disabled-bg:   '{colors.neutral-light.surface-2}'
      disabled-fg:   '{colors.neutral-light.muted}'
      disabled-shadow:'none'

    secondary:
      bg:            '{colors.neutral-light.surface-1}'
      bg-hover:      '{colors.neutral-light.surface-2}'
      bg-pressed:    '{colors.neutral-light.surface-3}'
      fg:            '{colors.neutral-light.text}'
      border:        '{colors.neutral-light.border}'
      focus-ring:    '{elevation.ring}'

    ghost:
      bg:            'transparent'
      bg-hover:      '{colors.neutral-light.surface-2}'
      bg-pressed:    '{colors.neutral-light.surface-3}'
      fg:            '{colors.neutral-light.text-soft}'
      fg-hover:      '{colors.neutral-light.text}'
      border:        'transparent'
      focus-ring:    '{elevation.ring}'

    destructive:
      bg:            'transparent'
      bg-hover:      '{colors.semantic.danger-soft}'
      fg:            '{colors.semantic.danger}'
      border:        '{colors.neutral-light.border}'
      hover-border:  '{colors.semantic.danger}'
      focus-ring:    '{elevation.ring}'
      confirmed-bg:  '{colors.semantic.danger}'
      confirmed-fg:  '{colors.semantic.danger-on}'

  input:
    height:         '40px'    # baseline; min touch target reserved via padding
    radius:         '{rounded.sm}'
    padding-x:      '{spacing.s-3}'
    bg:             '{colors.neutral-light.surface-1}'
    bg-disabled:    '{colors.neutral-light.surface-2}'
    fg:             '{colors.neutral-light.text}'
    placeholder:    '{colors.neutral-light.muted}'
    border:         '{colors.neutral-light.border}'
    border-hover:   '{colors.neutral-light.border-strong}'
    border-focus:   '{colors.trust.accent}'
    ring:           '{elevation.ring}'
    border-error:   '{colors.semantic.danger}'
    label-size:     '{typography.label.fontSize}'
    hint-size:      '{typography.caption.fontSize}'
    mono:           '{typography.mono}'

  select:
    # Native <select> styled; chevron drawn inline to avoid an asset.
    height:         '40px'
    radius:         '{rounded.sm}'
    padding-x:      '{spacing.s-3}'
    chevron-size:   '16px'
    chevron-color:  '{colors.neutral-light.muted}'

  textarea:
    min-height:     '120px'
    radius:         '{rounded.md}'
    padding:        '{spacing.s-3}'
    mono:           '{typography.mono}'

  result-tile:
    bg:             '{colors.neutral-light.surface-2}'
    border:         '{colors.neutral-light.border}'
    radius:         '{rounded.md}'
    padding:        '{spacing.s-4}'
    label-size:     '{typography.label-caps}'
    label-fg:       '{colors.neutral-light.muted}'
    value-size:     '{typography.result-lg}'
    value-fg:       '{colors.neutral-light.text}'
    accent-value-fg:'{colors.primary.DEFAULT}'
    copy-icon-color:'{colors.neutral-light.muted-strong}'

  result-card:
    bg:             '{colors.primary.soft}'
    border:         'color-mix(in srgb, {colors.primary.DEFAULT} 28%, transparent)'
    radius:         '{rounded.lg}'
    padding:        '{spacing.s-6}'
    shadow:         '{elevation.shadow-sm}'

  tool-card:
    bg:             '{colors.neutral-light.surface-1}'
    bg-hover:       '{colors.neutral-light.surface-1}'
    border:         '{colors.neutral-light.border}'
    border-hover:   '{colors.primary.DEFAULT}'
    border-accent:  'color-mix(in srgb, {colors.primary.DEFAULT} 30%, {colors.neutral-light.border})'
    radius:         '{rounded.lg}'
    padding:        '{spacing.s-5}'
    icon-bg:        '{colors.primary.soft}'
    icon-fg:        '{colors.primary.DEFAULT}'
    title-size:     '{typography.body-md.fontSize}'
    title-weight:   '{typography.body-md.fontWeight}'
    desc-size:      '{typography.body-sm.fontSize}'
    desc-fg:        '{colors.neutral-light.muted}'
    hover-translate:'-2px'
    hover-shadow:   '{elevation.shadow-md}'
    featured-span:  '2'                # grid-column span on desktop

  command-palette:
    backdrop:        'rgba(11, 13, 20, 0.45)'
    panel-bg:        '{colors.neutral-light.surface-1}'
    panel-radius:    '{rounded.lg}'
    panel-shadow:    '{elevation.shadow-xl}'
    panel-width:     '{spacing.dialog}'     # 560px
    input-height:    '52px'
    item-height:     '44px'
    item-padding-x:  '{spacing.s-4}'
    item-radius:     '{rounded.sm}'
    item-hover-bg:   '{colors.neutral-light.surface-2}'
    item-active-bg:  '{colors.primary.DEFAULT}'
    item-active-fg:  '{colors.primary.on}'
    item-inactive-fg:'{colors.neutral-light.text}'
    item-meta-fg:    '{colors.neutral-light.muted}'
    divider:         '{colors.neutral-light.border}'
    footer-fg:       '{colors.neutral-light.muted}'
    footer-size:     '{typography.caption.fontSize}'

  settings-modal:
    backdrop:        'rgba(11, 13, 20, 0.55)'
    panel-bg:        '{colors.neutral-light.surface-1}'
    panel-radius:    '{rounded.lg}'
    panel-width:     '{spacing.dialog}'
    panel-padding:   '{spacing.s-6}'
    section-gap:     '{spacing.s-5}'
    group-title-size:'{typography.label-caps}'
    group-title-fg:  '{colors.neutral-light.muted}'

  history-panel:
    width:            '320px'
    bg:               '{colors.neutral-light.surface-1}'
    border:           '{colors.neutral-light.border}'
    radius:           '{rounded.lg}'
    padding:          '{spacing.s-4}'
    entry-padding:    '{spacing.s-3}'
    entry-radius:     '{rounded.sm}'
    entry-hover-bg:   '{colors.neutral-light.surface-2}'
    entry-active-bg:  '{colors.primary.soft}'
    meta-size:        '{typography.caption.fontSize}'
    meta-fg:          '{colors.neutral-light.muted}'
    divider:          '{colors.neutral-light.border}'

  tool-header:
    padding-block:    '{spacing.s-6}'
    title-size:       '{typography.display-sm.fontSize}'
    subtitle-size:    '{typography.body-lg.fontSize}'
    subtitle-fg:      '{colors.neutral-light.muted}'
    back-link-fg:     '{colors.neutral-light.muted}'
    back-link-hover:  '{colors.primary.DEFAULT}'

  tool-footer:
    padding-block:    '{spacing.s-5}'
    fg:               '{colors.neutral-light.muted}'
    fg-strong:        '{colors.neutral-light.text-soft}'
    size:             '{typography.caption.fontSize}'
    link-fg:          '{colors.primary.DEFAULT}'
    separator:        '{colors.neutral-light.border}'

  alert:
    radius:           '{rounded.md}'
    padding:          '{spacing.s-4}'
    icon-size:        '18px'
    title-size:       '{typography.label}'
    body-size:        '{typography.body-sm}'
    # Variants below share the variant → colors binding.
    info:
      bg:        '{colors.semantic.info-soft}'
      border:    'color-mix(in srgb, {colors.semantic.info} 30%, transparent)'
      fg:        '{colors.neutral-light.text}'
      icon-fg:   '{colors.semantic.info}'
    success:
      bg:        '{colors.semantic.success-soft}'
      border:    'color-mix(in srgb, {colors.semantic.success} 30%, transparent)'
      fg:        '{colors.neutral-light.text}'
      icon-fg:   '{colors.semantic.success}'
    warning:
      bg:        '{colors.semantic.warning-soft}'
      border:    'color-mix(in srgb, {colors.semantic.warning} 35%, transparent)'
      fg:        'color-mix(in srgb, {colors.semantic.warning} 80%, {colors.neutral-light.text})'
      icon-fg:   '{colors.semantic.warning}'
    error:
      bg:        '{colors.semantic.danger-soft}'
      border:    'color-mix(in srgb, {colors.semantic.danger} 35%, transparent)'
      fg:        'color-mix(in srgb, {colors.semantic.danger} 80%, {colors.neutral-light.text})'
      icon-fg:   '{colors.semantic.danger}'

  empty-state:
    padding:          '{spacing.s-10}'
    text-align:       'center'
    icon-size:        '32px'
    icon-fg:          '{colors.neutral-light.muted}'
    title-size:       '{typography.headline.fontSize}'
    title-fg:         '{colors.neutral-light.text}'
    desc-size:        '{typography.body-md.fontSize}'
    desc-fg:          '{colors.neutral-light.muted}'
    max-width:        '420px'
    margin-inline:    'auto'

  keyboard-help-overlay:
    bg:               '{colors.neutral-light.surface-1}'
    border:           '{colors.neutral-light.border}'
    radius:           '{rounded.lg}'
    shadow:           '{elevation.shadow-xl}'
    width:            '640px'
    padding:          '{spacing.s-6}'
    column-gap:       '{spacing.s-6}'
    row-gap:          '{spacing.s-3}'
    kbd-bg:           '{colors.neutral-light.surface-3}'
    kbd-radius:       '{rounded.sm}'
    kbd-padding-x:    '{spacing.s-2}'
    kbd-min-width:    '28px'
    kbd-fg:           '{colors.neutral-light.text}'
    label-fg:         '{colors.neutral-light.text-soft}'
    label-size:       '{typography.body-sm.fontSize}'

  embed-chip:
    # The ⌘C-friendly snippet box. Lives on every tool page under
    # `?embed=1`. Silent by design — no Handy Tools branding.
    bg:               '{colors.neutral-light.surface-3}'
    border:           '{colors.neutral-light.border}'
    radius:           '{rounded.md}'
    padding:          '{spacing.s-3}'
    mono:             '{typography.mono}'
    fg:               '{colors.neutral-light.text}'
    copy-fg:          '{colors.primary.DEFAULT}'
    copy-bg-hover:    '{colors.primary.soft}'
    line-height:      '1.4'
    max-width:        '560px'

# =========================================================================
# END TOKENS — body begins.
# =========================================================================
---

# Handy Tools — DESIGN.md

This document is the visual identity contract for Handy Tools. It pairs with EXPERIENCE.md (behavior) which references its tokens via `{path.to.token}` syntax. Sources are listed in the YAML frontmatter. The PRD Glossary is the terminological authority; tokens here share names, never synonyms.

## Brand & Style

Handy Tools is a **tool operating system**: a small, finished, well-made set of instruments a careful person can use without thinking about whether they are being watched. The brand posture — locked by the product brief — is **trust**. Trust is the product. Everything else composes under it.

The brand voice is **confident, restrained, technical-poetic**. Not corporate. Not playful. Closer to a high-end instrument panel, a well-made hand tool, a Leica, a Braun radio, Linear's chrome, Apple Calculator's economy of attention. We refuse the loaded gun of the contemporary utility web: no ad slots, no upsell surfaces, no celebratory copy, no tracking pixels. Where the rest of the utility internet screams, Handy Tools is quiet.

The system is built on three reading instructions, all of which the component layer makes concrete:

- **Surface > ink.** The interface is a sheet of cool paper with ink on it. Color is signal, not atmosphere. The canvas is never pure white (`{colors.neutral-light.bg}`) and never pure black (`{colors.neutral-dark.bg}`); both are eyebrow-raising on calibrated displays.
- **Shape tells the role.** Inputs are squared (`{rounded.sm}`), surfaces are calmly rounded (`{rounded.md}`–`{rounded.lg}`), badges are pills (`{rounded.full}`). A reader who has never seen the product can guess what something is from its corners.
- **Motion is answer, not punctuation.** Nothing animates unless it answers a question: "Did my action land?" "Where did the keyboard cursor go?" "What just changed?" Transitions are ≤ 150ms; never bounce; never parallax; always suppressed by `prefers-reduced-motion`.

The thesis — the single line the design has to earn — is **the tool fades, the answer stays**.

## Colors

The current palette uses indigo (`#4f46e5`) as the accent on light gray and dark blue-gray. That choice reads **application**: a chatbot, a SaaS dashboard, a product that wants you to *browse in*. Handy Tools is not an application. It is a quiet workshop of small instruments. The accent has to evolve from "app" to "tool."

### Brand / primary

We replace indigo with a refined **cobalt** — `{colors.primary.DEFAULT}` (`#2F5BFF`). The hue sits between classic Klein blue and the blue of a precision instrument pointer: confident, not trendy; readable on white, readable on `#0B0D14`; works on a school portal and inside a PWA splash screen. It carries a single semantic load — **action and identity** — and is the only color allowed on a primary button, a focused input border, the keyboard cursor, the trust/embed chip, and the brand mark.

`{colors.primary.hover}` and `{colors.primary.pressed}` are darker, not desaturated — saturation is the brand. They work on both themes. `{colors.primary.on}` is locked to `#FFFFFF` for body text and icons because under the working contrast (≥ 7:1) the cobalt stays a single visual reference.

`{colors.primary.soft}` and `{colors.primary.soft-strong}` are tinted surfaces for accent wells (Result Cards, focused list rows). They never carry ink alone; they back content. They are **not** used as backgrounds for empty space.

### Neutrals

Both themes share the same anatomy — six tonal layers and three text levels — so the contrast and rhythm of the page are identical regardless of mode. Names map 1:1:

| Role            | Light                                    | Dark                                      | Use                                            |
|-----------------|------------------------------------------|-------------------------------------------|------------------------------------------------|
| Canvas (bg)     | `{colors.neutral-light.bg}`              | `{colors.neutral-dark.bg}`                | Page background                                |
| Surface 1       | `{colors.neutral-light.surface-1}`       | `{colors.neutral-dark.surface-1}`         | Cards, panels, results                        |
| Surface 2       | `{colors.neutral-light.surface-2}`       | `{colors.neutral-dark.surface-2}`         | Nested surfaces, hovered list rows            |
| Surface 3       | `{colors.neutral-light.surface-3}`       | `{colors.neutral-dark.surface-3}`         | Code wells, kbd faces, embed chips           |
| Border (hair)   | `{colors.neutral-light.border}`          | `{colors.neutral-dark.border}`            | 1px rules around cards, inputs, dividers      |
| Border (strong) | `{colors.neutral-light.border-strong}`   | `{colors.neutral-dark.border-strong}`     | Hovered borders, focused-but-not-active       |
| Text (ink)      | `{colors.neutral-light.text}`            | `{colors.neutral-dark.text}`              | Headlines, primary body                      |
| Text (soft)     | `{colors.neutral-light.text-soft}`       | `{colors.neutral-dark.text-soft}`         | Secondary prose, tool subtitles             |
| Muted           | `{colors.neutral-light.muted}`           | `{colors.neutral-dark.muted}`             | Labels, captions, meta                     |
| Muted (strong)  | `{colors.neutral-light.muted-strong}`    | `{colors.neutral-dark.muted-strong}`      | Inline numerals, iconography in body         |

Light and dark are deliberately not a simple inversion. Light ink (`#10131C`) is 5% lighter than pure black; dark paper (`#ECEFF7`) is 6% darker than pure white. This **asymmetry preserves the perceptual hierarchy** between heading and body across themes — a heading is always ~1.4× the contrast of body — and avoids the "halated dark mode" failure where headings collapse into their own backlight.

### Semantic

Functional colors are deliberately limited to four — success, warning, danger, info — and each appears on exactly four surfaces: a 12–20% soft fill (`*-soft`), a 30% mix border, a label-tone color (icon and inline text), and an on-color for filled variants.

| Semantic | Light                                | Dark                                    |
|----------|--------------------------------------|-----------------------------------------|
| success  | `{colors.semantic.success}`          | `{colors.semantic-dark.success}`        |
| warning  | `{colors.semantic.warning}`          | `{colors.semantic-dark.warning}`        |
| danger   | `{colors.semantic.danger}`           | `{colors.semantic-dark.danger}`         |
| info     | `{colors.semantic.info}`             | `{colors.semantic-dark.info}`           |

`info` is by intent the same hue as `primary`. The reasoning: in a tool suite, "informational" and "trustworthy" are the same signal — a tip about input format should feel structurally identical to the brand mark, not a separate teal taxonomy. Adding a fifth brand color to disambiguate them would dilute the system.

### Trust accent

Everywhere a user must see "this came from Handy Tools and it is honest with you," the system uses `{colors.trust.accent}`. Concretely: focus rings (`{colors.trust.focus-ring}`), brand mark, all links, the keyboard cursor row in the command palette, the trust-accent border on `tool-card-featured` (`{colors.components.tool-card.border-accent}`), and the entire `/privacy` and `/quality` page accent rules.

The trust accent must never be used decoratively. It exists to mark **actions the system is taking on your behalf** — copy, share, restore, focus, submit. Decorative use degrades the brand faster than any other choice.

### Forced-colors mode

Under `prefers-contrast: more` or `forced-colors: active` the system swaps to the **high-contrast palette** (`{colors.high-contrast}`). Every component token collapses to two colors — `CanvasText` (stroke) and `Highlight` (fill). Custom focus rings (`{elevation.shadow-forced.border}`) replace `box-shadow` rings. Every shadow token in the elevation table has a `shadow-forced` sibling that resolves to **none + 1px border** so the 1px outline remains visible against any background.

Mermaid / OS-controlled palette wins. We never hard-code a fallback color under forced-colors; we let the OS decide what "paper" looks like, which is what the user has explicitly chosen.

## Typography

The PRD is explicit: no web fonts (`§4.10`), system stack only. The system stack honors Latin (system-ui), Bengali/Hindi (Noto fallback chain), and Arabic (RTL, Noto Sans Arabic) inside a single declaration. Mono is locked to `ui-monospace` so terminal-heavy developer tools (Base64, JSON Formatter, JWT Inspector, Diff) read identically across platforms.

The roles below are the **canonical ladder**. Every tool, every modal, every footer reference points here. There are no ad-hoc font sizes anywhere in the system.

| Role             | Size     | Weight | Line | Tracking        |
|------------------|----------|--------|------|-----------------|
| display-lg       | 48 / 32 mobile | 700    | 1.05 | −0.025em |
| display-md       | 36 / 28 mobile | 700    | 1.10 | −0.020em |
| display-sm       | 28 / 24 mobile | 700    | 1.15 | −0.015em |
| headline         | 22 / 20 mobile | 600    | 1.25 | −0.010em |
| body-lg          | 18 / 17 mobile | 400    | 1.60 | 0         |
| body-md          | 16       | 400    | 1.55 | 0         |
| body-sm          | 14       | 400    | 1.50 | 0         |
| label            | 13       | 600    | 1.30 | +0.02em     |
| label-caps       | 11       | 700    | 1.30 | +0.08em (uppercase) |
| caption          | 12       | 500    | 1.40 | +0.01em     |
| result-xl        | 40 / 32 mobile | 700    | 1.10 | −0.020em |
| result-lg        | 24       | 700    | 1.20 | −0.010em |
| mono             | 14       | 400    | 1.50 | 0         |

Three notes on the table.

**Display sizes carry real negative tracking.** Generous letter-spacing is a typography cliché; this system uses it inversely. Headings pull in slightly because the system font on small UI grids reads loose; pulling the spacing in keeps the heading visually compact against the body, which is what makes a tool feel finished.

**Labels are sized for eyes, not pixels.** `{typography.label}` (13px / 600 / +0.02em) is the workhorse for form labels, history meta, and section headers in tables. `{typography.label-caps}` (11px / 700 / +0.08em / uppercase) is reserved for short category labels — `Featured`, `Pack`, `New`. UI in caps is tasteful in small doses; overused it turns the page into a flight-information board, which is the opposite of "instrument."

**Result sizes are their own ramp.** Result numbers (`{typography.result-xl}` and `{typography.result-lg}`) are deliberately one tier heavier than headings so the answer is always the largest thing on the page. A tool that buries its result has lost the contract with the user — the answer must read first.

### RTL

The full system works RTL-safe per PRD `§4.7`. Implementation rules:

- All spacing tokens (`{spacing.s-*}`) flow through `padding-inline` / `margin-inline`. There are no `padding-left` / `padding-right` rules anywhere in the tool layer.
- Icons inside labels switch by `dir="rtl"` on `<html>`. Brand glyphs are mirrored only where mirroring actually means something (chevrons, arrows); never for clarity-of-shape reasons.
- `text-align: start` is used in forms and tables.
- The mono stack already includes `"Noto Sans Mono"` for Bengali/Arabic dev tooling.
- The default `dir` is set by the locale catalog (`rtl` only for `ar`). Tools do not branch UI on direction.

## Layout & Spacing

Spacing is a 4px unit system (`{spacing.unit}`) expressed through `{spacing.s-1}`…`{spacing.s-12}`. Every margin, padding, and gap references one of those tokens. There is no `margin: 13px` in the codebase. No `padding: 7px`.

### Vertical rhythm

- Page edges: `{spacing.margin-mobile}` (20px) on phones, `{spacing.margin-desktop}` (64px) on desktop (`≥1024px`).
- Between unrelated sections: `{spacing.section-gap}` (48px).
- Default vertical stack gap: `{spacing.row-gap}` (16px).
- Inline gap between an icon and its label: `{spacing.inline-gap}` (8px).

These are **floor values**. Tools are free to use larger spacing in their inner form grids; they are not free to use smaller spacing — that is reserved for kbd faces and chip rows.

### Page widths

| Surface                          | Width                  | Token                        |
|----------------------------------|------------------------|------------------------------|
| Reading body (a tool's inputs/results) | `{spacing.container-narrow}` (720px) | `max-inline-size: 720px` |
| Home grid, pack pages            | `{spacing.container-wide}` (1100px)  | `max-inline-size: 1100px` |
| Command palette, settings modal  | `{spacing.dialog}` (560px) | `width: min(560px, 92vw)`  |
| Embed surface                    | `min(560px, 100%)`     | fluid; PRD `§4.4` ≥ 240px  |
| Header bar                       | full bleed, `{spacing.header-height}` tall | `position: sticky; top: 0`  |

The 720px tool width is **deliberate**: calculators, formatters, and timers are best at the width of a long SMS, not the width of a webpage. Forcing a tool to fill 1100px makes the form row span needlessly wide; collapsing it makes labels and inputs wrap. 720px is the intersection.

### Grids

- Tool grids on the home page: `repeat(auto-fill, minmax(240px, 1fr))` with `{spacing.gutter}` (24px) gap. No 12-column tracking for tool tiles — they are cards, not dashboards.
- Result tiles inside a tool: `repeat(auto-fit, minmax(140px, 1fr))` with `{spacing.s-3}` (12px) gap.
- Two-up result blocks: `1fr 1fr` collapse to `1fr` at `≤ 640px`.
- Three-up grids collapse at the same breakpoint.

### Sticky surfaces

The site header is the only sticky surface (`{spacing.header-height}` tall, `{colors.neutral-light.bg}` at 92% opacity, 10px blur). The command palette opens above it (z-index 100). Toasts stack from the bottom edge (`{spacing.s-5}` from bottom, centered inline).

### Touch targets

Every clickable surface is ≥ `{spacing.touch-target}` (44px) on its shorter axis, per PRD rubric #2. Inline links remain 16–18px; their hoverable area is extended by 8px of transparent padding inside the parent.

## Elevation & Depth

The system has **five elevation levels** — `none`, `sm`, `md`, `lg`, `xl` — corresponding to inset / card / tile / overlay / dialog. Each level has a **light, dark, and forced-colors variant**. There are no non-token shadows anywhere.

| Level    | Typical use                               | Light                                 | Dark                                  | Forced-colors                 |
|----------|-------------------------------------------|---------------------------------------|---------------------------------------|-------------------------------|
| shadow-0 | Text, flat surfaces                       | `{elevation.shadow-0}`                | same                                  | same                          |
| shadow-sm | Cards resting                              | `{elevation.shadow-sm}`               | `{elevation.shadow-sm-dark}`          | `{elevation.shadow-forced}`   |
| shadow-md | Hovered cards, panels with a sticky header | `{elevation.shadow-md}`               | `{elevation.shadow-md-dark}`          | `{elevation.shadow-forced}`   |
| shadow-lg | Command palette, history panel, keymap    | `{elevation.shadow-lg}`               | `{elevation.shadow-lg-dark}`          | `{elevation.shadow-forced}`   |
| shadow-xl | Modals, focus-captured overlays            | `{elevation.shadow-xl}`               | `{elevation.shadow-xl-dark}`          | `{elevation.shadow-forced}`   |

### Rules

- A surface never uses a shadow *and* a 1px border on the same edge — that's visual mud. Borders carry definition; shadows carry elevation. Pick one per edge.
- Shadows are **neutral**, never tinted. Colored shadows look like glow effects; we want diffuse, planar depth.
- `shadow-forced` resolves to `box-shadow: none; border: 1px solid CanvasText;`. This is the only border the system renders under forced-colors even when the same component uses a shadow in default themes.
- On motion reduction (`prefers-reduced-motion: reduce`), a hovered card's `translateY(-2px)` is dropped; the shadow remains so the click affordance is preserved.

### Focus rings

Focus rings are a system-level primitive, not a per-component reinvention: every focusable element uses `{elevation.ring}` — a 3px solid ring at 2px offset, colored `{colors.trust.focus-ring}`. Focus rings are **never** `outline: none` followed by a custom replacement. The ring must always be a 3px solid ring at 2px offset; otherwise users navigate blind.

## Shapes

The shape language is **squared-soft**. Inputs and chips are squared at `{rounded.sm}` (6px). Buttons and result tiles are calmly rounded at `{rounded.md}` (10px). Tool cards, dialogs, and the command palette use `{rounded.lg}` (14px). Brand-mark frames and hero surfaces reach `{rounded.xl}` (20px). Pills are reserved for badges, status indicators, and the `tool-card-badge` "New" pill — they use `{rounded.full}`.

Larger radii create **visual weight** that the tool card does not want to carry. Sharp edges (0px) are aggressive — wrong for tools. The 6 → 10 → 14 → 20 step is calibrated to a 1.5× ratio so that each tier reads as a step, not a category.

There are no `border-radius: 7px` or similar custom values. Tools cannot round a single component differently than the system says — they must select from the ladder.

### Icons

Icons are stroked SVG at 1.75–2px stroke weight, 20px default at body size, 16px inline. They share the corner radius of their parent surface (`{rounded.sm}` for inputs, `{rounded.md}` for buttons and tiles). Icons inherit `currentColor` so they re-skin with theme and component variant without per-state duplication.

## Components

Each entry: **name**, **variants**, **states (default / hover / focus / active / disabled)**, and explicit token references for every value. Token names map 1:1 to the frontmatter — synonyms are forbidden.

### Button

A clickable surface that performs an action. It is never a link (use a Text Link), never a toggle (use a Toggle), never navigation (use a Tab). Variants map to `{components.button}`.

**Variants**
- `{components.button.primary}` — committed action: submit, copy, share, restore, focus. Single source of truth color = `{colors.primary.DEFAULT}`.
- `{components.button.secondary}` — neutral action that isn't primary: a back link, an "edit sample" toggle. `{colors.neutral-light.surface-1}` fill.
- `{components.button.ghost}` — quiet utility: tertiary action in a list, an overflow menu trigger, a "see more." Transparent by default, hovers to `{colors.neutral-light.surface-2}`.
- `{components.button.destructive}` — irreversible action with confirm: clear history, reset inputs, delete a saved dashboard. Outlined red, fills red on confirmation.

**Sizes**
- `lg`: 44px tall — primary tools, hero CTAs, anything reachable one-handed on a phone (`{components.button.height-lg}`).
- `md`: 36px tall — default (`{components.button.height-md}`).
- `sm`: 28px tall — inline chips, dense tables, secondary actions (`{components.button.height-sm}`).

**States**

| State      | Primary                                              | Secondary                                  | Ghost                                       | Destructive                                              |
|------------|------------------------------------------------------|--------------------------------------------|---------------------------------------------|-----------------------------------------------------------|
| default    | `{components.button.primary.bg}` / `{components.button.primary.fg}` | `{components.button.secondary.bg}` / `{components.button.secondary.fg}` | transparent / `{components.button.ghost.fg}` | transparent / `{components.button.destructive.fg}` + neutral border |
| hover      | `{components.button.primary.bg-hover}` + `{components.button.primary.hover-shadow}` | `{components.button.secondary.bg-hover}`  | `{components.button.ghost.bg-hover}` / `{components.button.ghost.fg-hover}` | `{components.button.destructive.bg-hover}` + danger border |
| focus      | `{components.button.primary.focus-ring}` (3px outer ring)  | same ring token                     | same ring token                             | same ring token                                           |
| active     | `{components.button.primary.bg-pressed}`             | `{components.button.secondary.bg-pressed}` | `{components.button.ghost.bg-pressed}`     | confirmation: fills `{components.button.destructive.confirmed-bg}` and text flips to `{components.button.destructive.confirmed-fg}` |
| disabled   | `{components.button.primary.disabled-bg}` / `{components.button.primary.disabled-fg}`, no shadow, `cursor: not-allowed` | same shape, `surface-2` fill, `{colors.neutral-light.muted}` text | same                                        | same                                                      |

The radius is always `{components.button.radius}` — `{rounded.md}`. The weight is always `{components.button.weight}`. The font-size is always `{components.button.font-size}`.

### Input

The basic form control. Variants: text, number, date, search, color (44px swatch), and inline-textarea (`{components.textarea}`).

**Height:** `{components.input.height}` (40px). Larger targets get a `--touch-target: 44px` override for primary actions on mobile but the visual height stays 40px; the extra reach is `padding`, not inflation.

**Radius:** `{components.input.radius}` — `{rounded.sm}`.

**States**

| State      | Surface                                                  |
|------------|----------------------------------------------------------|
| default    | `{components.input.bg}` + `{components.input.border}` + `{components.input.fg}` |
| placeholder| `{components.input.placeholder}` text on default surface |
| hover      | `{components.input.border-hover}` (no shadow change)     |
| focus      | `{components.input.border-focus}` + `{components.input.ring}` outer halo |
| invalid    | `{components.input.border-error}`; an inline `aria-describedby="…-error"` line appears below in `{colors.semantic.danger}` |
| disabled   | `{components.input.bg-disabled}` fill; `{components.input.border}`; `{colors.neutral-light.muted}` text; `cursor: not-allowed` |

Labels live above the field in `{typography.label}` (`{components.input.label-size}`). Hints live in `{typography.caption}` (`{components.input.hint-size}`). Labels are **always outside** the input — there are no floating labels, no inline placeholders used as labels. Per PRD `§4.7`, all hint strings are translatable through the message catalog.

### Select

Native `<select>` styled with the same default/hover/focus/disabled/invalid states as `{components.input}`. The chevron is drawn inline at `{components.select.chevron-size}` (16px) in `{components.select.chevron-color}` — never an external asset.

### Textarea

`{components.textarea}`. Default height `{components.textarea.min-height}` (120px), vertically resizable, mono font `{components.textarea.mono}`. Submit on `Shift+Enter` is exposed only on the JSON Formatter / Markdown tools where multi-line input is the contract; everywhere else `Cmd/Ctrl+Enter` submits and the user typing Enter must insert a newline.

### Result Tile

A small, dense summary block used in multi-value results (e.g., Bill Split per-person breakdown, Loan Amortization schedule, Diff Counter). `{components.result-tile}`.

- Label in `{components.result-tile.label-size}` (=`{typography.label-caps}`), `{components.result-tile.label-fg}`.
- Value in `{components.result-tile.value-size}` (=`{typography.result-lg}`), `{components.result-tile.value-fg}`.
- When the value is the **headline answer** (the largest single number on the page), it uses `{components.result-tile.accent-value-fg}` (`{colors.primary.DEFAULT}`) so the eye lands on it first.
- A copy icon at the top-right in `{components.result-tile.copy-icon-color}`; on focus it adopts the trust accent color.

### Result Card

A wide, prominent block used when a tool produces **one** primary result (Age Calculator, Tip, BMI, GPA, Hash output). `{components.result-card}`.

- Background: `{components.result-card.bg}` (`{colors.primary.soft}`).
- Border: `{components.result-card.border}`.
- Padding: `{components.result-card.padding}` (=`{spacing.s-6}`).
- Result number uses `{typography.result-xl}` in `{colors.primary.DEFAULT}`.
- A "Copy" button is anchored top-right; tapping flashes a 1.2-second toast *"Copied"* (no celebration, no emoji).

### Tool Card

The card on the home grid (`<a>` element). `{components.tool-card}`.

- Background `{components.tool-card.bg}`.
- Border `{components.tool-card.border}` — hovers to `{components.tool-card.border-hover}` and lifts by `{components.tool-card.hover-translate}`.
- Icon in `{components.tool-card.icon-bg}` (`{colors.primary.soft}`), stroke color `{components.tool-card.icon-fg}`.
- Title in `{typography.body-md}` weight 700; description in `{typography.body-sm}` color `{components.tool-card.desc-fg}`.
- The `tool-card-featured` variant spans `{components.tool-card.featured-span}` columns and uses a subtle gradient between `{colors.primary.soft}` and `{colors.neutral-light.surface-1}`. Featured cards are reserved for genuinely featured tools — never for rotation advertising.

States are minimal: `default` (flat border) and `hover` (border accent + lift). Focus shows `{elevation.ring}`. Active scale-down is applied at `transform: scale(0.985)` for 100ms.

### Command Palette

The single front door for the suite. `{components.command-palette}`.

- Triggered globally by `Cmd/Ctrl+K`. Opens above the sticky header (`z-index: 100`).
- Backdrop at `{components.command-palette.backdrop}` (45% ink).
- Panel: `{components.command-palette.panel-bg}`, `{components.command-palette.panel-radius}` (=`{rounded.lg}`), `{components.command-palette.panel-shadow}` (=`{elevation.shadow-xl}`).
- Input row at `{components.command-palette.input-height}` (52px), full-width, transparent border. Placeholder text: *"Type to search tools…"*.
- Result rows: `{components.command-palette.item-height}` (44px), padding `{components.command-palette.item-padding-x}`, radius `{components.command-palette.item-radius}`.
  - Default row: `{components.command-palette.item-inactive-fg}` text, `{components.command-palette.item-meta-fg}` meta (pack tag, last-used).
  - Hover row: `{components.command-palette.item-hover-bg}`.
  - **Keyboard-cursor row**: `{components.command-palette.item-active-bg}` fill, `{components.command-palette.item-active-fg}` text. This is the row that fires on `Enter`. The cursor never blends with hover.

The footer line is `{components.command-palette.footer-fg}` in `{components.command-palette.footer-size}` (=`{typography.caption}`): *↑↓ navigate · ↵ open · ⌘K close*.

### Settings Modal

A single dialog opened from the header. `{components.settings-modal}`.

- Triggered by the gear icon or `Cmd/Ctrl+,`.
- Backdrop `{components.settings-modal.backdrop}`.
- Panel `{components.settings-modal.panel-width}` (=`{spacing.dialog}`), padding `{components.settings-modal.panel-padding}` (=`{spacing.s-6}`), `{components.settings-modal.panel-radius}` (=`{rounded.lg}`).

Sections appear in order (each is a `{components.settings-modal.section-gap}` of vertical space): Theme, Language, Units, Default Currency, Font Scale, Reduced Motion, Clear Local Data, Export / Import. Section titles render in `{components.settings-modal.group-title-size}` (=`{typography.label-caps}`), `{components.settings-modal.group-title-fg}` (=`{colors.neutral-light.muted}`).

The "Clear Local Data" action is a `{components.button.destructive}` with a two-step confirm: first click exposes a *Confirm clear* button; a second click within 5s commits. The destructive button never auto-fires.

### History Panel

Per-tool, per-session. The PRD calls for ten entries per tool with view / restore / export / clear (`§4.5`). `{components.history-panel}`.

- Width `{components.history-panel.width}` (320px). Anchored to the right side of the tool body on desktop (`≥ 1024px`); below the result on mobile.
- Each entry: `{components.history-panel.entry-padding}` padding inside `{components.history-panel.entry-radius}` (=`{rounded.sm}`). Background on hover becomes `{components.history-panel.entry-hover-bg}`. The most recent entry is highlighted in `{components.history-panel.entry-active-bg}` (`{colors.primary.soft}`).
- Meta line `{components.history-panel.meta-size}` (=`{typography.caption}`), `{components.history-panel.meta-fg}`.
- Entries have no destructive-default behavior; deletion is explicit via a per-row `×` button.

### Tool Header

The header inside a tool page (above its input panel). `{components.tool-header}`.

- Padding-block `{components.tool-header.padding-block}`.
- Title in `{typography.display-sm}` (=`{components.tool-header.title-size}`).
- Subtitle in `{typography.body-lg}` (=`{components.tool-header.subtitle-size}`) in `{components.tool-header.subtitle-fg}`.
- Back link to the pack or home: `{components.tool-header.back-link-fg}` that becomes `{components.tool-header.back-link-hover}` on hover.

### Tool Footer

Every tool has the same footer block. `{components.tool-footer}`.

Three left-aligned links: *View source*, *Embed this tool*, *About this tool*. One right-aligned cluster: keyboard help (`?`), history toggle (clock icon), and the locale picker when more than one locale is available.

Footer type is `{components.tool-footer.fg}` (`{colors.neutral-light.muted}`) in `{components.tool-footer.size}` (=`{typography.caption}`). The *View source* link is `{components.tool-footer.link-fg}` — same hue as the trust accent — because linking to source is a trust act, not a navigation act.

### Alert / Banner

Inline status surfaces. `{components.alert}`. Four variants — `{components.alert.info}`, `{components.alert.success}`, `{components.alert.warning}`, `{components.alert.error}` — share the radius, padding, and typography, and differ only by the four-color palette assigned.

- `radius: {components.alert.radius}` (=`{rounded.md}`)
- `padding: {components.alert.padding}` (=`{spacing.s-4}`)
- `title-size: {components.alert.title-size}` (=`{typography.label}`)
- `body-size: {components.alert.body-size}` (=`{typography.body-sm}`)

Banners have an icon on the left in `{components.alert.icon-fg}` at 18px. They are **passive** — they announce, they do not interrupt, they do not auto-dismiss. Closing an alert is a manual action via a small `×` button.

### Empty State

When a tool has no result yet (before the user enters input) or no history (first visit). `{components.empty-state}`.

- Centred inside `{components.empty-state.padding}` (=`{spacing.s-10}`).
- Icon: `{components.empty-state.icon-size}` (32px) in `{components.empty-state.icon-fg}`.
- Title: `{components.empty-state.title-size}` (=`{typography.headline}`) in `{components.empty-state.title-fg}`.
- Description: `{components.empty-state.desc-size}` (=`{typography.body-md}`) in `{components.empty-state.desc-fg}`.
- Two possible actions maximum: a "Try an example" primary button and a "Learn more" ghost link.

Tone is informative, never instructional. The icon is always a thin outline that matches the semantic. No illustrated mascots; no brand characters.

### Keyboard Help Overlay

The `?` overlay. `{components.keyboard-help-overlay}`.

- Width `{components.keyboard-help-overlay.width}` (640px). Padding `{components.keyboard-help-overlay.padding}` (=`{spacing.s-6}`).
- Two-column grid (collapses to one column ≤ 640px): shortcuts on the left, descriptive label on the right. Gap `{components.keyboard-help-overlay.column-gap}` (=`{spacing.s-6}`).
- Kbd face: `{components.keyboard-help-overlay.kbd-bg}` (`{colors.neutral-light.surface-3}`), `{components.keyboard-help-overlay.kbd-radius}` (=`{rounded.sm}`), `{components.keyboard-help-overlay.kbd-padding-x}` (=`{spacing.s-2}`). Minimum width `{components.keyboard-help-overlay.kbd-min-width}` (28px) so single characters read.
- Labels in `{components.keyboard-help-overlay.label-size}` (=`{typography.body-sm}`), `{components.keyboard-help-overlay.label-fg}`.

Reachable by `?` from any tool page without first opening the palette. The overlay never traps focus permanently — `Esc` returns focus to the tool's primary input.

### Embed Chip

The `⌘C`-friendly snippet shown on every tool page's footer. `{components.embed-chip}`. This component is the visual representation of *embeddability* itself: silent, copyable, brand-less.

- Background `{components.embed-chip.bg}` (`{colors.neutral-light.surface-3}`).
- Border `{components.embed-chip.border}`.
- Padding `{components.embed-chip.padding}`.
- Mono text in `{components.embed-chip.fg}` (`{typography.mono}`).
- A small "Copy" pill anchored inline-right, `{components.embed-chip.copy-fg}` text that becomes `{components.embed-chip.copy-bg-hover}` on hover.

The chip **never says "Handy Tools"** — the line is `<iframe src="https://handy.tools/?embed=<slug>" width="100%" height="<n>" loading="lazy"></iframe>`. The host page renders the chip into context; the assistant does not advertise itself inside the embed. This is the single most visible trust statement in the system; protect it.

## Do's and Don'ts

Six each, distilled from the brand posture and the PRD's anti-features section.

### Do

1. **Do protect the canvas.** Pages begin on `{colors.neutral-light.bg}` or `{colors.neutral-dark.bg}` and end there. Never paint a full-bleed gradient background — gradients belong only on the hero brand mark and the `tool-card-featured` surface. A tool page is a sheet of paper, not a poster.

2. **Do use one accent.** `{colors.primary.DEFAULT}` does **one** job: it marks an action the system is taking on the user's behalf. Primary buttons, focused inputs, the keyboard cursor, the trust ring, the embed chip, the brand glyph. If a screen has more than ~6% of its surface in `{colors.primary.DEFAULT}`, the screen has lost the system — pull it back.

3. **Do preserve the answer.** Result values render in `{typography.result-xl}` or `{typography.result-lg}` in `{colors.primary.DEFAULT}`. They are the largest thing on the page. A tool that buries its result beneath a description has lost the contract with the user — rebalance the typography first, not the layout.

4. **Do honor focus as a primary surface.** Every focusable element shows `{elevation.ring}` — a 3px outer ring at 2px offset in `{colors.trust.focus-ring}`. Focus rings are not "styling we add at the end." They are a load-bearing interaction primitive. Custom focus replacements must preserve the ring's outer offset and contrast.

5. **Do make motion answer a question.** A 100ms scale-down on press, a 150ms translateY on card hover, a 200ms toast slide — these answer "did my action land?" Anything else (parallax, bounce, decorative glow) is removed. `prefers-reduced-motion` drops every transform; shadows remain.

6. **Do ship the trust surface as content, not chrome.** `/privacy`, `/quality`, *View source* in every footer, the wire-log panel — they live in the main canvas with real type, real hierarchy. They are not buried under a tiny "more" link. The transparency is the product.

### Don't

1. **Don't add celebratory microcopy.** No "🎉 Copied!", no "Great work!", no cheerful emoji, no exclamation marks in success states. A copy confirmation says *"Copied."* A submission says *"Saved."* The system is a precision instrument; the tone is calibrated, not enthusiastic.

2. **Don't introduce a fifth color.** The palette is `{colors.primary}`, three semantic hues (success / warning / danger — info aliases primary), and one neutral scale. New tokens require a documented waiver and update this DESIGN.md. A teal "oceanic" gradient here, a coral "energy" accent there, and the system has lost its grammar.

3. **Don't dark-pattern the user.** No "Sign up to keep your history." No "Get notified when results are ready." No exit-intent modals. No "Confirm you're human" gates. The site runs entirely in the browser; that's the whole pitch. PRD `§4.10` is unambiguous, and the design must reflect it.

4. **Don't load anything that loads anything.** No web fonts, no remote scripts, no CDN icons, no third-party analytics, no A/B test buckets, no tag managers. The shell is vendored. The icons are inline SVG. The fonts are system stack. PRD `§4.6 / §4.10` and the brand posture agree: trust is the product.

5. **Don't decorate with shadows.** A shadow is elevation, not atmosphere. A card uses `{elevation.shadow-sm}` only. A modal uses `{elevation.shadow-xl}`. A button uses `{elevation.shadow-sm}` only on hover. Decorating a blank `<div>` with a shadow is forbidden. Decorating with shadows and a 1px border on the same edge is forbidden.

6. **Don't break the keymap.** Keyboard reachability is a load-bearing contract with the rubric (`§4.1` #1). Every primary action has a single-key shortcut. Every navigation reaches focus. `Esc` always closes an overlay and returns focus to the trigger. `/` jumps to search. `?` opens help. `Cmd/Ctrl+K` opens the palette. There are no tool-specific rebinds. The keymap is the design.

---

## Three best-of-internet signals — explicit treatment

### (a) Embed iframe chrome (`?embed=1`)

The embed is **invisible by design**, which is the goal — not a failure of effort. When a tool is loaded at `?embed=1`:

- No header. No footer. No site-wide links. No brand glyph.
- The tool runs inside the host page, accepting its background color, its fonts (system fallback chain), and its direction (`dir="rtl"`).
- The brand surface limit is `{components.embed-chip}` — the snippet itself, on the *host's* setting page, not in the embed.
- The hostname in the embed URL is `handy.tools`; the iframe title is the tool's title; nothing else identifies the suite inside the rendered surface.
- Focus rings (`{elevation.ring}`) remain. Aria live regions remain. Result tiles render with full tokens.

The assistant's brand identity lives in *being a good embed*, not in *saying it's there*. The treatment is silence.

### (b) `/privacy` page — auditable, with a wire-log panel

The `/privacy` page is the brand's most quoted URL; it has to be the brand's most credible surface. Three sections, all on the main canvas:

1. **Local storage panel** — a literal table listing every `ht.*` key the registry knows about: key name, what is stored, when it's written, when it's deleted, last-write timestamp from the user's own `localStorage`. Generated from a single registry; nothing is hand-typed. This table is part of the main content, not a footer.

2. **Wire log panel** — a panel titled *"Network requests this session"* by default showing `0 request(s)`. Open any tool, the counter stays at `0`. There is a "Force a probe" button that fires an internal `fetch('/tools/<slug>/index.html')` (still a same-origin document request, never a third-party) to confirm the panel itself is wired to the same origin's Network panel a user could open in DevTools. The point is verifiability, not paranoia.

3. **Source and provenance** — a direct link to the registry and the tool's source. A "Verifiable assertions" block that re-states the rubric: no analytics, no cookies, no fingerprinting, no advertising, no third-party requests. Each line is a promise; the page is the receipt.

Type sizes follow the typography ladder: heading in `{typography.display-sm}`, body in `{typography.body-md}`, the wire log in `{typography.mono}`. There are no screenshot mockups. The page reads like a README, not a marketing page.

### (c) `/quality` page — 10/10 criteria, public per tool

The public quality page renders one row per tool, ten columns per row, one column per criterion. Each cell is a single character: `✓` (pass), `—` (waiver), or `✕` (fail). Clicking a cell opens an inspector panel with a one-line remediation note (`Mobile: tap targets < 44px on Action button`).

- Tool name uses `{typography.body-md}` weight 700, link color `{components.tool-footer.link-fg}` (=`{colors.primary.DEFAULT}`).
- The 10-criterion header strip uses `{typography.label-caps}` (`{colors.neutral-light.muted}`).
- The score column right-aligns numbers in `{typography.mono}` for alignment.
- A tool with `score ≥ 9` gets a `{colors.semantic.success}` check at the row's leading edge; with `score 8` the check is `{colors.neutral-light.muted}`; with `score ≤ 7` the row is bordered in `{colors.semantic.warning}` and the tool is omitted from home-page promotion until it climbs.

There are no aggregate charts, no leaderboards, no badges. The page exists so that anyone — including future-us — can confirm the rubric is being honored. The rigor of the page is the rigor of the system.

---

*End of DESIGN.md. References to tokens use the full canonical paths from this document's frontmatter. Where a token name changes, both spines update in the same commit.*