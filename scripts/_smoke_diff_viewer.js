/* ============================================
   Smoke harness for Story 9.3 — Diff Viewer.
   Loads assets/js/diff.js (Node-side exports) +
   tools/diff-viewer/diff-viewer.js (vm context
   with stub HT + DOM) and asserts:
   (i)   myersDiff with simple arrays
   (ii)  empty inputs return []
   (iii) one-sided deletes/inserts
   (iv)  multi-line insert
   (v)   splitLines / splitWords / splitChars
   (vi)  word-granularity diff
   (vii) char-granularity diff
   (viii) URL state via ?a=<base64>&b=<base64>
   (ix)  base64 round-trip with non-ASCII
   (x)   invalid granularity falls back to line
   (xi)  smoke imports HT.diff (no duplication)
   (xii) vacuous-pass guard

   Per AC-7: ≥ 25 assertions, 15 categories,
   vacuous-pass guard.
   ============================================ */

'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const DIFF_JS_PATH = path.resolve(__dirname, '../assets/js/diff.js');
const TOOL_JS_PATH = path.resolve(__dirname, '../tools/diff-viewer/diff-viewer.js');
const UTILS_JS_PATH = path.resolve(__dirname, '../assets/js/utils.js');

const diffSrc = fs.readFileSync(DIFF_JS_PATH, 'utf8');
const toolSrc = fs.readFileSync(TOOL_JS_PATH, 'utf8');
const utilsSrc = fs.readFileSync(UTILS_JS_PATH, 'utf8');

const diff = require(DIFF_JS_PATH);
const {
  myersDiff,
  splitLines,
  splitWords,
  splitChars,
  _myersDiff,
  _lcsDiff,
} = diff;

// ---------------------------------------------------------------
// Stub DOM
// ---------------------------------------------------------------

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

function HtmlButtonStub() {
  this.listeners = {};
}
HtmlButtonStub.prototype.addEventListener = function (ev, fn) {
  this.listeners[ev] = fn;
};

function HtmlDivStub() {
  this._innerHTML = '';
}
Object.defineProperty(HtmlDivStub.prototype, 'innerHTML', {
  get() { return this._innerHTML; },
  set(v) { this._innerHTML = v == null ? '' : String(v); },
});

function HtmlPElementStub() {
  this._text = '';
  this._className = '';
}
Object.defineProperty(HtmlPElementStub.prototype, 'textContent', {
  get() { return this._text; },
  set(v) { this._text = v == null ? '' : String(v); },
});
Object.defineProperty(HtmlPElementStub.prototype, 'className', {
  get() { return this._className; },
  set(v) { this._className = v == null ? '' : String(v); },
});

const statusEl = new HtmlPElementStub();
const outRegionEl = new HtmlDivStub();

const elements = {
  '#diff-a': new HtmlTextAreaStub(''),
  '#diff-b': new HtmlTextAreaStub(''),
  '#diff-granularity': new HtmlSelectStub('line'),
  '#diff-view': new HtmlSelectStub('side-by-side'),
  '#diff-swap': new HtmlButtonStub(),
  '#diff-clear': new HtmlButtonStub(),
  '#diff-output-region': outRegionEl,
  '#diff-status': statusEl,
};

// History capture
const historyCalls = [];

// ---------------------------------------------------------------
// vm context
// ---------------------------------------------------------------

const ctx = {
  console: Object.assign({}, console, { log: () => {}, warn: () => {}, error: () => {} }),
  performance: { now: () => Date.now() },
  setTimeout,
  clearTimeout,
  navigator: { clipboard: null },
  history: {
    replaceState: () => {},
    pushState: () => {},
  },
  location: { hash: '', pathname: '/tools/diff-viewer/', search: '' },
  URLSearchParams,
  btoa: (s) => Buffer.from(String(s), 'binary').toString('base64'),
  atob: (s) => Buffer.from(String(s), 'base64').toString('binary'),
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
    querySelector: () => null,
  },
};

ctx.window = ctx;
ctx.window.HT = ctx.HT;

vm.createContext(ctx);
vm.runInContext(utilsSrc, ctx, { filename: 'utils.js' });
ctx.HT.$ = (sel) => elements[sel] || null;
ctx.HT.history = { push: (entry) => { historyCalls.push(entry); } };
ctx.window.HT = ctx.HT;

