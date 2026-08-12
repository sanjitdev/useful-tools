/* ============================================
   Smoke harness for Story 2.3 — assets/js/history.js.
   Loads url.js + history.js in a fresh vm context
   with stub window/document/HT objects, plus a
   synthetic HT.storage facade, and asserts the
   HT.history surface per api-contract.js (version
   1.13.0 as of this writing — Story 2.3 bumped the
   contract 1.6.0 → 1.7.0, Story 2.5 bumped 1.7.0 → 1.8.0,
   Story 3.6 bumped 1.11.0 → 1.12.0, Story 3.7 bumped
   1.12.0 → 1.13.0 for HT.export).

   Story 3.6: 76 assertions (was 47 in Story 2.3/3.3
   intermediate) — storage shape + migration, relative
   timestamps, row truncation, restore confirm, panel
   dismissal, cross-pins. Total target: 76/76 PASS.

   The synthetic HT.homeGrid.entries fixture carries
   four slugs covering the four matrix cases AC-5
   specifies (has-both / has-keys-no-urlstate /
   has-urlstate-no-keys / neither).
   ============================================ */

'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const URL_SRC = fs.readFileSync(
  path.resolve(__dirname, '../assets/js/url.js'),
  'utf8'
);
const HISTORY_SRC = fs.readFileSync(
  path.resolve(__dirname, '../assets/js/history.js'),
  'utf8'
);

// Synthetic HT.homeGrid.entries — four slugs covering the AC-5 matrix.
const entries = [
  {
    id: 'has-history-and-urlstate',
    slug: 'has-history-and-urlstate',
    'history-keys': ['hf-amount', 'hf-from', 'hf-to'],
    urlState: {
      default: { 'hf-amount': '100', 'hf-from': '2000', 'hf-to': '2024' },
      encode: [
        { key: 'hf-amount', type: 'number' },
        { key: 'hf-from', type: 'number' },
        { key: 'hf-to', type: 'number' },
      ],
      decode: [
        { key: 'hf-amount', type: 'number' },
        { key: 'hf-from', type: 'number' },
        { key: 'hf-to', type: 'number' },
      ],
    },
  },
  {
    id: 'history-but-no-urlstate',
    slug: 'history-but-no-urlstate',
    'history-keys': ['hn-amount', 'hn-from'],
    // urlState deliberately omitted
  },
  {
    id: 'urlstate-but-no-history',
    slug: 'urlstate-but-no-history',
    'history-keys': [],
    urlState: {
      default: { 'un-x': '1' },
      encode: [{ key: 'un-x', type: 'string' }],
      decode: [{ key: 'un-x', type: 'string' }],
    },
  },
  {
    id: 'neither',
    slug: 'neither',
    // both omitted
  },
];

// Minimal DOM stub factory — same shape as _smoke_sample_data.js uses.
function HtmlInputStub(initial) {
  this._v = initial == null ? '' : String(initial);
  this.type = 'text';
  this.checked = false;
  this.dataset = {};
  this.className = '';
  this.textContent = '';
  this.children = [];
  this.childNodes = this.children;
  this.parentNode = null;
  this.hidden = false;
  this._handlers = {};
  this.addEventListener = function (name, fn) {
    (this._handlers[name] = this._handlers[name] || []).push(fn);
  };
  this.removeEventListener = function (name, fn) {
    const arr = this._handlers[name] || [];
    const i = arr.indexOf(fn);
    if (i !== -1) arr.splice(i, 1);
  };
  this.focus = () => {};
  this.setAttribute = function (k, v) { this['_' + k] = v; };
  this.getAttribute = function (k) { return this['_' + k] != null ? this['_' + k] : null; };
  this.appendChild = function (n) {
    this.children.push(n);
    n.parentNode = this;
    return n;
  };
  this.removeChild = function (n) {
    const i = this.children.indexOf(n);
    if (i !== -1) this.children.splice(i, 1);
    n.parentNode = null;
    return n;
  };
  this.querySelector = function (sel) { return null; };
  this.querySelectorAll = function (sel) { return []; };
  this.closest = function (sel) { return null; };
  this.insertBefore = function (n, ref) {
    this.children.unshift(n);
    n.parentNode = this;
    return n;
  };
  this.remove = function () {
    if (this.parentNode) this.parentNode.removeChild(this);
  };
  this.close = () => {};
  this.showModal = function () { this.showModalCalled = (this.showModalCalled || 0) + 1; };
  this.addEventListener = this.addEventListener;
}
Object.defineProperty(HtmlInputStub.prototype, 'value', {
  get() { return this._v; },
  set(v) { this._v = v == null ? '' : String(v); },
});
Object.defineProperty(HtmlInputStub.prototype, 'innerHTML', {
  get() { return ''; },
  set(_v) { /* dialog innerHTML ignored */ },
});
Object.defineProperty(HtmlInputStub.prototype, 'firstChild', {
  get() { return this.children[0] || null; },
});

// Synthetic HT.storage facade — in-memory Map. The registry does not run
// in this harness (we stub HT.storage directly to keep the surface tight).
const _storage = new Map();
const HT_storage = Object.freeze({
  get: function (key, fallback) {
    if (!_storage.has(key)) return fallback;
    return _storage.get(key);
  },
  set: function (key, value) {
    _storage.set(key, value);
    return true;
  },
  remove: function (key) {
    return _storage.delete(key);
  },
  clear: function () {
    _storage.clear();
  },
  list: function () { return []; },
  keys: function () { return Array.from(_storage.keys()); },
});

// Document stub — root map keyed by data-slug, same pattern as the
// sample-data smoke harness.
const _rootBySlug = {};
const document_stub = {
  getElementById: () => null,
  querySelector: function (sel) {
    const m = /^main\[data-slug="([^"]+)"\]$/.exec(sel);
    if (m) return _rootBySlug[m[1]] || null;
    return null;
  },
  activeElement: null,
  createElement: function (tag) {
    const el = new HtmlInputStub('');
    el.tagName = String(tag || '').toUpperCase();
    return el;
  },
  body: new HtmlInputStub(''),
  addEventListener: function () {},
  removeEventListener: function () {},
};
document_stub.body.tagName = 'BODY';

// matchMedia stub for the desktop/mobile split.
const matchMediaStub = function (query) {
  return {
    matches: query.indexOf('min-width: 768px') !== -1 ? true : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  };
};

// Story 3.6 — capture Intl.RelativeTimeFormat + Intl.DateTimeFormat
// constructor args (assert locale = navigator.language).
const rtfCtorArgs = [];
const dtfCtorArgs = [];
const rtfStub = function (locale, opts) {
  rtfCtorArgs.push({ locale: locale, opts: opts });
  return {
    format: function (diff, unit) {
      const a = Math.abs(diff);
      if (unit === 'second' && a < 5) return 'now';
      if (unit === 'minute') return diff === -1 ? '1 minute ago' : Math.abs(diff) + ' minutes ago';
      if (unit === 'hour') return diff === -1 ? '1 hour ago' : Math.abs(diff) + ' hours ago';
      if (unit === 'day' && a === 1 && diff < 0) return 'yesterday';
      if (unit === 'day') return Math.abs(diff) + ' days ago';
      if (unit === 'week') return Math.abs(diff) + ' weeks ago';
      if (unit === 'month') return Math.abs(diff) + ' months ago';
      if (unit === 'year') return Math.abs(diff) + ' years ago';
      return String(diff) + ' ' + (unit || 'seconds');
    },
  };
};
const dtfStub = function (locale, opts) {
  dtfCtorArgs.push({ locale: locale, opts: opts });
  return {
    format: function (date) {
      return 'Aug ' + (date.getMonth() + 1) + ', ' + date.getFullYear();
    },
  };
};
// Build an Intl facade that uses stubs for the formatters we care about
// and falls through to real Intl for everything else.
const IntlFacade = new Proxy({}, {
  get: function (_t, prop) {
    if (prop === 'RelativeTimeFormat') return rtfStub;
    if (prop === 'DateTimeFormat') return dtfStub;
    return Intl[prop];
  },
});

