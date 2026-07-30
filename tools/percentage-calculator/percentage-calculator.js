/* ============================================
   Percentage Calculator
   Three modes: X% of Y, X is what % of Y, % change.
   ============================================ */

(function () {
  'use strict';

  function fmtNum(n) {
    if (!isFinite(n)) return '—';
    return HT.formatNumber(n, { minFractionDigits: 0, maxFractionDigits: 4 });
  }

  function fmtPct(n) {
    if (!isFinite(n)) return '—';
    return HT.formatNumber(n, { minFractionDigits: 2, maxFractionDigits: 4 }) + '%';
  }

  // -------- Mode 1: X% of Y --------
  var ofX = HT.$('#of-x'), ofY = HT.$('#of-y');
  function updateOf() {
    var x = parseFloat(ofX.value), y = parseFloat(ofY.value);
    if (!isFinite(x) || !isFinite(y)) {
      HT.$('#of-result').textContent = '—';
      HT.$('#of-sub').textContent = 'Enter both numbers.';
      return;
    }
    var r = (x / 100) * y;
    HT.$('#of-result').textContent = fmtNum(r);
    HT.$('#of-sub').textContent = x + '% of ' + y + ' = ' + fmtNum(r);
    HT.$('#of-formula').textContent =
      'Worked: (' + x + ' / 100) × ' + y + ' = ' + fmtNum(r);
  }

  // -------- Mode 2: X is what % of Y --------
  var isX = HT.$('#is-x'), isY = HT.$('#is-y');
  function updateIs() {
    var x = parseFloat(isX.value), y = parseFloat(isY.value);
    if (!isFinite(x) || !isFinite(y) || y === 0) {
      HT.$('#is-result').textContent = '—';
      HT.$('#is-sub').textContent = y === 0 ? 'Y must not be zero.' : 'Enter both numbers.';
      return;
    }
    var r = (x / y) * 100;
    HT.$('#is-result').textContent = fmtPct(r);
    HT.$('#is-sub').textContent = x + ' is ' + fmtPct(r) + ' of ' + y;
    HT.$('#is-formula').textContent =
      'Worked: (' + x + ' / ' + y + ') × 100 = ' + fmtPct(r);
  }

  // -------- Mode 3: % change --------
  var chOld = HT.$('#ch-old'), chNew = HT.$('#ch-new');
  function updateChange() {
    var o = parseFloat(chOld.value), n = parseFloat(chNew.value);
    if (!isFinite(o) || !isFinite(n) || o === 0) {
      HT.$('#ch-result').textContent = '—';
      HT.$('#ch-sub').textContent = o === 0 ? 'Original value must not be zero.' : 'Enter both numbers.';
      return;
    }
    var r = ((n - o) / Math.abs(o)) * 100;
    var dir = r >= 0 ? 'increase' : 'decrease';
    HT.$('#ch-result').textContent = fmtPct(r) + ' (' + dir + ')';
    HT.$('#ch-sub').textContent =
      'From ' + fmtNum(o) + ' to ' + fmtNum(n) +
      ' is a change of ' + fmtNum(Math.abs(n - o)) +
      ' (' + fmtPct(Math.abs(r)) + ').';
    HT.$('#ch-formula').textContent =
      'Worked: ((' + n + ' − ' + o + ') / |' + o + '|) × 100 = ' + fmtPct(r);
  }

  HT.makeTabs(HT.$('#mode-tabs'));

  var debouncedOf = HT.debounce(updateOf, 30);
  var debouncedIs = HT.debounce(updateIs, 30);
  var debouncedCh = HT.debounce(updateChange, 30);

  ofX.addEventListener('input', debouncedOf);
  ofY.addEventListener('input', debouncedOf);
  isX.addEventListener('input', debouncedIs);
  isY.addEventListener('input', debouncedIs);
  chOld.addEventListener('input', debouncedCh);
  chNew.addEventListener('input', debouncedCh);

  updateOf();
  updateIs();
  updateChange();
})();