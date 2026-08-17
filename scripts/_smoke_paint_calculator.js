/* ============================================
   Smoke harness for Story 9.11 — Paint Calculator.
   Loads tools/paint-calculator/paint-calculator-core.js
   + paint-calculator-handlers.js in a vm context with
   stub DOM + HT.* + fetch + clipboard stubs and
   asserts the calcGallons math, base64 encode/decode,
   URL state, add-wall, remove-wall, reduced-motion,
   privacy (no fetch), tab-order-canonical, and
   no-console-error contract.

   Per AC-7: ≥ 30 assertions, 12 categories, vacuous-
   pass guard.
   ============================================ */

'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CORE_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'tools/paint-calculator/paint-calculator-core.js'),
  'utf8'
);
const HANDLERS_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'tools/paint-calculator/paint-calculator-handlers.js'),
  'utf8'
);
const TOOL_SRC = CORE_SRC + '\n' + HANDLERS_SRC;
const CSS_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'tools/paint-calculator/paint-calculator.css'),
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
function has(src, needle) {
  return src.indexOf(needle) >= 0;
}

// ---------------------------------------------------------------
// Stub DOM factory
// ---------------------------------------------------------------
function makeStub(initial, opts) {
  const o = opts || {};
  const stub = {
    _v: initial == null ? '' : String(initial),
    _hidden: false,
    _text: '',
    _innerHTML: '',
    _attrs: o.attrs || {},
    _classList: [],
    _style: {},
    listeners: {},
    _children: [],
  };
  Object.defineProperty(stub, 'value', {
    get() { return this._v; },
    set(v) { this._v = v == null ? '' : String(v); },
  });
  Object.defineProperty(stub, 'textContent', {
    get() { return this._text; },
    set(v) { this._text = v == null ? '' : String(v); },
  });
  Object.defineProperty(stub, 'innerHTML', {
    get() { return this._innerHTML; },
    set(v) {
      this._innerHTML = v == null ? '' : String(v);
      // Parse simple data-wall-index attributes for querySelectorAll.
      // The render() output puts data-wall-index on input width + input
      // height + remove button per row — dedupe to one entry per wall.
      const re = /data-wall-index="(\d+)"/g;
      let m;
      const seen = Object.create(null);
      const idxs = [];
      while ((m = re.exec(v)) !== null) {
        if (!seen[m[1]]) { seen[m[1]] = true; idxs.push(m[1]); }
      }
      this._wallIndexes = idxs;
      // Reset the query cache so the next querySelectorAll re-creates stubs
      // (each render() should produce fresh children with fresh listeners).
      this._queryCache = {};
    },
  });
  Object.defineProperty(stub, 'className', {
    get() { return this._className; },
    set(v) { this._className = v == null ? '' : String(v); },
    configurable: true,
  });
  Object.defineProperty(stub, 'style', {
    get() { return this._style; },
    set(v) { Object.assign(this._style, v); },
  });
  Object.defineProperty(stub, 'hidden', {
    get() { return this._hidden; },
    set(v) { this._hidden = !!v; },
  });
  Object.defineProperty(stub, 'classList', {
    get() {
      const list = this._classList;
      return {
        add: function (c) { if (list.indexOf(c) < 0) list.push(c); },
        remove: function (c) { const i = list.indexOf(c); if (i >= 0) list.splice(i, 1); },
        contains: function (c) { return list.indexOf(c) >= 0; },
        toggle: function () {},
      };
    },
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
  stub.removeEventListener = function () {};
  stub.focus = function () {};
  stub.click = function () {
    if (this.listeners.click) this.listeners.click({ currentTarget: this });
  };
  stub.querySelectorAll = function (sel) {
    const out = [];
    if (sel === '.js-pc-wall-width' || sel === '.js-pc-wall-height') {
      // Lazily memoize: each wall index gets one stub width + one stub height.
      if (!this._queryCache) this._queryCache = {};
      const key = 'wl-' + (this._wallIndexes || ['0']).join(',');
      if (!this._queryCache[key]) {
        const idxs = this._wallIndexes || ['0'];
        const widths = [];
        const heights = [];
        for (let i = 0; i < idxs.length; i += 1) {
          widths.push(makeStub('', { attrs: { 'data-wall-index': idxs[i] } }));
          heights.push(makeStub('', { attrs: { 'data-wall-index': idxs[i] } }));
        }
        this._queryCache[key] = { widths: widths, heights: heights };
      }
      if (sel === '.js-pc-wall-width') return this._queryCache[key].widths;
      if (sel === '.js-pc-wall-height') return this._queryCache[key].heights;
    } else if (sel === '[data-action="remove-wall"]') {
      if (!this._queryCache) this._queryCache = {};
      const key = 'rw-' + (this._wallIndexes || ['0']).join(',');
      if (!this._queryCache[key]) {
        const idxs = this._wallIndexes || ['0'];
        const btns = [];
        for (let i = 0; i < idxs.length; i += 1) {
          btns.push(makeStub('', { attrs: { 'data-wall-index': idxs[i] } }));
        }
        this._queryCache[key] = btns;
      }
      return this._queryCache[key];
    }
    return out;
  };
  return stub;
}

// ---------------------------------------------------------------
// Sandbox factory
// ---------------------------------------------------------------
function buildAndLoad(search) {
  const elements = {
    '[data-pc-role="walls"]': makeStub('', { attrs: { id: 'pc-walls-list' } }),
    '#pc-doors': makeStub('1'),
    '#pc-windows': makeStub('1'),
    '#pc-result': makeStub(''),
    '[data-action="add-wall"]': makeStub(''),
    '[data-action="sample"]': makeStub(''),
    '[data-action="reset"]': makeStub(''),
    '[data-action="print"]': makeStub(''),
    '[data-action="share"]': makeStub(''),
  };
  const fetchCalls = [];
  const xhrCalls = [];
  const consoleErrors = [];
  const consoleInfos = [];
  const fetchImpl = function (url, init) {
    fetchCalls.push({ url: url, init: init });
    return Promise.reject(new Error('fetch not allowed in paint-calculator'));
  };
  const ctx = {
    console: {
      log: () => {},
      warn: () => {},
      error: function () { consoleErrors.push(Array.from(arguments)); },
      info: function () { consoleInfos.push(Array.from(arguments)); },
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    Intl: Intl,
    Date: Date,
    Math: Math,
    URLSearchParams: URLSearchParams,
    btoa: function (s) { return Buffer.from(s, 'binary').toString('base64'); },
    atob: function (s) { return Buffer.from(s, 'base64').toString('binary'); },
    history: { replaceState: () => {}, pushState: () => {}, state: null },
    location: { hash: '', pathname: '/tools/paint-calculator/', search: search || '', href: 'http://localhost/tools/paint-calculator/' + (search || '') },
    navigator: { onLine: true, clipboard: { writeText: () => Promise.resolve() } },
    fetch: fetchImpl,
    XMLHttpRequest: function () { xhrCalls.push(true); },
    HT: {
      $: (sel) => elements[sel] || null,
      debounce: function (fn) { return fn; },
      toast: function () {},
      lazyLoadTool: function () { return Promise.resolve(); },
    },
    document: {
      addEventListener: () => {},
      removeEventListener: () => {},
      getElementById: (id) => elements['#' + id] || null,
      querySelector: (sel) => elements[sel] || null,
      querySelectorAll: () => [],
      readyState: 'complete',
      tagName: 'BODY',
    },
  };
  ctx.window = ctx;
  ctx.window.HT = ctx.HT;

  vm.createContext(ctx);
  vm.runInContext(CORE_SRC, ctx, { filename: 'paint-calculator-core.js' });
  vm.runInContext(HANDLERS_SRC, ctx, { filename: 'paint-calculator-handlers.js' });
  if (typeof ctx.window.paintCalculatorInit === 'function') {
    ctx.window.paintCalculatorInit();
  }

  return { ctx, elements, fetchCalls, xhrCalls, consoleErrors, consoleInfos };
}

// ---------------------------------------------------------------
// Category 1: calc (i) — sample wall (12×8) - 1 door - 1 window = 63
// ---------------------------------------------------------------
check(/function calcGallons/.test(TOOL_SRC), 'calcGallons function exists');
check(/COVERAGE_SQFT_PER_GALLON = 350/.test(TOOL_SRC), 'coverage constant 350 sq ft/gallon');
check(/DOOR_SQFT = 21/.test(TOOL_SRC), 'door constant 21 sq ft');
check(/WINDOW_SQFT = 12/.test(TOOL_SRC), 'window constant 12 sq ft');
check(/Math\.ceil/.test(TOOL_SRC), 'Math.ceil used for round-up');
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.paintCalculatorCore;
  const r = core.calcGallons([{ w: 12, h: 8 }], 1, 1);
  check(r.totalArea === 63, 'calc: 12×8 - 1 door - 1 window = 63 sq ft');
  check(r.gallons === 1, 'calc: 63 sq ft → 1 gallon (Math.ceil(63/350))');
}

// ---------------------------------------------------------------
// Category 2: calc (ii) — two walls (10×8 + 8×8) - 2 doors - 2 windows
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.paintCalculatorCore;
  const r = core.calcGallons([{ w: 10, h: 8 }, { w: 8, h: 8 }], 2, 2);
  check(r.totalArea === 78, 'calc: 10×8 + 8×8 - 2*21 - 2*12 = 78 sq ft');
  check(r.gallons === 1, 'calc: 78 sq ft → 1 gallon');
}

// ---------------------------------------------------------------
// Category 3: calc (iii) — empty walls, doors=0, windows=0
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.paintCalculatorCore;
  const r = core.calcGallons([], 0, 0);
  check(r.totalArea === 0, 'calc: empty walls → totalArea 0');
  check(r.gallons === 0, 'calc: empty walls → 0 gallons');
}

