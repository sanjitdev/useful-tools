#!/usr/bin/env node
/* Story 10.10 — Result card chrome component.

   Verifies HT.results.wireActions() + the on-page Share/Challenge
   button wiring contract:
     - HT.results.wireActions() is exposed on the frozen public API
       (after the Story 10.10 extension)
     - wireActions(card, state, opts) attaches click listeners to the
       rendered card's .quiz-result-actions > button[data-action] rows
     - Share button click → HT.share.copy(state, opts) is invoked
       (canonical shell API, not bare navigator.clipboard)
     - Challenge button click → HT.challenge.link(spec) is invoked
       + HT.share.copy() copies the resulting URL
     - Challenge button is hidden when HT.challenge is absent
       (utility-category quiz opt-out)
     - wireActions is idempotent (data-wired="1" guard prevents
       double-binding on re-render)
     - results.js does NOT use navigator.clipboard or localStorage
       or fetch — the shell-bounds-check contract holds after the
       Story 10.10 extension
     - gzipped results.js stays under the 6 KB DC-2 budget

   Pure-Node smoke (no jsdom / playwright). Runs in a vm sandbox.

   Exit codes:
     0 — all assertions PASS
     1 — at least one assertion failed
*/

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const RESULTS_SRC = fs.readFileSync(path.join(REPO_ROOT, 'assets/js/results.js'), 'utf8');
const BSG_SRC = fs.readFileSync(path.join(REPO_ROOT, 'scripts/bundle-size-gate.py'), 'utf8');

let pass = 0;
let fail = 0;
function check(cond, label) {
  if (cond) { pass += 1; console.log('  PASS  ' + label); }
  else      { fail += 1; console.log('  FAIL  ' + label); }
}

// =============================================================
// vm-sandbox with HT.share + HT.challenge wired
// =============================================================

function buildCtx(includeChallenge) {
  const HT = {
    storage: { _store: {} },
    $: function () { return null; },
    qsa: function () { return []; },
    qs: function () { return null; },
    debounce: function (fn) { return fn; },
    formatNumber: function (n) { return String(n); },
    formatDate: function (d) { return d.toISOString(); },
    copyToClipboard: function () { return Promise.resolve(); },
    toast: function (msg) { (HT._toastLog = HT._toastLog || []).push(msg); },
    share: {
      copy: function (state, opts) {
        (HT._shareCopyLog = HT._shareCopyLog || []).push({ state: state, opts: opts });
        return Promise.resolve();
      },
      print: function () {},
    },
    _shareCopyLog: [],
    _toastLog: [],
    shellThinLoaded: false,
    lazyLoad: function () { return Promise.resolve(); },
    lazyLoadCss: function () { return Promise.resolve(); },
    lazyLoadTool: function () { return Promise.resolve(); },
    history: { push: function () {} },
  };
  if (includeChallenge) {
    HT.challenge = {
      link: function (spec) {
        (HT._challengeLog = HT._challengeLog || []).push(spec);
        return 'https://example.com/?c=ABCDEF';
      },
      compare: function () { return { score: 0, axes: [] }; },
      verify: function () { return { ok: true }; },
    };
    HT._challengeLog = [];
  }

  const ctx = {
    HT: HT,
    window: { HT: HT, __htShellReplacesTheme: false },
    self:   { HT: HT },
    console: { warn: function () {}, log: function () {}, error: function () {} },
    document: {
      addEventListener: function () {},
      documentElement: { setAttribute: function () {}, getAttribute: function () { return null; } },
      readyState: 'complete',
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
      createElement: function (tag) { return makeFakeEl(tag); },
      createTextNode: function (text) {
        return { nodeType: 3, text: String(text) };
      },
      head: { appendChild: function () {} },
    },
    location: { href: 'http://localhost/quiz/test/', protocol: 'http:', pathname: '/quiz/test/' },
    history: { replaceState: function () {} },
    setTimeout: function (fn) { try { fn(); } catch (e) {} return 0; },
    clearTimeout: function () {},
    Object: Object, Array: Array, JSON: JSON, Promise: Promise, Error: Error,
    URLSearchParams: URLSearchParams, isFinite: isFinite, Math: Math,
    Promise: Promise,
  };
  ctx.global = ctx;
  return ctx;
}

