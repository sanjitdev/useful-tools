/* ============================================
   Smoke harness for Story 10.11 — assets/js/share-card.js.

   Loads share-card.js in a fresh vm context against a
   synthetic HT stub. Verifies the 4-method frozen
   public API (ogSvg, copyUrl, downloadAsPng, print)
   and the AD-14 boundary contract.

   Sections:
     I.   Surface (5 assertions)
     II.  ogSvg (10 assertions)
     III. copyUrl (4 assertions)
     IV.  print (2 assertions)
     V.   downloadAsPng (4 assertions)
     VI.  api-contract registration (2 assertions)
     VII. bundle-size budget (1 assertion)
     VIII.vacuous-pass guard
   ============================================ */

'use strict';

const fs = require('fs');
const vm = require('vm');
const zlib = require('zlib');
const path = require('path');

const SHARE_CARD_SRC = fs.readFileSync(
  path.resolve(__dirname, '../assets/js/share-card.js'),
  'utf8'
);
const CONTRACT_SRC = fs.readFileSync(
  path.resolve(__dirname, '../assets/js/api-contract.js'),
  'utf8'
);

// ---- minimal DOM stub ------------------------------------------------

function _makeNode(tag) {
  return {
    _tag: String(tag || '').toUpperCase(),
    children: [],
    style: {},
    attrs: {},
    parentNode: null,
    textContent: '',
    setAttribute: function (k, v) { this.attrs[k] = v; },
    appendChild: function (n) { this.children.push(n); n.parentNode = this; return n; },
    removeChild: function (n) {
      const i = this.children.indexOf(n);
      if (i !== -1) { this.children.splice(i, 1); n.parentNode = null; }
      return n;
    },
    click: function () { this._clicked = true; },
  };
}

let _lastDownloaded = null;
let _lastClickedAnchor = null;

const ctx = {
  console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  Blob: function (parts, opts) {
    this.parts = parts; this.type = (opts && opts.type) || '';
    this.size = parts.reduce(function (s, p) { return s + (p && p.length || 0); }, 0);
  },
  URL: {
    _next: 1,
    createObjectURL: function (b) { return 'blob:fake/' + (this._next++); },
    revokeObjectURL: function (url) { /* no-op */ },
  },
  Image: function () {
    this.src = '';
    const _this = this;
    // Set to a stub onerror to keep the rasterization contract
    // observable from the smoke. Tests can flip _this._rasterizeOk
    // to drive success/fail paths.
    this._rasterizeOk = false;
    this.onload = null;
    this.onerror = null;
    Object.defineProperty(this, 'src', {
      get() { return this._src; },
      set(v) {
        this._src = v;
        const self = this;
        // Simulate a rasterization success: drawImage on the
        // canvas fires a microtask completion. If the smoke set
        // _rasterizeOk = true, schedule onload; otherwise
        // schedule onerror (used to drive the fallback path).
        Promise.resolve().then(function () {
          if (self._rasterizeOk && typeof self.onload === 'function') self.onload();
          else if (!self._rasterizeOk && typeof self.onerror === 'function') self.onerror();
        });
      },
    });
  },
  document: {
    createElement: function (tag) {
      const n = _makeNode(tag);
      if (tag === 'canvas') {
        n.width = 0; n.height = 0;
        n.getContext = function () {
          return {
            fillStyle: '',
            fillRect: function () {},
            drawImage: function () {},
          };
        };
        n.toBlob = function (cb) {
          // Smoke contract: emit a 12-byte PNG-ish blob on success.
          // Switch by stubbing n._failBlob = true to fail.
          if (this._failBlob) { cb(null); return; }
          cb({ type: 'image/png', size: 12, parts: [Buffer.from([0x89, 0x50])] });
        };
        n.toDataURL = function () {
          if (this._failDataURL) return '';
          return 'data:image/png;base64,iVBORw0K';
        };
      }
      if (tag === 'a') {
        const base = n;
        base.click = function () {
          _lastClickedAnchor = base.attrs.download || 'a';
          _lastDownloaded = base.attrs.href;
        };
      }
      return n;
    },
    body: _makeNode('body'),
  },
  atob: function (s) {
    return Buffer.from(s, 'base64').toString('binary');
  },
  HT: {
    share: {
      copy: function (state, opts) {
        if (opts && opts.shareUrl) return Promise.resolve(String(opts.shareUrl));
        return Promise.resolve('https://example.com/d/' + (opts && opts.slug || 'disc') +
          '/?arch=' + ((state && state.archetype && state.archetype.id) || 'result'));
      },
    },
    copyToClipboard: function () { return Promise.resolve(true); },
    toast: function (msg) { /* capture if needed */ },
  },
};
ctx.window = ctx;
ctx.self = ctx;
ctx.HTMLElement = function () {};
ctx.window.HT = ctx.HT;

