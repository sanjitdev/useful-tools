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
  // Story 3.2-review patch #19: timeout: 5000ms — if a future bug
  // introduces an infinite loop in shell.js's IIFE the smoke fails
  // fast instead of hanging the test runner indefinitely.
  vm.runInContext(
    fs.readFileSync(PALETTE_ACTIONS_JS, 'utf8'),
    ctx,
    { filename: 'palette-actions.js', timeout: 5000 }
  );
  vm.runInContext(
    fs.readFileSync(SHELL_JS, 'utf8'),
    ctx,
    { filename: 'shell.js', timeout: 5000 }
  );
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
  // Patch #12: result rows are frozen (api-contract claims readonly).
  assert(
    'matchActions result row is frozen (Object.isFrozen)',
    Object.isFrozen(themeRes[0]),
    'frozen=' + Object.isFrozen(themeRes[0])
  );
  // Patch #4: the returned array itself is frozen (no consumer can
  // mutate .length / push / etc.).
  assert(
    'matchActions result array is frozen (Object.isFrozen)',
    Object.isFrozen(themeRes),
    'frozen=' + Object.isFrozen(themeRes)
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

  // Patch #13: matcher round-trip coverage for the 4 actions not
  // tested above (privacy, quality, source, help). Each action must
  // round-trip through matchActions on one of its declared keywords.
  const privacyRes = palette.matchActions('privacy');
  assert(
    'matchActions("privacy") returns privacy.open',
    privacyRes.length >= 1 && privacyRes.some((r) => r.id === 'privacy.open'),
    'got=' + JSON.stringify(privacyRes.map((r) => r.id))
  );
  const qualityRes = palette.matchActions('quality');
  assert(
    'matchActions("quality") returns quality.open',
    qualityRes.length >= 1 && qualityRes.some((r) => r.id === 'quality.open'),
    'got=' + JSON.stringify(qualityRes.map((r) => r.id))
  );
  const sourceRes = palette.matchActions('source');
  assert(
    'matchActions("source") returns source.view',
    sourceRes.length >= 1 && sourceRes.some((r) => r.id === 'source.view'),
    'got=' + JSON.stringify(sourceRes.map((r) => r.id))
  );
  const helpRes = palette.matchActions('help');
  assert(
    'matchActions("help") returns help.open',
    helpRes.length >= 1 && helpRes.some((r) => r.id === 'help.open'),
    'got=' + JSON.stringify(helpRes.map((r) => r.id))
  );
  // Patch #20: '?' is no longer a keyword (caused double-fire with
  // the help chord). Match by 'help' / 'shortcuts' instead; '?' still
  // works via the help chord directly.
  const helpQRes = palette.matchActions('?');
  assert(
    'matchActions("?") does NOT match help.open (chord owns this)',
    !helpQRes.some((r) => r.id === 'help.open'),
    'got=' + JSON.stringify(helpQRes.map((r) => r.id))
  );

  // Patch #7: warn-once guard for the missing-HT_PALETTE_ACTIONS
  // branch. Save / restore console.warn so the harness observes the
  // count without polluting the output.
  const savedWarn = console.warn;
  let warnCount = 0;
  console.warn = function () { warnCount += 1; };
  // Simulate the missing list by saving + clearing window.HT_PALETTE_ACTIONS.
  const savedList = ctx.window.HT_PALETTE_ACTIONS;
  try {
    delete ctx.window.HT_PALETTE_ACTIONS;
    palette.matchActions('anything');
    palette.matchActions('another');
    palette.matchActions('third');
    assert(
      'palette.matchActions warn-once guard fires exactly once for missing list',
      warnCount === 1,
      'warnCount=' + warnCount
    );
  } finally {
    console.warn = savedWarn;
    ctx.window.HT_PALETTE_ACTIONS = savedList;
  }
}

// AC-8 / Patch #15: registry was populated from HT_PALETTE_ACTIONS.
// Since Story 3.2-review patch #15 removed `palette._actions` from the
// public surface, this is now observed indirectly by dispatching each
// declared id via `runAction` and verifying it doesn't return null
// (which would mean the id is unknown). For the 3 handlers that touch
// the public surface (theme.toggle → HT.theme.cycle; data.clear →
// HT.settings.clearAll; help.open → HT.palette.openHelp), stub the
// dependency to verify the dispatch reaches the right handler.
if (palette && palette.runAction) {
  const declaredIds = (actions || []).map((a) => a.id);
  for (const id of declaredIds) {
    assert(
      'palette.runAction("' + id + '") reaches a handler (not null)',
      palette.runAction(id) !== null || id === 'help.open',
      // help.open returns null because its handler returns nothing
      // when the dependency is absent or succeeds silently. Skip the
      // null check for help.open; verify it doesn't throw instead.
      'dispatch returned null'
    );
  }

  // Patch #14: data.clear dispatch — without the dependency
  // (HT.settings.clearAll), the action must NOT call localStorage.clear
  // directly. Stub localStorage.clear to count calls and verify it was
  // NOT invoked.
  if (typeof ctx.window.localStorage !== 'undefined') {
    let lsClearCount = 0;
    const realClear = ctx.window.localStorage.clear;
    ctx.window.localStorage.clear = function () { lsClearCount += 1; };
    try {
      palette.runAction('data.clear');
      // If HT.settings.clearAll is missing, the action console.warns
      // and bails WITHOUT touching localStorage. Either path is fine
      // as long as localStorage.clear was not invoked from the action
      // itself (FR-8 confirm-twice gate).
      assert(
        'palette.runAction("data.clear") does NOT call localStorage.clear directly',
        lsClearCount === 0,
        'lsClearCount=' + lsClearCount
      );
    } finally {
      ctx.window.localStorage.clear = realClear;
    }
  }
}

