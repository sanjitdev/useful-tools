/* ============================================
   Handy Tools — theme.js
   Light / dark theme toggle, persisted to localStorage
   ============================================ */

(function () {
  // ht.theme is grandfathered per AD-6 (ARCHITECTURE-SPINE.md line 109).
  // The FOUC IIFE in index.html:9 reads localStorage.getItem('ht.theme')
  // as a plain string (no JSON.parse). The storage-registry (Story 1.10)
  // does NOT police raw localStorage.getItem reads — the gate is
  // regex-based against HT.storage.* call sites only. Closing the FOUC
  // IIFE's raw read is out of scope for Story 1.10. The key below is
  // registered as ht.theme in assets/js/storage-registry.js.
  var KEY = 'ht.theme';

  function getPreferred() {
    var stored = HT.storage.get(KEY);
    if (stored) return stored;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var btn = document.querySelector('.theme-toggle');
    if (btn) {
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      btn.setAttribute('title', btn.getAttribute('aria-label'));
    }
  }

  function init() {
    if (window.__htShellReplacesTheme) {
      apply(getPreferred());
      return;
    }
    apply(getPreferred());
    document.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.theme-toggle');
      if (!btn) return;
      var current = document.documentElement.getAttribute('data-theme') || 'light';
      var next = current === 'dark' ? 'light' : 'dark';
      HT.storage.set(KEY, next);
      apply(next);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
