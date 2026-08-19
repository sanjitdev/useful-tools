/* ============================================
   Handy Tools — help-overlay.js (FR-7, UX-DR-3, UX-DR-6, Story 3.3)
   Per-tool keyboard shortcuts overlay.

   Shell-owned (lives in assets/js/) per AD-14 + AD-4 + AD-13: the
   help overlay is a single shared DOM node mounted on every page by
   assets/shell/help.html. Tools never own global chrome.

   Entry points (3):
     1. document keydown `?` (capture phase) — defense-in-depth so
        tool-page handlers can't preventDefault. Modifier-guarded
        (no Ctrl/Meta/Alt) and text-input-guarded (early-returns if
        focus is in an input/textarea/select/contenteditable).
        Embed-mode guarded (no-op when ?embed=1 is in the URL).
     2. window `ht:palette-help` CustomEvent — emitted by
        HT.palette.openHelp() in assets/js/shell.js (Story 3.2).
        The existing palette chord (`?` inside the palette input)
        fires this emitter; Story 3.3 is the listener.
     3. Programmatic `window.HT_HELP_OVERLAY_INIT.open()` /
        `.close()` / `.toggle()` — used by the smoke harness.

   UX-DR-3 (EXPERIENCE.md:422): the overlay is NON-MODAL — no focus
   trap, Tab moves focus OUT of the overlay into the page beneath.
   Closing restores focus to the calling element.

   Public API: window.HT_HELP_OVERLAY_INIT = Object.freeze({
     shortcuts: <readonly global shortcut list>,
     search:    <filter function — substring match on label + keys>,
     open:      <programmatic open — used by smoke harness>,
     close:     <programmatic close>,
     toggle:    <programmatic toggle>,
     isOpen:    <boolean predicate>,
     version:   <story version string>
   })

   The module does NOT expose `HT.helpOverlay.*` (no Shell Public API
   surface this story adds — see AD-14 freeze). The `HT_HELP_OVERLAY_INIT`
   handle is the only contract for the smoke harness.
   ============================================ */

