/* ============================================
   Handy Tools — date-picker.js (Story 9.19)

   Custom popover-style date picker that swaps in for
   `<input type="date">` on opt-in inputs (class `js-date-picker`).
   The underlying input stays the source of truth — same `id`,
   `name`, `value` (ISO YYYY-MM-DD), `min`/`max`, and the same
   `change`/`input` events fire after a pick.

   Page-conditional module — lazy-loaded via shell-thin.js's
   Proxy factory on first `HT.datePicker.enhance()` call.

   AD-1   — Pure vanilla, no third-party libs (animations are CSS-only)
   AD-12  — ES2018 vanilla; no SSR; no build step
   AD-14  — Shell Public API surface (HT.datePicker is the contract)
   FR-7   — Keyboard-first interaction (arrows / PageUp-Down / Home-End / T / Enter / Esc)

   Public API (frozen, stable):
     HT.datePicker.enhance(inputEl, opts?) → handle
       inputEl : HTMLInputElement — must be <input type="date">.
       opts?   : { onSelect?(iso: string) → void }
                 Optional extra callback; the input still fires
                 `change` + `input`.
     HT.datePicker.open(handle)
     HT.datePicker.close(handle)
     HT.datePicker.destroy(handle)
     HT.datePicker.isOpen(handle?) → boolean

   Handle API:
     { open, close, destroy, isOpen, _state }

   DOM shape inside <body> (one instance, reused):
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

   Story 9.19 — see _bmad-output/implementation-artifacts/story-9.19-date-picker.md
   ============================================ */

(function () {
  'use strict';

  if (typeof window === 'undefined') return;
  var HT = (window.HT = window.HT || {});

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

  /* ----- Dialog build (Section E) -----
     Single shared dialog instance. Phase 2 fills in the full grid
     + header refs + footer refs + keyboard handlers.
  */

  var _dlg = null; // shared dialog reference (null until first enhance)

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
    var grid = dlg.grid;
    clearChildren(grid);

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
    var focused = grid.querySelector('.date-picker-day--focused');
    if (focused && typeof focused.focus === 'function') {
      try { focused.focus(); } catch (_) {}
    }
  }

  function _wireGridKeyboard(state) {
    // Keydown is delegated on the dialog (capture-phase) so it works
    // even if a cell doesn't have focus initially. We route by event
    // target to the active state.
    function onKey(e) {
      if (!state.isOpen) return;
      var key = e.key;
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

    // Click on a day cell → select.
    d.grid.addEventListener('click', function (e) {
      var st = _activeState();
      if (!st) return;
      var target = e.target;
      if (!target || typeof target.closest !== 'function') return;
      var cell = target.closest('.date-picker-day');
      if (!cell || cell.disabled) return;
      var iso = cell.getAttribute('data-date');
      if (iso) {
        _commitSelection(st, iso);
      }
    });

    // Prev / Next month nav.
    d.prevBtn.addEventListener('click', function () {
      var st = _activeState();
      if (!st) return;
      st.view = addMonths(st.view, -1);
      _renderGrid(st); _focusFocusedCell(st);
    });
    d.nextBtn.addEventListener('click', function () {
      var st = _activeState();
      if (!st) return;
      st.view = addMonths(st.view, 1);
      _renderGrid(st); _focusFocusedCell(st);
    });

    // Title button — placeholder for year picker (Story 9.19.5). v1
    // just toggles the year nav. We keep the button for layout but
    // make it a no-op for now.
    d.titleBtn.addEventListener('click', function () {
      // No-op v1; future Story 9.19.5 (decade jump) wires this.
    });

    // Today / Clear.
    d.todayBtn.addEventListener('click', function () {
      var st = _activeState();
      if (!st) return;
      var today = isoToday();
      st.focusedIso = clampToBounds(today, st.minIso, st.maxIso) || today;
      var tp = parseISO(st.focusedIso);
      if (tp) st.view = { y: tp.y, m: tp.m };
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

  /* ----- Click-outside (Section I) -----
     Capture-phase mousedown listener on document. If the click is
     outside the dialog AND outside the source input, close. Mirrors
     help-overlay.js:539-551.
  */
  function _wireClickOutside() {
    if (_dlg && _dlg._clickOutsideWired) return;
    function onDocMouseDown(e) {
      var st = _activeState();
      if (!st) return;
      var target = e.target;
      if (!target || typeof target.closest !== 'function') return;
      if (target.closest('.date-picker-dialog')) return;       // inside dialog
      if (st.input && target === st.input) return;             // source input
      _closeDialog(st);
    }
    document.addEventListener('mousedown', onDocMouseDown, true);
    if (_dlg) _dlg._clickOutsideWired = true;
  }

  /* ----- Per-input wiring (Section J) -----
     enhance(input, opts) attaches focus + click listeners on the
     input. First focus/click triggers the Proxy lazy-load
     (transparent via HT.datePicker). Subsequent interactions open
     the shared dialog.
  */
  function _wireInputListeners(state) {
    function onFocus() { _openDialog(state); }
    function onClick() { _openDialog(state); }
    state._focusHandler = onFocus;
    state._clickHandler = onClick;
    state.input.addEventListener('focus', onFocus);
    state.input.addEventListener('click', onClick);
    // Keyboard activation (Space / Enter) on the input also opens
    // the picker (native date input behavior).
    state.input.addEventListener('keydown', function onKeydown(e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        _openDialog(state);
      }
    });
  }

  /* ----- Public API ----- */

  function enhance(inputEl, opts) {
    if (!inputEl || inputEl.tagName !== 'INPUT' || inputEl.type !== 'date') {
      throw new Error('datePicker.enhance: inputEl must be <input type="date">');
    }
    if (typeof document === 'undefined') {
      throw new Error('datePicker.enhance: no document');
    }
    var state = {
      _id: nextHandleId(),
      input: inputEl,
      opts: opts || {},
      dlg: _ensureDialog(),
      sourceEl: null,
      view: { y: 0, m: 1 },
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
    _openDialog(state);
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