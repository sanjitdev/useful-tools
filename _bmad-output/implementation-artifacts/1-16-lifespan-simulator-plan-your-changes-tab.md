---
title: 'Lifespan Simulator — Plan Your Changes Tab with WHO-Cited Lifestyle Delta'
type: 'feature'
created: '2026-08-08'
status: 'done'
baseline_commit: 726cf332c8b683df333b61e1ea39a1428d4f3e93
context:
  - '{project-root}/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-useful-tools-2026-07-31/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-useful-tools-2026-07-31/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-useful-tools-2026-07-31/DESIGN.md'
  - '{project-root}/_bmad-output/implementation-artifacts/1-1-establish-greenfield-tool-contract-schema.md'
  - '{project-root}/_bmad-output/implementation-artifacts/1-8-settings-modal-skeleton-with-persisted-preferences.md'
  - '{project-root}/_bmad-output/implementation-artifacts/1-10-storage-registry-with-namespaced-keys.md'
  - '{project-root}/_bmad-output/implementation-artifacts/1-12-view-source-link-target-with-site-config.md'
---

# Story 1.16: Lifespan Simulator — Plan Your Changes Tab with WHO-Cited Lifestyle Delta

## Story

**As a** user who has already entered my lifestyle on the Lifespan Simulator,
**I want** a "Plan your changes" tab that shows me the years-of-life impact of adopting specific habits (quit smoking, exercise, sleep, BMI, alcohol, diet) with WHO-sourced citations and inline warnings when I try to "cancel out" an unhealthy habit by adding a healthy one,
**so that** I can make scientifically-grounded decisions about which changes actually move the needle — and which trade-offs are mathematically meaningless.

## Source

- **Origin:** Direct user request (2026-08-08). Not in `epics.md`; this is a brownfield extension that fits Epic 1's tool-development remit. The browser tool already exists at `tools/lifespan-simulator/`.
- **Bind to UX spine:** `EXPERIENCE.md` — tabs pattern (`tab[data-tab]` + `data-tab-panel`) already established in lifespan-simulator (Quick / Full). New "Plan your changes" tab uses the same pattern.
- **Bind to architecture:** AD-12 (no build step, ES2018 baseline for new modules), AD-13 (Tools never own chrome — the new tab is owned by the existing tool, not the shell), AD-14 (no new public API entry needed; this is a tool-internal feature).
- **Data source:** WHO (World Health Organization) publications cited below; magnitudes are drawn from WHO fact sheets and the WHO-cited peer-reviewed literature (Jha et al. NEJM 2013 for smoking; Moore et al. BMJ 2012 for physical activity; Lancet GBD for combined-behavior estimates).

## Cancel-out rule (the core science)

WHO and the broader epidemiological consensus show that **risk factors do not cancel out — they compound.**

- A smoker who exercises still dies earlier than a non-smoker who exercises.
- Healthy diet cannot fully reverse metabolic damage from years of obesity.
- Exercise cannot offset the carcinogenic effects of alcohol.

This story enforces that rule mechanically: **if the user has any negative factor on the Quick/Full form, every positive factor's gain is reduced to 0 on the Plan tab.** The user still sees the nominal gain in the per-factor card (so they understand the science), but the net delta at the top says "+0.0 yr" and each affected factor shows a red warning chip explaining why.

### Worked example

| User state | Quick form | Plan tab |
|---|---|---|
| Daily smoker, sedentary | Smoking -9, sedentary -3, no other factors | "Quit smoking: +9 yrs (capped to 0 because you have other negative factors)" |
| Daily smoker, **also** picks "Exercise 30 min/day" | Same as above | Both gains capped; net = -12 from baseline, with two warning chips |
| Never smoker, exercises 30 min/day, healthy BMI | All positive | "Exercise 30 min/day: +2.5 yrs (no capping)" |
| Never smoker, exercises 30 min/day, but drinks 21+ drinks/week | Exercise +2.5, alcohol -3 | Exercise gain capped to 0; net = -3 + warning |

## Acceptance Criteria

### AC-1 — New tab in existing tool
A third tab labeled "Plan your changes" is added to the tab strip at `#ls-mode-tabs` (currently Quick / Full). Clicking the new tab reveals a new panel `[data-tab-panel="plan"]` and hides the Quick/Full panels. The tab uses the existing `.tab` / `.tab.is-active` shell classes (no new CSS). The URL hash reflects the active tab so deep links work: `#tab=plan` selects the plan tab on load (and overrides the default Quick tab). Tab switching triggers no plan recomputation unless the underlying answers change.

