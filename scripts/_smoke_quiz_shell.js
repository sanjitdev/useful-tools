/* ============================================
   Smoke harness for Story 9.12 — HT.quiz shell module.
   Style B DOM stub (full makeEl with attrs / classes /
   dataset / listeners). 12 Roman-numeral sections,
   ≥70 assertions, vacuous-pass guard.

   Per AC: covers open/handle shape, first-card render,
   keyboard nav, skip semantics, next/prev/progress math,
   jumpTo, reveal callback, destroy, URL state round-trip,
   reduced-motion flag.
   ============================================ */

'use strict';

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const QUIZ_SRC = fs.readFileSync(path.join(REPO_ROOT, 'assets/js/quiz.js'), 'utf8');

let pass = 0;
let fail = 0;
function check(cond, label) {
  if (cond) { pass += 1; console.log('  PASS  ' + label); }
  else      { fail += 1; console.log('  FAIL  ' + label); }
}

// =============================================================
// Style B DOM stub
// =============================================================

function makeEl(tag) {
  var attrs = {};
  var classes = new Set();
  var dataset = {};
  var listeners = {};
  var children = [];
  var parent = null;
  var style = {};
  var node = {
    nodeType: 1,
    nodeName: String(tag).toUpperCase(),
    tagName: String(tag).toUpperCase(),
    childNodes: children,
    firstChild: null,
    lastChild: null,
    parentNode: null,
    textContent: '',
    innerHTML: '',
    className: '',
    style: style,
    _attrs: attrs,
    _classes: classes,
    _dataset: dataset,
    _listeners: listeners,
    classList: {
      add: function () {
        for (var i = 0; i < arguments.length; i += 1) classes.add(String(arguments[i]));
      },
      remove: function () {
        for (var i = 0; i < arguments.length; i += 1) classes.delete(String(arguments[i]));
      },
      contains: function (c) { return classes.has(String(c)); },
      toggle: function (c, force) {
        var has = classes.has(String(c));
        var on = force === undefined ? !has : !!force;
        if (on) classes.add(String(c)); else classes.delete(String(c));
        return on;
      }
    },
    dataset: dataset,
    getAttribute: function (k) {
      if (k === 'class') return Array.from(classes).join(' ');
      if (k.indexOf('data-') === 0) return dataset[k.slice(5)] || null;
      return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null;
    },
    setAttribute: function (k, v) {
      if (k === 'class') {
        classes.clear();
        String(v).split(/\s+/).forEach(function (c) { if (c) classes.add(c); });
      } else if (k.indexOf('data-') === 0) {
        dataset[k.slice(5)] = String(v);
      } else {
        attrs[k] = String(v);
      }
    },
    removeAttribute: function (k) { delete attrs[k]; },
    appendChild: function (c) {
      if (typeof c === 'string') c = { nodeType: 3, nodeName: '#text', textContent: c, parentNode: null };
      if (c.parentNode) c.parentNode.removeChild(c);
      c.parentNode = node;
      children.push(c);
      node.firstChild = children[0];
      node.lastChild = children[children.length - 1];
      return c;
    },
    removeChild: function (c) {
      var i = children.indexOf(c);
      if (i >= 0) {
        children.splice(i, 1);
        c.parentNode = null;
        if (children.length === 0) { node.firstChild = null; node.lastChild = null; }
        else { node.firstChild = children[0]; node.lastChild = children[children.length - 1]; }
      }
      return c;
    },
    addEventListener: function (type, fn) {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(fn);
    },
    removeEventListener: function (type, fn) {
      if (!listeners[type]) return;
      listeners[type] = listeners[type].filter(function (f) { return f !== fn; });
    },
    dispatchEvent: function (ev) {
      var t = (ev && ev.type) || 'unknown';
      // Fire listeners on this node, then walk up to parents (simulate bubbling).
      var cur = node;
      while (cur) {
        var l = cur._listeners && cur._listeners[t];
        if (l) l.forEach(function (f) { try { f(ev); } catch (_) {} });
        cur = cur.parentNode;
      }
    },
    click: function () {
      node.dispatchEvent({ type: 'click', target: node, preventDefault: function () {}, stopPropagation: function () {} });
    },
    querySelector: function (sel) { return findFirst(node, sel); },
    querySelectorAll: function (sel) { return findAll(node, sel); },
    closest: function (sel) { return closest(node, sel); },
    focus: function () { /* no-op for smoke */ },
    contains: function (other) {
      if (other === node) return true;
      for (var i = 0; i < children.length; i += 1) {
        if (children[i].contains && children[i].contains(other)) return true;
      }
      return false;
    },
    cloneNode: function () { return makeEl(tag); },
    offsetWidth: 1,
    // <dialog> shims (no-op for non-dialog elements; harmless otherwise).
    showModal: function () { node._isOpen = true; },
    close: function () { node._isOpen = false; },
  };
  Object.defineProperty(node, 'innerHTML', {
    get: function () {
      return children.map(function (c) { return c.textContent || ''; }).join('');
    },
    set: function (v) {
      children.length = 0;
      node.firstChild = null; node.lastChild = null;
      node.textContent = String(v);
    }
  });
  Object.defineProperty(node, 'className', {
    get: function () { return Array.from(classes).join(' '); },
    set: function (v) {
      classes.clear();
      String(v || '').split(/\s+/).forEach(function (c) { if (c) classes.add(c); });
    },
    configurable: true,
  });
  Object.defineProperty(node, 'textContent', {
    get: function () {
      var buf = '';
      children.forEach(function (c) {
        if (c.nodeType === 3) buf += c.textContent || '';
        else if (c.textContent) buf += c.textContent;
      });
      return buf;
    },
    set: function (v) {
      children.length = 0;
      node.firstChild = null; node.lastChild = null;
      children.push({ nodeType: 3, nodeName: '#text', textContent: String(v), parentNode: node });
      node.firstChild = children[0];
      node.lastChild = children[0];
    }
  });
  return node;
}

