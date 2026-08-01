# Spine Pair Review — Handy Tools

- **DESIGN.md:** `C:\ZDrive Folders\Projects\useful-tools\_bmad-output\planning-artifacts\ux-designs\ux-useful-tools-2026-07-31\DESIGN.md`
- **EXPERIENCE.md:** `C:\ZDrive Folders\useful-tools\_bmad-output\planning-artifacts\ux-designs\ux-useful-tools-2026-07-31\EXPERIENCE.md`
- **PRD source:** `C:\ZDrive Folders\Projects\useful-tools\_bmad-output\planning-artifacts\prds\prd-useful-tools-2026-07-31\prd.md`
- **Run at:** 2026-07-31 (validate.md rubric walker, Pass 1 + Pass 2)

## Overall verdict

**Strong with targeted fixes.** The spine pair is unusually disciplined: a single YAML token tree in DESIGN.md is paired with a deeply structured EXPERIENCE.md that references those tokens exclusively by path. Every PRD persona/UJ, every must-have FR (1–21), the 10-criterion Tool Contract, and the trust/embed/PWA surfaces all surface in the right spine. The two spines are clearly co-authored as peer contracts (Glossary alignment, component naming, identical themes). The gaps are mostly *missing teeth* on already-declared primitives — IA surface #8 ("Sample Data") and #11 ("Print") don't have explicit `state` rows; embed `postMessage` is over-specified relative to PRD FR-11; a few component behaviors (Toggle, Slider, Tabs, Skip Link, Dialog) live in EXPERIENCE.md without visual entries in DESIGN.md; and one token (`{colors.primary.soft-strong}`) is defined but never consumed. Nothing is structurally broken.

---

## 1. Flow coverage — **strong**

**What was checked.** Extracted every named user journey and requirement from the PRD frontmatter and §2.3, §4.1–4.8. Each was traced to a `Key Flow` (EXPERIENCE.md §9) with numbered steps, climax beat, and failure paths.

| PRD source | Key Flow | Steps | Climax | Failure path |
|---|---|---|---|---|
| UJ-1 (Priya splits bill on phone) | §9.1 | 7 | "matches the on-screen value *to the cent*" | ✓ clipboard fallback, formatting surprise, network drop |
| UJ-2 (Marco embeds widget on blog) | §9.2 | 5 | "zero outbound requests beyond the iframe" | ✓ strict CSP, tool fail inside iframe, badge=0 |
| UJ-3 (Aisha daily dashboard + PWA + JSON export) | §9.3 | 6 | "import on new device exactly reproduces her old setup" | ✓ malformed export, theme flicker, install fail |
| UJ-4 (Jamal offline PWA on flight) | §9.4 | 6 | "JSON Formatter works in the air, no network indicator" | ✓ un-cached tool, cache eviction, JS disabled |

All four PRD §2.3 journeys are present 1:1, in protagonist order, with climax + failure path. FR-12 (history) and FR-13 (export/import) are exercised inside §9.1 and §9.3 respectively.

### Findings
- **(low)** EXPERIENCE.md §9 says "Four protagonists, four flows" but PRD §2.3 also lists four UJs; this is clean. *Fix:* none.
- **(low)** PRD FR-4 (Shareable state, encoded in URL) is exercised indirectly inside §9.2 only; no flow is dedicated to "open a friend's permalink and pick up exactly where they were." *Fix:* optional — add a UJ-5 or note that this is covered by share-via-palette in §9.2.

---

## 2. Token completeness — **strong**

**What was checked.** Extracted every key in DESIGN.md frontmatter (YAML before the `---` body separator) and every `{path.to.token}` reference in prose. Confirmed (a) every prose reference resolves to a defined token, (b) every defined token either is referenced or is a deliberate primitive (e.g., `neutral-dark.*` for theme parity), and (c) hex values are present for every load-bearing color combination.

**Frontmatter coverage.** Tokens span `colors.{primary,neutral-light,neutral-dark,semantic,semantic-dark,trust,high-contrast}`, `typography.{font-family,display-lg..mono,mobile}`, `rounded.{none..full}`, `spacing.{unit,s-1..s-12,gutter,margin-mobile,margin-desktop,section-gap,row-gap,inline-gap,container-narrow,container-wide,dialog,header-height,touch-target}`, `elevation.{shadow-0..shadow-xl,shadow-{sm,md,lg,xl}-dark,shadow-forced,ring}`, and `components.{button,input,select,textarea,result-tile,result-card,tool-card,command-palette,settings-modal,history-panel,tool-header,tool-footer,alert,empty-state,keyboard-help-overlay,embed-chip}`. Hex coverage is complete for the 30+ light neutrals/semantics and 10 dark neutrals/semantics; `high-contrast` is correctly CSS-system-keyword valued; `trust.*` aliases back to `primary.*` by intent.

