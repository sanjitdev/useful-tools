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
// IV. enhance() rejects non-<input type="date"> inputs
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
    check(/input type="date"/.test(e.message), 'enhance(<div>) threw a clear error mentioning input type="date"');
  }
  check(threw, 'enhance() threw on non-INPUT element');

  // Wrong type.
  threw = false;
  try {
    ctx.HT.datePicker.enhance({ tagName: 'INPUT', type: 'text' }, {});
  } catch (e) {
    threw = true;
    check(/input type="date"/.test(e.message), 'enhance(<input type="text">) threw a clear error mentioning input type="date"');
  }
  check(threw, 'enhance() threw on <input type="text">');

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
// Vacuous-pass guard
// =============================================================
if (pass === 0 && fail === 0) {
  console.error('date-picker-smoke: VACUOUS — no assertions ran');
  process.exit(1);
}

console.log('');
console.log('date-picker-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);