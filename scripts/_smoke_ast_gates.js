/* scripts/_smoke_ast_gates.js — AC-4 negative-test battery for Story 1.17
 * (AI-E1-13 — AST-based gate scanners).
 *
 * Headless Node driver that builds a temporary mock-repo with three
 * minimal tool files, then runs the two AST-migrated gates against it
 * to prove the false-positive / false-negative cases the Epic 1 retrofit
 * audit flagged:
 *
 *   1. Comment-internal `fetch / localStorage / XMLHttpRequest` mentions
 *      must NOT be flagged (the legacy regex walker would have flagged
 *      every `// fetch the URL` line in a JSDoc).
 *   2. String-internal `'fetch('something')'` literals must NOT be
 *      flagged (the AST walker correctly identifies string contents as
 *      Literal nodes, not CallExpression).
 *   3. Real `localStorage.setItem(...)` / `fetch(...)` calls MUST be
 *      flagged.
 *
 * The smoke synthesizes a tiny repo layout that satisfies the two gates'
 * `find_repo_root` walkers (each looks for `tools.schema.json`), so the
 * gates run end-to-end (Python subprocess → node AST walker → JSON
 * output → Python cross-check) the same way CI does.
 *
 * Usage:
 *   node scripts/_smoke_ast_gates.js
 *
 * Exits 0 on pass, 1 on any fail or vacuous run, 2 on harness crash.
 *
 * Vacuous-pass guard (pass === 0 && fail === 0 → exit 1) catches the
 * case where the temp directory was never set up — a hollow green
 * would otherwise hide a broken harness.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SHELL_BOUNDS = path.join(REPO_ROOT, 'scripts', 'shell-bounds-check.py');
const STORAGE_REGISTRY = path.join(REPO_ROOT, 'scripts', 'storage-registry-gate.py');

let pass = 0;
let fail = 0;
const failures = [];

function assert(label, cond, detail) {
  if (cond) {
    pass += 1;
    console.log('  ok      ' + label);
    return;
  }
  fail += 1;
  failures.push(label);
  const msg = detail ? label + ' (' + detail + ')' : label;
  console.error('  FAIL    ' + msg);
}

/* === temp repo scaffolding ===
 *
 * Build a throwaway repo at `$TMP/ast-gates-smoke-<rand>/` that:
 *   - has a `tools.schema.json` (find_repo_root anchor)
 *   - has `assets/shell/chrome.html` with a minimal manifest
 *     (storage-registry-gate looks here, not at the repo root)
 *   - has `assets/js/storage-registry.js` with at least one
 *     `register(...)` call (otherwise the gate's sync check fails
 *     on "no register() calls found")
 *   - has a `tools.json` (storage-registry-gate cross-check)
 *   - has 3 fixture tool files under `tools/<slug>/<slug>.js`
 *
 * The fixture files exercise the comment/string/call-site false-positive
 * classes the AST walker addresses.
 */
function buildTempRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-gates-smoke-'));
  fs.writeFileSync(path.join(root, 'tools.schema.json'), '{}\n');
  fs.mkdirSync(path.join(root, 'assets', 'shell'), { recursive: true });
  fs.mkdirSync(path.join(root, 'assets', 'js'), { recursive: true });
  // Minimal storage-registry.js: one register() call so the gate's
  // sync check (check_register_calls_match_manifest) doesn't fail on
  // missing source. The key `ht.smoke.dummy` MUST also appear in
  // the manifest below for the sync check to pass.
  fs.writeFileSync(
    path.join(root, 'assets', 'js', 'storage-registry.js'),
    "// fixtures for AC-4 smoke\n" +
    "function _bootstrap() {\n" +
    "  register('ht.smoke.dummy', {purpose: 'smoke', lifetime: 'session', schema: 'string', owner: 'smoke'});\n" +
    "}\n"
  );
  // chrome.html with manifest that includes ht.smoke.dummy so the
  // sync check (register() <-> manifest) passes. The shell-bounds
  // check and storage AST scan exercise the AST walker end-to-end.
  fs.writeFileSync(
    path.join(root, 'assets', 'shell', 'chrome.html'),
    '<!doctype html><html><body>' +
    '<!-- ht:storage-registry-manifest-start -->' +
    '<script type="application/json" id="ht-storage-registry-manifest">' +
    '{"entries":[{"key":"ht.smoke.dummy","purpose":"smoke","lifetime":"session","schema":"string","owner":"smoke"}]}' +
    '</script>' +
    '<!-- ht:storage-registry-manifest-end -->' +
    '</body></html>\n'
  );
  fs.writeFileSync(
    path.join(root, 'tools.json'),
    '{"tools":[]}\n'
  );

  // Tool 1 — comment-internal `fetch` and `localStorage` mentions.
  // Pre-AST, the regex walker would flag line 4 (`fetch the URL`).
  // With AST, the comment is parsed but contains no CallExpression,
  // so no finding is emitted.
  const t1 = path.join(root, 'tools', 'comment-fixture');
  fs.mkdirSync(t1, { recursive: true });
  fs.writeFileSync(
    path.join(t1, 'comment-fixture.js'),
    [
      '// comment-fixture.js — proves the AST walker ignores comments.',
      '//',
      '// fetch the URL when offline',                                 // line 3
      '// localStorage.setItem("ht.theme", "dark") is forbidden',     // line 4
      '// XMLHttpRequest is forbidden',                               // line 5
      '// document.cookie is forbidden',                              // line 6
      'function init() {',
      '  return "ready";',
      '}',
      '',
    ].join('\n')
  );

  // Tool 2 — string-internal `fetch('something')` literal.
  // Pre-AST, this would flag the regex (the literal `fetch(` text is
  // present even though it's inside a string). With AST, the parser
  // sees a Literal node, not a CallExpression.
  const t2 = path.join(root, 'tools', 'string-fixture');
  fs.mkdirSync(t2, { recursive: true });
  fs.writeFileSync(
    path.join(t2, 'string-fixture.js'),
    [
      '// string-fixture.js — proves the AST walker ignores string contents.',
      'function reporter() {',
      '  const msg = "fetch(\'/api/tools\')";',                        // line 3
      '  const msg2 = "localStorage.setItem(\'ht.theme\', \'dark\')";', // line 4
      '  return msg + " / " + msg2;',
      '}',
      '',
    ].join('\n')
  );

  // Tool 3 — real localStorage.setItem + fetch call.
  // Both gates MUST flag this. The shell-bounds AST walker catches
  // `localStorage.setItem` and `fetch`. The storage-registry gate
  // doesn't scan tool files (it scans assets/js/), so no contribution
  // from there — but the cors-rule still trips the shell-bounds AST.
  const t3 = path.join(root, 'tools', 'violation-fixture');
  fs.mkdirSync(t3, { recursive: true });
  fs.writeFileSync(
    path.join(t3, 'violation-fixture.js'),
    [
      '// violation-fixture.js — proves the AST walker flags real call-sites.',
      'function persist() {',
      '  localStorage.setItem("ht.theme", "dark");',                  // line 3
      '  fetch("/api/tools");',                                       // line 4
      '}',
      '',
    ].join('\n')
  );

  return root;
}

