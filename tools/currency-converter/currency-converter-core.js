/* ============================================
   Currency Converter — pure math + URL state.
   Story 9.15 — frozen HT.currencyConverterCore export.
   ============================================ */

'use strict';

(function () {
  var DEFAULTS = {
    amount: 100,
    from: 'USD',
    to: 'EUR'
  };

  function num(v, f) {
    var n = parseFloat(v);
    if (!isFinite(n)) return f != null ? f : 0;
    if (n < 0) return 0;
    return n;
  }

  function convert(amount, from, to, rates) {
    if (!rates || typeof rates !== 'object') return 0;
    var rFrom = rates[from];
    var rTo = rates[to];
    if (!isFinite(rFrom) || !isFinite(rTo) || rFrom <= 0) return 0;
    var amountUsd = num(amount) / rFrom;
    return amountUsd * rTo;
  }

  function encodeState(inputs) {
    var inp = inputs || {};
    var parts = [];
    if (inp.amount != null) parts.push('amount=' + encodeURIComponent(inp.amount));
    if (inp.from) parts.push('from=' + encodeURIComponent(inp.from));
    if (inp.to) parts.push('to=' + encodeURIComponent(inp.to));
    return parts.join('&');
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
      try {
        params[decodeURIComponent(k)] = decodeURIComponent(v);
      } catch (e) { /* ignore */ }
    }
    if (params.amount == null && params.from == null && params.to == null) return null;
    return {
      amount: params.amount != null ? params.amount : null,
      from: params.from || null,
      to: params.to || null
    };
  }

  function resolveState(decoded) {
    if (!decoded || typeof decoded !== 'object') {
      return Object.assign({}, DEFAULTS);
    }
    return {
      amount: num(decoded.amount, DEFAULTS.amount),
      from: decoded.from || DEFAULTS.from,
      to: decoded.to || DEFAULTS.to
    };
  }

  var core = {
    DEFAULTS: DEFAULTS,
    convert: convert,
    encodeState: encodeState,
    decodeState: decodeState,
    resolveState: resolveState
  };

  if (typeof window !== 'undefined') {
    window.HT = window.HT || {};
    Object.freeze(core);
    window.HT.currencyConverterCore = core;
  }
})();