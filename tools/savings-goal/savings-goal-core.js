/* ============================================
   Savings Goal — pure math + URL state.
   Story 9.14 — frozen HT.savingsGoalCore export.
   ============================================ */

'use strict';

(function () {
  var DEFAULTS = {
    target: 10000,
    months: 24,
    starting: 1000,
    rate: 2.5
  };

  var SAMPLE = {
    target: 12000,
    months: 24,
    starting: 2000,
    rate: 2.5
  };

  function num(v, fallback) {
    var n = parseFloat(v);
    if (!isFinite(n)) return fallback != null ? fallback : 0;
    if (n < 0) return fallback != null ? fallback : 0;
    return n;
  }

  function validateInputs(inputs) {
    var errors = [];
    if (!inputs || typeof inputs !== 'object') {
      return ['Inputs are required'];
    }
    var target = num(inputs.target);
    var months = num(inputs.months);
    var starting = num(inputs.starting);
    var rate = num(inputs.rate);
    if (target <= 0) errors.push('Target must be greater than 0');
    if (months < 1) errors.push('Deadline must be at least 1 month');
    if (starting < 0) errors.push('Starting balance cannot be negative');
    if (rate < 0) errors.push('Rate must be ≥ 0');
    return errors;
  }

  function compute(inputs) {
    var inp = inputs || {};
    var target = num(inp.target, DEFAULTS.target);
    var months = Math.max(1, Math.round(num(inp.months, DEFAULTS.months)));
    var starting = num(inp.starting, DEFAULTS.starting);
    var rate = num(inp.rate, DEFAULTS.rate);

    var monthly = 0;
    var totalContrib = 0;
    var totalInterest = 0;
    var pctComplete = target > 0 ? (starting / target) * 100 : 0;
    pctComplete = Math.max(0, Math.min(100, pctComplete));

    if (target > 0 && months > 0) {
      var r = (rate / 100) / 12;
      var n = months;
      if (r === 0) {
        monthly = (target - starting) / n;
        if (monthly < 0) monthly = 0;
        totalContrib = monthly * n;
        totalInterest = 0;
      } else {
        var compound = Math.pow(1 + r, n);
        var fvStarting = starting * compound;
        var annuity = (compound - 1) / r;
        var numerator = target - fvStarting;
        monthly = annuity > 0 ? numerator / annuity : 0;
        if (monthly < 0) monthly = 0;
        totalContrib = monthly * n;
        totalInterest = (monthly * n + starting) - target;
        // Surface shortfall as negative interest rather than clamping to 0.
      }
    }

    return {
      target: target,
      months: months,
      starting: starting,
      rate: rate,
      monthly: monthly,
      totalContrib: totalContrib,
      totalInterest: totalInterest,
      pctComplete: pctComplete,
      isValid: validateInputs(inp).length === 0
    };
  }

  function encodeState(inputs) {
    var inp = inputs || {};
    var parts = [];
    if (inp.target != null) parts.push('target=' + encodeURIComponent(inp.target));
    if (inp.months != null) parts.push('months=' + encodeURIComponent(inp.months));
    if (inp.starting != null) parts.push('starting=' + encodeURIComponent(inp.starting));
    if (inp.rate != null) parts.push('rate=' + encodeURIComponent(inp.rate));
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
    if (params.target == null && params.months == null && params.starting == null && params.rate == null) return null;
    return {
      target: params.target != null ? params.target : null,
      months: params.months != null ? params.months : null,
      starting: params.starting != null ? params.starting : null,
      rate: params.rate != null ? params.rate : null
    };
  }

  function resolveState(decoded) {
    if (!decoded || typeof decoded !== 'object') {
      return Object.assign({}, DEFAULTS);
    }
    return {
      target: num(decoded.target, DEFAULTS.target),
      months: Math.max(1, Math.round(num(decoded.months, DEFAULTS.months))),
      starting: num(decoded.starting, DEFAULTS.starting),
      rate: num(decoded.rate, DEFAULTS.rate)
    };
  }

  var core = {
    DEFAULTS: DEFAULTS,
    SAMPLE: SAMPLE,
    compute: compute,
    validateInputs: validateInputs,
    encodeState: encodeState,
    decodeState: decodeState,
    resolveState: resolveState
  };

  if (typeof window !== 'undefined') {
    window.HT = window.HT || {};
    Object.freeze(core);
    window.HT.savingsGoalCore = core;
  }
})();