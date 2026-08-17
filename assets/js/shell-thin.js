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
  // Relative→absolute URL resolver (lazy-load path bug fix).
  //
  // shell-thin.js's TIER2_URLS / TIER2_CSS / kickShellBoot() all use
  // repo-root-relative paths like `assets/js/history.js`. The home
  // page (index.html at repo root) resolves them correctly via the
  // browser's standard `<script src>` resolution: the page's URL is
  // `/`, so `assets/js/quiz.js` → `/assets/js/quiz.js` (correct).
  //
  // But tool pages (tools/<slug>/index.html) live one directory
  // deeper. The browser resolves `assets/js/quiz.js` against the
  // page's URL (`/tools/<slug>/index.html`) and produces
  // `/tools/<slug>/assets/js/quiz.js` — a 404. This bug shipped
  // with Story 4 and never surfaced because no tool page triggered
  // a lazy-load until Story 9.13 wired HT.quiz.open into the
  // lifespan-simulator; the first "Try as quiz" click surfaced the
  // `assets/js/quiz.js` 404 + downstream `assets/js/url.js` 404
  // (urlState is the first namespace any quiz reveal touches).
  //
  // The fix: at IIFE execution time, capture this script's absolute
  // URL via `document.currentScript.src`. The script ALWAYS lives at
  // `<repo-root>/assets/js/shell-thin.js` — both the home page
  // (`<script src="assets/js/shell-thin.js">`) and every tool page
  // (`<script src="../../assets/js/shell-thin.js">`) resolve the
  // script tag to the same absolute URL. Strip the trailing
  // `/assets/js/shell-thin.js` to land at `<repo-root>/`, then
  // resolve every repo-root-relative path against that base.
  //
  // Absolute URLs (http:, https:, //, file:, data:, blob:) and
  // site-root-relative paths (/) pass through untouched. Tested by
  // scripts/_smoke_quiz_proxy.js sections VI + VII.
  // ------------------------------------------------------------------
  const SCRIPT_URL = (function () {
    try {
      // document.currentScript is null in some sandbox contexts (the
      // quiz-proxy smoke runs shell-thin.js in a vm with no
      // <script>); fall back to null so resolveUrl() returns the
      // original relative path (matches the pre-fix behavior — the
      // smoke's own setup overrides currentScript via the lazyLog
      // intercept before assertions run).
      if (typeof document === 'undefined' || !document.currentScript) return null;
      return document.currentScript.src || null;
    } catch (e) {
      return null;
    }
  })();
  // Compute the repo-root base by walking back from this script's
  // URL until we've stripped the chrome-root segment. The script
  // always lives at `<repo>/assets/js/shell-thin.js` per the
  // script-load-order invariant documented at the top of this IIFE;
  // finding the last `assets` segment and slicing everything from
  // there onward lands at the repo root regardless of how deep
  // the script is nested (e.g., if shell-thin.js ever moved to
  // `<repo>/v2/assets/js/shell-thin.js`, the same logic still finds
  // the repo root).
  let REPO_ROOT_BASE = null;
  if (SCRIPT_URL) {
    try {
      const u = new URL(SCRIPT_URL);
      // pathname is like "/assets/js/shell-thin.js"; after splitting
      // on '/' and dropping empties, parts = ["assets", "js",
      // "shell-thin.js"]. `lastIndexOf('assets')` finds the chrome-
      // root segment, and slice(0, idx) drops everything from there
      // onward — landing at the repo root.
      const parts = u.pathname.split('/').filter(function (p) { return p.length > 0; });
      const chromeRootIdx = parts.lastIndexOf('assets');
      const rootParts = chromeRootIdx >= 0 ? parts.slice(0, chromeRootIdx) : [];
      const rootPath = rootParts.length ? '/' + rootParts.join('/') + '/' : '/';
      REPO_ROOT_BASE = u.origin + rootPath;
    } catch (e) {
      REPO_ROOT_BASE = null;
    }
  }
  function resolveUrl(rel) {
    if (!rel || typeof rel !== 'string') return rel;
    // Absolute URLs (http:, https:, //, file:, data:, blob:) and
    // site-root-relative paths (/) pass through untouched.
    if (/^(?:[a-z]+:|\/\/|\/)/i.test(rel)) return rel;
    if (!REPO_ROOT_BASE) return rel; // sandbox/SSR fallback
    try {
      return new URL(rel, REPO_ROOT_BASE).href;
    } catch (e) {
      return rel;
    }
  }

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
    // Story 9.19 — custom date picker. date-picker.js is page-
    // conditional (only tools that opt inputs into HT.datePicker.enhance
    // — currently lifespan-simulator × 2 DOBs, age-calculator × 2,
    // date-difference × 2, countdown-to-date, world-clock,
    // loan-calculator, space-calculator — 10 inputs across 7 tools).
    // date-picker.js does `Object.defineProperty(HT, 'datePicker', {value: publicApi, ...})`
    // so the Proxy stub here is preserved across the lazy-load round-
    // trip. First call to HT.datePicker.enhance(...) hits the Proxy,
    // fires lazyLoad + lazyLoadCss in parallel, and forwards to the
    // real API once date-picker.js parses.
    // Phase 1 rollback (2026-08-17): disabled — tools now use the
    // browser's native <input type="date|time|datetime-local"> pickers.
    // The new picker will be re-introduced as datePickerV2 once the
    // date-picker-lab test page proves it stable. Keep the entry (and
    // the TIER2_CSS entry + the makeProxy call below) commented, not
    // deleted, so the rollback is a one-line uncomment.
    // datePicker: 'assets/js/date-picker.js',
    // Phase 2b (2026-08-17): the rewrite is live. HT.datePickerV2
    // is a brand-new module built from scratch in
    // assets/js/date-picker-v2/ to fix the close/re-open bug class
    // at the root (single source-of-truth open state, native
    // <dialog> for focus trap + Escape, no restore.focus()). It is
    // wired through the same shell-thin Proxy factory. The
    // date-picker-lab test page exercises it end-to-end before any
    // tool adopts it. CSS is JS-injected by date-picker-v2/css.js
    // so the bundle gate's LAZY_CSS_MODULES list does NOT need an
    // entry — the JS file ships its own <style> at first
    // css.inject() call.
    // Phase 2.7 (2026-08-17): `?v=5` — core.js now swaps the
    // input's `type` from "date|time|datetime-local" to "text"
    // on enhance() and restores it on destroy(), so the OS-native
    // picker cannot race the v2 dialog and "look like the default
    // one". `mousedown preventDefault` was unreliable across
    // browsers (the native picker binds to `click`, which fires
    // after mousedown, and some browsers open the native picker
    // before the click event reaches the page). The type-swap is
    // bulletproof — the native picker simply cannot launch
    // without the type attribute. Bump in lockstep with the V
    // constant in date-picker.js.
    datePickerV2: 'assets/js/date-picker-v2/date-picker.js?v=5',
  };

  // Resolve relative paths against this script's own URL so the
  // home page (index.html at repo root) and tool pages
  // (tools/<slug>/index.html) both load from the same repo-relative
  // path. Absolute URLs (http:, /, //) pass through. See the
  // SCRIPT_URL / resolveUrl block at the top of this IIFE for the
  // bug history and the sandbox-fallback contract.
  for (const k in TIER2_URLS) {
    if (Object.prototype.hasOwnProperty.call(TIER2_URLS, k)) {
      TIER2_URLS[k] = resolveUrl(TIER2_URLS[k]);
    }
  }

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
    // Story 9.19 — date picker CSS, co-loaded with date-picker.js on
    // first HT.datePicker.enhance() access. chrome-date-picker.css
    // lives in assets/css/ (chrome-* prefix); see scripts/bundle-
    // size-gate.py LAZY_CSS_MODULES for the gz budget.
    // Phase 1 rollback (2026-08-17): disabled — see TIER2_URLS.datePicker.
    // datePicker: 'assets/css/chrome-date-picker.css',
    // Phase 2b (2026-08-17): the new picker is CSS-injected — no
    // separate lazy CSS file to load. The TIER2_CSS entry is
    // therefore an empty string, which the Proxy factory treats as
    // "no CSS to load" (lazyLoadCss resolves immediately).
    datePickerV2: '',
  };

  // Same path-resolution treatment as TIER2_URLS above. Empty-string
  // entries (namespaces without chrome CSS of their own) are passed
  // through unchanged.
  for (const k in TIER2_CSS) {
    if (Object.prototype.hasOwnProperty.call(TIER2_CSS, k)) {
      TIER2_CSS[k] = resolveUrl(TIER2_CSS[k]);
    }
  }

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
          const jsP   = HT.lazyLoad(url);
          const cssP  = cssUrl ? HT.lazyLoadCss(cssUrl) : Promise.resolve();
          // Date-picker-v2 race fix: some entry scripts register an
          // extended-ready Promise via HT.lazyLoadReady(namespace, p).
          // We must await it before reading HT[namespace], otherwise
          // the namespace is still the Proxy itself and dispatch
          // re-enters this stub — unbounded promise chains.
          const readyP = (typeof HT._getReadyPromise === 'function'
                          && HT._getReadyPromise(namespace)) || Promise.resolve();
          return Promise.all([jsP, cssP, readyP]).then(function () {
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
  // Story 9.19 — date picker Proxy. date-picker.js does `Object.defineProperty(window.HT, 'datePicker', {value: publicApi, writable: false, configurable: false, enumerable: true})`
  // at module init, so the Proxy stub here is preserved across the lazy-load round-trip —
  // first call to HT.datePicker.enhance(...) hits the Proxy, fires lazyLoad + lazyLoadCss,
  // and forwards to the real API once date-picker.js parses.
  // Phase 1 rollback (2026-08-17): disabled — see TIER2_URLS.datePicker.
  // HT.datePicker = makeProxy(TIER2_URLS.datePicker, 'datePicker');
  // Phase 2b (2026-08-17): the rewrite is live. date-picker-v2/
  // date-picker.js does `Object.defineProperty(HT, 'datePickerV2',
  // {value: api, ...})` after its four sub-modules parse — the same
  // pattern as the old date-picker.js + quiz.js. Proxy factory
  // forwards the first property access to that real API once the
  // module has parsed.
  HT.datePickerV2 = makeProxy(TIER2_URLS.datePickerV2, 'datePickerV2');

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

    // All safeLazyLoad / lazyLoadCss calls below use resolveUrl() so
    // tool pages (tools/<slug>/index.html) reach the same
    // assets/ directory as the home page. See SCRIPT_URL / resolveUrl
    // at the top of this IIFE.
    safeLazyLoad(resolveUrl('assets/js/shell.js'));
    // Story 4b Phase 1: shell-*.js orchestrators (extracted from
    // shell.js boot() call sites) must be available by the time
    // shell.js boot() runs. They're tiny (~400 B each) and only
    // gated behind the chrome lazy-load — loading them eagerly
    // here would force them on the home/settings page where the
    // shell-* namespaces are never reached. Lazy is cheaper.
    safeLazyLoad(resolveUrl('assets/js/shell-history.js'));
    safeLazyLoad(resolveUrl('assets/js/shell-share.js'));
    safeLazyLoad(resolveUrl('assets/js/shell-sample-data.js'));
    safeLazyLoad(resolveUrl('assets/js/help-overlay.js'));
    safeLazyLoad(resolveUrl('assets/js/global-chords.js'));
    if (typeof HT.lazyLoadCss === 'function') {
      HT.lazyLoadCss(resolveUrl('assets/css/chrome-settings.css')).catch(function () {});
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