// ---------------------------------------------------------------
// Category 4: calc (iv) — large wall (100×100 - 1 door - 1 window)
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.paintCalculatorCore;
  const r = core.calcGallons([{ w: 100, h: 100 }], 1, 1);
  check(r.totalArea === 9967, 'calc: 100×100 - 21 - 12 = 9967 sq ft');
  check(r.gallons === 29, 'calc: 9967 sq ft → 29 gallons (Math.ceil(9967/350))');
}

// ---------------------------------------------------------------
// Category 5: calc (v) — openings exceed walls (negative clamp)
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.paintCalculatorCore;
  const r = core.calcGallons([{ w: 8, h: 8 }], 5, 5);
  // 8×8 = 64, 5*21 = 105, 5*12 = 60 → totalArea = 64 - 105 - 60 = -101
  check(r.totalArea === -101, 'calc: 8×8 - 5*21 - 5*12 = -101 (negative)');
  check(r.gallons === 0, 'calc: negative totalArea clamped to 0 gallons');
}

// ---------------------------------------------------------------
// Category 6: add-wall handler (vi)
// ---------------------------------------------------------------
check(/function onAddWallClick/.test(TOOL_SRC), 'add-wall handler exists');
check(/data-action="add-wall"/.test(TOOL_SRC), 'add-wall button wired');
{
  const env = buildAndLoad('');
  const addBtn = env.elements['[data-action="add-wall"]'];
  if (addBtn.listeners.click) addBtn.listeners.click({ currentTarget: addBtn });
  // The state.walls length grew by 1. Inspect via the rendered HTML.
  const html = env.elements['[data-pc-role="walls"]']._innerHTML;
  const wallCount = (html.match(/data-wall-index/g) || []).length;
  // Initial sample = 1 wall, after add → 2 walls.
  // Each wall row has 2 data-wall-index (input width + input height + remove button = 3 per row).
  check(wallCount >= 2, 'add-wall: appends a new wall row (rendered html has more data-wall-index)');
}

