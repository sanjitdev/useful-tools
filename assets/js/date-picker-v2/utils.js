/* date-picker-v2 / utils.js
 *
 * Pure-utility helpers — no DOM, no state. Parses ISO strings
 * (YYYY-MM-DD, HH:MM, YYYY-MM-DDTHH:MM) into {y, m, d, hh, mm}
 * objects and back, plus grid math (start-of-month, leading
 * blanks, weekday headers). Kept dependency-free so the smoke
 * harness can require() the module under Node vm without jsdom.
 *
 * Story 9.19 rewrite — see plan at
 *   C:\Users\BS707\.puku-cli\plans\jolly-drifting-graham.md (Phase 2b)
 */

'use strict';

(function (root) {
  var NS = root.HT = root.HT || {};
  NS.datePickerV2 = NS.datePickerV2 || {};
  var DPV = NS.datePickerV2;

  // ----- pad -----
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  // ----- parse / format -----
  //
  // `parseDate('2026-08-17')` → { y: 2026, m: 8, d: 17, hh: 0, mm: 0 }
  // `parseTime('14:30')`     → { y: 1970, m: 1, d: 1, hh: 14, mm: 30 }
  // `parseDateTime('2026-08-17T14:30')` → combined
  //
  // All parsers return null on malformed input. Time-only values
  // fill the date with 1970-01-01 sentinel so the same shape works
  // for both variants. The smoke harness leans on this contract.
  function parseDate(str) {
    if (typeof str !== 'string') return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (!isValidYMD(y, mo, d)) return null;
    return { y: y, m: mo, d: d, hh: 0, mm: 0 };
  }

  function parseTime(str) {
    if (typeof str !== 'string') return null;
    var m = /^(\d{2}):(\d{2})$/.exec(str);
    if (!m) return null;
    var hh = +m[1], mm = +m[2];
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return { y: 1970, m: 1, d: 1, hh: hh, mm: mm };
  }

  function parseDateTime(str) {
    if (typeof str !== 'string') return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(str);
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3], hh = +m[4], mm = +m[5];
    if (!isValidYMD(y, mo, d)) return null;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return { y: y, m: mo, d: d, hh: hh, mm: mm };
  }

  function isValidYMD(y, m, d) {
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    // Cross-check via Date to catch month-length edge cases.
    var dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y &&
           dt.getUTCMonth() + 1 === m &&
           dt.getUTCDate() === d;
  }

  function formatDate(parts) {
    if (!parts) return '';
    return parts.y + '-' + pad2(parts.m) + '-' + pad2(parts.d);
  }

  function formatTime(parts) {
    if (!parts) return '';
    return pad2(parts.hh) + ':' + pad2(parts.mm);
  }

  function formatDateTime(parts) {
    if (!parts) return '';
    return formatDate(parts) + 'T' + formatTime(parts);
  }

  // ----- grid math -----
  //
  // `gridStart(2026, 8)` — first cell to render for August 2026
  // (a Sunday). `gridCells(2026, 8)` — the 42-cell array of
  // {y, m, d, inMonth} for the grid. Leading and trailing cells
  // belong to the previous / next month but render with a muted
  // class. Week starts on Sunday (0).
  function weekdayOf(y, m /* 1-12 */, d) {
    // 0 = Sunday, 6 = Saturday.
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  }

  function daysInMonth(y, m) {
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  }

  function gridCells(y, m) {
    var first = weekdayOf(y, m, 1);
    var dim = daysInMonth(y, m);
    var cells = [];
    // Leading cells from previous month.
    var prevDim = daysInMonth(y, m - 1);
    for (var i = first - 1; i >= 0; i--) {
      cells.push({ y: y, m: m - 1, d: prevDim - i, inMonth: false });
    }
    // Current month.
    for (var d2 = 1; d2 <= dim; d2++) {
      cells.push({ y: y, m: m, d: d2, inMonth: true });
    }
    // Trailing cells from next month.
    var trailing = 42 - cells.length;
    for (var t = 1; t <= trailing; t++) {
      cells.push({ y: y, m: m + 1, d: t, inMonth: false });
    }
    return cells;
  }

  // Same-month comparison — used by the date picker to highlight
  // the focused day. Returns true iff both parts represent the
  // same Y/M/D regardless of hh/mm.
  function sameDay(a, b) {
    return !!a && !!b && a.y === b.y && a.m === b.m && a.d === b.d;
  }

  // Public surface (frozen).
  DPV.utils = Object.freeze({
    pad2: pad2,
    parseDate: parseDate,
    parseTime: parseTime,
    parseDateTime: parseDateTime,
    isValidYMD: isValidYMD,
    formatDate: formatDate,
    formatTime: formatTime,
    formatDateTime: formatDateTime,
    weekdayOf: weekdayOf,
    daysInMonth: daysInMonth,
    gridCells: gridCells,
    sameDay: sameDay,
  });
})(typeof window !== 'undefined' ? window : globalThis);