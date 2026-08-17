/* ============================================================
   Handy Tools — scoring.js (DC-1, Discovery Pack Epic)

   Trait-scoring engine for quiz / personality / recommendation
   payloads. Pure function: takes (answers, spec) and returns
   {traits, archetype}. No DOM, no storage, no fetch — the
   Shell wires it up via the page-conditional Proxy factory in
   shell-thin.js. AD-14 surface: HT.scoring.score is the only
   public method today.

   spec shape (see tools.schema.json definitions.scoring-config):
     {
       traits: ['calm', 'bold', ...],     // trait IDs
       weights: {                          // question-id -> answer -> trait delta
         q1: { calm: 1, bold: 0, ... },
         q2: { calm: 0, bold: 1, ... },
       },
       archetypes: [
         { id: 'zen',   label: 'Zen',   emoji: '🧘',
           scores: { calm: 80, bold: 20 }, default: false },
         { id: 'hero',  label: 'Hero',  emoji: '🦸',
           scores: { calm: 20, bold: 80 }, default: true },
       ],
       // Optional per-trait normalization caps. If absent the
       // engine assumes weights sum to <=100 per trait and skips
       // the post-normalize clamp.
       traitMax?: { calm: 100, bold: 100, ... },
     }

   answers shape:
     { q1: 'calm', q2: 'bold', q3: undefined, ... }
     (skipped / missing keys contribute zero — see #9 of DC-1)

   ES2018. ~3 KB gz.
   ============================================================ */

