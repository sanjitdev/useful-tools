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
      console.info('shell.search: pending Story 1.7');
      return;
    }

    if (target.classList.contains('shell-settings')) {
      console.info('shell.settings: pending Story 1.8');
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  HT.boot = boot;
})();