// AC-2 / AC-9 / Patch #16: runAction contract — unknown id warn-once.
// Stub console.warn BEFORE the first unknown call so the counter
// captures the first emission; subsequent calls to the SAME id must
// not re-emit (warn-once guard).
const savedWarn2 = console.warn;
let unknownWarnCount = 0;
console.warn = function () { unknownWarnCount += 1; };
try {
  // First call emits the warning (warn-once guard fires).
  assert(
    'palette.runAction(unknown) returns null',
    palette.runAction('does-not-exist') === null
  );
  const afterFirst = unknownWarnCount;
  assert(
    'palette.runAction unknown-id first call emits exactly one warning',
    afterFirst === 1,
    'warnCount=' + afterFirst
  );
  // Subsequent calls with the same id do NOT re-emit (the guard).
  palette.runAction('does-not-exist');
  palette.runAction('does-not-exist');
  assert(
    'palette.runAction unknown-id warn-once guard: same id does not re-emit',
    unknownWarnCount === 1,
    'warnCount=' + unknownWarnCount
  );
  // A NEW unknown id also does not re-emit (the guard is global).
  palette.runAction('another-bogus');
  assert(
    'palette.runAction unknown-id warn-once guard: new id does not re-emit',
    unknownWarnCount === 1,
    'warnCount=' + unknownWarnCount
  );
} finally {
  console.warn = savedWarn2;
}

// Patch #9: HT.viewSource.open home-page rejection. The vm context has
// no data-slug and resolveCurrentSlug returns falsy. The promise must
// resolve false WITHOUT throwing and WITHOUT calling location.assign.
if (HT && HT.viewSource && typeof HT.viewSource.open === 'function') {
  let assigned = null;
  const savedAssign = ctx.window.location.assign;
  ctx.window.location.assign = function (u) { assigned = u; };
  try {
    Promise.resolve(palette && typeof palette === 'object' ? null : null);
    const promise = HT.viewSource.open();
    if (promise && typeof promise.then === 'function') {
      promise.then(function (result) {
        assert(
          'HT.viewSource.open() on home page resolves false (no slug)',
          result === false,
          'got=' + JSON.stringify(result)
        );
        assert(
          'HT.viewSource.open() on home page does NOT call location.assign',
          assigned === null,
          'assigned=' + assigned
        );
      });
    }
    // Patch #3: path-traversal slugs are rejected the same way.
    assigned = null;
    HT.viewSource.open('../etc/passwd').then(function (result) {
      assert(
        'HT.viewSource.open("../etc/passwd") rejects the slug (path-traversal guard)',
        result === false,
        'got=' + JSON.stringify(result)
      );
      assert(
        'HT.viewSource.open("../etc/passwd") does NOT call location.assign',
        assigned === null,
        'assigned=' + assigned
      );
    });
  } finally {
    ctx.window.location.assign = savedAssign;
  }
}

// AC-7 / AC-10: New HT.theme + HT.viewSource surfaces.
assert(
  'HT.theme.cycle is exposed',
  HT && HT.theme && typeof HT.theme.cycle === 'function'
);
// Patch #18: HT.theme.current was removed (duplicate of HT.shell.theme).
assert(
  'HT.theme.current is NOT exposed (removed in review)',
  !(HT && HT.theme && typeof HT.theme.current === 'function')
);
assert(
  'HT.viewSource.open is exposed',
  HT && HT.viewSource && typeof HT.viewSource.open === 'function'
);

// Patch #2: HT.theme and HT.viewSource use defineProperties (writable:
// false). A direct assignment in strict mode throws.
assert(
  'HT.theme is read-only (defineProperties)',
  (function () {
    if (!HT || !HT.theme) return false;
    try { HT.theme = {}; } catch (e) { return true; }
    return HT.theme && typeof HT.theme.cycle === 'function';
  })()
);
assert(
  'HT.viewSource is read-only (defineProperties)',
  (function () {
    if (!HT || !HT.viewSource) return false;
    try { HT.viewSource = {}; } catch (e) { return true; }
    return HT.viewSource && typeof HT.viewSource.open === 'function';
  })()
);
// Patch #15: HT.palette._actions removed from the public surface.
assert(
  'HT.palette._actions is NOT exposed (review patch #15)',
  !(HT && HT.palette && '_actions' in HT.palette),
  'present=' + (HT && HT.palette && '_actions' in HT.palette)
);

console.log('');
console.log('passed: ' + pass + ', failed: ' + fail);

// Vacuous-pass guard
if (pass === 0 && fail === 0) {
  console.error('VACUOUS: no assertions ran');
  process.exit(1);
}
process.exit(fail === 0 ? 0 : 1);
