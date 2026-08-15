#!/usr/bin/env node
/* Story 4b Phase 3 — recipe-scaler core+handlers split smoke.

   Verifies the new recipe-scaler-core.js + recipe-scaler-handlers.js
   pair:
     - recipe-scaler-core.js loads via vm sandbox without throwing
     - HT.recipeScalerCore frozen handle exposes getDefaults/getFactors/
       getSampleRecipe/getConstants/parseFraction/formatFraction/
       parseLine/tryConvert/clampMultiplier
     - DEFAULTS multiplier=2, system='metric'
     - FALLBACK_FACTORS has volume.toBase.cup = 236.588
     - SAMPLE_RECIPE is the canonical 6-line sample
     - parseFraction: '1/2'→0.5, '1 1/2'→1.5, '0.5'→0.5
     - formatFraction: 0.5 → '1/2'
     - recipe-scaler-handlers.js loads after core and binds
       window.recipeScalerInit
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
const CORE_SRC = fs.readFileSync(path.join(REPO_ROOT, 'tools/recipe-scaler/recipe-scaler-core.js'), 'utf8');
const HANDLERS_SRC = fs.readFileSync(path.join(REPO_ROOT, 'tools/recipe-scaler/recipe-scaler-handlers.js'), 'utf8');

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
    window: { HT: HT, recipeScalerInit: null },
    console: { warn: function () {}, log: function () {}, error: function () {}, info: function () {} },
    document: {
      addEventListener: function () {},
      documentElement: { setAttribute: function () {} },
      readyState: 'complete',
      querySelectorAll: function () { return []; },
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    btoa: function (s) { return Buffer.from(s, 'binary').toString('base64'); },
    atob: function (s) { return Buffer.from(s, 'base64').toString('binary'); },
    performance: { now: function () { return Date.now(); } },
  };
  // Mirror window.HT bindings.
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
// I. recipe-scaler-core.js loads + exposes HT.recipeScalerCore
// =============================================================
console.log('--- I. recipe-scaler-core.js ---');
{
  const ctx = buildCtx();
  check(loadInto(ctx, CORE_SRC, 'recipe-scaler-core.js'), 'recipe-scaler-core.js loads without throwing');
  check(!!ctx.HT.recipeScalerCore, 'HT.recipeScalerCore exposed');
  check(Object.isFrozen(ctx.HT.recipeScalerCore), 'HT.recipeScalerCore is frozen (AD-14 internal handle)');
  check(typeof ctx.HT.recipeScalerCore.getDefaults === 'function', 'getDefaults is a function');
  check(typeof ctx.HT.recipeScalerCore.getFactors === 'function', 'getFactors is a function');
  check(typeof ctx.HT.recipeScalerCore.getSampleRecipe === 'function', 'getSampleRecipe is a function');
  check(typeof ctx.HT.recipeScalerCore.getConstants === 'function', 'getConstants is a function');
  check(typeof ctx.HT.recipeScalerCore.parseFraction === 'function', 'parseFraction is a function');
  check(typeof ctx.HT.recipeScalerCore.formatFraction === 'function', 'formatFraction is a function');
  check(typeof ctx.HT.recipeScalerCore.parseLine === 'function', 'parseLine is a function');
  check(typeof ctx.HT.recipeScalerCore.tryConvert === 'function', 'tryConvert is a function');
  check(typeof ctx.HT.recipeScalerCore.clampMultiplier === 'function', 'clampMultiplier is a function');

  const DEFAULTS = ctx.HT.recipeScalerCore.getDefaults();
  check(DEFAULTS.multiplier === 2, 'DEFAULTS.multiplier = 2');
  check(DEFAULTS.system === 'metric', "DEFAULTS.system = 'metric'");

  const FACTORS = ctx.HT.recipeScalerCore.getFactors();
  check(!!FACTORS.volume, 'FACTORS.volume exists');
  check(FACTORS.volume.toBase.cup === 236.588, 'FACTORS.volume.toBase.cup = 236.588');
  check(FACTORS.volume.toBase.tbsp === 14.787, 'FACTORS.volume.toBase.tbsp = 14.787');
  check(FACTORS.mass.toBase.lb === 453.592, 'FACTORS.mass.toBase.lb = 453.592');
  check(FACTORS.temperature.units.indexOf('°F') !== -1, 'FACTORS.temperature.units includes °F');
  check(FACTORS.temperature.units.indexOf('°C') !== -1, 'FACTORS.temperature.units includes °C');

  const SAMPLE = ctx.HT.recipeScalerCore.getSampleRecipe();
  check(typeof SAMPLE === 'string' && SAMPLE.indexOf('1/2 cup flour') !== -1, 'SAMPLE_RECIPE contains 1/2 cup flour');
  check(SAMPLE.indexOf('2 tbsp sugar') !== -1, 'SAMPLE_RECIPE contains 2 tbsp sugar');
  check(SAMPLE.indexOf('350 °F oven') !== -1, 'SAMPLE_RECIPE contains 350 °F oven');
  check(SAMPLE.indexOf('salt to taste') !== -1, 'SAMPLE_RECIPE contains salt to taste');

  const C = ctx.HT.recipeScalerCore.getConstants();
  check(C.MULT_MIN === 0.1, 'MULT_MIN = 0.1');
  check(C.MULT_MAX === 100, 'MULT_MAX = 100');
  check(C.FRAC_CAP === 16, 'FRAC_CAP = 16');

  // Math: parseFraction
  const parseFraction = ctx.HT.recipeScalerCore.parseFraction;
  check(parseFraction('1/2') === 0.5, "parseFraction('1/2') = 0.5");
  check(parseFraction('1 1/2') === 1.5, "parseFraction('1 1/2') = 1.5");
  check(parseFraction('0.5') === 0.5, "parseFraction('0.5') = 0.5");
  check(parseFraction('2') === 2, "parseFraction('2') = 2");
  check(parseFraction('3/4') === 0.75, "parseFraction('3/4') = 0.75");
  check(isNaN(parseFraction('')), "parseFraction('') is NaN");
  check(isNaN(parseFraction('abc')), "parseFraction('abc') is NaN");

  // Math: formatFraction
  const formatFraction = ctx.HT.recipeScalerCore.formatFraction;
  check(formatFraction(0.5) === '1/2', "formatFraction(0.5) = '1/2'");
  check(formatFraction(1.5) === '1 1/2', "formatFraction(1.5) = '1 1/2'");
  check(formatFraction(0) === '0', "formatFraction(0) = '0'");
  check(formatFraction(2) === '2', "formatFraction(2) = '2'");

  // Math: parseLine
  const parseLine = ctx.HT.recipeScalerCore.parseLine;
  const pl1 = parseLine('1/2 cup flour');
  check(pl1 !== null && pl1.qty === 0.5 && pl1.unit === 'cup' && pl1.ingredient === 'flour', "parseLine('1/2 cup flour') → qty=1/2, unit=cup, ingredient=flour");
  const pl2 = parseLine('350 °F oven');
  check(pl2 !== null && pl2.qty === 350 && pl2.unit === '°F' && pl2.ingredient === 'oven', "parseLine('350 °F oven') → qty=350, unit=°F, ingredient=oven");
  check(parseLine('salt to taste') === null, "parseLine('salt to taste') = null (no qty)");

  // Math: clampMultiplier
  const clampMultiplier = ctx.HT.recipeScalerCore.clampMultiplier;
  check(clampMultiplier(2) === 2, "clampMultiplier(2) = 2");
  check(clampMultiplier(0.05) === 0.1, "clampMultiplier(0.05) = 0.1 (clamped to MULT_MIN)");
  check(clampMultiplier(500) === 100, "clampMultiplier(500) = 100 (clamped to MULT_MAX)");
  check(clampMultiplier(NaN) === 2, "clampMultiplier(NaN) = DEFAULTS.multiplier (2)");

  // Math: tryConvert (with factors)
  const tryConvert = ctx.HT.recipeScalerCore.tryConvert;
  const cupToMl = tryConvert(1, 'cup', 'metric', FACTORS);
  check(cupToMl !== null && Math.abs(cupToMl.qty - 236.588) < 0.01 && cupToMl.unit === 'ml', "tryConvert(1, 'cup', 'metric') → ~236 ml");
  const fToC = tryConvert(350, '°F', 'metric', FACTORS);
  check(fToC !== null && Math.abs(fToC.qty - 176.6667) < 0.01 && fToC.unit === '°C', "tryConvert(350, '°F', 'metric') → ~176.67 °C");
  const cToF = tryConvert(100, '°C', 'imperial', FACTORS);
  check(cToF !== null && Math.abs(cToF.qty - 212) < 0.01 && cToF.unit === '°F', "tryConvert(100, '°C', 'imperial') → 212 °F");
  check(tryConvert(1, 'pinch', 'metric', FACTORS) === null, "tryConvert(1, 'pinch', 'metric') = null (unknown unit)");
}

// =============================================================
// II. recipe-scaler-handlers.js loads after core + binds window.recipeScalerInit
// =============================================================
console.log('--- II. recipe-scaler-handlers.js ---');
{
  const ctx = buildCtx();
  loadInto(ctx, CORE_SRC, 'recipe-scaler-core.js (for handlers)');
  check(loadInto(ctx, HANDLERS_SRC, 'recipe-scaler-handlers.js'), 'recipe-scaler-handlers.js loads without throwing');
  check(typeof ctx.window.recipeScalerInit === 'function', 'recipe-scaler-handlers.js binds window.recipeScalerInit');
}

// =============================================================
// III. recipe-scaler-handlers.js missing core — warns and no-ops
// =============================================================
console.log('--- III. recipe-scaler-handlers.js without core ---');
{
  const ctx = buildCtx();
  // No core loaded.
  check(loadInto(ctx, HANDLERS_SRC, 'recipe-scaler-handlers.js without core'), 'handlers without core does not throw');
  check(ctx.window.recipeScalerInit === null, 'handlers without core does not bind window.recipeScalerInit');
}

// =============================================================
// IV. index.html references recipe-scaler-core.js (not -scaler.js, not -handlers.js)
// =============================================================
console.log('--- IV. index.html script src ---');
{
  const html = fs.readFileSync(path.join(REPO_ROOT, 'tools/recipe-scaler/index.html'), 'utf8');
  check(/src=["']\.\/recipe-scaler-core\.js["']/.test(html), 'index.html loads recipe-scaler-core.js');
  check(!/src=["']\.\/recipe-scaler\.js["']/.test(html), 'index.html no longer loads recipe-scaler.js');
  check(!/src=["']\.\/recipe-scaler-handlers\.js["']/.test(html), 'index.html does NOT load recipe-scaler-handlers.js (lazy-only)');
}

// =============================================================
// V. lazy-loadable: HT.lazyLoadTool exists and core's boot path
//    doesn't fail when lazyLoadTool is a no-op.
// =============================================================
console.log('--- V. boot path with lazyLoadTool stub ---');
{
  const ctx = buildCtx();
  ctx.HT.lazyLoadTool = function (slug, url) {
    return Promise.resolve();
  };
  check(loadInto(ctx, CORE_SRC, 'recipe-scaler-core.js boot with lazyLoadTool stub'), 'core boot with lazyLoadTool stub OK');
}

// =============================================================
// Vacuous-pass guard
// =============================================================

if (pass === 0 && fail === 0) {
  console.error('recipe-scaler-split-smoke: VACUOUS — no assertions ran');
  process.exit(1);
}

console.log('');
console.log('recipe-scaler-split-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);
