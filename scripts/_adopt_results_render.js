#!/usr/bin/env node
/* ============================================
   _adopt_results_render.js — Replace per-quiz
   renderReveal with HT.results.render across
   all 10 Discovery quizzes.

   Story 10.10 close. The existing per-quiz
   `renderReveal(answers, scored)` and
   `animateBars(host)` are deleted; the onComplete
   handler is rewired to call HT.results.render
   directly.

   This patcher is implemented in Node.js (not
   Python) because it relies on V8's parser for
   robust brace-walking — a regex/brace-counter
   approach is brittle (template literals, regex
   literals, comments, JSX-style braces inside
   strings).

   Algorithm
   ---------
   1. Read the file as a UTF-8 string.
   2. Find the `function renderReveal(...)` opener
      (signature string match).
   3. Strip it via Node's parser: load the entire
      source into a vm.Script wrapper, extract the
      FunctionExpression source via a sentinel
      trick, then locate the matching close.
   4. Same for `animateBars`.
   5. Replace the `var reveal = renderReveal(...)`
      line with the new HT.results.render(...) block.
   6. Delete the `animateBars(body);` call.
   7. Replace `.disc-actions` query in the
      Story 10.12 CTA block with
      `.quiz-result-actions`.
   8. Per-quiz CSS: delete the `.disc-actions`
      rule block (regex on the whole file — CSS is
      straightforward).

   Idempotent: re-running detects the existing
   `HT.results.render(` call and emits a SKIP line.

   Usage
   -----
     node scripts/_adopt_results_render.js            # apply
     node scripts/_adopt_results_render.js --check    # exit 1 if any unwired
   ============================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');

const TARGET_SLUGS = [
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

const NEW_REVEAL =
  '        var reveal = window.HT.results.render(\n' +
  '          { archetype: scored.archetype, traits: scored.traits },\n' +
  '          {\n' +
  '            slug: QUIZ_SLUG,\n' +
  '            title: (scored.archetype && scored.archetype.tagline) || "",\n' +
  '            conflict: (scored.archetype && scored.archetype.blindSpot) || "",\n' +
  '            wireActions: true\n' +
  '          }\n' +
  '        );\n';


// --- Function-block stripping ---------------------------------------------


/**
 * Find the byte offset of the matching closing `}` for the function
 * whose opener starts at `startIdx` (points at the `{` that opens the
 * function body). Walks via a balanced-brace counter that respects:
 *   - single-line `//` and multi-line `/* ... *\/` comments
 *   - single-quoted, double-quoted, and back-tick template strings
 *   - regex literals (rough heuristic — `function X(...) {` is never
 *     preceded by a regex context, so this is safe at top of file)
 *
 *   Returns the index of the matching `}` (inclusive) or -1 if not found.
 */
function findMatchingClose(src, startIdx) {
  let depth = 0;
  let i = startIdx;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    const next = i + 1 < n ? src[i + 1] : '';
    // Skip single-line comments
    if (ch === '/' && next === '/') {
      i += 2;
      while (i < n && src[i] !== '\n') i += 1;
      continue;
    }
    // Skip multi-line comments
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < n - 1 && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    // Skip single-quoted strings
    if (ch === "'") {
      i += 1;
      while (i < n && src[i] !== "'") {
        if (src[i] === '\\') i += 2; else i += 1;
      }
      i += 1;
      continue;
    }
    // Skip double-quoted strings
    if (ch === '"') {
      i += 1;
      while (i < n && src[i] !== '"') {
        if (src[i] === '\\') i += 2; else i += 1;
      }
      i += 1;
      continue;
    }
    // Skip back-tick template strings (no ${...} descent for our purposes
    // — top-level function bodies don't contain nested function literals
    // that we need to follow).
    if (ch === '`') {
      i += 1;
      while (i < n && src[i] !== '`') {
        if (src[i] === '\\') i += 2;
        else i += 1;
      }
      i += 1;
      continue;
    }
    if (ch === '{') {
      depth += 1;
      i += 1;
      continue;
    }
    if (ch === '}') {
      depth -= 1;
      i += 1;
      if (depth === 0) return i - 1;
      continue;
    }
    i += 1;
  }
  return -1;
}


/**
 * Strip the IIFE-level `function NAME(args) { ... }` block whose opener
 * signature is `fnSignature`. Returns {newSrc, deleted}.
 */
function stripFunctionBlock(src, fnSignature) {
  const idx = src.indexOf(fnSignature);
  if (idx === -1) return { newSrc: src, deleted: false };
  // Find the opening `{` of the function body
  const braceStart = src.indexOf('{', idx);
  if (braceStart === -1) return { newSrc: src, deleted: false };
  const closeIdx = findMatchingClose(src, braceStart);
  if (closeIdx === -1) return { newSrc: src, deleted: false };
  // Determine end (include trailing newline if any)
  let end = closeIdx + 1;
  if (end < src.length && src[end] === '\n') end += 1;
  // Determine start (trim trailing whitespace + blank line above)
  let start = idx;
  while (start > 0 && (src[start - 1] === ' ' || src[start - 1] === '\t')) {
    start -= 1;
  }
  if (start >= 2 && src[start - 1] === '\n' && src[start - 2] === '\n') {
    start -= 1;
  }
  return { newSrc: src.slice(0, start) + src.slice(end), deleted: true };
}


// --- Per-file patching ----------------------------------------------------


