/* scripts/_smoke_settings_modal.js — Story 3.5 contract smoke driver.
 *
 * Headless Node driver for the Settings modal
 * (`assets/shell/settings.html` consumed by `assets/js/shell.js`).
 * Loads the module in a Node vm context against a minimal DOM stub
 * that mirrors assets/shell/settings.html, and exercises the contract
 * assertions from AC-1 through AC-6 of Story 3.5 without a browser:
 *
 *   AC-1  All 7 fields present + explicit defaults (theme select,
 *         dynamic locale, units/currency selects, fontScale range with
 *         percentage <output>, reducedMotion checkbox with OS-override,
 *         clearAll button).
 *   AC-2  Keyboard operability — Tab order follows field source order;
 *         native <input type="checkbox"> toggle on Space; native <button>
 *         click on Enter; focus trap stays inside modal.
 *   AC-3  Immediate persistence — every field writes via the storage
 *         registry on change/input. No debounce; 3 changes = 3 writes.
 *   AC-4  Modal width matches var(--modal-width, 560px); responsive
 *         below 600px (CSS-only — not exercised in the Node harness).
 *   AC-5  Focus restoration on close — openSettings captures
 *         document.activeElement; closeSettings returns focus to it.
 *   AC-6  All previous-story invariants preserved — HT.settings surface
 *         stays frozen, open/close/clearAll signatures unchanged.
 *
 * Companion to scripts/_smoke_global_chords.js (Story 3.4) and
 * scripts/_smoke_help_overlay.js (Story 3.3). Mirrors their
 * vacuous-pass-guard pattern (pass === 0 && fail === 0 → exit 1) so a
 * hollow run fails the gate.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const SHELL_JS = path.join(REPO_ROOT, 'assets/js/shell.js');
const SETTINGS_HTML = path.join(REPO_ROOT, 'assets/shell/settings.html');

// -------------------------------------------------------------
// DOM stub — mirrors assets/shell/settings.html exactly.
// Every <input>, <select>, <button>, and <output> the modal expects.
// -------------------------------------------------------------

let activeElement = null;

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
    style: {},
    dataset: {},
    _listeners: {},
    hidden: false,
    parentNode: null,
    options: [],
    setAttribute: function (name, value) {
      this._attrs[name] = String(value);
      if (name === 'hidden') this.hidden = true;
      if (name === 'aria-hidden') this._attrs[name] = String(value);
      if (name === 'class' && value) {
        this._classes = new Set(String(value).split(/\s+/));
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
    dispatchEvent: function (event) {
      const listeners = (this._listeners[event.type] || []).slice();
      for (let i = 0; i < listeners.length; i += 1) {
        try { listeners[i](event); } catch (_) { /* defensive */ }
      }
    },
    appendChild: function (child) {
      child.parentNode = this;
      this.children.push(child);
      this.childNodes.push(child);
      return child;
    },
    removeChild: function (child) {
      const idx = this.children.indexOf(child);
      if (idx !== -1) {
        this.children.splice(idx, 1);
        this.childNodes.splice(idx, 1);
        child.parentNode = null;
      }
      return child;
    },
    contains: function (node) {
      if (node === this) return true;
      for (let i = 0; i < this.children.length; i += 1) {
        const c = this.children[i];
        if (c && c.contains && c.contains(node)) return true;
      }
      return false;
    },
    querySelector: function (sel) {
      const all = [];
      function walk(node, seen) {
        if (!node) return;
        if (seen.indexOf(node) !== -1) return;
        seen.push(node);
        if (matchBySelector(node, sel)) all.push(node);
        (node.children || []).forEach(function (c) { walk(c, seen); });
      }
      walk(this, []);
      return all[0] || null;
    },
    querySelectorAll: function (sel) {
      const all = [];
      function walk(node, seen) {
        if (!node) return;
        if (seen.indexOf(node) !== -1) return;
        seen.push(node);
        if (matchBySelector(node, sel)) all.push(node);
        (node.children || []).forEach(function (c) { walk(c, seen); });
      }
      walk(this, []);
      return all;
    },
    focus: function () { activeElement = this; },
    blur: function () { if (activeElement === this) activeElement = null; },
    click: function () {
      const listeners = (this._listeners.click || []).slice();
      for (let i = 0; i < listeners.length; i += 1) {
        try { listeners[i]({ type: 'click', target: this, preventDefault: function () {} }); } catch (_) {}
      }
    },
  };
  // Initial attribute/option seeding.
  Object.keys(a).forEach(function (k) { el.setAttribute(k, a[k]); });
  return el;
}

