/* ============================================
   _smoke_challenge_receiver.js (Story 10.12)

   Smoke harness for assets/js/challenge-receiver.js — the
   receiver-side landing hook for challenge URLs.

   Asserts the public surface (HT.challengeReceiver = { landing,
   compareView, getChallengeBlob, stashLocalAnswers,
   readLocalAnswers }) is exposed, frozen, and behaves correctly
   on valid/invalid blob inputs.

   Exit 0 on PASS, 1 on FAIL. ES2018, no deps.
   ============================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'assets/js/challenge-receiver.js'), 'utf8');

// Build a synthetic challenge blob for tests
const payload = {
  v: 1,
  slug: 'spirit-animal',
  self: { 'q1-path': 'gut' },
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 86400,
};
const json = JSON.stringify(payload);
const validBlob = Buffer.from(json, 'binary').toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// Sandbox: minimal browser surface
const ctx = {
  window: {},
  navigator: {},
  document: {
    body: { appendChild: () => {} },
    createElement: (tag) => ({
      tag: tag,
      setAttribute() {},
      appendChild() {},
      addEventListener() {},
      style: {},
      classList: { add() {}, remove() {} },
      querySelector() { return null; },
    }),
    createTextNode: (text) => ({ nodeType: 3, textContent: text, appendChild: () => {} }),
    querySelector() { return null; },
    getElementById() { return null; },
    readyState: 'complete',
    addEventListener() {},
  },
  URLSearchParams: URLSearchParams,
  localStorage: {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
  },
  HT: {
    challenge: {
      verify: (b) => (b === validBlob ? { ok: true } : { ok: false, code: 'malformed', message: 'bad' }),
      compare: (a, b) => {
        const keys = Object.keys(a).concat(Object.keys(b));
        let ag = 0, tot = 0;
        for (const k of new Set(keys)) {
          if (a[k] !== undefined && b[k] !== undefined) { tot++; if (a[k] === b[k]) ag++; }
        }
        return { score: tot === 0 ? 0 : Math.round(ag / tot * 100), axes: [] };
      },
    },
    copyToClipboard: () => Promise.resolve(),
    toast: () => {},
  },
};
ctx.window.HT = ctx.HT;
ctx.window.location = { search: '?c=' + validBlob, hash: '', origin: 'http://example.com', pathname: '/disc/spirit-animal/' };
ctx.window.localStorage = ctx.localStorage;
ctx.window.matchMedia = () => ({ matches: false });
ctx.globalThis = ctx;
ctx.self = ctx;
ctx.setTimeout = setTimeout;
ctx.atob = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('binary');
ctx.btoa = (s) => Buffer.from(s, 'binary').toString('base64');

try { vm.runInNewContext(SRC, ctx, { filename: 'challenge-receiver.js' }); }
catch (e) { console.error('vm-eval FAIL:', e.message); process.exit(2); }

let pass = 0, fail = 0;
function check(name, ok) {
  if (ok) { pass += 1; console.log('  PASS  ' + name); }
  else { fail += 1; console.log('  FAIL  ' + name); }
}

const CR = ctx.HT.challengeReceiver;

check('HT.challengeReceiver defined as object', typeof CR === 'object');
check('HT.challengeReceiver frozen', Object.isFrozen(CR));
check('HT.challengeReceiver.landing is function', typeof CR.landing === 'function');
check('HT.challengeReceiver.compareView is function', typeof CR.compareView === 'function');
check('HT.challengeReceiver.getChallengeBlob is function', typeof CR.getChallengeBlob === 'function');
check('HT.challengeReceiver.stashLocalAnswers is function', typeof CR.stashLocalAnswers === 'function');
check('HT.challengeReceiver.readLocalAnswers is function', typeof CR.readLocalAnswers === 'function');

// Landing with valid blob
const fakeHost = {
  insertBefore() {},
  firstChild: null,
  querySelector() { return null; },
  appendChild() {},
  innerHTML: '',
  textContent: '',
  parentNode: { insertBefore() {} },
};
ctx.window.location.search = '?c=' + validBlob;
const landingOk = CR.landing('spirit-animal', fakeHost, {});
check('landing(valid): returns {ok: true}', landingOk && landingOk.ok === true);
check('landing(valid): preserves quiz slug', landingOk && landingOk.slug === 'spirit-animal');
check('landing(valid): exposes payload', landingOk && landingOk.payload && landingOk.payload.v === 1);
check('landing(valid): renders banner DOM', landingOk && landingOk.banner && landingOk.banner.className === 'challenge-banner');

// Landing with invalid blob
ctx.window.location.search = '?c=invalidblob';
const landingFail = CR.landing('spirit-animal', fakeHost, {});
check('landing(invalid): returns {ok: false}', landingFail && landingFail.ok === false);
check('landing(invalid): returns one of malformed/spec-mismatch/expired',
  landingFail && ['malformed', 'spec-mismatch', 'expired'].includes(landingFail.code));

// getChallengeBlob
ctx.window.location.search = '';
ctx.window.location.hash = '';
check('getChallengeBlob: returns null when no c= in URL', CR.getChallengeBlob() === null);

ctx.window.location.search = '?c=' + validBlob;
check('getChallengeBlob: returns blob from query string', CR.getChallengeBlob() === validBlob);

// compareView renders
const compareHost = { appendChild(c) { compareHost._appended = c; } };
CR.compareView('spirit-animal', { 'q1-path': 'gut' }, { 'q1-path': 'gut' }, compareHost);
check('compareView: appends a .compatibility-card element',
  compareHost._appended && compareHost._appended.className === 'compatibility-card');

// Stash + read local answers
ctx.localStorage._data = {};
CR.stashLocalAnswers('test-slug', { q1: 'a', q2: 'b' });
const stashed = CR.readLocalAnswers('test-slug');
check('stash + read: round-trips the answers object',
  stashed && stashed.q1 === 'a' && stashed.q2 === 'b');

// Vacuous-pass guard
check('vacuous-pass guard: pass > 0', pass > 0);

console.log('\nchallenge-receiver-smoke: ' + pass + ' PASS, ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);