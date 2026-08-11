// scripts/_resplice_chrome_pages.js — One-shot helper that re-splices the
// shell:settings / shell:palette / shell:help / shell:header / shell:footer
// regions from the canonical chrome sources into the non-tool pages
// (home, packs/*, /quality) that shell-template.py does not touch.
//
// Story 3.5: assets/shell/settings.html's content changed (7 live fields,
// not 3 + 3 disabled placeholders). The home/packs/quality pages carry a
// stale copy of the region; this script replaces only those regions,
// leaving the rest of each page byte-equivalent.
//
// Usage:
//   node scripts/_resplice_chrome_pages.js
//
// Idempotent — re-running produces no change on already-aligned pages.

'use strict';
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');

function read(p) { return fs.readFileSync(path.join(REPO, p), 'utf8'); }

// Build a regex matching <!-- shell:MARKER --> and <!-- /shell:MARKER -->
// where whitespace between components is permitted (mirrors the Python
// MARKER_RE pattern used by shell-template.py / shell-drift-check.py).
function startRe(marker) { return new RegExp('<!--[ \\t]*shell:' + marker + '[ \\t]*-->', 'g'); }
function endRe(marker)   { return new RegExp('<!--[ \\t]*/shell:' + marker + '[ \\t]*-->', 'g'); }

function extractRegion(source, marker) {
  const startRegex = startRe(marker);
  const startMatch = startRegex.exec(source);
  if (!startMatch) throw new Error('start marker not found for ' + marker);
  const endRegex = endRe(marker);
  endRegex.lastIndex = startRegex.lastIndex;
  const endMatch = endRegex.exec(source);
  if (!endMatch) throw new Error('end marker not found for ' + marker);
  return source.slice(startMatch.index, endMatch.index + endMatch[0].length);
}

// The canonical header in assets/shell/chrome.html uses relative paths
// suited for tools/<slug>/index.html (two levels deep). For non-tool pages
// (index.html, quality.html, packs/*.html) the header hrefs need rewriting
// so the brand link points at the actual root index.html, not up-and-out.
// This per-page rewrite runs on the HEADER region before it lands in each
// non-tool page.
function rewriteHeaderHrefs(header, pageDepth) {
  // pageDepth: 0 = root (index.html, quality.html), 1 = packs/*.html,
  //             2 = tools/<slug>/index.html (canonical, no rewrite).
  if (pageDepth === 2) return header;
  // chrome.html's href="../../index.html" must resolve relative to the
  // consuming page. At depth 1 (packs/) it should be "../index.html"; at
  // depth 0 (root) it should be "./index.html" (or "#top" — the root pages
  // historically use "#top" for the brand link to keep focus on the page
  // top after click). We rewrite to a depth-appropriate prefix.
  let prefix;
  if (pageDepth === 1) prefix = '../';
  else if (pageDepth === 0) prefix = '';
  else throw new Error('unknown pageDepth: ' + pageDepth);
  // Replace "../../index.html" and "../../<path>" with `${prefix}<path>`.
  // Also handles "tools/<slug>/..." etc. — we just collapse the leading
  // "../../" since all canonical chrome hrefs are repo-root-relative.
  return header.replace(/href="\.\.\/\.\.\//g, 'href="' + prefix);
}

function spliceRegion(pageText, marker, region) {
  const startRegex = startRe(marker);
  const startMatch = startRegex.exec(pageText);
  if (!startMatch) return { text: pageText, hit: false };
  const endRegex = endRe(marker);
  endRegex.lastIndex = startRegex.lastIndex;
  const endMatch = endRegex.exec(pageText);
  if (!endMatch) throw new Error('end marker missing for ' + marker + ' in page');
  const start = startMatch.index;
  const end = endMatch.index + endMatch[0].length;
  return {
    text: pageText.slice(0, start) + region + pageText.slice(end),
    hit: true,
  };
}

// Canonical chrome sources.
const HEADER = extractRegion(read('assets/shell/chrome.html'), 'header');
const FOOTER = extractRegion(read('assets/shell/chrome.html'), 'footer');
const PALETTE = extractRegion(read('assets/shell/palette.html'), 'palette');
const SETTINGS = extractRegion(read('assets/shell/settings.html'), 'settings');
const HELP = extractRegion(read('assets/shell/help.html'), 'help');

// Targets — non-tool pages that shell-template.py does not regenerate.
// For each target we attempt marker-based replacement (packs/* carry
// `<!-- shell:MARKER -->` markers; shell-template.py's `regenerate_home`
// and the historical /quality page edits may have stripped the markers —
// in which case we fall back to substring replacement of the canonical
// region content directly). Files where every replacement hit is a no-op
// are reported as "already aligned".
//
// Each entry is [relativePath, pageDepth] where pageDepth is consumed by
// rewriteHeaderHrefs() to fix up the canonical header's relative paths
// for the page's location in the repo tree:
//   - 0 = repo root (index.html, quality.html)
//   - 1 = packs/*.html (one level deep)
//   - 2 = tools/<slug>/index.html (canonical, no rewrite)
const TARGETS = [
  ['index.html', 0],
  ['packs/developer.html', 1],
  ['packs/finance.html', 1],
  ['packs/household.html', 1],
  ['packs/study.html', 1],
  ['packs/travel.html', 1],
  ['quality.html', 0],
];

const REGIONS = [
  ['header', HEADER],
  ['footer', FOOTER],
  ['palette', PALETTE],
  ['settings', SETTINGS],
  ['help', HELP],
];

let updated = 0;
for (const [target, depth] of TARGETS) {
  const fullPath = path.join(REPO, target);
  if (!fs.existsSync(fullPath)) {
    console.error('[skip] ' + target + ' does not exist');
    continue;
  }
  let text = fs.readFileSync(fullPath, 'utf8');
  const before = text;
  for (const [marker, region] of REGIONS) {
    // The header region from chrome.html is canonical for tools/*/index.html
    // (depth 2). For root pages (depth 0) and packs/* pages (depth 1) we
    // rewrite the header hrefs to be page-relative before splicing.
    const regionForPage = (marker === 'header') ? rewriteHeaderHrefs(region, depth) : region;
    const out = spliceRegion(text, marker, regionForPage);
    if (out.hit) {
      text = out.text;
      continue;
    }
    // No markers → fall back to substring replacement: search for the
    // OLD region content (extracted from the previous version's chrome)
    // and replace with the canonical region. We don't know the previous
    // bytes without keeping a copy, so instead we just look for the
    // unique `<div id="shell-settings-modal"` (settings), `<div id="palette"`
    // (palette), and similar anchors. For simplicity, if the canonical
    // region content is already a substring, the page is aligned; if
    // not, we leave a warning so the maintainer can hand-edit.
    //
    // This fallback is intentionally conservative: pages without markers
    // are rare (index.html, quality.html) and any drift there was caused
    // by hand-edits that the maintainer should review.
    if (text.indexOf(region) === -1) {
      console.warn('  [warn] ' + target + ' missing shell:' + marker + ' markers and canonical region not found as substring — manual edit required');
    }
  }
  if (text !== before) {
    fs.writeFileSync(fullPath, text);
    updated += 1;
    console.log('  respliced ' + target);
  } else {
    console.log('  already aligned ' + target);
  }
}

console.log('done (' + updated + ' page(s) updated, ' + TARGETS.length + ' scanned)');