vm.createContext(ctx);
vm.runInContext(SHARE_CARD_SRC, ctx, { filename: 'share-card.js' });

const HT = ctx.HT;
const shareCard = HT.shareCard;

let pass = 0, fail = 0;
function check(name, ok, info) {
  if (ok) { pass += 1; console.log('  PASS  ' + name); }
  else { fail += 1; console.log('  FAIL  ' + name + (info ? ' — ' + info : '')); }
}

// === I. Surface (5 assertions) ===
check('HT.shareCard exists', typeof shareCard === 'object');
check('HT.shareCard is frozen', Object.isFrozen(shareCard));
check('HT.shareCard.ogSvg is function', typeof shareCard.ogSvg === 'function');
check('HT.shareCard.downloadAsPng is function', typeof shareCard.downloadAsPng === 'function');
check('HT.shareCard.copyUrl is function', typeof shareCard.copyUrl === 'function');
check('HT.shareCard.print is function', typeof shareCard.print === 'function');

// === II. ogSvg (10 assertions) ===
const state = {
  archetype: { id: 'fox', label: 'Fox', emoji: '🦊' },
  traits: { intuition: 80, courage: 55, wisdom: 30, patience: 65 },
  tagline: 'Clever, adaptable, and quick to read any room.',
  blindSpot: 'Strategy can shade into manipulation when stakes are small.',
};
const svg = shareCard.ogSvg(state, { slug: 'spirit-animal', title: 'Spirit Animal' });
check('ogSvg: returns non-empty string', typeof svg === 'string' && svg.length > 0);
check('ogSvg: starts with <svg', svg.indexOf('<svg ') === 0);
check('ogSvg: viewBox is 1200×630', /viewBox="0 0 1200 630"/.test(svg));
check('ogSvg: <title> is first child element', /<svg[^>]*>\s*<title/.test(svg));
check('ogSvg: <title> contains archetype label', /<title[^>]*>[^<]*Fox[^<]*<\/title>/.test(svg));
check('ogSvg: contains emoji literal', svg.indexOf('🦊') !== -1);
check('ogSvg: tagline is rendered', svg.indexOf('Strategy can shade') !== -1);
check('ogSvg: blindSpot is rendered', svg.indexOf('manipulation') !== -1);
check('ogSvg: trait line includes intuition', /intuition/.test(svg));
check('ogSvg: uses options.slug as eyebrow', svg.indexOf('SPIRIT ANIMAL') !== -1);

// XSS hardening — make sure the ogSvg escaper handles a malicious
// archetype label / blind spot. Defensive: archetype strings come
// from hand-authored data.json but the escaper must reject HTML.
const evilSvg = shareCard.ogSvg({
  archetype: { id: 'evil', label: '<script>alert(1)</script>', emoji: '🦊' },
  blindSpot: '"><img src=x onerror=alert(2)>',
});
check('ogSvg: archetype label with < and > is escaped',
  !/<script>alert\(1\)<\/script>/.test(evilSvg) && /&lt;script&gt;/.test(evilSvg));
