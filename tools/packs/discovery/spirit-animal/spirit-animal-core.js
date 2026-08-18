/* ============================================
   spirit-animal-core.js — Story 10.7
   Discovery Quiz: Spirit Animal

   Inlines QUESTIONS + SCORING_SPEC verbatim from data.json.
   No fetch / XHR / localStorage / clipboard.
   Mounts via HT.quiz.open() and renders a single Reset reveal.
   ============================================ */
'use strict';

(function () {
  // ----- Inlined QUESTIONS (mirrors data.json) -----
  var QUESTIONS = [
    {
      id: 'q1-path',
      label: 'Forest path',
      prompt: 'You find a fork in a forest path. Which way do you go?',
      options: [
        { value: 'gut',     label: 'Whichever one feels right' },
        { value: 'scout',   label: 'Climb a tree to scout both' },
        { value: 'patient', label: 'Wait and watch the path' },
        { value: 'charge',  label: 'Pick the bolder-looking one' }
      ]
    },
    {
      id: 'q2-storm',
      label: 'Storm rolls in',
      prompt: 'A sudden storm is rolling in. What is your first move?',
      options: [
        { value: 'shield', label: 'Find shelter for everyone nearby' },
        { value: 'face',   label: 'Step out and face the wind' },
        { value: 'study',  label: 'Read the sky and plan the next hour' },
        { value: 'wait',   label: 'Stay put and let it pass' }
      ]
    },
    {
      id: 'q3-presence',
      label: 'Quiet presence',
      prompt: 'In a noisy room, where do people naturally find you?',
      options: [
        { value: 'listen', label: 'The corner, listening more than talking' },
        { value: 'center', label: 'The center, holding the conversation' },
        { value: 'watch',  label: 'Quietly watching from the edges' },
        { value: 'spark',  label: 'Wherever the spark is happening' }
      ]
    },
    {
      id: 'q4-conflict',
      label: 'Group conflict',
      prompt: "Two friends are mid-argument. You...",
      options: [
        { value: 'bridge', label: 'Step in and translate between them' },
        { value: 'space',  label: 'Give them space and check in later' },
        { value: 'truth',  label: 'Name what you see, even if it stings' },
        { value: 'leave',  label: 'Quietly leave and let them sort it' }
      ]
    },
    {
      id: 'q5-river',
      label: 'Crossing the river',
      prompt: "There's a river between you and the goal. You...",
      options: [
        { value: 'plunge', label: 'Jump in and swim straight across' },
        { value: 'build',  label: 'Build a small raft or bridge' },
        { value: 'follow', label: 'Walk the bank until you find a ford' },
        { value: 'pause',  label: 'Sit and reflect on whether to cross' }
      ]
    },
    {
      id: 'q6-gift',
      label: 'Unexpected gift',
      prompt: 'A stranger hands you a sealed box. You...',
      options: [
        { value: 'open',  label: 'Open it on the spot' },
        { value: 'test',  label: 'Inspect it carefully before opening' },
        { value: 'thank', label: 'Thank them and save it for later' },
        { value: 'share', label: 'Open it together with the nearest person' }
      ]
    },
    {
      id: 'q7-night',
      label: 'Night walk',
      prompt: 'Walking alone at night, what do you notice first?',
      options: [
        { value: 'stars',   label: 'The stars and the shape of the sky' },
        { value: 'sounds',  label: 'The small sounds and what they hint at' },
        { value: 'shadows', label: 'The shadows along the path' },
        { value: 'self',    label: 'Your own breathing and thoughts' }
      ]
    },
    {
      id: 'q8-advice',
      label: "Friend's dilemma",
      prompt: 'A close friend asks for honest advice on a big choice. You...',
      options: [
        { value: 'answer',    label: 'Tell them what you think they should do' },
        { value: 'questions', label: 'Ask questions until they answer themselves' },
        { value: 'stories',   label: 'Share a story that reframes it' },
        { value: 'presence',  label: 'Sit with them and hold the space' }
      ]
    }
  ];

  // ----- Inlined SCORING_SPEC (mirrors data.json) -----
  var SCORING_SPEC = {
    traits: ['intuition', 'courage', 'wisdom', 'patience'],
    weights: {
      'q1-path': {
        'gut':     { intuition: 6, courage: 2 },
        'scout':   { wisdom: 5, intuition: 2 },
        'patient': { patience: 6, wisdom: 2 },
        'charge':  { courage: 6, patience: 1 }
      },
      'q2-storm': {
        'shield': { wisdom: 3, patience: 3, courage: 2 },
        'face':   { courage: 6, intuition: 2 },
        'study':  { wisdom: 6, intuition: 2 },
        'wait':   { patience: 6, wisdom: 2 }
      },
      'q3-presence': {
        'listen': { wisdom: 4, patience: 3 },
        'center': { courage: 4, wisdom: 2 },
        'watch':  { patience: 5, intuition: 3 },
        'spark':  { intuition: 4, courage: 3 }
      },
      'q4-conflict': {
        'bridge': { wisdom: 5, patience: 2 },
        'space':  { patience: 5, wisdom: 2 },
        'truth':  { courage: 5, intuition: 2 },
        'leave':  { patience: 4, wisdom: 2 }
      },
      'q5-river': {
        'plunge': { courage: 6, intuition: 2 },
        'build':  { wisdom: 5, patience: 3 },
        'follow': { patience: 4, wisdom: 4 },
        'pause':  { patience: 5, intuition: 3 }
      },
      'q6-gift': {
        'open':   { intuition: 4, courage: 3 },
        'test':   { wisdom: 5, intuition: 3 },
        'thank':  { patience: 5, wisdom: 2 },
        'share':  { wisdom: 3, patience: 3 }
      },
      'q7-night': {
        'stars':   { wisdom: 5, intuition: 2 },
        'sounds':  { intuition: 5, wisdom: 3 },
        'shadows': { courage: 4, intuition: 4 },
        'self':    { patience: 5, wisdom: 2 }
      },
      'q8-advice': {
        'answer':    { courage: 4, wisdom: 3 },
        'questions': { wisdom: 5, patience: 3 },
        'stories':   { wisdom: 4, intuition: 4 },
        'presence':  { patience: 6, wisdom: 2 }
      }
    },
    archetypes: [
      {
        id: 'fox', label: 'Fox', emoji: '🦊',
        tagline: 'Clever, adaptable, and quick to read any room.',
        blindSpot: 'Strategy can shade into manipulation when stakes are small.',
        scores: { intuition: 90, courage: 55, wisdom: 60, patience: 45 }
      },
      {
        id: 'wolf', label: 'Wolf', emoji: '🐺',
        tagline: 'Loyal, brave, and fiercely protective of the pack.',
        blindSpot: 'Loyalty can harden into clannishness when the group is wrong.',
        scores: { intuition: 45, courage: 90, wisdom: 55, patience: 50 }
      },
      {
        id: 'owl', label: 'Owl', emoji: '🦉',
        tagline: 'Patient, observant, and wise in the long view.',
        blindSpot: 'Analysis can stall into hesitation when the moment calls for action.',
        scores: { intuition: 60, courage: 40, wisdom: 90, patience: 70 }
      },
      {
        id: 'turtle', label: 'Turtle', emoji: '🐢',
        tagline: 'Steady, enduring, and at home with slow progress.',
        blindSpot: 'Patience can tip into avoidance when speed would actually help.',
        default: true,
        scores: { intuition: 40, courage: 35, wisdom: 55, patience: 90 }
      },
      {
        id: 'hawk', label: 'Hawk', emoji: '🦅',
        tagline: 'Sharp-eyed, focused, and decisive from a height.',
        blindSpot: 'High-altitude focus can miss the small thing happening right below.',
        scores: { intuition: 75, courage: 75, wisdom: 55, patience: 35 }
      },
      {
        id: 'bear', label: 'Bear', emoji: '🐻',
        tagline: 'Strong, grounded, and quietly confident in body and mind.',
        blindSpot: 'Self-reliance can become isolation when help would arrive quickly.',
        scores: { intuition: 55, courage: 70, wisdom: 60, patience: 60 }
      },
      {
        id: 'deer', label: 'Deer', emoji: '🦌',
        tagline: 'Gentle, alert, and graceful under pressure.',
        blindSpot: 'Sensitivity can read threat where there is only good news.',
        scores: { intuition: 80, courage: 45, wisdom: 55, patience: 65 }
      },
      {
        id: 'dragon', label: 'Dragon', emoji: '🐉',
        tagline: 'Visionary, bold, and built for the long arc.',
        blindSpot: 'Big-picture thinking can underweight the boring details that hold it up.',
        scores: { intuition: 70, courage: 80, wisdom: 85, patience: 45 }
      }
    ]
  };

  // ----- DOM helpers -----
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
      var v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') n.className = String(v);
      else if (k === 'text') n.textContent = String(v);
      else n.setAttribute(k, String(v));
    }
    if (children) for (var i = 0; i < children.length; i += 1) {
      var c = children[i];
      if (c == null) continue;
      n.appendChild((typeof c === 'string' || typeof c === 'number')
        ? document.createTextNode(String(c)) : c);
    }
    return n;
  }

  var TRAIT_LABELS = {
    intuition: 'Intuition',
    courage: 'Courage',
    wisdom: 'Wisdom',
    patience: 'Patience'
  };

  // ----- Reveal panel -----
  function renderReveal(answers, scored) {
    var arch = (scored && scored.archetype) ? scored.archetype : null;
    var traits = (scored && scored.traits) ? scored.traits : {};
    var wrap = el('div', { class: 'disc-reveal', 'data-print': 'result' });

    // Hero
    var hero = el('div', { class: 'disc-reveal-hero' });
    hero.appendChild(el('div', { class: 'disc-reveal-emoji', text: arch ? arch.emoji : '✨' }));
    hero.appendChild(el('h2', { class: 'disc-reveal-label', text: arch ? arch.label : 'Result' }));
    if (arch && arch.tagline) {
      hero.appendChild(el('p', { class: 'disc-reveal-tagline', text: arch.tagline }));
    }
    wrap.appendChild(hero);

    // Trait bars
    var traitIds = SCORING_SPEC.traits;
    var bars = el('ul', { class: 'disc-trait-bars' });
    for (var i = 0; i < traitIds.length; i += 1) {
      var tid = traitIds[i];
      var pct = Math.round((typeof traits[tid] === 'number') ? traits[tid] : 0);
      var row = el('li', { class: 'disc-trait-bar' });
      var labelRow = el('div', { class: 'disc-trait-bar-label' });
      labelRow.appendChild(el('span', { class: 'disc-trait-bar-name', text: TRAIT_LABELS[tid] || tid }));
      labelRow.appendChild(el('span', { class: 'disc-trait-bar-pct', text: pct + '%' }));
      row.appendChild(labelRow);
      var track = el('div', { class: 'disc-trait-bar-track', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct) });
      var fill = el('div', { class: 'disc-trait-bar-fill', 'data-pct': String(pct) });
      fill.style.width = '0%';
      track.appendChild(fill);
      row.appendChild(track);
      bars.appendChild(row);
    }
    wrap.appendChild(bars);

    // Blind-spot
    if (arch && arch.blindSpot) {
      var bl = el('aside', { class: 'disc-blind-spot' });
      bl.appendChild(el('h3', { class: 'disc-blind-spot-title', text: 'Blind spot' }));
      bl.appendChild(el('p', { class: 'disc-blind-spot-body', text: arch.blindSpot }));
      wrap.appendChild(bl);
    }

    // Reset button (only this story's action)
    var actions = el('div', { class: 'disc-actions', 'data-print': 'ignore' });
    var resetBtn = el('button', {
      type: 'button', class: 'btn btn-primary', 'data-action': 'reset',
      text: 'Take it again'
    });
    actions.appendChild(resetBtn);
    wrap.appendChild(actions);

    return wrap;
  }

  // Animate trait bars after rendering completes.
  function animateBars(host) {
    if (!host) return;
    var reduced = false;
    try {
      reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_) {}
    var fills = host.querySelectorAll('.disc-trait-bar-fill');
    for (var i = 0; i < fills.length; i += 1) {
      var f = fills[i];
      var pct = parseFloat(f.getAttribute('data-pct') || '0');
      if (reduced) {
        f.style.width = pct + '%';
      } else {
        // Defer to next frame so the 0% width paints first.
        (function (fill, target) {
          window.requestAnimationFrame(function () {
            fill.style.width = target + '%';
          });
        })(f, pct);
      }
    }
  }

  // ----- Bootstrap -----
  function boot() {
    var mount = document.getElementById('quiz-mount');
    if (!mount) return;
    if (!window.HT || !window.HT.quiz || typeof window.HT.quiz.open !== 'function') {
      mount.textContent = 'HT.quiz failed to load.';
      return;
    }
    if (!window.HT.scoring || typeof window.HT.scoring.score !== 'function') {
      mount.textContent = 'HT.scoring failed to load.';
      return;
    }

    var handle = window.HT.quiz.open({
      mount: mount,
      questions: QUESTIONS,
      onChange: function () {
        // No-op — animation runs on reveal render.
      },
      onComplete: function (answers) {
        var scored = window.HT.scoring.score(answers, SCORING_SPEC);
        // HT.scoring.score returns only {id,label,emoji,default}; recover
        // tagline/blindSpot from the inlined SCORING_SPEC by arch.id.
        if (scored && scored.archetype && scored.archetype.id && SCORING_SPEC.archetypes) {
          for (var ai = 0; ai < SCORING_SPEC.archetypes.length; ai += 1) {
            if (SCORING_SPEC.archetypes[ai].id === scored.archetype.id) {
              scored.archetype = SCORING_SPEC.archetypes[ai];
              break;
            }
          }
        }
        var reveal = renderReveal(answers, scored);
        // Insert into the reveal body slot the quiz shell creates.
        var body = mount.querySelector('.quiz-reveal .quiz-reveal-body');
        if (body) {
          body.innerHTML = '';
          body.appendChild(reveal);
          // Wire Reset inside the newly mounted reveal.
          var resetBtn = body.querySelector('[data-action="reset"]');
          if (resetBtn) {
            resetBtn.setAttribute('aria-label', 'Reset Spirit Animal quiz');
            resetBtn.addEventListener('click', function () {
              try { handle.close(); } catch (_) {}
              boot();
            });
            resetBtn.focus();
          }
          animateBars(body);
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
