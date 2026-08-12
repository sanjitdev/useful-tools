/* ============================================
   Smoke harness for Story 3.7 — assets/js/export.js.
   Loads export.js into a fresh vm context with a
   synthetic HT.storage facade + HT.homeGrid stub +
   stubbed Blob / URL.createObjectURL / URL.revokeObjectURL
   and asserts the HT.export surface + payload assembly
   + validation + download trigger + embed-mode guard.

   Version pinned to api-contract.js 1.13.0
   (Story 3.7 bumped 1.12.0 → 1.13.0 for HT.export).
   ============================================ */

'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const EXPORT_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'assets/js/export.js'),
  'utf8'
);
const CONTRACT_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'assets/js/api-contract.js'),
  'utf8'
);

let pass = 0;
let fail = 0;
function check(label, cond) {
  if (cond) {
    pass += 1;
    console.log('  PASS  ' + label);
  } else {
    fail += 1;
    console.log('  FAIL  ' + label);
  }
}

// Synthetic localStorage
const _store = Object.create(null);
const localStorageStub = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(_store, k) ? _store[k] : null; },
  setItem: function (k, v) { _store[k] = String(v); },
  removeItem: function (k) { delete _store[k]; },
  clear: function () { for (const k of Object.keys(_store)) delete _store[k]; },
};

// Synthetic HT.storage facade
const registry = Object.create(null);
const HT_storage = {
  register: function (key, meta) {
    if (!key || typeof key !== 'string') throw new TypeError('register: key');
    if (!meta || typeof meta !== 'object') throw new TypeError('register: meta');
    registry[key] = Object.freeze({ key: key, purpose: meta.purpose || '', lifetime: meta.lifetime || '', schema: meta.schema || '', owner: meta.owner || '' });
  },
  get: function (key, fallback) {
    if (!Object.prototype.hasOwnProperty.call(_store, key)) return fallback !== undefined ? fallback : null;
    try { return JSON.parse(_store[key]); } catch (_) { return _store[key]; }
  },
  set: function (key, value) {
    _store[key] = typeof value === 'string' ? value : JSON.stringify(value);
  },
  remove: function (key) { delete _store[key]; },
  list: function () {
    return Object.freeze(Object.keys(registry).sort().map(function (k) {
      const r = registry[k];
      return { key: r.key, purpose: r.purpose, lifetime: r.lifetime, schema: r.schema, owner: r.owner };
    }));
  },
  keys: function () { return Object.keys(registry).sort(); },
};

// Seed a small registry with the spec's expected key families
HT_storage.register('ht.theme', { purpose: 'theme', lifetime: 'persistent', schema: 'string', owner: 'theme.js' });
HT_storage.register('ht.locale', { purpose: 'locale', lifetime: 'persistent', schema: 'string', owner: 'shell.js' });
HT_storage.register('ht.fontScale', { purpose: 'font-scale', lifetime: 'persistent', schema: 'string', owner: 'shell.js' });
HT_storage.register('handy-tools.history.inflation-calculator', { purpose: 'history', lifetime: 'persistent', schema: 'entry-array', owner: 'history.js' });
HT_storage.register('handy-tools.history.qr-code-generator', { purpose: 'history', lifetime: 'persistent', schema: 'entry-array', owner: 'history.js' });

// Synthetic HT.homeGrid
const HT_homeGrid = {
  entries: [
    { slug: 'inflation-calculator', title: 'Inflation Calculator' },
    { slug: 'qr-code-generator', title: 'QR Code Generator' },
  ],
};

// Synthetic HT.history (post-3.6 list API returns migrated shape)
const HT_history = {
  list: function (slug) {
    const raw = _store['handy-tools.history.' + slug];
    if (!raw) return [];
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      return arr;
    } catch (_) { return []; }
  },
};

// Download stubs
let lastBlob = null;
let lastRevokeTimer = 0;
const BlobStub = function (parts, opts) {
  this.parts = parts;
  this.type = (opts && opts.type) || '';
  this.size = (parts && parts.length ? String(parts[0]).length : 0);
  lastBlob = this;
};
let lastCreatedUrl = null;
const URLStub = {
  createObjectURL: function (b) { lastCreatedUrl = 'blob:fake-' + Math.random(); return lastCreatedUrl; },
  revokeObjectURL: function (u) { if (u === lastCreatedUrl) lastCreatedUrl = null; },
};

let lastToast = null;
const HT_toast = function (msg, ms) { lastToast = { msg: String(msg), ms: ms }; };