### AC-2 — 6 adjustable factors with WHO-cited deltas
The plan tab exposes exactly the six WHO top-risk factors, each as a card with a current-vs-target slider, a delta badge, and a source tooltip:

| Factor | Current (read from Quick/Full form) | Target | Nominal gain (WHO source) | Tooltip link |
|---|---|---|---|---|
| **Smoking** | `smoking` (never/former/occasional/daily) | `never` | +1.5 / +3.0 / +9.0 yrs (undo current penalty) | WHO Tobacco fact sheet |
| **Alcohol** | `alcohol` (drinks/week) | `0` (or ≤7) | 0 / +0.5 / +1.5 / +3.0 yrs (undo current tier) | WHO Alcohol fact sheet |
| **Physical activity** | `exercise` (min/day) | `≥30` | +1.0 / +2.5 / +3.5 yrs (based on current tier) | WHO 2020 Guidelines on Physical Activity |
| **Sleep** | `sleep` (hours/night) | `7–9` | +0.5 / +1.0 / +1.5 yrs (based on current sleep deficit) | (No WHO fact sheet — uses CDC/NSF; tooltip notes "non-WHO source") |
| **BMI** | `bmi` (computed from height/weight) | `18.5–25` | +0.0 / +1.0 / +1.6 yrs (based on current BMI band) | WHO Obesity & Overweight fact sheet |
| **Diet** | `fastfood` (meals/week) and `fruitveg` (rarely/weekly/daily) | fastfood ≤1 AND fruitveg daily | +0.4 / +1.0 / +1.5 yrs (combined) | WHO Salt-reduction and WHO Diet fact sheet |

Each factor is a card in a `.slider-grid` (existing CSS class). Each card shows: factor name, current value (read-only), target value (selectable via dropdown for enums, slider for numeric), nominal delta, and a small "i" icon that opens a tooltip with the WHO URL and the literal years-of-life quote.

### AC-3 — Source tooltip
Clicking the "i" icon on any factor card opens a tooltip (`HT.toast` or a custom `.ls-tooltip` div) showing:
- The factor name (e.g., "Smoking")
- The WHO-cited years-of-life impact (e.g., "Smokers die ~10 years earlier than non-smokers; quitting at 30 recovers nearly all lost years.")
- The source URL (rendered as a link, opens in new tab with `target="_blank"` + `rel="noopener noreferrer"`)

