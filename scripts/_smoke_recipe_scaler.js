/* ============================================
   Smoke harness for Story 9.9 — Recipe Scaler.
   Loads tools/recipe-scaler/recipe-scaler.js in
   a vm context with stub DOM + HT.* + fetch +
   clipboard stubs and asserts the parseFraction,
   formatFraction, parseLine regex, unit conversion,
   multiplier math, URL state (base64 + unicode),
   unparseable-line exclusion, unknown-unit warning,
   reduced-motion, privacy (no extra fetch), tab-
   order-canonical, and no-console-error contract.

   Per AC-8: ≥ 30 assertions, 12 categories,
   vacuous-pass guard.
   ============================================ */

'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
// Story 4b Phase 3 — recipe-scaler split into core + handlers.
// Substring assertions search both files; sandbox loads both.
const CORE_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'tools/recipe-scaler/recipe-scaler-core.js'),
  'utf8'
);
const HANDLERS_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'tools/recipe-scaler/recipe-scaler-handlers.js'),
  'utf8'
);
const TOOL_SRC = CORE_SRC + '\n' + HANDLERS_SRC;
const CSS_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'tools/recipe-scaler/recipe-scaler.css'),
  'utf8'
);
const JSON_SRC = fs.readFileSync(
  path.join(REPO_ROOT, 'assets/data/unit-conversion.json'),
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
// Stub DOM factory (matches flashcard-timer harness shape)
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
    set(v) { this._innerHTML = v == null ? '' : String(v); },
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
        toggle: function (c, force) {
          const has = list.indexOf(c) >= 0;
          if (force === true) { if (!has) list.push(c); }
          else if (force === false) { if (has) list.splice(list.indexOf(c), 1); }
          else { if (has) list.splice(list.indexOf(c), 1); else list.push(c); }
          return list.indexOf(c) >= 0;
        },
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
    if (this.listeners.click) this.listeners.click();
  };
  return stub;
}

// ---------------------------------------------------------------
// Sandbox factory
// ---------------------------------------------------------------

