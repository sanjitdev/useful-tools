'use strict';
/* _smoke_view_source.js — Story 3.11
 * Smoke harness for the /view-source route, the vendored syntax
 * highlighter, the vendored PKZIP STORE-only builder, and the
 * updated wireViewSourceLink() footer wiring. Runs in plain Node —
 * no jsdom, no playwright. Pure text + vm + zlib CRC-32 verification.
 *
 * Assertions cover (a) /view-source.html shape, (b) view-source.js
 * module shape and behavior, (c) vendor/highlight.min.js tokenizer
 * round-trip, (d) vendor/zip-store.js byte layout per APPNOTE.TXT
 * sections 4.3.7 / 4.3.12 / 4.3.16, (e) tools.json view-source
 * conventions, (f) wireViewSourceLink() target, and (g) chrome
 * footer dual-anchor pattern.
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
// (a) view-source.html structural assertions
// ------------------------------------------------------------------
console.log('# (a) view-source.html structure');
const pagePath = path.join(root, 'view-source.html');
check('view-source.html exists', fs.existsSync(pagePath));
const page = fs.readFileSync(pagePath, 'utf8');
check('view-source.html non-empty', page.length > 1000, 'len=' + page.length);

// Slim Tier 1 (Story 4 Phase 3): view-source no longer carries the
// heavy chrome script block (a11y.js, shell.js, search.js,
// help-overlay.js). Tier 1 = site-config + storage-registry + utils +
// ht-lazy + shell-thin; page-conditional modules (api-contract,
// highlight.min.js, zip-store.js, view-source.js) follow.
const expectedFragments = [
  '<main id="main"',
  'data-view-source-tool',
  '<pre class="view-source-code">',
  'data-lang="html"',
  'data-lang="css"',
  'data-lang="js"',
  'id="view-source-download"',
  'id="view-source-copy"',
  'id="view-source-status"',
  'id="view-source-not-found"',
  'src="assets/js/site-config.js"',
  'src="assets/js/storage-registry.js"',
  'src="assets/js/utils.js"',
  'src="assets/js/ht-lazy.js"',
  'src="assets/js/api-contract.js"',
  'src="assets/js/vendor/highlight.min.js"',
  'src="assets/js/vendor/zip-store.js"',
  'src="assets/js/view-source.js"',
];
for (const fragment of expectedFragments) {
  check('view-source.html has \u201c' + fragment + '\u201d', page.indexOf(fragment) !== -1);
}

// Slim Tier 1 (Story 4 Phase 3): view-source now carries the standard
// Tier 1 footer (ht-lazy + shell-thin defer) just like every chrome
// page — the Proxy stubs in shell-thin.js keep HT.history /
// HT.urlState / HT.palette available if any future view-source code
// path needs them, and the Tier 1 budget stays well under 30 KB gz.
check('view-source.html has shell-thin.js defer (slim Tier 1)',
  page.indexOf('src="assets/js/shell-thin.js" defer') !== -1);

// Heavy chrome modules must be absent on view-source too (Story 4
// Phase 3 slim Tier 1 sweep). Drift guard — if a future change
// re-introduces any of these script tags, the page falls back out
// of slim Tier 1 shape and the bundle tier1-budget gate will flag it.
const heavyChromeAbsent = [
  'assets/js/a11y.js"',
  'assets/js/shell.js"',
  'assets/js/search.js"',
  'assets/js/help-overlay.js"',
  'assets/js/url.js"',
  'assets/js/history.js"',
  'assets/js/sample-data.js"',
  'assets/js/share.js"',
  'assets/js/export.js"',
  'assets/js/import.js"',
  'assets/js/palette-actions.js"',
  'assets/js/global-chords.js"',
];
let heavyChromeOk = true;
let firstHeavyHit = '';
for (const tag of heavyChromeAbsent) {
  if (page.indexOf(tag) !== -1) {
    heavyChromeOk = false;
    if (!firstHeavyHit) firstHeavyHit = tag;
  }
}
check('view-source.html has no heavy chrome script tags (slim Tier 1)',
  heavyChromeOk, 'first hit: ' + firstHeavyHit);

// Script order: site-config before storage-registry before api-contract
const orderIdx = (s) => page.indexOf(s);
check('script order: site-config < storage-registry',
  orderIdx('assets/js/site-config.js') < orderIdx('assets/js/storage-registry.js'));
check('script order: storage-registry < api-contract',
  orderIdx('assets/js/storage-registry.js') < orderIdx('assets/js/api-contract.js'));
check('script order: api-contract < highlight.min.js',
  orderIdx('assets/js/api-contract.js') < orderIdx('assets/js/vendor/highlight.min.js'));
check('script order: highlight.min.js < zip-store.js',
  orderIdx('assets/js/vendor/highlight.min.js') < orderIdx('assets/js/vendor/zip-store.js'));
check('script order: zip-store.js < view-source.js',
  orderIdx('assets/js/vendor/zip-store.js') < orderIdx('assets/js/view-source.js'));

// ------------------------------------------------------------------
// (b) view-source.js module shape + behavior (vm context)
// ------------------------------------------------------------------
console.log('\n# (b) view-source.js module');
const vsPath = path.join(root, 'assets/js/view-source.js');
check('view-source.js exists', fs.existsSync(vsPath));
const vsSrc = fs.readFileSync(vsPath, 'utf8');
check('view-source.js has IIFE wrapper', /\(function\s*\(\)\s*\{[\s\S]*?\}\)\(\);/.test(vsSrc));
check('view-source.js has STORAGE_KEY constant', vsSrc.indexOf("'handy-tools.viewSource.recent'") !== -1);
check('view-source.js has RECENT_CAP = 5', vsSrc.indexOf('RECENT_CAP') !== -1 && /RECENT_CAP\s*=\s*5/.test(vsSrc));
check('view-source.js has getQuerySlug regex',
  vsSrc.indexOf('^[a-z0-9][a-z0-9-]*$') !== -1);
check('view-source.js has slug setTitle 404', vsSrc.indexOf('404 Not Found') !== -1);

// Run view-source.js in a sandbox with a fake document/window so we
// can poke the getQuerySlug() function directly without a real DOM.
const fakeWindow = {
  HT: {},
  location: { search: '?tool=qr-code-generator' },
};
const fakeDocument = {
  readyState: 'loading',
  addEventListener: function (ev, cb) {
    if (ev === 'DOMContentLoaded') {
      // Don't fire — we're not exercising boot() here.
    }
  },
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; },
  createElement: function () {
    return { appendChild: function () {}, addEventListener: function () {}, style: {} };
  },
  createDocumentFragment: function () {
    return { appendChild: function () {}, childNodes: [] };
  },
  title: '',
  body: { appendChild: function () {} },
};
const ctx = vm.createContext({
  window: fakeWindow,
  document: fakeDocument,
  URLSearchParams: URLSearchParams,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  Promise: Promise,
  fetch: function () { return Promise.reject(new Error('no network in smoke')); },
  console: console,
});
try {
  vm.runInContext(vsSrc, ctx, { filename: 'view-source.js' });
  const HT = ctx.window.HT || {};
  check('HT.viewSource exposed', typeof HT.viewSource === 'object');
  check('HT.viewSource.boot is function', typeof HT.viewSource.boot === 'function');
  check('HT.viewSource.getQuerySlug is function',
    typeof HT.viewSource.getQuerySlug === 'function');
  check('HT.viewSource.fetchAll is function',
    typeof HT.viewSource.fetchAll === 'function');
  check('HT.viewSource._internal frozen',
    Object.isFrozen(HT.viewSource._internal));
  check('STORAGE_KEY = handy-tools.viewSource.recent',
    HT.viewSource && HT.viewSource._internal
      && HT.viewSource._internal.STORAGE_KEY === 'handy-tools.viewSource.recent');
  check('RECENT_CAP = 5',
    HT.viewSource && HT.viewSource._internal
      && HT.viewSource._internal.RECENT_CAP === 5);
  // Validate getQuerySlug with the fake ?tool=qr-code-generator.
  const slug = HT.viewSource.getQuerySlug();
  check('getQuerySlug() returns qr-code-generator', slug === 'qr-code-generator',
    'got: ' + slug);
} catch (e) {
  check('view-source.js vm run', false, e.message);
}

// Re-run with empty/missing query — getQuerySlug should return null.
{
  const ctx2 = vm.createContext({
    window: { HT: {}, location: { search: '' } },
    document: fakeDocument,
    URLSearchParams: URLSearchParams,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Promise: Promise,
    fetch: function () { return Promise.reject(new Error('no network')); },
    console: console,
  });
  try {
    vm.runInContext(vsSrc, ctx2, { filename: 'view-source.js' });
    const s2 = ctx2.window.HT.viewSource.getQuerySlug();
    check('getQuerySlug() on empty search returns null', s2 === null,
      'got: ' + s2);
  } catch (e) {
    check('view-source.js empty-search vm run', false, e.message);
  }
}

// Re-run with malformed slug (uppercase / spaces / slash).
{
  const ctx3 = vm.createContext({
    window: { HT: {}, location: { search: '?tool=BAD/SLUG' } },
    document: fakeDocument,
    URLSearchParams: URLSearchParams,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Promise: Promise,
    fetch: function () { return Promise.reject(new Error('no network')); },
    console: console,
  });
  try {
    vm.runInContext(vsSrc, ctx3, { filename: 'view-source.js' });
    const s3 = ctx3.window.HT.viewSource.getQuerySlug();
    check('getQuerySlug() rejects uppercase/slash', s3 === null,
      'got: ' + s3);
  } catch (e) {
    check('view-source.js malformed-slug vm run', false, e.message);
  }
}

// ------------------------------------------------------------------
// (c) vendor/highlight.min.js tokenizer
// ------------------------------------------------------------------
console.log('\n# (c) vendor/highlight.min.js');
const hlPath = path.join(root, 'assets/js/vendor/highlight.min.js');
check('highlight.min.js exists', fs.existsSync(hlPath));
const hlSrc = fs.readFileSync(hlPath, 'utf8');
check('highlight.min.js has IIFE wrapper',
  /\(function\s*\(\)\s*\{[\s\S]*?\}\)\(\);/.test(hlSrc));
check('highlight.min.js defines HT.highlight', hlSrc.indexOf('HT.highlight') !== -1);
check('highlight.min.js has HTML_TOKEN table', hlSrc.indexOf('HTML_TOKENS') !== -1);
check('highlight.min.js has CSS_TOKEN table', hlSrc.indexOf('CSS_TOKENS') !== -1);
check('highlight.min.js has JS_TOKEN table', hlSrc.indexOf('JS_TOKENS') !== -1);
check('highlight.min.js tokenizes comments (HTML)',
  hlSrc.indexOf('tok-comment') !== -1);
check('highlight.min.js tokenizes keywords (JS)',
  /var let const/.test(hlSrc));

// Execute highlight.min.js in a vm and exercise the tokenizer.
{
  const fakeFrag = {
    appendChild: function () { /* append text node */ },
    childNodes: [],
  };
  const fakeDoc = {
    createDocumentFragment: function () { return fakeFrag; },
    createTextNode: function (text) { return { nodeType: 3, data: text }; },
    createElement: function (tag) {
      return {
        nodeType: 1,
        tagName: tag,
        appendChild: function (child) { this._children = this._children || []; this._children.push(child); },
        setAttribute: function () {},
        style: {},
        className: '',
        childNodes: [],
      };
    },
  };
  const ctx4 = vm.createContext({
    window: {},
    document: fakeDoc,
    console: console,
  });
  try {
    vm.runInContext(hlSrc, ctx4, { filename: 'highlight.min.js' });
    const HT = ctx4.window.HT || {};
    check('HT.highlight is function', typeof HT.highlight === 'function');
    // Unknown lang → returns a fragment with a single text node.
    const f1 = HT.highlight('hello', 'unknown-lang');
    check('highlight(unknown-lang) returns fragment',
      f1 && typeof f1.appendChild === 'function');
    // html lang → returns a fragment.
    const f2 = HT.highlight('<div class="foo">x</div>', 'html');
    check('highlight(html) returns fragment',
      f2 && typeof f2.appendChild === 'function');
    // css lang → returns a fragment.
    const f3 = HT.highlight('a { color: #fff; }', 'css');
    check('highlight(css) returns fragment',
      f3 && typeof f3.appendChild === 'function');
    // js lang → returns a fragment.
    const f4 = HT.highlight('var x = 1;', 'js');
    check('highlight(js) returns fragment',
      f4 && typeof f4.appendChild === 'function');
  } catch (e) {
    check('highlight.min.js vm run', false, e.message);
  }
}

