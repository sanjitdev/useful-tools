/* ============================================
   Handy Tools — quiz.js (Story 9.12)
   One-question-per-card quiz UI shell module.

   AD-1   — Pure vanilla, no third-party libs (animations are CSS-only)
   AD-5   — URL state round-trips via HT.urlState (location.hash)
   AD-12  — ES2018 vanilla; no SSR; no build step
   AD-14  — Shell Public API surface (HT.quiz is the contract)
   FR-7   — Keyboard-first interaction (Tab / Enter / Esc / 1-9)

   Public API (frozen, stable):
     HT.quiz.open(options) → handle
       options: { mount, questions, answers?, onChange?, onComplete?,
                  reveal?, animations?, storageKey? }
     HT.quiz.close(handle?)
     HT.quiz.next(handle)
     HT.quiz.prev(handle)
     HT.quiz.skip(handle)
     HT.quiz.answer(handle, value)
     HT.quiz.progress(handle) → { current, total, answered }
     HT.quiz.destroy(handle)
     HT.quiz.isOpen(handle?) → boolean

   Question spec (additive, Story 9.12.1):
     { id, label, prompt, options?, input?, min?, max?, step?, helpText?,
       showIf?: ((answers) => boolean) | { skipIf?: (answers) => boolean } }
     showIf defaults to "always visible" — predicates that throw are treated
     as "visible" so a broken predicate never blocks the user.

   Handle API:
     { close, destroy, getAnswers, jumpTo, progress, isOpen }

   DOM shape inside mount:
     <section class="quiz" role="region" aria-live="polite" aria-labelledby="quiz-title">
       <header class="quiz-header">
         <progress class="quiz-progress" max="M" value="N">
         <p class="quiz-progress-label">Question N of M</p>
       </header>
       <h2 class="quiz-sr-only" id="quiz-title">Quiz</h2>
       <div class="quiz-card-stack" data-quiz-current="card-N">
         <article class="quiz-card" data-active="true">
           <h3 class="quiz-card-label">…</h3>
           <p class="quiz-card-prompt">…</p>
           <ul class="quiz-options" role="radiogroup">…</ul>
         </article>
       </div>
       <footer class="quiz-footer">
         <button class="quiz-skip" data-action="skip">Skip</button>
         <button class="quiz-next" data-action="next">Next →</button>
       </footer>
     </section>
   ============================================ */

