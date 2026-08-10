/* ============================================
   Smoke harness for Story 2.2 — assets/js/sample-data.js.
   Loads url.js + sample-data.js in a fresh vm context
   with stub window/document/HT objects and asserts
   the HT.sampleData and HT.reset surfaces per
   api-contract.js (version 1.8.0 as of this writing —
   Story 2.2 standalone bumps 1.4.0 → 1.5.0; Story 2.4
   then bumps 1.5.0 → 1.6.0 to register the HT.a11y.*
   surface; Story 2.3 bumps 1.6.0 → 1.7.0 to register
   the HT.history.* surface; Story 2.5 bumps 1.7.0 → 1.8.0
   to register the HT.share.* surface).

   Loads url.js first because sample-data.js composes
   on HT.urlState._loadSchema (the same facade Story 2.1
   ships). The synthetic HT.homeGrid.entries fixture
   carries three slugs covering the merge, default-only,
   and absent cases.
   ============================================ */

'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const URL_SRC = fs.readFileSync(
  path.resolve(__dirname, '../assets/js/url.js'),
  'utf8'
);
const SAMPLE_SRC = fs.readFileSync(
  path.resolve(__dirname, '../assets/js/sample-data.js'),
  'utf8'
);
const UTILS_SRC = fs.readFileSync(
  path.resolve(__dirname, '../assets/js/utils.js'),
  'utf8'
);

// Synthetic HT.homeGrid.entries — three slugs covering the
// has-sample-and-default / default-only / none-of-either matrix.
const entries = [
  {
    id: 'has-sample-and-default',
    slug: 'has-sample-and-default',
    urlState: {
      default: { 'hf-amount': 100, 'hf-forward-rate': 3 },
      sample:  { 'hf-amount': 250, 'hf-from': 1990 },
      encode: [
        { key: 'hf-amount', type: 'number' },
        { key: 'hf-forward-rate', type: 'number' },
        { key: 'hf-from', type: 'number' },
      ],
      decode: [
        { key: 'hf-amount', type: 'number' },
        { key: 'hf-forward-rate', type: 'number' },
        { key: 'hf-from', type: 'number' },
      ],
    },
  },
  {
    id: 'default-only',
    slug: 'default-only',
    urlState: {
      default: { 'do-amount': 50, 'do-from': 2000 },
      encode: [{ key: 'do-amount', type: 'number' }, { key: 'do-from', type: 'number' }],
      decode: [{ key: 'do-amount', type: 'number' }, { key: 'do-from', type: 'number' }],
    },
  },
  {
    id: 'none-of-either',
    slug: 'none-of-either',
    urlState: {
      default: {},
      encode: [{ key: 'no-x', type: 'string' }],
      decode: [{ key: 'no-x', type: 'string' }],
    },
  },
];

function HtmlInputStub(initial) {
  this._v = initial == null ? '' : String(initial);
  this.type = 'text';
  this.checked = false;
  this.dataset = {};
  this.className = '';
  this.textContent = '';
  this.children = [];
  this.childNodes = this.children; // alias used by sample-data teardown
  this.parentNode = null;
  this.addEventListener = function (name, fn) {
    this._handlers = this._handlers || {};
    (this._handlers[name] = this._handlers[name] || []).push(fn);
  };
  this.removeEventListener = function (name, fn) {
    this._handlers = this._handlers || {};
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
    // Mirror the buttons onto `.tool-actions` rows so the smoke harness
    // can read them back: a .tool-actions row tracks the sample/reset
    // buttons by data-ht-action for the mount-round-trip assertions.
    if (this.className === 'tool-actions' && n && n.dataset) {
      if (n.dataset.htAction === 'sample') this.sampleBtn = n;
      if (n.dataset.htAction === 'reset')  this.resetBtn  = n;
    }
    return n;
  };
  this.removeChild = function (n) {
    const i = this.children.indexOf(n);
    if (i !== -1) this.children.splice(i, 1);
    n.parentNode = null;
    // Mirror sample-data teardown: clearing the row's button refs lets
    // the smoke harness verify teardown removed both buttons.
    if (this.className === 'tool-actions' && n && n.dataset) {
      if (n.dataset.htAction === 'sample') this.sampleBtn = null;
      if (n.dataset.htAction === 'reset')  this.resetBtn  = null;
    }
    return n;
  };
  this.querySelector = function (sel) { return null; };
  this.close = () => {};
  this.showModal = () => {};
}
Object.defineProperty(HtmlInputStub.prototype, 'value', {
  get() { return this._v; },
  set(v) { this._v = v == null ? '' : String(v); },
});