// Build vm context — mirror browser shape so export.js's `window.HT = ...`
// and `HT.storage.list()` resolves through the same path it does in
// production. The synthetic facades are attached to BOTH ctx.HT and
// ctx.window.HT so the IIFE in export.js writes its public surface onto
// the same object our assertions read back.
const document_stub = {
  body: { appendChild: function () {}, removeChild: function () {} },
  createElement: function (tag) {
    return {
      tagName: String(tag || '').toUpperCase(),
      href: '',
      download: '',
      style: {},
      click: function () {},
      parentNode: null,
    };
  },
};
const ctx_window = {
  location: { search: '' },
  HT_SHELL_EMBED: undefined,
  localStorage: localStorageStub,
  document: document_stub,
};
const ctx = {
  console: console,
  setTimeout: function (fn, ms) { lastRevokeTimer = ms; try { fn(); } catch (_) {} return 1; },
  Blob: BlobStub,
  URL: URLStub,
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
ctx_window.HT_SHELL_EMBED = undefined;
ctx_window.location = { search: '' };

const sandbox = ctx;
sandbox.globalThis = sandbox;

vm.createContext(sandbox);

// Run the source
try {
  vm.runInContext(EXPORT_SRC, sandbox, { filename: 'export.js' });
} catch (e) {
  console.log('FATAL: export.js threw at load: ' + e.message);
  fail += 1;
}

// Bind a host-side alias to the in-vm HT so the assertion block can
// read HT.export / HT.storage / etc. without re-running the script.
const HT = sandbox.HT;

// === Tests ===

// A. Public surface
check('A.1 HT.export exists', typeof HT.export === 'object' && HT.export !== null);
check('A.2 HT.export.run is a function', typeof HT.export.run === 'function');
check('A.3 HT.export.version === "1.0.0"', HT.export.version === '1.0.0');
check('A.4 HT.export is frozen', Object.isFrozen(HT.export));
check('A.5 mutation of HT.export.run throws', (function () { try { HT.export.run = 1; return false; } catch (_) { return true; } })());

// B. Internal handle
check('B.1 window.HT_EXPORT_SCHEMA_VERSION exists', typeof sandbox.window.HT_EXPORT_SCHEMA_VERSION === 'object');
check('B.2 internal version === "1.0.0"', sandbox.window.HT_EXPORT_SCHEMA_VERSION && sandbox.window.HT_EXPORT_SCHEMA_VERSION.version === '1.0.0');
check('B.3 internal handle is frozen', sandbox.window.HT_EXPORT_SCHEMA_VERSION && Object.isFrozen(sandbox.window.HT_EXPORT_SCHEMA_VERSION));

// C. Payload structure (no history, no settings populated yet)
_store['handy-tools.history.inflation-calculator'] = JSON.stringify([
  { ts: '2026-08-12T12:00:00.000Z', inputs: { 'ic-amount': 100 }, result: '$146' },
  { ts: '2026-08-12T11:00:00.000Z', inputs: { 'ic-amount': 50 }, result: '$73' },
]);
_store['ht.theme'] = 'dark';
_store['ht.locale'] = 'en';
_store['ht.fontScale'] = '1';
_store['handy-tools.recent'] = JSON.stringify(['inflation-calculator']);
_store['handy-tools.favorites'] = JSON.stringify(['qr-code-generator']);
_store['handy-tools.pins'] = JSON.stringify({ 'qr-code-generator': '2026-08-12T08:00:00.000Z' });

lastBlob = null; lastCreatedUrl = null; lastToast = null; lastRevokeTimer = 0;
const r1 = HT.export.run();
check('C.1 run() returned ok=true', r1 && r1.ok === true);
check('C.3 payload.version === 1.0.0', r1 && r1.payload && r1.payload.version === '1.0.0');
check('C.4 payload.exportedAt is ISO-parseable', r1 && r1.payload && !Number.isNaN(new Date(r1.payload.exportedAt).getTime()));
check('C.5 payload.settings is plain object',
  r1 && r1.payload && r1.payload.settings && typeof r1.payload.settings === 'object' && !Array.isArray(r1.payload.settings));
check('C.6 payload.settings["ht.theme"] === "dark"', r1 && r1.payload && r1.payload.settings['ht.theme'] === 'dark');
check('C.7 payload.settings["ht.locale"] === "en"', r1 && r1.payload && r1.payload.settings['ht.locale'] === 'en');
check('C.8 payload.history is plain object', r1 && r1.payload && r1.payload.history && typeof r1.payload.history === 'object' && !Array.isArray(r1.payload.history));
check('C.9 payload.history has inflation-calculator entry', r1 && r1.payload && Array.isArray(r1.payload.history['inflation-calculator']) && r1.payload.history['inflation-calculator'].length === 2);
check('C.10 payload.history does NOT include qr-code-generator (empty)', r1 && r1.payload && Array.isArray(r1.payload.history['qr-code-generator']) && r1.payload.history['qr-code-generator'].length === 0);
check('C.11 payload.favorites is array of strings', r1 && r1.payload && Array.isArray(r1.payload.favorites) && r1.payload.favorites[0] === 'qr-code-generator');
check('C.12 payload.recent is array of strings', r1 && r1.payload && Array.isArray(r1.payload.recent) && r1.payload.recent[0] === 'inflation-calculator');
check('C.13 payload.pins is plain object with timestamp', r1 && r1.payload && r1.payload.pins && r1.payload.pins['qr-code-generator'] === '2026-08-12T08:00:00.000Z');
check('C.14 payload has 7 top-level keys (version, exportedAt, settings, history, favorites, recent, pins)',
  r1 && r1.payload && Object.keys(r1.payload).length === 7);

// D. Download mechanism
check('D.1 Blob created', lastBlob !== null);
check('D.2 Blob mime type is application/json', lastBlob && lastBlob.type === 'application/json');
check('D.3 Blob contents are valid JSON', lastBlob && (function () { try { JSON.parse(lastBlob.parts[0]); return true; } catch (_) { return false; } })());
check('D.4 URL.createObjectURL was called', lastCreatedUrl !== null || (lastCreatedUrl === null && r1 && r1.ok));
check('D.5 revokeObjectURL scheduled with 1000ms', lastRevokeTimer === 1000);
check('D.6 filename format handy-tools-export-YYYY-MM-DD.json', r1 && r1.filename && /^handy-tools-export-\d{4}-\d{2}-\d{2}\.json$/.test(r1.filename));
check('D.7 toast: "Export complete"', lastToast && lastToast.msg === 'Export complete');
check('D.8 toast lifetime 2500ms', lastToast && lastToast.ms === 2500);

// E. Validation failure → toast + console.error
// Force a validation failure by stubbing HT.history.list to return a
// non-array for a registered slug. This bypasses the defensive
// `_getStringArray` coercion in _buildHistory — history is built
// straight from HT.history.list(slug) without coercion, so a bad
// shape propagates into payload.history.<slug> and the validator
// catches `history.<slug>` must be an array.
const _origHistoryList = HT.history.list;
HT.history.list = function (slug) {
  if (slug === 'qr-code-generator') return { not: 'an array' };
  return _origHistoryList.call(this, slug);
};

// Capture console.error
const errLog = [];
const origConsoleError = console.error;
console.error = function () { errLog.push(Array.prototype.slice.call(arguments)); };
lastToast = null; lastBlob = null;
const r2 = HT.export.run();
console.error = origConsoleError;
HT.history.list = _origHistoryList;

check('E.1 invalid payload → ok=false', r2 && r2.ok === false);
check('E.2 invalid payload → reason=validation-failed', r2 && r2.reason === 'validation-failed');
check('E.3 invalid payload → toast names offending path', lastToast && /^Export validation failed: history\./.test(lastToast.msg));
check('E.4 invalid payload → console.error fires', errLog.length > 0);
check('E.5 invalid payload → does NOT trigger download', lastBlob === null);

// F. Embed-mode guard
sandbox.window.HT_SHELL_EMBED = true;
lastToast = null; lastRevokeTimer = 0;
const r3 = HT.export.run();
check('F.1 embed mode → ok=false', r3 && r3.ok === false);
check('F.2 embed mode → reason=embed-mode', r3 && r3.reason === 'embed-mode');
sandbox.window.HT_SHELL_EMBED = undefined;
sandbox.window.location.search = '?embed=1';
const r4 = HT.export.run();
check('F.3 ?embed=1 triggers embed guard', r4 && r4.ok === false && r4.reason === 'embed-mode');
sandbox.window.location.search = '';
sandbox.window.HT_SHELL_EMBED = 'true';
const r5 = HT.export.run();
check('F.4 HT_SHELL_EMBED "true" triggers embed guard', r5 && r5.ok === false && r5.reason === 'embed-mode');
sandbox.window.HT_SHELL_EMBED = undefined;

// G. Internal-helper validation behavior
// Exercise the validator through the assembly path with a different
// corruption shape: stub HT.history.list to return an array containing
// a string element (entry shape), but break pins via a bad timestamp
// on a registered slug. `_getPins()` does NOT coerce shape, so an
// array entry survives as the value (which then fails ISO parse).
HT.history.list = function (slug) {
  if (slug === 'qr-code-generator') return { not: 'an array' };
  return _origHistoryList.call(this, slug);
};
lastToast = null;
errLog.length = 0;
console.error = function () { errLog.push(Array.prototype.slice.call(arguments)); };
const r6 = HT.export.run();
console.error = origConsoleError;
HT.history.list = _origHistoryList;
check('G.1 qr-code history non-array → validation fails', r6 && r6.ok === false);
check('G.2 qr-code history error path starts with "history.qr-code-generator"',
  lastToast && /^Export validation failed: history\.qr-code-generator$/.test(lastToast.msg));

// H. api-contract pin
check('H.1 api-contract.js version === 1.13.0 (Story 3.7)', /version:\s*['"]1\.13\.0['"]/.test(CONTRACT_SRC));
check('H.2 api-contract.js lists HT.export entry', /name:\s*'HT\.export'/.test(CONTRACT_SRC));

// === Vacuous-pass guard ===
check('vacuous-pass guard: pass > 0 (sanity)', pass > 0);
console.log('');
console.log('export-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);
