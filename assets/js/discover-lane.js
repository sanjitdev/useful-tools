/* ============================================
   Handy Tools — discover-lane.js
   Renders the "Discover Me" lane on the home grid (Story 10.8).

   Mirrors assets/js/pack-grid.js's public API as
     HT.discoverLane = { render, count, ready, version }
   but reads the Discovery pack's own entries array
   (data.packs.discovery.entries[]) instead of tools[].pack[].

   Data flow:
     1. fetch('./tools.json') — preferred path (production + dev).
     2. Fallback: <script type="application/json" id="ht-tools-json-inline">
        inlined by scripts/shell-template.py for file:// loads where
        fetch throws a CORS/scheme error.

   Public API (AD-14): HT.discoverLane is frozen at the value level
   (mirrors pack-page.js / pack-grid.js pattern). The descriptor is
   writable so the renderer can re-snapshot on every successful mount.

   Boundaries:
     - Only reads via fetch + document.querySelector. No localStorage,
       no HT.provide, no shell API consumption.
     - Embed mode (?embed=1): early-returns without mounting.
     - The home page must NOT load the Discovery loader
       (assets/js/packs/discovery-loader.js) — this lane reads
       #ht-tools-json-inline directly. The loader is page-conditional
       per bundle-size-gate.py SPEC_PAGE_CONDITIONAL_MODULES.

   Idempotency:
     - render() replaces the host's children on every call.
       HT.discoverLane.count reflects the latest successful mount.
   ============================================ */

(function () {
  'use strict';

  var VERSION = '1.0.0';
  var HOST_ID = 'home-grid-discovery';
  var SECTION_ID = 'home-grid-discovery-section';
  var INLINE_ID = 'ht-tools-json-inline';
  var TOOLS_JSON_URL = './tools.json';

  function isEmbedMode() {
    try {
      return new URLSearchParams(window.location.search).get('embed') === '1';
    } catch (_) {
      return false;
    }
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
        console.warn('discover-lane: inline JSON malformed', err);
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
          console.warn(
            'discover-lane: tools.json unreachable, hiding lane',
            fetchErr
          );
        }
        return null;
      }
      return inline;
    });
  }

  // Defense-in-depth shape check on a Discovery entry.
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

  // Build a discovery-pack-card pointing at /packs/disc.html (the
  // destination pack page). The card itself is an `<a>` — clicking it
  // navigates to the destination, where assets/js/disc-page.js mounts
  // the per-quiz grid (Story 10.9).
  function buildDiscoveryCard(entry) {
    var emoji = typeof entry.emoji === 'string' ? entry.emoji : '';
    var category = typeof entry.category === 'string' ? entry.category : 'viral';
    return (
      '<a class="discovery-pack-card" href="./packs/disc.html"' +
      ' data-quiz-slug="' + escapeAttr(entry.slug) + '"' +
      ' aria-label="' + escapeAttr(entry.title) + ' — take the quiz">' +
      '<span class="emoji" aria-hidden="true">' + escapeAttr(emoji) + '</span>' +
      '<span class="title">' + escapeAttr(entry.title) + '</span>' +
      '<span class="badge">' + escapeAttr(category) + '</span>' +
      '</a>'
    );
  }

  function mount(entries) {
    var host = document.getElementById(HOST_ID);
    var section = document.getElementById(SECTION_ID);
    if (!host || !section) return;

    while (host.firstChild) host.removeChild(host.firstChild);

    if (entries.length === 0) {
      section.setAttribute('hidden', '');
      host.setAttribute('data-mounted', 'false');
      return;
    }

    host.innerHTML = entries.map(buildDiscoveryCard).join('');
    section.removeAttribute('hidden');
    host.setAttribute('data-mounted', 'true');
  }

  var liveCount = 0;

  function publishApi() {
    if (typeof window === 'undefined') return;
    var HT = (window.HT = window.HT || {});
    HT.discoverLane = Object.freeze({
      render: render,
      count: liveCount,
      ready: liveCount > 0,
      version: VERSION,
    });
  }

  function render() {
    if (isEmbedMode()) return Promise.resolve(null);
    return loadTools().then(function (data) {
      var entries = data ? filterDiscoveryEntries(data) : [];
      liveCount = entries.length;
      mount(entries);
      publishApi();
      return data;
    });
  }

  function boot() {
    if (window.HT && window.HT.discoverLane && window.HT.discoverLane.version) {
      // Another script (HMR, duplicate include) already installed the API;
      // skip rather than clobber.
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