**Reference resolution.** Walked all `{…}` references in prose. Every token reference resolves to a defined path. Notable resolutions:
- `{typography.label.fontSize}`, `{typography.label-caps}` (entire role referenced, valid because the typography.role is a value-object), `{typography.body-md.fontSize}`, `{typography.body-sm.fontSize}`, `{typography.headline.fontSize}`, `{typography.result-xl}`, `{typography.result-lg}`, `{typography.display-sm.fontSize}`, `{typography.body-lg.fontSize}`, `{typography.caption.fontSize}`, `{typography.label}`, `{typography.mono}`, `{typography.font-family.mono}`, `{typography.font-family.sans}`, `{typography.mobile.{display-lg,display-md,display-sm,headline,body-lg,result-xl}}` — all defined.
- `{colors.primary.{DEFAULT,hover,pressed,on,soft,soft-strong}}`, `{colors.neutral-light.{bg,surface-1..3,border,border-strong,text,text-soft,muted,muted-strong}}` — all defined.
- `{colors.neutral-dark.*}` — all defined (symmetric).
- `{colors.semantic.{success,warning,danger,info,success-on,success-soft,warning-on,warning-soft,danger-on,danger-soft,info-on,info-soft}}` — all defined.
- `{colors.semantic-dark.*}` — all defined.
- `{colors.trust.{accent,accent-hover,accent-pressed,focus-ring}}` — all defined (aliased to primary by design).
- `{colors.high-contrast.*}` — all defined.
- `{rounded.{sm,md,lg,xl,full}}` — all defined.
- `{spacing.{s-1..s-12,gutter,margin-mobile,margin-desktop,section-gap,row-gap,inline-gap,container-narrow,container-wide,dialog,header-height,touch-target,unit}}` — all defined.
- `{elevation.{shadow-0,shadow-sm,shadow-md,shadow-lg,shadow-xl,shadow-{sm,md,lg,xl}-dark,shadow-forced,ring}}` — all defined.
- `{components.{button.{primary,secondary,ghost,destructive}.*,input.*,select.*,textarea.*,result-tile.*,result-card.*,tool-card.*,command-palette.*,settings-modal.*,history-panel.*,tool-header.*,tool-footer.*,alert.{info,success,warning,error}.*,empty-state.*,keyboard-help-overlay.*,embed-chip.*}}` — all defined.

**Contrast targets.** Stated explicitly for the load-bearing combinations: ≥7:1 for primary on light surface (`{colors.primary.DEFAULT}` on `{colors.neutral-light.surface-1}` via §"Colors → Brand/primary"), ≥3:1 for focus rings (§"Focus rings"), and 1.4× perceptual hierarchy between heading and body across themes (§"Neutrals → Light and dark").

### Findings
- **(low)** `{colors.primary.soft-strong}` (`#C7D4FF`) is defined in the YAML but **not referenced anywhere in DESIGN.md prose or components**. It is documented as the "low-saturation tint for surfaces" but only `primary.soft` is consumed. *Fix:* either remove it, or assign it to a component (e.g., a hover-fill on tool-card-featured or a focus-soft variant).
- **(low)** `{components.input.label-size}` and `{components.input.hint-size}` are value-strings (`{typography.label.fontSize}`, `{typography.caption.fontSize}`), but `{components.alert.body-size}` resolves to the entire `{typography.body-sm}` role object while `{components.alert.title-size}` resolves to `{typography.label}` as a role object. Inconsistent granularity for typography references — some pick `.fontSize`, others pull the whole role. *Fix:* normalize (always `.fontSize` when only size matters) or document the rule.
- **(medium)** No semantic color token for the **offline banner**; EXPERIENCE.md §1.8 says it "uses DESIGN.md `--color-warning` background" but DESIGN.md has no `--color-warning` and no token name exposes a banner background. The closest available is `{components.alert.warning.bg}`. *Fix:* add a banner-specific surface token, or rewrite EXPERIENCE.md to reference `{components.alert.warning}`.
- **(medium)** EXPERIENCE.md §1.8 references `--color-focus` and `--color-surface` as if they were tokens; DESIGN.md has no CSS custom property names — only YAML keys. A consumer cannot bind `--color-focus` directly. *Fix:* in DESIGN.md, declare the CSS custom-property names that map to each token (e.g., `--color-focus: {colors.trust.focus-ring}`) so consumers can wire `var(--color-focus)`.

