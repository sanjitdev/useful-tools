#!/usr/bin/env node
/* Story 4b Phase 2 — lifespan-simulator core+handlers split smoke.

   Verifies the new lifespan-simulator-core.js + lifespan-simulator-handlers.js
   pair:
     - lifespan-simulator-core.js loads via vm sandbox without throwing
     - HT.lifespanSimulatorCore frozen handle exposes WHO_DELTAS, COUNTRIES,
       COUNTRY_BY_CODE, all 22 enum tables (SMOKING/STRESS/BP/DIABETES/HEART/
       CHOLESTEROL/CANCER/DEPRESSION/SEATBELT/MOTORCYCLE/DRUGS/CHECKUPS/
       VACCINES/DENTAL/FRUITVEG/SUN/POLLUTION/INCOME/EDUCATION/RELATIONSHIP),
       baselineFor, pickEnum, clamp
     - WHO_DELTAS scale convention is preserved (SCALE_MIN, SCALE_MAX,
       SYNERGY_SMOKING_ALCOHOL, SYNERGY_SMOKING_SEDENTARY)
     - pickEnum returns the right entry for known values; null for unknown
     - clamp clamps to bounds
     - lifespan-simulator-handlers.js loads after core and binds
       window.lifespanSimulatorInit
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
const CORE_SRC = fs.readFileSync(path.join(REPO_ROOT, 'tools/lifespan-simulator/lifespan-simulator-core.js'), 'utf8');
const HANDLERS_SRC = fs.readFileSync(path.join(REPO_ROOT, 'tools/lifespan-simulator/lifespan-simulator-handlers.js'), 'utf8');

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
    window: { HT: HT, lifespanSimulatorInit: null },
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
// I. lifespan-simulator-core.js loads + exposes HT.lifespanSimulatorCore
// =============================================================
console.log('--- I. lifespan-simulator-core.js ---');
{
  const ctx = buildCtx();
  check(loadInto(ctx, CORE_SRC, 'lifespan-simulator-core.js'), 'lifespan-simulator-core.js loads without throwing');
  check(!!ctx.HT.lifespanSimulatorCore, 'HT.lifespanSimulatorCore exposed');
  check(Object.isFrozen(ctx.HT.lifespanSimulatorCore), 'HT.lifespanSimulatorCore is frozen (AD-14 internal handle)');

  const core = ctx.HT.lifespanSimulatorCore;
  // 22 enum tables (per plan: 22 enums in core)
  const enums = ['SMOKING', 'STRESS', 'BP', 'DIABETES', 'HEART', 'CHOLESTEROL',
                 'CANCER', 'DEPRESSION', 'SEATBELT', 'MOTORCYCLE', 'DRUGS',
                 'CHECKUPS', 'VACCINES', 'DENTAL', 'FRUITVEG', 'SUN', 'POLLUTION',
                 'INCOME', 'EDUCATION', 'RELATIONSHIP'];
  enums.forEach(function (e) {
    check(typeof core[e] === 'object' && core[e] !== null, e + ' table is exposed');
  });

  // WHO_DELTAS scale convention
  check(core.WHO_DELTAS.SCALE_MIN === -10.0, 'WHO_DELTAS.SCALE_MIN = -10.0');
  check(core.WHO_DELTAS.SCALE_MAX === 10.0, 'WHO_DELTAS.SCALE_MAX = 10.0');
  check(core.WHO_DELTAS.SYNERGY_SMOKING_ALCOHOL === -1.5, 'WHO_DELTAS.SYNERGY_SMOKING_ALCOHOL = -1.5');
  check(core.WHO_DELTAS.SYNERGY_SMOKING_SEDENTARY === -1.0, 'WHO_DELTAS.SYNERGY_SMOKING_SEDENTARY = -1.0');

  // COUNTRIES table
  check(Array.isArray(core.COUNTRIES) && core.COUNTRIES.length > 40, 'COUNTRIES has > 40 entries');
  check(core.COUNTRIES[0].code === 'BD', 'first country is BD (Bangladesh)');
  check(core.COUNTRIES[core.COUNTRIES.length - 1].code === 'GLOBAL', 'last country is GLOBAL');

  // COUNTRY_BY_CODE
  check(core.COUNTRY_BY_CODE['BD'].name === 'Bangladesh', 'COUNTRY_BY_CODE[BD] = Bangladesh');
  check(core.COUNTRY_BY_CODE['US'].name === 'United States', 'COUNTRY_BY_CODE[US] = United States');
  check(core.COUNTRY_BY_CODE['GLOBAL'].name === 'Global average', 'COUNTRY_BY_CODE[GLOBAL] = Global average');

  // baselineFor
  check(core.baselineFor('BD', 'male') === 71.4, 'baselineFor(BD, male) = 71.4');
  check(core.baselineFor('BD', 'female') === 74.6, 'baselineFor(BD, female) = 74.6');
  check(core.baselineFor('US', 'male') === 76.4, 'baselineFor(US, male) = 76.4');
  check(core.baselineFor('XX', 'male') === core.COUNTRY_BY_CODE.GLOBAL.male, 'baselineFor unknown = GLOBAL');

  // pickEnum
  check(core.pickEnum(core.SMOKING, 'never').delta === 0, 'SMOKING.never.delta = 0');
  check(core.pickEnum(core.SMOKING, 'daily').delta === -9.0, 'SMOKING.daily.delta = -9.0');
  check(core.pickEnum(core.SMOKING, 'unknown') === null, 'pickEnum returns null for unknown');

  // clamp
  check(core.clamp(5, 0, 10) === 5, 'clamp(5, 0, 10) = 5');
  check(core.clamp(-5, 0, 10) === 0, 'clamp(-5, 0, 10) = 0');
  check(core.clamp(15, 0, 10) === 10, 'clamp(15, 0, 10) = 10');
}

// =============================================================
// II. lifespan-simulator-handlers.js loads after core + binds window.lifespanSimulatorInit
// =============================================================
console.log('--- II. lifespan-simulator-handlers.js ---');
{
  const ctx = buildCtx();
  loadInto(ctx, CORE_SRC, 'lifespan-simulator-core.js (for handlers)');
  check(loadInto(ctx, HANDLERS_SRC, 'lifespan-simulator-handlers.js'), 'lifespan-simulator-handlers.js loads without throwing');
  check(typeof ctx.window.lifespanSimulatorInit === 'function', 'lifespan-simulator-handlers.js binds window.lifespanSimulatorInit');
}

// =============================================================
// III. lifespan-simulator-handlers.js missing core — warns and no-ops
// =============================================================
console.log('--- III. lifespan-simulator-handlers.js without core ---');
{
  const ctx = buildCtx();
  // No core loaded.
  check(loadInto(ctx, HANDLERS_SRC, 'lifespan-simulator-handlers.js without core'), 'handlers without core does not throw');
  check(ctx.window.lifespanSimulatorInit === null, 'handlers without core does not bind window.lifespanSimulatorInit');
}

// =============================================================
// IV. index.html script src wiring
// =============================================================
console.log('--- IV. index.html script src ---');
{
  const html = fs.readFileSync(path.join(REPO_ROOT, 'tools/lifespan-simulator/index.html'), 'utf8');
  check(html.indexOf('./lifespan-simulator-core.js') > 0, 'index.html loads lifespan-simulator-core.js');
  check(html.indexOf('./lifespan-simulator.js') === -1, 'index.html no longer loads lifespan-simulator.js');
  check(html.indexOf('./lifespan-simulator-handlers.js') === -1, 'index.html does NOT load lifespan-simulator-handlers.js (lazy-only)');
}

// =============================================================
// V. boot path with lazyLoadTool stub
// =============================================================
console.log('--- V. boot path with lazyLoadTool stub ---');
{
  const ctx = buildCtx();
  let lazyCalled = null;
  ctx.HT.lazyLoadTool = function (slug, url) {
    lazyCalled = { slug: slug, url: url };
    return Promise.resolve();
  };
  ctx.window.lifespanSimulatorInit = function () { ctx.window._initRan = true; };

  check(loadInto(ctx, CORE_SRC, 'lifespan-simulator-core.js (boot stub)'), 'core boot with lazyLoadTool stub OK');
  check(lazyCalled !== null, 'boot invoked HT.lazyLoadTool');
  if (lazyCalled) {
    check(lazyCalled.slug === 'lifespan-simulator', 'lazyLoadTool called with slug "lifespan-simulator"');
    check(lazyCalled.url === './lifespan-simulator-handlers.js', 'lazyLoadTool called with handlers URL');
  }
}

console.log('');
console.log('lifespan-simulator-split-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);