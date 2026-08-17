/* ============================================
   Smoke harness for Story 9.13 — Budget Planner.
   Loads tools/budget-planner/budget-planner-core.js + handlers in
   a vm context with stub DOM and asserts the math (total expenses,
   savings, savings rate, discretionary), URL state encoding,
   addCategory UUID stability, reduced-motion CSS, privacy
   (no fetch), tab-order-canonical, and no-console-error contract.

   Per AC-8: ≥ 30 assertions, 12 categories, vacuous-pass guard.
   ============================================ */

'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CORE_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'tools/budget-planner/budget-planner-core.js'),
  'utf8'
);
const HANDLERS_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'tools/budget-planner/budget-planner-handlers.js'),
  'utf8'
);
const CSS_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'tools/budget-planner/budget-planner.css'),
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
    btoa: typeof btoa === 'function' ? btoa : function (s) { return Buffer.from(s, 'binary').toString('base64'); },
    atob: typeof atob === 'function' ? atob : function (s) { return Buffer.from(s, 'base64').toString('binary'); },
    unescape: typeof unescape === 'function' ? unescape : function (s) { return s; },
    escape: typeof escape === 'function' ? escape : function (s) { return s; },
    encodeURIComponent: encodeURIComponent,
    decodeURIComponent: decodeURIComponent,
    history: { replaceState: () => {}, pushState: () => {}, state: null },
    location: {
      hash: '',
      pathname: '/tools/budget-planner/',
      search: search || '',
      href: 'http://localhost/tools/budget-planner/' + (search || '')
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
  if (typeof ctx.crypto === 'undefined') {
    try { ctx.crypto = require('crypto').webcrypto; } catch (e) { ctx.crypto = undefined; }
  }
  vm.createContext(ctx);
  vm.runInContext(CORE_SRC, ctx, { filename: 'budget-planner-core.js' });
  vm.runInContext(HANDLERS_SRC, ctx, { filename: 'budget-planner-handlers.js' });
  return { ctx, elements, fetchCalls, xhrCalls, consoleErrors, storageStore };
}

// ---------------------------------------------------------------
// Category 1: Default categories exist + export shape
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.budgetPlannerCore;
  check(core.DEFAULT_CATEGORIES.length === 5, 'defaults: 5 categories');
  const names = core.DEFAULT_CATEGORIES.map(c => c.name);
  check(names.indexOf('Housing') >= 0, 'defaults: includes Housing');
  check(names.indexOf('Food') >= 0, 'defaults: includes Food');
  check(names.indexOf('Transport') >= 0, 'defaults: includes Transport');
  check(names.indexOf('Entertainment') >= 0, 'defaults: includes Entertainment');
  check(names.indexOf('Other') >= 0, 'defaults: includes Other');
  check(core.DEFAULT_CATEGORIES[0].amount === 1500, 'defaults: Housing = 1500');
  check(core.DEFAULT_CATEGORIES[1].amount === 600, 'defaults: Food = 600');
  check(core.DEFAULT_CATEGORIES[4].amount === 300, 'defaults: Other = 300');
  check(typeof core.uuid === 'function', 'export: uuid');
  check(typeof core.encodeState === 'function', 'export: encodeState');
  check(typeof core.decodeState === 'function', 'export: decodeState');
  check(typeof core.resolveState === 'function', 'export: resolveState');
  check(typeof core.compute === 'function', 'export: compute');
  check(typeof core.addCategory === 'function', 'export: addCategory');
  check(typeof core.removeCategory === 'function', 'export: removeCategory');
  check(typeof core.updateCategory === 'function', 'export: updateCategory');
  check(Object.isFrozen(core), 'core export is frozen (AD-14)');
}

// ---------------------------------------------------------------
// Category 2: compute() math — savingsRate, discretionary
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.budgetPlannerCore;
  // Spec scenario: income=5000, all cats=$800
  const state = {
    income: 5000,
    categories: [
      { id: 'a', name: 'Housing', amount: 800 },
      { id: 'b', name: 'Food', amount: 800 },
      { id: 'c', name: 'Transport', amount: 800 },
      { id: 'd', name: 'Entertainment', amount: 800 },
      { id: 'e', name: 'Other', amount: 800 }
    ]
  };
  const r = core.compute(state);
  check(r.totalExpenses === 4000, 'compute: totalExpenses = 4000');
  check(r.savings === 1000, 'compute: savings = 1000');
  check(Math.abs(r.savingsRate - 20) < 1e-9, 'compute: savingsRate = 20%');
  check(r.discretionary === 1000 - (800 + 800), 'compute: discretionary = -600');
  check(r.categoryCount === 5, 'compute: categoryCount = 5');
}

// ---------------------------------------------------------------
// Category 3: zero-income guard + negative numbers
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.budgetPlannerCore;
  const r1 = core.compute({ income: 0, categories: core.DEFAULT_CATEGORIES });
  check(r1.savingsRate === 0, 'compute: savingsRate = 0 when income=0');

  const r2 = core.compute({
    income: 1000,
    categories: [
      { id: 'a', name: 'Housing', amount: 800 },
      { id: 'b', name: 'Transport', amount: 800 }
    ]
  });
  check(r2.savings === -600, 'compute: negative savings allowed');
  check(r2.discretionary < 0, 'compute: discretionary can be negative');

  const r3 = core.compute({ income: 100, categories: [{ id: 'x', name: 'Food', amount: 'abc' }] });
  check(r3.totalExpenses === 0, 'compute: NaN-friendly amount → 0');
}