// ------------------------------------------------------------------
// (d) vendor/zip-store.js PKZIP STORE-only byte layout
// ------------------------------------------------------------------
console.log('\n# (d) vendor/zip-store.js');
const zipPath = path.join(root, 'assets/js/vendor/zip-store.js');
check('zip-store.js exists', fs.existsSync(zipPath));
const zipSrc = fs.readFileSync(zipPath, 'utf8');
check('zip-store.js has IIFE wrapper',
  /\(function\s*\(\)\s*\{[\s\S]*?\}\)\(\);/.test(zipSrc));
check('zip-store.js defines HT.zipStore', zipSrc.indexOf('HT.zipStore') !== -1);
check('zip-store.js has CRC-32 table', zipSrc.indexOf('CRC_TABLE') !== -1 || zipSrc.indexOf('_zipStoreCrcTable') !== -1);
check('zip-store.js references polynomial 0xEDB88320',
  /0xEDB88320/i.test(zipSrc));

// Run zip-store.js and verify the byte layout for a single small file.
{
  const ctx5 = vm.createContext({
    window: {},
    console: console,
  });
  try {
    vm.runInContext(zipSrc, ctx5, { filename: 'zip-store.js' });
    const HT = ctx5.window.HT || {};
    check('HT.zipStore is function', typeof HT.zipStore === 'function');

    // Build a minimal zip with one text file: "hello".
    // NB: pass the data as a string so bytesOf() handles it inside the
    // vm context (Uint8Array instanceof check fails across realms).
    const zip = HT.zipStore([{ name: 'hello.txt', data: 'hello' }]);
    check('zipStore returns Uint8Array',
      zip && Object.prototype.toString.call(zip) === '[object Uint8Array]');
    check('zip length > 50 bytes', zip.length > 50, 'len=' + zip.length);

    // Local file header signature = 0x04034b50 = "PK\x03\x04".
    check('zip starts with PK\\x03\\x04',
      zip[0] === 0x50 && zip[1] === 0x4B && zip[2] === 0x03 && zip[3] === 0x04,
      'got: ' + zip[0].toString(16) + ' ' + zip[1].toString(16) + ' ' +
        zip[2].toString(16) + ' ' + zip[3].toString(16));

    // EOCD signature = 0x06054b50 = "PK\x05\x06" at the end.
    const n = zip.length;
    check('zip ends with PK\\x05\\x06',
      zip[n - 22] === 0x50 && zip[n - 21] === 0x4B &&
      zip[n - 20] === 0x05 && zip[n - 19] === 0x06,
      'got offset -22: ' + (n - 22));

    // Version needed to extract (offset 4) should be 20 (2.0) for STORE.
    const versionNeeded = zip[4] | (zip[5] << 8);
    check('version needed to extract = 20', versionNeeded === 20,
      'got: ' + versionNeeded);

    // General-purpose bit 11 should be set (UTF-8 filename).
    const gpFlag = zip[6] | (zip[7] << 8);
    check('general-purpose bit 11 (UTF-8) set',
      (gpFlag & 0x0800) !== 0, 'flag=0x' + gpFlag.toString(16));

    // Compression method (offset 8) should be 0 (STORE).
    const method = zip[8] | (zip[9] << 8);
    check('compression method = 0 (STORE)', method === 0, 'got: ' + method);

    // CRC-32 of "hello" is 0x3610A686 (zlib-canonical).
    const crcOffset = 14;
    const storedCrc = zip[crcOffset]
      | (zip[crcOffset + 1] << 8)
      | (zip[crcOffset + 2] << 16)
      | (zip[crcOffset + 3] << 24);
    check('CRC-32 of hello = 0x3610A686',
      (storedCrc >>> 0) === 0x3610A686,
      'got: 0x' + (storedCrc >>> 0).toString(16));
  } catch (e) {
    check('zip-store.js vm run', false, e.message);
  }
}

