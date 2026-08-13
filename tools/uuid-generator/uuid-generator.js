/* ============================================
   UUID Generator
   Generate RFC 4122 v1/v4/v7 UUIDs and ULIDs.
   Pure offline identifier generator — uses crypto.getRandomValues
   + crypto.randomUUID (where available) only.
   ============================================ */

(function () {
  'use strict';

  // ---------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------

  var UUID_V147_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  var ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;
  var CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

  // RFC 4122 §4.1.4: Gregorian epoch is 1582-10-15 00:00:00 UTC.
  var GREGORIAN_EPOCH_UNIX_MS = -12219292800000;
  var NS_PER_MS = 10000;
  var CLOCK_SEQ_HI_VARIANT_MASK = 0x3f;
  var RFC4122_VARIANT_TAG = 0x80;

  // ---------------------------------------------------------------
  // Random byte source (Web Crypto preferred)
  // ---------------------------------------------------------------

  function randomBytes(n) {
    var out = new Uint8Array(n);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(out);
      return out;
    }
    for (var i = 0; i < n; i += 1) out[i] = Math.floor(Math.random() * 256);
    return out;
  }

  // ---------------------------------------------------------------
  // UUID v1 — RFC 4122 §4.3
  // ---------------------------------------------------------------

  var clockSeqState = null;

  function nextClockSeq() {
    if (clockSeqState === null) {
      var b = randomBytes(2);
      clockSeqState = ((b[0] << 8) | b[1]) & 0x3fff;
      clockSeqState |= RFC4122_VARIANT_TAG << 8;
    }
    clockSeqState = (clockSeqState + 1) & 0x3fff;
    clockSeqState |= RFC4122_VARIANT_TAG << 8;
    return clockSeqState;
  }

  function uuidV1() {
    var ts100ns = (Date.now() - GREGORIAN_EPOCH_UNIX_MS) * NS_PER_MS;
    var tsLow = (ts100ns & 0xffffffff) >>> 0;
    var tsMid = ((ts100ns / 0x100000000) & 0xffff) >>> 0;
    var tsHi = ((ts100ns / 0x1000000000000) & 0x0fff) >>> 0;
    var clockSeq = nextClockSeq();
    var clockSeqLow = clockSeq & 0xff;
    var clockSeqHiVariant = (clockSeq >> 8) & 0xff;
    var node = randomBytes(6);
    var bytes = new Uint8Array(16);
    bytes[0] = tsLow & 0xff;
    bytes[1] = (tsLow >> 8) & 0xff;
    bytes[2] = (tsLow >> 16) & 0xff;
    bytes[3] = (tsLow >> 24) & 0xff;
    bytes[4] = tsMid & 0xff;
    bytes[5] = (tsMid >> 8) & 0xff;
    bytes[6] = ((tsHi & 0x0f) << 4) | 0x10;
    bytes[7] = (tsHi >> 4) & 0xff;
    bytes[8] = clockSeqHiVariant;
    bytes[9] = clockSeqLow;
    for (var i = 0; i < 6; i += 1) bytes[10 + i] = node[i];
    return formatUuid(bytes);
  }

  // ---------------------------------------------------------------
  // UUID v4 — RFC 4122 §4.4
  // ---------------------------------------------------------------

  function uuidV4() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    var bytes = randomBytes(16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & CLOCK_SEQ_HI_VARIANT_MASK) | RFC4122_VARIANT_TAG;
    return formatUuid(bytes);
  }

  // ---------------------------------------------------------------
  // UUID v7 — RFC 9562 §5.7
  // ---------------------------------------------------------------

  function uuidV7() {
    var ms = Date.now();
    var bytes = new Uint8Array(16);
    bytes[0] = (ms / 0x10000000000) & 0xff;
    bytes[1] = (ms / 0x100000000) & 0xff;
    bytes[2] = (ms / 0x1000000) & 0xff;
    bytes[3] = (ms / 0x10000) & 0xff;
    bytes[4] = (ms / 0x100) & 0xff;
    bytes[5] = ms & 0xff;
    var rand = randomBytes(10);
    for (var j = 0; j < 10; j += 1) bytes[6 + j] = rand[j];
    bytes[6] = (bytes[6] & 0x0f) | 0x70;
    bytes[8] = (bytes[8] & CLOCK_SEQ_HI_VARIANT_MASK) | RFC4122_VARIANT_TAG;
    return formatUuid(bytes);
  }

  // ---------------------------------------------------------------
  // ULID — Crockford base32
  // ---------------------------------------------------------------

  function encodeBase32(bytes, length) {
    var out = '';
    var buf = 0;
    var bits = 0;
    for (var i = 0; i < bytes.length; i += 1) {
      buf = (buf << 8) | bytes[i];
      bits += 8;
      while (bits >= 5) {
        bits -= 5;
        out += CROCKFORD_ALPHABET[(buf >> bits) & 0x1f];
      }
    }
    if (bits > 0) {
      out += CROCKFORD_ALPHABET[(buf << (5 - bits)) & 0x1f];
    }
    return out.slice(0, length);
  }

  function ulid() {
    var ms = Date.now();
    var bytes = new Uint8Array(16);
    bytes[0] = (ms / 0x10000000000) & 0xff;
    bytes[1] = (ms / 0x100000000) & 0xff;
    bytes[2] = (ms / 0x1000000) & 0xff;
    bytes[3] = (ms / 0x10000) & 0xff;
    bytes[4] = (ms / 0x100) & 0xff;
    bytes[5] = ms & 0xff;
    var rand = randomBytes(10);
    for (var i = 0; i < 10; i += 1) bytes[6 + i] = rand[i];
    return encodeBase32(bytes, 26);
  }

  // ---------------------------------------------------------------
  // Hex formatter (UUIDs only)
  // ---------------------------------------------------------------

  var HEX = '0123456789abcdef';

  function formatUuid(bytes) {
    var chars = new Array(36);
    var hexIdx = 0;
    for (var i = 0; i < 16; i += 1) {
      if (i === 4 || i === 6 || i === 8 || i === 10) chars[hexIdx++] = '-';
      var b = bytes[i];
      chars[hexIdx++] = HEX[(b >> 4) & 0x0f];
      chars[hexIdx++] = HEX[b & 0x0f];
    }
    return chars.join('');
  }

  // ---------------------------------------------------------------
  // Validators
  // ---------------------------------------------------------------

  function isValidUuid(s) {
    return typeof s === 'string' && UUID_V147_RE.test(s);
  }

  function isValidUlid(s) {
    return typeof s === 'string' && ULID_RE.test(s);
  }

  function variantNibble(uuid) {
    return uuid[19].toLowerCase();
  }

  function validate(version, value) {
    if (version === 'ulid') return isValidUlid(value);
    if (!isValidUuid(value)) return false;
    if (version === 'v1' && value[14] !== '1') return false;
    if (version === 'v4' && value[14] !== '4') return false;
    if (version === 'v7' && value[14] !== '7') return false;
    var v = variantNibble(value);
    return v === '8' || v === '9' || v === 'a' || v === 'b';
  }

  function patternFor(version) {
    return version === 'ulid' ? ULID_RE.source : UUID_V147_RE.source;
  }

  // ---------------------------------------------------------------
  // Generation dispatch
  // ---------------------------------------------------------------

  var GENERATORS = {
    v1: uuidV1,
    v4: uuidV4,
    v7: uuidV7,
    ulid: ulid,
  };

  function generateOne(version) {
    var fn = GENERATORS[version] || uuidV4;
    return fn();
  }

  function clampCount(raw) {
    var n = parseInt(raw, 10);
    if (!isFinite(n) || isNaN(n) || n < 1) return 1;
    if (n > 100) return 100;
    return n;
  }

  // ---------------------------------------------------------------
  // DOM wiring
  // ---------------------------------------------------------------

  var versionEl = HT.$('#uuid-version');
  var countEl = HT.$('#uuid-count');
  var genBtn = HT.$('#uuid-generate');
  var copyBtn = HT.$('#uuid-copy');
  var outputEl = HT.$('#uuid-output');
  var errorEl = HT.$('#uuid-error');
  var warningEl = HT.$('#uuid-url-warning');

  // --- URL state helpers ---

  function readUrlState() {
    try {
      var params = new URLSearchParams(window.location.search);
      var v = params.get('version');
      var c = params.get('count');
      return { version: v, count: c };
    } catch (e) {
      return { version: null, count: null };
    }
  }

  function writeUrlState(version, count) {
    try {
      var params = new URLSearchParams(window.location.search);
      params.set('version', version);
      params.set('count', String(count));
      var qs = params.toString();
      var url = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
      window.history.replaceState(null, '', url);
    } catch (e) { /* no-op: replaceState may throw in sandboxed iframes */ }
  }

  // --- Apply URL state to the form on load ---

  function applyUrlState() {
    var state = readUrlState();
    var validVersions = ['v1', 'v4', 'v7', 'ulid'];
    var v = validVersions.indexOf(state.version) >= 0 ? state.version : null;
    if (state.version !== null && v === null) {
      // Invalid version → warn + fall back to v4
      if (warningEl) {
        warningEl.textContent = 'Unknown version "' + state.version + '"; defaulted to v4';
        warningEl.hidden = false;
      }
      versionEl.value = 'v4';
    } else if (v !== null) {
      versionEl.value = v;
    } else {
      versionEl.value = 'v4';
    }
    if (state.count !== null) {
      countEl.value = String(clampCount(state.count));
    }
  }

  // --- Render helpers ---

  function clearError() {
    if (!errorEl) return;
    errorEl.textContent = '';
    errorEl.hidden = true;
  }

  function showError(version, value) {
    if (!errorEl) return;
    errorEl.textContent =
      'Failed to generate ' + version + ': regex ' + patternFor(version) +
      ' did not match ' + value;
    errorEl.hidden = false;
  }

  function generate() {
    clearError();
    var version = versionEl.value || 'v4';
    var count = clampCount(countEl.value);
    countEl.value = String(count);
    var lines = [];
    for (var i = 0; i < count; i += 1) {
      var v = generateOne(version);
      if (!validate(version, v)) {
        showError(version, v);
        outputEl.value = '';
        return;
      }
      lines.push(v);
    }
    outputEl.value = lines.join('\n');
    writeUrlState(version, count);

    // History push (per AC-5)
    try {
      if (window.HT && HT.history && typeof HT.history.push === 'function') {
        HT.history.push({
          version: version,
          count: String(count),
        });
      }
    } catch (e) { /* no-op */ }
  }

  // --- Event handlers ---

  if (genBtn) genBtn.addEventListener('click', generate);

  if (versionEl) {
    versionEl.addEventListener('change', function () {
      writeUrlState(versionEl.value, clampCount(countEl.value));
    });
  }

  if (countEl) {
    countEl.addEventListener('input', HT.debounce(function () {
      countEl.value = String(clampCount(countEl.value));
      writeUrlState(versionEl.value, clampCount(countEl.value));
    }, 200));
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      if (outputEl && outputEl.value) {
        HT.copyToClipboard(outputEl.value);
      }
    });
  }

  // --- Keyboard shortcut: g → generate, c → copy ---

  document.addEventListener('keydown', function (ev) {
    // Ignore when typing in inputs/textareas
    var target = ev.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
      return;
    }
    if (ev.key === 'g' || ev.key === 'G') {
      ev.preventDefault();
      generate();
    } else if (ev.key === 'c' || ev.key === 'C') {
      ev.preventDefault();
      if (outputEl && outputEl.value) HT.copyToClipboard(outputEl.value);
    }
  });

  // --- Initial render: apply URL state then generate one ---

  applyUrlState();
  generate();
})();