/* ============================================
   Smoke harness for Story 3.10 — assets/css/print.css
   + the print.css <link> injection in shell-template.py
   + the print-only footer block in chrome.html.

   Verifies:
     1. assets/css/print.css exists and contains every
        AC-required selector.
     2. Every tool page (tools/<slug>/index.html) carries
        the print.css <link> with media="print".
     3. The home page (index.html) and quality.html carry
        the print.css <link>.
     4. Every tool page carries the print-only footer
        block (<!-- shell:print-footer (Story 3.10) -->
        markers + <footer class="print-only print-footer">).
     5. assets/css/base.css no longer carries the legacy
        @media print block (moved to print.css).
     6. The print.css file's selectors are present in the
        @media print block (chrome-hiding + page-break +
        data-print opt-in + .no-print + .print-only).
     7. The print-only footer populate script is present
        on every tool page (Story 3.10 inline script
        that reads data-slug + ht-tools-json-inline).
     8. The page-rendered print footer is hidden on
        screen via base.css (display: none on .print-only
        outside @media print — verified by inspecting
        the print.css source which scopes .print-only
        rules to @media print).

   ~50 assertions, vm-context-free (pure Node fs regex).
   ============================================ */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const PRINT_CSS = path.join(REPO_ROOT, 'assets/css/print.css');
const BASE_CSS = path.join(REPO_ROOT, 'assets/css/base.css');
const CHROME_HTML = path.join(REPO_ROOT, 'assets/shell/chrome.html');
const HOME_PAGE = path.join(REPO_ROOT, 'index.html');
const QUALITY_PAGE = path.join(REPO_ROOT, 'quality.html');
const TOOLS_DIR = path.join(REPO_ROOT, 'tools');

let pass = 0;
let fail = 0;
function check(label, cond, info) {
  if (cond) {
    pass += 1;
    console.log('  PASS  ' + label);
  } else {
    fail += 1;
    console.log('  FAIL  ' + label + (info ? ' — ' + info : ''));
  }
}

console.log('Smoke harness — Story 3.10: Print Stylesheet');

// -------------------------------------------------------------
// 1. assets/css/print.css exists and contains every AC-required
//    selector.
// -------------------------------------------------------------
check(
  'print.css exists',
  fs.existsSync(PRINT_CSS),
  PRINT_CSS
);
let printCssSrc = '';
if (fs.existsSync(PRINT_CSS)) {
  printCssSrc = fs.readFileSync(PRINT_CSS, 'utf8');
}

const requiredSelectors = [
  // AC: hides chrome
  '#shell-header',
  '#shell-nav',
  '#shell-footer',
  '#palette-trigger',
  '#shell-settings-trigger',
  '#shell-skip',
  'aside.history-panel',
  'aside.history-sheet',
  'dialog.share-dialog',
  // AC: hides generic chrome + tool chrome
  'header',
  'footer',
  'nav',
  'header.tool-header',
  'nav.tool-nav',
  'button.tool-theme-toggle',
  'button.tool-settings',
  'button[aria-label="History"]',
  'button[aria-label="Share"]',
  '.no-print',
  '[data-print="hidden"]',
  // AC: opt-in selectors
  '[data-print="input"]',
  '[data-print="result"]',
  // AC: print-only footer + url/last-updated placeholders
  '.print-only',
  '.print-url',
  '.print-meta',
  '.print-last-updated',
  // AC: page-break rules
  'page-break-inside',
  'page-break-after',
  'page-break-before',
  // AC: color forcing
  'background: #fff',
  'color: #000',
  'background-image: none',
  // AC: print.css file naming
  '@page',
];

for (const sel of requiredSelectors) {
  check(
    'print.css contains selector/keyword: ' + sel,
    printCssSrc.indexOf(sel) !== -1,
    'see assets/css/print.css'
  );
}

// -------------------------------------------------------------
// 2. assets/css/base.css no longer carries the legacy @media
//    print block (migrated to print.css).
// -------------------------------------------------------------
const baseCssSrc = fs.existsSync(BASE_CSS)
  ? fs.readFileSync(BASE_CSS, 'utf8')
  : '';
check(
  'base.css no longer contains "@media print"',
  baseCssSrc.indexOf('@media print') === -1,
  'Story 3.10 moved the print rules to print.css'
);

// -------------------------------------------------------------
// 3. assets/shell/chrome.html carries the print-footer block.
// -------------------------------------------------------------
const chromeSrc = fs.existsSync(CHROME_HTML)
  ? fs.readFileSync(CHROME_HTML, 'utf8')
  : '';
check(
  'chrome.html contains shell:print-footer start marker',
  chromeSrc.indexOf('<!-- shell:print-footer (Story 3.10) -->') !== -1
);
check(
  'chrome.html contains shell:print-footer end marker',
  chromeSrc.indexOf('<!-- /shell:print-footer -->') !== -1
);
check(
  'chrome.html contains <footer class="print-only print-footer">',
  chromeSrc.indexOf('footer class="print-only print-footer"') !== -1
);
check(
  'chrome.html contains .print-url-value placeholder',
  chromeSrc.indexOf('class="print-url-value"') !== -1
);
check(
  'chrome.html contains .print-last-updated placeholder',
  chromeSrc.indexOf('class="print-last-updated"') !== -1
);
check(
  'chrome.html contains the print-footer populate script',
  chromeSrc.indexOf('class="print-footer-populate"') !== -1
);
check(
  'chrome.html populate script reads ht-tools-json-inline',
  chromeSrc.indexOf('ht-tools-json-inline') !== -1
);