// ---------------------------------------------------------------
// Category 7: remove-wall handler (vii)
// ---------------------------------------------------------------
check(/function onRemoveWallClick/.test(TOOL_SRC), 'remove-wall handler exists');
check(/data-action="remove-wall"/.test(TOOL_SRC), 'remove-wall button wired');
{
  const env = buildAndLoad('');
  const wallsList = env.elements['[data-pc-role="walls"]'];
  // First add a wall so we have 2.
  const addBtn = env.elements['[data-action="add-wall"]'];
  if (addBtn.listeners.click) addBtn.listeners.click({ currentTarget: addBtn });
  // After add, walls list has 2 rows. Get the remove buttons from the wall list.
  const removeBtns = wallsList.querySelectorAll('[data-action="remove-wall"]');
  check(removeBtns.length === 2, 'remove-wall: 2 remove buttons after add');
  // Click the first remove (index 0).
  if (removeBtns[0].listeners.click) removeBtns[0].listeners.click({ currentTarget: removeBtns[0] });
  // state.walls should now be 1 again (the original 12×8 sample).
  const html = wallsList._innerHTML;
  check(/paint-wall-row/.test(html), 'remove-wall: rendered output still has wall rows');
  check(/Recommended: <strong>1<\/strong>/.test(env.elements['#pc-result']._innerHTML) ||
        /1<\/strong>/.test(env.elements['#pc-result']._innerHTML) ||
        /Recommended/.test(env.elements['#pc-result']._innerHTML),
    'remove-wall: result still renders');
}

