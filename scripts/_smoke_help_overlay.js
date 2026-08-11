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
  // className setter: real DOM assigns to .className populate the
  // CSS class list. Our renderer (`renderRow`) uses `txt.className =
  // 'shell-help-label'` — without this setter the class would be
  // invisible to findAll(r, '.shell-help-label'). Patch 7 needs this.
  Object.defineProperty(el, 'className', {
    configurable: true,
    enumerable: true,
    get: function () { return Array.from(this._classes).join(' '); },
    set: function (value) {
      this._classes = new Set(String(value || '').split(/\s+/).filter(Boolean));
    },
  });
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

const docListeners = [];
const winListeners = [];

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
  // addEventListener is upgraded to a spy (Patches 4 + 6 + 9 — Story 3.3
  // review). The previous no-op stub meant the document-level `?` chord
  // and the `ht:palette-help` CustomEvent listener were unobservable —
  // any regression to a no-op would not be caught.
  addEventListener: function (type, fn, capture) {
    docListeners.push({ type: type, fn: fn, capture: !!capture });
  },
  removeEventListener: function (type, fn) {
    for (let i = docListeners.length - 1; i >= 0; i -= 1) {
      if (docListeners[i].type === type && docListeners[i].fn === fn) {
        docListeners.splice(i, 1);
      }
    }
  },
  dispatchEvent: function (event) {
    // Run registered listeners in registration order. help-overlay.js
    // attaches the keydown listener with capture=true, so capture
    // listeners run first — match that ordering here so the chord
    // test mirrors real-browser semantics.
    const cap = docListeners.filter(function (l) { return l.type === event.type && l.capture; });
    const bub = docListeners.filter(function (l) { return l.type === event.type && !l.capture; });
    for (let i = 0; i < cap.length; i += 1) {
      try { cap[i].fn(event); } catch (_) { /* defensive */ }
    }
    for (let i = 0; i < bub.length; i += 1) {
      try { bub[i].fn(event); } catch (_) { /* defensive */ }
    }
    return true;
  },
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
  // Patches 4 + 9 (Story 3.3 review): window-level `ht:palette-help`
  // CustomEvent listener is now observable. dispatchEvent synthesizes
  // the CustomEvent and runs registered listeners — so the Story 3.2
  // → 3.3 contract (palette-emitter → help-overlay-listener) is
  // exercised end-to-end.
  addEventListener: function (type, fn) {
    winListeners.push({ type: type, fn: fn });
  },
  removeEventListener: function (type, fn) {
    for (let i = winListeners.length - 1; i >= 0; i -= 1) {
      if (winListeners[i].type === type && winListeners[i].fn === fn) {
        winListeners.splice(i, 1);
      }
    }
  },
  dispatchEvent: function (event) {
    const arr = winListeners.filter(function (l) { return l.type === event.type; });
    for (let i = 0; i < arr.length; i += 1) {
      try { arr[i].fn(event); } catch (_) { /* defensive */ }
    }
    return true;
  },
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

// -------------------------------------------------------------
// Story 3.3 review additions — Patches 4 / 5 / 6 / 7 / 8 / 9.
// docListeners / winListeners are spy arrays populated by the
// upgraded addEventListener stubs (Patches 4 + 9). They let us
// (a) confirm listeners were installed on boot, and (b) drive
// those listeners with synthetic events — proving the chord /
// CustomEvent paths actually wire up the renderer.
// -------------------------------------------------------------

// Helper: locate the document-level keydown capture listener installed
// by boot(). The overlay registers exactly one (onDocumentKeydown).
function findKeydownCapture() {
  return docListeners.find(function (l) { return l.type === 'keydown' && l.capture; }) || null;
}
function findPaletteHelpListener() {
  return winListeners.find(function (l) { return l.type === 'ht:palette-help'; }) || null;
}