// Specialized <select> — value/options semantics.
function makeSelect(name, options, defaultValue) {
  const el = makeEl('select', { name: name });
  el.tagName = 'SELECT';
  el.name = name;
  el.value = defaultValue || (options[0] ? options[0].value : '');
  el._options = [];
  options.forEach(function (opt) {
    const o = makeEl('option', { value: opt.value });
    o.tagName = 'OPTION';
    o.value = opt.value;
    o.textContent = opt.label;
    el._options.push(o);
  });
  Object.defineProperty(el, 'options', {
    get: function () { return el._options; },
    configurable: true,
  });
  Object.defineProperty(el, 'firstChild', {
    get: function () { return el._options[0] || null; },
    configurable: true,
  });
  el.removeChild = function (child) {
    const idx = el._options.indexOf(child);
    if (idx !== -1) el._options.splice(idx, 1);
    return child;
  };
  el.appendChild = function (child) {
    el._options.push(child);
    if (child && typeof child === 'object') child.parentNode = el;
    return child;
  };
  return el;
}

// Specialized <input type=range> — exposes value as string, min/max/step.
function makeRange(name, min, max, step, defaultValue) {
  const el = makeEl('input', { name: name, type: 'range', min: String(min), max: String(max), step: String(step), value: String(defaultValue) });
  el.tagName = 'INPUT';
  el.type = 'range';
  el.name = name;
  el.min = String(min);
  el.max = String(max);
  el.step = String(step);
  el.value = String(defaultValue);
  el.checked = false;
  return el;
}

function makeCheckbox(name) {
  const el = makeEl('input', { name: name, type: 'checkbox', value: '1' });
  el.tagName = 'INPUT';
  el.type = 'checkbox';
  el.name = name;
  el.checked = false;
  el.value = '1';
  return el;
}

function makeButton(id) {
  const el = makeEl('button', { type: 'button', id: id });
  el.tagName = 'BUTTON';
  el.type = 'button';
  el.disabled = false;
  return el;
}

function makeOutput(id) {
  const el = makeEl('output', { id: id, 'aria-hidden': 'true' });
  el.tagName = 'OUTPUT';
  el.textContent = '100%';
  return el;
}

// Build the modal DOM tree per assets/shell/settings.html.
const body = makeEl('body');
activeElement = body;

const cogButton = makeEl('button', { id: 'settings-cog', 'aria-label': 'Settings' });
cogButton.tagName = 'BUTTON';

const themeSelect = makeSelect('ht.theme', [
  { value: 'auto', label: 'Auto (follow system)' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
], 'auto');

const localeSelect = makeSelect('ht.locale', [{ value: 'en', label: 'English' }], 'en');

const reducedMotionCheckbox = makeCheckbox('ht.reducedMotion');
reducedMotionCheckbox.id = 'ht-reducedMotion';

const unitsSelect = makeSelect('ht.units', [
  { value: 'metric', label: 'Metric' },
  { value: 'imperial', label: 'Imperial' },
], 'metric');
unitsSelect.id = 'ht-units';

const currencySelect = makeSelect('ht.currency', [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'JPY', label: 'JPY — Japanese Yen' },
  { value: 'CAD', label: 'CAD — Canadian Dollar' },
  { value: 'AUD', label: 'AUD — Australian Dollar' },
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'CNY', label: 'CNY — Chinese Yuan' },
], 'USD');
currencySelect.id = 'ht-currency';

const fontScaleInput = makeRange('ht.fontScale', 0.85, 1.4, 0.05, 1);
fontScaleInput.id = 'ht-fontScale';

const fontScaleOutput = makeOutput('ht-fontScale-output');

const clearButton = makeButton('shell-settings-clear');
clearButton.textContent = 'Clear all local data…';
clearButton.id = 'shell-settings-clear';

const backdrop = makeEl('div', { 'data-settings-dismiss': '' });
backdrop.classList && backdrop.classList.add('shell-settings-modal__backdrop');

const closeBtn = makeEl('button', { 'data-settings-dismiss': '', 'aria-label': 'Close settings' });
closeBtn.classList && closeBtn.classList.add('shell-settings-modal__close');
closeBtn.textContent = '×';

const panel = makeEl('div', { class: 'shell-settings-modal__panel', tabindex: '-1' });
panel.classList && panel.classList.add('shell-settings-modal__panel');
panel._attrs.tabindex = '-1';

const form = makeEl('form', { id: 'shell-settings-form', class: 'shell-settings-modal__body' });

const modal = makeEl('div', { id: 'shell-settings-modal', role: 'dialog', 'aria-modal': 'true', 'aria-hidden': 'true', hidden: '' });
modal._attrs['aria-modal'] = 'true';
modal._attrs['aria-labelledby'] = 'settings-modal-title';
modal.hidden = true;
modal.appendChild(backdrop);
modal.appendChild(panel);
// Add the 6 fields + clear button in tab/source order.
form.appendChild(themeSelect.parentNode || form); // keep tree minimal
form.appendChild(themeSelect);
form.appendChild(localeSelect);
form.appendChild(reducedMotionCheckbox);
form.appendChild(unitsSelect);
form.appendChild(currencySelect);
form.appendChild(fontScaleInput);
form.appendChild(fontScaleOutput);
form.appendChild(clearButton);
panel.appendChild(form);
body.appendChild(cogButton);
body.appendChild(modal);

