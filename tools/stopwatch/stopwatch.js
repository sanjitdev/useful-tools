/* ============================================
   Stopwatch & Timer
   Stopwatch with laps; countdown timer that chimes on completion.
   ============================================ */

(function () {
  'use strict';

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function pad3(n) { return n < 10 ? '00' + n : (n < 100 ? '0' + n : '' + n); }

  function formatHMSms(ms) {
    if (ms < 0) ms = 0;
    var totalSec = Math.floor(ms / 1000);
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    var cs = Math.floor((ms % 1000) / 10);
    return pad2(h) + ':' + pad2(m) + ':' + pad2(s) + '.' + pad2(cs);
  }

  function formatMS(ms) {
    if (ms < 0) ms = 0;
    var totalSec = Math.floor(ms / 1000);
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return pad2(m) + ':' + pad2(s);
  }

  // -------- Stopwatch --------
  var swDisplay = HT.$('#sw-display');
  var swStart = HT.$('#sw-start');
  var swLap = HT.$('#sw-lap');
  var swReset = HT.$('#sw-reset');
  var swLapsEl = HT.$('#sw-laps');
  var swLapCount = HT.$('#sw-lap-count');

  var swRunning = false;
  var swStartTime = 0;
  var swElapsed = 0;
  var swRafId = null;
  var swLaps = [];

  function renderSw() {
    var now = swElapsed;
    if (swRunning) {
      now += performance.now() - swStartTime;
    }
    swDisplay.textContent = formatHMSms(now);
  }

  function tickSw() {
    renderSw();
    if (swRunning) swRafId = requestAnimationFrame(tickSw);
  }

  function setSwButtons() {
    swStart.textContent = swRunning ? 'Stop' : 'Start';
    swLap.disabled = !swRunning;
    swReset.disabled = (swRunning || (swElapsed === 0 && swLaps.length === 0));
  }

  function renderLaps() {
    swLapsEl.innerHTML = '';
    swLapCount.textContent = swLaps.length;
    if (swLaps.length === 0) return;
    // Determine fastest and slowest split
    var splits = swLaps.map(function (l, i) {
      var prev = i === 0 ? 0 : swLaps[i - 1].total;
      return { lap: l, split: l.total - prev };
    });
    var fastest = Infinity, slowest = -Infinity;
    splits.forEach(function (s) {
      if (s.split < fastest) fastest = s.split;
      if (s.split > slowest) slowest = s.split;
    });
    splits.forEach(function (s, i) {
      var li = document.createElement('li');
      var extraCls = '';
      if (swLaps.length > 1) {
        if (s.split === fastest) extraCls = ' is-fastest';
        else if (s.split === slowest) extraCls = ' is-slowest';
      }
      li.className = extraCls.trim();
      li.innerHTML =
        '<span>#' + (i + 1) + '</span>' +
        '<span>' + formatHMSms(s.split) + '</span>' +
        '<span>' + formatHMSms(s.lap.total) + '</span>';
      swLapsEl.appendChild(li);
    });
  }

  swStart.addEventListener('click', function () {
    if (!swRunning) {
      swStartTime = performance.now();
      swRunning = true;
      tickSw();
    } else {
      swElapsed += performance.now() - swStartTime;
      swRunning = false;
      if (swRafId) cancelAnimationFrame(swRafId);
      renderSw();
    }
    setSwButtons();
  });

  swLap.addEventListener('click', function () {
    var now = swElapsed;
    if (swRunning) now += performance.now() - swStartTime;
    swLaps.push({ total: now });
    renderLaps();
    setSwButtons();
  });

  swReset.addEventListener('click', function () {
    swRunning = false;
    swStartTime = 0;
    swElapsed = 0;
    swLaps = [];
    if (swRafId) cancelAnimationFrame(swRafId);
    renderSw();
    renderLaps();
    setSwButtons();
  });

  setSwButtons();
  renderSw();

  // -------- Timer --------
  var tDisplay = HT.$('#t-display');
  var tMin = HT.$('#t-min');
  var tSec = HT.$('#t-sec');
  var tSet = HT.$('#t-set');
  var tStart = HT.$('#t-start');
  var tPause = HT.$('#t-pause');
  var tReset = HT.$('#t-reset');
  var tMsg = HT.$('#t-msg');

  var tRemain = 5 * 60 * 1000;
  var tInitial = tRemain;
  var tRunning = false;
  var tEndAt = 0;
  var tIntervalId = null;
  var tChimed = false;

  function renderT() {
    var ms = tRemain;
    if (tRunning) ms = Math.max(0, tEndAt - Date.now());
    tDisplay.textContent = formatMS(ms);
    if (ms === 0 && tInitial > 0) {
      tDisplay.classList.add('is-done');
    } else {
      tDisplay.classList.remove('is-done');
    }
  }

  function tickT() {
    var ms = Math.max(0, tEndAt - Date.now());
    tRemain = ms;
    renderT();
    if (ms === 0 && tRunning) {
      tRunning = false;
      clearInterval(tIntervalId);
      tIntervalId = null;
      if (!tChimed) {
        HT.chime();
        tChimed = true;
        tMsg.textContent = 'Time is up!';
      }
      setTButtons();
      return;
    }
    if (!tRunning) {
      clearInterval(tIntervalId);
      tIntervalId = null;
      setTButtons();
    }
  }

  function setTButtons() {
    tStart.textContent = tRunning ? 'Running…' : (tRemain === 0 ? 'Restart' : 'Start');
    tStart.disabled = false;
    tPause.disabled = !tRunning;
    tReset.disabled = false;
  }

  function readInputs() {
    var m = parseInt(tMin.value, 10);
    var s = parseInt(tSec.value, 10);
    if (!isFinite(m) || m < 0) m = 0;
    if (!isFinite(s) || s < 0) s = 0;
    return (m * 60 + s) * 1000;
  }

  tSet.addEventListener('click', function () {
    if (tRunning) return;
    tRemain = readInputs();
    tInitial = tRemain;
    tChimed = false;
    tMsg.textContent = '';
    renderT();
    setTButtons();
  });

  tStart.addEventListener('click', function () {
    if (tRunning) return;
    if (tRemain === 0) {
      tRemain = readInputs();
      tInitial = tRemain;
      if (tRemain === 0) {
        tMsg.textContent = 'Set a duration first.';
        return;
      }
    }
    tChimed = false;
    tMsg.textContent = '';
    tEndAt = Date.now() + tRemain;
    tRunning = true;
    renderT();
    setTButtons();
    tIntervalId = setInterval(tickT, 100);
  });

  tPause.addEventListener('click', function () {
    if (!tRunning) return;
    tRemain = Math.max(0, tEndAt - Date.now());
    tRunning = false;
    clearInterval(tIntervalId);
    tIntervalId = null;
    renderT();
    setTButtons();
  });

  tReset.addEventListener('click', function () {
    tRunning = false;
    if (tIntervalId) clearInterval(tIntervalId);
    tIntervalId = null;
    tRemain = readInputs();
    tInitial = tRemain;
    tChimed = false;
    tMsg.textContent = '';
    renderT();
    setTButtons();
  });

  renderT();
  setTButtons();

  HT.makeTabs(HT.$('#mode-tabs'));
})();