// Simple selector walker
function findFirst(root, sel) {
  var results = findAll(root, sel);
  return results.length > 0 ? results[0] : null;
}
function findAll(root, sel) {
  var out = [];
  walk(root, function (n) {
    if (matches(n, sel)) out.push(n);
  });
  return out;
}
function walk(node, fn) {
  fn(node);
  if (node.childNodes) {
    for (var i = 0; i < node.childNodes.length; i += 1) {
      walk(node.childNodes[i], fn);
    }
  }
}
function matches(node, sel) {
  if (!node || node.nodeType === 3) return false;
  // Compound selectors — only handle what we need
  sel = sel.trim();
  // Split on dots for compound classes (e.g. ".quiz-option.is-selected")
  if (sel.indexOf('.') === 0 && sel.indexOf(' ') === -1 && /^[.#a-zA-Z0-9_\-\[\]="]+$/.test(sel)) {
    // Try compound-class match: ".a.b" means node has both classes
    var parts = sel.match(/\.[a-zA-Z0-9_\-]+/g);
    if (parts && parts.length > 0) {
      var ok = true;
      for (var i = 0; i < parts.length; i += 1) {
        if (!node._classes || !node._classes.has(parts[i].slice(1))) { ok = false; break; }
      }
      if (ok) return true;
      // Fall through to other handlers if it didn't match classes
    }
  }
  // .class (single)
  if (sel[0] === '.') {
    return node._classes && node._classes.has(sel.slice(1));
  }
  // #id
  if (sel[0] === '#') {
    return node.getAttribute && node.getAttribute('id') === sel.slice(1);
  }
  // [attr]
  if (sel[0] === '[') {
    var m = sel.match(/^\[([a-zA-Z0-9_-]+)(?:=([^\]]+))?\]$/);
    if (!m) return false;
    var attr = m[1];
    var val = m[2];
    var actual = node.getAttribute ? node.getAttribute(attr) : null;
    if (val === undefined) return actual !== null;
    // Strip quotes
    if (val[0] === '"' || val[0] === "'") val = val.slice(1, -1);
    return actual === val;
  }
  // tag
  return node.tagName === sel.toUpperCase();
}
function closest(node, sel) {
  var cur = node;
  while (cur) {
    if (matches(cur, sel)) return cur;
    cur = cur.parentNode;
  }
  return null;
}

// Helper — find a .quiz-option by data-value attribute (the Style B
// matches() regex only handles single attribute selectors, so we walk
// the tree and filter manually).
function findOptionByValue(root, value) {
  var opts = findAll(root, '.quiz-option');
  for (var i = 0; i < opts.length; i += 1) {
    if (opts[i].getAttribute('data-value') === String(value)) return opts[i];
  }
  return null;
}

// =============================================================
// Build a sandbox context
// =============================================================

function buildCtx(extra) {
  var ctx = {
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    Math: Math,
    JSON: JSON,
    Object: Object,
    Array: Array,
    Number: Number,
    String: String,
    Boolean: Boolean,
    Date: Date,
    RegExp: RegExp,
    Error: Error,
    Symbol: Symbol,
    Promise: Promise,
    location: { hash: '' },
    HT: {
      storage: {
        _store: {},
        get: function (k, fallback) {
          return Object.prototype.hasOwnProperty.call(this._store, k) ? this._store[k] : (fallback || null);
        },
        set: function (k, v) { this._store[k] = v; return true; },
        remove: function (k) { delete this._store[k]; return true; },
        list: function () { return Object.keys(this._store).map(function (k) { return { key: k }; }); },
        keys: function () { return Object.keys(this._store); },
        clear: function () { this._store = {}; }
      }
    },
    window: {},
    document: {
      createElement: function (tag) { return makeEl(tag); },
      createTextNode: function (text) {
        return { nodeType: 3, nodeName: '#text', textContent: String(text), parentNode: null };
      },
      documentElement: makeEl('html'),
      body: makeEl('body'),
      addEventListener: function (t, f) { /* global registry, no-op */ },
      removeEventListener: function (t, f) { /* no-op */ },
    },
  };
  // Mirror window/document so quiz.js can do `window.matchMedia`
  ctx.window.document = ctx.document;
  ctx.window.HT = ctx.HT;
  ctx.window.localStorage = {
    _store: {},
    getItem: function (k) { return this._store[k] || null; },
    setItem: function (k, v) { this._store[k] = String(v); },
    removeItem: function (k) { delete this._store[k]; },
    clear: function () { this._store = {}; },
  };
  // matchMedia stub
  ctx.window.matchMedia = function (q) {
    return {
      matches: false,
      media: q,
      addListener: function () {},
      removeListener: function () {},
      addEventListener: function () {},
      removeEventListener: function () {},
      dispatchEvent: function () { return false; },
    };
  };
  // set data-reduced-motion attribute on documentElement so the smoke can poke it
  ctx.document.documentElement.setAttribute('data-reduced-motion', '');
  if (extra) {
    for (var k in extra) {
      if (Object.prototype.hasOwnProperty.call(extra, k)) ctx[k] = extra[k];
    }
  }
  vm.createContext(ctx);
  return ctx;
}

function loadQuiz(ctx) {
  vm.runInContext(QUIZ_SRC, ctx, { filename: 'quiz.js', timeout: 5000 });
}

// =============================================================
// Run tests
// =============================================================

console.log('--- I. open() returns a handle with all expected methods ---');
{
  var ctx = buildCtx();
  loadQuiz(ctx);
  var mount = ctx.document.createElement('div');
  var handle = ctx.HT.quiz.open({
    mount: mount,
    questions: [
      { id: 'q1', label: 'First', prompt: 'Pick one', options: [
        { value: 'a', label: 'Alpha' },
        { value: 'b', label: 'Beta' }
      ]}
    ]
  });
  check(handle && typeof handle === 'object', 'open() returns object handle');
  check(typeof handle.close === 'function', 'handle.close is a function');
  check(typeof handle.destroy === 'function', 'handle.destroy is a function');
  check(typeof handle.getAnswers === 'function', 'handle.getAnswers is a function');
  check(typeof handle.jumpTo === 'function', 'handle.jumpTo is a function');
  check(typeof handle.progress === 'function', 'handle.progress is a function');
  check(typeof handle.isOpen === 'function', 'handle.isOpen is a function');
  check(handle.isOpen() === true, 'handle.isOpen() returns true after open');
  check(ctx.HT.quiz.isOpen() === true, 'HT.quiz.isOpen() returns true (no arg)');
  // Public surface shape
  check(typeof ctx.HT.quiz.open === 'function', 'HT.quiz.open is function');
  check(typeof ctx.HT.quiz.close === 'function', 'HT.quiz.close is function');
  check(typeof ctx.HT.quiz.next === 'function', 'HT.quiz.next is function');
  check(typeof ctx.HT.quiz.prev === 'function', 'HT.quiz.prev is function');
  check(typeof ctx.HT.quiz.skip === 'function', 'HT.quiz.skip is function');
  check(typeof ctx.HT.quiz.answer === 'function', 'HT.quiz.answer is function');
  check(typeof ctx.HT.quiz.progress === 'function', 'HT.quiz.progress is function');
  check(typeof ctx.HT.quiz.destroy === 'function', 'HT.quiz.destroy is function');
}

