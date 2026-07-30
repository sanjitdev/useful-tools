/* ============================================
   Base64 Codec
   Encode/decode text with full UTF-8 support using TextEncoder/Decoder.
   ============================================ */

(function () {
  'use strict';

  var textEl = HT.$('#b64-text');
  var b64El = HT.$('#b64-b64');
  var status = HT.$('#b64-status');

  // UTF-8-aware base64 encoder: bytes -> base64.
  function bytesToBase64(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  // UTF-8-aware base64 decoder: base64 -> bytes (Latin-1 string).
  function base64ToBytes(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function setStatus(text, cls) {
    status.className = cls || '';
    status.textContent = text || '';
  }

  // Seed an initial demo so first load is non-empty.
  textEl.value = 'Hello, world! 🌍 — UTF-8 works.';

  function doEncode() {
    try {
      var bytes = new TextEncoder().encode(textEl.value);
      b64El.value = bytesToBase64(bytes);
      setStatus('Encoded ' + HT.formatNumber(bytes.length) + ' bytes → ' + HT.formatNumber(b64El.value.length) + ' chars.', 'success');
    } catch (e) {
      setStatus('Encoding failed: ' + (e.message || e), 'error');
    }
  }

  function doDecode() {
    try {
      // Clean input: strip whitespace
      var clean = b64El.value.replace(/\s+/g, '');
      var bytes = base64ToBytes(clean);
      textEl.value = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      setStatus('Decoded ' + HT.formatNumber(clean.length) + ' chars → ' + HT.formatNumber(bytes.length) + ' bytes.', 'success');
    } catch (e) {
      setStatus('Invalid Base64: ' + (e.message || e), 'error');
    }
  }

  HT.$('#b64-encode').addEventListener('click', doEncode);
  HT.$('#b64-decode').addEventListener('click', doDecode);
  HT.$('#b64-copy-text').addEventListener('click', function () { HT.copyToClipboard(textEl.value); });
  HT.$('#b64-copy-b64').addEventListener('click', function () { HT.copyToClipboard(b64El.value); });

  doEncode();
})();