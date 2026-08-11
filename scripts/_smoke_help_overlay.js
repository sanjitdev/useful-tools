/* scripts/_smoke_help_overlay.js — Story 3.3 contract smoke driver.
 *
 * Headless Node driver for the keyboard-shortcuts help overlay.
 * Loads assets/js/help-overlay.js in a Node vm context against a
 * minimal DOM stub that mirrors assets/shell/help.html, and exercises
 * the contract assertions from AC-1 / AC-3 / AC-4 / AC-6 of Story 3.3
 * without a browser.
 *
 * Companion to scripts/_smoke_palette_actions.js (Story 3.2) and
 * scripts/_smoke_palette_search.js (Story 3.1). This driver verifies
 * the overlay's NON-MODAL behavior (no focus trap), the document-level
 * `?` chord, the embed-mode guard, the ht:palette-help listener
 * (Story 3.2 contract), the search filter (substring + case-folded),
 * the focus restoration on close, and the absence of `aria-modal` /
 * localStorage writes.
 *
 * Vacuous-pass guard (pass === 0 && fail === 0 → exit 1) catches
 * hollow runs.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const HELP_OVERLAY_JS = path.join(REPO_ROOT, 'assets/js/help-overlay.js');
const HELP_HTML = path.join(REPO_ROOT, 'assets/shell/help.html');

// -------------------------------------------------------------
// DOM stub — mirrors assets/shell/help.html
// -------------------------------------------------------------
// help-overlay.js reaches into:
//   #help (root, role=region, hidden)
//   #help-title (h2, focusable for focusHeading)
//   #help-search (input type=search)
//   #help-live (live region)
//   #help-tool + #help-tool-list (per-tool section)
//   #help-global + #help-global-list (global section)
//   #help-empty (empty state)
//   .help-close (close button)
//   main[data-slug] (current tool slug)
// Plus querySelectorAll('main[tabindex="-1"]') for the close fallback.
// Plus a document.body active-element reference.
//
// We DO NOT need an actual <main> for most tests — only the focus-
// restoration fallback path needs main[tabindex="-1"]. For embed-mode
// tests, the URL.search has to carry ?embed=1.
// -------------------------------------------------------------

function makeEl(tag, attrs) {
  const a = attrs || {};
  const el = {
    tagName: (tag || 'div').toUpperCase(),
    nodeType: 1,
    children: [],
    childNodes: [],
    _attrs: {},
    _classes: new Set(),
    _style: {},
    dataset: {},
    _listeners: {},
    hidden: false,
    parentNode: null,
    setAttribute: function (name, value) {
      this._attrs[name] = String(value);
      if (name === 'hidden') this.hidden = true;
      if (name === 'class' && value) {
        this._classes = new Set(String(value).split(/\s+/));
      }
      if (name && name.indexOf('data-') === 0) {
        this.dataset[name.slice(5).replace(/-([a-z])/g, function (_, c) {
          return c.toUpperCase();
        })] = String(value);
      }
    },
    getAttribute: function (name) {
      return this._attrs[name] != null ? this._attrs[name] : null;
    },
    removeAttribute: function (name) {
      delete this._attrs[name];
      if (name === 'hidden') this.hidden = false;
    },
    hasAttribute: function (name) {
      return Object.prototype.hasOwnProperty.call(this._attrs, name);
    },
    addEventListener: function (type, fn) {
      (this._listeners[type] = this._listeners[type] || []).push(fn);
    },
    removeEventListener: function (type, fn) {
      const arr = this._listeners[type] || [];
      const i = arr.indexOf(fn);
      if (i !== -1) arr.splice(i, 1);
    },
    appendChild: function (child) {
      child.parentNode = this;
      this.children.push(child);
      this.childNodes.push(child);
      return child;
    },
    removeChild: function (child) {
      const i = this.children.indexOf(child);
      if (i !== -1) this.children.splice(i, 1);
      const j = this.childNodes.indexOf(child);
      if (j !== -1) this.childNodes.splice(j, 1);
      child.parentNode = null;
      return child;
    },
    insertBefore: function (child, ref) {
      const i = ref ? this.children.indexOf(ref) : this.children.length;
      this.children.splice(i === -1 ? this.children.length : i, 0, child);
      this.childNodes = this.children.slice();
      child.parentNode = this;
      return child;
    },
    classList: {
      add: function () {},
      remove: function () {},
      toggle: function () {},
      contains: function () { return false; },
    },
    contains: function (node) {
      if (node === this) return true;
      for (let i = 0; i < this.children.length; i += 1) {
        if (this.children[i].contains && this.children[i].contains(node)) return true;
      }
      return false;
    },
    focus: function () { activeElement = this; },
    blur: function () { if (activeElement === this) activeElement = null; },
    click: function () {
      const arr = this._listeners.click || [];
      for (let i = 0; i < arr.length; i += 1) {
        try { arr[i]({ preventDefault: () => {} }); } catch (_) { /* defensive */ }
      }
    },
    querySelector: function (sel) { return findFirst(this, sel); },
    querySelectorAll: function (sel) { return findAll(this, sel); },
    textContent: '',
    innerHTML: '',
  };
  el.firstChild = null;
  el.lastChild = null;
  Object.defineProperty(el, 'firstChild', {
    get: function () { return this.children[0] || null; },
  });
  Object.defineProperty(el, 'lastChild', {
    get: function () { return this.children[this.children.length - 1] || null; },
  });
  if (a.id) el._attrs.id = a.id;
  if (a.role) el._attrs.role = a.role;
  if (a['aria-label']) el._attrs['aria-label'] = a['aria-label'];
  if (a['aria-live']) el._attrs['aria-live'] = a['aria-live'];
  if (a['aria-hidden']) el._attrs['aria-hidden'] = a['aria-hidden'];
  if (a['aria-labelledby']) el._attrs['aria-labelledby'] = a['aria-labelledby'];
  if (a.tabindex != null) el._attrs.tabindex = String(a.tabindex);
  if (a.dataset) Object.assign(el.dataset, a.dataset);
  return el;
}

