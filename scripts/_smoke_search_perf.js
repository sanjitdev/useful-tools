/* scripts/_smoke_search_perf.js — AC-8 perf budget smoke for search.js
 *
 * Headless Node driver that loads search.js via the vm module the same
 * way `_smoke_palette_search.js` does, then exercises the perf budget
 * Story 1.11 specifies for the FR-5 / AD-14 search surface:
 *
 *   cold path: ≤ 50 ms / query   (first 1-5 calls hit disk-cache misses,
 *                                 the NFKD normalize cost dominates)
 *   warm path: ≤ 10 ms / query   (the engine's published budget)
 *
 * The cold-path budget is distinct from the warm path because the
 * `String.prototype.normalize` call on un-ASCII fields (the diet /
 * health tools have lots of accented text) is the dominant cold-path
 * cost. The warm path skips the disk read.
 *
 * Vacuous-pass guard (pass === 0 && fail === 0 → exit 1) catches hollow
 * runs. Authored as part of the Epic 1 retrofit audit (AI-E1-14).
 *
 * Usage:
 *   node scripts/_smoke_search_perf.js
 *
 * Exits 0 on pass, 1 on any fail or vacuous run, 2 on crash.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const SEARCH_JS = path.join(REPO_ROOT, 'assets/js/search.js');

const WARM_BUDGET_MS = 10;
const COLD_BUDGET_MS = 50;
// No-result path includes a Promise microtask roundtrip per call
// (search() returns a thenable even when the result is sync). Budget
// is 25ms to leave room for the microtask scheduling cost in the
// test harness — the actual ranking cost is the same as warm.
const NO_RESULT_BUDGET_MS = 25;
const N_FIXTURE = 100;
const N_WARM_QUERIES = 50;
const N_COLD_RUNS = 5;

let pass = 0;
let fail = 0;
const failures = [];

function assert(label, cond, detail) {
  if (cond) {
    pass += 1;
    console.log('  ok      ' + label);
    return;
  }
  fail += 1;
  failures.push(label);
  const msg = detail ? label + ' (' + detail + ')' : label;
  console.error('  FAIL    ' + msg);
}

// Build a tools.json-shaped fixture. The first N entries carry
// accented text to stress the NFKD normalize cost (Story 1.11 calls
// normalize() on every field); the rest are ASCII so the engine
// exercises both code paths.
function buildFixture(n) {
  const ACCENTED = [
    'Café Crème', 'Naïve Approach', 'Résumé Builder', 'Haïti Map',
    'Élégant Console', 'Façade Inspector', 'Garçon Mode', 'Œuvre Tracker',
    'Crêpe Counter', 'Bière Garden',
  ];
  const tools = [];
  for (let i = 0; i < n; i += 1) {
    const suffix = i.toString(36).padStart(3, '0');
    tools.push({
      slug: 'fixture-' + suffix,
      title: i < ACCENTED.length ? ACCENTED[i] : 'Fixture ' + suffix,
      description: 'Fixture description for the perf smoke at index ' + i,
      tags: ['productivity', 'writing'],
      'search-priority': 0.5,
    });
  }
  return tools;
}

// Build a stub DOM with an <script id="ht-tools-json-inline"> holding
// the serialized fixture. The vm context gets a matching document.
function buildContext(toolsJson) {
  const inlineEl = {
    id: 'ht-tools-json-inline',
    textContent: toolsJson,
  };
  const document = {
    getElementById: function (id) {
      if (id === 'ht-tools-json-inline') return inlineEl;
      return null;
    },
    documentElement: { dataset: {} },
    addEventListener: () => {},
    hidden: false,
  };
  const window = {
    location: { search: '' },
    document: document,
    addEventListener: () => {},
    dispatchEvent: () => {},
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(toolsJson)) }),
    performance: { now: () => Number(process.hrtime.bigint()) / 1e6 },
    console: { warn: () => {}, error: () => {}, log: () => {} },
  };
  const sandbox = {
    window: window,
    document: document,
    URLSearchParams: URLSearchParams,
    Promise: Promise,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    performance: window.performance,
    HT: undefined,
  };
  return vm.createContext(sandbox);
}

function loadSearch(toolsJson) {
  const ctx = buildContext(toolsJson);
  const code = fs.readFileSync(SEARCH_JS, 'utf8');
  vm.runInContext(code, ctx, { filename: SEARCH_JS });
  return ctx.window.HT.search;
}

(async function main() {
  console.log('_smoke_search_perf: cold + warm path budget assertions');

  const fixture = buildFixture(N_FIXTURE);
  const fixtureJson = JSON.stringify({ tools: fixture });

  // ---- COLD PATH: ≤ 50ms / query (N_COLD_RUNS fresh VM invocations) ----
  console.log('cold path (≤ ' + COLD_BUDGET_MS + 'ms/query, ' +
              N_COLD_RUNS + ' fresh VM invocations):');
  const coldMs = [];
  for (let i = 0; i < N_COLD_RUNS; i += 1) {
    const t0 = process.hrtime.bigint();
    const search = loadSearch(fixtureJson);
    // The first search call is the "cold" one — it must hit the
    // index for the first time. We use a query that actually
    // matches to avoid the no-result trivial path.
    search('fixture');
    const t1 = process.hrtime.bigint();
    coldMs.push(Number(t1 - t0) / 1e6);
  }
  const coldAvg = coldMs.reduce((a, b) => a + b, 0) / coldMs.length;
  assert(
    'cold path ≤ ' + COLD_BUDGET_MS + 'ms/query (avg of ' + N_COLD_RUNS + ')',
    coldAvg <= COLD_BUDGET_MS,
    'avg=' + coldAvg.toFixed(2) + 'ms; samples=' +
      coldMs.map((m) => m.toFixed(1)).join(',')
  );

  // ---- WARM PATH: ≤ 10ms / query (N_WARM_QUERIES on one engine) ----
  console.log('warm path (≤ ' + WARM_BUDGET_MS + 'ms/query, ' +
              N_WARM_QUERIES + ' queries on one engine):');
  const search = loadSearch(fixtureJson);
  // Pre-warm: hit each tier at least once so the engine's string
  // caching + the JS engine's JIT don't show up as "cold" on the
  // very first timed run. (The first call after buildIndex is still
  // "warm" by Story 1.11's contract — only the disk read is cold.)
  search('Café');
  search('Crêpe');
  search('Fixture');
  search('NoSuchTool');

  const warmMs = [];
  for (let i = 0; i < N_WARM_QUERIES; i += 1) {
    const query = (i % 2 === 0) ? 'fix' : 'Crêpe';
    const t0 = process.hrtime.bigint();
    search(query);
    const t1 = process.hrtime.bigint();
    warmMs.push(Number(t1 - t0) / 1e6);
  }
  // Trim top-10% outliers to avoid one bad GC showing up as the
  // representative number. The remaining tail is what users see.
  warmMs.sort((a, b) => a - b);
  const warmTrimmed = warmMs.slice(0, Math.floor(warmMs.length * 0.9));
  const warmTrimmedAvg = warmTrimmed.reduce((a, b) => a + b, 0) / warmTrimmed.length;
  const warmRawAvg = warmMs.reduce((a, b) => a + b, 0) / warmMs.length;
  assert(
    'warm path ≤ ' + WARM_BUDGET_MS + 'ms/query (90th-percentile-trimmed avg of ' +
      N_WARM_QUERIES + ')',
    warmTrimmedAvg <= WARM_BUDGET_MS,
    'trimmed-avg=' + warmTrimmedAvg.toFixed(2) + 'ms; raw-avg=' +
      warmRawAvg.toFixed(2) + 'ms'
  );

  // ---- NO-OP BOUNDARY: zero-match queries must also be fast ----
  // A query that matches nothing must walk the entire index and
  // produce an empty array. If this is slower than warm-bounded
  // queries, it's a regression in the no-result path. search()
  // returns a Promise (thenable), so we use the sync path directly
  // via searchSync — that's the deterministic, embed-safe wrapper.
  console.log('no-result boundary:');
  let emptyResultsOk = true;
  const noResultStart = process.hrtime.bigint();
  for (let i = 0; i < 10; i += 1) {
    const result = search('zzz-no-such-tool-' + i);
    // search() returns a thenable; resolve it synchronously if it
    // already settled (the sync path uses Promise.resolve) so we
    // can inspect the length. Use the .then pattern (the thenable's
    // own resolution) via a microtask.
    const arr = (result && typeof result.then === 'function')
      ? await Promise.resolve(result)
      : result;
    if (!Array.isArray(arr) || arr.length !== 0) emptyResultsOk = false;
  }
  const noResultEnd = process.hrtime.bigint();
  const noResultMs = Number(noResultEnd - noResultStart) / 1e6 / 10;
  assert('no-result returns []', emptyResultsOk);
  assert(
    'no-result path ≤ ' + NO_RESULT_BUDGET_MS + 'ms/query',
    noResultMs <= NO_RESULT_BUDGET_MS,
    noResultMs.toFixed(2) + 'ms/query'
  );

  console.log('');
  console.log('passed: ' + pass + ', failed: ' + fail);

  // Vacuous-pass guard
  if (pass === 0 && fail === 0) {
    console.error('VACUOUS: no assertions ran');
    process.exit(1);
  }
  if (fail > 0) {
    console.error('');
    console.error('_smoke_search_perf: ' + fail + ' failure(s):');
    for (const label of failures) console.error('  - ' + label);
    process.exit(1);
  }
  process.exit(0);
})().catch((err) => {
  console.error('CRASH:', err && err.stack ? err.stack : err);
  process.exit(2);
});