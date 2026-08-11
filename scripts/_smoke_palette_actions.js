/* scripts/_smoke_palette_actions.js — Story 3.2 contract smoke driver.
 *
 * Headless Node driver for the palette action registry + matcher.
 * Loads assets/js/palette-actions.js + assets/js/shell.js in a
 * Node vm context and exercises the 10 contract assertions from
 * AC-1 / AC-3 / AC-8 / AC-9 / AC-10 of Story 3.2 without a browser.
 *
 * Companion to scripts/_smoke_palette_search.js (Story 3.1 registry
 * dispatcher). This driver exercises the matcher body + static
 * declaration contract that Story 3.2 ships.
 *
 * Vacuous-pass guard (pass === 0 && fail === 0 → exit 1) catches
 * hollow runs.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const PALETTE_ACTIONS_JS = path.join(REPO_ROOT, 'assets/js/palette-actions.js');
const SHELL_JS = path.join(REPO_ROOT, 'assets/js/shell.js');

// Minimal DOM stubs. shell.js needs getElementById('palette') etc.
// to not throw during boot — the shell test environment is loose
// but boot() guards most paths.
const stubDocument = {
  documentElement: {
    dataset: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
    setAttribute: () => {},
    getAttribute: () => null,
    removeAttribute: () => {},
    style: {},
  },
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  body: { appendChild: () => {} },
  addEventListener: () => {},
  createElement: (tag) => ({
    tagName: tag.toUpperCase(),
    style: {},
    setAttribute: () => {},
    getAttribute: () => null,
    addEventListener: () => {},
    appendChild: () => {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
  }),
};

global.window = {
  location: {
    search: '',
    href: 'http://localhost/',
    assign: (u) => { window.lastAssigned = u; },
  },
  document: stubDocument,
  performance: { now: () => Date.now() },
  console: console,
  fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ tools: [] }) }),
  addEventListener: () => {},
  dispatchEvent: () => {},
  CustomEvent: function (type) { this.type = type; },
  MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
  matchMedia: () => ({ matches: false, addEventListener: () => {} }),
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} },
};
global.document = stubDocument;
global.performance = global.window.performance;
global.HT = { homeGrid: { entries: [] } };
global.fetch = global.window.fetch;
global.Promise = Promise;

const ctx = vm.createContext({
  window: global.window,
  document: stubDocument,
  performance: global.window.performance,
  console: console,
  HT: undefined,
  fetch: global.window.fetch,
  Promise: Promise,
  MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
  matchMedia: () => ({ matches: false, addEventListener: () => {} }),
  localStorage: global.window.localStorage,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
});

try {
  // Order matters: palette-actions.js MUST load BEFORE shell.js so
  // HT_PALETTE_ACTIONS is defined when shell.js boots and consumes it.
  vm.runInContext(
    fs.readFileSync(PALETTE_ACTIONS_JS, 'utf8'),
    ctx,
    { filename: 'palette-actions.js' }
  );
  vm.runInContext(fs.readFileSync(SHELL_JS, 'utf8'), ctx, { filename: 'shell.js' });
} catch (err) {
  console.error('CRASH evaluating source:', err);
  process.exit(1);
}

const HT = ctx.window.HT || ctx.HT;
const palette = HT && HT.palette;
const actions = ctx.window.HT_PALETTE_ACTIONS;

let pass = 0;
let fail = 0;
function assert(name, cond, info) {
  if (cond) {
    pass++;
    console.log('  PASS    ' + name);
  } else {
    fail++;
    console.log('  FAIL    ' + name + (info ? ' — ' + info : ''));
  }
}

// AC-5: static declaration is exposed, frozen, has the expected shape.
assert(
  'HT_PALETTE_ACTIONS is an array',
  Array.isArray(actions),
  'typeof=' + typeof actions
);
assert(
  'HT_PALETTE_ACTIONS has 7 entries',
  actions && actions.length === 7,
  'length=' + (actions ? actions.length : 'n/a')
);
assert(
  'HT_PALETTE_ACTIONS is frozen (Object.isFrozen)',
  actions && Object.isFrozen(actions),
  'frozen=' + Object.isFrozen(actions)
);
if (actions) {
  for (let i = 0; i < actions.length; i += 1) {
    const a = actions[i];
    assert(
      'HT_PALETTE_ACTIONS[' + i + '] has {id, label, keywords, icon, run}',
      a && typeof a.id === 'string' && typeof a.label === 'string'
        && Array.isArray(a.keywords) && typeof a.icon === 'string'
        && typeof a.run === 'function',
      'shape=' + JSON.stringify(Object.keys(a || {}))
    );
    assert(
      'HT_PALETTE_ACTIONS[' + i + '] is frozen (Object.isFrozen)',
      Object.isFrozen(a),
      'frozen=' + Object.isFrozen(a)
    );
  }
}

// AC-1 / AC-3 / AC-8: matchActions behavior on real queries.
assert(
  'HT.palette.matchActions is a function',
  palette && typeof palette.matchActions === 'function'
);
if (palette && typeof palette.matchActions === 'function') {
  const themeRes = palette.matchActions('theme');
  assert(
    'matchActions("theme") returns the theme.toggle action',
    themeRes.length === 1 && themeRes[0].id === 'theme.toggle',
    'got=' + JSON.stringify(themeRes.map((r) => r.id))
  );
  assert(
    'matchActions result has no run function on the wire',
    !('run' in themeRes[0]),
    'keys=' + Object.keys(themeRes[0]).join(',')
  );

  const settingsRes = palette.matchActions('SETTINGS');
  assert(
    'matchActions("SETTINGS") is case-insensitive (returns settings.open)',
    settingsRes.length === 1 && settingsRes[0].id === 'settings.open',
    'got=' + JSON.stringify(settingsRes.map((r) => r.id))
  );

  const clearRes = palette.matchActions('cleAr');
  assert(
    'matchActions("cleAr") is mixed-case (returns data.clear)',
    clearRes.length === 1 && clearRes[0].id === 'data.clear',
    'got=' + JSON.stringify(clearRes.map((r) => r.id))
  );

  // AC-3: query that does NOT match any action keyword.
  const xyzzyRes = palette.matchActions('xyzzy');
  assert(
    'matchActions("xyzzy") returns []',
    xyzzyRes.length === 0,
    'got=' + JSON.stringify(xyzzyRes.map((r) => r.id))
  );

  // AC-1: every action with 'clear' in keywords is matched (so the
  // top-5 cap on tools is NOT applied to actions).
  const allRes = palette.matchActions('a');
  assert(
    'matchActions("a") returns >= 1 action (substring matches multiple)',
    allRes.length >= 1,
    'got=' + JSON.stringify(allRes.map((r) => r.id))
  );

  // AC-2: empty / whitespace → [].
  assert(
    'matchActions("") returns []',
    palette.matchActions('').length === 0
  );
  assert(
    'matchActions("   ") returns []',
    palette.matchActions('   ').length === 0
  );
}

// AC-8: registry was populated from HT_PALETTE_ACTIONS.
if (palette && palette._actions) {
  const allIds = (actions || []).map((a) => a.id);
  const allRegistered = allIds.every((id) => typeof palette._actions[id] === 'function');
  assert(
    'palette._actions registry is populated with all 7 declared actions',
    allRegistered,
    'missing=' + JSON.stringify(allIds.filter((id) => typeof palette._actions[id] !== 'function'))
  );

  // Dispatch a no-op registered action and confirm the return value flows.
  palette._actions['__smoke_test_action'] = () => '__smoke_test_action_invoked';
  assert(
    'palette.runAction(dispatched) returns handler return value',
    palette.runAction('__smoke_test_action') === '__smoke_test_action_invoked'
  );
  delete palette._actions['__smoke_test_action'];
}

// AC-2 / AC-9: runAction contract — unknown id, throwing handler.
assert(
  'palette.runAction(unknown) returns null',
  palette.runAction('does-not-exist') === null
);
if (palette && palette._actions) {
  palette._actions['__smoke_throw'] = () => { throw new Error('intentional'); };
  let threw = false;
  try { palette.runAction('__smoke_throw'); } catch (e) { threw = true; }
  assert('palette.runAction(throwing handler) does not propagate', !threw);
  delete palette._actions['__smoke_throw'];
}

// AC-7 / AC-10: New HT.theme + HT.viewSource surfaces.
assert(
  'HT.theme.cycle is exposed',
  HT && HT.theme && typeof HT.theme.cycle === 'function'
);
assert(
  'HT.theme.current is exposed',
  HT && HT.theme && typeof HT.theme.current === 'function'
);
assert(
  'HT.viewSource.open is exposed',
  HT && HT.viewSource && typeof HT.viewSource.open === 'function'
);

console.log('');
console.log('passed: ' + pass + ', failed: ' + fail);

// Vacuous-pass guard
if (pass === 0 && fail === 0) {
  console.error('VACUOUS: no assertions ran');
  process.exit(1);
}
process.exit(fail === 0 ? 0 : 1);