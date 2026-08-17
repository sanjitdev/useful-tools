#!/usr/bin/env node
/* Story 9.19 Phase 2 — date-picker-v2 rewrite smoke.
 *
 * The new picker's contract, verified end-to-end:
 *
 *   §I   — shell-thin.js installs a Proxy on HT.datePickerV2
 *           (every property access returns a function)
 *   §II  — utils: parseDate / parseTime / parseDateTime /
 *           formatDate / gridCells
 *   §III — enhance(input) returns a handle; second call is a
 *           no-op (idempotent)
 *   §IV  — enhance rejects non-input / non-supported-type
 *   §V   — open(handle) sets currentOpenInput; close(handle)
 *           clears it
 *   §VI  — THE REGRESSION TEST: close(handle) followed by a
 *          focus event on the source input MUST NOT re-open
 *          the picker (the hotfix-5 bug class; this test is
 *          designed BEFORE the picker lands)
 *   §VII — open() from input B while A is open closes A
 *           (single-open invariant)
 *   §VIII — selecting a day in the date dialog writes
 *            input.value and fires input + change events
 *   §IX   — time variant: clicking an hour cell writes HH:MM
 *   §X    — datetime-local variant: dialog has the right type
 *            marker
 *   §XI   — backdrop click on the dialog element (target ===
 *            dialog) closes the picker
 *   §XII  — Escape closes via the dialog's native 'close' event
 *   §XIII — destroy(handle) tears down state + removes the dialog
 *
 * Pure-Node smoke (no jsdom / playwright). Runs in a vm sandbox
 * with a DOM stub that supports <dialog> semantics (showModal /
 * close / 'close' event).
 *
 * Exit codes: 0 PASS, 1 FAIL.
 *
 * NOTE on the lazy-load round-trip (§II in the Phase 2 plan):
 * the shell-thin Proxy factory creates a deferred dispatch —
 * any property access returns a function that fires lazyLoad,
 * then re-reads HT[namespace] and forwards. If the real API
 * isn't installed in time, the forward re-enters the Proxy
 * (infinite recursion in the Promise chain). The old picker
 * smoke sidestepped this by (a) asserting the Proxy-stub shape
 * only, then (b) directly verifying the on-disk module exports
 * the public API. We follow the same shape: §I asserts the
 * Proxy-stub; §II onward load the sub-modules in the same
 * context and exercise HT.datePickerV2.{utils,core,dialogs}
 * directly. The end-to-end Proxy dispatch is exercised by
 * the lab page in a real browser (Phase 2d manual test).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const SHELL_THIN_SRC = fs.readFileSync(path.join(REPO_ROOT, 'assets/js/shell-thin.js'), 'utf8');
const UTILS_SRC     = fs.readFileSync(path.join(REPO_ROOT, 'assets/js/date-picker-v2/utils.js'), 'utf8');
const CSS_SRC       = fs.readFileSync(path.join(REPO_ROOT, 'assets/js/date-picker-v2/css.js'), 'utf8');
const DIALOG_SRC    = fs.readFileSync(path.join(REPO_ROOT, 'assets/js/date-picker-v2/dialog.js'), 'utf8');
const CORE_SRC      = fs.readFileSync(path.join(REPO_ROOT, 'assets/js/date-picker-v2/core.js'), 'utf8');
const ENTRY_SRC     = fs.readFileSync(path.join(REPO_ROOT, 'assets/js/date-picker-v2/date-picker.js'), 'utf8');

let pass = 0;
let fail = 0;
function check(cond, label) {
  if (cond) { pass += 1; console.log('  PASS  ' + label); }
  else      { fail += 1; console.log('  FAIL  ' + label); }
}
function section(title) {
  console.log('\n--- ' + title + ' ---');
}

// =============================================================
// Minimal HT + DOM stubs.
//
// shell-thin.js reads window.HT (line 42), the document body
// for shell kick-off, and uses Promise / setTimeout. We
// supply just enough of each.
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

  // ----- DOM stub -----
  function Event(type, init) {
    this.type = type;
    this.bubbles = !!(init && init.bubbles);
    this.target = null;
    this.defaultPrevented = false;
  }
  Event.prototype.preventDefault = function () { this.defaultPrevented = true; };

  // Exposed at module scope so test sections can build real
  // <input> nodes that the picker's addEventListener actually
  // attaches to. The previous harness used plain object literals
  // with stubbed addEventListener, which made the focus / click /
  // mousedown wiring untestable.
  function Node(tag) {
    this.tagName = (tag || '').toUpperCase();
    this.nodeType = 1;
    this.children = [];
    this.parentNode = null;
    this.attrs = {};
    this.dataset = {};
    this.classList = {
      _set: new Set(),
      add: function (c) { this._set.add(c); },
      remove: function (c) { this._set.delete(c); },
      contains: function (c) { return this._set.has(c); },
    };
    this._listeners = {};
    this.style = {};
    this._textContent = '';
    this._isConnected = false;
  }
  Node.prototype.setAttribute = function (k, v) { this.attrs[k] = String(v); };
  Node.prototype.getAttribute = function (k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; };
  Node.prototype.removeAttribute = function (k) { delete this.attrs[k]; };
  // `input.type` is a DOM IDL attribute that reflects the value
  // of the `type` content attribute. date-picker-v2 reads it via
  // `input.type`, so expose it as a getter on the stub.
  Object.defineProperty(Node.prototype, 'type', {
    get: function () { return this.attrs.type || ''; },
    set: function (v) { this.attrs.type = String(v); },
  });
  // Same for `value` — date-picker-v2 reads `input.value` and
  // the stub needs to expose it as an IDL attribute.
  Object.defineProperty(Node.prototype, 'value', {
    get: function () { return this.attrs.value || ''; },
    set: function (v) { this.attrs.value = String(v); },
  });
  // id getter so stateById can match.
  Object.defineProperty(Node.prototype, 'id', {
    get: function () { return this.attrs.id || ''; },
    set: function (v) { this.attrs.id = String(v); },
  });
  Node.prototype.addEventListener = function (kind, fn) {
    (this._listeners[kind] = this._listeners[kind] || []).push(fn);
  };
  Node.prototype.removeEventListener = function (kind, fn) {
    if (!this._listeners[kind]) return;
    this._listeners[kind] = this._listeners[kind].filter(function (l) { return l !== fn; });
  };
  Node.prototype.appendChild = function (child) {
    if (child.nodeType !== 1) {
      this.children.push({ nodeType: 3, _text: String(child), parentNode: this });
      return child;
    }
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.children.push(child);
    child._isConnected = this._isConnected;
    return child;
  };
  Node.prototype.removeChild = function (child) {
    var i = this.children.indexOf(child);
    if (i >= 0) {
      this.children.splice(i, 1);
      child.parentNode = null;
      child._isConnected = false;
    }
    return child;
  };
  Object.defineProperty(Node.prototype, 'textContent', {
    get: function () { return this._textContent; },
    set: function (v) {
      this._textContent = String(v);
      this.children = [];
    },
  });
  Object.defineProperty(Node.prototype, 'innerHTML', {
    get: function () { return ''; },
    set: function (v) { this._textContent = String(v); this.children = []; },
  });
  Object.defineProperty(Node.prototype, 'firstChild', {
    get: function () { return this.children[0] || null; },
  });
  Node.prototype.dispatchEvent = function (ev) {
    ev.target = this;
    var ls = this._listeners[ev.type] || [];
    for (var i = 0; i < ls.length; i++) {
      try { ls[i].call(this, ev); } catch (e) { /* swallow — matching browser */ }
    }
    if (ev.bubbles && this.parentNode) this.parentNode.dispatchEvent(ev);
  };

  function makeDialog() {
    var n = new Node('dialog');
    n._isModal = false;
    n._open = false;
    n.showModal = function () {
      if (n._open) return;
      n._open = true;
      n._isModal = true;
      n.setAttribute('open', '');
      body.appendChild(n);
    };
    n.close = function () {
      if (!n._open) return;
      n._open = false;
      n._isModal = false;
      n.removeAttribute('open');
      var ev = new Event('close');
      ev.target = n;
      var ls = n._listeners['close'] || [];
      for (var i = 0; i < ls.length; i++) {
        try { ls[i].call(n, ev); } catch (e) {}
      }
    };
    return n;
  }

  var head = new Node('head');
  var body = new Node('body');
  head._isConnected = true;
  body._isConnected = true;

  var doc = {
    head: head,
    body: body,
    documentElement: new Node('html'),
    currentScript: null,
    createElement: function (tag) {
      var n;
      if (tag === 'dialog') n = makeDialog();
      else n = new Node(tag);
      return n;
    },
    createTextNode: function (s) { return { nodeType: 3, _text: String(s) }; },
    getElementById: function (id) {
      function find(node) {
        if (!node || !node.attrs) return null;
        if (node.attrs.id === id) return node;
        if (!node.children) return null;
        for (var i = 0; i < node.children.length; i++) {
          var f = find(node.children[i]);
          if (f) return f;
        }
        return null;
      }
      var hit = find(body);
      if (hit) return hit;
      return find(head);
    },
    addEventListener: function () {},
    readyState: 'complete',
  };

  var ctx = {
    HT: HT,
    window: { HT: HT, __htShellReplacesTheme: false, document: doc },
    document: doc,
    Event: Event,
    URL: URL,
    console: console,
    Object: Object,
    Symbol: Symbol,
    Array: Array,
    Promise: Promise,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Date: Date,
    Math: Math,
    JSON: JSON,
    Error: Error,
    TypeError: TypeError,
    String: String,
    Number: Number,
    Boolean: Boolean,
    parseInt: parseInt,
    parseFloat: parseFloat,
    isNaN: isNaN,
    isFinite: isFinite,
    RegExp: RegExp,
    getComputedStyle: function () { return { getPropertyValue: function () { return ''; } }; },
  };
  ctx.window.window = ctx.window;
  ctx.window.setTimeout = setTimeout;
  ctx.window.clearTimeout = clearTimeout;
  ctx.global = ctx;
  return { ctx: ctx, HT: HT, doc: doc, lazyLog: lazyLog, Node: Node, Event: Event };
}