// The mount() helper calls main.querySelector('input, select, textarea')
// and needs a rootEl.querySelector('#key') path. Stub a main element
// with the data-slug attribute so the module's `_slugFromRoot` reads it.
function makeMainStub(slug) {
  const inputs = {
    'hf-amount': new HtmlInputStub(''),
    'hf-forward-rate': new HtmlInputStub(''),
    'hf-from': new HtmlInputStub(''),
    'do-amount': new HtmlInputStub(''),
    'do-from': new HtmlInputStub(''),
  };
  // The row is the .tool-actions flex container the mount helper looks
  // for. Pre-mark it with className so the module's `row.className =
  // 'tool-actions'` overwrite is harmless, and pre-insert it as a child
  // of `main` so the mount helper's `rootEl.querySelector('.tool-actions')`
  // returns this exact object (and we can read back sampleBtn/resetBtn).
  const row = new HtmlInputStub('');
  row.className = 'tool-actions';
  row.sampleBtn = null;
  row.resetBtn = null;
  const form = { parentNode: null };
  const main = {
    _slug: slug,
    _inputs: inputs,
    _row: row,
    _form: form,
    getAttribute: function (k) { return k === 'data-slug' ? slug : null; },
    closest: function (sel) { return main; }, // self-claim
    querySelector: function (sel) {
      // CSS list selector (used for "first form, first input").
      if (sel === 'form') return form;
      if (sel === '.tool-actions') return row;
      if (sel === 'input, select, textarea') return inputs['hf-amount'] || Object.values(inputs)[0];
      // Bare "#key" selector for the write path.
      const m = /^#([\w-]+)$/.exec(sel);
      if (m) return inputs[m[1]] || null;
      return null;
    },
    insertBefore: function (n, ref) {
      // Place row at top of main.children.
      main.children.unshift(n);
      n.parentNode = main;
      return n;
    },
    firstChild: row,
    children: [row],
  };
  row.parentNode = main;
  form.parentNode = main;
  return main;
}

const realSetTimeout = setTimeout;
const realClearTimeout = clearTimeout;

// P-1 / P-2: registry of test roots keyed by data-slug so the
// sample-data module's `document.querySelector('main[data-slug="…"]')`
// path actually returns the test root. Each test installs its own
// root; the registry is cleared between assertions.
const _rootBySlug = {};
function _installRoot(slug, root) { _rootBySlug[slug] = root; }
function _queryMainBySlug(slug) { return _rootBySlug[slug] || null; }

const ctx = {
  window: {},
  document: {
    getElementById: () => null,
    querySelector: function (sel) {
      const m = /^main\[data-slug="([^"]+)"\]$/.exec(sel);
      if (m) return _rootBySlug[m[1]] || null;
      return null;
    },
    activeElement: null,
    createElement: function (tag) {
      // Each created element must look like the right DOM node for the
      // sample-data module. sample/reset buttons need dataset, className,
      // textContent, setAttribute, addEventListener. The confirm dialog
      // needs innerHTML setter (we ignore the markup), querySelector to
      // locate its buttons, and a showModal/close no-op.
      const el = new HtmlInputStub('');
      el.tagName = String(tag || '').toUpperCase();
      Object.defineProperty(el, 'innerHTML', {
        get() { return ''; },
        set(_v) { /* sample-data.js sets innerHTML on the <dialog>; we ignore */ },
      });
      return el;
    },
    body: new HtmlInputStub(''),
  },
  console,
  performance: { now: () => Date.now() },
  setTimeout: realSetTimeout,
  clearTimeout: realClearTimeout,
  history: { replaceState: () => {}, pushState: () => {} },
  location: { hash: '', pathname: '/tools/test/', search: '' },
  HTMLInputElement: HtmlInputStub,
  HTMLTextAreaElement: HtmlInputStub,
  HTMLSelectElement: HtmlInputStub,
  HT: { homeGrid: { entries: entries } },
};
ctx.window.HT = ctx.HT;
ctx.window.addEventListener = () => {};
ctx.window.removeEventListener = () => {};
ctx.HTMLDialogElement = function () {};

