/* date-picker-v2 / date-picker.js — public entry point.
 *
 * Loaded on demand by shell-thin.js's HT.datePickerV2 Proxy
 * (first call to HT.datePickerV2.enhance etc.). At module-init
 * time we:
 *
 *   1. Resolve the repo-root base from our own script URL so
 *      sub-module paths (utils.js / css.js / dialog.js / core.js)
 *      work whether we're loaded from /tools/<slug>/index.html or
 *      /index.html.
 *   2. IMMEDIATELY replace the shell-thin Proxy stub on
 *      HT.datePickerV2 with a plain `{}` (see the Proxy-replace
 *      fix block below). The sub-modules can then populate the
 *      namespace via direct assignment.
 *   3. Kick off the sub-module load chain (utils → css → dialog →
 *      core). Each sub-module installs its surface onto the
 *      plain object.
 *   4. After all four sub-modules finish, build the frozen
 *      public API from the populated namespace and install it
 *      via Object.defineProperty (mirrors date-picker.js:2294-
 *      2313 / quiz.js:1300-1322).
 *
 * The shell-thin Proxy factory reads `TIER2_URLS.datePickerV2`
 * to find us, calls `HT.lazyLoad(url)`, awaits Promise.all of
 * (lazy-load + lazyLoadCss + lazyLoadReady Promise), and then
 * reads `HT.datePickerV2[prop]` to dispatch. Once we define the
 * real API, that read returns our method instead of the Proxy's
 * lazy wrapper.
 */

'use strict';

