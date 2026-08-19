/* ============================================
   UUID Generator — uuid-generator-handlers.js (Story 4b Phase 4)
   Lazy chunk: DOM refs, URL state helpers, read/write/apply
   state, clear/show error, generate, event handlers, keyboard
   shortcuts, init.

   Loaded via HT.lazyLoadTool('uuid-generator', './uuid-generator-handlers.js')
   on DOMContentLoaded by core.js.

   Pure math (uuidV1/v4/v7, ulid, validate, clampCount) is read
   via HT.uuidGeneratorCore (internal handle).

   Story 4b — see _bmad-output/implementation-artifacts/
   story-4b-per-tool-code-splitting.md
   ============================================ */

(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.HT) return;
  if (!window.HT.uuidGeneratorCore) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('uuid-generator-handlers: HT.uuidGeneratorCore missing — uuid-generator-core.js must load first.');
    }
    return;
  }
  var HT = window.HT;
  var core = HT.uuidGeneratorCore;
  var generateOne = core.generateOne;
  var validate = core.validate;
  var patternFor = core.patternFor;
  var clampCount = core.clampCount;

  // ---------------------------------------------------------------
  // DOM refs (populated in init)
  // ---------------------------------------------------------------
  var versionEl, countEl, genBtn, copyBtn, outputEl, errorEl, warningEl;

  // ---------------------------------------------------------------
  // URL state helpers
  // ---------------------------------------------------------------

  function readUrlState() {
    try {
      var params = new URLSearchParams(window.location.search);
      var v = params.get('version');
      var c = params.get('count');
      return { version: v, count: c };
    } catch (e) {
      return { version: null, count: null };
    }
  }

  function writeUrlState(version, count) {
    try {
      var params = new URLSearchParams(window.location.search);
      params.set('version', version);
      params.set('count', String(count));
      var qs = params.toString();
      var url = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
      window.history.replaceState(null, '', url);
    } catch (e) { /* no-op: replaceState may throw in sandboxed iframes */ }
  }

  // ---------------------------------------------------------------
  // Apply URL state to the form on load
  // ---------------------------------------------------------------

  function applyUrlState() {
    var state = readUrlState();
    var validVersions = ['v1', 'v4', 'v7', 'ulid'];
    var v = validVersions.indexOf(state.version) >= 0 ? state.version : null;
    if (state.version !== null && v === null) {
      // Invalid version → warn + fall back to v4
      if (warningEl) {
        warningEl.textContent = 'Unknown version "' + state.version + '"; defaulted to v4';
        warningEl.hidden = false;
      }
      versionEl.value = 'v4';
    } else if (v !== null) {
      versionEl.value = v;
    } else {
      versionEl.value = 'v4';
    }
    if (state.count !== null) {
      countEl.value = String(clampCount(state.count));
    }
  }

  // ---------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------

  function clearError() {
    if (!errorEl) return;
    errorEl.textContent = '';
    errorEl.hidden = true;
  }

  function showError(version, value) {
    if (!errorEl) return;
    errorEl.textContent =
      'Failed to generate ' + version + ': regex ' + patternFor(version) +
      ' did not match ' + value;
    errorEl.hidden = false;
  }

  function generate() {
    clearError();
    var version = versionEl.value || 'v4';
    var count = clampCount(countEl.value);
    countEl.value = String(count);
    var lines = [];
    for (var i = 0; i < count; i += 1) {
      var v = generateOne(version);
      if (!validate(version, v)) {
        showError(version, v);
        outputEl.value = '';
        return;
      }
      lines.push(v);
    }
    outputEl.value = lines.join('\n');
    writeUrlState(version, count);

    // History push (per AC-5)
    try {
      if (window.HT && HT.history && typeof HT.history.push === 'function') {
        HT.history.push({
          version: version,
          count: String(count),
        });
      }
    } catch (e) { /* no-op */ }
  }

  // ---------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------
  function init() {
    versionEl = HT.$('#uuid-version');
    countEl = HT.$('#uuid-count');
    genBtn = HT.$('#uuid-generate');
    copyBtn = HT.$('#uuid-copy');
    outputEl = HT.$('#uuid-output');
    errorEl = HT.$('#uuid-error');
    warningEl = HT.$('#uuid-url-warning');

    // --- Event handlers ---
    if (genBtn) genBtn.addEventListener('click', generate);

    if (versionEl) {
      versionEl.addEventListener('change', function () {
        writeUrlState(versionEl.value, clampCount(countEl.value));
      });
    }

    if (countEl) {
      countEl.addEventListener('input', HT.debounce(function () {
        countEl.value = String(clampCount(countEl.value));
        writeUrlState(versionEl.value, clampCount(countEl.value));
      }, 200));
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        if (outputEl && outputEl.value) {
          HT.copyToClipboard(outputEl.value);
        }
      });
    }

    // --- Keyboard shortcut: g → generate, c → copy ---
    document.addEventListener('keydown', function (ev) {
      // Ignore when typing in inputs/textareas
      var target = ev.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.tagName === 'BUTTON')) {
        return;
      }
      if (ev.key === 'g' || ev.key === 'G') {
        ev.preventDefault();
        generate();
      } else if (ev.key === 'c' || ev.key === 'C') {
        ev.preventDefault();
        if (outputEl && outputEl.value) HT.copyToClipboard(outputEl.value);
      }
    });

    // --- Initial render ---
    // The output textarea has aria-live="polite" so screen readers
    // announce whatever sits in it. On a bare load (no URL state) we
    // must NOT auto-generate — that would surprise users with an
    // uninvited UUID announcement. When the URL DOES pin a generation
    // (?version= or ?count=) the user has explicitly requested it via
    // the URL, so honour it by generating once on boot.
    applyUrlState();
    if (readUrlState().version !== null || readUrlState().count !== null) {
      generate();
    }
  }

  window.uuidGeneratorInit = init;
})();
