#!/usr/bin/env node
/* Story 4b Phase 2 + Story 9.13 — lifespan-simulator core+handlers split
   + quiz-mode smoke.

   Sections I-V (Story 4b):
     - lifespan-simulator-core.js loads via vm sandbox without throwing
     - HT.lifespanSimulatorCore frozen handle exposes WHO_DELTAS, COUNTRIES,
       COUNTRY_BY_CODE, all 22 enum tables (SMOKING/STRESS/BP/DIABETES/HEART/
       CHOLESTEROL/CANCER/DEPRESSION/SEATBELT/MOTORCYCLE/DRUGS/CHECKUPS/
       VACCINES/DENTAL/FRUITVEG/SUN/POLLUTION/INCOME/EDUCATION/RELATIONSHIP),
       baselineFor, pickEnum, clamp
     - WHO_DELTAS scale convention is preserved (SCALE_MIN, SCALE_MAX,
       SYNERGY_SMOKING_ALCOHOL, SYNERGY_SMOKING_SEDENTARY)
     - pickEnum returns the right entry for known values; null for unknown
     - clamp clamps to bounds
     - lifespan-simulator-handlers.js loads after core and binds
       window.lifespanSimulatorInit
     - lazy-loadable via HT.lazyLoadTool API shape

   Sections VI-X (Story 9.13):
     - VI. Quiz wiring present in handlers.js (LIFESPAN_QUESTIONS,
       buildLifespanReveal, mountLifespanQuiz, toggleQuizMode,
       wireQuizToggle, storageKey _registry-lifespan-simulator)
     - VII. 36 question ids match the keys evaluate() reads (1:1
       with the form's input shape so skip = neutral default)
     - VIII. buildLifespanReveal calls evaluate() + baselineFor() in
       scope and returns a node containing the headline number
     - IX. index.html has ls-quiz-mount + ls-quiz-toggle; no eager
       quiz.js / quiz.css tags (Story 4c Proxy handles it)
     - X. AD-14 boundaries — no bare navigator.clipboard.writeText,
       no bare window.print(), share uses HT.copyToClipboard, print
       uses HT.share.print

   Pure-Node smoke (no jsdom / playwright). Runs in a vm sandbox with
   minimal HT + dom stubs.

   Exit codes:
     0 — all assertions PASS
     1 — at least one assertion failed
*/

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const CORE_SRC = fs.readFileSync(path.join(REPO_ROOT, 'tools/lifespan-simulator/lifespan-simulator-core.js'), 'utf8');
const HANDLERS_SRC = fs.readFileSync(path.join(REPO_ROOT, 'tools/lifespan-simulator/lifespan-simulator-handlers.js'), 'utf8');
const HTML_SRC = fs.readFileSync(path.join(REPO_ROOT, 'tools/lifespan-simulator/index.html'), 'utf8');

let pass = 0;
let fail = 0;
function check(cond, label) {
  if (cond) { pass += 1; console.log('  PASS  ' + label); }
  else      { fail += 1; console.log('  FAIL  ' + label); }
}

// =============================================================
// Minimal HT + dom stubs
// =============================================================

