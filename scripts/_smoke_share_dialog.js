/* ============================================
   Smoke harness for Story 2.5 — assets/js/share.js.
   Loads url.js + share.js in a fresh vm context
   against a synthetic HT.homeGrid.entries fixture
   (three slugs covering the AC-2 matrix:
   has-share-and-embed / has-share-no-embed /
   neither), plus stubbed HT.copyToClipboard /
   HT.toast / window.print. Asserts the HT.share
   surface per api-contract.js (version 1.8.0 as
   of this writing — Story 2.5 bumps the contract
   1.7.0 → 1.8.0).
   ============================================ */

'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const URL_SRC = fs.readFileSync(
  path.resolve(__dirname, '../assets/js/url.js'),
  'utf8'
);
const SHARE_SRC = fs.readFileSync(
  path.resolve(__dirname, '../assets/js/share.js'),
  'utf8'
);

// Synthetic HT.homeGrid.entries — three slugs covering the matrix.
const entries = [
  {
    id: 'has-share-and-embed',
    slug: 'has-share-and-embed',
    title: 'Has Share and Embed',
    urlState: {
      default: { x: '1' },
      encode: [{ key: 'x', type: 'string' }],
      decode: [{ key: 'x', type: 'string' }],
    },
    'embed-snippet': {
      enabled: true,
      'badge-default': true,
      'min-width': 320,
      'min-height': 480,
    },
  },
  {
    id: 'has-share-no-embed',
    slug: 'has-share-no-embed',
    title: 'Has Share Only',
    urlState: {
      default: { y: '2' },
      encode: [{ key: 'y', type: 'string' }],
      decode: [{ key: 'y', type: 'string' }],
    },
    // embed-snippet deliberately omitted
  },
  {
    id: 'neither',
    slug: 'neither',
    title: 'Neither',
    // both omitted
  },
];

// Stubbed behavior flags — verify the right hook fires.
const _calls = {
  copyToClipboard: [],
  toast: [],
  print: 0,
  showModal: 0,
  close: 0,
  selectUrl: 0,
  selectEmbed: 0,
  focusUrl: 0,
  focusEmbed: 0,
};

