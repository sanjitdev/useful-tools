/* scripts/_smoke_global_chords.js — Story 3.4 contract smoke driver.
 *
 * Headless Node driver for the global chord handler (`assets/js/global-chords.js`).
 * Loads the module in a Node vm context against a minimal DOM stub and
 * exercises the AC-1 through AC-9 contract assertions of Story 3.4
 * without a browser:
 *
 *   AC-1 chord dispatch (`g h` / `g p` / `g q` / `g v` / `g s`)
 *   AC-2 1-second timeout cancellation
 *   AC-3 text-input focus suppression
 *   AC-4 embed-mode guard
 *   AC-5 unmapped second key silent cancel
 *   AC-6 dialog-focus suppression
 *   AC-7 `g s` idempotency (HT.settings.open is idempotent)
 *   AC-8 modifier guard (Ctrl/Meta/Alt on either key)
 *   AC-9 help overlay unaffected (covered indirectly — we don't load
 *        help-overlay.js; we only assert that loading global-chords.js
 *        doesn't mutate the public HT surface or fail in its absence)
 *
 * Companion to scripts/_smoke_help_overlay.js (Story 3.3) and
 * scripts/_smoke_palette_actions.js (Story 3.2). Uses the same vm
 * + DOM-stub pattern.
 *
 * Vacuous-pass guard (pass === 0 && fail === 0 → exit 1) catches
 * hollow runs.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const GLOBAL_CHORDS_JS = path.join(REPO_ROOT, 'assets/js/global-chords.js');

// -------------------------------------------------------------
// Test fixture — DOM stubs the chord module touches:
//   document (capture-phase keydown listener)
//   document.activeElement
//   window.location.assign (chord dispatch target)
//   window.HT (settings.open target — must be observable)
//   performance.now (arm-then-fire timestamp)
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
    open: false, // for <dialog> open state
    setAttribute: function (name, value) {
      this._attrs[name] = String(value);
      if (name === 'hidden') this.hidden = true;
      if (name === 'open') this.open = true;
    },
    getAttribute: function (name) {
      return this._attrs[name] != null ? this._attrs[name] : null;
    },
    appendChild: function (child) {
      child.parentNode = this;
      this.children.push(child);
      this.childNodes.push(child);
      return child;
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
  };
  return el;
}

let activeElement = null;

function makeInput(type) {
  const el = makeEl(type || 'input');
  el.value = '';
  el.type = type || 'text';
  el.tagName = 'INPUT';
  Object.defineProperty(el, 'isContentEditable', { get: function () { return false; } });
  return el;
}

// Body — anchor for `body.focus()` fallback (focus restoration goes to body when
// activeElement is null).
const body = makeEl('body');
activeElement = body; // default: focus on body

// DOM stubs
const docListeners = [];

const stubDocument = {
  documentElement: makeEl('html'),
  body: body,
  get activeElement() { return activeElement; },
  set activeElement(v) { activeElement = v; },
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
    // Run registered listeners in registration order. global-chords.js
    // attaches the keydown listener with capture=true (matches help-overlay
    // pattern); we don't differentiate capture here because the module
    // installs only one keydown listener.
    for (let i = 0; i < docListeners.length; i += 1) {
      if (docListeners[i].type === event.type) {
        try { docListeners[i].fn(event); } catch (_) { /* defensive */ }
      }
    }
    return true;
  },
};

// Spy on location.assign — chord handlers route through this for navigation.
let assignedUrls = [];
const fakeLocation = {
  search: '',
  pathname: '/tools/age-calculator/',
  href: 'http://localhost/tools/age-calculator/',
  assign: function (url) {
    assignedUrls.push(url);
    fakeLocation.href = url;
    fakeLocation.pathname = url.split('?')[0].split('#')[0];
  },
};

// Spy on HT.settings.open — chord `g s` routes here.
let settingsOpenCalls = 0;
const fakeHtSettings = {
  open: function () { settingsOpenCalls += 1; },
};

