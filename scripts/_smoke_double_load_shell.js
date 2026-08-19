'use strict';
/* Final smoke: load shell.js + shell-thin.js in a single vm context,
   simulating a real browser page. Verifies:
     1. shell.js loads successfully (no "Cannot redefine property: provide")
     2. shell-thin.js loads successfully after shell.js
     3. All key HT.* surfaces are defined and functional
     4. Double-loading shell.js (simulating safeLazyLoad race) is harmless */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const JS_DIR = path.join(REPO, 'assets', 'js');

function makeFakeDoc() {
  const noop = () => {};
  const fakeNode = { addEventListener: noop, removeEventListener: noop, setAttribute: noop, getAttribute: () => null, contains: () => false, focus: noop, querySelector: () => null, querySelectorAll: () => [], appendChild: noop, removeChild: noop };
  return new Proxy({}, {
    get(target, prop) {
      if (prop === 'documentElement') return { getAttribute: () => 'light', setAttribute: noop, addEventListener: noop };
      if (prop === 'addEventListener') return noop;
      if (prop === 'readyState') return 'complete';
      if (prop === 'getElementById') return () => null;
      if (prop === 'querySelectorAll') return () => [];
      if (prop === 'querySelector') return () => null;
      if (prop === 'createElement') return () => ({ ...fakeNode, classList: { add: noop, remove: noop } });
      if (prop === 'createTextNode') return () => ({ textContent: '' });
      if (prop === 'head') return fakeNode;
      if (prop === 'body') return fakeNode;
      if (prop === 'activeElement') return fakeNode;
      return undefined;
    }
  });
}

const ctx = {
  window: {},
  document: makeFakeDoc(),
  console,
  performance: { now: () => Date.now() },
  setTimeout: (fn, ms) => { try { fn(); } catch (e) { console.error('  setTimeout err: ' + e.message); } return 0; },
  clearTimeout: () => {},
  AbortController,
  fetch: () => Promise.resolve({ ok: true }),
  matchMedia: () => ({ matches: false, addEventListener: () => {}, addListener: () => {} }),
  URLSearchParams,
  MutationObserver: class { observe() {} disconnect() {} },
  navigator: { clipboard: undefined, platform: 'Win32' },
  location: { hash: '', href: 'https://example.com/' },
};

vm.createContext(ctx);

let pass = 0, fail = 0;
function check(name, ok, info) {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (info ? ' — ' + info : '')); }
}

// 1. shell.js loads (simulating static <script src="shell.js" defer>)
const shellSrc = fs.readFileSync(path.join(JS_DIR, 'shell.js'), 'utf8');
try {
  vm.runInContext(shellSrc, ctx, { filename: 'shell.js' });
  check('shell.js loads cleanly', true);
} catch (err) {
  check('shell.js loads cleanly', false, err.message);
  process.exit(1);
}

const HT = ctx.window.HT;
check('HT exists', typeof HT === 'object' && HT !== null);
check('HT.provide is function', typeof HT.provide === 'function');
check('HT.use is function', typeof HT.use === 'function');
check('HT.net exists', typeof HT.net === 'object');
check('HT.provideRegistry exists', typeof HT.provideRegistry === 'object');
check('HT.netRegistry exists', typeof HT.netRegistry === 'object');
check('HT.palette exists', typeof HT.palette === 'object');
check('HT.headerSearch exists', typeof HT.headerSearch === 'object');
check('HT.theme exists', typeof HT.theme === 'object');
check('HT.boot is function', typeof HT.boot === 'function');

// 2. shell-thin.js loads after shell.js
const thinSrc = fs.readFileSync(path.join(JS_DIR, 'shell-thin.js'), 'utf8');
try {
  vm.runInContext(thinSrc, ctx, { filename: 'shell-thin.js' });
  check('shell-thin.js loads cleanly', true);
} catch (err) {
  check('shell-thin.js loads cleanly', false, err.message);
  process.exit(1);
}

// 3. Verify the re-entry guard kicks in for a second shell.js load
const beforeDoubleLoad = HT.headerSearch;
try {
  vm.runInContext(shellSrc, ctx, { filename: 'shell.js (double)' });
  check('double-loading shell.js is harmless', true);
} catch (err) {
  check('double-loading shell.js is harmless', false, err.message);
  process.exit(1);
}
check('HT.headerSearch preserved across double-load', HT.headerSearch === beforeDoubleLoad);
check('HT.provide preserved across double-load', typeof HT.provide === 'function');

// 4. Behavioral: HT.provide / HT.use round-trip
let regOk = true;
try { HT.provide('test-slug-2', { foo: 1 }); }
catch (e) { regOk = false; }
check('HT.provide(valid slug, object) ok', regOk);
check('HT.use(test-slug-2) returns the api', HT.use('test-slug-2') && HT.use('test-slug-2').foo === 1);
check('HT.use(unknown-slug) returns null', HT.use('does-not-exist-2') === null);

console.log('');
console.log('passed: ' + pass + ', failed: ' + fail);
process.exit(fail === 0 ? 0 : 1);