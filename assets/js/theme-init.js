/* ============================================
   Handy Tools — theme-init.js
   Synchronous theme bootstrap. Runs in <head>
   BEFORE first paint so dark-mode users never
   see a white-then-dark flicker.
   ============================================ */
(function () {
  try {
    var stored = localStorage.getItem('ht.theme');
    var theme = stored || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
