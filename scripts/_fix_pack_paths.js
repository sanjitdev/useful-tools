#!/usr/bin/env node
/* ============================================
   _fix_pack_paths.js — fix the broken `../`
   relative paths in all 7 pack pages
   (packs/{disc,travel,finance,study,developer,
   household,fun}.html).

   Bug: each pack page is at `/packs/<slug>.html`.
   To climb to the repo root (`/`), we need TWO
   `../`:
     /packs/<slug>.html  →  /packs/  →  /

   Fix: rewrite any leading single `../` in an
   href/src to `../../`. Idempotent: a file
   that's already `../../` is byte-identical
   after the rewrite.

   Usage: `node scripts/_fix_pack_paths.js [--check]`.
   ============================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CHECK_ONLY = process.argv.indexOf('--check') !== -1;

const PAGES = [
  'disc.html',
  'travel.html',
  'finance.html',
  'study.html',
  'developer.html',
  'household.html',
  'fun.html',
];

let wrote = 0, skipped = 0, failed = 0;

function fixPackPaths(src) {
  // Replace any leading EXACTLY ONE `../` (followed by a non-`/`
  // and not preceded by another `..`) with `../../`. Idempotent:
  // once it's `../../`, the regex doesn't match.
  //
  // We use a negative lookbehind on `\.{2}/` so we don't match
  // the SECOND `../` of `../../` (that would over-correct to
  // `../../../../`).
  return src.replace(
    /(?<![.\w/])((?:href|src)=")\.\.\/(?=[^.])/g,
    '$1../../'
  );
}

function vmSanity(label, src) {
  if (/<link\s+[^>]*\bhref=""(?!\s|>)/i.test(src)) return 'empty href="" in <link>';
  if (/<script\s+[^>]*\bsrc=""(?!\s|>)/i.test(src)) return 'empty src="" in <script>';
  return null;
}

for (const page of PAGES) {
  const filePath = path.join(ROOT, 'packs', page);
  if (!fs.existsSync(filePath)) {
    console.log(`  MISSING  ${filePath}`);
    failed += 1;
    continue;
  }
  const before = fs.readFileSync(filePath, 'utf8');

  const after = fixPackPaths(before);
  if (after === before) {
    skipped += 1;
    if (!CHECK_ONLY) console.log(`  SKIP     ${page} already fixed`);
    continue;
  }

  const sanity = vmSanity(page, after);
  if (sanity) {
    console.log(`  FAIL     ${page}: ${sanity}`);
    failed += 1;
    continue;
  }

  if (CHECK_ONLY) {
    console.log(`  CHECK    ${page} would fix ../ → ../../`);
    skipped += 1;
    continue;
  }

  fs.writeFileSync(filePath, after, 'utf8');
  console.log(`  WROTE    ${page}`);
  wrote += 1;
}

console.log(`\nfix-pack-paths: wrote=${wrote} skipped=${skipped} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
