/* ============================================
   Smoke harness for Story 9.14 — Savings Goal.
   Loads tools/savings-goal/savings-goal-core.js + handlers in a
   vm context with stub DOM and asserts the annuity-due math
   (with and without interest), URL state encode/decode/resolve,
   validation, reduced-motion CSS, privacy (no fetch), tab-order-
   canonical, and no-console-error contract.

   Per AC-8: ≥ 30 assertions, 12 categories, vacuous-pass guard.
   ============================================ */

'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CORE_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'tools/savings-goal/savings-goal-core.js'),
  'utf8'
);
const HANDLERS_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'tools/savings-goal/savings-goal-handlers.js'),
  'utf8'
);
const CSS_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'tools/savings-goal/savings-goal.css'),
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
      pathname: '/tools/savings-goal/',
      search: search || '',
      href: 'http://localhost/tools/savings-goal/' + (search || '')
    },
    navigator: { onLine: true, clipboard: { writeText: () => Promise.resolve() } },
    fetch: function (url, init) {
      fetchCalls.push({ url: url, init: init });
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
  vm.runInContext(CORE_SRC, ctx, { filename: 'savings-goal-core.js' });
  vm.runInContext(HANDLERS_SRC, ctx, { filename: 'savings-goal-handlers.js' });
  return { ctx, elements, fetchCalls, xhrCalls, consoleErrors, storageStore };
}

// ---------------------------------------------------------------
// Category 1: defaults + exports + frozen
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.savingsGoalCore;
  check(core.DEFAULTS.target === 10000, 'defaults: target=10000');
  check(core.DEFAULTS.months === 24, 'defaults: months=24');
  check(core.DEFAULTS.starting === 1000, 'defaults: starting=1000');
  check(core.DEFAULTS.rate === 2.5, 'defaults: rate=2.5');
  check(typeof core.compute === 'function', 'export: compute');
  check(typeof core.encodeState === 'function', 'export: encodeState');
  check(typeof core.decodeState === 'function', 'export: decodeState');
  check(typeof core.resolveState === 'function', 'export: resolveState');
  check(typeof core.validateInputs === 'function', 'export: validateInputs');
  check(Object.isFrozen(core), 'core export is frozen (AD-14)');
}

// ---------------------------------------------------------------
// Category 2: compute math — annuity-due with interest
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.savingsGoalCore;
  const r = core.compute({ target: 10000, months: 24, starting: 1000, rate: 2.5 });
  check(r.target === 10000, 'compute: target preserved');
  check(r.months === 24, 'compute: months preserved');
  check(r.starting === 1000, 'compute: starting preserved');
  check(r.rate === 2.5, 'compute: rate preserved');
  // Manual annuity-due math:
  // r = 2.5/100/12 = 0.0020833...
  // n = 24
  // compound = (1+r)^n ≈ 1.05116
  // fv_starting = 1000 * 1.05116 ≈ 1051.16
  // annuity = (1.05116 - 1) / 0.0020833 ≈ 24.55
  // numerator = 10000 - 1051.16 ≈ 8948.84
  // monthly = 8948.84 / 24.55 ≈ 364.51
  check(r.monthly > 360 && r.monthly < 370, 'compute: monthly ≈ $364 for target=10000/24mo/1000 start/2.5% rate');
  check(r.totalContrib > 8000 && r.totalContrib < 9000, 'compute: totalContrib ≈ $8,640');
  check(r.pctComplete === 10, 'compute: pctComplete = 10%');
  check(r.isValid === true, 'compute: isValid=true for valid inputs');
}

// ---------------------------------------------------------------
// Category 3: compute math — zero rate (linear)
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.savingsGoalCore;
  const r = core.compute({ target: 12000, months: 12, starting: 0, rate: 0 });
  check(r.monthly === 1000, 'compute: rate=0, monthly = (12000-0)/12 = 1000');
  check(r.totalContrib === 12000, 'compute: rate=0, totalContrib = 12000');
  check(r.totalInterest === 0, 'compute: rate=0, totalInterest = 0');
  check(r.pctComplete === 0, 'compute: rate=0, pctComplete = 0%');
}

// ---------------------------------------------------------------
// Category 4: compute math — negative monthly clamped to 0
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.savingsGoalCore;
  // Already-met goal: starting > target → monthly should be 0
  const r = core.compute({ target: 1000, months: 12, starting: 5000, rate: 2.5 });
  check(r.monthly === 0, 'compute: monthly=0 when starting > target');
  // pctComplete is clamped to 0..100 for the progress bar's UI safety.
  // The underlying "raw" percentage would be 500, but the displayed
  // value is capped so the <progress> element never overflows.
  check(r.pctComplete === 100, 'compute: pctComplete clamped to 100 when starting > target');
}