(function () {
  'use strict';

  /* ----- Internal state registry -----
     The module keeps a registry of live quiz instances so that:
       - close()/destroy()/isOpen() with no args can target the
         most-recently-opened instance (defensive convenience)
       - the smoke harness can poke at the registry directly
       - destroy() and close() can clean up correctly
     Each handle carries a reference to its internal `_state` so
     the closure remains the source of truth.
  */
  var INSTANCES = [];

  function nextHandleId() {
    return 'quiz_' + Math.random().toString(36).slice(2, 10);
  }

  function findHandle(handle) {
    if (!handle) return INSTANCES[INSTANCES.length - 1] || null;
    for (var i = 0; i < INSTANCES.length; i += 1) {
      if (INSTANCES[i]._id === handle._id) return INSTANCES[i];
    }
    return null;
  }

  function dropInstance(stateOrHandle) {
    var targetId = null;
    if (!stateOrHandle) return;
    if (typeof stateOrHandle._id === 'string') {
      targetId = stateOrHandle._id;
    } else if (stateOrHandle._state && typeof stateOrHandle._state._id === 'string') {
      targetId = stateOrHandle._state._id;
    }
    if (!targetId) return;
    for (var i = INSTANCES.length - 1; i >= 0; i -= 1) {
      if (INSTANCES[i]._id === targetId) {
        INSTANCES.splice(i, 1);
        return;
      }
    }
  }

  /* ----- DOM helpers ----- */

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') {
          node.className = String(v);
        } else if (k === 'dataset') {
          for (var d in v) {
            if (Object.prototype.hasOwnProperty.call(v, d)) {
              try { node.dataset[d] = String(v[d]); } catch (_) {}
            }
          }
        } else if (k === 'text') {
          node.textContent = String(v);
        } else if (k.indexOf('on') === 0 && typeof v === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (v === true) {
          try { node.setAttribute(k, ''); } catch (_) {}
        } else {
          try { node.setAttribute(k, String(v)); } catch (_) {}
        }
      }
    }
    if (children) {
      for (var i = 0; i < children.length; i += 1) {
        var c = children[i];
        if (c === null || c === undefined) continue;
        if (typeof c === 'string' || typeof c === 'number') {
          node.appendChild(document.createTextNode(String(c)));
        } else {
          node.appendChild(c);
        }
      }
    }
    return node;
  }

  function clearChildren(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function reducedMotionOn() {
    try {
      var root = document.documentElement;
      if (root && root.getAttribute('data-reduced-motion') === 'true') return true;
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      }
    } catch (_) {}
    return false;
  }

  /* ----- Build one card ----- */

  function buildCard(question, index, total) {
    var cardId = 'card-' + (index + 1);
    var labelId = 'card-label-' + (index + 1);
    var heading = el('h3', { class: 'quiz-card-label', id: labelId, text: question.label });
    var prompt = el('p', { class: 'quiz-card-prompt', text: question.prompt });

    var body = el('div', { class: 'quiz-card-body' }, [heading, prompt]);

    var interactive = null;
    if (Array.isArray(question.options) && question.options.length > 0) {
      interactive = el('ul', {
        class: 'quiz-options',
        role: 'radiogroup',
        'aria-labelledby': labelId,
      }, question.options.map(function (opt, i) {
        var btn = el('button', {
          type: 'button',
          role: 'radio',
          'aria-checked': 'false',
          class: 'quiz-option',
          'data-value': String(opt.value),
          'data-action': 'pick',
          tabindex: i === 0 ? '0' : '-1',
          text: opt.label,
        });
        return el('li', { class: 'quiz-option-item' }, [btn]);
      }));
    } else if (question.input === 'number' || question.input === 'text' || question.input === 'date') {
      var inputAttrs = {
        type: question.input === 'date' ? 'date' : question.input,
        class: 'input quiz-input',
        id: 'card-input-' + (index + 1),
        'data-action': 'input',
        'aria-labelledby': labelId,
      };
      if (question.min !== undefined) inputAttrs.min = String(question.min);
      if (question.max !== undefined) inputAttrs.max = String(question.max);
      if (question.step !== undefined) inputAttrs.step = String(question.step);
      var input = el('input', inputAttrs);
      var inputWrap = el('label', { class: 'quiz-input-wrap', for: 'card-input-' + (index + 1) }, [input]);
      if (question.helpText) {
        inputWrap.appendChild(el('span', { class: 'quiz-help-text', text: question.helpText }));
      }
      interactive = inputWrap;
    } else {
      // No interactive element — make card itself focusable as fallback
      interactive = el('div', { class: 'quiz-card-empty', text: '(Press Next to continue)' });
    }

    body.appendChild(interactive);

    var card = el('article', {
      class: 'quiz-card',
      'data-active': 'true',
      'data-card-id': question.id,
      'aria-labelledby': labelId,
      tabindex: interactive ? undefined : '-1',
    }, [body]);

    return card;
  }

  /* ----- Render header + footer ----- */

  function buildHeader(state) {
    // Story 9.12.1 — visual position is the index into the visible list,
    // not the logical question index.
    var visual = (typeof state._visualIndex === 'number') ? state._visualIndex : 0;
    var progress = el('progress', {
      class: 'quiz-progress',
      max: String(state.total),
      value: String(visual + 1),
      'aria-label': 'Quiz progress',
    });
    var label = el('p', {
      class: 'quiz-progress-label',
      id: 'quiz-progress-label',
      text: 'Question ' + (visual + 1) + ' of ' + state.total,
    });
    return el('header', { class: 'quiz-header' }, [progress, label]);
  }

  function buildFooter() {
    var skip = el('button', {
      type: 'button',
      class: 'quiz-skip btn btn-ghost',
      'data-action': 'skip',
      text: 'Skip',
    });
    var next = el('button', {
      type: 'button',
      class: 'quiz-next btn btn-primary',
      'data-action': 'next',
      text: 'Next →',
    });
    return el('footer', { class: 'quiz-footer' }, [skip, next]);
  }

  /* ----- Focus trap helpers ----- */

  function focusableIn(root) {
    if (!root) return [];
    var sel = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    var nodes = root.querySelectorAll(sel);
    var out = [];
    for (var i = 0; i < nodes.length; i += 1) {
      var n = nodes[i];
      // Skip elements hidden via display:none / aria-hidden
      if (n.getAttribute('aria-hidden') === 'true') continue;
      out.push(n);
    }
    return out;
  }

  function focusFirstInteractive(card) {
    if (!card) return;
    var f = focusableIn(card);
    if (f.length > 0) {
      try { f[0].focus(); } catch (_) {}
    } else {
      try { card.focus(); } catch (_) {}
    }
  }

  /* ----- Storage save/restore (optional) ----- */

  function saveState(state) {
    if (!state.storageKey) return;
    try {
      if (window.HT && window.HT.storage && typeof window.HT.storage.set === 'function') {
        window.HT.storage.set(state.storageKey, {
          answers: state.answers,
          current: state.current,
        });
      } else {
        localStorage.setItem(state.storageKey, JSON.stringify({
          answers: state.answers,
          current: state.current,
        }));
      }
    } catch (_) {}
  }

  function loadState(storageKey) {
    if (!storageKey) return null;
    try {
      var raw = null;
      if (window.HT && window.HT.storage && typeof window.HT.storage.get === 'function') {
        raw = window.HT.storage.get(storageKey);
      } else {
        raw = localStorage.getItem(storageKey);
      }
      if (!raw) return null;
      if (typeof raw === 'string') return JSON.parse(raw);
      return raw;
    } catch (_) { return null; }
  }

  function clearState(storageKey) {
    if (!storageKey) return;
    try {
      if (window.HT && window.HT.storage && typeof window.HT.storage.remove === 'function') {
        window.HT.storage.remove(storageKey);
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch (_) {}
  }

  /* ----- Emit answer/skip events to host ----- */

  function emitChange(state) {
    if (typeof state.onChange === 'function') {
      try { state.onChange(state.answers); } catch (_) {}
    }
    saveState(state);
  }

  /* ----- Render card-stack + footer ----- */

  // Story 9.12.1 — branching helpers
  function isHidden(state, logicalIndex) {
    if (!state || !state.questions[logicalIndex]) return true;
    var q = state.questions[logicalIndex];
    if (typeof q._skipIf !== 'function') return false;
    try { return !!q._skipIf(state.answers); } catch (_) { return false; }
  }

  function visibleQuestions(state) {
    var out = [];
    if (!state || !state.questions) return out;
    for (var i = 0; i < state.questions.length; i += 1) {
      if (!isHidden(state, i)) out.push({ q: state.questions[i], index: i });
    }
    return out;
  }

  function visibleIndexOf(state, logicalIndex) {
    var list = visibleQuestions(state);
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].index === logicalIndex) return i;
    }
    return -1;
  }

  // Recompute the visible list after every emitChange. If the current logical
  // card is now hidden, advance forward over hidden siblings and re-render.
  // Sticky for past, dynamic for future — never rewinds the user.
  function reevaluateAndAdvanceIfHidden(state) {
    if (!state) return;
    if (state.current >= state.questions.length) {
      // Already in reveal territory — nothing to do.
      state.total = visibleQuestions(state).length;
      return;
    }
    while (state.current < state.questions.length && isHidden(state, state.current)) {
      state.current += 1;
    }
    state.total = visibleQuestions(state).length;
  }

  function renderStack(state) {
    if (!state.stack) return;
    clearChildren(state.stack);
    if (state.current >= state.questions.length) {
      // Reveal territory — handled elsewhere
      return;
    }
    // Story 9.12.1 — recompute visible list and visual index every render
    var list = visibleQuestions(state);
    state.total = list.length;
    var visual = visibleIndexOf(state, state.current);
    if (visual < 0) {
      // Current logical card is hidden — renderReveal path took over
      return;
    }
    state._visualIndex = visual;

    var card = buildCard(state.questions[state.current], visual, state.total);
    state.stack.appendChild(card);
    state.stack.setAttribute('data-quiz-current', 'card-' + (visual + 1));
    card._state = state;
    state._lastRenderedCard = card;

    // Focus the first interactive element on the new card
    setTimeout(function () { focusFirstInteractive(card); }, 0);

    // Update progress
    if (state.progressEl) {
      try { state.progressEl.setAttribute('value', String(visual + 1)); } catch (_) {}
    }
    if (state.progressLabelEl) {
      try { state.progressLabelEl.textContent =
        'Question ' + (visual + 1) + ' of ' + state.total; } catch (_) {}
    }

    // Last card? Change Next button text to "Finish"
    if (state.nextBtn) {
      if (visual === state.total - 1) {
        try { state.nextBtn.textContent = 'Finish ✓'; } catch (_) {}
      } else {
        try { state.nextBtn.textContent = 'Next →'; } catch (_) {}
      }
    }
  }

  /* ----- Reveal ----- */

  function renderReveal(state) {
    if (!state.stack) return;
    clearChildren(state.stack);

    var body = el('div', { class: 'quiz-reveal', 'data-print': 'result', role: 'region', 'aria-live': 'polite' }, []);
    var title = el('h2', { class: 'quiz-reveal-title', text: 'Done!' });
    body.appendChild(title);

    var innerBody = el('div', { class: 'quiz-reveal-body' });
    if (typeof state.reveal === 'function') {
      try {
        var custom = state.reveal(state.answers);
        if (custom && custom.nodeType === 1) {
          innerBody.appendChild(custom);
        } else if (typeof custom === 'string' && custom.length > 0) {
          innerBody.textContent = custom;
        } else {
          innerBody.textContent = 'You answered ' + state.answeredCount + ' of ' + state.total + ' questions.';
        }
      } catch (e) {
        innerBody.textContent = 'Result unavailable — ' + String(e && e.message || 'error');
      }
    } else {
      innerBody.textContent = 'You answered ' + state.answeredCount + ' of ' + state.total + ' questions.';
    }
    body.appendChild(innerBody);

    if (state.footerEl && state.footerEl.parentNode) {
      state.footerEl.parentNode.removeChild(state.footerEl);
    }

    state.stack.appendChild(body);
    state._revealRendered = true;

    // Notify host
    if (typeof state.onComplete === 'function') {
      try { state.onComplete(state.answers); } catch (_) {}
    }
  }

  /* ----- Move to next/prev ----- */

  function advance(state, wroteAnswer) {
    if (!state) return;
    if (wroteAnswer) state.answeredCount += 1;
    // Snap forward over any newly-hidden siblings (Story 9.12.1)
    if (state.current < state.questions.length - 1) {
      state.current += 1;
      while (state.current < state.questions.length && isHidden(state, state.current)) {
        state.current += 1;
      }
      if (state.current < state.questions.length) {
        renderStack(state);
      } else {
        renderReveal(state);
      }
      emitChange(state);
    } else {
      // Last question — go to reveal
      state.current = state.questions.length;
      renderReveal(state);
      emitChange(state);
    }
  }

  function rewind(state) {
    if (!state) return;
    if (state.current <= 0) return;
    state.current -= 1;
    // Story 9.12.1 — snap backward over any hidden siblings
    while (state.current > 0 && isHidden(state, state.current)) {
      state.current -= 1;
    }
    if (state._revealRendered) {
      // Re-show footer
      state._revealRendered = false;
      if (!state.footerEl.parentNode && state.section) {
        state.section.appendChild(state.footerEl);
      }
    }
    renderStack(state);
    emitChange(state);
  }

  /* ----- Card event handler ----- */

  function onCardClick(ev) {
    var t = ev.target;
    if (!t) return;
    var action = t.getAttribute && t.getAttribute('data-action');
    if (action === 'pick') {
      var value = t.getAttribute('data-value');
      var card = t.closest('.quiz-card');
      var state = card && card._state;
      if (!state) return;
      // Update aria-checked on siblings
      var opts = card.querySelectorAll('.quiz-option');
      for (var i = 0; i < opts.length; i += 1) {
        opts[i].setAttribute('aria-checked', opts[i] === t ? 'true' : 'false');
        if (opts[i] === t) opts[i].classList.add('is-selected');
        else opts[i].classList.remove('is-selected');
      }
      // Pick animation
      if (!reducedMotionOn()) {
        t.classList.remove('quiz-option-bounce');
        // force reflow then re-add to retrigger animation
        void t.offsetWidth;
        t.classList.add('quiz-option-bounce');
      }
      // Stash current value so Next picks it up
      state._pendingValue = value;
    }
  }

  function onCardKeydown(ev) {
    var t = ev.target;
    if (!t) return;
    var card = t.closest('.quiz-card');
    var state = card && card._state;
    if (!state) return;

    // Number keys 1-9 pick option N
    if (/^[1-9]$/.test(ev.key) && state.questions[state.current].options) {
      var opts = state.questions[state.current].options;
      var idx = parseInt(ev.key, 10) - 1;
      if (idx >= 0 && idx < opts.length) {
        ev.preventDefault();
        var btn = card.querySelectorAll('.quiz-option')[idx];
        if (btn) btn.click();
        return;
      }
    }

    // Arrow keys cycle options (radiogroup convention)
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') {
      var optsAll = card.querySelectorAll('.quiz-option');
      if (optsAll.length > 0 && t.classList.contains('quiz-option')) {
        ev.preventDefault();
        var focused = -1;
        for (var i = 0; i < optsAll.length; i += 1) {
          if (optsAll[i] === document.activeElement) { focused = i; break; }
        }
        var nextIdx = (focused + 1) % optsAll.length;
        // Update tabindex
        for (var j = 0; j < optsAll.length; j += 1) {
          optsAll[j].setAttribute('tabindex', j === nextIdx ? '0' : '-1');
        }
        try { optsAll[nextIdx].focus(); } catch (_) {}
      }
    }
    if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') {
      var optsAll2 = card.querySelectorAll('.quiz-option');
      if (optsAll2.length > 0 && t.classList.contains('quiz-option')) {
        ev.preventDefault();
        var focused2 = -1;
        for (var k = 0; k < optsAll2.length; k += 1) {
          if (optsAll2[k] === document.activeElement) { focused2 = k; break; }
        }
        var prevIdx = focused2 <= 0 ? optsAll2.length - 1 : focused2 - 1;
        for (var m = 0; m < optsAll2.length; m += 1) {
          optsAll2[m].setAttribute('tabindex', m === prevIdx ? '0' : '-1');
        }
        try { optsAll2[prevIdx].focus(); } catch (_) {}
      }
    }
  }

  function onStackChange(ev) {
    var stack = ev.target;
    var state = stack && stack._state;
    if (!state) return;
    var card = stack.querySelector('.quiz-card');
    if (card) card._state = state;
  }

  /* ----- Footer click handler ----- */

  function onFooterClick(ev) {
    var t = ev.target;
    if (!t) return;
    var action = t.getAttribute && t.getAttribute('data-action');
    if (!action) return;
    var footer = t.closest('.quiz-footer');
    var state = footer && footer._state;
    if (!state) return;
    if (action === 'skip') {
      // Advance without writing — snap over hidden siblings (Story 9.12.1)
      if (state.current < state.questions.length - 1) {
        state.current += 1;
        while (state.current < state.questions.length && isHidden(state, state.current)) {
          state.current += 1;
        }
        if (state.current < state.questions.length) {
          renderStack(state);
        } else {
          renderReveal(state);
        }
        emitChange(state);
      } else {
        state.current = state.questions.length;
        renderReveal(state);
        emitChange(state);
      }
    } else if (action === 'next') {
      var current = state.questions[state.current];
      // If option question and a value is pending, write it
      if (current && Array.isArray(current.options) && current.options.length > 0) {
        if (state._pendingValue !== undefined) {
          state.answers[current.id] = state._pendingValue;
          state._pendingValue = undefined;
          advance(state, true);
          return;
        }
        // No selection — behaves like skip
        advance(state, false);
      } else if (current && current.input) {
        var input = state.stack.querySelector('input.quiz-input');
        var val = input ? input.value : undefined;
        if (val !== undefined && val !== '') {
          state.answers[current.id] = current.input === 'number' ? parseFloat(val) : val;
          advance(state, true);
        } else {
          advance(state, false);
        }
      } else {
        // No interactive — just advance
        advance(state, false);
      }
    }
  }

  /* ----- Document-level keydown for Esc ----- */

  function onDocKeydown(ev) {
    if (ev.key !== 'Escape') return;
    for (var i = INSTANCES.length - 1; i >= 0; i -= 1) {
      var inst = INSTANCES[i];
      if (inst && inst._state && inst._state.section && inst._state.section.contains(document.activeElement)) {
        // Pop one card if not on first visible card; else close.
        // Story 9.12.1 — use the visual index, not the logical question index.
        var visual = (typeof inst._state._visualIndex === 'number') ? inst._state._visualIndex : 0;
        if (inst._state._revealRendered || visual === 0) {
          inst.close();
        } else {
          rewind(inst._state);
        }
        ev.preventDefault();
        return;
      }
    }
  }

  /* ----- Open ----- */

  function open(options) {
    if (!options || !options.mount) {
      throw new Error('HT.quiz.open: options.mount is required');
    }
    if (!Array.isArray(options.questions) || options.questions.length === 0) {
      throw new Error('HT.quiz.open: options.questions must be a non-empty array');
    }
    var mount = options.mount;
    if (!mount || typeof mount.appendChild !== 'function') {
      throw new Error('HT.quiz.open: options.mount must be a DOM element');
    }

    // Defensive: in vm smoke contexts, document.createElement returns
    // host-context nodes. Ensure querySelector exists; if not, patch
    // the prototype. (No-op in real browsers since Node.prototype is
    // already there.)
    if (typeof mount.querySelector !== 'function') {
      try {
        var NodeProto = Object.getPrototypeOf(mount);
        if (NodeProto && typeof NodeProto.querySelector !== 'function') {
          try {
            var sample = document.createElement('div');
            if (sample && typeof sample.querySelector === 'function') {
              NodeProto.querySelector = sample.querySelector;
              NodeProto.querySelectorAll = sample.querySelectorAll;
              NodeProto.closest = sample.closest;
            }
          } catch (_) {}
        }
      } catch (_) {}
    }

    // Validate question IDs are unique + normalize showIf
    var seen = {};
    for (var i = 0; i < options.questions.length; i += 1) {
      var q = options.questions[i];
      if (!q || typeof q.id !== 'string' || !q.id) {
        throw new Error('HT.quiz.open: each question must have a non-empty string id');
      }
      if (seen[q.id]) {
        throw new Error('HT.quiz.open: duplicate question id "' + q.id + '"');
      }
      seen[q.id] = true;
      // Story 9.12.1 — normalize showIf → _skipIf.
      // Capture q in a per-iteration IIFE so the closure doesn't leak
      // the loop's function-scoped `q` (which always references the
      // last question by the time _skipIf fires).
      if (q.showIf !== undefined) {
        (function (qq) {
          if (typeof qq.showIf === 'function') {
            qq._skipIf = function (answers) {
              try { return !qq.showIf(answers); } catch (_) { return false; }
            };
          } else if (qq.showIf && typeof qq.showIf.skipIf === 'function') {
            qq._skipIf = function (answers) {
              try { return !!qq.showIf.skipIf(answers); } catch (_) { return false; }
            };
          } else {
            throw new Error('HT.quiz.open: questions[i].showIf must be a function or { skipIf: function }');
          }
        })(q);
      }
    }

    var sectionId = 'quiz-' + Math.random().toString(36).slice(2, 10);

    var section = el('section', {
      class: 'quiz',
      id: sectionId,
      role: 'region',
      'aria-live': 'polite',
      'aria-labelledby': sectionId + '-title',
    });
    var title = el('h2', {
      class: 'quiz-sr-only',
      id: sectionId + '-title',
      text: 'Quiz',
    });

    // Seed answers: from options.answers, or from storage, or empty
    var seedAnswers = {};
    if (options.answers && typeof options.answers === 'object') {
      for (var k in options.answers) {
        if (Object.prototype.hasOwnProperty.call(options.answers, k)) {
          seedAnswers[k] = options.answers[k];
        }
      }
    }
    if (Object.keys(seedAnswers).length === 0 && options.storageKey) {
      var restored = loadState(options.storageKey);
      if (restored && restored.answers && typeof restored.answers === 'object') {
        seedAnswers = restored.answers;
      }
    }

    var state = {
      _id: nextHandleId(),
      mount: mount,
      section: section,
      questions: options.questions,
      answers: seedAnswers,
      onChange: typeof options.onChange === 'function' ? options.onChange : null,
      onComplete: typeof options.onComplete === 'function' ? options.onComplete : null,
      reveal: typeof options.reveal === 'function' ? options.reveal : null,
      storageKey: options.storageKey || null,
      total: options.questions.length,
      current: 0,
      // Story 9.12.1 — visual position into the visible list, derived per render
      _visualIndex: 0,
      answeredCount: 0,
      _pendingValue: undefined,
      _revealRendered: false,
      _destroyed: false,
      // DOM refs filled below
      stack: null,
      footerEl: null,
      progressEl: null,
      progressLabelEl: null,
      nextBtn: null,
    };

    // Story 9.12.1 — after URL-state hydration, advance past any cards whose
    // showIf predicate returns false against the restored answers.
    while (state.current < state.questions.length && isHidden(state, state.current)) {
      state.current += 1;
    }
    state.total = visibleQuestions(state).length;

    var header = buildHeader(state);
    state.progressEl = header.querySelector('.quiz-progress');
    state.progressLabelEl = header.querySelector('.quiz-progress-label');

    var stack = el('div', { class: 'quiz-card-stack', 'data-quiz-current': 'card-1' });
    stack._state = state;
    state.stack = stack;

    var footer = buildFooter();
    state.footerEl = footer;
    state.nextBtn = footer.querySelector('.quiz-next');

    section.appendChild(title);
    section.appendChild(header);
    section.appendChild(stack);
    section.appendChild(footer);

    // Wire events
    stack.addEventListener('click', onCardClick);
    stack.addEventListener('keydown', onCardKeydown);
    stack.addEventListener('DOMSubtreeModified', onStackChange);
    footer.addEventListener('click', onFooterClick);
    document.addEventListener('keydown', onDocKeydown);

    // Mount
    clearChildren(mount);
    mount.appendChild(section);
    section._state = state;
    footer._state = state;

    // Build the handle
    var handle = {
      _id: state._id,
      _state: state,
      close: function () { closeHandle(state); },
      destroy: function () { destroyHandle(state); },
      getAnswers: function () { return Object.assign({}, state.answers); },
      jumpTo: function (idx) { jumpTo(state, idx); },
      progress: function () { return computeProgress(state); },
      isOpen: function () { return isInstanceOpen(state); },
    };
    Object.freeze(handle);
    INSTANCES.push(handle);

    renderStack(state);
    return handle;
  }

  function closeHandle(state) {
    if (!state || state._destroyed) return;
    if (state.section && state.section.parentNode) {
      state.section.parentNode.removeChild(state.section);
    }
    document.removeEventListener('keydown', onDocKeydown);
    state._destroyed = true;
    dropInstance(state);
  }

  function destroyHandle(state) {
    if (!state) return;
    closeHandle(state);
    clearState(state.storageKey);
  }

  function jumpTo(state, idx) {
    if (!state) return;
    if (typeof idx !== 'number' || isNaN(idx)) return;
    if (idx < 0 || idx >= state.questions.length) return;
    state.current = idx;
    // Story 9.12.1 — if the target is hidden, snap to the next visible card.
    if (isHidden(state, idx)) {
      while (state.current < state.questions.length && isHidden(state, state.current)) {
        state.current += 1;
      }
    }
    if (state._revealRendered) {
      // Re-show footer
      state._revealRendered = false;
      if (!state.footerEl.parentNode && state.section) {
        state.section.appendChild(state.footerEl);
      }
    }
    if (state.current < state.questions.length) {
      renderStack(state);
    } else {
      renderReveal(state);
    }
    emitChange(state);
  }

  function computeProgress(state) {
    if (!state) return { current: 0, total: 0, answered: 0 };
    // Story 9.12.1 — when in reveal territory, mirror the legacy semantics
    // (current past the last visible card) so existing tests + callers work.
    // Mid-quiz, `current` reflects the visual position; `total` reflects the
    // visible-card count. Both are 0-based.
    var cur;
    if (state.current >= state.questions.length) {
      cur = state.total; // past last visible card
    } else {
      cur = (typeof state._visualIndex === 'number') ? state._visualIndex : 0;
    }
    return {
      current: cur,
      total: state.total,
      answered: Object.keys(state.answers).length,
    };
  }

  function isInstanceOpen(state) {
    if (!state) return false;
    return !state._destroyed;
  }

  /* ----- Public surface ----- */

  var publicApi = Object.freeze({
    open: open,
    close: function (handle) {
      if (handle && handle._state) { closeHandle(handle._state); return; }
      var last = INSTANCES[INSTANCES.length - 1];
      if (last && last._state) closeHandle(last._state);
    },
    next: function (handle) {
      var h = findHandle(handle);
      if (!h || !h._state) return;
      var s = h._state;
      if (s.current < s.questions.length - 1) {
        s.current += 1;
        // Story 9.12.1 — snap over hidden siblings
        while (s.current < s.questions.length && isHidden(s, s.current)) {
          s.current += 1;
        }
        if (s.current < s.questions.length) {
          renderStack(s);
        } else {
          renderReveal(s);
        }
        emitChange(s);
      } else {
        s.current = s.questions.length;
        renderReveal(s);
        emitChange(s);
      }
    },
    prev: function (handle) {
      var h = findHandle(handle);
      if (!h || !h._state) return;
      rewind(h._state);
    },
    skip: function (handle) {
      var h = findHandle(handle);
      if (!h || !h._state) return;
      var s = h._state;
      if (s.current < s.questions.length - 1) {
        s.current += 1;
        // Story 9.12.1 — snap over hidden siblings
        while (s.current < s.questions.length && isHidden(s, s.current)) {
          s.current += 1;
        }
        if (s.current < s.questions.length) {
          renderStack(s);
        } else {
          renderReveal(s);
        }
        emitChange(s);
      } else {
        s.current = s.questions.length;
        renderReveal(s);
        emitChange(s);
      }
    },
    answer: function (handle, value) {
      var h = findHandle(handle);
      if (!h || !h._state) return;
      var s = h._state;
      var q = s.questions[s.current];
      if (!q) return;
      s.answers[q.id] = value;
      s._pendingValue = undefined;
      // Highlight matching option
      var opts = s.stack.querySelectorAll('.quiz-option');
      for (var i = 0; i < opts.length; i += 1) {
        var ov = opts[i].getAttribute('data-value');
        var match = String(ov) === String(value);
        opts[i].setAttribute('aria-checked', match ? 'true' : 'false');
        if (match) opts[i].classList.add('is-selected');
        else opts[i].classList.remove('is-selected');
      }
      // Story 9.12.1 — recompute visible list. If the user just hid a
      // downstream card, the card stack stays put; re-evaluation runs
      // on advance/next/jumpTo. (Calling reevaluateAndAdvanceIfHidden here
      // would yank the user off the card they just answered.)
      s.total = visibleQuestions(s).length;
      emitChange(s);
    },
    progress: function (handle) {
      var h = findHandle(handle);
      if (!h || !h._state) return { current: 0, total: 0, answered: 0 };
      return computeProgress(h._state);
    },
    destroy: function (handle) {
      var h = findHandle(handle);
      if (!h || !h._state) return;
      destroyHandle(h._state);
    },
    isOpen: function (handle) {
      if (!handle) {
        return INSTANCES.some(function (i) { return i && i._state && !i._state._destroyed; });
      }
      var h = findHandle(handle);
      return h && h._state ? isInstanceOpen(h._state) : false;
    },
  });

  // Export to both window.HT (canonical) and a defensive fallback to
  // the current lexical scope's `HT` (covers vm smoke harness contexts
  // where `window` is a separate object).
  var rootHT = (typeof window !== 'undefined' && window.HT) || (typeof self !== 'undefined' && self.HT) || null;
  if (!rootHT) {
    // No shell loaded yet — create a minimal HT namespace so HT.quiz works.
    if (typeof window !== 'undefined') {
      window.HT = window.HT || {};
      rootHT = window.HT;
    }
  }
  if (rootHT) {
    try {
      Object.defineProperty(rootHT, 'quiz', {
        value: publicApi,
        writable: false,
        configurable: false,
        enumerable: true,
      });
    } catch (_) {
      // Fallback for environments where defineProperty throws (very old engines)
      try { rootHT.quiz = publicApi; } catch (__) {}
    }
  }
})();
