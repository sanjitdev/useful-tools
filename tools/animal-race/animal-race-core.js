/* ============================================
   Animal Race — animal-race-core.js (Story 4b Phase 3)
   Parse-time core: holds the ANIMALS data table (icon SVG silhouettes,
   speeds, colors) + tunable constants + the mutable `state` object.
   Lazy-loads animal-race-handlers.js on DOMContentLoaded; handlers
   reference data via HT.animalRaceCore.

   First-paint payload: ~2.5 KB gz (vs. 5.9 KB gz monolithic).

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
  var TRACK_LENGTH_M = 100;
  var DEFAULT_RACE_DURATION_S = 30;
  var MIN_RACE_DURATION_S = 2;
  var RACE_DURATION_OPTIONS = [30, 60];
  var HUMAN_MAX_KMH = 80;
  var HUMAN_MIN_KMH = 1;

  // -------------------------------------------------------------
  // Animal data — speeds (top sustained gallop, not absolute max) +
  // inline SVG silhouettes (no CDN, no emoji).
  // -------------------------------------------------------------
  var ANIMALS = [
    {
      id: 'cheetah', name: 'Cheetah', kmh: 110, color: '#e8a317',
      svg: '<svg viewBox="0 0 64 48" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M6 32c4-2 9-3 14-3s10 1 14 3l8-4 4 4-6 4c-2 4-8 7-15 7s-14-2-19-4l-6 4-2-4 8-7z" fill="currentColor"/>' +
        '<circle cx="48" cy="20" r="3" fill="currentColor"/>' +
        '<circle cx="49" cy="19" r="0.7" fill="#fff"/>' +
        '<circle cx="20" cy="30" r="1" fill="#1a1d29" opacity="0.5"/>' +
        '<circle cx="28" cy="28" r="1" fill="#1a1d29" opacity="0.5"/>' +
        '<circle cx="34" cy="30" r="1" fill="#1a1d29" opacity="0.5"/>' +
        '<circle cx="24" cy="34" r="1" fill="#1a1d29" opacity="0.5"/>' +
        '<circle cx="32" cy="34" r="1" fill="#1a1d29" opacity="0.5"/>' +
        '</svg>',
    },
    {
      id: 'horse', name: 'Horse', kmh: 88, color: '#7a4f2a',
      svg: '<svg viewBox="0 0 64 48" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M2 30c2-6 7-10 14-12 0-4 1-8 4-10 1 4 4 6 8 6 5 0 11 2 15 6l8-2 4 4-6 8c-2 4-7 7-14 7-2 0-3-1-4-2l-3 8h-5l2-10c-3-2-8-3-13-3H4l-2-2v0z" fill="currentColor"/>' +
        '<path d="M20 8c0-2 2-3 4-3l-1 4-3-1z" fill="currentColor"/>' +
        '<circle cx="22" cy="14" r="0.8" fill="#fff"/>' +
        '<path d="M14 36l-2 8h4l4-6-6-2zM40 36l-1 8h4l3-6-6-2z" fill="currentColor"/>' +
        '</svg>',
    },
    {
      id: 'lion', name: 'Lion', kmh: 80, color: '#c8923a',
      svg: '<svg viewBox="0 0 64 48" xmlns="http://www.w3.org/2000/svg">' +
        '<circle cx="32" cy="26" r="14" fill="currentColor" opacity="0.55"/>' +
        '<circle cx="32" cy="26" r="11" fill="currentColor"/>' +
        '<circle cx="32" cy="22" r="6" fill="currentColor"/>' +
        '<circle cx="29" cy="21" r="0.9" fill="#fff"/>' +
        '<circle cx="35" cy="21" r="0.9" fill="#fff"/>' +
        '<path d="M28 25c0 1 2 2 4 2s4-1 4-2" stroke="#1a1d29" stroke-width="1" fill="none" opacity="0.6"/>' +
        '<path d="M14 36l-2 8h5l3-7-6-1zM50 36l-2 8h5l3-7-6-1z" fill="currentColor"/>' +
        '</svg>',
    },
    {
      id: 'greyhound', name: 'Greyhound', kmh: 74, color: '#8c939a',
      svg: '<svg viewBox="0 0 64 48" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M2 30c4-4 10-6 16-6s11 2 15 5l10-3 8 3-8 6c-2 5-8 9-17 9H10l-8-3v-11z" fill="currentColor"/>' +
        '<path d="M48 18l-6-2 4-4 4 2-2 4z" fill="currentColor"/>' +
        '<circle cx="50" cy="22" r="0.8" fill="#fff"/>' +
        '<path d="M8 38l-2 8h4l4-6-6-2zM30 38l-1 8h4l3-6-6-2zM38 38l-1 8h4l3-6-6-2z" fill="currentColor"/>' +
        '</svg>',
    },
    {
      id: 'elk', name: 'Elk', kmh: 72, color: '#5a3f2a',
      svg: '<svg viewBox="0 0 64 48" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M30 14V4l-4-2 4-2 4 2-4 2v10z" fill="currentColor"/>' +
        '<path d="M30 4l-8-2-2 4 6 2 4-4zM30 4l8-2 2 4-6 2-4-4z" fill="currentColor"/>' +
        '<ellipse cx="32" cy="32" rx="20" ry="12" fill="currentColor"/>' +
        '<circle cx="26" cy="28" r="1" fill="#fff"/>' +
        '<circle cx="38" cy="28" r="1" fill="#fff"/>' +
        '<path d="M14 40l-3 6h5l4-5-6-1zM50 40l-3 6h5l4-5-6-1z" fill="currentColor"/>' +
        '</svg>',
    },
    {
      id: 'ostrich', name: 'Ostrich', kmh: 70, color: '#1f1f1f',
      svg: '<svg viewBox="0 0 64 48" xmlns="http://www.w3.org/2000/svg">' +
        '<ellipse cx="40" cy="36" rx="20" ry="8" fill="currentColor"/>' +
        '<path d="M28 28c-1 4-2 7-4 10h4l6-12-6 2z" fill="currentColor"/>' +
        '<circle cx="34" cy="14" r="6" fill="currentColor"/>' +
        '<circle cx="36" cy="13" r="0.8" fill="#fff"/>' +
        '<path d="M30 10l-6-2 4 6 4-2zM30 10l6 0v3h-4z" fill="currentColor"/>' +
        '<path d="M22 38l-3 8h4l3-6-4-2zM44 38l-2 8h4l3-6-5-2z" fill="currentColor"/>' +
        '</svg>',
    },
    {
      id: 'coyote', name: 'Coyote', kmh: 65, color: '#b8884a',
      svg: '<svg viewBox="0 0 64 48" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M2 30c4-5 10-8 17-8s12 2 17 6l8-2 6 4-8 8c-3 4-8 6-15 6-6 0-12-1-17-3l-6 4-3-4 1-11z" fill="currentColor"/>' +
        '<path d="M50 14l-6 4 2 4 6-4-2-4zM52 14l6-2v5l-4 1-2-4z" fill="currentColor"/>' +
        '<circle cx="48" cy="22" r="0.8" fill="#fff"/>' +
        '<path d="M10 38l-2 8h4l4-6-6-2zM30 38l-1 8h4l3-6-6-2z" fill="currentColor"/>' +
        '</svg>',
    },
    {
      id: 'rabbit', name: 'Rabbit', kmh: 56, color: '#c4a075',
      svg: '<svg viewBox="0 0 64 48" xmlns="http://www.w3.org/2000/svg">' +
        '<ellipse cx="22" cy="14" rx="4" ry="10" fill="currentColor"/>' +
        '<ellipse cx="34" cy="14" rx="4" ry="10" fill="currentColor"/>' +
        '<ellipse cx="22" cy="14" rx="2" ry="6" fill="#f3b8a0" opacity="0.6"/>' +
        '<ellipse cx="34" cy="14" rx="2" ry="6" fill="#f3b8a0" opacity="0.6"/>' +
        '<ellipse cx="32" cy="34" rx="18" ry="10" fill="currentColor"/>' +
        '<circle cx="26" cy="30" r="1" fill="#fff"/>' +
        '<circle cx="38" cy="30" r="1" fill="#fff"/>' +
        '<circle cx="26" cy="30" r="0.5" fill="#1a1d29"/>' +
        '<circle cx="38" cy="30" r="0.5" fill="#1a1d29"/>' +
        '<path d="M14 40l-2 6h4l2-4-4-2zM50 40l-2 6h4l2-4-4-2z" fill="currentColor"/>' +
        '</svg>',
    },
    {
      id: 'cat', name: 'Domestic Cat', kmh: 48, color: '#a88560',
      svg: '<svg viewBox="0 0 64 48" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M6 18l8 8 6-4 12 2 12-2 6 4 8-8-2 12-8 10H16l-8-10-2-12z" fill="currentColor"/>' +
        '<path d="M14 14l4 6-2 4-4-6zM50 14l-4 6 2 4 4-6z" fill="currentColor"/>' +
        '<circle cx="24" cy="28" r="0.9" fill="#4ade80"/>' +
        '<circle cx="40" cy="28" r="0.9" fill="#4ade80"/>' +
        '<circle cx="24" cy="28" r="0.3" fill="#1a1d29"/>' +
        '<circle cx="40" cy="28" r="0.3" fill="#1a1d29"/>' +
        '<path d="M30 32c0 1 1 2 2 2s2-1 2-2" stroke="#1a1d29" stroke-width="0.8" fill="none"/>' +
        '</svg>',
    },
    {
      id: 'human', name: 'Human', kmh: 24, color: '#3b82f6', isHuman: true,
      svg: '<svg viewBox="0 0 64 48" xmlns="http://www.w3.org/2000/svg">' +
        '<circle cx="32" cy="10" r="6" fill="currentColor"/>' +
        '<path d="M28 16l-8 14 6 2v14h4v-14h4v14h4v-14l6-2-8-14h-8z" fill="currentColor"/>' +
        '<path d="M28 16l-6 4 4-4zM36 16l6 4-4-4z" fill="currentColor"/>' +
        '</svg>',
    },
    {
      id: 'pig', name: 'Pig', kmh: 17, color: '#f4a8b8',
      svg: '<svg viewBox="0 0 64 48" xmlns="http://www.w3.org/2000/svg">' +
        '<ellipse cx="38" cy="30" rx="22" ry="13" fill="currentColor"/>' +
        '<ellipse cx="14" cy="30" rx="8" ry="6" fill="currentColor"/>' +
        '<ellipse cx="12" cy="30" rx="4" ry="3" fill="#1a1d29" opacity="0.4"/>' +
        '<circle cx="10" cy="29" r="0.6" fill="#fff"/>' +
        '<circle cx="14" cy="29" r="0.6" fill="#fff"/>' +
        '<path d="M48 24c2-2 4-2 6 0l-2 4-4-4z" fill="currentColor"/>' +
        '<circle cx="50" cy="22" r="0.7" fill="#fff"/>' +
        '<path d="M22 38l-3 8h5l3-7-5-1zM42 38l-2 8h5l3-7-6-1z" fill="currentColor"/>' +
        '</svg>',
    },
    {
      id: 'chicken', name: 'Chicken', kmh: 14, color: '#e6dbb8',
      svg: '<svg viewBox="0 0 64 48" xmlns="http://www.w3.org/2000/svg">' +
        '<ellipse cx="30" cy="32" rx="18" ry="11" fill="currentColor"/>' +
        '<path d="M30 32c-2-2-4-3-7-3l-2 4 7 1 2-2z" fill="currentColor"/>' +
        '<circle cx="48" cy="20" r="6" fill="currentColor"/>' +
        '<circle cx="50" cy="18" r="0.8" fill="#1a1d29"/>' +
        '<path d="M50 14l5-3 2 3-5 3z" fill="#dc2626"/>' +
        '<path d="M44 14l-2-4 4 2-2 2z" fill="#dc2626"/>' +
        '<path d="M20 40l-2 6h3l3-5-4-1zM36 40l-2 6h3l3-5-4-1z" fill="#f4b41a"/>' +
        '</svg>',
    },
    {
      id: 'sloth', name: 'Sloth', kmh: 0.24, color: '#7a8b5c',
      svg: '<svg viewBox="0 0 64 48" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M6 8c2 0 4 1 4 3v18c0 4 3 8 8 8h28c4 0 8-4 8-8v-3c0-2 2-4 4-4v4c-2 0-2 2-2 4 0 6-4 11-10 11H18c-7 0-12-4-12-10V11c0-2 0-3 0-3z" fill="currentColor"/>' +
        '<circle cx="22" cy="28" r="6" fill="currentColor"/>' +
        '<circle cx="20" cy="27" r="1" fill="#fff"/>' +
        '<circle cx="24" cy="27" r="1" fill="#fff"/>' +
        '<circle cx="20" cy="27" r="0.4" fill="#1a1d29"/>' +
        '<circle cx="24" cy="27" r="0.4" fill="#1a1d29"/>' +
        '<path d="M21 31c0 1 1 2 1 2s1-1 1-2" stroke="#1a1d29" stroke-width="0.6" fill="none"/>' +
        '<path d="M30 32l8 6-2 2-8-6zM50 32l-8 6 2 2 8-6z" fill="currentColor"/>' +
        '</svg>',
    },
    {
      id: 'snail', name: 'Snail', kmh: 0.05, color: '#a8c673',
      svg: '<svg viewBox="0 0 64 48" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M28 30c0 0 4-6 16-6 8 0 14 4 14 8s-4 6-10 6H14c-2 0-4-2-4-4s2-4 4-4h14z" fill="currentColor"/>' +
        '<circle cx="22" cy="28" r="11" fill="none" stroke="currentColor" stroke-width="3"/>' +
        '<circle cx="22" cy="28" r="11" fill="none" stroke="#fff" stroke-width="0.5" opacity="0.5"/>' +
        '<circle cx="22" cy="28" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
        '<circle cx="22" cy="28" r="2" fill="currentColor"/>' +
        '<path d="M48 26c2-4 4-6 6-6s2 2 0 4-4 2-6 2z" fill="currentColor"/>' +
        '<circle cx="50" cy="22" r="0.6" fill="#1a1d29"/>' +
        '<path d="M52 22l2-2 1 1-2 2z" fill="currentColor"/>' +
        '</svg>',
    },
  ];

  // -------------------------------------------------------------
  // State (mutable; handlers read/write via HT.animalRaceCore.getState())
  // -------------------------------------------------------------
  var state = {
    selected: {},
    racers: [],
    t0: null,
    rafId: null,
    running: false,
    finishElapsedS: 0,
    targetDurationS: DEFAULT_RACE_DURATION_S,
  };

  // -------------------------------------------------------------
  // Expose shared mutable state + data tables to handlers.js.
  // HT.animalRaceCore is INTERNAL (AD-14 internal handle).
  // -------------------------------------------------------------
  HT.animalRaceCore = Object.freeze({
    getAnimals: function () { return ANIMALS; },
    getState: function () { return state; },
    getConstants: function () {
      return {
        TRACK_LENGTH_M: TRACK_LENGTH_M,
        DEFAULT_RACE_DURATION_S: DEFAULT_RACE_DURATION_S,
        MIN_RACE_DURATION_S: MIN_RACE_DURATION_S,
        RACE_DURATION_OPTIONS: RACE_DURATION_OPTIONS,
        HUMAN_MAX_KMH: HUMAN_MAX_KMH,
        HUMAN_MIN_KMH: HUMAN_MIN_KMH,
      };
    },
  });

  // -------------------------------------------------------------
  // Boot — DOMContentLoaded → lazy-load animal-race-handlers.js → init()
  // -------------------------------------------------------------
  function boot() {
    if (typeof HT.lazyLoadTool !== 'function') return;
    HT.lazyLoadTool('animal-race', './animal-race-handlers.js').then(function () {
      if (typeof window.animalRaceInit === 'function') {
        try { window.animalRaceInit(); }
        catch (err) {
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('animal-race-core: animalRaceInit threw', err);
          }
        }
      }
    }).catch(function (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('animal-race-core: lazyLoadTool failed', err);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