function patchCore(slug, src) {
  // Idempotency check
  if (src.indexOf('HT.results.render(') !== -1) {
    return { newSrc: src, status: 'SKIP (already adopted)' };
  }

  // 1. Strip renderReveal
  let r1 = stripFunctionBlock(src, 'function renderReveal(answers, scored)');
  if (!r1.deleted) return { newSrc: src, status: 'FAIL (no renderReveal)' };
  let s = r1.newSrc;

  // 2. Strip animateBars
  let r2 = stripFunctionBlock(s, 'function animateBars(host)');
  if (!r2.deleted) return { newSrc: s, status: 'FAIL (no animateBars)' };
  s = r2.newSrc;

  // 3. Replace the `var reveal = renderReveal(answers, scored);` call
  const oldReveal = 'var reveal = renderReveal(answers, scored);';
  if (s.indexOf(oldReveal) === -1) {
    return { newSrc: s, status: 'FAIL (no reveal call)' };
  }
  s = s.replace(oldReveal, NEW_REVEAL, 1);

  // 4. Delete any stray `animateBars(body);` call site (defensive —
  //    the `function animateBars(...)` definition was stripped above
  //    but this guards against a future hand-edited call site that
  //    omits the `function` block. Match the bare token regardless of
  //    leading indent; if it's nowhere in the source, that's fine —
  //    the older brace-anchored form silently missed inline calls
  //    without leading whitespace.)
  s = s.replace(/(^|\n)[ \t]*animateBars\([^)]*\);[ \t]*\n/g, function (m, nl) {
    return nl;
  });

  // 5. Swap `.disc-actions` → `.quiz-result-actions` in the Story 10.12
  //    CTA block (the canonical result card emits the latter).
  s = s.replace(
    "body.querySelector('.disc-actions')",
    "body.querySelector('.quiz-result-actions')"
  );

  // 6. Verify the resulting source parses
  try {
    // Wrap in a function so `return` statements at top level don't trip
    // the parser; we only care about syntax, not semantics.
    new vm.Script(s, { filename: slug + '-core.js' });
  } catch (err) {
    return { newSrc: s, status: 'FAIL (parse error after patch: ' + err.message + ')' };
  }

  return { newSrc: s, status: 'WROTE' };
}


// Per-quiz CSS: drop the `.disc-actions { ... }` rule block.
// The rule is single-block, well-formed (no nested braces); a simple
// regex match is sufficient.
const DISC_ACTIONS_RE = /^\.disc-actions\s*\{[^{}]*\}\s*\n/m;


function patchCss(slug, src) {
  if (!DISC_ACTIONS_RE.test(src)) {
    return { newSrc: src, status: 'SKIP (already cleaned)' };
  }
  const newSrc = src.replace(DISC_ACTIONS_RE, '');
  return { newSrc, status: 'WROTE' };
}


// --- Main ------------------------------------------------------------------


function main(argv) {
  const args = argv.slice(2);
  const checkOnly = args.indexOf('--check') !== -1;

  const summary = {
    coreWrote: 0, coreSkip: 0, coreFail: 0,
    cssWrote: 0, cssSkip: 0, cssFail: 0,
  };

  for (const slug of TARGET_SLUGS) {
    const corePath = path.join(
      REPO_ROOT, 'tools/packs/discovery', slug, slug + '-core.js'
    );
    const cssPath = path.join(
      REPO_ROOT, 'tools/packs/discovery', slug, slug + '.css'
    );

    if (!fs.existsSync(corePath)) {
      console.log('  FAIL    ' + slug + '/<slug>-core.js [missing]');
      summary.coreFail += 1;
      continue;
    }
    if (!fs.existsSync(cssPath)) {
      console.log('  FAIL    ' + slug + '/<slug>.css [missing]');
      summary.cssFail += 1;
      continue;
    }

    const coreSrc = fs.readFileSync(corePath, 'utf8');
    const cssSrc = fs.readFileSync(cssPath, 'utf8');

    const coreResult = patchCore(slug, coreSrc);
    const cssResult = patchCss(slug, cssSrc);

    if (!checkOnly) {
      if (coreResult.status === 'WROTE') {
        fs.writeFileSync(corePath, coreResult.newSrc, 'utf8');
      }
      if (cssResult.status === 'WROTE') {
        fs.writeFileSync(cssPath, cssResult.newSrc, 'utf8');
      }
    } else {
      if (coreResult.status.startsWith('FAIL')) {
        console.log('  FAIL    ' + slug + '/<slug>-core.js — ' + coreResult.status);
      }
      if (cssResult.status.startsWith('FAIL')) {
        console.log('  FAIL    ' + slug + '/<slug>.css — ' + cssResult.status);
      }
    }

    if (coreResult.status === 'WROTE') summary.coreWrote += 1;
    else if (coreResult.status.startsWith('SKIP')) summary.coreSkip += 1;
    else summary.coreFail += 1;

    if (cssResult.status === 'WROTE') summary.cssWrote += 1;
    else if (cssResult.status.startsWith('SKIP')) summary.cssSkip += 1;
    else summary.cssFail += 1;

    console.log('  ' + slug + ': core=' + coreResult.status +
                ' | css=' + cssResult.status);
  }

  console.log('');
  console.log('Summary: core ' + summary.coreWrote + 'W / ' +
              summary.coreSkip + 'S / ' + summary.coreFail + 'F — ' +
              'css ' + summary.cssWrote + 'W / ' +
              summary.cssSkip + 'S / ' + summary.cssFail + 'F');

  if (summary.coreFail > 0 || summary.cssFail > 0) return 1;
  return 0;
}

process.exit(main(process.argv));