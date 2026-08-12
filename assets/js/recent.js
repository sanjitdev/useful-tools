/* ============================================
   Handy Tools — recent.js
   Recent-tools FIFO list (Story 3.12).

   Data flow:
     - Storage key: 'handy-tools.recent' (array<string>, max 5).
     - All reads/writes route through HT.storage.get / HT.storage.set so the
       storage registry (Story 1.10) and the clear-all button (Story 3.5)
       continue to work without changes.
     - push(slug) is idempotent at the head: pushing the slug that's already
       at index 0 is a no-op (still writes the array, since the cost is one
       setItem and the write gives the registry a chance to broadcast).

   Public API (AD-14): HT.recent = { push, list, clear }.

   Boundaries:
     - No DOM. No fetch. No HT.homeGrid dependency.
     - No cross-tab sync (Epic 6 concern if needed).
     - Single IIFE; publishes the API on window.HT.recent before
       DOMContentLoaded so shell.js can call push() during boot.
   ============================================ */

(function () {
  'use strict';

  const STORAGE_KEY = 'handy-tools.recent';
  const RECENT_CAP = 5;

  function readArray() {
    try {
      const raw = window.HT && window.HT.storage && typeof window.HT.storage.get === 'function'
        ? window.HT.storage.get(STORAGE_KEY, [])
        : [];
      if (!Array.isArray(raw)) return [];
      return raw.filter(function (s) { return typeof s === 'string' && s.length > 0; });
    } catch (_) {
      return [];
    }
  }

  function writeArray(arr) {
    if (!window.HT || !window.HT.storage || typeof window.HT.storage.set !== 'function') {
      // Storage unavailable (offline, blocked, etc.) — fail silent. The list is
      // best-effort; the user-visible affordances (palette, sidebar) degrade
      // to empty when storage throws.
      return;
    }
    try {
      window.HT.storage.set(STORAGE_KEY, arr);
    } catch (_) {
      // Quota exceeded or write failure — fail silent. Same reason: the list
      // is best-effort and the user can recover by clearing site data.
    }
  }

  function push(slug) {
    if (typeof slug !== 'string' || slug.length === 0) return;
    const current = readArray();
    // UX-DR-11: duplicates are removed before the cap is enforced; the slug
    // we just visited goes to the head of the list.
    const dedup = [];
    for (let i = 0; i < current.length; i += 1) {
      if (current[i] === slug) continue;
      dedup.push(current[i]);
    }
    dedup.unshift(slug);
    const capped = dedup.slice(0, RECENT_CAP);
    writeArray(capped);
  }

  function list() {
    return readArray();
  }

  function clear() {
    writeArray([]);
  }

  // Frozen public surface (AD-14). Re-published on each boot in case another
  // script (HMR, duplicate include) tried to install first.
  function publishApi() {
    window.HT = window.HT || {};
    window.HT.recent = Object.freeze({
      push: push,
      list: list,
      clear: clear,
      cap: RECENT_CAP,
      key: STORAGE_KEY,
    });
  }

  // Boot: publish immediately so other Shell modules can call push() during
  // their own DOMContentLoaded handlers. No DOMContentLoaded dependency.
  publishApi();
})();