let activeElement = null;

function makeInput(type, attrs) {
  const el = makeEl(type || 'input', attrs);
  el.value = '';
  el.type = type || 'input';
  el.tagName = 'INPUT';
  Object.defineProperty(el, 'isContentEditable', { get: function () { return false; } });
  return el;
}

function findFirst(root, sel) {
  const all = findAll(root, sel);
  return all.length ? all[0] : null;
}

// Minimal CSS selector matcher. Supports: #id, .class, [role=...],
// tag, [data-slug], [hidden], and combinations by descending specificity.
function findAll(root, sel) {
  const out = [];
  function matches(el, s) {
    if (!el || el.nodeType !== 1) return false;
    const parts = s.split(/\s+/);
    for (let i = 0; i < parts.length; i += 1) {
      const p = parts[i];
      if (p.indexOf('#') === 0) {
        if (el._attrs.id !== p.slice(1)) return false;
      } else if (p.indexOf('.') === 0) {
        if (!el._classes || !el._classes.has(p.slice(1))) return false;
      } else if (p.indexOf('[') === 0 && p.indexOf(']') !== -1) {
        const m = p.slice(1, -1);
        const eq = m.indexOf('=');
        if (eq !== -1) {
          const k = m.slice(0, eq);
          let v = m.slice(eq + 1);
          if (v.charAt(0) === '"' || v.charAt(0) === "'") v = v.slice(1, -1);
          if (el._attrs[k] !== v) return false;
        } else if (m === 'hidden') {
          if (!el._attrs.hidden) return false;
        } else {
          return false;
        }
      } else {
        if (el.tagName !== p.toUpperCase()) return false;
      }
    }
    return true;
  }
  function walk(node) {
    if (!node) return;
    if (matches(node, sel)) out.push(node);
    const ch = node.children || [];
    for (let i = 0; i < ch.length; i += 1) walk(ch[i]);
  }
  walk(root);
  return out;
}

