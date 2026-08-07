/* ============================================
   Pros & Cons
   Two-column weighted list with score + verdict.
   Persisted via HT.storage under key 'pros_cons_v1'.
   ============================================ */

(function () {
  'use strict';

  var STORAGE = 'handy-tools.pros-cons.state';

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function load() {
    var d = HT.storage.get(STORAGE, null);
    if (d && (Array.isArray(d.pros) || Array.isArray(d.cons))) return d;
    return { question: '', pros: [], cons: [] };
  }

  function save(d) { HT.storage.set(STORAGE, d); }

  function makeItem(side, item) {
    var li = document.createElement('li');
    li.className = 'pc-item';
    li.setAttribute('data-id', item.id);

    var text = document.createElement('div');
    text.className = 'text';
    text.textContent = item.text;
    li.appendChild(text);

    var wrap = document.createElement('div');
    wrap.className = 'weight-wrap';

    var slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '1';
    slider.max = '10';
    slider.step = '1';
    slider.value = String(item.weight);
    slider.setAttribute('aria-label', 'Weight');
    wrap.appendChild(slider);

    var val = document.createElement('div');
    val.className = 'weight-val';
    val.textContent = String(item.weight);
    wrap.appendChild(val);

    li.appendChild(wrap);

    var remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn btn-sm btn-danger';
    remove.textContent = 'Remove';
    remove.addEventListener('click', function () {
      var d = load();
      d[side] = d[side].filter(function (x) { return x.id !== item.id; });
      save(d);
      renderAll();
    });
    li.appendChild(remove);

    slider.addEventListener('input', function () {
      item.weight = parseInt(slider.value, 10);
      val.textContent = String(item.weight);
      var d = load();
      var found = d[side].find(function (x) { return x.id === item.id; });
      if (found) found.weight = item.weight;
      save(d);
      updateScore();
    });

    return li;
  }

  function computeScore(d) {
    var proSum = d.pros.reduce(function (s, x) { return s + (x.weight || 0); }, 0);
    var conSum = d.cons.reduce(function (s, x) { return s + (x.weight || 0); }, 0);
    return { proSum: proSum, conSum: conSum, net: proSum - conSum };
  }

  function verdict(net, proSum, conSum) {
    if (proSum === 0 && conSum === 0) return { text: 'Toss-up', cls: '' };
    var denom = proSum + conSum;
    if (denom === 0) return { text: 'Toss-up', cls: '' };
    var ratio = net / denom;
    if (ratio >= 0.6) return { text: 'Strong yes', cls: 'is-positive' };
    if (ratio >= 0.2) return { text: 'Lean yes', cls: 'is-positive' };
    if (ratio > -0.2) return { text: 'Toss-up', cls: '' };
    if (ratio > -0.6) return { text: 'Lean no', cls: 'is-negative' };
    return { text: 'Strong no', cls: 'is-negative' };
  }

  function updateScore() {
    var d = load();
    var s = computeScore(d);
    var v = verdict(s.net, s.proSum, s.conSum);
    HT.$('#pc-pros-score').textContent = s.proSum;
    HT.$('#pc-cons-score').textContent = s.conSum;
    var netEl = HT.$('#pc-net');
    netEl.textContent = (s.net > 0 ? '+' : '') + s.net;
    netEl.style.color = s.net > 0 ? 'var(--color-success)' :
      s.net < 0 ? 'var(--color-danger)' : 'var(--color-text)';
    var vEl = HT.$('#pc-verdict');
    vEl.textContent = v.text;
    vEl.className = 'score-value score-verdict ' + v.cls;
  }

  function renderAll() {
    var d = load();
    HT.$('#pc-question').value = d.question || '';

    var proList = HT.$('#pc-pro-list');
    var conList = HT.$('#pc-con-list');
    proList.innerHTML = '';
    conList.innerHTML = '';

    if (d.pros.length === 0) {
      proList.innerHTML = '<li class="muted text-sm" style="padding:8px 0;">No pros yet.</li>';
    } else {
      d.pros.forEach(function (item) { proList.appendChild(makeItem('pros', item)); });
    }

    if (d.cons.length === 0) {
      conList.innerHTML = '<li class="muted text-sm" style="padding:8px 0;">No cons yet.</li>';
    } else {
      d.cons.forEach(function (item) { conList.appendChild(makeItem('cons', item)); });
    }

    updateScore();
  }

  function addItem(side) {
    var inputId = side === 'pros' ? '#pc-pro-input' : '#pc-con-input';
    var input = HT.$(inputId);
    var text = input.value.trim();
    if (!text) { HT.toast('Type an item first'); return; }
    var d = load();
    d[side].push({ id: HT.uid(), text: text, weight: 5 });
    save(d);
    input.value = '';
    renderAll();
    input.focus();
  }

  // ----- Wire up -----

  HT.$('#pc-question').addEventListener('input', function () {
    var d = load();
    d.question = HT.$('#pc-question').value;
    save(d);
  });

  HT.$('#pc-pro-add').addEventListener('click', function () { addItem('pros'); });
  HT.$('#pc-con-add').addEventListener('click', function () { addItem('cons'); });

  HT.$('#pc-pro-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); addItem('pros'); }
  });
  HT.$('#pc-con-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); addItem('cons'); }
  });

  HT.$('#pc-clear').addEventListener('click', function () {
    if (!confirm('Clear all pros, cons, and the question?')) return;
    save({ question: '', pros: [], cons: [] });
    renderAll();
  });

  renderAll();
})();