// ---------------------------------------------------------------
// Category 5: validation
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.savingsGoalCore;
  check(core.validateInputs({ target: 0, months: 12, starting: 0, rate: 0 }).length > 0, 'validate: target=0 → error');
  check(core.validateInputs({ target: 1000, months: 0, starting: 0, rate: 0 }).length > 0, 'validate: months=0 → error');
  // Negative values get coerced to 0 by num() — the input layer
  // sanitizes. The handler's input[type=number] min=0 also prevents
  // negative submission in the UI. Validate that bad shape strings
  // surface as errors:
  check(core.validateInputs({ target: 'abc', months: 12, starting: 0, rate: 0 }).length > 0, 'validate: target=abc → error');
  check(core.validateInputs({ target: 1000, months: 12, starting: 0, rate: 2.5 }).length === 0, 'validate: valid inputs → no errors');
  check(core.validateInputs(null).length > 0, 'validate: null → error');
  check(core.validateInputs({}).length > 0, 'validate: empty object → error');
}

// ---------------------------------------------------------------
// Category 6: encode/decode round-trip
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.savingsGoalCore;
  const qs = core.encodeState({ target: 10000, months: 24, starting: 1000, rate: 2.5 });
  check(qs.indexOf('target=10000') >= 0, 'encode: target=10000 present');
  check(qs.indexOf('months=24') >= 0, 'encode: months=24 present');
  check(qs.indexOf('starting=1000') >= 0, 'encode: starting=1000 present');
  check(qs.indexOf('rate=2.5') >= 0, 'encode: rate=2.5 present');
  const dec = core.decodeState('?' + qs);
  check(dec.target === '10000', 'decode: target round-trip');
  check(dec.months === '24', 'decode: months round-trip');
  check(dec.starting === '1000', 'decode: starting round-trip');
  check(dec.rate === '2.5', 'decode: rate round-trip');
  check(core.decodeState('') === null, 'decode: empty search → null');
  check(core.decodeState('?foo=bar') === null, 'decode: no recognized keys → null');
}

// ---------------------------------------------------------------
// Category 7: resolveState
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.savingsGoalCore;
  const r1 = core.resolveState(null);
  check(r1.target === 10000, 'resolve: null → defaults target=10000');
  check(r1.months === 24, 'resolve: null → defaults months=24');
  const r2 = core.resolveState({ target: '5000', months: '12' });
  check(r2.target === 5000, 'resolve: passes through target as number');
  check(r2.starting === 1000, 'resolve: missing starting → default');
  const r3 = core.resolveState({ months: '0' });
  check(r3.months === 1, 'resolve: months<1 clamped to 1');
}

// ---------------------------------------------------------------
// Category 8: SAMPLE state
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.savingsGoalCore;
  check(core.SAMPLE.target === 12000, 'SAMPLE: target=12000');
  check(core.SAMPLE.months === 24, 'SAMPLE: months=24');
  check(core.SAMPLE.starting === 2000, 'SAMPLE: starting=2000');
  check(core.SAMPLE.rate === 2.5, 'SAMPLE: rate=2.5');
}

// ---------------------------------------------------------------
// Category 9: reduced-motion CSS + print rules
// ---------------------------------------------------------------
check(/prefers-reduced-motion: reduce/.test(CSS_SRC), 'CSS: prefers-reduced-motion query');
check(/\[data-reduced-motion="true"\]/.test(CSS_SRC), 'CSS: data-reduced-motion selector');
check(/transition: none/.test(CSS_SRC), 'CSS: transition disabled under reduced motion');
check(/@media print/.test(CSS_SRC), 'CSS: print media query exists');
check(/data-sg-key/.test(CSS_SRC), 'CSS: hides interactive inputs on print');

// ---------------------------------------------------------------
// Category 10: privacy (no fetch / XHR / console.error on boot)
// ---------------------------------------------------------------
{
  const env = buildAndLoad('?target=10000&months=24&starting=1000&rate=2.5');
  check(env.fetchCalls.length === 0, 'privacy: no fetch calls during boot');
  check(env.xhrCalls.length === 0, 'privacy: no XHR calls');
  check(env.consoleErrors.length === 0, 'privacy: no console.error');
}

// ---------------------------------------------------------------
// Category 11: handlers register init function
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  check(typeof env.ctx.savingsGoalInit === 'function', 'handlers: window.savingsGoalInit registered');
  check(typeof env.ctx.window.savingsGoalInit === 'function', 'handlers: window.savingsGoalInit exists');
}

// ---------------------------------------------------------------
// Category 12: tab-order-canonical in tools.json
// ---------------------------------------------------------------
{
  const toolsJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tools.json'), 'utf8'));
  const sg = toolsJson.tools.find(t => t.id === 'savings-goal');
  check(sg !== undefined, 'tools.json: savings-goal entry exists');
  const canon = (sg && sg['tab-order-canonical']) || [];
  check(Array.isArray(canon), 'tab-order-canonical: array');
  for (const sel of [
    '[data-sg-key="target"]',
    '[data-sg-key="months"]',
    '[data-sg-key="starting"]',
    '[data-sg-key="rate"]',
    '[data-action="sample"]',
    '[data-action="reset"]',
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
console.log('savings-goal-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);