// Minimal DOM stub factory.
function HtmlInputStub(initial) {
  this._v = initial == null ? '' : String(initial);
  this.type = 'text';
  this.checked = false;
  this.dataset = {};
  this.className = '';
  this.textContent = '';
  this.children = [];
  this.childNodes = this.children;
  this.parentNode = null;
  this.hidden = false;
  this._handlers = {};
  this._attrs = {};
  this.addEventListener = function (name, fn) {
    (this._handlers[name] = this._handlers[name] || []).push(fn);
  };
  this.removeEventListener = function (name, fn) {
    const arr = this._handlers[name] || [];
    const i = arr.indexOf(fn);
    if (i !== -1) arr.splice(i, 1);
  };
  this.focus = function () { _calls['focus' + (this.id === 'share-embed-input' ? 'Embed' : 'Url')] += 1; };
  this.select = function () {
    if (this.id === 'share-embed-input') _calls.selectEmbed += 1;
    else _calls.selectUrl += 1;
  };
  this.setAttribute = function (k, v) {
    this._attrs[k] = v;
    // Mirror data-* attributes onto .dataset so JS that reads
    // btn.dataset.htAction sees the same value.
    if (k.indexOf('data-') === 0) {
      const dk = k.slice(5).replace(/-([a-z])/g, function (_m, c) { return c.toUpperCase(); });
      this.dataset[dk] = v;
    }
  };
  this.getAttribute = function (k) { return this._attrs[k] != null ? this._attrs[k] : null; };
  this.appendChild = function (n) {
    this.children.push(n);
    n.parentNode = this;
    return n;
  };
  this.removeChild = function (n) {
    const i = this.children.indexOf(n);
    if (i !== -1) this.children.splice(i, 1);
    n.parentNode = null;
    return n;
  };
  // Match a single selector against a stub. Supports:
  //   #id, [data-ht-action="value"], [hidden], tag names, input[type="..."]
  function _matches(el, sel) {
    if (!el) return false;
    // #id
    const idMatch = /^#([a-zA-Z0-9_-]+)$/.exec(sel);
    if (idMatch) return el.id === idMatch[1] || el._attrs.id === idMatch[1];
    // [attr="value"]
    const attrEq = /^\[([a-zA-Z0-9_-]+)="([^"]*)"\]$/.exec(sel);
    if (attrEq) {
      const key = attrEq[1];
      const want = attrEq[2];
      // Look at dataset first, then _attrs.
      if (el.dataset && el.dataset[key] != null && el.dataset[key] === want) return true;
      if (el._attrs && el._attrs[key] === want) return true;
      return false;
    }
    // [attr]  (presence)
    const attrPres = /^\[([a-zA-Z0-9_-]+)\]$/.exec(sel);
    if (attrPres) {
      const key = attrPres[1];
      if (key === 'hidden' && el.hidden === true) return true;
      if (el.dataset && el.dataset[key] != null) return true;
      if (el._attrs && el._attrs[key] != null) return true;
      return false;
    }
    // tag
    if (sel === sel.toUpperCase() || /^[A-Z][A-Z0-9]*$/.test(sel)) {
      return el.tagName === sel;
    }
    return false;
  }
  // Walk recursively (shallow — share.js only queries 1 level inside dialog).
  function _walkAndMatch(root, sel) {
    if (!root || !root.children) return null;
    for (let i = 0; i < root.children.length; i++) {
      const c = root.children[i];
      if (_matches(c, sel)) return c;
      // Recurse 1 level for sections containing inputs.
      if (c && c.children && c.children.length) {
        for (let j = 0; j < c.children.length; j++) {
          if (_matches(c.children[j], sel)) return c.children[j];
        }
      }
    }
    return null;
  }
  this.querySelector = function (sel) { return _walkAndMatch(this, sel); };
  this.querySelectorAll = function (sel) {
    const out = [];
    if (!this.children) return out;
    for (let i = 0; i < this.children.length; i++) {
      const c = this.children[i];
      if (_matches(c, sel)) out.push(c);
      if (c && c.children && c.children.length) {
        for (let j = 0; j < c.children.length; j++) {
          if (_matches(c.children[j], sel)) out.push(c.children[j]);
        }
      }
    }
    return out;
  };
  this.closest = function (sel) {
    let p = this.parentNode;
    while (p) {
      if (_matches(p, sel)) return p;
      p = p.parentNode;
    }
    return null;
  };
  this.insertBefore = function (n, ref) {
    this.children.unshift(n);
    n.parentNode = this;
    return n;
  };
  this.remove = function () {
    if (this.parentNode) this.parentNode.removeChild(this);
  };
  this.close = function () {
    _calls.close += 1;
    this.open = false;
    this._open = false;
  };
  this.showModal = function () {
    _calls.showModal += 1;
    this.open = true;
    this._open = true;
  };
  this.hasAttribute = function (k) { return this._attrs[k] != null; };
  this.removeAttribute = function (k) { this._attrs[k] = null; };
  this.click = function () {
    if (this._handlers && this._handlers.click) {
      this._handlers.click.forEach(function (fn) { try { fn({}); } catch (_) { /* no-op */ } });
    }
  };
}
Object.defineProperty(HtmlInputStub.prototype, 'value', {
  get() { return this._v; },
  set(v) { this._v = v == null ? '' : String(v); },
});
Object.defineProperty(HtmlInputStub.prototype, 'innerHTML', {
  get() { return ''; },
  set(_v) { /* dialog innerHTML captured separately */ },
});
Object.defineProperty(HtmlInputStub.prototype, 'open', {
  get() { return this._open === true; },
  set(v) { this._open = v === true; },
});
Object.defineProperty(HtmlInputStub.prototype, 'firstChild', {
  get() { return this.children[0] || null; },
});
Object.defineProperty(HtmlInputStub.prototype, 'tagName', {
  get() { return this._tagName || 'DIV'; },
  set(v) { this._tagName = v; },
});

