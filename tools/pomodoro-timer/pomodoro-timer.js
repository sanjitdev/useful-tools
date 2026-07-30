/* ============================================
   Pomodoro Timer
   State machine: focus → short → focus → ... → long break after N cycles.
   Persists state across page reloads via HT.storage.
   ============================================ */

(function () {
  'use strict';

  var STORAGE = 'pomodoro_state_v1';

  // Phases: 'focus' | 'short' | 'long'
  var DEFAULT_DURATIONS = { focus: 25, short: 5, long: 15, cycles: 4 };

  function loadState() {
    var saved = HT.storage.get(STORAGE, null);
    if (saved && saved.durations && saved.phase && saved.endAt) {
      return saved;
    }
    return {
      durations: Object.assign({}, DEFAULT_DURATIONS),
      phase: 'focus',
      cycle: 1, // 1..cycles
      running: false,
      // endAt: absolute timestamp (ms). If running, the timer is live; if not, endAt holds
      // the displayed-remaining anchor (recomputed from remainingMs).
      endAt: 0,
      remainingMs: DEFAULT_DURATIONS.focus * 60 * 1000
    };
  }

  function saveState(s) {
    HT.storage.set(STORAGE, s);
  }

  var state = loadState();

  // -------- DOM --------
  var display = HT.$('#display');
  var phaseTag = HT.$('#phase-tag');
  var cyclesEl = HT.$('#cycles');
  var btnStart = HT.$('#start');
  var btnPause = HT.$('#pause');
  var btnReset = HT.$('#reset');
  var btnSkip = HT.$('#skip');
  var dFocus = HT.$('#d-focus');
  var dShort = HT.$('#d-short');
  var dLong = HT.$('#d-long');
  var dCycles = HT.$('#d-cycles');
  var btnApply = HT.$('#apply-durations');

  // Initialize duration inputs from state
  dFocus.value = state.durations.focus;
  dShort.value = state.durations.short;
  dLong.value = state.durations.long;
  dCycles.value = state.durations.cycles;

  // -------- Logic --------
  function phaseLabel(p) {
    if (p === 'focus') return 'Focus';
    if (p === 'short') return 'Short Break';
    return 'Long Break';
  }

  function currentDurationMs() {
    if (state.phase === 'focus') return state.durations.focus * 60 * 1000;
    if (state.phase === 'short') return state.durations.short * 60 * 1000;
    return state.durations.long * 60 * 1000;
  }

  function currentRemainingMs() {
    if (state.running) {
      return Math.max(0, state.endAt - Date.now());
    }
    return state.remainingMs;
  }

  function fmtMMSS(ms) {
    var total = Math.ceil(ms / 1000);
    var m = Math.floor(total / 60);
    var s = total % 60;
    return (m < 10 ? '0' + m : '' + m) + ':' + (s < 10 ? '0' + s : '' + s);
  }

  function render() {
    display.textContent = fmtMMSS(currentRemainingMs());
    phaseTag.textContent = phaseLabel(state.phase);
    if (state.phase === 'focus') {
      cyclesEl.textContent = 'Cycle ' + state.cycle + ' of ' + state.durations.cycles + ' toward next long break';
    } else if (state.phase === 'short') {
      cyclesEl.textContent = 'Short break after focus ' + state.cycle;
    } else {
      cyclesEl.textContent = 'Long break — well done! Next focus starts a new round.';
    }
  }

  // Transition to the next phase
  function advance() {
    HT.chime();
    if (state.phase === 'focus') {
      if (state.cycle >= state.durations.cycles) {
        state.phase = 'long';
      } else {
        state.phase = 'short';
      }
    } else if (state.phase === 'short') {
      // Completed a focus + short break; bump cycle
      state.cycle = Math.min(state.cycle + 1, state.durations.cycles);
      state.phase = 'focus';
    } else {
      // long → reset to a fresh focus round
      state.cycle = 1;
      state.phase = 'focus';
    }

    state.remainingMs = currentDurationMs();
    if (state.running) {
      state.endAt = Date.now() + state.remainingMs;
    }
    saveState(state);
    render();
  }

  function tick() {
    if (!state.running) return;
    var remaining = currentRemainingMs();
    render();
    if (remaining <= 0) {
      advance();
    }
  }

  // -------- Controls --------
  function start() {
    if (state.remainingMs <= 0) {
      // already at end of a phase; advance first
      advance();
    }
    state.running = true;
    state.endAt = Date.now() + state.remainingMs;
    saveState(state);
    render();
  }

  function pause() {
    if (!state.running) return;
    state.remainingMs = currentRemainingMs();
    state.running = false;
    state.endAt = 0;
    saveState(state);
    render();
  }

  function reset() {
    state.running = false;
    state.endAt = 0;
    state.phase = 'focus';
    state.cycle = 1;
    state.remainingMs = state.durations.focus * 60 * 1000;
    saveState(state);
    render();
  }

  function skip() {
    advance();
  }

  function applyDurations() {
    var f = Math.max(1, parseInt(dFocus.value, 10) || 25);
    var s = Math.max(1, parseInt(dShort.value, 10) || 5);
    var l = Math.max(1, parseInt(dLong.value, 10) || 15);
    var c = Math.max(2, parseInt(dCycles.value, 10) || 4);
    state.durations = { focus: f, short: s, long: l, cycles: c };
    state.remainingMs = currentDurationMs();
    if (state.running) {
      state.endAt = Date.now() + state.remainingMs;
    }
    state.cycle = Math.min(state.cycle, c);
    saveState(state);
    render();
  }

  btnStart.addEventListener('click', start);
  btnPause.addEventListener('click', pause);
  btnReset.addEventListener('click', reset);
  btnSkip.addEventListener('click', skip);
  btnApply.addEventListener('click', applyDurations);

  // Tick at a fine interval to keep display accurate
  setInterval(tick, 250);
  render();
})();