/* ============================================
   Handy Tools — ht-lazy.js (Story 4, Phase 1)
   Tier 2 chrome lazy loader. Phase 1 ships
   `HT.lazyLoad(url)` only; Phase 2 adds the
   Proxy factory + cssFor registry.

   Loaded once on every chrome page, immediately
   after utils.js. Sits in Tier 1 of the slim
   shell decomposition (~400 bytes gz).

   Public API:
     HT.lazyLoad(url) → Promise<void>
       Lazy-loads `url` exactly once via a
       deduplicating <script> insertion. Resolves
       after the script's `load` event fires.
       Rejects on `error`. Already-loaded urls
       resolve immediately; concurrent callers
       share one Promise.

   ES2018. AD-14 frozen public API.

   Story 4 — see _bmad-output/planning-artifacts/
   plans/story-4-embed-slim-build.md
   ============================================ */

(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  const HT = (window.HT = window.HT || {});

  // ------------------------------------------------------------------
  // State — module-level so all callers share.
  // ------------------------------------------------------------------
  const inFlight = new Map(); // url -> Promise<void>
  const loaded   = new Set(); // urls already resolved

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

  HT.lazyLoad = lazyLoad;
})();
