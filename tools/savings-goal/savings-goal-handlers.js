/* ============================================
   Savings Goal — DOM wiring.
   Story 9.14 — handlers + URL state + storage.
   ============================================ */

'use strict';

(function () {
  if (typeof window === 'undefined') return;
  var core = (window.HT && window.HT.savingsGoalCore) || null;
  if (!core) return;

  var state = Object.assign({}, core.DEFAULTS);

  function $(sel) {
    return (window.HT && window.HT.$) ? window.HT.$(sel) : document.querySelector(sel);
  }

  function fmtMoney(n) {
    var sign = n < 0 ? '-' : '';
    var v = Math.abs(n);
    var s = v.toFixed(2);
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return '$' + sign + parts.join('.');
  }

  function readInputs() {
    var keys = ['target', 'months', 'starting', 'rate'];
    for (var i = 0; i < keys.length; i += 1) {
      var el = document.querySelector('[data-sg-key="' + keys[i] + '"]');
      if (el) state[keys[i]] = el.value;
    }
  }

  function applyInputs() {
    var keys = ['target', 'months', 'starting', 'rate'];
    for (var i = 0; i < keys.length; i += 1) {
      var el = document.querySelector('[data-sg-key="' + keys[i] + '"]');
      if (el) el.value = state[keys[i]];
    }
  }

  function render() {
    var result = core.compute(state);
    var monthlyEl = document.querySelector('#sg-monthly');
    var contribEl = document.querySelector('#sg-total-contrib');
    var interestEl = document.querySelector('#sg-total-interest');
    var progressEl = document.querySelector('#sg-progress');
    var pctEl = document.querySelector('#sg-pct');
    var errorsEl = document.querySelector('#sg-errors');

    if (monthlyEl) monthlyEl.textContent = fmtMoney(result.monthly);
    if (contribEl) contribEl.textContent = fmtMoney(result.totalContrib);
    if (interestEl) interestEl.textContent = fmtMoney(result.totalInterest);
    if (progressEl) {
      progressEl.value = result.starting;
      progressEl.max = result.target;
    }
    if (pctEl) pctEl.textContent = result.pctComplete.toFixed(1) + '% of ' + fmtMoney(result.target);

    if (errorsEl) {
      var errors = core.validateInputs(state);
      if (errors.length > 0) {
        errorsEl.innerHTML = '<ul class="sg-errors-list">' + errors.map(function (e) { return '<li>' + e + '</li>'; }).join('') + '</ul>';
        errorsEl.hidden = false;
      } else {
        errorsEl.hidden = true;
        errorsEl.innerHTML = '';
      }
    }
  }

  function persist() {
    if (!window.HT || !window.HT.storage) return;
    try { window.HT.storage.set('handy-tools.savings-goal.inputs', state); } catch (e) { /* ignore */ }
  }

  function loadPersisted() {
    if (!window.HT || !window.HT.storage) return null;
    try {
      var v = window.HT.storage.get('handy-tools.savings-goal.inputs');
      if (v && typeof v === 'object') return v;
    } catch (e) { /* ignore */ }
    return null;
  }

  function writeUrlState() {
    if (!window.history || !window.history.replaceState) return;
    var qs = core.encodeState(state);
    var url = (window.location.pathname || '') + '?' + qs;
    try {
      window.history.replaceState(null, '', url);
    } catch (e) { /* ignore */ }
  }

  function init() {
    var urlDecoded = core.decodeState(window.location.search || '');
    var persisted = loadPersisted();
    if (urlDecoded) {
      var r = core.resolveState(urlDecoded);
      state.target = r.target;
      state.months = r.months;
      state.starting = r.starting;
      state.rate = r.rate;
    } else if (persisted) {
      state.target = persisted.target != null ? persisted.target : core.DEFAULTS.target;
      state.months = persisted.months != null ? persisted.months : core.DEFAULTS.months;
      state.starting = persisted.starting != null ? persisted.starting : core.DEFAULTS.starting;
      state.rate = persisted.rate != null ? persisted.rate : core.DEFAULTS.rate;
    }
    applyInputs();
    render();
    wireEvents();
    wireShortcuts();
  }

  function onInputChange() {
    readInputs();
    render();
    persist();
    writeUrlState();
  }

  function onSampleClick() {
    Object.assign(state, core.SAMPLE);
    applyInputs();
    render();
    persist();
    writeUrlState();
  }

  function onResetClick() {
    Object.assign(state, core.DEFAULTS);
    applyInputs();
    render();
    persist();
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
    var inputs = document.querySelectorAll('[data-sg-key]');
    for (var i = 0; i < inputs.length; i += 1) {
      inputs[i].addEventListener('input', onInputChange);
    }
    var btns = document.querySelectorAll('[data-action]');
    for (var b = 0; b < btns.length; b += 1) {
      var act = btns[b].getAttribute('data-action');
      if (act === 'sample') btns[b].addEventListener('click', onSampleClick);
      else if (act === 'reset') btns[b].addEventListener('click', onResetClick);
      else if (act === 'print') btns[b].addEventListener('click', onPrintClick);
      else if (act === 'share') btns[b].addEventListener('click', onShareClick);
    }
  }

  // Keyboard shortcuts declared in tools.json shortcuts[]:
  //   s = Load sample, r = Reset, p = Print, c = Copy share URL.
  // Skip when typing in editable elements so the user's input isn't
  // hijacked. Modifiers (Ctrl/Cmd/Alt) are bypassed to avoid stomping
  // browser chords (Ctrl+P print, Cmd+S save, Cmd+R reload, etc.).
  function wireShortcuts() {
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;
    document.addEventListener('keydown', function (evt) {
      if (!evt || evt.ctrlKey || evt.metaKey || evt.altKey) return;
      var t = evt.target;
      var tag = (t && t.tagName) ? String(t.tagName).toLowerCase() : '';
      var editable = tag === 'input' || tag === 'textarea' || tag === 'select' ||
                     (t && t.isContentEditable === true);
      if (editable) return;
      var k = (typeof evt.key === 'string') ? evt.key.toLowerCase() : '';
      if (k === 's') { onSampleClick(); evt.preventDefault(); }
      else if (k === 'r') { onResetClick(); evt.preventDefault(); }
      else if (k === 'p') { onPrintClick(); evt.preventDefault(); }
      else if (k === 'c') { onShareClick(); evt.preventDefault(); }
    });
  }

  if (typeof window !== 'undefined') {
    window.savingsGoalInit = init;
  }
})();

if (typeof window !== 'undefined') {
  window.savingsGoalInit = window.savingsGoalInit || function () {};
  window.savingsGoalInit();
}