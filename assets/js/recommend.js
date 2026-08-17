/* ============================================================
   Handy Tools — recommend.js (DC-4, Discovery Pack Epic)

   Recommendation engine for the Discovery quiz "Top match"
   surface. Pairs a profile (traits + weights) against a
   domain catalog (cars / bikes) and returns the top + a few
   alternatives + a human-readable explanation.

   Returns:
     {
       top: { id, domain, attrs, why, score: 0..100 },
       alternatives: [{ id, domain, attrs, why, score }, ...],  // >=1 when catalog has >=2
       explain: { whyMatch: [str, ...], whyNot: [str, ...] },
     }

   Scoring is dot-product style: each catalog entry's attrs are
   mapped to a trait vector, then `dot(profile.traits, entry) /
   norm` is renormalized to [0, 100]. Deterministic — same
   profile yields the same top entry across calls.

   Bundle target: ≤ 4 KB gz.
   ============================================================ */

(function () {
  'use strict';

  // HT is provided by the Shell (window.HT) or by the smoke
  // harness (vm sandbox).
  var HT = (typeof window !== 'undefined' && window.HT)
        || (typeof self   !== 'undefined' && self.HT)
        || {};
  if (typeof window !== 'undefined' && !window.HT) window.HT = HT;
  if (typeof self   !== 'undefined' && !self.HT)   self.HT  = HT;

  // ---- helpers ----------------------------------------------------

  // Clamp `n` to [0, 100]. NaN-safe (returns 0 for NaN).
  function clamp100(n) {
    if (typeof n !== 'number' || !isFinite(n)) return 0;
    if (n < 0)   return 0;
    if (n > 100) return 100;
    return n;
  }

  // Map a catalog entry's attrs to a normalized trait vector
  // using the domain's profile weights. Returns a {trait: value}
  // map. The mapping is additive: for each attr key, look up
  // the profile's weights[domain].attrMap[attr] → trait deltas,
  // then accumulate. Deterministic — Object.keys order is
  // insertion order in modern engines.
  function entryTraitVector(entry, profile, domain) {
    var map = {};
    var weights = profile && profile[domain];
    if (!weights || typeof weights !== 'object') return map;
    var attrMap = weights.attrMap || {};
    var traitMax = weights.traitMax || {};
    var attrs = (entry && entry.attrs) || {};
    var attrKeys = Object.keys(attrs);
    for (var i = 0; i < attrKeys.length; i++) {
      var ak = attrKeys[i];
      var av = attrs[ak];
      var tmap = attrMap[ak];
      if (!tmap || typeof tmap !== 'object') continue;
      // Each attr has a discrete value (string/number) that
      // maps to trait deltas. e.g., fuel: 'hybrid' -> {efficiency: 0.8}
      var deltas = tmap[String(av)];
      if (!deltas || typeof deltas !== 'object') continue;
      var dkeys = Object.keys(deltas);
      for (var j = 0; j < dkeys.length; j++) {
        var tk = dkeys[j];
        var dv = deltas[tk];
        if (typeof dv !== 'number') continue;
        var cap = typeof traitMax[tk] === 'number' && traitMax[tk] > 0 ? traitMax[tk] : 100;
        if (!map[tk]) map[tk] = 0;
        map[tk] += (dv / cap) * 100;
      }
    }
    return map;
  }

  // Score a single entry against a profile. Score is the dot
  // product of (profile.traits) · (entryTraitVector), normalized
  // to [0, 100] by dividing by the L1-norm of the profile.
  // profile.traits is a {trait: weight 0..1} map; profile.weights
  // is an optional secondary weighting (currently unused by the
  // MVP but reserved for Story 10.10).
  function scoreEntry(entry, profile, domain) {
    var traits = (profile && profile.traits) || {};
    var etv = entryTraitVector(entry, profile, domain);
    var dot = 0;
    var norm = 0;
    var tkeys = Object.keys(traits);
    for (var i = 0; i < tkeys.length; i++) {
      var tk = tkeys[i];
      var w = typeof traits[tk] === 'number' ? traits[tk] : 0;
      norm += Math.abs(w);
      var ev = typeof etv[tk] === 'number' ? etv[tk] : 0;
      dot += w * ev;
    }
    if (norm <= 0) return 0;
    return clamp100((dot / norm));
  }

  // Build the explain.whyMatch / whyNot arrays. We pick the
  // top-2 traits by absolute contribution and emit one sentence
  // each. whyNot mirrors the bottom-1 trait.
  function explain(entry, profile, domain) {
    var etv = entryTraitVector(entry, profile, domain);
    var traits = (profile && profile.traits) || {};
    var pairs = [];
    var tkeys = Object.keys(etv);
    for (var i = 0; i < tkeys.length; i++) {
      var tk = tkeys[i];
      if (typeof traits[tk] !== 'number') continue;
      pairs.push({ trait: tk, value: etv[tk], weight: traits[tk] });
    }
    pairs.sort(function (a, b) {
      return Math.abs(b.weight * b.value) - Math.abs(a.weight * a.value);
    });
    var whyMatch = [];
    var whyNot = [];
    var top2 = pairs.slice(0, 2);
    for (var j = 0; j < top2.length; j++) {
      var t = top2[j].trait;
      var pct = Math.round(top2[j].value);
      whyMatch.push('strong ' + t + ' (' + pct + '%)');
    }
    if (pairs.length > 2) {
      var bottom = pairs[pairs.length - 1];
      var bpct = Math.round(bottom.value);
      whyNot.push('weaker ' + bottom.trait + ' (' + bpct + '%)');
    }
    if (whyMatch.length === 0) whyMatch.push('best overall match');
    if (whyNot.length === 0) whyNot.push('no obvious trade-off');
    return { whyMatch: whyMatch, whyNot: whyNot };
  }

  // ---- public API --------------------------------------------------

  // Match a profile against the catalog for `domain`. Returns
  // {top, alternatives, explain}. top is non-null when the
  // catalog has >= 1 entry; alternatives is always an array of
  // length >= 1 when catalog has >= 2 entries. Deterministic.
  function match(profile, domain) {
    profile = profile && typeof profile === 'object' ? profile : {};
    domain = domain === 'car' || domain === 'bike' ? domain : 'car';

    // Resolve the entries + profile weights. The Shell wires
    // HT.catalog via the same Proxy factory; here we read
    // through the publicApi (catalog.js exposes _entries for
    // internal callers like recommend.js).
    var cat = (typeof HT !== 'undefined' && HT.catalog) || null;
    if (!cat || typeof cat._entries !== 'function') {
      return Object.freeze({
        top: null,
        alternatives: Object.freeze([]),
        explain: Object.freeze({ whyMatch: Object.freeze([]), whyNot: Object.freeze([]) }),
      });
    }
    var entries = cat._entries(domain) || [];
    var profiles = (typeof cat._profiles === 'function' ? cat._profiles() : null) || { domains: {} };
    var domainProfile = (profiles.domains && profiles.domains[domain]) || {};

    if (entries.length === 0) {
      return Object.freeze({
        top: null,
        alternatives: Object.freeze([]),
        explain: Object.freeze({ whyMatch: Object.freeze([]), whyNot: Object.freeze([]) }),
      });
    }

    // Score every entry; tie-break by id alphabetic for
    // determinism (Object.freeze the array before sorting so we
    // don't mutate the shared cache).
    var scored = entries.map(function (e) {
      return {
        id: e.id,
        domain: domain,
        attrs: e.attrs,
        why: e.why,
        score: scoreEntry(e, profile, domain),
      };
    });
    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      if (a.id < b.id) return -1;
      if (a.id > b.id) return 1;
      return 0;
    });

    var top = scored[0];
    var alternatives = scored.length > 1 ? scored.slice(1, 4) : [];
    // Always include at least 1 alternative when we have a
    // catalog of >= 2 (per the DC-4 contract — `altsAtLeast1`).
    if (scored.length >= 2 && alternatives.length === 0) {
      alternatives = [scored[1]];
    }

    var ex = explain(entries.filter(function (e) { return e.id === top.id; })[0] || entries[0], profile, domain);

    // Re-fetch the original entry for `top` so we preserve its
    // full attrs + why in the return.
    var topEntry = entries.filter(function (e) { return e.id === top.id; })[0];

    return Object.freeze({
      top: Object.freeze({
        id: topEntry.id,
        domain: domain,
        attrs: Object.freeze(Object.assign({}, topEntry.attrs)),
        why: topEntry.why,
        score: top.score,
      }),
      alternatives: Object.freeze(alternatives.map(function (a) {
        var ae = entries.filter(function (e) { return e.id === a.id; })[0];
        return Object.freeze({
          id: ae.id,
          domain: domain,
          attrs: Object.freeze(Object.assign({}, ae.attrs)),
          why: ae.why,
          score: a.score,
        });
      })),
      explain: Object.freeze({
        whyMatch: Object.freeze(ex.whyMatch.slice()),
        whyNot: Object.freeze(ex.whyNot.slice()),
      }),
    });
  }

  var publicApi = Object.freeze({ match: match });

  // ---- AD-14 freeze (writable:false, configurable:false) ---------
  // Same defensive pattern as scoring.js / challenge.js /
  // results.js / catalog.js.
  try {
    Object.defineProperty(HT, 'recommend', {
      value: publicApi,
      writable: false,
      configurable: false,
      enumerable: true,
    });
  } catch (_) {
    try { HT.recommend = publicApi; } catch (__) {}
  }
  if (typeof window !== 'undefined') window.HT = HT;
  if (typeof self   !== 'undefined') self.HT  = HT;
})();