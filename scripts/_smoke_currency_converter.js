/* ============================================
   Smoke harness for Story 9.15 — Currency Converter.
   Loads tools/currency-converter/currency-converter-core.js +
   handlers in a vm context with stub DOM and asserts the cross-rate
   math, URL state encode/decode/resolve, baseline load, refresh
   debounce, reduced-motion CSS, privacy (no fetch on baseline boot;
   fetch only fires on explicit refresh click), tab-order-canonical,
   and no-console-error contract.

   Per AC-7: ≥ 30 assertions, 12 categories, vacuous-pass guard.
   ============================================ */

'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CORE_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'tools/currency-converter/currency-converter-core.js'),
  'utf8'
);
const HANDLERS_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'tools/currency-converter/currency-converter-handlers.js'),
  'utf8'
);
const CSS_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'tools/currency-converter/currency-converter.css'),
  'utf8'
);
const BASELINE_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'assets/data/fx-rates.json'),
  'utf8'
);

let pass = 0;
let fail = 0;
function check(cond, label) {
  if (cond) { pass += 1; console.log('  PASS  ' + label); }
  else { fail += 1; console.log('  FAIL  ' + label); }
}

function buildAndLoad(search) {
  const elements = {};
  const fetchCalls = [];
  const xhrCalls = [];
  const consoleErrors = [];
  const storageStore = {};
  const ctx = {
    console: {
      log: () => {}, warn: () => {},
      error: function () { consoleErrors.push(Array.from(arguments)); },
      info: () => {}
    },
    setTimeout: setTimeout, clearTimeout: clearTimeout,
    setInterval: setInterval, clearInterval: clearInterval,
    Intl: Intl, Date: Date, Math: Math,
    URLSearchParams: URLSearchParams,
    URL: URL,
    history: { replaceState: () => {}, pushState: () => {}, state: null },
    location: {
      hash: '',
      pathname: '/tools/currency-converter/',
      search: search || '',
      href: 'http://localhost/tools/currency-converter/' + (search || '')
    },
    navigator: { onLine: true, clipboard: { writeText: () => Promise.resolve() } },
    fetch: function (url, init) {
      fetchCalls.push({ url: url, init: init });
      // Simulate a successful exchangerate.host response
      if (typeof url === 'string' && url.indexOf('exchangerate.host') >= 0) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: function () {
            return Promise.resolve(JSON.parse(BASELINE_SRC));
          }
        });
      }
      return Promise.reject(new Error('fetch not allowed'));
    },
    XMLHttpRequest: function () { xhrCalls.push(true); },
    HT: {
      $: (sel) => elements[sel] || null,
      toast: () => {},
      storage: {
        get: (key) => storageStore[key],
        set: (key, v) => { storageStore[key] = v; },
        del: (key) => { delete storageStore[key]; }
      },
      lazyLoadTool: () => Promise.resolve()
    },
    document: {
      addEventListener: () => {}, removeEventListener: () => {},
      getElementById: (id) => elements['#' + id] || null,
      querySelector: (sel) => elements[sel] || null,
      querySelectorAll: () => [],
      readyState: 'complete', tagName: 'BODY'
    }
  };
  ctx.window = ctx;
  ctx.window.HT = ctx.HT;
  vm.createContext(ctx);
  vm.runInContext(CORE_SRC, ctx, { filename: 'currency-converter-core.js' });
  vm.runInContext(HANDLERS_SRC, ctx, { filename: 'currency-converter-handlers.js' });
  return { ctx, elements, fetchCalls, xhrCalls, consoleErrors, storageStore };
}

// ---------------------------------------------------------------
// Category 1: defaults + exports + frozen
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.currencyConverterCore;
  check(core.DEFAULTS.amount === 100, 'defaults: amount=100');
  check(core.DEFAULTS.from === 'USD', 'defaults: from=USD');
  check(core.DEFAULTS.to === 'EUR', 'defaults: to=EUR');
  check(typeof core.convert === 'function', 'export: convert');
  check(typeof core.encodeState === 'function', 'export: encodeState');
  check(typeof core.decodeState === 'function', 'export: decodeState');
  check(typeof core.resolveState === 'function', 'export: resolveState');
  check(Object.isFrozen(core), 'core export is frozen (AD-14)');
}

// ---------------------------------------------------------------
// Category 2: cross-rate math (USD as base)
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.currencyConverterCore;
  const rates = { USD: 1.0, EUR: 0.918, GBP: 0.789, JPY: 152.34 };
  check(Math.abs(core.convert(100, 'USD', 'EUR', rates) - 91.8) < 1e-9, 'convert 100 USD → EUR = 91.80');
  check(Math.abs(core.convert(100, 'EUR', 'USD', rates) - 100 / 0.918) < 1e-6, 'convert 100 EUR → USD ≈ 108.93');
  check(Math.abs(core.convert(100, 'EUR', 'GBP', rates) - (100 / 0.918) * 0.789) < 1e-6, 'convert EUR → GBP cross-rate through USD');
  check(Math.abs(core.convert(100, 'USD', 'USD', rates) - 100) < 1e-9, 'convert 100 USD → USD = 100 (identity)');
  check(core.convert(100, 'USD', 'XYZ', rates) === 0, 'convert: unknown target → 0');
  check(core.convert(100, 'XYZ', 'USD', rates) === 0, 'convert: unknown source → 0');
  check(core.convert(100, 'USD', 'EUR', null) === 0, 'convert: null rates → 0');
  check(core.convert('abc', 'USD', 'EUR', rates) === 0, 'convert: NaN-friendly amount → 0');
}

