/* scripts/_smoke_chrome_dom_walk.js — AC-6 negative + positive test battery
 * for Story 1.18 (AI-E1-15 — Chrome Equivalence DOM Walk).
 *
 * Headless Node driver that builds a temporary mock-repo with the
 * minimal chrome assets the gate needs, then runs the migrated
 * `scripts/shell-drift-check.py` against six fixture HTML pages:
 *
 *   1. tools/canonical/index.html   — every chrome subtree verbatim;
 *                                     expect ok (proves the DOM walk +
 *                                     per-page-kind rules + non-DOM
 *                                     checks (data-slug, slim Tier 1
 *                                     footer: site-config.js,
 *                                     storage-registry.js, utils.js,
 *                                     ht-lazy.js, shell-thin.js defer;
 *                                     Story 4 Phase 3 replaced the prior
 *                                     search.js anchor check since
 *                                     search.js is now a Tier 2 module)
 *                                     all pass).
 *   2. tools/missing-header/index.html — drops <header class="site-header">;
 *                                        expect drift naming `site-header`.
 *   3. tools/extra-inline-script/index.html — adds an extra <script>
 *                                             between header and main;
 *                                             expect ok (inline scripts
 *                                             are not chrome).
 *   4. tools/whitespace-drift/index.html — same chrome with extra blank
 *                                           lines + indent; expect ok
 *                                           (whitespace is normalized).
 *   5. tools/attr-drift/index.html — renames <a class="shell-brand"> to
 *                                   class="shell-brand-foo";
 *                                   expect drift naming class mismatch.
 *   6. quality.html — mirrors the real quality.html structure (root
 *                     page with `#top` brand href + print-only footer);
 *                     expect ok (exercises the root-page-kind path
 *                     AND avoids the home-only manifest/tools.json-inline
 *                     requirements by being kind=quality not home).
 *
 * Exits 0 on pass, 1 on any fail or vacuous run, 2 on harness crash.
 *
 * Vacuous-pass guard (pass === 0 && fail === 0 → exit 1) catches the
 * case where the temp directory was never set up — a hollow green
 * would otherwise hide a broken harness.
 *
 * Usage:
 *   node scripts/_smoke_chrome_dom_walk.js
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SHELL_DRIFT = path.join(REPO_ROOT, 'scripts', 'shell-drift-check.py');

let pass = 0;
let fail = 0;
const failures = [];
let lastTempRoot = null;

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

/* Extract the byte-substring regions from palette.html / settings.html
   / help.html. The chrome drift check verifies each fixture page contains
   these byte sequences verbatim (these are the chrome overlay mounts).
   For test purposes we copy the regions from the real repo files into
   the synthesized fixture pages. */
function extractShellRegion(htmlText) {
  const m = htmlText.match(
    /<!-- shell:(\w+) -->\s*([\s\S]*?)\s*<!-- \/shell:\1 -->/
  );
  if (!m) throw new Error('missing shell region in chrome source');
  return m[2];
}
const PALETTE_BYTES = extractShellRegion(
  fs.readFileSync(path.join(REPO_ROOT, 'assets', 'shell', 'palette.html'), 'utf8')
);
const SETTINGS_BYTES = extractShellRegion(
  fs.readFileSync(path.join(REPO_ROOT, 'assets', 'shell', 'settings.html'), 'utf8')
);
const HELP_BYTES = extractShellRegion(
  fs.readFileSync(path.join(REPO_ROOT, 'assets', 'shell', 'help.html'), 'utf8')
);

/* === Helpers ===

The chrome landmarks the gate looks for, in compact HTML. Each fixture
embeds one of these as its chrome region (between `<body>` and `</body>`)
verbatim, with page-specific attributes stamped in. The DOM walk's
normalization table handles brand-href variants, main aria-label, and
inline <script>/<style> content; whitespace is collapsed by the parser.
*/
const SKIP_HTML = '<a class="shell-skip" href="#main">Skip to main content</a>';
const HEADER_HTML =
  '<header class="site-header" role="banner" aria-label="Handy Tools">\n' +
  '  <div class="container">\n' +
  '    <a class="shell-brand" href="../../index.html">\n' +
  '      <span class="shell-brand-mark">H</span>\n' +
  '      <span>Handy Tools</span>\n' +
  '    </a>\n' +
  '  </div>\n' +
  '</header>';
