'use strict';
/* End-to-end render check for the inline header-search UI.
   Loads the actual scripts in document order (eager + defer), then
   simulates the user opening the search by focusing the input.
   Verifies the dropdown panel becomes visible and the input is in
   the right ARIA state. */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const JS_DIR = path.join(REPO, 'assets', 'js');

function makeFakeDoc() {
  const noop = () => {};
  // Simple DOM-like nodes keyed by id, with necessary properties.
  const nodes = {};
  function makeNode(tag, attrs = {}) {
    return {
      tagName: tag.toUpperCase(),
      nodeType: 1,
      attrs: attrs,
      children: [],
      parentNode: null,
      _textContent: '',
      classList: {
        add: function (...c) { attrs.class = (attrs.class ? attrs.class + ' ' : '') + c.join(' '); },
        remove: function (...c) { attrs.class = (attrs.class || '').split(' ').filter(x => !c.includes(x)).join(' '); },
        contains: function (c) { return (attrs.class || '').split(' ').includes(c); },
      },
      style: {},
      get id() { return attrs.id; },
      get className() { return attrs.class || ''; },
      set className(v) { attrs.class = v; },
      get textContent() {
        if (this._textContent) return this._textContent;
        return this.children.map(c => c.textContent || '').join('');
      },
      set textContent(v) { this._textContent = v; },
      get innerHTML() { return this.textContent; },
      set innerHTML(v) { this._textContent = v; },
      _listeners: {},
      addEventListener: function (type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); },
      removeEventListener: function (type, fn) { (this._listeners[type] = this._listeners[type] || []).filter(f => f !== fn); },
      dispatchEvent: function (e) {
        const list = this._listeners[e.type] || [];
        for (const fn of list) fn(e);
      },
      setAttribute: function (k, v) { attrs[k] = v; },
      getAttribute: function (k) { return attrs[k] != null ? String(attrs[k]) : null; },
      hasAttribute: function (k) { return attrs[k] != null; },
      removeAttribute: function (k) { delete attrs[k]; },
      contains: function (other) {
        if (other === this) return true;
        for (const c of this.children) if (c.contains(other)) return true;
        return false;
      },
      focus: noop,
      closest: function (sel) {
        let cur = this;
        while (cur) {
          if (matches(cur, sel)) return cur;
          cur = cur.parentNode;
        }
        return null;
      },
      appendChild: function (c) { this.children.push(c); c.parentNode = this; return c; },
      removeChild: function (c) { this.children = this.children.filter(x => x !== c); c.parentNode = null; return c; },
      firstChild: null,
      querySelector: function (sel) { return querySelectorDeep(this, sel); },
      querySelectorAll: function (sel) { return querySelectorAllDeep(this, sel); },
      get scrollHeight() { return 0; },
      get scrollWidth() { return 0; },
      dataset: new Proxy({}, { get: (_, k) => attrs['data-' + k] }),
    };
  }

  function matches(node, sel) {
    // Very simplified selector: #id, .class, [attr], tag.
    const idMatch = sel.match(/#([\w-]+)/);
    const classMatch = sel.match(/\.([\w-]+)/);
    const attrMatch = sel.match(/\[([\w-]+)(?:=["']?([^"'\]]+)["']?)?\]/);
    const tagMatch = sel.match(/^([\w-]+)/);
    if (idMatch && node.attrs.id !== idMatch[1]) return false;
    if (classMatch) {
      const classes = (node.attrs.class || '').split(' ');
      if (!classes.includes(classMatch[1])) return false;
    }
    if (attrMatch && node.attrs[attrMatch[1]] !== attrMatch[2]) return false;
    if (tagMatch && node.tagName.toLowerCase() !== tagMatch[1]) return false;
    return true;
  }

  function querySelectorDeep(root, sel) {
    if (matches(root, sel)) return root;
    for (const c of root.children) {
      const r = querySelectorDeep(c, sel);
      if (r) return r;
    }
    return null;
  }
  function querySelectorAllDeep(root, sel) {
    const out = [];
    if (matches(root, sel)) out.push(root);
    for (const c of root.children) out.push(...querySelectorAllDeep(c, sel));
    return out;
  }

  // Pre-build the page DOM with header-search markup.
  const html = makeNode('html');
  const body = makeNode('body');
  const docEl = makeNode('documentElement');

  const header = makeNode('header', { class: 'site-header', role: 'banner', 'aria-label': 'Handy Tools' });
  const container = makeNode('div', { class: 'container' });
  const nav = makeNode('nav', { class: 'shell-header-nav', 'aria-label': 'Primary' });
  const searchWrap = makeNode('div', { class: 'shell-header-search', id: 'header-search', role: 'search', 'data-open': 'false' });
  const inputWrap = makeNode('div', { class: 'shell-header-search-input-wrap', id: 'header-search-input-wrap' });
  const icon = makeNode('svg', { class: 'shell-header-search-icon', id: 'header-search-icon' });
  const input = makeNode('input', {
    class: 'shell-header-search-input',
    id: 'header-search-input',
    type: 'search',
    role: 'combobox',
    'aria-controls': 'header-search-listbox',
    'aria-expanded': 'false',
    'aria-autocomplete': 'list',
    'aria-label': 'Search tools',
    placeholder: 'Search tools\u2026',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  inputWrap.appendChild(icon);
  inputWrap.appendChild(input);
  const panel = makeNode('div', { class: 'shell-header-search-panel', id: 'header-search-panel', role: 'region', 'aria-label': 'Search results', hidden: '' });
  const listbox = makeNode('ul', { class: 'shell-header-search-list', id: 'header-search-listbox', role: 'listbox', 'aria-label': 'Tools' });
  const emptyLi = makeNode('li', { class: 'shell-header-search-empty', role: 'presentation' });
  emptyLi.textContent = 'No recent tools yet';
  listbox.appendChild(emptyLi);
  const live = makeNode('div', { id: 'header-search-live', class: 'shell-sr-only', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const footer = makeNode('div', { class: 'shell-header-search-footer' });
  const hints = makeNode('span', { class: 'shell-header-search-footer-hints' });
  hints.textContent = '\u2191\u2193 Navigate \u00b7 Enter Open \u00b7 Esc Close';
  // Story 10.20 followup: the "Show all actions" CTA was removed from
  // the inline search footer. Only the chord hints remain.
  footer.appendChild(hints);
  panel.appendChild(listbox);
  panel.appendChild(live);
  panel.appendChild(footer);
  searchWrap.appendChild(inputWrap);
  searchWrap.appendChild(panel);
  nav.appendChild(searchWrap);
  container.appendChild(nav);
  header.appendChild(container);
  body.appendChild(header);
  html.appendChild(body);

  nodes['html'] = html;
  nodes['header-search'] = searchWrap;
  nodes['header-search-input-wrap'] = inputWrap;
  nodes['header-search-icon'] = icon;
  nodes['header-search-input'] = input;
  nodes['header-search-panel'] = panel;
  nodes['header-search-listbox'] = listbox;
  nodes['header-search-live'] = live;

  const fakeBody = body;
  const fakeDoc = {
    readyState: 'complete',
    documentElement: docEl,
    body: fakeBody,
    head: makeNode('head'),
    activeElement: body,
    _listeners: {},
    addEventListener: function (type, fn, opts) {
      (this._listeners[type] = this._listeners[type] || []).push({ fn: fn, opts: opts });
    },
    removeEventListener: function (type, fn) {
      if (!this._listeners[type]) return;
      this._listeners[type] = this._listeners[type].filter(l => l.fn !== fn);
    },
    dispatchEvent: function (e) {
      const list = this._listeners[e.type] || [];
      for (const l of list) l.fn(e);
    },
    getElementById: function (id) { return nodes[id] || null; },
    querySelector: function (sel) { return querySelectorDeep(body, sel); },
    querySelectorAll: function (sel) { return querySelectorAllDeep(body, sel); },
    createElement: function (tag) { return makeNode(tag); },
    createTextNode: function (text) { return { textContent: text }; },
  };

  // Make all nested children findable via the doc.
  for (const k of Object.keys(nodes)) {
    const node = nodes[k];
    Object.defineProperty(fakeDoc, k, { value: node, configurable: true });
  }

  return fakeDoc;
}

const ctx = {
  window: { addEventListener: () => {} },
  document: makeFakeDoc(),
  console,
  performance: { now: () => Date.now() },
  setTimeout: (fn, ms) => { try { fn(); } catch (e) { console.error('  setTimeout err: ' + e.message); } return 0; },
  clearTimeout: () => {},
  AbortController,
  fetch: () => Promise.resolve({ ok: true }),
  matchMedia: () => ({ matches: false, addEventListener: () => {}, addListener: () => {} }),
  URLSearchParams,
  MutationObserver: class { observe() {} disconnect() {} },
  navigator: { clipboard: undefined, platform: 'Win32', userAgent: 'node' },
  location: { hash: '', href: 'https://example.com/' },
};

vm.createContext(ctx);

// Load scripts in document order (eager then defer).
const SCRIPTS = [
  ['site-config.js', false],
  ['storage-registry.js', false],
  ['utils.js', false],
  ['palette-actions.js', false],
  ['ht-lazy.js', false],
  ['shell.js', true],
  ['search.js', true],
  ['help-overlay.js', true],
  ['shell-thin.js', true],
];

let pass = 0, fail = 0;
function check(name, ok, info) {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (info ? ' — ' + info : '')); }
}

for (const [name, defer] of SCRIPTS) {
  try {
    const src = fs.readFileSync(path.join(JS_DIR, name), 'utf8');
    vm.runInContext(src, ctx, { filename: name });
    console.log('OK   ' + name);
  } catch (err) {
    console.error('FAIL ' + name + ': ' + err.message);
    if (err.stack) console.error(err.stack.split('\n').slice(0, 5).join('\n'));
  }
}

const HT = ctx.window.HT;
check('HT exists', typeof HT === 'object' && HT !== null);
check('HT.headerSearch exists', typeof HT.headerSearch === 'object');
check('HT.headerSearch.open is function', typeof HT.headerSearch.open === 'function');

// Verify the new DOM structure is what shell.js sees.
const doc = ctx.document;
const wrapper = doc.getElementById('header-search');
const input = doc.getElementById('header-search-input');
const icon = doc.getElementById('header-search-icon');
const inputWrap = doc.getElementById('header-search-input-wrap');
const panel = doc.getElementById('header-search-panel');
const listbox = doc.getElementById('header-search-listbox');

check('wrapper exists', !!wrapper);
check('input exists', !!input);
check('inputWrap exists', !!inputWrap);
check('icon (svg) exists', !!icon);
check('panel exists', !!panel);
check('listbox exists', !!listbox);

// Trigger the focus event on the input — this is what the new open/close
// wiring listens for.
console.log('Simulating input focus event...');
input.dispatchEvent({ type: 'focus' });

// Wait a tick for any debounced / async work.
ctx.setTimeout(() => {}, 0);

check('panel is no longer hidden after focus', !panel.hasAttribute('hidden'));
check('input aria-expanded=true after focus', input.getAttribute('aria-expanded') === 'true');
check('wrapper data-open=true after focus', wrapper.getAttribute('data-open') === 'true');

// Test close: simulate clicking outside the wrapper (which triggers the
// capture-phase click-outside handler).
console.log('Simulating click outside the search wrapper...');
const outsideEvent = { type: 'click', target: ctx.document.body };
ctx.document.dispatchEvent(outsideEvent);

check('panel hidden after click-outside', panel.hasAttribute('hidden'));
check('input aria-expanded=false after close', input.getAttribute('aria-expanded') === 'false');
check('wrapper data-open=false after close', wrapper.getAttribute('data-open') === 'false');

console.log('PASS: ' + pass + ', FAIL: ' + fail);
process.exit(fail === 0 ? 0 : 1);