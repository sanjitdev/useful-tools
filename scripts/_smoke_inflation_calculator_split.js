#!/usr/bin/env node
/* Story 4b Phase 2 — inflation-calculator core+handlers split smoke.

   Verifies the new inflation-calculator-core.js + inflation-calculator-handlers.js
   pair:
     - inflation-calculator-core.js loads via vm sandbox without throwing
     - HT.inflationCalculatorCore frozen handle exposes CPI/FORWARD_DEFAULT/
       LATEST_YEAR/LATEST_INDEX/FIRST_YEAR/cpiFor/indexFor/clampYear/
       clampAmount/clampRate/pct/money
     - cpiFor returns the expected index for FIRST_YEAR and LATEST_YEAR
     - indexFor with forward rate projects beyond LATEST_YEAR
     - inflation-calculator-handlers.js loads after core and binds
       window.inflationCalculatorInit
     - lazy-loadable via HT.lazyLoadTool API shape

   Pure-Node smoke (no jsdom / playwright). Runs in a vm sandbox with
   minimal HT + dom stubs.

   Exit codes:
     0 — all assertions PASS
     1 — at least one assertion failed
*/

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const CORE_SRC = fs.readFileSync(path.join(REPO_ROOT, 'tools/inflation-calculator/inflation-calculator-core.js'), 'utf8');
const HANDLERS_SRC = fs.readFileSync(path.join(REPO_ROOT, 'tools/inflation-calculator/inflation-calculator-handlers.js'), 'utf8');

// Provide a stub global so core can pick up the CPI table on load.
// The cpiFor() function uses dense array indexing (CPI[year - FIRST_YEAR]),
// so the stub has to fill every year from 1913 to 2024. Use 1.0 for
// placeholder years and the documented index for known test points.
const CPI_STUB = (function () {
  const arr = [];
  for (let y = 1913; y <= 2024; y++) arr.push({ year: y, index: 100.0 + (y - 1913) * 1.0 });
  arr[0].index = 9.9;     // 1913
  arr[67].index = 82.4;   // 1980
  arr[87].index = 172.2;  // 2000
  arr[arr.length - 1].index = 314.0; // 2024
  return arr;
})();

let pass = 0;
let fail = 0;
function check(cond, label) {
  if (cond) { pass += 1; console.log('  PASS  ' + label); }
  else      { fail += 1; console.log('  FAIL  ' + label); }
}

// =============================================================
// Minimal HT + dom stubs
// =============================================================

