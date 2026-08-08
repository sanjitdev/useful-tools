'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const src = fs.readFileSync(path.resolve(__dirname, '../assets/js/site-config.js'), 'utf8');
const ctx = vm.createContext({ window: {}, console });
vm.runInContext(src, ctx, { filename: 'site-config.js' });
const w = ctx.window;
const HT = w.HT;
const SITE = w.HT_SITE_CONFIG;

let pass = 0, fail = 0;
function check(name, ok, info) {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (info ? ' — ' + info : '')); }
}

check('HT exists', typeof HT === 'object');
check('HT_SITE_CONFIG exists', typeof SITE === 'object');
check('HT.siteConfig exists', typeof HT.siteConfig === 'object');
check('repoOwner sanjitdev', SITE.repoOwner === 'sanjitdev');
check('repoName useful-tools', SITE.repoName === 'useful-tools');
check('defaultBranch main', SITE.defaultBranch === 'main');
check('brand Handy Tools', SITE.brand === 'Handy Tools');
check('defaultLocale en', SITE.defaultLocale === 'en');
check('repoUrl derived',
  HT.siteConfig.repoUrl === 'https://github.com/sanjitdev/useful-tools',
  'got: ' + HT.siteConfig.repoUrl);
check('blobBase derived',
  HT.siteConfig.blobBase === 'https://github.com/sanjitdev/useful-tools/blob/main',
  'got: ' + HT.siteConfig.blobBase);
check('HT_SITE_CONFIG frozen', Object.isFrozen(SITE));
check('HT.siteConfig frozen', Object.isFrozen(HT.siteConfig));

// Mutation in strict mode must throw.
let threw = false;
try { HT.siteConfig.repoUrl = 'evil'; } catch (e) { threw = true; }
check('mutation throws (strict)', threw);
check('mutation did not take effect', HT.siteConfig.repoUrl === 'https://github.com/sanjitdev/useful-tools');

console.log('');
console.log('passed: ' + pass + ', failed: ' + fail);
// Vacuous-pass guard: zero assertions means the script ran nothing
// meaningful. Fail loudly so the CI pipeline (which only inspects the
// exit code) cannot green-light a hollow run.
if (pass === 0 && fail === 0) {
  console.error('smoke: vacuous run — zero assertions executed');
  process.exit(1);
}
process.exit(fail === 0 ? 0 : 1);
