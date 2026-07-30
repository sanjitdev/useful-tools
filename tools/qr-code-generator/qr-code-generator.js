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
    } catch (e) {
      outEl.innerHTML = '';
      metaEl.textContent = 'Failed: ' + (e.message || e);
    }
  }

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