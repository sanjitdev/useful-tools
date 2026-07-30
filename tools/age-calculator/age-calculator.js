/* ============================================
   Age Calculator
   Two modes: from DOB (full breakdown) and target age (reverse).
   ============================================ */

(function () {
  'use strict';

  // -------- helpers --------

  function parseDOB(dateStr, timeStr) {
    if (!dateStr) return null;
    var parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1;
    var d = parseInt(parts[2], 10);
    if (timeStr && /^\d{2}:\d{2}$/.test(timeStr)) {
      var tp = timeStr.split(':');
      var h = parseInt(tp[0], 10);
      var min = parseInt(tp[1], 10);
      return new Date(y, m, d, h, min, 0, 0);
    }
    return new Date(y, m, d, 0, 0, 0, 0);
  }

  // Compute the broken-down age from DOB to "now" (or a reference date).
  // Returns { years, months, days, hours, minutes, seconds, totalDays, totalWeeks,
  //          totalMonths, totalHours, totalMinutes, totalSeconds }
  function computeAge(dob, ref) {
    if (!dob) return null;
    var from = dob.getTime();
    var to = (ref || new Date()).getTime();
    if (isNaN(from) || isNaN(to)) return null;

    var totalMs = to - from;

    // Start from DOB and walk forward.
    var years = 0, months = 0, days = 0, hours = 0, minutes = 0, seconds = 0;

    // Years + months + remaining days (calendar-aware)
    var yFrom = dob.getFullYear();
    var mFrom = dob.getMonth();
    var dFrom = dob.getDate();
    var yTo = ref.getFullYear();
    var mTo = ref.getMonth();
    var dTo = ref.getDate();
    var hTo = ref.getHours();
    var miTo = ref.getMinutes();
    var sTo = ref.getSeconds();

    years = yTo - yFrom;
    months = mTo - mFrom;
    days = dTo - dFrom;

    if (sTo < 0) { /* no-op */ }
    if (days < 0) {
      months -= 1;
      // days in previous month relative to ref
      var prevMonth = mTo - 1;
      var prevYear = yTo;
      if (prevMonth < 0) { prevMonth = 11; prevYear -= 1; }
      days += HT.daysInMonth(prevYear, prevMonth);
    }
    if (months < 0) {
      months += 12;
      years -= 1;
    }
    if (years < 0) years = 0;
    if (months < 0) months = 0;
    if (days < 0) days = 0;

    var totalSec = Math.max(0, Math.floor(totalMs / 1000));
    var totalMin = Math.floor(totalSec / 60);
    var totalHrs = Math.floor(totalMin / 60);
    var totalDays = Math.floor(totalHrs / 24);

    // Sub-day parts
    var dayMs = 86400000;
    var elapsedDaysMs = totalSec * 1000;
    var leftoverMs = elapsedDaysMs - totalDays * dayMs;
    var h = Math.floor(leftoverMs / 3600000);
    leftoverMs -= h * 3600000;
    var mi = Math.floor(leftoverMs / 60000);
    leftoverMs -= mi * 60000;
    var se = Math.floor(leftoverMs / 1000);

    // Total months/weeks (approximate, calendar-based)
    var totalMonths = years * 12 + months + (days / 30.436875);
    var totalWeeks = totalDays / 7;

    return {
      years: years, months: months, days: days,
      hours: h, minutes: mi, seconds: se,
      totalDays: totalDays,
      totalWeeks: Math.floor(totalDays / 7),
      totalMonths: totalMonths,
      totalHours: totalHrs,
      totalMinutes: totalMin,
      totalSeconds: totalSec,
      totalMs: totalMs
    };
  }

  // Add `value` of `unit` to dob, returning a new Date.
  // Approximate handling for month/year is calendar-aware.
  function addUnit(dob, value, unit) {
    var d = new Date(dob.getTime());
    if (unit === 'years') {
      d.setFullYear(d.getFullYear() + value);
    } else if (unit === 'months') {
      d.setMonth(d.getMonth() + value);
    } else if (unit === 'weeks') {
      d.setDate(d.getDate() + value * 7);
    } else if (unit === 'days') {
      d.setDate(d.getDate() + value);
    } else if (unit === 'hours') {
      d.setHours(d.getHours() + value);
    } else if (unit === 'minutes') {
      d.setMinutes(d.getMinutes() + value);
    } else if (unit === 'seconds') {
      d.setSeconds(d.getSeconds() + value);
    }
    return d;
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function dayOfWeek(d) {
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];
  }

  // -------- Mode 1: from DOB --------

  var dobInput = HT.$('#dob');
  var dobTimeInput = HT.$('#dob-time');
  var warningEl = HT.$('#dob-warning');

  function updateFromDOB() {
    var dob = parseDOB(dobInput.value, dobTimeInput.value);
    warningEl.innerHTML = '';
    warningEl.className = '';

    if (!dob || isNaN(dob.getTime())) {
      ['#age-primary', '#t-years', '#t-months', '#t-weeks', '#t-days', '#t-hours', '#t-minutes', '#t-seconds', '#next-bday', '#born-dow']
        .forEach(function (sel) { HT.$(sel).textContent = '—'; });
      HT.$('#age-sub').textContent = 'Enter a valid date of birth.';
      return;
    }

    var now = new Date();
    var age = computeAge(dob, now);
    if (dob > now) {
      warningEl.className = 'warning';
      warningEl.textContent = 'This date of birth is in the future.';
      HT.$('#age-primary').textContent = '—';
      HT.$('#age-sub').textContent = 'Future date selected.';
      return;
    }

    HT.$('#age-primary').textContent = age.years + ' years, ' + age.months + ' months, ' + age.days + ' days';
    HT.$('#age-sub').textContent =
      'As of ' + HT.formatDate(now) + ' · ' +
      HT.formatNumber(age.totalDays) + ' total days · ' +
      HT.formatNumber(age.totalWeeks) + ' complete weeks';

    HT.$('#t-years').textContent = HT.formatNumber(age.years);
    HT.$('#t-months').textContent = HT.formatNumber(Math.round(age.totalMonths));
    HT.$('#t-weeks').textContent = HT.formatNumber(age.totalWeeks);
    HT.$('#t-days').textContent = HT.formatNumber(age.totalDays);
    HT.$('#t-hours').textContent = HT.formatNumber(age.totalHours);
    HT.$('#t-minutes').textContent = HT.formatNumber(age.totalMinutes);
    HT.$('#t-seconds').textContent = HT.formatNumber(age.totalSeconds);

    // Day of week born
    HT.$('#born-dow').innerHTML = '<strong>' + dayOfWeek(dob) + '</strong>';

    // Next birthday
    var next = new Date(now.getFullYear(), dob.getMonth(), dob.getDate(),
      dob.getHours(), dob.getMinutes(), dob.getSeconds());
    if (next <= now) {
      next = new Date(now.getFullYear() + 1, dob.getMonth(), dob.getDate(),
        dob.getHours(), dob.getMinutes(), dob.getSeconds());
    }
    var diffMs = next.getTime() - now.getTime();
    var diffDays = Math.ceil(diffMs / 86400000);
    HT.$('#next-bday').innerHTML =
      '<strong>' + HT.formatDate(next) + '</strong>' +
      '<div class="muted text-sm">' + diffDays + ' day' + (diffDays === 1 ? '' : 's') +
      ' away · turns ' + (now.getFullYear() - dob.getFullYear() + (next.getFullYear() > now.getFullYear() ? 1 : 0)) +
      '</div>';
  }

  // -------- Mode 2: target age --------

  var tDob = HT.$('#t-dob');
  var tUnit = HT.$('#t-unit');
  var tValue = HT.$('#t-value');

  function updateTargetAge() {
    var dob = parseDOB(tDob.value, '00:00');
    var v = parseFloat(tValue.value);
    if (!dob || isNaN(dob.getTime()) || isNaN(v)) {
      HT.$('#target-date').textContent = '—';
      HT.$('#target-direction').textContent = 'Enter your date of birth and a target amount.';
      HT.$('#target-age-label').innerHTML = '<strong>—</strong>';
      HT.$('#target-dow').innerHTML = '<strong>—</strong>';
      return;
    }
    var target = addUnit(dob, v, tUnit.value);
    var now = new Date();
    var dir = target > now ? 'in the future' : (target < dob ? 'before your birth' : 'in the past');
    var when = target > now ? Math.ceil((target - now) / 86400000)
                : (target < dob ? Math.ceil((dob - target) / 86400000)
                : Math.ceil((now - target) / 86400000));

    HT.$('#target-date').textContent = HT.formatDate(target);
    HT.$('#target-direction').textContent =
      'This is ' + dir + ' — ' + when + ' day' + (when === 1 ? '' : 's') +
      (target > now ? ' from today.' : ' ago.');
    HT.$('#target-dow').innerHTML = '<strong>' + dayOfWeek(target) + '</strong>';

    var age = computeAge(dob, target);
    HT.$('#target-age-label').innerHTML =
      '<strong>' + age.years + ' years, ' + age.months + ' months, ' + age.days + ' days old</strong>';
  }

  // -------- Init --------

  // Default DOB to a reasonable value: 25 years ago today
  (function () {
    var d = new Date();
    d.setFullYear(d.getFullYear() - 25);
    var iso = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    dobInput.value = iso;
    tDob.value = iso;
  })();

  HT.makeTabs(HT.$('#mode-tabs'));

  var tickHandler = HT.debounce(function () {
    updateFromDOB();
    updateTargetAge();
  }, 30);

  dobInput.addEventListener('input', tickHandler);
  dobTimeInput.addEventListener('input', tickHandler);
  tDob.addEventListener('input', tickHandler);
  tUnit.addEventListener('change', tickHandler);
  tValue.addEventListener('input', tickHandler);

  // Live "seconds" ticking
  setInterval(function () {
    if (HT.$('[data-tab-panel="from-dob"]').style.display !== 'none') {
      updateFromDOB();
    }
  }, 1000);

  updateFromDOB();
  updateTargetAge();
})();