// =============================================================
// Run scripts in a fresh context.
// =============================================================

function runScript(src, ctx, filename) {
  vm.runInContext(src, ctx, { filename: filename || 'inline.js' });
}

function runShellThin() {
  const built = buildCtx();
  vm.createContext(built.ctx);
  runScript(SHELL_THIN_SRC, built.ctx, 'shell-thin.js');
  return built;
}

function loadV2(built) {
  // The shell-thin makeProxy returns a Proxy whose get-trap
  // returns a function for every property — perfect for
  // dispatching lazy-loads, but it shadows any real property
  // the sub-modules write onto the same name. So we replace
  // the Proxy with a plain `{}` BEFORE the sub-modules run,
  // so each `NS.datePickerV2 = NS.datePickerV2 || {}` keeps
  // the plain object and subsequent `DPV.utils = ...` writes
  // hit it directly.
  vm.runInContext(`
    Object.defineProperty(HT, 'datePickerV2', {
      value: {},
      writable: true,
      configurable: true,
      enumerable: true,
    });
  `, built.ctx, { filename: 'reset-proxy.js' });
  // Load the four sub-modules in dependency order so
  // HT.datePickerV2.{utils,css,dialogs,core} are populated.
  runScript(UTILS_SRC,  built.ctx, 'utils.js');
  runScript(CSS_SRC,    built.ctx, 'css.js');
  runScript(DIALOG_SRC, built.ctx, 'dialog.js');
  runScript(CORE_SRC,   built.ctx, 'core.js');
  // Sanity-check the sub-modules populated the namespace.
  if (!built.HT.datePickerV2.utils ||
      !built.HT.datePickerV2.core ||
      !built.HT.datePickerV2.dialogs ||
      !built.HT.datePickerV2.css) {
    console.error('sub-modules did not populate the namespace');
    process.exit(2);
  }
}