vm.createContext(ctx);
vm.runInContext(UTILS_SRC, ctx, { filename: 'utils.js' });
vm.runInContext(URL_SRC, ctx, { filename: 'url.js' });
vm.runInContext(SAMPLE_SRC, ctx, { filename: 'sample-data.js' });

const HT = ctx.window.HT;
const sampleData = HT.sampleData;
const reset = HT.reset;

let pass = 0, fail = 0;
function check(name, ok, info) {
  if (ok) { pass += 1; console.log('  PASS  ' + name); }
  else { fail += 1; console.log('  FAIL  ' + name + (info ? ' — ' + info : '')); }
}

// === Surface-level checks ===

check('HT.sampleData exists', typeof sampleData === 'object');
check('HT.sampleData.fill is function', typeof sampleData.fill === 'function');
check('HT.sampleData.button is function', typeof sampleData.button === 'function');
check('HT.sampleData.hasSample is function', typeof sampleData.hasSample === 'function');
check('HT.sampleData.mount is function', typeof sampleData.mount === 'function');
check('HT.sampleData is frozen', Object.isFrozen(sampleData));
check('HT.reset exists', typeof reset === 'object');
check('HT.reset.run is function', typeof reset.run === 'function');
check('HT.reset.button is function', typeof reset.button === 'function');
check('HT.reset is frozen', Object.isFrozen(reset));

// === Assertion 1: has-sample-and-default ===

check('hasSample: has-sample-and-default → true', sampleData.hasSample('has-sample-and-default') === true);
const mergedFill = sampleData.fill('has-sample-and-default');
check('fill: has-sample-and-default returns merged object',
  mergedFill && mergedFill['hf-amount'] === 250 && mergedFill['hf-from'] === 1990 && mergedFill['hf-forward-rate'] === 3);
check('fill: has-sample-and-default is frozen',
  Object.isFrozen(mergedFill) === true);

// Sloppy-mode mutation: in this script we are not in strict mode at the
// top level (the harness is a CJS module). A direct assignment in sloppy
// mode fails silently and the frozen invariant still holds.
let mutationDidThrow = false;
try { mergedFill['hf-amount'] = 999; } catch (_) { mutationDidThrow = true; }
check('fill: mutation attempt does not change frozen payload',
  mergedFill['hf-amount'] === 250);
// P-3: re-check Object.isFrozen() AFTER the mutation attempt to lock
// in the canonical invariant from AC-6 #8.
check('fill: Object.isFrozen remains true after mutation attempt',
  Object.isFrozen(mergedFill) === true);

// === Assertion 2: default-only ===

check('hasSample: default-only → false', sampleData.hasSample('default-only') === false);
const defaultFill = sampleData.fill('default-only');
check('fill: default-only returns the frozen default (NOT null)',
  defaultFill && defaultFill['do-amount'] === 50 && defaultFill['do-from'] === 2000);
check('fill: default-only is frozen',
  Object.isFrozen(defaultFill) === true);

// === Assertion 3: none-of-either ===

check('hasSample: none-of-either → false', sampleData.hasSample('none-of-either') === false);
check('fill: none-of-either returns null',
  sampleData.fill('none-of-either') === null);

// === Assertion 4: sample button factory ===

const sampleBtn = sampleData.button('has-sample-and-default');
check('button: returns an HTMLButtonElement',
  sampleBtn && sampleBtn.tagName === 'BUTTON');
check('button: data-ht-action="sample"',
  sampleBtn.dataset.htAction === 'sample');
check('button: type="button"',
  sampleBtn.type === 'button');
check('button: aria-label includes shortcut "(s)"',
  sampleBtn.getAttribute('aria-label').indexOf('(s)') !== -1);

