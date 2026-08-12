/* ============================================
   Handy Tools — pins.js
   Pinned-tools map (Story 3.12).

   Data flow:
     - Storage key: 'handy-tools.pins' ({slug: ISO 8601 timestamp}, max 9).
     - All reads/writes route through HT.storage.get / HT.storage.set so the
       storage registry (Story 1.10) and the clear-all button (Story 3.5)
       continue to work without changes.
     - toggle(slug) is the single write path: it removes the slug if present,
       otherwise writes the current ISO timestamp. Returns the new boolean
       pinned state so the caller can update aria-pressed + icon character.

   Public API (AD-14): HT.pins = { toggle, list, isPinned, clear, orderByMostRecent }.

   Boundaries:
     - No DOM. No fetch. No HT.homeGrid dependency.
     - The map values are ISO 8601 timestamps; corrupt values (anything that
       fails `new Date(value).getTime()` is NaN) are dropped on list() to
       keep the home grid render deterministic.
     - Single IIFE; publishes the API on window.HT.pins before
       DOMContentLoaded so home-grid.js can call list() during boot.
   ============================================ */

(function () {
  'use strict';

  const STORAGE_KEY = 'handy-tools.pins';
  const PINS_CAP = 9;

  function readMap() {
    try {
      const raw = window.HT && window.HT.storage && typeof window.HT.storage.get === 'function'
        ? window.HT.storage.get(STORAGE_KEY, {})
        : {};
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
      // Drop any entries that don't have a valid ISO timestamp value.
      const clean = {};
      const keys = Object.keys(raw);
      for (let i = 0; i < keys.length; i += 1) {
        const k = keys[i];
        const v = raw[k];
        if (typeof v !== 'string') continue;
        const ts = new Date(v).getTime();
        if (Number.isNaN(ts)) continue;
        clean[k] = v;
      }
      return clean;
    } catch (_) {
      return {};
    }
  }

  function writeMap(obj) {
    if (!window.HT || !window.HT.storage || typeof window.HT.storage.set !== 'function') {
      return;
    }
    try {
      window.HT.storage.set(STORAGE_KEY, obj);
    } catch (_) {
      // Quota exceeded — fail silent.
    }
  }

  function isPinned(slug) {
    if (typeof slug !== 'string' || slug.length === 0) return false;
    const map = readMap();
    return Object.prototype.hasOwnProperty.call(map, slug);
  }

  function toggle(slug) {
    if (typeof slug !== 'string' || slug.length === 0) return false;
    const map = readMap();
    let nowPinned;
    if (Object.prototype.hasOwnProperty.call(map, slug)) {
      delete map[slug];
      nowPinned = false;
    } else {
      map[slug] = new Date().toISOString();
      nowPinned = true;
    }
    writeMap(map);
    return nowPinned;
  }

  function list() {
    return readMap();
  }

  function clear() {
    writeMap({});
  }

  function orderByMostRecent() {
    const map = readMap();
    const slugs = Object.keys(map);
    // Sort by ISO timestamp descending; ties broken by slug (stable, deterministic).
    slugs.sort(function (a, b) {
      const ta = new Date(map[a]).getTime();
      const tb = new Date(map[b]).getTime();
      if (tb !== ta) return tb - ta;
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });
    return slugs.slice(0, PINS_CAP);
  }

  function publishApi() {
    window.HT = window.HT || {};
    window.HT.pins = Object.freeze({
      toggle: toggle,
      list: list,
      isPinned: isPinned,
      clear: clear,
      orderByMostRecent: orderByMostRecent,
      cap: PINS_CAP,
      key: STORAGE_KEY,
    });
  }

  publishApi();
})();
