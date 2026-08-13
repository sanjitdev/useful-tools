/* ============================================
   Smoke harness for Story 3.8 — assets/js/import.js.
   Loads import.js (after storage-registry.js + export.js
   so HT_EXPORT_SCHEMA_VERSION is on window) in a fresh
   vm context with a synthetic HT.storage facade +
   HT.homeGrid + HT.history + HT.toast + FileReader /
   Blob / URL stubs. Asserts the HT.import surface,
   the 6-check payload validator, _detectConflicts,
   _confirmOverwrite (window.confirm stub), the apply
   phase ordering, history merge semantics with FIFO
   cap, idempotency, embed mode, frozen surface,
   HT_IMPORT_DIALOG_VERSION, parse-error path, and the
   api-contract pin.

   Version pinned to api-contract.js 1.14.0
   (Story 3.8 bumped 1.13.0 → 1.14.0 for HT.import).
   ============================================ */

'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const IMPORT_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'assets/js/import.js'),
  'utf8'
);
const CONTRACT_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'assets/js/api-contract.js'),
  'utf8'
);

let pass = 0;
let fail = 0;
function check(label, cond, info) {
  if (cond) {
    pass += 1;
    console.log('  PASS  ' + label);
  } else {
    fail += 1;
    console.log('  FAIL  ' + label + (info ? ' — ' + info : ''));
  }
}

// Synthetic in-memory storage.
const _store = Object.create(null);
const _meta = Object.create(null);
const localStorageStub = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null; },
  setItem: function (k, v) { _store[k] = String(v); },
  removeItem: function (k) { delete _store[k]; },
  clear: function () { for (const k of Object.keys(_store)) delete _store[k]; },
};

// Synthetic HT.storage facade — mirrors the export-smoke harness.
function _readStorageKey(key, fallback) {
  if (!Object.prototype.hasOwnProperty.call(_store, key)) return fallback !== undefined ? fallback : null;
  try { return JSON.parse(_store[key]); } catch (_) { return _store[key]; }
}
const HT_storage = {
  register: function (key, meta) {
    if (!key || typeof key !== 'string') throw new TypeError('register: key');
    if (!meta || typeof meta !== 'object') throw new TypeError('register: meta');
    _meta[key] = Object.freeze({ key: key, purpose: meta.purpose || '', lifetime: meta.lifetime || '', schema: meta.schema || '', owner: meta.owner || '' });
  },
  get: function (key, fallback) { return _readStorageKey(key, fallback); },
  set: function (key, value) {
    _store[key] = typeof value === 'string' ? value : JSON.stringify(value);
    return true;
  },
  remove: function (key) { delete _store[key]; delete _meta[key]; return true; },
  list: function () {
    return Object.freeze(Object.keys(_meta).sort().map(function (k) {
      const r = _meta[k];
      return { key: r.key, purpose: r.purpose, lifetime: r.lifetime, schema: r.schema, owner: r.owner };
    }));
  },
  keys: function () { return Object.keys(_meta).sort(); },
  clear: function () { for (const k of Object.keys(_store)) delete _store[k]; for (const k of Object.keys(_meta)) delete _meta[k]; },
};

HT_storage.register('ht.theme', { purpose: 'theme', lifetime: 'persistent', schema: 'string', owner: 'theme.js' });
HT_storage.register('ht.locale', { purpose: 'locale', lifetime: 'persistent', schema: 'string', owner: 'shell.js' });
HT_storage.register('ht.fontScale', { purpose: 'font-scale', lifetime: 'persistent', schema: 'string', owner: 'shell.js' });
HT_storage.register('ht.units', { purpose: 'units', lifetime: 'persistent', schema: 'string', owner: 'shell.js' });
HT_storage.register('ht.currency', { purpose: 'currency', lifetime: 'persistent', schema: 'string', owner: 'shell.js' });
HT_storage.register('handy-tools.pins', { purpose: 'pins', lifetime: 'persistent', schema: 'object', owner: 'shell.js' });
HT_storage.register('handy-tools.favorites', { purpose: 'favorites', lifetime: 'persistent', schema: 'array', owner: 'shell.js' });
HT_storage.register('handy-tools.recent', { purpose: 'recent', lifetime: 'persistent', schema: 'array', owner: 'shell.js' });
HT_storage.register('handy-tools.history.inflation-calculator', { purpose: 'history', lifetime: 'persistent', schema: 'entry-array', owner: 'history.js' });