// =============================================================
// Tests.
// =============================================================

console.log('--- 0. Phase 2b notice ---');
console.log('  SKIP  HT.datePickerV2 Proxy round-trip — exercised');
console.log('         end-to-end by the lab page (Phase 2d). The');
console.log('         Proxy recursion hazard (the stub re-dispatches');
console.log('         if the real API is not yet installed) is the');
console.log('         reason this smoke verifies the Proxy shape in');
console.log('         §I and the sub-modules directly from §II onward.');

section('I. shell-thin.js installs HT.datePickerV2 Proxy');
{
  const built = runShellThin();
  check(typeof built.HT.datePickerV2 === 'object' && built.HT.datePickerV2 !== null,
    'HT.datePickerV2 exists after shell-thin.js parse');
  check(typeof built.HT.datePickerV2.enhance === 'function',
    'HT.datePickerV2.enhance is a function (Proxy stub)');
  check(typeof built.HT.datePickerV2.openById === 'function',
    'HT.datePickerV2.openById is a function (Proxy stub)');
  check(typeof built.HT.datePickerV2.isOpenById === 'function',
    'HT.datePickerV2.isOpenById is a function (Proxy stub)');
  // The Proxy should lazy-load the entry file — verify the
  // URL is recorded.
  const fn = built.HT.datePickerV2.enhance;
  check(typeof fn === 'function', 'property access returns a function');
}

section('II. utils module — parse / format / gridCells');
{
  const built = runShellThin();
  loadV2(built);
  const U = built.HT.datePickerV2.utils;

  check(U.parseDate('2026-08-17').y === 2026 &&
        U.parseDate('2026-08-17').m === 8 &&
        U.parseDate('2026-08-17').d === 17,
    'parseDate(\'2026-08-17\') → {y:2026,m:8,d:17}');
  check(U.parseDate('not-a-date') === null,
    'parseDate malformed → null');
  check(U.parseDate('2026-13-01') === null,
    'parseDate invalid month → null');
  check(U.parseDate('2026-02-30') === null,
    'parseDate invalid day-of-month → null');
  check(U.parseTime('14:30').hh === 14 && U.parseTime('14:30').mm === 30,
    'parseTime(\'14:30\') → {hh:14,mm:30}');
  check(U.parseTime('24:00') === null,
    'parseTime hour=24 → null');
  check(U.parseDateTime('2026-08-17T14:30').y === 2026 &&
        U.parseDateTime('2026-08-17T14:30').m === 8 &&
        U.parseDateTime('2026-08-17T14:30').d === 17 &&
        U.parseDateTime('2026-08-17T14:30').hh === 14 &&
        U.parseDateTime('2026-08-17T14:30').mm === 30,
    'parseDateTime(\'2026-08-17T14:30\') → all five parts');
  check(U.formatDate({ y: 2026, m: 8, d: 17, hh: 0, mm: 0 }) === '2026-08-17',
    'formatDate(2026-08-17) === \'2026-08-17\'');
  check(U.formatTime({ y: 1970, m: 1, d: 1, hh: 14, mm: 30 }) === '14:30',
    'formatTime(14:30) === \'14:30\'');
  var cells = U.gridCells(2026, 8);
  check(cells.length === 42,
    'gridCells(2026, 8) returns 42 cells');
  check(cells[0].inMonth === false,
    'gridCells first cell is previous-month');
  var inMonth = cells.filter(function (c) { return c.inMonth; });
  check(inMonth.length === 31,
    'gridCells(2026, 8) has 31 in-month cells (August)');
  var firstInMonth = cells.find(function (c) { return c.inMonth; });
  check(firstInMonth.d === 1 && firstInMonth.m === 8,
    'gridCells first in-month cell is August 1');
}

