/* Date Picker Lab — standalone test page for the new HT.datePickerV2
   module (Phase 2 of the date-picker rewrite plan).

   Layout: three input rows (date, time, datetime-local), each with a
   "native" column (browser picker, no JS) and a "lab" column
   (HT.datePickerV2). Below them, an event log that records every
   focus / blur / change / open / close / key event across all
   inputs — the easiest way to see whether the picker re-opens itself
   after close (the hotfix-5 bug class).

   The lab page is also reachable from the "Lab" menu entry added to
   the site header (visible only on pages that load shell-thin.js).
   It is still intentionally NOT in tools.json so it does not appear
   in the home grid, palette search hits, or embed catalog — search
   would expose it as a developer surface rather than a user tool. */

'use strict';

// =============================================================
// helpers — defined at top so all IIFEs below can share them.
// =============================================================

function labLog(kind, msg) {
  const log = document.getElementById('lab-log');
  if (!log) return;
  const line = document.createElement('div');
  line.className = 'lab-log-line lab-log-line--' + kind;
  const t = new Date();
  const hh = String(t.getHours()).padStart(2, '0');
  const mm = String(t.getMinutes()).padStart(2, '0');
  const ss = String(t.getSeconds()).padStart(2, '0');
  const ms = String(t.getMilliseconds()).padStart(3, '0');
  line.textContent = '[' + hh + ':' + mm + ':' + ss + '.' + ms + '] ' + msg;
  log.appendChild(line);
  // Cap at 200 lines so the log doesn't grow unbounded.
  while (log.childNodes.length > 200) log.removeChild(log.firstChild);
  log.scrollTop = log.scrollHeight;
}

function labRefresh() {
  const ta = document.getElementById('lab-result-ta');
  if (!ta) return;
  const get = function (id) {
    const el = document.getElementById(id);
    return el ? (el.value || '∅') : '∅';
  };
  ta.textContent =
    'date: ' + get('lab-native-date') + ' | ' + get('lab-v2-date') + '\n' +
    'time: ' + get('lab-native-time') + ' | ' + get('lab-v2-time') + '\n' +
    'datetime: ' + get('lab-native-datetime') + ' | ' + get('lab-v2-datetime');
}

function labAttachInputLog(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('focus', function () {
    labLog('focus', '[input] focus ' + id + ' value=' + JSON.stringify(el.value));
  });
  el.addEventListener('blur', function () {
    labLog('focus', '[input] blur  ' + id + ' value=' + JSON.stringify(el.value));
  });
  el.addEventListener('input', function () {
    labLog('change', '[input] input ' + id + ' value=' + JSON.stringify(el.value));
    labRefresh();
  });
  el.addEventListener('change', function () {
    labLog('change', '[input] change ' + id + ' value=' + JSON.stringify(el.value));
    labRefresh();
  });
  el.addEventListener('keydown', function (ev) {
    labLog('key', '[input] keydown ' + id + ' key=' + ev.key);
  });
}

// =============================================================
// 1. input event loggers — fire for ALL six inputs whether or
//    not the picker ever loads. Pure DOM listeners, no globals.
// =============================================================

['lab-native-date', 'lab-native-time', 'lab-native-datetime',
 'lab-v2-date', 'lab-v2-time', 'lab-v2-datetime'].forEach(labAttachInputLog);

// =============================================================
// 2. action button wiring — uses HT.datePickerV2.openById /
//    closeById which the shell-thin Proxy stub already proxies
//    through lazy-load. So we don't need any polling or
//    readiness check here; the Proxy returns a Promise that
//    resolves once the real API is installed (and rejects if
//    install fails — we log that).
// =============================================================

document.getElementById('lab-clear-log')?.addEventListener('click', function () {
  const log = document.getElementById('lab-log');
  if (log) while (log.firstChild) log.removeChild(log.firstChild);
  labLog('focus', '[ui] log cleared');
});

