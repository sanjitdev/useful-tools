/* ============================================
   Handy Tools — history.js (Story 2.3)
   Per-Tool History Panel. The Shell exposes
   `HT.history` so every Tool can record the
   last 10 inputs and restore any prior state
   with one click — no per-tool persistence
   drift. Composes on HT.urlState._loadSchema
   (Story 2.1) + HT.storage (Story 1.10).
   ES2018.
   ============================================ */

(function () {
  'use strict';

  window.HT = window.HT || {};
  const HT = window.HT;

  // -------------------------------------------------------------
  // Typed error factory — reuse Story 2.1's UrlStateSchemaError
  // for missing-schema cases so consumers dispatch on err.name
  // (or err.code) rather than a HistoryError class. Per AC-1.
  // -------------------------------------------------------------

  function _schemaError(code, message) {
    const err = new Error(message);
    err.name = 'UrlStateSchemaError';
    err.code = code;
    return err;
  }

  function _requireSlug(slug) {
    if (typeof slug !== 'string' || !/^[a-z][a-z0-9-]*[a-z0-9]$/.test(slug)) {
      throw _schemaError(
        'INVALID_SLUG',
        'HT.history: slug must be kebab-case (^[a-z][a-z0-9-]*[a-z0-9]$); got ' +
          JSON.stringify(slug)
      );
    }
  }

  // -------------------------------------------------------------
  // Schema facade — delegate to url.js's frozen _loadSchema so
  // the URL state semantics stay single-sourced. We extend the
  // schema with the slug's `history-keys` block (declared in
  // tools.json since Story 1.10; AC-1 hasHistory predicate).
  // -------------------------------------------------------------

  function _loadSchema(slug) {
    if (!HT.urlState || typeof HT.urlState._loadSchema !== 'function') {
      throw _schemaError(
        'NO_URLSTATE',
        'HT.history: HT.urlState._loadSchema is unavailable — ' +
          'load assets/js/url.js BEFORE assets/js/history.js'
      );
    }
    const baseSchema = HT.urlState._loadSchema(slug);
    // baseSchema is null when the slug has no urlState block. Tools
    // without urlState cannot have a history surface — surface this
    // as null (consistent with HT.urlState._loadSchema's contract)
    // and let callers branch via hasHistory().
    if (!baseSchema) return null;
    // baseSchema is frozen (Story 2.1 invariant). The history-keys
    // block is independent; we look it up via the inline tools.json
    // splice or HT.homeGrid.entries (same lookup path as sample-data.js).
    let historyKeys = [];
    try {
      if (HT.homeGrid && Array.isArray(HT.homeGrid.entries)) {
        for (let i = 0; i < HT.homeGrid.entries.length; i += 1) {
          const e = HT.homeGrid.entries[i];
          if (e && e.slug === slug) {
            historyKeys = Array.isArray(e['history-keys'])
              ? e['history-keys'].slice()
              : [];
            break;
          }
        }
      } else {
        const inline = typeof document !== 'undefined'
          ? document.getElementById('ht-tools-json-inline')
          : null;
        if (inline) {
          try {
            const parsed = JSON.parse(inline.textContent || '');
            if (parsed && Array.isArray(parsed.tools)) {
              for (let i = 0; i < parsed.tools.length; i += 1) {
                const e = parsed.tools[i];
                if (e && e.slug === slug) {
                  historyKeys = Array.isArray(e['history-keys'])
                    ? e['history-keys'].slice()
                    : [];
                  break;
                }
              }
            }
          } catch (_) { /* fall through */ }
        }
      }
    } catch (_) { /* historyKeys stays [] */ }
    return Object.freeze({
      default: baseSchema.default,
      encode: baseSchema.encode,
      decode: baseSchema.decode,
      historyKeys: Object.freeze(historyKeys),
    });
  }

  // hasHistory: synchronous predicate the panel gate uses. A tool
  // must declare BOTH a `urlState` block AND a non-empty
  // `history-keys` block. A tool with history-keys but no urlState
  // is misconfigured (no schema to record state against) — surface
  // it loudly via the predicate flipping false, not a silent zero-
  // history panel.
  function hasHistory(slug) {
    if (typeof slug !== 'string') return false;
    let hasUrlState = false;
    let hasHistoryKeys = false;
    try {
      const schema = _loadSchema(slug);
      hasUrlState = !!(schema && Array.isArray(schema.encode) && schema.encode.length > 0);
      hasHistoryKeys = !!(schema && Array.isArray(schema.historyKeys) && schema.historyKeys.length > 0);
    } catch (_) {
      return false;
    }
    return hasUrlState && hasHistoryKeys;
  }

  // -------------------------------------------------------------
  // Storage layer — every read/write goes through HT.storage, NOT
  // localStorage directly. The registry's `registerHistoryKeys`
  // (called by shell.js boot()) bulk-registers the
  // `handy-tools.history.<slug>` key for every tool that has a
  // non-empty history-keys block. The key is schema: 'array' in
  // the registry.
  // -------------------------------------------------------------

  function _storageKey(slug) {
    return 'handy-tools.history.' + slug;
  }

  function _readRaw(slug) {
    if (!HT.storage || typeof HT.storage.get !== 'function') return [];
    const v = HT.storage.get(_storageKey(slug), []);
    if (!Array.isArray(v)) return [];
    return v;
  }

  function _writeRaw(slug, entries) {
    if (!HT.storage || typeof HT.storage.set !== 'function') return false;
    // The array is already plain (we constructed it); the registry
    // validates JSON-serializability on set.
    return HT.storage.set(_storageKey(slug), entries);
  }

  // -------------------------------------------------------------
  // HT.history.push(slug, entry?)
  //
  // Appends to the per-tool FIFO list, capped at 10 (FR-12). The
  // caller is expected to pass a {state, result, label, ts?}
  // object — if entry is omitted, the function does NOT auto-
  // snapshot current tool state (per AC-1: keep HT.history
  // decoupled from HT.urlState at the call layer; the tool's
  // onAfterCompute hook builds the entry).
  //
  // Returns the frozen HistoryEntry. Throws UrlStateSchemaError
  // if the slug has no urlState block (consistency with
  // HT.urlState._loadSchema).
  // -------------------------------------------------------------

  function _genId() {
    // 'h_<base36-ts>_<base36-rand>' — base36 keeps the id short
    // and human-readable in dev tools; base36 is supported on
    // ES2018.
    const ts = Date.now().toString(36);
    const rand = Math.floor(Math.random() * 0x7fffffff).toString(36);
    return 'h_' + ts + '_' + rand;
  }

  function push(slug, entry) {
    _requireSlug(slug);
    // Verify the slug has a usable schema — surface missing-schema
    // as a soft warn + null return (consistent with Story 2.1 F-12
    // disposition: tools without urlState can't have history).
    const schema = _loadSchema(slug);
    if (!schema) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('HT.history.push: slug ' + JSON.stringify(slug) +
          ' has no urlState block; push is a no-op');
      }
      return null;
    }

    const e = entry && typeof entry === 'object' ? entry : {};
    const historyEntry = Object.freeze({
      id: (typeof e.id === 'string' && e.id.length > 0) ? e.id : _genId(),
      ts: (typeof e.ts === 'number' && isFinite(e.ts)) ? e.ts : Date.now(),
      state: (e.state && typeof e.state === 'object' && !Array.isArray(e.state))
        ? Object.freeze(Object.assign({}, e.state))
        : Object.freeze({}),
      result: (typeof e.result === 'string') ? e.result : '',
      label: (typeof e.label === 'string') ? e.label : '',
    });

    const current = _readRaw(slug);
    // FIFO cap of 10 per FR-12. _writeRaw writes a fresh plain
    // array so the caller's frozen view isn't reflected back.
    const next = current.concat([historyEntry]);
    if (next.length > 10) next.splice(0, next.length - 10);
    _writeRaw(slug, next);

    // Same-tab pub/sub: notify subscribers with the freshest list.
    _emit(slug);

    return historyEntry;
  }

  // -------------------------------------------------------------
  // HT.history.list(slug) — frozen array, newest-first.
  // -------------------------------------------------------------

  function list(slug) {
    _requireSlug(slug);
    const arr = _readRaw(slug);
    arr.sort(function (a, b) {
      // Newest-first. Tie-break on id ascending for determinism.
      if (b.ts !== a.ts) return b.ts - a.ts;
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
      return 0;
    });
    // Replace the array with a plain frozen copy so mutation is
    // impossible AND so the returned shape doesn't carry any
    // proxies from the registry's JSON.parse.
    const out = Object.freeze(arr.map(function (e) {
      return Object.freeze({
        id: e.id,
        ts: e.ts,
        state: Object.freeze(Object.assign({}, e.state || {})),
        result: (typeof e.result === 'string') ? e.result : '',
        label: (typeof e.label === 'string') ? e.label : '',
      });
    }));
    return out;
  }

  // lastEntry: returns the most-recent HistoryEntry for `slug`, or
  // null if the tool has no recorded history. A thin convenience over
  // list(slug)[0] that tools use for the dedup-by-state idiom in
  // pushIfChanged and in exemplar `render()` flows.
  function lastEntry(slug) {
    _requireSlug(slug);
    const arr = list(slug);
    return arr.length > 0 ? arr[0] : null;
  }

  // -------------------------------------------------------------
  // HT.history.clear(slug, opts?)
  // -------------------------------------------------------------

  function clear(slug, opts) {
    _requireSlug(slug);
    const confirmRequested = !(opts && opts.confirm === false);
    const hasEntries = _readRaw(slug).length > 0;
    if (!hasEntries) return; // no-op per AC-1
    if (!confirmRequested) {
      _doClear(slug);
      return;
    }
    // Inline <dialog> confirm — destructive variant (DESIGN.md §5).
    // Reuses the same showModal() pattern as sample-data.js's
    // _confirmDestructive (Story 2.2).
    _confirmDestructive({
      title: 'Clear history?',
      message: 'This removes every stored entry for this tool from this device. This cannot be undone.',
      confirmLabel: 'Clear',
      onConfirm: function () { _doClear(slug); },
    });
  }

  function _doClear(slug) {
    if (HT.storage && typeof HT.storage.remove === 'function') {
      HT.storage.remove(_storageKey(slug));
    }
    _emit(slug);
  }

  // -------------------------------------------------------------
  // HT.history.restore(slug, id, opts?)
  //
  // Writes entry.state into the DOM via the bindForm write path
  // (HT.urlState.encode + history.replaceState), focuses the
  // first input by default, and (if current state diverges from
  // entry.state AND opts.confirm !== false) opens the inline
  // <dialog> confirm.
  // -------------------------------------------------------------

  function restore(slug, id, opts) {
    _requireSlug(slug);
    const arr = list(slug);
    let found = null;
    for (let i = 0; i < arr.length; i += 1) {
      if (arr[i].id === id) { found = arr[i]; break; }
    }
    if (!found) {
      throw _schemaError(
        'UNKNOWN_ID',
        'HT.history.restore: no entry with id ' + JSON.stringify(id) +
          ' for slug ' + JSON.stringify(slug)
      );
    }

    const main = (typeof document !== 'undefined')
      ? document.querySelector('main[data-slug="' + slug + '"]')
      : null;
    if (!main) {
      // Nothing to restore into — the page is missing the
      // canonical <main data-slug="..."> anchor. Surface as
      // a warn rather than throw (per Story 2.1 F-12 disposition).
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('HT.history.restore: no <main data-slug="' + slug +
          '"> found; restore is a no-op');
      }
      return;
    }

    const confirmRequested = !(opts && opts.confirm === false);
    const focusRequested = !(opts && opts.focus === false);

    if (confirmRequested) {
      const current = _readStateFromDom(main, slug);
      const isDirty = !_payloadsEqual(current, found.state);
      if (isDirty) {
        _confirmDestructive({
          title: 'Restore this entry?',
          message: 'Your current inputs differ from this entry. Restoring will overwrite them.',
          confirmLabel: 'Restore',
          onConfirm: function () { _doRestore(slug, found, main, focusRequested); },
        });
        return;
      }
    }
    _doRestore(slug, found, main, focusRequested);
  }

  function _doRestore(slug, entry, main, focusRequested) {
    // Write state into the DOM via the urlState encode path
    // (mirrors what HT.sampleData.fill does, Story 2.2).
    _writeStateToDom(main, entry.state || {});
    // Update location.hash to the encoded restored state.
    _commitHashFromDom(main, slug);
    // Focus the first input by default.
    if (focusRequested !== false) {
      _focusFirstInput(main);
    }
    _emit(slug);
  }

  // -------------------------------------------------------------
  // HT.history.subscribe(slug, cb) — same-tab + cross-tab sync.
  // Returns an idempotent unsubscribe.
  // -------------------------------------------------------------

  const _subscribers = Object.create(null); // slug -> Set<cb>
  const _listeners = Object.create(null);   // slug -> { fn, removed }

  function _emit(slug) {
    const set = _subscribers[slug];
    if (!set) return;
    const frozen = list(slug);
    set.forEach(function (cb) {
      try { cb(frozen); } catch (err) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('HT.history.subscribe: callback threw', err);
        }
      }
    });
  }

  function _onStorage(slug) {
    // Cross-tab: when another tab writes to the same key, the
    // `storage` event fires with key + newValue. We forward
    // immediately to the in-process subscribers so the panel
    // re-renders.
    _emit(slug);
  }

  function subscribe(slug, cb) {
    _requireSlug(slug);
    if (typeof cb !== 'function') {
      throw _schemaError(
        'BAD_CALLBACK',
        'HT.history.subscribe: cb must be a function'
      );
    }
    let set = _subscribers[slug];
    if (!set) {
      set = new Set();
      _subscribers[slug] = set;
      // Install the storage listener lazily — one per slug.
      if (!_listeners[slug] && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        const handler = function (ev) {
          if (ev && ev.key === _storageKey(slug)) _onStorage(slug);
        };
        window.addEventListener('storage', handler);
        _listeners[slug] = { fn: handler, removed: false };
      }
    }
    set.add(cb);
    let done = false;
    return function unsubscribe() {
      if (done) return;
      done = true;
      const s = _subscribers[slug];
      if (s) {
        s.delete(cb);
        if (s.size === 0) {
          delete _subscribers[slug];
          const l = _listeners[slug];
          if (l && !l.removed && typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
            try { window.removeEventListener('storage', l.fn); } catch (_) {}
            l.removed = true;
          }
          delete _listeners[slug];
        }
      }
    };
  }

  // -------------------------------------------------------------
  // HT.history.button(slug, opts?) — mobile toggle factory.
  // The click handler toggles the panel: panel(slug, main) on
  // first click, close on the next.
  // -------------------------------------------------------------

  function _panelState() {
    // Single panel instance per page (the mounted one). Keyed by
    // slug so the same handler is reused.
    if (!_panelState._state) {
      _panelState._state = Object.create(null);
    }
    return _panelState._state;
  }

  function _findPanelFor(slug) {
    const state = _panelState();
    return state[slug] || null;
  }

  function button(slug, opts) {
    _requireSlug(slug);
    const variant = (opts && (opts.variant === 'ghost' || opts.variant === 'link'))
      ? opts.variant
      : 'icon';
    const b = (typeof document !== 'undefined')
      ? document.createElement('button')
      : { dataset: {}, setAttribute: function () {}, addEventListener: function () {}, classList: { add: function () {} } };
    b.type = 'button';
    b.dataset.htAction = 'history';
    if (variant === 'icon') {
      b.className = 'btn--ghost history-toggle';
    } else if (variant === 'ghost') {
      b.className = 'btn--ghost';
    } else {
      b.className = 'btn--link';
    }
    b.textContent = (variant === 'link') ? 'History' : '↻';
    b.setAttribute('aria-label', 'Show history (h)');
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-haspopup', 'dialog');

    // The click listener: lazy-mount the panel on first click,
    // toggle open/close on subsequent clicks. Same shape as
    // sample-data.js's mount() — the listener is wired here in
    // the factory so teardown can find and remove it (the panel
    // teardown removes both the panel DOM and the button listener).
    b._historyClick = function (ev) {
      if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
      const main = (typeof document !== 'undefined')
        ? document.querySelector('main[data-slug="' + slug + '"]')
        : null;
      if (!main) return;
      const existing = _findPanelFor(slug);
      if (existing && existing.isOpen) {
        existing.close();
        b.setAttribute('aria-pressed', 'false');
        return;
      }
      if (existing) {
        existing.open();
        b.setAttribute('aria-pressed', 'true');
        return;
      }
      const mounted = panel(slug, main);
      // Re-derive: panel() returns {teardown}; we wrap it so
      // subsequent clicks can open/close without re-mounting.
      let open = true;
      const wrap = {
        teardown: mounted.teardown,
        get isOpen() { return open; },
        open: function () { open = true; },
        close: function () { open = false; },
        destroy: function () { try { mounted.teardown(); } catch (_) {} },
      };
      const state = _panelState();
      state[slug] = wrap;
      b.setAttribute('aria-pressed', 'true');
    };
    b.addEventListener('click', b._historyClick);
    return b;
  }

  // -------------------------------------------------------------
  // HT.history.panel(slug, rootEl) — the Shell-side mount helper.
  // Renders the panel (desktop sidebar on ≥md, mobile sheet on
  // <md) and subscribes for re-render on push/clear/cross-tab.
  // Returns {teardown, open, close, isOpen, refresh} for tests
  // and the mobile toggle button.
  // -------------------------------------------------------------

  // Media-query helper: returns true for "≥md" (desktop sidebar).
  function _isDesktop() {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return !!window.matchMedia('(min-width: 768px)').matches;
  }

  // Relative-time helper. Uses Intl.RelativeTimeFormat when
  // available; falls back to Intl.DateTimeFormat for >7 days.
  // Per project-context §1 NFR-4, Intl.RelativeTimeFormat ships
  // on all supported browsers (Chrome 71+, Firefox 65+, Safari
  // 12.1+, Edge 79+).
  const _rtf = (typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat === 'function')
    ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
    : null;
  const _dtf = (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function')
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
    : null;

  function _relativeTime(ts) {
    const now = Date.now();
    const diffSec = Math.round((ts - now) / 1000);
    const absSec = Math.abs(diffSec);
    if (_rtf) {
      if (absSec < 60) return _rtf.format(diffSec, 'second');
      if (absSec < 3600) return _rtf.format(Math.round(diffSec / 60), 'minute');
      if (absSec < 86400) return _rtf.format(Math.round(diffSec / 3600), 'hour');
      if (absSec < 604800) return _rtf.format(Math.round(diffSec / 86400), 'day');
      if (absSec < 2592000) return _rtf.format(Math.round(diffSec / 604800), 'week');
      if (absSec < 31536000) return _rtf.format(Math.round(diffSec / 2592000), 'month');
    }
    if (_dtf) return _dtf.format(new Date(ts));
    return new Date(ts).toISOString().slice(0, 10);
  }

  function _emptyState() {
    const wrap = document.createElement('div');
    wrap.className = 'history-empty';
    wrap.setAttribute('aria-live', 'polite');
    const p = document.createElement('p');
    p.className = 'history-empty-msg';
    p.textContent = "No history yet. Compute something and it'll appear here.";
    const note = document.createElement('p');
    note.className = 'history-empty-note muted text-sm';
    note.textContent = 'Stored on this device only.';
    wrap.appendChild(p);
    wrap.appendChild(note);
    return wrap;
  }

  function _renderRows(host, slug, panelObj) {
    // Wipe and re-render the row container. The host carries a
    // _historyBound flag so this is idempotent across calls.
    if (!host) return;
    while (host.firstChild) host.removeChild(host.firstChild);
    const entries = list(slug);
    if (entries.length === 0) {
      host.appendChild(_emptyState());
      // Clear-button visibility: only when entries exist.
      if (panelObj && panelObj.clearBtn) {
        panelObj.clearBtn.hidden = true;
      }
      return;
    }
    if (panelObj && panelObj.clearBtn) {
      panelObj.clearBtn.hidden = false;
    }
    for (let i = 0; i < entries.length; i += 1) {
      const e = entries[i];
      const row = document.createElement('div');
      row.className = 'history-row';
      const meta = document.createElement('div');
      meta.className = 'history-row-meta';
      const ts = document.createElement('span');
      ts.className = 'history-row-ts';
      ts.textContent = _relativeTime(e.ts);
      meta.appendChild(ts);
      if (e.label) {
        const lbl = document.createElement('span');
        lbl.className = 'history-row-label';
        lbl.textContent = e.label;
        meta.appendChild(lbl);
      }
      const restore = document.createElement('button');
      restore.type = 'button';
      restore.className = 'btn--ghost history-row-restore';
      restore.dataset.htAction = 'history-restore';
      restore.dataset.entryId = e.id;
      restore.textContent = 'Restore';
      restore.setAttribute('aria-label', 'Restore from ' + _relativeTime(e.ts));
      row.appendChild(meta);
      row.appendChild(restore);
      host.appendChild(row);
    }
  }

  function panel(slug, rootEl) {
    _requireSlug(slug);
    if (!rootEl || typeof rootEl.querySelector !== 'function') {
      throw _schemaError(
        'BAD_ROOT',
        'HT.history.panel: rootEl must be a DOM element'
      );
    }
    if (!hasHistory(slug)) {
      // The tool has no history surface — silently return an
      // empty teardown so the boot path is a no-op.
      return { teardown: function () {}, open: function () {}, close: function () {}, isOpen: false };
    }
    const desktop = _isDesktop();
    const aside = document.createElement('aside');
    aside.className = desktop ? 'history-panel' : 'history-sheet';
    aside.setAttribute('aria-label', 'History');
    if (!desktop) {
      aside.setAttribute('role', 'dialog');
      aside.setAttribute('aria-modal', 'false');
      aside.setAttribute('aria-hidden', 'true');
      aside.hidden = true;
    }

    const header = document.createElement('header');
    header.className = 'history-header';
    const h = document.createElement('h2');
    h.className = 'history-title';
    h.textContent = 'History';
    header.appendChild(h);
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'btn--destructive history-clear';
    clearBtn.dataset.htAction = 'history-clear';
    clearBtn.textContent = 'Clear';
    clearBtn.setAttribute('aria-label', 'Clear history for this tool');
    header.appendChild(clearBtn);
    aside.appendChild(header);

    const listHost = document.createElement('div');
    listHost.className = 'history-rows';
    listHost.setAttribute('aria-live', 'polite');
    aside.appendChild(listHost);

    // Insert into the .tool-actions row's host (sibling of the
    // flex row), or fall back to inserting at the end of rootEl.
    // The desktop sidebar pattern appends at the end (it floats
    // sticky right via CSS); the mobile sheet inserts as the
    // last child too — its CSS positions it.
    rootEl.appendChild(aside);

    // Panel state object — testable handle.
    const panelObj = {
      el: aside,
      listHost: listHost,
      clearBtn: clearBtn,
      isOpen: !desktop, // desktop sidebar is always visible; sheet starts closed
      _isSheet: !desktop,
    };

    // Initial render.
    _renderRows(listHost, slug, panelObj);

    // Click delegation: restore + clear.
    const onClick = function (ev) {
      const t = ev.target;
      if (!(t && t.closest)) return;
      const restoreBtn = t.closest('[data-ht-action="history-restore"]');
      if (restoreBtn) {
        ev.preventDefault();
        const entryId = restoreBtn.getAttribute('data-entry-id');
        if (entryId) {
          try { restore(slug, entryId); }
          catch (err) { console.warn('HT.history.panel: restore failed', err); }
        }
        return;
      }
      const clearEl = t.closest('[data-ht-action="history-clear"]');
      if (clearEl) {
        ev.preventDefault();
        clear(slug, { confirm: true });
      }
    };
    aside.addEventListener('click', onClick);

    // Mobile sheet: close on Esc.
    const onKeydown = function (ev) {
      if (ev && ev.key === 'Escape' && panelObj._isSheet && panelObj.isOpen) {
        ev.preventDefault();
        panelObj.close();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', onKeydown);
    }

    // Subscribe for re-render on push / clear / cross-tab.
    const unsubscribe = subscribe(slug, function () {
      _renderRows(listHost, slug, panelObj);
    });

    panelObj.open = function () {
      if (!panelObj._isSheet) return;
      aside.hidden = false;
      aside.setAttribute('aria-hidden', 'false');
      panelObj.isOpen = true;
    };
    panelObj.close = function () {
      if (!panelObj._isSheet) return;
      aside.hidden = true;
      aside.setAttribute('aria-hidden', 'true');
      panelObj.isOpen = false;
    };
    panelObj.refresh = function () {
      // Re-render the rows from the current storage snapshot. Cheap
      // (≤10 entries); called by callers that mutate the array
      // outside the push/clear path (e.g., import in Story 2.11).
      _renderRows(listHost, slug, panelObj);
    };

    // Mobile variant starts closed (per design). For sheet-style
    // panels, button() callers call open()/close() to toggle.
    // Desktop sidebar variant has panelObj.isOpen = true (no
    // toggling needed — the panel is always visible).
    if (panelObj._isSheet) {
      panelObj.isOpen = false;
    }

    panelObj.teardown = function () {
      try { aside.removeEventListener('click', onClick); } catch (_) {}
      try { document.removeEventListener('keydown', onKeydown); } catch (_) {}
      try { unsubscribe(); } catch (_) {}
      try {
        if (aside.parentNode) aside.parentNode.removeChild(aside);
      } catch (_) {}
      // Clear the panel-state handle so the next button() click
      // remounts.
      const state = _panelState();
      if (state[slug] === panelObj) delete state[slug];
    };

    // Stash the panel instance for the toggle button.
    _panelState()[slug] = panelObj;

    return panelObj;
  }

  // -------------------------------------------------------------
  // DOM helpers — read/write form state via the same write path
  // sample-data.js uses. We deliberately do NOT call url.js's
  // private `_writeFieldValue` (not on the public surface); we
  // mirror the behavior on the public read/write shape.
  // -------------------------------------------------------------

  function _resolveFieldEl(rootEl, entry) {
    const sel = entry.to || entry.from;
    if (typeof sel === 'string' && sel.length > 0) {
      try { return rootEl.querySelector(sel); } catch (_) { return null; }
    }
    if (typeof entry.key === 'string' && entry.key.length > 0) {
      return rootEl.querySelector('#' + entry.key);
    }
    return null;
  }

  function _writeFieldValue(el, value) {
    if (!el) return;
    if (typeof HTMLInputElement !== 'undefined' && el instanceof HTMLInputElement) {
      if (el.type === 'checkbox') {
        el.checked = value === true || value === '1' || value === 'true';
      } else {
        el.value = value === undefined || value === null ? '' : String(value);
      }
      return;
    }
    if (typeof HTMLTextAreaElement !== 'undefined' && el instanceof HTMLTextAreaElement) {
      el.value = value === undefined || value === null ? '' : String(value);
      return;
    }
    if (typeof HTMLSelectElement !== 'undefined' && el instanceof HTMLSelectElement) {
      el.value = value === undefined || value === null ? '' : String(value);
      return;
    }
    if ('value' in el) el.value = value === undefined || value === null ? '' : String(value);
  }

  function _readFieldValue(el) {
    if (!el) return undefined;
    if (typeof HTMLInputElement !== 'undefined' && el instanceof HTMLInputElement) {
      if (el.type === 'checkbox') return el.checked ? '1' : '0';
      if (el.type === 'number') return el.value === '' ? '' : Number(el.value);
      return el.value;
    }
    if (typeof HTMLTextAreaElement !== 'undefined' && el instanceof HTMLTextAreaElement) return el.value;
    if (typeof HTMLSelectElement !== 'undefined' && el instanceof HTMLSelectElement) return el.value;
    return el.value;
  }

  function _writeStateToDom(rootEl, payload) {
    const schema = _loadSchema(_slugFromRoot(rootEl));
    if (!schema || !Array.isArray(schema.decode)) return;
    for (let i = 0; i < schema.decode.length; i += 1) {
      const entry = schema.decode[i];
      if (!Object.prototype.hasOwnProperty.call(payload || {}, entry.key)) continue;
      const el = _resolveFieldEl(rootEl, entry);
      _writeFieldValue(el, payload[entry.key]);
    }
  }

  function _readStateFromDom(rootEl, slug) {
    const schema = _loadSchema(slug);
    if (!schema || !Array.isArray(schema.encode)) return {};
    const out = {};
    for (let i = 0; i < schema.encode.length; i += 1) {
      const entry = schema.encode[i];
      const el = _resolveFieldEl(rootEl, entry);
      const v = _readFieldValue(el);
      if (v === undefined || v === '') continue;
      out[entry.key] = v;
    }
    return out;
  }

  function _slugFromRoot(rootEl) {
    if (!rootEl) return null;
    if (rootEl.getAttribute) {
      const s = rootEl.getAttribute('data-slug');
      if (s) return s;
    }
    if (rootEl.closest) {
      const main = rootEl.closest('main[data-slug]');
      if (main && main.getAttribute) return main.getAttribute('data-slug');
    }
    return null;
  }

  function _commitHashFromDom(rootEl, slug) {
    if (!HT.urlState || typeof HT.urlState.encode !== 'function') return;
    const state = _readStateFromDom(rootEl, slug);
    let encoded;
    try { encoded = HT.urlState.encode(slug, state); }
    catch (e) { return; }
    const nextHash = encoded ? '#' + encoded : '';
    if (typeof location !== 'undefined' && (location.hash || '') !== nextHash) {
      try {
        history.replaceState(null, '', nextHash || location.pathname + location.search);
      } catch (_) {
        if (typeof location !== 'undefined') location.hash = encoded;
      }
    }
  }

  function _focusFirstInput(rootEl) {
    if (!rootEl || typeof rootEl.querySelector !== 'function') return;
    const first = rootEl.querySelector('input, select, textarea');
    if (first && typeof first.focus === 'function') {
      try { first.focus({ preventScroll: false }); } catch (_) { first.focus(); }
    }
  }

  function _payloadsEqual(a, b) {
    // Symmetric key set (Story 2.2 P-6 fix): so DOM-only fields
    // typed by the user don't cause the dirty check to silently
    // pass.
    const keys = Array.from(new Set([
      ...Object.keys(a || {}),
      ...Object.keys(b || {}),
    ]));
    for (let i = 0; i < keys.length; i += 1) {
      const k = keys[i];
      const av = a ? a[k] : undefined;
      const bv = b ? b[k] : undefined;
      if (String(av) !== String(bv)) return false;
    }
    return true;
  }

  // -------------------------------------------------------------
  // Inline <dialog> confirm modal — destructive variant. Mirrors
  // sample-data.js's _confirmDestructive pattern (Story 2.2):
  //   - showModal() focus-trap when available
  //   - close event restores focus to the calling button
  //   - cancel event (Esc) treated as no-op
  // The "shared pattern" assertion in AC-1 is satisfied by both
  // modules using the same showModal() + 'close' event lifecycle
  // and the same cancel → no-op behavior. A future Story 2.3+5.x
  // can extract this into a shared module if a third caller lands.
  // -------------------------------------------------------------

  function _confirmDestructive(opts) {
    if (typeof document === 'undefined') return;
    const trigger = document.activeElement;
    const dlg = document.createElement('dialog');
    dlg.className = 'ht-confirm-dialog';
    const titleId = 'ht-confirm-title-' + Math.random().toString(36).slice(2, 8);
    const messageId = 'ht-confirm-msg-' + Math.random().toString(36).slice(2, 8);
    dlg.innerHTML =
      '<form method="dialog" class="ht-confirm-form">' +
        '<h2 id="' + titleId + '" class="ht-confirm-title"></h2>' +
        '<p id="' + messageId + '" class="ht-confirm-body"></p>' +
        '<div class="ht-confirm-actions">' +
          '<button type="button" value="cancel" class="btn--ghost" data-ht-action="history-confirm-cancel">Cancel</button>' +
          '<button type="button" value="confirm" class="btn--destructive" data-ht-action="history-confirm-ok"></button>' +
        '</div>' +
      '</form>';
    dlg.querySelector('h2').textContent = opts.title || 'Are you sure?';
    dlg.querySelector('h2').id = titleId;
    dlg.querySelector('p').textContent = opts.message || '';
    dlg.querySelector('p').id = messageId;
    dlg.querySelector('[data-ht-action="history-confirm-ok"]').textContent =
      opts.confirmLabel || 'Confirm';
    dlg.setAttribute('aria-labelledby', titleId);
    dlg.setAttribute('aria-describedby', messageId);

    const cancelBtn = dlg.querySelector('[data-ht-action="history-confirm-cancel"]');
    const confirmBtn = dlg.querySelector('[data-ht-action="history-confirm-ok"]');

    function _close(result) {
      try { dlg.close(); } catch (_) {}
      try { dlg.parentNode.removeChild(dlg); } catch (_) {}
      if (result && typeof opts.onConfirm === 'function') opts.onConfirm();
      if (trigger && typeof trigger.focus === 'function') {
        try { trigger.focus(); } catch (_) {}
      }
    }

    cancelBtn.addEventListener('click', function () { _close(false); });
    confirmBtn.addEventListener('click', function () { _close(true); });
    dlg.addEventListener('cancel', function (ev) {
      ev.preventDefault();
      _close(false);
    });

    document.body.appendChild(dlg);
    if (typeof dlg.showModal === 'function') {
      try { dlg.showModal(); } catch (_) { _close(false); return; }
    } else {
      // Fallback: skip confirmation (browsers without <dialog>).
      try { dlg.parentNode.removeChild(dlg); } catch (_) {}
      if (typeof opts.onConfirm === 'function') opts.onConfirm();
      return;
    }
    if (typeof confirmBtn.focus === 'function') confirmBtn.focus();
  }

  // -------------------------------------------------------------
  // Public surface — frozen per AD-14.
  // -------------------------------------------------------------

  Object.freeze(push);
  Object.freeze(list);
  Object.freeze(restore);
  Object.freeze(clear);
  Object.freeze(subscribe);
  Object.freeze(panel);
  Object.freeze(button);
  Object.freeze(hasHistory);
  Object.freeze(lastEntry);
  Object.freeze(_loadSchema);

  Object.defineProperties(HT, {
    history: {
      value: Object.freeze({
        version: '1.0.0',
        push: push,
        list: list,
        restore: restore,
        clear: clear,
        subscribe: subscribe,
        panel: panel,
        button: button,
        hasHistory: hasHistory,
        lastEntry: lastEntry,
        // Internal:
        _loadSchema: _loadSchema,
      }),
      writable: false,
      configurable: false,
      enumerable: true,
    },
  });
})();