// ------------------------------------------------------------------
// (e) tools.json view-source conventions
// ------------------------------------------------------------------
console.log('\n# (e) tools.json');
const toolsJsonPath = path.join(root, 'tools.json');
check('tools.json exists', fs.existsSync(toolsJsonPath));
const tj = JSON.parse(fs.readFileSync(toolsJsonPath, 'utf8'));
const tools = Array.isArray(tj) ? tj : (tj.tools || []);
check('tools.json has 45 tools', tools.length === 45, 'got: ' + tools.length);

let allHaveVS = true;
let allPathConventionsHold = true;
for (const tool of tools) {
  const vs = tool['view-source'];
  if (!vs || typeof vs.enabled !== 'boolean' || typeof vs.path !== 'string') {
    allHaveVS = false;
  }
  const expectedPath = 'tools/' + tool.slug + '/index.html';
  if (vs && vs.path !== expectedPath) {
    allPathConventionsHold = false;
  }
}
check('every tool has view-source.enabled + path', allHaveVS);
check('every tool view-source.path = tools/<slug>/index.html',
  allPathConventionsHold);

// Spot-check that the path actually resolves to a real file.
{
  const sample = tools.find((t) => t.slug === 'qr-code-generator');
  if (sample) {
    const p = path.join(root, sample['view-source'].path);
    check('view-source.path resolves to existing file', fs.existsSync(p));
  }
}

