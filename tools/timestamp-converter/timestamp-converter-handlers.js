/* ============================================
   Timestamp Converter — timestamp-converter-handlers.js (Story 4b Phase 3)
   Lazy chunk: DOM refs, render (single + batch), URL state, history,
   copy buttons, mode toggle, now button, keyboard, init.

   Loaded via HT.lazyLoadTool('timestamp-converter', './timestamp-converter-handlers.js')
   on DOMContentLoaded by core.js.

   Math/data are read via HT.timestampConverterCore (internal handle).

   Story 4b — see _bmad-output/implementation-artifacts/
   story-4b-per-tool-code-splitting.md
   ============================================ */

(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.HT) return;
  if (!window.HT.timestampConverterCore) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('timestamp-converter-handlers: HT.timestampConverterCore missing — timestamp-converter-core.js must load first.');
    }
    return;
  }
  var HT = window.HT;
  var core = HT.timestampConverterCore;
  var FORMAT_LABELS = core.getFormatLabels();
  var classify = core.classify;
  var formatOutputs = core.formatOutputs;

  // ---------------------------------------------------------------
  // DOM refs (populated in init)
  // ---------------------------------------------------------------
  var inputEl, batchInputEl, singlePanel, batchPanel, batchTableEl, batchCaptionEl;
  var detectedEl, warningEl, errorEl, copyButtons, modeButtons;
  var currentMode = 'single';

  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------
  function setOutput(id, value) {
    var el = HT.$('#' + id);
    if (el) el.value = value == null ? '' : String(value);
  }

  function clearOutputs() {
    ['ts-unix-s', 'ts-unix-ms', 'ts-iso', 'ts-rfc', 'ts-human-utc', 'ts-human-local']
      .forEach(function (id) { setOutput(id, ''); });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---------------------------------------------------------------
  // DOM rendering — single mode
  // ---------------------------------------------------------------
  function renderOutputs(ms) {
    var out = formatOutputs(ms);
    Object.keys(out).forEach(function (k) {
      var targetId = {
        'unix-seconds': 'ts-unix-s',
        'unix-milliseconds': 'ts-unix-ms',
        'iso-8601': 'ts-iso',
        'rfc-2822': 'ts-rfc',
        'human-utc': 'ts-human-utc',
        'human-local': 'ts-human-local'
      }[k];
      setOutput(targetId, out[k]);
    });
  }

  function showDetected(label) {
    if (!detectedEl) return;
    detectedEl.textContent = 'Detected: ' + label;
    detectedEl.hidden = false;
  }
  function hideDetected() {
    if (!detectedEl) return;
    detectedEl.textContent = '';
    detectedEl.hidden = true;
  }
  function showError(msg) {
    if (!errorEl) return;
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }
  function hideError() {
    if (!errorEl) return;
    errorEl.textContent = '';
    errorEl.hidden = true;
  }
  function showWarning(msg) {
    if (!warningEl) return;
    warningEl.textContent = msg;
    warningEl.hidden = false;
  }
  function hideWarning() {
    if (!warningEl) return;
    warningEl.textContent = '';
    warningEl.hidden = true;
  }

  function renderSingle() {
    if (!inputEl) return;
    var raw = inputEl.value || '';
    var result = classify(raw);

    if (result.kind === 'empty') {
      clearOutputs();
      hideDetected();
      hideError();
      hideWarning();
      return;
    }

    if (result.kind === 'invalid') {
      clearOutputs();
      hideDetected();
      hideWarning();
      showError('Unrecognized format: ' + raw);
      return;
    }

    hideError();
    var ms = result.kind === 'unix-seconds'
      ? result.seconds * 1000
      : result.ms;

    if (ms < -8640000000000000 || ms > 8640000000000000) {
      clearOutputs();
      hideDetected();
      showError('Date out of range: ' + raw);
      return;
    }

    renderOutputs(ms);
    showDetected(FORMAT_LABELS[result.kind] || result.kind);

    if (result.naive) {
      showWarning('Interpreted as UTC (no timezone specified)');
    } else {
      hideWarning();
    }

    writeUrlState(inputEl.value, currentMode);
    pushHistory(result.kind, currentMode);
  }

  // ---------------------------------------------------------------
  // Batch mode
  // ---------------------------------------------------------------
  function renderBatch() {
    if (!batchTableEl || !batchInputEl) return;
    var raw = batchInputEl.value || '';
    var lines = raw.split(/[\r\n]+/).filter(function (l) { return l.trim() !== ''; });

    if (lines.length === 0) {
      batchTableEl.innerHTML = '';
      if (batchCaptionEl) batchCaptionEl.textContent = '';
      return;
    }

    var parsedCount = 0;
    var rows = [];
    lines.forEach(function (line, idx) {
      var result = classify(line);
      if (result.kind === 'invalid' || result.kind === 'empty') {
        rows.push('<tr>' +
          '<td>' + (idx + 1) + '</td>' +
          '<td class="ts-error-cell">error: ' + escapeHtml(result.reason || 'invalid') + '</td>' +
          '<td>—</td><td>—</td><td>—</td>' +
          '</tr>');
        return;
      }
      parsedCount += 1;
      var ms = result.kind === 'unix-seconds' ? result.seconds * 1000 : result.ms;
      var out = formatOutputs(ms);
      rows.push('<tr>' +
        '<td>' + (idx + 1) + '</td>' +
        '<td>' + escapeHtml(FORMAT_LABELS[result.kind] || result.kind) + '</td>' +
        '<td>' + escapeHtml(out['unix-seconds']) + '</td>' +
        '<td>' + escapeHtml(out['iso-8601']) + '</td>' +
        '<td>' + escapeHtml(out['rfc-2822']) + '</td>' +
        '</tr>');
    });

    batchTableEl.innerHTML =
      '<thead><tr><th>Line</th><th>Detected</th><th>Unix s</th><th>ISO 8601</th><th>RFC 2822</th></tr></thead>' +
      '<tbody>' + rows.join('') + '</tbody>';

    if (batchCaptionEl) {
      batchCaptionEl.textContent = 'Batch results (' + lines.length + ' lines, ' + parsedCount + ' parsed)';
    }
  }

  // ---------------------------------------------------------------
  // Mode toggle
  // ---------------------------------------------------------------
  function setMode(mode) {
    currentMode = mode === 'batch' ? 'batch' : 'single';
    if (singlePanel) singlePanel.hidden = (currentMode === 'batch');
    if (batchPanel) batchPanel.hidden = (currentMode === 'single');
    if (modeButtons) {
      modeButtons.forEach(function (b) {
        var isActive = b.getAttribute('data-mode') === currentMode;
        b.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    }
    var activeInput = currentMode === 'batch' ? batchInputEl : inputEl;
    writeUrlState(activeInput ? activeInput.value : '', currentMode);
    if (currentMode === 'batch') renderBatch();
  }

  // ---------------------------------------------------------------
  // URL state
  // ---------------------------------------------------------------
  function readUrlState() {
    try {
      var params = new URLSearchParams(window.location.search);
      return {
        input: params.get('input'),
        mode: params.get('mode')
      };
    } catch (e) {
      return { input: null, mode: null };
    }
  }

  function applyUrlState() {
    var state = readUrlState();

    var isEmbed = false;
    try {
      if (window.HT_SHELL_EMBED === true || window.HT_SHELL_EMBED === 'true') isEmbed = true;
      if (/[?&]embed=1(?:&|$)/.test(window.location.search)) isEmbed = true;
    } catch (_) {}

    if (state.mode === 'batch' || state.mode === 'single') {
      setMode(state.mode);
    } else {
      setMode('single');
    }

    if (state.input !== null && !isEmbed) {
      var targetInput = currentMode === 'batch' ? batchInputEl : inputEl;
      if (targetInput) targetInput.value = state.input;
      if (currentMode === 'batch') renderBatch();
      else renderSingle();
    }
  }

  function writeUrlState(input, mode) {
    try {
      var params = new URLSearchParams(window.location.search);
      if (input) params.set('input', input);
      else params.delete('input');
      if (mode) params.set('mode', mode);
      var qs = params.toString();
      var url = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
      window.history.replaceState(null, '', url);
    } catch (e) { /* sandboxed iframe */ }
  }

  // ---------------------------------------------------------------
  // History push
  // ---------------------------------------------------------------
  function pushHistory(format, mode) {
    try {
      if (window.HT && HT.history && typeof HT.history.push === 'function') {
        HT.history.push({
          'ts-format': format,
          'ts-input-mode': mode
        });
      }
    } catch (e) { /* no-op */ }
  }

  // ---------------------------------------------------------------
  // Copy buttons
  // ---------------------------------------------------------------
  function wireCopyButtons() {
    copyButtons = document.querySelectorAll('[data-action="copy"][data-target]');
    copyButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var targetId = btn.getAttribute('data-target');
        var targetEl = HT.$('#' + targetId);
        if (targetEl && targetEl.value) {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(targetEl.value).catch(function () {
              if (window.HT && HT.copyToClipboard) HT.copyToClipboard(targetEl.value);
            });
          } else if (window.HT && HT.copyToClipboard) {
            HT.copyToClipboard(targetEl.value);
          }
        }
      });
    });
  }

  // ---------------------------------------------------------------
  // Now button
  // ---------------------------------------------------------------
  function useNow() {
    if (!inputEl) return;
    inputEl.value = String(Math.floor(Date.now() / 1000));
    renderSingle();
  }

  // ---------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------
  function init() {
    inputEl = HT.$('#ts-input');
    batchInputEl = HT.$('#ts-batch-input');
    singlePanel = HT.$('#ts-single-panel');
    batchPanel = HT.$('#ts-batch-panel');
    batchTableEl = HT.$('#ts-batch-table');
    batchCaptionEl = HT.$('#ts-batch-caption');
    detectedEl = HT.$('#ts-detected');
    warningEl = HT.$('#ts-warning');
    errorEl = HT.$('#ts-error');
    modeButtons = document.querySelectorAll('[data-action="mode"]');

    wireCopyButtons();

    if (modeButtons) {
      modeButtons.forEach(function (b) {
        b.addEventListener('click', function () {
          setMode(b.getAttribute('data-mode'));
        });
      });
    }

    var nowBtn = HT.$('#ts-now');
    if (nowBtn) nowBtn.addEventListener('click', useNow);

    var onInput = HT.debounce(function () {
      if (currentMode === 'batch') renderBatch();
      else renderSingle();
    }, 150);

    if (inputEl) inputEl.addEventListener('input', onInput);
    if (batchInputEl) batchInputEl.addEventListener('input', onInput);

    document.addEventListener('keydown', function (ev) {
      var target = ev.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      if (ev.key === 'n' || ev.key === 'N') {
        ev.preventDefault();
        useNow();
      } else if (ev.key === 'b' || ev.key === 'B') {
        ev.preventDefault();
        setMode(currentMode === 'single' ? 'batch' : 'single');
      } else if (ev.key === 'c' || ev.key === 'C') {
        ev.preventDefault();
        var iso = HT.$('#ts-iso');
        if (iso && iso.value && navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(iso.value).catch(function () {
            if (window.HT && HT.copyToClipboard) HT.copyToClipboard(iso.value);
          });
        }
      }
    });

    applyUrlState();
  }

  window.timestampConverterInit = init;
})();
