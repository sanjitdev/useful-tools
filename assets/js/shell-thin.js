/* ============================================
   Handy Tools — shell-thin.js (Story 4, Phase 1)
   Tier 1 boot orchestrator. Phase 1 ships a
   stub that logs "thin boot ok" and exposes
   no API — Phase 2 will move theme FOUC,
   palette DOM, settings DOM, and chrome button
   wiring from shell.js into this file.

   Tier 1 module (loaded on every chrome page
   immediately after ht-lazy.js). Sits in the
   slim shell decomposition at ~9.5 KB gz after
   Phase 2.

   Story 4 — see _bmad-output/planning-artifacts/
   plans/story-4-embed-slim-build.md
   ============================================ */

(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  const HT = (window.HT = window.HT || {});

  // Phase 1 marker so the smoke harness can verify the stub loaded.
  // Removed in Phase 2 when shell-thin.js becomes the real boot orchestrator.
  HT.shellThinLoaded = true;

  // Phase 1 stub: log and bail. Phase 2 replaces this body with the
  // real boot() that wires theme FOUC, palette DOM, settings DOM,
  // chrome buttons, and Proxy stubs for HT.history / HT.urlState / HT.palette.
  if (typeof console !== 'undefined' && console.log) {
    console.log('shell-thin: stub ok — real boot ships in Phase 2');
  }
})();