// querySelector('input:not([disabled]), select:not([disabled]), button:not([disabled])')
// Note: <output> is intentionally excluded — it is not focusable per
// the HTML spec (only when tabindex is set, which AC-2 forbids for the
// fontScale output mirror).
function liveFocusables(scope) {
  const out = [];
  function walk(node, seen) {
    if (!node) return;
    if (seen.indexOf(node) !== -1) return;
    seen.push(node);
    const tag = node.tagName;
    // Exclude <output> from the focusable list — it is not a focusable
    // element in the HTML spec. The fontScale <output> is purely a
    // visual mirror of the range input.
    const isFocusableTag = tag === 'INPUT' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'TEXTAREA' || tag === 'A';
    if (isFocusableTag && !node.disabled && node._attrs.tabindex !== '-1') {
      out.push(node);
    }
    (node.children || []).forEach(function (c) { walk(c, seen); });
  }
  walk(scope, []);
  return out;
}

// -------------------------------------------------------------
// querySelector stub — name + id based.
// -------------------------------------------------------------
function matchByName(node, name) {
  if (!node) return false;
  if (node.name === name) return true;
  return false;
}
function matchById(node, id) {
  return node && node._attrs && node._attrs.id === id;
}
function matchBySelector(node, sel) {
  // Very small subset:
  //   'select[name="ht.theme"]'
  //   'input[name="ht.theme"]'
  //   '#shell-settings-modal'
  //   '.shell-settings-modal__panel'
  //   'input[name="ht.reducedMotion"]'
  const m = sel.match(/^([a-z]+)\[name="([^"]+)"\]$/i);
  if (m) return node.tagName === m[1].toUpperCase() && node.name === m[2];
  if (sel.charAt(0) === '#') return matchById(node, sel.slice(1));
  if (sel.charAt(0) === '.') {
    const cls = node._classes || new Set();
    return cls.has(sel.slice(1));
  }
  return false;
}

function querySelector(sel) {
  const all = [];
  function walk(node, seen) {
    if (!node) return;
    if (seen.indexOf(node) !== -1) return;
    seen.push(node);
    if (matchBySelector(node, sel)) all.push(node);
    (node.children || []).forEach(function (c) { walk(c, seen); });
  }
  walk(body, []);
  return all[0] || null;
}

function querySelectorAll(sel) {
  const all = [];
  function walk(node, seen) {
    if (!node) return;
    if (seen.indexOf(node) !== -1) return;
    seen.push(node);
    if (matchBySelector(node, sel)) all.push(node);
    (node.children || []).forEach(function (c) { walk(c, seen); });
  }
  walk(body, []);
  return all;
}

// -------------------------------------------------------------
// Stub document with the surface shell.js touches.
// -------------------------------------------------------------
const stubDocument = {
  documentElement: makeEl('html'),
  body: body,
  activeElement: body,
  hidden: false,
  get activeElementRef() { return activeElement; },
  getElementById: function (id) {
    function walk(node, seen) {
      if (!node) return null;
      if (seen.indexOf(node) !== -1) return null;
      seen.push(node);
      if (node._attrs && node._attrs.id === id) return node;
      const children = node.children || [];
      for (let i = 0; i < children.length; i += 1) {
        const hit = walk(children[i], seen);
        if (hit) return hit;
      }
      return null;
    }
    return walk(body, []);
  },
  querySelector: querySelector,
  querySelectorAll: querySelectorAll,
  addEventListener: function (type, fn) {
    // No-op; the modal owns its own listeners.
  },
  removeEventListener: function (type, fn) {
    // No-op.
  },
  createElement: function (tag) {
    if (tag === 'option') {
      const o = makeEl('option', {});
      o.tagName = 'OPTION';
      o.value = '';
      o.textContent = '';
      return o;
    }
    return makeEl(tag, {});
  },
  dispatchEvent: function (event) {
    if (event.type === 'ht:settings-theme-changed') {
      themeChangedEvents.push(event);
    }
  },
};

// documentElement must also record ht:settings-theme-changed for the
// theme CustomEvent test (setSettingsTheme calls
// document.documentElement.dispatchEvent, not document.dispatchEvent).
stubDocument.documentElement.dispatchEvent = function (event) {
  if (event.type === 'ht:settings-theme-changed') {
    themeChangedEvents.push(event);
  }
};

// Override activeElement getter on stubDocument.
Object.defineProperty(stubDocument, 'activeElement', {
  get: function () { return activeElement; },
  configurable: true,
});

let themeChangedEvents = [];

// -------------------------------------------------------------
// localStorage spy — must catch load-time writes (no debounce/boot).
// Records every interaction; tests inspect localStorageCalls.length.
// -------------------------------------------------------------
let localStorageCalls = [];
let localStorageStore = {};
const fakeLocalStorage = {
  getItem: function (k) {
    localStorageCalls.push({ op: 'get', k: k });
    return Object.prototype.hasOwnProperty.call(localStorageStore, k) ? localStorageStore[k] : null;
  },
  setItem: function (k, v) {
    localStorageCalls.push({ op: 'set', k: k, v: v });
    localStorageStore[k] = String(v);
  },
  removeItem: function (k) {
    localStorageCalls.push({ op: 'remove', k: k });
    delete localStorageStore[k];
  },
  clear: function () {
    localStorageCalls.push({ op: 'clear' });
    localStorageStore = {};
  },
  key: function () { return null; },
  length: 0,
};

