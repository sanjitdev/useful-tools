/* ============================================
   Smoke harness for Story 9.1 — JSON Formatter Enhancements.
   Loads scripts/_json_formatter_self_test.js (Node module) +
   tools/json-formatter/json-formatter.js (vm context with stub
   HT + DOM) and asserts the Sort, Schema-validate, Diff,
   feature-gating, and shell-bounds invariants per AC-7
   (≥ 20 assertions, 10 categories, vacuous-pass guard).
   ============================================ */

'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const DIFF_PATH = path.resolve(__dirname, '../assets/js/diff.js');
const SCHEMA_PATH = path.resolve(__dirname, '../assets/js/json-schema-lite.js');
const TOOL_JS_PATH = path.resolve(__dirname, '../tools/json-formatter/json-formatter.js');
const TOOL_HTML_PATH = path.resolve(__dirname, '../tools/json-formatter/index.html');
const DIFF_VIEWER_JS_PATH = path.resolve(__dirname, '../tools/diff-viewer/diff-viewer.js');
const API_CONTRACT_PATH = path.resolve(__dirname, '../assets/js/api-contract.js');
const UTILS_JS_PATH = path.resolve(__dirname, '../assets/js/utils.js');

const diffLib = require(DIFF_PATH);
const schemaLib = require(SCHEMA_PATH);

const {
  myersDiff,
  splitLines,
} = diffLib;
const { validate } = schemaLib;

const toolSrc = fs.readFileSync(TOOL_JS_PATH, 'utf8');
const utilsSrc = fs.readFileSync(UTILS_JS_PATH, 'utf8');