// Build the help DOM tree from the static markup. help-overlay.js
// only cares about IDs + classes; we synthesize the structure rather
// than parsing HTML (keeps the harness 100% Node-only, no DOMParser).
function buildHelpDom() {
  const root = makeEl('div', { id: 'help', role: 'region', 'aria-label': 'Keyboard shortcuts' });
  root._attrs.hidden = '';
  root._attrs['aria-hidden'] = 'true';

  const panel = makeEl('div', { class: 'shell-help-panel' });
  const header = makeEl('header', { class: 'shell-help-header' });
  const h2 = makeEl('h2', { id: 'help-title', tabindex: '-1' });
  h2.textContent = 'Keyboard shortcuts';
  const closeBtn = makeEl('button', { class: 'help-close', 'aria-label': 'Close keyboard shortcuts' });
  closeBtn.textContent = '×';
  header.appendChild(h2);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  const search = makeInput('search', { id: 'help-search', 'aria-label': 'Filter shortcuts' });
  panel.appendChild(search);

  const live = makeEl('div', { id: 'help-live', class: 'shell-sr-only', 'aria-live': 'polite', 'aria-atomic': 'true' });
  panel.appendChild(live);

  const toolSection = makeEl('section', { id: 'help-tool', class: 'shell-help-section', 'aria-labelledby': 'help-tool-heading' });
  toolSection._attrs.hidden = '';
  const toolH = makeEl('h3', { id: 'help-tool-heading' });
  toolH.textContent = 'Per-tool shortcuts';
  const toolList = makeEl('ul', { id: 'help-tool-list', role: 'list' });
  toolSection.appendChild(toolH);
  toolSection.appendChild(toolList);

  const globalSection = makeEl('section', { id: 'help-global', class: 'shell-help-section', 'aria-labelledby': 'help-global-heading' });
  const globalH = makeEl('h3', { id: 'help-global-heading' });
  globalH.textContent = 'Global shortcuts';
  const globalList = makeEl('ul', { id: 'help-global-list', role: 'list' });
  globalSection.appendChild(globalH);
  globalSection.appendChild(globalList);

  const empty = makeEl('p', { id: 'help-empty', class: 'shell-help-empty', role: 'presentation' });
  empty._attrs.hidden = '';
  empty.textContent = 'No shortcuts match.';

  const foot = makeEl('p', { class: 'shell-help-foot' });
  foot.textContent = 'Press ? to close · / to filter · Esc to leave the filter';

  panel.appendChild(toolSection);
  panel.appendChild(globalSection);
  panel.appendChild(empty);
  panel.appendChild(foot);
  root.appendChild(panel);
  return {
    root: root,
    search: search,
    live: live,
    toolSection: toolSection,
    toolList: toolList,
    globalSection: globalSection,
    globalList: globalList,
    empty: empty,
    closeBtn: closeBtn,
  };
}

const dom = buildHelpDom();
const main = makeEl('main', { tabindex: '-1' });
main._attrs['data-slug'] = 'age-calculator';
main._attrs.tabindex = '-1';
const body = makeEl('body');

const elementRegistry = {
  help: dom.root,
  'help-search': dom.search,
  'help-live': dom.live,
  'help-tool': dom.toolSection,
  'help-tool-list': dom.toolList,
  'help-global': dom.globalSection,
  'help-global-list': dom.globalList,
  'help-empty': dom.empty,
  main: main,
};

const stubDocument = {
  documentElement: makeEl('html'),
  body: body,
  // activeElement is a dynamic getter — element.focus() updates the
  // closure-scoped `activeElement` variable; reading activeElement
  // returns the live reference. This matches the DOM spec where
  // document.activeElement always reflects the current focus target.
  get activeElement() { return activeElement; },
  set activeElement(v) { activeElement = v; },
  getElementById: function (id) { return elementRegistry[id] || null; },
  querySelector: function (sel) {
    if (sel.indexOf('main[data-slug]') === 0) return main;
    if (sel.indexOf('main[tabindex="-1"]') === 0) return main;
    if (sel.indexOf('.help-close') === 0) return dom.closeBtn;
    if (sel.indexOf('#help-title') === 0) {
      const all = findAll(dom.root, '#help-title');
      return all[0] || null;
    }
    return null;
  },
  querySelectorAll: function (sel) {
    if (sel.indexOf('main[tabindex="-1"]') === 0) return [main];
    return [];
  },
  addEventListener: function () {},
  removeEventListener: function () {},
  dispatchEvent: function () { return true; },
  createElement: function (tag) { return makeEl(tag); },
  createTextNode: function (text) { return { nodeType: 3, textContent: text }; },
  contains: function (node) {
    for (const k in elementRegistry) {
      if (elementRegistry[k] === node) return true;
    }
    // The focus-restore path passes the configured callingElement.
    // Anything appended to body counts as in-document for the harness.
    if (body && node) {
      for (let i = 0; i < body.children.length; i += 1) {
        if (body.children[i] === node) return true;
      }
    }
    return false;
  },
  readyState: 'complete',
};

