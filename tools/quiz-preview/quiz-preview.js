/* ============================================
   quiz-preview.js — Story 9.12 preview tool
   Mounts HT.quiz with five demo questions and a
   reveal panel that has Share / Print / Reset.

   Listens for the 'shell:ready' event published
   by assets/js/shell.js after storage/url/init
   complete — see shell.js EVENT_BUS.publish /
   subscribe. We defer open() until then so
   HT.urlState / HT.storage are available.
   ============================================ */
'use strict';

(function () {
  var QUESTIONS = [
    {
      id: 'q1-vibe',
      label: 'Vibe check',
      prompt: 'Pick the energy that best describes your morning.',
      options: [
        { value: 'calm', label: 'Coffee + silence' },
        { value: 'busy', label: 'Coffee + email' },
        { value: 'chaos', label: 'Coffee + kids + email' }
      ]
    },
    {
      id: 'q2-stack',
      label: 'Stack',
      prompt: 'Which stack are you reaching for today?',
      options: [
        { value: 'vanilla', label: 'Plain HTML + CSS' },
        { value: 'spa',     label: 'A SPA framework' },
        { value: 'rsc',     label: 'Server components' }
      ]
    },
    {
      id: 'q3-budget',
      label: 'Time budget',
      prompt: 'Realistic time budget for this task?',
      input: 'number',
      min: 5,
      max: 240,
      step: 5,
      helpText: 'Minutes. 5–240.'
    },
    {
      id: 'q4-mood',
      label: 'Mood',
      prompt: 'How are you feeling right now?',
      options: [
        { value: 'great', label: 'Great' },
        { value: 'okay',  label: 'Okay' },
        { value: 'tired', label: 'Tired' }
      ]
    },
    {
      id: 'q5-deploy',
      label: 'Deploy?',
      prompt: 'When are you shipping?',
      input: 'date'
    }
  ];

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') n.className = String(v);
        else if (k === 'text') n.textContent = String(v);
        else n.setAttribute(k, String(v));
      }
    }
    if (children) for (var i = 0; i < children.length; i += 1) {
      var c = children[i];
      if (c == null) continue;
      n.appendChild((typeof c === 'string' || typeof c === 'number')
        ? document.createTextNode(String(c)) : c);
    }
    return n;
  }

  function buildReveal(answers) {
    var wrap = el('div', { class: 'quiz-reveal-custom' });

    var headline = el('p', { class: 'quiz-reveal-headline', text: 'You answered:' });
    wrap.appendChild(headline);

    var list = el('ul', { class: 'quiz-reveal-list' });
    QUESTIONS.forEach(function (q) {
      var ans = answers[q.id];
      var display = (ans === undefined || ans === '') ? '— skipped' : String(ans);
      var li = el('li', { class: 'quiz-reveal-item' }, [
        el('span', { class: 'quiz-reveal-item-label', text: q.label + ': ' }),
        el('span', { class: 'quiz-reveal-item-value', text: display })
      ]);
      list.appendChild(li);
    });
    wrap.appendChild(list);

    // Action buttons — Reset stays local; Share/Print route through
    // the Shell Public API (HT.share.print + HT.copyToClipboard).
    var actions = el('div', { class: 'quiz-reveal-actions', 'data-print': 'ignore' });

    var shareBtn = el('button', {
      type: 'button', class: 'btn btn-secondary', 'data-action': 'share',
      text: 'Share summary'
    });
    var printBtn = el('button', {
      type: 'button', class: 'btn btn-secondary', 'data-action': 'print',
      text: 'Print quiz'
    });
    var resetBtn = el('button', {
      type: 'button', class: 'btn btn-ghost', 'data-action': 'reset',
      text: 'Reset'
    });

    actions.appendChild(shareBtn);
    actions.appendChild(printBtn);
    actions.appendChild(resetBtn);
    wrap.appendChild(actions);

    return wrap;
  }

  function fmtAnswers(answers) {
    return QUESTIONS.map(function (q) {
      var v = answers[q.id];
      return (q.label + ': ' + (v === undefined || v === '' ? '—' : String(v)));
    }).join('\n');
  }

  function mountQuiz() {
    var mount = document.getElementById('quiz-mount');
    if (!mount) return;
    if (!window.HT || !window.HT.quiz) {
      console.error('quiz-preview: HT.quiz not loaded');
      mount.textContent = 'HT.quiz failed to load.';
      return;
    }

    // Try to restore from URL state (e.g. "view=card-3" → jumpTo index 2)
    var seed = {};
    var initialIndex = 0;

    // Read URL state via HT.urlState — fallback to hash scan if absent
    try {
      if (window.HT.urlState && typeof window.HT.urlState.decode === 'function') {
        var restored = window.HT.urlState.decode('quiz-preview', location.hash);
        if (restored && typeof restored === 'object') {
          for (var k in restored) {
            if (Object.prototype.hasOwnProperty.call(restored, k)) {
              if (k === 'view' && /^card-\d+$/.test(String(restored[k]))) {
                initialIndex = Math.max(0, parseInt(String(restored[k]).slice(5), 10) - 1);
              }
            }
          }
        }
      }
    } catch (e) { /* defensive — encode round-trip is best-effort */ }

    var handle = window.HT.quiz.open({
      mount: mount,
      questions: QUESTIONS,
      answers: seed,
      reveal: buildReveal,
      storageKey: '_registry-quiz-preview',
      onChange: function (answers) {
        // Wire share / print / reset buttons after reveal renders.
        // Print routes through HT.share.print() (Shell-owned);
        // share routes through HT.copyToClipboard.
        var rev = mount.querySelector('.quiz-reveal');
        if (!rev) return;
        var share = rev.querySelector('[data-action="share"]');
        var printB = rev.querySelector('[data-action="print"]');
        var reset = rev.querySelector('[data-action="reset"]');
        if (share && !share._wired) {
          share._wired = true;
          share.addEventListener('click', function () {
            var text = 'Quiz Pattern Preview\n' + fmtAnswers(answers);
            var clip = (window.HT && typeof window.HT.copyToClipboard === 'function')
              ? window.HT.copyToClipboard
              : null;
            if (clip) {
              try {
                clip(text).then(function () {
                  share.textContent = 'Copied!';
                })['catch'](function () {
                  share.textContent = 'Copy failed';
                });
              } catch (_) {
                share.textContent = 'Copy failed';
              }
            } else {
              try { window.prompt('Copy summary:', text); } catch (_) {}
              share.textContent = 'Copy failed';
            }
          });
        }
        if (printB && !printB._wired) {
          printB._wired = true;
          printB.addEventListener('click', function () {
            // Story 2.5: route through HT.share.print() — Shell owns Print.
            try {
              if (window.HT && typeof window.HT.share === 'object' &&
                  typeof window.HT.share.print === 'function') {
                window.HT.share.print('quiz-preview');
              }
            } catch (_) {}
          });
        }
        if (reset && !reset._wired) {
          reset._wired = true;
          reset.addEventListener('click', function () {
            try {
              // Reopen the quiz at card 0
              handle.close();
              mountQuiz();
            } catch (_) {}
          });
        }
      }
    });

    if (initialIndex > 0 && typeof handle.jumpTo === 'function') {
      try { handle.jumpTo(initialIndex); } catch (_) {}
    }
  }

  function boot() {
    mountQuiz();
  }

  // Boot on DOMContentLoaded. shell.js may publish 'shell:ready' later;
  // we don't depend on it — HT.quiz.open() works standalone.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
