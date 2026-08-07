/* ============================================
   Eisenhower Matrix
   2x2 task grid (Do / Schedule / Delegate / Eliminate).
   Reorder, mark done, delete; persisted via HT.storage under 'eisenhower_v1'.
   ============================================ */

(function () {
  'use strict';

  var STORAGE = 'handy-tools.eisenhower-matrix.state';

  var QUADRANTS = ['urgent_important', 'not_urgent_important', 'urgent_not_important', 'not_urgent_not_important'];

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function load() {
    var d = HT.storage.get(STORAGE, null);
    if (d && Array.isArray(d.tasks)) return d;
    return { tasks: [] };
  }

  function save(d) { HT.storage.set(STORAGE, d); }

  function makeTask(text, quadrant) {
    return {
      id: HT.uid(),
      text: text,
      quadrant: quadrant,
      done: false,
      order: Date.now()
    };
  }

  function buildItem(task) {
    var li = document.createElement('li');
    li.className = 'task-item' + (task.done ? ' is-done' : '');
    li.setAttribute('data-id', task.id);

    var text = document.createElement('span');
    text.className = 'task-text';
    text.textContent = task.text;
    li.appendChild(text);

    var actions = document.createElement('div');
    actions.className = 'task-actions';

    var doneBtn = document.createElement('button');
    doneBtn.type = 'button';
    doneBtn.className = 'btn btn-sm';
    doneBtn.textContent = task.done ? 'Undo' : 'Done';
    doneBtn.addEventListener('click', function () {
      var d = load();
      var t = d.tasks.find(function (x) { return x.id === task.id; });
      if (!t) return;
      t.done = !t.done;
      save(d);
      render();
    });
    actions.appendChild(doneBtn);

    var upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'btn btn-sm btn-ghost';
    upBtn.textContent = '↑';
    upBtn.setAttribute('aria-label', 'Move up');
    upBtn.addEventListener('click', function () { move(task.id, -1); });
    actions.appendChild(upBtn);

    var downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'btn btn-sm btn-ghost';
    downBtn.textContent = '↓';
    downBtn.setAttribute('aria-label', 'Move down');
    downBtn.addEventListener('click', function () { move(task.id, +1); });
    actions.appendChild(downBtn);

    var delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-sm btn-danger';
    delBtn.textContent = '×';
    delBtn.setAttribute('aria-label', 'Delete');
    delBtn.addEventListener('click', function () {
      var d = load();
      d.tasks = d.tasks.filter(function (x) { return x.id !== task.id; });
      save(d);
      render();
    });
    actions.appendChild(delBtn);

    li.appendChild(actions);
    return li;
  }

  function move(id, delta) {
    var d = load();
    var inQuadrant = d.tasks
      .filter(function (t) { return t.quadrant === d.tasks.find(function (x) { return x.id === id; }).quadrant; })
      .sort(function (a, b) { return a.order - b.order; });
    var idx = inQuadrant.findIndex(function (t) { return t.id === id; });
    var newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= inQuadrant.length) return;
    var a = inQuadrant[idx];
    var b = inQuadrant[newIdx];
    var tmp = a.order;
    a.order = b.order;
    b.order = tmp;
    save(d);
    render();
  }

  function render() {
    var d = load();
    QUADRANTS.forEach(function (q) {
      var ul = document.querySelector('[data-list="' + q + '"]');
      var quadrant = HT.$('.quadrant[data-q="' + q + '"]');
      ul.innerHTML = '';
      var tasks = d.tasks
        .filter(function (t) { return t.quadrant === q; })
        .sort(function (a, b) { return a.order - b.order; });

      if (tasks.length === 0) {
        quadrant.classList.add('is-empty');
        return;
      }
      quadrant.classList.remove('is-empty');

      tasks.forEach(function (t) { ul.appendChild(buildItem(t)); });
    });
  }

  // ----- Wire up -----

  HT.$('#em-add').addEventListener('click', function () {
    var text = HT.$('#em-text').value.trim();
    var q = HT.$('#em-urgent').value;
    if (!text) { HT.toast('Type a task first'); return; }
    var d = load();
    d.tasks.push(makeTask(text, q));
    save(d);
    HT.$('#em-text').value = '';
    render();
  });

  HT.$('#em-text').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); HT.$('#em-add').click(); }
  });

  HT.$('#em-clear-done').addEventListener('click', function () {
    var d = load();
    var before = d.tasks.length;
    d.tasks = d.tasks.filter(function (t) { return !t.done; });
    save(d);
    render();
    HT.toast('Cleared ' + (before - d.tasks.length) + ' completed');
  });

  HT.$('#em-clear-all').addEventListener('click', function () {
    if (!confirm('Clear all tasks?')) return;
    save({ tasks: [] });
    render();
  });

  render();
})();