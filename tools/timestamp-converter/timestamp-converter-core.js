/* ============================================
   Timestamp Converter — timestamp-converter-core.js (Story 4b Phase 3)
   Parse-time core: regex patterns, classifier, format helpers,
   format labels, HT_TIMESTAMP public handle (frozen), boot.

   Story 4b — see _bmad-output/implementation-artifacts/
   story-4b-per-tool-code-splitting.md
   ============================================ */

(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.HT) return;
  var HT = window.HT;

  // -------------------------------------------------------------
  // Constants
  // -------------------------------------------------------------

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

  // -------------------------------------------------------------
  // Classifier
  // -------------------------------------------------------------

  function classify(raw) {
    if (typeof raw !== 'string') return { kind: 'invalid', reason: 'not a string' };
    var s = raw.trim();
    if (s === '') return { kind: 'empty', reason: 'empty input' };

    if (/^[+-]/.test(s)) {
      return { kind: 'invalid', reason: 'signs not allowed' };
    }

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

    if (ISO_8601_RE.test(s)) {
      var ms = Date.parse(s);
      if (!isNaN(ms)) {
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

    if (RFC_2822_RE.test(s)) {
      var ms2 = Date.parse(s);
      if (!isNaN(ms2)) {
        return { kind: 'rfc-2822', ms: ms2 };
      }
      return { kind: 'invalid', reason: 'RFC 2822 failed to parse' };
    }

    return { kind: 'invalid', reason: 'unrecognized format' };
  }

  // -------------------------------------------------------------
  // Formatters
  // -------------------------------------------------------------

  function toUnixSeconds(ms) {
    return Math.floor(ms / 1000);
  }

  function toUnixMs(ms) {
    return ms;
  }

  function toIso8601(ms) {
    if (!isFinite(ms)) return '';
    return new Date(ms).toISOString();
  }

  function toRfc2822(ms) {
    return new Date(ms).toUTCString();
  }

  function toHumanUtc(ms) {
    if (!isFinite(ms)) return '';
    return new Date(ms).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  }

  function toHumanLocal(ms) {
    try {
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'medium'
      }).format(new Date(ms));
    } catch (e) {
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

  // -------------------------------------------------------------
  // Public surface for tests + introspection (HT.timestamp)
  // -------------------------------------------------------------

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

  // -------------------------------------------------------------
  // AD-14 internal handle — for handlers.js to read
  // -------------------------------------------------------------
  HT.timestampConverterCore = Object.freeze({
    getFormatLabels: function () { return FORMAT_LABELS; },
    getMaxDigits: function () { return MAX_DIGITS; },
    classify: classify,
    formatOutputs: formatOutputs,
    toUnixSeconds: toUnixSeconds,
    toUnixMs: toUnixMs,
    toIso8601: toIso8601,
    toRfc2822: toRfc2822,
    toHumanUtc: toHumanUtc,
    toHumanLocal: toHumanLocal,
  });

  // -------------------------------------------------------------
  // Boot — DOMContentLoaded → lazy-load handlers.js → init()
  // -------------------------------------------------------------
  function boot() {
    if (typeof HT.lazyLoadTool !== 'function') return;
    HT.lazyLoadTool('timestamp-converter', './timestamp-converter-handlers.js').then(function () {
      if (typeof window.timestampConverterInit === 'function') {
        try { window.timestampConverterInit(); }
        catch (err) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('timestamp-converter-core: timestampConverterInit threw', err);
          }
        }
      }
    }).catch(function (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('timestamp-converter-core: lazyLoadTool failed', err);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
