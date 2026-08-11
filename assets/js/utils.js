/* ============================================
   Handy Tools — utils.js
   Shared helpers used by every tool
   ============================================ */

window.HT = window.HT || {};

HT.qs = (sel, root) => (root || document).querySelector(sel);

HT.qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));

HT.$ = HT.qs;
HT.$$ = HT.qsa;

HT.formatNumber = (n, opts) => {
  const min = (opts && typeof opts.minFractionDigits === 'number') ? opts.minFractionDigits : 0;
  const max = (opts && typeof opts.maxFractionDigits === 'number') ? opts.maxFractionDigits : 4;
  if (!isFinite(n)) return '—';
  return n.toLocaleString(undefined, {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  });
};

HT.formatDuration = (ms) => {
  const sign = ms < 0 ? '-' : '';
  const abs = Math.abs(Math.round(ms / 1000));
  const days = Math.floor(abs / 86400);
  const hours = Math.floor((abs % 86400) / 3600);
  const minutes = Math.floor((abs % 3600) / 60);
  const seconds = abs % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours || days) parts.push(`${hours}h`);
  if (minutes || hours || days) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return sign + parts.join(' ');
};

HT.formatDurationHMS = (ms) => {
  const abs = Math.abs(Math.round(ms / 1000));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

HT.debounce = (fn, ms) => {
  let t;
  return function () {
    const args = arguments;
    const ctx = this;
    clearTimeout(t);
    t = setTimeout(() => fn.apply(ctx, args), ms);
  };
};

/* ---------- Toast ---------- */

HT.toast = (msg, ms) => {
  const lifetime = ms || 1800;
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.2s';
    setTimeout(() => { el.remove(); }, 200);
  }, lifetime);
};

/* ---------- Clipboard ---------- */

HT.copyToClipboard = (text) => {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(() => {
      HT.toast('Copied to clipboard');
    }).catch(() => {
      HT.fallbackCopy(text);
    });
  }
  HT.fallbackCopy(text);
  return Promise.resolve();
};

HT.fallbackCopy = (text) => {
  const ta = document.createElement('textarea');
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
  _guard: (op) => {
    if (window.HT && window.HT.storageRegistry) return false;
    if (!HT.storage._warned) {
      HT.storage._warned = true;
      console.error(
        `HT.storage.${op}: registry not loaded — storage-registry.js must precede utils.js. ` +
        'Subsequent calls will silently noop until the registry boots.'
      );
    }
    return true;
  },
  get: (key, fallback) => {
    if (HT.storage._guard('get')) return fallback;
    return window.HT.storageRegistry.get(key, fallback);
  },
  set: (key, value) => {
    if (HT.storage._guard('set')) return false;
    return window.HT.storageRegistry.set(key, value);
  },
  remove: (key) => {
    if (HT.storage._guard('remove')) return false;
    return window.HT.storageRegistry.remove(key);
  },
  list: () => {
    if (HT.storage._guard('list')) return [];
    return window.HT.storageRegistry.list();
  },
  keys: () => {
    if (HT.storage._guard('keys')) return [];
    return window.HT.storageRegistry.keys();
  },
  clear: () => {
    if (HT.storage._guard('clear')) return;
    return window.HT.storageRegistry.clear();
  }
};

/* ---------- Audio beep helper (used by timer/pomodoro) ---------- */

HT.beep = (duration, freq) => {
  const dur = duration || 0.25;
  const f = freq || 880;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.stop(ctx.currentTime + dur + 0.02);
    setTimeout(() => { ctx.close().catch(() => {}); }, (dur + 0.1) * 1000);
  } catch (e) { /* ignore */ }
};

HT.chime = () => {
  HT.beep(0.18, 880);
  setTimeout(() => { HT.beep(0.18, 1175); }, 200);
  setTimeout(() => { HT.beep(0.3, 1568); }, 400);
};

/* ---------- Random helpers ---------- */

HT.randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

HT.uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/* ---------- Date helpers ---------- */

HT.isLeapYear = (year) => (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);

HT.daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

HT.formatDate = (d) => {
  if (!(d instanceof Date) || isNaN(d)) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric'
  });
};

HT.formatDateShort = (d) => {
  if (!(d instanceof Date) || isNaN(d)) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric'
  });
};

/* ---------- Tabs helper ---------- */

HT.makeTabs = (container, onChange) => {
  HT.qsa('.tab', container).forEach((tab) => {
    tab.addEventListener('click', () => {
      HT.qsa('.tab', container).forEach((t) => { t.classList.remove('is-active'); });
      tab.classList.add('is-active');
      const target = tab.getAttribute('data-tab');
      // Panels are typically siblings of the tabs container, not descendants,
      // so search document-wide. (Both selectors are still respected.)
      HT.qsa('[data-tab-panel]').forEach((p) => {
        p.style.display = p.getAttribute('data-tab-panel') === target ? '' : 'none';
      });
      if (onChange) onChange(target);
    });
  });
};