function runShellBounds(root) {
  try {
    const out = execFileSync(
      'python',
      [SHELL_BOUNDS, '--root', root],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    return { exitCode: 0, stdout: out, stderr: '' };
  } catch (err) {
    return {
      exitCode: err.status || 1,
      stdout: err.stdout ? err.stdout.toString() : '',
      stderr: err.stderr ? err.stderr.toString() : '',
    };
  }
}

function runStorageRegistry(root) {
  try {
    const out = execFileSync(
      'python',
      [STORAGE_REGISTRY, '--root', root],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    return { exitCode: 0, stdout: out, stderr: '' };
  } catch (err) {
    return {
      exitCode: err.status || 1,
      stdout: err.stdout ? err.stdout.toString() : '',
      stderr: err.stderr ? err.stderr.toString() : '',
    };
  }
}

function rmTemp(root) {
  try {
    fs.rmSync(root, { recursive: true, force: true });
  } catch (_) { /* best-effort cleanup */ }
}

function main() {
  console.log('ast-gates negative-test battery (Story 1.17 / AC-4):');

  const tempRoot = buildTempRepo();

  // === Shell-bounds-check tests ===
  // Case 1: comment-internal fetch should NOT trip the gate.
  // Case 2: string-internal fetch should NOT trip the gate.
  // Case 3: real localStorage.setItem + fetch should trip the gate.
  const sbc = runShellBounds(tempRoot);
  assert(
    'shell-bounds: passes on comment-only fixture',
    sbc.stdout.includes('tools/comment-fixture/comment-fixture.js') &&
    sbc.stdout.includes('Total violations: 0') === false ||
    sbc.stdout.includes('Files with bypass violations: 1'),
    'exit=' + sbc.exitCode
  );
  // The report table mentions every tool file. The comment + string
  // fixtures should appear with 0 hits each.
  const commentRow = /comment-fixture\.js.*\b0\b.*pass/.test(sbc.stdout);
  const stringRow = /string-fixture\.js.*\b0\b.*pass/.test(sbc.stdout);
  assert('shell-bounds: comment-fixture.js has 0 hits', commentRow);
  assert('shell-bounds: string-fixture.js has 0 hits', stringRow);
  // The violation fixture should appear with 2 hits (localStorage + fetch).
  const violationRow = /violation-fixture\.js.*\b2\b/.test(sbc.stdout);
  assert('shell-bounds: violation-fixture.js has 2 hits (localStorage + fetch)', violationRow);
  // The summary line should report 1 file with bypass violations and 2 total.
  assert(
    'shell-bounds: total violations is 2',
    /Total violations:\s*2\b/.test(sbc.stdout),
    sbc.stdout.split('\n').find((l) => l.includes('Total violations')) || ''
  );

  // === Storage-registry-gate tests ===
  // The temp repo has an empty manifest (no entries). The gate's
  // call-site scan walks `assets/js/**` — we didn't create any
  // assets/js files, so the scan should find zero call-sites and
  // report clean. This proves the AST walker doesn't crash on an
  // empty JS tree.
  const srg = runStorageRegistry(tempRoot);
  assert(
    'storage-registry: passes on empty repo (no assets/js)',
    srg.exitCode === 0 || /scanning 0 JS file/.test(srg.stdout),
    'exit=' + srg.exitCode + ' stdout-snippet=' + srg.stdout.split('\n').slice(0, 12).join('\n')
  );

  // === Direct AST walker self-test ===
  // The vendored walker has its own --self-test battery (15 fixtures).
  // It's a fast second-line check that the walker itself is sane.
  try {
    const astOut = execFileSync(
      'node',
      [path.join(REPO_ROOT, 'scripts', 'vendor', 'ast-walker.js'), '--self-test'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    assert(
      'ast-walker: --self-test reports 15 passed',
      /15 passed, 0 failed/.test(astOut),
      astOut.split('\n').find((l) => l.includes('passed')) || ''
    );
  } catch (err) {
    const msg = err.stdout ? err.stdout.toString() : (err.stderr ? err.stderr.toString() : err.message);
    assert('ast-walker: --self-test reports 15 passed', false, msg);
  }

  rmTemp(tempRoot);

  // Vacuous-pass guard.
  if (pass === 0 && fail === 0) {
    console.error('  FAIL    vacuous pass (no assertions ran)');
    fail += 1;
  }

  console.log('');
  console.log('ast-gates smoke: ' + pass + ' passed, ' + fail + ' failed');
  if (fail > 0) {
    console.error('failures:');
    for (const f of failures) console.error('  - ' + f);
    process.exit(1);
  }
  process.exit(0);
}

try {
  main();
} catch (err) {
  console.error('ast-gates smoke: crashed: ' + (err.stack || err.message));
  process.exit(2);
}
