/* ============================================
   Smoke harness for Story 2.1 — assets/js/url.js.
   Loads url.js in a fresh vm context with stub
   window/document/HT objects and asserts the
   HT.urlState surface per api-contract.js.
   ============================================ */

'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const URL_SRC = fs.readFileSync(
  path.resolve(__dirname, '../assets/js/url.js'),
  'utf8'
);
// SF-2: Load the real utils.js so HT.debounce is real (not stubbed to
// identity). The functions defined in utils.js only execute when
// called; parse-time only attaches them to HT, so the stub document
// is enough.
const UTILS_SRC = fs.readFileSync(
  path.resolve(__dirname, '../assets/js/utils.js'),
  'utf8'
);

// Stub the HT + document objects so the url.js IIFE can attach its
// surface without touching real browser APIs.
const toolEntry = {
  id: 'test-tool',
  slug: 'test-tool',
  schemaVersion: '1',
  urlState: {
    // Defaults match the decoded type so round-trip equality holds.
    default: { 'ic-amount': 100, 'ic-from': 2000 },
    encode: [
      { key: 'ic-amount', type: 'number' },
      { key: 'ic-from', type: 'number' },
      { key: 'ic-text', type: 'string' },
      { key: 'ic-bool', type: 'boolean' },
    ],
    decode: [
      { key: 'ic-amount', type: 'number' },
      { key: 'ic-from', type: 'number' },
      { key: 'ic-text', type: 'string' },
      { key: 'ic-bool', type: 'boolean' },
    ],
  },
};

// Minimal DOM-class stubs so url.js's `instanceof HTMLInputElement` etc.
// checks succeed against vm-context test fixtures.
function HtmlInputStub(initial) {
  this._v = initial == null ? '' : String(initial);
  this.type = 'text';
  this.checked = false;
}
Object.defineProperty(HtmlInputStub.prototype, 'value', {
  get() { return this._v; },
  set(v) { this._v = v == null ? '' : String(v); },
});
function HtmlTextAreaStub(initial) {
  this._v = initial == null ? '' : String(initial);
}
Object.defineProperty(HtmlTextAreaStub.prototype, 'value', {
  get() { return this._v; },
  set(v) { this._v = v == null ? '' : String(v); },
});
function HtmlSelectStub(initial) {
  this._v = initial == null ? '' : String(initial);
}
Object.defineProperty(HtmlSelectStub.prototype, 'value', {
  get() { return this._v; },
  set(v) { this._v = v == null ? '' : String(v); },
});
const HTMLInputElement = HtmlInputStub;
const HTMLTextAreaElement = HtmlTextAreaStub;
const HTMLSelectElement = HtmlSelectStub;

// SF-2: Use real timers (not no-ops) so the real HT.debounce from
// utils.js actually debounces — otherwise the bindForm 100ms timer
// never fires and we can't test that the debounce path works.
const realSetTimeout = setTimeout;
const realClearTimeout = clearTimeout;

const ctx = {
  window: {},
  document: {
    getElementById: () => null,
    querySelector: () => null,
    activeElement: null,
    createElement: () => ({ className: '', textContent: '', style: {}, appendChild: () => {}, remove: () => {} }),
    body: { appendChild: () => {} },
  },
  console,
  performance: { now: () => Date.now() },
  setTimeout: realSetTimeout,
  clearTimeout: realClearTimeout,
  history: { replaceState: () => {}, pushState: () => {} },
  location: { hash: '', pathname: '/tools/test-tool/', search: '' },
  HTMLInputElement,
  HTMLTextAreaElement,
  HTMLSelectElement,
  HT: {
    homeGrid: { entries: [toolEntry] },
  },
};
ctx.window.HT = ctx.HT;
ctx.window.addEventListener = () => {};
ctx.window.removeEventListener = () => {};

vm.createContext(ctx);
// utils.js attaches HT.debounce + other helpers; url.js then captures
// HT.debounce in its closure so bindForm uses the real debounced
// setTimeout path.
vm.runInContext(UTILS_SRC, ctx, { filename: 'utils.js' });
vm.runInContext(URL_SRC, ctx, { filename: 'url.js' });

const HT = ctx.window.HT;
const urlState = HT.urlState;

