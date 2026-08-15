#!/usr/bin/env node
/* Story 4b Phase 3 — jwt-inspector core+handlers split smoke.

   Verifies the new jwt-inspector-core.js + jwt-inspector-handlers.js
   pair:
     - jwt-inspector-core.js loads via vm sandbox without throwing
     - HT.jwtInspectorCore frozen handle exposes getSupportedAlgs
     - SUPPORTED_ALGS = ['hs256', 'rs256', 'es256']
     - jwt-inspector-handlers.js loads after core (and after
       assets/js/jwt-codec.js stub) and binds window.jwtInspectorInit
     - lazy-loadable via HT.lazyLoadTool API shape

   Pure-Node smoke (no jsdom / playwright). Runs in a vm sandbox with
   minimal HT + dom + HT.jwt stubs.

   Exit codes:
     0 — all assertions PASS
     1 — at least one assertion failed
*/

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const CORE_SRC = fs.readFileSync(path.join(REPO_ROOT, 'tools/jwt-inspector/jwt-inspector-core.js'), 'utf8');
const HANDLERS_SRC = fs.readFileSync(path.join(REPO_ROOT, 'tools/jwt-inspector/jwt-inspector-handlers.js'), 'utf8');

let pass = 0;
let fail = 0;
function check(cond, label) {
  if (cond) { pass += 1; console.log('  PASS  ' + label); }
  else      { fail += 1; console.log('  FAIL  ' + label); }
}

// =============================================================
// Minimal HT + dom + HT.jwt stubs (HT.jwt comes from
// assets/js/jwt-codec.js, the eager vendor).
// =============================================================

function buildCtx(includeJwt) {
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
  if (includeJwt) {
    // Minimal stub of HT.jwt (full impl lives in assets/js/jwt-codec.js).
    HT.jwt = {
      decodeJwt: function (token) {
        return {
          header: { raw: '', parsed: { alg: 'HS256' } },
          payload: { raw: '', parsed: { sub: 'test' } },
        };
      },
      base64urlDecode: function (s) { return new Uint8Array(0); },
      getAlg: function (decoded) { return 'hs256'; },
    };
  }
  const ctx = {
    HT: HT,
    window: { HT: HT, jwtInspectorInit: null },
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
    TextEncoder: TextEncoder,
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
// I. jwt-inspector-core.js loads + exposes HT.jwtInspectorCore
// =============================================================
console.log('--- I. jwt-inspector-core.js ---');
{
  const ctx = buildCtx(false);
  check(loadInto(ctx, CORE_SRC, 'jwt-inspector-core.js'), 'jwt-inspector-core.js loads without throwing');
  check(!!ctx.HT.jwtInspectorCore, 'HT.jwtInspectorCore exposed');
  check(Object.isFrozen(ctx.HT.jwtInspectorCore), 'HT.jwtInspectorCore is frozen (AD-14 internal handle)');
  check(typeof ctx.HT.jwtInspectorCore.getSupportedAlgs === 'function', 'getSupportedAlgs is a function');

  const algs = ctx.HT.jwtInspectorCore.getSupportedAlgs();
  check(Array.isArray(algs), 'getSupportedAlgs returns array');
  check(algs.length === 3, 'SUPPORTED_ALGS has 3 entries');
  check(algs.indexOf('hs256') !== -1, 'SUPPORTED_ALGS includes hs256');
  check(algs.indexOf('rs256') !== -1, 'SUPPORTED_ALGS includes rs256');
  check(algs.indexOf('es256') !== -1, 'SUPPORTED_ALGS includes es256');
}

// =============================================================
// II. jwt-inspector-handlers.js loads after core (and after
//     HT.jwt stub) and binds window.jwtInspectorInit
// =============================================================
console.log('--- II. jwt-inspector-handlers.js ---');
{
  const ctx = buildCtx(true);
  loadInto(ctx, CORE_SRC, 'jwt-inspector-core.js (for handlers)');
  check(loadInto(ctx, HANDLERS_SRC, 'jwt-inspector-handlers.js'), 'jwt-inspector-handlers.js loads without throwing');
  check(typeof ctx.window.jwtInspectorInit === 'function', 'jwt-inspector-handlers.js binds window.jwtInspectorInit');
}

// =============================================================
// III. jwt-inspector-handlers.js missing HT.jwt — warns and no-ops
// =============================================================
console.log('--- III. jwt-inspector-handlers.js without HT.jwt ---');
{
  const ctx = buildCtx(false);
  loadInto(ctx, CORE_SRC, 'jwt-inspector-core.js (for handlers)');
  check(loadInto(ctx, HANDLERS_SRC, 'jwt-inspector-handlers.js without HT.jwt'), 'handlers without HT.jwt does not throw');
  check(ctx.window.jwtInspectorInit === null, 'handlers without HT.jwt does not bind window.jwtInspectorInit');
}

// =============================================================
// IV. index.html references jwt-inspector-core.js (not -inspector.js, not -handlers.js)
// =============================================================
console.log('--- IV. index.html script src ---');
{
  const html = fs.readFileSync(path.join(REPO_ROOT, 'tools/jwt-inspector/index.html'), 'utf8');
  check(/src=["']\.\/jwt-inspector-core\.js["']/.test(html), 'index.html loads jwt-inspector-core.js');
  check(!/src=["']\.\/jwt-inspector\.js["']/.test(html), 'index.html no longer loads jwt-inspector.js');
  check(!/src=["']\.\/jwt-inspector-handlers\.js["']/.test(html), 'index.html does NOT load jwt-inspector-handlers.js (lazy-only)');
  // Vendor stays eager.
  check(/src=["'][^"']*assets\/js\/jwt-codec\.js["']/.test(html), 'index.html still loads assets/js/jwt-codec.js (eager vendor)');
}

// =============================================================
// V. lazy-loadable: HT.lazyLoadTool exists and core's boot path
//    doesn't fail when lazyLoadTool is a no-op.
// =============================================================
console.log('--- V. boot path with lazyLoadTool stub ---');
{
  const ctx = buildCtx(false);
  ctx.HT.lazyLoadTool = function (slug, url) {
    return Promise.resolve();
  };
  check(loadInto(ctx, CORE_SRC, 'jwt-inspector-core.js boot with lazyLoadTool stub'), 'core boot with lazyLoadTool stub OK');
}

// =============================================================
// Vacuous-pass guard
// =============================================================

if (pass === 0 && fail === 0) {
  console.error('jwt-inspector-split-smoke: VACUOUS — no assertions ran');
  process.exit(1);
}

console.log('');
console.log('jwt-inspector-split-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);
