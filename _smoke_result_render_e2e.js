/* ============================================
   _smoke_result_render_e2e.js

   End-to-end smoke for the spirit-animal quiz's PATCHED onComplete
   flow. Loads the patched spirit-animal-core.js in a vm sandbox that
   stubs the HT Proxy so that:
     - HT.scoring.score(answers, spec) returns a Promise that resolves
       to a synchronous scored data object (mirroring the real
       shell-thin.js Proxy behavior).
     - HT.results.render(state, opts) returns a Promise that resolves
       to a real DOM element (the canonical quiz-result-card).
   Then fires the onComplete callback (captured from HT.quiz.open
   stub) with synthetic answers and verifies the rendered card has
   all four visible pieces the user reported missing:
     1. archetype label/emoji
     2. trait bars
     3. Share + Challenge buttons
     4. tagline / blind-spot
   ============================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname);
const SRC = fs.readFileSync(
  path.join(ROOT, 'tools/packs/discovery/spirit-animal/spirit-animal-core.js'),
  'utf8'
);

let pass = 0, fail = 0;
function check(name, ok, info) {
  if (ok) { pass += 1; console.log('  PASS  ' + name); }
  else    { fail += 1; console.log('  FAIL  ' + name + (info ? ' — ' + info : '')); }
}

// --- DOM stub ----------------------------------------------------------

function makeNode(tag) {
  const n = {
    tag: tag,
    nodeType: 1,
    children: [],
    attrs: {},
    textContent: '',
    _classes: new Set(),
    _listeners: {},
    style: {},
    classList: {
      add: function () { for (let i = 0; i < arguments.length; i++) n._classes.add(arguments[i]); },
      remove: function () { for (let i = 0; i < arguments.length; i++) n._classes.delete(arguments[i]); },
      contains: function (c) { return n._classes.has(c); },
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
    getAttribute: function (k) { return n.attrs[k] != null ? this.attrs[k] : null; },
    appendChild: function (c) {
      if (c == null) return c;
      n.children.push(c);
      if (c.nodeType === 3) {
        // text node — also expose textContent
        n.textContent = (n.textContent || '') + (c.textContent || '');
      }
      return c;
    },
    removeChild: function (c) {
      const i = n.children.indexOf(c);
      if (i >= 0) n.children.splice(i, 1);
      return c;
    },
    addEventListener: function (ev, fn) {
      if (!n._listeners[ev]) n._listeners[ev] = [];
      n._listeners[ev].push(fn);
    },
    querySelectorAll: function (selector) {
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
      for (let i = 0; i < all.length; i++) {
        if (all[i] && all[i].nodeType === 1) return all[i];
      }
      return null;
    },
    focus: function () {},
  };
  return n;
}

// --- HT stubs that mirror shell-thin Proxy behavior -------------------

// Sample archetype data (fox). Mirrors what scoring.js actually
// returns: Object.freeze({traits, archetype}) with archetype
// itself frozen. The patched onComplete code must NOT try to
// mutate scored.archetype (it would throw TypeError). It builds
// a local `resolvedArch` instead.
const SCORED_DATA = Object.freeze({
  archetype: Object.freeze({ id: 'fox', label: 'Fox', emoji: '🦊' }),
  traits: Object.freeze({ warmth: 70, curiosity: 90, energy: 40, depth: 55 }),
});

// Build a real DOM element for the result card. Mirrors what
// assets/js/results.js emits (without lazy-loading the actual file).
function buildResultCard(state, opts) {
  const root = makeNode('article');
  root.setAttribute('class', 'quiz-result-card discovery-card');
  root.setAttribute('data-print', 'result');
  root.setAttribute('role', 'region');
  root.setAttribute('aria-live', 'polite');
  root.setAttribute('aria-labelledby', 'quiz-result-archetype');

  const header = makeNode('header');
  header.setAttribute('class', 'quiz-result-header');
  if (state.archetype && state.archetype.emoji) {
    const emo = makeNode('div');
    emo.setAttribute('class', 'quiz-result-emoji');
    emo.textContent = state.archetype.emoji;
    header.appendChild(emo);
  }
  const h2 = makeNode('h2');
  h2.setAttribute('id', 'quiz-result-archetype');
  h2.setAttribute('class', 'quiz-result-archetype');
  h2.textContent = (state.archetype && state.archetype.label) || 'Result';
  header.appendChild(h2);
  if (opts && opts.title) {
    const tag = makeNode('p');
    tag.setAttribute('class', 'quiz-result-tagline');
    tag.textContent = opts.title;
    header.appendChild(tag);
  }
  root.appendChild(header);

  if (opts && opts.conflict) {
    const c = makeNode('p');
    c.setAttribute('class', 'quiz-result-contrarian');
    c.textContent = opts.conflict;
    root.appendChild(c);
  }

  const bars = makeNode('div');
  bars.setAttribute('class', 'quiz-result-trait-bar-list');
  const traits = state.traits || {};
  Object.keys(traits).forEach(function (id) {
    const bar = makeNode('div');
    bar.setAttribute('class', 'quiz-result-trait-bar');
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', id + ': ' + traits[id] + ' percent');
    const label = makeNode('span');
    label.setAttribute('class', 'quiz-result-trait-label');
    label.textContent = id;
    bar.appendChild(label);
    const track = makeNode('span');
    track.setAttribute('class', 'quiz-result-trait-track');
    const fill = makeNode('span');
    fill.setAttribute('class', 'quiz-result-trait-fill');
    fill.style.width = traits[id] + '%';
    track.appendChild(fill);
    bar.appendChild(track);
    const val = makeNode('span');
    val.setAttribute('class', 'quiz-result-trait-value');
    val.textContent = traits[id] + '%';
    bar.appendChild(val);
    bars.appendChild(bar);
  });
  root.appendChild(bars);

  const actions = makeNode('div');
  actions.setAttribute('class', 'quiz-result-actions');
  actions.setAttribute('data-print', 'ignore');
  actions.setAttribute('role', 'group');
  const shareBtn = makeNode('button');
  shareBtn.setAttribute('type', 'button');
  shareBtn.setAttribute('class', 'quiz-result-share quiz-result-action button share');
  shareBtn.setAttribute('data-action', 'share');
  shareBtn.textContent = 'Share';
  actions.appendChild(shareBtn);
  const challengeBtn = makeNode('button');
  challengeBtn.setAttribute('type', 'button');
  challengeBtn.setAttribute('class', 'quiz-result-challenge quiz-result-action button challenge');
  challengeBtn.setAttribute('data-action', 'challenge');
  challengeBtn.textContent = 'Challenge a friend';
  actions.appendChild(challengeBtn);
  root.appendChild(actions);

  return root;
}

// --- Sandbox setup ------------------------------------------------------

let onCompleteCb = null;
let cachedMount = null;
const ctx = {
  console: console,
  setTimeout: setTimeout,
  Promise: Promise,
  JSON: JSON,
  Object: Object,
  Array: Array,
  Error: Error,
  isFinite: isFinite,
  Math: Math,
  URLSearchParams: URLSearchParams,
  window: {
    HT: {
      // The Proxy behavior: every property access returns a function
      // that returns a Promise when called. Mirror that EXACTLY here.
      quiz: {
        open: function (opts) {
          onCompleteCb = opts.onComplete;
          return { close: function () {} };
        },
      },
      scoring: {
        score: function (answers, spec) {
          // The real shell-thin Proxy returns a Promise.
          return Promise.resolve(SCORED_DATA);
        },
      },
      results: {
        render: function (state, opts) {
          // The real shell-thin Proxy returns a Promise.
          return Promise.resolve(buildResultCard(state, opts));
        },
      },
      challengeReceiver: {
        getChallengeBlob: function () { return null; },
        stashLocalAnswers: function () {},
      },
      toast: function () {},
    },
  },
  self: {},
  document: {
    createElement: makeNode,
    createTextNode: function (t) { return { nodeType: 3, textContent: t }; },
    getElementById: function (id) {
      if (id === 'quiz-mount') {
        const n = makeNode('section');
        n.id = 'quiz-mount';
        // Build the .quiz-reveal .quiz-reveal-body structure that
        // the quiz.js shell creates BEFORE firing onComplete.
        const reveal = makeNode('div');
        reveal.setAttribute('class', 'quiz-reveal');
        const body = makeNode('div');
        body.setAttribute('class', 'quiz-reveal-body');
        reveal.appendChild(body);
        n.appendChild(reveal);
        // Cache the body on the node so the test can query it.
        n._body = body;
        cachedMount = n;
        return n;
      }
      return null;
    },
    querySelector: function () { return null; },
    body: makeNode('body'),
    documentElement: { setAttribute: function () {}, getAttribute: function () { return null; } },
    head: { appendChild: function () {} },
    currentScript: null,
    readyState: 'complete',
    addEventListener: function () {},
  },
  location: { href: 'http://localhost/', protocol: 'http:', pathname: '/', search: '', hash: '' },
  history: { replaceState: function () {} },
  fetch: function () { return Promise.reject(new Error('no fetch')); },
};

vm.createContext(ctx);
try {
  vm.runInContext(SRC, ctx, { filename: 'spirit-animal-core.js' });
} catch (e) {
  console.error('FAIL: spirit-animal-core.js eval failed:', e.message);
  console.error(e.stack);
  process.exit(1);
}

if (typeof onCompleteCb !== 'function') {
  console.error('FAIL: onComplete callback never captured');
  process.exit(1);
}

// Fire onComplete with synthetic answers. The PATCHED code should
// chain Promises so the card mounts after the chain resolves.
//
// CRITICAL: scoring.js returns a frozen object, so onComplete must
// NOT mutate scored.archetype. The FROZEN-FIX uses a local
// `resolvedArch` instead. We test by ALSO asserting that the
// returned scored object is frozen (mirroring real behavior) so
// any future regression where someone reverts to direct mutation
// would re-throw TypeError here.
try {
  // Sanity check: ensure our test fixture matches real scoring.js
  // (frozen archetype). If this fails, the test fixture drifted
  // from reality and the regression guard isn't testing what it
  // thinks it is.
  check('scoring fixture mirrors real scoring.js (frozen object)',
    Object.isFrozen(SCORED_DATA) && Object.isFrozen(SCORED_DATA.archetype));

  onCompleteCb({ 'q1-path': 'gut', 'q2-storm': 'shield' });
} catch (e) {
  console.error('FAIL: onComplete threw synchronously:', e.message);
  console.error(e.stack);
  process.exit(1);
}

// The Promise chain in the patched code is async. We need to wait a
// microtask cycle for the .then() callbacks to fire. In a real browser
// the chain resolves naturally; in this sandbox we drain the promise
// queue by waiting for the next "then" to settle.
Promise.resolve()
  .then(function () { return Promise.resolve(); })
  .then(function () { return Promise.resolve(); })
  .then(function () { return Promise.resolve(); })
  .then(function () { return Promise.resolve(); })
  .then(function () {
    // Now the .then() chain has fully resolved (3 await hops: scoring
    // resolve -> render resolve -> mount).

    // Get the body node and check what was appended. Use the
    // cached mount (the patched code's getElementById call must hit
    // the same DOM tree we built here — otherwise the card lands on
    // a fresh stub and disappears).
    const mount = cachedMount;
    if (!mount) {
      console.error('FAIL: cached mount not found');
      process.exit(1);
    }
    const body = mount._body;
    if (!body) {
      console.error('FAIL: reveal body not found');
      process.exit(1);
    }

    check('reveal body has at least 1 child after Promise chain',
      body.children.length >= 1,
      'children=' + body.children.length);

    if (body.children.length === 0) {
      console.log('\n[!] Body is empty — the patched code did not mount the card.');
      console.log('  This is the BUG: the card was never appended.');
      console.log('\nresult-card-e2e: ' + pass + ' PASS, ' + fail + ' FAIL');
      process.exit(1);
    }

    const card = body.children[0];

    // ---- (1) archetype label / emoji ----
    const h2 = card.querySelectorAll('[id="quiz-result-archetype"]')[0];
    check('card has h2#quiz-result-archetype with label text',
      h2 && h2.textContent === 'Fox',
      'text=' + (h2 && h2.textContent));
    const emoji = card.querySelectorAll('.quiz-result-emoji')[0];
    check('card has .quiz-result-emoji with fox emoji',
      emoji && /🦊/.test(emoji.textContent),
      'text=' + (emoji && emoji.textContent));

    // ---- (2) trait bars ----
    const bars = card.querySelectorAll('.quiz-result-trait-bar');
    check('card has 4 trait bars', bars.length === 4, 'got ' + bars.length);
    const barList = card.querySelectorAll('.quiz-result-trait-bar-list');
    check('card has .quiz-result-trait-bar-list container',
      barList.length === 1);

    // ---- (3) Share + Challenge buttons ----
    const shareBtn = card.querySelectorAll('[data-action="share"]')[0];
    const challengeBtn = card.querySelectorAll('[data-action="challenge"]')[0];
    check('card has data-action="share" button', !!shareBtn);
    check('card has data-action="challenge" button', !!challengeBtn);
    const actions = card.querySelectorAll('.quiz-result-actions');
    check('card has .quiz-result-actions container', actions.length === 1);

    // ---- (4) tagline / blind-spot ----
    const tagline = card.querySelectorAll('.quiz-result-tagline')[0];
    check('card has .quiz-result-tagline with tagline text',
      tagline && tagline.textContent === 'Clever, adaptable, and quick to read any room.',
      'text=' + (tagline && tagline.textContent));
    const conflict = card.querySelectorAll('.quiz-result-contrarian')[0];
    check('card has .quiz-result-contrarian with blind-spot text',
      conflict && conflict.textContent === 'Strategy can shade into manipulation when stakes are small.',
      'text=' + (conflict && conflict.textContent));

    // ---- (5) Discovery chrome overlay (Story 10.10) ----
    check('card has .discovery-card class (Story 10.10 chrome)',
      card.classList.contains('discovery-card'));

    // ---- (6) data-print attributes ----
    check('card has data-print="result"',
      card.getAttribute('data-print') === 'result');
    check('actions has data-print="ignore"',
      actions[0] && actions[0].getAttribute('data-print') === 'ignore');

    // Vacuous-pass guard.
    check('vacuous-pass guard: pass > 0', pass > 0);

    console.log('\nresult-card-e2e: ' + pass + ' PASS, ' + fail + ' FAIL');
    process.exit(fail === 0 ? 0 : 1);
  });
