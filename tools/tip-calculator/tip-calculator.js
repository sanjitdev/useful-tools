/* ============================================
   Tip Calculator
   Computes tip, total and per-person split.
   ============================================ */

(function () {
  'use strict';

  var billEl = HT.$('#bill');
  var tipEl = HT.$('#tip');
  var peopleEl = HT.$('#people');
  var roundEl = HT.$('#round');

  function fmt(n) {
    if (!isFinite(n)) return '$—';
    return '$' + HT.formatNumber(n, { minFractionDigits: 2, maxFractionDigits: 2 });
  }

  function compute() {
    var bill = parseFloat(billEl.value);
    var tipPct = parseFloat(tipEl.value);
    var people = parseInt(peopleEl.value, 10);

    if (!isFinite(bill) || bill < 0) bill = 0;
    if (!isFinite(tipPct) || tipPct < 0) tipPct = 0;
    if (!isFinite(people) || people < 1) people = 1;

    var tipAmount = bill * (tipPct / 100);
    var total = bill + tipAmount;

    var perPersonExact = total / people;
    var perPersonTip = tipAmount / people;

    var displayedPerPerson = perPersonExact;
    if (roundEl.checked) {
      displayedPerPerson = Math.ceil(perPersonExact * 100) / 100;
    }

    HT.$('#tip-amount').textContent = fmt(tipAmount);
    HT.$('#total').textContent = fmt(total);
    HT.$('#per-person-exact').textContent = fmt(perPersonExact);
    HT.$('#per-person-tip').textContent = fmt(perPersonTip);
    HT.$('#per-person').textContent = fmt(displayedPerPerson);
    HT.$('#per-person-sub').textContent =
      'Per person · ' + people + ' ' + (people === 1 ? 'person' : 'people') +
      (roundEl.checked ? ' (rounded up)' : '');
  }

  var handler = HT.debounce(compute, 30);
  billEl.addEventListener('input', handler);
  tipEl.addEventListener('input', handler);
  peopleEl.addEventListener('input', handler);
  roundEl.addEventListener('change', compute);

  compute();
})();