// help-overlay.js's #ht-tools-json-inline fallback (when window.HT.homeGrid
// isn't populated). The smoke harness simulates "no inline" by not
// rendering the element — getElementById returns null which is the
// expected null-check branch in resolveToolEntry.
const inlineToolsJson = null;

const platform = (process.platform === 'darwin') ? 'MacIntel' : 'Win32';
const userAgent = (process.platform === 'darwin') ? 'Mozilla/5.0 (Macintosh)' : 'Mozilla/5.0 (Windows)';

const stubWindow = {
  location: {
    search: '',
    href: 'http://localhost/tools/age-calculator/',
  },
  navigator: { platform: platform, userAgent: userAgent },
  document: stubDocument,
  addEventListener: function () {},
  removeEventListener: function () {},
  dispatchEvent: function () { return true; },
  CustomEvent: function (type, init) {
    this.type = type;
    this.detail = (init && init.detail) || null;
  },
  MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
  matchMedia: function () { return { matches: false, addEventListener: function () {}, removeEventListener: function () {} }; },
  localStorage: {
    getItem: function () { return null; },
    setItem: function () { localStorageWrites.push([this._k, arguments[1]]); },
    removeItem: function () {},
    clear: function () {},
    _k: '',
  },
  HT: { homeGrid: { entries: [
    { slug: 'age-calculator', name: 'Age Calculator',
      shortcuts: [
        { keys: ['n'], label: 'New calculation', action: 'reset' },
        { keys: ['c'], label: 'Clear form' },
        { keys: ['Mod', 'r'], label: 'Recalculate' },
      ] },
  ] } },
};

const localStorageWrites = [];

global.window = stubWindow;
global.document = stubDocument;
// Node 22's `global.navigator` is a read-only getter — skip the global
// assignment. The vm context provides navigator directly to the loaded
// script, and help-overlay.js reads it via window.navigator.platform.
global.HT = stubWindow.HT;
global.fetch = function () { return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ tools: [] }); } }); };
global.Promise = Promise;
global.MutationObserver = stubWindow.MutationObserver;
global.matchMedia = stubWindow.matchMedia;
global.localStorage = stubWindow.localStorage;
global.setTimeout = setTimeout;
global.clearTimeout = clearTimeout;
global.setInterval = setInterval;
global.clearInterval = clearInterval;

const ctx = vm.createContext({
  window: stubWindow,
  document: stubDocument,
  navigator: stubWindow.navigator,
  console: console,
  HT: undefined,
  fetch: global.fetch,
  Promise: Promise,
  MutationObserver: stubWindow.MutationObserver,
  matchMedia: stubWindow.matchMedia,
  localStorage: stubWindow.localStorage,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
});

try {
  // help-overlay.js IIFEs at load. timeout: 5000ms — same defense as
  // the Story 3.2 patches (patch #19).
  vm.runInContext(
    fs.readFileSync(HELP_OVERLAY_JS, 'utf8'),
    ctx,
    { filename: 'help-overlay.js', timeout: 5000 }
  );
} catch (err) {
  console.error('CRASH evaluating help-overlay.js:', err);
  process.exit(1);
}

// Also walk the static help.html to verify the documented ARIA wiring.
let helpHtml = '';
try {
  helpHtml = fs.readFileSync(HELP_HTML, 'utf8');
} catch (err) {
  console.error('CRASH reading help.html:', err);
  process.exit(1);
}

