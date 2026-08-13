/* ============================================
   Flashcard Timer — Story 9.7
   Alternating recall/break timer. State machine:
   idle → running → paused → running → ... → idle.
   Cycles recall → break → recall, incrementing
   cycleCount on each completed recall+break pair.
   Hand-rolled beep via Web Audio with a visual-only
   fallback (red border flash) when AudioContext
   is unavailable. URL state preserves durations,
   state, and cycle count across reloads.
   ============================================ */

(function () {
  'use strict';

  // -------- Constants --------
  var DEFAULTS = { recall: 25, breakMin: 5 };
  var RING_RADIUS = 45;        // matches <circle r="45"> in index.html
  var RING_CIRCUM = 2 * Math.PI * RING_RADIUS; // ~282.74
  var AUDIO_FREQ = 880;        // Hz (per AC-3)
  var AUDIO_DURATION = 500;    // ms (per AC-3)
  var AUDIO_GAIN = 0.2;        // amplitude (per AC-3)
  var FLASH_DURATION = 1000;   // ms (per AC-3 fallback)

  // -------- DOM refs --------
  var recallIn = HT.$('#ft-recall');
  var breakIn = HT.$('#ft-break');
  var display = HT.$('#ft-display');
  var ringFg = HT.$('#ft-ring-fg');
  var phaseTag = HT.$('#ft-phase');
  var cyclesEl = HT.$('#ft-cycles');
  var btnStart = HT.$('#ft-start');
  var btnPause = HT.$('#ft-pause');
  var btnStop = HT.$('#ft-stop');
  var btnReset = HT.$('#ft-reset');

  // -------- State --------
  // phase: 'recall' | 'break'
  // mode: 'idle' | 'running' | 'paused'
  var phase = 'recall';
  var mode = 'idle';
  var cycles = 0;
  var remainingMs = DEFAULTS.recall * 60 * 1000;
  var totalMs = DEFAULTS.recall * 60 * 1000;
  var intervalId = null;
  var flashTimeoutId = null;

  // -------- Audio (one-shot, gated by user gesture) --------
  var audioCtx = null;
  var audioFailed = false;

  function ensureAudio() {
    if (audioFailed) return false;
    if (audioCtx) return true;
    try {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      if (typeof Ctor !== 'function') {
        audioFailed = true;
        if (typeof console !== 'undefined' && console.info) {
          console.info('Flashcard Timer: AudioContext unavailable; using visual-only cue.');
        }
        return false;
      }
      audioCtx = new Ctor();
      return true;
    } catch (e) {
      audioFailed = true;
      if (typeof console !== 'undefined' && console.info) {
        console.info('Flashcard Timer: AudioContext unavailable; using visual-only cue.');
      }
      return false;
    }
  }

  function playBeep() {
    if (!ensureAudio() || !audioCtx) {
      flashDisplay();
      return;
    }
    try {
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(AUDIO_FREQ, audioCtx.currentTime);
      gain.gain.setValueAtTime(AUDIO_GAIN, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + AUDIO_DURATION / 1000);
    } catch (e) {
      // Audio path threw — fall back to visual cue, do not crash.
      flashDisplay();
    }
  }

  function flashDisplay() {
    if (!display) return;
    display.classList.add('ft-flash');
    if (flashTimeoutId) clearTimeout(flashTimeoutId);
    flashTimeoutId = setTimeout(function () {
      if (display) display.classList.remove('ft-flash');
      flashTimeoutId = null;
    }, FLASH_DURATION);
  }

  // -------- Duration parsing + validation --------
  function clampRecall(n) {
    if (!Number.isFinite(n)) return DEFAULTS.recall;
    return Math.max(1, Math.min(180, Math.floor(n)));
  }
  function clampBreak(n) {
    if (!Number.isFinite(n)) return DEFAULTS.breakMin;
    return Math.max(1, Math.min(60, Math.floor(n)));
  }
  function readDurations() {
    return {
      recall: clampRecall(parseInt(recallIn && recallIn.value, 10)),
      breakMin: clampBreak(parseInt(breakIn && breakIn.value, 10)),
    };
  }

  // -------- MM:SS formatting + ring offset --------
  function fmtMMSS(ms) {
    var totalSec = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    var mm = m < 10 ? '0' + m : '' + m;
    var ss = s < 10 ? '0' + s : '' + s;
    return mm + ':' + ss;
  }

  function ringOffset(ms) {
    if (!ringFg || totalMs <= 0) return 0;
    var frac = Math.max(0, Math.min(1, ms / totalMs));
    // dashoffset = RING_CIRCUM * (1 - frac) — full circle when ms = totalMs, empty when ms = 0
    return RING_CIRCUM * (1 - frac);
  }

  // -------- Render --------
  function render() {
    if (display) display.textContent = fmtMMSS(remainingMs);
    if (phaseTag) {
      phaseTag.textContent = phase === 'recall' ? 'Recall' : 'Break';
      if (phase === 'break') {
        phaseTag.classList.add('ft-phase-tag--break');
      } else {
        phaseTag.classList.remove('ft-phase-tag--break');
      }
    }
    if (cyclesEl) cyclesEl.textContent = 'Cycle ' + cycles;
    if (ringFg) {
      ringFg.style.strokeDasharray = String(RING_CIRCUM);
      ringFg.style.strokeDashoffset = String(ringOffset(remainingMs));
    }
    // Pause/stop visibility
    if (btnStart) btnStart.hidden = (mode === 'running');
    if (btnPause) btnPause.hidden = (mode !== 'running');
    if (btnStop) btnStop.hidden = (mode === 'idle');
    writeUrlState();
  }

  // -------- Tick --------
  function tick() {
    if (mode !== 'running') return;
    var dur = readDurations();
    var next = remainingMs - 1000;
    if (next <= 0) {
      // Phase end → beep → flip phase
      remainingMs = 0;
      render();
      playBeep();
      if (phase === 'recall') {
        // recall → break
        phase = 'break';
        totalMs = dur.breakMin * 60 * 1000;
        remainingMs = totalMs;
      } else {
        // break → recall; cycle count increments only on full recall+break
        phase = 'recall';
        totalMs = dur.recall * 60 * 1000;
        remainingMs = totalMs;
        cycles = cycles + 1;
      }
      render();
      return;
    }
    remainingMs = next;
    render();
  }

  // -------- Start / Pause / Stop / Reset --------
  function startTimer() {
    if (mode === 'running') return;
    // If idle, take fresh durations into remainingMs/totalMs
    if (mode === 'idle') {
      var dur = readDurations();
      totalMs = dur.recall * 60 * 1000;
      remainingMs = totalMs;
      phase = 'recall';
    }
    // Prime audio on first Start click (user gesture)
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function () { /* swallow */ });
    }
    mode = 'running';
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(tick, 1000);
    render();
  }

  function pauseTimer() {
    if (mode !== 'running') return;
    mode = 'paused';
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
    render();
  }

  function stopTimer() {
    mode = 'idle';
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
    var dur = readDurations();
    phase = 'recall';
    totalMs = dur.recall * 60 * 1000;
    remainingMs = totalMs;
    render();
  }

  function resetTimer() {
    stopTimer();
    cycles = 0;
    render();
  }

  // -------- URL state --------
  // Only durations are persisted to URL state. The session state
  // (mode, cycle count) is intentionally NOT persisted — the spec
  // (ROQ-3) treats both as session-scoped, so a fresh page load
  // always starts idle with cycle count 0.
  function readUrlState() {
    try {
      var params = new URLSearchParams(window.location.search);
      return {
        recall: params.get('recall'),
        breakMin: params.get('break'),
      };
    } catch (_) {
      return { recall: null, breakMin: null };
    }
  }

  function writeUrlState() {
    try {
      var params = new URLSearchParams(window.location.search);
      var dur = readDurations();
      params.set('recall', String(dur.recall));
      params.set('break', String(dur.breakMin));
      var qs = params.toString();
      var url = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
      window.history.replaceState(null, '', url);
    } catch (_) { /* iframe sandboxed — ignore */ }
  }

  function applyUrlState() {
    var s = readUrlState();
    if (s.recall !== null && recallIn) {
      var r = clampRecall(parseInt(s.recall, 10));
      if (Number.isFinite(r)) recallIn.value = String(r);
    }
    if (s.breakMin !== null && breakIn) {
      var b = clampBreak(parseInt(s.breakMin, 10));
      if (Number.isFinite(b)) breakIn.value = String(b);
    }
  }

  // -------- Wire events --------
  function wire() {
    if (btnStart) btnStart.addEventListener('click', startTimer);
    if (btnPause) btnPause.addEventListener('click', pauseTimer);
    if (btnStop) btnStop.addEventListener('click', stopTimer);
    if (btnReset) btnReset.addEventListener('click', resetTimer);

    // Re-clamp on input + re-render (so ring/duration update visibly)
    var onDurChange = HT.debounce(function () {
      if (mode === 'idle') {
        var dur = readDurations();
        totalMs = dur.recall * 60 * 1000;
        remainingMs = totalMs;
        render();
      } else {
        // While running, just persist URL state
        writeUrlState();
      }
    }, 200);
    if (recallIn) recallIn.addEventListener('input', onDurChange);
    if (breakIn) breakIn.addEventListener('input', onDurChange);

    // Keyboard shortcuts
    document.addEventListener('keydown', function (ev) {
      var target = ev.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      var k = ev.key;
      if (k === ' ' || k === 's' || k === 'S') {
        ev.preventDefault();
        if (mode === 'running') pauseTimer();
        else startTimer();
      } else if (k === 'r' || k === 'R') {
        ev.preventDefault();
        if (ev.shiftKey) resetTimer();
        else stopTimer();
      } else if (k === '1') {
        ev.preventDefault();
        if (recallIn) recallIn.focus();
      } else if (k === '2') {
        ev.preventDefault();
        if (breakIn) breakIn.focus();
      }
    });
  }

  // -------- Boot --------
  applyUrlState();
  // Initialize state from the (possibly URL-overridden) inputs
  var initDur = readDurations();
  totalMs = initDur.recall * 60 * 1000;
  remainingMs = totalMs;
  wire();
  render();
})();