/* ============================================
   JSON Formatter
   Format, minify, validate; optional tree view.
   ============================================ */

(function () {
  'use strict';

  var DEFAULT_INPUT = '{\n  "name": "Handy Tools",\n  "version": 1,\n  "tags": ["utility", "static", "vanilla"],\n  "author": { "name": "you", "email": "you@example.com" },\n  "active": true,\n  "beta": null\n}';

  var input = HT.$('#json-input');
  var out = HT.$('#output');
  var status = HT.$('#status');
  var currentPretty = '';
  var currentTree = false;
  var lastParsed = null;

  if (!input.value.trim()) input.value = DEFAULT_INPUT;

  function setStatus(text, cls) {
    status.className = cls || '';
    status.textContent = text || '';
  }

  function lineColumnOfError(text, err) {
    var lines = text.split('\n');
    var matched = /\bline\s+(\d+)\s+column\s+(\d+)/.exec(err.message || '');
    if (matched) {
      return 'line ' + matched[1] + ', column ' + matched[2];
    }
    // Estimate from character position if present
    var pos = (err.message || '').match(/position\s+(\d+)/);
    if (pos) {
      var p = parseInt(pos[1], 10);
      var upto = text.slice(0, p);
      var ln = upto.split('\n').length;
      var col = p - upto.lastIndexOf('\n');
      return 'around line ' + ln + ', column ' + col;
    }
    return err.message || 'parse error';
  }

  function getText() {
    return input.value;
  }

  function parseSafe() {
    var text = getText();
    try {
      var parsed = JSON.parse(text);
      return { ok: true, parsed: parsed, text: text };
    } catch (e) {
      return { ok: false, error: lineColumnOfError(text, e) };
    }
  }

  // ----- Tree rendering -----

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function renderTree(value) {
    function render(val, key) {
      var k = '';
      if (key !== undefined) {
        k = '<span class="key">' + (typeof key === 'number' ? '[' + key + ']' : '"' + escapeHtml(key) + '"') + '</span>: ';
      }
      if (val === null) {
        return '<div class="row"><span class="toggle"></span>' + k + '<span class="null">null</span></div>';
      }
      if (Array.isArray(val)) {
        if (val.length === 0) return '<div class="row"><span class="toggle"></span>' + k + '[]</div>';
        var inner = val.map(function (v, i) { return '<li>' + render(v, i) + '</li>'; }).join('');
        return '<div class="row open"><span class="toggle">▾</span>' + k +
          '[<span class="meta">' + val.length + ' item' + (val.length === 1 ? '' : 's') + '</span>]' +
          '<ul>' + inner + '</ul></div>';
      }
      if (typeof val === 'object') {
        var keys = Object.keys(val);
        if (keys.length === 0) return '<div class="row"><span class="toggle"></span>' + k + '{}</div>';
        var innerObj = keys.map(function (ky) {
          return '<li>' + render(val[ky], ky) + '</li>';
        }).join('');
        return '<div class="row open"><span class="toggle">▾</span>' + k +
          '{<span class="meta">' + keys.length + ' key' + (keys.length === 1 ? '' : 's') + '</span>' +
          '<ul>' + innerObj + '</ul></div>';
      }
      if (typeof val === 'string') {
        return '<div class="row"><span class="toggle"></span>' + k + '<span class="str">"' + escapeHtml(val) + '"</span></div>';
      }
      if (typeof val === 'number') {
        return '<div class="row"><span class="toggle"></span>' + k + '<span class="num">' + val + '</span></div>';
      }
      if (typeof val === 'boolean') {
        return '<div class="row"><span class="toggle"></span>' + k + '<span class="bool">' + val + '</span></div>';
      }
      return '<div class="row"><span class="toggle"></span>' + k + escapeHtml(String(val)) + '</div>';
    }

    var wrap = '<div class="tree"><ul><li>' + render(value, undefined) + '</li></ul></div>';
    return wrap;
  }

  function wireTreeToggles(root) {
    HT.qsa('.tree .row', root).forEach(function (row) {
      var toggle = HT.qs('.toggle', row);
      var ul = HT.qs('ul', row);
      if (!ul) return;
      toggle.addEventListener('click', function () {
        var parent = row.parentElement;
        if (!parent) return;
        if (parent.classList.contains('collapsed')) {
          parent.classList.remove('collapsed');
          toggle.textContent = '▾';
        } else {
          parent.classList.add('collapsed');
          toggle.textContent = '▸';
        }
      });
    });
  }

  // ----- Actions -----

  function doFormat() {
    var r = parseSafe();
    if (!r.ok) { setStatus('Invalid JSON: ' + r.error, 'error'); return; }
    lastParsed = r.parsed;
    currentPretty = JSON.stringify(r.parsed, null, 2);
    currentTree = false;
    out.classList.remove('tree');
    out.textContent = currentPretty;
    setStatus('Formatted · ' + HT.formatNumber(currentPretty.length) + ' chars', 'success');
  }

  function doMinify() {
    var r = parseSafe();
    if (!r.ok) { setStatus('Invalid JSON: ' + r.error, 'error'); return; }
    lastParsed = r.parsed;
    currentPretty = JSON.stringify(r.parsed);
    currentTree = false;
    out.classList.remove('tree');
    out.textContent = currentPretty;
    setStatus('Minified · ' + HT.formatNumber(currentPretty.length) + ' chars', 'success');
  }

  function doValidate() {
    var r = parseSafe();
    if (!r.ok) { setStatus('Invalid JSON: ' + r.error, 'error'); return; }
    lastParsed = r.parsed;
    setStatus('Valid JSON.', 'success');
  }

  function doTree() {
    var r = parseSafe();
    if (!r.ok) { setStatus('Invalid JSON: ' + r.error, 'error'); return; }
    lastParsed = r.parsed;
    currentPretty = JSON.stringify(r.parsed, null, 2);
    currentTree = true;
    out.classList.add('tree');
    out.innerHTML = renderTree(r.parsed);
    wireTreeToggles(out);
    setStatus('Tree view rendered.', 'success');
  }

  function copyOut() {
    HT.copyToClipboard(currentPretty || (lastParsed ? JSON.stringify(lastParsed, null, 2) : ''));
  }

  HT.$('#format').addEventListener('click', doFormat);
  HT.$('#minify').addEventListener('click', doMinify);
  HT.$('#validate').addEventListener('click', doValidate);
  HT.$('#tree').addEventListener('click', doTree);
  HT.$('#copy-out').addEventListener('click', copyOut);

  doFormat();
})();