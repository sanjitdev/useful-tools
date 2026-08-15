/* ============================================
   Handy Tools — shell-sample-data.js (Story 4b Phase 1)
   Orchestrator extracted from shell.js boot().

   This module is loaded by shell.js boot() AFTER
   assets/js/sample-data.js has resolved (lazy-loaded
   via the Proxy stub in shell-thin.js). It
   encapsulates the per-tool Sample/Reset button
   mount call site so shell.js boot() stays slim.

   Behavior contract (unchanged from shell.js
   lines ~391-398):
   - Skipped in embed mode (AD-7)
   - Skipped when <main data-slug="..."> is absent
     or doesn't match the slug-shape regex
   - HT.sampleData.mount is the Shell-side mount
     helper that renders Sample + Reset buttons into
     a .tool-actions flex row. Tools opt in via the
     urlState.sample block in tools.json
   ============================================ */

(function () {
  'use strict';

  if (typeof window === 'undefined') return;

  const HT = (window.HT = window.HT || {});

  HT.shellSampleData = Object.freeze({
    mount: function (slug, main) {
      if (!main || typeof main.getAttribute !== 'function') return;
      if (!slug || !/^[a-z][a-z0-9-]*[a-z0-9]$/.test(slug)) return;
      if (!HT.sampleData || typeof HT.sampleData.mount !== 'function') return;
      try {
        HT.sampleData.mount(slug, main);
      } catch (err) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('shell-sample-data: HT.sampleData.mount failed', err);
        }
      }
    },
  });
})();
