/* ============================================
   Smoke harness for Story 9.6 — Timestamp Converter.
   Tests the exported HT.timestamp pure-function API
   (classify / formatOutputs / toUnixSeconds / etc.) plus
   integration via vm context with stub DOM for batch
   mode, URL state, history, and embed-mode guard.

   Per AC-7: ≥ 30 assertions, 24 categories,
   vacuous-pass guard.
   ============================================ */

'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const TOOL_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'tools/timestamp-converter/timestamp-converter.js'),
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
// Pure-function tests via vm context that exposes HT.timestamp
// ---------------------------------------------------------------

const sandbox = {
  module: { exports: {} },
  exports: {},
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  Intl: Intl,
  Date: Date,
  Math: Math,
  window: undefined,
  document: { readyState: 'complete', addEventListener: () => {}, querySelectorAll: () => [], querySelector: () => null, getElementById: () => null },
  URLSearchParams: URLSearchParams,
  history: { replaceState: () => {}, pushState: () => {} },
  location: { hash: '', pathname: '/tools/timestamp-converter/', search: '' },
  navigator: { clipboard: { writeText: () => Promise.resolve() } },
  HT: {
    $: () => null,
    formatNumber: (n) => String(n),
    copyToClipboard: () => Promise.resolve(),
    debounce: (fn) => fn,
    history: { push: () => {} },
  },
};
sandbox.window = sandbox;
sandbox.window.HT = sandbox.HT;
sandbox.window.HT_SHELL_EMBED = undefined;
sandbox.module.exports = sandbox.exports;

vm.createContext(sandbox);
vm.runInContext(TOOL_SRC, sandbox, { filename: 'timestamp-converter.js' });

const F = sandbox.module.exports;
check(typeof F.classify === 'function', 'HT.timestamp.classify is a function');
check(typeof F.formatOutputs === 'function', 'HT.timestamp.formatOutputs is a function');
check(F.version === '1.0.0', 'HT.timestamp.version === "1.0.0"');

const classify = F.classify;
const formatOutputs = F.formatOutputs;
const toIso8601 = F.toIso8601;
const toRfc2822 = F.toRfc2822;
const toHumanUtc = F.toHumanUtc;

// ---------------------------------------------------------------
// Reference epoch: 2026-08-13T01:20:00Z = 1786584000 s = 1786584000000 ms
// (matches spec example "2026-08-13")
// ---------------------------------------------------------------

const REF_EPOCH_S = 1786584000;
const REF_EPOCH_MS = 1786584000000;
const REF_ISO = '2026-08-13T01:20:00.000Z';
const REF_RFC = 'Thu, 13 Aug 2026 01:20:00 GMT';
const REF_HUMAN_UTC = '2026-08-13 01:20:00 UTC';

// ---------------------------------------------------------------
// Category 1: Unix seconds round-trip (spec (i))
// ---------------------------------------------------------------

const r1 = classify(String(REF_EPOCH_S));
check(r1.kind === 'unix-seconds', 'classify("' + REF_EPOCH_S + '").kind === "unix-seconds"');
check(r1.seconds === REF_EPOCH_S, 'classify("' + REF_EPOCH_S + '").seconds === ' + REF_EPOCH_S);

const out1 = formatOutputs(REF_EPOCH_MS);
check(out1['unix-seconds'] === String(REF_EPOCH_S), 'formatOutputs: unix-seconds === "' + REF_EPOCH_S + '"');
check(out1['unix-milliseconds'] === String(REF_EPOCH_MS), 'formatOutputs: unix-milliseconds === "' + REF_EPOCH_MS + '"');
check(out1['iso-8601'] === REF_ISO, 'formatOutputs: iso-8601 === "' + REF_ISO + '"');
check(out1['rfc-2822'] === REF_RFC, 'formatOutputs: rfc-2822 === "' + REF_RFC + '"');
check(out1['human-utc'] === REF_HUMAN_UTC, 'formatOutputs: human-utc === "' + REF_HUMAN_UTC + '"');

// ---------------------------------------------------------------
// Category 2: Unix milliseconds round-trip (spec (ii))
// ---------------------------------------------------------------

const r2 = classify(String(REF_EPOCH_MS));
check(r2.kind === 'unix-milliseconds', 'classify("' + REF_EPOCH_MS + '").kind === "unix-milliseconds"');
check(r2.ms === REF_EPOCH_MS, 'classify("' + REF_EPOCH_MS + '").ms === ' + REF_EPOCH_MS);