// ------------------------------------------------------------------
// (f) wireViewSourceLink() target change (shell.js)
// ------------------------------------------------------------------
console.log('\n# (f) wireViewSourceLink()');
const shellPath = path.join(root, 'assets/js/shell.js');
const shellSrc = fs.readFileSync(shellPath, 'utf8');
check('shell.js targets /view-source?tool=', shellSrc.indexOf('/view-source?tool=') !== -1);
check('shell.js still references blobBase',
  shellSrc.indexOf('HT.siteConfig.blobBase') !== -1 ||
  shellSrc.indexOf('blobBase') !== -1);
check('shell.js hidden attribute on secondary link',
  shellSrc.indexOf('data-view-source-github') !== -1);

// ------------------------------------------------------------------
// (g) chrome.html dual-anchor footer pattern
// ------------------------------------------------------------------
console.log('\n# (g) chrome.html');
const chromePath = path.join(root, 'assets/shell/chrome.html');
check('chrome.html exists', fs.existsSync(chromePath));
const chromeSrc = fs.readFileSync(chromePath, 'utf8');
check('chrome.html has primary view-source anchor',
  chromeSrc.indexOf('data-view-source-link') !== -1);
check('chrome.html has secondary GitHub anchor',
  chromeSrc.indexOf('data-view-source-github') !== -1);
