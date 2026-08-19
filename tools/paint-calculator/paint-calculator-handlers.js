/* ============================================
   Paint Calculator — paint-calculator-handlers.js (Story 4b)
   DOM wiring: render walls list, attach input listeners,
   compute gallons on change, URL state encode/decode,
   buttons (sample/reset/print/share/add-wall/remove-wall),
   keyboard shortcuts, focus management.

   Pattern mirrors tools/recipe-scaler/recipe-scaler-handlers.js.
   ============================================ */

(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.HT || !window.HT.paintCalculatorCore) return;
  var HT = window.HT;
  var core = HT.paintCalculatorCore;
  var DEFAULTS = core.getDefaults();
  var SAMPLE_WALLS = core.getSampleWalls();

  // -------------------------------------------------------------
  // State
  // -------------------------------------------------------------
  var state = {
    walls: SAMPLE_WALLS.slice(),
    doors: DEFAULTS.doors,
    windows: DEFAULTS.windows,
  };

  // -------------------------------------------------------------
  // DOM references (resolved on init)
  // -------------------------------------------------------------
  var elWallsList = null;
  var elDoors = null;
  var elWindows = null;
  var elResult = null;
  var elAddWall = null;
  var elSample = null;
  var elReset = null;
  var elPrint = null;
  var elShare = null;

  function $(sel) { return HT.$(sel); }

  // -------------------------------------------------------------
  // Render — update the walls list and the result.
  // -------------------------------------------------------------
  function render() {
    renderWalls();
    renderResult();
    writeUrlState();
  }

  function renderWalls() {
    if (!elWallsList) return;
    var html = '';
    for (var i = 0; i < state.walls.length; i += 1) {
      var wall = state.walls[i];
      var w = Number(wall && wall.w) || 0;
      var h = Number(wall && wall.h) || 0;
      html += '<div class="paint-wall-row" data-wall-index="' + i + '">';
      html += '  <div class="field">';
      html += '    <label class="paint-wall-label" for="pc-wall-w-' + i + '">Wall ' + (i + 1) + ' — Width (ft)</label>';
      html += '    <input id="pc-wall-w-' + i + '" class="input js-pc-wall-width" type="number" min="0" step="0.5" value="' + w + '" data-wall-index="' + i + '" aria-label="Wall ' + (i + 1) + ' width in feet">';
      html += '  </div>';
      html += '  <div class="field">';
      html += '    <label class="paint-wall-label" for="pc-wall-h-' + i + '">Wall ' + (i + 1) + ' — Height (ft)</label>';
      html += '    <input id="pc-wall-h-' + i + '" class="input js-pc-wall-height" type="number" min="0" step="0.5" value="' + h + '" data-wall-index="' + i + '" aria-label="Wall ' + (i + 1) + ' height in feet">';
      html += '  </div>';
      html += '  <button type="button" class="btn btn-ghost btn-sm paint-wall-remove" data-action="remove-wall" data-wall-index="' + i + '" aria-label="Remove wall ' + (i + 1) + '">Remove</button>';
      html += '</div>';
    }
    elWallsList.innerHTML = html;
    // Attach input listeners on the freshly rendered rows.
    var widthInputs = elWallsList.querySelectorAll('.js-pc-wall-width');
    for (var wi = 0; wi < widthInputs.length; wi += 1) {
      widthInputs[wi].addEventListener('input', onWallWidthChange);
    }
    var heightInputs = elWallsList.querySelectorAll('.js-pc-wall-height');
    for (var hi = 0; hi < heightInputs.length; hi += 1) {
      heightInputs[hi].addEventListener('input', onWallHeightChange);
    }
    var removeBtns = elWallsList.querySelectorAll('[data-action="remove-wall"]');
    for (var ri = 0; ri < removeBtns.length; ri += 1) {
      removeBtns[ri].addEventListener('click', onRemoveWallClick);
    }
  }

  function renderResult() {
    if (!elResult) return;
    var calc = core.calcGallons(state.walls, state.doors, state.windows);
    if (state.walls.length === 0) {
      elResult.innerHTML = '<p class="paint-result paint-result-empty">Add a wall to compute paint needs.</p>';
      return;
    }
    var html = '<p class="paint-result">';
    html += 'Recommended: <strong>' + calc.gallons + '</strong> gallon' + (calc.gallons === 1 ? '' : 's');
    html += ' (covers ' + Math.max(0, calc.totalArea) + ' sq ft after subtracting openings)';
    html += '</p>';
    if (calc.totalArea <= 0) {
      html += '<p class="paint-result-detail">Openings exceed wall area — verify door and window counts.</p>';
    }
    elResult.innerHTML = html;
  }

  // -------------------------------------------------------------
  // Input handlers
  // -------------------------------------------------------------
  function onWallWidthChange(ev) {
    var idx = parseInt(ev.target.getAttribute('data-wall-index'), 10);
    if (!Number.isFinite(idx) || idx < 0 || idx >= state.walls.length) return;
    var v = parseFloat(ev.target.value);
    state.walls[idx].w = Number.isFinite(v) ? Math.max(0, v) : 0;
    renderResult();
    writeUrlState();
  }
  function onWallHeightChange(ev) {
    var idx = parseInt(ev.target.getAttribute('data-wall-index'), 10);
    if (!Number.isFinite(idx) || idx < 0 || idx >= state.walls.length) return;
    var v = parseFloat(ev.target.value);
    state.walls[idx].h = Number.isFinite(v) ? Math.max(0, v) : 0;
    renderResult();
    writeUrlState();
  }
  function onDoorsChange() {
    var v = parseFloat(elDoors.value);
    state.doors = Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
    elDoors.value = String(state.doors);
    renderResult();
    writeUrlState();
  }
  function onWindowsChange() {
    var v = parseFloat(elWindows.value);
    state.windows = Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
    elWindows.value = String(state.windows);
    renderResult();
    writeUrlState();
  }
  function onAddWallClick() {
    state.walls.push({ w: 0, h: 0 });
    render();
  }
  function onRemoveWallClick(ev) {
    var idx = parseInt(ev.currentTarget.getAttribute('data-wall-index'), 10);
    if (!Number.isFinite(idx) || idx < 0 || idx >= state.walls.length) return;
    state.walls.splice(idx, 1);
    render();
  }

  // -------------------------------------------------------------
  // URL state
  // -------------------------------------------------------------
  function writeUrlState() {
    try {
      var params = new URLSearchParams();
      params.set('walls', core.buildWallsBase64(state.walls));
      params.set('doors', String(state.doors));
      params.set('windows', String(state.windows));
      var qs = params.toString();
      var url = location.pathname + '?' + qs + location.hash;
      if (typeof history !== 'undefined' && history.replaceState) {
        history.replaceState(null, '', url);
      }
    } catch (e) { /* noop */ }
  }

  function applyUrlState() {
    try {
      var search = (typeof location !== 'undefined' && location.search) ? location.search : '';
      if (!search) return;
      var params = new URLSearchParams(search);
      var wallsParam = params.get('walls');
      var parsedWalls = core.parseWallsBase64(wallsParam);
      if (parsedWalls && parsedWalls.length > 0) {
        state.walls = parsedWalls;
      }
      var doorsParam = params.get('doors');
      if (doorsParam != null) {
        var d = parseInt(doorsParam, 10);
        if (Number.isFinite(d) && d >= 0) state.doors = d;
      }
      var windowsParam = params.get('windows');
      if (windowsParam != null) {
        var w = parseInt(windowsParam, 10);
        if (Number.isFinite(w) && w >= 0) state.windows = w;
      }
    } catch (e) { /* noop */ }
  }

  // -------------------------------------------------------------
  // Action buttons
  // -------------------------------------------------------------
  function onSampleClick() {
    state.walls = SAMPLE_WALLS.map(function (w) { return { w: w.w, h: w.h }; });
    state.doors = DEFAULTS.doors;
    state.windows = DEFAULTS.windows;
    render();
    if (elDoors) elDoors.value = String(state.doors);
    if (elWindows) elWindows.value = String(state.windows);
  }
  function onResetClick() {
    state.walls = [];
    state.doors = 0;
    state.windows = 0;
    render();
    if (elDoors) elDoors.value = String(state.doors);
    if (elWindows) elWindows.value = String(state.windows);
  }
  function onPrintClick() {
    try { window.print(); } catch (e) { /* noop */ }
  }
  function onShareClick() {
    var url = (typeof location !== 'undefined' && location.href) ? location.href : '';
    if (!url) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(url).then(function () {
        if (typeof HT.toast === 'function') HT.toast('URL copied');
      }, function () {
        if (typeof console !== 'undefined' && console.info) console.info('paint-calculator share:', url);
      });
    } else if (typeof console !== 'undefined' && console.info) {
      console.info('paint-calculator share:', url);
    }
  }

  // -------------------------------------------------------------
  // Keyboard shortcuts (s = sample, r = reset, p = print, c = copy share URL)
  // tools.json shortcuts[]: s, r, p, c.
  // -------------------------------------------------------------
  function onKeydown(ev) {
    if (!ev) return;
    var target = ev.target;
    var tag = target && target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    var key = ev.key;
    if (key === 's' || key === 'S') { ev.preventDefault(); onSampleClick(); }
    else if (key === 'r' || key === 'R') { ev.preventDefault(); onResetClick(); }
    else if (key === 'p' || key === 'P') { ev.preventDefault(); onPrintClick(); }
    else if (key === 'c' || key === 'C') { ev.preventDefault(); onShareClick(); }
  }

  // -------------------------------------------------------------
  // Init — called by core after handlers.js lazy-load
  // -------------------------------------------------------------
  function init() {
    elWallsList = $('[data-pc-role="walls"]');
    elDoors = $('#pc-doors');
    elWindows = $('#pc-windows');
    elResult = $('#pc-result');
    elAddWall = $('[data-action="add-wall"]');
    elSample = $('[data-action="sample"]');
    elReset = $('[data-action="reset"]');
    elPrint = $('[data-action="print"]');
    elShare = $('[data-action="share"]');

    if (elDoors) {
      elDoors.addEventListener('input', HT.debounce(onDoorsChange, 120));
    }
    if (elWindows) {
      elWindows.addEventListener('input', HT.debounce(onWindowsChange, 120));
    }
    if (elAddWall) elAddWall.addEventListener('click', onAddWallClick);
    if (elSample) elSample.addEventListener('click', onSampleClick);
    if (elReset) elReset.addEventListener('click', onResetClick);
    if (elPrint) elPrint.addEventListener('click', onPrintClick);
    if (elShare) elShare.addEventListener('click', onShareClick);

    document.addEventListener('keydown', onKeydown);

    applyUrlState();
    if (elDoors) elDoors.value = String(state.doors);
    if (elWindows) elWindows.value = String(state.windows);
    render();
  }

  window.paintCalculatorInit = init;
})();