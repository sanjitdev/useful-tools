/* ============================================
   Handy Tools — shell-embed.js (Story 4.2)
   Orchestrator extracted from shell.js boot().

   This module is loaded by shell.js boot() AFTER
   assets/js/embed.js has resolved (lazy-loaded
   via the Proxy stub in shell-thin.js). It
   encapsulates the per-tool embed-modal mount
   call site so shell.js boot() stays slim.

   Behavior contract:
   - Skipped in embed mode (AD-7) — embed visitors
     can't embed-it-further; the Embed button is
     not rendered and openModal is a no-op.
   - Skipped when <main data-slug="..."> is absent
     or doesn't match the slug-shape regex.
   - Skipped when the slug has no embed-snippet
     block (HT.embed._resolveSnippetSchema returns
     hasEmbed=false) — without one, the modal has
     no snippet to render and no live preview.
   - HT.embed.mount is the Shell-side mount helper
     that wires the Embed button into .tool-actions
     (after the Share button) and pre-builds the
     embed modal lazily on first open.
   ============================================ */

(function () {
  'use strict';

  if (typeof window === 'undefined') return;

  const HT = (window.HT = window.HT || {});

  HT.shellEmbed = Object.freeze({
    mount: function (slug, main) {
      if (!main || typeof main.getAttribute !== 'function') return;
      if (!slug || !/^[a-z][a-z0-9-]*[a-z0-9]$/.test(slug)) return;
      if (!HT.embed || typeof HT.embed.mount !== 'function') return;
      try {
        HT.embed.mount(slug, main);
      } catch (err) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('shell-embed: HT.embed.mount failed', err);
        }
      }
    },
  });
})();