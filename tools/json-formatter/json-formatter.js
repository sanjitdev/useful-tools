/* ============================================
   JSON Formatter
   Format, minify, validate; optional tree view.
   Story 9.1 — three enhancements gated by ?feature=...
     ?feature=sort   → Sort keys checkbox
     ?feature=schema → Schema textarea + Validate
     ?feature=diff   → JSON-B textarea + Diff
   The page renders only the controls for the
   active features. Invalid ?feature=foo is
   silently dropped (page renders with no
   enhancements visible).
   ============================================ */

(function () {
  'use strict';

  var DEFAULT_INPUT = '{\n  "name": "Handy Tools",\n  "version": 1,\n  "tags": ["utility", "static", "vanilla"],\n  "author": { "name": "you", "email": "you@example.com" },\n  "active": true,\n  "beta": null\n}';

  // ----- DOM lookups -----
  var input = HT.$('#json-input');
  var out = HT.$('#output');
  var status = HT.$('#status');
  var sortPanel = HT.$('#sort-panel');
  var sortKeys = HT.$('#sort-keys');
  var schemaPanel = HT.$('#schema-panel');
  var schemaInput = HT.$('#schema-input');
  var schemaErrors = HT.$('#schema-errors');
  var schemaOk = HT.$('#schema-ok');
  var runSchema = HT.$('#run-schema');
  var diffPanel = HT.$('#diff-panel');
  var inputB = HT.$('#json-input-b');
  var runDiff = HT.$('#run-diff');
  var diffOutput = HT.$('#json-diff-output');

  var currentPretty = '';
  var currentTree = false;
  var lastParsed = null;

  if (!input.value.trim()) input.value = DEFAULT_INPUT;

  // ----- Feature gating (AC-4) -----
  // URL is ?feature=sort,schema,diff (comma-separated).
  // Read directly from the location; no HT.urlState dep for the
  // toggle panels because they are presentational, not bindable
  // inputs in the schema.
  function readFeatures() {
    try {
      var params = new URLSearchParams(location.search || '');
      var raw = (params.get('feature') || '').toLowerCase();
      if (!raw) return [];
      var ALLOWED = { sort: 1, schema: 1, diff: 1 };
      var out = {};
      raw.split(',').forEach(function (part) {
        var t = part.trim();
        if (ALLOWED[t]) out[t] = 1;
      });
      return Object.keys(out);
    } catch (_) {
      return [];
    }
  }

  function applyFeatureGating() {
    var features = readFeatures();
    if (sortPanel) sortPanel.hidden = features.indexOf('sort') < 0;
    if (schemaPanel) schemaPanel.hidden = features.indexOf('schema') < 0;
    if (diffPanel) diffPanel.hidden = features.indexOf('diff') < 0;
  }

  // ----- Helpers -----
  function setStatus(text, cls) {
    status.className = cls || '';
    status.textContent = text || '';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function lineColumnOfError(text, err) {
    var lines = text.split('\n');
    var matched = /\bline\s+(\d+)\s+column\s+(\d+)/.exec(err.message || '');
    if (matched) {
      return 'line ' + matched[1] + ', column ' + matched[2];
    }
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

  // ----- AC-1: sortKeys -----
  function sortKeysRecursive(value) {
    if (Array.isArray(value)) return value.map(sortKeysRecursive);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.keys(value).sort().map(function (k) { return [k, sortKeysRecursive(value[k])]; })
      );
    }
    return value;
  }

  // ----- Tree rendering -----
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
  function buildOutput(parsed) {
    var sorted = (sortKeys && sortKeys.checked) ? sortKeysRecursive(parsed) : parsed;
    return JSON.stringify(sorted, null, 2);
  }

  function doFormat() {
    var r = parseSafe();
    if (!r.ok) { setStatus('Invalid JSON: ' + r.error, 'error'); return; }
    lastParsed = r.parsed;
    currentPretty = buildOutput(r.parsed);
    currentTree = false;
    out.classList.remove('tree');
    out.textContent = currentPretty;
    var note = sortKeys && sortKeys.checked ? 'Sorted · ' : 'Formatted · ';
    setStatus(note + HT.formatNumber(currentPretty.length) + ' chars', 'success');
  }

  function doMinify() {
    var r = parseSafe();
    if (!r.ok) { setStatus('Invalid JSON: ' + r.error, 'error'); return; }
    lastParsed = r.parsed;
    var sorted = (sortKeys && sortKeys.checked) ? sortKeysRecursive(r.parsed) : r.parsed;
    currentPretty = JSON.stringify(sorted);
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
    var sorted = (sortKeys && sortKeys.checked) ? sortKeysRecursive(r.parsed) : r.parsed;
    currentPretty = JSON.stringify(sorted, null, 2);
    currentTree = true;
    out.classList.add('tree');
    out.innerHTML = renderTree(sorted);
    wireTreeToggles(out);
    setStatus('Tree view rendered.', 'success');
  }

  function copyOut() {
    HT.copyToClipboard(currentPretty || (lastParsed ? JSON.stringify(lastParsed, null, 2) : ''));
  }

  // ----- AC-2: Schema validate -----
  function doSchema() {
    if (!schemaInput || !schemaErrors || !schemaOk) return;
    schemaErrors.innerHTML = '';
    schemaOk.hidden = true;
    var raw = (schemaInput.value || '').trim();
    if (!raw) {
      // Empty schema is a no-op per spec (AC-2): no error, no success chip.
      return;
    }
    var schema;
    try {
      schema = JSON.parse(raw);
    } catch (e) {
      renderSchemaErrors([{ path: '', message: 'Invalid schema JSON: ' + e.message }]);
      return;
    }
    var r = parseSafe();
    if (!r.ok) {
      renderSchemaErrors([{ path: '', message: 'Input JSON is invalid; cannot validate against schema.' }]);
      return;
    }
    lastParsed = r.parsed;
    var result = HT.jsonSchema.validate(schema, r.parsed);
    if (result.valid) {
      schemaOk.hidden = false;
    } else {
      renderSchemaErrors(result.errors);
    }
  }

  function renderSchemaErrors(errors) {
    schemaErrors.innerHTML = '';
    var frag = document.createDocumentFragment();
    for (var i = 0; i < errors.length; i += 1) {
      var err = errors[i];
      var li = document.createElement('li');
      var pathText = err.path && err.path.length > 0 ? err.path : '(root)';
      li.innerHTML = '<code>' + escapeHtml(pathText) + '</code>: ' + escapeHtml(err.message);
      li.setAttribute('data-path', pathText);
      frag.appendChild(li);
    }
    schemaErrors.appendChild(frag);
  }

  // ----- AC-3: Diff -----
  function doDiff() {
    if (!diffOutput) return;
    diffOutput.innerHTML = '';
    var rawA = input.value;
    var rawB = inputB ? inputB.value : '';
    // Parse both; if either is unparseable, show inline error.
    var parsedA, parsedB;
    try { parsedA = JSON.parse(rawA); } catch (e) {
      renderDiffMessage('JSON A is invalid: ' + e.message, true);
      return;
    }
    try { parsedB = JSON.parse(rawB); } catch (e) {
      renderDiffMessage('JSON B is invalid: ' + e.message, true);
      return;
    }
    var textA = JSON.stringify(parsedA, null, 2);
    var textB = JSON.stringify(parsedB, null, 2);
    var linesA = HT.diff.splitLines(textA);
    var linesB = HT.diff.splitLines(textB);
    var ops = HT.diff.myersDiff(linesA, linesB);
    var frag = document.createDocumentFragment();
    for (var i = 0; i < ops.length; i += 1) {
      var op = ops[i];
      var div = document.createElement('div');
      div.className = 'diff-line diff-' + op.op;
      div.setAttribute('data-marker', op.op === 'equal' ? ' ' : (op.op === 'insert' ? '+' : '−'));
      div.textContent = op.value;
      frag.appendChild(div);
    }
    diffOutput.appendChild(frag);
  }

  function renderDiffMessage(text, isError) {
    diffOutput.innerHTML = '';
    var div = document.createElement('div');
    div.className = 'diff-line diff-' + (isError ? 'delete' : 'equal');
    div.setAttribute('data-marker', isError ? '!' : ' ');
    div.textContent = text;
    diffOutput.appendChild(div);
  }

  // ----- Wiring -----
  function wireActions() {
    HT.$('#format').addEventListener('click', doFormat);
    HT.$('#minify').addEventListener('click', doMinify);
    HT.$('#validate').addEventListener('click', doValidate);
    HT.$('#tree').addEventListener('click', doTree);
    HT.$('#copy-out').addEventListener('click', copyOut);
    if (sortKeys) sortKeys.addEventListener('change', doFormat);
    if (runSchema) runSchema.addEventListener('click', doSchema);
    if (runDiff) runDiff.addEventListener('click', doDiff);
  }

  // ----- Boot -----
  applyFeatureGating();
  wireActions();
  doFormat();

  // Re-apply gating on history navigation. ?feature=… lives in
  // location.search, so hashchange never fires for query-string
  // edits — popstate covers back/forward, which is the supported
  // way to revisit a different feature-set page.
  window.addEventListener('popstate', applyFeatureGating);
})();