---

## 3. Component coverage — **adequate**

**What was checked.** Extracted every component name from both spines. Each must have a row in DESIGN.md.`Components` (visual) **and** EXPERIENCE.md.`Component Patterns` (behavioral).

| Component | DESIGN.md visual | EXPERIENCE.md behavior |
|---|---|---|
| Button | ✓ §Button (variants, sizes, 5 states) | ✓ §Button |
| Input | ✓ §Input (states incl. invalid) | ✓ §Input |
| Select | ✓ §Select | (referenced as sharing input states) |
| Textarea | ✓ §Textarea | ✓ §Textarea |
| Result Tile | ✓ §Result Tile | ✓ §Result Tile |
| Result Card | ✓ §Result Card | (covered via Result Tile; no dedicated row) |
| Tool Card | ✓ §Tool Card (incl. featured variant) | ✓ §Tool Card |
| Command Palette | ✓ §Command Palette | ✓ §Command Palette |
| Settings Modal | ✓ §Settings Modal | ✓ §Settings Modal |
| History Panel | ✓ §History Panel | ✓ §History Panel |
| Tool Header | ✓ §Tool Header | (implicit in IA; no explicit row) |
| Tool Footer | ✓ §Tool Footer | ✓ §Footer |
| Alert / Banner | ✓ §Alert / Banner | ✓ §Banner |
| Empty State | ✓ §Empty State | (referenced by State Patterns; no dedicated row) |
| Keyboard Help Overlay | ✓ §Keyboard Help Overlay | ✓ §Keyboard Help Overlay |
| Embed Chip | ✓ §Embed Chip | ✓ §Embed Snippet |
| Toast | (covered via "Result Card copy 1.2s toast") | ✓ §Toast |
| Sample Data Link | (not in DESIGN.md) | ✓ §Sample Data Link |
| Pack Card | (not in DESIGN.md) | ✓ §Pack Card |
| Breadcrumb | (not in DESIGN.md) | ✓ §Breadcrumb |
| Star (Pin) Button | (not in DESIGN.md) | ✓ §Star (Pin) Button |
| Numeric Stepper | (not in DESIGN.md) | ✓ §Numeric Stepper |
| Toggle Switch | (not in DESIGN.md) | ✓ §Toggle Switch |
| Slider | (not in DESIGN.md) | ✓ §Slider |
| Tabs | (not in DESIGN.md) | ✓ §Tabs |
| Dialog | (not in DESIGN.md as a generic) | ✓ §Dialog |
| Skip Link | (not in DESIGN.md) | ✓ §Skip Link |
| Banner (Offline, Update) | (covered via Alert) | ✓ §Banner |
| Color/Theme Indicator | (not in DESIGN.md) | ✓ §Color/Theme Indicator |
| "What gets copied?" disclosure | (not in DESIGN.md) | ✓ §"What gets copied?" disclosure |

Visual coverage in DESIGN.md: 15 named components. Behavioral coverage in EXPERIENCE.md: 22 named components. The behavioral side lists 7 components that have **no visual entry** in DESIGN.md (Sample Data Link, Pack Card, Breadcrumb, Star/Pin, Numeric Stepper, Toggle, Slider, Tabs, Skip Link, Theme Indicator, Disclosure). These are compositional arrangements using existing tokens, so the visual contract is *implicit* via the underlying components they compose from — but consumers extracting visuals will not find an explicit entry.

