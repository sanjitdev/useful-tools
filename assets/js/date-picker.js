/* ============================================
   Handy Tools — date-picker.js (Story 9.19 + 9.19.1)

   Custom popover-style picker that swaps in for
   `<input type="date">` (class `js-date-picker`),
   `<input type="time">` (class `js-time-picker`), and
   `<input type="datetime-local">` (class `js-date-time-picker`).
   The underlying input stays the source of truth — same `id`,
   `name`, `value` (ISO YYYY-MM-DD / HH:MM / YYYY-MM-DDTHH:MM),
   `min`/`max`, and the same `change`/`input` events fire after a
   pick.

   Page-conditional module — lazy-loaded via shell-thin.js's
   Proxy factory on first `HT.datePicker.enhance()` call.

   AD-1   — Pure vanilla, no third-party libs (animations are CSS-only)
   AD-12  — ES2018 vanilla; no SSR; no build step
   AD-14  — Shell Public API surface (HT.datePicker is the contract)
   FR-7   — Keyboard-first interaction (arrows / PageUp-Down / Home-End / T / Enter / Esc)

   Public API (frozen, stable):
     HT.datePicker.enhance(inputEl, opts?) → handle
       inputEl : HTMLInputElement — must be <input type="date">,
                 <input type="time">, or <input type="datetime-local">.
       opts?   : { onSelect?(value: string) → void }
                 Optional extra callback; the input still fires
                 `change` + `input`.
     HT.datePicker.open(handle)
     HT.datePicker.close(handle)
     HT.datePicker.destroy(handle)
     HT.datePicker.isOpen(handle?) → boolean

   Handle API:
     { open, close, destroy, isOpen, _state }

   DOM shape — date variant (one instance, reused):
     <dialog class="date-picker-dialog" aria-label="Choose date">
       <form method="dialog" class="date-picker-form">
         <header class="date-picker-header">…nav + title…</header>
         <div class="date-picker-weekdays" aria-hidden="true">…</div>
         <div role="grid" class="date-picker-grid"
              aria-labelledby="date-picker-grid-label">
           <!-- 42 cells (6 rows × 7 cols), <button role="gridcell"> -->
         </div>
         <footer class="date-picker-footer">…Today / Clear…</footer>
       </form>
     </dialog>

   DOM shape — time variant (one instance, reused):
     <dialog class="date-picker-dialog time-picker-dialog" aria-label="Choose time">
       <form method="dialog" class="date-picker-form">
         <header class="date-picker-header time-picker-header">
           <span class="time-picker-title" aria-live="polite">14:30</span>
         </header>
         <div class="time-picker-grid-wrap">
           <div role="grid" class="time-picker-hour-col" aria-label="Hour">…24 cells…</div>
           <div role="grid" class="time-picker-minute-col" aria-label="Minute">…12 cells…</div>
         </div>
         <footer class="date-picker-footer">
           <button data-action="now">Now</button>
           <button data-action="clear">Clear</button>
         </footer>
       </form>
     </dialog>

   Story 9.19 — see _bmad-output/implementation-artifacts/story-9.19-date-picker.md
   Story 9.19.1 — see _bmad-output/implementation-artifacts/story-9.19.1-time-picker.md
   ============================================ */

