#!/usr/bin/env node
/* Story 4b Phase 4 — json-formatter core+handlers split smoke.

   Verifies the new json-formatter-core.js + ...-handlers.js pair:
     - json-formatter-core.js loads via vm sandbox
     - HT.jsonFormatterCore frozen handle exposes getDefaultInput/
       getAllowedFeatures/escapeHtml/lineColumnOfError/parseSafe/
       sortKeysRecursive/readFeatures
     - sortKeysRecursive handles nested objects and arrays
     - lineColumnOfError parses JSON parse errors
     - readFeatures filters by the 3 allowed features (sort, schema, diff)
     - json-formatter-handlers.js loads after core and binds
       window.jsonFormatterInit
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
const CORE_SRC = fs.readFileSync(path.join(REPO_ROOT, 'tools/json-formatter/json-formatter-core.js'), 'utf8');
const HANDLERS_SRC = fs.readFileSync(path.join(REPO_ROOT, 'tools/json-formatter/json-formatter-handlers.js'), 'utf8');

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
    qs: function () { return null; },
    debounce: function (fn) { return fn; },
    formatNumber: function (n) { return String(n); },
    formatDate: function (d) { return d.toISOString(); },
    copyToClipboard: function () { return Promise.resolve(); },
    toast: function () {},
    share: { print: function () {} },
    diff: {
      myersDiff: function () { return []; },
      splitLines: function (s) { return s.split('\n'); },
    },
    jsonSchema: { validate: function () { return { valid: true, errors: [] }; } },
    lazyLoadTool: function () { return Promise.resolve(); },
    history: { push: function () {} },
  };
  const ctx = {
    HT: HT,
    window: { HT: HT, jsonFormatterInit: null },
    console: { warn: function () {}, log: function () {}, error: function () {} },
    document: {
      addEventListener: function () {},
      documentElement: { setAttribute: function () {} },
      readyState: 'complete',
      querySelectorAll: function () { return []; },
      createElement: function () { return { setAttribute: function () {}, addEventListener: function () {} }; },
      createDocumentFragment: function () { return { appendChild: function () {} }; },
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    URLSearchParams: URLSearchParams,
    performance: { now: function () { return Date.now(); } },
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
// I. json-formatter-core.js loads + exposes HT.jsonFormatterCore
// =============================================================
console.log('--- I. json-formatter-core.js ---');
{
  const ctx = buildCtx();
  check(loadInto(ctx, CORE_SRC, 'json-formatter-core.js'), 'json-formatter-core.js loads without throwing');
  check(!!ctx.HT.jsonFormatterCore, 'HT.jsonFormatterCore exposed');
  check(Object.isFrozen(ctx.HT.jsonFormatterCore), 'HT.jsonFormatterCore is frozen (AD-14 internal handle)');

  // Function surface
  check(typeof ctx.HT.jsonFormatterCore.getDefaultInput === 'function', 'getDefaultInput is a function');
  check(typeof ctx.HT.jsonFormatterCore.getAllowedFeatures === 'function', 'getAllowedFeatures is a function');
  check(typeof ctx.HT.jsonFormatterCore.escapeHtml === 'function', 'escapeHtml is a function');
  check(typeof ctx.HT.jsonFormatterCore.lineColumnOfError === 'function', 'lineColumnOfError is a function');
  check(typeof ctx.HT.jsonFormatterCore.parseSafe === 'function', 'parseSafe is a function');
  check(typeof ctx.HT.jsonFormatterCore.sortKeysRecursive === 'function', 'sortKeysRecursive is a function');
  check(typeof ctx.HT.jsonFormatterCore.readFeatures === 'function', 'readFeatures is a function');

  // Default input — well-formed JSON
  const DEFAULT = ctx.HT.jsonFormatterCore.getDefaultInput();
  let parsedDefault = null;
  try { parsedDefault = JSON.parse(DEFAULT); } catch (_) {}
  check(parsedDefault && parsedDefault.name === 'Handy Tools', 'getDefaultInput is well-formed JSON with name "Handy Tools"');

  // Allowed features
  const allowed = ctx.HT.jsonFormatterCore.getAllowedFeatures();
  check(allowed.sort === 1, 'allowed.sort = 1');
  check(allowed.schema === 1, 'allowed.schema = 1');
  check(allowed.diff === 1, 'allowed.diff = 1');
  check(Object.keys(allowed).length === 3, 'allowed has 3 entries');

  // escapeHtml
  check(ctx.HT.jsonFormatterCore.escapeHtml('<a>') === '&lt;a&gt;', 'escapeHtml("<a>") escapes < and >');
  check(ctx.HT.jsonFormatterCore.escapeHtml('a&b') === 'a&amp;b', 'escapeHtml("a&b") escapes &');
  check(ctx.HT.jsonFormatterCore.escapeHtml('"x"') === '&quot;x&quot;', 'escapeHtml("\"x\"") escapes quotes');
  check(ctx.HT.jsonFormatterCore.escapeHtml("'x'") === '&#39;x&#39;', "escapeHtml(\"'x'\") escapes single quotes");

  // lineColumnOfError
  const lc1 = ctx.HT.jsonFormatterCore.lineColumnOfError('{ bad }', new Error('Unexpected token b at line 1 column 3'));
  check(/line\s+1.*column\s+3/.test(lc1), 'lineColumnOfError parses "line X column Y" → ' + lc1);

  // parseSafe
  const ps1 = ctx.HT.jsonFormatterCore.parseSafe('{"a":1}');
  check(ps1.ok === true && ps1.parsed.a === 1, 'parseSafe returns ok for valid JSON');
  const ps2 = ctx.HT.jsonFormatterCore.parseSafe('{ bad }');
  check(ps2.ok === false && typeof ps2.error === 'string', 'parseSafe returns ok=false for invalid JSON');

  // sortKeysRecursive
  const sorted = ctx.HT.jsonFormatterCore.sortKeysRecursive({ b: 1, a: { d: 3, c: 2, a: [ { y: 1, x: 2 } ] } });
  const sortedKeys = Object.keys(sorted);
  check(sortedKeys[0] === 'a' && sortedKeys[1] === 'b', 'sortKeysRecursive sorts top-level keys');
  const deepKeys = Object.keys(sorted.a);
  check(deepKeys[0] === 'a' && deepKeys[1] === 'c' && deepKeys[2] === 'd', 'sortKeysRecursive sorts nested keys');
  const arrKeys = Object.keys(sorted.a.a[0]);
  check(arrKeys[0] === 'x' && arrKeys[1] === 'y', 'sortKeysRecursive sorts keys inside objects within arrays');
  // Purity: input unchanged
  // (sortKeysRecursive returns a new object — input identity preserved.)
  const original = { b: 1, a: { c: 2 } };
  ctx.HT.jsonFormatterCore.sortKeysRecursive(original);
  check(Object.keys(original)[0] === 'b', 'sortKeysRecursive does not mutate input');

  // readFeatures
  check(JSON.stringify(ctx.HT.jsonFormatterCore.readFeatures('?feature=sort')) === '["sort"]',
    'readFeatures("?feature=sort") = ["sort"]');
  check(JSON.stringify(ctx.HT.jsonFormatterCore.readFeatures('?feature=sort,schema,diff')) === '["sort","schema","diff"]',
    'readFeatures("?feature=sort,schema,diff") = ["sort","schema","diff"]');
  check(JSON.stringify(ctx.HT.jsonFormatterCore.readFeatures('?feature=foo,sort'))
    === '["sort"]',
    'readFeatures ignores unknown features');
  check(JSON.stringify(ctx.HT.jsonFormatterCore.readFeatures('')) === '[]',
    'readFeatures("") = []');
  check(JSON.stringify(ctx.HT.jsonFormatterCore.readFeatures(undefined)) === '[]',
    'readFeatures(undefined) = []');
}

// =============================================================
// II. json-formatter-handlers.js loads after core + binds window.jsonFormatterInit
// =============================================================
console.log('--- II. json-formatter-handlers.js ---');
{
  const ctx = buildCtx();
  loadInto(ctx, CORE_SRC, 'json-formatter-core.js (for handlers)');
  check(loadInto(ctx, HANDLERS_SRC, 'json-formatter-handlers.js'), 'json-formatter-handlers.js loads without throwing');
  check(typeof ctx.window.jsonFormatterInit === 'function', 'json-formatter-handlers.js binds window.jsonFormatterInit');
}

// =============================================================
// III. json-formatter-handlers.js missing core — warns and no-ops
// =============================================================
console.log('--- III. json-formatter-handlers.js without core ---');
{
  const ctx = buildCtx();
  check(loadInto(ctx, HANDLERS_SRC, 'json-formatter-handlers.js without core'), 'handlers without core does not throw');
  check(ctx.window.jsonFormatterInit === null, 'handlers without core does not bind window.jsonFormatterInit');
}

// =============================================================
// IV. index.html references json-formatter-core.js (not -formatter.js, not -handlers.js)
// =============================================================
console.log('--- IV. index.html script src ---');
{
  const html = fs.readFileSync(path.join(REPO_ROOT, 'tools/json-formatter/index.html'), 'utf8');
  check(/src=["']\.\/json-formatter-core\.js["']/.test(html), 'index.html loads json-formatter-core.js');
  check(!/src=["']\.\/json-formatter\.js["']/.test(html), 'index.html no longer loads json-formatter.js');
  check(!/src=["']\.\/json-formatter-handlers\.js["']/.test(html), 'index.html does NOT load json-formatter-handlers.js (lazy-only)');
  // Vendor still eager
  check(/src=["']\.\.\/\.\.\/assets\/js\/diff\.js["']/.test(html), 'index.html still loads diff.js');
  check(/src=["']\.\.\/\.\.\/assets\/js\/json-schema-lite\.js["']/.test(html), 'index.html still loads json-schema-lite.js');
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
  check(loadInto(ctx, CORE_SRC, 'json-formatter-core.js boot with lazyLoadTool stub'), 'core boot with lazyLoadTool stub OK');
}

// =============================================================
// Vacuous-pass guard
// =============================================================

if (pass === 0 && fail === 0) {
  console.error('json-formatter-split-smoke: VACUOUS — no assertions ran');
  process.exit(1);
}

console.log('');
console.log('json-formatter-split-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);
