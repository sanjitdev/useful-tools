/* ============================================
   Grade Calculator
   Weighted grade with letter grade, plus final-exam planner.
   ============================================ */

(function () {
  'use strict';

  var STORAGE = 'grade_calc_v1';
  var rowsEl = HT.$('#rows');
  var weightWarn = HT.$('#weight-warn');
  var finalGradeEl = HT.$('#final-grade');
  var letterEl = HT.$('#letter-grade');
  var weightSummaryEl = HT.$('#weight-summary');

  function defaultRows() {
    return [
      { id: HT.uid(), name: 'Homework',  weight: 20, score: 92 },
      { id: HT.uid(), name: 'Midterm',   weight: 30, score: 85 },
      { id: HT.uid(), name: 'Project',   weight: 20, score: 88 }
    ];
  }

  function loadRows() {
    var data = HT.storage.get(STORAGE, null);
    if (data && Array.isArray(data.rows)) return data.rows;
    return defaultRows();
  }

  function saveRows(rows) {
    HT.storage.set(STORAGE, { rows: rows });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function letterGrade(pct) {
    if (!isFinite(pct)) return '—';
    if (pct >= 97) return 'A+';
    if (pct >= 93) return 'A';
    if (pct >= 90) return 'A-';
    if (pct >= 87) return 'B+';
    if (pct >= 83) return 'B';
    if (pct >= 80) return 'B-';
    if (pct >= 77) return 'C+';
    if (pct >= 73) return 'C';
    if (pct >= 70) return 'C-';
    if (pct >= 67) return 'D+';
    if (pct >= 63) return 'D';
    if (pct >= 60) return 'D-';
    return 'F';
  }

  function render() {
    var rows = loadRows();
    var html = '';
    rows.forEach(function (r) {
      html +=
        '<div class="row" data-id="' + r.id + '">' +
          '<input class="input name" type="text" value="' + escapeHtml(r.name) + '" placeholder="Assignment">' +
          '<input class="input weight" type="number" min="0" max="100" step="any" value="' + r.weight + '" placeholder="Weight %">' +
          '<input class="input score" type="number" min="0" max="200" step="any" value="' + r.score + '" placeholder="Score %">' +
          '<button type="button" class="btn btn-danger btn-sm remove">Remove</button>' +
        '</div>';
    });
    rowsEl.innerHTML = html;

    HT.qsa('.row', rowsEl).forEach(function (rowEl) {
      var id = rowEl.getAttribute('data-id');
      HT.qs('.name', rowEl).addEventListener('input', function () { updateRow(id, 'name', HT.qs('.name', rowEl).value); recompute(); });
      HT.qs('.weight', rowEl).addEventListener('input', function () { updateRow(id, 'weight', parseFloat(HT.qs('.weight', rowEl).value) || 0); recompute(); });
      HT.qs('.score', rowEl).addEventListener('input', function () { updateRow(id, 'score', parseFloat(HT.qs('.score', rowEl).value) || 0); recompute(); });
      HT.qs('.remove', rowEl).addEventListener('click', function () {
        var rows = loadRows().filter(function (x) { return x.id !== id; });
        saveRows(rows);
        render();
      });
    });

    recompute();
  }

  function updateRow(id, key, value) {
    var rows = loadRows();
    var row = rows.find(function (x) { return x.id === id; });
    if (row) row[key] = value;
    saveRows(rows);
  }

  function recompute() {
    var rows = loadRows();
    var totalWeight = 0;
    var weighted = 0;
    var anyScore = false;
    rows.forEach(function (r) {
      var w = isFinite(r.weight) ? r.weight : 0;
      var s = isFinite(r.score) ? r.score : 0;
      totalWeight += w;
      if (r.score !== '' && r.score !== null && r.score !== undefined && isFinite(s)) {
        weighted += w * s;
        anyScore = true;
      }
    });

    if (totalWeight === 0) {
      finalGradeEl.textContent = '—';
      letterEl.textContent = 'Add at least one assignment with weight.';
      weightSummaryEl.textContent = 'Total weight: 0%';
      weightWarn.className = '';
      weightWarn.textContent = '';
      return;
    }

    var final = weighted / totalWeight;
    finalGradeEl.textContent = HT.formatNumber(final, { minFractionDigits: 2, maxFractionDigits: 2 }) + '%';
    letterEl.textContent = 'Letter grade: ' + letterGrade(final);
    weightSummaryEl.textContent =
      'Total weight: ' + HT.formatNumber(totalWeight, { minFractionDigits: 0, maxFractionDigits: 2 }) + '%' +
      ' · ' + rows.length + ' assignment' + (rows.length === 1 ? '' : 's');

    if (Math.abs(totalWeight - 100) > 0.01) {
      weightWarn.className = 'warning';
      weightWarn.textContent = 'Weights currently sum to ' + HT.formatNumber(totalWeight, { minFractionDigits: 0, maxFractionDigits: 2 }) +
        '% (not 100%). The grade shown is normalized across the entered weights.';
    } else {
      weightWarn.className = 'success';
      weightWarn.textContent = 'Weights sum to 100%.';
    }
  }

  // Add / Clear rows
  HT.$('#add-row').addEventListener('click', function () {
    var rows = loadRows();
    rows.push({ id: HT.uid(), name: 'New assignment', weight: 10, score: 80 });
    saveRows(rows);
    render();
  });

  HT.$('#clear-all').addEventListener('click', function () {
    if (!confirm('Remove all assignments?')) return;
    saveRows([]);
    render();
  });

  // Final planner
  var targetEl = HT.$('#target');
  var fwEl = HT.$('#final-weight');
  var neededEl = HT.$('#needed-result');

  HT.$('#compute-needed').addEventListener('click', function () {
    var target = parseFloat(targetEl.value);
    var fw = parseFloat(fwEl.value);
    var rows = loadRows();

    var totalWeight = 0, weighted = 0;
    rows.forEach(function (r) {
      var w = isFinite(r.weight) ? r.weight : 0;
      var s = isFinite(r.score) ? r.score : 0;
      totalWeight += w;
      weighted += w * s;
    });

    if (!isFinite(target) || !isFinite(fw)) {
      neededEl.style.display = 'block';
      neededEl.innerHTML = '<div class="result-main">—</div><div class="result-sub">Enter both target and final weight.</div>';
      return;
    }

    if (totalWeight + fw > 100.001) {
      neededEl.style.display = 'block';
      neededEl.innerHTML = '<div class="result-main">—</div><div class="result-sub">Final weight (' + fw + '%) plus existing weights (' +
        HT.formatNumber(totalWeight, { minFractionDigits: 0, maxFractionDigits: 2 }) + '%) exceeds 100%.</div>';
      return;
    }

    // current grade points come from current weighted total. Final grade =
    // (weighted + fw * finalScore) / (totalWeight + fw) = target
    var denom = totalWeight + fw;
    if (denom === 0) {
      neededEl.style.display = 'block';
      neededEl.innerHTML = '<div class="result-main">—</div><div class="result-sub">No weights defined.</div>';
      return;
    }
    var neededScore = (target * denom - weighted) / fw;

    var msg;
    var cls;
    if (!isFinite(neededScore)) {
      msg = 'Cannot compute — check inputs.';
      cls = '';
    } else if (neededScore <= 0) {
      msg = 'You\u2019ve already secured a ' + target + '% — you need 0 or lower on the final.';
      cls = 'success';
    } else if (neededScore > 100) {
      msg = 'You would need ' + HT.formatNumber(neededScore, { minFractionDigits: 1, maxFractionDigits: 1 }) +
            '% on the final, which isn\u2019t possible. The highest reachable with these weights is ' +
            HT.formatNumber((weighted + fw * 100) / denom, { minFractionDigits: 1, maxFractionDigits: 1 }) + '%.';
      cls = 'warning';
    } else {
      msg = 'You need <strong>' + HT.formatNumber(neededScore, { minFractionDigits: 1, maxFractionDigits: 1 }) +
            '%</strong> on the final to finish with ' + target + '%.';
      cls = 'success';
    }

    neededEl.style.display = 'block';
    neededEl.className = 'result-card ' + cls;
    neededEl.innerHTML = '<div class="result-main">' + HT.formatNumber(isFinite(neededScore) ? neededScore : 0, { minFractionDigits: 1, maxFractionDigits: 1 }) + '%</div><div class="result-sub">' + msg + '</div>';
  });

  render();
})();