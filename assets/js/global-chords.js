/* ============================================
   Handy Tools — global-chords.js (FR-7, AD-4, AD-14, Story 3.4)
   Document-level `g <key>` chord listener.

   Implements the cross-page navigation shortcuts listed in the help
   overlay's GLOBAL_SHORTCUTS (`assets/js/help-overlay.js:235-239`):

     g h  Go to home         →  /index.html
     g p  Go to packs        →  /index.html#packs
     g q  Go to quality      →  /quality.html
     g v  Go to privacy      →  /privacy
     g s  Open settings      →  HT.settings.open()

   Public API: none. AD-14 freezes HT.* — chord handlers route through
   existing AD-14 entry points (HT.settings.open) and window.location.assign.

   Internal contract: window.HT_GLOBAL_CHORDS_INIT = Object.freeze({
     chords: readonly array,
     cancel: function,
     version: string,
   })

   Boot runs after the help-overlay module (load order wired by
   scripts/shell-template.py). The chord listener installs once on
   document at capture phase (defense in depth — tool handlers can't
   preventDefault).

   Arm-then-fire model: pressing `g` (subject to all guards) arms the
   state for 1 second. The next keydown within that window for a
   mapped second key dispatches. Pressing Esc or calling
   HT_GLOBAL_CHORDS_INIT.cancel() clears the armed state.

   Suppressed when:
     - Focus is in a text input / textarea / select / contenteditable
     - Focus is inside an open <dialog>
     - URL has ?embed=1 (AD-7 embed mode)
     - Ctrl/Meta/Alt modifier on either the starter or the second key

   Settings (`g s`) does NOT navigate — it opens the modal. The four
   navigation chords use window.location.assign. `g h` while already
   on /index.html is a same-URL no-op (we early-return to avoid a
   jarring reload). `g p` navigates to /index.html#packs; if the
   anchor is missing on the page, the fragment is silently dropped.

   No localStorage writes. No telemetry. Pure procedural handler.
   ============================================ */

