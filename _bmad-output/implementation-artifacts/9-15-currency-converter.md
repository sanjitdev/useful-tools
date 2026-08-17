# Story 9.15 — Currency Converter

Status: **done**

## Context

Travel pack needs a currency converter: enter an amount + pick from / to
currencies, see the converted result. Vendor baseline rates are bundled
offline-first; user can hit "Refresh live rates" to fetch from
exchangerate.host (CORS-enabled public API). 60-min debounce. URL state
encodes amount + from + to.

## Acceptance criteria

AC-1: User enters amount (positive number), picks from-currency, picks
  to-currency. Default selection: USD → EUR.

AC-2: Tool converts via cross-rates through USD:
  - `amount_in_USD = amount / rates[from]` (USD = 1.0 base)
  - `result = amount_in_USD * rates[to]`

AC-3: Boot with bundled baseline rates from `assets/data/fx-rates.json`
  (USD = 1.0; ~30 common ISO 4217 currencies × 1 USD). Display
  "Rates last updated 2026-08-17 (bundled baseline)" on first paint.

AC-4: "Refresh live rates" button fetches
  `https://api.exchangerate.host/latest?base=USD`. On success → cache
  + display updated rates. On failure → keep baseline + show stale
  notice. 60-min debounce per `fetchedAt` timestamp on the cache key.

AC-5: URL state encodes `?amount=100&from=USD&to=EUR`. Reload restores
  state. Last selected currencies persist via
  `handy-tools.currency-converter.last-codes`.

AC-6: Reduced-motion CSS disables transitions; print stylesheet hides
  the refresh / share buttons.

AC-7: Smoke harness with ≥ 30 assertions across 12 categories,
  vacuous-pass guard. No fetch / XHR on baseline boot (privacy);
  fetch only fires on explicit refresh click.

AC-8: Regression sweep across all 50+ tools stays green.

AC-9: Shell-bounds allowlist: `api.exchangerate.host` is in the
  allowlist via `// shell-bounds-check: allow api.exchangerate.host`
  escape-hatch comment in handlers.

## Files

Create:
- `tools/currency-converter/index.html`
- `tools/currency-converter/currency-converter.css`
- `tools/currency-converter/currency-converter-core.js` — pure math
- `tools/currency-converter/currency-converter-handlers.js` — DOM + fetch
- `scripts/_smoke_currency_converter.js`
- `assets/data/fx-rates.json` — bundled vendor baseline (~30 currencies)
- `assets/icons/currency-converter.svg`
- `_bmad-output/implementation-artifacts/9-15-currency-converter.md`

Modify:
- `tools.json` — append currency-converter entry (pack: travel, score 8)
- `assets/js/storage-registry.js` — register
  `handy-tools.currency-converter.last-codes` + `handy-tools.fx.<from>-<to>` cache keys
- `assets/shell/chrome.html` — mirror storage manifest
- `scripts/shell-bounds-check.py` — allow `api.exchangerate.host`
- `Makefile` — add `currency-converter-smoke` to .PHONY + help + ci
- `.github/workflows/tool-contract-gate.yml` — add smoke step
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — mark done

## Architecture notes

- core exports `HT.currencyConverterCore` with: `convert(amount, from,
  to, rates)`, `loadBaseline()` (fetches /assets/data/fx-rates.json
  via require-style for the smoke harness + JSON object for browser),
  `BASELINE` constant.
- handlers wires DOM events (amount input, from/to selects,
  refresh-live button) and calls `fetch()` only on refresh-click.
- Storage:
  - `handy-tools.currency-converter.last-codes` — last selected
    from/to (object {from, to}).
  - `handy-tools.fx.<from>-<to>` — per-pair cache with `fetchedAt`
    timestamp; on boot, if any pair is older than 60 min, refuse to
    serve from cache.
- Shell-bounds allowlist: per AC-9, fetch to api.exchangerate.host is
  explicitly allowed via `// shell-bounds-check: allow
  api.exchangerate.host` comment (mirrors Story 1.17 escape hatch).
- No fetch / XHR on baseline boot (matches AC-7 privacy).

## Verification

```
make storage-registry-inject   # inject storage keys into chrome.html
make currency-converter-smoke
make validate
make gate
make shell-bounds
```

Manual:
- Open `tools/currency-converter/index.html`, from=USD, to=EUR,
  amount=100 → expect $100 USD ≈ €85 EUR (depends on bundled baseline).
- Click "Refresh live rates" → expect updated rate + cache hit on
  second load within 60 min.