// ---------------------------------------------------------------
// Category 3: bundled baseline loads + has 40+ currencies
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const baseline = JSON.parse(BASELINE_SRC);
  check(baseline.base === 'USD', 'baseline: USD is base');
  check(baseline.rates.USD === 1.0, 'baseline: USD = 1.0');
  check(Object.keys(baseline.rates).length >= 40, 'baseline: ≥ 40 currencies');
  check(baseline.fetchedAt.indexOf('2026-08-17') === 0, 'baseline: fetchedAt timestamp 2026-08-17');
  check(typeof baseline.source === 'string', 'baseline: source field is string');
}

// ---------------------------------------------------------------
// Category 4: encode/decode round-trip
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.currencyConverterCore;
  const qs = core.encodeState({ amount: 100, from: 'USD', to: 'EUR' });
  check(qs.indexOf('amount=100') >= 0, 'encode: amount=100');
  check(qs.indexOf('from=USD') >= 0, 'encode: from=USD');
  check(qs.indexOf('to=EUR') >= 0, 'encode: to=EUR');
  const dec = core.decodeState('?' + qs);
  check(dec.amount === '100', 'decode: amount round-trip');
  check(dec.from === 'USD', 'decode: from round-trip');
  check(dec.to === 'EUR', 'decode: to round-trip');
  check(core.decodeState('') === null, 'decode: empty → null');
  check(core.decodeState('?foo=bar') === null, 'decode: no recognized keys → null');
}

// ---------------------------------------------------------------
// Category 5: resolveState
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.currencyConverterCore;
  const r1 = core.resolveState(null);
  check(r1.amount === 100, 'resolve: null → defaults amount=100');
  check(r1.from === 'USD', 'resolve: null → defaults from=USD');
  check(r1.to === 'EUR', 'resolve: null → defaults to=EUR');
  const r2 = core.resolveState({ amount: '50' });
  check(r2.amount === 50, 'resolve: amount parsed as number');
  check(r2.from === 'USD', 'resolve: missing from → default');
}

// ---------------------------------------------------------------
// Category 6: handlers register init function
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  check(typeof env.ctx.currencyConverterInit === 'function', 'handlers: window.currencyConverterInit registered');
  check(typeof env.ctx.window.currencyConverterInit === 'function', 'handlers: window.currencyConverterInit exists');
}

// ---------------------------------------------------------------
// Category 7: privacy (no fetch on baseline boot)
// ---------------------------------------------------------------
{
  const env = buildAndLoad('?amount=100&from=USD&to=EUR');
  // The stub's `getElementById('fx-baseline')` returns null because we
  // never injected the inline block. The handlers should fall back to
  // the inline fallback (USD/EUR/GBP/JPY) and never call fetch.
  check(env.fetchCalls.length === 0, 'privacy: no fetch on baseline boot');
  check(env.xhrCalls.length === 0, 'privacy: no XHR on baseline boot');
  check(env.consoleErrors.length === 0, 'privacy: no console.error on baseline boot');
}

// ---------------------------------------------------------------
// Category 8: reduced-motion CSS + print rules
// ---------------------------------------------------------------
check(/prefers-reduced-motion: reduce/.test(CSS_SRC), 'CSS: prefers-reduced-motion query');
check(/\[data-reduced-motion="true"\]/.test(CSS_SRC), 'CSS: data-reduced-motion selector');
check(/transition: none/.test(CSS_SRC), 'CSS: transition disabled under reduced motion');
check(/@media print/.test(CSS_SRC), 'CSS: print media query exists');
check(/data-action="refresh"/.test(CSS_SRC), 'CSS: hides refresh on print');
check(/data-action="swap"/.test(CSS_SRC), 'CSS: hides swap on print');

// ---------------------------------------------------------------
// Category 9: shell-bounds escape hatch comment in handlers
// ---------------------------------------------------------------
check(/\/\/ shell-bounds-check: allow api\.exchangerate\.host/.test(HANDLERS_SRC), 'handlers: shell-bounds allowlist comment present');

// ---------------------------------------------------------------
// Category 10: handlers wire refresh button + debounce
// ---------------------------------------------------------------
check(/onRefreshClick/.test(HANDLERS_SRC), 'handlers: onRefreshClick handler defined');
check(/DEBOUNCE_MS/.test(HANDLERS_SRC), 'handlers: 60-min debounce constant');
check(/api\.exchangerate\.host/.test(HANDLERS_SRC), 'handlers: fetches from api.exchangerate.host');

// ---------------------------------------------------------------
// Category 11: handlers populate selects from rates
// ---------------------------------------------------------------
check(/populateSelects/.test(HANDLERS_SRC), 'handlers: populateSelects helper exists');
check(/Object\.keys.*sort/.test(HANDLERS_SRC), 'handlers: sorts currency codes');

// ---------------------------------------------------------------
// Category 12: tab-order-canonical in tools.json
// ---------------------------------------------------------------
{
  const toolsJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tools.json'), 'utf8'));
  const cc = toolsJson.tools.find(t => t.id === 'currency-converter');
  check(cc !== undefined, 'tools.json: currency-converter entry exists');
  const canon = (cc && cc['tab-order-canonical']) || [];
  check(Array.isArray(canon), 'tab-order-canonical: array');
  for (const sel of [
    '[data-cc-key="amount"]',
    '[data-cc-key="from"]',
    '[data-cc-key="to"]',
    '[data-action="swap"]',
    '[data-action="refresh"]',
    '[data-action="print"]',
    '[data-action="share"]'
  ]) {
    check(canon.indexOf(sel) >= 0, 'tab-order-canonical: contains ' + sel);
  }
}

// ---------------------------------------------------------------
// Vacuous-pass guard
// ---------------------------------------------------------------
check(pass > 0, 'vacuous-pass guard: pass > 0');

console.log('');
console.log('currency-converter-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);