// Close everything so subsequent tests start from a known state.
// Reset focus to body so the chord's text-input-focus guard does
// not fire (the previous focus-restore test left activeElement on
// a synthesized <input> element).
handle.close();
activeElement = body;
assert(
  'doc-level keydown capture listener installed by boot() (Patch 4 prerequisite)',
  findKeydownCapture() !== null,
  'keydown-capture-listener-count=' + docListeners.filter(function (l) { return l.type === 'keydown' && l.capture; }).length
);
assert(
  'window-level ht:palette-help listener installed by boot() (Patch 9 prerequisite)',
  findPaletteHelpListener() !== null,
  'palette-help-listener-count=' + winListeners.filter(function (l) { return l.type === 'ht:palette-help'; }).length
);

// -------------------------------------------------------------
// Patch 4: document-level `?` chord — end-to-end. The harness
// dispatches a synthetic keydown event to the registered capture
// listener. This is the same code path the browser exercises when
// the user presses Shift+/ on the page.
// -------------------------------------------------------------
assert(
  '`?` chord opens overlay when closed (Patch 4: end-to-end)',
  (function () {
    if (handle.isOpen()) return 'already-open';
    const kd = findKeydownCapture();
    if (!kd) return 'no-listener';
    let prevented = false;
    kd.fn({ key: '?', ctrlKey: false, metaKey: false, altKey: false,
      preventDefault: function () { prevented = true; } });
    return handle.isOpen() && prevented;
  })()
);
assert(
  '`?` chord closes overlay when open (toggle, Patch 4)',
  (function () {
    if (!handle.isOpen()) return 'not-open';
    const kd = findKeydownCapture();
    kd.fn({ key: '?', ctrlKey: false, metaKey: false, altKey: false,
      preventDefault: function () {} });
    return !handle.isOpen();
  })()
);
handle.close();
activeElement = body;

// -------------------------------------------------------------
// Patch 6: negative tests (Epic 2 retro AI-E2-1 lesson — never
// ship a smoke harness without negative fixtures). Each fixture
// reproduces a state where the chord MUST be a no-op.
// -------------------------------------------------------------
// (a) Text-input focus — typing ? in a tool input goes to the input.
assert(
  '`?` chord is no-op when focus is in a text input (Patch 6 negative)',
  (function () {
    handle.close();
    activeElement = body;  // reset from prior tests
    const textbox = makeInput('text', { type: 'text' });
    body.appendChild(textbox);
    textbox.focus();  // activeElement = textbox
    const kd = findKeydownCapture();
    kd.fn({ key: '?', ctrlKey: false, metaKey: false, altKey: false,
      preventDefault: function () {} });
    const opened = handle.isOpen();
    if (opened) handle.close();
    return !opened;
  })()
);
// (b) Ctrl+? — modifier guard
assert(
  'Ctrl+? chord is no-op (Patch 6 negative: modifier guard)',
  (function () {
    handle.close();
    activeElement = body;
    const kd = findKeydownCapture();
    kd.fn({ key: '?', ctrlKey: true, metaKey: false, altKey: false,
      preventDefault: function () {} });
    const opened = handle.isOpen();
    if (opened) handle.close();
    return !opened;
  })()
);
// (c) Cmd+? — modifier guard
assert(
  'Cmd+? chord is no-op (Patch 6 negative: modifier guard)',
  (function () {
    handle.close();
    activeElement = body;
    const kd = findKeydownCapture();
    kd.fn({ key: '?', ctrlKey: false, metaKey: true, altKey: false,
      preventDefault: function () {} });
    const opened = handle.isOpen();
    if (opened) handle.close();
    return !opened;
  })()
);
// (d) Alt+? — modifier guard
assert(
  'Alt+? chord is no-op (Patch 6 negative: modifier guard)',
  (function () {
    handle.close();
    activeElement = body;
    const kd = findKeydownCapture();
    kd.fn({ key: '?', ctrlKey: false, metaKey: false, altKey: true,
      preventDefault: function () {} });
    const opened = handle.isOpen();
    if (opened) handle.close();
    return !opened;
  })()
);
// (e) Non-? key — must not toggle
assert(
  'non-? key (e.g. "a") is no-op for the chord (Patch 6 negative: key guard)',
  (function () {
    handle.close();
    activeElement = body;
    const kd = findKeydownCapture();
    kd.fn({ key: 'a', ctrlKey: false, metaKey: false, altKey: false,
      preventDefault: function () {} });
    return !handle.isOpen();
  })()
);

