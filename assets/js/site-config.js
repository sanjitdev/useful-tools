/* site-config.js — AD-11. Footer "View source" link target.
   Edit RAW when the repo moves; the gate re-verifies every link. ES2018. */

(function () {
  'use strict';
  window.HT = window.HT || {};
  var HT = window.HT;
  var RAW = {
    repoOwner: 'sanjitdev',
    repoName: 'useful-tools',
    defaultBranch: 'main',
    brand: 'Handy Tools',
    defaultLocale: 'en',
  };
  var repoUrl = 'https://github.com/' + RAW.repoOwner + '/' + RAW.repoName;
  var blobBase = repoUrl + '/blob/' + RAW.defaultBranch;
  // Internal: gate + API-contract entry. Tool code reads HT.siteConfig.
  window.HT_SITE_CONFIG = Object.freeze(RAW);
  // Public (AD-14 stable). Mutation throws in strict mode.
  HT.siteConfig = Object.freeze({
    repoUrl: repoUrl,
    blobBase: blobBase,
    defaultBranch: RAW.defaultBranch,
    brand: RAW.brand,
    defaultLocale: RAW.defaultLocale,
  });
})();
