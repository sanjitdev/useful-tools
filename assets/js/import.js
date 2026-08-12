/* ============================================
   Handy Tools — import.js (Story 3.8)
   Reads a previously exported JSON file, parses
   it via FileReader.readAsText, validates it
   against the version-handle exported by
   assets/js/export.js (window.HT_EXPORT_SCHEMA_VERSION),
   shows an overwrite-confirm dialog if any settings
   conflict, then writes all keys via the storage
   registry in this exact order: settings → pins →
   favorites → recent → history.<slug> (merged).

   Public surface (AD-14 frozen since Story 3.8):
     HT.import.run()            — click → file picker
                                  → parse → validate
                                  → confirm → apply
     HT.import.prompt()         — alias for run()
                                  (Story 2.5 mirror pattern)
   Internal handle:
     HT_IMPORT_DIALOG_VERSION   — single source of
                                  truth for the dialog-
                                  shape contract version

   Cross-references:
     - Story 3.7 export.js        provides HT_EXPORT_SCHEMA_VERSION
                                   + the mirror-side payload shape
     - Story 3.5 shell.js         provides the window.confirm
                                   precedent (clearAllLocalData)
     - Story 3.6 history.js       provides HISTORY_CAP + the
                                   merge semantics (imported wins
                                   on ts collision)
     - Story 1.10 storage-registry.js  the HT.storage.set gate
                                       every write routes through
   ============================================ */