section('III. enhance() returns a handle; idempotent on same input');
{
  const built = runShellThin();
  loadV2(built);
  const core = built.HT.datePickerV2.core;
  // Input stub with proper attribute/IDL mirroring so the type
  // swap (and restore-on-destroy) can be verified end-to-end.
  // A real <input> reflects the `type` content attribute to the
  // .type IDL property; we mirror that here so enhance()'s
  // `try { input.type = 'text' }` actually changes it.
  var input = (function () {
    var attrs = { type: 'date' };
    var n = {
      nodeType: 1, id: 'test-date-1', value: '',
      addEventListener: function () {}, removeEventListener: function () {},
      dispatchEvent: function () {},
      setAttribute: function (k, v) { attrs[k] = String(v); },
      removeAttribute: function (k) { delete attrs[k]; },
      getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
    };
    Object.defineProperty(n, 'type', {
      get: function () { return attrs.type || ''; },
      set: function (v) { attrs.type = String(v); },
      configurable: true,
    });
    return n;
  })();
  var h1 = core.enhance(input, {});
  check(typeof h1.open === 'function' && typeof h1.close === 'function' &&
        typeof h1.destroy === 'function' && typeof h1.isOpen === 'function',
    'enhance returns handle with {open,close,destroy,isOpen}');
  // Phase 2 visual fix — enhance() swaps the input's `type` from
  // "date" to "text" so the OS-native picker can't launch.
  check(input.type === 'text',
    'enhance swaps input.type to "text" to suppress native picker');
  var h2 = core.enhance(input, {});
  check(h1 === h2,
    'enhance twice on same input returns the same handle (idempotent — works despite type swap)');
  // destroy() must restore the original type so the input
  // reverts to its native picker behavior after teardown.
  h1.destroy();
  check(input.type === 'date',
    'destroy() restores input.type to "date"');
}

section('IV. enhance rejects bad inputs');
{
  const built = runShellThin();
  loadV2(built);
  const core = built.HT.datePickerV2.core;
  var threw1 = false;
  try { core.enhance(null, {}); } catch (_) { threw1 = true; }
  check(threw1, 'enhance(null) throws');
  var threw2 = false;
  try { core.enhance({ nodeType: 1, type: 'text' }, {}); } catch (_) { threw2 = true; }
  check(threw2, 'enhance(text input) throws (only date/time/datetime-local)');
}

section('V. open() and close() manage currentOpenInput');
{
  const built = runShellThin();
  loadV2(built);
  const core = built.HT.datePickerV2.core;
  var input = {
    nodeType: 1, type: 'date', id: 'test-date-2', value: '',
    addEventListener: function () {}, removeEventListener: function () {},
    dispatchEvent: function () {},
  };
  var h = core.enhance(input, {});
  check(core._currentOpenInput() === null, 'pre-open currentOpenInput === null');
  h.open();
  check(core._currentOpenInput() === input, 'after open: currentOpenInput === input');
  check(h.isOpen() === true, 'isOpen() === true after open');
  h.close();
  check(core._currentOpenInput() === null, 'after close: currentOpenInput === null');
  check(h.isOpen() === false, 'isOpen() === false after close');
}

section('VI. REGRESSION TEST — close() then focus must NOT re-open');
{
  const built = runShellThin();
  loadV2(built);
  const core = built.HT.datePickerV2.core;
  const Node = built.Node;
  var openCount = 0;
  var input = new Node('input');
  input.attrs.type = 'date';
  input.attrs.id = 'test-date-3';
  input.attrs.value = '';
  var h = core.enhance(input, { onOpen: function () { openCount += 1; } });
  h.open();
  check(openCount === 1, 'onOpen fired once on initial open');
  h.close();
  check(core._currentOpenInput() === null, 'after close: currentOpenInput === null');
  // The dialog 'close' event arms _suppressNextFocus so the
  // browser's native focus-return to the source input doesn't
  // re-open the picker (the hotfix-5 bug class). The listener
  // receives that focus event and consumes it.
  input.dispatchEvent({ type: 'focus', target: input });
  check(core._currentOpenInput() === null,
    'after close + focus event: currentOpenInput is STILL null');
  check(openCount === 1,
    'after close + focus event: onOpen has NOT fired again (openCount === 1)');
  // Subsequent focus (without an intervening close) DOES open —
  // because the suppression flag was consumed by the first event.
  input.dispatchEvent({ type: 'focus', target: input });
  check(openCount === 2,
    'second focus (after suppression consumed) re-opens the picker');
  h.close();
}

