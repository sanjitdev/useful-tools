/* ============================================
   Handy Tools — layout.js
   Injects header + footer into every page
   ============================================ */

(() => {
  const brand = () =>
    `<a href="${isHome() ? '#top' : '../../index.html'}" class="brand">` +
    '<span class="brand-mark">H</span>' +
    '<span>Handy Tools</span>' +
    '</a>';

  const nav = () =>
    '<nav class="site-nav">' +
    `<a class="btn btn-ghost btn-sm" href="${isHome() ? '#top' : '../../index.html'}">Home</a>` +
    '<button class="theme-toggle" type="button" aria-label="Toggle theme">' +
      '<svg class="moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>' +
      '<svg class="sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>' +
    '</button>' +
    '</nav>';

  const isHome = () => {
    const path = location.pathname;
    return path.endsWith('/') || path.endsWith('/index.html') || path === '';
  };

  const header = () => `<div class="container">${brand()}${nav()}</div>`;

  const footer = () =>
    '<div class="container">' +
    `<span>© ${new Date().getFullYear()} Handy Tools. Built with vanilla JS.</span>` +
    `<span><a href="${isHome() ? '#top' : '../../index.html'}">Back to all tools</a></span>` +
    '</div>';

  const init = () => {
    const h = document.getElementById('site-header');
    if (h && !h.classList.contains('site-header')) {
      h.classList.add('site-header');
      h.innerHTML = header();
    }
    const f = document.getElementById('site-footer');
    if (f && !f.classList.contains('site-footer')) {
      f.classList.add('site-footer');
      f.innerHTML = footer();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
