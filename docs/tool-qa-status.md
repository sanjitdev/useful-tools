# Tool QA — Priority List & Status

**Walk order:** Tier 1 (complex multi-file / large JS / persisted state) → Tier 2 (stateful single-file / validators) → Tier 3 (codecs/counters/calculators). Group by similarity so a shared pattern, once proven good, batch-validates every sibling.

**Source of truth:** this doc. Update per tool as code review and UI verification land.

**Total tools:** 50 (per `tools.json`, all `ready: true`).
**Hero count:** `index.html` says `50` (matches runtime `liveEntries.length`).
**Tool count last updated:** 2026-08-19.

---

## Status legend

| Code | Meaning |
|---|---|
| **—** | Not yet reviewed |
| **CR✓** | Code/logic review passed |
| **UI✓** | User verified the UI |
| **CR✓ UI✓** | Complete |
| **FIX** | Issues found, fix in progress |
| **WONTFIX** | Tracked, intentionally not fixing in this pass |
| **N/A** | Not applicable (e.g. archival) |

---

## Tier 1 — Multi-file / large state / business logic (15)

**Why first:** split core/handlers boundary, persisted state, biggest JS files, more wiring, more chances for drift. Same V&V pattern across all 15.

| # | Slug | Group | JS | Cr | UI | Notes |
|---|---|---|---|---|---|---|
| 1 | `bd-tax-calculator` | Form-driven calculator (locale + ruleset) | 58.9 KB | — | — | 2 langs, 3 rulesets, persists state |
| 2 | `lifespan-simulator` | Multi-tab planner + WHO data | 79.3 KB | — | — | Plan tab, trait sliders, persists state |
| 3 | `animal-race` | Interactive sim + scoring | 25.3 KB | — | — | History of races |
| 4 | `inflation-calculator` | Calculated series + chart data | 37.3 KB | — | — | Bundled cpi-data.js |
| 5 | `paint-calculator` | Multi-step form | 15.7 KB | — | — | Walls/doors/windows |
| 6 | `area-volume` | Multi-shape form | 12.5 KB | — | — | 6 shapes + unit conversion |
| 7 | `budget-planner` | Form + summary | 13.7 KB | — | — | Income + categories |
| 8 | `savings-goal` | Form + projection | 10.2 KB | — | — | Target / months / rate |
| 9 | `currency-converter` | Lookup + offline rates | 11.0 KB | — | — | Offline-first (Story 9.15) |
| 10 | `grocery-list` | List CRUD | 16.7 KB | — | — | Adds/removes items |
| 11 | `recipe-scaler` | Form + scaling | 19.0 KB | — | — | Multiplier to ingredients |
| 12 | `json-formatter` | Validate + format | 16.7 KB | — | — | Minify/2sp/4sp/tab |
| 13 | `jwt-inspector` | Decode + verify | 17.6 KB | — | — | Header/payload/sig |
| 14 | `uuid-generator` | Generate | 15.5 KB | — | — | v1/v3/v4/v5/v7 |
| 15 | `timestamp-converter` | Convert + display | 18.7 KB | — | — | Multi-format i/o |

**Sibling validation:** once `bd-tax-calculator` (12k+, persists, complex) is verified, the others in this tier should hold by the same chrome + storage + urlState contract.

---

## Tier 2 — Stateful single-file (calculators with rules, timers, validators) (17)

**Why next:** single JS file but with meaningful state, scoring, or input validation. Smaller blast radius than T1 but still has logic that can drift.

| # | Slug | Group | JS | Cr | UI | Notes |
|---|---|---|---|---|---|---|
| 16 | `habit-tracker` | Calendar + streak | 5.4 KB | — | — | Persists state |
| 17 | `eisenhower-matrix` | Quadrant drag | 5.7 KB | — | — | Persists state |
| 18 | `decision-wheel` | Animated picker | 7.9 KB | — | — | Random spin |
| 19 | `flashcard-timer` | Timer + SRS | 10.5 KB | — | — | Spaced repetition |
| 20 | `pomodoro-timer` | Timer | 5.8 KB | — | — | Work / break cycles |
| 21 | `stopwatch` | Timer | 6.3 KB | — | — | Laps |
| 22 | `exam-countdown` | Date countdown | 8.3 KB | — | — | Persists state |
| 23 | `countdown-to-date` | Date countdown | 8.2 KB | — | — | Persists state |
| 24 | `world-clock` | Multi-tz | 9.9 KB | — | — | Multiple timezones |
| 25 | `regex-tester` | Validate + match | 5.0 KB | — | — | Highlights |
| 26 | `diff-viewer` | Two-pane diff | 14.5 KB | — | — | LCS algorithm |
| 27 | `markdown-previewer` | Render | 6.9 KB | — | — | Renderer |
| 28 | `color-tools` | Convert + palette | 6.0 KB | — | — | HEX/RGB/HSL |
| 29 | `qr-code-generator` | Generate | 4.4 KB | — | — | Encodes payload |
| 30 | `quiz-preview` | Quiz pattern | 9.5 KB | — | — | Shell demo |
| 31 | `random-tools` | Random source | 8.9 KB | — | — | Multi-format picker |
| 32 | `citation-formatter` | Format | 10.6 KB | — | — | APA/MLA/Chicago |

