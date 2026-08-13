/* ============================================
   Handy Tools — jwt-codec.js (Story 9.5)
   Pure-function JWT codec. base64url + 3-segment
   split + decode. No DOM, no Web Crypto (the
   tool does signature verification via
   crypto.subtle). Exposes `window.HT.jwt` so
   `jwt-inspector.js` (and any future JWT-touching
   tool) can reuse the same implementation. ES2018.
   ============================================ */

(function () {
  'use strict';

  // Node-side boot (smoke harness).
  const _hasWindow = typeof globalThis !== 'undefined' && typeof globalThis.window !== 'undefined';
  if (!_hasWindow) {
    globalThis.window = { HT: {} };
  }
  const window = globalThis.window;
  window.HT = window.HT || {};
  const HT = window.HT;

  // -------------------------------------------------------------
  // base64url — RFC 7515 §2 ("Base64url Encoding")
  //
  // JWTs use a URL-safe base64 variant. Two substitutions are
  // required to convert URL-safe → standard base64:
  //   '-' → '+'
  //   '_' → '/'
  // and `=` padding is stripped. We RE-PAD with `=` to a
  // multiple of 4 because Node `Buffer.from(b64, 'base64')` and
  // browser `atob()` both expect padded input.
  //
  // We use `atob` / `btoa` for ASCII-only payloads (JOSE headers
  // and payloads are required to be valid JSON, which is
  // ASCII-safe). For the binary signature segment we expose
  // base64urlEncodeBytes that operates on a Uint8Array.
  // -------------------------------------------------------------

  function _pad(b64) {
    const rem = b64.length % 4;
    if (rem === 0) return b64;
    if (rem === 2) return b64 + '==';
    if (rem === 3) return b64 + '=';
    // rem === 1 is impossible for valid base64 but guard anyway.
    return b64;
  }

  function _urlSafeToStd(s) {
    return String(s).replace(/-/g, '+').replace(/_/g, '/');
  }

  /**
   * Decode a base64url string into a Uint8Array. Accepts input
   * with or without `=` padding. Uses Node Buffer when
   * `atob` is unavailable (Node < 16).
   */
  function base64urlDecode(s) {
    if (typeof s !== 'string') {
      throw new TypeError('base64urlDecode: expected string');
    }
    const trimmed = s.replace(/\s+/g, '');
    const std = _urlSafeToStd(trimmed);
    const padded = _pad(std);
    if (typeof atob === 'function') {
      const bin = atob(padded);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
      return out;
    }
    // Node fallback (smoke harness).
    const buf = Buffer.from(padded, 'base64');
    const out = new Uint8Array(buf.length);
    for (let i = 0; i < buf.length; i += 1) out[i] = buf[i];
    return out;
  }

  /**
   * Decode a base64url string into a UTF-8 string. Used for
   * JWT header and payload (which are required to be valid
   * UTF-8 JSON).
   */
  function base64urlDecodeString(s) {
    const bytes = base64urlDecode(s);
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    }
    // Node fallback.
    return Buffer.from(bytes).toString('utf-8');
  }

  /**
   * Encode a Uint8Array into a base64url string (no `=`
   * padding). Uses Node Buffer when `btoa` is unavailable.
   */
  function base64urlEncodeBytes(bytes) {
    if (!(bytes instanceof Uint8Array) && !Array.isArray(bytes)) {
      throw new TypeError('base64urlEncodeBytes: expected Uint8Array');
    }
    let std;
    if (typeof btoa === 'function') {
      let bin = '';
      for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
      std = btoa(bin);
    } else {
      std = Buffer.from(bytes).toString('base64');
    }
    return std.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * Encode a UTF-8 string into a base64url string (no `=`
   * padding). Used by tests that need to round-trip ASCII.
   */
  function base64urlEncodeString(s) {
    if (typeof TextEncoder !== 'undefined') {
      return base64urlEncodeBytes(new TextEncoder().encode(String(s)));
    }
    return base64urlEncodeBytes(new Uint8Array(Buffer.from(String(s), 'utf-8')));
  }

  // -------------------------------------------------------------
  // JWT 3-segment split + decode
  // -------------------------------------------------------------

  /**
   * Split a JWT string into its three `.`-separated segments.
   * Returns `{ header, payload, signature }` — each entry is the
   * raw base64url string. Throws if the token has ≠ 3 segments.
   */
  function splitJwt(token) {
    if (typeof token !== 'string') {
      throw new TypeError('splitJwt: expected string');
    }
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('JWT must have exactly 3 segments separated by "."');
    }
    return {
      header: parts[0],
      payload: parts[1],
      signature: parts[2],
    };
  }

  /**
   * Parse a JWT into its decoded segments:
   *   {
   *     header:    { parsed: {...}, raw: '...' },
   *     payload:   { parsed: {...}, raw: '...' },
   *     signature: '...'   // base64url string, NOT decoded
   *   }
   *
   * `header.parsed` and `payload.parsed` are the JSON-parsed
   * objects; `raw` carries the original base64url string so the
   * tool can re-display it. The signature is returned as the
   * base64url string; use base64urlDecode() to obtain the bytes
   * for Web Crypto verification.
   *
   * Throws on segment count mismatch or non-JSON segment.
   */
  function decodeJwt(token) {
    const parts = splitJwt(token);
    let headerParsed = null;
    let payloadParsed = null;
    try {
      headerParsed = JSON.parse(base64urlDecodeString(parts.header));
    } catch (e) {
      throw new Error('Header is not valid JSON: ' + (e.message || e));
    }
    try {
      payloadParsed = JSON.parse(base64urlDecodeString(parts.payload));
    } catch (e) {
      throw new Error('Payload is not valid JSON: ' + (e.message || e));
    }
    return {
      header: { parsed: headerParsed, raw: parts.header },
      payload: { parsed: payloadParsed, raw: parts.payload },
      signature: parts.signature,
    };
  }

  /**
   * Algorithm from the header, lower-cased. Convenience for the
   * tool's verifier dispatcher.
   */
  function getAlg(decoded) {
    if (!decoded || !decoded.header || !decoded.header.parsed) return '';
    const alg = decoded.header.parsed.alg;
    return typeof alg === 'string' ? alg.toLowerCase() : '';
  }

  // -------------------------------------------------------------
  // Self-test (CommonJS only — runs only in Node).
  // ============================================================ */

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      base64urlDecode: base64urlDecode,
      base64urlDecodeString: base64urlDecodeString,
      base64urlEncodeString: base64urlEncodeString,
      base64urlEncodeBytes: base64urlEncodeBytes,
      splitJwt: splitJwt,
      decodeJwt: decodeJwt,
      getAlg: getAlg,
    };
  }

  // -------------------------------------------------------------
  // Browser export — exposed under `window.HT.jwt`.
  // ============================================================ */

  Object.defineProperty(HT, 'jwt', {
    value: Object.freeze({
      base64urlDecode: base64urlDecode,
      base64urlDecodeString: base64urlDecodeString,
      base64urlEncodeString: base64urlEncodeString,
      base64urlEncodeBytes: base64urlEncodeBytes,
      splitJwt: splitJwt,
      decodeJwt: decodeJwt,
      getAlg: getAlg,
    }),
    writable: false,
    configurable: false,
    enumerable: true,
  });
})();