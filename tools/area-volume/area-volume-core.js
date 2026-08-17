/* ============================================
   Area & Volume Calculator — pure math + URL state.
   Story 9.12 — frozen HT.areaVolumeCore export.
   ============================================ */

'use strict';

(function () {
  // Unit conversion factors (against the imperial base ft²/ft³)
  var SQFT_PER_M2 = 10.7639104167;
  var CUFT_PER_M3 = 35.3146667215;

  // Default inputs per shape (so the tool always boots with valid numbers).
  var DEFAULTS = {
    'rectangle': { w: 12, h: 10, unit: 'ft' },
    'triangle':  { b: 10, h: 8,  unit: 'ft' },
    'circle':    { r: 5,  unit: 'ft' },
    'l-shape':   { r1w: 10, r1h: 8, r2w: 6, r2h: 4, unit: 'ft' },
    'box-3d':    { w: 6, h: 4, d: 3, unit: 'ft' },
    'cylinder-3d': { r: 2, h: 5, unit: 'ft' }
  };

  var SHAPE_PARAMS = {
    'rectangle': ['w', 'h', 'unit'],
    'triangle':  ['b', 'h', 'unit'],
    'circle':    ['r', 'unit'],
    'l-shape':   ['r1w', 'r1h', 'r2w', 'r2h', 'unit'],
    'box-3d':    ['w', 'h', 'd', 'unit'],
    'cylinder-3d': ['r', 'h', 'unit']
  };

  var SAMPLE = {
    'rectangle':   { w: 12, h: 10, unit: 'ft' },
    'triangle':    { b: 10, h: 8,  unit: 'ft' },
    'circle':      { r: 5,  unit: 'ft' },
    'l-shape':     { r1w: 10, r1h: 8, r2w: 6, r2h: 4, unit: 'ft' },
    'box-3d':      { w: 6, h: 4, d: 3, unit: 'ft' },
    'cylinder-3d': { r: 2, h: 5, unit: 'ft' }
  };

  function computeShape(shape, params) {
    shape = shape || 'rectangle';
    params = params || {};
    var result = { shape: shape, is3d: false, value: 0, label: '' };
    switch (shape) {
      case 'rectangle':
        var w = num(params.w);
        var h = num(params.h);
        result.value = w * h;
        result.label = areaLabel(w, '×', h, '= ', result.value);
        break;
      case 'triangle':
        var b = num(params.b);
        var th = num(params.h);
        result.value = 0.5 * b * th;
        result.label = areaLabel(b, '×', th, '× 0.5 = ', result.value);
        break;
      case 'circle':
        var r = num(params.r);
        result.value = Math.PI * r * r;
        result.label = 'π × ' + r + '² = ' + fmt(result.value);
        break;
      case 'l-shape':
        var r1w = num(params.r1w);
        var r1h = num(params.r1h);
        var r2w = num(params.r2w);
        var r2h = num(params.r2h);
        result.value = (r1w * r1h) + (r2w * r2h);
        result.label = '(' + r1w + '×' + r1h + ') + (' + r2w + '×' + r2h + ') = ' + fmt(result.value);
        break;
      case 'box-3d':
        var bw = num(params.w);
        var bh = num(params.h);
        var bd = num(params.d);
        result.is3d = true;
        result.value = bw * bh * bd;
        result.label = volumeLabel(bw, bh, bd, result.value);
        break;
      case 'cylinder-3d':
        var cr = num(params.r);
        var ch = num(params.h);
        result.is3d = true;
        result.value = Math.PI * cr * cr * ch;
        result.label = 'π × ' + cr + '² × ' + ch + ' = ' + fmt(result.value);
        break;
      default:
        result.value = 0;
        result.label = 'Pick a shape';
    }
    return result;
  }

  function areaLabel(a, op, b, eq, value) {
    return a + ' ' + op + ' ' + b + ' ' + eq + fmt(value);
  }
  function volumeLabel(w, h, d, value) {
    return w + ' × ' + h + ' × ' + d + ' = ' + fmt(value);
  }

  function fmt(n) {
    if (!isFinite(n)) return '0';
    if (Math.abs(n) >= 100) return n.toFixed(2);
    return n.toFixed(4).replace(/\.?0+$/, '');
  }

  function num(v) {
    var n = parseFloat(v);
    return isFinite(n) && n > 0 ? n : 0;
  }

  function convertUnits(value, fromUnit, toUnit) {
    if (fromUnit === toUnit) return value;
    if (fromUnit === 'm2' && toUnit === 'ft2') return value * SQFT_PER_M2;
    if (fromUnit === 'ft2' && toUnit === 'm2') return value / SQFT_PER_M2;
    if (fromUnit === 'm3' && toUnit === 'ft3') return value * CUFT_PER_M3;
    if (fromUnit === 'ft3' && toUnit === 'm3') return value / CUFT_PER_M3;
    return value;
  }

  function encodeState(shape, params) {
    shape = shape || 'rectangle';
    params = params || {};
    var sp = SHAPE_PARAMS[shape] || [];
    var qs = ['shape=' + encodeURIComponent(shape)];
    for (var i = 0; i < sp.length; i += 1) {
      var key = sp[i];
      if (params[key] != null) {
        qs.push(key + '=' + encodeURIComponent(String(params[key])));
      }
    }
    return qs.join('&');
  }

  function decodeState(search) {
    var out = {};
    if (!search) return out;
    var s = search.charAt(0) === '?' ? search.slice(1) : search;
    if (!s) return out;
    var pairs = s.split('&');
    for (var i = 0; i < pairs.length; i += 1) {
      var kv = pairs[i].split('=');
      if (kv.length === 2) {
        out[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
      }
    }
    return out;
  }

  function resolveState(decoded) {
    var shape = (decoded && decoded.shape) || 'rectangle';
    if (!SHAPE_PARAMS[shape]) shape = 'rectangle';
    var params = {};
    var sp = SHAPE_PARAMS[shape];
    var defaults = DEFAULTS[shape];
    for (var i = 0; i < sp.length; i += 1) {
      var key = sp[i];
      if (decoded && decoded[key] != null) params[key] = decoded[key];
      else params[key] = defaults[key];
    }
    return { shape: shape, params: params };
  }

  var core = {
    DEFAULTS: DEFAULTS,
    SHAPE_PARAMS: SHAPE_PARAMS,
    SAMPLE: SAMPLE,
    computeShape: computeShape,
    convertUnits: convertUnits,
    encodeState: encodeState,
    decodeState: decodeState,
    resolveState: resolveState,
    fmt: fmt
  };

  if (typeof window !== 'undefined') {
    window.HT = window.HT || {};
    Object.freeze(core);
    window.HT.areaVolumeCore = core;
  }
})();