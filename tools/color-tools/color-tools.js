/* ============================================
   Color Tools
   Pick / random color. Sync HEX, RGB, HSL, and a swatch.
   ============================================ */

(function () {
  'use strict';

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  function rgbToHex(r, g, b) {
    function h(n) {
      var s = clamp(Math.round(n), 0, 255).toString(16);
      return s.length === 1 ? '0' + s : s;
    }
    return '#' + h(r) + h(g) + h(b);
  }

  function hexToRgb(hex) {
    if (!hex) return null;
    var s = hex.trim().replace(/^#/, '');
    if (s.length === 3) {
      s = s.split('').map(function (c) { return c + c; }).join('');
    }
    if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
    return {
      r: parseInt(s.slice(0, 2), 16),
      g: parseInt(s.slice(2, 4), 16),
      b: parseInt(s.slice(4, 6), 16)
    };
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b);
    var min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360;
    s = clamp(s, 0, 100) / 100;
    l = clamp(l, 0, 100) / 100;
    var r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      var hue2rgb = function (p, q, t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      var p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  }

  var picker = HT.$('#c-picker');
  var hexInput = HT.$('#c-hex');
  var rInput = HT.$('#c-r');
  var gInput = HT.$('#c-g');
  var bInput = HT.$('#c-b');
  var hInput = HT.$('#c-h');
  var sInput = HT.$('#c-s');
  var lInput = HT.$('#c-l');
  var swatch = HT.$('#c-swatch');
  var rgbStr = HT.$('#c-rgb-str');
  var hslStr = HT.$('#c-hsl-str');

  var currentRgb = { r: 79, g: 70, b: 229 };

  function updateSwatch() {
    swatch.style.background = rgbToHex(currentRgb.r, currentRgb.g, currentRgb.b);
    rgbStr.textContent = 'rgb(' + currentRgb.r + ', ' + currentRgb.g + ', ' + currentRgb.b + ')';
    var hsl = rgbToHsl(currentRgb.r, currentRgb.g, currentRgb.b);
    hslStr.textContent = 'hsl(' + hsl.h + ', ' + hsl.s + '%, ' + hsl.l + '%)';
  }

  function setFromHex(hex, fromUser) {
    var rgb = hexToRgb(hex);
    if (!rgb) return;
    currentRgb = rgb;
    if (fromUser !== 'picker') picker.value = rgbToHex(rgb.r, rgb.g, rgb.b);
    if (fromUser !== 'hex') hexInput.value = rgbToHex(rgb.r, rgb.g, rgb.b);
    if (fromUser !== 'rgb') {
      rInput.value = rgb.r; gInput.value = rgb.g; bInput.value = rgb.b;
    }
    if (fromUser !== 'hsl') {
      var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      hInput.value = hsl.h; sInput.value = hsl.s; lInput.value = hsl.l;
    }
    updateSwatch();
  }

  function setFromRgb(r, g, b, fromUser) {
    r = clamp(parseInt(r, 10) || 0, 0, 255);
    g = clamp(parseInt(g, 10) || 0, 0, 255);
    b = clamp(parseInt(b, 10) || 0, 0, 255);
    currentRgb = { r: r, g: g, b: b };
    var hex = rgbToHex(r, g, b);
    picker.value = hex;
    hexInput.value = hex;
    if (fromUser !== 'hsl') {
      var hsl = rgbToHsl(r, g, b);
      hInput.value = hsl.h; sInput.value = hsl.s; lInput.value = hsl.l;
    }
    updateSwatch();
  }

  function setFromHsl(h, s, l, fromUser) {
    h = clamp(parseInt(h, 10) || 0, 0, 360);
    s = clamp(parseInt(s, 10) || 0, 0, 100);
    l = clamp(parseInt(l, 10) || 0, 0, 100);
    var rgb = hslToRgb(h, s, l);
    currentRgb = rgb;
    var hex = rgbToHex(rgb.r, rgb.g, rgb.b);
    picker.value = hex;
    hexInput.value = hex;
    if (fromUser !== 'rgb') {
      rInput.value = rgb.r; gInput.value = rgb.g; bInput.value = rgb.b;
    }
    updateSwatch();
  }

  function setFromPicker() {
    setFromHex(picker.value, 'picker');
  }

  picker.addEventListener('input', setFromPicker);

  var hexHandler = HT.debounce(function () { setFromHex(hexInput.value, 'hex'); }, 80);
  hexInput.addEventListener('input', hexHandler);
  hexInput.addEventListener('blur', function () {
    var v = hexInput.value;
    if (!/^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(v)) {
      hexInput.value = rgbToHex(currentRgb.r, currentRgb.g, currentRgb.b);
    } else if (!v.startsWith('#')) {
      hexInput.value = '#' + v;
    }
  });

  var rgbHandler = HT.debounce(function () {
    setFromRgb(rInput.value, gInput.value, bInput.value, 'rgb');
  }, 50);
  [rInput, gInput, bInput].forEach(function (el) {
    el.addEventListener('input', rgbHandler);
    el.addEventListener('blur', function () {
      var v = clamp(parseInt(el.value, 10) || 0, 0, 255);
      el.value = v;
    });
  });

  var hslHandler = HT.debounce(function () {
    setFromHsl(hInput.value, sInput.value, lInput.value, 'hsl');
  }, 50);
  [hInput, sInput, lInput].forEach(function (el) {
    el.addEventListener('input', hslHandler);
  });

  HT.$('#c-random').addEventListener('click', function () {
    var r = HT.randomInt(0, 255);
    var g = HT.randomInt(0, 255);
    var b = HT.randomInt(0, 255);
    setFromRgb(r, g, b);
  });

  HT.$('#c-copy-hex').addEventListener('click', function () {
    HT.copyToClipboard(hexInput.value);
  });
  HT.$('#c-copy-rgb').addEventListener('click', function () {
    HT.copyToClipboard(rgbStr.textContent);
  });
  HT.$('#c-copy-hsl').addEventListener('click', function () {
    HT.copyToClipboard(hslStr.textContent);
  });

  // Default
  setFromHex('#4f46e5');
})();