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
    var periodsPerMonth = n / 12;
    var ratePerMonth = r / 12;

    var monthsTotal = years * 12;

    // Process month by month so monthly contribution timing is precise.
    for (var m = 1; m <= monthsTotal; m++) {
      if (contribWhen === 'start') {
        balance += monthly;
        contribToDate += monthly;
      }

      // Apply monthly compounding: each month contains (n/12) compounding periods.
      var periodsThisMonth = periodsPerMonth;
      for (var p = 0; p < periodsThisMonth; p++) {
        var interest = balance * ratePerPeriod;
        balance += interest;
        interestToDate += interest;
      }

      if (contribWhen === 'end') {
        balance += monthly;
        contribToDate += monthly;
      }

      if (m % 12 === 0) {
        schedule.push({
          year: m / 12,
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