(function (root) {
  if (typeof window === 'undefined') return;
  var HT = root.HT = root.HT || {};

  // ----- resolve repo-root base from script URL -----
  //
  // The script URL is assets/js/date-picker-v2/date-picker.js
  // (relative to the repo root). We strip everything from the
  // `assets` segment onward so sub-module paths can be written
  // relative to `assets/js/date-picker-v2/`. The same approach
  // is used by assets/js/date-picker.js and assets/js/quiz.js.
  var BASE = '';
  try {
    var cs = document.currentScript;
    if (cs && cs.src) {
      var u = new URL(cs.src);
      var parts = u.pathname.split('/').filter(function (p) { return p.length > 0; });
      var idx = parts.lastIndexOf('assets');
      if (idx > 0) {
        BASE = u.origin + '/' + parts.slice(0, idx).join('/') + '/';
      } else {
        BASE = u.origin + '/';
      }
    }
  } catch (_) {
    BASE = '/';
  }

  // Version stamp appended to sub-module URLs as a query string.
  // Bump this whenever css.js / dialog.js / core.js / utils.js
  // change in a way that affects runtime behavior — the query
  // string changes the cache key in browsers and CDNs, so the
  // user gets fresh code instead of stale cached bytes. The
  // base URL itself is unchanged (the file path), so server-
  // side routing still works.
  //
  // Version history:
  //   v3 — Phase 2.5 visual redesign (cobalt gradient, today
  //        ring, larger cells); users who'd cached the
  //        previous css.js got refreshed automatically without
  //        a manual hard-reload.
  //   v4 — Phase 2 Proxy-replace fix (this commit). The entry
  //        script now replaces the shell-thin Proxy stub with a
  //        plain object BEFORE the sub-modules load, so each
  //        sub-module's `NS.datePickerV2.<key> = {...}` actually
  //        lands on the namespace instead of being intercepted
  //        by the Proxy's `get` trap (which returned fresh
  //        dispatch functions for every read, making the install
  //        `.then` see undefined when it tried to read
  //        `HT.datePickerV2.core.enhance`). WITHOUT this v4
  //        bump, users running browsers / CDNs that have cached
  //        v3 of the entry script keep hitting the bug.
  //   v5 — Phase 2 native-picker suppression. core.js now
  //        swaps the input's `type` from "date|time|datetime-
  //        local" to "text" on enhance() and restores it on
  //        destroy(). `mousedown preventDefault` was unreliable
  //        across browsers (the native picker binds to `click`,
  //        which fires after mousedown, and some browsers open
  //        the native picker before the click event reaches the
  //        page). Without the swap, the OS-native picker races
  //        the v2 dialog and "looks like the default one" even
  //        though ours is also rendering.
  var V = 5;
  var SUBMODULE_BASE = BASE + 'assets/js/date-picker-v2/';

  // =============================================================
  // Proxy-replacement fix (Phase 2 bug).
  //
  // shell-thin.js installs `HT.datePickerV2 = makeProxy(...)`
  // BEFORE this entry script loads. The Proxy's `get` trap returns
  // a fresh dispatch function for every property access — so
  // every read of `HT.datePickerV2` returns a different function
  // and any assignment to `HT.datePickerV2.<prop>` (which is what
  // the sub-modules do with `NS.datePickerV2.utils = {...}` etc.)
  // lands on the dispatch function object, not on the namespace.
  //
  // Symptom: at the end of the sub-module chain, the install
  // `.then()` reads `HT.datePickerV2.core.enhance` and gets
  // undefined (because the function returned by the Proxy's get
  // trap has no `.core`). The frozen API is then installed with
  // every function field set to undefined, and any caller (e.g.
  // the lab page's "Open programmatically" button) that reads
  // `HT.datePickerV2.openById` synchronously throws TypeError.
  //
  // Fix: replace the Proxy stub on HT.datePickerV2 with a plain
  // object BEFORE kicking off the sub-module load. The sub-modules
  // then populate the plain object via direct assignment (which
  // works without Proxy interference). The shell-thin dispatch
  // awaits the `lazyLoadReady` Promise we install here — once the
  // sub-module chain finishes and the public API replaces this
  // plain object via defineProperty, dispatch resumes against
  // the real API.
  //
  // Why this is safe to do early: the Proxy's job is to lazy-load
  // the entry script itself, which is already in flight by the
  // time we get here. After this replacement, the only callers
  // that can observe the missing `enhance`/`openById`/etc. are
  // code paths that bypass the Proxy — and those callers (the lab
  // page's click handlers) now get a plain object whose properties
  // are populated by the sub-modules as they load. The lab page's
  // defensive typeof check turns any unexpected empty window
  // into a logged error instead of a TypeError.
  // =============================================================
  try {
    Object.defineProperty(HT, 'datePickerV2', {
      value: {},
      writable: true,
      configurable: true,
      enumerable: true,
    });
  } catch (_) {
    try { HT.datePickerV2 = {}; } catch (__) {}
  }

  // Tell ht-lazy that this namespace is only fully installed once
  // the sub-module Promise chain below resolves. Without this, the
  // shell-thin Proxy stub can read HT.datePickerV2 between the
  // entry script's onload and the sub-modules finishing — the
  // namespace is still a half-installed plain object, dispatch
  // re-enters the stub, and the page hangs in unbounded promise
  // chains.
  //
  // Guarded with a typeof check so date-picker-v2 still loads in
  // environments (tests, embed mode) that haven't loaded ht-lazy.
  // The slot is hoisted so the closure below can capture the
  // binding even though the assignment lands later.
  var loadSubmodulesResolve = null;
  if (typeof HT.lazyLoadReady === 'function') {
    HT.lazyLoadReady('datePickerV2', new Promise(function (resolve) {
      // Resolve once loadSubmodules() has installed the real API.
      loadSubmodulesResolve = resolve;
    }));
  }

  // ----- load helper -----
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = false; // preserve declaration order
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('date-picker-v2: failed to load ' + src)); };
      document.head.appendChild(s);
    });
  }

  // ----- sub-module loader -----
  //
  // utils → css → dialog → core. The smoke harness depends on
  // the four files loading in this order so that
  // HT.datePickerV2.utils, .css, .dialogs, .core are populated
  // before any public API call.
  var loadPromise = null;
  function loadSubmodules() {
    if (loadPromise) return loadPromise;
    loadPromise = loadScript(SUBMODULE_BASE + 'utils.js?v=' + V)
      .then(function () { return loadScript(SUBMODULE_BASE + 'css.js?v=' + V); })
      .then(function () { return loadScript(SUBMODULE_BASE + 'dialog.js?v=' + V); })
      .then(function () { return loadScript(SUBMODULE_BASE + 'core.js?v=' + V); })
      .then(function () {
        // After all four files have parsed, install the real
        // public API on HT.datePickerV2. The shell-thin Proxy
        // factory reads HT.datePickerV2 after Promise.all
        // resolves, so this assignment must happen before the
        // outer Promise (that wraps lazyLoad + Promise.all +
        // dispatch) re-reads the namespace.
        var api = Object.freeze({
          enhance: HT.datePickerV2.core.enhance,
          // Handle-form open/close/destroy/isOpen. Caller can pass
          // either a handle from enhance() or a string id.
          open: function (handle) {
            if (handle && handle.open) handle.open();
            else if (typeof handle === 'string') HT.datePickerV2.core.openById(handle);
          },
          close: function (handle) {
            if (handle && handle.close) handle.close();
            else if (typeof handle === 'string') HT.datePickerV2.core.closeById(handle);
          },
          destroy: function (handle) {
            if (handle && handle.destroy) handle.destroy();
            else if (typeof handle === 'string') HT.datePickerV2.core.destroyById(handle);
          },
          isOpen: function (handle) {
            if (handle && typeof handle.isOpen === 'function') return handle.isOpen();
            if (typeof handle === 'string') return HT.datePickerV2.core.isOpenById(handle);
            return false;
          },
          // by-id helpers — preserved from old date-picker.js so
          // the lab page's HT.datePickerV2.openById(id) etc.
          // continue to work after the load completes.
          openById: HT.datePickerV2.core.openById,
          closeById: HT.datePickerV2.core.closeById,
          destroyById: HT.datePickerV2.core.destroyById,
          isOpenById: HT.datePickerV2.core.isOpenById,
          // Internal helpers exposed for the smoke harness.
          _utils: HT.datePickerV2.utils,
          _core: HT.datePickerV2.core,
          _reset: function () { HT.datePickerV2.core._reset(); },
        });
        try {
          Object.defineProperty(HT, 'datePickerV2', {
            value: api,
            writable: false,
            configurable: false,
            enumerable: true,
          });
        } catch (_) {
          try { HT.datePickerV2 = api; } catch (__) {}
        }
        // Resolve the lazyLoadReady Promise registered above so
        // any in-flight shell-thin dispatch can proceed.
        if (typeof loadSubmodulesResolve === 'function') {
          try { loadSubmodulesResolve(api); } catch (_) {}
        }
        return api;
      });
    return loadPromise;
  }

  // Kick off the load eagerly. By the time the module is done
  // parsing, all four sub-modules are either loaded or in
  // flight; subsequent reads of HT.datePickerV2.core.* via the
  // shell-thin Proxy will see the real methods.
  loadSubmodules();
})(typeof window !== 'undefined' ? window : globalThis);