# Story 9.13 — Budget Planner

Status: **done**

## Context

Finance pack needs a quick budget planner: enter income, edit one row per
category, see total expenses + savings + savings rate + discretionary. URL
state encodes the budget so it can be shared. Persists via storage key
`ht.budget-planner.budget` (registered in storage-registry.js).

## Acceptance criteria

AC-1: User enters income (positive number). Tool defaults to 5 categories:
  housing, food, transport, entertainment, other — each with sensible
  default amounts (e.g., 1500, 600, 400, 200, 300).

AC-2: User can:
  - Edit any category amount inline.
  - Add a new category (button) with a UUIDv4 id.
  - Delete a category (small × button per row).

AC-3: Computed outputs:
  - `totalExpenses = sum(category amounts)`
  - `savings = income - totalExpenses`
  - `savingsRate = savings / income × 100` (2 dp; 0.00 when income = 0)
  - `discretionary = savings - (housing + transport)` (can be negative)

AC-4: URL state encodes the budget as base64 JSON `{ income, categories:
  [{id, name, amount}] }`. Reload restores state.

AC-5: Local persistence via `HT.storage` (key
  `handy-tools.budget-planner.budget`; the user-data prefix per AD-6 —
  the budget is a structured object, not a plain-string runtime key).
  Reload restores the user's last budget.

AC-6: Sample button loads an example budget ($5000 income, default cats).
  Reset clears to defaults. Print formats the budget table. Share copies
  the share URL.

AC-7: Reduced-motion CSS disables transitions; print stylesheet hides
  interactive controls.

AC-8: Smoke harness with ≥ 30 assertions across 12 categories,
  vacuous-pass guard. No fetch, no XHR, no console errors.

AC-9: Regression sweep across all 50+ tools stays green.

## Files

Create:
- `tools/budget-planner/index.html`
- `tools/budget-planner/budget-planner.css`
- `tools/budget-planner/budget-planner-core.js`
- `tools/budget-planner/budget-planner-handlers.js`
- `scripts/_smoke_budget_planner.js`
- `assets/icons/budget-planner.svg`
- `_bmad-output/implementation-artifacts/9-13-budget-planner.md`

Modify:
- `tools.json` — append budget-planner entry (pack: finance, score 8)
- `assets/js/storage-registry.js` — register `ht.budget-planner.budget`
- `assets/shell/chrome.html` — mirror storage manifest
- `assets/shell/palette.html` / `settings.html` / `help.html` (no change)
- `Makefile` — add `budget-planner-smoke` to .PHONY + help + ci
- `.github/workflows/tool-contract-gate.yml` — add smoke step
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — mark done

## Architecture notes

- core exports `HT.budgetPlannerCore` with: `compute(state)`, `addCategory`,
  `removeCategory`, `encodeState`, `decodeState`, `resolveState`.
- handlers wires DOM events (income input, category row amount input,
  add-category button, delete-category button, sample/reset/print/share
  buttons) and re-renders the result card + URL state on every change.
- Local persistence via `HT.storage.get/set('handy-tools.budget-planner.budget',
  state)` — the storage registry mirror is updated via
  `storage-registry-gate.py --inject`.
- No fetch, no XHR (matches AC-8 privacy).

## Verification

```
make storage-registry-inject   # inject storage key into chrome.html
make budget-planner-smoke
make validate
make gate
```

Manual:
- Income=$5000, all cats=$800 → savings = $1000, savingsRate = 20.00,
  discretionary = 1000 - (800+800) = -$600.
- Add a category "pet" with $100 → totalExpenses = $4100, savings = $900.
- Share URL → opens another tab with identical state.