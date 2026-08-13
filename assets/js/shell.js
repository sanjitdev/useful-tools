/* ============================================
   Handy Tools — shell.js (boot orchestrator, AD-4 + AD-14)
   Mounts the Shell chrome, sets the theme API,
   and wires no-op handlers for chrome buttons that
   later stories will own (search → 1.7, settings → 1.8).
   ES2018 — see ARCHITECTURE-SPINE line 222.
   ============================================ */

(function () {
  'use strict';

  // The soft handoff flag (Subtask 4.4) is set as the very first
  // statement so the legacy theme.js IIFE short-circuits when both
  // scripts are present. Setting it here, before any DOMContentLoaded
  // handler runs, keeps the order deterministic regardless of script
  // load order.
  window.__htShellReplacesTheme = true;

  const HT = (window.HT = window.HT || {});

  /* ============================================
     Story 1.14 — HT.provide / HT.use / HT.net
     ============================================
     AD-14 mandates that a Tool exposing an API to other Tools registers
     it via HT.provide(slug, api); a consumer reads it via HT.use(slug).
     The registry enforces uniqueness + frozen shape. The Tool that
     provided it does NOT call HT.provide on itself — the Tool provides
     the API ONCE at boot, after HT.boot().

     HT.net is the only network API Tools may use. It wraps fetch with a
     single-flight abort handle per slug plus a polite offline fallback.
     Tools must NOT call fetch() / XMLHttpRequest directly — the bypass
     gate (scripts/shell-bounds-check.py) flags that as a violation.

     Stability: stable (HT.provide, HT.use, HT.net.get, HT.net.head,
     HT.net.abort). The internal registries exposed for tooling land
     on HT.provideRegistry / HT.useRegistry / HT.netRegistry — Tools
     calling those is undefined behavior. */

  const _providedApis = Object.create(null);
  const _netInflight = Object.create(null);

  function _validSlug(slug) {
    // AD-2 / AD-14: slugs are kebab-case, [a-z][a-z0-9-]*[a-z0-9].
    // A tool may not register an unknown slug — the gate cross-checks
    // tools.json. The check is intentionally strict so misspelled
    // registrations fail loudly at boot, not at consumer call sites.
    if (typeof slug !== 'string') return false;
    if (slug.length < 2 || slug.length > 64) return false;
    return /^[a-z][a-z0-9-]*[a-z0-9]$/.test(slug);
  }

  function provide(slug, api) {
    if (!_validSlug(slug)) {
      throw new TypeError(
        'HT.provide: slug must be kebab-case ' +
        '(^[a-z][a-z0-9-]*[a-z0-9]$, 2-64 chars); got ' + JSON.stringify(slug)
      );
    }
    if (api === null || typeof api !== 'object') {
      throw new TypeError(
        'HT.provide: api must be a non-null object; got ' + typeof api
      );
    }
    if (Object.prototype.hasOwnProperty.call(_providedApis, slug)) {
      throw new Error(
        'HT.provide: slug ' + JSON.stringify(slug) + ' already registered'
      );
    }
    _providedApis[slug] = Object.freeze(api);
  }

  function use(slug) {
    if (!_validSlug(slug)) return null;
    return Object.prototype.hasOwnProperty.call(_providedApis, slug)
      ? _providedApis[slug]
      : null;
  }

  // HT.net — the only network API Tools may use. Tools must NOT call
  // fetch() or XMLHttpRequest directly (the bypass gate enforces this).
  // The single-flight pattern lets a Tool cancel an in-flight request
  // when a follow-up supersedes it (e.g. autocomplete suggestions).
  function netGet(url, options) {
    const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const requestUrl = String(url);
    const inflightKey = 'GET ' + requestUrl;
    if (_netInflight[inflightKey] && _netInflight[inflightKey].abort) {
      try { _netInflight[inflightKey].abort(); } catch (_) { /* ignore */ }
    }
    if (ctrl) _netInflight[inflightKey] = ctrl;
    const opts = Object.assign({ method: 'GET', credentials: 'omit' }, options || {});
    if (ctrl) opts.signal = ctrl.signal;
    return fetch(requestUrl, opts).then(function (res) {
      if (_netInflight[inflightKey] === ctrl) delete _netInflight[inflightKey];
      return res;
    }).catch(function (err) {
      if (_netInflight[inflightKey] === ctrl) delete _netInflight[inflightKey];
      throw err;
    });
  }

  function netHead(url, options) {
    return netGet(url, Object.assign({ method: 'HEAD' }, options || {}));
  }

  function netAbort(key) {
    // Cancel by inflight key (e.g. 'GET <url>') or by URL string. No-op
    // if nothing matches; this is the polite "I no longer care" path.
    const inflightKey = (typeof key === 'string' && key.indexOf(' ') > 0)
      ? key
      : 'GET ' + String(key);
    const entry = _netInflight[inflightKey];
    if (entry && typeof entry.abort === 'function') {
      try { entry.abort(); } catch (_) { /* ignore */ }
    }
    delete _netInflight[inflightKey];
  }

  // Story 9.2 — `HT.net.json(url, options)` — convenience that wraps
  // `HT.net.get(url)` and parses the response body as JSON. Tools that
  // need a JSON response (e.g. citation-formatter hitting Open Library)
  // should use this rather than calling fetch() directly. The
  // non-2xx -> reject contract matches HT.fetch: HTTP 4xx/5xx throw.
  function netJson(url, options) {
    return netGet(url, options).then(function (res) {
      if (!res.ok) {
        throw new Error('HTTP ' + res.status + ' for ' + url);
      }
      return res.json();
    });
  }

  // AD-14 requires the public surface to be frozen. The functions
  // themselves are frozen via Object.freeze(...) (a no-op on
  // function objects but documents intent and prevents the body
  // from being mutated). The HT.* property assignments that
  // follow are made via a single Object.defineProperties call so
  // the property descriptors are {configurable: false, writable:
  // false} — overwrite attempts via `HT.provide = ...` throw in
  // strict mode.
  Object.freeze(provide);
  Object.freeze(use);

  // Public surface (frozen, AD-14). Per Story 1.14 AC#3, the
  // signature is `HT.provide(slug, api)` directly — NOT a namespace
  // (`HT.provide.register(...)`). The spec at epics.md:464-492 reads
  // "`HT.provide(key, fn)` is the only way a Tool may register an
  // API" — `key` is the registry slug and `fn` is the API object the
  // Tool is providing (named "api" here for parity with AD-14's
  // "a Tool that wants to expose an API to other Tools registers it
  // via `HT.provide(slug, api)`"). The frozen binding is the
  // contract surface; the underlying `provide` function is internal.
  //
  // defineProperties (not direct assignment) so the property
  // descriptors are configurable: false, writable: false. A
  // `HT.provide = ...` overwrite attempt throws in strict mode
  // (the shell.js IIFE is strict-mode via `'use strict'` on line 11).
  Object.defineProperties(HT, {
    provide: { value: provide, writable: false, configurable: false, enumerable: true },
    use: { value: use, writable: false, configurable: false, enumerable: true },
    net: { value: Object.freeze({
      version: '1.0.0',
      get: netGet,
      head: netHead,
      abort: netAbort,
      json: netJson,
    }), writable: false, configurable: false, enumerable: true },
    provideRegistry: { value: Object.freeze({ list: function () {
      return Object.keys(_providedApis).sort();
    }}), writable: false, configurable: false, enumerable: true },
    netRegistry: { value: Object.freeze({ inflight: function () {
      return Object.keys(_netInflight).slice().sort();
    }}), writable: false, configurable: false, enumerable: true },
  });

  // Cycle order (UX-DR-50) — auto → light → dark → auto. `ht.theme` is
  // a plain string in localStorage (not JSON-encoded) so the FOUC IIFE
  // (which runs before <script src="assets/js/utils.js"> parses and has
  // no JSON parser) can read it via localStorage.getItem('ht.theme').
  const CYCLE_NEXT = Object.freeze({
    auto: 'light',
    light: 'dark',
    dark: 'auto',
  });

  // The toggle's accessible label reads the *next* mode name (not the
  // next color), so screen-reader users hear "Switch to dark theme"
  // when the current mode is light. When the current mode is auto, the
  // label reads "Follow system theme" — the cycle resumes from auto.
  const CYCLE_LABEL = Object.freeze({
    auto: 'Follow system theme',
    light: 'Switch to dark theme',
    dark: 'Switch to light theme',
  });

  function readStoredMode() {
    // Plain string read — never JSON-parse. The FOUC IIFE writes the
    // same plain string; both paths must agree on encoding.
    try {
      const raw = localStorage.getItem('ht.theme');
      if (raw === 'auto' || raw === 'light' || raw === 'dark') return raw;
      // Legacy migration: pre-1.6 versions wrote via HT.storage.set
      // which JSON-encodes, leaving values like `"\"light\""` in
      // localStorage. Decode and persist back as a plain string so the
      // user keeps their explicit preference across the upgrade.
      if (raw && raw.length > 0 && raw[0] === '"') {
        try {
          const decoded = JSON.parse(raw);
          if (decoded === 'auto' || decoded === 'light' || decoded === 'dark') {
            try { localStorage.setItem('ht.theme', decoded); } catch (_) {}
            return decoded;
          }
        } catch (_) {
          // Not valid JSON; fall through to the default.
        }
      }
    } catch (_) {
      // localStorage may be unavailable (private mode); fall through.
    }
    return 'auto';
  }

  function writeStoredMode(next) {
    // Plain string write — bypass HT.storage (which JSON-encodes) so the
    // FOUC IIFE's localStorage.getItem('ht.theme') reads the same shape.
    try {
      localStorage.setItem('ht.theme', next);
    } catch (_) {
      // localStorage may be unavailable (private mode); apply in-memory
      // only — the page still renders correctly this session.
    }
  }

  function isEmbedMode() {
    try {
      return new URLSearchParams(window.location.search).get('embed') === '1';
    } catch (_) {
      return false;
    }
  }

  function resolvedTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    return current === 'dark' ? 'dark' : 'light';
  }

  function boot() {
    if (HT.__booted) return;
    HT.__booted = true;

    const main = document.getElementById('main');
    const explicit = main && main.getAttribute('data-page-label');
    if (main && explicit && !main.getAttribute('aria-label')) {
      main.setAttribute('aria-label', explicit);
    }

    // ?embed=1 locks the theme to system-following: the toggle is hidden
    // via CSS, the cycle is a no-op, and `data-theme` follows the OS via
    // the media-query listener below (Story 1.6 spec; AD-7 line 115).
    if (isEmbedMode()) {
      // AD-7: signal the rest of the page (CSS hiding the help overlay +
      // palette/settings triggers; the keyboard chord guards in
      // help-overlay.js / palette-actions.js) that this is an embed.
      // The CSS rules use :root[data-embed="1"] as a parallel hard
      // signal — the JS path is the primary guard, but the CSS hides
      // before JS boots (FOUC defense).
      document.documentElement.setAttribute('data-embed', '1');
      writeStoredMode('auto');
      // The FOUC IIFE may have resolved a stale 'light' / 'dark' value
      // from a prior session before we overwrote it to 'auto' above.
      // Re-apply the OS preference synchronously so the embed page
      // never paints with the wrong theme. The MutationObserver
      // re-syncs aria-pressed automatically.
      const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
      document.documentElement.setAttribute('data-theme', mq && mq.matches ? 'dark' : 'light');
    }

    HT.shell = Object.freeze({
      version: '1.0.0',
      loadedAt: performance.now(),
      theme: () => document.documentElement.getAttribute('data-theme'),
    });

    // Story 3.2 + 3.2-review: HT.theme.cycle — public wrapper over the
    // private `toggleTheme()` function above. AD-14 surface that the
    // static `theme.toggle` action in palette-actions.js delegates to.
    // The toggle button click path still works; this is the keyboard-
    // driven equivalent (palette Enter dispatch). Use
    // Object.defineProperties (writable: false, configurable: false) so
    // a `HT.theme = {...}` overwrite attempt throws in strict mode,
    // matching the provide/use/net pattern at lines 145-160.
    Object.defineProperties(HT, {
      theme: {
        value: Object.freeze({
          cycle: () => { try { toggleTheme(); } catch (e) { console.warn('theme.cycle threw', e); } },
        }),
        writable: false,
        configurable: false,
        enumerable: true,
      },
    });

    // Story 3.2 + 3.2-review: HT.viewSource.open(slug?) — public wrapper
    // over the private `resolveCurrentSlug()` + the existing view-source
    // URL resolution. Returns a Promise that resolves when navigation
    // starts (window.location.assign is fire-and-forget). When no slug
    // is passed and the page is the home page (or any non-tool URL),
    // the promise resolves to false (no-op) so callers can branch
    // without throwing. Defensive: rejects slugs containing `..` to
    // prevent path traversal (e.g. viewSource.open('../etc/passwd')
    // must not navigate outside `tools/`).
    Object.defineProperties(HT, {
      viewSource: {
        value: Object.freeze({
          open: (slug) => {
            return new Promise((resolve) => {
              try {
                const raw = (typeof slug === 'string' && slug.length > 0)
                  ? slug
                  : resolveCurrentSlug();
                // Reject empty, dot-prefixed (..), slash-bearing, or
                // any slug that doesn't match a strict slug-shape
                // ([a-z0-9-]+). Prevents path traversal.
                const target = (typeof raw === 'string' && /^[a-z0-9-]+$/.test(raw))
                  ? raw
                  : null;
                if (!target) {
                  console.warn('viewSource.open: no usable slug on this page (got ' + JSON.stringify(raw) + ')');
                  resolve(false);
                  return;
                }
                if (!HT.siteConfig || !HT.siteConfig.blobBase) {
                  console.warn('viewSource.open: HT.siteConfig.blobBase missing');
                  resolve(false);
                  return;
                }
                const blobBase = String(HT.siteConfig.blobBase).replace(/\/+$/, '');
                const href = blobBase + '/tools/' + target + '/index.html';
                try {
                  window.location.assign(href);
                } catch (e) {
                  console.warn('viewSource.open: location.assign threw', e);
                  resolve(false);
                  return;
                }
                resolve(true);
              } catch (e) {
                console.warn('viewSource.open: unexpected throw', e);
                resolve(false);
              }
            });
          },
        }),
        writable: false,
        configurable: false,
        enumerable: true,
      },
    });

    document.addEventListener('click', onClick);
    document.documentElement.addEventListener('ht:fouc-resolved', onFoucResolved);
    observeTheme();
    registerSystemThemeListener();
    syncThemeToggleAria();
    refreshFooterYear();

    // Register per-tool history keys BEFORE the panel mounts. The
    // panel mounts synchronously below (HT.history.panel → list → _readRaw
    // → HT.storage.get('handy-tools.history.<slug>', [])), and the
    // registry throws a `HT.storage.get: unregistered key ...` warning
    // whenever a get lands on a key that hasn't been registered yet.
    // On tool pages, home-grid.js never loads so HT.homeGrid.entries
    // stays null; the inline tools.json block (spliced by
    // shell-template.py) is the only source of truth. Registering
    // synchronously here is the cheapest fix — the deferred
    // registerToolHistoryKeys() call below still runs as a safety net
    // for the home page where HT.homeGrid.entries may publish later.
    registerToolHistoryKeys();

    // Story 2.2 / AD-4: mount the Sample / Reset buttons onto every tool
    // page. Sample is global, Tools opt in via the urlState.sample block
    // in tools.json. The mount helper renders both buttons into a
    // .tool-actions flex row. Skipped in embed mode and on any page
    // without data-slug. The Shell boot() calls this for tool pages
    // after the URL hash has been bound by the Story 2.1 codec (when
    // that lands); for the Story 2.2 standalone commit, the sample/
    // reset affordance still works because HT.sampleData.mount reads
    // the schema via the inline splice / HT.homeGrid fallback rather
    // than the codec.
    if (!isEmbedMode() && main && HT.sampleData
        && typeof HT.sampleData.mount === 'function') {
      const toolSlug = main.getAttribute && main.getAttribute('data-slug');
      if (toolSlug && /^[a-z][a-z0-9-]*[a-z0-9]$/.test(toolSlug)) {
        try { HT.sampleData.mount(toolSlug, main); }
        catch (err) { console.warn('shell.boot: HT.sampleData.mount failed', err); }
      }
    }

    // Story 2.3: mount the per-tool history panel. The Shell wires this
    // (NOT each tool) so the panel layout, mobile-vs-desktop split, and
    // cross-tab sync are consistent across every tool. Skipped in embed
    // mode (AD-7) and when the slug declares no history-keys block —
    // the panel helper itself is defensive and returns an empty
    // teardown for misconfigured slugs, but we also early-out here to
    // skip the work entirely on home / Settings / other non-tool pages
    // where data-slug is absent.
    if (!isEmbedMode() && main && HT.history
        && typeof HT.history.panel === 'function') {
      const historySlug = main.getAttribute && main.getAttribute('data-slug');
      if (historySlug && /^[a-z][a-z0-9-]*[a-z0-9]$/.test(historySlug)) {
        try {
          if (HT.history.hasHistory && HT.history.hasHistory(historySlug)) {
            HT.history.panel(historySlug, main);
          }
        }
        catch (err) { console.warn('shell.boot: HT.history.panel failed', err); }
      }
    }

    // Story 2.5: mount the per-tool share dialog affordance. The Shell
    // wires this (NOT each tool) so the dialog, print button, and
    // embed snippet are consistent across every tool. Skipped in
    // embed mode (AD-7) and when the slug declares no urlState block
    // (the share URL is meaningful only when there's state to share).
    if (!isEmbedMode() && main && HT.share
        && typeof HT.share.mount === 'function') {
      const shareSlug = main.getAttribute && main.getAttribute('data-slug');
      if (shareSlug && /^[a-z][a-z0-9-]*[a-z0-9]$/.test(shareSlug)) {
        try {
          if (HT.share.hasShare && HT.share.hasShare(shareSlug)) {
            HT.share.mount(shareSlug, main);
          }
        }
        catch (err) { console.warn('shell.boot: HT.share.mount failed', err); }
      }
    }

    // Story 1.7: install the command palette wiring (skip entirely in
    // embed mode per AD-7 — the trigger is hidden and the chord is a no-op).
    if (!isEmbedMode()) {
      wirePalette();
      wireSettings();
      // Story 1.12: upgrade the static "View source" placeholder into a
      // real link to the GitHub blob URL. Retries until HT.homeGrid
      // publishes (or the registry's manifest covers the slug) so the
      // link appears as soon as the data is available.
      wireViewSourceLink();
    }

    // Story 1.10: retry registration in case HT.homeGrid.entries
    // publishes after boot() (it does on the home page where
    // home-grid.js fetches tools.json async). On tool pages the
    // synchronous call earlier in boot() has already registered the
    // keys from the inline JSON splice; this retry is a no-op
    // (registry refuses duplicate registrations) but keeps the home
    // page path — which prefers HT.homeGrid.entries for fidelity.
    //
    // Review fix: the previous implementation deferred the FIRST
    // registration too, which meant the panel's initial _renderRows()
    // synchronously called HT.storage.get('handy-tools.history.<slug>')
    // before the keys existed, firing the
    // `HT.storage.get: unregistered key` warning. Now we register
    // synchronously above (lines ~365-380), then queue this retry for
    // the home-page-only HT.homeGrid.upgrade path.
    setTimeout(registerToolHistoryKeys, 0);

    // Story 3.7 — best-effort register the forward-compat keys
    // `handy-tools.recent`, `handy-tools.favorites`, `handy-tools.pins`
    // so the export module's `HT.storage.list()` enumeration can see
    // them. These keys are 2-segment (no slug segment) and may be
    // rejected by `isValidNamespace`; the try/catch ensures the
    // bootstrap never breaks on a registration conflict — export.js
    // falls back to direct `HT.storage.get(key, fallback)` reads.
    if (HT.storage && typeof HT.storage.register === 'function') {
      try { HT.storage.register('handy-tools.recent', { purpose: 'recently-used-tools', lifetime: 'persistent', schema: 'string-array', owner: 'assets/js/home-grid.js (Story 3.12)' }); } catch (_) {}
      try { HT.storage.register('handy-tools.favorites', { purpose: 'favorited-tools', lifetime: 'persistent', schema: 'string-array', owner: 'assets/js/home-grid.js (Story 3.12)' }); } catch (_) {}
      try { HT.storage.register('handy-tools.pins', { purpose: 'pinned-tools', lifetime: 'persistent', schema: '{slug: iso-timestamp}', owner: 'assets/js/home-grid.js (Story 3.12)' }); } catch (_) {}
    }

    // Story 3.12: record this page visit in the recent-tools list. We read
    // the slug from <main data-slug="..."> (set by the chrome regenerator on
    // every tool page). The write happens once per page load via the
    // _toolVisited flag so a re-entrant boot doesn't reorder the list. The
    // call is deferred to the next macrotask so any chrome-include scripts
    // that publish HT.recent during their own boot can land first.
    setTimeout(markToolVisited, 0);
  }

  // Retry budget: ~2 seconds, exponential backoff capped at 200 ms.
  // History keys must land before any tool page reads them, so we
  // accept up to ~2 seconds of deferred registration before falling
  // back to a no-op.
  let _historyKeyRetries = 0;
  const _HISTORY_KEY_RETRY_BUDGET = 2000;
  const _HISTORY_KEY_RETRY_BASE_MS = 50;

  // Story 3.12: record this page visit in the recent-tools list. The slug
  // comes from <main data-slug="..."> (set by the chrome regenerator). A
  // missing or empty slug is a no-op (defense in depth — the home page,
  // pack pages, /privacy, /quality, etc. do not carry data-slug). The
  // _toolVisited flag ensures the write happens exactly once per boot.
  let _toolVisited = false;
  function markToolVisited() {
    if (_toolVisited) return;
    if (isEmbedMode()) { _toolVisited = true; return; }
    const main = document.getElementById('main');
    if (!main || !main.dataset || typeof main.dataset.slug !== 'string') {
      _toolVisited = true;
      return;
    }
    const slug = main.dataset.slug.trim();
    if (!slug) { _toolVisited = true; return; }
    if (HT.recent && typeof HT.recent.push === 'function') {
      try { HT.recent.push(slug); } catch (_) { /* storage unavailable */ }
    }
    _toolVisited = true;
  }

  function registerToolHistoryKeys() {
    // Use the registry directly: utils.js's HT.storage dispatch layer
    // intentionally omits `registerHistoryKeys` (it's a boot-time-only
    // surface; we don't want tool code calling it post-boot). The
    // registry is the source of truth.
    const reg = HT.storageRegistry;
    if (!reg || typeof reg.registerHistoryKeys !== 'function') return;
    const call = (tools) => {
      try {
        reg.registerHistoryKeys(tools);
      } catch (err) {
        console.warn('shell.historyKeys: registration failed', err);
      }
    };
    const homeGrid = HT.homeGrid;
    if (homeGrid && Array.isArray(homeGrid.entries)) {
      call(homeGrid.entries);
      return;
    }
    // Fallback for tool pages: home-grid.js doesn't load on tool pages,
    // so HT.homeGrid.entries stays null. Parse the inline tools.json
    // block (spliced by shell-template.py) to recover the entries and
    // register their history-keys. Without this, HT.storage.get(historyKey)
    // returns the fallback (empty array) and the panel never populates.
    const inline = document.getElementById('ht-tools-json-inline');
    if (inline) {
      try {
        const parsed = JSON.parse(inline.textContent || '');
        if (parsed && Array.isArray(parsed.tools)) {
          call(parsed.tools);
          return;
        }
      } catch (_) { /* malformed inline JSON — fall through to retry */ }
    }
    // No entries yet — retry with exponential backoff up to the budget.
    const elapsed = _historyKeyRetries * _HISTORY_KEY_RETRY_BASE_MS;
    if (elapsed >= _HISTORY_KEY_RETRY_BUDGET) {
      // Gave up. The gate's history-keys cross-check still passes
      // because registerHistoryKeys is exported and ready to be called;
      // what this means is that the per-tool keys won't be on this boot.
      // We log a single warn so dev can see whether the home-grid
      // renderer is taking too long (it's usually <100 ms).
      console.warn(
        'shell.historyKeys: HT.homeGrid.entries did not publish within ' +
        _HISTORY_KEY_RETRY_BUDGET + 'ms — per-tool history keys not ' +
        'registered this boot'
      );
      return;
    }
    const wait = Math.min(
      _HISTORY_KEY_RETRY_BASE_MS * Math.pow(2, _historyKeyRetries),
      200
    );
    _historyKeyRetries += 1;
    setTimeout(registerToolHistoryKeys, wait);
  }

  function onClick(event) {
    const target = event.target.closest(
      '.theme-toggle, .shell-search-trigger, .shell-settings, .shell-locale, [data-open-palette]'
    );
    if (!target) return;

    if (target.classList.contains('theme-toggle')) {
      toggleTheme();
      return;
    }

    if (target.classList.contains('shell-locale') && target.disabled) {
      event.preventDefault();
      return;
    }

    if (target.classList.contains('shell-search-trigger') || target.hasAttribute('data-open-palette')) {
      // Story 1.7: open the command palette. In embed mode the trigger is
      // hidden via CSS but a focused programmatic click could still fire —
      // the chord/keyboard paths early-return on isEmbedMode() so we never
      // surface the overlay in embed.
      if (target.tagName === 'A') event.preventDefault();
      openPalette();
      return;
    }

    if (target.classList.contains('shell-settings')) {
      openSettings();
      return;
    }

    if (target.classList.contains('shell-locale')) {
      console.info('shell.locale: pending Story 7.7');
    }
  }

  function toggleTheme() {
    // ?embed=1 hides the toggle via CSS, but a focused programmatic click
    // could still hit the handler — the cycle is a no-op so we never
    // diverge from system-following in embed mode.
    if (isEmbedMode()) {
      writeStoredMode('auto');
      return;
    }

    const current = readStoredMode();
    const next = CYCLE_NEXT[current] || 'light';
    writeStoredMode(next);

    // For auto → light/dark and dark → auto we resolve the actual
    // data-theme value. dark → auto needs matchMedia to compute the
    // resolved theme.
    let resolved = next;
    if (next === 'auto') {
      const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
      resolved = mq && mq.matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', resolved);
    // The MutationObserver below re-syncs aria-label / title /
    // aria-pressed on every .theme-toggle via syncThemeToggleAria().
  }

  function syncThemeToggleAria() {
    // Reflects the *current cycle state* (auto/light/dark), not the
    // resolved data-theme. The accessible label announces the *next*
    // step of the cycle; aria-pressed reflects whether the effective
    // theme is dark.
    const current = readStoredMode();
    const label = CYCLE_LABEL[current] || CYCLE_LABEL.light;
    const pressed = resolvedTheme() === 'dark' ? 'true' : 'false';
    document.querySelectorAll('.theme-toggle').forEach((btn) => {
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
      btn.setAttribute('aria-pressed', pressed);
    });
  }

  function observeTheme() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          window.HT.__htLastThemeChangeAt = performance.now();
          // Re-sync every .theme-toggle's accessible state — covers both
          // the click path (toggleTheme) and the media-query path
          // (registerSystemThemeListener) with a single writer.
          syncThemeToggleAria();
        }
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }

  function registerSystemThemeListener() {
    if (!window.matchMedia) return; // unsupported (older browser): cycle
    // falls back to light ↔ dark and auto behaves as light.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event) => {
      // Only re-resolve data-theme when the user is in auto mode (or in
      // embed mode, which forces auto at boot). A user who stored
      // 'light' or 'dark' keeps their override; the OS change is ignored.
      if (!isEmbedMode() && readStoredMode() !== 'auto') return;
      document.documentElement.setAttribute('data-theme', event.matches ? 'dark' : 'light');
      // The MutationObserver will re-sync aria-pressed automatically.
    };
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
    } else if (typeof mq.addListener === 'function') {
      // Safari < 14 fallback.
      mq.addListener(onChange);
    }
  }

  function onFoucResolved(event) {
    const ms = event && event.detail && typeof event.detail.elapsedMs === 'number'
      ? event.detail.elapsedMs
      : null;
    if (ms === null) {
      console.warn('shell.fouc: ht:fouc-resolved fired without elapsedMs detail');
      return;
    }
    if (ms > 50) {
      console.warn(`shell.fouc: ${ms.toFixed(1)}ms exceeds 50ms budget`);
    }
  }

  function refreshFooterYear() {
    const el = document.getElementById('ht-footer-year');
    if (!el) return;
    el.textContent = String(new Date().getFullYear());
  }

  /* ============================================
     Command Palette Skeleton (Story 1.7)
     ============================================
     Mounts once at boot (skip in embed mode per AD-7). Opens on
     ⌘K / Ctrl+K and on `/` from outside any text input. Closes on
     Escape, click outside, or option selection. Reads recent tools
     from `localStorage.handy-tools.recent` (Story 3.12 owns the write
     side; this skeleton is read-only). No fuzzy match, no global
     actions, no footer hints — those are Stories 3.1, 3.2, 3.3.

     ARIA: WAI-ARIA 1.1 combobox + listbox pattern (UX-DR-19). The
     wrapper is role="combobox"; the input is role="searchbox" with
     aria-controls pointing at the listbox. Active option is set via
     aria-activedescendant on the input (no Tab — overlay pattern
     per UX-DR-3). */

  let paletteState = null;
  // paletteState = { callingElement, activeIndex, clickOutsideInstalled }

  function wirePalette() {
    // The palette node is the static include from assets/shell/palette.html
    // (copied into every page by scripts/shell-template.py). If the page is
    // somehow missing the include (e.g. a custom tool page that bypassed the
    // generator), we silently skip — the palette is a Shell concern, not a
    // hard requirement for tool functionality.
    const palette = document.getElementById('palette');
    if (!palette) {
      console.warn('shell.palette: missing #palette node; palette disabled');
      return;
    }

    // Populate the initial empty state. Recent-tools data is read on open
    // (not at boot) so the list reflects whatever localStorage holds at the
    // moment the user opens the palette.
    const listbox = document.getElementById('palette-listbox');
    if (listbox && !listbox.children.length) {
      const empty = document.createElement('li');
      empty.className = 'shell-palette-empty';
      empty.setAttribute('role', 'presentation');
      empty.textContent = 'No recent tools yet';
      listbox.appendChild(empty);
    }

    // Capture-phase keydown listener: runs BEFORE tool page handlers can
    // preventDefault, so the chord fires from any focusable element. The
    // listener early-returns when focus is in a text input / textarea /
    // select / contenteditable so we never hijack the user's typing.
    document.addEventListener('keydown', onPaletteChord, { capture: true });

    // Input-level keydown listener for in-palette navigation (ArrowUp/Down,
    // Enter, Escape). The Escape path also bubbles to document so a press
    // outside the input still closes the palette.
    const input = document.getElementById('palette-input');
    if (input) input.addEventListener('keydown', onPaletteInputKey);

    // Listbox click: each <li role="option"> carries data-slug; clicking
    // navigates to /tools/<slug>.
    if (listbox) listbox.addEventListener('click', onPaletteListClick);
  }

  function onPaletteChord(event) {
    // ?embed=1: no-op even if the chord somehow fires (trigger is hidden
    // via CSS, but the listener is still installed; defense in depth).
    if (isEmbedMode()) return;

    // ⌘K (macOS) / Ctrl+K (others). Don't fire if a modifier other than
    // shift is also pressed — Cmd+Shift+K, Ctrl+Alt+K, etc. are not
    // reserved and shouldn't open the palette.
    const isKChord =
      (event.key === 'k' || event.key === 'K') &&
      event.metaKey === (window.navigator && /Mac/i.test(window.navigator.platform)) &&
      !event.ctrlKey && !event.altKey;
    const isCtrlKChord =
      (event.key === 'k' || event.key === 'K') &&
      event.ctrlKey &&
      !event.metaKey && !event.altKey;
    const chord = isKChord || isCtrlKChord;

    // `/` from outside any text input. The chord only fires when the user
    // is not currently typing into a text-entry field.
    const target = event.target;
    const isTextInput =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target && target.isContentEditable);
    const isSlashChord = event.key === '/' && !isTextInput && !event.metaKey && !event.ctrlKey && !event.altKey;

    if (chord || isSlashChord) {
      event.preventDefault();
      if (paletteState) {
        // Palette already open — focus stays on the input (no-op).
        return;
      }
      openPalette();
    }
  }

  function openPalette() {
    if (isEmbedMode()) return;
    if (paletteState) return; // idempotent

    // Per UX-DR-3, palette and settings are mutually exclusive — opening
    // one closes the other. shell.js owns the coordination; CSS does not
    // enforce it (see components.css modal section comment).
    if (settingsState) closeSettings();

    const palette = document.getElementById('palette');
    const input = document.getElementById('palette-input');
    const listbox = document.getElementById('palette-listbox');
    if (!palette || !input || !listbox) return;

    paletteState = {
      callingElement: document.activeElement,
      activeIndex: -1,
      activeKind: null, // 'tool' | 'action' | null — used by the Enter handler
      clickOutsideInstalled: false,
      inputInstalled: false,
    };

    // Wire the input listener once per open (removed on close). 50ms debounce
    // matches the human typing rhythm; HT.search itself is ≤10ms warm.
    input.addEventListener('input', onPaletteInput);
    paletteState.inputInstalled = true;

    // Initial render: recent tools (empty query → no search).
    renderPaletteList('');

    // Show the overlay. Use [hidden] attribute + aria-hidden for the
    // a11y + visibility pair; aria-expanded reflects open state.
    palette.removeAttribute('hidden');
    palette.setAttribute('aria-hidden', 'false');
    palette.setAttribute('aria-expanded', 'true');
    input.value = '';
    input.setAttribute('aria-activedescendant', '');
    // Move focus to the input after the DOM update.
    input.focus();

    // Install click-outside listener (capture phase so we run before any
    // tool page handler that might preventDefault).
    document.addEventListener('click', onPaletteClickOutside, { capture: true });
    paletteState.clickOutsideInstalled = true;
  }

  function closePalette() {
    if (!paletteState) return; // idempotent
    const palette = document.getElementById('palette');
    const input = document.getElementById('palette-input');
    if (palette) {
      palette.setAttribute('hidden', '');
      palette.setAttribute('aria-hidden', 'true');
      palette.setAttribute('aria-expanded', 'false');
    }
    if (input) {
      input.setAttribute('aria-activedescendant', '');
      input.value = '';
      if (paletteState.inputInstalled) {
        input.removeEventListener('input', onPaletteInput);
      }
    }
    // Restore focus to the calling element. If it has been removed from
    // the DOM while the palette was open, fall back to <main>.
    const ce = paletteState.callingElement;
    let restoreTarget = null;
    if (ce && typeof ce.focus === 'function' && document.body.contains(ce)) {
      restoreTarget = ce;
    } else {
      restoreTarget = document.getElementById('main');
      if (!restoreTarget) {
        console.warn('palette.close: calling element removed and #main not found; focus lost');
      }
    }
    if (restoreTarget) {
      try { restoreTarget.focus(); } catch (_) { /* ignore */ }
    }
    if (paletteState.clickOutsideInstalled) {
      document.removeEventListener('click', onPaletteClickOutside, { capture: true });
    }
    // Clear the live region on close so a stale announcement doesn't carry
    // over to the next open.
    const live = document.getElementById('palette-live');
    if (live) live.textContent = '';
    paletteState = null;
  }

  function onPaletteClickOutside(event) {
    if (!paletteState) return;
    const palette = document.getElementById('palette');
    if (!palette) return;
    if (palette.contains(event.target)) return; // click inside → ignore
    closePalette();
  }

  function onPaletteInputKey(event) {
    if (!paletteState) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closePalette();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const opts = getNavigableOptions();
      if (opts.length === 0) return;
      setActiveIndex(event.key === 'Home' ? 0 : opts.length - 1);
      return;
    }
    // ? (Shift+/) chord. Story 3.3 owns the overlay; this story emits the
    // event so the overlay can wire up without an edit here.
    if (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      HT.palette.openHelp();
      return;
    }
    // Tab / Shift+Tab are no-ops per the WAI-ARIA 1.1 combobox/listbox
    // pattern (UX-DR-3 overlay + AI-8). Moving within the listbox is
    // arrow keys only; Tab moves focus *out of* the palette.
    if (event.key === 'Tab') {
      event.preventDefault();
      return;
    }
    if (event.key === 'Enter') {
      const idx = paletteState.activeIndex;
      if (idx < 0) return; // no active option → no-op
      const listbox = document.getElementById('palette-listbox');
      if (!listbox) return;
      const opts = listbox.querySelectorAll('[role="option"]');
      const target = opts[idx];
      if (!target) return;
      const kind = target.getAttribute('data-kind');
      if (kind === 'action') {
        const actionId = target.getAttribute('data-action-id');
        if (actionId) {
          closePalette();
          HT.palette.runAction(actionId);
        }
        return;
      }
      const slug = target.getAttribute('data-slug');
      if (!slug) return;
      window.location.assign('/tools/' + slug);
    }
  }

  function onPaletteListClick(event) {
    if (!paletteState) return;
    const li = event.target.closest('[role="option"]');
    if (!li) return;
    const kind = li.getAttribute('data-kind');
    if (kind === 'action') {
      const actionId = li.getAttribute('data-action-id');
      if (actionId) {
        closePalette();
        HT.palette.runAction(actionId);
      }
      return;
    }
    const slug = li.getAttribute('data-slug');
    if (!slug) return;
    // Close then navigate. The close path restores focus but the navigation
    // happens immediately, so the focus restore is moot for this branch.
    closePalette();
    window.location.assign('/tools/' + slug);
  }

  function getNavigableOptions() {
    const listbox = document.getElementById('palette-listbox');
    if (!listbox) return [];
    return Array.from(listbox.querySelectorAll('[role="option"]'));
  }

  function setActiveIndex(idx) {
    if (!paletteState) return;
    const opts = getNavigableOptions();
    if (opts.length === 0) {
      paletteState.activeIndex = -1;
      paletteState.activeKind = null;
      const input = document.getElementById('palette-input');
      if (input) input.setAttribute('aria-activedescendant', '');
      return;
    }
    const clamped = idx < 0 ? 0 : idx >= opts.length ? opts.length - 1 : idx;
    paletteState.activeIndex = clamped;
    const opt = opts[clamped];
    paletteState.activeKind = opt.getAttribute('data-kind') || null;
    // Clear all selected, set the new one. The input's aria-activedescendant
    // stays the source of truth for "focused" (Story 1.7) but we also set
    // aria-selected on the option per WAI-ARIA 1.1 — both attributes serve
    // the same cursor-row role and the forced-colors border uses
    // [aria-selected="true"] as its selector.
    opts.forEach((o, i) => o.setAttribute('aria-selected', i === clamped ? 'true' : 'false'));
    const input = document.getElementById('palette-input');
    if (input) input.setAttribute('aria-activedescendant', opt.id);
  }

  function moveActive(delta) {
    if (!paletteState) return;
    const opts = getNavigableOptions();
    if (opts.length === 0) return; // empty list — nothing to navigate
    // No wrap per UX-DR-3 / WAI-ARIA 1.1: clamp at the ends.
    setActiveIndex(paletteState.activeIndex < 0
      ? (delta > 0 ? 0 : opts.length - 1)
      : paletteState.activeIndex + delta);
  }

  // Slug → title-case label. Used as a fallback when search results aren't
  // available (recent-tools render path on first open). Story 3.12 owns the
  // recent-tools write side and may carry title metadata in storage; this
  // helper stays for the bare-slug case.
  function slugToTitle(slug) {
    return slug
      .split('-')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(' ');
  }

  // Read recent tools. Shared by openPalette() and renderRecentTools().
  function readRecentTools() {
    let recent = [];
    try {
      const raw = localStorage.getItem('handy-tools.recent');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) recent = parsed.filter((s) => typeof s === 'string' && s.length > 0);
      }
    } catch (_) {
      console.warn('palette.recent: malformed JSON, treating as empty');
      recent = [];
    }
    return recent;
  }

  // Build a single <li role="option"> for a tool match. Sets data-slug,
  // data-kind="tool", aria-selected="false", and an aria-label that includes
  // the matched field + substring (UX-DR-19 / AC-4).
  function buildToolOption(match, idx) {
    const li = document.createElement('li');
    li.id = 'palette-opt-' + idx;
    li.className = 'shell-palette-option';
    li.setAttribute('role', 'option');
    li.setAttribute('data-kind', 'tool');
    li.setAttribute('data-slug', match.slug);
    li.setAttribute('aria-selected', 'false');

    const titleEl = document.createElement('span');
    titleEl.className = 'shell-palette-title';
    titleEl.appendChild(buildMatchFragment(match.title, match.matchedField, match._query || ''));
    li.appendChild(titleEl);

    if (match.matchedField && match.matchedField !== 'title') {
      const meta = document.createElement('span');
      meta.className = 'shell-palette-match';
      meta.textContent = 'matched in ' + match.matchedField;
      li.appendChild(meta);
    }

    // aria-label per AC-4: <title> — match in <field>: '<substring>'.
    // The substring is the actual text that matched (raw, not normalized),
    // derived from the same index space as the visible <strong> via
    // _matchRange so visible UX and AT UX stay in sync. If the index
    // helper is unavailable for any reason, fall back to the field name
    // without a substring so the label is still meaningful.
    let ariaLabel;
    if (match.matchedField === 'title') {
      const range = (typeof HT !== 'undefined' && HT.search && typeof HT.search._matchRange === 'function')
        ? HT.search._matchRange(match._query || '', match.title)
        : null;
      const sub = (range && range.end > range.start && range.end <= match.title.length)
        ? match.title.slice(range.start, range.end)
        : '';
      ariaLabel = sub
        ? match.title + " — match in title: '" + sub + "'"
        : match.title + ' — match in title';
    } else if (match.matchedField) {
      ariaLabel = match.title + ' — matched in ' + match.matchedField;
    } else {
      ariaLabel = match.title;
    }
    li.setAttribute('aria-label', ariaLabel);
    return li;
  }

  // Build the title fragment with a <strong> wrap around the matched range.
  // matchedField === 'title' → bold the matched substring inside `title`.
  // Other fields → bold nothing in the title (the match indicator span
  // carries the "matched in X" cue). For non-title matches, returns a
  // plain text node.
  function buildMatchFragment(title, matchedField, query) {
    const frag = document.createDocumentFragment();
    if (matchedField !== 'title') {
      frag.appendChild(document.createTextNode(title));
      return frag;
    }
    if (typeof HT !== 'undefined' && HT.search && typeof HT.search._matchRange === 'function') {
      const range = HT.search._matchRange(query, title);
      if (range && range.end > range.start && range.end <= title.length) {
        if (range.start > 0) frag.appendChild(document.createTextNode(title.slice(0, range.start)));
        const strong = document.createElement('strong');
        strong.textContent = title.slice(range.start, range.end);
        frag.appendChild(strong);
        if (range.end < title.length) frag.appendChild(document.createTextNode(title.slice(range.end)));
        return frag;
      }
    }
    frag.appendChild(document.createTextNode(title));
    return frag;
  }

  // Story 3.2: inline SVG glyphs for the 7 declared action icons. Zero
  // dep — no icon font, no external sprite. Each glyph is a single-line
  // 16×16 path with `stroke="currentColor"` so token colors apply, and
  // `fill="none"` so the strokes paint correctly in high-contrast mode
  // (where the CSS forces `stroke: CanvasText`). Unknown icon → falls
  // back to the neutral command glyph.
  const ACTION_ICONS = Object.freeze({
    theme: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.5M8 13v1.5M1.5 8h1.5M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1"/></svg>',
    settings: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="2.2"/><path d="M8 1.5l.8 1.6 1.8-.3.4 1.7 1.7.6-.6 1.7.8 1.6-1.5 1.1-.2 1.8-1.8.2-1 1.5-1.5-1-1.8-.2-.2-1.8-1.5-1.1.8-1.6-.6-1.7 1.7-.6.4-1.7 1.8.3z"/></svg>',
    privacy: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 1.5l-5 2v4.5c0 3 2 5.3 5 6.5 3-1.2 5-3.5 5-6.5V3.5z"/><path d="M5.5 8l1.8 1.8L10.5 6.5"/></svg>',
    quality: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 1.5L2 4v4.5c0 3 2 5.3 6 6.5 4-1.2 6-3.5 6-6.5V4z"/><path d="M5.5 8.2l1.8 1.8L11 6"/></svg>',
    clear: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4.5h10M5 4.5V3a1 1 0 011-1h4a1 1 0 011 1v1.5M4 4.5l.7 9a1 1 0 001 .9h4.6a1 1 0 001-.9l.7-9"/><path d="M6.5 7v5M9.5 7v5"/></svg>',
    source: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5M9 3l-2 10"/></svg>',
    help: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6.5"/><path d="M6.2 6.2a2 2 0 013.6 1.3c0 1.5-1.8 1.5-1.8 2.8"/><circle cx="8" cy="12" r=".5" fill="currentColor"/></svg>',
    command: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M2.5 5h11M2.5 11h11"/></svg>',
  });

  function buildActionOption(action, idx) {
    const li = document.createElement('li');
    li.id = 'palette-opt-action-' + idx;
    li.className = 'shell-palette-option shell-palette-action';
    li.setAttribute('role', 'option');
    li.setAttribute('data-kind', 'action');
    li.setAttribute('data-action-id', action.id);
    li.setAttribute('aria-selected', 'false');
    // Icon span (decorative; aria-hidden because the row's aria-label
    // already says "Action: <label>"). Unknown icon key → fall back to
    // the neutral command glyph with no console.warn (icons are pure
    // UI; don't pollute dev tools).
    const iconKey = (action && typeof action.icon === 'string' && ACTION_ICONS[action.icon])
      ? action.icon
      : 'command';
    const iconSvg = ACTION_ICONS[iconKey];
    const span = document.createElement('span');
    span.className = 'shell-palette-icon';
    span.setAttribute('data-icon', action && action.icon ? action.icon : 'command');
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = iconSvg;
    li.appendChild(span);
    li.appendChild(document.createTextNode(action.label));
    li.setAttribute('aria-label', 'Action: ' + action.label);
    return li;
  }

  function buildGroupHeader(label) {
    const li = document.createElement('li');
    li.className = 'shell-palette-group-header';
    li.setAttribute('role', 'presentation');
    li.textContent = label;
    return li;
  }

  function buildEmptyRow(text) {
    const li = document.createElement('li');
    li.className = 'shell-palette-empty';
    li.setAttribute('role', 'presentation');
    li.textContent = text;
    return li;
  }

  // Render the recent-tools list. Empty list shows the placeholder li;
  // non-empty renders one li per slug using slugToTitle as the label.
  function renderRecentTools() {
    const listbox = document.getElementById('palette-listbox');
    if (!listbox) return [];
    while (listbox.firstChild) listbox.removeChild(listbox.firstChild);
    const recent = readRecentTools();
    if (recent.length === 0) {
      listbox.appendChild(buildEmptyRow('No recent tools yet'));
      return [];
    }
    recent.forEach((slug, idx) => {
      const li = document.createElement('li');
      li.id = 'palette-opt-' + idx;
      li.className = 'shell-palette-option';
      li.setAttribute('role', 'option');
      li.setAttribute('data-kind', 'tool');
      li.setAttribute('data-slug', slug);
      li.setAttribute('aria-selected', 'false');
      const title = slugToTitle(slug);
      const titleEl = document.createElement('span');
      titleEl.className = 'shell-palette-title';
      titleEl.textContent = title;
      li.appendChild(titleEl);
      li.setAttribute('aria-label', title);
      listbox.appendChild(li);
    });
    return recent.length;
  }

  // Render search results + actions group. Top-5 cap for tools (HT.search
  // returns up to 10); action group slot below, separate presentation header.
  function renderSearchResults(query, results) {
    const listbox = document.getElementById('palette-listbox');
    if (!listbox) return;
    while (listbox.firstChild) listbox.removeChild(listbox.firstChild);
    const toolRows = (results || []).slice(0, 5);
    toolRows.forEach((match, idx) => {
      // Stash the query on the match so buildMatchFragment can read it
      // without a separate parameter list. The match object is a fresh
      // frozen result from HT.search; we don't mutate the engine's output.
      const localMatch = Object.assign({}, match, { _query: query });
      listbox.appendChild(buildToolOption(localMatch, idx));
    });
    // Actions slot — only renders the group header when the matcher
    // returns at least one action. Story 3.2 replaces the stub body.
    const actions = HT.palette.matchActions(query);
    if (actions && actions.length > 0) {
      listbox.appendChild(buildGroupHeader('Actions'));
      actions.forEach((a, i) => listbox.appendChild(buildActionOption(a, toolRows.length + 1 + i)));
    }
    const totalOptions = listbox.querySelectorAll('[role="option"]').length;
    if (totalOptions === 0) {
      listbox.appendChild(buildEmptyRow("No tools match '" + query + "'"));
    }
  }

  // Dispatch: empty query → recent tools; non-empty → search results.
  // Also announces the result count on the live region.
  function renderPaletteList(query) {
    const q = (typeof query === 'string' ? query : '').trim();
    if (q === '') {
      renderRecentTools();
      announceResultCount('', 0, 0);
      setActiveIndex(-1);
      return;
    }
    Promise.resolve(HT.search(q)).then((results) => {
      // Guard: the palette may have closed (or input cleared) while the
      // async fetch was in flight. Re-check before touching the DOM.
      if (!paletteState) return;
      renderSearchResults(q, results || []);
      const toolCount = (results || []).slice(0, 5).length;
      const actionCount = (HT.palette.matchActions(q) || []).length;
      announceResultCount(q, toolCount, actionCount);
      setActiveIndex(-1);
    });
  }

  // Live-region announcer. Empty query → no announcement (the recent-
  // tools render is the palette's default state and shouldn't be
  // announced on every open). Non-empty → count + empty-state copy.
  function announceResultCount(query, toolCount, actionCount) {
    const live = document.getElementById('palette-live');
    if (!live) return;
    if (!query) {
      live.textContent = '';
      return;
    }
    if (toolCount === 0 && actionCount === 0) {
      live.textContent = "No tools match '" + query + "'. Try a shorter query, or press ? for shortcuts.";
      return;
    }
    const parts = [];
    if (toolCount > 0) parts.push(toolCount + ' tool' + (toolCount === 1 ? '' : 's'));
    if (actionCount > 0) parts.push(actionCount + ' action' + (actionCount === 1 ? '' : 's'));
    live.textContent = parts.join(', ');
  }

  // Input listener (installed per-open by openPalette, removed per-close).
  // 50ms debounce matches the human typing rhythm; HT.search itself is
  // ≤10ms warm so the bottleneck is typing, not computation.
  let inputDebounceTimer = null;
  function onPaletteInput() {
    if (!paletteState) return;
    const input = document.getElementById('palette-input');
    if (!input) return;
    const value = input.value;
    if (inputDebounceTimer) clearTimeout(inputDebounceTimer);
    inputDebounceTimer = setTimeout(() => {
      inputDebounceTimer = null;
      renderPaletteList(value);
    }, 50);
  }


  /* ============================================
     Settings Modal Skeleton (Story 1.8 + Story 3.5)
     ============================================
     Static include from assets/shell/settings.html. All seven fields
     are live: theme, locale, units, currency, fontScale, reducedMotion,
     and clear-all. All ht.* values are plain strings so the head FOUC
     snippet can read ht.theme before boot. The fontScale default is
     '1' (string — Story 3.5 D4) so the slider's <input type="range">
     and the storage layer agree on the same representation. */

  const SETTINGS_KEYS = Object.freeze([
    'ht.theme',
    'ht.locale',
    'ht.reducedMotion',
    'ht.units',
    'ht.currency',
    'ht.fontScale',
  ]);

  const SETTINGS_DEFAULTS = Object.freeze({
    'ht.theme': 'auto',
    'ht.locale': 'en',
    'ht.reducedMotion': '0',
    'ht.units': 'metric',
    'ht.currency': 'USD',
    'ht.fontScale': '1',
  });

  let settingsState = null;

  function readSetting(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function writeSetting(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (_) {
      // Private browsing or a disabled storage area: keep the live UI
      // working for this session without logging user-facing noise.
    }
  }

  function setSettingsTheme(mode) {
    const valid = mode === 'auto' || mode === 'light' || mode === 'dark';
    const next = valid ? mode : SETTINGS_DEFAULTS['ht.theme'];
    writeSetting('ht.theme', next);
    let resolved = next;
    if (next === 'auto') {
      const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
      resolved = mq && mq.matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.dispatchEvent(
      new CustomEvent('ht:settings-theme-changed', { detail: { mode: next } })
    );
  }

  function setSettingsReducedMotion(enabled) {
    const on = Boolean(enabled);
    writeSetting('ht.reducedMotion', on ? '1' : '0');
    if (on) {
      document.documentElement.setAttribute('data-reduced-motion', 'true');
    } else {
      document.documentElement.removeAttribute('data-reduced-motion');
    }
  }

  function populateSettings() {
    // 1. Theme (Story 3.5: single <select> with auto/light/dark).
    // A legacy or corrupt value (e.g. from a future migration) falls
    // back to the default rather than rendering with no option selected.
    const themeSelect = document.querySelector('select[name="ht.theme"]');
    if (themeSelect) {
      const storedTheme = readSetting('ht.theme', SETTINGS_DEFAULTS['ht.theme']);
      const validTheme = (storedTheme === 'auto' || storedTheme === 'light' || storedTheme === 'dark')
        ? storedTheme
        : SETTINGS_DEFAULTS['ht.theme'];
      themeSelect.value = validTheme;
    }

    // 2. Language — dynamic populate from navigator.languages
    // (clipped to first 2 chars, lowercased, deduplicated, with 'en'
    // always appended if missing). Stored value wins; otherwise default
    // to navigator.language.slice(0,2).toLowerCase() or 'en' (per AC-1).
    const locale = document.querySelector('select[name="ht.locale"]');
    if (locale) {
      const navList = (Array.isArray(navigator.languages) && navigator.languages.length > 0)
        ? navigator.languages
        : (navigator.language ? [navigator.language] : []);
      const codes = Array.from(new Set(
        navList
          .filter(function (entry) { return typeof entry === 'string' && entry.length > 0; })
          .map(function (entry) { return entry.slice(0, 2).toLowerCase(); })
      ));
      if (codes.indexOf('en') === -1) codes.push('en');
      // Replace the static <option> children with the dynamic set.
      while (locale.firstChild) locale.removeChild(locale.firstChild);
      codes.forEach(function (code) {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = code;
        locale.appendChild(option);
      });
      const storedLocale = readSetting('ht.locale', SETTINGS_DEFAULTS['ht.locale']);
      const storedValid = Array.from(locale.options).some(function (option) { return option.value === storedLocale; });
      if (storedValid) {
        locale.value = storedLocale;
      } else {
        // Default per AC-1: navigator.language.slice(0,2).toLowerCase(),
        // or 'en' if empty. Fall back to the populated `codes[0]` only
        // when navigator.language is unavailable — keeps the spec's
        // expression literal even if navigator.language === ''.
        const navDefault = (typeof navigator.language === 'string' && navigator.language.length >= 2)
          ? navigator.language.slice(0, 2).toLowerCase()
          : '';
        locale.value = navDefault && Array.from(locale.options).some(function (option) { return option.value === navDefault; })
          ? navDefault
          : SETTINGS_DEFAULTS['ht.locale'];
      }
    }

    // 3. Reduced motion — OS-override (prefers-reduced-motion: reduce).
    // The user's explicit stored value always wins; the OS preference
    // only seeds the default when nothing has been persisted yet. This
    // matches the UX-DR-19 a11y contract: respect the OS unless the user
    // has already opted in/out explicitly.
    const reducedMotion = document.querySelector('input[name="ht.reducedMotion"]');
    if (reducedMotion) {
      let storedRaw;
      try { storedRaw = localStorage.getItem('ht.reducedMotion'); } catch (_) { storedRaw = null; }
      let effective;
      if (storedRaw !== null) {
        effective = storedRaw === '1';
      } else {
        const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
        effective = Boolean(mq && mq.matches);
      }
      reducedMotion.checked = effective;
    }

    // 4. Default units (Story 3.5 — metric/imperial select).
    const unitsSelect = document.querySelector('select[name="ht.units"]');
    if (unitsSelect) {
      const stored = readSetting('ht.units', SETTINGS_DEFAULTS['ht.units']);
      unitsSelect.value = Array.from(unitsSelect.options).some(function (option) { return option.value === stored; })
        ? stored
        : SETTINGS_DEFAULTS['ht.units'];
    }

    // 5. Default currency (Story 3.5 — ISO-4217 select).
    const currencySelect = document.querySelector('select[name="ht.currency"]');
    if (currencySelect) {
      const stored = readSetting('ht.currency', SETTINGS_DEFAULTS['ht.currency']);
      currencySelect.value = Array.from(currencySelect.options).some(function (option) { return option.value === stored; })
        ? stored
        : SETTINGS_DEFAULTS['ht.currency'];
    }

    // 6. Font scale (Story 3.5 — 0.85–1.4 range; default '1').
    const fontScale = document.querySelector('input[name="ht.fontScale"]');
    const fontOutput = document.querySelector('#ht-fontScale-output');
    if (fontScale) {
      const stored = readSetting('ht.fontScale', SETTINGS_DEFAULTS['ht.fontScale']);
      const parsed = parseFloat(stored);
      const safe = Number.isFinite(parsed) ? parsed : parseFloat(SETTINGS_DEFAULTS['ht.fontScale']);
      fontScale.value = String(safe);
      if (fontOutput) {
        fontOutput.textContent = Math.round(safe * 100) + '%';
      }
    }
  }

  function wireSettings() {
    const modal = document.getElementById('shell-settings-modal');
    if (!modal) {
      console.warn('shell.settings: missing #shell-settings-modal; settings disabled');
      return;
    }

    // 1. Theme — Story 3.5: single <select> with auto/light/dark. The
    // setSettingsTheme() body accepts the same 3 values the radios did.
    const themeSelect = modal.querySelector('select[name="ht.theme"]');
    if (themeSelect) {
      themeSelect.addEventListener('change', () => setSettingsTheme(themeSelect.value));
    }

    // 2. Language — wire stays; the <select> already had a change listener.
    const locale = modal.querySelector('select[name="ht.locale"]');
    if (locale) {
      locale.addEventListener('change', () => writeSetting('ht.locale', locale.value));
    }

    // 3. Reduced motion — wire stays.
    const reducedMotion = modal.querySelector('input[name="ht.reducedMotion"]');
    if (reducedMotion) {
      reducedMotion.addEventListener('change', () => setSettingsReducedMotion(reducedMotion.checked));
    }

    // 4. Default units — Story 3.5.
    const unitsSelect = modal.querySelector('select[name="ht.units"]');
    if (unitsSelect) {
      unitsSelect.addEventListener('change', () => writeSetting('ht.units', unitsSelect.value));
    }

    // 5. Default currency — Story 3.5.
    const currencySelect = modal.querySelector('select[name="ht.currency"]');
    if (currencySelect) {
      currencySelect.addEventListener('change', () => writeSetting('ht.currency', currencySelect.value));
    }

    // 6. Font scale — Story 3.5. Listens for `input` (NOT `change`) so the
    // value streams while the user drags. Updates both the storage layer
    // AND the visible <output> percentage on every step.
    const fontScale = modal.querySelector('input[name="ht.fontScale"]');
    const fontOutput = modal.querySelector('#ht-fontScale-output');
    if (fontScale) {
      fontScale.addEventListener('input', () => {
        writeSetting('ht.fontScale', String(fontScale.value));
        if (fontOutput) {
          fontOutput.textContent = Math.round(parseFloat(fontScale.value) * 100) + '%';
        }
      });
    }

    modal.querySelectorAll('[data-settings-dismiss]').forEach((dismiss) => {
      dismiss.addEventListener('click', closeSettings);
    });

    const clearButton = document.getElementById('shell-settings-clear');
    if (clearButton) clearButton.addEventListener('click', clearAllLocalData);

    // Story 3.7 — Export-my-data action. Reversible, no typed confirmation
    // (UX-DR-3). Click → HT.export.run() → JSON Blob download. In embed
    // mode the Settings modal is already blocked from opening (AD-7),
    // but we still mark the button [hidden] + aria-hidden so screen
    // readers and future parsers see it as suppressed, mirroring the
    // pattern the History panel uses.
    const exportButton = document.getElementById('shell-settings-export');
    if (exportButton) {
      exportButton.addEventListener('click', () => HT.export.run());
      if (isEmbedMode()) {
        exportButton.hidden = true;
        exportButton.setAttribute('aria-hidden', 'true');
        exportButton.dataset.embedSuppressed = '1';
      }
    }

    // Story 3.8 — Import-my-data action. Destructive-and-overwriting
    // (UX-DR-3); the import.js module opens a window.confirm dialog
    // when any settings conflict (and emits "Import canceled" toast
    // if the user backs out). Click → HT.import.run() → file picker.
    // Embed-mode guard mirrors the exportButton block above.
    const importButton = document.getElementById('shell-settings-import');
    if (importButton) {
      importButton.addEventListener('click', () => HT.import.run());
      if (isEmbedMode()) {
        importButton.hidden = true;
        importButton.setAttribute('aria-hidden', 'true');
        importButton.dataset.embedSuppressed = '1';
      }
    }

    // Apply the persisted reduced-motion preference at boot as well as when
    // the modal field changes, so a reload preserves the setting immediately.
    // Story 3.5: respect an explicit stored value; otherwise default to the
    // OS preference (`prefers-reduced-motion: reduce`) when it matches.
    let bootReducedMotionRaw;
    try { bootReducedMotionRaw = localStorage.getItem('ht.reducedMotion'); } catch (_) { bootReducedMotionRaw = null; }
    let bootReducedMotion;
    if (bootReducedMotionRaw !== null) {
      bootReducedMotion = bootReducedMotionRaw === '1';
    } else {
      const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
      bootReducedMotion = Boolean(mq && mq.matches);
    }
    setSettingsReducedMotion(bootReducedMotion);
  }

  function openSettings() {
    if (isEmbedMode() || settingsState) return;
    const modal = document.getElementById('shell-settings-modal');
    const panel = modal && modal.querySelector('.shell-settings-modal__panel');
    if (!modal || !panel) return;

    // Opening settings must never stack over the command palette.
    closePalette();
    populateSettings();
    // Save the prior body overflow so closeSettings can restore it
    // without clobbering any value another component had set.
    settingsState = {
      callingElement: document.activeElement,
      previousBodyOverflow: document.body.style.overflow,
    };
    modal.removeAttribute('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onSettingsKeydown);
    panel.focus();
  }

  function closeSettings() {
    if (!settingsState) return;
    const modal = document.getElementById('shell-settings-modal');
    if (modal) {
      modal.setAttribute('hidden', '');
      modal.setAttribute('aria-hidden', 'true');
    }
    document.removeEventListener('keydown', onSettingsKeydown);
    document.body.style.overflow = settingsState.previousBodyOverflow || '';

    const callingElement = settingsState.callingElement;
    settingsState = null;
    if (callingElement && typeof callingElement.focus === 'function' && document.body.contains(callingElement)) {
      try {
        callingElement.focus();
      } catch (err) {
        // Don't swallow a real failure — surface it so the dev-tools
        // console helps future regressions.
        console.warn('shell.settings: focus restoration failed', err);
      }
    }
  }

  function onSettingsKeydown(event) {
    if (!settingsState) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSettings();
      return;
    }
    if (event.key !== 'Tab') return;

    const panel = document.querySelector('.shell-settings-modal__panel');
    if (!panel) return;
    const focusables = HT.a11y && HT.a11y.focusable
      ? Array.from(HT.a11y.focusable(panel))
      : Array.from(panel.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  let clearAllInFlight = false;
  function clearAllLocalData() {
    if (clearAllInFlight) return; // guard against rapid double-click racing the reload
    if (!window.confirm('Clear all Handy Tools preferences? This cannot be undone.')) return;
    clearAllInFlight = true;
    const clearButton = document.getElementById('shell-settings-clear');
    if (clearButton) clearButton.disabled = true;
    try {
      // Story 1.10: iterate HT.storage.keys() (the registry's registered
      // keys) instead of localStorage.length + prefix filter. The registry
      // is the source of truth for which keys exist; future additions land
      // here automatically without code changes.
      if (HT.storage && typeof HT.storage.clear === 'function') {
        HT.storage.clear();
      } else {
        // Pre-registry fallback (legacy browsers or boot order race): the
        // old prefix-filter sweep. Retained so clear-all still works
        // during the upgrade window before all clients load the registry.
        const namespaced = /^(ht|handy-tools)\./;
        const keysToRemove = [];
        for (let index = 0; index < localStorage.length; index += 1) {
          const key = localStorage.key(index);
          if (key && namespaced.test(key)) keysToRemove.push(key);
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
      }
      // Keep the FOUC IIFE on a stable plain-string value during reload.
      // The IIFE reads ht.theme via raw localStorage.getItem('ht.theme')
      // before HT.storage boots — a plain string survives that read.
      localStorage.setItem('ht.theme', 'auto');
    } catch (_) {
      // Storage may be unavailable; reload still gives the user a clean
      // in-memory shell state where the browser permits it.
    }
    window.location.reload();
  }

  HT.settings = Object.freeze({
    keys: SETTINGS_KEYS,
    defaults: SETTINGS_DEFAULTS,
    clearAll: clearAllLocalData,
    open: openSettings,
    close: closeSettings,
  });

  // Action registry. Populated at boot from `window.HT_PALETTE_ACTIONS`
  // (defined by assets/js/palette-actions.js, which is loaded via a
  // script tag BEFORE shell.js). Each value is the action's `run`
  // function. The static declaration file is Shell-owned per AD-14
  // bypass-prohibition — Tools cannot add global actions. An entry is
  // a function that returns void | Promise<void>.
  const _actions = Object.create(null);

  // Story 3.2: normalize a query the same way search.js does, so the
  // matcher and the search engine stay byte-equivalent on diacritics
  // (NFKD + strip combining marks + lowercase). Mirrors the inline
  // `norm()` in palette-actions.js — duplicated here to avoid coupling
  // to the static-declaration IIFE internals.
  function _paletteNorm(s) {
    if (s === null || s === undefined) return '';
    try {
      return String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    } catch (_) {
      return String(s).toLowerCase();
    }
  }

  // Populate `_actions` from the static declaration file. Defensive:
  // missing or non-array `HT_PALETTE_ACTIONS` → silent no-op (the file
  // is optional at boot; old shell bundles without palette-actions.js
  // degrade to "no global actions" instead of crashing). The caller
  // still gets a frozen empty registry.
  function _populateActions() {
    const list = (typeof window !== 'undefined')
      ? window.HT_PALETTE_ACTIONS : undefined;
    if (!Array.isArray(list)) return;
    list.forEach((a) => {
      if (!a || typeof a.id !== 'string' || !a.id) return;
      if (typeof a.run !== 'function') return;
      _actions[a.id] = a.run;
    });
  }
  _populateActions();

  // Story 3.2: real matcher — substring filter on the static action
  // list. Returns plain `{id, label, icon}` objects (no `run` on the
  // wire so callers can't invoke it directly). Empty / whitespace
  // queries return `[]` so the recent-tools empty-state isn't polluted
  // by all 6 actions every time the palette opens.
  let _actionsListMissingWarned = false;
  function matchActions(query) {
    const norm = _paletteNorm(query);
    if (!norm || !norm.trim()) return Object.freeze([]);
    const list = (typeof window !== 'undefined')
      ? window.HT_PALETTE_ACTIONS : undefined;
    if (!Array.isArray(list)) {
      if (!_actionsListMissingWarned) {
        _actionsListMissingWarned = true;
        console.warn('palette.matchActions: HT_PALETTE_ACTIONS missing — returning []');
      }
      return Object.freeze([]);
    }
    const out = [];
    for (let i = 0; i < list.length; i += 1) {
      const a = list[i];
      if (!a || typeof a.id !== 'string' || typeof a.label !== 'string') continue;
      const kws = Array.isArray(a.keywords) ? a.keywords : [];
      let hit = false;
      for (let j = 0; j < kws.length; j += 1) {
        const k = kws[j];
        if (typeof k === 'string' && k.length > 0 && k.indexOf(norm) !== -1) {
          hit = true;
          break;
        }
      }
      if (hit) {
        out.push(Object.freeze({
          id: a.id,
          label: a.label,
          icon: (typeof a.icon === 'string') ? a.icon : '',
        }));
      }
    }
    return Object.freeze(out);
  }

  // Dispatch a registered action by id. Unknown ids warn-once (Story
  // 3.2-review patch #16) and return null so the caller can decide
  // whether to surface a toast. Re-entrant calls with the same
  // unknown id log at most one warning per page-load — same pattern
  // as the matchActions `_actionsListMissingWarned` guard.
  let _runActionUnknownWarned = false;
  function runAction(actionId) {
    if (typeof actionId !== 'string' || !actionId) return null;
    const fn = _actions[actionId];
    if (typeof fn !== 'function') {
      if (!_runActionUnknownWarned) {
        _runActionUnknownWarned = true;
        console.warn('palette.runAction: unknown actionId', actionId);
      }
      return null;
    }
    try {
      return fn();
    } catch (e) {
      console.warn('palette.runAction: handler threw', e);
      return null;
    }
  }

  // Emit the help-overlay event. Story 3.3 owns the listener that renders
  // the overlay; this emitter is the only contract surface this story
  // needs to expose.
  function openHelp() {
    try {
      window.dispatchEvent(new CustomEvent('ht:palette-help'));
    } catch (_) { /* no-op */ }
  }

  // Public palette API (AD-14): exposed via HT.palette.*
  HT.palette = Object.freeze({
    open: openPalette,
    close: closePalette,
    toggle: () => (paletteState ? closePalette() : openPalette()),
    isOpen: () => Boolean(paletteState),
    matchActions,
    runAction,
    openHelp,
    // Story 3.2-review patch #15: `_actions` removed from the public
    // surface. Story 3.1 originally exposed it for the smoke harness;
    // the leak let Tools monkey-patch handlers. The smoke now exercises
    // dispatch via `runAction('__smoke_id')` and validates handlers by
    // stubbing `HT.theme.cycle` / `HT.settings.clearAll` (the public
    // surface the actions delegate to). If a future Story needs a
    // read-only view of the registry, expose `Object.freeze({..._actions})`.
  });

  // Module-level view-source state — declared BEFORE the boot invocation
  // below so that when boot() fires wireViewSourceLink() synchronously,
  // the function body (declared later, ~line 1830) can read these
  // bindings without hitting the temporal-dead-zone. wireViewSourceLink
  // is a hoisted function declaration, so the late-bound function
  // reference inside boot() works fine; only the `let` bindings need
  // to be initialized ahead of the boot call. (Bug fix: Story 3.8
  // wrap-up found that boot() → wireViewSourceLink → read of
  // `_viewSourceEntryRetries` threw ReferenceError because the let
  // initializer was originally placed at line 1789, AFTER the boot
  // invocation at line 1758.)
  let _viewSourceConfigRetries = 0;
  let _viewSourceEntryRetries = 0;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  HT.boot = boot;

  /* ============================================
     Story 1.12 + 3.11 — Footer "View source" link wiring

     Story 1.12 originally shipped a single placeholder span:
       <span aria-disabled="true">View source</span>
     rewired to a GitHub blob URL. Story 3.11 promoted the *local*
     /view-source route (per UX-DR-7 / EXPERIENCE.md) so the chrome
     now ships with TWO anchors:
       <a href="/view-source?tool=" data-view-source-link>View source</a>
       <a href="" rel="noopener noreferrer" data-view-source-github hidden>View on GitHub</a>
     The primary anchor points at the LOCAL route (Story 3.11); the
     secondary anchor (initially hidden) points at the GH blob URL
     (Story 1.12, preserved as a backup / canonical-source-on-GitHub
     affordance).

     Both bytes are byte-identical across all pages (so chrome drift
     is detectable). On tool pages that opt in via `view-source.enabled`
     in tools.json (the default for promoted tools), this function
     fills in the hrefs + aria-labels.

     Slug discovery order (Story 1.12 dev notes):
       1. <main id="main" data-slug="..."> — fastest, no URL parsing
       2. window.location.pathname — "/tools/<slug>/" — fallback when
          data-slug is missing or empty
     Slug vs URL: when both are present and disagree, the URL wins
     because the URL is the actual file the browser is rendering.

     The links only render when all three conditions hold:
       - HT.siteConfig is defined (site-config.js loaded)
       - HT.homeGrid.entries has an entry for the slug
       - the entry's `view-source.enabled` is not explicitly false
     On the home page (no slug) the function is a no-op — the home
     page itself is the repo root, no View Source link is needed.
  */
  // The retry counters (`_viewSourceConfigRetries`, `_viewSourceEntryRetries`)
  // are declared just above the boot invocation block (see the
  // `Module-level view-source state` comment near line 1755) so that
  // when boot() fires wireViewSourceLink() synchronously, the function
  // body can read the bindings without hitting the TDZ. The constants
  // live here because they belong with the function that uses them.
  const _VIEW_SOURCE_RETRY_BUDGET_MS = 2000;
  const _VIEW_SOURCE_RETRY_BASE_MS = 50;

  function resolveCurrentSlug() {
    // 1. data-slug on <main> — preferred because it costs no parsing.
    const main = document.getElementById('main');
    let fromAttr = null;
    if (main) {
      const raw = main.getAttribute('data-slug');
      if (typeof raw === 'string' && raw.trim().length > 0) {
        fromAttr = raw.trim();
      }
    }
    // 2. URL fallback: "/tools/<slug>/index.html" or "/tools/<slug>/".
    //    Always evaluated when data-slug is present so the two values
    //    can be compared and a mismatch surfaced (AC #6).
    let fromUrl = null;
    try {
      const path = window.location.pathname || '';
      const match = path.match(/\/tools\/([^\/]+)\/?(?:index\.html)?$/);
      if (match && typeof match[1] === 'string' && match[1].length > 0) {
        fromUrl = match[1];
      }
    } catch (_) {
      /* location may be unavailable in some embed contexts */
    }
    if (fromAttr && fromUrl && fromAttr !== fromUrl) {
      // Mismatch — the URL is the actual file the browser is rendering
      // (AD-5: URL is canonical transport), so it wins. Surface a
      // console.warn so the dev agent can spot stale data-slug values
      // during rename drift.
      console.warn(
        'shell.viewSource: data-slug="' + fromAttr + '" disagrees with URL '
        + 'slug="' + fromUrl + '" — URL wins (rename drift?)'
      );
      return fromUrl;
    }
    return fromAttr || fromUrl;
  }

  function wireViewSourceLink() {
    if (isEmbedMode()) return; // footer link is hidden in embed mode (AD-7)
    const slug = resolveCurrentSlug();
    if (!slug) return; // home page or non-tool URL — nothing to wire

    // site-config.js is required (HT.siteConfig). If it's missing we
    // can't derive a valid blob URL. Retry for up to ~2s — site-config.js
    // is a non-deferred module that should load on the same tick as
    // shell.js, but the file:// fallback path can be slower.
    if (!HT.siteConfig || !HT.siteConfig.blobBase) {
      const elapsed = _viewSourceConfigRetries * _VIEW_SOURCE_RETRY_BASE_MS;
      if (elapsed >= _VIEW_SOURCE_RETRY_BUDGET_MS) {
        console.warn(
          'shell.viewSource: HT.siteConfig not defined within ' +
          _VIEW_SOURCE_RETRY_BUDGET_MS + 'ms — view source link disabled'
        );
        return;
      }
      _viewSourceConfigRetries += 1;
      const wait = Math.min(
        _VIEW_SOURCE_RETRY_BASE_MS * Math.pow(2, _viewSourceConfigRetries),
        200
      );
      setTimeout(wireViewSourceLink, wait);
      return;
    }

    // Locate the placeholder anchors. As of Story 3.11 the static
    // chrome ships with TWO anchors in the footer:
    //   <a href="/view-source?tool=" data-view-source-link>View source</a>
    //   <a href="" rel="noopener noreferrer" data-view-source-github hidden>View on GitHub</a>
    // The primary link points at the local /view-source route
    // (Story 3.11); the secondary link points at the GitHub blob URL
    // (Story 1.12 — preserved as a backup / "open the canonical
    // source on GitHub" affordance). On pages without a slug the
    // primary link is left empty (no `?tool=...`) and the secondary
    // link stays hidden.
    const primaryAnchor = document.querySelector(
      'footer.site-footer a[data-view-source-link]'
    );
    const secondaryAnchor = document.querySelector(
      'footer.site-footer a[data-view-source-github]'
    );
    if (!primaryAnchor) {
      // Already wired, removed, or page is missing the footer. No-op.
      return;
    }

    // Look up the slug in HT.homeGrid.entries (published by home-grid.js
    // on the home page only — tool pages don't have the grid renderer,
    // so we must wait for the registry's manifest or for HT.homeGrid
    // to be populated by another mechanism). On tool pages the typical
    // case is that HT.homeGrid.entries is null until something populates
    // it; the storage-registry manifest ships tools.json entries via
    // registerHistoryKeys(), but that's history-keys only — the
    // `view-source` field is not carried there.
    //
    // Strategy: read HT.homeGrid.entries when present; otherwise read
    // the inline tools.json block that shell-template.py splices into
    // every page (home AND tool pages). On a tool page the inline block
    // IS present (per the Story 1.12 review patch), so the lookup
    // resolves synchronously after a single DOM read.
    const entry = findToolEntry(slug);
    if (!entry) {
      // Retry — the tool's own module may register its entry after
      // boot via HT.homeGrid.registerEntry() (see home-grid.js).
      const elapsed = _viewSourceEntryRetries * _VIEW_SOURCE_RETRY_BASE_MS;
      if (elapsed >= _VIEW_SOURCE_RETRY_BUDGET_MS) {
        // Surface a soft warn rather than failing silently — the
        // primary anchor remains without `?tool=` so the link simply
        // never materializes (consistent with non-promoted tools).
        console.info(
          'shell.viewSource: no entry for slug "' + slug +
          '" after ' + _VIEW_SOURCE_RETRY_BUDGET_MS + 'ms — leaving anchors'
        );
        return;
      }
      _viewSourceEntryRetries += 1;
      const wait = Math.min(
        _VIEW_SOURCE_RETRY_BASE_MS * Math.pow(2, _viewSourceEntryRetries),
        200
      );
      setTimeout(wireViewSourceLink, wait);
      return;
    }

    const viewSource = entry['view-source'];
    if (viewSource && viewSource.enabled === false) {
      // Explicit opt-out: leave both anchors untouched (the entry
      // author chose to hide the link). No console message — the
      // intent is encoded in the data.
      return;
    }

    // Wire the primary anchor to the local /view-source route.
    // Decision (Story 3.11): the primary anchor's label is the
    // tool's title when we have one, falling back to the literal
    // "View source" placeholder text. The href is /view-source?tool=<slug>.
    const localHref = '/view-source?tool=' + encodeURIComponent(slug);
    primaryAnchor.setAttribute('href', localHref);
    const toolTitle = (entry && typeof entry.title === 'string' && entry.title.length > 0)
      ? entry.title
      : 'View source';
    primaryAnchor.textContent = toolTitle;

    // Wire the secondary anchor to the GitHub blob URL (Story 1.12).
    // Default path is "tools/<slug>/index.html"; entries may override
    // via `view-source.path`. Defensive normalize: strip leading
    // slashes from `pathSegment` (the schema field is optional and
    // a maintainer could set "/foo" producing a double slash) and
    // reject `..` segments to prevent a typo from leaving the repo
    // root.
    let pathSegment = (viewSource && typeof viewSource.path === 'string')
      ? viewSource.path
      : 'tools/' + slug + '/index.html';
    pathSegment = pathSegment.replace(/^\/+/, '');
    if (/(^|\/)\.\.(?:\/|$)/.test(pathSegment)) {
      console.warn(
        'shell.viewSource: entry "' + slug + '" has view-source.path with '
        + 'parent traversal (' + pathSegment + ') — falling back to default'
      );
      pathSegment = 'tools/' + slug + '/index.html';
    }
    if (secondaryAnchor) {
      const blobBase = String(HT.siteConfig.blobBase).replace(/\/+$/, '');
      const blobHref = blobBase + '/' + pathSegment;
      secondaryAnchor.setAttribute('href', blobHref);
      secondaryAnchor.setAttribute('rel', 'noopener noreferrer');
      secondaryAnchor.setAttribute('target', '_blank');
      secondaryAnchor.setAttribute('aria-label', toolTitle + ' on GitHub');
      secondaryAnchor.hidden = false;
    }
  }

  // findToolEntry: locate the slug in HT.homeGrid.entries (preferred)
  // or in the inline tools.json block (spliced into every page by
  // shell-template.py). The inline block lets tool pages resolve the
  // entry synchronously without depending on home-grid.js or a
  // per-tool registerEntry() call.
  function findToolEntry(slug) {
    if (HT.homeGrid && Array.isArray(HT.homeGrid.entries)) {
      for (let i = 0; i < HT.homeGrid.entries.length; i += 1) {
        const e = HT.homeGrid.entries[i];
        if (e && e.slug === slug) return e;
      }
    }
    // Inline fallback: <script type="application/json" id="ht-tools-json-inline">
    // (spliced into every page by shell-template.py).
    const inline = document.getElementById('ht-tools-json-inline');
    if (inline) {
      try {
        const parsed = JSON.parse(inline.textContent || '');
        if (parsed && Array.isArray(parsed.tools)) {
          for (let i = 0; i < parsed.tools.length; i += 1) {
            const e = parsed.tools[i];
            if (e && e.slug === slug) return e;
          }
        }
      } catch (_) {
        // Malformed inline JSON: silently fall through (no entry).
      }
    }
    return null;
  }
})();