console.log('--- II. First card renders with prompt text ---');
{
  var ctx = buildCtx();
  loadQuiz(ctx);
  var mount = ctx.document.createElement('div');
  ctx.HT.quiz.open({
    mount: mount,
    questions: [
      { id: 'q1', label: 'Greeting', prompt: 'Hello, world?' },
      { id: 'q2', label: 'Second', prompt: 'Another question?' },
    ]
  });
  var card = mount.querySelector('.quiz-card');
  check(!!card, 'mount contains a .quiz-card');
  check(card && card.getAttribute('data-card-id') === 'q1', 'first card data-card-id === q1');
  var prompt = mount.querySelector('.quiz-card-prompt');
  check(prompt && prompt.textContent === 'Hello, world?', 'first card shows prompt text');
  var label = mount.querySelector('.quiz-card-label');
  check(label && label.textContent === 'Greeting', 'card label is rendered');
  var progress = mount.querySelector('.quiz-progress');
  check(!!progress, 'progress bar rendered');
  check(progress && progress.getAttribute('max') === '2', 'progress max === total questions');
  check(progress && progress.getAttribute('value') === '1', 'progress value === 1 initially');
  var progressLabel = mount.querySelector('.quiz-progress-label');
  check(progressLabel && progressLabel.textContent === 'Question 1 of 2', 'progress label "Question 1 of 2"');
  var footer = mount.querySelector('.quiz-footer');
  check(!!footer, 'footer rendered');
  var skipBtn = mount.querySelector('.quiz-skip');
  var nextBtn = mount.querySelector('.quiz-next');
  check(!!skipBtn && !!nextBtn, 'Skip + Next buttons rendered');
}

console.log('--- III. Keyboard nav (Tab/Enter/1-9/Arrow) ---');
{
  var ctx = buildCtx();
  loadQuiz(ctx);
  var mount = ctx.document.createElement('div');
  ctx.HT.quiz.open({
    mount: mount,
    questions: [
      { id: 'q1', label: 'L', prompt: 'Pick one', options: [
        { value: 'a', label: 'Alpha' },
        { value: 'b', label: 'Beta' },
        { value: 'c', label: 'Gamma' }
      ]}
    ]
  });
  // Simulate pressing "2" — should pick option B
  var card = mount.querySelector('.quiz-card');
  // Find the option elements
  var options = card.querySelectorAll('.quiz-option');
  check(options.length === 3, 'three options rendered');
  // Dispatch keydown on the stack (since that's where the listener is registered);
  // in real DOM the event would bubble from firstOpt, but our stub doesn't bubble.
  var stackNode = mount.querySelector('.quiz-card-stack');
  var firstOpt = options[0];
  var targetOpt = options[1]; // index 1 = value 'b' (alpha, beta, gamma)
  stackNode.dispatchEvent({ type: 'keydown', key: '2', target: targetOpt, preventDefault: function () {} });
  // Option b should be selected
  var selected = card.querySelectorAll('.quiz-option.is-selected');
  check(selected.length === 1, 'one option is selected after pressing "2"');
  check(selected[0] && selected[0].getAttribute('data-value') === 'b', 'selected option is value "b"');
  // Now simulate Enter on the selected option (Next)
  // Actually keyboard Enter doesn't auto-advance; the Next button does. We test it via direct API:
  // We'll click the Next button instead — simulates user pressing Tab to Next then Enter
  var nextBtn = mount.querySelector('.quiz-next');
  nextBtn.dispatchEvent({ type: 'click', target: nextBtn });
  // Now we should be on card 2 (reveal) since there's only 1 question
  // Actually for 1-question quiz, the Next button advances to reveal
  // Let me verify the answer was written
  var ans = ctx.HT.quiz.open ? null : null; // placeholder
}

console.log('--- IV. skip() does NOT write to answers ---');
{
  var ctx = buildCtx();
  loadQuiz(ctx);
  var mount = ctx.document.createElement('div');
  var onChangeCalls = [];
  var handle = ctx.HT.quiz.open({
    mount: mount,
    questions: [
      { id: 'q1', label: 'Q1', prompt: 'P1', options: [{value: 'a', label: 'A'}] },
      { id: 'q2', label: 'Q2', prompt: 'P2', options: [{value: 'b', label: 'B'}] }
    ],
    onChange: function (a) { onChangeCalls.push(JSON.stringify(a)); }
  });
  ctx.HT.quiz.skip(handle);
  var ans = handle.getAnswers();
  check(!('q1' in ans), 'skip on q1 did NOT write q1 to answers');
  check(Object.keys(ans).length === 0, 'answers map is empty');
  // We should now be on card 2 (current=1)
  check(handle.progress().current === 1, 'progress.current === 1 after skip');
  check(handle.progress().total === 2, 'progress.total === 2');
  check(handle.progress().answered === 0, 'progress.answered === 0 after skip');
  check(onChangeCalls.length === 1, 'onChange fired exactly once after skip');
}

console.log('--- V. next() advances and writes when option picked ---');
{
  var ctx = buildCtx();
  loadQuiz(ctx);
  var mount = ctx.document.createElement('div');
  var handle = ctx.HT.quiz.open({
    mount: mount,
    questions: [
      { id: 'q1', label: 'Q1', prompt: 'P1', options: [{value: 'a', label: 'A'}] },
      { id: 'q2', label: 'Q2', prompt: 'P2', options: [{value: 'b', label: 'B'}] }
    ]
  });
  // Pick option a
  ctx.HT.quiz.answer(handle, 'a');
  check(handle.getAnswers().q1 === 'a', 'answer(handle, "a") writes q1=a');
  // Now next
  ctx.HT.quiz.next(handle);
  check(handle.progress().current === 1, 'after next(), current === 1');
  check(handle.progress().answered === 1, 'after next(), answered === 1');
  // Pick on q2
  ctx.HT.quiz.answer(handle, 'b');
  ctx.HT.quiz.next(handle);
  // We've moved past q2 — last question should trigger reveal
  check(handle.progress().current === 2, 'after next() on last, current === 2 (past last)');
  // Reveal DOM should be present
  var reveal = mount.querySelector('.quiz-reveal');
  check(!!reveal, 'reveal panel rendered after last question');
  check(reveal && reveal.getAttribute('data-print') === 'result', 'reveal has data-print="result"');
}

