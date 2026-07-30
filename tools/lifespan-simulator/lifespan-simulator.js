/* ============================================
   Lifespan Simulator
   Statistical lifespan estimator based on WHO/GBD/UK Biobank effect sizes.
   This is a population-level model — not a prediction.
   ============================================ */

(function () {
  'use strict';

  /* ===========================================================
     1. Country baselines (life expectancy at birth, by sex)
     Source: WHO Global Health Observatory, latest year per country.
     =========================================================== */

  var COUNTRIES = [
    { code: 'BD', name: 'Bangladesh',    male: 71.4, female: 74.6 },
    { code: 'IN', name: 'India',          male: 68.9, female: 71.3 },
    { code: 'PK', name: 'Pakistan',       male: 65.6, female: 68.6 },
    { code: 'NP', name: 'Nepal',          male: 67.0, female: 70.4 },
    { code: 'LK', name: 'Sri Lanka',      male: 73.3, female: 79.7 },
    { code: 'CN', name: 'China',          male: 75.4, female: 81.0 },
    { code: 'JP', name: 'Japan',          male: 81.5, female: 87.6 },
    { code: 'KR', name: 'South Korea',    male: 80.6, female: 86.6 },
    { code: 'SG', name: 'Singapore',      male: 81.0, female: 85.9 },
    { code: 'TH', name: 'Thailand',       male: 73.6, female: 80.2 },
    { code: 'ID', name: 'Indonesia',      male: 69.4, female: 73.5 },
    { code: 'MY', name: 'Malaysia',       male: 72.7, female: 77.4 },
    { code: 'PH', name: 'Philippines',    male: 67.4, female: 73.6 },
    { code: 'VN', name: 'Vietnam',        male: 70.5, female: 76.0 },
    { code: 'AE', name: 'UAE',            male: 76.4, female: 79.2 },
    { code: 'SA', name: 'Saudi Arabia',   male: 74.5, female: 77.6 },
    { code: 'TR', name: 'Turkey',         male: 75.4, female: 81.0 },
    { code: 'EG', name: 'Egypt',          male: 68.8, female: 73.2 },
    { code: 'NG', name: 'Nigeria',        male: 51.7, female: 53.5 },
    { code: 'ZA', name: 'South Africa',   male: 59.4, female: 64.6 },
    { code: 'KE', name: 'Kenya',          male: 64.9, female: 69.3 },
    { code: 'GB', name: 'United Kingdom', male: 79.0, female: 82.9 },
    { code: 'IE', name: 'Ireland',        male: 80.7, female: 84.0 },
    { code: 'FR', name: 'France',         male: 79.7, female: 85.7 },
    { code: 'DE', name: 'Germany',        male: 78.9, female: 83.7 },
    { code: 'ES', name: 'Spain',          male: 80.9, female: 86.3 },
    { code: 'IT', name: 'Italy',          male: 81.1, female: 85.4 },
    { code: 'NL', name: 'Netherlands',    male: 80.0, female: 83.4 },
    { code: 'SE', name: 'Sweden',         male: 81.3, female: 84.7 },
    { code: 'NO', name: 'Norway',         male: 81.0, female: 84.4 },
    { code: 'DK', name: 'Denmark',        male: 79.5, female: 83.4 },
    { code: 'FI', name: 'Finland',        male: 79.2, female: 84.5 },
    { code: 'PL', name: 'Poland',         male: 72.5, female: 81.0 },
    { code: 'RU', name: 'Russia',         male: 65.5, female: 76.4 },
    { code: 'US', name: 'United States',  male: 76.4, female: 81.6 },
    { code: 'CA', name: 'Canada',         male: 80.5, female: 84.6 },
    { code: 'MX', name: 'Mexico',         male: 71.8, female: 77.4 },
    { code: 'BR', name: 'Brazil',         male: 72.5, female: 79.7 },
    { code: 'AR', name: 'Argentina',      male: 73.4, female: 80.0 },
    { code: 'CL', name: 'Chile',          male: 78.9, female: 83.9 },
    { code: 'AU', name: 'Australia',      male: 81.3, female: 85.2 },
    { code: 'NZ', name: 'New Zealand',    male: 80.4, female: 84.0 },
    { code: 'GLOBAL', name: 'Global average', male: 70.0, female: 75.0 }
  ];

  var COUNTRY_BY_CODE = {};
  COUNTRIES.forEach(function (c) { COUNTRY_BY_CODE[c.code] = c; });

  function baselineFor(countryCode, sex) {
    var c = COUNTRY_BY_CODE[countryCode] || COUNTRY_BY_CODE.GLOBAL;
    return sex === 'male' ? c.male : c.female;
  }

  /* ===========================================================
     2. Adjustment table
     Each entry returns { delta, label, source } for a given input value.
     If no entry matches, the factor contributes 0 (neutral).
     =========================================================== */

  /* Smoking */
  var SMOKING = {
    never:       { delta:  0,    label: 'Never smoked' },
    former:      { delta: -1.5,  label: 'Former smoker' },
    occasional:  { delta: -3.0,  label: 'Occasional smoker' },
    daily:       { delta: -9.0,  label: 'Daily smoker' }
  };

  /* Stress */
  var STRESS = {
    low:      { delta:  0.5, label: 'Low stress' },
    moderate: { delta:  0,   label: 'Moderate stress' },
    high:     { delta: -1.0, label: 'High stress' },
    extreme:  { delta: -2.0, label: 'Extreme stress' }
  };

  /* Blood pressure */
  var BP = {
    normal:   { delta:  0,   label: 'Normal blood pressure' },
    elevated: { delta: -0.7, label: 'Elevated blood pressure' },
    high:     { delta: -2.0, label: 'High blood pressure' }
  };

  /* Diabetes */
  var DIABETES = {
    no:          { delta:  0,   label: 'No diabetes' },
    prediabetes: { delta: -1.5, label: 'Pre-diabetes' },
    yes:         { delta: -6.0, label: 'Diabetes' }
  };

  /* Heart disease (existing) */
  var HEART = {
    no:  { delta:  0,   label: 'No heart disease' },
    yes: { delta: -5.0, label: 'Existing heart disease' }
  };

  /* Cholesterol */
  var CHOLESTEROL = {
    no:  { delta:  0,   label: 'Normal cholesterol' },
    yes: { delta: -1.2, label: 'High cholesterol' }
  };

  /* Cancer history */
  var CANCER = {
    no:       { delta:  0,   label: 'No cancer history' },
    family:   { delta: -0.8, label: 'Family cancer history' },
    personal: { delta: -3.5, label: 'Personal cancer history' }
  };

  /* Depression */
  var DEPRESSION = {
    no:         { delta:  0,   label: 'No depression' },
    treated:    { delta: -1.0, label: 'Treated depression' },
    untreated:  { delta: -2.5, label: 'Untreated depression' }
  };

  /* Seatbelt */
  var SEATBELT = {
    always:    { delta:  0,   label: 'Always wears seatbelt' },
    sometimes: { delta: -1.0, label: 'Sometimes wears seatbelt' },
    never:     { delta: -2.5, label: 'Never wears seatbelt' }
  };

  /* Motorcycle / scooter */
  var MOTORCYCLE = {
    none:      { delta:  0,   label: 'No motorcycle use' },
    occasional:{ delta: -1.0, label: 'Occasional motorcycle' },
    frequent:  { delta: -2.5, label: 'Frequent motorcycle (helmeted)' }
  };

  /* Drug use */
  var DRUGS = {
    never:   { delta:  0,    label: 'No drug use' },
    former:  { delta: -1.5,  label: 'Former drug use' },
    current: { delta: -5.0,  label: 'Current drug use' }
  };

  /* Medical checkups */
  var CHECKUPS = {
    yearly:    { delta:  1.0, label: 'Yearly checkups' },
    irregular: { delta:  0,   label: 'Irregular checkups' },
    never:     { delta: -1.0, label: 'No checkups' }
  };

  /* Vaccinations */
  var VACCINES = {
    yes:     { delta:  1.0, label: 'Vaccinated' },
    partial: { delta:  0,   label: 'Partially vaccinated' },
    no:      { delta: -1.5, label: 'Unvaccinated' }
  };

  /* Dental care */
  var DENTAL = {
    regular:   { delta:  0.7, label: 'Regular dental care' },
    occasional:{ delta:  0,   label: 'Occasional dental care' },
    rare:      { delta: -0.7, label: 'Rare dental care' }
  };

  /* Fruit & veg */
  var FRUITVEG = {
    daily:  { delta:  1.0, label: 'Daily fruit & veg' },
    weekly: { delta:  0,   label: 'Some fruit & veg' },
    rarely: { delta: -1.0, label: 'Rarely eats fruit & veg' }
  };

  /* Sun exposure (U-shaped; moderate best) */
  var SUN = {
    low:      { delta: -0.5, label: 'Low sun exposure' },
    moderate: { delta:  0.3, label: 'Moderate sun exposure' },
    high:     { delta: -0.4, label: 'High sun exposure' }
  };

  /* Pollution */
  var POLLUTION = {
    low:      { delta:  0,   label: 'Low air pollution' },
    moderate: { delta: -0.7, label: 'Moderate air pollution' },
    high:     { delta: -1.5, label: 'High air pollution' }
  };

  /* Income */
  var INCOME = {
    low:    { delta: -1.5, label: 'Low income' },
    middle: { delta:  0,   label: 'Middle income' },
    high:   { delta:  1.0, label: 'High income' }
  };

  /* Education */
  var EDUCATION = {
    none:      { delta: -1.5, label: 'Primary education or less' },
    secondary: { delta:  0,   label: 'Secondary education' },
    tertiary:  { delta:  2.0, label: 'Tertiary education' }
  };

  /* Relationship */
  var RELATIONSHIP = {
    partner: { delta:  1.0, label: 'Partner / married' },
    single:  { delta:  0,   label: 'Single' }
  };

  /* ===========================================================
     3. Continuous / numeric factors — computed inline in evaluate()
     =========================================================== */

  /* ===========================================================
     4. Compute adjustments from a flat answer object
     =========================================================== */

  function pickEnum(table, value) {
    return table[value] || null;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

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
        // mild protective effect acknowledged in literature but controversial; keep neutral
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

    // Interaction cap: smoking + heavy alcohol
    if (ans.smoking === 'daily' && isFinite(ans.alcohol) && ans.alcohol > 14) {
      sum += -1.5;
      contributions.push({ label: 'Smoking + heavy alcohol (synergy)', delta: -1.5 });
    }
    // Interaction cap: smoking + sedentary
    if (ans.smoking === 'daily' && isFinite(ans.exercise) && ans.exercise < 10) {
      sum += -1.0;
      contributions.push({ label: 'Smoking + sedentary (synergy)', delta: -1.0 });
    }

    return { sum: sum, contributions: contributions };
  }

  /* ===========================================================
     5. What-If presets
     Each describes: title, baseDescription, and a `deltaIfApplied(ans)`
     function returning the projected change (positive = longer life).
     A slider represents "if the user adopts this habit".
     =========================================================== */

  var WHAT_IFS = [
    {
      id: 'quit-smoking',
      title: 'Quit smoking',
      note: 'daily → never',
      deltaIfApplied: function (a) {
        var cur = SMOKING[a.smoking] || { delta: 0 };
        if (cur.delta === 0) return 0;        // already optimal
        return -cur.delta;                     // undo the smoking penalty
      }
    },
    {
      id: 'exercise-30',
      title: 'Exercise 30 min/day',
      note: 'moderate activity',
      deltaIfApplied: function (a) {
        var bonus = 2.5;
        if (a.exercise >= 30) return 0;
        if (a.exercise >= 15) return bonus - 1.0;   // already some
        if (a.exercise >= 1)  return bonus + 0.5;
        return bonus + 3.0;                          // fully sedentary
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
    copy:         HT.$('#ls-copy')
  };

  var state = {
    mode: 'quick',            // 'quick' or 'full'
    baselineYears: null,
    sliderOverrides: {}      // { id: true/false }
  };

  /* ===========================================================
     7. Form → answer object
     =========================================================== */

  function getAnswers() {
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

  // Count of fields the user has actively changed from a "neutral" baseline
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
    var score = 50 + (pos * 3) + (neg * 3); // each year +3 / -3
    return clamp(Math.round(score), 0, 100);
  }

  /* ===========================================================
     9. Range computation
     Narrower when more fields are filled; wider when mostly defaults.
     =========================================================== */

  function computeRange(years, filledPct) {
    var spread = 6 - (filledPct * 4);   // 6y when 0% filled, 2y when 100%
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

    // Range is based on baselineYears (sliders are "what if", not part of the estimate)
    var fillStats = countFilledFields(ans);
    var range = computeRange(baselineYears, fillStats.filled / Math.max(1, fillStats.total));

    // Result main + sub
    els.years.textContent = HT.formatNumber(finalYears, { minFractionDigits: 1, maxFractionDigits: 1 }) + ' years';
    els.range.textContent = 'Expected age range: ' +
      HT.formatNumber(range.low, { minFractionDigits: 0, maxFractionDigits: 0 }) + '–' +
      HT.formatNumber(range.high, { minFractionDigits: 0, maxFractionDigits: 0 }) + ' years (statistical estimate, not a prediction)';

    // Estimated date
    if (ans.dob) {
      var d = new Date(ans.dob.getTime());
      d.setFullYear(d.getFullYear() + Math.round(finalYears));
      els.date.textContent = HT.formatDateShort(d);
    } else {
      els.date.textContent = '—';
    }

    // Confidence
    var conf = confidenceLevel(fillStats.filled / Math.max(1, fillStats.total));
    els.confidence.textContent = conf.text + ' (' + fillStats.filled + '/' + fillStats.total + ')';

    // Healthy habit score
    els.score.textContent = habitScore(ev.contributions) + '/100';

    // Contributors
    var pos = ev.contributions.filter(function (c) { return c.delta > 0; })
      .sort(function (a, b) { return b.delta - a.delta; })
      .slice(0, 4);
    var neg = ev.contributions.filter(function (c) { return c.delta < 0; })
      .sort(function (a, b) { return a.delta - b.delta; })
      .slice(0, 4);
    renderContributorList(els.extenders, pos, 'pos');
    renderContributorList(els.risks, neg, 'neg');

    // Slider baseline + applied status
    els.baseline.textContent = HT.formatNumber(baselineYears, { minFractionDigits: 1, maxFractionDigits: 1 }) + ' years';

    var activeLabels = sliderInfo.active;
    if (activeLabels.length === 0) {
      els.applied.textContent = 'No changes applied.';
    } else {
      els.applied.textContent = 'Applied: ' + activeLabels.join(', ') +
        ' (' + fmtSigned(sliderInfo.total) + ')';
    }

    // Per-slider delta badges
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

    // Shareable summary
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
      // Default Bangladesh
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
    // Quick tab
    HT.$$('#ls-dob, #ls-sex, #ls-country, #ls-height, #ls-weight, ' +
          '#ls-smoking, #ls-alcohol, #ls-exercise, #ls-sleep, #ls-stress, #ls-fruitveg, ' +
          '#ls-seatbelt, #ls-checkups, #ls-drugs').forEach(function (el) {
      el.addEventListener('input', onAnyChange);
      el.addEventListener('change', onAnyChange);
    });
    // Full tab extras
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
    els.copy.addEventListener('click', function () {
      HT.copyToClipboard(els.share.textContent.trim());
    });
  }

  /* ===========================================================
     14. Boot
     =========================================================== */

  function init() {
    populateCountries();
    buildSliders();
    wireInputs();
    wireTabs();
    wireResetAndCopy();
    updateBMI();
    renderResult();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();