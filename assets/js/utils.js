/* ============================================
   Handy Tools — utils.js
   Shared helpers used by every tool
   ============================================ */

window.HT = window.HT || {};

HT.qs = function (sel, root) {
  return (root || document).querySelector(sel);
};

HT.qsa = function (sel, root) {
  return Array.from((root || document).querySelectorAll(sel));
};

HT.$ = HT.qs;
HT.$$ = HT.qsa;

HT.formatNumber = function (n, opts) {
  opts = opts || {};
  var min = opts.minFractionDigits;
  var max = opts.maxFractionDigits;
  if (typeof min !== 'number') min = 0;
  if (typeof max !== 'number') max = 4;
  if (!isFinite(n)) return '—';
  return n.toLocaleString(undefined, {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  });
};

HT.formatDuration = function (ms) {
  var sign = ms < 0 ? '-' : '';
  var abs = Math.abs(Math.round(ms / 1000));
  var days = Math.floor(abs / 86400);
  var hours = Math.floor((abs % 86400) / 3600);
  var minutes = Math.floor((abs % 3600) / 60);
  var seconds = abs % 60;
  var parts = [];
  if (days) parts.push(days + 'd');
  if (hours || days) parts.push(hours + 'h');
  if (minutes || hours || days) parts.push(minutes + 'm');
  parts.push(seconds + 's');
  return sign + parts.join(' ');
};

HT.formatDurationHMS = function (ms) {
  var abs = Math.abs(Math.round(ms / 1000));
  var h = Math.floor(abs / 3600);
  var m = Math.floor((abs % 3600) / 60);
  var s = abs % 60;
  var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
  return pad(h) + ':' + pad(m) + ':' + pad(s);
};

HT.debounce = function (fn, ms) {
  var t;
  return function () {
    var args = arguments, ctx = this;
    clearTimeout(t);
    t = setTimeout(function () { fn.apply(ctx, args); }, ms);
  };
};

/* ---------- Toast ---------- */

HT.toast = function (msg, ms) {
  ms = ms || 1800;
  var container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  var el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(function () {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.2s';
    setTimeout(function () { el.remove(); }, 200);
  }, ms);
};

/* ---------- Clipboard ---------- */

HT.copyToClipboard = function (text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(function () {
      HT.toast('Copied to clipboard');
    }).catch(function () {
      HT.fallbackCopy(text);
    });
  }
  HT.fallbackCopy(text);
  return Promise.resolve();
};

HT.fallbackCopy = function (text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); HT.toast('Copied to clipboard'); }
  catch (e) { HT.toast('Copy failed'); }
  ta.remove();
};

/* ---------- LocalStorage wrapper (Story 1.10) ----------
   Delegates to HT.storageRegistry, which is the single source of truth
   for every localStorage key the site reads or writes (AD-6). The
   registry must be loaded by assets/js/storage-registry.js BEFORE
   utils.js; the script-order contract is enforced by shell-template.py
   (chrome.html includes storage-registry.js first). */

HT.storage = {
  // Review finding (verification-gap): the dispatch layer used to throw
  // synchronously when the registry wasn't loaded. That's a hard
  // top-of-script TypeError on any future script reorder — confusing
  // for whoever debugs it. We now log ONE console.error on the first
  // failed call and return a safe noop fallback (fallback for get,
  // false for set/remove, empty array for list/keys, no-op for clear).
  // Subsequent calls stay silent (the diagnostic already fired). The
  // production fix is the same: storage-registry.js must precede utils.js
  // — shell-template.py enforces this; this fallback just makes the
  // failure mode debuggable instead of catastrophic.
  _warned: false,
  _guard: function (op) {
    if (window.HT && window.HT.storageRegistry) return false;
    if (!HT.storage._warned) {
      HT.storage._warned = true;
      console.error(
        'HT.storage.' + op + ': registry not loaded — storage-registry.js must precede utils.js. ' +
        'Subsequent calls will silently noop until the registry boots.'
      );
    }
    return true;
  },
  get: function (key, fallback) {
    if (HT.storage._guard('get')) return fallback;
    return window.HT.storageRegistry.get(key, fallback);
  },
  set: function (key, value) {
    if (HT.storage._guard('set')) return false;
    return window.HT.storageRegistry.set(key, value);
  },
  remove: function (key) {
    if (HT.storage._guard('remove')) return false;
    return window.HT.storageRegistry.remove(key);
  },
  list: function () {
    if (HT.storage._guard('list')) return [];
    return window.HT.storageRegistry.list();
  },
  keys: function () {
    if (HT.storage._guard('keys')) return [];
    return window.HT.storageRegistry.keys();
  },
  clear: function () {
    if (HT.storage._guard('clear')) return;
    return window.HT.storageRegistry.clear();
  }
};

/* ---------- Audio beep helper (used by timer/pomodoro) ---------- */

HT.beep = function (duration, freq) {
  duration = duration || 0.25;
  freq = freq || 880;
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    var ctx = new AC();
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    o.stop(ctx.currentTime + duration + 0.02);
    setTimeout(function () { ctx.close().catch(function () {}); }, (duration + 0.1) * 1000);
  } catch (e) { /* ignore */ }
};

HT.chime = function () {
  HT.beep(0.18, 880);
  setTimeout(function () { HT.beep(0.18, 1175); }, 200);
  setTimeout(function () { HT.beep(0.3, 1568); }, 400);
};

/* ---------- Random helpers ---------- */

HT.randomInt = function (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

HT.uid = function () {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
};

/* ---------- Date helpers ---------- */

HT.isLeapYear = function (year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
};

HT.daysInMonth = function (year, month) {
  return new Date(year, month + 1, 0).getDate();
};

HT.formatDate = function (d) {
  if (!(d instanceof Date) || isNaN(d)) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric'
  });
};

HT.formatDateShort = function (d) {
  if (!(d instanceof Date) || isNaN(d)) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric'
  });
};

/* ---------- Tabs helper ---------- */

HT.makeTabs = function (container, onChange) {
  HT.qsa('.tab', container).forEach(function (tab) {
    tab.addEventListener('click', function () {
      HT.qsa('.tab', container).forEach(function (t) { t.classList.remove('is-active'); });
      tab.classList.add('is-active');
      var target = tab.getAttribute('data-tab');
      // Panels are typically siblings of the tabs container, not descendants,
      // so search document-wide. (Both selectors are still respected.)
      HT.qsa('[data-tab-panel]').forEach(function (p) {
        p.style.display = p.getAttribute('data-tab-panel') === target ? '' : 'none';
      });
      if (onChange) onChange(target);
    });
  });
};
