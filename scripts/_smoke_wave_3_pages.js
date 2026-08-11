/* ============================================
   Smoke harness for Story 2.8 — Wave-3 pages.

   For each of the 17 wave-3 tools (sorted by JS
   bytes desc, matching the Wave-3 selection),
   verifies:

     1. tools.json contains a matching entry with
        ready: true and score >= 8.
     2. The entry declares urlState, history-keys,
        view-source.path, embed-snippet, keywords,
        pack, icon (per the per-tool contract).
     3. tools/<slug>/index.html exists and includes
        the Story 2.x Shell script tags (share.js,
        a11y.js, shell.js, sample-data.js,
        history.js).
     4. tools/<slug>/<slug>.js exists, is non-empty,
        and the tool's <slug>.css contains a
        @media print block (rubric #5 Printable).
     5. Each encode/decode entry's `from`/`to`
        selector is present in the HTML.

   Static-only — does NOT execute the modules
   (loading storage-registry.js etc. has side effects
   that require a real browser-like environment;
   that's the Story 2.12 cross-cutting smoke's job).

   Exit codes: 0 = all green, 1 = any failure,
   2 = vacuous pass (no assertions ran).
   ============================================ */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const TOOLS_JSON = path.join(REPO, 'tools.json');
const TOOLS_DIR = path.join(REPO, 'tools');

// 17 wave-3 tools, sorted by JS bytes desc — must mirror
// scripts/_promote_wave_3.py + _print_css_bootstrap.py.
const WAVE_3 = [
  'json-formatter',
  'color-tools',
  'date-difference',
  'lorem-ipsum',
  'pros-cons',
  'unit-converter',
  'password-strength',
  'pomodoro-timer',
  'habit-tracker',
  'regex-tester',
  'eisenhower-matrix',
  'bmi-calculator',
  'word-counter',
  'percentage-calculator',
  'base64-codec',
  'tip-calculator',
  'url-codec',
];

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

function collectHtmlIds(html) {
  const ids = new Set();
  const re = /id\s*=\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    ids.add(m[1]);
  }
  return ids;
}

console.log('wave-3-smoke: verifying 17 wave-3 tools (sorted by JS bytes desc)');

const toolsDoc = loadToolsJson();
check('tools.json parses', toolsDoc !== null);
if (toolsDoc === null) {
  console.log('');
  console.log('wave-3-smoke: cannot read tools.json — exit 1');
  process.exit(1);
}

WAVE_3.forEach(function (slug) {
  console.log('');
  console.log('--- ' + slug + ' ---');

  const entry = findEntry(toolsDoc, slug);
  check('tools.json has entry for ' + slug, entry !== null);
  if (entry !== null) {
    check('  ready is true', entry.ready === true);
    check('  score >= 8', typeof entry.score === 'number' && entry.score >= 8);

    const urlState = entry.urlState;
    check('  urlState declared',
      typeof urlState === 'object' && urlState !== null);
    if (urlState) {
      check('    urlState.encode non-empty',
        Array.isArray(urlState.encode) && urlState.encode.length > 0);
      check('    urlState.decode non-empty',
        Array.isArray(urlState.decode) && urlState.decode.length > 0);
    }

    const hk = entry['history-keys'] || entry.historyKeys;
    check('  history-keys declared',
      Array.isArray(hk) && hk.length > 0);

    const vs = entry['view-source'] || entry.viewSource;
    check('  view-source.path declared',
      typeof vs === 'object' && vs !== null && typeof vs.path === 'string');

    const emb = entry['embed-snippet'] || entry.embedSnippet;
    check('  embed-snippet declared',
      typeof emb === 'object' && emb !== null);

    check('  keywords array declared',
      Array.isArray(entry.keywords) && entry.keywords.length > 0);
    check('  pack array declared',
      Array.isArray(entry.pack) && entry.pack.length > 0);
    check('  icon declared',
      typeof entry.icon === 'string' && entry.icon.length > 0);
  }

  const toolHtml = path.join(TOOLS_DIR, slug, 'index.html');
  check('tools/' + slug + '/index.html exists', fs.existsSync(toolHtml));
  if (fs.existsSync(toolHtml)) {
    const html = fs.readFileSync(toolHtml, 'utf8');
    check('  index.html includes share.js script tag', hasScriptTag(html, 'share.js'));
    check('  index.html includes a11y.js script tag', hasScriptTag(html, 'a11y.js'));
    check('  index.html includes shell.js script tag', hasScriptTag(html, 'shell.js'));
    check('  index.html includes sample-data.js script tag', hasScriptTag(html, 'sample-data.js'));
    check('  index.html includes history.js script tag', hasScriptTag(html, 'history.js'));

    if (entry && entry.urlState) {
      const ids = collectHtmlIds(html);
      const enc = entry.urlState.encode || [];
      const dec = entry.urlState.decode || [];
      let allSelsResolve = true;
      const targets = [];
      enc.forEach(function (item) {
        if (item && typeof item.from === 'string') targets.push(item.from);
      });
      dec.forEach(function (item) {
        if (item && typeof item.to === 'string') targets.push(item.to);
      });
      targets.forEach(function (sel) {
        const bare = sel.charAt(0) === '#' ? sel.slice(1) : sel;
        if (!ids.has(bare)) allSelsResolve = false;
      });
      check('  all urlState encode/decode selectors resolve to HTML ids (' +
        targets.length + ' selectors checked)', allSelsResolve);
    }
  }

  const toolJs = path.join(TOOLS_DIR, slug, slug + '.js');
  check('tools/' + slug + '/' + slug + '.js exists', fs.existsSync(toolJs));
  if (fs.existsSync(toolJs)) {
    const stat = fs.statSync(toolJs);
    check('  tool JS non-empty (> 100 bytes)', stat.size > 100);
  }

  const toolCss = path.join(TOOLS_DIR, slug, slug + '.css');
  check('tools/' + slug + '/' + slug + '.css exists', fs.existsSync(toolCss));
  if (fs.existsSync(toolCss)) {
    const css = fs.readFileSync(toolCss, 'utf8');
    check('  CSS contains @media print (rubric #5 Printable)',
      /@media\s+print/i.test(css));
  }
});

// Vacuous-pass guard: a harness that ran zero assertions is a hollow run.
console.log('');
if (pass === 0 && fail === 0) {
  console.log('wave-3-smoke: vacuous-pass guard tripped (0 PASS, 0 FAIL) — exit 1');
  process.exit(1);
}

console.log('wave-3-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);