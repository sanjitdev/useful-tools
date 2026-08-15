#!/usr/bin/env node
/* Story 4b Phase 4 — uuid-generator core+handlers split smoke.

   Verifies the new uuid-generator-core.js + ...-handlers.js pair:
     - uuid-generator-core.js loads via vm sandbox
     - HT.uuidGeneratorCore frozen handle exposes getUUIDV147Regex/
       getUlidRegex/getCrockfordAlphabet/getGenerators/
       uuidV1/uuidV4/uuidV7/ulid/isValidUuid/isValidUlid/
       variantNibble/validate/patternFor/generateOne/clampCount
     - 4 generators in GENERATORS map (v1, v4, v7, ulid)
     - uuidV4 returns valid UUID v147 format
     - ulid returns valid ULID format
     - uuid-generator-handlers.js loads after core and binds
       window.uuidGeneratorInit
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
const CORE_SRC = fs.readFileSync(path.join(REPO_ROOT, 'tools/uuid-generator/uuid-generator-core.js'), 'utf8');
const HANDLERS_SRC = fs.readFileSync(path.join(REPO_ROOT, 'tools/uuid-generator/uuid-generator-handlers.js'), 'utf8');

let pass = 0;
let fail = 0;
function check(cond, label) {
  if (cond) { pass += 1; console.log('  PASS  ' + label); }
  else      { fail += 1; console.log('  FAIL  ' + label); }
}

// =============================================================
// Minimal HT + dom stubs (with globalThis.crypto for Web Crypto)
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
    window: { HT: HT, uuidGeneratorInit: null },
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
    crypto: require('crypto').webcrypto,
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
// I. uuid-generator-core.js loads + exposes HT.uuidGeneratorCore
// =============================================================
console.log('--- I. uuid-generator-core.js ---');
{
  const ctx = buildCtx();
  check(loadInto(ctx, CORE_SRC, 'uuid-generator-core.js'), 'uuid-generator-core.js loads without throwing');
  check(!!ctx.HT.uuidGeneratorCore, 'HT.uuidGeneratorCore exposed');
  check(Object.isFrozen(ctx.HT.uuidGeneratorCore), 'HT.uuidGeneratorCore is frozen (AD-14 internal handle)');

  // Function surface
  check(typeof ctx.HT.uuidGeneratorCore.uuidV1 === 'function', 'uuidV1 is a function');
  check(typeof ctx.HT.uuidGeneratorCore.uuidV4 === 'function', 'uuidV4 is a function');
  check(typeof ctx.HT.uuidGeneratorCore.uuidV7 === 'function', 'uuidV7 is a function');
  check(typeof ctx.HT.uuidGeneratorCore.ulid === 'function', 'ulid is a function');
  check(typeof ctx.HT.uuidGeneratorCore.isValidUuid === 'function', 'isValidUuid is a function');
  check(typeof ctx.HT.uuidGeneratorCore.isValidUlid === 'function', 'isValidUlid is a function');
  check(typeof ctx.HT.uuidGeneratorCore.variantNibble === 'function', 'variantNibble is a function');
  check(typeof ctx.HT.uuidGeneratorCore.validate === 'function', 'validate is a function');
  check(typeof ctx.HT.uuidGeneratorCore.patternFor === 'function', 'patternFor is a function');
  check(typeof ctx.HT.uuidGeneratorCore.generateOne === 'function', 'generateOne is a function');
  check(typeof ctx.HT.uuidGeneratorCore.clampCount === 'function', 'clampCount is a function');

  // GENERATORS dispatch
  const GENERATORS = ctx.HT.uuidGeneratorCore.getGenerators();
  check(GENERATORS.v1 === ctx.HT.uuidGeneratorCore.uuidV1, 'GENERATORS.v1 === uuidV1');
  check(GENERATORS.v4 === ctx.HT.uuidGeneratorCore.uuidV4, 'GENERATORS.v4 === uuidV4');
  check(GENERATORS.v7 === ctx.HT.uuidGeneratorCore.uuidV7, 'GENERATORS.v7 === uuidV7');
  check(GENERATORS.ulid === ctx.HT.uuidGeneratorCore.ulid, 'GENERATORS.ulid === ulid');
  check(Object.keys(GENERATORS).length === 4, 'GENERATORS has 4 entries');

  // Regex / alphabet
  const UUID_V147_RE = ctx.HT.uuidGeneratorCore.getUUIDV147Regex();
  const ULID_RE = ctx.HT.uuidGeneratorCore.getUlidRegex();
  const CROCKFORD = ctx.HT.uuidGeneratorCore.getCrockfordAlphabet();
  check(CROCKFORD === '0123456789ABCDEFGHJKMNPQRSTVWXYZ', 'Crockford alphabet is canonical');
  check(ULID_RE.source === '^[0-9A-HJKMNP-TV-Z]{26}$', 'ULID regex source matches');

  // Generation smoke
  const v4 = ctx.HT.uuidGeneratorCore.uuidV4();
  check(typeof v4 === 'string' && v4.length === 36, 'uuidV4 returns 36-char string');
  check(UUID_V147_RE.test(v4), 'uuidV4 matches UUID v147 regex');
  check(v4[14] === '4', 'uuidV4 has version nibble "4"');
  // variantNibble reads uuid[19] (RFC 4122 variant nibble). For a v4 produced by
  // Web Crypto's randomUUID, the high two bits are 0b10, so [19] ∈ {8,9,a,b}.
  check('89ab'.indexOf(ctx.HT.uuidGeneratorCore.variantNibble(v4)) >= 0,
    'uuidV4 variant nibble ∈ {8,9,a,b}');

  const u = ctx.HT.uuidGeneratorCore.ulid();
  check(typeof u === 'string' && u.length === 26, 'ulid returns 26-char string');
  check(ULID_RE.test(u), 'ulid matches ULID regex');
  check(!/[ILOU]/.test(u), 'ulid has no Crockford-confusable chars');

  // Validate dispatch
  check(ctx.HT.uuidGeneratorCore.validate('v4', v4) === true, 'validate("v4", v4) === true');
  check(ctx.HT.uuidGeneratorCore.validate('ulid', u) === true, 'validate("ulid", u) === true');
  check(ctx.HT.uuidGeneratorCore.validate('v1', v4) === false, 'validate("v1", v4) === false (wrong version)');
  check(ctx.HT.uuidGeneratorCore.validate('v4', 'not-a-uuid') === false, 'validate("v4", "not-a-uuid") === false');

  // generateOne dispatch
  check(ctx.HT.uuidGeneratorCore.generateOne('v4') !== ctx.HT.uuidGeneratorCore.generateOne('v4'),
    'generateOne("v4") returns distinct values');
  check(ctx.HT.uuidGeneratorCore.generateOne('ulid').length === 26, 'generateOne("ulid") is 26 chars');

  // clampCount
  check(ctx.HT.uuidGeneratorCore.clampCount('5') === 5, 'clampCount("5") === 5');
  check(ctx.HT.uuidGeneratorCore.clampCount('0') === 1, 'clampCount("0") === 1 (min)');
  check(ctx.HT.uuidGeneratorCore.clampCount('200') === 100, 'clampCount("200") === 100 (max)');
  check(ctx.HT.uuidGeneratorCore.clampCount('abc') === 1, 'clampCount("abc") === 1 (NaN fallback)');
  check(ctx.HT.uuidGeneratorCore.clampCount('-3') === 1, 'clampCount("-3") === 1 (negative)');
}

// =============================================================
// II. uuid-generator-handlers.js loads after core + binds window.uuidGeneratorInit
// =============================================================
console.log('--- II. uuid-generator-handlers.js ---');
{
  const ctx = buildCtx();
  loadInto(ctx, CORE_SRC, 'uuid-generator-core.js (for handlers)');
  check(loadInto(ctx, HANDLERS_SRC, 'uuid-generator-handlers.js'), 'uuid-generator-handlers.js loads without throwing');
  check(typeof ctx.window.uuidGeneratorInit === 'function', 'uuid-generator-handlers.js binds window.uuidGeneratorInit');
}

// =============================================================
// III. uuid-generator-handlers.js missing core — warns and no-ops
// =============================================================
console.log('--- III. uuid-generator-handlers.js without core ---');
{
  const ctx = buildCtx();
  // No core loaded.
  check(loadInto(ctx, HANDLERS_SRC, 'uuid-generator-handlers.js without core'), 'handlers without core does not throw');
  check(ctx.window.uuidGeneratorInit === null, 'handlers without core does not bind window.uuidGeneratorInit');
}

// =============================================================
// IV. index.html references uuid-generator-core.js (not -generator.js, not -handlers.js)
// =============================================================
console.log('--- IV. index.html script src ---');
{
  const html = fs.readFileSync(path.join(REPO_ROOT, 'tools/uuid-generator/index.html'), 'utf8');
  check(/src=["']\.\/uuid-generator-core\.js["']/.test(html), 'index.html loads uuid-generator-core.js');
  check(!/src=["']\.\/uuid-generator\.js["']/.test(html), 'index.html no longer loads uuid-generator.js');
  check(!/src=["']\.\/uuid-generator-handlers\.js["']/.test(html), 'index.html does NOT load uuid-generator-handlers.js (lazy-only)');
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
  check(loadInto(ctx, CORE_SRC, 'uuid-generator-core.js boot with lazyLoadTool stub'), 'core boot with lazyLoadTool stub OK');
}

// =============================================================
// Vacuous-pass guard
// =============================================================

if (pass === 0 && fail === 0) {
  console.error('uuid-generator-split-smoke: VACUOUS — no assertions ran');
  process.exit(1);
}

console.log('');
console.log('uuid-generator-split-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);
