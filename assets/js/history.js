/* ============================================
   Handy Tools — history.js (Story 2.3 + 3.6)
   Per-Tool History Panel. The Shell exposes
   `HT.history` so every Tool can record the
   last 50 inputs (Story 3.6 raised the cap
   from Story 2.3's 10) and restore any prior
   state with one click — no per-tool
   persistence drift. Composes on
   HT.urlState._loadSchema (Story 2.1) +
   HT.storage (Story 1.10).
   ES2018.

   Story 3.6 entry shape: {ts (ISO 8601),
   inputs, result}. Legacy {id, ts (number),
   state, result, label} entries are migrated
   transparently in _readRaw (one-shot
   read-time migration, AD-6 honored via
   HT.storage.set).
   ============================================ */

(function () {
  'use strict';

  window.HT = window.HT || {};
  const HT = window.HT;

  // -------------------------------------------------------------
  // HISTORY_CAP — single source of truth for the per-tool FIFO cap.
  // Story 2.3 used 10 (FR-12 floor); Story 3.6 raises it to 50.
  // Hoisted from a literal `10` / `50` to satisfy AI-E2-2
  // (Epic 2 retrospective carry-over).
  // -------------------------------------------------------------
  const HISTORY_CAP = 50;

  // -------------------------------------------------------------
  // Embed-mode predicate — mirrors help-overlay.js's `isEmbedMode`
  // (Story 3.3). Reads HT_SHELL_EMBED (set by shell.js boot when
  // ?embed=1 is in the URL) and falls back to a literal search-
  // string match so history.js works even if shell.js has not booted
  // yet (Story 3.6 boot-order invariant: history.js loads after
  // shell.js, but the panel may be invoked before HT.__booted
  // completes its async parts). Per AC-7.
  // -------------------------------------------------------------

  function _isEmbed() {
    try {
      // MED-4 fix — accept HT_SHELL_EMBED as boolean true (shell.js's
      // canonical form), the legacy number 1, or a truthy string
      // ('1' / 'true'). The URL fallback covers the pre-boot path.
      if (typeof window !== 'undefined' && window.HT_SHELL_EMBED) {
        const v = window.HT_SHELL_EMBED;
        if (v === true || v === 1 || v === '1' || v === 'true') return true;
      }
      const search = (typeof window !== 'undefined' && window.location && window.location.search) || '';
      // LOW-7 fix — accept `?embed=true` as well as `?embed=1`. The
      // parameter separator must be `?` or `&` (not part of another
      // value like `?foo=embed=1`).
      return /(?:^|[?&])embed=(?:1|true)(?:&|$)/.test(search);
    } catch (_) {
      return false;
    }
  }

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

  function _isNewShape(e) {
    // Story 3.6 — the new-shape predicate is complete: a valid ISO
    // timestamp string, a plain-object `inputs`, a string `result`,
    // and absence of any legacy field. MED-5 fix: the prior fast
    // path accepted any string `ts`, which let malformed entries
    // slip through and crash `_relativeTime` later.
    if (!e || typeof e !== 'object' || Array.isArray(e)) return false;
    if (typeof e.ts !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(e.ts)) return false;
    if (!e.inputs || typeof e.inputs !== 'object' || Array.isArray(e.inputs)) return false;
    if (typeof e.result !== 'string') return false;
    if ('id' in e || 'state' in e || 'label' in e) return false;
    return true;
  }

  function _normalizeEntry(e, originalIndex) {
    // Story 3.6 — legacy → new shape normalization. MED-6 fix: a
    // missing or invalid `ts` no longer becomes `new Date().toISOString()`
    // (which would reorder historical entries ahead of valid ones).
    // Instead we synthesize a deterministic sentinel that sorts
    // OLDEST so the entry does not displace valid history in the
    // newest-first ordering. The sentinel is `1970-01-01T00:00:00.000Z`.
    // LOW-8 trade-off: any legitimate pre-1970 entry (clock-skewed
    // device) ALSO gets the sentinel — this is irreversible in the
    // migration write. The warning is emitted so future debugging
    // can find the affected entries.
    const SENTINEL_TS = '1970-01-01T00:00:00.000Z';
    const inputs = (e && e.inputs && typeof e.inputs === 'object' && !Array.isArray(e.inputs))
      ? Object.freeze(Object.assign({}, e.inputs))
      : (e && e.state && typeof e.state === 'object' && !Array.isArray(e.state))
        ? Object.freeze(Object.assign({}, e.state))
        : Object.freeze({});
    let tsOut;
    if (e && typeof e.ts === 'number' && isFinite(e.ts) && e.ts >= 0) {
      tsOut = new Date(e.ts).toISOString();
    } else if (e && typeof e.ts === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(e.ts)) {
      tsOut = e.ts;
    } else {
      // MED-6 — deterministic oldest, never "now".
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('HT.history: legacy entry missing/invalid ts → sentinel', e);
      }
      tsOut = SENTINEL_TS;
    }
    return Object.freeze({
      ts: tsOut,
      inputs: inputs,
      result: (e && typeof e.result === 'string') ? e.result : '',
    });
  }

  function _readRaw(slug) {
    if (!HT.storage || typeof HT.storage.get !== 'function') return [];
    const v = HT.storage.get(_storageKey(slug), []);
    if (!Array.isArray(v)) return [];
    // Story 3.6 — migration hook. Detect legacy entries
    // ({id, ts (number), state, result, label}) and rewrite them
    // in-place to the new shape ({ts (ISO 8601 string), inputs,
    // result}). This runs at most once per legacy entry; subsequent
    // calls hit the fast path (every entry passes _isNewShape).
    let needsRewrite = false;
    const migrated = [];
    for (let i = 0; i < v.length; i += 1) {
      const e = v[i];
      if (_isNewShape(e)) {
        migrated.push(e);
      } else {
        needsRewrite = true;
        migrated.push(_normalizeEntry(e, i));
      }
    }
    // MED-7 — enforce the FIFO cap on read. Pre-existing oversized
    // arrays (legacy Story 2.3 with cap 10, or an import that
    // brought in more than 50) get truncated to the newest
    // HISTORY_CAP entries. Sort newest-first by `ts` lexicographically
    // (ISO 8601 strings sort chronologically), then slice.
    if (migrated.length > HISTORY_CAP) {
      migrated.sort(function (a, b) {
        if (a.ts < b.ts) return 1;
        if (a.ts > b.ts) return -1;
        return 0;
      });
      migrated.length = HISTORY_CAP;
      needsRewrite = true;
    }
    if (needsRewrite) {
      try {
        // Strip frozen-object proxies for serialization (HT.storage.set
        // validates JSON-serializability for handy-tools.* keys per
        // Story 1.10). _writeRaw routes through HT.storage.set (NOT
        // raw localStorage.setItem) to honor AD-6.
        const stripped = JSON.parse(JSON.stringify(migrated));
        _writeRaw(slug, stripped);
      } catch (_) { /* swallow — best effort, never throw from a read path */ }
    }
    return migrated;
  }

  function _writeRaw(slug, entries) {
    if (!HT.storage || typeof HT.storage.set !== 'function') return false;
    // The array is already plain (we constructed it); the registry
    // validates JSON-serializability on set.
    return HT.storage.set(_storageKey(slug), entries);
  }

  // HT.history._replaceAll(slug, entries) — Story 3.8 internal handle.
  // Bulk-replaces the per-tool history list with a caller-supplied
  // (already-merged, already-sorted, already-cap-trimmed) array. Used
  // by import.js to merge existing + imported entries without
  // round-tripping through HT.history.push (which can't dedup by ts
  // and couldn't honor the "imported wins on ts collision" rule). The
  // caller is responsible for the merge math; this handle just writes
  // + emits. AD-14 internal-handle pattern — NOT a public HT.* entry.
  // Stable-ish: invoked from exactly one place (assets/js/import.js).
  function _replaceAll(slug, entries) {
    _requireSlug(slug);
    if (!Array.isArray(entries)) return false;
    const plain = [];
    for (let i = 0; i < entries.length; i += 1) plain.push(entries[i]);
    _writeRaw(slug, plain);
    _emit(slug);
    return true;
  }

  // -------------------------------------------------------------
  // HT.history.push(slug, entry?)
  //
  // Appends to the per-tool FIFO list, capped at 50 (Story 3.6 —
  // raised from Story 2.3's 10 per FR-12). The caller passes a
  // {inputs, result, ts?} object (Story 3.6 shape); if entry is
  // omitted, auto-creates an empty shape. The function does NOT
  // auto-snapshot current tool state (per AC-1: keep HT.history
  // decoupled from HT.urlState at the call layer; the tool's
  // onAfterCompute hook builds the entry).
  //
  // Returns the frozen HistoryEntry. Throws UrlStateSchemaError
  // if the slug has no urlState block (consistency with
  // HT.urlState._loadSchema).
  // -------------------------------------------------------------

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
      ts: (typeof e.ts === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(e.ts))
        ? e.ts
        : new Date().toISOString(),
      inputs: (e.inputs && typeof e.inputs === 'object' && !Array.isArray(e.inputs))
        ? Object.freeze(Object.assign({}, e.inputs))
        : Object.freeze({}),
      result: (typeof e.result === 'string') ? e.result : '',
    });

    const current = _readRaw(slug);
    // FIFO cap of 50 per FR-12 + Story 3.6. _writeRaw writes a fresh
    // plain array so the caller's frozen view isn't reflected back.
    const next = [...current, historyEntry];
    if (next.length > HISTORY_CAP) next.splice(0, next.length - HISTORY_CAP);
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
    // Newest-first. Story 3.6 — sort by `ts` ISO 8601 string
    // descending (lexicographic order matches chronological order
    // for ISO 8601 strings). Ties broken by stable sort
    // (insertion order — ES2019 Array.prototype.sort is stable).
    arr.sort(function (a, b) {
      if (a.ts < b.ts) return 1;
      if (a.ts > b.ts) return -1;
      return 0;
    });
    // Replace the array with a plain frozen copy so mutation is
    // impossible AND so the returned shape doesn't carry any
    // proxies from the registry's JSON.parse. Story 3.6 shape:
    // {ts (ISO 8601), inputs, result}.
    const out = Object.freeze(arr.map(function (e) {
      return Object.freeze({
        ts: e.ts,
        inputs: Object.freeze(Object.assign({}, e.inputs || {})),
        result: (typeof e.result === 'string') ? e.result : '',
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

  function restore(slug, idOrEntry, opts) {
    _requireSlug(slug);
    const arr = list(slug);
    // Story 3.6 — accept either a HistoryEntry object (new shape)
    // OR a string (legacy id path: ISO 8601 ts lookup).
    let found = null;
    if (typeof idOrEntry === 'string') {
      for (let i = 0; i < arr.length; i += 1) {
        if (arr[i].ts === idOrEntry) { found = arr[i]; break; }
      }
      if (!found) {
        throw _schemaError(
          'UNKNOWN_TS',
          'HT.history.restore: no entry with ts ' + JSON.stringify(idOrEntry) +
            ' for slug ' + JSON.stringify(slug)
        );
      }
    } else if (idOrEntry && typeof idOrEntry === 'object') {
      // Story 3.6 + review HIGH-3 — when the caller passes the entry
      // object directly (the new shape returned by list()/lastEntry()),
      // resolve it against a FRESH list() snapshot. This guards
      // against stale-object races (panel remount between list() and
      // restore()) and against forged entries that aren't actually
      // present in storage. Match on the full {ts, result, inputs}
      // tuple so two entries that share an ms + result (which is
      // legal — same inputs rendered twice) still resolve to the
      // exact one the caller pointed at. (Second-pass HIGH-2 fix:
      // {ts, result} alone is not unique when two pushes happen
      // within the same ms with identical inputs.)
      const wantTs = idOrEntry.ts;
      const wantResult = idOrEntry.result;
      const wantInputs = idOrEntry.inputs;
      if (typeof wantTs !== 'string' || typeof wantResult !== 'string') {
        throw _schemaError(
          'BAD_ENTRY_SHAPE',
          'HT.history.restore: object arg must be a HistoryEntry with string ts and result'
        );
      }
      for (let i = 0; i < arr.length; i += 1) {
        const cand = arr[i];
        if (cand.ts === wantTs
          && cand.result === wantResult
          && _payloadsEqual(cand.inputs, wantInputs)) {
          found = cand;
          break;
        }
      }
      if (!found) {
        throw _schemaError(
          'UNKNOWN_ENTRY',
          'HT.history.restore: entry is no longer in history for slug ' +
            JSON.stringify(slug) + ' (ts ' + JSON.stringify(wantTs) +
            ' not present in current snapshot)'
        );
      }
    } else {
      throw _schemaError(
        'BAD_ARG',
        'HT.history.restore: 2nd arg must be a HistoryEntry or ISO 8601 ts string'
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
      const isDirty = !_payloadsEqual(current, found.inputs);
      if (isDirty) {
        _confirmDestructive({
          title: 'Restore previous entry?',
          message: 'You have unsaved changes. Restore and discard them?',
          confirmLabel: 'Discard and restore',
          buttonOrder: ['cancel', 'confirm'],
          focusReturn: opts && opts.focusReturn,
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
    _writeStateToDom(main, entry.inputs || {});
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
    // Story 3.6 AC-7 — embed mode hides the History button. The
    // tool's onAfterCompute hook may still call button(slug), so we
    // return a hidden, inert button that no-ops on click. Existing
    // callers don't have to branch. Pattern mirrors help-overlay.js.
    const embed = _isEmbed();
    const variant = (opts && (opts.variant === 'ghost' || opts.variant === 'link'))
      ? opts.variant
      : 'icon';
    const b = (typeof document !== 'undefined')
      ? document.createElement('button')
      : { dataset: {}, setAttribute: function () {}, addEventListener: function () {}, classList: { add: function () {} } };
    b.type = 'button';
    b.dataset.htAction = 'history';
    if (variant === 'icon') {
      b.className = 'btn btn--ghost history-toggle';
    } else if (variant === 'ghost') {
      b.className = 'btn btn--ghost';
    } else {
      b.className = 'btn btn--link';
    }
    if (embed) {
      // Hidden + inert. aria-hidden=true so AT skips it; tabIndex=-1
      // so keyboard doesn't land on it. The CSS also hides it via
      // :root[data-embed="1"] but this is the JS-side guarantee.
      b.hidden = true;
      b.setAttribute('aria-hidden', 'true');
      b.setAttribute('tabindex', '-1');
      b.setAttribute('data-embed-suppressed', '1');
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
      // Re-derive: panel() returns {teardown, open, close, isOpen, refresh}.
      // We wrap it so subsequent clicks can open/close without re-mounting.
      // The wrap MUST delegate to mounted.open/close so the backdrop toggles
      // (otherwise the backdrop stays hidden permanently, which is fine for
      // closing but means it never shows on open). Mirrors the lazy-mount
      // pattern in sample-data.js.
      let open = true;
      const wrap = {
        teardown: mounted.teardown,
        get isOpen() { return open; },
        open: function () {
          open = true;
          if (typeof mounted.open === 'function') {
            try { mounted.open(); } catch (_) { /* no-op */ }
          }
        },
        close: function () {
          open = false;
          if (typeof mounted.close === 'function') {
            try { mounted.close(); } catch (_) { /* no-op */ }
          }
        },
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

  // Relative-time helper. Story 3.6: constructed with navigator.language
  // (was undefined in Story 2.3). Falls back to `undefined` defensively
  // when navigator.language is missing (same pattern Story 3.5's locale
  // default uses). Per AD-10, locale-aware formatting via Intl.* only.
  const _locale = (typeof navigator !== 'undefined' && navigator.language)
    ? navigator.language
    : undefined;
  const _rtf = (typeof Intl !== 'undefined' && typeof Intl.RelativeTimeFormat === 'function')
    ? new Intl.RelativeTimeFormat(_locale, { numeric: 'auto' })
    : null;
  const _dtf = (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function')
    ? new Intl.DateTimeFormat(_locale, { dateStyle: 'medium' })
    : null;

  function _relativeTime(ts) {
    // Story 3.6 — `ts` is an ISO 8601 string. Convert to a number
    // (ms since epoch) before computing the diff. The legacy
    // Story 2.3 signature accepted a number directly; we accept
    // both shapes defensively.
    const tsMs = (typeof ts === 'string') ? new Date(ts).getTime() : ts;
    // MED-4 fix — guard against `Invalid Date`. Without this,
    // `diffSec` and `absSec` are NaN, the cutoff/branch tests all
    // fail, and the fallback `toISOString()` throws `RangeError`.
    // Migration normalizes or drops invalid timestamps; rows that
    // survive an existing bad entry get a stable localized fallback.
    if (!Number.isFinite(tsMs)) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('HT.history: invalid timestamp', ts);
      }
      return '—';
    }
    const now = Date.now();
    const diffSec = Math.round((tsMs - now) / 1000);
    const absSec = Math.abs(diffSec);
    // Story 3.6 AC-2 — cutoff is "older than 7 days" → use strict >
    // so 7 days exactly stays relative; 8+ days falls back to absolute.
    if (absSec > 7 * 86400) {
      if (_dtf) return _dtf.format(new Date(tsMs));
      return new Date(tsMs).toISOString().slice(0, 10);
    }
    if (_rtf) {
      // Story 3.6 AC-2 unit set is {second, minute, hour, day, week}.
      // LOW-8 fix: month was outside the spec — collapse 30-day+
      // relative timestamps into the absolute fallback path below.
      if (absSec < 60) return _rtf.format(diffSec, 'second');
      if (absSec < 3600) return _rtf.format(Math.round(diffSec / 60), 'minute');
      if (absSec < 86400) return _rtf.format(Math.round(diffSec / 3600), 'hour');
      if (absSec < 604800) return _rtf.format(Math.round(diffSec / 86400), 'day');
    }
    if (_dtf) return _dtf.format(new Date(tsMs));
    return new Date(tsMs).toISOString().slice(0, 10);
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

  function _summarizeEntry(entry) {
    // Story 3.6 — first 3 input values (clamped to 40 chars + U+2026
    // ellipsis), joined with ", ". Plus result preview clamped to 80
    // chars (no ellipsis, just truncation). Returns the summary string
    // for both the visible row body and the aria-label hint.
    const inputs = (entry && entry.inputs && typeof entry.inputs === 'object')
      ? entry.inputs
      : {};
    const keys = Object.keys(inputs).slice(0, 3);
    const inputValues = keys.map(function (k) {
      const v = String(inputs[k]);
      return v.length > 40 ? v.slice(0, 40) + '…' : v;
    });
    const resultPreview = (typeof entry.result === 'string')
      ? entry.result.slice(0, 80)
      : '';
    if (inputValues.length === 0 && resultPreview === '') {
      return 'No inputs or result';
    }
    const inputSummary = inputValues.join(', ');
    if (inputSummary && resultPreview) return inputSummary + ' — ' + resultPreview;
    return inputSummary || resultPreview;
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
      // Story 3.6 — row is a single <button> that triggers
      // HT.history.restore(slug, entry, opts) (the whole row IS
      // the click target). The visual body shows the relative
      // timestamp + truncated inputs/result; the aria-label is the
      // AT-facing text.
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'history-row';
      const meta = document.createElement('span');
      meta.className = 'history-row-meta';
      const ts = document.createElement('time');
      ts.className = 'history-row-ts';
      ts.setAttribute('datetime', e.ts);
      ts.textContent = _relativeTime(e.ts);
      meta.appendChild(ts);
      const body = document.createElement('span');
      body.className = 'history-row-body';
      const summary = _summarizeEntry(e);
      // If the summary is the empty-state placeholder, render as muted.
      if (summary === 'No inputs or result') {
        body.className = 'history-row-body history-row-body--empty';
      }
      body.textContent = summary;
      meta.appendChild(body);
      const ariaLabelParts = ['Restore from ' + _relativeTime(e.ts)];
      const resultHint = (typeof e.result === 'string')
        ? e.result.slice(0, 40)
        : '';
      if (resultHint) ariaLabelParts.push(resultHint);
      row.setAttribute('aria-label', ariaLabelParts.join(', '));
      row.setAttribute('data-entry-ts', e.ts);
      row.appendChild(meta);
      host.appendChild(row);
    }
  }

  // isTextInputFocus — Story 3.4 pattern. Defense-in-depth so
  // panel Escape handler doesn't fire while the user is typing in
  // a text input (the input must accept Escape without closing
  // the panel).
  function _isTextInputFocus() {
    if (typeof document === 'undefined') return false;
    const el = document.activeElement;
    if (!el || !el.tagName) return false;
    const tag = String(el.tagName).toUpperCase();
    if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') return false;
    if (tag === 'INPUT') {
      const type = (typeof el.type === 'string') ? el.type.toLowerCase() : '';
      // Buttons / checkboxes / radios / etc. don't count as "text input"
      const nonText = ['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'image', 'range', 'color'];
      if (nonText.indexOf(type) !== -1) return false;
    }
    return true;
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
    // Story 3.6 AC-7 — embed mode hides the panel too. Even if a
    // caller mounts panel() programmatically in embed context, we
    // must not render the DOM or wire subscriptions. Mirrors the
    // button() embed gate; the smoke harness covers both paths.
    if (_isEmbed()) {
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
    clearBtn.className = 'btn btn--destructive history-clear';
    clearBtn.dataset.htAction = 'history-clear';
    clearBtn.textContent = 'Clear';
    clearBtn.setAttribute('aria-label', 'Clear history for this tool');
    header.appendChild(clearBtn);
    // Story 3.6 — desktop close button (new affordance). The mobile
    // sheet keeps its existing close pattern.
    let closeBtn = null;
    let backdrop = null;
    if (desktop) {
      closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'history-panel__close';
      closeBtn.setAttribute('aria-label', 'Close history');
      closeBtn.textContent = '×';
      closeBtn.dataset.htAction = 'history-close';
      header.appendChild(closeBtn);
    }
    aside.appendChild(header);

    const listHost = document.createElement('div');
    listHost.className = 'history-rows';
    listHost.setAttribute('aria-live', 'polite');
    aside.appendChild(listHost);

    // Story 3.6 — desktop backdrop (same pattern as Settings modal
    // backdrop, Story 1.8). Click-to-dismiss.
    //
    // BUG FIX: the backdrop was previously created with no `hidden`
    // attribute and no JS to toggle it, so it permanently covered
    // the page on every tool load (blocking all clicks). Now we
    // mark it `hidden` at creation and toggle alongside the panel's
    // open/close state. The CSS honors [hidden] via the explicit
    // rule `.history-panel__backdrop[hidden] { display: none }` in
    // assets/css/base.css.
    if (desktop) {
      backdrop = document.createElement('div');
      backdrop.className = 'history-panel__backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      backdrop.hidden = true;
      backdrop.dataset.htAction = 'history-backdrop';
      rootEl.appendChild(backdrop);
    }

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
      closeBtn: closeBtn,
      backdrop: backdrop,
      isOpen: !desktop, // desktop sidebar is always visible; sheet starts closed
      _isSheet: !desktop,
    };

    // Initial render.
    _renderRows(listHost, slug, panelObj);

    // Story 3.6 — look up the History button so close/Escape can
    // return focus to it. We search the same rootEl for the
    // data-ht-action="history" button created by button().
    let historyBtnEl = null;
    try {
      if (rootEl.querySelector) {
        historyBtnEl = rootEl.querySelector('[data-ht-action="history"]');
      }
    } catch (_) { /* ignore */ }
    if (!historyBtnEl && typeof document !== 'undefined' && document.querySelector) {
      try { historyBtnEl = document.querySelector('[data-ht-action="history"]'); }
      catch (_) { /* ignore */ }
    }

    // _closePanel — centralizes the close + focus-return logic so
    // Escape, close-button-click, and backdrop-click all share the
    // same code path.
    function _closePanel() {
      if (!panelObj._isSheet) {
        // Desktop sidebar variant: panel is always visible per design.
        // We just return focus to the History button.
        if (historyBtnEl && typeof historyBtnEl.focus === 'function') {
          try { historyBtnEl.focus(); } catch (_) {}
        }
        return;
      }
      panelObj.close();
      if (historyBtnEl && typeof historyBtnEl.focus === 'function') {
        try { historyBtnEl.focus(); } catch (_) {}
      }
    }
    panelObj._closePanel = _closePanel;

    // Click delegation: restore (whole row is a button) + clear.
    const onClick = function (ev) {
      const t = ev && ev.target;
      if (!(t && t.closest)) return;
      const rowBtn = t.closest('button.history-row');
      if (rowBtn) {
        if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
        // Look up the entry from the row's data-entry-ts attribute
        // (set when rendering the row).
        const ts = rowBtn.getAttribute('data-entry-ts');
        if (ts) {
          try { restore(slug, ts); }
          catch (err) { console.warn('HT.history.panel: restore failed', err); }
        }
        return;
      }
      const clearEl = t.closest('[data-ht-action="history-clear"]');
      if (clearEl) {
        if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
        clear(slug, { confirm: true });
        return;
      }
      if (closeBtn && t.closest('[data-ht-action="history-close"]')) {
        if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
        _closePanel();
        return;
      }
      if (backdrop && t.closest('[data-ht-action="history-backdrop"]')) {
        if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
        _closePanel();
        return;
      }
    };
    aside.addEventListener('click', onClick);
    // Story 3.6 — backdrop click-to-dismiss. Named so teardown can
    // removeEventListener cleanly (HIGH-1 fix: anonymous listeners
    // can't be removed, and arguments.callee is illegal in strict
    // mode which this IIFE enforces).
    let onBackdropClick = null;
    if (backdrop) {
      onBackdropClick = function (ev) {
        if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
        _closePanel();
      };
      backdrop.addEventListener('click', onBackdropClick);
    }

    // Story 3.6 — Escape keydown handler with isTextInputFocus
    // guard. Mirrors Story 3.4's pattern.
    const onKeydown = function (ev) {
      if (!ev || ev.key !== 'Escape') return;
      // Defense-in-depth: if focus is in a text input, do not
      // intercept Escape (the input needs it for its own behavior).
      if (_isTextInputFocus()) return;
      // On mobile sheet, Escape closes the sheet.
      // On desktop sidebar, Escape just returns focus to the
      // History button (no panel to close since the sidebar is
      // always visible).
      if (panelObj._isSheet && panelObj.isOpen) {
        ev.preventDefault();
        _closePanel();
      } else if (!panelObj._isSheet && historyBtnEl) {
        ev.preventDefault();
        try { historyBtnEl.focus(); } catch (_) {}
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
      // Mobile sheet: standard hidden→visible toggle.
      if (panelObj._isSheet) {
        aside.hidden = false;
        aside.setAttribute('aria-hidden', 'false');
      }
      // Desktop drawer: show the backdrop alongside the panel.
      // BUG FIX: the backdrop used to be permanently visible (no
      // [hidden] attribute, no toggle), blocking every click on
      // every tool. Now both the backdrop and the panel are
      // gated on `panelObj.isOpen` — the JS in button() flips
      // isOpen via the lazy-mount wrapper.
      panelObj.isOpen = true;
      if (backdrop) {
        backdrop.hidden = false;
        backdrop.setAttribute('aria-hidden', 'false');
      }
    };
    panelObj.close = function () {
      // Mobile sheet: standard visible→hidden toggle.
      if (panelObj._isSheet) {
        aside.hidden = true;
        aside.setAttribute('aria-hidden', 'true');
      }
      // Desktop drawer: hide the backdrop so the page is interactive
      // again. The aside is always visible (sidebar pattern), but the
      // backdrop must release pointer-events + dimming.
      panelObj.isOpen = false;
      if (backdrop) {
        backdrop.hidden = true;
        backdrop.setAttribute('aria-hidden', 'true');
      }
    };
    panelObj.refresh = function () {
      // Re-render the rows from the current storage snapshot. Cheap
      // (≤50 entries per Story 3.6); called by callers that mutate
      // the array outside the push/clear path (e.g., import in
      // Story 2.11).
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
      if (backdrop && onBackdropClick) {
        try { backdrop.removeEventListener('click', onBackdropClick); } catch (_) {}
      }
      try { document.removeEventListener('keydown', onKeydown); } catch (_) {}
      try { unsubscribe(); } catch (_) {}
      try {
        if (aside.parentNode) aside.parentNode.removeChild(aside);
      } catch (_) {}
      if (backdrop && backdrop.parentNode) {
        try { backdrop.parentNode.removeChild(backdrop); } catch (_) {}
      }
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
    // Story 3.6 — buttonOrder param. Default (Story 2.3): destructive
    // first (Confirm), Cancel second. Restore's AC-4 demands the
    // reverse: Cancel first (default focus), Discard and restore
    // second (Enter focus).
    const order = (opts && opts.buttonOrder && Array.isArray(opts.buttonOrder)
      && opts.buttonOrder[0] === 'cancel')
      ? ['cancel', 'confirm']
      : ['confirm', 'cancel'];
    const focusReturn = (opts && opts.focusReturn) ? opts.focusReturn : trigger;

    // Build the dialog programmatically (NOT via innerHTML — that
    // would require DOMParser in some test contexts and would be
    // fragile against XSS in real use). Programmatic creation gives
    // us deterministic child refs.
    const dlg = document.createElement('dialog');
    dlg.className = 'ht-confirm-dialog';
    const titleId = 'ht-confirm-title-' + Math.random().toString(36).slice(2, 8);
    const messageId = 'ht-confirm-msg-' + Math.random().toString(36).slice(2, 8);

    const form = document.createElement('form');
    form.className = 'ht-confirm-form';
    form.setAttribute('method', 'dialog');
    dlg.appendChild(form);

    const title = document.createElement('h2');
    title.className = 'ht-confirm-title';
    title.id = titleId;
    title.textContent = opts.title || 'Are you sure?';
    form.appendChild(title);

    const message = document.createElement('p');
    message.className = 'ht-confirm-body';
    message.id = messageId;
    message.textContent = opts.message || '';
    form.appendChild(message);

    const actions = document.createElement('div');
    actions.className = 'ht-confirm-actions';
    form.appendChild(actions);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.value = 'cancel';
    cancelBtn.className = 'btn btn--ghost';
    cancelBtn.setAttribute('data-ht-action', 'history-confirm-cancel');
    cancelBtn.textContent = 'Cancel';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.value = 'confirm';
    confirmBtn.className = 'btn btn--destructive';
    confirmBtn.setAttribute('data-ht-action', 'history-confirm-ok');
    confirmBtn.textContent = opts.confirmLabel || 'Confirm';

    if (order[0] === 'cancel') {
      actions.appendChild(cancelBtn);
      actions.appendChild(confirmBtn);
    } else {
      actions.appendChild(confirmBtn);
      actions.appendChild(cancelBtn);
    }

    dlg.setAttribute('aria-labelledby', titleId);
    dlg.setAttribute('aria-describedby', messageId);

    function _close(result) {
      try { dlg.close(); } catch (_) {}
      try { dlg.parentNode.removeChild(dlg); } catch (_) {}
      if (result && typeof opts.onConfirm === 'function') opts.onConfirm();
      // Story 3.6 — focus-return: restore uses the clicked History
      // row; clear (and other callers) fall back to the trigger.
      const ret = (result ? trigger : focusReturn) || trigger;
      if (ret && typeof ret.focus === 'function') {
        try { ret.focus(); } catch (_) {}
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
    // Default focus: per Story 3.6 AC-4, the FIRST button in the
    // order gets autofocus. Story 2.3's default order had Confirm
    // (destructive) first → autofocus on destructive. The new
    // restore order has Cancel first → autofocus on Cancel (safer).
    const focusBtn = order[0] === 'cancel' ? cancelBtn : confirmBtn;
    if (typeof focusBtn.focus === 'function') focusBtn.focus();
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
  Object.freeze(_replaceAll);

  Object.defineProperties(HT, {
    history: {
      value: Object.freeze({
        version: '1.12.0',
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
        _replaceAll: _replaceAll,
      }),
      writable: false,
      configurable: false,
      enumerable: true,
    },
  });

  // Story 3.6 — HT_HISTORY_INIT internal handle (AD-14 internal-handle
  // pattern). Mirrors HT_HELP_OVERLAY_INIT (Story 3.3) and
  // HT_GLOBAL_CHORDS_INIT (Story 3.4). NOT a public HT.* surface.
  // The smoke harness reads version + cap from this handle.
  Object.defineProperty(window, 'HT_HISTORY_INIT', {
    value: Object.freeze({
      version: '1.12.0',
      cap: HISTORY_CAP,
    }),
    writable: false,
    configurable: false,
    enumerable: true,
  });
})();
