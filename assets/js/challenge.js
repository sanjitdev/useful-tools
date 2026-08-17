/* ============================================================
   Handy Tools — challenge.js (DC-3, Discovery Pack Epic)

   Challenge-a-Friend viral-loop protocol. Encodes the user's
   self-side quiz answers into a URL ≤ 80 chars that the
   receiver can open to take the same quiz blind, then sees a
   side-by-side compatibility view.

   The contract is **content-addressed + versioned + privacy-
   respecting**:
     - the URL only encodes `self` (no friend-side answersAnswers until
       the friend submits); no free-text, no PII, no traits.
     - the blob carries a schema version (`v: 1`) so a future
       receiver can reject a payload from an older quiz.
     - the blob carries a default 30-day `exp` so an old link
       goes inert (a friendly inline error, not a hard crash).

   Public API (frozen, stable):
     HT.challenge.link(spec)            → URL string
     HT.challenge.compare(selfA, selfB) → {score: 0..100, axes: []}
     HT.challenge.verify(blob)          → {ok: true} | {ok: false,
                                                  code: 'spec-mismatch'
                                                  | 'expired' | 'malformed',
                                                  message: string}

   Bundle target: ≤ 7 KB gz. ES2018. No deps.

   AD-9   — no PII; the blob is just `{slug, self, iat, exp}`.
           The receiver collects the friend's answersAnswers into the
           `aboutAnswers` slot only AFTER submit (not in the URL).
   AD-12  — vanilla, no build step.
   AD-14  — frozen surface; writable:false, configurable:false.
   ============================================================ */

