/* ============================================
   Handy Tools — ht-lazy.js (Story 4 + Story 4b Phase 2)
   Tier 2 chrome lazy loader. Phase 1 shipped
   `HT.lazyLoad(url)`. Phase 5 adds the CSS
   injection primitive `HT.lazyLoadCss(url)` so
   shell-thin.js's Proxy stubs can lazy-load both
   the JS module and its CSS chunk together,
   keeping chrome CSS out of first-paint.

   Story 4b Phase 2 adds `HT.lazyLoadTool(slug, url)`
   — sugar on top of `HT.lazyLoad` that gives each
   tool's <slug>-core.js a single "load handlers on
   first user interaction" primitive. Per-tool
   <slug>-handlers.js loads via `HT.lazyLoad`, but
   the slug-keyed dedup lets multiple tools share
   the same loader without cross-talk.

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

     HT.lazyLoadTool(slug, url) → Promise<void>  (Story 4b)
       Sugar for per-tool <slug>-core.js scripts.
       Loads `url` (the tool's <slug>-handlers.js)
       exactly once, keyed by `slug` so multiple
       tools on the same page (rare — embed mode)
       don't cross-talk. Returns the underlying
       `HT.lazyLoad(url)` Promise. Second call
       with the same slug resolves immediately
       even if the script is still in flight (the
       Promise dedup handles that case).

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

  // ------------------------------------------------------------------
  // Extended-ready primitive (date-picker-v2 race fix).
  //
  // Some chrome modules (date-picker-v2 today, possibly more
  // tomorrow) split their initialization across multiple script
  // tags: the entry file parses and returns a Promise that
  // resolves once downstream sub-modules finish loading and
  // the real API is installed on HT.<namespace>. The
  // shell-thin Proxy stub fires `lazyLoad(url)` first, then
  // reads `HT[namespace]` and dispatches — but between those
  // two steps the sub-modules may still be in flight, leaving
  // the namespace as the Proxy itself. The next property
  // access on the Proxy would re-enter the stub, producing
  // unbounded promise chains and an apparent "infinite loop /
  // memory issue" on the page.
  //
  // `lazyLoadReady(namespace, readyPromise)` lets the module
  // tell the loader "this namespace is fully installed only
  // once this Promise resolves." The shell-thin stub then
  // `Promise.all`s the script-load + ready promises before
  // dispatching, so dispatch never sees a half-installed
  // namespace. Pass an already-resolved Promise to no-op.
  //
  // Idempotent — registering twice for the same namespace
  // replaces the prior registration. A property access whose
  // namespace has no registered ready Promise proceeds after
  // the script-load promise resolves (the legacy behavior).
  // ------------------------------------------------------------------
  const readyPromises = new Map(); // namespace -> Promise
  function lazyLoadReady(namespace, readyPromise) {
    if (typeof namespace !== 'string' || namespace.length === 0) {
      return Promise.reject(new Error('ht-lazy: lazyLoadReady namespace must be a non-empty string'));
    }
    if (!readyPromise || typeof readyPromise.then !== 'function') {
      return Promise.reject(new Error('ht-lazy: lazyLoadReady readyPromise must be a thenable'));
    }
    readyPromises.set(namespace, Promise.resolve(readyPromise));
    return Promise.resolve();
  }
  function getReadyPromise(namespace) {
    return readyPromises.get(namespace) || null;
  }
  HT.lazyLoadReady    = lazyLoadReady;
  HT._getReadyPromise = getReadyPromise; // shell-thin.js reads this

  // ------------------------------------------------------------------
  // Per-tool handler lazy-load (Story 4b Phase 2).
  //
  // Tools that ship a <slug>-core.js (parse-time data + boot wiring)
  // and a <slug>-handlers.js (lazy chunk loaded on first user input)
  // call `HT.lazyLoadTool(slug, './<slug>-handlers.js')` from inside
  // their IIFE. This wraps `HT.lazyLoad` with a slug-keyed flag so
  // tools on the same page (embed mode embeds of multiple tools) can't
  // cross-trigger each other's handlers. The Promise dedup in
  // `lazyLoad` handles concurrent calls to the same URL; the
  // slug-keyed flag is for the rare case where two tools reference
  // the same handler URL (we never want tool A's first interaction to
  // resolve tool B's pending Promise).
  //
  // Returns the lazyLoad Promise so callers can `.then(init)` for
  // post-load wiring. If the URL is empty, rejects with a clear error.
  // ------------------------------------------------------------------
  const toolHandlersLoaded = new Set();
  function lazyLoadTool(slug, url) {
    if (typeof slug !== 'string' || slug.length === 0) {
      return Promise.reject(new Error('ht-lazy: lazyLoadTool slug must be a non-empty string'));
    }
    if (typeof url !== 'string' || url.length === 0) {
      return Promise.reject(new Error('ht-lazy: lazyLoadTool url must be a non-empty string'));
    }
    if (toolHandlersLoaded.has(slug)) return Promise.resolve();
    const p = lazyLoad(url);
    // Mark the slug as loaded before the Promise resolves so
    // synchronous re-entry from a handler's setup fn doesn't re-fire.
    toolHandlersLoaded.add(slug);
    return p;
  }
  HT.lazyLoadTool = lazyLoadTool;
})();