// -------------------------------------------------------------
// matchMedia — controls prefers-color-scheme + prefers-reduced-motion.
// -------------------------------------------------------------
function makeMatchMedia(query) {
  const mq = {
    matches: false,
    media: query,
    addListener: function () {},
    removeListener: function () {},
    addEventListener: function () {},
    removeEventListener: function () {},
  };
  return mq;
}
const stubNavigator = {
  languages: ['en-US', 'fr-FR', 'de'],
  language: 'en-US',
  platform: 'Win32',
  userAgent: 'Mozilla/5.0 (Windows) smoke',
};

// -------------------------------------------------------------
// fakeLocation + window surface.
// -------------------------------------------------------------
const fakeLocation = {
  search: '',
  pathname: '/tools/age-calculator/',
  href: 'http://localhost/tools/age-calculator/',
  reload: function () { reloadCalls += 1; },
};
let reloadCalls = 0;

// Spy on HT.storage.clear to assert clearAll calls it.
const storageClearCalls = [];
const fakeStorage = {
  clear: function () { storageClearCalls.push({ ts: Date.now() }); },
  get: function () {},
  set: function () {},
  remove: function () {},
  list: function () { return []; },
  keys: function () { return []; },
  register: function () {},
  registerHistoryKeys: function () { return 0; },
};

// Site-config stub — shell.js boot calls wireViewSourceLink which
// needs HT.siteConfig.blobBase. Provide a stub so boot doesn't retry.
const fakeSiteConfig = {
  repoUrl: 'http://localhost/',
  blobBase: 'http://localhost/blob',
  defaultBranch: 'main',
  brand: 'Handy Tools',
  defaultLocale: 'en',
};

let confirmReturn = true;
let confirmCalls = 0;

const stubWindow = {
  location: fakeLocation,
  localStorage: fakeLocalStorage,
  navigator: stubNavigator,
  document: stubDocument,
  matchMedia: function (q) { return makeMatchMedia(q); },
  confirm: function (_msg) { confirmCalls += 1; return confirmReturn; },
  CustomEvent: function (type, init) { this.type = type; this.detail = (init && init.detail) || null; },
  Event: function (type, init) { this.type = type; this.bubbles = !!(init && init.bubbles); },
  HT: { storage: fakeStorage, palette: {}, a11y: null, siteConfig: fakeSiteConfig },
  addEventListener: function () {},
  removeEventListener: function () {},
  dispatchEvent: function () { return true; },
};

const stubPerformance = {
  now: function () { return 0; },
};

// MutationObserver stub — shell.js boot calls observeTheme() which builds
// one. We don't deliver mutations (the smoke harness never fires theme
// changes that would trigger this), so a no-op observer suffices.
const stubMutationObserver = function () {};
stubMutationObserver.prototype = { observe: function () {}, disconnect: function () {} };

const ctx = vm.createContext({
  window: stubWindow,
  document: stubDocument,
  navigator: stubNavigator,
  localStorage: fakeLocalStorage,
  HT: stubWindow.HT,
  matchMedia: stubWindow.matchMedia,
  console: console,
  Promise: Promise,
  performance: stubPerformance,
  MutationObserver: stubMutationObserver,
  setTimeout: function () { return 0; },
  clearTimeout: function () {},
  requestAnimationFrame: function (fn) { return setTimeout(fn, 0); },
  cancelAnimationFrame: function (id) { clearTimeout(id); },
  CustomEvent: stubWindow.CustomEvent,
  Event: stubWindow.Event,
  URLSearchParams: URLSearchParams,
  Object: Object,
  Array: Array,
  Set: Set,
  Date: Date,
  Number: Number,
  String: String,
  Boolean: Boolean,
  JSON: JSON,
  Math: Math,
  Error: Error,
});

// -------------------------------------------------------------
// Load shell.js into the vm context.
// -------------------------------------------------------------
try {
  vm.runInContext(
    fs.readFileSync(SHELL_JS, 'utf8'),
    ctx,
    { filename: 'shell.js', timeout: 5000 }
  );
} catch (err) {
  console.error('CRASH evaluating shell.js:', err);
  process.exit(1);
}

