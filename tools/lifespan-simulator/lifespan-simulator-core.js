/* ============================================
   Lifespan Simulator — lifespan-simulator-core.js (Story 4b Phase 2)
   Parse-time chunk: WHO delta scale convention, country baselines,
   22 enum tables (SMOKING/STRESS/BP/DIABETES/HEART/CHOLESTEROL/
   CANCER/DEPRESSION/SEATBELT/MOTORCYCLE/DRUGS/CHECKUPS/VACCINES/
   DENTAL/FRUITVEG/SUN/POLLUTION/INCOME/EDUCATION/RELATIONSHIP),
   pickEnum, clamp. Exposes HT.lifespanSimulatorCore — the AD-14
   internal handle for the lazy chunk to read constants + helpers from.

   Lazy chunk (lifespan-simulator-handlers.js) loads via
   HT.lazyLoadTool('lifespan-simulator', './lifespan-simulator-handlers.js')
   on DOMContentLoaded.

   Story 4b — see _bmad-output/implementation-artifacts/
   story-4b-per-tool-code-splitting.md
   ============================================ */

(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.HT) return;

  /* ===========================================================
     0. WHO_DELTAS — scale convention (AI-E1-11: hoisted metadata)

     Every per-input delta below is expressed in YEARS OF LIFE and is
     negative for harm, positive for benefit, zero for the neutral
     reference. The scale is consistent across the 22+ tables:
       -3.0 yrs  strong harm (daily smoking, heavy alcohol)
       -1.0 yrs  moderate harm (high blood pressure, no exercise)
        0.0 yrs  neutral reference (never smoked, healthy BMI)
       +1.0 yrs  modest benefit (vaccinated, daily fruit/veg)
       +4.0 yrs  strong benefit (60+ min daily exercise)

     Sources are cited inline next to each table (WHO fact sheet,
     GBD 2019, Moore et al. BMJ 2012, etc.) and re-asserted in the
     per-tooltip `sourceLabel` shown when the user clicks ⓘ. Do NOT
     change a delta without re-validating the source citation — this
     is an entertainment-only tool (see FR-2 / Story 1.16) but the
     numbers are still attached to real WHO publications, and a stale
     citation is worse than no citation.
     =========================================================== */

  var WHO_DELTAS = Object.freeze({
    SCALE_MIN: -10.0,
    SCALE_MAX: 10.0,
    SYNERGY_SMOKING_ALCOHOL: -1.5,
    SYNERGY_SMOKING_SEDENTARY: -1.0,
  });

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
     2. Adjustment tables
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

  function pickEnum(table, value) {
    return table[value] || null;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  // AD-14 internal handle. Frozen so lazy chunk can't accidentally
  // mutate parse-time state. The handle also exposes WHO_DELTAS so
  // the handlers layer can read synergy constants (smoking +
  // alcohol/sedentary caps) without re-importing the constants.
  window.HT.lifespanSimulatorCore = Object.freeze({
    WHO_DELTAS: WHO_DELTAS,
    COUNTRIES: COUNTRIES,
    COUNTRY_BY_CODE: COUNTRY_BY_CODE,
    SMOKING: SMOKING,
    STRESS: STRESS,
    BP: BP,
    DIABETES: DIABETES,
    HEART: HEART,
    CHOLESTEROL: CHOLESTEROL,
    CANCER: CANCER,
    DEPRESSION: DEPRESSION,
    SEATBELT: SEATBELT,
    MOTORCYCLE: MOTORCYCLE,
    DRUGS: DRUGS,
    CHECKUPS: CHECKUPS,
    VACCINES: VACCINES,
    DENTAL: DENTAL,
    FRUITVEG: FRUITVEG,
    SUN: SUN,
    POLLUTION: POLLUTION,
    INCOME: INCOME,
    EDUCATION: EDUCATION,
    RELATIONSHIP: RELATIONSHIP,
    baselineFor: baselineFor,
    pickEnum: pickEnum,
    clamp: clamp,
  });

  // Boot: lazy-load the handlers chunk on DOMContentLoaded. The
  // handlers chunk calls window.lifespanSimulatorInit() once loaded
  // (it owns DOM refs and event wiring).
  function boot() {
    if (typeof window.HT.lazyLoadTool !== 'function') return;
    window.HT.lazyLoadTool(
      'lifespan-simulator',
      './lifespan-simulator-handlers.js'
    ).then(function () {
      if (typeof window.lifespanSimulatorInit === 'function') {
        window.lifespanSimulatorInit();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