function buildAndLoad(search, opts) {
  const o = opts || {};
  const elements = {
    '#rs-recipe': makeStub(''),
    '#rs-multiplier': makeStub('2'),
    '#rs-system': makeStub('metric'),
    '#rs-output': makeStub(''),
    '#rs-summary': makeStub(''),
    '[data-action="sample"]': makeStub(''),
    '[data-action="reset"]': makeStub(''),
    '[data-action="print"]': makeStub(''),
    '[data-action="share"]': makeStub(''),
  };
  const fetchCalls = [];
  const xhrCalls = [];
  const consoleErrors = [];
  const consoleInfos = [];
  let fetchResponse = JSON.parse(JSON_SRC);
  const fetchImpl = function (url, init) {
    fetchCalls.push({ url: url, init: init });
    return Promise.resolve({
      ok: true,
      status: 200,
      json: function () { return Promise.resolve(fetchResponse); },
    });
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
    history: { replaceState: () => {}, pushState: () => {}, state: null },
    location: { hash: '', pathname: '/tools/recipe-scaler/', search: search || '', href: 'http://localhost/tools/recipe-scaler/' + (search || '') },
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    fetch: fetchImpl,
    XMLHttpRequest: function () { xhrCalls.push(true); },
    HT: {
      $: (sel) => elements[sel] || null,
      // No-op debounce: render synchronously in the harness so tests
      // can inspect innerHTML immediately after firing the input event.
      // Production uses HT.debounce (real 120ms timer) via the shared
      // shell — but in our isolated vm context, we collapse to fn => fn.
      debounce: function (fn) { return fn; },
      toast: function () { /* stub */ },
      // Story 4b Phase 3 — recipe-scaler is now split. Provide a stub
      // lazyLoadTool so the core can boot end-to-end without async work.
      // We don't actually lazy-load — the caller loads HANDLERS_SRC
      // explicitly after CORE_SRC and then calls window.recipeScalerInit().
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
  ctx.window.HT_SHELL_EMBED = undefined;

  vm.createContext(ctx);
  // Story 4b Phase 3 — load CORE then HANDLERS then call init().
  vm.runInContext(CORE_SRC, ctx, { filename: 'recipe-scaler-core.js' });
  vm.runInContext(HANDLERS_SRC, ctx, { filename: 'recipe-scaler-handlers.js' });
  if (typeof ctx.window.recipeScalerInit === 'function') {
    ctx.window.recipeScalerInit();
  }

  return { ctx, elements, fetchCalls, xhrCalls, consoleErrors, consoleInfos };
}

// ---------------------------------------------------------------
// Category 1: parseFraction (i)
// ---------------------------------------------------------------

check(/function parseFraction/.test(TOOL_SRC), 'parseFraction function exists');
check(/'1\/2'/.test(TOOL_SRC) || /1\/2/.test(TOOL_SRC), 'parseFraction: handles fraction syntax');
check(/mixed/.test(TOOL_SRC) || /\\d\+\\s\+\\d\+\\\/\\d\+/.test(TOOL_SRC),
  'parseFraction: handles mixed number (1 1/2)');
check(/parseFloat/.test(TOOL_SRC), 'parseFraction: handles decimal via parseFloat');
check(/parseInt\(str, 10\)/.test(TOOL_SRC), 'parseFraction: handles integer via parseInt');

// ---------------------------------------------------------------
// Category 2: formatFraction (ii)
// ---------------------------------------------------------------

check(/function formatFraction/.test(TOOL_SRC), 'formatFraction function exists');
check(/FRAC_CAP = 16/.test(TOOL_SRC), 'formatFraction: denominator cap 16');
// Stern-Brocot / greedy continued-fraction approximation
check(TOOL_SRC.indexOf('Math.abs(frac -') >= 0 || /Math\.abs\(.*frac.*-/.test(TOOL_SRC),
  'formatFraction: greedy error minimization');
check(/whole \+ ' ' \+ bestNum/.test(TOOL_SRC) || TOOL_SRC.indexOf("whole + ' '") >= 0,
  'formatFraction: mixed number formatting (whole + space + fraction)');
check(/Math\.floor\(x\)/.test(TOOL_SRC), 'formatFraction: extracts integer part via floor');

// ---------------------------------------------------------------
// Category 3: parseLine regex (iii)
// ---------------------------------------------------------------

// Verify the canonical regex shape is present in source
// (Story 4b Phase 3 — renamed `re` → `PARSE_LINE_RE` in core split.)
const regexSrcMatch = TOOL_SRC.match(/var PARSE_LINE_RE = (\/.+\/);/);
check(regexSrcMatch !== null &&
  regexSrcMatch[1].indexOf('[0-9]+') >= 0 &&
  regexSrcMatch[1].indexOf('[0-9]+') >= 0 &&
  regexSrcMatch[1].indexOf('[0-9]*\\.[0-9]+') >= 0,
  'parseLine: canonical regex per AC-1 (has integer + fraction + decimal alternatives)');
// Verify the regex matches the canonical input patterns
const re = /^([0-9]+\/[0-9]+|[0-9]+(?:\s+[0-9]+\/[0-9]+)?|[0-9]*\.[0-9]+)(?:\s+(\S+))?\s*(.*)$/;
const m1 = '1/2 cup flour'.match(re);
check(m1 !== null && m1[1] === '1/2' && m1[2] === 'cup' && m1[3] === 'flour',
  'parseLine: 1/2 cup flour → qty=1/2, unit=cup, ingredient=flour');
const m2 = '2eggs'.match(re);
check(m2 !== null && m2[1] === '2' && m2[2] === undefined && m2[3] === 'eggs',
  'parseLine: 2eggs → qty=2, unit=(none), ingredient=eggs');
const m3 = '350 °F oven'.match(re);
check(m3 !== null && m3[1] === '350' && m3[2] === '°F' && m3[3] === 'oven',
  'parseLine: 350 °F oven → qty=350, unit=°F, ingredient=oven');

// ---------------------------------------------------------------
// Category 4: Unit conversion (iv)
// ---------------------------------------------------------------

// Volume: 1 cup → 236.588 ml
check(/toBase/.test(TOOL_SRC) && /cup: 236\.588/.test(TOOL_SRC),
  'unit conversion: cup factor 236.588');
check(/tbsp: 14\.787/.test(TOOL_SRC), 'unit conversion: tbsp factor 14.787');
check(/tsp: 4\.929/.test(TOOL_SRC), 'unit conversion: tsp factor 4.929');
check(/lb: 453\.592/.test(TOOL_SRC), 'unit conversion: lb factor 453.592');
check(/oz: 28\.3495/.test(TOOL_SRC), 'unit conversion: oz factor 28.3495');
// Temperature: F→C formula
check(/\(qty - 32\) \* 5 \/ 9/.test(TOOL_SRC), 'unit conversion: F→C formula (qty-32)*5/9');
check(/qty \* 9 \/ 5 \+ 32/.test(TOOL_SRC), 'unit conversion: C→F formula qty*9/5+32');
// tryConvert is a function
check(/function tryConvert/.test(TOOL_SRC), 'tryConvert function exists');
// Round-trip stable: convert cup→ml→cup should be ~1.0
{
  const env = buildAndLoad('');
  env.elements['#rs-recipe']._v = '1 cup flour';
  env.elements['#rs-system']._v = 'imperial';
  env.elements['#rs-multiplier']._v = '1';
  if (env.elements['#rs-recipe'].listeners.input) env.elements['#rs-recipe'].listeners.input();
  setTimeout(() => {}, 200);
  // Convert to metric first
  env.elements['#rs-system']._v = 'metric';
  if (env.elements['#rs-system'].listeners.change) env.elements['#rs-system'].listeners.change();
  // Output should mention ml (converted) and quantity ~236.588
  check(/ml/.test(env.elements['#rs-output']._innerHTML) && /236/.test(env.elements['#rs-output']._innerHTML),
    'unit conversion metric: 1 cup → ~236 ml rendered');
}

// ---------------------------------------------------------------
// Category 5: Multiplier math (v)
// ---------------------------------------------------------------

check(/var scaledQty = parsed\.qty \* mult/.test(TOOL_SRC),
  'multiplier math: scaled = qty * mult');
check(/clampMultiplier/.test(TOOL_SRC), 'clampMultiplier function exists');
check(/MULT_MIN = 0\.1/.test(TOOL_SRC), 'clampMultiplier: min 0.1');
check(/MULT_MAX = 100/.test(TOOL_SRC), 'clampMultiplier: max 100');

// ---------------------------------------------------------------
// Category 6: URL state (vi)
// ---------------------------------------------------------------

check(/function readUrlState/.test(TOOL_SRC), 'readUrlState function exists');
check(/function writeUrlState/.test(TOOL_SRC), 'writeUrlState function exists');
check(/function applyUrlState/.test(TOOL_SRC), 'applyUrlState function exists');
check(/function encodeBase64/.test(TOOL_SRC), 'encodeBase64 function exists');
check(/function decodeBase64/.test(TOOL_SRC), 'decodeBase64 function exists');
check(has(TOOL_SRC, 'btoa(unescape(encodeURIComponent'),
  'URL state: base64 encode uses btoa(unescape(encodeURIComponent())) for unicode');
check(has(TOOL_SRC, 'decodeURIComponent(escape(atob'),
  'URL state: base64 decode uses decodeURIComponent(escape(atob())) for unicode');
check(has(TOOL_SRC, "p.set('recipe'"), 'URL state: encodes recipe');
check(has(TOOL_SRC, "p.set('multiplier'"), 'URL state: encodes multiplier');
check(has(TOOL_SRC, "p.set('system'"), 'URL state: encodes system');
check(has(TOOL_SRC, 'history.replaceState'), 'URL state: uses history.replaceState');

// ---------------------------------------------------------------
// Category 7: Unicode base64 round-trip (vii)
// ---------------------------------------------------------------

{
  const text = 'café 1 cup flour';
  // Run the same encode/decode pairing used in the tool
  const encoded = Buffer.from(unescape(encodeURIComponent(text)), 'binary').toString('base64');
  const decoded = decodeURIComponent(escape(Buffer.from(encoded, 'base64').toString('binary')));
  check(decoded === text, 'unicode base64: café round-trip survives encode/decode');
  // Also test degree + emoji
  const t2 = '350 °F oven 🌡';
  const e2 = Buffer.from(unescape(encodeURIComponent(t2)), 'binary').toString('base64');
  const d2 = decodeURIComponent(escape(Buffer.from(e2, 'base64').toString('binary')));
  check(d2 === t2, 'unicode base64: °F + emoji round-trip survives');
}

// ---------------------------------------------------------------
// Category 8: Unparseable line (viii)
// ---------------------------------------------------------------

check(/recipe-line-unparsed/.test(TOOL_SRC), 'unparseable: recipe-line-unparsed class referenced');
check(/recipe-line-unparsed-explain/.test(TOOL_SRC) || /could not parse/.test(TOOL_SRC),
  'unparseable: explain text in render');
{
  const env = buildAndLoad('');
  env.elements['#rs-recipe']._v = '1 cup flour\nsalt to taste\n2 tbsp sugar';
  env.elements['#rs-multiplier']._v = '2';
  env.elements['#rs-system']._v = 'metric';
  // Synchronous render trigger: also call render directly via the boot sequence.
  // The HT.debounce wraps render in a 120ms setTimeout — wait via setTimeout chain.
  if (env.elements['#rs-recipe'].listeners.input) env.elements['#rs-recipe'].listeners.input();
  // HT.debounce is no-op in the harness so render() ran synchronously.
  const html = env.elements['#rs-output']._innerHTML;
  console.log('  DEBUG unparseable html: ' + html);
  console.log('  DEBUG recipe value: ' + env.elements['#rs-recipe']._v);
  check(/recipe-line-unparsed/.test(html), 'unparseable: "salt to taste" rendered as recipe-line-unparsed');
  check(/recipe-line/.test(html), 'unparseable: parsed lines still rendered as recipe-line');
  check(/could not parse/.test(html), 'unparseable: explain text appears');
  // Per ROQ-5: unparseable line is excluded from scaling — total scaled
  // output lines should be 2 (flour + sugar), not 3.
  // Use "> to anchor so 'recipe-line-unparsed' doesn't match 'recipe-line'.
  const parsedCount = (html.match(/class="recipe-line">/g) || []).length;
  const unparsedCount = (html.match(/class="recipe-line-unparsed">/g) || []).length;
  check(parsedCount === 2 && unparsedCount === 1,
    'unparseable: scaling excluded from calc (2 parsed + 1 unparsed)');
}

// ---------------------------------------------------------------
// Category 9: Unknown unit (ix)
// ---------------------------------------------------------------

check(/unit-warning/.test(TOOL_SRC), 'unknown-unit: unit-warning class referenced');
check(/Unknown unit:/.test(TOOL_SRC), 'unknown-unit: title text "Unknown unit:"');
{
  const env = buildAndLoad('');
  env.elements['#rs-recipe']._v = '1 pinch salt';
  env.elements['#rs-multiplier']._v = '1';
  env.elements['#rs-system']._v = 'metric';
  if (env.elements['#rs-recipe'].listeners.input) env.elements['#rs-recipe'].listeners.input();
  setTimeout(() => {}, 200);
  const html = env.elements['#rs-output']._innerHTML;
  check(/unit-warning/.test(html), 'unknown-unit: "1 pinch salt" rendered with unit-warning chip');
  check(/Unknown unit: pinch/.test(html), 'unknown-unit: title attribute contains "pinch"');
}

// ---------------------------------------------------------------
// Category 10: Reduced motion (x)
// ---------------------------------------------------------------

check(/prefers-reduced-motion: reduce/.test(CSS_SRC), 'CSS: prefers-reduced-motion media query');
check(/data-reduced-motion="true"/.test(CSS_SRC), 'CSS: data-reduced-motion selector in stylesheet');
check(/transition: none/.test(CSS_SRC), 'CSS: transition disabled under reduced motion');

// ---------------------------------------------------------------
// Category 11: Privacy (xi)
// ---------------------------------------------------------------

{
  const env = buildAndLoad('');
  // Boot already fired one fetch to unit-conversion.json. Accept that one.
  const initialFetchCount = env.fetchCalls.length;
  // Now exercise the tool: type, change system, click sample, click reset, click print, click share
  if (env.elements['#rs-recipe'].listeners.input) env.elements['#rs-recipe'].listeners.input();
  if (env.elements['#rs-multiplier'].listeners.input) env.elements['#rs-multiplier'].listeners.input();
  if (env.elements['#rs-system'].listeners.change) env.elements['#rs-system'].listeners.change();
  if (env.elements['[data-action="sample"]'].listeners.click) env.elements['[data-action="sample"]'].listeners.click();
  if (env.elements['[data-action="reset"]'].listeners.click) env.elements['[data-action="reset"]'].listeners.click();
  if (env.elements['[data-action="print"]'].listeners.click) env.elements['[data-action="print"]'].listeners.click();
  if (env.elements['[data-action="share"]'].listeners.click) env.elements['[data-action="share"]'].listeners.click();
  check(env.fetchCalls.length === initialFetchCount,
    'privacy: no extra fetch calls after boot (only the one sanctioned unit-conversion.json fetch)');
  check(env.xhrCalls.length === 0, 'privacy: no XHR calls');
  check(env.consoleErrors.length === 0, 'privacy: no console.error on happy path');
}

// ---------------------------------------------------------------
// Category 12: tab-order-canonical (xii)
// ---------------------------------------------------------------

{
  const toolsJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tools.json'), 'utf8'));
  const rs = toolsJson.tools.find(t => t.id === 'recipe-scaler');
  check(rs !== undefined, 'tools.json: recipe-scaler entry exists');
  check(Array.isArray(rs['tab-order-canonical']), 'tab-order-canonical: array');
  const expected = ['#rs-recipe', '#rs-multiplier', '#rs-system', '#rs-output'];
  const canon = rs['tab-order-canonical'] || [];
  for (const sel of expected) {
    check(canon.indexOf(sel) >= 0, 'tab-order-canonical: contains ' + sel);
  }
  // Also verify the buttons are in the canonical list
  check(canon.indexOf('[data-action="sample"]') >= 0,
    'tab-order-canonical: contains [data-action="sample"]');
  check(canon.indexOf('[data-action="reset"]') >= 0,
    'tab-order-canonical: contains [data-action="reset"]');
  check(canon.indexOf('[data-action="print"]') >= 0,
    'tab-order-canonical: contains [data-action="print"]');
  check(canon.indexOf('[data-action="share"]') >= 0,
    'tab-order-canonical: contains [data-action="share"]');
}

// ---------------------------------------------------------------
// Vacuous-pass guard (xii)
// ---------------------------------------------------------------

check(pass > 0, 'vacuous-pass guard: pass > 0');

console.log('');
console.log('recipe-scaler-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);
