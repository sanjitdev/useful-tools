/* ============================================
   Handy Tools — search.js (FR-5, AD-14)
   Pure-function search engine over `tools.json`.
   Ranking: exact > prefix > word-boundary > substring > fuzzy.
   NFKD-normalized, case-insensitive, accent-insensitive.
   Public API: HT.search(query) => readonly Array<{slug, title, score, matchedField}>
   ============================================ */

(function () {
  'use strict';

  window.HT = window.HT || {};

  var VERSION = '1.0.0';
  var MAX_RESULTS = 10;
  var MIN_FUZZY_QUERY_LENGTH = 4;
  var INLINE_ID = 'ht-tools-json-inline';

  /* ---- ranking tiers (AI-E1-11: hoisted from inline literals in
     scoreExact / scorePrefix / scoreWordBoundary / scoreSubstring) ---- */

  // Each tier's score is the start of a decreasing range. Earlier match
  // positions get small bonuses (subtracting `idx`) but never below the
  // next tier's start — that's why the tiers don't overlap and why the
  // comment in `scoreFuzzy` calls the substring tier's 50 "the lowest
  // tier". Any future scoring tweak should change the constants below
  // and the test in scripts/_smoke_search_perf.js (AC-8 ≤ 50ms cold /
  // ≤ 10ms warm) together.
  var RANKING_TIERS = Object.freeze({
    EXACT: 1000,         // full-string match anywhere in the field
    PREFIX: 500,         // query is the start of the field
    WORD_BOUNDARY: 200,  // query follows whitespace / hyphen / start
    SUBSTRING: 50,       // query appears anywhere (first match wins)
  });

  /* ---- normalization ---- */

  // NFKD decomposes accents (é -> e + combining acute); the combining-mark
  // strip removes the diacritic. Lowercase follows. All three are required
  // for case/accent insensitivity per AC-4.
  function normalize(s) {
    if (s === null || s === undefined) return '';
    return String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  /* ---- isEmbedMode helper (matches the home-grid.js check) ---- */

  function isEmbedMode() {
    try {
      if (typeof document !== 'undefined' && document.documentElement && document.documentElement.dataset && document.documentElement.dataset.embed === '1') {
        return true;
      }
      if (typeof window !== 'undefined' && window.location && window.location.search) {
        // Spec AC-10: only `?embed=1` triggers embed mode. `?embed=0`,
        // `?embed=false`, `?embed=foo` etc. are not embed mode (the host
        // page's URL has its own reasons for an embed= param that isn't
        // our flag). Strict-equality match only.
        var params = new URLSearchParams(window.location.search);
        if (params.get('embed') === '1') {
          return true;
        }
      }
    } catch (e) { /* no-op */ }
    return false;
  }

  /* ---- data source resolution (sync paths) ---- */

  function readHomeGridEntries() {
    try {
      if (window.HT && window.HT.homeGrid && Array.isArray(window.HT.homeGrid.entries) && window.HT.homeGrid.entries.length > 0) {
        return window.HT.homeGrid.entries.slice();
      }
    } catch (e) { /* no-op */ }
    return null;
  }

  function readInlineEntries() {
    try {
      if (typeof document === 'undefined') return null;
      var el = document.getElementById(INLINE_ID);
      if (!el || !el.textContent) return null;
      var parsed = JSON.parse(el.textContent);
      if (parsed && Array.isArray(parsed.tools)) return parsed.tools.slice();
    } catch (e) { /* no-op */ }
    return null;
  }

  /* ---- index builder ---- */

  function buildIndexEntry(tool) {
    if (!tool || typeof tool !== 'object') return null;
    var slug = tool.slug || tool.id || '';
    if (!slug) return null;
    var title = tool.title || '';
    var description = tool.description || '';
    var keywords = Array.isArray(tool.keywords) ? tool.keywords.join(' ') : '';
    var category = tool.category || '';
    // Icon path (repo-relative) is carried verbatim; chrome-header-search
    // resolves it to a page-depth-aware URL via HT.search.resolveAssetUrl.
    var icon = (typeof tool.icon === 'string') ? tool.icon : '';
    var rawPriority = tool['search-priority'];
    // Reject NaN and non-finite numbers explicitly — NaN passes the
    // `typeof === 'number'` check but breaks every sort comparator
    // downstream (NaN comparisons return NaN, not a stable ordering).
    var searchPriority = (typeof rawPriority === 'number' && isFinite(rawPriority))
      ? rawPriority
      : 5;
    return {
      slug: slug,
      title: title,
      titleNorm: normalize(title),
      description: description,
      descriptionNorm: normalize(description),
      keywords: keywords,
      keywordsNorm: normalize(keywords),
      slugNorm: normalize(slug),
      category: category,
      // Icon path (repo-relative, e.g. "assets/icons/quiz-preview.svg").
      // Carried into the result so chrome-header-search can render the
      // icon swatch. resolveAssetUrl in shell.js prefixes the right
      // number of `../` for the current page depth.
      icon: tool.icon || '',
      categoryNorm: normalize(category),
      searchPriority: searchPriority
    };
  }

  function buildIndexSync(entries) {
    if (!entries || entries.length === 0) return [];
    var out = [];
    for (var i = 0; i < entries.length; i++) {
      var e = buildIndexEntry(entries[i]);
      if (e) out.push(e);
    }
    return out;
  }

  /* ---- scoring tiers ---- */

  // Each tier returns { score, start, end } or null. Tiers never overlap;
  // the dispatch in `searchIndex` picks the first tier that matches.

  function scoreExact(query, fieldNorm) {
    if (!fieldNorm) return null;
    if (fieldNorm === query) return { score: RANKING_TIERS.EXACT, start: 0, end: fieldNorm.length };
    return null;
  }

  function scorePrefix(query, fieldNorm) {
    if (!fieldNorm || !query || query.length > fieldNorm.length) return null;
    if (fieldNorm.indexOf(query) === 0) {
      return { score: RANKING_TIERS.PREFIX - 0, start: 0, end: query.length };
    }
    return null;
  }

  function scoreWordBoundary(query, fieldNorm) {
    if (!fieldNorm || !query || query.length > fieldNorm.length) return null;
    var from = 0;
    while (from <= fieldNorm.length - query.length) {
      var idx = fieldNorm.indexOf(query, from);
      if (idx === -1) return null;
      var atBoundary = idx === 0;
      if (!atBoundary) {
        // Spec AC-5: word boundary is "after whitespace, hyphen, or string
        // start". Underscore, period, slash, tab are NOT word boundaries
        // for this engine — they are valid characters within a token.
        var prev = fieldNorm.charAt(idx - 1);
        if (prev === ' ' || prev === '-') {
          atBoundary = true;
        }
      }
      if (atBoundary) {
        return { score: RANKING_TIERS.WORD_BOUNDARY - idx, start: idx, end: idx + query.length };
      }
      from = idx + 1;
    }
    return null;
  }

  function scoreSubstring(query, fieldNorm) {
    if (!fieldNorm || !query || query.length > fieldNorm.length) return null;
    var idx = fieldNorm.indexOf(query);
    if (idx === -1) return null;
    return { score: RANKING_TIERS.SUBSTRING - idx, start: idx, end: idx + query.length };
  }

  // Levenshtein distance, 2-row DP. Returns the edit distance between two
  // strings. O(n) space (only two rows in memory). Callers are responsible
  // for short-circuiting when `a.length > b.length` (in which case the
  // distance is at least `a.length - b.length` and we don't need to compute).
  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var prev = new Array(b.length + 1);
    var curr = new Array(b.length + 1);
    for (var j = 0; j <= b.length; j++) prev[j] = j;
    for (var i = 1; i <= a.length; i++) {
      curr[0] = i;
      for (var k = 1; k <= b.length; k++) {
        var cost = a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1;
        var del = prev[k] + 1;
        var ins = curr[k - 1] + 1;
        var sub = prev[k - 1] + cost;
        curr[k] = del < ins ? (del < sub ? del : sub) : (ins < sub ? ins : sub);
      }
      for (var m = 0; m <= b.length; m++) prev[m] = curr[m];
    }
    return prev[b.length];
  }

  function scoreFuzzy(query, fieldNorm) {
    if (!fieldNorm || !query || query.length < MIN_FUZZY_QUERY_LENGTH) return null;
    if (query.length > fieldNorm.length) return null;
    // Brute-force: scan every field substring of length `query.length` and
    // compute Levenshtein ≤ 1. For ~50-char fields × 10-char queries this is
    // ~400 ops per field × 5 fields × 100 entries = 200,000 ops — well under
    // the 10ms warm budget.
    var best = -1;
    var bestD = Infinity;
    for (var i = 0; i <= fieldNorm.length - query.length; i++) {
      var sub = fieldNorm.substr(i, query.length);
      var d = levenshtein(query, sub);
      if (d <= 1 && d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best === -1) return null;
    // Spec AC-5: "Score = 10 - (1 / editDistance), so closer matches win".
    // With editDistance 0 the spec formula divides by zero; treat as the
    // perfect-fuzzy case (no edit) and cap the score at 9.9 (below the
    // substring tier at 50) so the fuzzy tier stays the lowest tier.
    var score = bestD === 0 ? 9.9 : (10 - (1 / bestD));
    return { score: score, start: best, end: best + query.length };
  }

  function evalTier(tier, query, fieldNorm) {
    if (tier === 'exact') return scoreExact(query, fieldNorm);
    if (tier === 'prefix') return scorePrefix(query, fieldNorm);
    if (tier === 'wordBoundary') return scoreWordBoundary(query, fieldNorm);
    if (tier === 'substring') return scoreSubstring(query, fieldNorm);
    if (tier === 'fuzzy') return scoreFuzzy(query, fieldNorm);
    return null;
  }

  // Field order in the index entry. Title wins on ties (documented behavior).
  var FIELDS = ['title', 'description', 'keywords', 'slug', 'category'];
  // Tier order: exact > prefix > word-boundary > substring > fuzzy.
  var TIERS = ['exact', 'prefix', 'wordBoundary', 'substring', 'fuzzy'];

  function pickHighestField(entry, query) {
    var best = null;
    for (var i = 0; i < FIELDS.length; i++) {
      var field = FIELDS[i];
      var fieldNorm = entry[field + 'Norm'];
      if (!fieldNorm) continue;
      for (var t = 0; t < TIERS.length; t++) {
        var hit = evalTier(TIERS[t], query, fieldNorm);
        if (hit !== null) {
          if (best === null || hit.score > best.score) {
            best = { score: hit.score, matchedField: field, tier: TIERS[t] };
          }
          break; // first tier that hits is the field's tier — do not consult higher tiers
        }
      }
    }
    return best;
  }

  /* ---- result assembly ---- */

  function rankResults(index, query) {
    var hits = [];
    for (var i = 0; i < index.length; i++) {
      var entry = index[i];
      var ranked = pickHighestField(entry, query);
      if (ranked !== null) {
        hits.push({
          slug: entry.slug,
          title: entry.title,
          score: ranked.score,
          matchedField: ranked.matchedField,
          // Carry the rich fields too so the row builder in
          // chrome-header-search can render the icon swatch and the
          // description snippet. The fields are already on the index
          // entry (see buildIndexEntry) so this is a no-cost copy.
          description: entry.description,
          category: entry.category,
          icon: entry.icon
        });
      }
    }
    // Build a slug → entry lookup for the secondary/tertiary sort keys.
    var bySlug = {};
    for (var k = 0; k < index.length; k++) bySlug[index[k].slug] = index[k];
    hits.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      var ea = bySlug[a.slug];
      var eb = bySlug[b.slug];
      var pa = ea ? ea.searchPriority : 5;
      var pb = eb ? eb.searchPriority : 5;
      if (pa !== pb) return pa - pb;
      if (a.title !== b.title) return a.title < b.title ? -1 : 1;
      return 0;
    });
    if (hits.length > MAX_RESULTS) hits = hits.slice(0, MAX_RESULTS);
    return Object.freeze(hits.map(function (h) { return Object.freeze(h); }));
  }

  /* ---- module state ---- */

  var _index = null; // lazy-built, frozen on first call
  var _indexPromise = null; // for the async (fetch) path

  function ensureIndexSync() {
    if (_index) return _index;
    var entries = readHomeGridEntries() || readInlineEntries();
    if (entries) {
      _index = Object.freeze(buildIndexSync(entries));
      return _index;
    }
    return null;
  }

  // Capture this script's URL at IIFE time so the async fetch can resolve
  // tools.json relative to the script's own location. Both home and tool
  // pages load search.js via the same absolute path (`/assets/js/search.js`
  // on home, `/assets/js/search.js` on tool pages because `../../` walks
  // out of `tools/<slug>/`). So `../tools.json` from the script URL
  // resolves to the repo-root `tools.json` from any page. This avoids the
  // `./tools.json` trap that breaks on tool pages (relative-to-document
  // resolution yields `tools/<slug>/tools.json`, which 404s).
  var SCRIPT_URL = (function () {
    try {
      if (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) {
        return document.currentScript.src;
      }
    } catch (e) { /* no-op */ }
    return '';
  })();

  function repoToolsJsonUrl() {
    if (!SCRIPT_URL) return './tools.json';
    try {
      return new URL('../tools.json', SCRIPT_URL).href;
    } catch (e) {
      return './tools.json';
    }
  }

  function ensureIndexAsync() {
    if (_index) return Promise.resolve(_index);
    if (_indexPromise) return _indexPromise;
    _indexPromise = (typeof fetch === 'function'
      ? fetch(repoToolsJsonUrl(), { cache: 'no-cache' })
      : Promise.reject(new Error('fetch unavailable')))
      .then(function (resp) {
        if (!resp || !resp.ok) throw new Error('tools.json HTTP ' + (resp && resp.status));
        return resp.json();
      })
      .then(function (data) {
        var entries = data && Array.isArray(data.tools) ? data.tools : [];
        _index = Object.freeze(buildIndexSync(entries));
        return _index;
      })
      .catch(function (err) {
        // Fall back to inline block if fetch fails. Clear _indexPromise
        // first so a future call can retry (e.g., transient network
        // failure followed by recovery). Without this clear, a single
        // rejection poisons the cache for the lifetime of the page.
        _indexPromise = null;
        var inline = readInlineEntries();
        if (inline) {
          _index = Object.freeze(buildIndexSync(inline));
          return _index;
        }
        throw err;
      });
    return _indexPromise;
  }

  /* ---- debug instrumentation (only when ?debug=1 or HT.__debug) ---- */

  function debugEnabled() {
    try {
      if (window.HT && window.HT.__debug === true) return true;
      if (window.location && window.location.search && new URLSearchParams(window.location.search).get('debug') === '1') return true;
    } catch (e) { /* no-op */ }
    return false;
  }

  function debugLog() {
    if (!debugEnabled()) return;
    try {
      var args = ['search:'];
      for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
      console.debug.apply(console, args);
    } catch (e) { /* no-op */ }
  }

  /* ---- public API ---- */

  function searchSync(query) {
    if (isEmbedMode()) return Object.freeze([]);
    if (typeof query !== 'string') return Object.freeze([]);
    var trimmed = query.trim();
    if (trimmed === '') return Object.freeze([]);
    var q = normalize(trimmed);
    var idx = ensureIndexSync();
    if (!idx) return null; // signal: caller should await async path
    var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    var results = rankResults(idx, q);
    var t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    debugLog('warm', (t1 - t0).toFixed(2) + 'ms', 'q="' + trimmed + '"', 'n=' + results.length);
    return results;
  }

  function searchAsync(query) {
    if (isEmbedMode()) return Promise.resolve(Object.freeze([]));
    if (typeof query !== 'string') return Promise.resolve(Object.freeze([]));
    var trimmed = query.trim();
    if (trimmed === '') return Promise.resolve(Object.freeze([]));
    var q = normalize(trimmed);
    var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    return ensureIndexAsync().then(function (idx) {
      var results = rankResults(idx, q);
      var t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
      debugLog('async', (t1 - t0).toFixed(2) + 'ms', 'q="' + trimmed + '"', 'n=' + results.length);
      return results;
    });
  }

  // Unified API: always returns a thenable. Sync results are wrapped in
  // Promise.resolve so the consumer (`Promise.resolve(HT.search(q)).then(...)`)
  // works on both home and tool pages.
  function search(query) {
    if (isEmbedMode()) return Object.freeze([]);
    if (typeof query !== 'string') return Object.freeze([]);
    if (query.trim() === '') return Object.freeze([]);
    var sync = searchSync(query);
    if (sync !== null) return Promise.resolve(sync);
    return searchAsync(query);
  }

  search.version = VERSION;
  search._normalize = normalize;
  search._isEmbedMode = isEmbedMode;

  // Resolve a repo-root-relative path to a URL the current page can
  // fetch. The chrome (header search, packs, etc.) splices the same
  // way across depths: root pages (index.html), /packs/, /tools/, and
  // /tools/packs/discovery/. Each depth needs a different number of
  // `../` so the URL resolves to the same asset on disk.
  //
  // Examples (relative → effective):
  //   index.html           → depth 0 → "assets/icons/x.svg"
  //   packs/fun.html       → depth 1 → "../assets/icons/x.svg"
  //   tools/qr/.../html    → depth 1 → "../assets/icons/x.svg"
  //   tools/packs/discovery/car-finder/.../html → depth 3 → "../../../assets/icons/x.svg"
  //
  // Caller passes a path that does NOT start with `/` (e.g. the
  // literal value in tools.json's `icon` field); absolute paths are
  // returned unchanged.
  search.resolveAssetUrl = function resolveAssetUrl(relative) {
    if (typeof relative !== 'string' || relative.length === 0) return '';
    if (relative.charAt(0) === '/' || /^[a-z][a-z0-9+\-.]*:/i.test(relative)) {
      return relative;
    }
    try {
      if (typeof window === 'undefined' || !window.location || !window.location.pathname) {
        return relative;
      }
      var path = window.location.pathname;
      // Strip the query string and hash so trailing slashes don't
      // confuse the depth count.
      var cleanPath = path.split('?')[0].split('#')[0];
      // Count the number of directory segments after the leading '/'.
      // '/index.html' → 0; '/packs/fun.html' → 1; '/a/b/c/file.html' → 2.
      var segments = cleanPath.split('/').filter(function (s) { return s.length > 0; });
      var depth = Math.max(0, segments.length - 1);
      var prefix = '';
      for (var i = 0; i < depth; i++) prefix += '../';
      return prefix + relative;
    } catch (e) {
      return relative;
    }
  };

  // Palette bold-match hook. Returns the [start, end] of the first matching
  // tier of `query` inside `fieldValue` — INDICES INTO THE RAW (original)
  // `fieldValue` (not the normalized form). The tier dispatch runs on
  // normalized strings (so the match logic stays in sync with `searchIndex`)
  // but the returned indices are mapped back to the raw string so callers
  // like `buildMatchFragment` can `fieldValue.slice(start, end)` without
  // landing on the wrong characters when the raw string contains
  // diacritics, ligatures, or case differences that `normalize` strips.
  //
  // Mapping strategy: walk both strings in parallel, copying each raw
  // codepoint to the next normalized codepoint(s). When the normalized
  // cursor reaches `hit.start` / `hit.end`, record the corresponding raw
  // cursor. This is O(n) and handles NFKD expansion (nfd → multiple
  // codepoints) correctly.
  search._matchRange = function (query, fieldValue) {
    if (typeof query !== 'string' || typeof fieldValue !== 'string') return null;
    if (query.length === 0 || fieldValue.length === 0) return null;
    var q = normalize(query);
    var f = normalize(fieldValue);
    if (!q || !f) return null;
    var hit = scoreExact(q, f) || scorePrefix(q, f) || scoreWordBoundary(q, f) || scoreSubstring(q, f);
    if (!hit && q.length >= MIN_FUZZY_QUERY_LENGTH) hit = scoreFuzzy(q, f);
    if (!hit) return null;
    // Map normalized [hit.start, hit.end) back to raw indices.
    var raw = mapNormToRaw(fieldValue, hit.start, hit.end);
    return raw;
  };

  // Helper: walk `fieldValue` codepoint-by-codepoint and report the raw
  // indices that correspond to normalized indices [nStart, nEnd).
  // `normalize` is `NFKD` + strip combining marks + lowercase, so a single
  // raw codepoint may contribute 0+ normalized chars (combining marks
  // contribute 0; ASCII letters contribute 1; accented chars like 'é'
  // contribute 2 after NFKD: 'e' + combining acute).
  function mapNormToRaw(fieldValue, nStart, nEnd) {
    var rawStart = -1, rawEnd = -1;
    var nCursor = 0;
    // Walk codepoints (surrogate pairs iterate as one item).
    var iter = fieldValue[Symbol.iterator]();
    var step = iter.next(), i = 0;
    while (!step.done) {
      var ch = step.value;
      var nLen = normalizedLengthOf(ch);
      if (rawStart === -1 && nCursor + nLen > nStart) rawStart = i;
      nCursor += nLen;
      if (rawStart !== -1 && rawEnd === -1 && nCursor >= nEnd) {
        // rawEnd is the offset AFTER this codepoint — the codepoint we
        // just advanced past is part of (or the last of) the match, so
        // the slice boundary sits at i + ch.length, not at i (which is
        // the codepoint's START).
        rawEnd = i + ch.length;
        break;
      }
      step = iter.next(); i += ch.length;
    }
    if (rawStart === -1) rawStart = fieldValue.length;
    if (rawEnd === -1) rawEnd = fieldValue.length;
    return { start: rawStart, end: rawEnd };
  }

  // How many normalized codepoints does one raw codepoint produce?
  // Combining marks (U+0300–U+036F) yield 0 after the strip in `normalize`.
  // Everything else yields 1 (BMP) or the NFKD expansion length of the
  // surrogate-pair codepoint, but practically all input is BMP so 1 is fine.
  function normalizedLengthOf(ch) {
    if (ch.length === 1) {
      var code = ch.charCodeAt(0);
      // Strip range applied by `normalize`: \u0300-\u036f combining marks.
      // Keep this in sync with the stripper in `normalize`.
      if (code >= 0x0300 && code <= 0x036f) return 0;
      return 1;
    }
    // Surrogate pair (a single emoji-style codepoint) — normalize yields 1+ chars.
    // Compute the NFKD length to be precise. But for the palette's use case
    // (tool titles in Cobalt tokens), surrogate-pair codepoints don't appear
    // in matching paths, so a 1 is a safe lower bound.
    try {
      return ch.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').length;
    } catch (_) {
      return 1;
    }
  }

  window.HT.search = Object.freeze(search);
})();