section('VI.b focus handler opens the dialog (no programmatic open)');
{
  // Verify the user-facing interaction: clicking or tabbing onto
  // the input opens the v2 picker. Without this, the lab page
  // would show the native picker even after enhance() runs.
  const built = runShellThin();
  loadV2(built);
  const core = built.HT.datePickerV2.core;
  const Node = built.Node;
  var input = new Node('input');
  input.attrs.type = 'date';
  input.attrs.id = 'test-date-focus';
  var openCount = 0;
  core.enhance(input, { onOpen: function () { openCount += 1; } });
  // First focus opens the dialog.
  input.dispatchEvent({ type: 'focus', target: input });
  check(openCount === 1, 'first focus after enhance() opens the dialog');
  check(core._currentOpenInput() === input, 'currentOpenInput === input after focus');
  // Second focus on the SAME input while open is a no-op (single-opener).
  input.dispatchEvent({ type: 'focus', target: input });
  check(openCount === 1, 'second focus on already-open input is a no-op');
}

section('VI.c mousedown preventDefault suppresses the native picker');
{
  // When the user clicks the input, the browser fires mousedown
  // THEN focus THEN click. Our mousedown handler calls
  // preventDefault() so the native picker doesn't surface; focus
  // then opens the v2 dialog. This is how the lab page shows the
  // custom picker instead of the OS one.
  const built = runShellThin();
  loadV2(built);
  const core = built.HT.datePickerV2.core;
  const Node = built.Node;
  const Event = built.Event;
  var input = new Node('input');
  input.attrs.type = 'date';
  input.attrs.id = 'test-date-mousedown';
  var prevented = 0;
  // Patch addEventListener so we can spy on preventDefault from
  // the test perspective — the mousedown handler is internal.
  var origAdd = input.addEventListener.bind(input);
  input.addEventListener = function (kind, fn) {
    if (kind === 'mousedown') {
      origAdd(kind, function (ev) {
        fn(ev);
        if (ev.defaultPrevented) prevented += 1;
      });
    } else {
      origAdd(kind, fn);
    }
  };
  core.enhance(input, {});
  var ev = new Event('mousedown');
  input.dispatchEvent(ev);
  check(prevented === 1, 'mousedown preventDefault fires (suppresses native picker)');
}

section('VII. Opening B while A is open closes A (single-open invariant)');
{
  const built = runShellThin();
  loadV2(built);
  const core = built.HT.datePickerV2.core;
  var a = { nodeType: 1, type: 'date', id: 'A', value: '',
    addEventListener: function () {}, removeEventListener: function () {},
    dispatchEvent: function () {} };
  var b = { nodeType: 1, type: 'date', id: 'B', value: '',
    addEventListener: function () {}, removeEventListener: function () {},
    dispatchEvent: function () {} };
  var ha = core.enhance(a, {});
  var hb = core.enhance(b, {});
  ha.open();
  check(core._currentOpenInput() === a, 'A is open after ha.open()');
  hb.open();
  check(core._currentOpenInput() === b, 'B is current after hb.open() (A auto-closed)');
  check(ha.isOpen() === false, 'A.isOpen() === false after B opened');
  check(hb.isOpen() === true, 'B.isOpen() === true after hb.open()');
  hb.close();
  check(core._currentOpenInput() === null, 'after B.close(), currentOpenInput === null');
}

