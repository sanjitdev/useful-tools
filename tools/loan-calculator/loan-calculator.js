/* ============================================
   Loan Calculator
   Computes periodic payment, total cost, payoff date,
   and a summary amortization window.
   ============================================ */

(function () {
  'use strict';

  var fields = {
    amount: HT.$('#amount'),
    rate: HT.$('#rate'),
    frequency: HT.$('#frequency'),
    years: HT.$('#years'),
    months: HT.$('#months'),
    startDate: HT.$('#start-date')
  };

  var out = {
    payment: HT.$('#payment'),
    paymentSub: HT.$('#payment-sub'),
    totalPaid: HT.$('#total-paid'),
    totalInterest: HT.$('#total-interest'),
    numPayments: HT.$('#num-payments'),
    payoffDate: HT.$('#payoff-date'),
    scheduleWrap: HT.$('#schedule-wrap')
  };

  var moneyOpts = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

  // Set default first payment date to today.
  (function () {
    var d = new Date();
    var iso = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
    fields.startDate.value = iso;
  })();

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  // Add `months` months to a date (calendar-aware).
  function addMonths(date, months) {
    var d = new Date(date.getTime());
    var newMonth = d.getMonth() + months;
    d.setMonth(newMonth);
    // Guard against month overflow when day exceeds month length.
    if (d.getMonth() !== ((newMonth % 12) + 12) % 12) {
      d.setDate(0);
    }
    return d;
  }

  // Add `count` periods of frequency `n` to a date (approximate, month-based for our range).
  function addPeriods(date, count, perYear) {
    if (perYear === 12) {
      return addMonths(date, count);
    }
    if (perYear === 26) {
      return addMonths(date, Math.floor((count * 12) / 26));
    }
    // weekly
    return addMonths(date, Math.floor((count * 12) / 52));
  }

  function calcPayment(principal, annualRatePct, n, totalPayments) {
    if (totalPayments <= 0) return 0;
    var r = (annualRatePct / 100) / n;
    if (r === 0) return principal / totalPayments;
    var pow = Math.pow(1 + r, totalPayments);
    return principal * (r * pow) / (pow - 1);
  }

  function buildSchedule(principal, annualRatePct, perYear, totalPayments) {
    var sched = [];
    var balance = principal;
    var r = (annualRatePct / 100) / perYear;
    var pmt = calcPayment(principal, annualRatePct, perYear, totalPayments);
    var totalInterest = 0;
    var totalPaid = 0;

    for (var i = 1; i <= totalPayments; i++) {
      var interest = balance * r;
      var principalPaid = pmt - interest;
      // Final payment adjustment if rounding leaves a residual.
      if (i === totalPayments) {
        principalPaid = balance;
        pmt = principalPaid + interest;
      }
      balance -= principalPaid;
      if (balance < 0.005) balance = 0;
      totalInterest += interest;
      totalPaid += pmt;
      sched.push({
        index: i,
        payment: pmt,
        interest: interest,
        principal: principalPaid,
        balance: balance
      });
    }
    return { schedule: sched, totalInterest: totalInterest, totalPaid: totalPaid, payment: calcPayment(principal, annualRatePct, perYear, totalPayments) };
  }

  function freqLabel(perYear) {
    if (perYear === 12) return 'monthly';
    if (perYear === 26) return 'bi-weekly';
    return 'weekly';
  }

  function perYearFromSelect(v) {
    var n = parseInt(v, 10);
    if (n === 26) return 26;
    if (n === 52) return 52;
    return 12;
  }

  function render() {
    var principal = parseFloat(fields.amount.value) || 0;
    var ratePct = parseFloat(fields.rate.value);
    var years = parseInt(fields.years.value, 10);
    var extraMonths = parseInt(fields.months.value, 10);
    var perYear = perYearFromSelect(fields.frequency.value);

    if (!isFinite(ratePct) || ratePct < 0) ratePct = 0;
    if (!isFinite(years) || years < 0) years = 0;
    if (!isFinite(extraMonths) || extraMonths < 0) extraMonths = 0;
    years = Math.min(years, 100);
    extraMonths = Math.min(extraMonths, 11);

    var totalMonths = years * 12 + extraMonths;

    // Translate years/months to total number of payments for the chosen frequency.
    var totalPayments;
    if (perYear === 12) totalPayments = totalMonths;
    else if (perYear === 26) totalPayments = Math.round((totalMonths / 12) * 26);
    else totalPayments = Math.round((totalMonths / 12) * 52);

    if (principal <= 0 || totalPayments <= 0) {
      out.payment.textContent = '—';
      out.paymentSub.textContent = 'Enter loan details to compute your payment.';
      out.totalPaid.textContent = '—';
      out.totalInterest.textContent = '—';
      out.numPayments.textContent = '—';
      out.payoffDate.textContent = '—';
      out.scheduleWrap.innerHTML = '';
      return;
    }

    var result = buildSchedule(principal, ratePct, perYear, totalPayments);
    var sched = result.schedule;

    out.payment.textContent = '$' + HT.formatNumber(result.payment, moneyOpts);
    out.paymentSub.textContent =
      freqLabel(perYear).replace(/^./, function (c) { return c.toUpperCase(); }) +
      ' payment over ' + years + ' year' + (years === 1 ? '' : 's') +
      (extraMonths > 0 ? ' ' + extraMonths + ' month' + (extraMonths === 1 ? '' : 's') : '') +
      ' · ' + HT.formatNumber(totalPayments) + ' total payment' + (totalPayments === 1 ? '' : 's');
    out.totalPaid.textContent = '$' + HT.formatNumber(result.totalPaid, moneyOpts);
    out.totalInterest.textContent = '$' + HT.formatNumber(result.totalInterest, moneyOpts);
    out.numPayments.textContent = HT.formatNumber(totalPayments);

    // Payoff date
    var startStr = fields.startDate.value;
    var startDate = null;
    if (startStr) {
      var parts = startStr.split('-');
      if (parts.length === 3) {
        startDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      }
    }
    var payoff = startDate ? addPeriods(startDate, totalPayments - 1, perYear) : null;
    out.payoffDate.textContent = payoff ? HT.formatDateShort(payoff) : '—';

    // Schedule sections: first 12 + last 12 (or all if shorter).
    var showAll = sched.length <= 24;
    var first = sched.slice(0, Math.min(12, sched.length));
    var last = showAll ? [] : sched.slice(-12);

    function rowsHtml(rows) {
      var html = '';
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        html +=
          '<tr>' +
            '<td>' + r.index + '</td>' +
            '<td>$' + HT.formatNumber(r.payment, moneyOpts) + '</td>' +
            '<td>$' + HT.formatNumber(r.interest, moneyOpts) + '</td>' +
            '<td>$' + HT.formatNumber(r.principal, moneyOpts) + '</td>' +
            '<td>$' + HT.formatNumber(r.balance, moneyOpts) + '</td>' +
          '</tr>';
      }
      return html;
    }

    function tableHtml(sectionTitle, rows) {
      return '<div class="schedule-section">' +
        '<div class="schedule-section-title">' + sectionTitle + '</div>' +
        '<table class="schedule"><thead><tr>' +
          '<th>#</th><th>Payment</th><th>Interest</th><th>Principal</th><th>Balance</th>' +
        '</tr></thead><tbody>' + rowsHtml(rows) + '</tbody></table>' +
      '</div>';
    }

    if (showAll) {
      out.scheduleWrap.innerHTML = tableHtml('All ' + sched.length + ' payments', sched);
    } else {
      out.scheduleWrap.innerHTML =
        tableHtml('First 12 payments', first) +
        tableHtml('Last 12 payments', last);
    }
  }

  var handler = HT.debounce(render, 30);
  Object.keys(fields).forEach(function (k) {
    fields[k].addEventListener('input', handler);
    fields[k].addEventListener('change', render);
  });

  // Story 9.19 — opt the start-date input into HT.datePicker (lazy
  // via shell-thin Proxy). The picker's onSelect writes back to the
  // input.value via the standard input/change event flow, so the
  // existing handler/render() picks it up transparently.
  if (HT.datePicker && typeof HT.datePicker.enhance === 'function') {
    HT.qsa('.js-date-picker').forEach(function (el) {
      HT.datePicker.enhance(el, {});
    });
  }

  render();
})();