---

## Tier 3 — Pure calculators / codecs / counters (18)

**Why last:** pure input → output, no persisted state, no timer, no scoring. Smallest JS, lowest defect surface. Once any T3 tool passes, the rest are highly likely to pass by sibling validation.

### Group A — Arithmetic (10)
| # | Slug | JS | Cr | UI | Notes |
|---|---|---|---|---|---|
| 33 | `age-calculator` | 10.2 KB | — | — | Years/months/days |
| 34 | `bmi-calculator` | 3.8 KB | — | — | BMI + category |
| 35 | `loan-calculator` | 8.3 KB | — | — | Amortized monthly |
| 36 | `compound-interest` | 6.6 KB | — | — | FV / schedule |
| 37 | `percentage-calculator` | 3.0 KB | — | — | % of / change / delta |
| 38 | `grade-calculator` | 8.3 KB | — | — | Weighted average |
| 39 | `gpa-calculator` | 8.0 KB | — | — | Course GPA |
| 40 | `tip-calculator` | 1.7 KB | — | — | Bill + tip + split |
| 41 | `calorie-estimator` | 6.3 KB | — | — | BMR/TDEE |
| 42 | `space-calculator` | 13.9 KB | — | — | Area-perimeter-volume |

### Group B — Codecs / formatters / counters (8)
| # | Slug | JS | Cr | UI | Notes |
|---|---|---|---|---|---|
| 43 | `base64-codec` | 2.1 KB | — | — | Encode / decode |
| 44 | `url-codec` | 1.5 KB | — | — | Encode / decode |
| 45 | `uuid-generator` | 15.5 KB | — | — | (multi-file, classified here as codec) |
| 46 | `word-counter` | 3.3 KB | — | — | Words/chars/lines |
| 47 | `date-difference` | 6.6 KB | — | — | Days between |
| 48 | `unit-converter` | 5.5 KB | — | — | Multi-category |
| 49 | `lorem-ipsum` | 5.7 KB | — | — | Generated text |
| 50 | `password-strength` | 5.7 KB | — | — | Entropy estimate |

---

## Groupings for batch review

**Reviewers can leverage sibling-pattern batch validation:**

| Pattern | Tools using it |
|---|---|
| Multi-file (core+handlers split) | T1 (all 15) |
| `storage-registry` persistence | T1 + T2 (habit, eisenhower, exam-countdown, countdown-to-date, budget-planner, savings-goal, grocery-list, recipe-scaler, paint-calculator) |
| `urlState` encode/decode | All 50 |
| Embed snippet | 49 / 50 (jwt-inspector is N) |
| View-source | All 50 |
| History-keys | All 50 |
| `last-updated` printed | All 50 |

---

## What "code review" checks per tool

1. JS syntax loads (no parse errors in the IIFE).
2. The tool's `data-slug` matches `tools.json` `slug`.
3. The tool's chrome (header / footer / palette / settings / help) matches `chrome.html` per drift-check.
4. `urlState` decode + encode is a true round-trip for at least one sample input.
5. `history-keys` referenced in JS exist in `storage-registry.js` (no typos).
6. Persistence is namespaced under `handy-tools.<slug>.*` (no leak into `ht.*` or other tool's namespace).
7. Storage IIFE pattern matches other tools — no global state, no `var` at top level.
8. Sample data path (if any) matches `sample-data.js` route.
9. A11y — tab-order-canonical exists in `tools.json`.
10. No console-warn spam on normal use.

## What "UI verification" means (user)

1. Open the tool page in a browser.
2. Use the primary affordance (the main button).
3. Reasonable input → reasonable output.
4. Edge cases (empty, very large, very small, special chars).
5. Persistence: refresh the page → state survives.
6. Copy / share / print / view-source affordances work.

---

## Progress

- **Code reviews completed:** 0 / 50
- **UI verifications completed:** 0 / 50
- **Fully QA-passed:** 0 / 50
- **Issues found, fix in progress:** 0
- **Last updated:** 2026-08-19
