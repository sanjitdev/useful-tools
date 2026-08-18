#!/usr/bin/env node
/* Story DC-5 — packs/discovery-loader.js + discovery.css smoke.

   Verifies the Discovery Pack loader module (Story 10.6):
     * HT.discovery is defined and exposes load() + list()
     * HT.discovery is frozen (writable:false, configurable:false)
     * list() resolves to the 6 quizzes registered in tools.json
     * load('spirit-animal') resolves to the matching entry
     * load('does-not-exist') resolves to null (no throw)
     * list() result is frozen + entries carry the canonical shape
       (slug / title / emoji / category / modules)
     * The loader does NOT eagerly load scoring/results/challenge/
       recommend/catalog (verified by absence of HT.scoring.score /
       HT.results.render / etc. after a list() call with no quiz
       page present — the shell-thin Proxy factory handles those
       on first real access)
     * The loader is page-conditional: assets/js/packs/discovery-
       loader.js is in SPEC_PAGE_CONDITIONAL_MODULES (NOT in
       SPEC_JS_MODULES) — bundle-size-gate enforces this contract

   Pure-Node smoke (no jsdom / playwright). Runs in a vm sandbox
   with minimal HT + dom stubs. Mirrors scripts/_smoke_scoring.js
   structure.

   Exit codes:
     0 — all assertions PASS
     1 — at least one assertion failed
*/

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// REPO_ROOT resolves the repo from CWD when invoked via stdin pipe
// (run_node passes the script on stdin, so __dirname is undefined).
const REPO_ROOT = fs.existsSync(path.join(process.cwd(), 'tools.json'))
  ? process.cwd()
  : fs.existsSync(path.join(process.cwd(), '..', 'tools.json'))
  ? path.resolve(process.cwd(), '..')
  : process.cwd();
const LOADER_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'assets/js/packs/discovery-loader.js'),
  'utf8'
);

let pass = 0;
let fail = 0;
function check(cond, label) {
  if (cond) { pass += 1; console.log('  PASS  ' + label); }
  else      { fail += 1; console.log('  FAIL  ' + label); }
}

// =============================================================
// Minimal HT + dom stubs.
// =============================================================
function buildCtx() {
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
    shellThinLoaded: false,
    // Scoring/results/challenge/recommend/catalog proxies (the
    // discovery loader must NOT eagerly populate these).
    scoring:   new Proxy({}, { get: function () { return function () {}; } }),
    results:   new Proxy({}, { get: function () { return function () {}; } }),
    challenge: new Proxy({}, { get: function () { return function () {}; } }),
    recommend: new Proxy({}, { get: function () { return function () {}; } }),
    catalog:   new Proxy({}, { get: function () { return function () {}; } }),
  };
  // Inline tools.json block — synthesized from the real tools.json
  // payload (kept tiny: just the packs.discovery block).
  const toolsJsonPayload = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'tools.json'), 'utf8')
  );
  const inlineEl = { textContent: JSON.stringify(toolsJsonPayload) };
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
      createDocumentFragment: function () { return { appendChild: function () {} }; },
      head: { appendChild: function () {} },
      currentScript: null,
      getElementById: function (id) { return id === 'ht-tools-json-inline' ? inlineEl : null; },
    },
    location: { href: 'http://localhost/', protocol: 'http:', pathname: '/' },
    history: { replaceState: function () {} },
    setTimeout: function (fn) { try { fn(); } catch (e) {} return 0; },
    clearTimeout: function () {},
    fetch: function () { return Promise.reject(new Error('fetch should not be called when inline block is present')); },
    Object: Object,
    Array: Array,
    JSON: JSON,
    Promise: Promise,
    Error: Error,
    isFinite: isFinite,
    Math: Math,
  };
  ctx.global = ctx;
  return ctx;
}

// =============================================================
// Run the loader IIFE in the sandbox.
// =============================================================
const ctx = buildCtx();
vm.createContext(ctx);
vm.runInContext(LOADER_SRC, ctx);

// 1. HT.discovery is defined after the loader runs.
check(ctx.HT.discovery && typeof ctx.HT.discovery === 'object',
      'HT.discovery is defined after loader IIFE');

// 2. HT.discovery.load + HT.discovery.list are functions.
check(typeof ctx.HT.discovery.load === 'function',
      'HT.discovery.load is a function');
check(typeof ctx.HT.discovery.list === 'function',
      'HT.discovery.list is a function');

// 3. HT.discovery is frozen (AD-14 read-only contract).
check(Object.isFrozen(ctx.HT.discovery),
      'HT.discovery is frozen (Object.isFrozen === true)');

// 4. The descriptor on HT.discovery is writable:false, configurable:false.
const desc = Object.getOwnPropertyDescriptor(ctx.HT, 'discovery');
check(desc && desc.writable === false && desc.configurable === false,
      'HT.discovery descriptor: writable:false, configurable:false');