document.getElementById('lab-clear-values')?.addEventListener('click', function () {
  ['lab-native-date', 'lab-native-time', 'lab-native-datetime',
   'lab-v2-date', 'lab-v2-time', 'lab-v2-datetime'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  labRefresh();
  labLog('change', '[ui] all input values cleared');
});

document.getElementById('lab-preset-today')?.addEventListener('click', function () {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const today = yyyy + '-' + mm + '-' + dd;
  const iso = today + 'T12:00';
  ['lab-native-date', 'lab-v2-date'].forEach(function (id) {
    const el = document.getElementById(id); if (el) el.value = today;
  });
  ['lab-native-time', 'lab-v2-time'].forEach(function (id) {
    const el = document.getElementById(id); if (el) el.value = '12:00';
  });
  ['lab-native-datetime', 'lab-v2-datetime'].forEach(function (id) {
    const el = document.getElementById(id); if (el) el.value = iso;
  });
  labRefresh();
  labLog('change', '[ui] preset applied: today=' + today + ' time=12:00');
});

['lab-v2-date', 'lab-v2-time', 'lab-v2-datetime'].forEach(function (id) {
  const openBtn = document.querySelector('[data-lab-open="' + id + '"]');
  const closeBtn = document.querySelector('[data-lab-close="' + id + '"]');
  if (openBtn) {
    openBtn.addEventListener('click', function () {
      const api = window.HT && window.HT.datePickerV2;
      if (!api) { labLog('err', '[ui] HT.datePickerV2 is not loaded'); return; }
      // Defensive: the api could be the shell-thin Proxy stub (in
      // which case openById is a function that triggers the
      // lazy-load + dispatch chain) or the real frozen public API
      // (which has openById as a direct method). If openById is
      // missing or non-function, log and bail instead of letting a
      // synchronous TypeError bubble to the console.
      if (typeof api.openById !== 'function') {
        labLog('err', '[ui] api.openById is not a function (api type = ' +
          (typeof api) + ', keys = ' + (api && typeof api === 'object' ?
            Object.keys(api).join(',') : 'n/a') + ')');
        return;
      }
      Promise.resolve(api.openById(id)).then(
        function () { labLog('open', '[ui] openById(' + id + ') ok'); },
        function (err) { labLog('err', '[ui] openById(' + id + ') failed: ' + (err && err.message)); }
      );
    });
  }
  if (closeBtn) {
    closeBtn.addEventListener('click', function () {
      const api = window.HT && window.HT.datePickerV2;
      if (!api) { labLog('err', '[ui] HT.datePickerV2 is not loaded'); return; }
      if (typeof api.closeById !== 'function') {
        labLog('err', '[ui] api.closeById is not a function (api type = ' +
          (typeof api) + ', keys = ' + (api && typeof api === 'object' ?
            Object.keys(api).join(',') : 'n/a') + ')');
        return;
      }
      Promise.resolve(api.closeById(id)).then(
        function () { labLog('close', '[ui] closeById(' + id + ') ok'); },
        function (err) { labLog('err', '[ui] closeById(' + id + ') failed: ' + (err && err.message)); }
      );
    });
  }
});

// Initial render.
labRefresh();
labLog('focus', '[boot] date-picker-lab ready');

// =============================================================
// 3. Picker enhancement — one shot. We call the stub directly;
//    the stub returns a Promise that resolves once the real
//    API is installed. No polling. The recursion hazard
//    described in the smoke harness notes doesn't happen here
//    because the Proxy stub is called EXACTLY ONCE — the
//    resolved Promise's value is the real `enhance` method.
// =============================================================

(function enhanceLabInputs() {
  function doEnhance() {
    const api = window.HT && window.HT.datePickerV2;
    if (!api) {
      labLog('err', '[pickup] HT.datePickerV2 missing — picker module did not load');
      return;
    }
    if (typeof api.enhance !== 'function') {
      labLog('err', '[pickup] HT.datePickerV2.enhance is not a function');
      return;
    }
    try {
      ['lab-v2-date', 'lab-v2-time', 'lab-v2-datetime'].forEach(function (id) {
        const el = document.getElementById(id);
        if (!el) return;
        api.enhance(el, {
          onOpen: function (input) { labLog('open', '[picker] open ' + input.id); },
          onClose: function (input) { labLog('close', '[picker] close ' + input.id + ' value=' + JSON.stringify(input.value)); },
          onSelect: function (input, value) {
            labLog('change', '[picker] select ' + input.id + ' value=' + JSON.stringify(value));
            labRefresh();
          },
        });
      });
      labLog('open', '[pickup] HT.datePickerV2 loaded — lab inputs enhanced');
    } catch (err) {
      labLog('err', '[pickup] enhance failed: ' + (err && err.message ? err.message : String(err)));
    }
  }

  // Fire one stub call. The shell-thin Proxy returns a function
  // for any property access; calling it triggers lazy-load +
  // dispatch. We use isOpenById because it's idempotent
  // (returns false before any enhance() and false after).
  function bootstrap() {
    const stub = window.HT && window.HT.datePickerV2 && window.HT.datePickerV2.isOpenById;
    if (typeof stub !== 'function') {
      // Shell-thin.js hasn't installed the stub yet — wait one
      // tick and try again. Bounded so we never spin.
      if (bootstrap.tries++ < 50) setTimeout(bootstrap, 20);
      else labLog('err', '[pickup] shell-thin Proxy did not install');
      return;
    }
    let r;
    try { r = stub(); } catch (err) {
      labLog('err', '[pickup] isOpenById() threw synchronously: ' + (err && err.message));
      return;
    }
    if (r && typeof r.then === 'function') {
      r.then(doEnhance, function (err) {
        labLog('err', '[pickup] lazy-load failed: ' + (err && err.message));
      });
    } else {
      // Synchronous API already installed (rare — only if all
      // sub-modules finished before this script ran).
      doEnhance();
    }
  }
  bootstrap.tries = 0;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();