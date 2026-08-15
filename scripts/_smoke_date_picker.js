#!/usr/bin/env node
/* Story 9.19 Phase 1 — date-picker.js + chrome-date-picker.css
   lazy-load smoke.

   Verifies the shell-thin.js Proxy factory wiring for datePicker:
     - shell-thin.js loads via vm sandbox
     - HT.datePicker is a Proxy (not a plain object)
     - HT.datePicker exposes a callable for any method name (the Proxy
       factory returns a function for every prop access)
     - First call to HT.datePicker.enhance(...) fires HT.lazyLoad
       ('assets/js/date-picker.js') AND HT.lazyLoadCss
       ('assets/css/chrome-date-picker.css') in parallel, then resolves
       to the real date-picker.js HT.datePicker.enhance()
     - Phase 1 only: sections IV–X (grid render, ISO round-trip,
       min/max, selection writes input.value, keyboard nav, Esc closes
       + focus returns, regression — no eager tags) are deferred to
       Phase 2. This Phase 1 harness ships sections I–III.

   Pure-Node smoke (no jsdom / playwright). Runs in a vm sandbox with
   minimal HT + dom stubs. Mirrors scripts/_smoke_quiz_proxy.js.

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
const DATE_PICKER_SRC = fs.readFileSync(path.join(REPO_ROOT, 'assets/js/date-picker.js'), 'utf8');

let pass = 0;
let fail = 0;
function check(cond, label) {
  if (cond) { pass += 1; console.log('  PASS  ' + label); }
  else      { fail += 1; console.log('  FAIL  ' + label); }
}

// =============================================================
// Minimal HT + dom stubs (mirror _smoke_quiz_proxy.js:57-115)
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
    console: { warn: function () {}, log: function () {}, error: function () {} },
    document: {
      addEventListener: function () {},
      documentElement: { setAttribute: function () {}, getAttribute: function () { return null; } },
      readyState: 'loading',
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
      // Phase 1: _buildDialogShell() needs createElement('dialog'|'form'|'header'|'button'|'div'|'span'|'footer') that returns
      // a node the el() helper can append children to. Tiny stub — Phase 2
      // smoke will add the full grid + backdrop wiring.
      createElement: function (tag) {
        const node = {
          tagName: tag.toUpperCase(),
          nodeType: 1,
          nodeName: tag.toUpperCase(),
          childNodes: [],
          className: '',
          textContent: '',
          innerHTML: '',
          attributes: {},
          _listeners: {},
          _appendChild: function (child) { this.childNodes.push(child); },
          appendChild: function (child) { this._appendChild(child); return child; },
          removeChild: function (child) {
            const idx = this.childNodes.indexOf(child);
            if (idx >= 0) this.childNodes.splice(idx, 1);
            return child;
          },
          addEventListener: function (type, handler) {
            (this._listeners[type] = this._listeners[type] || []).push(handler);
          },
          removeEventListener: function (type, handler) {
            if (this._listeners[type]) {
              this._listeners[type] = this._listeners[type].filter(function (h) { return h !== handler; });
            }
          },
          dispatchEvent: function (ev) {
            const handlers = this._listeners[ev.type] || [];
            for (let i = 0; i < handlers.length; i += 1) {
              try { handlers[i](ev); } catch (_) {}
            }
            return true;
          },
          setAttribute: function (k, v) { this.attributes[k] = String(v); },
          getAttribute: function (k) { return this.attributes[k] || null; },
          hasAttribute: function (k) { return Object.prototype.hasOwnProperty.call(this.attributes, k); },
          removeAttribute: function (k) { delete this.attributes[k]; },
          focus: function () {},
          click: function () {},
          // Native <dialog> surface — stubbed so _openDialog() can
          // mark state.isOpen = true and proceed.
          _open: false,
          showModal: function () { this._open = true; },
          close: function () { this._open = false; },
          scrollIntoView: function () {},
          get open() { return this._open; },
          style: {},
          querySelector: function () { return null; },
          querySelectorAll: function () { return []; },
          closest: function () { return null; },
          getBoundingClientRect: function () {
            return { top: 0, left: 0, right: 100, bottom: 30, width: 100, height: 30 };
          },
          get firstChild() { return this.childNodes[0] || null; },
        };
        // dataset[date] = v writes data-date attribute via setAttribute.
        // Mirror the browser's DOMStringMap. Created per-node so each
        // cell's dataset is independent.
        node.dataset = new Proxy({}, {
          set: function (_t, k, v) {
            node.setAttribute('data-' + k, String(v));
            return true;
          },
          get: function (_t, k) {
            return node.getAttribute('data-' + k);
          },
        });
        return node;
      },
      createDocumentFragment: function () {
        return {
          childNodes: [],
          appendChild: function (child) { this.childNodes.push(child); return child; },
        };
      },
      body: {
        appendChild: function (child) {
          // Capture dialog appended so smoke §III can introspect.
          if (this._appended === undefined) this._appended = [];
          this._appended.push(child);
          return child;
        },
      },
      head: { appendChild: function () {} },
      activeElement: null,
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    // URL must be exposed explicitly — vm contexts don't inherit
    // Node's globals by default. shell-thin.js uses `new URL(...)`
    // in the resolveUrl base computation (Story 9.13 fix for tool-
    // page 404s on assets/js/*.js).
    URL: typeof URL !== 'undefined' ? URL : function () {},
    URLSearchParams: URLSearchParams,
    performance: { now: function () { return Date.now(); } },
    // Event constructor stub for date-picker.js's
    // `new Event('input', {bubbles: true})` calls. Returns a plain
    // object the smoke stub's dispatchEvent() picks up via ev.type.
    Event: function Event(type, init) {
      this.type = type;
      this.bubbles = !!(init && init.bubbles);
    },
    Object: Object,
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
// I. shell-thin.js loads + HT.datePicker is a Proxy
// =============================================================
console.log('--- I. shell-thin.js Proxy stubs ---');
{
  const ctx = buildCtx();
  check(loadInto(ctx, SHELL_THIN_SRC, 'shell-thin.js'), 'shell-thin.js loads via vm without throwing');
  check(!!ctx.HT.datePicker, 'HT.datePicker is exposed');
  // The Proxy factory's default `get` returns a function for any
  // property access. So HT.datePicker.enhance should be a function.
  check(typeof ctx.HT.datePicker.enhance === 'function', 'HT.datePicker.enhance is a function (Proxy factory returns callable for any prop)');
  check(typeof ctx.HT.datePicker.open === 'function', 'HT.datePicker.open is a function');
  check(typeof ctx.HT.datePicker.close === 'function', 'HT.datePicker.close is a function');
  check(typeof ctx.HT.datePicker.destroy === 'function', 'HT.datePicker.destroy is a function');
  check(typeof ctx.HT.datePicker.isOpen === 'function', 'HT.datePicker.isOpen is a function');
  // Lazy-load has NOT been triggered yet (Proxy only fires on access).
  check(ctx.HT._lazyLog.js.length === 0, 'no lazy-load fired before HT.datePicker.<method>() called');
  check(ctx.HT._lazyLog.css.length === 0, 'no lazy-loadCss fired before HT.datePicker.<method>() called');
}

// =============================================================
// II. HT.datePicker.enhance() triggers lazy-load + lazy-loadCss
// =============================================================
console.log('--- II. HT.datePicker.enhance() fires lazy-load + lazy-loadCss ---');
{
  const ctx = buildCtx();
  loadInto(ctx, SHELL_THIN_SRC, 'shell-thin.js (for II)');

  // Stub input that matches the contract: <input type="date">.
  const stubInput = {
    tagName: 'INPUT',
    nodeName: 'INPUT',
    type: 'date',
    id: 'ls-dob',
    name: 'dob',
    value: '',
    min: '',
    max: '',
    className: 'input js-date-picker',
    classList: {
      contains: function (cls) { return (' ' + stubInput.className + ' ').indexOf(' ' + cls + ' ') >= 0; },
      add: function () {},
      remove: function () {},
    },
    attributes: { type: 'date', class: 'input js-date-picker', id: 'ls-dob', name: 'dob' },
    setAttribute: function (k, v) { this.attributes[k] = String(v); },
    getAttribute: function (k) { return this.attributes[k] || null; },
    addEventListener: function () {},
    removeEventListener: function () {},
    focus: function () {},
    dispatchEvent: function () { return true; },
  };

  // Capture the Promise from the Proxy — the Proxy factory returns
  // a function that returns a Promise. We invoke it with the stub
  // input + opts. The lazy-load will resolve immediately (stub),
  // then the Proxy forwards to HT.datePicker.enhance — which is
  // still the Proxy unless the load synchronously ran date-picker.js
  // (it didn't). So the call resolves to a Promise that rejects
  // with "no .enhance function on the proxy after lazy-load". That's
  // OK — we only need to verify the lazy-load side effect.
  const callResult = ctx.HT.datePicker.enhance(stubInput, {});
  check(callResult && typeof callResult.then === 'function', 'HT.datePicker.enhance(...) returns a Promise');
  // Synchronously after the call, the lazy-load stubs should have fired.
  check(ctx.HT._lazyLog.js.indexOf('assets/js/date-picker.js') >= 0, 'HT.lazyLoad("assets/js/date-picker.js") was called');
  check(ctx.HT._lazyLog.css.indexOf('assets/css/chrome-date-picker.css') >= 0, 'HT.lazyLoadCss("assets/css/chrome-date-picker.css") was called');

  // Drain the promise chain so the test doesn't leave dangling work.
  callResult.then(function () {}, function () {});
}

// =============================================================
// III. After module load, HT.datePicker exposes the real public API
// =============================================================
console.log('--- III. After lazy-load resolves, real API surface is exposed ---');
{
  const ctx = buildCtx();
  loadInto(ctx, SHELL_THIN_SRC, 'shell-thin.js (for III)');

  // Pre-register the real date-picker.js IIFE in the vm BEFORE the
  // Proxy call so the Proxy's Promise resolves to the real API.
  loadInto(ctx, DATE_PICKER_SRC, 'date-picker.js (real)');

  // Sanity check: date-picker.js exposes the frozen public API on
  // window.HT.datePicker.
  check(typeof ctx.HT.datePicker.enhance === 'function', 'real HT.datePicker.enhance is a function');
  check(typeof ctx.HT.datePicker.open === 'function', 'real HT.datePicker.open is a function');
  check(typeof ctx.HT.datePicker.close === 'function', 'real HT.datePicker.close is a function');
  check(typeof ctx.HT.datePicker.destroy === 'function', 'real HT.datePicker.destroy is a function');
  check(typeof ctx.HT.datePicker.isOpen === 'function', 'real HT.datePicker.isOpen is a function');

  // Stub input matching the contract.
  const stubInput = {
    tagName: 'INPUT',
    nodeName: 'INPUT',
    type: 'date',
    id: 'ls-dob',
    name: 'dob',
    value: '1995-01-15',
    min: '',
    max: '',
    className: 'input js-date-picker',
    classList: {
      contains: function (cls) { return (' ' + stubInput.className + ' ').indexOf(' ' + cls + ' ') >= 0; },
      add: function () {},
      remove: function () {},
    },
    attributes: { type: 'date', class: 'input js-date-picker', id: 'ls-dob', name: 'dob', value: '1995-01-15' },
    setAttribute: function (k, v) { this.attributes[k] = String(v); },
    getAttribute: function (k) { return this.attributes[k] || null; },
    addEventListener: function () {},
    removeEventListener: function () {},
    focus: function () {},
    dispatchEvent: function () { return true; },
  };

  // Phase 1 stub contract: enhance() returns a handle with
  // { open, close, destroy, isOpen, _state }. Stub _ensureDialog
  // returns null because document.body is a stub — Phase 2 will
  // exercise the full DOM build.
  const handle = ctx.HT.datePicker.enhance(stubInput, {});
  check(!!handle, 'enhance() returned a handle');
  check(handle && typeof handle.open === 'function', 'handle.open is a function');
  check(handle && typeof handle.close === 'function', 'handle.close is a function');
  check(handle && typeof handle.destroy === 'function', 'handle.destroy is a function');
  check(handle && typeof handle.isOpen === 'function', 'handle.isOpen is a function');
  check(handle && !!handle._state, 'handle._state is exposed');
  check(handle && handle._state && handle._state.input === stubInput, 'handle._state.input === stub input');

  // Phase 1 stub: open()/close() just toggle the isOpen flag.
  check(handle.isOpen() === false, 'isOpen() is false before open()');
  handle.open();
  check(handle.isOpen() === true, 'isOpen() is true after open()');
  handle.close();
  check(handle.isOpen() === false, 'isOpen() is false after close()');

  // destroy() drops the instance.
  handle.destroy();
  check(handle.isOpen() === false, 'isOpen() is false after destroy()');
}

// =============================================================
// IV. enhance() rejects non-supported inputs; accepts date + time
// =============================================================
console.log('--- IV. enhance() input contract enforcement ---');
{
  const ctx = buildCtx();
  loadInto(ctx, SHELL_THIN_SRC, 'shell-thin.js (for IV)');
  loadInto(ctx, DATE_PICKER_SRC, 'date-picker.js (for IV)');

  // Wrong tag.
  let threw = false;
  try {
    ctx.HT.datePicker.enhance({ tagName: 'DIV', type: 'date' }, {});
  } catch (e) {
    threw = true;
    check(/must be <input>/.test(e.message), 'enhance(<div>) threw a clear error mentioning <input>');
  }
  check(threw, 'enhance() threw on non-INPUT element');

  // Wrong type — text. Story 9.19.1: time is accepted; date is
  // accepted; anything else (e.g., text) is rejected with a clear
  // error mentioning the accepted types.
  threw = false;
  try {
    ctx.HT.datePicker.enhance({ tagName: 'INPUT', type: 'text' }, {});
  } catch (e) {
    threw = true;
    check(/type must be/.test(e.message) && /date/.test(e.message) && /time/.test(e.message),
      'enhance(<input type="text">) threw a clear error mentioning accepted types');
  }
  check(threw, 'enhance() threw on <input type="text">');

  // time is accepted (Story 9.19.1).
  let accepted = false;
  try {
    const stubTimeInput = {
      tagName: 'INPUT', nodeName: 'INPUT', type: 'time',
      id: 'wc-mtg-time', name: 'mtg-time', value: '',
      min: '', max: '', className: 'input js-time-picker',
      attributes: { type: 'time', class: 'input js-time-picker' },
      setAttribute: function () {}, getAttribute: function () { return null; },
      addEventListener: function () {}, removeEventListener: function () {},
      focus: function () {}, dispatchEvent: function () { return true; },
      classList: { contains: function () { return false; }, add: function () {}, remove: function () {} },
      getBoundingClientRect: function () { return { top: 0, left: 0, right: 100, bottom: 30, width: 100, height: 30 }; },
    };
    const h = ctx.HT.datePicker.enhance(stubTimeInput, {});
    if (h && typeof h.open === 'function') accepted = true;
  } catch (e) { /* should not throw */ }
  check(accepted, 'enhance(<input type="time">) does NOT throw and returns a handle');

  // null/undefined.
  threw = false;
  try { ctx.HT.datePicker.enhance(null, {}); } catch (e) { threw = true; }
  check(threw, 'enhance(null) threw');

  threw = false;
  try { ctx.HT.datePicker.enhance(undefined, {}); } catch (e) { threw = true; }
  check(threw, 'enhance(undefined) threw');
}

