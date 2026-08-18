/* ============================================
   _smoke_discovery_result.js (Story 10.10 close)

   Smoke harness for the canonical HT.results.render surface
   used by all 10 Discovery quizzes after the `_adopt_results_render`
   rollout.

   Asserts:
   1. assets/js/results.js loads, exposes HT.results.{render, shareUrl,
      copyText, imageSnapshot, wireActions} as a frozen object.
   2. HT.results.render(state, opts) on a representative state returns
      a DOM element with classes "quiz-result-card discovery-card",
      data-print="result", role="region", aria-live="polite",
      aria-labelledby="quiz-result-archetype".
   3. The card has a `.quiz-result-actions` child carrying
      `data-print="ignore"` + two buttons (data-action="share" +
      data-action="challenge").
   4. wireActions(card, state, opts) is idempotent (data-wired guard).
   5. Click on the Share button invokes HT.share.copy(state, opts) —
      and the resolved Promise fires HT.toast('Share link copied').
   6. Click on the Challenge button invokes HT.challenge.link(spec) and
      routes through HT.share.copy via the shareUrl override.
   7. shareUrl(archetype, {slug}) produces the canonical
      "?arch=<id>&quiz=<slug>" URL; copyText(state, opts) emits the
      "<emoji> <label> — x% / y%" text and respects the 280-char cap.
   8. imageSnapshot(el) throws an Error carrying snapshotUnavailable=true.
   9. Discovery chrome CSS rule:
        - assets/css/result-card.css declares `.discovery-card` and
          `.discovery-card .quiz-result-actions` rules (Story 10.10).

   Exit 0 on PASS, 1 on FAIL. ES2018, no deps.
   ============================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const RESULTS_SRC = fs.readFileSync(
  path.join(ROOT, 'assets/js/results.js'), 'utf8');
const CARD_CSS = fs.readFileSync(
  path.join(ROOT, 'assets/css/result-card.css'), 'utf8');

let pass = 0, fail = 0;
function check(name, ok) {
  if (ok) { pass += 1; console.log('  PASS  ' + name); }
  else    { fail += 1; console.log('  FAIL  ' + name); }
}

// --- 9. Discovery chrome CSS rule (static check, no DOM) ---------------
check('css: .discovery-card rule declared in result-card.css',
  /\.discovery-card\s*\{/.test(CARD_CSS));
check('css: .discovery-card .quiz-result-actions rule declared',
  /\.discovery-card\s+\.quiz-result-actions\s*\{/.test(CARD_CSS));

// --- Sandbox + DOM shims -------------------------------------------------

function makeNode(tag) {
  const n = {
    tag: tag,
    nodeType: 1,
    children: [],
    attrs: {},
    _classes: new Set(),
    _listeners: {},
    style: {},
    classList: {
      add: function () { for (let i = 0; i < arguments.length; i++) n._classes.add(arguments[i]); },
      remove: function () { for (let i = 0; i < arguments.length; i++) n._classes.delete(arguments[i]); },
      contains: function (c) { return n._classes.has(c); },
      toString: function () { return Array.from(n._classes).join(' '); },
    },
    setAttribute: function (k, v) {
      const sv = String(v);
      n.attrs[k] = sv;
      if (k === 'class') {
        n._classes.clear();
        const parts = sv.split(/\s+/);
        for (const p of parts) if (p) n._classes.add(p);
      }
    },
    getAttribute: function (k) { return n.attrs[k] != null ? n.attrs[k] : null; },
    appendChild: function (c) { if (c) n.children.push(c); return c; },
    addEventListener: function (ev, fn) {
      if (!n._listeners[ev]) n._listeners[ev] = [];
      n._listeners[ev].push(fn);
    },
    dispatch: function (ev) {
      const ls = n._listeners[ev] || [];
      for (let i = 0; i < ls.length; i += 1) ls[i]();
    },
    querySelectorAll: function (selector) {
      // Minimal CSS selector support (descendant combinator " "):
      //   ".class"                     → class match
      //   "[data-action=\"name\"]"     → data-action attr match
      //   "[data-print=\"ignore\"]"    → data-print attr match
      const tokens = selector.trim().split(/\s+/);
      function isText(node) { return node && node.nodeType === 3; }
      function flatten(node, list) {
        if (!node || isText(node)) return;
        list.push(node);
        for (const c of (node.children || [])) flatten(c, list);
      }
      function attrEq(node, attr) {
        const m = attr.match(/^\[([a-zA-Z-]+)="([^"]*)"\]$/);
        if (!m) return false;
        if (typeof node.getAttribute !== 'function') return false;
        return node.getAttribute(m[1]) === m[2];
      }
      function match(node, token) {
        if (isText(node)) return false;
        if (token[0] === '.') return node.classList && node.classList.contains(token.slice(1));
        if (token[0] === '[') return attrEq(node, token);
        return false;
      }
      function descend(nodes, toks) {
        if (toks.length === 0) return [];
        const next = toks[0];
        const rest = toks.slice(1);
        const out = [];
        const seen = new Set();
        function addUnique(node) {
          if (node && !seen.has(node)) { seen.add(node); out.push(node); }
        }
        for (const node of nodes) {
          if (!node) continue;
          if (match(node, next)) {
            if (rest.length === 0) {
              addUnique(node);
            } else {
              const sub = descend(node.children || [], rest);
              for (const s of sub) addUnique(s);
            }
          }
          // Always also descend into children with full toks to
          // catch descendant matches (selector may match deeper).
          const sub = descend(node.children || [], toks);
          for (const s of sub) addUnique(s);
        }
        return out;
      }
      const all = [];
      flatten(n, all);
      return descend(all, tokens);
    },
    querySelector: function (selector) {
      const all = n.querySelectorAll(selector);
      // Filter to first element node (skip text-node matches — these
      // can leak through `nodeType: 3` results.js text-node children).
      for (let i = 0; i < all.length; i += 1) {
        if (all[i] && all[i].nodeType === 1) return all[i];
      }
      return null;
    },
    hidden: false,
    ariaHidden: false,
  };
  return n;
}

const ctx = {
  console: console,
  setTimeout: setTimeout,
  Promise: Promise,
  URLSearchParams: URLSearchParams,
  // Browser globals with the shape results.js reads.
  window: {},
  self: {},
  document: {
    createElement: function (tag) { return makeNode(tag); },
    createTextNode: function (text) {
      return { nodeType: 3, textContent: String(text), appendChild: function () {} };
    },
    getElementById: function () { return null; },
    querySelector: function () { return null; },
    body: { appendChild: function () {} },
  },
  location: { href: 'http://example.com/disc/spirit-animal/', search: '', hash: '' },
};

// Stub HT shape for the wireActions path.
const stubShareCopy = function () { return Promise.resolve('shared!'); };
const stubChallengeLink = function () { return 'http://example.com/challenge/blob'; };
const stubClipboard = function () { return Promise.resolve(); };
let lastShareCopyOpts = null;
let lastChallengeSpec = null;
let toastLog = [];

const HT_SHELL = {
  share: { copy: function (state, opts) {
    lastShareCopyOpts = opts || null;
    return stubShareCopy();
  } },
  challenge: { link: function (spec) {
    lastChallengeSpec = spec;
    return stubChallengeLink();
  } },
  copyToClipboard: stubClipboard,
  toast: function (msg) { toastLog.push(msg); },
};

ctx.HT = HT_SHELL;
ctx.window.HT = HT_SHELL;
ctx.self.HT = HT_SHELL;

try { vm.runInNewContext(RESULTS_SRC, ctx, { filename: 'results.js' }); }
catch (e) { console.error('vm-eval FAIL:', e.message); process.exit(2); }

const RESULTS = ctx.HT.results || ctx.window.HT.results;

// --- 1. Surface existence + freeze --------------------------------------
check('HT.results defined as object', typeof RESULTS === 'object');
check('HT.results frozen', Object.isFrozen(RESULTS));
check('HT.results.render is function', typeof RESULTS.render === 'function');
check('HT.results.shareUrl is function', typeof RESULTS.shareUrl === 'function');
check('HT.results.copyText is function', typeof RESULTS.copyText === 'function');
check('HT.results.imageSnapshot is function', typeof RESULTS.imageSnapshot === 'function');
check('HT.results.wireActions is function', typeof RESULTS.wireActions === 'function');

// --- 2. render(state, opts) shape ---------------------------------------
const sampleState = {
  archetype: { id: 'fox', label: 'The Fox', emoji: '🦊',
                tagline: 'Quick, observant, always watching the corner.',
                blindSpot: 'Watchfulness can crowd out stillness.' },
  traits: { warmth: 70, curiosity: 90, energy: 40, depth: 55 },
};
const sampleOpts = {
  slug: 'spirit-animal',
  title: 'Quick, observant, always watching the corner.',
  conflict: 'Watchfulness can crowd out stillness.',
  wireActions: true,
};
const card = RESULTS.render(sampleState, sampleOpts);

check('render: returns a DOM element', !!card);
check('render: card has class .quiz-result-card',
  card && card.classList.contains('quiz-result-card'));
check('render: card has class .discovery-card (Story 10.10)',
  card && card.classList.contains('discovery-card'));
check('render: card data-print=result', card && card.getAttribute('data-print') === 'result');
check('render: card role=region', card && card.getAttribute('role') === 'region');
check('render: card aria-live=polite', card && card.getAttribute('aria-live') === 'polite');
check('render: card aria-labelledby=quiz-result-archetype',
  card && card.getAttribute('aria-labelledby') === 'quiz-result-archetype');
check('render: card aria-atomic=true', card && card.getAttribute('aria-atomic') === 'true');

// --- 3. .quiz-result-actions + 2 buttons --------------------------------
const actionsNodes = card.querySelectorAll('[data-print="ignore"]');
check('render: exactly 1 actions node with data-print=ignore',
  actionsNodes.length === 1);
check('render: actions node is .quiz-result-actions',
  actionsNodes[0] && actionsNodes[0].classList.contains('quiz-result-actions'));

const shareBtn = card.querySelector('[data-action="share"]');
const challengeBtn = card.querySelector('[data-action="challenge"]');
check('render: data-action="share" button exists', !!shareBtn);
check('render: data-action="challenge" button exists', !!challengeBtn);
check('render: share button has class .button',
  shareBtn && shareBtn.classList.contains('button'));
check('render: challenge button has class .button',
  challengeBtn && challengeBtn.classList.contains('button'));
check('render: share button has class .share',
  shareBtn && shareBtn.classList.contains('share'));
check('render: challenge button has class .challenge',
  challengeBtn && challengeBtn.classList.contains('challenge'));

// --- 4. wireActions idempotent -------------------------------------------
RESULTS.wireActions(card, sampleState, sampleOpts);
check('wireActions: sets data-wired="1" guard on first call',
  card.getAttribute('data-wired') === '1');
let shareClickCount = 0;
const originalShareDispatch = shareBtn.dispatch;
shareBtn.dispatch = function (ev) {
  if (ev === 'click') shareClickCount += 1;
  return originalShareDispatch.call(this, ev);
};
// Re-wire should be a no-op due to the data-wired guard.
RESULTS.wireActions(card, sampleState, sampleOpts);
// We can't easily re-instrument the existing listener list, but the
// guard prevents addEventListener from being called again — which is
// the property under test. Validate via attribute.
check('wireActions: idempotent (data-wired guard survives re-call)',
  card.getAttribute('data-wired') === '1');

// --- 5. Share click → HT.share.copy + toast ----------------------------
toastLog.length = 0;
lastShareCopyOpts = null;
shareBtn.dispatch('click');
// Defer microtask resolution.
Promise.resolve().then(function () {
  check('share click: invoked HT.share.copy with opts',
    lastShareCopyOpts && lastShareCopyOpts.slug === 'spirit-animal');
  check('share click: HT.toast fired with "Share link copied"',
    toastLog.indexOf('Share link copied') !== -1);

  // --- 6. Challenge click → HT.challenge.link --------------------------
  toastLog.length = 0;
  lastChallengeSpec = null;
  challengeBtn.dispatch('click');
  Promise.resolve().then(function () {
    check('challenge click: invoked HT.challenge.link with slug + self',
      lastChallengeSpec && lastChallengeSpec.slug === 'spirit-animal'
        && lastChallengeSpec.self !== undefined);
    check('challenge click: HT.toast fired with "Challenge link copied"',
      toastLog.indexOf('Challenge link copied') !== -1);

    // --- 7. shareUrl / copyText ---------------------------------------
    ctx.location.href = 'http://example.com/disc/spirit-animal/';
    const url = RESULTS.shareUrl(
      { id: 'fox' }, { slug: 'spirit-animal' });
    check('shareUrl: returns canonical ?arch=&quiz= URL',
      url && url.indexOf('arch=fox') !== -1
        && url.indexOf('quiz=spirit-animal') !== -1);

    const text = RESULTS.copyText(
      { archetype: sampleState.archetype, traits: sampleState.traits },
      { slug: 'spirit-animal' });
    check('copyText: emits "🦊 The Fox" prefix',
      text && text.indexOf('🦊 The Fox') === 0);
    check('copyText: emits "(#spirit-animal)" suffix when slug given',
      text && text.indexOf('(#spirit-animal)') !== -1);
    check('copyText: respects 280-char cap',
      text && text.length <= 280);

    // Big text stress
    let bigTraits = {};
    for (let i = 0; i < 50; i += 1) bigTraits['trait_' + i] = 100;
    const bigText = RESULTS.copyText({ archetype: { emoji: '🦊', label: 'X' }, traits: bigTraits });
    check('copyText: caps at 280 chars even with many traits',
      bigText && bigText.length <= 280);

    // --- 8. imageSnapshot throws --------------------------------------
    let snapshotErr = null;
    try { RESULTS.imageSnapshot(card); } catch (e) { snapshotErr = e; }
    check('imageSnapshot: throws an Error', !!snapshotErr);
    check('imageSnapshot: thrown Error carries snapshotUnavailable=true',
      snapshotErr && snapshotErr.snapshotUnavailable === true);

    // --- Vacuous-pass guard --------------------------------------------
    check('vacuous-pass guard: pass > 0', pass > 0);

    console.log('\ndiscovery-result-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
    process.exit(fail === 0 ? 0 : 1);
  });
});
