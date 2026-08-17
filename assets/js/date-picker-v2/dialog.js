/* date-picker-v2 / dialog.js
 *
 * Renders the date / time / datetime-local dialogs. Each instance
 * is created once per <input> it's attached to, then re-rendered
 * on every open (cheap — 42 day cells). The state object passed
 * in carries the picker config (type, current value, callbacks).
 *
 * Public API exposed on HT.datePickerV2.dialogs:
 *   build(state) → DOMElement
 *     state = {
 *       id,                       // unique dialog id (suffix)
 *       type,                     // 'date' | 'time' | 'datetime-local'
 *       value,                    // current ISO string from the input
 *       onSelect,                 // (value: string) → void
 *       onClose,                  // () → void (dialog-only close path)
 *       onOpen,                   // () → void (informational)
 *       input,                    // the source input element
 *     }
 *
 * The returned element is a <dialog> with internal form, header,
 * grid, and footer. The form's `method="dialog"` lets the
 * browser close the dialog on submit (Enter key) — we don't
 * need a separate submit handler.
 */

'use strict';

(function (root) {
  var NS = root.HT = root.HT || {};
  NS.datePickerV2 = NS.datePickerV2 || {};
  var DPV = NS.datePickerV2;
  var U = DPV.utils;

  // Weekday labels (Sunday first, matches grid math).
  var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

  // ----- helpers -----

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, k)) {
          if (k === 'text') n.textContent = attrs[k];
          else if (k === 'html') n.innerHTML = attrs[k];
          else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') {
            n.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
          } else if (k === 'dataset' && typeof attrs[k] === 'object') {
            for (var d in attrs[k]) {
              if (Object.prototype.hasOwnProperty.call(attrs[k], d)) {
                n.dataset[d] = attrs[k][d];
              }
            }
          } else {
            n.setAttribute(k, attrs[k]);
          }
        }
      }
    }
    if (children) {
      for (var i = 0; i < children.length; i++) {
        var c = children[i];
        if (c == null) continue;
        if (typeof c === 'string') n.appendChild(document.createTextNode(c));
        else n.appendChild(c);
      }
    }
    return n;
  }

  // ----- date dialog -----
  //
  // Layout:
  //   ┌────────────────────────────────────────┐
  //   │  ‹  |  August 2026        |  ›         │
  //   │  Sun Mon Tue Wed Thu Fri Sat           │
  //   │  [ 27][28][29][30][31][ 1][ 2]         │
  //   │  [ 3][ 4][ 5][ 6][ 7][ 8][ 9]          │
  //   │  …                                     │
  //   │  [Today]              [Clear]         │
  //   └────────────────────────────────────────┘

  function buildDate(state) {
    var parsed = U.parseDate(state.value);
    var cursor = parsed ? { y: parsed.y, m: parsed.m } : (function () {
      var n = new Date();
      return { y: n.getFullYear(), m: n.getMonth() + 1 };
    })();
    // Today's date — used to mark cells in the grid (CSS adds a
    // subtle ring / dot when the cell matches today). Computed
    // once per build so the marker is stable while the dialog is
    // open even if midnight rolls over.
    var today = (function () {
      var n = new Date();
      return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
    })();

    var title = el('span', { class: 'dpv2-title', id: 'dpv2-title-' + state.id, 'aria-live': 'polite' });
    var grid = el('div', {
      role: 'grid',
      class: 'dpv2-grid',
      'aria-labelledby': 'dpv2-title-' + state.id,
      'data-dpv2-grid': 'date',
    });

    function renderTitle() {
      title.textContent = MONTHS[cursor.m - 1] + ' ' + cursor.y;
    }
    function renderGrid() {
      while (grid.firstChild) grid.removeChild(grid.firstChild);
      var cells = U.gridCells(cursor.y, cursor.m);
      for (var i = 0; i < cells.length; i++) {
        (function (cell) {
          var isToday = cell.y === today.y && cell.m === today.m && cell.d === today.d;
          var b = el('button', {
            type: 'button',
            class: 'dpv2-cell',
            role: 'gridcell',
            'data-other-month': cell.inMonth ? '0' : '1',
            'data-selected': (parsed && U.sameDay(parsed, cell)) ? '1' : '0',
            'data-today': isToday ? '1' : '0',
            'data-y': String(cell.y),
            'data-m': String(cell.m),
            'data-d': String(cell.d),
            'aria-label': cell.y + '-' + U.pad2(cell.m) + '-' + U.pad2(cell.d) + (isToday ? ' (today)' : ''),
            onclick: function () { selectDate(cell); },
          }, [U.pad2(cell.d) + '']);
          grid.appendChild(b);
        })(cells[i]);
      }
    }

    function selectDate(cell) {
      // Write the new ISO value to the input and fire change/input.
      // We delegate value commit to the outer closer (/core.js) so
      // there is one place that fires events.
      if (state._commitValue) {
        var parts = U.parseDate(state.value) || { y: cell.y, m: cell.m, d: 1, hh: 0, mm: 0 };
        parts = { y: cell.y, m: cell.m, d: cell.d, hh: parts.hh || 0, mm: parts.mm || 0 };
        state._commitValue(U.formatDate(parts));
      }
    }

    function header() {
      var prevLabel = el('button', {
        type: 'button', class: 'dpv2-nav',
        'aria-label': 'Previous month', 'data-dpv2-nav': 'prev',
        onclick: function () { cursor = prevMonth(cursor); renderTitle(); renderGrid(); },
      }, ['‹']);
      var nextLabel = el('button', {
        type: 'button', class: 'dpv2-nav',
        'aria-label': 'Next month', 'data-dpv2-nav': 'next',
        onclick: function () { cursor = nextMonth(cursor); renderTitle(); renderGrid(); },
      }, ['›']);
      return el('header', { class: 'dpv2-header' }, [prevLabel, title, nextLabel]);
    }

    function weekdays() {
      return el('div', { class: 'dpv2-weekdays', 'aria-hidden': 'true' },
        WEEKDAYS.map(function (w) { return el('span', null, [w]); })
      );
    }

    function footer() {
      return el('footer', { class: 'dpv2-footer' }, [
        el('button', { type: 'button', 'data-dpv2-action': 'today',
          onclick: function () {
            var n = new Date();
            selectDate({ y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() });
          }
        }, ['Today']),
        el('button', { type: 'button', 'data-dpv2-action': 'clear',
          onclick: function () {
            if (state._commitValue) state._commitValue('');
          }
        }, ['Clear']),
      ]);
    }

    renderTitle();
    renderGrid();

    return el('dialog', {
      class: 'dpv2-dialog',
      id: 'dpv2-' + state.id,
      'aria-label': 'Choose date',
      'data-dpv2-type': 'date',
      'data-dpv2-source-id': state.input && state.input.id || '',
    }, [
      el('form', { method: 'dialog', class: 'dpv2-form' }, [
        header(),
        weekdays(),
        grid,
        footer(),
      ]),
    ]);
  }

  function prevMonth(cur) {
    if (cur.m === 1) return { y: cur.y - 1, m: 12 };
    return { y: cur.y, m: cur.m - 1 };
  }
  function nextMonth(cur) {
    if (cur.m === 12) return { y: cur.y + 1, m: 1 };
    return { y: cur.y, m: cur.m + 1 };
  }

  // ----- time dialog -----
  //
  // Two columns: hours (00-23) and minutes (00-59). Selecting an
  // entry writes the time string and closes via the form-dialog
  // pattern (the click on the cell bubbles to a `select` callback
  // that closes).

  function buildTime(state) {
    var parsed = U.parseTime(state.value);
    var hh = parsed ? parsed.hh : 12;
    var mm = parsed ? parsed.mm : 0;

    var hourCol = el('div', { class: 'dpv2-time-col', 'data-dpv2-col': 'hour', role: 'listbox', 'aria-label': 'Hour' });
    var minCol = el('div', { class: 'dpv2-time-col', 'data-dpv2-col': 'minute', role: 'listbox', 'aria-label': 'Minute' });

    function renderCol(col, max, current, kind) {
      while (col.firstChild) col.removeChild(col.firstChild);
      for (var i = 0; i < max; i++) {
        (function (v) {
          var b = el('button', {
            type: 'button',
            class: 'dpv2-time-cell',
            role: 'option',
            'data-selected': v === current ? '1' : '0',
            'data-value': U.pad2(v),
            onclick: function () {
              if (kind === 'hour') hh = v; else mm = v;
              if (state._commitValue) state._commitValue(U.pad2(hh) + ':' + U.pad2(mm));
            },
          }, [U.pad2(v)]);
          col.appendChild(b);
        })(i);
      }
    }

    renderCol(hourCol, 24, hh, 'hour');
    renderCol(minCol, 60, mm, 'minute');

    var footer = el('footer', { class: 'dpv2-footer' }, [
      el('button', { type: 'button', 'data-dpv2-action': 'now',
        onclick: function () {
          var n = new Date();
          hh = n.getHours(); mm = n.getMinutes();
          if (state._commitValue) state._commitValue(U.pad2(hh) + ':' + U.pad2(mm));
        }
      }, ['Now']),
      el('button', { type: 'button', 'data-dpv2-action': 'clear',
        onclick: function () {
          if (state._commitValue) state._commitValue('');
        }
      }, ['Clear']),
    ]);

    return el('dialog', {
      class: 'dpv2-dialog',
      id: 'dpv2-' + state.id,
      'aria-label': 'Choose time',
      'data-dpv2-type': 'time',
      'data-dpv2-source-id': state.input && state.input.id || '',
    }, [
      el('form', { method: 'dialog', class: 'dpv2-form' }, [
        el('div', { class: 'dpv2-time-cols' }, [hourCol, minCol]),
        footer,
      ]),
    ]);
  }

  // ----- datetime dialog -----
  // Date grid on top, time columns underneath. Selecting a day
  // does NOT commit — only the time-column / Today / Now buttons
  // commit. This matches the spec: datetime-local keeps both
  // parts until the user explicitly closes.

  function buildDateTime(state) {
    var parsed = U.parseDateTime(state.value);
    var cursor = parsed ? { y: parsed.y, m: parsed.m } : (function () {
      var n = new Date();
      return { y: n.getFullYear(), m: n.getMonth() + 1 };
    })();
    var hh = parsed ? parsed.hh : 12;
    var mm = parsed ? parsed.mm : 0;
    var selectedDay = parsed ? { y: parsed.y, m: parsed.m, d: parsed.d } : null;

    var title = el('span', { class: 'dpv2-title', id: 'dpv2-title-' + state.id, 'aria-live': 'polite' });
    var grid = el('div', {
      role: 'grid',
      class: 'dpv2-grid',
      'aria-labelledby': 'dpv2-title-' + state.id,
      'data-dpv2-grid': 'date',
    });

    function renderTitle() {
      title.textContent = MONTHS[cursor.m - 1] + ' ' + cursor.y;
    }
    function renderGrid() {
      while (grid.firstChild) grid.removeChild(grid.firstChild);
      var cells = U.gridCells(cursor.y, cursor.m);
      for (var i = 0; i < cells.length; i++) {
        (function (cell) {
          var isSelected = !!selectedDay && U.sameDay(selectedDay, cell);
          var b = el('button', {
            type: 'button',
            class: 'dpv2-cell',
            role: 'gridcell',
            'data-other-month': cell.inMonth ? '0' : '1',
            'data-selected': isSelected ? '1' : '0',
            'data-y': String(cell.y),
            'data-m': String(cell.m),
            'data-d': String(cell.d),
            'aria-label': cell.y + '-' + U.pad2(cell.m) + '-' + U.pad2(cell.d),
            onclick: function () {
              selectedDay = { y: cell.y, m: cell.m, d: cell.d };
              renderGrid();
            },
          }, [U.pad2(cell.d) + '']);
          grid.appendChild(b);
        })(cells[i]);
      }
    }

    function commit() {
      if (!state._commitValue) return;
      if (!selectedDay) return;
      var iso = U.formatDate(selectedDay) + 'T' + U.pad2(hh) + ':' + U.pad2(mm);
      state._commitValue(iso);
    }

    function header() {
      return el('header', { class: 'dpv2-header' }, [
        el('button', { type: 'button', class: 'dpv2-nav',
          'aria-label': 'Previous month', 'data-dpv2-nav': 'prev',
          onclick: function () { cursor = prevMonth(cursor); renderTitle(); renderGrid(); },
        }, ['‹']),
        title,
        el('button', { type: 'button', class: 'dpv2-nav',
          'aria-label': 'Next month', 'data-dpv2-nav': 'next',
          onclick: function () { cursor = nextMonth(cursor); renderTitle(); renderGrid(); },
        }, ['›']),
      ]);
    }

    var hourCol = el('div', { class: 'dpv2-time-col', 'data-dpv2-col': 'hour', role: 'listbox', 'aria-label': 'Hour' });
    var minCol = el('div', { class: 'dpv2-time-col', 'data-dpv2-col': 'minute', role: 'listbox', 'aria-label': 'Minute' });
    function renderCol(col, max, current, kind) {
      while (col.firstChild) col.removeChild(col.firstChild);
      for (var i = 0; i < max; i++) {
        (function (v) {
          var b = el('button', {
            type: 'button', class: 'dpv2-time-cell', role: 'option',
            'data-selected': v === current ? '1' : '0',
            'data-value': U.pad2(v),
            onclick: function () {
              if (kind === 'hour') hh = v; else mm = v;
              // Re-render to reflect new selection, then commit.
              renderCol(hourCol, 24, hh, 'hour');
              renderCol(minCol, 60, mm, 'minute');
              commit();
            },
          }, [U.pad2(v)]);
          col.appendChild(b);
        })(i);
      }
    }
    renderCol(hourCol, 24, hh, 'hour');
    renderCol(minCol, 60, mm, 'minute');

    renderTitle();
    renderGrid();

    return el('dialog', {
      class: 'dpv2-dialog',
      id: 'dpv2-' + state.id,
      'aria-label': 'Choose date and time',
      'data-dpv2-type': 'datetime-local',
      'data-dpv2-source-id': state.input && state.input.id || '',
    }, [
      el('form', { method: 'dialog', class: 'dpv2-form' }, [
        header(),
        el('div', { class: 'dpv2-weekdays', 'aria-hidden': 'true' },
          WEEKDAYS.map(function (w) { return el('span', null, [w]); })),
        grid,
        el('div', { class: 'dpv2-time-cols' }, [hourCol, minCol]),
        el('footer', { class: 'dpv2-footer' }, [
          el('button', { type: 'button', 'data-dpv2-action': 'now',
            onclick: function () {
              var n = new Date();
              selectedDay = { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
              hh = n.getHours(); mm = n.getMinutes();
              renderGrid();
              renderCol(hourCol, 24, hh, 'hour');
              renderCol(minCol, 60, mm, 'minute');
              commit();
            }
          }, ['Now']),
          el('button', { type: 'button', 'data-dpv2-action': 'clear',
            onclick: function () {
              if (state._commitValue) state._commitValue('');
            }
          }, ['Clear']),
        ]),
      ]),
    ]);
  }

  // ----- public surface -----

  function build(state) {
    if (state.type === 'date') return buildDate(state);
    if (state.type === 'time') return buildTime(state);
    if (state.type === 'datetime-local') return buildDateTime(state);
    throw new Error('date-picker-v2: unknown type ' + state.type);
  }

  DPV.dialogs = Object.freeze({ build: build });
})(typeof window !== 'undefined' ? window : globalThis);