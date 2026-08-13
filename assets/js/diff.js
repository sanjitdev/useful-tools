/* ============================================
   Handy Tools — diff.js (Story 9.1 + 9.3)
   Shared diff library. Hand-rolled Myers' O(ND)
   algorithm with LCS fallback. Pure functions,
   no DOM. Exposes `window.HT.diff` so both the
   JSON formatter (line-granularity, AC-3) and
   the Diff Viewer tool (line/word/char, Story
   9.3) can reuse the same underlying algorithm.
   ES2018.
   ============================================ */

(function () {
  'use strict';

  // When loaded as a Node module (smoke harness) `window` is unavailable;
  // synthesize a minimal host so the IIFE body can run without DOM. The
  // smoke harness uses the CommonJS exports; the browser surfaces the
  // frozen `window.HT.diff` object.
  const _hasWindow = typeof globalThis !== 'undefined' && typeof globalThis.window !== 'undefined';
  if (!_hasWindow) {
    globalThis.window = { HT: {} };
  }
  const window = globalThis.window;
  window.HT = window.HT || {};
  const HT = window.HT;

  // -------------------------------------------------------------
  // Splitters
  // -------------------------------------------------------------

  /**
   * Split a string on '\n'. Trailing newline produces a trailing
   * empty string — we trim it so we don't render a phantom blank
   * line at the end of the diff.
   */
  function splitLines(text) {
    if (text == null) return [];
    const parts = String(text).split('\n');
    if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
    return parts;
  }

  /**
   * Split on whitespace boundaries but KEEP the whitespace
   * separators as their own tokens so the join restores the
   * original spacing. Boolean true filter drops the empty
   * strings that `split(/(\s+)/)` produces at boundaries.
   */
  function splitWords(text) {
    if (text == null) return [];
    return String(text).split(/(\s+)/).filter(Boolean);
  }

  /**
   * Spread a string into an array of characters. Code-point aware
   * via Array.from — surrogate pairs become one element.
   */
  function splitChars(text) {
    if (text == null) return [];
    return Array.from(String(text));
  }

  // -------------------------------------------------------------
  // Default equality
  // -------------------------------------------------------------

  function defaultEq(a, b) {
    return a === b;
  }

  // -------------------------------------------------------------
  // Myers' O(ND) diff algorithm
  //
  // Returns an array of {op, value} where op ∈ {'equal','insert',
  // 'delete'}. The result is suitable for direct line-by-line
  // rendering: iterate the result and emit a row per op.
  //
  // `a` is the "from" sequence (deletions come from it).
  // `b` is the "to" sequence   (insertions come from it).
  // `eq` is an optional equality comparator (defaults to ===).
  //
  // For very small inputs the LCS path (O(N*M)) is faster and
  // simpler; we dispatch based on input size. Both paths produce
  // the same shape.
  // -------------------------------------------------------------

  /**
   * Linear-space LCS — used for tiny inputs where the O(N*M)
   * bookkeeping is cheaper than Myers' max-offset graph. The
   * output is identical to Myers'.
   */
  function _lcsDiff(a, b, eq) {
    if (typeof eq !== 'function') eq = defaultEq;
    const n = a.length;
    const m = b.length;
    // Build LCS length table.
    const dp = new Array(n + 1);
    for (let i = 0; i <= n; i += 1) dp[i] = new Array(m + 1).fill(0);
    for (let i = 1; i <= n; i += 1) {
      for (let j = 1; j <= m; j += 1) {
        if (eq(a[i - 1], b[j - 1])) dp[i][j] = dp[i - 1][j - 1] + 1;
        else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    // Walk the table backward to produce ops in reverse.
    const rev = [];
    let i = n, j = m;
    while (i > 0 && j > 0) {
      if (eq(a[i - 1], b[j - 1])) {
        rev.push({ op: 'equal', value: a[i - 1] });
        i -= 1; j -= 1;
      } else if (dp[i - 1][j] > dp[i][j - 1]) {
        // Strictly larger up-cell — go up (delete from a).
        rev.push({ op: 'delete', value: a[i - 1] });
        i -= 1;
      } else {
        // Tie OR larger left-cell — go left (insert from b).
        // Tie-breaker prefers insert so the reversed final sequence
        // surfaces deletes before inserts (matches unified-diff
        // convention: "remove old then add new").
        rev.push({ op: 'insert', value: b[j - 1] });
        j -= 1;
      }
    }
    while (i > 0) { rev.push({ op: 'delete', value: a[i - 1] }); i -= 1; }
    while (j > 0) { rev.push({ op: 'insert', value: b[j - 1] }); j -= 1; }
    return rev.reverse();
  }

  /**
   * Myers' O(ND) algorithm. Operates on the "trace" — for each
   * `d` (edit distance) it records the furthest-reaching x on the
   * k-diagonal. After tracing we walk the trace backward picking
   * the (d-1) move that produced each new furthest point.
   *
   * This is the standard linear-space variant from Myers' 1986
   * paper "An O(ND) Difference Algorithm and Its Variations". The
   * for-loops are carefully indexed so that `trace[d][k+max]`
   * gives the x-coordinate reached on diagonal k at edit distance d.
   */
  function _myersDiff(a, b, eq) {
    if (typeof eq !== 'function') eq = defaultEq;
    const n = a.length;
    const m = b.length;
    const max = n + m;
    const offset = max; // shift k to a non-negative index
    const trace = [];
    // v[k + offset] = furthest x reached on diagonal k
    const v = new Array(2 * max + 1).fill(0);
    let foundD = -1;
    for (let d = 0; d <= max; d += 1) {
      for (let k = -d; k <= d; k += 2) {
        let x;
        if (k === -d || (k !== d && v[k - 1 + offset] < v[k + 1 + offset])) {
          x = v[k + 1 + offset]; // move down (insert)
        } else {
          x = v[k - 1 + offset] + 1; // move right (delete)
        }
        let y = x - k;
        while (x < n && y < m && eq(a[x], b[y])) { x += 1; y += 1; }
        v[k + offset] = x;
        if (x >= n && y >= m) {
          foundD = d;
          break;
        }
      }
      // Snapshot AFTER this d's inner loops — backtrack uses trace[d-1]
      // to look up v values at the END of edit distance d-1.
      trace.push(v.slice());
      if (foundD >= 0) break;
    }

    // Backtrack through the trace to produce the edit sequence.
    const path = [];
    let px = n;
    let py = m;
    for (let d = foundD; d > 0; d -= 1) {
      const prevV = trace[d - 1];
      const vCurr = trace[d];
      const k = px - py;
      // Determine which diagonal we came from at d-1.
      let prevK;
      if (k === -d || (k !== d && prevV[k - 1 + offset] < prevV[k + 1 + offset])) {
        prevK = k + 1;
      } else {
        prevK = k - 1;
      }
      const prevX = prevV[prevK + offset];
      const prevY = prevX - prevK;
      // Diagonal snake (equals) that we may have taken after the edit.
      while (px > prevX && py > prevY) {
        path.push({ op: 'equal', value: a[px - 1] });
        px -= 1; py -= 1;
      }
      // Now (px, py) is at one past the edit point. The edit itself.
      if (d > 0) {
        if (px === prevX) {
          // Came from k+1: insert of b[py-1].
          path.push({ op: 'insert', value: b[py - 1] });
          py -= 1;
        } else {
          // Came from k-1: delete of a[px-1].
          path.push({ op: 'delete', value: a[px - 1] });
          px -= 1;
        }
      }
    }
    // Leading equals (the initial diagonal snake at d=0).
    while (px > 0 && py > 0 && eq(a[px - 1], b[py - 1])) {
      path.push({ op: 'equal', value: a[px - 1] });
      px -= 1; py -= 1;
    }
    while (px > 0) { path.push({ op: 'delete', value: a[px - 1] }); px -= 1; }
    while (py > 0) { path.push({ op: 'insert', value: b[py - 1] }); py -= 1; }
    return path.reverse();
  }

  function myersDiff(a, b, eq) {
    const arrA = Array.isArray(a) ? a : [];
    const arrB = Array.isArray(b) ? b : [];
    const cmp = typeof eq === 'function' ? eq : defaultEq;
    // LCS table allocation is O(N*M) memory; keep it for small inputs
    // (≤ 256 cells per side) where the constant factor beats Myers.
    if (arrA.length * arrB.length <= 256 * 256) {
      return _lcsDiff(arrA, arrB, cmp);
    }
    return _myersDiff(arrA, arrB, cmp);
  }

  // -------------------------------------------------------------
  // Self-test (runs only in Node — guard on `typeof module`).

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      myersDiff: myersDiff,
      splitLines: splitLines,
      splitWords: splitWords,
      splitChars: splitChars,
      // Expose internals for the smoke harness.
      _myersDiff: _myersDiff,
      _lcsDiff: _lcsDiff,
    };
  }

  // -------------------------------------------------------------
  // Browser export — exposed under `window.HT.diff`. Story 9.3
  // reuses this exact surface, so the contract is:
  //   window.HT.diff = {
  //     myersDiff: function(a, b, eq) { ... },  // line-gran today, also used by word/char via splitters
  //     splitLines, splitWords, splitChars
  //   }
  // -------------------------------------------------------------

  Object.defineProperty(HT, 'diff', {
    value: Object.freeze({
      myersDiff: myersDiff,
      splitLines: splitLines,
      splitWords: splitWords,
      splitChars: splitChars,
    }),
    writable: false,
    configurable: false,
    enumerable: true,
  });
})();