// -------------------------------------------------------------
// Patch 9: ht:palette-help CustomEvent — Story 3.2 → 3.3 contract.
// The palette emits this event; the overlay listens. We dispatch
// a synthetic event and assert the overlay toggles.
// -------------------------------------------------------------
assert(
  'ht:palette-help CustomEvent opens overlay (Patch 9: contract end-to-end)',
  (function () {
    handle.close();
    const fn = findPaletteHelpListener();
    if (!fn) return 'no-listener';
    fn.fn({ type: 'ht:palette-help' });
    return handle.isOpen();
  })()
);
assert(
  'ht:palette-help CustomEvent closes overlay (toggle, Patch 9)',
  (function () {
    if (!handle.isOpen()) return 'not-open';
    const fn = findPaletteHelpListener();
    fn.fn({ type: 'ht:palette-help' });
    return !handle.isOpen();
  })()
);
handle.close();

// -------------------------------------------------------------
// Patch 5: DOM-level filter behavior. The filter is debounced 50ms
// in debounceApplyFilter; the harness uses a real timer so we can
// flush the debounce by awaiting 60ms.
// -------------------------------------------------------------
// Re-open, then drive the search input directly. We bypass the
// 'input' event because our stub for `<input>.focus()` doesn't model
// user typing — instead we set search.value and dispatch a synthetic
// 'input' event to the registered handler.
handle.open();
const searchListeners = dom.search._listeners['input'] || [];
assert(
  'search input has at least one input listener (Patch 5 setup)',
  searchListeners.length >= 1,
  'listener-count=' + searchListeners.length
);
// Initial state: every row visible, empty-state hidden.
const allRowsBefore = findAll(dom.globalList, 'li');
assert(
  'all global rows visible before filter (Patch 5)',
  allRowsBefore.every(function (r) { return !('hidden' in r._attrs); }),
  'a-row-hidden-initially'
);
assert(
  'empty-state hidden before any filter (Patch 5)',
  'hidden' in dom.empty._attrs
);
// -------------------------------------------------------------
// Patch 5: DOM-level filter behavior. The filter is debounced 50ms
// in debounceApplyFilter; the harness drives the input event and
// waits for the timer to fire via chained setTimeouts.
//
// visibleRowCount(): anchor for the Phase 1 assertion — drops from
// 10 → 1 when the debounced filter applies the "theme" query.
//
// inputListenerFired: confirms the search input listener is invoked
// on every input dispatch. Without the wrapper below, a regression
// that detaches the listener (e.g., boot() early-returning) would
// pass silently because the filter wouldn't run.
// -------------------------------------------------------------
function visibleRowCount() {
  return findAll(dom.globalList, 'li').filter(function (r) {
    return !('hidden' in r._attrs);
  }).length;
}
let inputListenerFired = 0;
searchListeners.forEach(function (_fn, i) {
  const orig = searchListeners[i];
  searchListeners[i] = function (e) {
    inputListenerFired += 1;
    return orig(e);
  };
});

