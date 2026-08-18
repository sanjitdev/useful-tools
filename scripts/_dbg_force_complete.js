#!/usr/bin/env node
/* ============================================
   _dbg_force_complete.js — diagnostic only.
   Loads the spirit-animal quiz page in jsdom-ish environment,
   fires the onComplete callback with a synthetic answer set,
   and dumps the resulting HTML.
   ============================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

// Read the core.js file (no need for full DOM — we'll call into
// the onComplete logic directly).
const coreSrc = fs.readFileSync(
  path.join(ROOT, 'tools/packs/discovery/spirit-animal/spirit-animal-core.js'),
  'utf8'
);

// Build a minimal sandbox: stub DOM, HT, Promise, JSON. The core.js
// expects:
//   - window.HT (with quiz, scoring, results, challengeReceiver)
//   - document.getElementById, createElement, body
//   - HT.quiz.open(...) returns a handle with .close()

const calls = [];
function record(label, args) {
  calls.push({ label: label, args: Array.from(args || []) });
}

let quizOpenOpts = null;
let onCompleteCb = null;

const fakeNodes = new Map();
function makeFakeNode(tag) {
  const n = {
    tag, nodeType: 1, attrs: {},
    children: [],
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    style: {},
    setAttribute: function (k, v) { this.attrs[k] = String(v); },
    getAttribute: function (k) { return this.attrs[k] != null ? this.attrs[k] : null; },
    appendChild: function (c) { this.children.push(c); return c; },
    removeChild: function (c) {
      const i = this.children.indexOf(c);
      if (i >= 0) this.children.splice(i, 1);
      return c;
    },
    addEventListener: function (ev, fn) {
      this.attrs['listener_' + ev] = fn;
    },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    set innerHTML(v) { this.attrs.innerHTML = v; this.children = []; },
    get innerHTML() { return this.attrs.innerHTML || ''; },
    textContent: '',
    focus: function () {},
    click: function () {},
  };
  return n;
}

// Capture everything that gets appended into the reveal body
let capturedReveal = null;

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
      quiz: {
        open: function (opts) {
          quizOpenOpts = opts;
          onCompleteCb = opts.onComplete;
          return {
            close: function () { record('handle.close', []); },
          };
        },
      },
      scoring: {
        score: function (answers, spec) {
          // Synthesize a "fox" result for any answer set
          return {
            archetype: { id: 'fox', label: 'Fox', emoji: '🦊', default: true },
            traits: { intuition: 90, courage: 55, wisdom: 60, patience: 45 },
          };
        },
      },
      results: {
        render: function (state, opts) {
          record('HT.results.render', [state, opts]);
          // Build a real DOM node so we can inspect
          const card = makeFakeNode('article');
          card.setAttribute('class', 'quiz-result-card discovery-card');
          card.setAttribute('data-print', 'result');
          // header
          const header = makeFakeNode('header');
          header.setAttribute('class', 'quiz-result-header');
          const emoji = makeFakeNode('div');
          emoji.setAttribute('class', 'quiz-result-emoji');
          if (state.archetype && state.archetype.emoji) {
            emoji.textContent = state.archetype.emoji;
          }
          header.appendChild(emoji);
          const h2 = makeFakeNode('h2');
          h2.setAttribute('id', 'quiz-result-archetype');
          h2.setAttribute('class', 'quiz-result-archetype');
          h2.textContent = (state.archetype && (state.archetype.label || state.archetype.id)) || 'Result';
          header.appendChild(h2);
          if (opts && opts.title) {
            const tagline = makeFakeNode('p');
            tagline.setAttribute('class', 'quiz-result-tagline');
            tagline.textContent = opts.title;
            header.appendChild(tagline);
          }
          card.appendChild(header);
          if (opts && opts.conflict) {
            const c = makeFakeNode('p');
            c.setAttribute('class', 'quiz-result-contrarian');
            c.textContent = opts.conflict;
            card.appendChild(c);
          }
          // bars
          const bars = makeFakeNode('div');
          bars.setAttribute('class', 'quiz-result-trait-bar-list');
          const traits = state.traits || {};
          Object.keys(traits).forEach(function (id) {
            const bar = makeFakeNode('div');
            bar.setAttribute('class', 'quiz-result-trait-bar');
            bar.textContent = id + ': ' + traits[id] + '%';
            bars.appendChild(bar);
          });
          card.appendChild(bars);
          // actions
          const actions = makeFakeNode('div');
          actions.setAttribute('class', 'quiz-result-actions');
          actions.setAttribute('data-print', 'ignore');
          const shareBtn = makeFakeNode('button');
          shareBtn.setAttribute('data-action', 'share');
          shareBtn.textContent = 'Share';
          actions.appendChild(shareBtn);
          const challengeBtn = makeFakeNode('button');
          challengeBtn.setAttribute('data-action', 'challenge');
          challengeBtn.textContent = 'Challenge a friend';
          actions.appendChild(challengeBtn);
          card.appendChild(actions);
          capturedReveal = card;
          return card;
        },
        wireActions: function () { record('wireActions', []); },
      },
      challengeReceiver: {
        landing: function () { return { ok: false }; },
        getChallengeBlob: function () { return null; },
      },
      share: { copy: function () { return Promise.resolve(); } },
      challenge: { link: function () { return ''; } },
      copyToClipboard: function () {},
      toast: function (msg) { record('HT.toast', [msg]); },
    },
  },
  self: {},
  document: {
    createElement: makeFakeNode,
    createTextNode: function (t) { return { nodeType: 3, textContent: t }; },
    getElementById: function (id) {
      if (id === 'quiz-mount') {
        const n = makeFakeNode('section');
        n.id = 'quiz-mount';
        // Provide a fake .quiz-reveal .quiz-reveal-body subtree
        const reveal = makeFakeNode('div');
        reveal.setAttribute('class', 'quiz-reveal');
        const body = makeFakeNode('div');
        body.setAttribute('class', 'quiz-reveal-body');
        reveal.appendChild(body);
        n.appendChild(reveal);
        n.body = body;
        return n;
      }
      return null;
    },
    querySelector: function () { return null; },
    body: makeFakeNode('body'),
    documentElement: { setAttribute: function () {}, getAttribute: function () { return null; } },
    head: { appendChild: function () {} },
    currentScript: null,
    readyState: 'complete',
    addEventListener: function () {},
  },
  location: { href: 'http://localhost/', protocol: 'http:', pathname: '/', search: '' },
  history: { replaceState: function () {} },
  fetch: function () { return Promise.reject(new Error('no fetch')); },
};

// Run core.js in the sandbox
const vm = require('vm');
vm.createContext(ctx);
try {
  vm.runInContext(coreSrc, ctx, { filename: 'spirit-animal-core.js' });
} catch (e) {
  console.error('core.js eval failed:', e.message);
  console.error(e.stack);
  process.exit(1);
}

console.log('quizOpenOpts:', !!quizOpenOpts, 'onComplete:', typeof onCompleteCb);
if (!onCompleteCb) {
  console.log('FAIL: onComplete callback never captured');
  process.exit(1);
}

// Fire onComplete with synthetic answers
try {
  onCompleteCb({ 'q1-path': 'forest', 'q2-storm': 'shield' });
} catch (e) {
  console.error('onComplete threw:', e.message);
  console.error(e.stack);
  process.exit(1);
}

console.log('\n--- Captured calls ---');
for (const c of calls) {
  if (c.label === 'HT.results.render') {
    console.log(`  ${c.label}: state.archetype = ${JSON.stringify(c.args[0].archetype)}`);
    console.log(`  ${c.label}: state.traits = ${JSON.stringify(c.args[0].traits)}`);
    console.log(`  ${c.label}: opts = ${JSON.stringify(c.args[1])}`);
  } else {
    console.log(`  ${c.label}`);
  }
}

console.log('\n--- Captured reveal ---');
if (!capturedReveal) {
  console.log('FAIL: reveal never built');
  process.exit(1);
}
function dump(node, indent) {
  indent = indent || '';
  if (!node) return;
  const cls = node.attrs && node.attrs['class'];
  const tag = node.tag || node.nodeType === 3 ? '#text' : '?';
  console.log(indent + `<${tag}${cls ? ' class="' + cls + '"' : ''}> ${(node.textContent || '').slice(0, 40)}`);
  for (const c of (node.children || [])) dump(c, indent + '  ');
}
dump(capturedReveal);

console.log('\nreveal children count:', capturedReveal.children.length);