function makeFakeEl(tag) {
  const el = {
    tag: tag, attrs: {}, dataset: {},
    classList: {
      _add: [], _remove: [],
      add: function () {
        for (var i = 0; i < arguments.length; i++) {
          if (this._add.indexOf(arguments[i]) === -1) this._add.push(arguments[i]);
        }
        var combined = (this._baseClass ? this._baseClass + ' ' : '') + this._add.join(' ');
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
        var combined = (this._baseClass ? this._baseClass + ' ' : '') + this._add.join(' ');
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
    _listeners: {},
    style: {},
    setAttribute: function (k, v) {
      this.attrs[k] = v;
      if (k === 'class') this.classList._baseClass = String(v);
    },
    getAttribute: function (k) { return this.attrs[k] || null; },
    appendChild: function (c) { this.children.push(c); return c; },
    addEventListener: function (name, fn) {
      this._listeners[name] = this._listeners[name] || [];
      this._listeners[name].push(fn);
    },
    removeEventListener: function () {},
    querySelectorAll: function (selector) {
      // Simple matcher: walk self + descendants, return nodes with
      // matching class or attribute selectors. Just enough for the
      // wireActions code path which queries [data-print="ignore"]
      // and [data-action="share"|"challenge"].
      var matched = [];
      function walk(node) {
        if (!node || typeof node !== 'object') return;
        if (node.attrs) {
          if (selector.charAt(0) === '[' && selector.indexOf('=') !== -1) {
            var m = selector.match(/^\[([^=]+)="([^"]+)"\]$/);
            if (m && node.attrs[m[1]] === m[2]) matched.push(node);
          }
        }
        if (node.children) for (var i = 0; i < node.children.length; i++) walk(node.children[i]);
      }
      walk(this);
      return matched;
    },
    querySelector: function (selector) {
      var all = this.querySelectorAll(selector);
      return all[0] || null;
    },
  };
  el.classList._owner = el;
  return el;
}

// =============================================================
// I. HT.results.wireActions is exposed
// =============================================================
console.log('--- I. HT.results.wireActions is exposed ---');
{
  const ctx = buildCtx(true);
  vm.runInContext(RESULTS_SRC, vm.createContext(ctx));
  check(
    typeof ctx.HT.results.wireActions === 'function',
    'HT.results.wireActions is a function on the frozen public API'
  );
}

// =============================================================
// II. wireActions attaches Share + Challenge listeners
// =============================================================
console.log('--- II. wireActions attaches Share + Challenge listeners ---');
{
  const ctx = buildCtx(true);
  vm.runInContext(RESULTS_SRC, vm.createContext(ctx));
  // Render a card; the deferred wireActions will fire via
  // Promise.resolve().then. Drive that with a manual call below.
  const card = ctx.HT.results.render(
    { traits: { calm: 80, bold: 30 }, archetype: { id: 'zen', label: 'Zen', emoji: '🧘' } },
    { title: 'You scored', conflict: 'You also said bold', slug: 'zen-test', answers: { q1: 'calm' } }
  );
  // Manually call wireActions to test the sync path (the deferred
  // call from render() needs a Promise microtask that the smoke
  // harness stub doesn't drain).
  ctx.HT.results.wireActions(card, card.__state || {}, {});
  // Walk to find action nodes + buttons.
  const actionsNode = card.querySelectorAll('[data-print="ignore"]')[0];
  check(!!actionsNode, 'card has a .quiz-result-actions node with data-print="ignore"');
  const shareBtn = actionsNode.querySelectorAll('[data-action="share"]')[0];
  const challengeBtn = actionsNode.querySelectorAll('[data-action="challenge"]')[0];
  check(!!shareBtn, 'actions row has a [data-action="share"] button');
  check(!!challengeBtn, 'actions row has a [data-action="challenge"] button');
  check(
    shareBtn && shareBtn._listeners && shareBtn._listeners.click && shareBtn._listeners.click.length >= 1,
    'Share button has a click listener attached'
  );
  check(
    challengeBtn && challengeBtn._listeners && challengeBtn._listeners.click && challengeBtn._listeners.click.length >= 1,
    'Challenge button has a click listener attached'
  );
}

// =============================================================
// III. Share click → HT.share.copy called with state + opts
// =============================================================
console.log('--- III. Share click invokes HT.share.copy ---');
{
  const ctx = buildCtx(true);
  vm.runInContext(RESULTS_SRC, vm.createContext(ctx));
  const card = ctx.HT.results.render(
    { traits: { calm: 80 }, archetype: { id: 'zen', label: 'Zen', emoji: '🧘' } },
    { slug: 'zen-test', answers: { q1: 'calm' } }
  );
  ctx.HT.results.wireActions(card, {}, { slug: 'zen-test' });
  const actionsNode = card.querySelectorAll('[data-print="ignore"]')[0];
  const shareBtn = actionsNode.querySelectorAll('[data-action="share"]')[0];
  // Fire click
  if (shareBtn && shareBtn._listeners.click) {
    for (var i = 0; i < shareBtn._listeners.click.length; i++) {
      try { shareBtn._listeners.click[i]({ preventDefault: function () {} }); } catch (e) {}
    }
  }
  check(
    ctx.HT._shareCopyLog && ctx.HT._shareCopyLog.length >= 1,
    'Share button click invoked HT.share.copy (got ' + (ctx.HT._shareCopyLog || []).length + ' calls)'
  );
}

// Separate sync block: drain the Promise microtask before asserting
// on the toast log. The Share click handler chains a `.then(...)`
// that calls HT.toast — which is async; the synchronous test loop
// above checks _toastLog BEFORE the microtask runs. We use the
// global Promise.resolve().then() to drain the microtask queue
// synchronously by polling via setImmediate — simpler: just
// replace HT.share.copy with a sync resolver so we can assert
// the toast without race conditions.
console.log('--- III.b. Share click toast (sync HT.share.copy) ---');
{
  const ctx = buildCtx(true);
  // Replace the async HT.share.copy with a sync one for the
  // toast-drain assertion.
  ctx.HT.share.copy = function () { return { then: function (resolve) { resolve(); return { then: function () { return this; } }; } }; };
  vm.runInContext(RESULTS_SRC, vm.createContext(ctx));
  const card = ctx.HT.results.render(
    { traits: { calm: 80 }, archetype: { id: 'zen', label: 'Zen', emoji: '🧘' } },
    { slug: 'zen-test' }
  );
  ctx.HT.results.wireActions(card, {}, { slug: 'zen-test' });
  const actionsNode = card.querySelectorAll('[data-print="ignore"]')[0];
  const shareBtn = actionsNode.querySelectorAll('[data-action="share"]')[0];
  if (shareBtn && shareBtn._listeners.click) {
    for (var i = 0; i < shareBtn._listeners.click.length; i++) {
      try { shareBtn._listeners.click[i]({ preventDefault: function () {} }); } catch (e) {}
    }
  }
  check(
    ctx.HT._toastLog && ctx.HT._toastLog.length >= 1,
    'Share button click surfaced a toast notification (got ' +
      (ctx.HT._toastLog || []).length + ' toast calls)'
  );
}

// =============================================================
// IV. Challenge click → HT.challenge.link called + shareUrl copied
// =============================================================
console.log('--- IV. Challenge click invokes HT.challenge.link + share ---');
{
  const ctx = buildCtx(true);
  vm.runInContext(RESULTS_SRC, vm.createContext(ctx));
  const card = ctx.HT.results.render(
    { traits: { calm: 80 }, archetype: { id: 'zen', label: 'Zen', emoji: '🧘' } },
    { slug: 'zen-test', answers: { q1: 'calm', q2: 'bold' } }
  );
  ctx.HT.results.wireActions(card, {}, { slug: 'zen-test', answers: { q1: 'calm', q2: 'bold' } });
  const actionsNode = card.querySelectorAll('[data-print="ignore"]')[0];
  const challengeBtn = actionsNode.querySelectorAll('[data-action="challenge"]')[0];
  if (challengeBtn && challengeBtn._listeners.click) {
    for (var j = 0; j < challengeBtn._listeners.click.length; j++) {
      try { challengeBtn._listeners.click[j]({ preventDefault: function () {} }); } catch (e) {}
    }
  }
  check(
    ctx.HT._challengeLog && ctx.HT._challengeLog.length >= 1,
    'Challenge button click invoked HT.challenge.link (got ' + (ctx.HT._challengeLog || []).length + ' calls)'
  );
  check(
    ctx.HT._shareCopyLog && ctx.HT._shareCopyLog.length >= 1,
    'Challenge button click invoked HT.share.copy for the resulting URL'
  );
}

// =============================================================
// V. Challenge button hidden when HT.challenge is absent
// =============================================================
console.log('--- V. Challenge button hidden when HT.challenge is absent ---');
{
  const ctx = buildCtx(false);  // no HT.challenge
  vm.runInContext(RESULTS_SRC, vm.createContext(ctx));
  const card = ctx.HT.results.render(
    { traits: { calm: 80 }, archetype: { id: 'car', label: 'Sedan', emoji: '🚗' } },
    { slug: 'car-finder' }
  );
  ctx.HT.results.wireActions(card, {}, { slug: 'car-finder' });
  const actionsNode = card.querySelectorAll('[data-print="ignore"]')[0];
  const challengeBtn = actionsNode.querySelectorAll('[data-action="challenge"]')[0];
  check(
    challengeBtn && challengeBtn.attrs && challengeBtn.attrs.hidden !== undefined,
    'Challenge button is hidden when HT.challenge is absent (utility-category opt-out)'
  );
  check(
    challengeBtn && challengeBtn.attrs && challengeBtn.attrs['aria-hidden'] === 'true',
    'Challenge button has aria-hidden="true" when hidden'
  );
}

// =============================================================
// VI. wireActions idempotency
// =============================================================
console.log('--- VI. wireActions idempotency ---');
{
  const ctx = buildCtx(true);
  vm.runInContext(RESULTS_SRC, vm.createContext(ctx));
  const card = ctx.HT.results.render(
    { traits: { calm: 80 }, archetype: { id: 'zen', label: 'Zen', emoji: '🧘' } },
    { slug: 'zen-test' }
  );
  ctx.HT.results.wireActions(card, {}, { slug: 'zen-test' });
  const firstShareBtn = card.querySelectorAll('[data-print="ignore"]')[0]
    .querySelectorAll('[data-action="share"]')[0];
  const firstShareListeners = firstShareBtn._listeners.click
    ? firstShareBtn._listeners.click.length : 0;
  // Call wireActions again — should be a no-op
  ctx.HT.results.wireActions(card, {}, { slug: 'zen-test' });
  const secondShareBtn = card.querySelectorAll('[data-print="ignore"]')[0]
    .querySelectorAll('[data-action="share"]')[0];
  const secondShareListeners = secondShareBtn._listeners.click
    ? secondShareBtn._listeners.click.length : 0;
  check(
    firstShareListeners === secondShareListeners && firstShareListeners >= 1,
    'wireActions is idempotent — second call did not double-bind (' +
    firstShareListeners + ' → ' + secondShareListeners + ')'
  );
}

// =============================================================
// VII. shell-bounds-check — no bare clipboard / localStorage / fetch
// =============================================================
console.log('--- VII. shell-bounds-check — no bare clipboard / localStorage / fetch ---');
{
  const stripped = RESULTS_SRC
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const hasNavigatorClipboard = /\bnavigator\.clipboard\b/.test(stripped);
  const hasLocalStorage = /\blocalStorage\./.test(stripped);
  const hasFetch = /\bfetch\s*\(/.test(stripped);
  const hasXHR = /\b(XMLHttpRequest|new\s+XHR)\b/.test(stripped);
  const hasWindowPrint = /\bwindow\.print\b/.test(stripped);
  check(
    !hasNavigatorClipboard && !hasLocalStorage && !hasFetch && !hasXHR && !hasWindowPrint,
    'results.js contains no navigator.clipboard / localStorage / fetch / XHR / window.print'
  );
}

// =============================================================
// VIII. bundle-size-gate — results.js stays under 6 KB gz
// =============================================================
console.log('--- VIII. bundle-size-gate — results.js ≤ 6 KB gz ---');
{
  const zlib = require('zlib');
  const gz = zlib.gzipSync(RESULTS_SRC).length;
  check(
    gz <= 6144,
    'gzipped results.js ≤ 6,144 bytes (got ' + gz + ')'
  );
  check(
    /SPEC_PAGE_CONDITIONAL_MODULES[\s\S]*?"assets\/js\/results\.js"/m.test(BSG_SRC),
    'scripts/bundle-size-gate.py still lists results.js in SPEC_PAGE_CONDITIONAL_MODULES'
  );
}

// =============================================================
// IX. vacuous-pass guard
// =============================================================
check(pass + fail > 0, 'at least one assertion ran (vacuous-pass guard)');

console.log('\nJSON:{"story": "10.10", "pass": ' + pass + ', "fail": ' + fail + '}');
process.exit(fail === 0 ? 0 : 1);