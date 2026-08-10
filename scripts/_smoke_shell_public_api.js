'use strict';
/* Smoke harness for the Story 1.14 additions to assets/js/shell.js.
 *
 * Loads shell.js in a fresh vm context with a stub document so the IIFE
 * can finish without erroring, then asserts every public surface of
 * HT.provide / HT.use / HT.net / HT.provideRegistry / HT.netRegistry.
 * Mirrors the shape of _smoke_site_config.js.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const src = fs.readFileSync(
  path.resolve(__dirname, '../assets/js/shell.js'),
  'utf8'
);

const stubDocument = {
  readyState: 'complete',
  documentElement: {
    getAttribute: () => 'light',
    setAttribute: () => {},
    addEventListener: () => {},
  },
  addEventListener: () => {},
  querySelectorAll: () => [],
  getElementById: () => null,
};

const ctx = {
  window: {},
  document: stubDocument,
  console,
  performance: { now: () => Date.now() },
  setTimeout: (fn, ms) => { /* no-op in smoke harness */ return 0; },
  clearTimeout: () => {},
  AbortController,
  fetch: () => Promise.resolve({ ok: true }),
  matchMedia: () => ({ matches: false, addEventListener: () => {}, addListener: () => {} }),
  URLSearchParams,
  MutationObserver: class { observe() {} disconnect() {} },
  navigator: { clipboard: undefined },
};

vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'shell.js' });

const HT = ctx.window.HT;
let pass = 0, fail = 0;
function check(name, ok, info) {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (info ? ' — ' + info : '')); }
}

check('HT.provide is function', typeof HT.provide === 'function');
check('HT.use is function', typeof HT.use === 'function');
check('HT.net exists', typeof HT.net === 'object');
check('HT.net.get is function', typeof HT.net.get === 'function');
check('HT.net.head is function', typeof HT.net.head === 'function');
check('HT.net.abort is function', typeof HT.net.abort === 'function');
check('HT.provide frozen', Object.isFrozen(HT.provide));
check('HT.use frozen', Object.isFrozen(HT.use));
check('HT.net frozen', Object.isFrozen(HT.net));

// Behavioral: register+use round-trip.
let regOk = true;
try { HT.provide('test-slug', { foo: 1 }); }
catch (e) { regOk = false; console.error(e); }
check('HT.provide(valid slug, object) ok', regOk);
const useResult = HT.use('test-slug');
check('HT.use(test-slug) returns the api', useResult && useResult.foo === 1);
check('HT.use(unknown-slug) returns null', HT.use('does-not-exist') === null);

// Validation: bad slug throws.
let badSlugThrew = false;
try { HT.provide('BadSlug', {}); } catch (e) { badSlugThrew = true; }
check('HT.provide(invalid slug) throws', badSlugThrew);

let nullApiThrew = false;
try { HT.provide('valid-slug', null); } catch (e) { nullApiThrew = true; }
check('HT.provide(null api) throws', nullApiThrew);

let dupThrew = false;
try { HT.provide('test-slug', { foo: 2 }); } catch (e) { dupThrew = true; }
check('HT.provide(duplicate slug) throws', dupThrew);

// Internal registry surfaces.
check('HT.provideRegistry.list is function', typeof HT.provideRegistry.list === 'function');
check('HT.provideRegistry.list() includes test-slug', HT.provideRegistry.list().indexOf('test-slug') !== -1);
check('HT.netRegistry.inflight is function', typeof HT.netRegistry.inflight === 'function');
check('HT.netRegistry.inflight() returns array', Array.isArray(HT.netRegistry.inflight()));

// Frozen touch: the provide function itself is frozen by
// Object.freeze(provide). Property-level mutation via `HT.provide =
// ...` only works if the parent (HT) is frozen, which it isn't — so
// the strong claim we can make is that the function reference is
// the same before/after a no-op assignment attempt. We confirm by
// calling HT.provide and checking the validation rule fires.
let mutationTook = false;
try { HT.provide = function () { return 'overwritten'; }; } catch (e) { /* strict */ }
// Even if the assignment took, the frozen function reference is
// gone — but the contract surface is the function itself, not the
// property. The simplest durable check is: call HT.provide with a
// bad slug and verify it still throws the validation error from
// the original function (not 'overwritten').
let stillOriginal = false;
try { HT.provide('BadSlug', {}); }
catch (e) { stillOriginal = /invalid slug|kebab-case/.test(String(e.message)); }
check('HT.provide is the original function (still validates)', stillOriginal);

console.log('');
console.log('passed: ' + pass + ', failed: ' + fail);

// Vacuous-pass guard.
if (pass === 0 && fail === 0) {
  console.error('smoke: vacuous run — zero assertions executed');
  process.exit(1);
}
process.exit(fail === 0 ? 0 : 1);