const MAIN_HTML =
  '<main id="main" class="shell-main" aria-label="{page_label}" tabindex="-1">\n' +
  '  <a id="top"></a>\n' +
  '  {body}\n' +
  '</main>';
const PRINT_FOOTER_HTML =
  '<footer class="print-only print-footer" aria-hidden="true">\n' +
  '  <p class="print-url"><span class="print-url-label">URL:</span> <span class="print-url-value"></span></p>\n' +
  '  <p class="print-meta">Last updated: <time class="print-last-updated" datetime=""></time></p>\n' +
  '</footer>';
const PRINT_FOOTER_POPULATE_HTML =
  '<script class="print-footer-populate">(function(){try{}catch(_){}})();</script>';
const SITE_FOOTER_HTML =
  '<footer class="site-footer" role="contentinfo" aria-label="Site information">\n' +
  '  <div class="container">\n' +
  '    <nav class="shell-footer-nav" aria-label="Footer">\n' +
  '      <a href="/privacy">Privacy</a>\n' +
  '      <a href="/quality">Quality</a>\n' +
  '    </nav>\n' +
  '    <small class="shell-footer-copy">&copy; Handy Tools. Built with vanilla JS.</small>\n' +
  '  </div>\n' +
  '</footer>';

/* === temp repo scaffolding ===

Build a throwaway repo at `$TMP/chrome-dom-smoke-<rand>/` that:
  - has a `tools.schema.json` (find_repo_root anchor)
  - has `assets/shell/chrome.html` containing identical chrome landmarks
    so the gate's landmark extractors see real anchors (skip link, site
    header, main, print-footer, site-footer)
  - has `assets/shell/palette.html`, `assets/shell/settings.html`,
    `assets/shell/help.html` (byte-substring anchor files — content is
    arbitrary as long as it contains the shell:* region markers)
  - has the slim Tier 1 footer stubs (Story 4 Phase 3):
    `assets/js/site-config.js`, `assets/js/storage-registry.js`,
    `assets/js/utils.js`, `assets/js/ht-lazy.js`,
    `assets/js/shell-thin.js` (the script-tag anchors the gate
    substring-checks for; empty stubs are sufficient). The prior
    `assets/js/search.js` anchor was retired when search.js moved
    to a Tier 2 lazy module.
  - has `tools.json` (the inline tools.json block source; empty tools
    list is the minimal valid input)
*/
function copyFileSync(srcRel, dstRoot) {
  const src = path.join(REPO_ROOT, srcRel);
  const dst = path.join(dstRoot, srcRel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  return dst;
}

/* The chrome.html the gate scans is derived from the canonical chrome
html — we compose it from the same compact blocks so the gate's DOM
extractor sees a faithful chrome structure. The trailing
`ht:storage-registry-manifest` region is required by the gate's
load_manifest_bytes; for non-home fixture pages the manifest SHA is
not re-checked, so the contents of the region are not load-bearing. */
function chromeSourceHtml() {
  return (
    '<!-- shell:chrome -->\n' +
    '<!-- shell:palette -->\n' +
    PALETTE_BYTES + '\n' +
    '<!-- /shell:palette -->\n' +
    SKIP_HTML + '\n' +
    '<!-- shell:header -->\n' +
    HEADER_HTML + '\n' +
    '<!-- /shell:header -->\n' +
    MAIN_HTML.replace('{page_label}', 'canonical').replace('{body}', '<section>c</section>') + '\n' +
    '<!-- shell:print-footer -->\n' +
    PRINT_FOOTER_HTML + '\n' +
    PRINT_FOOTER_POPULATE_HTML + '\n' +
    '<!-- /shell:print-footer -->\n' +
    '<!-- shell:footer -->\n' +
    SITE_FOOTER_HTML + '\n' +
    '<!-- /shell:footer -->\n' +
    '<!-- shell:settings -->\n' +
    SETTINGS_BYTES + '\n' +
    '<!-- /shell:settings -->\n' +
    '<!-- shell:help -->\n' +
    HELP_BYTES + '\n' +
    '<!-- /shell:help -->\n' +
    '<!-- ht:storage-registry-manifest-start -->\n' +
    '<script type="application/json" id="ht-storage-registry-manifest">{"entries":[]}</script>\n' +
    '<!-- ht:storage-registry-manifest-end -->\n' +
    '<!-- /shell:chrome -->\n'
  );
}

function buildTempRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-dom-smoke-'));
  lastTempRoot = root;
  fs.writeFileSync(path.join(root, 'tools.schema.json'), '{}\n');

  fs.mkdirSync(path.join(root, 'assets', 'shell'), { recursive: true });
  fs.mkdirSync(path.join(root, 'assets', 'js'), { recursive: true });

  // === Chrome sources (chrome.html composed; palette/settings/help
  //     copied verbatim from real repo so byte-substring checks find
  //     real anchors — but the test pages don't reference them; the
  //     checks only run against the per-page chrome regions, not the
  //     overflow). ===
  fs.writeFileSync(path.join(root, 'assets', 'shell', 'chrome.html'), chromeSourceHtml());
  copyFileSync('assets/shell/palette.html', root);
  copyFileSync('assets/shell/settings.html', root);
  copyFileSync('assets/shell/help.html', root);

  fs.writeFileSync(path.join(root, 'assets', 'js', 'site-config.js'), '// smoke stub\n');
  fs.writeFileSync(path.join(root, 'assets', 'js', 'storage-registry.js'), '// smoke stub\n');
  fs.writeFileSync(path.join(root, 'assets', 'js', 'utils.js'), '// smoke stub\n');
  // Tier 1 (Story 4 Phase 3): the slim Tier 1 footer adds
  // ht-lazy.js + shell-thin.js. Keep stub files so the script-tag
  // anchors resolve when the drift detector measures them.
  fs.writeFileSync(path.join(root, 'assets', 'js', 'ht-lazy.js'), '// smoke stub\n');
  fs.writeFileSync(path.join(root, 'assets', 'js', 'shell-thin.js'), '// smoke stub\n');

  fs.writeFileSync(path.join(root, 'tools.json'), '{"tools":[]}\n');

  /* The fixture chrome is the compact form for each tool page
   * (kind=tool, brand href=../../index.html, page-label is the smoke
   * value). The DATA-SLUG attribute is stamped on <main> by the
   * fixture helper so each tool kind passes the data-slug check. The
   * palette/settings/help overlay bytes are embedded verbatim so the
   * byte-substring checks pass — these are chrome mounts the gate
   * expects every page to carry. */
  function fixtureChrome(slug, bodyContent) {
    // NOTE: chain `.replace()` calls inside parens so automatic
    // semicolon insertion can't truncate the chain mid-statement
    // (writing `... + '\n'\n.replace(...)` silently no-ops the third
    // replace — JS sees the `+ '\n'` as the end of an expression and
    // drops the `.replace()` call entirely).
    const mainWithSlug = (
      MAIN_HTML
        .replace('{page_label}', 'Smoke ' + slug)
        .replace('{body}', bodyContent || '<section id="body-' + slug + '">smoke</section>')
        .replace('<main id="main"', '<main id="main" data-slug="' + slug + '"')
    );
    return (
      '<!-- shell:palette -->\n' + PALETTE_BYTES + '\n<!-- /shell:palette -->\n' +
      SKIP_HTML + '\n' +
      HEADER_HTML + '\n' +
      mainWithSlug + '\n' +
      PRINT_FOOTER_HTML + '\n' +
      PRINT_FOOTER_POPULATE_HTML + '\n' +
      SITE_FOOTER_HTML + '\n' +
      '<!-- shell:settings -->\n' + SETTINGS_BYTES + '\n<!-- /shell:settings -->\n' +
      '<!-- shell:help -->\n' + HELP_BYTES + '\n<!-- /shell:help -->\n'
    );
  }

  /* Wrap an already-composed chrome region in the standard HTML
   * scaffolding (head, body, script tags). Use this when a fixture
   * needs to MUTATE the chrome (e.g. drop the header, rename a
   * class) — call `fixtureChrome` directly, mutate the result,
   * then pass it here. The simpler `fixtureHtml(slug)` path uses
   * `fixtureChrome` under the hood and is appropriate for fixtures
   * that don't mutate the chrome. */
  function wrapChrome(slug, chromeRegion) {
    // Slim Tier 1 footer (Story 4 Phase 3) — site-config +
    // storage-registry + utils + ht-lazy + shell-thin defer. The
    // chrome-drift detector requires these markers; the prior
    // search.js anchor check was retired when chrome moved to
    // slim Tier 1 (search.js now ships as a Tier 2 module via the
    // shell-thin.js Proxy stubs).
    return [
      '<!doctype html>',
      '<html lang="en">',
      '<head>',
      '  <meta charset="utf-8">',
      '  <title>' + slug + ' - Handy Tools</title>',
      '  <script src="../../assets/js/site-config.js"></script>',
      '  <script src="../../assets/js/storage-registry.js"></script>',
      '  <script src="../../assets/js/utils.js"></script>',
      '  <script src="../../assets/js/ht-lazy.js"></script>',
      '  <script src="../../assets/js/shell-thin.js" defer></script>',
      '</head>',
      '<body>',
      chromeRegion,
      '</body>',
      '</html>',
      '',
    ].join('\n');
  }

  function fixtureHtml(slug) {
    return wrapChrome(slug, fixtureChrome(slug));
  }

  // === Fixture 1: canonical pass (a tool page with the complete chrome) ===
  fs.mkdirSync(path.join(root, 'tools', 'canonical'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'tools', 'canonical', 'index.html'),
    fixtureHtml('canonical')
  );

  // === Fixture 2: missing header ===
  // Drop <header class="site-header"> and its content.
  const missingHeaderChrome = fixtureChrome('missing-header').replace(
    /<header class="site-header"[\s\S]*?<\/header>/,
    '<!-- header removed to test missing-landmark detection -->'
  );
  fs.mkdirSync(path.join(root, 'tools', 'missing-header'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'tools', 'missing-header', 'index.html'),
    wrapChrome('missing-header', missingHeaderChrome)
  );

  // === Fixture 3: extra inline script ===
  // The DOM walk anchors on header/main/footer; an extra <script>
  // between regions is page-specific and must NOT be flagged.
  const extraScriptChrome = fixtureChrome('extra-inline-script').replace(
    HEADER_HTML,
    HEADER_HTML + '\n<script>window.__smokeExtraInline = true;</script>'
  );
  fs.mkdirSync(path.join(root, 'tools', 'extra-inline-script'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'tools', 'extra-inline-script', 'index.html'),
    wrapChrome('extra-inline-script', extraScriptChrome)
  );

  // === Fixture 4: whitespace drift ===
  // Add blank lines + extra indentation; the comparator must ignore.
  const whitespaceChrome = fixtureChrome('whitespace-drift')
    .replace('<a class="shell-skip"', '\n\n\n\n  <a class="shell-skip"')
    .replace('</header>', '</header>\n\n\n\n\n\n');
  fs.mkdirSync(path.join(root, 'tools', 'whitespace-drift'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'tools', 'whitespace-drift', 'index.html'),
    wrapChrome('whitespace-drift', whitespaceChrome)
  );

  // === Fixture 5: attribute drift (rename shell-brand class) ===
  // The DOM walk should report an attr mismatch on the brand link.
  const attrDriftChrome = fixtureChrome('attr-drift').replace(
    'class="shell-brand"',
    'class="shell-brand-foo"'
  );
  fs.mkdirSync(path.join(root, 'tools', 'attr-drift'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'tools', 'attr-drift', 'index.html'),
    wrapChrome('attr-drift', attrDriftChrome)
  );

  // === Fixture 6: quality (root page, brand href="#top", kind=quality) ===
  // Quality pages don't carry the home-only manifest / tools.json-inline
  // (those are index.html-only). The brand href normalizes to __BRAND_HREF__
  // via normalize_brand_href. The print-footer is REQUIRED on quality kind.
  const qualityChrome = (
    '<!-- shell:palette -->\n' + PALETTE_BYTES + '\n<!-- /shell:palette -->\n' +
    SKIP_HTML + '\n' +
    HEADER_HTML.replace('href="../../index.html"', 'href="#top"') + '\n' +
    MAIN_HTML
      .replace('{page_label}', 'Quality scorecard smoke')
      .replace('{body}', '<section id="q">smoke</section>') + '\n' +
    PRINT_FOOTER_HTML + '\n' +
    PRINT_FOOTER_POPULATE_HTML + '\n' +
    SITE_FOOTER_HTML + '\n' +
    '<!-- shell:settings -->\n' + SETTINGS_BYTES + '\n<!-- /shell:settings -->\n' +
    '<!-- shell:help -->\n' + HELP_BYTES + '\n<!-- /shell:help -->\n'
  );
  fs.writeFileSync(
    path.join(root, 'quality.html'),
    [
      '<!doctype html>',
      '<html lang="en">',
      '<head>',
      '  <meta charset="utf-8">',
      '  <title>Quality - Handy Tools</title>',
      // Slim Tier 1 footer (Story 4 Phase 3): quality.html is a
      // root-level page so paths are root-relative.
      '  <script src="assets/js/site-config.js"></script>',
      '  <script src="assets/js/storage-registry.js"></script>',
      '  <script src="assets/js/utils.js"></script>',
      '  <script src="assets/js/ht-lazy.js"></script>',
      '  <script src="assets/js/shell-thin.js" defer></script>',
      '</head>',
      '<body>',
      qualityChrome,
      '</body>',
      '</html>',
      '',
    ].join('\n')
  );

  return root;
}