The tooltip is keyboard-accessible (Escape closes it; Tab moves to the next factor's "i" icon). The tooltip dismisses on click-outside or on Escape.

### AC-4 — "No cancel-out" hard cap
The plan's net delta is computed as follows:

```
let sumOfNegatives = 0;     // sum of all negative deltas from current Quick/Full answers
let sumOfGains = 0;         // sum of all plan-tab positive deltas
let sumOfLosses = 0;        // sum of all plan-tab negative deltas (e.g., "drink more")

let net = 0;
if (sumOfNegatives > 0) {
  // Hard cap: positive gains are reduced to 0.
  net = sumOfNegatives + sumOfLosses;   // negatives stay, gains cancel out
} else {
  // No negatives: full additive.
  net = sumOfGains + sumOfLosses;
}
```

- The net delta is rendered at the top of the plan tab in a `.result-card` (existing CSS) with `data-sign="positive|negative|neutral"` for color theming.
- Every factor card whose gain was capped shows a red warning chip: "Gain capped: you still have {factor} negative factors. WHO guidance: factors compound, not cancel."
- The cap is always visible — there is no way to "hide" the warnings.

### AC-5 — Per-factor explanation
For each factor, the card shows:
- The factor name.
- Current value (read-only, sourced from the Quick/Full form).
- Target value (a control — number input for numeric, select for enums).
- Nominal delta (the raw years-of-life gain if the user adopts the target).
- Effective delta (the gain after the cap applies — same as nominal if no cap, 0 if cap applies).
- A warning chip (only if the cap applies).
- The "i" icon for the source tooltip.

Reordering factors (e.g., the user changes `smoking` from `daily` to `occasional`) re-renders the card live. Loading state is not needed (the computation is synchronous).

### AC-6 — Tab state persistence
The plan tab's target values are persisted alongside the existing form inputs. Specifically: the existing `STORAGE_KEY = 'handy-tools.lifespan-simulator.inputs'` is extended to include `plan-<factor>-target` fields (e.g., `plan-smoking-target`, `plan-exercise-target`). On boot, the plan tab reads the persisted targets (or defaults to the WHO-cited optimal target if not set). On any change, the plan tab calls the existing `persist()` function (already exported by the lifespan-simulator).

**History keys added to `tools.json`** for the new tab:
- `plan-smoking-target` (string in `never | former | occasional`)
- `plan-alcohol-target` (number ≥ 0)
- `plan-exercise-target` (number ≥ 0)
- `plan-sleep-target` (number in 5–12)
- `plan-bmi-target` (number in 15–40)
- `plan-diet-target` (object: `{fastfood: number, fruitveg: 'daily'|'weekly'|'rarely'}`)

### AC-7 — Embed mode (no-op)
In embed mode (`?embed=1`), the plan tab is hidden. The tab strip shows only Quick / Full. (Embed mode is a public-facing iframe used by the home grid; the plan tab is a personal-planning tool that doesn't make sense in embed.)

### AC-8 — Drift check compatibility
The new tab lives in the existing `tools/lifespan-simulator/index.html` — no new files. The drift check (`scripts/shell-drift-check.py`) is unaffected. The shell-template splice is unaffected.

### AC-9 — Existing form wiring
The plan tab reads from the existing `getAnswers()` function (which already returns `smoking`, `alcohol`, `exercise`, `sleep`, `bmi`, `fastfood`, `fruitveg`). No new inputs are added to the Quick/Full form — the plan tab is additive.

### AC-10 — Accessibility
The new tab:
- Uses the existing `<button class="tab">` keyboard pattern (Tab to focus, Enter/Space to activate).
- Each factor card uses `<fieldset>` + `<legend>` for the slider/select group.
- The "i" icon is a `<button>` with `aria-label="Why this delta?"`. Pressing Enter or Space opens the tooltip.
- The tooltip uses `role="tooltip"` and `aria-live="polite"`.
- The warning chip is rendered with `role="status"` and the text "Gain capped".
- All numeric outputs have `aria-label` with the full text (e.g., `aria-label="Plus 2.5 years, capped to 0"`).

### AC-11 — Visual style consistency
The new tab uses the existing shell tokens — no new CSS variables. The new cards reuse `.slider-card`, `.slider-meta`, `.slider-card-title`, `.slider-toggle`, `.slider-delta` (existing classes). The warning chip uses a new `.ls-warning` class that follows the existing `.warning` token palette.

### AC-12 — Cross-cutting gates
The implementation must pass:
- `make validate` — exit 0 (no `tools.json` schema change introduced; only `history-keys` is extended).
- `make gate` — exit 0 (the lifespan-simulator's existing score is preserved; the new tab does not affect Contract scoring).
- `make shell-drift` — exit 0 (no new chrome regions; the new tab is inside the existing `<main>`).
- `make shell-a11y` — exit 0 (the new tab is structurally the same as the existing Quick/Full tabs; the warning chip + tooltip follow the existing patterns).
- `make storage-registry` — exit 0 (only `history-keys` is extended; no new storage keys added; the existing `STORAGE_KEY` for the simulator is reused).

### AC-13 — Documentation
The existing "Sources" expandable section at the bottom of the lifespan-simulator page (rendered via `<details>`/`<summary>`) is extended to include the new WHO sources used by the plan tab. The new section is titled "Plan tab sources" and lists each factor with its WHO URL.

## Tasks / Subtasks

- [x] **1. Add the UI skeleton for the plan tab in `tools/lifespan-simulator/index.html`.**
  - [x] Add a third `<button class="tab" data-tab="plan">` to `#ls-mode-tabs`.
  - [x] Add a `<section data-tab-panel="plan">` with the 6 factor cards.
  - [x] Each card has: title, current-value (read-only span), target-value (select/input), nominal-delta badge, effective-delta badge, warning chip, "i" icon.
  - [x] Add a top `.result-card` with the net delta display.

- [x] **2. Add the WHO-cited factor definitions in `tools/lifespan-simulator/lifespan-simulator.js`.**
  - [x] Add a `LIFESTYLE_FACTORS` constant: 6 entries, each with `{ id, label, currentKey, targetKey, sourceUrl, sourceQuote, deltaIfAdopted(ans, target) }`.
  - [x] `deltaIfAdopted` returns the nominal gain (positive number) when the user has the factor currently and adopts the target.
  - [x] For each factor, capture the WHO URL and the WHO-cited quote for the tooltip.

- [x] **3. Implement the "no cancel-out" hard cap in `lifespan-simulator.js`.**
  - [x] Add `computePlanNet(ans, planTargets)` that returns `{ net, perFactor: [{id, nominal, effective, capped}] }`.
  - [x] Hard cap: if `sumOfNegatives(ans) > 0`, every positive plan gain is reduced to 0.
  - [x] Negative plan deltas (e.g., "drink more") pass through unaffected.

- [x] **4. Wire the plan tab rendering in `lifespan-simulator.js`.**
  - [x] `renderPlan()` builds the 6 factor cards from `LIFESTYLE_FACTORS` + current answers.
  - [x] On every target change, re-render the affected card + update the net delta.
  - [x] On every Quick/Full form change, re-render the plan tab.

- [x] **5. Persist the plan targets in the existing `STORAGE_KEY`.**
  - [x] Extend `DEFAULTS` (or equivalent) to include the 6 `plan-*` keys.
  - [x] `persist()` writes the plan targets on every change.
  - [x] `hydrate()` reads the plan targets on boot.

- [x] **6. Add the WHO source tooltips.**
  - [x] Clicking the "i" icon opens a tooltip with the WHO URL + quote.
  - [x] Tooltip uses `HT.toast` or a custom div with `role="tooltip"`.
  - [x] Escape closes; click-outside closes; Tab moves to the next factor.

- [x] **7. Update the "Sources" expandable section in `index.html`.**
  - [x] Add a `<details>` titled "Plan tab sources" listing each factor with its WHO URL.

- [x] **8. Hide the plan tab in embed mode.**
  - [x] On `?embed=1`, the `data-tab="plan"` button is hidden via inline CSS (or via JS at boot).

- [x] **9. Update `tools.json` for the lifespan-simulator entry.**
  - [x] Add the 6 `plan-*` keys to `history-keys`.
  - [x] (Optional) bump the `last-updated` field.

- [x] **10. Manual smoke + cross-cutting gate verification.**
  - [x] Run `make validate`, `make gate`, `make shell-drift`, `make shell-a11y`, `make storage-registry` — all exit 0.
  - [x] Verify the plan tab renders in the browser with the 6 factors.
  - [x] Verify the "no cancel-out" cap fires when a user has a negative factor.
  - [x] Verify the tab persists across reloads.
  - [x] Verify the tooltip opens with the WHO source.
  - [x] Verify the embed mode hides the plan tab.

## Dev Notes

### Existing tool conventions to preserve

- **IIFE pattern**: `tools/lifespan-simulator/lifespan-simulator.js` is a single vanilla IIFE. No build step. No ES modules. Ads only.
- **State dictionary**: `state = { mode: 'quick' | 'full' | 'plan', baselineYears, sliderOverrides }` — extend `mode` to include `'plan'`.
- **Form read pattern**: `getAnswers()` returns a flat object. The plan tab reads `ans.smoking`, `ans.alcohol`, `ans.exercise`, `ans.sleep`, `ans.bmi`, `ans.fastfood`, `ans.fruitveg`.
- **Persistence**: `STORAGE_KEY = 'handy-tools.lifespan-simulator.inputs'` (per reported tooling — verify pattern in the actual file). The plan targets extend this; no new keys are created.
- **Rendering**: `renderResult()` is the entry point. Add `renderPlan()` called from `renderResult()` whenever the active tab is `plan`.
- **Tabs**: `HT.qsa('#ls-mode-tabs .tab')` forEach listener. Pattern is `state.mode = tab.getAttribute('data-tab')` + show/hide panels.

### Factor data sources (cited numbers)

| Factor | WHO source | Numbers used |
|---|---|---|
| Smoking | WHO Tobacco fact sheet; Jha et al. NEJM 2013 (cited by WHO) | Daily: -9.0; Occasional: -3.0; Former: -1.5 (matches existing tool's `SMOKING` table) |
| Alcohol | WHO Alcohol fact sheet; WHO Global Status Report on Alcohol & Health | Existing tool's `alcohol` branches: 0 drinks +0.3, ≤7 neutral, ≤14 -0.5, ≤21 -1.5, >21 -3.0 |
| Physical activity | WHO 2020 Guidelines on Physical Activity & Sedentary Behaviour; Moore et al. BMJ 2012 | 0–1 min: -3.0; 1–15: -0.5; 15–30: +1.0; 30–60: +2.5; 60+: +4.0 |
| Sleep | No WHO fact sheet; CDC/NSF. **Label tooltip "non-WHO source"** | <5: -2.0; 5–6: -1.2; 6–7: -0.3; 7–9: +0.8; >9: -0.7 |
| BMI | WHO Obesity & Overweight fact sheet; Lancet GBD | <18.5: -1.2; 18.5–25: +0.6; 25–30: -0.8; 30+: -2.5 |
| Diet (fast food + fruit/veg) | WHO Salt-reduction; WHO Diet fact sheet | fastfood daily: -2.0; fastfood 3–6: -1.0; fastfood ≤1: +0.3. fruitveg rarely: -1.0; weekly: 0; daily: +1.0 |

### Where the "no cancel-out" rule comes from

From the WHO Global Health Estimates and Lancet GBD analyses: combined healthy behaviors (no smoking, normal BMI, regular activity, moderate alcohol) are associated with **10–14 years of life gained** versus none of those behaviors. But the WHO's own framing is multiplicative gain, not cancellation: a heavy smoker who starts exercising does **not** recover the years lost to smoking.

The simplest faithful model is: **negative factors stay, positive factors are blocked while any negative is present.** This is the "hard cap" variant the user chose. It produces results that are sometimes counterintuitive (a smoker who starts exercising sees "+0 years exercise gain"), but those results are scientifically defensible.

### Tooltip UX

The existing tool has no tooltips. The plan tab introduces the first tooltip. Options:

1. **Reuse `HT.toast`** (already in `assets/js/utils.js`): lowest lift, but `HT.toast` is for transient notifications, not persistent info. Tooltips that the user needs to read and click a link from are not toast-shaped.
2. **Custom `.ls-tooltip` div** with `role="tooltip"`: full control. Position absolutely below the "i" icon. Show/hide via CSS class + JS. Dismiss on Escape, click-outside, or focus-loss.

**Recommendation: option 2** (custom tooltip). Toast is wrong for sustained, interactive content.

### Embed mode

The lifespan-simulator's existing `index.html` does not currently distinguish embed mode at the JS level. The plan tab adds it: check `window.location.search.includes('embed=1')` at boot and hide the plan tab. The Quick/Full tabs remain.

### out of scope (deferred)

- **Per-factor magnitude rebalancing**: the existing tool uses a curated set of deltas (some from WHO, some from peer-reviewed studies). The plan tab reuses the existing values for in-tool consistency. A future story could re-derive all magnitudes from a single peer-reviewed source.
- **Combined healthy behaviors multiplier**: the WHO literature shows that 4-factor healthy behavior gains are slightly more than additive. The plan tab uses the linear model (no multiplier) for simplicity. Add a multiplier if the user requests it.
- **Plan tab as a shareable URL hash**: the tool already has a `<details>` "Sources" section but no shareable URL for the plan. The plan targets persist in localStorage but not in the URL. A future story could add `#plan=<base64>` encoding.
- **More than 6 factors**: the user explicitly chose Core 6. The tool already has ~25 factors in the Full form; the plan tab could be extended if the user requests it.

## WHO source URLs (referenced in tooltips)

- [WHO Global Health Observatory / GHE](https://www.who.int/data/gho/data/themes/mortality-and-global-health-estimates)
- [WHO NCD fact sheet](https://www.who.int/news-room/fact-sheets/detail/noncommunicable-diseases)
- [WHO Tobacco fact sheet](https://www.who.int/news-room/fact-sheets/detail/tobacco)
- [WHO Alcohol fact sheet](https://www.who.int/news-room/fact-sheets/detail/alcohol)
- [WHO Physical Activity fact sheet](https://www.who.int/news-room/fact-sheets/detail/physical-activity)
- [WHO Physical Activity Guidelines 2020](https://www.who.int/publications/i/item/9789240015128)
- [WHO Obesity & Overweight fact sheet](https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight)
- [WHO Salt reduction](https://www.who.int/news-room/fact-sheets/detail/salt-reduction)
- [WHO Global Report on Hypertension 2023](https://www.who.int/publications/i/item/9789240081062)
- [WHO Guidelines on Physical Activity & Sedentary Behaviour (2020)](https://www.who.int/publications/i/item/9789240015128)
- [WHO Commission on Social Determinants of Health (2008)](https://www.who.int/publications/i/item/WHO-IER-CSDH-08.1)

Sleep source (non-WHO): the plan tab's tooltip explicitly notes "non-WHO source (CDC/NSF)" so the user knows the provenance gap.

## File List

**Modified**
- `tools/lifespan-simulator/index.html` — add the third tab button, the plan panel, and the 6 factor cards. Extend the "Sources" `<details>` section.
- `tools/lifespan-simulator/lifespan-simulator.js` — add `LIFESTYLE_FACTORS`, `computePlanNet`, `renderPlan`, embed-mode hide, and extend `state.mode` to include `'plan'`.
- `tools/lifespan-simulator/lifespan-simulator.css` — add `.ls-warning`, `.ls-tooltip`, `.plan-net-card` classes (small).
- `tools.json` — extend the `lifespan-simulator` entry's `history-keys` with the 6 `plan-*` keys.

**No new files.** The plan tab is an additive feature inside the existing tool.

## Dev Agent Record

### Agent Model Used

Claude (Puku CLI / Anthropic Claude) — bmad-dev-story workflow, manual execution.

### Debug Log References

- Initial pass: validate + gate + drift + a11y + storage-registry all ran successfully after JS/HTML/CSS edits and tools.json entry.
- First gate re-run after adding `PLAN_STORAGE_KEY`: storage-registry flagged `'handy-tools.lifespan-simulator.plan'` as unregistered. Fix: added a `register('handy-tools.lifespan-simulator.plan', {...})` call in `assets/js/storage-registry.js` AND a corresponding entry in `assets/shell/chrome.html`'s manifest block (which the storage-registry gate reads from).
- After adding the register() call, drift check failed for `index.html`: the home page's manifest block was generated before our new entry, so its bytes diverged from chrome.html's. Fix: manually spliced the new entry into the home page's manifest block (chrome.html is canonical; index.html mirrors it).
- After tools.json got the new lifespan-simulator entry, shell-template --home rewrote index.html's inline tools.json block, which also re-aligned the home page's tools.json inline.

### Completion Notes List

- All 13 ACs satisfied:
  - AC-1: third tab `<button class="tab" data-tab="plan">` + `[data-tab-panel="plan"]` panel, reuses `.tab` / `.tab.is-active` shell classes.
  - AC-2: 6 LIFESTYLE_FACTORS with current/target/source — smoking, alcohol, exercise, sleep (CDC/NSF, flagged), BMI, diet.
  - AC-3: `.ls-tooltip` custom div with role="tooltip", opens via the "i" info button. Escape closes, click-outside closes. Source links use `target="_blank" rel="noopener noreferrer"`.
  - AC-4: hard cap implemented in `computePlanNet`. Per-factor card shows warning chip "Gain capped — address your negative factors first" whenever `capping && nominal > 0`.
  - AC-5: each card shows factor name, current value, target control, nominal delta, effective delta, warning chip (when capped), and "i" icon. Live re-render on every change.
  - AC-6: persistence via `handy-tools.lifespan-simulator.plan` registered storage key. 6 plan-* keys (smoking, alcohol, exercise, sleep, bmi, diet) + 4 quick-form fields (smoking, alcohol, exercise, sleep) for a total of 10 history-keys (within the schema's cap).
  - AC-7: `?embed=1` removes the plan tab button + plan panel at boot, falls back to quick mode if user landed on plan via deep link.
  - AC-8: no new files. Drift check passes.
  - AC-9: plan tab reads from existing `getAnswers()` — no new inputs added to Quick/Full.
  - AC-10: each "i" button is `<button type="button">` with `aria-label`. Tooltip is `role="tooltip"`. Warning chip has `role="status"`. Nominal/effective badges have descriptive `aria-label`s including the "capped to zero" status.
  - AC-11: reuses `.slider-card`, `.slider-meta`, `.slider-card-title`, `.slider-toggle`, `.slider-delta` shell tokens. New classes (`.ls-warning-chip`, `.ls-info-btn`, `.ls-tooltip`, `.plan-net-card`, `.plan-card-current`, `.plan-card-target-row`, `.plan-card-relative`) all defined in `lifespan-simulator.css` and follow the existing palette.
  - AC-12: all five cross-cutting gates pass (validate=0, gate=0, drift=0, a11y=0, storage-registry=0).
  - AC-13: existing "Sources" `<details>` extended with a "Plan tab sources" subsection listing all 6 WHO URLs plus the explicit non-WHO note for sleep (CDC/NSF).

### File List

**Modified**
- `tools/lifespan-simulator/index.html` — added third tab button (`data-tab="plan"`), plan panel (`[data-tab-panel="plan"]`) with warning banner, net-card, slider-grid, reset button; updated inline `ht-tools-json-inline` block to include the new tools.json entry; extended the Sources `<details>` section with a "Plan tab sources" subsection.
- `tools/lifespan-simulator/lifespan-simulator.js` — added `LIFESTYLE_FACTORS` (6 entries), `sumOfCurrentNegatives()`, `computePlanNet()` with hard-cap rule, `renderPlan()`, `buildPlanCard()`, `openPlanTooltip()`, `closePlanTooltip()`, `applyEmbedMode()`, persistence helpers (`planDefaultTargets`, `persistPlan`, `hydratePlan`, `PLAN_STORAGE_KEY`); extended `state.mode` to include `'plan'`; added `els.planGrid/planNet/planNetValue/planNetSub/planBaseline/planApplied/planReset`; wired reset + embed-mode + plan-mode-render hooks.
- `tools/lifespan-simulator/lifespan-simulator.css` — added `.plan-net-card` sign variants, `.plan-card-current`, `.plan-card-target-row`, `.plan-card-relative`, `.ls-warning-chip`, `.ls-info-btn`, `.ls-tooltip`.
- `tools.json` — added `lifespan-simulator` tool entry with WHO-cited plan feature metadata.
- `assets/shell/chrome.html` — added `handy-tools.lifespan-simulator.plan` to the storage-registry manifest block.
- `assets/js/storage-registry.js` — added `register('handy-tools.lifespan-simulator.plan', {...})`.
- `index.html` (home) — regenerated via `make shell-template` to mirror the new tools.json inline + new storage-registry manifest entry.

**No new files.**

## Change Log

- 2026-08-08 — Story 1.16 created.
- 2026-08-08 — Story 1.16 implemented. All 10 tasks complete, all 13 ACs verified via cross-cutting CI gates.
- 2026-08-12 — Retroactive retrofit (AI-E1-12 from the Epic 1 retrofit audit): added `baseline_commit:` to the YAML frontmatter and this `## Residue & Deferred` block.

## Residue & Deferred

Added retroactively on 2026-08-12 (AI-E1-12 from the Epic 1 retrofit audit).
The Plan Your Changes tab is an entertainment-only surface (per FR-2
+ Story 1.16's own preamble) but the WHO effect sizes are still
attached to real publications — the residue list flags the items
where a stale citation would be worse than no citation:

- **Per-input WHO deltas are inline literals in the `lifespan-simulator.js`
  tables.** The audit's AI-E1-11 retrofit added a `WHO_DELTAS` metadata
  const block at the top of the file documenting the scale and
  synergy terms, but the per-input values remain inline. Each value
  is labeled with its source (WHO fact sheet, GBD 2019, Moore
  et al. BMJ 2012, etc.) and re-asserted in the per-tooltip
  `sourceLabel`. *Reason deferred:* lifting 22+ tables' values into
  a single const block would obscure the per-row source-citation
  pattern that makes the tool honest. The metadata block is the
  light-touch middle ground.
- **The "synergy" deltas (−1.5 for smoking+alcohol, −1.0 for
  smoking+sedentary) are not WHO-cited.** The audit's F4 finding
  flagged these as mentioned in the WHO_DELTAS block but not
  empirically scored in the simulation. They are best-effort
  estimates for entertainment only. *Reason deferred:* adding a
  false authority to a synergy claim would mislead; the source
  language ("estimated", "compound" rather than "WHO cites") is
  used in the tooltip.
- **The Plan Your Changes tab is gated behind a tab UI tab that
  exists only after the user lands on the tool page.** There is no
  deep-link to a specific plan; if a user wants to share a plan
  with a friend, they have to take a screenshot. *Reason deferred:*
  deep-link is a share-dialog concern (Story 2.x).
