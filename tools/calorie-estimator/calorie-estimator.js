/* ============================================
   Calorie Estimator
   Mifflin-St Jeor BMR + activity multiplier TDEE,
   plus macro split suggestion.
   ============================================ */

(function () {
  'use strict';

  var out = {
    bmr: HT.$('#bmr'),
    tdee: HT.$('#tdee'),
    tdeeSub: HT.$('#tdee-sub'),
    multiplier: HT.$('#multiplier'),
    bmi: HT.$('#bmi'),
    lossFast: HT.$('#loss-fast'),
    lossHalf: HT.$('#loss-half'),
    maint: HT.$('#maint'),
    gainHalf: HT.$('#gain-half'),
    gainFast: HT.$('#gain-fast'),
    macroCarbs: HT.$('#macro-carbs'),
    macroCarbsG: HT.$('#macro-carbs-g'),
    macroProtein: HT.$('#macro-protein'),
    macroProteinG: HT.$('#macro-protein-g'),
    macroFat: HT.$('#macro-fat'),
    macroFatG: HT.$('#macro-fat-g'),
    warning: HT.$('#warning')
  };

  var calOpts = { minimumFractionDigits: 0, maximumFractionDigits: 0 };
  var gOpts = { minimumFractionDigits: 0, maximumFractionDigits: 0 };
  var bmiOpts = { minimumFractionDigits: 1, maximumFractionDigits: 1 };

  function getSex() {
    var active = HT.$('[data-tab-panel="metric"]').style.display !== 'none' ? 'metric' : 'imperial';
    var name = active === 'metric' ? 'sex' : 'sex-i';
    var checked = HT.qs('input[name="' + name + '"]:checked');
    return checked ? checked.value : 'male';
  }

  function getAge() {
    var active = HT.$('[data-tab-panel="metric"]').style.display !== 'none' ? 'metric' : 'imperial';
    var el = HT.$('#age-' + (active === 'metric' ? 'm' : 'i'));
    var v = parseInt(el.value, 10);
    return isFinite(v) && v > 0 ? v : 0;
  }

  function getActivity() {
    var active = HT.$('[data-tab-panel="metric"]').style.display !== 'none' ? 'metric' : 'imperial';
    var el = HT.$('#activity-' + (active === 'metric' ? 'm' : 'i'));
    return parseFloat(el.value) || 1.2;
  }

  function getMetric() {
    var active = HT.$('[data-tab-panel="metric"]').style.display !== 'none' ? 'metric' : 'imperial';
    var cm, kg;
    if (active === 'metric') {
      cm = Math.max(0, parseFloat(HT.$('#h-cm').value) || 0);
      kg = Math.max(0, parseFloat(HT.$('#w-kg').value) || 0);
    } else {
      var ft = Math.max(0, parseFloat(HT.$('#h-ft').value) || 0);
      var inch = Math.max(0, parseFloat(HT.$('#h-in').value) || 0);
      var lb = Math.max(0, parseFloat(HT.$('#w-lb').value) || 0);
      var totalIn = ft * 12 + inch;
      cm = totalIn * 2.54;
      kg = lb * 0.45359237;
    }
    return { cm: cm, kg: kg, active: active };
  }

  function calcBMR(sex, kg, cm, age) {
    var base = 10 * kg + 6.25 * cm - 5 * age;
    return sex === 'male' ? base + 5 : base - 161;
  }

  function calcBMI(kg, cm) {
    var m = cm / 100;
    return kg / (m * m);
  }

  function macroGrams(kcal, pct, kcalPerGram) {
    return (kcal * pct) / kcalPerGram;
  }

  function render() {
    out.warning.className = '';
    out.warning.innerHTML = '';

    var sex = getSex();
    var age = getAge();
    var activity = getActivity();
    var m = getMetric();

    if (!isFinite(m.kg) || !isFinite(m.cm) || m.kg <= 0 || m.cm <= 0 || age <= 0) {
      out.bmr.textContent = '—';
      out.tdee.textContent = '—';
      out.tdeeSub.textContent = 'Enter your stats to see your daily energy needs.';
      out.multiplier.textContent = '—';
      out.bmi.textContent = '—';
      out.lossFast.textContent = '—';
      out.lossHalf.textContent = '—';
      out.maint.textContent = '—';
      out.gainHalf.textContent = '—';
      out.gainFast.textContent = '—';
      out.macroCarbs.textContent = '—';
      out.macroCarbsG.textContent = '—';
      out.macroProtein.textContent = '—';
      out.macroProteinG.textContent = '—';
      out.macroFat.textContent = '—';
      out.macroFatG.textContent = '—';
      return;
    }

    var bmr = calcBMR(sex, m.kg, m.cm, age);
    var tdee = bmr * activity;
    var bmi = calcBMI(m.kg, m.cm);

    out.bmr.textContent = HT.formatNumber(bmr, calOpts) + ' kcal';
    out.tdee.textContent = HT.formatNumber(tdee, calOpts) + ' kcal/day';
    out.tdeeSub.textContent =
      'Maintenance estimate for ' + (sex === 'male' ? 'a male' : 'a female') +
      ', age ' + age + ', activity ×' + activity.toFixed(3).replace(/0+$/, '').replace(/\.$/, '') + '.';
    out.multiplier.textContent = '× ' + HT.formatNumber(activity, { minimumFractionDigits: 2, maximumFractionDigits: 3 });
    out.bmi.textContent = HT.formatNumber(bmi, bmiOpts);

    if (bmi < 18.5 || bmi > 30) {
      out.warning.className = 'warning';
      out.warning.innerHTML =
        '<strong>Note:</strong> BMI is ' + HT.formatNumber(bmi, bmiOpts) +
        ' (' + (bmi < 18.5 ? 'underweight' : (bmi >= 30 ? 'obese' : 'overweight')) +
        ' range). Calorie estimates are general guidelines; consult a professional for personalized advice.';
    }

    // Daily calorie targets: +/- 500 kcal from TDEE.
    out.lossFast.textContent = HT.formatNumber(tdee - 1000, calOpts) + ' kcal';
    out.lossHalf.textContent = HT.formatNumber(tdee - 500, calOpts) + ' kcal';
    out.maint.textContent = HT.formatNumber(tdee, calOpts) + ' kcal';
    out.gainHalf.textContent = HT.formatNumber(tdee + 500, calOpts) + ' kcal';
    out.gainFast.textContent = HT.formatNumber(tdee + 1000, calOpts) + ' kcal';

    // Macros at maintenance: 40/30/30 split.
    var carbsKcal = tdee * 0.40;
    var proteinKcal = tdee * 0.30;
    var fatKcal = tdee * 0.30;

    var carbsG = macroGrams(carbsKcal, 1, 4);   // kcal = grams*4
    var proteinG = macroGrams(proteinKcal, 1, 4);
    var fatG = macroGrams(fatKcal, 1, 9);        // kcal = grams*9

    out.macroCarbs.textContent = HT.formatNumber(carbsKcal, calOpts) + ' kcal';
    out.macroCarbsG.textContent = HT.formatNumber(carbsG, gOpts) + ' g/day';
    out.macroProtein.textContent = HT.formatNumber(proteinKcal, calOpts) + ' kcal';
    out.macroProteinG.textContent = HT.formatNumber(proteinG, gOpts) + ' g/day';
    out.macroFat.textContent = HT.formatNumber(fatKcal, calOpts) + ' kcal';
    out.macroFatG.textContent = HT.formatNumber(fatG, gOpts) + ' g/day';
  }

  var inputs = HT.qsa('.input, .select, .radio input');
  var handler = HT.debounce(render, 30);

  function attachInputs() {
    var root = document.body;
    HT.qsa('input, select', root).forEach(function (el) {
      el.addEventListener('input', handler);
    });
  }

  HT.makeTabs(HT.$('#unit-tabs'), function () {
    render();
  });

  attachInputs();
  render();
})();