(function () {
  'use strict';

  // HT is provided by the Shell (window.HT) or created by the
  // vm-smoke harness (assets/js/_lib.js fixture passes a fresh
  // {HT: {}} object).
  var HT = (typeof window !== 'undefined' && window.HT)
        || (typeof self   !== 'undefined' && self.HT)
        || {};
  if (typeof window !== 'undefined' && !window.HT) window.HT = HT;
  if (typeof self   !== 'undefined' && !self.HT)   self.HT  = HT;

  // ---- helpers -----------------------------------------------------

  // Clamp `n` to [0, 100]. NaN-safe (returns 0 for NaN).
  function clamp100(n) {
    if (typeof n !== 'number' || !isFinite(n)) return 0;
    if (n < 0)   return 0;
    if (n > 100) return 100;
    return n;
  }

  // Pick the closest archetype to the trait vector.
  // Distance = sum of |a - b| across traits (L1 / Manhattan).
  // Deterministic: ties broken by (a) default-flag, (b) archetype
  // index, (c) id alphabetic. The same (answers, spec) pair always
  // yields the same archetype.
  function pickArchetype(traits, archetypes) {
    if (!archetypes || !archetypes.length) return null;
    var best = null;
    var bestDist = Infinity;
    var bestIndex = -1;
    for (var i = 0; i < archetypes.length; i++) {
      var a = archetypes[i];
      if (!a || !a.id) continue;
      var s = a.scores || {};
      var d = 0;
      for (var k in traits) {
        if (Object.prototype.hasOwnProperty.call(traits, k)) {
          var v = typeof s[k] === 'number' ? s[k] : 0;
          d += Math.abs(traits[k] - v);
        }
      }
      var dist = d;
      var isBetter = dist < bestDist
        || (dist === bestDist && a.default === true && !(best && best.default))
        || (dist === bestDist
              && (a.default === true) === (best && best.default)
              && i < bestIndex);
      if (best === null || isBetter) {
        best = a;
        bestDist = dist;
        bestIndex = i;
      }
    }
    return best;
  }

  // ---- public API --------------------------------------------------

  function score(answers, spec) {
    answers = answers && typeof answers === 'object' ? answers : {};
    spec = spec && typeof spec === 'object' ? spec : {};

    var traitIds = Array.isArray(spec.traits) ? spec.traits : [];
    var weights  = spec.weights && typeof spec.weights === 'object' ? spec.weights : {};
    var archetypes = Array.isArray(spec.archetypes) ? spec.archetypes : [];
    var traitMax = spec.traitMax && typeof spec.traitMax === 'object' ? spec.traitMax : null;

    // 1. Accumulate raw trait totals from answers.
    // Skipped / unknown / undefined answer values contribute 0
    // (see DC-1 checks #9 + #12 — unknown keys are silently
    // ignored, no throw).
    var raw = {};
    for (var i = 0; i < traitIds.length; i++) raw[traitIds[i]] = 0;

    for (var qid in weights) {
      if (!Object.prototype.hasOwnProperty.call(weights, qid)) continue;
      var ans = Object.prototype.hasOwnProperty.call(answers, qid) ? answers[qid] : undefined;
      if (ans === undefined) continue; // skipped
      var row = weights[qid];
      if (!row || typeof row !== 'object') continue;
      var w = row[ans];
      if (typeof w !== 'object' || w === null) continue; // unknown answer value
      for (var t in w) {
        if (Object.prototype.hasOwnProperty.call(w, t)
            && Object.prototype.hasOwnProperty.call(raw, t)
            && typeof w[t] === 'number') {
          raw[t] += w[t];
        }
      }
    }

    // 2. Normalize to [0, 100] per trait.
    // Without an explicit cap we assume the max-possible raw score
    // per trait is the sum of the highest weight for that trait
    // across all questions (defensive — quiz authors often hand-
    // write weights that don't sum cleanly).
    var cap = {};
    if (traitMax) {
      for (var ti = 0; ti < traitIds.length; ti++) {
        var k = traitIds[ti];
        cap[k] = typeof traitMax[k] === 'number' && traitMax[k] > 0 ? traitMax[k] : 100;
      }
    } else {
      for (var tj = 0; tj < traitIds.length; tj++) {
        var id = traitIds[tj];
        var max = 0;
        for (var q2 in weights) {
          if (!Object.prototype.hasOwnProperty.call(weights, q2)) continue;
          var row2 = weights[q2];
          if (!row2) continue;
          for (var val in row2) {
            if (Object.prototype.hasOwnProperty.call(row2, val)) {
              var w2 = row2[val];
              if (w2 && typeof w2 === 'object' && typeof w2[id] === 'number' && w2[id] > max) {
                max = w2[id];
              }
            }
          }
        }
        cap[id] = max > 0 ? max : 100;
      }
    }

    var traits = {};
    for (var tk = 0; tk < traitIds.length; tk++) {
      var tkey = traitIds[tk];
      var pct = cap[tkey] > 0 ? (raw[tkey] / cap[tkey]) * 100 : 0;
      traits[tkey] = clamp100(pct);
    }

    // 3. Pick archetype (deterministic).
    var archetype = pickArchetype(traits, archetypes);

    // 4. Empty-answers path — return the spec's default archetype
    // if declared, otherwise the first non-default, otherwise the
    // first archetype, otherwise null.
    var hasAnyAnswer = false;
    for (var aq in answers) {
      if (Object.prototype.hasOwnProperty.call(answers, aq) && answers[aq] !== undefined) {
        hasAnyAnswer = true; break;
      }
    }
    if (!hasAnyAnswer && archetype) {
      for (var ai = 0; ai < archetypes.length; ai++) {
        if (archetypes[ai] && archetypes[ai].default === true) {
          archetype = archetypes[ai];
          break;
        }
      }
    }

    return Object.freeze({
      traits: Object.freeze(traits),
      archetype: archetype ? Object.freeze({
        id: archetype.id,
        label: archetype.label || archetype.id,
        emoji: archetype.emoji || '',
        default: archetype.default === true,
      }) : null,
    });
  }

  var publicApi = Object.freeze({ score: score });

  // ---- AD-14 freeze (writable:false, configurable:false) ---------
  // Same defensive pattern as quiz.js / date-picker-v2/date-picker.js.
  try {
    Object.defineProperty(HT, 'scoring', {
      value: publicApi,
      writable: false,
      configurable: false,
      enumerable: true,
    });
  } catch (_) {
    try { HT.scoring = publicApi; } catch (__) {}
  }
  if (typeof window !== 'undefined') window.HT = HT;
  if (typeof self   !== 'undefined') self.HT  = HT;
})();
