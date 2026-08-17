/* ============================================
   Budget Planner — pure math + URL state.
   Story 9.13 — frozen HT.budgetPlannerCore export.
   ============================================ */

'use strict';

(function () {
  var DEFAULT_CATEGORIES = [
    { id: 'cat-housing', name: 'Housing', amount: 1500 },
    { id: 'cat-food', name: 'Food', amount: 600 },
    { id: 'cat-transport', name: 'Transport', amount: 400 },
    { id: 'cat-entertainment', name: 'Entertainment', amount: 200 },
    { id: 'cat-other', name: 'Other', amount: 300 }
  ];

  var SAMPLE = {
    income: 5000,
    categories: [
      { id: 'cat-housing', name: 'Housing', amount: 1500 },
      { id: 'cat-food', name: 'Food', amount: 600 },
      { id: 'cat-transport', name: 'Transport', amount: 400 },
      { id: 'cat-entertainment', name: 'Entertainment', amount: 200 },
      { id: 'cat-other', name: 'Other', amount: 300 }
    ]
  };

  function compute(state) {
    state = state || {};
    var income = num(state.income);
    var categories = Array.isArray(state.categories) ? state.categories : [];
    var totalExpenses = 0;
    var housing = 0;
    var transport = 0;
    for (var i = 0; i < categories.length; i += 1) {
      var a = num(categories[i].amount);
      totalExpenses += a;
      if (categories[i].name === 'Housing') housing += a;
      if (categories[i].name === 'Transport') transport += a;
    }
    var savings = income - totalExpenses;
    var savingsRate = income > 0 ? (savings / income) * 100 : 0;
    var discretionary = savings - (housing + transport);
    return {
      income: income,
      totalExpenses: totalExpenses,
      savings: savings,
      savingsRate: savingsRate,
      discretionary: discretionary,
      categoryCount: categories.length
    };
  }

  function num(v) {
    var n = parseFloat(v);
    return isFinite(n) && n >= 0 ? n : 0;
  }

  function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return 'cat-' + crypto.randomUUID().slice(0, 8);
    }
    return 'cat-' + Math.random().toString(36).slice(2, 10);
  }

  function addCategory(state, name) {
    var src = state || { income: 0, categories: [] };
    var newCat = { id: uuid(), name: name || 'New category', amount: 0 };
    return { income: src.income || 0, categories: (src.categories || []).concat([newCat]) };
  }

  function removeCategory(state, id) {
    var src = state || { income: 0, categories: [] };
    return { income: src.income || 0, categories: (src.categories || []).filter(function (c) { return c.id !== id; }) };
  }

  function updateCategory(state, id, fields) {
    var src = state || { income: 0, categories: [] };
    fields = fields || {};
    var next = (src.categories || []).map(function (c) {
      if (c.id !== id) return c;
      var n = Object.assign({}, c);
      if (fields.name != null) n.name = String(fields.name);
      if (fields.amount != null) n.amount = num(fields.amount);
      return n;
    });
    return { income: src.income || 0, categories: next };
  }

  function encodeBase64(s) {
    if (typeof btoa === 'function') {
      var utf8 = unescape(encodeURIComponent(JSON.stringify(s)));
      return btoa(utf8);
    }
    return '';
  }

  function decodeBase64(s) {
    if (typeof atob === 'function') {
      try {
        var binary = atob(s);
        var json = decodeURIComponent(escape(binary));
        return JSON.parse(json);
      } catch (e) { return null; }
    }
    return null;
  }

  function encodeState(state) {
    state = state || {};
    var payload = {
      income: num(state.income),
      categories: (state.categories || []).map(function (c) {
        return { id: c.id, name: c.name, amount: num(c.amount) };
      })
    };
    return encodeBase64(payload);
  }

  function decodeState(search) {
    if (!search) return null;
    var s = search.charAt(0) === '?' ? search.slice(1) : search;
    var params = {};
    var pairs = s.split('&');
    for (var i = 0; i < pairs.length; i += 1) {
      var eq = pairs[i].indexOf('=');
      if (eq < 0) continue;
      var k = pairs[i].slice(0, eq);
      var v = pairs[i].slice(eq + 1);
      params[decodeURIComponent(k)] = decodeURIComponent(v);
    }
    if (!params.budget) return null;
    return decodeBase64(params.budget);
  }

  function resolveState(decoded) {
    if (!decoded || typeof decoded !== 'object') return { income: 0, categories: DEFAULT_CATEGORIES.map(function (c) { return Object.assign({}, c); }) };
    var income = num(decoded.income);
    var categories = Array.isArray(decoded.categories) && decoded.categories.length > 0
      ? decoded.categories.map(function (c) {
        return {
          id: c.id || uuid(),
          name: c.name || 'Category',
          amount: num(c.amount)
        };
      })
      : DEFAULT_CATEGORIES.map(function (c) { return Object.assign({}, c); });
    return { income: income, categories: categories };
  }

  var core = {
    DEFAULT_CATEGORIES: DEFAULT_CATEGORIES,
    SAMPLE: SAMPLE,
    compute: compute,
    addCategory: addCategory,
    removeCategory: removeCategory,
    updateCategory: updateCategory,
    encodeState: encodeState,
    decodeState: decodeState,
    resolveState: resolveState,
    uuid: uuid
  };

  if (typeof window !== 'undefined') {
    window.HT = window.HT || {};
    Object.freeze(core);
    window.HT.budgetPlannerCore = core;
  }
})();