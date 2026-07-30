/* ============================================
   URL Codec
   Encode / decode using encodeURI, encodeURIComponent, decodeURIComponent.
   ============================================ */

(function () {
  'use strict';

  var inEl = HT.$('#url-input');
  var outEl = HT.$('#url-output');
  var status = HT.$('#url-status');

  function setStatus(text, cls) {
    status.className = cls || '';
    status.textContent = text || '';
  }

  inEl.value = 'https://example.com/search?q=hello world&lang=en&tag=café';

  function run(fn, label) {
    try {
      outEl.value = fn(inEl.value);
      setStatus(label + ' · ' + HT.formatNumber(outEl.value.length) + ' chars', 'success');
    } catch (e) {
      setStatus('Failed (' + label + '): ' + (e.message || e), 'error');
    }
  }

  HT.$('#url-encode-uri').addEventListener('click', function () { run(encodeURI, 'encodeURI'); });
  HT.$('#url-encode-comp').addEventListener('click', function () { run(encodeURIComponent, 'encodeURIComponent'); });
  HT.$('#url-decode').addEventListener('click', function () { run(decodeURIComponent, 'decodeURIComponent'); });

  HT.$('#url-copy-input').addEventListener('click', function () { HT.copyToClipboard(inEl.value); });
  HT.$('#url-copy-output').addEventListener('click', function () { HT.copyToClipboard(outEl.value); });
  HT.$('#url-swap').addEventListener('click', function () {
    var t = inEl.value; inEl.value = outEl.value; outEl.value = t;
  });

  // Initial
  run(encodeURI, 'encodeURI');
})();