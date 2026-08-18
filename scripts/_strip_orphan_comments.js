#!/usr/bin/env node
/* ============================================
   _strip_orphan_comments.js — idempotent cleanup
   for the Story 10.10 audit. Removes three
   orphan comments that the audit caught:

   1. `// Animate trait bars after rendering completes.`
      in 5 -core.js files (left over from the
      `function animateBars(...)` strip).
   2. `/* Actions row. *​/` in 5 <slug>.css files
      (left over from the `.disc-actions` rule strip).
   3. `// ----- Reveal panel -----` banner blocks
      in -core.js files (the section that
      contained renderReveal + animateBars is now
      a single block; the banner is redundant).

   Idempotent: skips files that don't carry the
   literal phrase. Run with --check for read-only.
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

// Patterns to strip.
// Each pattern is the literal comment line(s) the audit caught.
const CORE_PATTERNS = [
  /\n[ \t]*\/\/[^\n]*Animate trait bars after rendering completes\.[^\n]*\n/g,
];

// CSS comment: `/* Actions row. */` — possibly with trailing whitespace.
const CSS_PATTERNS = [
  /\n[ \t]*\/\*[^*]*Actions row\.[^*]*\*\/[^\n]*\n/g,
];

function stripPatterns(src, patterns) {
  let out = src;
  for (const p of patterns) out = out.replace(p, '\n');
  return out;
}

function vmCheck(src, label) {
  try { new Function(src); return true; }
  catch (e) {
    console.error(`  PARSE FAIL  ${label}: ${e.message.split('\n')[0]}`);
    return false;
  }
}

let wrote = 0, skipped = 0, failed = 0;

for (const slug of SLUGS) {
  const corePath = path.join(ROOT, 'tools/packs/discovery', slug, `${slug}-core.js`);
  const cssPath = path.join(ROOT, 'tools/packs/discovery', slug, `${slug}.css`);

  if (fs.existsSync(corePath)) {
    let src = fs.readFileSync(corePath, 'utf8');
    const before = src;
    src = stripPatterns(src, CORE_PATTERNS);
    if (src !== before) {
      if (!vmCheck(src, `${slug}-core.js`)) { failed += 1; continue; }
      if (CHECK_ONLY) {
        console.log(`  CHECK   ${slug}-core.js would strip orphan comments`);
      } else {
        fs.writeFileSync(corePath, src, 'utf8');
        console.log(`  WROTE   ${slug}-core.js`);
      }
      wrote += 1;
    } else {
      skipped += 1;
    }
  }

  if (fs.existsSync(cssPath)) {
    let src = fs.readFileSync(cssPath, 'utf8');
    const before = src;
    src = stripPatterns(src, CSS_PATTERNS);
    if (src !== before) {
      if (CHECK_ONLY) {
        console.log(`  CHECK   ${slug}.css would strip orphan comments`);
      } else {
        fs.writeFileSync(cssPath, src, 'utf8');
        console.log(`  WROTE   ${slug}.css`);
      }
      wrote += 1;
    } else {
      skipped += 1;
    }
  }
}

console.log(`\nstrip-orphan-comments: wrote=${wrote} skipped=${skipped} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
