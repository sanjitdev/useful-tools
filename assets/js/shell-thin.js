/* ============================================
   Handy Tools — shell-thin.js (Story 4, Phase 2 + Phase 4)
   Tier 1 boot orchestrator. The slim shell that
   ships on every chrome page in place of
   shell.js. Strategy: lazy-load shell.js on
   DOMContentLoaded (preserving the existing
   boot order), with Proxy stubs for every
   chrome namespace (history, urlState, palette,
   sampleData, share, export, import, a11y) so
   tool IIFEs and shell.js boot() can read those
   namespaces before the underlying modules load
   (the Proxy triggers the lazy-load transparently
   on first property access).

   Phase 4 re-enables 5 chrome namespaces that
   the Phase 3 slim Tier 1 sweep stripped from
   the eager script block (sample-data.js,
   share.js, export.js, import.js, a11y.js). All
   8 namespaces now share the same lazy-load
   pattern. The lazy-load round-trip is
   transparent: boot()'s `HT.sampleData.mount(slug, main)`
   hits the Proxy, fires `lazyLoad('assets/js/sample-data.js')`,
   and forwards to the real `mount` once the
   module is parsed.

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
  // After Story 4 Phase 3 swept the heavy chrome script block from
  // every chrome page, the page no longer eagerly loads
  // sample-data.js, share.js, export.js, import.js, or a11y.js —
  // those modules now lazy-load on first property access via these
  // Proxy stubs. The boot() function in shell.js already has
  // `HT.sampleData && typeof HT.sampleData.mount === 'function'`
  // guards (and analogously for share / export / import / a11y),
  // so before Phase 4 those `mount` calls were silently skipped.
  // Phase 4 re-enables them via the same Proxy pattern used for
  // history / urlState / palette.
  //
  // NOTE: We bind to `lazyLoad` from ht-lazy.js which must load
  // BEFORE this file. The script order invariant is:
  //   site-config → storage-registry → utils → ht-lazy → shell-thin
  // ------------------------------------------------------------------
  const TIER2_URLS = {
    history: 'assets/js/history.js',
    urlState: 'assets/js/url.js',
    palette: 'assets/js/palette-actions.js',
    // Story 4 Phase 4 — re-enable chrome features that the slim Tier 1
    // sweep stripped from the eager script block. Each of these
    // namespaces is consumed by shell.js boot() (Sample/Reset → mount,
    // Share → mount, Export → button, Import → button, A11y audit →
    // hotkey + button). All of them share the same lazy-load + Proxy
    // shape as history/urlState/palette.
    sampleData: 'assets/js/sample-data.js',
    share: 'assets/js/share.js',
    exportData: 'assets/js/export.js',
    importData: 'assets/js/import.js',
    a11y: 'assets/js/a11y.js',
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
  // Story 4 Phase 4: re-enable lazy-load for the chrome namespaces
  // that the slim Tier 1 sweep stripped from the eager script block.
  // Each Proxy property access transparently triggers the lazy-load
  // and forwards to the real namespace once it resolves.
  //
  // HT.export / HT.import look like reserved-word writes at first
  // glance, but `HT.export.run()` is just a member-access expression
  // — ES2015+ allows reserved words as property names after a dot.
  // The Proxy stub lives on HT.export (not HT.exportData), so
  // boot()'s `HT.export.run()` and `HT.import.run()` find the
  // Proxy transparently.
  HT.sampleData = makeProxy(TIER2_URLS.sampleData, 'sampleData');
  HT.share      = makeProxy(TIER2_URLS.share, 'share');
  HT.export     = makeProxy(TIER2_URLS.exportData, 'export');
  HT.import     = makeProxy(TIER2_URLS.importData, 'import');
  HT.a11y       = makeProxy(TIER2_URLS.a11y, 'a11y');

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
