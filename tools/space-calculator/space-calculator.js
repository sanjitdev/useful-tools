/* ============================================
   Space Calculator — age, weight, jump, free-fall
   on every planet + Pluto + Earth's Moon.
   All data is editable in BODIES below.
   ============================================ */

(function () {
  'use strict';

  // -------------------------------------------------------------
  // Celestial body data
  // -------------------------------------------------------------
  // Earth orbital period = 365.25 days (1 year).
  // Surface gravity in m/s^2. Sidereal day in hours.
  // Sources: NASA fact sheets. Pluto values from New Horizons.
  // -------------------------------------------------------------
  var BODIES = [
    {
      key: 'mercury', name: 'Mercury', kind: 'Planet',
      color: '#a6a6a6', emoji: '☿',
      orbitDays: 87.969,        // orbital period (Earth days)
      surfaceG: 3.7,            // surface gravity (m/s^2)
      dayHours: 1407.5,         // sidereal day length
      radius: 0.383,            // Earth radii
    },
    {
      key: 'venus', name: 'Venus', kind: 'Planet',
      color: '#e8c170', emoji: '♀',
      orbitDays: 224.701,
      surfaceG: 8.87,
      dayHours: -5832.5,        // retrograde; negative = backwards
      radius: 0.949,
    },
    {
      key: 'earth', name: 'Earth', kind: 'Planet',
      color: '#4a90e2', emoji: '🌏',
      orbitDays: 365.256,
      surfaceG: 9.81,
      dayHours: 23.9345,
      radius: 1.000,
    },
    {
      key: 'moon', name: 'The Moon', kind: 'Moon',
      color: '#cfcfcf', emoji: '🌕',
      orbitDays: 27.322,        // around Earth, not the Sun
      surfaceG: 1.62,
      dayHours: 708.7,          // ~29.5 Earth days (synodic)
      radius: 0.273,
    },
    {
      key: 'mars', name: 'Mars', kind: 'Planet',
      color: '#cf5b3d', emoji: '♂',
      orbitDays: 686.971,
      surfaceG: 3.71,
      dayHours: 24.6229,
      radius: 0.532,
    },
    {
      key: 'jupiter', name: 'Jupiter', kind: 'Planet',
      color: '#d6a878', emoji: '♃',
      orbitDays: 4332.59,
      surfaceG: 24.79,
      dayHours: 9.925,          // very fast spin
      radius: 11.21,
    },
    {
      key: 'saturn', name: 'Saturn', kind: 'Planet',
      color: '#e0c878', emoji: '♄',
      orbitDays: 10759.22,
      surfaceG: 10.44,
      dayHours: 10.656,
      radius: 9.449,
    },
    {
      key: 'uranus', name: 'Uranus', kind: 'Planet',
      color: '#9be0e0', emoji: '♅',
      orbitDays: 30688.5,
      surfaceG: 8.69,
      dayHours: -17.24,         // retrograde
      radius: 4.007,
    },
    {
      key: 'neptune', name: 'Neptune', kind: 'Planet',
      color: '#4a7be0', emoji: '♆',
      orbitDays: 60182.0,
      surfaceG: 11.15,
      dayHours: 16.11,
      radius: 3.883,
    },
    {
      key: 'pluto', name: 'Pluto', kind: 'Dwarf planet',
      color: '#c8a890', emoji: '♇',
      orbitDays: 90560.0,
      surfaceG: 0.62,
      dayHours: -153.3,         // retrograde
      radius: 0.187,
    },
  ];

  // Helpers to look up bodies
  function bodyByKey(k) { return BODIES.filter(function (b) { return b.key === k; })[0]; }
  function earthBody() { return bodyByKey('earth'); }

  // -------------------------------------------------------------
  // Computation
  // -------------------------------------------------------------

  // Age on a planet: how many of that planet's years have you lived?
  // Input: Earth age in years (fractional).
  function ageOnPlanet(earthYears, body) {
    var earthOrbit = earthBody().orbitDays;
    var earthDays = earthYears * earthOrbit;
    return earthDays / body.orbitDays;
  }

  // Days until your next birthday on that planet.
  function nextBirthdayDays(earthYears, body) {
    var currentLocal = ageOnPlanet(earthYears, body);
    var nextLocal = Math.ceil(currentLocal + 1e-9);
    var fraction = nextLocal - currentLocal;
    if (fraction < 1e-9) fraction = 1; // exactly on a birthday
    return {
      days: fraction * body.orbitDays,
      years: fraction,
      nextAge: nextLocal,
    };
  }

  // Weight on a planet (ignoring centrifugal effects at poles/equator).
  function weightOn(earthMassKg, body) {
    return earthMassKg * (body.surfaceG / earthBody().surfaceG);
  }

  // Jump height on a planet vs Earth.
  // Model: assuming the same initial vertical velocity (your muscles), height
  // scales by (Earth g / body g). So you can jump higher in lower gravity.
  function jumpHeight(earthJumpM, body) {
    return earthJumpM * (earthBody().surfaceG / body.surfaceG);
  }

  // Distance fallen after t seconds (no atmosphere, g = surfaceG).
  function fallDistance(t, body) {
    return 0.5 * body.surfaceG * t * t;
  }

  // Time to fall a given distance (no atmosphere).
  function fallTime(dist, body) {
    if (body.surfaceG <= 0) return Infinity;
    return Math.sqrt((2 * dist) / body.surfaceG);
  }

  // -------------------------------------------------------------
  // Formatting
  // -------------------------------------------------------------
  function num(n, d) {
    if (d == null) d = 2;
    if (!isFinite(n)) return '∞';
    return HT.formatNumber(n, { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function fmtMass(kg) {
    if (kg >= 1) return num(kg, 2) + ' kg';
    return num(kg * 1000, 0) + ' g';
  }

  function fmtDist(m) {
    if (m >= 1000) return num(m / 1000, 2) + ' km';
    if (m >= 1) return num(m, 2) + ' m';
    return num(m * 100, 1) + ' cm';
  }

  function fmtDays(d) {
    if (!isFinite(d)) return '∞';
    if (d >= 365.25) return num(d / 365.25, 2) + ' Earth years';
    if (d >= 1) return num(d, 1) + ' Earth days';
    return num(d * 24, 1) + ' Earth hours';
  }

  // -------------------------------------------------------------
  // Render — Age tab
  // -------------------------------------------------------------
  function renderAge() {
    var dobVal = HT.$('#age-dob').value;
    var ageVal = HT.$('#age-years').value;
    var fallbackAge = parseFloat(ageVal);
    var earthYears;
    var source;

    if (dobVal) {
      var dob = new Date(dobVal);
      if (!isNaN(dob.getTime())) {
        var now = new Date();
        earthYears = (now - dob) / (1000 * 60 * 60 * 24 * 365.25);
        source = 'dob';
      }
    }
    if (!isFinite(earthYears) && isFinite(fallbackAge) && fallbackAge > 0) {
      earthYears = fallbackAge;
      source = 'years';
    }
    if (!isFinite(earthYears) || earthYears < 0) {
      // Show placeholder rows
      HT.$('#age-summary').textContent = 'Enter your date of birth or age to begin.';
      BODIES.forEach(function (b) {
        var y = HT.$('#age-' + b.key);
        var d = HT.$('#age-days-' + b.key);
        if (y) y.textContent = '—';
        if (d) d.textContent = '—';
      });
      return;
    }

    HT.$('#age-summary').textContent =
      'Your age on Earth: ' + num(earthYears, 2) + ' years ' +
      (source === 'dob' ? '(from ' + dobVal + ')' : '(entered directly)');

    BODIES.forEach(function (b) {
      var local = ageOnPlanet(earthYears, b);
      var next = nextBirthdayDays(earthYears, b);
      HT.$('#age-' + b.key).textContent = num(local, 2);
      HT.$('#age-days-' + b.key).textContent =
        num(next.years, 2) + ' (' + fmtDays(next.days) + ')';
    });
  }

  // -------------------------------------------------------------
  // Render — Weight tab
  // -------------------------------------------------------------
  function renderWeight() {
    var kg = parseFloat(HT.$('#weight-kg').value);
    if (!isFinite(kg) || kg <= 0) {
      HT.$('#weight-summary').textContent = 'Enter your mass in kg to see your weight across the solar system.';
      BODIES.forEach(function (b) {
        var w = HT.$('#weight-' + b.key);
        if (w) w.textContent = '—';
      });
      return;
    }
    var earthW = weightOn(kg, earthBody()); // == kg itself
    HT.$('#weight-summary').textContent =
      'Your mass: ' + fmtMass(kg) +
      ' · Equivalent Earth weight: ' + num(earthW, 2) + ' kgf';

    BODIES.forEach(function (b) {
      var w = weightOn(kg, b);
      HT.$('#weight-' + b.key).textContent = num(w, 2) + ' kg';
    });
  }

  // -------------------------------------------------------------
  // Render — Jump tab
  // -------------------------------------------------------------
  function renderJump() {
    var m = parseFloat(HT.$('#jump-m').value);
    if (!isFinite(m) || m <= 0) {
      HT.$('#jump-summary').textContent = 'Enter how high you can jump on Earth (typical adults: 0.3–0.6 m).';
      BODIES.forEach(function (b) {
        var j = HT.$('#jump-' + b.key);
        if (j) j.textContent = '—';
      });
      return;
    }
    HT.$('#jump-summary').textContent =
      'Your Earth jump: ' + num(m, 2) + ' m (assumes same initial velocity, no atmosphere)';

    BODIES.forEach(function (b) {
      var h = jumpHeight(m, b);
      HT.$('#jump-' + b.key).textContent = fmtDist(h);
    });
  }

  // -------------------------------------------------------------
  // Render — Free-fall tab
  // -------------------------------------------------------------
  function renderFall() {
    var useTime = HT.$('#fall-time').value;
    var useDist = HT.$('#fall-dist').value;
    var t = parseFloat(useTime);
    var d = parseFloat(useDist);

    BODIES.forEach(function (b) {
      var out = HT.$('#fall-' + b.key);
      if (!out) return;
      if (isFinite(t) && t > 0) {
        var dist = fallDistance(t, b);
        out.textContent = fmtDist(dist);
      } else if (isFinite(d) && d > 0) {
        var secs = fallTime(d, b);
        out.textContent = isFinite(secs) ? num(secs, 2) + ' s' : '∞';
      } else {
        out.textContent = '—';
      }
    });

    if (isFinite(t) && t > 0) {
      HT.$('#fall-summary').textContent =
        'Distance fallen in ' + num(t, 2) + ' s (no atmosphere)';
    } else if (isFinite(d) && d > 0) {
      HT.$('#fall-summary').textContent =
        'Time to fall ' + fmtDist(d) + ' (no atmosphere)';
    } else {
      HT.$('#fall-summary').textContent =
        'Enter either a time (seconds) or a distance (meters) — see the result on every body.';
    }
  }

  // -------------------------------------------------------------
  // Tab routing
  // -------------------------------------------------------------
  function renderAll() {
    renderAge();
    renderWeight();
    renderJump();
    renderFall();
  }

  // -------------------------------------------------------------
  // Build planet grids (one card per body, with results injected)
  // -------------------------------------------------------------
  function buildGrids() {
    var configs = [
      { gridId: 'age-grid',    valueLabel: 'Your age',     valueIdPrefix: 'age-',    secondaryLabel: 'Next birthday in', secondaryIdPrefix: 'age-days-' },
      { gridId: 'weight-grid', valueLabel: 'Your weight',  valueIdPrefix: 'weight-', secondaryLabel: null,               secondaryIdPrefix: null },
      { gridId: 'jump-grid',   valueLabel: 'Jump height',  valueIdPrefix: 'jump-',   secondaryLabel: null,               secondaryIdPrefix: null },
      { gridId: 'fall-grid',   valueLabel: 'Result',       valueIdPrefix: 'fall-',   secondaryLabel: null,               secondaryIdPrefix: null },
    ];

    configs.forEach(function (cfg) {
      var host = HT.$('#' + cfg.gridId);
      if (!host) return;
      host.innerHTML = '';
      BODIES.forEach(function (b) {
        var card = document.createElement('div');
        card.className = 'planet-card';
        card.style.setProperty('--planet-color', b.color);

        var html = '';
        if (b.key === 'earth') {
          html += '<span class="planet-tag">You are here</span>';
        }
        html += '<div class="planet-card-header">';
        html += '  <span class="planet-emoji">' + b.emoji + '</span>';
        html += '  <span class="planet-name">' + b.name + '</span>';
        html += '  <span class="planet-kind">' + b.kind + '</span>';
        html += '</div>';
        html += '<div class="planet-row">';
        html += '  <span class="planet-row-label">' + cfg.valueLabel + '</span>';
        html += '  <span class="planet-row-value" id="' + cfg.valueIdPrefix + b.key + '">—</span>';
        html += '</div>';
        if (cfg.secondaryIdPrefix) {
          html += '<div class="planet-row">';
          html += '  <span class="planet-row-label">' + cfg.secondaryLabel + '</span>';
          html += '  <span class="planet-row-value" id="' + cfg.secondaryIdPrefix + b.key + '">—</span>';
          html += '</div>';
        }
        card.innerHTML = html;
        host.appendChild(card);
      });
    });
  }

  // -------------------------------------------------------------
  // Init
  // -------------------------------------------------------------
  function init() {
    buildGrids();
    var handler = HT.debounce(renderAll, 60);
    HT.qsa('input').forEach(function (el) {
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });

    var tabs = HT.$('#mode-tabs');
    if (tabs && HT.makeTabs) HT.makeTabs(tabs);

    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
