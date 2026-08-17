# Story 9.14 — Savings Goal

Status: **done**

## Context

Finance pack needs a savings goal calculator: enter a target amount, a
deadline in months, a starting balance, and an annual interest rate.
Tool computes the monthly contribution required to hit the goal and
displays a progress bar (current balance / target). URL state encodes
all four inputs so it can be shared.

## Acceptance criteria

AC-1: User enters 4 inputs:
  - `target` — savings target amount (positive number, default 10000)
  - `months` — deadline in months (positive integer ≥ 1, default 24)
  - `starting` — current balance (default 1000)
  - `rate` — annual interest rate in % (default 2.5)

AC-2: Tool computes monthly contribution via annuity-due formula:
  - rate > 0: `monthly = (target − starting·(1+r)^n) / (((1+r)^n − 1) / r)`
    where `r = rate/100/12`, `n = months`
  - rate = 0: `monthly = (target − starting) / months`
  - Inline validation: "Deadline must be at least 1 month",
    "Target must exceed starting balance (otherwise monthly = 0)",
    "Rate must be ≥ 0".

AC-3: Progress bar:
  - `<progress value="starting" max="target">` (HTML5 progress element)
  - Shows percentage complete (e.g., "10.0% of $10,000")
  - Updates on every input change.

AC-4: URL state encodes as `?target=10000&months=24&starting=1000&rate=2.5`.
  Reload restores state.

AC-5: Local persistence via `HT.storage` (key
  `handy-tools.savings-goal.inputs`). Reload restores the user's
  last inputs.

AC-6: Sample button loads example (target $12000, 24 months, $2000
  starting, 2.5% rate). Reset clears to defaults. Print formats the
  summary card. Share copies the share URL.

AC-7: Reduced-motion CSS disables transitions; print stylesheet hides
  interactive controls.

AC-8: Smoke harness with ≥ 30 assertions across 12 categories,
  vacuous-pass guard. No fetch, no XHR, no console errors.

AC-9: Regression sweep across all 50+ tools stays green.

## Files

Create:
- `tools/savings-goal/index.html`
- `tools/savings-goal/savings-goal.css`
- `tools/savings-goal/savings-goal-core.js`
- `tools/savings-goal/savings-goal-handlers.js`
- `scripts/_smoke_savings_goal.js`
- `assets/icons/savings-goal.svg`
- `_bmad-output/implementation-artifacts/9-14-savings-goal.md`

Modify:
- `tools.json` — append savings-goal entry (pack: finance, score 8)
- `assets/js/storage-registry.js` — register `handy-tools.savings-goal.inputs`
- `assets/shell/chrome.html` — mirror storage manifest
- `Makefile` — add `savings-goal-smoke` to .PHONY + help + ci
- `.github/workflows/tool-contract-gate.yml` — add smoke step
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — mark done

## Architecture notes

- core exports `HT.savingsGoalCore` with: `compute(inputs)`,
  `encodeState(inputs)`, `decodeState(search)`, `resolveState(decoded)`,
  `validateInputs(inputs)`.
- handlers wires DOM events (target/months/starting/rate inputs,
  sample/reset/print/share buttons) and re-renders the result card +
  URL state on every change.
- Annuity-due formula breakdown:
  - Future value of starting balance: `FV = starting·(1+r)^n`
  - Future value of monthly contributions: `FV = monthly·((1+r)^n − 1)/r`
  - Solve: `monthly = (target − starting·(1+r)^n) / ((1+r)^n − 1)/r`
- Local persistence via `HT.storage.get/set('handy-tools.savings-goal.inputs',
  inputs)` — same handy-tools.* prefix as budget-planner (AD-6).
- No fetch, no XHR (matches AC-8 privacy).

## Verification

```
make storage-registry-inject   # inject storage key into chrome.html
make savings-goal-smoke
make validate
make gate
```

Manual:
- target=$10000, months=24, starting=$1000, rate=2.5 → monthly ≈ $360.
- target=$12000, months=24, starting=$2000, rate=2.5 → monthly ≈ $414.
- target=$0, months=12 → "Target must exceed 0".
- rate=0, target=$12000, starting=$0, months=12 → monthly = $1000.
- Share URL → opens another tab with identical state.