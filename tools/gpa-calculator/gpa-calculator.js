/* ============================================
   GPA Calculator
   Weighted-by-credits semester GPA + cumulative combiner.
   ============================================ */

(function () {
  'use strict';

  var STORAGE = 'gpa_calc_v1';

  // Grade → point mapping on the 4.0 scale.
  var GRADES = [
    { letter: 'A+', points: 4.0 },
    { letter: 'A',  points: 4.0 },
    { letter: 'A-', points: 3.7 },
    { letter: 'B+', points: 3.3 },
    { letter: 'B',  points: 3.0 },
    { letter: 'B-', points: 2.7 },
    { letter: 'C+', points: 2.3 },
    { letter: 'C',  points: 2.0 },
    { letter: 'C-', points: 1.7 },
    { letter: 'D+', points: 1.3 },
    { letter: 'D',  points: 1.0 },
    { letter: 'D-', points: 0.7 },
    { letter: 'F',  points: 0.0 }
  ];

  var gradeOptionsHtml = (function () {
    var html = '';
    for (var i = 0; i < GRADES.length; i++) {
      html += '<option value="' + GRADES[i].letter + '">' + GRADES[i].letter + ' (' + GRADES[i].points.toFixed(1) + ')</option>';
    }
    return html;
  })();

  function defaultRows() {
    return [
      { id: HT.uid(), name: 'Calculus I',         credits: 4, grade: 'A'  },
      { id: HT.uid(), name: 'Intro to Psychology', credits: 3, grade: 'B+' },
      { id: HT.uid(), name: 'English Composition', credits: 3, grade: 'A-' }
    ];
  }

  function loadRows() {
    var data = HT.storage.get(STORAGE, null);
    if (data && Array.isArray(data.rows) && data.rows.length > 0) return data.rows;
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

  function pointsFor(letter) {
    for (var i = 0; i < GRADES.length; i++) {
      if (GRADES[i].letter === letter) return GRADES[i].points;
    }
    return 0;
  }

  function render() {
    var rows = loadRows();
    var html = '';
    rows.forEach(function (r) {
      html +=
        '<div class="row" data-id="' + r.id + '">' +
          '<input class="input name" type="text" value="' + escapeHtml(r.name) + '" placeholder="Course name">' +
          '<input class="input credits" type="number" min="0" step="any" value="' + r.credits + '" placeholder="Credits">' +
          '<select class="select grade">' + gradeOptionsHtml.replace(
            'value="' + escapeHtml(r.grade) + '"',
            'value="' + escapeHtml(r.grade) + '" selected'
          ) + '</select>' +
          '<button type="button" class="btn btn-danger btn-sm remove">Remove</button>' +
        '</div>';
    });
    HT.$('#rows').innerHTML = html;

    HT.qsa('.row', HT.$('#rows')).forEach(function (rowEl) {
      var id = rowEl.getAttribute('data-id');
      HT.qs('.name', rowEl).addEventListener('input', function () {
        updateRow(id, 'name', HT.qs('.name', rowEl).value);
        recompute();
      });
      HT.qs('.credits', rowEl).addEventListener('input', function () {
        var v = parseFloat(HT.qs('.credits', rowEl).value);
        updateRow(id, 'credits', isFinite(v) ? v : 0);
        recompute();
      });
      HT.qs('.grade', rowEl).addEventListener('change', function () {
        updateRow(id, 'grade', HT.qs('.grade', rowEl).value);
        recompute();
      });
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
    var totalCredits = 0;
    var totalPoints = 0;
    var countedCourses = 0;

    rows.forEach(function (r) {
      var credits = isFinite(r.credits) ? r.credits : 0;
      var pts = pointsFor(r.grade);
      if (credits > 0) {
        totalCredits += credits;
        totalPoints += credits * pts;
        countedCourses += 1;
      }
    });

    var gpaEl = HT.$('#gpa');
    var subEl = HT.$('#gpa-sub');

    if (totalCredits === 0) {
      gpaEl.textContent = '—';
      subEl.textContent = 'Add at least one course with credits.';
    } else {
      var gpa = totalPoints / totalCredits;
      gpaEl.textContent = HT.formatNumber(gpa, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      subEl.textContent =
        'Weighted by credits across ' + countedCourses +
        ' course' + (countedCourses === 1 ? '' : 's') + '.';
    }

    HT.$('#total-credits').textContent = HT.formatNumber(totalCredits, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    HT.$('#grade-points').textContent = HT.formatNumber(totalPoints, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    HT.$('#course-count').textContent = HT.formatNumber(countedCourses);

    updateCumulative();
  }

  function normalizeGpaTo4(gpa, scale) {
    if (!isFinite(gpa) || !isFinite(scale) || scale <= 0) return NaN;
    // For 100-point scale, divide by 25 (typical).
    if (scale === 100) return gpa / 25;
    return (gpa / scale) * 4;
  }

  function updateCumulative() {
    var rows = loadRows();
    var semCredits = 0, semPoints = 0;
    rows.forEach(function (r) {
      var c = isFinite(r.credits) ? r.credits : 0;
      if (c > 0) {
        semCredits += c;
        semPoints += c * pointsFor(r.grade);
      }
    });

    var prevCredits = parseFloat(HT.$('#prev-credits').value);
    var prevGpa = parseFloat(HT.$('#prev-gpa').value);
    var prevScale = parseFloat(HT.$('#prev-scale').value);

    var prevGpaEl = HT.$('#cum-gpa');
    var prevSubEl = HT.$('#cum-gpa-sub');

    if (!isFinite(prevCredits) || prevCredits < 0 || !isFinite(prevGpa) || !isFinite(prevScale)) {
      prevGpaEl.textContent = '—';
      prevSubEl.textContent = 'Enter your previous credits, GPA, and scale.';
      return;
    }

    var prevOn4 = normalizeGpaTo4(prevGpa, prevScale);
    if (!isFinite(prevOn4)) {
      prevGpaEl.textContent = '—';
      prevSubEl.textContent = 'Invalid previous GPA or scale.';
      return;
    }

    var totalCredits = prevCredits + semCredits;
    if (totalCredits === 0) {
      prevGpaEl.textContent = '—';
      prevSubEl.textContent = 'Add courses or previous credits to see cumulative GPA.';
      return;
    }

    var totalPoints = prevCredits * prevOn4 + semPoints;
    var cumGpa = totalPoints / totalCredits;

    prevGpaEl.textContent = HT.formatNumber(cumGpa, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    var onUserScale = (cumGpa / 4) * prevScale;
    var displayScale = prevScale === 100 ? ' (≈ ' + HT.formatNumber(onUserScale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' on 100-pt scale)' : '';
    prevSubEl.textContent =
      'New cumulative GPA on the 4.0 scale' + displayScale +
      ' · ' + HT.formatNumber(totalCredits, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' total credits.';
  }

  HT.$('#add-row').addEventListener('click', function () {
    var rows = loadRows();
    rows.push({ id: HT.uid(), name: 'New course', credits: 3, grade: 'A' });
    saveRows(rows);
    render();
  });

  HT.$('#clear-all').addEventListener('click', function () {
    if (!confirm('Remove all courses?')) return;
    saveRows([]);
    render();
  });

  // Previous GPA inputs trigger recompute.
  ['#prev-credits', '#prev-gpa', '#prev-scale'].forEach(function (sel) {
    HT.$(sel).addEventListener('input', updateCumulative);
    HT.$(sel).addEventListener('change', updateCumulative);
  });

  render();
})();