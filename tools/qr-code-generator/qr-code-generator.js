/* ============================================
   QR Code Generator tool page
   Uses window.qrcode() from ../../assets/js/qrcode.js
   ============================================ */

(function () {
  'use strict';

  var textEl = HT.$('#qr-text');
  var eccEl = HT.$('#qr-ecc');
  var marginEl = HT.$('#qr-margin');
  var outEl = HT.$('#qr-output');
  var metaEl = HT.$('#qr-meta');
  var btnSvg = HT.$('#qr-download-svg');
  var btnPng = HT.$('#qr-download-png');

  textEl.value = 'https://example.com';

  function render() {
    var text = textEl.value;
    var ecc = eccEl.value;
    var quiet = parseInt(marginEl.value, 10);
    if (!isFinite(quiet) || quiet < 0) quiet = 4;

    if (!text) {
      outEl.innerHTML = '';
      metaEl.textContent = 'Enter some text to generate a QR code.';
      return;
    }

    try {
      var svg = window.qrcode(text, { ecc: ecc, quiet: quiet });
      outEl.innerHTML = svg;
      // Rough metadata
      var sizeMatch = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
      var size = sizeMatch ? parseInt(sizeMatch[1], 10) : '?';
      var modules = size - quiet * 2;
      metaEl.textContent = 'Size: ' + modules + '×' + modules + ' modules · ' +
        'Error correction ' + ecc + ' · ' +
        HT.formatNumber(text.length) + ' chars';
      pushHistoryDebounced(text, ecc, quiet, modules);
    } catch (e) {
      outEl.innerHTML = '';
      metaEl.textContent = 'Failed: ' + (e.message || e);
    }
  }

  // Story 2.3 exemplar: debounced push so each settled text change
  // (rather than every keystroke) lands one history entry.
  var pushHistoryDebounced = HT.debounce(function (text, ecc, quiet, modules) {
    if (!HT.history || typeof HT.history.push !== 'function') return;
    var state = {
      'qr-text': text,
      'qr-ecc': ecc,
      'qr-margin': String(quiet),
    };
    var newest = HT.history.lastEntry('qr-code-generator');
    // History entries use the Story 3.6 shape {ts, inputs, result} —
    // compare against `inputs` so the dedup is symmetric with what
    // we push below. Without this fix every entry would render
    // "No inputs or result" in the panel.
    if (newest && JSON.stringify(newest.inputs) === JSON.stringify(state)) return;
    var preview = text.length > 40 ? (text.slice(0, 37) + '…') : text;
    HT.history.push('qr-code-generator', {
      inputs: state,
      result: modules + '×' + modules + ' modules, ECC ' + ecc,
      label: preview,
    });
  }, 750);

  function downloadSvg() {
    var svg = outEl.querySelector('svg');
    if (!svg) return;
    var xml = new XMLSerializer().serializeToString(svg);
    var blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    triggerDownload(blob, 'qrcode.svg');
  }

  function downloadPng() {
    var svg = outEl.querySelector('svg');
    if (!svg) return;
    var sizeAttr = svg.getAttribute('width');
    var viewBox = svg.getAttribute('viewBox');
    var n = sizeAttr ? parseInt(sizeAttr, 10) : (viewBox ? parseInt(viewBox.split(/\s+/)[1], 10) : 256);
    var scale = 4;
    var px = n * scale;

    var xml = new XMLSerializer().serializeToString(svg);
    var blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement('canvas');
      canvas.width = px;
      canvas.height = px;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, px, px);
      ctx.drawImage(img, 0, 0, px, px);
      URL.revokeObjectURL(url);
      canvas.toBlob(function (b) {
        if (b) triggerDownload(b, 'qrcode.png');
      }, 'image/png');
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      HT.toast('PNG export failed');
    };
    img.src = url;
  }

  function triggerDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  btnSvg.addEventListener('click', downloadSvg);
  btnPng.addEventListener('click', downloadPng);

  textEl.addEventListener('input', HT.debounce(render, 60));
  eccEl.addEventListener('change', render);
  marginEl.addEventListener('input', HT.debounce(render, 60));

  render();
})();