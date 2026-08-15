#!/usr/bin/env node
/* Story 4b Phase 1 — shell-*.js orchestrator smoke

   Verifies the 3 new shell-*.js files load, expose the expected
   HT.shell* namespaces, and the mount() fns correctly delegate to
   the chrome namespaces (HT.history, HT.share, HT.sampleData).

   Pure-Node smoke (no jsdom / playwright). Runs in a vm sandbox with
   minimal HT + history/share/sample-data stubs.

   Exit codes:
     0 — all assertions PASS
     1 — at least one assertion failed
*/

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const HT_LAZY_SRC = fs.readFileSync(path.join(REPO_ROOT, 'assets/js/ht-lazy.js'), 'utf8');

let pass = 0;
let fail = 0;
function check(cond, label) {
  if (cond) { pass += 1; console.log('  PASS  ' + label); }
  else      { fail += 1; console.log('  FAIL  ' + label); }
}

// =============================================================
// Sandbox builder — minimal HT + chrome namespace stubs
// =============================================================

function buildCtx(opts) {
  opts = opts || {};
  const calls = { history: [], share: [], sampleData: [] };
  const HT = {
    // Record calls so tests can assert delegation.
    history: opts.historyStub || {
      hasHistory: function () { return opts.historyPresent !== false; },
      panel: function (slug, root) { calls.history.push({ slug: slug, root: root }); },
    },
    share: opts.shareStub || {
      hasShare: function () { return opts.sharePresent !== false; },
      mount: function (slug, root) { calls.share.push({ slug: slug, root: root }); },
    },
    sampleData: opts.sampleDataStub || {
      mount: function (slug, root) { calls.sampleData.push({ slug: slug, root: root }); },
    },
    // ht-lazy.js expects window.HT.lazyLoad + window.HT.lazyLoadCss.
    lazyLoad: function () { return Promise.resolve(); },
    lazyLoadCss: function () { return Promise.resolve(); },
  };
  const ctx = {
    HT: HT,
    window: { HT: HT },
    console: console,
    document: {
      addEventListener: function () {},
      documentElement: { setAttribute: function () {}, getAttribute: function () { return null; } },
      readyState: 'complete',
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    performance: typeof performance !== 'undefined' ? performance : { now: function () { return 0; } },
    _calls: calls,
  };
  return ctx;
}

function loadInto(ctx, src, label) {
  try {
    vm.runInContext(src, vm.createContext(ctx), { filename: label });
    return true;
  } catch (err) {
    console.log('  FAIL  load ' + label + ' threw: ' + err.message);
    fail += 1;
    return false;
  }
}

// =============================================================
// I. shell-history.js
// =============================================================
console.log('--- I. shell-history.js ---');
{
  const SHELL_HISTORY_SRC = fs.readFileSync(path.join(REPO_ROOT, 'assets/js/shell-history.js'), 'utf8');
  const ctx = buildCtx();
  check(loadInto(ctx, SHELL_HISTORY_SRC, 'shell-history.js'), 'shell-history.js loads without throwing');
  check(!!ctx.HT.shellHistory, 'HT.shellHistory exposed');
  check(typeof ctx.HT.shellHistory.mount === 'function', 'HT.shellHistory.mount is a function');
  check(Object.isFrozen(ctx.HT.shellHistory), 'HT.shellHistory is frozen (AD-14 internal handle)');

  // Mount with valid slug + main delegates to HT.history.panel.
  const main = { getAttribute: function (k) { return k === 'data-slug' ? 'qr-code-generator' : null; } };
  ctx.HT.shellHistory.mount('qr-code-generator', main);
  check(ctx._calls.history.length === 1, 'mount delegates to HT.history.panel (1 call)');
  check(ctx._calls.history[0].slug === 'qr-code-generator', 'delegate passes slug');

  // hasHistory returns false → no delegate call.
  const ctx2 = buildCtx({ historyStub: {
    hasHistory: function () { return false; },
    panel: function () { throw new Error('should not be called'); },
  } });
  loadInto(ctx2, SHELL_HISTORY_SRC, 'shell-history.js (no-history)');
  ctx2.HT.shellHistory.mount('some-tool', main);
  check(ctx2._calls.history.length === 0, 'hasHistory=false → no delegate call');

  // Invalid slug → no delegate call (regex guard).
  const ctx3 = buildCtx();
  loadInto(ctx3, SHELL_HISTORY_SRC, 'shell-history.js (bad-slug)');
  ctx3.HT.shellHistory.mount('Invalid Slug!', main);
  check(ctx3._calls.history.length === 0, 'invalid slug → no delegate call');

  // Missing main → no delegate call.
  const ctx4 = buildCtx();
  loadInto(ctx4, SHELL_HISTORY_SRC, 'shell-history.js (no-main)');
  ctx4.HT.shellHistory.mount('qr-code-generator', null);
  check(ctx4._calls.history.length === 0, 'null main → no delegate call');

  // HT.history missing entirely → no throw, no call.
  const ctx5 = buildCtx({ historyStub: undefined });
  ctx5.HT.history = undefined;
  loadInto(ctx5, SHELL_HISTORY_SRC, 'shell-history.js (no-history-ns)');
  ctx5.HT.shellHistory.mount('qr-code-generator', main);
  check(ctx5._calls.history.length === 0, 'HT.history missing → no throw, no call');

  // Delegate throws → orchestrator catches and warns (no re-throw).
  const ctx6 = buildCtx({ historyStub: {
    hasHistory: function () { return true; },
    panel: function () { throw new Error('boom'); },
  } });
  let warned = false;
  ctx6.console = { warn: function () { warned = true; }, log: function () {} };
  loadInto(ctx6, SHELL_HISTORY_SRC, 'shell-history.js (panel-throws)');
  let threw = false;
  try { ctx6.HT.shellHistory.mount('qr-code-generator', main); } catch (_) { threw = true; }
  check(!threw, 'delegate throw caught by orchestrator (no re-throw)');
  check(warned, 'delegate throw → console.warn fired');
}

// =============================================================
// II. shell-share.js
// =============================================================
console.log('--- II. shell-share.js ---');
{
  const SHELL_SHARE_SRC = fs.readFileSync(path.join(REPO_ROOT, 'assets/js/shell-share.js'), 'utf8');
  const ctx = buildCtx();
  check(loadInto(ctx, SHELL_SHARE_SRC, 'shell-share.js'), 'shell-share.js loads without throwing');
  check(!!ctx.HT.shellShare, 'HT.shellShare exposed');
  check(typeof ctx.HT.shellShare.mount === 'function', 'HT.shellShare.mount is a function');
  check(Object.isFrozen(ctx.HT.shellShare), 'HT.shellShare is frozen (AD-14 internal handle)');

  const main = { getAttribute: function (k) { return k === 'data-slug' ? 'qr-code-generator' : null; } };
  ctx.HT.shellShare.mount('qr-code-generator', main);
  check(ctx._calls.share.length === 1, 'mount delegates to HT.share.mount (1 call)');
  check(ctx._calls.share[0].slug === 'qr-code-generator', 'delegate passes slug');

  const ctx2 = buildCtx({ shareStub: {
    hasShare: function () { return false; },
    mount: function () { throw new Error('should not be called'); },
  } });
  loadInto(ctx2, SHELL_SHARE_SRC, 'shell-share.js (no-share)');
  ctx2.HT.shellShare.mount('some-tool', main);
  check(ctx2._calls.share.length === 0, 'hasShare=false → no delegate call');

  const ctx3 = buildCtx();
  loadInto(ctx3, SHELL_SHARE_SRC, 'shell-share.js (bad-slug)');
  ctx3.HT.shellShare.mount('Invalid Slug!', main);
  check(ctx3._calls.share.length === 0, 'invalid slug → no delegate call');

  const ctx4 = buildCtx();
  loadInto(ctx4, SHELL_SHARE_SRC, 'shell-share.js (no-main)');
  ctx4.HT.shellShare.mount('qr-code-generator', null);
  check(ctx4._calls.share.length === 0, 'null main → no delegate call');

  const ctx5 = buildCtx({ shareStub: undefined });
  ctx5.HT.share = undefined;
  loadInto(ctx5, SHELL_SHARE_SRC, 'shell-share.js (no-share-ns)');
  ctx5.HT.shellShare.mount('qr-code-generator', main);
  check(ctx5._calls.share.length === 0, 'HT.share missing → no throw, no call');

  const ctx6 = buildCtx({ shareStub: {
    hasShare: function () { return true; },
    mount: function () { throw new Error('boom'); },
  } });
  let warned = false;
  ctx6.console = { warn: function () { warned = true; }, log: function () {} };
  loadInto(ctx6, SHELL_SHARE_SRC, 'shell-share.js (mount-throws)');
  let threw = false;
  try { ctx6.HT.shellShare.mount('qr-code-generator', main); } catch (_) { threw = true; }
  check(!threw, 'delegate throw caught by orchestrator (no re-throw)');
  check(warned, 'delegate throw → console.warn fired');
}

// =============================================================
// III. shell-sample-data.js
// =============================================================
console.log('--- III. shell-sample-data.js ---');
{
  const SHELL_SAMPLE_SRC = fs.readFileSync(path.join(REPO_ROOT, 'assets/js/shell-sample-data.js'), 'utf8');
  const ctx = buildCtx();
  check(loadInto(ctx, SHELL_SAMPLE_SRC, 'shell-sample-data.js'), 'shell-sample-data.js loads without throwing');
  check(!!ctx.HT.shellSampleData, 'HT.shellSampleData exposed');
  check(typeof ctx.HT.shellSampleData.mount === 'function', 'HT.shellSampleData.mount is a function');
  check(Object.isFrozen(ctx.HT.shellSampleData), 'HT.shellSampleData is frozen (AD-14 internal handle)');

  const main = { getAttribute: function (k) { return k === 'data-slug' ? 'qr-code-generator' : null; } };
  ctx.HT.shellSampleData.mount('qr-code-generator', main);
  check(ctx._calls.sampleData.length === 1, 'mount delegates to HT.sampleData.mount (1 call)');
  check(ctx._calls.sampleData[0].slug === 'qr-code-generator', 'delegate passes slug');

  const ctx2 = buildCtx();
  loadInto(ctx2, SHELL_SAMPLE_SRC, 'shell-sample-data.js (bad-slug)');
  ctx2.HT.shellSampleData.mount('Invalid Slug!', main);
  check(ctx2._calls.sampleData.length === 0, 'invalid slug → no delegate call');

  const ctx3 = buildCtx();
  loadInto(ctx3, SHELL_SAMPLE_SRC, 'shell-sample-data.js (no-main)');
  ctx3.HT.shellSampleData.mount('qr-code-generator', null);
  check(ctx3._calls.sampleData.length === 0, 'null main → no delegate call');

  const ctx4 = buildCtx({ sampleDataStub: undefined });
  ctx4.HT.sampleData = undefined;
  loadInto(ctx4, SHELL_SAMPLE_SRC, 'shell-sample-data.js (no-sampleData-ns)');
  ctx4.HT.shellSampleData.mount('qr-code-generator', main);
  check(ctx4._calls.sampleData.length === 0, 'HT.sampleData missing → no throw, no call');

  const ctx5 = buildCtx({ sampleDataStub: {
    mount: function () { throw new Error('boom'); },
  } });
  let warned = false;
  ctx5.console = { warn: function () { warned = true; }, log: function () {} };
  loadInto(ctx5, SHELL_SAMPLE_SRC, 'shell-sample-data.js (mount-throws)');
  let threw = false;
  try { ctx5.HT.shellSampleData.mount('qr-code-generator', main); } catch (_) { threw = true; }
  check(!threw, 'delegate throw caught by orchestrator (no re-throw)');
  check(warned, 'delegate throw → console.warn fired');
}

// =============================================================
// IV. shell.js boot() integration — verify shell.js references
// the new orchestrators instead of calling HT.history.panel
// inline.
// =============================================================
console.log('--- IV. shell.js boot() integration ---');
{
  const SHELL_SRC = fs.readFileSync(path.join(REPO_ROOT, 'assets/js/shell.js'), 'utf8');
  // shell.js boot() should NOT call HT.history.panel directly anymore;
  // it should call HT.shellHistory.mount.
  check(/HT\.shellHistory\.mount/.test(SHELL_SRC),
    'shell.js boot() references HT.shellHistory.mount');
  check(/HT\.shellShare\.mount/.test(SHELL_SRC),
    'shell.js boot() references HT.shellShare.mount');
  check(/HT\.shellSampleData\.mount/.test(SHELL_SRC),
    'shell.js boot() references HT.shellSampleData.mount');
  // No stale direct panel/mount calls.
  check(!/HT\.history\.panel\s*\(/.test(SHELL_SRC),
    'shell.js boot() no longer calls HT.history.panel directly');
  check(!/HT\.share\.mount\s*\(/.test(SHELL_SRC),
    'shell.js boot() no longer calls HT.share.mount directly');
  check(!/HT\.sampleData\.mount\s*\(/.test(SHELL_SRC),
    'shell.js boot() no longer calls HT.sampleData.mount directly');
}

// =============================================================
// V. shell-thin.js kickShellBoot() integration
// =============================================================
console.log('--- V. shell-thin.js kickShellBoot() integration ---');
{
  const SHELL_THIN_SRC = fs.readFileSync(path.join(REPO_ROOT, 'assets/js/shell-thin.js'), 'utf8');
  check(/safeLazyLoad\(['"]assets\/js\/shell-history\.js['"]\)/.test(SHELL_THIN_SRC),
    'shell-thin.js kickShellBoot() lazy-loads shell-history.js');
  check(/safeLazyLoad\(['"]assets\/js\/shell-share\.js['"]\)/.test(SHELL_THIN_SRC),
    'shell-thin.js kickShellBoot() lazy-loads shell-share.js');
  check(/safeLazyLoad\(['"]assets\/js\/shell-sample-data\.js['"]\)/.test(SHELL_THIN_SRC),
    'shell-thin.js kickShellBoot() lazy-loads shell-sample-data.js');
}

// =============================================================
// VI. bundle-size-gate.py includes the new shell-*.js files
// =============================================================
console.log('--- VI. bundle-size-gate.py SPEC_JS_MODULES ---');
{
  const GATE_SRC = fs.readFileSync(path.join(REPO_ROOT, 'scripts/bundle-size-gate.py'), 'utf8');
  check(/["']assets\/js\/shell-history\.js["']/.test(GATE_SRC),
    'bundle-size-gate.py: shell-history.js in SPEC_JS_MODULES');
  check(/["']assets\/js\/shell-share\.js["']/.test(GATE_SRC),
    'bundle-size-gate.py: shell-share.js in SPEC_JS_MODULES');
  check(/["']assets\/js\/shell-sample-data\.js["']/.test(GATE_SRC),
    'bundle-size-gate.py: shell-sample-data.js in SPEC_JS_MODULES');
}

// =============================================================
// Vacuous-pass guard
// =============================================================

if (pass === 0 && fail === 0) {
  console.error('shell-orchestrators-smoke: VACUOUS — no assertions ran');
  process.exit(1);
}

console.log('');
console.log('shell-orchestrators-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);
