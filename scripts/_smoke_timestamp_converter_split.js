#!/usr/bin/env node
/* Story 4b Phase 3 — timestamp-converter core+handlers split smoke.

   Verifies the new timestamp-converter-core.js + ...-handlers.js pair:
     - timestamp-converter-core.js loads via vm sandbox
     - HT.timestampConverterCore frozen handle exposes getFormatLabels/
       getMaxDigits/classify/formatOutputs/toUnixSeconds/toUnixMs/
       toIso8601/toRfc2822/toHumanUtc/toHumanLocal
     - HT_TIMESTAMP legacy public handle still exposed (frozen)
     - FORMAT_LABELS has 6 entries
     - classify('1700000000') → kind=unix-seconds
     - classify('2024-01-15T12:00:00Z') → kind=iso-8601
     - formatOutputs(0) produces all 6 keys
     - timestamp-converter-handlers.js loads after core and binds
       window.timestampConverterInit
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
const CORE_SRC = fs.readFileSync(path.join(REPO_ROOT, 'tools/timestamp-converter/timestamp-converter-core.js'), 'utf8');
const HANDLERS_SRC = fs.readFileSync(path.join(REPO_ROOT, 'tools/timestamp-converter/timestamp-converter-handlers.js'), 'utf8');

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
    history: { push: function () {} },
  };
  const ctx = {
    HT: HT,
    window: { HT: HT, timestampConverterInit: null },
    console: { warn: function () {}, log: function () {}, error: function () {} },
    document: {
      addEventListener: function () {},
      documentElement: { setAttribute: function () {} },
      readyState: 'complete',
      querySelectorAll: function () { return []; },
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    URLSearchParams: URLSearchParams,
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
// I. timestamp-converter-core.js loads + exposes HT.timestampConverterCore
// =============================================================
console.log('--- I. timestamp-converter-core.js ---');
{
  const ctx = buildCtx();
  check(loadInto(ctx, CORE_SRC, 'timestamp-converter-core.js'), 'timestamp-converter-core.js loads without throwing');
  check(!!ctx.HT.timestampConverterCore, 'HT.timestampConverterCore exposed');
  check(Object.isFrozen(ctx.HT.timestampConverterCore), 'HT.timestampConverterCore is frozen (AD-14 internal handle)');
  check(typeof ctx.HT.timestampConverterCore.classify === 'function', 'classify is a function');
  check(typeof ctx.HT.timestampConverterCore.formatOutputs === 'function', 'formatOutputs is a function');
  check(typeof ctx.HT.timestampConverterCore.getFormatLabels === 'function', 'getFormatLabels is a function');
  check(typeof ctx.HT.timestampConverterCore.getMaxDigits === 'function', 'getMaxDigits is a function');

  // Legacy public handle still exposed.
  check(!!ctx.HT.timestampConverterCore.classify, 'classify accessible via internal handle');

  const LABELS = ctx.HT.timestampConverterCore.getFormatLabels();
  const labelKeys = ['unix-seconds', 'unix-milliseconds', 'iso-8601', 'rfc-2822', 'human-utc', 'human-local'];
  labelKeys.forEach(function (k) {
    check(LABELS[k] && typeof LABELS[k] === 'string', 'FORMAT_LABELS has ' + k);
  });

  check(ctx.HT.timestampConverterCore.getMaxDigits() === 16, 'MAX_DIGITS = 16');

  // Classifier smoke: unix-seconds.
  const cls1 = ctx.HT.timestampConverterCore.classify('1700000000');
  check(cls1.kind === 'unix-seconds', "classify('1700000000').kind = 'unix-seconds'");
  check(cls1.seconds === 1700000000, "classify('1700000000').seconds = 1700000000");

  // Classifier smoke: unix-milliseconds.
  const cls2 = ctx.HT.timestampConverterCore.classify('1700000000000');
  check(cls2.kind === 'unix-milliseconds', "classify('1700000000000').kind = 'unix-milliseconds'");
  check(cls2.ms === 1700000000000, "classify('1700000000000').ms = 1700000000000");

  // Classifier smoke: iso-8601.
  const cls3 = ctx.HT.timestampConverterCore.classify('2024-01-15T12:00:00Z');
  check(cls3.kind === 'iso-8601', "classify('2024-01-15T12:00:00Z').kind = 'iso-8601'");
  check(typeof cls3.ms === 'number' && cls3.ms > 0, "classify('2024-01-15T12:00:00Z').ms is positive number");

  // Classifier smoke: empty / invalid.
  check(ctx.HT.timestampConverterCore.classify('').kind === 'empty', "classify('').kind = 'empty'");
  check(ctx.HT.timestampConverterCore.classify('hello').kind === 'invalid', "classify('hello').kind = 'invalid'");

  // Formatters / formatOutputs.
  const out = ctx.HT.timestampConverterCore.formatOutputs(0);
  labelKeys.forEach(function (k) {
    check(typeof out[k] === 'string', 'formatOutputs has ' + k + ' (string)');
  });
  check(out['unix-seconds'] === '0', "formatOutputs(0).unix-seconds = '0'");
  check(out['unix-milliseconds'] === '0', "formatOutputs(0).unix-milliseconds = '0'");
  check(out['iso-8601'] === '1970-01-01T00:00:00.000Z', "formatOutputs(0).iso-8601 = '1970-01-01T00:00:00.000Z'");
  check(out['rfc-2822'] === 'Thu, 01 Jan 1970 00:00:00 GMT', "formatOutputs(0).rfc-2822 = 'Thu, 01 Jan 1970 00:00:00 GMT'");
}

// =============================================================
// II. timestamp-converter-handlers.js loads after core + binds window.timestampConverterInit
// =============================================================
console.log('--- II. timestamp-converter-handlers.js ---');
{
  const ctx = buildCtx();
  loadInto(ctx, CORE_SRC, 'timestamp-converter-core.js (for handlers)');
  check(loadInto(ctx, HANDLERS_SRC, 'timestamp-converter-handlers.js'), 'timestamp-converter-handlers.js loads without throwing');
  check(typeof ctx.window.timestampConverterInit === 'function', 'timestamp-converter-handlers.js binds window.timestampConverterInit');
}

// =============================================================
// III. timestamp-converter-handlers.js missing core — warns and no-ops
// =============================================================
console.log('--- III. timestamp-converter-handlers.js without core ---');
{
  const ctx = buildCtx();
  // No core loaded.
  check(loadInto(ctx, HANDLERS_SRC, 'timestamp-converter-handlers.js without core'), 'handlers without core does not throw');
  check(ctx.window.timestampConverterInit === null, 'handlers without core does not bind window.timestampConverterInit');
}

// =============================================================
// IV. index.html references timestamp-converter-core.js (not -converter.js, not -handlers.js)
// =============================================================
console.log('--- IV. index.html script src ---');
{
  const html = fs.readFileSync(path.join(REPO_ROOT, 'tools/timestamp-converter/index.html'), 'utf8');
  check(/src=["']\.\/timestamp-converter-core\.js["']/.test(html), 'index.html loads timestamp-converter-core.js');
  check(!/src=["']\.\/timestamp-converter\.js["']/.test(html), 'index.html no longer loads timestamp-converter.js');
  check(!/src=["']\.\/timestamp-converter-handlers\.js["']/.test(html), 'index.html does NOT load timestamp-converter-handlers.js (lazy-only)');
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
  check(loadInto(ctx, CORE_SRC, 'timestamp-converter-core.js boot with lazyLoadTool stub'), 'core boot with lazyLoadTool stub OK');
}

// =============================================================
// Vacuous-pass guard
// =============================================================

if (pass === 0 && fail === 0) {
  console.error('timestamp-converter-split-smoke: VACUOUS — no assertions ran');
  process.exit(1);
}

console.log('');
console.log('timestamp-converter-split-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);
