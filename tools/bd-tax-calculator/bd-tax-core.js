/* ============================================
   Bangladesh Income Tax Calculator — bd-tax-core.js (Story 4b Phase 2)
   Parse-time core: holds the data tables (BD_TAX_RULES + RULESETS,
   PRESETS, SHARE_HASH_FIELDS) + the mutable `state` object. The
   bilingual DICT lives in bd-tax-handlers.js (lazy chunk) to keep
   the core under the 7 KB per-tool budget.

   Lazy-loads bd-tax-handlers.js on DOMContentLoaded; handlers
   reference data via HT.bdTaxCore + the local DICT in handlers.

   First-paint payload: ~3 KB gz (vs. 16.6 KB gz monolithic).

   Story 4b — see _bmad-output/implementation-artifacts/
   story-4b-per-tool-code-splitting.md
   ============================================ */

(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.HT) return;
  var HT = window.HT;

  // -------------------------------------------------------------
  // Tax rules (editable — change here for future AYs)
  // -------------------------------------------------------------

  // AY 2024-25 baseline rules (for comparison in year selector)
  var BD_TAX_RULES_PREVIOUS = {
    assessmentYear: '2024-25',
    financialYear: '2023-24',

    exemption: {
      male:      350000,
      female:    400000,
      senior:    400000,
      disabled:  475000,
      freedom:   475000,
      third:     400000,
    },

    slabs: [
      { upTo:   350000, rate: 0.00 },
      { upTo:   450000, rate: 0.05 },
      { upTo:   750000, rate: 0.10 },
      { upTo:  1100000, rate: 0.15 },
      { upTo:  1500000, rate: 0.20 },
      { upTo: Infinity, rate: 0.25 },
    ],

    rebate: {
      cap: 1500000,
      tiers: null,
      rate: 0.15,
      eligibleHint: 'DPS, Sanchayapatra, treasury bonds, listed shares, mutual funds, life insurance, registered land/building.',
    },

    surcharge: null,

    minimumTax: 5000,
    agricultureExempt: 60000,
    listedCapitalGainsRate: 0.15,
    salaryStdDeductionFraction: 1 / 3,
    housePropertyStdDeduction: 0.30,
  };

  var BD_TAX_RULES = {
    assessmentYear: '2026-27',
    financialYear: '2025-26',

    // Basic exemption threshold by category (BDT)
    exemption: {
      male:      375000,
      female:    450000,
      senior:    450000,   // age 65+
      disabled:  500000,
      freedom:   500000,
      third:     450000,   // same as female
    },

    // Progressive slab table. Each entry = { upTo, rate }.
    // Computed against TAXABLE INCOME (after exemption).
    slabs: [
      { upTo:   375000, rate: 0.00 },
      { upTo:   500000, rate: 0.05 },  // next 1,25,000 at 5%
      { upTo:   800000, rate: 0.10 },  // next 3,00,000 at 10%
      { upTo:  1100000, rate: 0.15 },  // next 3,00,000 at 15%
      { upTo:  1500000, rate: 0.20 },  // next 4,00,000 at 20%
      { upTo:  2000000, rate: 0.25 },  // next 5,00,000 at 25%
      { upTo: Infinity, rate: 0.30 },  // above 20,00,000 at 30%
    ],

    // Investment rebate
    rebate: {
      cap: 2000000,
      tiers: [
        { upTo:  1500000, rate: 0.15 },
        { upTo: Infinity, rate: 0.12 },
      ],
      rate: 0.15,
      eligibleHint: 'DPS, Sanchayapatra, treasury bonds, listed shares, mutual funds, life insurance, registered land/building.',
    },

    // Surcharge on high incomes
    surcharge: {
      threshold: 5000000,
      rate:      0.10,
    },

    minimumTax: 5000,
    agricultureExempt: 60000,
    listedCapitalGainsRate: 0.15,
    salaryStdDeductionFraction: 1 / 3,
    housePropertyStdDeduction: 0.30,
  };

  var RULESETS = {
    '2024-25': BD_TAX_RULES_PREVIOUS,
    '2026-27': BD_TAX_RULES,
  };
  var DEFAULT_RULES_KEY = '2026-27';

  // -------------------------------------------------------------
  // Bilingual dictionary lives in bd-tax-handlers.js (lazy chunk).
  // Core only exposes a tiny language-key shape; handlers bring the
  // full bilingual strings on first interaction.
  // -------------------------------------------------------------

  // -------------------------------------------------------------
  // Presets — one-click example scenarios
  // -------------------------------------------------------------
  var PRESETS = {
    salaried: {
      label: 'Salaried employee',
      fields: {
        category: 'male', age: 35, area: 'urban',
        salaryBasic: 600000,
        salaryHouseRent: 240000,
        salaryMedical: 60000,
        salaryTransport: 36000,
        salaryBonus: 60000,
        interestSavings: 40000,
        investment: 120000,
        tdsSalary: 25000,
      },
    },
    senior: {
      label: 'Senior citizen',
      fields: {
        category: 'senior', age: 68, area: 'urban',
        salaryBasic: 300000,
        salaryHouseRent: 120000,
        interestSavings: 80000,
        grossRent: 240000,
        municipalTax: 6000,
        insurance: 12000,
        investment: 100000,
      },
    },
    business: {
      label: 'Business owner',
      fields: {
        category: 'male', age: 45, area: 'urban',
        businessProfit: 1800000,
        salaryHouseRent: 120000,
        interestSavings: 60000,
        dividend: 40000,
        investment: 200000,
        advanceTax: 30000,
      },
    },
    investor: {
      label: 'Young investor',
      fields: {
        category: 'female', age: 28, area: 'urban',
        salaryBasic: 480000,
        salaryHouseRent: 192000,
        salaryMedical: 48000,
        salaryTransport: 28800,
        interestSavings: 30000,
        listedGains: 80000,
        unlistedGains: 50000,
        investment: 180000,
        tdsSalary: 15000,
      },
    },
  };

  // -------------------------------------------------------------
  // Share hash fields (input IDs that participate in the URL hash)
  // -------------------------------------------------------------
  var SHARE_HASH_FIELDS = [
    'rulesKey', 'category', 'age', 'area',
    'salaryBasic', 'salaryHouseRent', 'salaryMedical', 'salaryTransport',
    'salaryOtherAllow', 'salaryBonus', 'salaryPfEmployer', 'salaryStdDedOverride',
    'interestSec', 'interestSavings',
    'grossRent', 'municipalTax', 'insurance', 'interestBorrowed',
    'businessProfit', 'listedGains', 'unlistedGains', 'agriculture',
    'dividend', 'royalty', 'otherSources',
    'investment', 'tdsSalary', 'tdsOther', 'advanceTax',
  ];

  // -------------------------------------------------------------
  // State (mutable; handlers read/write via HT.bdTaxCore.getState())
  // -------------------------------------------------------------
  var STORAGE_KEY = 'handy-tools.bd-tax-calculator.state';
  var LANG_KEY = 'handy-tools.bd-tax-calculator.lang';
  var RULES_KEY = 'handy-tools.bd-tax-calculator.rules';
  var state = {
    lang: HT.storage.get(LANG_KEY, 'en'),
    rulesKey: HT.storage.get(RULES_KEY, DEFAULT_RULES_KEY),
    result: null,
    firstRender: true,
    suppressHash: false,
  };

  // Apply persisted ruleset immediately so render() picks it up on first paint.
  if (RULESETS[state.rulesKey]) {
    BD_TAX_RULES = RULESETS[state.rulesKey];
  }

  // -------------------------------------------------------------
  // Expose shared mutable state + data tables to handlers.js.
  // HT.bdTaxCore is INTERNAL (not on the public AD-14 surface).
  // -------------------------------------------------------------
  HT.bdTaxCore = Object.freeze({
    getRules:    function () { return BD_TAX_RULES; },
    setRules:    function (r) { BD_TAX_RULES = r; },
    getRulesets: function () { return RULESETS; },
    getPresets:  function () { return PRESETS; },
    getShareHashFields: function () { return SHARE_HASH_FIELDS; },
    getState:    function () { return state; },
    getDefaultRulesKey: function () { return DEFAULT_RULES_KEY; },
    getStorageKeys: function () {
      return {
        state: STORAGE_KEY,
        lang:  LANG_KEY,
        rules: RULES_KEY,
      };
    },
  });

  // -------------------------------------------------------------
  // Boot — DOMContentLoaded → lazy-load bd-tax-handlers.js → init()
  // -------------------------------------------------------------
  function boot() {
    if (typeof HT.lazyLoadTool !== 'function') {
      // ht-lazy.js missing — bail without throwing.
      return;
    }
    HT.lazyLoadTool('bd-tax', './bd-tax-handlers.js').then(function () {
      if (typeof window.bdTaxInit === 'function') {
        try { window.bdTaxInit(); }
        catch (err) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('bd-tax-core: bdTaxInit threw', err);
          }
        }
      }
    }).catch(function (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('bd-tax-core: lazyLoadTool failed', err);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