// Synthetic HT.homeGrid.
const HT_homeGrid = {
  entries: [
    { slug: 'inflation-calculator', title: 'Inflation Calculator' },
    { slug: 'qr-code-generator', title: 'QR Code Generator' },
  ],
};

// Synthetic HT.history (post-3.6 list API returns migrated shape;
// Story 3.8 _replaceAll bulk-writes for the import merge).
const HT_history = {
  list: function (slug) {
    const raw = _store['handy-tools.history.' + slug];
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (_) { return []; }
  },
  _replaceAll: function (slug, entries) {
    if (!Array.isArray(entries)) return false;
    _store['handy-tools.history.' + slug] = JSON.stringify(entries);
    return true;
  },
};

// Synthetic HT_EXPORT_SCHEMA_VERSION (the import module reads from
// window.HT_EXPORT_SCHEMA_VERSION — simulate what export.js would
// have installed by the time import.js loads).
const HT_EXPORT_SCHEMA_VERSION = { version: '1.0.0' };

// Toast capture.
let lastToast = null;
const HT_toast = function (msg, ms) { lastToast = { msg: String(msg), ms: ms }; };

// Confirm dialog capture.
let confirmCalls = [];
let confirmResponse = true;
const confirmStub = function (msg) {
  confirmCalls.push(String(msg));
  return confirmResponse;
};

// FileReader stub — captures the file and triggers onload with the
// configured payload (or parse-error).
let nextReadResult = null;
let nextReadErr = null;
class FileReaderStub {
  constructor() {
    this._handlers = { load: [], error: [] };
    this.result = '';
  }
  set onload(fn) { this._handlers.load.push(fn); }
  get onload() { return this._handlers.load[this._handlers.load.length - 1]; }
  set onerror(fn) { this._handlers.error.push(fn); }
  get onerror() { return this._handlers.error[this._handlers.error.length - 1]; }
  readAsText(file) {
    const self = this;
    setTimeout(function () {
      if (nextReadErr) {
        const err = nextReadErr;
        nextReadErr = null;
        if (typeof self.onerror === 'function') self.onerror();
      } else {
        self.result = String(nextReadResult !== null ? nextReadResult : '');
        if (typeof self.onload === 'function') self.onload();
      }
    }, 0);
  }
}

// DOM stub — supports getElementById, createElement, body.appendChild.
const _fileInputsCreated = [];
function makeInputElStub() {
  const el = {
    tagName: 'INPUT',
    type: 'file',
    accept: '',
    id: '',
    files: null,
    value: '',
    _listeners: {},
    addEventListener: function (name, fn) {
      (this._listeners[name] = this._listeners[name] || []).push(fn);
    },
    removeEventListener: function () {},
    setAttribute: function (k, v) { this['_' + k] = v; },
    getAttribute: function (k) { return this['_' + k] != null ? this['_' + k] : null; },
    appendChild: function (n) { return n; },
    style: {},
    parentNode: null,
    tabIndex: 0,
    hidden: false,
    click: function () {
      // The harness captures the click; tests can directly invoke
      // the change handler via dispatchChange().
      el._clicked = true;
    },
    dispatchChange: function () {
      const handlers = this._listeners.change || [];
      for (const h of handlers) h({ target: this });
    },
  };
  _fileInputsCreated.push(el);
  return el;
}

