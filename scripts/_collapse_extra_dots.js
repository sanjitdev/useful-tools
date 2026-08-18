#!/usr/bin/env node
/* ============================================
   _collapse_extra_dots.js — rollback the
   accidental over-correction in the pack pages.

   The first run of _fix_pack_paths.js turned
   `../` into `../../`. A second run with a
   buggy regex turned `../../` into `../../../`.
   Browsers clamp `/../` to `/` so the paths
   still work, but they're visually noisy.

   Collapse any leading `..` count > 2 in an
   href/src back down to exactly 2.
   ============================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CHECK_ONLY = process.argv.indexOf('--check') !== -1;

const PAGES = [
  'disc.html', 'travel.html', 'finance.html', 'study.html',
  'developer.html', 'household.html', 'fun.html',
];

let wrote = 0, skipped = 0, failed = 0;

function collapse(src) {
  // Any leading (../){3,} (3 or more `../`) in an href/src becomes
  // exactly `../../` (2). Idempotent: after collapse, regex doesn't
  // match.
  return src.replace(
    /((?:href|src)=")(?:\.\.\/){3,}/g,
    '$1../../'
  );
}

for (const page of PAGES) {
  const filePath = path.join(ROOT, 'packs', page);
  if (!fs.existsSync(filePath)) { failed += 1; continue; }
  const before = fs.readFileSync(filePath, 'utf8');
  const after = collapse(before);
  if (after === before) { skipped += 1; continue; }
  if (CHECK_ONLY) {
    console.log(`  CHECK    ${page} would collapse >2-up to 2-up`);
    continue;
  }
  fs.writeFileSync(filePath, after, 'utf8');
  console.log(`  WROTE    ${page}`);
  wrote += 1;
}

console.log(`\ncollapse-extra-dots: wrote=${wrote} skipped=${skipped} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
