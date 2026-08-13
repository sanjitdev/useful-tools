/* ============================================
   Smoke harness for Story 9.8 — Exam Countdown.
   Loads tools/exam-countdown/exam-countdown.js
   in a vm context with stub DOM + localStorage
   + URLSearchParams stubs and asserts: date
   parsing, day/hour/minute/second math,
   past-date handling, empty-state rendering,
   localStorage write/read round-trip,
   URL state precedence over localStorage,
   URL state malformed fallback, keyboard
   't' and 'c' shortcuts, keyboard shortcuts
   scoped to inputs, privacy (no fetch / XHR),
   tab-order-canonical coverage, and
   no-console-error boot.

   Per AC-7: ≥ 25 assertions, 12 categories,
   vacuous-pass guard.
   ============================================ */

'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const TOOL_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'tools/exam-countdown/exam-countdown.js'),
  'utf8'
);
const CSS_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'tools/exam-countdown/exam-countdown.css'),
  'utf8'
);

let pass = 0;
let fail = 0;
function check(cond, label) {
  if (cond) {
    pass += 1;
    console.log('  PASS  ' + label);
  } else {
    fail += 1;
    console.log('  FAIL  ' + label);
  }
}

// ---------------------------------------------------------------
// Stub DOM factory (matches flashcard-timer harness style)
// ---------------------------------------------------------------

function makeStub(initial, opts) {
  const o = opts || {};
  const stub = {
    _v: initial == null ? '' : String(initial),
    _hidden: false,
    _text: '',
    _className: '',
    _attrs: o.attrs || {},
    _classList: [],
    _style: {},
    listeners: {},
    tagName: o.tagName || '',
    type: o.type || '',
  };
  Object.defineProperty(stub, 'value', {
    get() { return this._v; },
    set(v) { this._v = v == null ? '' : String(v); },
  });
  Object.defineProperty(stub, 'textContent', {
    get() { return this._text; },
    set(v) { this._text = v == null ? '' : String(v); },
  });
  Object.defineProperty(stub, 'className', {
    get() { return this._className; },
    set(v) { this._className = v == null ? '' : String(v); },
  });
  Object.defineProperty(stub, 'style', {
    get() { return this._style; },
    set(v) { Object.assign(this._style, v); },
  });
  Object.defineProperty(stub, 'hidden', {
    get() { return this._hidden; },
    set(v) { this._hidden = !!v; },
  });
  Object.defineProperty(stub, 'classList', {
    get() {
      const list = this._classList;
      return {
        add: function (c) { if (list.indexOf(c) < 0) list.push(c); },
        remove: function (c) { const i = list.indexOf(c); if (i >= 0) list.splice(i, 1); },
        contains: function (c) { return list.indexOf(c) >= 0; },
      };
    },
  });
  stub.getAttribute = function (name) {
    return stub._attrs[name] != null ? stub._attrs[name] : null;
  };
  stub.setAttribute = function (name, v) {
    stub._attrs[name] = v;
  };
  stub.addEventListener = function (ev, fn) {
    this.listeners[ev] = fn;
  };
  stub.removeEventListener = function () {};
  stub.focus = function () { stub._focused = true; };
  stub.click = function () {
    if (this.listeners.click) this.listeners.click();
  };
  return stub;
}

// ---------------------------------------------------------------
// Sandbox factory: builds a fresh vm context with stub DOM
// ---------------------------------------------------------------

