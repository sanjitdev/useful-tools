/* ============================================
   Exam Countdown — Story 9.8
   Live countdown to a single datetime-local
   target. State machine is trivial — there's no
   "running" vs "paused"; the tick is either
   "active target in the future" or "active target
   in the past" or "no target at all". The tick
   function re-evaluates the diff every 1000ms.

   Persistence:
   - HT.storage key 'ht.exam-countdown.target'
     holds the picked target across sessions.
   - URL ?target=<value> overrides HT.storage on
     load (and is itself overwritten on every
     input change via history.replaceState).

   Privacy: zero fetch / XHR / HT.provide calls.
   ============================================ */

(function () {
  'use strict';

  // -------- Constants --------
  var STORAGE_KEY = 'ht.exam-countdown.target';

  // -------- DOM refs --------
  var inputEl = HT.$('#ec-target');
  var emptyEl = HT.$('#ec-empty-notice');
  var pastEl = HT.$('#ec-past-notice');
  var daysEl = HT.$('#ec-days');
  var hoursEl = HT.$('#ec-hours');
  var minutesEl = HT.$('#ec-minutes');
  var secondsEl = HT.$('#ec-seconds');
  var clearBtn = HT.$('#ec-clear');

  // -------- Helpers --------
  function parseTarget(v) {
    if (!v) return null;
    var d = new Date(v);
    if (isNaN(d.getTime())) return null;
    return d;
  }

  function pad2(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function clearStorage() {
    try { HT.storage.remove(STORAGE_KEY); } catch (_) { /* ignore */ }
  }

  function readStorage() {
    try {
      var v = HT.storage.get(STORAGE_KEY, null);
      return v || null;
    } catch (_) {
      return null;
    }
  }

  function writeStorage(v) {
    try { HT.storage.set(STORAGE_KEY, v); } catch (_) { /* ignore */ }
  }

  // -------- Render --------
  function renderEmpty() {
    if (emptyEl) emptyEl.hidden = false;
    if (pastEl) pastEl.hidden = true;
    if (daysEl) daysEl.textContent = '0d';
    if (hoursEl) hoursEl.textContent = '0h';
    if (minutesEl) minutesEl.textContent = '0m';
    if (secondsEl) secondsEl.textContent = '0s';
  }

  function renderPast() {
    if (emptyEl) emptyEl.hidden = true;
    if (pastEl) pastEl.hidden = false;
    if (daysEl) daysEl.textContent = '0d';
    if (hoursEl) hoursEl.textContent = '0h';
    if (minutesEl) minutesEl.textContent = '0m';
    if (secondsEl) secondsEl.textContent = '0s';
  }

  function renderCountdown(diffMs) {
    if (emptyEl) emptyEl.hidden = true;
    if (pastEl) pastEl.hidden = true;
    var totalSec = Math.max(0, Math.floor(diffMs / 1000));
    var days = Math.floor(totalSec / 86400);
    var hours = Math.floor((totalSec % 86400) / 3600);
    var minutes = Math.floor((totalSec % 3600) / 60);
    var seconds = totalSec % 60;
    if (daysEl) daysEl.textContent = days + 'd';
    if (hoursEl) hoursEl.textContent = pad2(hours) + 'h';
    if (minutesEl) minutesEl.textContent = pad2(minutes) + 'm';
    if (secondsEl) secondsEl.textContent = pad2(seconds) + 's';
  }

  function tick() {
    var raw = inputEl ? inputEl.value : '';
    if (!raw) { renderEmpty(); return; }
    var target = parseTarget(raw);
    if (!target) { renderEmpty(); return; }
    var diff = target.getTime() - Date.now();
    if (diff <= 0) { renderPast(); return; }
    renderCountdown(diff);
  }

  // -------- URL state --------
  function readUrlTarget() {
    try {
      var p = new URLSearchParams(window.location.search);
      // If the user lands on `?target=&target=foo` (or similar
      // repeat-key URL), URLSearchParams.get returns the FIRST value,
      // which would silently drop the user's actual intent. Walk all
      // values and pick the first non-empty one.
      if (!p.has('target')) return null;
      var all = p.getAll('target');
      for (var i = 0; i < all.length; i++) {
        if (all[i] !== '') return all[i];
      }
      // All values are empty — treat as no target (let LS fallback).
      return null;
    } catch (_) {
      return null;
    }
  }

  function writeUrlTarget(v) {
    try {
      var p = new URLSearchParams(window.location.search);
      if (v) { p.set('target', v); } else { p.delete('target'); }
      var qs = p.toString();
      var url = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
      window.history.replaceState(null, '', url);
    } catch (_) { /* iframe sandboxed — ignore */ }
  }

  // -------- Init --------
  // URL state wins over localStorage (ROQ-3). localStorage wins over empty state.
  function init() {
    var urlVal = readUrlTarget();
    var lsVal = readStorage();

    if (urlVal != null && urlVal !== '') {
      var parsed = parseTarget(urlVal);
      if (parsed && inputEl) {
        inputEl.value = urlVal;
      } else if (inputEl) {
        inputEl.value = '';
        // Malformed URL target — fall back to localStorage, then empty.
        // Sync the URL to whatever we end up showing so the address bar
        // doesn't carry a stale `?target=garbage` that disagrees with
        // the visible input.
        if (typeof console !== 'undefined' && console.info) {
          console.info('Exam Countdown: malformed URL target — falling back to localStorage');
        }
        if (lsVal && parseTarget(lsVal) && inputEl) {
          inputEl.value = lsVal;
          writeUrlTarget(lsVal);
        } else {
          clearStorage();
          writeUrlTarget(null);
        }
      }
    } else if (lsVal) {
      var parsedLs = parseTarget(lsVal);
      if (parsedLs && inputEl) {
        inputEl.value = lsVal;
        // No URL state — seed the URL so the picked date is shareable.
        writeUrlTarget(lsVal);
      } else {
        clearStorage();
        if (inputEl) inputEl.value = '';
      }
    } else {
      if (inputEl) inputEl.value = '';
    }
  }

  // -------- Events --------
  function onInputChange() {
    var raw = inputEl ? inputEl.value : '';
    if (!raw) {
      clearStorage();
      writeUrlTarget(null);
      renderEmpty();
      return;
    }
    var parsed = parseTarget(raw);
    if (!parsed) {
      // Unparseable — clear storage, leave URL alone
      clearStorage();
      return;
    }
    writeStorage(raw);
    writeUrlTarget(raw);
    tick();
  }

  function onClear() {
    if (inputEl) inputEl.value = '';
    clearStorage();
    writeUrlTarget(null);
    renderEmpty();
    if (inputEl) inputEl.focus();
  }

  function onKeydown(ev) {
    var target = ev.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
      return;
    }
    var k = ev.key;
    if (k === 't' || k === 'T') {
      ev.preventDefault();
      if (inputEl) inputEl.focus();
    } else if (k === 'c' || k === 'C') {
      ev.preventDefault();
      onClear();
    }
  }

  function wire() {
    if (inputEl) {
      // Use `change` only — datetime-local fires `input` on every
      // keystroke and `change` on commit (blur or value-finalize);
      // `change` always follows `input`, so binding both would run
      // onInputChange twice (double storage write, double
      // history.replaceState, double tick).
      inputEl.addEventListener('change', onInputChange);
    }
    if (clearBtn) clearBtn.addEventListener('click', onClear);
    document.addEventListener('keydown', onKeydown);
  }

  // Story 9.19.1 — opt the datetime-local target into HT.datePicker
  // (lazy via shell-thin Proxy). The picker's onSelect writes back to
  // input.value via the standard `change` event flow, so onInputChange
  // picks it up transparently.
  if (inputEl && HT.datePicker && typeof HT.datePicker.enhance === 'function') {
    HT.datePicker.enhance(inputEl, {});
  }

  // -------- Boot --------
  init();
  wire();
  tick();
  setInterval(tick, 1000);
})();