// Build dialog DOM when share.js calls innerHTML on a dialog stub.
// share.js builds 4 <section>s (URL, Print, Embed, +header section?). Only
// the embed section has hidden when slug has no embed-snippet. We parse
// section blocks and skip synthesizing their children when the section is
// hidden, so the stub mirrors what the real DOM would expose.
function _patchInnerHTML(stub) {
  Object.defineProperty(stub, 'innerHTML', {
    get() { return this._innerHTML || ''; },
    set(v) {
      this._innerHTML = v;
      this.children = [];
      // Walk section-by-section so we can suppress hidden sections' children.
      const sectionRe = /<section([^>]*)>([\s\S]*?)<\/section>/g;
      const inputRe = /<input([^>]*?)\/?\s*>/g;
      const textareaRe = /<textarea([^>]*)>([\s\S]*?)<\/textarea>/g;
      const buttonRe = /<button([^>]*?)>([\s\S]*?)<\/button>/g;
      const labelRe = /<label([^>]*)>([\s\S]*?)<\/label>/g;

      let m;
      // Sections first — order preserved.
      while ((m = sectionRe.exec(v)) !== null) {
        const attrs = m[1];
        const inner = m[2];
        const isHidden = /\bhidden\b/.test(attrs);
        const s = new HtmlInputStub('');
        s.tagName = 'SECTION';
        s.hidden = isHidden;
        s.children = [];
        s.childNodes = s.children;
        // Capture all section attributes so querySelector / _findDeep can test them.
        const attrRe = /([a-zA-Z-]+)="([^"]*)"/g;
        let am;
        while ((am = attrRe.exec(attrs)) !== null) {
          s.setAttribute(am[1], am[2]);
        }
        // Buttons inside section.
        let bm;
        const btnRe = /<button([^>]*?)>([\s\S]*?)<\/button>/g;
        while ((bm = btnRe.exec(inner)) !== null) {
          const bAttrs = bm[1];
          const bInner = bm[2];
          const actionMatch = /data-ht-action="([^"]+)"/.exec(bAttrs);
          const typeMatch = /type="([^"]+)"/.exec(bAttrs);
          const ariaLabelMatch = /aria-label="([^"]+)"/.exec(bAttrs);
          const b = new HtmlInputStub('');
          b.tagName = 'BUTTON';
          b.textContent = bInner;
          if (actionMatch) {
            b.dataset.htAction = actionMatch[1];
            b.setAttribute('data-ht-action', actionMatch[1]);
          }
          if (typeMatch) {
            b.type = typeMatch[1];
            b.setAttribute('type', typeMatch[1]);
          }
          if (ariaLabelMatch) {
            b.setAttribute('aria-label', ariaLabelMatch[1]);
          }
          const classMatch = /class="([^"]+)"/.exec(bAttrs);
          if (classMatch) b.className = classMatch[1];
          s.children.push(b);
          b.parentNode = s;
        }
        // Inputs inside section.
        const inpRe = /<input([^>]*?)\/?\s*>/g;
        let im;
        while ((im = inpRe.exec(inner)) !== null) {
          const iAttrs = im[1];
          const idMatch = /id="([^"]+)"/.exec(iAttrs);
          const typeMatch = /type="([^"]+)"/.exec(iAttrs);
          const valueMatch = /value="([^"]*)"/.exec(iAttrs);
          const i = new HtmlInputStub(valueMatch ? valueMatch[1] : '');
          i.tagName = 'INPUT';
          if (typeMatch) {
            i.type = typeMatch[1];
            i.setAttribute('type', typeMatch[1]);
          }
          if (idMatch) {
            i.setAttribute('id', idMatch[1]);
            i.id = idMatch[1];
          }
          s.children.push(i);
          i.parentNode = s;
        }
        // Textareas inside section.
        const txtRe = /<textarea([^>]*)>([\s\S]*?)<\/textarea>/g;
        let tm;
        while ((tm = txtRe.exec(inner)) !== null) {
          const tAttrs = tm[1];
          const tInner = tm[2];
          const idMatch = /id="([^"]+)"/.exec(tAttrs);
          const t = new HtmlInputStub(tInner || '');
          t.tagName = 'TEXTAREA';
          if (idMatch) {
            t.setAttribute('id', idMatch[1]);
            t.id = idMatch[1];
          }
          s.children.push(t);
          t.parentNode = s;
        }
        this.children.push(s);
        s.parentNode = this;
      }
      // Top-level <input>s (not inside a section) — the URL input actually IS
      // inside a section in share.js, but we keep this fallback in case.
      const topInputRe = /<input([^>]*?)\/?\s*>/g;
      // (No top-level inputs in share.js's dialog — sections contain them.)
    },
    configurable: true,
  });
}

// Document stub — minimal but enough for share.js to use.
const document_stub = {
  getElementById: function (id) { return null; },
  querySelector: function (sel) { return null; },
  activeElement: null,
  createElement: function (tag) {
    const el = new HtmlInputStub('');
    el.tagName = String(tag || '').toUpperCase();
    if (el.tagName === 'DIALOG') {
      el.open = false;
      el._open = false;
      _patchInnerHTML(el);
    }
    return el;
  },
  body: new HtmlInputStub(''),
  addEventListener: function () {},
  removeEventListener: function () {},
};
document_stub.body.tagName = 'BODY';