function runShellDrift(root) {
  try {
    const out = execFileSync(
      'python',
      [SHELL_DRIFT, '--root', root],
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

function okLine(stdout, rel) {
  // The gate writes one "  ok      <rel>" line per passing page. Path
  // separators on Windows show as backslash in stdout but the gate's
  // scan iter uses relative_to(root).as_posix() only in the JSON diff
  // report — stdout uses whatever path appears in `iter_target_files`,
  // which is a Path. On Windows that renders with backslashes.
  const escaped = rel.replace(/\//g, '[\\\\/]');
  const re = new RegExp('^  ok\\s+' + escaped + '$', 'm');
  return re.test(stdout);
}

function driftLine(stderr, rel) {
  const allOutput = stderr + '\n' + rel; // ensure trailing newline
  const escaped = rel.replace(/\//g, '[\\\\/]');
  const re = new RegExp('CHROME DRIFT:\\s+' + escaped);
  return re.test(allOutput);
}

function main() {
  console.log('chrome-dom walk smoke (Story 1.18 / AC-6):');

  const tempRoot = buildTempRepo();

  const result = runShellDrift(tempRoot);

  // If anything drifted, surface the gate's stdout + stderr + the
  // diff report so a developer can diagnose a failing fixture without
  // re-running with extra logging.
  const diffReportPath = path.join(tempRoot, '.chrome-dom-diff.json');
  let diffReport = null;
  try {
    diffReport = JSON.parse(fs.readFileSync(diffReportPath, 'utf8'));
  } catch (_) { /* leave null */ }
  if (diffReport) {
    console.log('--- shell-drift stdout ---\n' + result.stdout);
    if (result.stderr) {
      console.error('--- shell-drift stderr ---\n' + result.stderr);
    }
    console.log('--- diff report ---');
    console.log(JSON.stringify(diffReport, null, 2));
  }

  // === Fixture 1: canonical pass ===
  assert(
    'canonical-fixture: tools/canonical/index.html reports ok',
    okLine(result.stdout, 'tools/canonical/index.html'),
    'gate did not report ok for tools/canonical/index.html'
  );

  // === Fixture 2: missing header ===
  assert(
    'missing-header-fixture: drift detected',
    /CHROME DRIFT: tools[\\\\/]missing-header[\\\\/]index\.html/.test(result.stderr),
    'gate did not report CHROME DRIFT for tools/missing-header/index.html'
  );
  // Diff report: must name site-header region with missing_landmark kind.
  // (diffReport was loaded once at the top of main() and dumped to stdout
  //  for diagnostics if any fixture failed.)
  const missingHeaderEntry = diffReport && diffReport.files &&
    diffReport.files.find((f) => /missing-header/.test(f.path));
  assert(
    'missing-header-fixture: diff report names site-header missing_landmark',
    missingHeaderEntry && missingHeaderEntry.drift.some((d) =>
      d.region === 'site-header' && d.kind === 'missing_landmark'
    ),
    'diff report missing site-header missing_landmark'
  );

  // === Fixture 3: extra inline script ===
  assert(
    'extra-inline-script: page reports ok (inline script is not chrome)',
    okLine(result.stdout, 'tools/extra-inline-script/index.html'),
    'gate did not report ok for tools/extra-inline-script/index.html'
  );

  // === Fixture 4: whitespace drift ===
  assert(
    'whitespace-drift: page reports ok (whitespace normalized)',
    okLine(result.stdout, 'tools/whitespace-drift/index.html'),
    'gate did not report ok for tools/whitespace-drift/index.html'
  );

  // === Fixture 5: attribute drift ===
  assert(
    'attr-drift: drift detected',
    /CHROME DRIFT: tools[\\\\/]attr-drift[\\\\/]index\.html/.test(result.stderr),
    'gate did not report CHROME DRIFT for tools/attr-drift/index.html'
  );
  const attrDriftEntry = diffReport && diffReport.files &&
    diffReport.files.find((f) => /attr-drift/.test(f.path));
  assert(
    'attr-drift: diff report names class mismatch under site-header',
    attrDriftEntry && attrDriftEntry.drift.some((d) =>
      d.region === 'site-header' &&
      (d.kind === 'attr_value_mismatch' ||
       d.kind === 'missing_attr' ||
       d.kind === 'extra_attr')
    ),
    'diff report missing site-header attr mismatch'
  );

  // === Fixture 6: quality-fixture (root page with print-only footer) ===
  assert(
    'quality-fixture: quality.html reports ok',
    okLine(result.stdout, 'quality.html'),
    'gate did not report ok for quality.html'
  );

  rmTemp(tempRoot);

  // Vacuous-pass guard.
  if (pass === 0 && fail === 0) {
    console.error('  FAIL    vacuous pass (no assertions ran)');
    fail += 1;
  }

  console.log('');
  console.log('chrome-dom smoke: ' + pass + ' passed, ' + fail + ' failed');
  if (fail > 0) {
    console.error('failures:');
    for (const f of failures) console.error('  - ' + f);
    if (lastTempRoot) {
      console.error('temp dir preserved at: ' + lastTempRoot);
    }
    process.exit(1);
  }
  process.exit(0);
}

try {
  main();
} catch (err) {
  console.error('chrome-dom smoke: crashed: ' + (err.stack || err.message));
  process.exit(2);
}