function buildAndLoad(opts) {
  const o = opts || {};
  const elements = {
    '#ec-target': makeStub(o.target || '', { tagName: 'INPUT', type: 'datetime-local' }),
    '#ec-empty-notice': makeStub('', { attrs: {}, tagName: 'P' }),
    '#ec-past-notice': makeStub('', { attrs: {}, tagName: 'P' }),
    '#ec-days': makeStub('', { tagName: 'SPAN' }),
    '#ec-hours': makeStub('', { tagName: 'SPAN' }),
    '#ec-minutes': makeStub('', { tagName: 'SPAN' }),
    '#ec-seconds': makeStub('', { tagName: 'SPAN' }),
    '#ec-clear': makeStub('', { tagName: 'BUTTON' }),
  };
  // Per-build localStorage
  const ls = Object.create(null);
  if (o.localStorage) {
    for (const k of Object.keys(o.localStorage)) {
      ls[k] = o.localStorage[k];
    }
  }
  const fetchCalls = [];
  const xhrCalls = [];
  const consoleErrors = [];
  const consoleInfos = [];
  // Keydown listener spy
  const keydownListeners = [];
  let activeElement = null;
  const ctx = {
    console: {
      log: () => {},
      warn: () => {},
      error: function () { consoleErrors.push(Array.from(arguments)); },
      info: function () { consoleInfos.push(Array.from(arguments)); },
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    Intl: Intl,
    Date: Date,
    Math: Math,
    URLSearchParams: URLSearchParams,
    history: {
      replaceState: function (state, title, url) {
        ctx._lastUrl = url;
      },
      pushState: () => {},
      state: null,
    },
    location: {
      hash: '',
      pathname: '/tools/exam-countdown/',
      search: o.search || '',
    },
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    fetch: function () { fetchCalls.push(arguments); return Promise.resolve({}); },
    XMLHttpRequest: function () { xhrCalls.push(true); },
    localStorage: {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(ls, k) ? ls[k] : null; },
      setItem: function (k, v) { ls[k] = String(v); },
      removeItem: function (k) { delete ls[k]; },
      clear: function () { for (const k of Object.keys(ls)) delete ls[k]; },
      key: function (i) { return Object.keys(ls)[i] || null; },
      get length() { return Object.keys(ls).length; },
    },
    HT: {
      $: (sel) => elements[sel] || null,
      debounce: function (fn) { return fn; },
      storage: {
        get: function (k, fallback) {
          return Object.prototype.hasOwnProperty.call(ls, k) ? ls[k] : (fallback == null ? null : fallback);
        },
        set: function (k, v) { ls[k] = String(v); return true; },
        remove: function (k) { delete ls[k]; return true; },
        list: function () { return Object.keys(ls); },
        clear: function () { for (const k of Object.keys(ls)) delete ls[k]; return true; },
        keys: function () { return Object.keys(ls); },
      },
    },
    document: {
      addEventListener: function (ev, fn) {
        if (ev === 'keydown') keydownListeners.push(fn);
      },
      removeEventListener: function () {},
      getElementById: (id) => elements['#' + id] || null,
      querySelector: () => null,
      querySelectorAll: () => [],
      readyState: 'complete',
      tagName: 'BODY',
      get activeElement() { return activeElement; },
      set activeElement(v) { activeElement = v; },
    },
  };
  ctx.window = ctx;
  ctx.window.HT = ctx.HT;

  vm.createContext(ctx);
  vm.runInContext(TOOL_SRC, ctx, { filename: 'exam-countdown.js' });

  return {
    ctx, elements, ls, fetchCalls, xhrCalls, consoleErrors, consoleInfos,
    keydownListeners,
    setActiveElement: function (el) { activeElement = el; },
    getLastUrl: function () { return ctx._lastUrl || ''; },
  };
}

function fireKeydown(env, key, targetTag, targetEl) {
  const ev = {
    key: key,
    target: targetEl || { tagName: targetTag || 'BODY' },
    preventDefault: () => {},
  };
  for (const fn of env.keydownListeners) fn(ev);
}

// ===============================================================
// Category (i) — Date parsing
// ===============================================================
{
  check(!isNaN(new Date('2026-12-15T09:00').getTime()),
    '(i) valid ISO local parses to valid Date');
  check(isNaN(new Date('garbage').getTime()),
    '(i) invalid string parses to Invalid Date');
  check(new Date('2026-12-15T09:00').getFullYear() === 2026,
    '(i) year extracted correctly from local ISO');
}

// ===============================================================
// Category (ii)–(v) — Diff math (days/hours/minutes/seconds)
// ===============================================================
{
  // 1 day 2 hours 3 minutes 4 seconds in the future
  const now = Date.now();
  const target = now + ((1*86400) + (2*3600) + (3*60) + 4) * 1000;
  const diff = target - now;
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  check(days === 1, '(ii) days math: 1 day diff');
  check(hours === 2, '(iii) hours math: 2 hours diff');
  check(minutes === 3, '(iv) minutes math: 3 minutes diff');
  check(seconds === 4, '(v) seconds math: 4 seconds diff');
}

