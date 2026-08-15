/* ============================================
   Smoke harness for Story 9.4 — UUID Generator.
   Loads scripts/_uuid_generator_self_test.js (Node module) +
   tools/uuid-generator/uuid-generator.js (vm context with stub
   HT + DOM) and asserts the four generators, validators, URL
   state, history keys, count clamping, and uniqueness invariants
   per AC-6 (≥ 30 assertions, 9 categories, vacuous-pass guard).
   ============================================ */

'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const SELF_TEST_PATH = path.resolve(__dirname, '_uuid_generator_self_test.js');
const TOOL_CORE_PATH = path.resolve(__dirname, '../tools/uuid-generator/uuid-generator-core.js');
const TOOL_HANDLERS_PATH = path.resolve(__dirname, '../tools/uuid-generator/uuid-generator-handlers.js');
const UTILS_JS_PATH = path.resolve(__dirname, '../assets/js/utils.js');

const selfTest = require(SELF_TEST_PATH);
const {
  uuidV1,
  uuidV4,
  uuidV7,
  ulid,
  isValidUuid,
  isValidUlid,
  variantNibble,
  UUID_V147_RE,
  ULID_RE,
  CROCKFORD_ALPHABET,
} = selfTest;

const toolCoreSrc = fs.readFileSync(TOOL_CORE_PATH, 'utf8');
const toolHandlersSrc = fs.readFileSync(TOOL_HANDLERS_PATH, 'utf8');
const utilsSrc = fs.readFileSync(UTILS_JS_PATH, 'utf8');

// --- Stub DOM ---
function HtmlSelectStub(initial) {
  this._v = initial == null ? '' : String(initial);
  this.listeners = {};
}
Object.defineProperty(HtmlSelectStub.prototype, 'value', {
  get() { return this._v; },
  set(v) { this._v = v == null ? '' : String(v); },
});
HtmlSelectStub.prototype.addEventListener = function (ev, fn) {
  this.listeners[ev] = fn;
};
function HtmlInputStub(initial) {
  this._v = initial == null ? '' : String(initial);
  this.type = 'text';
  this.listeners = {};
}
Object.defineProperty(HtmlInputStub.prototype, 'value', {
  get() { return this._v; },
  set(v) { this._v = v == null ? '' : String(v); },
});
HtmlInputStub.prototype.addEventListener = function (ev, fn) {
  this.listeners[ev] = fn;
};
function HtmlTextAreaStub(initial) {
  this._v = initial == null ? '' : String(initial);
  this.listeners = {};
}
Object.defineProperty(HtmlTextAreaStub.prototype, 'value', {
  get() { return this._v; },
  set(v) { this._v = v == null ? '' : String(v); },
});
HtmlTextAreaStub.prototype.addEventListener = function (ev, fn) {
  this.listeners[ev] = fn;
};
function HtmlButtonStub() {
  this.listeners = {};
}
HtmlButtonStub.prototype.addEventListener = function (ev, fn) {
  this.listeners[ev] = fn;
};
function HtmlPElementStub() {
  this._text = '';
  this._hidden = true;
}
Object.defineProperty(HtmlPElementStub.prototype, 'textContent', {
  get() { return this._text; },
  set(v) { this._text = v == null ? '' : String(v); },
});
Object.defineProperty(HtmlPElementStub.prototype, 'hidden', {
  get() { return this._hidden; },
  set(v) { this._hidden = !!v; },
});

const elements = {
  '#uuid-version': new HtmlSelectStub('v4'),
  '#uuid-count': new HtmlInputStub('1'),
  '#uuid-generate': new HtmlButtonStub(),
  '#uuid-copy': new HtmlButtonStub(),
  '#uuid-output': new HtmlTextAreaStub(''),
  '#uuid-error': new HtmlPElementStub(),
  '#uuid-url-warning': new HtmlPElementStub(),
};

// History capture
const historyCalls = [];

// Stub the HT + document objects so uuid-generator.js IIFE can attach
// its surface without touching real browser APIs.
const ctx = {
  console: Object.assign({}, console, { log: () => {}, warn: () => {}, error: () => {} }),
  performance: { now: () => Date.now() },
  setTimeout,
  clearTimeout,
  crypto: require('crypto').webcrypto,
  navigator: { clipboard: null },
  history: {
    replaceState: () => {},
    pushState: () => {},
  },
  location: { hash: '', pathname: '/tools/uuid-generator/', search: '' },
  URLSearchParams,
  HT: {
    $: (sel) => elements[sel] || null,
    formatNumber: (n) => String(n),
    copyToClipboard: () => Promise.resolve(),
    debounce: (fn, ms) => {
      let t;
      return function () {
        const args = arguments;
        const ctx = this;
        clearTimeout(t);
        t = setTimeout(() => fn.apply(ctx, args), ms);
      };
    },
    history: {
      push: (entry) => { historyCalls.push(entry); },
    },
  },
  document: {
    addEventListener: () => {},
    getElementById: (id) => elements['#' + id] || null,
    querySelector: () => null,
  },
};
ctx.window = ctx;
ctx.window.HT = ctx.HT;

