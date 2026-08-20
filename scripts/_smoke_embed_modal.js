/* ============================================
   Smoke harness for Story 4.2 — embed modal
   (HT.embed.openModal + standalone snippet
    dialog + <code class="embed-snippet"> + Copy
    button + live preview iframe + sandbox).

   The harness exercises embed.js + share.js
   in fresh vm contexts (no live browser) and
   reads the file bytes for regex / size
   assertions. Sections:

     I.   HT.embed surface (vm)
     II.  _renderSnippet — exact iframe HTML shape
     III. Snippet URL has ?embed=<slug> + style="border:0" + aria-label
     IV.  Default width 640 / height 480 when tools.json omits
     V.   Clamp to ≥ 240 when tools.json supplies smaller values
     VI.  Dialog markup: <code class="embed-snippet"> + <button data-action="copy-snippet">
     VII. Copy button → HT.copyToClipboard + HT.toast('Copied', 2000)
     VIII.Live preview iframe: sandbox + src + width/height
     IX.  Dialog open: showModal, focus, aria-expanded toggle
     X.   Dialog close: sourceEl.focus() return
     XI.  ?embed= suppression: openModal no-op
     XII. Share dialog entry point button
     XIII.Share dialog click → close + openModal(slug, shareButton)
     XIV. embed.js openModal click → button factory
     XV.  api-contract.js registration
     XVI. embed-modal.css presence + selectors
     XVII.Shell wiring: shell-embed.js + boot path
     XVIII.Bundle-size budget
     XIX. Vacuous-pass guard
   ============================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.resolve(ROOT, rel), 'utf8');

const EMBED_JS = read('assets/js/embed.js');
const SHARE_JS = read('assets/js/share.js');
const SHELL_JS = read('assets/js/shell.js');
const SHELL_EMBED_JS = read('assets/js/shell-embed.js');
const API_CONTRACT = read('assets/js/api-contract.js');
const EMBED_MODAL_CSS = read('assets/css/embed-modal.css');

let pass = 0, fail = 0;
function check(name, ok, info) {
  if (ok) { pass += 1; console.log('  PASS  ' + name); }
  else { fail += 1; console.log('  FAIL  ' + name + (info ? ' — ' + info : '')); }
}

// =============================================================
// vm harness — a richer DOM stub than _smoke_embed_router.js
// because the modal builder calls createElement + appendChild +
// setAttribute + querySelector + querySelectorAll. We model each
// DOM node as a plain object with the methods the embed module
// touches.
// =============================================================

function makeNode(tag) {
  const node = {
    _tag: tag,
    _attrs: {},
    _children: [],
    _handlers: {},
    className: '',
    textContent: '',
    innerHTML: '',
    dataset: {},
    style: {},
    children: [],
    childNodes: [],
    parentNode: null,
    open: false,
    hidden: false,
    type: 'button',
    title: '',
    src: '',
    href: '',
    setAttribute(k, v) { this._attrs[k] = String(v); if (k.indexOf('data-') === 0) { const dk = k.slice(5).replace(/-([a-z])/g, (_m, c) => c.toUpperCase()); this.dataset[dk] = String(v); } },
    getAttribute(k) { return this._attrs[k] != null ? this._attrs[k] : null; },
    hasAttribute(k) { return this._attrs[k] != null; },
    removeAttribute(k) { delete this._attrs[k]; },
    appendChild(c) { this._children.push(c); this.children.push(c); this.childNodes.push(c); c.parentNode = this; return c; },
    insertBefore(c, ref) {
      const i = this._children.indexOf(ref);
      if (i < 0) { this._children.push(c); this.children.push(c); }
      else { this._children.splice(i, 0, c); this.children.splice(i, 0, c); }
      c.parentNode = this;
      return c;
    },
    removeChild(c) {
      const i = this._children.indexOf(c);
      if (i >= 0) { this._children.splice(i, 1); this.children.splice(i, 1); }
      c.parentNode = null;
      return c;
    },
    addEventListener(name, fn) {
      (this._handlers[name] = this._handlers[name] || []).push(fn);
    },
    removeEventListener(name, fn) {
      const arr = this._handlers[name] || [];
      const i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    },
    querySelector(sel) { return _queryOne(this, sel); },
    querySelectorAll(sel) { return _queryAll(this, sel); },
    click() { (this._handlers.click || []).forEach((fn) => { try { fn({ target: this }); } catch (_) { /* */ } }); },
    focus() { lastFocused = this; },
    showModal() { this.open = true; this.setAttribute('open', ''); },
    close() { this.open = false; this.removeAttribute('open'); },
    select() { /* no-op */ },
  };
  // textContent aggregates from all descendant text nodes (real DOM behavior).
  Object.defineProperty(node, 'textContent', {
    configurable: true,
    enumerable: true,
    get() {
      function collect(n) {
        if (n._tag === '#text') return n.textContent || '';
        let out = '';
        if (n._children) for (const c of n._children) out += collect(c);
        return out;
      }
      return collect(node);
    },
    set(v) {
      // Drop existing children, append a single text node.
      node._children = [];
      node.children = [];
      node.childNodes = [];
      if (v == null || v === '') return;
      const txt = { nodeType: 3, _tag: '#text', textContent: String(v), _children: [], children: [], childNodes: [], _attrs: {}, parentNode: node };
      node._children.push(txt);
      node.children.push(txt);
      node.childNodes.push(txt);
    },
  });
  // Replace innerHTML with a getter/setter that parses markup into children.
  let _innerHTMLValue = '';
  Object.defineProperty(node, 'innerHTML', {
    configurable: true,
    enumerable: true,
    get() { return _innerHTMLValue; },
    set(html) {
      _innerHTMLValue = html == null ? '' : String(html);
      // Clear existing children, then parse HTML and rebuild tree.
      const oldChildren = node._children.slice();
      for (const c of oldChildren) { c.parentNode = null; }
      node._children = [];
      node.children = [];
      node.childNodes = [];
      if (typeof html !== 'string' || html.length === 0) return;
      _parseHtmlInto(node, html);
    },
  });
  return node;
}

