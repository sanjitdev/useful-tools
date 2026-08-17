/* ============================================
   Smoke harness for Story 9.12 — Area & Volume Calculator.
   Loads tools/area-volume/area-volume-core.js + handlers in a vm
   context with stub DOM and asserts the math, unit conversion,
   URL state, shape switching, reduced-motion, privacy (no fetch),
   tab-order-canonical, and no-console-error contract.

   Per AC-7: ≥ 30 assertions, 12 categories, vacuous-pass guard.
   ============================================ */

'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CORE_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'tools/area-volume/area-volume-core.js'),
  'utf8'
);
const HANDLERS_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'tools/area-volume/area-volume-handlers.js'),
  'utf8'
);
const TOOL_SRC = CORE_SRC + '\n' + HANDLERS_SRC;
const CSS_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'tools/area-volume/area-volume.css'),
  'utf8'
);

let pass = 0;
let fail = 0;
function check(cond, label) {
  if (cond) { pass += 1; console.log('  PASS  ' + label); }
  else { fail += 1; console.log('  FAIL  ' + label); }
}
function has(src, needle) { return src.indexOf(needle) >= 0; }

// ---------------------------------------------------------------
// Stub DOM factory (lightweight; smoke covers math + URL state)
// ---------------------------------------------------------------
function makeStub(initial, opts) {
  const o = opts || {};
  const stub = {
    _v: initial == null ? '' : String(initial),
    _hidden: false,
    _text: '',
    _innerHTML: '',
    _attrs: o.attrs || {},
    listeners: {}
  };
  Object.defineProperty(stub, 'value', {
    get() { return this._v; },
    set(v) { this._v = v == null ? '' : String(v); }
  });
  Object.defineProperty(stub, 'hidden', {
    get() { return this._hidden; },
    set(v) { this._hidden = !!v; }
  });
  Object.defineProperty(stub, 'innerHTML', {
    get() { return this._innerHTML; },
    set(v) { this._innerHTML = v == null ? '' : String(v); }
  });
  stub.getAttribute = function (name) {
    return stub._attrs[name] != null ? stub._attrs[name] : null;
  };
  stub.setAttribute = function (name, v) { stub._attrs[name] = v; };
  stub.addEventListener = function (ev, fn) { this.listeners[ev] = fn; };
  stub.removeEventListener = function () {};
  stub.click = function () {
    if (this.listeners.click) this.listeners.click({ currentTarget: this });
  };
  stub.querySelectorAll = function () { return []; };
  return stub;
}

function buildAndLoad(search) {
  const elements = {};
  const fetchCalls = [];
  const xhrCalls = [];
  const consoleErrors = [];
  const ctx = {
    console: {
      log: () => {},
      warn: () => {},
      error: function () { consoleErrors.push(Array.from(arguments)); },
      info: () => {}
    },
    setTimeout: setTimeout, clearTimeout: clearTimeout,
    setInterval: setInterval, clearInterval: clearInterval,
    Intl: Intl, Date: Date, Math: Math,
    URLSearchParams: URLSearchParams,
    history: { replaceState: () => {}, pushState: () => {}, state: null },
    location: { hash: '', pathname: '/tools/area-volume/', search: search || '', href: 'http://localhost/tools/area-volume/' + (search || '') },
    navigator: { onLine: true, clipboard: { writeText: () => Promise.resolve() } },
    fetch: function (url, init) {
      fetchCalls.push({ url: url, init: init });
      return Promise.reject(new Error('fetch not allowed'));
    },
    XMLHttpRequest: function () { xhrCalls.push(true); },
    HT: {
      $: (sel) => elements[sel] || null,
      toast: () => {},
      lazyLoadTool: () => Promise.resolve()
    },
    document: {
      addEventListener: () => {}, removeEventListener: () => {},
      getElementById: (id) => elements['#' + id] || null,
      querySelector: (sel) => elements[sel] || null,
      querySelectorAll: () => [],
      readyState: 'complete', tagName: 'BODY'
    }
  };
  ctx.window = ctx;
  ctx.window.HT = ctx.HT;
  vm.createContext(ctx);
  vm.runInContext(CORE_SRC, ctx, { filename: 'area-volume-core.js' });
  vm.runInContext(HANDLERS_SRC, ctx, { filename: 'area-volume-handlers.js' });
  return { ctx, elements, fetchCalls, xhrCalls, consoleErrors };
}

