/* ============================================
   Countdown to Date
   Live countdown with quick-pick chips and progress bar.
   Persisted via HT.storage under key 'countdown_to_date_v1'.
   ============================================ */

(function () {
  'use strict';

  var STORAGE = 'handy-tools.countdown-to-date.state';

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  // Default target = end of current year (Dec 31 23:59 local time)
  function defaultTarget() {
    var now = new Date();
    var y = now.getFullYear();
    var d = new Date(y, 11, 31, 23, 59, 0, 0);
    // If we're already past Dec 31 (somehow), push to next year
    if (d.getTime() <= now.getTime()) {
      d = new Date(y + 1, 11, 31, 23, 59, 0, 0);
    }
    return d;
  }

  function toLocalInput(d) {
    var y = d.getFullYear();
    var m = pad(d.getMonth() + 1);
    var day = pad(d.getDate());
    var hh = pad(d.getHours());
    var mm = pad(d.getMinutes());
    return { date: y + '-' + m + '-' + day, time: hh + ':' + mm };
  }

  function loadState() {
    var s = HT.storage.get(STORAGE, null);
    if (s && s.date && s.time) return s;
    var def = toLocalInput(defaultTarget());
    return { date: def.date, time: def.time, label: 'End of year' };
  }

  function saveState(s) {
    HT.storage.set(STORAGE, s);
  }

  function readInputs() {
    return {
      date: HT.$('#cd-date').value,
      time: HT.$('#cd-time').value || '00:00',
      label: HT.$('#cd-label').value.trim()
    };
  }

  function parseTarget(s) {
    if (!s.date) return null;
    var parts = s.date.split('-');
    if (parts.length !== 3) return null;
    var t = (s.time || '00:00').split(':');
    var h = parseInt(t[0], 10) || 0;
    var m = parseInt(t[1], 10) || 0;
    return new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10),
      h, m, 0, 0
    );
  }

  function quickPick(kind) {
    var now = new Date();
    var d;
    switch (kind) {
      case 'end-of-day':
        d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0, 0);
        if (d.getTime() <= now.getTime()) {
          d.setDate(d.getDate() + 1);
        }
        return { d: d, label: 'End of today' };
      case 'end-of-week': {
        var day = now.getDay(); // 0 = Sunday
        var daysToSat = (6 - day + 7) % 7;
        if (daysToSat === 0) daysToSat = 7;
        d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToSat, 23, 59, 0, 0);
        if (d.getTime() <= now.getTime()) {
          d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToSat + 7, 23, 59, 0, 0);
        }
        return { d: d, label: 'End of week' };
      }
      case 'end-of-month': {
        var y = now.getFullYear();
        var mo = now.getMonth();
        var lastDay = new Date(y, mo + 1, 0).getDate();
        d = new Date(y, mo, lastDay, 23, 59, 0, 0);
        if (d.getTime() <= now.getTime()) {
          mo += 1;
          if (mo > 11) { mo = 0; y += 1; }
          lastDay = new Date(y, mo + 1, 0).getDate();
          d = new Date(y, mo, lastDay, 23, 59, 0, 0);
        }
        return { d: d, label: 'End of month' };
      }
      case 'end-of-year': {
        var yr = now.getFullYear();
        d = new Date(yr, 11, 31, 23, 59, 0, 0);
        if (d.getTime() <= now.getTime()) {
          d = new Date(yr + 1, 11, 31, 23, 59, 0, 0);
        }
        return { d: d, label: 'End of year' };
      }
      case 'in-30':
        d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30, now.getHours(), now.getMinutes(), 0, 0);
        return { d: d, label: 'In 30 days' };
    }
    return null;
  }

  function renderTick() {
    var s = readInputs();
    var target = parseTarget(s);
    var now = Date.now();
    var warn = HT.$('#cd-warning');

    if (!target || isNaN(target.getTime())) {
      HT.$('#cd-primary').textContent = '—';
      HT.$('#cd-sub').textContent = 'Pick a valid date and time.';
      HT.$('#cd-days').textContent = '—';
      HT.$('#cd-hours').textContent = '—';
      HT.$('#cd-minutes').textContent = '—';
      HT.$('#cd-seconds').textContent = '—';
      HT.$('#cd-fill').style.width = '0%';
      HT.$('#cd-progress-pct').textContent = '0%';
      HT.$('#cd-progress-window').textContent = '—';
      warn.innerHTML = '';
      return;
    }

    var diff = target.getTime() - now;
    var label = s.label ? s.label : 'Target';

    if (diff <= 0) {
      HT.$('#cd-primary').textContent = '0 days, 0 hours, 0 minutes, 0 seconds';
      HT.$('#cd-sub').textContent = label + ' has arrived!';
      HT.$('#cd-days').textContent = '0';
      HT.$('#cd-hours').textContent = '0';
      HT.$('#cd-minutes').textContent = '0';
      HT.$('#cd-seconds').textContent = '0';
      HT.$('#cd-fill').style.width = '100%';
      HT.$('#cd-progress-pct').textContent = '100%';
      HT.$('#cd-progress-window').textContent = 'Completed';
      warn.innerHTML = '<div class="success">' + escapeHtml(label) + ' is here.</div>';
      return;
    }

    var abs = Math.floor(diff / 1000);
    var days = Math.floor(abs / 86400);
    var hours = Math.floor((abs % 86400) / 3600);
    var minutes = Math.floor((abs % 3600) / 60);
    var seconds = abs % 60;

    HT.$('#cd-primary').textContent =
      days + ' days, ' + hours + ' hours, ' + minutes + ' minutes, ' + seconds + ' seconds';
    HT.$('#cd-sub').textContent = 'until ' + label;
    HT.$('#cd-days').textContent = days;
    HT.$('#cd-hours').textContent = pad(hours);
    HT.$('#cd-minutes').textContent = pad(minutes);
    HT.$('#cd-seconds').textContent = pad(seconds);

    // Progress: time elapsed from a 1-year-ago window → target, capped 0–100.
    var windowMs = 365 * 24 * 60 * 60 * 1000;
    var start = target.getTime() - windowMs;
    var elapsed = now - start;
    var pct = Math.max(0, Math.min(100, (elapsed / windowMs) * 100));
    HT.$('#cd-fill').style.width = pct.toFixed(1) + '%';
    HT.$('#cd-progress-pct').textContent = pct.toFixed(1) + '%';
    HT.$('#cd-progress-window').textContent =
      HT.formatDateShort(new Date(start)) + ' → ' + HT.formatDateShort(target);

    warn.innerHTML = '';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ----- Wire up -----
  var state = loadState();
  HT.$('#cd-date').value = state.date;
  HT.$('#cd-time').value = state.time;
  HT.$('#cd-label').value = state.label;

  function persistFromInputs() {
    var s = readInputs();
    saveState(s);
  }

  ['#cd-date', '#cd-time', '#cd-label'].forEach(function (sel) {
    HT.$(sel).addEventListener('change', persistFromInputs);
    HT.$(sel).addEventListener('input', persistFromInputs);
  });

  // Story 9.19 — opt the date input into HT.datePicker (lazy via
  // shell-thin Proxy). Story 9.19.1 — also includes the time input.
  // Quick-pick buttons write to .value directly and call
  // persistFromInputs() — no interaction with the popover.
  //
  // shell-thin.js loads with `defer`, so HT.datePicker is undefined
  // when this synchronous script evaluates. Wait for DOMContentLoaded
  // (shell-thin.js always runs before DOMContentLoaded fires).
  function wireDatePickers() {
    if (!HT.datePicker || typeof HT.datePicker.enhance !== 'function') return;
    HT.qsa('.js-date-picker, .js-time-picker').forEach(function (el) {
      HT.datePicker.enhance(el, {});
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireDatePickers);
  } else {
    wireDatePickers();
  }

  HT.qsa('[data-quick]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var q = quickPick(btn.getAttribute('data-quick'));
      if (!q) return;
      var v = toLocalInput(q.d);
      HT.$('#cd-date').value = v.date;
      HT.$('#cd-time').value = v.time;
      HT.$('#cd-label').value = q.label;
      persistFromInputs();
      HT.toast('Target set: ' + q.label);
    });
  });

  renderTick();
  var cdIntervalId = setInterval(renderTick, 1000);
  // Clean up the interval when the page is hidden or unloaded to avoid leaks
  // when this script is re-evaluated (HMR, hot navigation, etc.).
  window.addEventListener('pagehide', function () { clearInterval(cdIntervalId); });
})();