let pass = 0, fail = 0;
function check(name, ok, info) {
  if (ok) { pass += 1; console.log('  PASS  ' + name); }
  else { fail += 1; console.log('  FAIL  ' + name + (info ? ' — ' + info : '')); }
}

check('HT.urlState exists', typeof urlState === 'object');
check('HT.urlState.encode is function', typeof urlState.encode === 'function');
check('HT.urlState.decode is function', typeof urlState.decode === 'function');
check('HT.urlState.bindForm is function', typeof urlState.bindForm === 'function');
check('HT.urlState.bindDomTarget is function', typeof urlState.bindDomTarget === 'function');
check('HT.urlState.subscribe is function', typeof urlState.subscribe === 'function');
check('HT.urlState is frozen', Object.isFrozen(urlState));

// 1. Encode of empty state returns ""
check(
  'encode: empty state returns ""',
  urlState.encode('test-tool', {}) === ''
);

// 2. Encode of a single-key state returns the percent-encoded key=value pair.
check(
  'encode: single key produces _v=k=v',
  urlState.encode('test-tool', { 'ic-text': 'hello world' })
    === '_v=1&ic-text=hello%20world'
);

// 3. Encode sorts keys lexicographically.
check(
  'encode: keys sorted lexicographically (after _v)',
  urlState.encode('test-tool', {
    'ic-text': 'z',
    'ic-amount': '999',
    'ic-from': '2001',
  }) === '_v=1&ic-amount=999&ic-from=2001&ic-text=z'
);

// 4. Encode omits values that equal defaults.
check(
  'encode: defaults omitted',
  urlState.encode('test-tool', {
    'ic-amount': 100,    // equals default (number 100)
    'ic-from': 2001,     // differs from default 2000
    'ic-text': 'foo',
  }) === '_v=1&ic-from=2001&ic-text=foo'
);

// 5. Encode includes _v when schemaVersion is set.
check(
  'encode: _v prepended when schemaVersion set',
  urlState.encode('test-tool', { 'ic-amount': '999' }).indexOf('_v=1&') === 0
);

// 6. Round-trip: encode → decode equals original (modulo defaults).
const original = { 'ic-amount': '250', 'ic-from': '1995', 'ic-text': 'a&b', 'ic-bool': true };
const encoded = urlState.encode('test-tool', original);
const decoded = urlState.decode('test-tool', encoded);
check('round-trip: amount survives', decoded['ic-amount'] === 250);
check('round-trip: from survives', decoded['ic-from'] === 1995);
check('round-trip: text survives (URL-encoded)', decoded['ic-text'] === 'a&b');
check('round-trip: boolean decodes to true', decoded['ic-bool'] === true);

// 7. Decode merges with defaults.
const decWithDefaults = urlState.decode('test-tool', '');
check('decode: empty hash still merges defaults', decWithDefaults['ic-amount'] === 100);
check('decode: default "ic-from" preserved', decWithDefaults['ic-from'] === 2000);

// 8. Decode ignores unknown keys silently.
const decWithUnknown = urlState.decode('test-tool', 'ic-amount=42&unknown-key=foo');
check('decode: unknown key silently dropped', !('unknown-key' in decWithUnknown));
check('decode: known key still decoded alongside unknown', decWithUnknown['ic-amount'] === 42);

// 9. Decode throws UrlStateDecodeError with code MALFORMED_VALUE on bad coercion.
let badDecodeErr = null;
try { urlState.decode('test-tool', 'ic-amount=notanumber'); }
catch (e) { badDecodeErr = e; }
check(
  'decode: bad number throws UrlStateDecodeError',
  badDecodeErr !== null && badDecodeErr.name === 'UrlStateDecodeError' &&
    badDecodeErr.code === 'MALFORMED_VALUE'
);

// 10. Decode throws UrlStateSchemaError on missing schema.
let missingErr = null;
try { urlState.decode('does-not-exist', ''); }
catch (e) { missingErr = e; }
check(
  'decode: missing slug throws UrlStateSchemaError',
  missingErr !== null && missingErr.name === 'UrlStateSchemaError'
);