function buildCtx() {
  const HT = {
    storage: {
      _store: {},
      get: function (k, dflt) { return Object.prototype.hasOwnProperty.call(this._store, k) ? this._store[k] : dflt; },
      set: function (k, v) { this._store[k] = v; },
      remove: function (k) { delete this._store[k]; },
    },
    $: function (sel) { return null; },
    qsa: function () { return []; },
    debounce: function (fn) { return fn; },
    formatNumber: function (n) { return String(n); },
    formatDate: function (d) { return d.toISOString(); },
    copyToClipboard: function () { return Promise.resolve(); },
    toast: function () {},
    share: { print: function () {} },
    lazyLoadTool: function () { return Promise.resolve(); },
  };
  const ctx = {
    HT: HT,
    window: { HT: HT, lifespanSimulatorInit: null },
    console: { warn: function () {}, log: function () {}, error: function () {} },
    document: {
      addEventListener: function () {},
      documentElement: { setAttribute: function () {} },
      readyState: 'complete',
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    btoa: function (s) { return Buffer.from(s, 'binary').toString('base64'); },
    atob: function (s) { return Buffer.from(s, 'base64').toString('binary'); },
    location: { hash: '' },
    history: { replaceState: function () {} },
    JSON: JSON,
  };
  ctx.window.HT = HT;
  return ctx;
}

function loadInto(ctx, src, label) {
  try {
    vm.runInContext(src, vm.createContext(ctx), { filename: label });
    return true;
  } catch (err) {
    console.log('  FAIL  load ' + label + ' threw: ' + err.message);
    fail += 1;
    return false;
  }
}

// =============================================================
// I. lifespan-simulator-core.js loads + exposes HT.lifespanSimulatorCore
// =============================================================
console.log('--- I. lifespan-simulator-core.js ---');
{
  const ctx = buildCtx();
  check(loadInto(ctx, CORE_SRC, 'lifespan-simulator-core.js'), 'lifespan-simulator-core.js loads without throwing');
  check(!!ctx.HT.lifespanSimulatorCore, 'HT.lifespanSimulatorCore exposed');
  check(Object.isFrozen(ctx.HT.lifespanSimulatorCore), 'HT.lifespanSimulatorCore is frozen (AD-14 internal handle)');

  const core = ctx.HT.lifespanSimulatorCore;
  // 22 enum tables (per plan: 22 enums in core)
  const enums = ['SMOKING', 'STRESS', 'BP', 'DIABETES', 'HEART', 'CHOLESTEROL',
                 'CANCER', 'DEPRESSION', 'SEATBELT', 'MOTORCYCLE', 'DRUGS',
                 'CHECKUPS', 'VACCINES', 'DENTAL', 'FRUITVEG', 'SUN', 'POLLUTION',
                 'INCOME', 'EDUCATION', 'RELATIONSHIP'];
  enums.forEach(function (e) {
    check(typeof core[e] === 'object' && core[e] !== null, e + ' table is exposed');
  });

  // WHO_DELTAS scale convention
  check(core.WHO_DELTAS.SCALE_MIN === -10.0, 'WHO_DELTAS.SCALE_MIN = -10.0');
  check(core.WHO_DELTAS.SCALE_MAX === 10.0, 'WHO_DELTAS.SCALE_MAX = 10.0');
  check(core.WHO_DELTAS.SYNERGY_SMOKING_ALCOHOL === -1.5, 'WHO_DELTAS.SYNERGY_SMOKING_ALCOHOL = -1.5');
  check(core.WHO_DELTAS.SYNERGY_SMOKING_SEDENTARY === -1.0, 'WHO_DELTAS.SYNERGY_SMOKING_SEDENTARY = -1.0');

  // COUNTRIES table
  check(Array.isArray(core.COUNTRIES) && core.COUNTRIES.length > 40, 'COUNTRIES has > 40 entries');
  check(core.COUNTRIES[0].code === 'BD', 'first country is BD (Bangladesh)');
  check(core.COUNTRIES[core.COUNTRIES.length - 1].code === 'GLOBAL', 'last country is GLOBAL');

  // COUNTRY_BY_CODE
  check(core.COUNTRY_BY_CODE['BD'].name === 'Bangladesh', 'COUNTRY_BY_CODE[BD] = Bangladesh');
  check(core.COUNTRY_BY_CODE['US'].name === 'United States', 'COUNTRY_BY_CODE[US] = United States');
  check(core.COUNTRY_BY_CODE['GLOBAL'].name === 'Global average', 'COUNTRY_BY_CODE[GLOBAL] = Global average');

  // baselineFor
  check(core.baselineFor('BD', 'male') === 71.4, 'baselineFor(BD, male) = 71.4');
  check(core.baselineFor('BD', 'female') === 74.6, 'baselineFor(BD, female) = 74.6');
  check(core.baselineFor('US', 'male') === 76.4, 'baselineFor(US, male) = 76.4');
  check(core.baselineFor('XX', 'male') === core.COUNTRY_BY_CODE.GLOBAL.male, 'baselineFor unknown = GLOBAL');

  // pickEnum
  check(core.pickEnum(core.SMOKING, 'never').delta === 0, 'SMOKING.never.delta = 0');
  check(core.pickEnum(core.SMOKING, 'daily').delta === -9.0, 'SMOKING.daily.delta = -9.0');
  check(core.pickEnum(core.SMOKING, 'unknown') === null, 'pickEnum returns null for unknown');

  // clamp
  check(core.clamp(5, 0, 10) === 5, 'clamp(5, 0, 10) = 5');
  check(core.clamp(-5, 0, 10) === 0, 'clamp(-5, 0, 10) = 0');
  check(core.clamp(15, 0, 10) === 10, 'clamp(15, 0, 10) = 10');
}

// =============================================================
// II. lifespan-simulator-handlers.js loads after core + binds window.lifespanSimulatorInit
// =============================================================
console.log('--- II. lifespan-simulator-handlers.js ---');
{
  const ctx = buildCtx();
  loadInto(ctx, CORE_SRC, 'lifespan-simulator-core.js (for handlers)');
  check(loadInto(ctx, HANDLERS_SRC, 'lifespan-simulator-handlers.js'), 'lifespan-simulator-handlers.js loads without throwing');
  check(typeof ctx.window.lifespanSimulatorInit === 'function', 'lifespan-simulator-handlers.js binds window.lifespanSimulatorInit');
}

// =============================================================
// III. lifespan-simulator-handlers.js missing core — warns and no-ops
// =============================================================
console.log('--- III. lifespan-simulator-handlers.js without core ---');
{
  const ctx = buildCtx();
  // No core loaded.
  check(loadInto(ctx, HANDLERS_SRC, 'lifespan-simulator-handlers.js without core'), 'handlers without core does not throw');
  check(ctx.window.lifespanSimulatorInit === null, 'handlers without core does not bind window.lifespanSimulatorInit');
}

// =============================================================
// IV. index.html script src wiring
// =============================================================
console.log('--- IV. index.html script src ---');
{
  const html = fs.readFileSync(path.join(REPO_ROOT, 'tools/lifespan-simulator/index.html'), 'utf8');
  check(html.indexOf('./lifespan-simulator-core.js') > 0, 'index.html loads lifespan-simulator-core.js');
  check(html.indexOf('./lifespan-simulator.js') === -1, 'index.html no longer loads lifespan-simulator.js');
  check(html.indexOf('./lifespan-simulator-handlers.js') === -1, 'index.html does NOT load lifespan-simulator-handlers.js (lazy-only)');
}

// =============================================================
// V. boot path with lazyLoadTool stub
// =============================================================
console.log('--- V. boot path with lazyLoadTool stub ---');
{
  const ctx = buildCtx();
  let lazyCalled = null;
  ctx.HT.lazyLoadTool = function (slug, url) {
    lazyCalled = { slug: slug, url: url };
    return Promise.resolve();
  };
  ctx.window.lifespanSimulatorInit = function () { ctx.window._initRan = true; };

  check(loadInto(ctx, CORE_SRC, 'lifespan-simulator-core.js (boot stub)'), 'core boot with lazyLoadTool stub OK');
  check(lazyCalled !== null, 'boot invoked HT.lazyLoadTool');
  if (lazyCalled) {
    check(lazyCalled.slug === 'lifespan-simulator', 'lazyLoadTool called with slug "lifespan-simulator"');
    check(lazyCalled.url === './lifespan-simulator-handlers.js', 'lazyLoadTool called with handlers URL');
  }
}

// =============================================================
// VI. Quiz wiring present in handlers.js (Story 9.13)
// =============================================================
console.log('--- VI. Quiz wiring in handlers.js ---');
{
  check(/var LIFESPAN_QUESTIONS\s*=\s*\[/.test(HANDLERS_SRC), 'LIFESPAN_QUESTIONS array declared');
  check(/function buildLifespanReveal/.test(HANDLERS_SRC), 'buildLifespanReveal() defined');
  check(/function mountLifespanQuiz/.test(HANDLERS_SRC), 'mountLifespanQuiz() defined');
  check(/function toggleQuizMode/.test(HANDLERS_SRC), 'toggleQuizMode() defined');
  check(/function wireQuizToggle/.test(HANDLERS_SRC), 'wireQuizToggle() defined');
  check(/'_registry-lifespan-simulator'/.test(HANDLERS_SRC), 'storageKey is _registry-lifespan-simulator');
  check(/HT\.quiz\.open\(/.test(HANDLERS_SRC), 'handlers calls HT.quiz.open');
  check(/state\.answers\s*=/.test(HANDLERS_SRC), 'onChange writes to state.answers (Plan tab interop)');
  check(/HT\.copyToClipboard/.test(HANDLERS_SRC), 'share handler uses HT.copyToClipboard (Shell Public API)');
  check(/HT\.share\.print/.test(HANDLERS_SRC), 'print handler uses HT.share.print (Shell Public API)');
}

// =============================================================
// VII. LIFESPAN_QUESTIONS ids match the keys evaluate() reads
// =============================================================
console.log('--- VII. Question ids match evaluate() keys ---');
{
  // Extract question ids by matching `id: 'xxx'` inside LIFESPAN_QUESTIONS only.
  // We isolate the array by capturing from `var LIFESPAN_QUESTIONS` until
  // the closing `];` — the array is the first thing after that var, and
  // no nested `];` appears inside.
  const arrayMatch = HANDLERS_SRC.match(/var LIFESPAN_QUESTIONS\s*=\s*\[([\s\S]*?)\];/);
  check(!!arrayMatch, 'LIFESPAN_QUESTIONS array body extractable');
  if (arrayMatch) {
    const body = arrayMatch[1];
    const ids = Array.from(new Set((body.match(/id:\s*'([a-z]+)'/g) || []).map(function (s) {
      return s.match(/'([a-z]+)'/)[1];
    })));
    check(ids.length === 36, 'LIFESPAN_QUESTIONS has 36 entries (actual: ' + ids.length + ')');
    // Every id that evaluate() reads (excluding bmi which is derived
    // from height/weight) must be present.
    const required = [
      'dob', 'sex', 'country', 'height', 'weight', 'alcohol', 'exercise', 'sleep',
      'smoking', 'stress', 'fruitveg', 'seatbelt', 'drugs', 'checkups',
      'bp', 'diabetes', 'heart', 'cholesterol', 'cancer', 'depression',
      'familyheart', 'familycancer', 'familydiabetes',
      'motorcycle', 'vaccines', 'dental', 'pollution', 'income',
      'education', 'relationship', 'sun',
      'fastfood', 'water', 'sitting', 'steps', 'screen'
    ];
    const missing = required.filter(function (r) { return ids.indexOf(r) < 0; });
    check(missing.length === 0, 'all required ids present (missing: ' + (missing.length ? missing.join(',') : 'none') + ')');
    // Each id must be unique.
    const dupes = ids.filter(function (id, i) { return ids.indexOf(id) !== i; });
    check(dupes.length === 0, 'all ids unique (dupes: ' + (dupes.length ? dupes.join(',') : 'none') + ')');
  }
}

// =============================================================
// VIII. buildLifespanReveal calls evaluate() + baselineFor()
// =============================================================
console.log('--- VIII. buildLifespanReveal uses evaluate() + baselineFor() ---');
{
  // The reveal function lives inside the handlers IIFE, so its in-scope
  // evaluate() and baselineFor() are the same functions form mode uses.
  // Verify the function body contains the right calls + returns a node.
  check(/function buildLifespanReveal\([\s\S]*?evaluate\(ans\)[\s\S]*?baselineFor\(ans\.country, ans\.sex\)[\s\S]*?return\s+\w+;/.test(HANDLERS_SRC),
    'buildLifespanReveal calls evaluate(ans) + baselineFor(ans.country, ans.sex) and returns a node');
  check(/quiz-reveal-headline/.test(HANDLERS_SRC), 'reveal uses .quiz-reveal-headline class');
  check(/quiz-reveal-custom/.test(HANDLERS_SRC), 'reveal uses .quiz-reveal-custom wrapper');
  check(/data-action="share"/.test(HANDLERS_SRC), 'reveal has share button');
  check(/data-action="print"/.test(HANDLERS_SRC), 'reveal has print button');
  check(/data-action="reset"/.test(HANDLERS_SRC), 'reveal has reset button');
  check(/Switch to advanced form view/.test(HANDLERS_SRC), 'reveal has form-view link');
  // Neutral-default merge: skip = neutral (matches evaluate() skip contract).
  check(/Object\.keys\(answers\)\.forEach/.test(HANDLERS_SRC), 'reveal merges answers over neutral defaults');
  // BMI derivation from height+weight (the quiz doesn't ask for BMI directly).
  check(/answers\.weight\s*\/\s*Math\.pow\(answers\.height/.test(HANDLERS_SRC),
    'reveal derives bmi from height+weight when both present');
}

// =============================================================
// IX. index.html: ls-quiz-mount + ls-quiz-toggle; no eager quiz tags
// =============================================================
console.log('--- IX. index.html quiz wiring ---');
{
  check(/id="ls-quiz-mount"/.test(HTML_SRC), 'ls-quiz-mount div present');
  check(/id="ls-quiz-toggle"/.test(HTML_SRC), 'ls-quiz-toggle button present');
  check(/data-quiz-host="form"/.test(HTML_SRC), 'form panels wrapped in data-quiz-host="form"');
  // Story 4c lazy-load: NO eager <script src="quiz.js"> or <link href="quiz.css">.
  check(!/src=["'][^"']*assets\/js\/quiz\.js["']/.test(HTML_SRC), 'no eager <script src=".../quiz.js"> (Story 4c Proxy)');
  check(!/href=["'][^"']*assets\/css\/quiz\.css["']/.test(HTML_SRC), 'no eager <link href=".../quiz.css"> (Story 4c Proxy)');
}

// =============================================================
// X. AD-14 boundaries preserved (no bare clipboard/print)
// =============================================================
console.log('--- X. AD-14 boundaries ---');
{
  check(!/navigator\.clipboard\.writeText\s*\(/.test(HANDLERS_SRC), 'no bare navigator.clipboard.writeText (AD-14)');
  check(!/window\.print\s*\(/.test(HANDLERS_SRC), 'no bare window.print() call (AD-14)');
  check(/HT\.copyToClipboard/.test(HANDLERS_SRC), 'share routes through HT.copyToClipboard');
  check(/HT\.share\.print\(\s*['"]lifespan-simulator['"]/.test(HANDLERS_SRC), 'print routes through HT.share.print("lifespan-simulator")');
}

console.log('');
console.log('lifespan-simulator-split-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);