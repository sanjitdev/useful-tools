/* ============================================
   Handy Tools — packs/discovery-loader.js
   Story 10.6 (DC-5) — Discovery Pack loader.

   Tiny bridge module: registers HT.discovery.load +
   HT.discovery.list. Reads the canonical tools.json
   payload (file:// fallback via the inline block OR
   fetch('./tools.json') against the current page).
   Does NOT eagerly load scoring/results/challenge/
   recommend/catalog — each is page-conditional via
   the shell-thin Proxy factory (AD-14 + Story 4c).

   Surface (AD-14 boundary):
     HT.discovery.load(slug) → Promise<entry | null>
     HT.discovery.list()     → Promise<readonly[]>

   Constraints (architecture spine §"packs/discovery-loader.js"):
     * No SPA framework imports (no react/vue/svelte/htm)
     * No DOM mutation outside this IIFE
     * No localStorage writes (FR-33 — Challenge URL is
       the persistence layer)
     * No fetch outside the tools.json path
     * Bundle target ≤ 2 KB gz

   Smoke: scripts/_smoke_discovery_pack.js
   Gate:  scripts/dc/dc-5-loader.py
   ============================================ */

(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  var HT = (window.HT = window.HT || {});

  // Resolve tools.json: inline #ht-tools-json-inline block first
  // (Story 1.9 file:// fallback for the home grid), fetch fallback
  // when the inline block is absent (tool pages).
  function resolveToolsJson() {
    var inline = (typeof document !== 'undefined')
      && document.getElementById
      && document.getElementById('ht-tools-json-inline');
    if (inline && inline.textContent) {
      try { return Promise.resolve(JSON.parse(inline.textContent)); }
      catch (e) { return Promise.reject(e); }
    }
    if (typeof fetch !== 'function') {
      return Promise.reject(new Error('no inline tools.json + no fetch'));
    }
    // Script-relative URL — fix the home-grid relative-fetch bug
    // (Story 1.11): resolve against this script's URL, not the page.
    var url = (typeof document !== 'undefined' && document.currentScript)
      ? document.currentScript.src.replace(/[^/]*$/, 'tools.json')
      : './tools.json';
    return fetch(url, { credentials: 'same-origin' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
        return r.json();
      });
  }

  // Cache the parsed discovery block for the page lifetime.
  var _cache = null;
  function _loadToolsJson() {
    if (_cache) return _cache;
    _cache = resolveToolsJson().then(function (payload) {
      var packs = (payload && payload.packs) || {};
      var disc = packs.discovery || {};
      var entries = Array.isArray(disc.entries) ? disc.entries : [];
      for (var i = 0; i < entries.length; i += 1) {
        entries[i] = Object.freeze(entries[i]);
      }
      return Object.freeze({
        slug: disc.slug || 'discovery',
        title: disc.title || 'Discover Me',
        description: disc.description || '',
        loader: disc.loader || '',
        entries: Object.freeze(entries),
      });
    });
    return _cache;
  }

  function list() {
    return _loadToolsJson().then(function (registry) {
      var out = [];
      for (var i = 0; i < registry.entries.length; i += 1) {
        var e = registry.entries[i];
        out.push({
          slug: e.slug,
          title: e.title,
          emoji: e.emoji || '',
          category: e.category || 'viral',
          modules: Array.isArray(e.modules) ? e.modules : [],
        });
      }
      return Object.freeze(out);
    });
  }

  function load(quizSlug) {
    return _loadToolsJson().then(function (registry) {
      for (var i = 0; i < registry.entries.length; i += 1) {
        if (registry.entries[i].slug === quizSlug) return registry.entries[i];
      }
      return null;
    });
  }

  // AD-14: writable:false, configurable:false.
  try {
    Object.defineProperty(HT, 'discovery', {
      value: Object.freeze({ load: load, list: list }),
      writable: false,
      configurable: false,
      enumerable: true,
    });
  } catch (e) { /* HT may already be frozen — best-effort */ }
})();