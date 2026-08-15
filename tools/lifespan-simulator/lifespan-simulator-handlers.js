/* ============================================
   Lifespan Simulator — lifespan-simulator-handlers.js (Story 4b Phase 2)
   Lazy chunk: evaluate, WHAT_IFS, LIFESTYLE_FACTORS, plan functions,
   els/state, getAnswers, countFilledFields, confidenceLevel,
   habitScore, computeRange, appliedSliderDelta, fmtSigned/fmtYears,
   renderContributorList, renderResult, planCurrentLabel,
   openPlanTooltip/closePlanTooltip, buildPlanCard, renderPlan,
   buildSliders, populateCountries, updateBMI, wireInputs/wireTabs/
   wireResetAndCopy, onAnyChange, applyEmbedMode, fLabelFor, init.
   Reads constants from HT.lifespanSimulatorCore (parse-time).

   Loaded via HT.lazyLoadTool('lifespan-simulator', './lifespan-simulator-handlers.js')
   on DOMContentLoaded by core.js.

   Story 4b — see _bmad-output/implementation-artifacts/
   story-4b-per-tool-code-splitting.md
   ============================================ */

(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.HT) return;
  if (!window.HT.lifespanSimulatorCore) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('lifespan-simulator-handlers: HT.lifespanSimulatorCore missing — lifespan-simulator-core.js must load first.');
    }
    return;
  }
  var HT = window.HT;
  var core = HT.lifespanSimulatorCore;
  var WHO_DELTAS = core.WHO_DELTAS;
  var COUNTRIES = core.COUNTRIES;
  var SMOKING = core.SMOKING;
  var STRESS = core.STRESS;
  var BP = core.BP;
  var DIABETES = core.DIABETES;
  var HEART = core.HEART;
  var CHOLESTEROL = core.CHOLESTEROL;
  var CANCER = core.CANCER;
  var DEPRESSION = core.DEPRESSION;
  var SEATBELT = core.SEATBELT;
  var MOTORCYCLE = core.MOTORCYCLE;
  var DRUGS = core.DRUGS;
  var CHECKUPS = core.CHECKUPS;
  var VACCINES = core.VACCINES;
  var DENTAL = core.DENTAL;
  var FRUITVEG = core.FRUITVEG;
  var SUN = core.SUN;
  var POLLUTION = core.POLLUTION;
  var INCOME = core.INCOME;
  var EDUCATION = core.EDUCATION;
  var RELATIONSHIP = core.RELATIONSHIP;
  var baselineFor = core.baselineFor;
  var pickEnum = core.pickEnum;
  var clamp = core.clamp;

  /* ===========================================================
     4. Compute adjustments from a flat answer object
     =========================================================== */

  function evaluate(ans) {
    var contributions = [];
    var sum = 0;

    function add(value, table, key) {
      var e = pickEnum(table, key);
      if (!e) return;
      sum += e.delta;
      if (e.delta !== 0) {
        contributions.push({ label: e.label, delta: e.delta });
      }
    }

    // Enumerated factors
    add('smoking', SMOKING, ans.smoking);
    add('stress',  STRESS,  ans.stress);
    add('bp',      BP,      ans.bp);
    add('diabetes',DIABETES,ans.diabetes);
    add('heart',   HEART,   ans.heart);
    add('cholesterol', CHOLESTEROL, ans.cholesterol);
    add('cancer',  CANCER,  ans.cancer);
    add('depression', DEPRESSION, ans.depression);
    add('seatbelt',SEATBELT,ans.seatbelt);
    add('motorcycle', MOTORCYCLE, ans.motorcycle);
    add('drugs',   DRUGS,   ans.drugs);
    add('checkups',CHECKUPS,ans.checkups);
    add('vaccines',VACCINES,ans.vaccines);
    add('dental',  DENTAL,  ans.dental);
    add('fruitveg',FRUITVEG,ans.fruitveg);
    add('sun',     SUN,     ans.sun);
    add('pollution', POLLUTION, ans.pollution);
    add('income',  INCOME,  ans.income);
    add('education', EDUCATION, ans.education);
    add('relationship', RELATIONSHIP, ans.relationship);

    // Continuous factors

    // BMI
    if (isFinite(ans.bmi) && ans.bmi > 0) {
      if (ans.bmi >= 30) {
        sum += -2.5;
        contributions.push({ label: 'BMI ≥ 30', delta: -2.5 });
      } else if (ans.bmi >= 25) {
        sum += -0.8;
        contributions.push({ label: 'BMI 25–29.9 (overweight)', delta: -0.8 });
      } else if (ans.bmi >= 18.5) {
        sum += 0.6;
        contributions.push({ label: 'Healthy BMI', delta: 0.6 });
      } else {
        sum += -1.2;
        contributions.push({ label: 'BMI < 18.5 (underweight)', delta: -1.2 });
      }
    }

    // Exercise (min/day moderate)
    if (isFinite(ans.exercise)) {
      if (ans.exercise >= 60) {
        sum += 4.0;
        contributions.push({ label: 'Daily exercise (60+ min)', delta: 4.0 });
      } else if (ans.exercise >= 30) {
        sum += 2.5;
        contributions.push({ label: 'Daily exercise (30+ min)', delta: 2.5 });
      } else if (ans.exercise >= 15) {
        sum += 1.0;
        contributions.push({ label: 'Some daily exercise', delta: 1.0 });
      } else if (ans.exercise >= 1) {
        sum += -0.5;
        contributions.push({ label: 'Little exercise', delta: -0.5 });
      } else {
        sum += -3.0;
        contributions.push({ label: 'Sedentary (no exercise)', delta: -3.0 });
      }
    }

    // Sleep (hours/night)
    if (isFinite(ans.sleep)) {
      if (ans.sleep > 9) {
        sum += -0.7;
        contributions.push({ label: 'Long sleep (>9 h)', delta: -0.7 });
      } else if (ans.sleep >= 7 && ans.sleep <= 9) {
        sum += 0.8;
        contributions.push({ label: 'Healthy sleep (7–9 h)', delta: 0.8 });
      } else if (ans.sleep >= 6) {
        sum += -0.3;
        contributions.push({ label: 'Short sleep (<7 h)', delta: -0.3 });
      } else if (ans.sleep >= 5) {
        sum += -1.2;
        contributions.push({ label: 'Sleep deprivation', delta: -1.2 });
      } else {
        sum += -2.0;
        contributions.push({ label: 'Severe sleep deprivation', delta: -2.0 });
      }
    }

    // Alcohol (drinks/week)
    if (isFinite(ans.alcohol)) {
      if (ans.alcohol === 0) {
        sum += 0.3;
        contributions.push({ label: 'No alcohol', delta: 0.3 });
      } else if (ans.alcohol <= 7) {
        sum += 0;
      } else if (ans.alcohol <= 14) {
        sum += -0.5;
        contributions.push({ label: 'Moderate alcohol', delta: -0.5 });
      } else if (ans.alcohol <= 21) {
        sum += -1.5;
        contributions.push({ label: 'Heavy alcohol', delta: -1.5 });
      } else {
        sum += -3.0;
        contributions.push({ label: 'Very heavy alcohol', delta: -3.0 });
      }
    }

    // Fast food (meals/week)
    if (isFinite(ans.fastfood)) {
      if (ans.fastfood >= 7) {
        sum += -2.0;
        contributions.push({ label: 'Daily fast food', delta: -2.0 });
      } else if (ans.fastfood >= 3) {
        sum += -1.0;
        contributions.push({ label: 'Frequent fast food', delta: -1.0 });
      } else if (ans.fastfood <= 1) {
        sum += 0.3;
        contributions.push({ label: 'Minimal fast food', delta: 0.3 });
      }
    }

    // Sitting (hours/day)
    if (isFinite(ans.sitting)) {
      if (ans.sitting >= 11) {
        sum += -2.0;
        contributions.push({ label: 'Prolonged sitting (11+ h)', delta: -2.0 });
      } else if (ans.sitting >= 8) {
        sum += -1.0;
        contributions.push({ label: 'Long sitting time', delta: -1.0 });
      } else if (ans.sitting <= 4) {
        sum += 0.4;
        contributions.push({ label: 'Minimal sitting', delta: 0.4 });
      }
    }

    // Steps (thousands/day)
    if (isFinite(ans.steps)) {
      if (ans.steps >= 10) {
        sum += 1.5;
        contributions.push({ label: 'Very active (10k+ steps)', delta: 1.5 });
      } else if (ans.steps >= 7) {
        sum += 0.8;
        contributions.push({ label: 'Active (7–10k steps)', delta: 0.8 });
      } else if (ans.steps < 3) {
        sum += -1.0;
        contributions.push({ label: 'Very low steps (<3k)', delta: -1.0 });
      }
    }

    // Water (litres/day)
    if (isFinite(ans.water)) {
      if (ans.water < 0.8) {
        sum += -0.5;
        contributions.push({ label: 'Chronic dehydration', delta: -0.5 });
      }
    }

    // Screen time (hrs/day) — only as a soft nudge alongside other signals
    if (isFinite(ans.screen)) {
      if (ans.screen >= 10) {
        sum += -0.5;
        contributions.push({ label: 'Very high screen time', delta: -0.5 });
      }
    }

    // Family history heart / cancer / diabetes (light)
    if (ans.familyheart === 'yes') {
      sum += -1.5;
      contributions.push({ label: 'Family hx — heart disease', delta: -1.5 });
    }
    if (ans.familycancer === 'yes') {
      sum += -0.8;
      contributions.push({ label: 'Family hx — cancer', delta: -0.8 });
    }
    if (ans.familydiabetes === 'yes') {
      sum += -0.5;
      contributions.push({ label: 'Family hx — diabetes', delta: -0.5 });
    }

    // Interaction caps
    if (ans.smoking === 'daily' && isFinite(ans.alcohol) && ans.alcohol > 14) {
      sum += WHO_DELTAS.SYNERGY_SMOKING_ALCOHOL;
      contributions.push({ label: 'Smoking + heavy alcohol (synergy)', delta: WHO_DELTAS.SYNERGY_SMOKING_ALCOHOL });
    }
    if (ans.smoking === 'daily' && isFinite(ans.exercise) && ans.exercise < 10) {
      sum += WHO_DELTAS.SYNERGY_SMOKING_SEDENTARY;
      contributions.push({ label: 'Smoking + sedentary (synergy)', delta: WHO_DELTAS.SYNERGY_SMOKING_SEDENTARY });
    }

    return { sum: sum, contributions: contributions };
  }

  /* ===========================================================
     5. What-If presets
     =========================================================== */

  var WHAT_IFS = [
    {
      id: 'quit-smoking',
      title: 'Quit smoking',
      note: 'daily → never',
      deltaIfApplied: function (a) {
        var cur = SMOKING[a.smoking] || { delta: 0 };
        if (cur.delta === 0) return 0;
        return -cur.delta;
      }
    },
    {
      id: 'exercise-30',
      title: 'Exercise 30 min/day',
      note: 'moderate activity',
      deltaIfApplied: function (a) {
        var bonus = 2.5;
        if (a.exercise >= 30) return 0;
        if (a.exercise >= 15) return bonus - 1.0;
        if (a.exercise >= 1)  return bonus + 0.5;
        return bonus + 3.0;
      }
    },
    {
      id: 'sleep-8',
      title: 'Sleep 8 hours nightly',
      note: 'consistent schedule',
      deltaIfApplied: function (a) {
        if (a.sleep >= 7 && a.sleep <= 8.5) return 0;
        if (a.sleep < 5) return 1.5;
        if (a.sleep < 7) return 1.0;
        if (a.sleep > 9) return 0.5;
        return 0.5;
      }
    },
    {
      id: 'lose-10kg',
      title: 'Lose 10 kg',
      note: 'reach healthy BMI',
      deltaIfApplied: function (a) {
        if (!isFinite(a.bmi) || a.bmi <= 0) return 0;
        if (a.bmi < 25) return 0;
        if (a.bmi >= 30) return 1.6;
        return 1.0;
      }
    },
    {
      id: 'daily-fruitveg',
      title: 'Eat 5 servings fruit & veg daily',
      note: 'consistently',
      deltaIfApplied: function (a) {
        if (a.fruitveg === 'daily') return 0;
        if (a.fruitveg === 'weekly') return 1.0;
        return 1.5;
      }
    },
    {
      id: 'cut-fastfood',
      title: 'Cut fast food to ≤1/week',
      note: 'home cooking',
      deltaIfApplied: function (a) {
        if (!isFinite(a.fastfood)) return 0.7;
        if (a.fastfood <= 1) return 0;
        if (a.fastfood >= 7) return 1.5;
        return 1.0;
      }
    },
    {
      id: 'drink-water',
      title: 'Drink 2 L water daily',
      note: 'stay hydrated',
      deltaIfApplied: function (a) {
        if (isFinite(a.water) && a.water >= 1.8) return 0;
        if (isFinite(a.water) && a.water < 0.8) return 0.7;
        return 0.4;
      }
    },
    {
      id: 'wear-seatbelt',
      title: 'Always wear seatbelt',
      note: 'every trip',
      deltaIfApplied: function (a) {
        var cur = SEATBELT[a.seatbelt] || { delta: 0 };
        if (cur.delta === 0) return 0;
        return -cur.delta;
      }
    }
  ];

  /* ===========================================================
     5b. Plan-Your-Changes factors (Story 1.16)
     =========================================================== */

  var LIFESTYLE_FACTORS = [
    {
      id: 'smoking',
      label: 'Smoking',
      currentValue: function (ans) { return ans.smoking; },
      currentLabel: function (ans) {
        var v = (SMOKING[ans.smoking] || { label: '—' }).label;
        return 'Currently: ' + v;
      },
      targetDefault: 'never',
      targetControl: function (target, onChange) {
        var sel = document.createElement('select');
        sel.className = 'select';
        sel.id = 'ls-plan-target-smoking';
        [['never', 'Never (best)'], ['former', 'Former smoker'], ['occasional', 'Occasional']].forEach(function (kv) {
          var opt = document.createElement('option');
          opt.value = kv[0];
          opt.textContent = kv[1];
          if (kv[0] === target) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.addEventListener('change', function () { onChange(sel.value); });
        return sel;
      },
      deltaIfAdopted: function (ans, target) {
        var cur = SMOKING[ans.smoking] || { delta: 0 };
        var tgt = SMOKING[target] || { delta: 0 };
        var gain = cur.delta - tgt.delta;
        return gain > 0 ? gain : 0;
      },
      source: {
        title: 'WHO Tobacco fact sheet',
        quote: 'Smokers die about 10 years earlier than non-smokers; quitting at 30 recovers nearly all lost years, quitting at 60 adds about 3 years.',
        url: 'https://www.who.int/news-room/fact-sheets/detail/tobacco',
        sourceLabel: 'WHO + Jha et al., NEJM 2013'
      }
    },
    {
      id: 'alcohol',
      label: 'Alcohol',
      currentValue: function (ans) { return ans.alcohol; },
      currentLabel: function (ans) {
        if (!isFinite(ans.alcohol)) return 'Currently: —';
        return 'Currently: ' + HT.formatNumber(ans.alcohol, { maxFractionDigits: 0 }) + ' drinks/week';
      },
      targetDefault: 0,
      targetControl: function (target, onChange) {
        var inp = document.createElement('input');
        inp.type = 'number';
        inp.min = 0;
        inp.max = 0;
        inp.step = 1;
        inp.className = 'input';
        inp.id = 'ls-plan-target-alcohol';
        inp.value = target;
        inp.addEventListener('input', function () { onChange(parseFloat(inp.value) || 0); });
        return inp;
      },
      deltaIfAdopted: function (ans, target) {
        function deltaForDrinks(v) {
          if (!isFinite(v)) return 0;
          if (v === 0) return 0.3;
          if (v <= 7) return 0;
          if (v <= 14) return -0.5;
          if (v <= 21) return -1.5;
          return -3.0;
        }
        var cur = deltaForDrinks(ans.alcohol);
        var tgt = deltaForDrinks(target);
        var gain = cur - tgt;
        return gain > 0 ? gain : 0;
      },
      source: {
        title: 'WHO Alcohol fact sheet',
        quote: 'Harmful alcohol use causes 3 million deaths per year (5.3% of all deaths). WHO states there is no safe level for alcohol consumption.',
        url: 'https://www.who.int/news-room/fact-sheets/detail/alcohol',
        sourceLabel: 'WHO Global Status Report on Alcohol & Health'
      }
    },
    {
      id: 'exercise',
      label: 'Moderate exercise',
      currentValue: function (ans) { return ans.exercise; },
      currentLabel: function (ans) {
        if (!isFinite(ans.exercise)) return 'Currently: —';
        return 'Currently: ' + HT.formatNumber(ans.exercise, { maxFractionDigits: 0 }) + ' min/day';
      },
      targetDefault: 30,
      targetControl: function (target, onChange) {
        var inp = document.createElement('input');
        inp.type = 'number';
        inp.min = 0;
        inp.max = 120;
        inp.step = 5;
        inp.className = 'input';
        inp.id = 'ls-plan-target-exercise';
        inp.value = target;
        inp.addEventListener('input', function () { onChange(parseFloat(inp.value) || 0); });
        return inp;
      },
      deltaIfAdopted: function (ans, target) {
        function deltaForMin(v) {
          if (!isFinite(v)) return 0;
          if (v >= 60) return 4.0;
          if (v >= 30) return 2.5;
          if (v >= 15) return 1.0;
          if (v >= 1)  return -0.5;
          return -3.0;
        }
        var cur = deltaForMin(ans.exercise);
        var tgt = deltaForMin(target);
        var gain = cur - tgt;
        return gain > 0 ? gain : 0;
      },
      source: {
        title: 'WHO 2020 Guidelines on Physical Activity',
        quote: 'Adults should do at least 150–300 minutes of moderate-intensity aerobic physical activity per week. Meeting this goal is associated with about 3–4 years of life gained vs. being inactive.',
        url: 'https://www.who.int/publications/i/item/9789240015128',
        sourceLabel: 'WHO 2020 Guidelines; Moore et al., BMJ 2012'
      }
    },
    {
      id: 'sleep',
      label: 'Sleep',
      currentValue: function (ans) { return ans.sleep; },
      currentLabel: function (ans) {
        if (!isFinite(ans.sleep)) return 'Currently: —';
        return 'Currently: ' + HT.formatNumber(ans.sleep, { maxFractionDigits: 1 }) + ' h/night';
      },
      targetDefault: 8,
      targetControl: function (target, onChange) {
        var inp = document.createElement('input');
        inp.type = 'number';
        inp.min = 5;
        inp.max = 10;
        inp.step = 0.5;
        inp.className = 'input';
        inp.id = 'ls-plan-target-sleep';
        inp.value = target;
        inp.addEventListener('input', function () { onChange(parseFloat(inp.value) || 8); });
        return inp;
      },
      deltaIfAdopted: function (ans, target) {
        function deltaForSleep(v) {
          if (!isFinite(v)) return 0;
          if (v > 9) return -0.7;
          if (v >= 7 && v <= 9) return 0.8;
          if (v >= 6) return -0.3;
          if (v >= 5) return -1.2;
          return -2.0;
        }
        var cur = deltaForSleep(ans.sleep);
        var tgt = deltaForSleep(target);
        var gain = cur - tgt;
        return gain > 0 ? gain : 0;
      },
      source: {
        title: 'Sleep duration & mortality (non-WHO)',
        quote: 'Adults sleeping 7–9 hours per night have the lowest all-cause mortality; shorter and longer sleep are both associated with modestly higher risk. WHO does not publish a dedicated sleep fact sheet; this guidance is drawn from CDC/NSF.',
        url: 'https://www.cdc.gov/sleep/about_sleep/how_much_sleep.html',
        sourceLabel: 'CDC/NSF (non-WHO source — flagged in tooltip)'
      }
    },
    {
      id: 'bmi',
      label: 'BMI',
      currentValue: function (ans) { return ans.bmi; },
      currentLabel: function (ans) {
        if (!isFinite(ans.bmi) || ans.bmi <= 0) return 'Currently: —';
        return 'Currently: ' + HT.formatNumber(ans.bmi, { minFractionDigits: 1, maxFractionDigits: 1 });
      },
      targetDefault: 22,
      targetControl: function (target, onChange) {
        var inp = document.createElement('input');
        inp.type = 'number';
        inp.min = 15;
        inp.max = 40;
        inp.step = 0.5;
        inp.className = 'input';
        inp.id = 'ls-plan-target-bmi';
        inp.value = target;
        inp.addEventListener('input', function () { onChange(parseFloat(inp.value) || 22); });
        return inp;
      },
      deltaIfAdopted: function (ans, target) {
        function deltaForBmi(v) {
          if (!isFinite(v) || v <= 0) return 0;
          if (v >= 30) return -2.5;
          if (v >= 25) return -0.8;
          if (v >= 18.5) return 0.6;
          return -1.2;
        }
        var cur = deltaForBmi(ans.bmi);
        var tgt = deltaForBmi(target);
        var gain = cur - tgt;
        return gain > 0 ? gain : 0;
      },
      source: {
        title: 'WHO Obesity & Overweight fact sheet',
        quote: 'Obesity (BMI ≥ 30) is associated with a 5–10 year reduction in life expectancy; class III obesity (BMI ≥ 40) with 8–13 years. Healthy BMI is 18.5–24.9.',
        url: 'https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight',
        sourceLabel: 'WHO + Lancet GBD'
      }
    },
    {
      id: 'diet',
      label: 'Diet (fast food + fruit/veg)',
      currentValue: function (ans) { return { fastfood: ans.fastfood, fruitveg: ans.fruitveg }; },
      currentLabel: function (ans) {
        var parts = [];
        if (isFinite(ans.fastfood)) parts.push(HT.formatNumber(ans.fastfood, { maxFractionDigits: 0 }) + ' fast-food meals/wk');
        if (ans.fruitveg) parts.push((FRUITVEG[ans.fruitveg] || { label: ans.fruitveg }).label.toLowerCase());
        return 'Currently: ' + (parts.length ? parts.join('; ') : '—');
      },
      targetDefault: { fastfood: 1, fruitveg: 'daily' },
      targetControl: function (target, onChange) {
        var wrap = document.createElement('div');
        wrap.style.display = 'flex';
        wrap.style.gap = '8px';
        wrap.style.flexWrap = 'wrap';

        var fast = document.createElement('input');
        fast.type = 'number';
        fast.min = 0;
        fast.max = 30;
        fast.step = 1;
        fast.className = 'input';
        fast.id = 'ls-plan-target-diet-fastfood';
        fast.value = target.fastfood;
        fast.style.maxWidth = '120px';
        fast.setAttribute('aria-label', 'Target fast-food meals per week');

        var fv = document.createElement('select');
        fv.className = 'select';
        fv.id = 'ls-plan-target-diet-fruitveg';
        [['daily', 'Daily (best)'], ['weekly', 'A few times/wk'], ['rarely', 'Rarely']].forEach(function (kv) {
          var opt = document.createElement('option');
          opt.value = kv[0];
          opt.textContent = kv[1];
          if (kv[0] === target.fruitveg) opt.selected = true;
          fv.appendChild(opt);
        });
        fv.style.maxWidth = '160px';

        function emit() {
          onChange({ fastfood: parseFloat(fast.value) || 0, fruitveg: fv.value });
        }
        fast.addEventListener('input', emit);
        fv.addEventListener('change', emit);
        wrap.appendChild(fast);
        wrap.appendChild(fv);
        return wrap;
      },
      deltaIfAdopted: function (ans, target) {
        function deltaForFast(v) {
          if (!isFinite(v)) return 0;
          if (v >= 7) return -2.0;
          if (v >= 3) return -1.0;
          if (v <= 1) return 0.3;
          return 0;
        }
        function deltaForFv(v) {
          return (FRUITVEG[v] || { delta: 0 }).delta;
        }
        var curFast = deltaForFast(ans.fastfood);
        var curFv = deltaForFv(ans.fruitveg);
        var tgtFast = deltaForFast(target.fastfood);
        var tgtFv = deltaForFv(target.fruitveg);
        var gain = (curFast + curFv) - (tgtFast + tgtFv);
        return gain > 0 ? gain : 0;
      },
      source: {
        title: 'WHO Salt-reduction & diet fact sheet',
        quote: 'Insufficient fruit and vegetable intake is linked to millions of cardiovascular deaths/year; high sodium intake alone causes ~1.8 million deaths/year. WHO recommends < 2,000 mg sodium/day and ≥ 400 g fruit/veg/day.',
        url: 'https://www.who.int/news-room/fact-sheets/detail/salt-reduction',
        sourceLabel: 'WHO + WHO SHAKE package'
      }
    }
  ];

  /* ===========================================================
     5c. Compute the plan-tab net (Story 1.16)
     Strict "no cancel-out" rule.
     =========================================================== */

  function sumOfCurrentNegatives(ans) {
    var ev = evaluate(ans);
    var sum = 0;
    ev.contributions.forEach(function (c) {
      if (c.delta < 0) sum += c.delta;
    });
    return sum;
  }

  function computePlanNet(ans, planTargets) {
    var sumNeg = sumOfCurrentNegatives(ans);
    var capping = sumNeg < 0;

    var perFactor = LIFESTYLE_FACTORS.map(function (f) {
      var target = planTargets[f.id];
      if (target === undefined) target = f.targetDefault;
      var nominal = f.deltaIfAdopted(ans, target);
      var effective = capping ? 0 : nominal;
      return {
        id: f.id,
        label: f.label,
        nominal: nominal,
        effective: effective,
        capped: capping && nominal > 0,
        source: f.source
      };
    });

    var net = 0;
    perFactor.forEach(function (p) { net += p.effective; });

    return {
      net: net,
      capping: capping,
      sumNeg: sumNeg,
      perFactor: perFactor
    };
  }

  /* ===========================================================
     5d. Plan-tab persistence (Story 1.16)
     =========================================================== */

  var PLAN_STORAGE_KEY = 'handy-tools.lifespan-simulator.plan';

  function planDefaultTargets() {
    var d = {};
    LIFESTYLE_FACTORS.forEach(function (f) { d[f.id] = f.targetDefault; });
    return d;
  }

  function persistPlan() {
    try {
      if (HT.storage && HT.storage.set) {
        HT.storage.set(PLAN_STORAGE_KEY, state.planTargets);
      } else {
        localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(state.planTargets));
      }
    } catch (_) {}
  }

  function hydratePlan() {
    try {
      var raw = null;
      if (HT.storage && HT.storage.get) {
        raw = HT.storage.get(PLAN_STORAGE_KEY);
      } else {
        raw = localStorage.getItem(PLAN_STORAGE_KEY);
      }
      if (raw) {
        var parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed && typeof parsed === 'object') {
          state.planTargets = Object.assign(planDefaultTargets(), parsed);
          return;
        }
      }
    } catch (_) {}
    state.planTargets = planDefaultTargets();
  }

  /* ===========================================================
     6. UI references & state
     =========================================================== */

  var els = {
    years:        HT.$('#ls-years'),
    range:        HT.$('#ls-range'),
    date:         HT.$('#ls-date'),
    confidence:   HT.$('#ls-confidence'),
    score:        HT.$('#ls-score'),
    extenders:    HT.$('#ls-extenders'),
    risks:        HT.$('#ls-risks'),
    baseline:     HT.$('#ls-baseline'),
    sliders:      HT.$('#ls-sliders'),
    applied:      HT.$('#ls-applied'),
    resetSliders: HT.$('#ls-reset-sliders'),
    share:        HT.$('#ls-share'),
    copy:         HT.$('#ls-copy'),
    planGrid:     HT.$('#ls-plan-grid'),
    planNet:      HT.$('#ls-plan-net'),
    planNetValue: HT.$('#ls-plan-net-value'),
    planNetSub:   HT.$('#ls-plan-net-sub'),
    planBaseline: HT.$('#ls-plan-baseline'),
    planApplied:  HT.$('#ls-plan-applied'),
    planReset:    HT.$('#ls-plan-reset')
  };

  var state = {
    mode: 'quick',
    baselineYears: null,
    sliderOverrides: {},
    planTargets: {},
    // Story 9.13 — quiz-mode answer cache. Populated by the quiz
    // shell's onChange callback so renderPlan() reads the same numbers
    // the quiz produced (without syncing 36 form fields). getAnswers()
    // prefers form-DOM values when present (form mode = source of truth)
    // and falls back to state.answers when the user came from quiz mode
    // and the form fields haven't been touched.
    answers: {}
  };

  /* ===========================================================
     7. Form → answer object
     =========================================================== */

  function getAnswers() {
    // Story 9.13 — if quiz mode populated state.answers, prefer those.
    // The quiz has its own neutral-default contract (skip = neutral), so
    // we don't need to apply the form-mode mode-specific defaults here.
    if (state.answers && Object.keys(state.answers).length > 0) {
      var qa = state.answers;
      var qdob = qa.dob ? new Date(qa.dob) : null;
      var qage = qdob ? Math.floor((Date.now() - qdob.getTime()) / (365.25 * 86400000)) : NaN;
      var qbmi = (isFinite(qa.height) && isFinite(qa.weight) && qa.height > 0)
        ? qa.weight / Math.pow(qa.height / 100, 2)
        : NaN;
      var out = Object.assign({}, qa);
      out.dob = qdob;
      out.age = qage;
      out.bmi = qbmi;
      return out;
    }
    var suf = state.mode === 'full' ? '-f' : '';
    function num(id) {
      var v = parseFloat(HT.$('#ls-' + id + suf).value);
      return isFinite(v) ? v : NaN;
    }
    function str(id) {
      return HT.$('#ls-' + id + suf).value;
    }
    function dateStr(id) {
      return HT.$('#ls-' + id + suf).value;
    }

    var dobStr = dateStr('dob');
    var dob = dobStr ? new Date(dobStr) : null;
    var age = dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 86400000)) : NaN;

    var heightCm = num('height');
    var weightKg = num('weight');
    var bmi = (isFinite(heightCm) && isFinite(weightKg) && heightCm > 0)
      ? weightKg / Math.pow(heightCm / 100, 2)
      : NaN;

    return {
      dob: dob,
      age: age,
      sex: str('sex'),
      country: str('country'),
      height: heightCm,
      weight: weightKg,
      bmi: bmi,

      smoking:    str('smoking'),
      alcohol:    num('alcohol'),
      exercise:   num('exercise'),
      sleep:      num('sleep'),
      stress:     str('stress'),
      fruitveg:   str('fruitveg'),
      fastfood:   state.mode === 'full' ? num('fastfood') : NaN,
      water:      state.mode === 'full' ? num('water')    : NaN,
      sitting:    state.mode === 'full' ? num('sitting')  : NaN,
      steps:      state.mode === 'full' ? num('steps')    : NaN,
      sun:        state.mode === 'full' ? str('sun')      : 'moderate',

      bp:         state.mode === 'full' ? str('bp')         : 'normal',
      diabetes:   state.mode === 'full' ? str('diabetes')   : 'no',
      heart:      state.mode === 'full' ? str('heart')      : 'no',
      cholesterol:state.mode === 'full' ? str('cholesterol'): 'no',
      cancer:     state.mode === 'full' ? str('cancer')     : 'no',
      depression: state.mode === 'full' ? str('depression') : 'no',
      familyheart: state.mode === 'full' ? str('familyheart')   : 'no',
      familycancer:state.mode === 'full' ? str('familycancer')  : 'no',
      familydiabetes:state.mode === 'full' ? str('familydiabetes'): 'no',

      seatbelt:   state.mode === 'full' ? str('seatbelt')   : str('seatbelt'),
      motorcycle: state.mode === 'full' ? str('motorcycle') : 'none',
      drugs:      str('drugs'),
      checkups:   str('checkups'),
      vaccines:   state.mode === 'full' ? str('vaccines')   : 'yes',
      dental:     state.mode === 'full' ? str('dental')     : 'regular',
      screen:     state.mode === 'full' ? num('screen')     : NaN,

      pollution:    state.mode === 'full' ? str('pollution')    : 'low',
      income:       state.mode === 'full' ? str('income')       : 'middle',
      education:    state.mode === 'full' ? str('education')    : 'secondary',
      relationship: state.mode === 'full' ? str('relationship') : 'partner'
    };
  }

  /* ===========================================================
     8. Confidence + Healthy Habit Score
     =========================================================== */

  function countFilledFields(ans) {
    var filled = 0, total = 0;
    function count(v, neutral) {
      total++;
      if (v !== '' && v !== null && !(typeof v === 'number' && !isFinite(v))) {
        if (neutral === undefined || v !== neutral) filled++;
      }
    }
    count(ans.dob, '');
    count(ans.sex, 'female');
    count(ans.country, '');
    count(ans.height, NaN);
    count(ans.weight, NaN);
    count(ans.smoking, 'never');
    count(ans.alcohol, NaN);
    count(ans.exercise, NaN);
    count(ans.sleep, NaN);
    count(ans.stress, 'moderate');
    count(ans.fruitveg, 'daily');
    if (state.mode === 'full') {
      count(ans.fastfood, NaN);
      count(ans.water, NaN);
      count(ans.sitting, NaN);
      count(ans.steps, NaN);
      count(ans.sun, 'moderate');
      count(ans.bp, 'normal');
      count(ans.diabetes, 'no');
      count(ans.heart, 'no');
      count(ans.cholesterol, 'no');
      count(ans.cancer, 'no');
      count(ans.depression, 'no');
      count(ans.familyheart, 'no');
      count(ans.familycancer, 'no');
      count(ans.familydiabetes, 'no');
      count(ans.motorcycle, 'none');
      count(ans.vaccines, 'yes');
      count(ans.dental, 'regular');
      count(ans.screen, NaN);
      count(ans.pollution, 'low');
      count(ans.income, 'middle');
      count(ans.education, 'secondary');
      count(ans.relationship, 'partner');
    }
    count(ans.seatbelt, 'always');
    count(ans.drugs, 'never');
    count(ans.checkups, 'yearly');
    return { filled: filled, total: total };
  }

  function confidenceLevel(pct) {
    if (pct >= 0.8) return { text: 'High', color: 'success' };
    if (pct >= 0.5) return { text: 'Medium', color: 'accent' };
    return { text: 'Low', color: 'muted' };
  }

  function habitScore(contributions) {
    var pos = 0, neg = 0;
    contributions.forEach(function (c) {
      if (c.delta > 0) pos += c.delta;
      else neg += c.delta;
    });
    var score = 50 + (pos * 3) + (neg * 3);
    return clamp(Math.round(score), 0, 100);
  }

  /* ===========================================================
     9. Range computation
     =========================================================== */

  function computeRange(years, filledPct) {
    var spread = 6 - (filledPct * 4);
    spread = Math.max(2, Math.min(6, spread));
    return {
      low:  Math.max(40, years - spread),
      high: Math.min(110, years + spread)
    };
  }

  /* ===========================================================
     10. Slider delta accumulation
     =========================================================== */

  function appliedSliderDelta(ans) {
    var total = 0;
    var active = [];
    WHAT_IFS.forEach(function (s) {
      if (state.sliderOverrides[s.id]) {
        var d = s.deltaIfApplied(ans);
        total += d;
        if (d !== 0) active.push(s.title);
      }
    });
    return { total: total, active: active };
  }

  /* ===========================================================
     11. Rendering
     =========================================================== */

  function fmtSigned(n) {
    var rounded = Math.round(n * 10) / 10;
    if (rounded === 0) return '0.0 yr';
    return (rounded > 0 ? '+' : '') + rounded.toFixed(1) + ' yr';
  }

  function renderContributorList(el, items, kind) {
    el.innerHTML = '';
    if (!items.length) {
      var li = document.createElement('li');
      li.className = 'empty-state';
      li.textContent = kind === 'pos'
        ? 'No strong positive contributors yet — try adopting a healthy habit.'
        : 'No major risk factors — keep going.';
      el.appendChild(li);
      return;
    }
    items.forEach(function (c) {
      var li = document.createElement('li');
      li.className = 'contributor ' + (c.delta > 0 ? 'positive' : 'negative');
      li.innerHTML =
        '<span class="contributor-label">' + c.label + '</span>' +
        '<span class="contributor-delta">' + fmtSigned(c.delta) + '</span>';
      el.appendChild(li);
    });
  }

  function renderResult() {
    var ans = getAnswers();
    var ev = evaluate(ans);

    var baselineYears = clamp(baselineFor(ans.country, ans.sex) + ev.sum, 40, 110);
    state.baselineYears = baselineYears;

    var sliderInfo = appliedSliderDelta(ans);
    var finalYears = clamp(baselineYears + sliderInfo.total, 40, 110);

    var fillStats = countFilledFields(ans);
    var range = computeRange(baselineYears, fillStats.filled / Math.max(1, fillStats.total));

    els.years.textContent = HT.formatNumber(finalYears, { minFractionDigits: 1, maxFractionDigits: 1 }) + ' years';
    els.range.textContent = 'Expected age range: ' +
      HT.formatNumber(range.low, { minFractionDigits: 0, maxFractionDigits: 0 }) + '–' +
      HT.formatNumber(range.high, { minFractionDigits: 0, maxFractionDigits: 0 }) + ' years (statistical estimate, not a prediction)';

    if (ans.dob) {
      var d = new Date(ans.dob.getTime());
      d.setFullYear(d.getFullYear() + Math.round(finalYears));
      els.date.textContent = HT.formatDateShort(d);
    } else {
      els.date.textContent = '—';
    }

    var conf = confidenceLevel(fillStats.filled / Math.max(1, fillStats.total));
    els.confidence.textContent = conf.text + ' (' + fillStats.filled + '/' + fillStats.total + ')';

    els.score.textContent = habitScore(ev.contributions) + '/100';

    var pos = ev.contributions.filter(function (c) { return c.delta > 0; })
      .sort(function (a, b) { return b.delta - a.delta; })
      .slice(0, 4);
    var neg = ev.contributions.filter(function (c) { return c.delta < 0; })
      .sort(function (a, b) { return a.delta - b.delta; })
      .slice(0, 4);
    renderContributorList(els.extenders, pos, 'pos');
    renderContributorList(els.risks, neg, 'neg');

    els.baseline.textContent = HT.formatNumber(baselineYears, { minFractionDigits: 1, maxFractionDigits: 1 }) + ' years';

    var activeLabels = sliderInfo.active;
    if (activeLabels.length === 0) {
      els.applied.textContent = 'No changes applied.';
    } else {
      els.applied.textContent = 'Applied: ' + activeLabels.join(', ') +
        ' (' + fmtSigned(sliderInfo.total) + ')';
    }

    WHAT_IFS.forEach(function (s) {
      var d = s.deltaIfApplied(ans);
      var badge = HT.$('#slider-delta-' + s.id);
      var input = HT.$('#slider-input-' + s.id);
      if (badge) {
        badge.textContent = d === 0 ? 'no change' : fmtSigned(d);
        badge.className = 'slider-delta ' + (d > 0 ? 'is-positive' : d < 0 ? 'is-negative' : 'is-neutral');
      }
      if (input) input.disabled = (d === 0);
    });

    var strengthsText = pos.length ? pos[0].label.toLowerCase() : 'balanced habits';
    var risksText = neg.length ? neg[0].label.toLowerCase() : 'few risk factors';
    var yearsStr = HT.formatNumber(finalYears, { minFractionDigits: 0, maxFractionDigits: 0 });
    var summary =
      'My estimated lifespan is ' + yearsStr +
      ' years (statistical estimate, not a prediction). My biggest health strength is ' +
      strengthsText + ', while ' + risksText + ' is my biggest risk factor. ' +
      'Try the Lifespan Simulator and compare your result.';
    els.share.innerHTML = '<strong>' + yearsStr + ' years.</strong> ' +
      'My estimated lifespan is ' + yearsStr +
      ' years (statistical estimate, not a prediction). My biggest health strength is ' +
      strengthsText + ', while ' + risksText + ' is my biggest risk factor. ' +
      'Try the Lifespan Simulator and compare your result.';

    if (state.mode === 'plan') {
      renderPlan();
    }
  }

  /* ===========================================================
     11b. Render Plan tab (Story 1.16)
     =========================================================== */

  function planCurrentLabel(f, ans) {
    try { return f.currentLabel(ans); } catch (_) { return 'Currently: —'; }
  }

  function fmtYears(n) {
    var rounded = Math.round(n * 10) / 10;
    if (rounded === 0) return '0.0 yr';
    return (rounded > 0 ? '+' : '') + rounded.toFixed(1) + ' yr';
  }

  function closePlanTooltip() {
    var open = HT.$('#ls-plan-tooltip');
    if (open) open.parentNode.removeChild(open);
  }

  function openPlanTooltip(btn, source) {
    closePlanTooltip();
    var tip = document.createElement('div');
    tip.id = 'ls-plan-tooltip';
    tip.className = 'ls-tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.innerHTML =
      '<h4>' + source.title + '</h4>' +
      '<p>' + source.quote + '</p>' +
      '<p class="ls-tooltip-source">Source: ' +
        '<a href="' + source.url + '" target="_blank" rel="noopener noreferrer">' +
        source.sourceLabel + '</a></p>';
    document.body.appendChild(tip);
    var rect = btn.getBoundingClientRect();
    tip.style.top = (window.scrollY + rect.bottom + 6) + 'px';
    tip.style.left = (window.scrollX + rect.left) + 'px';
    setTimeout(function () {
      document.addEventListener('click', onDocClickForTooltip, true);
      document.addEventListener('keydown', onEscForTooltip, true);
    }, 0);
    function onDocClickForTooltip(e) {
      if (tip.contains(e.target) || btn.contains(e.target)) return;
      closePlanTooltip();
      document.removeEventListener('click', onDocClickForTooltip, true);
      document.removeEventListener('keydown', onEscForTooltip, true);
    }
    function onEscForTooltip(e) {
      if (e.key === 'Escape') {
        closePlanTooltip();
        document.removeEventListener('click', onDocClickForTooltip, true);
        document.removeEventListener('keydown', onEscForTooltip, true);
        btn.focus();
      }
    }
  }

  function buildPlanCard(f, ans, computed) {
    var card = document.createElement('div');
    card.className = 'slider-card plan-card-relative';
    card.setAttribute('data-plan-factor', f.id);

    var current = planCurrentLabel(f, ans);
    var target = state.planTargets[f.id];
    if (target === undefined) target = f.targetDefault;

    var nominal = computed.nominal;
    var effective = computed.effective;
    var capped = computed.capped;

    var nominalCls = nominal > 0 ? 'is-positive' : nominal < 0 ? 'is-negative' : 'is-neutral';
    var effectiveCls = effective > 0 ? 'is-positive' : effective < 0 ? 'is-negative' : 'is-neutral';

    var head = document.createElement('div');
    head.className = 'slider-card-head';

    var title = document.createElement('span');
    title.className = 'slider-card-title';
    title.textContent = f.label;

    var infoBtn = document.createElement('button');
    infoBtn.type = 'button';
    infoBtn.className = 'ls-info-btn';
    infoBtn.setAttribute('aria-label', 'Why this delta? ' + f.label + ' — opens source citation');
    infoBtn.textContent = 'i';
    infoBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      openPlanTooltip(infoBtn, f.source);
    });

    head.appendChild(title);
    head.appendChild(infoBtn);
    card.appendChild(head);

    var currentRow = document.createElement('div');
    currentRow.className = 'plan-card-current';
    currentRow.innerHTML = current;
    card.appendChild(currentRow);

    var targetRow = document.createElement('div');
    targetRow.className = 'plan-card-target-row';
    var field = document.createElement('div');
    field.className = 'field';
    var label = document.createElement('label');
    label.className = 'field-label';
    label.textContent = 'Target';
    label.id = 'ls-plan-target-label-' + f.id;
    field.appendChild(label);
    var control = f.targetControl(target, function (newTarget) {
      state.planTargets[f.id] = newTarget;
      persistPlan();
      renderPlan();
    });
    if (control && control.id) {
      var lbl = HT.$('#' + control.id);
      if (lbl) lbl.setAttribute('aria-labelledby', label.id);
    }
    field.appendChild(control);
    targetRow.appendChild(field);
    card.appendChild(targetRow);

    var meta = document.createElement('div');
    meta.className = 'slider-meta';
    var nominalBadge = document.createElement('span');
    nominalBadge.className = 'slider-delta ' + nominalCls;
    nominalBadge.setAttribute('aria-label',
      'Nominal gain ' + fmtYears(nominal) + (capped ? ' — capped to zero because you have other negative factors' : ''));
    nominalBadge.textContent = capped ? 'capped to 0' : (nominal === 0 ? 'no change' : fmtYears(nominal));
    var currentSpan = document.createElement('span');
    currentSpan.className = 'slider-current';
    currentSpan.textContent = 'If adopted: ' + fmtYears(effective);

    meta.appendChild(nominalBadge);
    meta.appendChild(currentSpan);
    card.appendChild(meta);

    if (capped) {
      var chip = document.createElement('span');
      chip.className = 'ls-warning-chip';
      chip.setAttribute('role', 'status');
      chip.textContent = '⚠ Gain capped — address your negative factors first.';
      card.appendChild(chip);
    }

    return card;
  }

  function renderPlan() {
    if (!els.planGrid) return;
    var ans = getAnswers();
    var plan = computePlanNet(ans, state.planTargets);

    var sign = 'neutral';
    if (plan.net > 0.05) sign = 'positive';
    else if (plan.net < -0.05) sign = 'negative';
    els.planNet.setAttribute('data-sign', sign);

    if (plan.capping) {
      els.planNetValue.textContent = '+0.0 yr';
      els.planNetSub.textContent =
        'Every positive plan gain is capped to 0 because you have ' +
        'negative factors (sum ' + fmtYears(plan.sumNeg) + '). ' +
        'Address those first — WHO: risk factors compound, not cancel.';
    } else if (plan.net > 0) {
      els.planNetValue.textContent = '+' + (Math.round(plan.net * 10) / 10).toFixed(1) + ' yr';
      els.planNetSub.textContent =
        'Projected life extension if you adopt these targets (statistical estimate, not a prediction).';
    } else if (plan.net < 0) {
      els.planNetValue.textContent = (Math.round(plan.net * 10) / 10).toFixed(1) + ' yr';
      els.planNetSub.textContent =
        'These targets would shorten your statistical estimate. Pick healthier targets to gain years.';
    } else {
      els.planNetValue.textContent = '0.0 yr';
      els.planNetSub.textContent = 'No net change from these targets.';
    }

    var ev = evaluate(ans);
    var baselineYears = clamp(baselineFor(ans.country, ans.sex) + ev.sum, 40, 110);
    els.planBaseline.textContent = HT.formatNumber(baselineYears, { minFractionDigits: 1, maxFractionDigits: 1 }) + ' years';

    els.planGrid.innerHTML = '';
    plan.perFactor.forEach(function (p) {
      var f = LIFESTYLE_FACTORS.filter(function (x) { return x.id === p.id; })[0];
      var card = buildPlanCard(f, ans, p);
      els.planGrid.appendChild(card);
    });

    var active = plan.perFactor.filter(function (p) { return p.effective !== 0; });
    if (active.length === 0) {
      els.planApplied.textContent = 'No plan changes.';
    } else {
      var labels = active.map(function (p) { return fLabelFor(p.id); });
      els.planApplied.textContent =
        'Plan delta: ' + fmtYears(plan.net) +
        (plan.capping ? ' (capped — see warnings)' : '') +
        ' · Factors: ' + labels.join(', ');
    }
  }

  function fLabelFor(id) {
    var f = LIFESTYLE_FACTORS.filter(function (x) { return x.id === id; })[0];
    return f ? f.label : id;
  }

  /* ===========================================================
     12. Build slider UI
     =========================================================== */

  function buildSliders() {
    els.sliders.innerHTML = '';
    WHAT_IFS.forEach(function (s) {
      var card = document.createElement('div');
      card.className = 'slider-card';
      card.innerHTML =
        '<div class="slider-card-head">' +
          '<span class="slider-card-title">' + s.title + '</span>' +
          '<label class="slider-toggle">' +
            '<input type="checkbox" id="slider-input-' + s.id + '" data-slider-id="' + s.id + '">' +
            '<span>Try it</span>' +
          '</label>' +
        '</div>' +
        '<div class="slider-meta">' +
          '<span class="muted text-sm">' + s.note + '</span>' +
          '<span class="slider-delta is-neutral" id="slider-delta-' + s.id + '">—</span>' +
        '</div>';
      els.sliders.appendChild(card);
    });

    HT.qsa('input[data-slider-id]', els.sliders).forEach(function (input) {
      input.addEventListener('change', function () {
        var id = input.getAttribute('data-slider-id');
        state.sliderOverrides[id] = input.checked;
        renderResult();
      });
    });
  }

  /* ===========================================================
     13. Initial wiring
     =========================================================== */

  function populateCountries() {
    [HT.$('#ls-country'), HT.$('#ls-country-f')].forEach(function (sel) {
      if (!sel) return;
      COUNTRIES.forEach(function (c) {
        var opt = document.createElement('option');
        opt.value = c.code;
        opt.textContent = c.name;
        sel.appendChild(opt);
      });
      sel.value = 'BD';
    });
  }

  function updateBMI() {
    var suf = state.mode === 'full' ? '-f' : '';
    var h = parseFloat(HT.$('#ls-height' + suf).value);
    var w = parseFloat(HT.$('#ls-weight' + suf).value);
    var bmiEl = HT.$('#ls-bmi' + suf);
    if (isFinite(h) && isFinite(w) && h > 0 && w > 0) {
      var bmi = w / Math.pow(h / 100, 2);
      bmiEl.value = HT.formatNumber(bmi, { minFractionDigits: 1, maxFractionDigits: 1 });
    } else {
      bmiEl.value = '—';
    }
  }

  function wireInputs() {
    HT.$$('#ls-dob, #ls-sex, #ls-country, #ls-height, #ls-weight, ' +
          '#ls-smoking, #ls-alcohol, #ls-exercise, #ls-sleep, #ls-stress, #ls-fruitveg, ' +
          '#ls-seatbelt, #ls-checkups, #ls-drugs').forEach(function (el) {
      el.addEventListener('input', onAnyChange);
      el.addEventListener('change', onAnyChange);
    });
    HT.$$('#ls-dob-f, #ls-sex-f, #ls-country-f, #ls-height-f, #ls-weight-f, ' +
          '#ls-smoking-f, #ls-alcohol-f, #ls-exercise-f, #ls-sleep-f, #ls-stress-f, #ls-fruitveg-f, ' +
          '#ls-fastfood-f, #ls-water-f, #ls-sitting-f, #ls-steps-f, #ls-sun-f, ' +
          '#ls-bp-f, #ls-diabetes-f, #ls-heart-f, #ls-cholesterol-f, #ls-cancer-f, #ls-depression-f, ' +
          '#ls-familyheart-f, #ls-familycancer-f, #ls-familydiabetes-f, ' +
          '#ls-seatbelt-f, #ls-motorcycle-f, #ls-drugs-f, #ls-checkups-f, #ls-vaccines-f, #ls-dental-f, #ls-screen-f, ' +
          '#ls-pollution-f, #ls-income-f, #ls-education-f, #ls-relationship-f').forEach(function (el) {
      el.addEventListener('input', onAnyChange);
      el.addEventListener('change', onAnyChange);
    });
  }

  function onAnyChange() {
    updateBMI();
    renderResult();
  }

  function wireTabs() {
    HT.qsa('#ls-mode-tabs .tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        HT.qsa('#ls-mode-tabs .tab').forEach(function (t) { t.classList.remove('is-active'); });
        tab.classList.add('is-active');
        state.mode = tab.getAttribute('data-tab');
        HT.qsa('[data-tab-panel]').forEach(function (p) {
          p.style.display = p.getAttribute('data-tab-panel') === state.mode ? '' : 'none';
        });
        updateBMI();
        renderResult();
      });
    });
  }

  function wireResetAndCopy() {
    els.resetSliders.addEventListener('click', function () {
      state.sliderOverrides = {};
      HT.qsa('input[data-slider-id]', els.sliders).forEach(function (i) { i.checked = false; });
      renderResult();
    });
    if (els.planReset) {
      els.planReset.addEventListener('click', function () {
        state.planTargets = planDefaultTargets();
        persistPlan();
        renderPlan();
      });
    }
    els.copy.addEventListener('click', function () {
      HT.copyToClipboard(els.share.textContent.trim());
    });
  }

  function applyEmbedMode() {
    var params = null;
    try { params = new URLSearchParams(window.location.search); } catch (_) {}
    if (!params || params.get('embed') !== '1') return;
    var planTab = HT.$('#ls-mode-tabs .tab[data-tab="plan"]');
    if (planTab && planTab.parentNode) planTab.parentNode.removeChild(planTab);
    var planPanel = HT.qs('[data-tab-panel="plan"]');
    if (planPanel && planPanel.parentNode) planPanel.parentNode.removeChild(planPanel);
    if (state.mode === 'plan') {
      state.mode = 'quick';
      var quickTab = HT.$('#ls-mode-tabs .tab[data-tab="quick"]');
      if (quickTab) quickTab.classList.add('is-active');
      HT.qsa('[data-tab-panel]').forEach(function (p) {
        p.style.display = p.getAttribute('data-tab-panel') === 'quick' ? '' : 'none';
      });
    }
  }

  /* ===========================================================
     14. Boot
     =========================================================== */

  function init() {
    populateCountries();
    buildSliders();
    hydratePlan();
    applyEmbedMode();
    wireInputs();
    wireTabs();
    wireResetAndCopy();
    updateBMI();
    renderResult();
    if (state.mode === 'plan') renderPlan();
    wireQuizToggle();
    wireDatePickers();
  }

  /* Story 9.19 — opt the 2 DOB inputs into HT.datePicker (lazy via
     shell-thin Proxy). The input stays the source of truth — same id,
     name, value (ISO YYYY-MM-DD), min/max, change/input events fire
     after a pick. The picker's onSelect callback writes back to the
     input.value via the standard event flow, so onAnyChange() picks
     it up transparently. */
  function wireDatePickers() {
    if (!HT.datePicker || typeof HT.datePicker.enhance !== 'function') return;
    HT.$$('.js-date-picker').forEach(function (el) {
      HT.datePicker.enhance(el, {});
    });
  }

  /* ===========================================================
     15. Quiz mode (Story 9.13)
     Reuses the existing evaluate(ans) path — same numbers as form mode.
     Quiz questions drive the same state.answers shape getAnswers()
     produces, so Plan tab still works after quiz completion.
     =========================================================== */

  var LIFESPAN_QUESTIONS = [
    { id: 'dob',       label: 'Date of birth',     prompt: 'When were you born?',          input: 'date',   helpText: 'Used to compute your age and target date.' },
    { id: 'sex',       label: 'Sex',               prompt: 'What is your sex?',            options: [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }] },
    { id: 'country',   label: 'Country',           prompt: 'Which country do you live in?', options: COUNTRIES.map(function (c) { return { value: c.code, label: c.name }; }) },
    { id: 'height',    label: 'Height (cm)',       prompt: 'Height in centimetres?',       input: 'number', min: 50,  max: 250, step: 1 },
    { id: 'weight',    label: 'Weight (kg)',       prompt: 'Weight in kilograms?',         input: 'number', min: 10,  max: 300, step: 0.5 },
    { id: 'alcohol',   label: 'Alcohol (drinks/wk)', prompt: 'Alcoholic drinks per week?',  input: 'number', min: 0,   max: 50,  step: 1 },
    { id: 'exercise',  label: 'Exercise (min/day)',  prompt: 'Exercise minutes per day?',   input: 'number', min: 0,   max: 240, step: 5 },
    { id: 'sleep',     label: 'Sleep (h/night)',    prompt: 'Sleep hours per night?',      input: 'number', min: 0,   max: 14,  step: 0.5 },
    { id: 'smoking',   label: 'Smoking',           prompt: 'Do you smoke?',                options: [{ value: 'never', label: 'Never' }, { value: 'former', label: 'Former' }, { value: 'occasional', label: 'Occasional' }, { value: 'daily', label: 'Daily' }] },
    { id: 'stress',    label: 'Stress',            prompt: 'Your usual stress level?',     options: [{ value: 'low', label: 'Low' }, { value: 'moderate', label: 'Moderate' }, { value: 'high', label: 'High' }, { value: 'extreme', label: 'Extreme' }] },
    { id: 'fruitveg',  label: 'Fruit & veg',       prompt: 'How often do you eat fruit and vegetables?', options: [{ value: 'daily', label: 'Daily (5+ servings)' }, { value: 'weekly', label: 'Weekly' }, { value: 'rarely', label: 'Rarely' }] },
    { id: 'seatbelt',  label: 'Seatbelt',          prompt: 'How often do you wear a seatbelt?', options: [{ value: 'always', label: 'Always' }, { value: 'sometimes', label: 'Sometimes' }, { value: 'never', label: 'Never' }] },
    { id: 'drugs',     label: 'Drug use',          prompt: 'Recreational drug use history?', options: [{ value: 'never', label: 'Never' }, { value: 'former', label: 'Former' }, { value: 'current', label: 'Current' }] },
    { id: 'checkups',  label: 'Medical checkups',  prompt: 'How often do you get a medical checkup?', options: [{ value: 'yearly', label: 'Yearly' }, { value: 'irregular', label: 'Irregular' }, { value: 'never', label: 'Never' }] },
    { id: 'bp',        label: 'Blood pressure',    prompt: 'Blood pressure status?',       options: [{ value: 'normal', label: 'Normal' }, { value: 'elevated', label: 'Elevated' }, { value: 'high', label: 'High' }] },
    { id: 'diabetes',  label: 'Diabetes',          prompt: 'Diabetes status?',             options: [{ value: 'no', label: 'No' }, { value: 'prediabetes', label: 'Pre-diabetes' }, { value: 'yes', label: 'Yes' }] },
    { id: 'heart',     label: 'Heart disease',     prompt: 'Existing heart disease?',      options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }] },
    { id: 'cholesterol', label: 'Cholesterol',     prompt: 'High cholesterol?',            options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }] },
    { id: 'cancer',    label: 'Cancer history',    prompt: 'Cancer history?',              options: [{ value: 'no', label: 'No' }, { value: 'family', label: 'Family history' }, { value: 'personal', label: 'Personal history' }] },
    { id: 'depression', label: 'Depression',       prompt: 'Depression history?',          options: [{ value: 'no', label: 'No' }, { value: 'treated', label: 'Treated' }, { value: 'untreated', label: 'Untreated' }] },
    { id: 'familyheart', label: 'Family — heart',  prompt: 'Family history of heart disease?', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }] },
    { id: 'familycancer', label: 'Family — cancer', prompt: 'Family history of cancer?',   options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }] },
    { id: 'familydiabetes', label: 'Family — diabetes', prompt: 'Family history of diabetes?', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }] },
    { id: 'motorcycle', label: 'Motorcycle',       prompt: 'Motorcycle or scooter use?',   options: [{ value: 'none', label: 'None' }, { value: 'occasional', label: 'Occasional (helmeted)' }, { value: 'frequent', label: 'Frequent (helmeted)' }] },
    { id: 'vaccines',  label: 'Vaccinations',      prompt: 'Vaccinations up to date?',     options: [{ value: 'yes', label: 'Yes' }, { value: 'partial', label: 'Partial' }, { value: 'no', label: 'No' }] },
    { id: 'dental',    label: 'Dental care',       prompt: 'How often do you see a dentist?', options: [{ value: 'regular', label: 'Regular (yearly+)' }, { value: 'occasional', label: 'Occasional' }, { value: 'rare', label: 'Rare / never' }] },
    { id: 'pollution', label: 'Air pollution',     prompt: 'Air pollution where you live?', options: [{ value: 'low', label: 'Low' }, { value: 'moderate', label: 'Moderate' }, { value: 'high', label: 'High' }] },
    { id: 'income',    label: 'Income',            prompt: 'Income level?',                options: [{ value: 'low', label: 'Low' }, { value: 'middle', label: 'Middle' }, { value: 'high', label: 'High' }] },
    { id: 'education', label: 'Education',         prompt: 'Highest education completed?', options: [{ value: 'none', label: 'Primary or less' }, { value: 'secondary', label: 'Secondary' }, { value: 'tertiary', label: 'Tertiary' }] },
    { id: 'relationship', label: 'Relationship',  prompt: 'Relationship status?',         options: [{ value: 'partner', label: 'Partner / married' }, { value: 'single', label: 'Single' }] },
    { id: 'sun',       label: 'Sun exposure',      prompt: 'Sun exposure?',                options: [{ value: 'low', label: 'Low' }, { value: 'moderate', label: 'Moderate' }, { value: 'high', label: 'High' }] },
    { id: 'fastfood',  label: 'Fast food (meals/wk)', prompt: 'Fast food meals per week?',  input: 'number', min: 0, max: 21, step: 1 },
    { id: 'water',     label: 'Water (L/day)',     prompt: 'Water litres per day?',        input: 'number', min: 0, max: 6,  step: 0.25 },
    { id: 'sitting',   label: 'Sitting (h/day)',   prompt: 'Sitting hours per day?',       input: 'number', min: 0, max: 18, step: 0.5 },
    { id: 'steps',     label: 'Steps (k/day)',     prompt: 'Steps in thousands per day?',  input: 'number', min: 0, max: 30, step: 0.5 },
    { id: 'screen',    label: 'Screen time (h/day)', prompt: 'Screen time hours per day?',  input: 'number', min: 0, max: 18, step: 0.5 }
  ];

  function quizEl(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') n.className = attrs[k];
        else if (k === 'text') n.textContent = attrs[k];
        else if (k === 'html') n.innerHTML = attrs[k];
        else n.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (typeof c === 'string') n.appendChild(document.createTextNode(c));
      else if (c) n.appendChild(c);
    });
    return n;
  }

  function buildLifespanReveal(answers) {
    // Merge quiz answers with neutral defaults so skip = neutral baseline
    // (matches the form-mode countFilledFields + evaluate() contract).
    var ans = {
      sex: 'female', country: 'GLOBAL',
      smoking: 'never', stress: 'moderate', fruitveg: 'daily',
      seatbelt: 'always', drugs: 'never', checkups: 'yearly',
      bp: 'normal', diabetes: 'no', heart: 'no', cholesterol: 'no',
      cancer: 'no', depression: 'no',
      familyheart: 'no', familycancer: 'no', familydiabetes: 'no',
      motorcycle: 'none', vaccines: 'yes', dental: 'regular',
      pollution: 'low', income: 'middle', education: 'secondary',
      relationship: 'partner', sun: 'moderate'
    };
    Object.keys(answers).forEach(function (k) {
      var v = answers[k];
      if (v !== undefined && v !== null && !(typeof v === 'number' && !isFinite(v)) && v !== '') {
        ans[k] = v;
      }
    });
    if (isFinite(answers.height) && isFinite(answers.weight) && answers.height > 0) {
      ans.bmi = answers.weight / Math.pow(answers.height / 100, 2);
    }

    var ev = evaluate(ans);
    var baseline = clamp(baselineFor(ans.country, ans.sex) + ev.sum, 40, 110);
    var range = computeRange(baseline, 1.0);

    var yearsStr = HT.formatNumber(baseline, { minFractionDigits: 1, maxFractionDigits: 1 });
    var rangeLow = HT.formatNumber(range.low,  { minFractionDigits: 0, maxFractionDigits: 0 });
    var rangeHigh = HT.formatNumber(range.high, { minFractionDigits: 0, maxFractionDigits: 0 });

    var wrap = quizEl('div', { class: 'quiz-reveal-custom' });

    var headline = quizEl('p', { class: 'quiz-reveal-headline' });
    headline.appendChild(document.createTextNode('Your estimated lifespan is '));
    headline.appendChild(quizEl('strong', { text: yearsStr + ' years' }));
    headline.appendChild(quizEl('small', {
      text: ' (range ' + rangeLow + '–' + rangeHigh + ' years — statistical estimate, not a prediction)'
    }));
    wrap.appendChild(headline);

    // Top-3 contributors (positive + negative)
    var topList = quizEl('ul', { class: 'quiz-reveal-list quiz-reveal-list-top' });
    var pos = ev.contributions.filter(function (c) { return c.delta > 0; })
      .sort(function (a, b) { return b.delta - a.delta; }).slice(0, 3);
    var neg = ev.contributions.filter(function (c) { return c.delta < 0; })
      .sort(function (a, b) { return a.delta - b.delta; }).slice(0, 3);

    function row(label, val) {
      var li = quizEl('li', { class: 'quiz-reveal-item' });
      li.appendChild(quizEl('span', { class: 'quiz-reveal-item-label', text: label + ': ' }));
      li.appendChild(quizEl('span', { class: 'quiz-reveal-item-value', text: val }));
      return li;
    }

    if (pos.length) {
      topList.appendChild(row('Top strengths',
        pos.map(function (c) { return c.label + ' (' + fmtSigned(c.delta) + ')'; }).join(', ')));
    }
    if (neg.length) {
      topList.appendChild(row('Top risks',
        neg.map(function (c) { return c.label + ' (' + fmtSigned(c.delta) + ')'; }).join(', ')));
    }
    if (pos.length === 0 && neg.length === 0) {
      topList.appendChild(row('Notes', 'Balanced baseline — no major positive or negative factors.'));
    }
    wrap.appendChild(topList);

    // Action buttons (Reset local; Share/Print route through Shell Public API)
    var actions = quizEl('div', { class: 'quiz-reveal-actions', 'data-print': 'ignore' });
    var shareBtn = quizEl('button', {
      type: 'button', class: 'btn btn-secondary', 'data-action': 'share',
      text: 'Share summary'
    });
    var printBtn = quizEl('button', {
      type: 'button', class: 'btn btn-secondary', 'data-action': 'print',
      text: 'Print'
    });
    var resetBtn = quizEl('button', {
      type: 'button', class: 'btn btn-ghost', 'data-action': 'reset',
      text: 'Reset'
    });
    var formLink = quizEl('a', {
      class: 'quiz-reveal-form-link', href: '?view=form', text: 'Switch to advanced form view'
    });
    actions.appendChild(shareBtn);
    actions.appendChild(printBtn);
    actions.appendChild(resetBtn);
    actions.appendChild(formLink);
    wrap.appendChild(actions);

    return wrap;
  }

  var _quizHandle = null;

  function mountLifespanQuiz() {
    var mount = document.getElementById('ls-quiz-mount');
    if (!mount) return null;
    if (!HT.quiz || typeof HT.quiz.open !== 'function') {
      console.error('lifespan-simulator-quiz: HT.quiz not loaded');
      mount.textContent = 'HT.quiz failed to load.';
      return null;
    }

    // Try to restore from URL state (?qa=<b64> shares the answer set)
    var seed = {};
    try {
      if (HT.urlState && typeof HT.urlState.decode === 'function') {
        var restored = HT.urlState.decode('lifespan-simulator', location.hash);
        if (restored && typeof restored === 'object' && restored.qa) {
          try {
            var decoded = JSON.parse(atob(String(restored.qa)));
            if (decoded && typeof decoded === 'object') seed = decoded;
          } catch (_) { /* defensive — decode failure leaves seed empty */ }
        }
      }
    } catch (_) {}

    if (_quizHandle && typeof _quizHandle.close === 'function') {
      try { _quizHandle.close(); } catch (_) {}
    }
    _quizHandle = HT.quiz.open({
      mount: mount,
      questions: LIFESPAN_QUESTIONS,
      answers: seed,
      reveal: buildLifespanReveal,
      storageKey: '_registry-lifespan-simulator',
      onChange: function (a) {
        // Mirror quiz answers back into the form-mode state so Plan tab
        // reads the same numbers the quiz produced. evaluate() + renderResult
        // would also work but Plan tab reads state.answers directly.
        state.answers = a;
      },
      onComplete: function (a) {
        // Wire share/print/reset on the reveal panel (one-shot).
        var revealEl = document.querySelector('#ls-quiz-mount .quiz-reveal');
        if (!revealEl) return;
        var share = revealEl.querySelector('[data-action="share"]');
        var print = revealEl.querySelector('[data-action="print"]');
        var reset = revealEl.querySelector('[data-action="reset"]');
        if (share) share.addEventListener('click', function () {
          var text = revealEl.querySelector('.quiz-reveal-custom') ?
            revealEl.querySelector('.quiz-reveal-custom').textContent.trim() :
            revealEl.textContent.trim();
          HT.copyToClipboard(text);
          share.textContent = 'Copied!';
          setTimeout(function () { share.textContent = 'Share summary'; }, 1500);
        });
        if (print) print.addEventListener('click', function () {
          if (HT.share && typeof HT.share.print === 'function') {
            HT.share.print('lifespan-simulator');
          }
        });
        if (reset) reset.addEventListener('click', function () {
          if (_quizHandle && typeof _quizHandle.destroy === 'function') {
            _quizHandle.destroy();
          } else if (_quizHandle && typeof _quizHandle.close === 'function') {
            _quizHandle.close();
          }
          _quizHandle = null;
          mountLifespanQuiz();
        });
      }
    });

    return _quizHandle;
  }

  function toggleQuizMode(force) {
    var quizMount = document.getElementById('ls-quiz-mount');
    var formEl = document.querySelector('[data-quiz-host="form"]');
    var params = null;
    try { params = new URLSearchParams(window.location.search); } catch (_) {}
    var want = typeof force === 'boolean' ? force : (params && params.get('view') === 'quiz');
    if (want) {
      if (formEl) formEl.hidden = true;
      if (quizMount) quizMount.hidden = false;
      mountLifespanQuiz();
    } else {
      if (quizMount) quizMount.hidden = true;
      if (formEl) formEl.hidden = false;
      if (_quizHandle && typeof _quizHandle.close === 'function') {
        try { _quizHandle.close(); } catch (_) {}
        _quizHandle = null;
      }
    }
  }

  function wireQuizToggle() {
    var btn = document.getElementById('ls-quiz-toggle');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      toggleQuizMode(true);
    });
    // Honour ?view=quiz on initial load (no force → reads URL).
    toggleQuizMode();
  }

  window.lifespanSimulatorInit = init;
})();