// =============================================================
// V. regression — no eager tags in index.html or lifespan HTML
// =============================================================
console.log('--- V. eager-tag strip + 7-tool opt-in ---');
{
  const indexHtml = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
  check(!/src=["'][^"']*assets\/js\/date-picker\.js["']/.test(indexHtml), 'index.html has no <script src="assets/js/date-picker.js">');
  check(!/href=["'][^"']*assets\/css\/chrome-date-picker\.css["']/.test(indexHtml), 'index.html has no <link href="assets/css/chrome-date-picker.css">');

  // Helper — does the html carry js-date-picker on the given input id?
  function hasClassOn(html, id) {
    const a = new RegExp('id=["\']' + id + '["\'][^>]*class=["\'][^"\']*js-date-picker').test(html);
    const b = new RegExp('class=["\'][^"\']*js-date-picker[^"\']*["\'][^>]*id=["\']' + id + '["\']').test(html);
    return a || b;
  }

  // Story 9.19 rollout — 7 tools have opted in. The remaining
  // ~37 native <input type="date"> across the other tools stay
  // native (default off, opt-in only).
  const toolFixtures = [
    { slug: 'lifespan-simulator', inputs: ['ls-dob', 'ls-dob-f'],       handlersFile: 'lifespan-simulator-handlers.js' },
    { slug: 'age-calculator',     inputs: ['dob', 't-dob'],              handlersFile: 'age-calculator.js' },
    { slug: 'date-difference',    inputs: ['start', 'end'],              handlersFile: 'date-difference.js' },
    { slug: 'countdown-to-date',  inputs: ['cd-date'],                   handlersFile: 'countdown-to-date.js' },
    { slug: 'world-clock',        inputs: ['wc-mtg-date'],               handlersFile: 'world-clock.js' },
    { slug: 'loan-calculator',    inputs: ['start-date'],                handlersFile: 'loan-calculator.js' },
    { slug: 'space-calculator',   inputs: ['age-dob'],                   handlersFile: 'space-calculator.js' },
  ];
  for (const fx of toolFixtures) {
    const html = fs.readFileSync(path.join(REPO_ROOT, 'tools/' + fx.slug + '/index.html'), 'utf8');
    check(!/src=["'][^"']*assets\/js\/date-picker\.js["']/.test(html),
      'tools/' + fx.slug + '/index.html has no <script src="assets/js/date-picker.js">');
    check(!/href=["'][^"']*assets\/css\/chrome-date-picker\.css["']/.test(html),
      'tools/' + fx.slug + '/index.html has no <link href="assets/css/chrome-date-picker.css">');
    for (const id of fx.inputs) {
      check(hasClassOn(html, id),
        fx.slug + ': #' + id + ' carries js-date-picker class');
    }
    const src = fs.readFileSync(path.join(REPO_ROOT, 'tools/' + fx.slug + '/' + fx.handlersFile), 'utf8');
    check(/HT\.datePicker\.enhance/.test(src),
      fx.slug + '/' + fx.handlersFile + ' calls HT.datePicker.enhance()');
    check(/HT\.qsa\(['"]\.js-date-picker['"]\)/.test(src) ||
          /HT\.qsa\(['"][^'"]*\.js-date-picker[^'"]*['"]\)/.test(src) ||
          /HT\.\$\$\(['"]\.js-date-picker['"]\)/.test(src) ||
          /qsaAll|querySelectorAll.*\.js-date-picker/.test(src),
      fx.slug + '/' + fx.handlersFile + ' uses HT.qsa / querySelectorAll over .js-date-picker');
  }
}

// =============================================================
// VI. bundle-size-gate.py: date-picker moved to page-conditional
// =============================================================
console.log('--- VI. bundle-size-gate.py spec movement ---');
{
  const gate = fs.readFileSync(path.join(REPO_ROOT, 'scripts/bundle-size-gate.py'), 'utf8');

  // Extract SPEC_PAGE_CONDITIONAL_MODULES = [ ... ] block.
  const pcondMatch = gate.match(/SPEC_PAGE_CONDITIONAL_MODULES\s*=\s*\[([\s\S]*?)\]/);
  check(!!pcondMatch, 'SPEC_PAGE_CONDITIONAL_MODULES list found in gate');
  if (pcondMatch) {
    check(/["']assets\/js\/date-picker\.js["']/.test(pcondMatch[1]), 'date-picker.js IS in SPEC_PAGE_CONDITIONAL_MODULES');
  }

  // Extract LAZY_CSS_MODULES = [ ... ] block.
  const lazyMatch = gate.match(/LAZY_CSS_MODULES\s*=\s*\[([\s\S]*?)\]/);
  check(!!lazyMatch, 'LAZY_CSS_MODULES list found in gate');
  if (lazyMatch) {
    check(/["']assets\/css\/chrome-date-picker\.css["']/.test(lazyMatch[1]), 'chrome-date-picker.css IS in LAZY_CSS_MODULES');
    check(/["']assets\/css\/chrome-time-picker\.css["']/.test(lazyMatch[1]), 'chrome-time-picker.css IS in LAZY_CSS_MODULES (Story 9.19.1)');
  }

  // Baseline unchanged — page-conditional modules don't feed the
  // baseline (see scripts/bundle-size-gate.py:202-204). The date
  // picker is page-conditional, so adding it must NOT bump the
  // chrome baseline. If anyone bumps the baseline incorrectly while
  // shipping the date picker, this section fails.
  const baseMatch = gate.match(/BUNDLE_SIZE_BASELINE\s*=\s*(\d[\d_]*)/);
  check(!!baseMatch, 'BUNDLE_SIZE_BASELINE constant found');
  if (baseMatch) {
    const base = parseInt(baseMatch[1].replace(/_/g, ''), 10);
    check(base === 132638, 'BUNDLE_SIZE_BASELINE is unchanged at 132,638 gz (actual: ' + base + ')');
  }
}

// =============================================================
// VII. shell-thin.js resolves date-picker URL from tool pages
// =============================================================
console.log('--- VII. relative-URL resolution (tool-page regression guard) ---');
{
  const ctx = buildCtx();
  // Simulate the same scenario as quiz-proxy §VI: tool page loaded
  // shell-thin.js. Both home + tool pages resolve the script tag to
  // <origin>/assets/js/shell-thin.js (browser-resolved URL).
  ctx.document.currentScript = { src: 'http://127.0.0.1:5500/assets/js/shell-thin.js' };
  loadInto(ctx, SHELL_THIN_SRC, 'shell-thin.js (tool-page scenario)');

  const stubInput = {
    tagName: 'INPUT',
    nodeName: 'INPUT',
    type: 'date',
    id: 'ls-dob',
    name: 'dob',
    value: '',
    min: '',
    max: '',
    className: 'input js-date-picker',
    attributes: { type: 'date', class: 'input js-date-picker' },
    setAttribute: function (k, v) { this.attributes[k] = String(v); },
    getAttribute: function (k) { return this.attributes[k] || null; },
    addEventListener: function () {},
    removeEventListener: function () {},
    focus: function () {},
    dispatchEvent: function () { return true; },
  };
  const callResult = ctx.HT.datePicker.enhance(stubInput, {});
  callResult.then(function () {}, function () {});

  const firedJs  = ctx.HT._lazyLog.js;
  const firedCss = ctx.HT._lazyLog.css;

  const firedDpJs = firedJs.filter(function (u) { return /date-picker\.js/.test(u); })[0];
  check(!!firedDpJs, 'date-picker.js was lazy-loaded');
  if (firedDpJs) {
    check(firedDpJs.indexOf('tools/lifespan-simulator/assets/') === -1,
      'date-picker.js URL does NOT contain the buggy tools/<slug>/assets/ prefix (got: ' + firedDpJs + ')');
    check(/assets\/js\/date-picker\.js(\?|#|$)/.test(firedDpJs),
      'date-picker.js URL resolves to the assets/ root (got: ' + firedDpJs + ')');
  }

  const firedDpCss = firedCss.filter(function (u) { return /chrome-date-picker\.css/.test(u); })[0];
  check(!!firedDpCss, 'chrome-date-picker.css was lazy-loaded');
  if (firedDpCss) {
    check(firedDpCss.indexOf('tools/lifespan-simulator/assets/') === -1,
      'chrome-date-picker.css URL does NOT contain the buggy tools/<slug>/assets/ prefix (got: ' + firedDpCss + ')');
    check(/assets\/css\/chrome-date-picker\.css(\?|#|$)/.test(firedDpCss),
      'chrome-date-picker.css URL resolves to the assets/ root (got: ' + firedDpCss + ')');
  }
}

// =============================================================
// VIII. After open(), dialog grid renders 42 cells (6 rows × 7 cols)
// =============================================================
console.log('--- VIII. grid renders 42 cells after open() ---');
{
  const ctx = buildCtx();
  loadInto(ctx, SHELL_THIN_SRC, 'shell-thin.js (for VIII)');
  loadInto(ctx, DATE_PICKER_SRC, 'date-picker.js (for VIII)');

  const stubInput = {
    tagName: 'INPUT', nodeName: 'INPUT', type: 'date',
    id: 'ls-dob', name: 'dob', value: '2026-01-15',
    min: '', max: '', className: 'input js-date-picker',
    attributes: { type: 'date', class: 'input js-date-picker', id: 'ls-dob', name: 'dob', value: '2026-01-15' },
    setAttribute: function (k, v) { this.attributes[k] = String(v); },
    getAttribute: function (k) { return this.attributes[k] || null; },
    addEventListener: function () {}, removeEventListener: function () {},
    focus: function () {}, dispatchEvent: function () { return true; },
    classList: { contains: function () { return false; }, add: function () {}, remove: function () {} },
    getBoundingClientRect: function () { return { top: 0, left: 0, right: 100, bottom: 30, width: 100, height: 30 }; },
  };
  const handle = ctx.HT.datePicker.enhance(stubInput, {});
  handle.open();
  // The grid is state.dlg.grid. _renderGrid runs inside open().
  const grid = handle._state.dlg.grid;
  const cells = grid.childNodes.filter(function (n) {
    return n && n.nodeType === 1 && (n.className || '').indexOf('date-picker-day') >= 0;
  });
  check(cells.length === 42, 'grid renders 42 day cells (got ' + cells.length + ')');

  // The selected day (2026-01-15) should carry the --selected class.
  const selected = cells.filter(function (c) { return (c.className || '').indexOf('date-picker-day--selected') >= 0; });
  check(selected.length === 1, 'exactly one cell has --selected class (got ' + selected.length + ')');
  if (selected.length === 1) {
    check(selected[0].attributes['data-date'] === '2026-01-15',
      'the selected cell has data-date="2026-01-15" (got "' + selected[0].attributes['data-date'] + '")');
  }
  handle.destroy();
}

// =============================================================
// IX. ISO round-trip — data-date values are timezone-safe
// =============================================================
console.log('--- IX. data-date ISO round-trip ---');
{
  const ctx = buildCtx();
  loadInto(ctx, SHELL_THIN_SRC, 'shell-thin.js (for IX)');
  loadInto(ctx, DATE_PICKER_SRC, 'date-picker.js (for IX)');

  const stubInput = {
    tagName: 'INPUT', nodeName: 'INPUT', type: 'date',
    id: 'ls-dob', name: 'dob', value: '2026-01-15',
    min: '', max: '', className: 'input js-date-picker',
    attributes: { type: 'date', class: 'input js-date-picker', id: 'ls-dob', name: 'dob', value: '2026-01-15' },
    setAttribute: function (k, v) { this.attributes[k] = String(v); },
    getAttribute: function (k) { return this.attributes[k] || null; },
    addEventListener: function () {}, removeEventListener: function () {},
    focus: function () {}, dispatchEvent: function () { return true; },
    classList: { contains: function () { return false; }, add: function () {}, remove: function () {} },
    getBoundingClientRect: function () { return { top: 0, left: 0, right: 100, bottom: 30, width: 100, height: 30 }; },
  };
  const handle = ctx.HT.datePicker.enhance(stubInput, {});
  handle.open();
  const grid = handle._state.dlg.grid;
  const cells = grid.childNodes.filter(function (n) { return n && n.nodeType === 1; });

  // Every cell with data-date must round-trip through parseISO+toISO.
  let allValid = true;
  for (let i = 0; i < cells.length; i += 1) {
    const iso = cells[i].attributes['data-date'];
    if (!iso) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) { allValid = false; break; }
  }
  check(allValid, 'every cell data-date matches YYYY-MM-DD format');

  // No cell data-date should leak a Date.toString() or locale string.
  let noLeakage = true;
  for (let i = 0; i < cells.length; i += 1) {
    const iso = cells[i].attributes['data-date'];
    if (!iso) continue;
    if (/[A-Za-z]{3,}/.test(iso) || iso.indexOf('GMT') >= 0) { noLeakage = false; break; }
  }
  check(noLeakage, 'no cell data-date contains timezone or locale strings');

  handle.destroy();
}

// =============================================================
// X. min/max propagation — cells outside the bounds are disabled
// =============================================================
console.log('--- X. min/max propagation to grid ---');
{
  const ctx = buildCtx();
  loadInto(ctx, SHELL_THIN_SRC, 'shell-thin.js (for X)');
  loadInto(ctx, DATE_PICKER_SRC, 'date-picker.js (for X)');

  const stubInput = {
    tagName: 'INPUT', nodeName: 'INPUT', type: 'date',
    id: 'ls-dob', name: 'dob', value: '',
    min: '2026-01-15', max: '2026-01-20',
    className: 'input js-date-picker',
    attributes: { type: 'date', class: 'input js-date-picker', id: 'ls-dob', name: 'dob', min: '2026-01-15', max: '2026-01-20' },
    setAttribute: function (k, v) { this.attributes[k] = String(v); },
    getAttribute: function (k) { return this.attributes[k] || null; },
    addEventListener: function () {}, removeEventListener: function () {},
    focus: function () {}, dispatchEvent: function () { return true; },
    classList: { contains: function () { return false; }, add: function () {}, remove: function () {} },
    getBoundingClientRect: function () { return { top: 0, left: 0, right: 100, bottom: 30, width: 100, height: 30 }; },
  };
  const handle = ctx.HT.datePicker.enhance(stubInput, {});
  handle.open();
  // View defaults to today (no value). Set view to Jan 2026 so we
  // exercise the bounds.
  handle._state.view = { y: 2026, m: 1 };
  // Re-render by closing + opening. Simpler: call _renderGrid via
  // a known path. We don't have a direct hook, so re-open.
  handle.close();
  // Re-open will use today's month — reset via direct view mutation
  // then trigger a render by opening again.
  // For the smoke we want to test that min/max propagate. The view
  // resets to today on open; instead, verify state.minIso / state.maxIso
  // are read correctly from the input.
  handle._state.view = { y: 2026, m: 1 };
  // The grid was last rendered for today's month; trigger another
  // render by calling open() again — open() reads min/max from input
  // and renders the view month. To force the view to Jan 2026, we
  // first set state.view to { y: 2026, m: 1 } after read.
  handle._state.input = stubInput; // ensure ref
  // Render manually via the state. We don't expose _renderGrid, but
  // we can call open() and then mutate state.view + close+open.
  // Simplest: call open() with value set, then re-open with view forced.
  stubInput.value = '2026-01-17';
  handle.open();
  // After open() with value '2026-01-17', view = Jan 2026 and grid rendered.
  const grid = handle._state.dlg.grid;
  const cells = grid.childNodes.filter(function (n) { return n && n.nodeType === 1 && (n.className || '').indexOf('date-picker-day') >= 0; });

  let disabledCount = 0;
  let enabledInBounds = 0;
  let disabledOutOfBounds = 0;
  for (let i = 0; i < cells.length; i += 1) {
    const c = cells[i];
    const iso = c.attributes['data-date'];
    if (!iso) continue;
    const inBounds = iso >= '2026-01-15' && iso <= '2026-01-20';
    if (c.attributes.disabled === '' || c.disabled === true) {
      disabledCount += 1;
      if (!inBounds) disabledOutOfBounds += 1;
    } else if (inBounds) {
      enabledInBounds += 1;
    }
  }
  check(disabledOutOfBounds >= 28,
    'cells outside [2026-01-15, 2026-01-20] are disabled (got ' + disabledOutOfBounds + ' out-of-bounds disabled)');
  check(enabledInBounds === 6,
    'cells inside the bounds [2026-01-15..20] are enabled (got ' + enabledInBounds + ' enabled in-bounds)');
  handle.destroy();
}

// =============================================================
// XI. selection writes input.value + fires change/input events
// =============================================================
console.log('--- XI. selection writes input.value + fires events ---');
{
  const ctx = buildCtx();
  loadInto(ctx, SHELL_THIN_SRC, 'shell-thin.js (for XI)');
  loadInto(ctx, DATE_PICKER_SRC, 'date-picker.js (for XI)');

  let inputFired = 0;
  let changeFired = 0;
  const stubInput = {
    tagName: 'INPUT', nodeName: 'INPUT', type: 'date',
    id: 'ls-dob', name: 'dob', value: '',
    min: '', max: '', className: 'input js-date-picker',
    attributes: { type: 'date', class: 'input js-date-picker', id: 'ls-dob', name: 'dob' },
    _listeners: {},
    setAttribute: function (k, v) { this.attributes[k] = String(v); },
    getAttribute: function (k) { return this.attributes[k] || null; },
    addEventListener: function (type, handler) {
      (this._listeners[type] = this._listeners[type] || []).push(handler);
    },
    removeEventListener: function (type, handler) {
      if (this._listeners[type]) {
        this._listeners[type] = this._listeners[type].filter(function (h) { return h !== handler; });
      }
    },
    dispatchEvent: function (ev) {
      const handlers = this._listeners[ev.type] || [];
      for (let i = 0; i < handlers.length; i += 1) {
        try { handlers[i](ev); } catch (_) {}
      }
      if (ev && ev.type === 'input')  inputFired += 1;
      if (ev && ev.type === 'change') changeFired += 1;
      return true;
    },
    focus: function () {},
    classList: { contains: function () { return false; }, add: function () {}, remove: function () {} },
    getBoundingClientRect: function () { return { top: 0, left: 0, right: 100, bottom: 30, width: 100, height: 30 }; },
  };
  const handle = ctx.HT.datePicker.enhance(stubInput, {});
  // Pre-set the value so open() opens to Jan 2026 view (not today).
  stubInput.value = '2026-01-15';
  handle.open();

  // Drive the grid click handler. dispatchEvent on the grid delegates
  // to the registered click listener, which calls
  // e.target.closest('.date-picker-day'). Our stub's closest()
  // returns null, so we monkey-patch closest() on the cell to return
  // itself before dispatching.
  const state = handle._state;
  const grid = state.dlg.grid;
  const targetCell = grid.childNodes.filter(function (n) {
    return n && n.nodeType === 1 && n.attributes['data-date'] === '2026-01-20';
  })[0];
  check(!!targetCell, 'target cell for 2026-01-20 exists in the grid (view = Jan 2026)');

  if (targetCell) {
    // Wire closest to return self so the delegated click handler
    // picks the cell up.
    targetCell.closest = function (sel) {
      if (sel === '.date-picker-day') return targetCell;
      return null;
    };
    grid.dispatchEvent({ type: 'click', target: targetCell });

    // After click, input.value should be 2026-01-20 + events fired.
    check(stubInput.value === '2026-01-20',
      'click on day cell writes input.value (got "' + stubInput.value + '")');
    check(inputFired === 1,
      'input event fired exactly once after click (got ' + inputFired + ')');
    check(changeFired === 1,
      'change event fired exactly once after click (got ' + changeFired + ')');
    check(handle.isOpen() === false,
      'dialog closes after selection');
    check(stubInput.id === 'ls-dob', 'id preserved on input');
    check(stubInput.name === 'dob', 'name preserved on input');
    check(stubInput.className.indexOf('js-date-picker') >= 0,
      'class preserved on input');
    check(stubInput.min === '', 'min attribute preserved (empty)');
    check(stubInput.max === '', 'max attribute preserved (empty)');
  }
  handle.destroy();
}

// =============================================================
// XII. keyboard navigation — arrows / PgUp/PgDn / Home/End / T
// =============================================================
console.log('--- XII. keyboard navigation ---');
{
  const ctx = buildCtx();
  loadInto(ctx, SHELL_THIN_SRC, 'shell-thin.js (for XII)');
  loadInto(ctx, DATE_PICKER_SRC, 'date-picker.js (for XII)');

  const stubInput = {
    tagName: 'INPUT', nodeName: 'INPUT', type: 'date',
    id: 'ls-dob', name: 'dob', value: '2026-01-15',
    min: '', max: '', className: 'input js-date-picker',
    attributes: { type: 'date', class: 'input js-date-picker', id: 'ls-dob', name: 'dob', value: '2026-01-15' },
    setAttribute: function (k, v) { this.attributes[k] = String(v); },
    getAttribute: function (k) { return this.attributes[k] || null; },
    addEventListener: function () {}, removeEventListener: function () {},
    focus: function () {}, dispatchEvent: function () { return true; },
    classList: { contains: function () { return false; }, add: function () {}, remove: function () {} },
    getBoundingClientRect: function () { return { top: 0, left: 0, right: 100, bottom: 30, width: 100, height: 30 }; },
  };
  const handle = ctx.HT.datePicker.enhance(stubInput, {});
  handle.open();
  const state = handle._state;
  check(state.focusedIso === '2026-01-15', 'focus starts on the value (2026-01-15)');

  // ArrowRight → +1 day
  state.dlg.dlg.dispatchEvent({ type: 'keydown', key: 'ArrowRight', preventDefault: function () {}, shiftKey: false });
  check(state.focusedIso === '2026-01-16', 'ArrowRight moves focusedIso +1 day');

  // ArrowLeft → -1 day
  state.dlg.dlg.dispatchEvent({ type: 'keydown', key: 'ArrowLeft', preventDefault: function () {}, shiftKey: false });
  check(state.focusedIso === '2026-01-15', 'ArrowLeft moves focusedIso -1 day');

  // ArrowDown → +7 days
  state.dlg.dlg.dispatchEvent({ type: 'keydown', key: 'ArrowDown', preventDefault: function () {}, shiftKey: false });
  check(state.focusedIso === '2026-01-22', 'ArrowDown moves focusedIso +7 days');

  // ArrowUp → -7 days
  state.dlg.dlg.dispatchEvent({ type: 'keydown', key: 'ArrowUp', preventDefault: function () {}, shiftKey: false });
  check(state.focusedIso === '2026-01-15', 'ArrowUp moves focusedIso -7 days');

  // PageDown → next month
  state.dlg.dlg.dispatchEvent({ type: 'keydown', key: 'PageDown', preventDefault: function () {}, shiftKey: false });
  check(state.view.m === 2, 'PageDown shifts view to next month (Feb 2026)');

  // PageUp → previous month
  state.dlg.dlg.dispatchEvent({ type: 'keydown', key: 'PageUp', preventDefault: function () {}, shiftKey: false });
  check(state.view.m === 1, 'PageUp shifts view to previous month (Jan 2026)');

  // Shift+PageDown → +1 year
  state.dlg.dlg.dispatchEvent({ type: 'keydown', key: 'PageDown', preventDefault: function () {}, shiftKey: true });
  check(state.view.y === 2027, 'Shift+PageDown shifts view +1 year');

  // Shift+PageUp → -1 year
  state.dlg.dlg.dispatchEvent({ type: 'keydown', key: 'PageUp', preventDefault: function () {}, shiftKey: true });
  check(state.view.y === 2026, 'Shift+PageUp shifts view -1 year');

  handle.destroy();
}

// =============================================================
// XIII. Esc closes + focus returns to source input
// =============================================================
console.log('--- XIII. Esc closes + focus returns ---');
{
  const ctx = buildCtx();
  loadInto(ctx, SHELL_THIN_SRC, 'shell-thin.js (for XIII)');
  loadInto(ctx, DATE_PICKER_SRC, 'date-picker.js (for XIII)');

  const stubInput = {
    tagName: 'INPUT', nodeName: 'INPUT', type: 'date',
    id: 'ls-dob', name: 'dob', value: '2026-01-15',
    min: '', max: '', className: 'input js-date-picker',
    attributes: { type: 'date', class: 'input js-date-picker', id: 'ls-dob', name: 'dob', value: '2026-01-15' },
    setAttribute: function (k, v) { this.attributes[k] = String(v); },
    getAttribute: function (k) { return this.attributes[k] || null; },
    addEventListener: function () {}, removeEventListener: function () {},
    focus: function () { stubInput._focusCalled = (stubInput._focusCalled || 0) + 1; },
    dispatchEvent: function () { return true; },
    classList: { contains: function () { return false; }, add: function () {}, remove: function () {} },
    getBoundingClientRect: function () { return { top: 0, left: 0, right: 100, bottom: 30, width: 100, height: 30 }; },
  };
  const handle = ctx.HT.datePicker.enhance(stubInput, {});
  handle.open();
  check(handle.isOpen() === true, 'dialog is open before Esc');

  // Trigger the <dialog> cancel event (native Esc fires this).
  handle._state.dlg.dlg.dispatchEvent({ type: 'cancel' });
  check(handle.isOpen() === false, 'cancel event closes the dialog');

  // Focus should have been called on the source input. After Esc
  // → _closeDialog → sourceEl.focus() (sourceEl was document.activeElement
  // at open time; our stub returns null, so fallback picks input).
  check((stubInput._focusCalled || 0) >= 1,
    'source input received focus() after close (count: ' + (stubInput._focusCalled || 0) + ')');

  handle.destroy();
}

// =============================================================
// XIV. time grid renders 24 hour cells + 12 minute cells
// =============================================================
console.log('--- XIV. time grid renders 24 + 12 cells ---');
{
  const ctx = buildCtx();
  loadInto(ctx, SHELL_THIN_SRC, 'shell-thin.js (for XIV)');
  loadInto(ctx, DATE_PICKER_SRC, 'date-picker.js (for XIV)');

  const stubInput = {
    tagName: 'INPUT', nodeName: 'INPUT', type: 'time',
    id: 'wc-mtg-time', name: 'mtg-time', value: '12:00',
    min: '', max: '', className: 'input js-time-picker',
    attributes: { type: 'time', class: 'input js-time-picker', id: 'wc-mtg-time', name: 'mtg-time', value: '12:00' },
    setAttribute: function (k, v) { this.attributes[k] = String(v); },
    getAttribute: function (k) { return this.attributes[k] || null; },
    addEventListener: function () {}, removeEventListener: function () {},
    focus: function () {}, dispatchEvent: function () { return true; },
    classList: { contains: function () { return false; }, add: function () {}, remove: function () {} },
    getBoundingClientRect: function () { return { top: 0, left: 0, right: 100, bottom: 30, width: 100, height: 30 }; },
  };
  const handle = ctx.HT.datePicker.enhance(stubInput, {});
  check(handle && handle._state && handle._state.type === 'time',
    'enhance() produces a state with type="time"');

  handle.open();
  const state = handle._state;
  check(state && state.dlg && state.dlg.hourCol && state.dlg.minuteCol,
    'time dialog exposes hourCol + minuteCol refs');

  const hourCells = state.dlg.hourCol.childNodes.filter(function (n) {
    return n && n.nodeType === 1 && (n.className || '').indexOf('time-picker-cell--hour') >= 0;
  });
  check(hourCells.length === 24,
    'hour column renders 24 cells (got ' + hourCells.length + ')');

  const minuteCells = state.dlg.minuteCol.childNodes.filter(function (n) {
    return n && n.nodeType === 1 && (n.className || '').indexOf('time-picker-cell--minute') >= 0;
  });
  check(minuteCells.length === 12,
    'minute column renders 12 cells (5-min granularity, got ' + minuteCells.length + ')');

  // Every hour cell carries a 0-23 data-hour attribute.
  let allHoursValid = true;
  for (let i = 0; i < hourCells.length; i += 1) {
    const h = parseInt(hourCells[i].attributes['data-hour'], 10);
    if (!(h >= 0 && h <= 23)) { allHoursValid = false; break; }
  }
  check(allHoursValid, 'every hour cell has data-hour in [0..23]');

  // Every minute cell carries a 0,5,10,...,55 data-minute attribute.
  let allMinsValid = true;
  const expectedMins = [0,5,10,15,20,25,30,35,40,45,50,55];
  for (let i = 0; i < minuteCells.length; i += 1) {
    const mn = parseInt(minuteCells[i].attributes['data-minute'], 10);
    if (expectedMins.indexOf(mn) < 0) { allMinsValid = false; break; }
  }
  check(allMinsValid, 'every minute cell has data-minute in {0,5,…,55}');

  // Selected cell reflects the input value '12:00' → hour=12, minute=0.
  const selectedHour = hourCells.filter(function (c) {
    return (c.className || '').indexOf('time-picker-cell--selected') >= 0;
  });
  check(selectedHour.length === 1 && selectedHour[0].attributes['data-hour'] === '12',
    'hour 12 is selected (matches input value 12:00)');
  const selectedMin = minuteCells.filter(function (c) {
    return (c.className || '').indexOf('time-picker-cell--selected') >= 0;
  });
  check(selectedMin.length === 1 && selectedMin[0].attributes['data-minute'] === '0',
    'minute 0 is selected (snapped from 12:00)');

  handle.destroy();
}

// =============================================================
// XV. HH:MM round-trip — time cells are timezone-safe
// =============================================================
console.log('--- XV. HH:MM round-trip ---');
{
  const ctx = buildCtx();
  loadInto(ctx, SHELL_THIN_SRC, 'shell-thin.js (for XV)');
  loadInto(ctx, DATE_PICKER_SRC, 'date-picker.js (for XV)');

  const stubInput = {
    tagName: 'INPUT', nodeName: 'INPUT', type: 'time',
    id: 'cd-time', name: 'cd-time', value: '23:59',
    min: '', max: '', className: 'input js-time-picker',
    attributes: { type: 'time', class: 'input js-time-picker', id: 'cd-time', name: 'cd-time', value: '23:59' },
    setAttribute: function (k, v) { this.attributes[k] = String(v); },
    getAttribute: function (k) { return this.attributes[k] || null; },
    addEventListener: function () {}, removeEventListener: function () {},
    focus: function () {}, dispatchEvent: function () { return true; },
    classList: { contains: function () { return false; }, add: function () {}, remove: function () {} },
    getBoundingClientRect: function () { return { top: 0, left: 0, right: 100, bottom: 30, width: 100, height: 30 }; },
  };
  const handle = ctx.HT.datePicker.enhance(stubInput, {});
  handle.open();
  const state = handle._state;
  const title = state.dlg.title && state.dlg.title.textContent;
  check(/^\d{2}:\d{2}$/.test(title),
    'title shows valid HH:MM (got "' + title + '")');
  check(title === '23:59' || /^(23:55|23:59|23:5\d)$/.test(title),
    'title shows 23:xx range (got "' + title + '")');
  handle.destroy();
}

// =============================================================
// XVI. time selection writes input.value + fires events
// =============================================================
console.log('--- XVI. time selection writes input.value + fires events ---');
{
  const ctx = buildCtx();
  loadInto(ctx, SHELL_THIN_SRC, 'shell-thin.js (for XVI)');
  loadInto(ctx, DATE_PICKER_SRC, 'date-picker.js (for XVI)');

  let inputFired = 0;
  let changeFired = 0;
  const stubInput = {
    tagName: 'INPUT', nodeName: 'INPUT', type: 'time',
    id: 'wc-mtg-time', name: 'mtg-time', value: '',
    min: '', max: '', className: 'input js-time-picker',
    attributes: { type: 'time', class: 'input js-time-picker', id: 'wc-mtg-time', name: 'mtg-time' },
    _listeners: {},
    setAttribute: function (k, v) { this.attributes[k] = String(v); },
    getAttribute: function (k) { return this.attributes[k] || null; },
    addEventListener: function (type, handler) {
      (this._listeners[type] = this._listeners[type] || []).push(handler);
    },
    removeEventListener: function (type, handler) {
      if (this._listeners[type]) {
        this._listeners[type] = this._listeners[type].filter(function (h) { return h !== handler; });
      }
    },
    dispatchEvent: function (ev) {
      const handlers = this._listeners[ev.type] || [];
      for (let i = 0; i < handlers.length; i += 1) {
        try { handlers[i](ev); } catch (_) {}
      }
      if (ev && ev.type === 'input')  inputFired += 1;
      if (ev && ev.type === 'change') changeFired += 1;
      return true;
    },
    focus: function () {},
    classList: { contains: function () { return false; }, add: function () {}, remove: function () {} },
    getBoundingClientRect: function () { return { top: 0, left: 0, right: 100, bottom: 30, width: 100, height: 30 }; },
  };
  const handle = ctx.HT.datePicker.enhance(stubInput, {});
  handle.open();
  const state = handle._state;

  // Click hour=14, then minute=30. Each click updates state.selected.
  // After both, call Enter to commit.
  const hourCell = state.dlg.hourCol.childNodes.filter(function (n) {
    return n && n.nodeType === 1 && n.attributes['data-hour'] === '14';
  })[0];
  hourCell.closest = function (sel) {
    if (sel === '.time-picker-cell--hour') return hourCell;
    return null;
  };
  state.dlg.hourCol.dispatchEvent({ type: 'click', target: hourCell });

  const minuteCell = state.dlg.minuteCol.childNodes.filter(function (n) {
    return n && n.nodeType === 1 && n.attributes['data-minute'] === '30';
  })[0];
  minuteCell.closest = function (sel) {
    if (sel === '.time-picker-cell--minute') return minuteCell;
    return null;
  };
  state.dlg.minuteCol.dispatchEvent({ type: 'click', target: minuteCell });

  check(state.selectedHour === 14 && state.selectedMinute === 30,
    'clicking hour 14 + minute 30 updates state (got h=' + state.selectedHour + ' m=' + state.selectedMinute + ')');

  // Commit via Enter key.
  state.dlg.dlg.dispatchEvent({ type: 'keydown', key: 'Enter', preventDefault: function () {}, shiftKey: false });
  check(stubInput.value === '14:30',
    'Enter commits input.value = "14:30" (got "' + stubInput.value + '")');
  check(inputFired >= 1,
    'input event fired after Enter (got ' + inputFired + ')');
  check(changeFired >= 1,
    'change event fired after Enter (got ' + changeFired + ')');
  check(handle.isOpen() === false,
    'dialog closes after Enter commits the selection');
  check(stubInput.id === 'wc-mtg-time', 'id preserved on input');
  check(stubInput.name === 'mtg-time', 'name preserved on input');
  check(stubInput.className.indexOf('js-time-picker') >= 0,
    'class preserved on input');

  handle.destroy();
}

// =============================================================
// XVII. time keyboard navigation
// =============================================================
console.log('--- XVII. time keyboard navigation ---');
{
  const ctx = buildCtx();
  loadInto(ctx, SHELL_THIN_SRC, 'shell-thin.js (for XVII)');
  loadInto(ctx, DATE_PICKER_SRC, 'date-picker.js (for XVII)');

  const stubInput = {
    tagName: 'INPUT', nodeName: 'INPUT', type: 'time',
    id: 'wc-mtg-time', name: 'mtg-time', value: '12:00',
    min: '', max: '', className: 'input js-time-picker',
    attributes: { type: 'time', class: 'input js-time-picker', id: 'wc-mtg-time', name: 'mtg-time', value: '12:00' },
    setAttribute: function (k, v) { this.attributes[k] = String(v); },
    getAttribute: function (k) { return this.attributes[k] || null; },
    addEventListener: function () {}, removeEventListener: function () {},
    focus: function () {}, dispatchEvent: function () { return true; },
    classList: { contains: function () { return false; }, add: function () {}, remove: function () {} },
    getBoundingClientRect: function () { return { top: 0, left: 0, right: 100, bottom: 30, width: 100, height: 30 }; },
  };
  const handle = ctx.HT.datePicker.enhance(stubInput, {});
  handle.open();
  const state = handle._state;
  check(state.selectedHour === 12 && state.selectedMinute === 0,
    'starts at 12:00 (snapped from input value)');

  // ArrowDown → hour -1.
  state.dlg.dlg.dispatchEvent({ type: 'keydown', key: 'ArrowDown', preventDefault: function () {}, shiftKey: false });
  check(state.selectedHour === 11 && state.selectedMinute === 0,
    'ArrowDown shifts hour -1 (got ' + state.selectedHour + ':' + state.selectedMinute + ')');

  // ArrowUp → hour +1.
  state.dlg.dlg.dispatchEvent({ type: 'keydown', key: 'ArrowUp', preventDefault: function () {}, shiftKey: false });
  check(state.selectedHour === 12, 'ArrowUp shifts hour +1');

  // ArrowRight → minute +1.
  state.dlg.dlg.dispatchEvent({ type: 'keydown', key: 'ArrowRight', preventDefault: function () {}, shiftKey: false });
  check(state.selectedHour === 12 && state.selectedMinute === 1,
    'ArrowRight fine-tunes minute +1 (got ' + state.selectedHour + ':' + state.selectedMinute + ')');

  // Shift+ArrowRight → minute +5.
  state.dlg.dlg.dispatchEvent({ type: 'keydown', key: 'ArrowRight', preventDefault: function () {}, shiftKey: true });
  check(state.selectedMinute === 6,
    'Shift+ArrowRight jumps minute +5 (got ' + state.selectedMinute + ')');

  // Home → minute = 0.
  state.dlg.dlg.dispatchEvent({ type: 'keydown', key: 'Home', preventDefault: function () {}, shiftKey: false });
  check(state.selectedMinute === 0, 'Home jumps minute to 0');

  // End → minute = 55.
  state.dlg.dlg.dispatchEvent({ type: 'keydown', key: 'End', preventDefault: function () {}, shiftKey: false });
  check(state.selectedMinute === 55, 'End jumps minute to 55');

  // PageUp → hour +12.
  state.dlg.dlg.dispatchEvent({ type: 'keydown', key: 'PageUp', preventDefault: function () {}, shiftKey: false });
  check(state.selectedHour === 0,
    'PageUp wraps hour +12 from 12 → 0 (got ' + state.selectedHour + ')');

  handle.destroy();
}

// =============================================================
// XVIII. Now button writes current HH:MM
// =============================================================
console.log('--- XVIII. Now button writes current HH:MM ---');
{
  const ctx = buildCtx();
  loadInto(ctx, SHELL_THIN_SRC, 'shell-thin.js (for XVIII)');
  loadInto(ctx, DATE_PICKER_SRC, 'date-picker.js (for XVIII)');

  let inputFired = 0;
  let changeFired = 0;
  const stubInput = {
    tagName: 'INPUT', nodeName: 'INPUT', type: 'time',
    id: 'wc-mtg-time', name: 'mtg-time', value: '',
    min: '', max: '', className: 'input js-time-picker',
    attributes: { type: 'time', class: 'input js-time-picker', id: 'wc-mtg-time', name: 'mtg-time' },
    _listeners: {},
    setAttribute: function (k, v) { this.attributes[k] = String(v); },
    getAttribute: function (k) { return this.attributes[k] || null; },
    addEventListener: function (type, handler) {
      (this._listeners[type] = this._listeners[type] || []).push(handler);
    },
    removeEventListener: function (type, handler) {
      if (this._listeners[type]) {
        this._listeners[type] = this._listeners[type].filter(function (h) { return h !== handler; });
      }
    },
    dispatchEvent: function (ev) {
      const handlers = this._listeners[ev.type] || [];
      for (let i = 0; i < handlers.length; i += 1) {
        try { handlers[i](ev); } catch (_) {}
      }
      if (ev && ev.type === 'input')  inputFired += 1;
      if (ev && ev.type === 'change') changeFired += 1;
      return true;
    },
    focus: function () {},
    classList: { contains: function () { return false; }, add: function () {}, remove: function () {} },
    getBoundingClientRect: function () { return { top: 0, left: 0, right: 100, bottom: 30, width: 100, height: 30 }; },
  };
  const handle = ctx.HT.datePicker.enhance(stubInput, {});
  handle.open();

  // Click the Now button.
  const nowBtn = handle._state.dlg.nowBtn;
  check(!!nowBtn, 'time dialog exposes a Now button');
  nowBtn.dispatchEvent({ type: 'click' });

  check(handle._state.selectedHour === (new Date()).getHours() &&
        Math.abs(handle._state.selectedMinute - Math.round((new Date()).getMinutes() / 5) * 5) <= 5,
    'Now button sets selectedHour/Minute to current local time (h=' +
      handle._state.selectedHour + ' m=' + handle._state.selectedMinute + ')');

  handle.destroy();
}

// =============================================================
// XVIII-a. datetime-local: enhance accepts the type
// =============================================================
console.log('--- XVIII-a. datetime-local: enhance accepts the type ---');
{
  const ctx = buildCtx();
  loadInto(ctx, SHELL_THIN_SRC, 'shell-thin.js (for XVIII-a)');
  loadInto(ctx, DATE_PICKER_SRC, 'date-picker.js (for XVIII-a)');

  const stubInput = {
    tagName: 'INPUT', nodeName: 'INPUT', type: 'datetime-local',
    id: 'ec-target', name: 'target', value: '',
    min: '', max: '', className: 'input js-date-time-picker',
    attributes: { type: 'datetime-local', class: 'input js-date-time-picker', id: 'ec-target', name: 'target' },
    setAttribute: function (k, v) { this.attributes[k] = String(v); },
    getAttribute: function (k) { return this.attributes[k] || null; },
    addEventListener: function () {}, removeEventListener: function () {},
    focus: function () {}, dispatchEvent: function () { return true; },
    classList: { contains: function () { return false; }, add: function () {}, remove: function () {} },
    getBoundingClientRect: function () { return { top: 0, left: 0, right: 100, bottom: 30, width: 100, height: 30 }; },
  };
  const handle = ctx.HT.datePicker.enhance(stubInput, {});
  check(handle && handle._state && handle._state.type === 'datetime-local',
    'enhance() returns datetime-local handle (got type="' + (handle && handle._state && handle._state.type) + '")');
  check(handle && typeof handle.open === 'function' &&
        typeof handle.close === 'function' && typeof handle.destroy === 'function' &&
        typeof handle.isOpen === 'function',
    'datetime-local handle exposes {open, close, destroy, isOpen}');

  // Verify the unsupported type still throws.
  let threw = false;
  try {
    ctx.HT.datePicker.enhance({
      tagName: 'INPUT', type: 'month',
      addEventListener: function () {}, removeEventListener: function () {},
    }, {});
  } catch (e) { threw = true; }
  check(threw, 'enhance() throws for unsupported input.type="month"');

  handle.destroy();
}

// =============================================================
// XVIII-b. datetime-local: open() builds a tab strip + 2 panes
// =============================================================
console.log('--- XVIII-b. datetime-local: open() builds a tab strip + 2 panes ---');
{
  const ctx = buildCtx();
  loadInto(ctx, SHELL_THIN_SRC, 'shell-thin.js (for XVIII-b)');
  loadInto(ctx, DATE_PICKER_SRC, 'date-picker.js (for XVIII-b)');

  const stubInput = {
    tagName: 'INPUT', nodeName: 'INPUT', type: 'datetime-local',
    id: 'ec-target', name: 'target', value: '',
    min: '', max: '', className: 'input js-date-time-picker',
    attributes: { type: 'datetime-local', class: 'input js-date-time-picker', id: 'ec-target', name: 'target' },
    setAttribute: function (k, v) { this.attributes[k] = String(v); },
    getAttribute: function (k) { return this.attributes[k] || null; },
    addEventListener: function () {}, removeEventListener: function () {},
    focus: function () {}, dispatchEvent: function () { return true; },
    classList: { contains: function () { return false; }, add: function () {}, remove: function () {} },
    getBoundingClientRect: function () { return { top: 0, left: 0, right: 100, bottom: 30, width: 100, height: 30 }; },
  };
  const handle = ctx.HT.datePicker.enhance(stubInput, {});
  handle.open();

  const d = handle._state.dlg;
  check(!!(d && d.dateTab && d.timeTab),
    'date-time dialog exposes dateTab + timeTab buttons');
  check(!!(d && d.okBtn && d.nowBtn && d.clearBtn),
    'date-time dialog exposes {ok, now, clear} buttons');
  check(!!(d && d.grid && d.hourCol && d.minuteCol),
    'date-time dialog exposes grid (date) + hourCol + minuteCol (time)');

  // Date tab is selected by default.
  check(d.dateTab.getAttribute('aria-selected') === 'true',
    'date tab is selected by default');

  handle.destroy();
}

// =============================================================
// XVIII-c. datetime-local: tab strip swap + Alt+Right
// =============================================================
console.log('--- XVIII-c. datetime-local: tab strip swap ---');
{
  const ctx = buildCtx();
  loadInto(ctx, SHELL_THIN_SRC, 'shell-thin.js (for XVIII-c)');
  loadInto(ctx, DATE_PICKER_SRC, 'date-picker.js (for XVIII-c)');

  const stubInput = {
    tagName: 'INPUT', nodeName: 'INPUT', type: 'datetime-local',
    id: 'ec-target', name: 'target', value: '2026-08-15T14:30',
    min: '', max: '', className: 'input js-date-time-picker',
    attributes: { type: 'datetime-local', class: 'input js-date-time-picker', id: 'ec-target', name: 'target' },
    setAttribute: function (k, v) { this.attributes[k] = String(v); },
    getAttribute: function (k) { return this.attributes[k] || null; },
    addEventListener: function () {}, removeEventListener: function () {},
    focus: function () {}, dispatchEvent: function () { return true; },
    classList: { contains: function () { return false; }, add: function () {}, remove: function () {} },
    getBoundingClientRect: function () { return { top: 0, left: 0, right: 100, bottom: 30, width: 100, height: 30 }; },
  };
  const handle = ctx.HT.datePicker.enhance(stubInput, {});
  handle.open();

  // Switch to Time tab.
  handle._state.dlg.timeTab.dispatchEvent({ type: 'click' });
  check(handle._state.tab === 'time',
    'clicking Time tab sets state.tab = "time" (got "' + handle._state.tab + '")');
  check(handle._state.dlg.timeTab.getAttribute('aria-selected') === 'true',
    'Time tab is now aria-selected');
  check(handle._state.dlg.dateTab.getAttribute('aria-selected') === 'false',
    'Date tab is now aria-selected=false');

  // Switch back.
  handle._state.dlg.dateTab.dispatchEvent({ type: 'click' });
  check(handle._state.tab === 'date',
    'clicking Date tab sets state.tab = "date"');

  handle.destroy();
}

// =============================================================
// XVIII-d. datetime-local: OK composes YYYY-MM-DDTHH:MM
// =============================================================
console.log('--- XVIII-d. datetime-local: OK commits YYYY-MM-DDTHH:MM ---');
{
  const ctx = buildCtx();
  loadInto(ctx, SHELL_THIN_SRC, 'shell-thin.js (for XVIII-d)');
  loadInto(ctx, DATE_PICKER_SRC, 'date-picker.js (for XVIII-d)');

  let inputFired = 0;
  let changeFired = 0;
  const stubInput = {
    tagName: 'INPUT', nodeName: 'INPUT', type: 'datetime-local',
    id: 'ec-target', name: 'target', value: '2026-08-15T14:30',
    min: '', max: '', className: 'input js-date-time-picker',
    attributes: { type: 'datetime-local', class: 'input js-date-time-picker', id: 'ec-target', name: 'target' },
    _listeners: {},
    setAttribute: function (k, v) { this.attributes[k] = String(v); this[k] = v; },
    getAttribute: function (k) { return this.attributes[k] || null; },
    addEventListener: function (type, handler) {
      (this._listeners[type] = this._listeners[type] || []).push(handler);
    },
    removeEventListener: function (type, handler) {
      if (this._listeners[type]) {
        this._listeners[type] = this._listeners[type].filter(function (h) { return h !== handler; });
      }
    },
    dispatchEvent: function (ev) {
      const handlers = this._listeners[ev.type] || [];
      for (let i = 0; i < handlers.length; i += 1) {
        try { handlers[i](ev); } catch (_) {}
      }
      if (ev && ev.type === 'input')  inputFired += 1;
      if (ev && ev.type === 'change') changeFired += 1;
      return true;
    },
    focus: function () {},
    classList: { contains: function () { return false; }, add: function () {}, remove: function () {} },
    getBoundingClientRect: function () { return { top: 0, left: 0, right: 100, bottom: 30, width: 100, height: 30 }; },
  };
  const handle = ctx.HT.datePicker.enhance(stubInput, {});
  handle.open();

  // Parse the existing value.
  check(handle._state.selectedIso === '2026-08-15',
    'parses selectedIso from input.value (got "' + handle._state.selectedIso + '")');
  check(handle._state.selectedHour === 14 && handle._state.selectedMinute === 30,
    'parses hour=14 minute=30 from input.value (got h=' +
      handle._state.selectedHour + ' m=' + handle._state.selectedMinute + ')');

  // Adjust the time so OK has a value-change to dispatch.
  handle._state.selectedHour = 9;
  handle._state.selectedMinute = 45;

  // Click OK.
  handle._state.dlg.okBtn.dispatchEvent({ type: 'click' });
  check(stubInput.value === '2026-08-15T09:45',
    'OK commits input.value = "2026-08-15T09:45" (got "' + stubInput.value + '")');
  check(inputFired > 0,
    'input event fires after OK commit (got ' + inputFired + ')');
  check(changeFired > 0,
    'change event fires after OK commit (got ' + changeFired + ')');

  handle.destroy();
}

// =============================================================
// XIX. regression — date inputs still work after Story 9.19.1
// =============================================================
console.log('--- XIX. regression — date inputs unaffected by Story 9.19.1 ---');
{
  const ctx = buildCtx();
  loadInto(ctx, SHELL_THIN_SRC, 'shell-thin.js (for XIX)');
  loadInto(ctx, DATE_PICKER_SRC, 'date-picker.js (for XIX)');

  const stubInput = {
    tagName: 'INPUT', nodeName: 'INPUT', type: 'date',
    id: 'ls-dob', name: 'dob', value: '2026-01-15',
    min: '', max: '', className: 'input js-date-picker',
    attributes: { type: 'date', class: 'input js-date-picker', id: 'ls-dob', name: 'dob', value: '2026-01-15' },
    setAttribute: function (k, v) { this.attributes[k] = String(v); },
    getAttribute: function (k) { return this.attributes[k] || null; },
    addEventListener: function () {}, removeEventListener: function () {},
    focus: function () {}, dispatchEvent: function () { return true; },
    classList: { contains: function () { return false; }, add: function () {}, remove: function () {} },
    getBoundingClientRect: function () { return { top: 0, left: 0, right: 100, bottom: 30, width: 100, height: 30 }; },
  };
  const handle = ctx.HT.datePicker.enhance(stubInput, {});
  check(handle && handle._state && handle._state.type === 'date',
    'date variant state.type === "date" (Story 9.19.1 did not regress the date path)');

  handle.open();
  const grid = handle._state.dlg.grid;
  const cells = grid.childNodes.filter(function (n) {
    return n && n.nodeType === 1 && (n.className || '').indexOf('date-picker-day') >= 0;
  });
  check(cells.length === 42,
    'date grid still renders 42 cells (got ' + cells.length + ')');
  // Time dialog must NOT have been instantiated.
  check(ctx.HT.datePicker && handle._state.dlg && !handle._state.dlg.hourCol,
    'date state.dlg does NOT expose hourCol (time variant only)');

  handle.destroy();
}

// =============================================================
// XX. eager-tag strip — 4 new inputs (time × 3, datetime-local × 1)
// =============================================================
console.log('--- XX. eager-tag strip — 4 new tool opt-ins ---');
{
  // Helper — does the html carry js-time-picker / js-date-time-picker
  // on the given input id?
  function hasClassOn(html, id, klass) {
    const a = new RegExp('id=["\']' + id + '["\'][^>]*class=["\'][^"\']*' + klass).test(html);
    const b = new RegExp('class=["\'][^"\']*' + klass + '[^"\']*["\'][^>]*id=["\']' + id + '["\']').test(html);
    return a || b;
  }

  const timeFixtures = [
    { slug: 'age-calculator',     input: 'dob-time',   klass: 'js-time-picker' },
    { slug: 'countdown-to-date',  input: 'cd-time',    klass: 'js-time-picker' },
    { slug: 'world-clock',        input: 'wc-mtg-time',klass: 'js-time-picker' },
    { slug: 'exam-countdown',     input: 'ec-target',  klass: 'js-date-time-picker' },
  ];
  for (const fx of timeFixtures) {
    const html = fs.readFileSync(path.join(REPO_ROOT, 'tools/' + fx.slug + '/index.html'), 'utf8');
    check(!/src=["'][^"']*assets\/js\/date-picker\.js["']/.test(html),
      'tools/' + fx.slug + '/index.html has no <script src="assets/js/date-picker.js">');
    check(!/href=["'][^"']*assets\/css\/chrome-date-picker\.css["']/.test(html),
      'tools/' + fx.slug + '/index.html has no <link href="assets/css/chrome-date-picker.css">');
    check(hasClassOn(html, fx.input, fx.klass),
      fx.slug + ': #' + fx.input + ' carries ' + fx.klass + ' class');
  }
}

// =============================================================
// XXI. script-load-order regression — Story 9.19.1 fix
// =============================================================
//
// Story 9.19.1 introduced a real-world bug: shell-thin.js loads with
// `defer`, while tool JS (age-calculator.js etc.) does not. The eager
// tool IIFE ran BEFORE shell-thin.js, so HT.datePicker was undefined
// when the wiring block executed — the `if (HT.datePicker && ...)`
// guard silently swallowed the call and the inputs kept their native
// picker.
//
// Fix: each tool wraps its wire-block in a DOMContentLoaded listener
// (since shell-thin.js always finishes before DOMContentLoaded).
//
// This section loads the actual tool JS into a vm with a stub
// document, mimics the deferred-script ordering (tool.js BEFORE
// shell-thin.js), then fires DOMContentLoaded and verifies
// HT.datePicker.enhance was called.
console.log('--- XXI. script-load-order: tool IIFE runs before shell-thin.js, fix via DOMContentLoaded ---');
{
  const tools = [
    { slug: 'age-calculator',     js: 'age-calculator.js',          klass: 'js-date-picker, .js-time-picker' },
    { slug: 'countdown-to-date',  js: 'countdown-to-date.js',       klass: 'js-date-picker, .js-time-picker' },
    { slug: 'world-clock',        js: 'world-clock.js',             klass: 'js-date-picker, .js-time-picker' },
    { slug: 'exam-countdown',     js: 'exam-countdown.js',          klass: 'js-date-time-picker' },
  ];

  for (const tool of tools) {
    const toolSrc = fs.readFileSync(path.join(REPO_ROOT, 'tools/' + tool.slug + '/' + tool.js), 'utf8');

    // Build a stub DOM that mimics the page environment.
    const readyListeners = [];
    const stubDoc = {
      readyState: 'loading',
      addEventListener(type, listener) {
        if (type === 'DOMContentLoaded') readyListeners.push(listener);
      },
      removeEventListener() {},
      documentElement: { appendChild() {} },
      body: { appendChild() {} },
      head: {},
      createElement() { return { appendChild() {} }; },
      currentScript: null,
      querySelector() { return null; },
      querySelectorAll() { return []; },
    };
    // Stub DOM elements that the tool JS may look up.
    function makeStubEl() {
      return new Proxy({
        tagName: 'INPUT',
        classList: { add() {}, remove() {}, contains: () => false },
        setAttribute() {}, getAttribute: () => null,
        addEventListener: () => {},
        removeEventListener: () => {},
        appendChild() {}, removeChild() {}, click() {}, focus() {},
        dispatchEvent: () => true,
        style: {},
        // Common <input> properties
        value: '',
        type: '',
        id: '',
        name: '',
        checked: false,
        min: '',
        max: '',
        // Common <div> properties
        hidden: false,
        textContent: '',
        innerHTML: '',
        innerText: '',
        querySelector: () => null,
        querySelectorAll: () => [],
        getBoundingClientRect: () => ({ top: 0, left: 0, right: 100, bottom: 30, width: 100, height: 30 }),
      }, { get(t, k) { return k in t ? t[k] : (typeof k === 'string' && t.id ? t.id + '?' + String(k) : undefined); }, set(t, k, v) { t[k] = v; return true; } });
    }

    // Seed the wire-up to record every enhance() call.
    const enhanceCalls = [];
    // ctx2 is unused now but kept for future expansion.

    // Step 1: load the tool JS eagerly (simulates non-defer <script>).
    // At this point HT.datePicker IS defined (we stubbed it), but in
    // the real browser shell-thin.js has NOT yet run so the real
    // HT.datePicker would be undefined. The test should still pass:
    // either path (eager check works, or DOMContentLoaded listener
    // runs) is acceptable, as long as enhance() is called for the
    // inputs the tool owns.
    //
    // To simulate the real race: we run tool.js first WITH an
    // undefined HT.datePicker (mimicking the bug), THEN install the
    // stub HT.datePicker, THEN fire DOMContentLoaded.
    const raceCtx = {
      console, setTimeout, clearTimeout, setInterval: function () { return 0; }, clearInterval: function () {},
      Promise, Date, Math, Object, Array, String, Number, JSON,
      window: null,
      document: stubDoc,
      HT: new Proxy({
        // Tool script sees undefined datePicker.
        datePicker: undefined,
        $: function () { return makeStubEl(); },
        $$: function () { return []; },
        qsa: function () { return []; },
        debounce: function (fn) { return fn; },
        throttle: function (fn) { return fn; },
        makeTabs: function () {},
        on: function () {},
        uid: function () { return 'uid-' + Math.random().toString(36).slice(2, 8); },
        lazyLoad: function () { return Promise.resolve(); },
        lazyLoadCss: function () { return Promise.resolve(); },
        formatDate: function () { return ''; },
        pad2: function (n) { return String(n); },
        setInterval: function () { return 0; },
        clearInterval: function () {},
        storage: {
          _store: {},
          get: function (k, dflt) { return Object.prototype.hasOwnProperty.call(this._store, k) ? this._store[k] : dflt; },
          set: function (k, v) { this._store[k] = v; },
          remove: function (k) { delete this._store[k]; },
        },
      }, {
        // Default fallback: any unknown HT.* call returns a no-op
        // function. This lets tool scripts fully evaluate without
        // throwing on every helper they use.
        get: function (t, k) {
          if (k in t) return t[k];
          if (typeof k === 'symbol') return undefined;
          return function () { return undefined; };
        },
      }),
    };
    raceCtx.window = raceCtx;

    // Step 1: load the tool JS eagerly (simulates non-defer <script>).
    //
    // To simulate the real race: we run tool.js first WITH an
    // undefined HT.datePicker (mimicking the bug). Tool scripts may
    // throw on other paths (missing setInterval, etc.) — we catch
    // that and continue; what matters is whether the wire-block
    // registered a DOMContentLoaded listener before the throw.
    //
    // We then install the stub HT.datePicker (and make HT.qsa return
    // a representative input element), fire DOMContentLoaded, and
    // check whether enhance() was called for the right inputs.
    const initialListenerCount = readyListeners.length;
    try { vm.runInContext(toolSrc, vm.createContext(raceCtx), { filename: tool.js }); }
    catch (e) {
      // Swallow — we only care that the wire-block registered a DCL
      // listener, which happens BEFORE other init code that may throw.
    }
    check(readyListeners.length > initialListenerCount,
      tool.slug + '/' + tool.js + ' registers a DOMContentLoaded listener (not bailing out on undefined HT.datePicker)');

    // Step 2: simulate shell-thin.js deferred finishing (installs
    // HT.datePicker Proxy). For tools that use HT.qsa('.js-...'),
    // return stub elements representing the inputs the tool owns.
    // For exam-countdown, the wire-block calls HT.datePicker.enhance
    // on a captured inputEl, so HT.qsa is irrelevant.
    raceCtx.HT.datePicker = {
      enhance: function (el) { enhanceCalls.push(tool.slug + ':' + (el && el.id || '?')); },
    };
    // Build a "post-defer" view of HT that returns inputs for qsa.
    const stubInput = makeStubEl();
    stubInput.id = (tool.klass.indexOf('js-date-time-picker') >= 0) ? 'ec-target'
                 : (tool.slug === 'age-calculator') ? 'dob'
                 : (tool.slug === 'countdown-to-date') ? 'cd-date'
                 : 'wc-mtg-date';
    raceCtx.HT.qsa = function () { return [stubInput, makeStubEl(), makeStubEl()].slice(0, tool.klass.indexOf(',') >= 0 ? 3 : 1); };
    stubDoc.readyState = 'interactive';
    for (const l of readyListeners.slice(initialListenerCount)) {
      try { l({ type: 'DOMContentLoaded' }); }
      catch (e) { console.log('  FAIL  ' + tool.slug + ' DCL listener threw: ' + e.message); fail += 1; }
    }
    check(enhanceCalls.length > 0,
      tool.slug + ': DOMContentLoaded fix wires inputs (enhance() called ' + enhanceCalls.length + ' time(s))');
  }
}

// =============================================================
// XXII. CSS URL resolution — repo-root base, not page URL
// =============================================================
//
// Story 9.19.1 hotfix regression: the time + date-time dialogs do
// `HT.lazyLoadCss('assets/css/chrome-time-picker.css')` from inside
// _ensureTimeDialog / _ensureDateTimeDialog. The relative URL must
// resolve to the repo root, NOT the calling tool page's directory
// (e.g., tools/age-calculator/index.html would otherwise resolve
// chrome-time-picker.css to tools/age-calculator/assets/css/...,
// which is not a real path → 404 + "Refused to apply style" MIME
// error).
//
// The fix captures document.currentScript.src at module-load time
// and walks the pathname back to the last `assets` segment to
// derive the repo root. This section verifies that:
console.log('--- XXII. CSS URL resolution — repo-root base, not page URL ---');
{
  // Build a ctx that mimics a tool page. document.currentScript.src
  // points to the repo root's date-picker.js (the real load path).
  const ctx = buildCtx();
  ctx.document.currentScript = {
    src: 'http://127.0.0.1:5500/assets/js/date-picker.js',
  };
  ctx.window.location = {
    href: 'http://127.0.0.1:5500/tools/age-calculator/index.html',
    origin: 'http://127.0.0.1:5500',
    pathname: '/tools/age-calculator/index.html',
  };
  ctx.document.URL = ctx.window.location.href;
  loadInto(ctx, DATE_PICKER_SRC, 'date-picker.js (for XXII)');

  // Trigger the time CSS lazy-load by enhancing a time input.
  const timeInput = {
    tagName: 'INPUT', nodeName: 'INPUT', type: 'time',
    id: 'wc-mtg-time', name: 'mtg-time', value: '12:00',
    min: '', max: '', className: 'input js-time-picker',
    attributes: { type: 'time', class: 'input js-time-picker', id: 'wc-mtg-time', name: 'mtg-time' },
    setAttribute: function (k, v) { this.attributes[k] = String(v); },
    getAttribute: function (k) { return this.attributes[k] || null; },
    addEventListener: function () {}, removeEventListener: function () {},
    focus: function () {}, dispatchEvent: function () { return true; },
    classList: { contains: function () { return false; }, add: function () {}, remove: function () {} },
    getBoundingClientRect: function () { return { top: 0, left: 0, right: 100, bottom: 30, width: 100, height: 30 }; },
  };
  ctx.HT.datePicker.enhance(timeInput, {});
  timeInput.dispatchEvent = function (ev) {
    const handlers = this._listeners && this._listeners[ev.type] || [];
    for (let i = 0; i < handlers.length; i += 1) handlers[i](ev);
    return true;
  };
  // Open the dialog (which fires _ensureTimeDialog → lazyLoadCss).
  // The handle returned by enhance() exposes open().
  const timeHandle = ctx.HT.datePicker.enhance(timeInput, {});
  timeHandle.open();

  check(ctx.HT._lazyLog.css.some(function (u) { return u === 'http://127.0.0.1:5500/assets/css/chrome-time-picker.css'; }),
    'time CSS URL resolves to repo root (got: ' + JSON.stringify(ctx.HT._lazyLog.css) + ')');
  check(!ctx.HT._lazyLog.css.some(function (u) { return u.indexOf('tools/age-calculator/assets') >= 0; }),
    'time CSS URL does NOT resolve to the tool page directory (no double-assets path)');
}

// Now exercise the date-time variant.
{
  const ctx = buildCtx();
  ctx.document.currentScript = {
    src: 'http://127.0.0.1:5500/assets/js/date-picker.js',
  };
  ctx.window.location = {
    href: 'http://127.0.0.1:5500/tools/exam-countdown/index.html',
    origin: 'http://127.0.0.1:5500',
    pathname: '/tools/exam-countdown/index.html',
  };
  ctx.document.URL = ctx.window.location.href;
  loadInto(ctx, DATE_PICKER_SRC, 'date-picker.js (for XXII datetime)');

  const dtInput = {
    tagName: 'INPUT', nodeName: 'INPUT', type: 'datetime-local',
    id: 'ec-target', name: 'target', value: '',
    min: '', max: '', className: 'input js-date-time-picker',
    attributes: { type: 'datetime-local', class: 'input js-date-time-picker', id: 'ec-target', name: 'target' },
    setAttribute: function (k, v) { this.attributes[k] = String(v); },
    getAttribute: function (k) { return this.attributes[k] || null; },
    addEventListener: function () {}, removeEventListener: function () {},
    focus: function () {}, dispatchEvent: function () { return true; },
    classList: { contains: function () { return false; }, add: function () {}, remove: function () {} },
    getBoundingClientRect: function () { return { top: 0, left: 0, right: 100, bottom: 30, width: 100, height: 30 }; },
  };
  const dtHandle = ctx.HT.datePicker.enhance(dtInput, {});
  dtHandle.open();

  check(ctx.HT._lazyLog.css.some(function (u) { return u === 'http://127.0.0.1:5500/assets/css/chrome-datetime-picker.css'; }),
    'date-time CSS URL resolves to repo root (got: ' + JSON.stringify(ctx.HT._lazyLog.css) + ')');
  check(!ctx.HT._lazyLog.css.some(function (u) { return u.indexOf('tools/exam-countdown/assets') >= 0; }),
    'date-time CSS URL does NOT resolve to the tool page directory');
}

// =============================================================
// XXIII. input click dispatches by state.type (Story 9.19.1 hotfix 3)
// =============================================================
//
// Bug: _wireInputListeners attached focus/click/keydown handlers that
// unconditionally called _openDialog(state). For type="time" inputs,
// _openDialog ran _renderGrid(state), which dereferences dlg.grid —
// but the time variant's dialog shell only has hourCol+minuteCol, no
// grid. The TypeError aborted the open() before showModal() fired, so
// the dialog never opened (and never closed). The user's report was
// "now it's not closing" — actually the dialog never opened, but the
// visible symptom was a frozen picker.
//
// Fix: _wireInputListeners now dispatches on state.type. This section
// verifies three things:
//   1. Clicking a <input type="time"> opens the time dialog (not the
//      date one). We detect the wrong dispatch by checking that the
//      time dialog's hourCol was rendered (the date dialog has no
//      hourCol).
//   2. Clicking a <input type="datetime-local"> opens the date-time
//      dialog (renders the date pane's grid + the time pane's columns).
//   3. Clicking a <input type="date"> still opens the date dialog
//      (regression — the date path must keep working).
//
// We use a stack-recording fake for the dialog render functions so the
// test doesn't depend on the JSDOM dialog being perfectly rendered.
console.log('--- XXIII. input click dispatch on state.type ---');
{
  // Helper: build an input stub with a real addEventListener that
  // records every handler so the test can call them.
  function makeInputStub(type, id, value) {
    const listeners = {};
    return {
      tagName: 'INPUT', nodeName: 'INPUT', type: type,
      id: id, name: id, value: value || '',
      min: '', max: '', className: 'input js-' + (type === 'date' ? 'date' : (type === 'time' ? 'time' : 'date-time')) + '-picker',
      attributes: { type: type, class: 'input js-' + (type === 'date' ? 'date' : (type === 'time' ? 'time' : 'date-time')) + '-picker', id: id, name: id },
      setAttribute: function (k, v) { this.attributes[k] = String(v); },
      getAttribute: function (k) { return this.attributes[k] || null; },
      addEventListener: function (t, h) { (listeners[t] = listeners[t] || []).push(h); },
      removeEventListener: function () {},
      focus: function () {},
      dispatchEvent: function () { return true; },
      classList: { contains: function () { return false; }, add: function () {}, remove: function () {} },
      getBoundingClientRect: function () { return { top: 0, left: 0, right: 100, bottom: 30, width: 100, height: 30 }; },
      _fire: function (t, ev) { (listeners[t] || []).forEach(function (h) { h(ev || {}); }); },
    };
  }

  // --- TIME input click ---
  {
    const ctx = buildCtx();
    ctx.document.currentScript = {
      src: 'http://127.0.0.1:5500/assets/js/date-picker.js',
    };
    ctx.window.location = {
      href: 'http://127.0.0.1:5500/tools/age-calculator/index.html',
      origin: 'http://127.0.0.1:5500',
      pathname: '/tools/age-calculator/index.html',
    };
    ctx.document.URL = ctx.window.location.href;
    loadInto(ctx, DATE_PICKER_SRC, 'date-picker.js (for XXIII time)');

    const timeInput = makeInputStub('time', 'dob-time', '00:00');
    const handle = ctx.HT.datePicker.enhance(timeInput, {});

    // Pre-and-post isOpen: clicking the input must open the dialog.
    check(handle.isOpen() === false, 'time: dialog is closed before input click');
    timeInput._fire('click', { type: 'click' });
    check(handle.isOpen() === true, 'time: input click opens the time dialog (not the date one)');

    // The time dialog exposes hourCol. After open(), the time grid
    // renders 24 hour cells + 12 minute cells. We verify the dialog
    // shell that's live (state.dlg) is the time variant, not the
    // date one — by checking state.dlg.hourCol is defined.
    const h = handle._state;
    check(!!h, 'time: handle._state is exposed');
    check(h && h.type === 'time', 'time: state.type === "time"');
    check(h && h.dlg && !!h.dlg.hourCol, 'time: state.dlg.hourCol is defined (time variant, not date)');
    check(h && h.dlg && !!h.dlg.minuteCol, 'time: state.dlg.minuteCol is defined (time variant, not date)');
    check(h && h.dlg && h.dlg.grid === undefined, 'time: state.dlg.grid is NOT defined (date variant leaked)');
  }

  // --- DATETIME-LOCAL input click ---
  {
    const ctx = buildCtx();
    ctx.document.currentScript = {
      src: 'http://127.0.0.1:5500/assets/js/date-picker.js',
    };
    ctx.window.location = {
      href: 'http://127.0.0.1:5500/tools/exam-countdown/index.html',
      origin: 'http://127.0.0.1:5500',
      pathname: '/tools/exam-countdown/index.html',
    };
    ctx.document.URL = ctx.window.location.href;
    loadInto(ctx, DATE_PICKER_SRC, 'date-picker.js (for XXIII datetime)');

    const dtInput = makeInputStub('datetime-local', 'ec-target', '');
    const handle = ctx.HT.datePicker.enhance(dtInput, {});

    check(handle.isOpen() === false, 'datetime-local: dialog is closed before input click');
    dtInput._fire('click', { type: 'click' });
    check(handle.isOpen() === true, 'datetime-local: input click opens the date-time dialog');

    const h = handle._state;
    check(h && h.type === 'datetime-local', 'datetime-local: state.type === "datetime-local"');
    check(h && h.dlg && !!h.dlg.grid, 'datetime-local: state.dlg.grid is defined (date pane)');
    check(h && h.dlg && !!h.dlg.hourCol, 'datetime-local: state.dlg.hourCol is defined (time pane)');
    check(h && h.dlg && !!h.dlg.minuteCol, 'datetime-local: state.dlg.minuteCol is defined (time pane)');
    check(h && h.dlg && !!h.dlg.dateTab, 'datetime-local: state.dlg.dateTab is defined');
    check(h && h.dlg && !!h.dlg.timeTab, 'datetime-local: state.dlg.timeTab is defined');
  }

  // --- DATE input click (regression — date path still works) ---
  {
    const ctx = buildCtx();
    ctx.document.currentScript = {
      src: 'http://127.0.0.1:5500/assets/js/date-picker.js',
    };
    ctx.window.location = {
      href: 'http://127.0.0.1:5500/tools/age-calculator/index.html',
      origin: 'http://127.0.0.1:5500',
      pathname: '/tools/age-calculator/index.html',
    };
    ctx.document.URL = ctx.window.location.href;
    loadInto(ctx, DATE_PICKER_SRC, 'date-picker.js (for XXIII date)');

    const dateInput = makeInputStub('date', 'dob', '2020-01-15');
    const handle = ctx.HT.datePicker.enhance(dateInput, {});

    check(handle.isOpen() === false, 'date: dialog is closed before input click');
    dateInput._fire('click', { type: 'click' });
    check(handle.isOpen() === true, 'date: input click opens the date dialog');

    const h = handle._state;
    check(h && h.type === 'date', 'date: state.type === "date"');
    check(h && h.dlg && !!h.dlg.grid, 'date: state.dlg.grid is defined');
    check(h && h.dlg && h.dlg.hourCol === undefined, 'date: state.dlg.hourCol is NOT defined (date variant)');
  }

  // --- FOCUS also opens the dialog (for keyboard users) ---
  {
    const ctx = buildCtx();
    ctx.document.currentScript = { src: 'http://127.0.0.1:5500/assets/js/date-picker.js' };
    ctx.window.location = {
      href: 'http://127.0.0.1:5500/tools/age-calculator/index.html',
      origin: 'http://127.0.0.1:5500',
      pathname: '/tools/age-calculator/index.html',
    };
    ctx.document.URL = ctx.window.location.href;
    loadInto(ctx, DATE_PICKER_SRC, 'date-picker.js (for XXIII focus)');

    const timeInput = makeInputStub('time', 'dob-time', '00:00');
    const handle = ctx.HT.datePicker.enhance(timeInput, {});

    timeInput._fire('focus', { type: 'focus' });
    check(handle.isOpen() === true, 'time: focus event also opens the time dialog (not the date one)');
  }

  // --- Enter key on the input also opens the dialog ---
  {
    const ctx = buildCtx();
    ctx.document.currentScript = { src: 'http://127.0.0.1:5500/assets/js/date-picker.js' };
    ctx.window.location = {
      href: 'http://127.0.0.1:5500/tools/age-calculator/index.html',
      origin: 'http://127.0.0.1:5500',
      pathname: '/tools/age-calculator/index.html',
    };
    ctx.document.URL = ctx.window.location.href;
    loadInto(ctx, DATE_PICKER_SRC, 'date-picker.js (for XXIII keydown)');

    const dateTimeInput = makeInputStub('datetime-local', 'ec-target', '');
    const handle = ctx.HT.datePicker.enhance(dateTimeInput, {});

    // Stub event with preventDefault so the keydown handler doesn't
    // crash on the bare object. The bare-bones {key: 'Enter'} from
    // the test framework doesn't carry the Event.prototype methods.
    const ev = { type: 'keydown', key: 'Enter', preventDefault: function () {} };
    dateTimeInput._fire('keydown', ev);
    check(handle.isOpen() === true, 'datetime-local: Enter keydown on input opens the date-time dialog (not the date one)');
  }
}

// =============================================================
// Vacuous-pass guard
// =============================================================
if (pass === 0 && fail === 0) {
  console.error('date-picker-smoke: VACUOUS — no assertions ran');
  process.exit(1);
}

console.log('');
console.log('date-picker-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);