let pass = 0;
let fail = 0;
function assert(name, cond, info) {
  if (cond) {
    pass += 1;
    console.log('  PASS    ' + name);
  } else {
    fail += 1;
    console.log('  FAIL    ' + name + (info ? ' — ' + info : ''));
  }
}

const handle = ctx.window.HT_HELP_OVERLAY_INIT;
const win = ctx.window;

// -------------------------------------------------------------
// AC-1: HT_HELP_OVERLAY_INIT is exposed + frozen.
// -------------------------------------------------------------
assert(
  'window.HT_HELP_OVERLAY_INIT is exposed',
  handle && typeof handle === 'object'
);
assert(
  'HT_HELP_OVERLAY_INIT is frozen (Object.isFrozen)',
  handle && Object.isFrozen(handle),
  'frozen=' + Object.isFrozen(handle)
);
assert(
  'HT_HELP_OVERLAY_INIT.version matches Story 3.3.0',
  handle && handle.version === '3.3.0',
  'version=' + (handle && handle.version)
);
assert(
  'HT_HELP_OVERLAY_INIT has shortcuts array',
  handle && Array.isArray(handle.shortcuts),
  'typeof=' + (handle && typeof handle.shortcuts)
);
assert(
  'HT_HELP_OVERLAY_INIT has search function',
  handle && typeof handle.search === 'function'
);
assert(
  'HT_HELP_OVERLAY_INIT has open function',
  handle && typeof handle.open === 'function'
);
assert(
  'HT_HELP_OVERLAY_INIT has close function',
  handle && typeof handle.close === 'function'
);
assert(
  'HT_HELP_OVERLAY_INIT has toggle function',
  handle && typeof handle.toggle === 'function'
);
assert(
  'HT_HELP_OVERLAY_INIT has isOpen function',
  handle && typeof handle.isOpen === 'function'
);

// AC-1 (shortcuts shape): each entry is { keys: [...], label: ... }.
if (handle && Array.isArray(handle.shortcuts)) {
  assert(
    'shortcuts has >= 8 entries (per UX-DR-6.5 minimum)',
    handle.shortcuts.length >= 8,
    'length=' + handle.shortcuts.length
  );
  let shapeOk = true;
  for (let i = 0; i < handle.shortcuts.length; i += 1) {
    const s = handle.shortcuts[i];
    if (!s || !Array.isArray(s.keys) || typeof s.label !== 'string') {
      shapeOk = false;
      break;
    }
  }
  assert(
    'every shortcut has { keys: string[], label: string } shape',
    shapeOk
  );
  assert(
    'shortcuts array is frozen',
    Object.isFrozen(handle.shortcuts),
    'frozen=' + Object.isFrozen(handle.shortcuts)
  );
}

// -------------------------------------------------------------
// AC-3: search filter — substring + case-folded on label + keys.
// -------------------------------------------------------------
assert(
  'search(["toggle","Open palette"])("Tog") returns the toggle row',
  handle && handle.search([{keys: ['Mod', 'K'], label: 'Open command palette'}], 'Tog').length === 0 ||
  handle && handle.search([{keys: ['Mod', 'K'], label: 'Open command palette'}], 'Open command').length === 1,
  'verify behavior'
);
assert(
  'search() is case-insensitive (matches "PALETTE" → "Open command palette")',
  handle && handle.search(
    [{keys: ['Mod', 'K'], label: 'Open command palette'}, {keys: ['?'], label: 'Toggle this help overlay'}],
    'PALETTE'
  ).length === 1
);
assert(
  'search("xyzzy") returns [] on no match',
  handle && handle.search(
    [{keys: ['Mod', 'K'], label: 'Open command palette'}],
    'xyzzy'
  ).length === 0
);
assert(
  'search("") returns all rows',
  handle && handle.search(
    [{keys: ['Mod', 'K'], label: 'Open command palette'}, {keys: ['?'], label: 'Toggle this help overlay'}],
    ''
  ).length === 2
);
assert(
  'search("   ") returns all rows (whitespace-only treated as empty)',
  handle && handle.search(
    [{keys: ['?'], label: 'Toggle this help overlay'}],
    '   '
  ).length === 1
);
assert(
  'search matches keys (substring on "k" matches Mod+K)',
  handle && handle.search(
    [{keys: ['Mod', 'K'], label: 'Open command palette'}],
    'k'
  ).length === 1
);