// Spy on localStorage — chord handlers must never touch storage (AC: no
// localStorage writes; chord layer is purely procedural). Records all
// get/set/remove calls so a regression that adds any storage interaction
// surfaces here instead of silently passing the smoke.
let localStorageCalls = [];
const fakeLocalStorage = {
  getItem: function (k) { localStorageCalls.push({ op: 'get', k: k }); return null; },
  setItem: function (k, v) { localStorageCalls.push({ op: 'set', k: k, v: v }); },
  removeItem: function (k) { localStorageCalls.push({ op: 'remove', k: k }); },
  clear: function () { localStorageCalls.push({ op: 'clear' }); },
  key: function () { return null; },
  length: 0,
};

const stubWindow = {
  location: fakeLocation,
  localStorage: fakeLocalStorage,
  navigator: { platform: 'Win32', userAgent: 'Mozilla/5.0 (Windows)' },
  document: stubDocument,
  addEventListener: function () {},
  removeEventListener: function () {},
  dispatchEvent: function () { return true; },
  CustomEvent: function (type) { this.type = type; },
  HT: { settings: fakeHtSettings },
};

// Monotonic fake clock — tests can advance time deterministically.
let fakeNow = 0;
function advanceTime(ms) { fakeNow += ms; }

const stubPerformance = {
  now: function () { return fakeNow; },
};

const stubSetTimeout = function (fn, ms) {
  // For arm-timer: schedule fn but expose the id so the harness can
  // advance the clock and then trigger the timeout manually.
  // Tests use `advanceTime(ms)` + manual invocation via global clock
  // rather than relying on real timers.
  pendingTimeouts.push({ fn: fn, ms: ms });
  return pendingTimeouts.length;
};
const stubClearTimeout = function (id) {
  if (id) pendingTimeouts[id - 1] = null;
};
const pendingTimeouts = [];

global.window = stubWindow;
global.document = stubDocument;
// Node 22's `global.navigator` is a read-only getter — skip the global
// assignment. The vm context provides navigator directly to the loaded
// script; global-chords.js reads it via window.navigator.platform.
global.performance = stubPerformance;
global.HT = stubWindow.HT;
global.setTimeout = stubSetTimeout;
global.clearTimeout = stubClearTimeout;
global.Promise = Promise;
global.fetch = function () { return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ tools: [] }); } }); };

const ctx = vm.createContext({
  window: stubWindow,
  document: stubDocument,
  navigator: stubWindow.navigator,
  performance: stubPerformance,
  console: console,
  HT: stubWindow.HT,
  localStorage: fakeLocalStorage,
  setTimeout: stubSetTimeout,
  clearTimeout: stubClearTimeout,
  fetch: global.fetch,
  Promise: Promise,
});

try {
  vm.runInContext(
    fs.readFileSync(GLOBAL_CHORDS_JS, 'utf8'),
    ctx,
    { filename: 'global-chords.js', timeout: 5000 }
  );
} catch (err) {
  console.error('CRASH evaluating global-chords.js:', err);
  process.exit(1);
}

// -------------------------------------------------------------
// Test helpers
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

// Dispatch a synthetic keydown event via the stub's dispatchEvent.
function pressKey(key, opts) {
  opts = opts || {};
  const event = {
    type: 'keydown',
    key: key,
    ctrlKey: !!opts.ctrlKey,
    metaKey: !!opts.metaKey,
    altKey: !!opts.altKey,
    shiftKey: !!opts.shiftKey,
    preventDefault: function () { event._prevented = true; },
    target: opts.target || activeElement,
  };
  stubDocument.dispatchEvent(event);
  return event;
}

// Run any pending arm-timer timeouts. Tests call this after
// advanceTime() to simulate the 1-second timeout firing.
function runPendingTimeouts() {
  for (let i = 0; i < pendingTimeouts.length; i += 1) {
    const t = pendingTimeouts[i];
    if (t) t.fn();
  }
  pendingTimeouts.length = 0;
}