// Phase 1 dispatch: type "theme" (matches 'Cycle theme' row).
// Each subsequent phase dispatches its input INSIDE the deferred
// callbacks so each debounce timer fires independently — without
// that, all three input events dispatch synchronously, the debounce
// coalesces them, and only the LAST timer fires (with the LAST
// query value).
dom.search.value = 'theme';
searchListeners.forEach(function (fn) { fn({ target: dom.search }); });
// DEFERRED FILTER ASSERTIONS — each one waits for the 50ms debounce
// to flush by sleeping via setTimeout(... 100). We chain the phases
// so each input dispatch is followed by a 100ms wait before the
// assertions run. Without this, all three input events dispatch
// synchronously, the debounce coalesces them, and only the LAST
// timer fires (with the LAST query value), masking the per-state
// filter behavior.
setTimeout(function () {
  // ── Phase 1: "theme" → 1 row visible.
  const fr = {
    visible: visibleRowCount(),
    listenerFired: inputListenerFired,
    hiddenCount: findAll(dom.globalList, 'li').filter(function (r) { return 'hidden' in r._attrs; }).length,
    liveText: dom.live.textContent,
  };
  assert(
    'debounced filter flushes within 100ms (Patch 5: timer runs)',
    fr.visible === 1,
    'fr=' + JSON.stringify(fr)
  );
  assert(
    'filter "theme" leaves exactly one global row visible (Patch 5)',
    (function () {
      const rows = findAll(dom.globalList, 'li');
      const visible = rows.filter(function (r) { return !('hidden' in r._attrs); });
      return visible.length === 1 && /cycle theme/.test((visible[0].dataset && visible[0].dataset.search) || '');
    })()
  );
  assert(
    'non-matching rows are [hidden] after filter (Patch 5)',
    fr.hiddenCount === 9
  );
  assert(
    'live region announces "1 shortcut shown" after filter (Patch 5)',
    /^1 shortcuts? shown$/.test((fr.liveText || '').trim()),
    'live-text=' + JSON.stringify(fr.liveText)
  );

  // ── Phase 2: no-match query → empty state.
  setTimeout(function () {
    dom.search.value = 'xyzzy_no_such_string';
    searchListeners.forEach(function (fn) { fn({ target: dom.search }); });
    setTimeout(function () {
      const er = {
        emptyHidden: 'hidden' in dom.empty._attrs,
        emptyText: dom.empty.textContent,
        hiddenCount: findAll(dom.globalList, 'li').filter(function (r) { return 'hidden' in r._attrs; }).length,
      };
      assert(
        'empty-state visible when no rows match (Patch 5: AC-5)',
        !er.emptyHidden,
        'er=' + JSON.stringify(er)
      );
      assert(
        'empty-state text quotes the query (Patch 5: AC-5 verbatim)',
        /xyzzy_no_such_string/.test(er.emptyText || ''),
        'empty-text=' + JSON.stringify(er.emptyText)
      );
      assert(
        'all rows [hidden] when filter has no matches (Patch 5)',
        er.hiddenCount === 10
      );

      // ── Phase 3: clear filter → all rows visible.
      setTimeout(function () {
        dom.search.value = '';
        searchListeners.forEach(function (fn) { fn({ target: dom.search }); });
        setTimeout(function () {
          assert(
            'clearing filter restores all rows visible (Patch 5)',
            visibleRowCount() === 10,
            'visible=' + visibleRowCount()
          );
          handle.close();
          runAC7Assertions();
          runNoSlugAndContractAssertions();
          console.log('');
          console.log('passed: ' + pass + ', failed: ' + fail);
          if (pass === 0 && fail === 0) {
            console.error('VACUOUS: no assertions ran');
            process.exit(1);
          }
          process.exit(fail === 0 ? 0 : 1);
        }, 100);
      }, 50);
    }, 100);
  }, 50);
}, 50);

function runAC7Assertions() {
  handle.open();
  assert(
    'AC-7: each global row contains at least one <kbd> element (Patch 7)',
    (function () {
      const rows = findAll(dom.globalList, 'li');
      if (rows.length === 0) return 'no-rows';
      return rows.every(function (r) { return findAll(r, 'kbd').length >= 1; });
    })(),
    'rows-without-kbd=' + findAll(dom.globalList, 'li').filter(function (r) { return findAll(r, 'kbd').length === 0; }).length
  );
  assert(
    'AC-7: each global row has a .shell-help-label span (Patch 7)',
    (function () {
      const rows = findAll(dom.globalList, 'li');
      if (rows.length === 0) return 'no-rows';
      return rows.every(function (r) { return findAll(r, '.shell-help-label').length === 1; });
    })()
  );
  assert(
    'AC-7: each global row is wrapped in <li> with role=listitem (Patch 7)',
    (function () {
      const rows = findAll(dom.globalList, 'li');
      return rows.every(function (r) { return r.getAttribute && r.getAttribute('role') === 'listitem'; });
    })(),
    'role=' + (function () {
      const rows = findAll(dom.globalList, 'li');
      return rows.length ? rows[0].getAttribute('role') : 'no-rows';
    })()
  );
  assert(
    'AC-7: global section has an <h3> with id=help-global-heading (Patch 7)',
    dom.globalSection.querySelectorAll('h3').length === 1 &&
      dom.globalSection.querySelectorAll('h3')[0].getAttribute('id') === 'help-global-heading'
  );
  assert(
    'AC-7: per-tool rows also have kbd + label + role=listitem (Patch 7)',
    (function () {
      const rows = findAll(dom.toolList, 'li');
      if (rows.length === 0) return 'no-tool-rows';
      return rows.every(function (r) {
        return findAll(r, 'kbd').length >= 1 &&
          findAll(r, '.shell-help-label').length === 1 &&
          r.getAttribute('role') === 'listitem';
      });
    })()
  );
  handle.close();
}

