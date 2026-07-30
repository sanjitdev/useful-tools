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

/* ---------- LocalStorage wrapper ---------- */

HT.storage = {
  get: function (key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) { return fallback; }
  },
  set: function (key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  },
  remove: function (key) {
    try { localStorage.removeItem(key); } catch (e) {}
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
      HT.qsa('[data-tab-panel]', container).forEach(function (p) {
        p.style.display = p.getAttribute('data-tab-panel') === target ? '' : 'none';
      });
      if (onChange) onChange(target);
    });
  });
};
