/* ============================================
   Smoke harness for Story 2.6 — Wave-1 pages.

   For each of the three wave-1 tools
   (qr-code-generator, inflation-calculator,
   lifespan-simulator), verifies:

     1. The tool's index.html exists and includes
        the slim Tier 1 script footer (Story 4
        Phase 3) — site-config.js, storage-registry.js,
        utils.js, ht-lazy.js, shell-thin.js defer.
        Heavy chrome modules (share.js, a11y.js,
        shell.js, sample-data.js, history.js, etc.)
        are NOT eagerly loaded — they ship as Tier 2
        via ht-lazy.js + Proxy stubs.
     2. The tool's <slug>.js exists and is non-empty.
     3. tools.json contains a matching entry with
        ready: true and score >= 8.
     4. The entry declares urlState, history-keys,
        view-source.path (per the per-tool contract).

   Static-only — does NOT execute the modules
   (loading storage-registry.js etc. has side effects
   that require a real browser-like environment;
   that's the Story 2.12 cross-cutting smoke's job).

   Exit codes: 0 = all green, 1 = any failure,
   2 = vacuous pass (no assertions ran). The
   vacuous-pass guard converts a hollow run into
   a hard failure, matching the Story 2.x smoke
   convention.
   ============================================ */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const TOOLS_JSON = path.join(REPO, 'tools.json');
const TOOLS_DIR = path.join(REPO, 'tools');

const WAVE_1 = ['qr-code-generator', 'inflation-calculator', 'lifespan-simulator'];

let pass = 0;
let fail = 0;

function check(name, ok) {
  if (ok) {
    console.log('  PASS  ' + name);
    pass++;
  } else {
    console.log('  FAIL  ' + name);
    fail++;
  }
}

function loadToolsJson() {
  try {
    return JSON.parse(fs.readFileSync(TOOLS_JSON, 'utf8'));
  } catch (e) {
    return null;
  }
}

function findEntry(toolsDoc, slug) {
  const tools = (toolsDoc && toolsDoc.tools) || [];
  for (let i = 0; i < tools.length; i++) {
    const e = tools[i];
    if (e && (e.slug === slug || e.id === slug)) return e;
  }
  return null;
}

function hasScriptTag(html, srcName) {
  // Match src=".../<srcName>" with optional query/hash — tolerant of
  // the relative paths the shell-template emits (../../assets/js/<srcName>).
  // Escape literal dots in the filename so 'share.js' doesn't match
  // 'shareXjs' etc.
  const escaped = srcName.replace(/\./g, '\\.');
  const re = new RegExp('src="[^"]*/' + escaped + '"', 'i');
  return re.test(html);
}

console.log('wave-1-smoke: verifying 3 wave-1 tools (qr-code-generator, inflation-calculator, lifespan-simulator)');

const toolsDoc = loadToolsJson();
check('tools.json parses', toolsDoc !== null);
if (toolsDoc === null) {
  console.log('');
  console.log('wave-1-smoke: cannot read tools.json — exit 1');
  process.exit(1);
}

WAVE_1.forEach(function (slug) {
  console.log('');
  console.log('--- ' + slug + ' ---');

  const entry = findEntry(toolsDoc, slug);
  check('tools.json has entry for ' + slug, entry !== null);
  if (entry !== null) {
    check('  ready is true', entry.ready === true);
    check('  score >= 8', typeof entry.score === 'number' && entry.score >= 8);
    check('  urlState declared', typeof entry.urlState === 'object' && entry.urlState !== null);
    check('  history-keys declared',
      Array.isArray(entry['history-keys']) || Array.isArray(entry.historyKeys));
    const vs = entry['view-source'] || entry.viewSource;
    check('  view-source.path declared',
      typeof vs === 'object' && vs !== null && typeof vs.path === 'string');
  }

  const toolHtml = path.join(TOOLS_DIR, slug, 'index.html');
  check('tools/' + slug + '/index.html exists', fs.existsSync(toolHtml));
  if (fs.existsSync(toolHtml)) {
    const html = fs.readFileSync(toolHtml, 'utf8');
    // Slim Tier 1 footer (Story 4 Phase 3) — site-config +
    // storage-registry + utils + ht-lazy + shell-thin defer.
    // Heavy chrome modules are stripped and lazy-loaded via the
    // shell-thin.js Proxy stubs + ht-lazy.js on first user action.
    check('  index.html includes site-config.js script tag',
      hasScriptTag(html, 'site-config.js'));
    check('  index.html includes storage-registry.js script tag',
      hasScriptTag(html, 'storage-registry.js'));
    check('  index.html includes utils.js script tag',
      hasScriptTag(html, 'utils.js'));
    check('  index.html includes ht-lazy.js script tag (slim Tier 1)',
      hasScriptTag(html, 'ht-lazy.js'));
    check('  index.html includes shell-thin.js script tag (slim Tier 1)',
      hasScriptTag(html, 'shell-thin.js'));
    // Drift guard: heavy chrome modules must NOT be eagerly loaded.
    const heavyChromeAbsent = [
      'share.js', 'a11y.js', 'shell.js',
      'sample-data.js', 'history.js', 'url.js',
      'export.js', 'import.js', 'palette-actions.js',
      'help-overlay.js', 'search.js', 'global-chords.js',
    ];
    let firstHeavyHit = null;
    for (const m of heavyChromeAbsent) {
      if (hasScriptTag(html, m)) { firstHeavyHit = m; break; }
    }
    check('  index.html has no heavy chrome script tags (slim Tier 1)',
      firstHeavyHit === null, 'first hit: ' + firstHeavyHit);
  }

  const toolJs = path.join(TOOLS_DIR, slug, slug + '.js');
  check('tools/' + slug + '/' + slug + '.js exists', fs.existsSync(toolJs));
  if (fs.existsSync(toolJs)) {
    const stat = fs.statSync(toolJs);
    check('  tool JS non-empty (> 100 bytes)', stat.size > 100);
  }
});

// Vacuous-pass guard: a harness that ran zero assertions is a hollow run.
console.log('');
if (pass === 0 && fail === 0) {
  console.log('wave-1-smoke: vacuous-pass guard tripped (0 PASS, 0 FAIL) — exit 1');
  process.exit(1);
}

console.log('wave-1-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);