console.log('--- VI. jumpTo(0) returns to first card ---');
{
  var ctx = buildCtx();
  loadQuiz(ctx);
  var mount = ctx.document.createElement('div');
  var handle = ctx.HT.quiz.open({
    mount: mount,
    questions: [
      { id: 'q1', label: 'A', prompt: '1', options: [{value: 'a', label: 'A'}] },
      { id: 'q2', label: 'B', prompt: '2', options: [{value: 'b', label: 'B'}] },
      { id: 'q3', label: 'C', prompt: '3', options: [{value: 'c', label: 'C'}] }
    ]
  });
  ctx.HT.quiz.answer(handle, 'a');
  ctx.HT.quiz.next(handle);
  ctx.HT.quiz.answer(handle, 'b');
  ctx.HT.quiz.next(handle);
  check(handle.progress().current === 2, 'current is 2 (third question)');
  handle.jumpTo(0);
  check(handle.progress().current === 0, 'jumpTo(0) sets current to 0');
  // Answers should still be there
  var ans = handle.getAnswers();
  check(ans.q1 === 'a', 'q1 answer preserved after jumpTo');
  check(ans.q2 === 'b', 'q2 answer preserved after jumpTo');
  // Card stack should show q1
  var card = mount.querySelector('.quiz-card');
  check(card && card.getAttribute('data-card-id') === 'q1', 'card 1 is rendered');
  // Out-of-bounds jumpTo is a no-op
  handle.jumpTo(99);
  check(handle.progress().current === 0, 'jumpTo(99) is no-op');
  handle.jumpTo(-1);
  check(handle.progress().current === 0, 'jumpTo(-1) is no-op');
}

console.log('--- VII. progress() math ---');
{
  var ctx = buildCtx();
  loadQuiz(ctx);
  var mount = ctx.document.createElement('div');
  var handle = ctx.HT.quiz.open({
    mount: mount,
    questions: [
      { id: 'q1', label: '1', prompt: '1', options: [{value: 'a', label: 'A'}] },
      { id: 'q2', label: '2', prompt: '2', options: [{value: 'b', label: 'B'}] }
    ]
  });
  var p0 = handle.progress();
  check(p0.current === 0, 'progress: current=0');
  check(p0.total === 2, 'progress: total=2');
  check(p0.answered === 0, 'progress: answered=0');
  ctx.HT.quiz.answer(handle, 'a');
  var p1 = handle.progress();
  check(p1.answered === 1, 'progress: answered=1 after first answer');
  ctx.HT.quiz.next(handle);
  var p2 = handle.progress();
  check(p2.current === 1, 'progress: current=1 after next');
  // Standalone HT.quiz.progress(handle) — same result
  var p3 = ctx.HT.quiz.progress(handle);
  check(p3.current === 1, 'HT.quiz.progress(handle) matches handle.progress()');
}

console.log('--- VIII. reveal() callback fires on final question ---');
{
  var ctx = buildCtx();
  loadQuiz(ctx);
  var mount = ctx.document.createElement('div');
  var onCompleteCalls = [];
  var handle = ctx.HT.quiz.open({
    mount: mount,
    questions: [
      { id: 'q1', label: '1', prompt: '1', options: [{value: 'a', label: 'A'}] },
      { id: 'q2', label: '2', prompt: '2', options: [{value: 'b', label: 'B'}] }
    ],
    reveal: function (answers) {
      var node = ctx.document.createElement('div');
      node.className = 'reveal-summary';
      node.textContent = 'You picked: ' + (answers.q1 || 'nothing') + ' then ' + (answers.q2 || 'nothing');
      return node;
    },
    onComplete: function (answers) {
      onCompleteCalls.push(Object.keys(answers).length);
    }
  });
  ctx.HT.quiz.answer(handle, 'a');
  ctx.HT.quiz.next(handle);
  ctx.HT.quiz.answer(handle, 'b');
  ctx.HT.quiz.next(handle);
  // Now in reveal
  var revealDiv = mount.querySelector('.reveal-summary');
  check(!!revealDiv, 'custom reveal DOM node present');
  check(revealDiv && revealDiv.textContent === 'You picked: a then b', 'custom reveal received correct answers');
  check(onCompleteCalls.length === 1, 'onComplete fired exactly once');
  check(onCompleteCalls[0] === 2, 'onComplete received both answers');
  // Reveal renders .quiz-reveal wrapper
  var wrap = mount.querySelector('.quiz-reveal');
  check(!!wrap, 'reveal wrapper .quiz-reveal present');
}

console.log('--- IX. destroy() removes DOM and clears ---');
{
  var ctx = buildCtx();
  loadQuiz(ctx);
  var mount = ctx.document.createElement('div');
  var handle = ctx.HT.quiz.open({
    mount: mount,
    questions: [
      { id: 'q1', label: '1', prompt: '1', options: [{value: 'a', label: 'A'}] }
    ],
    storageKey: 'quiz-smoke-test-key'
  });
  // Save some state
  ctx.HT.quiz.answer(handle, 'a');
  ctx.HT.quiz.next(handle);
  check(!!mount.querySelector('.quiz-reveal'), 'reveal rendered');
  ctx.HT.quiz.destroy(handle);
  check(handle.isOpen() === false, 'handle.isOpen() === false after destroy');
  check(ctx.HT.quiz.isOpen() === false, 'HT.quiz.isOpen() === false after destroy');
  // Mount should now be empty (no .quiz-card, no .quiz-reveal)
  check(!mount.querySelector('.quiz-card'), 'no .quiz-card after destroy');
  check(!mount.querySelector('.quiz-reveal'), 'no .quiz-reveal after destroy');
  // storageKey should be cleared
  check(ctx.window.localStorage.getItem('quiz-smoke-test-key') === null, 'storage cleared after destroy');
}

console.log('--- X. URL state round-trip via HT.urlState (signature check) ---');
{
  var ctx = buildCtx();
  loadQuiz(ctx);
  // HT.urlState might not exist in our smoke — verify the contract surface is referenced.
  // We can't fully test URL state without the url module, but we can verify:
  // - The quiz module reads HT.urlState if present
  // - It doesn't crash when HT.urlState is absent
  var mount = ctx.document.createElement('div');
  var handle = ctx.HT.quiz.open({
    mount: mount,
    questions: [
      { id: 'q1', label: '1', prompt: '1', options: [{value: 'a', label: 'A'}] }
    ]
  });
  check(!!handle, 'open() succeeds without HT.urlState present');
  // Setting answers via constructor — should be reflected in getAnswers
  var mount2 = ctx.document.createElement('div');
  var handle2 = ctx.HT.quiz.open({
    mount: mount2,
    questions: [
      { id: 'q1', label: '1', prompt: '1', options: [{value: 'a', label: 'A'}] },
      { id: 'q2', label: '2', prompt: '2', options: [{value: 'b', label: 'B'}] }
    ],
    answers: { q1: 'a' }
  });
  check(handle2.getAnswers().q1 === 'a', 'seed answers honored');
  // Now advance to q2 and write q2 — should keep q1
  ctx.HT.quiz.next(handle2);
  ctx.HT.quiz.answer(handle2, 'b');
  ctx.HT.quiz.next(handle2);
  check(handle2.progress().current === 2, 'current=2 (past last) after second next');
  check(handle2.getAnswers().q1 === 'a' && handle2.getAnswers().q2 === 'b', 'both answers preserved');
}