// Load diff.js into the vm context so window.HT.diff is available
vm.runInContext(diffSrc, ctx, { filename: 'diff.js' });

// ---------------------------------------------------------------
// Helpers
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

function toBase64(s) {
  return Buffer.from(unescape(encodeURIComponent(String(s))), 'binary').toString('base64');
}

function fromBase64(s) {
  return decodeURIComponent(escape(Buffer.from(String(s), 'base64').toString('binary')));
}

console.log('Diff Viewer smoke (Story 9.3):');

// ---------------------------------------------------------------
// Category 1 — myersDiff simple case (spec assertion (i))
// ---------------------------------------------------------------

const r1 = myersDiff(['a', 'b', 'c'], ['a', 'x', 'c']);
check(r1.length === 4,
  `myersDiff ["a","b","c"] vs ["a","x","c"]: 4 ops (got ${r1.length})`);
check(r1[0].op === 'equal' && r1[0].value === 'a',
  'myersDiff: first op is equal "a"');
check(r1[1].op === 'delete' && r1[1].value === 'b',
  'myersDiff: second op is delete "b"');
check(r1[2].op === 'insert' && r1[2].value === 'x',
  'myersDiff: third op is insert "x"');
check(r1[3].op === 'equal' && r1[3].value === 'c',
  'myersDiff: fourth op is equal "c"');

// ---------------------------------------------------------------
// Category 2 — empty inputs (spec assertions (ii) (iii) (iv))
// ---------------------------------------------------------------

const r2 = myersDiff([], []);
check(Array.isArray(r2) && r2.length === 0,
  `myersDiff([],[]): returns [] (got ${r2.length})`);

const r3 = myersDiff(['a'], []);
check(r3.length === 1 && r3[0].op === 'delete' && r3[0].value === 'a',
  'myersDiff(["a"],[]): returns [{op:delete,value:"a"}]');

const r4 = myersDiff([], ['b']);
check(r4.length === 1 && r4[0].op === 'insert' && r4[0].value === 'b',
  'myersDiff([],["b"]): returns [{op:insert,value:"b"}]');

// ---------------------------------------------------------------
// Category 3 — multi-line insert (spec assertion (v))
// ---------------------------------------------------------------

const r5 = myersDiff(['a', 'b'], ['a', 'b', 'c']);
let r5Inserts = 0;
for (let i = 0; i < r5.length; i += 1) if (r5[i].op === 'insert') r5Inserts += 1;
check(r5Inserts === 1,
  `myersDiff(["a","b"],["a","b","c"]): 1 insert (got ${r5Inserts})`);
const r5Insert = r5.find(function (x) { return x.op === 'insert'; });
check(r5Insert && r5Insert.value === 'c',
  'myersDiff multi-line insert: inserted value is "c"');

// ---------------------------------------------------------------
// Category 4 — splitters (spec assertions (vi) (vii) (viii))
// ---------------------------------------------------------------

const sl1 = splitLines('a\nb\nc');
check(sl1.length === 3 && sl1[0] === 'a' && sl1[1] === 'b' && sl1[2] === 'c',
  'splitLines("a\\nb\\nc"): returns ["a","b","c"]');

const sl2 = splitLines('a\nb\n');
check(sl2.length === 2 && sl2[0] === 'a' && sl2[1] === 'b',
  'splitLines("a\\nb\\n"): trailing newline does not produce phantom blank');

const sl3 = splitLines('');
check(sl3.length === 0,
  'splitLines(""): returns []');

const sw1 = splitWords('hello world foo');
check(sw1.length === 5,
  `splitWords("hello world foo"): 5 tokens incl. whitespace (got ${sw1.length})`);
check(sw1[0] === 'hello' && sw1[1] === ' ' && sw1[2] === 'world' && sw1[3] === ' ' && sw1[4] === 'foo',
  'splitWords: preserves whitespace as tokens');

const sc1 = splitChars('abc');
check(sc1.length === 3 && sc1[0] === 'a' && sc1[1] === 'b' && sc1[2] === 'c',
  'splitChars("abc"): returns ["a","b","c"]');

// ---------------------------------------------------------------
// Category 5 — word-granularity diff (spec assertion (ix))
// ---------------------------------------------------------------

const wg1 = myersDiff(splitWords('the cat'), splitWords('the dog'));
check(wg1[0].op === 'equal' && wg1[0].value === 'the',
  'word-diff: first op is equal "the"');
