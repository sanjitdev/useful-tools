/* ============================================
   Timestamp Converter
   Convert between Unix epoch (seconds or ms),
   ISO 8601, RFC 2822, and human-readable
   formats. Single + batch modes.

   Pure offline — no fetch / XHR / HT.provide.
   ============================================ */

(function () {
  'use strict';

  // ---------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------

  // Unix epoch magnitudes:
  //   1-10 digits  → seconds  (up to year 2286, 10^10 - 1 = 9999999999)
  //   11-16 digits → ms       (10^11 = year 1973, 10^16 = year 5138)
  //   17+ digits   → rejected
  var UNIX_SECONDS_RE = /^\d{1,10}$/;
  var UNIX_MILLISECONDS_RE = /^\d{11,16}$/;

  // ISO 8601:
  //   date-only: YYYY-MM-DD
  //   datetime: YYYY-MM-DDThh:mm[:ss[.ffff]][Z|±hh[:mm]]
  var ISO_8601_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

  // RFC 2822: starts with 3-letter weekday + comma
  var RFC_2822_RE = /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s+\d{2}:\d{2}(:\d{2})?\s+(GMT|[+-]\d{4})$/;

  var MAX_DIGITS = 16;

  var FORMAT_LABELS = {
    'unix-seconds': 'Unix seconds',
    'unix-milliseconds': 'Unix milliseconds',
    'iso-8601': 'ISO 8601',
    'rfc-2822': 'RFC 2822',
    'human-utc': 'Human UTC',
    'human-local': 'Human local'
  };

  // ---------------------------------------------------------------
  // Classifier
  // ---------------------------------------------------------------

  function classify(raw) {
    if (typeof raw !== 'string') return { kind: 'invalid', reason: 'not a string' };
    var s = raw.trim();
    if (s === '') return { kind: 'empty', reason: 'empty input' };

    // Reject leading signs, whitespace, or non-digits for epoch
    if (/^[+-]/.test(s)) {
      return { kind: 'invalid', reason: 'signs not allowed' };
    }

    // Try Unix epoch (digits only)
    if (/^\d+$/.test(s)) {
      if (s.length > MAX_DIGITS) {
        return { kind: 'invalid', reason: 'epoch out of range (max ' + MAX_DIGITS + ' digits)' };
      }
      if (UNIX_SECONDS_RE.test(s)) {
        return { kind: 'unix-seconds', seconds: parseInt(s, 10) };
      }
      if (UNIX_MILLISECONDS_RE.test(s)) {
        return { kind: 'unix-milliseconds', ms: parseInt(s, 10) };
      }
      return { kind: 'invalid', reason: 'epoch out of range' };
    }

    // Try ISO 8601
    if (ISO_8601_RE.test(s)) {
      var ms = Date.parse(s);
      if (!isNaN(ms)) {
        // Detect naive datetime (no timezone marker) for the inline warning.
        var naive = /T\d{2}:\d{2}/.test(s) && !/(Z|[+-]\d{2}:?\d{2})$/.test(s);
        return {
          kind: 'iso-8601',
          ms: ms,
          naive: naive,
          hasTime: /T\d{2}:\d{2}/.test(s)
        };
      }
      return { kind: 'invalid', reason: 'ISO 8601 failed to parse' };
    }

    // Try RFC 2822
    if (RFC_2822_RE.test(s)) {
      var ms2 = Date.parse(s);
      if (!isNaN(ms2)) {
        return { kind: 'rfc-2822', ms: ms2 };
      }
      return { kind: 'invalid', reason: 'RFC 2822 failed to parse' };
    }

    return { kind: 'invalid', reason: 'unrecognized format' };
  }

  // ---------------------------------------------------------------
  // Formatters
  // ---------------------------------------------------------------

  function toUnixSeconds(ms) {
    return Math.floor(ms / 1000);
  }

  function toUnixMs(ms) {
    return ms;
  }

  function toIso8601(ms) {
    return new Date(ms).toISOString();
  }

  function toRfc2822(ms) {
    return new Date(ms).toUTCString();
  }

  function toHumanUtc(ms) {
    return new Date(ms).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  }

  function toHumanLocal(ms) {
    try {
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'medium'
      }).format(new Date(ms));
    } catch (e) {
      // Fallback if Intl is missing
      var d = new Date(ms);
      return d.toLocaleString();
    }
  }

  function formatOutputs(ms) {
    return {
      'unix-seconds': String(toUnixSeconds(ms)),
      'unix-milliseconds': String(toUnixMs(ms)),
      'iso-8601': toIso8601(ms),
      'rfc-2822': toRfc2822(ms),
      'human-utc': toHumanUtc(ms),
      'human-local': toHumanLocal(ms)
    };
  }

  // ---------------------------------------------------------------
  // DOM rendering
  // ---------------------------------------------------------------

  var inputEl, batchInputEl, singlePanel, batchPanel, batchTableEl, batchCaptionEl;
  var detectedEl, warningEl, errorEl, copyButtons, modeButtons;
  var currentMode = 'single';

  function setOutput(id, value) {
    var el = HT.$('#' + id);
    if (el) el.value = value == null ? '' : String(value);
  }

  function clearOutputs() {
    ['ts-unix-s', 'ts-unix-ms', 'ts-iso', 'ts-rfc', 'ts-human-utc', 'ts-human-local']
      .forEach(function (id) { setOutput(id, ''); });
  }

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

    // Range check
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

    // Only mutate URL state and push history on a successful decode.
    // Empty / invalid input is transient (mid-typing); persisting it to
    // the URL would create noisy history entries and pollute the shareable
    // link.
    writeUrlState(inputEl.value, currentMode);
    pushHistory(result.kind, currentMode);
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

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---------------------------------------------------------------
  // Public surface for tests + introspection (HT.timestamp)
  // ---------------------------------------------------------------

  var HT_TIMESTAMP_HANDLE = Object.freeze({
    version: '1.0.0',
    classify: classify,
    formatOutputs: formatOutputs,
    toUnixSeconds: toUnixSeconds,
    toUnixMs: toUnixMs,
    toIso8601: toIso8601,
    toRfc2822: toRfc2822,
    toHumanUtc: toHumanUtc,
    toHumanLocal: toHumanLocal,
  });

  try {
    if (typeof window !== 'undefined') {
      window.HT_TIMESTAMP = HT_TIMESTAMP_HANDLE;
    }
  } catch (e) { /* sandboxed */ }

  try {
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = HT_TIMESTAMP_HANDLE;
    }
  } catch (e) { /* browser */ }

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

    // Embed mode: skip input from URL state
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

    // Keyboard shortcuts
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