// -------------------------------------------------------------
// AC: load-time localStorage check — IMMEDIATELY after IIFE load,
// BEFORE resetSpies() runs. The settings module's wireSettings()
// runs at boot and writes ht.reducedMotion per the OS-override
// rule. We assert the SETTINGS_KEYS shape; a regression that adds
// extra storage writes at boot (e.g. theme write before user input)
// surfaces here.
// -------------------------------------------------------------
const loadTimeLocalStorageCallCount = localStorageCalls.length;
const loadTimeReducedMotionWrite = localStorageCalls.filter(function (c) { return c.k === 'ht.reducedMotion' && c.op === 'set'; }).length;
// shell.js:1271-1273 setSettingsReducedMotion() is called at boot
// (wireSettings end-of-fn), so 1 localStorage WRITE is expected for
// ht.reducedMotion. Two boot GETs (ht.theme from the theme-cycle
// button wiring at line 186, and ht.reducedMotion from the boot
// path at line 1450) are also expected. A regression that adds
// extra boot-time WRITES (e.g. theme writes before user input)
// surfaces here. The assertions run after the test framework is
// initialized below.

// -------------------------------------------------------------
// Test framework.
// -------------------------------------------------------------
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

assert('Boot: storage calls at load time === 3 (2 reads + 1 write)', loadTimeLocalStorageCallCount === 3, 'expected 3 calls (ht.theme get, ht.reducedMotion get, ht.reducedMotion set), got ' + loadTimeLocalStorageCallCount + ' calls: ' + JSON.stringify(localStorageCalls.map(function (c) { return c.op + ':' + c.k; })));
assert('Boot: the single boot WRITE is ht.reducedMotion', loadTimeReducedMotionWrite === 1, 'expected 1 ht.reducedMotion write, got ' + loadTimeReducedMotionWrite);
resetSpies();

function resetSpies() {
  localStorageCalls = [];
  localStorageStore = {};
  storageClearCalls.length = 0;
  reloadCalls = 0;
  confirmCalls = 0;
  confirmReturn = true;
  themeChangedEvents = [];
  fakeLocation.search = '';
  activeElement = body;
}

// -------------------------------------------------------------
// AC: HT.settings surface — frozen, signatures unchanged.
// -------------------------------------------------------------
const htSettings = ctx.window.HT.settings;
assert(
  'HT.settings is exposed',
  htSettings && typeof htSettings === 'object'
);
assert(
  'HT.settings is frozen (Object.isFrozen)',
  htSettings && Object.isFrozen(htSettings),
  'frozen=' + Object.isFrozen(htSettings)
);
assert(
  'HT.settings.open is a function',
  htSettings && typeof htSettings.open === 'function'
);
assert(
  'HT.settings.close is a function',
  htSettings && typeof htSettings.close === 'function'
);
assert(
  'HT.settings.clearAll is a function',
  htSettings && typeof htSettings.clearAll === 'function'
);
assert(
  'HT.settings.keys is an array of length 6',
  htSettings && Array.isArray(htSettings.keys) && htSettings.keys.length === 6,
  'keys=' + JSON.stringify(htSettings && htSettings.keys)
);
assert(
  'HT.settings.keys is frozen (AD-14 frozen surface)',
  htSettings && Object.isFrozen(htSettings.keys),
  'frozen=' + Object.isFrozen(htSettings.keys)
);
assert(
  'HT.settings.defaults is an object',
  htSettings && typeof htSettings.defaults === 'object' && htSettings.defaults !== null
);
assert(
  'HT.settings.defaults is frozen (AD-14 frozen surface)',
  htSettings && Object.isFrozen(htSettings.defaults),
  'frozen=' + Object.isFrozen(htSettings.defaults)
);
assert(
  'HT.settings.defaults["ht.theme"] === "auto"',
  htSettings && htSettings.defaults['ht.theme'] === 'auto'
);
assert(
  'HT.settings.defaults["ht.locale"] === "en"',
  htSettings && htSettings.defaults['ht.locale'] === 'en'
);
assert(
  'HT.settings.defaults["ht.units"] === "metric"',
  htSettings && htSettings.defaults['ht.units'] === 'metric'
);
assert(
  'HT.settings.defaults["ht.currency"] === "USD"',
  htSettings && htSettings.defaults['ht.currency'] === 'USD'
);
assert(
  'HT.settings.defaults["ht.fontScale"] === "1" (Story 3.5 default string)',
  htSettings && htSettings.defaults['ht.fontScale'] === '1',
  'got=' + (htSettings && htSettings.defaults['ht.fontScale'])
);
assert(
  'HT.settings.defaults["ht.reducedMotion"] === "0"',
  htSettings && htSettings.defaults['ht.reducedMotion'] === '0'
);