// Click handler — verifies the wiring dispatches an input event on the
// first matched input (which lets bindForm's commit path pick it up).
let inputDispatched = false;
const firstInput = new HtmlInputStub('');
firstInput.addEventListener = function (ev) {
  if (ev === 'input' || ev === 'change') inputDispatched = true;
};
const sampleRoot = makeMainStub('has-sample-and-default');
sampleRoot.querySelector = (function (orig) {
  return function (sel) {
    if (sel === 'input, select, textarea') return firstInput;
    return orig.call(sampleRoot, sel);
  };
})(sampleRoot.querySelector);
sampleBtn.addEventListener('click', sampleBtn._sampleClick || (() => {}));
// Re-create the button bound to the test root via a fresh mount? The
// button factory above uses `document.querySelector('main[data-slug=…]')`
// inside its click handler, which our stub returns null. To exercise the
// full click path we trigger HT.sampleData.fill() directly + simulate the
// DOM-write side-effect by setting fields. The smoke proves the data
// shape + button factory; full e2e lives in browser manual smoke.
const directFill = sampleData.fill('has-sample-and-default');
sampleRoot._inputs['hf-amount'].value = String(directFill['hf-amount']);
sampleRoot._inputs['hf-from'].value = String(directFill['hf-from']);
check('fill: smoke simulates the click → input write path',
  sampleRoot._inputs['hf-amount'].value === '250'
  && sampleRoot._inputs['hf-from'].value === '1990');

// === Assertion 5: reset button factory ===

const resetBtn = reset.button('has-sample-and-default');
check('reset.button: data-ht-action="reset"', resetBtn.dataset.htAction === 'reset');
check('reset.button: type="button"', resetBtn.type === 'button');
check('reset.button: aria-label "Reset to sample (r)"',
  resetBtn.getAttribute('aria-label') === 'Reset to sample (r)');
check('reset.button: text content "Reset to sample"',
  resetBtn.textContent === 'Reset to sample');
check('reset.button: has destructive class',
  /btn--destructive/.test(resetBtn.className) === true);

// === Assertion 6: mount round-trip + teardown ===

const mountRoot = makeMainStub('has-sample-and-default');
_installRoot('has-sample-and-default', mountRoot);
const mounted = sampleData.mount('has-sample-and-default', mountRoot);
check('mount: returns an object with teardown', mounted && typeof mounted.teardown === 'function');
// After mount, both buttons should be present in the .tool-actions row.
check('mount: inserted sample button into the .tool-actions row',
  mountRoot._row.sampleBtn && mountRoot._row.sampleBtn.dataset.htAction === 'sample');
check('mount: inserted reset button into the .tool-actions row',
  mountRoot._row.resetBtn && mountRoot._row.resetBtn.dataset.htAction === 'reset');

// P-1: full click path through mount(). The mount helper attaches
// real listeners via addEventListener — simulate a click and verify
// the input write path runs. (HtmlInputStub stores its handlers so
// we can invoke them directly.)
const clickMainRoot = makeMainStub('has-sample-and-default');
_installRoot('has-sample-and-default', clickMainRoot);
sampleData.mount('has-sample-and-default', clickMainRoot);
const sampleClickEvent = { type: 'click', preventDefault: function () { sampleClickEvent._prevented = true; } };
const sampleHandlers = (clickMainRoot._row.sampleBtn._handlers || {})['click'] || [];
if (sampleHandlers.length) sampleHandlers[0](sampleClickEvent);
check('mount click → sample: prevented default',
  sampleClickEvent._prevented === true);
check('mount click → sample: patched hf-amount input',
  clickMainRoot._inputs['hf-amount']._v === '250');
check('mount click → sample: patched hf-from input',
  clickMainRoot._inputs['hf-from']._v === '1990');

// P-2 (silent path): reset.run(slug, {confirm: false}) skips the
// dialog entirely and writes the payload straight to the inputs.
const resetMainRoot = makeMainStub('has-sample-and-default');
_installRoot('has-sample-and-default', resetMainRoot);
resetMainRoot._inputs['hf-amount']._v = '777';
resetMainRoot._inputs['hf-from']._v = '1985';
HT.reset.run('has-sample-and-default', { confirm: false });
check('reset.run(confirm:false): writes payload to inputs',
  resetMainRoot._inputs['hf-amount']._v === '250'
  && resetMainRoot._inputs['hf-from']._v === '1990');