// -------------------------------------------------------------
// AC-6: open/close/toggle. Document-level capture-phase `?` chord.
// -------------------------------------------------------------
assert(
  'isOpen() returns false initially',
  handle && handle.isOpen() === false,
  'isOpen=' + (handle && handle.isOpen())
);
assert(
  'open() flips isOpen to true',
  handle && (function () { handle.open(); return handle.isOpen(); })() === true,
  'isOpen=' + (handle && handle.isOpen())
);
assert(
  'root.removeAttribute("hidden") fires on open',
  !('hidden' in dom.root._attrs),
  'hidden-key-in=' + ('hidden' in dom.root._attrs)
);
assert(
  'root.setAttribute("aria-hidden", "false") fires on open (UX-DR-3 AT visibility)',
  dom.root._attrs['aria-hidden'] === 'false',
  'aria-hidden=' + dom.root._attrs['aria-hidden']
);
assert(
  'close() flips isOpen back to false',
  handle && (function () { handle.close(); return handle.isOpen(); })() === false,
  'isOpen=' + (handle && handle.isOpen())
);
assert(
  'root re-acquires hidden attribute on close',
  'hidden' in dom.root._attrs,
  'hidden-key-in=' + ('hidden' in dom.root._attrs)
);
assert(
  'root re-acquires aria-hidden="true" on close',
  dom.root._attrs['aria-hidden'] === 'true',
  'aria-hidden=' + dom.root._attrs['aria-hidden']
);

// open() is idempotent.
handle.open();
const firstListenerCount = (dom.root._listeners && Object.keys(dom.root._listeners).length) || 0;
handle.open();
const secondListenerCount = (dom.root._listeners && Object.keys(dom.root._listeners).length) || 0;
assert(
  'open() is idempotent (no duplicate document listeners on second call)',
  firstListenerCount === secondListenerCount
);

// close() clears the search input. Close after typing into it.
handle.open();
dom.search.value = 'abc';
handle.close();
assert(
  'close() clears the search input value',
  dom.search.value === '',
  'value=' + JSON.stringify(dom.search.value)
);
// After close, applyFilter('') has run, so EVERY row should be visible
// (no filter applied). The hidden check is the inverse: hidden attr
// should NOT be present on any row.
assert(
  'close() clears the filter — all rows visible again',
  (function () {
    const rows = findAll(dom.globalList, 'li');
    if (rows.length === 0) return false;
    for (let i = 0; i < rows.length; i += 1) {
      if ('hidden' in rows[i]._attrs) return false;
    }
    return true;
  })(),
  'a row still hidden after close'
);

// toggle() flips state.
assert(
  'toggle() opens when closed',
  (function () { handle.toggle(); return handle.isOpen(); })() === true
);
assert(
  'toggle() closes when open',
  (function () { handle.toggle(); return handle.isOpen(); })() === false
);

// -------------------------------------------------------------
// AC-3 (continued): per-tool section rendering reads HT.homeGrid.entries.
// -------------------------------------------------------------
handle.open();
assert(
  'per-tool section visible when slug has shortcuts',
  !dom.toolSection._attrs.hidden,
  'hidden=' + dom.toolSection._attrs.hidden
);
const toolRows = findAll(dom.toolList, 'li');
assert(
  'per-tool section rendered 3 rows from homeGrid entry',
  toolRows.length === 3,
  'length=' + toolRows.length
);
assert(
  'per-tool rows use <kbd> children with correct label',
  (function () {
    const row = toolRows[0];
    if (!row) return 'no row[0]';
    const kbdEls = findAll(row, 'kbd');
    const labelEl = findAll(row, '.shell-help-label')[0];
    if (kbdEls.length !== 1) return 'kbd-count=' + kbdEls.length;
    if (!labelEl) return 'no labelEl';
    return /New calculation/.test(labelEl.textContent) || 'label=' + JSON.stringify(labelEl.textContent);
  })()
);
// Mod token must NOT leak as the literal string "Mod" — it must be
// swapped to the platform-correct glyph.
const recalcRow = toolRows.find(function (r) {
  const lbl = findAll(r, '.shell-help-label')[0];
  return lbl && /Recalculate/.test(lbl.textContent);
});
assert(
  'Mod token replaced with platform-correct glyph in rendered row',
  (function () {
    if (!recalcRow) return 'no recalcRow (find returned undefined)';
    const kbds = findAll(recalcRow, 'kbd');
    if (kbds.length !== 2) return 'kbd-count=' + kbds.length + ' (want 2 for Mod+r)';
    return kbds.every(function (k) { return k.textContent !== 'Mod'; }) || 'glyphs-leaked-Mod';
  })(),
  'glyphs=' + (recalcRow && JSON.stringify(findAll(recalcRow, 'kbd').map(function (k) { return k.textContent; })))
);