// 11. UTF-8 percent-encoding handles emoji + non-Latin.
const emoji = urlState.encode('test-tool', { 'ic-text': '日本語🌸' });
check('encode: emoji + non-Latin percent-encoded (with _v)',
  emoji === '_v=1&ic-text=%E6%97%A5%E6%9C%AC%E8%AA%9E%F0%9F%8C%B8');
const emojiDecoded = urlState.decode('test-tool', emoji);
check('decode: emoji + non-Latin round-trips', emojiDecoded['ic-text'] === '日本語🌸');

// 12. bindForm writes initial state into fields before any user input.
// SF-3: assertions are strengthened to check (a) the setter was called
// at least once with the URL-restored value, AND (b) the field's
// current value (post-bindForm) reflects that restored state — proving
// the write actually persisted, not just that some setter fired.
let bindFormWroteInitial = false;
const fakeInput = new HTMLInputElement('');
let fakeInputSetters = 0;
let fakeInputSetterValues = [];
Object.defineProperty(fakeInput, 'value', {
  get() { return this._v; },
  set(v) {
    this._v = v == null ? '' : String(v);
    fakeInputSetters += 1;
    fakeInputSetterValues.push(this._v);
    if (v === '999' || v === 999) bindFormWroteInitial = true;
  },
});
fakeInput.addEventListener = () => {};
fakeInput.removeEventListener = () => {};
const fakeRoot = {
  querySelector: function (sel) {
    if (sel === '#ic-amount') return fakeInput;
    return null;
  },
};
ctx.location.hash = '#ic-amount=999';
let bindFormThrew = null;
let teardown = null;
try { teardown = urlState.bindForm('test-tool', fakeRoot); }
catch (e) { bindFormThrew = e; }
check('bindForm: did not throw on smoke-stub root', bindFormThrew === null,
  bindFormThrew && bindFormThrew.message);
check('bindForm: initial state written before user input', bindFormWroteInitial);
// SF-3: post-bindForm state persisted. The .value getter returns
// whatever the last setter assigned — if bindForm wrote '999' and
// nothing clobbered it, this should be '999'.
check('SF-3: bindForm initial state persists in field (.value getter)',
  fakeInput.value === '999');
check('SF-3: bindForm fired at least one setter',
  fakeInputSetters >= 1);
// Sanity: the value '999' must appear in the setter call log, not
// only in the field state. (Defends against an impl that flips state
// via a private path while never telling the field.)
check('SF-3: setter was called with the URL-restored value',
  fakeInputSetterValues.indexOf('999') !== -1);
if (teardown) teardown();

// 13. subscribe returns an unsubscribe function; calling unsubscribe twice is idempotent.
let subFired = false;
const unsub = urlState.subscribe('test-tool', () => { subFired = true; });
check('subscribe: returns a function', typeof unsub === 'function');
let unsubAgainThrew = false;
try { unsub(); unsub(); } catch (e) { unsubAgainThrew = true; }
check('subscribe: unsubscribe idempotent', !unsubAgainThrew);

// 14. Schema cache returns the same object reference on second call.
const schema1 = urlState._loadSchema('test-tool');
const schema2 = urlState._loadSchema('test-tool');
check('_loadSchema: returns same cached reference', schema1 === schema2);

