/* ============================================
   BMI Calculator
   Two unit tabs: metric and imperial. Same result scale.
   ============================================ */

(function () {
  'use strict';

  var hCm = HT.$('#h-cm');
  var wKg = HT.$('#w-kg');
  var hFt = HT.$('#h-ft');
  var hIn = HT.$('#h-in');
  var wLb = HT.$('#w-lb');

  var bmiValueEl = HT.$('#bmi-value');
  var categoryEl = HT.$('#bmi-sub') || HT.$('#bmi-category');
  var rangeEl = HT.$('#bmi-range');
  var badgeEl = HT.$('#bmi-badge');
  var markerEl = HT.$('#bmi-marker');

  function classify(bmi) {
    if (bmi < 18.5) return { name: 'Underweight', cls: 'under' };
    if (bmi < 25) return { name: 'Normal', cls: 'normal' };
    if (bmi < 30) return { name: 'Overweight', cls: 'over' };
    if (bmi < 35) return { name: 'Obese I', cls: 'ob1' };
    if (bmi < 40) return { name: 'Obese II', cls: 'ob2' };
    return { name: 'Obese III', cls: 'ob3' };
  }

  // Map BMI 12-44 to 0-100% on the scale
  function bmiToPercent(bmi) {
    var minB = 12, maxB = 44;
    var pct = ((bmi - minB) / (maxB - minB)) * 100;
    return Math.max(0, Math.min(100, pct));
  }

  function update() {
    var heightM, weightKg;
    var activePanel = HT.$('[data-tab-panel="metric"]').style.display !== 'none' ? 'metric' : 'imperial';

    if (activePanel === 'metric') {
      var cm = parseFloat(hCm.value);
      var kg = parseFloat(wKg.value);
      if (!isFinite(cm) || !isFinite(kg) || cm <= 0 || kg <= 0) {
        bmiValueEl.textContent = '—';
        HT.$('#bmi-category').textContent = 'Enter valid values.';
        rangeEl.textContent = '—';
        badgeEl.textContent = 'Category: —';
        markerEl.style.left = '0%';
        return;
      }
      heightM = cm / 100;
      weightKg = kg;
    } else {
      var ft = parseFloat(hFt.value);
      var inch = parseFloat(hIn.value);
      var lb = parseFloat(wLb.value);
      if (!isFinite(ft) || !isFinite(inch) || !isFinite(lb) || ft <= 0 || lb <= 0) {
        bmiValueEl.textContent = '—';
        HT.$('#bmi-category').textContent = 'Enter valid values.';
        rangeEl.textContent = '—';
        badgeEl.textContent = 'Category: —';
        markerEl.style.left = '0%';
        return;
      }
      var totalIn = ft * 12 + inch;
      var totalCm = totalIn * 2.54;
      heightM = totalCm / 100;
      weightKg = lb * 0.45359237;
    }

    if (heightM <= 0 || weightKg <= 0) {
      bmiValueEl.textContent = '—';
      HT.$('#bmi-category').textContent = 'Height and weight must be positive.';
      return;
    }

    var bmi = weightKg / (heightM * heightM);
    var cls = classify(bmi);

    bmiValueEl.textContent = HT.formatNumber(bmi, { minFractionDigits: 1, maxFractionDigits: 1 }) + ' kg/m²';
    HT.$('#bmi-category').textContent = 'Category: ' + cls.name;
    badgeEl.textContent = 'Category: ' + cls.name;

    markerEl.style.left = bmiToPercent(bmi) + '%';

    // Healthy weight range for this height (BMI 18.5 - 24.9)
    var minW = 18.5 * heightM * heightM;
    var maxW = 24.9 * heightM * heightM;
    if (activePanel === 'metric') {
      rangeEl.textContent = HT.formatNumber(minW, { minFractionDigits: 1, maxFractionDigits: 1 }) +
        ' – ' + HT.formatNumber(maxW, { minFractionDigits: 1, maxFractionDigits: 1 }) + ' kg';
    } else {
      var minLb = minW / 0.45359237;
      var maxLb = maxW / 0.45359237;
      rangeEl.textContent = HT.formatNumber(minLb, { minFractionDigits: 1, maxFractionDigits: 1 }) +
        ' – ' + HT.formatNumber(maxLb, { minFractionDigits: 1, maxFractionDigits: 1 }) + ' lb';
    }
  }

  var h = HT.debounce(update, 60);
  [hCm, wKg, hFt, hIn, wLb].forEach(function (el) {
    el.addEventListener('input', h);
    el.addEventListener('change', update);
  });

  HT.makeTabs(HT.$('#unit-tabs'));

  update();
})();