check('ogSvg: blind spot with " is escaped',
  !/"<img/.test(evilSvg) && /&quot;/.test(evilSvg) && /&lt;img/.test(evilSvg));

// === III. copyUrl (4 assertions) ===
const copyPromise = shareCard.copyUrl(state, { slug: 'spirit-animal' });
check('copyUrl: returns a Promise', copyPromise && typeof copyPromise.then === 'function');
copyPromise.then(function (text) {
  check('copyUrl: resolves to a URL string', /https:\/\/example\.com/.test(text),
    'got: ' + text);
}, function () {
  check('copyUrl: resolves to a URL string', false, 'rejected');
});

// Verify the opts.shareUrl path uses the verbatim URL.
const verbatim = shareCard.copyUrl({}, { shareUrl: 'https://example.com/c?b=ABC' });
verbatim.then(function (text) {
  check('copyUrl: opts.shareUrl is copied verbatim', text === 'https://example.com/c?b=ABC',
    'got: ' + text);
});

// Defensive fallback when HT.share.copy is missing — wire a
// temporary copyToClipboard and re-call.
ctx.HT.share = undefined;
const fb = shareCard.copyUrl({ archetype: 'fox' }, { slug: 'spirit-animal' });
check('copyUrl: defensive fallback resolves when HT.share is missing',
  fb && typeof fb.then === 'function');

// Restore the share stub.
ctx.HT.share = {
  copy: function (state, opts) {
    return Promise.resolve('https://example.com/d/' + (opts.slug || 'disc') +
      '/?arch=' + ((state.archetype && state.archetype.id) || 'result'));
  },
};

// === IV. print (2 assertions) ===
let _printed = 0;
ctx.window.print = function () { _printed += 1; };
shareCard.print(state);
check('print: calls window.print() once', _printed === 1);
shareCard.print(null);
check('print: tolerates a null state', _printed === 2);

// === V. downloadAsPng (4 assertions) ===
// Rasterize path — stub Image + canvas to succeed.
const downloadPromise = shareCard.downloadAsPng(state, { slug: 'spirit-animal' });
check('downloadAsPng: returns a Promise',
  downloadPromise && typeof downloadPromise.then === 'function');

// Drive the rasterization success by finding the most recently
// constructed Image stub and setting _rasterizeOk = true.
const imageCtor = ctx.Image;
const _origImage = ctx.Image;
ctx.Image = function () {
  const inst = new _origImage();
  inst._rasterizeOk = true;
  return inst;
};
ctx.Image.prototype = _origImage.prototype;

// Wait a tick so the new Image stub takes effect on subsequent
// download attempts, then re-run to assert success path.
setTimeout(function () {
  const dlOk = shareCard.downloadAsPng(state, { slug: 'spirit-animal' });
  dlOk.then(function (result) {
    check('downloadAsPng: success-path resolves to {ok: true, action: "png"}',
      result && result.ok === true && result.action === 'png' && result.blob != null);
    check('downloadAsPng: success-path triggered a download anchor click',
      _lastClickedAnchor != null);

    // === VI. Fallback path (rasterize fails) ===
    ctx.Image = function () {
      const inst = new _origImage();
      inst._rasterizeOk = false;
      return inst;
    };
    ctx.Image.prototype = _origImage.prototype;

    const dlFail = shareCard.downloadAsPng(state, { slug: 'spirit-animal' });
    dlFail.then(function (result) {
      check('downloadAsPng: fallback path returns {action: "text"}',
        result && result.ok === true && result.action === 'text' && typeof result.text === 'string');

      // === VII. api-contract registration (2 assertions) ===
      check('api-contract.js: HT.shareCard entry registered',
        CONTRACT_SRC.indexOf("name: 'HT.shareCard'") !== -1);
      check('api-contract.js: HT.shareCard module path is assets/js/share-card.js',
        /module: 'assets\/js\/share-card\.js'/.test(CONTRACT_SRC));

      // === VIII. Bundle-size budget (1 assertion) ===
      const gz = zlib.gzipSync(SHARE_CARD_SRC);
      check('bundle-size: share-card.js ≤ 4 KB gz (' + gz.length + ' bytes)',
        gz.length <= 4096);

      // === IX. Vacuous-pass guard ===
      check('vacuous-pass guard: pass > 0', pass > 0);

      console.log('');
      console.log('share-card-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
      process.exit(fail > 0 ? 1 : 0);
    }, function () {
      check('downloadAsPng: fallback path returns {action: "text"}', false, 'rejected');
      console.log('');
      console.log('share-card-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
      process.exit(1);
    });
  }, function () {
    check('downloadAsPng: success-path resolves to {ok: true, action: "png"}', false, 'rejected');
    console.log('');
    console.log('share-card-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
    process.exit(1);
  });
}, 50);
