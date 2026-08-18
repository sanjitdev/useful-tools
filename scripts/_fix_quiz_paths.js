#!/usr/bin/env node
/* ============================================
   _fix_quiz_paths.js — fix the broken `../../`
   relative paths in all 10 Discovery quiz
   index.html files.

   Bug: each quiz page is at
     /tools/packs/discovery/<slug>/index.html
   but the pages used `../../assets/...` (which
   resolves to /tools/packs/assets/... — 404).
   The repo root is `/`, so to climb back we
   need FOUR `../`:
     <slug>/  →  discovery/  →  packs/  →  tools/  →  /

   Fix: rewrite any leading `(../){2,}` count in
   an href/src to exactly 4. Idempotent: once the
   file has `../../../../`, the replacement is a
   no-op (no leading `../{2,}` segments).

   Usage: `node scripts/_fix_quiz_paths.js [--check]`.
   ============================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CHECK_ONLY = process.argv.indexOf('--check') !== -1;

const SLUGS = [
  'spirit-animal',
  'future-partner',
  'what-would-you-do',
  'decision-style',
  'friend-match',
  'car-finder',
  'fortune-cookie',
  'time-traveler-therapist',
  'dream-job',
  'last-meal',
];

let wrote = 0, skipped = 0, failed = 0;

function fixQuizPaths(src) {
  // Rewrite any leading (../){2,} (i.e. >= 2 levels) in an href/src
  // attribute to exactly 4 levels. This catches:
  //   "../../"   (legacy, broken)            ->  "../../../../"
  //   "../../../" (over-corrected once)      ->  "../../../../"
  //   "../../../../" (correct)               ->  no change
  // (4-up has exactly 4 `../` segments, so it doesn't match
  // {2,})
  return src.replace(
    /((?:href|src)=")(\.\.\/){2,}/g,
    function (_match, attr) { return attr + '../../../../'; }
  );
}

function vmSanity(label, src) {
  if (/<link\s+[^>]*\bhref=""(?!\s|>)/i.test(src)) return 'empty href="" in <link>';
  if (/<script\s+[^>]*\bsrc=""(?!\s|>)/i.test(src)) return 'empty src="" in <script>';
  return null;
}

for (const slug of SLUGS) {
  const filePath = path.join(ROOT, 'tools/packs/discovery', slug, 'index.html');
  if (!fs.existsSync(filePath)) {
    console.log(`  MISSING  ${filePath}`);
    failed += 1;
    continue;
  }
  const before = fs.readFileSync(filePath, 'utf8');

  // Idempotency: compute the new state and compare. If nothing
  // changes, skip. (Once every href/src is 4-up, the regex doesn't
  // match and the file is byte-identical.)
  const after = fixQuizPaths(before);
  if (after === before) {
    skipped += 1;
    if (!CHECK_ONLY) console.log(`  SKIP     ${slug} already fixed`);
    continue;
  }

  const sanity = vmSanity(slug, after);
  if (sanity) {
    console.log(`  FAIL     ${slug}: ${sanity}`);
    failed += 1;
    continue;
  }

  if (CHECK_ONLY) {
    console.log(`  CHECK    ${slug} would fix ../ count → 4-up`);
    skipped += 1;
    continue;
  }

  fs.writeFileSync(filePath, after, 'utf8');
  console.log(`  WROTE    ${slug}`);
  wrote += 1;
}

console.log(`\nfix-quiz-paths: wrote=${wrote} skipped=${skipped} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