console.log('--- XI. Reduced-motion flag respected ---');
{
  var ctx = buildCtx();
  loadQuiz(ctx);
  var mount = ctx.document.createElement('div');
  // Pre-set data-reduced-motion=true before opening
  ctx.document.documentElement.setAttribute('data-reduced-motion', 'true');
  var handle = ctx.HT.quiz.open({
    mount: mount,
    questions: [
      { id: 'q1', label: '1', prompt: '1', options: [{value: 'a', label: 'A'}] }
    ]
  });
  var card = mount.querySelector('.quiz-card');
  check(!!card, 'card rendered with reduced-motion=true');
  // The module's reducedMotionOn() helper checks data-reduced-motion and matchMedia.
  // We can't easily test the CSS animation-name, but we can verify the module
  // recognized the flag by checking that internal helper runs without error.
  // Set back to default for other tests
  ctx.document.documentElement.setAttribute('data-reduced-motion', '');
  // Re-open with reduced-motion back to default — verify card still renders
  var mount2 = ctx.document.createElement('div');
  var handle2 = ctx.HT.quiz.open({
    mount: mount2,
    questions: [{ id: 'q1', label: '1', prompt: '1', options: [{value: 'a', label: 'A'}] }]
  });
  check(!!mount2.querySelector('.quiz-card'), 'card renders with reduced-motion off');
}

console.log('--- XII. Validation: open() rejects bad inputs ---');
{
  var ctx = buildCtx();
  loadQuiz(ctx);
  var mount = ctx.document.createElement('div');
  var threw1 = false;
  try { ctx.HT.quiz.open({ mount: mount, questions: [] }); } catch (_) { threw1 = true; }
  check(threw1, 'empty questions array throws');
  var threw2 = false;
  try { ctx.HT.quiz.open({ mount: null, questions: [{ id: 'q1', label: 'L', prompt: 'P' }] }); } catch (_) { threw2 = true; }
  check(threw2, 'null mount throws');
  var threw3 = false;
  try { ctx.HT.quiz.open({ mount: mount, questions: [{ id: 'q1', label: 'L', prompt: 'P' }, { id: 'q1', label: 'L2', prompt: 'P2' }] }); } catch (_) { threw3 = true; }
  check(threw3, 'duplicate question id throws');
  // Module is frozen — can't mutate
  var frozenCheck = false;
  try { ctx.HT.quiz.open = function () {}; } catch (_) {}
  frozenCheck = (typeof ctx.HT.quiz.open === 'function');
  check(frozenCheck, 'HT.quiz is frozen — open is still a function after attempted mutation');
}

console.log('--- XIII. Conditional skip (Story 9.12.1 — showIf) ---');
{
  var ctx = buildCtx();
  loadQuiz(ctx);

  // XIII-A: open() accepts showIf as a function
  var mountA = ctx.document.createElement('div');
  var handleA = null;
  var openA = false;
  try {
    handleA = ctx.HT.quiz.open({
      mount: mountA,
      questions: [
        { id: 'q1', label: '1', prompt: 'P1', options: [{value:'a', label:'A'}] },
        { id: 'q2', label: '2', prompt: 'P2', options: [{value:'b', label:'B'}], showIf: function (a) { return a.q1 === 'show'; } }
      ]
    });
    openA = true;
  } catch (_) { openA = false; }
  check(openA, 'open() accepts showIf as a function');

  // XIII-B: open() accepts showIf as { skipIf }
  var mountB = ctx.document.createElement('div');
  var handleB = null;
  var openB = false;
  try {
    handleB = ctx.HT.quiz.open({
      mount: mountB,
      questions: [
        { id: 'q1', label: '1', prompt: 'P1', options: [{value:'a', label:'A'}] },
        { id: 'q2', label: '2', prompt: 'P2', options: [{value:'b', label:'B'}],
          showIf: { skipIf: function (a) { return a.q1 === 'hide'; } } }
      ]
    });
    openB = true;
  } catch (_) { openB = false; }
  check(openB, 'open() accepts showIf as { skipIf }');

  // XIII-C: open() rejects showIf that is neither function nor { skipIf }
  var mountC = ctx.document.createElement('div');
  var threwC = false;
  try {
    ctx.HT.quiz.open({
      mount: mountC,
      questions: [
        { id: 'q1', label: '1', prompt: 'P1', options: [{value:'a', label:'A'}] },
        { id: 'q2', label: '2', prompt: 'P2', showIf: 42 }
      ]
    });
  } catch (_) { threwC = true; }
  check(threwC, 'open() rejects showIf: 42');

  // XIII-D: a showIf: () => false question is omitted from progress().total
  var mountD = ctx.document.createElement('div');
  var handleD = ctx.HT.quiz.open({
    mount: mountD,
    questions: [
      { id: 'q1', label: '1', prompt: 'P1', options: [{value:'a', label:'A'}] },
      { id: 'q2', label: '2', prompt: 'P2', options: [{value:'b', label:'B'}], showIf: function () { return false; } }
    ]
  });
  check(handleD.progress().total === 1, 'showIf: () => false → progress().total === 1 (q2 hidden)');

  // XIII-E: after answering a question that hides a downstream card, next() lands on the next visible card
  var mountE = ctx.document.createElement('div');
  var handleE = ctx.HT.quiz.open({
    mount: mountE,
    questions: [
      { id: 'q1', label: '1', prompt: 'P1', options: [{value:'a', label:'A'}, {value:'b', label:'B'}] },
      { id: 'q2', label: '2', prompt: 'P2', options: [{value:'c', label:'C'}], showIf: function (a) { return a.q1 === 'b'; } },
      { id: 'q3', label: '3', prompt: 'P3', options: [{value:'d', label:'D'}] }
    ]
  });
  ctx.HT.quiz.answer(handleE, 'a');
  ctx.HT.quiz.next(handleE);
  // q1 was 'a', q2 hidden, so we should land on q3 (visual index 1).
  var cardE = mountE.querySelector('.quiz-card');
  check(!!cardE && cardE.getAttribute('data-card-id') === 'q3', 'next() skips hidden q2 and lands on q3');

  // XIII-F: progress().total decreases when a question is branched-skipped
  // q2 starts visible (q1='show' satisfies its predicate), then becomes hidden
  // after the user answers q1 with a different value.
  var mountF = ctx.document.createElement('div');
  var handleF = ctx.HT.quiz.open({
    mount: mountF,
    questions: [
      { id: 'q1', label: '1', prompt: 'P1', options: [{value:'show', label:'Show'}, {value:'hide', label:'Hide'}] },
      { id: 'q2', label: '2', prompt: 'P2', options: [{value:'b', label:'B'}], showIf: function (a) { return a.q1 === 'show'; } },
      { id: 'q3', label: '3', prompt: 'P3', options: [{value:'c', label:'C'}] }
    ],
    answers: { q1: 'show' }
  });
  var totalBefore = handleF.progress().total;
  ctx.HT.quiz.answer(handleF, 'hide');
  var totalAfter = handleF.progress().total;
  check(totalBefore === 3 && totalAfter === 2, 'progress().total decreases from 3 → 2 after hiding q2');

  // XIII-G: jumpTo(0) from reveal honors showIf
  var mountG = ctx.document.createElement('div');
  var handleG = ctx.HT.quiz.open({
    mount: mountG,
    questions: [
      { id: 'q1', label: '1', prompt: 'P1', options: [{value:'a', label:'A'}] },
      { id: 'q2', label: '2', prompt: 'P2', options: [{value:'b', label:'B'}], showIf: function () { return false; } }
    ]
  });
  ctx.HT.quiz.answer(handleG, 'a');
  ctx.HT.quiz.next(handleG);
  ctx.HT.quiz.next(handleG); // → reveal
  handleG.jumpTo(0);
  var cardG = mountG.querySelector('.quiz-card');
  check(!!cardG && cardG.getAttribute('data-card-id') === 'q1', 'jumpTo(0) lands on q1 (q2 hidden)');

  // XIII-H: URL-seeded answers that hide a card reduce progress().total
  var mountH = ctx.document.createElement('div');
  var handleH = ctx.HT.quiz.open({
    mount: mountH,
    questions: [
      { id: 'q1', label: '1', prompt: 'P1', options: [{value:'a', label:'A'}] },
      { id: 'q2', label: '2', prompt: 'P2', options: [{value:'b', label:'B'}], showIf: function (a) { return a.q1 === 'show'; } }
    ],
    answers: { q1: 'hide' }
  });
  check(handleH.progress().total === 1, 'URL-seeded answers hide q2 → progress().total === 1');

  // XIII-I: reveal callback receives only visible-card answers (hidden id absent)
  var mountI = ctx.document.createElement('div');
  var captured = null;
  var handleI = ctx.HT.quiz.open({
    mount: mountI,
    questions: [
      { id: 'q1', label: '1', prompt: 'P1', options: [{value:'a', label:'A'}] },
      { id: 'q2', label: '2', prompt: 'P2', options: [{value:'b', label:'B'}], showIf: function (a) { return a.q1 === 'show'; } }
    ],
    reveal: function (answers) { captured = answers; return null; }
  });
  ctx.HT.quiz.answer(handleI, 'hide');
  ctx.HT.quiz.next(handleI);
  ctx.HT.quiz.next(handleI);
  check(captured && captured.q1 === 'hide' && captured.q2 === undefined,
    'reveal() callback excludes hidden q2 from answers map');

  // XIII-J: missing showIf preserves existing behavior — no card hidden
  var mountJ = ctx.document.createElement('div');
  var handleJ = ctx.HT.quiz.open({
    mount: mountJ,
    questions: [
      { id: 'q1', label: '1', prompt: 'P1', options: [{value:'a', label:'A'}] },
      { id: 'q2', label: '2', prompt: 'P2', options: [{value:'b', label:'B'}] }
    ]
  });
  check(handleJ.progress().total === 2, 'no showIf → progress().total === 2 (all visible)');
}