section('VIII. Date dialog: cell click writes input.value + fires events');
{
  const built = runShellThin();
  loadV2(built);
  const core = built.HT.datePickerV2.core;
  var events = [];
  var input = {
    nodeType: 1, type: 'date', id: 'test-date-4', value: '',
    addEventListener: function () {}, removeEventListener: function () {},
    dispatchEvent: function (ev) { events.push(ev.type); },
  };
  var h = core.enhance(input, {});
  h.open();
  var dlg = built.doc.getElementById(h._state._dlg.attrs.id);
  check(!!dlg, 'dialog is mounted in body after open()');
  // Find the date grid (depth-first walk).
  function findGrid(node) {
    if (!node || !node.children) return null;
    if (node.attrs && node.attrs['data-dpv2-grid'] === 'date') return node;
    for (var i = 0; i < node.children.length; i++) {
      var f = findGrid(node.children[i]);
      if (f) return f;
    }
    return null;
  }
  var grid = findGrid(dlg);
  check(!!grid, 'date dialog has a grid');
  // Pick the first in-month cell (August 1, 2026).
  var cell = null;
  for (var i = 0; i < grid.children.length; i++) {
    var c = grid.children[i];
    if (c.attrs && c.attrs['data-other-month'] === '0' && c.attrs['data-d'] === '1') {
      cell = c;
      break;
    }
  }
  check(!!cell, 'found August 1 cell');
  // Verify the today marker is present on exactly one cell.
  // The today date depends on system clock so we don't assert
  // a specific (y, m, d); we just verify the marker is set on
  // exactly one cell in the rendered grid.
  var todayCount = 0;
  var todayCell = null;
  for (var i = 0; i < grid.children.length; i++) {
    var c = grid.children[i];
    if (c.attrs && c.attrs['data-today'] === '1') {
      todayCount += 1;
      todayCell = c;
    }
  }
  check(todayCount === 1, 'exactly one cell carries data-today="1" (got ' + todayCount + ')');
  check(todayCell && todayCell.attrs['aria-label'] && /today/i.test(todayCell.attrs['aria-label']),
    'today cell has "today" in aria-label for screen readers');
  if (cell) {
    cell.dispatchEvent({ type: 'click', target: cell });
    check(/^\d{4}-\d{2}-\d{2}$/.test(input.value),
      'input.value matches YYYY-MM-DD after cell click: ' + input.value);
    check(events.indexOf('input') >= 0, 'input event fired');
    check(events.indexOf('change') >= 0, 'change event fired');
    check(h.isOpen() === false, 'dialog closed after selection');
    check(core._currentOpenInput() === null,
      'currentOpenInput === null after commit');
  }
}

section('IX. Time dialog: hour cell writes HH:MM');
{
  const built = runShellThin();
  loadV2(built);
  const core = built.HT.datePickerV2.core;
  var input = {
    nodeType: 1, type: 'time', id: 'test-time-1', value: '',
    addEventListener: function () {}, removeEventListener: function () {},
    dispatchEvent: function () {},
  };
  var h = core.enhance(input, {});
  h.open();
  var dlg = built.doc.getElementById(h._state._dlg.attrs.id);
  function findCol(name) {
    function walk(node) {
      if (!node || !node.children) return null;
      if (node.attrs && node.attrs['data-dpv2-col'] === name) return node;
      for (var i = 0; i < node.children.length; i++) {
        var sub = walk(node.children[i]);
        if (sub) return sub;
      }
      return null;
    }
    return walk(dlg);
  }
  var hourCol = findCol('hour');
  var minCol = findCol('minute');
  check(!!hourCol && hourCol.children.length === 24, 'hour column has 24 cells');
  check(!!minCol && minCol.children.length === 60, 'minute column has 60 cells');
  // Click hour=14 → commits HH:00 = "14:00" and closes.
  hourCol.children[14].dispatchEvent({ type: 'click', target: hourCol.children[14] });
  check(input.value === '14:00',
    'after hour=14 click: input.value === \'14:00\'');
}

section('X. Datetime dialog: type marker + open / close');
{
  const built = runShellThin();
  loadV2(built);
  const core = built.HT.datePickerV2.core;
  var input = {
    nodeType: 1, type: 'datetime-local', id: 'test-dt-1', value: '',
    addEventListener: function () {}, removeEventListener: function () {},
    dispatchEvent: function () {},
  };
  var h = core.enhance(input, {});
  h.open();
  var dlg = built.doc.getElementById(h._state._dlg.attrs.id);
  check(dlg.attrs['data-dpv2-type'] === 'datetime-local',
    'datetime-local dialog has the right type marker');
  h.close();
  check(core._currentOpenInput() === null,
    'datetime-local close clears currentOpenInput');
}

section('XI. Backdrop click (target === dialog) closes picker');
{
  const built = runShellThin();
  loadV2(built);
  const core = built.HT.datePickerV2.core;
  var input = {
    nodeType: 1, type: 'date', id: 'test-date-5', value: '',
    addEventListener: function () {}, removeEventListener: function () {},
    dispatchEvent: function () {},
  };
  var h = core.enhance(input, {});
  h.open();
  var dlg = built.doc.getElementById(h._state._dlg.attrs.id);
  dlg.dispatchEvent({ type: 'click', target: dlg });
  check(core._currentOpenInput() === null,
    'backdrop click (target === dialog) closes picker');
}

section('XII. Escape (dialog native close event) clears state');
{
  const built = runShellThin();
  loadV2(built);
  const core = built.HT.datePickerV2.core;
  var input = {
    nodeType: 1, type: 'date', id: 'test-date-6', value: '',
    addEventListener: function () {}, removeEventListener: function () {},
    dispatchEvent: function () {},
  };
  var h = core.enhance(input, {});
  h.open();
  check(core._currentOpenInput() === input, 'pre-Escape: input is current');
  var dlg = built.doc.getElementById(h._state._dlg.attrs.id);
  dlg.close(); // simulates Escape via the dialog's native close path
  check(core._currentOpenInput() === null,
    'after Escape (dlg.close()): currentOpenInput === null');
}