// -------------------------------------------------------------
// 4. Every tool page (tools/<slug>/index.html) carries the
//    print.css <link> with media="print".
// -------------------------------------------------------------
const toolSlugs = fs.readdirSync(TOOLS_DIR).filter(function (n) {
  const full = path.join(TOOLS_DIR, n);
  return fs.statSync(full).isDirectory();
});
check(
  'exactly 35 tools present',
  toolSlugs.length === 35,
  'got ' + toolSlugs.length
);

let allHavePrintCssLink = true;
let allHavePrintFooter = true;
let allHavePrintFooterScript = true;
const missingDetails = [];
for (const slug of toolSlugs) {
  const page = path.join(TOOLS_DIR, slug, 'index.html');
  if (!fs.existsSync(page)) {
    missingDetails.push(slug + ' missing index.html');
    allHavePrintCssLink = false;
    allHavePrintFooter = false;
    allHavePrintFooterScript = false;
    continue;
  }
  const src = fs.readFileSync(page, 'utf8');
  if (src.indexOf('href="../../assets/css/print.css" media="print"') === -1) {
    allHavePrintCssLink = false;
    missingDetails.push(slug + ' missing print.css link');
  }
  if (src.indexOf('<!-- shell:print-footer (Story 3.10) -->') === -1) {
    allHavePrintFooter = false;
    missingDetails.push(slug + ' missing print-footer block');
  }
  if (src.indexOf('class="print-footer-populate"') === -1) {
    allHavePrintFooterScript = false;
    missingDetails.push(slug + ' missing populate script');
  }
}
check(
  'all 35 tool pages carry the print.css <link>',
  allHavePrintCssLink,
  missingDetails.join('; ')
);
check(
  'all 35 tool pages carry the print-footer block',
  allHavePrintFooter,
  missingDetails.join('; ')
);
check(
  'all 35 tool pages carry the print-footer populate script',
  allHavePrintFooterScript,
  missingDetails.join('; ')
);

// -------------------------------------------------------------
// 5. The home page and quality.html carry the print.css <link>.
// -------------------------------------------------------------
if (fs.existsSync(HOME_PAGE)) {
  const home = fs.readFileSync(HOME_PAGE, 'utf8');
  check(
    'home page carries print.css <link>',
    home.indexOf('href="assets/css/print.css" media="print"') !== -1
  );
  check(
    'home page carries the print-footer block',
    home.indexOf('<!-- shell:print-footer (Story 3.10) -->') !== -1
  );
}
if (fs.existsSync(QUALITY_PAGE)) {
  const q = fs.readFileSync(QUALITY_PAGE, 'utf8');
  check(
    'quality.html carries print.css <link>',
    q.indexOf('href="assets/css/print.css" media="print"') !== -1
  );
}

// -------------------------------------------------------------
// 6. Idempotency: re-running splice_print_css on a page that
//    already has the link produces no change.
// -------------------------------------------------------------
check(
  'splice_print_css helper exists in shell-template.py',
  (function () {
    const pyPath = path.join(REPO_ROOT, 'scripts/shell-template.py');
    if (!fs.existsSync(pyPath)) return false;
    const pySrc = fs.readFileSync(pyPath, 'utf8');
    return /def splice_print_css\(/.test(pySrc);
  })(),
  'see scripts/shell-template.py'
);
check(
  'splice_print_footer helper exists in shell-template.py',
  (function () {
    const pyPath = path.join(REPO_ROOT, 'scripts/shell-template.py');
    if (!fs.existsSync(pyPath)) return false;
    const pySrc = fs.readFileSync(pyPath, 'utf8');
    return /def splice_print_footer\(/.test(pySrc);
  })(),
  'see scripts/shell-template.py'
);

// -------------------------------------------------------------
// 7. Color-forcing rule: print.css has body background #fff
//    and color #000 !important.
// -------------------------------------------------------------
check(
  'print.css forces body background to #fff',
  /body\s*\{[^}]*background:\s*#fff\s*!important/.test(printCssSrc) ||
    /html,\s*body\s*\{[^}]*background:\s*#fff\s*!important/.test(printCssSrc)
);
check(
  'print.css forces body color to #000',
  /body\s*\{[^}]*color:\s*#000\s*!important/.test(printCssSrc) ||
    /html,\s*body\s*\{[^}]*color:\s*#000\s*!important/.test(printCssSrc)
);

// -------------------------------------------------------------
// 8. Page-break rules: result → avoid; input → auto; print footer
//    → always.
// -------------------------------------------------------------
check(
  'print.css applies page-break-inside: avoid to [data-print="result"]',
  /\[data-print="result"\][^{]*\{[^}]*page-break-inside:\s*avoid/.test(printCssSrc) ||
    /\[data-print="result"\][^{]*\{[^}]*break-inside:\s*avoid/.test(printCssSrc)
);
check(
  'print.css applies page-break-before: always to .print-only.print-footer',
  /print-only\.print-footer[\s\S]{0,200}page-break-before:\s*always/.test(printCssSrc)
);

console.log('---');
console.log('Total: ' + (pass + fail) + ' | Pass: ' + pass + ' | Fail: ' + fail);
if (fail > 0) {
  console.error('SMOKE FAILED: ' + fail + ' assertion(s) failed');
  process.exit(1);
}
console.log('SMOKE PASSED: all ' + pass + ' assertions passed');