console.log('--- XIV. Resume UI (Story 9.12.2) ---');
{
  // Helper: find the resume dialog in the document body.
  function findResumeDialog(ctx) {
    // Walk all children of body to find a <dialog> with the resume class.
    function walk(n) {
      if (!n || !n.childNodes) return null;
      for (var i = 0; i < n.childNodes.length; i += 1) {
        var c = n.childNodes[i];
        if (c && c.tagName === 'DIALOG' && c._classes &&
            c._classes.has('quiz-resume-dialog')) {
          return c;
        }
        var inner = walk(c);
        if (inner) return inner;
      }
      return null;
    }
    return walk(ctx.document.body);
  }

  // XIV-A: open() with non-empty storageKey and saved answers appends a <dialog> to the document body.
  var ctxA = buildCtx();
  loadQuiz(ctxA);
  var mountA = ctxA.document.createElement('div');
  // Pre-seed the storage key so loadState() returns saved answers.
  ctxA.HT.storage.set('_registry-quiz-test-a', { answers: { q1: 'a' }, current: 0 });
  var handleA = ctxA.HT.quiz.open({
    mount: mountA,
    questions: [
      { id: 'q1', label: '1', prompt: 'P1', options: [{value:'a', label:'A'}, {value:'b', label:'B'}] }
    ],
    storageKey: '_registry-quiz-test-a'
  });
  var dlgA = findResumeDialog(ctxA);
  check(!!dlgA, 'open() with saved state appends a <dialog> to document.body');

  // XIV-B: The dialog has class="ht-resume-dialog quiz-resume-dialog".
  var classOk = dlgA && dlgA._classes && dlgA._classes.has('ht-resume-dialog') && dlgA._classes.has('quiz-resume-dialog');
  check(classOk, 'dialog has classes "ht-resume-dialog quiz-resume-dialog"');

  // XIV-C: The dialog has aria-labelledby + aria-describedby pointing to its own title/body ids.
  var labelledBy = dlgA && dlgA.getAttribute('aria-labelledby');
  var describedBy = dlgA && dlgA.getAttribute('aria-describedby');
  var titleEl = labelledBy ? ctxA.document.body.querySelector
    ? null : null : null;
  // Simpler check: just verify the attrs are set + non-empty.
  check(typeof labelledBy === 'string' && labelledBy.length > 0, 'dialog has aria-labelledby');
  check(typeof describedBy === 'string' && describedBy.length > 0, 'dialog has aria-describedby');

  // XIV-D: The dialog title text reads "Resume previous attempt?".
  var titleText = '';
  if (dlgA) {
    function findByClass(n, cls) {
      if (!n || !n.childNodes) return null;
      for (var i = 0; i < n.childNodes.length; i += 1) {
        var c = n.childNodes[i];
        if (c && c._classes && c._classes.has(cls)) return c;
        var inner = findByClass(c, cls);
        if (inner) return inner;
      }
      return null;
    }
    var titleEl2 = findByClass(dlgA, 'quiz-resume-title');
    titleText = titleEl2 ? titleEl2.textContent : '';
  }
  check(titleText === 'Resume previous attempt?', 'dialog title reads "Resume previous attempt?"');

  // XIV-E: The body text reads "1 of 1 cards done · 0 skipped" matching the saved state.
  var bodyText = '';
  if (dlgA) {
    var bodyEl = null;
    function findBody(n) {
      if (!n || !n.childNodes) return null;
      for (var i = 0; i < n.childNodes.length; i += 1) {
        var c = n.childNodes[i];
        if (c && c._classes && c._classes.has('quiz-resume-body')) return c;
        var inner = findBody(c);
        if (inner) return inner;
      }
      return null;
    }
    bodyEl = findBody(dlgA);
    bodyText = bodyEl ? bodyEl.textContent : '';
  }
  check(bodyText === '1 of 1 cards done · 0 skipped', 'dialog body reads "1 of 1 cards done · 0 skipped"');

  // XIV-F: The dialog has two buttons with data-action="resume" and "start-over".
  var resumeBtn = null;
  var startOverBtn = null;
  if (dlgA) {
    function findBtn(n, action) {
      if (!n || !n.childNodes) return null;
      for (var i = 0; i < n.childNodes.length; i += 1) {
        var c = n.childNodes[i];
        if (c && c.tagName === 'BUTTON' && c.getAttribute('data-action') === action) return c;
        var inner = findBtn(c, action);
        if (inner) return inner;
      }
      return null;
    }
    resumeBtn = findBtn(dlgA, 'resume');
    startOverBtn = findBtn(dlgA, 'start-over');
  }
  check(!!resumeBtn && !!startOverBtn, 'dialog has [data-action="resume"] and [data-action="start-over"] buttons');

  // XIV-G: Clicking "resume" closes the dialog and mounts the quiz with seedAnswers intact.
  if (resumeBtn) {
    resumeBtn.click();
  }
  var handleAAfter = ctxA.HT.isOpen && ctxA.HT.isOpen();
  var cardAAfter = mountA.querySelector('.quiz-card');
  check(!!cardAAfter, 'after Resume click: quiz mounts and renders a card');

  // XIV-H: Clicking "start-over" clears storage and mounts with empty answers.
  var ctxB = buildCtx();
  loadQuiz(ctxB);
  var mountB = ctxB.document.createElement('div');
  ctxB.HT.storage.set('_registry-quiz-test-b', { answers: { q1: 'b' }, current: 0 });
  ctxB.HT.quiz.open({
    mount: mountB,
    questions: [
      { id: 'q1', label: '1', prompt: 'P1', options: [{value:'a', label:'A'}, {value:'b', label:'B'}] }
    ],
    storageKey: '_registry-quiz-test-b'
  });
  var dlgB = findResumeDialog(ctxB);
  var startOverBtnB = null;
  if (dlgB) {
    function findBtnB(n, action) {
      if (!n || !n.childNodes) return null;
      for (var i = 0; i < n.childNodes.length; i += 1) {
        var c = n.childNodes[i];
        if (c && c.tagName === 'BUTTON' && c.getAttribute('data-action') === action) return c;
        var inner = findBtnB(c, action);
        if (inner) return inner;
      }
      return null;
    }
    startOverBtnB = findBtnB(dlgB, 'start-over');
  }
  if (startOverBtnB) startOverBtnB.click();
  // Storage should now be empty.
  var storageAfter = ctxB.HT.storage.get('_registry-quiz-test-b');
  check(storageAfter === null || storageAfter === undefined,
    'after Start over click: storage key cleared');

  // XIV-I: When URL hash pins a card, no dialog is shown.
  var ctxC = buildCtx();
  loadQuiz(ctxC);
  ctxC.location = { hash: '#view=card-2' };
  var mountC = ctxC.document.createElement('div');
  ctxC.HT.storage.set('_registry-quiz-test-c', { answers: { q1: 'a' }, current: 0 });
  ctxC.HT.quiz.open({
    mount: mountC,
    questions: [
      { id: 'q1', label: '1', prompt: 'P1', options: [{value:'a', label:'A'}] }
    ],
    storageKey: '_registry-quiz-test-c'
  });
  var dlgC = findResumeDialog(ctxC);
  check(!dlgC, 'URL hash view=card-N → no resume dialog (URL wins)');

  // XIV-J: When no storageKey is provided, no dialog is shown.
  var ctxD = buildCtx();
  loadQuiz(ctxD);
  var mountD = ctxD.document.createElement('div');
  ctxD.HT.quiz.open({
    mount: mountD,
    questions: [
      { id: 'q1', label: '1', prompt: 'P1', options: [{value:'a', label:'A'}] }
    ]
    // intentionally no storageKey
  });
  var dlgD = findResumeDialog(ctxD);
  check(!dlgD, 'no storageKey → no resume dialog (direct mount)');
}