(function () {
  'use strict';

  window.HT = window.HT || {};
  const HT = window.HT;

  const TOAST_SUCCESS_MS = 2500;
  const HISTORY_CAP = (typeof window !== 'undefined'
                       && window.HT_HISTORY_INIT
                       && typeof window.HT_HISTORY_INIT.cap === 'number')
                      ? window.HT_HISTORY_INIT.cap
                      : 50;
  const PARSE_ERROR_MAX_LEN = 60;

  // ---------- Predicates ----------

  function _isEmbed() {
    try {
      if (typeof window !== 'undefined' && window.HT_SHELL_EMBED) {
        const v = window.HT_SHELL_EMBED;
        if (v === true || v === 1 || v === '1' || v === 'true') return true;
      }
      const search = (typeof window !== 'undefined' && window.location && window.location.search) || '';
      return /(?:^|[?&])embed=(?:1|true)(?:&|$)/.test(search);
    } catch (_) { return false; }
  }

  // ---------- Schema version (single source of truth: export.js) ----------

  function _expectedVersion() {
    const v = (typeof window !== 'undefined' && window.HT_EXPORT_SCHEMA_VERSION
               && typeof window.HT_EXPORT_SCHEMA_VERSION.version === 'string')
              ? window.HT_EXPORT_SCHEMA_VERSION.version
              : null;
    return v;
  }

  // ---------- Validator (read-side mirror of export.js _validatePayload) ----------
  // Same 6 checks; epics-mandated version-mismatch error string;
  // import-side "Import failed: <path>" prefix for everything else.

  function _validatePayload(p, opts) {
    const errors = [];
    const expected = _expectedVersion();
    if (!p || typeof p !== 'object' || Array.isArray(p)) {
      errors.push({ path: '', message: 'payload must be an object' });
      return { ok: false, errors };
    }
    if (expected !== null && p.version !== expected) {
      errors.push({
        path: 'version',
        message: 'Export schema version ' + String(p.version) +
                 ' is not compatible with this app (expected ' + expected + ')',
      });
    }
    if (typeof p.exportedAt !== 'string' || Number.isNaN(new Date(p.exportedAt).getTime())) {
      errors.push({ path: 'exportedAt', message: 'not ISO-parseable' });
    }
    if (!p.settings || typeof p.settings !== 'object' || Array.isArray(p.settings)) {
      errors.push({ path: 'settings', message: 'must be a plain object' });
    }
    if (!p.history || typeof p.history !== 'object' || Array.isArray(p.history)) {
      errors.push({ path: 'history', message: 'must be a plain object' });
    } else {
      for (const slug of Object.keys(p.history)) {
        if (!Array.isArray(p.history[slug])) errors.push({ path: 'history.' + slug, message: 'must be an array' });
      }
    }
    if (!Array.isArray(p.favorites)) {
      errors.push({ path: 'favorites', message: 'must be an array' });
    } else {
      for (let i = 0; i < p.favorites.length; i += 1) {
        if (typeof p.favorites[i] !== 'string') errors.push({ path: 'favorites[' + i + ']', message: 'must be a string' });
      }
    }
    if (!Array.isArray(p.recent)) {
      errors.push({ path: 'recent', message: 'must be an array' });
    } else {
      for (let i = 0; i < p.recent.length; i += 1) {
        if (typeof p.recent[i] !== 'string') errors.push({ path: 'recent[' + i + ']', message: 'must be a string' });
      }
    }
    if (!p.pins || typeof p.pins !== 'object' || Array.isArray(p.pins)) {
      errors.push({ path: 'pins', message: 'must be a plain object' });
    } else {
      for (const slug of Object.keys(p.pins)) {
        if (Number.isNaN(new Date(p.pins[slug]).getTime())) errors.push({ path: 'pins.' + slug, message: 'not ISO-parseable' });
      }
    }
    // Defensive: caller can suppress the version-mismatch error by passing
    // {errorFormat:'export'} — used only by the shared helper if Story 3.8
    // ever extracts one. Defaults to import-side formatting here.
    if (opts && opts.errorFormat === 'export') {
      return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors: errors };
    }
    return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors: errors };
  }

  // ---------- Conflict detection ----------

  function _detectConflicts(payload) {
    const conflicts = [];
    if (!payload || !payload.settings || typeof payload.settings !== 'object') {
      return { count: 0, keys: [] };
    }
    // Same static ht.* list as _applySettings — keeps the gate happy
    // and matches the export's _buildSettings filter. Unrolled (not a
    // for-of loop) so the INDIRECT_RE pattern in storage-registry-gate
    // sees only static keys — `HT.storage.get(<literal>, ...)` matches
    // DIRECT_RE and the literals are registered in
    // assets/js/storage-registry.js.  See note in _applySettings.
    const _has = (k) => Object.prototype.hasOwnProperty.call(payload.settings, k);
    if (_has('ht.theme')) {
      let cur = null;
      try { cur = HT.storage && typeof HT.storage.get === 'function' ? HT.storage.get('ht.theme', null) : null; } catch (_) { cur = null; }
      if (String(cur) !== String(payload.settings['ht.theme'])) conflicts.push('ht.theme');
    }
    if (_has('ht.locale')) {
      let cur = null;
      try { cur = HT.storage && typeof HT.storage.get === 'function' ? HT.storage.get('ht.locale', null) : null; } catch (_) { cur = null; }
      if (String(cur) !== String(payload.settings['ht.locale'])) conflicts.push('ht.locale');
    }
    if (_has('ht.reducedMotion')) {
      let cur = null;
      try { cur = HT.storage && typeof HT.storage.get === 'function' ? HT.storage.get('ht.reducedMotion', null) : null; } catch (_) { cur = null; }
      if (String(cur) !== String(payload.settings['ht.reducedMotion'])) conflicts.push('ht.reducedMotion');
    }
    if (_has('ht.units')) {
      let cur = null;
      try { cur = HT.storage && typeof HT.storage.get === 'function' ? HT.storage.get('ht.units', null) : null; } catch (_) { cur = null; }
      if (String(cur) !== String(payload.settings['ht.units'])) conflicts.push('ht.units');
    }
    if (_has('ht.currency')) {
      let cur = null;
      try { cur = HT.storage && typeof HT.storage.get === 'function' ? HT.storage.get('ht.currency', null) : null; } catch (_) { cur = null; }
      if (String(cur) !== String(payload.settings['ht.currency'])) conflicts.push('ht.currency');
    }
    if (_has('ht.fontScale')) {
      let cur = null;
      try { cur = HT.storage && typeof HT.storage.get === 'function' ? HT.storage.get('ht.fontScale', null) : null; } catch (_) { cur = null; }
      if (String(cur) !== String(payload.settings['ht.fontScale'])) conflicts.push('ht.fontScale');
    }
    conflicts.sort();
    return { count: conflicts.length, keys: conflicts };
  }

  // ---------- File reading (Promise) ----------

  function _readFile(file) {
    return new Promise(function (resolve, reject) {
      let reader = null;
      try {
        reader = new FileReader();
      } catch (e) {
        reject({ reason: 'no-FileReader', message: 'FileReader unavailable' });
        return;
      }
      reader.onload = function () {
        let txt = '';
        try { txt = String(reader.result); } catch (_) { txt = ''; }
        try {
          const parsed = JSON.parse(txt);
          resolve(parsed);
        } catch (err) {
          const msg = (err && err.message) ? String(err.message) : String(err);
          reject({ reason: 'parse-error', message: msg });
        }
      };
      reader.onerror = function () {
        reject({ reason: 'read-error', message: 'FileReader failed' });
      };
      try {
        reader.readAsText(file);
      } catch (e) {
        reject({ reason: 'no-FileReader', message: 'FileReader unavailable' });
      }
    });
  }

  // ---------- File picker lifecycle ----------

  function _ensureFileInput() {
    if (_fileInput && typeof _fileInput.click === 'function') return _fileInput;
    let host = null;
    try {
      host = document.getElementById('ht-import-file-picker-host');
      if (!host && document.body) {
        host = document.createElement('div');
        host.id = 'ht-import-file-picker-host';
        host.setAttribute('aria-hidden', 'true');
        host.style.display = 'none';
        document.body.appendChild(host);
      }
    } catch (_) { host = null; }
    if (!host) return null;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.id = 'ht-import-file-picker';
    input.setAttribute('aria-hidden', 'true');
    input.tabIndex = -1;
    try { host.appendChild(input); } catch (_) {}
    input.addEventListener('change', _onFileInputChange);
    _fileInput = input;
    return input;
  }

  function _clickFilePicker() {
    const input = _ensureFileInput();
    if (!input || typeof input.click !== 'function') return false;
    try { input.value = ''; } catch (_) {}
    try { input.click(); } catch (_) { return false; }
    return true;
  }

  function _onFileInputChange() {
    const input = _fileInput;
    if (!input) return;
    let file = null;
    try { file = (input.files && input.files.length > 0) ? input.files[0] : null; } catch (_) { file = null; }
    if (!file) {
      // User canceled; release the in-flight flag silently.
      importInFlight = false;
      return;
    }
    _executeImport(file).then(function () {
      importInFlight = false;
    }).catch(function () {
      importInFlight = false;
    });
  }

  function _executeImport(file) {
    return _readFile(file).then(function (payload) {
      const v = _validatePayload(payload);
      if (!v.ok) {
        try { console.error('Import validation failed:', v.errors); } catch (_) {}
        _showToast('Import failed: ' + (v.errors[0] ? v.errors[0].path : 'payload'));
        return { ok: false, reason: 'validation-failed', errors: v.errors };
      }
      const conflicts = _detectConflicts(payload);
      if (conflicts.count > 0) {
        const ok = _confirmOverwrite(conflicts.count);
        if (!ok) {
          _showToast('Import canceled');
          return { ok: false, reason: 'canceled' };
        }
      }
      const settingsCount = _applySettings(payload);
      const pinCount = _applyPins(payload);
      _applyFavoritesAndRecent(payload);
      const historyCounts = _mergeAllHistory(payload);
      _showToast('Imported ' + historyCounts.added + ' history entries, ' + pinCount + ' pins');
      return {
        ok: true,
        counts: {
          settings: settingsCount,
          pins: pinCount,
          favorites: Array.isArray(payload.favorites) ? payload.favorites.length : 0,
          recent: Array.isArray(payload.recent) ? payload.recent.length : 0,
          historyAdded: historyCounts.added,
          historyReplaced: historyCounts.replaced,
        },
      };
    }).catch(function (err) {
      try {
        const reason = err && err.reason ? err.reason : 'unknown';
        const message = err && err.message ? String(err.message) : String(err);
        const trunc = message.length > PARSE_ERROR_MAX_LEN
          ? message.slice(0, PARSE_ERROR_MAX_LEN) : message;
        const toastMsg = reason === 'parse-error'
          ? 'Import failed: invalid JSON: ' + trunc
          : 'Import failed: ' + trunc;
        _showToast(toastMsg);
        try { console.error('Import failed:', reason, message); } catch (_) {}
      } catch (_) {}
      return { ok: false, reason: 'parse-error', message: err && err.message };
    });
  }

  // ---------- Apply-phase helpers ----------

  function _applySettings(payload) {
    let n = 0;
    if (!payload || !payload.settings || typeof payload.settings !== 'object') return 0;
    if (!HT.storage || typeof HT.storage.set !== 'function') return 0;
    // Static-key writes — unrolled (not a for-of loop) so the
    // storage-registry gate's INDIRECT_RE sees `HT.storage.set(
    // <literal>, ...)` matching DIRECT_RE, with the literal in
    // assets/js/storage-registry.js. Same allowlist as _detectConflicts;
    // mirrors export.js:_buildSettings. Future settings: extend this
    // list AND storage-registry.js in lockstep.
    const _has = (k) => Object.prototype.hasOwnProperty.call(payload.settings, k);
    if (_has('ht.theme')) { try { HT.storage.set('ht.theme', payload.settings['ht.theme']); n += 1; } catch (_) {} }
    if (_has('ht.locale')) { try { HT.storage.set('ht.locale', payload.settings['ht.locale']); n += 1; } catch (_) {} }
    if (_has('ht.reducedMotion')) { try { HT.storage.set('ht.reducedMotion', payload.settings['ht.reducedMotion']); n += 1; } catch (_) {} }
    if (_has('ht.units')) { try { HT.storage.set('ht.units', payload.settings['ht.units']); n += 1; } catch (_) {} }
    if (_has('ht.currency')) { try { HT.storage.set('ht.currency', payload.settings['ht.currency']); n += 1; } catch (_) {} }
    if (_has('ht.fontScale')) { try { HT.storage.set('ht.fontScale', payload.settings['ht.fontScale']); n += 1; } catch (_) {} }
    return n;
  }

  function _applyPins(payload) {
    if (!payload || !payload.pins || typeof payload.pins !== 'object') return 0;
    if (!HT.storage || typeof HT.storage.set !== 'function') return 0;
    const keys = Object.keys(payload.pins);
    try { HT.storage.set('handy-tools.pins', Object.assign({}, payload.pins)); } catch (_) {}
    return keys.length;
  }

  function _applyFavoritesAndRecent(payload) {
    if (!HT.storage || typeof HT.storage.set !== 'function') return;
    if (payload && Array.isArray(payload.favorites)) {
      try { HT.storage.set('handy-tools.favorites', payload.favorites.slice()); } catch (_) {}
    }
    if (payload && Array.isArray(payload.recent)) {
      try { HT.storage.set('handy-tools.recent', payload.recent.slice()); } catch (_) {}
    }
  }

  function _isValidImportedEntry(e) {
    if (!e || typeof e !== 'object') return false;
    if (typeof e.ts !== 'string' || Number.isNaN(new Date(e.ts).getTime())) return false;
    if (typeof e.result !== 'string') return false;
    return true;
  }

  function _mergeHistoryForSlug(slug, imported) {
    const safeImported = [];
    for (let i = 0; i < imported.length; i += 1) {
      if (_isValidImportedEntry(imported[i])) safeImported.push(imported[i]);
      else {
        try { console.warn('Story 3.8 import: dropping invalid history entry for slug', slug); } catch (_) {}
      }
    }
    let existing = [];
    if (HT.history && typeof HT.history.list === 'function') {
      try { existing = HT.history.list(slug) || []; } catch (_) { existing = []; }
    }
    const byTs = Object.create(null);
    // Imported entries override on ts collision.
    for (let i = 0; i < safeImported.length; i += 1) byTs[safeImported[i].ts] = safeImported[i];
    for (let i = 0; i < existing.length; i += 1) {
      const e = existing[i];
      if (!e || typeof e.ts !== 'string') continue;
      if (!(e.ts in byTs)) byTs[e.ts] = e;
    }
    const merged = Object.values(byTs);
    merged.sort(function (a, b) {
      if (a.ts < b.ts) return 1;
      if (a.ts > b.ts) return -1;
      return 0;
    });
    if (merged.length > HISTORY_CAP) merged.length = HISTORY_CAP;
    // Route the write through HT.history._replaceAll — history.js owns
    // the storage key (AD-6) and the gate (storage-registry-gate.py)
    // trips on direct HT.storage.*('handy-tools.history.*' + ...) call
    // sites elsewhere. _requireSlug() inside _replaceAll ensures the
    // slug has a schema; tools with no schema silently no-op (consistent
    // with HT.history.push behavior).
    if (HT.history && typeof HT.history._replaceAll === 'function') {
      try { HT.history._replaceAll(slug, merged); } catch (_) {}
    }
    return {
      added: safeImported.length,
      replaced: merged.length - safeImported.length,
      total: merged.length,
    };
  }

  function _mergeAllHistory(payload) {
    let added = 0;
    let replaced = 0;
    if (!payload || !payload.history || typeof payload.history !== 'object') {
      return { added: 0, replaced: 0 };
    }
    for (const slug of Object.keys(payload.history)) {
      const list = payload.history[slug];
      if (!Array.isArray(list)) continue;
      const counts = _mergeHistoryForSlug(slug, list);
      added += counts.added;
      replaced += counts.replaced;
    }
    return { added: added, replaced: replaced };
  }

  // ---------- Confirm dialog ----------

  function _confirmOverwrite(count) {
    if (typeof window === 'undefined' || typeof window.confirm !== 'function') return false;
    return Boolean(window.confirm('Importing will overwrite ' + count + ' setting(s). Continue?'));
  }

  // ---------- Toast ----------

  function _showToast(msg) {
    try {
      if (HT.toast) HT.toast(msg, TOAST_SUCCESS_MS);
    } catch (_) {}
  }

  // ---------- Entry point ----------

  let importInFlight = false;
  let _fileInput = null;

  function run() {
    if (importInFlight) return { ok: false, reason: 'in-flight' };
    if (_isEmbed()) return { ok: false, reason: 'embed-mode' };
    importInFlight = true;
    if (!_clickFilePicker()) {
      importInFlight = false;
      return { ok: false, reason: 'no-file-picker' };
    }
    return { ok: true, state: 'awaiting-file' };
  }

  function prompt() {
    return run();
  }

  // ---------- Frozen public surface ----------

  HT.import = Object.freeze({
    run: run,
    prompt: run,
  });

  Object.defineProperty(window, 'HT_IMPORT_DIALOG_VERSION', {
    value: Object.freeze({ version: '1.0.0' }),
    writable: false,
    configurable: false,
    enumerable: true,
  });
})();
