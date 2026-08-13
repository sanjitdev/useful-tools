/* ============================================
   JWT Inspector
   Decode JWTs and verify HS256 / RS256 / ES256
   signatures offline via Web Crypto. Pure
   client-side — `window.HT.jwt` from
   `assets/js/jwt-codec.js` does the base64url +
   3-segment split; this script handles DOM
   wiring + signature verification.

   Privacy: zero network requests. Tokens and
   secrets are processed locally; the token is
   NOT pushed to the recent-history log
   (sensitive material).

   Keyboard:
     d — decode + verify
     v — re-verify current token
   ============================================ */

(function () {
  'use strict';

  // Defensive guard: assets/js/jwt-codec.js must load BEFORE this script
  // so `window.HT.jwt` is populated. The smoke harness preloads it; the
  // regression sweep does the same via the include-order convention on
  // tools/jwt-inspector/index.html.
  if (!HT.jwt || typeof HT.jwt.decodeJwt !== 'function') {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('jwt-inspector: HT.jwt is unavailable; ' +
        'assets/js/jwt-codec.js must load before jwt-inspector.js.');
    }
    return;
  }

  // ---------------------------------------------------------------
  // Element references
  // ---------------------------------------------------------------

  var tokenEl = HT.$('#jwt-token');
  var secretEl = HT.$('#jwt-secret');
  var pemEl = HT.$('#jwt-pem');
  var secretPanel = HT.$('#jwt-secret-panel');
  var pemPanel = HT.$('#jwt-pem-panel');
  var verifyEl = HT.$('#jwt-verify');
  var expEl = HT.$('#jwt-exp');
  var decodedEl = HT.$('#jwt-decoded');
  var statusEl = HT.$('#jwt-status');

  // ---------------------------------------------------------------
  // Helpers — render + escape
  // ---------------------------------------------------------------

  function setVerify(text, cls) {
    if (!verifyEl) return;
    verifyEl.className = 'jwt-verify ' + (cls || 'pending');
    verifyEl.textContent = text || '';
  }

  function setStatus(text, cls) {
    if (!statusEl) return;
    statusEl.className = cls || '';
    statusEl.textContent = text || '';
  }

  function setExp(text, cls) {
    if (!expEl) return;
    if (text) {
      expEl.textContent = text;
      expEl.className = 'jwt-exp ' + (cls || '');
      expEl.hidden = false;
    } else {
      expEl.textContent = '';
      expEl.className = 'jwt-exp';
      expEl.hidden = true;
    }
  }

  // JSON.stringify for the decoded header/payload pretty-print. We use
  // a function rather than `<pre>` textContent so the indentation is
  // render-stable across browsers.
  function prettyJson(obj) {
    try {
      return JSON.stringify(obj, null, 2);
    } catch (_e) {
      return String(obj);
    }
  }

  function renderEmpty() {
    if (!decodedEl) return;
    decodedEl.innerHTML = '<p class="jwt-empty">Decoded header, payload, and signature appear here.</p>';
  }

  function renderDecoded(decoded, signatureB64url) {
    if (!decodedEl) return;
    var html = '';
    html += '<section class="jwt-header jwt-decoded-section">';
    html += '<h3>Header</h3>';
    html += '<pre><code>' + prettyJson(decoded.header.parsed) + '</code></pre>';
    html += '</section>';
    html += '<section class="jwt-payload jwt-decoded-section">';
    html += '<h3>Payload</h3>';
    html += '<pre><code>' + prettyJson(decoded.payload.parsed) + '</code></pre>';
    html += '</section>';
    html += '<section class="jwt-signature jwt-decoded-section">';
    html += '<h3>Signature</h3>';
    html += '<code class="jwt-sig">' + String(signatureB64url || '') + '</code>';
    html += '</section>';
    decodedEl.innerHTML = html;
  }

  function renderError(msg) {
    if (!decodedEl) return;
    decodedEl.innerHTML = '<p class="jwt-error" role="alert">' + String(msg || 'Failed to decode JWT') + '</p>';
  }

  // ---------------------------------------------------------------
  // Helper — exp rendering
  // ---------------------------------------------------------------

  function renderExp(payload) {
    setExp('', '');
    if (!payload || typeof payload !== 'object') return;
    var exp = payload.exp;
    if (typeof exp !== 'number' || !isFinite(exp)) return;
    var expIso;
    try {
      expIso = new Date(exp * 1000).toISOString();
    } catch (_e) {
      return;
    }
    var now = Math.floor(Date.now() / 1000);
    if (exp < now) {
      setExp('Expired at ' + expIso, 'expired');
    } else {
      setExp('Valid until ' + expIso, 'valid');
    }
  }

  // ---------------------------------------------------------------
  // PEM normalization
  //
  // Web Crypto's `crypto.subtle.importKey('spki', derBytes, ...)`
  // expects the raw DER bytes — not the textual PEM. We strip
  // `-----BEGIN/END-----` headers and base64-decode the body.
  // ---------------------------------------------------------------

  function pemToDer(pemText) {
    if (typeof pemText !== 'string' || !pemText) {
      throw new Error('PEM is empty');
    }
    var body = pemText
      .replace(/-----BEGIN [^-]+-----/g, '')
      .replace(/-----END [^-]+-----/g, '')
      .replace(/\s+/g, '');
    if (!body) throw new Error('PEM body is empty');
    // Reject non-base64 characters (anything outside [A-Za-z0-9+/=]).
    if (!/^[A-Za-z0-9+/=_-]+$/.test(body)) {
      throw new Error('PEM body contains non-base64 characters');
    }
    // Standard base64 alphabet (we convert any URL-safe chars just in case).
    var std = body.replace(/-/g, '+').replace(/_/g, '/');
    var pad = std.length % 4;
    if (pad === 2) std += '==';
    else if (pad === 3) std += '=';
    else if (pad === 1) throw new Error('PEM body has invalid base64 length');
    var bin;
    if (typeof atob === 'function') {
      try {
        bin = atob(std);
      } catch (_e) {
        throw new Error('PEM body is not valid base64');
      }
    } else if (typeof Buffer !== 'undefined') {
      bin = Buffer.from(std, 'base64').toString('binary');
    } else {
      throw new Error('No base64 decoder available');
    }
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  }

  // ---------------------------------------------------------------
  // Verification dispatcher — HS256 / RS256 / ES256 only per ROQ-3
  // ---------------------------------------------------------------

  function unsupportedAlg(alg) {
    return 'Verification for ' + alg + ' is not supported in this tool. Decode is shown above.';
  }

  /**
   * Verify the token signature using the supplied key material.
   * Returns a Promise resolving to { state: 'valid'|'invalid'|'error'|'unsupported',
   *   message: '...' }
   */
  function verify(decoded, headerAndPayload, signatureBytes, secret, pem, alg) {
    if (alg === 'hs256') return verifyHs256(headerAndPayload, signatureBytes, secret);
    if (alg === 'rs256') return verifyRs256(headerAndPayload, signatureBytes, pem);
    if (alg === 'es256') return verifyEs256(headerAndPayload, signatureBytes, pem);
    return Promise.resolve({ state: 'unsupported', message: unsupportedAlg(alg.toUpperCase()) });
  }

  function verifyHs256(headerAndPayload, signatureBytes, secret) {
    if (!secret) {
      return Promise.resolve({ state: 'pending', message: 'Enter a secret to verify HS256 signature' });
    }
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      return Promise.resolve({ state: 'error', message: 'Web Crypto is unavailable in this context' });
    }
    var enc = (typeof TextEncoder !== 'undefined')
      ? new TextEncoder()
      : null;
    var secretBytes = enc ? enc.encode(secret) : null;
    if (!secretBytes) {
      return Promise.resolve({ state: 'error', message: 'TextEncoder unavailable' });
    }
    return crypto.subtle.importKey(
      'raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    ).then(function (key) {
      return crypto.subtle.verify('HMAC', key, signatureBytes, headerAndPayload);
    }).then(function (valid) {
      return valid
        ? { state: 'valid', message: 'Valid signature' }
        : { state: 'invalid', message: 'Invalid signature' };
    }).catch(function (e) {
      return { state: 'error', message: 'Failed to verify HS256: ' + (e.message || e) };
    });
  }

  function verifyRsaOrEc(headerAndPayload, signatureBytes, pem, algoName) {
    if (!pem) {
      return Promise.resolve({ state: 'pending', message: 'Paste a PEM public key to verify ' + algoName.toUpperCase() + ' signature' });
    }
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      return Promise.resolve({ state: 'error', message: 'Web Crypto is unavailable in this context' });
    }
    var derBytes;
    try {
      derBytes = pemToDer(pem);
    } catch (e) {
      return Promise.resolve({ state: 'error', message: 'Failed to import PEM: ' + (e.message || e) });
    }
    var keySpec;
    if (algoName === 'rs256') {
      keySpec = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
    } else {
      keySpec = { name: 'ECDSA', namedCurve: 'P-256' };
    }
    return crypto.subtle.importKey('spki', derBytes, keySpec, false, ['verify'])
      .then(function (key) {
        return crypto.subtle.verify(keySpec, key, signatureBytes, headerAndPayload);
      })
      .then(function (valid) {
        return valid
          ? { state: 'valid', message: 'Valid signature' }
          : { state: 'invalid', message: 'Invalid signature' };
      })
      .catch(function (e) {
        return { state: 'error', message: 'Failed to import PEM: ' + (e.message || e) };
      });
  }

  function verifyRs256(headerAndPayload, signatureBytes, pem) {
    return verifyRsaOrEc(headerAndPayload, signatureBytes, pem, 'rs256');
  }

  function verifyEs256(headerAndPayload, signatureBytes, pem) {
    return verifyRsaOrEc(headerAndPayload, signatureBytes, pem, 'es256');
  }

  // ---------------------------------------------------------------
  // Algorithm panels — show secret for HS256, PEM for RS256/ES256
  // ---------------------------------------------------------------

  function showPanelsForAlg(alg) {
    if (secretPanel) secretPanel.hidden = !(alg === 'hs256');
    if (pemPanel) pemPanel.hidden = !(alg === 'rs256' || alg === 'es256');
  }

  function showPanelsForUnsupported() {
    if (secretPanel) secretPanel.hidden = true;
    if (pemPanel) pemPanel.hidden = true;
  }

  // ---------------------------------------------------------------
  // Process — decode and verify
  // ---------------------------------------------------------------

  /**
   * Cached decoded + signature for the current token. We re-verify
   * (only) when the secret / PEM changes, not on every keystroke.
   */
  var lastToken = '';
  var lastDecoded = null;
  var lastSignature = null;
  var lastAlg = '';
  var verifyInFlight = null;

  function processToken(token) {
    lastToken = token;
    lastDecoded = null;
    lastSignature = null;
    lastAlg = '';

    if (!token || !token.trim()) {
      setVerify('Paste a JWT above to decode and verify.', 'pending');
      setExp('', '');
      renderEmpty();
      return;
    }

    var decoded;
    try {
      decoded = HT.jwt.decodeJwt(token);
    } catch (e) {
      // Distinguish segment-count error vs JSON error for the user.
      var msg = (e && e.message) || String(e);
      setVerify(msg, 'error');
      setExp('', '');
      renderError(msg);
      return;
    }

    lastDecoded = decoded;
    var segs = token.split('.');
    var headerAndPayload = new TextEncoder().encode(segs[0] + '.' + segs[1]);
    var signatureBytes = HT.jwt.base64urlDecode(segs[2]);
    lastSignature = signatureBytes;
    var alg = HT.jwt.getAlg(decoded);
    lastAlg = alg;
    showPanelsForAlg(alg);

    renderDecoded(decoded, segs[2]);
    renderExp(decoded.payload.parsed);
    runVerify(headerAndPayload, signatureBytes, alg, decoded);
  }

  function runVerify(headerAndPayload, signatureBytes, alg, decodedForVerify) {
    if (verifyInFlight && typeof verifyInFlight.cancel === 'function') {
      verifyInFlight.cancel();
    }
    var secret = secretEl ? secretEl.value : '';
    var pem = pemEl ? pemEl.value : '';

    var pending = verify(decodedForVerify, headerAndPayload, signatureBytes, secret, pem, alg);
    verifyInFlight = pending;

    var cancelled = false;
    pending.then(function (result) {
      if (cancelled) return;
      if (verifyInFlight !== pending) return;
      setVerify(result.message, result.state);
    });
    return {
      cancel: function () { cancelled = true; }
    };
  }

  // Re-verify using the LAST decoded signature — bound to secret/PEM input.
  function reVerify() {
    if (!lastDecoded || !lastSignature || !lastToken) {
      setVerify('Paste a JWT above to decode and verify.', 'pending');
      return;
    }
    var segs = lastToken.split('.');
    var headerAndPayload = new TextEncoder().encode(segs[0] + '.' + segs[1]);
    runVerify(headerAndPayload, lastSignature, lastAlg, lastDecoded);
  }

  // ---------------------------------------------------------------
  // URL state — token only (NOT secret, NOT pem) per AC-5/ROQ-1.
  // Embed mode (`?embed=1`) SKIPS token load — privacy.
  // ---------------------------------------------------------------

  function isEmbedMode() {
    try {
      return /[?&]embed=1(?:&|$)/.test(window.location.search);
    } catch (_e) {
      return false;
    }
  }

  function readTokenFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get('token');
    } catch (_e) {
      return null;
    }
  }

  var urlWriteHandle = null;

  function writeUrlState(token) {
    if (isEmbedMode()) return; // never include token in embed URL
    try {
      if (urlWriteHandle) clearTimeout(urlWriteHandle);
      urlWriteHandle = setTimeout(function () {
        var params = new URLSearchParams(window.location.search);
        if (token) params.set('token', token);
        else params.delete('token');
        var qs = params.toString();
        var url = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
        window.history.replaceState(null, '', url);
      }, 250);
    } catch (_e) { /* iframe sandboxed — ignore */ }
  }

  function applyUrlState() {
    if (isEmbedMode()) {
      // Privacy: embed mode omits token URL state entirely.
      return;
    }
    var token = readTokenFromUrl();
    if (token && tokenEl) {
      tokenEl.value = token;
    }
  }

  // ---------------------------------------------------------------
  // Event wiring
  // ---------------------------------------------------------------

  if (tokenEl) {
    tokenEl.addEventListener('input', function () {
      processToken(tokenEl.value || '');
      writeUrlState(tokenEl.value || '');
    });
  }

  if (secretEl) {
    secretEl.addEventListener('input', HT.debounce(reVerify, 200));
  }

  if (pemEl) {
    pemEl.addEventListener('input', HT.debounce(reVerify, 200));
  }

  // Keyboard: d = decode+verify, v = re-verify
  document.addEventListener('keydown', function (ev) {
    var target = ev.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
      return;
    }
    if (ev.key === 'd' || ev.key === 'D') {
      ev.preventDefault();
      if (tokenEl) processToken(tokenEl.value || '');
    } else if (ev.key === 'v' || ev.key === 'V') {
      ev.preventDefault();
      reVerify();
    }
  });

  // ---------------------------------------------------------------
  // History push — token NEVER enters history (AC-4). We only push
  // the algorithm + whether a secret was set.
  // ---------------------------------------------------------------

  function pushHistory() {
    try {
      if (window.HT && HT.history && typeof HT.history.push === 'function') {
        HT.history.push({
          'jwt-alg': lastAlg || '',
          'jwt-secret-set': (secretEl && secretEl.value) ? 'true' : 'false',
        });
      }
    } catch (_e) { /* no-op */ }
  }

  // ---------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------

  applyUrlState();
  var initial = tokenEl ? tokenEl.value : '';
  processToken(initial);
  pushHistory();
})();