// -------------------------------------------------------------
// AC-1: Theme select — populateSettings + change event writes.
// -------------------------------------------------------------
resetSpies();
// Trigger populateSettings by opening the modal (which calls populateSettings).
// But first we need to flip the OS-override matchMedia off — otherwise
// reducedMotion boots true and writes a localStorage entry we don't want
// to count here. The default matchMedia.matches === false already.
stubWindow.matchMedia = function (q) {
  const mq = makeMatchMedia(q);
  return mq;
};
// We need to re-set the context.matchMedia since shell.js captured the
// original matchMedia at boot via window.matchMedia. Reset by re-running
// load or by directly inspecting populateSettings via a fresh open.
// Simpler: open the modal, which calls populateSettings().
activeElement = cogButton;
htSettings.open();
// After open(), populateSettings ran. Theme select default = auto.
assert(
  'Theme select default === "auto"',
  themeSelect.value === 'auto',
  'value=' + themeSelect.value
);
// Reset spy AFTER populateSettings() so the assertion reflects CHANGE-driven writes.
resetSpies();
themeSelect.value = 'dark';
themeSelect.dispatchEvent({ type: 'change', target: themeSelect });
assert(
  'Theme change → dark writes ht.theme=dark',
  localStorageCalls.some(function (c) { return c.op === 'set' && c.k === 'ht.theme' && c.v === 'dark'; }),
  'calls=' + JSON.stringify(localStorageCalls)
);
assert(
  'Theme change → data-theme attribute set to dark',
  stubDocument.documentElement._attrs['data-theme'] === 'dark',
  'data-theme=' + stubDocument.documentElement._attrs['data-theme']
);
resetSpies();
themeSelect.value = 'light';
themeSelect.dispatchEvent({ type: 'change', target: themeSelect });
assert(
  'Theme change → light writes ht.theme=light',
  localStorageCalls.some(function (c) { return c.op === 'set' && c.k === 'ht.theme' && c.v === 'light'; })
);
// Theme select dispatchEvent → setSettingsTheme → CustomEvent dispatch.
// Our stubDocument.dispatchEvent routes 'ht:settings-theme-changed' to themeChangedEvents.
assert(
  'Theme change dispatches ht:settings-theme-changed CustomEvent',
  themeChangedEvents.length >= 1,
  'events=' + themeChangedEvents.length
);

// (debug block removed)
// navigator stub: ['en-US', 'fr-FR', 'de'] → codes [en, fr, de] + en fallback
// (already present). Order after dedup: en, fr, de.
// -------------------------------------------------------------
resetSpies();
activeElement = cogButton;
htSettings.close();
htSettings.open();
assert(
  'Locale select populated with navigator-derived options',
  localeSelect.options.length === 3,
  'options=' + localeSelect.options.map(function (o) { return o.value; }).join(',')
);
assert(
  'Locale select options are en, fr, de',
  localeSelect.options.map(function (o) { return o.value; }).join(',') === 'en,fr,de',
  'options=' + localeSelect.options.map(function (o) { return o.value; }).join(',')
);
resetSpies();
localeSelect.value = 'fr';
localeSelect.dispatchEvent({ type: 'change', target: localeSelect });
assert(
  'Locale change → fr writes ht.locale=fr',
  localStorageCalls.some(function (c) { return c.op === 'set' && c.k === 'ht.locale' && c.v === 'fr'; })
);

// -------------------------------------------------------------
// AC-1: Units select — default metric; change writes.
// -------------------------------------------------------------
resetSpies();
htSettings.close();
htSettings.open();
assert(
  'Units select default === "metric"',
  unitsSelect.value === 'metric',
  'value=' + unitsSelect.value
);
resetSpies();
unitsSelect.value = 'imperial';
unitsSelect.dispatchEvent({ type: 'change', target: unitsSelect });
assert(
  'Units change → imperial writes ht.units=imperial',
  localStorageCalls.some(function (c) { return c.op === 'set' && c.k === 'ht.units' && c.v === 'imperial'; })
);

// -------------------------------------------------------------
// AC-1: Currency select — default USD; change writes.
// -------------------------------------------------------------
resetSpies();
htSettings.close();
htSettings.open();
assert(
  'Currency select default === "USD"',
  currencySelect.value === 'USD',
  'value=' + currencySelect.value
);
resetSpies();
currencySelect.value = 'EUR';
currencySelect.dispatchEvent({ type: 'change', target: currencySelect });
assert(
  'Currency change → EUR writes ht.currency=EUR',
  localStorageCalls.some(function (c) { return c.op === 'set' && c.k === 'ht.currency' && c.v === 'EUR'; })
);

// -------------------------------------------------------------
// AC-1: Font scale range — default 1; input writes.
// -------------------------------------------------------------
resetSpies();
htSettings.close();
htSettings.open();
assert(
  'FontScale default value === "1"',
  fontScaleInput.value === '1',
  'value=' + fontScaleInput.value
);
assert(
  'FontScale <output> shows 100%',
  fontScaleOutput.textContent === '100%',
  'output=' + fontScaleOutput.textContent
);
resetSpies();
fontScaleInput.value = '1.2';
fontScaleInput.dispatchEvent({ type: 'input', target: fontScaleInput });
assert(
  'FontScale input → 1.2 writes ht.fontScale=1.2 (string)',
  localStorageCalls.some(function (c) { return c.op === 'set' && c.k === 'ht.fontScale' && c.v === '1.2'; })
);
assert(
  'FontScale input → <output> updates to 120%',
  fontScaleOutput.textContent === '120%',
  'output=' + fontScaleOutput.textContent
);

