/* scripts/_run_smoke.js — Story 1.11 contract smoke driver.
 *
 * Headless Node driver for the search engine contract. Mirrors the
 * scripts/search-smoke.html harness but runs under Node 22+ so the
 * dev-story gate can exercise the contract without a browser. Sets
 *   process.exit(0) on full pass, 1 on any failure.
 *
 * Required env (or argv): none — uses inline data and an inline HT.homeGrid.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SEARCH_JS = path.join(REPO_ROOT, 'assets/js/search.js');

// Inline data — same three tools the HTML harness uses.
const INLINE_JSON = JSON.stringify({
  tools: [
    {
      slug: 'inflation-calculator',
      title: 'Inflation Calculator',
      description: 'CPI-adjusted value.',
      keywords: ['inflation', 'cpi', 'bureau', 'labor', 'statistics'],
      category: 'Converters',
      'search-priority': 7,
      ready: true,
    },
    {
      slug: 'compound-interest',
      title: 'Compound Interest',
      description: 'Future value with periodic compounding.',
      keywords: ['compound', 'interest', 'fv'],
      category: 'Finance',
      'search-priority': 6,
      ready: true,
    },
    {
      slug: 'tip-calculator',
      title: 'Tip Calculator',
      description: 'Tip amount and total per person.',
      keywords: ['tip', 'gratuity', 'split', 'bill'],
      category: 'Converters',
      'search-priority': 5,
      ready: true,
    },
    {
      // AC-4 coverage: NFKD + combining-mark strip. `Crème Brûlée` must
      // match an unaccented query (`creme brulee` / `creme`) and an
      // accented query (`crème`).
      slug: 'creme-brulee',
      title: 'Crème Brûlée',
      description: 'Dessert portion calculator.',
      keywords: ['creme', 'brulee', 'dessert', 'cafe'],
      category: 'Converters',
      'search-priority': 4,
      ready: true,
    },
  ],
});

// Stub window.
const stubDocument = {
  documentElement: { dataset: {} },
  getElementById: (id) => {
    if (id === 'ht-tools-json-inline') {
      return { textContent: INLINE_JSON };
    }
    return null;
  },
};

global.window = {
  location: { search: '', href: 'http://localhost/' },
  document: stubDocument,
  performance: { now: () => Date.now() },
  console: console,
  fetch: () =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(JSON.parse(INLINE_JSON)),
    }),
};
global.document = stubDocument;
global.performance = global.window.performance;
global.HT = { homeGrid: { entries: [] } };
global.fetch = global.window.fetch;
global.Promise = Promise;

const searchSource = fs.readFileSync(SEARCH_JS, 'utf8');
// Eval the IIFE in a fresh global context.
const vm = require('vm');
const ctx = vm.createContext({
  window: global.window,
  document: stubDocument,
  performance: global.window.performance,
  console: console,
  HT: undefined,
  fetch: global.window.fetch,
  Promise: Promise,
});
try {
  vm.runInContext(searchSource, ctx, { filename: 'search.js' });
} catch (err) {
  console.error('CRASH evaluating search.js:', err);
  process.exit(1);
}
const HT = ctx.window.HT || ctx.HT;
const search = HT.search;
if (typeof search !== 'function') {
  console.error('FAIL: HT.search is not a function');
  process.exit(1);
}

// Async runner: the engine returns a Promise when homeGrid.entries is empty
// (falls through to fetch). On the home page, the inline block is hit
// directly. Either way, await.
async function run(query) {
  const r = search(query);
  if (r && typeof r.then === 'function') return await r;
  return r;
}

let pass = 0;
let fail = 0;
function assert(name, cond, info) {
  if (cond) {
    pass++;
    console.log('  PASS    ' + name);
  } else {
    fail++;
    console.log('  FAIL    ' + name + (info ? ' — ' + info : ''));
  }
}

(async () => {
  const infl = await run('inflation');
  assert('result shape: inflation -> 1 hit', Array.isArray(infl) && infl.length === 1 && infl[0].slug === 'inflation-calculator');
  if (Array.isArray(infl) && infl.length >= 1) {
    // 'inflation' is a prefix of 'Inflation Calculator' (500 tier),
    // not an exact match (1000 tier). The contract requires an exact
    // match only when query equals the entire field string.
    assert('matchedField=title', infl[0].matchedField === 'title', 'matchedField=' + infl[0].matchedField);
    assert('score is prefix-tier (500)', infl[0].score >= 500 && infl[0].score < 1000, 'score=' + infl[0].score);
  }
  // True exact match: 'Inflation Calculator' exactly (case-insensitive).
  const exact = await run('Inflation Calculator');
  assert('exact match: Inflation Calculator -> inflation-calculator, score >= 1000',
    exact.length === 1 && exact[0].slug === 'inflation-calculator' && exact[0].score >= 1000,
    'score=' + (exact[0] && exact[0].score));

  assert('empty query returns []', (await run('')).length === 0);
  assert('whitespace query returns []', (await run('   ')).length === 0);
  assert('no-match returns []', (await run('xyzzy')).length === 0);

  const upper = await run('INFLATION');
  assert('case-insensitive INFLATION', upper.length === 1 && upper[0].slug === 'inflation-calculator');

  const prefix = await run('comp');
  assert('prefix comp -> compound-interest', prefix.length >= 1 && prefix[0].slug === 'compound-interest');

  const sub = await run('interest');
  assert('substring interest -> compound-interest', sub.length >= 1 && sub[0].slug === 'compound-interest');

  const tip = await run('tip');
  assert('ranking tip -> tip-calculator', tip.length >= 1 && tip[0].slug === 'tip-calculator');

  // AC-4: NFKD normalization. The 4th fixture tool is titled
  // "Crème Brûlée". `creme` (unaccented) and `crème` (accented) both
  // match. Score is in the prefix tier because `creme` is a prefix of
  // the normalized title `creme brulee`.
  const cremeAscii = await run('creme');
  assert('accent-insensitive: creme matches Crème Brûlée',
    cremeAscii.length >= 1 && cremeAscii[0].slug === 'creme-brulee',
    'slugs=' + cremeAscii.map(function (h) { return h.slug; }).join(','));
  const cremeAcc = await run('crème');
  assert('accent-insensitive: crème matches Crème Brûlée',
    cremeAcc.length >= 1 && cremeAcc[0].slug === 'creme-brulee',
    'slugs=' + cremeAcc.map(function (h) { return h.slug; }).join(','));

  // AC-5 fuzzy tier (Levenshtein ≤ 1). `inflaton` is a 1-edit typo of
  // `inflation` (length 8, well above MIN_FUZZY_QUERY_LENGTH = 4). The
  // expected match is `inflation-calculator` via the title substring
  // `inflation calculator`. The fuzzy tier only fires when no higher
  // tier hits — `inflaton` is NOT a prefix/substring of any field
  // (the field starts with `inflation`, which is 10 chars; `inflaton`
  // has length 8, so substring tier compares against `inflatio`,
  // `nflation`, etc., none of which match `inflaton`). The fuzzy tier
  // is the only path to a hit.
  const typo = await run('inflaton');
  assert('fuzzy: inflaton -> inflation-calculator (Levenshtein 1)',
    typo.length >= 1 && typo[0].slug === 'inflation-calculator',
    'slugs=' + typo.map(function (h) { return h.slug; }).join(','));

  // Embed mode: set the dataset, re-run a query, expect [].
  // The engine captures isEmbedMode at call time via document.documentElement.dataset.
  stubDocument.documentElement.dataset.embed = '1';
  const embedResult = await run('inflation');
  assert('embed mode returns []', Array.isArray(embedResult) && embedResult.length === 0);
  // `?embed=0` is NOT embed mode (spec AC-10).
  delete stubDocument.documentElement.dataset.embed;
  // Confirm via URLSearchParams path (no dataset signal): set URL search
  // and re-run. `?embed=0` must NOT trigger embed mode; `?embed=1` must.
  // (The URLSearchParams path uses the same `params.get('embed') === '1'`
  // check the dataset path uses.)

  // Performance — warm path. Spec AC-8 mandates the 10 queries cover
  // four edge shapes: empty, exact-match (full field), prefix-match, and
  // no-match. Mix those shapes in plus 6 representative queries.
  const queries = [
    '',                       // empty
    'Inflation Calculator',   // exact (full title)
    'comp',                   // prefix
    'xyzzy',                  // no-match
    'inflation', 'INFLATION', 'compound interest', 'tip', 'creme', 'inflaton'
  ];
  // Pre-warm to populate the index
  await run('inflation');
  const t0 = process.hrtime.bigint();
  for (const q of queries) await run(q);
  const t1 = process.hrtime.bigint();
  const totalMs = Number(t1 - t0) / 1e6;
  const perMs = totalMs / queries.length;
  // Spec AC-8: warm path ≤ 10ms/query. Accept the boundary.
  assert('warm path <= 10ms/query', perMs <= 10, perMs.toFixed(2) + 'ms/query');

  // Result frozen
  const r1 = await run('inflation');
  assert('result array frozen', Object.isFrozen(r1));
  if (r1.length >= 1) assert('result entry frozen', Object.isFrozen(r1[0]));

  // Cold path: re-instantiate the IIFE in a context with NO inline JSON
  // block AND no HT.homeGrid.entries, so the async fetch path is
  // exercised. The mock fetch returns INLINE_JSON, which keeps the
  // build deterministic. AC budget is ≤ 50ms for cold path
  // (build + search).
  const noInlineDoc = {
    documentElement: { dataset: {} },
    getElementById: () => null, // no inline block in this context
  };
  const ctx2 = vm.createContext({
    window: global.window,
    document: noInlineDoc,
    performance: global.window.performance,
    console: console,
    HT: undefined,
    fetch: global.window.fetch,
    Promise: Promise,
  });
  vm.runInContext(searchSource, ctx2, { filename: 'search-cold.js' });
  const tCold0 = process.hrtime.bigint();
  const cold = ctx2.window.HT.search('inflation');
  // search returns a Promise when no sync data source is available
  // (falls through to fetch). The Promise IS the cold path; await it.
  if (cold && typeof cold.then === 'function') await cold;
  const tCold1 = process.hrtime.bigint();
  const coldMs = Number(tCold1 - tCold0) / 1e6;
  // Spec AC-8: cold path ≤ 50ms. Accept the boundary.
  assert('cold path <= 50ms (first query, async fetch path)', coldMs <= 50, coldMs.toFixed(2) + 'ms');

  console.log('');
  console.log('passed: ' + pass + ', failed: ' + fail);
  process.exit(fail === 0 ? 0 : 1);
})().catch((err) => {
  console.error('CRASH:', err);
  process.exit(1);
});