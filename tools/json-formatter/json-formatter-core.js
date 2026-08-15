/* ============================================
   JSON Formatter — json-formatter-core.js (Story 4b Phase 4)
   Parse-time core: pure helpers (DEFAULT_INPUT, ALLOWED features,
   sortKeysRecursive, lineColumnOfError, parseSafe, escapeHtml),
   exposed via HT.jsonFormatterCore. Handlers use these to build
   the rendered output.

   Story 4b — see _bmad-output/implementation-artifacts/
   story-4b-per-tool-code-splitting.md
   ============================================ */

(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.HT) return;
  var HT = window.HT;

  // -------------------------------------------------------------
  // Defaults
  // -------------------------------------------------------------

  var DEFAULT_INPUT = '{\n  "name": "Handy Tools",\n  "version": 1,\n  "tags": ["utility", "static", "vanilla"],\n  "author": { "name": "you", "email": "you@example.com" },\n  "active": true,\n  "beta": null\n}';

  var ALLOWED_FEATURES = { sort: 1, schema: 1, diff: 1 };

  // -------------------------------------------------------------
  // Escape (used by tree + schema-error renderers in handlers)
  // -------------------------------------------------------------

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // -------------------------------------------------------------
  // Parse error → human-readable position
  // -------------------------------------------------------------

  function lineColumnOfError(text, err) {
    var lines = text.split('\n');
    var matched = /\bline\s+(\d+)\s+column\s+(\d+)/.exec(err.message || '');
    if (matched) {
      return 'line ' + matched[1] + ', column ' + matched[2];
    }
    var pos = (err.message || '').match(/position\s+(\d+)/);
    if (pos) {
      var p = parseInt(pos[1], 10);
      var upto = text.slice(0, p);
      var ln = upto.split('\n').length;
      var col = p - upto.lastIndexOf('\n');
      return 'around line ' + ln + ', column ' + col;
    }
    return err.message || 'parse error';
  }

  function parseSafe(text) {
    try {
      var parsed = JSON.parse(text);
      return { ok: true, parsed: parsed, text: text };
    } catch (e) {
      return { ok: false, error: lineColumnOfError(text, e) };
    }
  }

  // -------------------------------------------------------------
  // AC-1: sortKeys (deep, recursive)
  // -------------------------------------------------------------

  function sortKeysRecursive(value) {
    if (Array.isArray(value)) return value.map(sortKeysRecursive);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.keys(value).sort().map(function (k) { return [k, sortKeysRecursive(value[k])]; })
      );
    }
    return value;
  }

  // -------------------------------------------------------------
  // Feature gating helpers
  // -------------------------------------------------------------

  function readFeatures(searchString) {
    try {
      var params = new URLSearchParams(searchString || '');
      var raw = (params.get('feature') || '').toLowerCase();
      if (!raw) return [];
      var out = {};
      raw.split(',').forEach(function (part) {
        var t = part.trim();
        if (ALLOWED_FEATURES[t]) out[t] = 1;
      });
      return Object.keys(out);
    } catch (_) {
      return [];
    }
  }

  // -------------------------------------------------------------
  // Expose data + helpers to handlers (AD-14 internal handle).
  // -------------------------------------------------------------
  HT.jsonFormatterCore = Object.freeze({
    getDefaultInput: function () { return DEFAULT_INPUT; },
    getAllowedFeatures: function () { return ALLOWED_FEATURES; },
    escapeHtml: escapeHtml,
    lineColumnOfError: lineColumnOfError,
    parseSafe: parseSafe,
    sortKeysRecursive: sortKeysRecursive,
    readFeatures: readFeatures,
  });

  // -------------------------------------------------------------
  // Boot — DOMContentLoaded → lazy-load handlers.js → init()
  // -------------------------------------------------------------
  function boot() {
    if (typeof HT.lazyLoadTool !== 'function') return;
    HT.lazyLoadTool('json-formatter', './json-formatter-handlers.js').then(function () {
      if (typeof window.jsonFormatterInit === 'function') {
        try { window.jsonFormatterInit(); }
        catch (err) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('json-formatter-core: jsonFormatterInit threw', err);
          }
        }
      }
    }).catch(function (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('json-formatter-core: lazyLoadTool failed', err);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