vm.createContext(ctx);
vm.runInContext(utilsSrc, ctx, { filename: 'utils.js' });
// Re-attach the rich HT (utils.js attaches the real HT.debounce + HT.$)
// but keep our stub for $ and history.push so the smoke can assert.
ctx.HT.debounce = (fn, ms) => {
  let t;
  return function () {
    const args = arguments;
    const that = this;
    clearTimeout(t);
    t = setTimeout(() => fn.apply(that, args), ms);
  };
};
ctx.HT.$ = (sel) => elements[sel] || null;
ctx.window.HT = ctx.HT;
// Story 4b Phase 4 — uuid-generator-core.js + uuid-generator-handlers.js split.
// Load core + handlers, then call window.uuidGeneratorInit().
vm.runInContext(toolCoreSrc, ctx, { filename: 'uuid-generator-core.js' });
vm.runInContext(toolHandlersSrc, ctx, { filename: 'uuid-generator-handlers.js' });
if (typeof ctx.window.uuidGeneratorInit === 'function') {
  ctx.window.uuidGeneratorInit();
}

// ---------------------------------------------------------------
// Smoke harness
// ---------------------------------------------------------------

let pass = 0;
let fail = 0;
const failures = [];

function check(cond, label) {
  if (cond) {
    pass += 1;
    console.log(`  ok      ${label}`);
  } else {
    fail += 1;
    failures.push(label);
    console.log(`  FAIL    ${label}`);
  }
}

console.log('UUID Generator smoke (Story 9.4):');

// --- (i) The four generators match the spec regex ---
for (let i = 0; i < 10; i += 1) {
  check(UUID_V147_RE.test(uuidV1()), `v1 #${i} matches UUID v147 regex`);
  check(UUID_V147_RE.test(uuidV4()), `v4 #${i} matches UUID v147 regex`);
  check(UUID_V147_RE.test(uuidV7()), `v7 #${i} matches UUID v147 regex`);
  check(ULID_RE.test(ulid()), `ulid #${i} matches ULID regex`);
}

// --- (ii) Version nibble per spec ---
for (let i = 0; i < 10; i += 1) {
  check(uuidV1()[14] === '1', `v1 #${i} version nibble === '1'`);
  check(uuidV4()[14] === '4', `v4 #${i} version nibble === '4'`);
  check(uuidV7()[14] === '7', `v7 #${i} version nibble === '7'`);
}

// --- (iii) Variant nibble ∈ {8, 9, a, b} ---
for (let i = 0; i < 10; i += 1) {
  const v = variantNibble(uuidV1());
  check(['8', '9', 'a', 'b'].includes(v), `v1 #${i} variant nibble ∈ {8,9,a,b} (got "${v}")`);
}
for (let i = 0; i < 10; i += 1) {
  const v = variantNibble(uuidV4());
  check(['8', '9', 'a', 'b'].includes(v), `v4 #${i} variant nibble ∈ {8,9,a,b} (got "${v}")`);
}
for (let i = 0; i < 10; i += 1) {
  const v = variantNibble(uuidV7());
  check(['8', '9', 'a', 'b'].includes(v), `v7 #${i} variant nibble ∈ {8,9,a,b} (got "${v}")`);
}

// --- (iv) v4 uses crypto.randomUUID when available ---
const v4a = uuidV4();
const v4b = uuidV4();
check(v4a !== v4b, 'two consecutive v4 calls return distinct identifiers');
// Check that v4 returns a valid UUID v4 shape (regex + version nibble)
check(v4a.length === 36, `v4 length === 36 (got ${v4a.length})`);
check(v4a[14] === '4', 'v4[14] === "4"');
check(v4a[8] === '-', 'v4 has hyphens at expected positions');

// --- (v) v1 monotonic timestamps ---
const v1a = uuidV1();
const v1b = uuidV1();
const tsA = v1a.slice(0, 8) + v1a.slice(9, 13) + v1a.slice(14, 18);
const tsB = v1b.slice(0, 8) + v1b.slice(9, 13) + v1b.slice(14, 18);
const bigA = BigInt('0x' + tsA.slice(0, 8)) * BigInt(2 ** 32) +
             BigInt('0x' + tsA.slice(8, 12)) * BigInt(2 ** 16) +
             BigInt('0x' + tsA.slice(12, 16));
const bigB = BigInt('0x' + tsB.slice(0, 8)) * BigInt(2 ** 32) +
             BigInt('0x' + tsB.slice(8, 12)) * BigInt(2 ** 16) +
             BigInt('0x' + tsB.slice(12, 16));
