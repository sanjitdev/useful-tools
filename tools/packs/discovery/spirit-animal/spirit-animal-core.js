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




  // ----- Bootstrap -----
  function boot() {
    var QUIZ_SLUG = 'spirit-animal';

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
        // Bug fix (2026-08-18): shell-thin.js exposes HT.scoring and
        // HT.results as Proxy stubs that lazy-load their underlying
        // modules (scoring.js, results.js) on first property access.
        // Both proxies return a Promise when the lazy-load + ready
        // chain resolves — they do NOT return the synchronous result
        // synchronously. The previous code treated the return value as
        // a synchronous object, which led to a rendered card built
        // from `undefined` archetype/traits and a Promise being
        // passed to body.appendChild() — visibly empty card.
        // Fix: chain .then() so the real scored data + rendered card
        // arrive after the lazy-load resolves.
        Promise.resolve(window.HT.scoring.score(answers, SCORING_SPEC))
          .then(function (scored) {
        // HT.scoring.score returns only {id,label,emoji,default}; recover
        // tagline/blindSpot from the inlined SCORING_SPEC by arch.id.
        // FROZEN-FIX (2026-08-18): scoring.js returns Object.freeze({...})
        // so scored.archetype is non-writable. Build a local mutable
        // `resolvedArch` instead of mutating scored.archetype.
        var resolvedArch = scored && scored.archetype;
        if (resolvedArch && resolvedArch.id && SCORING_SPEC.archetypes) {
          for (var ai = 0; ai < SCORING_SPEC.archetypes.length; ai += 1) {
            if (SCORING_SPEC.archetypes[ai].id === resolvedArch.id) {
              resolvedArch = SCORING_SPEC.archetypes[ai];
              break;
            }
          }
        }
        return Promise.resolve(window.HT.results.render(
          { archetype: resolvedArch, traits: scored && scored.traits },
          {
            slug: QUIZ_SLUG,
            title: (resolvedArch && resolvedArch.tagline) || '',
            conflict: (resolvedArch && resolvedArch.blindSpot) || '',
            wireActions: true
          }
        ));
        }).then(function (reveal) {
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
          // Story 10.12 — on completion during a challenge flow, stash
          // local answers and redirect to the compare view.
          if (window.HT.challengeReceiver) {
            var blob = window.HT.challengeReceiver.getChallengeBlob();
            if (blob) {
              window.HT.challengeReceiver.stashLocalAnswers(QUIZ_SLUG, answers);
              var compareUrl = './compare.html?c=' + encodeURIComponent(blob);
              var cta = document.createElement('a');
              cta.href = compareUrl;
              cta.className = 'btn btn-primary challenge-compare-cta';
              cta.setAttribute('role', 'button');
              cta.textContent = 'See your compatibility →';
              cta.style.marginTop = '0.75rem';
              cta.style.display = 'inline-block';
              var actions = body.querySelector('.quiz-result-actions');
              if (actions) {
                actions.appendChild(cta);
                cta.focus();
              }
            }
          }
        }
        }).then(undefined, function (e) {
          // Surface the lazy-load failure so the user sees an explanation
          // instead of an empty card with no console.
          try { console.error('Spirit Animal: result render failed:', e); } catch (_) {}
        });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
