/* ============================================
   Recipe Scaler — recipe-scaler-handlers.js (Story 4b Phase 3)
   Lazy chunk: DOM refs, render, URL state, actions, wire.
   Loaded via HT.lazyLoadTool('recipe-scaler', './recipe-scaler-handlers.js')
   on DOMContentLoaded by core.js.

   Read-only access to math/data via HT.recipeScalerCore.

   Story 4b — see _bmad-output/implementation-artifacts/
   story-4b-per-tool-code-splitting.md
   ============================================ */

(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.HT) return;
  if (!window.HT.recipeScalerCore) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('recipe-scaler-handlers: HT.recipeScalerCore missing — recipe-scaler-core.js must load first.');
    }
    return;
  }
  var HT = window.HT;
  var core = HT.recipeScalerCore;
  var DEFAULTS = core.getDefaults();
  var FALLBACK_FACTORS = core.getFactors();
  var SAMPLE_RECIPE = core.getSampleRecipe();
  var parseFraction = core.parseFraction;
  var formatFraction = core.formatFraction;
  var parseLine = core.parseLine;
  var tryConvertCore = core.tryConvert;
  var clampMultiplier = core.clampMultiplier;

  // -------------------------------------------------------------
  // DOM refs
  // -------------------------------------------------------------
  var recipeEl = HT.$('#rs-recipe');
  var multEl = HT.$('#rs-multiplier');
  var sysEl = HT.$('#rs-system');
  var outEl = HT.$('#rs-output');
  var summaryEl = HT.$('#rs-summary');
  var btnSample = HT.$('[data-action="sample"]');
  var btnReset = HT.$('[data-action="reset"]');
  var btnPrint = HT.$('[data-action="print"]');
  var btnShare = HT.$('[data-action="share"]');

  // -------------------------------------------------------------
  // State — factors (embedded) + factorsLoaded marker.
  // -------------------------------------------------------------
  var factors = null;
  var factorsLoaded = 'fallback';

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  function readMultiplier() {
    return clampMultiplier(parseFloat(multEl && multEl.value));
  }

  function tryConvert(qty, fromUnit, toSystem) {
    return tryConvertCore(qty, fromUnit, toSystem, factors);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // -------------------------------------------------------------
  // Render (AC-2 / AC-3 / AC-4)
  // -------------------------------------------------------------
  function render() {
    if (!outEl) return;
    var text = recipeEl ? String(recipeEl.value || '') : '';
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim().length > 0; });
    var mult = readMultiplier();
    var system = sysEl ? sysEl.value : DEFAULTS.system;

    var htmlParts = [];
    var parsedCount = 0;
    var unparsedCount = 0;

    if (lines.length === 0) {
      htmlParts.push('<li class="recipe-output-empty">Paste a recipe above to scale it.</li>');
    } else {
      for (var i = 0; i < lines.length; i += 1) {
        var line = lines[i];
        var parsed = parseLine(line);
        if (parsed === null) {
          unparsedCount += 1;
          htmlParts.push(
            '<li class="recipe-line-unparsed">' +
              '<code>' + escapeHtml(line) + '</code>' +
              '<span class="recipe-line-unparsed-explain"> (could not parse — please check format)</span>' +
            '</li>'
          );
          continue;
        }
        parsedCount += 1;
        var scaledQty = parsed.qty * mult;
        var conv = tryConvert(parsed.qty, parsed.unit, system);
        var finalQty, finalUnit, warningUnit;
        if (conv !== null) {
          finalQty = scaledQty * (conv.qty / parsed.qty);
          finalUnit = conv.unit;
        } else {
          finalQty = scaledQty;
          finalUnit = parsed.unit;
          warningUnit = parsed.unit;
        }
        var qtyStr = formatFraction(finalQty);
        var unitHtml;
        if (warningUnit) {
          unitHtml = '<span class="recipe-line-unit"><span class="unit-warning" title="Unknown unit: ' + escapeHtml(warningUnit) + '">' + escapeHtml(finalUnit || warningUnit) + '</span></span>';
        } else if (finalUnit) {
          unitHtml = '<span class="recipe-line-unit">' + escapeHtml(finalUnit) + '</span>';
        } else {
          unitHtml = '<span class="recipe-line-unit"></span>';
        }
        htmlParts.push(
          '<li class="recipe-line">' +
            '<span class="recipe-line-qty">' + escapeHtml(qtyStr) + '</span>' +
            ' ' + unitHtml + ' ' +
            '<span class="recipe-line-ingredient">' + escapeHtml(parsed.ingredient) + '</span>' +
          '</li>'
        );
      }
    }

    outEl.innerHTML = htmlParts.join('');
    if (summaryEl) {
      var summaryText = lines.length === 0
        ? ''
        : 'Scaled ' + parsedCount + ' ingredient' + (parsedCount === 1 ? '' : 's') +
          (unparsedCount > 0 ? ' (' + unparsedCount + ' skipped)' : '') +
          ' ×' + formatFraction(mult) + ' in ' + (system === 'metric' ? 'metric' : 'imperial') + '.';
      summaryEl.textContent = summaryText;
    }
    writeUrlState();
  }

  // -------------------------------------------------------------
  // URL state (AC-4)
  // -------------------------------------------------------------
  function encodeBase64(text) {
    try {
      return btoa(unescape(encodeURIComponent(text)));
    } catch (_) {
      return '';
    }
  }
  function decodeBase64(b64) {
    try {
      return decodeURIComponent(escape(atob(b64)));
    } catch (_) {
      return '';
    }
  }
  function readUrlState() {
    try {
      var p = new URLSearchParams(window.location.search);
      return {
        recipe: p.get('recipe'),
        multiplier: p.get('multiplier'),
        system: p.get('system'),
      };
    } catch (_) {
      return { recipe: null, multiplier: null, system: null };
    }
  }
  function writeUrlState() {
    try {
      var p = new URLSearchParams(window.location.search);
      var recipeText = recipeEl ? String(recipeEl.value || '') : '';
      p.set('recipe', encodeBase64(recipeText));
      if (multEl) p.set('multiplier', String(readMultiplier()));
      if (sysEl) p.set('system', String(sysEl.value));
      var qs = p.toString();
      var url = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
      window.history.replaceState(null, '', url);
    } catch (_) { /* iframe sandboxed — ignore */ }
  }
  function applyUrlState() {
    var s = readUrlState();
    if (s.recipe !== null && s.recipe !== '' && recipeEl) {
      var decoded = decodeBase64(s.recipe);
      if (decoded) {
        recipeEl.value = decoded;
      } else {
        recipeEl.value = SAMPLE_RECIPE;
      }
    } else if (recipeEl && !recipeEl.value) {
      recipeEl.value = SAMPLE_RECIPE;
    }
    if (s.multiplier !== null && multEl) {
      var m = parseFloat(s.multiplier);
      if (Number.isFinite(m)) multEl.value = String(clampMultiplier(m));
    } else if (multEl && !multEl.value) {
      multEl.value = String(DEFAULTS.multiplier);
    }
    if (s.system !== null && sysEl && (s.system === 'metric' || s.system === 'imperial')) {
      sysEl.value = s.system;
    } else if (sysEl && !sysEl.value) {
      sysEl.value = DEFAULTS.system;
    }
  }

  // -------------------------------------------------------------
  // Actions (AC-6)
  // -------------------------------------------------------------
  function actionSample() {
    if (recipeEl) recipeEl.value = SAMPLE_RECIPE;
    if (multEl) multEl.value = String(DEFAULTS.multiplier);
    if (sysEl) sysEl.value = DEFAULTS.system;
    render();
  }
  function actionReset() {
    if (recipeEl) recipeEl.value = '';
    if (multEl) multEl.value = String(DEFAULTS.multiplier);
    if (sysEl) sysEl.value = DEFAULTS.system;
    render();
  }
  function actionPrint() {
    try { window.print(); } catch (_) { /* no-op */ }
  }
  function actionShare() {
    var href = '';
    try { href = window.location.href; } catch (_) {}
    var showOk = function () {
      if (typeof HT !== 'undefined' && HT && typeof HT.toast === 'function') {
        try { HT.toast('URL copied'); return; } catch (_) {}
      }
      if (typeof console !== 'undefined' && console.info) {
        try { console.info('Recipe Scaler: URL copied to clipboard: ' + href); return; } catch (_) {}
      }
    };
    var fail = function () {
      if (typeof console !== 'undefined' && console.info) {
        try { console.info('Recipe Scaler: share URL: ' + href); } catch (_) {}
      }
    };
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        navigator.clipboard.writeText(href).then(showOk, fail);
      } catch (_) { fail(); }
    } else {
      fail();
    }
  }

  // -------------------------------------------------------------
  // Wire events (AC-6 / AC-7)
  // -------------------------------------------------------------
  var onInput = HT.debounce(function () { render(); }, 120);
  function wire() {
    if (recipeEl) recipeEl.addEventListener('input', onInput);
    if (multEl) multEl.addEventListener('input', onInput);
    if (sysEl) sysEl.addEventListener('change', function () { render(); });

    if (btnSample) btnSample.addEventListener('click', actionSample);
    if (btnReset) btnReset.addEventListener('click', actionReset);
    if (btnPrint) btnPrint.addEventListener('click', actionPrint);
    if (btnShare) btnShare.addEventListener('click', actionShare);

    document.addEventListener('keydown', function (ev) {
      var target = ev.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.tagName === 'BUTTON')) {
        return;
      }
      var k = ev.key;
      if (k === 's' || k === 'S') {
        ev.preventDefault();
        actionSample();
      } else if (k === 'r' || k === 'R') {
        ev.preventDefault();
        actionReset();
      } else if (k === 'p' || k === 'P') {
        ev.preventDefault();
        actionPrint();
      } else if (k === 'c' || k === 'C') {
        ev.preventDefault();
        actionShare();
      }
    });
  }

  // -------------------------------------------------------------
  // Init
  // -------------------------------------------------------------
  function init() {
    factors = FALLBACK_FACTORS;
    factorsLoaded = 'fallback';
    applyUrlState();
    wire();
    render();
  }

  window.recipeScalerInit = init;
})();