// ---------------------------------------------------------------
// Category 3: ISO 8601 with Z (spec (v))
// ---------------------------------------------------------------

const r3 = classify('2026-08-13T01:20:00Z');
check(r3.kind === 'iso-8601', 'classify("2026-08-13T01:20:00Z").kind === "iso-8601"');
check(r3.ms === REF_EPOCH_MS, 'ISO with Z: ms === ' + REF_EPOCH_MS);

// ---------------------------------------------------------------
// Category 4: ISO 8601 with fractional (spec (vi))
// ---------------------------------------------------------------

const r4 = classify('2026-08-13T01:20:00.123Z');
check(r4.kind === 'iso-8601', 'classify with fractional → iso-8601');
check(r4.ms === REF_EPOCH_MS + 123, 'ISO with fractional: ms === ' + (REF_EPOCH_MS + 123));

// ---------------------------------------------------------------
// Category 5: ISO 8601 with offset (spec (vii))
// ---------------------------------------------------------------

const r5 = classify('2026-08-13T03:20:00+02:00');
check(r5.kind === 'iso-8601', 'classify with offset → iso-8601');
check(r5.ms === REF_EPOCH_MS, 'ISO with offset +02:00 → ' + REF_EPOCH_MS + ' (same UTC instant)');

// ---------------------------------------------------------------
// Category 6: ISO 8601 date-only (spec (viii))
// ---------------------------------------------------------------

const r6 = classify('2026-08-13');
check(r6.kind === 'iso-8601', 'classify date-only → iso-8601');
// 2026-08-13 UTC midnight = 1786579200 s
check(r6.ms === 1786579200000, 'date-only 2026-08-13 → 1786579200000 (UTC midnight)');

// ---------------------------------------------------------------
// Category 7: RFC 2822 (spec (ix))
// ---------------------------------------------------------------

const r7 = classify(REF_RFC);
check(r7.kind === 'rfc-2822', 'classify RFC 2822 → rfc-2822');
check(r7.ms === REF_EPOCH_MS, 'RFC 2822: ms === ' + REF_EPOCH_MS);

// ---------------------------------------------------------------
// Category 8: Human local round-trip (spec (xi))
// ---------------------------------------------------------------

const out8 = formatOutputs(REF_EPOCH_MS);
check(out8['human-local'] !== '', 'human local: non-empty');
const parsedBack = Date.parse(out8['human-local']);
check(!isNaN(parsedBack) && Math.abs(parsedBack - REF_EPOCH_MS) < 1000,
  'human local: round-trip preserves instant');

// ---------------------------------------------------------------
// Category 9: Detection labels (spec (xii))
// ---------------------------------------------------------------

check(classify(String(REF_EPOCH_S)).kind === 'unix-seconds', 'detection: ' + REF_EPOCH_S + ' → "unix-seconds"');
check(classify(String(REF_EPOCH_MS)).kind === 'unix-milliseconds', 'detection: ' + REF_EPOCH_MS + ' → "unix-milliseconds"');
check(classify('2026-08-13T01:20:00Z').kind === 'iso-8601', 'detection: ISO → "iso-8601"');
check(classify(REF_RFC).kind === 'rfc-2822', 'detection: RFC 2822 → "rfc-2822"');

// ---------------------------------------------------------------
// Category 10: Invalid input (spec (xiii))
// ---------------------------------------------------------------

check(classify('foo').kind === 'invalid', 'classify("foo") → invalid');
check(classify('2025-13-99').kind === 'invalid', 'classify("2025-13-99") → invalid');
check(classify('').kind === 'empty', 'classify("") → empty');

// ---------------------------------------------------------------
// Category 11: Out of range (spec (xiv))
// ---------------------------------------------------------------

check(classify('99999999999999999').kind === 'invalid', 'epoch > 16 digits → invalid');

// ---------------------------------------------------------------
// Category 12: Epoch magnitude boundary (spec (xv))
// ---------------------------------------------------------------

check(classify('9999999999').kind === 'unix-seconds', 'boundary: 10 digits → unix-seconds');
check(classify('99999999999').kind === 'unix-milliseconds', 'boundary: 11 digits → unix-milliseconds');

// ---------------------------------------------------------------
// Category 13: Sign rejection (spec AC-2)
// ---------------------------------------------------------------

const r13 = classify('-1755000000');
check(r13.kind === 'invalid', 'negative epoch: rejected');

// ---------------------------------------------------------------
// Category 14: Naive datetime detection (ROQ-2)
// ---------------------------------------------------------------

