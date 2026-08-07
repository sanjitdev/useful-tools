/* ============================================
   Compound Interest Calculator
   Computes year-by-year growth with periodic compounding
   and optional monthly contributions.
   ============================================ */

(function () {
  'use strict';

  var fields = {
    principal: HT.$('#principal'),
    monthly: HT.$('#monthly'),
    rate: HT.$('#rate'),
    years: HT.$('#years'),
    frequency: HT.$('#frequency'),
    contribWhen: HT.$('#contrib-when')
  };

  var out = {
    finalBalance: HT.$('#final-balance'),
    finalSummary: HT.$('#final-summary'),
    totalContrib: HT.$('#total-contrib'),
    totalInterest: HT.$('#total-interest'),
    effectiveRate: HT.$('#effective-rate'),
    growthMultiple: HT.$('#growth-multiple'),
    scheduleWrap: HT.$('#schedule-wrap')
  };

  var moneyOpts = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  var pctOpts = { minimumFractionDigits: 2, maximumFractionDigits: 3 };

  function buildSchedule(principal, monthly, annualRatePct, years, n, contribWhen) {
    var schedule = [];
    var balance = principal;
    var contribToDate = 0;
    var interestToDate = 0;

    schedule.push({
      year: 0,
      contribToDate: contribToDate,
      interestToDate: interestToDate,
      balance: balance
    });

    var r = annualRatePct / 100;
    var ratePerPeriod = r / n;

    // Walk in sub-month steps so compounding happens at the correct cadence
    // regardless of how many periods fit in a month (n=12 gives 1 step/month,
    // n=4 gives 1 step/quarter, n=2 gives 1 step/half-year, n=1 gives
    // 1 step/year). Each sub-step represents a single compounding period; a
    // month is 1/12 of a year, so a period boundary is crossed whenever the
    // integer count of elapsed periods increases.
    var monthsTotal = years * 12;
    var periodsElapsed = 0;
    // Subdivide each month finely so contribution timing stays monthly.
    var subStepsPerMonth = 12;
    var subStepsTotal = monthsTotal * subStepsPerMonth;
    var monthlyPerSubStep = monthly / subStepsPerMonth;

    for (var s = 1; s <= subStepsTotal; s++) {
      // Apply monthly contribution at the start of each sub-step (sub-steps
      // partition the month evenly, so the cumulative monthly contribution
      // is exact regardless of n).
      if (contribWhen === 'start') {
        balance += monthlyPerSubStep;
        contribToDate += monthlyPerSubStep;
      }

      // Has a compounding period boundary been crossed since the last step?
      // Period k ends at time k/n years. A sub-step at index s covers
      // (s/subStepsTotal) of the total span, so the period count is
      // floor(s * n * monthsTotal / (12 * subStepsTotal)).
      var periodsNow = Math.floor((s * n * monthsTotal) / (12 * subStepsTotal));
      while (periodsElapsed < periodsNow) {
        var interest = balance * ratePerPeriod;
        balance += interest;
        interestToDate += interest;
        periodsElapsed += 1;
      }

      if (contribWhen === 'end') {
        balance += monthlyPerSubStep;
        contribToDate += monthlyPerSubStep;
      }

      // Snapshot year-end rows. With subStepsPerMonth=12, the last sub-step
      // of year k is at index k * (12 * subStepsPerMonth).
      if (s % (12 * subStepsPerMonth) === 0) {
        var year = s / (12 * subStepsPerMonth);
        schedule.push({
          year: year,
          contribToDate: contribToDate,
          interestToDate: interestToDate,
          balance: balance
        });
      }
    }

    return { schedule: schedule, finalBalance: balance };
  }

  function effectiveAnnual(nominalPct, n) {
    return (Math.pow(1 + (nominalPct / 100) / n, n) - 1) * 100;
  }

  function render() {
    var principal = parseFloat(fields.principal.value) || 0;
    var monthly = parseFloat(fields.monthly.value) || 0;
    var ratePct = parseFloat(fields.rate.value);
    var years = parseInt(fields.years.value, 10);
    var n = parseInt(fields.frequency.value, 10);
    var contribWhen = fields.contribWhen.value;

    if (!isFinite(ratePct) || ratePct < 0) ratePct = 0;
    if (!isFinite(years) || years < 0) years = 0;
    if (!isFinite(n) || n < 1) n = 1;
    years = Math.min(years, 100);

    var result = buildSchedule(principal, monthly, ratePct, years, n, contribWhen);
    var finalBalance = result.finalBalance;
    var schedule = result.schedule;
    var totalContrib = schedule[schedule.length - 1].contribToDate;
    var totalInterest = schedule[schedule.length - 1].interestToDate;
    var totalInvested = principal + totalContrib;
    var ear = effectiveAnnual(ratePct, n);

    out.finalBalance.textContent = '$' + HT.formatNumber(finalBalance, moneyOpts);
    if (totalInvested > 0) {
      var multiple = finalBalance / totalInvested;
      out.finalSummary.textContent =
        'Starting from $' + HT.formatNumber(totalInvested, moneyOpts) +
        ' in total contributions, growing to $' + HT.formatNumber(finalBalance, moneyOpts) +
        ' after ' + years + ' year' + (years === 1 ? '' : 's') + '.';
    } else {
      out.finalSummary.textContent = 'Adjust your inputs to see projected growth.';
    }
    out.totalContrib.textContent = '$' + HT.formatNumber(totalContrib, moneyOpts);
    out.totalInterest.textContent = '$' + HT.formatNumber(totalInterest, moneyOpts);
    out.effectiveRate.textContent = HT.formatNumber(ear, pctOpts) + '%';
    out.growthMultiple.textContent = totalInvested > 0
      ? HT.formatNumber(finalBalance / totalInvested, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '×'
      : '—';

    // Render schedule
    var rows = '';
    for (var i = 0; i < schedule.length; i++) {
      var r = schedule[i];
      rows +=
        '<tr>' +
          '<td class="col-year">' + r.year + '</td>' +
          '<td>$' + HT.formatNumber(r.contribToDate, moneyOpts) + '</td>' +
          '<td>$' + HT.formatNumber(r.interestToDate, moneyOpts) + '</td>' +
          '<td>$' + HT.formatNumber(r.balance, moneyOpts) + '</td>' +
        '</tr>';
    }
    out.scheduleWrap.innerHTML =
      '<table class="schedule"><thead><tr>' +
        '<th class="col-year">Year</th>' +
        '<th>Contributions to date</th>' +
        '<th>Interest to date</th>' +
        '<th>Balance</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';
  }

  var handler = HT.debounce(render, 30);
  Object.keys(fields).forEach(function (k) {
    fields[k].addEventListener('input', handler);
    fields[k].addEventListener('change', render);
  });

  render();
})();