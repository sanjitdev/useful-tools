/* ============================================
   Area & Volume Calculator — DOM wiring.
   Story 9.12 — handlers + URL state.
   ============================================ */

'use strict';

(function () {
  if (typeof window === 'undefined') return;
  var core = (window.HT && window.HT.areaVolumeCore) || null;
  if (!core) return;

  var state = {
    shape: 'rectangle',
    params: JSON.parse(JSON.stringify(core.DEFAULTS.rectangle)),
    unit: 'ft'
  };

  function $(sel) {
    return (window.HT && window.HT.$) ? window.HT.$(sel) : document.querySelector(sel);
  }

  function readShapeInputs() {
    var sp = core.SHAPE_PARAMS[state.shape];
    for (var i = 0; i < sp.length; i += 1) {
      var key = sp[i];
      if (key === 'unit') continue;
      var el = document.querySelector('[data-av-key="' + key + '"]');
      if (el && el.value !== '') {
        state.params[key] = el.value;
      } else if (state.params[key] == null) {
        state.params[key] = core.DEFAULTS[state.shape][key];
      }
    }
  }

  function readUnit() {
    var radios = document.querySelectorAll('[data-av-unit]');
    for (var i = 0; i < radios.length; i += 1) {
      if (radios[i].checked) {
        state.params.unit = radios[i].getAttribute('data-av-unit');
        return;
      }
    }
  }

  function toggleShapeInputs() {
    var groups = document.querySelectorAll('[data-av-shape-group]');
    for (var i = 0; i < groups.length; i += 1) {
      var name = groups[i].getAttribute('data-av-shape-group');
      groups[i].hidden = (name !== state.shape);
    }
  }

  function render() {
    var result = core.computeShape(state.shape, state.params);
    var is3d = result.is3d;
    var fromUnit = is3d ? (state.params.unit === 'm' ? 'm3' : 'ft3') : (state.params.unit === 'm' ? 'm2' : 'ft2');
    var toUnit = fromUnit;
    var displayed = core.convertUnits(result.value, fromUnit, toUnit);
    var unitLabel = is3d ? (state.params.unit === 'm' ? 'm³' : 'ft³') : (state.params.unit === 'm' ? 'm²' : 'ft²');
    var otherLabel = is3d ? (state.params.unit === 'm' ? 'ft³' : 'm³') : (state.params.unit === 'm' ? 'ft²' : 'm²');
    var otherValue = core.convertUnits(result.value, fromUnit, fromUnit === (state.params.unit === 'm' ? 'm3' : 'ft3') ? (state.params.unit === 'm' ? 'ft3' : 'm3') : fromUnit);

    var html = '<div class="av-result-primary">';
    html += '<div class="av-result-label">' + (is3d ? 'Volume' : 'Area') + '</div>';
    html += '<div class="av-result-value">' + core.fmt(displayed) + ' <span class="av-unit">' + unitLabel + '</span></div>';
    html += '<div class="av-result-note">Formula: ' + result.label + '</div>';
    html += '<div class="av-result-alternate">≈ ' + core.fmt(otherValue) + ' ' + otherLabel + '</div>';
    html += '</div>';

    var out = document.querySelector('#av-result');
    if (out) out.innerHTML = html;
  }

  function writeUrlState() {
    if (!window.history || !window.history.replaceState) return;
    var qs = core.encodeState(state.shape, state.params);
    var url = (window.location.pathname || '') + '?' + qs;
    try {
      window.history.replaceState(null, '', url);
    } catch (e) { /* ignore */ }
  }

  function readUrlState() {
    var decoded = core.decodeState(window.location.search || '');
    var resolved = core.resolveState(decoded);
    state.shape = resolved.shape;
    state.params = resolved.params;
    state.unit = resolved.params.unit || 'ft';
  }

  function applyDomToState() {
    var shapeRadios = document.querySelectorAll('[data-av-shape]');
    for (var i = 0; i < shapeRadios.length; i += 1) {
      if (shapeRadios[i].getAttribute('data-av-shape') === state.shape) {
        shapeRadios[i].checked = true;
      }
    }
    var sp = core.SHAPE_PARAMS[state.shape];
    for (var j = 0; j < sp.length; j += 1) {
      var key = sp[j];
      if (key === 'unit') continue;
      var el = document.querySelector('[data-av-key="' + key + '"]');
      if (el) el.value = state.params[key];
    }
    var unitRadios = document.querySelectorAll('[data-av-unit]');
    for (var k = 0; k < unitRadios.length; k += 1) {
      var u = unitRadios[k].getAttribute('data-av-unit');
      unitRadios[k].checked = (u === state.params.unit);
    }
  }

  function onShapeChange(evt) {
    var t = evt.currentTarget || evt.target;
    if (!t || !t.getAttribute) return;
    var shape = t.getAttribute('data-av-shape');
    if (!shape || !core.SHAPE_PARAMS[shape]) return;
    state.shape = shape;
    var newParams = core.DEFAULTS[shape];
    state.params = JSON.parse(JSON.stringify(newParams));
    state.unit = newParams.unit;
    applyDomToState();
    toggleShapeInputs();
    render();
    writeUrlState();
  }

  function onInputChange() {
    readShapeInputs();
    readUnit();
    render();
    writeUrlState();
  }

  function onSampleClick() {
    var s = core.SAMPLE[state.shape];
    if (s) {
      state.params = JSON.parse(JSON.stringify(s));
      state.unit = s.unit;
      applyDomToState();
      toggleShapeInputs();
      render();
      writeUrlState();
    }
  }

  function onResetClick() {
    state.shape = 'rectangle';
    state.params = JSON.parse(JSON.stringify(core.DEFAULTS.rectangle));
    state.unit = 'ft';
    applyDomToState();
    toggleShapeInputs();
    render();
    writeUrlState();
  }

  function onPrintClick() {
    if (typeof window.print === 'function') window.print();
  }

  function onShareClick() {
    if (!navigator.clipboard || !navigator.clipboard.writeText) return;
    if (window.HT && window.HT.toast) window.HT.toast('Copied share URL');
    var url = window.location.href;
    navigator.clipboard.writeText(url).catch(function () {});
  }

  function wireEvents() {
    var shapeRadios = document.querySelectorAll('[data-av-shape]');
    for (var i = 0; i < shapeRadios.length; i += 1) {
      shapeRadios[i].addEventListener('change', onShapeChange);
    }
    var inputs = document.querySelectorAll('[data-av-key]');
    for (var j = 0; j < inputs.length; j += 1) {
      inputs[j].addEventListener('input', onInputChange);
    }
    var unitRadios = document.querySelectorAll('[data-av-unit]');
    for (var k = 0; k < unitRadios.length; k += 1) {
      unitRadios[k].addEventListener('change', onInputChange);
    }
    var btns = document.querySelectorAll('[data-action]');
    for (var b = 0; b < btns.length; b += 1) {
      var act = btns[b].getAttribute('data-action');
      if (act === 'sample') btns[b].addEventListener('click', onSampleClick);
      else if (act === 'reset') btns[b].addEventListener('click', onResetClick);
      else if (act === 'print') btns[b].addEventListener('click', onPrintClick);
      else if (act === 'share') btns[b].addEventListener('click', onShareClick);
    }
  }

  function init() {
    readUrlState();
    applyDomToState();
    toggleShapeInputs();
    wireEvents();
    render();
    writeUrlState();
  }

  if (typeof window !== 'undefined') {
    window.paintCalculator = window.paintCalculator || {};
    window.paintCalculator.areaVolumeInit = init;
    window.areaVolumeInit = init;
  }
})();

if (typeof window !== 'undefined') {
  window.areaVolumeInit = window.areaVolumeInit || function () {};
  window.areaVolumeInit();
}
