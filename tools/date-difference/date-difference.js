/* ============================================
   Date Difference
   Difference between two dates, with multiple unit outputs.
   ============================================ */

(function () {
  'use strict';

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function parseDate(str) {
    if (!str) return null;
    var parts = str.split('-');
    if (parts.length !== 3) return null;
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1;
    var d = parseInt(parts[2], 10);
    var dt = new Date(y, m, d, 0, 0, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
  }

  function isoDate(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  // Calendar-aware breakdown of years/months/days between two dates
  // Returns { years, months, days } such that start + y + m + d === end (sign-wise).
  function breakdown(start, end) {
    var y1 = start.getFullYear();
    var m1 = start.getMonth();
    var d1 = start.getDate();
    var y2 = end.getFullYear();
    var m2 = end.getMonth();
    var d2 = end.getDate();

    var years = y2 - y1;
    var months = m2 - m1;
    var days = d2 - d1;

    if (days < 0) {
      months -= 1;
      var prevMonth = m2 - 1;
      var prevYear = y2;
      if (prevMonth < 0) { prevMonth = 11; prevYear -= 1; }
      days += HT.daysInMonth(prevYear, prevMonth);
    }
    if (months < 0) {
      months += 12;
      years -= 1;
    }
    return { years: years, months: months, days: days };
  }

  function businessDaysBetween(start, end, includeEnd) {
    // Count business days between start and end (Mon-Fri).
    if (start > end) return businessDaysBetween(end, start, includeEnd);
    var d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    var e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    var count = 0;
    var cur = new Date(d.getTime());
    var stop = includeEnd ? new Date(e.getTime() + 86400000) : e;
    while (cur < stop) {
      var dow = cur.getDay();
      if (dow !== 0 && dow !== 6) count++;
      cur = new Date(cur.getTime() + 86400000);
    }
    return count;
  }

  // -------- DOM --------
  var startInput = HT.$('#start');
  var endInput = HT.$('#end');
  var includeEndInput = HT.$('#include-end');
  var unitInput = HT.$('#unit');
  var warnEl = HT.$('#warn');

  function setText(id, val) { HT.$(id).textContent = val; }

  function update() {
    warnEl.style.display = 'none';
    warnEl.textContent = '';

    var s = parseDate(startInput.value);
    var e = parseDate(endInput.value);
    if (!s || !e) {
      ['#primary','#t-years','#t-months','#t-days','#t-bdays','#t-weeks','#t-hours','#t-minutes','#t-seconds']
        .forEach(function (sel) { HT.$(sel).textContent = '—'; });
      setText('#sub', 'Pick two dates to begin.');
      return;
    }

    var start = s;
    var end = e;
    var negative = false;
    if (start > end) {
      warnEl.style.display = '';
      warnEl.textContent = 'Start date is after end date — showing absolute values.';
      var tmp = start; start = end; end = tmp;
      negative = true;
    }

    var includeEnd = includeEndInput.checked;
    var unit = unitInput.value;

    // Day counts
    var dayMs = 86400000;
    var aMid = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    var bMid = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
    var rawDays = Math.round((bMid - aMid) / dayMs);
    var totalDays = includeEnd ? rawDays + 1 : rawDays;

    var totalSeconds = totalDays * 86400;
    var totalMinutes = totalDays * 1440;
    var totalHours = totalDays * 24;
    var totalWeeks = totalDays / 7;

    var bd = businessDaysBetween(start, end, includeEnd);

    var bdBreak = breakdown(start, end);
    // Average days/month for unit conversions
    var totalMonths = bdBreak.years * 12 + bdBreak.months + bdBreak.days / 30.436875;
    var totalYears = totalMonths / 12;

    var unitValue = 0;
    var unitLabel = '';
    if (unit === 'days') { unitValue = totalDays; unitLabel = 'day' + (totalDays === 1 ? '' : 's'); }
    else if (unit === 'weeks') { unitValue = totalWeeks; unitLabel = 'week' + (totalWeeks === 1 ? '' : 's'); }
    else if (unit === 'months') { unitValue = totalMonths; unitLabel = 'month' + (Math.round(totalMonths) === 1 ? '' : 's'); }
    else if (unit === 'years') { unitValue = totalYears; unitLabel = 'year' + (Math.round(totalYears) === 1 ? '' : 's'); }
    else if (unit === 'hours') { unitValue = totalHours; unitLabel = 'hour' + (totalHours === 1 ? '' : 's'); }
    else if (unit === 'minutes') { unitValue = totalMinutes; unitLabel = 'minute' + (totalMinutes === 1 ? '' : 's'); }
    else if (unit === 'seconds') { unitValue = totalSeconds; unitLabel = 'second' + (totalSeconds === 1 ? '' : 's'); }
    else if (unit === 'business-days') { unitValue = bd; unitLabel = 'business day' + (bd === 1 ? '' : 's'); }

    var direction = negative ? 'before start' : 'from start to end';

    setText('#primary', HT.formatNumber(unitValue) + ' ' + unitLabel);
    setText('#sub', 'Inclusive: ' + (includeEnd ? 'yes' : 'no') + ' · ' + direction);

    setText('#t-years', HT.formatNumber(totalYears));
    setText('#t-months', HT.formatNumber(totalMonths));
    setText('#t-days', HT.formatNumber(totalDays));
    setText('#t-bdays', HT.formatNumber(bd));
    setText('#t-weeks', HT.formatNumber(totalWeeks));
    setText('#t-hours', HT.formatNumber(totalHours));
    setText('#t-minutes', HT.formatNumber(totalMinutes));
    setText('#t-seconds', HT.formatNumber(totalSeconds));
  }

  // Defaults: start = 30 days ago, end = today
  (function () {
    var today = new Date();
    var past = new Date();
    past.setDate(today.getDate() - 30);
    startInput.value = isoDate(past);
    endInput.value = isoDate(today);
  })();

  var handler = HT.debounce(update, 50);
  startInput.addEventListener('input', handler);
  endInput.addEventListener('input', handler);
  includeEndInput.addEventListener('change', update);
  unitInput.addEventListener('change', update);

  update();
})();