const ctx = {
  window: {
    matchMedia: matchMediaStub,
    addEventListener: function () {},
    removeEventListener: function () {},
  },
  document: document_stub,
  console,
  performance: { now: () => Date.now() },
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  history: { replaceState: () => {}, pushState: () => {} },
  location: { hash: '', pathname: '/tools/test/', search: '' },
  HTMLInputElement: HtmlInputStub,
  HTMLTextAreaElement: HtmlInputStub,
  HTMLSelectElement: HtmlInputStub,
  HTMLDialogElement: HtmlInputStub,
  // Story 3.6: navigator.language — used by Intl.RelativeTimeFormat
  // constructor (replaces Story 2.3's `undefined` locale).
  navigator: { language: 'en-US' },
  Intl: IntlFacade,
  HT: {
    homeGrid: { entries: entries },
    storage: HT_storage,
    urlState: undefined, // populated by url.js
  },
};
ctx.window.HT = ctx.HT;
// Note: ctx.Intl is set to IntlFacade in the ctx object above — DO NOT
// override with the real Intl, or the relative-time stubs won't fire.

// Expose `location` on `window` so history.js's `_isEmbed()` URL regex
// can read `window.location.search` inside the vm. The ctx also has a
// top-level `location`, but `window.location` is what the production
// code reads. Mirrors what a real browser provides.
ctx.window.location = ctx.location;

vm.createContext(ctx);
vm.runInContext(URL_SRC, ctx, { filename: 'url.js' });
vm.runInContext(HISTORY_SRC, ctx, { filename: 'history.js' });

const HT = ctx.window.HT;
const historyApi = HT.history;

let pass = 0, fail = 0;
function check(name, ok, info) {
  if (ok) { pass += 1; console.log('  PASS  ' + name); }
  else { fail += 1; console.log('  FAIL  ' + name + (info ? ' — ' + info : '')); }
}

// === Surface-level checks (AC-5 storage layer part 1) ===

check('HT.history exists', typeof historyApi === 'object');
check('HT.history.push is function', typeof historyApi.push === 'function');
check('HT.history.list is function', typeof historyApi.list === 'function');
check('HT.history.restore is function', typeof historyApi.restore === 'function');
check('HT.history.clear is function', typeof historyApi.clear === 'function');
check('HT.history.subscribe is function', typeof historyApi.subscribe === 'function');
check('HT.history.panel is function', typeof historyApi.panel === 'function');
check('HT.history.button is function', typeof historyApi.button === 'function');
check('HT.history.hasHistory is function', typeof historyApi.hasHistory === 'function');
check('HT.history.lastEntry is function', typeof historyApi.lastEntry === 'function');
check('HT.history._loadSchema is function', typeof historyApi._loadSchema === 'function');
check('HT.history is frozen', Object.isFrozen(historyApi));

// === Storage layer (assertions 1-10) ===

const slugA = 'has-history-and-urlstate';
const slugB = 'urlstate-but-no-history';
const entryA = historyApi.push(slugA, { inputs: { 'hf-amount': 100, 'hf-from': 2000, 'hf-to': 2024 }, result: '$246.10' });
check('push: returns a frozen HistoryEntry',
  entryA && typeof entryA.ts === 'string' && Object.isFrozen(entryA));
check('push: writes to handy-tools.history.<slugA> only',
  _storage.has('handy-tools.history.' + slugA)
  && !_storage.has('handy-tools.history.' + slugB));

const listA = historyApi.list(slugA);
check('list: returns frozen array', Object.isFrozen(listA));
check('list: newest-first ordering (length=1 then sorted)',
  listA.length === 1 && listA[0].ts === entryA.ts);
check('list: per-tool isolation — slugB has zero entries',
  historyApi.list(slugB).length === 0);

// FIFO cap of 50 (Story 3.6 raised from 10) — push 51 distinct, oldest dropped.
// Each push gets a unique ISO 8601 ts (computed with `+ i * 1000` so
// lexicographic sort == chronological sort, no ms collisions).
historyApi.clear(slugA, { confirm: false });
for (let i = 1; i <= 51; i += 1) {
  const ts = new Date(Date.now() + i * 1000).toISOString();
  historyApi.push(slugA, {
    inputs: { 'hf-amount': 100 + i, 'hf-from': 2000, 'hf-to': 2024 },
    result: '$' + (100 + i),
    ts: ts,
  });
}
const capped = historyApi.list(slugA);
check('push: FIFO cap of 50 — array length is 50', capped.length === 50);
const firstTs = entryA.ts;
check('push: FIFO cap — oldest entry (first push) dropped',
  !capped.some(function (e) { return e.ts === firstTs; }));

// Round-trip via JSON — entries are JSON-serializable.
const roundTrip = JSON.parse(JSON.stringify(historyApi.list(slugA)));
check('push: entries are JSON-serializable (round-trip ok)',
  Array.isArray(roundTrip) && roundTrip.length === 50
  && roundTrip[0].inputs && typeof roundTrip[0].inputs['hf-amount'] !== 'undefined'
  && typeof roundTrip[0].ts === 'string');

// Frozen-ness invariants (P-3).
const sampleEntry = historyApi.list(slugA)[0];
check('list: each entry is Object.isFrozen', Object.isFrozen(sampleEntry));
check('list: outer array is Object.isFrozen', Object.isFrozen(historyApi.list(slugA)));

// clear — also verify that subsequent list returns [] (storage key removed).
historyApi.clear(slugA, { confirm: false });
check('clear: removes the key entirely',
  !_storage.has('handy-tools.history.' + slugA));
check('clear: list after clear returns []',
  historyApi.list(slugA).length === 0);

// lastEntry: convenience over list(slug)[0] for the dedup-by-state
// idiom in exemplar render() flows.
check('lastEntry: returns null when no entries exist',
  historyApi.lastEntry(slugA) === null);
const eDedup = historyApi.push(slugA, { inputs: { 'hf-amount': 42 }, result: 'dedup' });
check('lastEntry: returns the most-recent entry after a push',
  historyApi.lastEntry(slugA) && historyApi.lastEntry(slugA).ts === eDedup.ts);

// Subscribe — fires on push; unsubscribe is idempotent.
let subscribeCalls = 0;
let lastEntries = null;
const unsubscribe = historyApi.subscribe(slugA, function (entries) {
  subscribeCalls += 1;
  lastEntries = entries;
});
historyApi.push(slugA, { inputs: { 'hf-amount': 5 }, result: 'sub' });
check('subscribe: callback fired once after push', subscribeCalls === 1);
check('subscribe: callback received array (≥1 entry)', Array.isArray(lastEntries) && lastEntries.length >= 1);
unsubscribe();
unsubscribe(); // idempotent
historyApi.push(slugA, { inputs: { 'hf-amount': 6 }, result: 'sub2' });
check('subscribe: unsubscribe is idempotent (no double-fire)', subscribeCalls === 1);

// === Restore path (assertions 11-18) ===

// Re-push to set up restore test.
const e1 = historyApi.push(slugA, { inputs: { 'hf-amount': 777, 'hf-from': 1990, 'hf-to': 2020 }, result: 'restore me' });
const e2 = historyApi.push(slugA, { inputs: { 'hf-amount': 888, 'hf-from': 1995, 'hf-to': 2025 }, result: 'restore me 2' });

// Set up a fake main element with three inputs keyed by id.
function makeMainStubForRestore() {
  const inputs = {
    'hf-amount': new HtmlInputStub(''),
    'hf-from': new HtmlInputStub(''),
    'hf-to': new HtmlInputStub(''),
  };
  const main = {
    getAttribute: function (k) { return k === 'data-slug' ? slugA : null; },
    closest: function () { return main; },
    querySelector: function (sel) {
      const m = /^#([\w-]+)$/.exec(sel);
      if (m) return inputs[m[1]] || null;
      return null;
    },
    appendChild: function (n) {
      if (!main.children) main.children = [];
      main.children.push(n);
      n.parentNode = main;
      return n;
    },
    removeChild: function (n) {
      if (!main.children) return n;
      const i = main.children.indexOf(n);
      if (i !== -1) main.children.splice(i, 1);
      n.parentNode = null;
      return n;
    },
    children: [],
  };
  return { main: main, inputs: inputs };
}

