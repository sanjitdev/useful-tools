/* ============================================
   Handy Tools — palette-actions.js (FR-7, AD-14, Story 3.2)
   Static declaration of command-palette global actions.

   Shell-owned (lives in assets/js/) so Tools cannot add global actions
   to the registry per AD-14 bypass-prohibition. The matcher in
   assets/js/shell.js consumes this array at boot, populates the
   HT.palette._actions registry, and uses the keywords for substring
   filtering on user queries.

   Public API: window.HT_PALETTE_ACTIONS = readonly Array<{
     id: string,
     label: string,
     keywords: string[],
     icon: 'theme'|'settings'|'privacy'|'quality'|'clear'|'source'|'help',
     run: () => void | Promise<void>
   }>

   The 6 declared actions cover every Shell-level surface reachable
   from the chord layer per FR-7 (palette) and FR-8 (settings modal).
   The 7th entry (help.open) is the keyboard-help overlay action
   exposed via HT.palette.openHelp(); Story 3.3 will render the
   listener; the emitter is stable since Story 3.1.
   ============================================ */

(function () {
  'use strict';

  /* ---- helpers: deferred HT lookups with defensive defaults ---- */

  // Defensive call: if the target API isn't loaded yet (boot order
  // edge case), no-op + warn once. Returns true if the call ran.
  function safeCall(name, fn) {
    try {
      fn();
      return true;
    } catch (e) {
      console.warn('palette-actions.' + name + ' threw:', e);
      return false;
    }
  }

  function navigate(href) {
    try {
      if (typeof window !== 'undefined' && window.location && typeof window.location.assign === 'function') {
        window.location.assign(href);
      } else {
        console.warn('palette-actions: cannot navigate (window.location.assign unavailable)');
      }
    } catch (e) {
      console.warn('palette-actions.navigate threw:', e);
    }
  }

  /* ---- per-action handlers ---- */

  function runToggleTheme() {
    // HT.theme.cycle is exposed by shell.js (Story 3.2). Falls back to
    // a click on the .theme-toggle button if the public API is
    // unavailable (older shell bundles).
    if (typeof window !== 'undefined' && window.HT && window.HT.theme && typeof window.HT.theme.cycle === 'function') {
      safeCall('theme.cycle', function () { window.HT.theme.cycle(); });
      return;
    }
    const btn = document.querySelector('.theme-toggle');
    if (btn && typeof btn.click === 'function') btn.click();
    else console.warn('palette-actions.toggle.theme: HT.theme.cycle missing and no .theme-toggle button');
  }

  function runOpenSettings() {
    if (typeof window !== 'undefined' && window.HT && window.HT.settings && typeof window.HT.settings.open === 'function') {
      safeCall('settings.open', function () { window.HT.settings.open(); });
      return;
    }
    const btn = document.querySelector('.shell-settings');
    if (btn && typeof btn.click === 'function') btn.click();
    else console.warn('palette-actions.settings.open: HT.settings.open missing and no .shell-settings button');
  }

  function runOpenPrivacy() {
    // Matches the chrome.html footer link ("/privacy"). Both routes
    // resolve through the static server (no .html suffix) — see
    // assets/shell/chrome.html:41.
    navigate('/privacy');
  }

  function runOpenQuality() {
    navigate('/quality.html');
  }

  function runClearData() {
    // HT.settings.clearAll wraps clearAllLocalData with a confirm
    // dialog (per FR-8 "Clear all local data confirms twice"). The
    // dialog is owned by shell.js; this action just delegates.
    if (typeof window !== 'undefined' && window.HT && window.HT.settings && typeof window.HT.settings.clearAll === 'function') {
      safeCall('settings.clearAll', function () { window.HT.settings.clearAll(); });
      return;
    }
    console.warn('palette-actions.data.clear: HT.settings.clearAll unavailable — refusing to act');
    // No fallback to .settings-clear-button.click(): an un-confirmed
    // wipe of localStorage would violate FR-8. Surface a console.warn
    // and bail; do NOT auto-confirm.
  }

  function runViewSource() {
    // HT.viewSource.open is exposed by shell.js (Story 3.2). It
    // resolves the current tool slug and navigates to its blob URL.
    if (typeof window !== 'undefined' && window.HT && window.HT.viewSource && typeof window.HT.viewSource.open === 'function') {
      safeCall('viewSource.open', function () { window.HT.viewSource.open(); });
      return;
    }
    console.warn('palette-actions.source.view: HT.viewSource.open unavailable');
  }

  function runOpenHelp() {
    if (typeof window !== 'undefined' && window.HT && window.HT.palette && typeof window.HT.palette.openHelp === 'function') {
      safeCall('palette.openHelp', function () { window.HT.palette.openHelp(); });
      return;
    }
    console.warn('palette-actions.help.open: HT.palette.openHelp unavailable');
  }

  /* ---- the static declaration ---- */

  // Normalize keywords at module load so the matcher can do
  // O(actions × keywords) substring checks without re-normalizing
  // on every keystroke. Mirrors the normalize() in assets/js/search.js:
  // NFKD + strip combining marks + lowercase.
  function norm(s) {
    if (s === null || s === undefined) return '';
    try {
      return String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    } catch (_) {
      return String(s).toLowerCase();
    }
  }

  function buildKeywords() {
    var raw = [];
    for (var i = 0; i < arguments.length; i++) {
      var k = arguments[i];
      if (Array.isArray(k)) {
        for (var j = 0; j < k.length; j++) raw.push(k[j]);
      } else if (typeof k === 'string') {
        raw.push(k);
      }
    }
    var seen = Object.create(null);
    var out = [];
    for (var m = 0; m < raw.length; m++) {
      var n = norm(raw[m]);
      if (n && !seen[n]) {
        seen[n] = true;
        out.push(n);
      }
    }
    return Object.freeze(out);
  }

  var ACTIONS = [
    Object.freeze({
      id: 'theme.toggle',
      label: 'Toggle theme',
      keywords: buildKeywords('theme', 'dark', 'light', 'auto'),
      icon: 'theme',
      run: runToggleTheme,
    }),
    Object.freeze({
      id: 'settings.open',
      label: 'Open settings',
      keywords: buildKeywords('settings', 'preferences', 'options'),
      icon: 'settings',
      run: runOpenSettings,
    }),
    Object.freeze({
      id: 'privacy.open',
      label: 'Open privacy',
      keywords: buildKeywords('privacy', 'data', 'policy'),
      icon: 'privacy',
      run: runOpenPrivacy,
    }),
    Object.freeze({
      id: 'quality.open',
      label: 'Open quality',
      keywords: buildKeywords('quality', 'audit', 'rubric'),
      icon: 'quality',
      run: runOpenQuality,
    }),
    Object.freeze({
      id: 'data.clear',
      label: 'Clear all local data',
      keywords: buildKeywords('clear', 'reset', 'wipe', 'data'),
      icon: 'clear',
      run: runClearData,
    }),
    Object.freeze({
      id: 'source.view',
      label: 'View source for current tool',
      keywords: buildKeywords('source', 'view', 'github', 'code'),
      icon: 'source',
      run: runViewSource,
    }),
    Object.freeze({
      id: 'help.open',
      label: 'Show keyboard shortcuts',
      // Story 3.2-review patch #20: '?' removed from keywords. The
      // palette help chord (line 803-806 in shell.js) fires when the
      // user types '?' into the input; adding '?' here caused a
      // double-fire (palette filter matched AND the chord emitted).
      // The chord remains the canonical entry-point for the help
      // overlay; the keyword list still matches 'help' / 'shortcuts'.
      keywords: buildKeywords('help', 'shortcuts'),
      icon: 'help',
      run: runOpenHelp,
    }),
  ];

  window.HT_PALETTE_ACTIONS = Object.freeze(ACTIONS);
})();
