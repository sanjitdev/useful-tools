'use strict';
/* _smoke_pins_recent.js — Story 3.12
 * Smoke harness for the Recent/Pinned tracking feature.
 *
 *   - assets/js/recent.js       → HT.recent (FIFO cap 5)
 *   - assets/js/pins.js         → HT.pins ({slug: iso} map, cap 9)
 *   - assets/js/home-sidebar.js → HT.homeSidebar (recent list in <aside>)
 *   - assets/js/home-grid.js    → pin-toggle button + pinned row markup
 *   - assets/js/shell.js        → markToolVisited() on every tool page
 *   - assets/js/api-contract.js → version 1.16.0 with recent + pins entries
 *   - assets/js/storage-registry.js → handy-tools.recent + handy-tools.pins keys
 *   - assets/js/export.js       → recent + pins top-level payload (regression guard)
 *   - assets/js/import.js       → writes recent + pins (regression guard)
 *   - index.html                → sidebar <aside> + pinned <section>
 *
 * All assertions run in plain Node — no jsdom, no playwright. Pure
 * text + vm-context + zlib. The harness is intentionally identical in
 * shape to scripts/_smoke_view_source.js (Story 3.11) so future
 * readers can diff them side by side.
 *
 * Vacuous-run guard: zero assertions must mean exit 1.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function check(name, ok, info) {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (info ? ' \u2014 ' + info : '')); }
}

// ------------------------------------------------------------------
// (a) assets/js/recent.js source shape
// ------------------------------------------------------------------
console.log('# (a) recent.js source');
const recentPath = path.join(root, 'assets/js/recent.js');
check('recent.js exists', fs.existsSync(recentPath));
const recentSrc = fs.readFileSync(recentPath, 'utf8');
check('recent.js has IIFE wrapper', /\(function\s*\(\)\s*\{[\s\S]*?\}\)\(\);/.test(recentSrc));
check('recent.js has STORAGE_KEY = handy-tools.recent',
  recentSrc.indexOf("'handy-tools.recent'") !== -1);
check('recent.js has RECENT_CAP = 5', /RECENT_CAP\s*=\s*5/.test(recentSrc));
check('recent.js defines HT.recent surface', recentSrc.indexOf('window.HT.recent') !== -1);
check('recent.js uses Object.freeze for API', recentSrc.indexOf('Object.freeze') !== -1);

// ------------------------------------------------------------------
// (b) recent.js vm-context execution + push FIFO behavior
// ------------------------------------------------------------------
console.log('\n# (b) recent.js behavior');
{
  const store = Object.create(null);
  const ctx = vm.createContext({
    window: { HT: { storage: {
      get: function (k, fb) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : fb; },
      set: function (k, v) { store[k] = v; },
    } } },
    localStorage: store,
    URLSearchParams: URLSearchParams,
    setTimeout: setTimeout,
    console: console,
  });
  try {
    vm.runInContext(recentSrc, ctx, { filename: 'recent.js' });
    const HT = ctx.window.HT || {};
    check('HT.recent exposed', typeof HT.recent === 'object');
    check('HT.recent.push is function', typeof HT.recent.push === 'function');
    check('HT.recent.list is function', typeof HT.recent.list === 'function');
    check('HT.recent.clear is function', typeof HT.recent.clear === 'function');
    check('HT.recent is frozen', Object.isFrozen(HT.recent));
    check('HT.recent.cap = 5', HT.recent.cap === 5);
    check('HT.recent.key = handy-tools.recent', HT.recent.key === 'handy-tools.recent');

    // Empty list start
    let list = HT.recent.list();
    check('recent.list() empty on boot', Array.isArray(list) && list.length === 0,
      'got len=' + (Array.isArray(list) ? list.length : 'n/a'));

    // Push a slug
    HT.recent.push('qr-code-generator');
    list = HT.recent.list();
    check('recent.push adds slug at head', list.length === 1 && list[0] === 'qr-code-generator',
      'got: ' + JSON.stringify(list));

    // Push same slug again — must NOT duplicate
    HT.recent.push('qr-code-generator');
    list = HT.recent.list();
    check('recent.push deduplicates same slug', list.length === 1,
      'got len=' + list.length);

    // Push more slugs
    HT.recent.push('tip-calculator');
    HT.recent.push('unit-converter');
    HT.recent.push('age-calculator');
    HT.recent.push('date-difference');
    list = HT.recent.list();
    check('recent.list() has 5 entries after 5 pushes', list.length === 5,
      'got len=' + list.length);
    check('most-recent push is at head', list[0] === 'date-difference',
      'got head=' + list[0]);

    // Push a 6th distinct slug — should cap at 5, oldest dropped
    HT.recent.push('world-clock');
    list = HT.recent.list();
    check('recent caps at 5 after 6th distinct push', list.length === 5,
      'got len=' + list.length);
    check('oldest (qr-code-generator) was dropped', list.indexOf('qr-code-generator') === -1,
      'got: ' + JSON.stringify(list));
    check('newest (world-clock) is at head', list[0] === 'world-clock',
      'got head=' + list[0]);

    // Pushing existing slug again re-promotes it to head
    HT.recent.push('unit-converter');
    list = HT.recent.list();
    check('re-pushing existing slug moves it to head', list[0] === 'unit-converter',
      'got head=' + list[0]);

    // Push a slug that was already at head — must remain head and length unchanged
    HT.recent.push('unit-converter');
    list = HT.recent.list();
    check('re-pushing head slug keeps head position', list[0] === 'unit-converter' && list.length === 5,
      'got: ' + JSON.stringify(list));

    // Bad inputs are no-ops
    const beforeBad = JSON.stringify(HT.recent.list());
    HT.recent.push('');
    HT.recent.push(null);
    HT.recent.push(undefined);
    HT.recent.push(42);
    const afterBad = JSON.stringify(HT.recent.list());
    check('recent.push ignores empty / non-string', beforeBad === afterBad,
      'before: ' + beforeBad + ' after: ' + afterBad);

    // Clear empties
    HT.recent.clear();
    list = HT.recent.list();
    check('recent.clear() empties list', list.length === 0,
      'got len=' + list.length);
  } catch (e) {
    check('recent.js vm run', false, e.message);
  }
}

// ------------------------------------------------------------------
// (c) assets/js/pins.js source shape
// ------------------------------------------------------------------
console.log('\n# (c) pins.js source');
const pinsPath = path.join(root, 'assets/js/pins.js');
check('pins.js exists', fs.existsSync(pinsPath));
const pinsSrc = fs.readFileSync(pinsPath, 'utf8');
check('pins.js has IIFE wrapper', /\(function\s*\(\)\s*\{[\s\S]*?\}\)\(\);/.test(pinsSrc));
check('pins.js has STORAGE_KEY = handy-tools.pins',
  pinsSrc.indexOf("'handy-tools.pins'") !== -1);
check('pins.js has PINS_CAP = 9', /PINS_CAP\s*=\s*9/.test(pinsSrc));
check('pins.js defines HT.pins surface', pinsSrc.indexOf('window.HT.pins') !== -1);
check('pins.js uses Object.freeze for API', pinsSrc.indexOf('Object.freeze') !== -1);

// ------------------------------------------------------------------
// (d) pins.js behavior — toggle, isPinned, orderByMostRecent
// ------------------------------------------------------------------
console.log('\n# (d) pins.js behavior');
{
  const store = Object.create(null);
  const ctx = vm.createContext({
    window: { HT: { storage: {
      get: function (k, fb) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : fb; },
      set: function (k, v) { store[k] = v; },
    } } },
    localStorage: store,
    URLSearchParams: URLSearchParams,
    setTimeout: setTimeout,
    console: console,
  });
  try {
    vm.runInContext(pinsSrc, ctx, { filename: 'pins.js' });
    const HT = ctx.window.HT || {};
    check('HT.pins exposed', typeof HT.pins === 'object');
    check('HT.pins.toggle is function', typeof HT.pins.toggle === 'function');
    check('HT.pins.list is function', typeof HT.pins.list === 'function');
    check('HT.pins.isPinned is function', typeof HT.pins.isPinned === 'function');
    check('HT.pins.orderByMostRecent is function',
      typeof HT.pins.orderByMostRecent === 'function');
    check('HT.pins is frozen', Object.isFrozen(HT.pins));
    check('HT.pins.cap = 9', HT.pins.cap === 9);
    check('HT.pins.key = handy-tools.pins', HT.pins.key === 'handy-tools.pins');

    // Empty start
    let map = HT.pins.list();
    check('pins.list() empty on boot',
      map && typeof map === 'object' && Object.keys(map).length === 0,
      'got: ' + JSON.stringify(map));
    check('pins.isPinned("qr") is false when empty',
      HT.pins.isPinned('qr-code-generator') === false);

    // Toggle adds with ISO timestamp
    const r1 = HT.pins.toggle('qr-code-generator');
    check('pins.toggle returns true on add', r1 === true);
    map = HT.pins.list();
    check('pins.list has qr-code-generator after toggle add',
      map && map['qr-code-generator'] && typeof map['qr-code-generator'] === 'string');
    check('pins.toggle add timestamp is ISO 8601',
      !Number.isNaN(new Date(map['qr-code-generator']).getTime()));
    check('pins.isPinned("qr") is true after toggle add',
      HT.pins.isPinned('qr-code-generator') === true);

    // Toggle same slug removes it
    const r2 = HT.pins.toggle('qr-code-generator');
    check('pins.toggle returns false on remove', r2 === false);
    map = HT.pins.list();
    check('pins.list does not have qr-code-generator after toggle remove',
      !map || !map['qr-code-generator']);
    check('pins.isPinned("qr") is false after toggle remove',
      HT.pins.isPinned('qr-code-generator') === false);

    // Toggle three slugs, check orderByMostRecent returns them sorted
    HT.pins.toggle('a-tool');
    // Force a different timestamp by patching the storage between toggles.
    // (We can't reliably rely on Date.now() differing by 1 ms in a fast smoke.)
    // Instead, set the timestamps manually for deterministic order.
    store['handy-tools.pins'] = {
      'a-tool': '2026-01-01T00:00:00.000Z',
      'b-tool': '2026-02-01T00:00:00.000Z',
      'c-tool': '2026-03-01T00:00:00.000Z',
    };
    const ordered = HT.pins.orderByMostRecent();
    check('orderByMostRecent returns 3 entries',
      Array.isArray(ordered) && ordered.length === 3,
      'got: ' + JSON.stringify(ordered));
    check('orderByMostRecent sorts descending by iso',
      ordered[0] === 'c-tool' && ordered[1] === 'b-tool' && ordered[2] === 'a-tool',
      'got: ' + JSON.stringify(ordered));

    // orderByMostRecent caps at 9
    store['handy-tools.pins'] = {};
    for (let i = 0; i < 12; i += 1) {
      const ts = '2026-01-' + String(i + 1).padStart(2, '0') + 'T00:00:00.000Z';
      store['handy-tools.pins']['tool-' + i] = ts;
    }
    const capped = HT.pins.orderByMostRecent();
    check('orderByMostRecent caps at 9', capped.length === 9,
      'got len=' + capped.length);
    check('orderByMostRecent top is the most-recent iso',
      capped[0] === 'tool-11',
      'got: ' + JSON.stringify(capped));

    // Corrupt entries are dropped on list()
    store['handy-tools.pins'] = {
      'a-tool': '2026-01-01T00:00:00.000Z',
      'bad-tool': 'not-a-date',
      'b-tool': '2026-02-01T00:00:00.000Z',
    };
    const cleaned = HT.pins.list();
    check('pins.list drops corrupt iso values',
      cleaned && cleaned['a-tool'] && cleaned['b-tool'] && !cleaned['bad-tool'],
      'got: ' + JSON.stringify(cleaned));

    // Non-string slug is no-op
    const beforeBad = JSON.stringify(store['handy-tools.pins'] || {});
    HT.pins.toggle('');
    HT.pins.toggle(null);
    HT.pins.toggle(42);
    const afterBad = JSON.stringify(store['handy-tools.pins'] || {});
    check('pins.toggle ignores empty / non-string', beforeBad === afterBad,
      'before: ' + beforeBad + ' after: ' + afterBad);

    // Clear empties
    HT.pins.clear();
    const cleared = store['handy-tools.pins'];
    check('pins.clear() empties storage',
      cleared && typeof cleared === 'object' && Object.keys(cleared).length === 0,
      'got: ' + JSON.stringify(cleared));
  } catch (e) {
    check('pins.js vm run', false, e.message);
  }
}

// ------------------------------------------------------------------
// (e) api-contract.js — version + recent + pins + homeSidebar entries
// ------------------------------------------------------------------
console.log('\n# (e) api-contract.js');
const apiPath = path.join(root, 'assets/js/api-contract.js');
check('api-contract.js exists', fs.existsSync(apiPath));
const apiSrc = fs.readFileSync(apiPath, 'utf8');
const verMatch = apiSrc.match(/version:\s*['"]([\d.]+)['"]/);
check('api-contract.js has version field', !!verMatch);
check('api-contract.js version = 1.16.0',
  verMatch && verMatch[1] === '1.16.0',
  'got: ' + (verMatch ? verMatch[1] : 'n/a'));
check('api-contract.js lists HT.recent entry', apiSrc.indexOf("'HT.recent'") !== -1);
check('api-contract.js lists HT.pins entry', apiSrc.indexOf("'HT.pins'") !== -1);
check('api-contract.js lists HT.homeSidebar entry', apiSrc.indexOf("'HT.homeSidebar'") !== -1);
check('HT.recent entry notes Story 3.12',
  /HT\.recent[\s\S]{0,2000}Story 3\.12/.test(apiSrc));
check('HT.pins entry notes Story 3.12',
  /HT\.pins[\s\S]{0,2000}Story 3\.12/.test(apiSrc));
check('HT.homeSidebar entry notes Story 3.12',
  /HT\.homeSidebar[\s\S]{0,2000}Story 3\.12/.test(apiSrc));

// ------------------------------------------------------------------
// (f) storage-registry.js — handy-tools.recent + handy-tools.pins keys
// ------------------------------------------------------------------
console.log('\n# (f) storage-registry.js');
const regPath = path.join(root, 'assets/js/storage-registry.js');
check('storage-registry.js exists', fs.existsSync(regPath));
const regSrc = fs.readFileSync(regPath, 'utf8');
check('storage-registry registers handy-tools.recent',
  /register\(\s*['"]handy-tools\.recent['"]/.test(regSrc));
check('storage-registry registers handy-tools.pins',
  /register\(\s*['"]handy-tools\.pins['"]/.test(regSrc));
check('handy-tools.recent schema is array-like',
  /handy-tools\.recent[\s\S]{0,400}schema:\s*['"]array/.test(regSrc));
check('handy-tools.pins schema is object',
  /handy-tools\.pins[\s\S]{0,400}schema:\s*['"]object\b/.test(regSrc));

// ------------------------------------------------------------------
// (g) home-grid.js — pin-toggle + pinned row markup
// ------------------------------------------------------------------
console.log('\n# (g) home-grid.js');
const gridPath = path.join(root, 'assets/js/home-grid.js');
check('home-grid.js exists', fs.existsSync(gridPath));
const gridSrc = fs.readFileSync(gridPath, 'utf8');
check('home-grid.js has buildPinButton', gridSrc.indexOf('buildPinButton') !== -1);
check('home-grid.js has buildPinnedRow', gridSrc.indexOf('buildPinnedRow') !== -1);
check('home-grid.js has mountPinnedRow', gridSrc.indexOf('mountPinnedRow') !== -1);
check('home-grid.js has updatePinButton', gridSrc.indexOf('updatePinButton') !== -1);
check('home-grid.js has attachPinHandlers', gridSrc.indexOf('attachPinHandlers') !== -1);
check('home-grid.js pin-toggle class',
  gridSrc.indexOf('class="pin-toggle"') !== -1);
check('home-grid.js pinned-grid class',
  gridSrc.indexOf('class="tool-grid pinned-grid"') !== -1);
check('home-grid.js pinned-row aria-label',
  gridSrc.indexOf('aria-label="Pinned tools"') !== -1);
check('home-grid.js calls HT.pins.toggle in handler',
  gridSrc.indexOf('HT.pins.toggle') !== -1);
check('home-grid.js calls HT.pins.orderByMostRecent',
  gridSrc.indexOf('HT.pins.orderByMostRecent') !== -1);
check('home-grid.js calls HT.pins.isPinned',
  gridSrc.indexOf('HT.pins.isPinned') !== -1);
check('home-grid.js prevents default on pin click',
  /event\.preventDefault\(\)[\s\S]{0,200}event\.stopPropagation\(\)/.test(gridSrc));

// ------------------------------------------------------------------
// (h) shell.js — markToolVisited
// ------------------------------------------------------------------
console.log('\n# (h) shell.js');
const shellPath = path.join(root, 'assets/js/shell.js');
check('shell.js exists', fs.existsSync(shellPath));
const shellSrc = fs.readFileSync(shellPath, 'utf8');
check('shell.js has markToolVisited', shellSrc.indexOf('markToolVisited') !== -1);
check('shell.js reads data-slug from main',
  /document\.getElementById\(\s*['"]main['"]\s*\)[\s\S]{0,200}dataset\.slug/.test(shellSrc));
check('shell.js markToolVisited calls HT.recent.push',
  /markToolVisited[\s\S]{0,800}HT\.recent\.push/.test(shellSrc));
check('shell.js markToolVisited guards _toolVisited',
  /_toolVisited\s*=\s*true/.test(shellSrc));
check('shell.js markToolVisited guards embed mode',
  /isEmbedMode\(\)[\s\S]{0,200}_toolVisited\s*=\s*true/.test(shellSrc));

// ------------------------------------------------------------------
// (i) home-sidebar.js — recent list in <aside>
// ------------------------------------------------------------------
console.log('\n# (i) home-sidebar.js');
const sbPath = path.join(root, 'assets/js/home-sidebar.js');
check('home-sidebar.js exists', fs.existsSync(sbPath));
const sbSrc = fs.readFileSync(sbPath, 'utf8');
check('home-sidebar.js has IIFE wrapper',
  /\(function\s*\(\)\s*\{[\s\S]*?\}\)\(\);/.test(sbSrc));
check('home-sidebar.js exposes HT.homeSidebar',
  sbSrc.indexOf('window.HT.homeSidebar') !== -1);
check('home-sidebar.js reads HT.recent.list',
  sbSrc.indexOf('HT.recent.list') !== -1);
check('home-sidebar.js reads HT.homeGrid.entries',
  sbSrc.indexOf('HT.homeGrid.entries') !== -1);
check('home-sidebar.js selector .home-sidebar',
  sbSrc.indexOf("'.home-sidebar'") !== -1);
check('home-sidebar.js selector .recent-list',
  sbSrc.indexOf("'.recent-list'") !== -1);
check('home-sidebar.js is frozen', sbSrc.indexOf('Object.freeze') !== -1);
check('home-sidebar.js guards embed mode',
  sbSrc.indexOf('isEmbedMode') !== -1);

// ------------------------------------------------------------------
// (j) index.html — sidebar <aside> + pinned <section> + scripts
// ------------------------------------------------------------------
console.log('\n# (j) index.html');
const indexPath = path.join(root, 'index.html');
check('index.html exists', fs.existsSync(indexPath));
const indexSrc = fs.readFileSync(indexPath, 'utf8');
check('index.html has aside.home-sidebar',
  indexSrc.indexOf('aside class="home-sidebar"') !== -1);
check('index.html has ol.recent-list',
  indexSrc.indexOf('class="recent-list"') !== -1);
check('index.html has section#home-grid-pinned-section',
  indexSrc.indexOf('id="home-grid-pinned-section"') !== -1);
check('index.html has div#home-grid-pinned',
  indexSrc.indexOf('id="home-grid-pinned"') !== -1);
check('index.html includes recent.js script',
  indexSrc.indexOf('assets/js/recent.js') !== -1);
check('index.html includes pins.js script',
  indexSrc.indexOf('assets/js/pins.js') !== -1);
check('index.html includes home-sidebar.js script',
  indexSrc.indexOf('assets/js/home-sidebar.js') !== -1);

// Script order on home page: home-grid.js < recent.js < pins.js < home-sidebar.js
const homeGridIdx = indexSrc.indexOf('assets/js/home-grid.js');
const recentIdx = indexSrc.indexOf('assets/js/recent.js');
const pinsIdx = indexSrc.indexOf('assets/js/pins.js');
const sidebarIdx = indexSrc.indexOf('assets/js/home-sidebar.js');
check('script order: home-grid < recent',
  homeGridIdx !== -1 && recentIdx !== -1 && homeGridIdx < recentIdx);
check('script order: recent < pins',
  recentIdx !== -1 && pinsIdx !== -1 && recentIdx < pinsIdx);
check('script order: pins < home-sidebar',
  pinsIdx !== -1 && sidebarIdx !== -1 && pinsIdx < sidebarIdx);

// ------------------------------------------------------------------
// (k) export.js — recent + pins top-level payload (regression guard)
// ------------------------------------------------------------------
console.log('\n# (k) export.js regression');
const expPath = path.join(root, 'assets/js/export.js');
check('export.js exists', fs.existsSync(expPath));
const expSrc = fs.readFileSync(expPath, 'utf8');
check('export.js includes recent in payload',
  /recent:\s*_getStringArray/.test(expSrc));
check('export.js includes pins in payload',
  /pins:\s*_getPins/.test(expSrc));
check('export.js validates recent as array',
  /must be an array/.test(expSrc));
check('export.js validates pins as plain object',
  /pins['"]?\s*,\s*message:\s*['"]must be a plain object/.test(expSrc));
check('export.js validates pins ISO parseable',
  /not ISO-parseable/.test(expSrc));

// ------------------------------------------------------------------
// (l) import.js — writes recent + pins (regression guard)
// ------------------------------------------------------------------
console.log('\n# (l) import.js regression');
const impPath = path.join(root, 'assets/js/import.js');
check('import.js exists', fs.existsSync(impPath));
const impSrc = fs.readFileSync(impPath, 'utf8');
check('import.js writes handy-tools.recent',
  impSrc.indexOf("'handy-tools.recent'") !== -1);
check('import.js writes handy-tools.pins',
  impSrc.indexOf("'handy-tools.pins'") !== -1);

// ------------------------------------------------------------------
// (m) site-config-gate.py — version bump
// ------------------------------------------------------------------
console.log('\n# (m) site-config-gate.py');
const scgPath = path.join(root, 'scripts/site-config-gate.py');
check('site-config-gate.py exists', fs.existsSync(scgPath));
const scgSrc = fs.readFileSync(scgPath, 'utf8');
check('site-config-gate.py EXPECTED_VERSION = "1.16.0"',
  /EXPECTED_VERSION\s*=\s*["']1\.16\.0["']/.test(scgSrc),
  'expected "1.16.0"');

// ------------------------------------------------------------------
// Done
// ------------------------------------------------------------------
console.log('\n# summary');
console.log('  pass: ' + pass);
console.log('  fail: ' + fail);
if (pass === 0) {
  console.error('  ERROR: zero assertions ran — vacuous pass');
  process.exit(1);
}
if (fail > 0) {
  console.error('  FAILED');
  process.exit(1);
}
console.log('  OK');
process.exit(0);
