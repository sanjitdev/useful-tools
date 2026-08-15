/* ============================================
   Handy Tools — shell-thin.js (Story 4, Phase 2 + Phase 4 + Phase 5)
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

   Phase 5 wires CSS lazy-loading alongside the
   existing JS lazy-load. Each Proxy stub also
   triggers `HT.lazyLoadCss` for its chrome CSS
   chunk (palette → chrome-palette.css, etc.),
   so first paint no longer ships the chrome
   stylesheets. ht-lazy.js (loaded before this
   file) provides HT.lazyLoadCss.

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
    // Story 4 Phase 5 — help-overlay and global-chords were also stripped
    // from the eager block by the Phase 3 sweep and need to be wired
    // into the lazy-load graph. help-overlay.js loads on first
    // HT.palette.openHelp() call (Story 3.3 owns the listener that
    // toggles the overlay). global-chords.js loads in kickShellBoot()
    // alongside shell.js (it's a one-shot DOMContentLoaded listener).
    helpOverlay: 'assets/js/help-overlay.js',
    globalChords: 'assets/js/global-chords.js',
    // Story 4c — quiz pattern shell module. quiz.js is page-conditional
    // (only tools that adopt HT.quiz.open() — currently quiz-preview;
    // planned: lifespan, calorie, bmi, pros-cons, space, bd-tax in
    // Stories 9.13–9.18). quiz.js does `window.HT.quiz = window.HT.quiz
    // || publicApi` at module init, so the Proxy stub assigned here
    // is preserved across the lazy-load round-trip — first call to
    // HT.quiz.open(...) hits the Proxy, fires lazyLoad + lazyLoadCss,
    // and forwards to the real API once quiz.js parses.
    quiz: 'assets/js/quiz.js',
  };

  // Story 4 Phase 5 — chrome CSS chunks lazy-loaded alongside each
  // chrome namespace's first property access. Multiple namespaces may
  // share a CSS file (e.g., sampleData + share both use the
  // confirm/share <dialog> surface); ht-lazy.js dedupes concurrent
  // lazyLoadCss calls so the second one returns the in-flight
  // Promise. urlState / export / import / a11y have no chrome CSS of
  // their own (they reuse Tier 1 styles only), so they map to nothing.
  // The palette Proxy also covers chrome-help.css because
  // HT.palette.openHelp() opens the help overlay.
  const TIER2_CSS = {
    history:     'assets/css/chrome-history.css',
    palette:     'assets/css/chrome-palette.css',
    sampleData:  'assets/css/chrome-confirm-share.css',
    share:       'assets/css/chrome-confirm-share.css',
    exportData:  '',
    importData:  '',
    a11y:        '',
    urlState:    '',
    helpOverlay: 'assets/css/chrome-help.css',
    globalChords: '',
    // Story 4c — quiz.css is co-loaded with quiz.js on first access
    // (the card DOM is created by HT.quiz.open()); CSS is only needed
    // after the JS has parsed, but lazy-loading both in parallel keeps
    // the round-trip to one network event.
    quiz: 'assets/css/quiz.css',
  };

  function ensureLazy() {
    if (typeof HT.lazyLoad !== 'function') {
      throw new Error('shell-thin: HT.lazyLoad is missing — ht-lazy.js must load before shell-thin.js');
    }
  }

  function makeProxy(url, namespace) {
    const cssUrl = TIER2_CSS[namespace] || '';
    return new Proxy({}, {
      get: function (_t, prop) {
        if (typeof prop === 'symbol') return undefined;
        return function () {
          ensureLazy();
          const args = Array.prototype.slice.call(arguments);
          // Story 4 Phase 5: kick off the CSS lazy-load in parallel
          // with the JS lazy-load. lazyLoadCss is a no-op Promise when
          // the URL is empty (namespaces without chrome CSS), so it's
          // safe to call unconditionally.
          const jsP  = HT.lazyLoad(url);
          const cssP = cssUrl ? HT.lazyLoadCss(cssUrl) : Promise.resolve();
          return Promise.all([jsP, cssP]).then(function () {
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
  // Story 4c — quiz pattern Proxy. quiz.js does `window.HT.quiz = window.HT.quiz || publicApi`
  // so the Proxy stub here is preserved across the lazy-load round-trip. The first
  // `HT.quiz.open(...)` call fires lazyLoad('assets/js/quiz.js') + lazyLoadCss('assets/css/quiz.css')
  // in parallel, then `Promise.all`s and forwards to the real HT.quiz.open().
  HT.quiz       = makeProxy(TIER2_URLS.quiz, 'quiz');

  // ------------------------------------------------------------------
  // DOMContentLoaded → lazy-load shell.js (the real boot orchestrator).
  // shell.js itself registers a DOMContentLoaded listener (line 1868)
  // that calls boot(); we don't want TWO boot() calls, so shell.js
  // gets the original event and we just kick off the lazy-load here.
  //
  // Story 4 Phase 5: also kick off chrome modules that need to be
  // available at first paint but aren't covered by Proxy stubs:
  //   - help-overlay.js (Story 3.3 listener for the `?` chord)
  //   - global-chords.js (Story 3.4 `g <key>` cross-page nav)
  //   - chrome-settings.css (settings modal CSS — settings DOM is in
  //     Tier 1 chrome HTML, but the styles aren't on first paint until
  //     shell.js wireSettings() opens the modal)
  //
  // If the document is already past 'loading' (e.g., shell-thin.js
  // loaded after DOMContentLoaded for some reason), kick off the
  // lazy-load synchronously.
  // ------------------------------------------------------------------
  function kickShellBoot() {
    if (typeof HT.lazyLoad !== 'function') return; // ht-lazy.js missing

    function safeLazyLoad(url) {
      if (typeof HT.lazyLoad !== 'function') return Promise.resolve();
      return HT.lazyLoad(url).catch(function (err) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('shell-thin: lazy-load ' + url + ' failed', err);
        }
      });
    }

    safeLazyLoad('assets/js/shell.js');
    // Story 4b Phase 1: shell-*.js orchestrators (extracted from
    // shell.js boot() call sites) must be available by the time
    // shell.js boot() runs. They're tiny (~400 B each) and only
    // gated behind the chrome lazy-load — loading them eagerly
    // here would force them on the home/settings page where the
    // shell-* namespaces are never reached. Lazy is cheaper.
    safeLazyLoad('assets/js/shell-history.js');
    safeLazyLoad('assets/js/shell-share.js');
    safeLazyLoad('assets/js/shell-sample-data.js');
    safeLazyLoad('assets/js/help-overlay.js');
    safeLazyLoad('assets/js/global-chords.js');
    if (typeof HT.lazyLoadCss === 'function') {
      HT.lazyLoadCss('assets/css/chrome-settings.css').catch(function () {});
    }
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
