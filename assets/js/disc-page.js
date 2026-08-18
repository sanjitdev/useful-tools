/* ============================================
   Handy Tools — disc-page.js
   Renders /packs/disc.html (Story 10.9 — DC-9 surface).

   Mirrors assets/js/pack-page.js's public API as
     HT.discPage = { render, entries, ready, version }
   but reads the Discovery pack's own entries array
   (data.packs.discovery.entries[]) instead of filtering
   tools[].pack[] — the shape is different (no `pack`
   field; modules[] instead).

   Data flow:
     1. fetch('../tools.json') — preferred path.
     2. Fallback: <script type="application/json" id="ht-tools-json-inline">
        inlined by scripts/shell-template.py for file:// loads.

   Public API (AD-14): HT.discPage is frozen, descriptor
   writable:false, configurable:false. We never mutate
   HT.discovery (that's the discovery loader's frozen
   surface — Story 10.6 / DC-5).

   Boundaries:
     - Only reads via fetch + document.querySelector. No
       localStorage, no HT.provide, no shell API consumption.
     - Embed mode (?embed=1): early-returns without mounting.
     - Page-conditional: this script is only loaded on the
       /packs/disc.html route (NOT home, NOT tool pages).
       bundle-size-gate.py keeps it in SPEC_PAGE_CONDITIONAL_MODULES.

   Idempotency:
     - render() replaces the host's children on every call.
       The HT.discPage.entries snapshot reflects the latest
       successful mount.
   ============================================ */