check('chrome.html has empty href on primary',
  chromeSrc.indexOf('href="/view-source?tool="') !== -1);
check('chrome.html has rel="noopener noreferrer" on secondary',
  chromeSrc.indexOf('rel="noopener noreferrer" data-view-source-github') !== -1);

// ------------------------------------------------------------------
// (h) view-source.html footer dual-anchor (shell.js will populate href)
// ------------------------------------------------------------------
console.log('\n# (h) view-source.html footer');
check('view-source.html has data-view-source-link',
  page.indexOf('data-view-source-link') !== -1);
check('view-source.html has data-view-source-github',
  page.indexOf('data-view-source-github') !== -1);

// ------------------------------------------------------------------
// (i) api-contract.js version + viewSource entry
// ------------------------------------------------------------------
console.log('\n# (i) api-contract.js');
const acPath = path.join(root, 'assets/js/api-contract.js');
const acSrc = fs.readFileSync(acPath, 'utf8');
check('api-contract.js exposes HT.__apiContract', acSrc.indexOf('HT.__apiContract') !== -1);
check('api-contract.js version 1.23.0 (Story 1.11 follow-up bumped 1.22.0 → 1.23.0 for the 11 utils.js helpers promoted to HT.*)', /version:\s*'1\.23\.0'/.test(acSrc));
check('api-contract.js has HT.viewSource entry',
  acSrc.indexOf("name: 'HT.viewSource'") !== -1);
check('api-contract.js has HT.highlight entry',
  acSrc.indexOf("name: 'HT.highlight'") !== -1);
check('api-contract.js has HT.zipStore entry',
  acSrc.indexOf("name: 'HT.zipStore'") !== -1);

// ------------------------------------------------------------------
// Final tally
// ------------------------------------------------------------------
console.log('');
console.log('passed: ' + pass + ', failed: ' + fail);
if (pass === 0 && fail === 0) {
  console.error('smoke: vacuous run \u2014 zero assertions executed');
  process.exit(1);
}
process.exit(fail === 0 ? 0 : 1);