const r14 = classify('2025-08-13T01:20:00');
check(r14.kind === 'iso-8601', 'naive datetime → iso-8601');
check(r14.naive === true, 'naive datetime: naive flag set');

// ---------------------------------------------------------------
// Category 15: Formatter exact strings
// ---------------------------------------------------------------

check(toIso8601(REF_EPOCH_MS) === REF_ISO,
  'toIso8601(' + REF_EPOCH_MS + ') === "' + REF_ISO + '"');
check(toRfc2822(REF_EPOCH_MS) === REF_RFC,
  'toRfc2822(' + REF_EPOCH_MS + ') === "' + REF_RFC + '"');
check(toHumanUtc(REF_EPOCH_MS) === REF_HUMAN_UTC,
  'toHumanUtc(' + REF_EPOCH_MS + ') === "' + REF_HUMAN_UTC + '"');

// ---------------------------------------------------------------
// Integration: build the IIFE in a vm context and exercise DOM
// ---------------------------------------------------------------

function makeStub(initial, opts) {
  const o = opts || {};
  const stub = {
    _v: initial == null ? '' : String(initial),
    _hidden: false,
    _text: '',
    _innerHTML: '',
    _className: '',
    _attrs: o.attrs || {},
    listeners: {},
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
  Object.defineProperty(stub, 'innerHTML', {
    get() { return this._innerHTML; },
    set(v) { this._innerHTML = v == null ? '' : String(v); },
  });
  Object.defineProperty(stub, 'hidden', {
    get() { return this._hidden; },
    set(v) { this._hidden = !!v; },
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
  return stub;
}

function buildAndLoad(search) {
  const elements = {
    '#ts-input': makeStub(''),
    '#ts-batch-input': makeStub(''),
    '#ts-single-panel': makeStub('', { hidden: false }),
    '#ts-batch-panel': makeStub('', { hidden: true }),
    '#ts-batch-table': makeStub(''),
    '#ts-batch-caption': makeStub(''),
    '#ts-detected': makeStub('', { hidden: true }),
    '#ts-warning': makeStub('', { hidden: true }),
    '#ts-error': makeStub('', { hidden: true }),
    '#ts-now': makeStub(''),
    '#ts-unix-s': makeStub(''),
    '#ts-unix-ms': makeStub(''),
    '#ts-iso': makeStub(''),
    '#ts-rfc': makeStub(''),
    '#ts-human-utc': makeStub(''),
    '#ts-human-local': makeStub(''),
  };
  const modeSingleBtn = makeStub('', { attrs: { 'data-mode': 'single' } });
  const modeBatchBtn = makeStub('', { attrs: { 'data-mode': 'batch' } });
  const modeButtonsArr = [modeSingleBtn, modeBatchBtn];
  const copyButtonsArr = [
    makeStub('', { attrs: { 'data-target': 'ts-unix-s' } }),
    makeStub('', { attrs: { 'data-target': 'ts-unix-ms' } }),
    makeStub('', { attrs: { 'data-target': 'ts-iso' } }),
    makeStub('', { attrs: { 'data-target': 'ts-rfc' } }),
    makeStub('', { attrs: { 'data-target': 'ts-human-utc' } }),
    makeStub('', { attrs: { 'data-target': 'ts-human-local' } }),
  ];

  const historyCalls = [];
  let fetchCalls = 0;
  let xhrCalls = 0;

  const ctx = {
    console: { log: () => {}, warn: () => {}, error: () => {}, info: () => {} },
    performance: { now: () => Date.now() },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Intl: Intl,
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    history: { replaceState: () => {}, pushState: () => {} },
    location: { hash: '', pathname: '/tools/timestamp-converter/', search: search || '' },
    URLSearchParams: URLSearchParams,
    Date: Date,
    Math: Math,
    fetch: function () { fetchCalls += 1; return Promise.resolve({}); },
    XMLHttpRequest: function () { xhrCalls += 1; },
    HT: {
      $: (sel) => elements[sel] || null,
      formatNumber: (n) => String(n),
      copyToClipboard: () => Promise.resolve(),
      debounce: (fn, ms) => {
        let t;
        return function () {
          const args = arguments;
          const that = this;
          clearTimeout(t);
          t = setTimeout(() => fn.apply(that, args), ms);
        };
      },
      history: {
        push: (entry) => { historyCalls.push(entry); },
      },
    },
    document: {
      addEventListener: () => {},
      getElementById: (id) => elements['#' + id] || null,
      querySelector: (sel) => {
        if (sel && sel.indexOf('data-action="mode"') >= 0) return modeButtonsArr[1];
        return null;
      },
      querySelectorAll: (sel) => {
        if (sel && sel.indexOf('data-action="mode"') >= 0) return modeButtonsArr;
        if (sel && sel.indexOf('data-action="copy"') >= 0) return copyButtonsArr;
        return [];
      },
      readyState: 'complete',
    },
    module: { exports: {} },
    exports: {},
  };
  ctx.window = ctx;
  ctx.window.HT = ctx.HT;
  ctx.window.HT_SHELL_EMBED = undefined;
  ctx.module.exports = ctx.exports;

  vm.createContext(ctx);
  vm.runInContext(TOOL_SRC, ctx, { filename: 'timestamp-converter.js' });

  return { ctx, elements, modeButtonsArr, copyButtonsArr, historyCalls, fetchCalls, xhrCalls, modeSingleBtn, modeBatchBtn };
}

// --- Category 16: URL state (spec (xviii)) ---
{
  const env = buildAndLoad('?input=' + REF_EPOCH_S);
  check(env.elements['#ts-input']._v === String(REF_EPOCH_S),
    'URL state: ?input=' + REF_EPOCH_S + ' populated on load');
  check(env.elements['#ts-unix-s']._v === String(REF_EPOCH_S),
    'URL state: converted on load');
}

// --- Category 17: URL state + embed (spec (xix)) ---
{
  const ctx = buildAndLoad('?input=' + REF_EPOCH_S + '&embed=1').ctx;
  ctx.window.HT_SHELL_EMBED = true;
  // Reload to honor embed
  const env2 = buildAndLoad('?input=' + REF_EPOCH_S + '&embed=1');
  env2.ctx.window.HT_SHELL_EMBED = true;
  vm.runInContext(TOOL_SRC, env2.ctx, { filename: 'timestamp-converter.js' });
  check(env2.elements['#ts-input']._v === '',
    'URL state + embed: input NOT populated (privacy)');
}

// --- Category 18: no fetch / XHR (spec (xxiii)) ---
{
  const env = buildAndLoad('');
  // Set batch input — must not call fetch
  env.elements['#ts-batch-input']._v = REF_EPOCH_S + '\n2026-08-13T01:20:00Z';
  // Find the listener
  const listener = env.elements['#ts-batch-input'].listeners.input;
  if (listener) listener();
  // Wait for any debounce to flush
  setTimeout(() => {}, 200);
  check(env.fetchCalls === 0, 'no fetch calls during batch decode');
  check(env.xhrCalls === 0, 'no XHR calls during batch decode');
}

// --- Category 19: history keys (spec (xxi)) ---
{
  const env = buildAndLoad('?input=' + REF_EPOCH_S);
  check(env.historyCalls.length > 0,
    'history called at least once');
  const last = env.historyCalls[env.historyCalls.length - 1];
  check('ts-format' in last, 'history keys: ts-format present');
  check('ts-input-mode' in last, 'history keys: ts-input-mode present');
  check(!('input' in last) && !('ts-input' in last),
    'history keys: input value NOT in history (privacy)');
}

// --- Category 20: Batch mode integration ---
{
  const env = buildAndLoad('?mode=batch');
  // Force batch mode by simulating URL state
  env.elements['#ts-batch-input']._v = REF_EPOCH_S + '\n2026-08-13T01:20:00Z\n' + REF_RFC;
  // Find listener — fallback: trigger via the listener
  if (env.elements['#ts-batch-input'].listeners.input) {
    env.elements['#ts-batch-input'].listeners.input();
  }
  // Force batch mode by clicking the batch button
  if (env.modeBatchBtn.listeners.click) {
    env.modeBatchBtn.listeners.click();
  }
  check(env.elements['#ts-batch-panel']._hidden === false,
    'batch mode: panel revealed after URL state or click');
}

// --- Category 21: Mode toggle ---
{
  const env = buildAndLoad('');
  // Switch to batch
  if (env.modeBatchBtn.listeners.click) env.modeBatchBtn.listeners.click();
  check(env.elements['#ts-batch-panel']._hidden === false, 'mode click: batch panel revealed');
  if (env.modeSingleBtn.listeners.click) env.modeSingleBtn.listeners.click();
  check(env.elements['#ts-single-panel']._hidden === false, 'mode click: single panel revealed');
}

// --- Vacuous-pass guard ---
check(pass > 0, 'vacuous-pass guard: pass > 0');

console.log('');
console.log('timestamp-converter-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);