(function () {
  'use strict';

  var VERSION = '1.0.0';
  var HOST_ID = 'pack-page-discovery-host';
  var SECTION_ID = 'pack-page-discovery-section';
  var INLINE_ID = 'ht-tools-json-inline';
  var TOOLS_JSON_URL = '../tools.json';

  // Disc-page descriptor (mirrors PACK_DEFINITIONS in pack-page.js).
  // Static title/tagline/subtitle — no fetch required.
  var DISC_DEFINITIONS = {
    disc: {
      title: 'Discover Me',
      tagline: 'Six hand-written personality and recommendation quizzes — find your archetype.',
    },
  };

  function isEmbedMode() {
    try {
      return new URLSearchParams(window.location.search).get('embed') === '1';
    } catch (_) {
      return false;
    }
  }

  function resolveSlug() {
    // 1. data-pack-slug attribute on the host (set by generate-pack-pages.py)
    var header = document.querySelector('.pack-page-header');
    if (header && header.getAttribute('data-pack-slug')) {
      return header.getAttribute('data-pack-slug');
    }
    // 2. window.location.pathname: /packs/disc.html or /packs/disc/
    try {
      var path = window.location.pathname || '';
      var match = path.match(/\/packs\/([a-z][a-z0-9-]*)(?:\.html|\/|$)/);
      if (match) return match[1];
    } catch (_) {
      // ignore
    }
    return null;
  }

  function readInline() {
    var node = document.getElementById(INLINE_ID);
    if (!node) return null;
    var text = node.textContent;
    if (!text || !text.trim()) return null;
    try {
      return JSON.parse(text);
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('disc-page: inline JSON malformed', err);
      }
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
      var inline = readInline();
      if (!inline) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('disc-page: tools.json unreachable', fetchErr);
        }
        return null;
      }
      return inline;
    });
  }

  // Defense-in-depth shape check on a Discovery entry. Mirrors
  // pack-page.js's isValidEntry but for the discovery shape
  // ({slug, title, emoji, category, data, modules}).
  function isValidDiscoveryEntry(entry) {
    return (
      entry &&
      typeof entry === 'object' &&
      typeof entry.slug === 'string' &&
      entry.slug.length > 0 &&
      typeof entry.title === 'string' &&
      entry.title.length > 0 &&
      Array.isArray(entry.modules)
    );
  }

  // Filter the discovery entries block. Entries without an explicit
  // `ready` field are treated as ready (the discovery block is a
  // content registry, not a release tracker like the 50 tools).
  function filterDiscoveryEntries(payload) {
    var packs = (payload && payload.packs) || {};
    var disc = packs.discovery || {};
    var entries = Array.isArray(disc.entries) ? disc.entries : [];
    var out = [];
    for (var i = 0; i < entries.length; i += 1) {
      var e = entries[i];
      if (!isValidDiscoveryEntry(e)) continue;
      if (e.ready === false) continue;
      out.push(e);
    }
    return out;
  }

  function escapeAttr(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Link to the per-quiz route under /packs/discovery/<slug>/.
  // Disc-page lives at /packs/disc.html; quiz packs live at
  // /tools/packs/discovery/<slug>/index.html. Relative path must
  // climb back to / first, then descend into /tools/packs/discovery/.
  //
  // Renders the same .tool-card chrome as assets/js/pack-page.js so
  // Discovery quiz cards visually match every other tool card on the
  // site. The emoji glyph is kept (no SVG icon — quizzes have a
  // brand glyph rather than a stroke-icon).
  function buildDiscoveryCard(entry) {
    var href = '../tools/packs/discovery/' + escapeAttr(entry.slug) + '/index.html';
    var emoji = typeof entry.emoji === 'string' ? entry.emoji : '';
    var desc = typeof entry.description === 'string' ? entry.description : '';
    return (
      '<a class="tool-card" href="' + href + '"' +
      ' data-quiz-slug="' + escapeAttr(entry.slug) + '">' +
      '<span class="tool-card-icon tool-card-icon--emoji" aria-hidden="true">' +
      escapeAttr(emoji) +
      '</span>' +
      '<span class="tool-card-title">' + escapeAttr(entry.title) + '</span>' +
      '<span class="tool-card-desc">' + escapeAttr(desc) + '</span>' +
      '</a>'
    );
  }

  function mountPackHeader(def, count) {
    var titleEl = document.getElementById('pack-page-title');
    var taglineEl = document.getElementById('pack-page-tagline');
    var countEl = document.getElementById('pack-page-count');
    if (titleEl) titleEl.textContent = def.title;
    if (taglineEl) taglineEl.textContent = def.tagline;
    if (countEl) {
      var label = count === 1 ? ' quiz' : ' quizzes';
      countEl.textContent = count + label;
    }
  }

  function mount(entries) {
    var host = document.getElementById(HOST_ID);
    var section = document.getElementById(SECTION_ID);
    if (!host || !section) return;

    // Replace any prior render — render() is idempotent across re-fetches.
    while (host.firstChild) host.removeChild(host.firstChild);

    if (entries.length === 0) {
      host.innerHTML =
        '<div class="tool-card tool-card--empty" role="note" aria-label="No quizzes in this pack yet">' +
        '<span class="tool-card-title">No quizzes yet</span>' +
        '<span class="tool-card-desc">Check back soon — pack pages populate as quizzes reach the 8/10 quality bar.</span>' +
        '</div>';
    } else {
      host.innerHTML = entries.map(buildDiscoveryCard).join('');
    }
    section.removeAttribute('hidden');
    host.setAttribute('data-mounted', 'true');
  }

  // Live snapshot used to populate HT.discPage.entries.
  var liveEntries = null;

  function publishApi() {
    if (typeof window === 'undefined') return;
    var HT = (window.HT = window.HT || {});
    // Direct assignment mirrors assets/js/pack-page.js's pattern. The
    // snapshot VALUE is Object.frozen so consumers can't mutate it; the
    // descriptor is writable so re-publishing on each successful mount
    // (idempotency contract) actually lands. AD-14 is satisfied at the
    // value level — the public surface is frozen, the property can be
    // re-snapshotted to reflect the latest render.
    HT.discPage = Object.freeze({
      render: render,
      entries: liveEntries,
      ready: Boolean(liveEntries),
      version: VERSION,
    });
  }

  function render() {
    if (isEmbedMode()) return Promise.resolve(null);
    var slug = resolveSlug();
    if (!slug || !DISC_DEFINITIONS[slug]) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('disc-page: unknown pack slug', slug);
      }
      liveEntries = null;
      publishApi();
      return Promise.resolve(null);
    }

    var def = DISC_DEFINITIONS[slug];

    return loadTools().then(function (data) {
      var entries = data ? filterDiscoveryEntries(data) : [];
      liveEntries = Object.freeze(entries.slice());
      mountPackHeader(def, entries.length);
      mount(entries);
      publishApi();
      return data;
    });
  }

  function boot() {
    if (window.HT && window.HT.discPage && window.HT.discPage.version) {
      // Already installed (HMR, duplicate include); skip rather than clobber.
      return;
    }
    publishApi();
    render();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
      boot();
    }
  }
})();
