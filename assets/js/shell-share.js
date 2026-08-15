/* ============================================
   Handy Tools — shell-share.js (Story 4b Phase 1)
   Orchestrator extracted from shell.js boot().

   This module is loaded by shell.js boot() AFTER
   assets/js/share.js has resolved (lazy-loaded
   via the Proxy stub in shell-thin.js). It
   encapsulates the per-tool share-dialog mount
   call site so shell.js boot() stays slim.

   Behavior contract (unchanged from shell.js
   lines ~426-437):
   - Skipped in embed mode (AD-7)
   - Skipped when <main data-slug="..."> is absent
     or doesn't match the slug-shape regex
   - Skipped when the slug declares no urlState
     block (HT.share.hasShare returns false)
   - HT.share.mount is the Shell-side mount
     helper that wires the share button, dialog,
     and embed snippet for the tool
   ============================================ */

(function () {
  'use strict';

  if (typeof window === 'undefined') return;

  const HT = (window.HT = window.HT || {});

  HT.shellShare = Object.freeze({
    mount: function (slug, main) {
      if (!main || typeof main.getAttribute !== 'function') return;
      if (!slug || !/^[a-z][a-z0-9-]*[a-z0-9]$/.test(slug)) return;
      if (!HT.share || typeof HT.share.mount !== 'function') return;
      try {
        if (HT.share.hasShare && HT.share.hasShare(slug)) {
          HT.share.mount(slug, main);
        }
      } catch (err) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('shell-share: HT.share.mount failed', err);
        }
      }
    },
  });
})();