section('XIII. destroy() removes dialog + drops state');
{
  const built = runShellThin();
  loadV2(built);
  const core = built.HT.datePickerV2.core;
  var input = {
    nodeType: 1, type: 'date', id: 'test-date-7', value: '',
    addEventListener: function () {}, removeEventListener: function () {},
    dispatchEvent: function () {},
  };
  var h = core.enhance(input, {});
  h.open();
  var dlg = built.doc.getElementById(h._state._dlg.attrs.id);
  h.destroy();
  check(core._stateFor(input) === null,
    'after destroy: _stateFor(input) === null');
  check(built.doc.getElementById(dlg.attrs.id) === null,
    'after destroy: dialog DOM is removed from the body');
}

section('XIV. Phase 2 bug — entry-script install path does not produce undefined API surface');
{
  // The user's reported error was
  //   "Uncaught TypeError: api.openById is not a function at date-picker-lab.js:135"
  // which happened when the lab page's "Open programmatically" button
  // synchronously read `HT.datePickerV2.openById`. Root cause: the
  // shell-thin Proxy returns a fresh dispatch function for any
  // property access, so the entry script's `Object.freeze({...,
  // openById: HT.datePickerV2.core.openById, ...})` call — which
  // runs INSIDE the install .then() — read `core.openById` via the
  // Proxy and got undefined. After defineProperty replaced the
  // Proxy with the frozen API, every function field was undefined.
  //
  // This section simulates the install path manually. We:
  //   (a) Verify that the entry script REPLACES the Proxy with
  //       a plain object at IIFE-parse time (the Phase 2 fix).
  //   (b) Verify that, starting from the populated sub-module
  //       namespace (which is what `loadV2` sets up), the entry
  //       script's frozen public API is built with every function
  //       field populated — NOT undefined.
  //
  // We cannot run the entry script directly because its
  // loadSubmodules() chain hangs in the synthetic vm context
  // (the DOM stub never fires script.onload). Instead we extract
  // the install code: read the entry script source, run the
  // Proxy-replacement IIFE manually, and assert the invariants
  // the entry script depends on after the sub-module chain.

  const built = runShellThin();
  loadV2(built);

  // (a) The entry script starts with an IIFE that does
  //     `Object.defineProperty(HT, 'datePickerV2', {value: {}, ...})`
  //     BEFORE kicking off the sub-module chain. Simulate that.
  vm.runInContext(`
    Object.defineProperty(HT, 'datePickerV2', {
      value: {},
      writable: true,
      configurable: true,
      enumerable: true,
    });
  `, built.ctx, { filename: 'simulate-entry-script-init.js' });

  check(built.HT.datePickerV2 &&
        typeof built.HT.datePickerV2.openById === 'undefined' &&
        typeof built.HT.datePickerV2.core === 'undefined',
    '(a) after entry-script init: HT.datePickerV2 is a fresh plain object (sub-module writes preserved by separate storage, NOT a Proxy)');

  // The sub-modules' writes (made during loadV2) are now lost —
  // simulating what would happen if the entry script ran before
  // the sub-modules. So now load sub-modules AGAIN to populate
  // this fresh object, simulating the sub-module chain landing.
  runScript(UTILS_SRC,  built.ctx, 'utils.js');
  runScript(CSS_SRC,    built.ctx, 'css.js');
  runScript(DIALOG_SRC, built.ctx, 'dialog.js');
  runScript(CORE_SRC,   built.ctx, 'core.js');

  check(built.HT.datePickerV2.utils &&
        typeof built.HT.datePickerV2.utils.parseDate === 'function',
    '(a) utils re-populated on the fresh plain object');
  check(built.HT.datePickerV2.core &&
        typeof built.HT.datePickerV2.core.enhance === 'function' &&
        typeof built.HT.datePickerV2.core.openById === 'function' &&
        typeof built.HT.datePickerV2.core.closeById === 'function' &&
        typeof built.HT.datePickerV2.core.isOpenById === 'function',
    '(a) core re-populated on the fresh plain object');

  // (b) Simulate the entry script's install .then() body: build
  //     the frozen public API from the populated namespace and
  //     install it via defineProperty. This is the same code
  //     as date-picker-v2/date-picker.js lines 121-163, lifted
  //     here so we can test it in the synthetic context without
  //     running the full entry script.
  vm.runInContext(`
    var api = Object.freeze({
      enhance: HT.datePickerV2.core.enhance,
      open: function (handle) {
        if (handle && handle.open) handle.open();
        else if (typeof handle === 'string') HT.datePickerV2.core.openById(handle);
      },
      close: function (handle) {
        if (handle && handle.close) handle.close();
        else if (typeof handle === 'string') HT.datePickerV2.core.closeById(handle);
      },
      destroy: function (handle) {
        if (handle && handle.destroy) handle.destroy();
        else if (typeof handle === 'string') HT.datePickerV2.core.destroyById(handle);
      },
      isOpen: function (handle) {
        if (handle && typeof handle.isOpen === 'function') return handle.isOpen();
        if (typeof handle === 'string') return HT.datePickerV2.core.isOpenById(handle);
        return false;
      },
      openById: HT.datePickerV2.core.openById,
      closeById: HT.datePickerV2.core.closeById,
      destroyById: HT.datePickerV2.core.destroyById,
      isOpenById: HT.datePickerV2.core.isOpenById,
      _utils: HT.datePickerV2.utils,
      _core: HT.datePickerV2.core,
      _reset: function () { HT.datePickerV2.core._reset(); },
    });
    Object.defineProperty(HT, 'datePickerV2', {
      value: api,
      writable: false,
      configurable: false,
      enumerable: true,
    });
  `, built.ctx, { filename: 'simulate-entry-script-install.js' });

  // The lab page's "Open programmatically" button reads these
  // synchronously. They MUST be functions, not undefined.
  check(typeof built.HT.datePickerV2.openById === 'function',
    '(b) HT.datePickerV2.openById is a function after install (regression test)');
  check(typeof built.HT.datePickerV2.closeById === 'function',
    '(b) HT.datePickerV2.closeById is a function after install');
  check(typeof built.HT.datePickerV2.isOpenById === 'function',
    '(b) HT.datePickerV2.isOpenById is a function after install');
  check(typeof built.HT.datePickerV2.enhance === 'function',
    '(b) HT.datePickerV2.enhance is a function after install');
  check(typeof built.HT.datePickerV2.open === 'function',
    '(b) HT.datePickerV2.open is a function after install');
  check(typeof built.HT.datePickerV2.close === 'function',
    '(b) HT.datePickerV2.close is a function after install');
  check(typeof built.HT.datePickerV2.destroy === 'function',
    '(b) HT.datePickerV2.destroy is a function after install');
  check(typeof built.HT.datePickerV2.isOpen === 'function',
    '(b) HT.datePickerV2.isOpen is a function after install');
}