// Reset all spies between tests.
function resetSpies() {
  assignedUrls = [];
  settingsOpenCalls = 0;
  localStorageCalls = [];
  fakeNow = 0;
  pendingTimeouts.length = 0;
  activeElement = body;
  fakeLocation.search = '';
  fakeLocation.pathname = '/tools/age-calculator/';
  fakeLocation.href = 'http://localhost/tools/age-calculator/';
}

const handle = ctx.window.HT_GLOBAL_CHORDS_INIT;
const keydownListener = docListeners.find(function (l) { return l.type === 'keydown'; });

// -------------------------------------------------------------
// AC: chord module is purely procedural — must not touch localStorage
// at load time. Checked here BEFORE any resetSpies() / pressKey()
// below so the spy captures the module's load-time behavior. The
// rest of the test suite resets the spy between cases (as for
// location.assign), so load-time is a one-shot — must be guarded
// immediately. A regression that adds any storage write at boot
// fails this assert.
assert(
  'No localStorage interactions during module load (chord module is purely procedural)',
  localStorageCalls.length === 0,
  'load-time calls=' + JSON.stringify(localStorageCalls)
);

// -------------------------------------------------------------
// AC: Module exposes HT_GLOBAL_CHORDS_INIT as a frozen object.
// -------------------------------------------------------------
assert(
  'window.HT_GLOBAL_CHORDS_INIT is exposed',
  handle && typeof handle === 'object'
);
assert(
  'HT_GLOBAL_CHORDS_INIT is frozen (Object.isFrozen)',
  handle && Object.isFrozen(handle),
  'frozen=' + Object.isFrozen(handle)
);
assert(
  'HT_GLOBAL_CHORDS_INIT.version is a non-empty string',
  handle && typeof handle.version === 'string' && handle.version.length > 0,
  'version=' + (handle && handle.version)
);
assert(
  'HT_GLOBAL_CHORDS_INIT has chords array',
  handle && Array.isArray(handle.chords),
  'typeof=' + (handle && typeof handle.chords)
);
assert(
  'HT_GLOBAL_CHORDS_INIT has cancel function',
  handle && typeof handle.cancel === 'function'
);
assert(
  'HT_GLOBAL_CHORDS_INIT.chords length === 5',
  handle && handle.chords.length === 5,
  'length=' + (handle && handle.chords.length)
);
assert(
  'Chord 0 is g h -> Go to home',
  handle && handle.chords[0] && handle.chords[0].keys[0] === 'g' && handle.chords[0].keys[1] === 'h',
  'got=' + JSON.stringify(handle && handle.chords[0])
);
assert(
  'Chord 1 is g p -> Go to packs',
  handle && handle.chords[1] && handle.chords[1].keys[0] === 'g' && handle.chords[1].keys[1] === 'p'
);
assert(
  'Chord 2 is g q -> Go to quality',
  handle && handle.chords[2] && handle.chords[2].keys[0] === 'g' && handle.chords[2].keys[1] === 'q'
);
assert(
  'Chord 3 is g v -> Go to privacy',
  handle && handle.chords[3] && handle.chords[3].keys[0] === 'g' && handle.chords[3].keys[1] === 'v'
);
assert(
  'Chord 4 is g s -> Open settings',
  handle && handle.chords[4] && handle.chords[4].keys[0] === 'g' && handle.chords[4].keys[1] === 's'
);

// -------------------------------------------------------------
// AC: No public HT.* surface added (only HT_GLOBAL_CHORDS_INIT on window).
// -------------------------------------------------------------
const htKeysBefore = Object.keys(ctx.window.HT).sort();
assert(
  'Loading module does not add new HT.* surface',
  htKeysBefore.length === 1 && htKeysBefore[0] === 'settings',
  'HT keys=' + JSON.stringify(htKeysBefore)
);

// -------------------------------------------------------------
// AC: A document-level keydown listener was installed.
// -------------------------------------------------------------
assert(
  'Document keydown listener is installed',
  docListeners.length === 1 && keydownListener && keydownListener.type === 'keydown'
);

