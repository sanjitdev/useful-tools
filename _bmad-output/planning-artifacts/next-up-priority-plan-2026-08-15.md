# Priority Plan — Next Up After Story 9.13 (2026-08-15)

> **Status:** planning, 2026-08-15. Story 9.13 (lifespan quiz-mode) shipped
> this morning. Patch 9.13.1 (lazy-load path bug) shipped the same day.
> This doc ranks the next 3 candidates by ROI, ordered by my
> recommendation.

---

## TL;DR — recommended order

1. **Story 9.19 — Custom date picker** (the user's question). M, 2 days.
2. **Story 9.14 — Calorie quiz-mode adoption** (next quiz adopter). S, 1 day.
3. **Story 9.20 — `<select>` styling revival** (tiny, high-impact). S, 1 day.

Full justification, scope sketches, and trade-offs below.

---

## Why a custom date picker is the right next thing

### Tailwind of the problem

The codebase has **10 native `<input type="date">` across 7 tools**:
`age-calculator` (2), `date-difference` (2), `lifespan-simulator` (2),
`countdown-to-date` (1), `world-clock` (1), `loan-calculator` (1),
`space-calculator` (1). Each one renders a native browser picker that
**ignores the cobalt theme** — Chrome shows a popup that doesn't match
the rest of the chrome, Safari shows a wheel, Firefox shows plain text.
This is the single biggest "looks fine in dev, but feels off in
production" claim from the brand audit (`docs/quality-audit.md`).

### Wins the picker unlocks

1. **Brand consistency** — picker uses `--color-primary`, `--space-3`,
   `--radius-md`, the same `--motion-*` tokens as the palette and
   help overlay. Light/dark/auto theme works through the picker.
2. **i18n / locale policy** — picks one locale (the user's chosen
   tool language via `HT.i18n` if present, else `navigator.language`),
   not whatever the OS reports. Future locale switchers can re-render.
3. **Keyboard UX** — standardizes arrow keys, PageUp/Down, Home/End
   across browsers. Native pickers vary.
4. **A11y** — `role="dialog"` + `aria-modal` + focus trap + Esc to
   close + return focus to the input. AD-14 cares about this.
5. **Edge cases** — min/max disabled days, "today" highlight, range
   constraints (`<input type="date" min="...">` already works; we
   propagate it to the calendar grid).
6. **Prefix to other tools** — countdown-to-date, age-calculator, and
   date-difference later want time pickers and range pickers. Building
   the core `[date]` widget first means time/range is a 2-day follow-on,
   not a new 5–7 day project.

### Bundle cost

- **JS**: ~5–7 KB gz (palette-actions is 7.9 KB for comparison)
- **CSS**: ~1.5 KB gz (chrome-palette.css is 2.2 KB for comparison)
- **Path**: `SPEC_PAGE_CONDITIONAL_MODULES` (lazy-loaded on first focus;
  zero chrome budget impact, zero per-tool first-paint impact)
- **Proxy pattern**: `HT.datePicker = makeProxy(...)` mirroring the
  quiz + palette shape

### Pilot tool

**`tools/lifespan-simulator/index.html`** is the right pilot, even though
it just shipped quiz-mode:

- It has 2 date inputs (`ls-dob` Quick + `ls-dob-f` Full) — the largest
  single-tool count
- The DOB use case (long-range, 1900–today) exposes the most edge cases
  (year navigation, decades jump, max-today enforcement)
- The pilot's `state.answers = qa.dob` from Story 9.13 already pipes
  dates through `evaluate()` — so swapping the picker is a pure
  rendering change, no logic touched
- If the pilot wins, the 6 other tools take ~30 min each to flip

### Migration shape (default off, opt-in via class)

A new chrome `HT.datePicker` that auto-enhances any
`<input type="input" type="date" class="input">` **only** when the
input has the class `js-date-picker` (or `data-date-picker` attribute).

Why opt-in rather than auto-hijack:
- Respects user preference — users who *want* the native popup keep it
- Matches the rest of the chrome (quiz, palette, history, all opt-in)
- Lets the picker ship behind a flag; flip tools over one at a time
- Easy to A/B test by removing the class

The pilot tool (lifespan-simulator) opts in by adding `js-date-picker`
to the 2 DOB inputs. The other 6 tools opt in later (one PR each).

### Effort estimate (M, 2 days)

| Phase | What | Effort |
|-------|------|--------|
| 1. Wire `HT.datePicker` Proxy stub in `shell-thin.js` | 15 LOC | 30 min |
| 2. `assets/js/date-picker.js` — calendar grid + keyboard nav + a11y + range/esc/click-outside | ~350 LOC | 1 day |
| 3. `assets/css/date-picker.css` — chrome tokens, light/dark, reduced-motion, print-hide | ~200 LOC | 0.5 day |
| 4. Pilot wire into lifespan-simulator (add `js-date-picker` to 2 inputs) | 5 LOC | 30 min |
| 5. Smoke `scripts/_smoke_date_picker.js` — sections I–N mirroring quiz-proxy shape | 200 LOC | 1.5 hr |
| 6. Retro + bundle-size-baseline bump | — | 1 hr |

**Total: ~5–7 KB gz JS + ~1.5 KB gz CSS, ~700 LOC, 2 days.**

### Acceptance criteria

| # | AC | Measured via |
|---|---|---|
| AC-1 | No chrome budget impact (page-conditional module). | `bundle-size-gate` delta = 0 |
| AC-2 | Picker posts `YYYY-MM-DD` to the input's `value` (same wire format as native). | Smoke section III |
| AC-3 | Native fallback preserved when JS fails. | Smoke + manual: disable JS, native input still works |
| AC-4 | Light/dark/auto theme works through the picker. | Manual browser verify all 3 themes |
| AC-5 | Keyboard: arrows, PageUp/Down, Home/End, Enter, Esc all work. | Smoke section V |
| AC-6 | `min`/`max` attributes on the input propagate to the calendar grid. | Smoke section VI |
| AC-7 | Esc/click-outside closes + returns focus to input. | Smoke section VII |
| AC-8 | `prefers-reduced-motion` skips the open/close animation. | Manual + smoke |
| AC-9 | Print hides the picker (CSS `@media print`). | Manual |
| AC-10 | No bare `Intl.DateTimeFormat` reads from `navigator.language` directly outside the picker's i18n module. | Smoke section VIII (AD-14 boundary) |

### Out of scope (deferred)

- **Time picker** — separate Story 9.19.1, builds on the date core.
- **Date range picker** (two inputs coupled) — Story 9.19.2.
- **Inline calendar** (always-visible, no popover) — Story 9.19.3.
- **Hijacking remaining native `<select>` controls** — separate
  Story 9.20 (see below).
- **`<input type="time">` / `<input type="datetime-local">`** — same
  Story 9.19.1 / 9.19.2 follow-ons.

---

## Why this comes before Story 9.14 (calorie quiz adoption)

The quiz adopter backlog (9.14–9.18) is solid M-2 day each, but the
**value per day** is much lower than the date picker:

| Story | Effort | Reach | Per-day value |
|---|---|---|---|
| 9.14 Calorie quiz | 1 day | 1 tool (calorie-estimator) | 1 tool taste upgrade |
| 9.15 BMI quiz | 0.5 day | 1 tool (bmi-calculator) | 1 tool taste upgrade |
| 9.16 Pros-cons quiz | 1 day | 1 tool (pros-cons) | 1 tool taste upgrade |
| 9.17 Space quiz | 1 day | 1 tool (space-calculator) | 1 tool taste upgrade |
| 9.18 BD-tax quiz | 2 days | 1 tool (bd-tax-calculator) | 1 tool taste upgrade |
| **9.19 Date picker** | **2 days** | **7 tools immediately, 44 with future time/range/inline** | **22 tools/day, scales** |

The date picker is roughly **10× the per-day value** of any single
quiz adopter. Plus, once the date picker ships, the quiz adopters
that have date inputs (calorie has none, BMI has none, space has
none, pros-cons has none — **bd-tax has none** either) don't
benefit, so the two stories don't compound.

### The one case to do quiz adopters before the picker

If the user's preference shifts toward *"let's get to 6 quiz adopters
fast for bragging rights"* — doing 9.14 + 9.15 (calorie + BMI) in a
single 1.5-day sprint gives the home page a "5 of 6 quiz tools"
badge for the next demo. But each adopter is mechanically identical
to 9.13 (mount + reveal + questions array), so the marginal value
falls fast. I'd still do the picker first.

---

## Story 9.20 — `<select>` styling revival (3rd suggestion)

A smaller, complementary win. The 44 tools have ~80 native `<select>`
elements that inconsistently render across browsers (Chromium picks
the OS theme, Firefox ignores `--color-primary`, Safari is its own
thing). The same pattern as 9.19 applies:

- Surface: ~80 elements across all 44 tools
- Bundle: ~3 KB gz JS + ~1 KB gz CSS (smaller than date picker because
  no calendar grid)
- Effort: 1 day
- Order: **after 9.19**, because the picker exposes the same
  popover/focus-trap/a11y plumbing that the select needs. Doing 9.19
  first means 9.20 reuses the popover primitive.

If the user wants the most bang-for-buck in the **shortest** time, 9.20
is attractive. But 9.19 is the right *first* pick because it
unblocks the inline / time / range follow-ons.

---

## Quick ranking (recommended)

| Rank | Story | Effort | Why |
|---|---|---|---|
| 1 | **9.19 Date picker** | M, 2 days | Highest ROI, unblocks 9.19.1–9.19.3, fixes 7 tools immediately |
| 2 | **9.14 Calorie quiz** | S, 1 day | Next quiz adopter, pattern is proven (Story 9.13) |
| 3 | **9.20 Select styling** | S, 1 day | Reuses the popover primitive from 9.19, fixes all 44 tools |
| 4 | 9.15 BMI quiz | S, 0.5 day | Fast quiz adopter |
| 5 | 9.16 Pros-cons quiz | S, 1 day | Mid-complexity quiz adopter |
| 6 | 9.17 Space quiz | S, 1 day | Largest quiz adopter (multi-planet) |
| 7 | 9.18 BD-tax quiz | M, 2 days | Largest single tool, last because it's the most POLISH needed |

I'd ship 9.19 → 9.14 → 9.20 → 9.15 → 9.16 → 9.17 → 9.18 — call it
roughly 8 days of work to retire the entire cross-cutting polish
backlog (chrome + 6 quiz adopters).

---

## Cross-references

- `docs/quality-audit.md` — brand-consistency claims (cross-checks
  against the native picker inconsistency)
- `docs/bundle-size-budget.md` — page-conditional module budget
  (10.1 KB gz used of 12.0 KB gz budget → 1.9 KB gz slack — the
  date picker + its CSS fit; if we ship 9.19 + 9.19.1, we revisit)
- `_bmad-output/brainstorming/brainstorm-quiz-pattern-2026-08-14/quiz-pattern-future-tasks.md`
  — Stories 9.14–9.18 source spec
- `assets/js/shell-thin.js` — Proxy-factory pattern (Story 9.13.1
  patch just landed) — the new date picker plugs in identically
- `assets/css/chrome-palette.css` — closest CSS cousin to the
  picker's popover styles
- `scripts/_smoke_quiz_proxy.js` — the smoke pattern to mirror
  (Sections VI + VII are the regression-guard template)
- `tools/lifespan-simulator/lifespan-simulator-handlers.js` — pilot
  tool, has `state.answers = qa.dob` already wired (Story 9.13)
- `scripts/_smoke_lifespan_simulator_split.js` — extends naturally
  with section XI for the date picker opt-in