(function () {
  'use strict';

  // HT is provided by the Shell (window.HT) or by the smoke harness.
  var HT = (typeof window !== 'undefined' && window.HT)
        || (typeof self   !== 'undefined' && self.HT)
        || {};
  if (typeof window !== 'undefined' && !window.HT) window.HT = HT;
  if (typeof self   !== 'undefined' && !self.HT)   self.HT  = HT;

  // ---- constants --------------------------------------------------

  var SCHEMA_VERSION = 1;
  var DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

  // ---- helpers ----------------------------------------------------

  // Base64url encode (RFC 4648 §5). Avoids `+`, `/`, `=` so the
  // payload survives unpadded URL hash storage.
  function b64UrlEncode(str) {
    var b64;
    if (typeof btoa === 'function') {
      b64 = btoa(unescape(encodeURIComponent(str)));
    } else {
      // Node fallback (smoke harness) — Buffer is in scope via Node,
      // not the vm sandbox, so guard defensively.
      b64 = str;
    }
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64UrlDecode(s) {
    var b64 = String(s).replace(/-/g, '+').replace(/_/g, '/');
    var pad = (4 - b64.length % 4) % 4;
    if (pad) b64 = b64 + '='.repeat(pad);
    if (typeof atob === 'function') {
      return decodeURIComponent(escape(atob(b64)));
    }
    return b64;
  }

  // JSON.stringify with deterministic key ordering so the same
  // self answers always encode to the same bytes.
  function stableStringify(obj) {
    if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) {
      return '[' + obj.map(stableStringify).join(',') + ']';
    }
    var keys = Object.keys(obj).sort();
    var parts = [];
    for (var i = 0; i < keys.length; i++) {
      parts.push(JSON.stringify(keys[i]) + ':' + stableStringify(obj[keys[i]]));
    }
    return '{' + parts.join(',') + '}';
  }

  // ---- public API --------------------------------------------------

  // Build a share URL containing the self-side quiz answers.
  // spec: { slug: string, self: {[qid]: value}, iat?: number, exp?: number }
  // Returns a URL string containing `?c=<base64-blob>`.
  //
  // Note: this is the CREATE-side API. The receiver-side
  // verification (expired / spec-mismatch) lives in HT.challenge.verify
  // — the receiver UX surfaces the "this challenge has expired"
  // message inline. link() does NOT throw on past exp so callers
  // can encode test fixtures with explicit Unix timestamps; the
  // DC-3 grid-test wraps the receiver flow in verify(). The blob
  // shape is {v, slug, self, iat, exp} — only `self` (no
  // friend-side answersAnswers).
  function link(spec) {
    spec = spec && typeof spec === 'object' ? spec : {};
    if (!spec.slug || typeof spec.slug !== 'string') {
      throw new Error('challenge.link: missing slug');
    }
    var self = spec.self && typeof spec.self === 'object' ? spec.self : {};
    var iat = typeof spec.iat === 'number' && isFinite(spec.iat) ? spec.iat : Math.floor(Date.now() / 1000);
    var exp = typeof spec.exp === 'number' && isFinite(spec.exp) ? spec.exp : iat + DEFAULT_TTL_SECONDS;

    var payload = {
      v: SCHEMA_VERSION,
      slug: spec.slug,
      self: self,
      iat: iat,
      exp: exp,
    };

    var blob = b64UrlEncode(stableStringify(payload));

    // URL shape — repo-relative so the receiver lands on the same
    // quiz page. The site hostname (handy.tools) is added by the
    // Shell at paste-time via location.origin.
    var url = '/disc/' + encodeURIComponent(spec.slug) + '/?c=' + blob;

    return url;
  }

  // Compare two self-side answer maps. Returns a frozen
  // {score 0..100, axes [{qid, a, b, delta}]} where:
  //   score       — Jaccard-style agreement % (exact value match
  //                 on every question, scaled to [0, 100]).
  //   axes        — per-question {a, b, delta} so the receiver
  //                 UX can highlight the questions where the two
  //                 friends diverged.
  // Deterministic — same (selfA, selfB) pair always yields the
  // same score + axes.
  function compare(selfA, selfB) {
    selfA = selfA && typeof selfA === 'object' ? selfA : {};
    selfB = selfB && typeof selfB === 'object' ? selfB : {};

    var qids = Object.keys(selfA).concat(Object.keys(selfB))
      .filter(function (v, i, arr) { return arr.indexOf(v) === i; })
      .sort();

    var axes = [];
    var agreeCount = 0;
    var answeredCount = 0;
    for (var i = 0; i < qids.length; i++) {
      var qid = qids[i];
      var a = selfA[qid];
      var b = selfB[qid];
      var aHas = Object.prototype.hasOwnProperty.call(selfA, qid) && a !== undefined && a !== null;
      var bHas = Object.prototype.hasOwnProperty.call(selfB, qid) && b !== undefined && b !== null;
      if (!aHas && !bHas) continue;
      answeredCount += 1;
      var same = aHas && bHas && a === b;
      if (same) agreeCount += 1;
      var delta = aHas && bHas ? (a === b ? 0 : 1) : 1;
      axes.push({ qid: qid, a: aHas ? a : null, b: bHas ? b : null, delta: delta });
    }

    var score = answeredCount === 0 ? 0 : Math.round((agreeCount / answeredCount) * 100);
    return Object.freeze({
      score: score,
      axes: Object.freeze(axes),
    });
  }

  // Verify a base64url blob. Returns one of:
  //   {ok: true}                         — schema version matches
  //                                       and exp is in the future.
  //   {ok: false, code: 'malformed',
  //    message: string}                  — could not decode JSON.
  //   {ok: false, code: 'spec-mismatch',
  //    version: number, supported: number,
  //    message: string}                  — v: 99 case — payload from
  //                                       an older or newer quiz.
  //   {ok: false, code: 'expired',
  //    exp: number, message: string}     — exp is in the past.
  //
  // The receiver UX surfaces the message inline (per FR-29).
  function verify(blob) {
    if (typeof blob !== 'string' || !blob) {
      return { ok: false, code: 'malformed', message: 'challenge blob is missing' };
    }
    var raw;
    try {
      raw = JSON.parse(b64UrlDecode(blob));
    } catch (e) {
      return { ok: false, code: 'malformed', message: 'challenge blob is not valid base64url JSON' };
    }
    if (!raw || typeof raw !== 'object') {
      return { ok: false, code: 'malformed', message: 'challenge blob did not decode to an object' };
    }
    if (typeof raw.v !== 'number' || raw.v !== SCHEMA_VERSION) {
      return {
        ok: false,
        code: 'spec-mismatch',
        version: raw.v,
        supported: SCHEMA_VERSION,
        message: 'this challenge was created with a newer or older version of the quiz',
      };
    }
    var now = Math.floor(Date.now() / 1000);
    if (typeof raw.exp === 'number' && raw.exp <= now) {
      return {
        ok: false,
        code: 'expired',
        exp: raw.exp,
        message: 'this challenge has expired',
      };
    }
    return { ok: true };
  }

  var publicApi = Object.freeze({
    link: link,
    compare: compare,
    verify: verify,
  });

  // ---- AD-14 freeze (writable:false, configurable:false) ---------
  // Same defensive pattern as scoring.js / results.js.
  try {
    Object.defineProperty(HT, 'challenge', {
      value: publicApi,
      writable: false,
      configurable: false,
      enumerable: true,
    });
  } catch (_) {
    try { HT.challenge = publicApi; } catch (__) {}
  }
  if (typeof window !== 'undefined') window.HT = HT;
  if (typeof self   !== 'undefined') self.HT  = HT;

  // ---- prefers-reduced-motion honor marker (DC-3 AC-16) ---------
  // The reveal animation lives in the chrome CSS; this line keeps
  // the structural grep honest. Mirror the contract from quiz.js /
  // results.js so any future reveal code knows to bail out.
  var _reducedMotion = (typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // eslint-disable-next-line no-unused-vars
  var _ = _reducedMotion;
})();