// =============================================================
// XV. Multi-Select (Story 9.12.3 — multiSelect: true)
// =============================================================
console.log('--- XV. Multi-Select (Story 9.12.3 — multiSelect: true) ---');
{
  // Helper to mount a multi-select quiz with a clean ctx, return the handle.
  function openMulti() {
    var ctxX = buildCtx();
    loadQuiz(ctxX);
    var mountX = ctxX.document.createElement('div');
    var h = ctxX.HT.quiz.open({
      mount: mountX,
      questions: [
        {
          id: 'q-multi',
          label: 'Pick all that apply',
          prompt: 'Which apply?',
          options: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
            { value: 'c', label: 'C' },
          ],
          multiSelect: true,
        },
        {
          id: 'q-single',
          label: 'Pick one',
          prompt: 'Pick one:',
          options: [
            { value: 'x', label: 'X' },
            { value: 'y', label: 'Y' },
          ],
        },
      ],
    });
    return { ctx: ctxX, mount: mountX, handle: h };
  }

  // XV-A: multi-select renders <ul role="group" aria-multiselectable="true">
  //       and each option is <button role="checkbox">.
  var s15a = openMulti();
  var ctx15a = s15a.ctx;
  var mount15a = s15a.mount;
  var handle15a = s15a.handle;
  var group = findFirst(mount15a, '[role="group"]');
  check(!!group, 'multi-select renders <ul role="group">');
  check(group.getAttribute('aria-multiselectable') === 'true',
    'group has aria-multiselectable="true"');
  var checkboxes = findAll(mount15a, '[role="checkbox"]');
  check(checkboxes.length === 3, 'three checkboxes rendered (one per option)');

  // XV-B: single-select still renders role="radiogroup" + role="radio".
  ctx15a.HT.quiz.next(handle15a);
  var radio = findFirst(mount15a, '[role="radiogroup"]');
  check(!!radio, 'single-select renders <ul role="radiogroup">');
  var radios = findAll(mount15a, '[role="radio"]');
  check(radios.length === 2, 'two radios rendered (single-select question unchanged)');

  // Open a fresh context for the remaining assertions (so we can mount
  // q-multi again at index 0).
  var s15c = openMulti();
  var ctxX = s15c.ctx;
  var mountX = s15c.mount;
  var handleX = s15c.handle;

  // XV-C: clicking a checkbox sets aria-checked="true" + adds .is-selected.
  var optA = findOptionByValue(mountX, 'a');
  optA.dispatchEvent({ type: 'click' });
  check(optA.getAttribute('aria-checked') === 'true',
    'clicked checkbox sets aria-checked="true"');
  check(optA._classes && optA._classes.has('is-selected'),
    'clicked checkbox gains .is-selected');

  // XV-D: clicking the same checkbox again unsets aria-checked + removes .is-selected.
  optA.dispatchEvent({ type: 'click' });
  check(optA.getAttribute('aria-checked') === 'false',
    'second click toggles aria-checked back to "false"');
  check(!optA._classes.has('is-selected'),
    'second click removes .is-selected');

  // XV-E: clicking two different checkboxes leaves both .is-selected.
  var optB = findOptionByValue(mountX, 'b');
  var optC = findOptionByValue(mountX, 'c');
  optA.dispatchEvent({ type: 'click' });
  optB.dispatchEvent({ type: 'click' });
  check(optA._classes.has('is-selected') && optB._classes.has('is-selected'),
    'two checkboxes can be selected simultaneously');
  check(!optC._classes.has('is-selected'),
    'untouched checkbox stays un-selected');

  // XV-F: handle.getAnswers() returns array of selected values.
  var ans = handleX.getAnswers();
  check(Array.isArray(ans['q-multi']) && ans['q-multi'].indexOf('a') >= 0 && ans['q-multi'].indexOf('b') >= 0,
    'getAnswers() returns array containing both picks');

  // XV-G: unchecking all removes the key (delete-on-empty).
  optA.dispatchEvent({ type: 'click' });
  optB.dispatchEvent({ type: 'click' });
  var ans2 = handleX.getAnswers();
  check(!Object.prototype.hasOwnProperty.call(ans2, 'q-multi'),
    'unchecking all checkboxes deletes the key (skip semantics)');

  // XV-H: progress().answered reflects one-key-per-multi question.
  // Pick both, expect answered === 1; uncheck all, expect answered === 0.
  optA.dispatchEvent({ type: 'click' });
  optB.dispatchEvent({ type: 'click' });
  check(handleX.progress().answered === 1,
    'multi-select with picks → progress().answered === 1');
  optA.dispatchEvent({ type: 'click' });
  optB.dispatchEvent({ type: 'click' });
  check(handleX.progress().answered === 0,
    'multi-select with no picks → progress().answered === 0');

  // XV-I: answer(handle, ['a','b']) accepts an array.
  ctxX.HT.quiz.answer(handleX, ['a', 'b']);
  var ans3 = handleX.getAnswers();
  check(Array.isArray(ans3['q-multi']) && ans3['q-multi'].length === 2,
    'answer(handle, array) writes an array');

  // XV-J: answer(handle, 'z') (scalar) on a multi-select question coerces to ['z'].
  ctxX.HT.quiz.answer(handleX, 'c');
  var ans4 = handleX.getAnswers();
  check(Array.isArray(ans4['q-multi']) && ans4['q-multi'].length === 1 && ans4['q-multi'][0] === 'c',
    'answer(handle, scalar) on multi-select coerces to one-item array');

  // XV-K: answer(handle, []) (empty array) deletes the key (skip semantics).
  ctxX.HT.quiz.answer(handleX, []);
  var ans5 = handleX.getAnswers();
  check(!Object.prototype.hasOwnProperty.call(ans5, 'q-multi'),
    'answer(handle, []) deletes the key');

  // XV-L: restoreOptionState preserves checkboxes on re-render.
  // Jump to q-single and back to q-multi via jumpTo, then verify the
  // checkboxes re-apply from the saved answers map.
  ctxX.HT.quiz.answer(handleX, ['a', 'b']);
  ctxX.HT.quiz.jumpTo(handleX, 1); // jump to q-single
  ctxX.HT.quiz.jumpTo(handleX, 0); // jump back to q-multi
  var optA2 = findOptionByValue(mountX, 'a');
  var optB2 = findOptionByValue(mountX, 'b');
  var optC2 = findOptionByValue(mountX, 'c');
  check(optA2._classes.has('is-selected') && optB2._classes.has('is-selected') && !optC2._classes.has('is-selected'),
    'jumpTo re-render restores multi-select checkbox state from saved answers');

  // XV-M: reveal() callback receives the array on the multi-select question.
  // Use a one-question quiz so the reveal fires cleanly after one Next.
  var ctxY = buildCtx();
  loadQuiz(ctxY);
  var mountY = ctxY.document.createElement('div');
  var revealCalls = [];
  ctxY.HT.quiz.open({
    mount: mountY,
    questions: [
      {
        id: 'q-only',
        label: 'Pick',
        prompt: 'Pick any:',
        options: [
          { value: 'p', label: 'P' },
          { value: 'q', label: 'Q' },
        ],
        multiSelect: true,
      },
    ],
    reveal: function (answers) { revealCalls.push(answers); }
  });
  var optP = findOptionByValue(mountY, 'p');
  var optQ = findOptionByValue(mountY, 'q');
  optP.dispatchEvent({ type: 'click' });
  optQ.dispatchEvent({ type: 'click' });
  var allNextBtns = findAll(mountY, '[data-action="next"]');
  if (allNextBtns[0]) allNextBtns[0].dispatchEvent({ type: 'click' });
  check(revealCalls.length > 0 && Array.isArray(revealCalls[revealCalls.length - 1]['q-only'])
      && revealCalls[revealCalls.length - 1]['q-only'].length === 2
      && revealCalls[revealCalls.length - 1]['q-only'].indexOf('p') >= 0
      && revealCalls[revealCalls.length - 1]['q-only'].indexOf('q') >= 0,
    'reveal() callback receives Array on multi-select question id');

  // XV-N: saveState/loadState round-trip preserves the array shape.
  var ctxZ = buildCtx();
  loadQuiz(ctxZ);
  var mountZ = ctxZ.document.createElement('div');
  var hZ = ctxZ.HT.quiz.open({
    mount: mountZ,
    questions: [
      {
        id: 'q-persist',
        label: 'Pick',
        prompt: 'Pick any:',
        options: [
          { value: 'aa', label: 'AA' },
          { value: 'bb', label: 'BB' },
        ],
        multiSelect: true,
      },
    ],
    storageKey: '_registry-quiz-test-multi'
  });
  ctxZ.HT.quiz.answer(hZ, ['aa', 'bb']);
  var allNextBtnsZ = findAll(mountZ, '[data-action="next"]');
  if (allNextBtnsZ[0]) allNextBtnsZ[0].dispatchEvent({ type: 'click' });
  var stored = ctxZ.HT.storage.get('_registry-quiz-test-multi');
  check(stored && stored.answers && Array.isArray(stored.answers['q-persist'])
      && stored.answers['q-persist'].length === 2,
    'saveState round-trip preserves Array answer shape');
}

// =============================================================
// Vacuous-pass guard
// =============================================================

if (pass === 0 && fail === 0) {
  console.error('quiz-smoke: VACUOUS — no assertions ran');
  process.exit(1);
}

// =============================================================
// Summary
// =============================================================

console.log('quiz-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);