// ---------------------------------------------------------------
// Category 1: rectangle
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.areaVolumeCore;
  const r = core.computeShape('rectangle', { w: 12, h: 10 });
  check(r.value === 120, 'rectangle 12×10 = 120 sq ft');
  check(r.is3d === false, 'rectangle: is3d = false');
}
// ---------------------------------------------------------------
// Category 2: triangle
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.areaVolumeCore;
  const r = core.computeShape('triangle', { b: 10, h: 8 });
  check(r.value === 40, 'triangle (10×8)/2 = 40');
}
// ---------------------------------------------------------------
// Category 3: circle
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.areaVolumeCore;
  const r = core.computeShape('circle', { r: 5 });
  const expected = Math.PI * 25;
  check(Math.abs(r.value - expected) < 1e-9, 'circle r=5: π×25 ≈ 78.54');
}
// ---------------------------------------------------------------
// Category 4: L-shape
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.areaVolumeCore;
  const r = core.computeShape('l-shape', { r1w: 10, r1h: 8, r2w: 6, r2h: 4 });
  check(r.value === (10 * 8) + (6 * 4), 'L-shape: 80+24 = 104');
}
// ---------------------------------------------------------------
// Category 5: box-3d
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.areaVolumeCore;
  const r = core.computeShape('box-3d', { w: 6, h: 4, d: 3 });
  check(r.value === 72, 'box-3d: 6×4×3 = 72 cu ft');
  check(r.is3d === true, 'box-3d: is3d = true');
}
// ---------------------------------------------------------------
// Category 6: cylinder-3d
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.areaVolumeCore;
  const r = core.computeShape('cylinder-3d', { r: 2, h: 5 });
  const expected = Math.PI * 4 * 5;
  check(Math.abs(r.value - expected) < 1e-9, 'cylinder-3d: π×r²×h ≈ 62.83');
}
// ---------------------------------------------------------------
// Category 7: unit conversion
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.areaVolumeCore;
  const sqft = core.convertUnits(10, 'm2', 'ft2');
  check(Math.abs(sqft - 107.639) < 0.01, 'convert 10 m² → ≈ 107.64 ft²');
  const m2 = core.convertUnits(107.639, 'ft2', 'm2');
  check(Math.abs(m2 - 10) < 0.01, 'round-trip 10 m² → ft² → m²');
  const cu = core.convertUnits(1, 'm3', 'ft3');
  check(Math.abs(cu - 35.3147) < 0.01, 'convert 1 m³ → ≈ 35.31 ft³');
  check(core.convertUnits(50, 'ft2', 'ft2') === 50, 'identity conversion ft²');
}
// ---------------------------------------------------------------
// Category 8: URL state encode/decode/resolve
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.areaVolumeCore;
  const qs = core.encodeState('l-shape', { r1w: 10, r1h: 8, r2w: 6, r2h: 4, unit: 'ft' });
  check(qs.indexOf('shape=l-shape') >= 0, 'encode: shape param present');
  check(qs.indexOf('r1w=10') >= 0, 'encode: r1w=10 present');
  check(qs.indexOf('r2h=4') >= 0, 'encode: r2h=4 present');
  const dec = core.decodeState('?shape=circle&r=5&unit=ft');
  check(dec.shape === 'circle' && dec.r === '5' && dec.unit === 'ft', 'decode: full URL parses correctly');
  const res = core.resolveState(dec);
  check(res.shape === 'circle', 'resolve: shape=circle');
  check(res.params.r === '5', 'resolve: params.r=5');
  const bad = core.resolveState({ shape: 'wat-shape' });
  check(bad.shape === 'rectangle', 'resolve: invalid shape → rectangle fallback');
}
// ---------------------------------------------------------------
// Category 9: sample + reset state
// ---------------------------------------------------------------
{
  const env = buildAndLoad('');
  const core = env.ctx.HT.areaVolumeCore;
  const sample = core.SAMPLE['cylinder-3d'];
  check(sample.r === 2 && sample.h === 5, 'cylinder sample: r=2 h=5');
  const sampleRect = core.SAMPLE['rectangle'];
  check(sampleRect.w === 12 && sampleRect.h === 10, 'rectangle sample: 12×10');
}
// ---------------------------------------------------------------
// Category 10: reduced motion CSS
// ---------------------------------------------------------------
check(/prefers-reduced-motion: reduce/.test(CSS_SRC), 'CSS: prefers-reduced-motion query');
check(/\[data-reduced-motion="true"\]/.test(CSS_SRC), 'CSS: data-reduced-motion selector');
check(/transition: none/.test(CSS_SRC), 'CSS: transition disabled under reduced motion');
// ---------------------------------------------------------------
// Category 11: privacy (no fetch / XHR / console.error on boot)
// ---------------------------------------------------------------
{
  const env = buildAndLoad('?shape=rectangle&w=10&h=8');
  check(env.fetchCalls.length === 0, 'privacy: no fetch calls during boot');
  check(env.xhrCalls.length === 0, 'privacy: no XHR calls');
  check(env.consoleErrors.length === 0, 'privacy: no console.error');
}
// ---------------------------------------------------------------
// Category 12: tab-order-canonical in tools.json
// ---------------------------------------------------------------
{
  const toolsJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tools.json'), 'utf8'));
  const av = toolsJson.tools.find(t => t.id === 'area-volume');
  check(av !== undefined, 'tools.json: area-volume entry exists');
  const canon = (av && av['tab-order-canonical']) || [];
  check(Array.isArray(canon), 'tab-order-canonical: array');
  for (const sel of ['[data-av-shape="rectangle"]', '[data-action="sample"]', '[data-action="reset"]', '[data-action="print"]', '[data-action="share"]', '#av-result']) {
    check(canon.indexOf(sel) >= 0, 'tab-order-canonical: contains ' + sel);
  }
}
// ---------------------------------------------------------------
// Vacuous-pass guard
// ---------------------------------------------------------------
check(pass > 0, 'vacuous-pass guard: pass > 0');

console.log('');
console.log('area-volume-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);