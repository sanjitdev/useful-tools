/* ============================================
   Paint Calculator — paint-calculator-core.js (Story 4b)
   Parse-time core: data tables (DEFAULTS, SAMPLE),
   tunable constants, and the pure math layer
   (calcGallons, buildWallsBase64, parseWallsBase64).
   Handlers reference these via HT.paintCalculatorCore.

   Story 4b — see _bmad-output/implementation-artifacts/
   story-4b-per-tool-code-splitting.md
   ============================================ */

(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.HT) return;
  var HT = window.HT;

  // -------------------------------------------------------------
  // Constants
  // -------------------------------------------------------------
  var COVERAGE_SQFT_PER_GALLON = 350; // standard single-coat drywall coverage
  var DOOR_SQFT = 21;                 // standard 3 ft × 7 ft door
  var WINDOW_SQFT = 12;               // standard 3 ft × 4 ft window

  var DEFAULTS = {
    doors: 1,
    windows: 1,
  };

  // -------------------------------------------------------------
  // Sample: 1 wall of 12×8 ft, 1 door, 1 window.
  // totalArea = 12*8 - 1*21 - 1*12 = 63 sq ft → 1 gallon.
  // -------------------------------------------------------------
  var SAMPLE_WALLS = [{ w: 12, h: 8 }];

  // -------------------------------------------------------------
  // calcGallons — pure math.
  // Returns { totalArea: number, gallons: number } where
  // gallons is Math.ceil(totalArea / 350), clamped to 0 when
  // totalArea is <= 0 (doors exceed walls, etc).
  // -------------------------------------------------------------
  function calcGallons(walls, doors, windows) {
    var wallSum = 0;
    if (Array.isArray(walls)) {
      for (var i = 0; i < walls.length; i += 1) {
        var w = Number(walls[i] && walls[i].w) || 0;
        var h = Number(walls[i] && walls[i].h) || 0;
        if (w > 0 && h > 0) wallSum += w * h;
      }
    }
    var dN = Math.max(0, Number(doors) || 0);
    var wN = Math.max(0, Number(windows) || 0);
    var openings = dN * DOOR_SQFT + wN * WINDOW_SQFT;
    var totalArea = wallSum - openings;
    var gallons = totalArea > 0 ? Math.ceil(totalArea / COVERAGE_SQFT_PER_GALLON) : 0;
    return { totalArea: totalArea, gallons: gallons };
  }

  // -------------------------------------------------------------
  // Base64 helpers for URL state. Use btoa(unescape(encodeURIComponent))
  // for unicode safety, matching the recipe-scaler pattern.
  // -------------------------------------------------------------
  function encodeBase64(s) {
    return btoa(unescape(encodeURIComponent(s)));
  }
  function decodeBase64(b64) {
    return decodeURIComponent(escape(atob(b64)));
  }

  function buildWallsBase64(walls) {
    try {
      return encodeBase64(JSON.stringify(Array.isArray(walls) ? walls : []));
    } catch (e) {
      return '';
    }
  }

  function parseWallsBase64(b64) {
    if (!b64) return null;
    try {
      var json = decodeBase64(b64);
      var arr = JSON.parse(json);
      if (!Array.isArray(arr)) return null;
      var out = [];
      for (var i = 0; i < arr.length; i += 1) {
        var w = Number(arr[i] && arr[i].w) || 0;
        var h = Number(arr[i] && arr[i].h) || 0;
        out.push({ w: w, h: h });
      }
      return out;
    } catch (e) {
      return null;
    }
  }

  // -------------------------------------------------------------
  // Expose data + math to handlers (AD-14 internal handle).
  // -------------------------------------------------------------
  HT.paintCalculatorCore = Object.freeze({
    getConstants: function () {
      return {
        COVERAGE_SQFT_PER_GALLON: COVERAGE_SQFT_PER_GALLON,
        DOOR_SQFT: DOOR_SQFT,
        WINDOW_SQFT: WINDOW_SQFT,
      };
    },
    getDefaults: function () { return DEFAULTS; },
    getSampleWalls: function () { return SAMPLE_WALLS; },
    calcGallons: calcGallons,
    encodeBase64: encodeBase64,
    decodeBase64: decodeBase64,
    buildWallsBase64: buildWallsBase64,
    parseWallsBase64: parseWallsBase64,
  });

  // -------------------------------------------------------------
  // Boot — DOMContentLoaded → lazy-load handlers.js → init()
  // -------------------------------------------------------------
  function boot() {
    if (typeof HT.lazyLoadTool !== 'function') return;
    HT.lazyLoadTool('paint-calculator', './paint-calculator-handlers.js').then(function () {
      if (typeof window.paintCalculatorInit === 'function') {
        try { window.paintCalculatorInit(); }
        catch (err) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('paint-calculator-core: paintCalculatorInit threw', err);
          }
        }
      }
    }).catch(function (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('paint-calculator-core: lazyLoadTool failed', err);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();