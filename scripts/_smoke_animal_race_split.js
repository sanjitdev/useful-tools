#!/usr/bin/env node
/* Story 4b Phase 3 — animal-race core+handlers split smoke.

   Verifies the new animal-race-core.js + animal-race-handlers.js pair:
     - animal-race-core.js loads via vm sandbox without throwing
     - HT.animalRaceCore frozen handle exposes getAnimals/getState/getConstants
     - ANIMALS has 14 entries (cheetah, horse, lion, greyhound, elk, ostrich,
       coyote, rabbit, cat, human, pig, chicken, sloth, snail)
     - Constants match Story 4b plan (track=100m, default=30s, etc.)
     - animal-race-handlers.js loads after core and binds window.animalRaceInit
     - lazy-loadable via HT.lazyLoadTool API shape

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
const CORE_SRC = fs.readFileSync(path.join(REPO_ROOT, 'tools/animal-race/animal-race-core.js'), 'utf8');
const HANDLERS_SRC = fs.readFileSync(path.join(REPO_ROOT, 'tools/animal-race/animal-race-handlers.js'), 'utf8');

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
    window: { HT: HT, animalRaceInit: null },
    console: { warn: function () {}, log: function () {}, error: function () {} },
    document: {
      addEventListener: function () {},
      documentElement: { setAttribute: function () {} },
      readyState: 'complete',
      querySelectorAll: function () { return []; },
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    performance: { now: function () { return Date.now(); } },
    requestAnimationFrame: function (fn) { return 0; },
    cancelAnimationFrame: function () {},
  };
  // Mirror window.HT bindings.
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
// I. animal-race-core.js loads + exposes HT.animalRaceCore
// =============================================================
console.log('--- I. animal-race-core.js ---');
{
  const ctx = buildCtx();
  check(loadInto(ctx, CORE_SRC, 'animal-race-core.js'), 'animal-race-core.js loads without throwing');
  check(!!ctx.HT.animalRaceCore, 'HT.animalRaceCore exposed');
  check(Object.isFrozen(ctx.HT.animalRaceCore), 'HT.animalRaceCore is frozen (AD-14 internal handle)');
  check(typeof ctx.HT.animalRaceCore.getAnimals === 'function', 'HT.animalRaceCore.getAnimals is a function');
  check(typeof ctx.HT.animalRaceCore.getState === 'function', 'HT.animalRaceCore.getState is a function');
  check(typeof ctx.HT.animalRaceCore.getConstants === 'function', 'HT.animalRaceCore.getConstants is a function');

  const animals = ctx.HT.animalRaceCore.getAnimals();
  check(Array.isArray(animals), 'getAnimals() returns array');
  check(animals.length === 14, 'ANIMALS has 14 entries');

  const ids = ['cheetah', 'horse', 'lion', 'greyhound', 'elk', 'ostrich', 'coyote', 'rabbit', 'cat', 'human', 'pig', 'chicken', 'sloth', 'snail'];
  ids.forEach(function (id) {
    const found = animals.find(function (a) { return a.id === id; });
    check(!!found, 'ANIMALS has ' + id);
    if (found) {
      check(typeof found.name === 'string' && found.name.length > 0, '  ' + id + ' has name');
      check(typeof found.kmh === 'number' && found.kmh >= 0, '  ' + id + ' has kmh >= 0');
      check(typeof found.color === 'string' && found.color.startsWith('#'), '  ' + id + ' has #color');
      check(typeof found.svg === 'string' && found.svg.indexOf('<svg') === 0, '  ' + id + ' has inline SVG');
    }
  });

  // Speed sanity: cheetah fastest, snail slowest (non-human).
  const cheetah = animals.find(function (a) { return a.id === 'cheetah'; });
  const snail = animals.find(function (a) { return a.id === 'snail'; });
  check(cheetah.kmh > snail.kmh, 'cheetah faster than snail');

  // Human is marked isHuman.
  const human = animals.find(function (a) { return a.id === 'human'; });
  check(human.isHuman === true, 'human.isHuman === true');

  const C = ctx.HT.animalRaceCore.getConstants();
  check(C.TRACK_LENGTH_M === 100, 'TRACK_LENGTH_M = 100');
  check(C.DEFAULT_RACE_DURATION_S === 30, 'DEFAULT_RACE_DURATION_S = 30');
  check(C.MIN_RACE_DURATION_S === 2, 'MIN_RACE_DURATION_S = 2');
  check(Array.isArray(C.RACE_DURATION_OPTIONS) && C.RACE_DURATION_OPTIONS.indexOf(30) !== -1 && C.RACE_DURATION_OPTIONS.indexOf(60) !== -1, 'RACE_DURATION_OPTIONS contains 30 + 60');
  check(C.HUMAN_MAX_KMH === 80, 'HUMAN_MAX_KMH = 80');
  check(C.HUMAN_MIN_KMH === 1, 'HUMAN_MIN_KMH = 1');

  const state = ctx.HT.animalRaceCore.getState();
  check(state && typeof state === 'object', 'getState() returns state object');
  check(state.selected && typeof state.selected === 'object', 'state.selected is object');
  check(Array.isArray(state.racers), 'state.racers is array');
  check(state.running === false, 'state.running defaults to false');
  check(state.targetDurationS === 30, 'state.targetDurationS defaults to 30');
}

// =============================================================
// II. animal-race-handlers.js loads after core + binds window.animalRaceInit
// =============================================================
console.log('--- II. animal-race-handlers.js ---');
{
  const ctx = buildCtx();
  loadInto(ctx, CORE_SRC, 'animal-race-core.js (for handlers)');
  check(loadInto(ctx, HANDLERS_SRC, 'animal-race-handlers.js'), 'animal-race-handlers.js loads without throwing');
  check(typeof ctx.window.animalRaceInit === 'function', 'animal-race-handlers.js binds window.animalRaceInit');
}

// =============================================================
// III. animal-race-handlers.js missing core — warns and no-ops
// =============================================================
console.log('--- III. animal-race-handlers.js without core ---');
{
  const ctx = buildCtx();
  // No core loaded.
  check(loadInto(ctx, HANDLERS_SRC, 'animal-race-handlers.js without core'), 'handlers without core does not throw');
  check(ctx.window.animalRaceInit === null, 'handlers without core does not bind window.animalRaceInit');
}

// =============================================================
// IV. index.html references animal-race-core.js (not -race.js, not -handlers.js)
// =============================================================
console.log('--- IV. index.html script src ---');
{
  const html = fs.readFileSync(path.join(REPO_ROOT, 'tools/animal-race/index.html'), 'utf8');
  check(/src=["']\.\/animal-race-core\.js["']/.test(html), 'index.html loads animal-race-core.js');
  check(!/src=["']\.\/animal-race\.js["']/.test(html), 'index.html no longer loads animal-race.js');
  check(!/src=["']\.\/animal-race-handlers\.js["']/.test(html), 'index.html does NOT load animal-race-handlers.js (lazy-only)');
}

// =============================================================
// V. lazy-loadable: HT.lazyLoadTool exists and core's boot path
//    doesn't fail when lazyLoadTool is a no-op.
// =============================================================
console.log('--- V. boot path with lazyLoadTool stub ---');
{
  const ctx = buildCtx();
  ctx.HT.lazyLoadTool = function (slug, url) {
    return Promise.resolve();
  };
  check(loadInto(ctx, CORE_SRC, 'animal-race-core.js boot with lazyLoadTool stub'), 'core boot with lazyLoadTool stub OK');
}

// =============================================================
// Vacuous-pass guard
// =============================================================

if (pass === 0 && fail === 0) {
  console.error('animal-race-split-smoke: VACUOUS — no assertions ran');
  process.exit(1);
}

console.log('');
console.log('animal-race-split-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);