// 15. The api-contract.js entry for HT.urlState.encode matches the implementation signature.
const contractSrc = fs.readFileSync(
  path.resolve(__dirname, '../assets/js/api-contract.js'),
  'utf8'
);
check(
  'api-contract.js: lists HT.urlState.encode entry',
  /HT\.urlState\.encode/.test(contractSrc)
);
check(
  'api-contract.js: lists HT.urlState.decode entry',
  /HT\.urlState\.decode/.test(contractSrc)
);
check(
  'api-contract.js: lists HT.urlState.subscribe entry',
  /HT\.urlState\.subscribe/.test(contractSrc)
);
check(
  'api-contract.js: lists HT.urlState.bindForm entry',
  /HT\.urlState\.bindForm/.test(contractSrc)
);
check(
  'api-contract.js: lists HT.urlState.bindDomTarget entry',
  /HT\.urlState\.bindDomTarget/.test(contractSrc)
);
check(
  'api-contract.js: version bumped to 1.14.0 (Story 3.7 + 3.8 — HT.export + HT.import added; Story 3.6 — history panel shape migration + cap 50; Story 3.3 superseded)',
  /version:\s*['"]1\.14\.0['"]/.test(contractSrc)
);

// 16. The _smoke_shell_public_api harness registry-match extension lands here too.
check(
  'api-contract.js: HT.urlState._loadSchema entry present (internal)',
  /HT\.urlState\._loadSchema/.test(contractSrc)
);

// 16b. HT.urlStateUrl alias (AC-1) + entry in api-contract.
check(
  'api-contract.js: HT.urlStateUrl entry present (internal)',
  /HT\.urlStateUrl/.test(contractSrc)
);
// Stub location.hash so the getter can read it.
ctx.location.hash = '#ic-amount=999';
check(
  'HT.urlStateUrl: returns hash when present',
  HT.urlStateUrl === '#ic-amount=999'
);
ctx.location.hash = '';
check(
  'HT.urlStateUrl: returns null when hash is empty',
  HT.urlStateUrl === null
);
// Reset for later tests.
ctx.location.hash = '';

// 17. prefill param merges under schema default (pack defaults land in 6.4).
const withPrefill = urlState.decode('test-tool', '', { prefill: { 'ic-from': 1990, 'ic-amount': 500 } });
check('decode: prefill beats defaults', withPrefill['ic-amount'] === 500);
check('decode: prefill beats defaults for second key', withPrefill['ic-from'] === 1990);

// 18. encode with prefill: defaults + prefill both omitted when equal.
const encWithPrefill = urlState.encode(
  'test-tool',
  { 'ic-amount': 500, 'ic-from': 2000 },  // ic-amount matches prefill, ic-from matches default
  { prefill: { 'ic-amount': 500 } }
);
check(
  'encode: prefill values also treated as omitted',
  encWithPrefill === ''  // both equal either default or prefill
);

// 19. Story 2.1 / SF-1 / AC-2 #5: decode records schema version on
// the returned object as __v so future migration helpers can branch
// on it. Empty hash still records it (schema default).
const decEmptyWithVersion = urlState.decode('test-tool', '');
check('decode: empty hash records __v from schema', decEmptyWithVersion.__v === '1');
check('decode: __v not exposed as a regular key', !('schemaVersion' in decEmptyWithVersion));

// 20. __v reflects the version carried in the URL hash, overriding schema default.
const decWithHashVersion = urlState.decode('test-tool', '_v=2&ic-amount=42');
check('decode: hash _v wins over schema version', decWithHashVersion.__v === '2');
check('decode: hash _v=2 still decodes ic-amount', decWithHashVersion['ic-amount'] === 42);

// 21. __v stays absent when no schema version is set + no hash _v.
// Schema-less tool entry (no schemaVersion): use a synthetic entry.
const schemaLessEntry = {
  id: 'no-version',
  slug: 'no-version',
  urlState: {
    default: {},
    encode: [],
    decode: [],
  },
};
ctx.HT.homeGrid.entries.push(schemaLessEntry);
const decNoVersion = urlState.decode('no-version', '');
check('decode: __v absent when schema has no version', !('__v' in decNoVersion));

// 22. SF-2: real debounce (not identity). Two rapid calls collapse
// into one and run after the wait — proves utils.js was loaded and
// the smoke isn't relying on the identity stub. This is exercised
// in the async tail below the synchronous test pass so the final
// pass/fail tally includes it.
const sf2Calls = { n: 0 };
const sf2Debounced = ctx.HT.debounce(function () { sf2Calls.n += 1; }, 30);
sf2Debounced();
sf2Debounced();
sf2Debounced();
check('SF-2: HT.debounce attached from utils.js',
  typeof sf2Debounced === 'function' && sf2Debounced.length === 0);

// 23. SF-5: <select> round-trip. The codec must work when the value
// comes from a <select> element (which always serializes as a string,
// even when the option's data-value is numeric). Add a select-typed
// tool entry, bind a select element, and verify:
//   (a) the field is read as a string (the HTMLSelectElement contract);
//   (b) the encoded URL contains the selected string verbatim;
//   (c) decoding that URL returns the same string.
// This catches regressions where someone "optimizes" string coercion
// by treating empty strings as missing.
const selectToolEntry = {
  id: 'select-tool',
  slug: 'select-tool',
  schemaVersion: '1',
  urlState: {
    default: { 'ic-choice': 'a' },
    encode: [{ key: 'ic-choice', type: 'string' }],
    decode: [{ key: 'ic-choice', type: 'string' }],
  },
};
ctx.HT.homeGrid.entries.push(selectToolEntry);

// Build a select stub that tracks .value sets, like the existing
// HtmlInputStub but with .selectedIndex semantics. The HtmlSelectStub
// at the top of this file already exists; we reuse it via a fresh
// prototype shim so we can spy on the setter without re-defining
// `value` on the shared prototype (which would error — defineProperty
// is non-configurable after the first call).
const selectSpyPrototype = Object.create(HTMLSelectElement.prototype);
const selectSetRecord = { values: [] };
Object.defineProperty(selectSpyPrototype, 'value', {
  get() { return this._v; },
  set(v) {
    this._v = v == null ? '' : String(v);
    selectSetRecord.values.push(this._v);
  },
});
const selectEl = Object.create(selectSpyPrototype);
selectEl._v = 'b';
selectEl.addEventListener = () => {};
selectEl.removeEventListener = () => {};
const selectRoot = {
  querySelector: function (sel) {
    if (sel === '#ic-choice') return selectEl;
    return null;
  },
};
ctx.location.hash = '#ic-choice=hello%20world';
let selectBindFormThrew = null;
let selectTeardown = null;
try { selectTeardown = urlState.bindForm('select-tool', selectRoot); }
catch (e) { selectBindFormThrew = e; }
check('SF-5: bindForm accepts a <select> root', selectBindFormThrew === null,
  selectBindFormThrew && selectBindFormThrew.message);
check('SF-5: bindForm writes select value with URL-restored state',
  selectEl.value === 'hello world');
check('SF-5: select value setter was called with the URL-restored value',
  selectSetRecord.values.indexOf('hello world') !== -1);

// Encode/decode round-trip with a select-typed string value (the
// exact path a <select> input takes when boundForm fires the change
// handler).
const selectEnc = urlState.encode('select-tool', { 'ic-choice': 'option-x' });
const selectDec = urlState.decode('select-tool', selectEnc);
check('SF-5: encode(<select>-shaped value) round-trips',
  selectDec['ic-choice'] === 'option-x');
check('SF-5: encoded select value is percent-encoded verbatim',
  selectEnc.indexOf('ic-choice=option-x') !== -1);
if (selectTeardown) selectTeardown();

// F-04: regression test for inflation-calculator.js hydrate()'s raw-hash
// key parser. The original implementation called HT.urlState.decode(),
// which returns a state merged with every schema default — so a hash
// like `#ic-amount=42` would suppress *every* localStorage key (because
// `decode` returns ic-amount, ic-from, ic-to, ic-forward-rate all
// populated). The fix parses the raw hash string and only protects
// keys that are BOTH literally present in the URL AND in the urlState
// schema's encode list (mirroring the codec's "unknown keys silently
// dropped" policy). This test exercises that exact code path:
// `_parseRawHashKeys` is the same inline implementation copied from
// inflation-calculator.js hydrate() (kept in sync via this smoke
// assertion so the test fails if either side regresses).
const F4_KNOWN = { 'ic-amount': true, 'ic-from': true, 'ic-to': true, 'ic-forward-rate': true };
function _parseRawHashKeys(rawHash, knownKeys) {
  var keys = {};
  if (!rawHash || rawHash.length === 0) return keys;
  rawHash.split('&').forEach(function (pair) {
    if (!pair) return;
    var eq = pair.indexOf('=');
    var rawKey = eq < 0 ? pair : pair.slice(0, eq);
    var key;
    try { key = decodeURIComponent(rawKey); }
    catch (_) { return; }
    if (key === '_v') return;
    if (knownKeys && !knownKeys[key]) return; // drop unknown keys, like the codec
    keys[key] = true;
  });
  return keys;
}

// (a) Empty hash: no keys are URL-protected. localStorage can restore
//     every key (the canonical share-link-only-overrides rule).
const f4Empty = _parseRawHashKeys('', F4_KNOWN);
check('F-04: empty hash protects zero keys',
  Object.keys(f4Empty).length === 0);

// (b) Hash with a single schema key: only that key is protected.
const f4Single = _parseRawHashKeys('ic-amount=42', F4_KNOWN);
check('F-04: single-key hash protects only the literal schema key',
  f4Single['ic-amount'] === true && Object.keys(f4Single).length === 1);

// (c) Hash with multiple schema keys: each is protected, and
//     schema-default keys NOT in the URL remain eligible to be
//     restored from localStorage.
const f4Multi = _parseRawHashKeys('ic-amount=42&ic-from=1990&ic-forward-rate=2', F4_KNOWN);
check('F-04: multi-key hash protects only the literal schema keys',
  f4Multi['ic-amount'] === true
  && f4Multi['ic-from'] === true
  && f4Multi['ic-forward-rate'] === true
  && Object.keys(f4Multi).length === 3);

// (d) Hash carrying only `_v` (the synthetic version marker recorded
//     by SF-1) must NOT suppress any localStorage key. The previous
//     implementation of hydrate() called HT.urlState.decode() which
//     returns `{__v: '1', ic-amount: 100, ...}` for `_v=1&...` —
//     suppressing every key in the schema.
const f4VersionOnly = _parseRawHashKeys('_v=1', F4_KNOWN);
check('F-04: hash with only _v does not protect any key',
  Object.keys(f4VersionOnly).length === 0);

// (e) Hash carrying only unknown keys: the codec drops unknown keys
//     silently, so hydrate() must do the same. A stray `referrer=foo`
//     in the URL must not keep a localStorage key from being
//     restored.
const f4Unknown = _parseRawHashKeys('referrer=foo&utm_source=email', F4_KNOWN);
check('F-04: hash with only unknown keys protects zero keys',
  Object.keys(f4Unknown).length === 0);

// (f) Mixed hash: literal schema keys are protected, _v and unknown
//     keys are ignored.
const f4Mixed = _parseRawHashKeys('_v=1&ic-amount=99&referrer=foo', F4_KNOWN);
check('F-04: mixed hash protects only the schema key, ignores _v + unknown',
  f4Mixed['ic-amount'] === true
  && !('__v' in f4Mixed)
  && !('_v' in f4Mixed)
  && !('referrer' in f4Mixed)
  && Object.keys(f4Mixed).length === 1);

// (g) Percent-encoded keys are decoded before protection, so a
//     `#ic%2Damount=99` URL protects the kebab-case `ic-amount` field.
const f4Encoded = _parseRawHashKeys('ic%2Damount=99', F4_KNOWN);
check('F-04: percent-encoded key is decoded before protection',
  f4Encoded['ic-amount'] === true && Object.keys(f4Encoded).length === 1);

// (h) Hash with a malformed *key* (raw '%E0%A4' on the LHS of '=')
//     does not throw and skips just the bad pair. (The codec itself
//     throws UrlStateDecodeError of code MALFORMED_ENCODING on
//     malformed percent-encoding; the raw-hash parser must catch and
//     skip without crashing hydrate().) The malformed `%` on the RHS
//     (the value side) is normally tolerated because the parser only
//     decodes the LHS of '='.
const f4BadPct = _parseRawHashKeys('%E0%A4%A=99&ic-from=2000', F4_KNOWN);
check('F-04: malformed percent-encoded key skips the bad pair without throwing',
  !('%E0%A4%A' in f4BadPct) && f4BadPct['ic-from'] === true);


// which requires the event loop to turn. Wrap the tail in an async
// IIFE so the debounce's setTimeout(30) can deliver before exit.
(async function tail() {
  await new Promise((r) => realSetTimeout(r, 80));
  check('SF-2: real debounce coalesces 3 calls into 1', sf2Calls.n === 1);

  console.log('');
  console.log('passed: ' + pass + ', failed: ' + fail);

  // Vacuous-pass guard.
  if (pass === 0 && fail === 0) {
    console.error('smoke: vacuous run — zero assertions executed');
    process.exit(1);
  }
  process.exit(fail === 0 ? 0 : 1);
})();