const document_stub = {
  getElementById: function (id) {
    if (id === 'ht-import-file-picker-host') return document_stub._host || null;
    if (id === 'ht-import-file-picker') return _fileInputsCreated[_fileInputsCreated.length - 1] || null;
    return null;
  },
  createElement: function (tag) {
    const t = String(tag || '').toUpperCase();
    if (t === 'INPUT') return makeInputElStub();
    return {
      tagName: t,
      id: '',
      _listeners: {},
      addEventListener: function () {},
      setAttribute: function (k, v) { this['_' + k] = v; },
      appendChild: function (n) { return n; },
      style: {},
    };
  },
  body: {
    appendChild: function (n) {
      if (n && n.id === 'ht-import-file-picker-host') document_stub._host = n;
      return n;
    },
  },
};

// Build vm context — mirror browser shape so import.js's `window.HT = ...`,
// `window.HT_EXPORT_SCHEMA_VERSION.version`, `HT.storage.set`, etc. resolve
// through the same path production uses.
const ctx_window = {
  location: { search: '' },
  HT_SHELL_EMBED: undefined,
  HT_EXPORT_SCHEMA_VERSION: HT_EXPORT_SCHEMA_VERSION,
  HT_HISTORY_INIT: { version: '1.12.0', cap: 50 },
  localStorage: localStorageStub,
  document: document_stub,
  confirm: confirmStub,
  FileReader: FileReaderStub,
  Blob: function (parts, opts) { this.parts = parts; this.type = (opts && opts.type) || ''; },
  URL: { createObjectURL: function () { return 'blob:fake'; }, revokeObjectURL: function () {} },
};
const ctx = {
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  Blob: ctx_window.Blob,
  URL: ctx_window.URL,
  FileReader: FileReaderStub,
  document: document_stub,
  window: ctx_window,
  HT: {
    storage: HT_storage,
    homeGrid: HT_homeGrid,
    history: HT_history,
    toast: HT_toast,
  },
};
ctx_window.HT = ctx.HT;
ctx_window.confirm = confirmStub;
ctx.window.confirm = confirmStub;
ctx_window.location = { search: '' };

const sandbox = ctx;
sandbox.globalThis = sandbox;

vm.createContext(sandbox);

// Run import.js inside the vm.
try {
  vm.runInContext(IMPORT_SRC, sandbox, { filename: 'import.js' });
} catch (e) {
  console.log('FATAL: import.js threw at load: ' + e.message);
  fail += 1;
}

const HT = sandbox.HT;
const importApi = HT && HT.import;

// === Tests ===

// ===== A. Public surface =====
check('A.1 HT.import exists', typeof importApi === 'object' && importApi !== null);
check('A.2 HT.import.run is a function', typeof importApi.run === 'function');
check('A.3 HT.import.prompt is a function', typeof importApi.prompt === 'function');
check('A.4 HT.import is frozen', Object.isFrozen(importApi));
check('A.5 mutation of HT.import.run throws',
  (function () { try { importApi.run = 1; return false; } catch (_) { return true; } })());
check('A.6 prompt() === run() (thin alias)', importApi.prompt === importApi.run);

// ===== B. Internal handle =====
check('B.1 window.HT_IMPORT_DIALOG_VERSION exists', typeof sandbox.window.HT_IMPORT_DIALOG_VERSION === 'object');
check('B.2 internal version === "1.0.0"', sandbox.window.HT_IMPORT_DIALOG_VERSION && sandbox.window.HT_IMPORT_DIALOG_VERSION.version === '1.0.0');
check('B.3 internal handle is frozen', sandbox.window.HT_IMPORT_DIALOG_VERSION && Object.isFrozen(sandbox.window.HT_IMPORT_DIALOG_VERSION));
check('B.4 mutation of internal handle throws',
  (function () { try { sandbox.window.HT_IMPORT_DIALOG_VERSION.version = '2.0.0'; return false; } catch (_) { return true; } })());

// ===== C. Validator — 6 checks =====
function _validPayload() {
  return {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    settings: { 'ht.theme': 'dark', 'ht.locale': 'en' },
    history: {},
    favorites: [],
    recent: [],
    pins: {},
  };
}