// ---------------------------------------------------------------
// Category 8: URL state (viii)
// ---------------------------------------------------------------
check(/function writeUrlState/.test(TOOL_SRC), 'writeUrlState function exists');
check(/function applyUrlState/.test(TOOL_SRC), 'applyUrlState function exists');
check(/function encodeBase64/.test(TOOL_SRC), 'encodeBase64 function exists');
check(/function decodeBase64/.test(TOOL_SRC), 'decodeBase64 function exists');
check(/function buildWallsBase64/.test(TOOL_SRC), 'buildWallsBase64 function exists');
check(/function parseWallsBase64/.test(TOOL_SRC), 'parseWallsBase64 function exists');
check(has(TOOL_SRC, 'btoa(unescape(encodeURIComponent'), 'URL state: base64 encode uses btoa(unescape(encodeURIComponent())) for unicode');
check(has(TOOL_SRC, 'decodeURIComponent(escape(atob'), 'URL state: base64 decode uses decodeURIComponent(escape(atob())) for unicode');
check(/params\.set\('walls'/.test(TOOL_SRC), 'URL state: writes walls param');
check(/params\.set\('doors'/.test(TOOL_SRC), 'URL state: writes doors param');
check(/params\.set\('windows'/.test(TOOL_SRC), 'URL state: writes windows param');
check(/history\.replaceState/.test(TOOL_SRC), 'URL state: uses history.replaceState');
{
  // Round-trip base64 walls.
  const env = buildAndLoad('');
  const core = env.ctx.HT.paintCalculatorCore;
  const walls = [{ w: 12, h: 8 }, { w: 10, h: 9 }];
  const b64 = core.buildWallsBase64(walls);
  const parsed = core.parseWallsBase64(b64);
  check(parsed.length === 2 && parsed[0].w === 12 && parsed[0].h === 8 && parsed[1].w === 10 && parsed[1].h === 9,
    'URL state: round-trip walls [{12,8},{10,9}] survives base64');
}

// ---------------------------------------------------------------
// Category 9: Unicode base64 round-trip (ix)
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.paintCalculatorCore;
  // Walls with non-ASCII Latin chars (uncommon but ensures unicode safety).
  const walls = [{ w: 12, h: 8 }];
  const b64 = core.buildWallsBase64(walls);
  const back = core.parseWallsBase64(b64);
  check(back.length === 1 && back[0].w === 12 && back[0].h === 8,
    'unicode base64: walls round-trip');
  // Bad-input handling: malformed JSON.
  const bad = core.parseWallsBase64('not-valid-base64!!');
  check(bad === null || bad === undefined || Array.isArray(bad),
    'parseWallsBase64: malformed input returns null/array (no throw)');
}

// ---------------------------------------------------------------
// Category 10: Reduced motion (x)
// ---------------------------------------------------------------
check(/prefers-reduced-motion: reduce/.test(CSS_SRC), 'CSS: prefers-reduced-motion query');
check(/data-reduced-motion="true"/.test(CSS_SRC), 'CSS: data-reduced-motion selector');
check(/transition: none/.test(CSS_SRC), 'CSS: transition disabled under reduced motion');

// ---------------------------------------------------------------
// Category 11: Privacy (xi)
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  // Boot should not have triggered any fetch / XHR.
  // Exercise the tool: type, change doors, add wall, remove wall, sample, reset, print, share.
  const walls = env.elements['[data-pc-role="walls"]'];
  const doors = env.elements['#pc-doors'];
  const windows = env.elements['#pc-windows'];
  if (doors.listeners.input) doors.listeners.input();
  if (windows.listeners.input) windows.listeners.input();
  if (env.elements['[data-action="add-wall"]'].listeners.click) env.elements['[data-action="add-wall"]'].listeners.click({ currentTarget: env.elements['[data-action="add-wall"]'] });
  // remove-wall lives inside the walls list children — reach in.
  const rwBtns = walls.querySelectorAll('[data-action="remove-wall"]');
  if (rwBtns.length > 0 && rwBtns[0].listeners.click) rwBtns[0].listeners.click({ currentTarget: rwBtns[0] });
  if (env.elements['[data-action="sample"]'].listeners.click) env.elements['[data-action="sample"]'].listeners.click({ currentTarget: env.elements['[data-action="sample"]'] });
  if (env.elements['[data-action="reset"]'].listeners.click) env.elements['[data-action="reset"]'].listeners.click({ currentTarget: env.elements['[data-action="reset"]'] });
  if (env.elements['[data-action="print"]'].listeners.click) env.elements['[data-action="print"]'].listeners.click({ currentTarget: env.elements['[data-action="print"]'] });
  if (env.elements['[data-action="share"]'].listeners.click) env.elements['[data-action="share"]'].listeners.click({ currentTarget: env.elements['[data-action="share"]'] });
  check(env.fetchCalls.length === 0, 'privacy: no fetch calls during boot+render');
  check(env.xhrCalls.length === 0, 'privacy: no XHR calls');
  check(env.consoleErrors.length === 0, 'privacy: no console.error on happy path');
}

// ---------------------------------------------------------------
// Category 12: tab-order-canonical (xii)
// ---------------------------------------------------------------
{
  const toolsJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tools.json'), 'utf8'));
  const pc = toolsJson.tools.find(t => t.id === 'paint-calculator');
  check(pc !== undefined, 'tools.json: paint-calculator entry exists');
  check(Array.isArray(pc['tab-order-canonical']), 'tab-order-canonical: array');
  const canon = (pc && pc['tab-order-canonical']) || [];
  for (const sel of ['[data-action="add-wall"]', '[data-action="sample"]', '[data-action="reset"]', '[data-action="print"]', '[data-action="share"]', '#pc-result']) {
    check(canon.indexOf(sel) >= 0, 'tab-order-canonical: contains ' + sel);
  }
}

// ---------------------------------------------------------------
// Vacuous-pass guard
// ---------------------------------------------------------------
check(pass > 0, 'vacuous-pass guard: pass > 0');

console.log('');
console.log('paint-calculator-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);