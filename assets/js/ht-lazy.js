/* ============================================
   Handy Tools — ht-lazy.js (Story 4, Phase 1 + Phase 5)
   Tier 2 chrome lazy loader. Phase 1 shipped
   `HT.lazyLoad(url)`. Phase 5 adds the CSS
   injection primitive `HT.lazyLoadCss(url)` so
   shell-thin.js's Proxy stubs can lazy-load both
   the JS module and its CSS chunk together,
   keeping chrome CSS out of first-paint.

   Loaded once on every chrome page, immediately
   after utils.js. Sits in Tier 1 of the slim
   shell decomposition (~400 bytes gz).

   Public API (AD-14 frozen):
     HT.lazyLoad(url) → Promise<void>
       Lazy-loads `url` exactly once via a
       deduplicating <script> insertion. Resolves
       after the script's `load` event fires.
       Rejects on `error`. Already-loaded urls
       resolve immediately; concurrent callers
       share one Promise.

     HT.lazyLoadCss(url) → Promise<void>  (Phase 5)
       Lazy-injects `url` as a `<link rel="stylesheet">`
       exactly once via deduplicating insertion.
       Idempotent — already-loaded urls resolve
       immediately. Concurrent callers share one
       Promise. Resolves after the link's `load`
       event fires (best-effort; some browsers
       don't fire load for stylesheet <link>, so
       a 200ms timeout fallback is used). Rejects
       on `error`.

   ES2018. AD-14 frozen public API.

   Story 4 — see _bmad-output/implementation-artifacts/
   story-4-embed-slim-build.md
   ============================================ */

(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  const HT = (window.HT = window.HT || {});

  // ------------------------------------------------------------------
  // State — module-level so all callers share.
  // ------------------------------------------------------------------
  const inFlight = new Map(); // js url -> Promise<void>
  const loaded   = new Set(); // js urls already resolved
  const cssInFlight = new Map(); // css url -> Promise<void>
  const cssLoaded   = new Set(); // css urls already injected

  // ------------------------------------------------------------------
  // Core loader.
  // ------------------------------------------------------------------
  function lazyLoad(url) {
    if (typeof url !== 'string' || url.length === 0) {
      return Promise.reject(new Error('ht-lazy: url must be a non-empty string'));
    }
    if (loaded.has(url)) return Promise.resolve();

    let pending = inFlight.get(url);
    if (pending) return pending;

    pending = new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = url;
      s.defer = true;
      s.dataset.htLazy = 'true';
      s.onload  = function () {
        loaded.add(url);
        inFlight.delete(url);
        resolve();
      };
      s.onerror = function () {
        inFlight.delete(url);
        reject(new Error('ht-lazy: failed to load ' + url));
      };
      // Insert as the last script in <head> so DOM order matches the
      // natural script-load-order invariant (utils.js always loaded
      // before any lazy-loaded module).
      (document.head || document.documentElement).appendChild(s);
    });

    inFlight.set(url, pending);
    return pending;
  }

  // ------------------------------------------------------------------
  // CSS injection primitive (Phase 5).
  //
  // Injects a `<link rel="stylesheet">` exactly once per URL.
  // Browser quirks: <link rel="stylesheet"> `load` events are
  // unreliable — Safari historically didn't fire them at all, and
  // some browsers fire them only after the next paint. We use a
  // 200ms wall-clock timeout fallback so callers don't hang waiting
  // for an event that might never come. A real browser-cache hit
  // (the <link> already present) short-circuits via `cssLoaded`.
  // ------------------------------------------------------------------
  function lazyLoadCss(url) {
    if (typeof url !== 'string' || url.length === 0) {
      return Promise.reject(new Error('ht-lazy: css url must be a non-empty string'));
    }
    if (cssLoaded.has(url)) return Promise.resolve();

    let pending = cssInFlight.get(url);
    if (pending) return pending;

    pending = new Promise(function (resolve, reject) {
      // Idempotent DOM check — a page may have already declared
      // <link href="..."> in its <head> for fallbacks.
      const existing = document.querySelector('link[rel="stylesheet"][href="' + url + '"]');
      if (existing) {
        cssLoaded.add(url);
        cssInFlight.delete(url);
        resolve();
        return;
      }
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = url;
      l.dataset.htLazyCss = 'true';

      let settled = false;
      function settle(fn) {
        if (settled) return;
        settled = true;
        cssLoaded.add(url);
        cssInFlight.delete(url);
        fn();
      }
      // Fire both listeners. <link>.onload may not fire (browsers
      // vary); resolve on whichever fires first. The 200ms hard
      // timeout rescues the case where neither fires.
      l.onload  = function () { settle(resolve); };
      l.onerror = function () { settle(function () { reject(new Error('ht-lazy: failed to load css ' + url)); }); };
      const fallback = setTimeout(function () { settle(resolve); }, 200);

      // Clean up the fallback timer if load fires first.
      const clearFallback = function () { clearTimeout(fallback); };
      l.addEventListener && l.addEventListener('load',  clearFallback, { once: true });
      l.addEventListener && l.addEventListener('error', clearFallback, { once: true });

      (document.head || document.documentElement).appendChild(l);
    });

    cssInFlight.set(url, pending);
    return pending;
  }

  HT.lazyLoad = lazyLoad;
  HT.lazyLoadCss = lazyLoadCss;
})();
