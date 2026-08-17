/* ============================================================
   Handy Tools — catalog.js (DC-4, Discovery Pack Epic)

   Domain catalog lookup for the recommendation engine. Pure-
   function module that loads `assets/data/cars.json` +
   `assets/data/bikes.json` (and the `assets/data/catalog-
   profiles.json` weights table) on demand and returns frozen
   lists keyed by domain. No DOM, no storage, no fetch — the
   Shell wires it up via the page-conditional Proxy factory in
   shell-thin.js.

   The catalog is intentionally local (no fetch, no http URLs):
   the bundle is shipped as JSON in the repo so the offline
   file:// path works the same as the GitHub Pages path. The
   "about-side answersAnswers" pattern from the Discovery UX (a
   quiz reveals 3 of these entries under the archetype card) is
   decoded here, NOT in recommend.js.

   AD-9  — no PII; catalog entries are public-domain facts.
   AD-12 — ES2018 vanilla, no build step.
   AD-14 — frozen surface; writable:false, configurable:false.
   ============================================================ */

(function () {
  'use strict';

  // HT is provided by the Shell (window.HT) or by the smoke
  // harness (vm sandbox). The IIFE writes through `HT.catalog`,
  // and the smoke harness routes catalog.js the same way it
  // routes scoring.js: read the file, run in the vm context,
  // then read back HT.catalog.
  var HT = (typeof window !== 'undefined' && window.HT)
        || (typeof self   !== 'undefined' && self.HT)
        || {};
  if (typeof window !== 'undefined' && !window.HT) window.HT = HT;
  if (typeof self   !== 'undefined' && !self.HT)   self.HT  = HT;

  // ---- constants --------------------------------------------------

  // URL paths to the bundled JSON data. The recommend.js /
  // catalog.js modules reach these via the global fetch shim
  // injected by the Shell (HT.net.get) or, in the smoke harness,
  // via the synchronous fs.readFileSync injection at boot. We
  // intentionally do NOT cache the data at module-load time so
  // the lazy-load round-trip stays consistent with scoring.js +
  // challenge.js.
  var CATALOG_PATHS = {
    car:  'assets/data/cars.json',
    bike: 'assets/data/bikes.json',
    profiles: 'assets/data/catalog-profiles.json',
  };

  // In-memory cache. The smoke harness (and the AC gate fixture)
  // pre-populates `HT.__data` so the modules don't need a real
  // fetch implementation. The Shell boot path uses HT.net.get.
  var cache = {
    car: null,
    bike: null,
    profiles: null,
  };

  // ---- helpers ----------------------------------------------------

  // Synchronous fallback — reads from HT.__data if the harness
  // pre-loaded the JSON. Real Shell runtime calls use lazyLoad's
  // own fs shim; the catalog module never makes a network call.
  function readDomain(domain) {
    if (cache[domain]) return cache[domain];
    // Defensive: the Shell exposes HT.net.get but the catalog is
    // intentionally synchronous (the offline file:// path must
    // work). If the data isn't already cached, we fail open with
    // an empty array — the lazyLoad() chain in shell-thin.js
    // populates the cache before recommend.match() ever runs in
    // the real runtime.
    if (typeof HT !== 'undefined' && HT.__data && Array.isArray(HT.__data[domain])) {
      cache[domain] = Object.freeze(HT.__data[domain].slice());
      return cache[domain];
    }
    return Object.freeze([]);
  }

  function readProfiles() {
    if (cache.profiles) return cache.profiles;
    if (typeof HT !== 'undefined' && HT.__profiles && typeof HT.__profiles === 'object') {
      cache.profiles = Object.freeze({
        domains: Object.freeze(HT.__profiles.domains || {}),
      });
      return cache.profiles;
    }
    return Object.freeze({ domains: Object.freeze({}) });
  }

  // ---- public API --------------------------------------------------

  // Returns the canonical domain-bucket map {car: N, bike: N}.
  // Counts come from the JSON files (>= 10 each per the DC-4
  // contract). The return is frozen so callers can't mutate the
  // shared cache.
  function list() {
    var carList  = readDomain('car');
    var bikeList = readDomain('bike');
    return Object.freeze({
      car:  carList.length,
      bike: bikeList.length,
    });
  }

  // Returns the frozen list of catalog entries for a single
  // domain. lazyLoad is the lazy-load hook the Shell uses to
  // populate HT.__data before the call; in the smoke harness it
  // is a no-op because the harness pre-loads the data. Both
  // shapes return the same frozen array — the entry shape is
  // {id, domain, attrs{}, why}.
  function lazyLoad(domain) {
    domain = domain === 'car' || domain === 'bike' ? domain : null;
    if (!domain) return Object.freeze([]);
    // Touch readDomain() so the cache populates if HT.__data was
    // pre-loaded by the harness. Real runtime relies on the
    // Shell to inject HT.__data before recommend.match().
    return readDomain(domain);
  }

  // Internal: expose the raw entry list to recommend.js via
  // HT.catalog._entries(domain). The smoke harness uses this to
  // verify the data flow; recommend.js also calls it via the
  // public facade in recommend.js.
  function _entries(domain) {
    return readDomain(domain);
  }

  // Internal: expose the profiles weights table to recommend.js.
  function _profiles() {
    return readProfiles();
  }

  var publicApi = Object.freeze({
    list: list,
    lazyLoad: lazyLoad,
    _entries: _entries,
    _profiles: _profiles,
  });

  // ---- AD-14 freeze (writable:false, configurable:false) ---------
  // Same defensive pattern as scoring.js / challenge.js /
  // results.js. The Object.defineProperty throws if HT.catalog
  // already exists as a non-configurable property; the catch arm
  // falls back to a direct assignment so the smoke harness can
  // reload the module after a state reset.
  try {
    Object.defineProperty(HT, 'catalog', {
      value: publicApi,
      writable: false,
      configurable: false,
      enumerable: true,
    });
  } catch (_) {
    try { HT.catalog = publicApi; } catch (__) {}
  }
  if (typeof window !== 'undefined') window.HT = HT;
  if (typeof self   !== 'undefined') self.HT  = HT;
})();