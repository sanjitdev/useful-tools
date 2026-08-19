/* ============================================
   Handy Tools — share-card.js (Story 10.11)

   Share-card chrome for the Discovery Pack result page.
   Three actions:
     1. Copy URL         — HT.shareCard.copyUrl(state, opts)
     2. Download PNG     — HT.shareCard.downloadAsPng(state, opts)
     3. Print            — HT.shareCard.print(state, opts)

   Architecture decisions:
     AD-1   — Pure vanilla, no third-party libs.
     AD-9   — No PII. The OG SVG only contains the archetype
              label + emoji + blind-spot text + a tagline.
     AD-12  — ES2018 vanilla; no build step.
     AD-14  — Shell Public API surface (HT.shareCard is the
              contract). Object.defineProperty writable:false
              configurable:false.

   Module is page-conditional (loaded by the shell-thin
   Proxy factory on first HT.shareCard.* call).
   Bundle target: ≤ 4 KB gz.
   ============================================ */

(function () {
  'use strict';

  var HT = (typeof window !== 'undefined' && window.HT)
        || (typeof self   !== 'undefined' && self.HT)
        || {};
  if (typeof window !== 'undefined' && !window.HT) window.HT = HT;
  if (typeof self   !== 'undefined' && !self.HT)   self.HT  = HT;

  // ---- helpers -----

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _trunc(s, n) {
    s = String(s == null ? '' : s);
    return s.length <= n ? s : s.slice(0, Math.max(0, n - 1)) + '…';
  }

  function _slugInfo(opts) {
    opts = opts || {};
    var slug = opts.slug || 'discovery';
    var title = (opts.title && typeof opts.title === 'string')
      ? opts.title : slug.replace(/-/g, ' ');
    return { slug: slug, title: _trunc(title, 40) };
  }

  // Build a "intuition 80% / courage 55%" line from the trait map.
  function _buildTraitLine(traits) {
    if (!traits || typeof traits !== 'object') return '';
    var ids = Object.keys(traits);
    if (!ids.length) return '';
    ids.sort(function (a, b) { return (traits[b] || 0) - (traits[a] || 0); });
    var parts = [];
    for (var i = 0; i < Math.min(3, ids.length); i++) {
      var v = Number(traits[ids[i]]);
      if (isFinite(v)) parts.push(ids[i] + ' ' + Math.round(v) + '%');
    }
    return parts.join(' / ');
  }

  // ---- ogSvg -----

  // Build the canonical OG SVG string for a result card.
  // 1200×630 viewport, dark background, archetype emoji + label,
  // tagline, blind-spot text, and a "Handy Tools" watermark.
  // The <title> element is the FIRST child so social-media
  // platforms announce the archetype (per H3 in the a11y
  // review follow-ups).
  function ogSvg(state, opts) {
    state = state && typeof state === 'object' ? state : {};
    opts  = opts  && typeof opts  === 'object' ? opts  : {};
    var a = state.archetype || {};
    var info = _slugInfo(opts);
    var emoji = a.emoji || '✨';
    var label = a.label || a.id || 'Result';
    var tagline = state.tagline || opts.tagline || '';
    var blindSpot = state.blindSpot || opts.blindSpot || '';
    var traitLine = _buildTraitLine(state.traits);
    var bg = opts.bgColor || '#4f46e5';
    var fg = opts.fgColor || '#ffffff';
    var accent = opts.accentColor || '#e0e7ff';
    var eyebrow = 'DISCOVER ME · ' + info.title.toUpperCase();
    var wm = 'Handy Tools · handy.tools';
    var p = [];
    p.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" role="img" aria-labelledby="og-title">');
    p.push('<title id="og-title">' + _esc(emoji + ' ' + label + ' — ' + info.title) + '</title>');
    p.push('<rect width="1200" height="630" fill="' + bg + '"/>');
    p.push('<circle cx="1050" cy="120" r="180" fill="' + accent + '" opacity="0.18"/>');
    p.push('<circle cx="150" cy="540" r="220" fill="' + accent + '" opacity="0.12"/>');
    p.push('<text x="80" y="120" font-family="sans-serif" font-size="22" font-weight="600" fill="' + accent + '" letter-spacing="2">' + _esc(eyebrow) + '</text>');
    p.push('<text x="80" y="280" font-family="Apple Color Emoji,Segoe UI Emoji,sans-serif" font-size="160">' + _esc(emoji) + '</text>');
    p.push('<text x="80" y="380" font-family="sans-serif" font-size="84" font-weight="800" fill="' + fg + '">' + _esc(_trunc(label, 60)) + '</text>');
    if (tagline) {
      p.push('<text x="80" y="430" font-family="sans-serif" font-size="26" font-weight="400" fill="' + accent + '">' + _esc(_trunc(tagline, 110)) + '</text>');
    }
    if (traitLine) {
      p.push('<text x="80" y="475" font-family="sans-serif" font-size="22" font-weight="500" fill="' + accent + '" opacity="0.85">' + _esc(_trunc(traitLine, 110)) + '</text>');
    }
    if (blindSpot) {
      p.push('<rect x="80" y="500" width="1040" height="90" rx="12" fill="rgba(255,255,255,0.12)"/>');
      p.push('<text x="100" y="535" font-family="sans-serif" font-size="20" font-weight="600" fill="' + accent + '">Blind spot</text>');
      p.push('<text x="100" y="568" font-family="sans-serif" font-size="22" font-weight="400" fill="' + fg + '">' + _esc(_trunc(blindSpot, 220)) + '</text>');
    }
    p.push('<text x="1200" y="600" font-family="sans-serif" font-size="18" font-weight="500" fill="' + accent + '" text-anchor="end" opacity="0.7">' + _esc(wm) + '</text>');
    p.push('</svg>');
    return p.join('');
  }

  // ---- canvas-to-PNG primitive -----

  function _makeCanvas() {
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      var c = document.createElement('canvas');
      c.width = 1200; c.height = 630;
      return c;
    }
    if (typeof OffscreenCanvas !== 'undefined') {
      try { return new OffscreenCanvas(1200, 630); } catch (_) { /* no-op */ }
    }
    return null;
  }

  // Rasterize the OG SVG to a PNG Blob. Returns a Promise<Blob>.
  function _svgToBlob(svgString) {
    return new Promise(function (resolve, reject) {
      if (typeof document === 'undefined' || typeof Image === 'undefined') {
        reject(new Error('canvas unavailable')); return;
      }
      var canvas = _makeCanvas();
      if (!canvas) { reject(new Error('canvas unavailable')); return; }
      var ctx = canvas.getContext && canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas surface unavailable')); return; }
      var svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      var url = (typeof URL !== 'undefined' && URL.createObjectURL)
        ? URL.createObjectURL(svgBlob) : '';
      if (!url) { reject(new Error('blob URL unavailable')); return; }
      var img = new Image();
      img.onload = function () {
        try {
          ctx.fillStyle = '#4f46e5';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          if (typeof URL !== 'undefined' && URL.revokeObjectURL) {
            try { URL.revokeObjectURL(url); } catch (_) { /* no-op */ }
          }
          if (typeof canvas.toBlob === 'function') {
            try {
              canvas.toBlob(function (blob) {
                if (blob) resolve(blob); else reject(new Error('toBlob returned null'));
              }, 'image/png');
              return;
            } catch (err) { reject(err); return; }
          }
          var dataUrl = canvas.toDataURL('image/png');
          if (dataUrl && /^data:image\/png/.test(dataUrl)) {
            try {
              var bin = atob(dataUrl.split(',')[1]);
              var bytes = new Uint8Array(bin.length);
              for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              resolve(new Blob([bytes], { type: 'image/png' }));
              return;
            } catch (err) { reject(err); return; }
          }
          reject(new Error('toDataURL produced no PNG'));
        } catch (err) { reject(err); }
      };
      img.onerror = function () {
        if (typeof URL !== 'undefined' && URL.revokeObjectURL) {
          try { URL.revokeObjectURL(url); } catch (_) { /* no-op */ }
        }
        reject(new Error('image load failed'));
      };
      img.src = url;
    });
  }

  function _downloadBlob(blob, filename) {
    if (typeof document === 'undefined' || typeof URL === 'undefined' ||
        typeof URL.createObjectURL !== 'function') {
      return false;
    }
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename || 'share-card.png';
    a.setAttribute('data-ht-share-card', 'download');
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    try { document.body.removeChild(a); } catch (_) { /* no-op */ }
    setTimeout(function () {
      try { URL.revokeObjectURL(url); } catch (_) { /* no-op */ }
    }, 5000);
    return true;
  }

  function _downloadFilename(state, opts) {
    opts = opts || {};
    var slug = opts.slug || 'discovery';
    var arch = state && state.archetype;
    var archId = (arch && typeof arch === 'object') ? (arch.id || 'result')
              : (arch ? String(arch) : 'result');
    return (slug + '-' + archId + '.png').replace(/[^a-z0-9._-]/gi, '-');
  }

  // ---- public API -----

  // Copy URL — delegates to HT.share.copy.
  function copyUrl(state, opts) {
    opts = opts || {};
    if (HT.share && typeof HT.share.copy === 'function') {
      try { return HT.share.copy(state, opts); }
      catch (err) { return Promise.reject(err); }
    }
    // Defensive fallback — compose URL from slug + archetype.
    var text = '';
    if (state && typeof state.shareUrl === 'string') text = state.shareUrl;
    else if (opts.shareUrl) text = String(opts.shareUrl);
    else {
      var s = opts.slug ? String(opts.slug) : '';
      var arch = state && state.archetype;
      var a = '';
      if (arch) {
        if (typeof arch === 'string') a = arch;
        else if (arch && typeof arch === 'object' && arch.id) a = String(arch.id);
      }
      if (s && a) {
        var origin = (typeof window !== 'undefined' && window.location && window.location.origin)
          ? window.location.origin : '';
        var basePath = (typeof window !== 'undefined' && window.location && window.location.pathname)
          ? window.location.pathname.replace(/[^/]*$/, '') : '/';
        text = origin + basePath + 'discovery/' + encodeURIComponent(s) +
               '/?archetype=' + encodeURIComponent(a);
      }
    }
    if (!text) return Promise.reject(new Error('shareCard.copyUrl: no URL'));
    if (HT.copyToClipboard) {
      try {
        var r = HT.copyToClipboard(text);
        if (r && typeof r.then === 'function') return r.then(function () { return text; });
        return Promise.resolve(text);
      } catch (err) { return Promise.reject(err); }
    }
    return Promise.reject(new Error('shareCard.copyUrl: clipboard unavailable'));
  }

  // Fallback to text path — used when canvas.toBlob is absent or
  // rasterization fails.
  function _fallbackToText(state, opts, reason) {
    return copyUrl(state, opts).then(function (text) {
      if (HT.toast) {
        try { HT.toast('Plain text copied (PNG unavailable)'); } catch (_) { /* no-op */ }
      }
      return { ok: true, action: 'text', text: text, reason: reason };
    }, function (err) {
      if (HT.toast) {
        try { HT.toast('Share failed'); } catch (_) { /* no-op */ }
      }
      return Promise.reject(err);
    });
  }

  // Download PNG. Falls back to copyUrl() per the spec.
  function downloadAsPng(state, opts) {
    opts = opts || {};
    var svg = ogSvg(state, opts);
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      return _fallbackToText(state, opts, 'canvas unavailable');
    }
    return _svgToBlob(svg).then(function (blob) {
      var filename = _downloadFilename(state, opts);
      var triggered = _downloadBlob(blob, filename);
      if (!triggered) return _fallbackToText(state, opts, 'download trigger unavailable');
      if (HT.toast) {
        try { HT.toast('PNG download started'); } catch (_) { /* no-op */ }
      }
      return { ok: true, action: 'png', blob: blob };
    }, function (err) {
      return _fallbackToText(state, opts, (err && err.message) || 'png failed');
    });
  }

  // Print — chrome-stripped via the @media print block.
  function print(state) {
    if (state && typeof state !== 'object') state = {};
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      try { window.print(); } catch (_) { /* no-op */ }
    }
  }

  // ---- AD-14 freeze ----

  var publicApi = Object.freeze({
    ogSvg: ogSvg,
    downloadAsPng: downloadAsPng,
    copyUrl: copyUrl,
    print: print,
  });

  try {
    Object.defineProperty(HT, 'shareCard', {
      value: publicApi,
      writable: false,
      configurable: false,
      enumerable: true,
    });
  } catch (_) {
    try { HT.shareCard = publicApi; } catch (__) { /* no-op */ }
  }
  if (typeof window !== 'undefined') window.HT = HT;
  if (typeof self   !== 'undefined') self.HT  = HT;
})();
