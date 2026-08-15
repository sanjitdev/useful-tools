/* ============================================
   Inflation Calculator — inflation-calculator-core.js (Story 4b Phase 2)
   Parse-time chunk: CPI table references (LATEST_YEAR / LATEST_INDEX /
   FIRST_YEAR), helpers (cpiFor, indexFor, clampYear/Amount/Rate, pct,
   money), eager so the lazy chunk can use them without re-importing.

   Lazy chunk (inflation-calculator-handlers.js) loads via
   HT.lazyLoadTool('inflation-calculator', './inflation-calculator-handlers.js')
   on DOMContentLoaded. Vendor file cpi-data.js stays eager (it's data
   the core depends on for FIRST_YEAR/LATEST_YEAR).

   Story 4b — see _bmad-output/implementation-artifacts/
   story-4b-per-tool-code-splitting.md
   ============================================ */

(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.HT) return;

  var CPI = window.CPI_US_ANNUAL || [];
  var FORWARD_DEFAULT = window.CPI_FORWARD_DEFAULT || 3.0;
  var LATEST_YEAR = CPI.length ? CPI[CPI.length - 1].year : new Date().getFullYear();
  var LATEST_INDEX = CPI.length ? CPI[CPI.length - 1].index : 100;
  var FIRST_YEAR = CPI.length ? CPI[0].year : 1913;

  function cpiFor(year) {
    if (year < FIRST_YEAR) return null;
    if (year > LATEST_YEAR) return null;
    var entry = CPI[year - FIRST_YEAR];
    return entry ? entry.index : null;
  }

  function indexFor(year, forwardRate) {
    if (year <= LATEST_YEAR) return cpiFor(year);
    if (!forwardRate) forwardRate = FORWARD_DEFAULT;
    var rate = Math.pow(1 + forwardRate / 100, year - LATEST_YEAR);
    return LATEST_INDEX * rate;
  }

  function clampYear(year) {
    year = parseInt(year, 10);
    if (!isFinite(year)) return LATEST_YEAR;
    if (year < FIRST_YEAR) return FIRST_YEAR;
    if (year > LATEST_YEAR + 100) return LATEST_YEAR + 100;
    return year;
  }

  function clampAmount(n) {
    n = parseFloat(n);
    if (!isFinite(n)) return 100;
    return n;
  }

  function clampRate(n) {
    n = parseFloat(n);
    if (!isFinite(n)) return FORWARD_DEFAULT;
    if (n < 0) return 0;
    if (n > 10) return 10;
    return n;
  }

  function pct(n, digits) {
    if (digits === undefined) digits = 2;
    if (!isFinite(n)) return '—';
    var sign = n > 0 ? '+' : '';
    return sign + n.toFixed(digits) + '%';
  }

  function money(n) {
    if (!isFinite(n)) return '—';
    return '$' + HT.formatNumber(n, { minFractionDigits: 2, maxFractionDigits: 2 });
  }

  // AD-14 internal handle. Frozen so lazy chunk can't accidentally
  // mutate parse-time state.
  window.HT.inflationCalculatorCore = Object.freeze({
    CPI: CPI,
    FORWARD_DEFAULT: FORWARD_DEFAULT,
    LATEST_YEAR: LATEST_YEAR,
    LATEST_INDEX: LATEST_INDEX,
    FIRST_YEAR: FIRST_YEAR,
    cpiFor: cpiFor,
    indexFor: indexFor,
    clampYear: clampYear,
    clampAmount: clampAmount,
    clampRate: clampRate,
    pct: pct,
    money: money,
  });

  // Boot: lazy-load the handlers chunk on DOMContentLoaded. The
  // handlers chunk calls window.inflationCalculatorInit() once loaded
  // (it owns DOM refs and event wiring).
  function boot() {
    if (typeof window.HT.lazyLoadTool !== 'function') return;
    window.HT.lazyLoadTool(
      'inflation-calculator',
      './inflation-calculator-handlers.js'
    ).then(function () {
      if (typeof window.inflationCalculatorInit === 'function') {
        window.inflationCalculatorInit();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
