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

  function boot() {
    if (HT.__booted) return;
    HT.__booted = true;

    const main = document.getElementById('main');
    const explicit = main && main.getAttribute('data-page-label');
    if (main && explicit && !main.getAttribute('aria-label')) {
      main.setAttribute('aria-label', explicit);
    }

    HT.shell = Object.freeze({
      version: '1.0.0',
      loadedAt: performance.now(),
      theme: () => document.documentElement.getAttribute('data-theme'),
    });

    document.addEventListener('click', onClick);
    document.documentElement.addEventListener('ht:fouc-resolved', onFoucResolved);
    observeTheme();
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
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    try {
      window.HT.storage.set('ht.theme', next);
    } catch (_) {
      // localStorage may be unavailable (private mode); apply in-memory only.
    }
    document.documentElement.setAttribute('data-theme', next);
    // Update every .theme-toggle on the page (header + footer if both
    // exist). aria-pressed is the canonical state signal for screen
    // readers (Decision #2 from the code review); aria-label / title
    // continue to be human-readable labels.
    const buttons = document.querySelectorAll('.theme-toggle');
    const label = next === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
    const pressed = next === 'dark' ? 'true' : 'false';
    buttons.forEach((btn) => {
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
      btn.setAttribute('aria-pressed', pressed);
    });
  }

  function syncThemeToggleAria() {
    // Initial state on boot — keep aria-pressed in sync with the
    // data-theme attribute that the inline FOUC IIFE already set.
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const isDark = current === 'dark';
    const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';
    const pressed = isDark ? 'true' : 'false';
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
        }
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
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