(function () {
  'use strict';

  /* ---- helpers ---- */

  // Text-input detection — use tagName strings (not instanceof HTMLInputElement)
  // so the smoke-harness vm context (where HTMLInputElement is undefined) and
  // older browsers without the typed-element globals both work. Mirrors
  // help-overlay.js:72-83.
  function isTextInputFocus() {
    try {
      var el = document.activeElement;
      if (!el || el === document.body) return false;
      var tag = (el.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      if (el.isContentEditable === true) return true;
      return false;
    } catch (_) {
      return false;
    }
  }

  // Walk up from `target` looking for an open <dialog>. Used to
  // suppress chords inside any modal (settings, share, help overlay).
  function isInDialog(target) {
    var node = target;
    while (node) {
      try {
        if (node.tagName === 'DIALOG' && node.open) return true;
      } catch (_) { /* node.tagName may throw on text nodes */ }
      node = node.parentNode || null;
    }
    return false;
  }

  function isEmbedMode() {
    try {
      var search = (typeof window !== 'undefined' && window.location && window.location.search) || '';
      // Mirror shell.js:220-226. URLSearchParams may be unavailable in
      // older runtimes / smoke-harness vm contexts — fall back to a
      // substring match so the embed guard still works defensively.
      if (typeof URLSearchParams === 'function') {
        return new URLSearchParams(search).get('embed') === '1';
      }
      return search.indexOf('embed=1') !== -1;
    } catch (_) {
      return false;
    }
  }

  function navigate(href) {
    try {
      if (typeof window !== 'undefined' && window.location && typeof window.location.assign === 'function') {
        window.location.assign(href);
      }
    } catch (e) {
      // Defensive: CSP or other security-policy blocks. The chord is
      // consumed regardless — we don't want a stuck armed state.
      console.warn('global-chords: navigation failed for', href, e);
    }
  }

  function callHt(namespace, method) {
    try {
      if (typeof window === 'undefined' || !window.HT) return false;
      var ns = window.HT[namespace];
      if (!ns || typeof ns[method] !== 'function') return false;
      ns[method]();
      return true;
    } catch (e) {
      console.warn('global-chords: HT.' + namespace + '.' + method + ' threw:', e);
      return false;
    }
  }

  /* ---- chord table ----
   *
   * Each entry maps a chord to its dispatch. `route` is the navigation
   * target (string) for navigation chords; null for non-navigation
   * chords (g s opens Settings modal). `goto` is computed once at
   * dispatch time so the same-URL early-return can inspect the live
   * pathname. The handle exposes the static array for tests + the
   * help-overlay renderer (future).
   */
  // Subpath-safe base resolver. global-chords.js is loaded from
  // <site-root>/assets/js/global-chords.js on every page (same depth as
  // shell.js). Walk up two directories from this script's URL to find
  // the site root so the chord targets work on github.io subpath
  // deployments (e.g. https://sanjitdev.github.io/useful-tools/).
  // Falls back to HT.__siteBase (set by shell.js) when currentScript is
  // unavailable (smoke harness, HMR); falls back to '/' when neither is
  // available so the chord still navigates somewhere reasonable.
  var CHORD_SCRIPT_URL = (function () {
    try {
      if (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) {
        return document.currentScript.src;
      }
    } catch (_) { /* no-op */ }
    return '';
  })();

  function chordBase() {
    if (CHORD_SCRIPT_URL) {
      try {
        return new URL('../../', CHORD_SCRIPT_URL).href;
      } catch (_) { /* fall through */ }
    }
    if (typeof window !== 'undefined' && window.HT && typeof window.HT.__siteBase === 'function') {
      try { return window.HT.__siteBase(); } catch (_) { /* fall through */ }
    }
    return '/';
  }

  var BASE = chordBase();

  var CHORDS = [
    Object.freeze({
      keys: Object.freeze(['g', 'h']),
      label: 'Go to home',
      route: BASE + 'index.html',
      goto: function () { navigate(BASE + 'index.html'); },
    }),
    Object.freeze({
      keys: Object.freeze(['g', 'p']),
      label: 'Go to packs',
      route: BASE + 'index.html#packs',
      goto: function () { navigate(BASE + 'index.html#packs'); },
    }),
    Object.freeze({
      keys: Object.freeze(['g', 'q']),
      label: 'Go to quality',
      route: BASE + 'quality.html',
      goto: function () { navigate(BASE + 'quality.html'); },
    }),
    Object.freeze({
      keys: Object.freeze(['g', 'v']),
      label: 'Go to privacy',
      route: BASE + 'privacy',
      goto: function () { navigate(BASE + 'privacy'); },
    }),
    Object.freeze({
      keys: Object.freeze(['g', 's']),
      label: 'Open settings',
      route: null,
      goto: function () { callHt('settings', 'open'); },
    }),
  ];

  // Build a lookup from second-key char → chord entry. The first key
  // is always 'g' (case-insensitive); the second key selects the chord.
  var CHORD_BY_SECOND = (function () {
    var out = Object.create(null);
    for (var i = 0; i < CHORDS.length; i += 1) {
      out[CHORDS[i].keys[1]] = CHORDS[i];
    }
    return out;
  })();

  /* ---- arm-then-fire state ---- */

  var ARM_DURATION_MS = 1000;
  var armedAt = null;
  var armTimer = null;

  function arm() {
    armedAt = (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now();
    if (armTimer !== null) clearTimeout(armTimer);
    armTimer = setTimeout(disarm, ARM_DURATION_MS);
  }

  function disarm() {
    armedAt = null;
    if (armTimer !== null) {
      clearTimeout(armTimer);
      armTimer = null;
    }
  }

  function isArmed() { return armedAt !== null; }

  function cancelArm() { disarm(); }

  /* ---- guard checks ---- */

  function hasModifier(event) {
    return event.ctrlKey === true || event.metaKey === true || event.altKey === true;
  }

  function isChordStarter(key) {
    return key === 'g' || key === 'G';
  }

  function isMappedSecondKey(key) {
    // Case-insensitive — second key may be lowercase or uppercase.
    return Object.prototype.hasOwnProperty.call(CHORD_BY_SECOND, key.toLowerCase());
  }

  /* ---- main handler ---- */

  function onKeydown(event) {
    var key = event.key;

    // Esc while armed → cancel (UX-DR-6 "Esc closes anything"). Don't
    // preventDefault — let other listeners (palette, settings, help
    // overlay) handle their own Esc semantics.
    if (key === 'Escape' && isArmed()) {
      disarm();
      return;
    }

    // Suppress everywhere these chords must not run.
    if (isEmbedMode()) return;
    if (hasModifier(event)) return;
    if (isTextInputFocus()) return;
    if (isInDialog(event.target)) return;

    // Disarm on any non-chord keypress while armed (e.g., user typed
    // `g` then started typing in a different input). This keeps the
    // state from leaking across unrelated actions.
    if (!isChordStarter(key) && !isArmed()) return;

    // Arm path: first key is `g`.
    if (isChordStarter(key) && !isArmed()) {
      arm();
      event.preventDefault();
      return;
    }

    // Re-arm path: pressing `g` while already armed resets the timer.
    // Avoids the "stale arm" footgun without double-dispatching.
    if (isChordStarter(key) && isArmed()) {
      arm();
      event.preventDefault();
      return;
    }

    // Second-key path: only reached when armed.
    if (isArmed()) {
      var lower = key.toLowerCase();
      var chord = CHORD_BY_SECOND[lower];
      if (chord) {
        // Same-URL early-return for navigation chords: avoid jarring
        // reload when the chord target matches the current pathname.
        if (chord.route !== null) {
          var currentPath = (typeof window !== 'undefined' && window.location && window.location.pathname) || '';
          var routePath = chord.route.split('?')[0].split('#')[0];
          if (currentPath === routePath) {
            disarm();
            event.preventDefault();
            return;
          }
        }
        disarm();
        event.preventDefault();
        chord.goto();
        return;
      }
      // Unmapped second key → silently cancel.
      disarm();
      // Don't preventDefault — let the typed character do its normal
      // thing if there's any text-input focus that slipped through.
    }
  }

  /* ---- boot ---- */

  function boot() {
    document.addEventListener('keydown', onKeydown, { capture: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  /* ---- public handle (internal contract — AD-14 freeze pattern) ---- */

  window.HT_GLOBAL_CHORDS_INIT = Object.freeze({
    chords: Object.freeze(CHORDS),
    cancel: cancelArm,
    version: '3.4.0',
  });
})();
