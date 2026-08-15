/* ============================================
   Handy Tools — shell-history.js (Story 4b Phase 1)
   Orchestrator extracted from shell.js boot().

   This module is loaded by shell.js boot() AFTER
   assets/js/history.js has resolved (lazy-loaded
   via the Proxy stub in shell-thin.js). It
   encapsulates the per-tool history-panel mount
   call site so shell.js boot() stays slim.

   Behavior contract (unchanged from shell.js
   lines ~408-419):
   - Skipped in embed mode (AD-7)
   - Skipped when <main data-slug="..."> is absent
     or doesn't match the slug-shape regex
   - Skipped when the slug declares no history-keys
     block (HT.history.hasHistory returns false)
   - HT.history.panel is the Shell-side mount
     helper that renders the panel (desktop
     sidebar or mobile sheet depending on width)
   ============================================ */

(function () {
  'use strict';

  if (typeof window === 'undefined') return;

  // The chrome module (history.js) exposes HT.history.panel etc. via
  // the same lazy-load Proxy pattern as everything else. By the time
  // shell.js boot() calls HT.shellHistory.mount(slug, main), the
  // history.js module has been parsed and HT.history is the real
  // object (not the Proxy).
  //
  // Note: HT.shellHistory is a SHELL-INTERNAL handle — it lives on
  // HT under a namespace that mirrors HT_HISTORY_INIT etc. (AD-14
  // internal-handle pattern). Not a public API surface.
  const HT = (window.HT = window.HT || {});

  HT.shellHistory = Object.freeze({
    mount: function (slug, main) {
      if (!main || typeof main.getAttribute !== 'function') return;
      if (!slug || !/^[a-z][a-z0-9-]*[a-z0-9]$/.test(slug)) return;
      if (!HT.history || typeof HT.history.panel !== 'function') return;
      try {
        if (HT.history.hasHistory && HT.history.hasHistory(slug)) {
          HT.history.panel(slug, main);
        }
      } catch (err) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('shell-history: HT.history.panel failed', err);
        }
      }
    },
  });
})();