// ---------------------------------------------------------------
// Category 4: addCategory + UUID uniqueness
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.budgetPlannerCore;
  const s0 = { income: 0, categories: core.DEFAULT_CATEGORIES.map(c => Object.assign({}, c)) };
  const s1 = core.addCategory(s0, 'Pet');
  check(s1.categories.length === 6, 'addCategory: adds row');
  const newRow = s1.categories[s1.categories.length - 1];
  check(newRow.name === 'Pet', 'addCategory: uses provided name');
  check(/^cat-/.test(newRow.id), 'addCategory: id has cat- prefix');
  check(newRow.amount === 0, 'addCategory: amount=0 default');
  check(s0.categories.length === 5, 'addCategory: source state preserved');

  const ids = [];
  let s = { income: 0, categories: [] };
  for (let i = 0; i < 5; i += 1) {
    s = core.addCategory(s, 'c' + i);
    ids.push(s.categories[s.categories.length - 1].id);
  }
  const uniq = new Set(ids);
  check(uniq.size === ids.length, 'uuid: 5 generated ids are unique');
}

// ---------------------------------------------------------------
// Category 5: removeCategory + updateCategory
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.budgetPlannerCore;
  const s = { income: 0, categories: core.DEFAULT_CATEGORIES.map(c => Object.assign({}, c)) };
  const targetId = s.categories[2].id;
  const s2 = core.removeCategory(s, targetId);
  check(s2.categories.length === 4, 'removeCategory: removes row');
  check(s2.categories.every(c => c.id !== targetId), 'removeCategory: target id gone');

  const s3 = core.updateCategory(s, s.categories[0].id, { name: 'Groceries', amount: 250 });
  check(s3.categories[0].name === 'Groceries', 'updateCategory: name updated');
  check(s3.categories[0].amount === 250, 'updateCategory: amount updated');
  check(s3.categories[1].amount === 600, 'updateCategory: other rows untouched');
}

// ---------------------------------------------------------------
// Category 6: encode/decode base64 round-trip
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.budgetPlannerCore;
  const state = {
    income: 5000,
    categories: [
      { id: 'a', name: 'Housing', amount: 1500 },
      { id: 'b', name: 'Food', amount: 600 }
    ]
  };
  const enc = core.encodeState(state);
  check(typeof enc === 'string' && enc.length > 0, 'encode: base64 string output');
  const dec = core.decodeState('?budget=' + enc);
  check(dec && dec.income === 5000, 'decode: round-trip income');
  check(dec && dec.categories.length === 2, 'decode: round-trip categories length');
  check(dec && dec.categories[0].name === 'Housing', 'decode: round-trip category name');
  check(dec && dec.categories[1].amount === 600, 'decode: round-trip category amount');
  check(core.decodeState('') === null, 'decode: empty search → null');
  check(core.decodeState('?foo=bar') === null, 'decode: missing ?budget= → null');
}

// ---------------------------------------------------------------
// Category 7: resolveState
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.budgetPlannerCore;
  const r1 = core.resolveState({ income: 2000, categories: [{ id: 'a', name: 'X', amount: 5 }] });
  check(r1.income === 2000, 'resolve: passes income through');
  check(r1.categories.length === 1, 'resolve: passes categories through');

  const r2 = core.resolveState(null);
  check(r2.categories.length === 5, 'resolve: null state → defaults');
  check(r2.income === 0, 'resolve: null income → 0');

  const r3 = core.resolveState({ income: 100, categories: [{ name: 'X', amount: 1 }] });
  check(/^cat-/.test(r3.categories[0].id), 'resolve: missing id auto-fills');
}

// ---------------------------------------------------------------
// Category 8: sample state
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.budgetPlannerCore;
  check(core.SAMPLE.income === 5000, 'SAMPLE: income=$5000');
  check(core.SAMPLE.categories.length === 5, 'SAMPLE: 5 categories');
}

// ---------------------------------------------------------------
// Category 9: reduced-motion CSS + print rules
// ---------------------------------------------------------------
check(/prefers-reduced-motion: reduce/.test(CSS_SRC), 'CSS: prefers-reduced-motion query');
check(/\[data-reduced-motion="true"\]/.test(CSS_SRC), 'CSS: data-reduced-motion selector');
check(/transition: none/.test(CSS_SRC), 'CSS: transition disabled under reduced motion');
check(/@media print/.test(CSS_SRC), 'CSS: print media query exists');
check(/data-bp-cat-name/.test(CSS_SRC), 'CSS: hides interactive inputs on print');

// ---------------------------------------------------------------
// Category 10: privacy (no fetch / XHR / console.error on boot)
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  check(env.fetchCalls.length === 0, 'privacy: no fetch calls during boot');
  check(env.xhrCalls.length === 0, 'privacy: no XHR calls');
  check(env.consoleErrors.length === 0, 'privacy: no console.error');
}

// ---------------------------------------------------------------
// Category 11: handlers register init function
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  check(typeof env.ctx.budgetPlannerInit === 'function', 'handlers: window.budgetPlannerInit registered');
  check(typeof env.ctx.window.budgetPlannerInit === 'function', 'handlers: window.budgetPlannerInit exists');
}

// ---------------------------------------------------------------
// Category 12: tab-order-canonical in tools.json
// ---------------------------------------------------------------
{
  const toolsJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tools.json'), 'utf8'));
  const bp = toolsJson.tools.find(t => t.id === 'budget-planner');
  check(bp !== undefined, 'tools.json: budget-planner entry exists');
  const canon = (bp && bp['tab-order-canonical']) || [];
  check(Array.isArray(canon), 'tab-order-canonical: array');
  for (const sel of [
    '[data-bp-key="income"]',
    '[data-action="add"]',
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
console.log('budget-planner-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);