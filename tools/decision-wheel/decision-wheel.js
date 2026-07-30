/* ============================================
   Decision Wheel
   SVG wheel with N segments, spins with easing, lands on a random option.
   Persisted via HT.storage under key 'decision_wheel_v1'.
   ============================================ */

(function () {
  'use strict';

  var STORAGE = 'decision_wheel_v1';

  var DEFAULT_OPTIONS = ['Pizza', 'Tacos', 'Sushi', 'Burgers', 'Salad', 'Ramen'];

  var PALETTE = [
    '#4f46e5', '#16a34a', '#dc2626', '#d97706',
    '#0ea5e9', '#9333ea', '#0d9488', '#db2777',
    '#65a30d', '#ea580c', '#7c3aed', '#0891b2'
  ];

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function load() {
    var d = HT.storage.get(STORAGE, null);
    if (d && Array.isArray(d.options) && d.options.length > 0) return d;
    return { options: DEFAULT_OPTIONS.slice() };
  }

  function save(d) { HT.storage.set(STORAGE, d); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function drawWheel(options) {
    var svg = HT.$('#dw-wheel');
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var n = options.length;
    if (n === 0) return;
    var sweep = 360 / n;

    options.forEach(function (opt, i) {
      var start = -90 + i * sweep;
      var end = start + sweep;
      var startRad = (start * Math.PI) / 180;
      var endRad = (end * Math.PI) / 180;
      var r = 100;
      var x1 = r * Math.cos(startRad);
      var y1 = r * Math.sin(startRad);
      var x2 = r * Math.cos(endRad);
      var y2 = r * Math.sin(endRad);
      var large = sweep > 180 ? 1 : 0;
      var d = 'M 0 0 L ' + x1.toFixed(2) + ' ' + y1.toFixed(2) +
              ' A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' +
              x2.toFixed(2) + ' ' + y2.toFixed(2) + ' Z';

      var path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', PALETTE[i % PALETTE.length]);
      path.setAttribute('stroke', 'var(--color-surface)');
      path.setAttribute('stroke-width', '1.5');
      svg.appendChild(path);

      // Label
      var mid = (start + end) / 2;
      var midRad = (mid * Math.PI) / 180;
      var labelR = r * 0.62;
      var lx = labelR * Math.cos(midRad);
      var ly = labelR * Math.sin(midRad);
      var text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', lx.toFixed(2));
      text.setAttribute('y', ly.toFixed(2));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('class', 'wheel-label');
      text.setAttribute('transform', 'rotate(' + (mid + 90) + ' ' + lx.toFixed(2) + ' ' + ly.toFixed(2) + ')');
      text.setAttribute('font-size', n > 8 ? '9' : '11');
      text.textContent = opt.length > 14 ? opt.slice(0, 13) + '…' : opt;
      svg.appendChild(text);
    });

    // Center hub
    var hub = document.createElementNS(SVG_NS, 'circle');
    hub.setAttribute('cx', 0); hub.setAttribute('cy', 0); hub.setAttribute('r', 10);
    hub.setAttribute('fill', 'var(--color-surface)');
    hub.setAttribute('stroke', 'var(--color-border)');
    hub.setAttribute('stroke-width', '2');
    svg.appendChild(hub);
  }

  var currentRotation = 0;
  var spinning = false;

  function spin() {
    var data = load();
    if (data.options.length < 2) {
      HT.toast('Add at least 2 options first');
      return;
    }
    if (spinning) return;
    spinning = true;

    var n = data.options.length;
    var sweep = 360 / n;
    var idx = HT.randomInt(0, n - 1);

    // We want the chosen segment to land under the top pointer (at -90deg).
    // Segment i centers at angle (-90 + idx*sweep + sweep/2) on the wheel.
    // The current rotation is `currentRotation`. Final rotation: align segment
    // center to top. Add several full turns for a satisfying spin.
    var segmentCenter = -90 + idx * sweep + sweep / 2;
    var targetAngular = 90 - segmentCenter; // rotate wheel so that center sits at 0 (top)
    // Normalize target to be positive (forward) addition.
    var mod = ((targetAngular - currentRotation) % 360 + 360) % 360;
    var finalRot = currentRotation + mod + 360 * 6;

    var wheel = HT.$('#dw-wheel');
    wheel.style.transform = 'rotate(' + finalRot.toFixed(2) + 'deg)';
    currentRotation = finalRot;

    setTimeout(function () {
      spinning = false;
      var chosen = data.options[idx];
      var resultEl = HT.$('#dw-result');
      var resultCard = HT.$('#dw-result-card');
      resultEl.textContent = chosen;
      HT.$('#dw-result-sub').textContent = 'The wheel chose: ' + chosen;
      resultCard.classList.remove('bounce');
      // Force reflow so animation re-triggers
      void resultCard.offsetWidth;
      resultCard.classList.add('bounce');
      HT.toast('Result: ' + chosen);
    }, 4100);
  }

  function renderList() {
    var data = load();
    var listEl = HT.$('#dw-list');
    if (data.options.length === 0) {
      listEl.innerHTML = '<li class="empty muted">No options. Add some above.</li>';
      return;
    }
    var html = '';
    data.options.forEach(function (opt, i) {
      var color = PALETTE[i % PALETTE.length];
      html +=
        '<li class="dw-list-item">' +
          '<span class="swatch" style="background:' + color + ';"></span>' +
          '<span class="name">' + escapeHtml(opt) + '</span>' +
          '<button type="button" class="btn btn-sm btn-danger remove" data-idx="' + i + '">Remove</button>' +
        '</li>';
    });
    listEl.innerHTML = html;
    HT.qsa('.remove', listEl).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-idx'), 10);
        var d = load();
        d.options.splice(idx, 1);
        save(d);
        drawWheel(d.options);
        renderList();
        renderTextarea();
      });
    });
  }

  function renderTextarea() {
    var data = load();
    HT.$('#dw-input').value = data.options.join('\n');
  }

  function commitTextarea() {
    var raw = HT.$('#dw-input').value;
    var opts = raw.split('\n').map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });
    var unique = [];
    var seen = {};
    opts.forEach(function (o) {
      if (!seen[o.toLowerCase()]) {
        seen[o.toLowerCase()] = true;
        unique.push(o);
      }
    });
    if (unique.length === 0) {
      HT.toast('Add at least one option');
      return;
    }
    save({ options: unique });
    drawWheel(unique);
    renderList();
  }

  // ----- Wire up -----

  HT.$('#dw-add').addEventListener('click', function () {
    var input = HT.$('#dw-new');
    var val = input.value.trim();
    if (!val) { HT.toast('Type an option first'); return; }
    var d = load();
    d.options.push(val);
    save(d);
    input.value = '';
    drawWheel(d.options);
    renderList();
    renderTextarea();
  });

  HT.$('#dw-new').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      HT.$('#dw-add').click();
    }
  });

  HT.$('#dw-input').addEventListener('change', commitTextarea);

  HT.$('#dw-reset').addEventListener('click', function () {
    save({ options: DEFAULT_OPTIONS.slice() });
    drawWheel(DEFAULT_OPTIONS);
    renderList();
    renderTextarea();
    HT.toast('Reset to defaults');
  });

  HT.$('#dw-spin').addEventListener('click', spin);

  HT.$('#dw-clear').addEventListener('click', function () {
    HT.$('#dw-result').textContent = '—';
    HT.$('#dw-result-sub').textContent = 'Spin the wheel to see your choice.';
    HT.$('#dw-result-card').classList.remove('bounce');
  });

  // Initial render
  var init = load();
  drawWheel(init.options);
  renderList();
  renderTextarea();
})();