let lastFocused = null;

// Minimal HTML parser — handles the subset embed.js emits:
// <tag attr="value">text</tag>, nested elements, escaped entities
// in text nodes, self-closing void elements. Good enough for the
// smoke harness to validate dialog markup shape.
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
function _parseHtmlInto(parent, html) {
  let i = 0;
  function parseTextInto(p) {
    let out = '';
    while (i < html.length) {
      const ch = html[i];
      if (ch === '<') break;
      out += ch;
      i += 1;
    }
    if (out.length > 0) {
      // Decode the few entities embed.js emits (via _escapeHtml).
      out = out.replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&mdash;/g, '\u2014')
        .replace(/&times;/g, '\u00d7');
      const txt = { nodeType: 3, _tag: '#text', textContent: out, _children: [], children: [], childNodes: [], parentNode: p };
      p._children.push(txt);
      p.children.push(txt);
      p.childNodes.push(txt);
    }
  }
  function parseAttrs() {
    const attrs = {};
    while (i < html.length) {
      // Skip whitespace.
      while (i < html.length && /\s/.test(html[i])) i += 1;
      if (i >= html.length || html[i] === '>' || html[i] === '/' || html[i] === '<') break;
      // Read attribute name.
      const nameStart = i;
      while (i < html.length && /[^\s=>/]/.test(html[i])) i += 1;
      if (i >= html.length || html[i] !== '=') {
        // Boolean attribute (just a name).
        attrs[html.slice(nameStart, i)] = '';
        continue;
      }
      const name = html.slice(nameStart, i);
      i += 1; // skip =
      let val = '';
      const q = html[i];
      if (q === '"' || q === '\'') {
        i += 1;
        const vStart = i;
        while (i < html.length && html[i] !== q) i += 1;
        val = html.slice(vStart, i);
        if (i < html.length) i += 1; // skip closing quote
      } else {
        const vStart = i;
        while (i < html.length && /[^\s>]/.test(html[i])) i += 1;
        val = html.slice(vStart, i);
      }
      attrs[name] = val;
    }
    return attrs;
  }
  function parseNodeInto(p) {
    if (html[i] !== '<') return null;
    // Skip comments / doctype (rare in embed output, but defensive).
    if (html.substr(i, 4) === '<!--') {
      const end = html.indexOf('-->', i + 4);
      i = end < 0 ? html.length : end + 3;
      return null;
    }
    if (html.substr(i, 9) === '<!doctype' || html.substr(i, 9) === '<!DOCTYPE') {
      const end = html.indexOf('>', i);
      i = end < 0 ? html.length : end + 1;
      return null;
    }
    if (html[i] !== '<') return null;
    i += 1;
    const tagStart = i;
    while (i < html.length && /[^\s/>]/.test(html[i])) i += 1;
    const tagName = html.slice(tagStart, i).toLowerCase();
    const attrs = parseAttrs();
    // Skip self-close marker or detect void element.
    let selfClose = false;
    if (i < html.length && html[i] === '/') { selfClose = true; i += 1; }
    if (i < html.length && html[i] === '>') i += 1;
    const el = makeNode(tagName);
    el._attrs = Object.assign({}, attrs);
    if (attrs['class']) el.className = attrs['class'];
    if (attrs['id']) el._attrs.id = attrs['id'];
    el.parentNode = p;
    p._children.push(el);
    p.children.push(el);
    p.childNodes.push(el);
    if (selfClose || VOID_TAGS.has(tagName)) return el;
    // Parse children until matching close tag — children of `el` go
    // into el, NOT p (this was the bug — closure captured `parent`).
    let depth = 1;
    while (i < html.length && depth > 0) {
      if (html[i] === '<') {
        if (html.substr(i, 2) === '</') {
          // Closing tag — pop depth.
          const closeStart = i;
          i += 2;
          while (i < html.length && /[^\s>]/.test(html[i])) i += 1;
          const closeName = html.slice(closeStart + 2, i).toLowerCase();
          while (i < html.length && html[i] !== '>') i += 1;
          if (i < html.length) i += 1; // skip >
          if (closeName === tagName) { depth -= 1; break; }
          // Mismatched close — bail out to avoid infinite loop.
          break;
        }
        parseNodeInto(el);
      } else {
        parseTextInto(el);
      }
    }
    return el;
  }
  while (i < html.length) {
    if (html[i] === '<') {
      if (html.substr(i, 2) === '</') {
        // Stray close — bail.
        break;
      }
      parseNodeInto(parent);
    } else {
      parseTextInto(parent);
    }
  }
}

