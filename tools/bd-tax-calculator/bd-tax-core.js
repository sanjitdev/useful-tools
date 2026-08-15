/* ============================================
   Bangladesh Income Tax Calculator — bd-tax-core.js (Story 4b Phase 2)
   Parse-time core: holds the data tables (BD_TAX_RULES + RULESETS,
   DICT bilingual dictionary, PRESETS, SHARE_HASH_FIELDS) + the
   mutable `state` object. Lazy-loads bd-tax-handlers.js on
   DOMContentLoaded; handlers reference data via HT.bdTaxCore.

   First-paint payload: ~5 KB gz (vs. 16.6 KB gz monolithic).

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
  // Bilingual dictionary (English + Bangla)
  // -------------------------------------------------------------
  var DICT = {
    en: {
      pageTitle: 'Bangladesh Income Tax Calculator',
      pageSubtitle: 'Estimate your personal income tax for Assessment Year 2026-27 (FY 2025-26).',
      langToggle: 'বাংলা',

      secTaxpayer: 'Taxpayer information',
      lblCategory: 'Taxpayer category',
      lblAge: 'Age',
      lblGender: 'Gender',
      lblArea: 'Residential area',
      lblRulesKey: 'Assessment year',
      optAYCurrent: 'AY 2026-27 (current)',
      optAYPrevious: 'AY 2024-25 (previous)',
      rulesHint: 'Switch ruleset to compare years.',

      presetLabel: 'Try an example:',
      presetSalaried: 'Salaried employee',
      presetSenior: 'Senior citizen',
      presetBusiness: 'Business owner',
      presetInvestor: 'Young investor',
      presetLoaded: 'Loaded example — edit to see your own numbers',
      presetConfirm: 'Loading this example will replace your current inputs. Continue?',
      optMale: 'Male',
      optFemale: 'Female',
      optSenior: 'Senior citizen (65+)',
      optDisabled: 'Person with disability',
      optFreedom: 'Freedom fighter',
      optThird: 'Third gender',
      optUrban: 'Urban',
      optRural: 'Rural',
      ageHint: 'Affects senior-citizen status (65+).',

      secSalary: 'Salary income',
      lblBasic: 'Basic salary',
      lblHouseRent: 'House rent allowance (received)',
      lblMedical: 'Medical allowance',
      lblTransport: 'Transport allowance',
      lblOtherAllow: 'Other allowances',
      lblBonus: 'Bonus / festival bonus',
      lblPfEmployer: 'Employer PF contribution (above statutory)',
      salaryHint: 'A 1/3 standard deduction on basic is applied automatically. You can override it below.',
      lblStdDedOverride: 'Standard deduction (override — leave blank for auto 1/3 of basic)',
      stdDedPreviewLabel: 'Auto-calculated:',

      secInterest: 'Interest income',
      lblInterestSec: 'Interest on securities / bonds',
      lblInterestSavings: 'Interest on savings / FDR',

      secHouse: 'House property income',
      lblGrossRent: 'Annual gross rent received',
      lblMunicipalTax: 'Municipal / local tax paid',
      lblInsurance: 'Insurance premium paid',
      lblInterestBorrowed: 'Interest on borrowed capital (loan)',
      houseHint: 'A 30% standard deduction on net rent is applied automatically.',

      secBusiness: 'Business / professional income',
      lblBusinessProfit: 'Net profit (before tax)',

      secCapitalGains: 'Capital gains',
      lblListedGains: 'Gains on listed shares (flat 15%)',
      lblUnlistedGains: 'Gains on unlisted assets / property',

      secAgriculture: 'Agricultural income',
      lblAgriculture: 'Net agricultural income',
      agriHint: 'First ৳60,000 is exempt without inclusion in total income.',

      secOther: 'Other sources',
      lblDividend: 'Dividend income',
      lblRoyalty: 'Royalty / honorarium',
      lblOtherSources: 'Any other taxable income',

      secInvestments: 'Eligible investments',
      lblInvestment: 'Eligible investment amount (this year)',
      investHint: 'Up to ৳20,00,000 qualifies for 15% rebate.',

      secTaxesPaid: 'Taxes already paid',
      lblTdsSalary: 'TDS on salary',
      lblTdsOther: 'TDS on other sources',
      lblAdvanceTax: 'Advance tax paid',

      btnReset: 'Reset all',
      btnPrint: 'Print / Save as PDF',
      btnShare: 'Copy share link',
      btnCopySummary: 'Copy summary',
      toastCopied: 'Copied to clipboard',
      toastLinkCopied: 'Link copied — paste to share your inputs',
      toastSummaryCopied: 'Tax summary copied as plain text',

      rHeadline: 'Final tax',
      rSubtitle: 'Gross income, taxable income, tax, rebate, and what you owe.',
      tGross: 'Gross income',
      tExemptAgri: 'Agriculture exemption',
      tTotalIncome: 'Total income',
      tExemption: 'Less: basic exemption',
      tTaxable: 'Taxable income',
      tSlabTax: 'Tax on slabs',
      tListedGainTax: 'Tax on listed capital gains',
      tSurcharge: 'Surcharge (high-income)',
      tTotalTax: 'Total tax (before rebate)',
      tRebate: 'Less: investment rebate',
      tAfterRebate: 'Tax after rebate',
      tMinimum: 'Minimum tax adjustment',
      tTaxesPaid: 'Less: taxes already paid',
      tFinal: 'Tax payable',
      tRefund: 'Refundable',
      tEffective: 'Effective tax rate',

      secBreakdown: 'Slab-wise breakdown',
      breakdownCols: ['Slab', 'Rate', 'Amount in slab', 'Tax in slab'],

      secSummary: 'Income summary by source',
      summaryCols: ['Source', 'Taxable amount'],

      secInsights: 'Insights',
      insightMore: 'Invest an additional ৳{x} in eligible assets at the current {r} rebate rate to save ৳{y} in tax (capped at your tax due).',
      insightRebateTier: 'Your effective rebate rate is {r} on ৳{x} invested — the rebate rate steps down above ৳15 lakh of investment.',
      insightRefund: 'You are owed a refund of ৳{x}. File your return on the e-TIN portal to claim it.',
      insightMinTax: 'Minimum tax of ৳5,000 applies because your taxable income exceeds the basic exemption but your rebate offsets your slab tax entirely.',
      insightSurcharge: 'A 10% surcharge of ৳{y} is added because your total income exceeds ৳{x} (high-income surcharge).',
      insightNoTax: 'No tax is due because your taxable income is within your basic exemption of ৳{x}.',
      insightNegligible: 'Your effective tax rate is very low — verify your inputs and slab placement.',

      secPrint: 'Tax computation report',
      printGenerated: 'Generated',
      printTaxpayer: 'Taxpayer',
      printCategory: 'Category',
      printAge: 'Age',
      printArea: 'Area',
      printIncomeByHead: 'Income by source',
      printSlab: 'Slab computation',
      printSummary: 'Summary',
      printDisclaimer: 'This is an estimate generated by Handy Tools. Verify with NBR / Finance Act 2025. Not an official return.',
      printFooter: 'Handy Tools — Bangladesh Income Tax Calculator',

      disclaimer: 'AY 2026-27 estimates based on best-available data. Verify thresholds, slabs, and rebate rules with NBR / Finance Act 2025 before filing. Rules are editable in bd-tax-calculator.js.',
      currency: '৳',
    },

    bn: {
      pageTitle: 'বাংলাদেশ আয়কর হিসাব',
      pageSubtitle: 'মূল্যায়ন বছর ২০২৬-২৭ (অর্থবছর ২০২৫-২৬) এর জন্য আপনার ব্যক্তিগত আয়কর হিসাব করুন।',
      langToggle: 'EN',

      secTaxpayer: 'করদাতার তথ্য',
      lblCategory: 'করদাতার ধরন',
      lblAge: 'বয়স',
      lblGender: 'লিঙ্গ',
      lblArea: 'বসবাসের এলাকা',
      lblRulesKey: 'মূল্যায়ন বছর',
      optAYCurrent: 'AY ২০২৬-২৭ (বর্তমান)',
      optAYPrevious: 'AY ২০২৪-২৫ (পূর্ববর্তী)',
      rulesHint: 'বছর তুলনা করতে নিয়মকানুন পরিবর্তন করুন।',

      presetLabel: 'উদাহরণ দেখুন:',
      presetSalaried: 'চাকরিজীবী',
      presetSenior: 'বয়োজ্যেষ্ঠ',
      presetBusiness: 'ব্যবসায়ী',
      presetInvestor: 'তরুণ বিনিয়োগকারী',
      presetLoaded: 'উদাহরণ লোড হয়েছে — নিজের সংখ্যা দেখতে সম্পাদনা করুন',
      presetConfirm: 'এই উদাহরণটি লোড করলে আপনার বর্তমান ইনপুট প্রতিস্থাপিত হবে। চালিয়ে যাবেন?',
      optMale: 'পুরুষ',
      optFemale: 'নারী',
      optSenior: 'বয়োজ্যেষ্ঠ (৬৫+)',
      optDisabled: 'প্রতিবন্ধী ব্যক্তি',
      optFreedom: 'মুক্তিযোদ্ধা',
      optThird: 'তৃতীয় লিঙ্গ',
      optUrban: 'শহর',
      optRural: 'গ্রাম',
      ageHint: '৬৫+ হলে বয়োজ্যেষ্ঠ হিসেবে গণ্য হবেন।',

      secSalary: 'বেতন আয়',
      lblBasic: 'মূল বেতন',
      lblHouseRent: 'বাড়িভাড়া ভাতা (প্রাপ্ত)',
      lblMedical: 'চিকিৎসা ভাতা',
      lblTransport: 'যাতায়াত ভাতা',
      lblOtherAllow: 'অন্যান্য ভাতা',
      lblBonus: 'বোনাস / উৎসব ভাতা',
      lblPfEmployer: 'নিয়োগকর্তার প্রভিডেন্ট ফান্ড অবদান (বাধ্যতামূলক সীমার উপরে)',
      salaryHint: 'মূল বেতনের ১/৩ স্বয়ংক্রিয়ভাবে প্রযোজ্য। নিচে ওভাররাইড করতে পারেন।',
      lblStdDedOverride: 'প্রমিত কর্তন (ওভাররাইড — খালি রাখলে মূল বেতনের ১/৩)',
      stdDedPreviewLabel: 'স্বয়ংক্রিয় হিসাব:',

      secInterest: 'সুদ আয়',
      lblInterestSec: 'সিকিউরিটিজ / বন্ডের সুদ',
      lblInterestSavings: 'সঞ্চয় / FDR সুদ',

      secHouse: 'বাড়ি/ভবন আয়',
      lblGrossRent: 'বার্ষিক মোট ভাড়া',
      lblMunicipalTax: 'পৌর / স্থানীক কর',
      lblInsurance: 'বীমা প্রিমিয়াম',
      lblInterestBorrowed: 'ঋণের সুদ',
      houseHint: 'নিট ভাড়ার ৩০% প্রমিত কর্তন স্বয়ংক্রিয়ভাবে প্রযোজ্য।',

      secBusiness: 'ব্যবসা / পেশাগত আয়',
      lblBusinessProfit: 'নিট মুনাফা (কর-পূর্ব)',

      secCapitalGains: 'মূলধন লাভ',
      lblListedGains: 'তালিকাভুক্ত শেয়ারের লাভ (১৫%)',
      lblUnlistedGains: 'অন্যান্য সম্পদের লাভ',

      secAgriculture: 'কৃষি আয়',
      lblAgriculture: 'নিট কৃষি আয়',
      agriHint: 'প্রথম ৳৬০,০০০ মোট আয়ে অন্তর্ভুক্ত ছাড়াই করমুক্ত।',

      secInvestments: 'যোগ্য বিনিয়োগ',
      lblInvestment: 'যোগ্য বিনিয়োগের পরিমাণ (এই বছর)',
      investHint: '৳২০,০০,০০০ পর্যন্ত ১৫% রেয়াত পাওয়া যায়।',

      secTaxesPaid: 'পরিশোধিত কর',
      lblTdsSalary: 'বেতনের উপর TDS',
      lblTdsOther: 'অন্যান্য উৎসের TDS',
      lblAdvanceTax: 'অগ্রিম কর',

      secOther: 'অন্যান্য উৎস',
      lblDividend: 'লভ্যাংশ আয়',
      lblRoyalty: 'রয়্যালটি / সম্মানী',
      lblOtherSources: 'অন্য কোনো করযোগ্য আয়',

      btnReset: 'সব মুছুন',
      btnPrint: 'মুদ্রণ / PDF',
      btnShare: 'শেয়ার লিংক কপি',
      btnCopySummary: 'সারাংশ কপি',
      toastCopied: 'ক্লিপবোর্ডে কপি হয়েছে',
      toastLinkCopied: 'লিংক কপি হয়েছে — শেয়ার করতে পেস্ট করুন',
      toastSummaryCopied: 'কর সারাংশ প্লেইন টেক্সটে কপি হয়েছে',

      rHeadline: 'চূড়ান্ত কর',
      rSubtitle: 'মোট আয়, করযোগ্য আয়, কর, রেয়াত এবং আপনার দেনা।',
      tGross: 'মোট আয়',
      tExemptAgri: 'কৃষি কর অব্যাহতি',
      tTotalIncome: 'মোট আয়',
      tExemption: 'বিয়োগ: মৌলিক কর অব্যাহতি',
      tTaxable: 'করযোগ্য আয়',
      tSlabTax: 'স্ল্যাব অনুযায়ী কর',
      tListedGainTax: 'তালিকাভুক্ত মূলধন লাভের কর',
      tSurcharge: 'উচ্চ আয়ের উপরিভাগ',
      tTotalTax: 'মোট কর (রেয়াত-পূর্ব)',
      tRebate: 'বিয়োগ: বিনিয়োগ রেয়াত',
      tAfterRebate: 'রেয়াত-পরবর্তী কর',
      tMinimum: 'সর্বনিম্ন কর সমন্বয়',
      tTaxesPaid: 'বিয়োগ: পরিশোধিত কর',
      tFinal: 'প্রদেয় কর',
      tRefund: 'ফেরতযোগ্য',
      tEffective: 'কার্যকর কর হার',

      secBreakdown: 'স্ল্যাব-ভিত্তিক বিশ্লেষণ',
      breakdownCols: ['স্ল্যাব', 'হার', 'স্ল্যাবে পরিমাণ', 'স্ল্যাবে কর'],

      secSummary: 'উৎস অনুযায় আয়ের সারাংশ',
      summaryCols: ['উৎস', 'করযোগ্য পরিমাণ'],

      secInsights: 'অন্তর্দৃষ্টি',
      insightMore: 'যোগ্য সম্পদে বর্তমান {r} রেয়াত হারে আরও ৳{x} বিনিয়োগ করলে ৳{y} কর সাশ্রয় হবে (আপনার দেনা পর্যন্ত)।',
      insightRebateTier: '৳{x} বিনিয়োগে আপনার কার্যকর রেয়াত হার {r} — ৳১৫ লক্ষের উপরে রেয়াত হার কমে যায়।',
      insightRefund: 'আপনার ৳{x} ফেরত পাওয়ার অধিকার আছে। e-TIN পোর্টালে রিটার্ন দাখিল করুন।',
      insightMinTax: 'আপনার করযোগ্য আয় মৌলিক অব্যাহতির উপরে কিন্তু রেয়াত সম্পূর্ণ স্ল্যাব কর নিঃশেষ করেছে — ৳৫,০০০ সর্বনিম্ন কর প্রযোজ্য।',
      insightSurcharge: 'আপনার মোট আয় ৳{x} অতিক্রম করায় ১০% অতিরিক্ত কর ৳{y} ধার্য হয়েছে (উচ্চ আয়ের উপরিভাগ)।',
      insightNoTax: 'আপনার করযোগ্য আয় ৳{x} মৌলিক অব্যাহতির মধ্যে — কোনো কর নেই।',
      insightNegligible: 'কার্যকর কর হার খুবই কম — ইনপুট ও স্ল্যাব যাচাই করুন।',

      secPrint: 'কর গণনার প্রতিবেদন',
      printGenerated: 'তৈরি হয়েছে',
      printTaxpayer: 'করদাতা',
      printCategory: 'ধরন',
      printAge: 'বয়স',
      printArea: 'এলাকা',
      printIncomeByHead: 'উৎস অনুযায়ী আয়',
      printSlab: 'স্ল্যাব গণনা',
      printSummary: 'সারাংশ',
      printDisclaimer: 'এটি Handy Tools দ্বারা তৈরি একটি আনুমানিক হিসাব। NBR / অর্থ আইন ২০২৫ এর সাথে যাচাই করুন। এটি অফিসিয়াল রিটার্ন নয়।',
      printFooter: 'Handy Tools — বাংলাদেশ আয়কর হিসাব',

      disclaimer: 'AY ২০২৬-২৭ এর হিসাব সর্বোত্তম উপলব্ধ তথ্যের উপর ভিত্তি করে। দাখিলের আগে NBR / অর্থ আইন ২০২৫ থেকে সীমা, স্ল্যাব ও রেয়াত যাচাই করুন। নিয়মগুলো bd-tax-calculator.js এ সম্পাদনাযোগ্য।',
      currency: '৳',
    },
  };

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
    getDict:     function () { return DICT; },
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