check(wg1[1].op === 'equal' && wg1[1].value === ' ',
  'word-diff: second op is equal " " (whitespace preserved)');
check(wg1.find(function (x) { return x.op === 'delete' && x.value === 'cat'; }),
  'word-diff: includes delete "cat"');
check(wg1.find(function (x) { return x.op === 'insert' && x.value === 'dog'; }),
  'word-diff: includes insert "dog"');

// ---------------------------------------------------------------
// Category 6 — char-granularity diff (spec assertion (x))
// ---------------------------------------------------------------

const cg1 = myersDiff(splitChars('abc'), splitChars('axc'));
check(cg1.find(function (x) { return x.op === 'equal' && x.value === 'a'; }),
  'char-diff: includes equal "a"');
check(cg1.find(function (x) { return x.op === 'delete' && x.value === 'b'; }),
  'char-diff: includes delete "b"');
check(cg1.find(function (x) { return x.op === 'insert' && x.value === 'x'; }),
  'char-diff: includes insert "x"');
check(cg1.find(function (x) { return x.op === 'equal' && x.value === 'c'; }),
  'char-diff: includes equal "c"');

// ---------------------------------------------------------------
// Category 7 — base64 round-trip with non-ASCII (spec assertion (xii))
// ---------------------------------------------------------------

const nonAscii = 'héllo';
const b64 = toBase64(nonAscii);
check(b64.length > 0,
  `base64 round-trip: btoa produces output (got "${b64}")`);
const round = fromBase64(b64);
check(round === nonAscii,
  `base64 round-trip: "héllo" → "${b64}" → "${round}" (must equal original)`);

// Non-ASCII newline-containing string
const multiline = 'a\nb';
const m64 = toBase64(multiline);
check(m64.indexOf('\n') < 0,
  'base64 round-trip: newline character is base64-encoded (no raw \\n)');
check(fromBase64(m64) === multiline,
  'base64 round-trip: "a\\nb" round-trips correctly');

// ---------------------------------------------------------------
// Category 8 — URL state via ?a=&b=&granularity=&view= (spec (xi))
// ---------------------------------------------------------------

const aEnc = toBase64('a\nb');
const bEnc = toBase64('a\nc');
const ctx2 = {
  console: ctx.console,
  performance: ctx.performance,
  setTimeout,
  clearTimeout,
  navigator: ctx.navigator,
  history: ctx.history,
  location: { hash: '', pathname: '/tools/diff-viewer/', search: '?a=' + aEnc + '&b=' + bEnc + '&granularity=line&view=side-by-side' },
  URLSearchParams,
  btoa: ctx.btoa,
  atob: ctx.atob,
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
    history: { push: (entry) => { historyCalls.push(entry); } },
  },
  document: ctx.document,
};
ctx2.window = ctx2;
ctx2.window.HT = ctx2.HT;
vm.createContext(ctx2);
vm.runInContext(utilsSrc, ctx2, { filename: 'utils.js' });
ctx2.HT.$ = (sel) => elements[sel] || null;
ctx2.window.HT = ctx2.HT;
vm.runInContext(diffSrc, ctx2, { filename: 'diff.js' });
vm.runInContext(toolSrc, ctx2, { filename: 'diff-viewer.js' });

check(elements['#diff-a']._v === 'a\nb',
  `URL state: ?a sets textarea A to "a\\nb" (got "${elements['#diff-a']._v}")`);
check(elements['#diff-b']._v === 'a\nc',
  `URL state: ?b sets textarea B to "a\\nc" (got "${elements['#diff-b']._v}")`);
check(elements['#diff-granularity']._v === 'line',
  'URL state: ?granularity=line sets the granularity select');
check(elements['#diff-view']._v === 'side-by-side',
  'URL state: ?view=side-by-side sets the view select');
check(outRegionEl._innerHTML.indexOf('diff-side-by-side') >= 0,
  'render: URL state applied → side-by-side table rendered');

// ---------------------------------------------------------------
// Category 9 — invalid granularity falls back to line (spec (xiii))
// ---------------------------------------------------------------

elements['#diff-granularity']._v = 'line';
elements['#diff-view']._v = 'side-by-side';
elements['#diff-a']._v = '';
elements['#diff-b']._v = '';

