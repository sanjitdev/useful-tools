/* ============================================
   Diff Viewer
   Compare two texts side-by-side or unified,
   with line / word / char granularity. Uses
   the shared `HT.diff` library in assets/js/
   diff.js (Myers' algorithm). URL state
   persists the four inputs across reloads.
   ============================================ */

(function () {
  'use strict';

  var aIn = HT.$('#diff-a');
  var bIn = HT.$('#diff-b');
  var granularitySel = HT.$('#diff-granularity');
  var viewSel = HT.$('#diff-view');
  var swapBtn = HT.$('#diff-swap');
  var clearBtn = HT.$('#diff-clear');
  var outRegion = HT.$('#diff-output-region');
  var status = HT.$('#diff-status');

  var STATUS_CLS = { success: 'success', error: 'error', idle: '' };

  function setStatus(text, cls) {
    if (!status) return;
    status.className = cls || '';
    status.textContent = text || '';
  }

  function getText(el) { return (el && el.value) ? el.value : ''; }
  function setText(el, v) { if (el) el.value = v == null ? '' : String(v); }

  function getGranularity() {
    if (!granularitySel) return 'line';
    var v = granularitySel.value || 'line';
    if (v !== 'line' && v !== 'word' && v !== 'char') return 'line';
    return v;
  }

  function getView() {
    if (!viewSel) return 'side-by-side';
    var v = viewSel.value || 'side-by-side';
    if (v !== 'side-by-side' && v !== 'unified') return 'side-by-side';
    return v;
  }

  // -------------------------------------------------------------
  // Splitter dispatcher — picks the right one based on granularity.
  // -------------------------------------------------------------

  function split(granularity, text) {
    if (granularity === 'word') return HT.diff.splitWords(text);
    if (granularity === 'char') return HT.diff.splitChars(text);
    return HT.diff.splitLines(text);
  }

  // -------------------------------------------------------------
  // Render
  // -------------------------------------------------------------

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderToken(op, value) {
    var v = escapeHtml(value);
    if (op === 'equal') return '<span class="diff-token-equal">' + v + '</span>';
    if (op === 'insert') return '<span class="diff-token-insert">' + v + '</span>';
    if (op === 'delete') return '<span class="diff-token-delete">' + v + '</span>';
    return v;
  }

  function renderSideBySide(ops) {
    var rows = [];
    var aLine = 1;
    var bLine = 1;
    rows.push('<thead><tr>'
      + '<th class="diff-line-num" aria-label="Line A">A</th>'
      + '<th class="diff-cell-a">Text A</th>'
      + '<th class="diff-line-num" aria-label="Line B">B</th>'
      + '<th class="diff-cell-b">Text B</th>'
      + '</tr></thead><tbody>');

    var i = 0;
    while (i < ops.length) {
      var op = ops[i].op;
      var value = ops[i].value;
      if (op === 'equal') {
        rows.push('<tr class="diff-row-equal">'
          + '<th class="diff-line-num" scope="row">' + aLine + '</th>'
          + '<td class="diff-cell-a" aria-label="Line ' + aLine + ' equal">' + escapeHtml(value) + '</td>'
          + '<th class="diff-line-num" scope="row">' + bLine + '</th>'
          + '<td class="diff-cell-b" aria-label="Line ' + bLine + ' equal">' + escapeHtml(value) + '</td>'
          + '</tr>');
        aLine += 1; bLine += 1; i += 1;
        continue;
      }
      // For delete+insert pairs at the same row, render side-by-side
      // (delete on left, insert on right). Walk forward looking for the
      // matching insert so the row pairs up.
      if (op === 'delete') {
        // Collect run of deletes
        var deletes = [];
        while (i < ops.length && ops[i].op === 'delete') {
          deletes.push(ops[i].value);
          i += 1;
        }
        var inserts = [];
        while (i < ops.length && ops[i].op === 'insert') {
          inserts.push(ops[i].value);
          i += 1;
        }
        var maxLen = Math.max(deletes.length, inserts.length);
        for (var k = 0; k < maxLen; k += 1) {
          var left = k < deletes.length ? deletes[k] : '';
          var right = k < inserts.length ? inserts[k] : '';
          var cls = (k < deletes.length && k < inserts.length) ? 'diff-row-change'
            : (k < deletes.length ? 'diff-row-delete' : 'diff-row-insert');
          var aLabel = left ? String(aLine) : '';
          var bLabel = right ? String(bLine) : '';
          rows.push('<tr class="' + cls + '">'
            + '<th class="diff-line-num" scope="row">' + aLabel + '</th>'
            + '<td class="diff-cell-a" aria-label="Line ' + (left ? aLine : '-') + ' ' + (left ? 'delete' : 'empty') + '">' + escapeHtml(left) + '</td>'
            + '<th class="diff-line-num" scope="row">' + bLabel + '</th>'
            + '<td class="diff-cell-b" aria-label="Line ' + (right ? bLine : '-') + ' ' + (right ? 'insert' : 'empty') + '">' + escapeHtml(right) + '</td>'
            + '</tr>');
          if (left) aLine += 1;
          if (right) bLine += 1;
        }
        continue;
      }
      // Lone insert (no preceding delete) — still appear on the right
      if (op === 'insert') {
        rows.push('<tr class="diff-row-insert">'
          + '<th class="diff-line-num" scope="row"></th>'
          + '<td class="diff-cell-a" aria-label="Line empty"></td>'
          + '<th class="diff-line-num" scope="row">' + bLine + '</th>'
          + '<td class="diff-cell-b" aria-label="Line ' + bLine + ' insert">' + escapeHtml(value) + '</td>'
          + '</tr>');
        bLine += 1; i += 1;
        continue;
      }
      i += 1;
    }
    rows.push('</tbody>');
    return '<table class="diff-side-by-side">' + rows.join('') + '</table>';
  }

  function renderUnified(ops) {
    var rows = [];
    var aLine = 1;
    var bLine = 1;
    rows.push('<thead><tr>'
      + '<th class="diff-marker" aria-label="Marker"></th>'
      + '<th class="diff-line-num" aria-label="Line A">A</th>'
      + '<th class="diff-line-num" aria-label="Line B">B</th>'
      + '<th class="diff-cell">Text</th>'
      + '</tr></thead><tbody>');

    for (var i = 0; i < ops.length; i += 1) {
      var op = ops[i].op;
      var value = ops[i].value;
      if (op === 'equal') {
        rows.push('<tr class="diff-row-equal">'
          + '<td class="diff-marker">&nbsp;</td>'
          + '<th class="diff-line-num" scope="row">' + aLine + '</th>'
          + '<th class="diff-line-num" scope="row">' + bLine + '</th>'
          + '<td class="diff-cell" aria-label="Line ' + aLine + ' equal">' + escapeHtml(value) + '</td>'
          + '</tr>');
        aLine += 1; bLine += 1;
      } else if (op === 'delete') {
        rows.push('<tr class="diff-row-delete">'
          + '<td class="diff-marker">−</td>'
          + '<th class="diff-line-num" scope="row">' + aLine + '</th>'
          + '<th class="diff-line-num" scope="row"></th>'
          + '<td class="diff-cell" aria-label="Line ' + aLine + ' delete">' + escapeHtml(value) + '</td>'
          + '</tr>');
        aLine += 1;
      } else if (op === 'insert') {
        rows.push('<tr class="diff-row-insert">'
          + '<td class="diff-marker">+</td>'
          + '<th class="diff-line-num" scope="row"></th>'
          + '<th class="diff-line-num" scope="row">' + bLine + '</th>'
          + '<td class="diff-cell" aria-label="Line ' + bLine + ' insert">' + escapeHtml(value) + '</td>'
          + '</tr>');
        bLine += 1;
      }
    }
    rows.push('</tbody>');
    return '<table class="diff-unified">' + rows.join('') + '</table>';
  }

  // For word/char granularity we still produce a side-by-side or unified
  // table, but each cell wraps the tokens in <span> tags so the user can
  // see insertions and deletions inside a single line.
  function renderWordCharSideBySide(ops) {
    var rowA = [];
    var rowB = [];
    var aLine = 1;
    var bLine = 1;
    for (var i = 0; i < ops.length; i += 1) {
      var op = ops[i].op;
      var value = ops[i].value;
      if (op === 'equal') {
        rowA.push(renderToken('equal', value));
        rowB.push(renderToken('equal', value));
      } else if (op === 'delete') {
        rowA.push(renderToken('delete', value));
      } else if (op === 'insert') {
        rowB.push(renderToken('insert', value));
      }
    }
    var aHtml = rowA.join('');
    var bHtml = rowB.join('');
    if (!aHtml) aHtml = '&nbsp;';
    if (!bHtml) bHtml = '&nbsp;';
    return '<table class="diff-side-by-side"><thead><tr>'
      + '<th class="diff-line-num" aria-label="Line A">A</th>'
      + '<th class="diff-cell-a">Text A</th>'
      + '<th class="diff-line-num" aria-label="Line B">B</th>'
      + '<th class="diff-cell-b">Text B</th>'
      + '</tr></thead><tbody>'
      + '<tr class="diff-row-change">'
      + '<th class="diff-line-num" scope="row">1</th>'
      + '<td class="diff-cell-a" aria-label="Line 1 word-char">' + aHtml + '</td>'
      + '<th class="diff-line-num" scope="row">1</th>'
      + '<td class="diff-cell-b" aria-label="Line 1 word-char">' + bHtml + '</td>'
      + '</tr></tbody></table>';
  }

  function renderWordCharUnified(ops) {
    var parts = [];
    for (var i = 0; i < ops.length; i += 1) {
      parts.push(renderToken(ops[i].op, ops[i].value));
    }
    var html = parts.join('');
    if (!html) html = '&nbsp;';
    return '<table class="diff-unified"><thead><tr>'
      + '<th class="diff-marker" aria-label="Marker"></th>'
      + '<th class="diff-line-num" aria-label="Line A">A</th>'
      + '<th class="diff-line-num" aria-label="Line B">B</th>'
      + '<th class="diff-cell">Text</th>'
      + '</tr></thead><tbody>'
      + '<tr class="diff-row-change">'
      + '<td class="diff-marker">~</td>'
      + '<th class="diff-line-num" scope="row">1</th>'
      + '<th class="diff-line-num" scope="row">1</th>'
      + '<td class="diff-cell" aria-label="Word-char diff">' + html + '</td>'
      + '</tr></tbody></table>';
  }

  function render() {
    if (!outRegion) return;
    var a = getText(aIn);
    var b = getText(bIn);
    var granularity = getGranularity();
    var view = getView();

    if ((!a || !a.trim()) && (!b || !b.trim())) {
      outRegion.innerHTML = '<p class="diff-empty">Paste two texts above to compare</p>';
      setStatus('', 'idle');
      return;
    }

    var aTokens = split(granularity, a);
    var bTokens = split(granularity, b);
    var ops = HT.diff.myersDiff(aTokens, bTokens, function (x, y) { return x === y; });

    var html;
    if (granularity === 'word' || granularity === 'char') {
      html = view === 'unified' ? renderWordCharUnified(ops) : renderWordCharSideBySide(ops);
    } else {
      html = view === 'unified' ? renderUnified(ops) : renderSideBySide(ops);
    }
    outRegion.innerHTML = html;
    var changes = 0;
    for (var i = 0; i < ops.length; i += 1) if (ops[i].op !== 'equal') changes += 1;
    setStatus('Compared ' + aTokens.length + ' / ' + bTokens.length + ' tokens, ' + changes + ' changed.',
      changes > 0 ? 'success' : 'idle');
  }

  // -------------------------------------------------------------
  // URL state — base64-encoded for non-ASCII safety.
  // -------------------------------------------------------------

  function toBase64(s) {
    try { return btoa(unescape(encodeURIComponent(s))); }
    catch (_) { return ''; }
  }

  function fromBase64(s) {
    try { return decodeURIComponent(escape(atob(s))); }
    catch (_) { return ''; }
  }

  function readUrlState() {
    try {
      var params = new URLSearchParams(window.location.search);
      var aRaw = params.get('a');
      var bRaw = params.get('b');
      return {
        a: aRaw == null ? null : fromBase64(aRaw),
        b: bRaw == null ? null : fromBase64(bRaw),
        granularity: params.get('granularity'),
        view: params.get('view'),
      };
    } catch (_) {
      return { a: null, b: null, granularity: null, view: null };
    }
  }

  function writeUrlState() {
    try {
      var params = new URLSearchParams(window.location.search);
      var aRaw = toBase64(getText(aIn));
      var bRaw = toBase64(getText(bIn));
      if (aRaw) params.set('a', aRaw); else params.delete('a');
      if (bRaw) params.set('b', bRaw); else params.delete('b');
      params.set('granularity', getGranularity());
      params.set('view', getView());
      var qs = params.toString();
      var url = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
      window.history.replaceState(null, '', url);
    } catch (_) { /* iframe sandboxed — ignore */ }
  }

  function applyUrlState() {
    var s = readUrlState();
    if (s.a != null) setText(aIn, s.a);
    if (s.b != null) setText(bIn, s.b);
    var g = s.granularity;
    if (g === 'line' || g === 'word' || g === 'char') {
      if (granularitySel) granularitySel.value = g;
    }
    var v = s.view;
    if (v === 'side-by-side' || v === 'unified') {
      if (viewSel) viewSel.value = v;
    }
  }

  // -------------------------------------------------------------
  // Wire events
  // -------------------------------------------------------------

  var debouncedRender = HT.debounce(function () { render(); writeUrlState(); }, 250);

  function wire() {
    if (aIn) aIn.addEventListener('input', debouncedRender);
    if (bIn) bIn.addEventListener('input', debouncedRender);
    if (granularitySel) granularitySel.addEventListener('change', function () { render(); writeUrlState(); });
    if (viewSel) viewSel.addEventListener('change', function () { render(); writeUrlState(); });

    if (swapBtn) swapBtn.addEventListener('click', function () {
      var tmp = getText(aIn);
      setText(aIn, getText(bIn));
      setText(bIn, tmp);
      render(); writeUrlState();
    });
    if (clearBtn) clearBtn.addEventListener('click', function () {
      setText(aIn, '');
      setText(bIn, '');
      render(); writeUrlState();
    });

    // Keyboard shortcuts: s = swap, c = clear (ignore when typing)
    document.addEventListener('keydown', function (ev) {
      var target = ev.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      if (ev.key === 's' || ev.key === 'S') {
        ev.preventDefault();
        if (swapBtn) swapBtn.click();
      } else if (ev.key === 'c' || ev.key === 'C') {
        ev.preventDefault();
        if (clearBtn) clearBtn.click();
      }
    });
  }

  applyUrlState();
  wire();
  render();
})();