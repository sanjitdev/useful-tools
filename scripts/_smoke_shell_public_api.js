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

check('HT.provide exists', typeof HT.provide === 'object' && typeof HT.provide.register === 'function');
check('HT.use exists', typeof HT.use === 'object' && typeof HT.use.get === 'function');
check('HT.net exists', typeof HT.net === 'object');
check('HT.net.get is function', typeof HT.net.get === 'function');
check('HT.net.head is function', typeof HT.net.head === 'function');
check('HT.net.abort is function', typeof HT.net.abort === 'function');
check('HT.provide frozen', Object.isFrozen(HT.provide));
check('HT.use frozen', Object.isFrozen(HT.use));
check('HT.net frozen', Object.isFrozen(HT.net));

// Behavioral: register+use round-trip.
let regOk = true;
try { HT.provide.register('test-slug', { foo: 1 }); }
catch (e) { regOk = false; console.error(e); }
check('HT.provide.register(valid slug, object) ok', regOk);
check('HT.use.get(test-slug) returns the api', HT.use.get('test-slug') && HT.use.get('test-slug').foo === 1);
check('HT.use.get(unknown-slug) returns null', HT.use.get('does-not-exist') === null);

// Validation: bad slug throws.
let badSlugThrew = false;
try { HT.provide.register('BadSlug', {}); } catch (e) { badSlugThrew = true; }
check('HT.provide.register(invalid slug) throws', badSlugThrew);

let nullApiThrew = false;
try { HT.provide.register('valid-slug', null); } catch (e) { nullApiThrew = true; }
check('HT.provide.register(null api) throws', nullApiThrew);

let dupThrew = false;
try { HT.provide.register('test-slug', { foo: 2 }); } catch (e) { dupThrew = true; }
check('HT.provide.register(duplicate slug) throws', dupThrew);

// Internal registry surfaces.
check('HT.provideRegistry.list is function', typeof HT.provideRegistry.list === 'function');
check('HT.provideRegistry.list() includes test-slug', HT.provideRegistry.list().indexOf('test-slug') !== -1);
check('HT.netRegistry.inflight is function', typeof HT.netRegistry.inflight === 'function');
check('HT.netRegistry.inflight() returns array', Array.isArray(HT.netRegistry.inflight()));

// Frozen touch: mutation throws in strict mode. The duplicate
// registration we set up at the top of the script has already
// saturated the registry; we confirm the frozen surface by
// attempting to overwrite `register` and reading it back. We do NOT
// attempt a fresh register — it would (correctly) throw on
// duplicate, masking the test outcome.
let readBack = false;
try {
  // Attempt to overwrite; throws in strict mode because the parent
  // object is frozen.
  HT.provide.register = function () { return 'overwritten'; };
  // If we got here, the overwrite took — surface as a failure.
  readBack = typeof HT.provide.register === 'function' && HT.provide.register() === 'overwritten';
} catch (e) { readBack = false; }
check('HT.provide.register is the original function (frozen)', !readBack && typeof HT.provide.register === 'function');

console.log('');
console.log('passed: ' + pass + ', failed: ' + fail);

// Vacuous-pass guard.
if (pass === 0 && fail === 0) {
  console.error('smoke: vacuous run — zero assertions executed');
  process.exit(1);
}
process.exit(fail === 0 ? 0 : 1);