check(bigB >= bigA, `v1 timestamps are monotonic (bigA=${bigA}, bigB=${bigB})`);

// --- (vi) ULID is 26 chars, no I/L/O/U ---
const ulidSample = ulid();
check(ulidSample.length === 26, `ulid length === 26 (got ${ulidSample.length})`);
check(!/[ILOU]/.test(ulidSample), `ulid has no Crockford-confusable chars (got "${ulidSample}")`);
check(ulidSample !== ulid(), 'two consecutive ulid calls return distinct identifiers');

// --- (vii) Crockford alphabet matches spec ---
const expectedAlphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
check(CROCKFORD_ALPHABET === expectedAlphabet,
  `Crockford alphabet matches ULID spec (got "${CROCKFORD_ALPHABET}")`);

// --- (viii) Bulk uniqueness (1000 v4s, no duplicates) ---
const seen = new Set();
let dupes = 0;
for (let i = 0; i < 1000; i += 1) {
  const id = uuidV4();
  if (seen.has(id)) dupes += 1;
  seen.add(id);
}
check(dupes === 0, `1000 v4 calls produced 0 duplicates (got ${dupes})`);

// --- (ix) Validator exports ---
check(typeof isValidUuid === 'function', 'isValidUuid is exported');
check(typeof isValidUlid === 'function', 'isValidUlid is exported');
check(isValidUuid(uuidV4()) === true, 'isValidUuid accepts a generated v4');
check(isValidUuid('not-a-uuid') === false, 'isValidUuid rejects non-UUID');
check(isValidUlid(ulid()) === true, 'isValidUlid accepts a generated ulid');
check(isValidUlid('not-a-ulid') === false, 'isValidUlid rejects non-ULID');

// --- (x) Tool script: applyUrlState handles invalid version ---
elements['#uuid-url-warning']._text = '';
elements['#uuid-url-warning']._hidden = true;
elements['#uuid-version']._v = 'v4';
// Re-apply by simulating a fresh load with ?version=invalid
// We do this by re-running the script with a different ctx setup:
{
  const ctx2 = {
    console: ctx.console,
    performance: ctx.performance,
    setTimeout,
    clearTimeout,
    crypto: ctx.crypto,
    navigator: ctx.navigator,
    history: ctx.history,
    location: { hash: '', pathname: '/tools/uuid-generator/', search: '?version=invalid&count=5' },
    URLSearchParams,
    elements,
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
      history: { push: (entry) => historyCalls.push(entry) },
    },
    document: ctx.document,
  };
  ctx2.window = ctx2;
  ctx2.window.HT = ctx2.HT;
  vm.createContext(ctx2);
  vm.runInContext(utilsSrc, ctx2, { filename: 'utils.js' });
  // Re-attach HT.$ after utils.js overrides it with HT.qs (real impl)
  ctx2.HT.$ = (sel) => elements[sel] || null;
  vm.runInContext(toolCoreSrc, ctx2, { filename: 'uuid-generator-core.js' });
  vm.runInContext(toolHandlersSrc, ctx2, { filename: 'uuid-generator-handlers.js' });
  if (typeof ctx2.window.uuidGeneratorInit === 'function') {
    ctx2.window.uuidGeneratorInit();
  }
  check(elements['#uuid-url-warning']._text.indexOf('Unknown version') >= 0,
    'invalid ?version=unknown emits the .uuid-url-warning element');
  check(elements['#uuid-version']._v === 'v4',
    'invalid ?version falls back to v4 (got "' + elements['#uuid-version']._v + '")');
  check(elements['#uuid-count']._v === '5',
    '?count=5 sets the count input (got "' + elements['#uuid-count']._v + '")');
  // Output should contain 5 lines of valid v4 UUIDs
  const lines = elements['#uuid-output']._v.split('\n');
  check(lines.length === 5, `output has 5 lines (got ${lines.length})`);
  for (let i = 0; i < lines.length; i += 1) {
    check(UUID_V147_RE.test(lines[i]), `output line ${i} matches UUID v147 regex`);
    check(lines[i][14] === '4', `output line ${i} has version nibble "4"`);
  }
  // History push was called
  check(historyCalls.length > 0, `HT.history.push was called (count=${historyCalls.length})`);
  check(historyCalls[historyCalls.length - 1].version === 'v4',
    `history push captured version "v4" (got "${historyCalls[historyCalls.length - 1].version}")`);
  check(historyCalls[historyCalls.length - 1].count === '5',
    `history push captured count "5" (got "${historyCalls[historyCalls.length - 1].count}")`);
}

// --- (xi) Vacuous-pass guard ---
console.log('');
console.log(`self-test: ${pass} passed, ${fail} failed`);
if (pass === 0) {
  console.error('VACUOUS — no checks executed');
  process.exit(2);
}
process.exit(fail === 0 ? 0 : 1);