(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  var HT = (window.HT = window.HT || {});

  // Resolve `<repo>/assets/css/chrome-time-picker.css` correctly when
  // the calling tool page is nested (e.g. tools/age-calculator/index.html).
  // We capture the script's URL at module-load time (document.currentScript
  // is set during the synchronous portion of a <script> tag's initial
  // execution, then nulled afterward). The repo-root base is derived the
  // same way shell-thin.js does it: walk the pathname back to the last
  // `assets` segment. See scripts/_smoke_shell_thin_proxies.js §VI.
  var REPO_ROOT_BASE = null;
  try {
    var cs = document.currentScript;
    if (cs && cs.src) {
      var u = new URL(cs.src);
      var parts = u.pathname.split('/').filter(function (p) { return p.length > 0; });
      var idx = parts.lastIndexOf('assets');
      if (idx >= 0) {
        // Origin + leading slash + path. If the repo root is the
        // origin itself (no path segments before `assets`), the
        // URL still works — pathname parsing leaves an empty
        // string before "assets" so the trailing "/" is correct.
        var prefix = parts.slice(0, idx).join('/');
        REPO_ROOT_BASE = u.origin + (prefix ? '/' + prefix : '') + '/';
      }
    }
  } catch (_) { /* keep null — fall back to window.location */ }
  function resolveUrl(rel) {
    if (!rel || typeof rel !== 'string') return rel;
    if (/^(?:[a-z]+:|\/\/|\/)/i.test(rel)) return rel;
    var base = REPO_ROOT_BASE || (window.location ? window.location.href : null);
    if (!base) return rel;
    try { return new URL(rel, base).href; } catch (_) { return rel; }
  }

  /* ----- Internal state registry (mirror quiz.js:76-105) -----
     Per-input handle registry. Each enhanced input gets one handle,
     so multiple inputs on the same page each have their own state.
     The dialog itself is a single instance shared across handles.
  */
  var INSTANCES = [];

  function nextHandleId() {
    return 'datepicker_' + Math.random().toString(36).slice(2, 10);
  }

  function findHandle(handle) {
    if (!handle) return INSTANCES[INSTANCES.length - 1] || null;
    for (var i = 0; i < INSTANCES.length; i += 1) {
      if (INSTANCES[i]._id === handle._id) return INSTANCES[i];
    }
    return null;
  }

  function dropInstance(stateOrHandle) {
    var targetId = null;
    if (!stateOrHandle) return;
    if (typeof stateOrHandle._id === 'string') {
      targetId = stateOrHandle._id;
    } else if (stateOrHandle._state && typeof stateOrHandle._state._id === 'string') {
      targetId = stateOrHandle._state._id;
    }
    if (!targetId) return;
    for (var i = INSTANCES.length - 1; i >= 0; i -= 1) {
      if (INSTANCES[i]._id === targetId) {
        INSTANCES.splice(i, 1);
        return;
      }
    }
  }

  /* ----- DOM helpers (mirror quiz.js:107-151) -----
     el(tag, attrs, children) → DOM node.
     attrs: { class, dataset, text, on* event listeners, boolean attrs }.
     children: array of nodes / strings / null.
     Reduced-motion detector (mirror quiz.js:153-162) — both
     prefers-reduced-motion AND [data-reduced-motion="true"] flags.
  */

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') {
          node.className = String(v);
        } else if (k === 'dataset') {
          for (var d in v) {
            if (Object.prototype.hasOwnProperty.call(v, d)) {
              try { node.dataset[d] = String(v[d]); } catch (_) {}
            }
          }
        } else if (k === 'text') {
          node.textContent = String(v);
        } else if (k.indexOf('on') === 0 && typeof v === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (v === true) {
          try { node.setAttribute(k, ''); } catch (_) {}
        } else {
          try { node.setAttribute(k, String(v)); } catch (_) {}
        }
      }
    }
    if (children) {
      for (var i = 0; i < children.length; i += 1) {
        var c = children[i];
        if (c === null || c === undefined) continue;
        if (typeof c === 'string' || typeof c === 'number') {
          node.appendChild(document.createTextNode(String(c)));
        } else {
          node.appendChild(c);
        }
      }
    }
    return node;
  }

  function clearChildren(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function reducedMotionOn() {
    try {
      var root = document.documentElement;
      if (root && root.getAttribute('data-reduced-motion') === 'true') return true;
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      }
    } catch (_) {}
    return false;
  }

  /* ----- Date constants (Section D) -----
     v1 hardcoded English; locale will be a separate Story 9.19.4
     that introduces a future HT.i18n API.
  */

  var WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var WEEKDAYS_LONG  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS_LONG = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  var MONTHS_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  /* ----- Date math (Section C) -----
     Single source of truth — all date manipulation goes through
     these helpers. Never use `new Date()` / `toLocaleDateString()` /
     `Date.toString()` outside this block; ISO YYYY-MM-DD strings are
     the wire format. Timezone-safe (local calendar fields only).
  */

  function parseISO(str) {
    if (typeof str !== 'string') return null;
    var m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    var y = parseInt(m[1], 10);
    var mo = parseInt(m[2], 10);
    var d = parseInt(m[3], 10);
    if (!(y >= 1 && y <= 9999)) return null;
    if (!(mo >= 1 && mo <= 12)) return null;
    if (!(d >= 1 && d <= 31)) return null;
    return { y: y, m: mo, d: d };
  }

  function toISO(parts) {
    if (!parts) return '';
    var y = String(parts.y);
    var mo = parts.m < 10 ? '0' + parts.m : String(parts.m);
    var d = parts.d < 10 ? '0' + parts.d : String(parts.d);
    return y + '-' + mo + '-' + d;
  }

  function isoCompare(a, b) {
    if (a === b) return 0;
    if (a < b) return -1;
    return 1;
  }

  function isoToday() {
    var n = new Date();
    return toISO({ y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() });
  }

  function daysInMonth(y, m) {
    return new Date(y, m, 0).getDate();
  }

  function shiftISO(iso, deltaDays) {
    var parts = parseISO(iso);
    if (!parts) return null;
    var d = new Date(parts.y, parts.m - 1, parts.d);
    d.setDate(d.getDate() + deltaDays);
    return toISO({ y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() });
  }

  function gridStart(view) {
    // Leading Sunday for the view month.
    var first = new Date(view.y, view.m - 1, 1);
    var dow = first.getDay(); // 0 = Sun
    first.setDate(first.getDate() - dow);
    return toISO({ y: first.getFullYear(), m: first.getMonth() + 1, d: first.getDate() });
  }

  function sameMonth(iso, view) {
    var p = parseISO(iso);
    return !!p && p.y === view.y && p.m === view.m;
  }

  function clampToBounds(iso, minIso, maxIso) {
    if (!iso) return iso;
    if (minIso && isoCompare(iso, minIso) < 0) return minIso;
    if (maxIso && isoCompare(iso, maxIso) > 0) return maxIso;
    return iso;
  }

  function addMonths(view, delta) {
    var m = view.m + delta;
    var y = view.y;
    while (m < 1) { m += 12; y -= 1; }
    while (m > 12) { m -= 12; y += 1; }
    return { y: y, m: m };
  }

  function addYears(view, delta) {
    return { y: view.y + delta, m: view.m };
  }

  /* ----- Time constants (Section D-time) -----
     v1 hardcoded English; locale will be a separate Story 9.19.4
     that introduces a future HT.i18n API. 24-hour HH:MM string is
     the wire format (matches <input type="time">.value).
  */

  var HOURS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
  // 5-minute granularity (web convention for time pickers; minute
  // arrows fine-tune by ±1 to escape the 5-minute grid).
  var MINUTES_5 = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  /* ----- Time math (Section C-time) -----
     Single source of truth — all time manipulation goes through
     these helpers. Never use `Date.toString()` / `toLocaleTimeString()`
     outside this block. HH:MM strings are the wire format. Timezone-
     safe (local calendar fields only — we never round-trip through
     a Date object that depends on the user's UTC offset).
  */

  function parseTime(str) {
    if (typeof str !== 'string') return null;
    var m = str.match(/^(\d{2}):(\d{2})$/);
    if (!m) return null;
    var h = parseInt(m[1], 10);
    var mn = parseInt(m[2], 10);
    if (!(h >= 0 && h <= 23)) return null;
    if (!(mn >= 0 && mn <= 59)) return null;
    return { h: h, m: mn };
  }

  function toTime(parts) {
    if (!parts) return '';
    var h = parts.h < 10 ? '0' + parts.h : String(parts.h);
    var mn = parts.m < 10 ? '0' + parts.m : String(parts.m);
    return h + ':' + mn;
  }

  function timeCompare(a, b) {
    if (a === b) return 0;
    if (a < b) return -1;
    return 1;
  }

  function timeNow() {
    var n = new Date();
    var h = n.getHours();
    var m = n.getMinutes();
    // Snap to nearest 5-minute grid for the default selection view.
    var snapped = Math.round(m / 5) * 5;
    if (snapped >= 60) { snapped = 55; }
    return toTime({ h: h, m: snapped });
  }

  // Shift an HH:MM string by `deltaMinutes` (can be negative). Returns
  // a new HH:MM string, wrapping at 24:00. Used by arrow keys (±1 min)
  // and Shift+arrows (±5 min).
  function shiftTime(hhmm, deltaMinutes) {
    var parts = parseTime(hhmm);
    if (!parts) return null;
    var total = parts.h * 60 + parts.m + deltaMinutes;
    // Wrap: 24*60 = 1440 minutes in a day.
    total = ((total % 1440) + 1440) % 1440;
    return toTime({ h: Math.floor(total / 60), m: total % 60 });
  }

  // Clamp HH:MM to [minTime, maxTime] (both HH:MM, exclusive). Returns
  // the input unchanged if it falls within bounds; otherwise returns
  // the near bound. Returns null if input is invalid.
  function clampTimeToBounds(hhmm, minTime, maxTime) {
    if (!hhmm) return hhmm;
    if (minTime && timeCompare(hhmm, minTime) < 0) return minTime;
    if (maxTime && timeCompare(hhmm, maxTime) > 0) return maxTime;
    return hhmm;
  }

  // Round a HH:MM to the nearest 5-minute mark. Returns the input
  // unchanged if already a multiple of 5.
  function snapToFive(hhmm) {
    var parts = parseTime(hhmm);
    if (!parts) return hhmm;
    var snapped = Math.round(parts.m / 5) * 5;
    if (snapped >= 60) snapped = 55;
    return toTime({ h: parts.h, m: snapped });
  }

  /* ----- Dialog build (Section E) -----
     Single shared dialog instance. Phase 2 fills in the full grid
     + header refs + footer refs + keyboard handlers.
  */

  var _dlg = null;           // shared dialog reference for type='date'  (null until first enhance)
  var _dlgTime = null;       // shared dialog reference for type='time'  (null until first enhance)
  var _dlgDateTime = null;   // shared dialog reference for type='datetime-local' (tab strip + date + time panes)

  function _buildDialogShell() {
    var prevBtn = el('button', {
      type: 'button',
      class: 'date-picker-nav date-picker-prev-month',
      'aria-label': 'Previous month',
      text: '\u2039', // ‹
    });
    var nextBtn = el('button', {
      type: 'button',
      class: 'date-picker-nav date-picker-next-month',
      'aria-label': 'Next month',
      text: '\u203A', // ›
    });
    var monthLabel = el('span', { class: 'date-picker-month-label', text: 'January' });
    var yearLabel  = el('span', { class: 'date-picker-year-label',  text: '2026' });
    var titleBtn = el('button', {
      type: 'button',
      class: 'date-picker-title',
      'aria-haspopup': 'true',
    }, [monthLabel, yearLabel]);

    var gridLabel = el('span', {
      id: 'date-picker-grid-label',
      class: 'date-picker-sr-only',
      text: 'January 2026',
    });
    var grid = el('div', {
      role: 'grid',
      class: 'date-picker-grid',
      'aria-labelledby': 'date-picker-grid-label',
    }, [gridLabel]);

    var todayBtn = el('button', {
      type: 'button',
      class: 'date-picker-today',
      dataset: { action: 'today' },
      text: 'Today',
    });
    var clearBtn = el('button', {
      type: 'button',
      class: 'date-picker-clear',
      dataset: { action: 'clear' },
      text: 'Clear',
    });

    var dlg = el('dialog', { class: 'date-picker-dialog', 'aria-label': 'Choose date' }, [
      el('form', { method: 'dialog', class: 'date-picker-form' }, [
        el('header', { class: 'date-picker-header' }, [prevBtn, titleBtn, nextBtn]),
        el('div', { class: 'date-picker-weekdays', 'aria-hidden': 'true' },
          WEEKDAYS_SHORT.map(function (w) { return el('span', { text: w }); })
        ),
        grid,
        el('footer', { class: 'date-picker-footer' }, [todayBtn, clearBtn]),
      ]),
    ]);

    return {
      dlg: dlg,
      prevBtn: prevBtn,
      nextBtn: nextBtn,
      titleBtn: titleBtn,
      monthLabel: monthLabel,
      yearLabel: yearLabel,
      grid: grid,
      gridLabel: gridLabel,
      todayBtn: todayBtn,
      clearBtn: clearBtn,
    };
  }

  function _ensureDialog() {
    if (_dlg) return _dlg;
    if (typeof document === 'undefined' || !document.body) return null;
    _dlg = _buildDialogShell();
    document.body.appendChild(_dlg.dlg);
    _wireDialogHandlers(_dlg);
    return _dlg;
  }

  /* ----- Grid render (Section F) -----
     Renders 42 cells (6 rows × 7 cols). Roving tabindex: only the
     focused day cell has tabindex=0; the rest have tabindex=-1 so
     Tab cycles into/out of the dialog (not between cells). Cells
     outside the view month get `date-picker-day--other-month`.
     The cell matching input.value (if any) gets
     `date-picker-day--selected`. The cell matching today gets
     `date-picker-day--today`. Cells outside min/max get
     `date-picker-day--disabled` + `disabled` attr.
  */

  function _renderGrid(state) {
    var dlg = state.dlg;
    if (!dlg) return;
    // Dispatch on mode — Story 9.19.5 (inlined into 9.19.1 hotfix 4).
    if (state.mode === 'months') return _renderMonths(state);
    if (state.mode === 'years')  return _renderYears(state);
    return _renderDays(state);
  }

  function _renderDays(state) {
    var dlg = state.dlg;
    if (!dlg) return;
    var grid = dlg.grid;
    clearChildren(grid);
    grid.classList.remove('date-picker-grid--narrow');
    if (dlg.dlg && dlg.dlg.classList) dlg.dlg.classList.remove('date-picker-dialog--month-year-mode');

    var startIso = gridStart(state.view);
    var todayIso = isoToday();
    var selectedIso = state.selected;
    var minIso = state.minIso || null;
    var maxIso = state.maxIso || null;

    // Header labels
    dlg.monthLabel.textContent = MONTHS_LONG[state.view.m - 1];
    dlg.yearLabel.textContent  = String(state.view.y);
    dlg.gridLabel.textContent  = MONTHS_LONG[state.view.m - 1] + ' ' + state.view.y;

    var focusIso = state.focusedIso || selectedIso || (sameMonth(todayIso, state.view) ? todayIso : startIso);
    state.focusedIso = focusIso;

    for (var i = 0; i < 42; i += 1) {
      var iso = shiftISO(startIso, i);
      var parts = parseISO(iso);
      var isOther = !sameMonth(iso, state.view);
      var isToday = iso === todayIso;
      var isSelected = iso === selectedIso;
      var isFocused = iso === focusIso;
      var isDisabled = (minIso && isoCompare(iso, minIso) < 0) || (maxIso && isoCompare(iso, maxIso) > 0);
      var dow = new Date(parts.y, parts.m - 1, parts.d).getDay();

      var classes = ['date-picker-day'];
      if (isOther)     classes.push('date-picker-day--other-month');
      if (isToday)     classes.push('date-picker-day--today');
      if (isSelected)  classes.push('date-picker-day--selected');
      if (isFocused)   classes.push('date-picker-day--focused');

      var attrs = {
        type: 'button',
        role: 'gridcell',
        class: classes.join(' '),
        dataset: { date: iso },
        tabindex: isFocused ? '0' : '-1',
      };
      if (isDisabled) {
        attrs.disabled = true;
        attrs['aria-label'] = MONTHS_LONG[parts.m - 1] + ' ' + parts.d + ', ' + parts.y + ', unavailable';
      } else {
        attrs['aria-label'] = WEEKDAYS_LONG[dow] + ', ' + MONTHS_LONG[parts.m - 1] + ' ' + parts.d + ', ' + parts.y;
        if (isSelected) attrs['aria-selected'] = 'true';
      }
      attrs.text = String(parts.d);

      var btn = el('button', attrs);
      grid.appendChild(btn);
    }

    // After rendering, scroll the focused cell into view if the grid
    // overflows (small dialog on mobile). Skip when reduced-motion is
    // on (per AC-9) — smooth scroll is a motion effect.
    var focused = grid.querySelector('.date-picker-day--focused');
    if (focused && typeof focused.scrollIntoView === 'function' && !reducedMotionOn()) {
      try { focused.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }); }
      catch (_) { try { focused.scrollIntoView(); } catch (__) {} }
    }
  }

  // Render the 12-month grid for state.view.y. Click a month to drill
  // back down to the day grid. Disabled months are outside min/max.
  function _renderMonths(state) {
    var dlg = state.dlg;
    if (!dlg) return;
    var grid = dlg.grid;
    clearChildren(grid);
    // Switch to a 4-column grid (the days mode uses 7). The class
    // also hides the weekday strip via the .date-picker-dialog--month-
    // year-mode selector in CSS.
    grid.classList.add('date-picker-grid--narrow');
    if (dlg.dlg && dlg.dlg.classList) dlg.dlg.classList.add('date-picker-dialog--month-year-mode');

    var minIso = state.minIso || null;
    var maxIso = state.maxIso || null;
    var y = state.view.y;

    // Header — show only the year.
    dlg.monthLabel.textContent = '';
    dlg.yearLabel.textContent  = String(y);
    dlg.gridLabel.textContent  = String(y);

    var focusMonth = state.view.m;
    state.view.m = focusMonth;

    for (var m = 1; m <= 12; m += 1) {
      var isFocused = (m === focusMonth);
      var minY = minIso ? parseInt(minIso.slice(0, 4), 10) : null;
      var maxY = maxIso ? parseInt(maxIso.slice(0, 4), 10) : null;
      var isDisabled = (minY != null && y < minY) || (maxY != null && y > maxY) ||
                       (minY != null && y === minY && m < parseInt(minIso.slice(5, 7), 10)) ||
                       (maxY != null && y === maxY && m > parseInt(maxIso.slice(5, 7), 10));
      var classes = ['date-picker-month'];
      if (isFocused) classes.push('date-picker-month--focused');

      var attrs = {
        type: 'button',
        role: 'gridcell',
        class: classes.join(' '),
        dataset: { month: String(m) },
        tabindex: isFocused ? '0' : '-1',
        'aria-label': MONTHS_LONG[m - 1] + ' ' + y,
      };
      if (isDisabled) {
        attrs.disabled = true;
        attrs['aria-label'] = MONTHS_LONG[m - 1] + ' ' + y + ', unavailable';
      }
      attrs.text = MONTHS_SHORT[m - 1];
      grid.appendChild(el('button', attrs));
    }
  }

  // Render the 12-year grid (3 rows × 4 cols) for the current decade.
  // The decade is state.view.y - (state.view.y % 10). Click a year to
  // drill into the months view for that year.
  function _renderYears(state) {
    var dlg = state.dlg;
    if (!dlg) return;
    var grid = dlg.grid;
    clearChildren(grid);
    grid.classList.add('date-picker-grid--narrow');
    if (dlg.dlg && dlg.dlg.classList) dlg.dlg.classList.add('date-picker-dialog--month-year-mode');

    var minIso = state.minIso || null;
    var maxIso = state.maxIso || null;
    var focusYear = state.view.y;
    var decadeStart = focusYear - (focusYear % 10);

    // Header — show the decade range.
    dlg.monthLabel.textContent = '';
    dlg.yearLabel.textContent  = decadeStart + ' – ' + (decadeStart + 9);
    dlg.gridLabel.textContent  = decadeStart + ' – ' + (decadeStart + 9);

    for (var i = 0; i < 12; i += 1) {
      var y = decadeStart + i;
      var isFocused = (y === focusYear);
      var minY = minIso ? parseInt(minIso.slice(0, 4), 10) : null;
      var maxY = maxIso ? parseInt(maxIso.slice(0, 4), 10) : null;
      var isDisabled = (minY != null && y < minY) || (maxY != null && y > maxY);
      var classes = ['date-picker-year'];
      if (isFocused) classes.push('date-picker-year--focused');

      var attrs = {
        type: 'button',
        role: 'gridcell',
        class: classes.join(' '),
        dataset: { year: String(y) },
        tabindex: isFocused ? '0' : '-1',
        'aria-label': String(y),
      };
      if (isDisabled) {
        attrs.disabled = true;
        attrs['aria-label'] = y + ', unavailable';
      }
      attrs.text = String(y);
      grid.appendChild(el('button', attrs));
    }
  }

  /* ----- Keyboard nav (Section G) -----
     Roving focus on the grid. Arrow keys move 1 day (with row-wrap
     for left/right). PgUp/PgDn shifts month. Shift+PgUp/PgDn shifts
     year. Home/End jumps to week start/end. T jumps to today. Enter
     and Space select. Esc handled by <dialog> natively (cancel event).
  */

  function _moveFocus(state, deltaDays) {
    var next = clampToBounds(
      shiftISO(state.focusedIso, deltaDays),
      state.minIso,
      state.maxIso
    );
    if (!next) return;
    if (!sameMonth(next, state.view)) {
      state.view = addMonths(state.view, next < state.focusedIso ? -1 : 1);
    }
    state.focusedIso = next;
    _renderGrid(state);
    _focusFocusedCell(state);
  }

  function _focusFocusedCell(state) {
    var grid = state.dlg.grid;
    var selector = state.mode === 'months' ? '.date-picker-month--focused'
                  : state.mode === 'years'  ? '.date-picker-year--focused'
                  : '.date-picker-day--focused';
    var focused = grid.querySelector(selector);
    if (focused && typeof focused.focus === 'function') {
      try { focused.focus(); } catch (_) {}
    }
  }

  function _wireGridKeyboard(state) {
    // Keydown is delegated on the dialog (capture-phase) so it works
    // even if a cell doesn't have focus initially. We route by event
    // target to the active state.
    //
    // Story 9.19.5 (inlined into 9.19.1 hotfix 4): keyboard behavior
    // adapts to the active mode. In days mode, arrows move by day and
    // PgUp/PgDn navigate months. In months mode, arrows move by month
    // (3 across the 4-col grid) and PgUp/PgDn navigate years. In years
    // mode, arrows move by year (3 across the 4-col grid) and PgUp/PgDn
    // navigate decades. Enter/Space drill down or commit.
    function onKey(e) {
      if (!state.isOpen) return;
      var key = e.key;

      // Mode-aware arrow keys.
      if (state.mode === 'months') {
        if (key === 'ArrowLeft')   { e.preventDefault(); _moveMonthFocus(state, -1); }
        else if (key === 'ArrowRight')  { e.preventDefault(); _moveMonthFocus(state, 1); }
        else if (key === 'ArrowUp')     { e.preventDefault(); _moveMonthFocus(state, -4); }
        else if (key === 'ArrowDown')   { e.preventDefault(); _moveMonthFocus(state, 4); }
        else if (key === 'PageUp')  { e.preventDefault(); state.view.y -= 1; _renderGrid(state); _focusFocusedCell(state); }
        else if (key === 'PageDown'){ e.preventDefault(); state.view.y += 1; _renderGrid(state); _focusFocusedCell(state); }
        else if (key === 'Home')    { e.preventDefault(); state.view.m = 1; _renderGrid(state); _focusFocusedCell(state); }
        else if (key === 'End')     { e.preventDefault(); state.view.m = 12; _renderGrid(state); _focusFocusedCell(state); }
        else if (key === 'Enter' || key === ' ') {
          e.preventDefault();
          // Drill into days mode for the current month.
          state.mode = 'days';
          _renderGrid(state); _focusFocusedCell(state);
        }
        return;
      }
      if (state.mode === 'years') {
        if (key === 'ArrowLeft')   { e.preventDefault(); _moveYearFocus(state, -1); }
        else if (key === 'ArrowRight')  { e.preventDefault(); _moveYearFocus(state, 1); }
        else if (key === 'ArrowUp')     { e.preventDefault(); _moveYearFocus(state, -4); }
        else if (key === 'ArrowDown')   { e.preventDefault(); _moveYearFocus(state, 4); }
        else if (key === 'PageUp')  { e.preventDefault(); state.view.y -= 10; _renderGrid(state); _focusFocusedCell(state); }
        else if (key === 'PageDown'){ e.preventDefault(); state.view.y += 10; _renderGrid(state); _focusFocusedCell(state); }
        else if (key === 'Home')    { e.preventDefault(); state.view.y = state.view.y - (state.view.y % 10); _renderGrid(state); _focusFocusedCell(state); }
        else if (key === 'End')     { e.preventDefault(); state.view.y = state.view.y - (state.view.y % 10) + 9; _renderGrid(state); _focusFocusedCell(state); }
        else if (key === 'Enter' || key === ' ') {
          e.preventDefault();
          // Drill into months mode for the current year.
          state.mode = 'months';
          _renderGrid(state); _focusFocusedCell(state);
        }
        return;
      }

      // days mode (default)
      if (key === 'ArrowLeft')  { e.preventDefault(); _moveFocus(state, -1); }
      else if (key === 'ArrowRight') { e.preventDefault(); _moveFocus(state, 1); }
      else if (key === 'ArrowUp')    { e.preventDefault(); _moveFocus(state, -7); }
      else if (key === 'ArrowDown')  { e.preventDefault(); _moveFocus(state, 7); }
      else if (key === 'PageUp') {
        e.preventDefault();
        state.view = addMonths(state.view, e.shiftKey ? -12 : -1);
        _renderGrid(state); _focusFocusedCell(state);
      }
      else if (key === 'PageDown') {
        e.preventDefault();
        state.view = addMonths(state.view, e.shiftKey ? 12 : 1);
        _renderGrid(state); _focusFocusedCell(state);
      }
      else if (key === 'Home') {
        e.preventDefault();
        var parts = parseISO(state.focusedIso);
        if (parts) {
          var d = new Date(parts.y, parts.m - 1, parts.d);
          d.setDate(d.getDate() - d.getDay());
          var iso = toISO({ y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() });
          state.focusedIso = clampToBounds(iso, state.minIso, state.maxIso) || state.focusedIso;
          if (!sameMonth(state.focusedIso, state.view)) {
            state.view = addMonths(state.view, state.focusedIso < toISO({y:parts.y,m:parts.m,d:1}) ? -1 : 1);
          }
          _renderGrid(state); _focusFocusedCell(state);
        }
      }
      else if (key === 'End') {
        e.preventDefault();
        var parts2 = parseISO(state.focusedIso);
        if (parts2) {
          var d2 = new Date(parts2.y, parts2.m - 1, parts2.d);
          d2.setDate(d2.getDate() + (6 - d2.getDay()));
          var iso2 = toISO({ y: d2.getFullYear(), m: d2.getMonth() + 1, d: d2.getDate() });
          state.focusedIso = clampToBounds(iso2, state.minIso, state.maxIso) || state.focusedIso;
          if (!sameMonth(state.focusedIso, state.view)) {
            state.view = addMonths(state.view, state.focusedIso < toISO({y:parts2.y,m:parts2.m,d:1}) ? -1 : 1);
          }
          _renderGrid(state); _focusFocusedCell(state);
        }
      }
      else if (key === 't' || key === 'T') {
        e.preventDefault();
        var today = isoToday();
        state.focusedIso = clampToBounds(today, state.minIso, state.maxIso) || state.focusedIso;
        if (!sameMonth(state.focusedIso, state.view)) {
          var tp = parseISO(state.focusedIso);
          state.view = { y: tp.y, m: tp.m };
        }
        _renderGrid(state); _focusFocusedCell(state);
      }
      else if (key === 'Enter' || key === ' ') {
        if (state.focusedIso) {
          e.preventDefault();
          _commitSelection(state, state.focusedIso);
        }
      }
    }
    state._keydownHandler = onKey;
    state.dlg.dlg.addEventListener('keydown', onKey, true);
  }

  // Move the focused month in months mode. Wraps Jan ↔ Dec.
  function _moveMonthFocus(state, delta) {
    var m = state.view.m + delta;
    while (m < 1)  { m += 12; state.view.y -= 1; }
    while (m > 12) { m -= 12; state.view.y += 1; }
    state.view.m = m;
    _renderGrid(state);
    _focusFocusedCell(state);
  }

  // Move the focused year in years mode. Clamps to the current
  // decade; PgUp/PgDn changes the decade.
  function _moveYearFocus(state, delta) {
    state.view.y = state.view.y + delta;
    _renderGrid(state);
    _focusFocusedCell(state);
  }

  /* ----- Open / close / click-outside (Section H + I) -----
     On open: capture sourceEl (input), read min/max/value, set view
     to the value's month (or today), render grid, position dialog,
     showModal(), focus focused cell.
     On close: close dialog, restore focus to sourceEl (or fallback).
     Click-outside via capture-phase mousedown listener on document
     (mirror help-overlay.js:539-551). Esc handled natively by
     <dialog> via the `cancel` event.
  */

  function _commitSelection(state, iso) {
    if (!iso) return;
    var input = state.input;
    if (!input) return;
    if (input.value !== iso) {
      input.value = iso;
      try {
        input.dispatchEvent(new Event('input',  { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (_) {}
    }
    state.selected = iso;
    state.focusedIso = iso;
    if (typeof state.opts.onSelect === 'function') {
      try { state.opts.onSelect(iso); } catch (_) {}
    }
    _closeDialog(state);
  }

  function _positionDialog(state) {
    if (typeof window === 'undefined') return;
    var dlg = state.dlg.dlg;
    if (!dlg || !dlg.showModal) return;
    var rect = (state.input && typeof state.input.getBoundingClientRect === 'function')
      ? state.input.getBoundingClientRect()
      : { top: window.innerHeight / 2, left: window.innerWidth / 2, bottom: 0, right: 0 };

    // Anchor to the input. Clamp to viewport (AC-10: no overflow).
    var top = (rect.bottom || 0) + 4;
    var left = rect.left || 0;
    var vw = window.innerWidth || 1024;
    var vh = window.innerHeight || 768;
    var w = 280; // matches CSS min-width
    var h = 320; // rough estimate; CSS clamps height
    if (left + w > vw - 8) left = Math.max(8, vw - w - 8);
    if (top + h > vh - 8)  top = Math.max(8, (rect.top || 0) - h - 4);
    dlg.style.top  = top + 'px';
    dlg.style.left = left + 'px';
  }

  function _openDialog(state) {
    if (!state.dlg || !state.dlg.dlg || typeof state.dlg.dlg.showModal !== 'function') {
      // Native <dialog> unavailable — fail soft (AC-3: native fallback).
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('datePicker: <dialog>.showModal unavailable; picker disabled');
      }
      return;
    }
    // Story 9.19.5 — always reset to days mode when (re)opening.
    state.mode = 'days';
    state.sourceEl = (typeof document !== 'undefined' && document.activeElement) || state.input;
    // Read min/max/value from input. ISO source of truth.
    state.minIso = parseISO(state.input.getAttribute('min')) ? state.input.getAttribute('min') : null;
    state.maxIso = parseISO(state.input.getAttribute('max')) ? state.input.getAttribute('max') : null;
    var valParts = parseISO(state.input.value || '');
    if (valParts) {
      state.selected = state.input.value;
      state.view = { y: valParts.y, m: valParts.m };
      state.focusedIso = state.input.value;
    } else {
      state.selected = null;
      var today = isoToday();
      var tParts = parseISO(today);
      state.view = { y: tParts.y, m: tParts.m };
      state.focusedIso = today;
    }
    _renderGrid(state);
    _positionDialog(state);
    try { state.dlg.dlg.showModal(); } catch (_) {}
    state.isOpen = true;
    // Focus the focused cell after the dialog has rendered.
    setTimeout(function () { _focusFocusedCell(state); }, 0);
  }

  function _closeDialog(state) {
    if (!state.dlg || !state.dlg.dlg) return;
    try {
      if (typeof state.dlg.dlg.close === 'function' && state.dlg.dlg.open) {
        state.dlg.dlg.close();
      }
    } catch (_) {}
    state.isOpen = false;
    // Story 9.19.1 hotfix 5 — _closeDialog calls restore.focus() on
    // the source input. That synchronously fires a `focus` event on
    // the input, which would otherwise trigger the input's focus
    // handler and re-open the picker. Set the suppress flag so the
    // next openForType() call from that focus event no-ops.
    state._suppressOpen = true;
    // Restore focus to sourceEl (or main[tabindex="-1"] fallback,
    // mirror share.js:323-336 + help-overlay.js:469-484).
    var restore = state.sourceEl;
    if (!restore || (typeof document !== 'undefined' && restore === document.body)) {
      if (typeof document !== 'undefined') {
        var main = document.querySelector('main');
        if (main) restore = main;
      }
    }
    if (restore && typeof restore.focus === 'function') {
      try { restore.focus(); } catch (_) {}
    }
  }

  function _wireDialogHandlers(d) {
    if (!d || d._wired) return;
    d._wired = true;

    // Esc → close (native <dialog> cancel).
    d.dlg.addEventListener('cancel', function () {
      var st = _activeState();
      if (st) _closeDialog(st);
    });

    // Story 9.19.1 hotfix 5 — backup close when the dialog itself
    // is clicked (e.g., on the dialog's padding between the form and
    // the dialog border). The document-level mousedown/click handler
    // already handles backdrop clicks, but in some browsers (Safari,
    // older Firefox), `mousedown` on the dialog padding doesn't fire
    // on the dialog element — only `click` does. Listening on the
    // dialog itself closes that gap. e.target === dlg means the user
    // clicked the dialog but NOT any descendant (e.g., the form, the
    // header, the grid, a button). That's the "padding" area — close.
    d.dlg.addEventListener('click', function (e) {
      if (e.target === d.dlg) {
        var st = _activeState();
        if (st) _closeDialog(st);
      }
    });

    // Click on a grid cell — dispatch by mode (Story 9.19.5, inlined
    // into 9.19.1 hotfix 4). Days mode commits; months/years drill
    // down to the next mode.
    d.grid.addEventListener('click', function (e) {
      var st = _activeState();
      if (!st) return;
      var target = e.target;
      if (!target || typeof target.closest !== 'function') return;
      if (st.mode === 'months') {
        var mcell = target.closest('.date-picker-month');
        if (!mcell || mcell.disabled) return;
        var m = parseInt(mcell.getAttribute('data-month'), 10);
        if (!isFinite(m)) return;
        st.view.m = m;
        st.mode = 'days';
        _renderGrid(st);
        _focusFocusedCell(st);
        return;
      }
      if (st.mode === 'years') {
        var ycell = target.closest('.date-picker-year');
        if (!ycell || ycell.disabled) return;
        var y = parseInt(ycell.getAttribute('data-year'), 10);
        if (!isFinite(y)) return;
        st.view.y = y;
        st.mode = 'months';
        _renderGrid(st);
        _focusFocusedCell(st);
        return;
      }
      // days mode (default)
      var cell = target.closest('.date-picker-day');
      if (!cell || cell.disabled) return;
      var iso = cell.getAttribute('data-date');
      if (iso) {
        _commitSelection(st, iso);
      }
    });

    // Prev / Next — navigate by month/year/decade depending on mode.
    d.prevBtn.addEventListener('click', function () {
      var st = _activeState();
      if (!st) return;
      if (st.mode === 'years') {
        st.view.y = st.view.y - 10;
      } else if (st.mode === 'months') {
        st.view.y = st.view.y - 1;
      } else {
        st.view = addMonths(st.view, -1);
      }
      _renderGrid(st); _focusFocusedCell(st);
    });
    d.nextBtn.addEventListener('click', function () {
      var st = _activeState();
      if (!st) return;
      if (st.mode === 'years') {
        st.view.y = st.view.y + 10;
      } else if (st.mode === 'months') {
        st.view.y = st.view.y + 1;
      } else {
        st.view = addMonths(st.view, 1);
      }
      _renderGrid(st); _focusFocusedCell(st);
    });

    // Title button — drill UP one mode: days → months → years → days.
    d.titleBtn.addEventListener('click', function () {
      var st = _activeState();
      if (!st) return;
      if (st.mode === 'days') st.mode = 'months';
      else if (st.mode === 'months') st.mode = 'years';
      else st.mode = 'days';
      _renderGrid(st);
      _focusFocusedCell(st);
    });

    // Today / Clear.
    d.todayBtn.addEventListener('click', function () {
      var st = _activeState();
      if (!st) return;
      var today = isoToday();
      st.focusedIso = clampToBounds(today, st.minIso, st.maxIso) || today;
      var tp = parseISO(st.focusedIso);
      if (tp) st.view = { y: tp.y, m: tp.m };
      st.mode = 'days';
      _renderGrid(st); _focusFocusedCell(st);
    });
    d.clearBtn.addEventListener('click', function () {
      var st = _activeState();
      if (!st || !st.input) return;
      if (st.input.value !== '') {
        st.input.value = '';
        try {
          st.input.dispatchEvent(new Event('input',  { bubbles: true }));
          st.input.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (_) {}
      }
      st.selected = null;
      _closeDialog(st);
    });
  }

  // Find the open state (used by click handlers — only one dialog is
  // open at a time).
  function _activeState() {
    for (var i = 0; i < INSTANCES.length; i += 1) {
      if (INSTANCES[i].isOpen) return INSTANCES[i];
    }
    return null;
  }

  /* ===== Time picker (Story 9.19.1) =====
     Reuses INSTANCES registry, _commitSelection, _closeDialog,
     _wireClickOutside, _wireInputListeners, _positionDialog from
     the date variant above. Builds its own <dialog> shell + grid
     + keyboard + click handlers.

     Two-column layout: 24 hour cells on the left, 12 minute cells
     (5-min granularity) on the right. Arrow keys fine-tune by 1
     minute; Shift+arrow jumps 5 minutes; ↑/↓ move the hour;
     PgUp/PgDn move 12 hours; T = Now; Home/End jump to start/end
     of the selected hour. Enter/Space commit. Esc cancels via the
     native <dialog> cancel event (handler in _wireTimeDialogHandlers).
  */

  function _buildTimeDialogShell() {
    var title = el('span', {
      class: 'time-picker-title',
      'aria-live': 'polite',
      text: '--:--',
    });
    var header = el('header', {
      class: 'date-picker-header time-picker-header',
    }, [title]);

    var hourLabel = el('span', {
      id: 'time-picker-grid-label',
      class: 'date-picker-sr-only',
      text: 'Hour',
    });
    var hourCol = el('div', {
      role: 'grid',
      class: 'time-picker-hour-col',
      'aria-labelledby': 'time-picker-grid-label',
    }, [hourLabel]);

    var minuteLabel = el('span', {
      id: 'time-picker-minute-label',
      class: 'date-picker-sr-only',
      text: 'Minute',
    });
    var minuteCol = el('div', {
      role: 'grid',
      class: 'time-picker-minute-col',
      'aria-labelledby': 'time-picker-minute-label',
    }, [minuteLabel]);

    var gridWrap = el('div', {
      class: 'time-picker-grid-wrap',
    }, [hourCol, minuteCol]);

    var nowBtn = el('button', {
      type: 'button',
      class: 'time-picker-now',
      dataset: { action: 'now' },
      text: 'Now',
    });
    var clearBtn = el('button', {
      type: 'button',
      class: 'date-picker-clear',
      dataset: { action: 'clear' },
      text: 'Clear',
    });

    var dlg = el('dialog', {
      class: 'date-picker-dialog time-picker-dialog',
      'aria-label': 'Choose time',
    }, [
      el('form', { method: 'dialog', class: 'date-picker-form' }, [
        header,
        gridWrap,
        el('footer', { class: 'date-picker-footer' }, [nowBtn, clearBtn]),
      ]),
    ]);

    return {
      dlg: dlg,
      title: title,
      hourCol: hourCol,
      minuteCol: minuteCol,
      nowBtn: nowBtn,
      clearBtn: clearBtn,
      _wired: false,
      _clickOutsideWired: false,
    };
  }

  function _ensureTimeDialog() {
    if (_dlgTime) return _dlgTime;
    if (typeof document === 'undefined' || !document.body) return null;
    // Story 9.19.1: time picker styles live in their own CSS chunk
    // (chrome-time-picker.css) — page-conditional, loaded alongside
    // date-picker.js on first <input type="time"> enhance. Keeping
    // it separate from chrome-date-picker.css keeps LAZY_CSS_MODULES
    // under the 12,000-byte budget. Both are co-loaded via the same
    // TIER2_CSS.datePicker entry in shell-thin.js (date-picker Proxy
    // factory loads chrome-date-picker.css; we lazy-load the time
    // chunk from here).
    if (HT && typeof HT.lazyLoadCss === 'function') {
      try {
        // Path is repo-root-relative. resolveUrl() (defined at module
        // top) walks back from this script's URL to the repo root so
        // the CSS chunk is reachable from any tool page (e.g., tools/
        // age-calculator/index.html). Falls back to window.location
        // if document.currentScript is unavailable.
        HT.lazyLoadCss(resolveUrl('assets/css/chrome-time-picker.css'));
      } catch (_) {}
    }
    _dlgTime = _buildTimeDialogShell();
    document.body.appendChild(_dlgTime.dlg);
    _wireTimeDialogHandlers(_dlgTime);
    return _dlgTime;
  }

  function _renderTimeGrid(state) {
    var dlg = state.dlg;
    if (!dlg) return;
    var hourCol = dlg.hourCol;
    var minuteCol = dlg.minuteCol;
    clearChildren(hourCol);
    clearChildren(minuteCol);

    // Title: render the selected HH:MM (live).
    var cur = state.selected || toTime({ h: state.selectedHour, m: state.selectedMinute });
    dlg.title.textContent = cur;

    // Hour column — 24 cells.
    for (var i = 0; i < HOURS.length; i += 1) {
      var h = HOURS[i];
      var isHourSelected = (h === state.selectedHour);
      var isHourFocused = (state.focusedUnit === 'hour' && h === state.selectedHour && !state.selected);
      var classes = ['time-picker-cell', 'time-picker-cell--hour'];
      if (isHourSelected) classes.push('time-picker-cell--selected');
      if (isHourFocused)  classes.push('time-picker-cell--focused');
      var attrs = {
        type: 'button',
        role: 'gridcell',
        class: classes.join(' '),
        dataset: { hour: String(h) },
        tabindex: isHourFocused ? '0' : '-1',
        'aria-label': h + ':00',
      };
      if (isHourSelected) attrs['aria-selected'] = 'true';
      attrs.text = h < 10 ? '0' + h : String(h);
      hourCol.appendChild(el('button', attrs));
    }

    // Minute column — 12 cells (5-min granularity).
    for (var j = 0; j < MINUTES_5.length; j += 1) {
      var mn = MINUTES_5[j];
      var isMinuteSelected = (mn === state.selectedMinute);
      var isMinuteFocused = (state.focusedUnit === 'minute' && mn === state.selectedMinute && !state.selected);
      var classes2 = ['time-picker-cell', 'time-picker-cell--minute'];
      if (isMinuteSelected) classes2.push('time-picker-cell--selected');
      if (isMinuteFocused)  classes2.push('time-picker-cell--focused');
      var attrs2 = {
        type: 'button',
        role: 'gridcell',
        class: classes2.join(' '),
        dataset: { minute: String(mn) },
        tabindex: isMinuteFocused ? '0' : '-1',
        'aria-label': 'Minute ' + (mn < 10 ? '0' + mn : mn),
      };
      if (isMinuteSelected) attrs2['aria-selected'] = 'true';
      attrs2.text = ':' + (mn < 10 ? '0' + mn : mn);
      minuteCol.appendChild(el('button', attrs2));
    }

    // Scroll the focused cell into view (skip when reduced-motion is on).
    var focused = (state.focusedUnit === 'minute' ? minuteCol : hourCol).querySelector('.time-picker-cell--focused');
    if (focused && typeof focused.scrollIntoView === 'function' && !reducedMotionOn()) {
      try { focused.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }); }
      catch (_) { try { focused.scrollIntoView(); } catch (__) {} }
    }
  }

  // Move hour or minute. (unit, delta) — delta is the count of units
  // to shift. ±1 = fine-tune (1 minute or 1 hour); ±5 = Shift+arrow
  // (5 minutes); ±6 hours = Shift+arrow on the hour column.
  function _moveTimeFocus(state, unit, delta) {
    if (unit === 'hour') {
      var newHour = ((state.selectedHour + delta) % 24 + 24) % 24;
      state.selectedHour = newHour;
    } else {
      var newMin = ((state.selectedMinute + delta) % 60 + 60) % 60;
      state.selectedMinute = newMin;
    }
    state.selected = toTime({ h: state.selectedHour, m: state.selectedMinute });
    state.focusedUnit = unit;
    _renderTimeGrid(state);
    _focusTimeCell(state);
  }

  function _focusTimeCell(state) {
    var dlg = state.dlg;
    if (!dlg) return;
    var col = (state.focusedUnit === 'minute') ? dlg.minuteCol : dlg.hourCol;
    var focused = col.querySelector('.time-picker-cell--focused');
    if (focused && typeof focused.focus === 'function') {
      try { focused.focus(); } catch (_) {}
    }
  }

  function _wireTimeKeyboard(state) {
    function onKey(e) {
      if (!state.isOpen) return;
      var key = e.key;
      // Switch columns: Tab = forward, Shift+Tab = backward.
      // Only intercept Tab when focus is on hour/minute buttons so other
      // focusable elements (close, etc.) can still receive Tab.
      if (key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        var t = e.target;
        var onTimeBtn = t && t.classList && (
          t.classList.contains('time-picker-hour') ||
          t.classList.contains('time-picker-minute')
        );
        if (onTimeBtn) {
          e.preventDefault();
          state.focusedUnit = e.shiftKey
            ? (state.focusedUnit === 'minute' ? 'hour' : 'minute')
            : (state.focusedUnit === 'hour' ? 'minute' : 'hour');
          _renderTimeGrid(state);
          _focusTimeCell(state);
        }
        return;
      }
      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        e.preventDefault();
        var stepMin = e.shiftKey ? 5 : 1;
        // Left on hour column = minute -1 (fine-tune); right = +1.
        _moveTimeFocus(state, 'minute', key === 'ArrowLeft' ? -stepMin : stepMin);
      }
      else if (key === 'ArrowUp' || key === 'ArrowDown') {
        e.preventDefault();
        var stepHr = e.shiftKey ? 6 : 1;
        _moveTimeFocus(state, 'hour', key === 'ArrowUp' ? stepHr : -stepHr);
      }
      else if (key === 'PageUp' || key === 'PageDown') {
        e.preventDefault();
        _moveTimeFocus(state, 'hour', key === 'PageUp' ? 12 : -12);
      }
      else if (key === 'Home') {
        e.preventDefault();
        state.selectedMinute = 0;
        state.focusedUnit = 'minute';
        state.selected = toTime({ h: state.selectedHour, m: 0 });
        _renderTimeGrid(state); _focusTimeCell(state);
      }
      else if (key === 'End') {
        e.preventDefault();
        state.selectedMinute = 55;
        state.focusedUnit = 'minute';
        state.selected = toTime({ h: state.selectedHour, m: 55 });
        _renderTimeGrid(state); _focusTimeCell(state);
      }
      else if (key === 't' || key === 'T') {
        e.preventDefault();
        var now = timeNow();
        var parts = parseTime(now);
        if (parts) {
          state.selectedHour = parts.h;
          state.selectedMinute = parts.m;
          state.selected = now;
          state.focusedUnit = 'minute';
          _renderTimeGrid(state); _focusTimeCell(state);
        }
      }
      else if (key === 'Enter' || key === ' ') {
        if (state.selected) {
          e.preventDefault();
          _commitSelection(state, state.selected);
        }
      }
    }
    state._keydownHandler = onKey;
    state.dlg.dlg.addEventListener('keydown', onKey, true);
  }

  function _wireTimeDialogHandlers(d) {
    if (!d || d._wired) return;
    d._wired = true;

    // Esc → close (native <dialog> cancel).
    d.dlg.addEventListener('cancel', function () {
      var st = _activeState();
      if (st) _closeDialog(st);
    });

    // Story 9.19.1 hotfix 5 — backup close when the dialog itself
    // is clicked (e.g., on the dialog's padding between the form and
    // the dialog border). The document-level mousedown/click handler
    // already handles backdrop clicks, but in some browsers (Safari,
    // older Firefox), `mousedown` on the dialog padding doesn't fire
    // on the dialog element — only `click` does. Listening on the
    // dialog itself closes that gap. e.target === dlg means the user
    // clicked the dialog but NOT any descendant (e.g., the form, the
    // header, the grid, a button). That's the "padding" area — close.
    d.dlg.addEventListener('click', function (e) {
      if (e.target === d.dlg) {
        var st = _activeState();
        if (st) _closeDialog(st);
      }
    });

    // Click on an hour cell.
    d.hourCol.addEventListener('click', function (e) {
      var st = _activeState();
      if (!st || st.type !== 'time') return;
      var target = e.target;
      if (!target || typeof target.closest !== 'function') return;
      var cell = target.closest('.time-picker-cell--hour');
      if (!cell) return;
      var h = parseInt(cell.getAttribute('data-hour'), 10);
      if (!isFinite(h)) return;
      st.selectedHour = h;
      st.selected = toTime({ h: st.selectedHour, m: st.selectedMinute });
      st.focusedUnit = 'hour';
      _renderTimeGrid(st);
      _focusTimeCell(st);
    });

    // Click on a minute cell.
    d.minuteCol.addEventListener('click', function (e) {
      var st = _activeState();
      if (!st || st.type !== 'time') return;
      var target = e.target;
      if (!target || typeof target.closest !== 'function') return;
      var cell = target.closest('.time-picker-cell--minute');
      if (!cell) return;
      var mn = parseInt(cell.getAttribute('data-minute'), 10);
      if (!isFinite(mn)) return;
      st.selectedMinute = mn;
      st.selected = toTime({ h: st.selectedHour, m: st.selectedMinute });
      st.focusedUnit = 'minute';
      _renderTimeGrid(st);
      _focusTimeCell(st);
    });

    // Now button.
    d.nowBtn.addEventListener('click', function () {
      var st = _activeState();
      if (!st || st.type !== 'time') return;
      var now = timeNow();
      var parts = parseTime(now);
      if (!parts) return;
      st.selectedHour = parts.h;
      st.selectedMinute = parts.m;
      st.selected = now;
      st.focusedUnit = 'minute';
      _renderTimeGrid(st);
      _focusTimeCell(st);
    });

    // Clear button.
    d.clearBtn.addEventListener('click', function () {
      var st = _activeState();
      if (!st || !st.input) return;
      if (st.input.value !== '') {
        st.input.value = '';
        try {
          st.input.dispatchEvent(new Event('input',  { bubbles: true }));
          st.input.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (_) {}
      }
      st.selected = null;
      _closeDialog(st);
    });
  }

  function _openTimeDialog(state) {
    if (!state.dlg || !state.dlg.dlg || typeof state.dlg.dlg.showModal !== 'function') {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('datePicker: <dialog>.showModal unavailable; time picker disabled');
      }
      return;
    }
    state.sourceEl = (typeof document !== 'undefined' && document.activeElement) || state.input;
    // Read min/max/value. HH:MM is the wire format for <input type="time">.
    state.minTime = parseTime(state.input.getAttribute('min')) ? state.input.getAttribute('min') : null;
    state.maxTime = parseTime(state.input.getAttribute('max')) ? state.input.getAttribute('max') : null;
    var valParts = parseTime(state.input.value || '');
    if (valParts) {
      state.selected = state.input.value;
      state.selectedHour = valParts.h;
      // Snap to nearest 5-minute grid so the focused cell is real.
      var snapped = Math.round(valParts.m / 5) * 5;
      if (snapped >= 60) snapped = 55;
      state.selectedMinute = snapped;
      state.focusedUnit = 'hour';
    } else {
      state.selected = null;
      var now = timeNow();
      var np = parseTime(now);
      state.selectedHour = np.h;
      state.selectedMinute = np.m;
      state.focusedUnit = 'minute';
    }
    _renderTimeGrid(state);
    _positionDialog(state);
    try { state.dlg.dlg.showModal(); } catch (_) {}
    state.isOpen = true;
    setTimeout(function () { _focusTimeCell(state); }, 0);
  }

  function _enhanceTime(inputEl, opts) {
    if (typeof document === 'undefined') {
      throw new Error('datePicker.enhance: no document');
    }
    var state = {
      _id: nextHandleId(),
      type: 'time',
      input: inputEl,
      opts: opts || {},
      dlg: _ensureTimeDialog(),
      sourceEl: null,
      selected: null,
      selectedHour: 12,
      selectedMinute: 0,
      focusedUnit: 'hour',
      isOpen: false,
      minTime: null,
      maxTime: null,
      _keydownHandler: null,
      _focusHandler: null,
      _clickHandler: null,
    };
    INSTANCES.push(state);
    _wireTimeKeyboard(state);
    _wireInputListeners(state);
    _wireClickOutside();
    return {
      _id: state._id,
      _state: state,
      open: function () { return openById(state._id); },
      close: function () { return closeById(state._id); },
      destroy: function () { return destroyById(state._id); },
      isOpen: function () { return isOpenById(state._id); },
    };
  }

  /* ===== Date-time picker (Story 9.19.1) =====
     Tab strip dialog with two panes: Date (default) and Time. Reuses
     all date math (parseISO/toISO/etc.) and time math (parseTime/
     toTime/etc.). Commit happens on Enter (composes YYYY-MM-DDTHH:MM)
     or on Time-pane cell click + OK. The composed value is written to
     input.value and input/change events fire — wire format matches
     <input type="datetime-local">.

     Architecture: a third shared dialog _dlgDateTime owns both panes.
     Each enhanced datetime-local input pushes a state with
     type='datetime-local'. State holds selectedIso (from date pane),
     selectedHour + selectedMinute (from time pane), and a `tab` field.
     _renderDateTimeGrid renders whichever pane is active. Both panes
     reuse their respective time/date renderer where possible.

     Scope v1: minimal but functional. The commit happens on Enter
     (in either pane) OR via the explicit OK button on the time pane.
     The date pane keeps the existing date variant's grid semantics.
  */

  function _buildDateTimeDialogShell() {
    // Date pane (header + weekdays + grid) — built fresh; the date
    // variant's helpers handle rendering against state.view.
    var prevBtn = el('button', {
      type: 'button',
      class: 'date-picker-nav date-picker-prev-month',
      'aria-label': 'Previous month',
      text: '\u2039',
    });
    var nextBtn = el('button', {
      type: 'button',
      class: 'date-picker-nav date-picker-next-month',
      'aria-label': 'Next month',
      text: '\u203A',
    });
    var monthLabel = el('span', { class: 'date-picker-month-label', text: 'January' });
    var yearLabel  = el('span', { class: 'date-picker-year-label',  text: '2026' });
    var titleBtn = el('button', {
      type: 'button',
      class: 'date-picker-title',
      'aria-haspopup': 'true',
    }, [monthLabel, yearLabel]);
    var gridLabel = el('span', {
      id: 'date-time-picker-grid-label',
      class: 'date-picker-sr-only',
      text: 'January 2026',
    });
    var dateGrid = el('div', {
      role: 'grid',
      class: 'date-picker-grid',
      'aria-labelledby': 'date-time-picker-grid-label',
    }, [gridLabel]);
    var weekdays = el('div', {
      class: 'date-picker-weekdays',
      'aria-hidden': 'true',
    }, WEEKDAYS_SHORT.map(function (w) { return el('span', { text: w }); }));

    var datePane = el('div', {
      class: 'date-time-picker-pane date-time-picker-pane--date',
      dataset: { pane: 'date' },
    }, [weekdays, dateGrid]);

    // Time pane (hour + minute cols).
    var timeLabel = el('span', {
      class: 'date-picker-sr-only',
      text: 'Hour',
    });
    var hourCol = el('div', {
      role: 'grid',
      class: 'time-picker-hour-col',
      'aria-label': 'Hour',
    }, [timeLabel]);
    var minuteCol = el('div', {
      role: 'grid',
      class: 'time-picker-minute-col',
      'aria-label': 'Minute',
    });
    var timePane = el('div', {
      class: 'date-time-picker-pane date-time-picker-pane--time',
      dataset: { pane: 'time' },
      hidden: true,
    }, [hourCol, minuteCol]);

    // Tab strip.
    var dateTab = el('button', {
      type: 'button',
      role: 'tab',
      class: 'date-time-picker-tab date-time-picker-tab--date',
      dataset: { tab: 'date' },
      'aria-selected': 'true',
      text: 'Date',
    });
    var timeTab = el('button', {
      type: 'button',
      role: 'tab',
      class: 'date-time-picker-tab date-time-picker-tab--time',
      dataset: { tab: 'time' },
      'aria-selected': 'false',
      text: 'Time',
    });
    var tabStrip = el('div', {
      class: 'date-time-picker-tabs',
      role: 'tablist',
    }, [dateTab, timeTab]);

    // Header.
    var header = el('header', {
      class: 'date-picker-header',
    }, [prevBtn, titleBtn, nextBtn]);

    // Footer — Now sets time to current local; OK commits.
    var nowBtn = el('button', {
      type: 'button',
      class: 'time-picker-now',
      dataset: { action: 'now' },
      text: 'Now',
    });
    var clearBtn = el('button', {
      type: 'button',
      class: 'date-picker-clear',
      dataset: { action: 'clear' },
      text: 'Clear',
    });
    var okBtn = el('button', {
      type: 'button',
      class: 'date-time-picker-ok',
      dataset: { action: 'ok' },
      text: 'OK',
    });

    var dlg = el('dialog', {
      class: 'date-picker-dialog date-time-picker-dialog',
      'aria-label': 'Choose date and time',
    }, [
      el('form', { method: 'dialog', class: 'date-picker-form' }, [
        header,
        tabStrip,
        datePane,
        timePane,
        el('footer', { class: 'date-picker-footer' }, [nowBtn, clearBtn, okBtn]),
      ]),
    ]);

    return {
      dlg: dlg,
      prevBtn: prevBtn,
      nextBtn: nextBtn,
      titleBtn: titleBtn,
      monthLabel: monthLabel,
      yearLabel: yearLabel,
      gridLabel: gridLabel,
      grid: dateGrid,
      hourCol: hourCol,
      minuteCol: minuteCol,
      dateTab: dateTab,
      timeTab: timeTab,
      nowBtn: nowBtn,
      clearBtn: clearBtn,
      okBtn: okBtn,
      _wired: false,
      _clickOutsideWired: false,
    };
  }

  function _ensureDateTimeDialog() {
    if (_dlgDateTime) return _dlgDateTime;
    if (typeof document === 'undefined' || !document.body) return null;
    // Date-time styles piggyback on chrome-date-picker.css (date grid
    // tokens) + chrome-time-picker.css (hour/minute cell tokens). The
    // tab strip + pane selectors are in chrome-datetime-picker.css.
    if (HT && typeof HT.lazyLoadCss === 'function') {
      try {
        HT.lazyLoadCss(resolveUrl('assets/css/chrome-datetime-picker.css'));
      } catch (_) {}
    }
    _dlgDateTime = _buildDateTimeDialogShell();
    document.body.appendChild(_dlgDateTime.dlg);
    _wireDateTimeDialogHandlers(_dlgDateTime);
    return _dlgDateTime;
  }

  // Render the date pane (date grid only — mirrors _renderGrid).
  function _renderDateTimeDatePane(state) {
    var dlg = state.dlg;
    var grid = dlg.grid;
    clearChildren(grid);
    var startIso = gridStart(state.view);
    var todayIso = isoToday();
    var selectedIso = state.selectedIso;
    var minIso = state.minIso || null;
    var maxIso = state.maxIso || null;
    dlg.monthLabel.textContent = MONTHS_LONG[state.view.m - 1];
    dlg.yearLabel.textContent  = String(state.view.y);
    dlg.gridLabel.textContent  = MONTHS_LONG[state.view.m - 1] + ' ' + state.view.y;
    var focusIso = state.focusedIso || selectedIso || (sameMonth(todayIso, state.view) ? todayIso : startIso);
    state.focusedIso = focusIso;
    for (var i = 0; i < 42; i += 1) {
      var iso = shiftISO(startIso, i);
      var parts = parseISO(iso);
      var isOther = !sameMonth(iso, state.view);
      var isToday = iso === todayIso;
      var isSelected = iso === selectedIso;
      var isFocused = iso === focusIso;
      var isDisabled = (minIso && isoCompare(iso, minIso) < 0) || (maxIso && isoCompare(iso, maxIso) > 0);
      var dow = new Date(parts.y, parts.m - 1, parts.d).getDay();
      var classes = ['date-picker-day'];
      if (isOther)     classes.push('date-picker-day--other-month');
      if (isToday)     classes.push('date-picker-day--today');
      if (isSelected)  classes.push('date-picker-day--selected');
      if (isFocused)   classes.push('date-picker-day--focused');
      var attrs = {
        type: 'button',
        role: 'gridcell',
        class: classes.join(' '),
        dataset: { date: iso },
        tabindex: isFocused ? '0' : '-1',
      };
      if (isDisabled) {
        attrs.disabled = true;
        attrs['aria-label'] = MONTHS_LONG[parts.m - 1] + ' ' + parts.d + ', ' + parts.y + ', unavailable';
      } else {
        attrs['aria-label'] = WEEKDAYS_LONG[dow] + ', ' + MONTHS_LONG[parts.m - 1] + ' ' + parts.d + ', ' + parts.y;
        if (isSelected) attrs['aria-selected'] = 'true';
      }
      attrs.text = String(parts.d);
      grid.appendChild(el('button', attrs));
    }
  }

  // Render the time pane (hour + minute cols).
  function _renderDateTimeTimePane(state) {
    var dlg = state.dlg;
    var hourCol = dlg.hourCol;
    var minuteCol = dlg.minuteCol;
    clearChildren(hourCol);
    clearChildren(minuteCol);
    for (var i = 0; i < HOURS.length; i += 1) {
      var h = HOURS[i];
      var isHourSelected = (h === state.selectedHour);
      var classes = ['time-picker-cell', 'time-picker-cell--hour'];
      if (isHourSelected) classes.push('time-picker-cell--selected');
      var attrs = {
        type: 'button',
        role: 'gridcell',
        class: classes.join(' '),
        dataset: { hour: String(h) },
        tabindex: '-1',
        'aria-label': h + ':00',
      };
      if (isHourSelected) attrs['aria-selected'] = 'true';
      attrs.text = h < 10 ? '0' + h : String(h);
      hourCol.appendChild(el('button', attrs));
    }
    for (var j = 0; j < MINUTES_5.length; j += 1) {
      var mn = MINUTES_5[j];
      var isMinuteSelected = (mn === state.selectedMinute);
      var classes2 = ['time-picker-cell', 'time-picker-cell--minute'];
      if (isMinuteSelected) classes2.push('time-picker-cell--selected');
      var attrs2 = {
        type: 'button',
        role: 'gridcell',
        class: classes2.join(' '),
        dataset: { minute: String(mn) },
        tabindex: '-1',
        'aria-label': 'Minute ' + (mn < 10 ? '0' + mn : mn),
      };
      if (isMinuteSelected) attrs2['aria-selected'] = 'true';
      attrs2.text = ':' + (mn < 10 ? '0' + mn : mn);
      minuteCol.appendChild(el('button', attrs2));
    }
  }

  // Show only the active pane; swap aria-selected on tabs.
  function _switchDateTimeTab(state, tabName) {
    state.tab = tabName;
    var dlg = state.dlg;
    var datePane = dlg.dlg.querySelector('.date-time-picker-pane--date');
    var timePane = dlg.dlg.querySelector('.date-time-picker-pane--time');
    if (datePane) datePane.hidden = (tabName !== 'date');
    if (timePane) timePane.hidden = (tabName !== 'time');
    if (dlg.dateTab) dlg.dateTab.setAttribute('aria-selected', tabName === 'date' ? 'true' : 'false');
    if (dlg.timeTab) dlg.timeTab.setAttribute('aria-selected', tabName === 'time' ? 'true' : 'false');
  }

  function _composeDateTime(state) {
    if (!state.selectedIso) return '';
    var t = toTime({ h: state.selectedHour, m: state.selectedMinute });
    return state.selectedIso + 'T' + t;
  }

  function _openDateTimeDialog(state) {
    if (!state.dlg || !state.dlg.dlg || typeof state.dlg.dlg.showModal !== 'function') {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('datePicker: <dialog>.showModal unavailable; datetime-local picker disabled');
      }
      return;
    }
    state.sourceEl = (typeof document !== 'undefined' && document.activeElement) || state.input;
    state.minIso = null; state.maxIso = null;
    var valStr = state.input.value || '';
    // Parse "YYYY-MM-DDTHH:MM" or "YYYY-MM-DD HH:MM".
    var m = valStr.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
    if (m) {
      var dateParts = parseISO(m[1]);
      var timeParts = parseTime(m[2]);
      if (dateParts && timeParts) {
        state.selectedIso = m[1];
        state.view = { y: dateParts.y, m: dateParts.m };
        state.focusedIso = m[1];
        state.selectedHour = timeParts.h;
        var snapped = Math.round(timeParts.m / 5) * 5;
        if (snapped >= 60) snapped = 55;
        state.selectedMinute = snapped;
      }
    }
    if (!state.selectedIso) {
      var today = isoToday();
      var tp = parseISO(today);
      state.selectedIso = today;
      state.view = { y: tp.y, m: tp.m };
      state.focusedIso = today;
      var now = timeNow();
      var np = parseTime(now);
      if (np) { state.selectedHour = np.h; state.selectedMinute = np.m; }
      else { state.selectedHour = 12; state.selectedMinute = 0; }
    }
    state.tab = 'date';
    _renderDateTimeDatePane(state);
    _renderDateTimeTimePane(state);
    _switchDateTimeTab(state, 'date');
    _positionDialog(state);
    try { state.dlg.dlg.showModal(); } catch (_) {}
    state.isOpen = true;
  }

  function _wireDateTimeKeyboard(state) {
    function onKey(e) {
      if (!state.isOpen) return;
      // Tab between panes: Ctrl+Tab (avoid clashing with the native
      // tab focus traversal). v1: simple Alt+Left / Alt+Right to swap.
      if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        _switchDateTimeTab(state, e.key === 'ArrowLeft' ? 'date' : 'time');
        return;
      }
      if (state.tab === 'date') {
        var key = e.key;
        if (key === 'ArrowLeft')  { e.preventDefault(); _moveDateTimeFocus(state, -1); }
        else if (key === 'ArrowRight') { e.preventDefault(); _moveDateTimeFocus(state, 1); }
        else if (key === 'ArrowUp')    { e.preventDefault(); _moveDateTimeFocus(state, -7); }
        else if (key === 'ArrowDown')  { e.preventDefault(); _moveDateTimeFocus(state, 7); }
        else if (key === 'PageUp') {
          e.preventDefault();
          state.view = addMonths(state.view, e.shiftKey ? -12 : -1);
          _renderDateTimeDatePane(state);
        }
        else if (key === 'PageDown') {
          e.preventDefault();
          state.view = addMonths(state.view, e.shiftKey ? 12 : 1);
          _renderDateTimeDatePane(state);
        }
        else if (key === 't' || key === 'T') {
          e.preventDefault();
          var today = isoToday();
          state.selectedIso = today;
          var tp = parseISO(today);
          state.view = { y: tp.y, m: tp.m };
          state.focusedIso = today;
          _renderDateTimeDatePane(state);
        }
        else if (key === 'Enter' || key === ' ') {
          if (state.focusedIso) {
            e.preventDefault();
            state.selectedIso = state.focusedIso;
            // Switch to time pane so user can fine-tune hour/minute.
            _switchDateTimeTab(state, 'time');
          }
        }
      } else {
        // Time pane keyboard (delegates to _moveTimeFocus-like inline logic).
        var key2 = e.key;
        if (key2 === 'ArrowLeft' || key2 === 'ArrowRight') {
          e.preventDefault();
          var stepMin = e.shiftKey ? 5 : 1;
          var newMin = ((state.selectedMinute + (key2 === 'ArrowLeft' ? -stepMin : stepMin)) % 60 + 60) % 60;
          state.selectedMinute = newMin;
          _renderDateTimeTimePane(state);
        }
        else if (key2 === 'ArrowUp' || key2 === 'ArrowDown') {
          e.preventDefault();
          var stepHr = e.shiftKey ? 6 : 1;
          var newH = ((state.selectedHour + (key2 === 'ArrowDown' ? -stepHr : stepHr)) % 24 + 24) % 24;
          state.selectedHour = newH;
          _renderDateTimeTimePane(state);
        }
        else if (key2 === 't' || key2 === 'T') {
          e.preventDefault();
          var now = timeNow();
          var parts = parseTime(now);
          if (parts) { state.selectedHour = parts.h; state.selectedMinute = parts.m; }
          _renderDateTimeTimePane(state);
        }
        else if (key2 === 'Enter' || key2 === ' ') {
          e.preventDefault();
          var composed = _composeDateTime(state);
          if (composed) _commitSelection(state, composed);
        }
      }
    }
    state._keydownHandler = onKey;
    state.dlg.dlg.addEventListener('keydown', onKey, true);
  }

  function _moveDateTimeFocus(state, deltaDays) {
    var next = state.focusedIso ? shiftISO(state.focusedIso, deltaDays) : null;
    if (!next) return;
    if (!sameMonth(next, state.view)) {
      state.view = addMonths(state.view, next < state.focusedIso ? -1 : 1);
    }
    state.focusedIso = next;
    _renderDateTimeDatePane(state);
  }

  function _wireDateTimeDialogHandlers(d) {
    if (!d || d._wired) return;
    d._wired = true;
    d.dlg.addEventListener('cancel', function () {
      var st = _activeState();
      if (st) _closeDialog(st);
    });
    // Click a day cell.
    d.grid.addEventListener('click', function (e) {
      var st = _activeState();
      if (!st || st.type !== 'datetime-local') return;
      var target = e.target;
      if (!target || typeof target.closest !== 'function') return;
      var cell = target.closest('.date-picker-day');
      if (!cell || cell.disabled) return;
      var iso = cell.getAttribute('data-date');
      if (iso) {
        st.selectedIso = iso;
        st.focusedIso = iso;
        _renderDateTimeDatePane(st);
        _switchDateTimeTab(st, 'time');
      }
    });
    // Prev/Next month.
    d.prevBtn.addEventListener('click', function () {
      var st = _activeState();
      if (!st || st.type !== 'datetime-local') return;
      st.view = addMonths(st.view, -1);
      _renderDateTimeDatePane(st);
    });
    d.nextBtn.addEventListener('click', function () {
      var st = _activeState();
      if (!st || st.type !== 'datetime-local') return;
      st.view = addMonths(st.view, 1);
      _renderDateTimeDatePane(st);
    });
    // Tab strip.
    d.dateTab.addEventListener('click', function () {
      var st = _activeState();
      if (!st || st.type !== 'datetime-local') return;
      _switchDateTimeTab(st, 'date');
    });
    d.timeTab.addEventListener('click', function () {
      var st = _activeState();
      if (!st || st.type !== 'datetime-local') return;
      _switchDateTimeTab(st, 'time');
    });
    // Hour + minute cell clicks.
    d.hourCol.addEventListener('click', function (e) {
      var st = _activeState();
      if (!st || st.type !== 'datetime-local') return;
      var target = e.target;
      if (!target || typeof target.closest !== 'function') return;
      var cell = target.closest('.time-picker-cell--hour');
      if (!cell) return;
      var h = parseInt(cell.getAttribute('data-hour'), 10);
      if (!isFinite(h)) return;
      st.selectedHour = h;
      _renderDateTimeTimePane(st);
    });
    d.minuteCol.addEventListener('click', function (e) {
      var st = _activeState();
      if (!st || st.type !== 'datetime-local') return;
      var target = e.target;
      if (!target || typeof target.closest !== 'function') return;
      var cell = target.closest('.time-picker-cell--minute');
      if (!cell) return;
      var mn = parseInt(cell.getAttribute('data-minute'), 10);
      if (!isFinite(mn)) return;
      st.selectedMinute = mn;
      _renderDateTimeTimePane(st);
    });
    // Now sets hour/minute to current local time (does NOT close).
    d.nowBtn.addEventListener('click', function () {
      var st = _activeState();
      if (!st || st.type !== 'datetime-local') return;
      var now = timeNow();
      var parts = parseTime(now);
      if (!parts) return;
      st.selectedHour = parts.h;
      st.selectedMinute = parts.m;
      _renderDateTimeTimePane(st);
    });
    // Clear empties the input + closes.
    d.clearBtn.addEventListener('click', function () {
      var st = _activeState();
      if (!st || !st.input) return;
      if (st.input.value !== '') {
        st.input.value = '';
        try {
          st.input.dispatchEvent(new Event('input',  { bubbles: true }));
          st.input.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (_) {}
      }
      st.selectedIso = null;
      _closeDialog(st);
    });
    // OK commits the composed value.
    d.okBtn.addEventListener('click', function () {
      var st = _activeState();
      if (!st || st.type !== 'datetime-local') return;
      var composed = _composeDateTime(st);
      if (composed) _commitSelection(st, composed);
    });
  }

  function _enhanceDateTime(inputEl, opts) {
    if (typeof document === 'undefined') {
      throw new Error('datePicker.enhance: no document');
    }
    var state = {
      _id: nextHandleId(),
      type: 'datetime-local',
      input: inputEl,
      opts: opts || {},
      dlg: _ensureDateTimeDialog(),
      sourceEl: null,
      view: { y: 0, m: 1 },
      selectedIso: null,
      focusedIso: null,
      selectedHour: 12,
      selectedMinute: 0,
      tab: 'date',
      isOpen: false,
      minIso: null,
      maxIso: null,
      _keydownHandler: null,
      _focusHandler: null,
      _clickHandler: null,
    };
    INSTANCES.push(state);
    _wireDateTimeKeyboard(state);
    _wireInputListeners(state);
    _wireClickOutside();
    return {
      _id: state._id,
      _state: state,
      open: function () { return openById(state._id); },
      close: function () { return closeById(state._id); },
      destroy: function () { return destroyById(state._id); },
      isOpen: function () { return isOpenById(state._id); },
    };
  }

  /* ----- Click-outside (Section I) -----
     Capture-phase mousedown listener on document. If the click is
     outside the dialog AND outside the source input, close. Mirrors
     help-overlay.js:539-551.

     Native <dialog> backdrop quirk: clicking on the backdrop (the
     dimmed area around the modal) sets e.target === dialog (NOT a
     child of the dialog). The .closest('.date-picker-dialog')
     check would still match (the dialog has the class) and we'd
     incorrectly treat the backdrop click as "inside the dialog"
     → no close. Fix: if e.target === dialog, the user clicked on
     the backdrop area (between the dialog's bounding box and the
     viewport edge), so close.

     The global listener is attached ONCE and dispatches per-instance
     via _activeState(). All three variants (date / time / date-time)
     share the same backdrop close behavior.
  */
  var _clickOutsideWired = false;
  // Story 9.19.1 hotfix 5 — coordinate multiple capture-phase
  // listeners (mousedown + click + pointerdown) so Firefox / Safari /
  // Chrome all fire close. The single mousedown listener from hotfix 4
  // is insufficient on some browsers (notably older Safari builds)
  // where the dialog backdrop doesn't fire mousedown on the dialog
  // element. We listen to all three event types and dedupe via a
  // short-lived flag so we don't call _closeDialog twice for the same
  // user gesture.
  var _lastCloseTs = 0;
  function _wireClickOutside() {
    if (_clickOutsideWired) return;
    _clickOutsideWired = true;
    function handleOutsideClick(e) {
      var st = _activeState();
      if (!st) return;
      var target = e.target;
      if (!target || typeof target.closest !== 'function') return;
      // Dedupe — same gesture can fire mousedown + click + pointerdown.
      // Within 250ms is the same user gesture.
      var now = (typeof performance !== 'undefined' && performance.now)
        ? performance.now() : Date.now();
      if (now - _lastCloseTs < 250) return;
      // Story 9.19.1 hotfix 4 — native <dialog> backdrop quirk.
      // Backdrop click sets e.target === dialog (not a child). The
      // .closest('.date-picker-dialog') check would still match (the
      // dialog has the class), so check it FIRST.
      if (st.dlg && st.dlg.dlg && target === st.dlg.dlg) {
        _lastCloseTs = now;
        _closeDialog(st);
        return;
      }
      // Inside the dialog (any descendant) — don't close.
      if (target.closest('.date-picker-dialog')) return;
      // Source input — don't close (user clicked the input that
      // opened the picker; the focus/click handler will keep it open).
      if (st.input && target === st.input) return;
      // Truly outside — close ALL open instances (multi-picker case).
      _lastCloseTs = now;
      for (var i = 0; i < INSTANCES.length; i += 1) {
        if (INSTANCES[i].isOpen) _closeDialog(INSTANCES[i]);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick, true);
    document.addEventListener('pointerdown', handleOutsideClick, true);
    document.addEventListener('click', handleOutsideClick, true);
  }

  /* ----- Per-input wiring (Section J) -----
     enhance(input, opts) attaches focus + click listeners on the
     input. First focus/click triggers the Proxy lazy-load
     (transparent via HT.datePicker). Subsequent interactions open
     the shared dialog.
  */
  function _wireInputListeners(state) {
    // Dispatch on state.type so time / datetime-local inputs open
    // their own dialog. Story 9.19.1 fix — calling _openDialog
    // unconditionally on a time state threw because _renderGrid
    // relies on dlg.grid, which the time variant doesn't expose
    // (it has hourCol + minuteCol instead). Same for datetime-local
    // (which has tab + grid + hourCol + minuteCol). The fix mirrors
    // openById's dispatch.
    function openForType() {
      if (state._suppressOpen) {
        // The handler just closed the dialog and called restore.focus()
        // on this input — that focus() synchronously fires a `focus`
        // event which would otherwise re-open the picker. Skip.
        state._suppressOpen = false;
        return;
      }
      if (state.type === 'time') _openTimeDialog(state);
      else if (state.type === 'datetime-local') _openDateTimeDialog(state);
      else _openDialog(state);
    }
    function onFocus() { openForType(); }
    function onClick() { openForType(); }
    state._focusHandler = onFocus;
    state._clickHandler = onClick;
    state.input.addEventListener('focus', onFocus);
    state.input.addEventListener('click', onClick);
    // Keyboard activation (Space / Enter) on the input also opens
    // the picker (native date input behavior).
    state.input.addEventListener('keydown', function onKeydown(e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        openForType();
      }
    });
  }

  /* ----- Public API ----- */

  function enhance(inputEl, opts) {
    if (!inputEl || inputEl.tagName !== 'INPUT') {
      throw new Error('datePicker.enhance: inputEl must be <input>');
    }
    // Story 9.19.1 — dispatch on input.type. Date, time, and
    // datetime-local are all accepted.
    if (inputEl.type === 'time') return _enhanceTime(inputEl, opts);
    if (inputEl.type === 'datetime-local') return _enhanceDateTime(inputEl, opts);
    if (inputEl.type !== 'date') {
      throw new Error('datePicker.enhance: inputEl.type must be "date", "time", or "datetime-local" (got "' + inputEl.type + '")');
    }
    if (typeof document === 'undefined') {
      throw new Error('datePicker.enhance: no document');
    }
    var state = {
      _id: nextHandleId(),
      type: 'date',
      input: inputEl,
      opts: opts || {},
      dlg: _ensureDialog(),
      sourceEl: null,
      view: { y: 0, m: 1 },
      // Story 9.19.5 (inlined into 9.19.1 hotfix 4): the title
      // button cycles the grid through three modes — 'days' shows
      // the month grid, 'months' shows the 12-month grid for the
      // current year, 'years' shows the 12-year grid for the
      // current decade. Click a month/year cell to drill down.
      mode: 'days',
      selected: null,
      focusedIso: null,
      isOpen: false,
      minIso: null,
      maxIso: null,
      _keydownHandler: null,
      _focusHandler: null,
      _clickHandler: null,
    };
    INSTANCES.push(state);
    _wireGridKeyboard(state);
    _wireInputListeners(state);
    _wireClickOutside();
    return {
      _id: state._id,
      _state: state,
      open: function () { return openById(state._id); },
      close: function () { return closeById(state._id); },
      destroy: function () { return destroyById(state._id); },
      isOpen: function () { return isOpenById(state._id); },
    };
  }

  function openById(id) {
    var state = findHandle({ _id: id });
    if (!state) return;
    if (state.type === 'time') _openTimeDialog(state);
    else if (state.type === 'datetime-local') _openDateTimeDialog(state);
    else _openDialog(state);
  }

  function closeById(id) {
    var state = findHandle({ _id: id });
    if (!state) return;
    _closeDialog(state);
  }

  function destroyById(id) {
    var state = findHandle({ _id: id });
    if (!state) return;
    destroyState(state);
  }

  function isOpenById(id) {
    var state = findHandle({ _id: id });
    if (!state) return false;
    return !!state.isOpen;
  }

  function destroyState(state) {
    _closeDialog(state);
    // Remove per-input listeners.
    if (state._focusHandler && state.input) {
      try { state.input.removeEventListener('focus', state._focusHandler); } catch (_) {}
    }
    if (state._clickHandler && state.input) {
      try { state.input.removeEventListener('click', state._clickHandler); } catch (_) {}
    }
    if (state._keydownHandler && state.dlg && state.dlg.dlg) {
      try { state.dlg.dlg.removeEventListener('keydown', state._keydownHandler, true); } catch (_) {}
    }
    dropInstance(state);
  }

  /* ----- Public API registration -----
     Mirror the quiz.js pattern (assets/js/quiz.js:1300-1322): use
     Object.defineProperty to FORCE the shell-thin.js Proxy stub off
     HT.datePicker. A plain `HT.datePicker = HT.datePicker || publicApi`
     would short-circuit on the truthy Proxy and the lazy-load round-
     trip would never resolve to the real API.
   */

  var publicApi = Object.freeze({
    enhance: enhance,
    open: openById,
    close: closeById,
    destroy: destroyById,
    isOpen: isOpenById,
  });

  var rootHT = (typeof window !== 'undefined' && window.HT) ||
               (typeof self !== 'undefined' && self.HT) ||
               null;
  if (!rootHT) {
    if (typeof window !== 'undefined') {
      window.HT = window.HT || {};
      rootHT = window.HT;
    }
  }
  if (rootHT) {
    try {
      Object.defineProperty(rootHT, 'datePicker', {
        value: publicApi,
        writable: false,
        configurable: false,
        enumerable: true,
      });
    } catch (_) {
      try { rootHT.datePicker = publicApi; } catch (__) {}
    }
  }
})();