// -------------------------------------------------------------
// AC-1: Chord dispatch — `g h` triggers navigation.
// -------------------------------------------------------------
resetSpies();
pressKey('g');
pressKey('h');
assert(
  'AC-1: g h navigates to /index.html',
  assignedUrls.indexOf('/index.html') !== -1,
  'assigned=' + JSON.stringify(assignedUrls)
);

// -------------------------------------------------------------
// AC-1: `g q` triggers quality navigation.
// -------------------------------------------------------------
resetSpies();
pressKey('g');
pressKey('q');
assert(
  'AC-1: g q navigates to /quality.html',
  assignedUrls.indexOf('/quality.html') !== -1,
  'assigned=' + JSON.stringify(assignedUrls)
);

// -------------------------------------------------------------
// AC-1: `g v` triggers privacy navigation.
// -------------------------------------------------------------
resetSpies();
pressKey('g');
pressKey('v');
assert(
  'AC-1: g v navigates to /privacy',
  assignedUrls.indexOf('/privacy') !== -1,
  'assigned=' + JSON.stringify(assignedUrls)
);

// -------------------------------------------------------------
// AC-1: `g p` triggers packs navigation (home with #packs anchor).
// -------------------------------------------------------------
resetSpies();
pressKey('g');
pressKey('p');
assert(
  'AC-1: g p navigates to /index.html#packs',
  assignedUrls.indexOf('/index.html#packs') !== -1,
  'assigned=' + JSON.stringify(assignedUrls)
);

// -------------------------------------------------------------
// AC-1: `g s` calls HT.settings.open (NOT navigation).
// -------------------------------------------------------------
resetSpies();
pressKey('g');
pressKey('s');
assert(
  'AC-1: g s calls HT.settings.open',
  settingsOpenCalls === 1,
  'settingsOpenCalls=' + settingsOpenCalls
);
assert(
  'AC-1: g s does NOT navigate',
  assignedUrls.length === 0,
  'assigned=' + JSON.stringify(assignedUrls)
);

// -------------------------------------------------------------
// AC-2: 1-second timeout cancels chord.
// -------------------------------------------------------------
resetSpies();
pressKey('g');
advanceTime(1500);
runPendingTimeouts(); // simulate timer firing
pressKey('h');
assert(
  'AC-2: chord canceled after 1-second timeout',
  assignedUrls.length === 0,
  'assigned=' + JSON.stringify(assignedUrls)
);

// -------------------------------------------------------------
// AC-3: Text-input focus suppresses chord.
// -------------------------------------------------------------
resetSpies();
const inputEl = makeInput('text');
activeElement = inputEl;
pressKey('g');
pressKey('h');
assert(
  'AC-3: g h inside text input does NOT navigate',
  assignedUrls.length === 0,
  'assigned=' + JSON.stringify(assignedUrls)
);
activeElement = body; // restore

// -------------------------------------------------------------
// AC-3: contentEditable focus suppresses chord.
// -------------------------------------------------------------
resetSpies();
const ceEl = makeEl('div');
Object.defineProperty(ceEl, 'isContentEditable', { get: function () { return true; } });
activeElement = ceEl;
pressKey('g');
pressKey('h');
assert(
  'AC-3: g h inside contenteditable does NOT navigate',
  assignedUrls.length === 0,
  'assigned=' + JSON.stringify(assignedUrls)
);
activeElement = body;

// -------------------------------------------------------------
// AC-4: Embed-mode (URL has ?embed=1) suppresses chord.
// -------------------------------------------------------------
resetSpies();
fakeLocation.search = '?embed=1';
pressKey('g');
pressKey('h');
assert(
  'AC-4: g h in embed mode does NOT navigate',
  assignedUrls.length === 0,
  'assigned=' + JSON.stringify(assignedUrls)
);
fakeLocation.search = ''; // restore

// -------------------------------------------------------------
// AC-5: Unknown second key cancels silently.
// -------------------------------------------------------------
resetSpies();
pressKey('g');
pressKey('x');
assert(
  'AC-5: unmapped second key does NOT navigate',
  assignedUrls.length === 0,
  'assigned=' + JSON.stringify(assignedUrls)
);