// C.1 valid baseline
const _v1 = sandbox.window.eval ? null : null;
// We don't have a direct way to call the validator without exporting it.
// Use the end-to-end pipeline: build a valid file payload, call run(), and
// observe the success toast.
nextReadResult = JSON.stringify(_validPayload());
confirmResponse = true;
lastToast = null;
_store['ht.theme'] = 'dark'; // already matches the imported value
const r1 = importApi.run();
// r1 is {ok: true, state: 'awaiting-file'} synchronously; the actual
// apply happens in the change handler. Manually invoke the change handler.
const inputEl = _fileInputsCreated[_fileInputsCreated.length - 1];
inputEl.files = [{ name: 'export.json' }];
inputEl.dispatchChange();
// Allow the microtask to flush.
setTimeout(function () {
  // C.1 valid payload → success toast
  check('C.1 valid payload → success toast "Imported 0 history entries, 0 pins"',
    lastToast && /^Imported 0 history entries, 0 pins$/.test(lastToast.msg));

  // ===== D. Validator failures =====
  // D.1 wrong version
  lastToast = null;
  nextReadResult = JSON.stringify(Object.assign(_validPayload(), { version: '99.0.0' }));
  inputEl.files = [{ name: 'bad.json' }];
  inputEl.dispatchChange();
  setTimeout(function () {
    check('D.1 wrong version → toast mentions version compatibility',
      lastToast && /Import failed:/.test(lastToast.msg) && /version/i.test(lastToast.msg));

    // D.2 invalid exportedAt
    lastToast = null;
    const badDate = Object.assign(_validPayload(), { exportedAt: 'not-a-date' });
    nextReadResult = JSON.stringify(badDate);
    inputEl.files = [{ name: 'bad-date.json' }];
    inputEl.dispatchChange();
    setTimeout(function () {
      check('D.2 invalid exportedAt → toast names path',
        lastToast && /^Import failed: exportedAt$/.test(lastToast.msg));

      // D.3 settings not an object
      lastToast = null;
      nextReadResult = JSON.stringify(Object.assign(_validPayload(), { settings: 'not-an-object' }));
      inputEl.files = [{ name: 'bad-settings.json' }];
      inputEl.dispatchChange();
      setTimeout(function () {
        check('D.3 settings not an object → toast names path',
          lastToast && /^Import failed: settings$/.test(lastToast.msg));

        // D.4 history.<slug> not array
        lastToast = null;
        const badHistory = Object.assign(_validPayload(), {
          history: { 'inflation-calculator': { not: 'array' } },
        });
        nextReadResult = JSON.stringify(badHistory);
        inputEl.files = [{ name: 'bad-history.json' }];
        inputEl.dispatchChange();
        setTimeout(function () {
          check('D.4 history.<slug> not array → toast names path',
            lastToast && /^Import failed: history\.inflation-calculator$/.test(lastToast.msg));

          // D.5 favorites[i] not string
          lastToast = null;
          const badFav = Object.assign(_validPayload(), { favorites: ['ok', 42, 'ok2'] });
          nextReadResult = JSON.stringify(badFav);
          inputEl.files = [{ name: 'bad-fav.json' }];
          inputEl.dispatchChange();
          setTimeout(function () {
            check('D.5 favorites[i] not string → toast names path',
              lastToast && /^Import failed: favorites\[1\]$/.test(lastToast.msg));

            // D.6 pins.<slug> not ISO-parseable
            lastToast = null;
            const badPins = Object.assign(_validPayload(), {
              pins: { 'qr-code-generator': 'definitely-not-a-date' },
            });
            nextReadResult = JSON.stringify(badPins);
            inputEl.files = [{ name: 'bad-pins.json' }];
            inputEl.dispatchChange();
            setTimeout(function () {
              check('D.6 pins.<slug> not ISO-parseable → toast names path',
                lastToast && /^Import failed: pins\.qr-code-generator$/.test(lastToast.msg));

              // ===== E. Parse error =====
              lastToast = null;
              nextReadResult = '{not valid json}';
              inputEl.files = [{ name: 'parse.json' }];
              inputEl.dispatchChange();
              setTimeout(function () {
                check('E.1 JSON.parse throws → toast "Import failed: invalid JSON: …"',
                  lastToast && /^Import failed: invalid JSON:/.test(lastToast.msg));

                // E.2 toast msg truncated to ≤ 60 chars after "invalid JSON: "
                check('E.2 parse-error detail truncated to 60 chars max',
                  lastToast && lastToast.msg.length <= 'Import failed: invalid JSON: '.length + 60);

                // ===== F. Conflict detection =====
                // F.1 no conflict — settings identical
                lastToast = null;
                _store['ht.theme'] = 'dark';
                _store['ht.locale'] = 'en';
                const noConflict = _validPayload();
                nextReadResult = JSON.stringify(noConflict);
                confirmCalls = [];
                inputEl.files = [{ name: 'no-conflict.json' }];
                inputEl.dispatchChange();
                setTimeout(function () {
                  check('F.1 zero conflicts → confirm NOT called',
                    confirmCalls.length === 0);
                  check('F.2 zero conflicts → success toast appears',
                    lastToast && /^Imported/.test(lastToast.msg));

                  // F.3 one conflict
                  lastToast = null;
                  confirmCalls = [];
                  _store['ht.theme'] = 'light'; // differs from 'dark' in payload
                  const oneConflict = _validPayload();
                  nextReadResult = JSON.stringify(oneConflict);
                  inputEl.files = [{ name: 'one-conflict.json' }];
                  inputEl.dispatchChange();
                  setTimeout(function () {
                    check('F.3 one conflict + Overwrite → confirm called once',
                      confirmCalls.length === 1);
                    check('F.4 confirm message: "Importing will overwrite 1 setting(s). Continue?"',
                      confirmCalls.length === 1 && /^Importing will overwrite 1 setting\(s\)\. Continue\?$/.test(confirmCalls[0]));
                    check('F.5 confirm + Overwrite → success toast',
                      lastToast && /^Imported/.test(lastToast.msg));

                    // F.6 two conflicts + Cancel
                    lastToast = null;
                    confirmCalls = [];
                    confirmResponse = false;
                    _store['ht.theme'] = 'light';
                    _store['ht.locale'] = 'fr';
                    const twoConflicts = _validPayload();
                    nextReadResult = JSON.stringify(twoConflicts);
                    inputEl.files = [{ name: 'two-conflict.json' }];
                    inputEl.dispatchChange();
                    setTimeout(function () {
                      check('F.6 two conflicts + Cancel → confirm called',
                        confirmCalls.length === 1);
                      check('F.7 confirm message says "2 setting(s)"',
                        confirmCalls.length === 1 && /overwrite 2 setting\(s\)/.test(confirmCalls[0]));
                      check('F.8 cancel → toast "Import canceled"',
                        lastToast && lastToast.msg === 'Import canceled');

                      // ===== G. Apply phase order =====
                      lastToast = null;
                      confirmResponse = true;
                      // Plant existing values to detect order: clean the store.
                      for (const k of Object.keys(_store)) delete _store[k];
                      HT_storage.register('ht.theme', { purpose: 'theme', lifetime: 'persistent', schema: 'string', owner: 'theme.js' });
                      HT_storage.register('ht.locale', { purpose: 'locale', lifetime: 'persistent', schema: 'string', owner: 'shell.js' });
                      HT_storage.register('ht.fontScale', { purpose: 'font-scale', lifetime: 'persistent', schema: 'string', owner: 'shell.js' });
                      HT_storage.register('ht.units', { purpose: 'units', lifetime: 'persistent', schema: 'string', owner: 'shell.js' });
                      HT_storage.register('ht.currency', { purpose: 'currency', lifetime: 'persistent', schema: 'string', owner: 'shell.js' });
                      HT_storage.register('handy-tools.pins', { purpose: 'pins', lifetime: 'persistent', schema: 'object', owner: 'shell.js' });
                      HT_storage.register('handy-tools.favorites', { purpose: 'favorites', lifetime: 'persistent', schema: 'array', owner: 'shell.js' });
                      HT_storage.register('handy-tools.recent', { purpose: 'recent', lifetime: 'persistent', schema: 'array', owner: 'shell.js' });
                      HT_storage.register('handy-tools.history.inflation-calculator', { purpose: 'history', lifetime: 'persistent', schema: 'entry-array', owner: 'history.js' });
                      // Track set() call order via a wrapped HT.storage.set
                      // (and the bulk-write HT.history._replaceAll — both
                      // touch the same per-tool history key in Story 3.8).
                      const setOrder = [];
                      const origSet = HT_storage.set;
                      HT_storage.set = function (k, v) { setOrder.push(k); return origSet(k, v); };
                      const origReplaceAll = HT_history._replaceAll;
                      HT_history._replaceAll = function (slug, entries) { setOrder.push('handy-tools.history.' + slug); return origReplaceAll(slug, entries); };
                      const applyPayload = {
                        version: '1.0.0',
                        exportedAt: new Date().toISOString(),
                        settings: { 'ht.theme': 'dark', 'ht.locale': 'en', 'ht.fontScale': '1.05' },
                        history: { 'inflation-calculator': [
                          { ts: '2026-08-12T12:00:00.000Z', inputs: { 'ic-amount': 100 }, result: '$146' },
                        ] },
                        favorites: ['inflation-calculator'],
                        recent: ['qr-code-generator'],
                        pins: { 'qr-code-generator': '2026-08-12T08:00:00.000Z' },
                      };
                      nextReadResult = JSON.stringify(applyPayload);
                      inputEl.files = [{ name: 'apply.json' }];
                      inputEl.dispatchChange();
                      setTimeout(function () {
                        HT_storage.set = origSet;
                        // Order must be: settings (×3) → pins → favorites → recent → history.<slug>
                        check('G.1 apply order: settings keys written first',
                          setOrder[0] === 'ht.theme' && setOrder[1] === 'ht.locale' && setOrder[2] === 'ht.fontScale');
                        check('G.2 apply order: pins written after settings',
                          setOrder.indexOf('handy-tools.pins') === 3);
                        check('G.3 apply order: favorites written after pins',
                          setOrder.indexOf('handy-tools.favorites') === 4);
                        check('G.4 apply order: recent written after favorites',
                          setOrder.indexOf('handy-tools.recent') === 5);
                        check('G.5 apply order: history written after recent',
                          setOrder.indexOf('handy-tools.history.inflation-calculator') === 6);

                        // G.6 values stored match payload
                        check('G.6 ht.theme stored as "dark"',
                          _readStorageKey('ht.theme') === 'dark');
                        check('G.7 ht.locale stored as "en"',
                          _readStorageKey('ht.locale') === 'en');
                        check('G.8 handy-tools.pins stored as payload.pins object',
                          JSON.stringify(_readStorageKey('handy-tools.pins')) === JSON.stringify(applyPayload.pins));
                        check('G.9 handy-tools.favorites stored as payload.favorites array',
                          JSON.stringify(_readStorageKey('handy-tools.favorites')) === JSON.stringify(applyPayload.favorites));
                        check('G.10 handy-tools.recent stored as payload.recent array',
                          JSON.stringify(_readStorageKey('handy-tools.recent')) === JSON.stringify(applyPayload.recent));

                        // ===== H. History merge =====
                        // H.1 existing entries preserved
                        HT_storage.set('handy-tools.history.inflation-calculator', [
                          { ts: '2026-08-11T08:00:00.000Z', inputs: { 'ic-amount': 50 }, result: '$73' },
                        ]);
                        const mergePayload1 = {
                          version: '1.0.0',
                          exportedAt: new Date().toISOString(),
                          settings: {},
                          history: { 'inflation-calculator': [
                            { ts: '2026-08-12T12:00:00.000Z', inputs: { 'ic-amount': 100 }, result: '$146' },
                          ] },
                          favorites: [],
                          recent: [],
                          pins: {},
                        };
                        nextReadResult = JSON.stringify(mergePayload1);
                        inputEl.files = [{ name: 'merge1.json' }];
                        inputEl.dispatchChange();
                        setTimeout(function () {
                          const merged1 = _readStorageKey('handy-tools.history.inflation-calculator');
                          check('H.1 history merge preserves existing entries',
                            Array.isArray(merged1) && merged1.length === 2);
                          check('H.2 history merge newest-first ordering',
                            merged1[0].ts === '2026-08-12T12:00:00.000Z' &&
                            merged1[1].ts === '2026-08-11T08:00:00.000Z');

                          // H.3 ts collision → imported wins
                          HT_storage.set('handy-tools.history.inflation-calculator', [
                            { ts: '2026-08-12T12:00:00.000Z', inputs: { 'ic-amount': 999 }, result: 'OLD' },
                          ]);
                          const collisionPayload = {
                            version: '1.0.0',
                            exportedAt: new Date().toISOString(),
                            settings: {},
                            history: { 'inflation-calculator': [
                              { ts: '2026-08-12T12:00:00.000Z', inputs: { 'ic-amount': 100 }, result: 'NEW' },
                            ] },
                            favorites: [],
                            recent: [],
                            pins: {},
                          };
                          nextReadResult = JSON.stringify(collisionPayload);
                          inputEl.files = [{ name: 'collision.json' }];
                          inputEl.dispatchChange();
                          setTimeout(function () {
                            const merged2 = _readStorageKey('handy-tools.history.inflation-calculator');
                            check('H.3 ts collision → imported entry wins',
                              merged2 && merged2.length === 1 && merged2[0].result === 'NEW');

                            // H.4 FIFO cap = 50 — push 51 distinct via import
                            const oversized = { version: '1.0.0', exportedAt: new Date().toISOString(),
                              settings: {}, history: { 'inflation-calculator': [] }, favorites: [], recent: [], pins: {} };
                            for (let i = 0; i < 60; i += 1) {
                              oversized.history['inflation-calculator'].push({
                                ts: new Date(Date.now() - (60 - i) * 1000).toISOString(),
                                inputs: { 'ic-amount': String(i) },
                                result: 'r' + i,
                              });
                            }
                            HT_storage.set('handy-tools.history.inflation-calculator', []);
                            nextReadResult = JSON.stringify(oversized);
                            inputEl.files = [{ name: 'fifo.json' }];
                            inputEl.dispatchChange();
                            setTimeout(function () {
                              const capped = _readStorageKey('handy-tools.history.inflation-calculator');
                              check('H.4 history FIFO cap = 50 (largest merged length is 50)',
                                Array.isArray(capped) && capped.length === 50);

                              // H.5 invalid entries dropped with console.warn (pre-3.6 legacy shape)
                              const legacyPayload = {
                                version: '1.0.0',
                                exportedAt: new Date().toISOString(),
                                settings: {},
                                history: { 'inflation-calculator': [
                                  { ts: '2026-08-10T12:00:00.000Z', inputs: { 'ic-amount': 200 }, result: 'ok' },
                                  { id: 'legacy', ts: 1234567890, state: { 'ic-amount': '50' }, result: 'legacy', label: 'should drop' },
                                ] },
                                favorites: [],
                                recent: [],
                                pins: {},
                              };
                              HT_storage.set('handy-tools.history.inflation-calculator', []);
                              const warnCalls = [];
                              const origConsoleWarn = console.warn;
                              console.warn = function () { warnCalls.push(Array.prototype.slice.call(arguments)); };
                              nextReadResult = JSON.stringify(legacyPayload);
                              inputEl.files = [{ name: 'legacy.json' }];
                              inputEl.dispatchChange();
                              setTimeout(function () {
                                console.warn = origConsoleWarn;
                                const merged3 = _readStorageKey('handy-tools.history.inflation-calculator');
                                check('H.5 pre-3.6 legacy entry dropped (ts number), valid entry kept',
                                  Array.isArray(merged3) && merged3.length === 1 && merged3[0].result === 'ok');
                                check('H.6 console.warn fired for dropped legacy entry',
                                  warnCalls.length >= 1);

                                // ===== I. Idempotency within page lifetime =====
                                const r2a = importApi.run();
                                const r2b = importApi.run();
                                check('I.1 second run() during in-flight → returns {ok: false, reason: "in-flight"}',
                                  r2a && r2a.ok === true && r2a.state === 'awaiting-file' &&
                                  r2b && r2b.ok === false && r2b.reason === 'in-flight');
                                // Release the in-flight flag by dispatching an empty-file change
                                // (the import.js module releases the flag on cancel). The harness
                                // cannot call run() again until the flag is cleared.
                                inputEl.files = null;
                                inputEl.dispatchChange();

                                // ===== J. Embed mode =====
                                sandbox.window.HT_SHELL_EMBED = true;
                                lastToast = null;
                                const r3 = importApi.run();
                                check('J.1 embed mode → run() returns {ok: false, reason: "embed-mode"}',
                                  r3 && r3.ok === false && r3.reason === 'embed-mode');
                                sandbox.window.HT_SHELL_EMBED = undefined;
                                sandbox.window.location.search = '?embed=1';
                                const r4 = importApi.run();
                                check('J.2 ?embed=1 → embed-mode guard fires',
                                  r4 && r4.ok === false && r4.reason === 'embed-mode');
                                sandbox.window.location.search = '?embed=true';
                                const r5 = importApi.run();
                                check('J.3 ?embed=true → embed-mode guard fires',
                                  r5 && r5.ok === false && r5.reason === 'embed-mode');
                                sandbox.window.location.search = '';
                                sandbox.window.HT_SHELL_EMBED = 'true';
                                const r6 = importApi.run();
                                check('J.4 HT_SHELL_EMBED="true" → embed-mode guard fires',
                                  r6 && r6.ok === false && r6.reason === 'embed-mode');
                                sandbox.window.HT_SHELL_EMBED = undefined;

                                // ===== K. Confirm dialog wording (idempotency already proved) =====
                                // K.1 verify that with N=0 confirm is NOT called
                                confirmCalls = [];
                                HT_storage.set('ht.theme', 'dark');
                                HT_storage.set('ht.locale', 'en');
                                HT_storage.set('ht.fontScale', '1');
                                const noConflict2 = _validPayload();
                                nextReadResult = JSON.stringify(noConflict2);
                                inputEl.files = [{ name: 'k1.json' }];
                                inputEl.dispatchChange();
                                setTimeout(function () {
                                  check('K.1 N=0 → confirm NOT called (browser-native OK is the default for the destructive action)',
                                    confirmCalls.length === 0);

                                  // ===== L. api-contract pin =====
                                  check('L.1 api-contract.js version === 1.16.0 (Story 3.12 + 3.11 bumped to 1.16.0; Story 3.8 originally bumped 1.13.0 → 1.14.0 for HT.import)',
                                    /version:\s*['"]1\.16\.0['"]/.test(CONTRACT_SRC));
                                  check('L.2 api-contract.js lists HT.import entry',
                                    /name:\s*'HT\.import'/.test(CONTRACT_SRC));
                                  check('L.3 api-contract.js lists HT_IMPORT_DIALOG_VERSION entry',
                                    /name:\s*'HT_IMPORT_DIALOG_VERSION'/.test(CONTRACT_SRC));

                                  // ===== M. Vacuous-pass guard =====
                                  check('M.1 vacuous-pass guard: pass > 0', pass > 0);

                                  console.log('');
                                  console.log('import-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
                                  process.exit(fail === 0 ? 0 : 1);
                                }, 10);
                              }, 10);
                            }, 10);
                          }, 10);
                        }, 10);
                      }, 10);
                    }, 10);
                  }, 10);
                }, 10);
              }, 10);
            }, 10);
          }, 10);
        }, 10);
      }, 10);
    }, 10);
  }, 10);
}, 10);
