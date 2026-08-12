/* ============================================
   Handy Tools — export.js (Story 3.7)
   Builds a single JSON file with the user's
   settings, history, favorites, recent, and pins,
   validates it against EXPORT_SCHEMA_VERSION, and
   triggers a Blob download. Read-only: never
   writes back to localStorage.

   Public surface (AD-14 frozen since Story 3.7):
     HT.export.run()            — assemble + validate + download
     HT.export.version          — '1.0.0'
   Internal handle:
     HT_EXPORT_SCHEMA_VERSION   — single source of truth for
                                   the JSON `version` field
                                   (Story 3.8 reads this).
   ============================================ */

(function () {
  'use strict';

  window.HT = window.HT || {};
  const HT = window.HT;

  const EXPORT_SCHEMA_VERSION = '1.0.0';
  const REVOKE_DELAY_MS = 1000;
  const TOAST_SUCCESS_MS = 2500;

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

  function _readSetting(key) {
    // Settings live as PLAIN STRINGS (FOUC IIFE compat); do not JSON.parse.
    try {
      const raw = (window.localStorage && window.localStorage.getItem(key));
      if (raw === null || raw === undefined) return undefined;
      return String(raw);
    } catch (_) { return undefined; }
  }

  function _buildSettings() {
    const out = Object.create(null);
    if (!HT.storage || typeof HT.storage.list !== 'function') return out;
    const entries = HT.storage.list();
    for (const e of entries) {
      if (e && typeof e.key === 'string' && e.key.startsWith('ht.')) {
        const v = _readSetting(e.key);
        if (v !== undefined) out[e.key] = v;
      }
    }
    return out;
  }

  function _buildHistory() {
    const out = Object.create(null);
    if (!HT.storage || typeof HT.storage.list !== 'function') return out;
    const entries = HT.storage.list();
    for (const e of entries) {
      if (!e || typeof e.key !== 'string') continue;
      const m = /^handy-tools\.history\.([^.]+)$/.exec(e.key);
      if (!m) continue;
      const slug = m[1];
      let list = [];
      if (HT.history && typeof HT.history.list === 'function') {
        try { list = HT.history.list(slug) || []; } catch (_) { list = []; }
      } else {
        try {
          const raw = HT.storage.get(e.key, []);
          list = Array.isArray(raw) ? raw : [];
        } catch (_) { list = []; }
      }
      out[slug] = list;
    }
    return out;
  }

  function _getStringArray(key) {
    try {
      const raw = HT.storage && HT.storage.get(key, []);
      return Array.isArray(raw) ? raw : [];
    } catch (_) { return []; }
  }

  function _getPins() {
    try {
      const raw = HT.storage && HT.storage.get('handy-tools.pins', {});
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
      return raw;
    } catch (_) { return {}; }
  }

  function _buildPayload() {
    return Object.freeze({
      version: EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      settings: _buildSettings(),
      history: _buildHistory(),
      favorites: _getStringArray('handy-tools.favorites'),
      recent: _getStringArray('handy-tools.recent'),
      pins: _getPins(),
    });
  }

  function _validatePayload(p) {
    const errors = [];
    if (!p || typeof p !== 'object') {
      errors.push({ path: '', message: 'payload must be an object' });
      return { ok: false, errors };
    }
    if (p.version !== EXPORT_SCHEMA_VERSION) {
      errors.push({ path: 'version', message: 'expected "' + EXPORT_SCHEMA_VERSION + '"' });
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
    return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors: errors };
  }

  function _localDateStamp(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function _triggerDownload(filename, json) {
    if (typeof URL === 'undefined' || typeof Blob === 'undefined') return false;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    if (document.body) document.body.appendChild(a);
    a.click();
    if (document.body && a.parentNode === document.body) document.body.removeChild(a);
    setTimeout(function () { try { URL.revokeObjectURL(url); } catch (_) {} }, REVOKE_DELAY_MS);
    return true;
  }

  function _showToast(msg, ms) {
    try { HT.toast(msg, ms); } catch (_) {}
  }

  function exportToFile() {
    if (_isEmbed()) return { ok: false, reason: 'embed-mode' };
    const payload = _buildPayload();
    const result = _validatePayload(payload);
    if (!result.ok) {
      const firstPath = result.errors.length > 0 && result.errors[0].path ? result.errors[0].path : 'payload';
      try { console.error('Export validation failed:', result.errors); } catch (_) {}
      _showToast('Export validation failed: ' + firstPath, TOAST_SUCCESS_MS);
      return { ok: false, reason: 'validation-failed', errors: result.errors };
    }
    const filename = 'handy-tools-export-' + _localDateStamp(new Date()) + '.json';
    const json = JSON.stringify(payload, null, 2);
    const downloaded = _triggerDownload(filename, json);
    if (downloaded) _showToast('Export complete', TOAST_SUCCESS_MS);
    return { ok: true, filename: filename, payload: payload };
  }

  HT.export = Object.freeze({
    run: exportToFile,
    version: EXPORT_SCHEMA_VERSION,
  });

  Object.defineProperty(window, 'HT_EXPORT_SCHEMA_VERSION', {
    value: Object.freeze({ version: EXPORT_SCHEMA_VERSION }),
    writable: false,
    configurable: false,
    enumerable: true,
  });
})();
