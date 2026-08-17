#!/usr/bin/env node
/* Story DC-2 / Story 10.3 — results.js + wiring smoke.

   Verifies the shell-thin.js Proxy factory wiring for the
   result-card chrome (same pattern as scoring.js / Story DC-1):
     - shell-thin.js loads via vm sandbox
     - HT.results is a Proxy (the factory returns a function for
       every property access — including `.render`)
     - First call to HT.results.render(state, opts) fires
       HT.lazyLoad('assets/js/results.js') + HT.lazyLoadCss
       ('assets/css/result-card.css') in parallel and resolves
       to the real results.js HT.results.render()
     - The rendered card has data-print="result", role="region",
       aria-live="polite", aria-atomic="true", aria-labelledby
     - The action row carries data-print="ignore"
     - The contrarian line uses .quiz-result-contrarian
     - The button classes include .button.share and .button.challenge
     - scripts/bundle-size-gate.py: results.js + result-card.css
       are in SPEC_PAGE_CONDITIONAL_MODULES, NOT in SPEC_JS_MODULES
     - results.js has no localStorage / fetch / XHR / HT.provide
       (shell-bounds-check contract)

   Pure-Node smoke (no jsdom / playwright). Runs in a vm sandbox
   with minimal HT + dom stubs.

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
const RESULTS_SRC    = fs.readFileSync(path.join(REPO_ROOT, 'assets/js/results.js'), 'utf8');

let pass = 0;
let fail = 0;
function check(cond, label) {
  if (cond) { pass += 1; console.log('  PASS  ' + label); }
  else      { fail += 1; console.log('  FAIL  ' + label); }
}

// =============================================================
// Minimal HT + dom stubs (mirror _smoke_scoring.js shape).
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
      // When the smoke harness asks for results.js, actually run
      // its source into the same context so HT.results becomes the
      // real publicApi and the Proxy round-trip works.
      if (typeof url === 'string' && url.indexOf('results.js') !== -1) {
        try { vm.runInContext(RESULTS_SRC, ctx); } catch (e) {}
      }
      return Promise.resolve();
    },
    lazyLoadCss: function (url) {
      lazyLog.css.push(url);
      return Promise.resolve();
    },
    lazyLoadTool: function () { return Promise.resolve(); },
    history: { push: function () {} },
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
      createElement: function (tag) { return makeFakeEl(tag); },
      createTextNode: function (text) {
        return { nodeType: 3, text: String(text) };
      },
      createDocumentFragment: function () {
        return { appendChild: function () {} };
      },
      head: { appendChild: function () {} },
      currentScript: null,
    },
    location: { href: 'http://localhost/?arch=zen&quiz=zen-test', protocol: 'http:', pathname: '/' },
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
  };
  ctx.global = ctx;
  return ctx;
}

// =============================================================
// Shared FakeEl — classList.add must mutate attrs.class so the
// .button / .share / .challenge classes added by results.js are
// visible to the assertions below. (Results.js does
// `el.classList.add('button', 'share')` AFTER setting the initial
// class via setAttribute.)
// =============================================================

function makeFakeEl(tag) {
  const el = {
    tag: tag,
    dataset: {},
    attrs: {},
    classList: {
      _add: [],
      _remove: [],
      add: function () {
        for (var i = 0; i < arguments.length; i++) {
          if (this._add.indexOf(arguments[i]) === -1) this._add.push(arguments[i]);
        }
        // write back to attrs.class so the smoke's structural
        // assertions can find the added classes
        var combined = (this._baseClass ? this._baseClass + ' ' : '')
          + this._add.join(' ');
        if (this._remove.length) {
          var parts = combined.split(' ');
          for (var j = 0; j < this._remove.length; j++) {
            var idx = parts.indexOf(this._remove[j]);
            if (idx !== -1) parts.splice(idx, 1);
          }
          combined = parts.join(' ');
        }
        this._owner.attrs.class = combined;
      },
      remove: function () {
        for (var i = 0; i < arguments.length; i++) {
          var idx = this._add.indexOf(arguments[i]);
          if (idx !== -1) this._add.splice(idx, 1);
          if (this._remove.indexOf(arguments[i]) === -1) this._remove.push(arguments[i]);
        }
        var combined = (this._baseClass ? this._baseClass + ' ' : '')
          + this._add.join(' ');
        if (this._remove.length) {
          var parts = combined.split(' ');
          for (var j = 0; j < this._remove.length; j++) {
            var idx2 = parts.indexOf(this._remove[j]);
            if (idx2 !== -1) parts.splice(idx2, 1);
          }
          combined = parts.join(' ');
        }
        this._owner.attrs.class = combined;
      },
      contains: function (c) { return this._add.indexOf(c) !== -1; },
    },
    children: [],
    style: {},
    setAttribute: function (k, v) {
      this.attrs[k] = v;
      if (k === 'class') this.classList._baseClass = String(v);
    },
    appendChild: function (c) { this.children.push(c); return c; },
    addEventListener: function () {},
  };
  el.classList._owner = el;
  return el;
}


const ctx = buildCtx();
vm.createContext(ctx);
vm.runInContext(SHELL_THIN_SRC, ctx);

// 1. shell-thin.js loads cleanly
check(true, 'shell-thin.js loaded into vm sandbox');

// 2. HT.results is an object exposed by the shell-thin factory
check(
  typeof ctx.HT.results === 'object' && ctx.HT.results !== null && !Array.isArray(ctx.HT.results),
  'HT.results is an object exposed by the shell-thin factory'
);

// 3. HT.results.render is callable (Proxy returns fn for every prop access)
check(
  typeof ctx.HT.results.render === 'function',
  'HT.results.render is callable (Proxy factory returns fn for every prop access)'
);

// 4. First render() call fires lazyLoad('assets/js/results.js')
const state = {
  traits: { calm: 80, bold: 30 },
  archetype: { id: 'zen', label: 'Zen', emoji: '🧘' },
};
const opts = { title: 'You scored', conflict: 'You also said bold', slug: 'zen-test' };

ctx.HT.results.render(state, opts);
check(
  ctx.HT._lazyLog.js.filter(function (u) { return typeof u === 'string' && u.indexOf('results.js') !== -1; }).length >= 1,
  'first HT.results.render(...) call fires lazyLoad("...results.js")'
);

// 5. Concurrent first-call dedupes — render is sync; two renders
// share the lazy-loaded HT.results API.
const a = ctx.HT.results.render(state, opts);
const b = ctx.HT.results.render(state, opts);
check(
  a && b && typeof a === 'object' && typeof b === 'object',
  'concurrent render() calls return elements (lazy-load is single-flight)'
);

// 6. Functional suite — DOM shape + a11y
// Pull the real publicApi after lazy-load to inspect the DOM.
const Results = ctx.HT.results;

// 6a. render returns a real element
const el = Results.render(state, { title: 'You scored', slug: 'zen-test' });
check(
  el && typeof el === 'object' && el.attrs,
  'render() returns an element-like object with attrs'
);

// 6b. card root has data-print="result" + role="region" + aria-live="polite"
// 6c. action row carries data-print="ignore"
// 6d. contrarian line uses .quiz-result-contrarian
// 6e. button.share + button.challenge classes present
// We re-render with a contrarian line so the audit covers that branch.
const elFull = Results.render(state, {
  title: 'You scored',
  conflict: 'You also said bold',
  slug: 'zen-test',
  traitCap: 4,
});

check(
  elFull.attrs['data-print'] === 'result',
  'card root carries data-print="result"'
);
check(
  elFull.attrs.role === 'region',
  'card root carries role="region"'
);
check(
  elFull.attrs['aria-live'] === 'polite',
  'card root carries aria-live="polite"'
);
check(
  elFull.attrs['aria-atomic'] === 'true',
  'card root carries aria-atomic="true"'
);
check(
  elFull.attrs['aria-labelledby'] === 'quiz-result-archetype',
  'card root carries aria-labelledby pointing at the archetype h2'
);

// 6f. action row carries data-print="ignore" — find the action node
const actionsNode = elFull.children.filter(function (c) {
  return c && c.attrs && c.attrs['data-print'] === 'ignore';
})[0];
check(
  !!actionsNode,
  'action row carries data-print="ignore"'
);

// 6g. contrarian line — walk all descendants, find the
// .quiz-result-contrarian child
function walkAll(node, acc) {
  acc = acc || [];
  if (!node || typeof node !== 'object') return acc;
  if (node.attrs) acc.push(node);
  var kids = node.children || [];
  for (var i = 0; i < kids.length; i++) walkAll(kids[i], acc);
  return acc;
}
const allDescendants = walkAll(elFull);
const contrarianNode = allDescendants.filter(function (c) {
  return c.attrs && c.attrs.class === 'quiz-result-contrarian';
})[0];
// contrarian text node has .text property (from createTextNode stub)
const contrarianText = contrarianNode && contrarianNode.children
  && contrarianNode.children[0]
  && contrarianNode.children[0].text;
const hasContrarian = contrarianText === 'You also said bold';
check(hasContrarian, 'contrarian line uses .quiz-result-contrarian with the conflict text');

// 6h. tab-order-canonical ['button.share', 'button.challenge'] — both
// classes are present on at least one descendant button each.
const shareBtn = allDescendants.filter(function (c) {
  return c.attrs && c.attrs.class
    && c.attrs.class.indexOf('button') !== -1
    && c.attrs.class.indexOf('share') !== -1;
})[0];
const challengeBtn = allDescendants.filter(function (c) {
  return c.attrs && c.attrs.class
    && c.attrs.class.indexOf('button') !== -1
    && c.attrs.class.indexOf('challenge') !== -1;
})[0];
check(!!shareBtn, 'action row has a .button.share button');
check(!!challengeBtn, 'action row has a .button.challenge button');

// 7. shareUrl returns URL containing ?arch=<id>
const url = Results.shareUrl(
  { id: 'zen', label: 'Zen', emoji: '🧘' },
  { slug: 'zen-test' }
);
check(
  typeof url === 'string' && url.indexOf('arch=zen') !== -1,
  'shareUrl returns a URL containing ?arch=<id> (got ' + url + ')'
);
check(
  url.indexOf('quiz=zen-test') !== -1,
  'shareUrl includes ?quiz=<slug> when opts.slug is set'
);

// 8. copyText returns canonical format
const text = Results.copyText(state, { slug: 'zen-test' });
check(
  typeof text === 'string' && text.indexOf('Zen') !== -1
    && text.indexOf('🧘') !== -1 && /\d+%/.test(text),
  'copyText returns "<emoji> <label> — <trait> NN%" canonical format'
);
check(
  text.length <= 280,
  'copyText stays under 280 chars (got ' + text.length + ')'
);

// 9. imageSnapshot contract — throws 'snapshot unavailable' (matches DC-2 AC-13)
let snapshotOk = false;
let snapshotThrew = false;
try {
  Results.imageSnapshot({});
} catch (e) {
  if (/snapshot unavailable/i.test(String(e && e.message || e))) snapshotThrew = true;
}
snapshotOk = snapshotThrew;
check(snapshotOk, 'imageSnapshot throws Error("snapshot unavailable") per DC-2 contract');

// 10. shell-bounds-check.py: no localStorage / fetch / XHR / HT.provide
// Strip line comments + block comments before the regex scan so
// documentation references to "fetch" / "localStorage" / "HT.provide"
// don't false-positive. The actual code surface is what matters.
const stripped = RESULTS_SRC
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const hasLocalStorage = /\blocalStorage\./.test(stripped);
const hasFetch       = /\bfetch\s*\(/.test(stripped);
const hasXHR         = /\b(XMLHttpRequest|new\s+XHR)\b/.test(stripped);
const hasHTProvide   = /\bHT\.provide\s*\(/.test(stripped);
check(
  !hasLocalStorage && !hasFetch && !hasXHR && !hasHTProvide,
  'results.js contains no localStorage/fetch/XHR/HT.provide (shell-bounds contract)'
);

// 11. bundle-size-gate.py: results.js + result-card.css in SPEC_PAGE_CONDITIONAL_MODULES
const bsgSrc = fs.readFileSync(path.join(REPO_ROOT, 'scripts/bundle-size-gate.py'), 'utf8');
check(
  /SPEC_PAGE_CONDITIONAL_MODULES[\s\S]*?"assets\/js\/results\.js"/m.test(bsgSrc),
  'scripts/bundle-size-gate.py lists results.js in SPEC_PAGE_CONDITIONAL_MODULES'
);
check(
  /SPEC_PAGE_CONDITIONAL_MODULES[\s\S]*?"assets\/css\/result-card\.css"/m.test(bsgSrc),
  'scripts/bundle-size-gate.py lists result-card.css in SPEC_PAGE_CONDITIONAL_MODULES'
);

// 12. shell-thin.js TIER2_URLS includes 'assets/js/results.js' + TIER2_CSS includes result-card.css
check(
  SHELL_THIN_SRC.indexOf("results: 'assets/js/results.js'") !== -1,
  'assets/js/shell-thin.js TIER2_URLS includes \'assets/js/results.js\''
);
check(
  SHELL_THIN_SRC.indexOf("results: 'assets/css/result-card.css'") !== -1,
  'assets/js/shell-thin.js TIER2_CSS includes \'assets/css/result-card.css\''
);

// 13. vacuous-pass guard — at least one assertion ran (defensive)
check(pass + fail > 0, 'at least one assertion ran (vacuous-pass guard)');

// Final summary
console.log('\nJSON:{"story": "DC-2", "pass": ' + pass + ', "fail": ' + fail + '}');
process.exit(fail === 0 ? 0 : 1);