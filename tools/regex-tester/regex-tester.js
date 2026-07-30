/* ============================================
   Regex Tester
   Live-test JavaScript regular expressions with highlighting
   and capture-group details.
   ============================================ */

(function () {
  'use strict';

  var patternEl = HT.$('#pattern');
  var flagsEl = HT.$('#flags');
  var testEl = HT.$('#test');
  var liveEl = HT.$('#live');
  var runBtn = HT.$('#run');

  var statusWrap = HT.$('#status-wrap');
  var highlighted = HT.$('#highlighted');
  var matchesEl = HT.$('#matches');

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function escapeAttr(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Walk the input string and build escaped HTML with <mark> wrappers.
  // matches = [{ start, end, full }]
  function renderHighlighted(input, matches) {
    if (matches.length === 0) return escapeHtml(input);
    var out = '';
    var cursor = 0;
    for (var i = 0; i < matches.length; i++) {
      var m = matches[i];
      // Sanity: skip overlaps
      if (m.start < cursor) continue;
      out += escapeHtml(input.slice(cursor, m.start));
      var title = 'index ' + m.start + ' · length ' + (m.end - m.start);
      out += '<mark title="' + escapeAttr(title) + '">' + escapeHtml(input.slice(m.start, m.end)) + '</mark>';
      cursor = m.end;
    }
    out += escapeHtml(input.slice(cursor));
    return out;
  }

  function run() {
    var patternSrc = patternEl.value;
    var flagStr = flagsEl.value;
    var input = testEl.value;

    statusWrap.innerHTML = '';
    highlighted.innerHTML = '';
    matchesEl.innerHTML = '';

    if (patternSrc === '') {
      statusWrap.innerHTML = '<div class="status err">✗ Empty pattern.</div>';
      highlighted.innerHTML = escapeHtml(input);
      return;
    }

    var regex;
    try {
      regex = new RegExp(patternSrc, flagStr);
    } catch (e) {
      statusWrap.innerHTML = '<div class="status err">✗ Invalid regex: ' + escapeHtml(e.message) + '</div>';
      highlighted.innerHTML = escapeHtml(input);
      return;
    }

    var matches = [];
    var m;
    if (regex.global) {
      regex.lastIndex = 0;
      while ((m = regex.exec(input)) !== null) {
        if (m.index === regex.lastIndex) {
          // zero-length match — advance to avoid infinite loop
          regex.lastIndex += 1;
          if (regex.lastIndex > input.length) break;
        }
        var fullMatch = m[0];
        var start = m.index;
        var end = start + fullMatch.length;
        matches.push({ start: start, end: end, full: fullMatch, groups: m.slice(1) });
      }
    } else {
      m = regex.exec(input);
      if (m) {
        var fullMatch = m[0];
        matches.push({
          start: m.index,
          end: m.index + fullMatch.length,
          full: fullMatch,
          groups: m.slice(1)
        });
      }
    }

    if (matches.length === 0) {
      statusWrap.innerHTML = '<div class="status err">✗ 0 matches</div>';
    } else {
      statusWrap.innerHTML =
        '<div class="status ok">✓ ' + matches.length +
        ' match' + (matches.length === 1 ? '' : 'es') + '</div>';
    }

    highlighted.innerHTML = renderHighlighted(input, matches);

    if (matches.length === 0) {
      matchesEl.innerHTML = '<div class="matches-empty">No matches yet. Adjust your pattern or test string.</div>';
      return;
    }

    var html = '<div class="match-list">';
    for (var i = 0; i < matches.length; i++) {
      var mm = matches[i];
      var len = mm.end - mm.start;
      html +=
        '<div class="match-item">' +
          '<div class="match-head">' +
            '<span>#' + (i + 1) + '</span>' +
            '<span>index ' + mm.start + '</span>' +
            '<span>length ' + len + '</span>' +
          '</div>' +
          '<div><span class="match-text">' + escapeHtml(mm.full) + '</span></div>';
      if (mm.groups.length > 0) {
        html += '<div class="group-row">';
        for (var g = 0; g < mm.groups.length; g++) {
          var groupVal = mm.groups[g];
          var groupLabel = groupVal === undefined
            ? '<em>undefined</em>'
            : escapeHtml(groupVal);
          html += '<span class="group">Group ' + (g + 1) + ': ' + groupLabel + '</span>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    html += '</div>';
    matchesEl.innerHTML = html;
  }

  var debouncedRun = HT.debounce(run, 80);

  function attachLive() {
    [patternEl, flagsEl, testEl].forEach(function (el) {
      el.removeEventListener('input', debouncedRun);
      el.removeEventListener('change', debouncedRun);
      if (liveEl.checked) {
        el.addEventListener('input', debouncedRun);
        el.addEventListener('change', debouncedRun);
      }
    });
  }

  liveEl.addEventListener('change', function () {
    attachLive();
    run();
  });

  runBtn.addEventListener('click', run);

  attachLive();
  run();
})();