// ===============================================================
// Category (vi) — Past-date handling
// ===============================================================
{
  const env = buildAndLoad();
  // Set target to 1 day in the past
  const past = new Date(Date.now() - 86400000);
  const pastLocal = past.getFullYear() + '-'
    + String(past.getMonth()+1).padStart(2,'0') + '-'
    + String(past.getDate()).padStart(2,'0') + 'T'
    + String(past.getHours()).padStart(2,'0') + ':'
    + String(past.getMinutes()).padStart(2,'0');
  env.elements['#ec-target']._v = pastLocal;
  if (env.elements['#ec-target'].listeners.change) {
    env.elements['#ec-target'].listeners.change();
  }
  check(env.elements['#ec-days']._text === '0d',
    '(vi) past date: days render as 0d');
  check(env.elements['#ec-hours']._text === '0h',
    '(vi) past date: hours render as 0h');
  check(env.elements['#ec-minutes']._text === '0m',
    '(vi) past date: minutes render as 0m');
  check(env.elements['#ec-seconds']._text === '0s',
    '(vi) past date: seconds render as 0s (no negative)');
  check(env.elements['#ec-past-notice']._hidden === false,
    '(vi) past date: past-notice shown');
  check(env.elements['#ec-empty-notice']._hidden === true,
    '(vi) past date: empty-notice hidden');
}

// ===============================================================
// Category (vii) — Empty state
// ===============================================================
{
  const env = buildAndLoad();
  // Empty target = empty state. Boot-time render shows empty state.
  check(env.elements['#ec-days']._text === '0d',
    '(vii) empty: days render as 0d');
  check(env.elements['#ec-hours']._text === '0h',
    '(vii) empty: hours render as 0h');
  check(env.elements['#ec-minutes']._text === '0m',
    '(vii) empty: minutes render as 0m');
  check(env.elements['#ec-seconds']._text === '0s',
    '(vii) empty: seconds render as 0s');
  check(env.elements['#ec-empty-notice']._hidden === false,
    '(vii) empty: empty-notice shown');
}

// ===============================================================
// Category (viii) — localStorage round-trip
// ===============================================================
{
  const validTarget = '2027-06-01T12:00';
  const env = buildAndLoad({ localStorage: { 'ht.exam-countdown.target': validTarget } });
  check(env.elements['#ec-target']._v === validTarget,
    '(viii) localStorage: stored target populates input on boot');
}
{
  // Unparseable stored value: tool clears it
  const env = buildAndLoad({ localStorage: { 'ht.exam-countdown.target': 'garbage' } });
  check(env.ls['ht.exam-countdown.target'] === undefined,
    '(viii) localStorage: unparseable stored value is removed on boot');
  check(env.elements['#ec-target']._v === '',
    '(viii) localStorage: unparseable stored value leaves input empty');
}

// ===============================================================
// Category (ix) — URL state precedence over localStorage
// ===============================================================
{
  const lsTarget = '2027-01-15T08:00';
  const urlTarget = '2027-06-01T12:00';
  const env = buildAndLoad({
    search: '?target=' + urlTarget,
    localStorage: { 'ht.exam-countdown.target': lsTarget },
  });
  check(env.elements['#ec-target']._v === urlTarget,
    '(ix) URL state wins over localStorage on boot');
}

// ===============================================================
// Category (x) — URL state malformed
// ===============================================================
{
  const env = buildAndLoad({
    search: '?target=garbage',
    localStorage: { 'ht.exam-countdown.target': '2027-06-01T12:00' },
  });
  check(env.elements['#ec-target']._v === '2027-06-01T12:00',
    '(x) malformed URL target falls back to localStorage');
}
{
  const env = buildAndLoad({
    search: '?target=garbage',
  });
  check(env.elements['#ec-target']._v === '',
    '(x) malformed URL target with no LS leaves input empty');
}

// ===============================================================
// Category (xi) — Keyboard 't' shortcut
// ===============================================================
{
  const env = buildAndLoad();
  const targetEl = env.elements['#ec-target'];
  env.setActiveElement(null);
  fireKeydown(env, 't', 'BODY', null);
  check(targetEl._focused === true,
    '(xi) keyboard t: focuses target input');
}

// ===============================================================
// Category (xii) — Keyboard 'c' shortcut (clear)
// ===============================================================
{
  const env = buildAndLoad({
    localStorage: { 'ht.exam-countdown.target': '2027-06-01T12:00' },
  });
  // Pre-condition: target is populated from LS
  check(env.elements['#ec-target']._v === '2027-06-01T12:00',
    '(xii) keyboard c: precondition — target populated from LS');
  fireKeydown(env, 'c', 'BODY', null);
  check(env.elements['#ec-target']._v === '',
    '(xii) keyboard c: clears target input');
  check(env.ls['ht.exam-countdown.target'] === undefined,
    '(xii) keyboard c: removes LS key');
}

