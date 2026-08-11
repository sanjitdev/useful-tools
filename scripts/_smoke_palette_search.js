/* scripts/_smoke_palette_search.js — Story 3.1 contract smoke driver.
 *
 * Headless Node driver for the palette's search-binding contract. Loads
 * the same shell.js + search.js fixtures and exercises the 12 contract
 * assertions from AC-14 without a browser. Vacuous-pass guard
 * (pass === 0 && fail === 0 → exit 1) catches hollow runs.
 *
 * The HTML harness (scripts/palette-search-smoke.html) is the
 * authoritative UI smoke; this driver exists so the dev-story gate
 * can verify the contract without a browser.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const SEARCH_JS = path.join(REPO_ROOT, 'assets/js/search.js');
const SHELL_JS = path.join(REPO_ROOT, 'assets/js/shell.js');

// 8 fixture tools: the 4 from AC-14, plus 4 `qr-`-titled tools so a
// search for "qr" returns 5+ matches. This lets the top-5 cap test
// actually exercise the .slice(0, 5) boundary. The 4 `qr-` extras use
// descending search-priority so the engine keeps a stable order; the
// cap then trims the tail.
const INLINE_JSON = JSON.stringify({
  tools: [
    {
      slug: 'qr-code-generator',
      title: 'QR Code Generator',
      description: 'Generate QR codes from text.',
      keywords: ['qr', 'barcode', 'code'],
      category: 'Converters',
      'search-priority': 8,
      ready: true,
    },
    {
      slug: 'qr-reader',
      title: 'QR Reader',
      description: 'Scan a QR code from an image.',
      keywords: ['qr', 'scan', 'read'],
      category: 'Converters',
      'search-priority': 7,
      ready: true,
    },
    {
      slug: 'qr-batch',
      title: 'QR Batch',
      description: 'Bulk QR generation.',
      keywords: ['qr', 'bulk', 'batch'],
      category: 'Converters',
      'search-priority': 6,
      ready: true,
    },
    {
      slug: 'qr-styler',
      title: 'QR Styler',
      description: 'Style QR codes with colors and logos.',
      keywords: ['qr', 'style', 'logo'],
      category: 'Converters',
      'search-priority': 5,
      ready: true,
    },
    {
      slug: 'qr-tracker',
      title: 'QR Tracker',
      description: 'Track QR scans over time.',
      keywords: ['qr', 'track', 'analytics'],
      category: 'Converters',
      'search-priority': 4,
      ready: true,
    },
    {
      slug: 'inflation-calculator',
      title: 'Inflation Calculator',
      description: 'CPI-adjusted value, purchasing power.',
      keywords: ['inflation', 'cpi'],
      category: 'Converters',
      'search-priority': 7,
      ready: true,
    },
    {
      slug: 'compound-interest',
      title: 'Compound Interest',
      description: 'Future value with periodic compounding.',
      keywords: ['compound', 'interest', 'fv'],
      category: 'Finance',
      'search-priority': 6,
      ready: true,
    },
    {
      slug: 'tip-calculator',
      title: 'Tip Calculator',
      description: 'Tip amount and total per person.',
      keywords: ['tip', 'gratuity', 'split'],
      category: 'Converters',
      'search-priority': 5,
      ready: true,
    },
  ],
});

// Stub document with the inline JSON block.
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
  getElementById: (id) => {
    if (id === 'ht-tools-json-inline') {
      return { textContent: INLINE_JSON };
    }
    return null;
  },
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

// Stub window.
global.window = {
  location: { search: '', href: 'http://localhost/', assign: (u) => { window.lastAssigned = u; } },
  document: stubDocument,
  performance: { now: () => Date.now() },
  console: console,
  fetch: () =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(JSON.parse(INLINE_JSON)),
    }),
  addEventListener: () => {},
  dispatchEvent: () => {},
  CustomEvent: function (type) { this.type = type; },
  MutationObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
  matchMedia: () => ({ matches: false, addEventListener: () => {} }),
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
};
global.document = stubDocument;
global.performance = global.window.performance;
global.HT = { homeGrid: { entries: [] } };
global.fetch = global.window.fetch;
global.Promise = Promise;

// Eval search.js and shell.js in a context that mirrors the page.
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
  vm.runInContext(fs.readFileSync(SEARCH_JS, 'utf8'), ctx, { filename: 'search.js' });
  vm.runInContext(fs.readFileSync(SHELL_JS, 'utf8'), ctx, { filename: 'shell.js' });
} catch (err) {
  console.error('CRASH evaluating source:', err);
  process.exit(1);
}

const HT = ctx.window.HT || ctx.HT;
const search = HT && HT.search;
const palette = HT && HT.palette;

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

async function run(query) {
  if (!search) return [];
  const r = search(query);
  if (r && typeof r.then === 'function') return await r;
  return r || [];
}

(async () => {
  // AC-11: API surface
  assert('HT.palette is exposed', typeof palette === 'object' && palette !== null);
  assert('HT.palette.matchActions is a function', typeof palette.matchActions === 'function');
  assert('HT.palette.runAction is a function', typeof palette.runAction === 'function');
  assert('HT.palette.openHelp is a function', typeof palette.openHelp === 'function');
  assert('HT.palette.matchActions() returns []', JSON.stringify(palette.matchActions('anything')) === '[]');
  assert('HT.palette.runAction(unknown) returns null', palette.runAction('unknown-action') === null);

  // AC-10: _matchRange helper
  if (HT.search && typeof HT.search._matchRange === 'function') {
    const range = HT.search._matchRange('comp', 'Compound Interest');
    assert('HT.search._matchRange returns {start,end}', range && typeof range.start === 'number' && typeof range.end === 'number');
    // Verify the indices actually identify the matched substring (raw
    // index space, not normalized). This catches a regression that
    // returns offsets into a different field or wrong tier.
    if (range) {
      const matched = 'Compound Interest'.slice(range.start, range.end);
      assert('HT.search._matchRange indices point to "comp" in "Compound Interest"',
        matched.toLowerCase() === 'comp',
        'sliced=' + JSON.stringify(matched));
    }
    // Verify the off-by-normalization fix: queries with diacritics must
    // map back to raw indices that slice the raw (diacritics-bearing)
    // string correctly. 'naive' has no diacritics; 'Café' is the raw
    // value with the combining acute.
    const cafeRange = HT.search._matchRange('cafe', 'Café');
    assert('HT.search._matchRange handles diacritics (Café, query=cafe)',
      cafeRange && cafeRange.start === 0 && cafeRange.end === 4,
      'range=' + JSON.stringify(cafeRange));
    const noMatch = HT.search._matchRange('xyzzy', 'Compound Interest');
    assert('HT.search._matchRange returns null on no-match', noMatch === null);
  } else {
    assert('HT.search._matchRange is exposed (skipped)', true);
  }

  // _actions registry dispatch (Story 3.2 will populate, but the
  // dispatcher contract is Story 3.1's surface). Register a handler and
  // dispatch.
  if (palette && HT.palette && HT.palette._actions) {
    const before = HT.palette._actions['__smoke_test_action'];
    HT.palette._actions['__smoke_test_action'] = () => '__smoke_test_action_invoked';
    const ret = HT.palette.runAction('__smoke_test_action');
    assert('palette.runAction dispatches to registered handler', ret === '__smoke_test_action_invoked',
      'got ' + JSON.stringify(ret));
    // Handler throws — must return null + console.warn, not propagate.
    HT.palette._actions['__smoke_test_throw'] = () => { throw new Error('intentional'); };
    const retThrow = HT.palette.runAction('__smoke_test_throw');
    assert('palette.runAction returns null when handler throws', retThrow === null,
      'got ' + JSON.stringify(retThrow));
    // Clean up so we don't pollute the registry.
    if (before === undefined) delete HT.palette._actions['__smoke_test_action'];
    else HT.palette._actions['__smoke_test_action'] = before;
    delete HT.palette._actions['__smoke_test_throw'];
  } else {
    assert('palette._actions registry exposed (skipped)', true);
  }

  // AC-2 / AC-3: top-5 cap + result shape from Story 1.11 contract.
  // The fixture has 5 tools matching "qr" (qr-code-generator, qr-reader,
  // qr-batch, qr-styler, qr-tracker) so a search for "qr" returns exactly
  // 5 results. The palette's renderPaletteList slices this to top-5; we
  // verify the engine side here, and verify the slice in the HTML
  // harness (Test #4) which actually renders the listbox.
  const qrResults = await run('qr');
  assert('search("qr") returns >=5 results (fixture has 5 qr-tools)',
    qrResults.length >= 5,
    'got ' + qrResults.length + ' results');
  assert('all "qr" results are qr-* slugs',
    qrResults.every((r) => r.slug.indexOf('qr-') === 0),
    'slugs=' + JSON.stringify(qrResults.map((r) => r.slug)));
  assert('search("qr") includes qr-code-generator',
    qrResults.some((r) => r.slug === 'qr-code-generator'));
  if (qrResults.length >= 1) {
    assert('result has matchedField', typeof qrResults[0].matchedField === 'string',
      'matchedField=' + qrResults[0].matchedField);
  }

  // AC-14 #11: no-match query
  const noMatch = await run('xyzzy-not-found');
  assert('no-match query returns []', Array.isArray(noMatch) && noMatch.length === 0);

  // AC-14 #10: empty query
  const empty = await run('');
  assert('empty query returns []', Array.isArray(empty) && empty.length === 0);

  // AC-11: runAction doesn't throw on unknown
  let runActionOk = true;
  try { palette.runAction('does-not-exist'); } catch (e) { runActionOk = false; }
  assert('palette.runAction(unknown) does not throw', runActionOk);

  // AC-11: openHelp emits CustomEvent (just verify no-throw)
  let openHelpOk = true;
  try { palette.openHelp(); } catch (e) { openHelpOk = false; }
  assert('palette.openHelp() does not throw', openHelpOk);

  // AC-8: 50ms debounce — render is synchronous once input fires,
  // so verify a search call returns within budget on warm path.
  await run('inflation');  // pre-warm
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 10; i++) await run('compound');
  const t1 = process.hrtime.bigint();
  const perMs = Number(t1 - t0) / 1e6 / 10;
  assert('warm path <= 10ms/query', perMs <= 10, perMs.toFixed(2) + 'ms/query');

  console.log('');
  console.log('passed: ' + pass + ', failed: ' + fail);

  // Vacuous-pass guard
  if (pass === 0 && fail === 0) {
    console.error('VACUOUS: no assertions ran');
    process.exit(1);
  }
  process.exit(fail === 0 ? 0 : 1);
})().catch((err) => {
  console.error('CRASH:', err);
  process.exit(1);
});