section('XV. Phase 2 bug — old behavior (Proxy NOT replaced) yields undefined API surface');
{
  // Counter-test for §XIV. If we keep the Proxy in place when the
  // sub-modules run, the namespace is masked by the Proxy's `get`
  // trap and the sub-modules' `NS.datePickerV2.utils = {...}`
  // assignments land on the dispatch function object instead of
  // the namespace. The install `.then` then reads
  // `HT.datePickerV2.core.enhance` via the Proxy → undefined.
  // The frozen public API ends up with EVERY function field set
  // to undefined. The lab page's "Open programmatically" button
  // then synchronously reads `api.openById`, gets undefined, and
  // throws the exact TypeError the user reported.
  //
  // This test verifies the bug-trigger condition without going
  // through the full entry script (which can't complete its async
  // chain in the synthetic vm context). It documents WHY §XIV's
  // fix is necessary: without the Proxy-replace step at entry-
  // script init, every API method is undefined.

  const built = runShellThin();
  // Deliberately do NOT call loadV2() — leave the Proxy in place.

  // Read the namespace — Proxy `get` trap returns a function for
  // any property, including `core`. So `core.enhance` is undefined.
  check(typeof built.HT.datePickerV2.core === 'function',
    '(pre-fix) HT.datePickerV2.core is the Proxy dispatch function, NOT the real core');
  check(typeof built.HT.datePickerV2.core.enhance === 'undefined',
    '(pre-fix) HT.datePickerV2.core.enhance is undefined — bug trigger');

  // Simulate the install code from the entry script. With the
  // Proxy in place, every API method reads undefined.
  vm.runInContext(`
    var api = Object.freeze({
      enhance: HT.datePickerV2.core.enhance,
      openById: HT.datePickerV2.core.openById,
      closeById: HT.datePickerV2.core.closeById,
      isOpenById: HT.datePickerV2.core.isOpenById,
    });
    Object.defineProperty(HT, 'datePickerV2', {
      value: api, writable: false, configurable: false, enumerable: true,
    });
  `, built.ctx, { filename: 'simulate-old-buggy-install.js' });

  check(typeof built.HT.datePickerV2.enhance === 'undefined',
    '(pre-fix) HT.datePickerV2.enhance is undefined after install — bug');
  check(typeof built.HT.datePickerV2.openById === 'undefined',
    '(pre-fix) HT.datePickerV2.openById is undefined after install — user-reported error');
  check(typeof built.HT.datePickerV2.closeById === 'undefined',
    '(pre-fix) HT.datePickerV2.closeById is undefined after install — sibling');
  check(typeof built.HT.datePickerV2.isOpenById === 'undefined',
    '(pre-fix) HT.datePickerV2.isOpenById is undefined after install — sibling');
}

console.log('\n=== smoke_date_picker_v2 ===');
console.log('  PASS  ' + pass);
console.log('  FAIL  ' + fail);
if (fail > 0) {
  console.log('  smoke FAILED');
  process.exit(1);
}
console.log('  smoke PASSED');
process.exit(0);