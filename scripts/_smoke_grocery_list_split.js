#!/usr/bin/env node
/* Story 4b Phase 4 — grocery-list core+handlers split smoke.

   Verifies the new grocery-list-core.js + ...-handlers.js pair:
     - grocery-list-core.js loads via vm sandbox
     - HT.groceryListCore frozen handle exposes getCategories/
       getDefaultCategory/getDebounceMs/getSampleItems/
       makeId/encodeList/decodeList/readUrlState/escapeHtml/
       isReducedMotion
     - CATEGORIES has 8 entries (Produce, Dairy, Meat, Bakery,
       Pantry, Frozen, Beverages, Other)
     - SAMPLE_ITEMS has 10 preset entries
     - encodeList/decodeList round-trip preserves unicode
     - handlers layer loads after core and binds
       window.groceryListInit
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
const CORE_SRC = fs.readFileSync(path.join(REPO_ROOT, 'tools/grocery-list/grocery-list-core.js'), 'utf8');
const HANDLERS_SRC = fs.readFileSync(path.join(REPO_ROOT, 'tools/grocery-list/grocery-list-handlers.js'), 'utf8');

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
    window: { HT: HT, groceryListInit: null },
    console: { warn: function () {}, log: function () {}, error: function () {} },
    document: {
      addEventListener: function () {},
      documentElement: { setAttribute: function () {}, getAttribute: function () { return null; } },
      readyState: 'complete',
      querySelectorAll: function () { return []; },
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    URLSearchParams: URLSearchParams,
    performance: { now: function () { return Date.now(); } },
    // btoa/atob + unescape/escape shims (encode/decode the URL state).
    btoa: function (s) { return Buffer.from(s, 'binary').toString('base64'); },
    atob: function (s) { return Buffer.from(s, 'base64').toString('binary'); },
    // window.matchMedia shim, used by isReducedMotion()
    matchMedia: function () { return { matches: false }; },
    crypto: {
      randomUUID: (function () {
        var n = 0;
        return function () { n += 1; return 'uuid-' + n; };
      })(),
    },
  };
  ctx.window.HT = HT;
  ctx.window.matchMedia = ctx.matchMedia;
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
// I. grocery-list-core.js loads + exposes HT.groceryListCore
// =============================================================
console.log('--- I. grocery-list-core.js ---');
{
  const ctx = buildCtx();
  check(loadInto(ctx, CORE_SRC, 'grocery-list-core.js'), 'grocery-list-core.js loads without throwing');
  check(!!ctx.HT.groceryListCore, 'HT.groceryListCore exposed');
  check(Object.isFrozen(ctx.HT.groceryListCore), 'HT.groceryListCore is frozen (AD-14 internal handle)');

  // Function surface
  check(typeof ctx.HT.groceryListCore.getCategories === 'function', 'getCategories is a function');
  check(typeof ctx.HT.groceryListCore.getDefaultCategory === 'function', 'getDefaultCategory is a function');
  check(typeof ctx.HT.groceryListCore.getDebounceMs === 'function', 'getDebounceMs is a function');
  check(typeof ctx.HT.groceryListCore.getSampleItems === 'function', 'getSampleItems is a function');
  check(typeof ctx.HT.groceryListCore.makeId === 'function', 'makeId is a function');
  check(typeof ctx.HT.groceryListCore.encodeList === 'function', 'encodeList is a function');
  check(typeof ctx.HT.groceryListCore.decodeList === 'function', 'decodeList is a function');
  check(typeof ctx.HT.groceryListCore.readUrlState === 'function', 'readUrlState is a function');
  check(typeof ctx.HT.groceryListCore.escapeHtml === 'function', 'escapeHtml is a function');
  check(typeof ctx.HT.groceryListCore.isReducedMotion === 'function', 'isReducedMotion is a function');

  // Constants
  const CATS = ctx.HT.groceryListCore.getCategories();
  check(CATS.length === 8, 'CATEGORIES has 8 entries');
  check(CATS.indexOf('Produce') >= 0, 'CATEGORIES includes Produce');
  check(CATS.indexOf('Dairy') >= 0, 'CATEGORIES includes Dairy');
  check(CATS.indexOf('Meat') >= 0, 'CATEGORIES includes Meat');
  check(CATS.indexOf('Bakery') >= 0, 'CATEGORIES includes Bakery');
  check(CATS.indexOf('Pantry') >= 0, 'CATEGORIES includes Pantry');
  check(CATS.indexOf('Frozen') >= 0, 'CATEGORIES includes Frozen');
  check(CATS.indexOf('Beverages') >= 0, 'CATEGORIES includes Beverages');
  check(CATS.indexOf('Other') >= 0, 'CATEGORIES includes Other');

  check(ctx.HT.groceryListCore.getDefaultCategory() === 'Other', 'DEFAULT_CATEGORY = "Other"');
  check(ctx.HT.groceryListCore.getDebounceMs() === 150, 'DEBOUNCE_MS = 150');

  // Sample items
  const SAMPLE = ctx.HT.groceryListCore.getSampleItems();
  check(SAMPLE.length === 10, 'SAMPLE_ITEMS has 10 entries');
  check(SAMPLE[0].name === 'Bananas', 'SAMPLE_ITEMS[0] is Bananas');
  check(SAMPLE.every(function (it) {
    return typeof it.name === 'string' && typeof it.category === 'string' && CATS.indexOf(it.category) >= 0;
  }), 'SAMPLE_ITEMS all have valid name + category');

  // makeId
  const id1 = ctx.HT.groceryListCore.makeId();
  const id2 = ctx.HT.groceryListCore.makeId();
  check(typeof id1 === 'string' && id1.length > 0, 'makeId returns non-empty string');
  check(id1 !== id2, 'two makeId calls return distinct values');

  // encodeList / decodeList round-trip
  const items = [
    { id: 'a1', name: 'Apple', category: 'Produce', checked: false },
    { id: 'b2', name: 'Café au lait', category: 'Beverages', checked: true },
  ];
  const b64 = ctx.HT.groceryListCore.encodeList(items);
  check(typeof b64 === 'string' && b64.length > 0, 'encodeList returns non-empty base64');
  const decoded = ctx.HT.groceryListCore.decodeList(b64);
  check(decoded.length === 2, 'decodeList returns 2 items');
  check(decoded[0].name === 'Apple' && decoded[0].category === 'Produce', 'decodeList preserves ASCII name + category');
  check(decoded[1].name === 'Café au lait', 'decodeList preserves unicode (Café au lait)');
  check(decoded[1].checked === true, 'decodeList preserves checked flag');

  // decodeList filters invalid categories
  const filtered = ctx.HT.groceryListCore.decodeList(
    btoa(unescape(encodeURIComponent(JSON.stringify({ items: [
      { name: 'Valid', category: 'Produce' },
      { name: 'Bogus', category: 'INVALID' },
    ] }))))
  );
  check(filtered.length === 1 && filtered[0].name === 'Valid', 'decodeList filters items with invalid category');

  // decodeList rejects malformed JSON
  const empty = ctx.HT.groceryListCore.decodeList('@@@');
  check(Array.isArray(empty) && empty.length === 0, 'decodeList returns [] on malformed b64');

  // readUrlState
  const v1 = ctx.HT.groceryListCore.readUrlState('?list=eyJpdGVtc');
  check(v1 === 'eyJpdGVtc', 'readUrlState("?list=eyJpdGVtc") returns "eyJpdGVtc"');
  const v2 = ctx.HT.groceryListCore.readUrlState('');
  check(v2 === null, 'readUrlState("") returns null');

  // escapeHtml
  check(ctx.HT.groceryListCore.escapeHtml('<a href="b">') === '&lt;a href=&quot;b&quot;&gt;',
    'escapeHtml escapes <, >, and quotes');

  // isReducedMotion
  check(ctx.HT.groceryListCore.isReducedMotion() === false, 'isReducedMotion returns false when no preference set');
}

// =============================================================
// II. grocery-list-handlers.js loads after core + binds window.groceryListInit
// =============================================================
console.log('--- II. grocery-list-handlers.js ---');
{
  const ctx = buildCtx();
  loadInto(ctx, CORE_SRC, 'grocery-list-core.js (for handlers)');
  check(loadInto(ctx, HANDLERS_SRC, 'grocery-list-handlers.js'), 'grocery-list-handlers.js loads without throwing');
  check(typeof ctx.window.groceryListInit === 'function', 'grocery-list-handlers.js binds window.groceryListInit');
}

// =============================================================
// III. grocery-list-handlers.js missing core — warns and no-ops
// =============================================================
console.log('--- III. grocery-list-handlers.js without core ---');
{
  const ctx = buildCtx();
  check(loadInto(ctx, HANDLERS_SRC, 'grocery-list-handlers.js without core'), 'handlers without core does not throw');
  check(ctx.window.groceryListInit === null, 'handlers without core does not bind window.groceryListInit');
}

// =============================================================
// IV. index.html references grocery-list-core.js (not -list.js, not -handlers.js)
// =============================================================
console.log('--- IV. index.html script src ---');
{
  const html = fs.readFileSync(path.join(REPO_ROOT, 'tools/grocery-list/index.html'), 'utf8');
  check(/src=["']\.\/grocery-list-core\.js["']/.test(html), 'index.html loads grocery-list-core.js');
  check(!/src=["']\.\/grocery-list\.js["']/.test(html), 'index.html no longer loads grocery-list.js');
  check(!/src=["']\.\/grocery-list-handlers\.js["']/.test(html), 'index.html does NOT load grocery-list-handlers.js (lazy-only)');
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
  check(loadInto(ctx, CORE_SRC, 'grocery-list-core.js boot with lazyLoadTool stub'), 'core boot with lazyLoadTool stub OK');
}

// =============================================================
// Vacuous-pass guard
// =============================================================

if (pass === 0 && fail === 0) {
  console.error('grocery-list-split-smoke: VACUOUS — no assertions ran');
  process.exit(1);
}

console.log('');
console.log('grocery-list-split-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);
