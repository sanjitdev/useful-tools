/* ============================================
   Unit Converter
   Categories: length, mass, temperature, volume, time, data
   Each category uses a base unit; conversion is two-step.
   ============================================ */

(function () {
  'use strict';

  // Base unit for each category; conversion factor = (value in base) per (1 unit).
  var UNITS = {
    length: {
      label: 'Length',
      base: 'm',
      list: [
        { k: 'mm', n: 'Millimeter (mm)', toBase: 0.001 },
        { k: 'cm', n: 'Centimeter (cm)', toBase: 0.01 },
        { k: 'm',  n: 'Meter (m)',       toBase: 1 },
        { k: 'km', n: 'Kilometer (km)',  toBase: 1000 },
        { k: 'in', n: 'Inch (in)',       toBase: 0.0254 },
        { k: 'ft', n: 'Foot (ft)',       toBase: 0.3048 },
        { k: 'yd', n: 'Yard (yd)',       toBase: 0.9144 },
        { k: 'mi', n: 'Mile (mi)',       toBase: 1609.344 }
      ]
    },
    mass: {
      label: 'Mass',
      base: 'kg',
      list: [
        { k: 'mg', n: 'Milligram (mg)', toBase: 0.000001 },
        { k: 'g',  n: 'Gram (g)',       toBase: 0.001 },
        { k: 'kg', n: 'Kilogram (kg)',  toBase: 1 },
        { k: 'oz', n: 'Ounce (oz)',     toBase: 0.0283495231 },
        { k: 'lb', n: 'Pound (lb)',     toBase: 0.45359237 }
      ]
    },
    temperature: {
      label: 'Temperature',
      base: 'K',
      list: [
        { k: 'C', n: 'Celsius (°C)' },
        { k: 'F', n: 'Fahrenheit (°F)' },
        { k: 'K', n: 'Kelvin (K)' }
      ]
    },
    volume: {
      label: 'Volume',
      base: 'l',
      list: [
        { k: 'ml',  n: 'Milliliter (ml)', toBase: 0.001 },
        { k: 'l',   n: 'Liter (l)',       toBase: 1 },
        { k: 'cup', n: 'Cup (US)',        toBase: 0.2365882365 },
        { k: 'pt',  n: 'Pint (US)',       toBase: 0.473176473 },
        { k: 'qt',  n: 'Quart (US)',      toBase: 0.946352946 },
        { k: 'gal', n: 'Gallon (US)',     toBase: 3.785411784 }
      ]
    },
    time: {
      label: 'Time',
      base: 's',
      list: [
        { k: 'ms',   n: 'Millisecond (ms)', toBase: 0.001 },
        { k: 's',    n: 'Second (s)',       toBase: 1 },
        { k: 'min',  n: 'Minute (min)',     toBase: 60 },
        { k: 'hr',   n: 'Hour (hr)',        toBase: 3600 },
        { k: 'day',  n: 'Day',              toBase: 86400 },
        { k: 'week', n: 'Week',             toBase: 604800 }
      ]
    },
    data: {
      label: 'Data',
      base: 'B',
      list: [
        { k: 'B',   n: 'Byte (B)',            toBase: 1 },
        { k: 'KB',  n: 'Kilobyte (KB, 10^3)', toBase: 1000 },
        { k: 'MB',  n: 'Megabyte (MB, 10^6)', toBase: 1000000 },
        { k: 'GB',  n: 'Gigabyte (GB, 10^9)', toBase: 1000000000 },
        { k: 'TB',  n: 'Terabyte (TB, 10^12)', toBase: 1000000000000 },
        { k: 'KiB', n: 'Kibibyte (KiB, 2^10)', toBase: 1024 },
        { k: 'MiB', n: 'Mebibyte (MiB, 2^20)', toBase: 1048576 },
        { k: 'GiB', n: 'Gibibyte (GiB, 2^30)', toBase: 1073741824 },
        { k: 'TiB', n: 'Tebibyte (TiB, 2^40)', toBase: 1099511627776 }
      ]
    }
  };

  function fillSelect(sel, list) {
    sel.innerHTML = '';
    list.forEach(function (u) {
      var opt = document.createElement('option');
      opt.value = u.k;
      opt.textContent = u.n;
      sel.appendChild(opt);
    });
  }

  function setupCategory(cat, prefix) {
    var data = UNITS[cat];
    var from = HT.$('#' + prefix + '-from');
    var to = HT.$('#' + prefix + '-to');
    var input = HT.$('#' + prefix + '-input');
    var result = HT.$('#' + prefix + '-result');
    var sub = HT.$('#' + prefix + '-sub');

    fillSelect(from, data.list);
    fillSelect(to, data.list);

    // Sensible defaults
    from.value = data.list[0].k;
    to.value = data.list[1] ? data.list[1].k : data.list[0].k;
    input.value = 1;

    function convert(v, fromKey, toKey) {
      if (cat === 'temperature') {
        return convertTemperature(v, fromKey, toKey);
      }
      var fromU = data.list.find(function (u) { return u.k === fromKey; });
      var toU = data.list.find(function (u) { return u.k === toKey; });
      if (!fromU || !toU) return NaN;
      var inBase = v * fromU.toBase;
      return inBase / toU.toBase;
    }

    function update() {
      var v = parseFloat(input.value);
      if (!isFinite(v)) {
        result.textContent = '—';
        sub.textContent = 'Enter a number.';
        return;
      }
      var out = convert(v, from.value, to.value);
      var fromU = data.list.find(function (u) { return u.k === from.value; });
      var toU = data.list.find(function (u) { return u.k === to.value; });
      result.textContent = HT.formatNumber(v, { minFractionDigits: 0, maxFractionDigits: 6 }) +
        ' ' + fromU.k + ' = ' + HT.formatNumber(out, { minFractionDigits: 0, maxFractionDigits: 6 }) +
        ' ' + toU.k;
      sub.textContent = 'Base unit: ' + data.base;
    }

    var h = HT.debounce(update, 60);
    input.addEventListener('input', h);
    from.addEventListener('change', update);
    to.addEventListener('change', update);
    update();
  }

  function convertTemperature(v, fromKey, toKey) {
    // Convert v -> Kelvin
    var k;
    if (fromKey === 'C') k = v + 273.15;
    else if (fromKey === 'F') k = (v - 32) * 5 / 9 + 273.15;
    else k = v;
    // Kelvin -> target
    if (toKey === 'C') return k - 273.15;
    else if (toKey === 'F') return (k - 273.15) * 9 / 5 + 32;
    else return k;
  }

  setupCategory('length', 'l');
  setupCategory('mass', 'm');
  setupCategory('temperature', 't');
  setupCategory('volume', 'v');
  setupCategory('time', 'ti');
  setupCategory('data', 'd');

  HT.makeTabs(HT.$('#cat-tabs'));
})();