(function () {
  'use strict';

  /* ---- helpers: defensive lookups ---- */

  function detectMac() {
    try {
      return /Mac/i.test(
        (window.navigator && window.navigator.platform) ||
          (window.navigator && window.navigator.userAgent) ||
          ''
      );
    } catch (_) {
      return false;
    }
  }

  // Platform-detected once at boot per AC-8. Module-level constant;
  // never re-read navigator on each render row.
  var IS_MAC = false;

  function isEmbedMode() {
    try {
      if (window.HT_SHELL_EMBED === 1) return true;
      var search = (window.location && window.location.search) || '';
      return /(?:^|[?&])embed=1(?:&|$)/.test(search);
    } catch (_) {
      return false;
    }
  }

  function isTextInputFocus() {
    try {
      var el = document.activeElement;
      if (!el || el === document.body) return false;
      var tag = (el.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      if (el.isContentEditable === true) return true;
      return false;
    } catch (_) {
      return false;
    }
  }

  function getHelpRoot() {
    return document.getElementById('help');
  }

  function getSearchInput() {
    return document.getElementById('help-search');
  }

  function getLiveRegion() {
    return document.getElementById('help-live');
  }

  function getToolSection() {
    return document.getElementById('help-tool');
  }

  function getToolList() {
    return document.getElementById('help-tool-list');
  }

  function getGlobalSection() {
    return document.getElementById('help-global');
  }

  function getGlobalList() {
    return document.getElementById('help-global-list');
  }

  function getEmptyState() {
    return document.getElementById('help-empty');
  }

  function getCloseButton() {
    return document.querySelector('#help .help-close');
  }

  function getCurrentSlug() {
    try {
      var main = document.querySelector('main[data-slug]');
      if (main) {
        var s = main.getAttribute('data-slug');
        if (s && s.length) return s;
      }
    } catch (_) {
      /* no-op */
    }
    return '';
  }

  // resolveToolEntry: locate the slug in HT.homeGrid.entries (preferred)
  // or in the inline tools.json block. Mirrors shell.js's findToolEntry
  // pattern (line 1788) but operates at the global scope — we cannot
  // reach the shell.js IIFE-scoped helper from outside. The inline
  // fallback is what tool pages rely on (home-grid.js does not load
  // there).
  function resolveToolEntry(slug) {
    if (!slug) return null;
    try {
      if (
        window.HT &&
        window.HT.homeGrid &&
        Array.isArray(window.HT.homeGrid.entries)
      ) {
        for (var i = 0; i < window.HT.homeGrid.entries.length; i += 1) {
          var e = window.HT.homeGrid.entries[i];
          if (e && e.slug === slug) return e;
        }
      }
      var inline = document.getElementById('ht-tools-json-inline');
      if (inline) {
        try {
          var parsed = JSON.parse(inline.textContent || '');
          if (parsed && Array.isArray(parsed.tools)) {
            for (var j = 0; j < parsed.tools.length; j += 1) {
              var t = parsed.tools[j];
              if (t && t.slug === slug) return t;
            }
          }
        } catch (_) {
          /* malformed inline JSON: silent fall-through */
        }
      }
    } catch (_) {
      /* defensive: any unexpected error → return null */
    }
    return null;
  }

  /* ---- key glyph helpers ---- */

  function modKey() {
    return IS_MAC ? '⌘' : 'Ctrl';
  }

  function kbdGlyphs(keys) {
    var out = [];
    for (var i = 0; i < keys.length; i += 1) {
      var k = keys[i];
      if (typeof k !== 'string') continue;
      // The 'Mod' token is a runtime placeholder — swap for the
      // platform-correct modifier glyph once, at render time. Hardcoded
      // '⌘' / 'Ctrl' tokens pass through unchanged.
      if (k === 'Mod') {
        out.push(modKey());
      } else {
        out.push(k);
      }
    }
    return out;
  }

  function renderRow(keys, label) {
    var li = document.createElement('li');
    li.className = 'shell-help-row';
    li.setAttribute('role', 'listitem');
    var glyphs = kbdGlyphs(keys);
    for (var i = 0; i < glyphs.length; i += 1) {
      var k = document.createElement('kbd');
      k.className = 'shell-help-kbd';
      k.textContent = glyphs[i];
      li.appendChild(k);
      if (i < glyphs.length - 1) {
        var sep = document.createElement('span');
        sep.className = 'shell-help-sep';
        sep.setAttribute('aria-hidden', 'true');
        sep.textContent = '+';
        li.appendChild(sep);
      }
    }
    var txt = document.createElement('span');
    txt.className = 'shell-help-label';
    txt.textContent = label;
    li.appendChild(txt);
    // Search data: the filter reads `dataset.search` so the substring
    // match doesn't have to re-derive the rendered glyphs.
    li.dataset.search = (glyphs.join(' ') + ' ' + label).toLowerCase();
    return li;
  }

  /* ---- global shortcut list ---- */

  // Hardcoded single source of truth for "discoverable" shortcuts per
  // UX-DR-6.5. Each entry has { keys: string[], label: string }.
  // Modifiers are placeholders ('Mod') — render time swaps for the
  // platform-correct glyph via kbdGlyphs(). The matcher uses the same
  // array via the `shortcuts` export on HT_HELP_OVERLAY_INIT.
  var GLOBAL_SHORTCUTS = Object.freeze([
    // Story 10.20: the Cmd+K chord now opens the inline header search
    // (tools only, top-8). Cmd+Shift+K opens the modal palette overlay
    // (tools + actions). The "Mod+K" entry still describes the primary
    // discovery surface — the inline search — so the label is updated
    // to reflect the new UX.
    Object.freeze({ keys: Object.freeze(['Mod', 'K']), label: 'Open search' }),
    Object.freeze({ keys: Object.freeze(['Mod', 'Shift', 'K']), label: 'Open advanced search' }),
    Object.freeze({ keys: Object.freeze(['?']), label: 'Toggle this help overlay' }),
    Object.freeze({ keys: Object.freeze(['Esc']), label: 'Close overlay / dialog' }),
    Object.freeze({ keys: Object.freeze(['g', 'h']), label: 'Go to home' }),
    Object.freeze({ keys: Object.freeze(['g', 'p']), label: 'Go to packs' }),
    Object.freeze({ keys: Object.freeze(['g', 'q']), label: 'Go to quality' }),
    Object.freeze({ keys: Object.freeze(['g', 'v']), label: 'Go to privacy' }),
    Object.freeze({ keys: Object.freeze(['g', 's']), label: 'Go to settings' }),
    Object.freeze({ keys: Object.freeze(['t']), label: 'Cycle theme' }),
    Object.freeze({ keys: Object.freeze(['/']), label: 'Focus this overlay\'s search' }),
  ]);

  /* ---- per-tool shortcut normalization ---- */

  // Normalize a tools.json `shortcuts` entry into the row shape:
  // { keys: string[], label: string }. Each entry may carry
  // { key, label, action } (single-key) or { keys: [..], label, action }
  // (chord). Defensive: malformed entries are skipped.
  function normalizeToolShortcuts(raw) {
    if (!Array.isArray(raw)) return [];
    var out = [];
    for (var i = 0; i < raw.length; i += 1) {
      var e = raw[i];
      if (!e || typeof e !== 'object') continue;
      var label = typeof e.label === 'string' ? e.label : '';
      if (!label) continue;
      if (Array.isArray(e.keys) && e.keys.length) {
        out.push({
          keys: e.keys.slice(),
          label: label,
          action: typeof e.action === 'string' ? e.action : '',
        });
      } else if (typeof e.key === 'string' && e.key.length) {
        out.push({
          keys: [e.key],
          label: label,
          action: typeof e.action === 'string' ? e.action : '',
        });
      }
    }
    return out;
  }

  /* ---- filter ---- */

  function search(rows, query) {
    if (!Array.isArray(rows)) return [];
    if (typeof query !== 'string') return rows.slice();
    var q = query.trim().toLowerCase();
    if (!q) return rows.slice();
    var out = [];
    for (var i = 0; i < rows.length; i += 1) {
      var r = rows[i];
      if (!r) continue;
      var hay = '';
      if (Array.isArray(r.keys)) hay += r.keys.join(' ') + ' ';
      hay += r.label || '';
      if (hay.toLowerCase().indexOf(q) !== -1) out.push(r);
    }
    return out;
  }

  /* ---- state ---- */

  var openState = false;
  var callingElement = null;
  var debounceTimer = 0;

  function announceVisibleCount() {
    var live = getLiveRegion();
    if (!live) return;
    var rows = visibleRows();
    live.textContent = rows.length === 1 ? '1 shortcut shown' : rows.length + ' shortcuts shown';
  }

  function visibleRows() {
    var rows = [];
    var toolList = getToolList();
    if (toolList) {
      var toolLi = toolList.querySelectorAll('li');
      for (var i = 0; i < toolLi.length; i += 1) {
        if (!toolLi[i].hasAttribute('hidden')) rows.push(toolLi[i]);
      }
    }
    var globalList = getGlobalList();
    if (globalList) {
      var globalLi = globalList.querySelectorAll('li');
      for (var j = 0; j < globalLi.length; j += 1) {
        if (!globalLi[j].hasAttribute('hidden')) rows.push(globalLi[j]);
      }
    }
    return rows;
  }

  function applyFilter(query) {
    var toolSection = getToolSection();
    var toolList = getToolList();
    var globalSection = getGlobalSection();
    var globalList = getGlobalList();
    var empty = getEmptyState();
    var q = typeof query === 'string' ? query : '';
    var toolRows = toolSection && !toolSection.hasAttribute('hidden') && toolList
      ? Array.prototype.slice.call(toolList.querySelectorAll('li'))
      : [];
    var globalRows = globalList
      ? Array.prototype.slice.call(globalList.querySelectorAll('li'))
      : [];
    var matchCount = 0;
    for (var i = 0; i < toolRows.length; i += 1) {
      var hay = (toolRows[i].dataset && toolRows[i].dataset.search) || '';
      if (!q || hay.indexOf(q.toLowerCase()) !== -1) {
        toolRows[i].removeAttribute('hidden');
        matchCount += 1;
      } else {
        toolRows[i].setAttribute('hidden', '');
      }
    }
    for (var j = 0; j < globalRows.length; j += 1) {
      var hay2 = (globalRows[j].dataset && globalRows[j].dataset.search) || '';
      if (!q || hay2.indexOf(q.toLowerCase()) !== -1) {
        globalRows[j].removeAttribute('hidden');
        matchCount += 1;
      } else {
        globalRows[j].setAttribute('hidden', '');
      }
    }
    if (empty) {
      if (q && matchCount === 0) {
        empty.textContent = "No shortcuts match '" + q + "'";
        empty.removeAttribute('hidden');
      } else {
        empty.setAttribute('hidden', '');
        empty.textContent = 'No shortcuts match.';
      }
    }
    announceVisibleCount();
  }

  function debounceApplyFilter(query) {
    if (debounceTimer) {
      try { clearTimeout(debounceTimer); } catch (_) { /* no-op */ }
      debounceTimer = 0;
    }
    debounceTimer = setTimeout(function () {
      debounceTimer = 0;
      applyFilter(query);
    }, 50);
  }

  /* ---- render ---- */

  function renderSection(listEl, rows) {
    if (!listEl) return;
    // Clear children without losing event listeners on the list itself.
    while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
    for (var i = 0; i < rows.length; i += 1) {
      var r = rows[i];
      listEl.appendChild(renderRow(r.keys, r.label));
    }
  }

  function renderAll() {
    var toolSection = getToolSection();
    var toolList = getToolList();
    var globalList = getGlobalList();
    if (globalList) renderSection(globalList, GLOBAL_SHORTCUTS);

    var slug = getCurrentSlug();
    var entry = slug ? resolveToolEntry(slug) : null;
    var toolRows = entry ? normalizeToolShortcuts(entry.shortcuts) : [];

    if (toolSection && toolList) {
      if (toolRows.length) {
        renderSection(toolList, toolRows);
        toolSection.removeAttribute('hidden');
      } else {
        while (toolList.firstChild) toolList.removeChild(toolList.firstChild);
        toolSection.setAttribute('hidden', '');
      }
    }
  }

  /* ---- open / close / toggle ---- */

  function focusHeading(root) {
    try {
      var h = root.querySelector('#help-title');
      if (h && typeof h.focus === 'function') {
        // prefer-reduced-motion and the spec's "focus the heading on
        // overlay open" both imply that a scroll-jump on focus is
        // undesirable. preventScroll is widely supported (Chromium,
        // Firefox, Safari 14.1+).
        h.focus({ preventScroll: true });
      }
    } catch (_) {
      /* defensive: preventScroll is not supported everywhere */
    }
  }

  function openHelp() {
    if (openState) return;
    var root = getHelpRoot();
    if (!root) return;
    openState = true;
    try {
      callingElement = document.activeElement || null;
    } catch (_) {
      callingElement = null;
    }
    renderAll();
    root.removeAttribute('hidden');
    root.setAttribute('aria-hidden', 'false');
    focusHeading(root);
    document.addEventListener('keydown', onOverlayKeydown, true);
    document.addEventListener('mousedown', onOverlayClickOutside, true);
  }

  function closeHelp() {
    if (!openState) return;
    var root = getHelpRoot();
    openState = false;
    if (root) {
      root.setAttribute('hidden', '');
      root.setAttribute('aria-hidden', 'true');
    }
    document.removeEventListener('keydown', onOverlayKeydown, true);
    document.removeEventListener('mousedown', onOverlayClickOutside, true);
    // Cancel any pending debounced filter apply — typing then closing
    // within 50ms used to leak a timer that fired on hidden DOM.
    if (debounceTimer) {
      try { clearTimeout(debounceTimer); } catch (_) { /* no-op */ }
      debounceTimer = 0;
    }
    // Clear filter state so a future open starts unfiltered.
    var searchInput = getSearchInput();
    if (searchInput) searchInput.value = '';
    applyFilter('');
    var el = callingElement;
    callingElement = null;
    try {
      if (el && typeof el.focus === 'function' && document.contains(el)) {
        el.focus();
        return;
      }
    } catch (_) {
      /* fall through to main fallback */
    }
    try {
      var main = document.querySelector('main[tabindex="-1"]');
      if (main && typeof main.focus === 'function') main.focus();
    } catch (_) {
      /* no-op */
    }
  }

  function toggleHelp() {
    if (openState) closeHelp();
    else openHelp();
  }

  /* ---- overlay keydown + click-outside handlers ---- */

  function onOverlayKeydown(event) {
    if (!openState) return;
    if (!event) return;
    var key = event.key;
    if (key === 'Escape') {
      var searchInput = getSearchInput();
      var inSearch =
        searchInput &&
        document.activeElement === searchInput &&
        searchInput.value &&
        searchInput.value.length > 0;
      if (inSearch) {
        // Esc inside the search input clears the filter, does NOT close.
        searchInput.value = '';
        applyFilter('');
        if (typeof event.preventDefault === 'function') event.preventDefault();
        return;
      }
      if (typeof event.preventDefault === 'function') event.preventDefault();
      closeHelp();
      return;
    }
    if (key === '/' || key === 'Slash') {
      var search2 = getSearchInput();
      if (search2 && document.activeElement !== search2) {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        try { search2.focus(); } catch (_) { /* no-op */ }
      }
      return;
    }
    if (key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      // Modifier guard matches the document-level chord — Ctrl/Cmd/Alt+?
      // is a no-op even while the overlay is open, for consistency.
      if (typeof event.preventDefault === 'function') event.preventDefault();
      closeHelp();
    } else if (key === '?') {
      // Modifier held: prevent default so the chord doesn't insert a
      // literal '?' into the search input while overlay is open.
      if (typeof event.preventDefault === 'function') event.preventDefault();
    }
    // No focus trap: Tab is intentionally NOT handled here. UX-DR-3
    // requires Tab to leave the overlay and continue into the page
    // beneath.
  }

  function onOverlayClickOutside(event) {
    if (!openState) return;
    var root = getHelpRoot();
    if (!root) return;
    var target = event && event.target;
    if (!target) return;
    try {
      if (root.contains(target)) return;
    } catch (_) {
      /* root disconnected — close defensively */
    }
    closeHelp();
  }

  /* ---- document-level `?` chord ---- */

  function onDocumentKeydown(event) {
    if (!event) return;
    if (event.key !== '?') return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTextInputFocus()) return;
    if (isEmbedMode()) return;
    if (typeof event.preventDefault === 'function') event.preventDefault();
    toggleHelp();
  }

  /* ---- boot ---- */

  // AC-8 contract: platform detection happens once at module-init, not on
  // every render. Renderer reads the IS_MAC constant (modKey -> kbdGlyphs).
  IS_MAC = detectMac();

  function attachCloseButton() {
    var btn = getCloseButton();
    if (!btn) return;
    btn.addEventListener('click', function (event) {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      closeHelp();
    });
  }

  function attachSearchInput() {
    var input = getSearchInput();
    if (!input) return;
    input.addEventListener('input', function () {
      debounceApplyFilter(input.value || '');
    });
    input.addEventListener('keydown', function (event) {
      if (!event) return;
      if (event.key === 'Escape') {
        if (input.value && input.value.length > 0) {
          input.value = '';
          applyFilter('');
          if (typeof event.preventDefault === 'function') event.preventDefault();
        }
        // When the filter is already empty, let the document-level
        // handler close the overlay.
      }
    });
  }

  function boot() {
    if (isEmbedMode()) {
      // Defense-in-depth: even if the static markup slips past the
      // template, do not install listeners in embed mode. UX-DR-7.
      return;
    }
    attachCloseButton();
    attachSearchInput();
    document.addEventListener('keydown', onDocumentKeydown, true);
    // Story 3.2 contract: HT.palette.openHelp() dispatches a
    // 'ht:palette-help' CustomEvent on window. The overlay listener
    // toggles open/close.
    window.addEventListener('ht:palette-help', toggleHelp);
  }

  /* ---- public surface ---- */

  window.HT_HELP_OVERLAY_INIT = Object.freeze({
    shortcuts: GLOBAL_SHORTCUTS,
    search: search,
    open: openHelp,
    close: closeHelp,
    toggle: toggleHelp,
    isOpen: function () { return openState; },
    version: '3.3.0',
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