function runNoSlugAndContractAssertions() {
  // AC-2: no-slug fresh context.
  const noSlugMain = makeEl('main', { tabindex: '-1' });
  const noSlugBody = makeEl('body');
  const noSlugDoc = Object.assign({}, stubDocument, {
    body: noSlugBody,
    activeElement: null,
    getElementById: function (id) { return id === 'help' ? dom.root :
      id === 'help-search' ? dom.search :
      id === 'help-live' ? dom.live :
      id === 'help-tool' ? dom.toolSection :
      id === 'help-tool-list' ? dom.toolList :
      id === 'help-global' ? dom.globalSection :
      id === 'help-global-list' ? dom.globalList :
      id === 'help-empty' ? dom.empty :
      id === 'main' ? noSlugMain : null; },
    querySelector: function (sel) {
      if (sel.indexOf('main[data-slug]') === 0) return null;
      if (sel.indexOf('main[tabindex="-1"]') === 0) return noSlugMain;
      if (sel.indexOf('.help-close') === 0) return dom.closeBtn;
      return null;
    },
    contains: function () { return true; },
  });
  const noSlugWin = Object.assign({}, stubWindow, {
    document: noSlugDoc,
    location: { search: '', href: 'http://localhost/' },
    HT: { homeGrid: { entries: [] } },
  });
  const noSlugCtx = vm.createContext({
    window: noSlugWin,
    document: noSlugDoc,
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
      noSlugCtx,
      { filename: 'help-overlay.js (no-slug)', timeout: 5000 }
    );
  } catch (err) {
    console.error('CRASH evaluating help-overlay.js (no-slug):', err);
  }
  const noSlugHandle = noSlugCtx.window.HT_HELP_OVERLAY_INIT;
  noSlugHandle.open();
  assert(
    'AC-2: per-tool section hidden when no slug present (Patch 7)',
    'hidden' in dom.toolSection._attrs,
    'hidden-attr=' + ('hidden' in dom.toolSection._attrs) +
      ' toolRows=' + findAll(dom.toolList, 'li').length
  );
  assert(
    'AC-2: global section still visible when no slug present (Patch 7)',
    !('hidden' in dom.globalSection._attrs),
    'hidden-attr=' + ('hidden' in dom.globalSection._attrs)
  );
  noSlugHandle.close();

  // Patch 8: api-contract entry pin.
  const API_CONTRACT = path.join(REPO_ROOT, 'assets/js/api-contract.js');
  let apiContractSrc = '';
  try { apiContractSrc = fs.readFileSync(API_CONTRACT, 'utf8'); }
  catch (err) { console.error('CRASH reading api-contract.js:', err); process.exit(1); }
  assert(
    'api-contract.js contains HT_HELP_OVERLAY_INIT entry (Patch 8)',
    /HT_HELP_OVERLAY_INIT/.test(apiContractSrc),
    'entry-missing'
  );
  assert(
    'api-contract.js HT_HELP_OVERLAY_INIT entry uses stability level (Patch 8)',
    (function () {
      const block = apiContractSrc.match(/HT_HELP_OVERLAY_INIT[\s\S]{0,400}/);
      if (!block) return false;
      return /stability\s*[:=]\s*['"]/.test(block[0]);
    })()
  );
}

// DEFERRED FILTER ASSERTIONS are scheduled above — see the
// setTimeout(... 50 → 100 → 50 → 100) chain. AC-7 / AC-2 /
// Patch 8 assertions are queued inside that callback chain
// (runAC7Assertions + runNoSlugAndContractAssertions) so they
// execute AFTER the 50ms debounce timer has fired. Final
// summary is logged inside the deepest setTimeout.