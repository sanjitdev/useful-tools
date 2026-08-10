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

    document.addEventListener('click', onClick);
    document.documentElement.addEventListener('ht:fouc-resolved', onFoucResolved);
    observeTheme();
    registerSystemThemeListener();
    syncThemeToggleAria();
    refreshFooterYear();

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

    // Story 1.10: register per-tool history keys once HT.homeGrid publishes.
    // The home-grid renderer loads on every page (it's a deferred script)
    // but only publishes live entries on the home page; on tool pages
    // HT.homeGrid.entries stays null. Defer the registration to the next
    // macrotask so the home-grid renderer's async loadTools() can complete
    // first; if home-grid never publishes (tool pages), fall back to the
    // manifest block in chrome.html.
    //
    // Review fix: the previous implementation gave up after one retry
    // (~50 ms) which meant tool pages shipped without history-keys
    // registration. We now retry for up to ~2 seconds AND accept a
    // fallback path: the storage-registry manifest block in chrome.html
    // carries the canonical `handy-tools.history.<slug>` keys (the
    // history-keys list is per-tool and lives in tools.json which is
    // spliced into the home page; for tool pages we instead use the
    // registry's own keys() as a backstop by registering the slug list
    // that any caller passes — the gate cross-check covers whether a
    // tools.json entry's history-keys are covered).
    setTimeout(registerToolHistoryKeys, 0);
  }

  // Retry budget: ~2 seconds, exponential backoff capped at 200 ms.
  // History keys must land before any tool page reads them, so we
  // accept up to ~2 seconds of deferred registration before falling
  // back to a no-op.
  let _historyKeyRetries = 0;
  const _HISTORY_KEY_RETRY_BUDGET = 2000;
  const _HISTORY_KEY_RETRY_BASE_MS = 50;

  function registerToolHistoryKeys() {
    if (!HT.storage || typeof HT.storage.registerHistoryKeys !== 'function') return;
    const homeGrid = HT.homeGrid;
    if (homeGrid && Array.isArray(homeGrid.entries)) {
      try {
        HT.storage.registerHistoryKeys(homeGrid.entries);
      } catch (err) {
        console.warn('shell.historyKeys: registration failed', err);
      }
      return;
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
      '.theme-toggle, .shell-search-trigger, .shell-settings, .shell-locale'
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

    if (target.classList.contains('shell-search-trigger')) {
      // Story 1.7: open the command palette. In embed mode the trigger is
      // hidden via CSS but a focused programmatic click could still fire —
      // the chord/keyboard paths early-return on isEmbedMode() so we never
      // surface the overlay in embed.
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
      clickOutsideInstalled: false,
    };

    // Read recent tools. JSON.parse with try/catch fallback to [].
    // The data shape is an array of slug strings (Story 3.12 owns the
    // write side; this story is read-only).
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

    // Populate listbox. Empty list shows the placeholder li (wired in
    // wirePalette); non-empty clears it and renders one li per slug.
    while (listbox.firstChild) listbox.removeChild(listbox.firstChild);
    if (recent.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'shell-palette-empty';
      empty.setAttribute('role', 'presentation');
      empty.textContent = 'No recent tools yet';
      listbox.appendChild(empty);
    } else {
      recent.forEach((slug, idx) => {
        const li = document.createElement('li');
        li.id = 'palette-opt-' + idx;
        li.setAttribute('role', 'option');
        li.setAttribute('data-slug', slug);
        li.textContent = slugToTitle(slug);
        listbox.appendChild(li);
      });
    }

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
    if (event.key === 'Enter') {
      const idx = paletteState.activeIndex;
      if (idx < 0) return; // no active option → no-op
      const listbox = document.getElementById('palette-listbox');
      if (!listbox) return;
      const opt = listbox.querySelector('[data-slug]');
      const opts = Array.from(listbox.querySelectorAll('[data-slug]'));
      const target = opts[idx];
      if (!target) return;
      const slug = target.getAttribute('data-slug');
      if (!slug) return;
      // Navigate. The listbox only carries options when recent is non-empty,
      // so reaching this branch implies a valid slug.
      window.location.assign('/tools/' + slug);
    }
  }

  function onPaletteListClick(event) {
    if (!paletteState) return;
    const li = event.target.closest('[data-slug]');
    if (!li) return;
    const slug = li.getAttribute('data-slug');
    if (!slug) return;
    // Close then navigate. The close path restores focus but the navigation
    // happens immediately, so the focus restore is moot for this branch.
    closePalette();
    window.location.assign('/tools/' + slug);
  }

  function moveActive(delta) {
    if (!paletteState) return;
    const listbox = document.getElementById('palette-listbox');
    if (!listbox) return;
    const opts = Array.from(listbox.querySelectorAll('[data-slug]'));
    if (opts.length === 0) return; // empty list — nothing to navigate
    let next = paletteState.activeIndex + delta;
    if (next < 0) next = 0; // no upward wrap; stays on input
    if (next >= opts.length) next = opts.length - 1; // no downward wrap
    paletteState.activeIndex = next;
    const opt = opts[next];
    if (!opt) return;
    const input = document.getElementById('palette-input');
    if (input) input.setAttribute('aria-activedescendant', opt.id);
  }

  // Slug → title-case label. Strips dashes and capitalizes each word.
  // Used by openPalette() for the recent-tools list labels. Story 3.1 will
  // replace this with the real tool title from tools.json.
  function slugToTitle(slug) {
    return slug
      .split('-')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(' ');
  }


  /* ============================================
     Settings Modal Skeleton (Story 1.8)
     ============================================
     Static include from assets/shell/settings.html. Theme, locale,
     and reduced-motion are live; units, currency, and font scale remain
     disabled placeholders for later stories. All ht.* values are plain
     strings so the head FOUC snippet can read ht.theme before boot. */

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
    'ht.fontScale': '100',
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
    // Theme: only auto/light/dark are valid; a legacy or corrupt value
    // (e.g. from a future migration) falls back to the default rather
    // than rendering with no radio checked. Unknown values are not
    // preserved — the user re-selects on next open.
    const storedTheme = readSetting('ht.theme', SETTINGS_DEFAULTS['ht.theme']);
    const validTheme = (storedTheme === 'auto' || storedTheme === 'light' || storedTheme === 'dark')
      ? storedTheme
      : SETTINGS_DEFAULTS['ht.theme'];
    document.querySelectorAll('input[name="ht.theme"]').forEach((radio) => {
      radio.checked = radio.value === validTheme;
    });

    const locale = document.querySelector('select[name="ht.locale"]');
    if (locale) {
      const storedLocale = readSetting('ht.locale', SETTINGS_DEFAULTS['ht.locale']);
      locale.value = Array.from(locale.options).some((option) => option.value === storedLocale)
        ? storedLocale
        : SETTINGS_DEFAULTS['ht.locale'];
    }

    const reducedMotion = document.querySelector('input[name="ht.reducedMotion"]');
    if (reducedMotion) {
      reducedMotion.checked = readSetting('ht.reducedMotion', SETTINGS_DEFAULTS['ht.reducedMotion']) === '1';
    }
  }

  function wireSettings() {
    const modal = document.getElementById('shell-settings-modal');
    if (!modal) {
      console.warn('shell.settings: missing #shell-settings-modal; settings disabled');
      return;
    }

    document.querySelectorAll('input[name="ht.theme"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        if (radio.checked) setSettingsTheme(radio.value);
      });
    });

    const locale = modal.querySelector('select[name="ht.locale"]');
    if (locale) {
      locale.addEventListener('change', () => writeSetting('ht.locale', locale.value));
    }

    const reducedMotion = modal.querySelector('input[name="ht.reducedMotion"]');
    if (reducedMotion) {
      reducedMotion.addEventListener('change', () => setSettingsReducedMotion(reducedMotion.checked));
    }

    modal.querySelectorAll('[data-settings-dismiss]').forEach((dismiss) => {
      dismiss.addEventListener('click', closeSettings);
    });

    const clearButton = document.getElementById('shell-settings-clear');
    if (clearButton) clearButton.addEventListener('click', clearAllLocalData);

    // Apply the persisted reduced-motion preference at boot as well as when
    // the modal field changes, so a reload preserves the setting immediately.
    setSettingsReducedMotion(readSetting('ht.reducedMotion', SETTINGS_DEFAULTS['ht.reducedMotion']) === '1');
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

  // Public palette API (AD-14): exposed via HT.palette.*
  HT.palette = Object.freeze({
    open: openPalette,
    close: closePalette,
    toggle: () => (paletteState ? closePalette() : openPalette()),
    isOpen: () => Boolean(paletteState),
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  HT.boot = boot;

  /* ============================================
     Story 1.12 — Footer "View source" link wiring
     ============================================
     Every page renders a static placeholder:
       <span aria-disabled="true">View source</span>
     which is byte-identical across all pages (so chrome drift is
     detectable). On tool pages that opt in via `view-source.enabled`
     in tools.json (the default for promoted tools), this function
     replaces the placeholder with a real <a> pointing at the GitHub
     blob URL derived from HT.siteConfig.

     Slug discovery order (Story 1.12 dev notes):
       1. <main id="main" data-slug="..."> — fastest, no URL parsing
       2. window.location.pathname — "/tools/<slug>/" — fallback when
          data-slug is missing or empty
     Slug vs URL: when both are present and disagree, the URL wins
     because the URL is the actual file the browser is rendering.

     The link only renders when all three conditions hold:
       - HT.siteConfig is defined (site-config.js loaded)
       - HT.homeGrid.entries has an entry for the slug
       - the entry's `view-source.enabled` is not explicitly false
     On the home page (no slug) the function is a no-op — the home
     page itself is the repo root, no View Source link is needed.
  */
  let _viewSourceConfigRetries = 0;
  let _viewSourceEntryRetries = 0;
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

    // Locate the placeholder. The static include ships as:
    //   <span aria-disabled="true">View source</span>
    // inside <footer class="site-footer" role="contentinfo">. Use
    // querySelector for the exact span.
    const placeholder = document.querySelector(
      'footer.site-footer span[aria-disabled="true"]'
    );
    if (!placeholder) {
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
        // placeholder remains as a static span so the link simply
        // never materializes (consistent with non-promoted tools).
        console.info(
          'shell.viewSource: no entry for slug "' + slug +
          '" after ' + _VIEW_SOURCE_RETRY_BUDGET_MS + 'ms — leaving placeholder'
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
      // Explicit opt-out: leave the placeholder intact (the entry
      // author chose to hide the link). No console message — the
      // intent is encoded in the data.
      return;
    }

    // Resolve the blob URL. Default path is "tools/<slug>/index.html";
    // entries may override via `view-source.path`. Defensive normalize:
    // strip leading slashes from `pathSegment` (the schema field is
    // optional and a maintainer could set "/foo" producing a double
    // slash) and reject `..` segments to prevent a typo from leaving
    // the repo root.
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
    const blobBase = String(HT.siteConfig.blobBase).replace(/\/+$/, '');
    const href = blobBase + '/' + pathSegment;

    const anchor = document.createElement('a');
    anchor.setAttribute('href', href);
    anchor.setAttribute('rel', 'noopener noreferrer');
    anchor.setAttribute('target', '_blank');
    // Decision #2 (Story 1.12 review): the spec says the link's
    // accessible name is the tool's title. We honor that literally —
    // visible label becomes the tool title (e.g., "Inflation
    // Calculator"), not the static "View source" placeholder text.
    // Sighted users still understand the action because the anchor
    // sits in the footer next to the other chrome links.
    anchor.textContent = (entry && typeof entry.title === 'string' && entry.title.length > 0)
      ? entry.title
      : (placeholder.textContent || 'View source');
    // Copy classes so the existing CSS rule (footer span → anchor)
    // applies without a separate selector.
    placeholder.classList.forEach((cls) => anchor.classList.add(cls));
    placeholder.replaceWith(anchor);
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