// P-2 (dirty path): reset.run(slug) when state diverges must build
// a <dialog> and call showModal(). The harness's createElement stub
// ignores innerHTML, so sample-data's `dlg.querySelector('h2').id = ...`
// would throw. Install a dialog stub that has a querySelector returning
// a stub h2 + buttons + proper showModal hook.
let dialogOpened = false;
const origCreate = ctx.document.createElement;
ctx.document.createElement = function (tag) {
  if (String(tag).toLowerCase() === 'dialog') {
    const buttons = {};
    const h2 = new HtmlInputStub('');
    h2.id = '';
    const dlg = {
      tagName: 'DIALOG',
      className: '',
      children: [],
      appendChild: function (n) { this.children.push(n); n.parentNode = this; return n; },
      removeChild: function (n) {
        const i = this.children.indexOf(n);
        if (i !== -1) this.children.splice(i, 1);
        n.parentNode = null; return n;
      },
      setAttribute: function (k, v) { this['_' + k] = v; },
      getAttribute: function (k) { return this['_' + k] != null ? this['_' + k] : null; },
      addEventListener: function (name, fn) {
        this._handlers = this._handlers || {};
        (this._handlers[name] = this._handlers[name] || []).push(fn);
      },
      removeEventListener: function () {},
      close: function () {},
      showModal: function () { dialogOpened = true; },
      querySelector: function (sel) {
        if (sel === 'h2') return h2;
        if (sel === '[data-ht-action="reset-cancel"]') {
          return buttons.cancel || (buttons.cancel = makeDialogButton('reset-cancel'));
        }
        if (sel === '[data-ht-action="reset-confirm"]') {
          return buttons.confirm || (buttons.confirm = makeDialogButton('reset-confirm'));
        }
        if (sel === '[aria-labelledby]') return null;
        return null;
      },
    };
    Object.defineProperty(dlg, 'innerHTML', {
      get() { return ''; },
      set(_v) { /* sample-data sets innerHTML — we ignore it */ },
    });
    return dlg;
  }
  return origCreate(tag);
};
function makeDialogButton(action) {
  return {
    tagName: 'BUTTON',
    className: '',
    dataset: { htAction: action },
    textContent: '',
    children: [],
    focus: function () {},
    setAttribute: function (k, v) { this['_' + k] = v; },
    getAttribute: function (k) { return this['_' + k] != null ? this['_' + k] : null; },
    addEventListener: function (name, fn) {
      this._handlers = this._handlers || {};
      (this._handlers[name] = this._handlers[name] || []).push(fn);
    },
  };
}
ctx.document.body.appendChild = function () {};
ctx.document.body.removeChild = function () {};
const dirtyMainRoot = makeMainStub('has-sample-and-default');
_installRoot('has-sample-and-default', dirtyMainRoot);
dirtyMainRoot._inputs['hf-amount']._v = '888';
dirtyMainRoot._inputs['hf-from']._v = '1977';
HT.reset.run('has-sample-and-default');
check('reset.run(dirty): opens confirm dialog when state diverges',
  dialogOpened === true);
ctx.document.createElement = origCreate;

mounted.teardown();
check('mount: teardown removed both buttons',
  mountRoot._row.sampleBtn === null && mountRoot._row.resetBtn === null);

// Mount for default-only (no sample block) should still render reset.
const defaultMount = sampleData.mount('default-only', makeMainStub('default-only'));
const defaultMountRoot = defaultMount.teardown ? defaultMount : null;
const defaultRoot = makeMainStub('default-only');
const dm = sampleData.mount('default-only', defaultRoot);
check('mount: default-only renders reset button',
  defaultRoot._row.resetBtn && defaultRoot._row.resetBtn.dataset.htAction === 'reset');
check('mount: default-only does NOT render sample button',
  defaultRoot._row.sampleBtn === null);
dm.teardown();

// Mount for none-of-either (no sample, no default) renders nothing.
const noneRoot = makeMainStub('none-of-either');
const nm = sampleData.mount('none-of-either', noneRoot);
check('mount: none-of-either renders nothing',
  noneRoot._row.sampleBtn === null && noneRoot._row.resetBtn === null);
nm.teardown();

// === Assertion 7: api-contract.js cross-pins ===