// -------------------------------------------------------------
// AC-6: Focus inside an open <dialog> suppresses chord.
// -------------------------------------------------------------
resetSpies();
const dialog = makeEl('dialog');
dialog.open = true;
dialog._attrs.open = '';
const dialogContent = makeEl('div');
dialog.appendChild(dialogContent);
activeElement = dialogContent;
pressKey('g');
pressKey('h');
assert(
  'AC-6: g h inside open dialog does NOT navigate',
  assignedUrls.length === 0,
  'assigned=' + JSON.stringify(assignedUrls)
);
activeElement = body;

// -------------------------------------------------------------
// AC-8: Ctrl modifier on first key suppresses arming.
// -------------------------------------------------------------
resetSpies();
pressKey('g', { ctrlKey: true });
pressKey('h');
assert(
  'AC-8: Ctrl+g does NOT arm the chord',
  assignedUrls.length === 0,
  'assigned=' + JSON.stringify(assignedUrls)
);

// -------------------------------------------------------------
// AC-8: Meta modifier on first key suppresses arming.
// -------------------------------------------------------------
resetSpies();
pressKey('g', { metaKey: true });
pressKey('h');
assert(
  'AC-8: Meta+g does NOT arm the chord',
  assignedUrls.length === 0,
  'assigned=' + JSON.stringify(assignedUrls)
);

// -------------------------------------------------------------
// AC-8: Alt modifier on first key suppresses arming.
// -------------------------------------------------------------
resetSpies();
pressKey('g', { altKey: true });
pressKey('h');
assert(
  'AC-8: Alt+g does NOT arm the chord',
  assignedUrls.length === 0,
  'assigned=' + JSON.stringify(assignedUrls)
);

// -------------------------------------------------------------
// AC-8: Ctrl modifier on second key does NOT fire chord.
// -------------------------------------------------------------
resetSpies();
pressKey('g');
pressKey('h', { ctrlKey: true });
assert(
  'AC-8: Ctrl+h does NOT fire (armed state consumed)',
  assignedUrls.length === 0,
  'assigned=' + JSON.stringify(assignedUrls)
);

// -------------------------------------------------------------
// AC-? Esc while armed cancels the chord.
// -------------------------------------------------------------
resetSpies();
pressKey('g');
pressKey('Escape');
// A subsequent h should NOT navigate (state cleared).
pressKey('h');
assert(
  'Esc while armed clears chord; subsequent h does NOT navigate',
  assignedUrls.length === 0,
  'assigned=' + JSON.stringify(assignedUrls)
);

// -------------------------------------------------------------
// AC-? Case-insensitivity: G H fires the chord.
// -------------------------------------------------------------
resetSpies();
pressKey('g'); // lowercase arm (we just need to confirm the listener accepts lowercase too)
advanceTime(50);
pressKey('G'); // capital G re-arms (resets timer)
advanceTime(50);
pressKey('H'); // capital H fires the chord
assert(
  'AC-?: G H (uppercase) fires the chord',
  assignedUrls.indexOf('/index.html') !== -1,
  'assigned=' + JSON.stringify(assignedUrls)
);

// -------------------------------------------------------------
// AC-? `?` does NOT arm the chord (help overlay owns it).
// -------------------------------------------------------------
resetSpies();
pressKey('?');
pressKey('h');
assert(
  '? does NOT arm; subsequent h does NOT navigate',
  assignedUrls.length === 0,
  'assigned=' + JSON.stringify(assignedUrls)
);

// -------------------------------------------------------------
// AC-? `/` does NOT arm the chord (palette owns it).
// -------------------------------------------------------------
resetSpies();
pressKey('/');
pressKey('h');
assert(
  '/ does NOT arm; subsequent h does NOT navigate',
  assignedUrls.length === 0,
  'assigned=' + JSON.stringify(assignedUrls)
);

