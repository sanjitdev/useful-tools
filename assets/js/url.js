/* ============================================
   Handy Tools — url.js (AD-5 / Story 2.1)
   Per-Tool URL State Codec. The Shell exposes
   `HT.urlState` so every Tool gets shareable,
   canonical, sorted, defaults-stripped URL
   fragments — no more per-tool _b64UrlEncode
   drift. ES2018.
   ============================================ */

(function () {
  'use strict';

  window.HT = window.HT || {};
  const HT = window.HT;

  // -------------------------------------------------------------
  // Typed error
  // -------------------------------------------------------------

  function UrlStateDecodeError(code, field, message, cause) {
    const err = new Error(message);
    err.name = 'UrlStateDecodeError';
    err.code = code;
    err.field = field;
    if (cause !== undefined) err.cause = cause;
    return err;
  }

  function UrlStateSchemaError(code, message) {
    const err = new Error(message);
    err.name = 'UrlStateSchemaError';
    err.code = code;
    return err;
  }

  // -------------------------------------------------------------
  // Schema cache
  // -------------------------------------------------------------

  // slug -> resolved schema { default: {...}, encode: [...], decode: [...] }
  const _schemaCache = Object.create(null);

  function _resolveEntry(slug) {
    if (typeof slug !== 'string' || !/^[a-z][a-z0-9-]*[a-z0-9]$/.test(slug)) {
      throw UrlStateSchemaError(
        'INVALID_SLUG',
        'HT.urlState: slug must be kebab-case (^[a-z][a-z0-9-]*[a-z0-9]$); got ' +
          JSON.stringify(slug)
      );
    }

    // 1. HT.homeGrid.entries (preferred — published by home-grid.js).
    if (HT.homeGrid && Array.isArray(HT.homeGrid.entries)) {
      for (let i = 0; i < HT.homeGrid.entries.length; i += 1) {
        const e = HT.homeGrid.entries[i];
        if (e && e.slug === slug) return e;
      }
    }

    // 2. Inline tools.json fallback (spliced into every page by shell-template.py).
    const inline = document.getElementById('ht-tools-json-inline');
    if (inline) {
      try {
        const parsed = JSON.parse(inline.textContent || '');
        if (parsed && Array.isArray(parsed.tools)) {
          for (let i = 0; i < parsed.tools.length; i += 1) {
            const e = parsed.tools[i];
            if (e && e.slug === slug) return e;
          }
        }
      } catch (_) {
        /* fall through */
      }
    }

    return null;
  }

  function _loadSchema(slug) {
    if (Object.prototype.hasOwnProperty.call(_schemaCache, slug)) {
      return _schemaCache[slug];
    }
    const entry = _resolveEntry(slug);
    if (!entry) {
      throw UrlStateSchemaError(
        'NO_ENTRY',
        'HT.urlState: no tools.json entry for slug ' + JSON.stringify(slug)
      );
    }
    const urlState = entry.urlState;
    if (!urlState || typeof urlState !== 'object') {
      throw UrlStateSchemaError(
        'NO_SCHEMA',
        'HT.urlState: tools.json entry for ' + JSON.stringify(slug) +
          ' has no urlState block (AD-5 requires one)'
      );
    }
    if (!Array.isArray(urlState.encode) || !Array.isArray(urlState.decode)) {
      throw UrlStateSchemaError(
        'MALFORMED_SCHEMA',
        'HT.urlState: urlState.encode and urlState.decode must be arrays for ' +
          JSON.stringify(slug)
      );
    }
    const schema = Object.freeze({
      default: Object.freeze(
        (urlState.default && typeof urlState.default === 'object')
          ? Object.assign({}, urlState.default)
          : {}
      ),
      encode: Object.freeze(urlState.encode.slice()),
      decode: Object.freeze(urlState.decode.slice()),
      schemaVersion:
        typeof entry.schemaVersion === 'string' ? entry.schemaVersion : null,
    });
    _schemaCache[slug] = schema;
    return schema;
  }

  // -------------------------------------------------------------
  // Type coercion (AD-5: number|boolean|date|canonical strings)
  // -------------------------------------------------------------

  const KEY_RE = /^[a-z][a-z0-9-]*$/;

  function _coerceOnEncode(type, value) {
    switch (type) {
      case 'string':
        return String(value);
      case 'number': {
        const n = Number(value);
        if (!isFinite(n)) {
          throw UrlStateDecodeError(
            'MALFORMED_VALUE',
            String(value),
            'HT.urlState.encode: cannot coerce value to finite number'
          );
        }
        return String(n);
      }
      case 'boolean':
        return value ? '1' : '0';
      case 'date': {
        const s = String(value);
        // Accept ISO-8601 date or full datetime; serialize the date part.
        const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
        if (!m) {
          throw UrlStateDecodeError(
            'MALFORMED_VALUE',
            String(value),
            'HT.urlState.encode: date must be ISO-8601 (YYYY-MM-DD)'
          );
        }
        return m[1];
      }
      default:
        throw UrlStateDecodeError(
          'UNKNOWN_TYPE',
          type,
          'HT.urlState.encode: unsupported type ' + JSON.stringify(type)
        );
    }
  }

  function _coerceOnDecode(type, raw) {
    switch (type) {
      case 'string':
        return raw;
      case 'number': {
        const n = Number(raw);
        if (!isFinite(n)) {
          throw UrlStateDecodeError(
            'MALFORMED_VALUE',
            raw,
            'HT.urlState.decode: cannot parse number from ' + JSON.stringify(raw)
          );
        }
        return n;
      }
      case 'boolean':
        if (raw === '1' || raw === 'true') return true;
        if (raw === '0' || raw === 'false') return false;
        throw UrlStateDecodeError(
          'MALFORMED_VALUE',
          raw,
          'HT.urlState.decode: boolean must be "1"/"0" (or true/false); got ' +
            JSON.stringify(raw)
        );
      case 'date':
        if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          throw UrlStateDecodeError(
            'MALFORMED_VALUE',
            raw,
            'HT.urlState.decode: date must be YYYY-MM-DD; got ' + JSON.stringify(raw)
          );
        }
        return raw;
      default:
        throw UrlStateDecodeError(
          'UNKNOWN_TYPE',
          type,
          'HT.urlState.decode: unsupported type ' + JSON.stringify(type)
        );
    }
  }

  function _valuesEqual(a, b) {
    // String-keyed, type-coerced equality (default comparison).
    if (a === b) return true;
    if (typeof a === 'number' && typeof b === 'number') return a === b;
    if (typeof a === 'boolean' && typeof b === 'boolean') return a === b;
    // Mixed-type fallback: stringify both sides.
    return String(a) === String(b);
  }

  // -------------------------------------------------------------
  // encode(slug, state, opts?)
  //
  // state: { [kebab-key]: string|number|boolean } (callers may pass Date via toDate())
  // opts: { prefill?: object } — pack defaults merged under defaults (Story 6.4 use)
  //
  // Returns the URL fragment WITHOUT leading '#' (or "" for empty state).
  // -------------------------------------------------------------

  function encode(slug, state, opts) {
    if (state === null || typeof state !== 'object') {
      throw UrlStateDecodeError(
        'BAD_STATE',
        '',
        'HT.urlState.encode: state must be an object'
      );
    }
    const schema = _loadSchema(slug);
    const prefill = (opts && opts.prefill && typeof opts.prefill === 'object')
      ? opts.prefill
      : null;

    const out = [];

    for (let i = 0; i < schema.encode.length; i += 1) {
      const entry = schema.encode[i];
      const key = entry.key;
      if (!KEY_RE.test(key)) {
        throw UrlStateDecodeError(
          'BAD_KEY',
          key,
          'HT.urlState.encode: encode key must match ^[a-z][a-z0-9-]*$; got ' +
            JSON.stringify(key)
        );
      }
      if (!Object.prototype.hasOwnProperty.call(state, key)) continue;
      const raw = state[key];
      if (raw === undefined || raw === null || raw === '') continue;

      const encoded = _coerceOnEncode(entry.type, raw);
      // Default omission: skip if equal to schema default OR prefill.
      if (
        Object.prototype.hasOwnProperty.call(schema.default, key) &&
        _valuesEqual(raw, schema.default[key])
      ) continue;
      if (
        prefill &&
        Object.prototype.hasOwnProperty.call(prefill, key) &&
        _valuesEqual(raw, prefill[key])
      ) continue;

      out.push(encodeURIComponent(key) + '=' + encodeURIComponent(encoded));
    }

    // Empty state returns "" regardless of schemaVersion — callers
    // rely on this to detect "no hash" (no fragment in URL).
    if (out.length === 0) return '';
    out.sort();
    // _v goes first when schemaVersion is declared. Lexicographic sort
    // puts '_v' (0x5F) before 'a'..'z' (0x61+) anyway, but guard explicitly
    // so a future alphabet change can't break the contract.
    if (schema.schemaVersion && out[0].indexOf('_v=') !== 0) {
      const versionEntry = '_v=' + encodeURIComponent(schema.schemaVersion);
      out.unshift(versionEntry);
    }
    return out.join('&');
  }

  // -------------------------------------------------------------
  // decode(slug, hash, opts?)
  //
  // hash: the fragment (without leading '#'); callers pass location.hash.slice(1).
  // opts: { prefill?: object } — pack defaults merged under defaults.
  //
  // Returns parsed state merged with prefill and schema default.
  // Unknown keys are dropped silently. Malformed values throw.
  // -------------------------------------------------------------

  function _lookupEntryType(list, key) {
    if (!Array.isArray(list)) return null;
    for (let i = 0; i < list.length; i += 1) {
      if (list[i] && list[i].key === key) return list[i].type || null;
    }
    return null;
  }

  function decode(slug, hash, opts) {
    const schema = _loadSchema(slug);
    const prefill = (opts && opts.prefill && typeof opts.prefill === 'object')
      ? opts.prefill
      : null;

    const merged = {};
    // Order: defaults < prefill (pack) < explicit fragment.
    // Defaults and prefill are coerced through the decode type so the
    // returned state is always type-stable (numbers stay numbers even
    // when the tools.json author wrote '100' as a string).
    Object.keys(schema.default).forEach((k) => {
      const defType = _lookupEntryType(schema.decode, k);
      merged[k] = defType ? _coerceOnDecode(defType, schema.default[k]) : schema.default[k];
    });
    if (prefill) {
      Object.keys(prefill).forEach((k) => {
        const defType = _lookupEntryType(schema.decode, k);
        merged[k] = defType ? _coerceOnDecode(defType, prefill[k]) : prefill[k];
      });
    }

    // Story 2.1 / SF-1 / AC-2 #5: the schema version is recorded on the
    // returned object as `__v` so future migration helpers can branch on
    // it (e.g., when the codec learns to upgrade legacy hashes). It is
    // still unknown when the hash is empty; in that case we leave it
    // absent so consumers can distinguish "URL didn't carry a version"
    // from "URL carried version 1".
    const schemaVersion = schema.schemaVersion;

    if (typeof hash !== 'string' || hash.length === 0) {
      const out = Object.assign({}, merged);
      if (schemaVersion) out.__v = schemaVersion;
      return Object.freeze(out);
    }

    const pairs = hash.split('&');
    for (let i = 0; i < pairs.length; i += 1) {
      const pair = pairs[i];
      if (pair.length === 0) continue;
      const eq = pair.indexOf('=');
      let key, raw;
      if (eq < 0) { key = pair; raw = ''; }
      else { key = pair.slice(0, eq); raw = pair.slice(eq + 1); }
      try {
        key = decodeURIComponent(key);
        raw = decodeURIComponent(raw);
      } catch (e) {
        throw UrlStateDecodeError(
          'MALFORMED_ENCODING',
          key,
          'HT.urlState.decode: percent-decoding failed for pair',
          e
        );
      }
      if (key === '_v') {
        // Hash-level override: when the URL carries a version, that
        // wins over the schema-default version. This is what lets a
        // future "v2" codec detect a v1 hash and run the upgrade.
        if (raw) merged.__v = raw;
        continue;
      }
      // Resolve the type from the decode list (if known).
      const entryType = _lookupEntryType(schema.decode, key);
      if (!entryType) continue; // unknown key — silently drop (AD-5)

      const coerced = _coerceOnDecode(entryType, raw);
      merged[key] = coerced;
    }

    if (!merged.__v && schemaVersion) merged.__v = schemaVersion;
    return Object.freeze(Object.assign({}, merged));
  }

  // -------------------------------------------------------------
  // bindForm(slug, rootEl)
  //
  // Wires every input whose id matches a decode key. Initial state is
  // pulled from the URL hash and written into the DOM before any
  // change event would clobber it. Returns a teardown function.
  // -------------------------------------------------------------

  function _resolveFieldEl(rootEl, entry) {
    // `to:` (decode) and `from:` (encode) override the default
    // key-based selector so tools with non-kebab-case DOM ids
    // (e.g., camelCase ids in brownfield HTML) can still bind.
    const sel = entry.to || entry.from;
    if (typeof sel === 'string' && sel.length > 0) {
      // selector may be "#id" or any CSS selector — let
      // querySelector parse it.
      try { return rootEl.querySelector(sel); } catch (_) { return null; }
    }
    if (typeof entry.key === 'string' && entry.key.length > 0) {
      return rootEl.querySelector('#' + entry.key);
    }
    return null;
  }

  function _readFieldValue(el) {
    if (!el) return undefined;
    if (el instanceof HTMLInputElement) {
      if (el.type === 'checkbox') return el.checked ? '1' : '0';
      if (el.type === 'number') return el.value === '' ? '' : Number(el.value);
      return el.value;
    }
    if (el instanceof HTMLTextAreaElement) return el.value;
    if (el instanceof HTMLSelectElement) return el.value;
    return el.value;
  }

  function _writeFieldValue(el, value) {
    if (!el) return;
    if (el instanceof HTMLInputElement) {
      if (el.type === 'checkbox') {
        el.checked = value === true || value === '1' || value === 'true';
      } else {
        el.value = value === undefined || value === null ? '' : String(value);
      }
      return;
    }
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
      el.value = value === undefined || value === null ? '' : String(value);
      return;
    }
    if ('value' in el) el.value = value === undefined || value === null ? '' : String(value);
  }

  function bindForm(slug, rootEl) {
    if (!rootEl || typeof rootEl.querySelector !== 'function') {
      throw UrlStateDecodeError(
        'BAD_ROOT',
        '',
        'HT.urlState.bindForm: rootEl must be a DOM element'
      );
    }
    const schema = _loadSchema(slug);
    const handlers = [];
    const teardownFns = [];
    let teardown = false;

    function _writeInitialState() {
      let initial;
      try {
        initial = decode(slug, (location.hash || '').replace(/^#/, ''));
      } catch (e) {
        console.warn('HT.urlState.bindForm: initial decode failed', e);
        initial = {};
      }
      for (let i = 0; i < schema.decode.length; i += 1) {
        const entry = schema.decode[i];
        if (!Object.prototype.hasOwnProperty.call(initial, entry.key)) continue;
        const el = _resolveFieldEl(rootEl, entry);
        _writeFieldValue(el, initial[entry.key]);
      }
    }

    _writeInitialState();

    function _readState() {
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

    function _commit() {
      if (teardown) return;
      const state = _readState();
      let encoded;
      try { encoded = encode(slug, state); }
      catch (e) {
        console.warn('HT.urlState.bindForm: encode failed', e);
        return;
      }
      const nextHash = encoded ? '#' + encoded : '';
      if ((location.hash || '') !== nextHash) {
        try {
          history.replaceState(null, '', nextHash || location.pathname + location.search);
        } catch (_) {
          // Some embed contexts disallow history mutation; fall back to hash set.
          location.hash = encoded;
        }
      }
    }

    const debouncedCommit = HT.debounce(_commit, 100);

    function _onHashChange() {
      if (teardown) return;
      let next;
      try {
        next = decode(slug, (location.hash || '').replace(/^#/, ''));
      } catch (e) {
        console.warn('HT.urlState.bindForm: hashchange decode failed', e);
        return;
      }
      const active = document.activeElement;
      for (let i = 0; i < schema.decode.length; i += 1) {
        const entry = schema.decode[i];
        const el = _resolveFieldEl(rootEl, entry);
        if (el === active) continue; // don't clobber a typing user
        if (!el) continue;
        _writeFieldValue(el, next[entry.key]);
      }
    }

    for (let i = 0; i < schema.decode.length; i += 1) {
      const entry = schema.decode[i];
      const el = _resolveFieldEl(rootEl, entry);
      // F-12: surface selector-mapping mistakes loudly. The original
      // review suggested a key regex check, but `key` is already
      // validated by tools.schema.json (^[a-z][a-z0-9-]*$) — a
      // regex re-check in url.js is redundant noise. The real bug
      // surface is "schema entry's selector doesn't resolve to any
      // element in rootEl" (e.g., a brownfield tool with a camelCase
      // id and no `to:` override). When the schema mandated a `to:`
      // and that selector still misses in the live DOM, dev tools
      // see a silent no-op (no listener attached, no field write).
      // Surface a warning so the dev agent notices the regression
      // on first run. Console-only — does not throw, so existing
      // tolerant contracts (e.g., a tool that intentionally skips
      // a field) keep working.
      if (!el) {
        const sel = entry.to || entry.from || ('#' + entry.key);
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(
            'HT.urlState.bindForm: schema entry for slug ' + JSON.stringify(slug) +
            ' key ' + JSON.stringify(entry.key) +
            ' has no matching element in rootEl (selector: ' + JSON.stringify(sel) +
            '). URL covariance for this field will be silent. ' +
            'Add a `to:` selector to the schema entry, or rename the DOM id to match.'
          );
        }
        continue;
      }
      const handler = function () { debouncedCommit(); };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
      handlers.push({ el, handler });
    }

    window.addEventListener('hashchange', _onHashChange);
    teardownFns.push(function () { window.removeEventListener('hashchange', _onHashChange); });

    return function _teardown() {
      if (teardown) return;
      teardown = true;
      for (let i = 0; i < handlers.length; i += 1) {
        try { handlers[i].el.removeEventListener('input', handlers[i].handler); } catch (_) {}
        try { handlers[i].el.removeEventListener('change', handlers[i].handler); } catch (_) {}
      }
      for (let i = 0; i < teardownFns.length; i += 1) {
        try { teardownFns[i](); } catch (_) {}
      }
    };
  }

  // -------------------------------------------------------------
  // bindDomTarget(slug, key, el)
  //
  // Field-by-field sibling of bindForm for Tools whose inputs live
  // outside a single root. Returns a teardown.
  // -------------------------------------------------------------

  function bindDomTarget(slug, key, el) {
    if (!el || typeof el.addEventListener !== 'function') {
      throw UrlStateDecodeError(
        'BAD_TARGET',
        key,
        'HT.urlState.bindDomTarget: el must be a DOM element'
      );
    }
    const schema = _loadSchema(slug);
    let entry = null;
    for (let i = 0; i < schema.encode.length; i += 1) {
      if (schema.encode[i].key === key) { entry = schema.encode[i]; break; }
    }
    if (!entry) {
      throw UrlStateDecodeError(
        'UNKNOWN_KEY',
        key,
        'HT.urlState.bindDomTarget: key ' + JSON.stringify(key) +
          ' not in schema.encode for slug ' + JSON.stringify(slug)
      );
    }
    let teardown = false;

    function _commit() {
      if (teardown) return;
      const state = {};
      const v = _readFieldValue(el);
      if (v !== undefined && v !== '') state[key] = v;
      let encoded;
      try { encoded = encode(slug, state); }
      catch (e) { console.warn('HT.urlState.bindDomTarget: encode failed', e); return; }
      const nextHash = encoded ? '#' + encoded : '';
      if ((location.hash || '') !== nextHash) {
        try { history.replaceState(null, '', nextHash || location.pathname + location.search); }
        catch (_) { location.hash = encoded; }
      }
    }

    const debouncedCommit = HT.debounce(_commit, 100);
    const handler = function () { debouncedCommit(); };
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);

    return function _teardown() {
      if (teardown) return;
      teardown = true;
      try { el.removeEventListener('input', handler); } catch (_) {}
      try { el.removeEventListener('change', handler); } catch (_) {}
    };
  }

  // -------------------------------------------------------------
  // subscribe(slug, handler)
  //
  // Fires `handler(state)` on every URL change for `slug`. Returns
  // an unsubscribe function (idempotent).
  // -------------------------------------------------------------

  function subscribe(slug, handler) {
    if (typeof handler !== 'function') {
      throw UrlStateDecodeError(
        'BAD_HANDLER',
        '',
        'HT.urlState.subscribe: handler must be a function'
      );
    }
    const onChange = function () {
      let state;
      try { state = decode(slug, (location.hash || '').replace(/^#/, '')); }
      catch (e) { console.warn('HT.urlState.subscribe: decode failed', e); return; }
      handler(state);
    };
    window.addEventListener('hashchange', onChange);
    let done = false;
    return function unsubscribe() {
      if (done) return;
      done = true;
      window.removeEventListener('hashchange', onChange);
    };
  }

  // -------------------------------------------------------------
  // Public surface — frozen per AD-14.
  // -------------------------------------------------------------

  Object.freeze(encode);
  Object.freeze(decode);
  Object.freeze(bindForm);
  Object.freeze(bindDomTarget);
  Object.freeze(subscribe);
  Object.freeze(_loadSchema);

  Object.defineProperties(HT, {
    urlState: { value: Object.freeze({
      version: '1.0.0',
      encode: encode,
      decode: decode,
      subscribe: subscribe,
      bindForm: bindForm,
      bindDomTarget: bindDomTarget,
      // Internal:
      _loadSchema: _loadSchema,
      _schemaCache: _schemaCache,
      _UrlStateDecodeError: UrlStateDecodeError,
      _UrlStateSchemaError: UrlStateSchemaError,
    }), writable: false, configurable: false, enumerable: true },
    // HT.urlStateUrl — back-compat alias from the Epic 1 doc draft: the
    // active location.hash when an encoded state is present, else null.
    // Story 2.5 (Share Dialog) consumes this for the "Copy URL" button.
    // Internal per AD-14 stability rule (not exposed on the doc table).
    urlStateUrl: {
      get: function () {
        const h = (typeof location !== 'undefined' && location.hash) || '';
        if (h.length <= 1) return null;
        return h;
      },
      configurable: false,
      enumerable: true,
    },
  });

  // Register via HT.provide('url-state-codec', ...) per AC-6 / Story 2.1.
  // Defers with setTimeout(0) so this works whether url.js parses
  // before or after shell.js (HT.provide is only defined after shell.js
  // IIFE runs). shell.js boot() ALSO calls HT.provide for belt-and-
  // suspenders; this catch is a no-op if the registration already landed
  // because HT.provide throws on duplicate slugs.
  function _registerOnProvide() {
    if (typeof HT.provide !== 'function' || !HT.urlState) return;
    try { HT.provide('url-state-codec', HT.urlState); }
    catch (err) { /* duplicate registration from shell.js boot() — fine */ }
  }
  if (typeof HT.provide === 'function') {
    _registerOnProvide();
  } else if (typeof setTimeout === 'function') {
    setTimeout(_registerOnProvide, 0);
  }
})();