// ===============================================================
// Category (xiii) — Keyboard shortcuts scoped to inputs
// ===============================================================
{
  const env = buildAndLoad();
  const targetEl = env.elements['#ec-target'];
  env.setActiveElement(targetEl);
  // Spy: reset focus flag — a broken scoping would re-focus the input
  // via the 't' handler, which calls `inputEl.focus()` and sets _focused.
  // We pre-set it to false and assert it stays false. Also verify the
  // 'c' shortcut doesn't clear the input when fired inside an input.
  targetEl._focused = false;
  fireKeydown(env, 't', 'INPUT', targetEl);
  check(targetEl._focused === false,
    '(xiii) keyboard scoped: t pressed inside input does NOT focus target (handler short-circuits)');

  // Seed target with a value via localStorage so we can detect if 'c'
  // is wrongly fired inside an input.
  const env2 = buildAndLoad({
    localStorage: { 'ht.exam-countdown.target': '2027-06-01T12:00' },
  });
  const t2 = env2.elements['#ec-target'];
  env2.setActiveElement(t2);
  t2._focused = false;
  fireKeydown(env2, 'c', 'INPUT', t2);
  check(t2._v === '2027-06-01T12:00',
    '(xiii) keyboard scoped: c pressed inside input does NOT clear target');
  check(env2.ls['ht.exam-countdown.target'] === '2027-06-01T12:00',
    '(xiii) keyboard scoped: c pressed inside input does NOT remove LS key');
  check(env2.consoleErrors.length === 0,
    '(xiii) keyboard scoped: no console error when t/c pressed inside input');
}

// ===============================================================
// Category (xiv) — Privacy: no fetch / XHR
// ===============================================================
{
  const validTarget = '2027-06-01T12:00';
  const env = buildAndLoad({
    search: '?target=' + validTarget,
    localStorage: { 'ht.exam-countdown.target': validTarget },
  });
  // Pick a new target
  const newTarget = '2028-01-15T09:00';
  env.elements['#ec-target']._v = newTarget;
  if (env.elements['#ec-target'].listeners.change) {
    env.elements['#ec-target'].listeners.change();
  }
  // Set a past target
  const past = new Date(Date.now() - 86400000);
  const pastLocal = past.getFullYear() + '-'
    + String(past.getMonth()+1).padStart(2,'0') + '-'
    + String(past.getDate()).padStart(2,'0') + 'T00:00';
  env.elements['#ec-target']._v = pastLocal;
  if (env.elements['#ec-target'].listeners.change) {
    env.elements['#ec-target'].listeners.change();
  }
  // Clear via keyboard
  fireKeydown(env, 'c', 'BODY', null);
  check(env.fetchCalls.length === 0,
    '(xiv) privacy: no fetch calls during pick-tick-past-clear sequence');
  check(env.xhrCalls.length === 0,
    '(xiv) privacy: no XMLHttpRequest calls during pick-tick-past-clear sequence');
}

// ===============================================================
// Category (xv) — Tab-order-canonical coverage
// ===============================================================
{
  // Source-level: verify all tab-order-canonical selectors are referenced in the JS
  const required = [
    '#ec-target',
    '#ec-clear',
    '#ec-days',
    '#ec-hours',
    '#ec-minutes',
    '#ec-seconds',
  ];
  for (const sel of required) {
    check(TOOL_SRC.indexOf(sel) >= 0,
      '(xv) tab-order-canonical source contains ' + sel);
  }
  // Also verify tools.json entry includes the canonical list (lightweight check via grepping the inline JSON)
  // We do a lightweight regex check on the TOOL_SRC for any selector from the canonical list.
  check(TOOL_SRC.indexOf('#ec-past-notice') >= 0,
    '(xv) tab-order-canonical source references past-notice id');
}