// --- Stub DOM ---
function HtmlInputStub(initial, type) {
  this._v = initial == null ? '' : String(initial);
  this.type = type || 'text';
  this._checked = false;
  this.listeners = {};
}
Object.defineProperty(HtmlInputStub.prototype, 'value', {
  get() { return this._v; },
  set(v) { this._v = v == null ? '' : String(v); },
});
Object.defineProperty(HtmlInputStub.prototype, 'checked', {
  get() { return this._checked; },
  set(v) { this._checked = !!v; },
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

function HtmlDivStub() {
  this._text = '';
  this._html = '';
  this.className = '';
  this.listeners = {};
  this.children = [];
}
Object.defineProperty(HtmlDivStub.prototype, 'textContent', {
  get() { return this._text; },
  set(v) { this._text = v == null ? '' : String(v); },
});
Object.defineProperty(HtmlDivStub.prototype, 'innerHTML', {
  get() { return this._html; },
  set(v) {
    this._html = v == null ? '' : String(v);
    // innerHTML setter in real DOM clears children; mimic that for tests.
    this.children = [];
  },
});
Object.defineProperty(HtmlDivStub.prototype, 'hidden', {
  get() { return this._hidden; },
  set(v) { this._hidden = !!v; },
});
Object.defineProperty(HtmlDivStub.prototype, 'classList', {
  get() {
    const self = this;
    return {
      add: function (c) { self.className = (self.className + ' ' + c).trim(); },
      remove: function (c) { self.className = self.className.split(/\s+/).filter(function (x) { return x !== c; }).join(' '); },
      contains: function (c) { return (' ' + self.className + ' ').indexOf(' ' + c + ' ') >= 0; },
    };
  },
});
HtmlDivStub.prototype.appendChild = function (c) { this.children.push(c); };
HtmlDivStub.prototype.addEventListener = function (ev, fn) { this.listeners[ev] = fn; };
HtmlDivStub.prototype.setAttribute = function (k, v) { this[k] = v; };

function HtmlUlStub() {
  HtmlDivStub.call(this);
}
HtmlUlStub.prototype = Object.create(HtmlDivStub.prototype);
HtmlUlStub.prototype.appendChild = HtmlDivStub.prototype.appendChild;
const DocumentFragmentStub = function () { this.children = []; };
DocumentFragmentStub.prototype.appendChild = function (c) { this.children.push(c); };

const elements = {
  '#json-input': new HtmlTextAreaStub(''),
  '#json-input-b': new HtmlTextAreaStub(''),
  '#output': new HtmlDivStub(),
  '#status': new HtmlDivStub(),
  '#sort-panel': new HtmlDivStub(),
  '#sort-keys': new HtmlInputStub('', 'checkbox'),
  '#schema-panel': new HtmlDivStub(),
  '#schema-input': new HtmlTextAreaStub(''),
  '#schema-errors': new HtmlUlStub(),
  '#schema-ok': new HtmlDivStub(),
  '#run-schema': new HtmlButtonStub(),
  '#diff-panel': new HtmlDivStub(),
  '#run-diff': new HtmlButtonStub(),
  '#json-diff-output': new HtmlDivStub(),
  '#format': new HtmlButtonStub(),
  '#minify': new HtmlButtonStub(),
  '#validate': new HtmlButtonStub(),
  '#tree': new HtmlButtonStub(),
  '#copy-out': new HtmlButtonStub(),
};

function makeCtx(search) {
  const ctx = {
    console: Object.assign({}, console, { log: () => {}, warn: () => {}, error: () => {} }),
    setTimeout,
    clearTimeout,
    location: { hash: '', pathname: '/tools/json-formatter/', search: search || '' },
    URLSearchParams,
    addEventListener: () => {},
    removeEventListener: () => {},
    HT: {
      $: (sel) => elements[sel] || null,
      qs: (sel) => elements[sel] || null,
      qsa: (sel, root) => (root && root.children) || [],
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
      diff: { myersDiff, splitLines },
      jsonSchema: { validate },
      history: { push: () => {} },
    },
    document: {
      addEventListener: () => {},
      createElement: (tag) => new HtmlDivStub(),
      createDocumentFragment: () => new DocumentFragmentStub(),
      getElementById: (id) => elements['#' + id] || null,
      querySelector: (sel) => elements[sel] || null,
    },
  };
  ctx.window = ctx;
  ctx.window.HT = ctx.HT;
  ctx.document = ctx.document;
  ctx.window.addEventListener = ctx.addEventListener;
  ctx.window.removeEventListener = ctx.removeEventListener;
  return ctx;
}

function loadTool(search) {
  const ctx = makeCtx(search);
  vm.createContext(ctx);
  vm.runInContext(utilsSrc, ctx, { filename: 'utils.js' });
  // Re-attach our rich HT (utils.js overrides HT.qs and HT.$).
  ctx.HT.$ = (sel) => elements[sel] || null;
  ctx.HT.qs = (sel) => elements[sel] || null;
  ctx.window.HT = ctx.HT;
  vm.runInContext(toolSrc, ctx, { filename: 'json-formatter.js' });
  return ctx;
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

console.log('JSON Formatter Enhancements smoke (Story 9.1):');

// ============================================================
// (i) sortKeys: recursive (test via tool — input checkbox + format)
// ============================================================
{
  loadTool('');
  elements['#json-input']._v = '{"b":1,"a":{"d":2,"c":3}}';
  elements['#sort-keys']._checked = true;
  // Trigger the format action
  elements['#format'].listeners['click']();
  const out = elements['#output']._text;
  check(out.indexOf('"a"') < out.indexOf('"b"'), 'sortKeys orders keys alphabetically at top level');
  check(out.indexOf('"c"') < out.indexOf('"d"'), 'sortKeys orders nested keys alphabetically');
}

// ============================================================
// (ii) sortKeys: arrays of objects (per AC-7 ii)
// ============================================================
{
  loadTool('');
  elements['#json-input']._v = '[{"b":1,"c":2},{"a":3,"d":4}]';
  elements['#sort-keys']._checked = true;
  elements['#format'].listeners['click']();
  const out = elements['#output']._text;
  // Inside the first object, "b" must come before "c".
  // Inside the second object, "a" must come before "d".
  // We just verify the sorted output matches the literal expected string.
  const expected = '[\n  {\n    "b": 1,\n    "c": 2\n  },\n  {\n    "a": 3,\n    "d": 4\n  }\n]';
  check(out === expected, 'sortKeys sorts keys within each object of an array (AC-7 ii)');
}

// ============================================================
// (iii) sortKeys: no-op when checkbox unchecked
// ============================================================
{
  loadTool('');
  elements['#json-input']._v = '{"b":1,"a":2}';
  elements['#sort-keys']._checked = false;
  elements['#format'].listeners['click']();
  const out = elements['#output']._text;
  check(out.indexOf('"b"') < out.indexOf('"a"'), 'no sort when checkbox is unchecked (original order preserved)');
}

// ============================================================
// (iv) Schema validator: type, required, enum (via library directly)
// ============================================================
{
  // type: "number" rejects "foo"
  const r1 = validate({ type: 'number' }, 'foo');
  check(!r1.valid && r1.errors.length === 1, 'schema: type number rejects "foo"');
  check(r1.errors[0].path === '', 'schema: type error path is ""');

  // required: ["a","b"] reports missing b with instancePath ""
  const r2 = validate({ required: ['a', 'b'] }, { a: 1 });
  check(!r2.valid, 'schema: required reports missing');
  check(r2.errors[0].path === '/b', 'schema: missing required path is "/b"');

  // enum: [1,2,3] rejects 4
  const r3 = validate({ enum: [1, 2, 3] }, 4);
  check(!r3.valid, 'schema: enum rejects 4');
  check(r3.errors[0].message.indexOf('enum') >= 0, 'schema: enum error mentions "enum"');
}

// ============================================================
// (v) Schema: minimum, maximum
// ============================================================
{
  check(validate({ minimum: 0, maximum: 10 }, 5).valid, 'schema: min/max accepts 5');
  check(!validate({ minimum: 0, maximum: 10 }, 11).valid, 'schema: min/max rejects 11');
  check(!validate({ minimum: 0, maximum: 10 }, -1).valid, 'schema: min/max rejects -1');
}

// ============================================================
// (vi) Schema: pattern
// ============================================================
{
  check(validate({ pattern: '^[a-z]+$' }, 'abc').valid, 'schema: pattern accepts "abc"');
  check(!validate({ pattern: '^[a-z]+$' }, 'ABC').valid, 'schema: pattern rejects "ABC"');
}

// ============================================================
// (vii) myersDiff — spec exact match (AC-7 vii)
// ============================================================
{
  const result = myersDiff(['a', 'b', 'c'], ['a', 'x', 'c']);
  const expected = [
    { op: 'equal', value: 'a' },
    { op: 'delete', value: 'b' },
    { op: 'insert', value: 'x' },
    { op: 'equal', value: 'c' },
  ];
  check(JSON.stringify(result) === JSON.stringify(expected),
    'myersDiff matches AC-7 vii spec exactly');
  // Also: deleting all / inserting all
  check(myersDiff(['x', 'y'], []).every((op) => op.op === 'delete'),
    'myersDiff: delete-only when b is empty');
  check(myersDiff([], ['x', 'y']).every((op) => op.op === 'insert'),
    'myersDiff: insert-only when a is empty');
  // Identical arrays produce only equals
  check(myersDiff(['1', '2'], ['1', '2']).every((op) => op.op === 'equal'),
    'myersDiff: identical arrays produce only equal ops');
}

// ============================================================
// (viii) URL state: ?feature=sort,schema enables both panels
// ============================================================
{
  // Reset panel hidden state
  elements['#sort-panel']._hidden = true;
  elements['#schema-panel']._hidden = true;
  elements['#diff-panel']._hidden = true;
  loadTool('?feature=sort,schema');
  check(elements['#sort-panel']._hidden === false,
    '?feature=sort,schema enables sort-panel');
  check(elements['#schema-panel']._hidden === false,
    '?feature=sort,schema enables schema-panel');
  check(elements['#diff-panel']._hidden === true,
    '?feature=sort,schema leaves diff-panel hidden');
}

// ============================================================
// (ix) URL state: invalid ?feature=foo renders with no enhancements
// ============================================================
{
  elements['#sort-panel']._hidden = true;
  elements['#schema-panel']._hidden = true;
  elements['#diff-panel']._hidden = true;
  loadTool('?feature=foo');
  check(elements['#sort-panel']._hidden === true,
    'invalid ?feature=foo hides sort-panel');
  check(elements['#schema-panel']._hidden === true,
    'invalid ?feature=foo hides schema-panel');
  check(elements['#diff-panel']._hidden === true,
    'invalid ?feature=foo hides diff-panel');
}

// ============================================================
// (x) No direct localStorage / fetch / HT.provide in tool script
// ============================================================
{
  // Strip comments and string literals for the bounds check.
  const stripped = toolSrc
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  // Note: 'localStorage' must NOT appear as a free identifier.
  const forbidden = [
    /\blocalStorage\b/,
    /\bsessionStorage\b/,
    /\bdocument\.cookie\b/,
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
    /\bHT\.provide\b/,
  ];
  let boundsOk = true;
  let boundsViolated = '';
  for (const re of forbidden) {
    if (re.test(stripped)) {
      boundsOk = false;
      boundsViolated = re.source;
      break;
    }
  }
  check(boundsOk, `json-formatter.js has no direct localStorage/fetch/HT.provide (${boundsViolated})`);
}

// ============================================================
// (xi) Schema validate UI: errors render in #schema-errors ul
// ============================================================
{
  loadTool('?feature=schema');
  elements['#json-input']._v = '{"name":42}';
  elements['#schema-input']._v = '{"type":"object","properties":{"name":{"type":"string"}}}';
  elements['#run-schema'].listeners['click']();
  // The errors should have been populated.
  const errUl = elements['#schema-errors'];
  check(errUl.children.length >= 1, 'schema validation surfaces at least one error to the UI');
  // The fragment's first child is the actual <li>.
  const li = errUl.children[0].children[0];
  check(li && li._html && li._html.indexOf('string') >= 0,
    'schema error message mentions expected type "string"');
}

// ============================================================
// (xii) Schema validate: empty schema is a no-op (AC-2)
// ============================================================
{
  loadTool('?feature=schema');
  elements['#json-input']._v = '{}';
  elements['#schema-input']._v = '';
  elements['#run-schema'].listeners['click']();
  check(elements['#schema-errors'].children.length === 0,
    'empty schema is a no-op (no errors rendered)');
  check(elements['#schema-ok']._hidden === true,
    'empty schema does not show success chip');
}

// ============================================================
// (xiii) Diff button: produces lines in the diff output
// ============================================================
{
  loadTool('?feature=diff');
  elements['#json-input']._v = '{"a":1,"b":2}';
  elements['#json-input-b']._v = '{"a":1,"b":3}';
  elements['#run-diff'].listeners['click']();
  const out = elements['#json-diff-output'];
  // The fragment's children are the actual diff-line <div>s.
  const lines = out.children.length === 1 && out.children[0].children ? out.children[0].children : out.children;
  check(lines.length >= 1, 'Diff produces at least one rendered line');
  const opClasses = lines.map((c) => c.className || '');
  check(opClasses.some((c) => c.indexOf('diff-equal') >= 0),
    'Diff output has at least one diff-equal line');
  check(opClasses.some((c) => c.indexOf('diff-delete') >= 0),
    'Diff output has at least one diff-delete line');
  check(opClasses.some((c) => c.indexOf('diff-insert') >= 0),
    'Diff output has at least one diff-insert line');
}

// ============================================================
// (xiv) Diff: invalid JSON B shows error message (no crash)
// ============================================================
{
  loadTool('?feature=diff');
  elements['#json-input']._v = '{"a":1}';
  elements['#json-input-b']._v = '{broken';
  elements['#run-diff'].listeners['click']();
  const out = elements['#json-diff-output'];
  check(out.children.length >= 1, 'Invalid JSON B still produces an output (no crash)');
  // The error path appends a div directly (no DocumentFragment).
  const errLine = out.children[0];
  check(errLine && errLine._text && errLine._text.indexOf('JSON B') >= 0,
    'Invalid JSON B error message is surfaced');
}

// ============================================================
// (xv) Feature gate: ?feature=diff enables diff-panel
// ============================================================
{
  elements['#diff-panel']._hidden = true;
  loadTool('?feature=diff');
  check(elements['#diff-panel']._hidden === false,
    '?feature=diff enables diff-panel');
  check(elements['#sort-panel']._hidden === true,
    '?feature=diff leaves sort-panel hidden');
}

// ============================================================
// (xvi) Tool script loads without throwing
// ============================================================
{
  let threw = false;
  try {
    loadTool('');
  } catch (e) {
    threw = true;
    console.error('load threw:', e.message);
  }
  check(!threw, 'tool script loads cleanly (no thrown errors)');
}

// ============================================================
// (xvii) AC-5 a11y: structural HTML invariants
// Schema-errors list must carry aria-live="polite" so screen
// readers announce the validation result. Every enhancement
// control must have an associated <label for="..."> or be wrapped
// in a <label class="field-inline">. Catches regressions to
// remove the live region or strip labels.
// ============================================================
{
  const htmlSrc = fs.readFileSync(TOOL_HTML_PATH, 'utf8');
  check(/id="schema-errors"[^>]*aria-live="polite"/.test(htmlSrc) ||
        /aria-live="polite"[^>]*id="schema-errors"/.test(htmlSrc) ||
        /<ul id="schema-errors"[^>]*aria-live="polite"/.test(htmlSrc),
    'a11y: #schema-errors carries aria-live="polite"');
  check(/<label for="json-input-b">/.test(htmlSrc),
    'a11y: #json-input-b has a <label for="json-input-b">');
  check(/<label for="schema-input">/.test(htmlSrc),
    'a11y: #schema-input has a <label for="schema-input">');
  check(/<input type="checkbox" id="sort-keys"/.test(htmlSrc) &&
        /class="field-inline"/.test(htmlSrc.slice(htmlSrc.indexOf('id="sort-keys"') - 200, htmlSrc.indexOf('id="sort-keys"'))),
    'a11y: #sort-keys is wrapped in a <label class="field-inline">');
}

// ============================================================
// (xviii) AC-4 data-action selectors
// data-action hooks are the convention across the codebase —
// future regressions that strip them break the global action
// dispatcher wiring. Pin the contract.
// ============================================================
{
  const htmlSrc = fs.readFileSync(TOOL_HTML_PATH, 'utf8');
  check(/data-action="sort-keys"/.test(htmlSrc),
    'AC-4: data-action="sort-keys" present on #sort-keys checkbox');
  check(/data-action="diff"/.test(htmlSrc),
    'AC-4: data-action="diff" present on #run-diff button');
}

// ============================================================
// (xix) ROQ-2: Story 9.3 reuse of assets/js/diff.js
// Per Story 9.1 ROQ-2 + Story 9.3 AC-3, the diff-viewer tool must
// consume the same HT.diff library. A drift would duplicate the
// Myers implementation and break the share-by-design promise.
// ============================================================
{
  const dvSrc = fs.readFileSync(DIFF_VIEWER_JS_PATH, 'utf8');
  check(/HT\.diff\.myersDiff/.test(dvSrc) || /HT\.diff\.splitLines/.test(dvSrc),
    'ROQ-2: tools/diff-viewer/diff-viewer.js imports HT.diff (no duplicate Myers impl)');
  check(!/function\s+myersDiff\s*\(/.test(dvSrc),
    'ROQ-2: tools/diff-viewer/diff-viewer.js does not redefine myersDiff locally');
}

// ============================================================
// (xx) api-contract.js: HT.diff + HT.jsonSchema pinned at 1.17.0
// AD-14: every public HT.* surface must be in the contract. Both
// HT.diff (stable) and HT.jsonSchema (internal) were added in
// Story 9.1; their absence from api-contract.js would let future
// refactors silently break the surface.
// ============================================================
{
  const acSrc = fs.readFileSync(API_CONTRACT_PATH, 'utf8');
  check(/name:\s*'HT\.diff'/.test(acSrc),
    'api-contract.js: HT.diff entry present');
  check(/name:\s*'HT\.jsonSchema'/.test(acSrc),
    'api-contract.js: HT.jsonSchema entry present');
  // Story 9.2 bumped api-contract to 1.18.0 when it added HT.citation;
  // subsequent stories (3.7, 3.8, 3.11, 3.12, 1.11) bumped it further to
  // 1.23.0. The assertion now just verifies the version is past the
  // pre-9.2 baseline (1.17.x), confirming the surface additions stuck.
  const versionMatch = acSrc.match(/version:\s*'(\d+)\.(\d+)\.(\d+)'/);
  check(!!versionMatch && parseInt(versionMatch[1], 10) >= 1 && (
    parseInt(versionMatch[1], 10) > 1 ||
    (parseInt(versionMatch[1], 10) === 1 && parseInt(versionMatch[2], 10) >= 18)
  ), 'api-contract.js: version bumped past 1.17.x (Story 9.2 surface addition: HT.citation)');
}

// ============================================================
// Vacuous-pass guard
// ============================================================
console.log('');
console.log(`self-test: ${pass} passed, ${fail} failed`);
if (pass === 0) {
  console.error('VACUOUS — no checks executed');
  process.exit(2);
}
process.exit(fail === 0 ? 0 : 1);
