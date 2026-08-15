/* ============================================
   Bangladesh Income Tax Calculator — bd-tax-handlers.js (Story 4b Phase 2)
   Lazy chunk: holds all event handlers, formatters, computation, render,
   and init wiring. Loaded via HT.lazyLoadTool('bd-tax', './bd-tax-handlers.js')
   on first user interaction (or DOMContentLoaded by core.js).

   Read-only access to data tables + state via HT.bdTaxCore (set by core.js).

   Story 4b — see _bmad-output/implementation-artifacts/
   story-4b-per-tool-code-splitting.md
   ============================================ */

(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.HT) return;
  if (!window.HT.bdTaxCore) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('bd-tax-handlers: HT.bdTaxCore missing — bd-tax-core.js must load first.');
    }
    return;
  }
  var HT = window.HT;
  var core = HT.bdTaxCore;

  // -------------------------------------------------------------
  // Local helpers
  // -------------------------------------------------------------

  function T(key) {
    var d = core.getDict()[core.getState().lang] || core.getDict().en;
    if (key.indexOf('.') > -1) {
      var parts = key.split('.');
      var cur = d[parts[0]];
      if (Array.isArray(cur) && /^\d+$/.test(parts[1])) {
        var v = cur[parseInt(parts[1], 10)];
        if (typeof v === 'string') return v;
      }
    } else if (typeof d[key] === 'string') {
      return d[key];
    }
    return core.getDict().en[key] || key;
  }

  function bdt(n) {
    if (!isFinite(n)) n = 0;
    var sign = n < 0 ? '-' : '';
    n = Math.abs(n);
    var parts = n.toFixed(2).split('.');
    var intp = parts[0];
    var decp = parts[1];
    var last3 = intp.slice(-3);
    var rest = intp.slice(0, -3);
    if (rest) last3 = ',' + last3;
    rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    return T('currency') + sign + (rest ? rest + last3 : last3.replace(/^,/, '')) + '.' + decp;
  }

  function bdtRound(n) {
    if (!isFinite(n)) n = 0;
    return T('currency') + HT.formatNumber(Math.round(n), { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function num(id) {
    var el = HT.$('#' + id);
    if (!el) return 0;
    var v = parseFloat(String(el.value || '').replace(/,/g, ''));
    return isFinite(v) && v > 0 ? v : 0;
  }

  function str(id) {
    var el = HT.$('#' + id);
    return el ? String(el.value || '').trim() : '';
  }

  function capitalize(s) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // -------------------------------------------------------------
  // Computation
  // -------------------------------------------------------------

  function computeTax(input) {
    var R = core.getRules();

    // ---- 1. Salary ----
    var basic = input.salaryBasic;
    var grossSalary = basic
      + input.salaryHouseRent
      + input.salaryMedical
      + input.salaryTransport
      + input.salaryOtherAllow
      + input.salaryBonus
      + input.salaryPfEmployer;

    var stdDed = input.salaryStdDedOverride > 0
      ? input.salaryStdDedOverride
      : basic * R.salaryStdDeductionFraction;

    var taxableSalary = Math.max(0, grossSalary - stdDed);

    // ---- 2. Interest ----
    var taxableInterest = input.interestSec + input.interestSavings;

    // ---- 3. House property ----
    var netRent = Math.max(0,
      input.grossRent - input.municipalTax - input.insurance - input.interestBorrowed);
    var taxableHouse = Math.max(0, netRent - netRent * R.housePropertyStdDeduction);

    // ---- 4. Business ----
    var taxableBusiness = input.businessProfit;

    // ---- 5. Capital gains ----
    var listedGains = input.listedGains;
    var unlistedGains = input.unlistedGains;

    // ---- 6. Agriculture (special rule) ----
    var agriculture = input.agriculture;
    var agriExempt = Math.min(agriculture, R.agricultureExempt);
    var taxableAgriculture = Math.max(0, agriculture - agriExempt);

    // ---- 7. Other ----
    var taxableOther = input.dividend + input.royalty + input.otherSources;

    // ---- Total income for slab purposes ----
    var slabIncome = taxableSalary + taxableInterest + taxableHouse + taxableBusiness
      + unlistedGains + taxableAgriculture + taxableOther;

    // ---- Exemption ----
    var cat = input.category;
    var exemptionThreshold = R.exemption[cat] || R.exemption.male;
    var taxableAfterExemption = Math.max(0, slabIncome - exemptionThreshold);

    // ---- Slab tax ----
    var slabBreakdown = computeSlabTax(taxableAfterExemption, R.slabs);
    var slabTax = slabBreakdown.reduce(function (sum, s) { return sum + s.taxInSlab; }, 0);

    // ---- Listed gains tax (flat, separate) ----
    var listedGainTax = listedGains * R.listedCapitalGainsRate;

    // ---- Surcharge (high-income) ----
    var totalIncome = slabIncome + listedGains;
    var surchargeAmt = 0;
    if (R.surcharge && totalIncome > R.surcharge.threshold) {
      surchargeAmt = (totalIncome - R.surcharge.threshold) * R.surcharge.rate;
    }

    // ---- Total tax before rebate ----
    var totalTaxBeforeRebate = slabTax + listedGainTax + surchargeAmt;

    // ---- Investment rebate ----
    var investEligible = Math.min(input.investment, R.rebate.cap);
    var rebateRaw;
    if (R.rebate.tiers && R.rebate.tiers.length) {
      rebateRaw = 0;
      var prevCap = 0;
      for (var t = 0; t < R.rebate.tiers.length; t++) {
        var tier = R.rebate.tiers[t];
        var tierWidth = isFinite(tier.upTo) ? (tier.upTo - prevCap) : Infinity;
        var inTier = Math.max(0, Math.min(investEligible - prevCap, tierWidth));
        if (inTier <= 0) break;
        rebateRaw += inTier * tier.rate;
        prevCap += inTier;
        if (investEligible <= prevCap) break;
      }
    } else {
      rebateRaw = investEligible * R.rebate.rate;
    }
    var rebate = Math.min(rebateRaw, totalTaxBeforeRebate);

    // ---- Minimum tax ----
    var afterRebate = totalTaxBeforeRebate - rebate;
    var minimumApplies = (slabTax > 0) && (afterRebate <= 0);
    var minAdjustment = minimumApplies ? R.minimumTax : 0;
    var taxAfterMin = afterRebate + minAdjustment;
    if (taxAfterMin < 0) taxAfterMin = 0;

    // ---- Taxes paid ----
    var taxesPaid = input.tdsSalary + input.tdsOther + input.advanceTax;

    // ---- Final ----
    var finalPayable = Math.max(0, taxAfterMin - taxesPaid);
    var refundable = Math.max(0, taxesPaid - taxAfterMin);

    var gross = grossSalary + taxableInterest + netRent + taxableBusiness
      + listedGains + unlistedGains + agriculture + taxableOther;
    var effectiveRate = gross > 0 ? (taxAfterMin / gross) * 100 : 0;

    // ---- Insights ----
    var insights = buildInsights({
      input: input,
      R: R,
      exemptionThreshold: exemptionThreshold,
      slabIncome: slabIncome,
      totalIncome: totalIncome,
      surchargeAmt: surchargeAmt,
      totalTaxBeforeRebate: totalTaxBeforeRebate,
      rebate: rebate,
      afterRebate: afterRebate,
      minimumApplies: minimumApplies,
      taxAfterMin: taxAfterMin,
      finalPayable: finalPayable,
      refundable: refundable,
      effectiveRate: effectiveRate,
      investUsed: investEligible,
    });

    return {
      gross: gross,
      grossSalary: grossSalary,
      stdDed: stdDed,
      taxableSalary: taxableSalary,
      taxableInterest: taxableInterest,
      netRent: netRent,
      taxableHouse: taxableHouse,
      taxableBusiness: taxableBusiness,
      listedGains: listedGains,
      unlistedGains: unlistedGains,
      agriExempt: agriExempt,
      taxableAgriculture: taxableAgriculture,
      taxableOther: taxableOther,
      slabIncome: slabIncome,
      totalIncome: totalIncome,
      surchargeAmt: surchargeAmt,
      exemptionThreshold: exemptionThreshold,
      taxableAfterExemption: taxableAfterExemption,
      slabBreakdown: slabBreakdown,
      slabTax: slabTax,
      listedGainTax: listedGainTax,
      totalTaxBeforeRebate: totalTaxBeforeRebate,
      investEligible: investEligible,
      rebate: rebate,
      rebateRaw: rebateRaw,
      afterRebate: afterRebate,
      minimumApplies: minimumApplies,
      minAdjustment: minAdjustment,
      taxAfterMin: taxAfterMin,
      taxesPaid: taxesPaid,
      finalPayable: finalPayable,
      refundable: refundable,
      effectiveRate: effectiveRate,
      insights: insights,
      category: cat,
    };
  }

  function computeSlabTax(taxable, slabs) {
    var firstNonZero = 0;
    for (var k = 0; k < slabs.length; k++) {
      if (slabs[k].rate > 0) { firstNonZero = k; break; }
    }
    var effective = slabs.slice(firstNonZero);
    var breakdown = [];
    var remaining = taxable;

    for (var i = 0; i < effective.length; i++) {
      var absPrev = (i === 0)
        ? (slabs[firstNonZero - 1] ? slabs[firstNonZero - 1].upTo : 0)
        : slabs[firstNonZero + i - 1].upTo;
      var absUpTo = effective[i].upTo;
      var slabWidth = isFinite(absUpTo) ? (absUpTo - absPrev) : Infinity;
      var inThisSlab = Math.max(0, Math.min(remaining, slabWidth));
      var taxInSlab = inThisSlab * effective[i].rate;
      breakdown.push({
        label: formatSlabLabel(absPrev, absUpTo),
        rate: effective[i].rate,
        amountInSlab: inThisSlab,
        taxInSlab: taxInSlab,
        from: absPrev,
        upTo: absUpTo,
      });
      remaining -= inThisSlab;
      if (remaining <= 0) break;
    }
    return breakdown;
  }

  function formatSlabLabel(from, upTo) {
    if (!isFinite(upTo)) return bdt(from) + ' +';
    return bdt(from) + ' – ' + bdt(upTo);
  }

  function buildInsights(ctx) {
    var insights = [];
    var R = ctx.R;

    if (ctx.finalPayable > 0 && ctx.investUsed < R.rebate.cap) {
      var remainingCap = R.rebate.cap - ctx.investUsed;
      var marginalRate = R.rebate.rate;
      if (R.rebate.tiers && R.rebate.tiers.length) {
        marginalRate = R.rebate.tiers[R.rebate.tiers.length - 1].rate;
      }
      var maxAdditionalRebate = remainingCap * marginalRate;
      var extra = Math.min(maxAdditionalRebate, ctx.finalPayable);
      if (extra > 0) {
        var investNeeded = extra / marginalRate;
        var effRatePct = (marginalRate * 100).toFixed(0);
        insights.push({
          type: 'more-invest',
          text: T('insightMore').replace('{x}', bdtRound(investNeeded))
                                .replace('{y}', bdtRound(extra))
                                .replace('{r}', effRatePct + '%'),
        });
      }
    }

    if (ctx.investUsed > 0 && R.rebate.tiers && R.rebate.tiers.length) {
      var effRebateRate = (ctx.rebateRaw / ctx.investUsed) * 100;
      if (Math.abs(effRebateRate - 15) > 0.5) {
        insights.push({
          type: 'no-tax',
          text: T('insightRebateTier').replace('{r}', effRebateRate.toFixed(1) + '%')
                                      .replace('{x}', bdtRound(ctx.investUsed)),
        });
      }
    }

    if (ctx.refundable > 0) {
      insights.push({ type: 'refund', text: T('insightRefund').replace('{x}', bdtRound(ctx.refundable)) });
    }

    if (ctx.minimumApplies) {
      insights.push({ type: 'min-tax', text: T('insightMinTax') });
    }

    if (ctx.surchargeAmt > 0) {
      insights.push({
        type: 'min-tax',
        text: T('insightSurcharge').replace('{x}', bdtRound(R.surcharge.threshold))
                                   .replace('{y}', bdtRound(ctx.surchargeAmt))
      });
    }

    if (ctx.slabIncome <= ctx.exemptionThreshold && ctx.taxAfterMin === 0) {
      insights.push({
        type: 'no-tax',
        text: T('insightNoTax').replace('{x}', bdt(ctx.exemptionThreshold)),
      });
    }

    if (ctx.effectiveRate < 1 && ctx.slabIncome > 2 * ctx.exemptionThreshold) {
      insights.push({ type: 'negligible', text: T('insightNegligible') });
    }

    return insights;
  }

  // -------------------------------------------------------------
  // Input collection
  // -------------------------------------------------------------
  function readInput() {
    return {
      category: str('category') || 'male',
      age: parseInt(str('age'), 10) || 0,
      gender: str('gender') || 'male',
      area: str('area') || 'urban',

      salaryBasic: num('salaryBasic'),
      salaryHouseRent: num('salaryHouseRent'),
      salaryMedical: num('salaryMedical'),
      salaryTransport: num('salaryTransport'),
      salaryOtherAllow: num('salaryOtherAllow'),
      salaryBonus: num('salaryBonus'),
      salaryPfEmployer: num('salaryPfEmployer'),
      salaryStdDedOverride: num('salaryStdDedOverride'),

      interestSec: num('interestSec'),
      interestSavings: num('interestSavings'),

      grossRent: num('grossRent'),
      municipalTax: num('municipalTax'),
      insurance: num('insurance'),
      interestBorrowed: num('interestBorrowed'),

      businessProfit: num('businessProfit'),

      listedGains: num('listedGains'),
      unlistedGains: num('unlistedGains'),

      agriculture: num('agriculture'),

      dividend: num('dividend'),
      royalty: num('royalty'),
      otherSources: num('otherSources'),

      investment: num('investment'),

      tdsSalary: num('tdsSalary'),
      tdsOther: num('tdsOther'),
      advanceTax: num('advanceTax'),
    };
  }

  // -------------------------------------------------------------
  // Render
  // -------------------------------------------------------------
  function render() {
    var state = core.getState();
    var input = readInput();
    var r = computeTax(input);
    state.result = r;

    // Headline
    HT.$('#r-headline').textContent = bdt(r.finalPayable);
    var headlineSign = r.finalPayable > 0 ? T('tFinal') : (r.refundable > 0 ? T('tRefund') : T('tFinal'));
    HT.$('#r-headline-label').textContent = headlineSign;
    if (r.refundable > 0) {
      HT.$('#r-subtitle').innerHTML =
        '<strong>' + bdt(r.refundable) + '</strong> ' + T('tRefund').toLowerCase() +
        ' &nbsp;·&nbsp; ' + T('tEffective') + ': ' + r.effectiveRate.toFixed(2) + '%';
    } else {
      HT.$('#r-subtitle').innerHTML =
        T('tEffective') + ': <strong>' + r.effectiveRate.toFixed(2) + '%</strong>' +
        (r.minimumApplies ? ' &nbsp;·&nbsp; <em>' + T('tMinimum').toLowerCase() + '</em>' : '');
    }

    // Tiles
    HT.$('#t-gross').textContent = bdt(r.gross);
    HT.$('#t-exemption').textContent = '− ' + bdt(r.exemptionThreshold);
    HT.$('#t-taxable').textContent = bdt(r.taxableAfterExemption);
    HT.$('#t-slab').textContent = bdt(r.slabTax);
    HT.$('#t-listed').textContent = bdt(r.listedGainTax);
    HT.$('#t-surcharge').textContent = bdt(r.surchargeAmt);
    HT.$('#t-total').textContent = bdt(r.totalTaxBeforeRebate);
    HT.$('#t-rebate').textContent = '− ' + bdt(r.rebate);
    HT.$('#t-after-rebate').textContent = bdt(r.afterRebate);
    HT.$('#t-min').textContent = (r.minAdjustment > 0 ? '+ ' : '') + bdt(r.minAdjustment);
    HT.$('#t-taxes-paid').textContent = '− ' + bdt(r.taxesPaid);

    // Slab table
    var slabBody = HT.$('#slab-table tbody');
    slabBody.innerHTML = '';
    r.slabBreakdown.forEach(function (s) {
      if (s.amountInSlab === 0) return;
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + s.label + '</td>' +
        '<td>' + (s.rate * 100).toFixed(0) + '%</td>' +
        '<td class="num">' + bdt(s.amountInSlab) + '</td>' +
        '<td class="num">' + bdt(s.taxInSlab) + '</td>';
      slabBody.appendChild(tr);
    });

    // Insights
    var insightEl = HT.$('#insights');
    insightEl.innerHTML = '';
    r.insights.forEach(function (ins) {
      var div = document.createElement('div');
      div.className = 'insight-card insight-' + ins.type;
      div.textContent = ins.text;
      insightEl.appendChild(div);
    });

    // Rebate gauge
    var pct = Math.min(100, (r.investEligible / core.getRules().rebate.cap) * 100);
    HT.$('#gauge-fill').style.width = pct.toFixed(1) + '%';
    HT.$('#gauge-used').textContent = bdt(r.investEligible);
    HT.$('#gauge-cap').textContent = bdt(core.getRules().rebate.cap);
    HT.$('#gauge-raw').textContent = bdt(r.rebateRaw);
    HT.$('#gauge-applied').textContent = bdt(r.rebate);

    // Income summary breakdown
    HT.$('#sum-salary').textContent = bdt(r.taxableSalary);
    HT.$('#sum-interest').textContent = bdt(r.taxableInterest);
    HT.$('#sum-house').textContent = bdt(r.taxableHouse);
    HT.$('#sum-business').textContent = bdt(r.taxableBusiness);
    HT.$('#sum-unlisted').textContent = bdt(r.unlistedGains);
    HT.$('#sum-listed').textContent = bdt(r.listedGains);
    HT.$('#sum-agri').textContent = bdt(r.taxableAgriculture);
    HT.$('#sum-other').textContent = bdt(r.taxableOther);

    // Live std-deduction preview
    var stdDedPreview = HT.$('#std-ded-preview');
    if (stdDedPreview) {
      var basic = parseFloat(String((HT.$('#salaryBasic') || {}).value || '').replace(/,/g, ''));
      var override = parseFloat(String((HT.$('#salaryStdDedOverride') || {}).value || '').replace(/,/g, ''));
      if (isFinite(basic) && basic > 0) {
        var auto = isFinite(override) && override > 0 ? override : (basic * core.getRules().salaryStdDeductionFraction);
        stdDedPreview.textContent = bdtRound(auto);
      } else {
        stdDedPreview.textContent = bdtRound(0);
      }
    }

    // Print view
    renderPrintView(input, r);

    // Update shareable URL hash
    if (!state.suppressHash) updateShareHash();

    // First-render auto-scroll
    if (state.firstRender && r.gross > 0) {
      var card = HT.$('.result-card');
      if (card && typeof card.scrollIntoView === 'function') {
        setTimeout(function () {
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 60);
      }
      state.firstRender = false;
    } else if (r.gross === 0) {
      state.firstRender = true;
    }

    // Persist
    var keys = core.getStorageKeys();
    HT.storage.set(keys.state, {
      lang: state.lang,
      rulesKey: state.rulesKey,
      fields: serializeFields(),
    });
  }

  function serializeFields() {
    var fields = {};
    HT.qsa('input, select').forEach(function (el) {
      if (el.id && el.id !== 'lang-toggle') fields[el.id] = el.value;
    });
    return fields;
  }

  function restoreFields(fields) {
    if (!fields) return;
    Object.keys(fields).forEach(function (id) {
      var el = HT.$('#' + id);
      if (el && fields[id] !== undefined && fields[id] !== null) el.value = fields[id];
    });
  }

  // -------------------------------------------------------------
  // Shareable URL hash
  // -------------------------------------------------------------
  function _b64UrlEncode(s) {
    return btoa(unescape(encodeURIComponent(s)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function _b64UrlDecode(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return decodeURIComponent(escape(atob(s)));
  }

  function updateShareHash() {
    try {
      var payload = {};
      core.getShareHashFields().forEach(function (id) {
        var el = HT.$('#' + id);
        if (el && el.value !== '' && el.value != null) payload[id] = el.value;
      });
      var json = JSON.stringify(payload);
      var encoded = _b64UrlEncode(json);
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', '#s=' + encoded);
      }
    } catch (e) {
      // Ignore — share is best-effort.
    }
  }

  function applyHashIfPresent() {
    if (location.hash.indexOf('#s=') !== 0) return false;
    try {
      var encoded = location.hash.slice(3);
      var json = _b64UrlDecode(encoded);
      var payload = JSON.parse(json);
      Object.keys(payload).forEach(function (id) {
        var el = HT.$('#' + id);
        if (el) el.value = payload[id];
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  // -------------------------------------------------------------
  // Preset scenarios
  // -------------------------------------------------------------
  function applyPreset(key) {
    var preset = core.getPresets()[key];
    if (!preset) return;
    if (!confirm(T('presetConfirm'))) return;
    Object.keys(preset.fields).forEach(function (id) {
      var el = HT.$('#' + id);
      if (el) el.value = preset.fields[id];
    });
    core.getState().firstRender = true;
    render();
    showToast(T('presetLoaded'));
  }

  // -------------------------------------------------------------
  // Copy summary as plain text
  // -------------------------------------------------------------
  function buildSummaryText(r, input) {
    var lines = [];
    lines.push('Bangladesh Income Tax — ' + core.getRules().assessmentYear + ' (FY ' + core.getRules().financialYear + ')');
    lines.push('Category: ' + T('opt' + capitalize(input.category)) + ' · Age: ' + input.age + ' · Area: ' + T('opt' + capitalize(input.area)));
    lines.push('---');
    lines.push('Gross income:          ' + bdt(r.gross));
    lines.push('Less: basic exemption: ' + bdt(r.exemptionThreshold));
    lines.push('Taxable income:        ' + bdt(r.taxableAfterExemption));
    lines.push('---');
    lines.push('Tax on slabs:          ' + bdt(r.slabTax));
    lines.push('Listed gains tax:      ' + bdt(r.listedGainTax));
    if (r.surchargeAmt > 0) {
      lines.push('Surcharge:             ' + bdt(r.surchargeAmt));
    }
    lines.push('Total tax (pre-rebate): ' + bdt(r.totalTaxBeforeRebate));
    lines.push('Less: rebate:          ' + bdt(r.rebate));
    if (r.minAdjustment > 0) {
      lines.push('+ Min tax:             ' + bdt(r.minAdjustment));
    }
    lines.push('Tax after rebate/min:  ' + bdt(r.taxAfterMin));
    lines.push('Less: taxes paid:      ' + bdt(r.taxesPaid));
    lines.push('---');
    if (r.refundable > 0) {
      lines.push('REFUNDABLE: ' + bdt(r.refundable));
    } else {
      lines.push('TAX PAYABLE: ' + bdt(r.finalPayable));
    }
    lines.push('Effective rate: ' + r.effectiveRate.toFixed(2) + '%');
    return lines.join('\n');
  }

  function showToast(msg) {
    if (HT.toast) { HT.toast(msg); return; }
    var el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1f2937;color:#fff;padding:10px 18px;border-radius:8px;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2);font-size:0.9rem';
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2400);
  }

  // -------------------------------------------------------------
  // Print view
  // -------------------------------------------------------------
  function renderPrintView(input, r) {
    var lines = [];
    lines.push('<div class="print-header">');
    lines.push('<h1>' + T('secPrint') + '</h1>');
    lines.push('<p class="muted">' + T('pageSubtitle') + '</p>');
    lines.push('</div>');

    lines.push('<div class="print-section">');
    lines.push('<h2>' + T('printTaxpayer') + '</h2>');
    lines.push('<table class="print-info">');
    lines.push('<tr><td>' + T('printCategory') + '</td><td>' + T('opt' + capitalize(input.category)) + '</td></tr>');
    lines.push('<tr><td>' + T('lblAge') + '</td><td>' + input.age + '</td></tr>');
    lines.push('<tr><td>' + T('printArea') + '</td><td>' + T('opt' + capitalize(input.area)) + '</td></tr>');
    lines.push('<tr><td>' + T('printGenerated') + '</td><td>' + HT.formatDate(new Date()) + '</td></tr>');
    lines.push('</table>');
    lines.push('</div>');

    lines.push('<div class="print-section">');
    lines.push('<h2>' + T('printIncomeByHead') + '</h2>');
    lines.push('<table class="print-table">');
    lines.push('<tr><th>Head</th><th class="num">Amount (BDT)</th></tr>');
    lines.push('<tr><td>Salary (after standard deduction)</td><td class="num">' + bdt(r.taxableSalary) + '</td></tr>');
    lines.push('<tr><td>Interest</td><td class="num">' + bdt(r.taxableInterest) + '</td></tr>');
    lines.push('<tr><td>House property</td><td class="num">' + bdt(r.taxableHouse) + '</td></tr>');
    lines.push('<tr><td>Business / profession</td><td class="num">' + bdt(r.taxableBusiness) + '</td></tr>');
    lines.push('<tr><td>Agriculture (taxable)</td><td class="num">' + bdt(r.taxableAgriculture) + '</td></tr>');
    lines.push('<tr><td>Other sources</td><td class="num">' + bdt(r.taxableOther) + '</td></tr>');
    lines.push('<tr><td>Capital gains (unlisted)</td><td class="num">' + bdt(r.unlistedGains) + '</td></tr>');
    lines.push('<tr><td>Capital gains (listed, separate)</td><td class="num">' + bdt(r.listedGains) + '</td></tr>');
    lines.push('<tr class="total"><td><strong>Total income</strong></td><td class="num"><strong>' + bdt(r.slabIncome + r.listedGains) + '</strong></td></tr>');
    lines.push('<tr><td>Less: basic exemption (' + T('opt' + capitalize(input.category)) + ')</td><td class="num">− ' + bdt(r.exemptionThreshold) + '</td></tr>');
    lines.push('<tr class="total"><td><strong>Taxable income (slabs)</strong></td><td class="num"><strong>' + bdt(r.taxableAfterExemption) + '</strong></td></tr>');
    lines.push('</table>');
    lines.push('</div>');

    lines.push('<div class="print-section">');
    lines.push('<h2>' + T('printSlab') + '</h2>');
    lines.push('<table class="print-table">');
    lines.push('<tr><th>Slab</th><th>Rate</th><th class="num">Amount</th><th class="num">Tax</th></tr>');
    r.slabBreakdown.forEach(function (s) {
      if (s.amountInSlab === 0) return;
      lines.push('<tr><td>' + s.label + '</td><td>' + (s.rate * 100).toFixed(0) + '%</td><td class="num">' + bdt(s.amountInSlab) + '</td><td class="num">' + bdt(s.taxInSlab) + '</td></tr>');
    });
    lines.push('<tr class="total"><td colspan="3"><strong>Total slab tax</strong></td><td class="num"><strong>' + bdt(r.slabTax) + '</strong></td></tr>');
    lines.push('<tr><td>Tax on listed capital gains (flat 15%)</td><td></td><td class="num">' + bdt(r.listedGains) + '</td><td class="num">' + bdt(r.listedGainTax) + '</td></tr>');
    if (r.surchargeAmt > 0) {
      lines.push('<tr><td>' + T('tSurcharge') + ' (over ৳' + HT.formatNumber(core.getRules().surcharge.threshold) + ')</td><td></td><td></td><td class="num">' + bdt(r.surchargeAmt) + '</td></tr>');
    }
    lines.push('<tr class="total"><td colspan="3"><strong>' + T('tTotalTax') + '</strong></td><td class="num"><strong>' + bdt(r.totalTaxBeforeRebate) + '</strong></td></tr>');
    lines.push('<tr><td>Less: investment rebate (15% of ' + bdt(r.investEligible) + ')</td><td></td><td></td><td class="num">− ' + bdt(r.rebate) + '</td></tr>');
    if (r.minAdjustment > 0) {
      lines.push('<tr><td>Add: minimum tax adjustment</td><td></td><td></td><td class="num">+ ' + bdt(r.minAdjustment) + '</td></tr>');
    }
    lines.push('<tr class="total"><td colspan="3"><strong>' + T('tAfterRebate') + '</strong></td><td class="num"><strong>' + bdt(r.taxAfterMin) + '</strong></td></tr>');
    lines.push('<tr><td>Less: taxes already paid (TDS + advance)</td><td></td><td></td><td class="num">− ' + bdt(r.taxesPaid) + '</td></tr>');
    lines.push('<tr class="total"><td colspan="3"><strong>' + (r.refundable > 0 ? T('tRefund') : T('tFinal')) + '</strong></td><td class="num"><strong>' + bdt(Math.max(r.finalPayable, r.refundable)) + '</strong></td></tr>');
    lines.push('</table>');
    lines.push('</div>');

    lines.push('<div class="print-footer muted">');
    lines.push('<p>' + T('printDisclaimer') + '</p>');
    lines.push('<p>' + T('printFooter') + ' · ' + HT.formatDate(new Date()) + '</p>');
    lines.push('</div>');

    HT.$('#print-view').innerHTML = lines.join('');
  }

  // -------------------------------------------------------------
  // Collapsible panels
  // -------------------------------------------------------------
  function setupCollapsiblePanels(saved) {
    var OPEN_BY_DEFAULT = new Set([
      'secTaxpayer',
      'secSalary',
      'secSummary',
      'secBreakdown',
      'secInsights',
    ]);
    var collapsed = (saved && saved.collapsed) || {};

    HT.qsa('.panel').forEach(function (panel) {
      var titleEl = HT.$('.panel-title', panel);
      if (!titleEl) return;
      var key = titleEl.getAttribute('data-i18n') || '';
      var isCollapsed;
      if (Object.prototype.hasOwnProperty.call(collapsed, key)) {
        isCollapsed = !!collapsed[key];
      } else {
        isCollapsed = !OPEN_BY_DEFAULT.has(key);
      }
      if (isCollapsed) panel.classList.add('panel-collapsed');
      titleEl.addEventListener('click', function () {
        panel.classList.toggle('panel-collapsed');
        persistCollapsedState();
      });
    });
  }

  function persistCollapsedState() {
    var map = {};
    HT.qsa('.panel').forEach(function (panel) {
      var titleEl = HT.$('.panel-title', panel);
      if (!titleEl) return;
      var key = titleEl.getAttribute('data-i18n') || '';
      if (key) map[key] = panel.classList.contains('panel-collapsed');
    });
    var keys = core.getStorageKeys();
    var saved = HT.storage.get(keys.state, {}) || {};
    saved.collapsed = map;
    HT.storage.set(keys.state, saved);
  }

  function updateYearLabels() {
    var ay = core.getRules().assessmentYear;
    var fy = core.getRules().financialYear;
    var sub = HT.$('.tool-subtitle');
    if (sub) {
      sub.textContent = (core.getState().lang === 'bn')
        ? 'মূল্যায়ন বছর ' + ay + ' (অর্থবছর ' + fy + ') এর জন্য আপনার ব্যক্তিগত আয়কর হিসাব করুন।'
        : 'Estimate your personal income tax for Assessment Year ' + ay + ' (FY ' + fy + ').';
    }
    var dis = HT.$('.warning');
    if (dis) {
      dis.textContent = (core.getState().lang === 'bn')
        ? 'AY ' + ay + ' এর হিসাব সর্বোত্তম উপলব্ধ তথ্যের উপর ভিত্তি করে। দাখিলের আগে NBR / অর্থ আইন থেকে সীমা, স্ল্যাব ও রেয়াত যাচাই করুন। নিয়মগুলো bd-tax-calculator.js এ সম্পাদনাযোগ্য।'
        : 'AY ' + ay + ' estimates based on best-available data. Verify thresholds, slabs, and rebate rules with NBR / Finance Act before filing. Rules are editable in bd-tax-calculator.js.';
    }
  }

  function applyI18n() {
    HT.qsa('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var txt = T(key);
      if (txt) el.textContent = txt;
    });
    HT.qsa('[data-i18n-attr]').forEach(function (el) {
      var spec = el.getAttribute('data-i18n-attr');
      spec.split(',').forEach(function (pair) {
        var kv = pair.split(':');
        if (kv.length === 2) {
          var attr = kv[0].trim();
          var key = kv[1].trim();
          el.setAttribute(attr, T(key));
        }
      });
    });
    document.documentElement.setAttribute('lang', core.getState().lang === 'bn' ? 'bn' : 'en');
    var btn = HT.$('#lang-toggle');
    if (btn) btn.textContent = T('langToggle');
  }

  // -------------------------------------------------------------
  // Init
  // -------------------------------------------------------------
  function init() {
    var state = core.getState();
    var keys = core.getStorageKeys();
    var saved = HT.storage.get(keys.state, null);
    if (saved && saved.fields) restoreFields(saved.fields);
    if (saved && saved.lang) state.lang = saved.lang;
    if (saved && saved.rulesKey && core.getRulesets()[saved.rulesKey]) {
      state.rulesKey = saved.rulesKey;
      core.setRules(core.getRulesets()[state.rulesKey]);
    }
    var rulesSel = HT.$('#rulesKey');
    if (rulesSel) rulesSel.value = state.rulesKey;
    setupCollapsiblePanels(saved);
    updateYearLabels();
    applyI18n();
    render();

    var handler = HT.debounce(function () {
      render();
    }, 80);

    HT.qsa('input, select').forEach(function (el) {
      if (el.id === 'lang-toggle') return;
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });

    HT.$('#lang-toggle').addEventListener('click', function () {
      state.lang = state.lang === 'en' ? 'bn' : 'en';
      HT.storage.set(keys.lang, state.lang);
      applyI18n();
      render();
    });

    if (rulesSel) {
      rulesSel.addEventListener('change', function () {
        var key = rulesSel.value;
        if (!core.getRulesets()[key]) return;
        state.rulesKey = key;
        core.setRules(core.getRulesets()[key]);
        HT.storage.set(keys.rules, key);
        updateYearLabels();
        applyI18n();
        render();
      });
    }

    HT.$('#reset-btn').addEventListener('click', function () {
      if (!confirm('Clear all inputs? This cannot be undone.')) return;
      HT.qsa('input[type="number"]').forEach(function (el) { el.value = ''; });
      HT.qsa('input[type="text"]').forEach(function (el) { el.value = ''; });
      HT.qsa('select').forEach(function (el) { el.selectedIndex = 0; });
      HT.storage.remove(keys.state);
      render();
    });

    HT.$('#print-btn').addEventListener('click', function () {
      HT.share.print('bd-tax-calculator');
    });

    var shareBtn = HT.$('#share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', function () {
        updateShareHash();
        var url = location.href;
        HT.copyToClipboard(url).then(function () { showToast(T('toastLinkCopied')); });
      });
    }

    var copyBtn = HT.$('#copy-summary-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        if (!state.result) return;
        var text = buildSummaryText(state.result, readInput());
        HT.copyToClipboard(text).then(function () { showToast(T('toastSummaryCopied')); });
      });
    }

    if (applyHashIfPresent()) {
      render();
    }

    HT.qsa('[data-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyPreset(btn.getAttribute('data-preset'));
      });
    });
  }

  // Expose init for core.js's boot() to call.
  window.bdTaxInit = init;
})();