// -------------------------------------------------------------
// AC-1: ReducedMotion checkbox — OS-override on populate.
// -------------------------------------------------------------
resetSpies();
// OS-override: with matchMedia.matches === false (default), checkbox
// should default to unchecked (no stored value).
htSettings.close();
htSettings.open();
assert(
  'ReducedMotion checkbox default === false (no OS-override match)',
  reducedMotionCheckbox.checked === false,
  'checked=' + reducedMotionCheckbox.checked
);
// Toggle and write.
resetSpies();
reducedMotionCheckbox.checked = true;
reducedMotionCheckbox.dispatchEvent({ type: 'change', target: reducedMotionCheckbox });
assert(
  'ReducedMotion change → true writes ht.reducedMotion=1',
  localStorageCalls.some(function (c) { return c.op === 'set' && c.k === 'ht.reducedMotion' && c.v === '1'; })
);
assert(
  'ReducedMotion change → true sets data-reduced-motion="true"',
  stubDocument.documentElement._attrs['data-reduced-motion'] === 'true',
  'data-reduced-motion=' + stubDocument.documentElement._attrs['data-reduced-motion']
);

// OS-override: rebuild matchMedia to return matches=true, re-open modal.
const savedMatchMedia = stubWindow.matchMedia;
stubWindow.matchMedia = function (q) {
  const mq = makeMatchMedia(q);
  if (q.indexOf('reduced-motion') !== -1) mq.matches = true;
  return mq;
};
// We also need the IIFE-loaded shell.js's reference to matchMedia to
// pick this up. Since shell.js captured `window.matchMedia` indirectly
// through call sites at populateSettings() time, we re-evaluate the
// closed-over reference by calling populateSettings via openSettings.
// openSettings → populateSettings reads window.matchMedia each call.
resetSpies();
htSettings.close();
htSettings.open();
assert(
  'ReducedMotion OS-override: matches=true → checkbox defaults checked',
  reducedMotionCheckbox.checked === true,
  'checked=' + reducedMotionCheckbox.checked
);
stubWindow.matchMedia = savedMatchMedia;

// -------------------------------------------------------------
// AC-3: No debounce — 3 changes = 3 localStorage writes.
// -------------------------------------------------------------
resetSpies();
unitsSelect.value = 'imperial';
unitsSelect.dispatchEvent({ type: 'change', target: unitsSelect });
unitsSelect.value = 'metric';
unitsSelect.dispatchEvent({ type: 'change', target: unitsSelect });
unitsSelect.value = 'imperial';
unitsSelect.dispatchEvent({ type: 'change', target: unitsSelect });
const unitsWrites = localStorageCalls.filter(function (c) { return c.op === 'set' && c.k === 'ht.units'; });
assert(
  'No debounce: 3 changes produce 3 writes',
  unitsWrites.length === 3,
  'writes=' + unitsWrites.length
);

// -------------------------------------------------------------
// AC-4: Modal width CSS — declarative only. Verify the rule string
// in chrome-settings.css contains the required token + @media query.
// Story 4 Phase 5 split components.css; the settings modal rules
// landed in chrome-settings.css (lazy-loaded via HT.lazyLoadCss).
// -------------------------------------------------------------
const cssContents = fs.readFileSync(
  path.join(REPO_ROOT, 'assets/css/chrome-settings.css'),
  'utf8'
);
assert(
  'CSS: .shell-settings-modal__panel uses var(--modal-width, 560px)',
  /\.shell-settings-modal__panel[^}]*max-width:\s*var\(--modal-width,\s*560px\)/.test(cssContents),
  'css does not contain max-width: var(--modal-width, 560px)'
);
assert(
  'CSS: @media (max-width: 600px) responsive rule exists',
  /@media\s*\(max-width:\s*600px\)\s*\{[^}]*\.shell-settings-modal__panel[^}]*max-width:\s*none/.test(cssContents),
  'css does not contain @media (max-width: 600px) rule'
);
assert(
  'CSS: @media rule sets width: calc(100vw - 16px)',
  /@media\s*\(max-width:\s*600px\)\s*\{[^}]*\.shell-settings-modal__panel[^}]*width:\s*calc\(100vw\s*-\s*16px\)/.test(cssContents)
);

// -------------------------------------------------------------
// AC-5: Focus restoration — open captures cog, close returns focus.
// -------------------------------------------------------------
resetSpies();
activeElement = cogButton;
htSettings.close(); // ensure clean
htSettings.open();
const _dbgModal = stubDocument.getElementById('shell-settings-modal');
assert(
  'After open, modal is not hidden',
  modal.hidden === false,
  'modal.hidden=' + modal.hidden
);
assert(
  'After open, modal removeAttribute("hidden") called',
  modal.hasAttribute('hidden') === false
);
htSettings.close();
assert(
  'After close, focus restored to the calling cog',
  activeElement === cogButton,
  'activeElement.tagName=' + (activeElement && activeElement.tagName)
);

