#!/usr/bin/env node
/* Story 4b Phase 2 — bd-tax-calculator core+handlers split smoke.

   Verifies the new bd-tax-core.js + bd-tax-handlers.js pair:
     - bd-tax-core.js loads via vm sandbox without throwing
     - HT.bdTaxCore frozen handle exposes getRules/getRulesets/getDict/
       getPresets/getShareHashFields/getState/getDefaultRulesKey/getStorageKeys
     - RULESETS has both '2024-25' and '2026-27' keys
     - Default ruleset = '2026-27'
     - PRESETS has 4 keys (salaried, senior, business, investor)
     - DICT has en/bn with > 50 keys each
     - bd-tax-handlers.js loads after core and binds window.bdTaxInit
     - lazy-loadable via HT.lazyLoadTool API shape (smoke for the
       bd-tax-core.js / HT.bdTaxCore wiring)

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
const CORE_SRC = fs.readFileSync(path.join(REPO_ROOT, 'tools/bd-tax-calculator/bd-tax-core.js'), 'utf8');
const HANDLERS_SRC = fs.readFileSync(path.join(REPO_ROOT, 'tools/bd-tax-calculator/bd-tax-handlers.js'), 'utf8');

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
    window: { HT: HT, bdTaxInit: null },
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
// I. bd-tax-core.js loads + exposes HT.bdTaxCore
// =============================================================
console.log('--- I. bd-tax-core.js ---');
{
  const ctx = buildCtx();
  check(loadInto(ctx, CORE_SRC, 'bd-tax-core.js'), 'bd-tax-core.js loads without throwing');
  check(!!ctx.HT.bdTaxCore, 'HT.bdTaxCore exposed');
  check(Object.isFrozen(ctx.HT.bdTaxCore), 'HT.bdTaxCore is frozen (AD-14 internal handle)');
  check(typeof ctx.HT.bdTaxCore.getRules === 'function', 'HT.bdTaxCore.getRules is a function');
  check(typeof ctx.HT.bdTaxCore.getRulesets === 'function', 'HT.bdTaxCore.getRulesets is a function');
  check(typeof ctx.HT.bdTaxCore.getPresets === 'function', 'HT.bdTaxCore.getPresets is a function');
  check(typeof ctx.HT.bdTaxCore.getShareHashFields === 'function', 'HT.bdTaxCore.getShareHashFields is a function');
  check(typeof ctx.HT.bdTaxCore.getState === 'function', 'HT.bdTaxCore.getState is a function');
  check(typeof ctx.HT.bdTaxCore.getDefaultRulesKey === 'function', 'HT.bdTaxCore.getDefaultRulesKey is a function');
  check(typeof ctx.HT.bdTaxCore.getStorageKeys === 'function', 'HT.bdTaxCore.getStorageKeys is a function');

  const rules = ctx.HT.bdTaxCore.getRules();
  check(rules.assessmentYear === '2026-27', 'getRules() returns 2026-27 ruleset as default');
  check(rules.slabs.length === 7, 'current ruleset has 7 slabs (0% → 30%)');
  check(rules.surcharge && rules.surcharge.threshold === 5000000, 'current ruleset has surcharge threshold 5,000,000');

  const rulesets = ctx.HT.bdTaxCore.getRulesets();
  check(rulesets['2024-25'] && rulesets['2024-25'].assessmentYear === '2024-25', 'RULESETS has 2024-25');
  check(rulesets['2026-27'] && rulesets['2026-27'].assessmentYear === '2026-27', 'RULESETS has 2026-27');

  const presets = ctx.HT.bdTaxCore.getPresets();
  check(!!presets.salaried, 'PRESETS has salaried');
  check(!!presets.senior, 'PRESETS has senior');
  check(!!presets.business, 'PRESETS has business');
  check(!!presets.investor, 'PRESETS has investor');
  check(presets.salaried.fields.salaryBasic === 600000, 'salaried preset has salaryBasic=600000');

  const hashFields = ctx.HT.bdTaxCore.getShareHashFields();
  check(Array.isArray(hashFields) && hashFields.length > 25, 'SHARE_HASH_FIELDS has >25 entries');
  check(hashFields.indexOf('salaryBasic') !== -1, 'SHARE_HASH_FIELDS includes salaryBasic');
  check(hashFields.indexOf('rulesKey') !== -1, 'SHARE_HASH_FIELDS includes rulesKey');

  const dict = ctx.HT.bdTaxCore.getDict && ctx.HT.bdTaxCore.getDict();
  // DICT moved to handlers chunk in Story 4b Phase 4 to drop core
  // under the 7 KB per-tool budget. Verify the block is in handlers
  // source (the IIFE keeps it private).
  check(!dict, 'DICT is NOT exposed on core (intentional — moved to handlers)');
  check(/var DICT = \{/.test(HANDLERS_SRC), 'handlers source declares DICT block');
  check(/en: \{[\s\S]*?bn: \{/.test(HANDLERS_SRC), 'handlers DICT has en + bn');
  check((HANDLERS_SRC.match(/pageTitle: 'Bangladesh/g) || []).length >= 1, 'handlers DICT.en has pageTitle');
  check((HANDLERS_SRC.match(/pageTitle: 'বাংলাদেশ/g) || []).length >= 1, 'handlers DICT.bn has Bengali pageTitle');
  check((HANDLERS_SRC.match(/currency: '৳'/g) || []).length >= 2, 'handlers DICT has currency for both langs');

  const state = ctx.HT.bdTaxCore.getState();
  check(state && typeof state === 'object', 'getState() returns state object');
  check(state.lang === 'en' || state.lang === 'bn', 'state.lang is en or bn');
  check(state.rulesKey === '2026-27', 'state.rulesKey defaults to 2026-27');

  const keys = ctx.HT.bdTaxCore.getStorageKeys();
  check(keys.state === 'handy-tools.bd-tax-calculator.state', 'storage keys.state correct');
  check(keys.lang === 'handy-tools.bd-tax-calculator.lang', 'storage keys.lang correct');
  check(keys.rules === 'handy-tools.bd-tax-calculator.rules', 'storage keys.rules correct');

  check(ctx.HT.bdTaxCore.getDefaultRulesKey() === '2026-27', 'getDefaultRulesKey() = 2026-27');
}

// =============================================================
// II. bd-tax-handlers.js loads after core + binds window.bdTaxInit
// =============================================================
console.log('--- II. bd-tax-handlers.js ---');
{
  const ctx = buildCtx();
  loadInto(ctx, CORE_SRC, 'bd-tax-core.js (for handlers)');
  check(loadInto(ctx, HANDLERS_SRC, 'bd-tax-handlers.js'), 'bd-tax-handlers.js loads without throwing');
  check(typeof ctx.window.bdTaxInit === 'function', 'bd-tax-handlers.js binds window.bdTaxInit');
}

// =============================================================
// III. bd-tax-handlers.js missing core — warns and no-ops
// =============================================================
console.log('--- III. bd-tax-handlers.js without core ---');
{
  const ctx = buildCtx();
  // No core loaded.
  check(loadInto(ctx, HANDLERS_SRC, 'bd-tax-handlers.js without core'), 'handers without core does not throw');
  check(ctx.window.bdTaxInit === null, 'handlers without core does not bind window.bdTaxInit');
}

// =============================================================
// IV. index.html references bd-tax-core.js (not -calculator.js)
// =============================================================
console.log('--- IV. index.html script src ---');
{
  const html = fs.readFileSync(path.join(REPO_ROOT, 'tools/bd-tax-calculator/index.html'), 'utf8');
  check(/src=["']\.\/bd-tax-core\.js["']/.test(html), 'index.html loads bd-tax-core.js');
  check(!/src=["']\.\/bd-tax-calculator\.js["']/.test(html), 'index.html no longer loads bd-tax-calculator.js');
  check(!/src=["']\.\/bd-tax-handlers\.js["']/.test(html), 'index.html does NOT load bd-tax-handlers.js (lazy-only)');
}

// =============================================================
// V. lazy-loadable: HT.lazyLoadTool exists in ht-lazy.js (existing
//    smoke covers the API; here we confirm bd-tax-core is design-
//    compatible by verifying its boot path doesn't fail when
//    lazyLoadTool is a no-op).
// =============================================================
console.log('--- V. boot path with lazyLoadTool stub ---');
{
  const ctx = buildCtx();
  ctx.HT.lazyLoadTool = function (slug, url) {
    return Promise.resolve();
  };
  check(loadInto(ctx, CORE_SRC, 'bd-tax-core.js boot with lazyLoadTool stub'), 'core boot with lazyLoadTool stub OK');
}

// =============================================================
// Vacuous-pass guard
// =============================================================

if (pass === 0 && fail === 0) {
  console.error('bd-tax-split-smoke: VACUOUS — no assertions ran');
  process.exit(1);
}

console.log('');
console.log('bd-tax-split-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);