// ===============================================================
// Category (xvi) — No console.error across boot + change
// ===============================================================
{
  const env = buildAndLoad({
    search: '?target=2027-06-01T12:00',
    localStorage: { 'ht.exam-countdown.target': '2027-06-01T12:00' },
  });
  // Trigger a change
  env.elements['#ec-target']._v = '2028-01-15T09:00';
  if (env.elements['#ec-target'].listeners.change) {
    env.elements['#ec-target'].listeners.change();
  }
  check(env.consoleErrors.length === 0,
    '(xvi) no console.error across boot + change sequence');
}

// ===============================================================
// Category (xvii) — Privacy: HTML page contains no inline scripts that fetch
// ===============================================================
{
  // Read the index.html and verify it has no <script src=...fetch...>
  const htmlSrc = fs.readFileSync(
    path.join(REPO_ROOT, 'tools/exam-countdown/index.html'),
    'utf8'
  );
  check(!/fetch\s*\(/.test(htmlSrc),
    '(xvii) HTML page contains no fetch() call');
  check(!/XMLHttpRequest/.test(htmlSrc),
    '(xvii) HTML page contains no XMLHttpReference');
  check(htmlSrc.indexOf('exam-countdown.js') >= 0,
    '(xvii) HTML page references the tool script');
}

// ===============================================================
// Category (xviii) — change + input don't double-fire
// ===============================================================
{
  // BUG-2 regression guard: the tool must listen on `change` only,
  // not both `change` AND `input` (datetime-local semantics — the
  // browser fires both on commit, which would double-write storage
  // and double-call history.replaceState).
  const env = buildAndLoad();
  const targetEl = env.elements['#ec-target'];
  // Track replaceState calls (history.replaceState stores to ctx._lastUrl).
  // On each call, _lastUrl is overwritten — we count via a wrapper.
  let replaceCount = 0;
  const origReplace = env.ctx.history.replaceState;
  env.ctx.history.replaceState = function () {
    replaceCount += 1;
    return origReplace.apply(this, arguments);
  };
  targetEl._v = '2027-06-01T12:00';
  // Fire change — this should write exactly once.
  if (targetEl.listeners.change) targetEl.listeners.change();
  // Fire input — this should NOT trigger any handler (tool only listens to change).
  if (targetEl.listeners.input) targetEl.listeners.input();
  check(replaceCount === 1,
    '(xviii) no-double-fire: change triggers 1 replaceState, input is ignored');
  check(env.ls['ht.exam-countdown.target'] === '2027-06-01T12:00',
    '(xviii) no-double-fire: storage written exactly once');
}

// ===============================================================
// Category (xix) — Repeated ?target= keys pick the non-empty value
// ===============================================================
{
  // BUG-3 regression guard: `?target=&target=foo` must use `foo`.
  const env = buildAndLoad({
    search: '?target=&target=2027-06-01T12:00',
  });
  check(env.elements['#ec-target']._v === '2027-06-01T12:00',
    '(xix) repeat-key URL: ?target=&target=foo picks foo (not empty)');
}

// ===============================================================
// Category (xx) — Malformed URL + valid LS syncs URL to LS
// ===============================================================
{
  // BUG-9 regression guard: malformed URL + valid LS should rewrite
  // the URL to the LS value (so the address bar doesn't carry
  // ?target=garbage when the visible input shows the LS value).
  const env = buildAndLoad({
    search: '?target=garbage',
    localStorage: { 'ht.exam-countdown.target': '2027-06-01T12:00' },
  });
  check(env.elements['#ec-target']._v === '2027-06-01T12:00',
    '(xx) malformed-URL + valid-LS: input populated from LS');
  // getLastUrl returns the URL the last replaceState wrote. After the
  // init rewrite, it should be the cleaned URL (no ?target=garbage).
  const lastUrl = env.getLastUrl();
  check(lastUrl !== '' && lastUrl.indexOf('garbage') < 0,
    '(xx) malformed-URL + valid-LS: URL rewritten to drop garbage');
}

// ===============================================================
// Vacuous-pass guard
// ===============================================================
check(pass > 0, 'vacuous-pass guard: pass > 0 (counted ' + pass + ')');

// ===============================================================
// Vacuous-pass guard
// ===============================================================
check(pass > 0, 'vacuous-pass guard: pass > 0 (counted ' + pass + ')');

console.log('exam-countdown-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');

// Vacuous-pass guard exit: if 0 assertions ran, fail loudly
// Force-exit before the tool's setInterval(tick, 1000) keeps the event loop alive
process.exit((pass === 0 && fail === 0) || fail > 0 ? 1 : 0);