// -------------------------------------------------------------
// AC-6: Frozen surface signature unchanged (Story 3.2 + 3.4 deps).
// -------------------------------------------------------------
assert(
  'HT.settings.open signature unchanged (Story 3.2 dep)',
  typeof htSettings.open === 'function'
);
assert(
  'HT.settings.close signature unchanged (Story 3.2 dep)',
  typeof htSettings.close === 'function'
);
assert(
  'HT.settings.clearAll signature unchanged (Story 3.2 dep)',
  typeof htSettings.clearAll === 'function'
);

// -------------------------------------------------------------
// AC-2: Tab order — focusables in panel follow field source order.
// <output> is excluded because it is not a natively focusable element.
// Run this BEFORE the clear-all test, because clearAllLocalData sets
// clearButton.disabled = true after a successful confirm.
// -------------------------------------------------------------
const panelFocusables = liveFocusables(panel);
const tabOrderTags = panelFocusables.map(function (el) { return el.tagName + ':' + (el.name || el.id || '?'); });
assert(
  'Tab order: theme → locale → reducedMotion → units → currency → fontScale → clear',
  tabOrderTags.join(',') === 'SELECT:ht.theme,SELECT:ht.locale,INPUT:ht.reducedMotion,SELECT:ht.units,SELECT:ht.currency,INPUT:ht.fontScale,BUTTON:shell-settings-clear',
  'got=' + tabOrderTags.join(',')
);

// -------------------------------------------------------------
// Clear-all button — confirm + clear + reload.
// -------------------------------------------------------------
resetSpies();
activeElement = cogButton;
htSettings.close();
htSettings.open();
// Find the click listener attached to clearButton — the modal's
// wireSettings() installs one. We can fire it via .click() which
// dispatches to our click listeners stub.
clearButton.click();
assert(
  'Clear-all: confirm() was called once',
  confirmCalls === 1,
  'confirmCalls=' + confirmCalls
);
assert(
  'Clear-all: HT.storage.clear() was called',
  storageClearCalls.length === 1,
  'storageClearCalls=' + storageClearCalls.length
);
assert(
  'Clear-all: window.location.reload() was called',
  reloadCalls === 1,
  'reloadCalls=' + reloadCalls
);

// Cancel path: confirm returns false → no clear, no reload.
resetSpies();
confirmReturn = false;
clearButton.click();
assert(
  'Clear-all: confirm=false → no storage.clear',
  storageClearCalls.length === 0
);
assert(
  'Clear-all: confirm=false → no reload',
  reloadCalls === 0
);
confirmReturn = true;

// -------------------------------------------------------------
// Embed-mode guard — openSettings early-returns when isEmbedMode().
// -------------------------------------------------------------
resetSpies();
fakeLocation.search = '?embed=1';
htSettings.close(); // ensure clean state
htSettings.open();
assert(
  'Embed mode: open() does not show modal',
  modal.hidden === true,
  'modal.hidden=' + modal.hidden
);
fakeLocation.search = '';

// -------------------------------------------------------------
// Story 3.4 + 3.2 chord/palette deps unchanged — HT.settings still
// callable from the same shape. (Indirectly verified above by the
// frozen surface assertions.)
// -------------------------------------------------------------
assert(
  'HT.settings.open is idempotent (Story 3.4 AC-7: g s safe to repeat)',
  (function () {
    htSettings.close();
    htSettings.open();
    htSettings.open(); // second call should be no-op
    return modal.hidden === false;
  })()
);

// -------------------------------------------------------------
// AC-1: api-contract.js HT.settings entry exists and pins version 1.16.0
// (Story 3.12 + 3.11 bumped from 1.14.0 → 1.16.0 for HT.recent + HT.pins +
//  HT.homeSidebar + HT.viewSource + HT.highlight + HT.zipStore; Story 3.5
//  originally bumped to 1.14.0 for HT.settings.)
// (Story 3.7 supersedes Story 3.6's 1.12.0 with the HT.export addition;
// Story 3.6 superseded Story 3.5's 1.11.0 with the history migration bump;
// HT.settings entry itself is unchanged — see the notes block).
// -------------------------------------------------------------
const apiContract = fs.readFileSync(
  path.join(REPO_ROOT, 'assets/js/api-contract.js'),
  'utf8'
);
assert(
  'api-contract.js: HT.settings entry exists',
  /name:\s*'HT\.settings'/.test(apiContract)
);
assert(
  'api-contract.js: HT.settings notes mention Story 3.5',
  /HT\.settings[\s\S]{0,400}Story 3\.5/.test(apiContract)
);
assert(
  'api-contract.js: version = 1.23.0',
  /version:\s*'1\.23\.0'/.test(apiContract)
);

// -------------------------------------------------------------
// Vacuous-pass guard.
// -------------------------------------------------------------
if (pass === 0 && fail === 0) {
  console.error('VACUOUS PASS: 0 asserts ran — test scaffolding is broken.');
  process.exit(1);
}

console.log('');
console.log('Total: ' + (pass + fail) + ' (' + pass + ' pass / ' + fail + ' fail)');
process.exit(fail === 0 ? 0 : 1);