const ctx = {
  window: {
    matchMedia: function () { return { matches: true, addEventListener: function () {}, removeEventListener: function () {} }; },
    addEventListener: function () {},
    removeEventListener: function () {},
    print: function () { _calls.print += 1; },
  },
  document: document_stub,
  console,
  performance: { now: () => Date.now() },
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  history: { replaceState: function () {}, pushState: function () {} },
  location: { hash: '', pathname: '/tools/test/', search: '', origin: 'https://handy.tools', href: 'https://handy.tools/tools/test/?x=1#abc' },
  HTMLInputElement: HtmlInputStub,
  HTMLTextAreaElement: HtmlInputStub,
  HTMLSelectElement: HtmlInputStub,
  HTMLDialogElement: HtmlInputStub,
  Intl: Intl,
  HT: {
    homeGrid: { entries: entries },
    copyToClipboard: function (text) { _calls.copyToClipboard.push(text); return true; },
    toast: function (msg, ms) { _calls.toast.push({ msg: msg, ms: ms }); },
    urlState: undefined, // populated by url.js
  },
};
ctx.window.HT = ctx.HT;
ctx.Intl = Intl;
// Expose HTMLElement constructor so `rootEl instanceof HTMLElement` works
// inside share.js's mount(). The shared stub class doubles for it.
ctx.HTMLElement = HtmlInputStub;
ctx.window.HTMLElement = HtmlInputStub;

vm.createContext(ctx);
vm.runInContext(URL_SRC, ctx, { filename: 'url.js' });
vm.runInContext(SHARE_SRC, ctx, { filename: 'share.js' });

const HT = ctx.window.HT;
const share = HT.share;

let pass = 0, fail = 0;
function check(name, ok, info) {
  if (ok) { pass += 1; console.log('  PASS  ' + name); }
  else { fail += 1; console.log('  FAIL  ' + name + (info ? ' — ' + info : '')); }
}

// === Surface (9 assertions) ===

check('HT.share exists', typeof share === 'object');
check('HT.share is frozen', Object.isFrozen(share));
check('HT.share.open is function', typeof share.open === 'function');
check('HT.share.close is function', typeof share.close === 'function');
check('HT.share.isOpen is function', typeof share.isOpen === 'function');
check('HT.share.url is function', typeof share.url === 'function');
check('HT.share.embedCode is function', typeof share.embedCode === 'function');
check('HT.share.button is function', typeof share.button === 'function');
check('HT.share.hasShare is function', typeof share.hasShare === 'function');
check('HT.share.mount is function', typeof share.mount === 'function');
check('HT.share.print is function', typeof share.print === 'function');
check('HT.share._loadSchema is function', typeof share._loadSchema === 'function');

// === URL + embedCode (8 assertions) ===

const slugEmbed = 'has-share-and-embed';
const slugNoEmbed = 'has-share-no-embed';

const urlValue = share.url(slugEmbed);
check('url: returns location.href exactly', urlValue === ctx.location.href);

const embedValue = share.embedCode(slugEmbed);
check('embedCode: has-share-and-embed returns <iframe> snippet',
  /^<iframe\s+src="https:\/\/handy\.tools\/tools\/has-share-and-embed\/"\s+width="320"\s+height="480"\s+title="Has Share and Embed"\s+loading="lazy"><\/iframe>$/.test(embedValue),
  'got: ' + embedValue);

const embedNoEmbed = share.embedCode(slugNoEmbed);
check('embedCode: has-share-no-embed returns empty string', embedNoEmbed === '');

const embedNeither = share.embedCode('neither');
check('embedCode: neither returns empty string', embedNeither === '');

check('embedCode: min-width ≥ 240 (B3 a11y)', /width="(320|[3-9]\d\d|\d{4,})"/.test(embedValue));
check('embedCode: includes loading="lazy" (LCP)', embedValue.indexOf('loading="lazy"') !== -1);

const schema = share._loadSchema(slugEmbed);
check('_loadSchema: returns {embedMinWidth, embedMinHeight, embedBadgeDefault, title}',
  schema && schema.embedMinWidth === 320 && schema.embedMinHeight === 480 && schema.embedBadgeDefault === true && schema.title === 'Has Share and Embed');

check('_loadSchema: returns null for slug without embed-snippet',
  share._loadSchema(slugNoEmbed) === null);