function buildCtx() {
  const HT = {
    storage: {
      _store: {},
      get: function (k, dflt) { return Object.prototype.hasOwnProperty.call(this._store, k) ? this._store[k] : dflt; },
      set: function (k, v) { this._store[k] = v; },
      remove: function (k) { delete this._store[k]; },
    },
    $: function (sel) { return null; },
    qsa: function () { return []; },
    debounce: function (fn) { return fn; },
    formatNumber: function (n) { return String(n); },
    formatDate: function (d) { return d.toISOString(); },
    copyToClipboard: function () { return Promise.resolve(); },
    toast: function () {},
    share: { print: function () {} },
    lazyLoadTool: function () { return Promise.resolve(); },
  };
  const ctx = {
    HT: HT,
    window: { HT: HT, inflationCalculatorInit: null, CPI_US_ANNUAL: CPI_STUB, CPI_FORWARD_DEFAULT: 3.0 },
    console: { warn: function () {}, log: function () {}, error: function () {} },
    document: {
      addEventListener: function () {},
      documentElement: { setAttribute: function () {} },
      readyState: 'complete',
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    btoa: function (s) { return Buffer.from(s, 'binary').toString('base64'); },
    atob: function (s) { return Buffer.from(s, 'base64').toString('binary'); },
    location: { hash: '' },
    history: { replaceState: function () {} },
    JSON: JSON,
  };
  ctx.window.HT = HT;
  ctx.CPI_US_ANNUAL = CPI_STUB;
  ctx.CPI_FORWARD_DEFAULT = 3.0;
  return ctx;
}

function loadInto(ctx, src, label) {
  try {
    vm.runInContext(src, vm.createContext(ctx), { filename: label });
    return true;
  } catch (err) {
    console.log('  FAIL  load ' + label + ' threw: ' + err.message);
    fail += 1;
    return false;
  }
}

// =============================================================
// I. inflation-calculator-core.js loads + exposes HT.inflationCalculatorCore
// =============================================================
console.log('--- I. inflation-calculator-core.js ---');
{
  const ctx = buildCtx();
  check(loadInto(ctx, CORE_SRC, 'inflation-calculator-core.js'), 'inflation-calculator-core.js loads without throwing');
  check(!!ctx.HT.inflationCalculatorCore, 'HT.inflationCalculatorCore exposed');
  check(Object.isFrozen(ctx.HT.inflationCalculatorCore), 'HT.inflationCalculatorCore is frozen (AD-14 internal handle)');
  check(typeof ctx.HT.inflationCalculatorCore.cpiFor === 'function', 'cpiFor is a function');
  check(typeof ctx.HT.inflationCalculatorCore.indexFor === 'function', 'indexFor is a function');
  check(typeof ctx.HT.inflationCalculatorCore.clampYear === 'function', 'clampYear is a function');
  check(typeof ctx.HT.inflationCalculatorCore.clampAmount === 'function', 'clampAmount is a function');
  check(typeof ctx.HT.inflationCalculatorCore.clampRate === 'function', 'clampRate is a function');
  check(typeof ctx.HT.inflationCalculatorCore.pct === 'function', 'pct is a function');
  check(typeof ctx.HT.inflationCalculatorCore.money === 'function', 'money is a function');

  const core = ctx.HT.inflationCalculatorCore;
  check(core.FIRST_YEAR === 1913, 'FIRST_YEAR = 1913');
  check(core.LATEST_YEAR === 2024, 'LATEST_YEAR = 2024');
  check(core.LATEST_INDEX === 314.0, 'LATEST_INDEX = 314.0');
  check(core.FORWARD_DEFAULT === 3.0, 'FORWARD_DEFAULT = 3.0');

  check(core.cpiFor(1913) === 9.9, 'cpiFor(1913) = 9.9');
  check(core.cpiFor(2000) === 172.2, 'cpiFor(2000) = 172.2');
  check(core.cpiFor(2024) === 314.0, 'cpiFor(2024) = 314.0');
  check(core.cpiFor(1900) === null, 'cpiFor(1900) = null (before FIRST_YEAR)');
  check(core.cpiFor(2099) === null, 'cpiFor(2099) = null (after LATEST_YEAR, no projection)');

  const projected = core.indexFor(2030, 3.0);
  check(projected > 314.0, 'indexFor(2030, 3.0) projects beyond LATEST_INDEX');

  check(core.clampYear('not a number') === 2024, 'clampYear("not a number") = LATEST_YEAR');
  check(core.clampYear(1900) === 1913, 'clampYear(1900) clamps to FIRST_YEAR');
  check(core.clampYear(3000) === 2124, 'clampYear(3000) clamps to LATEST_YEAR+100');

  check(core.clampAmount('abc') === 100, 'clampAmount("abc") = 100');
  check(core.clampAmount(50) === 50, 'clampAmount(50) = 50');

  check(core.clampRate(20) === 10, 'clampRate(20) caps at 10');
  check(core.clampRate(-5) === 0, 'clampRate(-5) floors at 0');

  check(core.pct(0) === '0.00%', 'pct(0) = 0.00% (no sign on zero)');
  check(core.pct(5.5) === '+5.50%', 'pct(5.5) = +5.50%');
  check(core.pct(-5.5) === '-5.50%', 'pct(-5.5) = -5.50%');
  check(core.pct(0).indexOf('%') > 0, 'pct() returns a percentage string');
}

// =============================================================
// II. inflation-calculator-handlers.js loads after core + binds window.inflationCalculatorInit
// =============================================================
console.log('--- II. inflation-calculator-handlers.js ---');
{
  const ctx = buildCtx();
  loadInto(ctx, CORE_SRC, 'inflation-calculator-core.js (for handlers)');
  check(loadInto(ctx, HANDLERS_SRC, 'inflation-calculator-handlers.js'), 'inflation-calculator-handlers.js loads without throwing');
  check(typeof ctx.window.inflationCalculatorInit === 'function', 'inflation-calculator-handlers.js binds window.inflationCalculatorInit');
}

// =============================================================
// III. inflation-calculator-handlers.js missing core — warns and no-ops
// =============================================================
console.log('--- III. inflation-calculator-handlers.js without core ---');
{
  const ctx = buildCtx();
  // No core loaded.
  check(loadInto(ctx, HANDLERS_SRC, 'inflation-calculator-handlers.js without core'), 'handlers without core does not throw');
  check(ctx.window.inflationCalculatorInit === null, 'handlers without core does not bind window.inflationCalculatorInit');
}

// =============================================================
// IV. index.html script src wiring
// =============================================================
console.log('--- IV. index.html script src ---');
{
  const html = fs.readFileSync(path.join(REPO_ROOT, 'tools/inflation-calculator/index.html'), 'utf8');
  check(html.indexOf('./inflation-calculator-core.js') > 0, 'index.html loads inflation-calculator-core.js');
  check(html.indexOf('./inflation-calculator.js') === -1, 'index.html no longer loads inflation-calculator.js');
  check(html.indexOf('./inflation-calculator-handlers.js') === -1, 'index.html does NOT load inflation-calculator-handlers.js (lazy-only)');
  check(html.indexOf('./cpi-data.js') > 0, 'index.html still loads cpi-data.js (vendor, eager)');
}

// =============================================================
// V. boot path with lazyLoadTool stub
// =============================================================
console.log('--- V. boot path with lazyLoadTool stub ---');
{
  const ctx = buildCtx();
  // Track lazyLoadTool calls.
  let lazyCalled = null;
  ctx.HT.lazyLoadTool = function (slug, url) {
    lazyCalled = { slug: slug, url: url };
    return Promise.resolve();
  };
  ctx.window.inflationCalculatorInit = function () { ctx.window._initRan = true; };

  // core boot fires immediately when readyState='complete'.
  // Load core; the stubbed lazyLoadTool fires and tries to call
  // window.inflationCalculatorInit() — set in core's .then().
  check(loadInto(ctx, CORE_SRC, 'inflation-calculator-core.js (boot stub)'), 'core boot with lazyLoadTool stub OK');
  check(lazyCalled !== null, 'boot invoked HT.lazyLoadTool');
  if (lazyCalled) {
    check(lazyCalled.slug === 'inflation-calculator', 'lazyLoadTool called with slug "inflation-calculator"');
    check(lazyCalled.url === './inflation-calculator-handlers.js', 'lazyLoadTool called with handlers URL');
  }
}

console.log('');
console.log('inflation-split-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);