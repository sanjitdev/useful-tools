/* ============================================
   Recipe Scaler — recipe-scaler-core.js (Story 4b Phase 3)
   Parse-time core: data tables (FALLBACK_FACTORS, SAMPLE_RECIPE,
   DEFAULTS), tunable constants, and the pure math layer
   (parseFraction, formatFraction, parseLine regex, tryConvert,
   clampMultiplier). Handlers reference these via HT.recipeScalerCore.

   Story 4b — see _bmad-output/implementation-artifacts/
   story-4b-per-tool-code-splitting.md
   ============================================ */

(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.HT) return;
  var HT = window.HT;

  // -------------------------------------------------------------
  // Constants
  // -------------------------------------------------------------
  var DEFAULTS = {
    multiplier: 2,
    system: 'metric',
  };
  var MULT_MIN = 0.1;
  var MULT_MAX = 100;
  var FRAC_CAP = 16;          // denominator cap per AC-5
  var SAMPLE_RECIPE = '1/2 cup flour\n2 tbsp sugar\n3 eggs\n350 °F oven\n1 pinch salt\nsalt to taste';

  // -------------------------------------------------------------
  // Hardcoded fallback (offline / file:// safe) — MUST stay
  // byte-equivalent to assets/data/unit-conversion.json.
  // -------------------------------------------------------------
  var FALLBACK_FACTORS = {
    volume: {
      base: 'ml',
      toBase: {
        cup: 236.588, tbsp: 14.787, tsp: 4.929, floz: 29.574,
        ml: 1, liter: 1000, l: 1000, pint: 473.176, quart: 946.353, gallon: 3785.41,
      },
      metric: ['ml', 'liter', 'l'],
      imperial: ['cup', 'tbsp', 'tsp', 'floz', 'pint', 'quart', 'gallon'],
    },
    mass: {
      base: 'g',
      toBase: { oz: 28.3495, lb: 453.592, g: 1, kg: 1000 },
      metric: ['g', 'kg'],
      imperial: ['oz', 'lb'],
    },
    temperature: {
      units: ['°F', '°C'],
      metric: ['°C'],
      imperial: ['°F'],
    },
  };

  // -------------------------------------------------------------
  // parseFraction (AC-1) — pure math, no DOM.
  // Accepts: '1/2', '1 1/2', '0.5', '2', '3/4', '1 3/4'.
  // Returns Number.
  // -------------------------------------------------------------
  function parseFraction(s) {
    if (s == null) return NaN;
    var str = String(s).trim();
    if (!str) return NaN;
    // Mixed number: "1 1/2"
    var mixed = str.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixed) {
      var whole = parseInt(mixed[1], 10);
      var num = parseInt(mixed[2], 10);
      var den = parseInt(mixed[3], 10);
      if (den === 0) return NaN;
      return whole + num / den;
    }
    // Pure fraction: "1/2", "3/4"
    var frac = str.match(/^(\d+)\/(\d+)$/);
    if (frac) {
      var n = parseInt(frac[1], 10);
      var d = parseInt(frac[2], 10);
      if (d === 0) return NaN;
      return n / d;
    }
    // Decimal: "0.5", "1.25"
    if (/^\d*\.\d+$/.test(str)) {
      return parseFloat(str);
    }
    // Integer: "2"
    if (/^\d+$/.test(str)) {
      return parseInt(str, 10);
    }
    return NaN;
  }

  // -------------------------------------------------------------
  // formatFraction (AC-5) — Stern-Brocot / greedy continued-
  // fraction approximation with denominator cap 16.
  // -------------------------------------------------------------
  function formatFraction(n) {
    if (!Number.isFinite(n)) return String(n);
    var EPS = 1e-9;
    if (Math.abs(n) < EPS) return n < 0 ? '-0' : '0';
    var sign = n < 0 ? '-' : '';
    var x = Math.abs(n);
    var whole = Math.floor(x);
    var frac = x - whole;
    if (frac < EPS) return sign + String(whole);
    var bestNum = 1;
    var bestDen = FRAC_CAP;
    var bestErr = Math.abs(frac - bestNum / bestDen);
    for (var d = 1; d <= FRAC_CAP; d += 1) {
      var n2 = Math.round(frac * d);
      if (n2 < 1) n2 = 1;
      if (n2 > d) n2 = d;
      var err = Math.abs(frac - n2 / d);
      if (err < bestErr) {
        bestErr = err;
        bestNum = n2;
        bestDen = d;
        if (err < EPS) break;
      }
    }
    if (whole === 0) return sign + bestNum + '/' + bestDen;
    return sign + whole + ' ' + bestNum + '/' + bestDen;
  }

  // -------------------------------------------------------------
  // parseLine (AC-1 regex) — matches "<qty> [<unit>] <ingredient>"
  // -------------------------------------------------------------
  var PARSE_LINE_RE = /^([0-9]+\s*\/\s*[0-9]+|[0-9]+(?:\s+[0-9]+\s*\/\s*[0-9]+)?|[0-9]*\.[0-9]+)(?:\s+(\S+))?\s*(.*)$/;

  function parseLine(line) {
    if (line == null) return null;
    var trimmed = String(line).trim();
    if (!trimmed) return null;
    var m = trimmed.match(PARSE_LINE_RE);
    if (!m) return null;
    var qty = parseFraction(m[1]);
    if (!Number.isFinite(qty)) return null;
    var unit = m[2] ? String(m[2]) : '';
    var ingredient = m[3] ? String(m[3]).trim() : '';
    if (!ingredient) return null;
    return { qty: qty, unit: unit, ingredient: ingredient };
  }

  // -------------------------------------------------------------
  // tryConvert (AC-3 / AC-4) — pure math, no DOM.
  // -------------------------------------------------------------
  function tryConvert(qty, fromUnit, toSystem, factors) {
    if (!factors) return null;
    if (!fromUnit) return null;
    var tempUnits = factors.temperature && factors.temperature.units;
    if (tempUnits && tempUnits.indexOf(fromUnit) >= 0) {
      var toUnit = toSystem === 'metric' ? '°C' : '°F';
      if (fromUnit === toUnit) return { qty: qty, unit: fromUnit };
      if (fromUnit === '°F' && toUnit === '°C') {
        return { qty: (qty - 32) * 5 / 9, unit: '°C' };
      }
      if (fromUnit === '°C' && toUnit === '°F') {
        return { qty: qty * 9 / 5 + 32, unit: '°F' };
      }
      return null;
    }
    if (factors.volume && factors.volume.toBase[fromUnit] != null) {
      var list = toSystem === 'metric' ? factors.volume.metric : factors.volume.imperial;
      var isAlready = list.indexOf(fromUnit) >= 0;
      var targetUnit = isAlready ? fromUnit : list[0];
      var baseQty = qty * factors.volume.toBase[fromUnit];
      var newQty = baseQty / factors.volume.toBase[targetUnit];
      return { qty: newQty, unit: targetUnit };
    }
    if (factors.mass && factors.mass.toBase[fromUnit] != null) {
      var mlist = toSystem === 'metric' ? factors.mass.metric : factors.mass.imperial;
      var misAlready = mlist.indexOf(fromUnit) >= 0;
      var mTarget = misAlready ? fromUnit : mlist[0];
      var baseG = qty * factors.mass.toBase[fromUnit];
      var mNew = baseG / factors.mass.toBase[mTarget];
      return { qty: mNew, unit: mTarget };
    }
    return null;
  }

  // -------------------------------------------------------------
  // Clamp + read multiplier — pure math.
  // -------------------------------------------------------------
  function clampMultiplier(v) {
    if (!Number.isFinite(v)) return DEFAULTS.multiplier;
    return Math.max(MULT_MIN, Math.min(MULT_MAX, v));
  }

  // -------------------------------------------------------------
  // Expose data + math to handlers (AD-14 internal handle).
  // -------------------------------------------------------------
  HT.recipeScalerCore = Object.freeze({
    getDefaults: function () { return DEFAULTS; },
    getFactors: function () { return FALLBACK_FACTORS; },
    getSampleRecipe: function () { return SAMPLE_RECIPE; },
    getConstants: function () {
      return {
        MULT_MIN: MULT_MIN,
        MULT_MAX: MULT_MAX,
        FRAC_CAP: FRAC_CAP,
      };
    },
    parseFraction: parseFraction,
    formatFraction: formatFraction,
    parseLine: parseLine,
    tryConvert: tryConvert,
    clampMultiplier: clampMultiplier,
  });

  // -------------------------------------------------------------
  // Boot — DOMContentLoaded → lazy-load handlers.js → init()
  // -------------------------------------------------------------
  function boot() {
    if (typeof HT.lazyLoadTool !== 'function') return;
    HT.lazyLoadTool('recipe-scaler', './recipe-scaler-handlers.js').then(function () {
      if (typeof window.recipeScalerInit === 'function') {
        try { window.recipeScalerInit(); }
        catch (err) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('recipe-scaler-core: recipeScalerInit threw', err);
          }
        }
      }
    }).catch(function (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('recipe-scaler-core: lazyLoadTool failed', err);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