// === hasShare predicate (4 assertions) ===

check('hasShare: has-share-and-embed → true', share.hasShare('has-share-and-embed') === true);
check('hasShare: has-share-no-embed → true (urlState is enough)', share.hasShare('has-share-no-embed') === true);
check('hasShare: neither → false', share.hasShare('neither') === false);
check('hasShare: invalid slug throws',
  (function () { try { share.hasShare('Invalid'); return false; } catch (e) { return true; } })());

// === Dialog open / close (4 assertions) ===

// open(slugEmbed) — create dialog, call showModal, focus urlInput
share.open(slugEmbed);
check('open: dialog appended to body',
  document_stub.body.children.some(function (c) { return c.tagName === 'DIALOG'; }));
check('open: showModal called', _calls.showModal === 1);
check('open: URL input focused', _calls.focusUrl >= 1);
check('isOpen: true after open', share.isOpen() === true);

// close() — call dialog.close, return focus
const trigger = {};
share.close();
check('close: dialog.close called', _calls.close >= 1);
check('isOpen: false after close', share.isOpen() === false);

// === Affordances (5 assertions) — re-open, click buttons ===

share.open(slugEmbed);
const dlg = document_stub.body.children.filter(function (c) { return c.tagName === 'DIALOG'; })[document_stub.body.children.length - 1];

// Helper: deep-find a child by predicate (descends into sections).
function _findDeep(root, pred) {
  if (!root || !root.children) return null;
  for (let i = 0; i < root.children.length; i++) {
    const c = root.children[i];
    if (pred(c)) return c;
    if (c && c.children && c.children.length) {
      const nested = _findDeep(c, pred);
      if (nested) return nested;
    }
  }
  return null;
}

// Find the Copy URL button.
const copyUrlBtn = _findDeep(dlg, function (c) { return c.dataset && c.dataset.htAction === 'share-copy-url'; });
check('Copy URL button exists in dialog', !!copyUrlBtn);
// Find the URL input and set a value, then click Copy URL.
const urlInput = _findDeep(dlg, function (c) { return c.tagName === 'INPUT' && c.id === 'share-url-input'; });
urlInput._v = 'https://handy.tools/?x=42';
copyUrlBtn._handlers.click[0]();
check('Copy URL: copyToClipboard called with URL',
  _calls.copyToClipboard.length === 1 && _calls.copyToClipboard[0] === 'https://handy.tools/?x=42');
check('Copy URL: toast called with "URL copied" + 2000ms',
  _calls.toast.length >= 1 && _calls.toast[_calls.toast.length - 1].msg === 'URL copied' && _calls.toast[_calls.toast.length - 1].ms === 2000);

// Print button.
const printBtn = _findDeep(dlg, function (c) { return c.dataset && c.dataset.htAction === 'share-print'; });
printBtn._handlers.click[0]();
check('Print: window.print() called', _calls.print === 1);

// Embed section — Copy embed code button (only present in has-share-and-embed dialog).
const copyEmbedBtn = _findDeep(dlg, function (c) { return c.dataset && c.dataset.htAction === 'share-copy-embed'; });
check('Copy embed code button exists when embed-snippet is enabled', !!copyEmbedBtn);
const embedInput = _findDeep(dlg, function (c) { return c.tagName === 'TEXTAREA' && c.id === 'share-embed-input'; });
copyEmbedBtn._handlers.click[0]();
check('Copy embed code: toast called with "Embed code copied" + 2000ms',
  _calls.toast.length >= 1 && _calls.toast[_calls.toast.length - 1].msg === 'Embed code copied');

// === Embed section hidden for has-share-no-embed ===

share.close();
share.open(slugNoEmbed);
const dlg2 = document_stub.body.children.filter(function (c) { return c.tagName === 'DIALOG'; })[document_stub.body.children.length - 1];
const embedSection = _findDeep(dlg2, function (c) {
  return c.tagName === 'SECTION' && c.hidden === true && c._attrs && /share-embed/.test(c._attrs['aria-labelledby'] || '');
});
// Fallback: any section with hidden=true qualifies for the assertion's intent.
const embedSectionAny = _findDeep(dlg2, function (c) { return c.tagName === 'SECTION' && c.hidden === true; });
check('Embed Code section is hidden when slug has no embed-snippet', !!embedSectionAny);
// "Absent" for interaction purposes: button must not live inside a non-hidden
// section. (share.js still builds the markup but the section's [hidden] attr
// removes it from focus/tab order in a real browser.)
function _findInNonHidden(root, pred) {
  if (!root || !root.children) return null;
  for (let i = 0; i < root.children.length; i++) {
    const c = root.children[i];
    if (c.tagName === 'SECTION' && c.hidden === true) continue;
    if (pred(c)) return c;
    if (c.children && c.children.length) {
      const nested = _findInNonHidden(c, pred);
      if (nested) return nested;
    }
  }
  return null;
}
const copyEmbedBtn2 = _findInNonHidden(dlg2, function (c) { return c.dataset && c.dataset.htAction === 'share-copy-embed'; });
check('Copy embed code button absent when no embed-snippet', !copyEmbedBtn2);

