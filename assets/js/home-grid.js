/* ============================================
   Handy Tools — home-grid.js
   Renders the "From tools.json" section on the home page.

   Data flow:
     1. fetch('./tools.json') — preferred path (production + dev).
     2. Fallback: <script type="application/json" id="ht-tools-json-inline">
        inlined by scripts/shell-template.py for file:// loads where fetch
        throws a CORS/scheme error.

   Public API (AD-14): HT.homeGrid = { render, entries, ready, version }.

   Boundaries:
     - Only reads via fetch + document.querySelector. No localStorage,
       no HT.provide, no shell API consumption. (AD-13 / AD-14.)
     - The script tag is included on every page; the renderer early-returns
       unless the home-grid host element is present in the DOM.
     - Embed mode (?embed=1): early-returns without mounting.

   Idempotency:
     - render() checks the host element's data-mounted attribute; the
       API object is frozen once after the first successful render and
       re-frozen on every subsequent successful mount so the public
       snapshot reflects the latest data.
   ============================================ */

(function () {
  'use strict';

  const VERSION = '1.0.0';
  const HOST_ID = 'home-grid-tools-json';
  const SECTION_ID = 'home-grid-tools-json-section';
  const INLINE_ID = 'ht-tools-json-inline';
  const TOOLS_JSON_URL = './tools.json';
  const COMING_SOON_MS = 2400;

  // Defense-in-depth shape check — CI validates the schema upstream.
  // The renderer only enforces the minimum fields it reads.
  function isValidEntry(entry) {
    return (
      entry &&
      typeof entry === 'object' &&
      typeof entry.slug === 'string' &&
      entry.slug.length > 0 &&
      typeof entry.title === 'string' &&
      entry.title.length > 0 &&
      typeof entry.category === 'string' &&
      typeof entry.icon === 'string'
    );
  }

  function isEmbedMode() {
    try {
      return new URLSearchParams(window.location.search).get('embed') === '1';
    } catch (_) {
      return false;
    }
  }

  function readInline() {
    const node = document.getElementById(INLINE_ID);
    if (!node) return null;
    const text = node.textContent;
    if (!text || !text.trim()) return null;
    try {
      return JSON.parse(text);
    } catch (err) {
      console.warn('home-grid: inline JSON malformed', err);
      return null;
    }
  }

  function fetchToolsJson() {
    if (typeof fetch !== 'function') {
      return Promise.reject(new Error('fetch unavailable'));
    }
    return fetch(TOOLS_JSON_URL, { cache: 'no-cache' }).then(function (response) {
      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }
      return response.json();
    });
  }

  function loadTools() {
    return fetchToolsJson().catch(function (fetchErr) {
      // Fallback for file:// loads and 404s: use the inline JSON block
      // spliced into index.html by scripts/shell-template.py. If the
      // inline block is also missing, hide the section and warn once.
      const inline = readInline();
      if (!inline) {
        console.warn(
          'home-grid: tools.json unreachable, falling back to legacy section only',
          fetchErr
        );
        return null;
      }
      return inline;
    });
  }

  function dedupe(entries) {
    const seen = Object.create(null);
    const out = [];
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      if (!isValidEntry(entry)) {
        console.warn('home-grid: skipping entry with invalid shape', entry);
        continue;
      }
      if (seen[entry.slug]) {
        console.warn('home-grid: duplicate slug, rendering first', entry.slug);
        continue;
      }
      seen[entry.slug] = true;
      out.push(entry);
    }
    return out;
  }

  function groupByCategory(entries) {
    // Preserves first-seen order; categories inherit DOM order from tools.json.
    const groups = [];
    const indexByName = Object.create(null);
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      const category = entry.category || 'Other';
      let group = indexByName[category];
      if (group === undefined) {
        group = { name: category, entries: [] };
        indexByName[category] = groups.length;
        groups.push(group);
      }
      group.entries.push(entry);
    }
    return groups;
  }

  function escapeAttr(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function buildIconSpan(iconSrc) {
    // The icon is a data: URL or asset path — injected verbatim so the
    // browser renders the SVG inside the .tool-card-icon frame. The alt
    // attribute is empty (decorative icon; the title describes the card).
    return (
      '<span class="tool-card-icon"><img alt="" src="' +
      escapeAttr(iconSrc) +
      '" /></span>'
    );
  }

  function buildPinButton(entry) {
    // Story 3.12: star button per tool card. aria-pressed reflects the
    // current pin state; the icon character is ★ (filled, pinned) or
    // ☆ (empty, not pinned). The button is a SIBLING of the anchor
    // card (not nested) because nested interactive elements are not
    // allowed in HTML — the button calls preventDefault() + stopPropagation
    // to keep the anchor click handler from firing on toggles.
    const pinned = (window.HT && window.HT.pins && typeof window.HT.pins.isPinned === 'function')
      ? window.HT.pins.isPinned(entry.slug)
      : false;
    const icon = pinned ? '\u2605' : '\u2606';
    const label = pinned ? 'Unpin ' + entry.title : 'Pin ' + entry.title;
    return (
      '<button class="pin-toggle" type="button" aria-pressed="' +
      (pinned ? 'true' : 'false') +
      '" aria-label="' + escapeAttr(label) +
      '" data-pin-slug="' + escapeAttr(entry.slug) + '">' +
      '<span class="pin-toggle-icon" aria-hidden="true">' + icon + '</span>' +
      '</button>'
    );
  }

  function buildCard(entry) {
    if (entry.ready === false) {
      return (
        '<div class="tool-card tool-card--locked" role="group" aria-label="' +
        escapeAttr(entry.title) +
        ' (coming soon)" data-tool-slug="' +
        escapeAttr(entry.slug) +
        '" data-ready="false" tabindex="0">' +
        '<span class="tool-card-badge tool-card-badge--locked">Soon</span>' +
        buildIconSpan(entry.icon) +
        '<span class="tool-card-title">' +
        escapeAttr(entry.title) +
        '</span>' +
        '<span class="tool-card-desc">' +
        escapeAttr(entry.description || '') +
        '</span>' +
        '</div>'
      );
    }
    return (
      '<div class="tool-card-wrap" data-tool-slug="' +
      escapeAttr(entry.slug) +
      '">' +
      '<a class="tool-card" href="tools/' +
      escapeAttr(entry.slug) +
      '/index.html">' +
      buildIconSpan(entry.icon) +
      '<span class="tool-card-title">' +
      escapeAttr(entry.title) +
      '</span>' +
      '<span class="tool-card-desc">' +
      escapeAttr(entry.description || '') +
      '</span>' +
      '</a>' +
      buildPinButton(entry) +
      '</div>'
    );
  }

  function buildEmptyState() {
    return (
      '<div class="tool-card tool-card--empty" role="note" aria-label="No promoted tools yet">' +
      '<span class="tool-card-title">No promoted tools yet</span>' +
      '<span class="tool-card-desc">Tools land here when they reach the 8/10 quality bar.</span>' +
      '</div>'
    );
  }

  function buildGroupMarkup(group) {
    return (
      '<div class="home-grid-group" data-category="' +
      escapeAttr(group.name) +
      '">' +
      '<div class="category-header"><h2>' +
      escapeAttr(group.name) +
      '</h2></div>' +
      '<div class="tool-grid">' +
      group.entries.map(buildCard).join('') +
      '</div>' +
      '</div>'
    );
  }

  let activeNoticeTimer = null;
  function showComingSoon(card) {
    if (activeNoticeTimer !== null) {
      window.clearTimeout(activeNoticeTimer);
      const prior = card.parentNode && card.parentNode.querySelector('.home-grid-notice');
      if (prior) prior.remove();
    }
    const notice = document.createElement('div');
    notice.className = 'home-grid-notice';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    notice.textContent =
      (card.getAttribute('aria-label') || 'This tool') +
      ' is coming soon. Check back after the next release.';
    card.appendChild(notice);
    activeNoticeTimer = window.setTimeout(function () {
      if (notice.parentNode) notice.remove();
      activeNoticeTimer = null;
    }, COMING_SOON_MS);
  }

  function attachLockedHandlers(host) {
    // Click + keyboard activation on locked cards → inline "Coming soon"
    // notice via a transient inline message node. No navigation, no
    // /tools/<slug> GET fired.
    const cards = host.querySelectorAll('.tool-card--locked');
    for (let i = 0; i < cards.length; i += 1) {
      const card = cards[i];
      const announce = function (event) {
        event.preventDefault();
        showComingSoon(card);
      };
      card.addEventListener('click', announce);
      card.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          announce(event);
        }
      });
    }
  }

  // Story 3.12: pinned row markup. Renders the <ol class="pinned-row"> with
  // one <li> per pinned slug, ordered most-recent-pin-first. The title is
  // resolved from the liveEntries snapshot (tools.json) when available; a
  // missing slug falls back to the slug itself (defensive — the home grid
  // only renders seeds that already exist in tools.json today).
  const PINNED_SECTION_ID = 'home-grid-pinned-section';
  const PINNED_HOST_ID = 'home-grid-pinned';
  function buildPinnedRow(slugs) {
    if (!Array.isArray(slugs) || slugs.length === 0) return '';
    const items = slugs.map(function (slug) {
      const title = (Array.isArray(liveEntries) ? liveEntries : [])
        .filter(function (e) { return e && e.slug === slug; })
        .map(function (e) { return e.title; })[0] || slug;
      return (
        '<li class="pinned-row-item" data-pin-slug="' +
        escapeAttr(slug) +
        '">' +
        '<a class="pinned-row-link" href="tools/' +
        escapeAttr(slug) +
        '/index.html">' +
        escapeAttr(title) +
        '</a>' +
        '</li>'
      );
    }).join('');
    return (
      '<div class="category-header"><h2>Pinned</h2></div>' +
      '<ol class="pinned-row" aria-label="Pinned tools">' +
      items +
      '</ol>'
    );
  }

  function mountPinnedRow() {
    const host = document.getElementById(PINNED_HOST_ID);
    const section = document.getElementById(PINNED_SECTION_ID);
    if (!host || !section) return;
    const pins = (window.HT && window.HT.pins && typeof window.HT.pins.orderByMostRecent === 'function')
      ? window.HT.pins.orderByMostRecent()
      : [];
    if (!pins || pins.length === 0) {
      section.setAttribute('hidden', '');
      host.innerHTML = '';
      host.setAttribute('data-mounted', 'false');
      return;
    }
    host.innerHTML = buildPinnedRow(pins);
    section.removeAttribute('hidden');
    host.setAttribute('data-mounted', 'true');
  }

  function updatePinButton(slug) {
    // After a toggle, find every pin-toggle button for the slug (one in the
    // pinned row, one in the regular grid) and refresh its aria-pressed +
    // icon character. The HTTP-driven render is not re-fetched; only the
    // lightweight button state is updated.
    const buttons = document.querySelectorAll(
      '.pin-toggle[data-pin-slug="' + (window.CSS && CSS.escape ? CSS.escape(slug) : slug) + '"]'
    );
    const pinned = (window.HT && window.HT.pins && typeof window.HT.pins.isPinned === 'function')
      ? window.HT.pins.isPinned(slug)
      : false;
    for (let i = 0; i < buttons.length; i += 1) {
      const btn = buttons[i];
      btn.setAttribute('aria-pressed', pinned ? 'true' : 'false');
      const icon = btn.querySelector('.pin-toggle-icon');
      if (icon) icon.textContent = pinned ? '\u2605' : '\u2606';
      const title = (Array.isArray(liveEntries) ? liveEntries : [])
        .filter(function (e) { return e && e.slug === slug; })
        .map(function (e) { return e.title; })[0] || slug;
      btn.setAttribute('aria-label', pinned ? 'Unpin ' + title : 'Pin ' + title);
    }
  }

  function attachPinHandlers(host) {
    // Delegated click handler for every .pin-toggle inside the host. The
    // toggle runs HT.pins.toggle(slug), updates the button states, and
    // re-renders the pinned row (without re-fetching tools.json).
    if (!host || host.__pinHandlersAttached === true) return;
    host.addEventListener('click', function (event) {
      const btn = event.target.closest('.pin-toggle');
      if (!btn) return;
      const slug = btn.getAttribute('data-pin-slug');
      if (!slug || !window.HT || !window.HT.pins || typeof window.HT.pins.toggle !== 'function') return;
      event.preventDefault();
      event.stopPropagation();
      window.HT.pins.toggle(slug);
      updatePinButton(slug);
      mountPinnedRow();
    });
    host.__pinHandlersAttached = true;
  }

  function mount(data) {
    const host = document.getElementById(HOST_ID);
    const section = document.getElementById(SECTION_ID);
    if (!host || !section) return;
    // Replace any prior render — render() is idempotent across re-fetches.
    while (host.firstChild) host.removeChild(host.firstChild);

    if (!data || !Array.isArray(data.tools)) {
      section.setAttribute('hidden', '');
      host.setAttribute('data-mounted', 'false');
      mountPinnedRow();
      return;
    }

    const valid = dedupe(data.tools);
    if (valid.length === 0) {
      host.innerHTML = buildEmptyState();
      section.removeAttribute('hidden');
      host.setAttribute('data-mounted', 'true');
      mountPinnedRow();
      return;
    }

    const groups = groupByCategory(valid);
    host.innerHTML = groups.map(buildGroupMarkup).join('');
    attachLockedHandlers(host);
    attachPinHandlers(host);
    section.removeAttribute('hidden');
    host.setAttribute('data-mounted', 'true');
    mountPinnedRow();
  }

  // Live snapshot used to populate HT.homeGrid.entries. Updated on every
  // successful mount; stays null until the first successful fetch.
  let liveEntries = null;

  function publishApi() {
    // Re-freeze on every successful mount so the public API exposes the
    // latest snapshot. The shape is locked (Object.freeze) — the contents
    // of entries reflect the most recent fetch.
    window.HT = window.HT || {};
    window.HT.homeGrid = Object.freeze({
      render: render,
      entries: liveEntries,
      ready: Boolean(liveEntries),
      version: VERSION,
    });
  }

  function render() {
    if (isEmbedMode()) return Promise.resolve(null);
    return loadTools().then(function (data) {
      if (data && Array.isArray(data.tools)) {
        liveEntries = data.tools.filter(isValidEntry);
      } else {
        liveEntries = null;
      }
      mount(data);
      publishApi();
      return data;
    });
  }

  function boot() {
    if (window.HT && window.HT.homeGrid && window.HT.homeGrid.version) {
      // Another script (HMR, duplicate include) already installed the API;
      // skip rather than clobber.
      return;
    }
    publishApi();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
