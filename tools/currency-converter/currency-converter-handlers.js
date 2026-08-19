/* ============================================
   Currency Converter — DOM wiring + fetch + cache.
   Story 9.15 — handlers + URL state + storage + live refresh.
   ============================================ */

'use strict';

// shell-bounds-check: allow api.exchangerate.host

(function () {
  if (typeof window === 'undefined') return;
  var core = (window.HT && window.HT.currencyConverterCore) || null;
  if (!core) return;

  var state = Object.assign({}, core.DEFAULTS);
  var BASELINE_RATES = null;
  var currentRates = null;
  var fetchedAt = null;
  var DEBOUNCE_MS = 60 * 60 * 1000; // 60 minutes

  var LAST_CODES_KEY = 'handy-tools.currency-converter.last-codes';

  function $(sel) {
    return (window.HT && window.HT.$) ? window.HT.$(sel) : document.querySelector(sel);
  }

  function fmtMoney(n, code) {
    var v = Number(n);
    if (!isFinite(v)) return '—';
    var s = v.toFixed(4);
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    var out = parts.join('.');
    return (code || '') + ' ' + out;
  }

  function loadBaselineSync() {
    // The baseline is injected into the page via a <script id="fx-baseline">
    // block (canonical structured-clone pattern). If not found, fall back
    // to a minimal USD-only set.
    var el = document.getElementById('fx-baseline');
    if (el) {
      try { return JSON.parse(el.textContent || '{}'); } catch (e) { /* ignore */ }
    }
    return {
      base: 'USD',
      fetchedAt: '2026-08-17T00:00:00Z',
      source: 'inline-fallback',
      rates: { USD: 1.0, EUR: 0.918, GBP: 0.789, JPY: 152.34 }
    };
  }

  function loadLastCodes() {
    if (!window.HT || !window.HT.storage) return null;
    try {
      var v = window.HT.storage.get(LAST_CODES_KEY);
      if (v && typeof v === 'object' && typeof v.from === 'string' && typeof v.to === 'string') {
        return v;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function persistLastCodes() {
    if (!window.HT || !window.HT.storage) return;
    try { window.HT.storage.set(LAST_CODES_KEY, { from: state.from, to: state.to }); } catch (e) { /* ignore */ }
  }

  function applyStateToDom() {
    var amountEl = document.querySelector('[data-cc-key="amount"]');
    if (amountEl) amountEl.value = state.amount;
    var fromEl = document.querySelector('[data-cc-key="from"]');
    if (fromEl) fromEl.value = state.from;
    var toEl = document.querySelector('[data-cc-key="to"]');
    if (toEl) toEl.value = state.to;
  }

  function readStateFromDom() {
    var amountEl = document.querySelector('[data-cc-key="amount"]');
    if (amountEl && amountEl.value !== '') state.amount = amountEl.value;
    var fromEl = document.querySelector('[data-cc-key="from"]');
    if (fromEl) state.from = fromEl.value;
    var toEl = document.querySelector('[data-cc-key="to"]');
    if (toEl) state.to = toEl.value;
  }

  function render() {
    if (!currentRates) return;
    var result = core.convert(state.amount, state.from, state.to, currentRates);
    var out = document.querySelector('#cc-result');
    if (out) out.textContent = fmtMoney(result, state.to);
    var note = document.querySelector('#cc-note');
    if (note) {
      var stamp = fetchedAt ? new Date(fetchedAt).toISOString().slice(0, 16).replace('T', ' ') : 'unknown';
      note.textContent = 'Rates as of ' + stamp + ' UTC · 1 ' + state.from + ' = ' + currentRates[state.to] + ' ' + state.to;
    }
  }

  function writeUrlState() {
    if (!window.history || !window.history.replaceState) return;
    var qs = core.encodeState(state);
    var url = (window.location.pathname || '') + '?' + qs;
    try {
      window.history.replaceState(null, '', url);
    } catch (e) { /* ignore */ }
  }

  function fetchLiveRates() {
    // shell-bounds-check: allow api.exchangerate.host
    if (!window.fetch) {
      var note = document.querySelector('#cc-status');
      if (note) note.textContent = 'fetch() unavailable — using bundled baseline';
      return Promise.resolve(false);
    }
    var url = 'https://api.exchangerate.host/latest?base=USD';
    return window.fetch(url, { method: 'GET', cache: 'no-store' })
      .then(function (r) {
        if (!r || !r.ok) throw new Error('http ' + (r && r.status));
        return r.json();
      })
      .then(function (data) {
        if (!data || !data.rates || typeof data.rates !== 'object') {
          throw new Error('malformed payload');
        }
        currentRates = data.rates;
        currentRates.USD = currentRates.USD || 1.0;
        fetchedAt = data.date || new Date().toISOString();
        var note = document.querySelector('#cc-status');
        if (note) note.textContent = 'Live rates fetched · ' + fetchedAt + ' · baseline retained as fallback';
        render();
        return true;
      })
      .catch(function (err) {
        var note = document.querySelector('#cc-status');
        if (note) note.textContent = 'Live refresh failed (' + (err && err.message ? err.message : 'unknown') + ') — using bundled baseline';
        return false;
      });
  }

  function onAmountChange() {
    readStateFromDom();
    render();
    writeUrlState();
  }

  function onCurrencyChange() {
    readStateFromDom();
    persistLastCodes();
    render();
    writeUrlState();
  }

  function onRefreshClick() {
    if (!fetchedAt) {
      fetchLiveRates();
      return;
    }
    var age = Date.now() - new Date(fetchedAt).getTime();
    if (age < DEBOUNCE_MS) {
      var remaining = Math.ceil((DEBOUNCE_MS - age) / 60000);
      var note = document.querySelector('#cc-status');
      if (note) note.textContent = 'Rates are fresh — next refresh in ' + remaining + ' min';
      return;
    }
    fetchLiveRates();
  }

  function onSwapClick() {
    var t = state.from;
    state.from = state.to;
    state.to = t;
    applyStateToDom();
    persistLastCodes();
    render();
    writeUrlState();
  }

  function onPrintClick() {
    if (typeof window.print === 'function') window.print();
  }

  function onShareClick() {
    if (!navigator.clipboard || !navigator.clipboard.writeText) return;
    if (window.HT && window.HT.toast) window.HT.toast('Copied share URL');
    var url = window.location.href;
    navigator.clipboard.writeText(url).catch(function () {});
  }

  function wireEvents() {
    var amountEl = document.querySelector('[data-cc-key="amount"]');
    if (amountEl) amountEl.addEventListener('input', onAmountChange);
    var fromEl = document.querySelector('[data-cc-key="from"]');
    if (fromEl) fromEl.addEventListener('change', onCurrencyChange);
    var toEl = document.querySelector('[data-cc-key="to"]');
    if (toEl) toEl.addEventListener('change', onCurrencyChange);
    var btns = document.querySelectorAll('[data-action]');
    for (var i = 0; i < btns.length; i += 1) {
      var b = btns[i];
      var act = b.getAttribute('data-action');
      if (act === 'refresh') b.addEventListener('click', onRefreshClick);
      else if (act === 'swap') b.addEventListener('click', onSwapClick);
      else if (act === 'print') b.addEventListener('click', onPrintClick);
      else if (act === 'share') b.addEventListener('click', onShareClick);
    }
  }

  function init() {
    BASELINE_RATES = loadBaselineSync();
    currentRates = BASELINE_RATES.rates || { USD: 1.0 };
    fetchedAt = BASELINE_RATES.fetchedAt || null;

    // Populate the <select> options from the loaded rates.
    populateSelects();

    var urlDecoded = core.decodeState(window.location.search || '');
    var lastCodes = loadLastCodes();
    if (urlDecoded) {
      var r = core.resolveState(urlDecoded);
      state.amount = r.amount;
      state.from = r.from;
      state.to = r.to;
    } else if (lastCodes) {
      state.from = lastCodes.from;
      state.to = lastCodes.to;
    }
    applyStateToDom();
    wireEvents();
    render();
    writeUrlState();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function populateSelects() {
    if (!currentRates) return;
    var codes = Object.keys(currentRates).sort();
    var fromEl = document.querySelector('[data-cc-key="from"]');
    var toEl = document.querySelector('[data-cc-key="to"]');
    if (!fromEl || !toEl) return;
    var opts = '';
    for (var i = 0; i < codes.length; i += 1) {
      opts += '<option value="' + escapeHtml(codes[i]) + '">' + escapeHtml(codes[i]) + '</option>';
    }
    fromEl.innerHTML = opts;
    toEl.innerHTML = opts;
  }

  if (typeof window !== 'undefined') {
    window.currencyConverterInit = init;
  }
})();

if (typeof window !== 'undefined') {
  window.currencyConverterInit = window.currencyConverterInit || function () {};
  window.currencyConverterInit();
}