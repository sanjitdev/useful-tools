/* ============================================
   Habit Tracker
   Per-habit list with daily check-off, streaks, and a 30-day heatmap.
   Persisted via HT.storage under key 'habit_tracker_v1'.
   ============================================ */

(function () {
  'use strict';

  var STORAGE = 'handy-tools.habit-tracker.state';

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function dateKey(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function loadAll() {
    var data = HT.storage.get(STORAGE, null);
    if (data && Array.isArray(data.habits)) return data;
    return { habits: [] };
  }

  function saveAll(data) {
    HT.storage.set(STORAGE, data);
  }

  // Default seed: a single example habit so the page is non-empty on first load.
  function ensureSeed() {
    var data = loadAll();
    if (data.habits.length === 0) {
      data.habits.push({
        id: HT.uid(),
        name: 'Drink water',
        emoji: '💧',
        completions: {}
      });
      saveAll(data);
    }
    return data;
  }

  // Streak: number of consecutive days ending today (or yesterday if today not done)
  function computeStreak(completions) {
    var streak = 0;
    var d = new Date();
    // If today not done, start from yesterday
    if (!completions[dateKey(d)]) {
      d.setDate(d.getDate() - 1);
    }
    while (completions[dateKey(d)]) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  // Last-30-days grid: oldest first
  function last30Days() {
    var days = [];
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    for (var i = 29; i >= 0; i--) {
      var day = new Date(d);
      day.setDate(d.getDate() - i);
      days.push(day);
    }
    return days;
  }

  var listEl = HT.$('#habit-list');

  function render() {
    var data = loadAll();
    if (data.habits.length === 0) {
      listEl.innerHTML = '<div class="empty">No habits yet. Add one above to start.</div>';
      return;
    }

    var html = '';
    var days = last30Days();

    data.habits.forEach(function (habit) {
      var streak = computeStreak(habit.completions);
      var total30 = 0;
      var cellsHtml = '';
      var today = todayKey();

      days.forEach(function (day) {
        var k = dateKey(day);
        var done = !!habit.completions[k];
        if (done) total30++;
        var cls = 'habit-cell' + (done ? ' is-done' : '') + (k === today ? ' is-today' : '');
        var title = k + (done ? ' · done' : '');
        cellsHtml += '<div class="' + cls + '" title="' + title + '"></div>';
      });

      var todayChecked = habit.completions[today] ? 'checked' : '';

      html +=
        '<div class="habit-card" data-id="' + habit.id + '">' +
          '<div class="habit-head">' +
            '<span class="habit-emoji">' + escapeHtml(habit.emoji || '•') + '</span>' +
            '<span class="habit-name">' + escapeHtml(habit.name) + '</span>' +
            '<div class="habit-stats">' +
              '<div>Streak: <strong>' + streak + '</strong></div>' +
              '<div>Last 30d: <strong>' + total30 + '</strong>/30</div>' +
            '</div>' +
          '</div>' +
          '<div class="habit-grid">' + cellsHtml + '</div>' +
          '<div class="habit-actions">' +
            '<label class="checkbox">' +
              '<input type="checkbox" class="toggle-today" ' + todayChecked + '>' +
              '<span>Mark today (' + today + ') done</span>' +
            '</label>' +
            '<button type="button" class="btn btn-sm btn-danger delete-habit" style="margin-left:auto;">Delete</button>' +
          '</div>' +
        '</div>';
    });

    listEl.innerHTML = html;

    // Wire up events
    HT.qsa('.habit-card', listEl).forEach(function (card) {
      var id = card.getAttribute('data-id');
      var toggle = HT.qs('.toggle-today', card);
      var del = HT.qs('.delete-habit', card);

      toggle.addEventListener('change', function () {
        var d = loadAll();
        var h = d.habits.find(function (x) { return x.id === id; });
        if (!h) return;
        var k = todayKey();
        if (toggle.checked) h.completions[k] = 1;
        else delete h.completions[k];
        saveAll(d);
        render();
      });

      del.addEventListener('click', function () {
        if (!confirm('Delete this habit and all of its history?')) return;
        var d = loadAll();
        d.habits = d.habits.filter(function (x) { return x.id !== id; });
        saveAll(d);
        render();
      });
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Add habit
  var nameEl = HT.$('#habit-name');
  var emojiEl = HT.$('#habit-emoji');
  HT.$('#add-habit').addEventListener('click', function () {
    var name = nameEl.value.trim();
    if (!name) {
      HT.toast('Please enter a habit name');
      return;
    }
    var emoji = emojiEl.value.trim();
    var data = loadAll();
    data.habits.push({
      id: HT.uid(),
      name: name,
      emoji: emoji,
      completions: {}
    });
    saveAll(data);
    nameEl.value = '';
    emojiEl.value = '';
    render();
  });

  ensureSeed();
  render();
})();