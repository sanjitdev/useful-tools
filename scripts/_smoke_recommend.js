#!/usr/bin/env node
/* Story DC-4 / Story 10.5 — recommend.js + catalog.js + wiring smoke.

   Verifies the shell-thin.js Proxy factory wiring for the
   recommendation module pair (same pattern as scoring.js /
   Story DC-1, results.js / Story DC-2, challenge.js / Story DC-3):
     - shell-thin.js loads via vm sandbox
     - HT.recommend is a Proxy (the factory returns a function for
       every property access — including `.match`)
     - HT.catalog is a Proxy (the factory returns a function for
       every property access — including `.list` and `.lazyLoad`)
     - First HT.catalog.list() call fires lazyLoad
       ('assets/js/catalog.js')
     - First HT.recommend.match(profile, 'car') call fires
       lazyLoad('assets/js/recommend.js')
     - HT.catalog.list() returns {car: >=10, bike: >=10}
     - HT.recommend.match returns {top, alternatives, explain}
       where top is a non-null object, alternatives >= 1, score
       is in [0, 100], and explain.{whyMatch,whyNot} are arrays
       of strings
     - match is deterministic (same profile -> same top.id)
     - scripts/bundle-size-gate.py: recommend.js + catalog.js are
       in SPEC_PAGE_CONDITIONAL_MODULES, NOT in SPEC_JS_MODULES
     - recommend.js + catalog.js have no localStorage / fetch /
       XHR / HT.provide (shell-bounds-check contract)

   Pure-Node smoke (no jsdom / playwright). Runs in a vm sandbox
   with minimal HT stubs.

   Exit codes:
     0 — all assertions PASS
     1 — at least one assertion failed
*/

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const SHELL_THIN_SRC = fs.readFileSync(path.join(REPO_ROOT, 'assets/js/shell-thin.js'), 'utf8');
const RECOMMEND_SRC  = fs.readFileSync(path.join(REPO_ROOT, 'assets/js/recommend.js'),  'utf8');
const CATALOG_SRC    = fs.readFileSync(path.join(REPO_ROOT, 'assets/js/catalog.js'),    'utf8');
const CARS_JSON      = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'assets/data/cars.json'), 'utf8'));
const BIKES_JSON     = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'assets/data/bikes.json'), 'utf8'));
const PROFILES_JSON  = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'assets/data/catalog-profiles.json'), 'utf8'));

let pass = 0;
let fail = 0;
function check(cond, label) {
  if (cond) { pass += 1; console.log('  PASS  ' + label); }
  else      { fail += 1; console.log('  FAIL  ' + label); }
}

// =============================================================
// Minimal HT stubs (mirror _smoke_scoring.js shape).
// =============================================================

function buildCtx() {
  const lazyLog = { js: [], css: [] };
  const HT = {
    storage: {
      _store: {},
      get: function (k, dflt) { return Object.prototype.hasOwnProperty.call(this._store, k) ? this._store[k] : dflt; },
      set: function (k, v) { this._store[k] = v; },
      remove: function (k) { delete this._store[k]; },
    },
    $: function () { return null; },
    qsa: function () { return []; },
    qs: function () { return null; },
    debounce: function (fn) { return fn; },
    formatNumber: function (n) { return String(n); },
    formatDate: function (d) { return d.toISOString(); },
    copyToClipboard: function () { return Promise.resolve(); },
    toast: function () {},
    share: { print: function () {} },
    shellThinLoaded: false,
    lazyLoad: function (url) {
      lazyLog.js.push(url);
      // When the smoke harness asks for catalog.js or recommend.js,
      // actually run its source into the same context so the Proxy
      // round-trip resolves to the real publicApi.
      if (typeof url === 'string') {
        if (url.indexOf('catalog.js') !== -1) {
          try { vm.runInContext(CATALOG_SRC, ctx); } catch (e) {}
        } else if (url.indexOf('recommend.js') !== -1) {
          try { vm.runInContext(RECOMMEND_SRC, ctx); } catch (e) {}
        }
      }
      return Promise.resolve();
    },
    lazyLoadCss: function (url) {
      lazyLog.css.push(url);
      return Promise.resolve();
    },
    lazyLoadTool: function () { return Promise.resolve(); },
    history: { push: function () {} },
    // Pre-populated data the catalog reads via HT.__data / HT.__profiles
    // — mirrors the dc-4 AC gate's runtime fixture pattern.
    __data: { car: CARS_JSON, bike: BIKES_JSON },
    __profiles: PROFILES_JSON,
    _lazyLog: lazyLog,
  };
  const ctx = {
    HT: HT,
    window: { HT: HT, __htShellReplacesTheme: false },
    self:   { HT: HT },
    console: { warn: function () {}, log: function () {}, error: function () {} },
    document: {
      addEventListener: function () {},
      documentElement: { setAttribute: function () {}, getAttribute: function () { return null; } },
      readyState: 'loading',
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
      createElement: function () { return { setAttribute: function () {}, addEventListener: function () {} }; },
      createTextNode: function () { return { nodeType: 3, text: '' }; },
      createDocumentFragment: function () { return { appendChild: function () {} }; },
      head: { appendChild: function () {} },
      currentScript: null,
    },
    location: { href: 'http://localhost/', protocol: 'http:', pathname: '/' },
    history: { replaceState: function () {} },
    setTimeout: function (fn) { try { fn(); } catch (e) {} return 0; },
    clearTimeout: function () {},
    Object: Object,
    Array: Array,
    JSON: JSON,
    Promise: Promise,
    Error: Error,
    URLSearchParams: URLSearchParams,
    isFinite: isFinite,
    Math: Math,
    Date: Date,
  };
  ctx.global = ctx;
  return ctx;
}

