/* ============================================
   JWT Inspector — jwt-inspector-core.js (Story 4b Phase 3)
   Parse-time core: supported algorithm list + constant
   labels + boot. Handlers reference these via HT.jwtInspectorCore.

   Story 4b — see _bmad-output/implementation-artifacts/
   story-4b-per-tool-code-splitting.md
   ============================================ */

(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.HT) return;
  var HT = window.HT;

  // -------------------------------------------------------------
  // Supported algorithms (ROQ-3 — only HS256/RS256/ES256).
  // -------------------------------------------------------------
  var SUPPORTED_ALGS = ['hs256', 'rs256', 'es256'];

  // -------------------------------------------------------------
  // Expose data tables to handlers (AD-14 internal handle).
  // -------------------------------------------------------------
  HT.jwtInspectorCore = Object.freeze({
    getSupportedAlgs: function () { return SUPPORTED_ALGS; },
  });

  // -------------------------------------------------------------
  // Boot — DOMContentLoaded → lazy-load handlers.js → init()
  // -------------------------------------------------------------
  function boot() {
    if (typeof HT.lazyLoadTool !== 'function') return;
    HT.lazyLoadTool('jwt-inspector', './jwt-inspector-handlers.js').then(function () {
      if (typeof window.jwtInspectorInit === 'function') {
        try { window.jwtInspectorInit(); }
        catch (err) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('jwt-inspector-core: jwtInspectorInit threw', err);
          }
        }
      }
    }).catch(function (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('jwt-inspector-core: lazyLoadTool failed', err);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