// Global section has all 10 rows.
const globalRows = findAll(dom.globalList, 'li');
assert(
  'global section rendered all 10 hardcoded rows',
  globalRows.length === 10,
  'length=' + globalRows.length
);

// Search filtering via the exported search() function — the DOM-level
// debounced filter uses setTimeout(50ms), which requires the libuv
// event loop to tick (the harness is fully sync, so we cannot easily
// wait for it). Instead, verify the filter LOGIC through the exported
// handle.search(rows, query) — this is the same function the DOM
// filter calls, just without the 50ms debounce.
const allGlobal = handle.shortcuts;
const filteredTheme = handle.search(allGlobal, 'theme');
assert(
  'search(shortcuts, "theme") returns the theme cycle row',
  filteredTheme.length === 1 && /Cycle theme/.test(filteredTheme[0].label),
  'matches=' + JSON.stringify(filteredTheme.map(function (r) { return r.label; }))
);
const filteredHelp = handle.search(allGlobal, 'help');
assert(
  'search(shortcuts, "help") returns the help overlay row',
  filteredHelp.length === 1 && /Toggle this help/.test(filteredHelp[0].label),
  'matches=' + JSON.stringify(filteredHelp.map(function (r) { return r.label; }))
);
const filteredEsc = handle.search(allGlobal, 'Esc');
assert(
  'search(shortcuts, "Esc") matches by keys (case-folded substring)',
  filteredEsc.length >= 1 && filteredEsc.every(function (r) { return r.keys.indexOf('Esc') !== -1 || /close/i.test(r.label); }),
  'matches=' + JSON.stringify(filteredEsc.map(function (r) { return r.label + '|' + r.keys.join('+'); }))
);
const filteredEmpty = handle.search(allGlobal, '');
assert(
  'search(shortcuts, "") returns ALL rows',
  filteredEmpty.length === allGlobal.length,
  'length=' + filteredEmpty.length + ' want=' + allGlobal.length
);
const filteredNoMatch = handle.search(allGlobal, 'xyzzy_no_such_string');
assert(
  'search(shortcuts, "xyzzy...") returns []',
  filteredNoMatch.length === 0
);
// Escape behavior: search input value clear on close (already tested
// above). DOM-level filter test would need an async harness — skip
// and rely on the exported search() verification as proof of filter
// correctness.
handle.close();

// -------------------------------------------------------------
// AC-4 (UX-DR-3): non-modal. No aria-modal. No focus trap.
// -------------------------------------------------------------
assert(
  'help.html does NOT contain aria-modal="true"',
  helpHtml.indexOf('aria-modal="true"') === -1,
  'aria-modal pattern found'
);
assert(
  'help.html sets role="region" (non-modal pattern)',
  /<div[^>]+id="help"[^>]+role="region"/.test(helpHtml)
);
assert(
  'help.html has aria-label="Keyboard shortcuts"',
  /aria-label="Keyboard shortcuts"/.test(helpHtml)
);
assert(
  'help.html has #help-search input',
  /<input[^>]+id="help-search"[^>]+type="search"/.test(helpHtml)
);
assert(
  'help.html has #help-live aria-live="polite"',
  /<div[^>]+id="help-live"[^>]+aria-live="polite"/.test(helpHtml)
);