### Findings
- **(high)** **Toggle Switch, Slider, Tabs, Numeric Stepper, Skip Link, Star (Pin)** have behavior-only definitions. Either they should each appear in DESIGN.md.`Components` (with at minimum: sizing, color tokens, states), or EXPERIENCE.md should state that they are compositions of `button`/`input`. *Fix:* add brief visual rows for the 7, OR mark them as compositions explicitly.
- **(medium)** `Result Card` has a dedicated visual entry but no behavioral row in EXPERIENCE.md §4. *Fix:* add a row (it's referenced indirectly via Result Tile and Tool Footer copy).
- **(low)** `Empty State` has a dedicated visual entry but its behavior is implicit across State Patterns. *Fix:* add a brief §Empty State row.
- **(low)** `Select` has a visual row but its behavior is implicit ("shares input states"). *Fix:* add a one-line row in EXPERIENCE.md §4.

---

## 4. State coverage — **adequate**

**What was checked.** Walked every IA surface from EXPERIENCE.md §2 (23 surfaces, #1–#23). Listed every state it should plausibly have. Cross-referenced EXPERIENCE.md §5 (State Patterns).

| Surface | States covered (in §5) | States plausible but missing |
|---|---|---|
| Home (Grid) | cold-load, empty-search | permission-denied (n/a), focus (universal) |
| Home (Search) | cold-load, empty-search | focus management (palette handles) |
| Tool Page | cold-load, cold-load (heavy), empty-tool, partial-input, validation-error, success/copy/share/print, offline, offline+never-visited, embed, embed+offline, RTL, reduced-motion | — |
| Tool Page — History | empty-history | per-entry delete (in §4 as "× button"), offline (no) |
| Tool Page — Sample Data | (no state row) | loading-state, success-acknowledged |
| Command Palette | empty-results (no-matches), keyboard-open | cold-load, offline |
| Settings Modal | (no state row) | mid-edit, save-error |
| Keyboard Help Overlay | keyboard-open | search-with-no-results |
| History Panel | empty-history | — |
| PWA Install | installed | declined-3-times, browser-unsupported, iOS-prompt |
| Offline Banner | offline, offline+never-visited | reconnect, per-session-dismissed |
| Service Worker | updating | (covered) |
| Pack Page | empty-pack (cannot happen) | cold-load |
| Embed Mode | embed, embed+offline | embed-error |
| 404 | (no state row) | search-with-no-results, levenshtein-match |
| `/offline` | (no state row) | cache-evicted |
| Quality Page | (no state row) | tool-failing, remediation-expanded |
| Privacy Page | (no state row) | wire-log-with-N>0 |

EXPERIENCE.md §5 contains 18 state rows, covering tool-page states thoroughly and weaker on chrome/modal/404/quality/privacy states.

### Findings
- **(medium)** **404 page** (IA #22) is in IA but has no State row; the "Did you mean…" path needs explicit treatment (which strings, which link states). *Fix:* add a State Patterns row for 404.
- **(medium)** **Settings Modal** has no State row (validation-error if a setting import fails; mid-edit; section-switch). *Fix:* add a row.
- **(medium)** **PWA Install Prompt** has install-completed but not "browser unsupported," "private mode," "declined ≥3 times → hidden per spec." *Fix:* add rows for these.
- **(low)** **Command Palette** lacks a cold-load state (the index build is described in §2.5 as ≤30 ms; not zero). *Fix:* add a one-line state row.
- **(low)** **History Panel** "delete" behavior is documented behaviorally (§4 row "× button") but no state treatment for "entry deleted" (toast? undo?). *Fix:* add a brief state.

---

## 5. Visual reference coverage — **thin**

**What was checked.** DESIGN.md frontmatter `sources` lists six artifacts (PRD, brief, brainstorm, index.html, three CSS files). No `mockups/`, `wireframes/`, or `imports/` directories are referenced anywhere in either spine. DESIGN.md §"(a) Embed iframe chrome", §"(b) `/privacy` page", §"(c) `/quality` page" are detailed in prose but have no companion visuals.

### Findings
- **(medium)** DESIGN.md §"Three best-of-internet signals" describes the embed surface, the privacy page (with three required panels), and the quality page (with a 10-column grid), but **none of these have a visual artifact or wireframe referenced**. Per validate.md Pass 1 #5, spines must link inline to each artifact in `mockups/`, `wireframes/`, or `imports/`. *Fix:* either add `mockups/` references for each signal, or note explicitly that wireframes are deferred to architecture.
- **(low)** DESIGN.md cites `assets/css/base.css`, `assets/css/components.css`, `assets/css/tools.css` as sources — the legacy stylesheets the system replaces. Useful provenance; no fix needed.

---

## 6. Bloat & overspecification — **strong**

**What was checked.** Looked for: pixel specs where tokens cover them, source restatement (personas/FRs/scope), decorative narrative, sections no downstream consumer would read.

- DESIGN.md prose carries editorial voice by intent ("Surface > ink," "the tool fades, the answer stays," "Where the rest of the utility internet screams, Handy Tools is quiet"). This is *allowed* per validate.md ("DESIGN.md prose may carry editorial voice"). It earns its place: it is the brand posture the components implement.
- EXPERIENCE.md prose is appropriately functional; the §3.5/§3.6/§3.7 "Voice on …" sections are useful to copywriters and code reviewers, not decorative.
- A few places could be tightened without losing signal:
  - **DESIGN.md §"Do's and Don'ts" #5** restates the motion rule already stated in §"Brand & Style." Acceptable as a hard-rule reminder.
  - **EXPERIENCE.md §9.5** "Flow-Level Rules" restates rules from §6 (no hover-only, 44 px tap targets, undo toasts). Acceptable because flows are the contractual surface; the repetition is by design.
  - **DESIGN.md §"(a) Embed iframe chrome"** restates FR-10 from the PRD. The restatement adds visual specifics (the iframe is silent by design, badge defaults, focus rings survive), which is downstream-relevant.

### Findings
- **(low)** EXPERIENCE.md §10.5 defines a full `postMessage` capability matrix (`embed.ready`, `embed.result`, `embed.height`, `embed.theme`, `embed.error`, plus four inbound capabilities). PRD FR-11 only requires JSON-validated commands and the host's ability to read state, set inputs, and subscribe to result updates. The spine ships four capabilities that the PRD does not request. *Fix:* trim to the PRD-mandated subset (`embed.result`, `host.setValue`, `host.getResult`) and mark the others as forward-compatible; or call them out as out-of-PRD additions.
- **(low)** DESIGN.md §"Colors → Trust accent" prose is solid; the §"Don't #2 — Don't introduce a fifth color" rule in Do's and Don'ts restates the same rule. Acceptable; flag as informational only.

---

## 7. Inheritance discipline — **strong**

**What was checked.** Sources resolve. UJ/requirement names match the PRD verbatim. Glossary identical across spines and sources. Component names identical across both files. EXPERIENCE.md token references resolve to DESIGN.md tokens by name.

**Source alignment (verbatim matches).**
- "Tool Contract (Quality Bar)," "10 criteria," "8 of 10," "Try an example," "View source," "Embed Mode," "Site Data," "Trust Surface," "Tool History," "PWA" — all in PRD §3 Glossary and used identically in EXPERIENCE.md.
- "Bill Splitter," "Compound Interest," "Pomodoro," "GPA," "word counter," "JSON formatter," "Base64," "UUID," "JWT," "Timestamp," "Diff," "Regex Tester" — PRD §4.8 / §2.3 names match EXPERIENCE.md §2.2 slug list and §2.3 pack composition.
- PRD §4.6 "Trust Surface" = EXPERIENCE.md §9 "Trust statements" / DESIGN.md §"(b) `/privacy` page" — same artifact.
- PRD §4.1 rubric #1 "Keyboard-complete" = EXPERIENCE.md §6.1, §6.2, §7 — consistent.
- PRD §4.1 rubric #2 "Mobile ergonomics, tap targets ≥44 px" = EXPERIENCE.md §6.3 "Tap targets ≥44×44 px," §7 Accessibility Floor row, §8 Breakpoints — consistent.
- PRD §4.1 rubric #4 "Shareable state, URL-encoded" = EXPERIENCE.md §9.2 UJ-2 climax (Marco shares via permalink) — consistent.
- PRD §4.1 rubric #7 "Last 10 inputs/outputs per tool" = EXPERIENCE.md §4 History Panel "last 20 inputs" / §2 IA #7 "Last 20 inputs, local-only" — **mismatch: 10 vs 20**.
- PRD §4.1 rubric #10 "Source visible" = EXPERIENCE.md §2 IA #12 + DESIGN.md §"(c)" quality page and "View source" links in Tool Footer — consistent.

**Glossary identity.** All 12 PRD glossary terms (Tool, Tool Contract, Shell, Pack, Command Palette, Embed Mode, Site Data, Trust Surface, Tool History, PWA, Quality Bar, plus "Trust Surface" / "Tool History") are used in EXPERIENCE.md without synonym drift. "Tool Card" appears in both spines with identical meaning.

**Component name identity.** Button, Input, Select, Textarea, Result Tile, Result Card, Tool Card, Command Palette, Settings Modal, History Panel, Tool Header, Tool Footer, Alert, Empty State, Keyboard Help Overlay, Embed Chip — names are byte-identical across both spines.

### Findings
- **(high)** **History count drift: PRD §4.1 rubric #7 says "Last 10 inputs/outputs persisted in localStorage per tool"; EXPERIENCE.md says "Last 20 inputs" in §2 IA #7 and §4 History Panel row.** This is a contract contradiction a downstream consumer will hit at implementation. *Fix:* reconcile — either change PRD rubric to 20, or change EXPERIENCE.md to 10. PRD rubric is authoritative for the 8/10 gate.
- **(medium)** **PRD §4.1 rubric #3 "Offline ready"** is satisfied (EXPERIENCE.md §1.7–§1.8, §8.3, §9.4), but DESIGN.md never explicitly addresses offline visuals (e.g., the offline banner color, the offline-cached state styling). The token reference exists via `{components.alert.warning}` but no offline-specific component exists. *Fix:* add an `offline-banner` visual entry that uses `{components.alert.warning}` or a new token.
- **(low)** **PRD §4.1 rubric #4 "Shareable state, URL-encoded"** is described behaviorally in §9.2 but not declared as a contract obligation for every tool page in §2 (IA surfaces do not list "permalink copy" as a separate surface; it's nested in share). *Fix:* add to §2 IA surface list for tool pages.

---

## 8. Shape fit — **strong**

**What was checked.** DESIGN.md section order is canonical. EXPERIENCE.md required defaults are present. Dropped defaults are defensible. Required-when-applicable sections are present.

**DESIGN.md order (canonical):** Brand & Style ✓ → Colors ✓ → Typography ✓ → Layout & Spacing ✓ → Elevation & Depth ✓ → Shapes ✓ → Components ✓ → Do's and Don'ts ✓. All in canonical order. The "Three best-of-internet signals" section is appended after Do's and Don'ts — out of canonical order. Defensible because it is the trust/embed-specific treatment that exceeds a typical design system.

**EXPERIENCE.md required defaults:**
- Foundation ✓ (§1)
- Information Architecture ✓ (§2)
- Voice and Tone ✓ (§3)
- Component Patterns ✓ (§4)
- State Patterns ✓ (§5)
- Interaction Primitives ✓ (§6)
- Accessibility Floor ✓ (§7)
- Key Flows ✓ (§9)

EXPERIENCE.md additionally has §8 Responsive & Platform and §10 Embed Mode, both required-when-applicable (multi-surface + embed). Plus Appendix A Anti-Goals and Appendix B Versioning — invented sections, defensible (anti-goals protect the brand posture; versioning is a contract on the contract).

### Findings
- **(low)** DESIGN.md has the canonical order, but the "Three best-of-internet signals" section is appended after Do's and Don'ts rather than integrated. This is a soft shape-fit deviation. *Fix:* move into Components or Do's and Don'ts as a numbered subsection, or annotate explicitly that it is an appendix to the canonical body.
- **(low)** EXPERIENCE.md Appendix A Anti-Goals mirrors PRD §5 Non-Goals near-verbatim. Acceptable as long as EXPERIENCE.md is the operative behavior contract for the team (anti-goals inform what gets designed out).

---

## Mechanical notes

**Frontmatter completeness (DESIGN.md).**
- `name`: ✓ "Handy Tools"
- `status`: ✓ "final"
- `sources`: ✓ 7 entries, all resolvable
- `updated`: ✓ 2026-07-31
- Missing per `design-md-spec.md`: `description` (one-line statement). *Fix:* add `description: Visual identity contract for the Handy Tools browser tool suite.`.
- Colors keys: kebab-case ✓ for top-level (`primary`, `neutral-light`, `neutral-dark`, `semantic`, `semantic-dark`, `trust`, `high-contrast`); nested keys are camelCase (e.g., `DEFAULT`, `surface-1`, `soft-strong`, `border-strong`, `muted-strong`, `info-on`, `danger-on`, `success-on`, `warning-on`, `accent-hover`, `accent-pressed`, `disabled-bg`, `disabled-fg`, `disabled-shadow`, `hover-shadow`, `hover-border`, `confirmed-bg`, `confirmed-fg`, `bg-hover`, `bg-pressed`, `border-hover`, `border-focus`, `border-error`, `label-size`, `hint-size`, `padding-x`, `chevron-size`, `chevron-color`, `min-height`, `label-size`, `label-fg`, `value-size`, `value-fg`, `accent-value-fg`, `copy-icon-color`, `bg-hover`, `border-hover`, `border-accent`, `icon-bg`, `icon-fg`, `title-size`, `title-weight`, `desc-size`, `desc-fg`, `hover-translate`, `featured-span`, `backdrop`, `panel-bg`, `panel-radius`, `panel-shadow`, `panel-width`, `input-height`, `item-height`, `item-padding-x`, `item-radius`, `item-hover-bg`, `item-active-bg`, `item-active-fg`, `item-inactive-fg`, `item-meta-fg`, `footer-fg`, `footer-size`, `panel-padding`, `section-gap`, `group-title-size`, `group-title-fg`, `entry-padding`, `entry-radius`, `entry-hover-bg`, `entry-active-bg`, `meta-size`, `meta-fg`, `padding-block`, `subtitle-size`, `subtitle-fg`, `back-link-fg`, `back-link-hover`, `fg-strong`, `link-fg`, `icon-size`, `column-gap`, `row-gap`, `kbd-bg`, `kbd-radius`, `kbd-padding-x`, `kbd-min-width`, `kbd-fg`, `label-fg`, `label-size`, `copy-fg`, `copy-bg-hover`, `line-height`, `max-width`, `text-align`, `padding-inline-lg`, `padding-inline-md`, `padding-inline-sm`). The spec says "kebab-case keys" for `colors`, but here camelCase is used heavily for nested tokens. This is a consistent local convention; *Fix:* note in DESIGN.md that nested component tokens use camelCase by intent, or convert to kebab-case.
- `rounded` keys: `none`, `sm`, `md`, `lg`, `xl`, `full` ✓ (matches spec scale names).
- `spacing` keys: mix of `'s-1'`..`'s-12'` and semantic aliases (`gutter`, `margin-mobile`, `margin-desktop`, `section-gap`, `row-gap`, `inline-gap`, `container-narrow`, `container-wide`, `dialog`, `header-height`, `touch-target`, `unit`). Spec example shows `'1'`..`'2'`; `'s-1'`..`'s-12'` is a defensible variant for a 4px-grid system.
- `typography`: each role is an object with `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`. The role objects are sometimes *referenced whole* (`{typography.mono}`, `{typography.label}`, `{typography.label-caps}`, `{typography.body-sm}`, `{typography.body-md}`, `{typography.headline}`, `{typography.body-lg}`, `{typography.display-sm}`, `{typography.result-xl}`, `{typography.result-lg}`) and sometimes by field (`{typography.label.fontSize}`, `{typography.caption.fontSize}`, `{typography.body-md.fontSize}`, `{typography.body-sm.fontSize}`, `{typography.body-md.fontWeight}`, `{typography.headline.fontSize}`, `{typography.body-lg.fontSize}`, `{typography.display-sm.fontSize}`, `{typography.label.fontSize}`, `{typography.label-caps}`). The whole-role references resolve to objects, which consumers must flatten themselves. *Fix:* document the rule: "When you need a single property, use `.fontSize`; when you need the whole role as a CSS value bundle, reference the role."
- `components`: nested objects with `{path.to.token}` references per spec ✓.

**Frontmatter completeness (EXPERIENCE.md).**
- No YAML frontmatter. The spine has a heading and prose body only. This is acceptable per spec ("markdown body") because the spec does not mandate YAML on EXPERIENCE.md; but DESIGN.md frontmatter is fully populated.
- Sources referenced in EXPERIENCE.md prose: DESIGN.md (`§4.7`, `§4.10`, `§4.5`, etc.), PRD (multiple `§` citations). All section-number citations resolve. EXPERIENCE.md does not have a `sources` frontmatter listing the PRD and DESIGN.md explicitly. *Fix:* add a small sources frontmatter to EXPERIENCE.md that mirrors DESIGN.md.

**Mermaid / ASCII syntax.**
- §2.1 contains an ASCII nav graph (not Mermaid). Well-formed; no parse issues.
- No Mermaid blocks anywhere. Acceptable.

**Cross-references (mechanical).**
- DESIGN.md → PRD: `PRD §4.10`, `§4.7`, `§4.6`, `§4.4`, `§4.5`, `§4.1 rubric #2`, `§4.3` — all resolve (PRD §4.1 has 10 numbered rubric items; §4.4 is "Embed Mode"; §4.5 is "Lifecycle & Per-Tool History"; §4.6 is "PWA, Offline, & Trust Surface"; §4.7 is "Internationalization Scaffold"; §4.10 is "Constraints & Guardrails").
- EXPERIENCE.md → DESIGN.md: tokens (`{typography.label}`, etc.), implicit section refs ("DESIGN.md §4.10" not used; references are by token path). Consistent.
- EXPERIENCE.md → PRD: `§4.1`, `§4.5`, `§4.7`, `§4.10`, `§2.3` (implicit). Consistent.

**Name inconsistencies (resolved).**
- "Trust Surface" / "Trust accent" / "Trust statement" — three phrases, one concept (the set of pages/elements that make privacy/source claims auditable). Acceptable; "Trust Surface" = PRD term, "Trust accent" = DESIGN.md visual term, "Trust statement" = EXPERIENCE.md copy term. Each is a distinct noun; resolve in a glossary.
- "Embed Mode" / "Embed" / "embed" / "embed-chip" — all refer to the `?embed=1` mode. Consistent.
- "Result Tile" / "Result Card" — distinct components (small dense vs. wide prominent). Consistent.
- "Pack" vs "Pack Row" vs "Pack Card" — distinct but related. Consistent.

**Broken / unresolved cross-refs.**
- None found.

---

## Severity summary

- **Critical:** 0
- **High:** 2 (component coverage gap on 7 behavior-only components; PRD ↔ EXPERIENCE history-count contradiction)
- **Medium:** 7
- **Low:** 14
- **Total findings:** 23

### Critical (0)
*None.*

### High (2)
1. **[Component coverage]** Toggle, Slider, Tabs, Numeric Stepper, Skip Link, Star (Pin) Button, Theme Indicator — visual entries missing in DESIGN.md. (§ DESIGN.md Components). *Fix:* add brief visual rows, or mark them as compositions of button/input.
2. **[Inheritance discipline]** History count drift: PRD §4.1 rubric #7 says 10; EXPERIENCE.md §2 IA #7 and §4 say 20. *Fix:* reconcile to 10 (PRD authoritative for the 8/10 gate).

### Medium (7)
3. **[Token completeness]** `{colors.primary.soft-strong}` defined but never consumed. (§ DESIGN.md colors.primary). *Fix:* assign to a component or remove.
4. **[Token completeness]** No banner-specific color token for offline banner; EXPERIENCE.md §1.8 references `--color-warning` that doesn't exist as a CSS custom property. *Fix:* add a banner token, or rewrite EXPERIENCE.md to reference `{components.alert.warning}` and a new `--color-warning` alias.
5. **[Token completeness]** Typography reference granularity inconsistent (whole role vs. `.fontSize`). (§ DESIGN.md components.input/alert). *Fix:* document the rule, or normalize.
6. **[Component coverage]** Result Card has no behavioral row in EXPERIENCE.md §4. (§ EXPERIENCE.md Component Patterns). *Fix:* add a row.
7. **[State coverage]** 404 page has no State Patterns row. (§ EXPERIENCE.md §5). *Fix:* add a row covering search-empty, levenshtein-match, etc.
8. **[State coverage]** Settings Modal has no State Patterns row. (§ EXPERIENCE.md §5). *Fix:* add rows for mid-edit, save-error, import-validation.
9. **[Visual reference coverage]** No mockups / wireframes for `/privacy`, `/quality`, embed surface. (§ DESIGN.md "(a)/(b)/(c)"). *Fix:* add inline mockup references or defer to architecture with an explicit note.

### Low (14)
10. **[Flow coverage]** PRD FR-4 (shareable URL state) not given a dedicated key flow. (§ EXPERIENCE.md §9). *Fix:* optional UJ-5.
11. **[Component coverage]** Empty State has visual row, no behavioral row in EXPERIENCE.md. *Fix:* add a row.
12. **[Component coverage]** Select has visual row, no behavioral row. *Fix:* add a row.
13. **[State coverage]** Command Palette cold-load state missing. *Fix:* add a one-line row.
14. **[State coverage]** History Panel "entry deleted" toast state missing. *Fix:* add a row.
15. **[State coverage]** PWA Install declined-3-times / browser-unsupported states missing. *Fix:* add rows.
16. **[State coverage]** Quality / Privacy page states missing. *Fix:* add rows.
17. **[Bloat]** EXPERIENCE.md §10.5 `postMessage` capability matrix exceeds PRD FR-11 scope. *Fix:* trim or annotate as forward-compatible.
18. **[Inheritance discipline]** Offline visual contract lives in alert.warning tokens; no offline-banner component. *Fix:* add `components.offline-banner` or document the override.
19. **[Inheritance discipline]** PRD §4.1 rubric #4 "Shareable state" not declared as a separate IA surface. *Fix:* add to §2 IA surface list.
20. **[Shape fit]** DESIGN.md "Three best-of-internet signals" appended after canonical body. *Fix:* move into Components or annotate as appendix.
21. **[Mechanical]** DESIGN.md frontmatter missing `description`. *Fix:* add.
22. **[Mechanical]** DESIGN.md nested color/component keys use camelCase; spec says kebab-case for `colors`. *Fix:* document the deviation or convert.
23. **[Mechanical]** EXPERIENCE.md has no `sources` frontmatter. *Fix:* add a small sources list mirroring DESIGN.md.

---

## Files

- `C:\ZDrive Folders\Projects\useful-tools\_bmad-output\planning-artifacts\ux-designs\ux-useful-tools-2026-07-31\review-rubric.md` (this file)
- `DESIGN.md` (read-only, not edited)
- `EXPERIENCE.md` (read-only, not edited)

---

*End of review. Spines not edited.*