const ctx3 = {
  console: ctx.console,
  performance: ctx.performance,
  setTimeout,
  clearTimeout,
  navigator: ctx.navigator,
  history: ctx.history,
  location: { hash: '', pathname: '/tools/diff-viewer/', search: '?granularity=foo&view=unified' },
  URLSearchParams,
  btoa: ctx.btoa,
  atob: ctx.atob,
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
    history: { push: (entry) => { historyCalls.push(entry); } },
  },
  document: ctx.document,
};
ctx3.window = ctx3;
ctx3.window.HT = ctx3.HT;
vm.createContext(ctx3);
vm.runInContext(utilsSrc, ctx3, { filename: 'utils.js' });
ctx3.HT.$ = (sel) => elements[sel] || null;
ctx3.window.HT = ctx3.HT;
vm.runInContext(diffSrc, ctx3, { filename: 'diff.js' });
vm.runInContext(toolSrc, ctx3, { filename: 'diff-viewer.js' });

check(elements['#diff-granularity']._v === 'line',
  `URL state: ?granularity=foo falls back to "line" (got "${elements['#diff-granularity']._v}")`);
check(elements['#diff-view']._v === 'unified',
  'URL state: ?view=unified is honored');

// ---------------------------------------------------------------
// Category 10 — empty inputs render empty-state message
// ---------------------------------------------------------------

elements['#diff-a']._v = '';
elements['#diff-b']._v = '';
elements['#diff-granularity']._v = 'line';
elements['#diff-view']._v = 'side-by-side';

const ctx4 = {
  console: ctx.console,
  performance: ctx.performance,
  setTimeout,
  clearTimeout,
  navigator: ctx.navigator,
  history: ctx.history,
  location: { hash: '', pathname: '/tools/diff-viewer/', search: '' },
  URLSearchParams,
  btoa: ctx.btoa,
  atob: ctx.atob,
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
    history: { push: (entry) => { historyCalls.push(entry); } },
  },
  document: ctx.document,
};
ctx4.window = ctx4;
ctx4.window.HT = ctx4.HT;
vm.createContext(ctx4);
vm.runInContext(utilsSrc, ctx4, { filename: 'utils.js' });
ctx4.HT.$ = (sel) => elements[sel] || null;
ctx4.window.HT = ctx4.HT;
vm.runInContext(diffSrc, ctx4, { filename: 'diff.js' });
vm.runInContext(toolSrc, ctx4, { filename: 'diff-viewer.js' });

check(outRegionEl._innerHTML.indexOf('diff-empty') >= 0,
  'render: empty inputs show <p class="diff-empty">');

// ---------------------------------------------------------------
// Category 11 — Swap button (s key)
// ---------------------------------------------------------------

elements['#diff-a']._v = 'apple';
elements['#diff-b']._v = 'banana';
elements['#diff-swap'].listeners['click']();
check(elements['#diff-a']._v === 'banana',
  `swap: A becomes "banana" (got "${elements['#diff-a']._v}")`);
check(elements['#diff-b']._v === 'apple',
  `swap: B becomes "apple" (got "${elements['#diff-b']._v}")`);

// ---------------------------------------------------------------
// Category 12 — smoke imports HT.diff from assets/js/diff.js
//   (no duplication with Story 9.1 JSON formatter smoke)
// ---------------------------------------------------------------

check(typeof myersDiff === 'function',
  'module exports: myersDiff is a function');
check(typeof splitLines === 'function',
  'module exports: splitLines is a function');
check(typeof splitWords === 'function',
  'module exports: splitWords is a function');
check(typeof splitChars === 'function',
  'module exports: splitChars is a function');
check(typeof _myersDiff === 'function',
  'module exports: _myersDiff is exposed for smoke harness internals');
check(typeof _lcsDiff === 'function',
  'module exports: _lcsDiff is exposed for smoke harness internals');

// Verify the vm context sees HT.diff
check(typeof ctx.HT.diff === 'object' && ctx.HT.diff !== null,
  'browser surface: window.HT.diff is an object in vm context');
check(typeof ctx.HT.diff.myersDiff === 'function',
  'browser surface: window.HT.diff.myersDiff is a function');

// ---------------------------------------------------------------
// Vacuous-pass guard
// ---------------------------------------------------------------

console.log('');
console.log(`self-test: ${pass} passed, ${fail} failed`);
if (pass === 0) {
  console.error('VACUOUS — no checks executed');
  process.exit(2);
}
process.exit(fail === 0 ? 0 : 1);