// -------------------------------------------------------------
// AC-7: g s on a second press does NOT double-fire (HT.settings.open
// is idempotent — but our spy counts calls; the module should fire
// once per chord cycle).
// -------------------------------------------------------------
resetSpies();
pressKey('g');
pressKey('s');
pressKey('g');
pressKey('s');
assert(
  'g s s g s pattern produces exactly 2 settings.open calls',
  settingsOpenCalls === 2,
  'settingsOpenCalls=' + settingsOpenCalls
);

// -------------------------------------------------------------
// AC-? `g h` while pathname is already `/index.html` does NOT navigate.
// (Same-URL early-return per Out-of-Scope item.)
// -------------------------------------------------------------
resetSpies();
fakeLocation.pathname = '/index.html';
pressKey('g');
pressKey('h');
assert(
  'g h while already on /index.html does NOT navigate',
  assignedUrls.length === 0,
  'assigned=' + JSON.stringify(assignedUrls)
);
fakeLocation.pathname = '/tools/age-calculator/'; // restore

// -------------------------------------------------------------
// AC-? Double-press `g g` does NOT double-arm or prematurely fire.
// -------------------------------------------------------------
resetSpies();
pressKey('g');
advanceTime(50);
pressKey('g'); // re-arm (resets timer)
advanceTime(50);
pressKey('h');
assert(
  'g g h sequence fires exactly once',
  assignedUrls.indexOf('/index.html') !== -1 && assignedUrls.length === 1,
  'assigned=' + JSON.stringify(assignedUrls)
);

// -------------------------------------------------------------
// AC-? External cancel() clears armed state.
// -------------------------------------------------------------
resetSpies();
pressKey('g');
handle.cancel();
pressKey('h');
assert(
  'cancel() while armed clears state; subsequent h does NOT navigate',
  assignedUrls.length === 0,
  'assigned=' + JSON.stringify(assignedUrls)
);

// -------------------------------------------------------------
// AC-? No localStorage writes from the chord module.
// -------------------------------------------------------------
// The chord module should never touch localStorage. We install a
// spy (fakeLocalStorage above) and exercise every chord dispatch
// path (g h, g p, g q, g v, g s) plus the unmapped-second-key
// cancel — then assert zero storage interactions were observed.
// A regression that adds any storage write will fail this assert.
resetSpies();
pressKey('g'); pressKey('h'); // navigate /index.html
pressKey('g'); pressKey('p'); // navigate /index.html#packs
pressKey('g'); pressKey('q'); // navigate /quality.html
pressKey('g'); pressKey('v'); // navigate /privacy
pressKey('g'); pressKey('s'); // HT.settings.open
pressKey('g'); pressKey('z'); // unmapped second key (silently cancel)
assert(
  'No localStorage interactions across all 5 chord dispatches + unmapped-cancel',
  localStorageCalls.length === 0,
  'calls=' + JSON.stringify(localStorageCalls)
);

// -------------------------------------------------------------
// AC-? Chord fires preventDefault on matched chord keys.
// -------------------------------------------------------------
resetSpies();
const ev1 = pressKey('g');
assert(
  'preventDefault called on g (chord starter)',
  ev1._prevented === true
);
const ev2 = pressKey('h');
assert(
  'preventDefault called on h (chord completer)',
  ev2._prevented === true
);

// -------------------------------------------------------------
// AC-? Chord does NOT preventDefault on `/` or `?` (owned by other modules).
// -------------------------------------------------------------
resetSpies();
const ev3 = pressKey('/');
assert(
  'preventDefault NOT called on / (palette owns it)',
  ev3._prevented !== true
);
const ev4 = pressKey('?');
assert(
  'preventDefault NOT called on ? (help overlay owns it)',
  ev4._prevented !== true
);

// -------------------------------------------------------------
// Summary
// -------------------------------------------------------------
console.log('');
console.log('  ' + pass + ' passed · ' + fail + ' failed');
if (pass === 0 && fail === 0) {
  console.error('CRITICAL: no assertions ran (vacuous-pass guard)');
  process.exit(1);
}
if (fail > 0) {
  process.exit(1);
}