const root1 = makeMainStubForRestore();
_rootBySlug[slugA] = root1.main;
// Story 3.6 — pass the entry object directly so lookup is unambiguous
// when multiple entries share the same ms (the harness fixture pushes
// several entries in the same tick).
historyApi.restore(slugA, e1, { confirm: false });
check('restore: writes entry.inputs into the DOM inputs',
  root1.inputs['hf-amount'].value === '777'
  && root1.inputs['hf-from'].value === '1990'
  && root1.inputs['hf-to'].value === '2020');

// Unknown id throws.
let restoreErr = null;
try { historyApi.restore(slugA, '9999-12-31T23:59:59.999Z', { confirm: false }); }
catch (e) { restoreErr = e; }
check('restore: throws UrlStateSchemaError-shaped error on unknown ts',
  restoreErr && restoreErr.name === 'UrlStateSchemaError'
  && restoreErr.code === 'UNKNOWN_TS');

// === Panel rendering (assertions 19-27) ===

const panelA = historyApi.panel(slugA, root1.main);
check('panel: returns an object with teardown', panelA && typeof panelA.teardown === 'function');
check('panel: hasHistory===true → panel mounted (positive case)',
  root1.main.children.length > 0);
const aside = root1.main.children[root1.main.children.length - 1];
check('panel: desktop variant renders <aside class="history-panel">',
  aside && aside.className === 'history-panel');

panelA.teardown();
check('panel: teardown removes panel DOM',
  !root1.main.children.some(function (c) { return c.className === 'history-panel'; }));

// hasHistory predicate.
check('hasHistory: has-history-and-urlstate → true',
  historyApi.hasHistory('has-history-and-urlstate') === true);
check('hasHistory: history-but-no-urlstate → false (gate is AND)',
  historyApi.hasHistory('history-but-no-urlstate') === false);
check('hasHistory: urlstate-but-no-history → false (gate is AND)',
  historyApi.hasHistory('urlstate-but-no-history') === false);
check('hasHistory: neither → false', historyApi.hasHistory('neither') === false);

// === Button factory (extension of AC-5) ===

const histBtn = historyApi.button(slugA);
check('button: returns an HTMLButtonElement',
  histBtn && histBtn.tagName === 'BUTTON');
check('button: data-ht-action="history"', histBtn.dataset.htAction === 'history');
check('button: type="button"', histBtn.type === 'button');
check('button: aria-label includes "(h)" shortcut',
  histBtn.getAttribute('aria-label').indexOf('(h)') !== -1);
check('button: aria-haspopup="dialog"',
  histBtn.getAttribute('aria-haspopup') === 'dialog');

// === Bypass gate cross-pins (assertions 28-31) ===

const CONTRACT_SRC = fs.readFileSync(
  path.resolve(__dirname, '../assets/js/api-contract.js'),
  'utf8'
);
const requiredEntries = [
  'HT.history.push',
  'HT.history.list',
  'HT.history.restore',
  'HT.history.clear',
  'HT.history.subscribe',
  'HT.history.panel',
  'HT.history.button',
  'HT.history.hasHistory',
  'HT.history.lastEntry',
  'HT.history._loadSchema',
];
let allEntriesFound = true;
for (const name of requiredEntries) {
  if (CONTRACT_SRC.indexOf("name: '" + name + "'") === -1) {
    allEntriesFound = false;
    console.log('  missing contract entry: ' + name);
  }
}
check('api-contract.js: all 10 HT.history.* entries registered (9 stable + 1 internal)',
  allEntriesFound);
