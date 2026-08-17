#!/usr/bin/env node
/* Story DC-3 / Story 10.4 — challenge.js + wiring smoke.

   Verifies the shell-thin.js Proxy factory wiring for the
   Challenge-a-Friend viral-loop protocol (same pattern as
   scoring.js / Story DC-1, results.js / Story DC-2):
     - shell-thin.js loads via vm sandbox
     - HT.challenge is a Proxy (the factory returns a function
       for every property access — including `.link`, `.compare`,
       `.verify`)
     - First call to HT.challenge.link(spec) fires
       HT.lazyLoad('assets/js/challenge.js')
     - link() returns a URL containing ?c=<base64url-blob> where
       the blob decodes to {v: 1, slug, self, iat, exp} with
       default 30-day expiry
     - compare() returns {score: 0..100, axes: [...]}, deterministic
     - verify() rejects malformed / spec-mismatch / expired blobs
       with friendly messages; accepts valid blobs
     - scripts/bundle-size-gate.py: challenge.js is in
       SPEC_PAGE_CONDITIONAL_MODULES, NOT in SPEC_JS_MODULES
     - challenge.js has no localStorage / fetch / XHR / HT.provide
       (shell-bounds-check contract)

   Pure-Node smoke (no jsdom / playwright). Runs in a vm sandbox
   with minimal HT stubs.

   Exit codes:
     0 — all assertions PASS
     1 — at least one assertion failed
*/

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const SHELL_THIN_SRC = fs.readFileSync(path.join(REPO_ROOT, 'assets/js/shell-thin.js'), 'utf8');
const CHALLENGE_SRC  = fs.readFileSync(path.join(REPO_ROOT, 'assets/js/challenge.js'), 'utf8');

let pass = 0;
let fail = 0;
function check(cond, label) {
  if (cond) { pass += 1; console.log('  PASS  ' + label); }
  else      { fail += 1; console.log('  FAIL  ' + label); }
}

// =============================================================
// Minimal HT stubs (mirror _smoke_scoring.js shape).
// =============================================================

function buildCtx() {
  const lazyLog = { js: [], css: [] };
  const HT = {
    storage: {
      _store: {},
      get: function (k, dflt) { return Object.prototype.hasOwnProperty.call(this._store, k) ? this._store[k] : dflt; },
      set: function (k, v) { this._store[k] = v; },
      remove: function (k) { delete this._store[k]; },
    },
    $: function () { return null; },
    qsa: function () { return []; },
    qs: function () { return null; },
    debounce: function (fn) { return fn; },
    formatNumber: function (n) { return String(n); },
    formatDate: function (d) { return d.toISOString(); },
    copyToClipboard: function () { return Promise.resolve(); },
    toast: function () {},
    share: { print: function () {} },
    shellThinLoaded: false,
    lazyLoad: function (url) {
      lazyLog.js.push(url);
      // When the smoke harness asks for challenge.js, actually run
      // its source into the same context so HT.challenge becomes
      // the real publicApi and the Proxy round-trip works.
      if (typeof url === 'string' && url.indexOf('challenge.js') !== -1) {
        try { vm.runInContext(CHALLENGE_SRC, ctx); } catch (e) {}
      }
      return Promise.resolve();
    },
    lazyLoadCss: function (url) {
      lazyLog.css.push(url);
      return Promise.resolve();
    },
    lazyLoadTool: function () { return Promise.resolve(); },
    history: { push: function () {} },
    _lazyLog: lazyLog,
  };
  const ctx = {
    HT: HT,
    window: { HT: HT, __htShellReplacesTheme: false },
    self:   { HT: HT },
    console: { warn: function () {}, log: function () {}, error: function () {} },
    document: {
      addEventListener: function () {},
      documentElement: { setAttribute: function () {}, getAttribute: function () { return null; } },
      readyState: 'loading',
      querySelector: function () { return null; },
      querySelectorAll: function () { return []; },
      createElement: function () { return { setAttribute: function () {}, addEventListener: function () {} }; },
      createDocumentFragment: function () { return { appendChild: function () {} }; },
      head: { appendChild: function () {} },
      currentScript: null,
    },
    location: { href: 'http://localhost/', protocol: 'http:', pathname: '/' },
    history: { replaceState: function () {} },
    setTimeout: function (fn) { try { fn(); } catch (e) {} return 0; },
    clearTimeout: function () {},
    Object: Object,
    Array: Array,
    JSON: JSON,
    Promise: Promise,
    Error: Error,
    URLSearchParams: URLSearchParams,
    isFinite: isFinite,
    Math: Math,
    Date: Date,
    // Base64 stubs for the vm sandbox (challenge.js uses btoa/atob
    // when available, falling back to Buffer-style encoding — but
    // the smoke harness runs challenge.js via vm, so we provide
    // them explicitly so the link() payload round-trips).
    btoa: function (s) { return Buffer.from(s, 'binary').toString('base64'); },
    atob: function (s) { return Buffer.from(s, 'base64').toString('binary'); },
  };
  ctx.global = ctx;
  return ctx;
}

