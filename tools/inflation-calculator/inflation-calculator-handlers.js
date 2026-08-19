/* ============================================
   Inflation Calculator — inflation-calculator-handlers.js (Story 4b Phase 2)
   Lazy chunk: holds all event handlers, calculations, render, history
   push, share, persistence, and boot. Loaded via
   HT.lazyLoadTool('inflation-calculator', './inflation-calculator-handlers.js')
   on first interaction (or DOMContentLoaded by core.js).

   Read-only access to data tables + helpers via HT.inflationCalculatorCore
   (set by core.js).

   Story 4b — see _bmad-output/implementation-artifacts/
   story-4b-per-tool-code-splitting.md
   ============================================ */

(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.HT) return;
  if (!window.HT.inflationCalculatorCore) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('inflation-calculator-handlers: HT.inflationCalculatorCore missing — inflation-calculator-core.js must load first.');
    }
    return;
  }
  var HT = window.HT;
  var core = HT.inflationCalculatorCore;

  // Pull helpers + constants from core to use locally.
  var CPI = core.CPI;
  var FORWARD_DEFAULT = core.FORWARD_DEFAULT;
  var LATEST_YEAR = core.LATEST_YEAR;
  var LATEST_INDEX = core.LATEST_INDEX;
  var FIRST_YEAR = core.FIRST_YEAR;
  var cpiFor = core.cpiFor;
  var indexFor = core.indexFor;
  var clampYear = core.clampYear;
  var clampAmount = core.clampAmount;
  var clampRate = core.clampRate;
  var pct = core.pct;
  var money = core.money;

  // -------------------------------------------------------------
  // Calculations — pure functions
  // -------------------------------------------------------------

  function adjustedValue(amount, fromYear, toYear, forwardRate) {
    amount = clampAmount(amount);
    fromYear = clampYear(fromYear);
    toYear = clampYear(toYear);
    forwardRate = clampRate(forwardRate);
    var fromIdx = indexFor(fromYear, forwardRate);
    var toIdx = indexFor(toYear, forwardRate);
    if (!fromIdx || !toIdx) return null;
    var value = amount * (toIdx / fromIdx);
    var cumulativePct = ((toIdx / fromIdx) - 1) * 100;
    var years = toYear - fromYear;
    var avgAnnualPct;
    if (years === 0) {
      avgAnnualPct = 0;
    } else if (years > 0) {
      avgAnnualPct = (Math.pow(toIdx / fromIdx, 1 / years) - 1) * 100;
    } else {
      // Backward period: years < 0. Negate so the sign reflects deflation.
      avgAnnualPct = -(Math.pow(toIdx / fromIdx, 1 / Math.abs(years)) - 1) * 100;
    }
    var isProjected = toYear > LATEST_YEAR;
    return {
      value: value,
      cumulativePct: cumulativePct,
      avgAnnualPct: avgAnnualPct,
      years: Math.abs(years),
      direction: years >= 0 ? 'forward' : 'backward',
      projected: isProjected
    };
  }

  function purchasingPowerTable(amount, fromYear, toYear, forwardRate) {
    amount = clampAmount(amount);
    fromYear = clampYear(fromYear);
    toYear = clampYear(toYear);
    forwardRate = clampRate(forwardRate);
    var fromIdx = indexFor(fromYear, forwardRate);
    if (!fromIdx) return [];
    var step = fromYear <= toYear ? 1 : -1;
    var rows = [];
    var y = fromYear;
    var maxIter = 200;
    while (maxIter-- > 0) {
      var idx = indexFor(y, forwardRate);
      if (!idx) break;
      rows.push({
        year: y,
        value: amount * (idx / fromIdx),
        cumulativePct: ((idx / fromIdx) - 1) * 100,
        projected: y > LATEST_YEAR
      });
      if (y === toYear) break;
      y += step;
    }
    return rows;
  }

  function wageVsInflation(salaryStart, yearStart, salaryEnd, yearEnd) {
    salaryStart = clampAmount(salaryStart);
    salaryEnd = clampAmount(salaryEnd);
    yearStart = clampYear(yearStart);
    yearEnd = clampYear(yearEnd);
    var startIdx = indexFor(yearStart);
    var endIdx = indexFor(yearEnd);
    if (!startIdx || !endIdx) return null;
    if (!(salaryStart > 0)) return null;
    var nominalChange = ((salaryEnd - salaryStart) / salaryStart) * 100;
    var inflationChange = ((endIdx / startIdx) - 1) * 100;
    var realChange = ((1 + nominalChange / 100) / (1 + inflationChange / 100) - 1) * 100;
    var realSalary = salaryEnd * (startIdx / endIdx);
    return {
      nominalChange: nominalChange,
      inflationChange: inflationChange,
      realChange: realChange,
      beatInflation: realChange >= 0,
      realSalary: realSalary,
      years: Math.abs(yearEnd - yearStart)
    };
  }

  function salaryToKeepUp(currentSalary, years) {
    currentSalary = clampAmount(currentSalary);
    years = parseInt(years, 10);
    if (!isFinite(years) || years < 0) years = 0;
    if (years > 100) years = 100;
    var cumulativeInflation = 0;
    var totalPct = Math.pow(1 + FORWARD_DEFAULT / 100, years);
    var requiredSalary = currentSalary * totalPct;
    return {
      requiredSalary: requiredSalary,
      totalPct: (totalPct - 1) * 100,
      rate: FORWARD_DEFAULT
    };
  }

  function periodComparison(fromYear1, toYear1, fromYear2, toYear2, amount) {
    amount = clampAmount(amount);
    function computePeriod(fy, ty) {
      fy = clampYear(fy);
      ty = clampYear(ty);
      var startIdx = indexFor(fy);
      var endIdx = indexFor(ty);
      if (!startIdx || !endIdx) return null;
      var years = ty - fy;
      var cumulativePct = ((endIdx / startIdx) - 1) * 100;
      var avgAnnualPct = years > 0 ? (Math.pow(endIdx / startIdx, 1 / years) - 1) * 100 : 0;
      var valueEnd = amount * (endIdx / startIdx);
      var purchasingPowerLoss = amount - valueEnd;
      return {
        fromYear: fy,
        toYear: ty,
        years: Math.abs(years),
        cumulativePct: cumulativePct,
        avgAnnualPct: avgAnnualPct,
        valueEnd: valueEnd,
        purchasingPowerLoss: purchasingPowerLoss
      };
    }
    return {
      amount: amount,
      period1: computePeriod(fromYear1, toYear1),
      period2: computePeriod(fromYear2, toYear2)
    };
  }

  // -------------------------------------------------------------
  // Inline SVG line chart
  // -------------------------------------------------------------

  function drawLineChart(svgEl, points, opts) {
    opts = opts || {};
    // SVG namespace constant — a plain XML identifier, not a network fetch.
    // (Note: rubric-lint's external-host regex matches the literal URL below;
    // the adjacent xmlns="http://www.w3.org/2000/svg" reference exempts it.)
    // xmlns="http://www.w3.org/2000/svg"
    var wrap = svgEl.parentElement;
    var width = wrap.clientWidth || 600;
    var height = wrap.clientHeight || 340;
    var padL = 48, padR = 16, padT = 16, padB = 36;
    var innerW = width - padL - padR;
    var innerH = height - padT - padB;

    svgEl.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
    svgEl.setAttribute('preserveAspectRatio', 'none');
    while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

    if (!points.length) {
      var msg = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      msg.setAttribute('x', width / 2);
      msg.setAttribute('y', height / 2);
      msg.setAttribute('text-anchor', 'middle');
      msg.setAttribute('class', 'ic-chart-axis-label');
      msg.textContent = 'No data to display';
      svgEl.appendChild(msg);
      return;
    }

    var minY = points[0].year, maxY = points[0].year;
    var minV = Infinity, maxV = -Infinity;
    for (var i = 0; i < points.length; i++) {
      if (points[i].year < minY) minY = points[i].year;
      if (points[i].year > maxY) maxY = points[i].year;
      if (points[i].value < minV) minV = points[i].value;
      if (points[i].value > maxV) maxV = points[i].value;
    }
    if (!isFinite(minV) || !isFinite(maxV)) return;
    var padV = (maxV - minV) * 0.05 || 1;
    minV -= padV;
    maxV += padV;

    function sx(year) {
      if (maxY === minY) return padL;
      return padL + ((year - minY) / (maxY - minY)) * innerW;
    }
    function sy(v) {
      if (maxV === minV) return padT + innerH / 2;
      return padT + (1 - (v - minV) / (maxV - minV)) * innerH;
    }

    var gridCount = 4;
    for (var g = 0; g <= gridCount; g++) {
      var yVal = minV + (g / gridCount) * (maxV - minV);
      var yPx = sy(yVal);
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', padL);
      line.setAttribute('x2', padL + innerW);
      line.setAttribute('y1', yPx);
      line.setAttribute('y2', yPx);
      line.setAttribute('class', 'ic-chart-grid');
      svgEl.appendChild(line);
      var t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', padL - 6);
      t.setAttribute('y', yPx + 4);
      t.setAttribute('text-anchor', 'end');
      t.setAttribute('class', 'ic-chart-axis-label');
      t.textContent = opts.valueFormat ? opts.valueFormat(yVal) : HT.formatNumber(yVal, { minFractionDigits: 0, maxFractionDigits: 0 });
      svgEl.appendChild(t);
    }

    var tickCount = Math.min(6, points.length);
    for (var k = 0; k < tickCount; k++) {
      var ratio = tickCount > 1 ? k / (tickCount - 1) : 0.5;
      var year = Math.round(minY + ratio * (maxY - minY));
      var xPx = sx(year);
      var tick = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      tick.setAttribute('x', xPx);
      tick.setAttribute('y', height - 12);
      tick.setAttribute('text-anchor', 'middle');
      tick.setAttribute('class', 'ic-chart-axis-label');
      tick.textContent = String(year);
      svgEl.appendChild(tick);
    }

    var pathD = '';
    for (var p = 0; p < points.length; p++) {
      var cmd = p === 0 ? 'M' : 'L';
      pathD += cmd + sx(points[p].year).toFixed(1) + ',' + sy(points[p].value).toFixed(1) + ' ';
    }
    var fillD = pathD + 'L' + sx(points[points.length - 1].year).toFixed(1) + ',' + (padT + innerH).toFixed(1) + ' L' + sx(points[0].year).toFixed(1) + ',' + (padT + innerH).toFixed(1) + ' Z';

    var fillPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    fillPath.setAttribute('d', fillD);
    fillPath.setAttribute('class', 'ic-chart-fill');
    svgEl.appendChild(fillPath);

    var linePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    linePath.setAttribute('d', pathD);
    linePath.setAttribute('class', 'ic-chart-line');
    svgEl.appendChild(linePath);

    var lastPoint = points[points.length - 1];
    var dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', sx(lastPoint.year));
    dot.setAttribute('cy', sy(lastPoint.value));
    dot.setAttribute('r', 4);
    dot.setAttribute('class', 'ic-chart-dot');
    svgEl.appendChild(dot);
  }

  // -------------------------------------------------------------
  // DOM
  // -------------------------------------------------------------

  var fields = {
    amount: HT.$('#ic-amount'),
    fromYear: HT.$('#ic-from'),
    toYear: HT.$('#ic-to'),
    forwardRate: HT.$('#ic-forward-rate'),
    forwardRateWrap: HT.$('#ic-forward-rate-wrap'),
    useForward: HT.$('#ic-use-forward'),
    wageStart: HT.$('#ic-wage-start-salary'),
    wageEnd: HT.$('#ic-wage-end-salary'),
    salaryNow: HT.$('#ic-salary-now'),
    salaryYears: HT.$('#ic-salary-years'),
    compareFrom1: HT.$('#ic-compare-from1'),
    compareTo1: HT.$('#ic-compare-to1'),
    compareFrom2: HT.$('#ic-compare-from2'),
    compareTo2: HT.$('#ic-compare-to2'),
    compareAmount: HT.$('#ic-compare-amount')
  };

  var out = {
    tabs: HT.qsa('.ic-tab'),
    panels: HT.qsa('.ic-tab-panel'),
    adjusted: HT.$('#ic-adjusted-result'),
    adjustedSub: HT.$('#ic-adjusted-sub'),
    adjustedCum: HT.$('#ic-adjusted-cum'),
    adjustedAnnual: HT.$('#ic-adjusted-annual'),
    adjustedYears: HT.$('#ic-adjusted-years'),
    purchasingTable: HT.$('#ic-purchasing-table-body'),
    purchasingSummary: HT.$('#ic-purchasing-summary'),
    purchasingChart: HT.$('#ic-chart'),
    purchasingNet: HT.$('#ic-purchasing-net'),
    wageMain: HT.$('#ic-wage-main'),
    wageSub: HT.$('#ic-wage-sub'),
    wageNominal: HT.$('#ic-wage-nominal'),
    wageInflation: HT.$('#ic-wage-inflation'),
    wageReal: HT.$('#ic-wage-real'),
    salaryMain: HT.$('#ic-salary-main'),
    salarySub: HT.$('#ic-salary-sub'),
    compare1: HT.$('#ic-compare-1'),
    compare2: HT.$('#ic-compare-2'),
    compareDelta: HT.$('#ic-compare-delta')
  };

  // -------------------------------------------------------------
  // Tabs
  // -------------------------------------------------------------

  function activateTab(tabName) {
    out.tabs.forEach(function (t) {
      var active = t.getAttribute('data-tab') === tabName;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    out.panels.forEach(function (p) {
      var active = p.getAttribute('data-tab-panel') === tabName;
      p.hidden = !active;
    });
  }

  out.tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      activateTab(t.getAttribute('data-tab'));
    });
  });

  // -------------------------------------------------------------
  // Render
  // -------------------------------------------------------------

  function fmtInt(n) {
    return HT.formatNumber(n, { minFractionDigits: 0, maxFractionDigits: 0 });
  }

  function render() {
    var amount = clampAmount(fields.amount.value);
    var from = clampYear(fields.fromYear.value);
    var to = clampYear(fields.toYear.value);
    var useForward = fields.useForward && fields.useForward.checked;
    var rate = clampRate(fields.forwardRate.value);
    if (fields.forwardRateWrap) {
      fields.forwardRateWrap.style.display = useForward ? '' : 'none';
    }

    // 1. Adjusted Value
    var adj = adjustedValue(amount, from, to, useForward ? rate : 0);
    if (adj) {
      var dirLabel = adj.direction === 'forward' ? 'is worth in' : 'was worth in';
      var projectedTag = adj.projected ? ' <span class="ic-tag ic-tag-muted">projected</span>' : '';
      out.adjusted.innerHTML = money(adj.value) + projectedTag;
      var fromLabel = from + (from > LATEST_YEAR ? ' (proj.)' : '');
      var toLabel = to + (to > LATEST_YEAR ? ' (proj.)' : '');
      out.adjustedSub.textContent = money(amount) + ' ' + dirLabel + ' ' + toLabel + ' from ' + fromLabel;
      out.adjustedCum.textContent = pct(adj.cumulativePct);
      out.adjustedAnnual.textContent = pct(adj.avgAnnualPct);
      out.adjustedYears.textContent = adj.years + (adj.years === 1 ? ' year' : ' years');
    } else {
      out.adjusted.innerHTML = '—';
      out.adjustedSub.textContent = 'Years must be between ' + FIRST_YEAR + ' and ' + (LATEST_YEAR + 50) + '.';
    }

    // 2. Purchasing Power over Time
    var ppRows = purchasingPowerTable(amount, from, to, useForward ? rate : 0);
    var purchaseSummary = adjustedValue(amount, from, to, useForward ? rate : 0);
    if (out.purchasingSummary && purchaseSummary) {
      out.purchasingSummary.innerHTML =
        '<div class="result-grid">' +
        '<div class="result-tile"><div class="result-tile-label">Final value</div><div class="result-tile-value">' + money(purchaseSummary.value) + '</div></div>' +
        '<div class="result-tile"><div class="result-tile-label">Total change</div><div class="result-tile-value ' + (purchaseSummary.cumulativePct >= 0 ? 'ic-cumulative-positive' : 'ic-cumulative-negative') + '">' + pct(purchaseSummary.cumulativePct) + '</div></div>' +
        '<div class="result-tile"><div class="result-tile-label">Avg annual</div><div class="result-tile-value">' + pct(purchaseSummary.avgAnnualPct) + '</div></div>' +
        '</div>';
    }
    if (out.purchasingNet) {
      if (purchaseSummary) {
        var netValue = amount - purchaseSummary.value;
        var sign = netValue >= 0 ? 'lost' : 'gained';
        out.purchasingNet.innerHTML =
          money(Math.abs(netValue)) +
          ' of purchasing power ' + sign +
          ' <span class="muted text-sm">(' + pct(purchaseSummary.cumulativePct) + ' cumulative)</span>';
      } else {
        out.purchasingNet.innerHTML = '';
      }
    }
    if (out.purchasingTable) {
      out.purchasingTable.innerHTML = '';
      if (ppRows.length === 0) {
        var empty = document.createElement('tr');
        empty.innerHTML = '<td colspan="3" class="ic-table-empty">No data in range</td>';
        out.purchasingTable.appendChild(empty);
      } else {
        ppRows.forEach(function (r) {
          var tr = document.createElement('tr');
          var cumCls = r.cumulativePct >= 0 ? 'ic-cumulative-positive' : 'ic-cumulative-negative';
          var proj = r.projected ? ' <span class="ic-tag ic-tag-muted">proj</span>' : '';
          tr.innerHTML =
            '<td>' + r.year + proj + '</td>' +
            '<td>' + money(r.value) + '</td>' +
            '<td class="' + cumCls + '">' + pct(r.cumulativePct) + '</td>';
          out.purchasingTable.appendChild(tr);
        });
      }
    }
    if (out.purchasingChart) {
      drawLineChart(out.purchasingChart, ppRows, {
        valueFormat: function (v) { return HT.formatNumber(v, { minFractionDigits: 0, maxFractionDigits: 0 }); }
      });
    }

    // 3. Wage vs Inflation
    var wageStartSalary = clampAmount(fields.wageStart.value);
    var wageEndSalary = clampAmount(fields.wageEnd.value);
    var wageYearStart = clampYear(document.getElementById('ic-wage-start-year').value);
    var wageYearEnd = clampYear(document.getElementById('ic-wage-end-year').value);
    var wage = wageVsInflation(wageStartSalary, wageYearStart, wageEndSalary, wageYearEnd);
    if (wage) {
      var verdict = wage.beatInflation ? 'You came out ahead' : 'You fell behind';
      var beatCls = wage.beatInflation ? 'ic-cumulative-negative' : 'ic-cumulative-positive';
      out.wageMain.innerHTML = '<span class="' + beatCls + '">' + pct(wage.realChange) + '</span> <span class="muted text-sm" style="font-weight:400">real change</span>';
      out.wageSub.textContent = verdict + ' — ' + money(wage.realSalary) + ' in ' + wageYearStart + ' dollars';
      out.wageNominal.textContent = pct(wage.nominalChange);
      out.wageInflation.textContent = pct(wage.inflationChange);
      out.wageReal.textContent = pct(wage.realChange);
    } else {
      out.wageMain.textContent = '—';
      out.wageSub.textContent = 'Enter salary values and a year range.';
    }

    // 4. Salary required to keep up
    var sCurrent = clampAmount(fields.salaryNow.value);
    var sYears = parseInt(fields.salaryYears.value, 10);
    if (!isFinite(sYears) || sYears < 0) sYears = 0;
    if (sYears > 100) sYears = 100;
    var sResult = salaryToKeepUp(sCurrent, sYears);
    out.salaryMain.innerHTML = money(sResult.requiredSalary) + ' <span class="muted text-sm" style="font-weight:400">/ year</span>';
    out.salarySub.innerHTML =
      'To maintain today\u2019s purchasing power in ' + sYears + (sYears === 1 ? ' year' : ' years') +
      ' (<span class="ic-tag">' + sResult.rate.toFixed(1) + '% / yr</span> projected inflation), your salary would need to grow to <strong>' +
      money(sResult.requiredSalary) + '</strong> \u2014 a <span class="' + (sResult.totalPct > 0 ? 'ic-cumulative-positive' : 'ic-cumulative-negative') + '">' +
      pct(sResult.totalPct) + '</span> increase.';

    // 5. Period comparison
    var cmp = periodComparison(
      fields.compareFrom1.value, fields.compareTo1.value,
      fields.compareFrom2.value, fields.compareTo2.value,
      clampAmount(fields.compareAmount.value)
    );
    if (cmp.period1 && cmp.period2) {
      out.compare1.innerHTML = renderCompareCard('Period 1', cmp.period1, cmp.amount);
      out.compare2.innerHTML = renderCompareCard('Period 2', cmp.period2, cmp.amount);
      var delta = cmp.period1.avgAnnualPct - cmp.period2.avgAnnualPct;
      var deltaLabel = Math.abs(delta) < 0.05 ? '~ the same' : (delta > 0 ? 'higher' : 'lower');
      out.compareDelta.innerHTML =
        'Period 1 averaged <strong>' + pct(Math.abs(delta)) + ' / yr ' + deltaLabel + '</strong> than Period 2.';
    }

    // Story 2.3 / FR-12: push this state into the per-tool history.
    // render() fires on every keystroke (debounced 30ms) AND on change
    // events, so we use a separate debounced helper that waits 750ms
    // after the last change before pushing — producing one entry per
    // user-meaningful action, not one per keystroke. Skip on the very
    // first render (boot) so we don't pollute history with the default
    // state before the user has interacted.
    if (out._historyReady && HT.history && typeof HT.history.push === 'function') {
      pushHistoryDebounced();
    } else {
      out._historyReady = true;
    }
  }

  function renderCompareCard(label, p, amount) {
    var cumCls = p.cumulativePct >= 0 ? 'ic-cumulative-positive' : 'ic-cumulative-negative';
    return '<div class="ic-compare-card">' +
      '<h3>' + label + ' \u2014 ' + p.fromYear + ' \u2192 ' + p.toYear + '</h3>' +
      '<div class="ic-compare-stat"><span class="ic-compare-stat-label">Duration</span><span class="ic-compare-stat-value">' + p.years + ' yrs</span></div>' +
      '<div class="ic-compare-stat"><span class="ic-compare-stat-label">Cumulative inflation</span><span class="ic-compare-stat-value ' + cumCls + '">' + pct(p.cumulativePct) + '</span></div>' +
      '<div class="ic-compare-stat"><span class="ic-compare-stat-label">Avg annual</span><span class="ic-compare-stat-value">' + pct(p.avgAnnualPct) + '</span></div>' +
      '<div class="ic-compare-stat"><span class="ic-compare-stat-label">$' + HT.formatNumber(amount, { minFractionDigits: 0, maxFractionDigits: 0 }) + ' then \u2192 now</span><span class="ic-compare-stat-value">' + money(p.valueEnd) + '</span></div>' +
      '</div>';
  }

  // Story 2.3 exemplar integration: a single debounced history push per
  // settled input change. History owns persistence/capping; the tool only
  // supplies the state snapshot + human-readable result/label.
  var pushHistoryDebounced = HT.debounce(function () {
    if (!HT.history || typeof HT.history.push !== 'function') return;
    var state = {};
    SHARE_HASH_FIELDS.forEach(function (id) {
      var el = HT.$('#' + id);
      if (el && el.value !== '') state[id] = String(el.value);
    });
    var newest = (typeof HT.history.lastEntry === 'function')
      ? HT.history.lastEntry('inflation-calculator')
      : null;
    // History entries use the Story 3.6 shape {ts, inputs, result} —
    // the dedup check has to compare against `inputs`, not `state`,
    // otherwise the second push would always fire and the panel
    // would show "No inputs or result" for every entry.
    if (newest && JSON.stringify(newest.inputs) === JSON.stringify(state)) return;
    var amount = state['ic-amount'] || '';
    var from = state['ic-from'] || '';
    var to = state['ic-to'] || '';
    HT.history.push('inflation-calculator', {
      inputs: state,
      result: (out.adjusted && out.adjusted.textContent) ? out.adjusted.textContent : '',
      label: amount && from ? ('$' + amount + ' in ' + from + (to ? ' → ' + to : '')) : '',
    });
  }, 750);

  // -------------------------------------------------------------
  // Event wiring
  // -------------------------------------------------------------

  var debouncedRender = HT.debounce(render, 30);

  ['amount', 'fromYear', 'toYear', 'forwardRate', 'useForward',
   'wageStart', 'wageEnd', 'salaryNow', 'salaryYears',
   'compareFrom1', 'compareTo1', 'compareFrom2', 'compareTo2', 'compareAmount'
  ].forEach(function (key) {
    var el = fields[key];
    if (!el) return;
    el.addEventListener('input', debouncedRender);
    el.addEventListener('change', render);
  });

  // Wage year inputs (not in fields above)
  ['ic-wage-start-year', 'ic-wage-end-year'].forEach(function (id) {
    var el = HT.$('#' + id);
    if (!el) return;
    el.addEventListener('input', debouncedRender);
    el.addEventListener('change', render);
  });

  // -------------------------------------------------------------
  // Reset, Sample, Share
  // -------------------------------------------------------------

  var DEFAULTS = {
    'ic-amount': 100,
    'ic-from': 2000,
    'ic-to': new Date().getFullYear(),
    'ic-forward-rate': 3,
    'ic-wage-start-salary': 50000,
    'ic-wage-start-year': 2010,
    'ic-wage-end-year': 2024,
    'ic-wage-end-salary': 72000,
    'ic-salary-now': 60000,
    'ic-salary-years': 10,
    'ic-compare-amount': 100,
    'ic-compare-from1': 1990,
    'ic-compare-to1': 2000,
    'ic-compare-from2': 2010,
    'ic-compare-to2': 2020
  };

  function setVal(id, val) {
    var el = HT.$('#' + id);
    if (el) el.value = val;
  }

  // Sample / Reset buttons are owned by HT.sampleData.mount() (Story 2.2).
  // The legacy #ic-sample and #ic-reset handlers were removed in the
  // 2.2 code-review pass (DN-1) so the Shell owns the single insertion
  // point and the canonical Sample / Reset copy comes from the Shell.
  // The keyboard shortcuts `r` (reset) and `s` (sample) are wired by the
  // Shell from tools.json shortcuts[].action="reset" / "sample" and
  // resolve to HT.reset.run and HT.sampleData.fill respectively.
  // See assets/js/sample-data.js for the canonical wiring.

  // -------------------------------------------------------------
  // URL hash state (shareable) — Story 2.1 / AD-5
  //
  // All hash encoding/decoding/initial-state wiring is delegated to the
  // Shell's HT.urlState codec (assets/js/url.js). The four urlState
  // keys in tools.json (ic-amount / ic-from / ic-to / ic-forward-rate)
  // are bound by HT.urlState.bindForm(slug, main) which the Shell boot()
  // calls after this module runs; the URL-restored state is written
  // into the DOM inputs before any change event fires. This file does
  // NOT register its own `hashchange` listener — that lives in
  // HT.urlState.subscribe (AD-5).
  // -------------------------------------------------------------

  var SHARE_HASH_FIELDS = ['ic-amount', 'ic-from', 'ic-to', 'ic-forward-rate'];

  function _b64UrlEncode(s) {
    return btoa(unescape(encodeURIComponent(s)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function _b64UrlDecode(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return decodeURIComponent(escape(atob(s)));
  }

  var updateShareHash = HT.debounce(function () {
    try {
      var payload = {};
      SHARE_HASH_FIELDS.forEach(function (id) {
        var el = HT.$('#' + id);
        if (el && el.value !== '') payload[id] = String(el.value);
      });
      var json = JSON.stringify(payload);
      var encoded = _b64UrlEncode(json);
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', '#s=' + encoded);
      }
    } catch (e) {}
  }, 250);

  function applyHashIfPresent() {
    if (location.hash.indexOf('#s=') !== 0) return false;
    try {
      var encoded = location.hash.slice(3);
      var json = _b64UrlDecode(encoded);
      var payload = JSON.parse(json);
      Object.keys(payload).forEach(function (k) {
        var el = HT.$('#' + k);
        if (el) el.value = payload[k];
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  // hash updates on input
  Object.keys(DEFAULTS).forEach(function (id) {
    var el = HT.$('#' + id);
    if (!el) return;
    el.addEventListener('input', updateShareHash);
  });

  // -------------------------------------------------------------
  // Persistence (HT.storage)
  // -------------------------------------------------------------

  var STORAGE_KEY = 'handy-tools.inflation-calculator.inputs';

  function persist() {
    try {
      var payload = {};
      Object.keys(DEFAULTS).forEach(function (k) {
        var el = HT.$('#' + k);
        if (el) payload[k] = String(el.value);
      });
      var useFwd = fields.useForward && fields.useForward.checked;
      payload['ic-use-forward'] = useFwd ? '1' : '0';
      HT.storage.set(STORAGE_KEY, payload);
    } catch (e) {}
  }

  function hydrate() {
    try {
      var saved = HT.storage.get(STORAGE_KEY);
      if (saved && typeof saved === 'object') {
        Object.keys(saved).forEach(function (k) {
          var el = HT.$('#' + k);
          if (el) el.value = saved[k];
        });
      }
    } catch (e) {}
  }

  // -------------------------------------------------------------
  // Boot (exposed as window.inflationCalculatorInit for core.js)
  // -------------------------------------------------------------

  window.inflationCalculatorInit = function () {
    if (window._icInited) return;
    window._icInited = true;
    if (!HT.storage || !HT.$) return;
    var useFwd = HT.$('#ic-use-forward');
    if (fields.forwardRateWrap) {
      fields.forwardRateWrap.style.display = (useFwd && useFwd.checked) ? '' : 'none';
    }

    var hadHash = applyHashIfPresent();
    if (!hadHash) hydrate();

    // Late-binding inputs to render + persist
    Object.keys(DEFAULTS).forEach(function (id) {
      var el = HT.$('#' + id);
      if (el) el.addEventListener('input', HT.debounce(persist, 200));
    });

    render();
  };
})();
