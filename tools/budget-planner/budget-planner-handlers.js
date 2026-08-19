/* ============================================
   Budget Planner — DOM wiring.
   Story 9.13 — handlers + URL state + storage.
   ============================================ */

'use strict';

(function () {
  if (typeof window === 'undefined') return;
  var core = (window.HT && window.HT.budgetPlannerCore) || null;
  if (!core) return;

  var state = {
    income: 0,
    categories: core.DEFAULT_CATEGORIES.map(function (c) { return Object.assign({}, c); })
  };

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

  function readIncome() {
    var el = document.querySelector('[data-bp-key="income"]');
    if (el && el.value !== '') {
      state.income = el.value;
    }
  }

  function readCategories() {
    var rows = document.querySelectorAll('[data-bp-cat-row]');
    var next = [];
    for (var i = 0; i < rows.length; i += 1) {
      var row = rows[i];
      var id = row.getAttribute('data-bp-cat-row');
      var nameEl = row.querySelector('[data-bp-cat-name]');
      var amountEl = row.querySelector('[data-bp-cat-amount]');
      var name = nameEl ? nameEl.value : 'Category';
      var amount = amountEl ? amountEl.value : 0;
      next.push({ id: id, name: name, amount: amount });
    }
    state.categories = next;
  }

  function renderRows() {
    var body = document.querySelector('#bp-rows');
    if (!body) return;
    var html = '';
    for (var i = 0; i < state.categories.length; i += 1) {
      var c = state.categories[i];
      html += '<tr data-bp-cat-row="' + c.id + '">';
      html += '<td class="bp-cell-name"><input class="input" data-bp-cat-name type="text" value="' + escapeAttr(c.name) + '" aria-label="Category name"></td>';
      html += '<td class="bp-cell-amount"><span class="bp-dollar">$</span><input class="input bp-amount-input" data-bp-cat-amount type="number" min="0" step="any" value="' + escapeAttr(String(typeof c.amount === 'number' ? c.amount : 0)) + '" aria-label="Category amount"></td>';
      html += '<td class="bp-cell-actions"><button type="button" class="btn-icon" data-bp-delete="' + c.id + '" aria-label="Delete ' + escapeAttr(c.name) + '">×</button></td>';
      html += '</tr>';
    }
    body.innerHTML = html;
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderResult() {
    var result = core.compute(state);
    var totalEl = document.querySelector('#bp-total-expenses');
    var savingsEl = document.querySelector('#bp-savings');
    var rateEl = document.querySelector('#bp-savings-rate');
    var discEl = document.querySelector('#bp-discretionary');
    if (totalEl) totalEl.textContent = fmtMoney(result.totalExpenses);
    if (savingsEl) {
      savingsEl.textContent = fmtMoney(result.savings);
      savingsEl.setAttribute('data-sign', result.savings < 0 ? 'negative' : 'positive');
    }
    if (rateEl) rateEl.textContent = result.savingsRate.toFixed(2) + '%';
    if (discEl) {
      discEl.textContent = fmtMoney(result.discretionary);
      discEl.setAttribute('data-sign', result.discretionary < 0 ? 'negative' : 'positive');
    }
  }

  function persist() {
    if (!window.HT || !window.HT.storage) return;
    try { window.HT.storage.set('handy-tools.budget-planner.budget', state); } catch (e) { /* ignore */ }
  }

  function loadPersisted() {
    if (!window.HT || !window.HT.storage) return null;
    try {
      var v = window.HT.storage.get('handy-tools.budget-planner.budget');
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

  function readUrlState() {
    var decoded = core.decodeState(window.location.search || '');
    var resolved = core.resolveState(decoded);
    state.income = resolved.income;
    state.categories = resolved.categories;
  }

  function applyIncome() {
    var el = document.querySelector('[data-bp-key="income"]');
    if (el) el.value = state.income;
  }

  function render() {
    renderRows();
    renderResult();
    persist();
    writeUrlState();
  }

  function onIncomeChange() {
    readIncome();
    renderResult();
    persist();
    writeUrlState();
  }

  function onCategoryChange() {
    readCategories();
    renderResult();
    persist();
    writeUrlState();
  }

  function onDeleteClick(evt) {
    var t = evt.currentTarget || evt.target;
    if (!t || !t.getAttribute) return;
    var id = t.getAttribute('data-bp-delete');
    if (!id) return;
    state.categories = state.categories.filter(function (c) { return c.id !== id; });
    render();
  }

  function onAddClick() {
    state = core.addCategory(state, 'New category');
    render();
  }

  function onSampleClick() {
    state.income = core.SAMPLE.income;
    state.categories = core.SAMPLE.categories.map(function (c) { return Object.assign({}, c); });
    applyIncome();
    render();
  }

  function onResetClick() {
    state.income = 0;
    state.categories = core.DEFAULT_CATEGORIES.map(function (c) { return Object.assign({}, c); });
    applyIncome();
    render();
  }

  function onPrintClick() {
    if (typeof window.print === 'function') window.print();
  }

  function onShareClick() {
    if (!navigator.clipboard || !navigator.clipboard.writeText) return;
    var url = window.location.href;
    navigator.clipboard.writeText(url).then(function () {
      if (window.HT && window.HT.toast) window.HT.toast('Copied share URL');
    }).catch(function () {});
  }

  function wireEvents() {
    var incomeEl = document.querySelector('[data-bp-key="income"]');
    if (incomeEl) incomeEl.addEventListener('input', onIncomeChange);

    var body = document.querySelector('#bp-rows');
    if (body) {
      body.addEventListener('input', onCategoryChange);
      body.addEventListener('click', function (evt) {
        var t = evt.target;
        if (!t || !t.getAttribute) return;
        if (t.getAttribute('data-bp-delete')) {
          onDeleteClick(evt);
        }
      });
    }

    var addBtn = document.querySelector('[data-action="add"]');
    if (addBtn) addBtn.addEventListener('click', onAddClick);

    var btns = document.querySelectorAll('[data-action]');
    for (var i = 0; i < btns.length; i += 1) {
      var b = btns[i];
      var act = b.getAttribute('data-action');
      if (act === 'add') continue;
      if (act === 'sample') b.addEventListener('click', onSampleClick);
      else if (act === 'reset') b.addEventListener('click', onResetClick);
      else if (act === 'print') b.addEventListener('click', onPrintClick);
      else if (act === 'share') b.addEventListener('click', onShareClick);
    }

    // Keyboard shortcuts declared in tools.json shortcuts[]:
    //   s = Load sample, r = Reset, p = Print, c = Copy share URL.
    // Skip when typing in editable elements so the user's input isn't
    // hijacked. Modifiers (Ctrl/Cmd/Alt) are bypassed to avoid stomping
    // browser chords (Ctrl+P print, Cmd+S save, etc.).
    if (typeof document.addEventListener === 'function') {
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
  }

  function init() {
    var urlDecoded = core.decodeState(window.location.search || '');
    var persisted = loadPersisted();
    if (urlDecoded) {
      var r = core.resolveState(urlDecoded);
      state.income = r.income;
      state.categories = r.categories;
    } else if (persisted) {
      state.income = persisted.income || 0;
      state.categories = Array.isArray(persisted.categories) ? persisted.categories : core.DEFAULT_CATEGORIES.map(function (c) { return Object.assign({}, c); });
    } else {
      readUrlState();
    }
    applyIncome();
    renderRows();
    renderResult();
    wireEvents();
  }

  if (typeof window !== 'undefined') {
    window.budgetPlannerInit = init;
  }
})();