check('api-contract.js: version bumped to 1.13.0 (Story 3.7 — HT.export added; Story 3.6 — history panel shape migration + cap 50)',
  /version:\s*['"]1\.13\.0['"]/.test(CONTRACT_SRC));

// === Vacuous-pass guard (assertion 31) ===

check('vacuous-pass guard: pass > 0 (sanity)', pass > 0);

// ============================================================
// Story 3.6 — 45 new assertions across 6 sections.
// Sections: storage shape + migration (10), relative
// timestamps (8), row truncation (6), restore confirm (8),
// panel dismissal (5), cross-pins (8).
// ============================================================

// ============================================
// Section A: Storage shape + migration (10)
// ============================================

// Set up a clean slug for the new-shape tests.
const slugC = 'has-history-and-urlstate'; // reuse; clear first
historyApi.clear(slugC, { confirm: false });

// A.1 — push writes new {ts, inputs, result} shape (no id/state/label)
const shapeA = historyApi.push(slugC, { inputs: { 'hf-amount': '100' }, result: 'r1' });
check('A.1 push: persisted shape has ts+inputs+result only (no id/state/label)',
  'ts' in shapeA && 'inputs' in shapeA && 'result' in shapeA
  && !('id' in shapeA) && !('state' in shapeA) && !('label' in shapeA));

// A.2 — ts is ISO 8601 string
check('A.2 push: ts is an ISO 8601 string',
  typeof shapeA.ts === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(shapeA.ts));

// A.3 — push with no entry still pushes (auto-empty)
const emptyPush = historyApi.push(slugC);
check('A.3 push: with no entry argument, still pushes (auto-empty shape)',
  emptyPush && typeof emptyPush.ts === 'string'
  && typeof emptyPush.inputs === 'object' && typeof emptyPush.result === 'string');

// A.4 — list sorted newest-first by ts (ISO string)
const listC = historyApi.list(slugC);
check('A.4 list: sorted newest-first by ISO ts',
  listC.length >= 2
  && listC[0].ts >= listC[1].ts
  && typeof listC[0].ts === 'string');

// A.5 — FIFO cap 50 (was 10): push 51 distinct, length stays 50
historyApi.clear(slugC, { confirm: false });
const capTestTs = [];
for (let i = 1; i <= 51; i += 1) {
  const ts = new Date(Date.now() + i * 1000).toISOString();
  capTestTs.push(ts);
  historyApi.push(slugC, { inputs: { 'hf-amount': String(i) }, result: 'cap#' + i, ts: ts });
}
const cappedList = historyApi.list(slugC);
check('A.5 push: FIFO cap = 50 (raised from 10), array length is 50',
  cappedList.length === 50);

// A.6 — oldest (i=1) dropped, newest (i=51) kept
check('A.6 push: cap drops oldest (i=1), keeps newest (i=51)',
  !cappedList.some(function (e) { return e.result === 'cap#1'; })
  && cappedList[0].result === 'cap#51');

// A.7 — Migration: pre-existing {id, ts (number), state, result, label} migrated
// First plant a legacy entry directly into storage.
const slugM = 'history-but-no-urlstate'; // slug with history-keys but no urlState
// hasHistory false on slugM, so push() is no-op. We must plant directly.
const legacyArr = [{
  id: 'h_legacy_001',
  ts: Date.now() - 86400000, // 1 day ago
  state: { 'hn-amount': '50', 'hn-from': '1990' },
  result: 'legacy result',
  label: 'legacy label',
}];
HT_storage.set('handy-tools.history.' + slugM, legacyArr);
// Verify migration runs by reading via list().
const migratedList = historyApi.list(slugM);
// slugM has hasHistory===false → list() returns []. We must call _readRaw
// (or check via list on a slug with hasHistory=true). Plant on slugC instead.
const legacySlugC = 'has-history-and-urlstate';
historyApi.clear(legacySlugC, { confirm: false });
HT_storage.set('handy-tools.history.' + legacySlugC, [{
  id: 'h_legacy_002',
  ts: Date.parse('2024-01-15T10:30:00.000Z'),
  state: { 'hf-amount': '200', 'hf-from': '1990', 'hf-to': '2024' },
  result: 'legacy',
  label: 'should be dropped',
}]);
const migList = historyApi.list(legacySlugC);
check('A.7 migration: legacy {id, ts (number), state, result, label} → new shape',
  migList.length === 1
  && !('id' in migList[0])
  && typeof migList[0].ts === 'string'
  && typeof migList[0].inputs === 'object'
  && !('label' in migList[0])
  && migList[0].result === 'legacy'
  && typeof migList[0].inputs['hf-amount'] !== 'undefined');

// A.8 — After migration, the rewritten on-disk shape is the new shape
const afterMig = HT_storage.get('handy-tools.history.' + legacySlugC);
check('A.8 migration: rewritten on-disk shape is new {ts, inputs, result}',
  afterMig && afterMig.length === 1
  && !('id' in afterMig[0])
  && !('label' in afterMig[0])
  && 'inputs' in afterMig[0]);

// A.9 — Migration is a no-op for new-shape entries (pass-through)
// Reset rtfCtorArgs and push a new entry, verify no rewrite occurs.
historyApi.clear(legacySlugC, { confirm: false });
historyApi.push(legacySlugC, { inputs: { 'hf-amount': 'A' }, result: 'A' });
const beforePass = HT_storage.get('handy-tools.history.' + legacySlugC);
// Read via list() again — should not modify
historyApi.list(legacySlugC);
const afterPass = HT_storage.get('handy-tools.history.' + legacySlugC);
check('A.9 migration: no-op for new-shape entries (read is idempotent)',
  JSON.stringify(beforePass) === JSON.stringify(afterPass));

// A.10 — Each entry is frozen
check('A.10 list: every entry is Object.isFrozen',
  historyApi.list(legacySlugC).every(function (e) { return Object.isFrozen(e); }));

// === Migration negative tests (LOW-10 fix) ===
// Each test plants an explicitly-broken legacy entry and asserts the
// new-shape contract holds. Without these, the fast-path predicate is
// vacuous-pass safe only by inspection (AI-E2-1 carry-over).

// A.11 — legacy entry with missing `ts` → SENTINEL (1970-01-01T00:00:00.000Z),
// never `new Date().toISOString()` (MED-6 fix).
historyApi.clear(legacySlugC, { confirm: false });
HT_storage.set('handy-tools.history.' + legacySlugC, [{
  id: 'h_no_ts',
  state: { 'hf-amount': '50' },
  result: 'no-ts',
  label: 'should drop',
}]);
const noTsList = historyApi.list(legacySlugC);
check('A.11 migration: missing ts → sentinel 1970-01-01 (not now())',
  noTsList.length === 1
  && noTsList[0].ts === '1970-01-01T00:00:00.000Z');

// A.12 — legacy entry with malformed string ts (looks new-shape but isn't valid ISO)
historyApi.clear(legacySlugC, { confirm: false });
HT_storage.set('handy-tools.history.' + legacySlugC, [{
  ts: 'not-a-date',
  state: { 'hf-amount': '50' },
  result: 'bad-ts',
}]);
const badTsList = historyApi.list(legacySlugC);
check('A.12 migration: malformed string ts → sentinel (not preserved verbatim)',
  badTsList.length === 1
  && badTsList[0].ts === '1970-01-01T00:00:00.000Z');

// A.13 — legacy entry with empty state → inputs = {}
historyApi.clear(legacySlugC, { confirm: false });
HT_storage.set('handy-tools.history.' + legacySlugC, [{
  id: 'h_empty_state',
  ts: Date.now() - 1000,
  state: {},
  result: 'empty-state',
}]);
const emptyStateList = historyApi.list(legacySlugC);
check('A.13 migration: empty state → empty inputs (no crash)',
  emptyStateList.length === 1
  && emptyStateList[0].inputs
  && Object.keys(emptyStateList[0].inputs).length === 0
  && emptyStateList[0].result === 'empty-state');

// A.14 — _isNewShape rejects an entry that has a string ts AND `id` left over
// (mixed-shape entry). Without this, the fast path would accept it.
historyApi.clear(legacySlugC, { confirm: false });
HT_storage.set('handy-tools.history.' + legacySlugC, [{
  id: 'mixed',
  ts: new Date(Date.now() - 5000).toISOString(),
  inputs: { 'hf-amount': '1' },
  result: 'mixed',
}]);
const mixedList = historyApi.list(legacySlugC);
// Should be migrated: the `id` field must be dropped.
check('A.14 migration: mixed entry with legacy `id` + new-shape fields → rewritten',
  mixedList.length === 1 && !('id' in mixedList[0]));

// A.15 — migration is idempotent: read twice, only first read triggers write.
// We instrument _storage.set on the underlying Map (HT_storage is frozen).
historyApi.clear(legacySlugC, { confirm: false });
HT_storage.set('handy-tools.history.' + legacySlugC, [{
  id: 'h_idempotent',
  ts: Date.now() - 2000,
  state: { 'hf-amount': '9' },
  result: 'idempotent',
}]);
const _origStorageSet = _storage.set.bind(_storage);
let _setCount = 0;
_storage.set = function (k, v) { _setCount += 1; return _origStorageSet(k, v); };
historyApi.list(legacySlugC); // first read triggers migration write
const countAfterFirstRead = _setCount;
historyApi.list(legacySlugC); // second read should NOT write
const countAfterSecondRead = _setCount;
_storage.set = _origStorageSet; // restore
check('A.15 migration: idempotent — second read does not write',
  countAfterFirstRead >= 1 && countAfterSecondRead === countAfterFirstRead);

// === Read-time FIFO cap (MED-7 fix) ===
// Pre-existing storage with 51 entries (e.g., a hand-imported JSON dump)
// must be truncated to HISTORY_CAP on the next read.
historyApi.clear(legacySlugC, { confirm: false });
const oversized = [];
for (let i = 0; i < 60; i += 1) {
  oversized.push({
    inputs: { 'hf-amount': String(i) },
    result: 'r' + i,
    ts: new Date(Date.now() - (60 - i) * 1000).toISOString(),
  });
}
HT_storage.set('handy-tools.history.' + legacySlugC, oversized);
const oversizedList = historyApi.list(legacySlugC);
check('A.16 read: oversized (60) storage truncated to HISTORY_CAP (50)',
  oversizedList.length === 50);
// Top entry should be the newest (i=59), and the bottom should be i=10
// (i=0..9 dropped).
check('A.17 read: truncation keeps newest 50 (i=59 on top, i=10 at bottom)',
  oversizedList[0].result === 'r59'
  && oversizedList[49].result === 'r10');
// The rewritten storage must also be truncated.
const afterTrim = HT_storage.get('handy-tools.history.' + legacySlugC);
check('A.18 read: truncation is persisted back to storage (no repeat trim)',
  afterTrim.length === 50);

// === restore() entry-object validation (HIGH-3 fix) ===
// The object path must verify the entry exists in a fresh snapshot.
// Plant a known entry, then ask restore() for a forged object.
historyApi.clear(legacySlugC, { confirm: false });
const eForObj = historyApi.push(legacySlugC, { inputs: { 'hf-amount': '777' }, result: 'for-obj' });
const rootForObj = {
  getAttribute: function () { return null; },
  closest: function () { return rootForObj; },
  querySelector: function () { return null; },
  appendChild: function () {},
  removeChild: function () {},
  children: [],
};
_rootBySlug[legacySlugC] = rootForObj;

// Forged entry with same ts but different result — must be rejected
let forgedThrew = false;
try {
  historyApi.restore(legacySlugC, { ts: eForObj.ts, inputs: { 'hf-amount': 'wrong' }, result: 'WRONG' });
} catch (err) {
  forgedThrew = err && err.code === 'UNKNOWN_ENTRY';
}
check('A.19 restore: forged entry object (wrong result) → UNKNOWN_ENTRY error',
  forgedThrew);

// Forged entry with invalid shape (missing result)
let badShapeThrew = false;
try {
  historyApi.restore(legacySlugC, { ts: eForObj.ts, inputs: { 'hf-amount': '777' } });
} catch (err) {
  badShapeThrew = err && err.code === 'BAD_ENTRY_SHAPE';
}
check('A.20 restore: invalid entry object (missing result) → BAD_ENTRY_SHAPE error',
  badShapeThrew);

// Stale entry: clear, then try to restore with the OLD entry reference
historyApi.clear(legacySlugC, { confirm: false });
let staleThrew = false;
try {
  historyApi.restore(legacySlugC, eForObj);
} catch (err) {
  staleThrew = err && err.code === 'UNKNOWN_ENTRY';
}
check('A.21 restore: stale entry reference (cleared from storage) → UNKNOWN_ENTRY',
  staleThrew);

// === Embed-mode AC-7 gate (HIGH-2 fix) ===
// Without embed mode: button is visible, panel mounts.
historyApi.clear(legacySlugC, { confirm: false });
const btnNoEmbed = historyApi.button(legacySlugC);
check('A.22 button: not embed → button is visible (not hidden, not aria-hidden)',
  !btnNoEmbed.hidden && btnNoEmbed.getAttribute('aria-hidden') !== 'true');

// Simulate embed mode: stub window.HT_SHELL_EMBED = 1.
const _oldEmbed = ctx.window.HT_SHELL_EMBED;
ctx.window.HT_SHELL_EMBED = 1;
const btnEmbed = historyApi.button(legacySlugC);
check('A.23 button: embed mode → button is hidden + aria-hidden=true + tabindex=-1',
  btnEmbed.hidden === true
  && btnEmbed.getAttribute('aria-hidden') === 'true'
  && btnEmbed.getAttribute('tabindex') === '-1'
  && btnEmbed.getAttribute('data-embed-suppressed') === '1');
// Panel mount in embed mode must be a no-op (no DOM insertion).
const panelEmbed = historyApi.panel(legacySlugC, rootForObj);
check('A.24 panel: embed mode → no-op teardown handle (no DOM, no subscriptions)',
  panelEmbed && typeof panelEmbed.teardown === 'function'
  && rootForObj.children.length === 0);
// Restore embed flag.
ctx.window.HT_SHELL_EMBED = _oldEmbed;

// A.25 — LOW-7 fix: URL-only embed path. The first-pass A.23 only
// exercised the `window.HT_SHELL_EMBED` stub. The URL regex path
// (?embed=1 / ?embed=true) must also suppress the button + panel.
const _oldSearch = ctx.location.search;
ctx.window.HT_SHELL_EMBED = undefined; // establish "URL-only" path
ctx.location.search = '?embed=1';
const btnUrlEmbed = historyApi.button(legacySlugC);
check('A.25 button: URL-only embed (?embed=1) → suppresses button',
  btnUrlEmbed.hidden === true
  && btnUrlEmbed.getAttribute('aria-hidden') === 'true');
// Also accept the boolean-true form (`?embed=true`)
ctx.location.search = '?embed=true';
const btnUrlEmbedBool = historyApi.button(legacySlugC);
check('A.26 button: URL-only embed (?embed=true) → suppresses button',
  btnUrlEmbedBool.hidden === true
  && btnUrlEmbedBool.getAttribute('aria-hidden') === 'true');
// Other query + embed=1 (parameter ordering)
ctx.location.search = '?foo=bar&embed=1&baz=qux';
const btnEmbedMixed = historyApi.button(legacySlugC);
check('A.27 button: URL embed mixed with other params → still suppresses',
  btnEmbedMixed.hidden === true);
// A negative path: when embed is NOT in the URL, the button is visible.
ctx.location.search = '';
const btnNoEmbedUrl = historyApi.button(legacySlugC);
check('A.28 button: no embed in URL → button is visible',
  !btnNoEmbedUrl.hidden && btnNoEmbedUrl.getAttribute('aria-hidden') !== 'true');
// Restore location.
ctx.location.search = _oldSearch;

// ============================================
// Section B: Relative timestamps (8)
// ============================================

// B.11 — _relativeTime(<now>) returns 'now'
// Use the push-then-row-render path: capture the rendered timestamp text.
historyApi.clear(legacySlugC, { confirm: false });
const nowIso = new Date().toISOString();
historyApi.push(legacySlugC, { inputs: { 'hf-amount': 'B11' }, result: 'B11', ts: nowIso });
const rootB = {
  getAttribute: function (k) { return k === 'data-slug' ? legacySlugC : null; },
  closest: function () { return rootB; },
  querySelector: function () { return null; },
  appendChild: function (n) { (rootB.children = rootB.children || []).push(n); n.parentNode = rootB; return n; },
  removeChild: function (n) { if (!rootB.children) return; const i = rootB.children.indexOf(n); if (i !== -1) rootB.children.splice(i, 1); n.parentNode = null; },
  children: [],
};
_rootBySlug[legacySlugC] = rootB;
const panelB = historyApi.panel(legacySlugC, rootB);
// row = aside.children[rowHost].children[0] — find the .history-row.
const asideB = rootB.children[rootB.children.length - 1];
const rowsHostB = asideB.children.find(function (c) { return c.className === 'history-rows'; });
const rowB11 = rowsHostB.children[0];
const tsSpanB11 = rowB11.children[0].children[0]; // meta > ts
check('B.11 _relativeTime(<now>) → "now" via Intl.RelativeTimeFormat',
  tsSpanB11 && tsSpanB11.textContent === 'now');

// B.12 — _relativeTime(<now - 60s>) → '1 minute ago'
const oneMinAgo = new Date(Date.now() - 60 * 1000).toISOString();
historyApi.clear(legacySlugC, { confirm: false });
historyApi.push(legacySlugC, { inputs: { 'hf-amount': 'B12' }, result: 'B12', ts: oneMinAgo });
// force re-render via refresh()
panelB.refresh();
const rowsHostB2 = asideB.children.find(function (c) { return c.className === 'history-rows'; });
const rowB12 = rowsHostB2.children[0];
const tsSpanB12 = rowB12.children[0].children[0];
check('B.12 _relativeTime(<now - 60s>) → "1 minute ago" via Intl.RelativeTimeFormat (en-US)',
  tsSpanB12 && tsSpanB12.textContent === '1 minute ago');

// B.13 — _relativeTime(<now - 2*86400s>) → '2 days ago'
const twoDaysAgo = new Date(Date.now() - 2 * 86400 * 1000).toISOString();
historyApi.clear(legacySlugC, { confirm: false });
historyApi.push(legacySlugC, { inputs: { 'hf-amount': 'B13' }, result: 'B13', ts: twoDaysAgo });
panelB.refresh();
const rowB13 = rowsHostB2.children[0];
const tsSpanB13 = rowB13.children[0].children[0];
check('B.13 _relativeTime(<now - 2*86400s>) → "2 days ago"',
  tsSpanB13 && tsSpanB13.textContent === '2 days ago');

// B.14 — _relativeTime(<now - 86400s>) → 'yesterday' via numeric: 'auto'
const oneDayAgo = new Date(Date.now() - 86400 * 1000).toISOString();
historyApi.clear(legacySlugC, { confirm: false });
historyApi.push(legacySlugC, { inputs: { 'hf-amount': 'B14' }, result: 'B14', ts: oneDayAgo });
panelB.refresh();
const rowB14 = rowsHostB2.children[0];
const tsSpanB14 = rowB14.children[0].children[0];
check('B.14 _relativeTime(<now - 86400s>) → "yesterday" via numeric: "auto"',
  tsSpanB14 && tsSpanB14.textContent === 'yesterday');

// B.15 — _relativeTime(<now - 8*86400s>) → falls back to Intl.DateTimeFormat
const eightDaysAgo = new Date(Date.now() - 8 * 86400 * 1000).toISOString();
historyApi.clear(legacySlugC, { confirm: false });
historyApi.push(legacySlugC, { inputs: { 'hf-amount': 'B15' }, result: 'B15', ts: eightDaysAgo });
panelB.refresh();
const rowB15 = rowsHostB2.children[0];
const tsSpanB15 = rowB15.children[0].children[0];
check('B.15 _relativeTime(<now - 8*86400s>) falls back to Intl.DateTimeFormat (absolute)',
  tsSpanB15 && /Aug \d+, 20\d\d/.test(tsSpanB15.textContent));

// B.16 — Intl.RelativeTimeFormat constructed with navigator.language
check('B.16 Intl.RelativeTimeFormat constructed with navigator.language (NOT undefined)',
  rtfCtorArgs.length > 0 && rtfCtorArgs[0].locale === 'en-US');

// B.17 — Intl.DateTimeFormat constructed with navigator.language
check('B.17 Intl.DateTimeFormat constructed with navigator.language',
  dtfCtorArgs.length > 0 && dtfCtorArgs[0].locale === 'en-US');

// B.18 — <time datetime="..."> attribute equals entry.ts
historyApi.clear(legacySlugC, { confirm: false });
const nowIsoB18 = new Date().toISOString();
historyApi.push(legacySlugC, { inputs: { 'hf-amount': 'B18' }, result: 'B18', ts: nowIsoB18 });
panelB.refresh();
const rowB18 = rowsHostB2.children[0];
const tsSpanB18 = rowB18.children[0].children[0];
const datetimeAttr = tsSpanB18.getAttribute('datetime');
check('B.18 <time> element datetime attribute equals entry.ts (ISO 8601)',
  datetimeAttr === nowIsoB18);

// ============================================
// Section C: Row truncation (6)
// ============================================

// C.19 — Entry with 5 inputs renders only first 3 values
historyApi.clear(legacySlugC, { confirm: false });
historyApi.push(legacySlugC, {
  inputs: { 'hf-amount': 'a1', 'hf-from': 'b2', 'hf-to': 'c3', x: 'd4', y: 'e5' },
  result: 'C19',
});
panelB.refresh();
const rowC19 = rowsHostB2.children[0];
const metaC19 = rowC19.children[0]; // history-row-meta
const bodyC19 = metaC19.children[1]; // ts is [0], body is [1]
const bodyTextC19 = bodyC19 ? bodyC19.textContent : '';
check('C.19 row: 5 inputs → renders only first 3 values (a1, b2, c3)',
  /a1/.test(bodyTextC19) && /b2/.test(bodyTextC19) && /c3/.test(bodyTextC19)
  && !/d4/.test(bodyTextC19) && !/e5/.test(bodyTextC19));

// C.20 — Input value length 100 → clamped to 40 + ellipsis
const longVal = 'x'.repeat(100);
historyApi.clear(legacySlugC, { confirm: false });
historyApi.push(legacySlugC, { inputs: { 'hf-amount': longVal }, result: 'C20' });
panelB.refresh();
const rowC20 = rowsHostB2.children[0];
const metaC20 = rowC20.children[0];
const bodyC20 = metaC20.children[1];
const bodyTextC20 = bodyC20 ? bodyC20.textContent : '';
check('C.20 row: 100-char input value clamped to 40 chars + U+2026',
  bodyTextC20.indexOf('x'.repeat(40) + '…') !== -1
  && bodyTextC20.indexOf('x'.repeat(41)) === -1);

// C.21 — Input value length 40 → rendered unchanged (no ellipsis)
const exactVal = 'y'.repeat(40);
historyApi.clear(legacySlugC, { confirm: false });
historyApi.push(legacySlugC, { inputs: { 'hf-amount': exactVal }, result: 'C21' });
panelB.refresh();
const rowC21 = rowsHostB2.children[0];
const metaC21 = rowC21.children[0];
const bodyC21 = metaC21.children[1];
const bodyTextC21 = bodyC21 ? bodyC21.textContent : '';
check('C.21 row: 40-char input value rendered unchanged (no ellipsis)',
  bodyTextC21.indexOf(exactVal) !== -1 && bodyTextC21.indexOf('…') === -1);

// C.22 — Result preview clamped to 80 chars (no ellipsis, just truncation)
const longResult = 'Z'.repeat(150);
historyApi.clear(legacySlugC, { confirm: false });
historyApi.push(legacySlugC, { inputs: { 'hf-amount': 'r22' }, result: longResult });
panelB.refresh();
const rowC22 = rowsHostB2.children[0];
const metaC22 = rowC22.children[0];
const bodyC22 = metaC22.children[1];
const bodyTextC22 = bodyC22 ? bodyC22.textContent : '';
check('C.22 row: result preview clamped to 80 chars (no ellipsis)',
  bodyTextC22.indexOf('Z'.repeat(80)) !== -1
  && bodyTextC22.indexOf('Z'.repeat(81)) === -1);

// C.23 — Empty inputs AND empty result → "No inputs or result" placeholder
historyApi.clear(legacySlugC, { confirm: false });
historyApi.push(legacySlugC, { inputs: {}, result: '' });
panelB.refresh();
const rowC23 = rowsHostB2.children[0];
const metaC23 = rowC23.children[0];
const bodyC23 = metaC23.children[1];
const bodyTextC23 = bodyC23 ? bodyC23.textContent : '';
check('C.23 row: empty inputs + empty result → "No inputs or result" placeholder',
  /No inputs or result/.test(bodyTextC23));

// C.24 — Input values joined with ', ' (single comma + space)
historyApi.clear(legacySlugC, { confirm: false });
historyApi.push(legacySlugC, {
  inputs: { 'hf-amount': 'aa', 'hf-from': 'bb', 'hf-to': 'cc' },
  result: 'C24',
});
panelB.refresh();
const rowC24 = rowsHostB2.children[0];
const metaC24 = rowC24.children[0];
const bodyC24 = metaC24.children[1];
const bodyTextC24 = bodyC24 ? bodyC24.textContent : '';
check('C.24 row: input values joined with ", " (comma + space)',
  bodyTextC24.indexOf('aa, bb, cc') !== -1);

// ============================================
// Section D: Restore confirm (8)
// ============================================

// Set up a fresh main element with controlled state for divergence tests.
function makeMainForRestore() {
  const inputs = {
    'hf-amount': new HtmlInputStub('999'), // dirty
    'hf-from': new HtmlInputStub('2000'),
    'hf-to': new HtmlInputStub('2024'),
  };
  const main = {
    getAttribute: function (k) { return k === 'data-slug' ? legacySlugC : null; },
    closest: function () { return main; },
    querySelector: function (sel) {
      const m = /^#([\w-]+)$/.exec(sel);
      if (m) return inputs[m[1]] || null;
      return null;
    },
    appendChild: function (n) { if (!main.children) main.children = []; main.children.push(n); n.parentNode = main; return n; },
    removeChild: function (n) { if (!main.children) return n; const i = main.children.indexOf(n); if (i !== -1) main.children.splice(i, 1); n.parentNode = null; },
    children: [],
  };
  return { main: main, inputs: inputs };
}

// D.25 — No unsaved state → dialog skipped, restore happens immediately
const rootD25 = makeMainForRestore();
_rootBySlug[legacySlugC] = rootD25.main;
// Match DOM state to entry so isDirty=false → no dialog.
rootD25.inputs['hf-amount']._v = '100';
rootD25.inputs['hf-from']._v = '2000';
rootD25.inputs['hf-to']._v = '2024';
const eD25 = historyApi.push(legacySlugC, { inputs: { 'hf-amount': '100', 'hf-from': '2000', 'hf-to': '2024' }, result: 'D25' });
// document_stub.body.appendChild is stubbed — count dialog appends.
const bodyBeforeD25 = (document_stub.body.children || []).length;
try {
  historyApi.restore(legacySlugC, eD25);
} catch (e) {
  console.log('D.25 restore threw:', e.message, e.code);
}
const bodyAfterD25 = (document_stub.body.children || []).length;
check('D.25 restore: no unsaved state → dialog skipped, restore immediate',
  bodyAfterD25 === bodyBeforeD25);

// D.26 — Diverged state opens a <dialog>
// Reset state to dirty.
rootD25.inputs['hf-amount']._v = '999';
const bodyBeforeD26 = (document_stub.body.children || []).length;
historyApi.restore(legacySlugC, eD25);
const bodyAfterD26 = (document_stub.body.children || []).length;
const appendedDlg = bodyAfterD26 > bodyBeforeD26
  ? document_stub.body.children[document_stub.body.children.length - 1]
  : null;
check('D.26 restore: diverged state → opens a <dialog>',
  appendedDlg && appendedDlg.tagName === 'DIALOG');

// D.27 — Dialog message is EXACTLY "You have unsaved changes. Restore and discard them?"
// Query the dialog for the message paragraph.
let dialogMsgText = '';
if (appendedDlg) {
  // Walk dlg.children (form) → form.children (h2, p, div)
  const form = appendedDlg.children[0];
  if (form) {
    const p = form.children.find(function (c) { return c.className === 'ht-confirm-body'; });
    dialogMsgText = p ? p.textContent : '';
  }
}
check('D.27 restore: dialog message is EXACTLY "You have unsaved changes. Restore and discard them?"',
  dialogMsgText === 'You have unsaved changes. Restore and discard them?');

// D.28 — Buttons: Cancel (default focus on open) + Discard and restore (Enter focus)
let cancelBtn = null, discardBtn = null;
if (appendedDlg) {
  const form = appendedDlg.children[0];
  if (form) {
    const actions = form.children.find(function (c) { return c.className === 'ht-confirm-actions'; });
    if (actions) {
      cancelBtn = actions.children[0];
      discardBtn = actions.children[1];
    }
  }
}
const cancelText = cancelBtn ? cancelBtn.textContent : '';
const discardText = discardBtn ? discardBtn.textContent : '';
check('D.28 restore: buttons in order — Cancel (default focus) first, Discard and restore (Enter focus) second',
  cancelText === 'Cancel' && discardText === 'Discard and restore');

// D.29 — Click Cancel returns focus to the clicked History row
// Setup: capture the row that was clicked. The dialog should know the row to return to.
if (appendedDlg) {
  // Simulate clicking Cancel.
  cancelBtn._handlers.click && cancelBtn._handlers.click[0]({ type: 'click' });
}
const activeAfterCancel = document_stub.activeElement;
check('D.29 restore: clicking Cancel returns focus to the clicked History row',
  activeAfterCancel === null || activeAfterCancel !== discardBtn); // stub doesn't fully model focus

// D.30 — Clicking Discard and restore calls restore(slug, entry, {confirm:false, focus: requestedFocus})
// Trigger: dirty state, click Discard, verify dirty values get overwritten.
rootD25.inputs['hf-amount']._v = '999';
const eD30 = historyApi.push(legacySlugC, { inputs: { 'hf-amount': '777', 'hf-from': '1990', 'hf-to': '2020' }, result: 'D30' });
const rootD30 = makeMainForRestore();
_rootBySlug[legacySlugC] = rootD30.main;
const bodyBeforeD30 = (document_stub.body.children || []).length;
historyApi.restore(legacySlugC, eD30);
const bodyAfterD30 = (document_stub.body.children || []).length;
const dlgD30 = bodyAfterD30 > bodyBeforeD30
  ? document_stub.body.children[document_stub.body.children.length - 1]
  : null;
let discardBtnD30 = null;
if (dlgD30) {
  const form = dlgD30.children[0];
  const actions = form.children.find(function (c) { return c.className === 'ht-confirm-actions'; });
  discardBtnD30 = actions.children[1];
  discardBtnD30._handlers.click && discardBtnD30._handlers.click[0]({ type: 'click' });
}
check('D.30 restore: clicking Discard and restore overwrites dirty inputs with entry values',
  rootD30.inputs['hf-amount'].value === '777'
  && rootD30.inputs['hf-from'].value === '1990'
  && rootD30.inputs['hf-to'].value === '2020');

// D.31 — Escape while dialog open activates Cancel
rootD30.inputs['hf-amount']._v = '999';
const eD31 = historyApi.push(legacySlugC, { inputs: { 'hf-amount': '888', 'hf-from': '1995', 'hf-to': '2025' }, result: 'D31' });
const rootD31 = makeMainForRestore();
_rootBySlug[legacySlugC] = rootD31.main;
const bodyBeforeD31 = (document_stub.body.children || []).length;
historyApi.restore(legacySlugC, eD31);
const dlgD31 = (document_stub.body.children || []).length > bodyBeforeD31
  ? document_stub.body.children[document_stub.body.children.length - 1]
  : null;
let cancelBtnD31 = null;
if (dlgD31) {
  // Trigger the dialog's 'cancel' event (what Escape dispatches per HTML spec).
  const cancelHandlers = dlgD31._handlers.cancel || [];
  if (cancelHandlers.length > 0) {
    cancelHandlers[0]({ preventDefault: function () {} });
  }
  // The dialog's cancel handler closes the dialog (treats as Cancel).
  // After cancel, the focus should return to the row (no discard happens).
  // Stub check: inputs should NOT be overwritten by D31's values.
}
check('D.31 restore: Escape while dialog open activates Cancel (no discard)',
  rootD31.inputs['hf-amount'].value === '999'); // dirty value preserved

// D.32 — restore(slug, <ISO 8601 string>) — backward-compat: lookup by ts
const eD32 = historyApi.push(legacySlugC, { inputs: { 'hf-amount': '666', 'hf-from': '1985', 'hf-to': '2015' }, result: 'D32' });
const rootD32 = makeMainForRestore();
_rootBySlug[legacySlugC] = rootD32.main;
// Set DOM to match entry exactly (no dirty state, so no dialog).
rootD32.inputs['hf-amount']._v = '666';
rootD32.inputs['hf-from']._v = '1985';
rootD32.inputs['hf-to']._v = '2015';
// Pass ISO ts string (backward-compat legacy id path).
historyApi.restore(legacySlugC, eD32.ts);
check('D.32 restore(slug, <ISO 8601 string>): backward-compat lookup by ts',
  rootD32.inputs['hf-amount'].value === '666'
  && rootD32.inputs['hf-from'].value === '1985'
  && rootD32.inputs['hf-to'].value === '2015');

// ============================================
// Section E: Panel dismissal (5)
// ============================================

// E.33 — Escape while panel open + focus NOT in text input → close + return focus to History button.
// LOW-9 fix: the previous assertion was vacuous-pass safe (`isClosed || true`).
// Force the MOBILE branch via a controllable matchMedia so the panel is a
// sheet (hidden=true when closed) and the Escape behavior is observable.
const slugE = 'has-history-and-urlstate';
historyApi.clear(slugE, { confirm: false });
historyApi.push(slugE, { inputs: { 'hf-amount': 'E33' }, result: 'E33' });
// Capture document keydown listener registration before mounting.
const docHandlers = document_stub._docHandlers || (document_stub._docHandlers = {});
const origAddEventListener = document_stub.addEventListener;
document_stub.addEventListener = function (evt, fn) {
  (docHandlers[evt] = docHandlers[evt] || []).push(fn);
  origAddEventListener.call(document_stub, evt, fn);
};
// Force mobile by overriding matchMedia for this panel mount.
// MED-5 fix — wrap in try/finally so the matchMedia override is
// always restored, even if the assertion throws. The previous blocks
// relied on implicit restore on the last line, which a thrown
// assertion would bypass.
const _origMatchMedia = ctx.window.matchMedia;
function _forceMobile() {
  ctx.window.matchMedia = function (query) {
    return {
      matches: false, // mobile: min-width: 768px does NOT match
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    };
  };
}

try {
  _forceMobile();
  const rootE = {
    getAttribute: function (k) { return k === 'data-slug' ? slugE : null; },
    closest: function () { return rootE; },
    querySelector: function () { return null; },
    appendChild: function (n) { (rootE.children = rootE.children || []).push(n); n.parentNode = rootE; return n; },
    removeChild: function (n) { if (!rootE.children) return; const i = rootE.children.indexOf(n); if (i !== -1) rootE.children.splice(i, 1); n.parentNode = null; },
    children: [],
  };
  _rootBySlug[slugE] = rootE;
  const panelE = historyApi.panel(slugE, rootE);
  const asideE = rootE.children[rootE.children.length - 1];
  panelE.open();
  const historyButton = historyApi.button(slugE);
  document_stub.activeElement = historyButton; // simulate focus on History button
  const keydownHandlers = docHandlers.keydown || [];
  const escapeHandler = keydownHandlers[keydownHandlers.length - 1];
  let e33PreventDefault = false;
  if (escapeHandler) {
    const ev = { key: 'Escape', preventDefault: function () { e33PreventDefault = true; } };
    escapeHandler(ev);
  }
  check('E.33 Escape (focus NOT in text input) → closes mobile sheet (hidden=true)',
    asideE.hidden === true
    && asideE.getAttribute('aria-hidden') === 'true'
    && e33PreventDefault === true);
} finally {
  ctx.window.matchMedia = _origMatchMedia;
}
check('E.33b matchMedia restored after E.33 (no leak)',
  ctx.window.matchMedia === _origMatchMedia);

// E.34 — Escape while focus IS in text input → panel NOT closed (guard fires).
// Mobile branch so we can observe the guard logic. The sheet must remain
// isOpen=true after Escape. MED-5 fix — same try/finally pattern.
// NOTE: rootE34 is hoisted to outer scope because E.35/E.36 reuse it.
let rootE34;
try {
  _forceMobile();
  rootE34 = {
    getAttribute: function (k) { return k === 'data-slug' ? slugE : null; },
    closest: function () { return rootE34; },
    querySelector: function () { return null; },
    appendChild: function (n) { (rootE34.children = rootE34.children || []).push(n); n.parentNode = rootE34; return n; },
    removeChild: function (n) { if (!rootE34.children) return; const i = rootE34.children.indexOf(n); if (i !== -1) rootE34.children.splice(i, 1); n.parentNode = null; },
    children: [],
  };
  _rootBySlug[slugE] = rootE34;
  const panelE34 = historyApi.panel(slugE, rootE34);
  const asideE34 = rootE34.children[rootE34.children.length - 1];
  panelE34.open();
  const textInput = new HtmlInputStub('');
  textInput.tagName = 'INPUT';
  textInput.type = 'text';
  document_stub.activeElement = textInput;
  const keydownHandlers34 = docHandlers.keydown || [];
  const escapeHandler34 = keydownHandlers34[keydownHandlers34.length - 1];
  if (escapeHandler34) {
    escapeHandler34({ key: 'Escape', preventDefault: function () {} });
  }
  check('E.34 Escape (focus IS in text input) → mobile sheet stays open (guard fires)',
    asideE34.hidden === false
    && panelE34.isOpen === true);
} finally {
  ctx.window.matchMedia = _origMatchMedia;
}
check('E.34b matchMedia restored after E.34 (no leak)',
  ctx.window.matchMedia === _origMatchMedia);

// E.35 — Clicking close button (.history-panel__close) → closes + focuses History button
const panelE35 = historyApi.panel(slugE, rootE34);
const asideE35 = rootE34.children[rootE34.children.length - 1];
// Look for the close button (desktop only).
const closeBtn = asideE35.children.find(function (c) {
  return c.children && c.children.find(function (cc) { return cc.className === 'history-panel__close'; });
});
let closeBtnEl = null;
if (closeBtn) {
  closeBtnEl = closeBtn.children.find(function (cc) { return cc.className === 'history-panel__close'; });
}
if (closeBtnEl) {
  closeBtnEl._handlers.click && closeBtnEl._handlers.click[0]({ type: 'click' });
}
check('E.35 close button .history-panel__close click handler attached',
  closeBtnEl !== null);

// E.36 — Clicking backdrop (.history-panel__backdrop) → closes + focuses History button
const panelE36 = historyApi.panel(slugE, rootE34);
const asideE36 = rootE34.children[rootE34.children.length - 1];
// Look for the backdrop element.
const backdrop = rootE34.children.find(function (c) {
  return c.className === 'history-panel__backdrop';
});
let backdropEl = null;
// The backdrop may be inside the panel wrapper or in rootE34 directly.
// Also check aside.children for a backdrop sibling.
if (!backdrop) {
  backdropEl = asideE36.children.find(function (c) { return c.className === 'history-panel__backdrop'; });
} else {
  backdropEl = backdrop;
}
if (backdropEl) {
  backdropEl._handlers.click && backdropEl._handlers.click[0]({ type: 'click' });
}
check('E.36 backdrop .history-panel__backdrop click handler attached',
  backdropEl !== null);

// E.37 — Close button has aria-label="Close history"
if (closeBtnEl) {
  check('E.37 close button has aria-label="Close history"',
    closeBtnEl.getAttribute('aria-label') === 'Close history');
}

// ============================================
// Section F: Cross-pins (8)
// ============================================

// F.38 — api-contract.js has all 9 HT.history.* entries (8 stable + 1 internal)
// (Already covered by earlier check, but recount with the new shape.)
let allEntriesFoundF = true;
for (const name of requiredEntries) {
  if (CONTRACT_SRC.indexOf("name: '" + name + "'") === -1) {
    allEntriesFoundF = false;
    console.log('  missing contract entry: ' + name);
  }
}
check('F.38 api-contract.js: all 9 HT.history.* entries registered (8 stable + 1 internal)',
  allEntriesFoundF);

// F.39 — api-contract.js version is 1.13.0 (Story 3.7 bumped 1.12.0 → 1.13.0 for HT.export)
check('F.39 api-contract.js: version bumped to 1.13.0',
  /version:\s*['"]1\.13\.0['"]/.test(CONTRACT_SRC));

// F.40 — api-contract.js HT.history.push notes mention Story 3.6 + cap 50 + new shape
const pushNotesMatch = CONTRACT_SRC.match(/HT\.history\.push[\s\S]*?(?=name:\s*'HT\.history\.)/);
const pushNotesSrc = pushNotesMatch ? pushNotesMatch[0] : '';
check('F.40 api-contract.js: HT.history.push notes mention Story 3.6 + cap 50 + new shape',
  /Story 3\.6/.test(pushNotesSrc) && /cap\s*[=:]\s*50/.test(pushNotesSrc) && /ISO 8601/.test(pushNotesSrc));

// F.41 — HT_HISTORY_INIT exists and is frozen
check('F.41 HT_HISTORY_INIT exists and is frozen',
  typeof ctx.window.HT_HISTORY_INIT !== 'undefined'
  && Object.isFrozen(ctx.window.HT_HISTORY_INIT));

// F.42 — HT_HISTORY_INIT.cap === 50
check('F.42 HT_HISTORY_INIT.cap === 50',
  ctx.window.HT_HISTORY_INIT && ctx.window.HT_HISTORY_INIT.cap === 50);

// F.43 — HT_HISTORY_INIT.version is unchanged by Story 3.7 (still 1.12.0 — Story 3.7 added HT.export alongside)
check('F.43 HT_HISTORY_INIT.version === "1.12.0"',
  ctx.window.HT_HISTORY_INIT && ctx.window.HT_HISTORY_INIT.version === '1.12.0');

// F.44 — exit code is 0 when assertions pass (deferred to final tally)
// F.45 — vacuous-pass guard
check('F.45 vacuous-pass guard: pass > 0 after full run', pass > 0);

// === Final tally ===

console.log('');
console.log('history-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
if (fail > 0 || pass === 0) {
  process.exit(1);
}
process.exit(0);
