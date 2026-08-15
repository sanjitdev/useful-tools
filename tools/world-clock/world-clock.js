/* ============================================
   World Clock
   Pinned city cards + meeting time finder.
   Persisted via HT.storage under key 'world_clock_v1'.
   ============================================ */

(function () {
  'use strict';

  var STORAGE = 'handy-tools.world-clock.state';

  var COMMON_TZ = [
    { tz: 'America/Los_Angeles', label: 'Los Angeles' },
    { tz: 'America/Denver', label: 'Denver' },
    { tz: 'America/Chicago', label: 'Chicago' },
    { tz: 'America/New_York', label: 'New York' },
    { tz: 'America/Sao_Paulo', label: 'São Paulo' },
    { tz: 'Europe/London', label: 'London' },
    { tz: 'Europe/Paris', label: 'Paris' },
    { tz: 'Europe/Berlin', label: 'Berlin' },
    { tz: 'Europe/Moscow', label: 'Moscow' },
    { tz: 'Africa/Cairo', label: 'Cairo' },
    { tz: 'Africa/Johannesburg', label: 'Johannesburg' },
    { tz: 'Asia/Dubai', label: 'Dubai' },
    { tz: 'Asia/Kolkata', label: 'Mumbai / Kolkata' },
    { tz: 'Asia/Bangkok', label: 'Bangkok' },
    { tz: 'Asia/Shanghai', label: 'Shanghai' },
    { tz: 'Asia/Hong_Kong', label: 'Hong Kong' },
    { tz: 'Asia/Singapore', label: 'Singapore' },
    { tz: 'Asia/Tokyo', label: 'Tokyo' },
    { tz: 'Asia/Seoul', label: 'Seoul' },
    { tz: 'Australia/Sydney', label: 'Sydney' },
    { tz: 'Pacific/Auckland', label: 'Auckland' },
    { tz: 'UTC', label: 'UTC' }
  ];

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function partsInTZ(d, tz) {
    try {
      var fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false, weekday: 'short'
      });
      var parts = fmt.formatToParts(d).reduce(function (acc, p) {
        acc[p.type] = p.value;
        return acc;
      }, {});
      // Intl returns hour "24" for midnight in some envs — normalise.
      var hh = parseInt(parts.hour, 10);
      if (hh === 24) hh = 0;
      return {
        year: parseInt(parts.year, 10),
        month: parseInt(parts.month, 10),
        day: parseInt(parts.day, 10),
        hour: hh,
        minute: parseInt(parts.minute, 10),
        second: parseInt(parts.second, 10),
        weekday: parts.weekday || ''
      };
    } catch (e) {
      return null;
    }
  }

  function offsetMinutes(d, tz) {
    // Returns offset in minutes for tz at the given instant.
    var p = partsInTZ(d, tz);
    if (!p) return 0;
    var asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return Math.round((asUTC - d.getTime()) / 60000);
  }

  function offsetLabel(mins) {
    var sign = mins >= 0 ? '+' : '-';
    var a = Math.abs(mins);
    return 'UTC' + sign + pad(Math.floor(a / 60)) + ':' + pad(a % 60);
  }

  function loadAll() {
    var d = HT.storage.get(STORAGE, null);
    if (d && Array.isArray(d.cities)) return d;
    return { cities: [
      { id: HT.uid(), name: 'New York', tz: 'America/New_York' },
      { id: HT.uid(), name: 'London', tz: 'Europe/London' },
      { id: HT.uid(), name: 'Tokyo', tz: 'Asia/Tokyo' }
    ] };
  }

  function saveAll(d) { HT.storage.set(STORAGE, d); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function labelForTz(tz) {
    var m = COMMON_TZ.find(function (x) { return x.tz === tz; });
    return m ? m.label : tz;
  }

  function renderCities() {
    var data = loadAll();
    var listEl = HT.$('#wc-list');
    if (data.cities.length === 0) {
      listEl.innerHTML = '<div class="empty">No cities yet. Add one above.</div>';
      return;
    }
    var now = new Date();
    var html = '';
    data.cities.forEach(function (c) {
      var p = partsInTZ(now, c.tz);
      var offset = offsetMinutes(now, c.tz);
      var timeStr = p ? pad(p.hour) + ':' + pad(p.minute) + ':' + pad(p.second) : '—';
      var dateStr = p ?
        c.tz + ' · ' + p.weekday + ', ' +
        new Date(p.year, p.month - 1, p.day).toLocaleDateString(undefined,
          { month: 'short', day: 'numeric', year: 'numeric' }) :
        c.tz;
      html +=
        '<div class="city-card" data-id="' + c.id + '">' +
          '<div>' +
            '<div class="city-head">' +
              '<div class="city-name">' + escapeHtml(c.name) + '</div>' +
              '<div class="city-tz">' + escapeHtml(dateStr) + '</div>' +
            '</div>' +
            '<div class="city-meta">' +
              '<span class="tag">' + offsetLabel(offset) + '</span>' +
              '<span class="tag">' + (p ? p.weekday : '') + '</span>' +
            '</div>' +
          '</div>' +
          '<div style="text-align:right;">' +
            '<div class="city-time" data-time="' + c.id + '">' + timeStr + '</div>' +
            '<button type="button" class="btn btn-sm btn-danger city-remove" data-remove="' + c.id + '" style="margin-top:8px;">Remove</button>' +
          '</div>' +
        '</div>';
    });
    listEl.innerHTML = html;

    HT.qsa('[data-remove]', listEl).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-remove');
        var d = loadAll();
        d.cities = d.cities.filter(function (x) { return x.id !== id; });
        saveAll(d);
        renderCities();
        renderMeeting();
      });
    });
  }

  function tick() {
    var data = loadAll();
    var now = new Date();
    data.cities.forEach(function (c) {
      var el = document.querySelector('[data-time="' + c.id + '"]');
      if (!el) return;
      var p = partsInTZ(now, c.tz);
      if (p) {
        el.textContent = pad(p.hour) + ':' + pad(p.minute) + ':' + pad(p.second);
      }
    });
  }

  // ---------- Meeting time finder ----------

  function readMeeting() {
    var dateStr = HT.$('#wc-mtg-date').value;
    var timeStr = HT.$('#wc-mtg-time').value || '12:00';
    if (!dateStr) return null;
    var parts = dateStr.split('-');
    var t = timeStr.split(':');
    // Interpret these numbers as local time, then convert to an instant.
    var local = new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10),
      parseInt(t[0], 10) || 0,
      parseInt(t[1], 10) || 0,
      0, 0
    );
    return local;
  }

  function renderMeeting() {
    var data = loadAll();
    var listEl = HT.$('#wc-mtg-list');
    if (data.cities.length === 0) {
      listEl.innerHTML = '<div class="muted text-sm">Add a city to see meeting times.</div>';
      return;
    }
    var when = readMeeting();
    if (!when || isNaN(when.getTime())) {
      listEl.innerHTML = '<div class="muted text-sm">Pick a date and time.</div>';
      return;
    }
    var html = '';
    data.cities.forEach(function (c) {
      var p = partsInTZ(when, c.tz);
      if (!p) return;
      var dateObj = new Date(p.year, p.month - 1, p.day);
      var dateLabel = dateObj.toLocaleDateString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric'
      });
      var isNight = p.hour < 7 || p.hour >= 22;
      html +=
        '<div class="mtg-tile' + (isNight ? ' is-night' : '') + '">' +
          '<div class="mtg-tile-name">' + escapeHtml(c.name) + '</div>' +
          '<div class="mtg-tile-time">' + pad(p.hour) + ':' + pad(p.minute) + '</div>' +
          '<div class="mtg-tile-date">' + escapeHtml(dateLabel) + '</div>' +
        '</div>';
    });
    listEl.innerHTML = html;
  }

  // ---------- Wiring ----------

  var tzSelect = HT.$('#wc-tz');
  COMMON_TZ.forEach(function (t) {
    var opt = document.createElement('option');
    opt.value = t.tz;
    opt.textContent = '(' + (t.tz.split('/')[1] || t.tz).replace(/_/g, ' ') + ') ' + t.label;
    tzSelect.appendChild(opt);
  });

  HT.$('#wc-add').addEventListener('click', function () {
    var name = HT.$('#wc-name').value.trim();
    var tz = tzSelect.value;
    var display = name || labelForTz(tz);
    var d = loadAll();
    d.cities.push({ id: HT.uid(), name: display, tz: tz });
    saveAll(d);
    HT.$('#wc-name').value = '';
    renderCities();
    renderMeeting();
    HT.toast('Added ' + display);
  });

  HT.$('#wc-mtg-date').addEventListener('change', renderMeeting);
  HT.$('#wc-mtg-time').addEventListener('change', renderMeeting);
  HT.$('#wc-mtg-time').addEventListener('input', renderMeeting);

  // Story 9.19 — opt the meeting-date input into HT.datePicker (lazy
  // via shell-thin Proxy). The picker's onSelect writes back to the
  // input.value via the standard change event flow, so renderMeeting()
  // picks it up transparently. The "Now" button writes to .value
  // directly and calls renderMeeting() — no interaction with the
  // popover.
  if (HT.datePicker && typeof HT.datePicker.enhance === 'function') {
    HT.qsa('.js-date-picker').forEach(function (el) {
      HT.datePicker.enhance(el, {});
    });
  }

  HT.$('#wc-mtg-now').addEventListener('click', function () {
    var n = new Date();
    HT.$('#wc-mtg-date').value =
      n.getFullYear() + '-' + pad(n.getMonth() + 1) + '-' + pad(n.getDate());
    HT.$('#wc-mtg-time').value = pad(n.getHours()) + ':' + pad(n.getMinutes());
    renderMeeting();
  });

  // Defaults: ensure date input has today's date.
  (function initMeeting() {
    var n = new Date();
    if (!HT.$('#wc-mtg-date').value) {
      HT.$('#wc-mtg-date').value =
        n.getFullYear() + '-' + pad(n.getMonth() + 1) + '-' + pad(n.getDate());
    }
  })();

  renderCities();
  renderMeeting();
  tick();
  setInterval(tick, 1000);
})();