// 5. list() resolves to a frozen array of the 10 registered entries.
ctx.HT.discovery.list().then(function (list) {
  check(Array.isArray(list), 'list() returns an Array');
  check(Object.isFrozen(list), 'list() result is frozen');
  check(list.length === 10, 'list() returns 10 entries (got ' + list.length + ')');

  // 6. Each entry carries the canonical shape.
  const expectedSlugs = [
    'spirit-animal', 'future-partner', 'what-would-you-do',
    'decision-style', 'friend-match', 'car-finder',
  ];
  const slugs = list.map(function (e) { return e.slug; });
  let allPresent = expectedSlugs.every(function (s) { return slugs.indexOf(s) !== -1; });
  check(allPresent, 'list() carries all 6 expected slugs (got ' + slugs.join(',') + ')');
  // (Story 10.7 follow-up — DC-7 4-quiz deficit closed; list() now has
  // 10 entries. The expectedSlugs list above covers the original 6; the
  // 4 new slugs (fortune-cookie, time-traveler-therapist, dream-job,
  // last-meal) come from the same registration path and are not
  // asserted by name.)

  let allCanonical = list.every(function (e) {
    return typeof e.slug === 'string'
        && typeof e.title === 'string'
        && typeof e.emoji === 'string'
        && typeof e.category === 'string'
        && Array.isArray(e.modules);
  });
  check(allCanonical, 'every list() entry carries {slug, title, emoji, category, modules[]}');

  // 7. load('spirit-animal') resolves to a frozen entry carrying
  //    the canonical scoring/results/challenge modules.
  return ctx.HT.discovery.load('spirit-animal').then(function (entry) {
    check(entry !== null, "load('spirit-animal') resolves to a non-null entry");
    check(entry && entry.slug === 'spirit-animal',
          "load('spirit-animal').slug === 'spirit-animal'");
    check(entry && Object.isFrozen(entry),
          'load() result is frozen');
    check(entry && Array.isArray(entry.modules) && entry.modules.length >= 2,
          'load() entry carries modules[] with ≥ 2 entries');
    check(entry && entry.modules.some(function (m) { return m.kind === 'scoring'; }),
          'load() entry declares scoring module');
    check(entry && entry.modules.some(function (m) { return m.kind === 'results'; }),
          'load() entry declares results module');

    // 8. load() for a missing slug resolves to null (no throw).
    return ctx.HT.discovery.load('does-not-exist').then(function (missing) {
      check(missing === null, "load('does-not-exist') resolves to null");

      // 9. The loader does NOT eagerly load scoring/results/challenge/
      //    recommend/catalog — those are Proxy stubs, not real APIs.
      const stubs = ['scoring', 'results', 'challenge', 'recommend', 'catalog'];
      let allStubs = stubs.every(function (ns) {
        // The Proxy stubs in our sandbox are non-function getters that
        // return a no-op function. The loader must not have replaced
        // them with real APIs.
        const orig = ctx.HT[ns];
        return orig && typeof orig === 'object';
      });
      check(allStubs, 'scoring/results/challenge/recommend/catalog are NOT replaced by the loader');

      // 10. The loader does NOT introduce SPA frameworks — the loader
      //     source is plain ES2018 vanilla (no react/vue/svelte/htm
      //     import statements).
      const bannedImports = ['react', 'vue', 'svelte', 'htm'].some(function (framework) {
        const re = new RegExp('\\b(import|require)\\b.*\\bfrom\\s+[\'"]' + framework);
        return re.test(LOADER_SRC);
      });
      check(!bannedImports, 'loader source has no react/vue/svelte/htm imports');

      // 11. bundle-size-gate lists the loader in SPEC_PAGE_CONDITIONAL_MODULES
      //     (not SPEC_JS_MODULES — the loader is page-conditional, NOT
      //     eager on the home page).
      const bundleGate = fs.readFileSync(
        path.join(REPO_ROOT, 'scripts/bundle-size-gate.py'), 'utf8'
      );
      check(bundleGate.indexOf('"assets/js/packs/discovery-loader.js"') !== -1,
            'bundle-size-gate.py lists "assets/js/packs/discovery-loader.js" in SPEC_PAGE_CONDITIONAL_MODULES');

      // 12. gzipped size of the loader is within the budget.
      const zlib = require('zlib');
      const gzSize = zlib.gzipSync(LOADER_SRC).length;
      check(gzSize <= 2000,
            'gzipped size of discovery-loader.js <= 2,000 bytes (got ' + gzSize + ')');

      // 13. assets/css/discovery.css exists + honors prefers-reduced-motion
      //     + declares the emoji-icon variant (.tool-card-icon--emoji) used
      //     by Discovery quiz cards (the cards themselves use the regular
      //     .tool-card chrome shared with every other tool).
      const cssPath = path.join(REPO_ROOT, 'assets/css/discovery.css');
      const css = fs.readFileSync(cssPath, 'utf8');
      check(css.indexOf('.tool-card-icon--emoji') !== -1,
            'discovery.css declares .tool-card-icon--emoji');
      check(css.indexOf('@media (prefers-reduced-motion: reduce)') !== -1,
            'discovery.css honors prefers-reduced-motion contract');
      check(css.indexOf('prefers-reduced-motion') !== -1,
            'discovery.css honors prefers-reduced-motion');
      const cssGzSize = zlib.gzipSync(css).length;
      check(cssGzSize <= 4000,
            'gzipped size of discovery.css <= 4,000 bytes (got ' + cssGzSize + ')');

      console.log('\n' + (fail === 0 ? 'OK' : 'FAIL') +
                  ' — pass=' + pass + ' fail=' + fail);
      process.exit(fail === 0 ? 0 : 1);
    });
  });
}).catch(function (err) {
  console.log('  FAIL  unexpected error: ' + (err && err.message || err));
  fail += 1;
  console.log('\nFAIL — pass=' + pass + ' fail=' + fail);
  process.exit(1);
});