/* ============================================
   Grocery List — grocery-list-core.js (Story 4b Phase 4)
   Parse-time core: CATEGORIES, DEFAULT_CATEGORY, SAMPLE_ITEMS,
   DEBOUNCE_MS, makeId, encodeList, decodeList, readUrlState
   helpers, escapeHtml. The DOM-bound render() and DOM-mutating
   actions (addItem, toggleItem, actionPrint, actionShare,
   actionReset, actionSample, onOutputClick, onKeyDown, wire)
   move to ...-handlers.js and read state + helpers via
   HT.groceryListCore.

   Story 4b — see _bmad-output/implementation-artifacts/
   story-4b-per-tool-code-splitting.md
   ============================================ */

(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.HT) return;
  var HT = window.HT;

  // -------------------------------------------------------------
  // Constants
  // -------------------------------------------------------------

  var CATEGORIES = [
    'Produce', 'Dairy', 'Meat', 'Bakery',
    'Pantry', 'Frozen', 'Beverages', 'Other'
  ];
  var DEFAULT_CATEGORY = 'Other';
  var DEBOUNCE_MS = 150;

  // Sample list for "Try an example" — realistic mixed-category grocery run.
  var SAMPLE_ITEMS = [
    { name: 'Bananas', category: 'Produce' },
    { name: 'Spinach', category: 'Produce' },
    { name: 'Whole milk', category: 'Dairy' },
    { name: 'Greek yogurt', category: 'Dairy' },
    { name: 'Chicken breast', category: 'Meat' },
    { name: 'Sourdough bread', category: 'Bakery' },
    { name: 'Brown rice', category: 'Pantry' },
    { name: 'Olive oil', category: 'Pantry' },
    { name: 'Frozen peas', category: 'Frozen' },
    { name: 'Orange juice', category: 'Beverages' },
  ];

  // -------------------------------------------------------------
  // ID generation (ROQ-2)
  // Prefer crypto.randomUUID() when available; fall back to a Math.random
  // base-36 string. Both produce unique-enough IDs for in-memory use.
  // -------------------------------------------------------------

  function makeId() {
    try {
      if (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function') {
        var u = crypto.randomUUID();
        if (u) return String(u);
      }
    } catch (_) { /* fall through */ }
    return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  }

  // -------------------------------------------------------------
  // Base64 URL state (ROQ-3) — Unicode-safe per AC-3.
  // -------------------------------------------------------------

  function encodeList(arr) {
    try {
      var json = JSON.stringify({ items: arr });
      return btoa(unescape(encodeURIComponent(json)));
    } catch (_) {
      return '';
    }
  }

  function decodeList(b64) {
    try {
      var json = decodeURIComponent(escape(atob(b64)));
      var parsed = JSON.parse(json);
      if (!parsed || !Array.isArray(parsed.items)) return [];
      return parsed.items.filter(function (it) {
        return it && typeof it.name === 'string' && CATEGORIES.indexOf(it.category) >= 0;
      }).map(function (it) {
        return {
          id: typeof it.id === 'string' && it.id ? it.id : makeId(),
          name: String(it.name),
          category: String(it.category),
          checked: !!it.checked,
        };
      });
    } catch (_) {
      return [];
    }
  }

  function readUrlState(searchString) {
    try {
      var p = new URLSearchParams(searchString || window.location.search);
      return p.get('list');
    } catch (_) {
      return null;
    }
  }

  // -------------------------------------------------------------
  // Escape util (used by render() in handlers)
  // -------------------------------------------------------------

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // -------------------------------------------------------------
  // Reduced motion (ROQ-6)
  // -------------------------------------------------------------

  function isReducedMotion() {
    try {
      var root = document.documentElement;
      if (root && root.getAttribute('data-reduced-motion') === 'true') return true;
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      }
    } catch (_) {}
    return false;
  }

  // -------------------------------------------------------------
  // Expose data + helpers to handlers (AD-14 internal handle).
  // -------------------------------------------------------------
  HT.groceryListCore = Object.freeze({
    getCategories: function () { return CATEGORIES; },
    getDefaultCategory: function () { return DEFAULT_CATEGORY; },
    getDebounceMs: function () { return DEBOUNCE_MS; },
    getSampleItems: function () { return SAMPLE_ITEMS; },
    makeId: makeId,
    encodeList: encodeList,
    decodeList: decodeList,
    readUrlState: readUrlState,
    escapeHtml: escapeHtml,
    isReducedMotion: isReducedMotion,
  });

  // -------------------------------------------------------------
  // Boot — DOMContentLoaded → lazy-load handlers.js → init()
  // -------------------------------------------------------------
  function boot() {
    if (typeof HT.lazyLoadTool !== 'function') return;
    HT.lazyLoadTool('grocery-list', './grocery-list-handlers.js').then(function () {
      if (typeof window.groceryListInit === 'function') {
        try { window.groceryListInit(); }
        catch (err) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('grocery-list-core: groceryListInit threw', err);
          }
        }
      }
    }).catch(function (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('grocery-list-core: lazyLoadTool failed', err);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
