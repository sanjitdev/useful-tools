/* ============================================
   Animal Race — frame-perfect animated race
   All speeds editable in ANIMALS below.
   ============================================ */

(function () {
  'use strict';

  // -------------------------------------------------------------
  // Constants
  // -------------------------------------------------------------
  var TRACK_LENGTH_M = 100;      // display value shown on the UI
  var MAX_RACE_DURATION_S = 60;  // slowest selected racer finishes exactly here
  var MIN_RACE_DURATION_S = 2;   // fastest selected racer finishes no earlier than this
  var HUMAN_MAX_KMH = 80;
  var HUMAN_MIN_KMH = 1;

  // -------------------------------------------------------------
  // Animal data
  // Speeds are widely cited top speeds (sustained gallop, not absolute max).
  // Icons are simple inline-SVG silhouettes — no CDN, no emoji.
  // -------------------------------------------------------------
  var ANIMALS = [
    {
      id: 'cheetah', name: 'Cheetah', kmh: 110, color: '#f4b41a',
      svg: '<svg viewBox="0 0 32 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 14c2-3 6-4 10-4s7 1 9 3l2-2 2 1-3 4c-1 2-4 4-9 4s-9-1-11-2l-2 2-1-2 3-4z" fill="currentColor" stroke="none"/><circle cx="22" cy="9" r="1" fill="white"/></svg>',
    },
    {
      id: 'horse', name: 'Horse', kmh: 88, color: '#8b5a2b',
      svg: '<svg viewBox="0 0 32 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 12c1-3 4-5 8-5h6c3 0 6 1 8 3l3-1 1 2-3 4c-1 2-3 4-7 4-1 0-2 0-3-1l-2 4h-2l1-5c-2-1-5-2-8-2H3l1-2-1-1z" fill="currentColor" stroke="none"/></svg>',
    },
    {
      id: 'lion', name: 'Lion', kmh: 80, color: '#d4a14a',
      svg: '<svg viewBox="0 0 32 24" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="12" r="6" fill="currentColor"/><circle cx="16" cy="12" r="9" fill="currentColor" opacity="0.5"/><circle cx="14" cy="11" r="1" fill="white"/></svg>',
    },
    {
      id: 'greyhound', name: 'Greyhound', kmh: 74, color: '#9aa3a7',
      svg: '<svg viewBox="0 0 32 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 14c2-4 5-6 9-6s7 1 9 3l5-2 2 2-4 4c-1 2-4 4-8 4H6l-3-2v-3z" fill="currentColor" stroke="none"/></svg>',
    },
    {
      id: 'elk', name: 'Elk', kmh: 72, color: '#6b4f3a',
      svg: '<svg viewBox="0 0 32 24" xmlns="http://www.w3.org/2000/svg"><path d="M14 8V4m-3 1l3 3 3-3m-1 9c-3 0-6 1-9 3v3h18v-3c-3-2-6-3-9-3z" fill="currentColor" stroke="none"/></svg>',
    },
    {
      id: 'ostrich', name: 'Ostrich', kmh: 70, color: '#2b2b2b',
      svg: '<svg viewBox="0 0 32 24" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="6" r="3" fill="currentColor"/><path d="M10 9c-1 3-2 6-3 8l-3 5h3l5-7c1-2 2-4 2-6h-4z" fill="currentColor" stroke="none"/><path d="M4 5l3 1v2H4z" fill="currentColor"/></svg>',
    },
    {
      id: 'coyote', name: 'Coyote', kmh: 65, color: '#c6975b',
      svg: '<svg viewBox="0 0 32 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 14c2-4 5-6 9-6 3 0 6 1 8 3l4-2 2 2-3 4c-1 2-3 3-6 3-3 0-5 0-7-1l-2 1-1 2H4l-2-2 2-4z" fill="currentColor" stroke="none"/></svg>',
    },
    {
      id: 'rabbit', name: 'Rabbit', kmh: 56, color: '#caa472',
      svg: '<svg viewBox="0 0 32 24" xmlns="http://www.w3.org/2000/svg"><ellipse cx="12" cy="8" rx="3" ry="6" fill="currentColor"/><ellipse cx="18" cy="8" rx="3" ry="6" fill="currentColor"/><ellipse cx="15" cy="16" rx="8" ry="5" fill="currentColor"/></svg>',
    },
    {
      id: 'cat', name: 'Domestic Cat', kmh: 48, color: '#b89a78',
      svg: '<svg viewBox="0 0 32 24" xmlns="http://www.w3.org/2000/svg"><path d="M5 6l3 4 5-2 6 2 3-4 2 3-2 5-3 4H8l-3-4-2-5z" fill="currentColor" stroke="none"/></svg>',
    },
    {
      id: 'human', name: 'Human', kmh: 24, color: '#4a90e2', isHuman: true,
      svg: '<svg viewBox="0 0 32 24" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="4" r="3" fill="currentColor"/><path d="M14 7l-4 6 4 2v8h4v-8l4-2-4-6h-4z" fill="currentColor" stroke="none"/></svg>',
    },
    {
      id: 'pig', name: 'Pig', kmh: 17, color: '#f3a8b8',
      svg: '<svg viewBox="0 0 32 24" xmlns="http://www.w3.org/2000/svg"><ellipse cx="18" cy="14" rx="10" ry="6" fill="currentColor"/><ellipse cx="8" cy="14" rx="3" ry="2" fill="currentColor"/><circle cx="7" cy="13" r="0.7" fill="white"/><circle cx="9" cy="13" r="0.7" fill="white"/></svg>',
    },
    {
      id: 'chicken', name: 'Chicken', kmh: 14, color: '#e9e0c6',
      svg: '<svg viewBox="0 0 32 24" xmlns="http://www.w3.org/2000/svg"><ellipse cx="16" cy="14" rx="7" ry="5" fill="currentColor"/><circle cx="22" cy="7" r="3" fill="currentColor"/><path d="M24 5l3-2 1 2-3 2z" fill="currentColor"/></svg>',
    },
    {
      id: 'sloth', name: 'Sloth', kmh: 0.24, color: '#7a8b5c',
      svg: '<svg viewBox="0 0 32 24" xmlns="http://www.w3.org/2000/svg"><path d="M2 18c2-6 8-10 14-10s10 3 12 8l-2 2c-2-3-6-5-10-5s-9 2-12 5l-2 0z" fill="currentColor" stroke="none"/><circle cx="10" cy="14" r="1.5" fill="white"/><circle cx="22" cy="14" r="1.5" fill="white"/></svg>',
    },
    {
      id: 'snail', name: 'Snail', kmh: 0.05, color: '#b8d17a',
      svg: '<svg viewBox="0 0 32 24" xmlns="http://www.w3.org/2000/svg"><circle cx="13" cy="14" r="6" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="13" cy="14" r="2" fill="currentColor"/><path d="M19 16h12v3c-3 1-7 1-12 0v-3z" fill="currentColor"/></svg>',
    },
  ];

  // -------------------------------------------------------------
  // State
  // -------------------------------------------------------------
  var state = {
    selected: {},         // id -> true
    racers: [],           // active racers (with lane + finishTimeS)
    t0: null,             // performance.now() when race started
    rafId: null,
    running: false,
    finishElapsedS: 0,    // last clock value when race ends
  };

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
  function realFinishS(kmh) { return TRACK_LENGTH_M / kmhToMs(kmh); }

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  function formatTime(s) {
    // Always show 2 decimals, leading zero, "s" suffix.
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
      lane.innerHTML =
        '<span class="lane-label">' + a.name + '</span>' +
        '<div class="racer" data-id="' + a.id + '" style="--animal-color:' + a.color + '">' +
          '<span class="racer-icon">' + a.svg + '</span>' +
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
  // Goal: produce a watchable race.
  //   • The slowest selected racer finishes at MAX_RACE_DURATION_S.
  //   • The fastest finishes at no less than MIN_RACE_DURATION_S.
  // We pick the scale that honours both anchors. When the real-world speed
  // ratio is so extreme that both anchors can't be satisfied (e.g. snail vs
  // cheetah, ~2200×), we let the slowest finish slightly later than MAX so
  // the fastest stays at MIN — watching a 15-minute race is worse UX than
  // a 60s race that's slightly off-anchor.
  // -------------------------------------------------------------
  function computeFinishTimes() {
    if (state.racers.length === 0) return;

    var realTimes = state.racers.map(function (r) { return realFinishS(r.kmh); });
    var n = realTimes.length;
    var slowestIdx = 0, fastestIdx = 0;
    for (var i = 1; i < n; i++) {
      if (realTimes[i] > realTimes[slowestIdx]) slowestIdx = i;
      if (realTimes[i] < realTimes[fastestIdx]) fastestIdx = i;
    }

    // Anchor slowest to MAX_RACE_DURATION_S.
    var scale = MAX_RACE_DURATION_S / realTimes[slowestIdx];

    // If that pushes the fastest below MIN_RACE_DURATION_S, anchor the
    // fastest to MIN instead. The slowest will then be MIN × (realSpread).
    if (realTimes[fastestIdx] * scale < MIN_RACE_DURATION_S) {
      scale = MIN_RACE_DURATION_S / realTimes[fastestIdx];
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

    // Lock the UI
    state.running = true;
    setStartEnabled(false);
    document.querySelectorAll('input[type="checkbox"]').forEach(function (el) { el.disabled = true; });
    document.querySelectorAll('select, input[type="number"]').forEach(function (el) {
      if (el.id !== 'human-preset' && el.id !== 'human-custom') el.disabled = true;
    });
    HT.$('#human-toggle').disabled = true;
    HT.$('#human-preset').disabled = true;
    HT.$('#human-custom').disabled = true;

    // Reset state
    state.racers.forEach(function (r) {
      r.progress = 0;
      r.finished = false;
      r.finishElapsedS = null;
      r.racerEl.classList.remove('is-finished');
      r.racerEl.style.setProperty('--p', 0);
    });

    HT.$('#results-panel').hidden = true;
    HT.$('#results-list').innerHTML = '';
    HT.$('#comparison').innerHTML = '';
    HT.$('#race-clock').classList.remove('is-done');
    HT.$('#race-clock').textContent = '00.00s';

    // Reveal track
    HT.$('#track-panel').hidden = false;
    // Scroll into view smoothly
    setTimeout(function () {
      var p = HT.$('#track-panel');
      if (p && p.scrollIntoView) p.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 30);

    // Begin
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
      r.racerEl.style.setProperty('--p', r.progress);
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

    // Sort racers by finish time (ascending). For ties within ~1ms, sort alphabetically.
    var EPS = 1e-6;
    var ranked = state.racers.slice().sort(function (a, b) {
      if (Math.abs(a.finishElapsedS - b.finishElapsedS) > EPS) {
        return a.finishElapsedS - b.finishElapsedS;
      }
      return a.name.localeCompare(b.name);
    });

    // Render rows
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

    // "How much faster" — compare each racer to the slowest
    var slowest = ranked[ranked.length - 1];
    comp.innerHTML = '';
    ranked.forEach(function (r) {
      if (r === slowest) return;
      // Speed ratio. If we assume both finished at the same scaled time per the
      // computation, the "real" speed ratio is preserved: pctFaster = (r.kmh / slowest.kmh - 1) * 100.
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
      return isFinite(v) && v > 0 ? clamp(v, HUMAN_MIN_KMH, HUMAN_MAX_KMH) : 0;
    }
    return parseFloat(preset) || 24;
  }

  function onSelectionChange() {
    // Refresh selected set
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

  function onStart() {
    rebuildLanes();
    computeFinishTimes();
    start();
  }

  function init() {
    buildPicker();

    // Picker changes
    document.querySelectorAll('#animal-grid input[type="checkbox"]').forEach(function (cb) {
      cb.addEventListener('change', onSelectionChange);
    });

    // Human
    HT.$('#human-toggle').addEventListener('change', onHumanToggle);
    HT.$('#human-preset').addEventListener('change', onHumanPresetChange);
    HT.$('#human-custom').addEventListener('input', function () { /* live clamp */ });

    // Buttons
    HT.$('#start-btn').addEventListener('click', onStart);
    HT.$('#reset-btn').addEventListener('click', reset);

    // Initial human state
    onHumanToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