const contractSrc = fs.readFileSync(
  path.resolve(__dirname, '../assets/js/api-contract.js'),
  'utf8'
);
check('api-contract: version bumped to 1.8.0 (Story 2.2: 1.5.0; bundled 2.2+2.4: 1.6.0; bundled 2.2+2.3+2.4: 1.7.0; bundled 2.2+2.3+2.4+2.5: 1.8.0)',
  /version:\s*['"]1\.8\.0['"]/.test(contractSrc));
check('api-contract: HT.sampleData.fill entry present',
  /HT\.sampleData\.fill/.test(contractSrc));
check('api-contract: HT.sampleData.button entry present',
  /HT\.sampleData\.button/.test(contractSrc));
check('api-contract: HT.sampleData.hasSample entry present',
  /HT\.sampleData\.hasSample/.test(contractSrc));
check('api-contract: HT.sampleData.mount entry present',
  /HT\.sampleData\.mount/.test(contractSrc));
check('api-contract: HT.reset.run entry present',
  /HT\.reset\.run/.test(contractSrc));
check('api-contract: HT.reset.button entry present',
  /HT\.reset\.button/.test(contractSrc));

// === Assertion 8: tools.json inflation-calculator has sample block ===

const toolsJson = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '../tools.json'),
  'utf8'
));
const ic = toolsJson.tools.find((e) => e.slug === 'inflation-calculator');
check('tools.json: inflation-calculator.urlState.sample present',
  ic && ic.urlState && ic.urlState.sample && ic.urlState.sample['ic-amount'] === 100);

const qr = toolsJson.tools.find((e) => e.slug === 'qr-code-generator');
check('tools.json: qr-code-generator.urlState.sample present',
  qr && qr.urlState && qr.urlState.sample && qr.urlState.sample['qr-text'] === 'https://handy.tools/?qr=demo');

// P-5: parse the inline <script type="application/json"> splice from
// each exemplar tool page and verify it carries urlState.sample that
// matches the canonical tools.json entry. The splice is the source of
// truth at runtime (no network fetch), so this byte-parity check is
// the load-bearing static guarantee behind Story 2.2 AC-5.
function _readInlineSplice(slug) {
  const html = fs.readFileSync(
    path.resolve(__dirname, '../tools', slug, 'index.html'),
    'utf8'
  );
  const m = html.match(
    /<script\s+type="application\/json"\s+id="ht-tools-json-inline">([\s\S]*?)<\/script>/
  );
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (_) { return null; }
}
function _shallowEqualPayload(a, b) {
  // Key-order independent: compare keys + values, not stringified order.
  if (!a || !b) return false;
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  if (ka.length !== kb.length) return false;
  for (let i = 0; i < ka.length; i += 1) {
    if (ka[i] !== kb[i]) return false;
    if (String(a[ka[i]]) !== String(b[kb[i]])) return false;
  }
  return true;
}
for (const slug of ['inflation-calculator', 'qr-code-generator']) {
  const splice = _readInlineSplice(slug);
  const entry = splice && splice.tools && splice.tools.find((e) => e.slug === slug);
  const canon = toolsJson.tools.find((e) => e.slug === slug);
  check(`inline-splice: ${slug}.urlState.sample matches tools.json`,
    entry && entry.urlState && entry.urlState.sample
    && canon && canon.urlState && canon.urlState.sample
    && _shallowEqualPayload(entry.urlState.sample, canon.urlState.sample));
}

// === Assertion 9: tools.schema.json accepts urlState.sample ===

const schema = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '../tools.schema.json'),
  'utf8'
));
// tool-entry lives under `definitions` (Draft-07), not `properties`.
const urlStateSchema = (schema.definitions
  && schema.definitions['tool-entry']
  && schema.definitions['tool-entry'].properties
  && schema.definitions['tool-entry'].properties.urlState)
  || (schema.properties
    && schema.properties['tool-entry']
    && schema.properties['tool-entry'].properties
    && schema.properties['tool-entry'].properties.urlState);
check('tools.schema.json: urlState.sample declared as optional property',
  urlStateSchema
  && urlStateSchema.properties
  && urlStateSchema.properties.sample
  && Array.isArray(urlStateSchema.required)
  && urlStateSchema.required.indexOf('sample') === -1);

// === Output + vacuous-pass guard ===

console.log('');
console.log('passed: ' + pass + ', failed: ' + fail);
if (pass === 0 && fail === 0) {
  console.error('smoke: vacuous run — zero assertions executed');
  process.exit(1);
}
process.exit(fail === 0 ? 0 : 1);