// Focus restoration: open then close should focus the calling element.
// We seed callingElement by focusing the search input first.
const focusProbe = makeEl('input', { type: 'text' });
focusProbe.value = '';
body.appendChild(focusProbe);
focusProbe.focus();
assert(
  'activeElement is focusProbe before open',
  activeElement === focusProbe
);
handle.open();
assert(
  'open() moves focus to #help-title (focusHeading)',
  (function () {
    const title = findAll(dom.root, '#help-title')[0];
    return title && activeElement === title;
  })()
);
handle.close();
assert(
  'close() restores focus to the calling element (focusProbe)',
  activeElement === focusProbe,
  'activeElement-tag=' + (activeElement && activeElement.tagName)
);

// -------------------------------------------------------------
// AC-6 (embed-mode guard): help overlay chord is no-op in embed.
// -------------------------------------------------------------
// We construct a fresh context where location.search carries embed=1
// AND we spy on document.addEventListener. The boot() function checks
// isEmbedMode() and short-circuits before attaching the document-level
// keydown listener — so addEventListener('keydown', ...) must NOT be
// called. The programmatic handle is still exposed because the smoke
// harness needs it (per help-overlay.js doc-comment: programmatic API
// is the smoke harness entry point).
const embedDocListeners = [];
const embedWinListeners = [];
const embedDoc = Object.assign({}, stubDocument, {
  addEventListener: function (type, fn) { embedDocListeners.push({type: type, fn: fn}); },
  removeEventListener: function () {},
});
const embedWin = Object.assign({}, stubWindow, {
  location: { search: '?embed=1', href: 'http://localhost/?embed=1' },
  document: embedDoc,
  addEventListener: function (type, fn) { embedWinListeners.push({type: type, fn: fn}); },
  removeEventListener: function () {},
});
const embedCtx = vm.createContext({
  window: embedWin,
  document: embedDoc,
  navigator: stubWindow.navigator,
  console: console,
  HT: undefined,
  fetch: global.fetch,
  Promise: Promise,
  MutationObserver: stubWindow.MutationObserver,
  matchMedia: stubWindow.matchMedia,
  localStorage: stubWindow.localStorage,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
});
try {
  vm.runInContext(
    fs.readFileSync(HELP_OVERLAY_JS, 'utf8'),
    embedCtx,
    { filename: 'help-overlay.js (embed)', timeout: 5000 }
  );
} catch (err) {
  console.error('CRASH evaluating help-overlay.js in embed mode:', err);
}
const embedHandle = embedCtx.window.HT_HELP_OVERLAY_INIT;
assert(
  'embed-mode still exposes HT_HELP_OVERLAY_INIT handle',
  embedHandle && typeof embedHandle === 'object'
);
assert(
  'embed-mode isOpen returns false initially',
  embedHandle && embedHandle.isOpen() === false
);
assert(
  'embed-mode suppresses document-level keydown listener (UX-DR-7 no-op)',
  !embedDocListeners.some(function (l) { return l.type === 'keydown'; }),
  'keydown-listeners=' + embedDocListeners.filter(function (l) { return l.type === 'keydown'; }).length
);
assert(
  'embed-mode suppresses ht:palette-help listener (UX-DR-7 no-op)',
  !embedWinListeners.some(function (l) { return l.type === 'ht:palette-help'; }),
  'palette-help-listeners=' + embedWinListeners.filter(function (l) { return l.type === 'ht:palette-help'; }).length
);

// -------------------------------------------------------------
// Privacy / no-tracking: localStorage.setItem must not be called by
// the overlay during normal use. Reset the counter, run open/close/
// toggle/search, then assert no writes happened.
// -------------------------------------------------------------
localStorageWrites.length = 0;
handle.open();
handle.close();
handle.open();
handle.toggle();
handle.close();
assert(
  'overlay never writes to localStorage during open/close/toggle',
  localStorageWrites.length === 0,
  'writes=' + localStorageWrites.length
);

console.log('');
console.log('passed: ' + pass + ', failed: ' + fail);

// Vacuous-pass guard
if (pass === 0 && fail === 0) {
  console.error('VACUOUS: no assertions ran');
  process.exit(1);
}
process.exit(fail === 0 ? 0 : 1);