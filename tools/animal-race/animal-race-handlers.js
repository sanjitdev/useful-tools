/* ============================================
   Animal Race — animal-race-handlers.js (Story 4b Phase 3)
   Lazy chunk: holds all event handlers, race loop, render, wiring.
   Loaded via HT.lazyLoadTool('animal-race', './animal-race-handlers.js')
   on DOMContentLoaded by core.js.

   Read-only access to ANIMALS + state + constants via HT.animalRaceCore.

   Story 4b — see _bmad-output/implementation-artifacts/
   story-4b-per-tool-code-splitting.md
   ============================================ */

(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.HT) return;
  if (!window.HT.animalRaceCore) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('animal-race-handlers: HT.animalRaceCore missing — animal-race-core.js must load first.');
    }
    return;
  }
  var HT = window.HT;
  var core = HT.animalRaceCore;
  var ANIMALS = core.getAnimals();
  var state = core.getState();
  var C = core.getConstants();

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  function animalById(id) {
    for (var i = 0; i < ANIMALS.length; i++) {
      if (ANIMALS[i].id === id) return ANIMALS[i];
    }
    return null;
  }

  function kmhToMs(kmh) { return kmh * 1000 / 3600; }
  function realFinishS(kmh) { return C.TRACK_LENGTH_M / kmhToMs(kmh); }

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function formatTime(s) {
    return s.toFixed(2).padStart(5, '0') + 's';
  }

  // -------------------------------------------------------------
  // Build picker cards
  // -------------------------------------------------------------
  function buildPicker() {
    var grid = HT.$('#animal-grid');
    if (!grid) return;
    grid.innerHTML = '';
    ANIMALS.forEach(function (a) {
      var label = document.createElement('label');
      label.className = 'animal-card';
      label.style.setProperty('--animal-color', a.color);
      label.setAttribute('for', 'animal-' + a.id);
      label.innerHTML =
        '<input type="checkbox" id="animal-' + a.id + '" data-id="' + a.id + '">' +
        '<span class="animal-card-icon">' + a.svg + '</span>' +
        '<span class="animal-card-text">' +
          '<span class="animal-card-name">' + a.name + '</span>' +
          '<span class="animal-card-speed">' + (a.isHuman ? 'custom' : a.kmh + ' km/h') + '</span>' +
        '</span>';
      grid.appendChild(label);
    });
  }

  // -------------------------------------------------------------
  // Build lanes for currently-selected racers
  // -------------------------------------------------------------
  function rebuildLanes() {
    var lanes = HT.$('#lanes');
    if (!lanes) return;
    lanes.innerHTML = '';
    state.racers = [];

    var ids = Object.keys(state.selected).filter(function (id) { return state.selected[id]; });
    ids.forEach(function (id) {
      var a = animalById(id);
      if (!a) return;
      var kmh = a.isHuman ? getHumanSpeed() : a.kmh;
      if (!(kmh > 0)) return;
      var lane = document.createElement('div');
      lane.className = 'lane';
      lane.setAttribute('data-id', a.id);
      lane.innerHTML =
        '<div class="racer" data-id="' + a.id + '" style="--animal-color:' + a.color + '">' +
          '<span class="racer-icon">' + a.svg + '</span>' +
          '<span class="racer-name">' + a.name + '</span>' +
        '</div>';
      lanes.appendChild(lane);
      var racerEl = HT.$('.racer', lane);
      state.racers.push({
        id: a.id, name: a.name, kmh: kmh, color: a.color,
        laneEl: lane, racerEl: racerEl,
        finishTimeS: 0, progress: 0,
        finished: false, finishElapsedS: null,
      });
    });
  }

  // -------------------------------------------------------------
  // Compute finish times
  // -------------------------------------------------------------
  function computeFinishTimes() {
    if (state.racers.length === 0) return;

    var targetS = state.targetDurationS;
    var realTimes = state.racers.map(function (r) { return realFinishS(r.kmh); });
    var n = realTimes.length;
    var slowestIdx = 0, fastestIdx = 0;
    for (var i = 1; i < n; i++) {
      if (realTimes[i] > realTimes[slowestIdx]) slowestIdx = i;
      if (realTimes[i] < realTimes[fastestIdx]) fastestIdx = i;
    }

    var scale = targetS / realTimes[slowestIdx];

    if (realTimes[fastestIdx] * scale < C.MIN_RACE_DURATION_S) {
      scale = C.MIN_RACE_DURATION_S / realTimes[fastestIdx];
    }

    state.racers.forEach(function (r, i) {
      r.finishTimeS = realTimes[i] * scale;
    });
  }

  // -------------------------------------------------------------
  // Race loop
  // -------------------------------------------------------------
  function start() {
    if (state.running) return;
    if (state.racers.length === 0) return;

    state.running = true;
    setStartEnabled(false);
    document.querySelectorAll('input[type="checkbox"]').forEach(function (el) { el.disabled = true; });
    document.querySelectorAll('select, input[type="number"]').forEach(function (el) {
      if (el.id !== 'human-preset' && el.id !== 'human-custom') el.disabled = true;
    });
    HT.$('#human-toggle').disabled = true;
    HT.$('#human-preset').disabled = true;
    HT.$('#human-custom').disabled = true;
    HT.$('#race-duration').disabled = true;
    if (HT.$('#race-target-label')) {
      HT.$('#race-target-label').textContent = state.targetDurationS + 's race';
    }

    state.racers.forEach(function (r) {
      r.progress = 0;
      r.finished = false;
      r.finishElapsedS = null;
      r.racerEl.classList.remove('is-finished');
      r.racerEl.style.setProperty('--x', '0px');
    });

    HT.$('#results-panel').hidden = true;
    HT.$('#results-list').innerHTML = '';
    HT.$('#comparison').innerHTML = '';
    HT.$('#race-clock').classList.remove('is-done');
    HT.$('#race-clock').textContent = '00.00s';

    HT.$('#track-panel').hidden = false;
    setTimeout(function () {
      var p = HT.$('#track-panel');
      if (p && p.scrollIntoView) p.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 30);

    state.t0 = performance.now();
    state.rafId = requestAnimationFrame(tick);
  }

  function tick(now) {
    if (!state.running) return;
    var elapsedS = (now - state.t0) / 1000;
    HT.$('#race-clock').textContent = formatTime(elapsedS);

    var allDone = true;
    for (var i = 0; i < state.racers.length; i++) {
      var r = state.racers[i];
      if (r.finished) continue;
      r.progress = elapsedS / r.finishTimeS;
      if (r.progress >= 1) {
        r.progress = 1;
        r.finished = true;
        r.finishElapsedS = elapsedS;
        r.racerEl.classList.add('is-finished');
      } else {
        allDone = false;
      }
      var laneW = r.laneEl.clientWidth;
      var racerW = r.racerEl.clientWidth || 60;
      var x = r.progress * Math.max(0, laneW - racerW);
      r.racerEl.style.setProperty('--x', x + 'px');
    }

    if (allDone) {
      state.finishElapsedS = elapsedS;
      state.running = false;
      state.rafId = null;
      HT.$('#race-clock').classList.add('is-done');
      renderResults();
    } else {
      state.rafId = requestAnimationFrame(tick);
    }
  }

  // -------------------------------------------------------------
  // Results
  // -------------------------------------------------------------
  function renderResults() {
    var list = HT.$('#results-list');
    var comp = HT.$('#comparison');
    if (!list || !comp) return;

    var EPS = 1e-6;
    var ranked = state.racers.slice().sort(function (a, b) {
      if (Math.abs(a.finishElapsedS - b.finishElapsedS) > EPS) {
        return a.finishElapsedS - b.finishElapsedS;
      }
      return a.name.localeCompare(b.name);
    });

    list.innerHTML = '';
    ranked.forEach(function (r, idx) {
      var li = document.createElement('li');
      li.className = 'result-row';
      li.style.setProperty('--animal-color', r.color);
      li.innerHTML =
        '<div class="result-rank">' + (idx + 1) + '</div>' +
        '<div class="result-name">' +
          '<span class="result-name-main">' + r.name + '</span>' +
          '<span class="result-name-speed">' + r.kmh + ' km/h top speed</span>' +
        '</div>' +
        '<div class="result-time">' + r.finishElapsedS.toFixed(2) + 's</div>';
      list.appendChild(li);
    });

    var slowest = ranked[ranked.length - 1];
    comp.innerHTML = '';
    ranked.forEach(function (r) {
      if (r === slowest) return;
      var pct = ((r.kmh / slowest.kmh) - 1) * 100;
      var card = document.createElement('div');
      card.className = 'compare-card';
      card.style.setProperty('--animal-color', r.color);
      card.innerHTML =
        '<strong>' + r.name + '</strong> is ' + pct.toFixed(0) + '% faster than ' + slowest.name + '.';
      comp.appendChild(card);
    });

    HT.$('#results-panel').hidden = false;
    setTimeout(function () {
      var p = HT.$('#results-panel');
      if (p && p.scrollIntoView) p.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  // -------------------------------------------------------------
  // Reset
  // -------------------------------------------------------------
  function reset() {
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
    state.running = false;
    state.t0 = null;
    state.racers = [];

    HT.$('#track-panel').hidden = true;
    HT.$('#results-panel').hidden = true;
    HT.$('#lanes').innerHTML = '';
    HT.$('#race-clock').textContent = '00.00s';
    HT.$('#race-clock').classList.remove('is-done');

    document.querySelectorAll('input[type="checkbox"]').forEach(function (el) { el.disabled = false; });
    document.querySelectorAll('input[type="number"]').forEach(function (el) { el.disabled = false; });
    HT.$('#human-preset').disabled = !HT.$('#human-toggle').checked;
    HT.$('#human-custom').disabled = !(HT.$('#human-toggle').checked && HT.$('#human-preset').value === 'custom');
    HT.$('#race-duration').disabled = false;

    setStartEnabled(Object.keys(state.selected).filter(function (id) { return state.selected[id]; }).length > 0);
  }

  // -------------------------------------------------------------
  // Wiring
  // -------------------------------------------------------------
  function setStartEnabled(on) {
    var btn = HT.$('#start-btn');
    btn.disabled = !on;
    HT.$('#selection-count').textContent =
      Object.keys(state.selected).filter(function (id) { return state.selected[id]; }).length + ' racers selected';
  }

  function getHumanSpeed() {
    var preset = HT.$('#human-preset').value;
    if (preset === 'custom') {
      var v = parseFloat(HT.$('#human-custom').value);
      return isFinite(v) && v > 0 ? clamp(v, C.HUMAN_MIN_KMH, C.HUMAN_MAX_KMH) : 0;
    }
    return parseFloat(preset) || 24;
  }

  function onSelectionChange() {
    state.selected = {};
    document.querySelectorAll('#animal-grid input[type="checkbox"]').forEach(function (cb) {
      if (cb.checked) state.selected[cb.dataset.id] = true;
    });
    setStartEnabled(Object.keys(state.selected).filter(function (id) { return state.selected[id]; }).length > 0);
  }

  function onHumanToggle() {
    var on = HT.$('#human-toggle').checked;
    HT.$('#human-preset').disabled = !on;
    HT.$('#human-custom').disabled = !(on && HT.$('#human-preset').value === 'custom');
  }

  function onHumanPresetChange() {
    var isCustom = HT.$('#human-preset').value === 'custom';
    HT.$('#human-custom').disabled = !isCustom;
  }

  function onDurationChange() {
    var v = parseInt(HT.$('#race-duration').value, 10);
    if (C.RACE_DURATION_OPTIONS.indexOf(v) !== -1) state.targetDurationS = v;
  }

  function onStart() {
    rebuildLanes();
    computeFinishTimes();
    start();
  }

  function init() {
    buildPicker();

    document.querySelectorAll('#animal-grid input[type="checkbox"]').forEach(function (cb) {
      cb.addEventListener('change', onSelectionChange);
    });

    HT.$('#human-toggle').addEventListener('change', onHumanToggle);
    HT.$('#human-preset').addEventListener('change', onHumanPresetChange);
    HT.$('#human-custom').addEventListener('input', function () { /* live clamp */ });

    HT.$('#race-duration').addEventListener('change', onDurationChange);

    HT.$('#start-btn').addEventListener('click', onStart);
    HT.$('#reset-btn').addEventListener('click', reset);

    onHumanToggle();
    onDurationChange();
  }

  window.animalRaceInit = init;
})();
