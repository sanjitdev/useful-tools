/* ============================================
   Handy Tools — shell-thin.js (Story 4, Phase 2)
   Tier 1 boot orchestrator. The slim shell that
   ships on every chrome page in place of
   shell.js. Phase 2 strategy: lazy-load
   shell.js on DOMContentLoaded (preserving
   the existing boot order), with Proxy stubs
   for HT.history / HT.urlState / HT.palette
   so tool IIFEs can read those namespaces
   before shell.js loads (the Proxy triggers
   the lazy-load transparently).

   Phase 4 will decompose shell.js into
   shell-history.js + shell-sample-data.js +
   shell-share.js + shell-export.js +
   shell-import.js + shell-a11y.js, each
   loaded on demand. Phase 2 is the safe
   canary: zero changes to shell.js, just
   one tool page (qr-code-generator) points
   at shell-thin.js.

   Story 4 — see _bmad-output/implementation-artifacts/
   story-4-embed-slim-build.md
   ============================================ */

(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  const HT = (window.HT = window.HT || {});

  // ------------------------------------------------------------------
  // AD-14 soft-handoff flag (matches shell.js line 17). The chrome
  // generator copies this verbatim; preserved here so any stale page
  // cached in a user's browser that still references the removed
  // theme.js doesn't break — the flag is a harmless no-op when
  // theme.js is absent.
  // ------------------------------------------------------------------
  window.__htShellReplacesTheme = true;

  // ------------------------------------------------------------------
  // Tier 1 marker for the smoke harness (Phase 1).
  // ------------------------------------------------------------------
  HT.shellThinLoaded = true;

  // ------------------------------------------------------------------
  // Proxy stubs. Tool IIFEs that call `HT.history.push(slug)` at
  // parse time hit the Proxy; first access lazy-loads the underlying
  // module. The Proxy resolves to the real namespace once shell.js
  // (or history.js) loads.
  //
  // NOTE: We bind to `lazyLoad` from ht-lazy.js which must load
  // BEFORE this file. The script order invariant is:
  //   site-config → storage-registry → utils → ht-lazy → shell-thin
  // ------------------------------------------------------------------
  const TIER2_URLS = {
    history: 'assets/js/history.js',
    urlState: 'assets/js/url.js',
    palette: 'assets/js/palette-actions.js',
  };

  function ensureLazy() {
    if (typeof HT.lazyLoad !== 'function') {
      throw new Error('shell-thin: HT.lazyLoad is missing — ht-lazy.js must load before shell-thin.js');
    }
  }

  function makeProxy(url, namespace) {
    return new Proxy({}, {
      get: function (_t, prop) {
        if (typeof prop === 'symbol') return undefined;
        return function () {
          ensureLazy();
          const args = Array.prototype.slice.call(arguments);
          return HT.lazyLoad(url).then(function () {
            const target = HT[namespace];
            if (!target || typeof target[prop] !== 'function') {
              throw new Error('shell-thin: ' + namespace + '.' + prop + ' is not a function after lazy-load');
            }
            return target[prop].apply(target, args);
          });
        };
      },
    });
  }

  HT.history  = makeProxy(TIER2_URLS.history, 'history');
  HT.urlState = makeProxy(TIER2_URLS.urlState, 'urlState');
  HT.palette  = makeProxy(TIER2_URLS.palette, 'palette');

  // ------------------------------------------------------------------
  // DOMContentLoaded → lazy-load shell.js (the real boot orchestrator).
  // shell.js itself registers a DOMContentLoaded listener (line 1868)
  // that calls boot(); we don't want TWO boot() calls, so shell.js
  // gets the original event and we just kick off the lazy-load here.
  //
  // If the document is already past 'loading' (e.g., shell-thin.js
  // loaded after DOMContentLoaded for some reason), kick off the
  // lazy-load synchronously.
  // ------------------------------------------------------------------
  function kickShellBoot() {
    if (typeof HT.lazyLoad !== 'function') return; // ht-lazy.js missing
    HT.lazyLoad('assets/js/shell.js').catch(function (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('shell-thin: lazy-load shell.js failed', err);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', kickShellBoot, { once: true });
  } else {
    // Document already parsed — defer to the next tick so any deferred
    // tool scripts have a chance to register their DOMContentLoaded
    // listeners before shell.js's boot() runs.
    setTimeout(kickShellBoot, 0);
  }
})();
