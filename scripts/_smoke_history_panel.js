/* ============================================
   Smoke harness for Story 2.3 — assets/js/history.js.
   Loads url.js + history.js in a fresh vm context
   with stub window/document/HT objects, plus a
   synthetic HT.storage facade, and asserts the
   HT.history surface per api-contract.js (version
   1.8.0 as of this writing — Story 2.3 bumped the
   contract 1.6.0 → 1.7.0, Story 2.5 bumped 1.7.0 → 1.8.0).

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
  Intl: Intl,
  HT: {
    homeGrid: { entries: entries },
    storage: HT_storage,
    urlState: undefined, // populated by url.js
  },
};
ctx.window.HT = ctx.HT;
ctx.Intl = Intl;

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
const entryA = historyApi.push(slugA, { state: { 'hf-amount': 100, 'hf-from': 2000, 'hf-to': 2024 }, result: '$246.10', label: '$100 in 2000' });
check('push: returns a frozen HistoryEntry',
  entryA && typeof entryA.id === 'string' && Object.isFrozen(entryA));
check('push: writes to handy-tools.history.<slugA> only',
  _storage.has('handy-tools.history.' + slugA)
  && !_storage.has('handy-tools.history.' + slugB));

const listA = historyApi.list(slugA);
check('list: returns frozen array', Object.isFrozen(listA));
check('list: newest-first ordering (length=1 then sorted)',
  listA.length === 1 && listA[0].id === entryA.id);
check('list: per-tool isolation — slugB has zero entries',
  historyApi.list(slugB).length === 0);

// FIFO cap of 10 — push 11 distinct, oldest dropped.
for (let i = 1; i <= 11; i += 1) {
  historyApi.push(slugA, {
    state: { 'hf-amount': 100 + i, 'hf-from': 2000, 'hf-to': 2024 },
    result: '$' + (100 + i),
    label: 'push #' + i,
  });
}
const capped = historyApi.list(slugA);
check('push: FIFO cap of 10 — array length is 10', capped.length === 10);
const firstId = entryA.id;
check('push: FIFO cap — oldest entry (first push) dropped',
  !capped.some(function (e) { return e.id === firstId; }));

// Round-trip via JSON — entries are JSON-serializable.
const roundTrip = JSON.parse(JSON.stringify(historyApi.list(slugA)));
check('push: entries are JSON-serializable (round-trip ok)',
  Array.isArray(roundTrip) && roundTrip.length === 10
  && roundTrip[0].state && typeof roundTrip[0].state['hf-amount'] !== 'undefined');

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
const eDedup = historyApi.push(slugA, { state: { 'hf-amount': 42 }, label: 'dedup' });
check('lastEntry: returns the most-recent entry after a push',
  historyApi.lastEntry(slugA) && historyApi.lastEntry(slugA).id === eDedup.id);

// Subscribe — fires on push; unsubscribe is idempotent.
let subscribeCalls = 0;
let lastEntries = null;
const unsubscribe = historyApi.subscribe(slugA, function (entries) {
  subscribeCalls += 1;
  lastEntries = entries;
});
historyApi.push(slugA, { state: { 'hf-amount': 5 }, label: 'sub' });
check('subscribe: callback fired once after push', subscribeCalls === 1);
check('subscribe: callback received array (≥1 entry)', Array.isArray(lastEntries) && lastEntries.length >= 1);
unsubscribe();
unsubscribe(); // idempotent
historyApi.push(slugA, { state: { 'hf-amount': 6 }, label: 'sub2' });
check('subscribe: unsubscribe is idempotent (no double-fire)', subscribeCalls === 1);

// === Restore path (assertions 11-18) ===

// Re-push to set up restore test.
const e1 = historyApi.push(slugA, { state: { 'hf-amount': 777, 'hf-from': 1990, 'hf-to': 2020 }, label: 'restore me' });
const e2 = historyApi.push(slugA, { state: { 'hf-amount': 888, 'hf-from': 1995, 'hf-to': 2025 }, label: 'restore me 2' });

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
historyApi.restore(slugA, e1.id, { confirm: false });
check('restore: writes entry.state into the inputs',
  root1.inputs['hf-amount'].value === '777'
  && root1.inputs['hf-from'].value === '1990'
  && root1.inputs['hf-to'].value === '2020');

// Unknown id throws.
let restoreErr = null;
try { historyApi.restore(slugA, 'no-such-id', { confirm: false }); }
catch (e) { restoreErr = e; }
check('restore: throws UrlStateSchemaError-shaped error on unknown id',
  restoreErr && restoreErr.name === 'UrlStateSchemaError'
  && restoreErr.code === 'UNKNOWN_ID');

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
check('api-contract.js: version bumped to 1.8.0',
  /version:\s*['"]1\.8\.0['"]/.test(CONTRACT_SRC));

// === Vacuous-pass guard (assertion 31) ===

check('vacuous-pass guard: pass > 0 (sanity)', pass > 0);

// === Final tally ===

console.log('');
console.log('history-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
if (fail > 0 || pass === 0) {
  process.exit(1);
}
process.exit(0);
