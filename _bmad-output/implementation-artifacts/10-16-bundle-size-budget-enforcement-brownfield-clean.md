# Story 10.16 — Bundle-size budget enforcement + brownfield clean

**Slug:** `disc-bundle-size`
**Status:** backlog
**Date:** 2026-08-17
**Brainstorm:** `_bmad-output/brainstorming/brainstorm-discovery-engine-2026-08-17/`
**AC gate (working tree):** `scripts/dc/dc-11-bundle-size.py`

---

## Context

Per NFR-11 (Discovery Engine budget ≤ 50 KB gz per quiz, ≤ 80 KB for the entire pack), every Discovery Engine PR must verify the pack stays within budget and the home page is unaffected. The bundle-size workflow (Story X.3) is the precedent — extend it.

## Goal

Ship a per-quiz 8 KB + whole-pack 80 KB gz budget gate; assert the home page has zero Discovery Engine scripts; post the per-asset breakdown as a PR comment.

## Files added

| Path | Purpose |
|---|---|
| `scripts/_smoke_disc_bundle_size.js` | Per-asset gzipped-size computation; budget assertion; home-page script audit. |

## Files modified

| Path | Change |
|---|---|
| `scripts/bundle-size.py` (Story X.3) | Appended the Discovery Engine per-quiz + whole-pack budget assertions. |
| `.github/workflows/bundle-size.yml` | Posts the PR comment with the per-asset breakdown. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Story 10.16 entry. |

## Public API (gzip computation)

```js
const { gzipSync } = require('zlib');
const { readFileSync } = require('fs');

function gzSize(path) {
  return gzipSync(readFileSync(path), { level: 9 }).length;
}

const assets = [
  'assets/js/scoring.js',
  'assets/js/results.js',
  'assets/js/challenge.js',
  'assets/js/recommend.js',
  'packs/discovery-loader.js',
  ...globsSync('packs/disc/*/{index.html,prompts.json,archetypes.json,scoring.json}')
];

const total = assets.reduce((s, p) => s + gzSize(p), 0);
assert(total <= 81920, `Discovery pack ${total} > 81920 bytes`);
```

## Verification

- `node scripts/_smoke_disc_bundle_size.js` → PASS (total ≤ 80 KB; per-quiz ≤ 8 KB).
- Home page script audit: `Array.from(document.scripts).filter(s => /scoring|results|challenge|recommend/.test(s.src)).length === 0`.
- PR comment posted per Story X.3 format.

## Out-of-scope (deferred)

- None — closes the budget gate.

---

*Story doc — frontmatter + 7 sections, ~50 lines.*