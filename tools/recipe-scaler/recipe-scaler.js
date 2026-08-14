/* ============================================
   Recipe Scaler — Story 9.9
   Hand-rolled fraction parser + unit conversion +
   metric/imperial conversion. All parsing / scaling
   is in this single ES2018 vanilla file. NO third-
   party libraries. ONE sanctioned fetch on boot for
   assets/data/unit-conversion.json (with a hardcoded
   fallback baked in for offline / file://).

   AD-1  — Zero runtime third-party libraries.
   AD-12 — ES2018 vanilla; no SSR; no build step.
   AD-14 — Frozen public surface (uses HT.$ / HT.debounce /
           HT.toast; no new exports).

   Pipeline:
     parseFraction(s)        → Number
     parseLine(line)         → {qty, unit, ingredient} | null
     tryConvert(qty, from, toSystem, factors)
                            → {qty, unit} | null
     formatFraction(n)       → String (Stern-Brocot greedy)
     render()                → DOM update
   ============================================ */

(function () {
  'use strict';

  // -------- Constants --------
  var DEFAULTS = {
    multiplier: 2,
    system: 'metric',
  };
  var MULT_MIN = 0.1;
  var MULT_MAX = 100;
  var FRAC_CAP = 16;          // denominator cap per AC-5
  var SAMPLE_RECIPE = '1/2 cup flour\n2 tbsp sugar\n3 eggs\n350 °F oven\n1 pinch salt\nsalt to taste';

  // -------- Hardcoded fallback (offline / file:// safe) --------
  // MUST stay byte-equivalent to assets/data/unit-conversion.json.
  // See AC-3 / Known Limitations.
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

  // -------- DOM refs --------
  var recipeEl = HT.$('#rs-recipe');
  var multEl = HT.$('#rs-multiplier');
  var sysEl = HT.$('#rs-system');
  var outEl = HT.$('#rs-output');
  var summaryEl = HT.$('#rs-summary');
  var btnSample = HT.$('[data-action="sample"]');
  var btnReset = HT.$('[data-action="reset"]');
  var btnPrint = HT.$('[data-action="print"]');
  var btnShare = HT.$('[data-action="share"]');

  // -------- State --------
  // factors: the unit-conversion.json content (or fallback).
  // factorsLoaded: 'fetched' | 'fallback'
  var factors = null;
  var factorsLoaded = 'fallback';

  // -------- parseFraction (AC-1) --------
  // Accepts: '1/2', '1 1/2', '0.5', '2', '3/4', '1 3/4'.
  // Returns Number.
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

  // -------- formatFraction (AC-5) --------
  // Stern-Brocot / greedy continued-fraction approximation
  // with denominator cap 16. Returns strings like
  // "1/2", "1 1/4", "2", "1/3", "1/8".
  function formatFraction(n) {
    if (!Number.isFinite(n)) return String(n);
    var EPS = 1e-9;
    if (Math.abs(n) < EPS) return '0';
    var sign = n < 0 ? '-' : '';
    var x = Math.abs(n);
    var whole = Math.floor(x);
    var frac = x - whole;
    if (frac < EPS) return sign + String(whole);
    // Greedy CF approximation with cap FRAC_CAP.
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

  // -------- parseLine (AC-1 regex) --------
  // Matches: "<qty> [<unit>] <ingredient>"
  // Returns {qty: Number, unit: String|'', ingredient: String} or null.
  function parseLine(line) {
    if (line == null) return null;
    var trimmed = String(line).trim();
    if (!trimmed) return null;
    // Canonical regex per AC-1.
    var re = /^([0-9]+\/[0-9]+|[0-9]+(?:\s+[0-9]+\/[0-9]+)?|[0-9]*\.[0-9]+)(?:\s+(\S+))?\s*(.*)$/;
    var m = trimmed.match(re);
    if (!m) return null;
    var qty = parseFraction(m[1]);
    if (!Number.isFinite(qty)) return null;
    var unit = m[2] ? String(m[2]) : '';
    var ingredient = m[3] ? String(m[3]).trim() : '';
    if (!ingredient) return null;
    return { qty: qty, unit: unit, ingredient: ingredient };
  }

  // -------- tryConvert (AC-3 / AC-4) --------
  // Returns {qty: Number, unit: String} if the unit is known
  // and a conversion is possible. Returns null otherwise
  // (caller should render the unit-warning chip).
  function tryConvert(qty, fromUnit, toSystem) {
    if (!factors) return null;
    if (!fromUnit) return null;  // unitless ingredients don't convert
    // Temperature: special case (formula, not linear factor).
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
    // Volume
    if (factors.volume && factors.volume.toBase[fromUnit] != null) {
      var list = toSystem === 'metric' ? factors.volume.metric : factors.volume.imperial;
      // Pick the first metric/imperial unit that's NOT the source unit.
      // If source is already in target system, keep it.
      var isAlready = list.indexOf(fromUnit) >= 0;
      var targetUnit;
      if (isAlready) {
        targetUnit = fromUnit;
      } else {
        targetUnit = list[0];
      }
      var baseQty = qty * factors.volume.toBase[fromUnit];
      var newQty = baseQty / factors.volume.toBase[targetUnit];
      return { qty: newQty, unit: targetUnit };
    }
    // Mass
    if (factors.mass && factors.mass.toBase[fromUnit] != null) {
      var mlist = toSystem === 'metric' ? factors.mass.metric : factors.mass.imperial;
      var misAlready = mlist.indexOf(fromUnit) >= 0;
      var mTarget;
      if (misAlready) {
        mTarget = fromUnit;
      } else {
        mTarget = mlist[0];
      }
      var baseG = qty * factors.mass.toBase[fromUnit];
      var mNew = baseG / factors.mass.toBase[mTarget];
      return { qty: mNew, unit: mTarget };
    }
    return null;
  }

  // -------- Clamp + read multiplier --------
  function clampMultiplier(v) {
    if (!Number.isFinite(v)) return DEFAULTS.multiplier;
    return Math.max(MULT_MIN, Math.min(MULT_MAX, v));
  }
  function readMultiplier() {
    return clampMultiplier(parseFloat(multEl && multEl.value));
  }

  // -------- Render (AC-2 / AC-3 / AC-4) --------
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function render() {
    if (!outEl) return;
    var text = recipeEl ? String(recipeEl.value || '') : '';
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim().length > 0; });
    var mult = readMultiplier();
    var system = sysEl ? sysEl.value : DEFAULTS.system;

    var htmlParts = [];
    var parsedCount = 0;
    var unparsedCount = 0;

    if (lines.length === 0) {
      htmlParts.push('<li class="recipe-output-empty">Paste a recipe above to scale it.</li>');
    } else {
      for (var i = 0; i < lines.length; i += 1) {
        var line = lines[i];
        var parsed = parseLine(line);
        if (parsed === null) {
          // AC-1 / ROQ-5: render unparsed marker AND exclude from scaling.
          unparsedCount += 1;
          htmlParts.push(
            '<li class="recipe-line-unparsed">' +
              '<code>' + escapeHtml(line) + '</code>' +
              '<span class="recipe-line-unparsed-explain"> (could not parse — please check format)</span>' +
            '</li>'
          );
          continue;
        }
        parsedCount += 1;
        var scaledQty = parsed.qty * mult;
        var conv = tryConvert(parsed.qty, parsed.unit, system);
        var finalQty, finalUnit, warningUnit;
        if (conv !== null) {
          finalQty = scaledQty * (conv.qty / parsed.qty);
          finalUnit = conv.unit;
        } else {
          // Unknown unit: pass through with warning chip.
          finalQty = scaledQty;
          finalUnit = parsed.unit;
          warningUnit = parsed.unit;
        }
        var qtyStr = formatFraction(finalQty);
        var unitHtml;
        if (warningUnit) {
          unitHtml = '<span class="recipe-line-unit"><span class="unit-warning" title="Unknown unit: ' + escapeHtml(warningUnit) + '">' + escapeHtml(finalUnit || warningUnit) + '</span></span>';
        } else if (finalUnit) {
          unitHtml = '<span class="recipe-line-unit">' + escapeHtml(finalUnit) + '</span>';
        } else {
          unitHtml = '<span class="recipe-line-unit"></span>';
        }
        htmlParts.push(
          '<li class="recipe-line">' +
            '<span class="recipe-line-qty">' + escapeHtml(qtyStr) + '</span>' +
            ' ' + unitHtml + ' ' +
            '<span class="recipe-line-ingredient">' + escapeHtml(parsed.ingredient) + '</span>' +
          '</li>'
        );
      }
    }

    outEl.innerHTML = htmlParts.join('');
    if (summaryEl) {
      var summaryText = lines.length === 0
        ? ''
        : 'Scaled ' + parsedCount + ' ingredient' + (parsedCount === 1 ? '' : 's') +
          (unparsedCount > 0 ? ' (' + unparsedCount + ' skipped)' : '') +
          ' ×' + formatFraction(mult) + ' in ' + (system === 'metric' ? 'metric' : 'imperial') + '.';
      summaryEl.textContent = summaryText;
    }
    writeUrlState();
  }

  // -------- URL state (AC-4) --------
  function encodeBase64(text) {
    try {
      return btoa(unescape(encodeURIComponent(text)));
    } catch (_) {
      return '';
    }
  }
  function decodeBase64(b64) {
    try {
      return decodeURIComponent(escape(atob(b64)));
    } catch (_) {
      return '';
    }
  }
  function readUrlState() {
    try {
      var p = new URLSearchParams(window.location.search);
      return {
        recipe: p.get('recipe'),
        multiplier: p.get('multiplier'),
        system: p.get('system'),
      };
    } catch (_) {
      return { recipe: null, multiplier: null, system: null };
    }
  }
  function writeUrlState() {
    try {
      var p = new URLSearchParams(window.location.search);
      var recipeText = recipeEl ? String(recipeEl.value || '') : '';
      p.set('recipe', encodeBase64(recipeText));
      if (multEl) p.set('multiplier', String(readMultiplier()));
      if (sysEl) p.set('system', String(sysEl.value));
      var qs = p.toString();
      var url = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
      window.history.replaceState(null, '', url);
    } catch (_) { /* iframe sandboxed — ignore */ }
  }
  function applyUrlState() {
    var s = readUrlState();
    if (s.recipe !== null && s.recipe !== '' && recipeEl) {
      var decoded = decodeBase64(s.recipe);
      if (decoded) {
        recipeEl.value = decoded;
      } else {
        recipeEl.value = SAMPLE_RECIPE;
      }
    } else if (recipeEl && !recipeEl.value) {
      recipeEl.value = SAMPLE_RECIPE;
    }
    if (s.multiplier !== null && multEl) {
      var m = parseFloat(s.multiplier);
      if (Number.isFinite(m)) multEl.value = String(clampMultiplier(m));
    } else if (multEl && !multEl.value) {
      multEl.value = String(DEFAULTS.multiplier);
    }
    if (s.system !== null && sysEl && (s.system === 'metric' || s.system === 'imperial')) {
      sysEl.value = s.system;
    } else if (sysEl && !sysEl.value) {
      sysEl.value = DEFAULTS.system;
    }
  }

  // -------- Actions (AC-6) --------
  function actionSample() {
    if (recipeEl) recipeEl.value = SAMPLE_RECIPE;
    if (multEl) multEl.value = String(DEFAULTS.multiplier);
    if (sysEl) sysEl.value = DEFAULTS.system;
    render();
  }
  function actionReset() {
    if (recipeEl) recipeEl.value = '';
    if (multEl) multEl.value = String(DEFAULTS.multiplier);
    if (sysEl) sysEl.value = DEFAULTS.system;
    render();
  }
  function actionPrint() {
    try { window.print(); } catch (_) { /* no-op */ }
  }
  function actionShare() {
    var href = '';
    try { href = window.location.href; } catch (_) {}
    var showOk = function () {
      if (typeof HT !== 'undefined' && HT && typeof HT.toast === 'function') {
        try { HT.toast('URL copied'); return; } catch (_) {}
      }
      if (typeof console !== 'undefined' && console.info) {
        try { console.info('Recipe Scaler: URL copied to clipboard: ' + href); return; } catch (_) {}
      }
    };
    var fail = function () {
      if (typeof console !== 'undefined' && console.info) {
        try { console.info('Recipe Scaler: share URL: ' + href); } catch (_) {}
      }
    };
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        navigator.clipboard.writeText(href).then(showOk, fail);
      } catch (_) { fail(); }
    } else {
      fail();
    }
  }

  // -------- Wire events (AC-6 / AC-7) --------
  var onInput = HT.debounce(function () { render(); }, 120);
  function wire() {
    if (recipeEl) recipeEl.addEventListener('input', onInput);
    if (multEl) multEl.addEventListener('input', onInput);
    if (sysEl) sysEl.addEventListener('change', function () { render(); });

    if (btnSample) btnSample.addEventListener('click', actionSample);
    if (btnReset) btnReset.addEventListener('click', actionReset);
    if (btnPrint) btnPrint.addEventListener('click', actionPrint);
    if (btnShare) btnShare.addEventListener('click', actionShare);

    document.addEventListener('keydown', function (ev) {
      var target = ev.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      var k = ev.key;
      if (k === 's' || k === 'S') {
        ev.preventDefault();
        actionSample();
      } else if (k === 'r' || k === 'R') {
        ev.preventDefault();
        actionReset();
      } else if (k === 'p' || k === 'P') {
        ev.preventDefault();
        actionPrint();
      } else if (k === 'c' || k === 'C') {
        ev.preventDefault();
        actionShare();
      }
    });
  }

  // -------- Init --------
  // AD-14: no direct fetch from tool scripts. The unit-conversion data is
  // embedded as FALLBACK_FACTORS at the top of this file (kept byte-equivalent
  // to assets/data/unit-conversion.json). The data file exists for documentation
  // / future tooling but is NOT loaded at runtime.
  factors = FALLBACK_FACTORS;
  factorsLoaded = 'fallback';
  applyUrlState();
  wire();
  render();
})();