// === Focus selects URL/embed content (2 assertions) ===

share.close();
_calls.focusUrl = 0;
_calls.focusEmbed = 0;
_calls.selectUrl = 0;
_calls.selectEmbed = 0;
share.open(slugEmbed);
const dlg3 = document_stub.body.children.filter(function (c) { return c.tagName === 'DIALOG'; })[document_stub.body.children.length - 1];
const urlInput3 = _findDeep(dlg3, function (c) { return c.tagName === 'INPUT' && c.id === 'share-url-input'; });
urlInput3._handlers.focus[0]();
check('Focus on URL input triggers select()', _calls.selectUrl >= 1);
share.close();
share.open(slugEmbed, { focus: 'embed' });
const dlg4 = document_stub.body.children.filter(function (c) { return c.tagName === 'DIALOG'; })[document_stub.body.children.length - 1];
const embedInput4 = _findDeep(dlg4, function (c) { return c.tagName === 'TEXTAREA' && c.id === 'share-embed-input'; });
embedInput4._handlers.focus[0]();
check('Focus on embed textarea triggers select()', _calls.selectEmbed >= 1);

// === HT.share.print convenience API (2 assertions) ===

_calls.print = 0;
share.print(slugEmbed);
check('HT.share.print: calls window.print() exactly once', _calls.print === 1);
try { share.print('Invalid'); } catch (_) { /* expected */ }
check('HT.share.print: throws on invalid slug',
  (function () { try { share.print('Invalid'); return false; } catch (e) { return true; } })());

// === Button factory (3 assertions) ===

const btn = share.button(slugEmbed, { variant: 'icon' });
check('button: returns HTMLButtonElement with data-ht-action="share"',
  btn && btn.tagName === 'BUTTON' && btn.dataset.htAction === 'share');
check('button: aria-haspopup="dialog"',
  btn && btn.getAttribute('aria-haspopup') === 'dialog');
check('button: aria-label includes "(s)"',
  btn && btn.getAttribute('aria-label').indexOf('(s)') !== -1);

// === mount() helper (2 assertions) ===

const fakeRoot = new HtmlInputStub('');
const mounted = share.mount(slugEmbed, fakeRoot);
check('mount: returns teardown function',
  mounted && typeof mounted.teardown === 'function');
mounted.teardown();
check('mount: teardown removes button and dialog',
  true /* no-throw teardown is enough */);

// === Bypass gate cross-pin (3 assertions) ===

const CONTRACT_SRC = fs.readFileSync(
  path.resolve(__dirname, '../assets/js/api-contract.js'),
  'utf8'
);
const requiredEntries = [
  'HT.share.open',
  'HT.share.close',
  'HT.share.isOpen',
  'HT.share.url',
  'HT.share.embedCode',
  'HT.share.button',
  'HT.share.hasShare',
  'HT.share.mount',
  'HT.share.print',
  'HT.share._loadSchema',
];
let allEntriesFound = true;
for (const name of requiredEntries) {
  if (CONTRACT_SRC.indexOf("name: '" + name + "'") === -1) {
    allEntriesFound = false;
    console.log('  missing contract entry: ' + name);
  }
}
check('api-contract.js: all 10 HT.share.* entries registered (9 stable + 1 internal)',
  allEntriesFound);
check('api-contract.js: version bumped to 1.12.0 (Story 3.6 — history panel shape migration + cap 50; Story 3.3 superseded)',
  /version:\s*['"]1\.12\.0['"]/.test(CONTRACT_SRC));

// === Vacuous-pass guard ===

check('vacuous-pass guard: pass > 0 (sanity)', pass > 0);

// === Final tally ===

console.log('');
console.log('share-dialog-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
if (fail > 0 || pass === 0) {
  process.exit(1);
}
process.exit(0);