function _matches(node, sel) {
  // Minimal selector support: tag, .class, [attr], #id, and any
  // combination of those. Multi-selector (with comma) is not used
  // by the embed module — skip for now.
  if (sel.indexOf(',') >= 0) return false;
  // Text/non-element nodes have no _attrs — selectors can never match them.
  if (!node || node._tag === '#text' || !node._attrs) return false;
  let re = /^([a-z0-9_-]+)?(\..+|\[.+\]|#[^.\[]+)*$/i;
  if (!re.test(sel)) return false;
  // Tag prefix.
  let rest = sel;
  if (/^[a-z0-9_-]+/i.test(rest)) {
    const m = rest.match(/^([a-z0-9_-]+)/i);
    if (node._tag !== m[1]) return false;
    rest = rest.slice(m[1].length);
  }
  while (rest.length > 0) {
    if (rest[0] === '.') {
      const m = rest.match(/^\.([a-z0-9_-]+)/i);
      if (!m) return false;
      const cls = node._attrs['class'] || node.className || '';
      const classes = cls.split(/\s+/);
      if (classes.indexOf(m[1]) < 0) return false;
      rest = rest.slice(m[0].length);
    } else if (rest[0] === '#') {
      const m = rest.match(/^#([a-z0-9_-]+)/i);
      if (!m) return false;
      if ((node._attrs.id || '') !== m[1]) return false;
      rest = rest.slice(m[0].length);
    } else if (rest[0] === '[') {
      const m = rest.match(/^\[([^=]+)=["']?([^"'\]]+)["']?\]/);
      if (!m) return false;
      const key = m[1];
      const want = m[2];
      if ((node._attrs[key] || '') !== want) return false;
      rest = rest.slice(m[0].length);
    } else {
      return false;
    }
  }
  return true;
}

// Match a compound selector against a node, treating spaces as
// descendant combinators. Returns true if the path of ancestors
// satisfies the selector (anywhere in the tree).
function _matchesWithAncestors(node, sel, rootNode) {
  if (_matches(node, sel)) return true;
  // Walk ancestors and try matching each; on match, recursively
  // check the preceding selectors. Cheap because the trees are tiny.
  const parts = sel.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return false;
  // We need to find ANY ancestor that matches parts[i] AND a deeper
  // ancestor that matches parts[i-1] etc. This is a graph search on
  // the ancestor chain — but for simplicity, since parts are usually
  // short, try linear walk: starting from node, look for a chain of
  // ancestors where each ancestor matches parts[k] from the END of
  // the parts array.
  function walk(n, idx) {
    if (idx < 0) return true;
    let p = n.parentNode;
    while (p) {
      if (_matches(p, parts[idx])) {
        if (walk(p, idx - 1)) return true;
      }
      p = p.parentNode;
    }
    return false;
  }
  return walk(node, parts.length - 1);
}

function _queryOne(root, sel) {
  // For selectors with descendant combinators, walk every node and
  // check ancestor chain.
  const stack = [].concat(root._children || []);
  if (sel.indexOf(' ') >= 0) {
    const all = [];
    const collectStack = [].concat(root._children || []);
    while (collectStack.length) {
      const n = collectStack.shift();
      all.push(n);
      if (n._children) collectStack.push(...n._children);
    }
    for (const n of all) {
      if (_matchesWithAncestors(n, sel, root)) return n;
    }
    return null;
  }
  while (stack.length) {
    const n = stack.shift();
    if (_matches(n, sel)) return n;
    if (n._children) stack.push(...n._children);
  }
  return null;
}

function _queryAll(root, sel) {
  const out = [];
  const all = [];
  const collectStack = [].concat(root._children || []);
  while (collectStack.length) {
    const n = collectStack.shift();
    all.push(n);
    if (n._children) collectStack.push(...n._children);
  }
  if (sel.indexOf(' ') >= 0) {
    for (const n of all) {
      if (_matchesWithAncestors(n, sel, root)) out.push(n);
    }
  } else {
    for (const n of all) {
      if (_matches(n, sel)) out.push(n);
    }
  }
  return out;
}

function createVmContext(opts = {}) {
  const entries = opts.entries || [
    {
      slug: 'qr-code-generator',
      title: 'QR Code Generator',
      'embed-snippet': { enabled: true, 'badge-default': true, 'min-width': 320, 'min-height': 480 },
    },
    {
      slug: 'no-embed-snippet',
      title: 'No Embed Snippet',
      // embed-snippet deliberately omitted
    },
  ];
  const HT = {
    homeGrid: { entries: entries },
    copyToClipboard: opts.copyToClipboard || function () {},
    toast: opts.toast || function () {},
  };
  const documentRoot = makeNode('html');
  // Mark the html root so HT.embed._isEmbedModeActive() works as in
  // real pages; tests can flip dataset.embed manually.
  documentRoot.dataset = {};
  Object.defineProperty(documentRoot, 'dataset', {
    value: {},
    writable: true,
  });
  const documentBody = makeNode('body');
  documentBody.appendChild = documentBody.appendChild; // already exists
  documentRoot.appendChild(documentBody);
  const documentHead = makeNode('head');
  documentRoot.appendChild(documentHead);
  const sandbox = {
    console,
    setTimeout, clearTimeout,
    URLSearchParams,
    HT: HT,
    window: {
      HT: HT,
      location: { origin: 'https://example.com', pathname: '/' },
      addEventListener() {},
      removeEventListener() {},
      crypto: typeof opts.crypto === 'undefined' ? undefined : opts.crypto,
      getSelection() { return null; },
      document: undefined, // filled below
    },
    document: {
      documentElement: documentRoot,
      body: documentBody,
      head: documentHead,
      querySelector() { return null; },
      querySelectorAll() { return []; },
      getElementById(id) {
        // Walk the document tree looking for an element with matching id.
        const stack = [documentRoot];
        while (stack.length) {
          const n = stack.shift();
          if (n._attrs && n._attrs.id === id) return n;
          if (n._children) stack.push(...n._children);
        }
        return null;
      },
      createElement(tag) { return makeNode(tag); },
      get currentScript() { return null; },
    },
  };
  sandbox.window.document = sandbox.document;
  vm.createContext(sandbox);
  return sandbox;
}

function runInVm(src, opts = {}) {
  const ctx = createVmContext(opts);
  vm.runInContext(src, ctx, { filename: opts.filename || 'vm-input.js' });
  return ctx;
}

// =============================================================
// I. HT.embed surface (vm) (8 assertions)
// =============================================================
console.log('--- I. HT.embed surface (vm) ---');
{
  const ctx = runInVm(EMBED_JS, { filename: 'embed.js' });
  const HT = ctx.window.HT;
  check('embed.js (vm): HT.embed exposed', !!HT.embed);
  check('embed.js (vm): HT.embed.openModal is a function', typeof HT.embed.openModal === 'function');
  check('embed.js (vm): HT.embed.closeModal is a function', typeof HT.embed.closeModal === 'function');
  check('embed.js (vm): HT.embed.isModalOpen is a function', typeof HT.embed.isModalOpen === 'function');
  check('embed.js (vm): HT.embed.button is a function', typeof HT.embed.button === 'function');
  check('embed.js (vm): HT.embed.mount is a function', typeof HT.embed.mount === 'function');
  check('embed.js (vm): HT_EMBED_VERSION.version === "1.1.0"',
    ctx.window.HT_EMBED_VERSION && ctx.window.HT_EMBED_VERSION.version === '1.1.0');
  check('embed.js (vm): HT.embed is frozen', Object.isFrozen(HT.embed));
}

// =============================================================
// II. _renderSnippet — exact iframe HTML shape (5 assertions)
// =============================================================
console.log('--- II. _renderSnippet — exact iframe HTML shape ---');
{
  const ctx = runInVm(EMBED_JS, { filename: 'embed.js' });
  const out = ctx.window.HT.embed._renderSnippet('qr-code-generator', ctx.window.HT.embed._resolveSnippetSchema('qr-code-generator'));
  check('snippet: starts with <iframe', out.indexOf('<iframe ') === 0);
  check('snippet: contains width="320" (from tools.json min-width)',
    /width="320"/.test(out));
  check('snippet: contains height="480" (from tools.json min-height)',
    /height="480"/.test(out));
  check('snippet: contains loading="lazy"', /loading="lazy"/.test(out));
  check('snippet: contains style="border:0"', /style="border:0"/.test(out));
}

// =============================================================
// III. Snippet URL has ?embed=<slug> + aria-label (4 assertions)
// =============================================================
console.log('--- III. Snippet URL + aria-label ---');
{
  const ctx = runInVm(EMBED_JS, { filename: 'embed.js' });
  const out = ctx.window.HT.embed._renderSnippet('qr-code-generator', ctx.window.HT.embed._resolveSnippetSchema('qr-code-generator'));
  check('snippet: URL has ?embed=qr-code-generator',
    /src="[^"]*\?embed=qr-code-generator"/.test(out));
  check('snippet: aria-label ends with \u2014 Handy Tools',
    /aria-label="QR Code Generator \u2014 Handy Tools"/.test(out));
  check('snippet: aria-label uses title from tools.json',
    /aria-label="QR Code Generator/.test(out));
  // Order check: src, width, height, loading, title, aria-label, style
  const order = ['src=', 'width=', 'height=', 'loading=', 'title=', 'aria-label=', 'style='];
  let prev = -1, orderedOk = true;
  for (const key of order) {
    const i = out.indexOf(key);
    if (i < 0 || i < prev) { orderedOk = false; break; }
    prev = i;
  }
  check('snippet: attributes appear in spec order (src, width, height, loading, title, aria-label, style)',
    orderedOk);
}

// =============================================================
// IV. Default width 640 / height 480 when tools.json omits
//    embed-snippet block (3 assertions)
// =============================================================
console.log('--- IV. Default width 640 / height 480 ---');
{
  const ctx = runInVm(EMBED_JS, {
    entries: [
      { slug: 'no-block', title: 'No Block' /* no embed-snippet */ },
    ],
  });
  const out = ctx.window.HT.embed._renderSnippet('no-block', ctx.window.HT.embed._resolveSnippetSchema('no-block'));
  check('snippet (no block): defaults to width="640"', /width="640"/.test(out));
  check('snippet (no block): defaults to height="480"', /height="480"/.test(out));
  check('snippet (no block): hasEmbed=false (modal hides preview section)',
    ctx.window.HT.embed._resolveSnippetSchema('no-block').hasEmbed === false);
}

// =============================================================
// V. Clamp to ≥ 240 (3 assertions)
// =============================================================
console.log('--- V. Clamp to ≥ 240 ---');
{
  const ctx = runInVm(EMBED_JS, {
    entries: [
      { slug: 'small-block', title: 'Small', 'embed-snippet': { enabled: true, 'badge-default': false, 'min-width': 100, 'min-height': 100 } },
    ],
  });
  const schema = ctx.window.HT.embed._resolveSnippetSchema('small-block');
  check('snippet (small): schema.width clamped to ≥ 240', schema.width >= 240);
  check('snippet (small): schema.height clamped to ≥ 240', schema.height >= 240);
  const out = ctx.window.HT.embed._renderSnippet('small-block', schema);
  check('snippet (small): iframe width attr is ≥ 240', /width="(2[4-9][0-9]|[3-9][0-9]{2,})"/.test(out));
}

// =============================================================
// VI. Dialog markup: <code class="embed-snippet"> + Copy button
// =============================================================
console.log('--- VI. Dialog markup ---');
{
  const ctx = runInVm(EMBED_JS, {
    entries: [
      { slug: 'qr-code-generator', title: 'QR Code Generator', 'embed-snippet': { enabled: true, 'badge-default': true, 'min-width': 320, 'min-height': 480 } },
    ],
  });
  // Build the dialog without opening it.
  const dlg = ctx.window.HT.embed._renderSnippet('qr-code-generator', ctx.window.HT.embed._resolveSnippetSchema('qr-code-generator'));
  // Use the internal builder via the public openModal (which appends to body).
  // Build a fake source button.
  const sourceBtn = ctx.document.createElement('button');
  sourceBtn.setAttribute('id', 'embed-button-test');
  ctx.window.HT.embed.openModal('qr-code-generator', sourceBtn);
  // After openModal, the dialog should be in document.body with class embed-modal.
  const bodyChildren = ctx.document.body._children;
  const dlgNode = bodyChildren.find((c) => c._tag === 'dialog');
  check('dialog: <dialog class="embed-modal"> appended to body', !!dlgNode);
  check('dialog: has data-slug attribute', dlgNode && dlgNode._attrs['data-slug'] === 'qr-code-generator');
  check('dialog: aria-labelledby set',
    dlgNode && typeof dlgNode._attrs['aria-labelledby'] === 'string');
  // Find <code class="embed-snippet">
  const code = dlgNode && _queryOne(dlgNode, 'code.embed-snippet');
  check('dialog: <code class="embed-snippet"> present', !!code);
  check('dialog: code contains <iframe src=...',
    code && code.textContent.indexOf('<iframe ') === 0);
  // Find <button data-action="copy-snippet">Copy</button>
  const copyBtn = dlgNode && _queryOne(dlgNode, 'button[data-action="copy-snippet"]');
  check('dialog: <button data-action="copy-snippet"> present', !!copyBtn);
  check('dialog: Copy button label is "Copy"',
    copyBtn && copyBtn.textContent === 'Copy');
}

// =============================================================
// VII. Copy button → HT.copyToClipboard + HT.toast('Copied', 2000)
// =============================================================
console.log('--- VII. Copy button → clipboard + toast ---');
{
  const calls = { copy: [], toast: [] };
  const ctx = runInVm(EMBED_JS, {
    entries: [
      { slug: 'qr-code-generator', title: 'QR Code Generator', 'embed-snippet': { enabled: true, 'badge-default': true, 'min-width': 320, 'min-height': 480 } },
    ],
    copyToClipboard: function (text) { calls.copy.push(text); },
    toast: function (msg, ms) { calls.toast.push({ msg: msg, ms: ms }); },
  });
  ctx.window.HT.embed.openModal('qr-code-generator', ctx.document.createElement('button'));
  const dlg = ctx.document.body._children.find((c) => c._tag === 'dialog');
  const copyBtn = _queryOne(dlg, 'button[data-action="copy-snippet"]');
  // Simulate click on the copy button.
  (copyBtn._handlers.click || []).forEach((fn) => { try { fn({ target: copyBtn }); } catch (_) { /* */ } });
  check('copy: HT.copyToClipboard called once', calls.copy.length === 1);
  check('copy: clipboard text starts with <iframe', calls.copy.length === 1 && calls.copy[0].indexOf('<iframe ') === 0);
  check('toast: HT.toast called once', calls.toast.length === 1);
  check('toast: HT.toast message is "Copied" (literal per spec)', calls.toast.length === 1 && calls.toast[0].msg === 'Copied');
  check('toast: HT.toast lifetime is 2000ms (spec)', calls.toast.length === 1 && calls.toast[0].ms === 2000);
}

// =============================================================
// VIII. Live preview iframe (4 assertions)
// =============================================================
console.log('--- VIII. Live preview iframe ---');
{
  const ctx = runInVm(EMBED_JS, {
    entries: [
      { slug: 'qr-code-generator', title: 'QR Code Generator', 'embed-snippet': { enabled: true, 'badge-default': true, 'min-width': 320, 'min-height': 480 } },
    ],
  });
  ctx.window.HT.embed.openModal('qr-code-generator', ctx.document.createElement('button'));
  const dlg = ctx.document.body._children.find((c) => c._tag === 'dialog');
  const preview = _queryOne(dlg, 'iframe.embed-modal__preview-frame');
  check('preview: <iframe class="embed-modal__preview-frame"> present', !!preview);
  check('preview: sandbox="allow-scripts allow-same-origin"',
    preview && preview._attrs.sandbox === 'allow-scripts allow-same-origin');
  check('preview: src ends with ?embed=qr-code-generator',
    preview && /\/tools\/qr-code-generator\/\?embed=qr-code-generator/.test(preview._attrs.src || ''));
  check('preview: NO allow-top-navigation in sandbox',
    preview && (preview._attrs.sandbox || '').indexOf('allow-top-navigation') < 0);
  check('preview: NO allow-popups in sandbox',
    preview && (preview._attrs.sandbox || '').indexOf('allow-popups') < 0);
}

// =============================================================
// IX. Dialog open: showModal + focus
// =============================================================
console.log('--- IX. Dialog open ---');
{
  const ctx = runInVm(EMBED_JS, {
    entries: [
      { slug: 'qr-code-generator', title: 'QR Code Generator', 'embed-snippet': { enabled: true, 'badge-default': true, 'min-width': 320, 'min-height': 480 } },
    ],
  });
  ctx.window.HT.embed.openModal('qr-code-generator', ctx.document.createElement('button'));
  const dlg = ctx.document.body._children.find((c) => c._tag === 'dialog');
  check('open: dialog.open === true', dlg.open === true);
  check('open: HT.embed.isModalOpen() === true',
    ctx.window.HT.embed.isModalOpen() === true);
}

// =============================================================
// X. Dialog close: sourceEl.focus() return (3 assertions)
// =============================================================
console.log('--- X. Dialog close: source focus return ---');
{
  const ctx = runInVm(EMBED_JS, {
    entries: [
      { slug: 'qr-code-generator', title: 'QR Code Generator', 'embed-snippet': { enabled: true, 'badge-default': true, 'min-width': 320, 'min-height': 480 } },
    ],
  });
  const sourceBtn = ctx.document.createElement('button');
  ctx.document.body.appendChild(sourceBtn);
  ctx.window.HT.embed.openModal('qr-code-generator', sourceBtn);
  lastFocused = null;
  ctx.window.HT.embed.closeModal();
  check('close: HT.embed.isModalOpen() === false',
    ctx.window.HT.embed.isModalOpen() === false);
  check('close: source button was focused after close',
    lastFocused === sourceBtn);
}

// =============================================================
// XI. ?embed= suppression (2 assertions)
// =============================================================
console.log('--- XI. ?embed= suppression ---');
{
  const ctx = runInVm(EMBED_JS, {
    entries: [
      { slug: 'qr-code-generator', title: 'QR Code Generator', 'embed-snippet': { enabled: true, 'badge-default': true, 'min-width': 320, 'min-height': 480 } },
    ],
  });
  // Simulate embed mode by setting data-embed on the html root.
  ctx.document.documentElement.dataset.embed = 'qr-code-generator';
  ctx.window.HT.embed.openModal('qr-code-generator', ctx.document.createElement('button'));
  const dlg = ctx.document.body._children.find((c) => c._tag === 'dialog');
  check('embed mode: openModal is a no-op (no dialog appended)', !dlg);
  check('embed mode: isModalOpen() === false', ctx.window.HT.embed.isModalOpen() === false);
  // Reset for subsequent sections.
  delete ctx.document.documentElement.dataset.embed;
}

// =============================================================
// XII. Share dialog entry point button (4 assertions)
// =============================================================
console.log('--- XII. Share dialog entry point button ---');
check('share.js: dialog renders <button data-ht-action="share-open-embed-modal">Open embed modal</button>',
  /data-ht-action="share-open-embed-modal"/.test(SHARE_JS) && /Open embed modal/.test(SHARE_JS));
check('share.js: launches AFTER the existing Copy embed code button',
  SHARE_JS.indexOf('data-ht-action="share-copy-embed"') > 0 &&
  SHARE_JS.indexOf('data-ht-action="share-copy-embed"') < SHARE_JS.indexOf('data-ht-action="share-open-embed-modal"'));
check('share.js: handler closes Share dialog (close()) then calls HT.embed.openModal',
  /close\(\)/.test(SHARE_JS) &&
  /HT\.embed\.openModal/.test(SHARE_JS));
check('share.js: passes _state.button as sourceEl',
  /_state\.button/.test(SHARE_JS));
check('share.js: HT.share.version bumped 1.9.0 → 1.10.0',
  /version:\s*['"]1\.10\.0['"]/.test(SHARE_JS));

// =============================================================
// XIII. Share dialog click → close + openModal(slug, shareButton)
// =============================================================
console.log('--- XIII. Share dialog click delegation ---');
{
  const ctx = runInVm(SHARE_JS, {
    entries: [
      {
        slug: 'qr-code-generator', title: 'QR Code Generator',
        urlState: { default: { x: '1' }, encode: [{ key: 'x', type: 'string' }], decode: [{ key: 'x', type: 'string' }] },
        'embed-snippet': { enabled: true, 'badge-default': true, 'min-width': 320, 'min-height': 480 },
      },
    ],
    copyToClipboard: function () {},
    toast: function () {},
  });
  // Build the share dialog (the internal _buildDialog isn't directly
  // exposed, but open() calls _ensureDialog which calls _buildDialog).
  const shareBtn = ctx.document.createElement('button');
  ctx.document.body.appendChild(shareBtn);
  // Simulate that HT.share.mount has been called by setting _state.button.
  ctx.window.HT.share.open('qr-code-generator', { sourceEl: shareBtn });
  // The dialog should now be in the body.
  const shareDlg = ctx.document.body._children.find((c) => c._tag === 'dialog' && (c.className || c._attrs.class || '') === 'share-dialog');
  check('share dialog: <dialog class="share-dialog"> present after open()', !!shareDlg);
  if (shareDlg) {
    const launchBtn = _queryOne(shareDlg, 'button[data-ht-action="share-open-embed-modal"]');
    check('share dialog: "Open embed modal" button present', !!launchBtn);
    check('share dialog: "Open embed modal" button text is "Open embed modal"',
      launchBtn && launchBtn.textContent === 'Open embed modal');
  }
}

// =============================================================
// XIV. embed.js button factory (3 assertions)
// =============================================================
console.log('--- XIV. embed.js button factory ---');
{
  const ctx = runInVm(EMBED_JS, {
    entries: [
      { slug: 'qr-code-generator', title: 'QR Code Generator', 'embed-snippet': { enabled: true, 'badge-default': true, 'min-width': 320, 'min-height': 480 } },
    ],
  });
  const btn = ctx.window.HT.embed.button('qr-code-generator');
  check('button: factory returns a button element', btn && btn._tag === 'button');
  check('button: data-ht-action="embed"', btn && btn._attrs['data-ht-action'] === 'embed');
  check('button: aria-haspopup="dialog"', btn && btn._attrs['aria-haspopup'] === 'dialog');
  check('button: aria-label includes "Embed"', btn && /Embed/.test(btn._attrs['aria-label'] || ''));
  const invalid = ctx.window.HT.embed.button('Invalid Slug!');
  check('button: invalid slug returns null', invalid === null);
}

// =============================================================
// XV. api-contract.js registration (4 assertions)
// =============================================================
console.log('--- XV. api-contract.js registration ---');
check('api-contract.js: HT.embed entry present',
  /name:\s*['"]HT\.embed['"]/.test(API_CONTRACT));
check('api-contract.js: HT.embed.openModal entry present',
  /name:\s*['"]HT\.embed\.openModal['"]/.test(API_CONTRACT));
check('api-contract.js: HT.embed module path is assets/js/embed.js',
  /module:\s*['"]assets\/js\/embed\.js['"]/.test(API_CONTRACT));
check('api-contract.js: HT_EMBED_VERSION version field is 1.1.0',
  /version:\s*["']1\.1\.0["']/.test(API_CONTRACT) ||
  /version: "1\.1\.0"/.test(API_CONTRACT));
check('api-contract.js: top-level version 1.32.0',
  /version:\s*['"]1\.32\.0['"]/.test(API_CONTRACT));

// =============================================================
// XVI. embed-modal.css presence + selectors (5 assertions)
// =============================================================
console.log('--- XVI. embed-modal.css presence + selectors ---');
check('embed-modal.css: file exists on disk', EMBED_MODAL_CSS.length > 0);
check('embed-modal.css: dialog.embed-modal selector',
  /dialog\.embed-modal/.test(EMBED_MODAL_CSS));
check('embed-modal.css: code.embed-snippet selector',
  /code\.embed-snippet/.test(EMBED_MODAL_CSS));
check('embed-modal.css: live preview iframe container class',
  /\.embed-modal__preview-frame/.test(EMBED_MODAL_CSS));
check('embed-modal.css: forced-colors media query',
  /@media\s+\(forced-colors:\s*active\)/.test(EMBED_MODAL_CSS));
check('embed-modal.css: dark mode :root[data-theme="dark"] selector',
  /:root\[data-theme="dark"\]\s+dialog\.embed-modal/.test(EMBED_MODAL_CSS));

// =============================================================
// XVII. Shell wiring (4 assertions)
// =============================================================
console.log('--- XVII. Shell wiring ---');
check('shell.js: wires HT.shellEmbed.mount in boot path',
  /HT\.shellEmbed\.mount/.test(SHELL_JS));
check('shell.js: passes data-slug to HT.shellEmbed.mount',
  /main\.getAttribute\(\s*['"]data-slug['"]/.test(SHELL_JS) &&
  /HT\.shellEmbed\.mount/.test(SHELL_JS));
check('shell-embed.js: HT.shellEmbed frozen mount helper',
  /HT\.shellEmbed = Object\.freeze/.test(SHELL_EMBED_JS) &&
  /mount:/.test(SHELL_EMBED_JS));
check('shell-embed.js: delegates to HT.embed.mount',
  /HT\.embed\.mount/.test(SHELL_EMBED_JS));

// =============================================================
// XVIII. Bundle-size budget (2 assertions)
// =============================================================
console.log('--- XVIII. Bundle-size budget ---');
const gzEmbed = zlib.gzipSync(EMBED_JS);
// 8 KB gz budget — embed.js ships the instance factory (publish) + postMessage
// forwarding + on() listener + destroy() + the HT_EMBED_VERSION global +
// the snippet modal surface (openModal + _buildModal + _renderSnippet +
// _copySnippet + _closeModal + button + mount + the CSS lazy-load helper).
// Story 4.2 raised the budget from 4 KB to 8 KB to absorb the CSS lazy-load
// helper + the full modal builder + the embed button factory with SVG icon.
check('bundle-size: embed.js ≤ 8 KB gz (' + gzEmbed.length + ' bytes)',
  gzEmbed.length <= 8192);
const gzCss = zlib.gzipSync(EMBED_MODAL_CSS);
check('bundle-size: embed-modal.css ≤ 2.5 KB gz (' + gzCss.length + ' bytes)',
  gzCss.length <= 2560);

// =============================================================
// XIX. Vacuous-pass guard (strict) (2 assertions)
// =============================================================
console.log('--- XIX. Vacuous-pass guard ---');
check('vacuous-pass: pass > 0', pass > 0);
check('vacuous-pass: vm-context sections present (pass ≥ 35)',
  pass >= 35);

console.log('');
console.log('embed-modal-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail > 0 ? 1 : 0);
