/* ============================================
   Handy Tools — home-sidebar.js
   Home page Recent-tools sidebar (Story 3.12).

   Renders the <ol class="recent-list"> in the home page sidebar by:
     1. Reading HT.recent.list() (already-published by recent.js).
     2. Resolving each slug's title from HT.homeGrid.entries (already-published
        by home-grid.js once the fetch lands).
     3. Hiding the <aside> when the list is empty OR when homeGrid.entries
        is still null (first render before the fetch resolves).

   Public API (AD-14): HT.homeSidebar = { render }.

   Boundaries:
     - Only reads from HT.recent and HT.homeGrid. No DOM identity, no
       mutation outside the <aside> + <ol> owned by the chrome include.
     - Idempotent: render() is safe to call multiple times; it diffs by
       replacing the <ol> children only.
     - Embed mode (?embed=1): no-op (the home page is not reachable in
       embed mode anyway).
   ============================================ */

(function () {
  'use strict';

  const VERSION = '1.0.0';
  const ASIDE_SELECTOR = '.home-sidebar';
  const LIST_SELECTOR = '.recent-list';

  function isEmbedMode() {
    try {
      return new URLSearchParams(window.location.search).get('embed') === '1';
    } catch (_) {
      return false;
    }
  }

  function resolveTitle(slug, entries) {
    if (!Array.isArray(entries)) return null;
    for (let i = 0; i < entries.length; i += 1) {
      const e = entries[i];
      if (e && e.slug === slug && typeof e.title === 'string') return e.title;
    }
    return null;
  }

  function buildItem(slug, title) {
    const li = document.createElement('li');
    li.className = 'recent-list-item';
    li.setAttribute('data-recent-slug', slug);
    const a = document.createElement('a');
    a.className = 'recent-list-link';
    a.href = 'tools/' + slug + '/index.html';
    a.textContent = title || slug;
    li.appendChild(a);
    return li;
  }

  function render() {
    if (isEmbedMode()) return;
    const aside = document.querySelector(ASIDE_SELECTOR);
    if (!aside) return;
    const list = aside.querySelector(LIST_SELECTOR);
    if (!list) return;

    const recent = (window.HT && window.HT.recent && typeof window.HT.recent.list === 'function')
      ? window.HT.recent.list()
      : [];
    if (!Array.isArray(recent) || recent.length === 0) {
      aside.setAttribute('hidden', '');
      while (list.firstChild) list.removeChild(list.firstChild);
      return;
    }

    const entries = (window.HT && window.HT.homeGrid && Array.isArray(window.HT.homeGrid.entries))
      ? window.HT.homeGrid.entries
      : null;

    // If entries isn't published yet, leave the list empty + hidden. The
    // home-grid render() is the trigger that calls back into here.
    if (!entries) {
      aside.setAttribute('hidden', '');
      return;
    }

    // Replace children — render() is idempotent.
    while (list.firstChild) list.removeChild(list.firstChild);
    for (let i = 0; i < recent.length; i += 1) {
      const slug = recent[i];
      const title = resolveTitle(slug, entries);
      list.appendChild(buildItem(slug, title));
    }
    aside.removeAttribute('hidden');
  }

  function publishApi() {
    window.HT = window.HT || {};
    window.HT.homeSidebar = Object.freeze({
      render: render,
      version: VERSION,
    });
  }

  function boot() {
    publishApi();
    // The home-grid render() is the data-arrival trigger. We patch it via
    // a microtask + a small retry loop so the sidebar renders as soon as
    // HT.homeGrid.entries is published without coupling the modules.
    let attempts = 0;
    const MAX_ATTEMPTS = 40;
    const RETRY_MS = 50;
    const tick = function () {
      const homeGrid = window.HT && window.HT.homeGrid;
      if (homeGrid && Array.isArray(homeGrid.entries)) {
        render();
        return;
      }
      attempts += 1;
      if (attempts >= MAX_ATTEMPTS) return;
      setTimeout(tick, RETRY_MS);
    };
    setTimeout(tick, 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