// =============================================================
// Proxy wiring + functional checks (async — the shell-thin
// Proxy factory returns Promises that resolve to the real API)
// =============================================================

const ctx = buildCtx();
vm.createContext(ctx);
vm.runInContext(SHELL_THIN_SRC, ctx);

(async function () {

  // 1. shell-thin.js loaded into vm sandbox
  check(true, 'shell-thin.js loaded into vm sandbox');

  // 2. HT.challenge is an object exposed by the shell-thin factory
  check(
    typeof ctx.HT.challenge === 'object' && ctx.HT.challenge !== null && !Array.isArray(ctx.HT.challenge),
    'HT.challenge is an object exposed by the shell-thin factory'
  );

  // 3. HT.challenge.link is callable (Proxy returns fn for every prop access)
  check(
    typeof ctx.HT.challenge.link === 'function',
    'HT.challenge.link is callable (Proxy factory returns fn for every prop access)'
  );

  // 4. HT.challenge.compare is callable
  check(
    typeof ctx.HT.challenge.compare === 'function',
    'HT.challenge.compare is callable'
  );

  // 5. HT.challenge.verify is callable
  check(
    typeof ctx.HT.challenge.verify === 'function',
    'HT.challenge.verify is callable'
  );

  // 6. First link() call fires lazyLoad('assets/js/challenge.js').
  // The Proxy returns a Promise that resolves to the real URL.
  // Use future-safe timestamps (2030+30d) so the blob isn't
  // accidentally expired under "now" in 2026+.
  const nowSec = Math.floor(Date.now() / 1000);
  const spec = {
    slug: 'personality',
    self: { q1: 'calm', q2: 'bold' },
    iat: nowSec + 60,
    exp: nowSec + 60 + 30 * 86400, // +30d
  };
  const url = await ctx.HT.challenge.link(spec);
  check(
    ctx.HT._lazyLog.js.filter(function (u) { return typeof u === 'string' && u.indexOf('challenge.js') !== -1; }).length >= 1,
    'first HT.challenge.link(...) call fires lazyLoad("...challenge.js")'
  );

  // 7. URL contains ?c=<base64-blob>
  check(
    typeof url === 'string' && /[?&]c=/.test(url),
    'link() returns a URL containing ?c=<base64-blob> (got ' + url + ')'
  );

  // 8. Blob decodes to {v: 1, slug, self, iat, exp}
  let decoded = null;
  try {
    const blob = url.split(/[?&]c=/)[1].split(/[&#]/)[0];
    const padded = blob + '='.repeat((4 - blob.length % 4) % 4);
    decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch (e) {}
  check(
    decoded
      && typeof decoded.v === 'number'
      && decoded.slug === 'personality'
      && decoded.self && typeof decoded.self.q1 === 'string'
      && typeof decoded.iat === 'number'
      && typeof decoded.exp === 'number',
    'base64 blob decodes to {v, slug, self, iat, exp} (got ' + JSON.stringify(decoded) + ')'
  );

  // 9. v == 1 (schema version)
  check(decoded && decoded.v === 1, 'blob v === 1 (schema version)');

  // 10. exp == iat + 30 days (default 30-day expiry)
  if (decoded) {
    const days = (decoded.exp - decoded.iat) / 86400;
    check(
      Math.abs(days - 30) < 0.01,
      'exp === iat + 30 days (got ' + days.toFixed(3) + ')'
    );
  }

  // 11. compare returns {score 0..100, axes[]}
  const cmp = await ctx.HT.challenge.compare(
    { q1: 'calm', q2: 'bold' },
    { q1: 'calm', q2: 'quiet' }
  );
  check(
    cmp && typeof cmp.score === 'number' && Array.isArray(cmp.axes),
    'compare returns {score: 0..100, axes: [...]} (got ' + JSON.stringify(cmp) + ')'
  );
  check(
    cmp && cmp.score >= 0 && cmp.score <= 100,
    'compare score is in [0, 100] (got ' + (cmp && cmp.score) + ')'
  );
  check(
    cmp && cmp.axes.length === 2,
    'compare axes length matches the union of question ids (got ' + (cmp && cmp.axes.length) + ')'
  );

  // 12. compare is deterministic
  const cmp2 = await ctx.HT.challenge.compare(
    { q1: 'calm', q2: 'bold' },
    { q1: 'calm', q2: 'quiet' }
  );
  check(
    cmp && cmp2 && cmp.score === cmp2.score,
    'compare is deterministic (same inputs -> same score, ' + cmp.score + ' vs ' + cmp2.score + ')'
  );

  // 13. compare axes contain delta=0 for matches, delta=1 for mismatches
  const matchedAxis = cmp && cmp.axes.filter(function (a) { return a.delta === 0; })[0];
  const mismatchedAxis = cmp && cmp.axes.filter(function (a) { return a.delta === 1; })[0];
  check(!!matchedAxis, 'compare axes include a delta:0 entry for matching answers');
  check(!!mismatchedAxis, 'compare axes include a delta:1 entry for mismatching answers');

  // 14. verify() rejects spec-mismatch blob with friendly message
  const fake99 = Buffer.from(JSON.stringify({
    v: 99, slug: 'x', self: {}, iat: 0, exp: 9999999999,
  })).toString('base64').replace(/=+$/, '');
  const v99 = await ctx.HT.challenge.verify(fake99);
  check(
    v99 && v99.ok === false && v99.code === 'spec-mismatch'
      && /newer|older|version/i.test(String(v99.message || '')),
    'verify() rejects v:99 with code "spec-mismatch" + friendly message (got ' + JSON.stringify(v99) + ')'
  );

  // 15. verify() rejects expired blob with friendly message
  const fakeExpired = Buffer.from(JSON.stringify({
    v: 1, slug: 'x', self: { q1: 'a' }, iat: 0, exp: 1,
  })).toString('base64').replace(/=+$/, '');
  const vExp = await ctx.HT.challenge.verify(fakeExpired);
  check(
    vExp && vExp.ok === false && vExp.code === 'expired'
      && /expired/i.test(String(vExp.message || '')),
    'verify() rejects expired blob with code "expired" + friendly message (got ' + JSON.stringify(vExp) + ')'
  );

  // 16. verify() rejects malformed blob
  const vMalformed = await ctx.HT.challenge.verify('!!!not-base64!!!');
  check(
    vMalformed && vMalformed.ok === false && vMalformed.code === 'malformed',
    'verify() rejects malformed blob with code "malformed" (got ' + JSON.stringify(vMalformed) + ')'
  );

  // 17. verify() accepts a valid blob (re-encode using future timestamps
  // so the receiver-side verify() doesn't reject it as expired)
  const validUrl = await ctx.HT.challenge.link({
    slug: 'personality',
    self: { q1: 'calm' },
    iat: nowSec + 60,
    exp: nowSec + 60 + 30 * 86400,
  });
  const validBlob = validUrl.split(/[?&]c=/)[1].split(/[&#]/)[0];
  const vOk = await ctx.HT.challenge.verify(validBlob);
  check(
    vOk && vOk.ok === true,
    'verify() accepts a valid blob (got ' + JSON.stringify(vOk) + ')'
  );

  // 18. shell-bounds-check contract — strip comments before the
  // regex scan so documentation references don't false-positive.
  const stripped = CHALLENGE_SRC
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const hasLocalStorage = /\blocalStorage\./.test(stripped);
  const hasFetch       = /\bfetch\s*\(/.test(stripped);
  const hasXHR         = /\b(XMLHttpRequest|new\s+XHR)\b/.test(stripped);
  const hasHTProvide   = /\bHT\.provide\s*\(/.test(stripped);
  check(
    !hasLocalStorage && !hasFetch && !hasXHR && !hasHTProvide,
    'challenge.js contains no localStorage/fetch/XHR/HT.provide (shell-bounds contract)'
  );

  // 19. bundle-size-gate.py: challenge.js in SPEC_PAGE_CONDITIONAL_MODULES
  const bsgSrc = fs.readFileSync(path.join(REPO_ROOT, 'scripts/bundle-size-gate.py'), 'utf8');
  check(
    /SPEC_PAGE_CONDITIONAL_MODULES[\s\S]*?"assets\/js\/challenge\.js"/m.test(bsgSrc),
    'scripts/bundle-size-gate.py lists challenge.js in SPEC_PAGE_CONDITIONAL_MODULES'
  );

  // 20. shell-thin.js TIER2_URLS includes 'assets/js/challenge.js'
  check(
    SHELL_THIN_SRC.indexOf("challenge: 'assets/js/challenge.js'") !== -1,
    'assets/js/shell-thin.js TIER2_URLS includes \'assets/js/challenge.js\''
  );

  // 21. vacuous-pass guard
  check(pass + fail > 0, 'at least one assertion ran (vacuous-pass guard)');

  // Final summary
  console.log('\nJSON:{"story": "DC-3", "pass": ' + pass + ', "fail": ' + fail + '}');
  process.exit(fail === 0 ? 0 : 1);
})().catch(function (err) {
  console.error('smoke threw:', err && err.stack || err);
  process.exit(1);
});