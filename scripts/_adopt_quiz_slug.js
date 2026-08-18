#!/usr/bin/env node
/* ============================================
   _adopt_quiz_slug.js — idempotent patcher for
   DC-13 AC (Story 10.12 closure round 2).

   The Story 10.12 challenge-receiver wiring block
   references `QUIZ_SLUG` as a top-level constant
   (`./compare.html?c=...` + `stashLocalAnswers(QUIZ_SLUG, ...)`).
   After the HT.results.render adoption (Story 10.10),
   some -core.js files lost their `var QUIZ_SLUG = '...';`
   declaration because the pre-10.10 roll-out script had
   inlined it. DC-13's gate checks for the literal substring
   `var QUIZ_SLUG = '<slug>'` in each -core.js. This
   patcher restores the declaration in the 6 quizzes that
   lack it.

   Idempotent: skips files that already declare QUIZ_SLUG.
   Usage: `node scripts/_adopt_quiz_slug.js` or
          `node scripts/_adopt_quiz_slug.js --check`.
   ============================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// 6 quizzes that were authored before the Story 10.12
// receiver roll-out + ran through the Story 10.10 adoption
// without declaring QUIZ_SLUG at the top level.
const TARGETS = [
  'spirit-animal',
  'future-partner',
  'what-would-you-do',
  'decision-style',
  'friend-match',
  'car-finder',
];

const CHECK_ONLY = process.argv.indexOf('--check') !== -1;

let wrote = 0;
let skipped = 0;
let failed = 0;

function vmValidate(slug, src) {
  // Verify the file still parses.
  // Use a quick require-cache-free eval via vm.Script.runInNewContext
  // is heavy; instead we wrap into a Function constructor wrapped in
  // a try/catch.
  try {
    // The IIFE shape is (function () { 'use strict'; ... })();
    // Wrapping in { } + appending `;` makes it a valid expression
    // statement.
    new Function(src);
    return true;
  } catch (e) {
    console.error(`  PARSE FAIL  ${slug}-core.js: ${e.message.split('\n')[0]}`);
    return false;
  }
}

for (const slug of TARGETS) {
  const corePath = path.join(ROOT, 'tools/packs/discovery', slug, `${slug}-core.js`);
  if (!fs.existsSync(corePath)) {
    console.error(`  MISSING  ${corePath}`);
    failed += 1;
    continue;
  }
  let src = fs.readFileSync(corePath, 'utf8');

  if (src.indexOf(`var QUIZ_SLUG = '${slug}'`) !== -1) {
    skipped += 1;
    if (!CHECK_ONLY) console.log(`  SKIP     ${slug} already declares QUIZ_SLUG`);
    continue;
  }

  // Inject `var QUIZ_SLUG = '<slug>';` as the first statement inside
  // `function boot() {`. This keeps the constant scoped to boot()
  // (matches the canonical pattern in last-meal, fortune-cookie,
  // time-traveler-therapist, dream-job).
  const bootMarker = 'function boot() {';
  const idx = src.indexOf(bootMarker);
  if (idx === -1) {
    console.error(`  FAIL     ${slug}: 'function boot() {' not found`);
    failed += 1;
    continue;
  }
  // Inject immediately after the function opener, before `var mount`.
  const injectAt = idx + bootMarker.length;
  const decl = `\n    var QUIZ_SLUG = '${slug}';\n`;
  const newSrc = src.slice(0, injectAt) + decl + src.slice(injectAt);

  if (!vmValidate(slug, newSrc)) {
    failed += 1;
    continue;
  }

  if (CHECK_ONLY) {
    console.log(`  CHECK    ${slug} would inject var QUIZ_SLUG = '${slug}'`);
    skipped += 1;
    continue;
  }

  fs.writeFileSync(corePath, newSrc, 'utf8');
  console.log(`  WROTE    ${slug}`);
  wrote += 1;
}

console.log(`\nadopt-quiz-slug: wrote=${wrote} skipped=${skipped} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