// =============================================================
// Proxy wiring + functional checks (async — the shell-thin
// Proxy factory returns Promises that resolve to the real API).
// =============================================================

const ctx = buildCtx();
vm.createContext(ctx);
vm.runInContext(SHELL_THIN_SRC, ctx);

(async function () {

  // 1. shell-thin.js loaded into vm sandbox
  check(true, 'shell-thin.js loaded into vm sandbox');

  // 2. HT.catalog is an object exposed by the shell-thin factory
  check(
    typeof ctx.HT.catalog === 'object' && ctx.HT.catalog !== null && !Array.isArray(ctx.HT.catalog),
    'HT.catalog is an object exposed by the shell-thin factory'
  );

  // 3. HT.recommend is an object exposed by the shell-thin factory
  check(
    typeof ctx.HT.recommend === 'object' && ctx.HT.recommend !== null && !Array.isArray(ctx.HT.recommend),
    'HT.recommend is an object exposed by the shell-thin factory'
  );

  // 4. HT.catalog.list is callable (Proxy returns fn for every prop access)
  check(
    typeof ctx.HT.catalog.list === 'function',
    'HT.catalog.list is callable (Proxy factory returns fn for every prop access)'
  );

  // 5. HT.catalog.lazyLoad is callable
  check(
    typeof ctx.HT.catalog.lazyLoad === 'function',
    'HT.catalog.lazyLoad is callable'
  );

  // 6. HT.recommend.match is callable
  check(
    typeof ctx.HT.recommend.match === 'function',
    'HT.recommend.match is callable'
  );

  // 7. First catalog.list() call fires lazyLoad('assets/js/catalog.js')
  const counts = await ctx.HT.catalog.list();
  check(
    ctx.HT._lazyLog.js.filter(function (u) { return typeof u === 'string' && u.indexOf('catalog.js') !== -1; }).length >= 1,
    'first HT.catalog.list(...) call fires lazyLoad("...catalog.js")'
  );

  // 8. counts returns car + bike counts >= 10 each
  check(
    counts && counts.car >= 10 && counts.bike >= 10,
    'HT.catalog.list() returns car + bike counts >= 10 (got car=' + (counts && counts.car) + ', bike=' + (counts && counts.bike) + ')'
  );

  // 9. First recommend.match() call fires lazyLoad('assets/js/recommend.js')
  const profile = {
    traits: { efficiency: 0.7, comfort: 0.4, sportiness: 0.2 },
    weights: { price: 0.5, fuel: 0.3, space: 0.2 },
  };
  const r1 = await ctx.HT.recommend.match(profile, 'car');
  check(
    ctx.HT._lazyLog.js.filter(function (u) { return typeof u === 'string' && u.indexOf('recommend.js') !== -1; }).length >= 1,
    'first HT.recommend.match(...) call fires lazyLoad("...recommend.js")'
  );

  // 10. match returns {top, alternatives, explain}
  check(
    r1 && r1.top && r1.alternatives && r1.explain,
    'HT.recommend.match returns {top, alternatives, explain}'
  );

  // 11. top is a non-null object
  check(
    r1 && r1.top !== null && typeof r1.top === 'object',
    'top is a non-null object'
  );

  // 12. top.score is in [0, 100]
  check(
    r1 && typeof r1.top.score === 'number' && r1.top.score >= 0 && r1.top.score <= 100,
    'top.score is in [0, 100] (got ' + (r1 && r1.top.score) + ')'
  );

  // 13. alternatives has >= 1 entry (catalog has >= 13 cars)
  check(
    r1 && Array.isArray(r1.alternatives) && r1.alternatives.length >= 1,
    'alternatives has >= 1 entry (got ' + (r1 && r1.alternatives && r1.alternatives.length) + ')'
  );

  // 14. explain.whyMatch is an array of strings
  check(
    r1 && Array.isArray(r1.explain.whyMatch)
      && r1.explain.whyMatch.every(function (s) { return typeof s === 'string'; }),
    'explain.whyMatch is an array of strings (got ' + JSON.stringify(r1 && r1.explain.whyMatch) + ')'
  );

  // 15. explain.whyNot is an array of strings
  check(
    r1 && Array.isArray(r1.explain.whyNot)
      && r1.explain.whyNot.every(function (s) { return typeof s === 'string'; }),
    'explain.whyNot is an array of strings (got ' + JSON.stringify(r1 && r1.explain.whyNot) + ')'
  );

  // 16. match is deterministic (same profile -> same top.id)
  const r2 = await ctx.HT.recommend.match(profile, 'car');
  check(
    r1 && r2 && r1.top && r2.top && r1.top.id === r2.top.id,
    'match is deterministic (same profile -> same top.id ' + (r1 && r1.top && r1.top.id) + ')'
  );

  // 17. bike domain also works
  const rb = await ctx.HT.recommend.match({ traits: { speed: 0.8, comfort: 0.3, offroad: 0.1 } }, 'bike');
  check(
    rb && rb.top && typeof rb.top.id === 'string' && rb.top.id.length > 0,
    'match works for bike domain (top.id = ' + (rb && rb.top && rb.top.id) + ')'
  );

  // 18. shell-bounds-check.py contract — strip comments before regex scan
  const strippedRec = RECOMMEND_SRC
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const strippedCat = CATALOG_SRC
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const hasLocalStorage = /\blocalStorage\./.test(strippedRec) || /\blocalStorage\./.test(strippedCat);
  const hasFetch        = /\bfetch\s*\(/.test(strippedRec) || /\bfetch\s*\(/.test(strippedCat);
  const hasXHR          = /\b(XMLHttpRequest|new\s+XHR)\b/.test(strippedRec) || /\b(XMLHttpRequest|new\s+XHR)\b/.test(strippedCat);
  const hasHTProvide    = /\bHT\.provide\s*\(/.test(strippedRec) || /\bHT\.provide\s*\(/.test(strippedCat);
  check(
    !hasLocalStorage && !hasFetch && !hasXHR && !hasHTProvide,
    'recommend.js + catalog.js contain no localStorage/fetch/XHR/HT.provide (shell-bounds contract)'
  );

  // 19. bundle-size-gate.py: recommend.js + catalog.js in SPEC_PAGE_CONDITIONAL_MODULES
  const bsgSrc = fs.readFileSync(path.join(REPO_ROOT, 'scripts/bundle-size-gate.py'), 'utf8');
  check(
    /SPEC_PAGE_CONDITIONAL_MODULES[\s\S]*?"assets\/js\/recommend\.js"/m.test(bsgSrc),
    'scripts/bundle-size-gate.py lists recommend.js in SPEC_PAGE_CONDITIONAL_MODULES'
  );
  check(
    /SPEC_PAGE_CONDITIONAL_MODULES[\s\S]*?"assets\/js\/catalog\.js"/m.test(bsgSrc),
    'scripts/bundle-size-gate.py lists catalog.js in SPEC_PAGE_CONDITIONAL_MODULES'
  );

  // 20. shell-thin.js TIER2_URLS includes both
  check(
    /recommend:\s*'assets\/js\/recommend\.js'/.test(SHELL_THIN_SRC),
    'assets/js/shell-thin.js TIER2_URLS includes \'assets/js/recommend.js\''
  );
  check(
    /catalog:\s*'assets\/js\/catalog\.js'/.test(SHELL_THIN_SRC),
    'assets/js/shell-thin.js TIER2_URLS includes \'assets/js/catalog.js\''
  );

  // 21. api-contract.js lists both as stable
  const apiSrc = fs.readFileSync(path.join(REPO_ROOT, 'assets/js/api-contract.js'), 'utf8');
  check(
    /name:\s*'HT\.recommend'/.test(apiSrc) && /stability:\s*'stable'[\s\S]*?HT\.recommend[\s\S]*?module:\s*'assets\/js\/recommend\.js'/.test(apiSrc),
    'assets/js/api-contract.js registers HT.recommend as stable (assets/js/recommend.js)'
  );
  check(
    /name:\s*'HT\.catalog'/.test(apiSrc) && /stability:\s*'stable'[\s\S]*?HT\.catalog[\s\S]*?module:\s*'assets\/js\/catalog\.js'/.test(apiSrc),
    'assets/js/api-contract.js registers HT.catalog as stable (assets/js/catalog.js)'
  );

  // 22. vacuous-pass guard
  check(pass + fail > 0, 'at least one assertion ran (vacuous-pass guard)');

  // Final summary
  console.log('\nJSON:{"story": "DC-4", "pass": ' + pass + ', "fail": ' + fail + '}');
  process.exit(fail === 0 ? 0 : 1);
})().catch(function (err) {
  console.error('smoke threw:', err && err.stack || err);
  process.exit(1);
});
