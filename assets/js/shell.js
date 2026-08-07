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

    // Story 1.7: install the command palette wiring (skip entirely in
    // embed mode per AD-7 — the trigger is hidden and the chord is a no-op).
    if (!isEmbedMode()) {
      wirePalette();
      wireSettings();
    }
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
    const focusables = Array.from(panel.querySelectorAll(
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
    const keysToRemove = [];
    const namespaced = /^(ht|handy-tools)\./;
    try {
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key && namespaced.test(key)) keysToRemove.push(key);
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
      // Keep the FOUC IIFE on a stable plain-string value during reload.
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
})();